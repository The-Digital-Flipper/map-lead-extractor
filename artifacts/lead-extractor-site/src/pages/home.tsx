import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Map, Zap, Users, Settings2, Code2, Star, MapPin, Building2, Calendar, Share2, TrendingUp, Mail, Globe, CheckCircle2, Package, ArrowRight } from "lucide-react";
import { SiGoogle, SiGooglechrome, SiFacebook } from "react-icons/si";
import { Show } from "@clerk/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
            ? `${data.count} lead pack${data.count === 1 ? "" : "s"} sold this week`
            : "New this week — be one of our first buyers"
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return text;
}

// Buyer-focused FAQ — every answer states only what the product actually does.
const FAQ = [
  { q: "How fast do I get my leads?", a: "Most packs are delivered within hours of ordering. Every list is human-reviewed before it ships, so at busy times it can take a little longer — but it arrives as a clean CSV in your email inbox, ready to import into any CRM or spreadsheet." },
  { q: "What's included with each lead?", a: "Business name, phone number, website, address, star rating and review count, and business category — plus a public email address when one can be found on the business's website. Each lead also carries the gap signal you bought it for, like \"no website\" or \"few reviews\", so you know exactly what to pitch." },
  { q: "What if my pack comes up short?", a: "You get an automatic refund for the difference. If you order 100 leads and we can only deliver 82 that pass review, you're refunded for the 18 we couldn't fill — you only ever pay for leads you actually receive." },
  { q: "Where do the leads come from?", a: "Public business listings on Google Maps and Bing Maps, enriched with contact details from each business's own website. Dead and closed businesses are removed, duplicates are stripped, and every list is spot-checked by a human before delivery." },
  { q: "Can I pick the industry and location?", a: "Yes — tell us any business type and any US city or state (for example \"roofers in Mobile, AL\") and the list is built to that spec. If you're not sure what to target, the industry pages below show what sells best for each vertical." },
];

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

