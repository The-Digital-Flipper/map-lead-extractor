import { useState, useEffect, useCallback, useRef } from "react";
import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Zap, Download, LogOut, Users, Star, TrendingUp, Calendar,
  MapPin, ChevronLeft, ChevronRight, DollarSign, CreditCard,
  UserCheck, UserX, Crown, BarChart2, RefreshCw,
  Flame, Globe, Target, Sparkles, Package, Phone, Trash2, RotateCcw,
} from "lucide-react";
import {
  ComposableMap, Geographies, Geography, ZoomableGroup, Marker,
} from "react-simple-maps";
import { Tooltip } from "react-tooltip";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string;
const US_TOPO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const FIPS_TO_STATE: Record<string, string> = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
  "10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL",
  "18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD",
  "25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE",
  "32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND",
  "39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD",
  "47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
  "55":"WI","56":"WY",
};
const STATE_NAMES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"Washington D.C.",
  FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",
  IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",
  ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",
  MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",
  NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",
  NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",
  PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",
  TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",
  WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

interface AdminStats { total: number; today: number; week: number; }
interface Revenue { mrr: number; subscriberCount: number; monthRevenue: number; totalUsers: number; }
interface GeoData { byState: Record<string, number>; topCities: { city: string; count: number }[]; }
interface Lead {
  id: number; name: string | null; phone: string | null; emails: string | null;
  website: string | null; address: string | null; category: string | null;
  social: string | null; facebook: string | null; instagram: string | null;
  twitter: string | null; linkedin: string | null;
  rating: string | null; reviewCount: number | null;
  score: number | null; opportunityScore: number | null; needs: string[] | null;
  valueScore: number | null; demandScore: number | null;
  timesExtracted: number | null; extractedBy: string[] | null;
  status: string | null; createdAt: string | null; deletedAt: string | null;
}
interface AdminUser {
  id: string; email: string | null; plan: string;
  lead_count: number; money_lead_count: number; hot_lead_count: number;
  last_active: string | null; created_at: string | null; period_end: number | null;
}
interface CategoryMoney {
  category: string; total: number; hot: number; warm: number;
  avgOpportunity: number; noWebsite: number; reachable: number;
}
interface MoneySummary {
  total: number; hot: number; warm: number; cold: number;
  noWebsite: number; reachable: number;
}
interface NeedCount { need: string; count: number }

// Each weakness maps to a service you sell — drives the "What to sell" panel.
const NEED_TO_SERVICE: Record<string, string> = {
  "No website": "Website builds",
  "No social": "Social setup",
  "Few reviews": "Review generation",
  "Low rating": "Reputation mgmt",
  "Hard to reach": "Enrichment needed",
};

// Vertical pricing tiers — high-LTV verticals resell for more per lead.
// Edit these keyword lists / prices to match what buyers actually pay you.
const PREMIUM_KEYWORDS = ["law", "attorney", "lawyer", "dentist", "dental", "orthodont", "med spa", "medspa", "cosmetic", "plastic", "surgeon", "chiropract", "roof", "hvac", "plumb", "electric", "contractor", "remodel", "real estate", "realtor", "insurance", "accountant", "cpa", "veterinar", "dermatolog", "injury", "clinic", "mortgage", "solar"];
const STANDARD_KEYWORDS = ["restaurant", "cafe", "coffee", "bakery", "salon", "spa", "barber", "gym", "fitness", "yoga", "auto", "mechanic", "repair", "landscap", "cleaning", "photograph", "dealership", "hotel", "catering", "florist", "pet", "tattoo", "daycare"];

