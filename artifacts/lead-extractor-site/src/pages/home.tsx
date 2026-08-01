import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Zap, Package, Shield, Clock, RefreshCw, CheckCircle2,
  ArrowRight, Phone, Mail, Globe, MapPin, Star, BadgeCheck,
  Download, MousePointerClick, Search, FileSpreadsheet,
  Rocket, TrendingUp, AlarmClock, DollarSign, BarChart2,
  Map, Facebook, Instagram, ChevronDown,
} from "lucide-react";
import { Show } from "@clerk/react";

import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ChatWidget from "@/components/chat-widget";
import { useSeo } from "@/lib/seo";
import { MobileNav } from "@/components/site/mobile-nav";
import LeadPackWidget from "@/components/site/lead-pack-widget";
import { BuyerReviews, PlatformReviews } from "@/components/site/landing-sections";
import { SocialProofToast, NavReviewPill } from "@/components/site/trust-badges";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// ─── Animation helpers ────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const PERFECT_FOR = [
  "SEO Agencies",
  "Website Designers",
  "Google Ads Agencies",
  "Facebook Ad Agencies",
  "Cold Email Agencies",
  "Appointment Setters",
  "Lead Generation Companies",
];

const DATA_FIELDS = [
  { icon: BadgeCheck, label: "Business Name" },
  { icon: Phone,      label: "Phone Number" },
  { icon: Globe,      label: "Website" },
  { icon: MapPin,     label: "Address" },
  { icon: Star,       label: "Google Rating" },
  { icon: BarChart2,  label: "Review Count" },
  { icon: Map,        label: "Business Category" },
  { icon: Mail,       label: "Publicly listed email (when available)" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: Search,
    title: "Choose an industry",
    desc: "Roofers, HVAC, Plumbers, Dentists, Lawyers, Restaurants, Real Estate, Electricians — any business type.",
  },
  {
    step: "02",
    icon: MapPin,
    title: "Choose any US city",
    desc: "Pick any city in the United States. We cover all 50 states.",
  },
  {
    step: "03",
    icon: MousePointerClick,
    title: "Click Extract",
    desc: "Your targeted business list is generated in minutes — 100 verified, human-reviewed leads.",
  },
  {
    step: "04",
    icon: FileSpreadsheet,
    title: "Export to Excel and start prospecting",
    desc: "Download a clean CSV, import it into any CRM, and start reaching out today.",
  },
];

const WHY_AGENCIES = [
  { icon: Rocket,      text: "Build prospect lists faster" },
  { icon: TrendingUp,  text: "Reach more businesses every day" },
  { icon: AlarmClock,  text: "Save hours of manual research" },
  { icon: DollarSign,  text: "Spend more time closing clients" },
  { icon: Download,    text: "Export clean lead lists" },
  { icon: Map,         text: "Search businesses nationwide" },
];

const FAQ = [
  {
    q: "Is it easy to use?",
    a: "Yes. Search, extract, and export in just a few clicks. No technical skills required.",
  },
  {
    q: "Can I export to Excel?",
    a: "Yes. Every pack downloads as a clean CSV that opens instantly in Excel, Google Sheets, or any CRM.",
  },
  {
    q: "Can I search any city?",
    a: "Yes. We cover every city in all 50 US states. Just pick your target market and we handle the rest.",
  },
  {
    q: "Can I search different industries?",
    a: "Yes. Any business type works — roofers, dentists, HVAC, lawyers, restaurants, real estate, and hundreds more.",
  },
  {
    q: "Is this good for agencies?",
    a: "It's designed specifically for agencies. You get clean, targeted business information ready for outreach — organized exactly how you need it.",
  },
  {
    q: "How fast do I get my leads?",
    a: "Most packs are delivered within hours of ordering. Every list is human-reviewed before it ships so you always get quality data.",
  },
  {
    q: "What if my pack comes up short?",
    a: "You get an automatic refund for the difference. You only ever pay for leads you actually receive.",
  },
];

