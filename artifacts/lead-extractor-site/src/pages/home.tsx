import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Map, Zap, Users, Settings2, Code2, Star, MapPin, Building2,
  Calendar, Share2, TrendingUp, Mail, Globe, CheckCircle2, Package,
  ArrowRight, Phone, BadgeCheck, Facebook, Instagram, Shield,
  Clock, RefreshCw, ChevronRight,
} from "lucide-react";
import { SiGoogle, SiGooglechrome, SiFacebook } from "react-icons/si";
import { Show } from "@clerk/react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ChatWidget from "@/components/chat-widget";
import { useSeo } from "@/lib/seo";
import { industryPages } from "@/data/landing-pages";
import { MobileNav } from "@/components/site/mobile-nav";
import LeadPackWidget from "@/components/site/lead-pack-widget";
import { BuyerReviews, PlatformReviews } from "@/components/site/landing-sections";

const STORE_URL = "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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

const FAQ = [
  { q: "How fast do I get my leads?", a: "Most packs are delivered within hours of ordering. Every list is human-reviewed before it ships, so at busy times it can take a little longer — but it arrives as a clean CSV in your email inbox, ready to import into any CRM or spreadsheet." },
  { q: "What's included with each lead?", a: "Business name, phone number, website, address, star rating and review count, and business category — plus a public email address when one can be found on the business's website. Each lead also carries the gap signal you bought it for, like \"no website\" or \"few reviews\", so you know exactly what to pitch." },
  { q: "What if my pack comes up short?", a: "You get an automatic refund for the difference. If you order 100 leads and we can only deliver 82 that pass review, you're refunded for the 18 we couldn't fill — you only ever pay for leads you actually receive." },
  { q: "Where do the leads come from?", a: "Public business listings on Google Maps and Bing Maps, enriched with contact details from each business's own website. Dead and closed businesses are removed, duplicates are stripped, and every list is spot-checked by a human before delivery." },
  { q: "Can I pick the industry and location?", a: "Yes — tell us any business type and any US city or state (for example \"roofers in Mobile, AL\") and the list is built to that spec. If you're not sure what to target, the industry pages below show what sells best for each vertical." },
];

const fadeIn = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
};
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.09 } },
};

