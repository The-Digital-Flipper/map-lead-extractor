/**
 * Customer email blasts — the admin "Email customers" feature.
 *
 * The owner writes ONE message (subject + body) and sends it to their
 * CUSTOMERS: people who unlocked free samples with an email (sample_requests)
 * and/or bought a lead pack (pack_orders). Typical use: "new packs are in,
 * grab 100 leads for $29".
 *
 * Deliberately separate from the cold-outreach engine (lib/outreach-auto emails
 * `leads` rows — businesses we pitch). Only the low-level provider plumbing
 * (Gmail / Resend + sender identity) is reused.
 *
 * Compliance mirrors buyer-followup: every mail carries a one-click
 * List-Unsubscribe header + a visible opt-out link, the owner's physical
 * address footer, and a hard skip of anyone opted out. Sends are paced with a
 * randomized gap so a blast reads as a person, not a cannon, and each blast
 * runs as a background job the admin UI polls.
 */
import crypto from "node:crypto";
import { db, sampleRequests, packOrders, customerEmails, emailOptOuts, type OutreachSettings } from "@workspace/db";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { logger } from "./logger";
import {
  getOutreachSettings, sendGmailMail, gmailSendAddress, providerReady,
  gmailSendReady, resendConfigured, sendReplitMail,
} from "./outreach-auto";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "https://mapleadextractor.net";

const MAX_RECIPIENTS = 1000;   // hard sanity cap per blast
const GAP_MIN_MS = 900;        // randomized pause between two sends
const GAP_MAX_MS = 2600;

export type Audience = "all" | "prospects" | "buyers";

function unsubUrl(token: string): string {
  return `${PUBLIC_ORIGIN}/api/stripe/customer-unsub/${token}`;
}

function fromEmailFor(s: OutreachSettings): string {
  if (s.provider === "gmail") return gmailSendAddress() || "";
  return s.fromEmail || "onboarding@resend.dev";
}

// ── Customer list ─────────────────────────────────────────────────────────────

export type Customer = {
  email: string;
  captured: boolean;          // gave their email for free samples
  purchased: boolean;         // has at least one paid pack order
  optedOut: boolean;
  wanted: string | null;      // last thing they asked for, e.g. "Roofers · Tampa, FL"
  lastEmailedAt: Date | null; // last customer-blast email (not the auto follow-up)
};

