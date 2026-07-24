/**
 * Automated outreach engine.
 *
 * Turns the manual Follow-Up queue into a hands-off sender: once a lead is
 * enrolled, a background scheduler sends its first email and every timed
 * follow-up on its own — but paced to look like a real person working their
 * inbox, not a bulk blast:
 *
 *   • only inside the configured local send window (e.g. 8am–6pm), weekdays;
 *   • a fresh RANDOM gap between every two sends (no clockwork cadence);
 *   • a daily cap so volume stays believable and the domain stays trusted;
 *   • follow-ups threaded as replies beneath the first email (Re:/In-Reply-To);
 *   • every message personalized and GROUNDED in that lead's own data.
 *
 * It also does the things that keep cold email out of the spam folder and on
 * the right side of the law — one-click unsubscribe, a physical-address footer,
 * and hard suppression of unsubscribes / bounces / replies — which is exactly
 * what makes the sending indistinguishable from a person, not a spam cannon.
 *
 * Sending uses Resend (RESEND_API_KEY); content reuses the per-lead drafts from
 * lib/outreach.ts (generated on enrollment if missing).
 */
import crypto from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { db, leads, outreachSettings, outreachEmails, type Lead, type OutreachSettings, type LeadOutreach } from "@workspace/db";
import { and, asc, eq, gte, inArray, isNull, isNotNull, lte, sql } from "drizzle-orm";
import { logger } from "./logger";
import { generateOutreach } from "./outreach";
import { connectorGmailAvailable, connectorGmailAddress, sendViaGmailConnector } from "./gmailConnector";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "https://mapleadextractor.net";

export function resendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

// Gmail sends over SMTP with the owner's address + a Google "App Password"
// (both kept in secrets, never the DB). This is the free, most-personal path.
export function gmailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}
export function gmailAddress(): string | null {
  return process.env.GMAIL_USER || null;
}

// Gmail can SEND via either the SMTP app-password secrets or the Replit
// "Google Mail" connector (owner clicks Connect — no secrets). IMAP
// reply-watching still requires the app password, so gmailConfigured()
// keeps meaning "full SMTP+IMAP creds" and these cover the send path.
export function gmailSendReady(): boolean {
  return gmailConfigured() || connectorGmailAvailable();
}
export function gmailSendAddress(): string | null {
  return process.env.GMAIL_USER || connectorGmailAddress();
}

// Replit Mail — Replit's built-in mailer. Works with ZERO setup inside any
// Repl or deployment (auth comes from the environment identity token), so
// email always has a way out even before Gmail/Resend are connected. Sends
// come from Replit's own domain and don't support custom headers/reply-to,
// so it's the fallback, never the preferred path.
export function replitMailConfigured(): boolean {
  return !!(process.env.REPL_IDENTITY || process.env.WEB_REPL_RENEWAL);
}

export async function sendReplitMail(opts: {
  to: string;
  subject: string;
  text?: string;
  html: string;
}): Promise<string | null> {
  const token = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : `depl ${process.env.WEB_REPL_RENEWAL}`;
  const res = await fetch("https://connectors.replit.com/api/v2/mailer/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", X_REPLIT_TOKEN: token },
    body: JSON.stringify({ to: opts.to, subject: opts.subject, text: opts.text, html: opts.html }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };
  if (!res.ok) throw new Error(data.message || `Replit Mail ${res.status}`);
  return data.messageId ?? null;
}

// Is the provider the owner selected actually ready to send? Replit Mail
// backstops both choices, so sending is possible as long as we're on Replit.
export function providerReady(s: OutreachSettings): boolean {
  const primary = s.provider === "gmail" ? gmailSendReady() : resendConfigured();
  return primary || replitMailConfigured();
}
// Any way to send at all → the feature is available in the UI.
export function anyProviderConfigured(): boolean {
  return gmailSendReady() || resendConfigured() || replitMailConfigured();
}

/** Send one Gmail message via whichever credential exists — SMTP app password
 * first (personal + threads perfectly), Replit connector otherwise. Shared by
 * the outreach engine, pack worker and buyer follow-ups. Returns providerId. */
