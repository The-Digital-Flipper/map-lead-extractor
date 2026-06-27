import { pgTable, serial, text, numeric, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  key: text("key").unique().notNull(),
  clerkUserId: text("clerk_user_id"),
  name: text("name"),
  phone: text("phone"),
  emails: text("emails"),
  website: text("website"),
  social: text("social"),
  facebook: text("facebook"),
  instagram: text("instagram"),
  twitter: text("twitter"),
  linkedin: text("linkedin"),
  address: text("address"),
  category: text("category"),
  rating: numeric("rating"),
  reviewCount: integer("review_count"),
  score: integer("score").default(0),
  // Opportunity score (0-100): HIGH = weak online presence + reachable =
  // a prime business to sell websites / SEO / ads / reputation / automation to.
  // This is the inverse intent of `score` (which measures profile completeness).
  opportunityScore: integer("opportunity_score").default(0),
  // Human-readable weakness tags backing the opportunity score, e.g.
  // ["No website", "Few reviews", "No social"]. Drives the sales pitch.
  needs: jsonb("needs").$type<string[]>().default([]),
  // ── Demand signals (how much members want this lead) ──────────────────────
  // Total number of times any member extracted/saved this business.
  timesExtracted: integer("times_extracted").default(1),
  // Distinct member (clerk user) ids that have extracted this business.
  // Length = how many different members independently wanted it.
  extractedBy: jsonb("extracted_by").$type<string[]>().default([]),
  // Demand score 0-100 derived from the two signals above.
  demandScore: integer("demand_score").default(0),
  // Composite value 0-100 = need (opportunity) blended with demand. The single
  // "which leads are most valuable" ranking number.
  valueScore: integer("value_score").default(0),
  gmapsUrl: text("gmaps_url"),
  plusCode: text("plus_code"),
  raw: jsonb("raw"),
  status: text("status").default("new"), // new | contacted | converted | not_interested
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
