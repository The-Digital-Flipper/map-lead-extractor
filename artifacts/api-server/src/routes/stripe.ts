import { Router } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { and, gte, isNotNull, sql, desc, inArray } from "drizzle-orm";
import { db, packOrders, leads, sampleRequests } from "@workspace/db";
import { storage } from "../storage";
import { getUncachableStripeClient } from "../stripeClient";
import {
  LEAD_PACK, PACK_TIERS, validateFilters, parseRequest, countPackLeads, packWhere, packDisplayName, locationString,
  type PackFilters,
} from "../lib/packs";
import { newOrderToken } from "../lib/packWorker";
import { unsubscribeSample } from "../lib/buyer-followup";

const router = Router();

const FREE_LEAD_LIMIT = 100;
// Build-to-order fulfillment window; also the auto-partial-refund deadline.
const BUILD_DEADLINE_MS = 24 * 60 * 60 * 1000;

/** Check if a Clerk user has an active Pro subscription */
async function getProStatus(clerkUserId: string): Promise<{
  isPro: boolean;
  customerId: string | null;
  subscriptionId: string | null;
}> {
  const user = await storage.getUser(clerkUserId);
  if (!user?.stripeCustomerId) return { isPro: false, customerId: null, subscriptionId: null };

  const sub = await storage.getActiveSubscriptionForCustomer(user.stripeCustomerId);
  return {
    isPro: !!sub,
    customerId: user.stripeCustomerId,
    subscriptionId: (sub?.id as string) ?? null,
  };
}

/** GET /api/stripe/status — current user's plan */
router.get("/status", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { isPro, subscriptionId } = await getProStatus(auth.userId);
  let periodEnd: string | null = null;
  if (subscriptionId) {
    const sub = await storage.getSubscription(subscriptionId);
    if (sub?.current_period_end) {
      periodEnd = new Date((sub.current_period_end as number) * 1000).toISOString();
    }
  }

  res.json({ isPro, plan: isPro ? "pro" : "free", freeLimit: FREE_LEAD_LIMIT, periodEnd });
});

/** GET /api/stripe/products — public, for pricing page (fetches directly from Stripe API) */
router.get("/products", async (_req, res) => {
  const stripe = await getUncachableStripeClient();
  const productsRes = await stripe.products.list({ active: true, limit: 20 });
  const pricesRes = await stripe.prices.list({ active: true, limit: 100 });

  const map = new Map<string, {
    id: string; name: string; description: string;
    prices: { id: string; amount: number; currency: string; interval: string | null }[];
  }>();

  for (const product of productsRes.data) {
    map.set(product.id, {
      id: product.id,
      name: product.name,
      description: product.description ?? "",
      prices: [],
    });
  }

  for (const price of pricesRes.data) {
    const prod = map.get(price.product as string);
    if (prod) {
      prod.prices.push({
        id: price.id,
        amount: price.unit_amount ?? 0,
        currency: price.currency,
        interval: price.recurring?.interval ?? null,
      });
    }
  }

  res.json({ products: Array.from(map.values()) });
});

/**
 * GET /api/stripe/recent-orders-count — public, real count of paid pack
 * orders in the last N days (default 7). Backs the "X businesses bought
 * leads this week" trust ticker on the landing page — this must stay a
 * genuine number, never a hardcoded/marketing figure.
 */
router.get("/recent-orders-count", async (req, res) => {
  const days = Math.min(30, Math.max(1, parseInt(String(req.query.days ?? "7"), 10) || 7));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(packOrders)
    .where(and(isNotNull(packOrders.paidAt), gte(packOrders.paidAt, cutoff)));
  res.json({ count: row?.count ?? 0, days });
});

