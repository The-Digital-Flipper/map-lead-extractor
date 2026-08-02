/**
 * social-posts.ts — Free social-media advertising content generator.
 *
 * Generates ready-to-paste posts for Map Lead Extractor across Reddit, X/Twitter,
 * LinkedIn, Facebook groups, and Quora. You copy-paste them into each platform
 * yourself — there is no auto-posting, so there is zero risk of getting accounts
 * banned for automation. The posts are written to be value-first (especially on
 * Reddit and Quora) so communities don't flag them as spam.
 *
 * Run:   ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @workspace/scripts run social-posts
 *        (on Replit, add ANTHROPIC_API_KEY in the Secrets panel, then run the command)
 *
 * Output: scripts/social-posts/posts-YYYY-MM-DD.md  — open it and copy-paste.
 */

import Anthropic from "@anthropic-ai/sdk";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ─────────────────────────────────────────────────────────────────────────────
// EDIT THIS: your product. Change the wording here any time — the script reads
// from this object, so you never have to touch the logic below.
// ─────────────────────────────────────────────────────────────────────────────
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
  // Keywords to weave in naturally where it fits (helps discoverability / SEO).
  keywords: [
    "buy local business leads",
    "done-for-you lead lists",
    "targeted business leads",
    "lead generation",
  ],
} as const;

// How many posts to generate per platform.
const POSTS_PER_PLATFORM = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Platform definitions — the norms/rules each platform is written for.
// ─────────────────────────────────────────────────────────────────────────────
type Platform = {
  key: string;
  name: string;
  guidance: string;
};

const PLATFORMS: Platform[] = [
  {
    key: "reddit",
    name: "Reddit",
    guidance: [
      "Target subreddits: r/leadgeneration, r/sales, r/Entrepreneur, r/smallbusiness, r/digital_marketing.",
      "Reddit HATES ads. Each post must lead with genuine value (a tip, a workflow, a lesson learned) and mention the product only softly at the end, or not at all in the body (mention it in a comment instead).",
      "Write like a real person sharing experience, not a brand. No hype, no emojis-as-marketing, no 'check out my tool!!'.",
      "For each post, suggest the single best subreddit and an honest, non-clickbait title.",
    ].join(" "),
  },
  {
    key: "x",
    name: "X / Twitter",
    guidance: [
      "Build-in-public / practical-tip style. Each post <= 280 characters.",
      "Punchy, concrete, useful on its own. 1-2 relevant hashtags max.",
      "A mix is good: some pure tips, some showing a result, some with a soft CTA to the link.",
    ].join(" "),
  },
  {
    key: "linkedin",
    name: "LinkedIn",
    guidance: [
      "Professional B2B tone for sales & marketing audiences. 3-6 short paragraphs.",
      "Lead with a relatable pain (manual prospecting, bad lead lists), give a useful insight, then a soft mention of the product as how you solve it.",
      "End with a light question to drive comments. Minimal hashtags (3-5) at the very end.",
    ].join(" "),
  },
  {
    key: "facebook",
    name: "Facebook Groups",
    guidance: [
      "Target groups: small-business owners, digital marketing, lead generation, agency owners.",
      "Friendly and conversational. Lead with value or a question. Many groups ban hard selling, so keep the pitch soft and put the link at the end with a clear 'mods, remove if not allowed' courtesy where appropriate.",
    ].join(" "),
  },
  {
    key: "quora",
    name: "Quora",
    guidance: [
      "Format each as an ANSWER to a real question people ask, e.g. 'How do I get leads from Google Maps?' or 'What's the fastest way to build a local business prospect list?'.",
      "Give a genuinely helpful, complete answer first. Mention the product once, naturally, as one option — not the whole answer.",
      "For each post, include the question it answers as the title.",
    ].join(" "),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Structured-output schema: the model returns clean JSON we format into Markdown.
// ─────────────────────────────────────────────────────────────────────────────
const POSTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          where: {
            type: "string",
            description:
              "Where to post it: the specific subreddit, group type, or Quora question.",
          },
          title: {
            type: "string",
            description:
              "Suggested title/headline. Empty string if the platform has no title (e.g. X).",
          },
          body: { type: "string", description: "The ready-to-paste post text." },
          note: {
            type: "string",
            description:
              "One short line on why this works and any posting tip (e.g. put link in first comment).",
          },
        },
        required: ["where", "title", "body", "note"],
      },
    },
  },
  required: ["posts"],
} as const;

