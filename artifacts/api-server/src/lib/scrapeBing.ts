/// <reference lib="dom" />
/**
 * In-process Bing Maps scrape — server-side sibling of scrape.ts (Google Maps).
 *
 * Bing Maps doesn't expose a Google-style JSON XHR payload we can sniff off
 * the network, so this reads the DOM directly via page.evaluate(). The
 * layout selectors and entity-field mapping below are ported from this same
 * product's shipping Bing Maps Chrome extension (attached_assets/extension-with-sync,
 * the Bing build's src/selectors.js + panel/panel.js entityToRow logic) rather
 * than guessed — that code already knows Bing embeds each listing's full data
 * as JSON in a `data-entity` attribute on the result card, which is far more
 * reliable than scraping visible text field-by-field.
 */
import { chromium } from "playwright";
import { pickProxy, recordProxyResult } from "./proxyPool";
import type { ScrapeResult } from "./scrape";

const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Ported from the Bing extension's src/selectors.js (BING_SELECTOR_VERSION
// 2026-06-23.1) — Bing-owned DOM, kept here so a layout change is a one-file fix.
const BING_LAYOUTS = [
  {
    id: "new",
    detectors: ["#appShellRoot", ".b_lstcards", ".listingsPanel", "[data-automation-id='resultsList']"],
    listContainer: [".b_lstcards", ".listingsPanel", "[data-automation-id='resultsList']", "[class*='resultsList']", "[class*='listingsPanel']"],
    listItems: ["[data-entity]", "li[data-key]", "[data-entity-id]", "li .b_split_card", "button [class*='listingContent']", "[class*='listingContent']"],
    scrollContainer: [".b_lstcards", ".b_split_cards_cont", "[data-automation-id='resultsList']", "[class*='resultsList']", "[class*='listingsPanel']"],
    advanceButton: [
      "button[data-automation-id='searchThisAreaButton']", "button[class*='searchThisAreaButton']",
      "[class*='searchThisAreaButton'][role='button']", "button[aria-label*='Search this area']",
      "button[aria-label*='More results']", "button[aria-label*='Load more']", "button[aria-label*='Show more']",
      "a.bm_rightChevron", "button[aria-label*='Next']", "a[aria-label*='Next']",
    ],
  },
  {
    id: "legacy",
    detectors: [".b_vList", ".bm_oneMap", ".entity-listing-container"],
    listContainer: [".b_vList", ".entity-listing-container", ".bm_oneMap"],
    listItems: ["a.listings-item[data-entity]", "[data-entity]", "li a", ".entity-listing"],
    scrollContainer: [".b_vList", ".entity-listing-container", ".bm_oneMap"],
    advanceButton: ["button[aria-label*='Search this area']", "button[aria-label*='More results']", "a.bm_rightChevron", "button[aria-label*='Next']"],
  },
];

type BingPlace = {
  key: string;
  name: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
};

// Runs inside the page — ported from panel.js's entityToRow()/firstValue()/
// addressToText()/phoneToText()/normalizeWebsite() field-mapping logic.
function harvestEntities(layouts: typeof BING_LAYOUTS): BingPlace[] {
  function firstValue(...values: unknown[]): unknown {
    for (const v of values) {
      if (v === null || v === undefined) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === "string" && v.trim() === "") continue;
      return v;
    }
    return undefined;
  }
  function addressToText(value: unknown): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(addressToText).filter(Boolean).join(", ");
    if (typeof value === "object") {
      const o = value as Record<string, unknown>;
      const v = firstValue(
        o.formattedAddress, o.addressLine, o.streetAddress,
        [o.addressLine, o.locality, o.adminDistrict, o.postalCode].filter(Boolean).join(", "),
      );
      return v ? String(v) : "";
    }
    return String(value);
  }
  function phoneToText(value: unknown): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(phoneToText).filter(Boolean).join("; ");
    if (typeof value === "object") {
      const o = value as Record<string, unknown>;
      const v = firstValue(o.number, o.displayNumber, o.text);
      return v ? String(v) : "";
    }
    return String(value);
  }
  function normalizeWebsite(value: unknown): string {
    if (!value) return "";
    if (typeof value === "object") {
      const o = value as Record<string, unknown>;
      const v = firstValue(o.url, o.href, o.displayUrl);
      return v ? String(v) : "";
    }
    return String(value);
  }
  function toNum(value: unknown): number | null {
    const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[^0-9.]/g, "")) : NaN;
    return Number.isFinite(n) ? n : null;
  }

  let container: Element | null = null;
  let layout: (typeof layouts)[number] | null = null;
  for (const l of layouts) {
    const hit = l.detectors.map((s) => document.querySelector(s)).find(Boolean);
    if (hit) {
      layout = l;
      for (const sel of l.listContainer) {
        const c = document.querySelector(sel);
        if (c) { container = c; break; }
      }
      break;
    }
  }
  if (!layout || !container) return [];

  const nodes = new Set<Element>();
  for (const sel of layout.listItems) {
    try { document.querySelectorAll(sel).forEach((n) => nodes.add(n)); } catch { /* bad selector for this layout id */ }
  }

  const carriers = new Set<Element>();
  for (const node of nodes) {
    const carrier = node.hasAttribute("data-entity") ? node : node.closest("[data-entity]") || node.querySelector("[data-entity]");
    if (carrier) carriers.add(carrier);
  }

  const out: BingPlace[] = [];
  const seen = new Set<string>();
  for (const carrier of carriers) {
    const raw = carrier.getAttribute("data-entity");
    if (!raw) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { continue; }
    const wrapped = parsed as { entity?: Record<string, unknown> } & Record<string, unknown>;
    const entity = (wrapped?.entity && typeof wrapped.entity === "object" ? wrapped.entity : wrapped) as Record<string, unknown>;
    if (!entity) continue;

    const realId = firstValue(entity.id, entity.entityId, entity.localEntityId, wrapped?.id);
    const name = firstValue(entity.title, entity.name, entity.displayName);
    const address = addressToText(firstValue(entity.address, entity.addressLines, (entity.location as Record<string, unknown> | undefined)?.address));
    const key = realId ? String(realId) : [name, address].filter(Boolean).join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const rating = toNum(firstValue(
      entity.rating, entity.averageRating, entity.ratingScore, entity.reviewScore, entity.starRating, entity.stars, entity.ratingValue,
    ));
    const reviews = toNum(firstValue(
      entity.ratingCount, entity.reviewCount, entity.numReviews, entity.totalRatings, entity.totalReviews,
    ));

    out.push({
      key,
      name: name ? String(name) : null,
      phone: phoneToText(firstValue(entity.phone, entity.telephone, entity.phoneNumber)) || null,
      website: normalizeWebsite(firstValue(entity.website, entity.url, entity.homepage)) || null,
      address: address || null,
      rating,
      reviews,
    });
  }
  return out;
}

