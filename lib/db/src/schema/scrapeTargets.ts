import { pgTable, serial, text, numeric, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";

// AI-researched (or manually added) places to scrape: a category × location to
// pull Google Maps leads from, ranked by estimated opportunity. The scraper and
// the admin map both read from this table — it's the "where to scrape" plan.
export const scrapeTargets = pgTable("scrape_targets", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  // Approximate coordinates of the location, so the admin map can pin it.
  lat: numeric("lat"),
  lng: numeric("lng"),
  // 0-100 AI estimate of how much sellable opportunity is here (weak-web
  // businesses that are reachable). Drives ranking + pin colour.
  priority: integer("priority").default(50),
  // One-line AI rationale, e.g. "Storm-season roofers, many with no website".
  reason: text("reason"),
  // Rough number of leads the AI expects this search to yield.
  estLeads: integer("est_leads"),
  // Whether the scraper should include this target in runs.
  active: boolean("active").default(true),
  source: text("source").default("ai"), // ai | manual
  // Coverage tracking — updated each time this target is scraped.
  lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
  leadCount: integer("lead_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  // One row per category+location.
  uniqCatLoc: unique("scrape_targets_cat_loc").on(t.category, t.location),
}));

export type ScrapeTarget = typeof scrapeTargets.$inferSelect;
export type InsertScrapeTarget = typeof scrapeTargets.$inferInsert;
