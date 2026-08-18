import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * lead_intel — AI-derived intelligence layered ON TOP of the scraper-written
 * `leads` rows, keyed 1:1 by `leadId`. This table is deliberately SEPARATE from
 * `leads` so the scrapers' ingest contract (`saveLeadBatch` / POST /leads/save)
 * and the `leads` table stay untouched. New features read `leads` and write
 * their derived data here.
 */

// ── Website audit (lib/audit.ts) ────────────────────────────────────────────
export type Quality = "none" | "weak" | "ok" | "strong";
export type AuditGrade = "A" | "B" | "C" | "D" | "F";
export type WebsiteAudit = {
  hasWebsite: boolean;
  url?: string;
  reachable: boolean;           // the site actually loaded
  homepageHeadline?: string;    // first H1 / hero line found
  ctaQuality: Quality;          // "Get a Free Quote" style calls-to-action
  mobileReady: boolean;         // mobile viewport present
  hasQuoteForm: boolean;        // a contact/quote/estimate form
  hasCallButton: boolean;       // tel: link / click-to-call
  hasTrustSignals: boolean;     // reviews/testimonials/badges on the page
  seoTitle?: string;            // <title> text
  seoTitleQuality: Quality;
  serviceArea?: string;         // "serving <area>" text detected
  platform?: string;            // builder fingerprint (Wix/GoDaddy/…)
  grade: AuditGrade;            // A–F overall
  score: number;                // 0–100 site-health (higher = healthier site)
  findings: string[];           // human-readable gaps
  summary: string;              // one-line plain-English summary
};

// ── Offer generator (lib/offer.ts) ──────────────────────────────────────────
export type OfferKey =
  | "website-rebuild"
  | "seo"
  | "gbp"
  | "missed-call-textback"
  | "ai-chatbot"
  | "booking-system"
  | "ads-management"
  | "lead-system";
export type OfferRec = {
  offer: OfferKey;
  label: string;
  reason: string;               // why THIS offer fits THIS lead
  priceLow: number;             // suggested price band, whole dollars
  priceHigh: number;
  recurring: boolean;           // monthly retainer vs one-time project
  alternatives: { offer: OfferKey; label: string }[];
};

// ── Message writer (lib/intelMessages.ts) — approval-gated, never auto-sent ──
export type IntelChannel = "facebook" | "email" | "phone" | "followUp" | "auditSummary";
export type IntelMessage = {
  channel: IntelChannel;
  label: string;
  subject?: string;             // email/follow-up only
  body: string;
  approved: boolean;            // owner must approve before any send
  generatedAt: string;         // ISO
};
export type IntelMessages = Partial<Record<IntelChannel, IntelMessage>>;

// ── CRM pipeline (10 stages, kept separate from leads.status) ────────────────
export const PIPELINE_STAGES = [
  "New",
  "Scored",
  "Message Ready",
  "Approved to Contact",
  "Contacted",
  "Interested",
  "Demo Sent",
  "Follow Up",
  "Closed Won",
  "Closed Lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
// Stages that count as live pipeline dollars (open, not yet won/lost).
export const OPEN_STAGES: PipelineStage[] = [
  "Message Ready",
  "Approved to Contact",
  "Contacted",
  "Interested",
  "Demo Sent",
  "Follow Up",
];

export const leadIntel = pgTable("lead_intel", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().unique(),
  clerkUserId: text("clerk_user_id"),
  stage: text("stage").$type<PipelineStage>().default("New"),
  audit: jsonb("audit").$type<WebsiteAudit>(),
  auditAt: timestamp("audit_at", { withTimezone: true }),
  recommendedOffer: jsonb("recommended_offer").$type<OfferRec>(),
  // Approval-gated drafts, one per channel. Nothing here is ever auto-sent.
  messages: jsonb("messages").$type<IntelMessages>().default({}),
  aiNotes: text("ai_notes"),
  scoreReason: text("score_reason"),
  // Owner-estimated / AI-estimated deal size in whole dollars. Drives pipeline $.
  estimatedDealValue: integer("estimated_deal_value"),
  nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type LeadIntel = typeof leadIntel.$inferSelect;
export type InsertLeadIntel = typeof leadIntel.$inferInsert;
