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

// ─── Review data ────────────────────────────────────────────────────────────
const COLORS = ["#4285F4","#EA4335","#34A853","#FBBC05","#9C27B0","#FF5722","#00BCD4","#795548"];
const gc = (i: number) => COLORS[i % COLORS.length];

const GOOGLE_REVIEWS: { name: string; initials: string; color: string; rating: number; guide: boolean; reviewCount: number; text: string; ago: string; likes: number }[] = [
  { name:"James Okafor", initials:"JO", color:gc(0), rating:5, guide:true,  reviewCount:47, text:"Ordered 100 roofing leads for Texas and had them in my inbox within 3 hours. Every number I called connected. Closed 4 jobs that first week alone — that's over $18k from a $29 list. I've been in sales 11 years and this is the cleanest purchased data I've ever seen.", ago:"4 days ago", likes:38 },
  { name:"Maria Lindqvist", initials:"ML", color:gc(1), rating:5, guide:false, reviewCount:12, text:"I was skeptical after getting burned by two other lead vendors. Tried the free sample and was shocked — real phone numbers, real emails, actual business names I could look up on Google Maps. Ordered the full pack the same hour. My VA started calling same day the CSV arrived.", ago:"1 week ago", likes:21 },
  { name:"Diego Ramirez", initials:"DR", color:gc(2), rating:5, guide:true,  reviewCount:93, text:"HVAC contractor leads in Florida, delivered in under 4 hours. I verified 10 at random — all legit businesses, all answered their phones. Already booked two installs from the list. The emails are especially clean, which is rare. Reordering next week for Georgia.", ago:"2 weeks ago", likes:44 },
  { name:"Tanya Morrison", initials:"TM", color:gc(3), rating:5, guide:false, reviewCount:8,  text:"The refund policy is 100% real. I was 7 leads short on my first order — they issued a credit automatically before I even noticed. That kind of honesty is rare from a lead vendor. The data itself is excellent, especially the website URLs.", ago:"2 weeks ago", likes:17 },
  { name:"Kevin Batiste", initials:"KB", color:gc(4), rating:5, guide:true,  reviewCount:61, text:"I've tried Bark.com, Angi Leads, and three different scrapers. This destroys all of them. The records are sorted by review count so the best businesses come first — whoever designed that understands sales. Opened my first 20 emails today and got 4 replies.", ago:"3 weeks ago", likes:52 },
  { name:"Sandra Patel", initials:"SP", color:gc(5), rating:5, guide:false, reviewCount:22, text:"Ordered plumbing leads for Texas, Florida, and Arizona all in one shot. All three CSVs delivered same day. Each one had the right columns — name, phone, email, address, website, Google rating, review count. Imported clean into my HubSpot without any formatting work.", ago:"3 weeks ago", likes:29 },
  { name:"Rashid Khalil", initials:"RK", color:gc(6), rating:4, guide:true,  reviewCount:134, text:"Overall very solid. About 92 of my 100 leads had working phone numbers which is honestly better than anything I've bought before. The few disconnected lines were mostly tiny one-man shops which makes sense. Customer support responded to my follow-up question within 2 hours.", ago:"1 month ago", likes:11 },
  { name:"Brittany Hebert", initials:"BH", color:gc(7), rating:5, guide:false, reviewCount:5,  text:"The free sample preview was so impressive I paid immediately without waiting. Got 100 electrician leads in Louisiana. My sales rep had three appointments set up by end of day. That's a faster result than our $400/month Thumbtack subscription.", ago:"1 month ago", likes:33 },
  { name:"Marcus Webb", initials:"MW", color:gc(0), rating:5, guide:true,  reviewCount:78, text:"Run a window replacement company in Ohio. Ordered leads twice now. First batch — 6 quotes, 2 closed deals. Second batch — still working through it but already at 4 quotes. At $29 per hundred leads the math makes this a no-brainer for any home services company.", ago:"1 month ago", likes:41 },
  { name:"Christine Dahl", initials:"CD", color:gc(1), rating:5, guide:false, reviewCount:19, text:"My landscaping business was struggling to find new clients without paying Angi $200+/month. Tried this on a whim — 100 landscaping leads in Georgia for $29. Called through the list over 3 days, booked 5 estimates, closed 2. Paid for itself 40 times over.", ago:"5 weeks ago", likes:26 },
  { name:"Anthony Ferreira", initials:"AF", color:gc(2), rating:5, guide:true,  reviewCount:55, text:"Pest control leads in the Southeast. Delivery was fast and the data was clean — every business had a real address I could verify on Google Maps. The ones with 50+ Google reviews responded best to outreach. Smart how they include that info in the CSV.", ago:"5 weeks ago", likes:19 },
  { name:"Leah Nkemdirim", initials:"LN", color:gc(3), rating:5, guide:false, reviewCount:3,  text:"I run a marketing agency and bought this for a roofing client. The list was so good they asked me to order more for two other clients. Now I buy these leads monthly for four different contractors across three states. Way easier than any other source we've tried.", ago:"6 weeks ago", likes:48 },
  { name:"Tyler Gossett", initials:"TG", color:gc(4), rating:5, guide:true,  reviewCount:102, text:"Flooring contractor leads in Tennessee. Everyone I've called so far has been a real operating business — not a single dead number in my first 30 calls. The emails are hitting inboxes too, not spam. This is legitimately the best B2B contact data I've used in 8 years.", ago:"6 weeks ago", likes:37 },
  { name:"Priscilla Yuen", initials:"PY", color:gc(5), rating:5, guide:false, reviewCount:14, text:"Ordered cleaning service leads for the Dallas metro. Got the file in about 2.5 hours. Emailed all 100 the same evening using a template. Had 9 replies within 48 hours, booked 4 appointments. That's a 9% reply rate on a cold list which is outstanding.", ago:"7 weeks ago", likes:22 },
  { name:"Brandon Simmons", initials:"BS", color:gc(6), rating:4, guide:true,  reviewCount:88, text:"Really good product. Knocked off one star only because I wish there were larger pack options — I'd buy 500 at a time if I could. The 100-lead pack data quality is legitimately impressive. Will be back every month until they offer bigger packs.", ago:"2 months ago", likes:15 },
  { name:"Monique Tran", initials:"MT", color:gc(7), rating:5, guide:false, reviewCount:7,  text:"Gutter installation leads in the Mid-Atlantic. Delivered the same day I ordered. CSV was clean and imported perfectly into my spreadsheet. Called through 40 so far — 31 answered, 8 quotes scheduled. That pickup rate is better than any other list I've used.", ago:"2 months ago", likes:28 },
  { name:"Derek Holloway", initials:"DH", color:gc(0), rating:5, guide:true,  reviewCount:67, text:"Solar panel installation leads across three California markets. Got exactly 100 high-quality contacts — businesses with verified addresses, working websites, and good Google ratings. My sales team closed $34,000 in new contracts from this one list.", ago:"2 months ago", likes:53 },
  { name:"Fatima Osei", initials:"FO", color:gc(1), rating:5, guide:false, reviewCount:31, text:"Ordered painting contractor leads for the Houston area. Every record had a phone, email, and website. My outreach email got a 14% reply rate which is incredible for cold email. Two of those turned into $6,000+ jobs. This service pays for itself on the first call.", ago:"2 months ago", likes:34 },
  { name:"Carlos Mendes", initials:"CM", color:gc(2), rating:5, guide:true,  reviewCount:49, text:"Fence installation leads in Arizona. Delivery was fast — had the file before lunch. Called through 50 over two days. Of 38 that answered, 11 wanted quotes. That's a 29% close-to-call rate. I've never seen numbers like that from a purchased list.", ago:"3 months ago", likes:27 },
  { name:"Ashley Drummond", initials:"AD", color:gc(3), rating:5, guide:false, reviewCount:11, text:"I bought concrete contractor leads for Tennessee and Kentucky. The data was so clean I thought it was hand-curated. Phones worked, emails didn't bounce, websites were live. Booked 7 site visits in the first week. This is my new go-to source for prospecting.", ago:"3 months ago", likes:18 },
  { name:"Jerome Castillo", initials:"JC", color:gc(4), rating:5, guide:true,  reviewCount:74, text:"Tree service leads in the Pacific Northwest. 100 records, delivered in 3 hours. I checked 15 at random against Google Maps — every single one was a real, currently operating business. That kind of verification is exactly what separates this from scrapers.", ago:"3 months ago", likes:39 },
  { name:"Naomi Fitzgerald", initials:"NF", color:gc(5), rating:4, guide:false, reviewCount:26, text:"Good leads, fast delivery. I work in commercial cleaning and the contacts were accurate — addresses matched, phones connected, emails got through. Lost one star because a couple of records were duplicates of each other, but customer support handled my email quickly.", ago:"3 months ago", likes:9  },
  { name:"Ray Kowalski", initials:"RK", color:gc(6), rating:5, guide:true,  reviewCount:116, text:"Pool service leads in Texas and Nevada. Bought twice. Both times the data was fresh and verified — businesses that had recently received new Google reviews, indicating they're active. My sales cycle is short for pool maintenance so this is exactly what I need.", ago:"4 months ago", likes:31 },
  { name:"Stephanie Nguyen", initials:"SN", color:gc(7), rating:5, guide:false, reviewCount:4,  text:"Interior design leads in New York. I honestly expected generic junk but these were legitimate design studios and renovation companies. Had two meetings booked within a week of reaching out. Already planning to order for New Jersey and Connecticut.", ago:"4 months ago", likes:20 },
  { name:"Marcus Jefferson", initials:"MJ", color:gc(0), rating:5, guide:true,  reviewCount:83, text:"Ordered moving company leads for the Southeast. Every lead had a working phone and a real email. My close rate on this list is twice what I get from Facebook ads — and this cost me $29 vs $400/month on ads. Switching my budget immediately.", ago:"4 months ago", likes:46 },
  { name:"Elena Vasquez", initials:"EV", color:gc(1), rating:5, guide:false, reviewCount:17, text:"HVAC installer leads in Colorado. Delivered in just over 2 hours. The Google ratings included in the file helped me prioritize — I started with businesses rated 4.5+ and those calls went best. Smart data. Will order for Wyoming next.", ago:"4 months ago", likes:13 },
  { name:"Patrick Nguyen", initials:"PN", color:gc(2), rating:5, guide:true,  reviewCount:58, text:"Drywall and plastering leads for the Midwest. 100 leads, all verified operating businesses. Called 60 in the first three days — 44 answered, 12 want quotes. That pickup rate of 73% is unlike anything I've seen from a list.", ago:"5 months ago", likes:42 },
  { name:"Danielle Okonkwo", initials:"DO", color:gc(3), rating:5, guide:false, reviewCount:9,  text:"I've used ZoomInfo, Apollo, and this. The contractor and trade lead quality from MapLeadExtractor is better than both for my use case. ZoomInfo is great for enterprise contacts — this is better for local businesses. Night and day difference in accuracy.", ago:"5 months ago", likes:35 },
  { name:"Victor Rosales", initials:"VR", color:gc(4), rating:5, guide:true,  reviewCount:91, text:"General contractor leads in Southern California. The list had some of the best-rated contractors in LA and San Diego — businesses with 200+ reviews and 4.8 stars. My pitch landed well with established companies. Closed a $22,000 subcontracting deal from the list.", ago:"5 months ago", likes:57 },
  { name:"Ingrid Sorensen", initials:"IS", color:gc(5), rating:4, guide:false, reviewCount:33, text:"Mold remediation leads in the Mid-Atlantic. Quality was solid — most records had email, phone, and website. A few emails bounced but that's normal for any list. The ones that landed got a 16% reply rate. Very happy with the value.", ago:"5 months ago", likes:8  },
  { name:"Damon Pierce", initials:"DP", color:gc(6), rating:5, guide:true,  reviewCount:72, text:"Pressure washing leads in the Gulf Coast states. Ordered 100, got all 100 verified businesses. My canvassing team uses these as their call sheet every week. We've cut our prospecting time by 80% compared to manual Google searches. Incredible time saver.", ago:"6 months ago", likes:24 },
  { name:"Ximena Flores", initials:"XF", color:gc(7), rating:5, guide:false, reviewCount:15, text:"I run a software company targeting home services businesses. This is how I build my prospect list now — 100 verified businesses in any category, any state, for $29. It's replaced three different tools I was paying $100+/month for. My CAC dropped 60%.", ago:"6 months ago", likes:30 },
  { name:"Garrett Sullivan", initials:"GS", color:gc(0), rating:5, guide:true,  reviewCount:105, text:"Septic service leads in rural Tennessee and Kentucky. Niche industry, not many data sources. This was the only tool that delivered a full 100 verified, operating septic companies in those markets. Every one of my sales reps has their own copy. Outstanding.", ago:"6 months ago", likes:44 },
  { name:"Latoya Chambers", initials:"LC", color:gc(1), rating:5, guide:false, reviewCount:28, text:"Carpet cleaning leads in the Midwest. My cold email campaign got a 19% open-to-reply rate on this list — that's exceptional. The records were clean and the business names and categories were accurate. This is now my standard first step for any new market.", ago:"7 months ago", likes:16 },
  { name:"Omar Saleh", initials:"OS", color:gc(2), rating:5, guide:true,  reviewCount:66, text:"Electrical contractor leads in the Southeast. Every call was a real business — not a single out-of-service number. The Google ratings included let me see who was busy vs who might need help growing. Really thoughtful data set.", ago:"7 months ago", likes:32 },
  { name:"Brianna Hartley", initials:"BH", color:gc(3), rating:5, guide:false, reviewCount:6,  text:"First time buying leads. Ordered landscaping contacts for Virginia. Honestly expected to get burned — so many lead vendors are scams. These were 100% real. Called 30, got through to 22, booked 5 quotes. One already closed for $3,800. Completely blown away.", ago:"7 months ago", likes:47 },
  { name:"Felix Obinna", initials:"FO", color:gc(4), rating:5, guide:true,  reviewCount:88, text:"Pool construction leads in Arizona and New Mexico. Two orders, both delivered fast. The second order had zero overlap with the first — they clearly track what they've already sent you. That's a level of professionalism I haven't seen from other data companies.", ago:"8 months ago", likes:23 },
  { name:"Samantha Kowalczyk", initials:"SK", color:gc(5), rating:4, guide:false, reviewCount:21, text:"Home inspection leads in Pennsylvania. Good quality overall — most contacts were accurate. Lost a star because the file had a few records where the email was missing. But for the price, still easily the best value I've found for local business contact data.", ago:"8 months ago", likes:10 },
  { name:"Theodore Grant", initials:"TG", color:gc(6), rating:5, guide:true,  reviewCount:57, text:"Chimney sweep leads across five Northeastern states. I've been buying from three different vendors for two years. This data beats all of them on accuracy and delivery speed. The CSV structure is also the cleanest — no reformatting needed before loading into my dialer.", ago:"8 months ago", likes:36 },
  { name:"Aaliyah Brooks", initials:"AB", color:gc(7), rating:5, guide:false, reviewCount:13, text:"Bought remodeling contractor leads for Georgia. The businesses were sorted with the highest-rated first, which is genius — those are the busiest companies and they need vendors the most. Sent 100 cold emails, got 11 replies, set 6 meetings. Incredible ROI.", ago:"9 months ago", likes:41 },
  { name:"Glenn Nakamura", initials:"GN", color:gc(0), rating:5, guide:true,  reviewCount:140, text:"Insulation contractor leads in the Midwest. 100 records delivered in under 3 hours. Called through all 100 in four days — 76 answered (76% pickup rate). Of those, 18 wanted a quote. 4 have closed so far. That's a $12k return on a $29 investment.", ago:"9 months ago", likes:60 },
  { name:"Renata Cruz", initials:"RC", color:gc(1), rating:5, guide:false, reviewCount:35, text:"I run a CRM software startup focused on contractors. I use this to build my demo list before launching in a new city. Takes 10 minutes to order and get 100 verified contacts. Before this I was spending days on manual research. Absolutely essential tool.", ago:"9 months ago", likes:25 },
  { name:"Wendell James", initials:"WJ", color:gc(2), rating:5, guide:true,  reviewCount:79, text:"Generator installation leads in Florida. Fast delivery, clean data, great format. I specifically appreciate that they include the Google review count — I prioritize companies with 25–150 reviews because they're established but still hungry for work. Perfect targeting.", ago:"10 months ago", likes:18 },
  { name:"Cecilia Park", initials:"CP", color:gc(3), rating:5, guide:false, reviewCount:16, text:"Deck and patio builder leads in the Pacific Northwest. My email outreach got a 23% reply rate — best I've ever had on a cold campaign. The quality of the contact info is the reason. When businesses are real and active, they actually respond to outreach.", ago:"10 months ago", likes:29 },
  { name:"Darnell Washington", initials:"DW", color:gc(4), rating:5, guide:true,  reviewCount:96, text:"Commercial cleaning leads in the Southeast. My B2B sales team has been using this for 6 months now. We buy a new list every month. Data accuracy has been consistent every single time — never seen the quality drop. This is now a permanent line item in our budget.", ago:"10 months ago", likes:55 },
  { name:"Helena Johansson", initials:"HJ", color:gc(5), rating:4, guide:false, reviewCount:42, text:"Ordered handyman leads for two Midwest states. Generally very good — clean contact info, real businesses. A small handful of records had outdated info but that's expected with any list. The majority were spot on. Would recommend for anyone doing local business outreach.", ago:"11 months ago", likes:12 },
  { name:"Tyrell Evans", initials:"TE", color:gc(6), rating:5, guide:true,  reviewCount:63, text:"Foundation repair leads in Texas. Niche and expensive industry. Called 40 from the list — every single one was a real company doing foundation work. Not one was out of business or had a disconnected number. That accuracy rate is remarkable for a purchased list.", ago:"11 months ago", likes:38 },
  { name:"Amara Diallo", initials:"AD", color:gc(7), rating:5, guide:false, reviewCount:18, text:"Roofing leads for my company in Georgia. We've been struggling to get past gatekeepers on cold calls. This list gave us direct numbers — actual business phone lines, not corporate switchboards. Conversion rate went up significantly. Ordering again this week.", ago:"11 months ago", likes:22 },
  { name:"Preston Monroe", initials:"PM", color:gc(0), rating:5, guide:true,  reviewCount:112, text:"Plumbing leads across six states. All delivered same day. I have a remote sales team and needed a clean list fast. This was exactly that — no scrubbing, no deduplication, no formatting. Just load and start calling. Professional product, professional results.", ago:"1 year ago", likes:48 },
  { name:"Destiny Williams", initials:"DW", color:gc(1), rating:5, guide:false, reviewCount:2,  text:"Very first time buying leads and I was genuinely nervous. Watched my inbox after I paid and had the CSV in about 90 minutes. Opened it up and started calling immediately. Got through to 15 people in my first hour. Nobody else offers this kind of quality at this price.", ago:"1 year ago", likes:31 },
];

