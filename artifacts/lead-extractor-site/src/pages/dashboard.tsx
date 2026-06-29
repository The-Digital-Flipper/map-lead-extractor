import { useState, useEffect, useCallback, useRef } from "react";
import { useUser, useClerk, useSession } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Copy, Check, Download, LogOut, Star, Phone, Mail, Globe,
  Search, Share2, Crown, ArrowUpRight, CreditCard, Trash2,
  RefreshCw, ChevronLeft, ChevronRight, BarChart2, X,
  CheckSquare, Square, CheckCheck, ShieldCheck, MessageSquare,
  Settings, Bookmark, Plus, Pin, StickyNote, Tag, Bell,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer, Legend,
} from "recharts";
import { CollectionsManager } from "@/components/dashboard/collections-manager";

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
  opportunityScore: number | null;
  needs: string[] | null;
  gmapsUrl: string | null;
  status: string | null;
}

interface StatsData {
  scoreDistribution: { bucket: string; count: number }[];
  opportunityDistribution: { bucket: string; count: number }[];
  needsCounts: { need: string; count: number }[];
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

// ---- Personalization (persisted per client in localStorage) -----------------
// Accent presets re-skin the whole dashboard by overriding the --primary token
// (stored as HSL components to match index.css: `--primary: H S L%`).
const ACCENTS: { key: string; label: string; hsl: string }[] = [
  { key: "green", label: "Green", hsl: "146 100% 45%" },
  { key: "blue", label: "Blue", hsl: "217 91% 60%" },
  { key: "purple", label: "Purple", hsl: "270 91% 65%" },
  { key: "orange", label: "Orange", hsl: "25 95% 53%" },
  { key: "pink", label: "Pink", hsl: "330 81% 60%" },
  { key: "cyan", label: "Cyan", hsl: "190 95% 50%" },
];

type Density = "comfortable" | "compact";
interface ColPrefs { phone: boolean; email: boolean; website: boolean; socials: boolean; category: boolean }
interface DashPrefs {
  brandName: string;
  accent: string;
  density: Density;
  showStats: boolean;
  chartsDefault: boolean;
  defaultMoney: boolean;
  cols: ColPrefs;
}
const DEFAULT_PREFS: DashPrefs = {
  brandName: "",
  accent: "green",
  density: "comfortable",
  showStats: true,
  chartsDefault: false,
  defaultMoney: false,
  cols: { phone: true, email: true, website: true, socials: true, category: true },
};
interface SavedView { name: string; search: string; status: string; money: boolean }

function loadJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); if (raw) return { ...fallback, ...JSON.parse(raw) }; } catch { /* ignore */ }
  return fallback;
}
function loadPrefs(): DashPrefs {
  const p = loadJSON("mle_dash_prefs", DEFAULT_PREFS);
  return { ...p, cols: { ...DEFAULT_PREFS.cols, ...(p.cols ?? {}) } };
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

// Opportunity = "money" potential: HIGH (green) means a weak business that
// needs a website / SEO / ads / reputation help — the leads worth selling.
function OpportunityBadge({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color = s >= 70 ? "bg-primary/20 text-primary border-primary/40"
    : s >= 40 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
    : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${color}`} title="Opportunity score — higher means a weaker online presence to sell services to">
      💰 {s}
    </span>
  );
}

function NeedsBadges({ needs }: { needs: string[] | null }) {
  if (!needs || needs.length === 0) return <span className="text-muted-foreground/40 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1 max-w-[200px]">
      {needs.map(n => (
        <span key={n} className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-white/[0.03] text-[10px] font-medium text-muted-foreground whitespace-nowrap">
          {n}
        </span>
      ))}
    </div>
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
  const { session } = useSession();

  // Authenticated fetch: adds Bearer token so production Clerk middleware
  // can verify the session regardless of cookie domain behaviour.
  const authFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const token = await session?.getToken().catch(() => null);
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, credentials: "include", headers });
  }, [session]);
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
  // Personalization (persisted). Charts/money default come from saved prefs.
  const [prefs, setPrefsState] = useState<DashPrefs>(() => loadPrefs());
  const [showCustomize, setShowCustomize] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    try { const r = localStorage.getItem("mle_saved_views"); if (r) { const p = JSON.parse(r); if (Array.isArray(p)) return p; } } catch {}
    return [];
  });
  const [pinned, setPinned] = useState<Set<number>>(() => {
    try { const r = localStorage.getItem("mle_pinned"); if (r) { const p = JSON.parse(r); if (Array.isArray(p)) return new Set<number>(p); } } catch {}
    return new Set<number>();
  });
  const [showCharts, setShowCharts] = useState(() => loadPrefs().chartsDefault);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showCollections, setShowCollections] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailCopied, setEmailCopied] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [textCopied, setTextCopied] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState<{ sent: number; failed: number } | null>(null);
  const [twilioAvailable, setTwilioAvailable] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  // Money mode: rank by opportunity (weakest businesses first) — the leads
  // worth selling websites / SEO / ads / reputation / automation to.
  const [moneyMode, setMoneyMode] = useState(() => loadPrefs().defaultMoney);
  // Table vs Kanban board (pipeline) view.
  const [viewMode, setViewMode] = useState<"table" | "board">("table");
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  // Show the "Connect extension" card unless dismissed or extension already linked
  const [showConnectCard, setShowConnectCard] = useState<boolean>(() => {
    try { return localStorage.getItem("mle_ext_connected") !== "1"; } catch { return true; }
  });
  const dismissConnectCard = () => {
    setShowConnectCard(false);
    try { localStorage.setItem("mle_ext_connected", "1"); } catch { /* ignore */ }
  };

  // Persist + apply preferences. Accent overrides the global --primary token.
  const updatePrefs = (patch: Partial<DashPrefs>) => {
    setPrefsState(prev => {
      const next = { ...prev, ...patch, cols: { ...prev.cols, ...(patch.cols ?? {}) } };
      try { localStorage.setItem("mle_dash_prefs", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  useEffect(() => {
    const hsl = ACCENTS.find(a => a.key === prefs.accent)?.hsl;
    if (hsl) document.documentElement.style.setProperty("--primary", hsl);
  }, [prefs.accent]);

  // Pin / saved-view persistence helpers
  const togglePin = (id: number) => setPinned(prev => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    try { localStorage.setItem("mle_pinned", JSON.stringify([...s])); } catch { /* ignore */ }
    return s;
  });
  const saveCurrentView = () => {
    const name = window.prompt("Name this view (filters + mode are saved):");
    if (!name) return;
    const view: SavedView = { name: name.trim(), search, status: filterStatus, money: moneyMode };
    setSavedViews(prev => {
      const next = [...prev.filter(v => v.name !== view.name), view];
      try { localStorage.setItem("mle_saved_views", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const applyView = (v: SavedView) => {
    setSearchInput(v.search); setSearch(v.search);
    setFilterStatus(v.status); setMoneyMode(v.money); setPage(1);
  };
  const deleteView = (name: string) => setSavedViews(prev => {
    const next = prev.filter(v => v.name !== name);
    try { localStorage.setItem("mle_saved_views", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  // ── Per-lead notes, tags & reminders (private, member-scoped, server-stored)
  type NoteData = { note: string | null; tags: string[]; reminderAt: string | null; reminderDone: boolean };
  const [notes, setNotes] = useState<Record<number, NoteData>>({});
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [reminderDraft, setReminderDraft] = useState("");  // yyyy-mm-dd
  const [reminders, setReminders] = useState<{ leadId: number; reminderAt: string | null; note: string | null; name: string | null; phone: string | null }[]>([]);

  const openNote = (id: number) => {
    const existing = notes[id];
    setNoteDraft(existing?.note ?? "");
    setTagDraft(existing?.tags ?? []);
    setReminderDraft(existing?.reminderAt ? existing.reminderAt.slice(0, 10) : "");
    setTagInput("");
    setEditingNote(id);
  };
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tagDraft.includes(t)) setTagDraft(d => [...d, t]);
    setTagInput("");
  };
  const fetchReminders = useCallback(async () => {
    try {
      const r = await authFetch(`${basePath}/api/leads/reminders`);
      if (r.ok) { const d = await r.json(); setReminders(d.reminders ?? []); }
    } catch { /* ignore */ }
  }, []);
  const persistNote = async (id: number, data: NoteData) => {
    setNotes(prev => ({ ...prev, [id]: data }));
    try {
      await fetch(`${basePath}/api/leads/${id}/note`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch { /* optimistic */ }
    fetchReminders();
  };
  const saveNote = async (id: number) => {
    const data: NoteData = {
      note: noteDraft.trim() || null,
      tags: tagDraft,
      reminderAt: reminderDraft ? new Date(reminderDraft + "T09:00:00").toISOString() : null,
      reminderDone: notes[id]?.reminderDone ?? false,
    };
    setEditingNote(null);
    await persistNote(id, data);
  };
  const completeReminder = async (id: number) => {
    const existing = notes[id] ?? { note: null, tags: [], reminderAt: null, reminderDone: false };
    await persistNote(id, { ...existing, reminderDone: true });
  };

  // Fetch plan status. (Extension connection is handled by the Google-login
  // flow at /connect-extension, which get-or-creates the API key for the
  // member — so no manual key UI is needed here.)
  useEffect(() => {
    fetch(`${basePath}/api/stripe/status`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((data: PlanStatus | null) => { if (data) setPlan(data); })
      .catch(() => {});
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
    if (moneyMode) params.set("sort", "opportunity");
    try {
      const r = await fetch(`${basePath}/api/leads/?${params}`);
      const data = await r.json();
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [page, search, filterStatus, moneyMode]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Load the current member's private notes/tags for the visible leads.
  useEffect(() => {
    const ids = leads.map(l => l.id);
    if (ids.length === 0) { setNotes({}); return; }
    fetch(`${basePath}/api/leads/notes?ids=${ids.join(",")}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : { notes: {} })
      .then(d => setNotes(d.notes ?? {}))
      .catch(() => {});
  }, [leads]);

  // Load the member's open follow-up reminders once on mount.
  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  // Check whether Twilio SMS is configured on the server.
  useEffect(() => {
    fetch(`${basePath}/api/sms/config`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.available) setTwilioAvailable(true); })
      .catch(() => {});
  }, []);

  // Silently ping the extension on load — if it responds as connected, hide the card.
  useEffect(() => {
    if (!showConnectCard) return;
    const GOOGLE_EXT_ID = "ahhfkbclbkgkbmobkjcahdbgnnlcomjl";
    const BING_EXT_ID = "hdcllknjhfjlgifobniljjgfgmdjhfmg";
    const ping = (extId: string) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cr = (window as any).chrome?.runtime;
        if (!cr) return;
        cr.sendMessage(extId, { type: "MLE_GET_STATUS" }, (res: { connected?: boolean } | undefined) => {
          if (cr.lastError) return;
          if (res?.connected) dismissConnectCard();
        });
      } catch { /* not in a Chrome page */ }
    };
    ping(GOOGLE_EXT_ID);
    ping(BING_EXT_ID);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Derived email/phone lists for bulk actions — recomputed whenever selection or leads change
  const selEmails = [...new Set(
    leads.filter(l => selected.has(l.id) && l.emails)
      .flatMap(l => l.emails!.split(",").map(e => e.trim()).filter(Boolean))
  )];
  const selPhones = [...new Set(
    leads.filter(l => selected.has(l.id) && l.phone)
      .map(l => l.phone!.trim())
      .filter(Boolean)
  )];

  const withPhone = leads.filter(l => l.phone).length;
  const withEmail = leads.filter(l => l.emails).length;
  const withSocial = leads.filter(l => l.facebook || l.instagram || l.twitter || l.linkedin).length;

  // Pinned leads float to the top of the current page. Compact density tightens
  // row padding via Tailwind arbitrary variants on the table element.
  const sortedLeads = [...leads].sort((a, b) => (pinned.has(b.id) ? 1 : 0) - (pinned.has(a.id) ? 1 : 0));
  // Tag filter (client-side over the loaded page) + all tags for the filter bar.
  const allTags = [...new Set(Object.values(notes).flatMap(n => n.tags ?? []))].sort();
  const displayLeads = tagFilter ? sortedLeads.filter(l => notes[l.id]?.tags?.includes(tagFilter)) : sortedLeads;
  const cols = prefs.cols;
  const densityCls = prefs.density === "compact" ? "[&_td]:py-1.5 [&_th]:py-2" : "";

  const exportParams = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(filterStatus ? { status: filterStatus } : {}),
    ...(moneyMode ? { sort: "opportunity" } : {}),
  });
  const exportUrl = `${basePath}/api/leads/export.csv${exportParams.toString() ? `?${exportParams}` : ""}`;

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
            <a href={`${basePath}/command-center`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-colors">
              <MessageSquare className="w-3.5 h-3.5" /> Command Center
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
                  {prefs.brandName
                    ? prefs.brandName
                    : <>Welcome back{user?.firstName ? `, ${user.firstName}` : ""} 👋</>}
                </h1>
                <p className="text-muted-foreground">
                  {prefs.brandName
                    ? `Welcome back${user?.firstName ? `, ${user.firstName}` : ""} — your leads, organized.`
                    : "Your extracted leads are saved here automatically."}
                </p>
              </div>
              {/* Customize + Last synced + refresh */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCustomize(s => !s)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${showCustomize ? "bg-primary/10 border-primary/40 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"}`}
                  >
                    <Settings className="w-3.5 h-3.5" /> Customize
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>
                {lastSynced && (
                  <span className="text-xs text-muted-foreground/60">Last sync: {lastSynced}</span>
                )}
              </div>
            </div>

            {/* Customize panel */}
            <AnimatePresence>
              {showCustomize && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 bg-card border border-primary/30 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Settings className="w-4 h-4 text-primary" />
                      <h3 className="font-display font-bold">Make it yours</h3>
                      <span className="text-xs text-muted-foreground ml-auto">saved to this browser</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Brand name */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Dashboard name</label>
                        <input
                          type="text" value={prefs.brandName} maxLength={40}
                          onChange={e => updatePrefs({ brandName: e.target.value })}
                          placeholder="e.g. Gulf Coast Leads"
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                        />
                      </div>
                      {/* Accent */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Accent color</label>
                        <div className="flex items-center gap-2 flex-wrap">
                          {ACCENTS.map(a => (
                            <button key={a.key} onClick={() => updatePrefs({ accent: a.key })}
                              title={a.label}
                              className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${prefs.accent === a.key ? "border-foreground scale-110" : "border-transparent"}`}
                              style={{ background: `hsl(${a.hsl})` }}
                            />
                          ))}
                        </div>
                      </div>
                      {/* Density */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Table density</label>
                        <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-1 w-fit">
                          {(["comfortable", "compact"] as Density[]).map(d => (
                            <button key={d} onClick={() => updatePrefs({ density: d })}
                              className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${prefs.density === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Layout toggles */}
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Layout</label>
                        <div className="flex flex-col gap-1.5">
                          {([
                            { k: "showStats", label: "Show stats cards" },
                            { k: "chartsDefault", label: "Open charts by default" },
                            { k: "defaultMoney", label: "Start in Money Leads view" },
                          ] as { k: keyof DashPrefs; label: string }[]).map(o => (
                            <label key={o.k} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                              <input type="checkbox" checked={prefs[o.k] as boolean}
                                onChange={e => updatePrefs({ [o.k]: e.target.checked } as Partial<DashPrefs>)}
                                className="accent-primary w-4 h-4" />
                              {o.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      {/* Columns */}
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Visible columns</label>
                        <div className="flex items-center gap-4 flex-wrap">
                          {([
                            { k: "phone", label: "Phone" }, { k: "email", label: "Email" },
                            { k: "website", label: "Website" }, { k: "socials", label: "Socials" },
                            { k: "category", label: "Category" },
                          ] as { k: keyof ColPrefs; label: string }[]).map(c => (
                            <label key={c.k} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                              <input type="checkbox" checked={prefs.cols[c.k]}
                                onChange={e => updatePrefs({ cols: { ...prefs.cols, [c.k]: e.target.checked } })}
                                className="accent-primary w-4 h-4" />
                              {c.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-border flex justify-end">
                      <button onClick={() => updatePrefs(DEFAULT_PREFS)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Reset to defaults
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Follow-ups due */}
          {reminders.length > 0 && (() => {
            const today = new Date(); today.setHours(23, 59, 59, 999);
            const due = reminders.filter(r => r.reminderAt && new Date(r.reminderAt) <= today);
            if (due.length === 0) return null;
            const fmtDue = (iso: string | null) => {
              if (!iso) return "";
              const d = new Date(iso); const now = new Date();
              const days = Math.round((d.getTime() - now.setHours(0, 0, 0, 0)) / 86400000);
              return days < 0 ? `${-days}d overdue` : days === 0 ? "today" : `in ${days}d`;
            };
            return (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }} className="mb-8">
                <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Bell className="w-4 h-4 text-yellow-400" />
                    <h2 className="font-display font-bold text-foreground">Follow-ups due</h2>
                    <span className="text-xs font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">{due.length}</span>
                  </div>
                  <div className="space-y-2">
                    {due.slice(0, 6).map(r => {
                      const overdue = r.reminderAt ? new Date(r.reminderAt) < new Date(new Date().setHours(0, 0, 0, 0)) : false;
                      return (
                        <div key={r.leadId} className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${overdue ? "bg-red-500/15 text-red-400" : "bg-yellow-500/15 text-yellow-400"}`}>{fmtDue(r.reminderAt)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-foreground truncate">{r.name ?? "Lead"}</div>
                            {r.note && <div className="text-xs text-muted-foreground truncate">{r.note}</div>}
                          </div>
                          {r.phone && <a href={`tel:${r.phone}`} className="text-xs text-primary font-mono hover:underline shrink-0 hidden sm:block">{r.phone}</a>}
                          <button onClick={() => completeReminder(r.leadId)} title="Mark done"
                            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
                            <Check className="w-3.5 h-3.5" /> Done
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            );
          })()}

          {/* Plan banner */}
          <PlanBanner plan={plan} total={total} onManageBilling={handleManageBilling} onUpgrade={handleUpgrade} />

          {/* Connect Extension card — hidden once connected or dismissed */}
          {showConnectCard && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="mb-8">
            <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-display font-bold mb-1">Connect your extension</h2>
                <p className="text-sm text-muted-foreground">
                  Sign in with Google in the extension popup — your leads will auto-save here after every extraction.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <a href={`${basePath}/connect-extension`}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                  <Zap className="w-4 h-4" /> Connect Extension
                </a>
                <button onClick={dismissConnectCard} title="Dismiss"
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
          )}

          {/* Stats row */}
          {prefs.showStats && (
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
          )}

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

          {/* Money Leads + view toggle */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.175 }}
            className="mb-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 w-fit">
              <button
                onClick={() => { setMoneyMode(false); setPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${!moneyMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                All Leads
              </button>
              <button
                onClick={() => { setMoneyMode(true); setPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${moneyMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                💰 Money Leads
              </button>
            </div>
            <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 w-fit">
              <button onClick={() => setViewMode("table")}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                ☰ Table
              </button>
              <button onClick={() => setViewMode("board")}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === "board" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                ▦ Board
              </button>
            </div>
            {moneyMode && (
              <p className="text-xs text-muted-foreground mt-2 max-w-2xl">
                Ranked by <span className="text-primary font-semibold">opportunity</span> — businesses with a weak online presence (no website, few reviews, low rating, no socials) that you can sell websites, SEO, ads, reputation, or automation to.
                <span className="block mt-0.5 text-muted-foreground/70">Not yet scored: website quality, online booking, ad presence — these need a follow-up enrichment pass.</span>
              </p>
            )}
          </motion.div>

          {/* Saved Views */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.177 }}
            className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-muted-foreground font-semibold mr-1 flex items-center gap-1"><Bookmark className="w-3.5 h-3.5" /> Views:</span>
            {savedViews.length === 0 && (
              <span className="text-xs text-muted-foreground/50">Save your filters as a one-click view →</span>
            )}
            {savedViews.map(v => (
              <span key={v.name} className="group inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full border border-border bg-card text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                <button onClick={() => applyView(v)} className="flex items-center gap-1">
                  {v.money && "💰"} {v.name}
                </button>
                <button onClick={() => deleteView(v.name)} title="Delete view"
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-red-400 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button onClick={saveCurrentView}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-border text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
              <Plus className="w-3 h-3" /> Save view
            </button>
          </motion.div>

          {/* Tag filter (from your private lead tags) */}
          {allTags.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs text-muted-foreground font-semibold mr-1 flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Tags:</span>
              {allTags.map(t => (
                <button key={t} onClick={() => setTagFilter(tagFilter === t ? "" : t)}
                  className={`px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${tagFilter === t ? "bg-primary/15 border-primary/40 text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
                  {t}
                </button>
              ))}
              {tagFilter && (
                <button onClick={() => setTagFilter("")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <X className="w-3 h-3" /> clear
                </button>
              )}
            </motion.div>
          )}

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
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
                      <CheckSquare className="w-3 h-3" /> {selected.size} selected
                    </span>
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
                  <button
                    onClick={() => setShowCollections(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-bold text-foreground hover:border-primary/50 transition-colors"
                    data-testid="btn-open-collections"
                  >
                    <Bookmark className="w-4 h-4" /> Collections{selected.size > 0 ? ` (+${selected.size})` : ""}
                  </button>
                  <a href={exportUrl}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                    <Download className="w-4 h-4" /> {moneyMode ? "Export Money Leads" : "Export CSV"}
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
              ) : viewMode === "board" ? (
                /* ── Kanban pipeline board ── */
                <div className="p-4 overflow-x-auto">
                  <div className="flex gap-4 min-w-max">
                    {STATUS_OPTIONS.map(col => {
                      const colLeads = displayLeads.filter(l => (l.status ?? "new") === col.value);
                      return (
                        <div key={col.value}
                          onDragOver={e => { e.preventDefault(); setDragOverStatus(col.value); }}
                          onDragLeave={() => setDragOverStatus(s => (s === col.value ? null : s))}
                          onDrop={e => { e.preventDefault(); const id = Number(e.dataTransfer.getData("text/plain")); if (id) handleStatusChange(id, col.value as LeadStatus); setDragOverStatus(null); }}
                          className={`w-72 shrink-0 rounded-xl border p-3 transition-colors ${dragOverStatus === col.value ? "border-primary bg-primary/5" : "border-border bg-background/40"}`}>
                          <div className="flex items-center justify-between mb-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold ${col.color}`}>{col.label}</span>
                            <span className="text-xs text-muted-foreground">{colLeads.length}</span>
                          </div>
                          <div className="space-y-2 min-h-[80px]">
                            {colLeads.map(lead => (
                              <div key={lead.id} draggable
                                onDragStart={e => e.dataTransfer.setData("text/plain", String(lead.id))}
                                className="bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors">
                                <div className="flex items-start justify-between gap-2 mb-0.5">
                                  <div className="font-semibold text-sm text-foreground truncate" title={lead.name ?? ""}>{lead.name}</div>
                                  {moneyMode ? <OpportunityBadge score={lead.opportunityScore} /> : <ScoreBadge score={lead.score} />}
                                </div>
                                {lead.category && <div className="text-xs text-muted-foreground truncate">{lead.category}</div>}
                                {lead.phone && <a href={`tel:${lead.phone}`} className="text-xs text-primary font-mono hover:underline">{lead.phone}</a>}
                                {notes[lead.id]?.tags && notes[lead.id].tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {notes[lead.id].tags.map(t => (
                                      <span key={t} className="px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary text-[10px] font-semibold">{t}</span>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                                  <button onClick={() => openNote(lead.id)} title="Note & tags" className="text-muted-foreground/50 hover:text-primary transition-colors"><StickyNote className="w-3.5 h-3.5" /></button>
                                  {notes[lead.id]?.reminderAt && !notes[lead.id]?.reminderDone && <Bell className="w-3.5 h-3.5 text-yellow-400" />}
                                  <button onClick={() => togglePin(lead.id)} title="Pin" className={`transition-colors ${pinned.has(lead.id) ? "text-primary" : "text-muted-foreground/40 hover:text-primary"}`}><Pin className={`w-3.5 h-3.5 ${pinned.has(lead.id) ? "fill-current" : ""}`} /></button>
                                </div>
                              </div>
                            ))}
                            {colLeads.length === 0 && <div className="text-xs text-muted-foreground/30 text-center py-6 border border-dashed border-border/50 rounded-lg">Drop here</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-3 px-1">Drag cards between columns to update status — showing this page's {displayLeads.length} leads.</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className={`w-full text-sm ${densityCls}`}>
                      <thead>
                        <tr className="border-b border-border bg-background/50">
                          <th className="px-3 py-3 w-12">
                            <button onClick={toggleAll}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border ${allSelected || selected.size > 0 ? "bg-primary/20 border-primary/60 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary/60 hover:bg-primary/5"}`}>
                              {allSelected ? <CheckCheck className="w-4 h-4" /> : selected.size > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </button>
                          </th>
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Name</th>
                          {cols.phone && <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Phone</th>}
                          {cols.email && <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Email</th>}
                          {cols.website && <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Website</th>}
                          {cols.socials && <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Socials</th>}
                          {cols.category && <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Category</th>}
                          {moneyMode ? (
                            <>
                              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Opportunity</th>
                              <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Needs</th>
                            </>
                          ) : (
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Score</th>
                          )}
                          <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Status</th>
                          <th className="px-4 py-3 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayLeads.map((lead, i) => (
                          <tr key={lead.id}
                            className={`border-b transition-colors ${selected.has(lead.id) ? "border-primary/20 bg-primary/10" : pinned.has(lead.id) ? "border-border/50 bg-primary/[0.04]" : i % 2 === 0 ? "border-border/50 hover:bg-white/[0.02]" : "border-border/50 bg-white/[0.01] hover:bg-white/[0.03]"}`}
                            style={selected.has(lead.id) ? { boxShadow: "inset 3px 0 0 #00E676" } : undefined}>
                            <td className="px-3 py-3">
                              <button onClick={() => toggleSelect(lead.id)}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border ${selected.has(lead.id) ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/40" : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary/70 hover:bg-primary/5"}`}>
                                {selected.has(lead.id) ? <Check className="w-4 h-4" /> : <Square className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => togglePin(lead.id)} title={pinned.has(lead.id) ? "Unpin" : "Pin to top"}
                                  className={`shrink-0 transition-colors ${pinned.has(lead.id) ? "text-primary" : "text-muted-foreground/30 hover:text-primary"}`}>
                                  <Pin className={`w-3.5 h-3.5 ${pinned.has(lead.id) ? "fill-current" : ""}`} />
                                </button>
                                <div className="font-semibold text-foreground truncate max-w-[150px]" title={lead.name ?? ""}>
                                  {lead.gmapsUrl ? (
                                    <a href={lead.gmapsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">{lead.name}</a>
                                  ) : lead.name}
                                </div>
                              </div>
                              {lead.address && (
                                <div className="text-xs text-muted-foreground truncate max-w-[150px] pl-5" title={lead.address}>{lead.address}</div>
                              )}
                              {notes[lead.id]?.tags && notes[lead.id].tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1 pl-5 max-w-[180px]">
                                  {notes[lead.id].tags.map(t => (
                                    <button key={t} onClick={() => setTagFilter(tagFilter === t ? "" : t)}
                                      className="inline-flex items-center px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors">
                                      {t}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>
                            {cols.phone && (
                            <td className="px-4 py-3">
                              {lead.phone ? (
                                <div className="flex items-center">
                                  <a href={`tel:${lead.phone}`} className="text-primary hover:underline font-mono text-xs whitespace-nowrap">{lead.phone}</a>
                                  <CopyBtn value={lead.phone} title="phone" />
                                </div>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            )}
                            {cols.email && (
                            <td className="px-4 py-3 max-w-[160px]">
                              {lead.emails ? (
                                <div className="flex items-center">
                                  <a href={`mailto:${lead.emails.split(",")[0].trim()}`} className="text-primary hover:underline text-xs truncate block max-w-[130px]" title={lead.emails}>{lead.emails}</a>
                                  <CopyBtn value={lead.emails.split(",")[0].trim()} title="email" />
                                </div>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            )}
                            {cols.website && (
                            <td className="px-4 py-3">
                              {lead.website ? (
                                <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                  <Globe className="w-3 h-3" /> Site
                                </a>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            )}
                            {cols.socials && (
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
                            )}
                            {cols.category && <td className="px-4 py-3 text-xs text-muted-foreground">{lead.category ?? "—"}</td>}
                            {moneyMode ? (
                              <>
                                <td className="px-4 py-3"><OpportunityBadge score={lead.opportunityScore} /></td>
                                <td className="px-4 py-3"><NeedsBadges needs={lead.needs} /></td>
                              </>
                            ) : (
                              <td className="px-4 py-3"><ScoreBadge score={lead.score} /></td>
                            )}
                            <td className="px-4 py-3">
                              <StatusBadge status={lead.status} id={lead.id} onChange={handleStatusChange} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {notes[lead.id]?.reminderAt && !notes[lead.id]?.reminderDone && (
                                  <Bell className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                                )}
                                <button
                                  onClick={() => openNote(lead.id)}
                                  className={`transition-colors ${notes[lead.id]?.note || notes[lead.id]?.tags?.length ? "text-primary" : "text-muted-foreground/40 hover:text-primary"}`}
                                  title={notes[lead.id]?.note || notes[lead.id]?.tags?.length ? "Edit note & tags" : "Add note & tags"}
                                >
                                  <StickyNote className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(lead.id)}
                                  className="text-muted-foreground/40 hover:text-red-400 transition-colors"
                                  title="Delete lead"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
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

      {/* ── Floating bulk action bar ─────────────────────────────────────── */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-3 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-2xl"
            style={{ boxShadow: "0 8px 40px rgba(0,230,118,0.12), 0 2px 16px rgba(0,0,0,0.5)" }}
          >
            <span className="text-sm font-bold text-foreground pr-2 border-r border-border mr-1">
              {selected.size} selected
            </span>

            {selEmails.length > 0 && (
              <button
                onClick={() => { setShowEmailModal(true); setEmailCopied(false); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                Email {selEmails.length}
              </button>
            )}

            {selPhones.length > 0 && (
              <button
                onClick={() => { setShowTextModal(true); setTextCopied(false); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Text {selPhones.length}
              </button>
            )}

            {selPhones.length > 0 && (
              <button
                onClick={() => {
                  localStorage.setItem("mle_cc_import", selPhones.join("\n"));
                  window.location.href = `${basePath}/command-center?tab=bulk`;
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00E676]/10 border border-[#00E676]/40 text-[#00E676] text-xs font-bold hover:bg-[#00E676]/20 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Import to Command Center
              </button>
            )}

            {selEmails.length > 0 && (
              <button
                onClick={async () => { try { await navigator.clipboard.writeText(selEmails.join(", ")); } catch {} }}
                title="Copy emails"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-xs font-semibold hover:text-foreground hover:border-border/80 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Emails
              </button>
            )}

            {selPhones.length > 0 && (
              <button
                onClick={async () => { try { await navigator.clipboard.writeText(selPhones.join(", ")); } catch {} }}
                title="Copy phones"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-xs font-semibold hover:text-foreground hover:border-border/80 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" /> Phones
              </button>
            )}

            <button
              onClick={handleBulkDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>

            <button
              onClick={() => setSelected(new Set())}
              title="Deselect all"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk email composer modal */}
      <AnimatePresence>
        {showEmailModal && (() => {
          const mailtoHref = `mailto:?bcc=${encodeURIComponent(selEmails.join(","))}&subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
          const gmailHref = `https://mail.google.com/mail/?view=cm&bcc=${encodeURIComponent(selEmails.join(","))}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowEmailModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                onClick={e => e.stopPropagation()}
                className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="w-4 h-4 text-primary" />
                  <h3 className="font-display font-bold">Bulk Email</h3>
                  <span className="ml-1 text-xs text-muted-foreground">{selEmails.length} recipient{selEmails.length !== 1 ? "s" : ""}</span>
                  <button onClick={() => setShowEmailModal(false)} className="ml-auto text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Recipient chips */}
                <div className="mb-4 max-h-28 overflow-y-auto flex flex-wrap gap-1.5 p-3 bg-background border border-border rounded-lg">
                  {selEmails.map(em => (
                    <span key={em} className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-mono">
                      {em}
                    </span>
                  ))}
                </div>

                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Subject</label>
                <input
                  type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  placeholder="e.g. Quick question about your business"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 mb-4"
                />

                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Message</label>
                <textarea
                  value={emailBody} onChange={e => setEmailBody(e.target.value)}
                  rows={5} placeholder="Hi there, I noticed your business could benefit from…"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none mb-5"
                />

                <div className="flex flex-wrap gap-2 justify-between">
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(selEmails.join(", ")); setEmailCopied(true); setTimeout(() => setEmailCopied(false), 2000); } catch {}
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {emailCopied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                    {emailCopied ? "Copied!" : "Copy emails"}
                  </button>
                  <div className="flex gap-2">
                    <a href={mailtoHref}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      <Mail className="w-3.5 h-3.5" /> Mail app
                    </a>
                    <a href={gmailHref} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Open in Gmail
                    </a>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Bulk text / SMS modal */}
      <AnimatePresence>
        {showTextModal && (() => {
          const smsHref = `sms:${selPhones.join(",")}${smsMessage.trim() ? `?body=${encodeURIComponent(smsMessage.trim())}` : ""}`;
          const handleSendNow = async () => {
            if (!smsMessage.trim() || smsSending) return;
            setSmsSending(true);
            setSmsResult(null);
            try {
              const token = await session?.getToken().catch(() => null);
              const headers: Record<string, string> = { "Content-Type": "application/json" };
              if (token) headers["Authorization"] = `Bearer ${token}`;
              const r = await fetch(`${basePath}/api/sms/send`, {
                method: "POST",
                credentials: "include",
                headers,
                body: JSON.stringify({ phones: selPhones, message: smsMessage.trim() }),
              });
              const d = await r.json();
              setSmsResult({ sent: d.sent ?? 0, failed: d.failed ?? 0 });
            } catch {
              setSmsResult({ sent: 0, failed: selPhones.length });
            } finally {
              setSmsSending(false);
            }
          };

          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => { setShowTextModal(false); setSmsResult(null); }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                onClick={e => e.stopPropagation()}
                className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Phone className="w-4 h-4 text-blue-400" />
                  <h3 className="font-display font-bold">Bulk Text</h3>
                  <span className="ml-1 text-xs text-muted-foreground">{selPhones.length} number{selPhones.length !== 1 ? "s" : ""}</span>
                  <button onClick={() => { setShowTextModal(false); setSmsResult(null); }} className="ml-auto text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Phone number chips */}
                <div className="mb-4 max-h-28 overflow-y-auto flex flex-wrap gap-1.5 p-3 bg-background border border-border rounded-lg">
                  {selPhones.map(ph => (
                    <span key={ph} className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono">
                      {ph}
                    </span>
                  ))}
                </div>

                {/* Message compose */}
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Message</label>
                <div className="relative mb-1">
                  <textarea
                    value={smsMessage} onChange={e => { setSmsMessage(e.target.value); setSmsResult(null); }}
                    rows={4}
                    placeholder="Hi, I noticed your business on Google Maps and wanted to reach out…"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
                  />
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] text-muted-foreground">{smsMessage.length} chars · ~{Math.ceil(smsMessage.length / 160)} SMS segment{Math.ceil(smsMessage.length / 160) !== 1 ? "s" : ""} per recipient</span>
                </div>

                {/* Send result banner */}
                {smsResult && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold mb-4 ${smsResult.failed === 0 ? "bg-primary/10 border border-primary/30 text-primary" : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400"}`}>
                    {smsResult.failed === 0
                      ? <><Check className="w-3.5 h-3.5" /> {smsResult.sent} message{smsResult.sent !== 1 ? "s" : ""} sent successfully!</>
                      : <>{smsResult.sent} sent, {smsResult.failed} failed — check numbers are in E.164 format (+15551234567)</>
                    }
                  </div>
                )}

                {/* Twilio send OR setup notice */}
                {twilioAvailable ? (
                  <div className="flex flex-wrap gap-2 justify-between items-center">
                    <button
                      onClick={async () => { try { await navigator.clipboard.writeText(selPhones.join(", ")); setTextCopied(true); setTimeout(() => setTextCopied(false), 2000); } catch {} }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {textCopied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                      {textCopied ? "Copied!" : "Copy phones"}
                    </button>
                    <div className="flex gap-2">
                      <a href={smsHref} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                        <Phone className="w-3.5 h-3.5" /> SMS app
                      </a>
                      <button
                        onClick={handleSendNow}
                        disabled={!smsMessage.trim() || smsSending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
                      >
                        {smsSending
                          ? <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending…</>
                          : <><Phone className="w-3.5 h-3.5" /> Send {selPhones.length} text{selPhones.length !== 1 ? "s" : ""}</>
                        }
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 justify-between items-center">
                      <button
                        onClick={async () => { try { await navigator.clipboard.writeText(selPhones.join(", ")); setTextCopied(true); setTimeout(() => setTextCopied(false), 2000); } catch {} }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {textCopied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                        {textCopied ? "Copied!" : "Copy phones"}
                      </button>
                      <a href={smsHref}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:opacity-90 transition-opacity">
                        <Phone className="w-3.5 h-3.5" /> Open SMS app
                      </a>
                    </div>
                    <div className="p-3 bg-background border border-border rounded-lg text-xs text-muted-foreground leading-relaxed">
                      <strong className="text-foreground block mb-1">🔌 Enable in-app sending</strong>
                      Add 3 secrets to unlock direct texting without leaving the dashboard:
                      <ul className="mt-1.5 space-y-0.5 list-disc list-inside">
                        <li><code className="text-foreground">TWILIO_ACCOUNT_SID</code></li>
                        <li><code className="text-foreground">TWILIO_AUTH_TOKEN</code></li>
                        <li><code className="text-foreground">TWILIO_FROM_NUMBER</code> <span className="text-[10px]">(e.g. +15551234567)</span></li>
                      </ul>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Note & tags editor modal */}
      <AnimatePresence>
        {editingNote !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingNote(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-1">
                <StickyNote className="w-4 h-4 text-primary" />
                <h3 className="font-display font-bold">Note & tags</h3>
                <button onClick={() => setEditingNote(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-4 truncate">
                {leads.find(l => l.id === editingNote)?.name ?? "Lead"} — private to you
              </p>

              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Note</label>
              <textarea
                value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                rows={4} placeholder="Call back Tuesday, owner is Mike, quoted $1,500 for a 5-page site…"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none mb-4"
              />

              <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tagDraft.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold">
                    {t}
                    <button onClick={() => setTagDraft(d => d.filter(x => x !== t))} className="hover:text-red-400"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-5">
                <input
                  type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="hot-lead, follow-up, website…"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
                <button onClick={addTag}
                  className="px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Follow up on</label>
              <div className="flex items-center gap-2 mb-5">
                <input
                  type="date" value={reminderDraft} onChange={e => setReminderDraft(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
                />
                {reminderDraft && (
                  <button onClick={() => setReminderDraft("")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <X className="w-3 h-3" /> clear
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setEditingNote(null)}
                  className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button onClick={() => saveNote(editingNote)}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CollectionsManager
        open={showCollections}
        onOpenChange={setShowCollections}
        authFetch={authFetch}
        basePath={basePath}
        selectedLeadIds={Array.from(selected)}
        onAdded={() => setSelected(new Set())}
      />
    </div>
  );
}
