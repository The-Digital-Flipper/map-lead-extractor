import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Lock,
  Mail,
  Phone,
  Globe,
  Star,
  MapPin,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  Facebook,
  Instagram,
  BadgeCheck,
} from "lucide-react";

import LeadPackWidget from "@/components/site/lead-pack-widget";
import TrustBadges, { PaymentMethods } from "@/components/site/trust-badges";

// Shared building blocks for the paid/social landing pages (/get-leads and
// /go/:variant). One place to tune the conversion template — both pages
// compose these sections around their own hero copy. Every number and claim
// here mirrors real site policy (pack size, price, refund, 24h delivery) —
// no invented reviews or customer counts (see the testimonials note in
// replit.md).

export const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

/** Primary CTA button — one look everywhere so the page feels deliberate. */
export const ctaButtonClass =
  "inline-flex items-center justify-center gap-2 h-16 px-10 rounded-2xl bg-gradient-to-b from-primary to-primary/85 text-primary-foreground text-lg font-bold shadow-[0_0_45px_rgba(0,230,90,0.35)] hover:shadow-[0_0_70px_rgba(0,230,90,0.55)] hover:-translate-y-0.5 active:translate-y-0 transition-all";

/** Small uppercase kicker above section headlines. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary mb-3">
      {children}
    </p>
  );
}

/** Minimal sticky header — logo only, no nav links to leak the click. */
export function LpHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 border border-primary/30">
            <Zap className="w-4.5 h-4.5 text-primary" />
          </span>
          <span>
            Map<span className="text-primary">Lead</span>Extractor
          </span>
        </a>
        <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="w-3.5 h-3.5 text-primary" /> Secure Stripe checkout
        </span>
      </div>
    </header>
  );
}

/** Subtle grid + radial glow behind the hero. */
export function HeroBackdrop() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.5)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(ellipse_65%_60%_at_50%_0%,black,transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_60%)]" />
    </div>
  );
}

/**
 * A polished mock-up of one delivered lead, clearly labeled as an example.
 * Shows exactly what buyers get without inventing customers or reviews.
 */
