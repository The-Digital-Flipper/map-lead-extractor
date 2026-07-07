import { Router } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { db, packOrders } from "@workspace/db";
import { storage } from "../storage";
import { getUncachableStripeClient } from "../stripeClient";
import {
  LEAD_PACK, PACK_TIERS, validateFilters, parseRequest, countPackLeads, packDisplayName, locationString,
  type PackFilters,
} from "../lib/packs";
import { newOrderToken } from "../lib/packWorker";

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
