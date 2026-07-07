/**
 * Social page scan — analyzes a lead's ACTUAL social media pages to arm the
 * pitch: which platforms they're on, followers, how recently they posted,
 * which platforms are missing entirely, and a ready-to-use angle built from
 * those findings.
 *
 * Two layers, cheapest first:
 *  1. Direct probe: fetch the social URLs we already have on file. Public
 *     Facebook/Instagram pages leak follower counts and page type in their
 *     og:/meta description tags even without login — verified facts, free.
 *  2. AI web search (same OpenAI web_search pattern as recon.ts): fills the
 *     gaps, finds profiles we DON'T have on file, and judges recency. Strict
 *     accuracy rules — only claims backed by a search result or a probe fact.
 */
import { db, leads, type Lead, type SocialScanReport, type SocialScanPlatform } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

function openAiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";
}

const PLATFORMS = ["facebook", "instagram", "twitter", "linkedin"] as const;

// ── Layer 1: direct probe of stored URLs ─────────────────────────────────────

type ProbeFact = { platform: string; url: string; fact: string };

// Meta tags public social pages serve to crawlers, e.g. Instagram:
// "1,234 Followers, 56 Following, 789 Posts — ..." / Facebook: "... 4.9 ★ ·
// 210 people like this". These are the lead's OWN pages talking.
async function probeUrl(platform: string, url: string): Promise<ProbeFact | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { platform, url, fact: `page returned HTTP ${res.status} (broken or removed?)` };
    const html = (await res.text()).slice(0, 200_000);
    const meta = (name: string): string => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"))
        ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, "i"));
      return m?.[1] ?? "";
    };
    const desc = meta("og:description") || meta("description");
    const title = meta("og:title");
    const bits = [title, desc].filter(Boolean).join(" — ").replace(/\s+/g, " ").trim().slice(0, 240);
    return bits ? { platform, url, fact: bits } : null;
  } catch {
    return null; // unreachable page = no verified fact, let the AI search judge
  }
}

async function probeLead(lead: Lead): Promise<ProbeFact[]> {
  const targets = PLATFORMS
    .map((p) => ({ platform: p, url: (lead[p] ?? "").trim() }))
    .filter((t) => /^https?:\/\//i.test(t.url));
  const results = await Promise.all(targets.map((t) => probeUrl(t.platform, t.url)));
  return results.filter((r): r is ProbeFact => r !== null);
}

// ── Layer 2: AI web search ───────────────────────────────────────────────────

function parseReport(text: string): SocialScanReport | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
  if (s === -1 || e < s) return null;
  try {
    const o = JSON.parse(cleaned.slice(s, e + 1)) as Partial<SocialScanReport>;
    const str = (v: unknown) => String(v ?? "").trim();
    const platforms: SocialScanPlatform[] = Array.isArray(o.platforms)
      ? o.platforms.map((p) => ({
          platform: str((p as SocialScanPlatform).platform).toLowerCase(),
          url: str((p as SocialScanPlatform).url) || undefined,
          followers: str((p as SocialScanPlatform).followers) || undefined,
          lastActive: str((p as SocialScanPlatform).lastActive) || undefined,
          note: str((p as SocialScanPlatform).note) || undefined,
        })).filter((p) => p.platform)
      : [];
    const grade = (["none", "weak", "ok", "strong"] as const).find((g) => g === str(o.grade)) ?? (platforms.length ? "weak" : "none");
    return {
      platforms,
      missing: Array.isArray(o.missing) ? o.missing.map(str).filter(Boolean) : [],
      grade,
      pitch: str(o.pitch),
      opener: str(o.opener),
    };
  } catch {
    return null;
  }
}

export async function socialScanLead(lead: Lead): Promise<SocialScanReport> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");

  const probes = await probeLead(lead);
  const onFile = PLATFORMS.filter((p) => (lead[p] ?? "").trim()).map((p) => `${p}: ${lead[p]}`);
  const probeLines = probes.map((p) => `- ${p.platform} (${p.url}): ${p.fact}`);

  const input = `You're a sales scout analyzing a local business's SOCIAL MEDIA presence to arm a pitch for marketing services. Run a few web searches on their social pages (Facebook, Instagram, X/Twitter, LinkedIn, TikTok, YouTube).

Business: ${lead.name ?? "(unknown)"}${lead.category ? `, a ${lead.category}` : ""}${lead.address ? ` in ${lead.address}` : ""}.
${onFile.length ? `Profiles on file: ${onFile.join("; ")}` : "No social profiles on file — search for any."}
${probeLines.length ? `VERIFIED facts pulled from their own pages just now:\n${probeLines.join("\n")}` : ""}

Find, for each platform where they exist: follower/like count, how recently they posted (recency is the #1 signal — a dead page is the strongest sales hook), and one concrete observation (e.g. "last post 9 months ago", "posts weekly but under 5 likes each", "no reviews answered"). Also determine which major platforms they are simply NOT on.

ACCURACY RULES — critical:
- Only state what a search result or the VERIFIED facts above actually show. Never guess follower counts or dates.
- If a platform can't be verified either way, leave it out of "platforms" AND out of "missing".
- It's better to report less than to invent.

Return ONLY this JSON:
{
  "platforms": [{"platform": "facebook", "url": "...", "followers": "210", "lastActive": "last post March 2025", "note": "<one concrete observation>"}],
  "missing": ["instagram", "linkedin"],
  "grade": "<none|weak|ok|strong — overall social presence>",
  "pitch": "<2-3 plain sentences: how to use these findings to sell them social media / marketing services. Reference the concrete facts.>",
  "opener": "<a short, friendly first message referencing ONE real finding, e.g. their dead Facebook page>"
}`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-4o", tools: [{ type: "web_search_preview" }], input }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);

  type Annotation = { type?: string; url?: string; title?: string };
  type Content = { type?: string; text?: string; annotations?: Annotation[] };
  const data = (await res.json()) as { output?: { type?: string; content?: Content[] }[] };

  let text = "";
  const seen = new Set<string>();
  const sources: { title: string; url: string }[] = [];
  for (const item of data.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type !== "output_text") continue;
      text += c.text ?? "";
      for (const a of c.annotations ?? []) {
        if (a.type === "url_citation" && a.url && !seen.has(a.url)) {
          seen.add(a.url);
          sources.push({ title: a.title || a.url, url: a.url });
        }
      }
    }
  }

  const report = parseReport(text);
  if (!report) throw new Error("Scan produced no parseable report.");
  return { ...report, sources: sources.slice(0, 6) };
}

/** One-line version for CSV cells and outreach context, e.g.
 * "Social: weak — facebook 210 followers (last post March 2025); missing instagram, linkedin." */
export function socialScanSummary(scan: SocialScanReport | null | undefined): string {
  if (!scan) return "";
  const parts = scan.platforms.map((p) =>
    [p.platform, p.followers && `${p.followers} followers`, p.lastActive].filter(Boolean).join(" "));
  const bits = [
    `Social: ${scan.grade}`,
    parts.length ? parts.join("; ") : "no active pages found",
    scan.missing.length ? `missing ${scan.missing.join(", ")}` : "",
  ].filter(Boolean);
  return bits.join(" — ");
}

/** Scan + persist one lead. Returns the saved report. */
export async function scanAndSaveLead(lead: Lead): Promise<SocialScanReport> {
  const report = await socialScanLead(lead);
  await db.update(leads).set({ socialScan: report, socialScanAt: new Date(), updatedAt: new Date() })
    .where(eq(leads.id, lead.id));
  logger.info({ leadId: lead.id, grade: report.grade, platforms: report.platforms.length }, "social scan saved");
  return report;
}
