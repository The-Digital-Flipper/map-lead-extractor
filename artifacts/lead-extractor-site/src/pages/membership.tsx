import { useState } from "react";
import { useUser, useSession } from "@clerk/react";
import { motion } from "framer-motion";
import {
  Zap, Crown, CheckCircle2, ArrowUpRight, Shield, Globe2,
  MessageSquare, Database, Infinity, Bot, Star,
} from "lucide-react";
import { useSeo } from "@/lib/seo";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const FEATURES = [
  {
    icon: Globe2,
    title: "Google Maps Scraper",
    description: "Run unlimited scrape jobs on any business type in any city. Build custom lead lists without lifting a finger.",
  },
  {
    icon: MessageSquare,
    title: "Command Center — SMS Outreach",
    description: "Full SMS inbox with two-way conversations, plus bulk text blasts to hundreds of leads at once.",
  },
  {
    icon: Bot,
    title: "AI Lead Enrichment",
    description: "Deep AI research on any business — social profiles, owner info, pitch hooks, and outreach openers.",
  },
  {
    icon: Infinity,
    title: "Unlimited AI Lead Finds",
    description: "No daily search limits. Use the AI finder as many times as you want, every day.",
  },
  {
    icon: Database,
    title: "Full Lead Dashboard",
    description: "CRM-style dashboard with scoring, notes, status tracking, and one-click CSV export.",
  },
  {
    icon: Shield,
    title: "No Monthly Fees — Ever",
    description: "Pay once. Use it forever. No subscriptions, no renewals, no surprises.",
  },
];

export default function MembershipPage() {
  useSeo({ title: "Lifetime Membership — MapLeadExtractor", path: "/membership" });
  const { isSignedIn } = useUser();
  const { session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    if (!isSignedIn) {
      window.location.href = `${basePath}/sign-in?redirect_url=${encodeURIComponent(basePath + "/membership")}`;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await session?.getToken();
      const r = await fetch(`${basePath}/api/stripe/lifetime-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await r.json() as { url?: string; error?: string };
      if (!r.ok || !data.url) {
        setError(data.error ?? "Something went wrong — please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <a href={`${basePath}/`} className="flex items-center gap-2 font-display font-bold text-lg">
            <Zap className="w-4 h-4 text-primary" />
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </a>
          <div className="ml-auto flex items-center gap-3">
            {isSignedIn ? (
              <a href={`${basePath}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard →</a>
            ) : (
              <a href={`${basePath}/sign-in`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign in</a>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 pt-20 pb-12 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold mb-6">
            <Crown className="w-3.5 h-3.5" /> LIFETIME MEMBERSHIP
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4 leading-tight">
            Every tool. One price.<br />
            <span className="text-primary">No monthly fees.</span>
          </h1>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Get lifetime access to the Google Maps Scraper, Command Center SMS outreach,
            AI lead enrichment, and unlimited lead finds — all for a single one-time payment.
          </p>

          {/* Pricing card */}
          <div className="inline-block bg-card border-2 border-primary/40 rounded-2xl p-8 shadow-2xl shadow-primary/10 mb-8 w-full max-w-sm">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Crown className="w-5 h-5 text-primary" />
              <span className="font-display font-bold text-lg">Lifetime Membership</span>
            </div>
            <div className="flex items-end justify-center gap-1 my-4">
              <span className="text-5xl font-display font-bold text-primary">$197</span>
              <span className="text-muted-foreground text-sm mb-2 pb-1">one-time</span>
            </div>
            <p className="text-muted-foreground text-sm mb-6">Pay once. Access everything forever.</p>

            <button
              onClick={handleBuy}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <><ArrowUpRight className="w-4 h-4" /> Get Lifetime Access</>
              )}
            </button>

            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure checkout</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Instant access</span>
            </div>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-1 text-yellow-400 mb-2">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
          </div>
          <p className="text-muted-foreground text-sm">Trusted by hundreds of lead generation pros</p>
        </motion.div>
      </section>

      {/* Features grid */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-bold mb-1.5">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-12 text-center"
        >
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-8 max-w-xl mx-auto">
            <Crown className="w-8 h-8 text-primary mx-auto mb-3" />
            <h2 className="font-display font-bold text-2xl mb-2">Ready to unlock everything?</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Join hundreds of sales pros who use MapLeadExtractor to find and close more deals, faster.
            </p>
            <button
              onClick={handleBuy}
              disabled={loading}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <><Crown className="w-4 h-4" /> Get Lifetime Access — $197</>
              )}
            </button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
