import { Router, type Request, type Response, type NextFunction } from "express";
import { db, leads } from "@workspace/db";
import { sql, ilike, and, gte, count, eq } from "drizzle-orm";
import { storage } from "../storage";

// Public, versioned developer API for leads. Authenticated by the same API key
// members use (X-Api-Key header). Returns a clean JSON shape — internal fields
// (raw payload, dedupe key, extractor ids) are never exposed.
const router = Router();

interface DevRequest extends Request { devUserId?: string }

async function requireApiKey(req: DevRequest, res: Response, next: NextFunction) {
  const key = String(req.headers["x-api-key"] ?? "").trim();
  if (!key) { res.status(401).json({ error: "Missing X-Api-Key header." }); return; }
  const user = await storage.getUserByApiKey(key);
  if (!user) { res.status(403).json({ error: "Invalid API key." }); return; }
  req.devUserId = user.id;
  next();
}

// Public projection — only fields safe to hand to an API consumer.
const publicColumns = {
  id: leads.id,
  name: leads.name,
  phone: leads.phone,
  emails: leads.emails,
  website: leads.website,
  facebook: leads.facebook,
  instagram: leads.instagram,
  twitter: leads.twitter,
  linkedin: leads.linkedin,
  address: leads.address,
  category: leads.category,
  rating: leads.rating,
  reviewCount: leads.reviewCount,
  opportunityScore: leads.opportunityScore,
  valueScore: leads.valueScore,
  needs: leads.needs,
  gmapsUrl: leads.gmapsUrl,
  createdAt: leads.createdAt,
};

// GET /api/v1/leads — filterable, paginated catalog.
router.get("/leads", requireApiKey, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25));
  const offset = (page - 1) * limit;
  const category = String(req.query.category ?? "").trim();
  const state = String(req.query.state ?? "").trim().toUpperCase();
  const minOpportunity = parseInt(String(req.query.minOpportunity ?? "0"), 10) || 0;
  const minValue = parseInt(String(req.query.minValue ?? "0"), 10) || 0;
  const search = String(req.query.search ?? "").trim();
  // sort: value (default) | opportunity | newest
  const sortParam = String(req.query.sort ?? "value");
  const orderBy = sortParam === "opportunity"
    ? sql`opportunity_score DESC, created_at DESC`
    : sortParam === "newest"
      ? sql`created_at DESC`
      : sql`value_score DESC, created_at DESC`;

  const conditions = [];
  if (category) conditions.push(ilike(leads.category, `%${category}%`));
  if (/^[A-Z]{2}$/.test(state)) conditions.push(sql`address ~ ${"\\y" + state + "\\s+\\d{5}"}`);
  if (minOpportunity > 0) conditions.push(gte(leads.opportunityScore, minOpportunity));
  if (minValue > 0) conditions.push(gte(leads.valueScore, minValue));
  if (search) conditions.push(ilike(leads.name, `%${search}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db.select(publicColumns).from(leads).where(where).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ total: count() }).from(leads).where(where),
  ]);

  res.json({
    data: rows,
    pagination: { page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit) || 1 },
  });
});

// GET /api/v1/leads/:id — single lead.
router.get("/leads/:id", requireApiKey, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id." }); return; }
  const [row] = await db.select(publicColumns).from(leads).where(eq(leads.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Lead not found." }); return; }
  res.json({ data: row });
});

export default router;
