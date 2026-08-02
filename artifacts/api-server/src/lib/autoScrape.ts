/**
 * Auto-scrape scheduler — keeps lead inventory filled for what we sell.
 *
 * The manual flow (admin clicks one scrape target at a time) doesn't scale to
 * 48 categories × the core metros, so this scheduler works the plan
 * automatically, one target per tick (same in-process setInterval pattern as
 * the pack worker):
 *
 *   1. Seed: ensure scrape_targets covers every pack category we offer
 *      (PACK_CATEGORIES) in each core Gulf Coast metro — rows are created
 *      with source "auto" and never duplicate existing AI/manual targets.
 *   2. Pick: among active targets whose cooldown has passed, take the stalest
 *      (never-scraped first), highest-priority one whose actual lead
 *      inventory (counted with the same packWhere the checkout uses) is
 *      below the per-target goal. Targets at goal are skipped — no wasted
 *      browser time on saturated searches.
 *   3. Scrape: run the shared Google Maps engine through startRun/runScrapeJob
 *      so every auto run lands in the admin Scraper history (clerkUserId
 *      null = site-wide view), then auto-enrich contacts and update the
 *      target's coverage stats.
 *
 * The site-wide scrape lock is respected: customer runs and pack-order builds
 * always win — a busy lock just means this tick skips and retries later.
 *
 * Env knobs: AUTO_SCRAPE=off disables at boot (runtime toggle via
 * /api/admin/auto-scrape), AUTO_SCRAPE_INTERVAL_MS (default 15 min),
 * AUTO_SCRAPE_GOAL (leads per target before it's "full", default 150),
 * AUTO_SCRAPE_COOLDOWN_H (hours between scrapes of one target, default 24).
 */
