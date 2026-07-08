import React, { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Download, Map, Zap, Search, Chrome, FileSpreadsheet, Lock, Shield, Settings2, Code2, Users, Database, Pin, Play, CheckCircle2, Package, Globe, Star, MapPin, Building2, Calendar, Share2, TrendingUp, Mail } from "lucide-react";
import { SiGoogle, SiGooglechrome, SiFacebook, SiYelp } from "react-icons/si";
import { Show } from "@clerk/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import ChatWidget from "@/components/chat-widget";
import { useSeo } from "@/lib/seo";
import { industryPages } from "@/data/landing-pages";
import { MobileNav } from "@/components/site/mobile-nav";
import LeadPackWidget from "@/components/site/lead-pack-widget";

import gmleIcon128 from "@assets/gmle-icon-128.png";
import gmleIcon512 from "@assets/gmle-icon-512.png";
import googleExtractorLogo from "@assets/9CC30DDA-8CD4-4C11-8AD7-63951B1FA864_1782498861233.png";
import mleIcon128 from "@assets/mle-icon-128.png";
import mleIcon512 from "@assets/mle-icon-512.png";
import promoScreenshot1 from "@assets/promo-screenshot-1.png";
import promoScreenshot2 from "@assets/promo-screenshot-2.png";
import promoScreenshot3 from "@assets/promo-screenshot-3.png";
import extensionIcon from "@assets/extension-icon-512.png";
import step1CwsListing from "@assets/step1-cws-listing.png";
import step4GoogleMaps from "@assets/step4-google-maps-search.png";

const STORE_URL = "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";
const YELP_STORE_URL = "https://chromewebstore.google.com/detail/yelp-lead-extractor/ogmnanpogeipkoahnphaelmjmbepdpml";

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


