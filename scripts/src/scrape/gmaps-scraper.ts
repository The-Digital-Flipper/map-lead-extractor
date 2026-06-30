/**
 * 24/7 Google Maps lead scraper (server-side, headless browser).
 *
 *   pnpm --filter @workspace/scripts run scrape
 *
 * What it does, per query in queries.json:
 *   1. Drives a real headless Chromium to the Maps search results.
 *   2. Captures the internal `/search` XHR payloads (the `)]}'`-prefixed
 *      nested arrays) and scrolls the feed to paginate.
 *   3. POSTs each raw payload to the SITE's existing `/api/parse-gmaps`
 *      endpoint — the same parser the Chrome extension relies on.
 *   4. Maps the parsed places and POSTs them to `/api/leads/save`, so they
 *      flow into the site exactly like an extension extraction.
 *
 * It makes ONE pass over every query then exits — designed to be run on a
 * schedule (Replit Scheduled Deployment / cron). Set LOOP=1 to run forever
 * with a sleep between passes (for an always-on Reserved VM instead).
 *
 * ── Config (all env, all optional except where noted) ───────────────────────
 *   SITE_URL          Base URL of the deployed site API.  Default http://localhost:5000
 *   SCRAPER_API_KEY   X-Api-Key sent to /save so leads attribute to your account.
 *   QUERIES_FILE      Path to the query list.  Default ./queries.json (next to this file)
 *   MAX_SCROLLS       Feed scrolls per query (more = more results).  Default 8
 *   QUERY_DELAY_MS    Pause between queries, to look human / avoid blocks.  Default 6000
 *   HEADLESS          "0" to watch the browser (debug).  Default headless
 *   CHROMIUM_PATH     Override the browser binary (e.g. a nix-provided chromium).
 *   LOOP              "1" to loop forever; LOOP_DELAY_MS between passes (default 1h).
 */
import { chromium, type Browser, type BrowserContext } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { db, proxies } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE_URL = (process.env.SITE_URL ?? "http://localhost:5000").replace(/\/$/, "");
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY ?? "";
const QUERIES_FILE = process.env.QUERIES_FILE ?? resolve(__dirname, "queries.json");
const MAX_SCROLLS = Number(process.env.MAX_SCROLLS ?? "8");
const QUERY_DELAY_MS = Number(process.env.QUERY_DELAY_MS ?? "6000");
const HEADLESS = process.env.HEADLESS !== "0";
// Replit ships a fully-wired Chromium (libraries resolved) via this env var.
// Prefer it; fall back to an explicit CHROMIUM_PATH, then Playwright's bundled
// browser (which needs system libs that Replit's nix image doesn't provide).
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
const LOOP = process.env.LOOP === "1";
const LOOP_DELAY_MS = Number(process.env.LOOP_DELAY_MS ?? String(60 * 60 * 1000));

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ── Types ────────────────────────────────────────────────────────────────────
type QueryEntry = { category: string; location: string } | string;
type Query = { term: string; category: string };

// A parsed place as returned by /api/parse-gmaps.
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

// ── Helpers ──────────────────────────────────────────────────────────────────
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms: number) => ms + Math.floor((ms / 3) * (2 * pseudoRandom() - 1));

// Deterministic-enough randomness without Math.random gymnastics; just enough
// to vary timings/scroll between runs so behaviour isn't perfectly periodic.
let _seed = (Date.now() % 100000) + 1;
function pseudoRandom(): number {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}

function toQuery(q: QueryEntry): Query {
  if (typeof q === "string") {
    // Free-form term; category = first word(s) before " in ".
    const category = q.split(/\s+in\s+/i)[0]?.trim() || q;
    return { term: q, category };
  }
  return { term: `${q.category} in ${q.location}`, category: q.category };
}

function loadQueriesFromFile(): Query[] {
  const raw = JSON.parse(readFileSync(QUERIES_FILE, "utf8")) as QueryEntry[];
  return raw.map(toQuery);
}

// Pull the AI-researched active targets from the site (the "where to scrape"
// plan built on the admin AI Research tab). Set USE_DB_TARGETS=1 to use these.
async function loadQueriesFromDb(): Promise<Query[]> {
  const r = await fetch(`${SITE_URL}/api/admin/scrape-targets/active`);
  if (!r.ok) throw new Error(`scrape-targets/active ${r.status}`);
  const d = (await r.json()) as { targets?: { category: string; location: string }[] };
  return (d.targets ?? []).map((t) => toQuery({ category: t.category, location: t.location }));
}

