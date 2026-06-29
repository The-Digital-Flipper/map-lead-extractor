// Industry landing pages — long-tail SEO targets for people who want to find
// and sell to a specific type of local business. Each entry is hand-written
// with distinct copy so these are genuinely useful pages, not thin/doorway
// pages (which Google penalizes). Rendered by src/pages/industry-landing.tsx
// and prerendered for crawlers by prerender.mjs.

export interface IndustryFaq {
  q: string;
  a: string;
}

export interface IndustryPage {
  slug: string;
  /** Display name of the industry, e.g. "Real Estate Agents". */
  industry: string;
  /** Page H1. */
  h1: string;
  /** <title> — keep under ~60 chars. */
  metaTitle: string;
  metaDescription: string;
  /** Two-paragraph intro. */
  intro: string[];
  /** Why this audience is worth targeting / what's painful about doing it manually. */
  painPoints: string[];
  /** How the extractor helps for this specific industry. */
  useCases: string[];
  /** Example Google/Bing Maps searches that work well for this industry. */
  exampleSearches: string[];
  faq: IndustryFaq[];
  /** Blog post slugs most relevant to this industry. */
  relatedPosts: string[];
}

export const industryPages: IndustryPage[] = [
  {
    slug: "real-estate-agents",
    industry: "Real Estate Agents",
    h1: "Extract Real Estate Agent & Realtor Leads From Google Maps",
    metaTitle: "Real Estate Agent Leads From Google Maps | Map Lead Extractor",
    metaDescription:
      "Find and export real estate agent, realtor, and brokerage leads from Google & Bing Maps — names, phones, emails, and websites — to CSV in seconds.",
    intro: [
      "Real estate is one of the easiest verticals to prospect on Google Maps. Every agent, broker, and agency keeps an up-to-date listing with a phone number, website, and review history — exactly the data you need to pitch CRM tools, lead-gen services, photography, staging, or marketing.",
      "Instead of copying agent details one listing at a time, Map Lead Extractor pulls an entire map search of realtors into a clean CSV: names, phone numbers, websites, addresses, ratings, and (with website enrichment) public email addresses.",
    ],
    painPoints: [
      "Thousands of agents per metro, scattered across dozens of brokerages.",
      "Manually copying each agent's contact info takes hours and is error-prone.",
      "Agent rosters change constantly as people switch brokerages.",
    ],
    useCases: [
      "Sell SaaS, CRMs, or transaction tools to agents and brokerages.",
      "Offer photography, video tours, or virtual staging services.",
      "Pitch website redesigns to agents with outdated or missing sites.",
      "Build a recruiting pipeline of agents for a growing brokerage.",
    ],
    exampleSearches: [
      "real estate agents in Austin TX",
      "real estate brokerages in Miami FL",
      "realtors near Phoenix AZ",
    ],
    faq: [
      {
        q: "Can I get real estate agent emails?",
        a: "Google Maps rarely lists emails directly, but the optional Website Enrichment feature visits each agent's linked website in the background and extracts public email addresses and social links.",
      },
      {
        q: "How many realtor leads can I extract at once?",
        a: "There are no caps — the extension processes the full result set of any Google or Bing Maps search and exports it all to CSV.",
      },
    ],
    relatedPosts: ["how-to-scrape-google-maps-leads", "cold-email-from-google-maps-leads"],
  },
  {
    slug: "restaurants",
    industry: "Restaurants",
    h1: "Extract Restaurant & Food Service Leads From Google Maps",
    metaTitle: "Restaurant Leads From Google Maps | Map Lead Extractor",
    metaDescription:
      "Find restaurant, cafe, and bar leads from Google & Bing Maps — names, phones, websites, and ratings — and export to CSV. Perfect for POS, delivery, and marketing sales.",
    intro: [
      "Restaurants are a high-volume, high-turnover market — which makes them a constant source of fresh prospects for anyone selling POS systems, online ordering, reservation software, delivery integrations, or local marketing.",
      "Map Lead Extractor turns a Google or Bing Maps search of restaurants into an instant CSV of names, phone numbers, websites, addresses, star ratings, and review counts so you can segment by quality and reach out fast.",
    ],
    painPoints: [
      "Restaurants open and close frequently, so static lists go stale quickly.",
      "Many small restaurants have weak or no websites — but always have a Maps listing.",
      "Review count and rating are critical signals you can't easily copy by hand.",
    ],
    useCases: [
      "Sell POS, online ordering, or reservation systems.",
      "Offer menu photography, web design, or Google Business optimization.",
      "Target low-rating restaurants that need reputation management.",
      "Pitch delivery, loyalty, or local-ad services.",
    ],
    exampleSearches: [
      "restaurants in Chicago IL",
      "coffee shops in Seattle WA",
      "bars near Nashville TN",
    ],
    faq: [
      {
        q: "Can I filter restaurants by rating or review count?",
        a: "The extractor captures star rating and review count for every listing, so you can sort and filter your CSV to find low-review or low-rating restaurants that are the best fit for reputation or marketing services.",
      },
      {
        q: "Does it work for cafes, bars, and food trucks too?",
        a: "Yes — any business type that appears in a Google or Bing Maps search can be extracted, including cafes, bars, bakeries, and food trucks.",
      },
    ],
    relatedPosts: ["how-to-find-businesses-with-no-website", "lead-generation-for-marketing-agencies"],
  },
  {
    slug: "contractors",
    industry: "Contractors & Home Services",
    h1: "Extract Contractor & Home Services Leads From Google Maps",
    metaTitle: "Contractor Leads From Google Maps | Map Lead Extractor",
    metaDescription:
      "Find contractor, plumber, electrician, and home-services leads from Google & Bing Maps — names, phones, emails, websites — and export to CSV in seconds.",
    intro: [
      "Home-services businesses — plumbers, electricians, HVAC, roofers, landscapers, and general contractors — are among the most profitable industries to sell to, because they spend heavily on lead generation and advertising.",
      "Map Lead Extractor pulls every contractor in a Google or Bing Maps search into a CSV with phone numbers, websites, addresses, and ratings, so agencies and SaaS sellers can build a targeted outreach list in minutes.",
    ],
    painPoints: [
      "Contractors are spread across many niche categories and service areas.",
      "Many run their business off a phone number alone, with no real website.",
      "High advertising budgets make them valuable but competitive to reach.",
    ],
    useCases: [
      "Sell lead-gen, Google Ads, or SEO services to contractors.",
      "Offer website builds to contractors with no site or a poor one.",
      "Pitch scheduling, invoicing, or field-service software.",
      "Build a list of subcontractors for a specific trade and region.",
    ],
    exampleSearches: [
      "plumbers in Houston TX",
      "roofing contractors in Dallas TX",
      "HVAC companies near Denver CO",
    ],
    faq: [
      {
        q: "How do I find contractors with no website?",
        a: "Extract a Maps search for the trade and city, then filter your CSV for rows with an empty website field. Those businesses are the warmest prospects for a web-design or lead-gen pitch.",
      },
      {
        q: "Can I extract a specific trade only?",
        a: "Yes — search the exact trade on Google Maps (for example \"electricians in Tampa FL\") and the extractor captures only those results.",
      },
    ],
    relatedPosts: ["how-to-find-businesses-with-no-website", "lead-generation-for-web-designers"],
  },
  {
    slug: "dentists",
    industry: "Dentists & Dental Practices",
    h1: "Extract Dentist & Dental Practice Leads From Google Maps",
    metaTitle: "Dentist Leads From Google Maps | Map Lead Extractor",
    metaDescription:
      "Find dentist and dental practice leads from Google & Bing Maps — names, phones, emails, websites, and ratings — and export to CSV. Ideal for medical SaaS and agencies.",
    intro: [
      "Dental practices are high-value, recession-resistant clients that invest in patient acquisition, scheduling software, and reputation management — making them a prime target for agencies and B2B sellers.",
      "Map Lead Extractor exports every dentist in a Maps search to CSV with phone numbers, websites, addresses, and review data, so you can prioritize practices by location and rating before you reach out.",
    ],
    painPoints: [
      "Practices are often listed under multiple categories (general, cosmetic, ortho).",
      "Decision-makers are busy and hard to reach with cold, untargeted lists.",
      "Review reputation is a key buying signal for marketing services.",
    ],
    useCases: [
      "Sell practice-management or patient-scheduling software.",
      "Offer SEO, Google Ads, or reputation management to practices.",
      "Pitch website redesigns to practices with dated sites.",
      "Build referral lists for dental suppliers and labs.",
    ],
    exampleSearches: [
      "dentists in Austin TX",
      "orthodontists in San Diego CA",
      "dental clinics near Atlanta GA",
    ],
    faq: [
      {
        q: "Can I extract dental practice emails?",
        a: "With Website Enrichment enabled, the extractor visits each practice's website and pulls public email addresses and contact-page links where available.",
      },
      {
        q: "Is extracting dentist data from Google Maps allowed?",
        a: "The data is publicly listed business information. As always, you're responsible for using it in line with applicable laws — see our guide on the legal landscape for details.",
      },
    ],
    relatedPosts: ["gdpr-google-maps-scraping", "lead-generation-for-marketing-agencies"],
  },
  {
    slug: "gyms-and-fitness",
    industry: "Gyms & Fitness Studios",
    h1: "Extract Gym & Fitness Studio Leads From Google Maps",
    metaTitle: "Gym & Fitness Leads From Google Maps | Map Lead Extractor",
    metaDescription:
      "Find gym, fitness studio, and personal-trainer leads from Google & Bing Maps — names, phones, websites, and ratings — and export to CSV in seconds.",
    intro: [
      "Gyms, boutique studios, and personal trainers are constantly looking for members — which means they buy marketing, booking software, and membership tools. That makes them an attractive, high-churn market for B2B sellers and agencies.",
      "Map Lead Extractor turns any Maps search for fitness businesses into a CSV of names, phones, websites, addresses, and ratings so you can build a focused outreach list fast.",
    ],
    painPoints: [
      "The market spans big-box gyms, boutique studios, and solo trainers.",
      "Many studios rely on social media and have weak websites.",
      "Local competition makes marketing services an easy sell — if you can reach them.",
    ],
    useCases: [
      "Sell class-booking, CRM, or membership software.",
      "Offer social-media management, ads, or web design.",
      "Target new studios that need a full marketing setup.",
      "Build lists of trainers for supplement or equipment brands.",
    ],
    exampleSearches: [
      "gyms in Los Angeles CA",
      "yoga studios in Portland OR",
      "crossfit near Boston MA",
    ],
    faq: [
      {
        q: "Can I find boutique studios specifically?",
        a: "Search the specific niche on Maps (for example \"pilates studios in Denver CO\") and the extractor captures only those listings.",
      },
      {
        q: "Do I get phone numbers for solo trainers?",
        a: "If a trainer has a Google or Bing Maps listing with a phone number, it's captured along with the rest of their listing data.",
      },
    ],
    relatedPosts: ["cold-email-from-google-maps-leads", "lead-generation-for-marketing-agencies"],
  },
  {
    slug: "auto-repair-shops",
    industry: "Auto Repair Shops",
    h1: "Extract Auto Repair Shop Leads From Google Maps",
    metaTitle: "Auto Repair Shop Leads From Google Maps | Map Lead Extractor",
    metaDescription:
      "Find auto repair, mechanic, and body-shop leads from Google & Bing Maps — names, phones, websites, and ratings — and export to CSV in seconds.",
    intro: [
      "Auto repair shops, mechanics, and body shops are local businesses that depend on a steady flow of customers, so they invest in advertising, booking tools, and parts suppliers — a reliable market for agencies and B2B sellers.",
      "Map Lead Extractor exports every shop in a Maps search to CSV with phone numbers, websites, addresses, and ratings, so you can segment by location and reputation before reaching out.",
    ],
    painPoints: [
      "Shops are fragmented across general repair, body work, tires, and specialties.",
      "Many independent shops have minimal or no web presence.",
      "Phone is the primary contact channel, so accurate numbers matter.",
    ],
    useCases: [
      "Sell shop-management, booking, or invoicing software.",
      "Offer Google Ads, SEO, or web design to independent shops.",
      "Build distribution lists for parts and equipment suppliers.",
      "Target low-rating shops for reputation services.",
    ],
    exampleSearches: [
      "auto repair shops in Phoenix AZ",
      "mechanics near Charlotte NC",
      "body shops in Las Vegas NV",
    ],
    faq: [
      {
        q: "Can I extract tire shops or specialty mechanics only?",
        a: "Yes — search the specific category on Maps (for example \"tire shops in Houston TX\") and only those results are captured.",
      },
      {
        q: "Are the phone numbers accurate?",
        a: "The extractor pulls the phone number exactly as listed on each Google or Bing Maps profile, which businesses keep current to receive calls.",
      },
    ],
    relatedPosts: ["how-to-scrape-google-maps-leads", "how-to-find-businesses-with-no-website"],
  },
];

export function getIndustryPage(slug: string): IndustryPage | undefined {
  return industryPages.find((p) => p.slug === slug);
}
