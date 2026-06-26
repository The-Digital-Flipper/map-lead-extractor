import { useState, useEffect, useCallback, useRef } from "react";
import { useUser, useClerk } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Copy, Check, Download, LogOut, Star, Phone, Mail, Globe,
  Search, Share2, Crown, ArrowUpRight, CreditCard, Trash2,
  RefreshCw, ChevronLeft, ChevronRight, BarChart2, X,
  CheckSquare, Square, CheckCheck, ShieldCheck,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer, Legend,
} from "recharts";

const STORE_URL = "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const FREE_LIMIT = 100;

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  { value: "converted", label: "Converted", color: "bg-primary/15 text-primary border-primary/30" },
  { value: "not_interested", label: "Not Interested", color: "bg-red-500/15 text-red-400 border-red-500/30" },
] as const;

type LeadStatus = "new" | "contacted" | "converted" | "not_interested";

const SCORE_COLORS = ["#00E676", "#EAB308", "#EF4444"];
const CATEGORY_COLOR = "#00E676";

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
  status: string | null;
}

interface StatsData {
  scoreDistribution: { bucket: string; count: number }[];
  topCategories: { category: string; count: number }[];
  statusCounts: { status: string; count: number }[];
  lastSyncedAt: string | null;
}

interface PlanStatus {
  isPro: boolean;
  plan: "free" | "pro";
  freeLimit: number;
  periodEnd: string | null;
}

// ---- Small components -------------------------------------------------------