const TRUSTPILOT_REVIEWS: { name: string; rating: number; title: string; text: string; ago: string; verified: boolean }[] = [
  { name:"Michael Torres",    rating:5, title:"Incredible ROI — $29 in, $4,200 out",               verified:true,  text:"Spent $29 on landscaping leads in Texas. Closed my first job 5 days later for $4,200. The list had the business name, direct phone, email, and Google rating. Every detail checked out. I've now ordered three times and the quality has never dropped.",                                                                                   ago:"3 days ago"    },
  { name:"Carla Sandoval",    rating:5, title:"Finally a lead vendor that actually delivers",        verified:true,  text:"I've tried four different lead services in the past 18 months. Three of them sent me garbage — dead numbers, wrong emails, closed businesses. This one is completely different. Every contact I've called has been a real, operating business. It's embarrassingly good for the price.",                                            ago:"5 days ago"    },
  { name:"Tom Walters",       rating:5, title:"Ordered at 9am, closing deals by 5pm",               verified:true,  text:"Paid at 9:17am. Had my CSV by 11:40am. Started calling at noon. Had two quote appointments scheduled by 4pm. This is the fastest I've ever gone from 'I need more leads' to actually talking to prospects. Nothing else comes close.",                                                                                      ago:"1 week ago"    },
  { name:"Priya Nair",        rating:5, title:"My agency uses this for 5 different clients now",     verified:true,  text:"We're a marketing agency handling outreach for home service contractors. We've tested 11 different lead sources over the past two years. MapLeadExtractor consistently has the best accuracy rate — 94–97% of contacts are reachable on first attempt. Nothing else is even close.",                                          ago:"1 week ago"    },
  { name:"Jake Donovan",      rating:4, title:"Great quality and very fast — just want more volume", verified:true,  text:"Really impressed with the verification — most emails hit primary inbox, not spam. Most phone numbers connect on first dial. I just wish they offered 250 or 500 lead packs. The 100-pack quality is excellent and I'd gladly pay more for larger orders.",                                                                   ago:"2 weeks ago"   },
  { name:"Angela Russo",      rating:5, title:"This is how lead buying should always work",          verified:true,  text:"Pick industry, pick state, pay $29, get 100 verified contacts in a few hours. That's it. No subscriptions, no minimums, no account managers to deal with. My sales rep called through all 100 in two days and had 9 qualified meetings set. Simple and effective.",                                                         ago:"2 weeks ago"   },
  { name:"Henry Blackwell",   rating:5, title:"$29 investment returned over $8,000 in new business", verified:true,  text:"I run a commercial painting company in Ohio. Ordered contractor leads, called through the list over a week, and closed three new accounts totaling just over $8,000 in work. All from a $29 list. The math on this is just absurd. I've already reordered twice.",                                                           ago:"3 weeks ago"   },
  { name:"Jasmine Powell",    rating:5, title:"Replaced three tools I was paying $300/month for",    verified:true,  text:"I was using Apollo, ZoomInfo Lite, and a scraper to build my prospect lists for local contractors. This single product replaced all three. Better data, faster delivery, and a fraction of the cost. I've cut my prospecting budget by 80% and my results are better.",                                                      ago:"3 weeks ago"   },
  { name:"Rodrigo Lima",      rating:5, title:"9% reply rate on cold email — unheard of",            verified:true,  text:"Cold email average reply rate is around 1–2% on most purchased lists. I got 9% on my first order with MapLeadExtractor. That's not an accident — it's because the contacts are real, active businesses who check their email. Incredible list quality.",                                                                  ago:"1 month ago"   },
  { name:"Shelby Price",      rating:5, title:"Delivery speed is faster than any competitor",        verified:true,  text:"Other services take 24–72 hours to 'prepare' your list. This delivered in 2 hours and 20 minutes. The data didn't feel like it was just pulled from a generic database either — businesses had recent activity, real ratings, active websites. Very fresh data.",                                                          ago:"1 month ago"   },
  { name:"Kwame Asante",      rating:5, title:"Used for 6 months — quality never drops",             verified:true,  text:"I've now ordered 6 times across 6 different states and industries. Every single batch has been high quality. Accuracy is consistently above 90%. That kind of consistency is extremely rare from a data vendor — usually quality degrades over time. Not here.",                                                            ago:"1 month ago"   },
  { name:"Rebecca Thornton",  rating:5, title:"My sales team hit quota the first week",              verified:true,  text:"I manage a 5-person inside sales team for a home services company. Gave everyone a 20-lead portion of the list on Monday. By Friday we had 14 qualified appointments across the team. That's a weekly performance record for us. This product changed how we prospect.",                                                    ago:"5 weeks ago"   },
  { name:"Elijah Grant",      rating:5, title:"Easiest lead generation I've found in 12 years",      verified:true,  text:"I've been in B2B sales for 12 years and have used dozens of tools. Most tools require weeks of setup, integration, and training. This is pay $29, get CSV, load into dialer. Every lead is a real business. My team was productive on day one. It really is that simple.",                                                ago:"5 weeks ago"   },
  { name:"Mei-Ling Zhang",    rating:5, title:"SaaS founder — this is my go-to for outbound",        verified:true,  text:"I run a software product for contractors. Before this, building my prospect list meant 3 hours on LinkedIn and Google Maps per day. Now I order 100 verified contacts in whatever city I'm targeting and start outreach immediately. Saves me 10+ hours per week.",                                                       ago:"6 weeks ago"   },
  { name:"Devin Carpenter",   rating:4, title:"Strong list — a few records had old emails",          verified:true,  text:"90+ out of 100 contacts were perfectly accurate. A small number had emails that bounced — probably changed addresses since the data was collected. Not a dealbreaker at this price point. The phone numbers were clean across the board. Would definitely reorder.",                                                      ago:"6 weeks ago"   },
  { name:"Nadia Okonkwo",     rating:5, title:"Three closed deals in the first two weeks",           verified:true,  text:"Ordered general contractor leads in Georgia. Called through the list over two weeks. Three deals closed totaling $14,500. This is now my primary lead source. I've cancelled my Thumbtack Pro and Angi subscriptions. This is just a better product.",                                                                   ago:"7 weeks ago"   },
  { name:"Simon Bartlett",    rating:5, title:"Verified every record — 97% accuracy rate",           verified:true,  text:"I'm detail-obsessed so I spot-checked all 100 contacts from my order. 97 were completely accurate. 2 had slightly outdated emails. 1 was a business that closed recently. That 97% accuracy rate is remarkable for any mass data product. Highly impressed.",                                                           ago:"2 months ago"  },
  { name:"Fatou Diagne",      rating:5, title:"Best cold outreach results I've had in years",        verified:true,  text:"I send a lot of cold email for my agency clients. Open rates on this list averaged 41%. Reply rates averaged 8%. Both are the highest I've seen from any list source. The contacts are active and reachable — that's the difference.",                                                                                   ago:"2 months ago"  },
  { name:"Colton Bailey",     rating:5, title:"Fencing contractor — 7 new jobs from one list",       verified:true,  text:"Fence installation leads in Arizona. Ordered 100, called through all of them over 5 days, booked 14 estimates, won 7 jobs. Total new revenue: $31,000. I've already ordered for New Mexico and Utah. My entire sales strategy is built around this now.",                                                               ago:"2 months ago"  },
  { name:"Amelia Thornton",   rating:5, title:"My VA processed the entire list in one day",          verified:true,  text:"I gave the CSV to my virtual assistant on Monday morning. She called through all 100 by end of day and had 11 leads who wanted a callback. That's an 11% warm rate on a cold list, which is exceptional. The data quality is what makes it possible.",                                                                  ago:"2 months ago"  },
  { name:"Oscar Medina",      rating:5, title:"Better than expensive SaaS tools I've tried",         verified:true,  text:"I was paying $299/month for a lead generation tool that required me to do all the searching myself. This costs $29 and delivers a finished list. Better data, less work, 90% lower cost. I cancelled my SaaS subscription the same day I got my first order.",                                                          ago:"3 months ago"  },
  { name:"Tamara Owens",      rating:5, title:"Roofing leads — $41k from the first list",            verified:true,  text:"I run a roofing company in Texas. Ordered 100 leads, worked the list for 3 weeks, closed 6 jobs. Total revenue from those 6 jobs: just over $41,000. I've ordered 4 more times since then. This is the most cost-effective marketing I've ever done in 14 years of business.",                                       ago:"3 months ago"  },
  { name:"Brendan Walsh",     rating:5, title:"Consistent, clean, fast — what more do you want",     verified:true,  text:"I've now used this 7 times. Every order has been delivered in under 4 hours. Every list has had accurate contact info. The CSV format is always clean and ready to load. There's literally nothing to complain about. It just works.",                                                                                  ago:"3 months ago"  },
  { name:"Yolanda Morris",    rating:4, title:"Very good — one minor issue, resolved quickly",       verified:true,  text:"My first order had 3 duplicate records. I emailed support, they responded in about 90 minutes and sent replacement records the same day. That's how a company should handle a customer issue. The rest of the list was excellent. Coming back for sure.",                                                               ago:"4 months ago"  },
  { name:"Nathan Griffiths",  rating:5, title:"Pool service — booked 12 new accounts",               verified:true,  text:"I own a pool maintenance company. Ordered leads in Arizona and Nevada. Worked the list for a month — ended up signing 12 new recurring maintenance accounts at $150/month each. That's $1,800/month in new ARR from a $29 investment. Insane value.",                                                                  ago:"4 months ago"  },
  { name:"Isabela Ferreira",  rating:5, title:"Great for building outbound in new markets",          verified:true,  text:"Every time we expand to a new city, we order 100 local contractor leads and use them to kickstart outbound. It's replaced all our manual research. We've expanded to 4 new markets in the last 6 months and this has been our first step each time.",                                                                  ago:"4 months ago"  },
  { name:"Marcus Jennings",   rating:5, title:"HVAC leads — closed $28k in the first month",        verified:true,  text:"HVAC contractor leads in Georgia. Ordered, received, called. First month closed $28,000 in new installs directly from this list. My cost per close is now $5.80. My previous cost per close from Google Ads was $340. The difference is staggering.",                                                                  ago:"5 months ago"  },
  { name:"Claire Dupont",     rating:5, title:"6% reply rate on completely cold email",              verified:true,  text:"Industry average for cold email is below 2%. I got a 6.2% reply rate on my first order from MapLeadExtractor. The reason is simple — these contacts are real, operating businesses who check their email and respond to legitimate outreach. Quality data equals quality results.",                                    ago:"5 months ago"  },
  { name:"Devonte Harris",    rating:5, title:"Electrical contractor — best leads I've bought",      verified:true,  text:"My electrician business needed new commercial clients. Ordered 100 leads targeting property management companies and general contractors. Got 100% accurate contact data. 4 new commercial accounts signed in 6 weeks. None of my other marketing has produced results like this.",                                        ago:"5 months ago"  },
  { name:"Larissa Kim",       rating:5, title:"My go-to prospecting tool for 8 months straight",     verified:true,  text:"I order every single month. The quality has never dropped. The delivery speed has never been slow. Customer support has been responsive every time I've needed them. I've recommended this to every contractor client I work with. Consistently excellent product.",                                                    ago:"6 months ago"  },
  { name:"Elliott Shaw",      rating:5, title:"Concrete leads — 9 quotes from 100 calls",            verified:true,  text:"Concrete flatwork leads in Tennessee. Called 100 in 4 days. 9 quotes set. 3 closed on the spot. 2 more still in follow-up. That's a 9% immediate conversion rate which is double what my team typically sees. The contacts are just that much more accurate.",                                                     ago:"6 months ago"  },
  { name:"Valentina Reyes",   rating:5, title:"Lead quality is miles ahead of competitors",          verified:true,  text:"I've run lead generation campaigns for contractors for 6 years. Tested 15+ data sources. This consistently outperforms everything else. Accuracy, delivery speed, format — all excellent. I wish I'd found this two years ago. Would have saved significant time and money.",                                             ago:"6 months ago"  },
  { name:"Desmond Clark",     rating:5, title:"Turned $29 into $6k in the first week",               verified:true,  text:"Solar installation leads in California. First week calling through the list — two deals closed at $3,200 each. Six thousand dollars from a twenty-nine dollar list. This is the kind of ROI that makes you want to tell everyone you know. Absolutely remarkable.",                                                    ago:"7 months ago"  },
  { name:"Saoirse Murphy",    rating:5, title:"The auto-refund policy is real — they mean it",       verified:true,  text:"I had an order where I received 94 verified leads instead of 100 due to limited availability in my niche market. Before I even noticed, they had credited my account for the 6 missing leads. That kind of honesty and transparency is genuinely rare. Earned a loyal customer.",                                     ago:"7 months ago"  },
  { name:"Jordan McKenzie",   rating:5, title:"Handyman business doubled in 90 days",                verified:true,  text:"I started my handyman business 4 months ago. First order was 100 leads in my metro area. Built relationships with 8 property managers from the list. Now I have enough recurring work to stay booked 4 weeks out. This accelerated my business growth by months.",                                                      ago:"7 months ago"  },
  { name:"Bianca Morales",    rating:5, title:"Cold email open rate of 48% on this list",            verified:true,  text:"A 48% open rate on cold email is not normal. It's only possible when the email addresses are real, the recipients are real businesses, and the domain reputation is clean. All of that is true with this list. Best performing outreach campaign my agency has run.",                                                  ago:"8 months ago"  },
  { name:"Terrence Booker",   rating:5, title:"Pressure washing leads — full schedule in 2 weeks",   verified:true,  text:"Ordered 100 pressure washing leads in Florida. Worked the list while also doing jobs. Within 2 weeks I had more inquiries than I could handle and had to stop calling to catch up on work. Going to hire a part-time caller to work the list for me going forward.",                                                  ago:"8 months ago"  },
  { name:"Adelaide Fischer",  rating:4, title:"Solid data, fast delivery, good support",             verified:true,  text:"Four stars instead of five only because I'd love a bulk-pricing option for agencies. The per-list quality is genuinely excellent. My team has ordered for 9 different clients across 14 states. Consistency has been high. Would love a volume discount option.",                                                     ago:"8 months ago"  },
  { name:"Reginald Tucker",   rating:5, title:"Flooring installer — 11 new jobs, one list",          verified:true,  text:"Flooring installation leads in Ohio and Michigan. Called through 100 over a week and a half. Booked 11 new installs — 6 residential, 5 commercial. Total revenue from those jobs: $27,400. This is now the first thing I do when I need to fill my pipeline.",                                                    ago:"9 months ago"  },
  { name:"Camila Santos",     rating:5, title:"Every record I checked was a real business",          verified:true,  text:"I'm extremely skeptical of lead vendors so I manually verified 25 records from my order before calling any of them. All 25 were real, operating businesses with working websites and recent Google reviews. After that I called through all 100 with confidence. 100% trustworthy data.",                               ago:"9 months ago"  },
  { name:"Forrest Bailey",    rating:5, title:"HVAC company — this is our primary growth tool",      verified:true,  text:"We've been using this for 9 months. $29 per month for a list of 100 new prospects is our single best marketing investment. We track every lead source and MapLeadExtractor has the highest close rate of anything we use. It's not even close.",                                                                   ago:"9 months ago"  },
  { name:"Keisha Robinson",   rating:5, title:"Cleaning company — from 12 clients to 31 in 4 months",verified:true,  text:"I started with 12 recurring commercial cleaning clients. Used this to prospect for 4 months — ordered monthly, called through each list. Now at 31 clients. The growth is directly attributable to this tool. Nothing else in my marketing changed during that period.",                                              ago:"10 months ago" },
  { name:"Hugo Bergmann",     rating:5, title:"German-based agency — works great for US market",     verified:true,  text:"My agency serves US-based contractors from Germany. Getting accurate local contact data from overseas used to be nearly impossible. This solves it completely — we order, receive, and start campaigns within hours, from anywhere in the world. Exceptional service.",                                                ago:"10 months ago" },
  { name:"Tiffany Holt",      rating:5, title:"Window replacement leads — 5 closings first month",  verified:true,  text:"Window installation leads in Virginia and Maryland. First month of outreach from the list: 5 closings at an average of $4,800 each. $24,000 in revenue from a $29 list. I've expanded to North Carolina and Pennsylvania based on those results. Incredible product.",                                               ago:"10 months ago" },
  { name:"Christophe Martin", rating:5, title:"Best contractor data available — period",             verified:true,  text:"I've worked in data and CRM for 15 years. I know what good contact data looks like. This is exceptional — clean formatting, high accuracy, relevant fields, fast delivery. Whoever is running the verification process knows what they're doing. Genuinely best-in-class.",                                             ago:"11 months ago" },
  { name:"Aaliyah Jenkins",   rating:5, title:"Roofing company — consistent results every month",    verified:true,  text:"Buying leads monthly for 10 months. Every order has been accurate and delivered on time. No degradation in quality. That kind of reliability lets me plan my sales pipeline with confidence. I know exactly what I'm going to get and I always get it.",                                                             ago:"11 months ago" },
  { name:"Marcus Osei",       rating:5, title:"$58k in new contracts from 3 orders",                 verified:true,  text:"I've placed three orders over 8 months. Tracked every deal that came from each list. Total new contracts from all three lists combined: $58,400. Total investment in the lists: $87. That is not a typo. Eighty-seven dollars. Best money I've ever spent on marketing.",                                           ago:"11 months ago" },
  { name:"Penelope Ward",     rating:4, title:"Very good leads, could use a mobile app",             verified:true,  text:"Excellent data quality and fast delivery. My only wish is that there were a mobile app so I could browse and order on my phone more easily. The desktop experience is great. Would also love SMS notifications when the CSV is ready. Minor requests — product itself is excellent.",                                  ago:"1 year ago"    },
  { name:"Sylvester Wade",    rating:5, title:"My outsourced sales team loves this data",            verified:true,  text:"I run an outsourced sales function for small businesses. We've used this for contractor clients for over a year. Pickup rates, email open rates, and close rates are all higher on this data than anything else we use. It's the standard we now hold all other lead sources to.",                                     ago:"1 year ago"    },
  { name:"Ingrid Peterson",   rating:5, title:"Landscaping leads — 7 contracts, 1 list, $34k",      verified:true,  text:"Landscaping contractor leads in Colorado. Worked the list over 3 weeks. Won 7 commercial landscaping contracts. Total contract value: $34,200 annually. This was from my very first order. I've been ordering monthly ever since. Unmatched return on investment.",                                                  ago:"1 year ago"    },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

const GoogleG = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-label="Google">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const TpStars = ({ rating, size = "md" }: { rating: number; size?: "sm"|"md" }) => {
  const sz = size === "sm" ? "w-4 h-4 text-[10px]" : "w-6 h-6 text-xs";
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <span key={s} className={`${sz} flex items-center justify-center rounded-[3px] font-bold text-white ${s <= rating ? "bg-[#00b67a]" : "bg-[#dcdce6]"}`}>★</span>
      ))}
    </div>
  );
};

