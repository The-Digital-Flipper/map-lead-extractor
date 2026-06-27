import { Router } from "express";
import { db, leads, users } from "@workspace/db";
import { sql, count, gte } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

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
          COALESCE(lc.lead_count, 0)::int AS lead_count
        FROM users u
        LEFT JOIN (
          SELECT customer, status AS sub_status,
                 current_period_end AS period_end,
                 cancel_at
          FROM stripe.subscriptions
          WHERE status = 'active'
        ) s ON s.customer = u.stripe_customer_id
        LEFT JOIN (
          SELECT clerk_user_id, COUNT(*)::int AS lead_count
          FROM leads
          WHERE clerk_user_id IS NOT NULL
          GROUP BY clerk_user_id
        ) lc ON lc.clerk_user_id = u.id
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
router.get("/geo", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT
      UPPER(
        (regexp_matches(address, '[A-Z]{2}\\s+\\d{5}', 'g'))[1]
      ) AS raw_match,
      COUNT(*)::int AS cnt
    FROM leads
    WHERE address IS NOT NULL
      AND address ~ '[A-Z]{2}\\s+\\d{5}'
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
    WHERE address IS NOT NULL AND address LIKE '%,%'
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
// Powers the Command Center leaderboard: which categories hold the most
// high-opportunity ("money") leads, how weak they are, and what to sell them.
router.get("/opportunity-by-category", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT
      category,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE opportunity_score >= 70)::int AS hot,
      COUNT(*) FILTER (WHERE opportunity_score >= 40 AND opportunity_score < 70)::int AS warm,
      COALESCE(ROUND(AVG(opportunity_score)), 0)::int AS avg_opportunity,
      COUNT(*) FILTER (WHERE website IS NULL OR website = '')::int AS no_website,
      COUNT(*) FILTER (WHERE phone IS NOT NULL OR emails IS NOT NULL)::int AS reachable
    FROM leads
    WHERE category IS NOT NULL AND category <> ''
    GROUP BY category
    ORDER BY hot DESC, total DESC
    LIMIT 30
  `);

  type Row = {
    category: string; total: number; hot: number; warm: number;
    avg_opportunity: number; no_website: number; reachable: number;
  };

  res.json({
    categories: (rows.rows as Row[]).map(r => ({
      category: r.category,
      total: Number(r.total),
      hot: Number(r.hot),
      warm: Number(r.warm),
      avgOpportunity: Number(r.avg_opportunity),
      noWebsite: Number(r.no_website),
      reachable: Number(r.reachable),
    })),
  });
});

// ---- GET /leads — all leads paginated for admin view ------------------------
router.get("/leads", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const minOpportunity = parseInt(String(req.query.minOpportunity ?? "0"), 10) || 0;
  // sort=opportunity surfaces the "money" leads (weak businesses that need
  // websites / SEO / ads / reputation) across all users.
  const sortByOpportunity = String(req.query.sort ?? "") === "opportunity";
  const offset = (page - 1) * limit;

  const where = minOpportunity > 0 ? gte(leads.opportunityScore, minOpportunity) : undefined;
  const orderBy = sortByOpportunity ? sql`opportunity_score DESC, created_at DESC` : sql`created_at DESC`;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(leads).where(where).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ total: count() }).from(leads).where(where),
  ]);

  res.json({ leads: rows, total: Number(total), page, pages: Math.ceil(Number(total) / limit) || 1 });
});

export default router;
