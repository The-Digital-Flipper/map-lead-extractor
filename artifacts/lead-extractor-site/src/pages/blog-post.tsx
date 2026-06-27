import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Zap } from "lucide-react";
import { useParams } from "wouter";
import { posts, type Post } from "@/data/posts";
import NotFound from "@/pages/not-found";
import { useSeo } from "@/lib/seo";

const SITE = "https://mapleadextractor.net";
const DEFAULT_IMAGE = `${SITE}/opengraph.jpg`;

const STORE_URL = "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";

const categoryColors: Record<string, string> = {
  Tutorial: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  Comparison: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  Strategy: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Outreach: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  "Use Cases": "bg-primary/10 text-primary border-primary/30",
  Legal: "bg-red-500/10 text-red-400 border-red-500/30",
};

function renderParts(parts: import("@/data/posts").Part[]) {
  return parts.map((part, j) =>
    part.type === "link" ? (
      <a
        key={j}
        href={part.href}
        className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
      >
        {part.value}
      </a>
    ) : (
      <span key={j}>{part.value}</span>
    )
  );
}

function renderContent(post: Post) {
  return post.content.map((section, i) => {
    switch (section.type) {
      case "h2":
        return (
          <h2 key={i} className="text-2xl md:text-3xl font-display font-bold mt-12 mb-4 text-foreground">
            {section.text}
          </h2>
        );
      case "h3":
        return (
          <h3 key={i} className="text-xl font-display font-semibold mt-8 mb-3 text-foreground">
            {section.text}
          </h3>
        );
      case "p":
        return (
          <p key={i} className="text-muted-foreground leading-relaxed mb-5">
            {section.parts ? renderParts(section.parts) : section.text}
          </p>
        );
      case "ul":
        return (
          <ul key={i} className="mb-5 space-y-2 pl-2">
            {section.items?.map((item, j) => (
              <li key={j} className="flex items-start gap-3 text-muted-foreground">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        );
      case "ol":
        return (
          <ol key={i} className="mb-5 space-y-2 pl-2">
            {section.items?.map((item, j) => (
              <li key={j} className="flex items-start gap-3 text-muted-foreground">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                  {j + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        );
      case "tip":
        return (
          <div key={i} className="my-6 p-5 rounded-xl border border-primary/30 bg-primary/5">
            <p className="text-sm font-semibold text-primary mb-1">💡 Pro Tip</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {section.parts ? renderParts(section.parts) : section.text}
            </p>
          </div>
        );
      default:
        return null;
    }
  });
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = posts.find((p) => p.slug === slug);

  // Per-article title + description so each post ranks on its own keywords.
  useSeo({
    title: post ? `${post.title} | Map Lead Extractor` : "Article Not Found | Map Lead Extractor",
    description: post?.description,
    path: `/blog/${slug ?? ""}`,
  });

  useEffect(() => {
    if (!post) return;
    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.datePublished,
      dateModified: post.dateModified ?? post.datePublished,
      author: { "@type": "Person", name: post.authorName },
      publisher: {
        "@type": "Organization",
        name: "MapLeadExtractor",
        url: SITE,
      },
      mainEntityOfPage: `${SITE}/blog/${post.slug}`,
      image: DEFAULT_IMAGE,
      articleSection: post.category,
      url: `${SITE}/blog/${post.slug}`,
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "blogposting-jsonld";
    script.text = JSON.stringify(schema);
    const existing = document.getElementById("blogposting-jsonld");
    if (existing) existing.remove();
    document.head.appendChild(script);
    return () => {
      document.getElementById("blogposting-jsonld")?.remove();
    };
  }, [post]);

  if (!post) return <NotFound />;

  const related = posts.filter((p) => p.slug !== slug).slice(0, 3);

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
            <a href="/blog" className="hover:text-foreground transition-colors">Blog</a>
          </nav>
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
        <div className="container mx-auto px-6 max-w-3xl">

          {/* Back link */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="mb-10">
            <a href="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Blog
            </a>
          </motion.div>

          {/* Post header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${categoryColors[post.category] ?? ""}`}>
                {post.category}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> {post.readTime}
              </span>
              <span className="text-xs text-muted-foreground font-mono">{post.date}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-display font-bold leading-tight mb-5">
              {post.title}
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed border-l-2 border-primary pl-5">
              {post.description}
            </p>
          </motion.div>

          <hr className="border-border mb-10" />

          {/* Post body */}
          <motion.article initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }}>
            {renderContent(post)}
          </motion.article>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-16 p-8 rounded-2xl border border-primary/30 bg-primary/5 text-center"
          >
            <h3 className="text-2xl font-display font-bold mb-2">Ready to start extracting leads?</h3>
            <p className="text-muted-foreground mb-6">Free Chrome extension. No subscription. Runs entirely in your browser.</p>
            <a
              href={STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity"
            >
              Add to Chrome — It's Free
            </a>
          </motion.div>

          {/* Related posts */}
          {related.length > 0 && (
            <div className="mt-20">
              <h3 className="text-xl font-display font-bold mb-6">More from the blog</h3>
              <div className="grid gap-4">
                {related.map((p) => (
                  <a
                    key={p.slug}
                    href={`/blog/${p.slug}`}
                    className="group flex items-start justify-between gap-4 p-5 bg-card border border-border rounded-xl hover:border-primary/40 transition-all"
                  >
                    <div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border mr-2 ${categoryColors[p.category] ?? ""}`}>{p.category}</span>
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{p.title}</span>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180 shrink-0 mt-0.5 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </a>
                ))}
              </div>
            </div>
          )}
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