function ScoreBadge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color = s >= 80 ? "bg-primary/20 text-primary border-primary/40"
    : s >= 50 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
    : "bg-red-500/20 text-red-400 border-red-500/40";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold ${color}`}>
      {s}
    </span>
  );
}

function StatusBadge({ status, id, onChange }: { status: string | null; id: number; onChange: (id: number, s: LeadStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = STATUS_OPTIONS.find(s => s.value === (status ?? "new")) ?? STATUS_OPTIONS[0];

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity ${current.color}`}
      >
        {current.label} ▾
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px]"
          >
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(id, opt.value as LeadStatus); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-semibold hover:bg-white/5 transition-colors ${opt.value === (status ?? "new") ? "bg-white/5" : ""}`}
              >
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border ${opt.color}`}>{opt.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SocialLink({ href, label, emoji }: { href: string | null; label: string; emoji: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={label}
      className="inline-flex items-center justify-center w-6 h-6 rounded bg-white/5 hover:bg-white/15 text-xs transition-colors">
      {emoji}
    </a>
  );
}

function CopyBtn({ value, title }: { value: string | null; title: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <button onClick={handleCopy} title={`Copy ${title}`}
      className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors shrink-0">
      {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function PlanBanner({ plan, total, onManageBilling, onUpgrade }: {
  plan: PlanStatus | null; total: number; onManageBilling: () => void; onUpgrade: () => void;
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
          <button onClick={onManageBilling}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0">
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
          <button onClick={onUpgrade}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity shrink-0">
            <ArrowUpRight className="w-4 h-4" /> Upgrade to Pro
          </button>
        </div>
        <div className="h-2 bg-background rounded-full overflow-hidden border border-border">
          <div className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-primary"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </motion.div>
  );
}

// ---- Charts panel -----------------------------------------------------------
function ChartsPanel({ stats }: { stats: StatsData | null }) {
  if (!stats) return null;
  const hasScore = stats.scoreDistribution.length > 0;
  const hasCats = stats.topCategories.length > 0;
  if (!hasScore && !hasCats) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.17 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      {hasScore && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-display font-bold text-sm mb-4 text-foreground">Score Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={stats.scoreDistribution} dataKey="count" nameKey="bucket" cx="50%" cy="50%" outerRadius={70} label={({ bucket, percent }) => `${bucket} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                {stats.scoreDistribution.map((_, i) => <Cell key={i} fill={SCORE_COLORS[i % SCORE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, color: "#e6edf3" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      {hasCats && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="font-display font-bold text-sm mb-4 text-foreground">Top Categories</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.topCategories} layout="vertical" margin={{ left: 0, right: 24 }}>
              <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="category" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, color: "#e6edf3" }} />
              <Bar dataKey="count" fill={CATEGORY_COLOR} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

// ---- Main Dashboard ---------------------------------------------------------
export default function Dashboard() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [showCharts, setShowCharts] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const apiKey = (user?.publicMetadata?.apiKey as string) || "— not generated yet —";

  const handleCopyApiKey = async () => {
    try { await navigator.clipboard.writeText(apiKey); setApiKeyCopied(true); setTimeout(() => setApiKeyCopied(false), 2000); } catch {}
  };

  // Fetch plan status + auto-generate API key
  useEffect(() => {
    fetch(`${basePath}/api/stripe/status`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((data: PlanStatus | null) => { if (data) setPlan(data); })
      .catch(() => {});

    if (user && !user.publicMetadata?.apiKey) {
      fetch(`${basePath}/api/user/generate-key`, { method: "POST", credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(() => { user.reload().catch(() => {}); })
        .catch(() => {});
    }
  }, [user]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${basePath}/api/leads/stats`);
      if (r.ok) setStats(await r.json());
    } catch {}
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Fetch leads
  const fetchLeads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (search) params.set("search", search);
    if (filterStatus) params.set("status", filterStatus);
    try {
      const r = await fetch(`${basePath}/api/leads/?${params}`);
      const data = await r.json();
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [page, search, filterStatus]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleRefresh = () => { fetchLeads(true); fetchStats(); };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const r = await fetch(`${basePath}/api/stripe/portal`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnUrl: window.location.href }) });
      const data = await r.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } catch {}
    setPortalLoading(false);
  };

  const handleUpgrade = () => { window.location.href = `${basePath}/pricing`; };

  // Status update
  const handleStatusChange = async (id: number, status: LeadStatus) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    try {
      await fetch(`${basePath}/api/leads/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    } catch {}
  };

  // Delete single
  const handleDelete = async (id: number) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    setTotal(t => Math.max(0, t - 1));
    try {
      await fetch(`${basePath}/api/leads/${id}`, { method: "DELETE" });
      fetchStats();
    } catch {}
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selected);
    setLeads(prev => prev.filter(l => !selected.has(l.id)));
    setTotal(t => Math.max(0, t - ids.length));
    setSelected(new Set());
    try {
      await fetch(`${basePath}/api/leads/bulk`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      fetchStats();
    } catch {}
    setDeleting(false);
  };

  // Selection helpers
  const toggleSelect = (id: number) => setSelected(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  const toggleAll = () => { if (selected.size === leads.length) setSelected(new Set()); else setSelected(new Set(leads.map(l => l.id))); };
  const allSelected = leads.length > 0 && selected.size === leads.length;

  const withPhone = leads.filter(l => l.phone).length;
  const withEmail = leads.filter(l => l.emails).length;
  const withSocial = leads.filter(l => l.facebook || l.instagram || l.twitter || l.linkedin).length;

  const exportUrl = `${basePath}/api/leads/export.csv${search || filterStatus ? `?${new URLSearchParams({ ...(search ? { search } : {}), ...(filterStatus ? { status: filterStatus } : {}) })}` : ""}`;

  const lastSynced = stats?.lastSyncedAt
    ? new Date(stats.lastSyncedAt).toLocaleString()
    : null;

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
            {user?.primaryEmailAddress?.emailAddress?.toLowerCase() === ADMIN_EMAIL?.toLowerCase() && (
              <a href={`${basePath}/admin`} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors">
                <ShieldCheck className="w-3.5 h-3.5" /> Admin
              </a>
            )}
            <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity hidden md:block">
              Install Extension
            </a>
            <button onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="pt-28 pb-32">
        <div className="container mx-auto px-6 max-w-6xl">

          {/* Welcome */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-display font-bold mb-1">
                  Welcome back{user?.firstName ? `, ${user.firstName}` : ""} 👋
                </h1>
                <p className="text-muted-foreground">Your extracted leads are saved here automatically.</p>
              </div>
              {/* Last synced + refresh */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
                </button>
                {lastSynced && (
                  <span className="text-xs text-muted-foreground/60">Last sync: {lastSynced}</span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Plan banner */}
          <PlanBanner plan={plan} total={total} onManageBilling={handleManageBilling} onUpgrade={handleUpgrade} />

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
                <button onClick={handleCopyApiKey}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors shrink-0">
                  {apiKeyCopied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Once entered, every extraction auto-saves here — phone, email, website, and all social profiles included.
              </p>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

          {/* Charts toggle */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.16 }} className="mb-2">
            <button
              onClick={() => setShowCharts(s => !s)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <BarChart2 className="w-4 h-4" />
              {showCharts ? "Hide Charts" : "Show Charts"}
            </button>
          </motion.div>

          {/* Charts */}
          <AnimatePresence>
            {showCharts && <ChartsPanel stats={stats} />}
          </AnimatePresence>

          {/* Status filter pills */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.18 }}
            className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-muted-foreground font-semibold mr-1">Filter:</span>
            <button
              onClick={() => { setFilterStatus(""); setPage(1); }}
              className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${!filterStatus ? "bg-primary/15 border-primary/40 text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
            >
              All
            </button>
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setFilterStatus(filterStatus === opt.value ? "" : opt.value); setPage(1); }}
                className={`px-3 py-1 rounded-full border text-xs font-semibold transition-colors ${filterStatus === opt.value ? opt.color : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
              >
                {opt.label}
                {stats?.statusCounts.find(s => s.status === opt.value) && (
                  <span className="ml-1 opacity-70">({stats.statusCounts.find(s => s.status === opt.value)!.count})</span>
                )}
              </button>
            ))}
          </motion.div>

          {/* Leads table */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {/* Table toolbar */}
              <div className="flex items-center justify-between gap-4 p-5 border-b border-border flex-wrap">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-display font-bold">
                    Saved Leads {total > 0 && <span className="text-muted-foreground text-sm font-normal">({total.toLocaleString()})</span>}
                  </h2>
                  {selected.size > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      disabled={deleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete {selected.size}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search leads..."
                      value={searchInput}
                      onChange={e => setSearchInput(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 w-48"
                    />
                    {searchInput && (
                      <button onClick={() => setSearchInput("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <a href={exportUrl}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
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
                  <p className="font-semibold text-foreground mb-1">No leads found</p>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {search || filterStatus ? "Try adjusting your filters." : "Install the extension, enter your API key, then run an extraction — leads appear here automatically."}
                  </p>
                  {!search && !filterStatus && (
                    <a href={STORE_URL} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                      Install Extension
                    </a>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-background/50">
                          <th className="px-4 py-3 w-10">
                            <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground transition-colors">
                              {allSelected ? <CheckCheck className="w-4 h-4 text-primary" /> : selected.size > 0 ? <CheckSquare className="w-4 h-4 text-primary/60" /> : <Square className="w-4 h-4" />}
                            </button>
                          </th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Name</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Phone</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Email</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Website</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Socials</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Category</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Score</th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Status</th>
                          <th className="px-4 py-3 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map((lead, i) => (
                          <tr key={lead.id}
                            className={`border-b border-border/50 transition-colors ${selected.has(lead.id) ? "bg-primary/5" : i % 2 === 0 ? "hover:bg-white/[0.02]" : "bg-white/[0.01] hover:bg-white/[0.03]"}`}>
                            <td className="px-4 py-3">
                              <button onClick={() => toggleSelect(lead.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                                {selected.has(lead.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-foreground truncate max-w-[150px]" title={lead.name ?? ""}>
                                {lead.gmapsUrl ? (
                                  <a href={lead.gmapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">{lead.name}</a>
                                ) : lead.name}
                              </div>
                              {lead.address && (
                                <div className="text-xs text-muted-foreground truncate max-w-[150px]" title={lead.address}>{lead.address}</div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {lead.phone ? (
                                <div className="flex items-center">
                                  <a href={`tel:${lead.phone}`} className="text-primary hover:underline font-mono text-xs whitespace-nowrap">{lead.phone}</a>
                                  <CopyBtn value={lead.phone} title="phone" />
                                </div>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            <td className="px-4 py-3 max-w-[160px]">
                              {lead.emails ? (
                                <div className="flex items-center">
                                  <a href={`mailto:${lead.emails.split(",")[0].trim()}`} className="text-primary hover:underline text-xs truncate block max-w-[130px]" title={lead.emails}>{lead.emails}</a>
                                  <CopyBtn value={lead.emails.split(",")[0].trim()} title="email" />
                                </div>
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
                            <td className="px-4 py-3">
                              <StatusBadge status={lead.status} id={lead.id} onChange={handleStatusChange} />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDelete(lead.id)}
                                className="text-muted-foreground/40 hover:text-red-400 transition-colors"
                                title="Delete lead"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
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
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          <ChevronLeft className="w-4 h-4" /> Prev
                        </button>
                        <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          Next <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>

          {/* Upgrade CTA */}
          {plan && !plan.isPro && total >= FREE_LIMIT * 0.8 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }} className="mt-8">
              <div className="bg-primary/10 border border-primary/30 rounded-2xl p-6 text-center">
                <Crown className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-display font-bold text-xl mb-1">Unlock Unlimited Leads</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  You've used {total} of your {FREE_LIMIT} free leads. Go Pro for $9.99/month and never hit a limit again.
                </p>
                <button onClick={handleUpgrade}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity">
                  <ArrowUpRight className="w-4 h-4" /> Upgrade to Pro — $9.99/mo
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Billing portal loading overlay */}
      {portalLoading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Opening billing portal…</p>
          </div>
        </div>
      )}
    </div>
  );
}
