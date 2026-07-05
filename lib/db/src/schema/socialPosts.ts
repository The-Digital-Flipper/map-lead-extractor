import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";

// Auto-poster queue + history. AI-generated posts land here as "queued"; the
// scheduler publishes one per day to the connected platform and flips the row
// to "posted" (or "failed" with the error kept for the admin UI).
export const socialPosts = pgTable("social_posts", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull().default("facebook"),
  body: text("body").notNull(),
  // One short line on why this post works — shown in the admin queue.
  note: text("note"),
  status: text("status").notNull().default("queued"), // queued | posted | failed
  error: text("error"),
  externalId: text("external_id"),   // platform post id (e.g. FB "pageid_postid")
  externalUrl: text("external_url"), // direct link to the live post
  // Last publish attempt (success or failure) — lets the scheduler back off
  // instead of hammering a broken token every tick.
  attemptedAt: timestamp("attempted_at", { withTimezone: true }),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  // AI-generated image, stored as base64 PNG right in the row (deploy fs is
  // ephemeral). List endpoints must exclude this column — it's megabytes.
  imageB64: text("image_b64"),
  // Engagement pulled from the Graph API after publishing; null = never synced.
  likes: integer("likes"),
  comments: integer("comments"),
  shares: integer("shares"),
  impressions: integer("impressions"),
  statsSyncedAt: timestamp("stats_synced_at", { withTimezone: true }),
}, (t) => [
  index("social_posts_status_idx").on(t.status),
  index("social_posts_posted_at_idx").on(t.postedAt),
]);

// Singleton settings row (id = 1) so the admin UI can pause/resume and pick
// the daily posting hour without a redeploy.
export const socialSettings = pgTable("social_settings", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(true),
  // Hour of day (0-23, UTC) the daily post goes out.
  postHourUtc: integer("post_hour_utc").notNull().default(14),
  // Top the queue back up with AI-generated posts when it runs low.
  autoRefill: boolean("auto_refill").notNull().default(true),
  // Facebook connection, filled by the admin "Connect Facebook" OAuth flow so
  // no env secrets are needed: app credentials, the long-lived user token from
  // the OAuth exchange, and the selected Page's id/name/token.
  fbAppId: text("fb_app_id"),
  fbAppSecret: text("fb_app_secret"),
  fbUserToken: text("fb_user_token"),
  fbPageId: text("fb_page_id"),
  fbPageName: text("fb_page_name"),
  fbPageToken: text("fb_page_token"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Facebook Groups the admin posts to by hand. Meta killed the Groups API in
// 2024, so the app can't publish for them — instead the Social tab keeps a
// queue of group-flavored posts and a one-click "copy post + open group" flow,
// and this table remembers each group and when it last got a post.
export const socialGroups = pgTable("social_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  notes: text("notes"),
  postCount: integer("post_count").notNull().default(0),
  lastPostedAt: timestamp("last_posted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;
export type SocialSettings = typeof socialSettings.$inferSelect;
export type SocialGroup = typeof socialGroups.$inferSelect;
