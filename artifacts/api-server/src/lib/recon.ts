/**
 * Sell-angle recon — researches a business across the open web (its website,
 * Facebook, Instagram, Yelp, Google reviews, LinkedIn, directories) via OpenAI's
 * web_search tool and uncovers the single most valuable angle to sell them
 * digital-marketing services. Grounded in real search results.
 */
function openAiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";
}

export type ReconInput = {
  name: string | null;
  category: string | null;
  address: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  rating: string | null;
  reviewCount: number | null;
};

type ReconBrief = {
  whatTheyDo?: string;
  adActivity?: string;
  buyingSignals?: string[];
  competitorGap?: string;
  reputation?: string;
  primaryAngle?: string;
  opener?: string;
};

// Compose the structured findings into a readable, scannable brief (stored on
// the lead and shown in the UI). Signal/timing/competitive intel first — the
// non-commodity stuff that actually gets a reply.
function composeBrief(b: ReconBrief): string {
  const lines: string[] = [];
  if (b.whatTheyDo) lines.push(`📋 ${b.whatTheyDo}`);
  if (b.adActivity) lines.push(`📣 Ads: ${b.adActivity}`);
  if (b.buyingSignals?.length) lines.push(`🔥 Signals: ${b.buyingSignals.join("; ")}`);
  if (b.competitorGap) lines.push(`🥊 Competitor gap: ${b.competitorGap}`);
  if (b.reputation) lines.push(`⭐ Reputation: ${b.reputation}`);
  if (b.primaryAngle) lines.push(`🎯 Best angle: ${b.primaryAngle}`);
  if (b.opener) lines.push(`💬 Opener: "${b.opener}"`);
  return lines.join("\n");
}

function parseBrief(text: string): ReconBrief {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
  if (s === -1 || e < s) return { primaryAngle: cleaned.slice(0, 300) };
  try {
    const o = JSON.parse(cleaned.slice(s, e + 1)) as Record<string, unknown>;
    const arr = (v: unknown) => Array.isArray(v) ? v.map(String).filter(Boolean) : (v ? [String(v)] : []);
    return {
      whatTheyDo: o.whatTheyDo ? String(o.whatTheyDo) : undefined,
      adActivity: o.adActivity ? String(o.adActivity) : undefined,
      buyingSignals: arr(o.buyingSignals),
      competitorGap: o.competitorGap ? String(o.competitorGap) : undefined,
      reputation: o.reputation ? String(o.reputation) : undefined,
      primaryAngle: o.primaryAngle ? String(o.primaryAngle) : undefined,
      opener: o.opener ? String(o.opener) : undefined,
    };
  } catch {
    return { primaryAngle: cleaned.slice(0, 300) };
  }
}

export async function reconSellAngle(lead: ReconInput): Promise<string> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");

  const known = [
    lead.website ? `website ${lead.website}` : "no website on file",
    lead.facebook ? `facebook ${lead.facebook}` : null,
    lead.instagram ? `instagram ${lead.instagram}` : null,
    lead.rating ? `${lead.rating}★ (${lead.reviewCount ?? 0} reviews)` : null,
  ].filter(Boolean).join("; ");

  const input = `You are an elite sales-intelligence researcher. Generic findings like "they need a website" are worthless — everyone says that and it gets ignored. Your job is to uncover SIGNAL, TIMING and COMPETITIVE intel that proves real research and creates urgency. Run MULTIPLE web searches; dig hard.

Business: ${lead.name ?? "(unknown)"}${lead.category ? `, a ${lead.category}` : ""}${lead.address ? ` in ${lead.address}` : ""}. Known: ${known}.

Hunt specifically for the high-signal, non-obvious stuff:
- AD ACTIVITY: are THEY running paid ads right now (check the Facebook Ad Library, Google/Bing results, promoted posts)? Are their COMPETITORS running ads while they aren't? Roughly how many / what offers?
- BUYING / TIMING SIGNALS: recent hiring or job posts, a new location or expansion, new ownership, a grand opening, seasonal demand spikes, recent funding or press — anything showing budget + intent right now.
- COMPETITOR GAP: name a specific local competitor who is clearly winning (ranks above them, more/better reviews, runs ads, stronger social) and exactly how.
- REPUTATION VELOCITY: review trend (growing/declining), recent negative themes, unanswered reviews, rating vs. competitors.

Then return ONLY this JSON — specific, grounded, no invented numbers (say "unknown" if you can't verify):
{
  "whatTheyDo": "<1 sentence: business + positioning>",
  "adActivity": "<are they/competitors advertising now, where, rough scale — or 'no active ads found'>",
  "buyingSignals": ["<specific timing/intent signal>", "<another>"],
  "competitorGap": "<named competitor + exactly how they're winning>",
  "reputation": "<review trend / themes / rating vs competitors>",
  "primaryAngle": "<the sharpest, most URGENT angle tied to the strongest signal above — not generic>",
  "opener": "<one personalized opening line referencing a specific, timely thing you found>"
}`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-4o", tools: [{ type: "web_search_preview" }], input }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);

  const data = (await res.json()) as { output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
  let text = "";
  for (const item of data.output ?? []) {
    if (item.type === "message") for (const c of item.content ?? []) if (c.type === "output_text") text += c.text ?? "";
  }
  return composeBrief(parseBrief(text));
}
