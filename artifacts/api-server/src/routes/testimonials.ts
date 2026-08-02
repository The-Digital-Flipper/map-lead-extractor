import { Router, type IRouter } from "express";
import { db, testimonials, packOrders } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

// Only delivered orders can leave a review — the token in the buyer's
// delivery email is the proof of purchase.
async function orderForToken(token: string) {
  if (!token || token.length < 10) return null;
  const rows = await db.select().from(packOrders).where(eq(packOrders.token, token));
  const order = rows[0];
  if (!order || (order.status !== "ready" && order.status !== "partial")) return null;
  return order;
}

// ---- GET /testimonials — approved reviews for the public site ---------------
router.get("/", async (_req, res) => {
  const rows = await db
    .select({
      id: testimonials.id,
      name: testimonials.name,
      business: testimonials.business,
      rating: testimonials.rating,
      quote: testimonials.quote,
      createdAt: testimonials.createdAt,
    })
    .from(testimonials)
    .where(eq(testimonials.status, "approved"))
    .orderBy(desc(testimonials.createdAt))
    .limit(12);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({ testimonials: rows });
});

// ---- GET /testimonials/context?token= — prefill for the review form ---------
router.get("/context", async (req, res) => {
  const order = await orderForToken(String(req.query.token ?? ""));
  if (!order) { res.status(404).json({ error: "This review link isn't valid. Reviews can only be left from the link in your delivery email." }); return; }
  const existing = await db.select({ id: testimonials.id }).from(testimonials).where(eq(testimonials.orderId, order.id));
  res.json({
    label: order.label || "leads",
    city: order.city,
    state: order.state,
    delivered: order.delivered,
    alreadyReviewed: existing.length > 0,
  });
});

// ---- POST /testimonials — a real buyer submits their review -----------------
// Goes in as `pending`; nothing shows on the site until the owner approves.
router.post("/", async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const order = await orderForToken(typeof b.token === "string" ? b.token : "");
  if (!order) { res.status(404).json({ error: "This review link isn't valid. Reviews can only be left from the link in your delivery email." }); return; }

  const name = typeof b.name === "string" ? b.name.trim().slice(0, 80) : "";
  const business = typeof b.business === "string" && b.business.trim() ? b.business.trim().slice(0, 80) : null;
  const quote = typeof b.quote === "string" ? b.quote.trim().slice(0, 600) : "";
  const rating = Number(b.rating);
  if (name.length < 2) { res.status(400).json({ error: "Please add your name." }); return; }
  if (quote.length < 20) { res.status(400).json({ error: "Please write at least a sentence or two." }); return; }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) { res.status(400).json({ error: "Please pick a star rating." }); return; }

  // A resubmit replaces the buyer's earlier text and goes back to pending
  // for re-approval — the buyer always controls their own words.
  await db
    .insert(testimonials)
    .values({ orderId: order.id, name, business, rating, quote, status: "pending" })
    .onConflictDoUpdate({
      target: testimonials.orderId,
      set: { name, business, rating, quote, status: "pending" },
    });
  res.json({ ok: true });
});

export default router;