export async function listCustomers(): Promise<Customer[]> {
  const [captured, buyers, optOuts, lastSent] = await Promise.all([
    db.select({
      email: sampleRequests.email, label: sampleRequests.label,
      city: sampleRequests.city, state: sampleRequests.state,
      unsubscribedAt: sampleRequests.unsubscribedAt, id: sampleRequests.id,
    }).from(sampleRequests).where(isNotNull(sampleRequests.email)).orderBy(desc(sampleRequests.id)),
    db.select({
      email: packOrders.email, label: packOrders.label,
      city: packOrders.city, state: packOrders.state, id: packOrders.id,
    }).from(packOrders).where(and(isNotNull(packOrders.email), isNotNull(packOrders.paidAt))).orderBy(desc(packOrders.id)),
    db.select({ email: emailOptOuts.email }).from(emailOptOuts),
    db.select({
      email: customerEmails.email,
      last: sql<Date>`max(${customerEmails.sentAt})`,
    }).from(customerEmails).groupBy(customerEmails.email),
  ]);

  const out = new Set(optOuts.map(o => o.email.toLowerCase()));
  const lastBy = new Map(lastSent.map(r => [r.email, r.last ? new Date(r.last) : null]));

  const byEmail = new Map<string, Customer>();
  const wantedOf = (r: { label: string | null; city: string | null; state: string | null }) =>
    [r.label, [r.city, r.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || null;

  // Buyers first, then captured — flags OR together when both exist.
  for (const b of buyers) {
    const key = b.email!.toLowerCase();
    const cur = byEmail.get(key);
    if (cur) { cur.purchased = true; continue; }
    byEmail.set(key, {
      email: key, captured: false, purchased: true,
      optedOut: out.has(key), wanted: wantedOf(b), lastEmailedAt: lastBy.get(key) ?? null,
    });
  }
  for (const c of captured) {
    const key = c.email!.toLowerCase();
    const cur = byEmail.get(key);
    if (cur) {
      cur.captured = true;
      if (c.unsubscribedAt) cur.optedOut = true;
      if (!cur.wanted) cur.wanted = wantedOf(c);
      continue;
    }
    byEmail.set(key, {
      email: key, captured: true, purchased: false,
      optedOut: out.has(key) || !!c.unsubscribedAt, wanted: wantedOf(c), lastEmailedAt: lastBy.get(key) ?? null,
    });
  }
  return [...byEmail.values()];
}

export function inAudience(c: Customer, audience: Audience): boolean {
  if (audience === "buyers") return c.purchased;
  if (audience === "prospects") return !c.purchased;
  return true;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Plain text in, text+html out — with the owner's signature, physical-address
 *  footer and a visible unsubscribe link. URLs in the body become real links. */
export function renderCustomerEmail(
  rawBody: string,
  s: OutreachSettings,
  unsubToken: string,
): { text: string; html: string } {
  const body = rawBody.trim();
  const sig = (s.signature?.trim() || (s.fromName?.trim() ? `— ${s.fromName.trim()}` : ""));
  const addr = s.businessAddress?.trim();
  const optOut = `If you'd rather not hear from us, unsubscribe here: ${unsubUrl(unsubToken)}`;

  const textParts = [body];
  if (sig) textParts.push("", sig);
  textParts.push("", optOut);
  if (addr) textParts.push("", addr);
  const text = textParts.join("\n");

  const bodyHtml = esc(body)
    .replace(/(https?:\/\/[^\s<>"']+)/g, (m) => `<a href="${m}" style="color:#0a7d33;font-weight:600">${m}</a>`)
    .replace(/\n/g, "<br>");
  const sigHtml = sig ? `<br><br>${esc(sig).replace(/\n/g, "<br>")}` : "";
  const footHtml =
    `<br><br><span style="color:#999;font-size:12px">` +
    `<a href="${unsubUrl(unsubToken)}" style="color:#999">Unsubscribe</a>` +
    (addr ? `<br>${esc(addr)}` : "") +
    `</span>`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${bodyHtml}${sigHtml}${footHtml}</div>`;
  return { text, html };
}

// ── Sending ───────────────────────────────────────────────────────────────────

async function sendOne(
  s: OutreachSettings,
  to: string,
  subject: string,
  rawBody: string,
  unsubToken: string,
): Promise<string | null> {
  const { text, html } = renderCustomerEmail(rawBody, s, unsubToken);
  const fromAddr = fromEmailFor(s);
  const replyTo = s.replyTo || fromAddr || undefined;
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${unsubUrl(unsubToken)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  if (s.provider === "gmail" && gmailSendReady()) {
    return await sendGmailMail({ fromName: s.fromName, to, replyTo, subject, text, html, headers });
  }
  if (resendConfigured()) {
    const from = s.fromName ? `${s.fromName} <${fromAddr}>` : fromAddr;
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, reply_to: replyTo, subject, text, html, headers }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(data.message || `Resend ${res.status}`);
    return data.id ?? null;
  }
  if (gmailSendReady()) {
    return await sendGmailMail({ fromName: s.fromName, to, replyTo, subject, text, html, headers });
  }
  // Replit Mail fallback — zero setup; the body already carries a visible
  // unsubscribe link, so nothing extra is needed here.
  return await sendReplitMail({ to, subject, text, html });
}

/** One-off test send to the owner's own inbox — not logged, not suppressed. */
export async function sendTestEmail(to: string, subject: string, rawBody: string): Promise<void> {
  const s = await getOutreachSettings();
  if (!providerReady(s)) throw new Error("No email provider configured — connect Gmail or set up Resend first.");
  await sendOne(s, to, subject, rawBody, "test");
}

// ── Background blast job (one at a time; the admin UI polls status) ──────────

export type BlastStatus = {
  running: boolean;
  audience: Audience | null;
  subject: string | null;
  total: number;
  sent: number;
  failed: number;
  lastError: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

const job: BlastStatus = {
  running: false, audience: null, subject: null,
  total: 0, sent: 0, failed: 0, lastError: null, startedAt: null, finishedAt: null,
};

export function blastStatus(): BlastStatus {
  return { ...job };
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export type BlastStart =
  | { ok: true; total: number }
  | { ok: false; error: string };

/**
 * Kick off a blast. Recipients = the chosen audience minus opt-outs, minus
 * anyone already emailed within `skipRecentDays` (0 = no skip). Returns the
 * recipient count immediately; sending continues in the background.
 */
export async function startBlast(opts: {
  subject: string;
  body: string;
  audience: Audience;
  skipRecentDays?: number;
}): Promise<BlastStart> {
  if (job.running) return { ok: false, error: "A blast is already sending — wait for it to finish." };
  const s = await getOutreachSettings();
  if (!providerReady(s)) return { ok: false, error: "No email provider configured — connect Gmail or set up Resend first." };

  const skipDays = Math.max(0, opts.skipRecentDays ?? 3);
  const cutoff = skipDays ? new Date(Date.now() - skipDays * 86_400_000) : null;

  const customers = await listCustomers();
  const recipients = customers.filter(c =>
    !c.optedOut &&
    inAudience(c, opts.audience) &&
    (!cutoff || !c.lastEmailedAt || c.lastEmailedAt < cutoff),
  ).slice(0, MAX_RECIPIENTS);

  if (!recipients.length) return { ok: false, error: "No one to send to — everyone in that audience is opted out or was emailed recently." };

  job.running = true;
  job.audience = opts.audience;
  job.subject = opts.subject;
  job.total = recipients.length;
  job.sent = 0;
  job.failed = 0;
  job.lastError = null;
  job.startedAt = new Date().toISOString();
  job.finishedAt = null;

  void (async () => {
    for (const r of recipients) {
      const token = crypto.randomUUID();
      try {
        const providerId = await sendOne(s, r.email, opts.subject, opts.body, token);
        await db.insert(customerEmails).values({ email: r.email, subject: opts.subject, unsubToken: token, providerId });
        job.sent++;
      } catch (err) {
        job.failed++;
        job.lastError = err instanceof Error ? err.message : String(err);
        logger.error({ err, to: r.email }, "customer blast send failed");
      }
      await sleep(GAP_MIN_MS + Math.floor(Math.random() * (GAP_MAX_MS - GAP_MIN_MS)));
    }
    job.running = false;
    job.finishedAt = new Date().toISOString();
    logger.info({ sent: job.sent, failed: job.failed, total: job.total }, "customer blast finished");
  })();

  return { ok: true, total: recipients.length };
}

// ── Unsubscribe ───────────────────────────────────────────────────────────────

/** Token from a blast email → suppress that address everywhere. */
export async function unsubscribeCustomerByToken(token: string): Promise<boolean> {
  if (!token) return false;
  const [row] = await db.select({ email: customerEmails.email }).from(customerEmails)
    .where(eq(customerEmails.unsubToken, token)).limit(1);
  if (!row) return false;
  await db.insert(emailOptOuts).values({ email: row.email, source: "blast-unsub" }).onConflictDoNothing();
  // Also stop the sample follow-up nurture for the same address.
  await db.update(sampleRequests).set({ unsubscribedAt: new Date() })
    .where(and(sql`lower(${sampleRequests.email}) = ${row.email}`, isNull(sampleRequests.unsubscribedAt)));
  return true;
}
