/**
 * Run history + dataset storage for the admin Scraper tab — Apify-console
 * style: every scrape is a "Run" with an input, a status, and a dataset
 * (the parsed places) the admin can browse or export, instead of a
 * fire-and-forget test that only ever showed a one-line result.
 */
import { db, scrapeRuns, type ScrapeRun, type ScrapePlatform } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { scrapeAndSave, type ScrapeResult } from "./scrape";
import { scrapeYelpAndSave } from "./scrapeYelp";
import { scrapeBingAndSave } from "./scrapeBing";
import { logger } from "./logger";

// One engine per platform — each returns the same ScrapeResult shape so the
// rest of this module (persistence, history, CSV export) never has to care
// which site a run actually scraped.
type ScrapeOpts = { category: string; location?: string; maxScrolls?: number; maxPlaces?: number };
const ENGINES: Record<ScrapePlatform, (opts: ScrapeOpts) => Promise<ScrapeResult>> = {
  google_maps: scrapeAndSave,
  yelp: scrapeYelpAndSave,
  bing_maps: scrapeBingAndSave,
};

export async function startRun(platform: ScrapePlatform, category: string, location: string | undefined, clerkUserId: string | null): Promise<ScrapeRun> {
  const rows = await db.insert(scrapeRuns).values({ platform, category, location: location || null, clerkUserId, status: "running" }).returning();
  return rows[0]!;
}

// Drives one scrape, persisting its outcome (dataset + counts, or the error)
// onto the run row created by startRun. Never throws — failure is a status.
export async function runScrapeJob(runId: number, platform: ScrapePlatform, opts: ScrapeOpts): Promise<ScrapeRun> {
  const startedAt = Date.now();
  try {
    const result: ScrapeResult = await ENGINES[platform](opts);
    const rows = await db
      .update(scrapeRuns)
      .set({
        status: "succeeded",
        placesFound: result.places,
        saved: result.saved,
        duplicates: result.duplicates,
        items: result.items,
        durationMs: Date.now() - startedAt,
        finishedAt: new Date(),
      })
      .where(eq(scrapeRuns.id, runId))
      .returning();
    return rows[0]!;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ runId, err }, "Scraper run failed");
    const rows = await db
      .update(scrapeRuns)
      .set({ status: "failed", error: msg.slice(0, 500), durationMs: Date.now() - startedAt, finishedAt: new Date() })
      .where(eq(scrapeRuns.id, runId))
      .returning();
    return rows[0]!;
  }
}

// clerkUserId: pass a user's id to scope to their own runs (the public
// Scraper page); omit for the admin tab's site-wide view. platform: pass to
// scope to one actor's history (each actor console only shows its own runs).
export async function listRuns(limit = 30, clerkUserId?: string, platform?: ScrapePlatform): Promise<Omit<ScrapeRun, "items">[]> {
  const conds = [
    clerkUserId ? eq(scrapeRuns.clerkUserId, clerkUserId) : undefined,
    platform ? eq(scrapeRuns.platform, platform) : undefined,
  ].filter((c): c is Exclude<typeof c, undefined> => c !== undefined);
  const rows = await db
    .select({
      id: scrapeRuns.id, clerkUserId: scrapeRuns.clerkUserId, platform: scrapeRuns.platform, category: scrapeRuns.category, location: scrapeRuns.location, status: scrapeRuns.status,
      placesFound: scrapeRuns.placesFound, saved: scrapeRuns.saved, duplicates: scrapeRuns.duplicates,
      error: scrapeRuns.error, durationMs: scrapeRuns.durationMs, startedAt: scrapeRuns.startedAt, finishedAt: scrapeRuns.finishedAt,
    })
    .from(scrapeRuns)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(scrapeRuns.id))
    .limit(Math.max(1, Math.min(100, limit)));
  return rows;
}

export async function getRun(id: number, clerkUserId?: string): Promise<ScrapeRun | null> {
  const rows = await db
    .select()
    .from(scrapeRuns)
    .where(clerkUserId ? and(eq(scrapeRuns.id, id), eq(scrapeRuns.clerkUserId, clerkUserId)) : eq(scrapeRuns.id, id));
  return rows[0] ?? null;
}

export async function deleteRun(id: number, clerkUserId?: string): Promise<void> {
  await db.delete(scrapeRuns).where(clerkUserId ? and(eq(scrapeRuns.id, id), eq(scrapeRuns.clerkUserId, clerkUserId)) : eq(scrapeRuns.id, id));
}

export async function countRunsToday(clerkUserId: string): Promise<number> {
  const since = new Date(); since.setUTCHours(0, 0, 0, 0);
  const rows = await db
    .select({ id: scrapeRuns.id })
    .from(scrapeRuns)
    .where(and(eq(scrapeRuns.clerkUserId, clerkUserId), gte(scrapeRuns.startedAt, since)));
  return rows.length;
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function runToCsv(run: ScrapeRun): string {
  const header = ["name", "phone", "website", "address", "rating", "reviews"];
  const lines = [header.join(",")];
  for (const item of run.items ?? []) {
    lines.push(header.map((h) => csvCell((item as Record<string, unknown>)[h])).join(","));
  }
  return lines.join("\n");
}
