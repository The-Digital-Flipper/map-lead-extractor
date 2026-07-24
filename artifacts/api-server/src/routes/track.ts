import { Router, type IRouter } from "express";
import { db, siteVisits } from "@workspace/db";

const router: IRouter = Router();

// Crawlers/monitors — don't count these as human traffic.
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|headless|lighthouse|pingdom|uptime|monitor|facebookexternalhit|preview|scan|curl|wget|python-requests/i;

// The Replit editor/preview iframe — this is the owner building/testing the
// site, not a real visitor. Beacons fired from there carry a replit host in
// their Origin/Referer, so we drop them before they reach the DB.
const PREVIEW_RE = /replit\.dev|replit\.com|repl\.co|riker\.replit/i;

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

// ── IP → country (best-effort) ────────────────────────────────────────────────
// Replit's proxy doesn't set a geo header, so visits had country = null. We
// look the IP up once via a free geo API and cache it in memory; failures just
// leave country null. Runs after the 204 is sent — never slows the beacon.
const geoCache = new Map<string, string | null>();

function clientIp(req: import("express").Request): string | null {
  const fwd = String(req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim();
  const ip = fwd || req.socket.remoteAddress || "";
  // Skip local/private ranges — nothing to geolocate.
  if (!ip || /^(::1|::ffff:)?(10\.|127\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|fc|fd)/i.test(ip)) return null;
  return ip.replace(/^::ffff:/i, "");
}

async function lookupCountry(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  if (geoCache.has(ip)) return geoCache.get(ip) ?? null;
  if (geoCache.size > 10_000) geoCache.clear();
  let country: string | null = null;
  try {
    const res = await fetch(`https://api.country.is/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const d = (await res.json()) as { country?: string };
      country = typeof d.country === "string" && /^[A-Z]{2}$/.test(d.country) ? d.country : null;
    }
  } catch { /* stay null */ }
  geoCache.set(ip, country);
  return country;
}

// ---- POST /track — public pageview beacon (fired by the site on every route
// change via navigator.sendBeacon). Fire-and-forget: always answers 204 fast
// and never errors to the client — analytics must not break the site.
router.post("/track", async (req, res) => {
  res.status(204).end();

  try {
    const ua = String(req.headers["user-agent"] ?? "");
    if (BOT_RE.test(ua)) return;

    // Drop the owner's own editor/preview traffic (Replit iframe).
    const source = `${req.headers.origin ?? ""} ${req.headers.referer ?? ""}`;
    if (PREVIEW_RE.test(source)) return;

    const b = (req.body ?? {}) as Record<string, unknown>;
    const path = clean(b.path, 300);
    const visitorId = clean(b.visitorId, 64);
    if (!path || !visitorId || !path.startsWith("/")) return;

    // Country: proxy geo header when present, otherwise a cached IP lookup.
    const country =
      clean(req.headers["cf-ipcountry"] ?? req.headers["x-vercel-ip-country"], 8) ??
      (await lookupCountry(clientIp(req)));
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
