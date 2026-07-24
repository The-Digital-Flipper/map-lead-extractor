/**
 * Blog hero photos — one AI-generated editorial image per blog post.
 *
 * Images live in the `blog_images` table (base64, like landing_images) so they
 * survive autoscale redeploys, and are served at /api/blog/hero/<slug>.jpg.
 * The daily auto-writer generates a hero right after publishing each new post;
 * a startup backfill quietly fills in any post that doesn't have one yet —
 * including the hand-written static posts, whose slugs/titles are mirrored
 * here (the server can't import the site's src/data/posts.ts).
 */
import { pool } from "@workspace/db";
import { logger } from "./logger";
import { callImagesApi } from "./landingCreative";

function openAiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
export function validHeroSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

// Same pattern as lib/blog.ts: created here idempotently because drizzle-kit
// push trips on pre-existing drift in this project.
let schemaReady = false;
async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_images (
      slug text PRIMARY KEY,
      mime text NOT NULL,
      data text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  schemaReady = true;
}

// ── Storage ───────────────────────────────────────────────────────────────────

export async function loadBlogHero(slug: string): Promise<{ mime: string; bytes: Buffer } | null> {
  await ensureSchema();
  const r = await pool.query<{ mime: string; data: string }>(
    "SELECT mime, data FROM blog_images WHERE slug = $1", [slug],
  );
  const row = r.rows[0];
  return row ? { mime: row.mime, bytes: Buffer.from(row.data, "base64") } : null;
}

/** Slugs that have a hero — lets the blog API mark which posts have photos. */
export async function heroSlugSet(): Promise<Set<string>> {
  await ensureSchema();
  const r = await pool.query<{ slug: string }>("SELECT slug FROM blog_images");
  return new Set(r.rows.map((x) => x.slug));
}

// ── Generation ────────────────────────────────────────────────────────────────

// Rotating art direction so the blog index doesn't look like one image cloned.
const STYLES = [
  "clean flat vector editorial illustration, bold geometric shapes, generous negative space",
  "modern isometric illustration with a subtle city-map motif and glowing location pins",
  "sleek minimal 3D render, soft studio lighting, floating abstract shapes",
  "premium gradient abstract with map routes and pin markers as a quiet background motif",
  "editorial desk scene illustration — laptop, coffee, notepad — stylized, not photoreal",
];

function heroPrompt(title: string, category: string, styleIdx: number): string {
  const style = STYLES[styleIdx % STYLES.length];
  return [
    "Design a wide (3:2) hero illustration for a B2B blog article about local-business lead generation.",
    `Article title: "${title}" (category: ${category}). Convey the topic visually and conceptually.`,
    `Art direction: ${style}. Dark, premium background (near-black navy) with one vivid green accent color, modern SaaS editorial aesthetic, strong single focal point, high contrast, uncluttered.`,
    "Hard rules: NO text, words, letters or numbers anywhere in the image; no logos or brand names; no fake UI screenshots with readable text; no watermarks; no borders.",
  ].join("\n");
}

async function generateHero(title: string, category: string, styleIdx: number): Promise<{ mime: string; bytes: Buffer }> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");
  const prompt = heroPrompt(title, category, styleIdx);
  try {
    return await callImagesApi(key, {
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
      quality: "medium",
      output_format: "jpeg",
    });
  } catch (primaryErr) {
    try {
      return await callImagesApi(key, {
        model: "dall-e-3",
        prompt,
        size: "1792x1024",
        quality: "standard",
      });
    } catch {
      // The gpt-image-1 error (e.g. billing limit) is the meaningful one.
      throw primaryErr;
    }
  }
}

/** Generate + store a hero for one post unless it already has one. */
export async function ensureHeroFor(slug: string, title: string, category: string): Promise<boolean> {
  await ensureSchema();
  const existing = await pool.query("SELECT 1 FROM blog_images WHERE slug = $1", [slug]);
  if (existing.rows.length) return false;
  // Vary style deterministically by slug so retries don't flip the art style.
  const styleIdx = [...slug].reduce((a, c) => a + c.charCodeAt(0), 0);
  const img = await generateHero(title, category, styleIdx);
  await pool.query(
    `INSERT INTO blog_images (slug, mime, data) VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data`,
    [slug, img.mime, img.bytes.toString("base64")],
  );
  logger.info({ slug }, "Blog hero image generated");
  return true;
}

// ── Backfill ──────────────────────────────────────────────────────────────────

// The hand-written posts bundled in the site (src/data/posts.ts) — mirrored so
// they get photos too. Keep in sync when adding a static post (rare).
const STATIC_POSTS: { slug: string; title: string; category: string }[] = [
  { slug: "how-to-scrape-google-maps-leads", title: "How to Find Google Maps Leads in 2025 (No Code Required)", category: "Tutorial" },
  { slug: "google-maps-vs-data-providers", title: "Google Maps vs. Paid Lead Databases: Which Is Better in 2025?", category: "Comparison" },
  { slug: "bing-maps-lead-generation", title: "Why Bing Maps Is an Untapped Lead Source Your Competitors Are Ignoring", category: "Strategy" },
  { slug: "cold-email-from-google-maps-leads", title: "How to Write Cold Emails That Actually Convert Google Maps Leads", category: "Outreach" },
  { slug: "lead-generation-for-web-designers", title: "The Freelance Web Designer's Guide to Finding Clients on Google Maps", category: "Use Cases" },
  { slug: "gdpr-google-maps-scraping", title: "Is Finding Leads on Google Maps Legal? GDPR, ToS, and What You Need to Know", category: "Legal" },
  { slug: "how-to-find-businesses-with-no-website", title: "How to Find Local Businesses With No Website in 2026", category: "Tutorial" },
  { slug: "where-to-buy-local-business-leads", title: "Where to Buy Local Business Leads That Actually Convert (2026)", category: "Strategy" },
  { slug: "how-to-extract-emails-from-google-maps", title: "How to Extract Emails From Google Maps (Free, No Code)", category: "Tutorial" },
  { slug: "lead-generation-for-marketing-agencies", title: "Lead Generation for Marketing Agencies: The 2026 Playbook", category: "Use Cases" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let backfillRunning = false;

/** Give every published post (DB + static) a hero, one at a time. Safe to call
 *  repeatedly — posts that already have an image are skipped instantly. */
export async function backfillBlogHeroes(): Promise<void> {
  if (backfillRunning || !openAiKey()) return;
  backfillRunning = true;
  try {
    await ensureSchema();
    const db = await pool.query<{ slug: string; title: string; category: string }>(
      "SELECT slug, title, category FROM blog_posts WHERE status = 'published' ORDER BY id",
    );
    const targets = [...STATIC_POSTS, ...db.rows];
    const have = await heroSlugSet();
    let made = 0;
    for (const t of targets) {
      if (have.has(t.slug)) continue;
      try {
        await ensureHeroFor(t.slug, t.title, t.category);
        made++;
        await sleep(4000); // gentle pacing on the images API
      } catch (err) {
        logger.warn({ err, slug: t.slug }, "Blog hero backfill failed for one post — continuing");
      }
    }
    if (made) logger.info({ made }, "Blog hero backfill finished");
  } finally {
    backfillRunning = false;
  }
}
