/**
 * Social auto-poster — keeps a queue of AI-written Facebook Page posts and
 * publishes one per day at the configured hour. Generation uses the OpenAI
 * key already set for the other AI features; publishing uses a Facebook Page
 * access token (FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN secrets).
 *
 * The admin Social tab drives everything through the /api/admin/social routes;
 * this module owns the actual generation, publishing, and the scheduler tick.
 */
import { db, socialPosts, socialSettings, type SocialPost, type SocialSettings } from "@workspace/db";
import { eq, desc, asc, and, gte, sql } from "drizzle-orm";
import { logger } from "./logger";

function openAiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";
}

export function facebookConfig(): { pageId: string; token: string } | null {
  const pageId = process.env.FACEBOOK_PAGE_ID ?? "";
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "";
  return pageId && token ? { pageId, token } : null;
}

// What the posts sell — same product framing as scripts/src/social-posts.ts,
// tuned for a brand's own Facebook Page (a bit more promo is fine there).
const PRODUCT = {
  name: "Map Lead Extractor",
  url: "https://mapleadextractor.net",
  oneLiner:
    "A tool that extracts business leads (name, phone, address, website, rating) from Google Maps so you can build targeted local-business lead lists in minutes instead of copying them by hand.",
  audience:
    "sales reps, marketing/lead-gen agencies, SaaS founders doing outbound, and small-business owners who sell to other local businesses",
  keyBenefits: [
    "Pull hundreds of local-business leads from Google Maps in a few minutes",
    "Export name, phone, website, address, category, and rating to CSV/spreadsheet",
    "Skip hours of manual copy-pasting from Maps",
    "Build hyper-targeted lists by city + business type for cold outreach",
  ],
};

// ── Settings (singleton row, id = 1) ─────────────────────────────────────────

export async function getSocialSettings(): Promise<SocialSettings> {
  const existing = await db.select().from(socialSettings).where(eq(socialSettings.id, 1));
  if (existing[0]) return existing[0];
  const inserted = await db
    .insert(socialSettings)
    .values({ id: 1 })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];
  const again = await db.select().from(socialSettings).where(eq(socialSettings.id, 1));
  return again[0]!;
}

export async function updateSocialSettings(patch: Partial<Pick<SocialSettings, "enabled" | "postHourUtc" | "autoRefill">>): Promise<SocialSettings> {
  await getSocialSettings(); // make sure the row exists
  const rows = await db
    .update(socialSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(socialSettings.id, 1))
    .returning();
  return rows[0]!;
}

// ── Generation ────────────────────────────────────────────────────────────────

type GeneratedPost = { body: string; note: string };

function parsePosts(text: string): GeneratedPost[] {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
  if (s === -1 || e < s) return [];
  try {
    const o = JSON.parse(cleaned.slice(s, e + 1)) as { posts?: { body?: unknown; note?: unknown }[] };
    return (o.posts ?? [])
      .map((p) => ({ body: String(p.body ?? "").trim(), note: String(p.note ?? "").trim() }))
      .filter((p) => p.body.length > 0);
  } catch {
    return [];
  }
}

export async function generateSocialPosts(n: number): Promise<SocialPost[]> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");
  const howMany = Math.min(10, Math.max(1, n));

  // Recent bodies (queued or already posted) so the model doesn't repeat itself.
  const recent = await db
    .select({ body: socialPosts.body })
    .from(socialPosts)
    .orderBy(desc(socialPosts.id))
    .limit(20);

  const user = [
    `You write Facebook Page posts for a software product's own brand page.`,
    ``,
    `PRODUCT: ${PRODUCT.name} (${PRODUCT.url})`,
    `WHAT IT DOES: ${PRODUCT.oneLiner}`,
    `AUDIENCE: ${PRODUCT.audience}`,
    `KEY BENEFITS:`,
    ...PRODUCT.keyBenefits.map((b) => `  - ${b}`),
    ``,
    `Write ${howMany} distinct Facebook Page posts. Rules:`,
    `- Value-first: lead with a concrete tip, mini-story, relatable pain, or question — not a sales pitch.`,
    `- Sound like a real person who builds and uses the product, not an ad agency.`,
    `- 60–130 words each. At most 1-2 emojis. 2-4 relevant hashtags at the very end.`,
    `- Vary the format across posts (tip / story / feature spotlight / question / myth-bust).`,
    `- Mention ${PRODUCT.url} naturally in at most half of the posts; the rest can omit the link entirely (the page profile carries it).`,
    recent.length
      ? `- Do NOT repeat the angle or wording of these recent posts:\n${recent.map((r) => `  • ${r.body.slice(0, 100).replace(/\n/g, " ")}`).join("\n")}`
      : ``,
    ``,
    `Return ONLY JSON: {"posts": [{"body": "<ready-to-publish post text>", "note": "<one short line: the angle and why it works>"}]}`,
  ].filter(Boolean).join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.9,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const posts = parsePosts(data.choices?.[0]?.message?.content ?? "");
  if (posts.length === 0) throw new Error("AI returned no usable posts — try again.");

  return db
    .insert(socialPosts)
    .values(posts.map((p) => ({ platform: "facebook", body: p.body, note: p.note || null })))
    .returning();
}

