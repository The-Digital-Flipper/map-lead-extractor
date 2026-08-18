/**
 * Website Audit Agent — fetches a lead's homepage and grades it A–F on the
 * things a local business needs to convert visitors: a clear headline, a strong
 * call-to-action, mobile readiness, a quote/contact form, a click-to-call
 * button, on-page trust signals, and a real SEO title. Every gap it finds is a
 * concrete sales hook.
 *
 * READ-ONLY with respect to the scrapers: it only reads the lead's website URL;
 * it never touches scraper code or the `leads` ingest.
 */
import type { WebsiteAudit, Quality, AuditGrade } from "@workspace/db";

export type AuditableLead = {
  website?: string | null;
  name?: string | null;
  category?: string | null;
  address?: string | null;
  // Optional signals already gathered by the enrichment crawler — used as a
  // fallback when we can't fetch the page live.
  siteMobile?: boolean | null;
  hasBooking?: boolean | null;
  sitePlatform?: string | null;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

async function fetchHtml(url: string, timeoutMs = 9000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html.slice(0, 500_000); // cap
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function firstMatch(re: RegExp, html: string): string | undefined {
  const m = re.exec(html);
  return m ? stripTags(m[1] ?? m[0]).slice(0, 200) : undefined;
}

function detectPlatform(html: string): string | undefined {
  const h = html.toLowerCase();
  if (h.includes("wix.com") || h.includes("_wix") || h.includes("wixstatic")) return "Wix";
  if (h.includes("godaddy") || h.includes("websitebuilder")) return "GoDaddy";
  if (h.includes("squarespace")) return "Squarespace";
  if (h.includes("shopify")) return "Shopify";
  if (h.includes("weebly")) return "Weebly";
  if (h.includes("wp-content") || h.includes("wordpress")) return "WordPress";
  return undefined;
}

const CTA_STRONG = /(get|request|claim)\s+(a\s+)?(free\s+)?(quote|estimate|consultation)|book\s+(now|online|a\s+(call|appointment))|schedule\s+(now|online|a\s+(call|appointment))/i;
const CTA_OK = /(contact\s+us|call\s+(us\s+)?now|get\s+started|request\s+(info|a\s+callback))/i;

function ctaQuality(html: string): Quality {
  if (CTA_STRONG.test(html)) return "strong";
  if (CTA_OK.test(html)) return "ok";
  if (/<(a|button)[^>]*>[^<]*(call|contact|quote|email|get)[^<]*<\/(a|button)>/i.test(html)) return "weak";
  return "none";
}

function seoTitleQuality(title: string | undefined, lead: AuditableLead): Quality {
  if (!title) return "none";
  const len = title.length;
  const t = title.toLowerCase();
  const hasBrand = !!lead.name && t.includes((lead.name ?? "").toLowerCase().split(" ")[0]);
  const hasCategory = !!lead.category && t.includes((lead.category ?? "").toLowerCase().split(" ")[0]);
  const genericOnly = /^(home|welcome|untitled|index|my site|website)\b/i.test(title.trim());
  if (genericOnly || len < 10) return "weak";
  if (len >= 30 && len <= 65 && (hasCategory || hasBrand)) return "strong";
  if (len >= 15) return "ok";
  return "weak";
}

function detectServiceArea(text: string): string | undefined {
  const m =
    /(?:serving|proudly serving|areas we serve|service area[s]?:?)\s+([A-Z][A-Za-z.,&'\- ]{3,60})/i.exec(text) ||
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*[A-Z]{2})\b/.exec(text);
  return m ? m[1].trim().replace(/\s+/g, " ").slice(0, 60) : undefined;
}

function gradeFromScore(score: number): AuditGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Audit a lead's website. No website → the strongest opportunity of all
 * (grade F, health 0). A reachable site is scored on 7 weighted checks.
 */
export async function auditWebsite(lead: AuditableLead): Promise<WebsiteAudit> {
  const raw = (lead.website ?? "").trim();
  if (!raw) {
    return {
      hasWebsite: false,
      reachable: false,
      ctaQuality: "none",
      mobileReady: false,
      hasQuoteForm: false,
      hasCallButton: false,
      hasTrustSignals: false,
      seoTitleQuality: "none",
      grade: "F",
      score: 0,
      findings: [
        "No website at all — invisible to anyone searching online",
        "No way to capture quote requests",
        "No mobile presence",
      ],
      summary: "No website — the single biggest opportunity. A simple site would put them ahead of competitors who also skimp online.",
    };
  }

  const url = normalizeUrl(raw);
  const html = await fetchHtml(url);
  if (html == null) {
    // Couldn't load — that itself is a finding (dead/slow/broken site).
    return {
      hasWebsite: true,
      url,
      reachable: false,
      ctaQuality: "none",
      mobileReady: lead.siteMobile ?? false,
      hasQuoteForm: false,
      hasCallButton: false,
      hasTrustSignals: false,
      seoTitleQuality: "none",
      platform: lead.sitePlatform ?? undefined,
      grade: "F",
      score: 10,
      findings: ["Website did not load (dead, slow, or broken) — visitors bounce"],
      summary: "Their website failed to load — a broken or dead site is worse than none. Prime rebuild candidate.",
    };
  }

  const text = stripTags(html);
  const title = firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const headline = firstMatch(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html);
  const mobileReady = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasCallButton = /href=["']tel:/i.test(html);
  const hasForm = /<form[\s>]/i.test(html);
  const formLooksLikeQuote = /(quote|estimate|contact|get started|request|free|book|schedule|appointment|message)/i.test(
    (/(<form[\s\S]{0,1500}?<\/form>)/i.exec(html)?.[1] ?? "") + " " + (headline ?? ""),
  );
  const hasQuoteForm = hasForm && formLooksLikeQuote;
  const hasTrustSignals = /(review|testimonial|★|5[\s-]?star|as seen|rated|google rating|bbb|licensed|insured|accredited)/i.test(text);
  const cta = ctaQuality(html);
  const seoQ = seoTitleQuality(title, lead);
  const serviceArea = detectServiceArea(text);
  const platform = detectPlatform(html) ?? lead.sitePlatform ?? undefined;

  // ── Weighted site-health score (higher = healthier site) ──────────────────
  let score = 20; // baseline for a page that loads
  const findings: string[] = [];
  if (mobileReady) score += 12; else findings.push("Not mobile-friendly (no mobile viewport) — most local searches are on phones");
  if (hasQuoteForm) score += 16; else findings.push("No quote/contact form — visitors can't request a quote on the site");
  if (hasCallButton) score += 12; else findings.push("No click-to-call button — mobile visitors can't tap to call");
  if (cta === "strong") score += 16;
  else if (cta === "ok") score += 9;
  else if (cta === "weak") { score += 3; findings.push("Weak call-to-action — nothing tells visitors what to do next"); }
  else findings.push("No clear call-to-action — visitors don't know how to become a customer");
  if (hasTrustSignals) score += 10; else findings.push("No visible reviews or trust badges — nothing builds confidence");
  if (seoQ === "strong") score += 12;
  else if (seoQ === "ok") score += 7;
  else { score += 0; findings.push("Weak or generic page title — hurts Google ranking"); }
  if (headline) score += 6; else findings.push("No clear headline — visitors can't tell what the business does");
  if (platform && /^(Wix|GoDaddy|Weebly)$/.test(platform)) findings.push(`Built on ${platform} (DIY builder) — looks generic and templated`);
  if (!serviceArea) findings.push("No service-area text — Google can't tell where they operate");

  score = Math.max(0, Math.min(100, score));
  const grade = gradeFromScore(score);

  const summary =
    grade === "A" || grade === "B"
      ? `Solid site (grade ${grade}). Best angles: ${findings.slice(0, 2).join("; ") || "reviews & SEO polish"}.`
      : `Grade ${grade} site with ${findings.length} clear gap${findings.length === 1 ? "" : "s"} — strong candidate for ${hasQuoteForm ? "an SEO/reviews push" : "a rebuild + lead capture"}.`;

  return {
    hasWebsite: true,
    url,
    reachable: true,
    homepageHeadline: headline,
    ctaQuality: cta,
    mobileReady,
    hasQuoteForm,
    hasCallButton,
    hasTrustSignals,
    seoTitle: title,
    seoTitleQuality: seoQ,
    serviceArea,
    platform,
    grade,
    score,
    findings,
    summary,
  };
}
