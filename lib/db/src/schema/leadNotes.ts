import { pgTable, serial, integer, text, jsonb, timestamp, boolean, unique } from "drizzle-orm/pg-core";

// Private, per-member notes + tags on a lead. The lead pool is shared, so a note
// is keyed by (leadId, clerkUserId) — each member sees only their own notes.
// This is the "my work lives here" data that makes a member stay.
export const leadNotes = pgTable("lead_notes", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),
  clerkUserId: text("clerk_user_id").notNull(),
  note: text("note"),
  tags: jsonb("tags").$type<string[]>().default([]),
  // Follow-up reminder: when to chase this lead + whether it's been handled.
  reminderAt: timestamp("reminder_at", { withTimezone: true }),
  reminderDone: boolean("reminder_done").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  uniqMemberLead: unique("uniq_member_lead").on(t.leadId, t.clerkUserId),
}));

export type LeadNote = typeof leadNotes.$inferSelect;
export type InsertLeadNote = typeof leadNotes.$inferInsert;
