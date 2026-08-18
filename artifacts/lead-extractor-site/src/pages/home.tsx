import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Zap, Shield, Clock, CheckCircle2, ArrowRight, Phone, Mail, Globe,
  MapPin, Star, BadgeCheck, BarChart2, FileSpreadsheet, Eye, Lock, Map,
  Search, Gauge, MessageSquare, Target, Sparkles, Building2, ScrollText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ChatWidget from "@/components/chat-widget";
import { useSeo } from "@/lib/seo";
import LeadPackWidget from "@/components/site/lead-pack-widget";
import StickyCta from "@/components/site/sticky-cta";
import TrustBadges from "@/components/site/trust-badges";
import { BuyerReviews, PlatformReviews } from "@/components/site/landing-sections";
import { SocialProofToast } from "@/components/site/trust-badges";

const SUPPORT_EMAIL = "support@mapleadextractor.net";

// ─── Animation helpers ────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

// ─── Data ─────────────────────────────────────────────────────────────────────
// Accurate field list — email is explicitly conditional so we never imply every
// record has one. Keep in sync with the widget + trust-badges copy.
const DATA_FIELDS = [
  { icon: BadgeCheck, label: "Business name" },
  { icon: Phone,      label: "Phone number" },
  { icon: Globe,      label: "Website" },
  { icon: MapPin,     label: "Address" },
  { icon: Star,       label: "Google rating" },
  { icon: BarChart2,  label: "Review count" },
  { icon: Map,        label: "Business category" },
  { icon: Mail,       label: "Publicly listed email (when available)" },
];

const TRUST_BULLETS = [
  { icon: Gauge,  text: "Every lead scored 0–100 by opportunity" },
  { icon: Globe,  text: "Website audits find the businesses that need help" },
  { icon: Eye,    text: "Preview real matching leads free — no card" },
];

// The four things the software does — the core of the new positioning.
const CAPABILITIES = [
  { icon: Search,        title: "Finds local leads",   desc: "Pull targeted businesses by industry and area from Google, Bing & Yelp — names, phones, websites, ratings and more." },
  { icon: Gauge,         title: "Scores the opportunity", desc: "Each lead gets a 0–100 opportunity score with plain-English reasons — no website, weak site, few reviews, no booking." },
  { icon: Globe,         title: "Audits their website", desc: "Grades each site A–F on headline, call-to-action, mobile, quote form, call button and SEO — so you lead with a real gap." },
  { icon: MessageSquare, title: "Writes your messages", desc: "Drafts Facebook, email, phone and follow-up messages you review and approve before anything is ever sent." },
];

// Software-first flow (find → score → audit → reach out).
const HOW_IT_WORKS = [
  { step: "01", icon: MapPin,        title: "Pick industry & area",   desc: "Choose a business type and a state — or go nationwide. For example: roofers in Pensacola, FL." },
  { step: "02", icon: Gauge,         title: "See who needs you most", desc: "Leads come back scored by opportunity and graded on their website, so the best-fit businesses rise to the top." },
  { step: "03", icon: MessageSquare, title: "Reach out with a plan",  desc: "Get an AI-picked offer and ready-to-approve messages, then work your follow-ups from one daily to-do list." },
];

// Who it's for.
const USE_CASES = [
  { icon: Globe,      title: "Web designers",     desc: "Find businesses with no site or a weak one — the audit hands you the pitch." },
  { icon: BarChart2,  title: "SEO & marketers",   desc: "Spot low-review, low-visibility businesses that need to be found online." },
  { icon: Target,     title: "Ad agencies",       desc: "Target businesses already running ads — warmer leads with real budget." },
  { icon: Phone,      title: "Appointment setters", desc: "Work a scored list with phone scripts and follow-up dates built in." },
  { icon: Building2,  title: "Local service pros", desc: "Offer booking, reviews or missed-call text-back to nearby businesses." },
  { icon: FileSpreadsheet, title: "Lead resellers", desc: "Export clean, de-duplicated lists by industry and area to sell on." },
];

