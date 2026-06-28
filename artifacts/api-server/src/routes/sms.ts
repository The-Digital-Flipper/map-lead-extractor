import { Router } from "express";
import { getAuth } from "@clerk/express";
import twilio, { validateRequest } from "twilio";
import { db, smsMessages } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX for US numbers).
 * Handles: (555) 123-4567, 555-123-4567, 5551234567, 15551234567, +15551234567, etc.
 */
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.trimStart().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return raw.trim(); // return as-is; Twilio will reject unknown formats
}

// The real Twilio Account SID (AC...). Not sensitive — it appears in every
// Twilio REST API URL. Used as a last-resort fallback because TWILIO_ACCOUNT_SID
// in Secrets was mistakenly set to an API Key (SK...). Env always wins, so this
// can be overridden without a code change.
const ACCOUNT_SID_FALLBACK = "AC8dcc703ff000ad04c2750a748ea762ea";

function getTwilioClient() {
  // Standard auth: Account SID (AC...) + Auth Token. TWILIO_AUTH_TOKEN holds the
  // account Auth Token (verified working).
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return null;

  const accountSid =
    process.env.TWILIO_ACCOUNT_SID_AC ||
    (process.env.TWILIO_ACCOUNT_SID?.startsWith("AC")
      ? process.env.TWILIO_ACCOUNT_SID
      : undefined) ||
    ACCOUNT_SID_FALLBACK;

  return twilio(accountSid, token);
}

/** GET /api/sms/config */
router.get("/config", (_req, res) => {
  const available = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
  res.json({ available, fromNumber: available ? process.env.TWILIO_FROM_NUMBER : null });
});

/**
 * POST /api/sms/webhook
 * Twilio calls this URL when an inbound SMS arrives.
 * Configure in Twilio Console → Phone Numbers → your number → Messaging webhook.
 * URL: https://mapleadextractor.net/api/sms/webhook
 */
router.post("/webhook", async (req, res) => {
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";

  // Validate the request came from Twilio
  if (authToken) {
    const proto = req.headers["x-forwarded-proto"] ?? "https";
    const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
    const url = `${proto}://${host}/api/sms/webhook`;
    const sig = (req.headers["x-twilio-signature"] as string) ?? "";
    const params = req.body as Record<string, string>;
    if (!validateRequest(authToken, sig, url, params)) {
      res.status(403).send("Forbidden");
      return;
    }
  }

  const from: string = (req.body as Record<string, string>).From ?? "";
  const body: string = (req.body as Record<string, string>).Body ?? "";

  if (from && body) {
    await db.insert(smsMessages).values({
      clerkUserId: null, // inbound: we don't know which user yet
      phone: from,
      direction: "inbound",
      body,
      read: "false",
    });
  }

  // Respond with empty TwiML so Twilio doesn't retry
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
});

/** GET /api/sms/conversations — list threads grouped by phone */
router.get("/conversations", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  // One row per unique phone: last message body + timestamp + unread count
  const rows = await db.execute(sql`
    SELECT
      phone,
      direction,
      body AS last_body,
      created_at AS last_at,
      (SELECT COUNT(*) FROM sms_messages m2 WHERE m2.phone = m.phone AND m2.read = 'false' AND m2.direction = 'inbound') AS unread
    FROM sms_messages m
    WHERE id IN (
      SELECT id FROM sms_messages sub
      WHERE sub.phone = m.phone
      ORDER BY created_at DESC LIMIT 1
    )
    ORDER BY last_at DESC
  `);

  res.json({ conversations: rows.rows });
});

/** GET /api/sms/conversation/:phone — full thread for one number */
router.get("/conversation/:phone", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const phone = decodeURIComponent(req.params.phone);

  // Mark inbound as read
  await db.execute(sql`
    UPDATE sms_messages SET read = 'true'
    WHERE phone = ${phone} AND direction = 'inbound' AND read = 'false'
  `);

  const msgs = await db
    .select()
    .from(smsMessages)
    .where(eq(smsMessages.phone, phone))
    .orderBy(smsMessages.createdAt);

  res.json({ messages: msgs });
});

/** POST /api/sms/reply — reply to a single number */
router.post("/reply", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const client = getTwilioClient();
  if (!client) { res.status(503).json({ error: "SMS not configured." }); return; }

  const { phone: rawPhone, message } = req.body as { phone?: string; message?: string };
  if (!rawPhone || !message?.trim()) {
    res.status(400).json({ error: "phone and message are required" });
    return;
  }
  const phone = toE164(rawPhone);
  const from = toE164(process.env.TWILIO_FROM_NUMBER ?? "");

  req.log.info({ from, to: phone }, "SMS reply attempt");
  try {
    await client.messages.create({ from, to: phone, body: message.trim() });
    await db.insert(smsMessages).values({
      clerkUserId: auth.userId,
      phone,
      direction: "outbound",
      body: message.trim(),
      read: "true",
    });
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ from, phone, err: msg }, "SMS reply failed");
    res.status(500).json({ error: msg });
  }
});

/** POST /api/sms/send — bulk send + log each to DB */
router.post("/send", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const client = getTwilioClient();
  if (!client) { res.status(503).json({ error: "SMS not configured." }); return; }

  const { phones, message } = req.body as { phones?: string[]; message?: string };
  if (!Array.isArray(phones) || phones.length === 0) {
    res.status(400).json({ error: "phones array is required" }); return;
  }
  if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }

  const from = toE164(process.env.TWILIO_FROM_NUMBER ?? "");
  req.log.info({ from, count: phones.length }, "SMS bulk send attempt");
  const results: { phone: string; ok: boolean; error?: string }[] = [];

  await Promise.allSettled(
    phones.map(async (rawPhone) => {
      const phone = toE164(rawPhone);
      try {
        await client.messages.create({ from, to: phone, body: message.trim() });
        await db.insert(smsMessages).values({
          clerkUserId: auth.userId,
          phone,
          direction: "outbound",
          body: message.trim(),
          read: "true",
        });
        results.push({ phone, ok: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ phone, ok: false, error: msg });
        req.log.warn({ from, phone, err: msg }, "SMS send failed");
      }
    })
  );

  const failed = results.filter((r) => !r.ok);
  req.log.info({ userId: auth.userId, total: phones.length, failed: failed.length }, "SMS batch sent");
  res.json({ sent: results.filter((r) => r.ok).length, failed: failed.length, results });
});

export default router;
