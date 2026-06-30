import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, leads, users, logs, scrapeTargets, proxies, computeOpportunity, computeValue } from "@workspace/db";
import { sql, count, gte, eq, and, desc, asc, isNull, isNotNull } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { scrapeAndSave } from "../lib/scrape";
import { researchTargets } from "../lib/research";
import { analyzeLeads } from "../lib/analyze";
import { discoverBusinesses } from "../lib/discover";
import { parseProxyLines, testProxy } from "../lib/proxyPool";

const router = Router();

// Guard against overlapping scrape runs — one browser at a time.
let scrapeInFlight = false;

// ── Admin secret guard ────────────────────────────────────────────────────────
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"] ?? req.query.secret;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// Lighter guard for the expensive endpoints (paid AI + headless browser): allow
// the admin secret OR a signed-in Clerk session. The admin dashboard is behind
// Clerk login and its same-origin fetches carry the session, so this blocks
// anonymous internet abuse without breaking the UI or exposing the secret.
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"] ?? req.query.secret;
  if (ADMIN_SECRET && secret === ADMIN_SECRET) { next(); return; }
  if (getAuth(req).userId) { next(); return; }
  res.status(401).json({ error: "Sign in as admin to use this." });
}

// ---- GET /logs — latest 100 extension telemetry rows -----------------------
router.get("/logs", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(logs).orderBy(desc(logs.id)).limit(100);
  res.json({ count: rows.length, logs: rows });
});

