/**
 * Extension-facing routes that existed in the old standalone backend.
 * These are called directly by the Chrome extensions (no Clerk session,
 * auth is via X-Api-Key / x-mle-token headers or the anonCode body param).
 */
import { Router } from "express";
import { storage } from "../storage.js";

const router = Router();

// ── POST /auth/token ───────────────────────────────────────────────────────────
// Extension boot: the extension sends an anonCode and gets back a short-lived
// token (ik) it can use for subsequent calls.  For simplicity we return the
// user's API key as the token if the anonCode maps to a known key; otherwise
// we return a generic guest token so the extension doesn't hard-fail.
router.post("/auth/token", async (req, res) => {
  const { anonCode } = req.body ?? {};

  if (anonCode) {
    const user = await storage.getUserByApiKey(String(anonCode));
    if (user?.apiKey) {
      res.json({ ik: user.apiKey, plan: "pro", quota: -1 });
      return;
    }
  }

  // Guest / unrecognised — return a harmless token so the extension boots
  res.json({ ik: "guest_" + Date.now(), plan: "free", quota: 500 });
});

// ── GET /config/docking ────────────────────────────────────────────────────────
// Remote config the extensions fetch on startup.  Used for hot-patching CSS
// selectors without a re-release.  Add fields here whenever Bing/Google change
// their DOM and you need to push a fix without a store update.
router.get("/config/docking", (_req, res) => {
  res.json({
    version: 1,
    google_maps: {
      result_selector: "[role='feed'] > div",
      name_selector: ".fontHeadlineSmall",
      phone_selector: "[data-item-id^='phone']",
      website_selector: "[data-item-id='authority']",
      rating_selector: ".fontBodyMedium span[aria-label]",
    },
    bing_maps: {
      listing_selector: ".listings-container .b-card",
      name_selector: ".b-card-title",
      phone_selector: ".b-card-phoneNumber",
      website_selector: ".b-card-website a",
    },
    yelp: {
      card_selector: "[data-testid='serp-ia-card']",
    },
    flags: {
      sync_enabled: true,
      telemetry_enabled: true,
    },
  });
});

// ── GET /user/info ─────────────────────────────────────────────────────────────
// Returns plan and quota for the calling user.  Accepts either X-Api-Key or
// the legacy x-mle-token header.  We treat every connected user as "unlimited"
// (matching the old backend behaviour described in the route table).
router.get("/user/info", async (req, res) => {
  const apiKey =
    (req.headers["x-api-key"] as string | undefined) ||
    (req.headers["x-mle-token"] as string | undefined);

  if (!apiKey) {
    res.status(401).json({ error: "Missing API key" });
    return;
  }

  const user = await storage.getUserByApiKey(apiKey);
  if (!user) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  res.json({
    email: user.email,
    plan: "pro",
    quota: -1,
    quotaUsed: 0,
    active: true,
  });
});

// ── POST /telemetry/log ────────────────────────────────────────────────────────
// Anonymous diagnostics sink — accept and acknowledge, no storage needed.
router.post("/telemetry/log", (req, res) => {
  res.json({ ok: true });
});

// ── POST /api/delete-account ───────────────────────────────────────────────────
// GDPR delete: wipes the user row and all their leads.
// Auth: X-Api-Key header (same as leads/save — extension-callable).
router.post("/delete-account", async (req, res) => {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ error: "Missing X-Api-Key header" });
    return;
  }

  const user = await storage.getUserByApiKey(apiKey);
  if (!user) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  await storage.deleteUser(user.id);
  req.log.info({ userId: user.id }, "Account deleted (GDPR)");
  res.json({ ok: true });
});

export default router;
