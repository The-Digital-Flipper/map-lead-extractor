/**
 * Lead-pack domain logic shared by the Stripe routes and the async build
 * worker: the product definition, the business-type / state whitelists, the
 * free-text request parser (heuristic first, OpenAI fallback), and the lead
 * counting/naming helpers. Single source of truth so the checkout, the
 * availability check, and the fulfillment worker all agree on what a request
 * means and which leads satisfy it.
 */
import { db, leads } from "@workspace/db";
import { and, count, ilike, isNull, sql, type SQL } from "drizzle-orm";
import { logger } from "./logger";

// The one-time product. Priced inline via Stripe price_data — no dashboard
// Price ID needed.
export const LEAD_PACK = {
  name: "100 Local Business Leads",
  description: "Top-scored local business leads delivered as a clean CSV — phone, email, website, socials, ratings & opportunity scores.",
  leadCount: 100,
  priceCents: 2900,
};

// Volume tiers sold by the homepage pricing grid. Keys are the sizes the
// client may send; anything else is rejected. Keep prices in sync with the
// tier cards in lead-extractor-site/src/pages/home.tsx.
export const PACK_TIERS = new Map<number, { leadCount: number; priceCents: number }>([
  [100, { leadCount: 100, priceCents: 2900 }],
  [500, { leadCount: 500, priceCents: 9900 }],
  [1000, { leadCount: 1000, priceCents: 17900 }],
  [5000, { leadCount: 5000, priceCents: 59900 }],
]);

// Business types the pack UI offers. The KEY is the ILIKE search term matched
// against leads.category; the VALUE is the human label. Keep in sync with the
// PACK_CATEGORIES list in lead-extractor-site/src/pages/home.tsx.
export const PACK_CATEGORIES = new Map<string, string>([
  ["accountant", "Accountants"],
  ["auto repair", "Auto Repair Shops"],
  ["barber", "Barber Shops"],
  ["cafe", "Cafés"],
  ["car deal", "Car Dealerships"],
  ["chiropract", "Chiropractors"],
  ["clean", "Cleaning Services"],
  ["coffee", "Coffee Shops"],
  ["contractor", "Contractors & Construction"],
  ["dentist", "Dentists"],
  ["electric", "Electricians"],
  ["fence", "Fence Contractors"],
  ["floor", "Flooring Contractors"],
  ["florist", "Florists"],
  ["garage door", "Garage Door Services"],
  ["gutter", "Gutter Services"],
  ["gym", "Gyms & Fitness"],
  ["handyman", "Handyman Services"],
  ["home inspect", "Home Inspectors"],
  ["hvac", "HVAC Contractors"],
  ["insurance", "Insurance Agents"],
  ["junk", "Junk Removal"],
  ["landscap", "Landscapers"],
  ["lawn", "Lawn Care"],
  ["lawyer", "Lawyers"],
  ["locksmith", "Locksmiths"],
  ["mason", "Masonry Contractors"],
  ["massage", "Massage Therapists"],
  ["medical", "Medical Practices"],
  ["moving", "Moving Companies"],
  ["paint", "Painters"],
  ["pest", "Pest Control"],
  ["pet groom", "Pet Groomers"],
  ["photograph", "Photographers"],
  ["plumb", "Plumbers"],
  ["pool", "Pool Services"],
  ["pressure wash", "Pressure Washing"],
  ["real estate", "Real Estate Agents"],
  ["restaurant", "Restaurants"],
  ["retail", "Retail Stores"],
  ["roof", "Roofers"],
  ["salon", "Salons"],
  ["septic", "Septic Services"],
  ["spa", "Spas"],
  ["tile", "Tile Contractors"],
  ["towing", "Towing Services"],
  ["tree", "Tree Services"],
  ["veterinar", "Veterinarians"],
  ["window", "Window Cleaning"],
]);

// 2-letter code → full name (both directions used by the parser + display).
export const US_STATES = new Map<string, string>([
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "Washington DC"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"],
  ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"],
  ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"],
  ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
]);

export type PackFilters = { category: string; label: string; city: string; state: string };

function titleCase(s: string): string {
  return s.trim().replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

/** Validate whitelisted dropdown values ("" = no filter, always valid).
 * Returns null when a value isn't recognized. */
export function validateFilters(rawCategory: unknown, rawState: unknown): PackFilters | null {
  const category = String(rawCategory ?? "").trim().toLowerCase();
  const state = String(rawState ?? "").trim().toUpperCase();
  if (category && !PACK_CATEGORIES.has(category)) return null;
  if (state && !US_STATES.has(state)) return null;
  return { category, label: category ? PACK_CATEGORIES.get(category)! : "", city: "", state };
}

function openAiKey(): string {
  return process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API || "";
}

// Ask a small model to extract {category, city, state} from free text. Returns
// null if no key is set or the call fails — the heuristic result still stands.
async function aiParse(text: string): Promise<{ category?: string; city?: string; state?: string } | null> {
  const key = openAiKey();
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Extract the local-business lead request into JSON. Return ONLY {\"category\":\"<business type, singular-ish plural like 'plumbers'>\",\"city\":\"<city or ''>\",\"state\":\"<2-letter US state code or ''>\"}. If the user says 'anywhere'/'nationwide', leave city and state ''." },
          { role: "user", content: text.slice(0, 300) },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as { category?: string; city?: string; state?: string };
    return parsed;
  } catch (err) {
    logger.warn({ err }, "pack request AI parse failed — using heuristic only");
    return null;
  }
}