type Tier = "premium" | "standard" | "bulk";
const TIER_META: Record<Tier, { label: string; cls: string }> = {
  premium: { label: "Premium", cls: "bg-primary/15 text-primary border-primary/40" },
  standard: { label: "Standard", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40" },
  bulk: { label: "Bulk", cls: "bg-muted text-muted-foreground border-border" },
};
const TIER_ORDER: Tier[] = ["premium", "standard", "bulk"];
const DEFAULT_PRICES: Record<Tier, number> = { premium: 5, standard: 2, bulk: 0.5 };

function categoryTier(category: string): Tier {
  const c = category.toLowerCase();
  if (PREMIUM_KEYWORDS.some(k => c.includes(k))) return "premium";
  if (STANDARD_KEYWORDS.some(k => c.includes(k))) return "standard";
  return "bulk";
}

function colorForCount(count: number, max: number): string {
  if (count === 0 || max === 0) return "#1a2332";
  const t = Math.min(1, count / max);
  const g = Math.round(41 + t * (230 - 41));
  const b = Math.round(50 + t * (118 - 50));
  const alpha = 0.25 + t * 0.75;
  return `rgba(0,${g},${b},${alpha})`;
}

function GeoHeatmap({ byState, selected, onSelect }: {
  byState: Record<string, number>;
  selected?: string;
  onSelect?: (state: string) => void;
}) {
  const [tooltipContent, setTooltipContent] = useState("");
  const maxCount = Math.max(1, ...Object.values(byState));
  return (
    <div className="relative">
      <ComposableMap projection="geoAlbersUsa" style={{ width: "100%", height: "auto" }} data-tooltip-id="state-tooltip">
        <ZoomableGroup zoom={1}>
          <Geographies geography={US_TOPO_URL}>
            {({ geographies }) => geographies.map((geo) => {
              const fips = geo.id as string;
              const abbr = FIPS_TO_STATE[fips.padStart(2, "0")] ?? "";
              const count = byState[abbr] ?? 0;
              const isSelected = !!selected && abbr === selected;
              return (
                <Geography key={geo.rsmKey} geography={geo}
                  fill={isSelected ? "#00E676" : colorForCount(count, maxCount)}
                  stroke={isSelected ? "#00E676" : "#0d1117"} strokeWidth={isSelected ? 1.6 : 0.8}
                  onClick={onSelect ? () => onSelect(abbr) : undefined}
                  onMouseEnter={() => setTooltipContent(`${STATE_NAMES[abbr] ?? abbr}: ${count.toLocaleString()} lead${count !== 1 ? "s" : ""}${onSelect ? " — click to filter" : ""}`)}
                  onMouseLeave={() => setTooltipContent("")}
                  style={{
                    default: { outline: "none", cursor: onSelect ? "pointer" : "default" },
                    hover: { outline: "none", fill: "#00E676", opacity: 0.85, cursor: onSelect ? "pointer" : "default" },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      <Tooltip id="state-tooltip" content={tooltipContent} />
      <div className="flex items-center gap-2 mt-2 justify-end">
        <span className="text-xs text-muted-foreground">Fewer</span>
        <div className="flex h-3 w-32 rounded overflow-hidden border border-border">
          {[0.05,0.2,0.4,0.6,0.8,1].map((t,i) => (
            <div key={i} className="flex-1" style={{ background: colorForCount(t * maxCount, maxCount) }} />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">More</span>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [geo, setGeo] = useState<GeoData | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPages, setUsersPages] = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [categoryMoney, setCategoryMoney] = useState<CategoryMoney[]>([]);
  const [summary, setSummary] = useState<MoneySummary | null>(null);
  const [needs, setNeeds] = useState<NeedCount[]>([]);
  const [moneyGeo, setMoneyGeo] = useState<GeoData | null>(null);
  // Clicking a state on the heatmap re-filters the whole Command Center.
  const [selectedState, setSelectedState] = useState<string>("");
  // Editable per-lead resale prices by tier, persisted to localStorage.
  const [prices, setPrices] = useState<Record<Tier, number>>(() => {
    try {
      const saved = localStorage.getItem("mle_tier_prices");
      if (saved) return { ...DEFAULT_PRICES, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return DEFAULT_PRICES;
  });
  const setPrice = (tier: Tier, value: number) => {
    setPrices(prev => {
      const next = { ...prev, [tier]: isNaN(value) ? 0 : value };
      try { localStorage.setItem("mle_tier_prices", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const [activeTab, setActiveTab] = useState<"command" | "research" | "proxies" | "overview" | "users" | "leads" | "money" | "deleted">("command");
  const [deletedLeads, setDeletedLeads] = useState<Lead[]>([]);
  const [deletedTotal, setDeletedTotal] = useState(0);
  const [deletedPage, setDeletedPage] = useState(1);
  const [deletedPages, setDeletedPages] = useState(1);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [restoringIds, setRestoringIds] = useState<Set<number>>(new Set());
  const [restoreResult, setRestoreResult] = useState<string | null>(null);

  // Sell-pack modal: owner sets a price for a category/territory pack and gets a
  // shareable Stripe checkout link to send a buyer.
  const [sellPack, setSellPack] = useState<{ category: string; state: string } | null>(null);
  const [sellPrice, setSellPrice] = useState("49");
  const [sellLoading, setSellLoading] = useState(false);
  const [sellResult, setSellResult] = useState<{ url: string; leadCount: number } | null>(null);
  const [sellError, setSellError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  // Enrichment pass — crawl lead sites to score bad/old site + booking.
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ enriched: number; remaining: number; emailsFound?: number; socialsFound?: number; phonesFound?: number } | null>(null);
  const runEnrich = async () => {
    setEnriching(true);
    try {
      const r = await fetch(`${basePath}/api/admin/enrich`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 25 }),
      });
      if (r.ok) {
        const d = await r.json();
        setEnrichResult({ enriched: d.enriched, remaining: d.remaining, emailsFound: d.emailsFound, socialsFound: d.socialsFound, phonesFound: d.phonesFound });
        fetch(`${basePath}/api/admin/opportunity-by-category${selectedState ? `?state=${selectedState}` : ""}`)
          .then(rr => rr.json()).then(dd => { setCategoryMoney(dd.categories ?? []); setSummary(dd.summary ?? null); setNeeds(dd.needs ?? []); }).catch(() => {});
      }
    } catch { /* ignore */ }
    setEnriching(false);
  };

  // Live test of the 24/7 Google Maps scraper — drives one search and saves it.
  const [scrapeCategory, setScrapeCategory] = useState("plumbers");
  const [scrapeLocation, setScrapeLocation] = useState("Mobile AL");
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<{ term: string; places: number; saved: number; duplicates: number; ms: number; enrich?: { enriched: number; emailsFound: number; socialsFound: number } | null } | null>(null);
  const [scrapeError, setScrapeError] = useState("");
  const runScrape = async () => {
    if (!scrapeCategory.trim() || scraping) return;
    setScraping(true); setScrapeError(""); setScrapeResult(null);
    try {
      const r = await fetch(`${basePath}/api/admin/scrape`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: scrapeCategory.trim(), location: scrapeLocation.trim() }),
      });
      const d = await r.json();
      if (r.ok) {
        setScrapeResult(d);
        // Refresh the headline lead counts so the new leads show up.
        fetch(`${basePath}/api/admin/stats`).then(rr => rr.json()).then(setStats).catch(() => {});
      } else {
        setScrapeError(d.error ?? "Scrape failed");
      }
    } catch {
      setScrapeError("Could not reach the server");
    }
    setScraping(false);
  };

  // ── AI Research: find where to scrape, plot on the map, scrape live ────────
  type ScrapeTarget = {
    id: number; category: string; location: string;
    lat: string | null; lng: string | null;
    priority: number; reason: string | null; estLeads: number | null;
    active: boolean; leadCount: number | null; lastScrapedAt: string | null;
  };
  const [researchGoal, setResearchGoal] = useState("Gulf Coast businesses that need a website");
  const [researchCount, setResearchCount] = useState(24);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState("");
  const [targets, setTargets] = useState<ScrapeTarget[]>([]);
  const [scrapingTargetId, setScrapingTargetId] = useState<number | null>(null);
  const [targetLiveMsg, setTargetLiveMsg] = useState("");

  const loadTargets = useCallback(async () => {
    try {
      const r = await fetch(`${basePath}/api/admin/scrape-targets`);
      const d = await r.json();
      setTargets(d.targets ?? []);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (activeTab === "research") loadTargets(); }, [activeTab, loadTargets]);

  const runResearch = async () => {
    if (!researchGoal.trim() || researching) return;
    setResearching(true); setResearchError("");
    try {
      const r = await fetch(`${basePath}/api/admin/research`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: researchGoal.trim(), count: researchCount }),
      });
      const d = await r.json();
      if (r.ok) setTargets(d.targets ?? []);
      else setResearchError(d.error ?? "Research failed");
    } catch { setResearchError("Could not reach the server"); }
    setResearching(false);
  };

  const scrapeOneTarget = async (id: number): Promise<void> => {
    setScrapingTargetId(id);
    const t = targets.find(x => x.id === id);
    if (t) setTargetLiveMsg(`Scraping ${t.category} in ${t.location}…`);
    try {
      const r = await fetch(`${basePath}/api/admin/scrape-targets/${id}/scrape`, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setTargets(prev => prev.map(x => x.id === id
          ? { ...x, leadCount: (x.leadCount ?? 0) + (d.saved ?? 0), lastScrapedAt: new Date().toISOString() }
          : x));
        setTargetLiveMsg(`✓ ${t?.location}: ${d.saved} new · ${d.duplicates} dup`);
        fetch(`${basePath}/api/admin/stats`).then(rr => rr.json()).then(setStats).catch(() => {});
      } else {
        setTargetLiveMsg(`⚠ ${d.error ?? "failed"}`);
      }
    } catch { setTargetLiveMsg("⚠ request failed"); }
    setScrapingTargetId(null);
  };

  const [scrapingAll, setScrapingAll] = useState(false);
  const stopAllRef = useRef(false);
  const scrapeAllTargets = async () => {
    if (scrapingAll) { stopAllRef.current = true; return; } // click again = stop
    stopAllRef.current = false;
    setScrapingAll(true);
    const active = targets.filter(t => t.active);
    for (const t of active) {
      if (stopAllRef.current) { setTargetLiveMsg("Stopped."); break; }
      await scrapeOneTarget(t.id);
    }
    if (!stopAllRef.current) setTargetLiveMsg("✓ Finished scraping all targets");
    setScrapingAll(false);
  };

  // ── Proxy center ───────────────────────────────────────────────────────────
  type Proxy = {
    id: number; label: string | null; protocol: string | null; host: string; port: number;
    username: string | null; hasPassword: boolean; country: string | null;
    active: boolean | null; status: string | null; latencyMs: number | null;
    successCount: number | null; failCount: number | null; lastUsedAt: string | null;
  };
  const [proxyList, setProxyList] = useState<Proxy[]>([]);
  const [proxySummary, setProxySummary] = useState<{ total: number; healthy: number; dead: number; active: number } | null>(null);
  const [proxyText, setProxyText] = useState("");
  const [proxyBusy, setProxyBusy] = useState(false);
  const [proxyMsg, setProxyMsg] = useState("");
  const [testingProxyId, setTestingProxyId] = useState<number | null>(null);

  const loadProxies = useCallback(async () => {
    try {
      const r = await fetch(`${basePath}/api/admin/proxies`);
      const d = await r.json();
      setProxyList(d.proxies ?? []);
      setProxySummary(d.summary ?? null);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (activeTab === "proxies") loadProxies(); }, [activeTab, loadProxies]);

  const addProxies = async () => {
    if (!proxyText.trim() || proxyBusy) return;
    setProxyBusy(true); setProxyMsg("");
    try {
      const r = await fetch(`${basePath}/api/admin/proxies`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: proxyText.trim() }),
      });
      const d = await r.json();
      if (r.ok) { setProxyMsg(`Added ${d.added} of ${d.parsed} proxies`); setProxyText(""); loadProxies(); }
      else setProxyMsg(`⚠ ${d.error ?? "failed"}`);
    } catch { setProxyMsg("⚠ request failed"); }
    setProxyBusy(false);
  };

  const testProxy = async (id: number) => {
    setTestingProxyId(id);
    try {
      const r = await fetch(`${basePath}/api/admin/proxies/${id}/test`, { method: "POST" });
      const d = await r.json();
      setProxyMsg(d.ok ? `✓ #${id} healthy (${d.ms}ms)` : `✗ #${id} dead: ${d.error ?? ""}`);
      loadProxies();
    } catch { setProxyMsg("⚠ test failed"); }
    setTestingProxyId(null);
  };

  const testAllProxies = async () => {
    if (proxyBusy) return;
    setProxyBusy(true); setProxyMsg("Testing all proxies…");
    try {
      const r = await fetch(`${basePath}/api/admin/proxies/test-all`, { method: "POST" });
      const d = await r.json();
      setProxyMsg(`✓ Tested ${d.tested} · ${d.healthy} healthy`);
      loadProxies();
    } catch { setProxyMsg("⚠ test failed"); }
    setProxyBusy(false);
  };

  const toggleProxy = async (id: number, active: boolean) => {
    await fetch(`${basePath}/api/admin/proxies/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }),
    }).catch(() => {});
    loadProxies();
  };

  const deleteProxy = async (id: number) => {
    await fetch(`${basePath}/api/admin/proxies/${id}`, { method: "DELETE" }).catch(() => {});
    loadProxies();
  };

  const generateSaleLink = async () => {
    if (!sellPack) return;
    setSellLoading(true); setSellError(""); setSellResult(null);
    try {
      const r = await fetch(`${basePath}/api/admin/packs/checkout`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: sellPack.category, state: sellPack.state,
          minOpportunity: 40, priceCents: Math.round((parseFloat(sellPrice) || 0) * 100),
        }),
      });
      const d = await r.json();
      if (!r.ok) setSellError(d.error ?? "Could not create link");
      else setSellResult({ url: d.url, leadCount: d.leadCount });
    } catch { setSellError("Network error"); }
    setSellLoading(false);
  };

  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    const sort = activeTab === "money" ? "&sort=value" : "";
    try {
      const r = await fetch(`${basePath}/api/admin/leads?page=${page}&limit=50${sort}`);
      const data = await r.json();
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch {}
    setLoadingLeads(false);
  }, [page, activeTab]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const r = await fetch(`${basePath}/api/admin/users?page=${usersPage}&limit=50`);
      const data = await r.json();
      setAdminUsers(data.users ?? []);
      setTotalUsers(data.total ?? 0);
      setUsersPages(data.pages ?? 1);
    } catch {}
    setLoadingUsers(false);
  }, [usersPage]);

  useEffect(() => {
    fetch(`${basePath}/api/admin/stats`).then(r => r.json()).then(setStats).catch(() => {});
    fetch(`${basePath}/api/admin/geo`).then(r => r.json()).then(setGeo).catch(() => {});
    fetch(`${basePath}/api/admin/geo?minOpportunity=40`).then(r => r.json()).then(setMoneyGeo).catch(() => {});
    setRevenueLoading(true);
    fetch(`${basePath}/api/admin/revenue`).then(r => r.json()).then(data => { setRevenue(data); setRevenueLoading(false); }).catch(() => setRevenueLoading(false));
  }, []);

  // Money intelligence — refetches whenever the selected state changes.
  useEffect(() => {
    const q = selectedState ? `?state=${selectedState}` : "";
    fetch(`${basePath}/api/admin/opportunity-by-category${q}`)
      .then(r => r.json())
      .then(d => { setCategoryMoney(d.categories ?? []); setSummary(d.summary ?? null); setNeeds(d.needs ?? []); })
      .catch(() => {});
  }, [selectedState]);

  const fetchDeletedLeads = useCallback(async () => {
    setLoadingDeleted(true);
    try {
      const r = await fetch(`${basePath}/api/admin/deleted-leads?page=${deletedPage}&limit=50`);
      const data = await r.json();
      setDeletedLeads(data.leads ?? []);
      setDeletedTotal(data.total ?? 0);
      setDeletedPages(data.pages ?? 1);
    } catch {}
    setLoadingDeleted(false);
  }, [deletedPage]);

  const restoreLead = async (id: number) => {
    setRestoringIds(prev => new Set(prev).add(id));
    setRestoreResult(null);
    try {
      const r = await fetch(`${basePath}/api/admin/restore/${id}`, { method: "POST" });
      if (r.ok) {
        setDeletedLeads(prev => prev.filter(l => l.id !== id));
        setDeletedTotal(prev => Math.max(0, prev - 1));
        setRestoreResult("Lead restored successfully.");
      }
    } catch {}
    setRestoringIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const restoreAll = async () => {
    const ids = deletedLeads.map(l => l.id);
    if (!ids.length) return;
    setLoadingDeleted(true);
    setRestoreResult(null);
    try {
      const r = await fetch(`${basePath}/api/admin/restore-bulk`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (r.ok) {
        const d = await r.json();
        setRestoreResult(`✓ ${d.restored} lead${d.restored !== 1 ? "s" : ""} restored.`);
        await fetchDeletedLeads();
      }
    } catch {}
    setLoadingDeleted(false);
  };

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { if (activeTab === "deleted") fetchDeletedLeads(); }, [fetchDeletedLeads, activeTab]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.primaryEmailAddress?.emailAddress?.toLowerCase() === ADMIN_EMAIL?.toLowerCase();
  if (!isAdmin) { setLocation("/dashboard"); return null; }

  const topStates = geo
    ? Object.entries(geo.byState).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([state, count]) => ({ state, count }))
    : [];

  const conversionRate = revenue && revenue.totalUsers > 0
    ? ((revenue.subscriberCount / revenue.totalUsers) * 100).toFixed(1)
    : "0.0";

  const fmt$ = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Command Center derived metrics (state-aware via `summary`) ──────────
  const hotLeads = summary?.hot ?? 0;
  const warmLeads = summary?.warm ?? 0;
  const coldLeads = summary?.cold ?? 0;
  const totalScored = summary?.total ?? 0;
  const moneyLeads = hotLeads + warmLeads;
  const noWebsiteLeads = summary?.noWebsite ?? 0;
  // A category with 10+ hot leads is a bundle you can sell as a pack.
  const sellablePacks = categoryMoney.filter(c => c.hot >= 10).length;
  const topNeeds = needs;
  const maxNeed = Math.max(1, ...topNeeds.map(n => n.count));
  // Selected-state suffix threaded into every export so packs respect territory.
  const stateParam = selectedState ? `&state=${selectedState}` : "";
  const moneyExport = (params: string) => `${basePath}/api/leads/export.csv?sort=opportunity${params}${stateParam}`;
  const priceFor = (category: string) => prices[categoryTier(category)] ?? 0;
  // Estimated resale value of all hot leads, priced by each category's live tier price.
  const hotPackValue = categoryMoney.reduce((sum, c) => sum + c.hot * priceFor(c.category), 0);
  // Top states by money-lead density (sell by territory).
  const moneyStates = moneyGeo
    ? Object.entries(moneyGeo.byState).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([state, count]) => ({ state, count }))
    : [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a href={basePath || "/"} className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity">
            <Zap className="w-5 h-5 text-primary" />
            <span>Map<span className="text-primary">Lead</span>Extractor</span>
            <span className="ml-2 text-xs font-mono bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full">ADMIN</span>
          </a>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground hidden md:block">{user?.primaryEmailAddress?.emailAddress}</span>
            <a href={`${basePath}/dashboard`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">My Dashboard</a>
            <button onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="pt-28 pb-32">
        <div className="container mx-auto px-6 max-w-7xl">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-8">
            <h1 className="text-3xl md:text-4xl font-display font-bold mb-1">Admin Dashboard</h1>
            <p className="text-muted-foreground">Revenue, users, and lead data across the platform.</p>
          </motion.div>

          {/* ── REVENUE SECTION ───────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.03 }} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Revenue</h2>
              {revenueLoading && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Monthly Recurring Revenue",
                  value: revenueLoading ? "…" : fmt$(revenue?.mrr ?? 0),
                  icon: <TrendingUp className="w-4 h-4 text-primary" />,
                  sub: "from active subscriptions",
                  highlight: true,
                },
                {
                  label: "Active Subscribers",
                  value: revenueLoading ? "…" : (revenue?.subscriberCount ?? 0).toString(),
                  icon: <Crown className="w-4 h-4 text-yellow-400" />,
                  sub: "paying Pro users",
                },
                {
                  label: "30-Day Revenue",
                  value: revenueLoading ? "…" : fmt$(revenue?.monthRevenue ?? 0),
                  icon: <CreditCard className="w-4 h-4 text-blue-400" />,
                  sub: "charged last 30 days",
                },
                {
                  label: "Conversion Rate",
                  value: revenueLoading ? "…" : `${conversionRate}%`,
                  icon: <BarChart2 className="w-4 h-4 text-orange-400" />,
                  sub: `${revenue?.totalUsers ?? 0} total registered`,
                },
              ].map((s, i) => (
                <div key={i} className={`rounded-xl p-5 border ${s.highlight ? "bg-primary/5 border-primary/30" : "bg-card border-border"}`}>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">{s.icon} {s.label}</div>
                  <div className={`text-3xl font-display font-bold ${s.highlight ? "text-primary" : "text-foreground"}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── LEAD STATS ────────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.06 }} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Lead Activity</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Leads", value: stats ? stats.total.toLocaleString() : "…", icon: <Star className="w-4 h-4 text-primary" />, sub: "all time" },
                { label: "Total Users", value: revenue ? (revenue.totalUsers).toLocaleString() : "…", icon: <Users className="w-4 h-4 text-blue-400" />, sub: "registered accounts" },
                { label: "Leads Today", value: stats ? stats.today.toLocaleString() : "…", icon: <TrendingUp className="w-4 h-4 text-green-400" />, sub: "last 24 hours" },
                { label: "This Week", value: stats ? stats.week.toLocaleString() : "…", icon: <Calendar className="w-4 h-4 text-orange-400" />, sub: "last 7 days" },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">{s.icon} {s.label}</div>
                  <div className="text-3xl font-display font-bold text-foreground">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── TABS ──────────────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.09 }} className="mb-6">
            <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit flex-wrap">
              {(["command", "research", "proxies", "overview", "users", "leads", "money", "deleted"] as const).map(tab => (
                <button key={tab} onClick={() => { setActiveTab(tab); if (tab === "leads" || tab === "money") setPage(1); if (tab === "deleted") setDeletedPage(1); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${activeTab === tab ? tab === "deleted" ? "bg-red-500/80 text-white" : "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {tab === "command" ? "⚡ Command" : tab === "research" ? "🎯 AI Research" : tab === "proxies" ? "🛡️ Proxies" : tab === "overview" ? "📍 Map" : tab === "users" ? "👥 Users" : tab === "leads" ? "📋 Leads" : tab === "money" ? "💰 Money Leads" : `🗑️ Deleted${deletedTotal > 0 ? ` (${deletedTotal})` : ""}`}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ── COMMAND CENTER TAB ────────────────────────────────────────── */}
          {activeTab === "command" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">

              {/* ── Lead Scraper test ─────────────────────────────────────── */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-display font-bold">Lead Scraper</h2>
                  <span className="text-xs font-mono bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full">TEST</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Run one live Google Maps search and pull the leads in. The 24/7 worker does this on a schedule across your whole query list.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">Category</label>
                    <input value={scrapeCategory} onChange={e => setScrapeCategory(e.target.value)}
                      placeholder="plumbers"
                      className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-48 focus:border-primary/50 outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">Location</label>
                    <input value={scrapeLocation} onChange={e => setScrapeLocation(e.target.value)}
                      placeholder="Mobile AL"
                      onKeyDown={e => { if (e.key === "Enter") runScrape(); }}
                      className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-48 focus:border-primary/50 outline-none" />
                  </div>
                  <button onClick={runScrape} disabled={scraping || !scrapeCategory.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${scraping ? "animate-spin" : ""}`} />
                    {scraping ? "Scraping…" : "Run test scrape"}
                  </button>
                  {scrapeResult && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-xs text-foreground">
                      ✓ <span className="font-semibold">{scrapeResult.saved} new</span> · {scrapeResult.duplicates} dup · {scrapeResult.places} found
                      {scrapeResult.enrich ? <span className="text-muted-foreground"> · enriched {scrapeResult.enrich.emailsFound} email / {scrapeResult.enrich.socialsFound} social</span> : null}
                      <span className="text-muted-foreground">({(scrapeResult.ms / 1000).toFixed(1)}s)</span>
                    </div>
                  )}
                  {scrapeError && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                      ⚠ {scrapeError}
                    </div>
                  )}
                </div>
              </div>

              {/* Money KPI strip */}
              <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6">
                <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <Zap className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-display font-bold">Money Command Center</h2>
                    <span className="text-xs font-mono bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full">LIVE</span>
                    {selectedState && (
                      <button onClick={() => setSelectedState("")}
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-xs font-bold hover:bg-primary/25 transition-colors">
                        <MapPin className="w-3 h-3" /> {STATE_NAMES[selectedState] ?? selectedState}
                        <span className="ml-1 opacity-70">✕ clear</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "🔥 Hot Leads", value: hotLeads, sub: "opportunity 70+", icon: <Flame className="w-4 h-4 text-primary" />, glow: true },
                      { label: "💰 Money Leads", value: moneyLeads, sub: "opportunity 40+", icon: <DollarSign className="w-4 h-4 text-yellow-400" /> },
                      { label: "🌐 No Website", value: noWebsiteLeads, sub: "easiest to close", icon: <Globe className="w-4 h-4 text-blue-400" /> },
                      { label: "📦 Sellable Packs", value: sellablePacks, sub: "categories w/ 10+ hot", icon: <Package className="w-4 h-4 text-orange-400" /> },
                    ].map((k, i) => (
                      <div key={i} className={`rounded-xl p-4 border ${k.glow ? "bg-primary/10 border-primary/40" : "bg-background/40 border-border"}`}>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{k.icon} {k.label}</div>
                        <div className={`text-3xl font-display font-bold ${k.glow ? "text-primary" : "text-foreground"}`}>
                          {summary ? k.value.toLocaleString() : "…"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{k.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Opportunity distribution bar */}
                  {totalScored > 0 && (
                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Opportunity spread</span>
                        <span>{totalScored.toLocaleString()} scored leads</span>
                      </div>
                      <div className="flex h-3 w-full rounded-full overflow-hidden border border-border">
                        <div className="bg-primary" style={{ width: `${(hotLeads / totalScored) * 100}%` }} title={`Hot: ${hotLeads}`} />
                        <div className="bg-yellow-500" style={{ width: `${(warmLeads / totalScored) * 100}%` }} title={`Warm: ${warmLeads}`} />
                        <div className="bg-muted-foreground/30" style={{ width: `${(coldLeads / totalScored) * 100}%` }} title={`Cold: ${coldLeads}`} />
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> Hot {hotLeads}</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" /> Warm {warmLeads}</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 inline-block" /> Cold {coldLeads}</span>
                      </div>
                    </div>
                  )}

                  {/* Quick export actions */}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <a href={moneyExport("")} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                      <Download className="w-4 h-4" /> Export All Money Leads
                    </a>
                    <a href={moneyExport("&minOpportunity=70")} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors">
                      <Flame className="w-4 h-4" /> Hot Only (70+)
                    </a>
                    <button onClick={runEnrich} disabled={enriching}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
                      title="Crawl lead websites to pull public emails + social links (and score bad/old sites + booking)">
                      <RefreshCw className={`w-4 h-4 ${enriching ? "animate-spin" : ""}`} /> {enriching ? "Finding emails…" : "Get emails + socials (25)"}
                    </button>
                    {enrichResult && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/40 border border-border text-xs text-muted-foreground">
                        ✓ {enrichResult.enriched} sites · {enrichResult.emailsFound ?? 0} email · {enrichResult.socialsFound ?? 0} social · {enrichResult.phonesFound ?? 0} phone · {enrichResult.remaining} left
                      </div>
                    )}
                    {hotPackValue > 0 && (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/40 border border-border text-sm">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="text-muted-foreground">Est. hot-pack value</span>
                        <span className="font-display font-bold text-primary">${Math.round(hotPackValue).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Category Money Leaderboard */}
                <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 p-5 border-b border-border">
                    <Target className="w-4 h-4 text-primary" />
                    <h2 className="text-lg font-display font-bold">Category Money Leaderboard</h2>
                    <span className="text-xs text-muted-foreground ml-auto">{selectedState ? `${STATE_NAMES[selectedState] ?? selectedState} · ` : ""}one-click sellable packs ↓</span>
                  </div>
                  {/* Editable tier pricing — drives Pack Value */}
                  <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border bg-background/30 flex-wrap">
                    <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1"><DollarSign className="w-3 h-3" /> Price/lead:</span>
                    {TIER_ORDER.map(t => (
                      <label key={t} className="flex items-center gap-1.5 text-xs">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-bold ${TIER_META[t].cls}`}>{TIER_META[t].label}</span>
                        <span className="text-muted-foreground">$</span>
                        <input
                          type="number" min="0" step="0.5" value={prices[t]}
                          onChange={e => setPrice(t, parseFloat(e.target.value))}
                          className="w-16 bg-background border border-border rounded-md px-2 py-1 text-foreground text-xs focus:outline-none focus:border-primary/50"
                        />
                      </label>
                    ))}
                  </div>
                  {categoryMoney.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="text-4xl mb-3">🎯</div>
                      <p className="text-sm text-muted-foreground">No category data yet — leads need a category to rank here.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-background/50">
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Category</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Tier</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">🔥 Hot</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Avg Opp</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Pack Value</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryMoney.map((c, i) => {
                            const tier = categoryTier(c.category);
                            const meta = TIER_META[tier];
                            const packValue = c.hot * prices[tier];
                            return (
                            <tr key={c.category} className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${i % 2 !== 0 ? "bg-white/[0.01]" : ""}`}>
                              <td className="px-4 py-3 font-semibold text-foreground truncate max-w-[150px]" title={c.category}>
                                {c.category}
                                <span className="block text-[10px] font-normal text-muted-foreground/60">{c.total.toLocaleString()} total · {c.noWebsite.toLocaleString()} no site</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold ${meta.cls}`} title={`$${prices[tier]}/lead`}>
                                  {meta.label}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold ${c.hot > 0 ? "bg-primary/20 text-primary border-primary/40" : "bg-muted text-muted-foreground border-border"}`}>
                                  {c.hot.toLocaleString()}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-14 rounded-full bg-background overflow-hidden border border-border">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${c.avgOpportunity}%` }} />
                                  </div>
                                  <span className="text-xs font-mono text-muted-foreground">{c.avgOpportunity}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-display font-bold text-primary whitespace-nowrap">
                                {packValue > 0 ? `$${Math.round(packValue).toLocaleString()}` : <span className="text-muted-foreground/40 font-normal">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <a href={moneyExport(`&category=${encodeURIComponent(c.category)}`)}
                                    title="Download free CSV"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-xs font-semibold hover:text-foreground hover:border-primary/40 transition-colors">
                                    <Download className="w-3.5 h-3.5" /> Pack
                                  </a>
                                  <button
                                    onClick={() => { setSellPack({ category: c.category, state: selectedState }); setSellResult(null); setSellError(""); }}
                                    title="Sell this pack"
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                                    <DollarSign className="w-3.5 h-3.5" /> Sell
                                  </button>
                                </div>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* What to sell — top needs */}
                <div className="bg-card border border-border rounded-2xl p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h2 className="text-lg font-display font-bold">What To Sell</h2>
                  </div>
                  {topNeeds.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                  ) : (
                    <div className="space-y-3">
                      {topNeeds.map(n => (
                        <div key={n.need}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-semibold text-foreground">{NEED_TO_SERVICE[n.need] ?? n.need}</span>
                            <span className="text-muted-foreground">{n.count.toLocaleString()}</span>
                          </div>
                          <div className="h-2 rounded-full bg-background overflow-hidden border border-border">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${(n.count / maxNeed) * 100}%` }} />
                          </div>
                          <div className="text-[10px] text-muted-foreground/60 mt-0.5">{n.need}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 mb-1"><Phone className="w-3 h-3" /> Reachable money leads close fastest.</div>
                    <p className="text-muted-foreground/60">Not yet scored: site quality, online booking, ad presence — needs an enrichment pass.</p>
                  </div>
                </div>
              </div>

              {/* Money Leads by Territory */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-4 h-4 text-primary" />
                    <h2 className="text-lg font-display font-bold">Money Leads by Territory</h2>
                    <span className="text-xs text-muted-foreground ml-auto">click a state to filter ·  opportunity 40+</span>
                  </div>
                  {moneyGeo ? (
                    Object.keys(moneyGeo.byState).length === 0 ? (
                      <div className="py-16 text-center">
                        <div className="text-4xl mb-3">🗺️</div>
                        <p className="text-sm text-muted-foreground">No US address data on money leads yet.</p>
                      </div>
                    ) : <GeoHeatmap byState={moneyGeo.byState} selected={selectedState}
                          onSelect={(st) => setSelectedState(prev => prev === st ? "" : st)} />
                  ) : (
                    <div className="py-16 flex items-center justify-center">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <div className="bg-card border border-border rounded-2xl p-5 flex flex-col">
                  <h2 className="text-lg font-display font-bold mb-1">Top Money States</h2>
                  <p className="text-xs text-muted-foreground mb-4">Click to filter · export a territory pack →</p>
                  {moneyStates.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                  ) : (
                    <div className="space-y-1">
                      {moneyStates.map((s, i) => (
                        <div key={s.state} className={`flex items-center justify-between gap-2 py-1 px-2 rounded-lg transition-colors ${selectedState === s.state ? "bg-primary/10 border border-primary/30" : "border border-transparent"}`}>
                          <button onClick={() => setSelectedState(prev => prev === s.state ? "" : s.state)}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity">
                            <span className={`text-xs font-mono font-bold w-7 text-center rounded ${i === 0 || selectedState === s.state ? "text-primary" : "text-muted-foreground"}`}>{s.state}</span>
                            <span className="text-sm text-foreground truncate">{STATE_NAMES[s.state] ?? s.state}</span>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-primary">{s.count.toLocaleString()}</span>
                            <a href={`${basePath}/api/leads/export.csv?sort=opportunity&minOpportunity=40&state=${s.state}`}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-primary/30 bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition-colors"
                              title={`Export money leads in ${STATE_NAMES[s.state] ?? s.state}`}>
                              <Download className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-4 pt-4 border-t border-border text-[10px] text-muted-foreground/60">
                    Combine with a category pack for "no-website plumbers in TX" precision.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── AI RESEARCH TAB: find where to scrape, plot it, scrape live ── */}
          {activeTab === "research" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">

              {/* Research input */}
              <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-display font-bold">AI Research — find where to scrape</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Describe your ideal customer. AI ranks the best categories &amp; cities to pull valuable leads from, pins them on the map, then you scrape them.
                </p>
                <div className="flex flex-col gap-3">
                  <textarea value={researchGoal} onChange={e => setResearchGoal(e.target.value)} rows={2}
                    placeholder="e.g. Gulf Coast home-service businesses that have no website"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 outline-none resize-none" />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs font-semibold text-muted-foreground">How many targets</label>
                    <input type="number" min={4} max={60} value={researchCount}
                      onChange={e => setResearchCount(parseInt(e.target.value) || 0)}
                      onBlur={e => setResearchCount(Math.max(4, Math.min(60, parseInt(e.target.value) || 24)))}
                      className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-24 focus:border-primary/50 outline-none" />
                    <button onClick={runResearch} disabled={researching || !researchGoal.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                      <Sparkles className={`w-4 h-4 ${researching ? "animate-pulse" : ""}`} />
                      {researching ? "Researching…" : "Research targets"}
                    </button>
                    {researchError && (
                      <span className="text-xs text-red-400">⚠ {researchError}</span>
                    )}
                  </div>
                </div>
              </div>

              {targets.length > 0 && (
                <>
                  {/* Map of targets */}
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <MapPin className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Scrape Map</h3>
                      <span className="text-xs text-muted-foreground">
                        {targets.length} targets · ~{targets.reduce((s, t) => s + (t.estLeads ?? 0), 0).toLocaleString()} est. leads · {targets.reduce((s, t) => s + (t.leadCount ?? 0), 0).toLocaleString()} pulled
                      </span>
                      <button onClick={scrapeAllTargets}
                        className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${scrapingAll ? "bg-red-500/80 text-white" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                        <RefreshCw className={`w-4 h-4 ${scrapingAll ? "animate-spin" : ""}`} />
                        {scrapingAll ? "Stop" : "Scrape all targets"}
                      </button>
                    </div>
                    {targetLiveMsg && (
                      <div className="mb-3 text-xs font-mono px-3 py-2 rounded-lg bg-background/60 border border-border text-foreground">{targetLiveMsg}</div>
                    )}
                    <ComposableMap projection="geoAlbersUsa" style={{ width: "100%", height: "auto" }}>
                      <ZoomableGroup zoom={1}>
                        <Geographies geography={US_TOPO_URL}>
                          {({ geographies }) => geographies.map((geo) => (
                            <Geography key={geo.rsmKey} geography={geo}
                              fill="#161b22" stroke="#0d1117" strokeWidth={0.6}
                              style={{ default: { outline: "none" }, hover: { outline: "none", fill: "#1c2330" }, pressed: { outline: "none" } }} />
                          ))}
                        </Geographies>
                        {targets.filter(t => t.lat && t.lng).map((t) => {
                          const lat = parseFloat(t.lat as string), lng = parseFloat(t.lng as string);
                          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                          const color = t.priority >= 70 ? "#00E676" : t.priority >= 40 ? "#fbbf24" : "#6b7280";
                          const active = scrapingTargetId === t.id;
                          const r = 3 + (t.priority / 100) * 5;
                          return (
                            <Marker key={t.id} coordinates={[lng, lat]}>
                              <circle r={active ? r + 4 : r} fill={color} fillOpacity={active ? 0.9 : 0.65}
                                stroke={active ? "#fff" : color} strokeWidth={active ? 1.5 : 0.5}>
                                {active && <animate attributeName="r" values={`${r};${r + 6};${r}`} dur="1s" repeatCount="indefinite" />}
                              </circle>
                              <title>{t.category} in {t.location} — opp {t.priority}{t.leadCount ? ` · ${t.leadCount} pulled` : ""}</title>
                            </Marker>
                          );
                        })}
                      </ZoomableGroup>
                    </ComposableMap>
                    <div className="flex items-center gap-4 mt-2 justify-end text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#00E676" }} /> High (70+)</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#fbbf24" }} /> Medium</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "#6b7280" }} /> Lower</span>
                    </div>
                  </div>

                  {/* Targets table */}
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-background/40 text-muted-foreground">
                        <tr className="text-left">
                          <th className="p-3 font-semibold">Opp</th>
                          <th className="p-3 font-semibold">Category</th>
                          <th className="p-3 font-semibold">Location</th>
                          <th className="p-3 font-semibold hidden md:table-cell">Why</th>
                          <th className="p-3 font-semibold text-right">Pulled</th>
                          <th className="p-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {targets.map((t) => (
                          <tr key={t.id} className={`border-t border-border ${scrapingTargetId === t.id ? "bg-primary/10" : ""}`}>
                            <td className="p-3">
                              <span className={`font-bold ${t.priority >= 70 ? "text-primary" : t.priority >= 40 ? "text-amber-400" : "text-muted-foreground"}`}>{t.priority}</span>
                            </td>
                            <td className="p-3 font-medium">{t.category}</td>
                            <td className="p-3">{t.location}</td>
                            <td className="p-3 text-muted-foreground hidden md:table-cell">{t.reason}</td>
                            <td className="p-3 text-right">{t.leadCount ? <span className="text-primary font-semibold">{t.leadCount}</span> : <span className="text-muted-foreground">—</span>}</td>
                            <td className="p-3 text-right">
                              <button onClick={() => scrapeOneTarget(t.id)} disabled={scrapingTargetId !== null || scrapingAll}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:border-primary/40 hover:text-foreground text-muted-foreground transition-colors disabled:opacity-40">
                                <RefreshCw className={`w-3 h-3 ${scrapingTargetId === t.id ? "animate-spin" : ""}`} />
                                {scrapingTargetId === t.id ? "Scraping…" : "Scrape"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ── PROXIES TAB: rotating IP pool that shields the scraper ─────── */}
          {activeTab === "proxies" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
              <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Globe className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-display font-bold">Proxy Center</h2>
                  {proxySummary && (
                    <div className="ml-auto flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">{proxySummary.total} total</span>
                      <span className="text-primary font-semibold">{proxySummary.healthy} healthy</span>
                      <span className="text-red-400 font-semibold">{proxySummary.dead} dead</span>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  The scraper rotates through these IPs (least-recently-used) so Google can't fingerprint one address. Dead proxies are benched automatically.
                </p>
                <textarea value={proxyText} onChange={e => setProxyText(e.target.value)} rows={3}
                  placeholder={"Paste proxies, one per line. Any of:\nhost:port\nhost:port:user:pass\nuser:pass@host:port\nhttp://user:pass@host:port"}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono focus:border-primary/50 outline-none resize-none" />
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <button onClick={addProxies} disabled={proxyBusy || !proxyText.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                    <Package className="w-4 h-4" /> Add proxies
                  </button>
                  <button onClick={testAllProxies} disabled={proxyBusy || proxyList.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${proxyBusy ? "animate-spin" : ""}`} /> Test all
                  </button>
                  {proxyMsg && <span className="text-xs text-muted-foreground font-mono">{proxyMsg}</span>}
                </div>
              </div>

              {proxyList.length > 0 && (
                <div className="rounded-2xl border border-border bg-card overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-background/40 text-muted-foreground">
                      <tr className="text-left">
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 font-semibold">Endpoint</th>
                        <th className="p-3 font-semibold">Auth</th>
                        <th className="p-3 font-semibold text-right">Latency</th>
                        <th className="p-3 font-semibold text-right">✓ / ✗</th>
                        <th className="p-3 font-semibold text-center">Active</th>
                        <th className="p-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proxyList.map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${
                              p.status === "healthy" ? "bg-primary/15 text-primary border-primary/30"
                              : p.status === "dead" ? "bg-red-500/15 text-red-400 border-red-500/30"
                              : "bg-muted-foreground/10 text-muted-foreground border-border"
                            }`}>{p.status ?? "untested"}</span>
                          </td>
                          <td className="p-3 font-mono text-xs">{p.protocol}://{p.host}:{p.port}</td>
                          <td className="p-3 text-xs text-muted-foreground">{p.username ? `${p.username} : ${p.hasPassword ? "••••" : "—"}` : "none"}</td>
                          <td className="p-3 text-right text-xs">{p.latencyMs != null ? `${p.latencyMs}ms` : "—"}</td>
                          <td className="p-3 text-right text-xs"><span className="text-primary">{p.successCount ?? 0}</span> / <span className="text-red-400">{p.failCount ?? 0}</span></td>
                          <td className="p-3 text-center">
                            <button onClick={() => toggleProxy(p.id, !p.active)}
                              className={`w-9 h-5 rounded-full transition-colors relative ${p.active ? "bg-primary" : "bg-muted-foreground/30"}`}>
                              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${p.active ? "left-[18px]" : "left-0.5"}`} />
                            </button>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <button onClick={() => testProxy(p.id)} disabled={testingProxyId === p.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-40 mr-1">
                              <RefreshCw className={`w-3 h-3 ${testingProxyId === p.id ? "animate-spin" : ""}`} /> Test
                            </button>
                            <button onClick={() => deleteProxy(p.id)} title="Delete"
                              className="inline-flex items-center px-2 py-1 rounded-lg border border-border text-xs text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-colors">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ── OVERVIEW TAB: Geographic heatmap ──────────────────────────── */}
          {activeTab === "overview" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h2 className="text-lg font-display font-bold">Lead Geographic Heatmap</h2>
                </div>
                {geo ? (
                  Object.keys(geo.byState).length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="text-4xl mb-3">🗺️</div>
                      <p className="text-sm text-muted-foreground">No US address data yet.</p>
                    </div>
                  ) : <GeoHeatmap byState={geo.byState} />
                ) : (
                  <div className="py-16 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 flex flex-col">
                <h2 className="text-lg font-display font-bold mb-4">Top States</h2>
                {topStates.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={topStates} layout="vertical" margin={{ left: 0, right: 24 }}>
                      <XAxis type="number" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="state" tick={{ fill: "#e6edf3", fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} width={32} />
                      <RechartsTooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, color: "#e6edf3" }} formatter={(v: number) => [v.toLocaleString(), "Leads"]} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {topStates.map((_, i) => <Cell key={i} fill={i === 0 ? "#00E676" : `rgba(0,230,118,${0.85 - i * 0.08})`} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {geo && geo.topCities.length > 0 && (
                  <div className="mt-4 border-t border-border pt-4">
                    <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Top Cities</h3>
                    <div className="space-y-2">
                      {geo.topCities.slice(0, 6).map((c, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-foreground truncate">{c.city}</span>
                          <span className="text-xs font-bold text-primary shrink-0">{c.count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── USERS TAB ─────────────────────────────────────────────────── */}
          {activeTab === "users" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between gap-4 p-5 border-b border-border">
                  <div>
                    <h2 className="text-lg font-display font-bold">All Users
                      {totalUsers > 0 && <span className="text-muted-foreground text-sm font-normal ml-2">({totalUsers.toLocaleString()})</span>}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {revenue ? `${revenue.subscriberCount} Pro · ${revenue.totalUsers - revenue.subscriberCount} Free` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> Pro
                      <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30 inline-block ml-2" /> Free
                    </div>
                  </div>
                </div>
                {loadingUsers ? (
                  <div className="py-20 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : adminUsers.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="text-4xl mb-3">👥</div>
                    <p className="font-semibold text-foreground mb-1">No users yet</p>
                    <p className="text-sm text-muted-foreground">Users appear here after they sign in for the first time.</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-background/50">
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Email</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Plan</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Leads</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">💰 Money</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">🔥 Hot</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Last Active</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminUsers.map((u, i) => {
                            const isPro = u.plan === "active";
                            return (
                              <tr key={u.id} className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${i % 2 !== 0 ? "bg-white/[0.01]" : ""}`}>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {isPro ? <UserCheck className="w-4 h-4 text-primary shrink-0" /> : <UserX className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
                                    <span className="text-foreground truncate max-w-[220px]">{u.email ?? <span className="text-muted-foreground/40">—</span>}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${isPro ? "bg-primary/15 text-primary border-primary/30" : "bg-muted border-border text-muted-foreground"}`}>
                                    {isPro ? <><Crown className="w-3 h-3" /> Pro</> : "Free"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`font-mono text-sm font-bold ${u.lead_count > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                                    {u.lead_count.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`font-mono text-sm font-bold ${u.money_lead_count > 0 ? "text-primary" : "text-muted-foreground/40"}`}>
                                    {u.money_lead_count.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`font-mono text-sm font-bold ${u.hot_lead_count > 0 ? "text-primary" : "text-muted-foreground/40"}`}>
                                    {u.hot_lead_count.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                  {u.last_active ? new Date(u.last_active).toLocaleDateString() : <span className="text-muted-foreground/30">—</span>}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {usersPages > 1 && (
                      <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                        <span className="text-sm text-muted-foreground">Page {usersPage} of {usersPages}</span>
                        <div className="flex gap-2">
                          <button onClick={() => setUsersPage(p => Math.max(1, p - 1))} disabled={usersPage <= 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            <ChevronLeft className="w-4 h-4" /> Prev
                          </button>
                          <button onClick={() => setUsersPage(p => Math.min(usersPages, p + 1))} disabled={usersPage >= usersPages}
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
          )}

          {/* ── LEADS TAB ─────────────────────────────────────────────────── */}
          {activeTab === "leads" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between gap-4 p-5 border-b border-border">
                  <h2 className="text-lg font-display font-bold">
                    All Extracted Leads {total > 0 && <span className="text-muted-foreground text-sm font-normal">({total.toLocaleString()})</span>}
                  </h2>
                  <a href={`${basePath}/api/leads/export.csv`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                    <Download className="w-4 h-4" /> Export All CSV
                  </a>
                </div>
                {loadingLeads ? (
                  <div className="py-20 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : leads.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="text-4xl mb-3">🗄️</div>
                    <p className="font-semibold text-foreground mb-1">No leads yet</p>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">Leads appear here once users start extracting.</p>
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
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Social</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Reviews</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Address</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Category</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Score</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Status</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Saved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map((lead, i) => (
                            <tr key={lead.id} className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${i % 2 !== 0 ? "bg-white/[0.01]" : ""}`}>
                              <td className="px-4 py-3 font-semibold text-foreground truncate max-w-[160px]">{lead.name ?? "—"}</td>
                              <td className="px-4 py-3 font-mono text-xs text-primary whitespace-nowrap">{lead.phone ?? <span className="text-muted-foreground/40">—</span>}</td>
                              <td className="px-4 py-3 text-xs text-primary truncate max-w-[160px]">{lead.emails ?? <span className="text-muted-foreground/40">—</span>}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {(() => {
                                  const socials = [
                                    { url: lead.facebook, label: "f", title: "Facebook" },
                                    { url: lead.instagram, label: "IG", title: "Instagram" },
                                    { url: lead.twitter, label: "X", title: "Twitter/X" },
                                    { url: lead.linkedin, label: "in", title: "LinkedIn" },
                                  ].filter(s => s.url);
                                  if (socials.length === 0) return <span className="text-muted-foreground/40">—</span>;
                                  return (
                                    <div className="flex items-center gap-1.5">
                                      {socials.map(s => (
                                        <a key={s.title} href={s.url as string} target="_blank" rel="noopener noreferrer" title={s.title}
                                          className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-primary/15 text-primary text-[10px] font-bold hover:bg-primary/30 transition-colors">
                                          {s.label}
                                        </a>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap">
                                {lead.rating ? (
                                  <span className="text-foreground">{lead.rating} <span className="text-yellow-400">★</span>{lead.reviewCount != null ? <span className="text-muted-foreground"> ({lead.reviewCount})</span> : null}</span>
                                ) : <span className="text-muted-foreground/40">—</span>}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[180px]">{lead.address ?? "—"}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{lead.category ?? "—"}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-bold ${
                                  (lead.score ?? 0) >= 80 ? "bg-primary/20 text-primary border-primary/40"
                                  : (lead.score ?? 0) >= 50 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                                  : "bg-red-500/20 text-red-400 border-red-500/40"
                                }`}>{lead.score ?? 0}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${
                                  lead.status === "converted" ? "bg-primary/15 text-primary border-primary/30"
                                  : lead.status === "contacted" ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                                  : lead.status === "not_interested" ? "bg-red-500/15 text-red-400 border-red-500/30"
                                  : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                                }`}>{lead.status ?? "new"}</span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {pages > 1 && (
                      <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                        <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
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
          )}

          {/* ── MONEY LEADS TAB ───────────────────────────────────────────── */}
          {activeTab === "money" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between gap-4 p-5 border-b border-border flex-wrap">
                  <div>
                    <h2 className="text-lg font-display font-bold">
                      💰 Money Leads {total > 0 && <span className="text-muted-foreground text-sm font-normal">({total.toLocaleString()})</span>}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                      All members' leads ranked by <span className="text-primary font-semibold">value</span> = need (opportunity) × demand (how many members extracted it). The most valuable leads to sell surface first.
                    </p>
                  </div>
                  <a href={`${basePath}/api/leads/export.csv?sort=value`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity shrink-0">
                    <Download className="w-4 h-4" /> Export Money Leads CSV
                  </a>
                </div>
                {loadingLeads ? (
                  <div className="py-20 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : leads.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="text-4xl mb-3">💸</div>
                    <p className="font-semibold text-foreground mb-1">No money leads yet</p>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">Once users extract leads, the weakest businesses (best to sell to) surface here.</p>
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
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Category</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">⭐ Value</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Demand</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Opportunity</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Needs</th>
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Saved</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leads.map((lead, i) => {
                            const opp = lead.opportunityScore ?? 0;
                            const oppColor = opp >= 70 ? "bg-primary/20 text-primary border-primary/40"
                              : opp >= 40 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                              : "bg-muted text-muted-foreground border-border";
                            const val = lead.valueScore ?? 0;
                            const valColor = val >= 60 ? "bg-primary/20 text-primary border-primary/40"
                              : val >= 35 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/40"
                              : "bg-muted text-muted-foreground border-border";
                            const members = lead.extractedBy?.length ?? 0;
                            return (
                              <tr key={lead.id} className={`border-b border-border/50 hover:bg-white/[0.02] transition-colors ${i % 2 !== 0 ? "bg-white/[0.01]" : ""}`}>
                                <td className="px-4 py-3 font-semibold text-foreground truncate max-w-[160px]">{lead.name ?? "—"}</td>
                                <td className="px-4 py-3 font-mono text-xs text-primary whitespace-nowrap">{lead.phone ?? <span className="text-muted-foreground/40">—</span>}</td>
                                <td className="px-4 py-3 text-xs text-primary truncate max-w-[150px]">{lead.emails ?? <span className="text-muted-foreground/40">—</span>}</td>
                                <td className="px-4 py-3 text-xs">
                                  {lead.website
                                    ? <span className="text-muted-foreground">has site</span>
                                    : <span className="text-primary font-semibold">none</span>}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[120px]">{lead.category ?? "—"}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${valColor}`}>⭐ {val}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap" title={`${members} member${members !== 1 ? "s" : ""} · extracted ${lead.timesExtracted ?? 0}×`}>
                                  <span className="text-xs text-foreground font-semibold">{members}</span>
                                  <span className="text-[10px] text-muted-foreground/60 ml-1">member{members !== 1 ? "s" : ""}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold ${oppColor}`}>💰 {opp}</span>
                                </td>
                                <td className="px-4 py-3">
                                  {lead.needs && lead.needs.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                      {lead.needs.map(n => (
                                        <span key={n} className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-white/[0.03] text-[10px] font-medium text-muted-foreground whitespace-nowrap">{n}</span>
                                      ))}
                                    </div>
                                  ) : <span className="text-muted-foreground/40 text-xs">—</span>}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                  {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {pages > 1 && (
                      <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                        <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
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
          )}

        </div>
      </main>

      {/* Sell-pack modal */}
      {sellPack && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSellPack(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-primary" />
              <h3 className="font-display font-bold">Sell a lead pack</h3>
              <button onClick={() => setSellPack(null)} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {sellPack.category}{sellPack.state ? ` · ${STATE_NAMES[sellPack.state] ?? sellPack.state}` : ""} · money leads (opportunity 40+)
            </p>

            {!sellResult ? (
              <>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Price (USD)</label>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-muted-foreground">$</span>
                  <input type="number" min="1" step="1" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                    className="w-28 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50" />
                </div>
                {sellError && <p className="text-xs text-red-400 mb-3">{sellError}</p>}
                <button onClick={generateSaleLink} disabled={sellLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {sellLoading ? "Creating…" : <>Generate sale link</>}
                </button>
                <p className="text-[11px] text-muted-foreground/60 mt-3">Buyer pays via Stripe, then downloads the CSV. Needs the Stripe integration connected.</p>
              </>
            ) : (
              <>
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 mb-3">
                  <p className="text-sm text-foreground font-semibold mb-1">✅ Sale link ready — {sellResult.leadCount.toLocaleString()} leads</p>
                  <p className="text-xs text-muted-foreground break-all font-mono">{sellResult.url}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(sellResult.url).then(() => { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 1500); }).catch(() => {}); }}
                    className="flex-1 px-4 py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors">
                    {copiedLink ? "Copied!" : "Copy link"}
                  </button>
                  <a href={sellResult.url} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                    Open
                  </a>
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-3">Send this link to a buyer. They pay, then get the pack.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── DELETED LEADS TAB ───────────────────────────────────────────── */}
      {activeTab === "deleted" && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-bold text-foreground">Deleted Leads</h2>
              <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-xs font-semibold">{deletedTotal.toLocaleString()} total</span>
            </div>
            <div className="flex items-center gap-2">
              {restoreResult && (
                <span className="text-xs text-primary font-semibold">{restoreResult}</span>
              )}
              {deletedLeads.length > 0 && (
                <button onClick={restoreAll} disabled={loadingDeleted}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-sm font-semibold hover:bg-primary/25 transition-colors disabled:opacity-50">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore all on page
                </button>
              )}
              <button onClick={fetchDeletedLeads} disabled={loadingDeleted}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDeleted ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {loadingDeleted && deletedLeads.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : deletedLeads.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Trash2 className="w-10 h-10 mx-auto mb-3 opacity-25" />
              <p className="text-sm">No deleted leads — the bin is empty.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Business</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Owner</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deleted</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deletedLeads.map((lead, i) => (
                    <tr key={lead.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground truncate max-w-[180px]">{lead.name ?? "—"}</div>
                        {lead.phone && <div className="text-xs text-muted-foreground mt-0.5">{lead.phone}</div>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">{lead.category ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs font-mono text-muted-foreground truncate max-w-[140px] block">{(lead as Lead & { userId?: string }).userId ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-red-400">
                          {lead.deletedAt ? new Date(lead.deletedAt).toLocaleDateString() : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => restoreLead(lead.id)} disabled={restoringIds.has(lead.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold hover:bg-primary/25 transition-colors disabled:opacity-50">
                          {restoringIds.has(lead.id)
                            ? <><RefreshCw className="w-3 h-3 animate-spin" /> Restoring…</>
                            : <><RotateCcw className="w-3 h-3" /> Restore</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {deletedPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/10">
                  <span className="text-xs text-muted-foreground">Page {deletedPage} of {deletedPages}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setDeletedPage(p => Math.max(1, p - 1))} disabled={deletedPage === 1 || loadingDeleted}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    <button onClick={() => setDeletedPage(p => Math.min(deletedPages, p + 1))} disabled={deletedPage === deletedPages || loadingDeleted}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