async function loadQueries(): Promise<Query[]> {
  if (process.env.USE_DB_TARGETS === "1") {
    try {
      const q = await loadQueriesFromDb();
      if (q.length > 0) return q;
      log("No active DB targets — falling back to queries file.");
    } catch (err) {
      log("Could not load DB targets:", (err as Error).message, "— falling back to file.");
    }
  }
  return loadQueriesFromFile();
}

// ── Browser ──────────────────────────────────────────────────────────────────
async function makeContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: UA,
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
    timezoneId: "America/Chicago",
  });
  // Pre-accept Google consent so we don't get bounced to consent.google.com.
  await context.addCookies([
    { name: "CONSENT", value: "YES+cb", domain: ".google.com", path: "/" },
    { name: "SOCS", value: "CAISNQgQEitib3...", domain: ".google.com", path: "/" },
  ]);
  return context;
}

// Read the search results Google embeds in the page's initial JS state. This is
// the primary source — headless Maps puts the first page of listings here (not
// in a separate XHR). parse-gmaps recurses into it and finds the place arrays.
async function readInitState(page: import("playwright").Page): Promise<string | null> {
  return page
    .evaluate(() => {
      const s = (globalThis as { APP_INITIALIZATION_STATE?: unknown }).APP_INITIALIZATION_STATE;
      return s ? JSON.stringify(s) : null;
    })
    .catch(() => null);
}

/**
 * Drive one Maps search and return every raw results payload captured:
 * the initial JS state plus any pagination XHRs triggered by scrolling.
 */
async function scrapeQuery(context: BrowserContext, term: string): Promise<string[]> {
  const page = await context.newPage();
  const captured: string[] = [];

  // Capture pagination payloads fired as the feed scrolls. We sniff by body
  // content (starts with )]}' or packed with 0x..:0x.. feature ids) rather than
  // URL, since the listing endpoint varies — and skip map tiles / logging.
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
      /* body may be unavailable (redirect/preflight) — ignore */
    }
  });

  const url = `https://www.google.com/maps/search/${encodeURIComponent(term)}/?hl=en&gl=us`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page
      .waitForSelector('[role="feed"], [role="main"]', { timeout: 20000 })
      .catch(() => {});

    // Primary source: the embedded initial state (≈ first 20 listings).
    const initState = await readInitState(page);
    if (initState) captured.push(initState);

    const feed = page.locator('[role="feed"]').first();
    if ((await feed.count()) > 0) {
      let lastCount = -1;
      for (let i = 0; i < MAX_SCROLLS; i++) {
        await feed.evaluate((el) => el.scrollBy(0, el.scrollHeight)).catch(() => {});
        await page.waitForTimeout(jitter(1800));
        if ((await page.getByText(/reached the end of the list/i).count().catch(() => 0)) > 0) break;
        // Stop if scrolling stopped producing new pagination payloads.
        if (captured.length === lastCount && i > 1) break;
        lastCount = captured.length;
      }
    } else {
      await page.waitForTimeout(2000);
    }
  } catch (err) {
    log("  ! navigation error:", (err as Error).message);
  } finally {
    await page.close().catch(() => {});
  }

  return captured;
}

// ── Site API ─────────────────────────────────────────────────────────────────
async function parsePayloads(payloads: string[]): Promise<ParsedPlace[]> {
  const byFtid = new Map<string, ParsedPlace>();
  for (const body of payloads) {
    try {
      const res = await fetch(`${SITE_URL}/api/parse-gmaps`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body,
      });
      if (!res.ok) {
        log("  ! parse-gmaps", res.status);
        continue;
      }
      const data = (await res.json()) as { leads?: ParsedPlace[] };
      for (const p of data.leads ?? []) {
        const dedupKey = p.ftid || `${p.name ?? ""}|${p.address ?? ""}`;
        if (dedupKey && !byFtid.has(dedupKey)) byFtid.set(dedupKey, p);
      }
    } catch (err) {
      log("  ! parse-gmaps fetch failed:", (err as Error).message);
    }
  }
  return [...byFtid.values()];
}

