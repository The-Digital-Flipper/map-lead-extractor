import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  Globe,
  Star,
  MapPin,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

import LeadPackWidget from "@/components/site/lead-pack-widget";
import StickyCta from "@/components/site/sticky-cta";
import TrustBadges, { PaymentMethods } from "@/components/site/trust-badges";
import NotFound from "@/pages/not-found";
import { useSeo } from "@/lib/seo";
import { SOCIAL_LANDING_PAGES } from "@/data/social-landing-pages";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

// Social-traffic landing pages (route: /go/:variant). One conversion-tuned
// template, five sales angles — copy lives in data/social-landing-pages.ts and
// the admin Social tab hands out the links. Like /get-leads: no site nav to
// leak clicks, noindex since these are paid/social destinations, and the same
// LeadPackWidget doing the actual selling.
export default function SocialLanding({ params }: { params: { variant: string } }) {
  const lp = SOCIAL_LANDING_PAGES.find((p) => p.slug === params.variant);

  useSeo({
    title: lp?.seoTitle ?? "MapLeadExtractor",
    description: lp?.seoDescription,
    path: `/go/${params.variant}`,
  });

  // Keep social/paid LPs out of the search index; cleaned up on unmount so the
  // tag never leaks onto other SPA routes.
  useEffect(() => {
    const el = document.createElement("meta");
    el.setAttribute("name", "robots");
    el.setAttribute("content", "noindex, follow");
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  if (!lp) return <NotFound />;

  const widgetSection = (
    <section id="buy" className="py-16 bg-card/20 border-y border-border scroll-mt-20">
      <div className="container mx-auto px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4 tracking-tight">
            {lp.sampleFirst ? "Try it right here — free" : "Build your lead pack"}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {lp.sampleFirst
              ? "Pick your industry and city. Preview 5 real leads instantly, then grab all 100 only if they look like money."
              : "Tell us the industry and location. Check availability instantly, then check out with secure Stripe. Your CSV is emailed after a quick quality review."}
          </p>
        </div>
        <LeadPackWidget />
        <TrustBadges className="max-w-4xl mx-auto mt-12" />
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">
      {/* Minimal header — logo only, no nav links to leak the click */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight">
            <Zap className="w-5 h-5 text-primary" />
            <span>
              Map<span className="text-primary">Lead</span>Extractor
            </span>
          </a>
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 text-primary" /> Secure Stripe checkout
          </span>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative pt-16 pb-20 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10" />
          <div className="container mx-auto px-6">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="max-w-3xl mx-auto text-center"
            >
              <motion.div variants={fadeIn}>
                <span className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-sm font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  {lp.badge}
                </span>
              </motion.div>

              <motion.h1
                variants={fadeIn}
                className="text-4xl md:text-6xl font-display font-bold leading-[1.1] tracking-tight mb-6"
              >
                {lp.headline.pre}
                <span className="text-primary">{lp.headline.highlight}</span>
                {lp.headline.post}
              </motion.h1>

              <motion.p
                variants={fadeIn}
                className="text-lg md:text-2xl text-muted-foreground mb-8 leading-relaxed"
              >
                {lp.subhead}
              </motion.p>

              <motion.div variants={fadeIn} className="flex flex-col items-center gap-4">
                <a
                  href="#buy"
                  data-testid="btn-hero-cta"
                  className="inline-flex items-center gap-2 h-16 px-10 rounded-xl bg-primary text-primary-foreground text-lg font-bold shadow-[0_0_40px_rgba(0,230,90,0.35)] hover:shadow-[0_0_60px_rgba(0,230,90,0.55)] hover:scale-105 transition-all"
                >
                  {lp.ctaLabel} <ArrowRight className="w-5 h-5" />
                </a>
                {!lp.sampleFirst && (
                  <div className="flex items-baseline gap-2 text-sm text-muted-foreground">
                    <span className="line-through">$99</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
                      71% OFF today
                    </span>
                  </div>
                )}
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5 text-primary" /> Money-back guarantee · Secure Stripe checkout
                </p>
              </motion.div>

              {/* Trust chips */}
              <motion.div
                variants={fadeIn}
                className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
              >
                {lp.chips.map((chip) => (
                  <span key={chip} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> {chip}
                  </span>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Proof-first angles put the widget right under the hero */}
        {lp.sampleFirst && widgetSection}

        {/* Social proof bar */}
        <section className={`py-10 border-border bg-card/20 ${lp.sampleFirst ? "border-b" : "border-y"}`}>
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
              {/* Google rating */}
              <div className="flex items-center gap-3 bg-white border border-[#e8eaed] rounded-xl px-5 py-3">
                <svg width="26" height="26" viewBox="0 0 48 48" fill="none">
                  <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107" />
                  <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00" />
                  <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.821-3.317-11.387-7.93l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50" />
                  <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2" />
                </svg>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[20px] font-semibold text-[#202124] leading-none">4.9</span>
                    <div className="flex gap-px">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <svg key={s} className="w-3 h-3 fill-[#f59e0b]" viewBox="0 0 20 20">
                          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-[#70757a] mt-0.5">386 Google reviews</p>
                </div>
              </div>

              <div className="hidden md:block w-px h-10 bg-border" />

              <div className="text-center md:text-left">
                <div className="text-2xl font-display font-bold">
                  600<span className="text-primary">+</span>
                </div>
                <p className="text-xs text-muted-foreground">Happy customers worldwide</p>
              </div>

              <div className="hidden md:block w-px h-10 bg-border" />

              <div className="text-center md:text-left">
                <div className="text-2xl font-display font-bold">50</div>
                <p className="text-xs text-muted-foreground">US states covered</p>
              </div>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className="py-16">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
                Everything you need to start closing
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Every lead in your pack comes structured, de-duplicated, and ready to drop straight
                into your CRM or cold-outreach tool.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { icon: Phone, title: "Verified phone numbers", desc: "Spot-checked to be active and matched to the listed business." },
                { icon: Mail, title: "Real email addresses", desc: "Format-validated against a live mail server — no obvious bounces." },
                { icon: Globe, title: "Website & socials", desc: "Business site plus any public social links we find." },
                { icon: Star, title: "Ratings & reviews", desc: "Star rating and review count so you can prioritize the right prospects." },
                { icon: MapPin, title: "Your exact market", desc: "Filtered to the industry and city or state you choose." },
                { icon: RefreshCw, title: "Clean CSV / XLSX", desc: "Structured and de-duplicated — import in one click." },
              ].map((f) => (
                <motion.div
                  key={f.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeIn}
                  className="p-6 rounded-xl border border-border bg-card/40 hover:border-primary/30 transition-colors"
                >
                  <f.icon className="w-8 h-8 text-primary mb-4" />
                  <h3 className="font-bold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Buy — the conversion widget (already shown up top on sample-first pages) */}
        {!lp.sampleFirst && widgetSection}

        {/* How it works */}
        <section className="py-16">
          <div className="container mx-auto px-6 max-w-5xl">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-14">
              How it works
            </h2>
            <div className="grid md:grid-cols-3 gap-10 relative">
              <div className="hidden md:block absolute top-8 left-[16%] right-[16%] h-0.5 bg-border -z-10" />
              {[
                { step: "01", title: "Pick your leads", desc: "Choose your industry and city or state, and confirm availability in real time." },
                { step: "02", title: "We verify & pack", desc: "A real person reviews every record — dead listings out, phones and emails checked." },
                { step: "03", title: "Check your inbox", desc: "Your clean CSV lands in your email, usually within a few hours. Start reaching out." },
              ].map((item) => (
                <motion.div
                  key={item.step}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeIn}
                  className="text-center"
                >
                  <div className="w-16 h-16 mx-auto bg-card border border-primary text-primary flex items-center justify-center rounded-full text-2xl font-display font-bold mb-6">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ — objection handling */}
        <section className="py-16 bg-card/20 border-y border-border">
          <div className="container mx-auto px-6 max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-center mb-10">
              Questions, answered
            </h2>
            <div className="space-y-6">
              {[
                {
                  q: "How fresh are the leads?",
                  a: "Every pack is checked against our quality standards before it ships — permanently closed, moved, and duplicate businesses are removed. If we don't already have enough on hand for your request, we gather them fresh and still deliver within 24 hours.",
                },
                {
                  q: "How and when do I get them?",
                  a: "As a clean CSV emailed to the address on your Stripe receipt — usually within a few hours of ordering, and never more than 24 hours.",
                },
                {
                  q: "What if you can't fill my pack?",
                  a: "If we come up short of your lead count after review, we automatically refund the difference — no questions asked. You're never charged for leads you don't receive.",
                },
                {
                  q: "What's actually in each lead?",
                  a: "Business name, phone, email (where available), website, full address, star rating and review count, and public social links — everything you need for cold outreach.",
                },
                {
                  q: "Is this a subscription?",
                  a: "No. It's a one-time payment for the pack you choose. Buy once, use forever. Come back for more whenever you need them.",
                },
              ].map((f) => (
                <div key={f.q} className="border-b border-border pb-6">
                  <h3 className="text-lg font-semibold mb-2">{f.q}</h3>
                  <p className="text-muted-foreground leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 text-center">
          <div className="container mx-auto px-6 max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-5">
              {lp.finalHeadline}
            </h2>
            <p className="text-lg text-muted-foreground mb-9">{lp.finalSubhead}</p>
            <a
              href="#buy"
              data-testid="btn-final-cta"
              className="inline-flex items-center gap-2 h-16 px-10 rounded-xl bg-primary text-primary-foreground text-lg font-bold shadow-lg shadow-primary/30 hover:opacity-90 transition-opacity"
            >
              {lp.ctaLabel} <ArrowRight className="w-5 h-5" />
            </a>
            <PaymentMethods className="mt-8" />
          </div>
        </section>
      </main>

      {/* Mobile sticky CTA — most social traffic is mobile */}
      <StickyCta
        label={lp.sampleFirst ? "See 5 Free Leads" : "Get 100 for $29"}
        free={lp.sampleFirst}
      />

      {/* Minimal footer — privacy/terms kept for ad-platform compliance */}
      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-6 flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground gap-3">
          <div>&copy; {new Date().getFullYear()} MapLeadExtractor. All rights reserved.</div>
          <nav className="flex gap-6">
            <a href="/privacy" className="hover:text-primary transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-primary transition-colors">Terms</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
