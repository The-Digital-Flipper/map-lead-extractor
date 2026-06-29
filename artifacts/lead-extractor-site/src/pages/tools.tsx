import { ArrowRight, Zap } from "lucide-react";
import { tools } from "@/data/tools";
import { useSeo } from "@/lib/seo";
import { MobileNav } from "@/components/site/mobile-nav";

const STORE_URL =
  "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";

export default function ToolsIndex() {
  useSeo({
    title: "Free Lead Generation Tools & Calculators | Map Lead Extractor",
    description:
      "Free tools for local lead generation and agencies: Google Maps ROI calculator, lead value calculator, and agency pricing calculator. No signup required.",
    path: "/tools",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <Zap className="w-5 h-5 text-primary" />
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </a>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
            <a href="/tools" className="text-primary font-semibold">Free Tools</a>
            <a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="/blog" className="hover:text-foreground transition-colors">Blog</a>
          </nav>
          <MobileNav />
          <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
            Install Free
          </a>
        </div>
      </header>

      <main className="pt-24 pb-24">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="py-10">
            <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-5">Free lead generation tools</h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Free, no-signup calculators for local lead generation, sales, and agencies. Each runs entirely in your browser.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {tools.map((t) => (
              <a
                key={t.slug}
                href={`/tools/${t.slug}`}
                className="group block p-6 rounded-2xl border border-border bg-card/40 hover:border-primary/50 transition-colors"
                data-testid={`link-tool-${t.slug}`}
              >
                <h2 className="text-2xl font-display font-bold mb-2 group-hover:text-primary transition-colors">{t.name}</h2>
                <p className="text-muted-foreground mb-4">{t.tagline}</p>
                <span className="inline-flex items-center gap-2 text-primary font-semibold">
                  Open tool <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </main>

      <footer className="bg-card border-t border-border py-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground gap-4">
          <div>&copy; {new Date().getFullYear()} MapLeadExtractor. All rights reserved.</div>
          <nav className="flex gap-6">
            <a href="/blog" className="hover:text-primary transition-colors">Blog</a>
            <a href="/pricing" className="hover:text-primary transition-colors">Pricing</a>
            <a href="/privacy" className="hover:text-primary transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-primary transition-colors">Terms</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
