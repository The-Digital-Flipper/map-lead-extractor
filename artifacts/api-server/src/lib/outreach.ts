/**
 * AI outreach engine — turns a single scraped+enriched lead into ready-to-send
 * cold outreach: a personalized email, an SMS, and a short follow-up sequence.
 *
 * Everything is grounded in the lead's OWN data — the gaps we detected (no
 * website, stale/DIY site, no online booking, few reviews), the AI sales bio,
 * and any social intel. No invented facts. Mirrors the AI plumbing in
 * analyze.ts (OpenAI primary, Anthropic fallback, strict JSON out).
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Lead, LeadOutreach } from "@workspace/db";
import { socialScanSummary } from "./socialScan";

function openAiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";
}

// The sender's identity and offer are NOT hardcoded — they come from the
// owner's own outreach settings and are passed into generateOutreach. Nothing
// about a specific company name or pitch is assumed here.
const SYSTEM = `You are an elite B2B copywriter writing cold outreach on behalf of the sender described below. You are given ONE real business lead scraped from Google Maps, with whatever data we have plus the specific weaknesses we detected in their online presence.

Write outreach that lands, grounded ONLY in the data provided — never invent facts, awards, names, or numbers you weren't given.

Produce:
1. angle: one short line naming the single strongest hook you're playing, based on the sender's offer and this lead's situation.
2. email.subject: 4-8 words, specific, curiosity or benefit driven, NOT spammy, no ALL CAPS, no "Re:" tricks.
3. email.body: 70-120 words. Open by referencing something concrete about THEM (their category, city, review strength, or a gap). Connect it to what the sender offers, and the payoff for the lead. One clear soft call to action (a reply or a quick call). Warm, human, peer-to-peer — not corporate. No fake personalization tokens, no "[Name]" — if you don't have a contact name, address the business naturally. Do NOT invent or append any company or personal name in the sign-off — leave the closing name out unless the sender's name is given to you below.
4. sms: under 300 characters, friendly, one sentence of value + one question. No links unless natural.
5. followUps: 2-3 timed nudges as {day, channel, subject?, body}. day = days after the first email (e.g. 3, 7). channel = "email" or "sms". Each adds a NEW angle or piece of value — never just "bumping this up". Emails need a subject; SMS omit it and stay under 300 chars.

Match tone to deal size: high-ticket leads get a more consultative, respectful tone; smaller local shops get warmer and simpler.

Return ONLY JSON: {"angle": string, "email": {"subject": string, "body": string}, "sms": string, "followUps": [{"day": number, "channel": "email"|"sms", "subject"?: string, "body": string}]}.`;

// Compact, grounded view of one lead — only fields the model should reason from.
function leadPayload(lead: Lead): Record<string, unknown> {
  const gaps: string[] = [];
  if (!lead.website || !lead.website.trim()) gaps.push("no website found");
  if (lead.siteLive === false) gaps.push("website does not load");
  if (lead.siteMobile === false) gaps.push("site not mobile-friendly");
  if (lead.hasBooking === false) gaps.push("no online booking");
  if (lead.siteYear && lead.siteYear <= new Date().getUTCFullYear() - 4) gaps.push(`site looks stale (©${lead.siteYear})`);
  if (lead.sitePlatform && /wix|godaddy|weebly|squarespace/i.test(lead.sitePlatform)) gaps.push(`cheap DIY site (${lead.sitePlatform})`);
  if ((lead.reviewCount ?? 0) > 0 && (lead.reviewCount ?? 0) < 15) gaps.push("thin review count");
  if (!lead.social || !lead.social.trim()) gaps.push("weak/no social presence");

  return {
    name: lead.name,
    category: lead.category,
    city: (lead.address ?? "").split(",").slice(-2).join(",").trim() || null,
    hasWebsite: !!(lead.website && lead.website.trim()),
    website: lead.website || null,
    rating: lead.rating ? Number(lead.rating) : null,
    reviews: lead.reviewCount,
    runsAds: lead.runsAds ?? null,
    highTicket: lead.highTicket ?? false,
    detectedGaps: gaps,
    needs: lead.needs ?? [],
    bio: lead.bio || null,
    socialIntel: lead.socialIntel || null,
    // Verified findings from their actual social pages (followers, dead pages,
    // missing platforms) — the most concrete personalization hooks we have.
    socialPages: socialScanSummary(lead.socialScan) || null,
    socialOpener: lead.socialScan?.opener || null,
  };
}

function parseOutreach(text: string): LeadOutreach {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const o = JSON.parse(cleaned) as Partial<LeadOutreach> & { email?: { subject?: unknown; body?: unknown }; followUps?: unknown[] };
  const followUps = Array.isArray(o.followUps)
    ? o.followUps
        .map((s) => s as Record<string, unknown>)
        .map((s) => ({
          day: Number(s.day) || 0,
          channel: s.channel === "sms" ? ("sms" as const) : ("email" as const),
          subject: s.subject != null ? String(s.subject).trim() : undefined,
          body: String(s.body ?? "").trim(),
        }))
        .filter((s) => s.body.length > 0)
    : [];
  return {
    angle: String(o.angle ?? "").trim(),
    email: { subject: String(o.email?.subject ?? "").trim(), body: String(o.email?.body ?? "").trim() },
    sms: String(o.sms ?? "").trim(),
    followUps,
  };
}

async function runAi(user: string, system: string = SYSTEM): Promise<string> {
  const key = openAiKey();
  if (key) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.8,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "{}";
  }
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    });
    return msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  }
  throw new Error("No AI key set — add OPENAI_API_KEY (or CHAT_GPT_API), or ANTHROPIC_API_KEY, in the Replit Secrets panel.");
}

// Who's sending and what they offer — owner-provided via the Automate settings.
export type OutreachSender = { name?: string | null; offer?: string | null };

// The pitch used whenever the owner hasn't typed their own offer — sending
// works out of the box; the settings field customizes it.
export const DEFAULT_OFFER = "websites, SEO, Google/Facebook ads, reputation and marketing automation for local businesses";

// Generate outreach for a single lead, pitching the sender's own offer (or the
// default pitch when none is set) and signing with the sender's own name.
export async function generateOutreach(lead: Lead, sender: OutreachSender = {}): Promise<LeadOutreach> {
  const offer = sender.offer?.trim() || DEFAULT_OFFER;
  const senderBlock = [
    `The sender offers: ${offer}`,
    sender.name?.trim() ? `Sign the email as: ${sender.name.trim()}` : `Do not add any sign-off name.`,
  ].join("\n");
  const user = `SENDER:\n${senderBlock}\n\nWrite outreach for this lead:\n${JSON.stringify(leadPayload(lead))}`;
  return parseOutreach(await runAi(user));
}

// ── Auto-replies ──────────────────────────────────────────────────────────────

// One prior message in the thread, oldest first.
export type ReplyTurn = { from: "us" | "them"; body: string };

// What the responder decides for one inbound reply. shouldReply=false means
// stay silent (auto-responder, pure opt-out, or nothing useful to add);
// leadDone=true means the lead clearly wants out → suppress them.
export type ReplyDecision = { shouldReply: boolean; leadDone: boolean; body: string };

const REPLY_SYSTEM = `You answer inbound email replies on behalf of the sender described below. A business lead the sender cold-emailed has just written back; the conversation so far is provided, newest message last.

Decide and respond:
- If the message is an automatic reply (out-of-office, "no longer at this company", ticket confirmations) → do not reply.
- If they clearly want out ("stop", "not interested", "take me off your list", hostility) → do not reply, and mark the lead done.
- Otherwise write the response: answer their actual questions plainly using ONLY the sender's offer details below — never invent prices, dates, availability, or capabilities you weren't given. If they ask something you can't answer from the offer, say the sender will get back to them on that. Keep it 30-90 words, human and direct, matching their tone, and end by moving one small step forward (proposing a quick call, asking the one question that advances the deal, or confirming the next step). No greeting-card fluff, no restating your whole pitch.

Never mention being an AI or automated. Do not add a signature — one is appended automatically.

Return ONLY JSON: {"shouldReply": boolean, "leadDone": boolean, "body": string}. body must be "" when shouldReply is false.`;

// Decide how (and whether) to answer a lead's reply. Grounded in the owner's
// offer + the thread so far; the model can also flag the lead as done.
export async function generateReply(lead: Lead, thread: ReplyTurn[], sender: OutreachSender): Promise<ReplyDecision> {
  const offer = sender.offer?.trim() || DEFAULT_OFFER;
  const convo = thread.map((t) => `${t.from === "us" ? "US" : "THEM"}:\n${t.body.trim()}`).join("\n\n---\n\n");
  const user = [
    `SENDER:\nThe sender offers: ${offer}`,
    sender.name?.trim() ? `The sender's name: ${sender.name.trim()}` : "",
    `\nTHE LEAD (who replied):\n${JSON.stringify(leadPayload(lead))}`,
    `\nCONVERSATION (oldest first, their newest reply last):\n\n${convo}`,
  ].filter(Boolean).join("\n");
  const raw = await runAi(user, REPLY_SYSTEM);
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const o = JSON.parse(cleaned) as Partial<ReplyDecision>;
  const body = String(o.body ?? "").trim();
  return { shouldReply: !!o.shouldReply && body.length > 0, leadDone: !!o.leadDone, body };
}
