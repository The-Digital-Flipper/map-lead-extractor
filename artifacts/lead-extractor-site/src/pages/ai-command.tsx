import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useUser, useSession } from "@clerk/react";
import {
  RefreshCw, Target, TrendingUp, Users, CalendarClock, MessageSquare,
  Sparkles, Search, Globe, CheckCircle2, Circle, Link2, DollarSign,
  ClipboardCheck, ArrowRight, Flame, Loader2, AlertTriangle,
} from "lucide-react";
import { useSeo } from "@/lib/seo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string | undefined;

const STAGES = [
  "New", "Scored", "Message Ready", "Approved to Contact", "Contacted",
  "Interested", "Demo Sent", "Follow Up", "Closed Won", "Closed Lost",
] as const;
type Stage = (typeof STAGES)[number];

// ── API types (mirror artifacts/api-server/src/lib + routes/command.ts) ───────
type RevenueGoal = {
  goal: number; currentMrr: number; subscribers: number; monthRevenue: number;
  packRevenue30: number; pipelineValue: number; closedWonValue: number;
  gapToGoal: number; percentToGoal: number;
  usersNeeded: { starter: number; pro: number; agency: number };
  closeRate: number; closeRateAssumed: boolean; avgDealValue: number;
  leadsNeededPerWeek: number; dealsNeededPerMonth: number;
};
type BestLead = { id: number; name: string | null; category: string | null; city: string | null; valueScore: number | null; opportunityScore: number | null; grade: string | null; offer: string | null; estValue: number | null };
type DailyReport = {
  date: string; newLeadsToday: number; totalLeads: number; bestLeads: BestLead[];
  messagesReady: number; approvedReady: number; followUpsDueToday: number;
  interested: number; pipelineValue: number; closedWonThisMonth: number;
  errors: { name: string | null; message: string | null; at: string | null }[];
  nextBestAction: string;
};
type IntelMessage = { channel: string; label: string; subject?: string; body: string; approved: boolean; generatedAt: string };
type Audit = {
  hasWebsite: boolean; url?: string; reachable: boolean; homepageHeadline?: string;
  ctaQuality: string; mobileReady: boolean; hasQuoteForm: boolean; hasCallButton: boolean;
  hasTrustSignals: boolean; seoTitle?: string; seoTitleQuality: string; serviceArea?: string;
  platform?: string; grade: string; score: number; findings: string[]; summary: string;
};
type Offer = { offer: string; label: string; reason: string; priceLow: number; priceHigh: number; recurring: boolean };
type CommandLead = {
  id: number; name: string | null; phone: string | null; website: string | null;
  city: string | null; category: string | null; rating: string | null; reviewCount: number | null;
  score: number | null; opportunityScore: number | null; valueScore: number | null;
  needs: string[] | null; highTicket: boolean | null; status: string | null;
  stage: Stage | null; audit: Audit | null; recommendedOffer: Offer | null;
  messages: Record<string, IntelMessage> | null; estimatedDealValue: number | null;
  grade: string | null; offerLabel: string | null; hasDrafts: boolean; approvedCount: number;
  scoreReason: string | null; aiNotes: string | null;
};
type DueItem = { leadId: number; name: string | null; phone: string | null; website: string | null; stage: string | null; dueAt: string | null; nextMessage: IntelMessage | null };

const money = (n: number | null | undefined) => "$" + (n ?? 0).toLocaleString();

