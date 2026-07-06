/**
 * In-process Yelp Business scrape — same shape/pipeline as scrape.ts's Google
 * Maps engine (proxy pool, headless Chromium, save via loopback /api/leads/save)
 * but reading Yelp's search-results DOM directly instead of Google's internal
 * XHR payloads, since Yelp has no equivalent parse-* endpoint.
 *
 * Yelp's result cards don't expose phone/website — those only live on each
 * business's own detail page, which this scraper does NOT visit (too slow,
 * too much extra scrape surface for an MVP). phone/website are always null
 * here; that's a real, known gap, not a bug.
 */
import { chromium } from "playwright";
import { pickProxy, recordProxyResult } from "./proxyPool";
import type { ScrapeResult } from "./scrape";

const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type YelpResult = {
  name: string | null;
  href: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
  category: string | null;
};

const RESULTS_PER_PAGE = 10;
const MAX_PAGES = 4;

function loopbackBase(): string {
  return `http://127.0.0.1:${process.env.PORT ?? "5000"}`;
}

export async function scrapeYelpAndSave(opts: {
  category: string;
  location?: string;
  maxPlaces?: number;
  apiKey?: string;
}): Promise<ScrapeResult> {
  const term = opts.location ? `${opts.category} in ${opts.location}` : opts.category;
  const base = loopbackBase();
  const cap = opts.maxPlaces && opts.maxPlaces > 0 ? Math.floor(opts.maxPlaces) : undefined;
  const maxPages = cap ? Math.min(MAX_PAGES, Math.ceil(cap / RESULTS_PER_PAGE)) : MAX_PAGES;

  const proxy = await pickProxy().catch(() => null);

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    proxy: proxy?.config,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  });

  const byKey = new Map<string, YelpResult>();
  let blocked = false;
  try {
    const context = await browser.newContext({
      userAgent: UA,
      locale: "en-US",
      viewport: { width: 1280, height: 900 },
      timezoneId: "America/Chicago",
    });
    const page = await context.newPage();

    for (let pageIdx = 0; pageIdx < maxPages; pageIdx++) {
      const url = `https://www.yelp.com/search?find_desc=${encodeURIComponent(opts.category)}&find_loc=${encodeURIComponent(opts.location ?? "")}&start=${pageIdx * RESULTS_PER_PAGE}`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

      // Best-effort cookie/consent dismiss — never blocks scraping if absent.
      await page.getByRole("button", { name: /accept/i }).first().click({ timeout: 2500 }).catch(() => {});

      const hasResults = await page.locator('a[href^="/biz/"]').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      if (!hasResults) {
        // Either genuinely no more results, or a captcha/interstitial — check
        // for a captcha hint and stop the whole run early rather than retry.
        const captchaHint = await page.getByText(/verify you are a human|unusual traffic/i).count().catch(() => 0);
        if (captchaHint > 0) blocked = true;
        break;
      }

      // This callback runs in the browser, not Node — the server tsconfig has
      // no "dom" lib, so DOM globals are typed loosely via `any` rather than
      // pulling browser lib types into the whole server build.
      const pageResults: YelpResult[] = await page.evaluate(() => {
        const doc = (globalThis as any).document;
        const out: { name: string; href: string | null; address: string | null; rating: number | null; reviews: number | null; category: string | null }[] = [];
        const seenOnPage = new Set<any>();
        const bizLinks: any[] = Array.from(doc.querySelectorAll('a[href^="/biz/"]'));
        for (const link of bizLinks) {
          // Business name links are the heading-level ones; Yelp also emits
          // /biz/ links for photo thumbnails etc. — skip those (no text).
          const name = link.textContent?.trim() || "";
          if (!name) continue;
          // Walk up to a reasonably-sized card container so rating/address
          // lookups stay scoped to this one result, not the whole page.
          let card: any = link;
          for (let i = 0; i < 6 && card; i++) {
            card = card.parentElement;
            if (card && card.querySelector('[aria-label*="star rating" i]')) break;
          }
          if (!card || seenOnPage.has(card)) continue;
          seenOnPage.add(card);

          const ratingEl = card.querySelector('[aria-label*="star rating" i]');
          const ratingLabel = ratingEl?.getAttribute("aria-label") ?? "";
          const ratingMatch = ratingLabel.match(/([\d.]+)\s*star/i);
          const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

          const cardText = card.textContent ?? "";
          const reviewsMatch = cardText.match(/\((\d+)\)/);
          const reviews = reviewsMatch ? parseInt(reviewsMatch[1], 10) : null;

          // Address heuristic: a short text node containing a digit followed
          // by street-ish words, since Yelp's address markup has no stable
          // class name. Best-effort — may miss or misfire on some layouts.
          let address: string | null = null;
          const candidates: any[] = Array.from(card.querySelectorAll("p, span"));
          for (const el of candidates) {
            const t = el.textContent?.trim() ?? "";
            if (/^\d+\s+\S/.test(t) && t.length < 80 && !/star rating/i.test(t)) { address = t; break; }
          }

          const categoryLinks = (Array.from(card.querySelectorAll('a[href*="cflt="]')) as any[])
            .map((a) => a.textContent?.trim())
            .filter(Boolean);
          const category = categoryLinks.length ? categoryLinks.join(", ") : null;

          out.push({ name, href: link.getAttribute("href"), address, rating, reviews, category });
        }
        return out;
      }).catch(() => [] as YelpResult[]);

      for (const r of pageResults) {
        const k = r.href || `${r.name ?? ""}|${r.address ?? ""}`;
        if (k && !byKey.has(k)) byKey.set(k, r);
      }

      if (cap && byKey.size >= cap) break;
      if (pageResults.length === 0) break;
    }
  } finally {
    await browser.close().catch(() => {});
  }

  if (proxy) await recordProxyResult(proxy.id, byKey.size > 0).catch(() => {});
  if (blocked && byKey.size === 0) {
    throw new Error("Yelp blocked this request (captcha/interstitial) before any results loaded — try again later or via a different proxy.");
  }

  const allPlaces = [...byKey.values()];
  const places = cap ? allPlaces.slice(0, cap) : allPlaces;

  const rows = places.map((p) => ({
    Name: p.name ?? "",
    Phone: "",
    Website: "",
    Address: p.address ?? "",
    Category: p.category || opts.category,
    Rating: p.rating ?? "",
    "Rating info": p.reviews != null ? `${p.reviews} reviews` : "",
  }));

  let saved = 0;
  let duplicates = 0;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.apiKey) headers["x-api-key"] = opts.apiKey;
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
    name: p.name, phone: null, website: null, address: p.address, rating: p.rating, reviews: p.reviews,
  }));
  return { term, places: allPlaces.length, saved, duplicates, items };
}