/** Turn a free-text request ("roofers in Mobile, AL") into structured filters.
 * Heuristic scan first (no API cost); OpenAI fills gaps only when needed. */
export async function parseRequest(raw: string): Promise<PackFilters> {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // State detection, most-specific first so the preposition "in"/"or" is never
  // mistaken for a state code (that requires matching UPPERCASE in the ORIGINAL
  // text, which "in"/"or" aren't):
  //   1. "City, ST"      2. trailing "City ST"      3. full state name
  //   4. any bare uppercase 2-letter code (last resort)
  let state = "";
  const isCode = (c: string | undefined): c is string => !!c && US_STATES.has(c);
  const comma = text.match(/,\s*([A-Z]{2})\b/);
  const trailing = text.match(/\b([A-Z]{2})\s*$/);
  if (isCode(comma?.[1])) state = comma![1];
  else if (isCode(trailing?.[1])) state = trailing![1];
  if (!state) {
    // Full names, longest first so "West Virginia" wins over "Virginia".
    const names = [...US_STATES.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [code, name] of names) {
      if (new RegExp(`\\b${name}\\b`, "i").test(text)) { state = code; break; }
    }
  }
  if (!state) {
    for (const m of text.match(/\b[A-Z]{2}\b/g) ?? []) {
      if (US_STATES.has(m)) { state = m; break; }
    }
  }

  // Category: first whitelist term that appears in the text.
  let category = "", label = "";
  for (const [term, lab] of PACK_CATEGORIES) {
    if (lower.includes(term)) { category = term; label = lab; break; }
  }

  // City: the words between "in " and the state/end (best-effort).
  let city = "";
  const inMatch = text.match(/\bin\s+([a-zA-Z .'-]+?)(?:,|\s+in\s|\s+with\s|$)/i);
  if (inMatch) {
    let cand = inMatch[1].trim();
    // Drop a trailing state name/code if it got swept in.
    if (state) {
      cand = cand.replace(new RegExp(`\\b${state}\\b$`, "i"), "").trim();
      const full = US_STATES.get(state)!;
      cand = cand.replace(new RegExp(`${full}$`, "i"), "").trim();
    }
    if (cand && cand.length <= 40 && !US_STATES.has(cand.toUpperCase())) city = cand;
  }

  // Fall back to the model only when the heuristic missed the category.
  if (!category) {
    const ai = await aiParse(text);
    if (ai) {
      if (!state && ai.state) { const s = ai.state.toUpperCase(); if (US_STATES.has(s)) state = s; }
      if (!city && ai.city) city = ai.city.trim().slice(0, 40);
      if (ai.category) {
        const alc = ai.category.toLowerCase();
        for (const [term, lab] of PACK_CATEGORIES) {
          if (alc.includes(term) || term.includes(alc)) { category = term; label = lab; break; }
        }
        // Unknown-but-valid type: keep it as a custom ILIKE term.
        if (!category) {
          category = alc.replace(/[^a-z0-9 ]/g, "").trim().slice(0, 40);
          label = titleCase(ai.category);
        }
      }
    }
  }

  return {
    category,
    label: label || (category ? titleCase(category) : ""),
    city: city.slice(0, 60),
    state,
  };
}

/** Count deliverable leads for a filter set. MUST mirror the WHERE clause used
 * by /api/leads/pack-download so a quote never disagrees with fulfillment. */
export async function countPackLeads(f: Pick<PackFilters, "category" | "city" | "state">): Promise<number> {
  const [{ n }] = await db.select({ n: count() }).from(leads).where(packWhere(f));
  return Number(n);
}

/** The shared WHERE clause (also reused by pack-download and the worker snapshot). */
export function packWhere(f: Pick<PackFilters, "category" | "city" | "state">): SQL {
  const conditions: SQL[] = [isNull(leads.deletedAt)];
  if (f.category) conditions.push(ilike(leads.category, `%${f.category}%`));
  if (f.city) conditions.push(ilike(leads.address, `%${f.city}%`));
  if (/^[A-Z]{2}$/.test(f.state)) conditions.push(sql`address ~ ${"\\y" + f.state + "\\s+\\d{5}"}`);
  return and(...conditions)!;
}

/** Human name for receipts / emails, e.g. "500 Local Business Leads — Plumbers, Mobile, AL". */
export function packDisplayName(f: PackFilters, leadCount = LEAD_PACK.leadCount): string {
  const name = `${leadCount} Local Business Leads`;
  const parts = [f.label, f.city, f.state].map((p) => p.trim()).filter(Boolean);
  return parts.length ? `${name} — ${parts.join(", ")}` : name;
}

/** A location string for a Google Maps / AI search, e.g. "Mobile, AL" or "Alabama". */
export function locationString(f: Pick<PackFilters, "city" | "state">): string {
  if (f.city && f.state) return `${f.city}, ${f.state}`;
  if (f.city) return f.city;
  if (f.state) return US_STATES.get(f.state) ?? f.state;
  return "";
}
