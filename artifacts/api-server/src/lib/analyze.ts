/**
 * AI lead intelligence — reads a batch of REAL scraped leads and returns:
 *  - a short "why this batch is worth targeting" rationale,
 *  - which leads are HIGH-TICKET (AI judges likely deal size), and
 *  - a sales bio for each high-ticket lead (why valuable · what to pitch ·
 *    how to approach · weak spots found).
 *
 * Grounded in the lead's own data — no invented businesses.
 */
import Anthropic from "@anthropic-ai/sdk";

export type LeadForAnalysis = {
  id: number;
  name: string | null;
  category: string | null;
  address: string | null;
  website: string | null;
  rating: string | null;
  reviewCount: number | null;
  opportunityScore: number | null;
  needs: string[] | null;
  sitePlatform?: string | null; // builder fingerprint, e.g. "Wix", "GoDaddy"
  siteYear?: number | null;     // footer copyright year (staleness)
  runsAds?: boolean | null;     // already advertises = warmer, bigger budget
};

export type LeadVerdict = { id: number; highTicket: boolean; bio: string };
export type Analysis = { rationale: string; verdicts: LeadVerdict[] };

const SYSTEM = `You are a sharp B2B sales analyst for an agency that sells websites, SEO, ads, reputation and marketing automation to local businesses. You are given a batch of real business leads scraped from Google Maps (with whatever contact/website/review data we have).

Do three things:
1. rationale: 1-2 sentences on why this batch is a worthwhile target group (the shared opportunity you see in the data).
2. For EVERY lead, decide highTicket: true only if it's likely a big-money client — high deal size or budget (e.g. auto dealerships, law firms, med spas, multi-location operators, large contractors, specialty medical/dental, anything that clearly spends real money), judged from its name, category, review volume and web presence. A lead that "runsAds": true is already paying to advertise, so it has real budget — weigh that toward high-ticket. Be selective; most leads are not high-ticket.
3. For each HIGH-TICKET lead, write a 2-4 sentence "bio" covering: why they're valuable, what to pitch them, how to approach them, and the weak spots in their data to use as the hook (no website, a cheap DIY builder like Wix/GoDaddy, a stale copyright year, few reviews, weak social, etc.). For non-high-ticket leads, set bio to "".

Judge only from the data given — never invent facts. Return ONLY JSON: {"rationale": string, "leads": [{"id": number, "highTicket": boolean, "bio": string}]}.`;

function openAiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";
}

function parseAnalysis(text: string): Analysis {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const obj = JSON.parse(cleaned) as { rationale?: unknown; leads?: unknown };
  const verdicts: LeadVerdict[] = Array.isArray(obj.leads)
    ? (obj.leads as Record<string, unknown>[])
        .map((l) => ({
          id: Number(l.id),
          highTicket: !!l.highTicket,
          bio: String(l.bio ?? "").trim(),
        }))
        .filter((v) => Number.isFinite(v.id))
    : [];
  return { rationale: String(obj.rationale ?? "").trim(), verdicts };
}

export async function analyzeLeads(leadsIn: LeadForAnalysis[]): Promise<Analysis> {
  if (leadsIn.length === 0) return { rationale: "", verdicts: [] };

  // Compact, grounded view of each lead.
  const payload = leadsIn.map((l) => ({
    id: l.id,
    name: l.name,
    category: l.category,
    city: (l.address ?? "").split(",").slice(-2).join(",").trim() || null,
    hasWebsite: !!(l.website && l.website.trim()),
    platform: l.sitePlatform ?? null,   // "Wix"/"GoDaddy" = cheap DIY site
    siteYear: l.siteYear ?? null,       // old copyright year = stale site
    runsAds: l.runsAds ?? null,         // already advertises = warmer & bigger budget
    rating: l.rating ? Number(l.rating) : null,
    reviews: l.reviewCount,
    opportunity: l.opportunityScore,
    needs: l.needs ?? [],
  }));
  const user = `Analyze these ${payload.length} leads:\n${JSON.stringify(payload)}`;

  const key = openAiKey();
  if (key) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.5,
        max_tokens: 6000,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return parseAnalysis(data.choices?.[0]?.message?.content ?? "{}");
  }

  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 6000,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    return parseAnalysis(text);
  }

  throw new Error("No AI key set — add OPENAI_API_KEY (or CHAT_GPT_API), or ANTHROPIC_API_KEY, in the Replit Secrets panel.");
}
