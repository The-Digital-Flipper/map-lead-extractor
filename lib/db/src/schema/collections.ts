import { pgTable, serial, integer, text, boolean, timestamp, unique, index } from "drizzle-orm/pg-core";

// A Saved Lead Collection — a named, per-member bucket of leads from the shared
// pool. Ownership is keyed by clerkUserId, mirroring lead_notes. Members curate
// their own collections; the underlying leads stay in the shared pool.
export const collections = pgTable(
  "collections",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    name: text("name").notNull(),
    color: text("color"),
    archived: boolean("archived").default(false).notNull(),
    // Manual ordering for the member's list (lower = higher up).
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byUser: index("idx_collections_user").on(t.clerkUserId),
  }),
);

// Membership join. A lead can belong to a collection only once
// (uniq_collection_lead prevents duplicate membership).
export const collectionLeads = pgTable(
  "collection_leads",
  {
    id: serial("id").primaryKey(),
    collectionId: integer("collection_id").notNull(),
    leadId: integer("lead_id").notNull(),
    // Denormalized owner for fast filtering and an extra ownership guard.
    clerkUserId: text("clerk_user_id").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqMember: unique("uniq_collection_lead").on(t.collectionId, t.leadId),
    byCollection: index("idx_collection_leads_collection").on(t.collectionId),
    byUser: index("idx_collection_leads_user").on(t.clerkUserId),
  }),
);

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = typeof collections.$inferInsert;
export type CollectionLead = typeof collectionLeads.$inferSelect;