export async function sendGmailMail(opts: {
  fromName: string;
  to: string;
  replyTo?: string;
  subject: string;
  text?: string;
  html: string;
  messageId?: string;
  headers?: Record<string, string>;
  inReplyTo?: string;
}): Promise<string | null> {
  if (gmailConfigured()) {
    const from = opts.fromName ? `${opts.fromName} <${gmailAddress()!}>` : gmailAddress()!;
    const info = await getGmailTransport().sendMail({
      from, to: opts.to, replyTo: opts.replyTo, subject: opts.subject,
      text: opts.text, html: opts.html, messageId: opts.messageId, headers: opts.headers,
      ...(opts.inReplyTo ? { inReplyTo: opts.inReplyTo, references: opts.inReplyTo } : {}),
    });
    return info.messageId ?? null;
  }
  const r = await sendViaGmailConnector({
    fromName: opts.fromName, to: opts.to, replyTo: opts.replyTo, subject: opts.subject,
    text: opts.text, html: opts.html, messageId: opts.messageId,
    headers: {
      ...(opts.headers ?? {}),
      ...(opts.inReplyTo ? { "In-Reply-To": opts.inReplyTo, References: opts.inReplyTo } : {}),
    },
  });
  return r.providerId;
}

// Lazily-built reusable Gmail SMTP transport.
let gmailTransport: Transporter | null = null;
export function getGmailTransport(): Transporter {
  if (!gmailTransport) {
    gmailTransport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      // Bound every phase so a hung SMTP socket can never stall a scheduler tick.
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return gmailTransport;
}

// ── Settings (singleton row, id = 1) ─────────────────────────────────────────

export async function getOutreachSettings(): Promise<OutreachSettings> {
  const existing = await db.select().from(outreachSettings).where(eq(outreachSettings.id, 1));
  if (existing[0]) return existing[0];
  const inserted = await db.insert(outreachSettings).values({ id: 1 }).onConflictDoNothing().returning();
  if (inserted[0]) return inserted[0];
  const again = await db.select().from(outreachSettings).where(eq(outreachSettings.id, 1));
  return again[0]!;
}

type SettingsPatch = Partial<Pick<OutreachSettings,
  "enabled" | "provider" | "fromName" | "fromEmail" | "replyTo" | "signature" | "businessAddress" |
  "dailyCap" | "windowStartHour" | "windowEndHour" | "tzOffsetMinutes" | "sendOnWeekends" |
  "minGapMinutes" | "maxGapMinutes" | "autoEnrollOnContact" | "autoReply" | "autopilot">>;

export async function updateOutreachSettings(patch: SettingsPatch): Promise<OutreachSettings> {
  await getOutreachSettings();
  const rows = await db.update(outreachSettings).set({ ...patch, updatedAt: new Date() }).where(eq(outreachSettings.id, 1)).returning();
  return rows[0]!;
}

// ── Time helpers (all "local" time is derived from tzOffsetMinutes) ───────────

// A Date shifted into the configured local zone, so getUTCHours()/getUTCDay()
// on the result read as local wall-clock hour / weekday.
function toLocal(d: Date, s: OutreachSettings): Date {
  return new Date(d.getTime() + s.tzOffsetMinutes * 60_000);
}
function fromLocal(localMs: number, s: OutreachSettings): Date {
  return new Date(localMs - s.tzOffsetMinutes * 60_000);
}
function isWeekend(localDay: number): boolean {
  return localDay === 0 || localDay === 6;
}

// True if `at` falls inside the allowed send window (local hours + weekday rule).
export function withinWindow(at: Date, s: OutreachSettings): boolean {
  const local = toLocal(at, s);
  const hour = local.getUTCHours();
  if (!s.sendOnWeekends && isWeekend(local.getUTCDay())) return false;
  return hour >= s.windowStartHour && hour < s.windowEndHour;
}

function randInt(min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Given a desired earliest send moment, snap it forward to the next valid slot
// inside the send window, landing on a random hour+minute within that window so
// two leads scheduled "in 3 days" don't fire at the same instant.
export function nextSlotAfter(earliest: Date, s: OutreachSettings): Date {
  // Walk day by day (up to ~2 weeks) until we find a sendable day, then place a
  // random time inside the window on that day.
  for (let i = 0; i < 16; i++) {
    const probeLocal = toLocal(new Date(earliest.getTime() + i * 86_400_000), s);
    const y = probeLocal.getUTCFullYear(), mo = probeLocal.getUTCMonth(), da = probeLocal.getUTCDate();
    const day = probeLocal.getUTCDay();
    if (!s.sendOnWeekends && isWeekend(day)) continue;

    const winMinutes = Math.max(1, (s.windowEndHour - s.windowStartHour) * 60);
    // On day 0, don't schedule earlier than `earliest` itself.
    let minOffset = 0;
    if (i === 0) {
      const earliestLocalMin = probeLocal.getUTCHours() * 60 + probeLocal.getUTCMinutes();
      minOffset = Math.max(0, earliestLocalMin - s.windowStartHour * 60);
      if (minOffset >= winMinutes) continue; // window already passed today
    }
    const pick = randInt(minOffset, winMinutes - 1);
    const localMidnightMs = Date.UTC(y, mo, da, 0, 0, 0);
    const slotLocalMs = localMidnightMs + (s.windowStartHour * 60 + pick) * 60_000;
    return fromLocal(slotLocalMs, s);
  }
  // Fallback: a day out (shouldn't happen with a sane window).
  return new Date(earliest.getTime() + 86_400_000);
}

// Local midnight (as an absolute Date) for counting "sent today".
function localMidnight(now: Date, s: OutreachSettings): Date {
  const local = toLocal(now, s);
  const ms = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0);
  return fromLocal(ms, s);
}

// ── Content assembly ─────────────────────────────────────────────────────────

export function primaryEmail(lead: Lead): string | null {
  if (!lead.emails) return null;
  const first = lead.emails.split(",")[0]?.trim();
  return first && /.+@.+\..+/.test(first) ? first : null;
}

// The email content for a given step. step 1 = the base email; step 2+ = the
// (step-2)-th follow-up from the AI sequence. Returns null when the sequence
// has no touch for that step (i.e. we're done).
function contentForStep(o: LeadOutreach, step: number): { subject: string; body: string } | null {
  if (step <= 1) return o.email?.subject && o.email?.body ? { subject: o.email.subject, body: o.email.body } : null;
  const fu = (o.followUps ?? []).filter((f) => f.channel === "email");
  const item = fu[step - 2];
  if (!item?.body) return null;
  return { subject: item.subject?.trim() || `Re: ${o.email?.subject ?? "following up"}`, body: item.body };
}

// How many days after the first email the given step should go out. step 1 = 0.
function dayOffsetForStep(o: LeadOutreach, step: number): number {
  if (step <= 1) return 0;
  const fu = (o.followUps ?? []).filter((f) => f.channel === "email");
  return fu[step - 2]?.day ?? (step - 1) * 3;
}

function hasStep(o: LeadOutreach, step: number): boolean {
  return contentForStep(o, step) !== null;
}

function unsubUrl(token: string): string {
  return `${PUBLIC_ORIGIN}/api/outreach/u/${token}`;
}

// Build the final text + HTML. The body reads like a personal 1:1 email — no
// visible "Unsubscribe" link/line in it. The opt-out is instead carried by the
// invisible List-Unsubscribe headers (set in sendStep), which mailbox providers
// render as their own native unsubscribe control and treat as a positive
// deliverability signal; replies are also honored as opt-outs. The physical
// mailing address stays in a small footer (still required for bulk email and a
// spam-filter trust signal).
export function renderEmail(rawBody: string, s: OutreachSettings): { text: string; html: string } {
  const sig = s.signature?.trim();
  const addr = s.businessAddress?.trim();

  const textParts = [rawBody.trim()];
  if (sig) textParts.push("", sig);
  if (addr) textParts.push("", addr);
  const text = textParts.filter((p, i) => !(p === "" && textParts[i - 1] === "")).join("\n");

  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = esc(rawBody.trim()).replace(/\n/g, "<br>");
  const sigHtml = sig ? `<br><br>${esc(sig).replace(/\n/g, "<br>")}` : "";
  const footHtml = addr
    ? `<br><br><span style="color:#999;font-size:12px">${esc(addr)}</span>`
    : "";
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${bodyHtml}${sigHtml}${footHtml}</div>`;
  return { text, html };
}

// ── Sending ──────────────────────────────────────────────────────────────────

// The From address for the active provider. Gmail must send as the
// authenticated account; Resend uses the configured verified address.
function fromEmailFor(s: OutreachSettings): string {
  if (s.provider === "gmail") return gmailSendAddress() || "";
  return s.fromEmail || "onboarding@resend.dev";
}

// Send one step's email for a lead via the configured provider (Gmail SMTP or
// Resend). Records the attempt (sent|failed) in outreach_emails and returns
// whether it went out. Threads follow-ups under the first email.
async function sendStep(lead: Lead, s: OutreachSettings, step: number): Promise<boolean> {
  const to = primaryEmail(lead);
  const o = lead.outreach as LeadOutreach | null;
  const content = o && to ? contentForStep(o, step) : null;
  if (!to || !content) return false;

  const token = lead.unsubToken ?? crypto.randomUUID();
  const { text, html } = renderEmail(content.body, s);
  const fromAddr = fromEmailFor(s);
  const domain = fromAddr.split("@")[1] || "mail.local";
  const messageId = `<${token}.${step}.${Date.now()}@${domain}>`;
  const from = `${s.fromName} <${fromAddr}>`;
  const replyTo = s.replyTo || fromAddr || undefined;

  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${unsubUrl(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  // Follow-ups reference the first email so they thread as a reply.
  if (step > 1 && lead.threadMessageId) {
    headers["In-Reply-To"] = lead.threadMessageId;
    headers["References"] = lead.threadMessageId;
  }

  try {
    let providerId: string | null = null;
    if (s.provider === "gmail" && gmailSendReady()) {
      providerId = await sendGmailMail({
        fromName: s.fromName, to, replyTo, subject: content.subject, text, html,
        messageId, headers,
        inReplyTo: step > 1 && lead.threadMessageId ? lead.threadMessageId : undefined,
      });
    } else if (resendConfigured()) {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from, to, reply_to: replyTo, subject: content.subject,
          text, html, headers: { "Message-ID": messageId, ...headers },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) throw new Error(data.message || `Resend ${res.status}`);
      providerId = data.id ?? null;
    } else if (gmailSendReady()) {
      providerId = await sendGmailMail({
        fromName: s.fromName, to, replyTo, subject: content.subject, text, html,
        messageId, headers,
        inReplyTo: step > 1 && lead.threadMessageId ? lead.threadMessageId : undefined,
      });
    } else {
      // Replit Mail fallback carries no List-Unsubscribe headers, so put a
      // visible opt-out line in the body instead (the other providers signal
      // it via headers and keep the body header-free).
      const opt = unsubUrl(token);
      providerId = await sendReplitMail({
        to,
        subject: content.subject,
        text: `${text}\n\nIf you'd rather not hear from us, unsubscribe here: ${opt}`,
        html: html.replace(
          /<\/div>\s*$/,
          `<br><br><span style="color:#999;font-size:12px"><a href="${opt}" style="color:#999">Unsubscribe</a></span></div>`,
        ),
      });
    }

    await db.insert(outreachEmails).values({
      leadId: lead.id, step, toEmail: to, subject: content.subject, body: content.body,
      status: "sent", providerId, messageId,
    });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send failed";
    logger.error({ err, leadId: lead.id, step }, "Outreach email send failed");
    await db.insert(outreachEmails).values({
      leadId: lead.id, step, toEmail: to, subject: content.subject, body: content.body,
      status: "failed", error: msg.slice(0, 500),
    });
    return false;
  }
}