/** POST /api/stripe/checkout — create a Stripe Checkout session */
router.post("/checkout", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { priceId } = req.body as { priceId?: string };
  if (!priceId) {
    res.status(400).json({ error: "priceId required" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  let user = await storage.getUser(auth.userId);

  let customerId = user?.stripeCustomerId ?? null;
  if (!customerId) {
    const email = (req as unknown as { auth?: { sessionClaims?: { email?: string } } }).auth
      ?.sessionClaims?.email ?? undefined;
    const customer = await stripe.customers.create({ email, metadata: { clerkUserId: auth.userId } });
    customerId = customer.id;
    await storage.upsertUser(auth.userId, email ?? "");
    await storage.updateUserStripeInfo(auth.userId, { stripeCustomerId: customerId });
  }

  const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${baseUrl}/dashboard?upgraded=1`,
    cancel_url: `${baseUrl}/pricing`,
  });

  res.json({ url: session.url });
});

// Resolve request filters from either the dropdowns ({category,state}, strictly
// whitelisted) or a free-text request ({request}, parsed). Returns null only
// when dropdown values are off the whitelist.
async function resolveFilters(body: { category?: string; state?: string; request?: string }): Promise<PackFilters | null> {
  const request = String(body.request ?? "").trim();
  if (request) return parseRequest(request);
  return validateFilters(body.category, body.state);
}

/** GET /api/stripe/pack-availability — live count for a whitelisted
 * category/state combo (the dropdown path). */
router.get("/pack-availability", async (req, res) => {
  const filters = validateFilters(req.query.category, req.query.state);
  if (!filters) {
    res.status(400).json({ error: "Unknown category or state." });
    return;
  }
  const available = await countPackLeads(filters);
  res.json({ available, required: LEAD_PACK.leadCount, ok: available >= LEAD_PACK.leadCount });
});

/** POST /api/stripe/pack-quote — parse a free-text request and report whether
 * we can fill it instantly (100+ on hand) or will build it to order. */
router.post("/pack-quote", async (req, res) => {
  const request = String((req.body as { request?: string })?.request ?? "").trim();
  if (request.length < 3) {
    res.status(400).json({ error: "Tell us what leads you want — e.g. \"roofers in Mobile, AL\"." });
    return;
  }
  const f = await parseRequest(request);
  if (!f.category) {
    res.json({ ok: false, reason: "no_category", message: "We couldn't tell which business type you meant — try e.g. \"plumbers in Austin, TX\"." });
    return;
  }
  const available = await countPackLeads(f);
  const instant = available >= LEAD_PACK.leadCount;
  res.json({
    ok: true,
    instant,
    available,
    required: LEAD_PACK.leadCount,
    label: f.label,
    city: f.city,
    state: f.state,
    location: locationString(f),
    displayName: packDisplayName(f),
    priceCents: LEAD_PACK.priceCents,
  });
});

/** POST /api/stripe/pack-checkout — one-time $29 payment for a 100-lead pack.
 * Accepts a free-text { request } OR whitelisted { category, state }. EVERY
 * order creates a pack_orders row that the owner must review and Send from the
 * admin dashboard before the buyer gets anything. "Instant" (100+ in stock)
 * just means the worker snapshots the pack on its first tick; otherwise it
 * gathers fresh leads first (24h deadline, shortfall auto-refunded at Send).
 * No account needed — Stripe collects the buyer's email. */
router.post("/pack-checkout", async (req, res) => {
  const body = (req.body ?? {}) as { category?: string; state?: string; request?: string; size?: number };
  const filters = await resolveFilters(body);
  if (!filters) {
    res.status(400).json({ error: "Unknown category or state." });
    return;
  }
  if (body.request && !filters.category) {
    res.status(422).json({ error: "We couldn't tell which business type you meant — try e.g. \"plumbers in Austin, TX\"." });
    return;
  }
  // Volume tier (homepage pricing grid). Whitelisted sizes only; default 100.
  const tier = PACK_TIERS.get(Number(body.size ?? LEAD_PACK.leadCount));
  if (!tier) {
    res.status(400).json({ error: "Unknown pack size." });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
  const available = await countPackLeads(filters);
  const instant = available >= tier.leadCount;

  const token = newOrderToken();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: tier.priceCents,
        product_data: {
          name: packDisplayName(filters, tier.leadCount),
          description: instant
            ? "Emailed to you after a quick quality check — usually within a few hours."
            : `Built to order — we gather ${tier.leadCount} fresh matching leads and email your CSV within 24 hours (auto partial-refund if we fall short).`,
        },
      },
      quantity: 1,
    }],
    metadata: { pack_mode: instant ? "instant" : "build", pack_order_token: token },
    success_url: `${baseUrl}/api/leads/pack-order-received?token=${token}`,
    cancel_url: `${baseUrl}/#leads-for-sale`,
  });

  await db.insert(packOrders).values({
    token,
    stripeSessionId: session.id,
    amountCents: tier.priceCents,
    rawRequest: body.request ?? null,
    category: filters.category,
    label: filters.label,
    city: filters.city,
    state: filters.state,
    requested: tier.leadCount,
    deadlineAt: new Date(Date.now() + BUILD_DEADLINE_MS),
  });

  res.json({ url: session.url, mode: instant ? "instant" : "build", available });
});

