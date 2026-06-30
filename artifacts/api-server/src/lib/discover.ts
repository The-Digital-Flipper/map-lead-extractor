/**
 * Live web-search lead discovery — finds REAL net-new businesses on the open
 * web (not just Google Maps) via OpenAI's web_search tool, grounded in actual
 * search results with citations. Returns businesses to save as leads.
 */
export type DiscoveredBiz = {
  name: string;
  city: string | null;
  state: string | null;
  website: string | null;
  phone: string | null;
  category: string | null;
  why: string;
};

function openAiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";
}

function extractJson(text: string): { businesses?: unknown[] } {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end < start) return {};
  try { return JSON.parse(cleaned.slice(start, end + 1)) as { businesses?: unknown[] }; }
  catch { return {}; }
}

export async function discoverBusinesses(goal: string, max = 15): Promise<DiscoveredBiz[]> {
  const key = openAiKey();
  if (!key) throw new Error("No OpenAI key set — add OPENAI_API_KEY (or CHAT_GPT_API) in the Replit Secrets panel.");
  const n = Math.min(25, Math.max(3, max));

  const input = `Use web search to find up to ${n} REAL local businesses that match this goal: "${goal}".
Favor businesses an agency could sell websites/SEO/ads/marketing to — especially ones with a weak online presence (no or poor website, few reviews).
For each business return: name, city, state (2-letter), website (full URL or null), phone (or null), category (short), why (max 15 words on why it fits the goal).
Return ONLY a JSON object: {"businesses":[{"name":"","city":"","state":"","website":null,"phone":null,"category":"","why":""}]}. No prose, no markdown.`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-4o", tools: [{ type: "web_search_preview" }], input }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);

  const data = (await res.json()) as { output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
  let text = "";
  for (const item of data.output ?? []) {
    if (item.type === "message") {
      for (const c of item.content ?? []) {
        if (c.type === "output_text") text += c.text ?? "";
      }
    }
  }

  const parsed = extractJson(text);
  const list = Array.isArray(parsed.businesses) ? parsed.businesses : [];
  const out: DiscoveredBiz[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (!name) continue;
    const str = (v: unknown) => { const s = String(v ?? "").trim(); return s && s.toLowerCase() !== "null" ? s : null; };
    out.push({
      name,
      city: str(o.city),
      state: str(o.state),
      website: str(o.website),
      phone: str(o.phone),
      category: str(o.category),
      why: String(o.why ?? "").trim().slice(0, 200),
    });
  }
  return out.slice(0, n);
}
