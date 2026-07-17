import { motion } from "framer-motion";
import { ArrowRight, Check, Package, Search, Zap } from "lucide-react";
import { SiGooglechrome } from "react-icons/si";
import { useParams } from "wouter";
import { getIndustryPage, industryPages } from "@/data/landing-pages";
import { posts } from "@/data/posts";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import { useSeo } from "@/lib/seo";
import { MobileNav } from "@/components/site/mobile-nav";

const STORE_URL =
  "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function IndustryLanding() {
  const params = useParams();
  const page = getIndustryPage(params.industry ?? "");

  // useSeo must run unconditionally (rules of hooks); fall back to safe defaults.
  useSeo({
    title: page?.metaTitle ?? "Industry Leads — Map Lead Extractor",
    description: page?.metaDescription,
    path: page ? `/leads/${page.slug}` : "/leads",
  });

  if (!page) return <NotFound />;

  const relatedPosts = page.relatedPosts
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const otherIndustries = industryPages.filter((p) => p.slug !== page.slug);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity"
          >
            <Zap className="w-5 h-5 text-primary" />
            <span>
              Map<span className="text-primary">Lead</span>Extractor
            </span>
          </a>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
            <a href="/#leads-for-sale" className="text-primary hover:opacity-80 transition-opacity font-semibold">Buy Leads</a>
            <a href="/#industries" className="hover:text-foreground transition-colors">Industries</a>
            <a href="/free-tool" className="hover:text-foreground transition-colors">Free Tool</a>
            <a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="/blog" className="hover:text-foreground transition-colors">Blog</a>
          </nav>
          <MobileNav />
          <a
            href="/#leads-for-sale"
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Get Leads
          </a>
        </div>
      </header>

      <main className="pt-24">
        {/* Breadcrumb */}
        <div className="container mx-auto px-6 max-w-4xl pt-8">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <a href="/" className="hover:text-primary">Home</a>
            <span className="mx-2">/</span>
            <a href="/#industries" className="hover:text-primary">Leads by Industry</a>
            <span className="mx-2">/</span>
            <span className="text-foreground">{page.industry}</span>
          </nav>
        </div>

        {/* Hero */}
        <section className="py-12">
          <div className="container mx-auto px-6 max-w-4xl">
            <motion.div initial="hidden" animate="visible" variants={fadeIn}>
              <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-6">
                {page.h1}
              </h1>
              {page.intro.map((para, i) => (
                <p key={i} className="text-lg md:text-xl text-muted-foreground mb-5 leading-relaxed">
                  {para}
                </p>
              ))}
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" className="h-14 px-8 text-lg font-bold">
                  <a href="/#leads-for-sale">
                    <Package className="mr-3 h-5 w-5" /> Buy {page.industry} Leads
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-14 px-8 text-lg font-bold">
                  <a href="/free-tool">
                    <SiGooglechrome className="mr-3 h-5 w-5" /> Or Extract Them Free
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Long-form body */}
        {page.body && page.body.length > 0 && (
          <section className="py-12">
            <div className="container mx-auto px-6 max-w-3xl prose prose-invert prose-headings:font-display prose-headings:font-bold prose-a:text-primary max-w-none md:max-w-3xl">
              {page.body.map((s, i) => {
                if (s.type === "h2") return <h2 key={i} className="text-3xl font-display font-bold mt-10 mb-4">{s.text}</h2>;
                if (s.type === "h3") return <h3 key={i} className="text-2xl font-display font-semibold mt-8 mb-3">{s.text}</h3>;
                if (s.type === "p") return <p key={i} className="text-lg text-muted-foreground mb-4 leading-relaxed">{s.text}</p>;
                if (s.type === "tip") return <p key={i} className="text-lg mb-4 p-4 rounded-lg border border-primary/30 bg-primary/5"><strong className="text-primary">Tip:</strong> {s.text}</p>;
                if (s.type === "ul") return <ul key={i} className="mb-6 space-y-2">{s.items!.map((it, j) => <li key={j} className="flex gap-3 text-lg text-muted-foreground"><Check className="w-5 h-5 text-primary shrink-0 mt-1" /><span>{it}</span></li>)}</ul>;
                return null;
              })}
            </div>
          </section>
        )}

        {/* Why target this industry */}
        <section className="py-12 bg-card/30 border-y border-border">
          <div className="container mx-auto px-6 max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-8">
              Why {page.industry.toLowerCase()} are worth prospecting
            </h2>
            <ul className="space-y-4">
              {page.painPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-3 text-lg text-muted-foreground">
                  <Check className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Use cases */}
        <section className="py-12">
          <div className="container mx-auto px-6 max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-8">
              What you can do with {page.industry.toLowerCase()} leads
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {page.useCases.map((uc, i) => (
                <div key={i} className="flex items-start gap-3 p-5 rounded-xl border border-border bg-card/40">
                  <ArrowRight className="w-5 h-5 text-primary shrink-0 mt-1" />
                  <span className="text-foreground">{uc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Example searches */}
        <section className="py-12 bg-card/30 border-y border-border">
          <div className="container mx-auto px-6 max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-8">
              Example Google &amp; Bing Maps searches
            </h2>
            <div className="space-y-3">
              {page.exampleSearches.map((q, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-lg border border-border bg-background font-mono text-sm md:text-base">
                  <Search className="w-4 h-4 text-primary shrink-0" />
                  <span>{q}</span>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground mt-6">
              Run any of these on Google Maps or Bing Maps, open the extension, and press Start to
              export every result to CSV.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12">
          <div className="container mx-auto px-6 max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-8">
              {page.industry} lead extraction — FAQ
            </h2>
            <div className="space-y-6">
              {page.faq.map((f, i) => (
                <div key={i} className="border-b border-border pb-6">
                  <h3 className="text-xl font-semibold mb-2">{f.q}</h3>
                  <p className="text-muted-foreground text-lg">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Related reading */}
        {relatedPosts.length > 0 && (
          <section className="py-12 bg-card/30 border-y border-border">
            <div className="container mx-auto px-6 max-w-4xl">
              <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">Related guides</h2>
              <ul className="space-y-3">
                {relatedPosts.map((p) => (
                  <li key={p.slug}>
                    <a href={`/blog/${p.slug}`} className="text-primary hover:underline text-lg">
                      {p.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Other industries (internal linking) */}
        <section className="py-12">
          <div className="container mx-auto px-6 max-w-4xl">
            <h2 className="text-2xl md:text-3xl font-display font-bold mb-6">Extract leads for other industries</h2>
            <div className="flex flex-wrap gap-3">
              {otherIndustries.map((p) => (
                <a
                  key={p.slug}
                  href={`/leads/${p.slug}`}
                  className="px-4 py-2 rounded-full border border-border bg-card/40 text-sm hover:border-primary hover:text-primary transition-colors"
                >
                  {p.industry}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 bg-primary text-primary-foreground text-center">
          <div className="container mx-auto px-6 max-w-3xl">
            <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">
              Get your {page.industry.toLowerCase()} leads today
            </h2>
            <p className="text-xl mb-10 opacity-90">100 human-reviewed leads for $29 — delivered in hours, refund if we come up short.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button asChild size="lg" variant="secondary" className="h-14 px-8 text-lg font-bold">
                <a href="/#leads-for-sale">
                  <Package className="mr-3 h-5 w-5" /> Buy a Lead Pack
                </a>
              </Button>
              <Button asChild size="lg" variant="secondary" className="h-14 px-8 text-lg font-bold opacity-80">
                <a href={STORE_URL} target="_blank" rel="noopener noreferrer">
                  <SiGooglechrome className="mr-3 h-5 w-5" /> Or Install the Free Extension
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-card border-t border-border py-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground gap-4">
          <div>&copy; {new Date().getFullYear()} MapLeadExtractor. All rights reserved.</div>
          <nav className="flex gap-6">
            <a href="/privacy" className="hover:text-primary transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-primary transition-colors">Terms</a>
            <a href="/blog" className="hover:text-primary transition-colors">Blog</a>
            <a href="/pricing" className="hover:text-primary transition-colors">Pricing</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
