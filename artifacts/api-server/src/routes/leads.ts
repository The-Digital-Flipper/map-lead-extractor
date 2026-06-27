import { Router } from "express";
import { createHash } from "node:crypto";
import { db, leads, computeScore, computeOpportunity } from "@workspace/db";
import { sql, ilike, or, gte, and, count, eq } from "drizzle-orm";

const router = Router();

// ---- Helpers ----------------------------------------------------------------

function extractSocial(socialRaw: string, pattern: RegExp): string | null {
  const m = socialRaw.match(pattern);
  return m ? m[0] : null;
}

function parseSocials(raw: string | null | undefined): {
  social: string | null;
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  linkedin: string | null;
} {
  if (!raw) return { social: null, facebook: null, instagram: null, twitter: null, linkedin: null };
  const facebook = extractSocial(raw, /https?:\/\/(?:www\.)?facebook\.com\/[^\s,\n"'<>]+/i);
  const instagram = extractSocial(raw, /https?:\/\/(?:www\.)?instagram\.com\/[^\s,\n"'<>]+/i);
  const twitter = extractSocial(raw, /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s,\n"'<>]+/i);
  const linkedin = extractSocial(raw, /https?:\/\/(?:www\.)?linkedin\.com\/[^\s,\n"'<>]+/i);
  const social = [facebook, instagram, twitter, linkedin].filter(Boolean).join(", ") || raw || null;
  return { social, facebook, instagram, twitter, linkedin };
}

function parseReviewCount(ratingInfo: string | undefined | null): number | null {
  if (!ratingInfo) return null;
  const m = ratingInfo.match(/[\d,]+/);
  if (!m) return null;
  return parseInt(m[0].replace(/,/g, ""), 10) || null;
}

const VALID_STATUSES = ["new", "contacted", "converted", "not_interested"] as const;
type LeadStatus = typeof VALID_STATUSES[number];

// ---- CORS — extension calls /save cross-origin, must allow * ----------------
router.options("/save", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Api-Key");
  res.status(204).end();
});

// ---- POST /save — no auth, no limits ----------------------------------------
router.post("/save", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const body = req.body;
  if (!Array.isArray(body) || body.length === 0) {
    res.status(400).json({ error: "Expected non-empty array of leads" });
    return;
  }

  const batch = body.slice(0, 1000);
  let saved = 0;
  let duplicates = 0;

  const rows = batch.map((lead: Record<string, unknown>) => {
    const name = String(lead["Name"] ?? lead["name"] ?? "");
    const phone = String(lead["Phone"] ?? lead["phone"] ?? "");
    const emailsRaw = lead["Emails"] ?? lead["emails"] ?? "";
    const emails = Array.isArray(emailsRaw) ? emailsRaw.join(", ") : String(emailsRaw ?? "");
    const website = String(lead["Website"] ?? lead["website"] ?? "");
    const socialRaw = String(lead["Social Medias"] ?? lead["social"] ?? "");
    const address = String(lead["Address"] ?? lead["address"] ?? "");
    const category = String(lead["Category"] ?? lead["category"] ?? "");
    const ratingRaw = lead["Rating"] ?? lead["rating"];
    const rating = ratingRaw != null ? parseFloat(String(ratingRaw)) : null;
    const ratingInfo = String(lead["Rating info"] ?? lead["ratingInfo"] ?? "");
    const reviewCount = parseReviewCount(ratingInfo);
    const gmapsUrl = String(lead["Google Maps URL"] ?? lead["gmapsUrl"] ?? "");
    const plusCode = String(lead["Plus Code"] ?? lead["plusCode"] ?? "");

    const key = createHash("sha256").update(name + phone + address).digest("hex");
    const { social, facebook, instagram, twitter, linkedin } = parseSocials(socialRaw || null);
    const ratingNum = (rating != null && !isNaN(rating)) ? rating : null;

    const scoreable = {
      phone: phone || null,
      emails: emails || null,
      website: website || null,
      facebook,
      instagram,
      twitter,
      linkedin,
      rating: ratingNum,
      reviewCount,
      category: category || null,
    };
    const score = computeScore(scoreable);
    const { opportunityScore, needs } = computeOpportunity(scoreable);

    return {
      key,
      clerkUserId: null as string | null,
      name: name || null,
      phone: phone || null,
      emails: emails || null,
      website: website || null,
      social,
      facebook,
      instagram,
      twitter,
      linkedin,
      address: address || null,
      category: category || null,
      rating: ratingNum != null ? String(ratingNum) : null,
      reviewCount,
      score,
      opportunityScore,
      needs,
      gmapsUrl: gmapsUrl || null,
      plusCode: plusCode || null,
      raw: lead,
      updatedAt: new Date(),
    };
  });

  for (const row of rows) {
    const before = await db
      .select({ id: leads.id })
      .from(leads)
      .where(sql`key = ${row.key}`)
      .limit(1);

    await db
      .insert(leads)
      .values(row)
      .onConflictDoUpdate({
        target: leads.key,
        set: {
          name: sql`excluded.name`,
          phone: sql`excluded.phone`,
          emails: sql`excluded.emails`,
          website: sql`excluded.website`,
          social: sql`excluded.social`,
          facebook: sql`excluded.facebook`,
          instagram: sql`excluded.instagram`,
          twitter: sql`excluded.twitter`,
          linkedin: sql`excluded.linkedin`,
          address: sql`excluded.address`,
          category: sql`excluded.category`,
          rating: sql`excluded.rating`,
          reviewCount: sql`excluded.review_count`,
          score: sql`excluded.score`,
          opportunityScore: sql`excluded.opportunity_score`,
          needs: sql`excluded.needs`,
          gmapsUrl: sql`excluded.gmaps_url`,
          plusCode: sql`excluded.plus_code`,
          raw: sql`excluded.raw`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    if (before.length > 0) duplicates++;
    else saved++;
  }

  req.log.info({ saved, duplicates }, "leads saved");
  res.json({ saved, duplicates, syncedAt: new Date().toISOString() });
});

// ---- GET / — paginated list --------------------------------------------------
router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const search = String(req.query.search ?? "").trim();
  const minScore = parseInt(String(req.query.minScore ?? "0"), 10) || 0;
  const minOpportunity = parseInt(String(req.query.minOpportunity ?? "0"), 10) || 0;
  const category = String(req.query.category ?? "").trim();
  const status = String(req.query.status ?? "").trim();
  // sort=opportunity ranks by "money" potential; default ranks by completeness.
  const sortByOpportunity = String(req.query.sort ?? "") === "opportunity";
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(or(ilike(leads.name, `%${search}%`), ilike(leads.address, `%${search}%`)));
  }
  if (minScore > 0) conditions.push(gte(leads.score, minScore));
  if (minOpportunity > 0) conditions.push(gte(leads.opportunityScore, minOpportunity));
  if (category) conditions.push(ilike(leads.category, `%${category}%`));
  if (status && VALID_STATUSES.includes(status as LeadStatus)) {
    conditions.push(eq(leads.status, status));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const orderBy = sortByOpportunity
    ? sql`opportunity_score DESC, created_at DESC`
    : sql`score DESC, created_at DESC`;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(leads).where(where).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ total: count() }).from(leads).where(where),
  ]);

  res.json({ leads: rows, total: Number(total), page, pages: Math.ceil(Number(total) / limit) || 1 });
});

// ---- GET /stats — charts data -----------------------------------------------
router.get("/stats", async (_req, res) => {
  const [scoreRows, categoryRows, statusRows, lastRow, opportunityRows, needsRows] = await Promise.all([
    db.execute(sql`
      SELECT
        CASE
          WHEN score >= 80 THEN 'High (80+)'
          WHEN score >= 50 THEN 'Medium (50-79)'
          ELSE 'Low (<50)'
        END AS bucket,
        COUNT(*) AS cnt
      FROM leads
      GROUP BY bucket
    `),
    db.execute(sql`
      SELECT category, COUNT(*) AS cnt
      FROM leads
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY cnt DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT COALESCE(status, 'new') AS status, COUNT(*) AS cnt
      FROM leads
      GROUP BY status
    `),
    db.execute(sql`SELECT MAX(updated_at) AS last_synced FROM leads`),
    db.execute(sql`
      SELECT
        CASE
          WHEN opportunity_score >= 70 THEN 'Hot (70+)'
          WHEN opportunity_score >= 40 THEN 'Warm (40-69)'
          ELSE 'Cold (<40)'
        END AS bucket,
        COUNT(*) AS cnt
      FROM leads
      GROUP BY bucket
    `),
    db.execute(sql`
      SELECT need AS need, COUNT(*) AS cnt
      FROM leads, jsonb_array_elements_text(COALESCE(needs, '[]'::jsonb)) AS need
      GROUP BY need
      ORDER BY cnt DESC
    `),
  ]);

  // Order opportunity buckets Hot → Warm → Cold for stable chart coloring.
  const oppOrder = ["Hot (70+)", "Warm (40-69)", "Cold (<40)"];
  const oppRaw = (opportunityRows.rows as { bucket: string; cnt: string }[]).map(r => ({ bucket: r.bucket, count: Number(r.cnt) }));

  res.json({
    scoreDistribution: (scoreRows.rows as { bucket: string; cnt: string }[]).map(r => ({ bucket: r.bucket, count: Number(r.cnt) })),
    opportunityDistribution: oppOrder.map(b => ({ bucket: b, count: oppRaw.find(r => r.bucket === b)?.count ?? 0 })).filter(r => r.count > 0),
    needsCounts: (needsRows.rows as { need: string; cnt: string }[]).map(r => ({ need: r.need, count: Number(r.cnt) })),
    topCategories: (categoryRows.rows as { category: string; cnt: string }[]).map(r => ({ category: r.category, count: Number(r.cnt) })),
    statusCounts: (statusRows.rows as { status: string; cnt: string }[]).map(r => ({ status: r.status, count: Number(r.cnt) })),
    lastSyncedAt: (lastRow.rows[0] as { last_synced: string | null })?.last_synced ?? null,
  });
});

// ---- PATCH /:id/status — update lead status ----------------------------------
router.patch("/:id/status", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status } = req.body as { status: string };
  if (!VALID_STATUSES.includes(status as LeadStatus)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    return;
  }

  await db.update(leads).set({ status, updatedAt: new Date() }).where(eq(leads.id, id));
  res.json({ ok: true, id, status });
});

