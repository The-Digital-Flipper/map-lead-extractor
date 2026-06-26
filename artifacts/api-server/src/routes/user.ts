import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { storage } from "../storage";

const router = Router();

/**
 * POST /api/user/generate-key
 * Creates (or regenerates) the calling user's API key.
 * Stores it in our DB and syncs it to Clerk publicMetadata so the
 * dashboard can read it via user.publicMetadata.apiKey without an
 * extra round-trip.
 */
router.post("/generate-key", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Ensure the user row exists before setting the key
  const email = (req as unknown as { auth?: { sessionClaims?: { email?: string } } })
    .auth?.sessionClaims?.email ?? "";
  await storage.upsertUser(auth.userId, email);

  const apiKey = await storage.generateApiKey(auth.userId);

  // Mirror to Clerk publicMetadata so the frontend reads it via useUser()
  try {
    await clerkClient.users.updateUserMetadata(auth.userId, {
      publicMetadata: { apiKey },
    });
  } catch {
    // Non-fatal: DB has the key, Clerk sync is best-effort
    req.log.warn({ userId: auth.userId }, "Could not sync apiKey to Clerk metadata");
  }

  req.log.info({ userId: auth.userId }, "API key generated");
  res.json({ apiKey });
});

/**
 * GET /api/user/api-key
 * Returns the current user's API key if one exists.
 */
router.get("/api-key", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await storage.getUser(auth.userId);
  if (!user?.apiKey) {
    res.status(404).json({ apiKey: null });
    return;
  }

  res.json({ apiKey: user.apiKey });
});

export default router;
