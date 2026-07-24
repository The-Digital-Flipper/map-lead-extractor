import { useState, useEffect, useCallback, useRef } from "react";
import { useUser, useClerk, useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Zap, Download, LogOut, Users, Star, TrendingUp, Calendar,
  MapPin, ChevronLeft, ChevronRight, DollarSign, CreditCard,
  UserCheck, UserX, Crown, BarChart2, RefreshCw,
  Flame, Globe, Target, Sparkles, Package, Phone, Trash2, RotateCcw,
  Activity, Eye, Copy, ExternalLink, Search, Share2, MessageSquare, Send, Mail,
} from "lucide-react";
import {
  ComposableMap, Geographies, Geography, ZoomableGroup, Marker,
} from "react-simple-maps";
import { Tooltip } from "react-tooltip";
import { SOCIAL_LANDING_PAGES } from "@/data/social-landing-pages";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ComposedChart, Line, Legend } from "recharts";

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
interface PackOrderRow {
  id: number; token: string; email: string | null; rawRequest: string | null;
  label: string; category: string; city: string; state: string; status: string;
  requested: number; delivered: number; attempts: number;
  amountCents: number; refundedCents: number;
  createdAt: string; paidAt: string | null; readyAt: string | null; deadlineAt: string;
}
interface TrafficData {
  days: number;
  summary: {
    viewsToday: number; visitorsToday: number; viewsWeek: number; visitorsWeek: number;
    views: number; visitors: number; sessions: number; live: number;
  };
  daily: { day: string; views: number; visitors: number }[];
  topPages: { path: string; views: number; visitors: number }[];
  referrers: { referrer: string; views: number }[];
  devices: { device: string; visitors: number }[];
  sources: { source: string; visitors: number }[];
  newVsReturning: { new: number; returning: number };
  entryPages: { path: string; sessions: number }[];
  exitPages: { path: string; sessions: number }[];
  heatmap: { dow: number; hour: number; views: number }[];
  countries: { country: string; visitors: number }[];
  engagement: { sessions: number; bounceRate: number; pagesPerSession: number };
  channels: { channel: string; sessions: number; visitors: number }[];
  recentSessions: {
    startedAt: string; minutes: number; views: number; paths: string[];
    referrer: string | null; source: string | null; device: string | null;
    country: string | null; channel: string;
  }[];
  prev?: { views: number; visitors: number; sessions: number };
  hourly?: { hour: string; views: number; visitors: number }[];
  campaigns?: { campaign: string; source: string; views: number; visitors: number; sessions: number; lastVisit: string }[];
  browsers?: { browser: string; visitors: number }[];
  osList?: { os: string; visitors: number }[];
  landingPages?: { path: string; views: number; visitors: number }[];
  conversions?: { captured: number; orders: number; revenueCents: number };
  conversionsDaily?: { day: string; captured: number; orders: number; revenueCents: number }[];
  avgSessionMinutes?: number;
}

interface SocialPostRow {
  id: number; platform: string; campaign: string; body: string; note: string | null;
  status: string; error: string | null; externalUrl: string | null;
  postedAt: string | null; createdAt: string | null;
  hasImage: boolean;
  likes: number | null; comments: number | null; shares: number | null;
  impressions: number | null; fbClicks: number | null; statsSyncedAt: string | null;
  linkClicks?: number; linkPeople?: number;
}
interface SocialGroupRow {
  id: number; name: string; url: string; notes: string | null;
  postCount: number; lastPostedAt: string | null; createdAt: string;
}
interface SocialData {
  settings: { enabled: boolean; postHourUtc: number; autoRefill: boolean };
  facebookConnected: boolean;
  pageName: string | null;
  pageFollowers: number | null;
  pageLikes: number | null;
  appConfigured: boolean;
  redirectUri: string;
  tiktokConnected: boolean;
  tiktokAccountName: string | null;
  tiktokAppConfigured: boolean;
  tiktokRedirectUri: string;
  aiConfigured: boolean;
  queue: SocialPostRow[];
  groupQueue: SocialPostRow[];
  history: SocialPostRow[];
  groups: SocialGroupRow[];
  customImages: string[];
}

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

