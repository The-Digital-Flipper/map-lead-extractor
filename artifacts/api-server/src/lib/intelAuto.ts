/**
 * Auto-audit scheduler — the background half of the AI Command Center. On the
 * same in-process setInterval pattern as the other schedulers (see index.ts),
 * it picks the highest-opportunity leads that don't have intel yet and audits
 * them (grade + offer + deal-value estimate), so new scraper output is scored
 * and audited hands-free and the daily report/pipeline stay fresh.
 *
 * DELIBERATELY audit-only: it never generates AI messages (that costs money and
 * stays owner-triggered) and never sends anything. It only reads the
 * scraper-written `leads` table and writes to `lead_intel`.
 */
import { db, leads, leadIntel } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { auditAndStore } from "./intelCore";
import { logger } from "./logger";

const TICK_MS = 5 * 60_000;      // every 5 minutes
const FIRST_TICK_MS = 90_000;    // 90s after boot
const BATCH = 5;                 // leads audited per tick (gentle on outbound fetches)

async function tick(): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(leads)
      .leftJoin(leadIntel, eq(leadIntel.leadId, leads.id))
      .where(and(isNull(leads.deletedAt), isNull(leadIntel.id)))
      .orderBy(desc(leads.valueScore))
      .limit(BATCH);
    if (rows.length === 0) return;
    let done = 0;
    for (const row of rows) {
      try { await auditAndStore(row.leads); done++; } catch (err) { logger.warn({ err, leadId: row.leads.id }, "auto-audit item failed"); }
    }
    if (done > 0) logger.info({ audited: done }, "auto-audit tick");
  } catch (err) {
    logger.error({ err }, "auto-audit tick failed");
  }
}

export function startIntelScheduler(): void {
  setTimeout(() => void tick(), FIRST_TICK_MS);
  setInterval(() => void tick(), TICK_MS);
}
