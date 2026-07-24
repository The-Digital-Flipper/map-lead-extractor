import { pgTable, serial, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";

// Rich-content model — mirrors the shape used by the static site's
// src/data/posts.ts so the same renderer works for both hand-written and
// AI-generated posts.
export type BlogTextPart = { type: "text"; value: string };
export type BlogLinkPart = { type: "link"; href: string; value: string };
export type BlogPart = BlogTextPart | BlogLinkPart;
export type BlogSection = {
  type: "h2" | "h3" | "p" | "ul" | "ol" | "tip";
  text?: string;
  parts?: BlogPart[];
  items?: string[];
};

// AI-written blog posts. The daily scheduler generates one and inserts it as
// "published"; the API server serves each as crawlable HTML (matching the
// prerendered static posts) and adds it to the sitemap. `content` holds the
// same Section[] structure the static blog uses.
export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("Strategy"),
  authorName: text("author_name").notNull().default("MapLeadExtractor Team"),
  readTime: text("read_time").notNull().default("5 min read"),
  content: jsonb("content").$type<BlogSection[]>().notNull(),
  status: text("status").notNull().default("published"), // published | draft
  datePublished: timestamp("date_published", { withTimezone: true }).defaultNow().notNull(),
  dateModified: timestamp("date_modified", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("blog_posts_status_idx").on(t.status),
  index("blog_posts_date_published_idx").on(t.datePublished),
]);

// Singleton settings row (id = 1): pause/resume the daily writer and pick the
// hour it publishes, without a redeploy.
export const blogSettings = pgTable("blog_settings", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(true),
  // Hour of day (0-23, UTC) the daily post publishes.
  postHourUtc: integer("post_hour_utc").notNull().default(13),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Hero photos for blog posts (one per slug, AI-generated; served at
// /api/blog/hero/<slug>.jpg). Also created idempotently in lib/blogImages.ts —
// declared here so drizzle-kit push knows the table and leaves it alone.
export const blogImages = pgTable("blog_images", {
  slug: text("slug").primaryKey(),
  mime: text("mime").notNull(),
  data: text("data").notNull(), // base64
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = typeof blogPosts.$inferInsert;
export type BlogSettings = typeof blogSettings.$inferSelect;
export type BlogImage = typeof blogImages.$inferSelect;