const FAQ = [
  {
    q: "What exactly do I receive?",
    a: "A clean CSV of up to 100 targeted local businesses in your chosen industry and area — including available business names, phone numbers, websites, publicly listed emails (when available), Google ratings, review counts, addresses, and public social links. Not every business publishes an email, so emails are included only where they're publicly listed.",
  },
  {
    q: "What does it cost?",
    a: "$29, one time, for 100 leads. There's no subscription and no account required — Stripe collects the email your CSV is sent to.",
  },
  {
    q: "How do I choose my industry and location?",
    a: "Use the form at the top of the page: pick a business type, then pick a state (or leave it nationwide). You'll see how many matching leads are available before you pay.",
  },
  {
    q: "Can I see real leads before I buy?",
    a: "Yes. Choose your industry and location and click \"Show My 5 Free Leads\" to preview five matching businesses. Enter your email to unlock their full phone and email — completely free, no card needed.",
  },
  {
    q: "How fast do I get my pack?",
    a: "Your CSV is emailed after a real person reviews it for quality — usually within a few hours, and never more than 24 hours.",
  },
  {
    q: "What if you come up short?",
    a: "If we deliver fewer than 100 leads, the difference is automatically refunded to your card. You only ever pay for leads you actually receive.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [chatOpen, setChatOpen] = useState(false);
  const chatFiredRef = useRef(false);
  const funnelRef = useRef<HTMLElement>(null);

  // Auto-open chat once the funnel has scrolled out of view.
  useEffect(() => {
    const el = funnelRef.current;
    if (!el) return;
    let hasBeenVisible = false;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { hasBeenVisible = true; }
      else if (hasBeenVisible && !chatFiredRef.current) {
        chatFiredRef.current = true;
        setTimeout(() => setChatOpen(true), 600);
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // FAQ schema
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "faqpage-jsonld-home";
    script.text = JSON.stringify(schema);
    document.getElementById("faqpage-jsonld-home")?.remove();
    document.head.appendChild(script);
    return () => { document.getElementById("faqpage-jsonld-home")?.remove(); };
  }, []);

  useSeo({
    title: "Find Local Businesses That Need Your Service | MapLeadExtractor",
    description: "MapLeadExtractor finds local leads, scores their opportunity, audits their websites, and writes your follow-up messages so you know who to contact first. Preview real matching leads free.",
    path: "/",
  });

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">

      {/* ── Minimal paid-traffic header ──────────────────────────────────────── */}
      <header className="sticky top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-lg sm:text-xl tracking-tight hover:opacity-90 transition-opacity">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 border border-primary/30">
              <Zap className="w-4 h-4 text-primary" />
            </span>
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </a>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Lock className="w-3.5 h-3.5 text-primary" /> Secure Stripe checkout
            </span>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="link-header-support">
              Support
            </a>
          </div>
        </div>
      </header>

      <main>

        {/* ── Hero: copy + price (left) · funnel (right) ─────────────────────── */}
        <section
          ref={funnelRef}
          id="leads-for-sale"
          className="relative pt-8 lg:pt-12 pb-16 overflow-hidden scroll-mt-20"
        >
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.4)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,hsl(var(--primary)/0.12),transparent)]" />
          </div>

          <div className="container mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start max-w-6xl mx-auto">

              {/* Left: the offer */}
              <motion.div initial="hidden" animate="visible" variants={stagger} className="lg:pt-6">
                <motion.div variants={fadeUp} className="inline-flex items-center gap-2 mb-5 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  <span className="text-primary font-semibold">Find · Score · Audit · Message</span>
                </motion.div>

                <motion.h1 variants={fadeUp} className="text-4xl md:text-5xl font-display font-bold leading-[1.08] tracking-tight mb-4">
                  Find Local Businesses That Need Your Service <span className="text-primary">Before Your Competitors Do</span>
                </motion.h1>

                <motion.p variants={fadeUp} className="text-lg text-muted-foreground leading-relaxed mb-6 max-w-lg">
                  MapLeadExtractor finds local leads, scores their opportunity, audits their websites, and
                  writes your follow-up messages — so you know exactly who to contact first.
                </motion.p>

                <motion.ul variants={fadeUp} className="space-y-2.5 mb-8">
                  {TRUST_BULLETS.map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-center gap-2.5 text-[15px] font-medium">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/12 border border-primary/25 shrink-0">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                      </span>
                      {text}
                    </li>
                  ))}
                </motion.ul>

                {/* On mobile the form is directly below; this jump is a desktop nicety */}
                <motion.div variants={fadeUp} className="hidden lg:flex items-center gap-3">
                  <Button asChild size="lg" className="h-14 px-8 text-base font-bold shadow-[0_0_40px_rgba(0,230,90,0.25)] hover:-translate-y-0.5 transition-all">
                    <a href="#leads-for-sale" data-testid="btn-hero-scroll">
                      <Search className="mr-2 h-5 w-5" /> Find Leads Now
                    </a>
                  </Button>
                  <a href="/pricing" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">See plans →</a>
                </motion.div>
              </motion.div>

              {/* Right: the funnel widget (starts with the target form) */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
              >
                <LeadPackWidget hidePrice />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── What the software does + demo preview ─────────────────────────── */}
        <section id="demo" className="py-16 md:py-20 scroll-mt-20">
          <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">Your AI lead team</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-4">Find the right businesses, then reach out first</h2>
              <p className="text-base text-muted-foreground max-w-2xl mx-auto">
                MapLeadExtractor does the research for you — surfacing the businesses most likely to need your service and handing you the pitch.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-10 items-center">
              {/* Capabilities */}
              <div className="grid sm:grid-cols-2 gap-4">
                {CAPABILITIES.map(({ icon: Icon, title, desc }, i) => (
                  <motion.div
                    key={title}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    className="p-5 rounded-2xl border border-border bg-card/40 hover:border-primary/30 transition-colors"
                  >
                    <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 mb-3">
                      <Icon className="w-5 h-5 text-primary" />
                    </span>
                    <h3 className="font-bold text-base mb-1">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </motion.div>
                ))}
              </div>

              {/* Product preview mock (representative — not a live account) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden"
              >
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-background/60">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
                  <span className="ml-2 text-xs text-muted-foreground flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-primary" /> AI Command Center</span>
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background/60">
                    <div>
                      <div className="font-semibold">Gulf Coast Roofing Co.</div>
                      <div className="text-xs text-muted-foreground">Mobile, AL · Roofing</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Opportunity</div>
                      <div className="font-bold text-primary text-lg leading-none">92</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-red-100 text-red-700 border border-red-200">Site grade F</span>
                    <span className="px-2 py-0.5 rounded-md text-xs bg-muted text-muted-foreground border border-border">No quote form</span>
                    <span className="px-2 py-0.5 rounded-md text-xs bg-muted text-muted-foreground border border-border">Not mobile-ready</span>
                    <span className="px-2 py-0.5 rounded-md text-xs bg-muted text-muted-foreground border border-border">Few reviews</span>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <div className="text-xs font-semibold text-primary mb-1">Recommended offer · Website rebuild</div>
                    <div className="text-xs text-muted-foreground">No mobile site and no way to request a quote — a clean rebuild puts them ahead of local competitors.</div>
                  </div>
                  <div className="p-3 rounded-xl border border-border bg-background/60">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-muted-foreground">Message draft · needs your approval</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">Not sent</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      "Hi — I came across Gulf Coast Roofing and noticed your site isn't mobile-friendly yet. A lot of roofing searches happen on phones. Happy to show you a quick fix if useful?"
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-6">Preview shown for illustration. Your results are built from real, publicly available business data.</p>
          </div>
        </section>

        {/* ── What's in every lead ──────────────────────────────────────────── */}
        <section className="py-16 md:py-20 bg-card/20 border-y border-border">
          <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">What you receive</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-4">Every field in your CSV</h2>
              <p className="text-base text-muted-foreground max-w-xl mx-auto">
                Publicly available business information, structured and de-duplicated — ready to drop into any CRM or dialer.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {DATA_FIELDS.map(({ icon: Icon, label }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border bg-background/60 hover:border-primary/30 transition-colors"
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </span>
                  <span className="text-sm font-medium leading-tight">{label}</span>
                </motion.div>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mt-6">
              Not every business publishes an email — emails are included only where they're publicly listed.
            </p>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">Simple process</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">How it works</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6 relative">
              <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />
              {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.45 }}
                  className="relative flex flex-col items-center text-center p-6 rounded-2xl border border-border bg-card/40 hover:border-primary/30 transition-colors"
                >
                  <div className="relative mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">
                      {step}
                    </span>
                  </div>
                  <h3 className="font-bold text-base mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
            <div className="text-center mt-10">
              <Button asChild size="lg" className="h-14 px-10 text-base font-bold shadow-[0_0_40px_rgba(0,230,90,0.25)] hover:-translate-y-0.5 transition-all">
                <a href="#leads-for-sale" data-testid="btn-howitworks-cta">
                  Show My 5 Free Leads <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Who it's for ──────────────────────────────────────────────────── */}
        <section className="py-16 md:py-20 bg-card/20 border-y border-border">
          <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">Who it's for</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Built for anyone selling to local businesses</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {USE_CASES.map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className="p-5 rounded-2xl border border-border bg-background/60 hover:border-primary/30 transition-colors"
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 mb-3">
                    <Icon className="w-4 h-4 text-primary" />
                  </span>
                  <h3 className="font-bold text-sm mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Trust badges ──────────────────────────────────────────────────── */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">Buy with confidence</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Why it's safe to order</h2>
            </div>
            <TrustBadges />
          </div>
        </section>

        {/* ── Social proof ──────────────────────────────────────────────────── */}
        <PlatformReviews />
        <BuyerReviews />

        {/* ── Pricing teaser ────────────────────────────────────────────────── */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 sm:px-6 max-w-5xl">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">Simple pricing</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-3">Start free, or grab a ready-made pack</h2>
              <p className="text-base text-muted-foreground max-w-2xl mx-auto">
                Software plans from <span className="font-semibold text-foreground">$49/mo</span> for finding, scoring and auditing leads yourself — or buy a done-for-you CSV pack from <span className="font-semibold text-foreground">$29</span>, no account needed.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {[
                { name: "Starter", price: "$49", note: "250 leads/mo · CRM · scoring" },
                { name: "Pro", price: "$149", note: "2,000 leads/mo · audits · messages", highlight: true },
                { name: "Agency", price: "$499", note: "10,000 leads/mo · automation · team" },
              ].map((p) => (
                <div key={p.name} className={`rounded-2xl border p-5 text-center ${p.highlight ? "border-primary bg-card shadow-lg shadow-primary/10" : "border-border bg-card/40"}`}>
                  <div className="font-display font-bold">{p.name}</div>
                  <div className="text-3xl font-display font-bold my-1">{p.price}<span className="text-sm text-muted-foreground font-normal">/mo</span></div>
                  <div className="text-xs text-muted-foreground">{p.note}</div>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Button asChild size="lg" variant="outline" className="h-12 px-8 font-semibold">
                <a href="/pricing">See full pricing <ArrowRight className="ml-2 h-4 w-4" /></a>
              </Button>
            </div>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <section className="py-16 md:py-20 bg-card/20 border-y border-border">
          <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
            <div className="text-center mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">Before you buy</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Questions, answered</h2>
            </div>
            <Accordion type="single" collapsible className="space-y-3">
              {FAQ.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border border-border rounded-xl bg-background px-6 data-[state=open]:border-primary/30 transition-colors"
                >
                  <AccordionTrigger className="text-left font-semibold hover:no-underline py-5 gap-4">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────────── */}
        <section className="py-20 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,hsl(var(--primary)/0.12),transparent)]" />
          </div>
          <div className="container mx-auto px-4 sm:px-6 text-center max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight mb-4">
              Preview your leads free
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Choose your industry and location, see five real matching businesses, then get all 100 for $29.
            </p>
            <Button asChild size="lg" className="h-16 px-12 text-lg font-bold shadow-[0_0_50px_rgba(0,230,90,0.35)] hover:shadow-[0_0_80px_rgba(0,230,90,0.55)] hover:-translate-y-1 transition-all">
              <a href="#leads-for-sale" data-testid="btn-final-cta">
                Show My 5 Free Leads <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" />One-time $29</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" />Delivered within 24 hours</span>
              <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary" />Secure Stripe checkout</span>
            </div>
          </div>
        </section>

        {/* ── Compliance note ───────────────────────────────────────────────── */}
        <section className="py-10 border-t border-border">
          <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
            <div className="flex items-start gap-3 text-sm text-muted-foreground bg-card/40 border border-border rounded-xl p-5">
              <ScrollText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <span className="font-semibold text-foreground">How we keep it clean:</span> MapLeadExtractor gathers only
                publicly available business information. Outreach messages are drafts you review and send yourself — you
                choose who to contact, and opt-out requests are always honored. We don't send spam on your behalf and we
                never promise guaranteed income or results.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* ── Minimal footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card/30">
        <div className="container mx-auto px-4 sm:px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <a href="/" className="flex items-center gap-2 font-display font-bold text-lg tracking-tight">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/15 border border-primary/30">
                <Zap className="w-3.5 h-3.5 text-primary" />
              </span>
              Map<span className="text-primary">Lead</span>Extractor
            </a>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <a href="/privacy" className="hover:text-primary transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-primary transition-colors">Terms</a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-primary transition-colors">Contact Support</a>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground gap-2">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-primary" />256-bit SSL · Powered by Stripe</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" />Every lead human-reviewed</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" />Delivered within 24 hours</span>
            </div>
            <div className="flex items-center gap-4">
              <span>&copy; {new Date().getFullYear()} MapLeadExtractor</span>
              <a href="/admin-login" rel="nofollow" className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">Admin</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile sticky CTA — appears only once the funnel scrolls out of view */}
      <StickyCta free label="Show 5 Free Leads" target="leads-for-sale" />

      <SocialProofToast />
      <ChatWidget externalOpen={chatOpen} onExternalOpenHandled={() => setChatOpen(false)} />
    </div>
  );
}