// ---- GET /stats — headline numbers ------------------------------------------
router.get("/stats", async (_req, res) => {
  const [totalRow, todayRow, weekRow] = await Promise.all([
    db.select({ total: count() }).from(leads),
    db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM leads
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM leads
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `),
  ]);

  res.json({
    total: Number(totalRow[0].total),
    today: Number((todayRow.rows[0] as { cnt: number }).cnt),
    week: Number((weekRow.rows[0] as { cnt: number }).cnt),
  });
});

// ---- GET /revenue — Stripe MRR + subscriber data ----------------------------
router.get("/revenue", async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();

    const [activeSubs, userCountRow] = await Promise.all([
      stripe.subscriptions.list({ status: "active", limit: 100, expand: ["data.items.data.price"] }),
      db.select({ cnt: count() }).from(users),
    ]);

    let mrr = 0;
    for (const sub of activeSubs.data) {
      for (const item of sub.items.data) {
        const price = item.price as { unit_amount: number | null; recurring: { interval: string } | null };
        if (price.unit_amount && price.recurring) {
          const monthly = price.recurring.interval === "year"
            ? price.unit_amount / 12
            : price.unit_amount;
          mrr += monthly * (item.quantity ?? 1);
        }
      }
    }

    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const recentCharges = await stripe.charges.list({ limit: 100, created: { gte: thirtyDaysAgo } });
    const monthRevenue = recentCharges.data
      .filter(c => c.paid && c.amount_captured > 0)
      .reduce((sum, c) => sum + c.amount_captured, 0);

    res.json({
      mrr: Math.round(mrr) / 100,
      subscriberCount: activeSubs.data.length,
      monthRevenue: Math.round(monthRevenue) / 100,
      totalUsers: Number(userCountRow[0].cnt),
      hasMoreSubs: activeSubs.has_more,
    });
  } catch {
    res.json({ mrr: 0, subscriberCount: 0, monthRevenue: 0, totalUsers: 0, hasMoreSubs: false });
  }
});

// ---- GET /users — all registered users with plan + lead count ----------------
router.get("/users", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, parseInt(String(req.query.limit ?? "50"), 10) || 50);
  const offset = (page - 1) * limit;

  try {
    const [rows, totalRow] = await Promise.all([
      db.execute(sql`
        SELECT
          u.id,
          u.email,
          u.stripe_customer_id,
          u.created_at,
          COALESCE(s.sub_status, 'free') AS plan,
          s.period_end,
          s.cancel_at,
          COALESCE(lc.lead_count, 0)::int AS lead_count,
          COALESCE(lc.money_lead_count, 0)::int AS money_lead_count,
          COALESCE(lc.hot_lead_count, 0)::int AS hot_lead_count,
          lc.last_active
        FROM users u
        LEFT JOIN (
          SELECT customer, status AS sub_status,
                 current_period_end AS period_end,
                 cancel_at
          FROM stripe.subscriptions
          WHERE status = 'active'
        ) s ON s.customer = u.stripe_customer_id
        LEFT JOIN LATERAL (
          -- Count every lead this member extracted (including businesses also
          -- pulled by others) via the extracted_by demand list — true activity.
          SELECT
            COUNT(*)::int AS lead_count,
            COUNT(*) FILTER (WHERE opportunity_score >= 40)::int AS money_lead_count,
            COUNT(*) FILTER (WHERE opportunity_score >= 70)::int AS hot_lead_count,
            MAX(updated_at) AS last_active
          FROM leads
          WHERE jsonb_exists(COALESCE(extracted_by, '[]'::jsonb), u.id)
        ) lc ON TRUE
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.select({ cnt: count() }).from(users),
    ]);

    const total = Number(totalRow[0].cnt);
    res.json({ users: rows.rows, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch {
    res.json({ users: [], total: 0, page: 1, pages: 1 });
  }
});

// ---- GET /geo — state-level lead counts parsed from addresses ---------------
// ?minOpportunity=N restricts to "money" leads so the heatmap can show where
// the sellable opportunity is concentrated (sell by territory).
router.get("/geo", async (req, res) => {
  const minOpportunity = parseInt(String(req.query.minOpportunity ?? "0"), 10) || 0;
  const oppFilter = minOpportunity > 0 ? sql` AND opportunity_score >= ${minOpportunity}` : sql``;

  const rows = await db.execute(sql`
    SELECT
      UPPER(
        (regexp_matches(address, '[A-Z]{2}\\s+\\d{5}', 'g'))[1]
      ) AS raw_match,
      COUNT(*)::int AS cnt
    FROM leads
    WHERE address IS NOT NULL
      AND address ~ '[A-Z]{2}\\s+\\d{5}'${oppFilter}
    GROUP BY raw_match
    ORDER BY cnt DESC
  `);

  type RawRow = { raw_match: string; cnt: number };

  const byState: Record<string, number> = {};
  for (const row of rows.rows as RawRow[]) {
    if (!row.raw_match) continue;
    const state = row.raw_match.slice(0, 2).toUpperCase();
    if (/^[A-Z]{2}$/.test(state)) {
      byState[state] = (byState[state] ?? 0) + Number(row.cnt);
    }
  }

  const cityRows = await db.execute(sql`
    SELECT
      TRIM(
        (string_to_array(address, ','))[array_length(string_to_array(address, ','), 1) - 1]
      ) AS city,
      COUNT(*)::int AS cnt
    FROM leads
    WHERE address IS NOT NULL AND address LIKE '%,%'${oppFilter}
    GROUP BY city
    ORDER BY cnt DESC
    LIMIT 20
  `);

  type CityRow = { city: string; cnt: number };

  const topCities = (cityRows.rows as CityRow[])
    .filter(r => r.city && r.city.length > 1)
    .map(r => ({ city: r.city.trim(), count: Number(r.cnt) }));

  res.json({ byState, topCities });
});

// ---- GET /opportunity-by-category — money intelligence per vertical ---------
// Powers the entire Command Center: leaderboard (which categories hold the most
// high-opportunity "money" leads), a summary (hot/warm/cold/no-website/reachable),
// and the needs breakdown — all optionally scoped to one state via ?state=XX
// so clicking a state on the heatmap re-filters everything.
router.get("/opportunity-by-category", async (req, res) => {
  const state = String(req.query.state ?? "").trim().toUpperCase();
  // Territory filter: match "<STATE> <ZIP>" inside the address (word-boundary).
  const stateFilter = /^[A-Z]{2}$/.test(state)
    ? sql` AND address ~ ${"\\y" + state + "\\s+\\d{5}"}`
    : sql``;

  const [catRows, summaryRows, needsRows] = await Promise.all([
    db.execute(sql`
      SELECT
        category,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE opportunity_score >= 70)::int AS hot,
        COUNT(*) FILTER (WHERE opportunity_score >= 40 AND opportunity_score < 70)::int AS warm,
        COALESCE(ROUND(AVG(opportunity_score)), 0)::int AS avg_opportunity,
        COUNT(*) FILTER (WHERE website IS NULL OR website = '')::int AS no_website,
        COUNT(*) FILTER (WHERE phone IS NOT NULL OR emails IS NOT NULL)::int AS reachable
      FROM leads
      WHERE category IS NOT NULL AND category <> ''${stateFilter}
      GROUP BY category
      ORDER BY hot DESC, total DESC
      LIMIT 30
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE opportunity_score >= 70)::int AS hot,
        COUNT(*) FILTER (WHERE opportunity_score >= 40 AND opportunity_score < 70)::int AS warm,
        COUNT(*) FILTER (WHERE opportunity_score < 40)::int AS cold,
        COUNT(*) FILTER (WHERE website IS NULL OR website = '')::int AS no_website,
        COUNT(*) FILTER (WHERE phone IS NOT NULL OR emails IS NOT NULL)::int AS reachable
      FROM leads
      WHERE TRUE${stateFilter}
    `),
    db.execute(sql`
      SELECT need AS need, COUNT(*)::int AS cnt
      FROM leads, jsonb_array_elements_text(COALESCE(needs, '[]'::jsonb)) AS need
      WHERE TRUE${stateFilter}
      GROUP BY need
      ORDER BY cnt DESC
    `),
  ]);

  type CatRow = {
    category: string; total: number; hot: number; warm: number;
    avg_opportunity: number; no_website: number; reachable: number;
  };
  type SumRow = {
    total: number; hot: number; warm: number; cold: number;
    no_website: number; reachable: number;
  };
  const s = (summaryRows.rows[0] ?? {}) as SumRow;

  res.json({
    state: /^[A-Z]{2}$/.test(state) ? state : null,
    categories: (catRows.rows as CatRow[]).map(r => ({
      category: r.category,
      total: Number(r.total),
      hot: Number(r.hot),
      warm: Number(r.warm),
      avgOpportunity: Number(r.avg_opportunity),
      noWebsite: Number(r.no_website),
      reachable: Number(r.reachable),
    })),
    summary: {
      total: Number(s.total ?? 0),
      hot: Number(s.hot ?? 0),
      warm: Number(s.warm ?? 0),
      cold: Number(s.cold ?? 0),
      noWebsite: Number(s.no_website ?? 0),
      reachable: Number(s.reachable ?? 0),
    },
    needs: (needsRows.rows as { need: string; cnt: number }[]).map(r => ({ need: r.need, count: Number(r.cnt) })),
  });
});

// ---- POST /enrich — crawl lead websites to score bad/old site + booking -----
// Fetches each website and detects: liveness, mobile-friendliness, and online
// booking links. Refines opportunity with signals we couldn't get from Google
// Maps alone. NOTE: "no ads showing" still isn't detectable here (it needs a
// paid SERP API), so it is deliberately not scored.
const BOOKING_RE = /calendly\.com|opentable\.com|acuityscheduling|squareup\.com\/(appointments|book)|booksy|vagaro|resy\.com|setmore|schedulicity|mindbodyonline|getsquire|tidycal|book\s*(now|online|an appointment)|schedule\s*(now|online|an appointment)/i;

function formatPhone(digits: string): string {
  const d = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : digits;
}

// Pull US phone numbers from a page — prefer tel: links, else formatted numbers.
function extractPhones(html: string): string[] {
  const phones = new Set<string>();
  for (const m of html.matchAll(/tel:\+?([0-9().\-\s]{7,16})/gi)) {
    const d = m[1].replace(/\D/g, "");
    if (d.length === 10 || (d.length === 11 && d[0] === "1")) phones.add(formatPhone(d));
  }
  if (phones.size === 0) {
    // Require separators/parens so we don't grab 10-digit ids, zips, prices.
    for (const m of html.matchAll(/\(?\b\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/g)) {
      const d = m[0].replace(/\D/g, "");
      if (d.length === 10) phones.add(formatPhone(d));
    }
  }
  return [...phones].slice(0, 3);
}

// Pull public emails + social profile links out of a page's HTML.
function extractContacts(html: string): { emails: string[]; phones: string[]; facebook: string | null; instagram: string | null; twitter: string | null; linkedin: string | null } {
  const emails = new Set<string>();
  // mailto: links are the most reliable.
  for (const m of html.matchAll(/mailto:([^"'?>\s]+@[^"'?>\s]+)/gi)) {
    try { emails.add(decodeURIComponent(m[1]).toLowerCase()); } catch { emails.add(m[1].toLowerCase()); }
  }
  // Bare addresses in the text, minus obvious junk (asset files, placeholders).
  for (const m of html.matchAll(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g)) {
    const e = m[0].toLowerCase();
    if (/\.(png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|mp4)$/i.test(e)) continue;
    if (/(example\.|sentry|wixpress|\.wix|yourdomain|domain\.com|email@|placeholder|@2x|@3x|\.png|\.jpg)/i.test(e)) continue;
    emails.add(e);
  }
  const firstSocial = (re: RegExp): string | null => {
    for (const m of html.matchAll(re)) {
      const url = m[0].replace(/["'<>)\\]+$/, "");
      // Skip share/intent/SDK/plugin/namespace links — we want the real profile.
      if (/sharer|\/share|\/intent|[?&]u=|\/tr\b|\/plugins|\/dialog\/|\/sdk|developers\.|connect\.|graph\.|\/20\d\d\/|fbml|\/v\d|\/policies|\/help\b|\/embed|\/login/i.test(url)) continue;
      return url;
    }
    return null;
  };
  return {
    emails: [...emails].slice(0, 5),
    phones: extractPhones(html),
    facebook: firstSocial(/https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>)]+/gi),
    instagram: firstSocial(/https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>)]+/gi),
    twitter: firstSocial(/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>)]+/gi),
    linkedin: firstSocial(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>)]+/gi),
  };
}

