/**
 * AI Command Center API (mounted at /api/command).
 *
 * Builds the "self-running lead business" layer AROUND the scraper output: it
 * reads the scraper-written `leads` table and stores all AI-derived data in the
 * separate `lead_intel` table. It never imports, calls, or mutates scraper code
 * or the /leads/save ingest.
 *
 * Endpoints (owner-only via requireAuth) power: the lead CRM + scores, website
 * audits, offer picks, approval-gated message drafts, the follow-up pipeline,
 * the daily report, due-today tasks, and the $10k revenue-goal tracker. One
 * public route serves a shareable per-lead audit/demo page (HMAC-signed).
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import crypto from "node:crypto";
import { db, leads, leadIntel, PIPELINE_STAGES, type PipelineStage, type Lead, type LeadIntel } from "@workspace/db";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { getIntel, upsertIntel, auditAndStore } from "../lib/intelCore";
import { recommendOffer, estimateDealValue } from "../lib/offer";
import { generateMessages } from "../lib/intelMessages";
import { computeRevenueGoal } from "../lib/revenueGoal";
import { buildDailyReport, listDueToday } from "../lib/dailyReport";
import { logger } from "../lib/logger";

const router = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

// Owner-only guard — same contract as the outreach console: admin secret OR a
// signed-in Clerk session (the admin UI carries the session token).
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"] ?? req.query.secret;
  if (ADMIN_SECRET && secret === ADMIN_SECRET) { next(); return; }
  if (getAuth(req).userId) { next(); return; }
  res.status(401).json({ error: "Sign in to use the command center." });
}

// ── HMAC for the public audit-page share links ──────────────────────────────
function auditSecret(): string {
  return process.env.ADMIN_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "mle-audit-share";
}
function auditSig(leadId: number): string {
  return crypto.createHmac("sha256", auditSecret()).update(`audit:${leadId}`).digest("hex").slice(0, 20);
}
function auditSigValid(leadId: number, sig: string): boolean {
  const want = auditSig(leadId);
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function city(address: string | null): string | null {
  return (address ?? "").split(",").slice(-2).join(",").trim() || null;
}

async function getLead(id: number): Promise<Lead | null> {
  const rows = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return rows[0] ?? null;
}

// ── Dashboards ──────────────────────────────────────────────────────────────
router.get("/revenue-goal", requireAuth, async (_req, res) => {
  try {
    res.json(await computeRevenueGoal());
  } catch (err) {
    logger.error({ err }, "revenue-goal failed");
    res.status(500).json({ error: "Could not compute revenue goal." });
  }
});

router.get("/daily-report", requireAuth, async (_req, res) => {
  try {
    res.json(await buildDailyReport());
  } catch (err) {
    logger.error({ err }, "daily-report failed");
    res.status(500).json({ error: "Could not build daily report." });
  }
});

router.get("/due-today", requireAuth, async (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 30);
  try {
    res.json({ items: await listDueToday(limit) });
  } catch (err) {
    logger.error({ err }, "due-today failed");
    res.status(500).json({ error: "Could not load follow-ups." });
  }
});

// ── CRM: list leads joined with their intel ─────────────────────────────────
router.get("/leads", requireAuth, async (req, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const q = String(req.query.q ?? "").trim();
  const stage = String(req.query.stage ?? "").trim();
  const sort = String(req.query.sort ?? "value");

  const where = and(
    isNull(leads.deletedAt),
    q ? or(ilike(leads.name, `%${q}%`), ilike(leads.category, `%${q}%`), ilike(leads.address, `%${q}%`)) : undefined,
    stage && PIPELINE_STAGES.includes(stage as PipelineStage) ? eq(leadIntel.stage, stage as PipelineStage) : undefined,
  );
  const orderCol = sort === "opportunity" ? leads.opportunityScore : sort === "score" ? leads.score : leads.valueScore;

  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      website: leads.website,
      address: leads.address,
      category: leads.category,
      rating: leads.rating,
      reviewCount: leads.reviewCount,
      score: leads.score,
      opportunityScore: leads.opportunityScore,
      valueScore: leads.valueScore,
      needs: leads.needs,
      highTicket: leads.highTicket,
      gmapsUrl: leads.gmapsUrl,
      status: leads.status,
      stage: leadIntel.stage,
      audit: leadIntel.audit,
      recommendedOffer: leadIntel.recommendedOffer,
      messages: leadIntel.messages,
      estimatedDealValue: leadIntel.estimatedDealValue,
      nextFollowUpAt: leadIntel.nextFollowUpAt,
      lastContactedAt: leadIntel.lastContactedAt,
      aiNotes: leadIntel.aiNotes,
      scoreReason: leadIntel.scoreReason,
    })
    .from(leads)
    .leftJoin(leadIntel, eq(leadIntel.leadId, leads.id))
    .where(where)
    .orderBy(desc(orderCol))
    .limit(limit)
    .offset(offset);

  res.json({
    leads: rows.map((r) => ({
      ...r,
      city: city(r.address),
      grade: r.audit?.grade ?? null,
      offerLabel: r.recommendedOffer?.label ?? null,
      hasDrafts: !!r.messages && Object.keys(r.messages).length > 0,
      approvedCount: r.messages ? Object.values(r.messages).filter((m) => m?.approved).length : 0,
    })),
  });
});

// ── Website audit (+ auto offer + deal-value estimate) ──────────────────────
router.post("/leads/:id/audit", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const lead = await getLead(id);
  if (!lead) { res.status(404).json({ error: "Lead not found." }); return; }
  try {
    res.json({ intel: await auditAndStore(lead) });
  } catch (err) {
    logger.error({ err, id }, "audit failed");
    res.status(500).json({ error: "Audit failed." });
  }
});

// Batch-audit the highest-opportunity leads that have no intel yet.
router.post("/audit-batch", requireAuth, async (req, res) => {
  const limit = Math.min(25, Number(req.body?.limit) || 10);
  const rows = await db
    .select()
    .from(leads)
    .leftJoin(leadIntel, eq(leadIntel.leadId, leads.id))
    .where(and(isNull(leads.deletedAt), isNull(leadIntel.id)))
    .orderBy(desc(leads.valueScore))
    .limit(limit);
  let done = 0;
  for (const row of rows) {
    try { await auditAndStore(row.leads); done++; } catch (err) { logger.warn({ err }, "batch audit item failed"); }
  }
  res.json({ audited: done, requested: rows.length });
});

// ── Offer (recompute on demand) ─────────────────────────────────────────────
router.post("/leads/:id/offer", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const lead = await getLead(id);
  if (!lead) { res.status(404).json({ error: "Lead not found." }); return; }
  let intel = await getIntel(id);
  if (!intel?.audit) { intel = await auditAndStore(lead); res.json({ intel }); return; }
  const offer = recommendOffer(lead, intel.audit);
  const est = estimateDealValue(lead, offer);
  res.json({ intel: await upsertIntel(id, lead.clerkUserId ?? null, { recommendedOffer: offer, estimatedDealValue: est }) });
});

// ── Message writer (approval-gated) ─────────────────────────────────────────
router.post("/leads/:id/messages", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const lead = await getLead(id);
  if (!lead) { res.status(404).json({ error: "Lead not found." }); return; }
  try {
    let intel = await getIntel(id);
    if (!intel?.audit || !intel?.recommendedOffer) intel = await auditAndStore(lead);
    const messages = await generateMessages(lead, intel.audit!, intel.recommendedOffer!);
    const stage: PipelineStage = intel.stage === "New" || intel.stage === "Scored" ? "Message Ready" : (intel.stage as PipelineStage);
    res.json({ intel: await upsertIntel(id, lead.clerkUserId ?? null, { messages, stage }) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Message generation failed.";
    logger.error({ err, id }, "messages failed");
    res.status(msg.includes("No AI key") ? 400 : 500).json({ error: msg });
  }
});

// Approve / unapprove a single channel's draft.
router.post("/leads/:id/messages/:channel/approve", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const channel = String(req.params.channel);
  const approved = req.body?.approved !== false; // default true
  const intel = await getIntel(id);
  if (!intel?.messages || !(channel in intel.messages)) { res.status(404).json({ error: "No draft for that channel." }); return; }
  const messages = { ...intel.messages };
  const m = messages[channel as keyof typeof messages];
  if (m) messages[channel as keyof typeof messages] = { ...m, approved };
  const anyApproved = Object.values(messages).some((x) => x?.approved);
  const stage: PipelineStage =
    anyApproved && (intel.stage === "New" || intel.stage === "Scored" || intel.stage === "Message Ready")
      ? "Approved to Contact"
      : (intel.stage as PipelineStage);
  res.json({ intel: await upsertIntel(id, intel.clerkUserId ?? null, { messages, stage }) });
});

// Save an owner-edited draft body/subject (keeps approval state unless changed).
router.patch("/leads/:id/messages/:channel", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const channel = String(req.params.channel);
  const intel = await getIntel(id);
  if (!intel?.messages || !(channel in intel.messages)) { res.status(404).json({ error: "No draft for that channel." }); return; }
  const messages = { ...intel.messages };
  const m = messages[channel as keyof typeof messages];
  if (m) {
    messages[channel as keyof typeof messages] = {
      ...m,
      body: typeof req.body?.body === "string" ? req.body.body : m.body,
      subject: typeof req.body?.subject === "string" ? req.body.subject : m.subject,
    };
  }
  res.json({ intel: await upsertIntel(id, intel.clerkUserId ?? null, { messages }) });
});

// ── Pipeline: update stage / follow-up / deal value / notes ─────────────────
router.patch("/leads/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const lead = await getLead(id);
  if (!lead) { res.status(404).json({ error: "Lead not found." }); return; }
  const set: Partial<LeadIntel> = {};
  const b = req.body ?? {};
  if (typeof b.stage === "string" && PIPELINE_STAGES.includes(b.stage)) {
    set.stage = b.stage;
    if (b.stage === "Contacted") set.lastContactedAt = new Date();
  }
  if (b.estimatedDealValue != null && Number.isFinite(Number(b.estimatedDealValue))) set.estimatedDealValue = Math.round(Number(b.estimatedDealValue));
  if (typeof b.aiNotes === "string") set.aiNotes = b.aiNotes.slice(0, 4000);
  if (b.nextFollowUpAt === null) set.nextFollowUpAt = null;
  else if (typeof b.nextFollowUpAt === "string") {
    const d = new Date(b.nextFollowUpAt);
    if (!Number.isNaN(d.getTime())) set.nextFollowUpAt = d;
  }
  if (b.snoozeDays != null && Number.isFinite(Number(b.snoozeDays))) {
    set.nextFollowUpAt = new Date(Date.now() + Number(b.snoozeDays) * 864e5);
  }
  if (Object.keys(set).length === 0) { res.status(400).json({ error: "Nothing to update." }); return; }
  res.json({ intel: await upsertIntel(id, lead.clerkUserId ?? null, set) });
});

// ── Shareable audit/demo page ───────────────────────────────────────────────
// Owner fetches the signed link…
router.get("/leads/:id/audit-link", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const lead = await getLead(id);
  if (!lead) { res.status(404).json({ error: "Lead not found." }); return; }
  res.json({ path: `/api/command/audit/${id}.html?sig=${auditSig(id)}` });
});

function contactCta(): { href: string; label: string } {
  const booking = process.env.BOOKING_URL;
  if (booking) return { href: booking, label: "Book a quick call" };
  const email = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || process.env.GMAIL_USER || "";
  return { href: email ? `mailto:${email}` : "#", label: "Get in touch" };
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function renderAuditPage(lead: Lead, intel: LeadIntel): string {
  const a = intel.audit;
  const offer = intel.recommendedOffer;
  const cta = contactCta();
  const findings = a?.findings ?? [];
  const gradeColor = a?.grade === "A" || a?.grade === "B" ? "#16a34a" : a?.grade === "C" ? "#d97706" : "#dc2626";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>Website review for ${esc(lead.name ?? "your business")}</title>
<style>
  :root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--bg:#f8fafc;--card:#fff;--brand:#4f46e5}
  *{box-sizing:border-box}body{margin:0;font:16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
  .wrap{max-width:720px;margin:0 auto;padding:32px 20px 64px}
  .eyebrow{color:var(--brand);font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-size:13px}
  h1{font-size:30px;line-height:1.2;margin:.2em 0 .1em}
  .sub{color:var(--muted);margin:0 0 24px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px;margin:16px 0;box-shadow:0 1px 2px rgba(0,0,0,.03)}
  .grade{display:inline-flex;align-items:center;justify-content:center;width:74px;height:74px;border-radius:16px;color:#fff;font-size:38px;font-weight:800;background:${gradeColor}}
  .row{display:flex;gap:18px;align-items:center}
  ul{margin:12px 0 0;padding-left:0;list-style:none}
  li{padding:10px 0;border-top:1px solid var(--line);display:flex;gap:10px}
  li:first-child{border-top:0}
  .x{color:#dc2626;font-weight:800}
  .offer{background:linear-gradient(135deg,#eef2ff,#faf5ff);border-color:#c7d2fe}
  .price{font-weight:700}
  .cta{display:inline-block;margin-top:8px;background:var(--brand);color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700}
  .foot{color:var(--muted);font-size:13px;margin-top:28px;text-align:center}
</style></head><body><div class="wrap">
  <div class="eyebrow">Free website review</div>
  <h1>${esc(lead.name ?? "Your business")}</h1>
  <p class="sub">${esc(city(lead.address) ?? "")}${lead.category ? " · " + esc(lead.category) : ""}</p>

  <div class="card"><div class="row">
    <div class="grade">${esc(a?.grade ?? "F")}</div>
    <div><strong>Website grade</strong><br/><span style="color:var(--muted)">${esc(a?.summary ?? "")}</span></div>
  </div></div>

  <div class="card">
    <strong>What your site is missing</strong>
    <ul>${(findings.length ? findings : ["No major issues found — nice work."]).map((f) => `<li><span class="x">✕</span><span>${esc(f)}</span></li>`).join("")}</ul>
  </div>

  ${offer ? `<div class="card offer">
    <strong>What I can fix first</strong>
    <p style="margin:.5em 0">${esc(offer.label)} — ${esc(offer.reason)}</p>
    <p class="price">Typical range: $${offer.priceLow.toLocaleString()}–$${offer.priceHigh.toLocaleString()}${offer.recurring ? "/mo" : ""}</p>
    <a class="cta" href="${esc(cta.href)}">${esc(cta.label)} →</a>
  </div>` : ""}

  <p class="foot">This is a free, no-obligation review based on a quick look at your public website. Numbers are typical ranges, not quotes or guarantees.</p>
</div></body></html>`;
}

// …and the public page renders it (link-guarded by HMAC; noindex). The whole
// filename is one param (Express 5 path syntax), regex-parsed like the existing
// /social-image/:file route.
router.get("/audit/:file", async (req, res) => {
  const m = /^(\d+)\.html$/.exec(String(req.params.file ?? ""));
  const id = m ? Number(m[1]) : NaN;
  const sig = String(req.query.sig ?? "");
  if (!Number.isFinite(id) || !sig || !auditSigValid(id, sig)) { res.status(404).send("Not found"); return; }
  const lead = await getLead(id);
  const intel = await getIntel(id);
  if (!lead || !intel?.audit) { res.status(404).send("No audit available for this lead yet."); return; }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(renderAuditPage(lead, intel));
});

export default router;