function gradeClass(g: string | null | undefined): string {
  if (g === "A" || g === "B") return "bg-green-100 text-green-700 border-green-200";
  if (g === "C") return "bg-amber-100 text-amber-700 border-amber-200";
  if (g === "D") return "bg-orange-100 text-orange-700 border-orange-200";
  if (g === "F") return "bg-red-100 text-red-700 border-red-200";
  return "bg-slate-100 text-slate-500 border-slate-200";
}
function stageClass(s: string | null | undefined): string {
  switch (s) {
    case "Closed Won": return "bg-green-600 text-white";
    case "Closed Lost": return "bg-slate-400 text-white";
    case "Interested": case "Demo Sent": return "bg-indigo-100 text-indigo-700";
    case "Approved to Contact": case "Message Ready": return "bg-violet-100 text-violet-700";
    case "Contacted": case "Follow Up": return "bg-blue-100 text-blue-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

export default function AiCommand() {
  useSeo({ title: "AI Command Center — MapLeadExtractor", path: "/command" });
  const { isLoaded, isSignedIn, user } = useUser();
  const { session } = useSession();

  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isAdmin = !!email && !!ADMIN_EMAIL && email === ADMIN_EMAIL.toLowerCase();

  const [goal, setGoal] = useState<RevenueGoal | null>(null);
  const [report, setReport] = useState<DailyReport | null>(null);
  const [due, setDue] = useState<DueItem[]>([]);
  const [leads, setLeads] = useState<CommandLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<CommandLead | null>(null);
  const [q, setQ] = useState("");

  const authFetch = useCallback(async (path: string, opts: RequestInit = {}) => {
    const token = await session?.getToken();
    return fetch(`${basePath}/api/command${path}`, {
      ...opts,
      headers: {
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    });
  }, [session]);

  const loadAll = useCallback(async (query = "") => {
    const [g, r, d, l] = await Promise.all([
      authFetch("/revenue-goal").then((x) => x.json()).catch(() => null),
      authFetch("/daily-report").then((x) => x.json()).catch(() => null),
      authFetch("/due-today").then((x) => x.json()).catch(() => ({ items: [] })),
      authFetch(`/leads?limit=60${query ? `&q=${encodeURIComponent(query)}` : ""}`).then((x) => x.json()).catch(() => ({ leads: [] })),
    ]);
    if (g && !g.error) setGoal(g);
    if (r && !r.error) setReport(r);
    setDue(d?.items ?? []);
    setLeads(l?.leads ?? []);
    setLoading(false);
  }, [authFetch]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !isAdmin) { setLoading(false); return; }
    loadAll();
  }, [isLoaded, isSignedIn, isAdmin, loadAll]);

  const refresh = async () => { setRefreshing(true); await loadAll(q); setRefreshing(false); };
  const setBusyFor = (k: string, v: boolean) => setBusy((b) => ({ ...b, [k]: v }));

  const patchLeadInList = (intel: any) => {
    const leadId = intel.leadId;
    setLeads((ls) => ls.map((x) => x.id === leadId ? {
      ...x,
      stage: intel.stage, audit: intel.audit, recommendedOffer: intel.recommendedOffer,
      messages: intel.messages, estimatedDealValue: intel.estimatedDealValue,
      grade: intel.audit?.grade ?? x.grade, offerLabel: intel.recommendedOffer?.label ?? x.offerLabel,
      hasDrafts: !!intel.messages && Object.keys(intel.messages).length > 0,
      approvedCount: intel.messages ? Object.values(intel.messages).filter((m: any) => m?.approved).length : 0,
      scoreReason: intel.scoreReason ?? x.scoreReason, aiNotes: intel.aiNotes ?? x.aiNotes,
    } : x));
    setDetail((dd) => dd && dd.id === leadId ? { ...dd, stage: intel.stage, audit: intel.audit, recommendedOffer: intel.recommendedOffer, messages: intel.messages, estimatedDealValue: intel.estimatedDealValue } : dd);
  };

  const runAudit = async (id: number) => {
    setBusyFor(`audit-${id}`, true);
    const res = await authFetch(`/leads/${id}/audit`, { method: "POST", body: "{}" }).then((x) => x.json()).catch(() => null);
    if (res?.intel) patchLeadInList(res.intel);
    setBusyFor(`audit-${id}`, false);
  };
  const writeMessages = async (id: number) => {
    setBusyFor(`msg-${id}`, true);
    const res = await authFetch(`/leads/${id}/messages`, { method: "POST", body: "{}" }).then((x) => x.json()).catch(() => null);
    if (res?.intel) patchLeadInList(res.intel);
    else if (res?.error) alert(res.error);
    setBusyFor(`msg-${id}`, false);
  };
  const approveMsg = async (id: number, channel: string, approved: boolean) => {
    const res = await authFetch(`/leads/${id}/messages/${channel}/approve`, { method: "POST", body: JSON.stringify({ approved }) }).then((x) => x.json()).catch(() => null);
    if (res?.intel) patchLeadInList(res.intel);
  };
  const setStage = async (id: number, stage: Stage) => {
    const res = await authFetch(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) }).then((x) => x.json()).catch(() => null);
    if (res?.intel) patchLeadInList(res.intel);
  };
  const snooze = async (id: number, days: number) => {
    const res = await authFetch(`/leads/${id}`, { method: "PATCH", body: JSON.stringify({ snoozeDays: days }) }).then((x) => x.json()).catch(() => null);
    if (res?.intel) { patchLeadInList(res.intel); await loadAll(q); }
  };
  const copyAuditLink = async (id: number) => {
    const res = await authFetch(`/leads/${id}/audit-link`).then((x) => x.json()).catch(() => null);
    if (res?.path) {
      const url = `${window.location.origin}${res.path}`;
      navigator.clipboard?.writeText(url).then(() => alert("Audit page link copied:\n" + url)).catch(() => prompt("Copy the audit page link:", url));
    }
  };

  if (!isLoaded || loading) {
    return <div className="min-h-screen grid place-items-center text-slate-500"><Loader2 className="animate-spin mr-2" /> Loading command center…</div>;
  }
  if (!isSignedIn || !isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center px-6">
        <Card className="p-8 max-w-md text-center">
          <Target className="w-10 h-10 mx-auto text-indigo-500 mb-3" />
          <h1 className="text-xl font-bold mb-1">AI Command Center</h1>
          <p className="text-slate-500">This dashboard is for the account owner. Sign in with the admin email to continue.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="text-indigo-500" /> AI Command Center</h1>
            <p className="text-slate-500 text-sm">Your daily plan to grow toward $10k/month.</p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Revenue goal tracker */}
        {goal && <RevenueGoalCard goal={goal} />}

        {/* Daily report */}
        {report && (
          <div className="mt-5">
            <div className="rounded-xl bg-indigo-600 text-white p-4 flex items-center gap-3 mb-4">
              <Flame className="w-5 h-5 shrink-0" />
              <div><div className="text-xs uppercase tracking-wide text-indigo-200">Next best action</div><div className="font-semibold">{report.nextBestAction}</div></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Stat icon={<Search className="w-4 h-4" />} label="New today" value={report.newLeadsToday} sub={`${report.totalLeads} total`} />
              <Stat icon={<MessageSquare className="w-4 h-4" />} label="Msgs ready" value={report.messagesReady} sub={`${report.approvedReady} approved`} />
              <Stat icon={<CalendarClock className="w-4 h-4" />} label="Follow-ups due" value={report.followUpsDueToday} />
              <Stat icon={<TrendingUp className="w-4 h-4" />} label="Interested" value={report.interested} />
              <Stat icon={<DollarSign className="w-4 h-4" />} label="Pipeline" value={money(report.pipelineValue)} />
              <Stat icon={<CheckCircle2 className="w-4 h-4" />} label="Won (mo)" value={report.closedWonThisMonth} />
            </div>
            {report.errors.length > 0 && (
              <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div><strong>{report.errors.length} recent error(s):</strong> {report.errors.map((e) => e.name).filter(Boolean).join(", ")}</div>
              </div>
            )}
          </div>
        )}

        {/* Due today + Leads */}
        <div className="grid lg:grid-cols-5 gap-5 mt-6">
          {/* Due today */}
          <div className="lg:col-span-2">
            <h2 className="font-semibold mb-2 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-blue-600" /> Follow up today</h2>
            <Card className="divide-y max-h-[520px] overflow-auto">
              {due.length === 0 && <div className="p-5 text-sm text-slate-400 text-center">Nothing due. Schedule follow-ups from a lead's stage.</div>}
              {due.map((d) => (
                <div key={d.leadId} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm truncate">{d.name ?? `Lead #${d.leadId}`}</div>
                    <Badge className={stageClass(d.stage)}>{d.stage}</Badge>
                  </div>
                  {d.nextMessage ? (
                    <div className="text-xs text-slate-500 mt-1 line-clamp-2">{d.nextMessage.label}: {d.nextMessage.body}</div>
                  ) : <div className="text-xs text-slate-400 mt-1">No message drafted yet.</div>}
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { const lead = leads.find((x) => x.id === d.leadId); if (lead) setDetail(lead); }}>Open</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => snooze(d.leadId, 3)}>Snooze 3d</Button>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* Leads CRM */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-2 gap-2">
              <h2 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600" /> Top opportunities</h2>
              <form onSubmit={(e) => { e.preventDefault(); loadAll(q); }} className="flex gap-1">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="text-sm border rounded-md px-2 py-1 w-32" />
                <Button size="sm" variant="outline" type="submit"><Search className="w-3.5 h-3.5" /></Button>
              </form>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs sticky top-0">
                    <tr><th className="text-left p-2">Business</th><th className="p-2">Opp</th><th className="p-2">Grade</th><th className="p-2">Est $</th><th className="p-2">Stage</th><th className="p-2"></th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {leads.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="p-2">
                          <div className="font-medium truncate max-w-[160px]">{l.name}</div>
                          <div className="text-xs text-slate-400 truncate max-w-[160px]">{l.city}{l.category ? ` · ${l.category}` : ""}</div>
                        </td>
                        <td className="p-2 text-center"><span className="font-semibold text-indigo-600">{l.opportunityScore ?? "—"}</span></td>
                        <td className="p-2 text-center">{l.grade ? <span className={`inline-block px-1.5 rounded border text-xs font-bold ${gradeClass(l.grade)}`}>{l.grade}</span> : <span className="text-slate-300">—</span>}</td>
                        <td className="p-2 text-center text-slate-600">{l.estimatedDealValue ? money(l.estimatedDealValue) : "—"}</td>
                        <td className="p-2 text-center"><Badge className={`${stageClass(l.stage)} text-[10px]`}>{l.stage ?? "New"}</Badge></td>
                        <td className="p-2 text-right"><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDetail(l)}>View</Button></td>
                      </tr>
                    ))}
                    {leads.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">No leads. Run a search from the dashboard.</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Lead detail dialog */}
      <LeadDetailDialog
        lead={detail}
        onClose={() => setDetail(null)}
        busy={busy}
        onAudit={runAudit}
        onWrite={writeMessages}
        onApprove={approveMsg}
        onStage={setStage}
        onCopyLink={copyAuditLink}
      />
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-slate-400 text-xs">{icon}{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </Card>
  );
}