async function fetchHtml(url: string): Promise<{ status: number; html: string } | null> {
  try {
    const resp = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MapLeadEnrich/1.0)" },
    });
    let html = "";
    try { html = (await resp.text()).slice(0, 400_000); } catch { /* body read failed */ }
    return { status: resp.status, html };
  } catch {
    return null;
  }
}

type Crawl = {
  siteLive: boolean; siteMobile: boolean; hasBooking: boolean;
  emails: string[]; phones: string[]; facebook: string | null; instagram: string | null; twitter: string | null; linkedin: string | null;
};

async function crawlSite(rawUrl: string): Promise<Crawl> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const empty: Crawl = { siteLive: false, siteMobile: false, hasBooking: false, emails: [], phones: [], facebook: null, instagram: null, twitter: null, linkedin: null };

  // In a sandbox that blocks outbound traffic this returns null too, so run
  // enrichment where the server can reach the public internet.
  const home = await fetchHtml(url);
  if (!home) return empty;

  const siteLive = home.status < 400;
  const siteMobile = /<meta[^>]+name=["']viewport["']/i.test(home.html);
  const hasBooking = BOOKING_RE.test(home.html);
  let c = extractContacts(home.html);

  // No email on the homepage? Many sites hide it on a Contact page — follow one.
  if (c.emails.length === 0) {
    const link = home.html.match(/href=["']([^"']*contact[^"']*)["']/i);
    if (link) {
      try {
        const cp = await fetchHtml(new URL(link[1], url).toString());
        if (cp) {
          const c2 = extractContacts(cp.html);
          c = {
            emails: [...new Set([...c.emails, ...c2.emails])].slice(0, 5),
            phones: [...new Set([...c.phones, ...c2.phones])].slice(0, 3),
            facebook: c.facebook ?? c2.facebook,
            instagram: c.instagram ?? c2.instagram,
            twitter: c.twitter ?? c2.twitter,
            linkedin: c.linkedin ?? c2.linkedin,
          };
        }
      } catch { /* bad contact URL — ignore */ }
    }
  }

  return { siteLive, siteMobile, hasBooking, ...c };
}

// Crawl + fill-in contacts for a batch of leads, in parallel. Reused by the
// manual /enrich button AND by auto-enrich right after a scrape.
type EnrichStats = { enriched: number; emailsFound: number; socialsFound: number; phonesFound: number };
async function enrichLeadBatch(batch: (typeof leads.$inferSelect)[]): Promise<EnrichStats> {
  const has = (v: string | null | undefined) => !!(v && v.trim());
  let emailsFound = 0, socialsFound = 0, phonesFound = 0;

  await Promise.all(batch.map(async (lead) => {
    const c = await crawlSite(lead.website as string);

    // Only FILL what's missing — never overwrite contact data the lead already
    // has, since a crawled link can be a designer's/partner's profile.
    const emails = has(lead.emails) ? lead.emails : (c.emails.length ? c.emails.join(", ") : null);
    const phone = has(lead.phone) ? lead.phone : (c.phones[0] ?? null);
    const gotNewPhone = !has(lead.phone) && !!c.phones[0];
    const facebook = has(lead.facebook) ? lead.facebook : c.facebook;
    const instagram = has(lead.instagram) ? lead.instagram : c.instagram;
    const twitter = has(lead.twitter) ? lead.twitter : c.twitter;
    const linkedin = has(lead.linkedin) ? lead.linkedin : c.linkedin;
    const social = [facebook, instagram, twitter, linkedin].filter(Boolean).join(", ") || lead.social;
    const socialCount = [facebook, instagram, twitter, linkedin].filter(Boolean).length;

    const { opportunityScore, needs } = computeOpportunity({
      phone, emails, website: lead.website,
      facebook, instagram, twitter, linkedin,
      rating: lead.rating != null ? parseFloat(String(lead.rating)) : null,
      reviewCount: lead.reviewCount, category: lead.category,
    }, { siteLive: c.siteLive, siteMobile: c.siteMobile, hasBooking: c.hasBooking });
    const valueScore = computeValue(opportunityScore, lead.demandScore ?? 0);

    await db.update(leads).set({
      enrichedAt: new Date(),
      siteLive: c.siteLive, siteMobile: c.siteMobile, hasBooking: c.hasBooking,
      phone, emails, facebook, instagram, twitter, linkedin, social,
      opportunityScore, needs, valueScore,
    }).where(eq(leads.id, lead.id));

    if (c.emails.length) emailsFound++;
    if (socialCount) socialsFound++;
    if (gotNewPhone) phonesFound++;
  }));

  return { enriched: batch.length, emailsFound, socialsFound, phonesFound };
}

// Enrich the leads a scrape just produced: the most-recently-touched unenriched
// leads in that category that have a website (the scrape just stamped them, so
// ordering by updated_at puts them first). Bounded so it stays snappy.
async function autoEnrichScraped(category: string): Promise<EnrichStats> {
  const fresh = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.category, category),
      isNull(leads.enrichedAt),
      sql`website IS NOT NULL AND website <> ''`,
    ))
    .orderBy(sql`updated_at DESC`)
    .limit(30);
  return enrichLeadBatch(fresh);
}