// After a successful send, advance the lead's step and schedule (or clear) the
// next one. Stamps contactedAt / thread id on the first email.
async function advanceLead(lead: Lead, s: OutreachSettings, sentStep: number): Promise<void> {
  const o = lead.outreach as LeadOutreach | null;
  const now = new Date();
  const nextStep = sentStep + 1;
  const hasNext = o ? hasStep(o, nextStep) : false;
  const nextAt = hasNext && o
    ? nextSlotAfter(new Date((lead.contactedAt ?? now).getTime() + dayOffsetForStep(o, nextStep) * 86_400_000), s)
    : null;

  await db.update(leads).set({
    outreachStep: sentStep,
    status: "contacted",
    contactedAt: lead.contactedAt ?? now,
    lastEmailedAt: now,
    nextEmailAt: nextAt,
    // Keep enrollment on while more steps remain; the sequence simply idles when done.
    updatedAt: now,
  }).where(eq(leads.id, lead.id));
}

// ── Enrollment / control ─────────────────────────────────────────────────────

// Enroll leads into automation: ensure drafts + an unsubscribe token exist and
// schedule the first email at the next open slot. Skips leads with no email or
// that already opted out / bounced. Returns how many were enrolled.
export async function enrollLeads(ids: number[]): Promise<{ enrolled: number; skipped: number }> {
  const s = await getOutreachSettings();
  const rows = await db.select().from(leads).where(and(inArray(leads.id, ids), isNull(leads.deletedAt)));
  let enrolled = 0, skipped = 0;
  const now = new Date();
  for (const lead of rows) {
    if (!primaryEmail(lead) || lead.unsubscribedAt || lead.emailHealth) { skipped++; continue; }
    let outreach = lead.outreach as LeadOutreach | null;
    if (!outreach?.email?.body) {
      try { outreach = await generateOutreach(lead, { name: s.fromName, offer: s.offer }); } catch { skipped++; continue; }
    }
    const step = lead.outreachStep && lead.outreachStep > 0 ? lead.outreachStep : 0;
    const nextStep = step + 1;
    // If there's no content for the next step, the sequence is already done —
    // enrolling changes nothing to send, so skip.
    if (!hasStep(outreach, nextStep)) { skipped++; continue; }
    // Fresh lead (step 0): send the first email at the next open slot.
    // Already contacted by hand (step ≥ 1): schedule the follow-up at
    // contactedAt + its day offset so we don't re-send #1 or fire instantly.
    const earliest = step === 0
      ? now
      : new Date((lead.contactedAt ?? now).getTime() + dayOffsetForStep(outreach, nextStep) * 86_400_000);
    await db.update(leads).set({
      autoOutreach: true,
      outreach,
      outreachAt: lead.outreachAt ?? now,
      unsubToken: lead.unsubToken ?? crypto.randomUUID(),
      outreachStep: step,
      nextEmailAt: nextSlotAfter(earliest, s),
      updatedAt: now,
    }).where(eq(leads.id, lead.id));
    enrolled++;
  }
  return { enrolled, skipped };
}

