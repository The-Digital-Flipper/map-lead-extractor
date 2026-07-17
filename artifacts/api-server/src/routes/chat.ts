import { Router } from "express";
import { db, chatConversations, chatMessages } from "@workspace/db";
import { eq, and, gt, asc } from "drizzle-orm";

const router = Router();

// ── Conversation persistence (live human takeover) ───────────────────────────
// Every widget conversation is stored so the owner can watch and reply live
// from the admin 💬 Chats tab. While the owner has joined, the AI stays silent.

async function getOrCreateConversation(publicId: string, page: string | undefined) {
  const found = await db.select().from(chatConversations).where(eq(chatConversations.publicId, publicId));
  if (found[0]) return found[0];
  const inserted = await db
    .insert(chatConversations)
    .values({ publicId, page: page?.slice(0, 200) ?? null })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];
  const again = await db.select().from(chatConversations).where(eq(chatConversations.publicId, publicId));
  return again[0]!;
}

async function storeMessage(conversationId: number, sender: "visitor" | "ai" | "admin", body: string) {
  const rows = await db.insert(chatMessages).values({ conversationId, sender, body: body.slice(0, 4000) }).returning();
  await db.update(chatConversations)
    .set({ updatedAt: new Date(), ...(sender === "visitor" ? { lastVisitorAt: new Date() } : {}) })
    .where(eq(chatConversations.id, conversationId));
  return rows[0]!;
}

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

There is ONE ready-to-buy pack: the "100 Local Business Leads" pack — $29 one-time (no subscription, no account needed), bought in the Buy Leads section of the homepage. The buyer can type what they want in plain words (business type + city/state, or "anywhere"), or pick from dropdowns. Every pack is human-reviewed for quality before it ships: the CSV download link arrives by email, usually within a few hours and always within 24 — if we can't fill all 100, we auto-refund the difference. Larger or more specific packs (exact lead type, exclusive territory, custom volume) are custom-priced.

