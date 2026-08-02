import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

// Real buyer reviews, collected via the post-delivery email link (/review?token=...).
// One per pack order, keyed to the order's unguessable token so only actual
// buyers can submit. Nothing shows on the site until the owner approves it in
// the admin dashboard.
export type TestimonialStatus = "pending" | "approved" | "hidden";

export const testimonials = pgTable("testimonials", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().unique(),
  name: text("name").notNull(),
  business: text("business"),
  rating: integer("rating").notNull(), // 1..5
  quote: text("quote").notNull(),
  status: text("status").$type<TestimonialStatus>().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("testimonials_status_idx").on(t.status),
]);

export type Testimonial = typeof testimonials.$inferSelect;
export type InsertTestimonial = typeof testimonials.$inferInsert;