export async function pauseLeads(ids: number[]): Promise<number> {
  const r = await db.update(leads).set({ autoOutreach: false, nextEmailAt: null, updatedAt: new Date() })
    .where(inArray(leads.id, ids));
  return r.rowCount ?? 0;
}

export async function markReplied(id: number): Promise<void> {
  await db.update(leads).set({ repliedAt: new Date(), autoOutreach: false, nextEmailAt: null, updatedAt: new Date() })
    .where(eq(leads.id, id));
}

// Look a lead up by its unsubscribe token and opt it out. Idempotent.
export async function unsubscribeByToken(token: string): Promise<Lead | null> {
  const [lead] = await db.select().from(leads).where(eq(leads.unsubToken, token));
  if (!lead) return null;
  if (!lead.unsubscribedAt) {
    await db.update(leads).set({ unsubscribedAt: new Date(), autoOutreach: false, nextEmailAt: null, status: "not_interested", updatedAt: new Date() })
      .where(eq(leads.id, lead.id));
  }
  return lead;
}

// ── Scheduler ────────────────────────────────────────────────────────────────

const TICK_MS = 90_000;
let tickInFlight = false;
// Enforces the random gap between sends across ticks (human cadence).
let nextAllowedSendAt = 0;

export async function sentToday(s: OutreachSettings): Promise<number> {
  const since = localMidnight(new Date(), s);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(outreachEmails)
    .where(and(eq(outreachEmails.status, "sent"), gte(outreachEmails.createdAt, since)));
  return n;
}