export default function Home() {
  const [chatOpen, setChatOpen] = useState(false);
  const chatFiredRef = useRef(false);
  const leadsSectionRef = useRef<HTMLElement>(null);
  const tickerText = useRecentOrdersTicker();

  useEffect(() => {
    const el = leadsSectionRef.current;
    if (!el) return;
    let hasBeenVisible = false;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hasBeenVisible = true;
        } else if (hasBeenVisible && !chatFiredRef.current) {
          chatFiredRef.current = true;
          setTimeout(() => setChatOpen(true), 600);
        }
      },
      { threshold: 0.1 }
    );
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
    const existing = document.getElementById("faqpage-jsonld-home");
    if (existing) existing.remove();
    document.head.appendChild(script);
    return () => {
      document.getElementById("faqpage-jsonld-home")?.remove();
    };
  }, []);

  useSeo({
    title: "Buy Local Business Leads — Human-Reviewed Lists by Industry & City | Map Lead Extractor",
    description: "Done-for-you local business lead lists: pick an industry and city, get a clean, human-reviewed CSV — names, phones, emails, websites & ratings. 100 targeted leads for $29, delivered in hours.",
    path: "/",
  });
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <Zap className="w-5 h-5 text-primary" />
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </a>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
            <a href="#leads-for-sale" className="text-primary hover:opacity-80 transition-opacity font-semibold">Buy Leads</a>
            <a href="#industries" className="hover:text-foreground transition-colors">Industries</a>
            <a href="/free-tool" className="hover:text-foreground transition-colors">Free Tool</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="/blog" className="hover:text-foreground transition-colors">Blog</a>
            <a href="/tools" className="hover:text-foreground transition-colors">Calculators</a>
            <a href="/scraper" className="hover:text-foreground transition-colors">Scraper</a>
          </nav>
          <div className="flex items-center gap-3">
            <Show when="signed-in">
              <a href="/dashboard" className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity">
                Dashboard
              </a>
            </Show>
            <Show when="signed-out">
              <a href="/sign-in" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </a>
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

      <main className="pt-24">
        {/* Section 1: Hero — the lead-list offer */}
        <section className="relative pt-20 pb-28 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10" />

          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto text-center">
              <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
                {tickerText && (
                  <motion.div variants={fadeIn} className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    <span className="text-primary font-semibold">{tickerText}</span>
                  </motion.div>
                )}
                <motion.h1 variants={fadeIn} className="text-5xl md:text-7xl font-display font-bold leading-[1.1] mb-8 tracking-tight">
                  Buy ready-to-close <span className="text-primary relative inline-block">local business leads<div className="absolute -bottom-2 left-0 right-0 h-1 bg-primary/50 blur-sm rounded-full"></div></span><br className="hidden md:block"/> for any industry, in any city.
                </motion.h1>

                <motion.p variants={fadeIn} className="text-xl md:text-2xl text-muted-foreground mb-6 max-w-3xl mx-auto leading-relaxed">
                  Tell us the business type and area — we deliver a clean, human-reviewed CSV with names, phones, emails, websites, and ratings. <span className="text-foreground font-semibold">100 targeted leads for $29</span>, usually within hours.
                </motion.p>

                <motion.div variants={fadeIn} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground mb-6">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> One-time payment, no subscription</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Every lead human-reviewed</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Refund if we come up short</span>
                </motion.div>

                <motion.p variants={fadeIn} className="text-sm text-primary font-semibold mb-12">
                  🚀 We just launched — founding buyers lock in $29 per 100-lead pack and get priority delivery.
                </motion.p>

                <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                  <Button asChild size="lg" className="h-16 px-10 text-lg font-bold shadow-[0_0_40px_rgba(0,230,90,0.35)] hover:shadow-[0_0_60px_rgba(0,230,90,0.55)] transition-all scale-100 hover:scale-105">
                    <a href="#leads-for-sale" data-testid="btn-hero-buy-leads">
                      <Package className="mr-3 h-6 w-6" /> Browse Lead Packs
                    </a>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-16 px-10 text-lg font-bold">
                    <a href="/free-tool" data-testid="btn-hero-free-tool">
                      <SiGooglechrome className="mr-3 h-6 w-6" /> Try the Free Tool
                    </a>
                  </Button>
                </motion.div>

                <motion.p variants={fadeIn} className="mt-6 text-sm text-muted-foreground">
                  Prefer to pull leads yourself? Our free Chrome extension extracts them straight from Google &amp; Bing Maps — <a href="/free-tool" className="text-primary font-semibold hover:opacity-80 transition-opacity">check it out →</a>
                </motion.p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Section 2: Leads For Sale */}
        <section id="leads-for-sale" ref={leadsSectionRef as React.RefObject<HTMLElement>} className="py-32 border-y border-border bg-card/20 relative">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-primary/15 text-primary border-primary/30">💰 Leads For Sale</Badge>
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 tracking-tight">Pick the leads that match what you sell.</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
                Targeted local-business leads — scored, organized, and ready to close. Every lead is a business with a gap you can fill.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Globe, title: "No-Website Businesses", desc: "Local businesses with no website at all — the easiest, highest-value web-design sale.", sell: "Sell: website builds" },
                { icon: Code2, title: "Outdated / Broken Sites", desc: "Sites that are dead, not mobile-friendly, or years out of date.", sell: "Sell: redesigns" },
                { icon: Star, title: "Few or No Reviews", desc: "Businesses with little to no social proof — prime for review generation.", sell: "Sell: reputation" },
                { icon: TrendingUp, title: "Low-Rating Businesses", desc: "Under 4 stars — owners actively worried about their reputation.", sell: "Sell: reputation mgmt" },
                { icon: Share2, title: "No Social Presence", desc: "No Facebook, Instagram, or socials — wide open for social setup.", sell: "Sell: social media" },
                { icon: Calendar, title: "No Online Booking", desc: "No scheduling or booking system — ready for automation tools.", sell: "Sell: automation" },
                { icon: MapPin, title: "Weak Map Profiles", desc: "Incomplete Google / Bing listings missing hours, photos, or info.", sell: "Sell: local SEO" },
                { icon: Building2, title: "By Industry", desc: "Dentists, lawyers, roofers, HVAC, plumbers, contractors, salons, restaurants & more.", sell: "High-LTV verticals" },
                { icon: Map, title: "By Territory", desc: "Filtered to any US state or city you want to work — exclusive areas available.", sell: "Pick your market" },
              ].map((lead, i) => (
                <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn} custom={i}>
                  <Card className="bg-card/40 border-border hover:bg-card hover:border-primary/30 transition-all h-full">
                    <CardContent className="p-7">
                      <lead.icon className="w-9 h-9 text-primary mb-5" />
                      <h4 className="text-lg font-bold mb-2">{lead.title}</h4>
                      <p className="text-muted-foreground leading-relaxed text-sm mb-4">{lead.desc}</p>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold">{lead.sell}</span>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Conversion box */}
            <div className="mt-14">
              <LeadPackWidget />
            </div>
          </div>
        </section>

        {/* Section 3: Leads by Industry (long-tail SEO landing pages) */}
        <section id="industries" className="py-24 bg-card/30 border-b border-border">
          <div className="container mx-auto px-6 max-w-5xl">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 tracking-tight">Buy leads by industry.</h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl">Targeted guides for reaching and selling to the local businesses you care about most.</p>
            <div className="flex flex-wrap gap-3">
              {industryPages.map((p) => (
                <a
                  key={p.slug}
                  href={`/leads/${p.slug}`}
                  className="px-5 py-3 rounded-xl border border-border bg-background font-medium hover:border-primary hover:text-primary transition-colors"
                  data-testid={`link-industry-${p.slug}`}
                >
                  {p.industry} leads
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Section: How every list is built — process proof */}
        <section id="process" className="py-24">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">How every list is built.</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">No recycled databases, no stale exports — your pack is built to order and checked by a human before it ships.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 max-w-5xl mx-auto">
              {[
                { step: "01", title: "Pulled fresh", desc: "Sourced from live Google & Bing Maps listings for your exact industry and area." },
                { step: "02", title: "Deduped & cleaned", desc: "Duplicates stripped, dead and closed businesses removed." },
                { step: "03", title: "Enriched", desc: "Emails and social links pulled from each business's own website." },
                { step: "04", title: "Human-reviewed", desc: "A person spot-checks phones, emails, and locations before delivery." },
                { step: "05", title: "Refund-backed", desc: "Short pack? The difference is refunded automatically — no asking." },
              ].map((item, i) => (
                <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn} className="text-center">
                  <div className="w-14 h-14 mx-auto bg-card border border-primary/40 text-primary flex items-center justify-center rounded-full text-lg font-display font-bold mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-bold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 4: Free tool teaser */}
        <section className="py-24">
          <div className="container mx-auto px-6">
            <div className="max-w-4xl mx-auto rounded-2xl border border-border bg-card/40 p-10 md:p-14 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10"><SiGooglechrome className="w-40 h-40" /></div>
              <Badge className="mb-4 bg-primary/15 text-primary border-primary/30">🎁 Free Tool</Badge>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 tracking-tight">Want to pull leads yourself? Take our free extension.</h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                The same engine behind our lead lists is a free Chrome extension — extract business names, phones, emails, and websites straight from Google Maps, Bing Maps, and Yelp. No signup, no credit card.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button asChild size="lg" className="font-bold">
                  <a href="/free-tool" data-testid="btn-teaser-free-tool">
                    <ArrowRight className="mr-2 h-5 w-5" /> See the Free Tool
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="font-bold">
                  <a href={STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="btn-teaser-install">
                    <SiGooglechrome className="mr-2 h-5 w-5" /> Install from Chrome Web Store
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Who buys these leads */}
        <section className="py-24 bg-card/30 border-y border-border">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-16">Who buys our leads?</h2>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="p-6">
                <Users className="w-12 h-12 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-bold mb-3">Agency Owners</h3>
                <p className="text-muted-foreground">Buy hyper-local lists (e.g. "Roofers in Miami with no website") and walk into every pitch already knowing the gap you're selling against.</p>
              </div>
              <div className="p-6">
                <Settings2 className="w-12 h-12 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-bold mb-3">Sales Development</h3>
                <p className="text-muted-foreground">Skip the data-entry phase entirely. Your reps start the week with a clean, deduplicated call list instead of building one.</p>
              </div>
              <div className="p-6">
                <Map className="w-12 h-12 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-bold mb-3">Freelancers</h3>
                <p className="text-muted-foreground">Get a list of local businesses with bad websites or missing socials, and pitch the fix — the lead tells you exactly what to offer.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Developer Program */}
        <section id="developer-program" className="py-32 relative">
          <div className="container mx-auto px-6 text-center max-w-2xl">
            <Badge className="mb-4 bg-primary/15 text-primary border-primary/30">⚡ Developer Program</Badge>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 tracking-tight">We have a developer program.</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Building something with leads? We work with developers and partners on custom integrations and programmatic access. Reach out and tell us what you're building.
            </p>
            <a
              href="mailto:support@mapleadextractor.net?subject=Developer%20Program%20Application&body=Tell%20us%20what%20you%27re%20building%20and%20how%20you%20want%20to%20use%20our%20leads%3A%0A%0A"
              data-testid="link-developer-apply"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">
              <Mail className="w-5 h-5" /> Apply for access
            </a>
            <p className="text-xs text-muted-foreground mt-4">Opens an email to support@mapleadextractor.net — we reply within 1–2 business days.</p>
          </div>
        </section>

        {/* Section 7: FAQ */}
        <section id="faq" className="py-32 bg-card/20 border-t border-border">
          <div className="container mx-auto px-6 max-w-3xl">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-12 text-center">Questions & Answers</h2>

            <Accordion type="single" collapsible className="w-full">
              {FAQ.map((f, i) => (
                <AccordionItem key={i} value={`item-${i + 1}`} className="border-border">
                  <AccordionTrigger className="text-xl font-medium py-6 hover:text-primary transition-colors">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-lg pb-6">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <PlatformReviews />
        <BuyerReviews />

        {/* Section 8: Final CTA */}
        <section className="py-32 relative overflow-hidden bg-primary text-primary-foreground text-center">
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%,transparent_100%)] bg-[length:250px_250px] animate-[pulse_3s_linear_infinite]" />

          <div className="container mx-auto px-6 relative z-10">
            <h2 className="text-5xl md:text-6xl font-display font-bold mb-8 tracking-tight">Stop hunting. Start closing.</h2>
            <p className="text-2xl mb-12 max-w-2xl mx-auto opacity-90 font-medium">Your next 100 customers are already on the map. We'll put them in your inbox — reviewed, scored, and ready to call.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <Button asChild size="lg" variant="secondary" className="h-16 px-10 text-xl font-bold hover:scale-105 transition-transform shadow-2xl">
                <a href="#leads-for-sale" data-testid="btn-footer-buy-leads">
                  <Package className="mr-3 h-6 w-6" /> Get My Leads
                </a>
              </Button>
            </div>
            <p className="mt-8 text-primary-foreground/70 font-mono text-sm">100 targeted leads for $29. Refund if we come up short.</p>
          </div>
        </section>
      </main>

      {/* Section 9: Footer */}
      <footer className="bg-card border-t border-border py-16">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 font-display font-bold text-xl text-foreground mb-4">
                <Zap className="w-5 h-5 text-primary" /> MapLeadExtractor
              </div>
              <p className="text-muted-foreground text-sm max-w-sm mb-6">
                Done-for-you local business lead lists by industry and city — plus free, high-performance extraction tools for doing it yourself.
              </p>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded bg-background border border-border flex items-center justify-center"><SiGooglechrome className="text-muted-foreground w-5 h-5" /></div>
                <div className="w-10 h-10 rounded bg-background border border-border flex items-center justify-center"><SiGoogle className="text-muted-foreground w-5 h-5" /></div>
                <div className="w-10 h-10 rounded bg-background border border-border flex items-center justify-center"><Map className="text-muted-foreground w-5 h-5" /></div>
                <a
                  href="https://www.facebook.com/share/1bhu8ciaU8/?mibextid=wwXIfr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded bg-background border border-border flex items-center justify-center hover:border-primary hover:text-primary transition-colors"
                  aria-label="Facebook"
                >
                  <SiFacebook className="text-muted-foreground hover:text-primary w-5 h-5 transition-colors" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-4">Products</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#leads-for-sale" className="hover:text-primary transition-colors">Buy Lead Packs</a></li>
                <li><a href="/free-tool" className="hover:text-primary transition-colors">Free Chrome Extension</a></li>
                <li><a href="/pricing" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="/blog" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="/tools" className="hover:text-primary transition-colors">Free Calculators</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="/privacy" className="hover:text-primary transition-colors">Privacy Policy (We track nothing)</a></li>
                <li><a href="/terms" className="hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="mailto:support@mapleadextractor.net" className="hover:text-primary transition-colors">Contact Support</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
            <div>&copy; {new Date().getFullYear()} MapLeadExtractor. All rights reserved.</div>
            <div className="flex items-center gap-6 mt-4 md:mt-0">
              <a href="/admin-login" rel="nofollow" className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">Admin</a>
              <div className="font-mono text-xs text-primary">v1.2.3 // v2.5.5 // STABLE</div>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating sales chat (ChatGPT-powered) */}
      <ChatWidget externalOpen={chatOpen} onExternalOpenHandled={() => setChatOpen(false)} />
    </div>
  );
}
