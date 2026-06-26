import { useState, useEffect, useCallback } from "react";
import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Zap, Download, LogOut, Users, Star, TrendingUp, Calendar,
  MapPin, ChevronLeft, ChevronRight, DollarSign, CreditCard,
  UserCheck, UserX, Crown, BarChart2, RefreshCw,
} from "lucide-react";
import {
  ComposableMap, Geographies, Geography, ZoomableGroup,
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
  address: string | null; category: string | null; score: number | null;
  status: string | null; createdAt: string | null;
}
interface AdminUser {
  id: string; email: string | null; plan: string;
  lead_count: number; created_at: string | null; period_end: number | null;
}

function colorForCount(count: number, max: number): string {
  if (count === 0 || max === 0) return "#1a2332";
  const t = Math.min(1, count / max);
  const g = Math.round(41 + t * (230 - 41));
  const b = Math.round(50 + t * (118 - 50));
  const alpha = 0.25 + t * 0.75;
  return `rgba(0,${g},${b},${alpha})`;
}

function GeoHeatmap({ byState }: { byState: Record<string, number> }) {
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
              return (
                <Geography key={geo.rsmKey} geography={geo}
                  fill={colorForCount(count, maxCount)} stroke="#0d1117" strokeWidth={0.8}
                  onMouseEnter={() => setTooltipContent(`${STATE_NAMES[abbr] ?? abbr}: ${count.toLocaleString()} lead${count !== 1 ? "s" : ""}`)}
                  onMouseLeave={() => setTooltipContent("")}
                  style={{ default: { outline: "none" }, hover: { outline: "none", fill: "#00E676", opacity: 0.85 }, pressed: { outline: "none" } }}
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
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "leads">("overview");

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.primaryEmailAddress?.emailAddress?.toLowerCase() === ADMIN_EMAIL?.toLowerCase();
  if (!isAdmin) { setLocation("/dashboard"); return null; }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const r = await fetch(`${basePath}/api/admin/leads?page=${page}&limit=50`);
      const data = await r.json();
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch {}
    setLoadingLeads(false);
  }, [page]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
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

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    fetch(`${basePath}/api/admin/stats`).then(r => r.json()).then(setStats).catch(() => {});
    fetch(`${basePath}/api/admin/geo`).then(r => r.json()).then(setGeo).catch(() => {});
    setRevenueLoading(true);
    fetch(`${basePath}/api/admin/revenue`).then(r => r.json()).then(data => { setRevenue(data); setRevenueLoading(false); }).catch(() => setRevenueLoading(false));
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const topStates = geo
    ? Object.entries(geo.byState).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([state, count]) => ({ state, count }))
    : [];

  const conversionRate = revenue && revenue.totalUsers > 0
    ? ((revenue.subscriberCount / revenue.totalUsers) * 100).toFixed(1)
    : "0.0";

  const fmt$ = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
            <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
              {(["overview", "users", "leads"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {tab === "overview" ? "📍 Map" : tab === "users" ? "👥 Users" : "📋 Leads"}
                </button>
              ))}
            </div>
          </motion.div>

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
                            <th className="text-left px-4 py-3 text-xs text-muted-foreground font-semibold">Renews</th>
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
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  {u.period_end ? new Date(u.period_end * 1000).toLocaleDateString() : <span className="text-muted-foreground/30">—</span>}
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

        </div>
      </main>
    </div>
  );
}
