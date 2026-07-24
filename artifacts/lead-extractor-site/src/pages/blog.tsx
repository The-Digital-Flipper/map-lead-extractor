import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Tag, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { posts, type Post } from "@/data/posts";
import { useSeo } from "@/lib/seo";
import { MobileNav } from "@/components/site/mobile-nav";
import { BlogPhoto } from "@/components/site/blog-photo";

const STORE_URL = "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const categoryColors: Record<string, string> = {
  Tutorial: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  Comparison: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  Strategy: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Outreach: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  "Use Cases": "bg-primary/10 text-primary border-primary/30",
  Legal: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function Blog() {
  useSeo({
    title: "Blog — Google & Bing Maps Lead Generation Guides | Map Lead Extractor",
    description: "Tutorials and guides on finding Google Maps leads, cold email outreach, lead-gen for agencies and web designers, and staying compliant.",
    path: "/blog",
  });

  // Merge the hand-written static posts with the daily auto-generated ones from
  // the API (metadata only — cards don't render body content). Newest first.
  const [allPosts, setAllPosts] = useState<Post[]>(posts);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/blog/posts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !Array.isArray(d?.posts)) return;
        const bySlug = new Map<string, Post>();
        for (const p of posts) bySlug.set(p.slug, p);
        for (const p of d.posts as Post[]) if (!bySlug.has(p.slug)) bySlug.set(p.slug, { ...p, content: p.content ?? [] });
        const merged = [...bySlug.values()].sort((a, b) => (b.datePublished ?? "").localeCompare(a.datePublished ?? ""));
        setAllPosts(merged);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const [featured, ...rest] = allPosts;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <Zap className="w-5 h-5 text-primary" />
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </a>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
            <a href="/#extensions" className="hover:text-foreground transition-colors">Products</a>
            <a href="/#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
            <a href="/#data" className="hover:text-foreground transition-colors">Data Fields</a>
            <a href="/#faq" className="hover:text-foreground transition-colors">FAQ</a>
            <a href="/blog" className="text-primary font-semibold">Blog</a>
          </nav>
          <MobileNav />
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Install Free
          </a>
        </div>
      </header>

      <main className="pt-24 pb-32">
        <div className="container mx-auto px-6 max-w-6xl">

          {/* Header */}
          <motion.div initial="hidden" animate="visible" variants={fadeIn} className="mb-16">
            <Badge variant="outline" className="px-4 py-1.5 border-primary/50 text-primary bg-primary/10 font-mono text-xs uppercase tracking-wider mb-4">
              Lead Gen Guides
            </Badge>
            <h1 className="text-5xl md:text-6xl font-display font-bold mb-4">Blog</h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Tutorials, strategies, and real-world playbooks for extracting and converting local business leads.
            </p>
          </motion.div>

          {/* Featured post */}
          <motion.div initial="hidden" animate="visible" variants={fadeIn} className="mb-12">
            <a href={`/blog/${featured.slug}`} className="group block bg-card border border-border rounded-3xl overflow-hidden hover:border-primary/40 transition-all duration-300">
              <div className="grid md:grid-cols-2 gap-0">
                <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-12 flex items-center justify-center min-h-[280px]">
                  <div className="text-center">
                    <div className="text-7xl font-display font-black text-primary/20 leading-none mb-4">01</div>
                    <div className="text-primary font-mono text-sm uppercase tracking-widest">Featured</div>
                  </div>
                  {/* Photo overlays the placeholder when the post has one */}
                  <BlogPhoto
                    slug={featured.slug}
                    alt={featured.title}
                    className="absolute inset-0"
                    imgClassName="w-full h-full object-cover"
                  />
                </div>
                <div className="p-10 flex flex-col justify-center gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${categoryColors[featured.category] ?? ""}`}>
                      {featured.category}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {featured.readTime}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-display font-bold leading-tight group-hover:text-primary transition-colors">
                    {featured.title}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">{featured.description}</p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground font-mono">{featured.date}</span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-3 transition-all">
                      Read article <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            </a>
          </motion.div>

          {/* Rest of posts */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((post, i) => (
              <motion.div
                key={post.slug}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.07 } } }}
              >
                <a href={`/blog/${post.slug}`} className="group h-full flex flex-col bg-card border border-border rounded-2xl p-7 overflow-hidden hover:border-primary/40 transition-all duration-300">
                  <BlogPhoto
                    slug={post.slug}
                    alt={post.title}
                    className="-mx-7 -mt-7 mb-6 aspect-[3/2] overflow-hidden border-b border-border"
                    imgClassName="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  />
                  <div className="flex items-center gap-2 mb-5">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${categoryColors[post.category] ?? ""}`}>
                      {post.category}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {post.readTime}
                    </span>
                  </div>
                  <h3 className="text-lg font-display font-bold leading-snug mb-3 flex-1 group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6 line-clamp-3">{post.description}</p>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                    <span className="text-xs text-muted-foreground font-mono">{post.date}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <a href="/" className="flex items-center gap-2 font-display font-bold text-base text-foreground">
            <Zap className="w-4 h-4 text-primary" />
            Map<span className="text-primary">Lead</span>Extractor
          </a>
          <div>&copy; {new Date().getFullYear()} MapLeadExtractor. All rights reserved.</div>
          <a href="/blog" className="hover:text-foreground transition-colors">Blog</a>
        </div>
      </footer>
    </div>
  );
}