import { db, scrapeTargets, type ScrapeTarget } from "@workspace/db";
import { and, asc, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { logger } from "./logger";
import { acquireScrapeLock, releaseScrapeLock } from "./scrapeLock";
import { startRun, runScrapeJob } from "./scrapeRuns";
import { countPackLeads, PACK_CATEGORIES, US_STATES } from "./packs";

const TICK_MS = Math.max(60_000, parseInt(process.env.AUTO_SCRAPE_INTERVAL_MS ?? "", 10) || 900_000);
const FIRST_TICK_DELAY_MS = 90_000;
const TARGET_GOAL = Math.max(10, parseInt(process.env.AUTO_SCRAPE_GOAL ?? "", 10) || 150);
const COOLDOWN_MS = Math.max(1, parseInt(process.env.AUTO_SCRAPE_COOLDOWN_H ?? "", 10) || 24) * 3_600_000;
// How many stalest targets get an inventory count each tick — keeps the pick
// cheap even with hundreds of targets.
const CANDIDATE_POOL = 15;

// The metros we actively stock (same set the standalone worker's queries.json
// seeds) — the "location we offer" half of the plan.
export const CORE_LOCATIONS = [
  "Mobile AL", "Pensacola FL", "Gulfport MS", "Biloxi MS", "Panama City FL", "New Orleans LA",
];

let enabled = (process.env.AUTO_SCRAPE ?? "on").toLowerCase() !== "off";
let tickInFlight = false;
let lastResult: { at: string; ran: boolean; detail: string } | null = null;

// ── Target → pack-filter mapping ─────────────────────────────────────────────

/** ILIKE term for counting a target's inventory: the pack category key when the
 * target matches one (so counts agree with what the checkout can sell),
 * otherwise the target's own category text. */
function packTermFor(category: string): string {
  const lower = category.toLowerCase();
  for (const [term] of PACK_CATEGORIES) {
    if (lower.includes(term)) return term;
  }
  return lower;
}

/** Split "Mobile AL" / "Mobile, AL" / "New Orleans LA" into city + state. */
function parseLocation(location: string): { city: string; state: string } {
  const m = location.trim().match(/^(.*?)[,\s]+([A-Za-z]{2})$/);
  if (m && US_STATES.has(m[2].toUpperCase())) {
    return { city: m[1].trim(), state: m[2].toUpperCase() };
  }
  return { city: location.trim(), state: "" };
}

async function inventoryFor(target: Pick<ScrapeTarget, "category" | "location">): Promise<number> {
  const { city, state } = parseLocation(target.location);
  return countPackLeads({ category: packTermFor(target.category), city, state });
}

// ── Seeding ──────────────────────────────────────────────────────────────────

/** Ensure every offered pack category has a target in each core metro. Existing
 * rows (AI, manual, or prior seeds) are left untouched. Returns rows added. */
export async function seedAutoTargets(): Promise<number> {
  const values = [...PACK_CATEGORIES.values()].flatMap((label) =>
    CORE_LOCATIONS.map((location) => ({ category: label, location, source: "auto" })),
  );
  const inserted = await db.insert(scrapeTargets).values(values)
    .onConflictDoNothing({ target: [scrapeTargets.category, scrapeTargets.location] })
    .returning({ id: scrapeTargets.id });
  return inserted.length;
}

// ── Picking ──────────────────────────────────────────────────────────────────

type Candidate = { target: ScrapeTarget; inventory: number };

/** The stalest cooled-down active targets with their live inventory — the tick
 * scrapes the first one under goal; the status endpoint previews the list. */
export async function listAutoCandidates(limit = CANDIDATE_POOL): Promise<Candidate[]> {
  const cutoff = new Date(Date.now() - COOLDOWN_MS);
  const rows = await db.select().from(scrapeTargets)
    .where(and(
      eq(scrapeTargets.active, true),
      or(isNull(scrapeTargets.lastScrapedAt), lt(scrapeTargets.lastScrapedAt, cutoff)),
    ))
    .orderBy(sql`${scrapeTargets.lastScrapedAt} ASC NULLS FIRST`, desc(scrapeTargets.priority), asc(scrapeTargets.id))
    .limit(limit);
  const out: Candidate[] = [];
  for (const target of rows) out.push({ target, inventory: await inventoryFor(target) });
  return out;
}

// ── Tick ─────────────────────────────────────────────────────────────────────

export type AutoScrapeTickResult = {
  ran: boolean;
  reason?: string;
  target?: { id: number; category: string; location: string; inventory: number };
  run?: { id: number; status: string; placesFound: number | null; saved: number | null; duplicates: number | null };
};

export async function autoScrapeTick(): Promise<AutoScrapeTickResult> {
  if (!enabled) return { ran: false, reason: "disabled" };
  if (tickInFlight) return { ran: false, reason: "previous tick still running" };
  tickInFlight = true;
  try {
    const candidates = await listAutoCandidates();
    const pick = candidates.find((c) => c.inventory < TARGET_GOAL);
    if (!pick) {
      const result = { ran: false, reason: candidates.length === 0 ? "no targets past cooldown" : "all candidates at inventory goal" };
      lastResult = { at: new Date().toISOString(), ran: false, detail: result.reason };
      return result;
    }

    if (!acquireScrapeLock()) {
      lastResult = { at: new Date().toISOString(), ran: false, detail: "scrape lock busy" };
      return { ran: false, reason: "scrape lock busy — another scrape is running" };
    }
    const { target } = pick;
    try {
      const run = await startRun("google_maps", target.category, target.location, null);
      const finished = await runScrapeJob(run.id, "google_maps", {
        category: target.category, location: target.location, maxScrolls: 6,
      });
      if (finished.status === "succeeded") {
        // Same enrichment step the manual target-scrape endpoint runs; dynamic
        // import because routes/admin.ts also imports this module.
        const { autoEnrichScraped } = await import("../routes/admin");
        await autoEnrichScraped(target.category).catch(() => null);
      }
      await db.update(scrapeTargets)
        .set({ lastScrapedAt: new Date(), leadCount: (target.leadCount ?? 0) + (finished.saved ?? 0) })
        .where(eq(scrapeTargets.id, target.id));

      const detail = `${target.category} in ${target.location}: ${finished.status}, saved ${finished.saved ?? 0} (had ${pick.inventory}/${TARGET_GOAL})`;
      lastResult = { at: new Date().toISOString(), ran: true, detail };
      logger.info({ targetId: target.id, runId: finished.id, saved: finished.saved, status: finished.status }, "auto-scrape tick done");
      return {
        ran: true,
        target: { id: target.id, category: target.category, location: target.location, inventory: pick.inventory },
        run: { id: finished.id, status: finished.status, placesFound: finished.placesFound, saved: finished.saved, duplicates: finished.duplicates },
      };
    } finally {
      releaseScrapeLock();
    }
  } catch (err) {
    logger.error({ err }, "auto-scrape tick failed");
    lastResult = { at: new Date().toISOString(), ran: false, detail: err instanceof Error ? err.message : "tick failed" };
    return { ran: false, reason: err instanceof Error ? err.message : "tick failed" };
  } finally {
    tickInFlight = false;
  }
}

// ── Control / status ─────────────────────────────────────────────────────────

export function setAutoScrapeEnabled(on: boolean): void {
  enabled = on;
  logger.info({ enabled }, "auto-scrape toggled");
}

export function autoScrapeStatus() {
  return {
    enabled,
    tickInFlight,
    lastResult,
    config: { intervalMs: TICK_MS, targetGoal: TARGET_GOAL, cooldownHours: COOLDOWN_MS / 3_600_000, coreLocations: CORE_LOCATIONS },
  };
}

export function startAutoScrapeScheduler(): void {
  // Idempotent seed (unique cat+loc constraint) so a fresh deploy starts with
  // full coverage of the offered categories without an admin action.
  setTimeout(() => {
    void seedAutoTargets()
      .then((added) => { if (added > 0) logger.info({ added }, "auto-scrape targets seeded at startup"); })
      .catch((err) => logger.warn({ err }, "auto-scrape startup seed failed"))
      .then(() => autoScrapeTick());
  }, FIRST_TICK_DELAY_MS);
  setInterval(() => void autoScrapeTick(), TICK_MS);
  logger.info({ enabled, intervalMs: TICK_MS }, "Auto-scrape scheduler started");
}
