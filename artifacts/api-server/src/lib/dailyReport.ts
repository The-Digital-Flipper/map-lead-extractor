/**
 * Daily AI Business Report + "follow-ups due today" — the "what do I do today"
 * view. Everything is read/compute over existing leads + lead_intel + logs; no
 * writes, no scraper involvement.
 */
import { db, leads, leadIntel, logs, OPEN_STAGES, type IntelMessages } from "@workspace/db";
import { and, desc, eq, gte, inArray, isNotNull, lte, ne, or, sql } from "drizzle-orm";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type BestLead = {
  id: number;
  name: string | null;
  category: string | null;
  city: string | null;
  valueScore: number | null;
  opportunityScore: number | null;
  grade: string | null;
  offer: string | null;
  estValue: number | null;
};

export type DailyReport = {
  date: string;
  newLeadsToday: number;
  totalLeads: number;
  bestLeads: BestLead[];
  messagesReady: number;      // leads with generated drafts
  approvedReady: number;      // leads with at least one approved message
  followUpsDueToday: number;
  interested: number;
  pipelineValue: number;      // dollars, open stages
  closedWonThisMonth: number; // count
  errors: { name: string | null; message: string | null; at: string | null }[];
  nextBestAction: string;
};

function city(address: string | null): string | null {
  return (address ?? "").split(",").slice(-2).join(",").trim() || null;
}

export async function buildDailyReport(): Promise<DailyReport> {
  const today = startOfToday();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [newCntRow, totalRow, best, stageRows, msgRows, dueRow, errRows] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(leads).where(gte(leads.createdAt, today)),
    db.select({ c: sql<number>`count(*)::int` }).from(leads),
    db
      .select({
        id: leads.id,
        name: leads.name,
        category: leads.category,
        address: leads.address,
        valueScore: leads.valueScore,
        opportunityScore: leads.opportunityScore,
        grade: sql<string | null>`${leadIntel.audit}->>'grade'`,
        offer: sql<string | null>`${leadIntel.recommendedOffer}->>'label'`,
        estValue: leadIntel.estimatedDealValue,
      })
      .from(leads)
      .leftJoin(leadIntel, eq(leadIntel.leadId, leads.id))
      .orderBy(desc(leads.valueScore))
      .limit(8),
    db.select({ stage: leadIntel.stage, cnt: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${leadIntel.estimatedDealValue}),0)::int` }).from(leadIntel).groupBy(leadIntel.stage),
    db
      .select({
        withDrafts: sql<number>`count(*) FILTER (WHERE ${leadIntel.messages} IS NOT NULL AND ${leadIntel.messages}::text <> '{}')::int`,
        approved: sql<number>`count(*) FILTER (WHERE ${leadIntel.messages}::text ~ '"approved":true')::int`,
      })
      .from(leadIntel),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(leadIntel)
      .where(and(isNotNull(leadIntel.nextFollowUpAt), lte(leadIntel.nextFollowUpAt, new Date()), ne(leadIntel.stage, "Closed Won"), ne(leadIntel.stage, "Closed Lost"))),
    db.select({ name: logs.name, message: logs.message, createdAt: logs.createdAt }).from(logs).where(and(eq(logs.type, "error"), gte(logs.createdAt, new Date(Date.now() - 864e5)))).orderBy(desc(logs.createdAt)).limit(5),
  ]);

  const byStage = new Map(stageRows.map((r) => [r.stage ?? "", { cnt: Number(r.cnt), total: Number(r.total) }]));
  const openStages = new Set<string>(OPEN_STAGES);
  let pipelineValue = 0;
  for (const [stage, v] of byStage) if (openStages.has(stage)) pipelineValue += v.total;
  const interested = byStage.get("Interested")?.cnt ?? 0;
  const closedWon = byStage.get("Closed Won")?.cnt ?? 0;

  const messagesReady = Number(msgRows[0]?.withDrafts ?? 0);
  const approvedReady = Number(msgRows[0]?.approved ?? 0);
  const followUpsDueToday = Number(dueRow[0]?.c ?? 0);
  const newLeadsToday = Number(newCntRow[0]?.c ?? 0);
  const totalLeads = Number(totalRow[0]?.c ?? 0);

  // Next best action, in priority order.
  let nextBestAction: string;
  if (followUpsDueToday > 0) nextBestAction = `Send ${followUpsDueToday} follow-up${followUpsDueToday === 1 ? "" : "s"} due today.`;
  else if (approvedReady > 0) nextBestAction = `Reach out to ${approvedReady} lead${approvedReady === 1 ? "" : "s"} with approved messages.`;
  else if (messagesReady > approvedReady) nextBestAction = `Review & approve ${messagesReady - approvedReady} message draft${messagesReady - approvedReady === 1 ? "" : "s"}.`;
  else if (best.length > 0) nextBestAction = `Audit & write messages for your top ${Math.min(5, best.length)} opportunity leads.`;
  else nextBestAction = "Run a lead search to fill your pipeline.";

  return {
    date: today.toISOString().slice(0, 10),
    newLeadsToday,
    totalLeads,
    bestLeads: best.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      city: city(b.address),
      valueScore: b.valueScore,
      opportunityScore: b.opportunityScore,
      grade: b.grade,
      offer: b.offer,
      estValue: b.estValue,
    })),
    messagesReady,
    approvedReady,
    followUpsDueToday,
    interested,
    pipelineValue,
    closedWonThisMonth: closedWon,
    errors: errRows.map((e) => ({ name: e.name, message: (e.message ?? "").slice(0, 200), at: e.createdAt ? new Date(e.createdAt).toISOString() : null })),
    nextBestAction,
  };
}

export type DueTodayItem = {
  leadId: number;
  name: string | null;
  phone: string | null;
  website: string | null;
  stage: string | null;
  dueAt: string | null;
  nextMessage: { channel: string; label: string; subject?: string; body: string; approved: boolean } | null;
};

function pickNextMessage(messages: IntelMessages | null): DueTodayItem["nextMessage"] {
  if (!messages) return null;
  const order: (keyof IntelMessages)[] = ["followUp", "email", "facebook", "phone", "auditSummary"];
  for (const k of order) {
    const m = messages[k];
    if (m) return { channel: m.channel, label: m.label, subject: m.subject, body: m.body, approved: m.approved };
  }
  return null;
}

/** Leads whose follow-up is due now (or overdue), with the message to send next. */
export async function listDueToday(limit = 30): Promise<DueTodayItem[]> {
  const rows = await db
    .select({
      leadId: leads.id,
      name: leads.name,
      phone: leads.phone,
      website: leads.website,
      stage: leadIntel.stage,
      dueAt: leadIntel.nextFollowUpAt,
      messages: leadIntel.messages,
    })
    .from(leadIntel)
    .innerJoin(leads, eq(leads.id, leadIntel.leadId))
    .where(and(isNotNull(leadIntel.nextFollowUpAt), lte(leadIntel.nextFollowUpAt, new Date()), ne(leadIntel.stage, "Closed Won"), ne(leadIntel.stage, "Closed Lost")))
    .orderBy(leadIntel.nextFollowUpAt)
    .limit(limit);

  return rows.map((r) => ({
    leadId: r.leadId,
    name: r.name,
    phone: r.phone,
    website: r.website,
    stage: r.stage,
    dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
    nextMessage: pickNextMessage(r.messages),
  }));
}