Your job: understand what the visitor sells or who they serve, recommend the lead types that fit, and encourage them to buy the $29 starter pack or request a custom pack. Keep replies short, warm, and concrete (2-4 sentences). For custom packs, do NOT invent specific prices or counts — invite them to share what they need. Never claim anything illegal or guarantee results.`;

interface ChatMessage { role: string; content: string }

// Accept the key under several common names so it works regardless of what the
// secret was named (e.g. CHAT_GPT_API, OPENAI_API_KEY).
function getOpenAiKey(): string | undefined {
  return process.env.OPENAI_API_KEY
    || process.env.CHAT_GPT_API
    || process.env.CHATGPT_API_KEY
    || process.env.OPENAI_KEY
    || process.env.OPENAI;
}

function smsConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_FROM_NUMBER && process.env.ALERT_PHONE_NUMBER);
}

function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && (process.env.ALERT_EMAIL || process.env.OWNER_EMAIL));
}

// Email the owner when someone starts chatting, via Resend. Fire-and-forget;
// silent no-op if not configured. Uses Resend's shared sender by default so it
// works before you've verified your own domain.
async function notifyOwnerEmail(subject: string, text: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL || process.env.OWNER_EMAIL;
  const from = process.env.ALERT_FROM_EMAIL || "MapLeadExtractor <onboarding@resend.dev>";
  if (!key || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    /* best-effort; the chat still works without it */
  }
}

// Text the owner via Twilio when someone starts chatting. Fire-and-forget —
// never blocks or breaks the chat reply. Silent no-op if Twilio isn't set up.
async function notifyOwnerSms(body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = process.env.ALERT_PHONE_NUMBER;
  if (!sid || !token || !from || !to) return;
  try {
    const params = new URLSearchParams({ To: to, From: from, Body: body.slice(0, 600) });
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    /* SMS is best-effort; the chat still works without it */
  }
}

// GET /api/chat/health — visit this in a browser to diagnose the ChatGPT setup.
// Reports whether the key is set and whether a real call to OpenAI succeeds,
// with a plain-English hint for the common failures (bad key / no credit).
router.get("/health", async (_req, res) => {
  const apiKey = getOpenAiKey();
  const model = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
  if (!apiKey) {
    res.json({ configured: false, ok: false, hint: "No OpenAI key found. Set a secret named OPENAI_API_KEY or CHAT_GPT_API, then redeploy." });
    return;
  }
  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
      signal: AbortSignal.timeout(15000),
    });
    if (r.ok) {
      const alerts = [emailConfigured() ? "✉️ email" : null, smsConfigured() ? "📱 SMS" : null].filter(Boolean);
      res.json({ configured: true, ok: true, model, emailAlerts: emailConfigured(), smsAlerts: smsConfigured(), hint: `✅ ChatGPT is connected and working.${alerts.length ? ` Alerts ON: ${alerts.join(" + ")}.` : " (No alerts set up yet.)"}` });
      return;
    }
    const detail = (await r.text().catch(() => "")).slice(0, 300);
    let hint = `OpenAI returned ${r.status}.`;
    if (r.status === 401) hint = "Invalid API key (401) — the key value is wrong or revoked.";
    else if (r.status === 429) hint = "Quota / billing (429) — your OpenAI account has no credit. Add a few dollars at platform.openai.com → Billing.";
    else if (r.status === 404) hint = `Model "${model}" not found (404) — your account may not have access to it.`;
    res.json({ configured: true, ok: false, status: r.status, hint, detail });
  } catch (err) {
    res.json({ configured: true, ok: false, hint: "Could not reach OpenAI: " + (err instanceof Error ? err.message : "error") });
  }
});

// GET /api/chat/:publicId/messages?after=<id> — the widget polls this to pick
// up the owner's live replies (and to survive page reloads). The unguessable
// publicId minted by the widget is the read credential.
router.get("/:publicId/messages", async (req, res) => {
  const publicId = String(req.params.publicId ?? "");
  if (publicId.length < 16) { res.status(404).json({ error: "Not found" }); return; }
  const conv = (await db.select().from(chatConversations).where(eq(chatConversations.publicId, publicId)))[0];
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const after = Number(req.query.after) || 0;
  const rows = await db
    .select({ id: chatMessages.id, sender: chatMessages.sender, body: chatMessages.body })
    .from(chatMessages)
    .where(and(eq(chatMessages.conversationId, conv.id), gt(chatMessages.id, after)))
    .orderBy(asc(chatMessages.id))
    .limit(100);
  res.json({ messages: rows, humanMode: conv.adminJoined });
});

router.post("/", async (req, res) => {
  const apiKey = getOpenAiKey();
  const body = req.body as { messages?: ChatMessage[]; conversationId?: string; page?: string };
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

  const visitorMsg = history[history.length - 1].content;

  // Persist the conversation so the owner can watch + take over live.
  let conv: typeof chatConversations.$inferSelect | null = null;
  const publicId = typeof body.conversationId === "string" ? body.conversationId.slice(0, 64) : "";
  if (publicId.length >= 16) {
    try {
      conv = await getOrCreateConversation(publicId, body.page);
      await storeMessage(conv.id, "visitor", visitorMsg);
    } catch (err) {
      req.log.error({ err }, "chat persistence failed — continuing stateless");
    }
  }

  // Text the owner the first time a visitor sends a message in a conversation.
  const userTurns = history.filter(m => m.role === "user").length;
  if (userTurns === 1) {
    notifyOwnerSms(`🟢 New lead chat on MapLeadExtractor:\n"${visitorMsg}"\n\nOpen /admin → 💬 Chats to reply live.`)
      .catch(() => {});
    notifyOwnerEmail("🟢 New lead chat on MapLeadExtractor",
      `Someone just started chatting on your site:\n\n"${visitorMsg}"\n\nOpen https://mapleadextractor.net/admin → 💬 Chats tab to watch the conversation and reply live.`)
      .catch(() => {});
  }

  // Owner has taken over: the AI stays silent, the widget switches to polling
  // for the owner's live replies.
  if (conv?.adminJoined) {
    res.json({ reply: null, humanMode: true });
    return;
  }

  // No AI configured — still persist the message and let the owner reply live.
  if (!apiKey) {
    const fallback = "Thanks for your message! The owner has been notified and will reply right here shortly.";
    if (conv) await storeMessage(conv.id, "ai", fallback).catch(() => {});
    res.json({ reply: fallback });
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
    if (conv) await storeMessage(conv.id, "ai", reply).catch(() => {});
    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "OpenAI chat request failed");
    res.status(502).json({ error: "The assistant is unavailable right now — please try again." });
  }
});

export default router;