// ---- DELETE /:id — delete a lead --------------------------------------------
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(leads).where(eq(leads.id, id));
  res.json({ ok: true, id });
});

// ---- DELETE /bulk — delete multiple leads -----------------------------------
router.delete("/bulk", async (req, res) => {
  const { ids } = req.body as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" });
    return;
  }
  const validIds = ids.map(Number).filter(n => !isNaN(n) && n > 0);
  await db.execute(sql`DELETE FROM leads WHERE id = ANY(${sql.raw(`ARRAY[${validIds.join(",")}]::int[]`)})`);
  res.json({ ok: true, deleted: validIds.length });
});

// ---- GET /export.csv — download CSV -----------------------------------------
router.get("/export.csv", async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const minScore = parseInt(String(req.query.minScore ?? "0"), 10) || 0;
  const minOpportunity = parseInt(String(req.query.minOpportunity ?? "0"), 10) || 0;
  const category = String(req.query.category ?? "").trim();
  const status = String(req.query.status ?? "").trim();
  const sortByOpportunity = String(req.query.sort ?? "") === "opportunity";

  const conditions = [];
  if (search) conditions.push(or(ilike(leads.name, `%${search}%`), ilike(leads.address, `%${search}%`)));
  if (minScore > 0) conditions.push(gte(leads.score, minScore));
  if (minOpportunity > 0) conditions.push(gte(leads.opportunityScore, minOpportunity));
  if (category) conditions.push(ilike(leads.category, `%${category}%`));
  if (status && VALID_STATUSES.includes(status as LeadStatus)) conditions.push(eq(leads.status, status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const orderBy = sortByOpportunity
    ? sql`opportunity_score DESC, created_at DESC`
    : sql`score DESC, created_at DESC`;
  const rows = await db.select().from(leads).where(where).orderBy(orderBy);

  const dateStr = new Date().toISOString().slice(0, 10);
  const isMoney = sortByOpportunity || minOpportunity > 0;
  const slug = category ? category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
  const filename = isMoney
    ? `money-leads${slug ? `-${slug}` : ""}-${dateStr}.csv`
    : `leads${slug ? `-${slug}` : ""}-${dateStr}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  function csvCell(v: unknown): string {
    if (v == null) return "";
    const s = Array.isArray(v) ? v.join("; ") : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  const headers = ["Name","Phone","Emails","Website","Facebook","Instagram","Twitter","LinkedIn","Address","Category","Rating","Reviews","Score","Opportunity","Needs","Status","Google Maps URL","Plus Code"];
  let csv = headers.join(",") + "\n";
  for (const row of rows) {
    csv += [row.name,row.phone,row.emails,row.website,row.facebook,row.instagram,row.twitter,row.linkedin,row.address,row.category,row.rating,row.reviewCount,row.score,row.opportunityScore,row.needs,row.status,row.gmapsUrl,row.plusCode].map(csvCell).join(",") + "\n";
  }

  req.log.info({ rows: rows.length, money: sortByOpportunity || minOpportunity > 0 }, "leads exported to csv");
  res.send(csv);
});

export default router;
