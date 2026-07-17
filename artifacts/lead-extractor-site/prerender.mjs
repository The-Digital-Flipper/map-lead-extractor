/**
 * prerender.mjs — post-build SEO step (runs after `vite build`).
 *
 * Reads the SAME source data the app uses (src/data/posts.ts and
 * src/data/landing-pages.ts — imported directly thanks to Node 24's native
 * TypeScript type-stripping) so there is no mirrored data to drift.
 *
 * For every public route it:
 *   1. Injects route-specific <title>, description, OG/Twitter, canonical.
 *   2. Injects real, crawlable HTML into the #root shell — including FULL blog
 *      article bodies and full landing-page content — so non-JS crawlers get
 *      the complete page. React's createRoot clears #root on mount (no
 *      hydration mismatch).
 *   3. Injects per-page JSON-LD (BlogPosting+Breadcrumb on posts, FAQPage on
 *      home + landing, BreadcrumbList on landing, Product on pricing).
 *   4. Generates split sitemaps (pages / blog / landing / images) plus a
 *      sitemap index, all from the same source data.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { posts } from "./src/data/posts.ts";
import { industryPages } from "./src/data/landing-pages.ts";
import { tools } from "./src/data/tools.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist/public");
const SITE = "https://mapleadextractor.net";
const OG_IMAGE = `${SITE}/opengraph.jpg`;
const OG_IMAGE_ALT = "Map Lead Extractor — extract Google & Bing Maps leads to CSV";
const STORE_URL =
  "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const staticRoutes = [
  {
    path: "/",
    title: "Buy Local Business Leads — Human-Reviewed Lists by Industry & City | Map Lead Extractor",
    description:
      "Done-for-you local business lead lists: pick an industry and city, get a clean, human-reviewed CSV — names, phones, emails, websites & ratings. 100 targeted leads for $29, delivered in hours.",
  },
  {
    path: "/free-tool",
    title: "Free Google & Bing Maps Lead Extractor — Chrome Extension | Map Lead Extractor",
    description:
      "Free Chrome extensions that extract local business leads from Google Maps, Bing Maps & Yelp — names, phones, emails, websites & ratings — straight to CSV. No signup, no credit card.",
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
    path: "/tools",
    title: "Free Lead Generation Tools & Calculators | Map Lead Extractor",
    description:
      "Free tools for local lead generation and agencies: Google Maps ROI calculator, lead value calculator, and agency pricing calculator. No signup required.",
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

const blogRoutes = posts.map((p) => ({
  path: `/blog/${p.slug}`,
  title: `${p.title} | Map Lead Extractor`,
  description: p.description,
}));

const landingRoutes = industryPages.map((p) => ({
  path: `/leads/${p.slug}`,
  title: p.metaTitle,
  description: p.metaDescription,
}));

const toolRoutes = tools.map((t) => ({
  path: `/tools/${t.slug}`,
  title: t.metaTitle,
  description: t.metaDescription,
}));

const allRoutes = [...staticRoutes, ...blogRoutes, ...landingRoutes, ...toolRoutes];

// Home FAQ (mirrors the on-page accordion — buyer-focused).
const FAQ = [
  { q: "How fast do I get my leads?", a: "Most packs are delivered within hours of ordering. Every list is human-reviewed before it ships, so at busy times it can take a little longer — but it arrives as a clean CSV in your email inbox, ready to import into any CRM or spreadsheet." },
  { q: "What's included with each lead?", a: "Business name, phone number, website, address, star rating and review count, and business category — plus a public email address when one can be found on the business's website. Each lead also carries the gap signal you bought it for, like no website or few reviews, so you know exactly what to pitch." },
  { q: "What if my pack comes up short?", a: "You get an automatic refund for the difference. If you order 100 leads and we can only deliver 82 that pass review, you're refunded for the 18 we couldn't fill — you only ever pay for leads you actually receive." },
  { q: "Where do the leads come from?", a: "Public business listings on Google Maps and Bing Maps, enriched with contact details from each business's own website. Dead and closed businesses are removed, duplicates are stripped, and every list is spot-checked by a human before delivery." },
  { q: "Can I pick the industry and location?", a: "Yes — tell us any business type and any US city or state (for example roofers in Mobile, AL) and the list is built to that spec." },
];

// Free-tool FAQ (mirrors the /free-tool accordion — extension-focused).
const EXT_FAQ = [
  { q: "Is it really free?", a: "Yes. Completely free. There are no paid tiers, no credits, and no paywalls. If you get value out of the tool and close deals, we provide an option to drop a tip, but it is never required." },
  { q: "Where is the data stored?", a: "Nowhere but your own hard drive. The extension runs entirely in your browser's local memory and exports directly to your Downloads folder. We do not have servers, databases, or tracking telemetry." },
  { q: "Why are there two different extensions?", a: "Google Maps and Bing Maps have completely different underlying architectures. To provide the fastest, most resilient lead finding possible, we built dedicated engines for each platform rather than a bloated, fragile hybrid." },
  { q: "Does it get emails?", a: "Yes. While map platforms rarely list emails directly, our optional Website Enrichment feature instructs the extension to visit the business's linked website in the background, scan the HTML, and extract any public email addresses or social media links it finds." },
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
// Escaping + meta helpers
// ---------------------------------------------------------------------------

const escAttr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Escape `$` so dynamic content is never interpreted as a String.replace
// substitution pattern ($$, $&, $', $`). Required when content can contain `$`.
const escRep = (s) => String(s).replace(/\$/g, "$$$$");

function replaceMeta(html, selector, attr, value) {
  const escaped = escAttr(selector);
  const safe = escRep(escAttr(value));
  const re1 = new RegExp(`(<meta[^>]+(?:name|property)="${escaped}"[^>]*${attr}=")([^"]*)(")`, "i");
  const out = html.replace(re1, `$1${safe}$3`);
  if (out !== html) return out;
  const re2 = new RegExp(`(<meta[^>]+${attr}=")([^"]*)("[^>]*(?:name|property)="${escaped}")`, "i");
  return html.replace(re2, `$1${safe}$3`);
}
const replaceTitle = (html, t) => html.replace(/<title>[^<]*<\/title>/, () => `<title>${escAttr(t)}</title>`);
const replaceCanonical = (html, url) =>
  html.replace(/<link rel="canonical"[^>]*>/, () => `<link rel="canonical" href="${escAttr(url)}" />`);

// ---------------------------------------------------------------------------
// Content rendering (shared nav/footer + per-route bodies)
// ---------------------------------------------------------------------------

const navHtml = () =>
  `<nav aria-label="Primary"><a href="/">Map Lead Extractor</a> <a href="/#leads-for-sale">Buy Leads</a> <a href="/#industries">Industries</a> <a href="/free-tool">Free Tool</a> <a href="/#faq">FAQ</a> <a href="/pricing">Pricing</a> <a href="/blog">Blog</a> <a href="/tools">Calculators</a> <a href="${STORE_URL}" rel="nofollow">Install Free</a></nav>`;

const footerHtml = () =>
  `<footer><a href="/privacy">Privacy Policy</a> <a href="/terms">Terms of Service</a> <a href="/blog">Blog</a> <a href="/pricing">Pricing</a> <a href="/tools">Free Tools</a></footer>`;

const blogLinksHtml = () =>
  `<ul>${posts.map((p) => `<li><a href="/blog/${p.slug}">${escHtml(p.title)}</a> — ${escHtml(p.description)}</li>`).join("")}</ul>`;

const landingLinksHtml = () =>
  `<ul>${industryPages.map((p) => `<li><a href="/leads/${p.slug}">${escHtml(p.industry)} leads</a></li>`).join("")}</ul>`;

// Render rich content sections shared by blog posts and landing-page bodies.
function renderParts(parts) {
  return parts
    .map((p) => (p.type === "link" ? `<a href="${escAttr(p.href)}">${escHtml(p.value)}</a>` : escHtml(p.value)))
    .join("");
}
function renderSections(sections) {
  if (!sections) return "";
  return sections
    .map((s) => {
      switch (s.type) {
        case "h2": return `<h2>${escHtml(s.text)}</h2>`;
        case "h3": return `<h3>${escHtml(s.text)}</h3>`;
        case "p": return `<p>${s.parts ? renderParts(s.parts) : escHtml(s.text)}</p>`;
        case "ul": return `<ul>${s.items.map((i) => `<li>${escHtml(i)}</li>`).join("")}</ul>`;
        case "ol": return `<ol>${s.items.map((i) => `<li>${escHtml(i)}</li>`).join("")}</ol>`;
        case "tip": return `<p><strong>Tip:</strong> ${escHtml(s.text)}</p>`;
        default: return "";
      }
    })
    .join("");
}

function homeContent() {
  return `
    ${navHtml()}
    <main>
      <h1>Buy ready-to-close local business leads for any industry, in any city</h1>
      <p>Tell us the business type and area — we deliver a clean, human-reviewed CSV with names, phones, emails, websites, and ratings. 100 targeted leads for $29, usually within hours. One-time payment, refund if we come up short.</p>
      <p><a href="/#leads-for-sale">Browse lead packs</a></p>
      <section id="leads-for-sale"><h2>Pick the leads that match what you sell</h2><ul>
        <li>No-website businesses — the easiest, highest-value web-design sale.</li>
        <li>Outdated or broken sites — prime redesign prospects.</li>
        <li>Few or no reviews — ready for reputation services.</li>
        <li>Low-rating businesses — owners actively worried about their reputation.</li>
        <li>No social presence — wide open for social media setup.</li>
        <li>No online booking — ready for automation tools.</li>
        <li>Weak map profiles — incomplete Google or Bing listings, ideal for local SEO.</li>
        <li>By industry and territory — dentists, lawyers, roofers, HVAC, plumbers and more, in any US state or city.</li>
      </ul></section>
      <section id="industries"><h2>Buy leads by industry</h2>${landingLinksHtml()}</section>
      <section><h2>Prefer to pull leads yourself? The extractor is free.</h2><p>Our free Chrome extensions extract local business leads straight from Google Maps, Bing Maps, and Yelp — no signup, no credit card. <a href="/free-tool">See the free tool</a>.</p></section>
      <section><h2>Who buys our leads?</h2><ul><li>Agency owners</li><li>Sales development teams</li><li>Freelancers and web designers</li></ul></section>
      <section id="faq"><h2>Questions &amp; answers</h2>${FAQ.map((f) => `<div><h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p></div>`).join("")}</section>
      <section><h2>Read our lead generation guides</h2>${blogLinksHtml()}</section>
    </main>
    ${footerHtml()}
  `;
}

function freeToolContent() {
  return `
    ${navHtml()}
    <main>
      <h1>The free Maps Lead Extractor Chrome extension</h1>
      <p>Extract local business leads — names, emails, phones, and socials — directly from Google Maps, Bing Maps, and Yelp. Export to CSV in seconds. No signup, no credit card, no limits.</p>
      <p><a href="${STORE_URL}" rel="nofollow">Add to Chrome — it's free</a></p>
      <section id="extensions"><h2>Three platforms. One purpose.</h2><ul>${PRODUCTS.map((p) => `<li>${escHtml(p)}</li>`).join("")}</ul></section>
      <section id="how-it-works"><h2>Start extracting in seconds</h2><ol>${STEPS.map((s) => `<li>${escHtml(s)}</li>`).join("")}</ol></section>
      <section><h2>The data fields you get</h2><p>Business name, phone number, website URL, full address, star rating and review count, Google Maps URL, and — with Website Enrichment — public emails and social links.</p></section>
      <section id="faq"><h2>Questions &amp; answers</h2>${EXT_FAQ.map((f) => `<div><h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p></div>`).join("")}</section>
      <section><h2>Rather have it done for you?</h2><p>Skip the scraping — <a href="/#leads-for-sale">buy a ready-made, human-reviewed lead list</a> filtered by industry and city, delivered as clean CSV.</p></section>
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
      <h2>Free</h2><p>Unlimited extraction from Google Maps and Bing Maps, CSV export, and no account required.</p>
      <h2>Pro</h2><p>Unlimited saved leads, lead scoring, and premium support.</p>
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
        ${renderSections(post.content)}
        <p><a href="/blog">&larr; Back to all guides</a></p>
      </article>
      <aside><h2>Related guides</h2><ul>${related}</ul></aside>
    </main>
    ${footerHtml()}
  `;
}

function landingContent(page) {
  const others = industryPages
    .filter((p) => p.slug !== page.slug)
    .map((p) => `<a href="/leads/${p.slug}">${escHtml(p.industry)} leads</a>`)
    .join(" ");
  const related = (page.relatedPosts || [])
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter(Boolean)
    .map((p) => `<li><a href="/blog/${p.slug}">${escHtml(p.title)}</a></li>`)
    .join("");
  return `
    ${navHtml()}
    <main>
      <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/#industries">Leads by Industry</a> / <span>${escHtml(page.industry)}</span></nav>
      <h1>${escHtml(page.h1)}</h1>
      ${page.intro.map((p) => `<p>${escHtml(p)}</p>`).join("")}
      <p><a href="/#leads-for-sale">Buy a ready-made ${escHtml(page.industry.toLowerCase())} lead pack</a> — or <a href="/free-tool">extract leads yourself with the free extension</a>.</p>
      ${renderSections(page.body)}
      <section><h2>Why ${escHtml(page.industry.toLowerCase())} are worth prospecting</h2><ul>${page.painPoints.map((u) => `<li>${escHtml(u)}</li>`).join("")}</ul></section>
      <section><h2>What you can do with ${escHtml(page.industry.toLowerCase())} leads</h2><ul>${page.useCases.map((u) => `<li>${escHtml(u)}</li>`).join("")}</ul></section>
      <section><h2>Example Google &amp; Bing Maps searches</h2><ul>${page.exampleSearches.map((s) => `<li>${escHtml(s)}</li>`).join("")}</ul></section>
      <section><h2>${escHtml(page.industry)} lead extraction — FAQ</h2>${page.faq.map((f) => `<div><h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p></div>`).join("")}</section>
      ${related ? `<section><h2>Related guides</h2><ul>${related}</ul></section>` : ""}
      <section><h2>Extract leads for other industries</h2><p>${others}</p></section>
    </main>
    ${footerHtml()}
  `;
}

const legalContent = (h1, body) => `
    ${navHtml()}
    <main><h1>${escHtml(h1)}</h1>${body}</main>
    ${footerHtml()}
  `;

function toolsIndexContent() {
  return `
    ${navHtml()}
    <main>
      <h1>Free lead generation tools</h1>
      <p>Free, no-signup calculators for local lead generation, sales, and agencies. Each runs entirely in your browser.</p>
      <ul>${tools.map((t) => `<li><a href="/tools/${t.slug}">${escHtml(t.name)}</a> — ${escHtml(t.tagline)}</li>`).join("")}</ul>
    </main>
    ${footerHtml()}
  `;
}

function toolContent(tool) {
  const others = tools
    .filter((t) => t.slug !== tool.slug)
    .map((t) => `<a href="/tools/${t.slug}">${escHtml(t.name)}</a>`)
    .join(" ");
  return `
    ${navHtml()}
    <main>
      <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/tools">Free Tools</a> / <span>${escHtml(tool.name)}</span></nav>
      <h1>${escHtml(tool.h1)}</h1>
      ${tool.intro.map((p) => `<p>${escHtml(p)}</p>`).join("")}
      ${renderSections(tool.body)}
      <section><h2>Frequently asked questions</h2>${tool.faq.map((f) => `<div><h3>${escHtml(f.q)}</h3><p>${escHtml(f.a)}</p></div>`).join("")}</section>
      <section><h2>More free tools</h2><p>${others}</p></section>
    </main>
    ${footerHtml()}
  `;
}

function contentForRoute(route, post, landing, tool) {
  if (post) return blogPostContent(post);
  if (landing) return landingContent(landing);
  if (tool) return toolContent(tool);
  switch (route.path) {
    case "/": return homeContent();
    case "/free-tool": return freeToolContent();
    case "/pricing": return pricingContent();
    case "/blog": return blogIndexContent();
    case "/tools": return toolsIndexContent();
    case "/privacy":
      return legalContent("Privacy Policy", "<p>The Map Lead Extractor browser extensions run entirely inside your own browser. Extracted leads are processed locally and exported to your Downloads folder — we do not transmit or store them, and we run no tracking telemetry. Account authentication is handled by Clerk and payments by Stripe.</p><p>Questions? Email support@mapleadextractor.net.</p>");
    case "/terms":
      return legalContent("Terms of Service", "<p>These terms govern your use of the Map Lead Extractor browser extensions and website. You may use the service only for lawful purposes and are responsible for complying with applicable laws such as GDPR and CAN-SPAM. The service is provided \"as is\" without warranties.</p><p>Questions? Email support@mapleadextractor.net.</p>");
    default: return "";
  }
}

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------

const ld = (data) => `<script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n</script>`;

const faqJsonLd = (items) =>
  ld({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  });

function blogPostJsonLd(post) {
  const url = `${SITE}/blog/${post.slug}`;
  return ld({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        datePublished: post.datePublished,
        dateModified: post.dateModified || post.datePublished,
        author: { "@type": "Organization", name: "Map Lead Extractor" },
        publisher: { "@type": "Organization", name: "Map Lead Extractor", logo: { "@type": "ImageObject", url: `${SITE}/logo.svg` } },
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
  });
}

function landingJsonLd(page) {
  const url = `${SITE}/leads/${page.slug}`;
  return (
    faqJsonLd(page.faq) +
    "\n" +
    ld({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Leads by Industry", item: `${SITE}/#industries` },
        { "@type": "ListItem", position: 3, name: page.industry, item: url },
      ],
    })
  );
}

function toolJsonLd(tool) {
  const url = `${SITE}/tools/${tool.slug}`;
  return (
    ld({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: tool.name,
      description: tool.metaDescription,
      url,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any (web browser)",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      publisher: { "@type": "Organization", name: "Map Lead Extractor", url: `${SITE}/` },
    }) +
    "\n" +
    faqJsonLd(tool.faq) +
    "\n" +
    ld({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Free Tools", item: `${SITE}/tools` },
        { "@type": "ListItem", position: 3, name: tool.name, item: url },
      ],
    })
  );
}

// Product schema for the pricing page. Only the free tier has a known static
// price (Pro pricing is fetched live from Stripe), so we assert just that.
const pricingJsonLd = () =>
  ld({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Map Lead Extractor",
    description: "Browser extensions that extract local business leads from Google Maps and Bing Maps and export them to CSV.",
    brand: { "@type": "Brand", name: "Map Lead Extractor" },
    offers: { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock", url: `${SITE}/pricing` },
  });

// ---------------------------------------------------------------------------
// HTML transformation
// ---------------------------------------------------------------------------

function buildHtml(template, route, post, landing, tool) {
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

  const head = [];
  if (post) {
    html = replaceMeta(html, "og:type", "content", "article");
    head.push(blogPostJsonLd(post));
  }
  if (landing) head.push(landingJsonLd(landing));
  if (tool) head.push(toolJsonLd(tool));
  if (route.path === "/") head.push(faqJsonLd(FAQ));
  if (route.path === "/free-tool") head.push(faqJsonLd(EXT_FAQ));
  if (route.path === "/pricing") head.push(pricingJsonLd());
  // Use function replacers so injected JSON/content is never treated as a
  // String.replace substitution pattern (a `$'`/`$$` in content would corrupt it).
  if (head.length) html = html.replace("</head>", () => `${head.join("\n")}\n</head>`);

  const content = contentForRoute(route, post, landing, tool);
  if (content) {
    html = html.replace(
      /<div id="root"><\/div>/,
      () => `<div id="root"><div id="seo-prerender" style="min-height:100vh;background:#0d1117;color:#c9d1d9;font-family:Inter,system-ui,sans-serif;max-width:880px;margin:0 auto;padding:6rem 1.5rem;line-height:1.6">${content}</div></div>`
    );
  }
  return html;
}

// ---------------------------------------------------------------------------
// Sitemaps (split + index) — generated from the same source data
// ---------------------------------------------------------------------------

function urlset(entries) {
  const ns = entries.some((e) => e.images)
    ? ` xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`
    : "";
  const body = entries
    .map((e) => {
      const img = (e.images || []).map((u) => `\n    <image:image><image:loc>${u}</image:loc></image:image>`).join("");
      return `  <url>\n    <loc>${e.loc}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ""}${e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : ""}${e.priority ? `\n    <priority>${e.priority}</priority>` : ""}${img}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${ns}>\n${body}\n</urlset>\n`;
}
function sitemapIndex(names) {
  const body = names
    .map((n) => `  <sitemap>\n    <loc>${SITE}/${n}</loc>\n    <lastmod>${BUILD_DATE}</lastmod>\n  </sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

function writeSitemaps() {
  const pages = urlset([
    { loc: `${SITE}/`, lastmod: BUILD_DATE, changefreq: "weekly", priority: "1.0" },
    { loc: `${SITE}/pricing`, lastmod: BUILD_DATE, changefreq: "monthly", priority: "0.9" },
    { loc: `${SITE}/free-tool`, lastmod: BUILD_DATE, changefreq: "monthly", priority: "0.8" },
    { loc: `${SITE}/blog`, lastmod: BUILD_DATE, changefreq: "weekly", priority: "0.8" },
    { loc: `${SITE}/tools`, lastmod: BUILD_DATE, changefreq: "monthly", priority: "0.7" },
    { loc: `${SITE}/privacy`, lastmod: BUILD_DATE, changefreq: "yearly", priority: "0.3" },
    { loc: `${SITE}/terms`, lastmod: BUILD_DATE, changefreq: "yearly", priority: "0.3" },
  ]);
  const toolsSm = urlset(
    tools.map((t) => ({ loc: `${SITE}/tools/${t.slug}`, lastmod: BUILD_DATE, changefreq: "monthly", priority: "0.7" }))
  );
  const blog = urlset(
    posts.map((p) => ({
      loc: `${SITE}/blog/${p.slug}`,
      lastmod: p.dateModified || p.datePublished,
      changefreq: "monthly",
      priority: "0.7",
    }))
  );
  const landing = urlset(
    industryPages.map((p) => ({
      loc: `${SITE}/leads/${p.slug}`,
      lastmod: BUILD_DATE,
      changefreq: "monthly",
      priority: "0.8",
    }))
  );
  const images = urlset([
    { loc: `${SITE}/`, images: [`${SITE}/opengraph.jpg`, `${SITE}/logo.svg`] },
  ]);
  writeFileSync(join(DIST, "sitemap-pages.xml"), pages);
  writeFileSync(join(DIST, "sitemap-blog.xml"), blog);
  writeFileSync(join(DIST, "sitemap-landing.xml"), landing);
  writeFileSync(join(DIST, "sitemap-tools.xml"), toolsSm);
  writeFileSync(join(DIST, "sitemap-images.xml"), images);
  writeFileSync(
    join(DIST, "sitemap.xml"),
    sitemapIndex(["sitemap-pages.xml", "sitemap-blog.xml", "sitemap-landing.xml", "sitemap-tools.xml", "sitemap-images.xml"])
  );
  console.log("  sitemaps → index + pages/blog/landing/tools/images");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const template = readFileSync(join(DIST, "index.html"), "utf-8");
const postsBySlug = new Map(posts.map((p) => [`/blog/${p.slug}`, p]));
const landingBySlug = new Map(industryPages.map((p) => [`/leads/${p.slug}`, p]));
const toolBySlug = new Map(tools.map((t) => [`/tools/${t.slug}`, t]));

let count = 0;
for (const route of allRoutes) {
  const post = postsBySlug.get(route.path);
  const landing = landingBySlug.get(route.path);
  const tool = toolBySlug.get(route.path);
  const html = buildHtml(template, route, post, landing, tool);

  const segments = route.path.replace(/^\//, "").split("/");
  const dir = route.path === "/" ? DIST : join(DIST, ...segments);
  if (route.path !== "/") mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html, "utf-8");
  count++;
}

writeSitemaps();
console.log(`prerender: wrote ${count} route(s).`);
