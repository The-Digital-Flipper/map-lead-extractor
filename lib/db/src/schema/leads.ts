import { pgTable, serial, text, numeric, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

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
  gmapsUrl: text("gmaps_url"),
  plusCode: text("plus_code"),
  raw: jsonb("raw"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
