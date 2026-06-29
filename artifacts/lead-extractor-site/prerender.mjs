/**
 * prerender.mjs
 *
 * Post-build step run after `vite build` (see package.json build script).
 *
 * For every public route it:
 *   1. Injects route-specific <title>, meta description, Open Graph, Twitter
 *      Card, and canonical tags so social bots and non-JS crawlers receive
 *      correct metadata.
 *   2. Injects real, crawlable HTML content into the #root shell (headings,
 *      copy, FAQ, internal links). This app boots Clerk from window at module
 *      scope and gates the homepage behind a signed-out <Show>, which makes
 *      Node SSR impractical — so instead of shipping an empty <div id="root">
 *      to crawlers, we render a faithful static snapshot of each page's content
 *      that React replaces on mount (createRoot clears #root, so there is no
 *      hydration mismatch).
 *   3. Injects per-page structured data (BlogPosting + BreadcrumbList for posts).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist/public");
const SITE = "https://mapleadextractor.net";
const OG_IMAGE = `${SITE}/opengraph.jpg`;
const OG_IMAGE_ALT = "Map Lead Extractor — extract Google & Bing Maps leads to CSV";
const STORE_URL =
  "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";

// ---------------------------------------------------------------------------
// Route metadata — keep in sync with src/lib/seo.ts defaults and page useSeo
// calls.  Blog posts are generated dynamically from the posts array below.
// ---------------------------------------------------------------------------

const staticRoutes = [
  {
    path: "/",
    title: "Map Lead Extractor — Find Google & Bing Maps Leads to CSV",
    description:
      "Extract local business leads from Google Maps & Bing Maps — names, phones, emails, websites & ratings — and export to CSV in seconds. Or buy ready-scored leads by industry and city.",
  },
  {
    path: "/pricing",
    title: "Pricing — Map Lead Extractor | Free & Pro Plans",
    description:
      "Start free, upgrade to Pro for unlimited lead saves and the full money-lead scoring suite. Simple pricing for Google & Bing Maps lead extraction.",
  },
  {
    path: "/blog",
    title: "Blog — Google & Bing Maps Lead Generation Guides | Map Lead Extractor",
    description:
      "Tutorials and guides on finding Google Maps leads, cold email outreach, lead-gen for agencies and web designers, and staying compliant.",
  },
  {
    path: "/connect-extension",
    title: "Connect Your Extension — Map Lead Extractor",
    description:
      "Link your Map Lead Extractor browser extension to your account to sync saved leads and unlock premium features.",
  },
  {
    path: "/privacy",
    title: "Privacy Policy — Map Lead Extractor",
    description:
      "How Map Lead Extractor handles your data. The browser extension runs entirely on your device — we run no tracking telemetry and store extracted leads only on your own computer.",
  },
  {
    path: "/terms",
    title: "Terms of Service — Map Lead Extractor",
    description:
      "The terms governing your use of the Map Lead Extractor browser extensions and website for finding local business leads from Google Maps and Bing Maps.",
  },
];

// Minimal post data — slug, title, description, datePublished — mirrored from
// src/data/posts.ts so the prerender script stays a plain .mjs with no
// TypeScript dependency.
const posts = [
  {
    slug: "how-to-scrape-google-maps-leads",
    title: "How to Find Google Maps Leads in 2025 (No Code Required)",
    description:
      "A step-by-step guide to extracting business names, phone numbers, emails, and websites from Google Maps without writing a single line of code.",
    datePublished: "2025-06-18",
  },
  {
    slug: "google-maps-vs-data-providers",
    title: "Google Maps vs. Paid Lead Databases: Which Is Better in 2025?",
    description:
      "We compare real-time Google Maps extraction against ZoomInfo, Apollo, and Hunter to find out which source gives you more accurate, more actionable leads.",
    datePublished: "2025-06-10",
  },
  {
    slug: "bing-maps-lead-generation",
    title: "Why Bing Maps Is an Untapped Lead Source Your Competitors Are Ignoring",
    description:
      "Bing Maps has 15% of the map search market and frequently shows different — sometimes better — local business data than Google. Here's how to use it for lead generation.",
    datePublished: "2025-06-03",
  },
  {
    slug: "cold-email-from-google-maps-leads",
    title: "How to Write Cold Emails That Actually Convert Google Maps Leads",
    description:
      "Extracting leads is step one. Here's the proven cold email framework that turns Google Maps data into booked calls and paying clients.",
    datePublished: "2025-05-27",
  },
  {
    slug: "lead-generation-for-web-designers",
    title: "The Freelance Web Designer's Guide to Finding Clients on Google Maps",
    description:
      "How to use Google Maps to find local businesses with bad websites, extract their contact info, and pitch them a redesign that converts.",
    datePublished: "2025-05-20",
  },
  {
    slug: "gdpr-google-maps-scraping",
    title: "Is Finding Leads on Google Maps Legal? GDPR, ToS, and What You Need to Know",
    description:
      "A plain-language breakdown of the legal landscape around Google Maps data extraction — what's fine, what's risky, and how to stay compliant.",
    datePublished: "2025-05-13",
  },
  {
    slug: "how-to-find-businesses-with-no-website",
    title: "How to Find Local Businesses With No Website in 2026",
    description:
      "The fastest ways to find local businesses with no website — the warmest prospects for web designers, agencies, and SEO freelancers. Free and paid methods.",
    datePublished: "2026-06-20",
  },
  {
    slug: "where-to-buy-local-business-leads",
    title: "Where to Buy Local Business Leads That Actually Convert (2026)",
    description:
      "A practical guide to buying local business leads — what makes a lead worth paying for, what to avoid, and how to get pre-scored leads by industry and city.",
    datePublished: "2026-06-16",
  },
  {
    slug: "how-to-extract-emails-from-google-maps",
    title: "How to Extract Emails From Google Maps (Free, No Code)",
    description:
      "Google Maps doesn't show emails — but you can still get them. Here's how to extract business emails from Google Maps listings automatically and export to CSV.",
    datePublished: "2026-06-12",
  },
  {
    slug: "lead-generation-for-marketing-agencies",
    title: "Lead Generation for Marketing Agencies: The 2026 Playbook",
    description:
      "A complete lead generation playbook for digital marketing and SMMA agencies — how to find, score, and close local business clients from Google and Bing Maps.",
    datePublished: "2026-06-08",
  },
];

const blogRoutes = posts.map((p) => ({
  path: `/blog/${p.slug}`,
  title: `${p.title} | Map Lead Extractor`,
  description: p.description,
}));

// Industry landing pages — mirrored from src/data/landing-pages.ts (plain JS so
// the prerender stays dependency-free). Keep in sync when editing that file.
const landingPages = [
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
      { q: "Can I get real estate agent emails?", a: "Google Maps rarely lists emails directly, but the optional Website Enrichment feature visits each agent's linked website in the background and extracts public email addresses and social links." },
      { q: "How many realtor leads can I extract at once?", a: "There are no caps — the extension processes the full result set of any Google or Bing Maps search and exports it all to CSV." },
    ],
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
      { q: "Can I filter restaurants by rating or review count?", a: "The extractor captures star rating and review count for every listing, so you can sort and filter your CSV to find low-review or low-rating restaurants that are the best fit for reputation or marketing services." },
      { q: "Does it work for cafes, bars, and food trucks too?", a: "Yes — any business type that appears in a Google or Bing Maps search can be extracted, including cafes, bars, bakeries, and food trucks." },
    ],
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
      { q: "How do I find contractors with no website?", a: "Extract a Maps search for the trade and city, then filter your CSV for rows with an empty website field. Those businesses are the warmest prospects for a web-design or lead-gen pitch." },
      { q: "Can I extract a specific trade only?", a: "Yes — search the exact trade on Google Maps (for example \"electricians in Tampa FL\") and the extractor captures only those results." },
    ],
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
      { q: "Can I extract dental practice emails?", a: "With Website Enrichment enabled, the extractor visits each practice's website and pulls public email addresses and contact-page links where available." },
      { q: "Is extracting dentist data from Google Maps allowed?", a: "The data is publicly listed business information. As always, you're responsible for using it in line with applicable laws — see our guide on the legal landscape for details." },
    ],
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
      { q: "Can I find boutique studios specifically?", a: "Search the specific niche on Maps (for example \"pilates studios in Denver CO\") and the extractor captures only those listings." },
      { q: "Do I get phone numbers for solo trainers?", a: "If a trainer has a Google or Bing Maps listing with a phone number, it's captured along with the rest of their listing data." },
    ],
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
      { q: "Can I extract tire shops or specialty mechanics only?", a: "Yes — search the specific category on Maps (for example \"tire shops in Houston TX\") and only those results are captured." },
      { q: "Are the phone numbers accurate?", a: "The extractor pulls the phone number exactly as listed on each Google or Bing Maps profile, which businesses keep current to receive calls." },
    ],
  },
];

const landingRoutes = landingPages.map((p) => ({
  path: `/leads/${p.slug}`,
  title: p.metaTitle,
  description: p.metaDescription,
}));

const allRoutes = [...staticRoutes, ...blogRoutes, ...landingRoutes];

// Faithful summaries of on-page content, used to build the crawlable snapshot.
const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. Completely free. There are no paid tiers, no credits, and no paywalls. If you get value out of the tool and close deals, we provide an option to drop a tip, but it is never required.",
  },
  {
    q: "Where is the data stored?",
    a: "Nowhere but your own hard drive. The extension runs entirely in your browser's local memory and exports directly to your Downloads folder. We do not have servers, databases, or tracking telemetry.",
  },
  {
    q: "Why are there two different extensions?",
    a: "Google Maps and Bing Maps have completely different underlying architectures. To provide the fastest, most resilient lead finding possible, we built dedicated engines for each platform rather than a bloated, fragile hybrid.",
  },
  {
    q: "Does it get emails?",
    a: "Yes. While map platforms rarely list emails directly, our optional Website Enrichment feature instructs the extension to visit the business's linked website in the background, scan the HTML, and extract any public email addresses or social media links it finds.",
  },
];

const PRODUCTS = [
  "Google Maps Extractor — pull business names, phones, websites, addresses and ratings from any Google Maps search.",
  "Bing Maps Extractor — a dedicated engine for Bing Maps, an untapped lead source most competitors ignore.",
  "Yelp Extractor — capture local business leads from Yelp listings.",
];

const STEPS = [
  "Visit the Chrome Web Store and add the free extension.",
  "Click “Add to Chrome” and confirm.",
  "Pin the extension to your toolbar.",
  "Open Google Maps and run a search like “plumbers in Houston TX”.",
  "Click the extension and press Start.",
  "Download your leads as a CSV file.",
];

// ---------------------------------------------------------------------------
// HTML escaping + meta/title/canonical replacement helpers
// ---------------------------------------------------------------------------

function escAttr(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function replaceMeta(html, selector, attr, value) {
  const escaped = escAttr(selector);
  const tagRe = new RegExp(
    `(<meta[^>]+(?:name|property)="${escaped}"[^>]*${attr}=")([^"]*)(")`,
    "i"
  );
  const swapped = html.replace(tagRe, `$1${escAttr(value)}$3`);
  if (swapped !== html) return swapped;
  const tagRe2 = new RegExp(
    `(<meta[^>]+${attr}=")([^"]*)("[^>]*(?:name|property)="${escaped}")`,
    "i"
  );
  return html.replace(tagRe2, `$1${escAttr(value)}$3`);
}

function replaceTitle(html, title) {
  return html.replace(/<title>[^<]*<\/title>/, `<title>${escAttr(title)}</title>`);
}

function replaceCanonical(html, url) {
  return html.replace(
    /<link rel="canonical"[^>]*>/,
    `<link rel="canonical" href="${escAttr(url)}" />`
  );
}

// ---------------------------------------------------------------------------
// Crawlable content snapshot per route
// ---------------------------------------------------------------------------

// A shared nav + footer give every page real internal links in static HTML.
function navHtml() {
  return `<nav aria-label="Primary"><a href="/">Map Lead Extractor</a> <a href="/#extensions">Products</a> <a href="/#how-it-works">How it works</a> <a href="/#faq">FAQ</a> <a href="/pricing">Pricing</a> <a href="/blog">Blog</a> <a href="${STORE_URL}" rel="nofollow">Install Free</a></nav>`;
}

function footerHtml() {
  return `<footer><a href="/privacy">Privacy Policy</a> <a href="/terms">Terms of Service</a> <a href="/blog">Blog</a> <a href="/pricing">Pricing</a></footer>`;
}

function blogLinksHtml() {
  const items = posts
    .map(
      (p) =>
        `<li><a href="/blog/${p.slug}">${escHtml(p.title)}</a> — ${escHtml(p.description)}</li>`
    )
    .join("");
  return `<ul>${items}</ul>`;
}

function homeContent() {
  const products = PRODUCTS.map((p) => `<li>${escHtml(p)}</li>`).join("");
  const steps = STEPS.map((s) => `<li>${escHtml(s)}</li>`).join("");
  const faq = FAQ.map(
    (f) =>
      `<div><h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p></div>`
  ).join("");
  return `
    ${navHtml()}
    <main>
      <h1>Google &amp; Bing Maps Lead Extractor — Find business leads in one click</h1>
      <p>Extract local business leads — names, emails, phones, and socials — directly from Google Maps and Bing Maps. Built for serious prospectors. Export to CSV in seconds. Or buy ready-scored local business leads by industry and city.</p>
      <p><a href="${STORE_URL}" rel="nofollow">Add to Chrome — it's free</a></p>

      <section id="extensions"><h2>Three platforms. One purpose.</h2><ul>${products}</ul></section>

      <section id="how-it-works"><h2>Start extracting in seconds</h2><ol>${steps}</ol></section>

      <section><h2>The data fields you get</h2><p>Business name, phone number, website URL, full address, star rating and review count, Google Maps URL, and — with Website Enrichment — public emails and social links.</p></section>

      <section id="leads-for-sale"><h2>We sell leads, too</h2><p>Don't want to extract them yourself? Buy ready-scored local business leads — no-website businesses, low-review businesses and more — filtered by industry and city, delivered as clean CSV.</p></section>

      <section><h2>Who is this for?</h2><ul><li>Agency owners</li><li>Sales development teams</li><li>Freelancers and web designers</li></ul></section>

      <section id="faq"><h2>Questions &amp; answers</h2>${faq}</section>

      <section id="industries"><h2>Find leads by industry</h2><ul>${landingPages
        .map((p) => `<li><a href="/leads/${p.slug}">${escHtml(p.industry)} leads</a></li>`)
        .join("")}</ul></section>

      <section><h2>Read our lead generation guides</h2>${blogLinksHtml()}</section>
    </main>
    ${footerHtml()}
  `;
}

function pricingContent() {
  return `
    ${navHtml()}
    <main>
      <h1>Map Lead Extractor pricing — Free &amp; Pro plans</h1>
      <p>Start free and extract Google &amp; Bing Maps leads with no credit card. Upgrade to Pro for unlimited lead saves and the full money-lead scoring suite.</p>
      <h2>Free</h2>
      <p>Unlimited extraction from Google Maps and Bing Maps, CSV export, and no account required.</p>
      <h2>Pro</h2>
      <p>Unlimited saved leads, lead scoring, and premium support.</p>
      <p><a href="${STORE_URL}" rel="nofollow">Install the free extension</a></p>
    </main>
    ${footerHtml()}
  `;
}

function blogIndexContent() {
  return `
    ${navHtml()}
    <main>
      <h1>Google &amp; Bing Maps lead generation guides</h1>
      <p>Tutorials, strategies, and real-world playbooks for extracting and converting local business leads.</p>
      ${blogLinksHtml()}
    </main>
    ${footerHtml()}
  `;
}

function blogPostContent(post) {
  const related = posts
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3)
    .map((p) => `<li><a href="/blog/${p.slug}">${escHtml(p.title)}</a></li>`)
    .join("");
  return `
    ${navHtml()}
    <main>
      <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/blog">Blog</a> / <span>${escHtml(post.title)}</span></nav>
      <article>
        <h1>${escHtml(post.title)}</h1>
        <p>${escHtml(post.description)}</p>
        <p><a href="/blog">&larr; Back to all guides</a></p>
      </article>
      <aside><h2>Related guides</h2><ul>${related}</ul></aside>
    </main>
    ${footerHtml()}
  `;
}

function privacyContent() {
  return `
    ${navHtml()}
    <main>
      <h1>Privacy Policy</h1>
      <p>The Map Lead Extractor browser extensions run entirely inside your own browser. Extracted leads are processed locally and exported to your Downloads folder — we do not transmit or store them, and we run no tracking telemetry. Account authentication is handled by Clerk and payments by Stripe.</p>
      <p>Questions? Email support@mapleadextractor.net.</p>
    </main>
    ${footerHtml()}
  `;
}

function termsContent() {
  return `
    ${navHtml()}
    <main>
      <h1>Terms of Service</h1>
      <p>These terms govern your use of the Map Lead Extractor browser extensions and website. You may use the service only for lawful purposes and are responsible for complying with applicable laws such as GDPR and CAN-SPAM. The service is provided "as is" without warranties.</p>
      <p>Questions? Email support@mapleadextractor.net.</p>
    </main>
    ${footerHtml()}
  `;
}

function landingContent(page) {
  const intro = page.intro.map((p) => `<p>${escHtml(p)}</p>`).join("");
  const useCases = page.useCases.map((u) => `<li>${escHtml(u)}</li>`).join("");
  const searches = page.exampleSearches.map((s) => `<li>${escHtml(s)}</li>`).join("");
  const faq = page.faq
    .map((f) => `<div><h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p></div>`)
    .join("");
  const others = landingPages
    .filter((p) => p.slug !== page.slug)
    .map((p) => `<a href="/leads/${p.slug}">${escHtml(p.industry)} leads</a>`)
    .join(" ");
  return `
    ${navHtml()}
    <main>
      <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/#extensions">Leads by Industry</a> / <span>${escHtml(page.industry)}</span></nav>
      <h1>${escHtml(page.h1)}</h1>
      ${intro}
      <p><a href="${STORE_URL}" rel="nofollow">Add to Chrome — it's free</a></p>
      <section><h2>What you can do with ${escHtml(page.industry.toLowerCase())} leads</h2><ul>${useCases}</ul></section>
      <section><h2>Example Google &amp; Bing Maps searches</h2><ul>${searches}</ul></section>
      <section><h2>${escHtml(page.industry)} lead extraction — FAQ</h2>${faq}</section>
      <section><h2>Extract leads for other industries</h2><p>${others}</p></section>
    </main>
    ${footerHtml()}
  `;
}

// FAQPage structured data from a list of {q, a} items.
function faqJsonLd(items) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

const landingJsonLd = (page) => faqJsonLd(page.faq);

function contentForRoute(route, post, landing) {
  if (post) return blogPostContent(post);
  if (landing) return landingContent(landing);
  switch (route.path) {
    case "/":
      return homeContent();
    case "/pricing":
      return pricingContent();
    case "/blog":
      return blogIndexContent();
    case "/privacy":
      return privacyContent();
    case "/terms":
      return termsContent();
    default:
      return "";
  }
}

// Structured data for blog posts: Article + breadcrumb trail.
function blogPostJsonLd(post) {
  const url = `${SITE}/blog/${post.slug}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.datePublished,
        dateModified: post.datePublished,
        author: { "@type": "Organization", name: "Map Lead Extractor" },
        publisher: {
          "@type": "Organization",
          name: "Map Lead Extractor",
          logo: { "@type": "ImageObject", url: `${SITE}/logo.svg` },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        url,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
    ],
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;
}

// ---------------------------------------------------------------------------
// HTML transformation
// ---------------------------------------------------------------------------

function buildHtml(template, route, post, landing) {
  const canonicalUrl = SITE + route.path;
  let html = template;

  html = replaceTitle(html, route.title);
  html = replaceMeta(html, "description", "content", route.description);
  html = replaceMeta(html, "og:title", "content", route.title);
  html = replaceMeta(html, "og:description", "content", route.description);
  html = replaceMeta(html, "og:url", "content", canonicalUrl);
  html = replaceMeta(html, "og:image", "content", OG_IMAGE);
  html = replaceMeta(html, "og:image:alt", "content", OG_IMAGE_ALT);
  html = replaceMeta(html, "twitter:title", "content", route.title);
  html = replaceMeta(html, "twitter:description", "content", route.description);
  html = replaceMeta(html, "twitter:image", "content", OG_IMAGE);
  html = replaceCanonical(html, canonicalUrl);

  // og:type=article for blog posts
  if (post) {
    html = replaceMeta(html, "og:type", "content", "article");
    html = html.replace("</head>", `${blogPostJsonLd(post)}\n</head>`);
  }

  // FAQPage structured data for industry landing pages.
  if (landing) {
    html = html.replace("</head>", `${landingJsonLd(landing)}\n</head>`);
  }

  // Home FAQ schema lives only on the homepage (it used to sit in the shared
  // index.html template and leak onto every page).
  if (route.path === "/") {
    html = html.replace("</head>", `${faqJsonLd(FAQ)}\n</head>`);
  }

  // Inject crawlable content into the empty #root shell. React's createRoot
  // clears and replaces these children on mount, so no hydration mismatch.
  const content = contentForRoute(route, post, landing);
  if (content) {
    // Visible (not display:none / clipped) so search engines weight it fully —
    // content parity with what React renders. Themed inline so the brief flash
    // before React mounts and clears #root stays on-brand rather than unstyled.
    html = html.replace(
      /<div id="root"><\/div>/,
      `<div id="root"><div id="seo-prerender" style="min-height:100vh;background:#0d1117;color:#c9d1d9;font-family:Inter,system-ui,sans-serif;max-width:880px;margin:0 auto;padding:6rem 1.5rem;line-height:1.6">${content}</div></div>`
    );
  }

  return html;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const template = readFileSync(join(DIST, "index.html"), "utf-8");
const postsBySlug = new Map(posts.map((p) => [`/blog/${p.slug}`, p]));
const landingBySlug = new Map(landingPages.map((p) => [`/leads/${p.slug}`, p]));

let count = 0;
for (const route of allRoutes) {
  const post = postsBySlug.get(route.path);
  const landing = landingBySlug.get(route.path);
  const html = buildHtml(template, route, post, landing);

  const segments = route.path.replace(/^\//, "").split("/");
  const dir = route.path === "/" ? DIST : join(DIST, ...segments);

  if (route.path !== "/") {
    mkdirSync(dir, { recursive: true });
  }

  const outFile = join(dir, "index.html");
  writeFileSync(outFile, html, "utf-8");
  count++;
  console.log(`  prerendered → ${outFile.replace(DIST, "")}`);
}

console.log(`\nprerender: wrote ${count} route(s).`);
