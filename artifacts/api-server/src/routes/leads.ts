import { Router } from "express";
import { createHash } from "node:crypto";
import { db, leads } from "@workspace/db";
import { sql, ilike, or, gte, and, count } from "drizzle-orm";

const router = Router();

function computeScore(lead: {
  phone?: string | null;
  emails?: string | null;
  website?: string | null;
  social?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  category?: string | null;
}): number {
  let score = 0;
  if (lead.phone) score += 20;
  if (lead.emails) score += 20;
  if (lead.website) score += 15;
  if (lead.social) score += 15;
  if (lead.rating != null && lead.rating >= 4.0) score += 10;
  if (lead.reviewCount != null && lead.reviewCount >= 50) score += 10;
  if (lead.category) score += 10;
  return score;
}

function parseReviewCount(ratingInfo: string | undefined | null): number | null {
  if (!ratingInfo) return null;
  const m = ratingInfo.match(/[\d,]+/);
  if (!m) return null;
  return parseInt(m[0].replace(/,/g, ""), 10) || null;
}

router.options("/save", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(204).end();
});

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
    const social = String(lead["Social Medias"] ?? lead["social"] ?? "");
    const address = String(lead["Address"] ?? lead["address"] ?? "");
    const category = String(lead["Category"] ?? lead["category"] ?? "");
    const ratingRaw = lead["Rating"] ?? lead["rating"];
    const rating = ratingRaw != null ? parseFloat(String(ratingRaw)) : null;
    const ratingInfo = String(lead["Rating info"] ?? lead["ratingInfo"] ?? "");
    const reviewCount = parseReviewCount(ratingInfo);
    const gmapsUrl = String(lead["Google Maps URL"] ?? lead["gmapsUrl"] ?? "");
    const plusCode = String(lead["Plus Code"] ?? lead["plusCode"] ?? "");

    const key = createHash("sha256")
      .update(name + phone + address)
      .digest("hex");

    const score = computeScore({ phone: phone || null, emails: emails || null, website: website || null, social: social || null, rating: isNaN(rating as number) ? null : rating, reviewCount, category: category || null });

    return {
      key,
      name: name || null,
      phone: phone || null,
      emails: emails || null,
      website: website || null,
      social: social || null,
      address: address || null,
      category: category || null,
      rating: (rating != null && !isNaN(rating)) ? String(rating) : null,
      reviewCount: reviewCount,
      score,
      gmapsUrl: gmapsUrl || null,
      plusCode: plusCode || null,
      raw: lead,
      updatedAt: new Date(),
    };
  });

  for (const row of rows) {
    const result = await db
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
          address: sql`excluded.address`,
          category: sql`excluded.category`,
          rating: sql`excluded.rating`,
          reviewCount: sql`excluded.review_count`,
          score: sql`excluded.score`,
          gmapsUrl: sql`excluded.gmaps_url`,
          plusCode: sql`excluded.plus_code`,
          raw: sql`excluded.raw`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .returning({ id: leads.id, key: leads.key });

    if (result.length > 0) {
      const existing = await db
        .select({ createdAt: leads.createdAt })
        .from(leads)
        .where(sql`key = ${row.key}`)
        .limit(1);
      if (existing.length > 0 && existing[0].createdAt && (new Date().getTime() - new Date(existing[0].createdAt).getTime()) > 1000) {
        duplicates++;
      } else {
        saved++;
      }
    }
  }

  req.log.info({ saved, duplicates }, "leads saved");
  res.json({ saved, duplicates });
});

router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const search = String(req.query.search ?? "").trim();
  const minScore = parseInt(String(req.query.minScore ?? "0"), 10) || 0;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (search) {
    conditions.push(or(ilike(leads.name, `%${search}%`), ilike(leads.address, `%${search}%`)));
  }
  if (minScore > 0) {
    conditions.push(gte(leads.score, minScore));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(where)
      .orderBy(sql`score DESC, created_at DESC`)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(leads)
      .where(where),
  ]);

  res.json({
    leads: rows,
    total: Number(total),
    page,
    pages: Math.ceil(Number(total) / limit),
  });
});

router.get("/export.csv", async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const minScore = parseInt(String(req.query.minScore ?? "0"), 10) || 0;

  const conditions = [];
  if (search) {
    conditions.push(or(ilike(leads.name, `%${search}%`), ilike(leads.address, `%${search}%`)));
  }
  if (minScore > 0) {
    conditions.push(gte(leads.score, minScore));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(leads)
    .where(where)
    .orderBy(sql`score DESC, created_at DESC`);

  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="leads-${dateStr}.csv"`);

  const headers = ["Name", "Phone", "Emails", "Website", "Social", "Address", "Category", "Rating", "Reviews", "Score", "Google Maps URL", "Plus Code"];

  function csvCell(v: unknown): string {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  let csv = headers.join(",") + "\n";
  for (const row of rows) {
    csv +=
      [
        row.name,
        row.phone,
        row.emails,
        row.website,
        row.social,
        row.address,
        row.category,
        row.rating,
        row.reviewCount,
        row.score,
        row.gmapsUrl,
        row.plusCode,
      ]
        .map(csvCell)
        .join(",") + "\n";
  }

  res.send(csv);
});

export default router;
