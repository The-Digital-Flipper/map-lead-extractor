import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

// Singleton settings row (id = 1) for the automated email outreach engine. The
// dashboard reads/writes this so the owner can tune sending without a redeploy.
// The engine sends personalized, grounded outreach on a human-like cadence:
// only inside a daily time window, spaced out with random gaps, under a daily
// cap — so a sequence reads like a real person working their inbox, not a blast.
export const outreachSettings = pgTable("outreach_settings", {
  id: integer("id").primaryKey().default(1),
  // Master switch. Off until the owner sets a verified from-address and turns
  // it on — nothing sends while this is false.
  enabled: boolean("enabled").notNull().default(false),
  // How mail goes out: "gmail" = the owner's Gmail over SMTP (creds in the
  // GMAIL_USER / GMAIL_APP_PASSWORD secrets), "resend" = Resend API + verified
  // domain. Gmail is the zero-cost, most-personal option; Resend scales better.
  provider: text("provider").notNull().default("gmail"),
  // Sender identity — all owner-provided, nothing assumed. fromName signs the
  // emails (blank = no sign-off name). fromEmail (Resend only) MUST be a
  // Resend-verified address. replyTo lets replies land wherever the owner wants.
  fromName: text("from_name").notNull().default(""),
  fromEmail: text("from_email"),
  replyTo: text("reply_to"),
  // What the owner is offering / pitching in the emails, in their own words
  // (e.g. "we buy used cars for cash, fast pickup"). The AI writes every email
  // around THIS — there is no default pitch. Blank = can't generate outreach.
  offer: text("offer"),
  // Plain-text signature appended under every email body (before the footer).
  signature: text("signature"),
  // Physical mailing address shown in the footer — required for compliant bulk
  // email and, just as importantly, keeps messages out of the spam folder.
  businessAddress: text("business_address"),
  // Daily send ceiling. A real person doesn't fire 500 identical emails an hour;
  // capping protects the sending domain's reputation and keeps it human.
  dailyCap: integer("daily_cap").notNull().default(40),
  // Local send window (hours 0-23) and timezone offset from UTC in minutes
  // (US Central Daylight = -300). Emails only go out inside [start,end) local,
  // like office hours. Weekends are skipped unless sendOnWeekends is on.
  windowStartHour: integer("window_start_hour").notNull().default(8),
  windowEndHour: integer("window_end_hour").notNull().default(18),
  tzOffsetMinutes: integer("tz_offset_minutes").notNull().default(-300),
  sendOnWeekends: boolean("send_on_weekends").notNull().default(false),
  // Random gap between two consecutive sends (minutes). The scheduler waits a
  // fresh random value in [min,max] after each send so the outbound rhythm is
  // irregular and organic instead of clockwork.
  minGapMinutes: integer("min_gap_minutes").notNull().default(9),
  maxGapMinutes: integer("max_gap_minutes").notNull().default(27),
  // Automatically enroll a lead the moment it's marked contacted (first email
  // sent by hand) so its follow-ups then run themselves.
  autoEnrollOnContact: boolean("auto_enroll_on_contact").notNull().default(false),
  // One-click auto-replies: when a lead answers, the AI writes and sends a
  // grounded response on its own (Gmail inbox watched over IMAP). Capped per
  // lead so a human always takes over a real conversation.
  autoReply: boolean("auto_reply").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per outreach email the engine sends (or tries to). Backs the daily
// cap count, the dashboard activity feed, and a permanent audit trail.
export const outreachEmails = pgTable("outreach_emails", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  // Which touch this was: 1 = first email, 2 = follow-up 1, etc.
  step: integer("step").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("sent"), // sent | failed
  error: text("error"),
  // Resend message id, and the RFC Message-ID header we stamp so follow-ups can
  // thread as replies (In-Reply-To / References) under the first email.
  providerId: text("provider_id"),
  messageId: text("message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("outreach_emails_lead_idx").on(t.leadId),
  index("outreach_emails_created_idx").on(t.createdAt),
]);

// Two-way conversation log for the reply automation: one row per inbound reply
// a lead sends us ("in") and per AI-written response we send back ("out").
// Inbound rows are deduped by messageId so re-scanning the inbox is idempotent.
export const outreachReplies = pgTable("outreach_replies", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  direction: text("direction").notNull(), // in | out
  fromEmail: text("from_email").notNull(),
  subject: text("subject"),
  // The reply text with quoted history stripped (inbound), or the full body we
  // sent (outbound).
  body: text("body").notNull(),
  // RFC Message-ID of this message — dedupe key for inbound, thread anchor for
  // the response we send.
  messageId: text("message_id").unique(),
  // Outbound only: sent | failed (+ error). Inbound rows stay "received".
  status: text("status").notNull().default("received"),
  error: text("error"),
  // Outbound only: true when the AI wrote and sent it without a human.
  aiGenerated: boolean("ai_generated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("outreach_replies_lead_idx").on(t.leadId),
  index("outreach_replies_created_idx").on(t.createdAt),
]);

export type OutreachSettings = typeof outreachSettings.$inferSelect;
export type OutreachEmail = typeof outreachEmails.$inferSelect;
export type InsertOutreachEmail = typeof outreachEmails.$inferInsert;
export type OutreachReply = typeof outreachReplies.$inferSelect;
export type InsertOutreachReply = typeof outreachReplies.$inferInsert;
