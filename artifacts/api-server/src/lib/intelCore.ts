/**
 * Shared lead-intel core — the audit → offer → deal-value → upsert pipeline,
 * used by both the on-demand command routes and the background auto-audit
 * scheduler. Reads a scraper-written `leads` row; writes only to `lead_intel`.
 */
import { db, leadIntel, type Lead, type LeadIntel, type PipelineStage } from "@workspace/db";
import { eq } from "drizzle-orm";
import { auditWebsite } from "./audit";
import { recommendOffer, estimateDealValue } from "./offer";

export async function getIntel(leadId: number): Promise<LeadIntel | null> {
  const rows = await db.select().from(leadIntel).where(eq(leadIntel.leadId, leadId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertIntel(leadId: number, clerkUserId: string | null, set: Partial<LeadIntel>): Promise<LeadIntel> {
  const rows = await db
    .insert(leadIntel)
    .values({ leadId, clerkUserId, ...set })
    .onConflictDoUpdate({ target: leadIntel.leadId, set: { ...set, updatedAt: new Date() } })
    .returning();
  return rows[0];
}

/**
 * Audit a lead's website, pick the best offer, estimate its deal value, and
 * store it all on the lead's intel row. Advances a New/unscored lead to
 * "Scored" (never downgrades a lead already further along). No AI spend — the
 * audit is a plain fetch + parse and the offer is deterministic.
 */
export async function auditAndStore(lead: Lead): Promise<LeadIntel> {
  const audit = await auditWebsite(lead);
  const offer = recommendOffer(lead, audit);
  const est = estimateDealValue(lead, offer);
  const scoreReason =
    `Opportunity ${lead.opportunityScore ?? 0}/100 · site grade ${audit.grade}. ` +
    (audit.findings[0] ? `Top gap: ${audit.findings[0]}.` : "Solid presence.");
  const existing = await getIntel(lead.id);
  const stage: PipelineStage = existing?.stage && existing.stage !== "New" ? existing.stage : "Scored";
  return upsertIntel(lead.id, lead.clerkUserId ?? null, {
    audit,
    auditAt: new Date(),
    recommendedOffer: offer,
    estimatedDealValue: est,
    scoreReason,
    aiNotes: existing?.aiNotes ?? audit.summary,
    stage,
  });
}
