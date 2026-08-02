import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { useUser, useSession } from "@clerk/react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RefreshCw, Download, Trash2, Crown, ArrowUpRight,
  CheckCircle2, XCircle, Loader2, Terminal, SlidersHorizontal, Database,
  Info, Code2, Copy, Share2, Check,
} from "lucide-react";
import { useSeo } from "@/lib/seo";
import { getActor, type ScraperActor } from "@/lib/scraperActors";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ScrapeRunRow {
  id: number;
  category: string;
  location: string | null;
  status: "running" | "succeeded" | "failed";
  placesFound: number | null;
  saved: number | null;
  duplicates: number | null;
  error: string | null;
  durationMs: number | null;
  startedAt: string;
  finishedAt: string | null;
}

interface ScrapeRunItem {
  name: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
}

type ScrapeRunDetail = ScrapeRunRow & { items: ScrapeRunItem[] };

type ActorTab = "input" | "log" | "dataset" | "information" | "api";

function logTime() {
  return new Date().toLocaleTimeString([], { hour12: false });
}

const API_ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

function ApiTab({ actor }: { actor: ScraperActor }) {
  const [copied, setCopied] = useState<string | null>(null);
  const endpoint = `${API_ORIGIN}${basePath}/api/scraper/${actor.slug}/runs`;
  const curl = `curl -X POST "${endpoint}" \\
  -H "Authorization: Bearer <your-session-token>" \\
  -H "Content-Type: application/json" \\
  -d '{"category":"plumbers","location":"Mobile AL","maxPlaces":60}'`;
  const js = `await fetch("${endpoint}", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${sessionToken}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ category: "plumbers", location: "Mobile AL", maxPlaces: 60 }),
});`;

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-xs text-muted-foreground">
        There's no separate public API key yet — these calls use your normal signed-in session token
        (the one Clerk issues when you're logged into this site), so this is mainly useful for your own
        scripts while signed in, not third-party integrations.
      </p>
      {[{ label: "curl", code: curl }, { label: "JavaScript", code: js }].map(({ label, code }) => (
        <div key={label}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
            <button onClick={() => copy(label, code)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Copy className="w-3 h-3" /> {copied === label ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="rounded-xl bg-black/70 border border-border p-4 font-mono text-xs text-primary/90 overflow-x-auto whitespace-pre">{code}</pre>
        </div>
      ))}
    </div>
  );
}

export default function Scraper() {
  const { slug } = useParams<{ slug: string }>();
  const actor = getActor(slug);
  useSeo({ title: `${actor?.name ?? "Scraper"} — MapLeadExtractor`, path: `/scraper/${slug}` });
  const { isLoaded, isSignedIn, user } = useUser();
  const { session } = useSession();

  // Authenticated fetch: adds Bearer token so production Clerk middleware
  // can verify the session regardless of cookie domain behaviour.
  const authFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const token = await session?.getToken().catch(() => null);
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...init, credentials: "include", headers });
  }, [session]);

  const [runnerCategory, setRunnerCategory] = useState("");
  const [runnerLocation, setRunnerLocation] = useState("");
  const [runnerMaxPlaces, setRunnerMaxPlaces] = useState(60);
  const [runnerEnrichContacts, setRunnerEnrichContacts] = useState(true);
  const [runnerMaxScrolls, setRunnerMaxScrolls] = useState(3);
  const [shared, setShared] = useState(false);
  const [runStarting, setRunStarting] = useState(false);
  const [runError, setRunError] = useState("");
  const [upgradeNotice, setUpgradeNotice] = useState<{ used: number; limit: number } | null>(null);
  const [busyNotice, setBusyNotice] = useState(false);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);

  const [runs, setRuns] = useState<ScrapeRunRow[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<ScrapeRunDetail | null>(null);
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const [runDeleteBusyId, setRunDeleteBusyId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<ActorTab>("input");
  const [logLines, setLogLines] = useState<string[]>([]);
  const logTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pushLog = useCallback((line: string) => {
    setLogLines(prev => [...prev, `[${logTime()}] ${line}`]);
  }, []);

  useEffect(() => () => { if (logTimerRef.current) clearInterval(logTimerRef.current); }, []);

  const loadRuns = useCallback(async () => {
    if (!actor) return;
    setRunsLoading(true);
    try {
      const r = await authFetch(`${basePath}/api/scraper/${actor.slug}/runs?limit=30`);
      const d = await r.json();
      if (r.ok) setRuns(d.runs);
    } catch { /* keep whatever was already loaded */ }
    setRunsLoading(false);
  }, [authFetch, actor]);

  useEffect(() => { if (isSignedIn) loadRuns(); }, [isSignedIn, loadRuns]);

  const startScraperRun = async () => {
    if (!actor || !runnerCategory.trim() || runStarting) return;
    if (!isSignedIn) { window.location.href = `${basePath}/sign-in?redirect_url=${encodeURIComponent(`${basePath}/scraper/${actor.slug}`)}`; return; }
    const category = runnerCategory.trim();
    const location = runnerLocation.trim();

    setRunStarting(true);
    setRunError("");
    setUpgradeNotice(null);
    setBusyNotice(false);
    setActiveTab("log");
    setLogLines([]);
    pushLog("Starting run…");
    pushLog("Launching headless browser…");
    pushLog(`Scraping "${category}"${location ? ` in ${location}` : ""} (up to ${runnerMaxPlaces} places)…`);

    // Synthesize a live-feeling log tail while the real (blocking) scrape runs —
    // the backend doesn't stream progress, so we fake the in-between beats.
    const filler = [
      "Scrolling results panel…", "Extracting listing details…",
      ...(runnerEnrichContacts ? ["Visiting business websites for emails & socials…"] : []),
      "Still working — this can take up to a minute…",
    ];
    let fillerIdx = 0;
    logTimerRef.current = setInterval(() => {
      pushLog(filler[fillerIdx % filler.length]);
      fillerIdx++;
    }, 4000);

    try {
      const r = await authFetch(`${basePath}/api/scraper/${actor.slug}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category, location, maxScrolls: runnerMaxScrolls,
          maxPlaces: runnerMaxPlaces, enrichContacts: runnerEnrichContacts,
        }),
      });
      const d = await r.json();
      if (logTimerRef.current) { clearInterval(logTimerRef.current); logTimerRef.current = null; }

      if (r.status === 429 && d.upgrade) {
        setUpgradeNotice({ used: d.used, limit: d.limit });
        setQuota({ used: d.used, limit: d.limit });
        pushLog("Run blocked — daily quota reached.");
      } else if (r.status === 429) {
        setBusyNotice(true);
        pushLog("Run blocked — another scrape is already in progress site-wide.");
      } else if (!r.ok) {
        setRunError(d.error ?? "Run failed to start");
        pushLog(`Run failed to start — ${d.error ?? "unknown error"}`);
      } else {
        if (typeof d.used === "number" && typeof d.limit === "number") {
          setQuota({ used: d.used, limit: d.limit });
        }
        if (d.run) {
          setSelectedRun(d.run);
          if (d.run.status === "succeeded") {
            pushLog(`Run succeeded — ${d.run.placesFound ?? 0} places found, ${d.run.saved ?? 0} saved, ${d.run.duplicates ?? 0} duplicates.`);
            setActiveTab("dataset");
          } else if (d.run.status === "failed") {
            pushLog(`Run failed — ${d.run.error ?? "unknown error"}`);
          } else {
            pushLog("Run finished.");
          }
        }
      }
    } catch {
      if (logTimerRef.current) { clearInterval(logTimerRef.current); logTimerRef.current = null; }
      setRunError("Could not reach the server");
      pushLog("Run failed — could not reach the server.");
    }
    setRunStarting(false);
    loadRuns();
  };

  const viewRun = async (id: number) => {
    setRunDetailLoading(true);
    setActiveTab("dataset");
    try {
      const r = await authFetch(`${basePath}/api/scraper/runs/${id}`);
      const d = await r.json();
      if (r.ok) setSelectedRun(d.run);
    } catch { /* ignore */ }
    setRunDetailLoading(false);
  };

  const deleteRun = async (id: number) => {
    setRunDeleteBusyId(id);
    try {
      await authFetch(`${basePath}/api/scraper/runs/${id}`, { method: "DELETE" });
    } catch { /* ignore */ }
    if (selectedRun?.id === id) setSelectedRun(null);
    setRunDeleteBusyId(null);
    loadRuns();
  };

  const runStatusBadge = (status: string) =>
    status === "running" ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
    : status === "succeeded" ? "bg-primary/15 text-primary border-primary/40"
    : "bg-red-500/15 text-red-400 border-red-500/40";

  const statusIcon = (status: string) =>
    status === "running" ? <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
    : status === "succeeded" ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
    : <XCircle className="w-3.5 h-3.5 text-red-400" />;

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!actor || !actor.live) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-lg font-display font-bold mb-2">Scraper not found</p>
          <p className="text-sm text-muted-foreground mb-4">That scraper doesn't exist or isn't live yet.</p>
          <a href={`${basePath}/scraper`} className="text-sm font-semibold text-primary hover:opacity-80">← Back to the Scraper Store</a>
        </div>
      </div>
    );
  }

  const username = user?.username || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "you";
  const platformLabel = actor.name.replace(/ Scraper$/, "");

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${actor.name} — free tool`, url }); return; } catch { /* cancelled or unsupported — fall through to copy */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1500);
    } catch { /* clipboard blocked — nothing more we can do */ }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <a href={`${basePath}/scraper`} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <span className="font-display font-bold">{actor.name}</span>
          <button onClick={share} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            {shared ? <Check className="w-3.5 h-3.5 text-primary" /> : <Share2 className="w-3.5 h-3.5" />}
            {shared ? "Copied!" : "Share"}
          </button>
          {quota && (
            <span className="ml-auto text-xs font-mono text-muted-foreground">
              {quota.used} / {quota.limit} runs used today
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">

          {/* ── Actor header ─────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center shrink-0">
                  <actor.Icon className={`w-6 h-6 ${actor.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg font-display font-bold leading-tight">{actor.name}</h1>
                  <p className="text-xs font-mono text-muted-foreground truncate">{username}/{actor.slug}-scraper</p>
                </div>
              </div>
              <button onClick={startScraperRun} disabled={runStarting || !runnerCategory.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0">
                <RefreshCw className={`w-4 h-4 ${runStarting ? "animate-spin" : ""}`} />
                {runStarting ? "Running…" : "▶ Start"}
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Pulls business name, phone, website, address and rating from {platformLabel} for a search term + location — no scraping know-how needed, just fill in the two fields and hit Start.
            </p>
            <div className="flex items-center gap-4 mt-3 text-xs font-mono text-muted-foreground">
              <span>{runs.length} run{runs.length === 1 ? "" : "s"}</span>
              {runs[0] && <span>last run {new Date(runs[0].startedAt).toLocaleDateString()}</span>}
            </div>
          </div>

          {/* Notices */}
          {!isSignedIn && (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-muted border border-border flex-wrap">
              <span className="text-xs text-muted-foreground">
                Browsing free — <span className="text-foreground font-semibold">sign in</span> to start a run and keep your history.
              </span>
              <a href={`${basePath}/sign-in?redirect_url=${encodeURIComponent(`${basePath}/scraper`)}`}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap">
                Sign In
              </a>
            </div>
          )}
          {runError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
              ⚠ {runError}
            </div>
          )}
          {upgradeNotice && (
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-foreground">
                <Crown className="w-4 h-4 text-primary shrink-0" />
                You've used {upgradeNotice.used} of {upgradeNotice.limit} runs today. Upgrade to Pro for 5 runs/day.
              </div>
              <a href={`${basePath}/pricing`}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap">
                Upgrade <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
          {busyNotice && (
            <div className="px-3 py-2.5 rounded-lg bg-muted border border-border text-xs text-muted-foreground">
              Another scrape is in progress site-wide right now — please try again in a minute.
            </div>
          )}

          {/* ── Run info bar ─────────────────────────────────────────────── */}
          {selectedRun && (
            <div className="flex items-center gap-4 flex-wrap px-4 py-3 rounded-xl border border-border bg-background/40 text-xs">
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-bold uppercase ${runStatusBadge(selectedRun.status)}`}>
                {statusIcon(selectedRun.status)} {selectedRun.status}
              </span>
              <span className="font-mono text-muted-foreground">Run #{selectedRun.id}</span>
              <span className="text-foreground font-semibold">
                {selectedRun.category}{selectedRun.location ? ` in ${selectedRun.location}` : ""}
              </span>
              <span className="font-mono text-muted-foreground">
                started {new Date(selectedRun.startedAt).toLocaleTimeString([], { hour12: false })}
              </span>
              {selectedRun.durationMs != null && (
                <span className="font-mono text-muted-foreground">{(selectedRun.durationMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          )}

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex gap-1 px-3 pt-2 border-b border-border">
              {([
                { key: "input", label: "Input", icon: SlidersHorizontal },
                { key: "log", label: "Log", icon: Terminal },
                { key: "dataset", label: "Dataset", icon: Database },
                { key: "information", label: "Information", icon: Info },
                { key: "api", label: "API", icon: Code2 },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                    activeTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            <div className="p-5">
              {/* Input tab */}
              {activeTab === "input" && (
                <div className="space-y-5 max-w-md">
                  <div>
                    <label className="text-sm font-semibold text-foreground block mb-1">🔍 Search term</label>
                    <p className="text-xs text-muted-foreground mb-2">What kind of business to search for on {platformLabel}.</p>
                    <input value={runnerCategory} onChange={e => setRunnerCategory(e.target.value)} placeholder="plumbers"
                      onKeyDown={e => { if (e.key === "Enter") startScraperRun(); }}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 outline-none" />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-foreground block mb-1">📍 Location</label>
                    <p className="text-xs text-muted-foreground mb-2">City, region, or leave blank to search everywhere.</p>
                    <input value={runnerLocation} onChange={e => setRunnerLocation(e.target.value)} placeholder="Mobile AL"
                      onKeyDown={e => { if (e.key === "Enter") startScraperRun(); }}
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 outline-none" />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-foreground block mb-1">💯 Number of places to extract</label>
                    <p className="text-xs text-muted-foreground mb-2">Stop saving once this many results are found.</p>
                    <input type="number" min={1} max={300} value={runnerMaxPlaces}
                      onChange={e => setRunnerMaxPlaces(Math.min(300, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-32 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 outline-none" />
                  </div>

                  <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/40 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">📌 Company contacts enrichment</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Visit each business's own website to find emails, phone numbers & social links. Adds a bit of time per run.</p>
                    </div>
                    <button onClick={() => setRunnerEnrichContacts(v => !v)}
                      className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${runnerEnrichContacts ? "bg-primary" : "bg-muted"}`}
                      aria-pressed={runnerEnrichContacts} aria-label="Toggle company contacts enrichment">
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${runnerEnrichContacts ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>

                  <details className="group">
                    <summary className="text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">⚙️ Advanced</summary>
                    <div className="mt-3">
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Scroll depth</label>
                      <p className="text-xs text-muted-foreground mb-2">How many times to scroll the results list before stopping (higher = more results, slower).</p>
                      <input type="number" min={0} max={8} value={runnerMaxScrolls}
                        onChange={e => setRunnerMaxScrolls(Math.min(8, Math.max(0, Number(e.target.value) || 0)))}
                        className="w-24 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 outline-none" />
                    </div>
                  </details>

                  <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                    Free plan: 1 run/day · Pro: 5 runs/day. Hit the green <span className="text-foreground font-semibold">Start</span> button above to launch.
                  </p>
                </div>
              )}

              {/* Log tab */}
              {activeTab === "log" && (
                <div className="rounded-xl bg-black/70 border border-border p-4 font-mono text-xs text-primary/90 h-72 overflow-y-auto space-y-1">
                  {logLines.length === 0 ? (
                    <p className="text-muted-foreground">No log output yet — start a run to see it live here.</p>
                  ) : (
                    logLines.map((line, i) => <div key={i} className="whitespace-pre-wrap">{line}</div>)
                  )}
                </div>
              )}

              {/* Dataset tab */}
              {activeTab === "dataset" && (
                selectedRun ? (
                  <div>
                    <div className="flex items-center justify-end mb-3">
                      <a href={`${basePath}/api/scraper/runs/${selectedRun.id}/export`} download
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80">
                        <Download className="w-3.5 h-3.5" /> Export CSV
                      </a>
                    </div>
                    {selectedRun.status === "failed" && <p className="text-xs text-red-400 mb-3">⚠ {selectedRun.error}</p>}
                    {runDetailLoading ? (
                      <p className="text-xs text-muted-foreground">Loading…</p>
                    ) : selectedRun.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No dataset items{selectedRun.status === "running" ? " yet — still running." : "."}</p>
                    ) : (
                      <div className="overflow-x-auto -mx-1">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-muted-foreground border-b border-border">
                              <th className="px-2 py-1.5 font-semibold">Name</th>
                              <th className="px-2 py-1.5 font-semibold">Phone</th>
                              <th className="px-2 py-1.5 font-semibold">Website</th>
                              <th className="px-2 py-1.5 font-semibold">Address</th>
                              <th className="px-2 py-1.5 font-semibold">Rating</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedRun.items.map((it, i) => (
                              <tr key={i} className="border-b border-border/50">
                                <td className="px-2 py-1.5 text-foreground font-medium">{it.name ?? "—"}</td>
                                <td className="px-2 py-1.5 text-muted-foreground">{it.phone ?? "—"}</td>
                                <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[200px]">{it.website ?? "—"}</td>
                                <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[240px]">{it.address ?? "—"}</td>
                                <td className="px-2 py-1.5 text-muted-foreground">{it.rating != null ? `${it.rating}★${it.reviews != null ? ` (${it.reviews})` : ""}` : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No run selected yet — start a run or pick one from the runs list below.</p>
                )
              )}

              {/* Information tab */}
              {activeTab === "information" && (
                <div className="prose-sm max-w-xl space-y-3 text-sm text-muted-foreground">
                  <p>
                    <span className="text-foreground font-semibold">{actor.name}</span> searches {platformLabel} for a
                    business type + location and pulls back name, address, rating and review count for every result it
                    finds{actor.platform !== "yelp" ? ", plus phone and website" : ""}.
                  </p>
                  {actor.platform === "yelp" && (
                    <p>
                      Yelp's search results don't expose phone or website directly (only its own business pages do), so
                      those two fields come back empty for now — turn on Company contacts enrichment below to fill them
                      in from each business's own site instead.
                    </p>
                  )}
                  <p>
                    Turn on <span className="text-foreground font-semibold">Company contacts enrichment</span> (Input tab)
                    and it'll also visit each business's own website afterward to look for a public email address and
                    social media links.
                  </p>
                  <p>
                    Results are saved to your account automatically and de-duplicated against anything you've already
                    collected. Every run's dataset can be exported as CSV.
                  </p>
                  <p>
                    <span className="text-foreground font-semibold">Limits:</span> Free plan gets 1 run/day, Pro gets 5/day
                    — shared across every scraper, not per-scraper. Only one scrape can run across the whole site at a
                    time, so an occasional "try again shortly" message is normal at busy times.
                  </p>
                </div>
              )}

              {/* API tab */}
              {activeTab === "api" && (
                <ApiTab actor={actor} />
              )}
            </div>
          </div>

          {/* ── Runs history ─────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-display font-bold text-muted-foreground uppercase tracking-wide">Runs</h3>
              <button onClick={loadRuns} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${runsLoading ? "animate-spin" : ""}`} /> Refresh
              </button>
            </div>
            {runs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No runs yet — start one above.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="px-2 py-1.5 font-semibold">Status</th>
                      <th className="px-2 py-1.5 font-semibold">Input</th>
                      <th className="px-2 py-1.5 font-semibold">Started</th>
                      <th className="px-2 py-1.5 font-semibold">Duration</th>
                      <th className="px-2 py-1.5 font-semibold">Results</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map(run => (
                      <tr key={run.id} className="border-b border-border/50 align-middle">
                        <td className="px-2 py-2">
                          <span className={`flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase whitespace-nowrap ${runStatusBadge(run.status)}`}>
                            {statusIcon(run.status)} {run.status}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-foreground font-medium whitespace-nowrap">
                          {run.category}{run.location ? ` in ${run.location}` : ""}
                        </td>
                        <td className="px-2 py-2 font-mono text-muted-foreground whitespace-nowrap">
                          {new Date(run.startedAt).toLocaleString()}
                        </td>
                        <td className="px-2 py-2 font-mono text-muted-foreground whitespace-nowrap">
                          {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                          {run.status === "succeeded" ? `${run.saved} new · ${run.duplicates} dup · ${run.placesFound} found`
                            : run.status === "failed" ? (run.error ?? "failed") : "running…"}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => viewRun(run.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80 whitespace-nowrap">
                              View
                            </button>
                            {run.status === "succeeded" && (
                              <a href={`${basePath}/api/scraper/runs/${run.id}/export`} download
                                className="p-2 rounded-lg text-muted-foreground hover:text-primary" title="Export CSV — no need to open the run first">
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button onClick={() => deleteRun(run.id)} disabled={runDeleteBusyId === run.id}
                              className="p-2 rounded-lg text-muted-foreground hover:text-red-400 disabled:opacity-50" title="Delete run">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