router.post("/enrich", async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(String((req.body as { limit?: number })?.limit ?? 25), 10) || 25));

  const batch = await db
    .select()
    .from(leads)
    .where(sql`website IS NOT NULL AND website <> ''`)
    .orderBy(sql`enriched_at ASC NULLS FIRST`)
    .limit(limit);

  const stats = await enrichLeadBatch(batch);

  const remRows = await db.execute(sql`SELECT COUNT(*)::int AS c FROM leads WHERE website IS NOT NULL AND website <> '' AND enriched_at IS NULL`);
  const remaining = (remRows.rows[0] as { c: number }).c;

  req.log.info({ ...stats, remaining }, "enrichment batch done");
  res.json({ ...stats, remaining });
});

// ---- POST /scrape — live test of the Google Maps lead scraper ----------------
// Drives one headless Maps search and saves the leads, so the owner can verify
// the 24/7 scraper works from the dashboard. Bounded to a single short run.
router.post("/scrape", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { category?: string; location?: string; maxScrolls?: number };
  const category = String(body.category ?? "").trim();
  const location = String(body.location ?? "").trim();
  if (!category) {
    res.status(400).json({ error: "category is required (e.g. \"plumbers\")" });
    return;
  }
  if (scrapeInFlight) {
    res.status(429).json({ error: "A scrape is already running — try again in a moment." });
    return;
  }

  scrapeInFlight = true;
  const startedAt = Date.now();
  try {
    const result = await scrapeAndSave({
      category,
      location: location || undefined,
      maxScrolls: typeof body.maxScrolls === "number" ? body.maxScrolls : 3,
    });
    const enrich = await autoEnrichScraped(category).catch(() => null);
    req.log.info({ ...result, enrich, ms: Date.now() - startedAt }, "admin test scrape done");
    res.json({ ...result, enrich, ms: Date.now() - startedAt });
  } catch (err) {
    req.log.error({ err }, "admin test scrape failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Scrape failed" });
  } finally {
    scrapeInFlight = false;
  }
});