type GeneratedPost = {
  where: string;
  title: string;
  body: string;
  note: string;
};

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

function buildPrompt(platform: Platform): string {
  return [
    `You are a growth marketer writing free, organic social-media posts for a business that SELLS done-for-you local-business lead lists.`,
    ``,
    `WHAT WE SELL: ${PRODUCT.oneLiner}`,
    `BUY IT AT: ${PRODUCT.url}`,
    `AUDIENCE: ${PRODUCT.audience}`,
    `KEY SELLING POINTS:`,
    ...PRODUCT.keyBenefits.map((b) => `  - ${b}`),
    `KEYWORDS to weave in naturally where they fit: ${PRODUCT.keywords.join(", ")}`,
    ``,
    `PLATFORM: ${platform.name}`,
    `PLATFORM RULES: ${platform.guidance}`,
    ``,
    `Write ${POSTS_PER_PLATFORM} distinct posts for this platform. Make them genuinely`,
    `useful and varied — do not just reword the same post. Sound like a real human, not`,
    `an ad. The goal is organic reach without getting flagged as spam.`,
    `IMPORTANT: we sell the finished leads — never pitch a free tool, scraper, extension,`,
    `or "do it yourself"; the offer is always buying a ready-made lead list.`,
  ].join("\n");
}

async function generateForPlatform(platform: Platform): Promise<GeneratedPost[]> {
  // `thinking: adaptive` and `output_config` are current API fields that the
  // installed SDK version doesn't type yet; they pass through at runtime, so we
  // build the body and cast it (keeping the response strongly typed).
  const body = {
    model: "claude-opus-4-8",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: POSTS_SCHEMA } },
    messages: [{ role: "user", content: buildPrompt(platform) }],
  };
  const response = await client.messages.create(
    body as unknown as Anthropic.MessageCreateParamsNonStreaming,
  );

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`No text output for ${platform.name}`);
  }
  const parsed = JSON.parse(textBlock.text) as { posts: GeneratedPost[] };
  return parsed.posts;
}

function toMarkdown(results: { platform: Platform; posts: GeneratedPost[] }[], date: string): string {
  const lines: string[] = [
    `# Social posts for ${PRODUCT.name} — ${date}`,
    ``,
    `Copy-paste these into each platform. Posts are written to be value-first so they`,
    `don't get flagged as spam. Space them out over days, and never paste the exact same`,
    `text into multiple places.`,
    ``,
    `**Product:** ${PRODUCT.name} — ${PRODUCT.url}`,
    ``,
    `---`,
    ``,
  ];

  for (const { platform, posts } of results) {
    lines.push(`## ${platform.name}`, ``);
    posts.forEach((p, i) => {
      lines.push(`### ${i + 1}. ${p.where}`);
      if (p.title.trim()) lines.push(``, `**Title:** ${p.title}`);
      lines.push(``, p.body, ``, `> 💡 ${p.note}`, ``, `---`, ``);
    });
  }

  return lines.join("\n");
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "Missing ANTHROPIC_API_KEY.\n" +
        "On Replit: open the Secrets panel and add ANTHROPIC_API_KEY = your Anthropic key.\n" +
        "Locally:   ANTHROPIC_API_KEY=sk-ant-... pnpm --filter @workspace/scripts run social-posts",
    );
    process.exit(1);
  }

  console.log(`Generating ${POSTS_PER_PLATFORM} posts each for ${PLATFORMS.length} platforms...`);

  // Run all platforms in parallel; tolerate a single platform failing.
  const settled = await Promise.allSettled(
    PLATFORMS.map(async (platform) => {
      const posts = await generateForPlatform(platform);
      console.log(`  ✓ ${platform.name} (${posts.length} posts)`);
      return { platform, posts };
    }),
  );

  const results = settled
    .filter((r): r is PromiseFulfilledResult<{ platform: Platform; posts: GeneratedPost[] }> => {
      if (r.status === "rejected") console.error(`  ✗ failed:`, r.reason?.message ?? r.reason);
      return r.status === "fulfilled";
    })
    .map((r) => r.value);

  if (results.length === 0) {
    console.error("All platforms failed — nothing written.");
    process.exit(1);
  }

  const date = new Date().toISOString().slice(0, 10);
  const markdown = toMarkdown(results, date);

  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "social-posts");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `posts-${date}.md`);
  await writeFile(outPath, markdown, "utf8");

  console.log(`\nDone. Open and copy-paste from:\n  ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