function RevenueGoalCard({ goal }: { goal: RevenueGoal }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-indigo-600" /> Road to {money(goal.goal)}/mo</h2>
        <div className="text-sm text-slate-500">{money(goal.currentMrr)} MRR · {goal.subscribers} subs</div>
      </div>
      <Progress value={goal.percentToGoal} className="h-3" />
      <div className="flex justify-between text-xs text-slate-400 mt-1"><span>{goal.percentToGoal}% of goal</span><span>{money(goal.gapToGoal)} to go</span></div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Pipeline value</div><div className="font-bold text-lg">{money(goal.pipelineValue)}</div></div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Revenue (30d)</div><div className="font-bold text-lg">{money(goal.monthRevenue + goal.packRevenue30)}</div></div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Close rate</div><div className="font-bold text-lg">{Math.round(goal.closeRate * 100)}%{goal.closeRateAssumed ? "*" : ""}</div></div>
        <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-400">Leads/week needed</div><div className="font-bold text-lg">{goal.leadsNeededPerWeek}</div></div>
      </div>

      <div className="mt-4">
        <div className="text-xs text-slate-400 mb-1">To hit {money(goal.goal)}/mo you need any of:</div>
        <div className="grid grid-cols-3 gap-3">
          <TierNeed label="Starter" price={49} n={goal.usersNeeded.starter} />
          <TierNeed label="Pro" price={149} n={goal.usersNeeded.pro} />
          <TierNeed label="Agency" price={499} n={goal.usersNeeded.agency} />
        </div>
      </div>
      {goal.closeRateAssumed && <div className="text-[11px] text-slate-400 mt-2">*Close rate is an assumed 20% until you have 5+ closed/lost deals to measure it from.</div>}
    </Card>
  );
}
function TierNeed({ label, price, n }: { label: string; price: number; n: number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className="text-2xl font-bold text-indigo-600">{n}</div>
      <div className="text-xs text-slate-500">{label} users</div>
      <div className="text-[11px] text-slate-400">${price}/mo each</div>
    </div>
  );
}