// ---- POST /research — AI finds the best places to scrape -------------------
// Claude turns a plain-English goal into ranked (category × metro) targets and
// upserts them into scrape_targets, which the map + scraper both read from.
router.post("/research", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { goal?: string; count?: number };
  const goal = String(body.goal ?? "").trim();
  if (!goal) {
    res.status(400).json({ error: "Tell the AI what you're looking for (e.g. \"Gulf Coast businesses that need a website\")." });
    return;
  }
  const count = typeof body.count === "number" ? body.count : 24;

  try {
    const targets = await researchTargets({ goal, count });
    if (targets.length === 0) {
      res.status(502).json({ error: "AI returned no targets — try rephrasing your goal." });
      return;
    }
    // Replace the previous AI plan so each research gives a clean list (manually
    // added targets, source='manual', are left untouched). One batched insert.
    await db.delete(scrapeTargets).where(eq(scrapeTargets.source, "ai"));
    await db
      .insert(scrapeTargets)
      .values(targets.map((t) => ({
        category: t.category,
        location: t.location,
        lat: t.lat != null ? String(t.lat) : null,
        lng: t.lng != null ? String(t.lng) : null,
        priority: t.priority,
        reason: t.reason,
        estLeads: t.estLeads,
        source: "ai",
        active: true,
      })))
      .onConflictDoUpdate({
        target: [scrapeTargets.category, scrapeTargets.location],
        set: {
          lat: sql`excluded.lat`,
          lng: sql`excluded.lng`,
          priority: sql`excluded.priority`,
          reason: sql`excluded.reason`,
          estLeads: sql`excluded.est_leads`,
          active: sql`true`,
        },
      });
    const rows = await db.select().from(scrapeTargets).orderBy(desc(scrapeTargets.priority));
    req.log.info({ goal, count: targets.length }, "ai research done");
    res.json({ targets: rows });
  } catch (err) {
    req.log.error({ err }, "ai research failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Research failed" });
  }
});

