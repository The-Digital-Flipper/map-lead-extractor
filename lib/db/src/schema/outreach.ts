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
  // Sender identity. fromEmail MUST be a Resend-verified address (or the shared
  // onboarding@resend.dev while testing). replyTo lets replies land in a real
  // inbox even when fromEmail is a no-reply.
  fromName: text("from_name").notNull().default("Gulf Coast"),
  fromEmail: text("from_email"),
  replyTo: text("reply_to"),
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

export type OutreachSettings = typeof outreachSettings.$inferSelect;
export type OutreachEmail = typeof outreachEmails.$inferSelect;
export type InsertOutreachEmail = typeof outreachEmails.$inferInsert;
