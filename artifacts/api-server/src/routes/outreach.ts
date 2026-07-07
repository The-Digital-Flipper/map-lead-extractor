/**
 * Routes for the automated outreach engine (mounted at /api/outreach).
 *
 * The dashboard reads/writes settings, enrolls or pauses leads, marks replies,
 * and shows the send activity feed. The unsubscribe endpoint is public (no
 * auth) so the link in every email works for the recipient.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, leads, outreachEmails, outreachReplies } from "@workspace/db";
import { and, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import {
  getOutreachSettings, updateOutreachSettings, resendConfigured,
  gmailConfigured, gmailAddress, anyProviderConfigured, providerReady,
  enrollLeads, pauseLeads, markReplied, unsubscribeByToken, sentToday,
} from "../lib/outreach-auto";

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
    fromEmail: s.provider === "gmail" ? gmailAddress() : s.fromEmail,
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
    gmailConfigured: gmailConfigured(),
    gmailAddress: gmailAddress(),
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
  const boolFields = ["enabled", "sendOnWeekends", "autoEnrollOnContact", "autoReply"];
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

  // Can't turn it on unless the chosen provider is actually ready to send.
  if (patch.enabled) {
    const current = await getOutreachSettings();
    const provider = (patch.provider ?? current.provider) as string;
    if (provider === "gmail" && !gmailConfigured()) {
      res.status(400).json({ error: "Add your GMAIL_USER and GMAIL_APP_PASSWORD secrets before turning Gmail sending on." });
      return;
    }
    if (provider === "resend" && !(resendConfigured() && (patch.fromEmail ?? current.fromEmail))) {
      res.status(400).json({ error: "Add your RESEND_API_KEY and a verified From email before turning Resend sending on." });
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
