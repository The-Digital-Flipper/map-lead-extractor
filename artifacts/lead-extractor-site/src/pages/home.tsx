import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Download, Map, Zap, Search, Chrome, FileSpreadsheet, Lock, Shield, Settings2, Code2, Users, Database } from "lucide-react";
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
