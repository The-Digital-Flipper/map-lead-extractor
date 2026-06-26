import { getUncachableStripeClient } from "./stripeClient";

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  // Check if Pro Plan already exists
  const existing = await stripe.products.search({
    query: "name:'MapLeadExtractor Pro' AND active:'true'",
  });
  if (existing.data.length > 0) {
    console.log("✓ MapLeadExtractor Pro already exists:", existing.data[0].id);
    const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
    for (const p of prices.data) {
      const r = p.recurring;
      console.log(`  price: ${p.id}  $${(p.unit_amount ?? 0) / 100}/${r?.interval ?? "one-time"}`);
    }
    return;
  }

  console.log("Creating MapLeadExtractor Pro product...");
  const product = await stripe.products.create({
    name: "MapLeadExtractor Pro",
    description: "Unlimited lead saves, CSV export, social link extraction, email enrichment.",
    metadata: { plan: "pro" },
  });
  console.log("Created product:", product.id);

  // $9.99/month
  const monthly = await stripe.prices.create({
    product: product.id,
    unit_amount: 999,
    currency: "usd",
    recurring: { interval: "month" },
  });
  console.log("Created monthly price:", monthly.id, "— $9.99/mo");

  // $59.99/year (~$5/mo)
  const yearly = await stripe.prices.create({
    product: product.id,
    unit_amount: 5999,
    currency: "usd",
    recurring: { interval: "year" },
  });
  console.log("Created yearly price:", yearly.id, "— $59.99/yr");

  console.log("\n✓ Done! Webhooks will sync these to your database.");
}

createProducts().catch((err) => {
  console.error(err);
  process.exit(1);
});
