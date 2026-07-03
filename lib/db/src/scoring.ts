// Lead scoring — shared by the API save route and the backfill script so the
// numbers never drift between "saved live" and "recomputed in bulk".
//
// Two different, deliberately opposite signals:
//   • score             — profile COMPLETENESS (has phone/email/website/social,
//                          good rating, lots of reviews). High = polished business.
//   • opportunityScore  — SALES OPPORTUNITY. High = weak online presence but
//                          reachable, i.e. a business that needs a website, SEO,
//                          ads, reputation management, or automation. This is the
//                          "money" data — the inverse intent of `score`.

export interface ScoreableLead {
  phone?: string | null;
  emails?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  twitter?: string | null;
  linkedin?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  category?: string | null;
}

// ---- Completeness score (unchanged behavior, 0-100) -------------------------
export function computeScore(lead: ScoreableLead): number {
  let score = 0;
  if (lead.phone) score += 20;
  if (lead.emails) score += 20;
  if (lead.website) score += 15;
  if (lead.facebook || lead.instagram || lead.twitter || lead.linkedin) score += 15;
  if (lead.rating != null && lead.rating >= 4.0) score += 10;
  if (lead.reviewCount != null && lead.reviewCount >= 50) score += 10;
  if (lead.category) score += 10;
  return score;
}

// Canonical weakness tags. Each maps to a service you can sell.
export const NEED_NO_WEBSITE = "No website";        // → website build
export const NEED_NO_SOCIAL = "No social";          // → social media setup
export const NEED_FEW_REVIEWS = "Few reviews";      // → reputation / review generation
export const NEED_LOW_RATING = "Low rating";        // → reputation management
export const NEED_HARD_TO_REACH = "Hard to reach";  // → caveat: no phone or email on file

export const ALL_NEEDS = [
  NEED_NO_WEBSITE,
  NEED_NO_SOCIAL,
  NEED_FEW_REVIEWS,
  NEED_LOW_RATING,
  NEED_HARD_TO_REACH,
] as const;

export interface OpportunityResult {
  opportunityScore: number; // 0-100, higher = better "money" lead
  needs: string[];          // weakness tags backing the score
}

// Signals from crawling the lead's website (the enrichment pass). Only meaningful
// when the business HAS a website — they grade how bad/old it is.
export interface EnrichmentSignals {
  siteLive?: boolean | null;      // website actually loads
  siteMobile?: boolean | null;    // has a mobile viewport meta (modern-ish)
  hasBooking?: boolean | null;    // online booking link detected
  sitePlatform?: string | null;   // builder fingerprint, e.g. "Wix", "GoDaddy"
  siteYear?: number | null;       // copyright year in footer (staleness signal)
}
export const NEED_DEAD_SITE = "Dead website";
export const NEED_OLD_SITE = "Outdated website";
export const NEED_NO_BOOKING = "No online booking";
export const NEED_DIY_SITE = "DIY website";

// Drag-and-drop builders that signal a cheap, self-made site with weak SEO — the
// prime "we'll build you a real one" upsell. More capable platforms (WordPress,
// Shopify, Squarespace, Webflow) are deliberately NOT flagged as DIY.
const DIY_PLATFORMS = new Set(["Wix", "GoDaddy", "Weebly", "Duda"]);
// A footer copyright this many years behind "now" reads as an abandoned site.
const STALE_SITE_YEARS = 3;

// ---- Opportunity score (0-100) ----------------------------------------------
// Weighting rationale:
//   • No website is the single biggest, easiest-to-sell gap            → 35
//   • No social presence                                               → 15
//   • Few/no reviews (can't be found / no proof) — graduated           → up to 15
//   • Weak or missing rating                                           → 15
//   • Reachable (phone OR email) — you can only sell to who you reach   → 20
// Unreachable leads keep their need signals but lose the +20, so they
// naturally rank below otherwise-identical reachable leads.
//
// NOT YET DETECTABLE from Google Maps scrape data, so deliberately excluded:
//   bad/old website quality, no online booking, no ads showing. These need a
// follow-up crawl/enrichment pass before they can be scored honestly.
export function computeOpportunity(lead: ScoreableLead, enrichment?: EnrichmentSignals): OpportunityResult {
  const needs: string[] = [];
  let opportunityScore = 0;

  const hasSocial = !!(lead.facebook || lead.instagram || lead.twitter || lead.linkedin);
  const reviews = lead.reviewCount ?? 0;

  if (!lead.website) {
    opportunityScore += 35;
    needs.push(NEED_NO_WEBSITE);
  } else if (enrichment) {
    // Business HAS a website — grade how bad/old it is (only after enrichment).
    if (enrichment.siteLive === false) {
      opportunityScore += 25;
      needs.push(NEED_DEAD_SITE);
    } else {
      // Outdated = no mobile viewport OR a copyright year several years stale.
      const staleYear =
        enrichment.siteYear != null &&
        new Date().getFullYear() - enrichment.siteYear >= STALE_SITE_YEARS;
      if (enrichment.siteMobile === false || staleYear) {
        opportunityScore += 15;
        needs.push(NEED_OLD_SITE);
      }
      // Cheap DIY builder = sellable even if the site is otherwise fine.
      if (enrichment.sitePlatform && DIY_PLATFORMS.has(enrichment.sitePlatform)) {
        opportunityScore += 8;
        needs.push(NEED_DIY_SITE);
      }
    }
    if (enrichment.hasBooking === false) {
      opportunityScore += 10;
      needs.push(NEED_NO_BOOKING);
    }
  }
  if (!hasSocial) {
    opportunityScore += 15;
    needs.push(NEED_NO_SOCIAL);
  }
  if (lead.reviewCount == null || reviews < 10) {
    opportunityScore += 15;
    needs.push(NEED_FEW_REVIEWS);
  } else if (reviews < 50) {
    opportunityScore += 8;
    needs.push(NEED_FEW_REVIEWS);
  }
  if (lead.rating == null || lead.rating < 4.0) {
    opportunityScore += 15;
    needs.push(NEED_LOW_RATING);
  }

  const reachable = !!(lead.phone || lead.emails);
  if (reachable) {
    opportunityScore += 20;
  } else {
    needs.push(NEED_HARD_TO_REACH);
  }

  return { opportunityScore: Math.min(100, opportunityScore), needs };
}

// ---- Demand score (0-100) ---------------------------------------------------
// "How much do members actually want this lead?" The number of DISTINCT members
// who independently extracted a business is the strongest demand signal — it
// means several people are chasing the same opportunity. Repeat extractions
// (same business pulled again) add a smaller bump.
export interface DemandInput {
  timesExtracted: number;   // total saves of this business
  distinctMembers: number;  // distinct members who extracted it
}
export function computeDemand({ timesExtracted, distinctMembers }: DemandInput): number {
  const repeats = Math.max(0, timesExtracted - distinctMembers);
  return Math.max(0, Math.min(100, distinctMembers * 30 + repeats * 5));
}

// ---- Value score (0-100) ----------------------------------------------------
// The single "most valuable lead" ranking: a lead is valuable when it both
// NEEDS your services (opportunity) AND is in DEMAND (members want it). Need is
// weighted a little higher because demand is sparse until members pile up.
export function computeValue(opportunityScore: number, demandScore: number): number {
  return Math.round(opportunityScore * 0.6 + demandScore * 0.4);
}
