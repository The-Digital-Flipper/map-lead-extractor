import { Router, type IRouter } from "express";
import { db, siteVisits } from "@workspace/db";

const router: IRouter = Router();

// Crawlers/monitors — don't count these as human traffic.
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pingdom|uptime|monitor|facebookexternalhit|preview|scan|curl|wget|python-requests/i;

function parseDevice(ua: string): string {
  if (/ipad|tablet|kindle|silk/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

function parseBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/chrome\/|crios\//i.test(ua)) return "Chrome";
  if (/safari\//i.test(ua)) return "Safari";
  return "Other";
}

function parseOs(ua: string): string {
  if (/windows/i.test(ua)) return "Windows";
  if (/iphone|ipad|ios/i.test(ua)) return "iOS";
  if (/mac os/i.test(ua)) return "macOS";
  if (/android/i.test(ua)) return "Android";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

const clean = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : "";
  return s || null;
};

// ---- POST /track — public pageview beacon (fired by the site on every route
// change via navigator.sendBeacon). Fire-and-forget: always answers 204 fast
// and never errors to the client — analytics must not break the site.
router.post("/track", async (req, res) => {
  res.status(204).end();

  try {
    const ua = String(req.headers["user-agent"] ?? "");
    if (BOT_RE.test(ua)) return;

    const b = (req.body ?? {}) as Record<string, unknown>;
    const path = clean(b.path, 300);
    const visitorId = clean(b.visitorId, 64);
    if (!path || !visitorId || !path.startsWith("/")) return;

    // Country if the proxy in front of us provides it (best-effort).
    const country = clean(req.headers["cf-ipcountry"] ?? req.headers["x-vercel-ip-country"], 8);
    const screenWidth = Number(b.screenWidth);

    await db.insert(siteVisits).values({
      visitorId,
      sessionId: clean(b.sessionId, 64),
      path,
      referrer: clean(b.referrer, 300),
      utmSource: clean(b.utmSource, 100),
      utmMedium: clean(b.utmMedium, 100),
      utmCampaign: clean(b.utmCampaign, 100),
      device: parseDevice(ua),
      browser: parseBrowser(ua),
      os: parseOs(ua),
      country,
      screenWidth: Number.isFinite(screenWidth) && screenWidth > 0 ? Math.round(screenWidth) : null,
    });
  } catch (err) {
    req.log.warn({ err }, "pageview insert failed");
  }
});

export default router;