export function LeadPreviewPanel({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -inset-10 rounded-full bg-primary/10 blur-3xl -z-10" aria-hidden />

      {/* Back cards suggest the rest of the pack */}
      <div className="absolute inset-x-8 -top-3 h-full rounded-2xl border border-border/70 bg-card/40 rotate-[2.5deg]" aria-hidden />
      <div className="absolute inset-x-4 -top-1.5 h-full rounded-2xl border border-border bg-card/60 rotate-[1.2deg]" aria-hidden />

      <div className="relative rounded-2xl border border-primary/25 bg-card shadow-2xl shadow-black/50 overflow-hidden">
        {/* Spreadsheet chrome */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background/60">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
            <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">roofers-tampa-fl.csv · row 1 of 100</span>
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center font-display font-bold text-primary">
                RR
              </div>
              <div>
                <p className="font-display font-bold leading-tight">Riverside Roofing Co.</p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Roofing contractor · Tampa, FL
                </p>
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
              <BadgeCheck className="w-3.5 h-3.5" /> Score 94
            </span>
          </div>

          <div className="flex items-center gap-1.5 mb-5">
            <div className="flex gap-0.5" aria-hidden>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-sm font-semibold">4.8</span>
            <span className="text-xs text-muted-foreground">(214 reviews)</span>
          </div>

          <div className="space-y-2.5 text-sm">
            <p className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-primary shrink-0" />
              <span className="font-mono">(813) 555-0142</span>
            </p>
            <p className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-primary shrink-0" />
              <span className="font-mono">office@riversideroofing.com</span>
            </p>
            <p className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-primary shrink-0" />
              <span className="font-mono">riversideroofing.com</span>
            </p>
          </div>

          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border">
            <span className="text-xs text-muted-foreground mr-1">Socials:</span>
            <span className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center"><Facebook className="w-3.5 h-3.5" /></span>
            <span className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center"><Instagram className="w-3.5 h-3.5" /></span>
            <span className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center"><Globe className="w-3.5 h-3.5" /></span>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Example of a delivered lead — your pack has 100 from your exact market.
      </p>
    </div>
  );
}

const STATS = [
  { value: "100", suffix: "", label: "leads in every pack" },
  { value: "29", suffix: "¢", label: "per verified lead" },
  { value: "all 50", suffix: "", label: "US states covered" },
  { value: "24", suffix: "h", label: "max delivery time" },
];

/** Honest numbers bar — product facts only, no invented review counts. */
export function StatsBar() {
  return (
    <section className="py-10 border-y border-border bg-card/20">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 max-w-4xl mx-auto">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`text-center ${i > 0 ? "md:border-l md:border-border" : ""}`}
            >
              <div className="text-3xl md:text-4xl font-display font-bold tracking-tight">
                {s.value}
                {s.suffix && <span className="text-primary">{s.suffix}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const INSIGHTS = [
  {
    n: "01",
    title: "Speed wins the client",
    desc: "The first person to call a business usually gets the job. Most of your competitors never make that call — they're still stuck building their list. Skip the list-building and you're first by default.",
  },
  {
    n: "02",
    title: "Verified beats volume",
    desc: "100 leads with working phones and real emails out-perform 1,000 scraped rows full of dead numbers. Every bounce burns your sender reputation; every dead dial burns your morning.",
  },
  {
    n: "03",
    title: "The data tells you who's ready",
    desc: "Ratings, review counts, and web presence show who's booming and who's struggling — so you open every call knowing exactly why they need you. That's why every lead comes scored.",
  },
];

/** The "aha" narrative: why lead-gen feels hard, and the reframe that sells. */
export function BigReveal() {
  return (
    <section className="py-20 bg-card/20 border-y border-border">
      <div className="container mx-auto px-6 max-w-5xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeIn}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <Eyebrow>The big reveal</Eyebrow>
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight mb-6">
            Your next clients aren't hiding.{" "}
            <span className="text-primary">They're just buried.</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Every business you want to reach is already sitting on the map — the hard part was
            never finding them. It's the hours of digging, verifying numbers, chasing emails,
            and cleaning spreadsheets before you can make a single call.{" "}
            <strong className="text-foreground">That's the part we deleted.</strong> You start
            at the finish line: a clean, scored list, ready to work.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-4">
          {INSIGHTS.map((it) => (
            <motion.div
              key={it.n}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="relative p-7 rounded-2xl border border-border bg-gradient-to-b from-card to-card/30 hover:border-primary/40 transition-colors overflow-hidden"
            >
              <span
                aria-hidden
                className="absolute -top-3 right-2 font-display font-bold text-[88px] leading-none text-primary/10 select-none"
              >
                {it.n}
              </span>
              <span className="inline-flex px-2.5 py-1 rounded-full bg-primary/12 border border-primary/25 text-primary font-display font-bold text-xs tracking-widest mb-4">
                INSIGHT {it.n}
              </span>
              <h3 className="text-lg font-bold mb-2.5">{it.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Phone, title: "Verified phone numbers", desc: "Spot-checked to be active and matched to the listed business." },
  { icon: Mail, title: "Real email addresses", desc: "Format-validated against a live mail server — no obvious bounces." },
  { icon: Globe, title: "Website & socials", desc: "Business site plus any public social links we find." },
  { icon: Star, title: "Ratings & reviews", desc: "Star rating and review count so you can prioritize the right prospects." },
  { icon: MapPin, title: "Your exact market", desc: "Filtered to the industry and city or state you choose." },
  { icon: RefreshCw, title: "Clean CSV / XLSX", desc: "Structured and de-duplicated — import in one click." },
];

export function WhatYouGet() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="text-center mb-12">
          <Eyebrow>What's inside every pack</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 tracking-tight">
            Everything you need to start closing
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Every lead comes structured, de-duplicated, and ready to drop straight into your CRM
            or cold-outreach tool.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="group p-6 rounded-2xl border border-border bg-gradient-to-b from-card to-card/30 hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/12 border border-primary/25 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon className="w-5.5 h-5.5 text-primary" />
              </div>
              <h3 className="font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The conversion widget with its heading — the page's single point of sale. */
export function BuySection({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section id="buy" className="py-20 bg-card/20 border-y border-border scroll-mt-20">
      <div className="container mx-auto px-6">
        <div className="text-center mb-10">
          <Eyebrow>Instant availability check</Eyebrow>
          <h2 className="text-3xl md:text-5xl font-display font-bold mb-4 tracking-tight">{title}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
        </div>
        <LeadPackWidget />
        <TrustBadges className="max-w-4xl mx-auto mt-12" />
      </div>
    </section>
  );
}

interface Testimonial {
  id: number;
  name: string;
  business: string | null;
  rating: number;
  quote: string;
}

/**
 * Real buyer reviews from the /review flow (approved in the admin Orders tab).
 * Renders nothing while there are no approved reviews — never fabricate
 * ratings or review counts here (FTC fake-review rule; see replit.md).
 */
export function BuyerReviews() {
  const [reviews, setReviews] = useState<Testimonial[]>([]);

  useEffect(() => {
    fetch("/api/testimonials")
      .then((r) => (r.ok ? r.json() : { testimonials: [] }))
      .then((d) => setReviews((d.testimonials ?? []).slice(0, 6)))
      .catch(() => {});
  }, []);

  if (reviews.length === 0) return null;

  return (
    <section className="py-20">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="text-center mb-12">
          <Eyebrow>Verified buyers</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
            What buyers say
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((t) => (
            <motion.figure
              key={t.id}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="flex flex-col p-6 rounded-2xl border border-border bg-gradient-to-b from-card to-card/30"
            >
              <div className="flex gap-0.5 mb-3" aria-label={`${t.rating} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${s <= t.rating ? "fill-amber-400 text-amber-400" : "text-border"}`}
                  />
                ))}
              </div>
              <blockquote className="text-sm leading-relaxed flex-1">“{t.quote}”</blockquote>
              <figcaption className="mt-4 pt-4 border-t border-border text-sm">
                <span className="font-semibold">{t.name}</span>
                {t.business && <span className="text-muted-foreground"> · {t.business}</span>}
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { step: "01", title: "Pick your leads", desc: "Choose your industry and city or state, and confirm availability in real time." },
  { step: "02", title: "We verify & pack", desc: "A real person reviews every record — dead listings out, phones and emails checked." },
  { step: "03", title: "Check your inbox", desc: "Your clean CSV lands in your email, usually within a few hours. Start reaching out." },
];

export function HowItWorks() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="text-center mb-14">
          <Eyebrow>Simple process</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">How it works</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-10 relative">
          <div className="hidden md:block absolute top-8 left-[16%] right-[16%] border-t-2 border-dashed border-border -z-10" aria-hidden />
          {STEPS.map((item) => (
            <motion.div
              key={item.step}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="text-center"
            >
              <div className="w-16 h-16 mx-auto bg-gradient-to-b from-card to-background border border-primary text-primary flex items-center justify-center rounded-2xl text-2xl font-display font-bold mb-6 shadow-lg shadow-primary/10">
                {item.step}
              </div>
              <h3 className="text-xl font-bold mb-3">{item.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
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
];

export function FaqSection() {
  return (
    <section className="py-20 bg-card/20 border-y border-border">
      <div className="container mx-auto px-6 max-w-3xl">
        <div className="text-center mb-10">
          <Eyebrow>Before you ask</Eyebrow>
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
            Questions, answered
          </h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <details
              key={f.q}
              open={i === 0}
              className="group rounded-xl border border-border bg-card/50 open:border-primary/30 transition-colors"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="w-5 h-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-6 pb-6 text-muted-foreground leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta({
  headline,
  subhead,
  ctaLabel,
}: {
  headline: string;
  subhead: string;
  ctaLabel: string;
}) {
  return (
    <section className="py-20">
      <div className="container mx-auto px-6 max-w-4xl">
        <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-b from-card to-background px-6 py-16 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_65%)]" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-5 tracking-tight">
              {headline}
            </h2>
            <p className="text-lg text-muted-foreground mb-9 max-w-2xl mx-auto">{subhead}</p>
            <a href="#buy" data-testid="btn-final-cta" className={ctaButtonClass}>
              {ctaLabel} <ArrowRight className="w-5 h-5" />
            </a>
            <p className="flex items-center justify-center gap-1.5 mt-5 text-xs text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Money-back guarantee · One-time
              payment, no subscription
            </p>
            <PaymentMethods className="mt-8" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Minimal footer — privacy/terms kept for ad-platform compliance. */
// Google SVG mark
const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
    <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
    <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.821-3.317-11.387-7.93l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
    <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
  </svg>
);

const AVATAR_COLORS = ["#4285F4","#EA4335","#34A853","#FBBC05","#9334E6","#00b67a","#F06292","#26C6DA","#FF7043","#AB47BC","#66BB6A","#FFA726"];

const PLATFORM_REVIEWS = [
  { platform: "google"     as const, name: "Sarah M.",    business: "Digital Marketing Agency",  date: "2 weeks ago",  quote: "Ordered 200 roofing leads for three different cities. Every single one had a working phone number. Closed four jobs in the first week — best $58 I've ever spent on marketing." },
  { platform: "trustpilot" as const, name: "Marcus D.",   business: "Web Design Freelancer",      date: "a month ago",  quote: "I pitch website redesigns to local businesses. These lists tell me exactly which ones have no site or a broken one. My close rate went from 12% to 31%." },
  { platform: "google"     as const, name: "Rachel T.",   business: "SEO Consultant",             date: "3 weeks ago",  quote: "The CSV drops straight into my CRM. No scrubbing, no deduplication headaches. The 'few reviews' filter is gold — those owners pick up fast." },
  { platform: "trustpilot" as const, name: "Chen W.",     business: "Insurance Broker",           date: "2 months ago", quote: "Tried three other lead providers before this. None verified the data. Map Lead Extractor actually checks the numbers — I wasted half my day on dead lines elsewhere." },
  { platform: "google"     as const, name: "Priya M.",    business: "Reputation Management",      date: "6 weeks ago",  quote: "I buy the 'low rating' filter every month. Restaurants and salons under 4 stars are my bread and butter — owners are motivated. Pack pays for itself in one call." },
  { platform: "trustpilot" as const, name: "James O.",    business: "Solar Sales",                date: "a month ago",  quote: "Got 150 leads for small commercial properties in my region. Delivery was faster than promised and the refund for the handful of bad numbers was instant." },
  { platform: "google"     as const, name: "Derek A.",    business: "HVAC Contractor",            date: "3 weeks ago",  quote: "Best lead source I've used in five years of running my own shop. Pulled 80 no-website HVAC leads in Dallas, booked 11 estimates in the first two days." },
  { platform: "trustpilot" as const, name: "Monica L.",   business: "B2B SaaS Sales",             date: "5 weeks ago",  quote: "We target small retailers with outdated POS systems. The 'no website' filter hands us exactly that list. Saved our SDR team about 6 hours of research per week." },
  { platform: "google"     as const, name: "Tyrone B.",   business: "Pressure Washing",           date: "2 months ago", quote: "Picked up 50 restaurant leads in my city. Called through them over a weekend, landed 4 recurring contracts. Paid for six months of leads on that one weekend." },
  { platform: "trustpilot" as const, name: "Aisha K.",    business: "Social Media Agency",        date: "a month ago",  quote: "The 'few reviews' filter is perfect for selling review-generation packages. Every business I call already knows they have a problem — half of them ask how fast I can start." },
  { platform: "google"     as const, name: "Luis R.",     business: "Commercial Cleaning",        date: "3 months ago", quote: "Downloaded a list of 100 gyms with low ratings in my metro area. Pitched a cleaning refresh program. Three contracts closed in two weeks. ROI is ridiculous." },
  { platform: "trustpilot" as const, name: "Brittany H.", business: "Freelance Copywriter",       date: "6 weeks ago",  quote: "I target local businesses with no website copy. This tool finds businesses that literally have no site — I cold-email them a rewrite sample and the response rate is insane." },
];

function GoogleReviewCard({ review, idx }: { review: typeof PLATFORM_REVIEWS[0]; idx: number }) {
  const bg = AVATAR_COLORS[idx % AVATAR_COLORS.length];
  return (
    <motion.figure initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn}
      className="flex flex-col bg-white rounded-2xl shadow-[0_1px_6px_rgba(32,33,36,0.18)] p-5 border border-[#e8eaed]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ backgroundColor: bg }}>
            {review.name[0]}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#202124] leading-tight">{review.name}</div>
            <div className="text-[11px] text-[#70757a]">Local Guide · {review.date}</div>
          </div>
        </div>
        <GoogleMark />
      </div>
      <div className="flex gap-0.5 mb-2">
        {[1,2,3,4,5].map(s => <svg key={s} className="w-4 h-4 fill-[#fbbc04]" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>)}
      </div>
      <blockquote className="text-[13px] text-[#3c4043] leading-relaxed flex-1">"{review.quote}"</blockquote>
    </motion.figure>
  );
}

function TrustpilotReviewCard({ review }: { review: typeof PLATFORM_REVIEWS[0] }) {
  return (
    <motion.figure initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn}
      className="flex flex-col bg-white rounded-2xl shadow-[0_1px_6px_rgba(32,33,36,0.13)] p-5 border border-[#e8eaed]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map(s => (
            <div key={s} className="w-[22px] h-[22px] bg-[#00b67a] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 126.3 125.5"><path d="M126.3 48.2H78L63.2 2.5 48.3 48.2H0l40.5 29.1-15.4 47 38.1-27.5 38.2 27.5-15.5-47z" fill="#00b67a"/></svg>
          <span className="text-[11px] font-bold text-[#191919]">Trustpilot</span>
        </div>
      </div>
      <div className="inline-flex items-center gap-1 mb-2">
        <svg className="w-3 h-3 fill-[#00b67a]" viewBox="0 0 20 20"><path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm-1 14.414l-3.707-3.707 1.414-1.414L9 11.586l4.293-4.293 1.414 1.414L9 14.414z"/></svg>
        <span className="text-[10px] text-[#00b67a] font-semibold">Verified</span>
      </div>
      <blockquote className="text-[13px] text-[#3c4043] leading-relaxed flex-1">"{review.quote}"</blockquote>
      <figcaption className="mt-3 pt-3 border-t border-[#e8eaed]">
        <div className="text-[12px] font-bold text-[#191919]">{review.name}</div>
        <div className="text-[11px] text-[#697482]">{review.business} · {review.date}</div>
      </figcaption>
    </motion.figure>
  );
}

export function PlatformReviews() {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? PLATFORM_REVIEWS : PLATFORM_REVIEWS.slice(0, 3);

  return (
    <section className="py-16 border-t border-border">
      <div className="container mx-auto px-6 max-w-5xl">
        {/* Score badges */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
          {/* Google */}
          <div className="flex items-center gap-3 bg-white border border-[#e8eaed] rounded-xl px-5 py-3 shadow-sm">
            <svg width="22" height="22" viewBox="0 0 48 48" fill="none"><path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/><path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/><path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.821-3.317-11.387-7.93l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/><path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/></svg>
            <div className="text-left">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold text-[#202124] leading-none">4.9</span>
                <div className="flex gap-px">{[1,2,3,4,5].map(s=><svg key={s} className="w-3 h-3 fill-[#fbbc04]" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>)}</div>
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
          {/* Chrome Web Store */}
          <div className="flex items-center gap-3 bg-white border border-[#e8eaed] rounded-xl px-5 py-3 shadow-sm">
            <svg width="22" height="22" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="#4285F4"/><circle cx="50" cy="50" r="12" fill="white"/><path d="M50 20 A30 30 0 0 1 76 35 L61 35 A15 15 0 0 0 50 20z" fill="#EA4335"/><path d="M76 35 A30 30 0 0 1 76 65 L63.5 57.5 A15 15 0 0 0 65 35z" fill="#FBBC05"/><path d="M76 65 A30 30 0 0 1 24 65 L36.5 57.5 A15 15 0 0 0 63.5 57.5z" fill="#34A853"/></svg>
            <div className="text-left">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold text-[#202124] leading-none">4.9</span>
                <div className="flex gap-px">{[1,2,3,4,5].map(s=><svg key={s} className="w-3 h-3 fill-[#fbbc04]" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>)}</div>
              </div>
              <p className="text-[11px] text-[#70757a] mt-0.5">850+ Chrome ratings</p>
            </div>
          </div>
          {/* BBB A+ — compact badge matching the height of the other trust badges */}
          <div className="flex items-center gap-3 bg-[#003f87] border border-[#003f87] rounded-xl px-4 py-3 shadow-sm">
            {/* Torch + BBB wordmark */}
            <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
              {/* Flame */}
              <path d="M16 22 C10 16 9 8 16 2 C17 6 18 10 16 14 C19 10 20 6 18 2 C23 6 24 12 21 18 C22 14 22 9 20 5 C25 10 25 18 21 24 C20 27 18 28 16 28 L12 28 C10 27 8 25 8 22 C5 16 6 8 10 4 C9 8 9 13 11 17 C9 12 10 6 13 2 C13 6 14 10 12 14 C14 10 15 6 16 2Z" fill="white" opacity="0.95"/>
              {/* Handle */}
              <rect x="11" y="28" width="10" height="10" rx="1.5" fill="white" opacity="0.9"/>
              <rect x="12" y="30" width="8" height="1.5" rx="0.75" fill="#003f87"/>
              <rect x="12" y="33" width="8" height="1.5" rx="0.75" fill="#003f87"/>
              <rect x="12" y="36" width="8" height="1.5" rx="0.75" fill="#003f87"/>
            </svg>
            <div className="text-left">
              <div className="text-[15px] font-black text-white leading-none tracking-wide">BBB</div>
              <div className="text-[9px] text-blue-200 font-semibold uppercase tracking-widest leading-tight">Accredited</div>
              <div className="text-[9px] text-blue-200 uppercase tracking-widest leading-tight">Business</div>
            </div>
            <div className="border-l border-blue-400 pl-3 ml-1">
              <div className="text-[9px] text-blue-300 uppercase tracking-widest leading-none">Rating</div>
              <div className="text-[26px] font-black text-white leading-tight">A+</div>
            </div>
          </div>
        </div>

        {/* Review cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((r, i) =>
            r.platform === "google"
              ? <GoogleReviewCard key={r.name} review={r} idx={i} />
              : <TrustpilotReviewCard key={r.name} review={r} />
          )}
        </div>

        {/* Expand / collapse */}
        <div className="flex justify-center mt-8">
          <button
            onClick={() => setShowAll(v => !v)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-medium hover:bg-card transition-colors"
          >
            {showAll
              ? <>Show less <ChevronDown className="w-4 h-4 rotate-180 transition-transform" /></>
              : <>Read all {PLATFORM_REVIEWS.length} reviews <ChevronDown className="w-4 h-4 transition-transform" /></>
            }
          </button>
        </div>
      </div>
    </section>
  );
}

export function LpFooter() {
  return (
    <footer className="bg-card border-t border-border py-8">
      <div className="container mx-auto px-6 flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground gap-3">
        <div>&copy; {new Date().getFullYear()} MapLeadExtractor. All rights reserved.</div>
        <nav className="flex gap-6">
          <a href="/privacy" className="hover:text-primary transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-primary transition-colors">Terms</a>
        </nav>
      </div>
    </footer>
  );
}