// ── Free sample leads (email-capture conversion flow) ─────────────────────────
// A visitor picks a category/state (or types a request) and gets 5 REAL leads
// as proof of quality — business name, city, rating, website — but with the
// paid contact fields (phone + email) MASKED. Entering an email unlocks the
// full details for those same 5 and captures the lead for follow-up. This is
// deliberately proof-first: samples show before the email gate.
const SAMPLE_COUNT = 5;

/** Show only the area code of a US phone, mask the rest: "(251) •••-••••". */
function maskPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length >= 10) return `(${local.slice(0, 3)}) •••-••••`;
  return "•••-••••";
}

/** First email from the stored comma/semicolon-separated list. */
function firstEmail(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean)[0];
  return first || null;
}

/** Bare hostname for display, e.g. "gulfcoastroofing.com" (no scheme/path). */
function siteHost(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/^www\./, "").split("/")[0] || null;
  }
}

/** City/region label pulled from a full address, falling back to the filter. */
function cityLabel(address: string | null, f: PackFilters): string {
  if (f.city) return f.state ? `${f.city}, ${f.state}` : f.city;
  if (address) {
    // "…, Mobile, AL 36604, USA" → "Mobile, AL"
    const m = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s+\d{5}/);
    if (m) return `${m[1].trim()}, ${m[2]}`;
  }
  return f.state || "";
}

/**
 * POST /api/stripe/pack-sample — public. Returns up to 5 masked sample leads
 * for a category/state (or free-text request) and records the (email-less)
 * sample view. No email required.
 */
router.post("/pack-sample", async (req, res) => {
  const body = (req.body ?? {}) as { category?: string; state?: string; request?: string };
  const filters = await resolveFilters(body);
  if (!filters) {
    res.status(400).json({ error: "Unknown category or state." });
    return;
  }

  // Best leads first (highest composite value), only ones we can actually show
  // as proof: must have a name and a phone (the thing we mask).
  const rows = await db
    .select({
      id: leads.id, name: leads.name, address: leads.address, category: leads.category,
      rating: leads.rating, reviewCount: leads.reviewCount, website: leads.website,
      phone: leads.phone, emails: leads.emails, valueScore: leads.valueScore,
    })
    .from(leads)
    .where(and(packWhere(filters), isNotNull(leads.name), isNotNull(leads.phone)))
    // Bias the PREVIEW toward the most impressive, complete records: ones with
    // an email + website to show, a real rating, then highest composite value.
    // (The actual pack still ships the top 100 by value at fulfillment.)
    .orderBy(
      sql`(${leads.emails} is not null and ${leads.emails} <> '') desc`,
      sql`(${leads.website} is not null and ${leads.website} <> '') desc`,
      sql`(${leads.rating} is not null) desc`,
      desc(leads.reviewCount),
      desc(leads.valueScore),
    )
    .limit(SAMPLE_COUNT);

  if (rows.length === 0) {
    res.json({ ok: false, reason: "no_matches", message: "We don't have sample leads for that combination yet — try another type or state." });
    return;
  }

  const totalAvailable = await countPackLeads(filters);

  const sample = rows.map(r => ({
    name: r.name,
    city: cityLabel(r.address, filters),
    category: r.category,
    rating: r.rating != null ? Number(r.rating) : null,
    reviewCount: r.reviewCount ?? null,
    website: siteHost(r.website),
    phoneMasked: maskPhone(r.phone),
    hasEmail: !!firstEmail(r.emails),
  }));

  const [inserted] = await db.insert(sampleRequests).values({
    category: filters.category,
    label: filters.label,
    city: filters.city,
    state: filters.state,
    rawRequest: body.request ?? null,
    leadIds: rows.map(r => r.id),
    ip: (req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.ip || "").slice(0, 100) || null,
    userAgent: req.headers["user-agent"]?.toString().slice(0, 300) || null,
    referrer: req.headers["referer"]?.toString().slice(0, 300) || null,
  }).returning({ id: sampleRequests.id });

  res.json({
    ok: true,
    sampleId: inserted.id,
    label: filters.label,
    location: locationString(filters),
    displayName: packDisplayName(filters),
    totalAvailable,
    leads: sample,
  });
});

