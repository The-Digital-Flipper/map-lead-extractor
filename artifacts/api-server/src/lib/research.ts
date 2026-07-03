/**
 * AI market research — given a plain-English goal, an LLM returns the best
 * Google Maps searches (category × US metro) to scrape for valuable leads.
 *
 * "Valuable" = businesses that are reachable but have a weak online presence
 * (no/poor website, few reviews) — the kind you can sell websites/marketing to,
 * which is what this app's opportunity score already rewards.
 *
 * GROUNDED IN LIVE WEB SEARCH. The model doesn't guess metros and demand from
 * memory — it runs real searches (business counts, "best cities for <trade>",
 * local directory density, recent demand signals) and bases every target,
 * priority and estLeads on what it actually found, with citations. This is the
 * same web-search grounding that discover.ts / recon.ts already use.
 *
 * Provider: prefers Anthropic (Claude, web_search tool) if ANTHROPIC_API_KEY is
 * set, else OpenAI (web_search_preview via the Responses API). No SDK for OpenAI.
 */
import Anthropic from "@anthropic-ai/sdk";

export type ResearchTarget = {
  category: string;
  location: string;
  lat: number | null;
  lng: number | null;
  priority: number; // 0-100 estimated opportunity density (grounded in search)
  estLeads: number; // rough leads a single Maps search yields
  reason: string;
  sources?: string[]; // URLs the target was grounded in (traceability)
};

const SYSTEM = `You are a B2B lead-generation market researcher. The user pulls business leads from Google Maps and sells websites, SEO, ads and marketing services to LOCAL businesses that have a WEAK online presence (no website or a poor one, few reviews) but are reachable by phone.

Your job: given the user's goal, return the single best set of Google Maps searches most likely to surface valuable, sellable leads. Each search is a (category, location) pair.

GROUND EVERYTHING IN REAL SEARCHES — do not rely on memory:
- Run several web searches first (e.g. how many independent operators of a category exist in a metro, "best cities for <trade> businesses", local business directories, recent demand/growth signals like storm-driven roofing demand, new-construction booms, tourism seasons).
- Base each metro choice, "priority" and "estLeads" on what you ACTUALLY FOUND, not on a hunch. Prefer concrete, verifiable metros over generic guesses.
- If the goal names a region, stay strictly inside it and find the real sub-markets within it.

Rules for the output:
- "category" = a service/business type as you'd type it into Google Maps, plural and lowercase (e.g. "roofing contractors", "auto repair shops", "med spas").
- "location" = a real US city + state abbreviation, formatted "City ST" (e.g. "Mobile AL").
- Favor categories of owner-operated local businesses that commonly have weak websites and real budgets (home services, trades, auto, health/beauty, local retail). Avoid big national chains and franchise-dominated categories.
- Diversify: don't stack every target on the same one or two metros unless the goal is that narrow.
- "lat"/"lng" = approximate coordinates of the city center (decimal degrees).
- "priority" = integer 0-100, grounded estimate of sellable opportunity density there.
- "estLeads" = integer rough count a single Maps search returns (typically 15-60).
- "reason" = max 12 words on why this is a good target, referencing what you found.`;

const OUTPUT_SPEC = `Return ONLY a JSON object of the form {"targets": [ ... ]} where each element has keys: category (string), location (string "City ST"), lat (number), lng (number), priority (0-100 int), estLeads (int), reason (string). No prose, no markdown fences.`;

const openAiKey = () => process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";

function coerceTargets(raw: unknown[], count: number, sources: string[]): ResearchTarget[] {
  const targets: ResearchTarget[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const category = String(o.category ?? "").trim();
    const location = String(o.location ?? "").trim();
    if (!category || !location) continue;
    const num = (v: unknown): number | null => {
      const n = typeof v === "number" ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };
    targets.push({
      category,
      location,
      lat: num(o.lat),
      lng: num(o.lng),
      priority: Math.min(100, Math.max(0, Math.round(num(o.priority) ?? 50))),
      estLeads: Math.max(0, Math.round(num(o.estLeads) ?? 20)),
      reason: String(o.reason ?? "").trim().slice(0, 160),
      sources: sources.length ? sources.slice(0, 6) : undefined,
    });
  }
  targets.sort((a, b) => b.priority - a.priority);
  return targets.slice(0, count);
}

// Pull an array out of either a bare JSON array or a { "targets": [...] } object.
function parseArray(text: string): unknown[] {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    const obj = JSON.parse(cleaned) as unknown;
    if (Array.isArray(obj)) return obj;
    if (obj && typeof obj === "object") {
      const arr = (obj as Record<string, unknown>).targets;
      if (Array.isArray(arr)) return arr;
    }
  } catch {
    /* fall through to bracket extraction */
  }
  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try {
      const obj = JSON.parse(cleaned.slice(objStart, objEnd + 1)) as Record<string, unknown>;
      if (Array.isArray(obj.targets)) return obj.targets;
    } catch {
      /* fall through */
    }
  }
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as unknown[];
  throw new Error("AI did not return parseable JSON");
}

// ── OpenAI: web-search-grounded via the Responses API (like discover.ts) ──────
async function researchOpenAI(goal: string, count: number, key: string): Promise<ResearchTarget[]> {
  const input = `${SYSTEM}

Goal: ${goal}

Use web search to research this, then return the ${count} best Google Maps searches.

${OUTPUT_SPEC}`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-4o", tools: [{ type: "web_search_preview" }], input }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
  }

  type Annotation = { type?: string; url?: string };
  type Content = { type?: string; text?: string; annotations?: Annotation[] };
  const data = (await res.json()) as { output?: { type?: string; content?: Content[] }[] };

  let text = "";
  const seen = new Set<string>();
  for (const item of data.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type !== "output_text") continue;
      text += c.text ?? "";
      for (const a of c.annotations ?? []) {
        if (a.type === "url_citation" && a.url) seen.add(a.url);
      }
    }
  }
  return coerceTargets(parseArray(text), count, [...seen]);
}

// ── Anthropic: web-search-grounded via Claude's server-side web_search tool ───
async function researchAnthropic(goal: string, count: number): Promise<ResearchTarget[]> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    system: `${SYSTEM}\n\n${OUTPUT_SPEC}`,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6 }],
    messages: [{ role: "user", content: `Goal: ${goal}\n\nResearch this with web search, then return the ${count} best Google Maps searches as JSON.` }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Collect the URLs Claude actually searched/cited for traceability.
  const sources = new Set<string>();
  for (const b of msg.content) {
    if (b.type === "web_search_tool_result" && Array.isArray((b as { content?: unknown }).content)) {
      for (const r of (b as { content: Array<{ url?: string }> }).content) {
        if (r && typeof r.url === "string") sources.add(r.url);
      }
    }
  }
  return coerceTargets(parseArray(text), count, [...sources]);
}

export async function researchTargets(opts: { goal: string; count: number }): Promise<ResearchTarget[]> {
  const count = Math.min(60, Math.max(4, Math.round(opts.count) || 24));
  if (process.env.ANTHROPIC_API_KEY) return researchAnthropic(opts.goal, count);
  const key = openAiKey();
  if (key) return researchOpenAI(opts.goal, count, key);
  throw new Error("No AI key set — add ANTHROPIC_API_KEY, or OPENAI_API_KEY (or CHAT_GPT_API), in the Replit Secrets panel.");
}
