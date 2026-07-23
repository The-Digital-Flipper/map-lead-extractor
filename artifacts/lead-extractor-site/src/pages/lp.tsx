import { useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Lock, ArrowRight } from "lucide-react";

import StickyCta from "@/components/site/sticky-cta";
import {
  fadeIn,
  stagger,
  ctaButtonClass,
  LpHeader,
  LpFooter,
  HeroBackdrop,
  LeadPreviewPanel,
  StatsBar,
  WhatYouGet,
  BuySection,
  BuyerReviews,
  PlatformReviews,
  HowItWorks,
  FaqSection,
  FinalCta,
} from "@/components/site/landing-sections";
import NotFound from "@/pages/not-found";
import { useSeo } from "@/lib/seo";
import { SOCIAL_LANDING_PAGES } from "@/data/social-landing-pages";

// Social-traffic landing pages (route: /go/:variant). One conversion-tuned
// template, five sales angles — copy lives in data/social-landing-pages.ts and
// the admin Social tab hands out the links. Like /get-leads: no site nav to
// leak clicks, noindex since these are paid/social destinations, and the same
// LeadPackWidget doing the actual selling. Sections are shared with
// /get-leads via components/site/landing-sections.tsx.
export default function SocialLanding({ params }: { params: { variant: string } }) {
  const lp = SOCIAL_LANDING_PAGES.find((p) => p.slug === params.variant);

  useSeo({
    title: lp?.seoTitle ?? "MapLeadExtractor",
    description: lp?.seoDescription,
    path: `/go/${params.variant}`,
    // Per-variant ad creative (public/go/<slug>.jpg) so a shared link shows a
    // real picture card instead of the generic site preview.
    image: lp ? `https://mapleadextractor.net/go/${lp.slug}.jpg` : undefined,
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

  const buySection = (
    <BuySection
      title={lp.sampleFirst ? "Try it right here — free" : "Build your lead pack"}
      subtitle={
        lp.sampleFirst
          ? "Pick your industry and city. Preview 5 real leads instantly, then grab all 100 only if they look like money."
          : "Tell us the industry and location. Check availability instantly, then check out with secure Stripe. Your CSV is emailed after a quick quality review."
      }
    />
  );

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">
      <LpHeader />

      <main>
        {/* Hero */}
        <section className="relative pt-16 pb-20 overflow-hidden">
          <HeroBackdrop />
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
                <a href="#buy" data-testid="btn-hero-cta" className={ctaButtonClass}>
                  {lp.ctaLabel} <ArrowRight className="w-5 h-5" />
                </a>
                {!lp.sampleFirst && (
                  <div className="flex items-baseline gap-2 text-sm text-muted-foreground">
                    <span className="line-through">$99</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
                      71% OFF today
                    </span>
                    <span>· that's 29¢ per lead</span>
                  </div>
                )}
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5 text-primary" /> Money-back guarantee · Secure
                  Stripe checkout
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

              {/* Sample-first pages get the real preview widget right below —
                  everyone else sees what a delivered lead looks like. */}
              {!lp.sampleFirst && (
                <motion.div
                  variants={fadeIn}
                  className="max-w-md mx-auto mt-16"
                >
                  <LeadPreviewPanel />
                </motion.div>
              )}
            </motion.div>
          </div>
        </section>

        {/* Proof-first angles put the widget right under the hero */}
        {lp.sampleFirst && buySection}

        <StatsBar />

        <WhatYouGet />

        {/* Buy — the conversion widget (already shown up top on sample-first pages) */}
        {!lp.sampleFirst && buySection}

        <PlatformReviews />

        <BuyerReviews />

        <HowItWorks />

        <FaqSection />

        <FinalCta
          headline={lp.finalHeadline}
          subhead={lp.finalSubhead}
          ctaLabel={lp.ctaLabel}
        />
      </main>

      {/* Mobile sticky CTA — most social traffic is mobile */}
      <StickyCta
        label={lp.sampleFirst ? "See 5 Free Leads" : "Get 100 for $29"}
        free={lp.sampleFirst}
      />

      <LpFooter />
    </div>
  );
}
