import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Star, Share2, Check, Lock } from "lucide-react";
import { useSeo } from "@/lib/seo";
import { SCRAPER_ACTORS, type ScraperActor } from "@/lib/scraperActors";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Category = "all" | ScraperActor["category"];

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "lead-generation", label: "Lead generation" },
  { key: "social-media", label: "Social media" },
  { key: "e-commerce", label: "E-commerce" },
];

export default function ScraperStore() {
  useSeo({ title: "Scraper Store — MapLeadExtractor", path: "/scraper" });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [shared, setShared] = useState(false);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: "Free scrapers — MapLeadExtractor", url }); return; } catch { /* cancelled or unsupported — fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch { /* clipboard blocked — nothing more we can do */ }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SCRAPER_ACTORS.filter(a => (category === "all" || a.category === category))
      .filter(a => !q || a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
  }, [query, category]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <a href={`${basePath}/`} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <span className="font-display font-bold">Scraper Store</span>
          <button onClick={share} className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            {shared ? <Check className="w-3.5 h-3.5 text-primary" /> : <Share2 className="w-3.5 h-3.5" />}
            {shared ? "Link copied!" : "Share"}
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">

          <div>
            <h1 className="text-2xl font-display font-bold mb-1">Scrapers</h1>
            <p className="text-sm text-muted-foreground">Pick a scraper, run it, and get your data — pay-as-you-go with your plan's daily run limit, no per-result billing.</p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search scrapers…"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-sm focus:border-primary/50 outline-none" />
          </div>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => setCategory(c.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  category === c.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"
                }`}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Actor grid */}
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scrapers match that search.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map(a => {
                const card = (
                  <div className={`h-full rounded-2xl border p-5 transition-colors ${
                    a.live ? "border-border bg-card hover:border-primary/40" : "border-border bg-card/50 opacity-70"
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                        <a.Icon className={`w-5 h-5 ${a.iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm font-display font-bold leading-tight">{a.name}</h2>
                          {!a.live && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold uppercase shrink-0">
                              <Lock className="w-2.5 h-2.5" /> Coming soon
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-muted-foreground truncate">{a.id}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{a.description}</p>
                    <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      <span className="text-foreground font-semibold">{a.rating.toFixed(1)}</span>
                      <span>({a.reviews})</span>
                    </div>
                  </div>
                );
                return a.live ? (
                  <a key={a.slug} href={`${basePath}/scraper/${a.slug}`} className="block">{card}</a>
                ) : (
                  <div key={a.slug} className="cursor-not-allowed">{card}</div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-muted-foreground border-t border-border pt-4">
            Not seeing Facebook Groups or Marketplace here on purpose — those require a logged-in account and Meta
            actively bans automated access, so we don't offer them as a self-serve scraper. For Facebook, use the
            manual-assist Group Blaster in the admin Social tab instead.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