// 14-day send-history bar chart for the Email tab. Single series (sent/day) in
// the theme's primary hue; failed sends stack as a red cap with a 2px surface
// gap. Hover shows the exact numbers; only the busiest day is direct-labeled.
function SendHistoryChart({ perDay }: { perDay: { day: string; sent: number; failed: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 96, PAD_BOTTOM = 16, GAP = 4;
  const max = Math.max(1, ...perDay.map(d => d.sent + d.failed));
  const bw = (W - GAP * (perDay.length - 1)) / perDay.length;
  const plotH = H - PAD_BOTTOM;
  const maxIdx = perDay.reduce((best, d, i) => (d.sent + d.failed > perDay[best].sent + perDay[best].failed ? i : best), 0);
  const fmtDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" role="img" aria-label="Emails sent per day, last 14 days">
        <line x1="0" y1={plotH + 0.5} x2={W} y2={plotH + 0.5} stroke="currentColor" strokeOpacity="0.15" />
        {perDay.map((d, i) => {
          const x = i * (bw + GAP);
          const total = d.sent + d.failed;
          const sentH = Math.round((d.sent / max) * (plotH - 8));
          const failH = Math.round((d.failed / max) * (plotH - 8));
          const dim = hover !== null && hover !== i;
          return (
            <g key={d.day} opacity={dim ? 0.45 : 1}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* full-height invisible hit target, wider than the mark */}
              <rect x={x - GAP / 2} y="0" width={bw + GAP} height={H} fill="transparent" />
              {total === 0 && <rect x={x} y={plotH - 2} width={bw} height="2" rx="1" className="fill-muted-foreground/25" />}
              {d.sent > 0 && <rect x={x} y={plotH - sentH} width={bw} height={sentH} rx="2" className="fill-primary" />}
              {d.failed > 0 && <rect x={x} y={plotH - sentH - 2 - failH} width={bw} height={failH} rx="2" className="fill-red-400" />}
              {(i === maxIdx && total > 0 && hover === null) && (
                <text x={x + bw / 2} y={plotH - sentH - failH - (d.failed > 0 ? 8 : 6)} textAnchor="middle" className="fill-foreground" fontSize="10" fontWeight="700">{total}</text>
              )}
              {(i === 0 || i === perDay.length - 1 || i === Math.floor(perDay.length / 2)) && (
                <text x={x + bw / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground" fontSize="9">{fmtDay(d.day)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && perDay[hover] && (
        <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-lg border border-border bg-popover px-2.5 py-1 text-[11px] text-foreground shadow-lg whitespace-nowrap">
          <span className="font-semibold">{fmtDay(perDay[hover].day)}</span>
          <span className="text-muted-foreground"> — </span>{perDay[hover].sent} sent
          {perDay[hover].failed > 0 && <span className="text-red-400">, {perDay[hover].failed} failed</span>}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const [, setLocation] = useLocation();

  const adminFetch = useCallback(async (url: string, init?: RequestInit): Promise<Response> => {
    const token = await getToken();
    return fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [getToken]);

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
  const [activeTab, setActiveTab] = useState<"command" | "orders" | "captured" | "chats" | "email" | "scraper" | "traffic" | "social" | "research" | "proxies" | "overview" | "users" | "leads" | "money" | "deleted">("command");

  // ── Site traffic analytics (Traffic tab) ──────────────────────────────────
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [trafficDays, setTrafficDays] = useState(30);
  const [loadingTraffic, setLoadingTraffic] = useState(false);
  const loadTraffic = useCallback(async (days: number) => {
    setLoadingTraffic(true);
    try {
      const r = await adminFetch(`${basePath}/api/admin/traffic?days=${days}`);
      if (r.ok) setTraffic(await r.json());
    } catch { /* ignore */ }
    setLoadingTraffic(false);
  }, []);
  useEffect(() => {
    if (activeTab !== "traffic") return;
    loadTraffic(trafficDays);
    // Keep the tab live — the "on site now" number and recent-visitor feed
    // update themselves while you watch.
    const t = setInterval(() => loadTraffic(trafficDays), 60_000);
    return () => clearInterval(t);
  }, [activeTab, trafficDays, loadTraffic]);

  // ── Captured leads (email capture from the free-sample flow) ───────────────
  type CapturedLead = {
    id: number; email: string; label: string; location: string; rawRequest: string | null;
    sampleCount: number; createdAt: string; unlockedAt: string | null;
    followedUpAt: string | null; unsubscribedAt: string | null; purchased: boolean;
  };
  type CapturedData = {
    leads: CapturedLead[];
    stats: { totalViews: number; captures: number; followedUp: number; unsubscribed: number; purchased: number };
    followupReady: boolean;
  };
  const [captured, setCaptured] = useState<CapturedData | null>(null);
  const [loadingCaptured, setLoadingCaptured] = useState(false);
  const [followingUpId, setFollowingUpId] = useState<number | null>(null);
  const [capturedMsg, setCapturedMsg] = useState<string | null>(null);
  const loadCaptured = useCallback(async () => {
    setLoadingCaptured(true);
    try {
      const r = await adminFetch(`${basePath}/api/admin/captured-leads`);
      if (r.ok) setCaptured(await r.json());
    } catch { /* ignore */ }
    setLoadingCaptured(false);
  }, []);
  useEffect(() => { if (activeTab === "captured") loadCaptured(); }, [activeTab, loadCaptured]);
  const sendFollowup = useCallback(async (id: number) => {
    setFollowingUpId(id);
    setCapturedMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/captured-leads/${id}/follow-up`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setCapturedMsg("Follow-up sent."); await loadCaptured(); }
      else setCapturedMsg(d.error ?? "Couldn't send follow-up.");
    } catch { setCapturedMsg("Couldn't send follow-up."); }
    setFollowingUpId(null);
  }, [loadCaptured]);
  const exportCaptured = useCallback(async () => {
    try {
      const r = await adminFetch(`${basePath}/api/admin/captured-leads/export.csv`);
      if (!r.ok) { setCapturedMsg("Export failed."); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "captured-leads.csv";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { setCapturedMsg("Export failed."); }
  }, []);

  // ── Customer email blast (email your customers about buying leads) ────────
  type BlastCounts = { all: number; prospects: number; buyers: number; optedOut: number };
  type BlastJob = {
    running: boolean; total: number; sent: number; failed: number;
    lastError: string | null; finishedAt: string | null;
  };
  const [blastCounts, setBlastCounts] = useState<BlastCounts | null>(null);
  const [blastReady, setBlastReady] = useState(false);
  const [blastVia, setBlastVia] = useState<"gmail" | "resend" | "replit" | null>(null);
  const [blastGmailAddr, setBlastGmailAddr] = useState<string | null>(null);
  const [blastAudience, setBlastAudience] = useState<"all" | "prospects" | "buyers">("prospects");
  const [blastSubject, setBlastSubject] = useState("Fresh lead packs are ready — 100 leads for $29");
  const [blastBody, setBlastBody] = useState(
    "Hi,\n\nQuick heads up — we've got fresh, hand-reviewed local business leads ready to go. Every lead comes with the business name, phone, email, website and Google rating, checked by a real person before it ships.\n\n100 leads in any city + industry you want is $29, usually delivered within a few hours:\n\nhttps://mapleadextractor.net/#leads-for-sale\n\nReply to this email if you want a custom city or industry — happy to put a pack together for you.",
  );
  const [blastSkipRecent, setBlastSkipRecent] = useState(true);
  const [blastTestTo, setBlastTestTo] = useState("");
  const [blastMsg, setBlastMsg] = useState<string | null>(null);
  const [blastJob, setBlastJob] = useState<BlastJob | null>(null);
  const [blastBusy, setBlastBusy] = useState(false);
  const loadBlast = useCallback(async () => {
    try {
      const [r, st] = await Promise.all([
        adminFetch(`${basePath}/api/admin/customers`),
        adminFetch(`${basePath}/api/admin/customers/blast-status`),
      ]);
      if (r.ok) { const d = await r.json(); setBlastCounts(d.counts); setBlastReady(d.ready); setBlastVia(d.sendVia ?? null); setBlastGmailAddr(d.gmailAddress ?? null); }
      if (st.ok) setBlastJob(await st.json());
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (activeTab === "captured") loadBlast(); }, [activeTab, loadBlast]);
  // While a blast is sending, poll its progress every few seconds.
  useEffect(() => {
    if (!blastJob?.running) return;
    const t = setInterval(async () => {
      try {
        const r = await adminFetch(`${basePath}/api/admin/customers/blast-status`);
        if (r.ok) setBlastJob(await r.json());
      } catch { /* ignore */ }
    }, 2500);
    return () => clearInterval(t);
  }, [blastJob?.running]);
  const sendBlastTest = useCallback(async () => {
    setBlastBusy(true); setBlastMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/customers/blast-test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: blastTestTo, subject: blastSubject, body: blastBody }),
      });
      const d = await r.json().catch(() => ({}));
      setBlastMsg(r.ok ? `Test sent to ${blastTestTo} — check your inbox.` : (d.error ?? "Test send failed."));
    } catch { setBlastMsg("Test send failed."); }
    setBlastBusy(false);
  }, [blastTestTo, blastSubject, blastBody]);
  const startCustomerBlast = useCallback(async () => {
    const n = blastCounts ? blastCounts[blastAudience] : 0;
    if (!window.confirm(`Send "${blastSubject}" to up to ${n} ${blastAudience === "buyers" ? "past buyers" : blastAudience === "prospects" ? "prospects (haven't bought yet)" : "customers"}?`)) return;
    setBlastBusy(true); setBlastMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/customers/blast`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: blastSubject, body: blastBody, audience: blastAudience, skipRecentDays: blastSkipRecent ? 3 : 0 }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setBlastMsg(`Sending to ${d.total} people — you can leave this page, it keeps going.`); await loadBlast(); }
      else setBlastMsg(d.error ?? "Couldn't start the blast.");
    } catch { setBlastMsg("Couldn't start the blast."); }
    setBlastBusy(false);
  }, [blastCounts, blastAudience, blastSubject, blastBody, blastSkipRecent, loadBlast]);

  // ── Pack orders (Orders tab): the review-and-send queue ───────────────────
  const [packOrdersList, setPackOrdersList] = useState<PackOrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [sendingOrderId, setSendingOrderId] = useState<number | null>(null);
  const loadPackOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const r = await adminFetch(`${basePath}/api/admin/pack-orders`);
      if (r.ok) setPackOrdersList((await r.json()).orders ?? []);
    } catch { /* ignore */ }
    setOrdersLoading(false);
  }, []);
  // Load on mount too so the tab badge shows waiting orders immediately.
  useEffect(() => { loadPackOrders(); }, [loadPackOrders]);
  useEffect(() => { if (activeTab === "orders") loadPackOrders(); }, [activeTab, loadPackOrders]);

  // ── Live site chat (💬 Chats tab) ──────────────────────────────────────────
  type ChatConvRow = { id: number; page: string | null; adminJoined: boolean; updatedAt: string; lastMessage: { sender: string; body: string; createdAt: string } | null; unread: number };
  type ChatMsgRow = { id: number; sender: string; body: string; createdAt: string };
  const [chatConvs, setChatConvs] = useState<ChatConvRow[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [chatThread, setChatThread] = useState<ChatMsgRow[]>([]);
  const [chatReply, setChatReply] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatThreadEndRef = useRef<HTMLDivElement | null>(null);
  const chatUnreadTotal = chatConvs.reduce((s, c) => s + c.unread, 0);
  const loadChatConvs = useCallback(async () => {
    try {
      const r = await adminFetch(`${basePath}/api/admin/chats`);
      if (r.ok) setChatConvs(((await r.json()) as { conversations: ChatConvRow[] }).conversations);
    } catch { /* ignore */ }
  }, []);
  const loadChatThread = useCallback(async (id: number, after: number) => {
    try {
      const r = await adminFetch(`${basePath}/api/admin/chats/${id}/messages?after=${after}`);
      if (!r.ok) return;
      const d = (await r.json()) as { messages: ChatMsgRow[] };
      if (d.messages.length) setChatThread((t) => (after === 0 ? d.messages : [...t, ...d.messages.filter((m) => !t.some((x) => x.id === m.id))]));
    } catch { /* ignore */ }
  }, []);
  // Conversation list refresh (5s) + live thread refresh (3s) while the tab is open.
  useEffect(() => {
    if (activeTab !== "chats") return;
    loadChatConvs();
    const iv = setInterval(loadChatConvs, 5000);
    return () => clearInterval(iv);
  }, [activeTab, loadChatConvs]);
  useEffect(() => {
    if (activeTab !== "chats" || activeChatId === null) return;
    setChatThread([]);
    loadChatThread(activeChatId, 0);
    const iv = setInterval(() => {
      setChatThread((t) => { loadChatThread(activeChatId, t.length ? t[t.length - 1]!.id : 0); return t; });
    }, 3000);
    return () => clearInterval(iv);
  }, [activeTab, activeChatId, loadChatThread]);
  useEffect(() => { chatThreadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [chatThread]);
  const sendChatReply = async () => {
    const text = chatReply.trim();
    if (!text || activeChatId === null || chatSending) return;
    setChatSending(true);
    try {
      const r = await adminFetch(`${basePath}/api/admin/chats/${activeChatId}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }),
      });
      if (r.ok) {
        setChatReply("");
        const last = chatThread.length ? chatThread[chatThread.length - 1]!.id : 0;
        await loadChatThread(activeChatId, last);
        loadChatConvs();
      }
    } catch { /* ignore */ }
    setChatSending(false);
  };
  const releaseChat = async (id: number) => {
    try { await adminFetch(`${basePath}/api/admin/chats/${id}/release`, { method: "POST" }); } catch { /* ignore */ }
    loadChatConvs();
  };

  // ── Buyer testimonials moderation (Orders tab) ─────────────────────────────
  type TestimonialRow = { id: number; orderId: number; name: string; business: string | null; rating: number; quote: string; status: string; createdAt: string };
  const [testimonialsList, setTestimonialsList] = useState<TestimonialRow[]>([]);
  const [testimonialBusyId, setTestimonialBusyId] = useState<number | null>(null);
  const loadTestimonials = useCallback(async () => {
    try {
      const r = await adminFetch(`${basePath}/api/admin/testimonials`);
      if (r.ok) setTestimonialsList(((await r.json()) as { testimonials: TestimonialRow[] }).testimonials);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (activeTab === "orders") loadTestimonials(); }, [activeTab, loadTestimonials]);
  // "Ask past buyers for a review" — dry-run count + send action.
  const [reviewAskEligible, setReviewAskEligible] = useState<number | null>(null);
  const [reviewAskBusy, setReviewAskBusy] = useState(false);
  const [reviewAskMsg, setReviewAskMsg] = useState("");
  useEffect(() => {
    if (activeTab !== "orders") return;
    adminFetch(`${basePath}/api/admin/orders/request-reviews`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun: true }),
    }).then(async r => { if (r.ok) setReviewAskEligible((await r.json()).eligible ?? 0); }).catch(() => {});
  }, [activeTab]);
  const askBuyersForReviews = async () => {
    setReviewAskBusy(true); setReviewAskMsg("");
    try {
      const r = await adminFetch(`${basePath}/api/admin/orders/request-reviews`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const d = await r.json();
      if (r.ok) {
        setReviewAskMsg(`Sent ${d.sent} review request${d.sent === 1 ? "" : "s"}${d.failed ? ` (${d.failed} failed)` : ""} — replies land in the queue below as buyers respond.`);
        setReviewAskEligible(0);
      } else setReviewAskMsg(d.error ?? "Couldn't send review requests.");
    } catch { setReviewAskMsg("Could not reach the server."); }
    setReviewAskBusy(false);
  };
  const setTestimonialStatus = async (id: number, status: string) => {
    setTestimonialBusyId(id);
    try {
      await adminFetch(`${basePath}/api/admin/testimonials/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
    } catch { /* ignore */ }
    setTestimonialBusyId(null);
    loadTestimonials();
  };
  const deleteTestimonial = async (id: number) => {
    if (!confirm("Delete this review permanently?")) return;
    setTestimonialBusyId(id);
    try { await adminFetch(`${basePath}/api/admin/testimonials/${id}`, { method: "DELETE" }); } catch { /* ignore */ }
    setTestimonialBusyId(null);
    loadTestimonials();
  };
  const sendPackOrder = async (o: PackOrderRow) => {
    const short = o.delivered < o.requested
      ? `\n\nONLY ${o.delivered}/${o.requested} leads — sending will auto-refund the buyer $${((o.amountCents * (o.requested - o.delivered)) / o.requested / 100).toFixed(2)}.`
      : "";
    if (!confirm(`Send order #${o.id} (${o.delivered} leads) to ${o.email ?? "the buyer"}?${short}`)) return;
    setSendingOrderId(o.id);
    try {
      const r = await adminFetch(`${basePath}/api/admin/pack-orders/${o.id}/send`, { method: "POST" });
      if (!r.ok) alert((await r.json().catch(() => ({})) as { error?: string }).error ?? "Send failed");
    } catch { alert("Send failed"); }
    setSendingOrderId(null);
    loadPackOrders();
  };
  const ordersNeedingReview = packOrdersList.filter(o => o.status === "needs_review").length;

  // ── Social auto-poster (Social tab) ────────────────────────────────────────
  const [social, setSocial] = useState<SocialData | null>(null);
  const [loadingSocial, setLoadingSocial] = useState(false);
  const [generatingSocial, setGeneratingSocial] = useState(false);
  const [generatingFreeTool, setGeneratingFreeTool] = useState(false);
  const [socialBusyId, setSocialBusyId] = useState<number | null>(null);
  const [socialEditId, setSocialEditId] = useState<number | null>(null);
  const [socialDraft, setSocialDraft] = useState("");
  const [socialMsg, setSocialMsg] = useState<string | null>(null);
  const [tkKey, setTkKey] = useState("");
  const [tkSecret, setTkSecret] = useState("");
  // Landing-page link sharing: which copy button just fired ("slug", "slug-cap-0", …)
  const [lpCopied, setLpCopied] = useState<string | null>(null);
  // Each copy gets a fresh &v= so social apps re-scrape the link instead of
  // showing a cached old preview — that's what makes the ad picture show up.
  const lpUrl = (slug: string, source = "social") =>
    `${window.location.origin}${basePath}/go/${slug}?utm_source=${source}&utm_medium=social&utm_campaign=lp-${slug}&v=${Date.now().toString(36)}`;
  const lpCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setLpCopied(key);
    setTimeout(() => setLpCopied((k) => (k === key ? null : k)), 1500);
  };
  // Landing-page picture uploads. imgBust forces the <img> to refetch after a
  // change (the URL is otherwise identical and would show the cached old one).
  const [lpImgBusy, setLpImgBusy] = useState<string | null>(null);
  const [lpImgBusyText, setLpImgBusyText] = useState("Working…");
  // Shown inside the card itself — the socialMsg banner sits at the top of the
  // tab and is off-screen when you're down at the Landing Pages grid.
  const [lpImgErr, setLpImgErr] = useState<{ slug: string; msg: string } | null>(null);
  const [imgBust, setImgBust] = useState<Record<string, number>>({});
  const bustImg = (slug: string) => setImgBust((b) => ({ ...b, [slug]: (b[slug] ?? 0) + 1 }));
  // One click = a brand-new AI-made creative for this page (takes ~15-40s).
  const lpImgGenerate = async (lp: (typeof SOCIAL_LANDING_PAGES)[number]) => {
    setLpImgBusy(lp.slug); setLpImgBusyText("Creating a new picture… (~30s)"); setSocialMsg(null); setLpImgErr(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/landing-image/${lp.slug}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lp.name,
          angle: lp.angle,
          headline: `${lp.headline.pre}${lp.headline.highlight}${lp.headline.post}`,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setSocialMsg(`✓ New picture created for ${lp.slug} — click again for a different one`); bustImg(lp.slug); loadSocial(); }
      else setLpImgErr({ slug: lp.slug, msg: d.error || `Couldn't create a picture (error ${r.status}) — please try again.` });
    } catch {
      setLpImgErr({ slug: lp.slug, msg: "Couldn't create a picture — please try again." });
    }
    setLpImgBusy(null);
  };
  const lpImgUpload = async (slug: string, file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setLpImgErr({ slug, msg: "That image is over 8 MB — pick a smaller one." }); return; }
    setLpImgBusy(slug); setLpImgBusyText("Uploading…"); setSocialMsg(null); setLpImgErr(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/landing-image/${slug}`, {
        method: "POST", headers: { "Content-Type": file.type }, body: file,
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setSocialMsg(`✓ New picture set for ${slug}`); bustImg(slug); loadSocial(); }
      else setLpImgErr({ slug, msg: d.error || `Upload failed (error ${r.status}) — try a JPG or PNG.` });
    } catch {
      setLpImgErr({ slug, msg: "Upload failed — please try again." });
    }
    setLpImgBusy(null);
  };
  const lpImgRevert = async (slug: string) => {
    setLpImgBusy(slug); setLpImgBusyText("Reverting…"); setSocialMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/landing-image/${slug}`, { method: "DELETE" });
      if (r.ok) { setSocialMsg(`✓ Reverted ${slug} to the default picture`); bustImg(slug); loadSocial(); }
      else setSocialMsg("Couldn't revert — please try again.");
    } catch {
      setSocialMsg("Couldn't revert — please try again.");
    }
    setLpImgBusy(null);
  };
  const loadSocial = useCallback(async () => {
    setLoadingSocial(true);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social`);
      if (r.ok) setSocial(await r.json());
    } catch { /* ignore */ }
    setLoadingSocial(false);
  }, []);
  useEffect(() => { if (activeTab === "social") loadSocial(); }, [activeTab, loadSocial]);
  const socialGenerate = async () => {
    setGeneratingSocial(true); setSocialMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 5 }),
      });
      const d = await r.json();
      if (!r.ok) setSocialMsg(d.error || "Generation failed");
      else setSocialMsg(`✓ ${d.posts.length} new posts added to the queue`);
    } catch (e) { setSocialMsg(e instanceof Error ? e.message : "Generation failed"); }
    setGeneratingSocial(false);
    loadSocial();
  };
  const socialGenerateFreeTool = async () => {
    setGeneratingFreeTool(true); setSocialMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/generate-freetool`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 3 }),
      });
      const d = await r.json();
      if (!r.ok) setSocialMsg(d.error || "Generation failed");
      else setSocialMsg(`✓ ${d.posts.length} free-extension posts added to the queue`);
    } catch (e) { setSocialMsg(e instanceof Error ? e.message : "Generation failed"); }
    setGeneratingFreeTool(false);
    loadSocial();
  };
  const socialPostNow = async (id: number) => {
    setSocialBusyId(id); setSocialMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/${id}/post-now`, { method: "POST" });
      const d = await r.json();
      setSocialMsg(r.ok ? "✓ Posted to Facebook" : (d.error || "Post failed"));
    } catch (e) { setSocialMsg(e instanceof Error ? e.message : "Post failed"); }
    setSocialBusyId(null);
    loadSocial();
  };
  const socialTikTokNow = async (id: number) => {
    setSocialBusyId(id); setSocialMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/${id}/tiktok-now`, { method: "POST" });
      const d = await r.json();
      setSocialMsg(r.ok ? "✓ Posted to TikTok" : (d.error || "TikTok post failed"));
    } catch (e) { setSocialMsg(e instanceof Error ? e.message : "TikTok post failed"); }
    setSocialBusyId(null);
    loadSocial();
  };
  const socialDelete = async (id: number) => {
    setSocialBusyId(id);
    try { await adminFetch(`${basePath}/api/admin/social/${id}`, { method: "DELETE" }); } catch { /* ignore */ }
    setSocialBusyId(null);
    loadSocial();
  };
  const socialSaveEdit = async (id: number) => {
    setSocialBusyId(id);
    try {
      await adminFetch(`${basePath}/api/admin/social/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: socialDraft }),
      });
    } catch { /* ignore */ }
    setSocialBusyId(null); setSocialEditId(null);
    loadSocial();
  };
  const socialRequeue = async (id: number) => {
    setSocialBusyId(id);
    try {
      await adminFetch(`${basePath}/api/admin/social/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requeue: true }),
      });
    } catch { /* ignore */ }
    setSocialBusyId(null);
    loadSocial();
  };
  const socialSettingsSave = async (patch: { enabled?: boolean; postHourUtc?: number; autoRefill?: boolean; tiktokClientKey?: string; tiktokClientSecret?: string }) => {
    try {
      await adminFetch(`${basePath}/api/admin/social/settings`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
    } catch { /* ignore */ }
    loadSocial();
  };
  // ── AI posting assistant (chat box) ────────────────────────────────────────
  const [chatMsgs, setChatMsgs] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [chatMsgs, chatBusy]);
  const chatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    const next = [...chatMsgs, { role: "user" as const, content: text }];
    setChatMsgs(next); setChatInput(""); setChatBusy(true);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const d = await r.json();
      setChatMsgs([...next, { role: "assistant" as const, content: r.ok ? d.reply : (d.error || "Something went wrong — try again.") }]);
      if (r.ok && d.changed) loadSocial();
    } catch (e) {
      setChatMsgs([...next, { role: "assistant" as const, content: e instanceof Error ? e.message : "Something went wrong — try again." }]);
    }
    setChatBusy(false);
  };

  // Show the UTC posting hour in the admin's local time so it reads naturally.
  // ── Engagement stats + AI post images ──────────────────────────────────────
  const [syncingStats, setSyncingStats] = useState(false);
  const [imageBusyId, setImageBusyId] = useState<number | null>(null);
  const [imgVersion, setImgVersion] = useState(0); // cache-buster after (re)generate
  const socialSyncStats = async () => {
    setSyncingStats(true); setSocialMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/sync-stats`, { method: "POST" });
      const d = await r.json();
      setSocialMsg(r.ok ? `✓ Engagement refreshed for ${d.synced} post${d.synced === 1 ? "" : "s"}` : (d.error || "Sync failed"));
    } catch (e) { setSocialMsg(e instanceof Error ? e.message : "Sync failed"); }
    setSyncingStats(false);
    loadSocial();
  };
  const socialGenImage = async (id: number) => {
    setImageBusyId(id); setSocialMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/${id}/image`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) setSocialMsg(d.error || "Image generation failed");
      else { setSocialMsg("✓ Image ready — it'll be attached when this post publishes"); setImgVersion((v) => v + 1); }
    } catch (e) { setSocialMsg(e instanceof Error ? e.message : "Image generation failed"); }
    setImageBusyId(null);
    loadSocial();
  };
  const socialRemoveImage = async (id: number) => {
    setImageBusyId(id);
    try { await adminFetch(`${basePath}/api/admin/social/${id}/image`, { method: "DELETE" }); } catch { /* ignore */ }
    setImageBusyId(null); setImgVersion((v) => v + 1);
    loadSocial();
  };
  const statsLine = (p: SocialPostRow) => (p.statsSyncedAt === null && !(p.linkClicks ?? 0)) ? null : (
    <span className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
      <span>👍 {p.likes ?? 0}</span><span>💬 {p.comments ?? 0}</span><span>↗ {p.shares ?? 0}</span>
      {p.impressions !== null && <span>👁 {p.impressions.toLocaleString()} reached</span>}
      {p.fbClicks !== null && <span>👆 {p.fbClicks.toLocaleString()} post clicks</span>}
      <span className="text-primary font-semibold" title="People who clicked through to your site from this post's link (your own tracking)">
        🔗 {(p.linkClicks ?? 0).toLocaleString()} site visit{(p.linkClicks ?? 0) === 1 ? "" : "s"}
        {(p.linkPeople ?? 0) > 0 ? ` · ${p.linkPeople} ppl` : ""}
      </span>
    </span>
  );

  // ── Facebook Groups (assisted posting) ─────────────────────────────────────
  const [groupName, setGroupName] = useState("");
  const [groupUrl, setGroupUrl] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [generatingGroupPosts, setGeneratingGroupPosts] = useState(false);
  const [discoveringGroups, setDiscoveringGroups] = useState(false);
  const [groupBusyId, setGroupBusyId] = useState<number | null>(null);
  const groupAdd = async () => {
    if (!groupName.trim() || !groupUrl.trim()) return;
    setAddingGroup(true); setSocialMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/groups`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName, url: groupUrl }),
      });
      const d = await r.json();
      if (!r.ok) setSocialMsg(d.error || "Couldn't add that group");
      else { setSocialMsg(`✓ “${groupName.trim()}” added to the rotation`); setGroupName(""); setGroupUrl(""); }
    } catch (e) { setSocialMsg(e instanceof Error ? e.message : "Couldn't add that group"); }
    setAddingGroup(false);
    loadSocial();
  };
  const groupDiscover = async () => {
    setDiscoveringGroups(true); setSocialMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/groups/discover`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 8 }),
      });
      const d = await r.json();
      if (!r.ok) setSocialMsg(d.error || "Couldn't find groups");
      else if (d.added.length === 0) setSocialMsg(d.duplicates > 0 ? "Found groups, but you already have them all in your rotation." : "No matching public groups turned up — try again in a bit.");
      else setSocialMsg(`✓ Found ${d.added.length} new group${d.added.length === 1 ? "" : "s"} for the rotation${d.duplicates ? ` (skipped ${d.duplicates} already added)` : ""} — join each before your first post.`);
    } catch (e) { setSocialMsg(e instanceof Error ? e.message : "Couldn't find groups"); }
    setDiscoveringGroups(false);
    loadSocial();
  };
  const groupDelete = async (id: number) => {
    setGroupBusyId(id);
    try { await adminFetch(`${basePath}/api/admin/social/groups/${id}`, { method: "DELETE" }); } catch { /* ignore */ }
    setGroupBusyId(null);
    loadSocial();
  };
  const groupGenerate = async () => {
    setGeneratingGroupPosts(true); setSocialMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/groups/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 5 }),
      });
      const d = await r.json();
      if (!r.ok) setSocialMsg(d.error || "Generation failed");
      else setSocialMsg(`✓ ${d.posts.length} group posts written — link-free and mod-safe`);
    } catch (e) { setSocialMsg(e instanceof Error ? e.message : "Generation failed"); }
    setGeneratingGroupPosts(false);
    loadSocial();
  };
  // The one-click flow: copy the next queued group post, pop the group open in
  // a new tab, and log it against this group — all that's left is Ctrl+V.
  // Tag tracked links with this post's id so clicks from it count per-post in
  // the analytics (same tagging the auto-publisher does server-side).
  const tagPostLinks = (text: string, postId: number) =>
    text.replace(/https?:\/\/[^\s)"'<>]+/g, (u) =>
      /utm_source=/.test(u) && !/utm_campaign=/.test(u) ? `${u}&utm_campaign=post-${postId}` : u);
  const groupCopyOpen = async (g: SocialGroupRow) => {
    const next = social?.groupQueue[0];
    if (!next) { setSocialMsg("No group posts queued — hit “Write 5 group posts” first."); return; }
    try { await navigator.clipboard.writeText(tagPostLinks(next.body, next.id)); } catch { /* clipboard blocked — post text is still visible below */ }
    window.open(g.url, "_blank", "noopener");
    setGroupBusyId(g.id); setSocialMsg(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/social/groups/${g.id}/posted`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: next.id }),
      });
      const d = await r.json();
      setSocialMsg(r.ok ? `✓ Post copied to clipboard — paste it into “${g.name}” in the tab that just opened` : (d.error || "Couldn't log the post"));
    } catch (e) { setSocialMsg(e instanceof Error ? e.message : "Couldn't log the post"); }
    setGroupBusyId(null);
    loadSocial();
  };
  const daysSince = (iso: string | null) => iso === null ? null : Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const groupIsDue = (g: SocialGroupRow) => { const d = daysSince(g.lastPostedAt); return d === null || d >= 3; };
  const socialHourLabel = (utcHour: number) => {
    const d = new Date(); d.setUTCHours(utcHour, 0, 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
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
      const r = await adminFetch(`${basePath}/api/admin/enrich`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 25 }),
      });
      if (r.ok) {
        const d = await r.json();
        setEnrichResult({ enriched: d.enriched, remaining: d.remaining, emailsFound: d.emailsFound, socialsFound: d.socialsFound, phonesFound: d.phonesFound });
        adminFetch(`${basePath}/api/admin/opportunity-by-category${selectedState ? `?state=${selectedState}` : ""}`)
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
      const r = await adminFetch(`${basePath}/api/admin/scrape`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: scrapeCategory.trim(), location: scrapeLocation.trim() }),
      });
      const d = await r.json();
      if (r.ok) {
        setScrapeResult(d);
        // Refresh the headline lead counts so the new leads show up.
        adminFetch(`${basePath}/api/admin/stats`).then(rr => rr.json()).then(setStats).catch(() => {});
      } else {
        setScrapeError(d.error ?? "Scrape failed");
      }
    } catch {
      setScrapeError("Could not reach the server");
    }
    setScraping(false);
  };

  // ── Scraper tab: Apify-style run console (input → run → dataset → history) ─
  interface ScrapeRunRow {
    id: number; category: string; location: string | null; status: string;
    placesFound: number | null; saved: number | null; duplicates: number | null;
    error: string | null; durationMs: number | null; startedAt: string; finishedAt: string | null;
  }
  interface ScrapeRunItem {
    name: string | null; phone: string | null; website: string | null;
    address: string | null; rating: number | null; reviews: number | null;
  }
  const [runnerCategory, setRunnerCategory] = useState("plumbers");
  const [runnerLocation, setRunnerLocation] = useState("Mobile AL");
  const [runnerMaxScrolls, setRunnerMaxScrolls] = useState(3);
  const [runStarting, setRunStarting] = useState(false);
  const [runError, setRunError] = useState("");
  const [runs, setRuns] = useState<ScrapeRunRow[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<(ScrapeRunRow & { items: ScrapeRunItem[] }) | null>(null);
  const [runDetailLoading, setRunDetailLoading] = useState(false);
  const [runDeleteBusyId, setRunDeleteBusyId] = useState<number | null>(null);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const r = await adminFetch(`${basePath}/api/admin/scraper/runs`);
      const d = await r.json();
      if (r.ok) setRuns(d.runs);
    } catch { /* keep whatever was already loaded */ }
    setRunsLoading(false);
  }, []);
  useEffect(() => { if (activeTab === "scraper") loadRuns(); }, [activeTab, loadRuns]);

  const startScraperRun = async () => {
    if (!runnerCategory.trim() || runStarting) return;
    setRunStarting(true); setRunError("");
    try {
      const r = await adminFetch(`${basePath}/api/admin/scraper/runs`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: runnerCategory.trim(), location: runnerLocation.trim(), maxScrolls: runnerMaxScrolls }),
      });
      const d = await r.json();
      if (!r.ok) setRunError(d.error ?? "Run failed to start");
      else {
        adminFetch(`${basePath}/api/admin/stats`).then(rr => rr.json()).then(setStats).catch(() => {});
        if (d.run) viewRun(d.run.id);
      }
    } catch {
      setRunError("Could not reach the server");
    }
    setRunStarting(false);
    loadRuns();
  };

  const viewRun = async (id: number) => {
    setRunDetailLoading(true);
    try {
      const r = await adminFetch(`${basePath}/api/admin/scraper/runs/${id}`);
      const d = await r.json();
      if (r.ok) setSelectedRun(d.run);
    } catch { /* ignore */ }
    setRunDetailLoading(false);
  };

  const deleteRun = async (id: number) => {
    setRunDeleteBusyId(id);
    try { await adminFetch(`${basePath}/api/admin/scraper/runs/${id}`, { method: "DELETE" }); } catch { /* ignore */ }
    if (selectedRun?.id === id) setSelectedRun(null);
    setRunDeleteBusyId(null);
    loadRuns();
  };

  const runStatusBadge = (status: string) =>
    status === "running" ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
    : status === "succeeded" ? "bg-primary/15 text-primary border-primary/40"
    : "bg-red-500/15 text-red-400 border-red-500/40";

  // ── Auto-scrape: the background scheduler that keeps inventory filled ──────
  interface AutoScrapeQueueRow { id: number; category: string; location: string; priority: number | null; lastScrapedAt: string | null; inventory: number }
  interface AutoScrapeStatus {
    enabled: boolean; tickInFlight: boolean; inFlight: boolean;
    lastResult: { at: string; ran: boolean; detail: string } | null;
    config: { intervalMs: number; targetGoal: number; cooldownHours: number; coreLocations: string[] };
    queue: AutoScrapeQueueRow[];
  }
  const [autoScrape, setAutoScrape] = useState<AutoScrapeStatus | null>(null);
  const [autoScrapeBusy, setAutoScrapeBusy] = useState<"" | "toggle" | "seed" | "tick">("");
  const [autoScrapeMsg, setAutoScrapeMsg] = useState("");

  const loadAutoScrape = useCallback(async () => {
    try {
      const r = await adminFetch(`${basePath}/api/admin/auto-scrape`);
      const d = await r.json();
      if (r.ok) setAutoScrape(d);
    } catch { /* keep whatever was already loaded */ }
  }, []);
  useEffect(() => { if (activeTab === "scraper") loadAutoScrape(); }, [activeTab, loadAutoScrape]);

  const toggleAutoScrape = async () => {
    if (!autoScrape || autoScrapeBusy) return;
    setAutoScrapeBusy("toggle"); setAutoScrapeMsg("");
    try {
      const r = await adminFetch(`${basePath}/api/admin/auto-scrape`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !autoScrape.enabled }),
      });
      if (!r.ok) setAutoScrapeMsg((await r.json()).error ?? "Toggle failed");
    } catch { setAutoScrapeMsg("Could not reach the server"); }
    setAutoScrapeBusy("");
    loadAutoScrape();
  };

  const seedAutoScrape = async () => {
    if (autoScrapeBusy) return;
    setAutoScrapeBusy("seed"); setAutoScrapeMsg("");
    try {
      const r = await adminFetch(`${basePath}/api/admin/auto-scrape/seed`, { method: "POST" });
      const d = await r.json();
      setAutoScrapeMsg(r.ok ? `Seeded ${d.added} new target${d.added === 1 ? "" : "s"}` : (d.error ?? "Seed failed"));
    } catch { setAutoScrapeMsg("Could not reach the server"); }
    setAutoScrapeBusy("");
    loadAutoScrape();
  };

  // One full scheduler pass right now — runs a real scrape, so it can take a
  // minute or two; the button spins until the tick reports back.
  const tickAutoScrape = async () => {
    if (autoScrapeBusy) return;
    setAutoScrapeBusy("tick"); setAutoScrapeMsg("");
    try {
      const r = await adminFetch(`${basePath}/api/admin/auto-scrape/tick`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) setAutoScrapeMsg(d.error ?? "Tick failed");
      else if (d.ran) setAutoScrapeMsg(`Scraped ${d.target.category} in ${d.target.location} — ${d.run.saved ?? 0} new leads`);
      else setAutoScrapeMsg(`Nothing to do: ${d.reason}`);
    } catch { setAutoScrapeMsg("Could not reach the server"); }
    setAutoScrapeBusy("");
    loadAutoScrape();
    loadRuns();
  };

  // ── Email tab: the AI outreach engine selling packs to scraped companies ───
  interface OutreachSettingsRow {
    enabled: boolean; autopilot: boolean; provider: string; fromName: string; fromEmail: string | null;
    replyTo: string | null; signature: string | null; businessAddress: string | null;
    offer: string | null; dailyCap: number; windowStartHour: number; windowEndHour: number;
    tzOffsetMinutes: number; sendOnWeekends: boolean; minGapMinutes: number; maxGapMinutes: number;
    autoReply: boolean; autoEnrollOnContact: boolean;
  }
  interface OutreachInfo {
    settings: OutreachSettingsRow; resendConfigured: boolean; gmailConfigured: boolean; gmailAddress: string | null;
    enrolled: number; pending: number; replied: number; sentToday: number;
  }
  interface OutreachStats {
    perDay: { day: string; sent: number; failed: number }[];
    totals: {
      sentAllTime: number; failedAllTime: number; sent7d: number; leadsEmailed: number;
      replied: number; unsubscribed: number; bounced: number; inbound: number; aiSent: number; replyRate: number;
    };
    providers: { gmailSmtp: boolean; gmailConnector: boolean; gmailAddress: string | null; resend: boolean; replitMail: boolean; imapWatcher: boolean };
  }
  interface OutreachQueueRow { id: number; name: string; toEmail: string | null; nextStep: number; nextEmailAt: string | null; subject: string | null }
  interface OutreachDraft {
    angle?: string;
    email: { subject: string; body: string };
    followUps: { day: number; channel: string; subject?: string; body: string }[];
  }
  interface OutreachThreadItem {
    id: string; kind: "email" | "reply"; direction: "in" | "out"; step: number | null;
    subject: string | null; body: string; status: string; error: string | null; aiGenerated: boolean; createdAt: string;
  }
  interface SuppressedRow { id: number; name: string; email: string | null; reason: string; at: string }
  interface OutreachActivityRow { id: number; leadId: number; step: number; toEmail: string; subject: string; status: string; error: string | null; createdAt: string; leadName: string | null }
  interface OutreachReplyRow { id: number; leadId: number; direction: string; fromEmail: string | null; subject: string | null; body: string | null; aiGenerated: boolean; createdAt: string; leadName: string | null }
  interface EmailLeadRow {
    id: number; name: string; category: string | null; address: string | null; emails: string | null;
    autoOutreach: boolean; outreachStep: number | null; unsubscribedAt: string | null; emailHealth: string | null;
    repliedAt: string | null; nextEmailAt: string | null;
  }
  const [emailInfo, setEmailInfo] = useState<OutreachInfo | null>(null);
  const [emailDraft, setEmailDraft] = useState<{
    fromName: string; fromEmail: string; replyTo: string; signature: string; businessAddress: string;
    offer: string; dailyCap: number; windowStartHour: number; windowEndHour: number;
    tzOffsetMinutes: number; sendOnWeekends: boolean; minGapMinutes: number; maxGapMinutes: number; provider: string;
  } | null>(null);
  const [emailMsg, setEmailMsg] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [emailBusy, setEmailBusy] = useState<"" | "toggle" | "save" | "enroll" | "pause">("");
  const [emailActivity, setEmailActivity] = useState<OutreachActivityRow[]>([]);
  const [emailReplies, setEmailReplies] = useState<OutreachReplyRow[]>([]);
  const [emailCandidates, setEmailCandidates] = useState<EmailLeadRow[]>([]);
  const [emailCandidatesLoading, setEmailCandidatesLoading] = useState(false);
  const [emailCategoryFilter, setEmailCategoryFilter] = useState("");
  const [emailSelected, setEmailSelected] = useState<Set<number>>(new Set());
  const [emailStats, setEmailStats] = useState<OutreachStats | null>(null);
  const [emailQueue, setEmailQueue] = useState<OutreachQueueRow[]>([]);
  const [emailActivityFilter, setEmailActivityFilter] = useState<"all" | "sent" | "failed">("all");
  const [emailSearch, setEmailSearch] = useState("");
  const [emailHideEnrolled, setEmailHideEnrolled] = useState(false);
  const [emailShowAdvanced, setEmailShowAdvanced] = useState(false);
  const [emailSuppressed, setEmailSuppressed] = useState<SuppressedRow[] | null>(null);
  const [emailShowSuppressed, setEmailShowSuppressed] = useState(false);
  // Draft preview/editor modal
  const [draftLead, setDraftLead] = useState<{ id: number; name: string } | null>(null);
  const [draftData, setDraftData] = useState<{ lead: { id: number; name: string; email: string | null; step: number; enrolled: boolean; nextEmailAt: string | null }; draft: OutreachDraft } | null>(null);
  const [draftBusy, setDraftBusy] = useState<"" | "load" | "save" | "regen" | "test">("");
  const [draftMsg, setDraftMsg] = useState("");
  const [draftErr, setDraftErr] = useState("");
  // Conversation thread modal
  const [threadLead, setThreadLead] = useState<{ id: number; name: string } | null>(null);
  const [threadData, setThreadData] = useState<{ lead: { id: number; name: string; email: string | null; repliedAt: string | null; unsubscribedAt: string | null; enrolled: boolean }; thread: OutreachThreadItem[] } | null>(null);
  const [threadReply, setThreadReply] = useState("");
  const [threadBusy, setThreadBusy] = useState<"" | "load" | "send">("");
  const [threadMsg, setThreadMsg] = useState("");
  const [threadErr, setThreadErr] = useState("");

  const loadEmailTab = useCallback(async () => {
    try {
      const [sR, aR, rR, stR, qR] = await Promise.all([
        adminFetch(`${basePath}/api/outreach/settings`),
        adminFetch(`${basePath}/api/outreach/activity?limit=100`),
        adminFetch(`${basePath}/api/outreach/replies?limit=50`),
        adminFetch(`${basePath}/api/outreach/stats`),
        adminFetch(`${basePath}/api/outreach/queue`),
      ]);
      if (sR.ok) {
        const d: OutreachInfo = await sR.json();
        setEmailInfo(d);
        setEmailDraft(prev => prev ?? {
          fromName: d.settings.fromName ?? "", fromEmail: d.settings.fromEmail ?? "",
          replyTo: d.settings.replyTo ?? "", signature: d.settings.signature ?? "", businessAddress: d.settings.businessAddress ?? "",
          offer: d.settings.offer ?? "", dailyCap: d.settings.dailyCap,
          windowStartHour: d.settings.windowStartHour, windowEndHour: d.settings.windowEndHour,
          tzOffsetMinutes: d.settings.tzOffsetMinutes, sendOnWeekends: d.settings.sendOnWeekends,
          minGapMinutes: d.settings.minGapMinutes, maxGapMinutes: d.settings.maxGapMinutes, provider: d.settings.provider,
        });
      }
      if (aR.ok) setEmailActivity((await aR.json()).activity ?? []);
      if (rR.ok) setEmailReplies((await rR.json()).replies ?? []);
      if (stR.ok) setEmailStats(await stR.json());
      if (qR.ok) setEmailQueue((await qR.json()).queue ?? []);
    } catch { /* keep whatever was already loaded */ }
  }, []);

  const loadEmailSuppressed = useCallback(async () => {
    try {
      const r = await adminFetch(`${basePath}/api/outreach/suppressed`);
      if (r.ok) setEmailSuppressed((await r.json()).suppressed ?? []);
    } catch { /* leave as-is */ }
  }, []);

  // Draft preview modal: load (generating if missing), save edits, regenerate, test-send.
  const openEmailDraft = useCallback(async (id: number, name: string, regen = false) => {
    setDraftLead({ id, name }); setDraftErr(""); setDraftMsg(""); setDraftBusy("load");
    if (regen) setDraftData(null);
    try {
      const r = await adminFetch(`${basePath}/api/outreach/draft/${id}${regen ? "?regen=1" : ""}`);
      const d = await r.json();
      if (r.ok) setDraftData(d);
      else setDraftErr(d.error ?? "Couldn't load the draft");
    } catch { setDraftErr("Could not reach the server"); }
    setDraftBusy("");
  }, []);

  const saveEmailDraft = async () => {
    if (!draftData || !draftLead) return;
    setDraftBusy("save"); setDraftErr(""); setDraftMsg("");
    try {
      const r = await adminFetch(`${basePath}/api/outreach/draft/${draftLead.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: draftData.draft.email, followUps: draftData.draft.followUps }),
      });
      const d = await r.json();
      if (r.ok) setDraftMsg("Draft saved — this exact copy is what sends");
      else setDraftErr(d.error ?? "Save failed");
    } catch { setDraftErr("Could not reach the server"); }
    setDraftBusy("");
  };

  const testSendEmailDraft = async () => {
    if (!draftLead) return;
    setDraftBusy("test"); setDraftErr(""); setDraftMsg("");
    try {
      const r = await adminFetch(`${basePath}/api/outreach/test-send/${draftLead.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json();
      if (r.ok) setDraftMsg(`Test sent to ${d.to} — check your inbox`);
      else setDraftErr(d.error ?? "Test send failed");
    } catch { setDraftErr("Could not reach the server"); }
    setDraftBusy("");
  };

  // Conversation modal: full history with one lead + manual reply.
  const openEmailThread = useCallback(async (id: number, name: string) => {
    setThreadLead({ id, name }); setThreadErr(""); setThreadMsg(""); setThreadReply(""); setThreadBusy("load");
    try {
      const r = await adminFetch(`${basePath}/api/outreach/thread/${id}`);
      const d = await r.json();
      if (r.ok) setThreadData(d);
      else setThreadErr(d.error ?? "Couldn't load the conversation");
    } catch { setThreadErr("Could not reach the server"); }
    setThreadBusy("");
  }, []);

  const sendEmailThreadReply = async () => {
    if (!threadLead || !threadReply.trim()) return;
    setThreadBusy("send"); setThreadErr(""); setThreadMsg("");
    try {
      const r = await adminFetch(`${basePath}/api/outreach/manual-reply/${threadLead.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: threadReply }),
      });
      const d = await r.json();
      if (r.ok) {
        setThreadMsg(`Sent to ${d.to}`); setThreadReply("");
        openEmailThread(threadLead.id, threadLead.name);
      } else setThreadErr(d.error ?? "Send failed");
    } catch { setThreadErr("Could not reach the server"); }
    setThreadBusy("");
  };

  // Candidate companies to pitch: top-value leads matching the category filter;
  // rows without an email address or opted out are filtered client-side.
  const loadEmailCandidates = useCallback(async (category: string) => {
    setEmailCandidatesLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200", sort: "value" });
      if (category.trim()) params.set("category", category.trim());
      const r = await adminFetch(`${basePath}/api/leads?${params}`);
      const d = await r.json();
      if (r.ok) {
        setEmailCandidates((d.leads as EmailLeadRow[]).filter(l => (l.emails ?? "").includes("@") && !l.unsubscribedAt && !l.emailHealth));
        setEmailSelected(new Set());
      }
    } catch { /* keep whatever was already loaded */ }
    setEmailCandidatesLoading(false);
  }, []);
  useEffect(() => { if (activeTab === "email") { loadEmailTab(); loadEmailCandidates(""); } }, [activeTab, loadEmailTab, loadEmailCandidates]);

  const patchEmailSettings = async (patch: Record<string, unknown>, busy: "toggle" | "save") => {
    setEmailBusy(busy); setEmailMsg(""); setEmailErr("");
    try {
      const r = await adminFetch(`${basePath}/api/outreach/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const d = await r.json();
      if (!r.ok) setEmailErr(d.error ?? "Save failed");
      else if (busy === "save") setEmailMsg("Settings saved");
      else if ("enabled" in patch) setEmailMsg(patch.enabled ? "Engine ON — AI emails will send automatically" : "Engine paused");
      else setEmailMsg(patch.autopilot ? "Autopilot ON — new companies get pitched automatically" : "Autopilot off — pick companies manually below");
    } catch { setEmailErr("Could not reach the server"); }
    setEmailBusy("");
    loadEmailTab();
  };

  const enrollEmailSelected = async (action: "enroll" | "pause") => {
    const ids = [...emailSelected];
    if (ids.length === 0 || emailBusy) return;
    setEmailBusy(action); setEmailMsg(""); setEmailErr("");
    try {
      const r = await adminFetch(`${basePath}/api/outreach/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
      });
      const d = await r.json();
      if (!r.ok) setEmailErr(d.error ?? `${action} failed`);
      else if (action === "enroll") setEmailMsg(`Enrolled ${d.enrolled} compan${d.enrolled === 1 ? "y" : "ies"}${d.skipped ? ` (${d.skipped} skipped — no usable email)` : ""} — AI writes and sends each pitch automatically`);
      else setEmailMsg(`Paused ${d.paused} compan${d.paused === 1 ? "y" : "ies"}`);
    } catch { setEmailErr("Could not reach the server"); }
    setEmailBusy("");
    loadEmailTab();
    loadEmailCandidates(emailCategoryFilter);
  };

  const emailProviderReady = !!emailInfo && (emailInfo.settings.provider === "resend" ? emailInfo.resendConfigured : emailInfo.gmailConfigured);

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
      const r = await adminFetch(`${basePath}/api/admin/scrape-targets`);
      const d = await r.json();
      setTargets(d.targets ?? []);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (activeTab === "research") loadTargets(); }, [activeTab, loadTargets]);

  const runResearch = async () => {
    if (!researchGoal.trim() || researching) return;
    setResearching(true); setResearchError("");
    try {
      const r = await adminFetch(`${basePath}/api/admin/research`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: researchGoal.trim(), count: researchCount }),
      });
      const d = await r.json();
      if (r.ok) setTargets(d.targets ?? []);
      else setResearchError(d.error ?? "Research failed");
    } catch { setResearchError("Could not reach the server"); }
    setResearching(false);
  };

  // AI lead intelligence: batch rationale + high-ticket leads with bios.
  type HighTicketLead = { id: number; name: string | null; category: string | null; phone: string | null; emails: string | null; website: string | null; bio: string };
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{ rationale: string; analyzed: number; highTicket: HighTicketLead[] } | null>(null);
  const [analyzeError, setAnalyzeError] = useState("");
  const runAnalyze = async () => {
    if (analyzing) return;
    setAnalyzing(true); setAnalyzeError("");
    try {
      const r = await adminFetch(`${basePath}/api/admin/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 30 }),
      });
      const d = await r.json();
      if (r.ok) setAnalysis(d);
      else setAnalyzeError(d.error ?? "Analyze failed");
    } catch { setAnalyzeError("Could not reach the server"); }
    setAnalyzing(false);
  };

  // Live web-search discovery: find net-new businesses on the open web.
  type DiscoveredBiz = { name: string; city: string | null; state: string | null; website: string | null; phone: string | null; category: string | null; why: string };
  const [discoverGoal, setDiscoverGoal] = useState("used car dealers on the Mississippi gulf coast with no website");
  const [discovering, setDiscovering] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<{ found: number; saved: number; duplicates: number; businesses: DiscoveredBiz[] } | null>(null);
  const [discoverError, setDiscoverError] = useState("");
  const runDiscover = async () => {
    if (!discoverGoal.trim() || discovering) return;
    setDiscovering(true); setDiscoverError(""); setDiscoverResult(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/discover`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goal: discoverGoal.trim() }),
      });
      const d = await r.json();
      if (r.ok) { setDiscoverResult(d); adminFetch(`${basePath}/api/admin/stats`).then(rr => rr.json()).then(setStats).catch(() => {}); }
      else setDiscoverError(d.error ?? "Discovery failed");
    } catch { setDiscoverError("Could not reach the server"); }
    setDiscovering(false);
  };

  // Deep sell-angle recon (ad activity, buying signals, competitor gaps).
  type ReconSource = { title: string; url: string };
  type ReconLead = { id: number; name: string | null; category: string | null; website: string | null; facebook: string | null; intel: string; summary?: string; angle?: string; opener?: string; sources?: ReconSource[]; verified?: boolean };
  const [reconning, setReconning] = useState(false);
  const [reconResult, setReconResult] = useState<{ scanned: number; results: ReconLead[] } | null>(null);
  const [reconError, setReconError] = useState("");
  const runRecon = async () => {
    if (reconning) return;
    setReconning(true); setReconError("");
    try {
      const r = await adminFetch(`${basePath}/api/admin/recon`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 5 }),
      });
      const d = await r.json();
      if (r.ok) setReconResult(d);
      else setReconError(d.error ?? "Recon failed");
    } catch { setReconError("Could not reach the server"); }
    setReconning(false);
  };

  // Social page scan — per-platform followers/recency/missing-platform ammo.
  type SocialScanPlatform = { platform: string; url?: string; followers?: string; lastActive?: string; note?: string };
  type SocialScanReport = { platforms: SocialScanPlatform[]; missing: string[]; grade: string; pitch: string; opener: string; sources?: ReconSource[] };
  type SocialScanLead = { id: number; name: string | null; category: string | null; report: SocialScanReport; summary: string };
  const [socialScanning, setSocialScanning] = useState(false);
  const [socialScanResult, setSocialScanResult] = useState<{ scanned: number; results: SocialScanLead[] } | null>(null);
  const [socialScanError, setSocialScanError] = useState("");
  const runSocialScan = async () => {
    if (socialScanning) return;
    setSocialScanning(true); setSocialScanError("");
    try {
      const r = await adminFetch(`${basePath}/api/admin/social-scan`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 5 }),
      });
      const d = await r.json();
      if (r.ok) setSocialScanResult(d);
      else setSocialScanError(d.error ?? "Social scan failed");
    } catch { setSocialScanError("Could not reach the server"); }
    setSocialScanning(false);
  };

  const scrapeOneTarget = async (id: number): Promise<void> => {
    setScrapingTargetId(id);
    const t = targets.find(x => x.id === id);
    if (t) setTargetLiveMsg(`Scraping ${t.category} in ${t.location}…`);
    try {
      const r = await adminFetch(`${basePath}/api/admin/scrape-targets/${id}/scrape`, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        setTargets(prev => prev.map(x => x.id === id
          ? { ...x, leadCount: (x.leadCount ?? 0) + (d.saved ?? 0), lastScrapedAt: new Date().toISOString() }
          : x));
        setTargetLiveMsg(`✓ ${t?.location}: ${d.saved} new · ${d.duplicates} dup`);
        adminFetch(`${basePath}/api/admin/stats`).then(rr => rr.json()).then(setStats).catch(() => {});
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
      const r = await adminFetch(`${basePath}/api/admin/proxies`);
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
      const r = await adminFetch(`${basePath}/api/admin/proxies`, {
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
      const r = await adminFetch(`${basePath}/api/admin/proxies/${id}/test`, { method: "POST" });
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
      const r = await adminFetch(`${basePath}/api/admin/proxies/test-all`, { method: "POST" });
      const d = await r.json();
      setProxyMsg(`✓ Tested ${d.tested} · ${d.healthy} healthy`);
      loadProxies();
    } catch { setProxyMsg("⚠ test failed"); }
    setProxyBusy(false);
  };

  const toggleProxy = async (id: number, active: boolean) => {
    await adminFetch(`${basePath}/api/admin/proxies/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }),
    }).catch(() => {});
    loadProxies();
  };

  const deleteProxy = async (id: number) => {
    await adminFetch(`${basePath}/api/admin/proxies/${id}`, { method: "DELETE" }).catch(() => {});
    loadProxies();
  };

  const generateSaleLink = async () => {
    if (!sellPack) return;
    setSellLoading(true); setSellError(""); setSellResult(null);
    try {
      const r = await adminFetch(`${basePath}/api/admin/packs/checkout`, {
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
      const r = await adminFetch(`${basePath}/api/admin/leads?page=${page}&limit=50${sort}`);
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
      const r = await adminFetch(`${basePath}/api/admin/users?page=${usersPage}&limit=50`);
      const data = await r.json();
      setAdminUsers(data.users ?? []);
      setTotalUsers(data.total ?? 0);
      setUsersPages(data.pages ?? 1);
    } catch {}
    setLoadingUsers(false);
  }, [usersPage]);

  useEffect(() => {
    adminFetch(`${basePath}/api/admin/stats`).then(r => r.json()).then(setStats).catch(() => {});
    adminFetch(`${basePath}/api/admin/geo`).then(r => r.json()).then(setGeo).catch(() => {});
    adminFetch(`${basePath}/api/admin/geo?minOpportunity=40`).then(r => r.json()).then(setMoneyGeo).catch(() => {});
    setRevenueLoading(true);
    adminFetch(`${basePath}/api/admin/revenue`).then(r => r.json()).then(data => { setRevenue(data); setRevenueLoading(false); }).catch(() => setRevenueLoading(false));
  }, []);

  // Money intelligence — refetches whenever the selected state changes.
  useEffect(() => {
    const q = selectedState ? `?state=${selectedState}` : "";
    adminFetch(`${basePath}/api/admin/opportunity-by-category${q}`)
      .then(r => r.json())
      .then(d => { setCategoryMoney(d.categories ?? []); setSummary(d.summary ?? null); setNeeds(d.needs ?? []); })
      .catch(() => {});
  }, [selectedState]);

  const fetchDeletedLeads = useCallback(async () => {
    setLoadingDeleted(true);
    try {
      const r = await adminFetch(`${basePath}/api/admin/deleted-leads?page=${deletedPage}&limit=50`);
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
      const r = await adminFetch(`${basePath}/api/admin/restore/${id}`, { method: "POST" });
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
      const r = await adminFetch(`${basePath}/api/admin/restore-bulk`, {
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
              {(["command", "orders", "captured", "chats", "email", "scraper", "traffic", "social", "research", "proxies", "overview", "users", "leads", "money", "deleted"] as const).map(tab => (
                <button key={tab} onClick={() => { setActiveTab(tab); if (tab === "leads" || tab === "money") setPage(1); if (tab === "deleted") setDeletedPage(1); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${activeTab === tab ? tab === "deleted" ? "bg-red-500/80 text-white" : "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {tab === "command" ? "⚡ Command" : tab === "orders" ? `📦 Orders${ordersNeedingReview > 0 ? ` (${ordersNeedingReview})` : ""}` : tab === "captured" ? "✉️ Captured Leads" : tab === "chats" ? `💬 Chats${chatUnreadTotal > 0 ? ` (${chatUnreadTotal})` : ""}` : tab === "email" ? "📧 Email" : tab === "scraper" ? "🕷️ Scraper" : tab === "traffic" ? "📈 Traffic" : tab === "social" ? "📣 Social" : tab === "research" ? "🎯 AI Research" :tab === "proxies" ? "🛡️ Proxies" : tab === "overview" ? "📍 Map" : tab === "users" ? "👥 Users" : tab === "leads" ? "📋 Leads" : tab === "money" ? "💰 Money Leads" : `🗑️ Deleted${deletedTotal > 0 ? ` (${deletedTotal})` : ""}`}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ── CAPTURED LEADS TAB (free-sample email capture) ───────────── */}
          {activeTab === "captured" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
              {/* ── Email customers composer ──────────────────────────────── */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <h2 className="font-display font-bold text-lg flex items-center gap-2 mb-1"><Mail className="w-5 h-5 text-primary" /> Email Customers</h2>
                <p className="text-sm text-muted-foreground mb-4">Write one email and send it to your customers — the people who grabbed free samples or bought a pack. Great for "fresh packs are in" pitches. Unsubscribes are handled automatically.</p>

                {!blastReady && (
                  <p className="text-xs text-amber-400 mb-3">⚠ No email provider configured — connect Gmail or set up Resend in the ⚡ Automate settings first.</p>
                )}
                {blastReady && blastVia === "replit" && (
                  <p className="text-xs text-muted-foreground mb-3">📮 Sending via <span className="text-foreground font-semibold">Replit Mail</span> (built-in — works right now). Connect <span className="text-foreground font-semibold">Google Mail</span> in Replit's Integrations panel any time to send from your own Gmail address instead.</p>
                )}
                {blastReady && blastVia === "gmail" && blastGmailAddr && (
                  <p className="text-xs text-muted-foreground mb-3">📮 Sending from <span className="text-foreground font-semibold">{blastGmailAddr}</span> via Gmail.</p>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  {([
                    { key: "prospects" as const, label: "Haven't bought yet" },
                    { key: "buyers" as const, label: "Past buyers" },
                    { key: "all" as const, label: "Everyone" },
                  ]).map(a => (
                    <button key={a.key} onClick={() => setBlastAudience(a.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${blastAudience === a.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                      {a.label}{blastCounts ? ` (${blastCounts[a.key]})` : ""}
                    </button>
                  ))}
                  {blastCounts && blastCounts.optedOut > 0 && (
                    <span className="px-3 py-1.5 text-xs text-muted-foreground">{blastCounts.optedOut} opted out (always skipped)</span>
                  )}
                </div>

                <input value={blastSubject} onChange={e => setBlastSubject(e.target.value)} placeholder="Subject"
                  className="w-full mb-2 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary" />
                <textarea value={blastBody} onChange={e => setBlastBody(e.target.value)} rows={8} placeholder="Your message — plain text; links become clickable. Your signature, address and an unsubscribe link are added automatically."
                  className="w-full mb-2 px-3 py-2 rounded-lg bg-background border border-border text-sm leading-relaxed focus:outline-none focus:border-primary resize-y" />

                <label className="flex items-center gap-2 text-xs text-muted-foreground mb-3 cursor-pointer">
                  <input type="checkbox" checked={blastSkipRecent} onChange={e => setBlastSkipRecent(e.target.checked)} className="accent-[#00E676]" />
                  Skip anyone already emailed in the last 3 days
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <input value={blastTestTo} onChange={e => setBlastTestTo(e.target.value)} placeholder="you@email.com"
                    className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-52 focus:outline-none focus:border-primary" />
                  <button onClick={sendBlastTest} disabled={blastBusy || !blastReady || !blastTestTo || !blastSubject.trim() || !blastBody.trim()}
                    className="px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50">
                    Send test to me
                  </button>
                  <div className="flex-1" />
                  <button onClick={startCustomerBlast}
                    disabled={blastBusy || !blastReady || !!blastJob?.running || !blastSubject.trim() || !blastBody.trim() || !blastCounts || blastCounts[blastAudience] === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                    <Send className="w-4 h-4" /> {blastJob?.running ? "Sending…" : `Send to ${blastCounts ? blastCounts[blastAudience] : "…"} people`}
                  </button>
                </div>

                {blastJob?.running && (
                  <p className="text-xs text-primary mt-3 animate-pulse">
                    Sending… {blastJob.sent + blastJob.failed}/{blastJob.total} done{blastJob.failed ? ` (${blastJob.failed} failed)` : ""} — emails go out a couple seconds apart so they land in inboxes, not spam.
                  </p>
                )}
                {!blastJob?.running && blastJob?.finishedAt && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Last blast: {blastJob.sent} sent{blastJob.failed ? `, ${blastJob.failed} failed${blastJob.lastError ? ` (${blastJob.lastError})` : ""}` : ""}.
                  </p>
                )}
                {blastMsg && <p className="text-xs text-primary mt-3">{blastMsg}</p>}
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div>
                    <h2 className="font-display font-bold text-lg flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Captured Leads</h2>
                    <p className="text-sm text-muted-foreground max-w-2xl">People who unlocked free sample leads with their email. They get an automatic "grab the other 95" follow-up ~1 hour after unlocking — or send it now with the ✉ button.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={exportCaptured} disabled={!captured?.leads?.length}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50">
                      <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button onClick={loadCaptured} disabled={loadingCaptured}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50">
                      <RefreshCw className={`w-4 h-4 ${loadingCaptured ? "animate-spin" : ""}`} /> Refresh
                    </button>
                  </div>
                </div>

                {captured?.stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                    {[
                      { label: "Sample views", value: captured.stats.totalViews },
                      { label: "Emails captured", value: captured.stats.captures },
                      { label: "Followed up", value: captured.stats.followedUp },
                      { label: "Purchased", value: captured.stats.purchased },
                      { label: "Unsubscribed", value: captured.stats.unsubscribed },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl border border-border bg-background/40 p-3">
                        <div className="text-xl font-display font-bold text-foreground">{s.value.toLocaleString()}</div>
                        <div className="text-[11px] text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {captured && !captured.followupReady && (
                  <p className="text-xs text-amber-400 mb-3">⚠ No email provider configured — set up Gmail or Resend in the ⚡ Automate settings to send follow-ups.</p>
                )}
                {capturedMsg && <p className="text-xs text-primary mb-3">{capturedMsg}</p>}

                {!captured?.leads?.length ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">{loadingCaptured ? "Loading…" : "No captured emails yet. They'll appear here when a visitor unlocks free sample leads."}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Wanted</th>
                          <th className="py-2 pr-3">Captured</th><th className="py-2 pr-3">Status</th><th className="py-2">Follow-up</th>
                        </tr>
                      </thead>
                      <tbody>
                        {captured.leads.map(l => (
                          <tr key={l.id} className="border-b border-border/50">
                            <td className="py-2 pr-3 font-medium text-foreground">{l.email}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{[l.label, l.location].filter(Boolean).join(" · ") || l.rawRequest || "—"}</td>
                            <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{l.unlockedAt ? new Date(l.unlockedAt).toLocaleDateString() : "—"}</td>
                            <td className="py-2 pr-3">
                              {l.purchased ? <span className="text-primary font-semibold">✓ Purchased</span>
                                : l.unsubscribedAt ? <span className="text-muted-foreground">Unsubscribed</span>
                                : l.followedUpAt ? <span className="text-muted-foreground">Followed up</span>
                                : <span className="text-amber-400">New</span>}
                            </td>
                            <td className="py-2">
                              <button
                                onClick={() => sendFollowup(l.id)}
                                disabled={followingUpId === l.id || !!l.followedUpAt || !!l.unsubscribedAt || l.purchased || !captured.followupReady}
                                title={l.purchased ? "Already bought" : l.unsubscribedAt ? "Unsubscribed" : l.followedUpAt ? "Already sent" : "Send follow-up now"}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-primary/50 text-primary text-xs font-semibold hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-primary">
                                <Send className={`w-3.5 h-3.5 ${followingUpId === l.id ? "animate-pulse" : ""}`} /> {followingUpId === l.id ? "Sending…" : "Send"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── ORDERS TAB (lead-pack review & send queue) ───────────────── */}
          {activeTab === "orders" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-display font-bold text-lg flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Lead Pack Orders</h2>
                    <p className="text-sm text-muted-foreground">Every paid order waits here — preview the CSV, then hit Send to email the buyer their download link. Partial packs auto-refund the shortfall when you send.</p>
                  </div>
                  <button onClick={loadPackOrders} disabled={ordersLoading}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${ordersLoading ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>
                {packOrdersList.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">{ordersLoading ? "Loading…" : "No orders yet. They'll show up here the moment someone buys a pack."}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="py-2 pr-3">#</th><th className="py-2 pr-3">Ordered</th><th className="py-2 pr-3">Pack</th>
                          <th className="py-2 pr-3">Buyer</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Leads</th>
                          <th className="py-2 pr-3">Paid</th><th className="py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {packOrdersList.map(o => {
                          const what = [o.label || o.category || "leads", [o.city, o.state].filter(Boolean).join(", ")].filter(Boolean).join(" — ");
                          const chip = o.status === "needs_review" ? "bg-amber-500/15 text-amber-500"
                            : o.status === "building" ? "bg-blue-500/15 text-blue-400"
                            : o.status === "ready" ? "bg-emerald-500/15 text-emerald-500"
                            : o.status === "partial" ? "bg-lime-500/15 text-lime-500"
                            : o.status === "failed" ? "bg-red-500/15 text-red-500"
                            : "bg-muted text-muted-foreground";
                          const label = o.status === "needs_review" ? "Needs review" : o.status === "awaiting_payment" ? "Awaiting payment" : o.status.charAt(0).toUpperCase() + o.status.slice(1);
                          return (
                            <tr key={o.id} className="border-b border-border/50 align-top">
                              <td className="py-2.5 pr-3 font-mono">{o.id}</td>
                              <td className="py-2.5 pr-3 whitespace-nowrap">{o.createdAt ? new Date(o.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</td>
                              <td className="py-2.5 pr-3">
                                <div className="font-semibold">{what}</div>
                                {o.rawRequest && <div className="text-xs text-muted-foreground max-w-[220px] truncate" title={o.rawRequest}>"{o.rawRequest}"</div>}
                              </td>
                              <td className="py-2.5 pr-3">{o.email ?? <span className="text-muted-foreground">—</span>}</td>
                              <td className="py-2.5 pr-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${chip}`}>{label}</span>
                                {o.status === "building" && <div className="text-xs text-muted-foreground mt-1">round {o.attempts}</div>}
                              </td>
                              <td className="py-2.5 pr-3 whitespace-nowrap font-mono">{o.delivered}/{o.requested}</td>
                              <td className="py-2.5 pr-3 whitespace-nowrap">${(o.amountCents / 100).toFixed(0)}{o.refundedCents > 0 && <span className="text-xs text-amber-500 block">-${(o.refundedCents / 100).toFixed(2)} refunded</span>}</td>
                              <td className="py-2.5">
                                <div className="flex gap-2 whitespace-nowrap">
                                  {o.status !== "awaiting_payment" && o.status !== "failed" && (
                                    <a href={`${basePath}/api/admin/pack-orders/${o.id}/preview.csv`}
                                      className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors inline-flex items-center gap-1">
                                      <Download className="w-3.5 h-3.5" /> Preview CSV
                                    </a>
                                  )}
                                  {o.status === "needs_review" && (
                                    <button onClick={() => sendPackOrder(o)} disabled={sendingOrderId === o.id}
                                      className="px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-1">
                                      <Zap className="w-3.5 h-3.5" /> {sendingOrderId === o.id ? "Sending…" : `Send to buyer${o.delivered < o.requested ? ` (${o.delivered} + refund)` : ""}`}
                                    </button>
                                  )}
                                  {(o.status === "ready" || o.status === "partial") && (
                                    <a href={`${basePath}/api/leads/pack-order-download?token=${o.token}`}
                                      className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors inline-flex items-center gap-1">
                                      <ExternalLink className="w-3.5 h-3.5" /> Buyer link
                                    </a>
                                  )}
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

              {/* Buyer reviews — moderation queue for the home-page testimonials */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="font-display font-bold text-lg flex items-center gap-2"><Star className="w-5 h-5 text-primary" /> Buyer Reviews</h2>
                    <p className="text-sm text-muted-foreground">Real reviews from delivered orders (buyers get a review link in their delivery email). Approve to show on the home page — nothing appears without your OK.</p>
                  </div>
                  <button onClick={askBuyersForReviews} disabled={reviewAskBusy || reviewAskEligible === 0}
                    title="Emails every delivered buyer who hasn't been asked yet their personal review link — each buyer is only ever asked once"
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 whitespace-nowrap">
                    {reviewAskBusy ? "Sending…" : reviewAskEligible === 0 ? "All buyers asked ✓" : `✉️ Ask past buyers${reviewAskEligible ? ` (${reviewAskEligible})` : ""}`}
                  </button>
                </div>
                {reviewAskMsg && <p className="text-xs text-primary mb-3">✓ {reviewAskMsg}</p>}
                {testimonialsList.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No reviews yet — they arrive after buyers receive their packs.</p>
                ) : (
                  <div className="space-y-3">
                    {testimonialsList.map((t) => (
                      <div key={t.id} className="rounded-xl border border-border bg-background/40 p-4">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-semibold text-sm">{t.name}</span>
                          {t.business && <span className="text-xs text-muted-foreground">· {t.business}</span>}
                          <span className="text-xs text-primary">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</span>
                          <span className="text-xs text-muted-foreground">· order #{t.orderId}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${t.status === "approved" ? "bg-emerald-500/15 text-emerald-500" : t.status === "pending" ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"}`}>{t.status}</span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap mb-3">{t.quote}</p>
                        <div className="flex gap-2 flex-wrap">
                          {t.status !== "approved" && (
                            <button onClick={() => setTestimonialStatus(t.id, "approved")} disabled={testimonialBusyId === t.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50">Approve — show on site</button>
                          )}
                          {t.status === "approved" && (
                            <button onClick={() => setTestimonialStatus(t.id, "hidden")} disabled={testimonialBusyId === t.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground disabled:opacity-50">Hide from site</button>
                          )}
                          <button onClick={() => deleteTestimonial(t.id)} disabled={testimonialBusyId === t.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── CHATS TAB (live visitor chat with human takeover) ─────────── */}
          {activeTab === "chats" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="grid md:grid-cols-[320px_1fr] gap-4">
              {/* Conversation list */}
              <div className="rounded-2xl border border-border bg-card p-4 md:max-h-[70vh] overflow-y-auto">
                <h2 className="font-display font-bold text-lg flex items-center gap-2 mb-1">💬 Site Chats</h2>
                <p className="text-xs text-muted-foreground mb-4">Live conversations from the site widget. Reply and the AI hands the visitor to you instantly.</p>
                {chatConvs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">No conversations yet — they appear the moment a visitor sends a message.</p>
                ) : (
                  <div className="space-y-2">
                    {chatConvs.map((c) => (
                      <button key={c.id} onClick={() => setActiveChatId(c.id)}
                        className={`w-full text-left rounded-xl border p-3 transition-colors ${activeChatId === c.id ? "border-primary/50 bg-primary/5" : "border-border bg-background/40 hover:border-primary/30"}`}>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <span className="font-mono">#{c.id}</span>
                          {c.page && <span className="truncate">{c.page}</span>}
                          {c.adminJoined && <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">you're live</span>}
                          {c.unread > 0 && <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">{c.unread}</span>}
                        </div>
                        <p className="text-sm text-foreground truncate">
                          {c.lastMessage ? `${c.lastMessage.sender === "visitor" ? "👤 " : c.lastMessage.sender === "admin" ? "🫵 " : "🤖 "}${c.lastMessage.body}` : "(empty)"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">{new Date(c.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Active thread */}
              <div className="rounded-2xl border border-border bg-card p-4 flex flex-col md:max-h-[70vh]">
                {activeChatId === null ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground py-20">Pick a conversation to read it and jump in.</div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-border">
                      <div className="text-sm font-semibold">Conversation #{activeChatId}</div>
                      {chatConvs.find((c) => c.id === activeChatId)?.adminJoined ? (
                        <button onClick={() => releaseChat(activeChatId)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80">Hand back to AI</button>
                      ) : (
                        <span className="text-xs text-muted-foreground">AI is answering — send a reply to take over</span>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[300px]">
                      {chatThread.map((m) => (
                        <div key={m.id} className={`flex ${m.sender === "visitor" ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[80%] rounded-xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                            m.sender === "visitor" ? "bg-background border border-border text-foreground"
                            : m.sender === "admin" ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"}`}>
                            <div className="text-[10px] font-bold opacity-70 mb-0.5">{m.sender === "visitor" ? "Visitor" : m.sender === "admin" ? "You" : "AI"}</div>
                            {m.body}
                          </div>
                        </div>
                      ))}
                      <div ref={chatThreadEndRef} />
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                      <input value={chatReply} onChange={(e) => setChatReply(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendChatReply(); } }}
                        placeholder="Type your reply — sending takes over from the AI"
                        className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground" />
                      <button onClick={sendChatReply} disabled={chatSending || !chatReply.trim()}
                        className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90">
                        {chatSending ? "…" : "Reply live"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* ── SCRAPER TAB (Apify-style run console) ────────────────────── */}
          {activeTab === "email" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">

              {/* Engine status + master switch */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <div className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-display font-bold">AI Email Outreach</h2>
                    {emailInfo && (
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${emailInfo.settings.enabled ? "bg-primary/15 text-primary border-primary/40" : "bg-muted text-muted-foreground border-border"}`}>
                        {emailInfo.settings.enabled ? "On" : "Paused"}
                      </span>
                    )}
                  </div>
                  {emailInfo && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => patchEmailSettings({ autopilot: !emailInfo.settings.autopilot }, "toggle")} disabled={!!emailBusy}
                        title="Autopilot enrolls the best new scraped companies automatically — no manual picking"
                        className={`px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 border ${emailInfo.settings.autopilot ? "bg-primary/15 text-primary border-primary/40" : "bg-muted text-muted-foreground border-border hover:text-foreground"}`}>
                        🤖 Autopilot {emailInfo.settings.autopilot ? "on" : "off"}
                      </button>
                      <button onClick={() => patchEmailSettings({ enabled: !emailInfo.settings.enabled }, "toggle")} disabled={!!emailBusy || (!emailInfo.settings.enabled && !emailProviderReady)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 ${emailInfo.settings.enabled ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                        {emailBusy === "toggle" ? "…" : emailInfo.settings.enabled ? "Pause engine" : "▶ Turn on"}
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  The engine writes each company a personalized pitch with AI, sends it from your address, follows up on a schedule, stops the moment they reply or unsubscribe, and stays under your daily cap. With <strong>Autopilot on</strong> it also picks who to pitch by itself — the best newly scraped companies are enrolled automatically, so scraping + selling runs hands-free.
                </p>
                {emailInfo && !emailProviderReady && (
                  <p className="text-xs text-amber-400 mb-3">⚠ No email provider connected — open Replit's <strong>Integrations</strong> panel and connect <strong>Google Mail</strong> (one click, uses your signed-in Gmail), or add GMAIL_USER + GMAIL_APP_PASSWORD / RESEND_API_KEY in Secrets.</p>
                )}
                {emailMsg && <p className="text-xs text-primary mb-2">✓ {emailMsg}</p>}
                {emailErr && <p className="text-xs text-red-400 mb-2">⚠ {emailErr}</p>}

                {/* Provider / plumbing health */}
                {emailStats && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {[
                      { label: emailStats.providers.gmailAddress ? `Gmail · ${emailStats.providers.gmailAddress}` : "Gmail", ok: emailStats.providers.gmailSmtp || emailStats.providers.gmailConnector, hint: "Sends from your real inbox (Replit Google Mail connector or app-password secrets)" },
                      { label: "Resend", ok: emailStats.providers.resend, hint: "RESEND_API_KEY + verified domain — scales past Gmail's ~500/day" },
                      { label: "Replit Mail backstop", ok: emailStats.providers.replitMail, hint: "Zero-setup fallback so sending always has a way out" },
                      { label: "Reply watcher", ok: emailStats.providers.imapWatcher, hint: "IMAP inbox watching for replies — needs GMAIL_USER + GMAIL_APP_PASSWORD secrets" },
                    ].map(c => (
                      <span key={c.label} title={c.hint}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${c.ok ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"}`}>
                        {c.ok ? "●" : "○"} {c.label}
                      </span>
                    ))}
                  </div>
                )}

                {emailInfo && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                    <div className="rounded-xl border border-border bg-background/40 px-3 py-2">
                      <div className="text-lg font-display font-bold text-foreground">{emailInfo.sentToday}<span className="text-xs text-muted-foreground font-normal">/{emailInfo.settings.dailyCap}</span></div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Sent today</div>
                      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((emailInfo.sentToday / Math.max(1, emailInfo.settings.dailyCap)) * 100))}%` }} />
                      </div>
                    </div>
                    {[
                      { label: "This week", value: String(emailStats?.totals.sent7d ?? "—") },
                      { label: "All time", value: String(emailStats?.totals.sentAllTime ?? "—") },
                      { label: "Enrolled", value: String(emailInfo.enrolled) },
                      { label: "Awaiting send", value: String(emailInfo.pending) },
                      { label: "Reply rate", value: emailStats ? `${emailStats.totals.replyRate}%` : "—", title: emailStats ? `${emailStats.totals.replied} of ${emailStats.totals.leadsEmailed} companies emailed wrote back` : undefined },
                      { label: "Bounces", value: String(emailStats?.totals.bounced ?? "—") },
                      { label: "Unsubs", value: String(emailStats?.totals.unsubscribed ?? "—") },
                    ].map(s => (
                      <div key={s.label} title={s.title} className="rounded-xl border border-border bg-background/40 px-3 py-2">
                        <div className="text-lg font-display font-bold text-foreground">{s.value}</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Send history */}
                {emailStats && emailStats.totals.sentAllTime + emailStats.totals.failedAllTime > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">Send history — last 14 days</h4>
                      {emailStats.totals.failedAllTime > 0 && (
                        <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-primary inline-block" /> sent</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> failed</span>
                        </span>
                      )}
                    </div>
                    <SendHistoryChart perDay={emailStats.perDay} />
                  </div>
                )}
              </div>

              {/* Pitch + sending settings */}
              {emailDraft && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="text-sm font-display font-bold text-muted-foreground uppercase tracking-wide">Your pitch &amp; sending rules</h3>
                    <button onClick={() => setEmailShowAdvanced(v => !v)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                      {emailShowAdvanced ? "▾ Hide advanced" : "▸ Advanced settings"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-muted-foreground">What you're selling (the AI writes every email around this)</label>
                      <textarea value={emailDraft.offer} onChange={e => setEmailDraft({ ...emailDraft, offer: e.target.value })} rows={3}
                        placeholder="Fresh, verified local-business lead lists for your industry — 100 leads for $29, delivered as a clean CSV…"
                        className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 outline-none resize-y" />
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">From name</label>
                        <input value={emailDraft.fromName} onChange={e => setEmailDraft({ ...emailDraft, fromName: e.target.value })}
                          className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-44 focus:border-primary/50 outline-none" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">From email</label>
                        <input value={emailDraft.fromEmail} onChange={e => setEmailDraft({ ...emailDraft, fromEmail: e.target.value })} placeholder={emailInfo?.gmailAddress ?? ""}
                          className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-56 focus:border-primary/50 outline-none" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Daily cap</label>
                        <input type="number" min={1} max={500} value={emailDraft.dailyCap}
                          onChange={e => setEmailDraft({ ...emailDraft, dailyCap: Math.min(500, Math.max(1, Number(e.target.value) || 1)) })}
                          className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-24 focus:border-primary/50 outline-none" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-muted-foreground">Send window (hours)</label>
                        <div className="flex items-center gap-1">
                          <input type="number" min={0} max={23} value={emailDraft.windowStartHour}
                            onChange={e => setEmailDraft({ ...emailDraft, windowStartHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)) })}
                            className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-20 focus:border-primary/50 outline-none" />
                          <span className="text-xs text-muted-foreground">to</span>
                          <input type="number" min={1} max={24} value={emailDraft.windowEndHour}
                            onChange={e => setEmailDraft({ ...emailDraft, windowEndHour: Math.min(24, Math.max(1, Number(e.target.value) || 1)) })}
                            className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-20 focus:border-primary/50 outline-none" />
                        </div>
                      </div>
                    </div>

                    {emailShowAdvanced && (
                      <div className="rounded-xl border border-border bg-background/30 p-4 flex flex-col gap-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-muted-foreground">Provider</label>
                            <select value={emailDraft.provider} onChange={e => setEmailDraft({ ...emailDraft, provider: e.target.value })}
                              className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-40 focus:border-primary/50 outline-none">
                              <option value="gmail">Gmail (personal)</option>
                              <option value="resend">Resend (scale)</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-muted-foreground">Reply-to (optional)</label>
                            <input value={emailDraft.replyTo} onChange={e => setEmailDraft({ ...emailDraft, replyTo: e.target.value })} placeholder="Defaults to the from address"
                              className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-56 focus:border-primary/50 outline-none" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-muted-foreground">Timezone</label>
                            <select value={emailDraft.tzOffsetMinutes} onChange={e => setEmailDraft({ ...emailDraft, tzOffsetMinutes: Number(e.target.value) })}
                              className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-44 focus:border-primary/50 outline-none">
                              {[{ v: -240, l: "US Eastern (UTC-4)" }, { v: -300, l: "US Central (UTC-5)" }, { v: -360, l: "US Mountain (UTC-6)" }, { v: -420, l: "US Pacific (UTC-7)" }]
                                .concat([-240, -300, -360, -420].includes(emailDraft.tzOffsetMinutes) ? [] : [{ v: emailDraft.tzOffsetMinutes, l: `Custom (UTC${emailDraft.tzOffsetMinutes >= 0 ? "+" : ""}${emailDraft.tzOffsetMinutes / 60})` }])
                                .map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-muted-foreground" title="A fresh random wait between every send keeps the rhythm human">Gap between sends (min)</label>
                            <div className="flex items-center gap-1">
                              <input type="number" min={1} max={240} value={emailDraft.minGapMinutes}
                                onChange={e => setEmailDraft({ ...emailDraft, minGapMinutes: Math.min(240, Math.max(1, Number(e.target.value) || 1)) })}
                                className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-20 focus:border-primary/50 outline-none" />
                              <span className="text-xs text-muted-foreground">to</span>
                              <input type="number" min={1} max={480} value={emailDraft.maxGapMinutes}
                                onChange={e => setEmailDraft({ ...emailDraft, maxGapMinutes: Math.min(480, Math.max(1, Number(e.target.value) || 1)) })}
                                className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-20 focus:border-primary/50 outline-none" />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                            <label className="text-xs font-semibold text-muted-foreground">Signature (under every email)</label>
                            <textarea value={emailDraft.signature} onChange={e => setEmailDraft({ ...emailDraft, signature: e.target.value })} rows={2}
                              placeholder={"— Josh\nGulf Coast Leads · (228) 555-0100"}
                              className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 outline-none resize-y" />
                          </div>
                          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                            <label className="text-xs font-semibold text-muted-foreground" title="Required for compliant bulk email — also keeps you out of spam">Business address (email footer)</label>
                            <input value={emailDraft.businessAddress} onChange={e => setEmailDraft({ ...emailDraft, businessAddress: e.target.value })} placeholder="123 Main St, Biloxi, MS 39530"
                              className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 outline-none" />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <input type="checkbox" checked={emailDraft.sendOnWeekends} onChange={e => setEmailDraft({ ...emailDraft, sendOnWeekends: e.target.checked })} />
                            Send on weekends
                          </label>
                          {emailInfo && (
                            <>
                              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer" title="The AI answers replies for you (needs Gmail app-password secrets — that's the inbox it watches)">
                                <input type="checkbox" checked={emailInfo.settings.autoReply}
                                  onChange={e => patchEmailSettings({ autoReply: e.target.checked }, "toggle")} disabled={!!emailBusy} />
                                🤖 AI answers replies for me
                              </label>
                              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer" title="When you mark a lead contacted by hand, the engine takes over its follow-ups automatically">
                                <input type="checkbox" checked={emailInfo.settings.autoEnrollOnContact}
                                  onChange={e => patchEmailSettings({ autoEnrollOnContact: e.target.checked }, "toggle")} disabled={!!emailBusy} />
                                Auto-continue follow-ups after manual contact
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <button onClick={() => patchEmailSettings(emailDraft, "save")} disabled={!!emailBusy}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50">
                        {emailBusy === "save" ? "Saving…" : "Save settings"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Company picker — who gets pitched */}
              {(() => {
                const visibleCandidates = emailCandidates.filter(l => {
                  if (emailHideEnrolled && (l.autoOutreach || (l.outreachStep ?? 0) > 0)) return false;
                  const q = emailSearch.trim().toLowerCase();
                  if (!q) return true;
                  return l.name.toLowerCase().includes(q) || (l.emails ?? "").toLowerCase().includes(q) || (l.address ?? "").toLowerCase().includes(q);
                });
                return (
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                  <h3 className="text-sm font-display font-bold text-muted-foreground uppercase tracking-wide">
                    Companies to pitch
                    <span className="ml-2 normal-case font-normal text-muted-foreground/70">{visibleCandidates.length} shown{emailSelected.size > 0 ? ` · ${emailSelected.size} selected` : ""}</span>
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input value={emailSearch} onChange={e => setEmailSearch(e.target.value)} placeholder="Search name / email / city"
                      className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs w-44 focus:border-primary/50 outline-none" />
                    <input value={emailCategoryFilter} onChange={e => setEmailCategoryFilter(e.target.value)} placeholder="Category (e.g. roof)"
                      onKeyDown={e => { if (e.key === "Enter") loadEmailCandidates(emailCategoryFilter); }}
                      className="px-3 py-1.5 rounded-lg bg-background border border-border text-xs w-40 focus:border-primary/50 outline-none" />
                    <button onClick={() => loadEmailCandidates(emailCategoryFilter)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80">
                      {emailCandidatesLoading ? "Loading…" : "Search"}
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                      <input type="checkbox" checked={emailHideEnrolled} onChange={e => setEmailHideEnrolled(e.target.checked)} />
                      Hide already pitched
                    </label>
                    <button onClick={() => enrollEmailSelected("enroll")} disabled={emailSelected.size === 0 || !!emailBusy}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
                      {emailBusy === "enroll" ? "Enrolling…" : `Enroll ${emailSelected.size || ""}`}
                    </button>
                    <button onClick={() => enrollEmailSelected("pause")} disabled={emailSelected.size === 0 || !!emailBusy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80 disabled:opacity-50">
                      {emailBusy === "pause" ? "Pausing…" : "Pause"}
                    </button>
                  </div>
                </div>
                {visibleCandidates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{emailCandidatesLoading ? "Loading…" : "No companies with an email address match — scrape more leads or loosen the filters."}</p>
                ) : (
                  <div className="overflow-x-auto -mx-1 max-h-96 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card">
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="px-2 py-1.5">
                            <input type="checkbox" checked={emailSelected.size > 0 && emailSelected.size === visibleCandidates.length}
                              onChange={e => setEmailSelected(e.target.checked ? new Set(visibleCandidates.map(l => l.id)) : new Set())} />
                          </th>
                          <th className="px-2 py-1.5 font-semibold">Company</th>
                          <th className="px-2 py-1.5 font-semibold">Category</th>
                          <th className="px-2 py-1.5 font-semibold">Email</th>
                          <th className="px-2 py-1.5 font-semibold">Outreach</th>
                          <th className="px-2 py-1.5 font-semibold">Draft</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCandidates.map(l => (
                          <tr key={l.id} className="border-b border-border/50">
                            <td className="px-2 py-1.5">
                              <input type="checkbox" checked={emailSelected.has(l.id)}
                                onChange={e => setEmailSelected(prev => { const next = new Set(prev); if (e.target.checked) next.add(l.id); else next.delete(l.id); return next; })} />
                            </td>
                            <td className="px-2 py-1.5 text-foreground font-medium truncate max-w-[220px]">{l.name}</td>
                            <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[140px]">{l.category ?? "—"}</td>
                            <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[200px]">{(l.emails ?? "").split(/[,;\s]+/).find(s => s.includes("@")) ?? "—"}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              {l.repliedAt ? (
                                <button onClick={() => openEmailThread(l.id, l.name)} className="text-primary font-semibold hover:underline">replied →</button>
                              ) : l.autoOutreach ? <span className="text-blue-400">enrolled · step {l.outreachStep ?? 0}</span>
                                : (l.outreachStep ?? 0) > 0 ? <span className="text-muted-foreground">emailed ×{l.outreachStep}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              <button onClick={() => openEmailDraft(l.id, l.name)} title="Preview & edit the exact emails the AI will send this company"
                                className="px-2 py-0.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 font-semibold">
                                ✉️ Preview
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
                );
              })()}

              {/* Up next — the scheduled send queue */}
              {emailQueue.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="text-sm font-display font-bold text-muted-foreground uppercase tracking-wide mb-3">Up next <span className="normal-case font-normal text-muted-foreground/70">— what the engine sends, in order</span></h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {emailQueue.slice(0, 9).map(q => (
                      <div key={q.id} className="rounded-lg border border-border bg-background/40 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded-full border border-blue-500/40 bg-blue-500/15 text-blue-400 text-[9px] font-bold uppercase">step {q.nextStep}</span>
                          <span className="font-semibold text-foreground truncate">{q.name}</span>
                        </div>
                        <div className="text-muted-foreground truncate mt-0.5">{q.subject ?? q.toEmail ?? ""}</div>
                        <div className="text-muted-foreground/70 mt-0.5">{q.nextEmailAt ? new Date(q.nextEmailAt).toLocaleString() : "—"}</div>
                      </div>
                    ))}
                  </div>
                  {emailQueue.length > 9 && <p className="text-[11px] text-muted-foreground mt-2">+ {emailQueue.length - 9} more scheduled</p>}
                </div>
              )}

              {/* Sent + replies feeds */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-sm font-display font-bold text-muted-foreground uppercase tracking-wide">Recent sends</h3>
                    <div className="flex items-center gap-1">
                      {(["all", "sent", "failed"] as const).map(f => (
                        <button key={f} onClick={() => setEmailActivityFilter(f)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${emailActivityFilter === f ? "bg-primary/15 text-primary border border-primary/40" : "text-muted-foreground hover:text-foreground border border-transparent"}`}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  {emailActivity.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nothing sent yet — enroll companies above and turn the engine on.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                      {emailActivity.filter(a => emailActivityFilter === "all" || a.status === emailActivityFilter).slice(0, 60).map(a => (
                        <button key={a.id} onClick={() => openEmailThread(a.leadId, a.leadName ?? a.toEmail)}
                          className="w-full text-left rounded-lg border border-border bg-background/40 px-3 py-2 text-xs hover:border-primary/40 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase ${a.status === "sent" ? "bg-primary/15 text-primary border-primary/40" : "bg-red-500/15 text-red-400 border-red-500/40"}`}>{a.status}</span>
                            <span className="font-semibold text-foreground truncate">{a.leadName ?? a.toEmail}</span>
                            <span className="ml-auto text-muted-foreground whitespace-nowrap">step {a.step} · {new Date(a.createdAt).toLocaleString()}</span>
                          </div>
                          <div className="text-muted-foreground truncate mt-0.5">{a.status === "failed" ? (a.error ?? "failed") : a.subject}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="text-sm font-display font-bold text-muted-foreground uppercase tracking-wide mb-3">Replies <span className="normal-case font-normal text-muted-foreground/70">— click one to read the thread &amp; answer</span></h3>
                  {emailReplies.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No replies yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                      {emailReplies.map(r => (
                        <button key={r.id} onClick={() => openEmailThread(r.leadId, r.leadName ?? r.fromEmail ?? `Lead #${r.leadId}`)}
                          className="w-full text-left rounded-lg border border-border bg-background/40 px-3 py-2 text-xs hover:border-primary/40 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase ${r.direction === "in" ? "bg-blue-500/15 text-blue-400 border-blue-500/40" : "bg-primary/15 text-primary border-primary/40"}`}>{r.direction === "in" ? "in" : r.aiGenerated ? "AI out" : "out"}</span>
                            <span className="font-semibold text-foreground truncate">{r.leadName ?? r.fromEmail ?? "—"}</span>
                            <span className="ml-auto text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</span>
                          </div>
                          {r.body && <div className="text-muted-foreground mt-0.5 line-clamp-2">{r.body}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Suppression list — who we'll never email again */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-display font-bold text-muted-foreground uppercase tracking-wide">Suppression list <span className="normal-case font-normal text-muted-foreground/70">— unsubscribes &amp; bounces, honored forever</span></h3>
                  <button onClick={() => { const next = !emailShowSuppressed; setEmailShowSuppressed(next); if (next && emailSuppressed === null) loadEmailSuppressed(); }}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                    {emailShowSuppressed ? "▾ Hide" : `▸ Show${emailStats ? ` (${emailStats.totals.unsubscribed + emailStats.totals.bounced})` : ""}`}
                  </button>
                </div>
                {emailShowSuppressed && (
                  emailSuppressed === null ? <p className="text-xs text-muted-foreground mt-3">Loading…</p>
                  : emailSuppressed.length === 0 ? <p className="text-xs text-muted-foreground mt-3">Nobody has unsubscribed or bounced. 🎉</p>
                  : (
                    <div className="overflow-x-auto mt-3 max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card">
                          <tr className="text-left text-muted-foreground border-b border-border">
                            <th className="px-2 py-1.5 font-semibold">Company</th>
                            <th className="px-2 py-1.5 font-semibold">Email</th>
                            <th className="px-2 py-1.5 font-semibold">Reason</th>
                            <th className="px-2 py-1.5 font-semibold">When</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emailSuppressed.map(s => (
                            <tr key={s.id} className="border-b border-border/50">
                              <td className="px-2 py-1.5 text-foreground truncate max-w-[220px]">{s.name}</td>
                              <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[200px]">{s.email ?? "—"}</td>
                              <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase ${s.reason === "unsubscribed" ? "bg-amber-500/15 text-amber-400 border-amber-500/40" : "bg-red-500/15 text-red-400 border-red-500/40"}`}>{s.reason}</span></td>
                              <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{new Date(s.at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "scraper" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">

              {/* Run form — the "actor input" */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-display font-bold">Scraper</h2>
                  <span className="text-xs font-mono bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full">Google Maps actor</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Set the input, hit Run, and every scrape lands below as a run with its own dataset — browse the results, export CSV, and keep a full history. Same engine as the 24/7 worker.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">Category</label>
                    <input value={runnerCategory} onChange={e => setRunnerCategory(e.target.value)} placeholder="plumbers"
                      className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-48 focus:border-primary/50 outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">Location</label>
                    <input value={runnerLocation} onChange={e => setRunnerLocation(e.target.value)} placeholder="Mobile AL"
                      onKeyDown={e => { if (e.key === "Enter") startScraperRun(); }}
                      className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-48 focus:border-primary/50 outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted-foreground">Scroll depth</label>
                    <input type="number" min={0} max={8} value={runnerMaxScrolls}
                      onChange={e => setRunnerMaxScrolls(Math.min(8, Math.max(0, Number(e.target.value) || 0)))}
                      className="px-3 py-2 rounded-lg bg-background border border-border text-sm w-24 focus:border-primary/50 outline-none" />
                  </div>
                  <button onClick={startScraperRun} disabled={runStarting || !runnerCategory.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${runStarting ? "animate-spin" : ""}`} />
                    {runStarting ? "Running…" : "▶ Start run"}
                  </button>
                  {runError && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-400">
                      ⚠ {runError}
                    </div>
                  )}
                </div>
              </div>

              {/* Auto-scrape scheduler — hands-off inventory filling */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-display font-bold">Auto-Scrape</h2>
                    {autoScrape && (
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${autoScrape.enabled ? "bg-primary/15 text-primary border-primary/40" : "bg-muted text-muted-foreground border-border"}`}>
                        {autoScrape.enabled ? (autoScrape.tickInFlight || autoScrape.inFlight ? "Scraping…" : "On") : "Paused"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={tickAutoScrape} disabled={!!autoScrapeBusy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80 disabled:opacity-50">
                      <RefreshCw className={`w-3.5 h-3.5 ${autoScrapeBusy === "tick" ? "animate-spin" : ""}`} />
                      {autoScrapeBusy === "tick" ? "Running…" : "Run tick now"}
                    </button>
                    <button onClick={seedAutoScrape} disabled={!!autoScrapeBusy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80 disabled:opacity-50">
                      {autoScrapeBusy === "seed" ? "Seeding…" : "Seed plan"}
                    </button>
                    {autoScrape && (
                      <button onClick={toggleAutoScrape} disabled={!!autoScrapeBusy}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 ${autoScrape.enabled ? "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20" : "bg-primary text-primary-foreground hover:opacity-90"}`}>
                        {autoScrape.enabled ? "Pause" : "Resume"}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {autoScrape
                    ? `Every ${Math.round(autoScrape.config.intervalMs / 60000)} min it scrapes the emptiest category × metro until each holds ${autoScrape.config.targetGoal} leads (re-checked after ${autoScrape.config.cooldownHours}h). Customer runs always take priority.`
                    : "Loading scheduler status…"}
                </p>
                {autoScrapeMsg && <p className="text-xs text-primary mb-2">✓ {autoScrapeMsg}</p>}
                {autoScrape?.lastResult && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Last pass ({new Date(autoScrape.lastResult.at).toLocaleString()}): {autoScrape.lastResult.detail}
                  </p>
                )}
                {autoScrape && autoScrape.queue.length > 0 && (
                  <div>
                    <h3 className="text-xs font-display font-bold text-muted-foreground uppercase tracking-wide mb-1.5">Up next</h3>
                    <div className="space-y-1">
                      {autoScrape.queue.map(q => (
                        <div key={q.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-1.5 text-xs">
                          <span className="font-semibold text-foreground truncate">{q.category} · {q.location}</span>
                          <span className="ml-auto text-muted-foreground whitespace-nowrap">
                            {q.inventory}/{autoScrape.config.targetGoal} leads · {q.lastScrapedAt ? `last ${new Date(q.lastScrapedAt).toLocaleDateString()}` : "never scraped"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Dataset viewer for whichever run is selected */}
              {selectedRun && (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${runStatusBadge(selectedRun.status)}`}>{selectedRun.status}</span>
                      <h3 className="text-sm font-display font-bold">Run #{selectedRun.id} · {selectedRun.category}{selectedRun.location ? ` in ${selectedRun.location}` : ""}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={`${basePath}/api/admin/scraper/runs/${selectedRun.id}/export`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80">
                        <Download className="w-3.5 h-3.5" /> Export CSV
                      </a>
                      <button onClick={() => setSelectedRun(null)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Close</button>
                    </div>
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
              )}

              {/* Run history */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-display font-bold text-muted-foreground uppercase tracking-wide">Run history</h3>
                  <button onClick={loadRuns} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <RefreshCw className={`w-3 h-3 ${runsLoading ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>
                {runs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No runs yet — start one above.</p>
                ) : (
                  <div className="space-y-1.5">
                    {runs.map(run => (
                      <div key={run.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase whitespace-nowrap ${runStatusBadge(run.status)}`}>{run.status}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground truncate">{run.category}{run.location ? ` in ${run.location}` : ""}</div>
                          <div className="text-xs text-muted-foreground">
                            {run.status === "succeeded" ? `${run.saved} new · ${run.duplicates} dup · ${run.placesFound} found` : run.status === "failed" ? (run.error ?? "failed") : "running…"}
                            {run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ""} · {new Date(run.startedAt).toLocaleString()}
                          </div>
                        </div>
                        <button onClick={() => viewRun(run.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80 whitespace-nowrap">
                          View dataset
                        </button>
                        <button onClick={() => deleteRun(run.id)} disabled={runDeleteBusyId === run.id}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-400 disabled:opacity-50" title="Delete run">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── TRAFFIC TAB ───────────────────────────────────────────────── */}
          {activeTab === "traffic" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">

              {/* Header + range selector */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <h2 className="text-lg font-display font-bold">Site Traffic</h2>
                  {loadingTraffic && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
                </div>
                <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
                  {([7, 30, 90] as const).map(d => (
                    <button key={d} onClick={() => setTrafficDays(d)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${trafficDays === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      {d === 7 ? "7 days" : d === 30 ? "30 days" : "90 days"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Headline numbers — with "vs the previous period" deltas */}
              {(() => {
                // e.g. +40% vs the previous 30 days; hidden when there's no history to compare.
                const delta = (cur: number, prevVal?: number) => {
                  if (prevVal == null || (prevVal === 0 && cur === 0)) return null;
                  if (prevVal === 0) return { up: true, text: "new" };
                  const pct = Math.round(((cur - prevVal) / prevVal) * 100);
                  if (pct === 0) return { up: true, text: "±0%" };
                  return { up: pct > 0, text: `${pct > 0 ? "+" : ""}${pct}%` };
                };
                const p = traffic?.prev;
                const conv = traffic?.conversions;
                const cards = [
                  { label: "On site now", value: traffic ? traffic.summary.live.toLocaleString() : "…", icon: <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" /></span>, sub: "last 5 minutes", highlight: true, delta: null as ReturnType<typeof delta> },
                  { label: "Visitors today", value: traffic ? traffic.summary.visitorsToday.toLocaleString() : "…", icon: <Users className="w-4 h-4 text-blue-400" />, sub: "last 24 hours", highlight: false, delta: null },
                  { label: "Views today", value: traffic ? traffic.summary.viewsToday.toLocaleString() : "…", icon: <Eye className="w-4 h-4 text-green-400" />, sub: "last 24 hours", highlight: false, delta: null },
                  { label: "Visitors", value: traffic ? traffic.summary.visitors.toLocaleString() : "…", icon: <Users className="w-4 h-4 text-primary" />, sub: `last ${trafficDays} days`, highlight: false, delta: traffic ? delta(traffic.summary.visitors, p?.visitors) : null },
                  { label: "Pageviews", value: traffic ? traffic.summary.views.toLocaleString() : "…", icon: <Eye className="w-4 h-4 text-orange-400" />, sub: `last ${trafficDays} days`, highlight: false, delta: traffic ? delta(traffic.summary.views, p?.views) : null },
                  { label: "Sessions", value: traffic ? traffic.summary.sessions.toLocaleString() : "…", icon: <TrendingUp className="w-4 h-4 text-yellow-400" />, sub: `last ${trafficDays} days`, highlight: false, delta: traffic ? delta(traffic.summary.sessions, p?.sessions) : null },
                  { label: "Emails captured", value: conv ? conv.captured.toLocaleString() : "…", icon: <Mail className="w-4 h-4 text-blue-400" />, sub: `last ${trafficDays} days`, highlight: false, delta: null },
                  { label: "Money made", value: conv ? `$${(conv.revenueCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "…", icon: <DollarSign className="w-4 h-4 text-primary" />, sub: conv ? `${conv.orders} sale${conv.orders === 1 ? "" : "s"} · last ${trafficDays} days` : `last ${trafficDays} days`, highlight: true, delta: null },
                ];
                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {cards.map((s, i) => (
                      <div key={i} className={`rounded-xl p-4 border ${s.highlight ? "bg-primary/5 border-primary/30" : "bg-card border-border"}`}>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">{s.icon} {s.label}</div>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-display font-bold ${s.highlight ? "text-primary" : "text-foreground"}`}>{s.value}</span>
                          {s.delta && (
                            <span className={`text-xs font-bold ${s.delta.up ? "text-primary" : "text-red-400"}`}>
                              {s.delta.up ? "▲" : "▼"} {s.delta.text}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{s.sub}{s.delta ? ` · vs prior ${trafficDays} days` : ""}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Daily series */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-display font-bold">Visitors & pageviews by day</h3>
                </div>
                {traffic && traffic.daily.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={traffic.daily} margin={{ left: 0, right: 8 }}>
                      <XAxis dataKey="day" tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={(d: string) => d.slice(5)} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, color: "#e6edf3" }}
                        formatter={(v: number, name: string) => [v.toLocaleString(), name === "views" ? "Pageviews" : "Visitors"]} />
                      <Bar dataKey="views" fill="rgba(0,230,118,0.3)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="visitors" fill="#00E676" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="py-16 text-center">
                    <div className="text-4xl mb-3">📈</div>
                    <p className="text-sm text-muted-foreground">
                      {loadingTraffic ? "Loading traffic…" : "No visits recorded yet — tracking starts counting as soon as anyone loads the site."}
                    </p>
                  </div>
                )}
              </div>

              {/* Traffic → money: visitors, captured emails and sales on one timeline */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-display font-bold">What your traffic turned into</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Visitors per day, with the emails captured and sales made on those same days — so you can see which traffic days actually paid off.</p>
                {traffic && traffic.daily.length > 0 ? (() => {
                  const convByDay = new Map((traffic.conversionsDaily ?? []).map(c => [c.day, c]));
                  const data = traffic.daily.map(d => {
                    const c = convByDay.get(d.day);
                    return { day: d.day, visitors: d.visitors, captured: c?.captured ?? 0, sales: c?.orders ?? 0, revenue: (c?.revenueCents ?? 0) / 100 };
                  });
                  return (
                    <ResponsiveContainer width="100%" height={260}>
                      <ComposedChart data={data} margin={{ left: 0, right: 8 }}>
                        <XAxis dataKey="day" tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={false} tickLine={false}
                          tickFormatter={(d: string) => d.slice(5)} interval="preserveStartEnd" />
                        <YAxis yAxisId="v" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                        <YAxis yAxisId="m" orientation="right" tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} width={44}
                          tickFormatter={(v: number) => `$${v}`} />
                        <RechartsTooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, color: "#e6edf3" }}
                          formatter={(v: number, name: string) => name === "revenue" ? [`$${v.toLocaleString()}`, "Revenue"] : [v.toLocaleString(), name === "visitors" ? "Visitors" : name === "captured" ? "Emails captured" : "Sales"]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => v === "visitors" ? "Visitors" : v === "captured" ? "Emails captured" : v === "sales" ? "Sales" : "Revenue ($)"} />
                        <Bar yAxisId="v" dataKey="visitors" fill="rgba(0,230,118,0.35)" radius={[3, 3, 0, 0]} />
                        <Line yAxisId="v" dataKey="captured" stroke="#58a6ff" strokeWidth={2} dot={{ r: 2 }} />
                        <Line yAxisId="v" dataKey="sales" stroke="#f0883e" strokeWidth={2} dot={{ r: 2 }} />
                        <Line yAxisId="m" dataKey="revenue" stroke="#00E676" strokeWidth={2.5} dot={{ r: 2.5 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  );
                })() : <p className="text-sm text-muted-foreground">No visits recorded yet — this fills in as traffic arrives.</p>}
              </div>

              {/* Last 48 hours, hour by hour */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-display font-bold">Last 48 hours</h3>
                  <span className="text-xs text-muted-foreground">hour by hour, Central time</span>
                </div>
                {traffic && (traffic.hourly?.length ?? 0) > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={traffic.hourly} margin={{ left: 0, right: 8 }}>
                      <XAxis dataKey="hour" tick={{ fill: "#8b949e", fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={(h: string) => h.slice(5).replace(" ", " · ")} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: "#8b949e", fontSize: 11 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                      <RechartsTooltip contentStyle={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 8, color: "#e6edf3" }}
                        formatter={(v: number, name: string) => [v.toLocaleString(), name === "views" ? "Pageviews" : "Visitors"]} />
                      <Bar dataKey="views" fill="rgba(0,230,118,0.3)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="visitors" fill="#00E676" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-muted-foreground">No visits in the last 48 hours yet.</p>}
              </div>

              {/* Campaign performance — every tagged link you've shared */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-display font-bold">Campaign performance</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Every tagged link you've shared — landing-page links from the Social tab show up as "lp-…". If a campaign is missing, nobody has clicked that link yet.</p>
                {traffic && (traffic.campaigns?.length ?? 0) > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="py-2 pr-3">Campaign</th><th className="py-2 pr-3">Shared on</th>
                          <th className="py-2 pr-3">Visits</th><th className="py-2 pr-3">People</th><th className="py-2">Last click</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(traffic.campaigns ?? []).map((c, i) => {
                          const lp = c.campaign.startsWith("lp-") ? SOCIAL_LANDING_PAGES.find(l => l.slug === c.campaign.slice(3)) : null;
                          return (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2 pr-3">
                                <span className="font-semibold text-foreground">{lp ? `${lp.emoji} ${lp.name}` : c.campaign}</span>
                                {lp && <span className="text-xs text-muted-foreground font-mono"> · /go/{lp.slug}</span>}
                              </td>
                              <td className="py-2 pr-3 text-muted-foreground">{c.source}</td>
                              <td className="py-2 pr-3 font-bold text-primary">{c.sessions.toLocaleString()}</td>
                              <td className="py-2 pr-3 text-muted-foreground">{c.visitors.toLocaleString()}</td>
                              <td className="py-2 whitespace-nowrap text-muted-foreground">
                                {new Date(c.lastVisit).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-muted-foreground">No tagged-link clicks yet — copy a landing-page link from the Social tab and share it; every click lands here with its campaign name.</p>}
              </div>

              {/* Acquisition channels — the "where is my traffic from" answer */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Share2 className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-display font-bold">Where your traffic comes from</h3>
                  <span className="text-xs text-muted-foreground">every visit, sorted into channels</span>
                </div>
                {traffic && (traffic.channels?.length ?? 0) > 0 ? (() => {
                  const total = Math.max(1, traffic.channels.reduce((s, c) => s + c.sessions, 0));
                  return (
                    <div className="space-y-3">
                      {traffic.channels.map((c, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm text-foreground font-semibold">{c.channel}</span>
                            <span className="text-xs shrink-0">
                              <span className="font-bold text-primary">{c.sessions.toLocaleString()} visit{c.sessions === 1 ? "" : "s"}</span>
                              <span className="text-muted-foreground"> · {c.visitors.toLocaleString()} {c.visitors === 1 ? "person" : "people"} · {Math.round((c.sessions / total) * 100)}%</span>
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.max(2, (c.sessions / total) * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })() : <p className="text-sm text-muted-foreground">No visits yet — this fills in as traffic arrives.</p>}
              </div>

              {/* Pages / referrers / audience */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Top pages</h3>
                  {traffic && traffic.topPages.length > 0 ? (
                    <div className="space-y-2">
                      {traffic.topPages.map((p, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-foreground truncate font-mono">{p.path}</span>
                          <span className="text-xs shrink-0">
                            <span className="font-bold text-primary">{p.views.toLocaleString()}</span>
                            <span className="text-muted-foreground"> · {p.visitors.toLocaleString()} ppl</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No data yet</p>}
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Where visitors come from</h3>
                  {traffic && traffic.referrers.length > 0 ? (
                    <div className="space-y-2">
                      {traffic.referrers.map((r, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-foreground truncate">{r.referrer}</span>
                          <span className="text-xs font-bold text-primary shrink-0">{r.views.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Direct traffic only so far — no outside referrers yet.</p>}
                  {traffic && traffic.sources.length > 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                      <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Campaigns (UTM)</h3>
                      <div className="space-y-2">
                        {traffic.sources.map((s, i) => (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <span className="text-sm text-foreground truncate">{s.source}</span>
                            <span className="text-xs font-bold text-primary shrink-0">{s.visitors.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Devices</h3>
                  {traffic && traffic.devices.length > 0 ? (
                    <div className="space-y-3">
                      {(() => {
                        const totalDev = Math.max(1, traffic.devices.reduce((s, d) => s + d.visitors, 0));
                        return traffic.devices.map((d, i) => (
                          <div key={i}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm text-foreground capitalize">{d.device}</span>
                              <span className="text-xs font-bold text-primary">{d.visitors.toLocaleString()} · {Math.round((d.visitors / totalDev) * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${(d.visitors / totalDev) * 100}%` }} />
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No data yet</p>}
                </div>
              </div>

              {/* Engagement + new vs returning */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {(() => {
                  const e = traffic?.engagement;
                  const nr = traffic?.newVsReturning;
                  const nrTotal = Math.max(1, (nr?.new ?? 0) + (nr?.returning ?? 0));
                  const avgMin = traffic?.avgSessionMinutes ?? 0;
                  const cards = [
                    { label: "Bounce rate", value: e ? `${Math.round(e.bounceRate * 100)}%` : "…", sub: "left after one page", icon: <TrendingUp className="w-4 h-4 text-red-400" /> },
                    { label: "Pages / session", value: e ? e.pagesPerSession.toFixed(1) : "…", sub: `${(e?.sessions ?? 0).toLocaleString()} sessions`, icon: <Eye className="w-4 h-4 text-green-400" /> },
                    { label: "Time on site", value: traffic ? (avgMin >= 1 ? `${avgMin.toFixed(1)} min` : "<1 min") : "…", sub: "average visit that browsed", icon: <Calendar className="w-4 h-4 text-yellow-400" /> },
                    { label: "New visitors", value: nr ? nr.new.toLocaleString() : "…", sub: `${Math.round((nr?.new ?? 0) / nrTotal * 100)}% of visitors`, icon: <Users className="w-4 h-4 text-primary" /> },
                    { label: "Returning", value: nr ? nr.returning.toLocaleString() : "…", sub: `${Math.round((nr?.returning ?? 0) / nrTotal * 100)}% of visitors`, icon: <Users className="w-4 h-4 text-blue-400" /> },
                  ];
                  return cards.map((c, i) => (
                    <div key={i} className="rounded-xl p-4 border bg-card border-border">
                      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">{c.icon} {c.label}</div>
                      <div className="text-2xl font-display font-bold text-foreground">{c.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
                    </div>
                  ));
                })()}
              </div>

              {/* Entry pages / Exit pages / Countries */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Entry pages</h3>
                  {traffic && traffic.entryPages.length > 0 ? (
                    <div className="space-y-2">
                      {traffic.entryPages.map((p, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-foreground truncate font-mono">{p.path}</span>
                          <span className="text-xs font-bold text-primary shrink-0">{p.sessions.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No data yet</p>}
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Exit pages</h3>
                  {traffic && traffic.exitPages.length > 0 ? (
                    <div className="space-y-2">
                      {traffic.exitPages.map((p, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-foreground truncate font-mono">{p.path}</span>
                          <span className="text-xs font-bold text-primary shrink-0">{p.sessions.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No data yet</p>}
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Countries</h3>
                  {(() => {
                    const rows = (traffic?.countries ?? []).filter(c => c.country && c.country !== "—");
                    if (rows.length === 0) {
                      return <p className="text-sm text-muted-foreground">Locations fill in as new visits arrive (looked up automatically from the visitor's IP).</p>;
                    }
                    const flag = (cc: string) => /^[a-z]{2}$/i.test(cc)
                      ? cc.toUpperCase().replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)))
                      : "🌐";
                    return (
                      <div className="space-y-2">
                        {rows.map((c, i) => (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <span className="text-sm text-foreground truncate">{flag(c.country)} {c.country}</span>
                            <span className="text-xs font-bold text-primary shrink-0">{c.visitors.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Landing pages / Browsers / Operating systems */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Landing pages (/go links)</h3>
                  {traffic && (traffic.landingPages?.length ?? 0) > 0 ? (
                    <div className="space-y-2">
                      {(traffic.landingPages ?? []).map((p, i) => {
                        const lp = SOCIAL_LANDING_PAGES.find(l => `/go/${l.slug}` === p.path);
                        return (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <span className="text-sm text-foreground truncate">{lp ? `${lp.emoji} ${lp.name}` : <span className="font-mono">{p.path}</span>}</span>
                            <span className="text-xs shrink-0">
                              <span className="font-bold text-primary">{p.views.toLocaleString()}</span>
                              <span className="text-muted-foreground"> · {p.visitors.toLocaleString()} ppl</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No landing-page visits yet — share the /go links from the Social tab.</p>}
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Browsers</h3>
                  {traffic && (traffic.browsers?.length ?? 0) > 0 ? (() => {
                    const rows = traffic.browsers ?? [];
                    const total = Math.max(1, rows.reduce((s, b) => s + b.visitors, 0));
                    return (
                      <div className="space-y-3">
                        {rows.map((b, i) => (
                          <div key={i}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm text-foreground capitalize">{b.browser}</span>
                              <span className="text-xs font-bold text-primary">{b.visitors.toLocaleString()} · {Math.round((b.visitors / total) * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${(b.visitors / total) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })() : <p className="text-sm text-muted-foreground">No data yet</p>}
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Operating systems</h3>
                  {traffic && (traffic.osList?.length ?? 0) > 0 ? (() => {
                    const rows = traffic.osList ?? [];
                    const total = Math.max(1, rows.reduce((s, o) => s + o.visitors, 0));
                    return (
                      <div className="space-y-3">
                        {rows.map((o, i) => (
                          <div key={i}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm text-foreground">{o.os}</span>
                              <span className="text-xs font-bold text-primary">{o.visitors.toLocaleString()} · {Math.round((o.visitors / total) * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${(o.visitors / total) * 100}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })() : <p className="text-sm text-muted-foreground">No data yet</p>}
                </div>
              </div>

              {/* Hour × day-of-week heatmap */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-display font-bold">When visitors show up</h3>
                  <span className="text-xs text-muted-foreground">(Central time)</span>
                </div>
                {traffic && traffic.heatmap.length > 0 ? (
                  <div className="overflow-x-auto">
                    <div className="min-w-[600px]">
                      <div className="flex items-center gap-1 mb-1 pl-9">
                        {Array.from({ length: 24 }).map((_, h) => (
                          <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">{h % 6 === 0 ? `${h}:00` : ""}</div>
                        ))}
                      </div>
                      {(() => {
                        const cells = traffic.heatmap;
                        const max = Math.max(1, ...cells.map(c => c.views));
                        const lookup = new Map(cells.map(c => [`${c.dow}-${c.hour}`, c.views]));
                        const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                        return dow.map((lbl, d) => (
                          <div key={d} className="flex items-center gap-1 mb-1">
                            <div className="w-8 text-[10px] text-muted-foreground shrink-0">{lbl}</div>
                            {Array.from({ length: 24 }).map((_, h) => {
                              const v = lookup.get(`${d}-${h}`) ?? 0;
                              return (
                                <div key={h} title={`${lbl} ${h}:00 — ${v} view${v === 1 ? "" : "s"}`}
                                  className="flex-1 h-5 rounded-sm"
                                  style={{ background: v ? `rgba(0,230,118,${0.15 + (v / max) * 0.85})` : "rgba(255,255,255,0.04)" }} />
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No visits recorded yet — this fills in as traffic arrives.</p>
                )}
              </div>

              {/* Recent visitors — one row per session, newest first */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-display font-bold">Recent visitors</h3>
                  <span className="text-xs text-muted-foreground">the last 30 visits — where they came from and what they looked at</span>
                </div>
                {traffic && (traffic.recentSessions?.length ?? 0) > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="py-2 pr-3">When</th><th className="py-2 pr-3">Came from</th>
                          <th className="py-2 pr-3">Landed on</th><th className="py-2 pr-3">Pages</th>
                          <th className="py-2 pr-3">Stayed</th><th className="py-2 pr-3">Device</th><th className="py-2">Where</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traffic.recentSessions.map((v, i) => {
                          const flag = (cc: string) => /^[a-z]{2}$/i.test(cc)
                            ? cc.toUpperCase().replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)))
                            : "🌐";
                          const detail = v.referrer
                            ? v.referrer.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]
                            : v.source;
                          return (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                                {new Date(v.startedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                              </td>
                              <td className="py-2 pr-3">
                                <span className="font-semibold text-foreground">{v.channel}</span>
                                {detail && detail.toLowerCase() !== v.channel.toLowerCase() && (
                                  <span className="text-xs text-muted-foreground"> · {detail}</span>
                                )}
                              </td>
                              <td className="py-2 pr-3 font-mono text-xs max-w-[220px] truncate" title={v.paths.join("  →  ")}>
                                {v.paths[0] ?? "—"}
                              </td>
                              <td className="py-2 pr-3">
                                <span className="font-bold text-primary">{v.views}</span>
                                {v.paths.length > 1 && <span className="text-xs text-muted-foreground" title={v.paths.join("  →  ")}> · {v.paths.slice(1, 3).join(", ")}{v.paths.length > 3 ? "…" : ""}</span>}
                              </td>
                              <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{v.minutes >= 1 ? `${v.minutes} min` : "<1 min"}</td>
                              <td className="py-2 pr-3 capitalize text-muted-foreground">{v.device ?? "—"}</td>
                              <td className="py-2">{v.country ? `${flag(v.country)} ${v.country}` : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="text-sm text-muted-foreground">No visits yet — every visitor will show up here with their source, pages and location.</p>}
              </div>
            </motion.div>
          )}

          {/* ── SOCIAL AUTO-POSTER TAB ────────────────────────────────────── */}
          {activeTab === "social" && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">

              {/* Header */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h2 className="text-lg font-display font-bold">Social Auto-Poster</h2>
                  {loadingSocial && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={socialSyncStats} disabled={syncingStats || !social?.facebookConnected}
                    title={social?.facebookConnected ? "Pull fresh likes/comments/shares from Facebook" : "Connect Facebook first"}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-muted text-foreground disabled:opacity-50 hover:opacity-80 transition-opacity">
                    <BarChart2 className={`w-4 h-4 ${syncingStats ? "animate-pulse" : ""}`} />
                    {syncingStats ? "Refreshing…" : "Refresh stats"}
                  </button>
                  <button onClick={socialGenerate} disabled={generatingSocial || !social?.aiConfigured}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity">
                    {generatingSocial ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generatingSocial ? "Writing posts…" : "Generate 5 posts"}
                  </button>
                  <button onClick={socialGenerateFreeTool} disabled={generatingFreeTool || !social?.aiConfigured}
                    title="Write ads for the FREE Chrome extension — they carry the Web Store install link and auto-rotate in ~1 of every 3 daily posts"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-muted text-foreground disabled:opacity-50 hover:opacity-80 transition-opacity">
                    {generatingFreeTool ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>🧩</>}
                    {generatingFreeTool ? "Writing posts…" : "Free-tool posts"}
                  </button>
                </div>
              </div>

              {socialMsg && (
                <div className={`text-sm px-4 py-2 rounded-lg border ${socialMsg.startsWith("✓") ? "bg-primary/5 border-primary/30 text-primary" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
                  {socialMsg}
                </div>
              )}

              {/* Status + controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className={`rounded-xl p-4 border ${social?.facebookConnected ? "bg-primary/5 border-primary/30" : "bg-card border-border"}`}>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Globe className="w-4 h-4 text-blue-400" /> Facebook Page</div>
                  {social?.facebookConnected ? (
                    <>
                      <div className="text-lg font-display font-bold text-primary">✓ {social.pageName || "Connected"}</div>
                      {social.pageFollowers !== null && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="text-foreground font-semibold">{social.pageFollowers.toLocaleString()}</span> followers
                          {social.pageLikes !== null && <> · <span className="text-foreground font-semibold">{social.pageLikes.toLocaleString()}</span> page likes</>}
                        </div>
                      )}
                      <button onClick={async () => { await adminFetch(`${basePath}/api/admin/social/fb/disconnect`, { method: "POST" }); loadSocial(); }}
                        className="text-xs text-muted-foreground hover:text-red-400 mt-1">Disconnect</button>
                    </>
                  ) : (
                    <>
                      {/* A plain <a> can't carry the admin auth header, so fetch
                          the dialog URL (authorized) and navigate the browser. */}
                      <button
                        onClick={async () => {
                          setSocialMsg(null);
                          try {
                            const r = await adminFetch(`${basePath}/api/admin/social/fb/connect-url`);
                            const d = await r.json().catch(() => ({}));
                            if (r.ok && d.url) window.location.href = d.url;
                            else setSocialMsg(d.error || "Couldn't start Facebook connect — check the app ID/secret.");
                          } catch {
                            setSocialMsg("Couldn't start Facebook connect — please try again.");
                          }
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:opacity-90 transition-opacity">
                        <Globe className="w-4 h-4" /> Connect Facebook
                      </button>
                      <div className="text-xs text-muted-foreground mt-2">One click + Approve on Facebook — that's it</div>
                    </>
                  )}
                </div>
                <div className={`rounded-xl p-4 border ${social?.tiktokConnected ? "bg-primary/5 border-primary/30" : "bg-card border-border"}`}>
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><span className="text-sm">🎵</span> TikTok</div>
                  {social?.tiktokConnected ? (
                    <>
                      <div className="text-lg font-display font-bold text-primary">✓ {social.tiktokAccountName || "Connected"}</div>
                      <div className="text-xs text-muted-foreground mt-1">Daily ad cross-posts as a TikTok photo post</div>
                      <button onClick={async () => { await adminFetch(`${basePath}/api/admin/social/tiktok/disconnect`, { method: "POST" }); loadSocial(); }}
                        className="text-xs text-muted-foreground hover:text-red-400 mt-1">Disconnect</button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={async () => {
                          setSocialMsg(null);
                          try {
                            const r = await adminFetch(`${basePath}/api/admin/social/tiktok/connect-url`);
                            const d = await r.json().catch(() => ({}));
                            if (r.ok && d.url) window.location.href = d.url;
                            else setSocialMsg(d.error || "Couldn't start TikTok connect — paste your Client Key/Secret below first.");
                          } catch {
                            setSocialMsg("Couldn't start TikTok connect — please try again.");
                          }
                        }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-opacity">
                        🎵 Connect TikTok
                      </button>
                      <div className="text-xs text-muted-foreground mt-2">{social?.tiktokAppConfigured ? "One click + Authorize on TikTok" : "Needs your TikTok app keys — see setup below"}</div>
                    </>
                  )}
                </div>
                <div className="rounded-xl p-4 border bg-card border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><Zap className="w-4 h-4 text-yellow-400" /> Auto-posting</div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => social && socialSettingsSave({ enabled: !social.settings.enabled })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${social?.settings.enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {social ? (social.settings.enabled ? "ON — 1/day" : "PAUSED") : "…"}
                    </button>
                    {social && (
                      <select value={social.settings.postHourUtc}
                        onChange={(e) => socialSettingsSave({ postHourUtc: Number(e.target.value) })}
                        className="bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-foreground">
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>at {socialHourLabel(h)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">Posts one queued post daily at this time (your timezone)</div>
                </div>
                <div className="rounded-xl p-4 border bg-card border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2"><RefreshCw className="w-4 h-4 text-green-400" /> Keep queue full</div>
                  <button onClick={() => social && socialSettingsSave({ autoRefill: !social.settings.autoRefill })}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${social?.settings.autoRefill ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {social ? (social.settings.autoRefill ? "AUTO-REFILL ON" : "AUTO-REFILL OFF") : "…"}
                  </button>
                  <div className="text-xs text-muted-foreground mt-2">AI writes 5 more whenever fewer than 3 are queued</div>
                </div>
              </div>

              {/* High-converting landing pages — links to drop into posts, ads & DMs */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Share2 className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-display font-bold">Landing Pages</h3>
                  <span className="text-xs text-muted-foreground">{SOCIAL_LANDING_PAGES.length} sales angles, ready to share</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Each link is a focused sales page with its own angle — no nav, straight to checkout. Copy a link
                  into any post, ad, or DM (links carry UTM tags, so visits & sales show up in the Traffic tab), or
                  copy a ready-made caption that already includes the link.
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {SOCIAL_LANDING_PAGES.map((lp) => (
                    <div key={lp.slug} className="rounded-xl border border-border bg-background/40 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{lp.emoji}</span>
                        <span className="font-semibold text-sm">{lp.name}</span>
                        <span className="ml-auto font-mono text-[11px] text-muted-foreground">/go/{lp.slug}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{lp.angle}</p>
                      {/* The variant's ad creative (served from /go/<slug>.jpg —
                          an owner upload if set, else the bundled default). This
                          is the picture crawlers use for the share/preview card. */}
                      <div className="relative mb-3">
                        <img
                          src={`${basePath}/go/${lp.slug}.jpg?v=${imgBust[lp.slug] ?? 0}`}
                          alt={`${lp.name} ad creative`}
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.15"; }}
                          className="w-full aspect-[3/2] object-cover rounded-lg border border-border"
                        />
                        {social?.customImages?.includes(lp.slug) && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary text-primary-foreground shadow">
                            Your picture
                          </span>
                        )}
                        {lpImgBusy === lp.slug && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/70 rounded-lg text-xs font-semibold">
                            {lpImgBusyText}
                          </div>
                        )}
                      </div>
                      {lpImgErr?.slug === lp.slug && (
                        <div className="text-xs px-3 py-2 rounded-lg border bg-red-500/10 border-red-500/30 text-red-400 mb-2">
                          {lpImgErr.msg}
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <button
                          onClick={() => lpImgGenerate(lp)}
                          disabled={lpImgBusy === lp.slug}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 text-primary hover:bg-primary/25 transition-colors ${lpImgBusy === lp.slug ? "opacity-50 pointer-events-none" : ""}`}>
                          🪄 Change picture
                        </button>
                        <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer bg-muted text-foreground hover:opacity-80 transition-opacity ${lpImgBusy === lp.slug ? "opacity-50 pointer-events-none" : ""}`}>
                          ⬆️ Upload your own
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) lpImgUpload(lp.slug, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                        {social?.customImages?.includes(lp.slug) && (
                          <button onClick={() => lpImgRevert(lp.slug)} disabled={lpImgBusy === lp.slug}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80 transition-opacity">
                            ↺ Use default
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => lpCopy(lp.slug, lpUrl(lp.slug))}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                          <Copy className="w-3 h-3" /> {lpCopied === lp.slug ? "Copied!" : "Copy link"}
                        </button>
                        <a href={`${basePath}/go/${lp.slug}`} target="_blank" rel="noopener"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80 transition-opacity">
                          <ExternalLink className="w-3 h-3" /> Preview
                        </a>
                        <a href={`${basePath}/go/${lp.slug}.jpg?v=${imgBust[lp.slug] ?? 0}`} download={`${lp.slug}-ad.jpg`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80 transition-opacity">
                          ⬇️ Ad picture
                        </a>
                        {lp.captions.map((cap, ci) => (
                          <button key={ci} onClick={() => lpCopy(`${lp.slug}-cap-${ci}`, `${cap}\n\n${lpUrl(lp.slug)}`)}
                            title={cap}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80 transition-opacity">
                            📋 {lpCopied === `${lp.slug}-cap-${ci}` ? "Copied!" : `Caption ${ci + 1}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Facebook setup — only until connected */}
              {social && !social.facebookConnected && (
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-sm font-display font-bold mb-3">🔌 Connect your Facebook Page (one-time)</h3>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>On <span className="font-mono text-foreground">developers.facebook.com</span>, open your app → <span className="text-foreground">Add Product</span> → add <span className="text-foreground">Facebook Login</span> → <span className="text-foreground">Settings</span>.</li>
                    <li>Paste this into <span className="text-foreground">Valid OAuth Redirect URIs</span> and save:
                      <div className="font-mono text-xs text-foreground bg-background border border-border rounded-lg px-3 py-2 mt-1 break-all select-all">{social.redirectUri}</div>
                    </li>
                    <li>Come back here and hit the blue <span className="text-foreground">Connect Facebook</span> button above — log in, tap <span className="text-foreground">Approve</span>, done.</li>
                  </ol>
                  <p className="text-xs text-muted-foreground mt-3">
                    {social.appConfigured
                      ? "Your app credentials are already on file. Until you connect, the AI still fills the queue below so you can review posts."
                      : "⚠️ App credentials are missing — the Connect button won't work until FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are set."}
                  </p>
                </div>
              )}

              {/* TikTok setup — only until connected */}
              {social && !social.tiktokConnected && (
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-sm font-display font-bold mb-3">🎵 Connect TikTok (one-time)</h3>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>On <span className="font-mono text-foreground">developers.tiktok.com</span>, sign in with your TikTok account → <span className="text-foreground">Manage apps</span> → <span className="text-foreground">Connect an app</span>. Fill in the basics (any name/icon works).</li>
                    <li>Under <span className="text-foreground">Add products</span>, add <span className="text-foreground">Login Kit</span> and <span className="text-foreground">Content Posting API</span>, and request the <span className="font-mono text-xs text-foreground">user.info.basic</span> + <span className="font-mono text-xs text-foreground">video.publish</span> scopes.</li>
                    <li>In Login Kit settings, paste this as the <span className="text-foreground">Redirect URI</span> and save:
                      <div className="font-mono text-xs text-foreground bg-background border border-border rounded-lg px-3 py-2 mt-1 break-all select-all">{social.tiktokRedirectUri}</div>
                    </li>
                    <li>Under Content Posting API, <span className="text-foreground">verify your domain</span> (<span className="font-mono text-xs text-foreground">mapleadextractor.net</span>) — TikTok downloads the ad pictures from the site, so it has to trust the domain.</li>
                    <li>Copy the app's <span className="text-foreground">Client Key</span> and <span className="text-foreground">Client Secret</span> into the boxes here and Save:
                      <div className="flex flex-col sm:flex-row gap-2 mt-2">
                        <input value={tkKey} onChange={(e) => setTkKey(e.target.value)} placeholder="Client Key"
                          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono" />
                        <input value={tkSecret} onChange={(e) => setTkSecret(e.target.value)} placeholder="Client Secret" type="password"
                          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono" />
                        <button
                          onClick={async () => {
                            if (!tkKey.trim() || !tkSecret.trim()) { setSocialMsg("Paste both the Client Key and the Client Secret first."); return; }
                            await socialSettingsSave({ tiktokClientKey: tkKey.trim(), tiktokClientSecret: tkSecret.trim() });
                            setTkKey(""); setTkSecret("");
                            setSocialMsg("✓ TikTok app keys saved — now hit Connect TikTok above.");
                          }}
                          className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                          Save
                        </button>
                      </div>
                    </li>
                    <li>Hit the <span className="text-foreground">Connect TikTok</span> button above — log in, tap <span className="text-foreground">Authorize</span>, done.</li>
                  </ol>
                  <p className="text-xs text-muted-foreground mt-3">
                    {social.tiktokAppConfigured
                      ? "Your TikTok app keys are on file — just hit Connect TikTok above."
                      : "Until the keys are saved, the Connect button can't start the TikTok login."}
                    {" "}Heads-up: until TikTok reviews your app (Submit for review in the developer portal), posts publish as <span className="text-foreground">private (Self only)</span> — connect anyway, submit the review, and they go public automatically once approved.
                  </p>
                </div>
              )}

              {/* AI posting assistant — chat box that edits the queue */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-display font-bold">AI Posting Assistant</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Tell it what to post and it edits the queue for you — try “write a post about the $29 starter pack”, “make the next post shorter”, or “rewrite anything that sounds fake”.
                </p>
                {chatMsgs.length > 0 && (
                  <div className="space-y-3 max-h-80 overflow-y-auto mb-4 pr-1">
                    {chatMsgs.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary/15 text-foreground" : "bg-background/60 border border-border text-foreground"}`}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                    {chatBusy && (
                      <div className="flex justify-start">
                        <div className="rounded-xl px-4 py-2.5 text-sm bg-background/60 border border-border text-muted-foreground flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Working on it…
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); chatSend(); } }}
                    placeholder={social?.aiConfigured ? "e.g. write a post about how fast the lists arrive" : "Add an OpenAI key (CHAT_GPT_API) in Secrets first"}
                    disabled={!social?.aiConfigured || chatBusy}
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground disabled:opacity-50" />
                  <button onClick={chatSend} disabled={!social?.aiConfigured || chatBusy || !chatInput.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity">
                    <Send className="w-4 h-4" /> Send
                  </button>
                </div>
              </div>

              {/* Queue */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-display font-bold">Up next</h3>
                  <span className="text-xs text-muted-foreground">{social ? `${social.queue.length} queued — oldest posts first` : ""}</span>
                </div>
                {social && social.queue.length > 0 ? (
                  <div className="space-y-3">
                    {social.queue.map((p, i) => (
                      <div key={p.id} className={`rounded-xl border p-4 ${i === 0 ? "border-primary/30 bg-primary/5" : "border-border bg-background/40"}`}>
                        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                          {i === 0 && <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">next up</span>}
                          {p.campaign === "freetool" && <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold">🧩 Free extension</span>}
                          {p.note && <span className="truncate">💡 {p.note}</span>}
                        </div>
                        {socialEditId === p.id ? (
                          <textarea value={socialDraft} onChange={(e) => setSocialDraft(e.target.value)} rows={5}
                            className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground font-normal" />
                        ) : (
                          <p className="text-sm text-foreground whitespace-pre-wrap">{p.body}</p>
                        )}
                        {p.hasImage && (
                          <img src={`${basePath}/api/admin/social/${p.id}/image?v=${imgVersion}`} alt="Post graphic"
                            className="mt-3 rounded-lg border border-border max-h-44 w-auto" />
                        )}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {socialEditId === p.id ? (
                            <>
                              <button onClick={() => socialSaveEdit(p.id)} disabled={socialBusyId === p.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50">Save</button>
                              <button onClick={() => setSocialEditId(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => socialPostNow(p.id)} disabled={socialBusyId === p.id || !social.facebookConnected}
                                title={social.facebookConnected ? "Publish to Facebook right now" : "Connect Facebook first"}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-40">
                                {socialBusyId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Post now
                              </button>
                              {social.tiktokConnected && (
                                <button onClick={() => socialTikTokNow(p.id)} disabled={socialBusyId === p.id}
                                  title="Publish this ad to TikTok right now (photo post)"
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-foreground text-background disabled:opacity-40 hover:opacity-90">
                                  {socialBusyId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <>🎵</>} TikTok now
                                </button>
                              )}
                              <button onClick={() => socialGenImage(p.id)} disabled={imageBusyId === p.id || !social.aiConfigured}
                                title="AI draws a branded graphic for this post — image posts get 2-3x the reach"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground disabled:opacity-40 hover:opacity-80">
                                {imageBusyId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <>🎨</>}
                                {imageBusyId === p.id ? "Drawing…" : p.hasImage ? "New image" : "Add image"}
                              </button>
                              {p.hasImage && (
                                <button onClick={() => socialRemoveImage(p.id)} disabled={imageBusyId === p.id}
                                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-red-400 disabled:opacity-50">No image</button>
                              )}
                              <button onClick={() => { setSocialEditId(p.id); setSocialDraft(p.body); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Edit</button>
                              <button onClick={() => socialDelete(p.id)} disabled={socialBusyId === p.id}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50">
                                <Trash2 className="w-3 h-3" /> Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <div className="text-4xl mb-3">📣</div>
                    <p className="text-sm text-muted-foreground">
                      {loadingSocial ? "Loading…" : social?.aiConfigured ? "Queue is empty — hit “Generate 5 posts” and the AI will write them." : "Add an OpenAI key (CHAT_GPT_API) in Secrets to enable AI post writing."}
                    </p>
                  </div>
                )}
              </div>

              {/* Facebook Groups — assisted posting (Meta killed the Groups API in 2024) */}
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <h3 className="text-lg font-display font-bold">Group Blaster</h3>
                    {social && social.groups.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {social.groups.length} groups · {social.groups.reduce((s, g) => s + g.postCount, 0)} posts dropped
                        {social.groups.filter(groupIsDue).length > 0 && (
                          <span className="ml-1 text-orange-400 font-semibold">· {social.groups.filter(groupIsDue).length} due now</span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={groupDiscover} disabled={discoveringGroups || !social?.aiConfigured}
                      title="AI web search finds real public Facebook groups that fit this product's audience"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-muted text-foreground disabled:opacity-50 hover:opacity-80 transition-opacity">
                      {discoveringGroups ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      {discoveringGroups ? "Searching…" : "Find groups"}
                    </button>
                    <button onClick={groupGenerate} disabled={generatingGroupPosts || !social?.aiConfigured}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity">
                      {generatingGroupPosts ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {generatingGroupPosts ? "Writing…" : "Write 5 group posts"}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Facebook shut off group posting for apps, so nothing can fully automate it without getting you banned. This is the next best thing:
                  <span className="text-foreground font-semibold"> Find groups</span> has AI search the web for real, active public groups that fit
                  your audience so you don't have to go hunting — join each one once, then one click
                  <span className="text-foreground font-semibold"> copies the next post + opens the group</span> — you just paste and hit Post. ~5 seconds per group.
                </p>

                {/* Next group post on deck */}
                {social && social.groupQueue.length > 0 && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">on deck — copied on your next click</span>
                      <span>{social.groupQueue.length} group posts queued</span>
                      {social.groupQueue[0].note && <span className="truncate">💡 {social.groupQueue[0].note}</span>}
                    </div>
                    {socialEditId === social.groupQueue[0].id ? (
                      <>
                        <textarea value={socialDraft} onChange={(e) => setSocialDraft(e.target.value)} rows={5}
                          className="w-full bg-background border border-border rounded-lg p-3 text-sm text-foreground font-normal" />
                        <div className="flex items-center gap-2 mt-2">
                          <button onClick={() => socialSaveEdit(social.groupQueue[0].id)} disabled={socialBusyId === social.groupQueue[0].id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50">Save</button>
                          <button onClick={() => setSocialEditId(null)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{social.groupQueue[0].body}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <button onClick={() => { navigator.clipboard.writeText(tagPostLinks(social.groupQueue[0].body, social.groupQueue[0].id)).catch(() => {}); setSocialMsg("✓ Copied — paste it wherever you like"); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground hover:opacity-80">
                            <Copy className="w-3 h-3" /> Copy only
                          </button>
                          <button onClick={() => { setSocialEditId(social.groupQueue[0].id); setSocialDraft(social.groupQueue[0].body); }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Edit</button>
                          <button onClick={() => socialDelete(social.groupQueue[0].id)} disabled={socialBusyId === social.groupQueue[0].id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 disabled:opacity-50">
                            <Trash2 className="w-3 h-3" /> Skip
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {social && social.groupQueue.length === 0 && (
                  <div className="rounded-xl border border-border bg-background/40 p-4 mb-4 text-sm text-muted-foreground">
                    No group posts queued — hit <span className="text-foreground font-semibold">Write 5 group posts</span> and the AI will draft
                    link-free, mod-safe posts (groups delete anything that smells like an ad).
                  </div>
                )}

                {/* The rotation — least-recently-posted first */}
                {social && social.groups.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {social.groups.map((g) => {
                      const d = daysSince(g.lastPostedAt);
                      return (
                        <div key={g.id} className={`flex items-center gap-3 rounded-xl border p-3 ${groupIsDue(g) ? "border-orange-400/30 bg-orange-400/5" : "border-border bg-background/40"}`}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-foreground hover:text-primary truncate">
                                {g.name} <ExternalLink className="w-3 h-3 inline opacity-50" />
                              </a>
                              {groupIsDue(g) && <span className="px-2 py-0.5 rounded-full bg-orange-400/15 text-orange-400 text-[10px] font-bold uppercase">due</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {d === null ? "never posted" : d === 0 ? "posted today" : `last posted ${d}d ago`} · {g.postCount} total
                            </div>
                          </div>
                          <button onClick={() => groupCopyOpen(g)} disabled={groupBusyId === g.id || !social.groupQueue.length}
                            title={social.groupQueue.length ? "Copy the on-deck post and open this group" : "Write group posts first"}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity whitespace-nowrap">
                            {groupBusyId === g.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} Copy & Open
                          </button>
                          <button onClick={() => groupDelete(g.id)} disabled={groupBusyId === g.id}
                            className="p-2 rounded-lg text-muted-foreground hover:text-red-400 disabled:opacity-50" title="Remove from rotation">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add a group */}
                <div className="flex items-center gap-2 flex-wrap">
                  <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name (e.g. Lead Gen Pros)"
                    className="flex-1 min-w-[180px] bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
                  <input value={groupUrl} onChange={(e) => setGroupUrl(e.target.value)} placeholder="https://www.facebook.com/groups/…"
                    className="flex-[2] min-w-[240px] bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono" />
                  <button onClick={groupAdd} disabled={addingGroup || !groupName.trim() || !groupUrl.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-muted text-foreground disabled:opacity-40 hover:opacity-80 transition-opacity">
                    {addingGroup ? "Adding…" : "+ Add group"}
                  </button>
                </div>
                {social && social.groups.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Hit <span className="text-foreground font-semibold">Find groups</span> above to have AI search out real public groups for you,
                    or add one manually if you already know it. The rotation sorts by least-recently-posted and flags who's due.
                  </p>
                )}
              </div>

              {/* History */}
              {social && social.history.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-primary" />
                    <h3 className="text-lg font-display font-bold">Posted & failed</h3>
                  </div>
                  <div className="space-y-3">
                    {social.history.map((p) => (
                      <div key={p.id} className="rounded-xl border border-border bg-background/40 p-4">
                        <div className="flex items-center gap-2 mb-2 text-xs">
                          {p.status === "posted" ? (
                            <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">posted</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold">failed</span>
                          )}
                          {p.platform === "facebook_group" && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold">group</span>
                          )}
                          {p.platform === "tiktok" && (
                            <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-400 font-semibold">🎵 TikTok</span>
                          )}
                          {p.campaign === "freetool" && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold">🧩 free ext</span>
                          )}
                          {p.postedAt && <span className="text-muted-foreground">{new Date(p.postedAt).toLocaleString()}</span>}
                          {p.externalUrl && (
                            <a href={p.externalUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              {p.platform === "tiktok" ? "view on TikTok ↗" : "view on Facebook ↗"}
                            </a>
                          )}
                          {statsLine(p)}
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{p.body}</p>
                        {p.status === "failed" && (
                          <div className="flex items-center gap-3 mt-2">
                            {p.error && <span className="text-xs text-red-400">{p.error}</span>}
                            <button onClick={() => socialRequeue(p.id)} disabled={socialBusyId === p.id}
                              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold text-primary hover:opacity-80 disabled:opacity-50">
                              <RotateCcw className="w-3 h-3" /> Try again
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

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

              {/* Live web-search discovery — net-new businesses from the open web */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-display font-bold">Web Discovery</h2>
                  <span className="text-xs font-mono bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full">LIVE SEARCH</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Searches the live web (beyond Google Maps) to find real businesses matching your goal, then saves them as leads.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <input value={discoverGoal} onChange={e => setDiscoverGoal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") runDiscover(); }}
                    placeholder="e.g. roofing companies in Hattiesburg MS with no website"
                    className="flex-1 min-w-[260px] px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 outline-none" />
                  <button onClick={runDiscover} disabled={discovering || !discoverGoal.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                    <Globe className={`w-4 h-4 ${discovering ? "animate-spin" : ""}`} />
                    {discovering ? "Searching the web…" : "Discover on web"}
                  </button>
                </div>
                {discoverError && <p className="text-xs text-red-400 mt-2">⚠ {discoverError}</p>}
                {discoverResult && (
                  <div className="mt-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      Found {discoverResult.found} · saved {discoverResult.saved} new · {discoverResult.duplicates} already had
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {discoverResult.businesses.map((b, i) => (
                        <div key={i} className="rounded-xl border border-border bg-background/40 p-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{b.name}</span>
                            {(b.city || b.state) && <span className="text-xs text-muted-foreground">{[b.city, b.state].filter(Boolean).join(", ")}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{b.why}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs">
                            {b.phone && <span className="font-mono text-primary">{b.phone}</span>}
                            {b.website && <a href={b.website} target="_blank" rel="noopener noreferrer" className="text-primary truncate max-w-[180px] hover:underline">{b.website.replace(/^https?:\/\/(www\.)?/, "")}</a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI lead intelligence — rationale + high-ticket bios */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Target className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-display font-bold">Lead Intelligence</h2>
                  <button onClick={runAnalyze} disabled={analyzing}
                    className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                    <Sparkles className={`w-4 h-4 ${analyzing ? "animate-pulse" : ""}`} />
                    {analyzing ? "Analyzing…" : "Analyze latest leads"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  AI reads your most recent leads, explains why they're worth targeting, and singles out the high-ticket ones with a bio for each.
                </p>
                {analyzeError && <p className="text-xs text-red-400 mt-2">⚠ {analyzeError}</p>}
                {analysis && (
                  <div className="mt-4 space-y-4">
                    {analysis.rationale && (
                      <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
                        <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Why this batch</div>
                        <p className="text-sm text-foreground">{analysis.rationale}</p>
                        <p className="text-xs text-muted-foreground mt-1">Analyzed {analysis.analyzed} leads · {analysis.highTicket.length} high-ticket</p>
                      </div>
                    )}
                    {analysis.highTicket.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {analysis.highTicket.map((l) => (
                          <div key={l.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">💎 HIGH TICKET</span>
                              <span className="font-semibold text-foreground">{l.name}</span>
                              <span className="text-xs text-muted-foreground">{l.category}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{l.bio}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                              {l.phone && <span className="font-mono text-primary">{l.phone}</span>}
                              {l.emails && <span className="text-primary truncate max-w-[180px]">{l.emails}</span>}
                              {l.website && <a href={l.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[180px]">{l.website.replace(/^https?:\/\/(www\.)?/, "")}</a>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No high-ticket leads in this batch.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Deep sell-angle recon — signal/timing/competitive intel */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-display font-bold">Sell-Angle Recon</h2>
                  <span className="text-xs font-mono bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded-full">DEEP</span>
                  <button onClick={runRecon} disabled={reconning}
                    className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                    <Globe className={`w-4 h-4 ${reconning ? "animate-spin" : ""}`} />
                    {reconning ? "Digging…" : "Run deep recon (5)"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Goes past "they need a website." Researches each lead across the web for ad activity, buying/timing signals, competitor gaps, and reputation — then hands you a sharp, urgent angle + opener.
                </p>
                {reconError && <p className="text-xs text-red-400 mt-2">⚠ {reconError}</p>}
                {reconResult && (
                  <div className="mt-4 space-y-3">
                    {reconResult.results.length === 0
                      ? <p className="text-sm text-muted-foreground">Nothing left to scan — every lead already has recon.</p>
                      : reconResult.results.map((l) => (
                        <div key={l.id} className="rounded-xl border border-border bg-background/60 p-5">
                          <div className="flex items-center gap-2 flex-wrap mb-3">
                            <span className="text-base font-bold text-white">{l.name}</span>
                            <span className="text-xs font-medium text-foreground/70">{l.category}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${l.verified ? "bg-primary/20 text-primary border-primary/40" : "bg-amber-500/15 text-amber-300 border-amber-500/40"}`}>
                              {l.verified ? `✓ VERIFIED · ${l.sources?.length} sources` : "⚠ UNVERIFIED"}
                            </span>
                            {l.website && <a href={l.website} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">site</a>}
                            {l.facebook && <a href={l.facebook} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary hover:underline">fb</a>}
                          </div>

                          {l.summary && <p className="text-[15px] font-semibold text-white leading-relaxed">{l.summary}</p>}

                          {l.angle && (
                            <div className="mt-3">
                              <div className="text-xs font-bold uppercase tracking-wider text-primary mb-0.5">How to sell them</div>
                              <p className="text-sm font-medium text-foreground leading-relaxed">{l.angle}</p>
                            </div>
                          )}

                          {l.opener && (
                            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
                              <div className="text-xs font-bold uppercase tracking-wider text-primary mb-0.5">What to say</div>
                              <p className="text-sm font-semibold text-white leading-relaxed">&ldquo;{l.opener}&rdquo;</p>
                            </div>
                          )}

                          {l.sources && l.sources.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/60 mb-1.5">Sources (click to verify)</div>
                              <div className="flex flex-wrap gap-1.5">
                                {l.sources.map((s, i) => (
                                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" title={s.url}
                                    className="text-[11px] font-medium px-2 py-1 rounded-md bg-card border border-border text-foreground/80 hover:text-primary hover:border-primary/40 transition-colors truncate max-w-[200px]">
                                    {s.title}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Social page scan — followers, dead pages, missing platforms */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Share2 className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-display font-bold">Social Page Scan</h2>
                  <button onClick={runSocialScan} disabled={socialScanning}
                    className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${socialScanning ? "animate-spin" : ""}`} />
                    {socialScanning ? "Scanning…" : "Scan socials (5)"}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reads each lead's actual social pages — followers, how long since they posted, which platforms they're missing entirely — and turns it into a concrete pitch + opener. The findings also flow into outreach emails and lead-pack CSVs.
                </p>
                {socialScanError && <p className="text-xs text-red-400 mt-2">⚠ {socialScanError}</p>}
                {socialScanResult && (
                  <div className="mt-4 space-y-3">
                    {socialScanResult.results.length === 0
                      ? <p className="text-sm text-muted-foreground">Nothing left to scan — every lead already has a social scan.</p>
                      : socialScanResult.results.map((l) => (
                        <div key={l.id} className="rounded-xl border border-border bg-background/60 p-5">
                          <div className="flex items-center gap-2 flex-wrap mb-3">
                            <span className="text-base font-bold text-white">{l.name}</span>
                            <span className="text-xs font-medium text-foreground/70">{l.category}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                              l.report.grade === "strong" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                              : l.report.grade === "ok" ? "bg-blue-500/15 text-blue-400 border-blue-500/40"
                              : "bg-amber-500/15 text-amber-300 border-amber-500/40"}`}>
                              {l.report.grade} social
                            </span>
                          </div>

                          {l.report.platforms.length > 0 && (
                            <div className="space-y-1.5 mb-3">
                              {l.report.platforms.map((p, i) => (
                                <div key={i} className="flex items-baseline gap-2 text-sm">
                                  {p.url
                                    ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-bold text-primary capitalize hover:underline shrink-0">{p.platform}</a>
                                    : <span className="font-bold text-foreground capitalize shrink-0">{p.platform}</span>}
                                  <span className="text-foreground/80">
                                    {[p.followers && `${p.followers} followers`, p.lastActive, p.note].filter(Boolean).join(" · ")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {l.report.missing.length > 0 && (
                            <p className="text-sm text-amber-300 mb-3">Not on: <span className="font-semibold capitalize">{l.report.missing.join(", ")}</span></p>
                          )}

                          {l.report.pitch && (
                            <div className="mt-1">
                              <div className="text-xs font-bold uppercase tracking-wider text-primary mb-0.5">How to sell them</div>
                              <p className="text-sm font-medium text-foreground leading-relaxed">{l.report.pitch}</p>
                            </div>
                          )}
                          {l.report.opener && (
                            <div className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
                              <div className="text-xs font-bold uppercase tracking-wider text-primary mb-0.5">What to say</div>
                              <p className="text-sm font-semibold text-white leading-relaxed">&ldquo;{l.report.opener}&rdquo;</p>
                            </div>
                          )}
                          {l.report.sources && l.report.sources.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/60 mb-1.5">Sources (click to verify)</div>
                              <div className="flex flex-wrap gap-1.5">
                                {l.report.sources.map((s, i) => (
                                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" title={s.url}
                                    className="text-[11px] font-medium px-2 py-1 rounded-md bg-card border border-border text-foreground/80 hover:text-primary hover:border-primary/40 transition-colors truncate max-w-[200px]">
                                    {s.title}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
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
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Site</th>
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
                              <td className="px-4 py-3 text-xs truncate max-w-[150px]">
                                {lead.website
                                  ? <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{lead.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a>
                                  : <span className="text-muted-foreground/40">—</span>}
                              </td>
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

      {/* Outreach draft preview/editor modal */}
      {draftLead && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setDraftLead(null); setDraftData(null); }}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <Send className="w-4 h-4 text-primary" />
              <h3 className="font-display font-bold truncate">Email sequence — {draftLead.name}</h3>
              <button onClick={() => { setDraftLead(null); setDraftData(null); }} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
            </div>
            {draftData && (
              <p className="text-xs text-muted-foreground mb-3">
                To <span className="text-foreground">{draftData.lead.email ?? "no email"}</span>
                {draftData.lead.enrolled && <> · <span className="text-blue-400">enrolled, step {draftData.lead.step}</span></>}
                {draftData.lead.nextEmailAt && <> · next send {new Date(draftData.lead.nextEmailAt).toLocaleString()}</>}
                {draftData.draft.angle && <> · <span className="italic">angle: {draftData.draft.angle}</span></>}
              </p>
            )}
            {draftMsg && <p className="text-xs text-primary mb-2">✓ {draftMsg}</p>}
            {draftErr && <p className="text-xs text-red-400 mb-2">⚠ {draftErr}</p>}
            {draftBusy === "load" ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Writing the draft…</p>
            ) : draftData ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-background/30 p-4">
                  <div className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground mb-2">Email #1 — the opener</div>
                  <input value={draftData.draft.email.subject}
                    onChange={e => setDraftData({ ...draftData, draft: { ...draftData.draft, email: { ...draftData.draft.email, subject: e.target.value } } })}
                    className="w-full px-3 py-2 mb-2 rounded-lg bg-background border border-border text-sm font-semibold focus:border-primary/50 outline-none" />
                  <textarea value={draftData.draft.email.body} rows={7}
                    onChange={e => setDraftData({ ...draftData, draft: { ...draftData.draft, email: { ...draftData.draft.email, body: e.target.value } } })}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 outline-none resize-y" />
                </div>
                {(draftData.draft.followUps ?? []).filter(f => f.channel === "email").map((f, i) => {
                  const idx = draftData.draft.followUps.indexOf(f);
                  return (
                    <div key={idx} className="rounded-xl border border-border bg-background/30 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground">Follow-up {i + 1} — day</span>
                        <input type="number" min={1} max={60} value={f.day}
                          onChange={e => { const fu = [...draftData.draft.followUps]; fu[idx] = { ...f, day: Math.min(60, Math.max(1, Number(e.target.value) || 1)) }; setDraftData({ ...draftData, draft: { ...draftData.draft, followUps: fu } }); }}
                          className="w-16 px-2 py-1 rounded-md bg-background border border-border text-xs focus:border-primary/50 outline-none" />
                        <span className="text-[10px] text-muted-foreground">after email #1 · threads as a reply</span>
                      </div>
                      <textarea value={f.body} rows={4}
                        onChange={e => { const fu = [...draftData.draft.followUps]; fu[idx] = { ...f, body: e.target.value }; setDraftData({ ...draftData, draft: { ...draftData.draft, followUps: fu } }); }}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 outline-none resize-y" />
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={saveEmailDraft} disabled={!!draftBusy}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50">
                    {draftBusy === "save" ? "Saving…" : "Save draft"}
                  </button>
                  <button onClick={testSendEmailDraft} disabled={!!draftBusy}
                    className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-semibold hover:opacity-80 disabled:opacity-50"
                    title="Emails YOU a copy of email #1 so you can see exactly what lands in their inbox">
                    {draftBusy === "test" ? "Sending…" : "📬 Send test to me"}
                  </button>
                  <button onClick={() => openEmailDraft(draftLead.id, draftLead.name, true)} disabled={!!draftBusy}
                    className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-semibold hover:opacity-80 disabled:opacity-50"
                    title="Throw this draft away and have the AI write a fresh one">
                    {draftBusy === "regen" ? "Rewriting…" : "↻ Rewrite with AI"}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground/70">Your edits are exactly what sends — the AI won't touch a saved draft. The signature and business-address footer from your settings are added automatically.</p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Outreach conversation thread modal */}
      {threadLead && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setThreadLead(null); setThreadData(null); }}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-primary">💬</span>
              <h3 className="font-display font-bold truncate">{threadLead.name}</h3>
              {threadData?.lead.unsubscribedAt && <span className="px-1.5 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-400 text-[9px] font-bold uppercase">unsubscribed</span>}
              {threadData?.lead.repliedAt && !threadData.lead.unsubscribedAt && <span className="px-1.5 py-0.5 rounded-full border border-primary/40 bg-primary/15 text-primary text-[9px] font-bold uppercase">replied</span>}
              <button onClick={() => { setThreadLead(null); setThreadData(null); }} className="ml-auto text-muted-foreground hover:text-foreground">✕</button>
            </div>
            {threadData?.lead.email && <p className="text-xs text-muted-foreground mb-3">{threadData.lead.email}</p>}
            {threadErr && <p className="text-xs text-red-400 mb-2">⚠ {threadErr}</p>}
            {threadMsg && <p className="text-xs text-primary mb-2">✓ {threadMsg}</p>}
            <div className="flex-1 overflow-y-auto space-y-2 min-h-[120px]">
              {threadBusy === "load" ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading conversation…</p>
              ) : threadData && threadData.thread.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nothing sent to this company yet.</p>
              ) : threadData?.thread.map(t => (
                <div key={t.id} className={`rounded-xl border px-3 py-2 text-xs ${t.direction === "in" ? "border-blue-500/30 bg-blue-500/5 mr-8" : "border-border bg-background/40 ml-8"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase ${t.direction === "in" ? "bg-blue-500/15 text-blue-400 border-blue-500/40" : t.status === "failed" ? "bg-red-500/15 text-red-400 border-red-500/40" : "bg-primary/15 text-primary border-primary/40"}`}>
                      {t.direction === "in" ? "them" : t.kind === "email" ? `you · step ${t.step}` : t.aiGenerated ? "you · AI" : "you"}
                    </span>
                    {t.status === "failed" && <span className="text-red-400">{t.error ?? "failed"}</span>}
                    <span className="ml-auto text-muted-foreground whitespace-nowrap">{new Date(t.createdAt).toLocaleString()}</span>
                  </div>
                  {t.subject && <div className="font-semibold text-foreground mb-0.5">{t.subject}</div>}
                  <div className="text-muted-foreground whitespace-pre-wrap">{t.body}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              {emailInfo?.gmailConfigured ? (
                <div className="flex items-end gap-2">
                  <textarea value={threadReply} onChange={e => setThreadReply(e.target.value)} rows={2}
                    placeholder={`Reply to ${threadLead.name} — sends from your Gmail, threaded into the conversation`}
                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:border-primary/50 outline-none resize-y" />
                  <button onClick={sendEmailThreadReply} disabled={!threadReply.trim() || threadBusy === "send"}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50">
                    {threadBusy === "send" ? "Sending…" : "Send"}
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Connect Google Mail (Replit → Integrations) to reply straight from here.</p>
              )}
            </div>
          </div>
        </div>
      )}

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
