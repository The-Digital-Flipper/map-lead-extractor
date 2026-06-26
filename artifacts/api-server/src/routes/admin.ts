import { Router } from "express";
import { db, leads } from "@workspace/db";
import { sql, count } from "drizzle-orm";

const router = Router();

// Simple admin gate — check header set by frontend or just expose read-only stats
// (Real auth is enforced on the frontend via Clerk email check)

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

// ---- GET /geo — state-level lead counts parsed from addresses ---------------
router.get("/geo", async (_req, res) => {
  // Extract 2-letter US state code from addresses like "... Houston, TX 77001"
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
    // raw_match is like "TX 77001" — take first 2 chars
    const state = row.raw_match.slice(0, 2).toUpperCase();
    if (/^[A-Z]{2}$/.test(state)) {
      byState[state] = (byState[state] ?? 0) + Number(row.cnt);
    }
  }

  // Also get top city-level (last segment before state)
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

// ---- GET /leads — all leads paginated for admin view ------------------------
router.get("/leads", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = (page - 1) * limit;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(leads).orderBy(sql`created_at DESC`).limit(limit).offset(offset),
    db.select({ total: count() }).from(leads),
  ]);

  res.json({ leads: rows, total: Number(total), page, pages: Math.ceil(Number(total) / limit) || 1 });
});

export default router;
