import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, collections, collectionLeads, leads } from "@workspace/db";
import { and, asc, desc, eq, ilike, inArray, isNull, count, sql } from "drizzle-orm";

const router = Router();

// ---- Helpers ----------------------------------------------------------------

const MAX_NAME = 80;

/** Trim + clamp a collection name. Returns null if empty after trimming. */
function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().slice(0, MAX_NAME);
  return name.length ? name : null;
}

/** Unique, positive integer lead ids (max 1000 per request). */
function normalizeIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 1000);
}

async function getOwned(userId: string, id: number) {
  const [c] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.clerkUserId, userId)))
    .limit(1);
  return c ?? null;
}

async function nextSortOrder(userId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`COALESCE(MAX(${collections.sortOrder}), -1)` })
    .from(collections)
    .where(eq(collections.clerkUserId, userId));
  return (row?.max ?? -1) + 1;
}

// ---- GET / — list the member's collections with lead counts -----------------
router.get("/", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to view collections" }); return; }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const includeArchived = req.query.archived === "1" || req.query.archived === "true";

  const filters = [eq(collections.clerkUserId, userId)];
  if (q) filters.push(ilike(collections.name, `%${q}%`));
  if (!includeArchived) filters.push(eq(collections.archived, false));

  const rows = await db
    .select({
      id: collections.id,
      name: collections.name,
      color: collections.color,
      archived: collections.archived,
      sortOrder: collections.sortOrder,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
      leadCount: count(collectionLeads.id),
    })
    .from(collections)
    .leftJoin(collectionLeads, eq(collectionLeads.collectionId, collections.id))
    .where(and(...filters))
    .groupBy(collections.id)
    .orderBy(asc(collections.sortOrder), asc(collections.name));

  res.json({ collections: rows });
});

// ---- POST / — create a collection -------------------------------------------
router.post("/", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to create collections" }); return; }

  const name = sanitizeName((req.body as { name?: unknown }).name);
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }
  const color = typeof (req.body as { color?: unknown }).color === "string"
    ? String((req.body as { color?: string }).color).slice(0, 32) : null;

  const sortOrder = await nextSortOrder(userId);
  const [created] = await db
    .insert(collections)
    .values({ clerkUserId: userId, name, color, sortOrder })
    .returning();

  res.status(201).json({ collection: { ...created, leadCount: 0 } });
});

// ---- PATCH /reorder — persist drag/keyboard ordering ------------------------
// (declared before /:id so "reorder" is not captured as an :id)
router.patch("/reorder", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in" }); return; }

  const order = normalizeIds((req.body as { order?: unknown }).order);
  if (!order.length) { res.status(400).json({ error: "order must be a non-empty array of ids" }); return; }

  await Promise.all(
    order.map((id, i) =>
      db.update(collections)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(collections.id, id), eq(collections.clerkUserId, userId))),
    ),
  );
  res.json({ ok: true });
});

// ---- PATCH /:id — rename / recolor / archive --------------------------------
router.patch("/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const owned = await getOwned(userId, id);
  if (!owned) { res.status(404).json({ error: "Collection not found" }); return; }

  const body = req.body as { name?: unknown; color?: unknown; archived?: unknown };
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) {
    const name = sanitizeName(body.name);
    if (!name) { res.status(400).json({ error: "Name cannot be empty" }); return; }
    set.name = name;
  }
  if (body.color !== undefined) set.color = typeof body.color === "string" ? body.color.slice(0, 32) : null;
  if (body.archived !== undefined) set.archived = !!body.archived;

  const [updated] = await db.update(collections).set(set).where(eq(collections.id, id)).returning();
  res.json({ collection: updated });
});

// ---- POST /:id/duplicate — copy a collection and its membership -------------
router.post("/:id/duplicate", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const src = await getOwned(userId, id);
  if (!src) { res.status(404).json({ error: "Collection not found" }); return; }

  const sortOrder = await nextSortOrder(userId);
  const [copy] = await db
    .insert(collections)
    .values({ clerkUserId: userId, name: `${src.name} (copy)`.slice(0, MAX_NAME), color: src.color, sortOrder })
    .returning();

  const members = await db
    .select({ leadId: collectionLeads.leadId })
    .from(collectionLeads)
    .where(eq(collectionLeads.collectionId, src.id));

  if (members.length) {
    await db
      .insert(collectionLeads)
      .values(members.map((m) => ({ collectionId: copy.id, leadId: m.leadId, clerkUserId: userId })))
      .onConflictDoNothing({ target: [collectionLeads.collectionId, collectionLeads.leadId] });
  }

  res.status(201).json({ collection: { ...copy, leadCount: members.length } });
});

// ---- DELETE /:id — delete a collection + its membership ---------------------
router.delete("/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const owned = await getOwned(userId, id);
  if (!owned) { res.status(404).json({ error: "Collection not found" }); return; }

  await db.delete(collectionLeads).where(eq(collectionLeads.collectionId, id));
  await db.delete(collections).where(eq(collections.id, id));
  res.json({ ok: true, id });
});

// ---- GET /:id/leads — the leads inside a collection (paginated) --------------
router.get("/:id/leads", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const owned = await getOwned(userId, id);
  if (!owned) { res.status(404).json({ error: "Collection not found" }); return; }

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));

  const where = and(
    eq(collectionLeads.collectionId, id),
    eq(collectionLeads.clerkUserId, userId),
    isNull(leads.deletedAt),
  );

  const rows = await db
    .select({ lead: leads })
    .from(collectionLeads)
    .innerJoin(leads, eq(leads.id, collectionLeads.leadId))
    .where(where)
    .orderBy(desc(collectionLeads.addedAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const [{ total }] = await db
    .select({ total: count() })
    .from(collectionLeads)
    .innerJoin(leads, eq(leads.id, collectionLeads.leadId))
    .where(where);

  res.json({
    leads: rows.map((r) => r.lead),
    total: Number(total),
    page,
    pages: Math.ceil(Number(total) / limit) || 1,
  });
});

// ---- POST /:id/leads — bulk add leads (deduped) -----------------------------
router.post("/:id/leads", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const owned = await getOwned(userId, id);
  if (!owned) { res.status(404).json({ error: "Collection not found" }); return; }

  const ids = normalizeIds((req.body as { leadIds?: unknown }).leadIds);
  if (!ids.length) { res.status(400).json({ error: "leadIds must be a non-empty array" }); return; }

  const inserted = await db
    .insert(collectionLeads)
    .values(ids.map((leadId) => ({ collectionId: id, leadId, clerkUserId: userId })))
    .onConflictDoNothing({ target: [collectionLeads.collectionId, collectionLeads.leadId] })
    .returning({ id: collectionLeads.id });

  res.json({ ok: true, added: inserted.length, requested: ids.length });
});

// ---- DELETE /:id/leads — bulk remove leads ----------------------------------
router.delete("/:id/leads", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const owned = await getOwned(userId, id);
  if (!owned) { res.status(404).json({ error: "Collection not found" }); return; }

  const ids = normalizeIds((req.body as { leadIds?: unknown }).leadIds);
  if (!ids.length) { res.status(400).json({ error: "leadIds must be a non-empty array" }); return; }

  await db
    .delete(collectionLeads)
    .where(and(
      eq(collectionLeads.collectionId, id),
      eq(collectionLeads.clerkUserId, userId),
      inArray(collectionLeads.leadId, ids),
    ));

  res.json({ ok: true, removed: ids.length });
});

export default router;