/**
 * POST /api/stripe/pack-sample-unlock — public. Captures the visitor's email
 * against a prior /pack-sample view and returns the SAME 5 leads with full
 * phone + email revealed.
 */
router.post("/pack-sample-unlock", async (req, res) => {
  const body = (req.body ?? {}) as { sampleId?: number; email?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  const sampleId = Number(body.sampleId);
  if (!Number.isInteger(sampleId) || sampleId <= 0) {
    res.status(400).json({ error: "Missing sample reference — reload and try again." });
    return;
  }

  const [reqRow] = await db.select().from(sampleRequests).where(sql`id = ${sampleId}`).limit(1);
  if (!reqRow) {
    res.status(404).json({ error: "That sample expired — reload and try again." });
    return;
  }

  await db.update(sampleRequests)
    .set({ email, unlockedAt: new Date() })
    .where(sql`id = ${sampleId}`);

  const ids = (reqRow.leadIds ?? []) as number[];
  const rows = ids.length
    ? await db.select({
        id: leads.id, name: leads.name, address: leads.address, category: leads.category,
        rating: leads.rating, reviewCount: leads.reviewCount, website: leads.website,
        phone: leads.phone, emails: leads.emails,
      }).from(leads).where(inArray(leads.id, ids))
    : [];
  // Preserve the original display order.
  const byId = new Map(rows.map(r => [r.id, r]));
  const ordered = ids.map(id => byId.get(id)).filter(Boolean) as typeof rows;

  const unlocked = ordered.map(r => ({
    name: r.name,
    city: cityLabel(r.address, { category: reqRow.category, label: reqRow.label, city: reqRow.city, state: reqRow.state }),
    category: r.category,
    rating: r.rating != null ? Number(r.rating) : null,
    reviewCount: r.reviewCount ?? null,
    website: siteHost(r.website),
    phone: r.phone,
    email: firstEmail(r.emails),
  }));

  res.json({ ok: true, leads: unlocked });
});

/** GET|POST /api/stripe/sample-unsub/:token — one-click unsubscribe from the
 *  buyer follow-up emails (backs the List-Unsubscribe header + footer link). */
const sampleUnsub = async (req: import("express").Request, res: import("express").Response) => {
  await unsubscribeSample(String(req.params.token ?? ""));
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0d1117;color:#e6edf3;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><div style="text-align:center;max-width:420px;padding:2rem"><h1 style="font-size:1.25rem;margin:0 0 .5rem">You're unsubscribed</h1><p style="color:#94a3b8;line-height:1.5">You won't get any more follow-up emails from us. You can still buy leads any time at <a href="https://mapleadextractor.net/" style="color:#00E676">mapleadextractor.net</a>.</p></div></body>`);
};
router.get("/sample-unsub/:token", sampleUnsub);
router.post("/sample-unsub/:token", sampleUnsub);

/** POST /api/stripe/portal — customer billing portal */
router.post("/portal", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await storage.getUser(auth.userId);
  if (!user?.stripeCustomerId) {
    res.status(400).json({ error: "No billing account found" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/dashboard`,
  });

  res.json({ url: portal.url });
});

export { getProStatus, FREE_LEAD_LIMIT };
export default router;