// Autopilot: keep the send pipeline stocked without the owner picking anyone —
// whenever fewer than a day's worth of sends are queued, enroll the next
// top-value never-contacted companies that have an email address. A few per
// tick keeps AI draft generation spread out instead of bursty.
const AUTOPILOT_BATCH = 5;
async function autopilotTopUp(s: OutreachSettings): Promise<void> {
  const [{ pending }] = await db.select({ pending: sql<number>`count(*)::int` }).from(leads)
    .where(and(eq(leads.autoOutreach, true), isNull(leads.deletedAt), isNotNull(leads.nextEmailAt)));
  if (pending >= s.dailyCap) return;

  const rows = await db.select({ id: leads.id }).from(leads).where(and(
    isNull(leads.deletedAt),
    eq(leads.autoOutreach, false),
    isNull(leads.unsubscribedAt),
    isNull(leads.emailHealth),
    isNull(leads.repliedAt),
    sql`COALESCE(${leads.outreachStep}, 0) = 0`,
    sql`${leads.emails} LIKE '%@%'`,
  )).orderBy(sql`value_score DESC NULLS LAST, opportunity_score DESC NULLS LAST`)
    .limit(Math.min(AUTOPILOT_BATCH, s.dailyCap - pending));
  if (rows.length === 0) return;

  const r = await enrollLeads(rows.map((x) => x.id));
  if (r.enrolled > 0) logger.info({ enrolled: r.enrolled, skipped: r.skipped, pending }, "autopilot enrolled new companies");
}

