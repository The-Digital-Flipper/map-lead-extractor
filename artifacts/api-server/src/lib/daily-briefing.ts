/**
 * Daily boss briefing — one morning email that answers "what did my machine do
 * yesterday and what's it doing today?" so the owner never has to dig:
 *
 *   • outreach: emails sent / failed, opens, clicks, replies (with excerpts);
 *   • social: what was posted where, with links;
 *   • money: lead-pack orders paid and revenue, emails captured on the site;
 *   • today: how many sends are queued and the daily posting slot.
 *
 * Sends once per day shortly after BRIEF_HOUR_LOCAL (local time comes from the
 * outreach settings' tzOffsetMinutes). The last-sent marker lives in the logs
 * table, same pattern as the captured-leads digest. Delivery reuses the owner
 * alert cascade (Gmail → Resend → Replit Mail).
 */
import { db, leads, outreachEmails, outreachReplies, socialPosts, packOrders, sampleRequests, logs } from "@workspace/db";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { logger } from "./logger";
import { getOutreachSettings } from "./outreach-auto";
import { notifyOwner, ownerEmail } from "./alerts";

const LOG_NAME = "daily-briefing";
const BRIEF_HOUR_LOCAL = 7;
const TICK_MS = 5 * 60 * 1000;
const FIRST_TICK_DELAY_MS = 75_000;
const MIN_GAP_MS = 20 * 60 * 60 * 1000; // never two briefings closer than 20h
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "https://mapleadextractor.net";

async function lastBriefingAt(): Promise<Date | null> {
  const [row] = await db.select({ at: logs.createdAt }).from(logs)
    .where(eq(logs.name, LOG_NAME)).orderBy(desc(logs.createdAt)).limit(1);
  return row?.at ?? null;
}

type Briefing = { subject: string; text: string };

