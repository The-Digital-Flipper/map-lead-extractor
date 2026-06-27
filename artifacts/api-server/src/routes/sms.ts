import { Router } from "express";
import { getAuth } from "@clerk/express";
import twilio from "twilio";

const router = Router();

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

/**
 * GET /api/sms/config
 * Returns whether Twilio is configured so the UI can show/hide the Send button.
 */
router.get("/config", (req, res) => {
  const available = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
  res.json({ available, fromNumber: available ? process.env.TWILIO_FROM_NUMBER : null });
});

/**
 * POST /api/sms/send
 * Body: { phones: string[], message: string }
 * Sends the message to each phone number via Twilio.
 * Requires Clerk auth + Twilio env vars.
 */
router.post("/send", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const client = getTwilioClient();
  if (!client) {
    res.status(503).json({ error: "SMS not configured — add Twilio credentials in Settings." });
    return;
  }

  const { phones, message } = req.body as { phones?: string[]; message?: string };
  if (!Array.isArray(phones) || phones.length === 0) {
    res.status(400).json({ error: "phones array is required" });
    return;
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const from = process.env.TWILIO_FROM_NUMBER!;
  const results: { phone: string; ok: boolean; error?: string }[] = [];

  await Promise.allSettled(
    phones.map(async (phone) => {
      try {
        await client.messages.create({ from, to: phone, body: message.trim() });
        results.push({ phone, ok: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ phone, ok: false, error: msg });
        req.log.warn({ phone, err: msg }, "SMS send failed");
      }
    })
  );

  const failed = results.filter((r) => !r.ok);
  req.log.info({ userId: auth.userId, total: phones.length, failed: failed.length }, "SMS batch sent");
  res.json({ sent: results.filter((r) => r.ok).length, failed: failed.length, results });
});

export default router;