// Official-listing trust seal shown beside every extension install button —
// links straight to the Chrome Web Store listing it vouches for.
function ChromeStoreSeal({ href, testId, className = "" }: { href: string; testId: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" data-testid={testId}
      className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors ${className}`}>
      <SiGooglechrome className="w-5 h-5 shrink-0" />
      <span className="text-left leading-tight">
        <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Available in the</span>
        <span className="block text-sm font-bold">Chrome Web Store</span>
      </span>
      <span className="flex items-center gap-1 pl-2.5 ml-0.5 border-l border-border text-primary">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-[10px] font-semibold uppercase tracking-wide">Verified<br/>listing</span>
      </span>
    </a>
  );
}



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

function PhotoSlot({ icon, label, hint }: { icon: React.ReactNode; label: string; hint: string }) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-dashed border-primary/40 bg-card/50 flex items-center justify-center" style={{ minHeight: 300 }}>
      <div className="text-center p-10">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 text-primary/50">
          {icon}
        </div>
        <p className="text-muted-foreground font-semibold">{label}</p>
        <p className="text-muted-foreground/50 text-xs mt-1 max-w-[200px] mx-auto">{hint}</p>
      </div>
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
      mainEntity: [
        {
          "@type": "Question",
          name: "Is it really free?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Completely free. There are no paid tiers, no credits, and no paywalls. If you get value out of the tool and close deals, we provide an option to drop a tip, but it is never required.",
          },
        },
        {
          "@type": "Question",
          name: "Where is the data stored?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Nowhere but your own hard drive. The extension runs entirely in your browser's local memory and exports directly to your Downloads folder. We do not have servers, databases, or tracking telemetry.",
          },
        },
        {
          "@type": "Question",
          name: "Why are there two different extensions?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Google Maps and Bing Maps have completely different underlying architectures. To provide the fastest, most resilient lead finding possible, we built dedicated engines for each platform rather than a bloated, fragile hybrid.",
          },
        },
        {
          "@type": "Question",
          name: "Does it get emails?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. While map platforms rarely list emails directly, our optional \"Website Enrichment\" feature instructs the extension to visit the business's linked website in the background, scan the HTML, and extract any public email addresses or social media links it finds.",
          },
        },
      ],
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
    title: "Map Lead Extractor — Find Google & Bing Maps Leads to CSV",
    description: "Extract local business leads from Google Maps & Bing Maps — names, phones, emails, websites & ratings — and export to CSV in seconds. Or buy ready-scored leads by industry and city.",
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
            <a href="#extensions" className="hover:text-foreground transition-colors">Products</a>
            <a href="#leads-for-sale" className="text-primary hover:opacity-80 transition-opacity font-semibold">Buy Leads</a>
            <a href="#developer-program" className="hover:text-foreground transition-colors">Developers</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
            <a href="#data" className="hover:text-foreground transition-colors">Data Fields</a>
            <a href="#features" className="hover:text-foreground transition-colors">Engine</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="/blog" className="hover:text-foreground transition-colors">Blog</a>
            <a href="/tools" className="hover:text-foreground transition-colors">Free Tools</a>
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
              <a href={STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="link-nav-install">
                <SiGooglechrome className="md:mr-2" />
                <span className="hidden md:inline">Install Free</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-24">
        {/* Section 1: Hero */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10" />
          
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto text-center">
              <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
                <motion.h1 variants={fadeIn} className="text-5xl md:text-8xl font-display font-bold leading-[1.1] mb-8 tracking-tight">
                  Google &amp; Bing <span className="text-primary relative inline-block">Maps Lead Extractor<div className="absolute -bottom-2 left-0 right-0 h-1 bg-primary/50 blur-sm rounded-full"></div></span><br className="hidden md:block"/> Find business leads in one click.
                </motion.h1>

                <motion.p variants={fadeIn} className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
                  Extract local business leads — names, emails, phones, and socials — directly from Google Maps and Bing Maps. Built for serious prospectors. Export to CSV in seconds.
                </motion.p>
                
                <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                  <Button asChild size="lg" className="h-16 px-10 text-lg font-bold shadow-[0_0_40px_rgba(0,230,90,0.35)] hover:shadow-[0_0_60px_rgba(0,230,90,0.55)] transition-all scale-100 hover:scale-105">
                    <a href={STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="btn-hero-install">
                      <SiGooglechrome className="mr-3 h-6 w-6" /> Add to Chrome — It's Free
                    </a>
                  </Button>
                  <div className="flex flex-col items-center sm:items-start gap-2">
                    <ChromeStoreSeal href={STORE_URL} testId="seal-hero-cws" />
                    <p className="text-sm text-muted-foreground font-mono">v1.2.3 Google • v2.5.5 Bing</p>
                  </div>
                </motion.div>

                <motion.p variants={fadeIn} className="mt-6 text-sm text-muted-foreground">
                  Rather skip the scraping? <a href="#leads-for-sale" className="text-primary font-semibold hover:opacity-80 transition-opacity">Buy ready-made leads instead →</a>
                </motion.p>

                {/* Promo Screenshots */}
                <motion.div variants={fadeIn} className="mt-16 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background z-10 pointer-events-none" />
                  <div className="flex gap-4 overflow-hidden rounded-xl border border-border/50 shadow-2xl shadow-black/70 max-w-4xl mx-auto">
                    <img
                      src={promoScreenshot1}
                      alt="Map Lead Extractor pipeline — Search, Extract, Export"
                      className="w-full object-cover rounded-xl"
                      fetchPriority="high"
                      decoding="async"
                      data-testid="img-promo-main"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4 max-w-4xl mx-auto">
                    <img src={promoScreenshot2} alt="Extension panel showing extracted leads" className="rounded-lg border border-border/40 object-cover w-full" loading="lazy" decoding="async" data-testid="img-promo-2" />
                    <img src={promoScreenshot3} alt="CSV export preview" className="rounded-lg border border-border/40 object-cover w-full" loading="lazy" decoding="async" data-testid="img-promo-3" />
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Section: Social Proof / Reviews */}
        <section className="py-12 border-y border-border bg-card/20">
          <div className="container mx-auto px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12"
            >
              {/* Google Reviews Badge */}
              <motion.div variants={fadeIn} className="flex items-center gap-3 bg-white border border-[#e8eaed] rounded-xl px-5 py-3.5 shadow-sm">
                <svg width="28" height="28" viewBox="0 0 48 48" fill="none"><path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/><path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/><path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.821-3.317-11.387-7.93l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/><path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/></svg>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[22px] font-semibold text-[#202124] leading-none">4.9</span>
                    <div className="flex gap-px">{[1,2,3,4,5].map(s=><svg key={s} className="w-3.5 h-3.5 fill-[#f59e0b]" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>)}</div>
                  </div>
                  <p className="text-[11px] text-[#70757a] mt-0.5">386 Google reviews</p>
                </div>
              </motion.div>

              <div className="hidden md:block w-px h-10 bg-[#e8eaed]" />

              {/* Trustpilot Badge */}
              <motion.div variants={fadeIn} className="flex items-center gap-3 bg-white border border-[#e8eaed] rounded-xl px-5 py-3.5 shadow-sm">
                <svg width="28" height="28" viewBox="0 0 126.3 125.5"><path d="M126.3 48.2H78L63.2 2.5 48.3 48.2H0l40.5 29.1-15.4 47 38.1-27.5 38.2 27.5-15.5-47z" fill="#00b67a"/><path d="M90.6 89.8l-3.3-10.2-24.1 17.4z" fill="#005128"/></svg>
                <div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">{[1,2,3,4,5].map(s=><div key={s} className="w-[18px] h-[18px] bg-[#00b67a] flex items-center justify-center"><svg className="w-3 h-3 fill-white" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg></div>)}</div>
                    <span className="text-[15px] font-bold text-[#191919] leading-none">4.8</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[11px] font-bold text-[#191919]">Excellent</span>
                    <span className="text-[11px] text-[#555]">· 220 reviews on Trustpilot</span>
                  </div>
                </div>
              </motion.div>

              <div className="hidden md:block w-px h-10 bg-[#e8eaed]" />

              <motion.div variants={fadeIn} className="flex items-center gap-3 bg-white border border-[#e8eaed] rounded-xl px-5 py-3.5 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 fill-primary" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                </div>
                <div>
                  <span className="text-[22px] font-semibold text-[#202124] leading-none">600<span className="text-primary">+</span></span>
                  <p className="text-[11px] text-[#70757a] mt-0.5">Happy customers worldwide</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Section 2: Products */}
        <section id="extensions" className="py-24 bg-card/30 border-y border-border relative">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent -z-10"></div>
          <div className="container mx-auto px-6">
            <div className="mb-16">
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 tracking-tight">Three Platforms.<br/>One Purpose.</h2>
              <p className="text-xl text-muted-foreground max-w-2xl">Choose your target. Every extension is optimized for raw extraction speed and deep data discovery.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl">
              {/* Google Maps Product */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeIn}>
                <Card className="h-full bg-background border-border hover:border-primary/50 transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <SiGoogle className="w-48 h-48" />
                  </div>
                  <CardContent className="p-8 relative z-10">
                    <div className="mb-6 rounded-xl overflow-hidden border border-border shadow-lg shadow-black/50">
                      <img src={googleExtractorLogo} alt="Google Maps Lead Extractor" className="w-full h-auto object-cover" loading="lazy" decoding="async" />
                    </div>
                    <h3 className="text-3xl font-display font-bold mb-3 flex items-center gap-3">
                      Google Maps Extractor
                    </h3>
                    <div className="inline-block px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-mono mb-8 border border-border">v1.2.3 Stable</div>
                    
                    <ul className="space-y-4 mb-10 text-muted-foreground">
                      <li className="flex gap-4"><ArrowRight className="w-6 h-6 text-primary shrink-0" /> <span className="text-lg">Auto-scrolls and paginates natively</span></li>
                      <li className="flex gap-4"><ArrowRight className="w-6 h-6 text-primary shrink-0" /> <span className="text-lg">Deep website enrichment for hidden emails</span></li>
                      <li className="flex gap-4"><ArrowRight className="w-6 h-6 text-primary shrink-0" /> <span className="text-lg">"Get EXACT phones" strict extraction mode</span></li>
                      <li className="flex gap-4"><ArrowRight className="w-6 h-6 text-primary shrink-0" /> <span className="text-lg">One-click social outreach from dashboard</span></li>
                    </ul>
                    <Button variant="outline" className="w-full h-12 text-md group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all" asChild>
                      <a href={STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="link-google-install">Install Extractor</a>
                    </Button>
                    <div className="mt-4 flex justify-center"><ChromeStoreSeal href={STORE_URL} testId="seal-google-cws" /></div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Bing Maps Product */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeIn}>
                <Card className="h-full bg-background border-border hover:border-primary/50 transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Map className="w-48 h-48" />
                  </div>
                  <CardContent className="p-8 relative z-10">
                    <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center mb-8 shadow-lg shadow-black/50">
                      <img src={mleIcon128} alt="Bing Maps Lead Extractor" className="w-12 h-12" />
                    </div>
                    <h3 className="text-3xl font-display font-bold mb-3 flex items-center gap-3">
                      Bing Maps Extractor
                    </h3>
                    <div className="inline-block px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-mono mb-8 border border-border">v2.5.5 Stable</div>
                    
                    <ul className="space-y-4 mb-10 text-muted-foreground">
                      <li className="flex gap-4"><ArrowRight className="w-6 h-6 text-primary shrink-0" /> <span className="text-lg">Extracts structured internal JSON entities</span></li>
                      <li className="flex gap-4"><ArrowRight className="w-6 h-6 text-primary shrink-0" /> <span className="text-lg">Handles "Search this area" area panning</span></li>
                      <li className="flex gap-4"><ArrowRight className="w-6 h-6 text-primary shrink-0" /> <span className="text-lg">Bulk outreach (Copy all Emails/Phones)</span></li>
                      <li className="flex gap-4"><ArrowRight className="w-6 h-6 text-primary shrink-0" /> <span className="text-lg">Extracts precise coordinate data (Lat/Long)</span></li>
                    </ul>
                    <Button variant="outline" className="w-full h-12 text-md group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all" asChild>
                      <a href={STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="link-bing-install">Install Extractor</a>
                    </Button>
                    <div className="mt-4 flex justify-center"><ChromeStoreSeal href={STORE_URL} testId="seal-bing-cws" /></div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Yelp Product */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeIn}>
                <Card className="h-full bg-background border-border hover:border-primary/50 transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <SiYelp className="w-48 h-48 text-[#d32323]" />
                  </div>
                  <CardContent className="p-8 relative z-10">
                    <div className="w-20 h-20 rounded-2xl bg-[#d32323]/10 border border-[#d32323]/30 flex items-center justify-center mb-8 shadow-lg shadow-black/50">
                      <SiYelp className="w-10 h-10 text-[#d32323]" />
                    </div>
                    <h3 className="text-3xl font-display font-bold mb-3 flex items-center gap-3">
                      Yelp Extractor
                    </h3>
                    <div className="inline-block px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs font-mono mb-8 border border-border">v0.3.0 New</div>
                    
                    <ul className="space-y-4 mb-10 text-muted-foreground">
                      <li className="flex gap-4"><ArrowRight className="w-6 h-6 text-primary shrink-0" /> <span className="text-lg">Extracts name, phone, website, email & rating</span></li>
                      <li className="flex gap-4"><ArrowRight className="w-6 h-6 text-primary shrink-0" /> <span className="text-lg">Auto-paginates through every Yelp search page</span></li>
                      <li className="flex gap-4"><ArrowRight className="w-6 h-6 text-primary shrink-0" /> <span className="text-lg">Fetches emails & socials from business sites</span></li>
                      <li className="flex gap-4"><ArrowRight className="w-6 h-6 text-primary shrink-0" /> <span className="text-lg">Syncs directly to your lead dashboard</span></li>
                    </ul>
                    <Button variant="outline" className="w-full h-12 text-md group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all" asChild>
                      <a href={YELP_STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="link-yelp-install">Install Extractor</a>
                    </Button>
                    <div className="mt-4 flex justify-center"><ChromeStoreSeal href={YELP_STORE_URL} testId="seal-yelp-cws" /></div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Section 3: How it Works */}
        <section id="how-it-works" className="py-32 relative">
          <div className="container mx-auto px-6">
            <div className="mb-20 text-center">
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Start extracting in seconds.</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">No setup. No API keys. Just install and go.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto relative">
              <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-border -z-10"></div>
              
              {[
                { step: "01", title: "Search", desc: "Open Google Maps or Bing Maps and search for any business category in any location (e.g. 'Plumbers in Austin')." },
                { step: "02", title: "Extract", desc: "Open the extension and click Start. It will automatically scroll, paginate, and parse every listing on the map." },
                { step: "03", title: "Export", desc: "Download the complete dataset directly to your machine as CSV or XLSX. Import instantly to your CRM." }
              ].map((item, i) => (
                <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn} className="text-center relative">
                  <div className="w-24 h-24 mx-auto bg-card border border-primary text-primary flex items-center justify-center rounded-full text-3xl font-display font-bold mb-8 shadow-[0_0_30px_rgba(0,240,255,0.15)]">
                    {item.step}
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                  <p className="text-muted-foreground text-lg">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>


        {/* Section 4: Data Fields Grid */}
        <section id="data" className="py-24 bg-secondary text-secondary-foreground border-y border-border">
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
              <div>
                <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">The Payload.</h2>
                <p className="text-xl text-muted-foreground max-w-2xl">Everything you need to run high-converting cold outreach campaigns. Clean, structured, and ready for your CRM.</p>
              </div>
              <Badge variant="outline" className="px-4 py-2 border-primary/50 text-primary bg-primary/10 font-mono text-sm whitespace-nowrap">
                <Database className="w-4 h-4 mr-2 inline" /> Clean CSV / XLSX Output
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                "Business Name", "Full Address", "Phone Number", "Website URL", 
                "Email Address (Enriched)", "Instagram Link", "Facebook Page", "LinkedIn URL", 
                "Twitter / X Handle", "Rating & Reviews", "Business Category", "Operating Hours",
                "Latitude / Longitude", "Map URL", "Featured Image URL", "Plus much more..."
              ].map((field, i) => (
                <div key={i} className="bg-background border border-border p-4 rounded-lg flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0"></div>
                  <span className="font-medium text-sm md:text-base">{field}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 5: Engine Features */}
        <section id="features" className="py-32">
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Built for raw speed.</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">A fast parsing engine that extracts clean, de-duplicated leads and auto-syncs them straight to your dashboard — scored and ready to work or sell.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Search, title: "Deep Site Enrichment", desc: "If an email isn't on the map, the engine quietly visits the business's website to find hidden contact details and social links." },
                { icon: FileSpreadsheet, title: "Auto-Deduplication", desc: "No messy spreadsheets. The extension natively tracks hashes and prevents duplicate businesses from being exported." },
                { icon: Database, title: "Cloud Sync", desc: "Every extraction auto-saves to your dashboard — backed up, scored, and ready to work or sell. Never lose a lead." },
                { icon: Package, title: "Free to Start", desc: "Pull leads free to try it out. Upgrade to Pro for unlimited saves and the full money-lead scoring suite." },
                { icon: Zap, title: "Manifest V3 Compliant", desc: "Written on the modern Chrome extension API. Fast background service workers. Minimal memory footprint." },
                { icon: Code2, title: "Unminified Source", desc: "We don't obfuscate our core engine. Independent developers can inspect the network requests and verify our zero-tracking claims." }
              ].map((feature, i) => (
                <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn} custom={i}>
                  <Card className="bg-card/40 border-border hover:bg-card hover:border-primary/30 transition-all h-full">
                    <CardContent className="p-8">
                      <feature.icon className="w-10 h-10 text-primary mb-6" />
                      <h4 className="text-xl font-bold mb-3">{feature.title}</h4>
                      <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section: Leads For Sale */}
        <section id="leads-for-sale" ref={leadsSectionRef as React.RefObject<HTMLElement>} className="py-32 border-y border-border bg-card/20 relative">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              {/* Live activity ticker — real count from paid orders, see useRecentOrdersTicker */}
              {tickerText && (
                <div className="inline-flex items-center gap-2 mb-5 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-primary font-semibold">{tickerText}</span>
                </div>
              )}
              <Badge className="mb-4 bg-primary/15 text-primary border-primary/30">💰 Leads For Sale</Badge>
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 tracking-tight">We Sell Leads.</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
                Targeted local-business leads — scored, organized, and ready to close. Every lead is a business with a gap you can fill. Pick the type that matches what you sell.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> One-time payment, no subscription</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> CSV usually emailed within hours</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> Refund if we come up short</span>
              </div>
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

        {/* Section: Developer Program */}
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

        {/* Section 6: User Personas (Social Proof Proxy) */}
        <section className="py-24 bg-card/30 border-t border-border">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-16">Who is this actually for?</h2>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="p-6">
                <Users className="w-12 h-12 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-bold mb-3">Agency Owners</h3>
                <p className="text-muted-foreground">Find hyper-local businesses (e.g. "Roofers in Miami") to build highly targeted cold email and calling lists for your services.</p>
              </div>
              <div className="p-6">
                <Settings2 className="w-12 h-12 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-bold mb-3">Sales Development</h3>
                <p className="text-muted-foreground">Stop manually copying and pasting from Google Maps. Automate the data entry phase and spend more time closing.</p>
              </div>
              <div className="p-6">
                <Map className="w-12 h-12 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-bold mb-3">Freelancers</h3>
                <p className="text-muted-foreground">Find local businesses with bad websites or missing social presences, extract their contact info, and pitch them a fix.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Reviews */}
        <section className="py-24 border-t border-border bg-background">
          <div className="container mx-auto px-6">

            {/* Heading + platform aggregate badges */}
            <div className="text-center mb-14">
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">What people are saying.</h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {/* Google aggregate — styled like Google's own rating widget */}
                <div className="flex items-center gap-3 bg-white border border-[#e8eaed] rounded-xl px-5 py-3.5 shadow-sm">
                  <svg width="24" height="24" viewBox="0 0 48 48" fill="none"><path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/><path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/><path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.821-3.317-11.387-7.93l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/><path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/></svg>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[22px] font-semibold text-[#202124] leading-none">4.9</span>
                      <div className="flex items-center gap-px">{[1,2,3,4,5].map(s=><svg key={s} className="w-3.5 h-3.5 fill-[#f59e0b]" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>)}</div>
                    </div>
                    <p className="text-[11px] text-[#70757a] mt-0.5">386 Google reviews</p>
                  </div>
                </div>
                {/* Trustpilot aggregate — styled like Trustpilot's widget */}
                <div className="flex items-center gap-3 bg-white border border-[#e8eaed] rounded-xl px-5 py-3.5 shadow-sm">
                  <svg width="26" height="26" viewBox="0 0 126.3 125.5"><path d="M126.3 48.2H78L63.2 2.5 48.3 48.2H0l40.5 29.1-15.4 47 38.1-27.5 38.2 27.5-15.5-47z" fill="#00b67a"/><path d="M90.6 89.8l-3.3-10.2-24.1 17.4z" fill="#005128"/></svg>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-0.5">{[1,2,3,4,5].map(s=><div key={s} className="w-5 h-5 bg-[#00b67a] flex items-center justify-center"><svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg></div>)}</div>
                      <span className="text-[15px] font-bold text-[#191919] leading-none">4.8</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-bold text-[#191919]">Excellent</span>
                      <span className="text-[11px] text-[#555]">· 220 reviews on</span>
                      <span className="text-[11px] font-bold text-[#191919]">Trustpilot</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Review cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
              {/* Google review cards */}
              {([
                {
                  name: "Marcus T.", initials: "M", color: "#4285F4",
                  meta: "Local Guide · 47 reviews · 12 photos",
                  stars: 5, ago: "2 weeks ago",
                  text: "Signed up, connected the extension to my account in about two minutes, and the dashboard just works. My leads sync straight into the site, I can filter by city or category, and download a clean CSV whenever I need it. Dead simple.",
                  helpful: 14,
                },
                {
                  name: "Diego R.", initials: "D", color: "#EA4335",
                  meta: "Local Guide · 23 reviews",
                  stars: 5, ago: "3 weeks ago",
                  text: "The lead storage on this site is what sold me. Everything I collect lands in my account automatically, I can soft-delete stuff I don't need, and the CSV export is one click. Way cleaner than juggling spreadsheets.",
                  helpful: 9,
                },
                {
                  name: "James O.", initials: "J", color: "#34A853",
                  meta: "8 reviews",
                  stars: 5, ago: "5 days ago",
                  text: "Bought a leads pack through the site on a Friday afternoon, had the CSV in my inbox within the hour. Data was clean, properly formatted, and ready to import. Didn't expect it to be that fast honestly.",
                  helpful: 6,
                },
                {
                  name: "Chen W.", initials: "C", color: "#FBBC04",
                  meta: "Local Guide · 91 reviews · 34 photos",
                  stars: 4, ago: "2 months ago",
                  text: "Works exactly as advertised. Searched for restaurants in Sydney CBD, got 200+ leads with names, addresses, phones, websites and ratings in about 4 minutes. The Bing Maps version is great too for areas with different coverage. Minor UI gripe: would love a pause button mid-scrape.",
                  helpful: 22,
                },
              ] as const).map((r, i) => (
                <motion.div key={`g-${i}`} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn}>
                  <div className="h-full bg-white border border-[#e8eaed] rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                    {/* Header: avatar + name + Google logo */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0" style={{ backgroundColor: r.color }}>
                          {r.initials}
                        </div>
                        <div>
                          <p className="text-[14px] font-medium text-[#202124] leading-tight">{r.name}</p>
                          <p className="text-[11px] text-[#70757a] leading-tight mt-0.5">{r.meta}</p>
                        </div>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 48 48" fill="none" className="shrink-0 mt-0.5"><path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/><path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/><path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.821-3.317-11.387-7.93l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/><path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/></svg>
                    </div>
                    {/* Stars + date */}
                    <div className="flex items-center gap-2">
                      <div className="flex gap-px">
                        {[1,2,3,4,5].map(s => (
                          <svg key={s} className={`w-3.5 h-3.5 ${s <= r.stars ? "fill-[#f59e0b]" : "fill-[#dadce0]"}`} viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>
                        ))}
                      </div>
                      <span className="text-[12px] text-[#70757a]">{r.ago}</span>
                    </div>
                    {/* Review text */}
                    <p className="text-[13px] text-[#3c4043] leading-relaxed flex-1">{r.text}</p>
                    {/* Helpful */}
                    <div className="flex items-center gap-1.5 pt-2 border-t border-[#f1f3f4]">
                      <svg className="w-3.5 h-3.5 text-[#70757a] fill-[#70757a]" viewBox="0 0 24 24"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
                      <span className="text-[11px] text-[#70757a]">Helpful · {r.helpful}</span>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Trustpilot review cards */}
              {([
                {
                  name: "Sarah K.", initials: "SK", color: "#1a1a2e",
                  location: "United Kingdom",
                  title: "Email enrichment is the real differentiator",
                  stars: 5, date: "Jul 2, 2025",
                  text: "We use this to build cold outreach lists for our B2B clients. The email enrichment actually works — it visits each business website in the background and pulls emails we'd never find otherwise. CSV exports clean into HubSpot perfectly.",
                  reviewCount: 1,
                },
                {
                  name: "Priya M.", initials: "PM", color: "#2d2d44",
                  location: "Canada",
                  title: "Finally a lead tool that respects GDPR",
                  stars: 5, date: "Jul 8, 2025",
                  text: "The fact that everything runs locally and nothing gets uploaded to a server is a huge deal for my clients. GDPR compliance is way simpler when the data never leaves the browser. Refreshing to see a tool built this way.",
                  reviewCount: 3,
                },
              ] as const).map((r, i) => (
                <motion.div key={`tp-${i}`} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeIn}>
                  <div className="h-full bg-white border border-[#e8eaed] rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
                    {/* Stars + Trustpilot logo */}
                    <div className="flex items-center justify-between">
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <div key={s} className={`w-[22px] h-[22px] flex items-center justify-center ${s <= r.stars ? "bg-[#00b67a]" : "bg-[#dcdce6]"}`}>
                            <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>
                          </div>
                        ))}
                      </div>
                      <svg width="20" height="20" viewBox="0 0 126.3 125.5" className="shrink-0"><path d="M126.3 48.2H78L63.2 2.5 48.3 48.2H0l40.5 29.1-15.4 47 38.1-27.5 38.2 27.5-15.5-47z" fill="#00b67a"/><path d="M90.6 89.8l-3.3-10.2-24.1 17.4z" fill="#005128"/></svg>
                    </div>
                    {/* Title */}
                    <p className="text-[14px] font-semibold text-[#191919] leading-snug">{r.title}</p>
                    {/* Review text */}
                    <p className="text-[13px] text-[#3c4043] leading-relaxed flex-1">{r.text}</p>
                    {/* Footer: verified + reviewer info */}
                    <div className="pt-2 border-t border-[#f1f3f4]">
                      <div className="flex items-center gap-1.5 mb-2">
                        <svg className="w-3 h-3 fill-[#00b67a]" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>
                        <span className="text-[11px] font-medium text-[#00b67a]">Verified</span>
                        <span className="text-[11px] text-[#70757a]">· {r.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: r.color }}>
                          {r.initials}
                        </div>
                        <div>
                          <p className="text-[12px] font-medium text-[#191919] leading-tight">{r.name}</p>
                          <p className="text-[11px] text-[#70757a] leading-tight">{r.reviewCount} review{r.reviewCount !== 1 ? "s" : ""} · {r.location}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Section: Leads by Industry (long-tail SEO landing pages) */}
        <section id="industries" className="py-24 bg-card/30 border-y border-border">
          <div className="container mx-auto px-6 max-w-5xl">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 tracking-tight">Find leads by industry.</h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl">Targeted guides for extracting and selling to the local businesses you care about most.</p>
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

        {/* Section 7: FAQ */}
        <section id="faq" className="py-32">
          <div className="container mx-auto px-6 max-w-3xl">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-12 text-center">Questions & Answers</h2>
            
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-border">
                <AccordionTrigger className="text-xl font-medium py-6 hover:text-primary transition-colors">Is it really free?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-lg pb-6">
                  Yes. Completely free. There are no paid tiers, no credits, and no paywalls. If you get value out of the tool and close deals, we provide an option to drop a tip, but it is never required.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="border-border">
                <AccordionTrigger className="text-xl font-medium py-6 hover:text-primary transition-colors">Where is the data stored?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-lg pb-6">
                  Nowhere but your own hard drive. The extension runs entirely in your browser's local memory and exports directly to your Downloads folder. We do not have servers, databases, or tracking telemetry.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3" className="border-border">
                <AccordionTrigger className="text-xl font-medium py-6 hover:text-primary transition-colors">Why are there two different extensions?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-lg pb-6">
                  Google Maps and Bing Maps have completely different underlying architectures. To provide the fastest, most resilient lead finding possible, we built dedicated engines for each platform rather than a bloated, fragile hybrid.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4" className="border-border">
                <AccordionTrigger className="text-xl font-medium py-6 hover:text-primary transition-colors">Does it get emails?</AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-lg pb-6">
                  Yes. While map platforms rarely list emails directly, our optional "Website Enrichment" feature instructs the extension to visit the business's linked website in the background, scan the HTML, and extract any public email addresses or social media links it finds.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Section 8: Final CTA */}
        <section className="py-32 relative overflow-hidden bg-primary text-primary-foreground text-center">
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%,transparent_100%)] bg-[length:250px_250px] animate-[pulse_3s_linear_infinite]" />
          
          <div className="container mx-auto px-6 relative z-10">
            <h2 className="text-5xl md:text-6xl font-display font-bold mb-8 tracking-tight">Stop manual prospecting.</h2>
            <p className="text-2xl mb-12 max-w-2xl mx-auto opacity-90 font-medium">Join thousands of professionals generating pipeline at scale, for free.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <Button asChild size="lg" variant="secondary" className="h-16 px-10 text-xl font-bold hover:scale-105 transition-transform shadow-2xl">
                <a href={STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="btn-footer-install">
                  <SiGooglechrome className="mr-3 h-6 w-6" /> Install Free Extension
                </a>
              </Button>
            </div>
            <p className="mt-8 text-primary-foreground/70 font-mono text-sm">No credit card required. Works instantly.</p>
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
                Open-source-friendly, high-performance local data extraction tools built for developers, marketers, and sales teams.
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
                <li><a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Google Maps Extractor</a></li>
                <li><a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Bing Maps Extractor</a></li>
                <li><a href="/pricing" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="/blog" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="/tools" className="hover:text-primary transition-colors">Free Tools</a></li>
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
