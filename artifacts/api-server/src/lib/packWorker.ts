/**
 * Build-to-order lead-pack worker.
 *
 * The async half of the "describe what you want" flow: when a buyer pays for a
 * pack we DON'T already have 100 matching leads for, a pack_orders row is
 * created and this scheduler fulfills it in the background — the same in-process
 * setInterval pattern as the outreach scheduler.
 *
 * Per tick (one unit of work, so ticks stay short):
 *   1. Promote a paid order: poll its Stripe session; once paid, capture the
 *      buyer's email + payment intent and move it to "building".
 *   2. Progress one building order: run ONE gather round — a direct-first Google
 *      Maps scrape (the proxy pool is used automatically as a fallback when it
 *      has a working proxy) plus an AI web-search top-up — then re-count.
 *      When 100+ match, finalize and email the download link. If the 24h
 *      deadline (or the attempt cap) is hit while still short, deliver what we
 *      have and auto-refund the shortfall via Stripe.
 */
import crypto from "node:crypto";
import { db, packOrders, leads, type PackOrder } from "@workspace/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { getUncachableStripeClient } from "../stripeClient";
import { acquireScrapeLock, releaseScrapeLock } from "./scrapeLock";
import { scrapeAndSave } from "./scrape";
import { discoverBusinesses } from "./discover";
import { resendConfigured, gmailConfigured, getGmailTransport, gmailAddress } from "./outreach-auto";
import { countPackLeads, packWhere, locationString, LEAD_PACK, type PackFilters } from "./packs";

const TICK_MS = 120_000;
const FIRST_TICK_DELAY_MS = 45_000;
const MAX_ATTEMPTS = 10; // gather rounds before we give up and deliver partial
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "https://mapleadextractor.net";
// Seed metros for "anywhere" requests so a nationwide gather has variety.
const SEED_METROS = [
  "Houston, TX", "Atlanta, GA", "Miami, FL", "Chicago, IL", "Phoenix, AZ",
  "Dallas, TX", "Charlotte, NC", "Nashville, TN", "Columbus, OH", "Tampa, FL",
];

let tickInFlight = false;

function orderFilters(o: PackOrder): PackFilters {
  return { category: o.category, label: o.label, city: o.city, state: o.state };
}

// ── Payment promotion ────────────────────────────────────────────────────────

async function promotePaidOrder(order: PackOrder): Promise<void> {
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
  if (session.payment_status === "paid") {
    const email = session.customer_details?.email ?? order.email ?? null;
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
    await db.update(packOrders).set({
      status: "building", paidAt: new Date(), email, stripePaymentIntentId: pi, updatedAt: new Date(),
    }).where(eq(packOrders.id, order.id));
    logger.info({ orderId: order.id, email }, "pack order paid — building");
  } else if (session.status === "expired") {
    await db.update(packOrders).set({ status: "failed", lastError: "checkout expired", updatedAt: new Date() })
      .where(eq(packOrders.id, order.id));
    logger.info({ orderId: order.id }, "pack order checkout expired");
  }
  // else: still open — leave awaiting_payment, re-check next tick.
}

// ── Gathering ────────────────────────────────────────────────────────────────

const loopbackBase = () => `http://127.0.0.1:${process.env.PORT ?? "5000"}`;