// ---- POST /discover — live web-search lead discovery (net-new businesses) ---
// Finds real businesses on the open web (not just Maps) and saves them as leads.
router.post("/discover", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { goal?: string; max?: number };
  const goal = String(body.goal ?? "").trim();
  if (!goal) { res.status(400).json({ error: "Describe what to find (e.g. \"used car dealers on the MS gulf coast with no website\")." }); return; }

  try {
    const found = await discoverBusinesses(goal, typeof body.max === "number" ? body.max : 15);
    if (found.length === 0) { res.status(502).json({ error: "Web search returned no businesses — try rephrasing." }); return; }

    // Save as leads through the same path the scraper uses (scores + dedupes).
    const rows = found.map((b) => ({
      Name: b.name,
      Phone: b.phone ?? "",
      Website: b.website ?? "",
      Address: [b.city, b.state].filter(Boolean).join(", "),
      Category: b.category || goal,
    }));
    let saved = 0, duplicates = 0;
    try {
      const r = await fetch(`http://127.0.0.1:${process.env.PORT ?? "5000"}/api/leads/save`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rows),
      });
      if (r.ok) { const d = (await r.json()) as { saved?: number; duplicates?: number }; saved = d.saved ?? 0; duplicates = d.duplicates ?? 0; }
    } catch { /* save best-effort */ }

    req.log.info({ goal, found: found.length, saved }, "web discovery done");
    res.json({ found: found.length, saved, duplicates, businesses: found });
  } catch (err) {
    req.log.error({ err }, "web discovery failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Discovery failed" });
  }
});

// ---- POST /analyze — AI lead intelligence: rationale + high-ticket + bios ---
// Reads a batch of real leads and judges which are high-ticket, writing a sales
// bio for each. Defaults to the most-recently-touched leads (the latest scrape).
router.post("/analyze", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { category?: string; limit?: number };
  const limit = Math.min(40, Math.max(1, Number(body.limit) || 30));
  const category = String(body.category ?? "").trim();

  const conds = [isNull(leads.deletedAt)];
  if (category) conds.push(eq(leads.category, category));
  const batch = await db.select().from(leads).where(and(...conds)).orderBy(sql`updated_at DESC`).limit(limit);
  if (batch.length === 0) { res.json({ rationale: "", analyzed: 0, highTicket: [] }); return; }

  try {
    const analysis = await analyzeLeads(batch.map((l) => ({
      id: l.id, name: l.name, category: l.category, address: l.address, website: l.website,
      rating: l.rating, reviewCount: l.reviewCount, opportunityScore: l.opportunityScore,
      needs: (l.needs ?? []) as string[],
    })));

    const byId = new Map(analysis.verdicts.map((v) => [v.id, v]));
    await Promise.all(batch.map(async (l) => {
      const v = byId.get(l.id);
      if (!v) return;
      await db.update(leads).set({ highTicket: v.highTicket, bio: v.bio || null }).where(eq(leads.id, l.id));
    }));

    const highTicket = batch
      .filter((l) => byId.get(l.id)?.highTicket)
      .map((l) => ({
        id: l.id, name: l.name, category: l.category, phone: l.phone, emails: l.emails,
        website: l.website, address: l.address, opportunityScore: l.opportunityScore,
        bio: byId.get(l.id)?.bio ?? "",
      }));

    req.log.info({ analyzed: batch.length, highTicket: highTicket.length }, "lead analysis done");
    res.json({ rationale: analysis.rationale, analyzed: batch.length, highTicket });
  } catch (err) {
    req.log.error({ err }, "lead analysis failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Analyze failed" });
  }
});

// ---- GET /scrape-targets — the current scrape plan (for the map + list) -----
router.get("/scrape-targets", async (_req, res) => {
  const rows = await db.select().from(scrapeTargets).orderBy(desc(scrapeTargets.priority), asc(scrapeTargets.id));
  res.json({ targets: rows });
});

// ---- GET /scrape-targets/active — simple list the scraper consumes ----------
router.get("/scrape-targets/active", async (_req, res) => {
  const rows = await db
    .select({ category: scrapeTargets.category, location: scrapeTargets.location })
    .from(scrapeTargets)
    .where(eq(scrapeTargets.active, true))
    .orderBy(desc(scrapeTargets.priority));
  res.json({ targets: rows });
});