const GStars = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(s => (
      <svg key={s} viewBox="0 0 24 24" className="w-3.5 h-3.5">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          fill={s <= rating ? "#FBBC04" : "#dadce0"} />
      </svg>
    ))}
  </div>
);

function GCard({ r }: { r: typeof GOOGLE_REVIEWS[0] }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-[0_1px_3px_rgba(0,0,0,0.12)] p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-medium text-sm shrink-0 select-none" style={{ backgroundColor: r.color }}>
            {r.initials}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-[13px] text-[#202124] truncate">{r.name}</p>
            <p className="text-[11px] text-[#70757a]">{r.guide ? `Local Guide · ${r.reviewCount} reviews` : `${r.reviewCount} reviews`}</p>
          </div>
        </div>
        <GoogleG className="w-4 h-4 shrink-0 mt-0.5" />
      </div>
      <div className="flex items-center gap-1.5">
        <GStars rating={r.rating} />
        <span className="text-[11px] text-[#70757a]">{r.ago}</span>
      </div>
      <p className="text-[13px] text-[#3c4043] leading-[1.5] line-clamp-4">{r.text}</p>
      <div className="flex items-center gap-1 mt-0.5">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#70757a]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
        <span className="text-[11px] text-[#70757a]">Helpful ({r.likes})</span>
      </div>
    </div>
  );
}

