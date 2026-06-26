import { pgTable, serial, text, numeric, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  key: text("key").unique().notNull(),
  name: text("name"),
  phone: text("phone"),
  emails: text("emails"),
  website: text("website"),
  social: text("social"),
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
