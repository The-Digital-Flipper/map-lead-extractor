/**
 * Owner notifications — the "know the moment something happens" channel.
 *
 * notifyOwner() delivers a short message to the owner by email (same provider
 * cascade the digests use: Gmail → Resend → Replit Mail) and, when
 * OWNER_ALERT_PHONE is set, also as a text through the existing Twilio setup.
 * Used for hot-lead moments: a lead replying to outreach, or clicking a link
 * in a cold email. Fire-and-forget: an alert failure must never break the
 * pipeline that triggered it, so callers use `void notifyOwner(...)` and all
 * errors are swallowed into logs.
 */
import twilio from "twilio";
import { logger } from "./logger";
import {
  gmailSendReady, gmailSendAddress, sendGmailMail,
  resendConfigured, replitMailConfigured, sendReplitMail,
} from "./outreach-auto";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function ownerEmail(): string {
  return process.env.ALERT_EMAIL || process.env.OWNER_EMAIL
    || process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL
    || gmailSendAddress() || "";
}

function ownerPhone(): string {
  return (process.env.OWNER_ALERT_PHONE || "").trim();
}

// Same Twilio wiring as routes/sms.ts: standard AC-SID + auth-token auth, with
// the hardcoded AC fallback because TWILIO_ACCOUNT_SID in Secrets holds an API
// Key (SK...) by mistake.
function smsReady(): boolean {
  return !!(ownerPhone() && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER);
}

async function sendOwnerSms(body: string): Promise<void> {
  const sidEnv = process.env.TWILIO_ACCOUNT_SID || "";
  const sid = sidEnv.startsWith("AC") ? sidEnv : (process.env.TWILIO_ACCOUNT_SID_AC || "");
  const client = twilio(sid, process.env.TWILIO_AUTH_TOKEN!);
  await client.messages.create({
    from: process.env.TWILIO_FROM_NUMBER!,
    to: ownerPhone(),
    body: body.slice(0, 1500),
  });
}

async function sendOwnerEmail(subject: string, text: string, html?: string): Promise<void> {
  const to = ownerEmail();
  if (!to) return;
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml = html
    ?? `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${esc(text).replace(/\n/g, "<br>")}</div>`;
  if (gmailSendReady()) {
    await sendGmailMail({ fromName: "MapLeadExtractor", to, subject, text, html: bodyHtml });
  } else if (resendConfigured()) {
    const from = process.env.ALERT_FROM_EMAIL || "MapLeadExtractor <onboarding@resend.dev>";
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, html: bodyHtml }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}`);
  } else if (replitMailConfigured()) {
    await sendReplitMail({ to, subject, text, html: bodyHtml });
  }
}

/** Notify the owner by email — and by SMS too when `sms` text is given and
 * OWNER_ALERT_PHONE is configured. Never throws. */
export async function notifyOwner(opts: { subject: string; text: string; html?: string; sms?: string }): Promise<void> {
  try {
    await sendOwnerEmail(opts.subject, opts.text, opts.html);
  } catch (err) {
    logger.error({ err, subject: opts.subject }, "Owner email alert failed");
  }
  if (opts.sms && smsReady()) {
    try {
      await sendOwnerSms(opts.sms);
    } catch (err) {
      logger.error({ err }, "Owner SMS alert failed");
    }
  }
}