// ── Publishing ────────────────────────────────────────────────────────────────

export async function publishPost(postId: number): Promise<SocialPost> {
  const fb = facebookConfig();
  if (!fb) throw new Error("Facebook not connected — add FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN in the Replit Secrets panel.");

  const rows = await db.select().from(socialPosts).where(eq(socialPosts.id, postId));
  const post = rows[0];
  if (!post) throw new Error(`Post ${postId} not found`);
  if (post.status === "posted") throw new Error("Already posted");

  const params = new URLSearchParams({ message: post.body, link: PRODUCT.url, access_token: fb.token });
  const res = await fetch(`https://graph.facebook.com/v23.0/${fb.pageId}/feed`, { method: "POST", body: params });
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };

  if (!res.ok || !data.id) {
    const msg = data.error?.message || `Facebook API ${res.status}`;
    const failed = await db
      .update(socialPosts)
      .set({ status: "failed", error: msg.slice(0, 500), attemptedAt: new Date() })
      .where(eq(socialPosts.id, postId))
      .returning();
    logger.error({ postId, msg }, "Facebook publish failed");
    return failed[0]!;
  }

  const updated = await db
    .update(socialPosts)
    .set({
      status: "posted",
      error: null,
      externalId: data.id,
      externalUrl: `https://www.facebook.com/${data.id}`,
      attemptedAt: new Date(),
      postedAt: new Date(),
    })
    .where(eq(socialPosts.id, postId))
    .returning();
  logger.info({ postId, fbId: data.id }, "Published post to Facebook");
  return updated[0]!;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

const TICK_MS = 5 * 60 * 1000;      // check every 5 minutes
const RETRY_BACKOFF_MS = 2 * 60 * 60 * 1000; // after a failure, wait 2h before trying the next post
const REFILL_BELOW = 3;             // top the queue up when fewer than this are queued
const REFILL_COUNT = 5;

let tickInFlight = false;

export async function socialTick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const settings = await getSocialSettings();
    if (!settings.enabled) return;

    // Keep the queue stocked even before Facebook is connected, so there is
    // something to review/approve the moment the keys go in.
    const [{ queued }] = await db
      .select({ queued: sql<number>`count(*)::int` })
      .from(socialPosts)
      .where(eq(socialPosts.status, "queued"));
    if (settings.autoRefill && openAiKey() && queued < REFILL_BELOW) {
      try {
        const added = await generateSocialPosts(REFILL_COUNT);
        logger.info({ added: added.length }, "Social queue auto-refilled");
      } catch (err) {
        logger.error({ err }, "Social queue auto-refill failed");
      }
    }

    if (!facebookConfig()) return;

    // One post per day: skip if anything was published since today's posting
    // hour, and don't start before that hour (UTC).
    const now = new Date();
    if (now.getUTCHours() < settings.postHourUtc) return;

    const todayPostTime = new Date(now);
    todayPostTime.setUTCHours(settings.postHourUtc, 0, 0, 0);
    const postedToday = await db
      .select({ id: socialPosts.id })
      .from(socialPosts)
      .where(and(eq(socialPosts.status, "posted"), gte(socialPosts.postedAt, todayPostTime)))
      .limit(1);
    if (postedToday.length > 0) return;

    // Back off after a recent failure instead of burning the queue.
    const recentFailure = await db
      .select({ id: socialPosts.id })
      .from(socialPosts)
      .where(and(eq(socialPosts.status, "failed"), gte(socialPosts.attemptedAt, new Date(Date.now() - RETRY_BACKOFF_MS))))
      .limit(1);
    if (recentFailure.length > 0) return;

    const next = await db
      .select()
      .from(socialPosts)
      .where(eq(socialPosts.status, "queued"))
      .orderBy(asc(socialPosts.id))
      .limit(1);
    if (!next[0]) return;

    await publishPost(next[0].id);
  } catch (err) {
    logger.error({ err }, "Social scheduler tick failed");
  } finally {
    tickInFlight = false;
  }
}

export function startSocialScheduler(): void {
  // First tick shortly after boot (lets the server settle), then every 5 min.
  setTimeout(() => void socialTick(), 20_000);
  setInterval(() => void socialTick(), TICK_MS);
  logger.info("Social auto-poster scheduler started");
}
