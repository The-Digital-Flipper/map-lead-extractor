import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Owner-uploaded override for a landing page's share/ad picture.
//
// The default pictures ship as static files at public/go/<slug>.jpg, but those
// live in the build and get overwritten on every deploy — so an in-app upload
// can't just write to disk (Replit's autoscale filesystem is ephemeral and
// rebuilt each release). Instead the owner's chosen image is stored here, and
// the /go/<slug>.jpg route serves this row when present, otherwise falls back
// to the bundled default. `data` is the raw image base64-encoded (kept as text
// for portability — packs are a few hundred KB, well within a Postgres row).
export const landingImages = pgTable("landing_images", {
  slug: text("slug").primaryKey(),
  mime: text("mime").notNull().default("image/jpeg"),
  data: text("data").notNull(), // base64-encoded image bytes
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type LandingImage = typeof landingImages.$inferSelect;
export type InsertLandingImage = typeof landingImages.$inferInsert;
