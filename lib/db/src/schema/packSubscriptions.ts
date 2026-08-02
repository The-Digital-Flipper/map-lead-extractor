import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

// One row per monthly lead-pack subscription ("100 fresh leads every month").
// No webhooks — the subscription worker polls Stripe, same as pack orders:
// awaiting_payment rows are checked until the Checkout session is paid, then
// each month a normal pack_orders row is minted (status "building", paid) so
// fulfillment rides the existing pack pipeline + owner review flow.
export type PackSubscriptionStatus =
  | "awaiting_payment" // Stripe session created, not yet completed
  | "active"           // paying; worker mints a pack order every month
  | "canceled";        // buyer or owner ended it (or payments stopped)

export const packSubscriptions = pgTable("pack_subscriptions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),

  stripeSessionId: text("stripe_session_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  priceCents: integer("price_cents").notNull(),

  email: text("email"),
  rawRequest: text("raw_request"),
  category: text("category").notNull().default(""),
  label: text("label").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  leadCount: integer("lead_count").notNull().default(100),

  status: text("status").$type<PackSubscriptionStatus>().notNull().default("awaiting_payment"),
  lastFulfilledAt: timestamp("last_fulfilled_at", { withTimezone: true }),
  nextFulfillAt: timestamp("next_fulfill_at", { withTimezone: true }),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("pack_subscriptions_status_idx").on(t.status),
]);

export type PackSubscription = typeof packSubscriptions.$inferSelect;
export type InsertPackSubscription = typeof packSubscriptions.$inferInsert;
