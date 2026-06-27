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
export function computeOpportunity(lead: ScoreableLead): OpportunityResult {
  const needs: string[] = [];
  let opportunityScore = 0;

  const hasSocial = !!(lead.facebook || lead.instagram || lead.twitter || lead.linkedin);
  const reviews = lead.reviewCount ?? 0;

  if (!lead.website) {
    opportunityScore += 35;
    needs.push(NEED_NO_WEBSITE);
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

  return { opportunityScore, needs };
}