async function scrollAndAdvance(page: import("playwright").Page, layouts: typeof BING_LAYOUTS): Promise<void> {
  await page.evaluate((layouts) => {
    let container: Element | null = null;
    let layout: (typeof layouts)[number] | null = null;
    for (const l of layouts) {
      const hit = l.detectors.map((s) => document.querySelector(s)).find(Boolean);
      if (hit) {
        layout = l;
        for (const sel of l.scrollContainer) {
          const c = document.querySelector(sel);
          if (c) { container = c; break; }
        }
        break;
      }
    }
    if (!layout || !container) return;
    const el = container as HTMLElement;
    const before = el.scrollTop;
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < Math.max(24, el.clientHeight * 0.08);
    if (atBottom && el.scrollTop === before) {
      for (const sel of layout.advanceButton) {
        const btn = document.querySelector(sel) as HTMLElement | null;
        if (btn && btn.offsetParent !== null) { btn.click(); break; }
      }
    }
  }, layouts);
}

function loopbackBase(): string {
  return `http://127.0.0.1:${process.env.PORT ?? "5000"}`;
}

export async function scrapeBingAndSave(opts: {
  category: string;
  location?: string;
  maxScrolls?: number;
  maxPlaces?: number;
  apiKey?: string;
}): Promise<ScrapeResult> {
  const term = opts.location ? `${opts.category} in ${opts.location}` : opts.category;
  const maxScrolls = Math.min(8, Math.max(0, opts.maxScrolls ?? 3));
  const base = loopbackBase();

  const proxy = await pickProxy().catch(() => null);

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    proxy: proxy?.config,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  });

  const byKey = new Map<string, BingPlace>();
  try {
    const context = await browser.newContext({
      userAgent: UA,
      locale: "en-US",
      viewport: { width: 1280, height: 900 },
      timezoneId: "America/Chicago",
    });
    const page = await context.newPage();

    const url = `https://www.bing.com/maps?q=${encodeURIComponent(term)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(BING_LAYOUTS.flatMap((l) => l.detectors).join(", "), { timeout: 20000 }).catch(() => {});
    // Bing's result list streams in after the shell mounts — a fixed settle
    // beat before the first harvest avoids racing an empty list.
    await page.waitForTimeout(1500);

    let stableRounds = 0;
    let lastCount = -1;
    for (let i = 0; i <= maxScrolls; i++) {
      const found = await page.evaluate(harvestEntities, BING_LAYOUTS).catch(() => [] as BingPlace[]);
      for (const p of found) if (!byKey.has(p.key)) byKey.set(p.key, p);

      if (opts.maxPlaces && byKey.size >= opts.maxPlaces) break;
      if (byKey.size === lastCount) {
        stableRounds++;
        if (stableRounds >= 2) break;
      } else {
        stableRounds = 0;
      }
      lastCount = byKey.size;

      if (i === maxScrolls) break;
      await scrollAndAdvance(page, BING_LAYOUTS).catch(() => {});
      await page.waitForTimeout(850);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  if (proxy) await recordProxyResult(proxy.id, byKey.size > 0).catch(() => {});

  const allPlaces = [...byKey.values()];
  const cap = opts.maxPlaces && opts.maxPlaces > 0 ? Math.floor(opts.maxPlaces) : undefined;
  const places = cap ? allPlaces.slice(0, cap) : allPlaces;

  const rows = places.map((p) => ({
    Name: p.name ?? "",
    Phone: p.phone ?? "",
    Website: p.website ?? "",
    Address: p.address ?? "",
    Category: opts.category,
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
    name: p.name, phone: p.phone, website: p.website, address: p.address, rating: p.rating, reviews: p.reviews,
  }));
  return { term, places: allPlaces.length, saved, duplicates, items };
}
