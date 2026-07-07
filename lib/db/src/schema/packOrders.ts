import { pgTable, serial, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";

// One row per lead-pack order (EVERY order — in-stock and build-to-order).
// A background worker (lib/packWorker.ts) gathers leads if needed, snapshots
// the pack, then parks the order for the owner's manual review. Nothing is
// sent to the buyer until the owner clicks Send in the admin dashboard; that
// emails the download link (and auto-refunds the shortfall on a partial).
export type PackOrderStatus =
  | "awaiting_payment" // Stripe session created, not yet paid
  | "building"         // paid; worker is gathering leads
  | "needs_review"     // leads snapshotted; waiting for the owner to hit Send
  | "ready"            // owner approved; 100 delivered
  | "partial"          // owner approved; fewer than 100 delivered, shortfall refunded
  | "failed";          // checkout expired/unpaid, or unrecoverable error

export const packOrders = pgTable("pack_orders", {
  id: serial("id").primaryKey(),
  // Unguessable token used in the customer's download link + status page.
  token: text("token").notNull().unique(),

  // Stripe linkage.
  stripeSessionId: text("stripe_session_id").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amountCents: integer("amount_cents").notNull().default(2900),
  refundedCents: integer("refunded_cents").notNull().default(0),

  // Buyer + request (email is filled from the paid Stripe session).
  email: text("email"),
  rawRequest: text("raw_request"),        // what the customer typed
  category: text("category").notNull().default(""), // ILIKE search term, e.g. "plumb"
  label: text("label").notNull().default(""),       // human label, e.g. "Plumbers"
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),       // 2-letter, or ""

  status: text("status").$type<PackOrderStatus>().notNull().default("awaiting_payment"),
  requested: integer("requested").notNull().default(100),
  delivered: integer("delivered").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  // The specific leads snapshotted for THIS buyer at fulfillment time.
  leadIds: jsonb("lead_ids").$type<number[]>(),
  lastError: text("last_error"),

  deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  readyAt: timestamp("ready_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("pack_orders_status_idx").on(t.status),
  index("pack_orders_token_idx").on(t.token),
]);

export type PackOrder = typeof packOrders.$inferSelect;
export type InsertPackOrder = typeof packOrders.$inferInsert;
