import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { Zap, Check, Star } from "lucide-react";
import { useSeo } from "@/lib/seo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Price {
  id: string;
  amount: number;
  currency: string;
  interval: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string;
  prices: Price[];
}

const FREE_FEATURES = [
  "100 leads saved total",
  "CSV export",
  "Google Maps extraction",
  "Bing Maps extraction",
  "Lead scoring (0–100)",
];

const PRO_FEATURES = [
  "Unlimited leads saved",
  "CSV export",
  "Google Maps extraction",
  "Bing Maps extraction",
  "Lead scoring (0–100)",
  "Individual social links (FB, IG, Twitter, LinkedIn)",
  "Email enrichment",
  "Priority support",
];

export default function Pricing() {
  useSeo({
    title: "Pricing — Map Lead Extractor | Free & Pro Plans",
    description: "Start free, upgrade to Pro for unlimited lead saves and the full money-lead scoring suite. Simple pricing for Google & Bing Maps lead extraction.",
    path: "/pricing",
  });
  const { isSignedIn } = useUser();
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${basePath}/api/stripe/products`)
      .then(r => r.json())
      .then(data => { setProducts(data.products ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const proProduct = products.find(p => p.name.toLowerCase().includes("pro"));
  const monthlyPrice = proProduct?.prices.find(p => p.interval === "month");
  const yearlyPrice = proProduct?.prices.find(p => p.interval === "year");
  const activePrice = billingInterval === "month" ? monthlyPrice : yearlyPrice;

  const handleCheckout = async (priceId: string) => {
    if (!isSignedIn) {
      window.location.href = `${basePath}/sign-in`;
      return;
    }
    setCheckoutLoading(priceId);
    try {
      const res = await fetch(`${basePath}/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setCheckoutLoading(null);
    }
  };

  const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const perMonth = yearlyPrice ? `$${((yearlyPrice.amount / 100) / 12).toFixed(2)}` : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href={basePath || "/"} className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <Zap className="w-5 h-5 text-primary" />
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </a>
          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <a href={`${basePath}/dashboard`} className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity">Dashboard</a>
            ) : (
              <a href={`${basePath}/sign-in`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign In</a>
            )}
          </div>
        </div>
      </header>

      <main className="pt-32 pb-32">
        <div className="container mx-auto px-6 max-w-5xl">

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
              <Star className="w-3.5 h-3.5" /> Simple Pricing
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              Start free. Go Pro when you're ready.
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              100 leads free — no credit card required. Upgrade anytime for unlimited saves.
            </p>
          </motion.div>

          {/* Billing toggle */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="flex justify-center mb-10">
            <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
              <button
                onClick={() => setBillingInterval("month")}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${billingInterval === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingInterval("year")}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${billingInterval === "year" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Yearly
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${billingInterval === "year" ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                  Save 50%
                </span>
              </button>
            </div>
          </motion.div>

          {/* Pricing cards */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">

            {/* Free */}
            <div className="bg-card border border-border rounded-2xl p-8 flex flex-col">
              <div className="mb-6">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Free</div>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-4xl font-display font-bold">$0</span>
                  <span className="text-muted-foreground mb-1">/forever</span>
                </div>
                <p className="text-sm text-muted-foreground">Perfect for trying it out.</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {FREE_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={isSignedIn ? `${basePath}/dashboard` : `${basePath}/sign-up`}
                className="w-full flex items-center justify-center py-3 rounded-xl border border-border text-sm font-bold hover:bg-white/5 transition-colors"
              >
                {isSignedIn ? "Go to Dashboard" : "Get Started Free"}
              </a>
            </div>

            {/* Pro */}
            <div className="bg-card border-2 border-primary rounded-2xl p-8 flex flex-col relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">MOST POPULAR</span>
              </div>
              <div className="mb-6">
                <div className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Pro</div>
                {loading ? (
                  <div className="h-10 w-28 bg-white/5 rounded animate-pulse mb-1" />
                ) : (
                  <>
                    <div className="flex items-end gap-2 mb-1">
                      <span className="text-4xl font-display font-bold">
                        {activePrice ? fmt(activePrice.amount) : (billingInterval === "month" ? "$9.99" : "$59.99")}
                      </span>
                      <span className="text-muted-foreground mb-1">/{billingInterval}</span>
                    </div>
                    {billingInterval === "year" && perMonth && (
                      <p className="text-sm text-primary font-semibold">{perMonth}/mo — billed annually</p>
                    )}
                  </>
                )}
                <p className="text-sm text-muted-foreground mt-1">Everything you need to scale.</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {PRO_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => activePrice && handleCheckout(activePrice.id)}
                disabled={!activePrice || !!checkoutLoading}
                className="w-full flex items-center justify-center py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkoutLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    Redirecting…
                  </span>
                ) : (
                  `Get Pro — ${billingInterval === "month" ? "$9.99/mo" : "$59.99/yr"}`
                )}
              </button>
              <p className="text-xs text-muted-foreground text-center mt-3">No contracts. Cancel anytime.</p>
            </div>
          </motion.div>

          {/* FAQ */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }} className="mt-20 max-w-2xl mx-auto">
            <h2 className="text-2xl font-display font-bold text-center mb-8">Common questions</h2>
            <div className="space-y-4">
              {[
                { q: "What counts as a lead?", a: "Each business listing you extract — one Google Maps result = one lead." },
                { q: "What happens when I hit 100 leads on Free?", a: "The extension will show a notice and stop saving new leads to the cloud. You can still extract locally and export — just no more cloud storage." },
                { q: "Can I cancel anytime?", a: "Yes. Cancel from your dashboard and you keep Pro access until the end of your billing period." },
                { q: "Is my data safe?", a: "Your leads are stored in a private PostgreSQL database. Only you can see them from your dashboard." },
              ].map(({ q, a }) => (
                <div key={q} className="bg-card border border-border rounded-xl p-5">
                  <div className="font-semibold mb-1">{q}</div>
                  <div className="text-sm text-muted-foreground">{a}</div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
