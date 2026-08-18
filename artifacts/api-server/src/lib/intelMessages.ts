/**
 * Message Writer Agent — writes short, human outreach for five channels
 * (Facebook DM, email, phone script, follow-up, audit summary), grounded in the
 * lead's real data + website audit + recommended offer.
 *
 * HARD RULES (enforced in the system prompt AND by the caller):
 *  - Nothing is ever auto-sent. Every draft is stored `approved: false` and must
 *    be approved by the owner before any send path will touch it.
 *  - Sound human, simple, helpful. No fake promises. No guaranteed-income or
 *    guaranteed-results claims. No spam.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { IntelMessages, IntelMessage, IntelChannel, WebsiteAudit, OfferRec } from "@workspace/db";

export type MessageLead = {
  name?: string | null;
  category?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  rating?: string | number | null;
  reviewCount?: number | null;
};

const SYSTEM = `You write outreach for a local marketing consultant who helps small businesses (websites, SEO, Google profile, reviews, booking, ads). You are given ONE real business, an audit of their website, and the single offer to lead with.

Write 5 short messages, each in the sender's own plain voice — like a helpful local person, NOT a marketing agency and NOT an AI.

Channels:
- "facebook": a Facebook/Messenger DM. 2-3 sentences. Warm, casual, references ONE real thing you noticed about their business or site. Ends with a soft question.
- "email": a cold email. Return subject + body. Body 4-6 short sentences, no jargon, one clear ask (a quick call or reply).
- "phone": a phone-call SCRIPT the sender reads aloud. A one-line opener, one line of value tied to the gap, one line asking for a few minutes. Keep it natural and short.
- "followUp": a 2-3 sentence follow-up to send a few days later if they didn't reply. Friendly, no guilt, adds one small extra reason.
- "auditSummary": a plain-English note summarizing what their website is missing and why it matters, in a helpful (not salesy) tone, ending by offering to fix the top item.

STRICT RULES:
- Ground every claim in the data given. Never invent facts, numbers, prices, or results.
- NO guaranteed income, guaranteed results, "double your leads", or any promise of outcomes.
- No hype, no "revolutionary", no fake urgency, no spammy phrasing.
- Be specific and honest. If the audit shows a real gap, name it simply.
- Keep everything tight. These go to a busy business owner.

Return ONLY JSON:
{"facebook": string, "email": {"subject": string, "body": string}, "phone": string, "followUp": string, "auditSummary": string}`;

function openAiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";
}

function parse(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}

async function callAI(user: string): Promise<Record<string, unknown>> {
  const key = openAiKey();
  if (key) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.6,
        max_tokens: 1600,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return parse(data.choices?.[0]?.message?.content ?? "{}");
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1600,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    return parse(text);
  }
  throw new Error("No AI key set — add OPENAI_API_KEY (or CHAT_GPT_API), or ANTHROPIC_API_KEY, in the Replit Secrets panel.");
}

function mk(channel: IntelChannel, label: string, body: string, subject?: string): IntelMessage {
  return { channel, label, body: String(body ?? "").trim(), subject, approved: false, generatedAt: new Date().toISOString() };
}

/**
 * Generate all five channel drafts for a lead. Every draft comes back
 * `approved: false`. Throws if no AI key is configured.
 */
export async function generateMessages(lead: MessageLead, audit: WebsiteAudit, offer: OfferRec): Promise<IntelMessages> {
  const payload = {
    business: {
      name: lead.name,
      category: lead.category,
      city: (lead.address ?? "").split(",").slice(-2).join(",").trim() || null,
      website: lead.website || null,
      rating: lead.rating != null ? Number(lead.rating) : null,
      reviews: lead.reviewCount ?? null,
    },
    website_audit: {
      grade: audit.grade,
      hasWebsite: audit.hasWebsite,
      topGaps: audit.findings.slice(0, 4),
      headline: audit.homepageHeadline ?? null,
    },
    offer_to_lead_with: { name: offer.label, why: offer.reason },
  };
  const out = await callAI(`Write the 5 messages for this business:\n${JSON.stringify(payload)}`);

  const email = (out.email ?? {}) as { subject?: string; body?: string };
  const messages: IntelMessages = {
    facebook: mk("facebook", "Facebook DM", String(out.facebook ?? "")),
    email: mk("email", "Cold email", String(email.body ?? ""), String(email.subject ?? "")),
    phone: mk("phone", "Phone script", String(out.phone ?? "")),
    followUp: mk("followUp", "Follow-up", String(out.followUp ?? "")),
    auditSummary: mk("auditSummary", "Audit summary", String(out.auditSummary ?? "")),
  };
  return messages;
}
