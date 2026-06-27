import { Router } from "express";

const router = Router();

// Sales assistant persona — knows exactly what lead types we sell so it can
// guide a visitor toward the right pack. Kept factual: no invented prices/counts.
const SYSTEM_PROMPT = `You are the friendly sales assistant for MapLeadExtractor, a service that SELLS targeted local-business leads to agencies, freelancers, and service providers.

We sell these lead types (each is a local business with a gap a buyer can fill):
- No-website businesses → sell website builds
- Outdated / broken / non-mobile websites → sell redesigns
- Few or no reviews → sell reputation / review generation
- Low ratings (under 4 stars) → sell reputation management
- No social presence → sell social media setup
- No online booking → sell automation / scheduling tools
- Weak Google/Bing map profiles → sell local SEO
- By industry (dentists, lawyers, roofers, HVAC, plumbers, contractors, salons, restaurants, and more)
- By territory (any US state or city; exclusive areas possible)

Leads are delivered as clean CSV with name, phone, email, website, ratings, category, address and more. Packs can be filtered by lead type, industry, and location.

Your job: understand what the visitor sells or who they serve, recommend the lead types that fit, and encourage them to request a pack. Keep replies short, warm, and concrete (2-4 sentences). If asked about price or exact lead counts, explain packs are custom-priced by volume and vertical and invite them to share what they need — do NOT invent specific prices or numbers. Never claim anything illegal or guarantee results.`;

interface ChatMessage { role: string; content: string }

router.post("/", async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "The chat assistant isn't configured yet. Set OPENAI_API_KEY to enable it." });
    return;
  }

  const body = req.body as { messages?: ChatMessage[] };
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  // Keep only valid user/assistant turns, cap history + length to bound cost.
  const history = incoming
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    res.status(400).json({ error: "Send a user message." });
    return;
  }

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
        temperature: 0.6,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      req.log.error({ status: r.status, detail: detail.slice(0, 500) }, "OpenAI chat error");
      res.status(502).json({ error: "The assistant is unavailable right now — please try again." });
      return;
    }

    const data = await r.json() as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I didn't catch that — could you rephrase?";
    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "OpenAI chat request failed");
    res.status(502).json({ error: "The assistant is unavailable right now — please try again." });
  }
});

export default router;
