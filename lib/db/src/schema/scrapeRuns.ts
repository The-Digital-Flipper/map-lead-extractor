import { pgTable, serial, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

// One row per "Run" of the Google Maps scraper, Apify-style: an input
// (category + location), a status, and the resulting dataset (the parsed
// places) so the admin Scraper tab can show live status + a run history +
// a browsable/exportable dataset per run, instead of a fire-and-forget test.
export type ScrapedItem = {
  name: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  reviews: number | null;
};

// Which scraping engine a run used — each maps to its own lib/scrape*.ts module.
export type ScrapePlatform = "google_maps" | "yelp" | "bing_maps";

export const scrapeRuns = pgTable("scrape_runs", {
  id: serial("id").primaryKey(),
  // Null for admin-triggered runs (the internal dashboard); set for runs
  // started from the public Scraper page, so each customer only sees their own.
  clerkUserId: text("clerk_user_id"),
  platform: text("platform").$type<ScrapePlatform>().notNull().default("google_maps"),
  category: text("category").notNull(),
  location: text("location"),
  status: text("status").notNull().default("running"), // running | succeeded | failed
  placesFound: integer("places_found"),
  saved: integer("saved"),
  duplicates: integer("duplicates"),
  error: text("error"),
  // The run's dataset — every place the scrape parsed off Google Maps.
  items: jsonb("items").$type<ScrapedItem[]>(),
  durationMs: integer("duration_ms"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (t) => [
  index("scrape_runs_started_at_idx").on(t.startedAt),
  index("scrape_runs_clerk_user_id_idx").on(t.clerkUserId),
  index("scrape_runs_platform_idx").on(t.platform),
]);

export type ScrapeRun = typeof scrapeRuns.$inferSelect;
export type InsertScrapeRun = typeof scrapeRuns.$inferInsert;
