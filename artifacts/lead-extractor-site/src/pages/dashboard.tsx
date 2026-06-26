import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/react";
import { motion } from "framer-motion";
import { Zap, Copy, Check, Download, LogOut, Star, Phone, Mail, Globe, Search, Share2, Crown, ArrowUpRight, CreditCard } from "lucide-react";

const STORE_URL = "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const FREE_LIMIT = 100;

interface Lead {
  id: number;
  name: string | null;
  phone: string | null;
  emails: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  linkedin: string | null;
  address: string | null;
  category: string | null;
  rating: string | null;
  reviewCount: number | null;
  score: number | null;
  gmapsUrl: string | null;
}

interface PlanStatus {
  isPro: boolean;
  plan: "free" | "pro";
  freeLimit: number;
  periodEnd: string | null;
}

function ScoreBadge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color =
    s >= 80 ? "bg-primary/20 text-primary border-primary/40" :
    s >= 50 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" :
    "bg-red-500/20 text-red-400 border-red-500/40";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold ${color}`}>
      {s}
    </span>
  );
}

function SocialLink({ href, label, emoji }: { href: string | null; label: string; emoji: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="inline-flex items-center justify-center w-6 h-6 rounded bg-white/5 hover:bg-white/15 text-xs transition-colors"
    >
      {emoji}
    </a>
  );
}

function PlanBanner({ plan, total, onManageBilling, onUpgrade }: {
  plan: PlanStatus | null;
  total: number;
  onManageBilling: () => void;
  onUpgrade: () => void;
}) {
  if (!plan) return null;

  if (plan.isPro) {
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="mb-8">
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-foreground">Pro Plan</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-bold">ACTIVE</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Unlimited leads — {plan.periodEnd ? `renews ${new Date(plan.periodEnd).toLocaleDateString()}` : "active subscription"}
              </p>
            </div>
          </div>
          <button
            onClick={onManageBilling}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
          >
            <CreditCard className="w-4 h-4" /> Manage Billing
          </button>
        </div>
      </motion.div>
    );
  }

  const pct = Math.min(100, Math.round((total / FREE_LIMIT) * 100));
  const nearLimit = pct >= 80;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="mb-8">
      <div className={`border rounded-2xl p-5 ${nearLimit ? "bg-yellow-500/5 border-yellow-500/30" : "bg-card border-border"}`}>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-display font-bold text-foreground">Free Plan</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground text-xs font-bold">FREE</span>
            </div>
            <p className={`text-sm ${nearLimit ? "text-yellow-400" : "text-muted-foreground"}`}>
              {total} / {FREE_LIMIT} leads used
              {nearLimit && total < FREE_LIMIT ? " — almost at your limit!" : ""}
              {total >= FREE_LIMIT ? " — limit reached. Upgrade to save more." : ""}
            </p>
          </div>
          <button
            onClick={onUpgrade}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity shrink-0"
          >
            <ArrowUpRight className="w-4 h-4" /> Upgrade to Pro
          </button>
        </div>
        <div className="h-2 bg-background rounded-full overflow-hidden border border-border">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const apiKey = (user?.publicMetadata?.apiKey as string) || "— not set yet —";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // Fetch plan status
  useEffect(() => {
    fetch(`${basePath}/api/stripe/status`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((data: PlanStatus | null) => { if (data) setPlan(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    fetch(`${basePath}/api/leads/?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setLeads(data.leads ?? []);
          setTotal(data.total ?? 0);
          setPages(data.pages ?? 1);
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, search]);

  // debounce search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const r = await fetch(`${basePath}/api/stripe/portal`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      const data = await r.json() as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
    } catch {}
    setPortalLoading(false);
  };

  const handleUpgrade = () => { window.location.href = `${basePath}/pricing`; };

  const withPhone = leads.filter(l => l.phone).length;
  const withEmail = leads.filter(l => l.emails).length;
  const withSocial = leads.filter(l => l.facebook || l.instagram || l.twitter || l.linkedin).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href={basePath || "/"} className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <Zap className="w-5 h-5 text-primary" />
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
          </a>
          <div className="flex items-center gap-4">
            {plan && (
              <span className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${plan.isPro ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted border-border text-muted-foreground"}`}>
                {plan.isPro ? <><Crown className="w-3 h-3" /> Pro</> : "Free"}
              </span>
            )}
            <span className="text-sm text-muted-foreground hidden md:block">{user?.primaryEmailAddress?.emailAddress}</span>
            <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity">
              Install Extension
            </a>
            <button
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="pt-28 pb-32">
        <div className="container mx-auto px-6 max-w-6xl">

          {/* Welcome */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-1">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ""} 👋
            </h1>
            <p className="text-muted-foreground">Your extracted leads are saved here automatically.</p>
          </motion.div>

          {/* Plan banner */}
          <PlanBanner
            plan={plan}
            total={total}
            onManageBilling={handleManageBilling}
            onUpgrade={handleUpgrade}
          />

          {/* API Key card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="mb-8">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-lg font-display font-bold mb-1">Your API Key</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Paste this into the extension settings to automatically save leads to your account.
              </p>
              <div className="flex items-center gap-3">
                <code className="flex-1 bg-background border border-border rounded-lg px-4 py-3 font-mono text-sm text-primary truncate">
                  {apiKey}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors shrink-0"
                >
                  {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Once entered, every extraction auto-saves here — phone, email, website, and all social profiles included.
              </p>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Leads", value: loading ? "…" : total.toLocaleString(), icon: <Star className="w-4 h-4" /> },
              { label: "With Phone", value: loading ? "…" : withPhone.toLocaleString(), icon: <Phone className="w-4 h-4" /> },
              { label: "With Email", value: loading ? "…" : withEmail.toLocaleString(), icon: <Mail className="w-4 h-4" /> },
              { label: "With Social", value: loading ? "…" : withSocial.toLocaleString(), icon: <Share2 className="w-4 h-4" /> },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{s.icon} {s.label}</div>
                <div className="text-2xl font-display font-bold text-foreground">{s.value}</div>
              </div>
            ))}
          </motion.div>

          {/* Leads table */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between gap-4 p-5 border-b border-border">
                <h2 className="text-lg font-display font-bold">
                  Saved Leads {total > 0 && <span className="text-muted-foreground text-sm font-normal">({total.toLocaleString()})</span>}
                </h2>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search leads..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 w-48"
                    />
                  </div>
                  <a
                    href={`${basePath}/api/leads/export.csv${search ? `?search=${encodeURIComponent(search)}` : ""}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    <Download className="w-4 h-4" /> Export CSV
                  </a>
                </div>
              </div>

              {loading ? (
                <div className="py-20 text-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : leads.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="font-semibold text-foreground mb-1">No leads saved yet</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Install the extension, enter your API key in the settings, then run an extraction — your leads will appear here automatically.
                  </p>
                  <a
                    href={STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    Install Extension
                  </a>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-background/50">
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Name</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Phone</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Email</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Website</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Socials</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Category</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead, i) => (
                          <tr key={lead.id} className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-foreground truncate max-w-[160px]" title={lead.name ?? ""}>
                                {lead.gmapsUrl ? (
                                  <a href={lead.gmapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                                    {lead.name}
                                  </a>
                                ) : lead.name}
                              </div>
                              {lead.address && (
                                <div className="text-xs text-muted-foreground truncate max-w-[160px]" title={lead.address}>{lead.address}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {lead.phone ? (
                                <a href={`tel:${lead.phone}`} className="text-primary hover:underline font-mono text-xs whitespace-nowrap">{lead.phone}</a>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="px-4 py-3 max-w-[160px]">
                              {lead.emails ? (
                                <a href={`mailto:${lead.emails.split(",")[0].trim()}`} className="text-primary hover:underline text-xs truncate block" title={lead.emails}>{lead.emails}</a>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {lead.website ? (
                                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                  <Globe className="w-3 h-3" /> Site
                                </a>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <SocialLink href={lead.facebook} label="Facebook" emoji="f" />
                                <SocialLink href={lead.instagram} label="Instagram" emoji="📸" />
                                <SocialLink href={lead.twitter} label="Twitter / X" emoji="𝕏" />
                                <SocialLink href={lead.linkedin} label="LinkedIn" emoji="in" />
                                {!lead.facebook && !lead.instagram && !lead.twitter && !lead.linkedin && (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{lead.category ?? "—"}</td>
                            <td className="px-4 py-3"><ScoreBadge score={lead.score} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {pages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm">
                      <span className="text-muted-foreground">Page {page} of {pages}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          ← Prev
                        </button>
                        <button
                          onClick={() => setPage(p => Math.min(pages, p + 1))}
                          disabled={page >= pages}
                          className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>

          {/* Upgrade CTA for free users at bottom */}
          {plan && !plan.isPro && total >= FREE_LIMIT * 0.8 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }} className="mt-8">
              <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 text-center">
                <Crown className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-display font-bold text-xl mb-1">Unlock Unlimited Leads</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  You've used {total} of your {FREE_LIMIT} free leads. Go Pro for $9.99/month and never hit a limit again.
                </p>
                <button
                  onClick={handleUpgrade}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity"
                >
                  <ArrowUpRight className="w-4 h-4" /> Upgrade to Pro — $9.99/mo
                </button>
              </div>
            </motion.div>
          )}

          {/* Manage billing loading overlay */}
          {portalLoading && (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Opening billing portal…</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
