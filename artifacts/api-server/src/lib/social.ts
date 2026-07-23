/**
 * Social auto-poster — keeps a queue of AI-written Facebook Page posts and
 * publishes one per day at the configured hour. Generation uses the OpenAI
 * key already set for the other AI features; publishing uses a Facebook Page
 * access token (FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN secrets).
 *
 * The admin Social tab drives everything through the /api/admin/social routes;
 * this module owns the actual generation, publishing, and the scheduler tick.
 */
import crypto from "node:crypto";
import { db, socialPosts, socialSettings, socialGroups, type SocialPost, type SocialSettings, type SocialGroup } from "@workspace/db";
import { eq, desc, asc, and, gte, lt, or, isNull, isNotNull, sql } from "drizzle-orm";
import { logger } from "./logger";

function openAiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";
}

// Page credentials come from the DB (set by the admin "Connect Facebook"
// OAuth flow), with env secrets as a manual fallback.
export async function facebookCreds(): Promise<{ pageId: string; token: string; pageName: string | null } | null> {
  const s = await getSocialSettings();
  if (s.fbPageId && s.fbPageToken) return { pageId: s.fbPageId, token: s.fbPageToken, pageName: s.fbPageName };
  const pageId = process.env.FACEBOOK_PAGE_ID ?? "";
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "";
  return pageId && token ? { pageId, token, pageName: null } : null;
}

async function fbApp(): Promise<{ id: string; secret: string } | null> {
  const s = await getSocialSettings();
  const id = s.fbAppId || process.env.FACEBOOK_APP_ID || "";
  const secret = s.fbAppSecret || process.env.FACEBOOK_APP_SECRET || "";
  return id && secret ? { id, secret } : null;
}

export async function fbAppConfigured(): Promise<boolean> {
  return Boolean(await fbApp());
}

// ── Facebook OAuth (the "Connect Facebook" button) ───────────────────────────

const FB_GRAPH = "https://graph.facebook.com/v23.0";
export const FB_REDIRECT_URI = "https://mapleadextractor.net/api/admin/social/fb/callback";
const FB_SCOPES = "pages_show_list,pages_manage_posts,pages_read_engagement";
const FB_STATE_MAX_AGE_MS = 15 * 60 * 1000;

function signState(secret: string): string {
  const ts = Date.now().toString();
  return `${ts}.${crypto.createHmac("sha256", secret).update(ts).digest("hex")}`;
}

