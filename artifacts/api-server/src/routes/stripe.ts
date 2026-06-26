import { Router } from "express";
import { clerkMiddleware, getAuth } from "@clerk/express";
import { storage } from "../storage";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

const FREE_LEAD_LIMIT = 100;

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

/** GET /api/stripe/products — public, for pricing page */
router.get("/products", async (_req, res) => {
  const rows = await storage.listProductsWithPrices();
  const map = new Map<string, {
    id: string; name: string; description: string;
    prices: { id: string; amount: number; currency: string; interval: string | null }[];
  }>();
  for (const row of rows as Record<string, unknown>[]) {
    const pid = row.product_id as string;
    if (!map.has(pid)) {
      map.set(pid, {
        id: pid,
        name: row.product_name as string,
        description: (row.product_description as string) ?? "",
        prices: [],
      });
    }
    if (row.price_id) {
      const recurring = row.recurring as { interval?: string } | null;
      map.get(pid)!.prices.push({
        id: row.price_id as string,
        amount: row.unit_amount as number,
        currency: row.currency as string,
        interval: recurring?.interval ?? null,
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
