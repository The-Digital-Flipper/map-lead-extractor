/**
 * Reply automation — the inbound half of the outreach engine.
 *
 * A background watcher polls the connected Gmail inbox over IMAP (same
 * GMAIL_USER / GMAIL_APP_PASSWORD secrets the sender uses) and, for every
 * message that answers one of our outreach emails:
 *
 *   • records the reply and hard-stops that lead's cold sequence — the
 *     "we never keep nudging someone who wrote back" promise, now automatic;
 *   • honors opt-out language ("stop", "take me off your list", …) as a
 *     permanent unsubscribe, no response sent;
 *   • when the owner turns Auto-reply ON, has the AI write a short, grounded
 *     response (their offer + the whole thread, no invented facts) and sends
 *     it back threaded into the same conversation — so replies get answered
 *     in minutes with zero clicks.
 *
 * Safety rails: auto-responses are capped per lead (a human takes over real
 * conversations), automatic messages (out-of-office, bounces) are ignored,
 * and every message in/out lands in outreach_replies for the dashboard feed.
 */
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { db, leads, outreachEmails, outreachReplies, type Lead, type OutreachSettings } from "@workspace/db";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { logger } from "./logger";
import {
  getOutreachSettings, gmailConfigured, gmailAddress, getGmailTransport,
  renderEmail, markReplied,
} from "./outreach-auto";
import { generateReply, type ReplyTurn } from "./outreach";

// How far back the inbox scan looks. Anything older on first boot is history.
const SCAN_DAYS = 7;
// A human takes over after this many AI responses in one conversation.
const MAX_AUTO_REPLIES_PER_LEAD = 3;

// ── Inbound parsing helpers ───────────────────────────────────────────────────

// Cut the quoted history off a reply so we store (and reason over) only what
// the person actually typed. Falls back to the full text if the heuristics
// would leave nothing.
export function stripQuoted(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;                                  // "> quoted"
    if (/^\s*On .{0,200}wrote:\s*$/i.test(line)) break;             // Gmail-style attribution
    if (/^\s*-{3,}\s*(Original|Forwarded) Message/i.test(line)) break;
    if (/^\s*From:\s.+/.test(line) && kept.length > 0) break;       // Outlook-style header block
    kept.push(line);
  }
  const out = kept.join("\n").trim();
  return out || text.trim();
}

// Clear "leave me alone" language → permanent opt-out, never answered.
function isOptOut(text: string): boolean {
  return /\b(unsubscribe|remove me|take me off|stop (emailing|contacting|messaging)|do not (email|contact)|don'?t (email|contact) me|no more emails)\b/i.test(text);
}

// Senders that are machines, not the lead (bounces, autoresponder daemons).
function isMachineSender(addr: string): boolean {
  return /(^|[.\-_])(mailer-daemon|postmaster|no-?reply|donotreply|bounce)[@.\-_]/i.test(addr) || /mailer-daemon|postmaster/i.test(addr.split("@")[0] ?? "");
}

function normalizeMsgId(id: string | null | undefined): string | null {
  const t = (id ?? "").trim();
  if (!t) return null;
  return t.startsWith("<") ? t : `<${t}>`;
}

// ── Matching inbound mail to leads ────────────────────────────────────────────

// Everything needed to decide, for one inbox message, whether it's a lead
// replying to us: our sent Message-IDs and the addresses we've emailed.
type MatchIndex = {
  byMessageId: Map<string, number>; // our sent RFC ids (outbound both kinds) → leadId
  byAddress: Map<string, number>;   // lowercased to-address we've emailed → leadId
  seenInbound: Set<string>;         // inbound ids already recorded (idempotency)
};

async function buildMatchIndex(): Promise<MatchIndex> {
  const byMessageId = new Map<string, number>();
  const byAddress = new Map<string, number>();
  const seenInbound = new Set<string>();

  const sent = await db.select({ leadId: outreachEmails.leadId, messageId: outreachEmails.messageId, toEmail: outreachEmails.toEmail })
    .from(outreachEmails).orderBy(desc(outreachEmails.id)).limit(2000);
  for (const r of sent) {
    if (r.messageId) byMessageId.set(r.messageId, r.leadId);
    if (r.toEmail) byAddress.set(r.toEmail.toLowerCase(), r.leadId);
  }
  const outs = await db.select({ leadId: outreachReplies.leadId, messageId: outreachReplies.messageId, direction: outreachReplies.direction })
    .from(outreachReplies).orderBy(desc(outreachReplies.id)).limit(2000);
  for (const r of outs) {
    if (!r.messageId) continue;
    if (r.direction === "out") byMessageId.set(r.messageId, r.leadId);
    else seenInbound.add(r.messageId);
  }
  const threaded = await db.select({ id: leads.id, threadMessageId: leads.threadMessageId })
    .from(leads).where(isNotNull(leads.threadMessageId)).limit(5000);
  for (const r of threaded) if (r.threadMessageId) byMessageId.set(r.threadMessageId, r.id);

  return { byMessageId, byAddress, seenInbound };
}

// ── The conversation so far, for the AI ───────────────────────────────────────

async function threadForLead(leadId: number): Promise<ReplyTurn[]> {
  const sent = await db.select({ body: outreachEmails.body, createdAt: outreachEmails.createdAt })
    .from(outreachEmails)
    .where(and(eq(outreachEmails.leadId, leadId), eq(outreachEmails.status, "sent")))
    .orderBy(asc(outreachEmails.createdAt));
  const replies = await db.select({ body: outreachReplies.body, direction: outreachReplies.direction, createdAt: outreachReplies.createdAt, status: outreachReplies.status })
    .from(outreachReplies).where(eq(outreachReplies.leadId, leadId))
    .orderBy(asc(outreachReplies.createdAt));

  const turns: (ReplyTurn & { at: number })[] = [
    ...sent.map((m) => ({ from: "us" as const, body: m.body, at: m.createdAt.getTime() })),
    ...replies.filter((m) => m.direction === "in" || m.status === "sent")
      .map((m) => ({ from: m.direction === "in" ? ("them" as const) : ("us" as const), body: m.body, at: m.createdAt.getTime() })),
  ].sort((a, b) => a.at - b.at);
  // The last ~8 turns are plenty of context and keep the prompt small.
  return turns.slice(-8).map(({ from, body }) => ({ from, body }));
}

async function autoRepliesSent(leadId: number): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(outreachReplies)
    .where(and(eq(outreachReplies.leadId, leadId), eq(outreachReplies.direction, "out"),
      eq(outreachReplies.aiGenerated, true), eq(outreachReplies.status, "sent")));
  return n;
}