async function saveLeads(places: ParsedPlace[], category: string): Promise<{ saved: number; duplicates: number }> {
  if (places.length === 0) return { saved: 0, duplicates: 0 };

  // Shape into the same record format the extension POSTs to /save. We inject
  // Category from the query (the parser doesn't return one) and pass the review
  // count as "Rating info" so the server's parseReviewCount picks it up.
  const rows = places.map((p) => ({
    Name: p.name ?? "",
    Phone: p.phone ?? "",
    Website: p.website ?? "",
    Address: p.address ?? "",
    Category: category,
    Rating: p.rating ?? "",
    "Rating info": p.reviews != null ? `${p.reviews} reviews` : "",
    "Plus Code": p.plusCode ?? "",
  }));

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (SCRAPER_API_KEY) headers["x-api-key"] = SCRAPER_API_KEY;

  let saved = 0;
  let duplicates = 0;
  // Batches of 200 keep each POST body well under Express's 100kb json limit
  // (a 1000-row body can exceed it and be rejected before /save runs).
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    try {
      const res = await fetch(`${SITE_URL}/api/leads/save`, {
        method: "POST",
        headers,
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        log("  ! /save", res.status, await res.text().catch(() => ""));
        continue;
      }
      const data = (await res.json()) as { saved?: number; duplicates?: number };
      saved += data.saved ?? 0;
      duplicates += data.duplicates ?? 0;
    } catch (err) {
      log("  ! /save fetch failed:", (err as Error).message);
    }
  }
  return { saved, duplicates };
}

// ── Proxy pool ───────────────────────────────────────────────────────────────
// Pull the least-recently-used healthy proxy straight from the DB so the cron
// worker rotates IPs too. Set USE_PROXIES=0 to force a direct connection.
async function pickProxy(): Promise<{ id: number; config: { server: string; username?: string; password?: string } } | null> {
  if (process.env.USE_PROXIES === "0") return null;
  try {
    const [p] = await db
      .select().from(proxies)
      .where(and(eq(proxies.active, true), sql`status <> 'dead'`))
      .orderBy(sql`last_used_at ASC NULLS FIRST`, sql`id ASC`)
      .limit(1);
    if (!p) return null;
    await db.update(proxies).set({ lastUsedAt: new Date() }).where(eq(proxies.id, p.id));
    const server = `${p.protocol ?? "http"}://${p.host}:${p.port}`;
    return { id: p.id, config: p.username ? { server, username: p.username, password: p.password ?? "" } : { server } };
  } catch {
    return null; // no proxies table / DB unreachable → direct connection
  }
}

async function recordProxy(id: number, ok: boolean): Promise<void> {
  try {
    if (ok) await db.update(proxies).set({ successCount: sql`success_count + 1`, status: "healthy" }).where(eq(proxies.id, id));
    else await db.update(proxies).set({ failCount: sql`fail_count + 1`, status: sql`CASE WHEN fail_count + 1 >= 3 THEN 'dead' ELSE status END` }).where(eq(proxies.id, id));
  } catch { /* ignore */ }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function runPass(queries: Query[]): Promise<void> {
  const proxy = await pickProxy();
  log(`Starting pass — ${queries.length} queries → ${SITE_URL}${proxy ? ` · via proxy #${proxy.id}` : " · direct"}`);
  const browser = await chromium.launch({
    headless: HEADLESS,
    executablePath: CHROMIUM_PATH,
    proxy: proxy?.config,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  });
  const context = await makeContext(browser);

  let totalSaved = 0;
  let totalDup = 0;
  try {
    for (const q of queries) {
      log(`▶ "${q.term}"`);
      const payloads = await scrapeQuery(context, q.term);
      const places = await parsePayloads(payloads);
      const { saved, duplicates } = await saveLeads(places, q.category);
      totalSaved += saved;
      totalDup += duplicates;
      log(`  ${places.length} places · ${saved} new · ${duplicates} dup`);
      await sleep(jitter(QUERY_DELAY_MS));
    }
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
  if (proxy) await recordProxy(proxy.id, totalSaved > 0 || totalDup > 0);
  log(`Pass complete — ${totalSaved} new, ${totalDup} duplicates across ${queries.length} queries`);
}

async function main(): Promise<void> {
  const queries = await loadQueries();
  if (queries.length === 0) {
    log("No queries in", QUERIES_FILE, "— nothing to do.");
    return;
  }

  if (!LOOP) {
    await runPass(queries);
    return;
  }

  // Always-on mode: loop forever with a sleep between passes.
  for (;;) {
    try {
      await runPass(queries);
    } catch (err) {
      log("Pass failed:", (err as Error).message);
    }
    log(`Sleeping ${Math.round(LOOP_DELAY_MS / 60000)}m before next pass…`);
    await sleep(LOOP_DELAY_MS);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
