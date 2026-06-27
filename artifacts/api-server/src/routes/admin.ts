import { Router, type Request, type Response, type NextFunction } from "express";
import { db, leads, users, logs, computeOpportunity, computeValue } from "@workspace/db";
import { sql, count, gte, eq, desc } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

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

async function crawlSite(rawUrl: string): Promise<{ siteLive: boolean; siteMobile: boolean; hasBooking: boolean }> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const resp = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MapLeadEnrich/1.0)" },
    });
    const live = resp.status < 400;
    let html = "";
    try { html = (await resp.text()).slice(0, 300_000); } catch { /* body read failed */ }
    const mobile = /<meta[^>]+name=["']viewport["']/i.test(html);
    const booking = BOOKING_RE.test(html);
    return { siteLive: live, siteMobile: mobile, hasBooking: booking };
  } catch {
    // Unreachable — a broken/parked site (real signal). In a sandbox that blocks
    // outbound traffic this branch also fires, so run enrichment where the
    // server can reach the public internet.
    return { siteLive: false, siteMobile: false, hasBooking: false };
  }
}

router.post("/enrich", async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(String((req.body as { limit?: number })?.limit ?? 25), 10) || 25));

  const batch = await db
    .select()
    .from(leads)
    .where(sql`website IS NOT NULL AND website <> ''`)
    .orderBy(sql`enriched_at ASC NULLS FIRST`)
    .limit(limit);

  let enriched = 0;
  const results: { name: string | null; siteLive: boolean; siteMobile: boolean; hasBooking: boolean }[] = [];

  for (const lead of batch) {
    const signals = await crawlSite(lead.website as string);
    const { opportunityScore, needs } = computeOpportunity({
      phone: lead.phone, emails: lead.emails, website: lead.website,
      facebook: lead.facebook, instagram: lead.instagram, twitter: lead.twitter, linkedin: lead.linkedin,
      rating: lead.rating != null ? parseFloat(String(lead.rating)) : null,
      reviewCount: lead.reviewCount, category: lead.category,
    }, signals);
    const valueScore = computeValue(opportunityScore, lead.demandScore ?? 0);

    await db.update(leads).set({
      enrichedAt: new Date(),
      siteLive: signals.siteLive, siteMobile: signals.siteMobile, hasBooking: signals.hasBooking,
      opportunityScore, needs, valueScore,
    }).where(eq(leads.id, lead.id));

    enriched++;
    results.push({ name: lead.name, ...signals });
  }

  const remRows = await db.execute(sql`SELECT COUNT(*)::int AS c FROM leads WHERE website IS NOT NULL AND website <> '' AND enriched_at IS NULL`);
  const remaining = (remRows.rows[0] as { c: number }).c;

  req.log.info({ enriched, remaining }, "enrichment batch done");
  res.json({ enriched, remaining, results });
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

export default router;
