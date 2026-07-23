import { useEffect } from "react";
import { useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { Zap, Star } from "lucide-react";
import { useSeo } from "@/lib/seo";
import LeadPackWidget from "@/components/site/lead-pack-widget";
import { PlatformReviews } from "@/components/site/landing-sections";

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

          {/* Rating badges — instant social proof */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }} className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            {/* Google */}
            <div className="flex items-center gap-3 bg-white border border-[#e8eaed] rounded-xl px-5 py-3 shadow-sm">
              <svg width="22" height="22" viewBox="0 0 48 48" fill="none"><path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/><path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/><path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.821-3.317-11.387-7.93l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/><path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/></svg>
              <div className="text-left">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-semibold text-[#202124] leading-none">4.9</span>
                  <div className="flex items-center gap-px">{[1,2,3,4,5].map(s=><svg key={s} className="w-3 h-3 fill-[#f59e0b]" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>)}</div>
                </div>
                <p className="text-[11px] text-[#70757a] mt-0.5">386 Google reviews</p>
              </div>
            </div>
            {/* Trustpilot */}
            <div className="flex items-center gap-3 bg-white border border-[#e8eaed] rounded-xl px-5 py-3 shadow-sm">
              <svg width="22" height="22" viewBox="0 0 126.3 125.5"><path d="M126.3 48.2H78L63.2 2.5 48.3 48.2H0l40.5 29.1-15.4 47 38.1-27.5 38.2 27.5-15.5-47z" fill="#00b67a"/></svg>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">{[1,2,3,4,5].map(s=><div key={s} className="w-4 h-4 bg-[#00b67a] flex items-center justify-center"><svg className="w-2.5 h-2.5 fill-white" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg></div>)}</div>
                  <span className="text-sm font-bold text-[#191919] leading-none">4.8</span>
                </div>
                <p className="text-[11px] text-[#555] mt-0.5"><span className="font-bold text-[#191919]">Excellent</span> · 220 on Trustpilot</p>
              </div>
            </div>
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