// ---- POST /scrape-targets/:id/scrape — scrape one target, update coverage ---
router.post("/scrape-targets/:id/scrape", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (scrapeInFlight) { res.status(429).json({ error: "A scrape is already running." }); return; }

  const [target] = await db.select().from(scrapeTargets).where(eq(scrapeTargets.id, id)).limit(1);
  if (!target) { res.status(404).json({ error: "Target not found" }); return; }

  scrapeInFlight = true;
  try {
    const result = await scrapeAndSave({ category: target.category, location: target.location });
    const enrich = await autoEnrichScraped(target.category).catch(() => null);
    await db
      .update(scrapeTargets)
      .set({ lastScrapedAt: new Date(), leadCount: (target.leadCount ?? 0) + result.saved })
      .where(eq(scrapeTargets.id, id));
    res.json({ ...result, enrich, id });
  } catch (err) {
    req.log.error({ err, id }, "target scrape failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Scrape failed" });
  } finally {
    scrapeInFlight = false;
  }
});

// ---- DELETE /scrape-targets — clear the whole plan --------------------------
router.delete("/scrape-targets", requireAdmin, async (_req, res) => {
  await db.delete(scrapeTargets);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
// Proxy center — rotating IP pool that shields the scraper. Admin-only (creds).
// ════════════════════════════════════════════════════════════════════════════

// Never leak passwords to the client; expose only whether auth is set.
function maskProxy(p: typeof proxies.$inferSelect) {
  const { password, ...rest } = p;
  return { ...rest, hasPassword: !!password };
}

// ---- GET /proxies — pool + summary ------------------------------------------
router.get("/proxies", requireAuth, async (_req, res) => {
  const rows = await db.select().from(proxies).orderBy(asc(proxies.id));
  const summary = {
    total: rows.length,
    healthy: rows.filter(r => r.status === "healthy").length,
    dead: rows.filter(r => r.status === "dead").length,
    active: rows.filter(r => r.active).length,
  };
  res.json({ proxies: rows.map(maskProxy), summary });
});

// ---- POST /proxies — add one or bulk-import many ----------------------------
router.post("/proxies", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { text?: string };
  const text = String(body.text ?? "").trim();
  if (!text) { res.status(400).json({ error: "Paste at least one proxy (host:port[:user:pass])." }); return; }

  const parsed = parseProxyLines(text);
  if (parsed.length === 0) { res.status(400).json({ error: "Couldn't parse any proxies — check the format." }); return; }

  let added = 0;
  for (const p of parsed) {
    const r = await db
      .insert(proxies)
      .values({ protocol: p.protocol, host: p.host, port: p.port, username: p.username, password: p.password })
      .onConflictDoNothing({ target: [proxies.host, proxies.port] });
    added += r.rowCount ?? 0;
  }
  res.json({ added, parsed: parsed.length });
});

// ---- POST /proxies/test-all — health-check the whole pool -------------------
router.post("/proxies/test-all", requireAuth, async (_req, res) => {
  const rows = await db.select().from(proxies);
  await Promise.all(rows.map(async (p) => {
    const t = await testProxy(p);
    await db.update(proxies).set({
      status: t.ok ? "healthy" : "dead",
      latencyMs: t.ok ? t.ms : null,
      lastCheckedAt: new Date(),
    }).where(eq(proxies.id, p.id));
  }));
  const after = await db.select().from(proxies);
  res.json({ tested: rows.length, healthy: after.filter(p => p.status === "healthy").length });
});

// ---- POST /proxies/:id/test — health-check one ------------------------------
router.post("/proxies/:id/test", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [p] = await db.select().from(proxies).where(eq(proxies.id, id)).limit(1);
  if (!p) { res.status(404).json({ error: "Proxy not found" }); return; }

  const t = await testProxy(p);
  await db.update(proxies).set({
    status: t.ok ? "healthy" : "dead",
    latencyMs: t.ok ? t.ms : null,
    lastCheckedAt: new Date(),
  }).where(eq(proxies.id, id));
  res.json({ id, ok: t.ok, ms: t.ms, error: t.error });
});

// ---- PATCH /proxies/:id — toggle active / reset status ----------------------
router.patch("/proxies/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = (req.body ?? {}) as { active?: boolean; reset?: boolean };
  const set: Record<string, unknown> = {};
  if (typeof body.active === "boolean") set.active = body.active;
  if (body.reset) { set.status = "untested"; set.failCount = 0; }
  if (Object.keys(set).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  await db.update(proxies).set(set).where(eq(proxies.id, id));
  res.json({ ok: true, id });
});

