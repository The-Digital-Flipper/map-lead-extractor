import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

// One row per pageview across the whole public site. The client fires a beacon
// on every route change; the server stamps device/browser/os from the UA.
// visitor_id is an anonymous first-party id (localStorage UUID) — no PII.
export const siteVisits = pgTable("site_visits", {
  id: serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  // Rotates per browser session — lets us count sessions, not just visitors.
  sessionId: text("session_id"),
  path: text("path").notNull(),
  referrer: text("referrer"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  device: text("device"),   // desktop | mobile | tablet
  browser: text("browser"),
  os: text("os"),
  country: text("country"),
  screenWidth: integer("screen_width"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("site_visits_created_at_idx").on(t.createdAt),
  index("site_visits_visitor_id_idx").on(t.visitorId),
]);

export type SiteVisit = typeof siteVisits.$inferSelect;
export type InsertSiteVisit = typeof siteVisits.$inferInsert;
