/**
 * Monthly lead-pack subscriptions — recurring revenue on top of the one-off
 * pack pipeline.
 *
 * A buyer subscribes ("100 fresh leads every month, $24/mo") through Stripe
 * Checkout in subscription mode. No webhooks: a poller (same pattern as
 * packWorker's payment promotion) watches awaiting_payment rows until the
 * session completes, then every ~30 days mints a REGULAR pack_orders row
 * (status "building", paid) so fulfillment, owner review, delivery emails and
 * refund logic all ride the existing pack pipeline untouched.
 *
 * Each month's mint first re-verifies the Stripe subscription is still
 * active/trialing; a canceled or delinquent subscription flips the row to
 * canceled and pings the owner. The owner can cancel any subscription from
 * the Stripe dashboard; buyers cancel by replying to any delivery email.
 */
import { db, packOrders, packSubscriptions, type PackSubscription } from "@workspace/db";
import { and, asc, eq, isNotNull, lte } from "drizzle-orm";
import { logger } from "./logger";
import { getUncachableStripeClient } from "../stripeClient";
import { newOrderToken } from "./packWorker";
import { notifyOwner } from "./alerts";

export const MONTHLY_PACK = { leadCount: 100, priceCents: 2400 }; // vs $29 one-off

const TICK_MS = 5 * 60 * 1000;
const FIRST_TICK_DELAY_MS = 60_000;
const FULFILL_EVERY_MS = 30 * 86_400_000;
const BUILD_DEADLINE_MS = 24 * 60 * 60 * 1000;

let tickInFlight = false;

/** Mint this month's pack order for an active subscription. The order starts
 * in "building" with paidAt set — the invoice was already collected by Stripe
 * billing, so it skips awaiting_payment entirely. */
async function mintMonthlyOrder(sub: PackSubscription): Promise<void> {
  const now = new Date();
  await db.insert(packOrders).values({
    token: newOrderToken(),
    stripeSessionId: sub.stripeSessionId, // audit trail back to the subscription
    amountCents: sub.priceCents,
    email: sub.email,
    rawRequest: sub.rawRequest,
    category: sub.category,
    label: sub.label,
    city: sub.city,
    state: sub.state,
    requested: sub.leadCount,
    status: "building",
    paidAt: now,
    deadlineAt: new Date(now.getTime() + BUILD_DEADLINE_MS),
  });
  await db.update(packSubscriptions).set({
    lastFulfilledAt: now,
    nextFulfillAt: new Date(now.getTime() + FULFILL_EVERY_MS),
    updatedAt: now,
  }).where(eq(packSubscriptions.id, sub.id));
  logger.info({ subId: sub.id, email: sub.email }, "Monthly pack order minted");
}

async function cancelSub(sub: PackSubscription, why: string): Promise<void> {
  await db.update(packSubscriptions).set({
    status: "canceled", canceledAt: new Date(), nextFulfillAt: null, updatedAt: new Date(),
  }).where(eq(packSubscriptions.id, sub.id));
  logger.info({ subId: sub.id, why }, "Subscription canceled");
  void notifyOwner({
    subject: `Subscription ended: ${sub.email ?? "unknown buyer"}`,
    text: `The monthly lead-pack subscription for ${sub.email ?? "a buyer"} (${sub.label || sub.category}${sub.city ? `, ${sub.city}` : ""}) ended.\n\nReason: ${why}`,
  });
}

async function subscriptionTick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    // 1) Promote paid checkouts → active (and pull the buyer's email).
    const pending = await db.select().from(packSubscriptions)
      .where(eq(packSubscriptions.status, "awaiting_payment")).orderBy(asc(packSubscriptions.id)).limit(20);
    for (const sub of pending) {
      try {
        const stripe = await getUncachableStripeClient();
        const session = await stripe.checkout.sessions.retrieve(sub.stripeSessionId);
        if (session.status === "complete" && session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          await db.update(packSubscriptions).set({
            status: "active",
            stripeSubscriptionId: subId,
            email: session.customer_details?.email ?? sub.email,
            nextFulfillAt: new Date(), // first pack goes out right away
            updatedAt: new Date(),
          }).where(eq(packSubscriptions.id, sub.id));
          logger.info({ subId: sub.id }, "Subscription activated");
          void notifyOwner({
            subject: `🎉 New monthly subscriber: ${session.customer_details?.email ?? "unknown"}`,
            text: `${session.customer_details?.email ?? "A buyer"} subscribed to ${sub.leadCount} leads/month (${sub.label || sub.category}${sub.city ? `, ${sub.city}` : ""}) at $${(sub.priceCents / 100).toFixed(2)}/mo.\n\nTheir first pack is being built now and will land in your review queue as usual.`,
            sms: `🎉 New $${(sub.priceCents / 100).toFixed(0)}/mo subscriber: ${session.customer_details?.email ?? "unknown"}`,
          });
        } else if (session.status === "expired") {
          await cancelSub(sub, "checkout expired before payment");
        }
      } catch (err) {
        logger.error({ err, subId: sub.id }, "Subscription payment check failed");
      }
    }

    // 2) Monthly fulfillment for active subs that are due.
    const due = await db.select().from(packSubscriptions).where(and(
      eq(packSubscriptions.status, "active"),
      isNotNull(packSubscriptions.nextFulfillAt),
      lte(packSubscriptions.nextFulfillAt, new Date()),
    )).orderBy(asc(packSubscriptions.nextFulfillAt)).limit(10);
    for (const sub of due) {
      try {
        if (sub.stripeSubscriptionId) {
          const stripe = await getUncachableStripeClient();
          const s = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
          if (s.status !== "active" && s.status !== "trialing") {
            await cancelSub(sub, `Stripe subscription status is "${s.status}"`);
            continue;
          }
        }
        await mintMonthlyOrder(sub);
      } catch (err) {
        logger.error({ err, subId: sub.id }, "Monthly fulfillment failed");
      }
    }
  } catch (err) {
    logger.error({ err }, "Subscription tick failed");
  } finally {
    tickInFlight = false;
  }
}

export function startSubscriptionScheduler(): void {
  setTimeout(() => void subscriptionTick(), FIRST_TICK_DELAY_MS);
  setInterval(() => void subscriptionTick(), TICK_MS);
  logger.info("Pack subscription scheduler started");
}
