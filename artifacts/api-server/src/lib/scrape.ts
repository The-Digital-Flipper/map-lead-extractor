/**
 * In-process Google Maps scrape — the same pipeline as the standalone 24/7
 * worker (scripts/src/scrape), but driven from an admin request so the owner
 * can test a single search live from the dashboard.
 *
 * Drives a headless Maps search, reads the listings Google embeds in the page
 * (APP_INITIALIZATION_STATE) plus any pagination payloads, then reuses this same
 * server's existing /api/parse-gmaps and /api/leads/save endpoints over loopback
 * so leads are parsed, scored and de-duped exactly like an extension extraction.
 */
import { chromium } from "playwright";
import { pickProxy, recordProxyResult } from "./proxyPool";

// Replit ships a fully-wired Chromium (libraries resolved) via this env var;
// Playwright's own bundled browser is missing system libs on Replit's image.
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type ParsedPlace = {
  ftid: string;
  name: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  plusCode: string | null;
};

export type ScrapeResult = {
  term: string;
  places: number;
  saved: number;
  duplicates: number;
  // The parsed dataset for this run — capped so a big search doesn't bloat
  // the response/DB row; `places` above still reflects the true total found.
  items: Omit<ParsedPlace, "ftid" | "plusCode">[];
};

function loopbackBase(): string {
  return `http://127.0.0.1:${process.env.PORT ?? "5000"}`;
}

export async function scrapeAndSave(opts: {
  category: string;
  location?: string;
  maxScrolls?: number;
  // Caps how many parsed places get saved/returned — a real, honored limit
  // (unlike Apify's per-run cost cap, this is just a result-count cutoff).
  maxPlaces?: number;
  apiKey?: string;
}): Promise<ScrapeResult> {
  const term = opts.location ? `${opts.category} in ${opts.location}` : opts.category;
  // Bounded: this is a live test from a single web request, keep it short.
  const maxScrolls = Math.min(8, Math.max(0, opts.maxScrolls ?? 3));
  const base = loopbackBase();

  // Route through a rotating proxy when the pool has one (graceful fallback to
  // a direct connection when it's empty).
  const proxy = await pickProxy().catch(() => null);

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    proxy: proxy?.config,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  });

  const captured: string[] = [];
  try {
    const context = await browser.newContext({
      userAgent: UA,
      locale: "en-US",
      viewport: { width: 1280, height: 900 },
      timezoneId: "America/Chicago",
    });
    await context.addCookies([{ name: "CONSENT", value: "YES+cb", domain: ".google.com", path: "/" }]);
    const page = await context.newPage();

    // Capture pagination payloads (sniff by body content, skip tiles/logging).
    page.on("response", async (resp) => {
      const rt = resp.request().resourceType();
      if (rt !== "xhr" && rt !== "fetch") return;
      const url = resp.url();
      if (url.includes("/maps/vt") || url.includes("/log?") || url.includes("gen_204")) return;
      try {
        const text = await resp.text();
        if (text.length > 300 && (text.startsWith(")]}'") || /0x[0-9a-f]+:0x[0-9a-f]+/i.test(text))) {
          captured.push(text);
        }
      } catch {
        /* body unavailable — ignore */
      }
    });

    const url = `https://www.google.com/maps/search/${encodeURIComponent(term)}/?hl=en&gl=us`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector('[role="feed"], [role="main"]', { timeout: 20000 }).catch(() => {});

    // Primary source: the listings embedded in the page's initial JS state.
    const initState = await page
      .evaluate(() => {
        const s = (globalThis as { APP_INITIALIZATION_STATE?: unknown }).APP_INITIALIZATION_STATE;
        return s ? JSON.stringify(s) : null;
      })
      .catch(() => null);
    if (initState) captured.push(initState);

    const feed = page.locator('[role="feed"]').first();
    if ((await feed.count()) > 0) {
      let lastCount = -1;
      for (let i = 0; i < maxScrolls; i++) {
        await feed.evaluate((el) => el.scrollBy(0, el.scrollHeight)).catch(() => {});
        await page.waitForTimeout(1800);
        if ((await page.getByText(/reached the end of the list/i).count().catch(() => 0)) > 0) break;
        if (captured.length === lastCount && i > 1) break;
        lastCount = captured.length;
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  // Tell the pool whether this proxy worked (captured any results = healthy).
  if (proxy) await recordProxyResult(proxy.id, captured.length > 0).catch(() => {});

  // Parse every captured payload via the existing endpoint; dedupe by feature id.
  const byKey = new Map<string, ParsedPlace>();
  for (const body of captured) {
    try {
      const r = await fetch(`${base}/api/parse-gmaps`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body,
      });
      if (!r.ok) continue;
      const d = (await r.json()) as { leads?: ParsedPlace[] };
      for (const p of d.leads ?? []) {
        const k = p.ftid || `${p.name ?? ""}|${p.address ?? ""}`;
        if (k && !byKey.has(k)) byKey.set(k, p);
      }
    } catch {
      /* ignore a bad payload */
    }
  }
  const allPlaces = [...byKey.values()];
  const cap = opts.maxPlaces && opts.maxPlaces > 0 ? Math.floor(opts.maxPlaces) : undefined;
  const places = cap ? allPlaces.slice(0, cap) : allPlaces;

  // Shape like an extension extraction and save (server scores + de-dupes).
  const rows = places.map((p) => ({
    Name: p.name ?? "",
    Phone: p.phone ?? "",
    Website: p.website ?? "",
    Address: p.address ?? "",
    Category: opts.category,
    Rating: p.rating ?? "",
    "Rating info": p.reviews != null ? `${p.reviews} reviews` : "",
    "Plus Code": p.plusCode ?? "",
  }));

  let saved = 0;
  let duplicates = 0;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.apiKey) headers["x-api-key"] = opts.apiKey;
  // Batches of 200 stay under Express's 100kb json body limit.
  for (let i = 0; i < rows.length; i += 200) {
    try {
      const r = await fetch(`${base}/api/leads/save`, {
        method: "POST",
        headers,
        body: JSON.stringify(rows.slice(i, i + 200)),
      });
      if (r.ok) {
        const d = (await r.json()) as { saved?: number; duplicates?: number };
        saved += d.saved ?? 0;
        duplicates += d.duplicates ?? 0;
      }
    } catch {
      /* save failed — reported as 0 saved */
    }
  }

  const items = places.slice(0, 200).map((p) => ({
    name: p.name, phone: p.phone, website: p.website, address: p.address, rating: p.rating, reviews: p.reviews,
  }));
  // `places` reports the true number Google Maps matched, even if maxPlaces
  // capped how many were actually saved/returned.
  return { term, places: allPlaces.length, saved, duplicates, items };
}
