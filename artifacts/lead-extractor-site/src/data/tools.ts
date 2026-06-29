// Free interactive tools — each is a standalone, indexable landing page with
// a deterministic client-side calculator (no AI, no spam), explanatory content,
// FAQ, and JSON-LD. Rendered by src/pages/tool.tsx and prerendered by
// prerender.mjs. These are linkable/shareable assets that earn backlinks.

import type { ContentSection } from "./landing-pages";

export interface ToolFaq {
  q: string;
  a: string;
}

export interface Tool {
  slug: string;
  /** Which calculator widget to render. */
  kind: "roi" | "leadValue" | "agencyPricing" | "leadScore" | "subjectTester";
  /** Short name for cards/nav. */
  name: string;
  /** One-line value prop. */
  tagline: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string[];
  /** Long-form explanatory content (methodology, how-to, examples). */
  body: ContentSection[];
  faq: ToolFaq[];
  relatedTools: string[];
  relatedPosts: string[];
}

export const tools: Tool[] = [
  {
    slug: "roi-calculator",
    kind: "roi",
    name: "Google Maps ROI Calculator",
    tagline: "See the return on extracting leads instead of buying or hand-building lists.",
    h1: "Google Maps Lead Generation ROI Calculator",
    metaTitle: "Google Maps ROI Calculator | Map Lead Extractor",
    metaDescription:
      "Free ROI calculator for Google Maps lead generation. Estimate revenue, cost savings, and return from extracting local business leads. No signup required.",
    intro: [
      "Use this free calculator to estimate the return on investment of generating leads from Google Maps. Enter how many leads you pull each month, your conversion rate, and your average deal value to see projected new revenue, the hours you save versus manual research, and your overall ROI.",
      "It runs entirely in your browser — nothing is sent anywhere, and there is no signup. Adjust the inputs to model best-case, worst-case, and realistic scenarios before you commit budget to a prospecting channel.",
    ],
    body: [
      { type: "h2", text: "How the ROI calculation works" },
      { type: "p", text: "The calculator turns four simple inputs into the numbers that actually matter for a prospecting decision: pipeline created, revenue won, time saved, and net return. It is deliberately transparent so you can sanity-check every figure." },
      { type: "ul", items: [
        "New customers = leads per month × conversion rate.",
        "New monthly revenue = new customers × average deal value.",
        "Time saved = leads per month × minutes saved per lead vs. manual copy-paste.",
        "ROI % = (monthly revenue − monthly cost) ÷ monthly cost.",
      ] },
      { type: "h2", text: "Why extraction usually beats manual research and bought lists" },
      { type: "p", text: "Hand-copying business name, phone, website, and rating from each Google Maps listing takes roughly 30–60 seconds per record once you include checking the website for an email. Extraction collapses that to seconds for an entire result set, and unlike a purchased list, the data is live and exactly targeted to the cities and niches you choose." },
      { type: "tip", text: "Run the numbers with a conservative conversion rate first. Even a 1–2% cold conversion on a few hundred extracted leads usually clears the cost bar comfortably." },
      { type: "h2", text: "Example" },
      { type: "p", text: "Say you extract 500 leads per month, convert 2% into customers, and your average deal is worth $1,500. That is 10 new customers and $15,000 in new monthly revenue, plus about 4 hours saved versus manual research — a strong return against the cost of a prospecting tool." },
    ],
    faq: [
      { q: "Is this ROI calculator free?", a: "Yes. It is completely free, requires no signup, and runs entirely in your browser. Nothing you enter is stored or sent to a server." },
      { q: "What conversion rate should I use?", a: "For cold outreach to extracted local-business leads, a realistic range is often 1–5% depending on your offer and follow-up. Start conservative (1–2%) and adjust as you gather your own data." },
      { q: "Does it account for time saved?", a: "Yes. It estimates the hours saved each month versus manually copying each listing's details, using a configurable minutes-per-lead figure." },
    ],
    relatedTools: ["lead-value-calculator", "agency-pricing-calculator"],
    relatedPosts: ["how-to-scrape-google-maps-leads", "where-to-buy-local-business-leads"],
  },
  {
    slug: "lead-value-calculator",
    kind: "leadValue",
    name: "Lead Value Calculator",
    tagline: "Work out what a single lead is worth and your maximum cost per lead.",
    h1: "Lead Value Calculator: What Is a Lead Worth?",
    metaTitle: "Lead Value Calculator | Map Lead Extractor",
    metaDescription:
      "Free lead value calculator. Find out what each lead is worth and your maximum cost per lead based on close rate and customer value. No signup.",
    intro: [
      "Before you spend on any lead source, you need to know what a lead is actually worth to your business. This free calculator turns your close rate, average customer value, and gross margin into a clear value-per-lead figure and a maximum cost-per-lead you can afford to pay.",
      "It is a fast way to decide whether buying leads, running ads, or extracting them yourself makes financial sense. Everything is computed in your browser with no signup.",
    ],
    body: [
      { type: "h2", text: "The formula behind lead value" },
      { type: "p", text: "A lead is worth a fraction of a customer — specifically, the value of a customer multiplied by the probability that a lead becomes one. Factoring in margin keeps you honest about profit rather than revenue." },
      { type: "ul", items: [
        "Value per lead = average customer value × gross margin × close rate.",
        "Maximum cost per lead = value per lead ÷ your target return multiple.",
        "Customers from a batch = number of leads × close rate.",
      ] },
      { type: "h2", text: "How to use the result" },
      { type: "p", text: "If a lead is worth $40 to you and a vendor sells leads at $5 each, the economics are strongly in your favor. If your own extraction effectively costs pennies per lead, almost any reasonable close rate produces a healthy return — which is why self-serve extraction is so attractive for local B2B." },
      { type: "tip", text: "Use gross margin, not revenue, for value per lead. A $2,000 deal at 30% margin is worth $600 in profit, and your lead value should reflect that." },
      { type: "h2", text: "Example" },
      { type: "p", text: "With a $1,200 average customer value, 50% gross margin, and a 3% close rate, each lead is worth about $18. At a 4x target return you would pay up to roughly $4.50 per lead — a useful ceiling when comparing lead sources." },
    ],
    faq: [
      { q: "What is a good cost per lead?", a: "A good cost per lead is well below your value per lead. Many teams target a 3–5x return, so if a lead is worth $20, paying $4–$7 is reasonable. The calculator gives you the exact ceiling for your numbers." },
      { q: "Should I use revenue or profit for customer value?", a: "Use profit (revenue × gross margin). Valuing leads on revenue overstates what you can afford to spend and can quietly make a channel unprofitable." },
      { q: "Is the calculator free?", a: "Yes, it is free, needs no signup, and runs entirely in your browser." },
    ],
    relatedTools: ["roi-calculator", "agency-pricing-calculator"],
    relatedPosts: ["where-to-buy-local-business-leads", "cold-email-from-google-maps-leads"],
  },
  {
    slug: "agency-pricing-calculator",
    kind: "agencyPricing",
    name: "Agency Pricing Calculator",
    tagline: "Price a retainer that hits your target profit margin.",
    h1: "Agency Pricing Calculator: Set a Profitable Retainer",
    metaTitle: "Agency Pricing Calculator | Map Lead Extractor",
    metaDescription:
      "Free agency pricing calculator. Set a monthly retainer that hits your target profit margin based on delivery hours and costs. No signup required.",
    intro: [
      "Underpricing is the fastest way to kill an agency. This free calculator helps you set a monthly retainer that covers your delivery cost and hits the profit margin you actually want, based on the hours a client takes to service, your blended hourly cost, and any tools or ad spend you carry.",
      "It is built for SMMA, SEO, web design, and lead-gen agencies pricing local-business clients. Everything runs in your browser, with no signup.",
    ],
    body: [
      { type: "h2", text: "How the pricing math works" },
      { type: "p", text: "A sustainable retainer starts from cost, not from what you hope a client will pay. The calculator builds your price up from delivery cost and the margin you set." },
      { type: "ul", items: [
        "Monthly delivery cost = hours per client × blended hourly cost + monthly tool/ad cost.",
        "Recommended retainer = delivery cost ÷ (1 − target margin).",
        "Monthly profit = retainer − delivery cost.",
      ] },
      { type: "h2", text: "Why margin-first pricing wins" },
      { type: "p", text: "Pricing from a target margin guarantees every client is profitable before you sign them. It also makes it obvious when a client is too time-intensive for their budget, so you can raise the price, tighten scope, or walk away — instead of discovering the problem months later." },
      { type: "tip", text: "Include a realistic number for tools and ad management overhead. Forgetting recurring software and ad-platform costs is the most common reason a retainer that looks profitable is not." },
      { type: "h2", text: "Example" },
      { type: "p", text: "If a client takes 12 hours a month, your blended cost is $40/hour, and you carry $150 in tools, delivery costs $630. To hit a 60% margin, you would price the retainer at about $1,575 — leaving roughly $945 in monthly profit." },
    ],
    faq: [
      { q: "What profit margin should an agency target?", a: "Many healthy service agencies target 50–70% gross margin on delivery. The right number depends on your overhead and growth goals; the calculator lets you model any target." },
      { q: "Should retainers be hourly or fixed?", a: "Most local-business retainers are fixed monthly fees, but you should still price them from an estimate of delivery hours so the fixed fee stays profitable as scope evolves." },
      { q: "Is this tool free?", a: "Yes. It is free, requires no signup, and computes everything locally in your browser." },
    ],
    relatedTools: ["roi-calculator", "lead-value-calculator"],
    relatedPosts: ["lead-generation-for-marketing-agencies", "lead-generation-for-web-designers"],
  },
  {
    slug: "lead-quality-score",
    kind: "leadScore",
    name: "Lead Quality Score Calculator",
    tagline: "Score how good a local business is as a prospect before you reach out.",
    h1: "Lead Quality & Opportunity Score Calculator",
    metaTitle: "Lead Quality Score Calculator | Map Lead Extractor",
    metaDescription:
      "Free lead quality & opportunity score calculator. Rate any local business as a prospect from its website, rating, reviews, and listing. No signup.",
    intro: [
      "Not every local business is an equally good prospect. This free calculator turns the signals you can see on a Google Maps listing — whether the business has a website, its star rating, review count, and whether the profile is claimed — into a single 0–100 opportunity score, so you can prioritize the leads most likely to need (and buy) your services.",
      "It is built for agencies, web designers, and SaaS sellers who want to work the warmest prospects first. Scoring is transparent and runs entirely in your browser — no signup, nothing stored.",
    ],
    body: [
      { type: "h2", text: "How the opportunity score works" },
      { type: "p", text: "The score rewards the gaps you can fix. A business with no website, a weak reputation, or an unclaimed profile is a higher-opportunity prospect for marketing, web, and reputation services than one that already has everything dialed in. Each signal contributes points toward a 0–100 total." },
      { type: "ul", items: [
        "No website (or an outdated one) — the single strongest buying signal for web and SEO services.",
        "Low review count — room for a review-generation or reputation offer.",
        "Mediocre star rating — a clear reputation-management angle.",
        "Unclaimed or unverified listing — an easy Google Business Profile win.",
        "Not running ads — an opening for paid-acquisition services.",
      ] },
      { type: "h2", text: "How to use the score" },
      { type: "p", text: "After extracting a batch of leads with Map Lead Extractor, score the borderline ones to decide where to spend your outreach time. A high opportunity score means an obvious, nameable problem you can lead your pitch with; a low score usually means the business is already well-served and harder to win." },
      { type: "tip", text: "Pair this with the website and review-count columns in your exported CSV. Sort by opportunity score and work top-down — your reply rate climbs when every first line names a real gap." },
      { type: "h2", text: "Example" },
      { type: "p", text: "A plumber with no website, a 3.7 rating, 18 reviews, and an unclaimed listing scores very high — a near-ideal prospect for a web designer or local-SEO agency. A competitor with a modern site, 4.9 stars, 400 reviews, and active ads scores low: already sorted, and a tougher sell." },
    ],
    faq: [
      { q: "What makes a local business a good prospect?", a: "Visible, fixable gaps: no website or a dated one, few or poor reviews, an unclaimed Google Business Profile, or no advertising. Each is a concrete problem you can solve, which makes outreach relevant and easier to convert." },
      { q: "Is the lead score based on AI?", a: "No — it is a transparent, rules-based score you can see and adjust. Every input maps to a clear point value, so you always know why a prospect scored the way it did." },
      { q: "Is the tool free?", a: "Yes. It is free, requires no signup, and runs entirely in your browser. Nothing you enter is stored or sent anywhere." },
    ],
    relatedTools: ["lead-value-calculator", "roi-calculator"],
    relatedPosts: ["how-to-find-businesses-with-no-website", "lead-generation-for-web-designers"],
  },
  {
    slug: "email-subject-line-tester",
    kind: "subjectTester",
    name: "Cold Email Subject Line Tester",
    tagline: "Score a cold email subject line for opens and deliverability.",
    h1: "Cold Email Subject Line Tester",
    metaTitle: "Cold Email Subject Line Tester | Map Lead Extractor",
    metaDescription:
      "Free cold email subject line tester. Score any subject for length, spam triggers, personalization, and deliverability. Get instant tips. No signup.",
    intro: [
      "Your subject line decides whether a cold email gets opened or ignored. Paste any subject line below and this free tool scores it on the factors that actually move open rates and protect deliverability — length, spam-trigger words, personalization, capitalization, and punctuation — then gives you specific fixes.",
      "It is perfect for the outreach you run after extracting leads from Google Maps. Everything is analyzed in your browser, with no signup and nothing stored.",
    ],
    body: [
      { type: "h2", text: "What the tester checks" },
      { type: "p", text: "Cold email open rates live and die on a few well-understood factors. The tester scores each one and explains what to change." },
      { type: "ul", items: [
        "Length — short subjects (about 3–7 words / under ~50 characters) usually win, especially on mobile.",
        "Spam triggers — words like 'free', 'guarantee', or '$$$' hurt deliverability and trust.",
        "Personalization — a token like a first name or city signals relevance and lifts opens.",
        "Capitalization — ALL CAPS reads as shouting and trips spam filters.",
        "Punctuation — multiple exclamation or question marks look like spam.",
      ] },
      { type: "h2", text: "Why subject lines matter even more in cold outreach" },
      { type: "p", text: "When you reach a prospect who has never heard of you, the subject is your entire first impression and your deliverability gatekeeper at once. A subject that lands in spam never gets a chance, and a generic one gets archived unread. Small, specific, personalized subjects consistently outperform clever or salesy ones." },
      { type: "tip", text: "Reference something real about the business — its city, niche, or a visible gap like a missing website. Specificity beats cleverness in cold outreach almost every time." },
      { type: "h2", text: "Example" },
      { type: "p", text: "“FREE WEBSITE AUDIT!!!” scores poorly: all caps, a spam-trigger word, and triple punctuation. “Quick idea for {{company}}'s Google listing” scores well: short, personalized, specific, and clean — far more likely to be opened." },
    ],
    faq: [
      { q: "What's a good cold email subject line length?", a: "Aim for roughly 3–7 words and under about 50 characters so it isn't truncated on mobile. Short, specific subjects almost always beat long or clever ones in cold outreach." },
      { q: "Which words trigger spam filters?", a: "Words and symbols associated with promotions — 'free', 'guarantee', 'act now', 'cash', '$$$', and excessive punctuation or all caps — can hurt deliverability. The tester flags the ones it finds in your subject." },
      { q: "Is the subject line tester free?", a: "Yes. It is free, needs no signup, and analyzes your subject line entirely in your browser without storing or sending it anywhere." },
    ],
    relatedTools: ["lead-value-calculator", "roi-calculator"],
    relatedPosts: ["cold-email-from-google-maps-leads", "how-to-extract-emails-from-google-maps"],
  },
];

export function getTool(slug: string): Tool | undefined {
  return tools.find((t) => t.slug === slug);
}
