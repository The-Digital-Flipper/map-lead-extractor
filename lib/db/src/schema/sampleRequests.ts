import { pgTable, serial, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

// One row per "see 5 free sample leads" interaction on the pack widget.
//
// The row is created when a visitor VIEWS the (masked) samples — email is null
// at that point. When they enter an email to unlock full contact details, the
// same row is updated with `email` + `unlockedAt`. So this table doubles as:
//   1) the email-capture / lead list (rows WHERE email IS NOT NULL), and
//   2) a funnel metric (viewed-samples vs. unlocked) for the sample flow.
//
// `leadIds` pins the exact 5 leads shown so the unlock reveals the same set the
// visitor already saw (no bait-and-switch).
export const sampleRequests = pgTable("sample_requests", {
  id: serial("id").primaryKey(),

  // Captured on unlock. Null while the visitor has only viewed masked samples.
  email: text("email"),

  // What they asked for (mirrors the pack filter fields).
  rawRequest: text("raw_request"),                   // free-text, if that path was used
  category: text("category").notNull().default(""),  // ILIKE term, e.g. "roof"
  label: text("label").notNull().default(""),        // human label, e.g. "Roofers"
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),        // 2-letter, or ""

  // The exact leads shown in the sample, in display order.
  leadIds: jsonb("lead_ids").$type<number[]>().notNull().default([]),

  // Lightweight abuse/analytics context.
  ip: text("ip"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }),

  // ── Buyer follow-up nurture ────────────────────────────────────────────────
  // Unguessable token for the one-click unsubscribe link in the follow-up email.
  unsubToken: text("unsub_token"),
  // When we emailed the "get the other 95" nudge (null = not yet).
  followedUpAt: timestamp("followed_up_at", { withTimezone: true }),
  // Set when the person opts out of follow-ups (hard-stops the nurture).
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
}, (t) => [
  index("sample_requests_email_idx").on(t.email),
  index("sample_requests_created_idx").on(t.createdAt),
  index("sample_requests_unsub_token_idx").on(t.unsubToken),
]);

export type SampleRequest = typeof sampleRequests.$inferSelect;
export type InsertSampleRequest = typeof sampleRequests.$inferInsert;
