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

/** Live count of verified leads in stock — real number from the public
 *  availability endpoint; renders nothing until it loads. */
export function useLeadStock(): number | null {
  const [stock, setStock] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/stripe/pack-availability")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (typeof d?.available === "number" && d.available > 0) setStock(d.available); })
      .catch(() => {});
  }, []);
  return stock;
}

/** One-line live social proof for hero sections — real inventory, no invented
 *  review counts. Renders nothing while the number is unknown. */
export function LeadStockLine({ className = "" }: { className?: string }) {
  const stock = useLeadStock();
  if (stock === null) return null;
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2 align-middle animate-pulse" />
      <span className="text-foreground font-semibold">{stock.toLocaleString()}</span> verified leads in stock right now
    </p>
  );
}

/**
 * Honest trust band shown where the old review widgets used to be. The
 * fabricated Google/Trustpilot/Chrome/BBB reviews and scores that once lived
 * here were removed deliberately — NEVER reintroduce invented reviews, star
 * ratings, review counts, or accreditation badges (FTC fake-review rule; see
 * replit.md). Real buyer reviews render via <BuyerReviews /> once approved.
 */
export function PlatformReviews() {
  const stock = useLeadStock();
  const items = [
    { big: stock !== null ? stock.toLocaleString() : "Thousands", small: "verified leads in stock right now" },
    { big: "100%", small: "human-reviewed before your CSV ships" },
    { big: "< 24h", small: "delivery, usually within a few hours" },
    { big: "Auto", small: "refunds on any shortfall — no asking" },
  ];
  return (
    <section className="py-12">
      <div className="container mx-auto px-6 max-w-5xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((it) => (
            <motion.div key={it.small} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn}
              className="rounded-2xl border border-border bg-gradient-to-b from-card to-card/30 px-5 py-6 text-center">
              <div className="text-2xl md:text-3xl font-display font-bold text-primary mb-1">{it.big}</div>
              <div className="text-xs text-muted-foreground leading-snug">{it.small}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Minimal footer — privacy/terms kept for ad-platform compliance. */
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