// Save AI-discovered businesses through the same loopback endpoint the scraper
// uses, so they're scored + de-duped identically. Tagged with the order's label
// as their category so the pack's ILIKE filter matches them.
async function saveViaLoopback(rows: Record<string, unknown>[]): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 200) {
    try {
      await fetch(`${loopbackBase()}/api/leads/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(rows.slice(i, i + 200)),
      });
    } catch (err) {
      logger.warn({ err }, "pack worker loopback save failed");
    }
  }
}

// One gather round for an order. Direct-first Google Maps scrape (proxy pool
// used automatically when populated) + an AI top-up. Best-effort: any failure
// is logged and the order simply tries again next tick.
async function gatherRound(order: PackOrder): Promise<void> {
  const f = orderFilters(order);
  const term = order.label || order.category || "local businesses";
  const loc = locationString(f) || SEED_METROS[order.attempts % SEED_METROS.length];

  if (acquireScrapeLock()) {
    try {
      await scrapeAndSave({ category: term, location: loc, maxScrolls: 6 });
    } catch (err) {
      logger.warn({ err, orderId: order.id }, "pack worker scrape round failed");
    } finally {
      releaseScrapeLock();
    }
  } else {
    logger.info({ orderId: order.id }, "scrape lock busy — skipping scrape this round");
  }

  // AI web-search top-up (no browser, no lock). Favors weak-online-presence
  // businesses, which are the pack's whole value proposition.
  try {
    const found = await discoverBusinesses(`${term} in ${loc || "the US"} with a weak online presence`, 20);
    const rows = found.map((b) => ({
      Name: b.name,
      Phone: b.phone ?? "",
      Website: b.website ?? "",
      Address: [b.city, b.state].filter(Boolean).join(", "),
      Category: term,
    }));
    await saveViaLoopback(rows);
  } catch (err) {
    logger.warn({ err, orderId: order.id }, "pack worker AI top-up failed");
  }

  await db.update(packOrders).set({ attempts: sql`${packOrders.attempts} + 1`, updatedAt: new Date() })
    .where(eq(packOrders.id, order.id));
}

// ── Finalization ─────────────────────────────────────────────────────────────

async function topLeadIds(f: PackFilters, limit: number): Promise<number[]> {
  const rows = await db.select({ id: leads.id }).from(leads)
    .where(packWhere(f))
    .orderBy(sql`value_score DESC, opportunity_score DESC`)
    .limit(limit);
  return rows.map((r) => r.id);
}

// Snapshot the best matching leads for this buyer and park the order for the
// owner's manual review. NOTHING goes to the buyer here — the owner's Send
// click (admin dashboard → sendOrder) is what delivers.
async function snapshotForReview(order: PackOrder): Promise<void> {
  const f = orderFilters(order);
  const ids = await topLeadIds(f, order.requested);
  const delivered = ids.length;

  await db.update(packOrders).set({
    status: "needs_review", delivered, leadIds: ids, updatedAt: new Date(),
  }).where(eq(packOrders.id, order.id));
  logger.info({ orderId: order.id, delivered }, "pack order snapshotted — awaiting owner review");

  await notifyOwner({ ...order, status: "needs_review", delivered, leadIds: ids });
}

/** The owner's Send button: refund any shortfall, email the buyer their
 * download link, and mark the order delivered. Admin route calls this. */
export async function sendOrder(orderId: number): Promise<PackOrder> {
  const [order] = await db.select().from(packOrders).where(eq(packOrders.id, orderId));
  if (!order) throw new Error("Order not found.");
  if (order.status !== "needs_review") throw new Error(`Order is ${order.status}, not needs_review.`);
  const delivered = (order.leadIds ?? []).length;
  if (delivered === 0) throw new Error("Order has no snapshotted leads to send.");

  let refundedCents = 0;
  let status: "ready" | "partial" = "ready";
  if (delivered < order.requested) {
    status = "partial";
    const shortfall = order.requested - delivered;
    refundedCents = Math.round(order.amountCents * (shortfall / order.requested));
    if (refundedCents > 0 && order.stripePaymentIntentId) {
      try {
        const stripe = await getUncachableStripeClient();
        await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId, amount: refundedCents });
        logger.info({ orderId: order.id, refundedCents, delivered }, "pack order partial — refunded shortfall");
      } catch (err) {
        logger.error({ err, orderId: order.id }, "pack order refund failed");
        refundedCents = 0; // record 0 so a later manual refund isn't double-counted
      }
    }
  }

  await db.update(packOrders).set({
    status, delivered, refundedCents, readyAt: new Date(), updatedAt: new Date(),
  }).where(eq(packOrders.id, order.id));

  const updated = { ...order, status, delivered, refundedCents } as PackOrder;
  await emailOrder(updated);
  return updated;
}

// ── Email (Resend, Gmail SMTP fallback) ──────────────────────────────────────

function ownerEmail(): string {
  return process.env.PACK_REVIEW_EMAIL || process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || "";
}

// Send through whichever provider is configured — Resend first, Gmail SMTP as
// the fallback (same providers the outreach system uses). Returns whether a
// send was attempted-and-accepted.
async function deliverEmail(to: string, subject: string, html: string, orderId: number): Promise<boolean> {
  if (resendConfigured()) {
    const from = process.env.PACK_FROM_EMAIL || "orders@mapleadextractor.net";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `MapLeadExtractor <${from}>`, to, subject, html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      logger.error({ orderId, status: res.status, body: t.slice(0, 200) }, "pack email via Resend failed");
      return false;
    }
    return true;
  }
  if (gmailConfigured()) {
    await getGmailTransport().sendMail({
      from: `MapLeadExtractor <${gmailAddress()!}>`, to, subject, html,
    });
    return true;
  }
  logger.warn({ orderId }, "no email provider configured (RESEND_API_KEY or GMAIL_USER+GMAIL_APP_PASSWORD) — email NOT sent");
  return false;
}

// Tell the owner a paid order is snapshotted and waiting for their Send click.
async function notifyOwner(order: PackOrder): Promise<void> {
  const to = ownerEmail();
  if (!to) { logger.warn({ orderId: order.id }, "no owner email configured — review notification NOT sent"); return; }
  const delivered = (order.leadIds ?? []).length;
  const what = [order.label || "leads", order.city, order.state].filter(Boolean).join(", ");
  const short = delivered < order.requested
    ? ` (SHORT ${order.requested - delivered} — sending will auto-refund ~$${((order.amountCents * (order.requested - delivered)) / order.requested / 100).toFixed(2)})`
    : "";
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111">
<p><strong>Order #${order.id}</strong> is paid and waiting for your review: <strong>${delivered}/${order.requested}</strong> ${what} leads${short}.</p>
<p>Buyer: ${order.email ?? "(email pending)"} — $${(order.amountCents / 100).toFixed(2)}</p>
<p><a href="${PUBLIC_ORIGIN}/admin" style="display:inline-block;background:#00c853;color:#fff;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none">Review &amp; send in the dashboard</a></p>
<p style="color:#666;font-size:13px">Nothing is sent to the buyer until you click Send.</p>
</div>`;
  try {
    const ok = await deliverEmail(to, `Order #${order.id} needs your review — ${delivered}/${order.requested} ${what} leads`, html, order.id);
    if (ok) logger.info({ orderId: order.id, to }, "owner review notification sent");
  } catch (err) {
    logger.error({ err, orderId: order.id }, "owner review notification threw");
  }
}

async function emailOrder(order: PackOrder): Promise<void> {
  if (!order.email) { logger.warn({ orderId: order.id }, "pack order has no email — cannot send"); return; }
  const link = `${PUBLIC_ORIGIN}/api/leads/pack-order-download?token=${order.token}`;
  const delivered = order.delivered;
  const refundLine = order.refundedCents > 0
    ? `<p>We could only source <strong>${delivered}</strong> leads matching your request, so we've refunded <strong>$${(order.refundedCents / 100).toFixed(2)}</strong> for the shortfall — you were only charged for what we delivered.</p>`
    : "";
  const subject = order.status === "partial"
    ? `Your lead pack is ready (${delivered} leads + partial refund)`
    : `Your ${order.requested} lead pack is ready`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111">
<p>Thanks for your order! Your leads are ready to download.</p>
${refundLine}
<p><a href="${link}" style="display:inline-block;background:#00c853;color:#fff;font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none">⬇ Download your leads (CSV)</a></p>
<p style="color:#666;font-size:13px">Or copy this link: ${link}</p>
<p style="color:#666;font-size:13px">Keep this email — the link lets you re-download anytime.</p>
<p style="margin-top:20px">Happy with your list? <a href="${PUBLIC_ORIGIN}/review?token=${order.token}" style="color:#00a844;font-weight:600">Leave a quick review</a> — it takes 30 seconds and genuinely helps a new business. If anything's off, just reply to this email and we'll make it right.</p>
</div>`;
  try {
    const ok = await deliverEmail(order.email, subject, html, order.id);
    if (ok) logger.info({ orderId: order.id, to: order.email }, "pack order email sent");
  } catch (err) {
    logger.error({ err, orderId: order.id }, "pack order email threw");
  }
}

// ── Tick ─────────────────────────────────────────────────────────────────────

async function progressBuildingOrder(order: PackOrder): Promise<void> {
  const f = orderFilters(order);
  const available = await countPackLeads(f);
  if (available >= order.requested) { await snapshotForReview(order); return; }

  const deadlinePassed = Date.now() > new Date(order.deadlineAt).getTime();
  if (deadlinePassed || order.attempts >= MAX_ATTEMPTS) { await snapshotForReview(order); return; }

  await gatherRound(order);

  // Re-count; snapshot immediately if this round tipped us over.
  if (await countPackLeads(f) >= order.requested) {
    const [fresh] = await db.select().from(packOrders).where(eq(packOrders.id, order.id));
    if (fresh && fresh.status === "building") await snapshotForReview(fresh);
  }
}

export async function packOrdersTick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    // 1. Poll EVERY awaiting-payment order (cheap Stripe reads) — a stale
    // abandoned checkout at the front must never block a paid one behind it.
    const awaiting = await db.select().from(packOrders)
      .where(eq(packOrders.status, "awaiting_payment")).orderBy(asc(packOrders.id)).limit(20);
    for (const order of awaiting) {
      // Give up on orders never paid within the deadline window.
      if (Date.now() > new Date(order.deadlineAt).getTime()) {
        await db.update(packOrders).set({ status: "failed", lastError: "not paid before deadline", updatedAt: new Date() })
          .where(eq(packOrders.id, order.id));
      } else {
        await promotePaidOrder(order).catch((err) => logger.warn({ err, orderId: order.id }, "promote failed"));
      }
    }

    // 2. Progress the oldest building order (the heavy gather work stays
    // one-per-tick so ticks never pile up).
    const [building] = await db.select().from(packOrders)
      .where(eq(packOrders.status, "building")).orderBy(asc(packOrders.id)).limit(1);
    if (building) await progressBuildingOrder(building);
  } catch (err) {
    logger.error({ err }, "pack orders tick failed");
  } finally {
    tickInFlight = false;
  }
}

export function startPackScheduler(): void {
  setTimeout(() => void packOrdersTick(), FIRST_TICK_DELAY_MS);
  setInterval(() => void packOrdersTick(), TICK_MS);
  logger.info("Pack-order build scheduler started");
}

// Create the random download token for a new order.
export function newOrderToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}
