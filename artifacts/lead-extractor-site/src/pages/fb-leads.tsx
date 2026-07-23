import { useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, Clock, ArrowRight } from "lucide-react";

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
  BigReveal,
  WhatYouGet,
  BuySection,
  BuyerReviews,
  HowItWorks,
  FaqSection,
  FinalCta,
} from "@/components/site/landing-sections";
import { useSeo } from "@/lib/seo";

// Dedicated Facebook-ad landing page (route: /get-leads). A stripped-down,
// single-offer conversion page — no site nav to leak clicks — that drives paid
// traffic straight to the LeadPackWidget checkout (the same one used on the
// home page and pricing). Kept out of the search index (noindex) since it's a
// paid-traffic destination, not an SEO page. Sections live in
// components/site/landing-sections.tsx, shared with the /go/:variant pages.
export default function FbLeads() {
  useSeo({
    title: "Local Business Leads With Phone, Email, Address & Social Links",
    description:
      "Every lead includes phone, email, address & social links. Get 100 scored, human-reviewed local business leads emailed as a clean CSV within hours. One-time $29. Refund if we come up short.",
    path: "/get-leads",
  });

  // Keep this paid-traffic LP out of the search index. Cleaned up on unmount so
  // it never leaks onto other SPA routes.
  useEffect(() => {
    const el = document.createElement("meta");
    el.setAttribute("name", "robots");
    el.setAttribute("content", "noindex, follow");
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">
      <LpHeader />

      <main>
        {/* Hero — copy left, example lead card right */}
        <section className="relative pt-16 pb-20 overflow-hidden">
          <HeroBackdrop />
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-14 lg:gap-10 items-center max-w-6xl mx-auto">
              <motion.div
                initial="hidden"
                animate="visible"
                variants={stagger}
                className="text-center lg:text-left"
              >
                <motion.div variants={fadeIn}>
                  <span className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-sm font-semibold">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    Fresh local leads — delivered today
                  </span>
                </motion.div>

                <motion.h1
                  variants={fadeIn}
                  className="text-4xl md:text-5xl xl:text-6xl font-display font-bold leading-[1.08] tracking-tight mb-6"
                >
                  Done Chasing Dead Leads?{" "}
                  <span className="text-primary">Get 100 Ready to Call Today</span>
                </motion.h1>

                <motion.p
                  variants={fadeIn}
                  className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed"
                >
                  No more all-night scraping, disconnected numbers, bounced emails, or $99/mo
                  tools. Pick your industry and city —{" "}
                  <strong className="text-foreground">
                    100 verified local businesses with direct phone, email &amp; socials
                  </strong>{" "}
                  land in your inbox within hours, so you can spend today closing instead of
                  searching.
                </motion.p>

                <motion.div
                  variants={fadeIn}
                  className="flex flex-col items-center lg:items-start gap-4"
                >
                  <a href="#buy" data-testid="btn-hero-cta" className={ctaButtonClass}>
                    Get My Lead Pack — $29 <ArrowRight className="w-5 h-5" />
                  </a>
                  <div className="flex items-baseline gap-2 text-sm text-muted-foreground">
                    <span className="line-through">$99</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
                      71% OFF today
                    </span>
                    <span>· that's 29¢ per lead</span>
                  </div>
                </motion.div>

                {/* Trust chips */}
                <motion.div
                  variants={fadeIn}
                  className="mt-9 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-sm text-muted-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> One-time payment — no
                    subscription
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" /> CSV emailed within hours
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-primary" /> Refund if we come up short
                  </span>
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.6, delay: 0.15 } }}
                className="max-w-md w-full mx-auto lg:mx-0"
              >
                <LeadPreviewPanel />
              </motion.div>
            </div>
          </div>
        </section>

        <StatsBar />

        <BigReveal />

        <WhatYouGet />

        <BuySection
          title="Build your lead pack"
          subtitle="Tell us the industry and location. Check availability instantly, then check out with secure Stripe. Your CSV is emailed after a quick quality review."
        />

        <BuyerReviews />

        <HowItWorks />

        <FaqSection />

        <FinalCta
          headline="Your next customers are one click away"
          subhead="Stop paying monthly for scrapers and stale lists. 100 targeted, human-reviewed local leads for a one-time $29 — in your inbox within hours. Refund if we come up short."
          ctaLabel="Get My Lead Pack — $29"
        />
      </main>

      {/* Mobile sticky CTA — most paid traffic is mobile */}
      <StickyCta label="Get 100 for $29" />

      <LpFooter />
    </div>
  );
}