// ── Sending the AI response ───────────────────────────────────────────────────

// Send `body` back into the lead's thread over Gmail SMTP (the same mailbox
// the reply landed in) and record it. References chain onto the inbound
// message so every client threads it correctly.
async function sendAutoReply(lead: Lead, s: OutreachSettings, toEmail: string, body: string,
  inbound: { messageId: string | null; subject: string | null; references: string[] }): Promise<void> {
  const fromAddr = gmailAddress()!;
  const { text, html } = renderEmail(body, s);
  const subject = inbound.subject
    ? (/^re:/i.test(inbound.subject) ? inbound.subject : `Re: ${inbound.subject}`)
    : "Re: your reply";
  const domain = fromAddr.split("@")[1] || "mail.local";
  const messageId = `<reply.${lead.id}.${Date.now()}@${domain}>`;
  const references = [...inbound.references, inbound.messageId].filter(Boolean).join(" ");

  try {
    await getGmailTransport().sendMail({
      from: `${s.fromName} <${fromAddr}>`,
      to: toEmail,
      replyTo: s.replyTo || fromAddr,
      subject, text, html, messageId,
      ...(inbound.messageId ? { inReplyTo: inbound.messageId, references } : {}),
    });
    await db.insert(outreachReplies).values({
      leadId: lead.id, direction: "out", fromEmail: fromAddr, subject, body,
      messageId, status: "sent", aiGenerated: true,
    });
    logger.info({ leadId: lead.id, toEmail }, "Auto-reply sent");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send failed";
    logger.error({ err, leadId: lead.id }, "Auto-reply send failed");
    await db.insert(outreachReplies).values({
      leadId: lead.id, direction: "out", fromEmail: fromAddr, subject, body,
      messageId, status: "failed", error: msg.slice(0, 500), aiGenerated: true,
    });
  }
}

// ── Processing one matched inbound reply ──────────────────────────────────────

type InboundMsg = {
  leadId: number;
  fromEmail: string;
  subject: string | null;
  body: string;           // quoted history stripped
  messageId: string | null;
  references: string[];
};