// ---- DELETE /proxies/:id ----------------------------------------------------
router.delete("/proxies/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(proxies).where(eq(proxies.id, id));
  res.json({ ok: true, id });
});

// ---- POST /packs/checkout — create a Stripe Checkout link to SELL a pack ----
// The owner sets a price for a category/territory pack; the buyer pays via the
// returned Stripe URL and is redirected to a payment-gated CSV download.
router.post("/packs/checkout", async (req, res) => {
  const body = req.body as { category?: string; state?: string; minOpportunity?: number; priceCents?: number; label?: string };
  const priceCents = Math.max(100, Math.round(Number(body.priceCents) || 0)); // $1 minimum
  const category = (body.category ?? "").trim();
  const state = (body.state ?? "").trim().toUpperCase();
  const minOpportunity = Math.max(0, Math.round(Number(body.minOpportunity) || 0));

  // Count what the buyer will get, so we can refuse to sell an empty pack.
  const conditions = [];
  if (category) conditions.push(sql`category ILIKE ${"%" + category + "%"}`);
  if (/^[A-Z]{2}$/.test(state)) conditions.push(sql`address ~ ${"\\y" + state + "\\s+\\d{5}"}`);
  if (minOpportunity > 0) conditions.push(sql`opportunity_score >= ${minOpportunity}`);
  const whereSql = conditions.length ? sql.join([sql` WHERE `, sql.join(conditions, sql` AND `)]) : sql``;
  const cntRows = await db.execute(sql`SELECT COUNT(*)::int AS c FROM leads${whereSql}`);
  const leadCount = (cntRows.rows[0] as { c: number }).c;
  if (leadCount === 0) { res.status(400).json({ error: "That pack has 0 leads — nothing to sell." }); return; }

  const name = body.label?.trim()
    || `Lead pack${category ? ` — ${category}` : ""}${state ? ` (${state})` : ""}${minOpportunity ? ` · opp ${minOpportunity}+` : ""} · ${leadCount} leads`;

  try {
    const stripe = await getUncachableStripeClient();
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price_data: { currency: "usd", unit_amount: priceCents, product_data: { name } }, quantity: 1 }],
      metadata: { pack_category: category, pack_state: state, pack_min_opp: String(minOpportunity) },
      success_url: `${baseUrl}/api/leads/pack-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/admin`,
    });
    res.json({ url: session.url, leadCount, priceCents, name });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Stripe not connected" });
  }
});

// ---- GET /leads — all leads paginated for admin view ------------------------
const ADMIN_SORT_COLUMNS: Record<string, string> = {
  value: "value_score",
  demand: "demand_score",
  opportunity: "opportunity_score",
};
router.get("/leads", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const minOpportunity = parseInt(String(req.query.minOpportunity ?? "0"), 10) || 0;
  // sort = value | demand | opportunity surfaces the most valuable / wanted /
  // weakest leads across all members; default is newest first.
  const sortCol = ADMIN_SORT_COLUMNS[String(req.query.sort ?? "")];
  const offset = (page - 1) * limit;

  const where = minOpportunity > 0 ? gte(leads.opportunityScore, minOpportunity) : undefined;
  const orderBy = sortCol ? sql.raw(`${sortCol} DESC, created_at DESC`) : sql`created_at DESC`;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(leads).where(where).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ total: count() }).from(leads).where(where),
  ]);

  res.json({ leads: rows, total: Number(total), page, pages: Math.ceil(Number(total) / limit) || 1 });
});

// ---- GET /admin/deleted-leads — list soft-deleted leads --------------------
router.get("/deleted-leads", requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = (page - 1) * limit;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(leads).where(isNotNull(leads.deletedAt)).orderBy(desc(leads.deletedAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(leads).where(isNotNull(leads.deletedAt)),
  ]);

  res.json({ leads: rows, total: Number(total), page, pages: Math.ceil(Number(total) / limit) || 1 });
});

// ---- POST /admin/restore/:id — restore a soft-deleted lead -----------------
router.post("/restore/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(leads).set({ deletedAt: null, updatedAt: new Date() }).where(eq(leads.id, id));
  res.json({ ok: true, id });
});

// ---- POST /admin/restore-bulk — restore multiple soft-deleted leads --------
router.post("/restore-bulk", requireAdmin, async (req, res) => {
  const { ids } = req.body as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" }); return;
  }
  const validIds = ids.map(Number).filter(n => !isNaN(n) && n > 0);
  await db.execute(sql`UPDATE leads SET deleted_at = NULL, updated_at = NOW() WHERE id = ANY(${sql.raw(`ARRAY[${validIds.join(",")}]::int[]`)})`);
  res.json({ ok: true, restored: validIds.length });
});

export default router;
