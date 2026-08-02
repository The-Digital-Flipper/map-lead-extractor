/**
 * Yelp lead engine — backed by Yelp's official Fusion API, not DOM scraping.
 *
 * Yelp aggressively blocks headless-browser scraping (HTTP 403 even through
 * residential proxies + a real Chromium), so the old Playwright engine could
 * never reliably return results. The Fusion Business Search API is the
 * supported, un-blockable path: an API key, JSON responses, and a generous
 * free quota (~5,000 calls/day). Same output shape + loopback save as the
 * Google/Bing engines, so nothing downstream changes.
 *
 * Field coverage vs. the old scraper: Fusion now gives us a real PHONE number
 * (the DOM scraper never could). It does NOT expose the business's own website
 * or email — those aren't in the Fusion payload — so Website/Email stay blank
 * here (a real, documented gap, not a bug).
 */
import type { ScrapeResult } from "./scrape";

const YELP_SEARCH_URL = "https://api.yelp.com/v3/businesses/search";
const PER_PAGE = 50; // Fusion hard max per request
const HARD_CAP = 240; // Fusion caps how deep search paging goes; stay under it
const DEFAULT_CAP = 50;

type YelpBusiness = {
  name?: string;
  phone?: string;
  display_phone?: string;
  url?: string;
  rating?: number;
  review_count?: number;
  categories?: { alias: string; title: string }[];
  location?: { display_address?: string[] };
};

function yelpApiKey(): string {
  return process.env.YELP_API_KEY || process.env.YELP_FUSION_API_KEY || "";
}

function loopbackBase(): string {
  return `http://127.0.0.1:${process.env.PORT ?? "5000"}`;
}

export async function scrapeYelpAndSave(opts: {
  category: string;
  location?: string;
  maxPlaces?: number;
  apiKey?: string;
}): Promise<ScrapeResult> {
  const key = yelpApiKey();
  if (!key) {
    throw new Error(
      "Yelp search needs a Yelp Fusion API key. Add a YELP_API_KEY secret (free at https://www.yelp.com/developers) and try again.",
    );
  }
  const location = (opts.location ?? "").trim();
  if (!location) {
    throw new Error('Yelp search needs a location — e.g. "Mobile, AL" or "Austin, TX".');
  }

  const term = `${opts.category} in ${location}`;
  const cap = Math.min(
    opts.maxPlaces && opts.maxPlaces > 0 ? Math.floor(opts.maxPlaces) : DEFAULT_CAP,
    HARD_CAP,
  );

  const byKey = new Map<string, YelpBusiness>();
  let total = 0;

  for (let offset = 0; offset < cap; offset += PER_PAGE) {
    const limit = Math.min(PER_PAGE, cap - offset);
    const url = `${YELP_SEARCH_URL}?term=${encodeURIComponent(opts.category)}&location=${encodeURIComponent(location)}&limit=${limit}&offset=${offset}`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; description?: string } };
      const desc = body.error?.description || body.error?.code || "";
      // Yelp returns 400 with LOCATION_NOT_FOUND / TOO_MANY_RESULTS_REQUESTED
      // once paging runs past the available set — stop cleanly and keep what
      // we have rather than failing the whole run.
      if (res.status === 400 && offset > 0) break;
      if (res.status === 401)
        throw new Error("Yelp rejected the API key (401). Check the YELP_API_KEY secret is a valid Fusion key.");
      if (res.status === 429)
        throw new Error("Yelp Fusion API daily rate limit reached (429). Try again tomorrow or raise your quota.");
      throw new Error(`Yelp Fusion API error ${res.status}${desc ? `: ${desc}` : ""}`);
    }

    const data = (await res.json()) as { businesses?: YelpBusiness[]; total?: number };
    total = data.total ?? total;
    const businesses = data.businesses ?? [];
    if (businesses.length === 0) break;

    for (const b of businesses) {
      const k = b.url || `${b.name ?? ""}|${b.location?.display_address?.join(" ") ?? ""}`;
      if (k && !byKey.has(k)) byKey.set(k, b);
    }

    if (byKey.size >= cap) break;
    if (offset + limit >= (data.total ?? Infinity)) break; // no more results to page
  }

  const places = [...byKey.values()].slice(0, cap);

  const rows = places.map((b) => ({
    Name: b.name ?? "",
    Phone: b.display_phone || b.phone || "",
    Website: "",
    Address: b.location?.display_address?.join(", ") ?? "",
    Category: b.categories?.map((c) => c.title).join(", ") || opts.category,
    Rating: b.rating ?? "",
    "Rating info": b.review_count != null ? `${b.review_count} reviews` : "",
  }));

  let saved = 0;
  let duplicates = 0;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.apiKey) headers["x-api-key"] = opts.apiKey;
  const base = loopbackBase();
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

  const items = places.slice(0, 200).map((b) => ({
    name: b.name ?? null,
    phone: b.display_phone || b.phone || null,
    website: null,
    address: b.location?.display_address?.join(", ") ?? null,
    rating: b.rating ?? null,
    reviews: b.review_count ?? null,
  }));

  return { term, places: total || places.length, saved, duplicates, items };
}