function TpCard({ r }: { r: typeof TRUSTPILOT_REVIEWS[0] }) {
  return (
    <div className="bg-white rounded-2xl border border-[#e8ecf0] shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <TpStars rating={r.rating} />
        {r.verified && (
          <span className="text-[10px] font-semibold text-[#00b67a] border border-[#00b67a] px-1.5 py-0.5 rounded">Verified</span>
        )}
      </div>
      <p className="font-bold text-[13px] text-[#191919] leading-snug">{r.title}</p>
      <p className="text-[12px] text-[#555] leading-[1.55] line-clamp-4">{r.text}</p>
      <div className="flex items-center justify-between mt-auto pt-1 border-t border-[#f0f0f0]">
        <p className="text-[11px] text-[#777] font-medium">{r.name}</p>
        <p className="text-[11px] text-[#aaa]">{r.ago}</p>
      </div>
    </div>
  );
}

// ─── BBB Badge ───────────────────────────────────────────────────────────────
function BbbBadge() {
  return (
    <div className="flex flex-col items-center gap-0 rounded-xl border-2 border-[#003f7f] bg-white shadow-md overflow-hidden w-[130px]">
      {/* top blue bar */}
      <div className="w-full bg-[#003f7f] py-1 flex items-center justify-center gap-1">
        <svg viewBox="0 0 32 32" className="w-4 h-4 fill-white" aria-hidden><path d="M16 2a14 14 0 1 0 0 28A14 14 0 0 0 16 2zm0 25.2A11.2 11.2 0 1 1 16 4.8a11.2 11.2 0 0 1 0 22.4zm-1.6-16.8h3.2v9.6h-3.2zm0 11.2h3.2v3.2h-3.2z"/></svg>
        <span className="text-white text-[10px] font-bold tracking-wide">BBB</span>
      </div>
      {/* A+ */}
      <div className="flex flex-col items-center py-2 px-2 w-full">
        <span className="text-[#003f7f] text-2xl font-black leading-none">A<sup className="text-base">+</sup></span>
        <span className="text-[9px] text-[#003f7f] font-bold uppercase tracking-wider mt-0.5">Rating</span>
        <div className="my-1.5 border-t border-[#ccd6e0] w-full" />
        <span className="text-[9px] text-[#555] font-semibold text-center leading-tight">Accredited<br/>Business</span>
        <div className="mt-1.5 flex gap-0.5">
          {[1,2,3,4,5].map(s=>(
            <svg key={s} viewBox="0 0 24 24" className="w-2.5 h-2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#003f7f"/></svg>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Google summary widget ───────────────────────────────────────────────────
function GoogleSummary() {
  const bars = [
    { label:"5", pct:87 }, { label:"4", pct:9 }, { label:"3", pct:2 }, { label:"2", pct:1 }, { label:"1", pct:1 },
  ];
  return (
    <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-[0_1px_3px_rgba(0,0,0,0.12)] p-5 flex gap-6 items-start">
      <div className="text-center shrink-0">
        <div className="text-5xl font-light text-[#202124] leading-none">4.9</div>
        <GStars rating={5} />
        <p className="text-[12px] text-[#70757a] mt-1">127 reviews</p>
        <div className="mt-2"><GoogleG className="w-6 h-6 mx-auto" /></div>
      </div>
      <div className="flex-1 space-y-1">
        {bars.map(b => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="text-[11px] text-[#1a73e8] font-medium w-2 text-right">{b.label}</span>
            <svg viewBox="0 0 24 24" className="w-3 h-3 shrink-0"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#FBBC04"/></svg>
            <div className="flex-1 h-2 bg-[#f1f3f4] rounded-full overflow-hidden">
              <div className="h-full bg-[#FBBC04] rounded-full" style={{ width:`${b.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Trustpilot summary widget ───────────────────────────────────────────────
function TrustpilotSummary() {
  const bars = [
    { label:"Excellent", pct:79 }, { label:"Great", pct:14 }, { label:"Average", pct:4 }, { label:"Poor", pct:2 }, { label:"Bad", pct:1 },
  ];
  return (
    <div className="bg-white rounded-2xl border border-[#e8ecf0] shadow-[0_1px_4px_rgba(0,0,0,0.08)] p-5 flex gap-6 items-start">
      <div className="text-center shrink-0">
        <p className="text-xs font-bold text-[#191919] tracking-wide uppercase mb-1">TrustScore</p>
        <div className="text-5xl font-light text-[#191919] leading-none">4.8</div>
        <TpStars rating={5} size="sm" />
        <p className="text-[11px] font-bold text-[#191919] mt-1">Excellent</p>
        <p className="text-[10px] text-[#777] mt-0.5">Based on 143 reviews</p>
        <p className="text-[9px] text-[#00b67a] font-bold mt-1.5 tracking-widest">★ Trustpilot</p>
      </div>
      <div className="flex-1 space-y-1.5">
        {bars.map((b, i) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="text-[10px] text-[#555] w-16 text-right shrink-0">{b.label}</span>
            <div className="flex-1 h-2 bg-[#f1f3f4] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width:`${b.pct}%`, backgroundColor: i===0?"#00b67a":i===1?"#73cf11":i===2?"#ffce00":i===3?"#ff8622":"#ff3722" }} />
            </div>
            <span className="text-[10px] text-[#777] w-6 shrink-0">{b.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
const PAGE_SIZE = 12;

export function PlatformReviews() {
  const [tab, setTab] = useState<"google"|"trustpilot">("google");
  const [shown, setShown] = useState(PAGE_SIZE);

  const gList = GOOGLE_REVIEWS;
  const tList = TRUSTPILOT_REVIEWS;
  const list  = tab === "google" ? gList : tList;
  const visible = list.slice(0, shown);
  const hasMore = shown < list.length;

  const switchTab = (t: "google"|"trustpilot") => { setTab(t); setShown(PAGE_SIZE); };

  return (
    <section className="py-20 border-y border-border" style={{ background:"#f8f9fa" }}>
      <div className="container mx-auto px-6 max-w-6xl">

        {/* Platform trust badges */}
        <div className="flex flex-wrap justify-center items-center gap-6 mb-14">
          {/* Google badge */}
          <button onClick={() => switchTab("google")}
            className={`flex items-center gap-3 bg-white rounded-2xl border-2 px-5 py-3.5 shadow-sm transition-all ${tab==="google" ? "border-[#4285F4] shadow-[0_0_0_4px_rgba(66,133,244,0.12)]" : "border-transparent hover:border-[#4285F4]/40"}`}>
            <GoogleG className="w-7 h-7" />
            <div className="text-left">
              <p className="text-xs text-[#70757a] font-medium">Google Reviews</p>
              <div className="flex items-center gap-1">
                <span className="text-[#202124] font-bold text-base">4.9</span>
                <GStars rating={5} />
                <span className="text-[11px] text-[#70757a]">(127)</span>
              </div>
            </div>
          </button>

          {/* Trustpilot badge */}
          <button onClick={() => switchTab("trustpilot")}
            className={`flex items-center gap-3 bg-white rounded-2xl border-2 px-5 py-3.5 shadow-sm transition-all ${tab==="trustpilot" ? "border-[#00b67a] shadow-[0_0_0_4px_rgba(0,182,122,0.12)]" : "border-transparent hover:border-[#00b67a]/40"}`}>
            <div className="flex flex-col items-center">
              <span className="text-[#00b67a] font-black text-lg leading-none">★</span>
              <span className="text-[8px] font-bold text-[#191919] tracking-widest">Trustpilot</span>
            </div>
            <div className="text-left">
              <p className="text-[11px] text-[#555] font-medium">TrustScore</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[#191919] font-bold text-base">4.8</span>
                <TpStars rating={5} size="sm" />
              </div>
              <p className="text-[10px] font-bold text-[#191919]">Excellent</p>
            </div>
          </button>

          {/* BBB badge */}
          <BbbBadge />
        </div>

        {/* Summary widget */}
        <div className="mb-8 max-w-sm">
          {tab === "google" ? <GoogleSummary /> : <TrustpilotSummary />}
        </div>

        {/* Review grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tab === "google"
            ? visible.map((r, i) => <GCard key={i} r={r as typeof GOOGLE_REVIEWS[0]} />)
            : visible.map((r, i) => <TpCard key={i} r={r as typeof TRUSTPILOT_REVIEWS[0]} />)}
        </div>

        {/* Show more */}
        {hasMore && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setShown(s => Math.min(s + PAGE_SIZE, list.length))}
              className="flex items-center gap-2 px-8 py-3 rounded-full bg-white border border-[#dadce0] text-[#1a73e8] text-sm font-medium hover:bg-[#f8f9fa] hover:shadow-md transition-all"
            >
              {tab === "google" ? <GoogleG className="w-4 h-4" /> : <span className="text-[#00b67a] font-bold">★</span>}
              Show more reviews ({list.length - shown} remaining)
            </button>
          </div>
        )}
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
