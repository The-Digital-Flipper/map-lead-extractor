import { Check, Zap } from "lucide-react";
import { SiGooglechrome } from "react-icons/si";
import { useParams } from "wouter";
import { getTool, tools } from "@/data/tools";
import { posts } from "@/data/posts";
import { Button } from "@/components/ui/button";
import { Calculator } from "@/components/tools/calculators";
import NotFound from "@/pages/not-found";
import { useSeo } from "@/lib/seo";

const STORE_URL =
  "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";

export default function ToolPage() {
  const params = useParams();
  const tool = getTool(params.tool ?? "");

  useSeo({
    title: tool?.metaTitle ?? "Free Tools — Map Lead Extractor",
    description: tool?.metaDescription,
    path: tool ? `/tools/${tool.slug}` : "/tools",
  });

  if (!tool) return <NotFound />;

  const relatedTools = tool.relatedTools.map((s) => getTool(s)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  const relatedPosts = tool.relatedPosts
    .map((s) => posts.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <Zap className="w-5 h-5 text-primary" />
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </a>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
            <a href="/tools" className="hover:text-foreground transition-colors">Free Tools</a>
            <a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="/blog" className="hover:text-foreground transition-colors">Blog</a>
          </nav>
          <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
            Install Free
          </a>
        </div>
      </header>

      <main className="pt-24">
        <div className="container mx-auto px-6 max-w-4xl pt-8">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <a href="/" className="hover:text-primary">Home</a>
            <span className="mx-2">/</span>
            <a href="/tools" className="hover:text-primary">Free Tools</a>
            <span className="mx-2">/</span>
            <span className="text-foreground">{tool.name}</span>
          </nav>
        </div>

        <section className="py-10">
          <div className="container mx-auto px-6 max-w-4xl">
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-5">{tool.h1}</h1>
            {tool.intro.map((p, i) => (
              <p key={i} className="text-lg md:text-xl text-muted-foreground mb-4 leading-relaxed">{p}</p>
            ))}
          </div>
        </section>

        {/* Interactive calculator */}
        <section className="pb-12">
          <div className="container mx-auto px-6 max-w-4xl">
            <Calculator kind={tool.kind} />
            <p className="text-sm text-muted-foreground mt-4">
              100% free, runs in your browser, no signup. Nothing you enter is stored or sent anywhere.
            </p>
          </div>
        </section>

        {/* Methodology / explanatory content */}
        <section className="py-12 bg-card/30 border-y border-border">
          <div className="container mx-auto px-6 max-w-3xl">
            {tool.body.map((s, i) => {
              if (s.type === "h2") return <h2 key={i} className="text-3xl font-display font-bold mt-10 mb-4 first:mt-0">{s.text}</h2>;
              if (s.type === "h3") return <h3 key={i} className="text-2xl font-display font-semibold mt-8 mb-3">{s.text}</h3>;
              if (s.type === "p") return <p key={i} className="text-lg text-muted-foreground mb-4 leading-relaxed">{s.text}</p>;
              if (s.type === "tip") return <p key={i} className="text-lg mb-4 p-4 rounded-lg border border-primary/30 bg-primary/5"><strong className="text-primary">Tip:</strong> {s.text}</p>;
              if (s.type === "ul") return <ul key={i} className="mb-6 space-y-2">{s.items!.map((it, j) => <li key={j} className="flex gap-3 text-lg text-muted-foreground"><Check className="w-5 h-5 text-primary shrink-0 mt-1" /><span>{it}</span></li>)}</ul>;
              return null;
            })}
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12">
          <div className="container mx-auto px-6 max-w-3xl">
            <h2 className="text-3xl font-display font-bold mb-8">Frequently asked questions</h2>
            <div className="space-y-6">
              {tool.faq.map((f, i) => (
                <div key={i} className="border-b border-border pb-6">
                  <h3 className="text-xl font-semibold mb-2">{f.q}</h3>
                  <p className="text-muted-foreground text-lg">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Related */}
        <section className="py-12 bg-card/30 border-y border-border">
          <div className="container mx-auto px-6 max-w-4xl grid md:grid-cols-2 gap-10">
            <div>
              <h2 className="text-2xl font-display font-bold mb-4">More free tools</h2>
              <ul className="space-y-3">
                {relatedTools.map((t) => (
                  <li key={t.slug}><a href={`/tools/${t.slug}`} className="text-primary hover:underline text-lg">{t.name}</a></li>
                ))}
              </ul>
            </div>
            {relatedPosts.length > 0 && (
              <div>
                <h2 className="text-2xl font-display font-bold mb-4">Related guides</h2>
                <ul className="space-y-3">
                  {relatedPosts.map((p) => (
                    <li key={p.slug}><a href={`/blog/${p.slug}`} className="text-primary hover:underline text-lg">{p.title}</a></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-primary text-primary-foreground text-center">
          <div className="container mx-auto px-6 max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-5">Put the numbers to work</h2>
            <p className="text-xl mb-8 opacity-90">Extract local business leads from Google &amp; Bing Maps and export to CSV — free.</p>
            <Button asChild size="lg" variant="secondary" className="h-14 px-8 text-lg font-bold">
              <a href={STORE_URL} target="_blank" rel="noopener noreferrer"><SiGooglechrome className="mr-3 h-5 w-5" /> Add to Chrome — It's Free</a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-card border-t border-border py-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground gap-4">
          <div>&copy; {new Date().getFullYear()} MapLeadExtractor. All rights reserved.</div>
          <nav className="flex gap-6">
            <a href="/tools" className="hover:text-primary transition-colors">Tools</a>
            <a href="/blog" className="hover:text-primary transition-colors">Blog</a>
            <a href="/privacy" className="hover:text-primary transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-primary transition-colors">Terms</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
