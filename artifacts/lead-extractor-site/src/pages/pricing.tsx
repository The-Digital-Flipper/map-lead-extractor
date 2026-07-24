import { useEffect } from "react";
import { useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { Zap, Star } from "lucide-react";
import { useSeo } from "@/lib/seo";
import LeadPackWidget from "@/components/site/lead-pack-widget";
import { LeadStockLine } from "@/components/site/landing-sections";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const PRICING_FAQ = [
  { q: "How much do leads cost?", a: "Done-for-you lead packs start at $29 for 100 leads ($0.29/lead) and drop to $0.12/lead when you buy 5,000. Pick your industry and state above to check availability and buy." },
  { q: "What counts as a lead?", a: "Each business listing — name, phone, address, website, and any public email or social links we find. One listing = one lead." },
  { q: "Are the leads verified?", a: "Yes. Every lead is human-reviewed before it ships — phone numbers are spot-checked and addresses are confirmed to be in your requested area." },
  { q: "How are leads delivered?", a: "As a CSV, emailed to you. In-stock packs ship after a quick quality check (usually a few hours); anything we gather fresh arrives within 24 hours, and any shortfall is automatically refunded." },
  { q: "Is the extension free?", a: "Yes — the Google & Bing Maps extraction extension is completely free. Lead packs are for when you'd rather skip the work and buy ready-made leads." },
];

export default function Pricing() {
  useSeo({
    title: "Lead Pricing — Map Lead Extractor | Ready-Made Business Leads",
    description: "Human-reviewed business leads from $0.29/lead, dropping to $0.12/lead in bulk. Buy ready-made Google Maps leads by industry and state, refund-backed.",
    path: "/pricing",
  });

  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: PRICING_FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "faqpage-jsonld-pricing";
    script.text = JSON.stringify(schema);
    const existing = document.getElementById("faqpage-jsonld-pricing");
    if (existing) existing.remove();
    document.head.appendChild(script);
    return () => {
      document.getElementById("faqpage-jsonld-pricing")?.remove();
    };
  }, []);

  const { isSignedIn } = useUser();

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

      <main className="pt-32 pb-32 relative overflow-hidden">
        {/* Ambient glow behind the hero */}
        <div aria-hidden className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/10 blur-[120px] rounded-full" />

        <div className="container mx-auto px-6 max-w-5xl relative">

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-4">
              <Star className="w-3.5 h-3.5" /> Done-For-You Leads
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold mb-4 tracking-tight">
              Ready-to-call leads<br className="hidden sm:block" /> from <span className="text-primary">$0.12</span> each.
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Human-reviewed business leads delivered as a CSV — usually within hours. Buy in bulk and the per-lead price drops. Every pack is refund-backed.
            </p>
          </motion.div>

          {/* Live social proof — a real number, never invented review scores
              (the old fake Google/Trustpilot badges here were removed
              deliberately; see the testimonials note in replit.md). */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }} className="mb-12">
            <LeadStockLine className="text-center" />
          </motion.div>

          {/* The buy-leads widget (shared with the home page) */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
            <LeadPackWidget showReviews />
          </motion.div>

          {/* FAQ */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="mt-20 max-w-2xl mx-auto">
            <h2 className="text-2xl font-display font-bold text-center mb-8">Common questions</h2>
            <div className="space-y-4">
              {PRICING_FAQ.map(({ q, a }) => (
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