async function buildBriefing(since: Date): Promise<Briefing> {
  const now = new Date();

  // Outreach numbers for the window.
  const [sent] = await db.select({ n: sql<number>`count(*)::int` }).from(outreachEmails)
    .where(and(eq(outreachEmails.status, "sent"), gte(outreachEmails.createdAt, since)));
  const [failed] = await db.select({ n: sql<number>`count(*)::int` }).from(outreachEmails)
    .where(and(eq(outreachEmails.status, "failed"), gte(outreachEmails.createdAt, since)));
  const [opened] = await db.select({ n: sql<number>`count(*)::int` }).from(outreachEmails)
    .where(gte(outreachEmails.openedAt, since));
  const [clicked] = await db.select({ n: sql<number>`count(*)::int` }).from(outreachEmails)
    .where(gte(outreachEmails.clickedAt, since));

  const replies = await db.select().from(outreachReplies)
    .where(and(eq(outreachReplies.direction, "in"), gte(outreachReplies.createdAt, since)))
    .orderBy(desc(outreachReplies.createdAt)).limit(10);
  const replyLeadIds = [...new Set(replies.map((r) => r.leadId))];
  const replyLeads = replyLeadIds.length
    ? await db.select({ id: leads.id, name: leads.name }).from(leads).where(inArray(leads.id, replyLeadIds))
    : [];
  const nameById = new Map(replyLeads.map((l) => [l.id, l.name]));

  // Social posts that went out.
  const posted = await db.select().from(socialPosts)
    .where(and(eq(socialPosts.status, "posted"), gte(socialPosts.postedAt, since), sql`${socialPosts.platform} <> 'facebook'`))
    .orderBy(desc(socialPosts.postedAt)).limit(10);
  const fbPosted = await db.select().from(socialPosts)
    .where(and(eq(socialPosts.status, "posted"), gte(socialPosts.postedAt, since), eq(socialPosts.platform, "facebook")))
    .limit(10);

  // Money.
  const paidOrders = await db.select().from(packOrders).where(gte(packOrders.paidAt, since));
  const revenueCents = paidOrders.reduce((a, o) => a + (o.amountCents - o.refundedCents), 0);
  const [captured] = await db.select({ n: sql<number>`count(*)::int` }).from(sampleRequests)
    .where(and(isNotNull(sampleRequests.email), gte(sampleRequests.unlockedAt, since)));

  // Today's pipeline.
  const endOfDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [queued] = await db.select({ n: sql<number>`count(*)::int` }).from(leads)
    .where(and(eq(leads.autoOutreach, true), isNull(leads.deletedAt), isNotNull(leads.nextEmailAt), lte(leads.nextEmailAt, endOfDay)));

  const lines: string[] = [];
  lines.push("MORNING BRIEFING", "");
  lines.push("— Outreach (last 24h) —");
  lines.push(`Sent: ${sent.n}${failed.n ? `  ·  Failed: ${failed.n}` : ""}`);
  lines.push(`Opened: ${opened.n}  ·  Clicked links: ${clicked.n}  ·  Replies: ${replies.length}`);
  if (replies.length) {
    lines.push("");
    for (const r of replies) {
      const who = nameById.get(r.leadId) || r.fromEmail;
      lines.push(`  • ${who}: "${r.body.slice(0, 140).replace(/\s+/g, " ")}"`);
    }
  }
  lines.push("", "— Social —");
  const allPosted = [...fbPosted, ...posted];
  if (allPosted.length) {
    for (const p of allPosted) lines.push(`  • ${p.platform}: posted${p.externalUrl ? ` — ${p.externalUrl}` : ""}`);
  } else {
    lines.push("  • Nothing posted in this window");
  }
  lines.push("", "— Money —");
  lines.push(`Lead-pack orders paid: ${paidOrders.length}${paidOrders.length ? `  ·  Revenue: $${(revenueCents / 100).toFixed(2)}` : ""}`);
  lines.push(`Emails captured on site: ${captured.n}`);
  // Subject-line scoreboard: open rates over the last week's mature sends
  // (≥24h old so pixels had time to fire), 3+ sends per subject to count.
  const subjectStats = await db.execute(sql`
    SELECT subject, count(*)::int AS sent,
           (count(*) FILTER (WHERE opened_at IS NOT NULL))::int AS opened
    FROM outreach_emails
    WHERE status = 'sent'
      AND created_at >= ${new Date(now.getTime() - 7 * 86_400_000)}
      AND created_at <= ${new Date(now.getTime() - 86_400_000)}
    GROUP BY subject HAVING count(*) >= 3
    ORDER BY (count(*) FILTER (WHERE opened_at IS NOT NULL))::float / count(*) DESC
    LIMIT 3
  `);
  const subjRows = subjectStats.rows as { subject: string; sent: number; opened: number }[];
  if (subjRows.length) {
    lines.push("", "— Best subject lines (7d) —");
    for (const r of subjRows) {
      lines.push(`  • "${r.subject.slice(0, 60)}" — ${Math.round((r.opened / r.sent) * 100)}% opened (${r.opened}/${r.sent})`);
    }
  }

  lines.push("", "— Today —");
  lines.push(`${queued.n} outreach emails queued to send`);
  lines.push("Daily social post goes out on schedule");
  lines.push("", `Dashboard: ${PUBLIC_ORIGIN}/admin`);

  const subject = `☀️ Daily briefing: ${sent.n} sent, ${replies.length} repl${replies.length === 1 ? "y" : "ies"}${paidOrders.length ? `, $${(revenueCents / 100).toFixed(0)} revenue` : ""}`;
  return { subject, text: lines.join("\n") };
}

/** Build and send the briefing now (used by the scheduler and the admin
 * "send now" button). Returns false when there's nowhere to send it. */
export async function sendBriefingNow(): Promise<boolean> {
  if (!ownerEmail()) return false;
  const last = await lastBriefingAt();
  const since = last ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const briefing = await buildBriefing(since);
  await notifyOwner({ subject: briefing.subject, text: briefing.text });
  await db.insert(logs).values({ name: LOG_NAME, message: briefing.subject, type: "info" });
  logger.info("Daily briefing sent");
  return true;
}

async function tick(): Promise<void> {
  try {
    const s = await getOutreachSettings();
    const local = new Date(Date.now() + s.tzOffsetMinutes * 60_000);
    if (local.getUTCHours() < BRIEF_HOUR_LOCAL) return;
    const last = await lastBriefingAt();
    if (last && Date.now() - last.getTime() < MIN_GAP_MS) return;
    await sendBriefingNow();
  } catch (err) {
    logger.error({ err }, "Daily briefing tick failed");
  }
}

export function startDailyBriefingScheduler(): void {
  setTimeout(() => void tick(), FIRST_TICK_DELAY_MS);
  setInterval(() => void tick(), TICK_MS);
  logger.info(`Daily briefing scheduler started (${BRIEF_HOUR_LOCAL}am local)`);
}