function LeadDetailDialog({
  lead, onClose, busy, onAudit, onWrite, onApprove, onStage, onCopyLink,
}: {
  lead: CommandLead | null; onClose: () => void; busy: Record<string, boolean>;
  onAudit: (id: number) => void; onWrite: (id: number) => void;
  onApprove: (id: number, ch: string, a: boolean) => void; onStage: (id: number, s: Stage) => void;
  onCopyLink: (id: number) => void;
}) {
  if (!lead) return null;
  const a = lead.audit;
  const messages = lead.messages ? Object.entries(lead.messages) : [];
  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{lead.name}
            {lead.grade && <span className={`px-1.5 rounded border text-xs font-bold ${gradeClass(lead.grade)}`}>{lead.grade}</span>}
            {lead.highTicket && <Badge className="bg-amber-100 text-amber-700">High-ticket</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-slate-500 -mt-2">
          {lead.city}{lead.category ? ` · ${lead.category}` : ""}{lead.website ? <> · <a href={lead.website} target="_blank" rel="noreferrer" className="text-indigo-600 underline">site</a></> : " · no website"}
          {lead.phone ? ` · ${lead.phone}` : ""}
        </div>

        {/* Stage control */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-400">Stage</span>
          <Select value={lead.stage ?? "New"} onValueChange={(v) => onStage(lead.id, v as Stage)}>
            <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          {lead.estimatedDealValue ? <span className="text-xs text-slate-500 ml-auto">Est. deal {money(lead.estimatedDealValue)}</span> : null}
        </div>

        {/* Needs */}
        {lead.needs && lead.needs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">{lead.needs.map((n) => <Badge key={n} variant="outline" className="text-[10px]">{n}</Badge>)}</div>
        )}

        {/* Audit */}
        <div className="mt-3 border rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-slate-500" /> Website audit</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAudit(lead.id)} disabled={busy[`audit-${lead.id}`]}>
                {busy[`audit-${lead.id}`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} {a ? "Re-audit" : "Run audit"}
              </Button>
              {a && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onCopyLink(lead.id)}><Link2 className="w-3 h-3 mr-1" /> Share page</Button>}
            </div>
          </div>
          {a ? (
            <div className="mt-2 text-sm">
              <div className="text-slate-600">{a.summary}</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                <Check ok={a.mobileReady} label="Mobile-ready" />
                <Check ok={a.hasQuoteForm} label="Quote form" />
                <Check ok={a.hasCallButton} label="Call button" />
                <Check ok={a.hasTrustSignals} label="Reviews/trust" />
                <Check ok={a.ctaQuality === "ok" || a.ctaQuality === "strong"} label={`CTA: ${a.ctaQuality}`} />
                <Check ok={a.seoTitleQuality === "ok" || a.seoTitleQuality === "strong"} label={`SEO title: ${a.seoTitleQuality}`} />
              </div>
              {a.findings.length > 0 && <ul className="mt-2 text-xs text-slate-500 list-disc pl-4">{a.findings.slice(0, 5).map((f, i) => <li key={i}>{f}</li>)}</ul>}
            </div>
          ) : <div className="text-xs text-slate-400 mt-2">No audit yet — run one to grade the site and pick an offer.</div>}
        </div>

        {/* Offer */}
        {lead.recommendedOffer && (
          <div className="mt-3 border rounded-lg p-3 bg-gradient-to-br from-indigo-50 to-violet-50">
            <div className="font-semibold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-500" /> Recommended offer</div>
            <div className="text-sm mt-1"><strong>{lead.recommendedOffer.label}</strong> — {lead.recommendedOffer.reason}</div>
            <div className="text-xs text-slate-500 mt-1">{money(lead.recommendedOffer.priceLow)}–{money(lead.recommendedOffer.priceHigh)}{lead.recommendedOffer.recurring ? "/mo" : ""}</div>
          </div>
        )}

        {/* Messages */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-slate-500" /> Messages <span className="text-xs text-slate-400 font-normal">(approve before sending)</span></div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onWrite(lead.id)} disabled={busy[`msg-${lead.id}`]}>
              {busy[`msg-${lead.id}`] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} {messages.length ? "Rewrite all" : "Write messages"}
            </Button>
          </div>
          {messages.length === 0 && <div className="text-xs text-slate-400 mt-2">No drafts yet.</div>}
          <div className="space-y-2 mt-2">
            {messages.map(([ch, m]) => (
              <div key={ch} className={`border rounded-lg p-2 ${m.approved ? "border-green-300 bg-green-50" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-600">{m.label}</div>
                  <Button size="sm" variant={m.approved ? "default" : "outline"} className={`h-6 text-[11px] ${m.approved ? "bg-green-600 hover:bg-green-700" : ""}`} onClick={() => onApprove(lead.id, ch, !m.approved)}>
                    {m.approved ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</> : <><Circle className="w-3 h-3 mr-1" /> Approve</>}
                  </Button>
                </div>
                {m.subject && <div className="text-xs font-medium mt-1">Subject: {m.subject}</div>}
                <Textarea readOnly value={m.body} className="mt-1 text-xs h-24 resize-none bg-white" />
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return <div className={`flex items-center gap-1 ${ok ? "text-green-600" : "text-red-500"}`}>{ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}{label}</div>;
}
