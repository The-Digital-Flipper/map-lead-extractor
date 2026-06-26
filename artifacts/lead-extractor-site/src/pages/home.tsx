import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Download, Map, Zap, Search, Chrome, FileSpreadsheet, Lock, Shield, Settings2, Code2, Users, Database, Pin, MousePointerClick, Play, CheckCircle2, Package } from "lucide-react";
import { SiGoogle, SiGooglechrome } from "react-icons/si";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import gmleIcon128 from "@assets/gmle-icon-128.png";
import gmleIcon512 from "@assets/gmle-icon-512.png";
import mleIcon128 from "@assets/mle-icon-128.png";
import mleIcon512 from "@assets/mle-icon-512.png";
import promoScreenshot1 from "@assets/promo-screenshot-1.png";
import promoScreenshot2 from "@assets/promo-screenshot-2.png";
import promoScreenshot3 from "@assets/promo-screenshot-3.png";
import extensionIcon from "@assets/extension-icon-512.png";

const STORE_URL = "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";

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
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-primary-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-bold text-xl tracking-tight">
            <Zap className="w-5 h-5 text-primary" />
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
            <a href="#extensions" className="hover:text-foreground transition-colors">Products</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
            <a href="#data" className="hover:text-foreground transition-colors">Data Fields</a>
            <a href="#features" className="hover:text-foreground transition-colors">Engine</a>
            <a href="#install-tutorial" className="hover:text-foreground transition-colors">Install Guide</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <Button asChild size="sm" className="font-bold">
            <a href={STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="link-nav-install">
              <SiGooglechrome className="mr-2" /> Install Free
            </a>
          </Button>
        </div>
      </header>

      <main className="pt-24">
        {/* Section 1: Hero */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background -z-10" />
          
          <div className="container mx-auto px-6">
            <div className="max-w-5xl mx-auto text-center">
              <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
                <motion.div variants={fadeIn} className="flex justify-center mb-6">
                  <Badge variant="outline" className="px-4 py-1.5 border-primary/50 text-primary bg-primary/10 font-mono text-xs uppercase tracking-wider">
                    <Shield className="w-3.5 h-3.5 mr-2 inline" /> 100% Local. No server. No subscriptions.
                  </Badge>
                </motion.div>
                
                <motion.h1 variants={fadeIn} className="text-5xl md:text-8xl font-display font-bold leading-[1.1] mb-8 tracking-tight">
                  Scrape business leads <br className="hidden md:block"/> from <span className="text-primary relative inline-block">Maps<div className="absolute -bottom-2 left-0 right-0 h-1 bg-primary/50 blur-sm rounded-full"></div></span> in one click.
                </motion.h1>
                
                <motion.p variants={fadeIn} className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
                  Extract names, emails, phones, and socials directly from Google Maps and Bing Maps. Built for serious prospectors. Export to CSV in seconds.
                </motion.p>
                
                <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-6 justify-center items-center">
                  <Button asChild size="lg" className="h-16 px-10 text-lg font-bold shadow-[0_0_40px_rgba(0,230,90,0.35)] hover:shadow-[0_0_60px_rgba(0,230,90,0.55)] transition-all scale-100 hover:scale-105">
                    <a href={STORE_URL} target="_blank" rel="noopener noreferrer" data-testid="btn-hero-install">
                      <SiGooglechrome className="mr-3 h-6 w-6" /> Add to Chrome — It's Free
                    </a>
                  </Button>
                  <p className="text-sm text-muted-foreground font-mono">v1.2.3 Google • v2.5.5 Bing</p>
                </motion.div>

                {/* Promo Screenshots */}
                <motion.div variants={fadeIn} className="mt-16 relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background z-10 pointer-events-none" />
                  <div className="flex gap-4 overflow-hidden rounded-xl border border-border/50 shadow-2xl shadow-black/70 max-w-4xl mx-auto">
                    <img
                      src={promoScreenshot1}
                      alt="Map Lead Extractor pipeline — Search, Extract, Export"
                      className="w-full object-cover rounded-xl"
                      data-testid="img-promo-main"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4 max-w-4xl mx-auto">
                    <img src={promoScreenshot2} alt="Extension panel showing extracted leads" className="rounded-lg border border-border/40 object-cover w-full" data-testid="img-promo-2" />
                    <img src={promoScreenshot3} alt="CSV export preview" className="rounded-lg border border-border/40 object-cover w-full" data-testid="img-promo-3" />
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
              <motion.div variants={fadeIn} className="flex items-center gap-4 bg-background border border-border rounded-2xl px-6 py-4 shadow-lg shadow-black/40 hover:border-primary/40 transition-colors min-w-[260px]">
                <div className="shrink-0">
                  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
                    <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
                    <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.311 0-9.821-3.317-11.387-7.93l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
                    <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Google Reviews</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1,2,3,4,5].map(s => (
                        <svg key={s} className="w-4 h-4 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>
                      ))}
                    </div>
                    <span className="font-display font-bold text-xl text-foreground">4.9</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5"><span className="text-primary font-bold">386</span> verified reviews</p>
                </div>
              </motion.div>

              {/* Divider */}
              <div className="hidden md:block w-px h-16 bg-border" />

              {/* Trustpilot Badge */}
              <motion.div variants={fadeIn} className="flex items-center gap-4 bg-background border border-border rounded-2xl px-6 py-4 shadow-lg shadow-black/40 hover:border-primary/40 transition-colors min-w-[260px]">
                <div className="shrink-0">
                  <svg width="36" height="36" viewBox="0 0 126.3 125.5" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M126.3 48.2H78L63.2 2.5 48.3 48.2H0l40.5 29.1-15.4 47 38.1-27.5 38.2 27.5-15.5-47z" fill="#00b67a"/>
                    <path d="M90.6 89.8l-3.3-10.2-24.1 17.4z" fill="#005128"/>
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Trustpilot</span>
                    <span className="text-[11px] font-bold bg-[#00b67a] text-white px-1.5 py-0.5 rounded font-mono">Excellent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <div key={s} className="w-4 h-4 bg-[#00b67a] flex items-center justify-center rounded-sm">
                          <svg className="w-3 h-3 text-white fill-white" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>
                        </div>
                      ))}
                    </div>
                    <span className="font-display font-bold text-xl text-foreground">4.8</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5"><span className="text-primary font-bold">220</span> verified reviews</p>
                </div>
              </motion.div>

              {/* Divider */}
              <div className="hidden md:block w-px h-16 bg-border" />

              {/* Total stat */}
              <motion.div variants={fadeIn} className="text-center">
                <p className="text-4xl font-display font-bold text-foreground">600<span className="text-primary">+</span></p>
                <p className="text-sm text-muted-foreground mt-1">Happy customers worldwide</p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Section 2: Products */}
        <section id="extensions" className="py-24 bg-card/30 border-y border-border relative">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent -z-10"></div>
          <div className="container mx-auto px-6">
            <div className="mb-16">
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 tracking-tight">Two Architectures.<br/>One Purpose.</h2>
              <p className="text-xl text-muted-foreground max-w-2xl">Choose your target. Both extensions are optimized for raw extraction speed and deep data discovery.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-6xl">
              {/* Google Maps Product */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={fadeIn}>
                <Card className="h-full bg-background border-border hover:border-primary/50 transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <SiGoogle className="w-48 h-48" />
                  </div>
                  <CardContent className="p-8 relative z-10">
                    <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center mb-8 shadow-lg shadow-black/50">
                      <img src={gmleIcon128} alt="Google Maps Lead Extractor" className="w-12 h-12" />
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

        {/* Section: Install Tutorial */}
        <section id="install-tutorial" className="py-24 border-y border-border relative overflow-hidden">
          <div className="absolute -left-32 top-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
          <div className="absolute -right-32 bottom-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -z-10" />
          <div className="container mx-auto px-6">
            <div className="text-center mb-20">
              <Badge variant="outline" className="px-4 py-1.5 border-primary/50 text-primary bg-primary/10 font-mono text-xs uppercase tracking-wider mb-4">
                <Chrome className="w-3.5 h-3.5 mr-2 inline" /> Installation Guide
              </Badge>
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 tracking-tight">
                How to Install the<br /><span className="text-primary">Google Maps Extractor</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Up and running in under 60 seconds. No account. No credit card. Follow these 6 steps.
              </p>
            </div>

            <div className="max-w-5xl mx-auto space-y-20">

              {/* Step 1 */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={fadeIn} className="grid md:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-lg shrink-0">1</div>
                    <p className="font-mono text-xs text-primary uppercase tracking-widest">Step 1</p>
                  </div>
                  <h3 className="text-2xl font-display font-bold mb-3">Go to the Chrome Web Store</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">Open Google Chrome and visit the extension's official Chrome Web Store page. You'll see the extension name, icon, ratings, and user reviews confirming it's the right one.</p>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Search "Google Maps Lead Extractor" in the Chrome Web Store</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Or click the button below to go directly</li>
                  </ul>
                  <Button asChild size="sm" className="font-bold">
                    <a href={STORE_URL} target="_blank" rel="noopener noreferrer"><SiGooglechrome className="mr-2" /> Open Chrome Web Store</a>
                  </Button>
                </div>
                <div className="rounded-2xl border border-border overflow-hidden shadow-2xl shadow-black/60">
                  {/* Browser chrome */}
                  <div className="bg-[#3c4043] px-3 py-2 flex items-center gap-2">
                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f57]"/><div className="w-3 h-3 rounded-full bg-[#febc2e]"/><div className="w-3 h-3 rounded-full bg-[#28c840]"/></div>
                    <div className="flex-1 bg-[#202124] rounded text-[10px] text-[#9aa0a6] px-3 py-1 font-mono truncate">chromewebstore.google.com/detail/google-maps-lead-extractor</div>
                  </div>
                  {/* CWS page mockup */}
                  <div className="bg-white p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shrink-0 shadow">
                        <Map className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-gray-900 leading-tight">Google Maps Lead Extractor</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">offered by MapLeadExtractor</p>
                        <div className="flex items-center gap-1 mt-1">
                          {[1,2,3,4,5].map(s => <svg key={s} className="w-3 h-3 fill-yellow-400" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>)}
                          <span className="text-[10px] text-gray-500 ml-1">386 ratings</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">👤 100,000+ users</p>
                      </div>
                      <div className="shrink-0">
                        <div className="bg-[#1a73e8] text-white text-[11px] font-bold px-4 py-2 rounded-full ring-2 ring-[#1a73e8] ring-offset-2 ring-offset-white animate-pulse">
                          Add to Chrome
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {["Extract Emails","Export CSV","No Signup"].map(t => <span key={t} className="text-[9px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>)}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Step 2 */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={fadeIn} className="grid md:grid-cols-2 gap-10 items-center">
                <div className="md:order-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-lg shrink-0">2</div>
                    <p className="font-mono text-xs text-primary uppercase tracking-widest">Step 2</p>
                  </div>
                  <h3 className="text-2xl font-display font-bold mb-3">Click "Add to Chrome" & Confirm</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">Click the blue "Add to Chrome" button on the store page. Chrome will show a permissions popup listing what the extension can access. Click "Add extension" to confirm.</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> The extension only reads the Maps page — no private data access</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Installation takes under 5 seconds</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> No account or sign-in required</li>
                  </ul>
                </div>
                <div className="md:order-1 rounded-2xl border border-border overflow-hidden shadow-2xl shadow-black/60">
                  <div className="bg-[#3c4043] px-3 py-2 flex items-center gap-2">
                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f57]"/><div className="w-3 h-3 rounded-full bg-[#febc2e]"/><div className="w-3 h-3 rounded-full bg-[#28c840]"/></div>
                    <div className="flex-1 bg-[#202124] rounded text-[10px] text-[#9aa0a6] px-3 py-1 font-mono truncate">chromewebstore.google.com</div>
                  </div>
                  <div className="bg-white p-6 flex justify-center">
                    <div className="w-72 border border-gray-300 rounded-xl shadow-xl p-5">
                      <p className="text-[13px] font-bold text-gray-900 mb-1">Add "Google Maps Lead Extractor"?</p>
                      <p className="text-[11px] text-gray-500 mb-3">It can:</p>
                      <ul className="space-y-1.5 mb-4">
                        {["Read and change your data on maps.google.com","Display notifications"].map(p => (
                          <li key={p} className="flex gap-2 text-[11px] text-gray-700"><span className="text-[#1a73e8] mt-0.5">•</span>{p}</li>
                        ))}
                      </ul>
                      <div className="flex gap-2">
                        <button className="flex-1 border border-gray-300 rounded text-[11px] py-1.5 text-gray-700 font-medium">Cancel</button>
                        <button className="flex-1 bg-[#1a73e8] text-white rounded text-[11px] py-1.5 font-bold ring-2 ring-[#1a73e8] ring-offset-1">Add extension</button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Step 3 */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={fadeIn} className="grid md:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-lg shrink-0">3</div>
                    <p className="font-mono text-xs text-primary uppercase tracking-widest">Step 3</p>
                  </div>
                  <h3 className="text-2xl font-display font-bold mb-3">Pin the Extension to Your Toolbar</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">After installing, click the puzzle piece 🧩 icon in the top-right of Chrome. Find "Google Maps Lead Extractor" in the list and click the pin icon next to it. This keeps the button always visible.</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Pinning is optional but highly recommended</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> You can also access it from the Extensions menu anytime</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-border overflow-hidden shadow-2xl shadow-black/60">
                  <div className="bg-[#3c4043] px-3 py-2 flex items-center gap-2">
                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f57]"/><div className="w-3 h-3 rounded-full bg-[#febc2e]"/><div className="w-3 h-3 rounded-full bg-[#28c840]"/></div>
                    <div className="flex-1 bg-[#202124] rounded text-[10px] text-[#9aa0a6] px-3 py-1 font-mono">maps.google.com</div>
                    {/* Toolbar icons */}
                    <div className="flex items-center gap-1">
                      <div className="w-6 h-6 rounded bg-[#e8f0fe] flex items-center justify-center text-[#1a73e8] text-[10px] font-bold ring-2 ring-[#1a73e8]">🧩</div>
                    </div>
                  </div>
                  <div className="bg-white">
                    {/* Extensions dropdown */}
                    <div className="mx-auto w-64 border border-gray-200 rounded-b-xl shadow-lg bg-white overflow-hidden">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-[11px] font-bold text-gray-800">Extensions</p>
                      </div>
                      {[
                        { name: "AdBlock Plus", pinned: false },
                        { name: "Google Maps Lead Extractor", pinned: true, highlight: true },
                        { name: "Grammarly", pinned: false },
                      ].map(ext => (
                        <div key={ext.name} className={`flex items-center gap-2 px-3 py-2 ${ext.highlight ? "bg-blue-50" : ""}`}>
                          <div className={`w-5 h-5 rounded flex items-center justify-center text-[8px] shrink-0 ${ext.highlight ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"}`}>
                            {ext.highlight ? <Map className="w-3 h-3" /> : ""}
                          </div>
                          <span className={`text-[10px] flex-1 ${ext.highlight ? "font-bold text-gray-900" : "text-gray-600"}`}>{ext.name}</span>
                          <div className={`w-4 h-4 flex items-center justify-center ${ext.highlight ? "text-[#1a73e8]" : "text-gray-300"}`}>
                            <Pin className="w-3 h-3" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="h-8 bg-white" />
                  </div>
                </div>
              </motion.div>

              {/* Step 4 */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={fadeIn} className="grid md:grid-cols-2 gap-10 items-center">
                <div className="md:order-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-lg shrink-0">4</div>
                    <p className="font-mono text-xs text-primary uppercase tracking-widest">Step 4</p>
                  </div>
                  <h3 className="text-2xl font-display font-bold mb-3">Open Google Maps & Search</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">Go to <strong className="text-foreground">maps.google.com</strong> and search for any business type and location — for example "Plumbers in Houston TX" or "Dentists near London". Wait for the results list to appear on the left sidebar.</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Works with any city, country, or zip code</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Any business category works — restaurants, lawyers, gyms, clinics…</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Make sure the results sidebar is visible before starting</li>
                  </ul>
                </div>
                <div className="md:order-1 rounded-2xl border border-border overflow-hidden shadow-2xl shadow-black/60">
                  <div className="bg-[#3c4043] px-3 py-2 flex items-center gap-2">
                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f57]"/><div className="w-3 h-3 rounded-full bg-[#febc2e]"/><div className="w-3 h-3 rounded-full bg-[#28c840]"/></div>
                    <div className="flex-1 bg-[#202124] rounded text-[10px] text-[#9aa0a6] px-3 py-1 font-mono">maps.google.com/search/Plumbers+in+Houston+TX</div>
                  </div>
                  <div className="bg-[#f5f5f5] flex" style={{height: 200}}>
                    {/* Left sidebar */}
                    <div className="w-48 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                      <div className="p-2 border-b border-gray-200">
                        <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-full px-2 py-1 shadow-sm">
                          <Search className="w-3 h-3 text-gray-400" />
                          <span className="text-[9px] text-gray-700 font-medium">Plumbers in Houston TX</span>
                        </div>
                      </div>
                      <div className="p-2 text-[8px] text-gray-500 font-semibold">Results (120+)</div>
                      {[
                        { name: "Houston Plumbing Co.", stars: "★★★★★", reviews: "312" },
                        { name: "A-1 Drain Masters", stars: "★★★★☆", reviews: "87" },
                        { name: "Royal Rooter Plumbing", stars: "★★★★★", reviews: "204" },
                      ].map(r => (
                        <div key={r.name} className="px-2 py-1.5 border-b border-gray-100 hover:bg-gray-50">
                          <p className="text-[9px] font-bold text-gray-800 truncate">{r.name}</p>
                          <p className="text-[8px] text-yellow-500">{r.stars} <span className="text-gray-400">({r.reviews})</span></p>
                          <p className="text-[8px] text-gray-400">Plumber · Open now</p>
                        </div>
                      ))}
                    </div>
                    {/* Map area */}
                    <div className="flex-1 bg-[#e8ead3] relative">
                      <div className="absolute inset-0 opacity-20" style={{backgroundImage:"repeating-linear-gradient(0deg,#ccc,#ccc 1px,transparent 1px,transparent 40px),repeating-linear-gradient(90deg,#ccc,#ccc 1px,transparent 1px,transparent 40px)"}} />
                      {[{t:"20%",l:"30%"},{t:"45%",l:"55%"},{t:"65%",l:"35%"}].map((p,i) => (
                        <div key={i} className="absolute w-4 h-4 bg-[#ea4335] rounded-full border-2 border-white shadow text-[7px] text-white flex items-center justify-center font-bold" style={{top:p.t,left:p.l}}>{i+1}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Step 5 */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={fadeIn} className="grid md:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-lg shrink-0">5</div>
                    <p className="font-mono text-xs text-primary uppercase tracking-widest">Step 5</p>
                  </div>
                  <h3 className="text-2xl font-display font-bold mb-3">Open the Extension & Press Start</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">Click the extension icon in your Chrome toolbar. The extraction panel will open. Click the green <strong className="text-primary">"Start Extracting"</strong> button — it will automatically scroll through every listing, open each one, and harvest all available data.</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Auto-scrolls and paginates — no manual clicks needed</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Real-time counter shows leads found as it runs</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> You can pause or stop at any time</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-border overflow-hidden shadow-2xl shadow-black/60">
                  <div className="bg-[#3c4043] px-3 py-2 flex items-center gap-2">
                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f57]"/><div className="w-3 h-3 rounded-full bg-[#febc2e]"/><div className="w-3 h-3 rounded-full bg-[#28c840]"/></div>
                    <div className="flex-1 bg-[#202124] rounded text-[10px] text-[#9aa0a6] px-3 py-1 font-mono">maps.google.com</div>
                    <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center shadow ring-2 ring-emerald-400">
                      <Map className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div className="bg-white flex justify-end p-3" style={{height:220}}>
                    {/* Extension popup */}
                    <div className="w-52 bg-[#111827] border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
                      <div className="bg-[#00E676]/10 border-b border-gray-700 px-3 py-2 flex items-center gap-2">
                        <Map className="w-4 h-4 text-[#00E676]" />
                        <span className="text-[11px] font-bold text-white">MapLead Extractor</span>
                        <span className="ml-auto text-[8px] bg-[#00E676]/20 text-[#00E676] px-1.5 py-0.5 rounded font-mono">v1.2.3</span>
                      </div>
                      <div className="p-3">
                        <div className="bg-[#1f2937] rounded-lg p-2 mb-3">
                          <p className="text-[9px] text-gray-400 mb-0.5">Leads found so far</p>
                          <p className="text-2xl font-display font-bold text-[#00E676]">47</p>
                          <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                            <div className="bg-[#00E676] h-1 rounded-full" style={{width:"38%"}} />
                          </div>
                          <p className="text-[8px] text-gray-500 mt-0.5">Scanning page 3 of 8…</p>
                        </div>
                        <button className="w-full bg-[#00E676] text-[#111827] text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-1.5">
                          <Play className="w-3 h-3" /> Start Extracting
                        </button>
                        <div className="flex gap-1.5 mt-1.5">
                          <button className="flex-1 bg-gray-800 text-gray-400 text-[9px] py-1 rounded">Pause</button>
                          <button className="flex-1 bg-gray-800 text-gray-400 text-[9px] py-1 rounded">Stop</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Step 6 */}
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-80px" }} variants={fadeIn} className="grid md:grid-cols-2 gap-10 items-center">
                <div className="md:order-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-lg shrink-0">6</div>
                    <p className="font-mono text-xs text-primary uppercase tracking-widest">Step 6</p>
                  </div>
                  <h3 className="text-2xl font-display font-bold mb-3">Export Your Leads to CSV or XLSX</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">Once the extraction is complete (or even while it's running), click <strong className="text-foreground">"Download CSV"</strong> or <strong className="text-foreground">"Download XLSX"</strong>. The file downloads instantly to your computer with all extracted fields — no cloud upload required.</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Clean CSV with headers — opens in Excel or Google Sheets instantly</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> All data stays on your machine — 100% private</li>
                    <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /> Import directly into any CRM (HubSpot, Salesforce, Pipedrive…)</li>
                  </ul>
                </div>
                <div className="md:order-1 rounded-2xl border border-border overflow-hidden shadow-2xl shadow-black/60">
                  <div className="bg-[#3c4043] px-3 py-2 flex items-center gap-2">
                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-[#ff5f57]"/><div className="w-3 h-3 rounded-full bg-[#febc2e]"/><div className="w-3 h-3 rounded-full bg-[#28c840]"/></div>
                    <div className="flex-1 bg-[#202124] rounded text-[10px] text-[#9aa0a6] px-3 py-1 font-mono">maps.google.com</div>
                  </div>
                  <div className="bg-white" style={{height:220}}>
                    {/* Extension popup with export */}
                    <div className="flex justify-end p-3 h-full">
                      <div className="w-52 bg-[#111827] border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
                        <div className="bg-[#00E676]/10 border-b border-gray-700 px-3 py-2 flex items-center gap-2">
                          <Map className="w-4 h-4 text-[#00E676]" />
                          <span className="text-[11px] font-bold text-white">MapLead Extractor</span>
                        </div>
                        <div className="p-3">
                          <div className="bg-[#00E676]/10 border border-[#00E676]/30 rounded-lg p-2 mb-3 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[#00E676] shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold text-[#00E676]">Done! 312 leads found</p>
                              <p className="text-[8px] text-gray-400">Plumbers in Houston TX</p>
                            </div>
                          </div>
                          <button className="w-full bg-[#00E676] text-[#111827] text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 mb-1.5">
                            <Download className="w-3 h-3" /> Download CSV
                          </button>
                          <button className="w-full bg-emerald-800 text-emerald-300 text-[10px] font-bold py-1.5 rounded-lg flex items-center justify-center gap-1">
                            <FileSpreadsheet className="w-3 h-3" /> Download XLSX
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Chrome download bar at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 bg-[#f2f2f2] border-t border-gray-300 px-3 py-1.5 flex items-center gap-2" style={{position:"relative"}}>
                      <div className="w-5 h-5 bg-green-100 rounded flex items-center justify-center">
                        <FileSpreadsheet className="w-3 h-3 text-green-600" />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-gray-800">leads_houston_plumbers.csv</p>
                        <p className="text-[8px] text-gray-500">312 rows · 186 KB · Done</p>
                      </div>
                      <div className="ml-auto text-[8px] text-[#1a73e8] font-semibold">Open</div>
                    </div>
                  </div>
                </div>
              </motion.div>

            </div>

            {/* Download CTA */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="mt-20 max-w-5xl mx-auto rounded-2xl border border-primary/30 bg-primary/5 p-8 flex flex-col md:flex-row items-center justify-between gap-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <Package className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-display font-bold text-lg">Prefer a direct download?</p>
                  <p className="text-muted-foreground text-sm mt-0.5">A standalone <code className="font-mono text-primary text-xs bg-primary/10 px-1.5 py-0.5 rounded">.crx</code> installer for the Google Maps Extractor is coming soon — no Chrome Web Store needed.</p>
                </div>
              </div>
              <Button variant="outline" className="shrink-0 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-all" disabled>
                <Download className="w-4 h-4 mr-2" /> Download Coming Soon
              </Button>
            </motion.div>
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
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">We ripped out the tracking scripts, dropped the cloud sync, and optimized the parsing engine for maximum local performance.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: Search, title: "Deep Site Enrichment", desc: "If an email isn't on the map, the engine quietly visits the business's website to scrape hidden contact details and social links." },
                { icon: FileSpreadsheet, title: "Auto-Deduplication", desc: "No messy spreadsheets. The extension natively tracks hashes and prevents duplicate businesses from being exported." },
                { icon: Shield, title: "100% Local Execution", desc: "We run completely in your browser. We don't have a backend database. Your lead lists are yours alone." },
                { icon: Lock, title: "No Subscriptions", desc: "SaaS tools charge $100/mo for 1000 leads. We give you infinite extraction for $0. Tips are welcome, but optional." },
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

        {/* Section 6: User Personas (Social Proof Proxy) */}
        <section className="py-24 bg-card/30 border-t border-border">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-16">Who is this actually for?</h2>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="p-6">
                <Users className="w-12 h-12 text-primary mx-auto mb-6" />
                <h3 className="text-xl font-bold mb-3">Agency Owners</h3>
                <p className="text-muted-foreground">Scrape hyper-local businesses (e.g. "Roofers in Miami") to build highly targeted cold email and calling lists for your services.</p>
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
                  Google Maps and Bing Maps have completely different underlying architectures. To provide the fastest, most resilient scraping possible, we built dedicated engines for each platform rather than a bloated, fragile hybrid.
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
              </div>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Products</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Google Maps Extractor</a></li>
                <li><a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Bing Maps Extractor</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Source Code</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy (We track nothing)</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="mailto:support@example.com" className="hover:text-primary transition-colors">Contact Support</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
            <div>&copy; {new Date().getFullYear()} MapLeadExtractor. All rights reserved.</div>
            <div className="mt-4 md:mt-0 font-mono text-xs text-primary">v1.2.3 // v2.5.5 // STABLE</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