export async function outreachTick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const s = await getOutreachSettings();
    if (!s.enabled || !providerReady(s)) return;

    // Top up enrollment even outside the send window, so drafts are written
    // off-hours and ready to go the moment the window opens.
    if (s.autopilot) await autopilotTopUp(s).catch((err) => logger.warn({ err }, "autopilot top-up failed"));

    const now = new Date();
    if (!withinWindow(now, s)) return;            // outside office hours / weekend
    if (now.getTime() < nextAllowedSendAt) return; // still cooling down between sends
    if (await sentToday(s) >= s.dailyCap) return;  // hit the daily ceiling

    // The single most-overdue enrolled, sendable lead.
    const [lead] = await db.select().from(leads).where(and(
      eq(leads.autoOutreach, true),
      isNull(leads.deletedAt),
      isNull(leads.unsubscribedAt),
      isNull(leads.repliedAt),
      isNull(leads.emailHealth),
      isNotNull(leads.nextEmailAt),
      lte(leads.nextEmailAt, now),
    )).orderBy(asc(leads.nextEmailAt)).limit(1);
    if (!lead) return;

    const nextStep = (lead.outreachStep ?? 0) + 1; // step to send now
    const isFirst = nextStep === 1;
    const ok = await sendStep(lead, s, nextStep);
    if (ok) {
      // Record the first email's Message-ID so follow-ups thread beneath it.
      if (isFirst) {
        const [row] = await db.select({ messageId: outreachEmails.messageId }).from(outreachEmails)
          .where(and(eq(outreachEmails.leadId, lead.id), eq(outreachEmails.step, 1)))
          .orderBy(asc(outreachEmails.id)).limit(1);
        if (row?.messageId) await db.update(leads).set({ threadMessageId: row.messageId }).where(eq(leads.id, lead.id));
        // Re-read so advanceLead sees the thread id / token we just set.
      }
      const [fresh] = await db.select().from(leads).where(eq(leads.id, lead.id));
      await advanceLead(fresh ?? lead, s, nextStep);
      logger.info({ leadId: lead.id, step: nextStep }, "Outreach email sent");
      // Cool down a random gap before the next send.
      nextAllowedSendAt = Date.now() + randInt(s.minGapMinutes, s.maxGapMinutes) * 60_000;
    } else {
      // On failure, push this lead out an hour so we don't spin on it, but don't
      // burn the whole cadence.
      await db.update(leads).set({ nextEmailAt: new Date(now.getTime() + 3_600_000), updatedAt: now }).where(eq(leads.id, lead.id));
    }
  } catch (err) {
    logger.error({ err }, "Outreach scheduler tick failed");
  } finally {
    tickInFlight = false;
  }
}

export function startOutreachScheduler(): void {
  setTimeout(() => void outreachTick(), 30_000);
  setInterval(() => void outreachTick(), TICK_MS);
  logger.info("Automated outreach scheduler started");
}
