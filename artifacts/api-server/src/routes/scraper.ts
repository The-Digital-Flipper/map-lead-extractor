/**
 * Public "Scraper" console — an Apify-style run console customers use
 * themselves (as opposed to /admin/scraper, the owner's site-wide internal
 * view). One route per actor (platform), each backed by its own engine in
 * lib/scrape*.ts, but sharing the same run history, quota and CSV export
 * logic — every run is owned by the signed-in Clerk user and quota-limited
 * per day, combined across all actors (the headless-browser cost is the
 * same regardless of which site got scraped).
 */
import { Router } from "express";
import { getAuth } from "@clerk/express";
import type { ScrapePlatform } from "@workspace/db";
import { storage } from "../storage";
import { startRun, runScrapeJob, listRuns, getRun, deleteRun, countRunsToday, runToCsv } from "../lib/scrapeRuns";
import { autoEnrichScraped } from "./admin";
import { scrapeInFlight, acquireScrapeLock, releaseScrapeLock } from "../lib/scrapeLock";

const router = Router();

// URL slug (matches the Store's actor cards) → internal platform enum.
const PLATFORM_SLUGS: Record<string, ScrapePlatform> = {
  "google-maps": "google_maps",
  "yelp": "yelp",
  "bing-maps": "bing_maps",
};

// Scraping is far heavier than an AI text call (headless Chromium + proxy
// pool + only one run at a time site-wide), so limits stay tight — and are
// shared across every actor, not per-actor, since the compute cost is the same.
const RUN_LIMIT_FREE = 1;
const RUN_LIMIT_PRO = 5;

function resolvePlatform(slug: string): ScrapePlatform | null {
  return PLATFORM_SLUGS[slug] ?? null;
}

router.post("/:platform/runs", async (req, res) => {
  const platform = resolvePlatform(req.params.platform);
  if (!platform) { res.status(404).json({ error: "Unknown scraper." }); return; }

  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to use the Scraper." }); return; }

  const body = (req.body ?? {}) as {
    category?: string; location?: string; maxScrolls?: number; maxPlaces?: number; enrichContacts?: boolean;
  };
  const category = String(body.category ?? "").trim();
  const location = String(body.location ?? "").trim();
  if (!category) { res.status(400).json({ error: "category is required (e.g. \"plumbers\")" }); return; }
  const enrichContacts = body.enrichContacts !== false;

  const user = await storage.getUser(userId);
  const sub = user?.stripeCustomerId ? await storage.getActiveSubscriptionForCustomer(user.stripeCustomerId) : null;
  const isPro = !!sub;
  const limit = isPro ? RUN_LIMIT_PRO : RUN_LIMIT_FREE;
  const used = await countRunsToday(userId);
  if (used >= limit) {
    res.status(429).json({
      error: isPro
        ? `You've used all ${limit} scraper runs for today — more unlock tomorrow.`
        : `You've used your ${limit} free scraper run for today. Upgrade to Pro for ${RUN_LIMIT_PRO} runs a day.`,
      upgrade: !isPro,
      used, limit,
    });
    return;
  }

  if (!acquireScrapeLock()) {
    res.status(429).json({ error: "A scrape is already running site-wide — try again in a moment." });
    return;
  }

  try {
    const run = await startRun(platform, category, location || undefined, userId);
    const finished = await runScrapeJob(run.id, platform, {
      category,
      location: location || undefined,
      maxScrolls: typeof body.maxScrolls === "number" ? body.maxScrolls : 3,
      maxPlaces: typeof body.maxPlaces === "number" ? body.maxPlaces : undefined,
    });
    if (enrichContacts && finished.status === "succeeded") await autoEnrichScraped(category).catch(() => null);
    req.log.info({ runId: finished.id, platform, userId, status: finished.status, saved: finished.saved }, "customer scraper run done");
    res.json({ ok: finished.status === "succeeded", run: finished, used: used + 1, limit });
  } catch (err) {
    req.log.error({ err, platform, userId }, "customer scraper run failed to start");
    res.status(500).json({ error: err instanceof Error ? err.message : "Scrape failed" });
  } finally {
    releaseScrapeLock();
  }
});

router.get("/:platform/runs", async (req, res) => {
  const platform = resolvePlatform(req.params.platform);
  if (!platform) { res.status(404).json({ error: "Unknown scraper." }); return; }
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to use the Scraper." }); return; }
  const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? "30"), 10) || 30));
  res.json({ runs: await listRuns(limit, userId, platform), inFlight: scrapeInFlight() });
});

router.get("/runs/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to use the Scraper." }); return; }
  const run = await getRun(Number(req.params.id), userId);
  if (!run) { res.status(404).json({ error: "Run not found" }); return; }
  res.json({ run });
});

router.get("/runs/:id/export", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to use the Scraper." }); return; }
  const run = await getRun(Number(req.params.id), userId);
  if (!run) { res.status(404).json({ error: "Run not found" }); return; }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="scrape-run-${run.id}.csv"`);
  res.send(runToCsv(run));
});

router.delete("/runs/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to use the Scraper." }); return; }
  await deleteRun(Number(req.params.id), userId);
  res.json({ ok: true });
});

export default router;
