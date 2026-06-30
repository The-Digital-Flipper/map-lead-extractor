/**
 * AI market research — given a plain-English goal, an LLM returns the best
 * Google Maps searches (category × US metro) to scrape for valuable leads.
 *
 * "Valuable" = businesses that are reachable but have a weak online presence
 * (no/poor website, few reviews) — the kind you can sell websites/marketing to,
 * which is what this app's opportunity score already rewards.
 *
 * Provider: uses OpenAI (key in CHAT_GPT_API / OPENAI_API_KEY) by default, or
 * Anthropic if ANTHROPIC_API_KEY is set. No SDK needed — plain REST calls.
 */
import Anthropic from "@anthropic-ai/sdk";

export type ResearchTarget = {
  category: string;
  location: string;
  lat: number | null;
  lng: number | null;
  priority: number; // 0-100 estimated opportunity density
  estLeads: number; // rough leads a single Maps search yields
  reason: string;
};

const SYSTEM = `You are a B2B lead-generation market researcher. The user pulls business leads from Google Maps and sells websites, SEO, ads and marketing services to LOCAL businesses that have a WEAK online presence (no website or a poor one, few reviews) but are reachable by phone.

Given the user's goal, return the single best set of Google Maps searches most likely to surface valuable, sellable leads. Each search is a (category, location) pair.

Rules:
- "category" = a service/business type as you'd type it into Google Maps, plural and lowercase (e.g. "roofing contractors", "auto repair shops", "med spas").
- "location" = a real US city + state abbreviation, formatted "City ST" (e.g. "Mobile AL").
- Favor categories of owner-operated local businesses that commonly have weak websites and real budgets (home services, trades, auto, health/beauty, local retail). Avoid big national chains and categories dominated by franchises.
- Spread across the metros that best fit the goal; if the goal names a region, stay in it.
- "lat"/"lng" = approximate coordinates of the city center (decimal degrees).
- "priority" = integer 0-100, your estimate of how much sellable opportunity density is in that search.
- "estLeads" = integer rough count a single Maps search returns (typically 15-60).
- "reason" = max 12 words on why this is a good target.`;

const openAiKey = () => process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";

function coerceTargets(raw: unknown[], count: number): ResearchTarget[] {
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
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as unknown[];
  throw new Error("AI did not return parseable JSON");
}

async function researchOpenAI(goal: string, count: number, key: string): Promise<ResearchTarget[]> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.4,
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${SYSTEM}\n\nReturn a JSON object of the form {"targets": [ ... ]} where each element has keys: category, location, lat, lng, priority, estLeads, reason.` },
        { role: "user", content: `Goal: ${goal}\n\nReturn the ${count} best Google Maps searches.` },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? "";
  return coerceTargets(parseArray(text), count);
}

async function researchAnthropic(goal: string, count: number): Promise<ResearchTarget[]> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8000,
    system: `${SYSTEM}\n\nReturn ONLY a JSON array of objects with keys: category, location, lat, lng, priority, estLeads, reason. No prose, no markdown fences.`,
    messages: [{ role: "user", content: `Goal: ${goal}\n\nReturn the ${count} best Google Maps searches as a JSON array.` }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return coerceTargets(parseArray(text), count);
}

export async function researchTargets(opts: { goal: string; count: number }): Promise<ResearchTarget[]> {
  const count = Math.min(60, Math.max(4, Math.round(opts.count) || 24));
  if (process.env.ANTHROPIC_API_KEY) return researchAnthropic(opts.goal, count);
  const key = openAiKey();
  if (key) return researchOpenAI(opts.goal, count, key);
  throw new Error("No AI key set — add OPENAI_API_KEY (or CHAT_GPT_API), or ANTHROPIC_API_KEY, in the Replit Secrets panel.");
}
