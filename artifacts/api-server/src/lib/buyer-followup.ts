/**
 * Buyer follow-up nurture for the free-sample flow.
 *
 * When a visitor unlocks 5 free sample leads (see routes/stripe.ts pack-sample*)
 * they hand over an email but usually DON'T buy on the spot. This module sends
 * ONE friendly follow-up — "here are your 5 samples, grab the other 95 for $29"
 * — to recover that intent.
 *
 * It is deliberately separate from the cold-outreach engine (lib/outreach-auto):
 * that engine sends to `leads` rows (businesses we pitch), keyed by leadId and
 * backed by per-lead drafts. These recipients are prospective CUSTOMERS, not
 * leads — mixing them in would corrupt the leads table and outreach analytics.
 * We only reuse the low-level provider plumbing (Gmail SMTP / Resend + sender
 * identity) exported from outreach-auto.
 *
 * Compliance: one-click List-Unsubscribe header + a plain opt-out line, the
 * owner's physical address footer, and a hard skip of anyone who unsubscribed
 * or already purchased. Sending is gated on a configured provider, same as the
 * outreach engine.
 */
import crypto from "node:crypto";
import { db, sampleRequests, leads, packOrders, type OutreachSettings } from "@workspace/db";
import { and, eq, inArray, isNull, isNotNull, lte, sql } from "drizzle-orm";
import { logger } from "./logger";
import {
  getOutreachSettings, sendGmailMail, gmailSendAddress,
  anyProviderConfigured, providerReady,
  gmailSendReady, resendConfigured, sendReplitMail,
} from "./outreach-auto";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "https://mapleadextractor.net";

// How long after unlock to wait before the auto follow-up fires, and how many
// to send per tick (kept low so it reads as personal, not a blast).
const FOLLOWUP_DELAY_MS = 60 * 60 * 1000; // 1h
const FOLLOWUP_BATCH = 10;
const TICK_MS = 10 * 60 * 1000;           // 10 min
const FIRST_TICK_DELAY_MS = 90_000;

function fromEmailFor(s: OutreachSettings): string {
  if (s.provider === "gmail") return gmailSendAddress() || "";
  return s.fromEmail || "onboarding@resend.dev";
}

function unsubUrl(token: string): string {
  return `${PUBLIC_ORIGIN}/api/stripe/sample-unsub/${token}`;
}

/** The buy link — drops them straight onto the pack widget. */
function buyUrl(): string {
  return `${PUBLIC_ORIGIN}/#leads-for-sale`;
}

/** Build the follow-up subject + body for one capture, listing the 5 previewed
 *  businesses by name as a reminder of what they already saw. */