async function processInbound(msg: InboundMsg, s: OutreachSettings): Promise<void> {
  // Record first (unique messageId makes re-scans no-ops), then act.
  const inserted = await db.insert(outreachReplies).values({
    leadId: msg.leadId, direction: "in", fromEmail: msg.fromEmail,
    subject: msg.subject, body: msg.body, messageId: msg.messageId, status: "received",
  }).onConflictDoNothing().returning({ id: outreachReplies.id });
  if (inserted.length === 0) return; // already handled on an earlier scan

  // They wrote back → the cold sequence stops, permanently, before anything else.
  await markReplied(msg.leadId);
  logger.info({ leadId: msg.leadId, fromEmail: msg.fromEmail }, "Lead replied — sequence paused");

  const [lead] = await db.select().from(leads).where(eq(leads.id, msg.leadId));
  if (!lead || lead.deletedAt) return;

  if (isOptOut(msg.body)) {
    await db.update(leads).set({ unsubscribedAt: lead.unsubscribedAt ?? new Date(), status: "not_interested", updatedAt: new Date() })
      .where(eq(leads.id, lead.id));
    return;
  }
  if (!s.autoReply || !s.offer?.trim() || lead.unsubscribedAt) return;
  if (await autoRepliesSent(lead.id) >= MAX_AUTO_REPLIES_PER_LEAD) return;

  try {
    const thread = await threadForLead(lead.id);
    const decision = await generateReply(lead, thread, { name: s.fromName, offer: s.offer });
    if (decision.leadDone) {
      await db.update(leads).set({ status: "not_interested", updatedAt: new Date() }).where(eq(leads.id, lead.id));
    }
    if (decision.shouldReply) {
      await sendAutoReply(lead, s, msg.fromEmail, decision.body,
        { messageId: msg.messageId, subject: msg.subject, references: msg.references });
    }
  } catch (err) {
    logger.error({ err, leadId: lead.id }, "Auto-reply generation failed — reply left for the owner");
  }
}

// ── Inbox scan ────────────────────────────────────────────────────────────────

export async function scanInbox(): Promise<void> {
  const s = await getOutreachSettings();
  if (!gmailConfigured()) return;

  const index = await buildMatchIndex();
  // Nothing ever sent → nothing can be a reply; skip the connection entirely.
  if (index.byMessageId.size === 0 && index.byAddress.size === 0) return;

  const self = (gmailAddress() ?? "").toLowerCase();
  const since = new Date(Date.now() - SCAN_DAYS * 86_400_000);

  const client = new ImapFlow({
    host: "imap.gmail.com", port: 993, secure: true,
    auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    const matched: { uid: number; leadId: number; fromEmail: string }[] = [];
    try {
      // Pass 1: envelopes + threading headers only — cheap enough to sweep the
      // whole window every tick; bodies are downloaded only for real matches.
      for await (const m of client.fetch({ since }, { uid: true, envelope: true, headers: ["in-reply-to", "references"] })) {
        const from = (m.envelope?.from?.[0]?.address ?? "").toLowerCase();
        const msgId = normalizeMsgId(m.envelope?.messageId);
        if (!from || from === self || isMachineSender(from)) continue;
        if (msgId && index.seenInbound.has(msgId)) continue;

        // Threading headers first (exact), then from-address (covers replies
        // sent fresh instead of via reply).
        const headerText = m.headers?.toString() ?? "";
        const refIds = headerText.match(/<[^<>\s]+>/g) ?? [];
        let leadId: number | undefined;
        for (const id of refIds) { leadId = index.byMessageId.get(id); if (leadId) break; }
        leadId ??= index.byAddress.get(from);
        if (leadId) matched.push({ uid: m.uid, leadId, fromEmail: from });
      }

      // Pass 2: download + parse + handle each matched message.
      for (const hit of matched) {
        const full = await client.fetchOne(String(hit.uid), { source: true }, { uid: true });
        if (!full || !full.source) continue;
        const parsed = await simpleParser(full.source);
        const rawText = parsed.text ?? "";
        if (!rawText.trim()) continue;
        const references = (Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [])
          .map((r) => normalizeMsgId(r)).filter((r): r is string => !!r);
        await processInbound({
          leadId: hit.leadId,
          fromEmail: hit.fromEmail,
          subject: parsed.subject ?? null,
          body: stripQuoted(rawText),
          messageId: normalizeMsgId(parsed.messageId),
          references,
        }, s);
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

const TICK_MS = 150_000; // scan every 2.5 minutes
let scanInFlight = false;

export async function replyTick(): Promise<void> {
  if (scanInFlight) return;
  scanInFlight = true;
  try {
    await scanInbox();
  } catch (err) {
    logger.error({ err }, "Inbox reply scan failed");
  } finally {
    scanInFlight = false;
  }
}

export function startReplyWatcher(): void {
  if (!gmailConfigured()) {
    logger.info("Reply watcher not started — Gmail secrets missing");
    return;
  }
  setTimeout(() => void replyTick(), 45_000);
  setInterval(() => void replyTick(), TICK_MS);
  logger.info("Inbox reply watcher started");
}
