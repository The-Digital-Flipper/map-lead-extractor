/**
 * Twice-daily digest of landing-page leads (free-sample email captures).
 *
 * The pack widget's "see 5 real leads free" flow captures visitor emails into
 * `sample_requests` (rows WHERE email IS NOT NULL — see routes/stripe.ts).
 * This module emails the OWNER a summary of new captures twice a day so they
 * don't have to watch the admin tab. It sends nothing to visitors — that's the
 * buyer-followup nurture's job (lib/buyer-followup.ts).
 *
 * Persistence: each successful digest writes a `logs` row (name
 * "captured_digest"), and the next run only includes captures unlocked after
 * that row's timestamp — so restarts never re-send or drop leads. Empty
 * periods are skipped silently (no stamp, so those leads roll into the next
 * non-empty digest).
 */
import { db, sampleRequests, logs } from "@workspace/db";
import { and, desc, eq, gt, isNotNull } from "drizzle-orm";
import { logger } from "./logger";
import {
  getOutreachSettings, sendGmailMail, gmailSendAddress, gmailSendReady,
  resendConfigured, replitMailConfigured, sendReplitMail,
} from "./outreach-auto";
import { refreshGmailConnector } from "./gmailConnector";

const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "https://mapleadextractor.net";
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const LOG_NAME = "captured_digest";

// Local hours (per outreach_settings.tzOffsetMinutes) at which a digest goes
// out — morning and late afternoon.
const SEND_HOURS_LOCAL = [8, 16];
const TICK_MS = 5 * 60 * 1000;
const FIRST_TICK_DELAY_MS = 60_000;
// Never send two digests closer than this, whatever the clock says.
const MIN_GAP_MS = 3 * 60 * 60 * 1000;
// With no prior digest on record, the first one looks back this far.
const FIRST_DIGEST_LOOKBACK_MS = 24 * 60 * 60 * 1000;

function ownerEmail(): string {
  return process.env.ALERT_EMAIL || process.env.OWNER_EMAIL
    || process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL
    || gmailSendAddress() || "";
}

/** When the last digest went out, or null if none ever has. */
async function lastDigestAt(): Promise<Date | null> {
  const [row] = await db.select({ at: logs.createdAt }).from(logs)
    .where(eq(logs.name, LOG_NAME)).orderBy(desc(logs.createdAt)).limit(1);
  return row?.at ?? null;
}

function describeRequest(r: typeof sampleRequests.$inferSelect): string {
  const what = r.label || r.rawRequest || r.category || "leads";
  const where = [r.city, r.state].filter(Boolean).join(", ");
  return where ? `${what} — ${where}` : what;
}

function buildDigest(rows: (typeof sampleRequests.$inferSelect)[], since: Date):
  { subject: string; text: string; html: string } {
  const subject = `${rows.length} new landing-page lead${rows.length === 1 ? "" : "s"} captured`;

  const lines = rows.map(r => {
    const when = (r.unlockedAt ?? r.createdAt).toISOString().slice(0, 16).replace("T", " ");
    return `  • ${r.email}  (${describeRequest(r)})  ${when} UTC`;
  });
  const text = [
    `${rows.length} visitor${rows.length === 1 ? "" : "s"} left their email on the site since ${since.toISOString().slice(0, 16).replace("T", " ")} UTC:`,
    "",
    ...lines,
    "",
    `Full list + CSV export: ${PUBLIC_ORIGIN}/admin (Captured Leads tab)`,
  ].join("\n");

  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rowsHtml = rows.map(r => {
    const when = (r.unlockedAt ?? r.createdAt).toISOString().slice(0, 16).replace("T", " ");
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eee"><a href="mailto:${esc(r.email!)}">${esc(r.email!)}</a></td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(describeRequest(r))}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;white-space:nowrap">${when} UTC</td>
    </tr>`;
  }).join("");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p><strong>${rows.length}</strong> visitor${rows.length === 1 ? "" : "s"} left their email on the site since ${since.toISOString().slice(0, 16).replace("T", " ")} UTC:</p>
<table style="border-collapse:collapse;font-size:14px">${rowsHtml}</table>
<p><a href="${PUBLIC_ORIGIN}/admin" style="display:inline-block;background:#00c853;color:#fff;font-weight:700;padding:10px 18px;border-radius:8px;text-decoration:none">Open Captured Leads</a></p>
</div>`;
  return { subject, text, html };
}

// Same provider cascade the pack emails use: Gmail (owner's own inbox) first,
// then Resend, then Replit Mail.
async function deliver(to: string, subject: string, text: string, html: string): Promise<boolean> {
  if (gmailSendReady()) {
    await sendGmailMail({ fromName: "MapLeadExtractor", to, subject, text, html });
    return true;
  }
  if (resendConfigured()) {
    const from = process.env.ALERT_FROM_EMAIL || "MapLeadExtractor <onboarding@resend.dev>";
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      logger.error({ status: res.status }, "captured-leads digest via Resend failed");
      return false;
    }
    return true;
  }
  if (replitMailConfigured()) {
    await sendReplitMail({ to, subject, text, html });
    return true;
  }
  logger.warn("no email provider configured — captured-leads digest NOT sent");
  return false;
}

/** Send the digest now if there are new captures. Exported for the admin
 *  "send now" hook and tests; the scheduler decides WHEN to call it. */
export async function sendCapturedDigest(): Promise<{ sent: boolean; count: number }> {
  let to = ownerEmail();
  if (!to) {
    // The Gmail-connector address is only known after a connector fetch —
    // make sure one has happened.
    await refreshGmailConnector().catch(() => false);
    to = ownerEmail();
  }
  if (!to) {
    // Last resort: the owner's own address from the Automate settings.
    const s = await getOutreachSettings();
    to = (s.replyTo || s.fromEmail || "").trim();
  }
  if (!to) {
    logger.warn("no owner email configured (ALERT_EMAIL/OWNER_EMAIL/ADMIN_EMAIL) — captured-leads digest skipped");
    return { sent: false, count: 0 };
  }

  const last = await lastDigestAt();
  const since = last ?? new Date(Date.now() - FIRST_DIGEST_LOOKBACK_MS);
  const rows = await db.select().from(sampleRequests)
    .where(and(
      isNotNull(sampleRequests.email),
      isNotNull(sampleRequests.unlockedAt),
      gt(sampleRequests.unlockedAt, since),
    ))
    .orderBy(desc(sampleRequests.unlockedAt));

  if (!rows.length) return { sent: false, count: 0 };

  const { subject, text, html } = buildDigest(rows, since);
  const ok = await deliver(to, subject, text, html);
  if (!ok) return { sent: false, count: rows.length };

  await db.insert(logs).values({ name: LOG_NAME, type: "system", message: String(rows.length) });
  logger.info({ to, count: rows.length }, "captured-leads digest sent");
  return { sent: true, count: rows.length };
}

async function digestTick(): Promise<void> {
  try {
    const s = await getOutreachSettings();
    const local = new Date(Date.now() + s.tzOffsetMinutes * 60_000);
    if (!SEND_HOURS_LOCAL.includes(local.getUTCHours())) return;

    const last = await lastDigestAt();
    if (last && Date.now() - last.getTime() < MIN_GAP_MS) return;

    await sendCapturedDigest();
  } catch (err) {
    logger.error({ err }, "captured-leads digest tick failed");
  }
}

export function startCapturedDigestScheduler(): void {
  setTimeout(() => void digestTick(), FIRST_TICK_DELAY_MS);
  setInterval(() => void digestTick(), TICK_MS);
  logger.info("Captured-leads digest scheduler started (8am & 4pm local)");
}
