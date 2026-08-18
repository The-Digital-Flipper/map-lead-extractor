/**
 * Offer Generator Agent — picks the single best offer to lead with for a given
 * lead, from a fixed catalog, using the website audit + lead signals. Returns a
 * reason, a suggested price band, and runner-up alternatives. Deterministic (no
 * AI bill); the message writer turns the chosen offer into copy.
 */
import type { OfferKey, OfferRec, WebsiteAudit } from "@workspace/db";

export type OfferableLead = {
  name?: string | null;
  category?: string | null;
  website?: string | null;
  rating?: string | number | null;
  reviewCount?: number | null;
  hasBooking?: boolean | null;
  runsAds?: boolean | null;
  highTicket?: boolean | null;
};

const CATALOG: Record<OfferKey, { label: string; low: number; high: number; recurring: boolean }> = {
  "website-rebuild": { label: "Website rebuild", low: 1500, high: 5000, recurring: false },
  seo: { label: "Local SEO", low: 500, high: 1500, recurring: true },
  gbp: { label: "Google Business Profile optimization", low: 300, high: 900, recurring: false },
  "missed-call-textback": { label: "Missed-call text-back", low: 150, high: 400, recurring: true },
  "ai-chatbot": { label: "AI website chatbot", low: 200, high: 600, recurring: true },
  "booking-system": { label: "Online booking system", low: 300, high: 1200, recurring: false },
  "ads-management": { label: "Google/Facebook ads management", low: 800, high: 2500, recurring: true },
  "lead-system": { label: "Done-for-you lead system", low: 500, high: 2000, recurring: true },
};

function label(k: OfferKey): string {
  return CATALOG[k].label;
}

/** Choose the primary offer + ranked alternatives. */
export function recommendOffer(lead: OfferableLead, audit: WebsiteAudit): OfferRec {
  const reviews = lead.reviewCount ?? 0;
  const rating = lead.rating != null ? Number(lead.rating) : null;

  // Build a scored candidate list; highest score wins, next two are alternates.
  const scored: { key: OfferKey; score: number; reason: string }[] = [];
  const add = (key: OfferKey, score: number, reason: string) => scored.push({ key, score, reason });

  if (!audit.hasWebsite) {
    add("website-rebuild", 100, "They have no website at all — a clean, mobile site with a quote form is the fastest win and puts them ahead of competitors.");
    add("gbp", 70, "With no site, their Google Business Profile is their storefront — optimizing it drives calls immediately.");
    add("lead-system", 55, "No web presence means no inbound — a done-for-you lead system fills the gap while the site is built.");
  } else if (!audit.reachable || audit.grade === "F") {
    add("website-rebuild", 95, "Their site is broken or grade-F — a rebuild with real calls-to-action recovers visitors they're losing today.");
    add("seo", 60, "A rebuilt site needs SEO to actually rank and pull traffic.");
  } else {
    // Site works — pick the biggest single gap.
    if (!audit.hasQuoteForm) add("lead-system", 82, "Their site has no quote/contact form — a lead-capture system turns existing visitors into booked jobs.");
    if (!audit.hasCallButton) add("missed-call-textback", 74, "No click-to-call and likely missed calls — a missed-call text-back captures the leads they drop.");
    if (!lead.hasBooking) add("booking-system", 68, "No online booking — an appointment/booking system lets customers self-schedule 24/7.");
    if (audit.ctaQuality === "none" || audit.ctaQuality === "weak") add("website-rebuild", 66, "Weak calls-to-action — a conversion-focused rebuild lifts the leads the current site wastes.");
    if (audit.seoTitleQuality === "none" || audit.seoTitleQuality === "weak") add("seo", 64, "Thin on-page SEO — local SEO gets them found for the searches that matter.");
    if (!audit.hasTrustSignals || (rating != null && rating < 4.2)) add("gbp", 60, "Few visible reviews/trust signals — a reviews + Google Business push builds credibility and ranking.");
    add("ai-chatbot", 48, "An AI chatbot answers visitors instantly and books them while the owner is on a job.");
  }

  if (reviews < 15) {
    const g = scored.find((s) => s.key === "gbp");
    if (g) g.score += 10; else add("gbp", 58, "Very few reviews — a Google Business Profile + reviews campaign is an easy credibility win.");
  }
  if (lead.runsAds) {
    add("ads-management", 78, "They already run ads (real budget) — taking over ads management is a warm, high-retainer offer.");
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0] ?? { key: "lead-system" as OfferKey, score: 50, reason: "A done-for-you lead system is a safe, broadly useful first offer." };
  const alternatives = scored
    .slice(1, 3)
    .filter((s) => s.key !== top.key)
    .map((s) => ({ offer: s.key, label: label(s.key) }));

  const meta = CATALOG[top.key];
  return {
    offer: top.key,
    label: meta.label,
    reason: top.reason,
    priceLow: meta.low,
    priceHigh: meta.high,
    recurring: meta.recurring,
    alternatives,
  };
}

/**
 * Estimate the deal value (whole dollars) this lead is worth to the owner —
 * used for pipeline math. Blends the chosen offer's price band with signals
 * that a lead is bigger money (high-ticket, runs ads, lots of reviews).
 */
export function estimateDealValue(lead: OfferableLead, offer: OfferRec): number {
  let base = Math.round((offer.priceLow + offer.priceHigh) / 2);
  // Recurring retainers are worth more over the life of the client — value the
  // first 6 months so pipeline math reflects real revenue.
  if (offer.recurring) base = Math.round(base * 6);
  let mult = 1;
  if (lead.highTicket) mult += 0.6;
  if (lead.runsAds) mult += 0.3;
  if ((lead.reviewCount ?? 0) > 100) mult += 0.2;
  return Math.round(base * mult);
}
