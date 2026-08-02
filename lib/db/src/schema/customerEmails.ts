import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

// ── Customer marketing emails ────────────────────────────────────────────────
// These tables back the admin "Email customers" blast: the owner writes one
// message and sends it to their CUSTOMERS — people who gave an email for free
// samples (sample_requests) and/or bought a pack (pack_orders). This is a
// separate world from the cold-outreach engine (which emails `leads` rows,
// i.e. businesses we pitch services to).

// One row per customer email actually sent. Doubles as:
//   1) the "last emailed" guard so blasts don't hammer the same person, and
//   2) the unsubscribe lookup — each sent mail carries a per-row unsubToken.
export const customerEmails = pgTable("customer_emails", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),            // recipient, lowercased
  subject: text("subject").notNull(),
  // Unguessable token in this mail's unsubscribe link / List-Unsubscribe header.
  unsubToken: text("unsub_token").notNull(),
  providerId: text("provider_id"),           // Gmail/Resend message id, if any
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("customer_emails_email_idx").on(t.email),
  index("customer_emails_unsub_token_idx").on(t.unsubToken),
  index("customer_emails_sent_idx").on(t.sentAt),
]);

// Hard suppression list for customer emails — one row per opted-out address.
// Checked (together with sample_requests.unsubscribedAt) before every send.
export const emailOptOuts = pgTable("email_opt_outs", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),   // lowercased
  source: text("source"),                    // e.g. "blast-unsub", "manual"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CustomerEmail = typeof customerEmails.$inferSelect;
export type InsertCustomerEmail = typeof customerEmails.$inferInsert;
export type EmailOptOut = typeof emailOptOuts.$inferSelect;