/** Compact mock of one delivered lead card — used in the hero */
function HeroLeadCard() {
  return (
    <div className="relative">
      {/* Glow behind the card */}
      <div className="absolute -inset-12 rounded-full bg-primary/10 blur-3xl -z-10" aria-hidden />

      {/* Stack layers */}
      <div className="absolute inset-x-8 -top-3 h-full rounded-2xl border border-border/50 bg-card/30 rotate-[2.5deg]" aria-hidden />
      <div className="absolute inset-x-4 -top-1.5 h-full rounded-2xl border border-border/70 bg-card/50 rotate-[1.2deg]" aria-hidden />

      <div className="relative rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-black/60 overflow-hidden">
        {/* CSV chrome */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/50">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">roofers-tampa-fl.csv · row 1 of 100</span>
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center font-bold text-primary text-sm">RR</div>
              <div>
                <p className="font-bold text-sm leading-tight">Riverside Roofing Co.</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />Roofing · Tampa, FL</p>
              </div>
            </div>
            <span className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-primary/15 border border-primary/25 text-primary text-[11px] font-bold">
              <BadgeCheck className="w-3 h-3" /> Score 94
            </span>
          </div>

          <div className="flex items-center gap-1 mb-4">
            {[1,2,3,4,5].map(s => <Star key={s} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
            <span className="text-xs font-semibold ml-1">4.8</span>
            <span className="text-xs text-muted-foreground">(214)</span>
          </div>

          <div className="space-y-2 text-xs">
            <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-primary" /><span className="font-mono">(813) 555-0142</span></p>
            <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-primary" /><span className="font-mono">office@riversideroofing.com</span></p>
            <p className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-primary" /><span className="font-mono">riversideroofing.com</span></p>
          </div>

          <div className="flex items-center gap-1.5 mt-4 pt-3.5 border-t border-border">
            <span className="text-[11px] text-muted-foreground mr-1">Socials:</span>
            <span className="w-6 h-6 rounded bg-secondary flex items-center justify-center"><Facebook className="w-3 h-3" /></span>
            <span className="w-6 h-6 rounded bg-secondary flex items-center justify-center"><Instagram className="w-3 h-3" /></span>
            <span className="w-6 h-6 rounded bg-secondary flex items-center justify-center"><Globe className="w-3 h-3" /></span>
          </div>
        </div>
      </div>

      {/* Floating proof chips */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="absolute -right-4 top-16 bg-card border border-primary/30 rounded-xl px-3 py-2 shadow-xl text-xs font-semibold flex items-center gap-1.5"
      >
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Delivered in 2h 14m
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1.0, duration: 0.5 }}
        className="absolute -left-4 bottom-20 bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs flex items-center gap-1.5"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
        <span className="font-semibold">Human-reviewed</span>
      </motion.div>

      <p className="text-center text-xs text-muted-foreground mt-5">Example of a delivered lead — your pack has 100 from your exact market.</p>
    </div>
  );
}

export default function Home() {
  const [chatOpen, setChatOpen] = useState(false);
  const chatFiredRef = useRef(false);
  const leadsSectionRef = useRef<HTMLElement>(null);
  const tickerText = useRecentOrdersTicker();

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
    title: "Buy Local Business Leads — Human-Reviewed Lists by Industry & City | Map Lead Extractor",
    description: "Done-for-you local business lead lists: pick an industry and city, get a clean, human-reviewed CSV — names, phones, emails, websites & ratings. 100 targeted leads for $29, delivered in hours.",
    path: "/",
  });

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 border border-primary/30">
              <Zap className="w-4 h-4 text-primary" />
            </span>
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </a>
          <nav className="hidden md:flex gap-7 text-sm font-medium text-muted-foreground">
            <a href="#leads-for-sale" className="text-primary hover:opacity-80 transition-opacity font-semibold">Buy Leads</a>
            <a href="#industries" className="hover:text-foreground transition-colors">Industries</a>
            <a href="/free-tool" className="hover:text-foreground transition-colors">Free Tool</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="/blog" className="hover:text-foreground transition-colors">Blog</a>
            <a href="/tools" className="hover:text-foreground transition-colors">Calculators</a>
          </nav>
          <div className="flex items-center gap-3">
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
                <span className="hidden md:inline">Get Leads</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-16">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative pt-20 pb-28 overflow-hidden">
          {/* Background grid + glow */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.4)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.4)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_70%_at_50%_0%,black,transparent)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,hsl(var(--primary)/0.13),transparent)]" />
          </div>

          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">

              {/* Left: copy */}
              <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
                {tickerText && (
                  <motion.div variants={fadeIn} className="inline-flex items-center gap-2 mb-6 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="text-primary font-semibold">{tickerText}</span>
                  </motion.div>
                )}

                <motion.h1 variants={fadeIn} className="text-5xl md:text-[3.75rem] font-display font-bold leading-[1.08] tracking-tight mb-6">
                  Stop building lists.<br />
                  <span className="text-primary">Start closing deals.</span>
                </motion.h1>

                <motion.p variants={fadeIn} className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                  Tell us your industry and city — we deliver <strong className="text-foreground">100 verified local businesses</strong> with direct phones, emails, websites, and ratings. Clean CSV, in your inbox, usually within hours.
                </motion.p>

                {/* Trust chips */}
                <motion.div variants={fadeIn} className="flex flex-wrap gap-2 mb-8">
                  {[
                    { icon: Shield, text: "Money-back guarantee" },
                    { icon: Clock, text: "Delivered in hours" },
                    { icon: RefreshCw, text: "No subscription" },
                  ].map(({ icon: Icon, text }) => (
                    <span key={text} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card/60 text-xs font-medium text-muted-foreground">
                      <Icon className="w-3.5 h-3.5 text-primary" />{text}
                    </span>
                  ))}
                </motion.div>

                <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-3">
                  <Button asChild size="lg" className="h-14 px-8 text-base font-bold shadow-[0_0_40px_rgba(0,230,90,0.3)] hover:shadow-[0_0_60px_rgba(0,230,90,0.5)] hover:-translate-y-0.5 transition-all">
                    <a href="#leads-for-sale" data-testid="btn-hero-buy-leads">
                      <Package className="mr-2 h-5 w-5" /> Get 100 Leads — $29
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-14 px-8 text-base font-bold">
                    <a href="/free-tool" data-testid="btn-hero-free-tool">
                      <SiGooglechrome className="mr-2 h-5 w-5" /> Try Free Tool
                    </a>
                  </Button>
                </motion.div>

                <motion.p variants={fadeIn} className="mt-4 text-xs text-muted-foreground">
                  🚀 Founding buyers lock in $29/pack and get priority delivery.
                </motion.p>
              </motion.div>

              {/* Right: lead card visual */}
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

        {/* ── Stats bar ────────────────────────────────────────────────────── */}
        <section className="border-y border-border bg-card/30">
          <div className="container mx-auto px-6 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {[
                { value: "100", suffix: " leads", label: "in every pack" },
                { value: "29¢", suffix: "", label: "per verified lead" },
                { value: "All 50", suffix: "", label: "US states covered" },
                { value: "<24h", suffix: "", label: "max delivery time" },
              ].map((s, i) => (
                <div key={s.label} className={`text-center ${i > 0 ? "md:border-l md:border-border" : ""}`}>
                  <div className="text-2xl md:text-3xl font-display font-bold tracking-tight">
                    <span className="text-primary">{s.value}</span>{s.suffix}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Lead types + widget ──────────────────────────────────────────── */}
        <section id="leads-for-sale" ref={leadsSectionRef as React.RefObject<HTMLElement>} className="py-24 relative">
          <div className="container mx-auto px-6 max-w-6xl">

            {/* Header */}
            <div className="text-center mb-14">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/25">💰 Leads For Sale</Badge>
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 tracking-tight">
                Every lead is a business<br className="hidden sm:block" /> with a gap you can fill.
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                We score and filter by the specific problem — so you know exactly what to pitch before you dial.
              </p>
            </div>

            {/* Two-column: lead types left, widget right */}
            <div className="grid lg:grid-cols-2 gap-10 items-start mb-16">

              {/* Lead type list */}
              <div className="space-y-3">
                {[
                  { icon: Globe,      title: "No-Website Businesses",  desc: "The easiest web-design sale there is.",        pill: "Sell: websites" },
                  { icon: Code2,      title: "Outdated / Broken Sites", desc: "Dead, non-mobile, or years out of date.",      pill: "Sell: redesigns" },
                  { icon: Star,       title: "Few or No Reviews",       desc: "Wide open for reputation building.",            pill: "Sell: reputation" },
                  { icon: TrendingUp, title: "Low-Rating Businesses",   desc: "Under 4 stars — owners actively hurting.",     pill: "Sell: mgmt" },
                  { icon: Share2,     title: "No Social Presence",      desc: "No Facebook, Instagram, or socials yet.",      pill: "Sell: social" },
                  { icon: Calendar,   title: "No Online Booking",       desc: "Ready for scheduling and automation tools.",   pill: "Sell: automation" },
                  { icon: MapPin,     title: "Weak Map Profiles",       desc: "Incomplete Google/Bing listings.",             pill: "Sell: local SEO" },
                  { icon: Building2,  title: "By Industry",            desc: "Dentists, roofers, HVAC, plumbers & more.",    pill: "High-LTV verticals" },
                  { icon: Map,        title: "By Territory",            desc: "Any US state or city — your exact market.",    pill: "Pick your area" },
                ].map((lead) => (
                  <motion.div
                    key={lead.title}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeIn}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/40 hover:border-primary/30 hover:bg-card transition-all group"
                  >
                    <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <lead.icon className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm leading-tight">{lead.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{lead.desc}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary whitespace-nowrap">
                      {lead.pill}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Widget — sticky on scroll */}
              <div className="lg:sticky lg:top-24">
                <div className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur p-6 shadow-2xl shadow-black/40">
                  <div className="mb-5 text-center">
                    <p className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Instant order</p>
                    <h3 className="text-2xl font-display font-bold">Build your lead pack</h3>
                    <p className="text-sm text-muted-foreground mt-1">Pick an industry and state — preview 5 free leads, then check out securely.</p>
                  </div>
                  <LeadPackWidget />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Industries ───────────────────────────────────────────────────── */}
        <section id="industries" className="py-20 bg-card/20 border-y border-border">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
              <div>
                <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Shop by industry.</h2>
                <p className="text-muted-foreground mt-2">Targeted lead lists for every vertical — built to your exact market.</p>
              </div>
              <a href="/pricing" className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity flex items-center gap-1 shrink-0">
                See pricing <ChevronRight className="w-4 h-4" />
              </a>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {industryPages.map((p) => (
                <a
                  key={p.slug}
                  href={`/leads/${p.slug}`}
                  className="px-4 py-2 rounded-xl border border-border bg-background text-sm font-medium hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                  data-testid={`link-industry-${p.slug}`}
                >
                  {p.industry}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── How every list is built ──────────────────────────────────────── */}
        <section id="process" className="py-24">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-3 tracking-tight">How every list is built.</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">No recycled databases, no stale exports — built to order, checked by a human, refund-backed.</p>
            </div>

            <div className="relative">
              {/* Connecting line */}
              <div className="hidden md:block absolute top-8 left-[10%] right-[10%] border-t-2 border-dashed border-border" aria-hidden />

              <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                {[
                  { step: "01", icon: Map,          title: "Pulled fresh",       desc: "Live Google & Bing Maps listings for your exact industry and area." },
                  { step: "02", icon: RefreshCw,    title: "Deduped & cleaned",  desc: "Duplicates stripped, dead and closed businesses removed." },
                  { step: "03", icon: Globe,        title: "Enriched",           desc: "Emails and social links pulled from each business's own website." },
                  { step: "04", icon: Users,        title: "Human-reviewed",     desc: "A person spot-checks phones, emails, and locations before delivery." },
                  { step: "05", icon: Shield,       title: "Refund-backed",      desc: "Short pack? The difference is refunded automatically — no asking." },
                ].map((item, i) => (
                  <motion.div
                    key={item.step}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fadeIn}
                    className="text-center relative"
                  >
                    <div className="w-16 h-16 mx-auto bg-card border-2 border-primary/40 text-primary flex items-center justify-center rounded-2xl font-display font-bold text-xl mb-5 shadow-lg shadow-primary/10 relative z-10">
                      {item.step}
                    </div>
                    <item.icon className="w-5 h-5 text-primary/60 mx-auto mb-2" />
                    <h3 className="font-bold mb-1.5 text-sm">{item.title}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Who buys ─────────────────────────────────────────────────────── */}
        <section className="py-24 bg-card/20 border-y border-border">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Built for people who close deals.</h2>
              <p className="text-muted-foreground mt-3 max-w-lg mx-auto">If your income depends on finding and pitching local businesses, this is your edge.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  icon: Users,
                  title: "Agency Owners",
                  desc: "Buy hyper-local lists — \"Roofers in Miami with no website\" — and walk into every pitch already knowing the gap you're selling against.",
                  quote: "I closed $18k from my first $29 list.",
                },
                {
                  icon: Settings2,
                  title: "Sales Teams",
                  desc: "Skip the data-entry phase entirely. Your reps start the week with a clean, verified call list instead of spending Monday building one.",
                  quote: "Cut our prospecting time by 80%.",
                },
                {
                  icon: Map,
                  title: "Freelancers",
                  desc: "Get a list of local businesses with bad websites or missing socials, and pitch the fix — the lead tells you exactly what to offer.",
                  quote: "Replaced three $100/mo tools.",
                },
              ].map(({ icon: Icon, title, desc, quote }) => (
                <motion.div
                  key={title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeIn}
                  className="relative p-7 rounded-2xl border border-border bg-gradient-to-b from-card to-card/30 hover:border-primary/30 transition-colors overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors" aria-hidden />
                  <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-3">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5">{desc}</p>
                  <div className="pt-4 border-t border-border">
                    <p className="text-xs font-semibold text-primary italic">"{quote}"</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Free tool teaser ─────────────────────────────────────────────── */}
        <section className="py-24">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="relative rounded-2xl border border-border bg-gradient-to-br from-card via-card/80 to-background overflow-hidden">
              {/* Decorative */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full translate-x-1/2 -translate-y-1/2" aria-hidden />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full -translate-x-1/2 translate-y-1/2" aria-hidden />
              <SiGooglechrome className="absolute top-8 right-12 w-32 h-32 text-muted-foreground/5" aria-hidden />

              <div className="relative p-10 md:p-14 md:flex md:items-center md:gap-16">
                <div className="flex-1 mb-8 md:mb-0">
                  <Badge className="mb-4 bg-primary/10 text-primary border-primary/25">🎁 100% Free</Badge>
                  <h2 className="text-2xl md:text-3xl font-display font-bold mb-4 tracking-tight">
                    Want to pull leads yourself?<br />Take our free Chrome extension.
                  </h2>
                  <p className="text-muted-foreground leading-relaxed mb-2">
                    The same engine behind our lead lists — extract business names, phones, emails, and websites straight from Google Maps, Bing Maps, and Yelp. No signup, no card.
                  </p>
                  <p className="text-xs text-muted-foreground">Works on Chrome, Edge, and Brave.</p>
                </div>
                <div className="flex flex-col gap-3 shrink-0">
                  <Button asChild size="lg" className="font-bold w-full sm:w-auto">
                    <a href="/free-tool" data-testid="btn-teaser-free-tool">
                      <ArrowRight className="mr-2 h-5 w-5" /> See the Free Tool
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="font-bold w-full sm:w-auto">
                    <a href={STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="btn-teaser-install">
                      <SiGooglechrome className="mr-2 h-5 w-5" /> Install from Chrome Store
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Developer program ────────────────────────────────────────────── */}
        <section id="developer-program" className="py-16 border-t border-border bg-card/20">
          <div className="container mx-auto px-6 max-w-4xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <Badge className="mb-3 bg-primary/10 text-primary border-primary/25">⚡ Developer Program</Badge>
                <h2 className="text-2xl font-display font-bold mb-2 tracking-tight">Building something with leads?</h2>
                <p className="text-muted-foreground text-sm max-w-md">We work with developers on custom integrations and programmatic access. Tell us what you're building.</p>
              </div>
              <a
                href="mailto:support@mapleadextractor.net?subject=Developer%20Program%20Application&body=Tell%20us%20what%20you%27re%20building%20and%20how%20you%20want%20to%20use%20our%20leads%3A%0A%0A"
                data-testid="link-developer-apply"
                className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-primary/40 text-primary font-semibold text-sm hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
              >
                <Mail className="w-4 h-4" /> Apply for API access
              </a>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section id="faq" className="py-24">
          <div className="container mx-auto px-6 max-w-3xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Questions & Answers</h2>
              <p className="text-muted-foreground mt-3">Everything you need to know before you buy.</p>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {FAQ.map((f, i) => (
                <AccordionItem key={i} value={`item-${i + 1}`} className="border-border">
                  <AccordionTrigger className="text-left text-lg font-medium py-5 hover:text-primary transition-colors">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-base pb-5 leading-relaxed">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <PlatformReviews />
        <BuyerReviews />

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <section className="py-24 relative overflow-hidden">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-emerald-600 text-primary-foreground">
              {/* Texture overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px]" aria-hidden />
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" aria-hidden />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-black/10 rounded-full blur-2xl" aria-hidden />

              <div className="relative p-10 md:p-16 md:flex md:items-center md:gap-16">
                <div className="flex-1 mb-8 md:mb-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary-foreground/70 mb-3">Ready when you are</p>
                  <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 tracking-tight leading-[1.1]">
                    Stop hunting.<br />Start closing.
                  </h2>
                  <p className="text-xl text-primary-foreground/80 leading-relaxed max-w-md">
                    Your next 100 customers are already on the map. We'll put them in your inbox — reviewed, scored, and ready to call.
                  </p>
                </div>

                <div className="shrink-0 text-center">
                  <div className="bg-background/15 backdrop-blur rounded-2xl border border-white/20 p-8 inline-block min-w-[220px]">
                    <div className="text-5xl font-display font-bold mb-1">$29</div>
                    <div className="text-primary-foreground/70 text-sm mb-6">100 verified leads</div>
                    <Button asChild size="lg" variant="secondary" className="w-full h-12 font-bold hover:-translate-y-0.5 transition-transform shadow-xl">
                      <a href="#leads-for-sale" data-testid="btn-footer-buy-leads">
                        <Package className="mr-2 h-5 w-5" /> Get My Leads
                      </a>
                    </Button>
                    <p className="text-xs text-primary-foreground/60 mt-3">Refund if we come up short</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-card border-t border-border py-14">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div className="col-span-2">
              <div className="flex items-center gap-2 font-display font-bold text-xl text-foreground mb-4">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/15 border border-primary/30">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                </span>
                MapLeadExtractor
              </div>
              <p className="text-muted-foreground text-sm max-w-sm mb-6 leading-relaxed">
                Done-for-you local business lead lists by industry and city — plus free, high-performance extraction tools for doing it yourself.
              </p>
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center"><SiGooglechrome className="text-muted-foreground w-4 h-4" /></div>
                <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center"><SiGoogle className="text-muted-foreground w-4 h-4" /></div>
                <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center"><Map className="text-muted-foreground w-4 h-4" /></div>
                <a
                  href="https://www.facebook.com/share/1bhu8ciaU8/?mibextid=wwXIfr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
                  aria-label="Facebook"
                >
                  <SiFacebook className="text-muted-foreground hover:text-primary w-4 h-4 transition-colors" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-sm">Products</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#leads-for-sale" className="hover:text-primary transition-colors">Buy Lead Packs</a></li>
                <li><a href="/free-tool" className="hover:text-primary transition-colors">Free Chrome Extension</a></li>
                <li><a href="/pricing" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="/blog" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="/tools" className="hover:text-primary transition-colors">Free Calculators</a></li>
                <li><a href="/scraper" className="hover:text-primary transition-colors">Scraper Store</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 text-sm">Legal</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="mailto:support@mapleadextractor.net" className="hover:text-primary transition-colors">Contact Support</a></li>
              </ul>
            </div>
          </div>

          {/* Trust strip */}
          <div className="border-t border-border pt-6 mb-6">
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
              <div className="font-mono text-primary">v1.2.3 // STABLE</div>
            </div>
          </div>
        </div>
      </footer>

      <ChatWidget externalOpen={chatOpen} onExternalOpenHandled={() => setChatOpen(false)} />
    </div>
  );
}
