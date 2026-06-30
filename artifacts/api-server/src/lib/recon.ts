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

type Source = { title: string; url: string };
type ReconBrief = {
  summary?: string;
  angle?: string;
  opener?: string;
  sources?: Source[];
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

export { composeBrief };
export type { ReconBrief };

export async function reconSellAngle(lead: ReconInput): Promise<ReconBrief> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");

  const known = [
    lead.website ? `website ${lead.website}` : "no website on file",
    lead.facebook ? `facebook ${lead.facebook}` : null,
    lead.instagram ? `instagram ${lead.instagram}` : null,
    lead.rating ? `${lead.rating}★ (${lead.reviewCount ?? 0} reviews)` : null,
  ].filter(Boolean).join("; ");

  const input = `You're a sharp sales scout. Research this local business across the web (their website, Facebook/Instagram, Yelp & Google reviews, whether they or competitors run ads, any recent hiring/expansion). Run a few searches.

Business: ${lead.name ?? "(unknown)"}${lead.category ? `, a ${lead.category}` : ""}${lead.address ? ` in ${lead.address}` : ""}. Known: ${known}.

ACCURACY RULES — this is critical:
- Only state things you ACTUALLY FOUND in the search results.
- NEVER invent or guess: no made-up competitor names, review counts, follower numbers, or "they run ads" unless a source shows it.
- If you can't verify something, leave it out entirely. It is better to say less than to say something unverified.
- Every concrete claim in your summary must be something a reader could confirm by clicking one of the cited search results.

Then explain it in PLAIN, SIMPLE English a busy person reads in five seconds — like texting a friend. No jargon, no buzzwords, never write "unknown".

Return ONLY this JSON:
{
  "summary": "<2-3 plain sentences, only verified facts: what the business is + the one real thing about their online presence or competition that matters>",
  "angle": "<plain: what to sell them and why, based on what you actually found>",
  "opener": "<a short, friendly first message referencing a real, verified detail>"
}
If your searches turned up little, say so honestly in one short sentence and keep the rest brief.`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-4o", tools: [{ type: "web_search_preview" }], input }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);

  type Annotation = { type?: string; url?: string; title?: string };
  type Content = { type?: string; text?: string; annotations?: Annotation[] };
  const data = (await res.json()) as { output?: { type?: string; content?: Content[] }[] };

  let text = "";
  const seen = new Set<string>();
  const sources: Source[] = [];
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

  const brief = parseBrief(text);
  // Traceability: every brief carries the real sources it was built from. No
  // sources found = treat the finding as unverified.
  return { ...brief, sources: sources.slice(0, 6) };
}