function buildEmail(
  row: typeof sampleRequests.$inferSelect,
  sampleNames: string[],
  s: OutreachSettings,
): { subject: string; text: string; html: string } {
  const what = [row.label || "local business leads", row.city && row.state ? `in ${row.city}, ${row.state}` : row.state ? `in ${row.state}` : ""]
    .filter(Boolean).join(" ");
  const subject = `Your 5 sample ${row.label || "leads"} — want the other 95?`;

  const namesLine = sampleNames.length
    ? sampleNames.map(n => `  • ${n}`).join("\n")
    : "  • (your 5 sample businesses)";

  const greeting = "Hi,";
  const bodyLines = [
    greeting,
    "",
    `Thanks for checking out a free sample of ${what}. Here are the 5 you unlocked:`,
    "",
    namesLine,
    "",
    `Those are just 5 of the full pack. You can get 100 hand-reviewed ${row.label || "local business"} leads — full names, phones, emails, websites and ratings — for $29, delivered to your inbox usually within a few hours:`,
    "",
    `  → ${buyUrl()}`,
    "",
    "Every lead is checked by a real person before it ships, and if a pack comes up short we refund the difference automatically.",
    "",
    "Reply to this email if you want a custom city or industry — happy to help.",
  ];
  const rawBody = bodyLines.join("\n");

  const sig = s.fromName?.trim();
  const addr = s.businessAddress?.trim();
  const optOut = `If you'd rather not hear from us, unsubscribe here: ${unsubUrl(row.unsubToken!)}`;

  const textParts = [rawBody];
  if (sig) textParts.push("", `— ${sig}`);
  textParts.push("", optOut);
  if (addr) textParts.push("", addr);
  const text = textParts.join("\n");

  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = esc(rawBody)
    .replace(new RegExp(esc(buyUrl()), "g"), `<a href="${buyUrl()}" style="color:#0a7d33;font-weight:600">${buyUrl()}</a>`)
    .replace(/\n/g, "<br>");
  const sigHtml = sig ? `<br><br>— ${esc(sig)}` : "";
  const footHtml =
    `<br><br><span style="color:#999;font-size:12px">` +
    `<a href="${unsubUrl(row.unsubToken!)}" style="color:#999">Unsubscribe</a>` +
    (addr ? `<br>${esc(addr)}` : "") +
    `</span>`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${bodyHtml}${sigHtml}${footHtml}</div>`;

  return { subject, text, html };
}

/** Look up the display names of the leads previewed in a capture, in order. */
async function sampleLeadNames(leadIds: number[]): Promise<string[]> {
  if (!leadIds.length) return [];
  const rows = await db.select({ id: leads.id, name: leads.name }).from(leads).where(inArray(leads.id, leadIds));
  const byId = new Map(rows.map(r => [r.id, r.name ?? ""]));
  return leadIds.map(id => byId.get(id)).filter((n): n is string => !!n);
}

export type FollowupResult = { ok: true } | { ok: false; reason: string };

/** Send the follow-up for one capture row. Idempotent-ish: refuses if there's
 *  no email, it was already sent, the person opted out, or no provider is
 *  configured. Stamps followedUpAt on success. */
export async function sendBuyerFollowup(sampleId: number): Promise<FollowupResult> {
  const [row] = await db.select().from(sampleRequests).where(eq(sampleRequests.id, sampleId)).limit(1);
  if (!row) return { ok: false, reason: "not_found" };
  if (!row.email) return { ok: false, reason: "no_email" };
  if (row.unsubscribedAt) return { ok: false, reason: "unsubscribed" };
  if (row.followedUpAt) return { ok: false, reason: "already_sent" };

  const s = await getOutreachSettings();
  if (!providerReady(s)) return { ok: false, reason: "no_provider" };

  // Ensure an unsubscribe token exists for the one-click header/link.
  let token = row.unsubToken;
  if (!token) {
    token = crypto.randomUUID();
    await db.update(sampleRequests).set({ unsubToken: token }).where(eq(sampleRequests.id, sampleId));
    row.unsubToken = token;
  }

  const names = await sampleLeadNames((row.leadIds ?? []) as number[]);
  const { subject, text, html } = buildEmail(row, names, s);
  const fromAddr = fromEmailFor(s);
  const from = s.fromName ? `${s.fromName} <${fromAddr}>` : fromAddr;
  const replyTo = s.replyTo || fromAddr || undefined;
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${unsubUrl(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  try {
    if (s.provider === "gmail" && gmailSendReady()) {
      await sendGmailMail({ fromName: s.fromName, to: row.email, replyTo, subject, text, html, headers });
    } else if (resendConfigured()) {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: row.email, reply_to: replyTo, subject, text, html, headers }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || `Resend ${res.status}`);
      }
    } else if (gmailSendReady()) {
      await sendGmailMail({ fromName: s.fromName, to: row.email, replyTo, subject, text, html, headers });
    } else {
      // Replit Mail fallback — the body already carries the unsubscribe link.
      await sendReplitMail({ to: row.email, subject, text, html });
    }
    await db.update(sampleRequests).set({ followedUpAt: new Date() }).where(eq(sampleRequests.id, sampleId));
    logger.info({ sampleId, to: row.email }, "buyer follow-up sent");
    return { ok: true };
  } catch (err) {
    logger.error({ err, sampleId }, "buyer follow-up send failed");
    return { ok: false, reason: err instanceof Error ? err.message : "send failed" };
  }
}

/** Mark a capture unsubscribed by its token. Returns whether a row matched. */
export async function unsubscribeSample(token: string): Promise<boolean> {
  if (!token) return false;
  const res = await db.update(sampleRequests)
    .set({ unsubscribedAt: new Date() })
    .where(and(eq(sampleRequests.unsubToken, token), isNull(sampleRequests.unsubscribedAt)))
    .returning({ id: sampleRequests.id });
  return res.length > 0;
}

/** One scheduler tick: auto-send the follow-up to captures that unlocked ≥ the
 *  delay ago, haven't been followed up, haven't opted out, and whose email has
 *  NOT bought a pack. Sends at most FOLLOWUP_BATCH per tick. */
async function followupTick(): Promise<void> {
  if (!anyProviderConfigured()) return; // nothing to send with — stay quiet
  const s = await getOutreachSettings();
  if (!providerReady(s)) return;

  const cutoff = new Date(Date.now() - FOLLOWUP_DELAY_MS);
  const due = await db.select({ id: sampleRequests.id, email: sampleRequests.email })
    .from(sampleRequests)
    .where(and(
      isNotNull(sampleRequests.email),
      isNotNull(sampleRequests.unlockedAt),
      lte(sampleRequests.unlockedAt, cutoff),
      isNull(sampleRequests.followedUpAt),
      isNull(sampleRequests.unsubscribedAt),
    ))
    .orderBy(sampleRequests.unlockedAt)
    .limit(FOLLOWUP_BATCH * 3); // over-fetch; we filter buyers out below

  if (!due.length) return;

  // Drop anyone who already bought (matched by the email Stripe collected).
  const emails = Array.from(new Set(due.map(d => d.email!.toLowerCase())));
  const buyers = await db.select({ email: packOrders.email })
    .from(packOrders)
    .where(and(isNotNull(packOrders.email), isNotNull(packOrders.paidAt), inArray(sql`lower(${packOrders.email})`, emails)));
  const bought = new Set(buyers.map(b => (b.email ?? "").toLowerCase()));

  let sent = 0;
  for (const d of due) {
    if (sent >= FOLLOWUP_BATCH) break;
    if (bought.has(d.email!.toLowerCase())) {
      // Skip permanently — stamp so we don't reconsider them every tick.
      await db.update(sampleRequests).set({ followedUpAt: new Date() }).where(eq(sampleRequests.id, d.id));
      continue;
    }
    const r = await sendBuyerFollowup(d.id);
    if (r.ok) sent++;
  }
  if (sent) logger.info({ sent }, "buyer follow-ups sent this tick");
}

export function startBuyerFollowupScheduler(): void {
  setTimeout(() => void followupTick(), FIRST_TICK_DELAY_MS);
  setInterval(() => void followupTick(), TICK_MS);
  logger.info("Buyer follow-up scheduler started");
}
