/**
 * Extension-facing routes — no Clerk session, auth via x-mle-token / X-Api-Key.
 * All four live routes return the { code, result } envelope the extension expects.
 * /delete-account is the only plain-JSON exception per the spec.
 *
 * Mounted with router.use(extRouter) — no prefix stripping — so paths here are
 * exactly what the extension hits under /api/*
 */
import { Router } from "express";
import crypto from "node:crypto";
import { db, logs } from "@workspace/db";
import { desc } from "drizzle-orm";
import { storage } from "../storage.js";

const router = Router();
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

// ── POST /auth/token ──────────────────────────────────────────────────────────
// Extension boot: anonCode → stable token. We derive the token as a SHA-256
// hash of the anonCode so it's always consistent without needing a tokens table.
router.post("/auth/token", (req, res) => {
  const { anonCode } = req.body ?? {};
  if (!anonCode) {
    res.json({ code: 400, message: "anonCode required" });
    return;
  }
  const token =
    "tok_" +
    crypto
      .createHash("sha256")
      .update(String(anonCode))
      .digest("hex")
      .slice(0, 48);
  res.json({ code: 200, result: { ik: token } });
});

// ── GET /config/docking ───────────────────────────────────────────────────────
// Remote config — push Bing selector patches via bingMapsVersions without a
// store re-release. Keep [] until a hotfix is needed.
router.get("/config/docking", (_req, res) => {
  res.json({
    code: 200,
    result: {
      logLevel: LOG_LEVEL,
      bingMapsVersions: [],
    },
  });
});

// ── GET /user/info ────────────────────────────────────────────────────────────
// Returns plan + quota. Extension sends x-mle-token here; the panel gates on
// the API key not this response, so we always report unlimited.
router.get("/user/info", (_req, res) => {
  res.json({
    code: 200,
    result: {
      plan: "unlimited",
      quota: null,
      used: 0,
      remaining: null,
    },
  });
});

// ── POST /telemetry/log ───────────────────────────────────────────────────────
// Anonymous diagnostics sink — persist to DB and acknowledge.
router.post("/telemetry/log", async (req, res) => {
  const e = req.body ?? {};
  await db.insert(logs).values({
    appId: e.appId ?? null,
    name: e.name ?? null,
    message: e.message ?? null,
    type: e.type ?? null,
  }).catch(() => {});
  req.log.info({ name: e.name, type: e.type }, "extension telemetry");
  res.json({ code: 200, result: { ok: true } });
});

// ── POST /delete-account ──────────────────────────────────────────────────────
// GDPR delete: wipes the user + their leads. Auth: X-Api-Key header.
// Returns plain JSON (no envelope) per spec.
router.post("/delete-account", async (req, res) => {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ message: "Missing X-Api-Key header" });
    return;
  }
  const user = await storage.getUserByApiKey(apiKey);
  if (!user) {
    res.status(401).json({ message: "Invalid API key" });
    return;
  }
  await storage.deleteUser(user.id);
  req.log.info({ userId: user.id }, "Account deleted (GDPR)");
  res.json({ deleted: true });
});

export default router;