// ─── Recent orders ticker ─────────────────────────────────────────────────────
function useRecentOrdersTicker() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`${basePath}/api/stripe/recent-orders-count?days=7`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { count: number } | null) => {
        if (cancelled || !data) return;
        setText(
          data.count > 0
            ? `${data.count} lead packs sold this week`
            : "New this week — be one of our first buyers"
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return text;
}

// ─── Hero lead card ───────────────────────────────────────────────────────────
function HeroLeadCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-12 rounded-full bg-primary/10 blur-3xl -z-10" aria-hidden />
      <div className="absolute inset-x-8 -top-3 h-full rounded-2xl border border-border/50 bg-card/30 rotate-[2.5deg]" aria-hidden />
      <div className="absolute inset-x-4 -top-1.5 h-full rounded-2xl border border-border/70 bg-card/50 rotate-[1.2deg]" aria-hidden />

      <div className="relative rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-black/60 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/50">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">roofers-dallas-tx.csv · row 1 of 100</span>
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center font-bold text-primary text-sm">SR</div>
              <div>
                <p className="font-bold text-sm leading-tight">Summit Roofing LLC</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />Roofing · Dallas, TX</p>
              </div>
            </div>
            <span className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 border border-primary/25 text-primary text-[11px] font-bold">
              <BadgeCheck className="w-3 h-3" /> Verified
            </span>
          </div>
          <div className="flex items-center gap-1 mb-4">
            {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
            <span className="text-xs font-semibold ml-1">4.9</span>
            <span className="text-xs text-muted-foreground">(187)</span>
          </div>
          <div className="space-y-2 text-xs">
            <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-primary" /><span className="font-mono">(214) 555-0173</span></p>
            <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-primary" /><span className="font-mono">contact@summitroofing.com</span></p>
            <p className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-primary" /><span className="font-mono">summitroofing.com</span></p>
          </div>
          <div className="flex items-center gap-1.5 mt-4 pt-3.5 border-t border-border">
            <span className="text-[11px] text-muted-foreground mr-1">Socials:</span>
            <span className="w-6 h-6 rounded bg-secondary flex items-center justify-center"><Facebook className="w-3 h-3" /></span>
            <span className="w-6 h-6 rounded bg-secondary flex items-center justify-center"><Instagram className="w-3 h-3" /></span>
            <span className="w-6 h-6 rounded bg-secondary flex items-center justify-center"><Globe className="w-3 h-3" /></span>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute -right-4 top-14 bg-card border border-primary/30 rounded-xl px-3 py-2 shadow-xl text-xs font-semibold flex items-center gap-1.5"
      >
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Delivered in 3h 22m
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.0, duration: 0.5 }}
        className="absolute -left-4 bottom-16 bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs flex items-center gap-1.5"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
        <span className="font-semibold">Human-reviewed</span>
      </motion.div>

      <p className="text-center text-[11px] text-muted-foreground mt-5">Example only — your pack contains 100 real businesses from your market.</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [chatOpen, setChatOpen] = useState(false);
  const chatFiredRef = useRef(false);
  const leadsSectionRef = useRef<HTMLElement>(null);
  const tickerText = useRecentOrdersTicker();

  // Auto-open chat after scrolling past the buy widget
  useEffect(() => {
    const el = leadsSectionRef.current;
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
    title: "Get More Clients. Find Local Business Leads in Minutes | Map Lead Extractor",
    description: "Map Lead Extractor helps marketing agencies build targeted business lead lists in minutes. Pick any industry and city, get 100 verified leads — names, phones, emails, websites. $29 one-time.",
    path: "/",
  });

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">

      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 border border-primary/30">
              <Zap className="w-4 h-4 text-primary" />
            </span>
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </a>
          <nav className="hidden md:flex gap-7 text-sm font-medium text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#leads-for-sale" className="text-primary hover:opacity-80 transition-opacity font-semibold">Get Leads</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <a href="/free-tool" className="hover:text-foreground transition-colors">Free Tool</a>
            <a href="/blog" className="hover:text-foreground transition-colors">Blog</a>
          </nav>
          <div className="flex items-center gap-3">
            <NavReviewPill />
            <Show when="signed-in">
              <a href="/dashboard" className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity">Dashboard</a>
            </Show>
            <Show when="signed-out">
              <a href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Sign In</a>
            </Show>
            <MobileNav />
            <Button asChild size="sm" className="font-bold">
              <a href="#leads-for-sale" data-testid="link-nav-buy-leads">
                <Package className="md:mr-2" />
                <span className="hidden md:inline">Get Leads — $29</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-16">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative pt-20 pb-28 overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.4)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,black,transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,hsl(var(--primary)/0.13),transparent)]" />
          </div>

          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">

              {/* Left: copy */}
              <motion.div initial="hidden" animate="visible" variants={stagger}>
                {tickerText && (
                  <motion.div variants={fadeUp} className="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="text-primary font-semibold">{tickerText}</span>
                  </motion.div>
                )}

                <motion.h1 variants={fadeUp} className="text-5xl md:text-[3.75rem] font-display font-bold leading-[1.08] tracking-tight mb-4">
                  Get More Clients.<br />
                  <span className="text-primary">Close More Deals.</span>
                </motion.h1>

                <motion.p variants={fadeUp} className="text-2xl font-semibold text-muted-foreground mb-4">
                  Find Local Business Leads in Minutes
                </motion.p>

                <motion.p variants={fadeUp} className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                  Stop spending hours searching Google Maps manually. Map Lead Extractor helps marketing agencies build targeted business lead lists in minutes — so you can spend more time selling and less time prospecting.
                </motion.p>

                <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 mb-6">
                  <Button asChild size="lg" className="h-14 px-8 text-base font-bold shadow-[0_0_40px_rgba(0,230,90,0.3)] hover:shadow-[0_0_60px_rgba(0,230,90,0.5)] hover:-translate-y-0.5 transition-all">
                    <a href="#leads-for-sale" data-testid="btn-hero-buy-leads">
                      <Package className="mr-2 h-5 w-5" /> Get 100 Leads — $29
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-14 px-8 text-base font-bold">
                    <a href="/free-tool" data-testid="btn-hero-free-tool">
                      <Search className="mr-2 h-5 w-5" /> Try Free Tool
                    </a>
                  </Button>
                </motion.div>

                <motion.div variants={fadeUp} className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {[
                    { icon: Shield, text: "Money-back guarantee" },
                    { icon: Clock,  text: "Delivered in hours" },
                    { icon: RefreshCw, text: "One-time payment" },
                  ].map(({ icon: Icon, text }) => (
                    <span key={text} className="flex items-center gap-1.5">
                      <Icon className="w-4 h-4 text-primary" />{text}
                    </span>
                  ))}
                </motion.div>
              </motion.div>

              {/* Right: lead card */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                className="hidden lg:block"
              >
                <HeroLeadCard />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Perfect For ───────────────────────────────────────────────────── */}
        <section className="border-y border-border bg-card/30 py-10">
          <div className="container mx-auto px-6">
            <p className="text-center text-xs font-bold uppercase tracking-[0.22em] text-primary mb-6">Perfect For</p>
            <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto">
              {PERFECT_FOR.map((item) => (
                <span key={item} className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Generate Thousands ────────────────────────────────────────────── */}
        <section className="py-24">
          <div className="container mx-auto px-6 max-w-5xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
              className="text-center mb-14"
            >
              <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">What You Get</motion.p>
              <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-5">
                Generate Thousands of<br />Local Business Leads
              </motion.h2>
              <motion.p variants={fadeUp} className="text-lg text-muted-foreground max-w-xl mx-auto">
                Search any city. Search any industry. Build highly targeted prospect lists in minutes.
              </motion.p>
            </motion.div>

            <p className="text-center text-sm text-muted-foreground mb-8 font-medium">Extract publicly available business information including:</p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {DATA_FIELDS.map(({ icon: Icon, label }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.45 }}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card/50 hover:border-primary/30 hover:bg-card transition-all"
                >
                  <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                    <Icon className="w-4.5 h-4.5 text-primary" />
                  </span>
                  <span className="text-sm font-medium leading-tight">{label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ──────────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-24 bg-card/20 border-y border-border">
          <div className="container mx-auto px-6 max-w-5xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">Simple Process</motion.p>
              <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-display font-bold tracking-tight">
                How It Works
              </motion.h2>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              {/* Connector line on desktop */}
              <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-border to-transparent" aria-hidden />

              {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }, i) => (
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="relative flex flex-col items-center text-center p-6 rounded-2xl border border-border bg-background hover:border-primary/30 transition-colors"
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
          </div>
        </section>

        {/* ── Why Agencies Love ─────────────────────────────────────────────── */}
        <section className="py-24">
          <div className="container mx-auto px-6 max-w-5xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
              className="text-center mb-14"
            >
              <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">Benefits</motion.p>
              <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-display font-bold tracking-tight">
                Why Agencies Love<br />Map Lead Extractor
              </motion.h2>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {WHY_AGENCIES.map(({ icon: Icon, text }, i) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.45 }}
                  className="flex items-center gap-4 p-5 rounded-xl border border-border bg-card/50 hover:border-primary/30 hover:bg-card transition-all"
                >
                  <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </span>
                  <span className="font-semibold text-sm leading-tight">{text}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Watch It Work (video placeholder) ────────────────────────────── */}
        <section className="py-24 bg-card/20 border-y border-border">
          <div className="container mx-auto px-6 max-w-4xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
              className="text-center mb-10"
            >
              <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">See It In Action</motion.p>
              <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
                Watch It Work
              </motion.h2>
              <motion.p variants={fadeUp} className="text-muted-foreground">
                See how to go from zero to 100 targeted leads in under 60 seconds.
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-2xl shadow-black/40"
            >
              <video
                src={`${basePath}/demo.mp4`}
                autoPlay
                muted
                loop
                playsInline
                controls
                className="w-full h-auto block"
              />
            </motion.div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        <section className="py-24">
          <div className="container mx-auto px-6 max-w-2xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
            >
              {/* Badge */}
              <motion.div variants={fadeUp} className="flex justify-center mb-8">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-sm font-bold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  Limited-Time Launch Offer
                </span>
              </motion.div>

              {/* Main pricing card */}
              <motion.div
                variants={fadeUp}
                className="rounded-2xl border border-primary/25 bg-card overflow-hidden shadow-[0_0_60px_rgba(0,230,90,0.1)]"
              >
                {/* Header */}
                <div className="bg-primary/10 border-b border-primary/20 px-8 py-6 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-2">Get Map Lead Extractor Today</p>
                  <div className="flex items-center justify-center gap-4 mb-1">
                    <span className="text-muted-foreground line-through text-xl">$297</span>
                    <span className="text-5xl font-display font-black text-foreground">$197</span>
                  </div>
                  <p className="text-primary font-bold text-lg">One-Time Payment</p>
                </div>

                {/* Body */}
                <div className="px-8 py-8 space-y-8">
                  {/* No recurring charges callout */}
                  <div className="flex flex-col sm:flex-row gap-3 text-center">
                    {["No monthly subscription.", "No recurring charges.", "Pay once and own your license."].map((text) => (
                      <div key={text} className="flex-1 rounded-xl border border-border bg-background/60 px-4 py-3 text-sm font-medium text-muted-foreground">
                        {text}
                      </div>
                    ))}
                  </div>

                  {/* What's Included */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-4">What's Included</p>
                    <ul className="space-y-3">
                      {[
                        "Lifetime access to the current version",
                        "Export to Excel",
                        "Search by business category",
                        "Search any city",
                        "Fast lead extraction",
                        "Future bug fixes",
                        "Customer support",
                      ].map((item) => (
                        <li key={item} className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className="w-4.5 h-4.5 text-primary shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Why Pay Monthly */}
                  <div className="rounded-xl border border-border bg-background/40 p-6">
                    <p className="font-bold mb-2">Why Pay Monthly?</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Most lead generation tools charge every month. With Map Lead Extractor, you pay once and keep using it.
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      If this software helps you land just one new client, it can easily <span className="text-primary">pay for itself.</span>
                    </p>
                  </div>

                  {/* Secure checkout note */}
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Shield className="w-4 h-4 text-primary shrink-0" />
                    <span><strong className="text-foreground">100% Secure Checkout.</strong> Processed through a secure payment system. Instant access after payment.</span>
                  </div>

                  {/* CTA */}
                  <div className="text-center space-y-3 pt-2">
                    <p className="font-bold text-lg">Ready to Find More Clients?</p>
                    <p className="text-sm text-muted-foreground">Stop spending hours searching manually. Start building targeted business lead lists today.</p>
                    <Button
                      asChild
                      size="lg"
                      className="w-full h-16 text-lg font-bold shadow-[0_0_40px_rgba(0,230,90,0.3)] hover:shadow-[0_0_60px_rgba(0,230,90,0.5)] hover:-translate-y-0.5 transition-all"
                    >
                      {/* Update this href to your $197 Stripe payment link */}
                      <a href="#leads-for-sale" data-testid="btn-pricing-buy">
                        BUY NOW — $197 <ArrowRight className="ml-2 h-5 w-5" />
                      </a>
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      One-time payment &nbsp;·&nbsp; No monthly fees &nbsp;·&nbsp; Instant access after purchase
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── Imagine This ──────────────────────────────────────────────────── */}
        <section className="py-24">
          <div className="container mx-auto px-6 max-w-3xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
              className="text-center"
            >
              <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">Think About It</motion.p>
              <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-8">
                Imagine This…
              </motion.h2>
              <motion.div variants={fadeUp} className="rounded-2xl border border-primary/20 bg-card/60 p-8 md:p-12 space-y-5 text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" aria-hidden />
                <p className="text-lg font-semibold text-foreground relative">
                  One new marketing client could be worth <span className="text-primary">hundreds or thousands of dollars per month.</span>
                </p>
                <p className="text-muted-foreground leading-relaxed relative text-lg">
                  Instead of spending hours looking for prospects on Google Maps manually…
                </p>
                <p className="text-foreground font-bold text-2xl relative">
                  Spend <span className="text-primary">minutes</span> finding them.
                </p>
                <motion.div variants={fadeUp} className="pt-4 relative">
                  <Button asChild size="lg" className="h-14 px-10 text-base font-bold shadow-[0_0_40px_rgba(0,230,90,0.3)] hover:shadow-[0_0_60px_rgba(0,230,90,0.5)] hover:-translate-y-0.5 transition-all">
                    <a href="#leads-for-sale">
                      Get 100 Leads — $29 <ArrowRight className="ml-2 h-5 w-5" />
                    </a>
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── Buy ───────────────────────────────────────────────────────────── */}
        <section id="leads-for-sale" ref={leadsSectionRef} className="py-24 bg-card/20 border-y border-border">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">Ready to Start?</p>
              <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
                Get Your Lead Pack Now
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Tell us your industry and city. Preview 5 real leads free — then grab all 100 for $29 if they look like money.
              </p>
            </div>
            <LeadPackWidget />
          </div>
        </section>

        {/* ── Reviews ───────────────────────────────────────────────────────── */}
        <PlatformReviews />
        <BuyerReviews />

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        <section id="faq" className="py-24 bg-card/20 border-y border-border">
          <div className="container mx-auto px-6 max-w-3xl">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">Got Questions?</p>
              <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
                Frequently Asked Questions
              </h2>
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
        <section className="py-28 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_50%,hsl(var(--primary)/0.12),transparent)]" />
          </div>
          <div className="container mx-auto px-6 text-center max-w-2xl">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={stagger}
            >
              <motion.p variants={fadeUp} className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">Ready to Grow?</motion.p>
              <motion.h2 variants={fadeUp} className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-5">
                Ready to Get<br />More Clients?
              </motion.h2>
              <motion.p variants={fadeUp} className="text-lg text-muted-foreground mb-10">
                Stop wasting time searching. Start finding your next customers today.
              </motion.p>
              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="h-16 px-12 text-lg font-bold shadow-[0_0_50px_rgba(0,230,90,0.4)] hover:shadow-[0_0_80px_rgba(0,230,90,0.6)] hover:-translate-y-1 transition-all">
                  <a href="#leads-for-sale" data-testid="btn-final-cta">
                    Get 100 Leads — $29 <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-16 px-12 text-lg font-bold">
                  <a href="/free-tool">
                    Try Free Tool First
                  </a>
                </Button>
              </motion.div>
              <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" />Fast</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" />Easy</span>
                <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-primary" />Secure Checkout</span>
                <span className="flex items-center gap-1.5"><RefreshCw className="w-4 h-4 text-primary" />Regular Software Updates</span>
              </motion.div>
            </motion.div>
          </div>
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-card/30">
        <div className="container mx-auto px-6 py-12">
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            <div>
              <a href="/" className="flex items-center gap-2 font-display font-bold text-lg tracking-tight mb-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/15 border border-primary/30">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                </span>
                Map<span className="text-primary">Lead</span>Extractor
              </a>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Spend Less Time Searching.<br />Spend More Time Closing.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-3">Product</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#leads-for-sale" className="hover:text-primary transition-colors">Get Leads</a></li>
                <li><a href="/free-tool" className="hover:text-primary transition-colors">Free Tool</a></li>
                <li><a href="/pricing" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="/blog" className="hover:text-primary transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold mb-3">Support</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#faq" className="hover:text-primary transition-colors">FAQ</a></li>
                <li><a href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="mailto:support@mapleadextractor.net" className="hover:text-primary transition-colors">Contact Support</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-6 mb-4">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-primary" />256-bit SSL · Powered by Stripe</span>
              <span className="flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 text-primary" />Money-back if we come up short</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-primary" />Every lead human-reviewed</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" />Delivered within 24 hours</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground gap-2">
            <div>&copy; {new Date().getFullYear()} MapLeadExtractor. All rights reserved.</div>
            <div className="flex items-center gap-5">
              <a href="/admin-login" rel="nofollow" className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">Admin</a>
            </div>
          </div>
        </div>
      </footer>

      <SocialProofToast />
      <ChatWidget externalOpen={chatOpen} onExternalOpenHandled={() => setChatOpen(false)} />
    </div>
  );
}
