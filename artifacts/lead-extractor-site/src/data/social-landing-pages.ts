// High-converting landing pages built for social traffic. Each variant is a
// distinct sales angle on the same $29 lead-pack offer, rendered by
// pages/lp.tsx at /go/:slug. The admin Social tab lists these with copy-link
// and ready-made post captions, so keep this file the single source of truth
// for both sides.

export interface SocialLandingPage {
  slug: string;
  /** Short name shown in the admin list. */
  name: string;
  emoji: string;
  /** One-line description of the angle, shown to the admin only. */
  angle: string;
  seoTitle: string;
  seoDescription: string;
  /** Small animated pill above the headline. */
  badge: string;
  /** Headline split so the middle segment renders in brand green. */
  headline: { pre: string; highlight: string; post: string };
  subhead: string;
  ctaLabel: string;
  /** Three trust chips under the hero CTA. */
  chips: [string, string, string];
  /** Put the buy/sample widget directly under the hero (proof-first angles). */
  sampleFirst: boolean;
  finalHeadline: string;
  finalSubhead: string;
  /** Ready-made social captions; the admin UI appends the tracked link. */
  captions: string[];
}

export const SOCIAL_LANDING_PAGES: SocialLandingPage[] = [
  {
    slug: "free-leads",
    name: "Free Sample",
    emoji: "🎁",
    angle: "Proof-first: shows 5 real leads free before asking for a dime — best for cold audiences.",
    seoTitle: "See 5 Real Local Business Leads Free — No Card, No Catch",
    seoDescription:
      "Pick an industry and city and instantly preview 5 real local business leads with ratings and websites. Unlock full phone + email free. Upgrade to 100 for $29 only if you love them.",
    badge: "5 free leads — no credit card",
    headline: {
      pre: "See ",
      highlight: "5 Real Leads From Your Market",
      post: " Before You Spend a Dime",
    },
    subhead:
      "Type your industry and city below and we'll pull 5 real local businesses — names, ratings, websites — right on this page. Like what you see? The other 95 cost less than a lunch.",
    ctaLabel: "Show Me 5 Free Leads",
    chips: ["No credit card required", "Real leads, not samples from 2019", "Takes about 20 seconds"],
    sampleFirst: true,
    finalHeadline: "Still scrolling? The leads are free to look at.",
    finalSubhead: "Preview 5 real businesses from your exact market. Worst case, you leave with 5 free leads.",
    captions: [
      "We got tired of \"trust me, the leads are good.\" So now you can see 5 real leads from your city — free, no card, right on the page. If they're not businesses you'd actually call, close the tab. 👇",
      "Free test: pick your industry + city, and we'll show you 5 real local business leads on the spot. No signup wall. See for yourself 👇",
    ],
  },
  {
    slug: "deal",
    name: "$29 Direct Offer",
    emoji: "💰",
    angle: "Straight price-anchor offer: 100 human-reviewed leads for $29 — best for warm/retargeted audiences.",
    seoTitle: "100 Ready-to-Call Local Business Leads — $29, Delivered Today",
    seoDescription:
      "100 human-reviewed local business leads with phone, email, address & social links, emailed as a clean CSV within hours. One-time $29 — refund if we come up short.",
    badge: "$29 one-time — was $99",
    headline: {
      pre: "100 Ready-to-Call Local Leads for ",
      highlight: "$29",
      post: " — In Your Inbox Today",
    },
    subhead:
      "Phone, email, address and social links on every lead. A real human reviews the list before it ships, and if we come up short you get the difference back automatically.",
    ctaLabel: "Get My 100 Leads — $29",
    chips: ["One-time payment — no subscription", "CSV emailed within hours", "Refund if we come up short"],
    sampleFirst: false,
    finalHeadline: "29 bucks. 100 leads. Tonight.",
    finalSubhead: "That's $0.29 per human-reviewed lead — one closed deal pays for the next 3 years of packs.",
    captions: [
      "Quick math: 100 local business leads, human-reviewed, with phone + email = $29. One closed client = 10-100x that back. The list hits your inbox in hours 👇",
      "We sell lead lists for $29 that agencies used to charge $500 to build. 100 local businesses, phone + email + socials, clean CSV, delivered today. Grab your market before someone else does 👇",
    ],
  },
  {
    slug: "stop-scraping",
    name: "Stop Scraping",
    emoji: "⏱️",
    angle: "Pain-agitate: aimed at people burning nights scraping Maps or copy-pasting into spreadsheets.",
    seoTitle: "Stop Spending Nights Scraping Google Maps for Leads",
    seoDescription:
      "You could spend another weekend copy-pasting business names into a spreadsheet — or get 100 scored, human-reviewed local leads with phone & email for $29, delivered in hours.",
    badge: "Your weekend called — it wants out of the spreadsheet",
    headline: {
      pre: "Stop Spending Nights ",
      highlight: "Copy-Pasting Google Maps",
      post: " Into Spreadsheets",
    },
    subhead:
      "Scraping, cleaning, hunting emails, fixing broken numbers — that's 6+ hours per list, and half the entries are dead. We hand you the finished list: 100 verified local leads, ready to call, for $29.",
    ctaLabel: "Skip the Grind — Get the List",
    chips: ["Saves 6+ hours per list", "Dead listings already removed", "Import into any CRM in one click"],
    sampleFirst: false,
    finalHeadline: "Your time is worth more than $5/hour",
    finalSubhead: "That's what DIY scraping pays you. Get the finished, human-reviewed list for $29 and spend tonight actually selling.",
    captions: [
      "POV: it's 1am and you're still copy-pasting business names from Google Maps into a spreadsheet. Half the numbers will be dead anyway. We'll hand you 100 verified local leads — phone, email, socials — for $29, delivered in hours. Go to bed 👇",
      "DIY lead scraping: 6 hours, dead numbers, missing emails, one banned IP. Us: 100 human-reviewed local leads in your inbox by tonight for $29. Pick one 👇",
    ],
  },
  {
    slug: "agency",
    name: "Agency / Freelancer",
    emoji: "🚀",
    angle: "Audience-targeted: agencies, web designers & freelancers who need a client pipeline.",
    seoTitle: "Land Your Next Agency Client This Week — Local Leads That Answer",
    seoDescription:
      "For agencies, web designers & freelancers: 100 local businesses in your niche with phone, email and social links — scored so you call the best prospects first. $29, delivered in hours.",
    badge: "Built for agencies & freelancers",
    headline: {
      pre: "Your Next Client Is on This List — ",
      highlight: "100 Local Businesses",
      post: " That Actually Answer",
    },
    subhead:
      "Web designers, SMMA, SEO, anyone selling to local businesses: pick your niche and city, and get 100 prospects with phone, email and socials — scored so you know exactly who to call first.",
    ctaLabel: "Build My Prospect List",
    chips: ["Scored — best prospects first", "See who has no website or weak reviews", "Your exact niche & city"],
    sampleFirst: true,
    finalHeadline: "One client covers this list 100 times over",
    finalSubhead: "Stop waiting for referrals. 100 targeted local prospects for $29 — preview 5 free before you buy.",
    captions: [
      "Agency owners: your next client is a local business with no website and a 3.9 rating — and they're on a list we can build you today. 100 niche prospects, phone + email, scored so you call the hottest first. Preview 5 free 👇",
      "Freelancers: stop waiting for referrals. Pick your niche + city, preview 5 real prospects free, then get all 100 with phone + email for $29. Pipeline problem, solved by lunch 👇",
    ],
  },
  {
    slug: "tonight",
    name: "Speed / Tonight",
    emoji: "⚡",
    angle: "Urgency: order now, start calling tonight — best for action-taker hooks and re-engagement.",
    seoTitle: "Order Leads Now, Start Calling Tonight — 100 Local Leads in Hours",
    seoDescription:
      "No demos, no onboarding calls, no subscriptions. Order 100 human-reviewed local business leads for $29 and the CSV is in your inbox within hours — usually faster.",
    badge: "Average delivery: a few hours",
    headline: {
      pre: "Order Now, ",
      highlight: "Start Calling Tonight",
      post: "",
    },
    subhead:
      "No demo calls. No onboarding. No 'book a meeting with sales.' Pick your market, pay $29, and a human-reviewed CSV of 100 local leads lands in your inbox — usually within hours.",
    ctaLabel: "Get Leads by Tonight",
    chips: ["No demos or sales calls", "Delivered in hours, not weeks", "Never more than 24 hours"],
    sampleFirst: false,
    finalHeadline: "The fastest 'yes' in lead gen",
    finalSubhead: "While competitors book discovery calls, you'll already be dialing. 100 leads, $29, in your inbox today.",
    captions: [
      "Every lead company: \"Book a demo! Talk to sales! 3-week onboarding!\" Us: pay $29, get 100 human-reviewed local leads in your inbox in a few hours, start calling tonight 👇",
      "Speed test ⚡ Ordered at 9am → CSV of 100 verified local leads by early afternoon → first calls before dinner. No subscription, $29 flat. Your move 👇",
    ],
  },
];
