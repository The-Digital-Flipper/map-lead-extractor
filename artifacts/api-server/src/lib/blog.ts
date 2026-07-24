/**
 * Daily blog auto-writer — generates one genuinely useful lead-generation
 * article per day and publishes it to the site. AI generation uses the OpenAI
 * key already set for the other features; posts land in the `blog_posts` table
 * and are served as crawlable HTML by blogSite.ts (matching the SEO of the
 * hand-written static posts).
 *
 * Quality guard: the prompt is steered toward in-depth, practical guides on a
 * rotating set of topics and is told the recent titles so it never repeats —
 * one solid post/day, not thin filler that Google would penalise.
 */
import { db, pool, blogPosts, blogSettings, type BlogPost, type BlogSettings, type BlogSection } from "@workspace/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { logger } from "./logger";
import { ensureHeroFor, backfillBlogHeroes } from "./blogImages";

function openAiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";
}

// The tables are created here (idempotent) rather than via drizzle-kit push,
// which trips on pre-existing drift in this project (see replit.md gotcha).
let schemaReady = false;
async function ensureBlogSchema(): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id serial PRIMARY KEY,
      slug text NOT NULL UNIQUE,
      title text NOT NULL,
      description text NOT NULL,
      category text NOT NULL DEFAULT 'Strategy',
      author_name text NOT NULL DEFAULT 'MapLeadExtractor Team',
      read_time text NOT NULL DEFAULT '5 min read',
      content jsonb NOT NULL,
      status text NOT NULL DEFAULT 'published',
      date_published timestamptz NOT NULL DEFAULT now(),
      date_modified timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS blog_posts_status_idx ON blog_posts (status);
    CREATE INDEX IF NOT EXISTS blog_posts_date_published_idx ON blog_posts (date_published);
    CREATE TABLE IF NOT EXISTS blog_settings (
      id integer PRIMARY KEY DEFAULT 1,
      enabled boolean NOT NULL DEFAULT true,
      post_hour_utc integer NOT NULL DEFAULT 13,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO blog_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  `);
  schemaReady = true;
}

export async function getBlogSettings(): Promise<BlogSettings> {
  await ensureBlogSchema();
  const rows = await db.select().from(blogSettings).where(eq(blogSettings.id, 1));
  if (rows[0]) return rows[0];
  const inserted = await db.insert(blogSettings).values({ id: 1 }).onConflictDoNothing().returning();
  return inserted[0] ?? (await db.select().from(blogSettings).where(eq(blogSettings.id, 1)))[0]!;
}

export async function updateBlogSettings(patch: Partial<Pick<BlogSettings, "enabled" | "postHourUtc">>): Promise<BlogSettings> {
  await getBlogSettings();
  const rows = await db.update(blogSettings).set({ ...patch, updatedAt: new Date() }).where(eq(blogSettings.id, 1)).returning();
  return rows[0]!;
}

// ── Reads (used by the API + the server-side renderer) ────────────────────────

export async function listPublishedPosts(): Promise<BlogPost[]> {
  await ensureBlogSchema();
  return db.select().from(blogPosts).where(eq(blogPosts.status, "published")).orderBy(desc(blogPosts.datePublished));
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  await ensureBlogSchema();
  const rows = await db.select().from(blogPosts).where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published"))).limit(1);
  return rows[0] ?? null;
}

// ── Generation ────────────────────────────────────────────────────────────────

const CATEGORIES = ["Tutorial", "Strategy", "Outreach", "Comparison", "Use Cases"] as const;

// Rotating topic seeds so consecutive posts cover different ground. The model
// still writes the real angle/title — these just steer the subject.
const TOPIC_SEEDS = [
  "how to find and buy targeted local-business leads without scraping them yourself",
  "cold email templates that book meetings with local businesses",
  "how many leads a small agency actually needs to close one client",
  "the fastest way to build a local-business prospect list by city and niche",
  "how to qualify local-business leads before you reach out",
  "buying leads vs. building your own list — real cost and time comparison",
  "a week-by-week outbound plan for a new lead-gen agency",
  "which local-business niches are easiest to sell marketing services to",
  "follow-up sequences that turn cold local-business leads into calls",
  "how to price and package lead lists for local service businesses",
  "avoiding wasted spend on stale or duplicate business leads",
  "using phone + email together to reach local business owners",
];

const GET_LEADS_URL = "https://mapleadextractor.net/get-leads";

const ALLOWED_SECTION = new Set(["h2", "h3", "p", "ul", "ol", "tip"]);

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
  const root = base || "lead-generation-guide";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const existing = await db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, candidate)).limit(1);
    if (existing.length === 0) return candidate;
  }
  // Fall back to a time-suffixed slug so we never loop forever.
  return `${root}-${Date.now()}`;
}

// Coerce the model's JSON into a clean, safe BlogSection[]. Drops anything that
// doesn't fit the shape rather than trusting the model blindly.
function sanitizeContent(raw: unknown): BlogSection[] {
  if (!Array.isArray(raw)) return [];
  const out: BlogSection[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const type = String(o.type ?? "");
    if (!ALLOWED_SECTION.has(type)) continue;
    if (type === "ul" || type === "ol") {
      const items = Array.isArray(o.items) ? o.items.map((x) => String(x).trim()).filter(Boolean) : [];
      if (items.length) out.push({ type: type as BlogSection["type"], items });
    } else if (Array.isArray(o.parts)) {
      const parts = o.parts
        .map((p) => {
          if (!p || typeof p !== "object") return null;
          const pp = p as Record<string, unknown>;
          if (pp.type === "link" && pp.href && pp.value) return { type: "link" as const, href: String(pp.href), value: String(pp.value) };
          const value = String(pp.value ?? pp.text ?? "").trim();
          return value ? { type: "text" as const, value } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (parts.length) out.push({ type: type as BlogSection["type"], parts });
    } else {
      const text = String(o.text ?? "").trim();
      if (text) out.push({ type: type as BlogSection["type"], text });
    }
  }
  return out;
}

function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
  if (s === -1 || e < s) return {};
  try { return JSON.parse(cleaned.slice(s, e + 1)) as Record<string, unknown>; }
  catch { return {}; }
}

export async function generateBlogPost(): Promise<BlogPost> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");
  await ensureBlogSchema();

  // Recent titles so the model never repeats an angle. Count seeds topic pick.
  const recent = await db.select({ title: blogPosts.title }).from(blogPosts).orderBy(desc(blogPosts.id)).limit(25);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(blogPosts);
  const seed = TOPIC_SEEDS[(total ?? 0) % TOPIC_SEEDS.length];

  const prompt = [
    `You write in-depth, genuinely useful blog articles for Map Lead Extractor, a service that SELLS done-for-you local-business lead lists (a clean, human-reviewed CSV of name/phone/email/website/rating — 100 targeted leads for $29, bulk tiers available) at ${GET_LEADS_URL}.`,
    ``,
    `Write ONE complete article. Topic to cover this time: "${seed}". Choose a specific, compelling angle and a concrete, non-clickbait title.`,
    ``,
    `AUDIENCE: sales reps, lead-gen/marketing agencies, freelancers, and people who sell services to local businesses.`,
    ``,
    `RULES:`,
    `- Be genuinely helpful and specific — real tactics, numbers, examples, step-by-steps. NO fluff or filler. This must read like an expert wrote it, not a content mill.`,
    `- 700–1100 words. Use clear structure: several H2 sections, occasional H3, short paragraphs, at least one list, and one "tip".`,
    `- Naturally and honestly position buying a ready-made lead list as the shortcut where it genuinely fits — do NOT pitch a free scraper or "do it yourself" tool. Include exactly ONE link to ${GET_LEADS_URL} as a paragraph "link" part, placed where it's actually relevant (usually near the end). Don't overlink.`,
    `- Do NOT repeat any of these recent article titles or their angle:`,
    ...recent.map((r) => `  • ${r.title}`),
    ``,
    `Return ONLY JSON in exactly this shape:`,
    `{`,
    `  "title": "string",`,
    `  "description": "1-2 sentence meta description (max 160 chars)",`,
    `  "category": one of ${JSON.stringify(CATEGORIES)},`,
    `  "readTime": "e.g. 7 min read",`,
    `  "content": [`,
    `    {"type":"p","text":"..."},`,
    `    {"type":"h2","text":"..."},`,
    `    {"type":"p","parts":[{"type":"text","value":"... "},{"type":"link","href":"${GET_LEADS_URL}","value":"buy a targeted lead list"},{"type":"text","value":" ..."}]},`,
    `    {"type":"ul","items":["...","..."]},`,
    `    {"type":"tip","text":"..."}`,
    `  ]`,
    `}`,
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.85,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const parsed = extractJson(data.choices?.[0]?.message?.content ?? "");

  const title = String(parsed.title ?? "").trim();
  const content = sanitizeContent(parsed.content);
  if (!title || content.length < 3) throw new Error("AI returned an unusable article — try again.");

  const category = CATEGORIES.includes(parsed.category as (typeof CATEGORIES)[number]) ? String(parsed.category) : "Strategy";
  const description = String(parsed.description ?? "").trim().slice(0, 200) || `${title} — a practical guide from Map Lead Extractor.`;
  const readTime = String(parsed.readTime ?? "").trim() || "6 min read";
  const slug = await uniqueSlug(slugify(title));

  const rows = await db.insert(blogPosts).values({ slug, title, description, category, readTime, content, status: "published" }).returning();
  logger.info({ slug, title }, "Auto-generated blog post published");

  // Give the post its hero photo. Non-fatal: the article is already live, and
  // the startup backfill will retry any miss.
  try { await ensureHeroFor(slug, title, category); }
  catch (err) { logger.warn({ err, slug }, "Blog hero generation failed — backfill will retry"); }

  return rows[0]!;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

const TICK_MS = 10 * 60 * 1000; // check every 10 minutes

let tickInFlight = false;

export async function blogTick(): Promise<void> {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    if (!openAiKey()) return;
    const settings = await getBlogSettings();
    if (!settings.enabled) return;

    const now = new Date();
    if (now.getUTCHours() < settings.postHourUtc) return;

    // One post per day: skip if anything was published since today's hour (UTC).
    const todayPostTime = new Date(now);
    todayPostTime.setUTCHours(settings.postHourUtc, 0, 0, 0);
    const already = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(gte(blogPosts.datePublished, todayPostTime))
      .limit(1);
    if (already.length > 0) return;

    await generateBlogPost();
  } catch (err) {
    logger.error({ err }, "Blog auto-writer tick failed");
  } finally {
    tickInFlight = false;
  }
}

export function startBlogScheduler(): void {
  // Create the tables early so the API/renderer never race a missing table.
  void ensureBlogSchema().catch((err) => logger.error({ err }, "Blog schema init failed"));
  setTimeout(() => void blogTick(), 30_000);
  setInterval(() => void blogTick(), TICK_MS);
  // Quietly give any post without a photo its hero image (existing posts get
  // theirs on the first boot after this feature ships; later it's a no-op).
  setTimeout(() => void backfillBlogHeroes().catch((err) => logger.warn({ err }, "Blog hero backfill failed")), 60_000);
  logger.info("Blog auto-writer scheduler started");
}