function stateIsValid(state: string, secret: string): boolean {
  const [ts, sig] = state.split(".");
  if (!ts || !sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(ts).digest("hex");
  const ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  return ok && Date.now() - Number(ts) < FB_STATE_MAX_AGE_MS;
}

export async function fbConnectUrl(): Promise<string> {
  const app = await fbApp();
  if (!app) throw new Error("Facebook app credentials missing — set fb_app_id/fb_app_secret in social_settings (or FACEBOOK_APP_ID/FACEBOOK_APP_SECRET secrets).");
  const q = new URLSearchParams({
    client_id: app.id,
    redirect_uri: FB_REDIRECT_URI,
    state: signState(app.secret),
    scope: FB_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/v23.0/dialog/oauth?${q}`;
}

async function fbGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok || data.error) throw new Error(data.error?.message || `Facebook API ${res.status}`);
  return data;
}

export type FbPage = { id: string; name: string; access_token: string };

async function fbListPages(userToken: string): Promise<FbPage[]> {
  const data = await fbGet<{ data?: FbPage[] }>(
    `${FB_GRAPH}/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(userToken)}`,
  );
  return (data.data ?? []).filter((p) => p.id && p.access_token);
}

async function fbSavePage(page: FbPage): Promise<void> {
  await getSocialSettings();
  await db
    .update(socialSettings)
    .set({ fbPageId: page.id, fbPageName: page.name, fbPageToken: page.access_token, updatedAt: new Date() })
    .where(eq(socialSettings.id, 1));
  logger.info({ pageId: page.id, pageName: page.name }, "Facebook Page connected");
}

// Full callback exchange: code → user token → long-lived token → pages.
// Auto-connects when the account manages exactly one Page; otherwise the
// caller shows the list and /fb/select finishes the job.
export async function fbHandleCallback(code: string, state: string): Promise<{ connected: FbPage | null; pages: FbPage[] }> {
  const app = await fbApp();
  if (!app) throw new Error("Facebook app credentials missing.");
  if (!stateIsValid(state, app.secret)) throw new Error("Login link expired — go back to the admin Social tab and click Connect Facebook again.");

  const short = await fbGet<{ access_token?: string }>(
    `${FB_GRAPH}/oauth/access_token?client_id=${app.id}&client_secret=${app.secret}&redirect_uri=${encodeURIComponent(FB_REDIRECT_URI)}&code=${encodeURIComponent(code)}`,
  );
  if (!short.access_token) throw new Error("Facebook did not return a token.");

  const long = await fbGet<{ access_token?: string }>(
    `${FB_GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${app.id}&client_secret=${app.secret}&fb_exchange_token=${encodeURIComponent(short.access_token)}`,
  );
  const userToken = long.access_token || short.access_token;
  await db.update(socialSettings).set({ fbUserToken: userToken, updatedAt: new Date() }).where(eq(socialSettings.id, 1));

  const pages = await fbListPages(userToken);
  if (pages.length === 0) throw new Error("No Facebook Pages found on that account — make sure you're an admin of your business Page.");
  if (pages.length === 1) {
    await fbSavePage(pages[0]!);
    return { connected: pages[0]!, pages };
  }
  return { connected: null, pages };
}

export async function fbSelectPage(pageId: string): Promise<FbPage> {
  const s = await getSocialSettings();
  if (!s.fbUserToken) throw new Error("No Facebook login on file — click Connect Facebook first.");
  const pages = await fbListPages(s.fbUserToken);
  const page = pages.find((p) => p.id === pageId);
  if (!page) throw new Error("That Page wasn't in the list Facebook returned.");
  await fbSavePage(page);
  return page;
}

export async function fbDisconnect(): Promise<void> {
  await getSocialSettings();
  await db
    .update(socialSettings)
    .set({ fbUserToken: null, fbPageId: null, fbPageName: null, fbPageToken: null, updatedAt: new Date() })
    .where(eq(socialSettings.id, 1));
}

// What the posts sell: done-for-you local-business lead lists. We sell the
// LEADS — a ready-to-use, human-reviewed CSV delivered to the buyer. Posts
// are about buying leads only; never pitch the free scraper tool.
const PRODUCT = {
  name: "Map Lead Extractor",
  url: "https://mapleadextractor.net/get-leads",
  oneLiner:
    "Done-for-you local-business lead lists: tell us the business type + area (e.g. \"roofers in Mobile, AL\") and we deliver a clean, human-reviewed CSV — name, phone, email, website, and rating — usually within hours. 100 targeted leads for $29.",
  audience:
    "sales reps, marketing/lead-gen agencies, SaaS founders doing outbound, and small-business owners who sell to other local businesses",
  keyBenefits: [
    "Buy 100 targeted, ready-to-use local-business leads for $29 — CSV emailed to you, usually within hours (bulk tiers: 500 / 1,000 / 5,000 at a lower price per lead)",
    "Every lead is human-reviewed before it ships — dead/closed businesses removed, phone numbers spot-checked, emails format-validated, location confirmed",
    "Pick any business type + state (or just describe what you want) and get a hyper-targeted list — no scraping, no cleanup, no software to learn",
    "Automatic refund if a pack ever comes up short — you only pay for leads you actually get",
    "Skip hours of manual copy-pasting from Google Maps — the list arrives done and ready for cold outreach",
  ],
};

// Every ad link carries UTM tags so Facebook traffic shows up by name in the
// admin Traffic tab (site_visits.utm_source) instead of blending into Direct.
const AD_URL = `${PRODUCT.url}?utm_source=facebook&utm_medium=social`;

// The free-extension campaign: a separate ad stream that drives Chrome
// installs instead of a sale. The link is the Chrome Web Store listing — one
// click there and Facebook users hit "Add to Chrome" (as close to a direct
// download as an extension gets). Runs ~1 post for every 2 leads posts.
const FREE_TOOL = {
  name: "Map Lead Extractor (free Chrome extension)",
  // Chrome Web Store listing for the Google/Bing Maps extractor (the primary
  // free tool). UTM'd so its installs show up by name in the Traffic tab.
  storeUrl: "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg",
  oneLiner:
    "A free Chrome extension that scrapes local-business leads straight off Google & Bing Maps — name, phone, website, and rating — and exports them to CSV. No signup, no credit card; everything stays in your own browser.",
  audience:
    "sales reps, lead-gen and marketing agencies, SaaS founders doing outbound, and small-business owners who prospect other local businesses",
  keyBenefits: [
    "100% free — add it to Chrome and start pulling leads off Google/Bing Maps in seconds, no account or card needed",
    "Exports name, phone, website, and rating straight to a CSV in your Downloads folder",
    "Runs entirely in your browser — your data never touches our servers",
    "Perfect for building your own cold-outreach list by hand",
    "When you'd rather skip the manual work, the same folks sell done-for-you human-reviewed lead packs",
  ],
};
const FREE_TOOL_URL = `${FREE_TOOL.storeUrl}?utm_source=facebook&utm_medium=social`;

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

export async function updateSocialSettings(patch: Partial<Pick<SocialSettings, "enabled" | "postHourUtc" | "autoRefill" | "fbAppId" | "fbAppSecret" | "fbPageId" | "fbPageName" | "fbPageToken">>): Promise<SocialSettings> {
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

// Engagement-weighted score for the feedback loop — comments and shares are
// stronger signals than a passive like.
const engagementScore = sql<number>`coalesce(${socialPosts.likes},0) + 3*coalesce(${socialPosts.comments},0) + 5*coalesce(${socialPosts.shares},0)`;

export async function generateSocialPosts(n: number): Promise<SocialPost[]> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");
  const howMany = Math.min(10, Math.max(1, n));

  // Recent bodies (queued or already posted) so the model doesn't repeat
  // itself — scoped to the leads campaign so it doesn't dedupe against the
  // free-tool ad stream.
  const recent = await db
    .select({ body: socialPosts.body })
    .from(socialPosts)
    .where(eq(socialPosts.campaign, "leads"))
    .orderBy(desc(socialPosts.id))
    .limit(20);

  // Feedback loop: the best-performing published posts steer the next batch.
  const top = (
    await db
      .select({ body: socialPosts.body, likes: socialPosts.likes, comments: socialPosts.comments, shares: socialPosts.shares, score: engagementScore })
      .from(socialPosts)
      .where(and(eq(socialPosts.platform, "facebook"), eq(socialPosts.status, "posted"), isNotNull(socialPosts.statsSyncedAt)))
      .orderBy(desc(engagementScore))
      .limit(3)
  ).filter((p) => p.score > 0);

  const user = [
    `You write Facebook Page posts for a business that SELLS done-for-you local-business lead lists.`,
    ``,
    `WHAT WE SELL: ${PRODUCT.oneLiner}`,
    `BUY IT AT: ${AD_URL}`,
    `AUDIENCE: ${PRODUCT.audience}`,
    `KEY SELLING POINTS:`,
    ...PRODUCT.keyBenefits.map((b) => `  - ${b}`),
    ``,
    `Write ${howMany} distinct Facebook Page posts. Rules:`,
    `- Every post is about BUYING our ready-made lead lists. Never pitch a free tool, scraper, extension, or "do it yourself" — we sell the finished leads, not software.`,
    `- Value-first: lead with a concrete tip, mini-story, relatable pain, or question — then land on how a ready-to-use lead list solves it.`,
    `- Sound like a real person who runs this lead business, not an ad agency.`,
    `- 60–130 words each. At most 1-2 emojis. 2-4 relevant hashtags at the very end.`,
    `- Vary the format across posts (tip / story / customer win / offer spotlight / question / myth-bust).`,
    `- Work in a concrete hook where it fits — "100 targeted leads for $29", human-reviewed CSV, delivered in hours, refund if we come up short.`,
    `- These go out as image ads, so the link shows no preview card — put ${AD_URL} in the body of EVERY post as a clear call to action (e.g. "Grab a pack → ${AD_URL}").`,
    recent.length
      ? `- Do NOT repeat the angle or wording of these recent posts:\n${recent.map((r) => `  • ${r.body.slice(0, 100).replace(/\n/g, " ")}`).join("\n")}`
      : ``,
    top.length
      ? `\nThese published posts got the MOST engagement (likes/comments/shares) — study what works about their angle, hook, and structure, and write more in that vein (never verbatim):\n${top.map((p) => `  ★ [${p.likes ?? 0}👍 ${p.comments ?? 0}💬 ${p.shares ?? 0}↗] ${p.body.slice(0, 160).replace(/\n/g, " ")}`).join("\n")}`
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

  const rows = await db
    .insert(socialPosts)
    .values(posts.map((p) => ({ platform: "facebook", campaign: "leads", body: p.body, note: p.note || null })))
    .returning();
  generateImagesInBackground(rows.map((r) => r.id));
  return rows;
}

// Fire-and-forget: draw the ad picture as soon as a post is queued so the
// admin sees the creative immediately (publish-time generation stays as the
// safety net). Sequential to stay clear of image-API rate limits.
function generateImagesInBackground(ids: number[]): void {
  void (async () => {
    for (const id of ids) {
      try {
        await generatePostImage(id);
      } catch (err) {
        logger.warn({ postId: id, err }, "Queued-post image generation failed — will retry at publish time");
      }
    }
  })();
}

// ── Free-extension campaign (drives Chrome installs, not sales) ───────────────
// Same shape as generateSocialPosts, but every post promotes the FREE Chrome
// extension and carries its Web Store install link in the body so a Facebook
// tap goes straight to "Add to Chrome". Stored with campaign="freetool" so the
// scheduler can rotate them in ~1-in-3 alongside the paid-leads ads.

export async function generateFreeToolPosts(n: number): Promise<SocialPost[]> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");
  const howMany = Math.min(10, Math.max(1, n));

  const recent = await db
    .select({ body: socialPosts.body })
    .from(socialPosts)
    .where(eq(socialPosts.campaign, "freetool"))
    .orderBy(desc(socialPosts.id))
    .limit(20);

  const user = [
    `You write Facebook Page posts that get people to install a FREE Chrome extension.`,
    ``,
    `THE FREE TOOL: ${FREE_TOOL.oneLiner}`,
    `INSTALL IT AT (Chrome Web Store — one click, then "Add to Chrome"): ${FREE_TOOL_URL}`,
    `AUDIENCE: ${FREE_TOOL.audience}`,
    `KEY SELLING POINTS:`,
    ...FREE_TOOL.keyBenefits.map((b) => `  - ${b}`),
    ``,
    `Write ${howMany} distinct Facebook Page posts. Rules:`,
    `- The whole point is to get a FREE install. Lead with the value of doing it yourself for free; the call to action is "add the free extension to Chrome".`,
    `- It's genuinely free — no signup, no card. Say so. Never imply it costs money.`,
    `- You MAY mention that done-for-you lead packs are also available for people who'd rather not scrape by hand, but keep the post about the free tool.`,
    `- Value-first: open with a concrete tip, mini-story, relatable prospecting pain, or question — then land on the free extension as the fix.`,
    `- Sound like a real person, not an ad agency. 60–130 words each. At most 1-2 emojis. 2-4 relevant hashtags at the very end.`,
    `- Vary the format across posts (tip / story / before-after / question / myth-bust).`,
    `- These go out as image ads, so the link shows no preview card — put ${FREE_TOOL_URL} in the body of EVERY post as a clear call to action (e.g. "Add it free → ${FREE_TOOL_URL}").`,
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

  const rows = await db
    .insert(socialPosts)
    .values(posts.map((p) => ({ platform: "facebook", campaign: "freetool", body: p.body, note: p.note || null })))
    .returning();
  generateImagesInBackground(rows.map((r) => r.id));
  return rows;
}

// ── Facebook Groups (assisted posting) ───────────────────────────────────────
// Meta removed the Groups API in April 2024, so apps cannot post to groups.
// Instead: AI writes group-flavored posts (platform "facebook_group"), and the
// admin UI copies one to the clipboard + opens the group for a manual paste.

export async function generateGroupPosts(n: number): Promise<SocialPost[]> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");
  const howMany = Math.min(10, Math.max(1, n));

  const recent = await db
    .select({ body: socialPosts.body })
    .from(socialPosts)
    .where(eq(socialPosts.platform, "facebook_group"))
    .orderBy(desc(socialPosts.id))
    .limit(20);

  const user = [
    `You write posts for OTHER PEOPLE'S Facebook Groups (marketing, lead-gen, SaaS, and local-business communities). The author is a member sharing value, NOT the group owner, so anything that smells like an ad gets deleted by moderators.`,
    ``,
    `WHAT THE AUTHOR SELLS (mention sparingly): ${PRODUCT.name} — ${PRODUCT.oneLiner}`,
    `AUDIENCE IN THESE GROUPS: ${PRODUCT.audience}`,
    `THINGS YOU COULD MENTION BY NAME (never as a link — see rules below):`,
    ...PRODUCT.keyBenefits.map((b) => `  - ${b}`),
    ``,
    `Write ${howMany} distinct group posts. Rules:`,
    `- Value-first and community-toned: a concrete tactic, a lesson learned, a mini case study, or a genuine question that starts discussion.`,
    `- The offer is a done-for-you lead list you SELL — never pitch a free tool, scraper, or "do it yourself"; when the product comes up it's "I sell targeted lead lists for this."`,
    `- NO links at all — groups bury or remove link posts. No hashtags either.`,
    `- Mention the product by name in AT MOST a third of the posts, and only as a casual aside ("I actually sell ready-made lists for this if anyone wants one"); the rest should be pure value with no product mention.`,
    `- 80–150 words. At most 1 emoji. Sound like a practitioner typing in a group, not a brand.`,
    recent.length
      ? `- Do NOT repeat the angle or wording of these recent posts:\n${recent.map((r) => `  • ${r.body.slice(0, 100).replace(/\n/g, " ")}`).join("\n")}`
      : ``,
    ``,
    `Return ONLY JSON: {"posts": [{"body": "<ready-to-paste post text>", "note": "<one short line: the angle and why mods won't delete it>"}]}`,
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
    .values(posts.map((p) => ({ platform: "facebook_group", body: p.body, note: p.note || null })))
    .returning();
}

// AI web search for real, public Facebook Groups that match the product's
// audience and allow open posting (public group, no admin-approval-to-post
// gate) — same live-search approach as lib/discover.ts's lead finder, just
// pointed at Groups instead of businesses. Still adds to the same
// socialGroups rotation the admin drives by hand (joining is still manual —
// Facebook has no API for that either — but finding candidates isn't).
type DiscoveredGroup = { name: string; url: string; why: string };

function extractGroupsJson(text: string): { groups?: unknown[] } {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{"), end = cleaned.lastIndexOf("}");
  if (start === -1 || end < start) return {};
  try { return JSON.parse(cleaned.slice(start, end + 1)) as { groups?: unknown[] }; }
  catch { return {}; }
}

async function findGroupCandidates(n: number): Promise<DiscoveredGroup[]> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");
  const howMany = Math.min(15, Math.max(3, n));

  const existing = await db.select({ url: socialGroups.url }).from(socialGroups);
  const existingUrls = new Set(existing.map((g) => g.url.toLowerCase().replace(/\/$/, "")));

  const input = [
    `Use web search to find up to ${howMany} REAL, currently active PUBLIC Facebook Groups where ${PRODUCT.audience} hang out and members freely post their own content/tips/questions (not just admin announcements).`,
    `Only include groups that are: (1) public (anyone can see posts, not "private"/"hidden"), (2) actually active — recent posts, not a dead group, (3) a plausible fit for someone sharing value about lead generation, cold outreach, local-business marketing, or sales tools.`,
    `For each group return its exact facebook.com/groups/... URL (never invent one — only URLs you found via search) and its name.`,
    existingUrls.size ? `Skip these groups, already known: ${[...existingUrls].slice(0, 30).join(", ")}` : ``,
    `Return ONLY JSON: {"groups":[{"name":"","url":"https://www.facebook.com/groups/...","why":"<max 15 words on why members here fit>"}]}. No prose, no markdown.`,
  ].filter(Boolean).join("\n");

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-4o", tools: [{ type: "web_search_preview" }], input }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);

  const data = (await res.json()) as { output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
  let text = "";
  for (const item of data.output ?? []) {
    if (item.type === "message") {
      for (const c of item.content ?? []) {
        if (c.type === "output_text") text += c.text ?? "";
      }
    }
  }

  const parsed = extractGroupsJson(text);
  const list = Array.isArray(parsed.groups) ? parsed.groups : [];
  const out: DiscoveredGroup[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    const url = String(o.url ?? "").trim();
    if (!name || !/^https:\/\/(www\.|m\.|web\.)?facebook\.com\/groups\/[^\s]+$/i.test(url)) continue;
    out.push({ name, url, why: String(o.why ?? "").trim().slice(0, 200) });
  }
  return out.slice(0, howMany);
}

export async function discoverGroups(n: number): Promise<{ added: SocialGroup[]; duplicates: number; candidates: DiscoveredGroup[] }> {
  const found = await findGroupCandidates(n);
  if (found.length === 0) return { added: [], duplicates: 0, candidates: [] };

  const existing = await db.select({ url: socialGroups.url }).from(socialGroups);
  const existingUrls = new Set(existing.map((g) => g.url.toLowerCase().replace(/\/$/, "")));

  const fresh = found.filter((g) => !existingUrls.has(g.url.toLowerCase().replace(/\/$/, "")));
  const duplicates = found.length - fresh.length;
  if (fresh.length === 0) return { added: [], duplicates, candidates: found };

  const added = await db
    .insert(socialGroups)
    .values(fresh.map((g) => ({ name: g.name, url: g.url, notes: g.why || null })))
    .returning();
  logger.info({ added: added.length, duplicates }, "AI-discovered Facebook groups added to rotation");
  return { added, duplicates, candidates: found };
}

export async function listGroups(): Promise<SocialGroup[]> {
  return db.select().from(socialGroups).orderBy(asc(socialGroups.lastPostedAt), asc(socialGroups.id));
}

export async function addGroup(name: string, url: string, notes?: string): Promise<SocialGroup> {
  const cleanUrl = url.trim();
  if (!/^https:\/\/(www\.|m\.|web\.)?facebook\.com\/groups\/[^\s]+$/i.test(cleanUrl)) {
    throw new Error("That doesn't look like a Facebook group link — it should start with https://www.facebook.com/groups/…");
  }
  const rows = await db.insert(socialGroups).values({ name: name.trim(), url: cleanUrl, notes: notes?.trim() || null }).returning();
  return rows[0]!;
}

export async function deleteGroup(id: number): Promise<void> {
  await db.delete(socialGroups).where(eq(socialGroups.id, id));
}

// Called after the admin copies a post and pastes it into the group by hand:
// flips the queued post to "posted" (pointing at the group) and stamps the group.
export async function markGroupPosted(groupId: number, postId: number): Promise<void> {
  const groupRows = await db.select().from(socialGroups).where(eq(socialGroups.id, groupId));
  const group = groupRows[0];
  if (!group) throw new Error(`Group ${groupId} not found`);
  const postRows = await db.select().from(socialPosts).where(eq(socialPosts.id, postId));
  const post = postRows[0];
  if (!post) throw new Error(`Post ${postId} not found`);
  if (post.platform !== "facebook_group") throw new Error("That post is a Page post, not a group post.");

  await db
    .update(socialPosts)
    .set({ status: "posted", error: null, externalUrl: group.url, attemptedAt: new Date(), postedAt: new Date() })
    .where(eq(socialPosts.id, postId));
  await db
    .update(socialGroups)
    .set({ postCount: sql`${socialGroups.postCount} + 1`, lastPostedAt: new Date() })
    .where(eq(socialGroups.id, groupId));
  logger.info({ groupId, postId, group: group.name }, "Group post marked as posted");
}

// ── Engagement analytics ─────────────────────────────────────────────────────
// Pulls reactions/comments/shares (covered by pages_read_engagement) for
// published Page posts and stores them on the row. Impressions need the
// read_insights scope, so that call is best-effort and failures are ignored.

const STATS_STALE_MS = 6 * 60 * 60 * 1000;   // re-sync a post at most every 6h
const STATS_WINDOW_MS = 60 * 24 * 60 * 60 * 1000; // stop syncing posts older than 60 days

export async function syncEngagementStats(limit: number): Promise<number> {
  const fb = await facebookCreds();
  if (!fb) return 0;

  const stale = await db
    .select({ id: socialPosts.id, externalId: socialPosts.externalId })
    .from(socialPosts)
    .where(and(
      eq(socialPosts.platform, "facebook"),
      eq(socialPosts.status, "posted"),
      isNotNull(socialPosts.externalId),
      gte(socialPosts.postedAt, new Date(Date.now() - STATS_WINDOW_MS)),
      or(isNull(socialPosts.statsSyncedAt), lt(socialPosts.statsSyncedAt, new Date(Date.now() - STATS_STALE_MS))),
    ))
    .orderBy(desc(socialPosts.postedAt))
    .limit(Math.max(1, limit));

  let synced = 0;
  for (const row of stale) {
    try {
      const data = await fbGet<{
        reactions?: { summary?: { total_count?: number } };
        comments?: { summary?: { total_count?: number } };
        shares?: { count?: number };
      }>(`${FB_GRAPH}/${row.externalId}?fields=reactions.summary(true).limit(0),comments.summary(true).limit(0),shares&access_token=${encodeURIComponent(fb.token)}`);

      let impressions: number | null = null;
      try {
        const ins = await fbGet<{ data?: { values?: { value?: number }[] }[] }>(
          `${FB_GRAPH}/${row.externalId}/insights?metric=post_impressions_unique&access_token=${encodeURIComponent(fb.token)}`,
        );
        impressions = ins.data?.[0]?.values?.[0]?.value ?? null;
      } catch { /* read_insights not granted — reach stays unknown */ }

      await db
        .update(socialPosts)
        .set({
          likes: data.reactions?.summary?.total_count ?? 0,
          comments: data.comments?.summary?.total_count ?? 0,
          shares: data.shares?.count ?? 0,
          ...(impressions !== null ? { impressions } : {}),
          statsSyncedAt: new Date(),
        })
        .where(eq(socialPosts.id, row.id));
      synced++;
    } catch (err) {
      logger.warn({ postId: row.id, err }, "Engagement sync failed for post");
      // Stamp it anyway so one deleted/broken post can't wedge the whole sync.
      await db.update(socialPosts).set({ statsSyncedAt: new Date() }).where(eq(socialPosts.id, row.id));
    }
  }
  if (synced) logger.info({ synced }, "Engagement stats synced");
  return synced;
}

// ── AI post images ────────────────────────────────────────────────────────────
// Image posts get ~2-3x the reach of plain text on Facebook. The image is
// generated from the post's own topic and stored as base64 on the row;
// publishing then goes through /photos instead of /feed.
//
// These are conversion ads, not decoration: the picture itself has to say
// "buy ready-made business leads" and carry the price hook, because most of the
// feed sees the image long before it reads the caption. gpt-image-1 renders
// short headline text cleanly now, so the creative leads with a punchy headline
// + the offer instead of the old text-free abstract illustration.

export async function generatePostImage(postId: number): Promise<void> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");
  const rows = await db.select({ id: socialPosts.id, body: socialPosts.body, status: socialPosts.status, campaign: socialPosts.campaign }).from(socialPosts).where(eq(socialPosts.id, postId));
  const post = rows[0];
  if (!post) throw new Error(`Post ${postId} not found`);
  if (post.status === "posted") throw new Error("Already posted — images can only be added before publishing.");

  // Two campaigns, but instead of ONE fixed recipe each we rotate through a set
  // of distinct art-directed concepts so the feed never shows the same creative
  // twice. The concept is chosen deterministically from the post id (stable on
  // regenerate, varied across the queue). Every concept still has to READ as
  // "ready-made / DIY business-lead list" at a glance and carry the one hook.
  const isFreeTool = post.campaign === "freetool";

  // Each concept = a complete scene + composition direction. Keep the on-image
  // TEXT to the single headline line below; concepts describe the picture only.
  const leadsConcepts = [
    `HERO PRODUCT SHOT: a single glossy floating UI card — a clean CRM/spreadsheet of local-business leads (columns of business names, phone numbers, emails, gold star ratings) — hovering in 3/4 perspective above a dark stylized city map studded with softly glowing green location pins. A crisp green checkmark "delivered" seal in one corner. Dramatic studio product lighting, shallow depth of field, subtle reflections.`,
    `BEFORE / AFTER SPLIT: left half a chaotic tangle of scattered map pins and messy sticky notes in cool desaturated tones; right half the same data resolved into one immaculate, brightly lit contact list. A bold vertical divider with a forward arrow. Instantly communicates "we do the messy part for you."`,
    `PHONE-IN-HAND: a modern smartphone held at a natural angle, screen showing a "Your leads are ready" notification over a tidy list of businesses with phone numbers, a green download button glowing. Soft bokeh office background, warm rim light, premium lifestyle-product feel. No visible human face.`,
    `TOP-DOWN FLATLAY: an overhead desk scene — a laptop displaying a clean CSV of local-business leads, a coffee cup, a phone showing map pins, a small stack of "delivered" cards — arranged with generous negative space and even soft lighting, like a polished SaaS brand photo. No people.`,
    `BOLD TYPOGRAPHIC POSTER: a striking minimalist poster where oversized numerals dominate, with map-pin and spreadsheet-row motifs woven behind the type as texture. Big, confident, high-contrast, gallery-grade graphic design.`,
  ];
  const freeToolConcepts = [
    `HERO PRODUCT SHOT: a floating browser window in 3/4 perspective showing a Google/Bing Maps view full of glowing green pins, with a Chrome extension puzzle-piece icon visibly pulling those businesses into a tidy contact list beside it (names, phones, websites). Dramatic studio lighting, glossy reflections, shallow depth of field.`,
    `FUNNEL COMPOSITION: a map full of scattered location pins at the top visually funneling down through the extension icon into one clean, organized spreadsheet of leads at the bottom. Clear top-to-bottom flow, bright and energetic, "one click and it's sorted."`,
    `PHONE / LAPTOP MOCKUP: a laptop screen showing the extension mid-scrape — a maps search on one side, a filling contact table on the other, an "Add to Chrome" pill glowing. Clean modern desk, soft rim light, premium tech-product look. No human face.`,
    `BOLD TYPOGRAPHIC POSTER: a striking minimalist poster led by big confident type, with a puzzle-piece extension icon and map-pin motifs as supporting graphic texture. High-contrast, thumb-stopping, gallery-grade design.`,
  ];
  const concepts = isFreeTool ? freeToolConcepts : leadsConcepts;
  const scene = concepts[postId % concepts.length];

  const headline = isFreeTool
    ? `On-image text (the ONLY text allowed): a bold "FREE LEAD SCRAPER" main line and a smaller "Add to Chrome" pill/button. Perfectly spelled. Nothing else.`
    : `On-image text (the ONLY text allowed): a bold "100 LOCAL LEADS" main line, a large "$29" price badge, and a small "DONE-FOR-YOU · DELIVERED IN HOURS" strip. Perfectly spelled. Nothing else.`;

  const prompt = [
    `Design a scroll-stopping, professional B2B Facebook feed ad — the caliber of a top SaaS brand's paid creative, shot like a real advertising photograph/render, not a flat clip-art illustration.`,
    `Concept: ${scene}`,
    `Match the angle of this caption (for tone only — do NOT transcribe it): ${post.body.slice(0, 200).replace(/\n/g, " ")}`,
    headline,
    `Art direction: premium, high-contrast, cinematic. Deep navy background (#0B1220), vivid green (#00E676) as the single accent/CTA color, soft electric-blue highlights and glow, generous negative space, crisp clean sans-serif type, believable lighting and shadows. Composition must stay legible and punchy even as a small thumbnail in a busy mobile feed.`,
    `Hard rules: minimal text — only the exact headline described above, perfectly spelled and sharply legible. No paragraphs, no gibberish or lorem-ipsum text, no fake company logos or brand marks, no watermarks, no stock-photo human faces, no cluttered UI. Photorealistic-to-3D-render quality, never amateur or cartoonish.`,
  ].join(" ");

  // gpt-image-1 first (current API, returns b64 by default); dall-e-3 as a
  // fallback for accounts that haven't been granted the newer model.
  const tryModel = async (body: Record<string, unknown>): Promise<{ b64_json?: string; url?: string }> => {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`OpenAI images ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
    const data = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    if (!data.data?.[0]) throw new Error("OpenAI returned no image — try again.");
    return data.data[0];
  };

  let img: { b64_json?: string; url?: string };
  try {
    img = await tryModel({ model: "gpt-image-1", prompt, n: 1, size: "1024x1024", quality: "high" });
  } catch {
    img = await tryModel({ model: "dall-e-3", prompt, n: 1, size: "1024x1024" });
  }
  let b64 = img.b64_json;
  if (!b64 && img.url) {
    const dl = await fetch(img.url);
    if (!dl.ok) throw new Error(`Couldn't download the generated image (${dl.status})`);
    b64 = Buffer.from(await dl.arrayBuffer()).toString("base64");
  }
  if (!b64) throw new Error("OpenAI returned no image — try again.");

  await db.update(socialPosts).set({ imageB64: b64 }).where(eq(socialPosts.id, postId));
  logger.info({ postId }, "Post image generated");
}

export async function getPostImage(postId: number): Promise<Buffer | null> {
  const rows = await db.select({ imageB64: socialPosts.imageB64 }).from(socialPosts).where(eq(socialPosts.id, postId));
  return rows[0]?.imageB64 ? Buffer.from(rows[0].imageB64, "base64") : null;
}

export async function removePostImage(postId: number): Promise<void> {
  await db.update(socialPosts).set({ imageB64: null }).where(eq(socialPosts.id, postId));
}

// ── Publishing ────────────────────────────────────────────────────────────────

export async function publishPost(postId: number): Promise<SocialPost> {
  const fb = await facebookCreds();
  if (!fb) throw new Error("Facebook not connected — use the Connect Facebook button in the admin Social tab.");

  const rows = await db.select().from(socialPosts).where(eq(socialPosts.id, postId));
  const post = rows[0];
  if (!post) throw new Error(`Post ${postId} not found`);
  if (post.status === "posted") throw new Error("Already posted");
  if (post.platform !== "facebook") throw new Error("That's a group post — use Copy & Open in the Groups panel (Facebook doesn't let apps post to groups).");

  // With an image: photo post via /photos (multipart). Without: link post via /feed.
  let res: Response;
  if (post.imageB64) {
    const form = new FormData();
    form.append("message", post.body);
    form.append("access_token", fb.token);
    form.append("source", new Blob([Buffer.from(post.imageB64, "base64")], { type: "image/png" }), "post.png");
    res = await fetch(`https://graph.facebook.com/v23.0/${fb.pageId}/photos`, { method: "POST", body: form });
  } else {
    // Link-post fallback (no image): free-tool ads point at the Chrome Web
    // Store listing, leads ads at the sales page.
    const link = post.campaign === "freetool" ? FREE_TOOL.storeUrl : PRODUCT.url;
    const params = new URLSearchParams({ message: post.body, link, access_token: fb.token });
    res = await fetch(`https://graph.facebook.com/v23.0/${fb.pageId}/feed`, { method: "POST", body: params });
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string; post_id?: string; error?: { message?: string } };

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

  // /photos returns the photo id in `id` and the wall post in `post_id`;
  // engagement lives on the wall post, so prefer that.
  const fbPostId = data.post_id || data.id;
  const updated = await db
    .update(socialPosts)
    .set({
      status: "posted",
      error: null,
      externalId: fbPostId,
      externalUrl: `https://www.facebook.com/${fbPostId}`,
      attemptedAt: new Date(),
      postedAt: new Date(),
    })
    .where(eq(socialPosts.id, postId))
    .returning();
  logger.info({ postId, fbId: fbPostId }, "Published post to Facebook");
  return updated[0]!;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

const TICK_MS = 5 * 60 * 1000;      // check every 5 minutes
const RETRY_BACKOFF_MS = 2 * 60 * 60 * 1000; // after a failure, wait 2h before trying the next post
const REFILL_BELOW = 3;             // top the leads queue up when fewer than this are queued
const REFILL_COUNT = 5;
const FREETOOL_REFILL_BELOW = 2;   // free-tool posts go out ~1-in-3, so keep a shallower buffer
const FREETOOL_REFILL_COUNT = 3;

let tickInFlight = false;

export async function socialTick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const settings = await getSocialSettings();
    if (!settings.enabled) return;

    // Keep both ad queues stocked even before Facebook is connected, so there
    // is something to review/approve the moment the keys go in. The free-tool
    // queue is topped up shallower since it only goes out ~1-in-3.
    if (settings.autoRefill && openAiKey()) {
      const queuedCount = async (campaign: string) => {
        const [{ n }] = await db
          .select({ n: sql<number>`count(*)::int` })
          .from(socialPosts)
          .where(and(eq(socialPosts.status, "queued"), eq(socialPosts.platform, "facebook"), eq(socialPosts.campaign, campaign)));
        return n;
      };
      if ((await queuedCount("leads")) < REFILL_BELOW) {
        try {
          const added = await generateSocialPosts(REFILL_COUNT);
          logger.info({ added: added.length }, "Leads queue auto-refilled");
        } catch (err) {
          logger.error({ err }, "Leads queue auto-refill failed");
        }
      }
      if ((await queuedCount("freetool")) < FREETOOL_REFILL_BELOW) {
        try {
          const added = await generateFreeToolPosts(FREETOOL_REFILL_COUNT);
          logger.info({ added: added.length }, "Free-tool queue auto-refilled");
        } catch (err) {
          logger.error({ err }, "Free-tool queue auto-refill failed");
        }
      }
    }

    if (!(await facebookCreds())) return;

    // Keep engagement numbers fresh in the background (a few posts per tick;
    // the 6h staleness window makes this cheap and self-limiting).
    await syncEngagementStats(3).catch(() => {});

    // One post per day: skip if anything was published since today's posting
    // hour, and don't start before that hour (UTC).
    const now = new Date();
    if (now.getUTCHours() < settings.postHourUtc) return;

    const todayPostTime = new Date(now);
    todayPostTime.setUTCHours(settings.postHourUtc, 0, 0, 0);
    const postedToday = await db
      .select({ id: socialPosts.id })
      .from(socialPosts)
      .where(and(eq(socialPosts.status, "posted"), eq(socialPosts.platform, "facebook"), gte(socialPosts.postedAt, todayPostTime)))
      .limit(1);
    if (postedToday.length > 0) return;

    // Back off after a recent failure instead of burning the queue.
    const recentFailure = await db
      .select({ id: socialPosts.id })
      .from(socialPosts)
      .where(and(eq(socialPosts.status, "failed"), eq(socialPosts.platform, "facebook"), gte(socialPosts.attemptedAt, new Date(Date.now() - RETRY_BACKOFF_MS))))
      .limit(1);
    if (recentFailure.length > 0) return;

    // Campaign rotation: ~1 free-extension ad for every 2 paid-leads ads.
    // Keyed off how many Page posts have gone out so far, so every 3rd post
    // (indexes 2, 5, 8, …) prefers the free-tool queue. Falls back to the
    // other campaign when the preferred queue happens to be empty.
    const [{ postedCount }] = await db
      .select({ postedCount: sql<number>`count(*)::int` })
      .from(socialPosts)
      .where(and(eq(socialPosts.status, "posted"), eq(socialPosts.platform, "facebook")));
    const wantFreetool = postedCount % 3 === 2;
    const pickQueued = (campaign: string) =>
      db
        .select()
        .from(socialPosts)
        .where(and(eq(socialPosts.status, "queued"), eq(socialPosts.platform, "facebook"), eq(socialPosts.campaign, campaign)))
        .orderBy(asc(socialPosts.id))
        .limit(1);

    let next = await pickQueued(wantFreetool ? "freetool" : "leads");
    if (!next[0]) next = await pickQueued(wantFreetool ? "leads" : "freetool");
    if (!next[0]) return;

    // Every ad goes out with a picture (photo posts get ~2-3x the reach).
    // Generate one first if this post doesn't already have an image; a failure
    // here just falls back to a text/link post rather than blocking the day's ad.
    if (!next[0].imageB64) {
      try {
        await generatePostImage(next[0].id);
      } catch (err) {
        logger.warn({ postId: next[0].id, err }, "Ad image generation failed — publishing without a picture");
      }
    }

    await publishPost(next[0].id);
  } catch (err) {
    logger.error({ err }, "Social scheduler tick failed");
  } finally {
    tickInFlight = false;
  }
}

// ── AI posting assistant (chat box in the Social tab) ─────────────────────────
// The admin talks to it in plain English ("write a post about the $29 pack",
// "make #12 shorter", "delete anything that sounds fake") and the model edits
// the real Facebook queue through tool calls — the same agentic pattern the
// pro social-media suites ship as their "AI assistant".

export type SocialChatMessage = { role: "user" | "assistant"; content: string };

const CHAT_TOOLS = [
  { type: "function", function: { name: "list_queue", description: "List the queued Facebook posts (id, text, note, hasImage) in publish order (oldest first). Always call this before editing or deleting.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "create_post", description: "Add a new ready-to-publish post to the Facebook queue.", parameters: { type: "object", properties: { body: { type: "string", description: "Ready-to-publish post text" }, note: { type: "string", description: "One short line: the angle and why it works" } }, required: ["body"] } } },
  { type: "function", function: { name: "update_post", description: "Replace the text (and optionally the note) of a queued post.", parameters: { type: "object", properties: { id: { type: "number" }, body: { type: "string" }, note: { type: "string" } }, required: ["id", "body"] } } },
  { type: "function", function: { name: "delete_post", description: "Remove a post from the queue.", parameters: { type: "object", properties: { id: { type: "number" } }, required: ["id"] } } },
] as const;

async function runChatTool(name: string, args: Record<string, unknown>): Promise<{ result: unknown; mutated: boolean }> {
  // The assistant only ever touches queued Facebook posts — never history.
  const queuedFb = and(eq(socialPosts.status, "queued"), eq(socialPosts.platform, "facebook"));
  switch (name) {
    case "list_queue": {
      const rows = await db
        .select({ id: socialPosts.id, body: socialPosts.body, note: socialPosts.note, hasImage: sql<boolean>`${socialPosts.imageB64} IS NOT NULL` })
        .from(socialPosts).where(queuedFb).orderBy(asc(socialPosts.id));
      return { result: rows, mutated: false };
    }
    case "create_post": {
      const body = typeof args.body === "string" ? args.body.trim() : "";
      if (!body) return { result: { error: "body is required" }, mutated: false };
      const note = typeof args.note === "string" && args.note.trim() ? args.note.trim() : null;
      const rows = await db.insert(socialPosts).values({ platform: "facebook", body, note }).returning({ id: socialPosts.id });
      generateImagesInBackground([rows[0]!.id]);
      return { result: { ok: true, id: rows[0]!.id }, mutated: true };
    }
    case "update_post": {
      const id = Number(args.id);
      const body = typeof args.body === "string" ? args.body.trim() : "";
      if (!Number.isFinite(id) || !body) return { result: { error: "id and body are required" }, mutated: false };
      const patch: Partial<typeof socialPosts.$inferInsert> = { body };
      if (typeof args.note === "string" && args.note.trim()) patch.note = args.note.trim();
      const rows = await db.update(socialPosts).set(patch).where(and(eq(socialPosts.id, id), queuedFb)).returning({ id: socialPosts.id });
      return rows[0] ? { result: { ok: true }, mutated: true } : { result: { error: `No queued Facebook post with id ${id}` }, mutated: false };
    }
    case "delete_post": {
      const id = Number(args.id);
      if (!Number.isFinite(id)) return { result: { error: "id is required" }, mutated: false };
      const rows = await db.delete(socialPosts).where(and(eq(socialPosts.id, id), queuedFb)).returning({ id: socialPosts.id });
      return rows[0] ? { result: { ok: true }, mutated: true } : { result: { error: `No queued Facebook post with id ${id}` }, mutated: false };
    }
  }
  return { result: { error: `Unknown tool ${name}` }, mutated: false };
}

export async function socialChat(history: SocialChatMessage[]): Promise<{ reply: string; changed: boolean }> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");

  const system = [
    `You are the Facebook posting assistant for ${PRODUCT.name}. You manage the Page's ad queue through your tools; the admin gives you plain-English instructions.`,
    ``,
    `WHAT WE SELL: ${PRODUCT.oneLiner}`,
    `LINK FOR EVERY POST: ${AD_URL}`,
    `AUDIENCE: ${PRODUCT.audience}`,
    `KEY SELLING POINTS:`,
    ...PRODUCT.keyBenefits.map((b) => `  - ${b}`),
    ``,
    `HOW POSTING WORKS: one queued post auto-publishes per day, oldest first; a branded ad image is generated and attached automatically at publish time; the queue refills itself with AI posts when it drops below 3.`,
    ``,
    `RULES for every post you write or edit:`,
    `- Sell the done-for-you lead lists. Never pitch a free tool, scraper, extension, or "do it yourself".`,
    `- 60–130 words, at most 1-2 emojis, 2-4 hashtags at the very end, and ${AD_URL} in the body as the call to action.`,
    `- Never invent customer stories, testimonials, statistics, or results we don't have. Real claims only: pricing, human review, delivery speed, the refund guarantee.`,
    `- Sound like a real person who runs this lead business, not an ad agency.`,
    ``,
    `Always call list_queue before updating or deleting so you act on real ids. After making changes, reply with a short plain-text summary of what you did (1-3 sentences, no markdown). If asked something outside the posting queue, answer briefly and say what you can help with.`,
  ].join("\n");

  const messages: unknown[] = [{ role: "system", content: system }, ...history.slice(-16)];
  let changed = false;

  for (let round = 0; round < 6; round++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-4o", temperature: 0.7, max_tokens: 1500, messages, tools: CHAT_TOOLS }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] };
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("OpenAI returned no reply — try again.");

    if (!msg.tool_calls?.length) return { reply: (msg.content ?? "").trim() || "Done.", changed };

    messages.push(msg);
    for (const call of msg.tool_calls) {
      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>; } catch { /* leave empty — the tool reports what's missing */ }
      const { result, mutated } = await runChatTool(call.function.name, parsed);
      if (mutated) changed = true;
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return { reply: "Made the changes — check the queue above for the result.", changed };
}

export function startSocialScheduler(): void {
  // First tick shortly after boot (lets the server settle), then every 5 min.
  setTimeout(() => void socialTick(), 20_000);
  setInterval(() => void socialTick(), TICK_MS);
  logger.info("Social auto-poster scheduler started");
}
