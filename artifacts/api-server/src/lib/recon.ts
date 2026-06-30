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
  summary?: string;
  angle?: string;
  opener?: string;
};

// Plain-English brief — reads like a friend explaining what's up with the
// business and how to sell them. No labels-soup, no jargon, no "unknown".
function composeBrief(b: ReconBrief): string {
  const lines: string[] = [];
  if (b.summary) lines.push(b.summary);
  if (b.angle) lines.push(`How to sell them: ${b.angle}`);
  if (b.opener) lines.push(`What to say: "${b.opener}"`);
  return lines.join("\n\n");
}

function parseBrief(text: string): ReconBrief {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
  if (s === -1 || e < s) return { summary: cleaned.slice(0, 400) };
  try {
    const o = JSON.parse(cleaned.slice(s, e + 1)) as Record<string, unknown>;
    const clean = (v: unknown) => { const t = String(v ?? "").trim(); return t && !/^unknown\.?$/i.test(t) ? t : undefined; };
    return { summary: clean(o.summary), angle: clean(o.angle), opener: clean(o.opener) };
  } catch {
    return { summary: cleaned.slice(0, 400) };
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

  const input = `You're a sharp sales scout. Research this local business across the web (their website, Facebook/Instagram, Yelp & Google reviews, whether they or competitors run ads, any recent hiring/expansion). Run a few searches and dig.

Business: ${lead.name ?? "(unknown)"}${lead.category ? `, a ${lead.category}` : ""}${lead.address ? ` in ${lead.address}` : ""}. Known: ${known}.

Then explain it in PLAIN, SIMPLE English a busy person reads in five seconds — like you're texting a friend. No jargon, no bullet labels, no buzzwords, never write "unknown". Focus on the ONE real, specific thing worth acting on (e.g. "their main competitor down the road runs Facebook ads and they don't" or "great reviews but no website to send people to").

Return ONLY this JSON:
{
  "summary": "<2-3 plain sentences: what the business is, and the one clear thing about their online presence or competition that matters>",
  "angle": "<plain: what to sell them and why it would actually help them — explain like to a friend>",
  "opener": "<a short, friendly first message you'd send them>"
}
If you truly can't find anything useful online, make summary one honest plain sentence and keep angle/opener short.`;

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
