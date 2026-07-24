/**
 * Routes for the automated outreach engine (mounted at /api/outreach).
 *
 * The dashboard reads/writes settings, enrolls or pauses leads, marks replies,
 * and shows the send activity feed. The unsubscribe endpoint is public (no
 * auth) so the link in every email works for the recipient.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, leads, outreachEmails, outreachReplies, type LeadOutreach, type LeadOutreachStep } from "@workspace/db";
import { and, asc, desc, eq, gte, isNull, isNotNull, or, sql } from "drizzle-orm";
import {
  getOutreachSettings, updateOutreachSettings, resendConfigured,
  gmailConfigured, gmailAddress, gmailSendReady, gmailSendAddress, anyProviderConfigured, providerReady,
  replitMailConfigured, enrollLeads, pauseLeads, markReplied, unsubscribeByToken, sentToday,
  primaryEmail, renderEmail, sendGmailMail, sendReplitMail,
} from "../lib/outreach-auto";
import { connectorGmailAvailable } from "../lib/gmailConnector";
import { generateOutreach } from "../lib/outreach";

const router = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

// Owner-only guard: admin secret OR any signed-in session (the dashboard is
// behind Clerk and its fetches carry the session).
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"] ?? req.query.secret;
  if (ADMIN_SECRET && secret === ADMIN_SECRET) { next(); return; }
  if (getAuth(req).userId) { next(); return; }
  res.status(401).json({ error: "Sign in to manage outreach." });
}

function parseIds(body: unknown): number[] {
  const ids = (body as { ids?: unknown })?.ids;
  return Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 500) : [];
}

// ---- GET /config — lightweight gate for the dashboard -----------------------
router.get("/config", async (_req, res) => {
  const s = await getOutreachSettings();
  res.json({
    available: anyProviderConfigured(),
    enabled: s.enabled && providerReady(s),
    fromName: s.fromName,
    fromEmail: s.provider === "gmail" ? gmailSendAddress() : s.fromEmail,
  });
});

// ---- GET /settings — full settings + live counters --------------------------
router.get("/settings", requireAuth, async (_req, res) => {
  const s = await getOutreachSettings();
  const [{ enrolled }] = await db.select({ enrolled: sql<number>`count(*)::int` }).from(leads)
    .where(and(eq(leads.autoOutreach, true), isNull(leads.deletedAt)));
  const [{ pending }] = await db.select({ pending: sql<number>`count(*)::int` }).from(leads)
    .where(and(eq(leads.autoOutreach, true), isNull(leads.deletedAt), isNotNull(leads.nextEmailAt)));
  const [{ replied }] = await db.select({ replied: sql<number>`count(*)::int` }).from(leads)
    .where(and(isNotNull(leads.repliedAt), isNull(leads.deletedAt)));
  res.json({
    settings: s,
    resendConfigured: resendConfigured(),
    // "Configured" here means ready to SEND — app-password secrets or the
    // Replit Google Mail connector both count. (IMAP auto-reply still needs
    // the secrets; that check below stays on gmailConfigured().)
    gmailConfigured: gmailSendReady(),
    gmailAddress: gmailSendAddress(),
    enrolled, pending, replied,
    sentToday: await sentToday(s),
  });
});

// ---- PATCH /settings — update engine config ---------------------------------
router.patch("/settings", requireAuth, async (req, res) => {
  const b = req.body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  const strFields = ["fromName", "fromEmail", "replyTo", "signature", "businessAddress", "offer"];
  const numFields = ["dailyCap", "windowStartHour", "windowEndHour", "tzOffsetMinutes", "minGapMinutes", "maxGapMinutes"];
  const boolFields = ["enabled", "sendOnWeekends", "autoEnrollOnContact", "autoReply", "autopilot"];
  for (const f of strFields) if (f in b) patch[f] = b[f] == null ? null : String(b[f]).slice(0, 2000);
  for (const f of numFields) if (f in b) patch[f] = Math.trunc(Number(b[f])) || 0;
  for (const f of boolFields) if (f in b) patch[f] = !!b[f];
  if ("provider" in b) patch.provider = b.provider === "resend" ? "resend" : "gmail";

  // Guardrails so a bad config can't create an unsendable or abusive engine.
  if ("windowStartHour" in patch) patch.windowStartHour = Math.min(23, Math.max(0, patch.windowStartHour as number));
  if ("windowEndHour" in patch) patch.windowEndHour = Math.min(24, Math.max(1, patch.windowEndHour as number));
  if ("dailyCap" in patch) patch.dailyCap = Math.min(500, Math.max(1, patch.dailyCap as number));
  if ("minGapMinutes" in patch) patch.minGapMinutes = Math.min(240, Math.max(1, patch.minGapMinutes as number));
  if ("maxGapMinutes" in patch) patch.maxGapMinutes = Math.min(480, Math.max(patch.minGapMinutes as number ?? 1, patch.maxGapMinutes as number));

  // Auto-replies watch (and answer from) the Gmail inbox, so they need the
  // Gmail secrets even when sending goes through Resend.
  if (patch.autoReply && !gmailConfigured()) {
    res.status(400).json({ error: "Auto-reply needs your Gmail connected (GMAIL_USER and GMAIL_APP_PASSWORD secrets) — that's the inbox it watches for replies." });
    return;
  }

  // Can't turn it on unless something can actually send. Replit Mail backstops
  // both provider choices (the engine's sendStep falls back to it), so only
  // refuse when neither the chosen provider nor the backstop is available.
  if (patch.enabled) {
    const current = await getOutreachSettings();
    const provider = (patch.provider ?? current.provider) as string;
    const primaryReady = provider === "gmail"
      ? gmailSendReady()
      : resendConfigured() && !!(patch.fromEmail ?? current.fromEmail);
    if (!primaryReady && !replitMailConfigured()) {
      res.status(400).json({
        error: provider === "gmail"
          ? "Connect Google Mail in Replit's integrations panel (or add GMAIL_USER + GMAIL_APP_PASSWORD secrets) before turning Gmail sending on."
          : "Add your RESEND_API_KEY and a verified From email before turning Resend sending on.",
      });
      return;
    }
  }
  const s = await updateOutreachSettings(patch);
  res.json({ ok: true, settings: s });
});

// ---- POST /enroll — start automation for leads ------------------------------
router.post("/enroll", requireAuth, async (req, res) => {
  const ids = parseIds(req.body);
  if (ids.length === 0) { res.status(400).json({ error: "ids must be a non-empty array" }); return; }
  const r = await enrollLeads(ids);
  res.json({ ok: true, ...r });
});

// ---- POST /pause — stop automation for leads --------------------------------
router.post("/pause", requireAuth, async (req, res) => {
  const ids = parseIds(req.body);
  if (ids.length === 0) { res.status(400).json({ error: "ids must be a non-empty array" }); return; }
  const paused = await pauseLeads(ids);
  res.json({ ok: true, paused });
});

// ---- POST /:id/replied — the lead answered; pause the sequence --------------
router.post("/:id/replied", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await markReplied(id);
  res.json({ ok: true, id });
});

// ---- GET /activity — recent sent/failed emails for the feed -----------------
router.get("/activity", requireAuth, async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10) || 25));
  const rows = await db.select({
    id: outreachEmails.id, leadId: outreachEmails.leadId, step: outreachEmails.step,
    toEmail: outreachEmails.toEmail, subject: outreachEmails.subject, status: outreachEmails.status,
    error: outreachEmails.error, createdAt: outreachEmails.createdAt, leadName: leads.name,
  }).from(outreachEmails).leftJoin(leads, eq(leads.id, outreachEmails.leadId))
    .orderBy(desc(outreachEmails.createdAt)).limit(limit);
  res.json({ activity: rows });
});

// ---- GET /replies — the two-way conversation feed ---------------------------
router.get("/replies", requireAuth, async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "30"), 10) || 30));
  const rows = await db.select({
    id: outreachReplies.id, leadId: outreachReplies.leadId, direction: outreachReplies.direction,
    fromEmail: outreachReplies.fromEmail, subject: outreachReplies.subject, body: outreachReplies.body,
    status: outreachReplies.status, error: outreachReplies.error, aiGenerated: outreachReplies.aiGenerated,
    createdAt: outreachReplies.createdAt, leadName: leads.name,
  }).from(outreachReplies).leftJoin(leads, eq(leads.id, outreachReplies.leadId))
    .orderBy(desc(outreachReplies.createdAt)).limit(limit);
  res.json({ replies: rows });
});

// ---- GET /stats — dashboard analytics for the Email tab ---------------------
router.get("/stats", requireAuth, async (_req, res) => {
  const s = await getOutreachSettings();
  const days = 14;
  const since = new Date(Date.now() - days * 86_400_000);
  // Per-day counts bucketed in the owner's local timezone, matching the send window.
  const perDayRaw = await db.select({
    day: sql<string>`to_char((${outreachEmails.createdAt} + make_interval(mins => ${s.tzOffsetMinutes}))::date, 'YYYY-MM-DD')`,
    sent: sql<number>`(count(*) filter (where ${outreachEmails.status} = 'sent'))::int`,
    failed: sql<number>`(count(*) filter (where ${outreachEmails.status} = 'failed'))::int`,
  }).from(outreachEmails).where(gte(outreachEmails.createdAt, since)).groupBy(sql`1`).orderBy(sql`1`);
  // Fill the gaps so the chart always shows a continuous 14-day axis.
  const byDay = new Map(perDayRaw.map(r => [r.day, r]));
  const perDay: { day: string; sent: number; failed: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() + s.tzOffsetMinutes * 60_000 - i * 86_400_000).toISOString().slice(0, 10);
    perDay.push(byDay.get(d) ?? { day: d, sent: 0, failed: 0 });
  }

  const [emailTotals] = await db.select({
    sentAllTime: sql<number>`(count(*) filter (where ${outreachEmails.status} = 'sent'))::int`,
    failedAllTime: sql<number>`(count(*) filter (where ${outreachEmails.status} = 'failed'))::int`,
    sent7d: sql<number>`(count(*) filter (where ${outreachEmails.status} = 'sent' and ${outreachEmails.createdAt} > now() - interval '7 days'))::int`,
    leadsEmailed: sql<number>`(count(distinct ${outreachEmails.leadId}) filter (where ${outreachEmails.status} = 'sent'))::int`,
  }).from(outreachEmails);
  const [leadTotals] = await db.select({
    replied: sql<number>`(count(*) filter (where ${leads.repliedAt} is not null))::int`,
    unsubscribed: sql<number>`(count(*) filter (where ${leads.unsubscribedAt} is not null))::int`,
    bounced: sql<number>`(count(*) filter (where ${leads.emailHealth} is not null))::int`,
  }).from(leads).where(isNull(leads.deletedAt));
  const [replyTotals] = await db.select({
    inbound: sql<number>`(count(*) filter (where ${outreachReplies.direction} = 'in'))::int`,
    aiSent: sql<number>`(count(*) filter (where ${outreachReplies.direction} = 'out' and ${outreachReplies.aiGenerated} and ${outreachReplies.status} = 'sent'))::int`,
  }).from(outreachReplies);

  res.json({
    perDay,
    totals: {
      ...emailTotals, ...leadTotals, ...replyTotals,
      replyRate: emailTotals.leadsEmailed > 0 ? Math.round((leadTotals.replied / emailTotals.leadsEmailed) * 100) : 0,
    },
    providers: {
      gmailSmtp: gmailConfigured(),
      gmailConnector: connectorGmailAvailable(),
      gmailAddress: gmailSendAddress(),
      resend: resendConfigured(),
      replitMail: replitMailConfigured(),
      imapWatcher: gmailConfigured(), // reply-watching needs the app-password secrets
    },
  });
});

// ---- GET /queue — the next scheduled sends ----------------------------------
router.get("/queue", requireAuth, async (_req, res) => {
  const rows = await db.select().from(leads)
    .where(and(eq(leads.autoOutreach, true), isNull(leads.deletedAt), isNotNull(leads.nextEmailAt)))
    .orderBy(asc(leads.nextEmailAt)).limit(25);
  res.json({
    queue: rows.map(l => ({
      id: l.id, name: l.name, toEmail: primaryEmail(l),
      nextStep: (l.outreachStep ?? 0) + 1, nextEmailAt: l.nextEmailAt,
      subject: (l.outreach as LeadOutreach | null)?.email?.subject ?? null,
    })),
  });
});

// ---- GET /draft/:id — a lead's AI email sequence (generate if missing) ------
router.get("/draft/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), isNull(leads.deletedAt)));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  const s = await getOutreachSettings();
  let o = lead.outreach as LeadOutreach | null;
  if (req.query.regen === "1" || !o?.email?.body) {
    try {
      o = await generateOutreach(lead, { name: s.fromName, offer: s.offer });
      await db.update(leads).set({ outreach: o, updatedAt: new Date() }).where(eq(leads.id, id));
    } catch (err) {
      res.status(502).json({ error: `Couldn't write the draft: ${err instanceof Error ? err.message : "AI error"}` });
      return;
    }
  }
  res.json({
    lead: { id: lead.id, name: lead.name, email: primaryEmail(lead), step: lead.outreachStep ?? 0, enrolled: !!lead.autoOutreach, nextEmailAt: lead.nextEmailAt },
    draft: o,
  });
});

// ---- PATCH /draft/:id — save the owner's edits to a sequence ----------------
router.patch("/draft/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), isNull(leads.deletedAt)));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  const o = lead.outreach as LeadOutreach | null;
  if (!o?.email) { res.status(400).json({ error: "No draft to edit yet — open the preview first." }); return; }

  const b = req.body as { email?: { subject?: unknown; body?: unknown }; followUps?: { day?: unknown; subject?: unknown; body?: unknown }[] };
  const email = {
    subject: String(b.email?.subject ?? o.email.subject).slice(0, 200),
    body: String(b.email?.body ?? o.email.body).slice(0, 5000),
  };
  if (!email.subject.trim() || !email.body.trim()) { res.status(400).json({ error: "Subject and body can't be empty." }); return; }
  const followUps: LeadOutreachStep[] = Array.isArray(b.followUps)
    ? b.followUps.slice(0, 5).map((f, i) => ({
        channel: "email" as const,
        day: Math.min(60, Math.max(1, Math.trunc(Number(f.day)) || (i + 1) * 3)),
        subject: f.subject == null ? undefined : String(f.subject).slice(0, 200),
        body: String(f.body ?? "").slice(0, 5000),
      })).filter(f => f.body.trim())
    : (o.followUps ?? []);
  const next: LeadOutreach = { ...o, email, followUps };
  await db.update(leads).set({ outreach: next, updatedAt: new Date() }).where(eq(leads.id, id));
  res.json({ ok: true, draft: next });
});

// ---- POST /test-send/:id — email the lead's step-1 draft to the OWNER -------
router.post("/test-send/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), isNull(leads.deletedAt)));
  const o = lead?.outreach as LeadOutreach | null;
  if (!lead || !o?.email?.body) { res.status(400).json({ error: "No draft to test — open the preview first." }); return; }
  const s = await getOutreachSettings();
  const requested = String((req.body as { to?: unknown })?.to ?? "").trim();
  const to = (/.+@.+\..+/.test(requested) ? requested : "") || gmailSendAddress() || s.replyTo || s.fromEmail || "";
  if (!to) { res.status(400).json({ error: "Nowhere to send the test — connect Gmail or set a reply-to address first." }); return; }
  const { text, html } = renderEmail(o.email.body, s);
  const subject = `[TEST] ${o.email.subject}`;
  try {
    if (gmailSendReady()) await sendGmailMail({ fromName: s.fromName, to, subject, text, html });
    else if (replitMailConfigured()) await sendReplitMail({ to, subject, text, html });
    else { res.status(400).json({ error: "No email provider configured." }); return; }
    res.json({ ok: true, to });
  } catch (err) {
    res.status(502).json({ error: `Test send failed: ${err instanceof Error ? err.message : "send error"}` });
  }
});

// ---- GET /thread/:id — full conversation with one lead ----------------------
router.get("/thread/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [lead] = await db.select().from(leads).where(eq(leads.id, id));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  const [sent, replies] = await Promise.all([
    db.select().from(outreachEmails).where(eq(outreachEmails.leadId, id)).orderBy(asc(outreachEmails.createdAt)),
    db.select().from(outreachReplies).where(eq(outreachReplies.leadId, id)).orderBy(asc(outreachReplies.createdAt)),
  ]);
  const thread = [
    ...sent.map(e => ({ kind: "email" as const, id: `e${e.id}`, direction: "out" as const, step: e.step, subject: e.subject, body: e.body, status: e.status, error: e.error, aiGenerated: true, createdAt: e.createdAt })),
    ...replies.map(r => ({ kind: "reply" as const, id: `r${r.id}`, direction: r.direction as "in" | "out", step: null, subject: r.subject, body: r.body, status: r.status, error: r.error, aiGenerated: r.aiGenerated, createdAt: r.createdAt })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  res.json({
    lead: { id: lead.id, name: lead.name, email: primaryEmail(lead), repliedAt: lead.repliedAt, unsubscribedAt: lead.unsubscribedAt, enrolled: !!lead.autoOutreach },
    thread,
  });
});

// ---- POST /manual-reply/:id — the owner answers a lead from the dashboard ---
router.post("/manual-reply/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = String((req.body as { body?: unknown })?.body ?? "").trim().slice(0, 5000);
  if (!body) { res.status(400).json({ error: "Write a message first." }); return; }
  const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), isNull(leads.deletedAt)));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }
  if (!gmailSendReady()) { res.status(400).json({ error: "Connect Google Mail (Replit integrations panel) to reply from your inbox." }); return; }

  const [lastIn] = await db.select().from(outreachReplies)
    .where(and(eq(outreachReplies.leadId, id), eq(outreachReplies.direction, "in")))
    .orderBy(desc(outreachReplies.createdAt)).limit(1);
  const to = lastIn?.fromEmail || primaryEmail(lead);
  if (!to) { res.status(400).json({ error: "This lead has no email address." }); return; }

  const s = await getOutreachSettings();
  const { text, html } = renderEmail(body, s);
  const baseSubject = lastIn?.subject || (lead.outreach as LeadOutreach | null)?.email?.subject || "our conversation";
  const subject = /^re:/i.test(baseSubject) ? baseSubject : `Re: ${baseSubject}`;
  const fromAddr = gmailSendAddress() ?? "";
  const domain = fromAddr.split("@")[1] || "mail.local";
  const messageId = `<manual.${lead.id}.${Date.now()}@${domain}>`;
  const inReplyTo = lastIn?.messageId ?? lead.threadMessageId ?? undefined;
  try {
    await sendGmailMail({ fromName: s.fromName, to, replyTo: s.replyTo || undefined, subject, text, html, messageId, inReplyTo });
    await db.insert(outreachReplies).values({ leadId: lead.id, direction: "out", fromEmail: fromAddr, subject, body, messageId, status: "sent", aiGenerated: false });
    res.json({ ok: true, to });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "send failed";
    await db.insert(outreachReplies).values({ leadId: lead.id, direction: "out", fromEmail: fromAddr, subject, body, messageId, status: "failed", error: msg.slice(0, 500), aiGenerated: false }).catch(() => {});
    res.status(502).json({ error: `Send failed: ${msg}` });
  }
});

// ---- GET /suppressed — who we'll never email again --------------------------
router.get("/suppressed", requireAuth, async (_req, res) => {
  const rows = await db.select().from(leads)
    .where(and(isNull(leads.deletedAt), or(isNotNull(leads.unsubscribedAt), isNotNull(leads.emailHealth))))
    .orderBy(desc(leads.updatedAt)).limit(200);
  res.json({
    suppressed: rows.map(l => ({
      id: l.id, name: l.name, email: primaryEmail(l),
      reason: l.unsubscribedAt ? "unsubscribed" : (l.emailHealth ?? "bounced"),
      at: l.unsubscribedAt ?? l.updatedAt,
    })),
  });
});

// ---- GET /u/:token — public one-click unsubscribe ---------------------------
// GET (link click) and POST (RFC 8058 List-Unsubscribe-Post) both opt out.
async function handleUnsub(req: Request, res: Response) {
  const token = String(req.params.token ?? "");
  const lead = token ? await unsubscribeByToken(token) : null;
  const name = lead?.name ? ` for ${lead.name}` : "";
  res.status(200).type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:12vh auto;padding:0 24px;text-align:center;color:#111">
<h1 style="font-size:22px">You're unsubscribed${name}.</h1>
<p style="color:#555;line-height:1.5">You won't receive any more emails from us. Sorry for the interruption${lead ? "" : " — this link may have already been used"}.</p>
</body></html>`);
}
router.get("/u/:token", handleUnsub);
router.post("/u/:token", handleUnsub);

export default router;
