/**
 * prerender.mjs
 *
 * Post-build step: for every public route, copies dist/public/index.html and
 * injects route-specific <title>, meta description, Open Graph, Twitter Card,
 * and canonical tags so social bots and non-JS crawlers receive correct metadata.
 *
 * Run automatically via `npm run build` (vite build && node prerender.mjs).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "dist/public");
const SITE = "https://mapleadextractor.net";
const OG_IMAGE = `${SITE}/opengraph.jpg`;
const OG_IMAGE_ALT = "Map Lead Extractor — extract Google & Bing Maps leads to CSV";

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
];

// Minimal post data — slug, title, description — mirrored from src/data/posts.ts
// so the prerender script stays a plain .mjs with no TypeScript dependency.
const posts = [
  {
    slug: "how-to-scrape-google-maps-leads",
    title: "How to Find Google Maps Leads in 2025 (No Code Required)",
    description:
      "A step-by-step guide to extracting business names, phone numbers, emails, and websites from Google Maps without writing a single line of code.",
  },
  {
    slug: "google-maps-vs-data-providers",
    title: "Google Maps vs. Paid Lead Databases: Which Is Better in 2025?",
    description:
      "We compare real-time Google Maps extraction against ZoomInfo, Apollo, and Hunter to find out which source gives you more accurate, more actionable leads.",
  },
  {
    slug: "bing-maps-lead-generation",
    title: "Why Bing Maps Is an Untapped Lead Source Your Competitors Are Ignoring",
    description:
      "Bing Maps has 15% of the map search market and frequently shows different — sometimes better — local business data than Google. Here's how to use it for lead generation.",
  },
  {
    slug: "cold-email-from-google-maps-leads",
    title: "How to Write Cold Emails That Actually Convert Google Maps Leads",
    description:
      "Extracting leads is step one. Here's the proven cold email framework that turns Google Maps data into booked calls and paying clients.",
  },
  {
    slug: "lead-generation-for-web-designers",
    title: "The Freelance Web Designer's Guide to Finding Clients on Google Maps",
    description:
      "How to use Google Maps to find local businesses with bad websites, extract their contact info, and pitch them a redesign that converts.",
  },
  {
    slug: "gdpr-google-maps-scraping",
    title: "Is Finding Leads on Google Maps Legal? GDPR, ToS, and What You Need to Know",
    description:
      "A plain-language breakdown of the legal landscape around Google Maps data extraction — what's fine, what's risky, and how to stay compliant.",
  },
  {
    slug: "how-to-find-businesses-with-no-website",
    title: "How to Find Local Businesses With No Website in 2026",
    description:
      "The fastest ways to find local businesses with no website — the warmest prospects for web designers, agencies, and SEO freelancers. Free and paid methods.",
  },
  {
    slug: "where-to-buy-local-business-leads",
    title: "Where to Buy Local Business Leads That Actually Convert (2026)",
    description:
      "A practical guide to buying local business leads — what makes a lead worth paying for, what to avoid, and how to get pre-scored leads by industry and city.",
  },
  {
    slug: "how-to-extract-emails-from-google-maps",
    title: "How to Extract Emails From Google Maps (Free, No Code)",
    description:
      "Google Maps doesn't show emails — but you can still get them. Here's how to extract business emails from Google Maps listings automatically and export to CSV.",
  },
  {
    slug: "lead-generation-for-marketing-agencies",
    title: "Lead Generation for Marketing Agencies: The 2026 Playbook",
    description:
      "A complete lead generation playbook for digital marketing and SMMA agencies — how to find, score, and close local business clients from Google and Bing Maps.",
  },
];

const blogRoutes = posts.map((p) => ({
  path: `/blog/${p.slug}`,
  title: `${p.title} | Map Lead Extractor`,
  description: p.description,
}));

const allRoutes = [...staticRoutes, ...blogRoutes];

// ---------------------------------------------------------------------------
// HTML transformation helpers
// ---------------------------------------------------------------------------

function escAttr(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Replace the value of a specific meta or link tag attribute in the HTML.
 * Handles both `name` and `property` attribute selectors.
 */
function replaceMeta(html, selector, attr, value) {
  // Matches the tag regardless of attribute order; replaces the target attr value.
  const escaped = escAttr(selector);
  // Build a regex that finds the tag and captures its content attribute for replacement
  const tagRe = new RegExp(
    `(<meta[^>]+(?:name|property)="${escaped}"[^>]*${attr}=")([^"]*)(")`,
    "i"
  );
  const swapped = html.replace(tagRe, `$1${escAttr(value)}$3`);
  if (swapped !== html) return swapped;
  // Also try reversed attribute order (content before name/property)
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

function buildHtml(template, route) {
  const canonicalUrl = SITE + route.path;
  let html = template;

  html = replaceTitle(html, route.title);

  // description
  html = replaceMeta(html, "description", "content", route.description);

  // og:title
  html = replaceMeta(html, "og:title", "content", route.title);
  // og:description
  html = replaceMeta(html, "og:description", "content", route.description);
  // og:url
  html = replaceMeta(html, "og:url", "content", canonicalUrl);
  // og:image (always the shared social preview image)
  html = replaceMeta(html, "og:image", "content", OG_IMAGE);
  // og:image:alt
  html = replaceMeta(html, "og:image:alt", "content", OG_IMAGE_ALT);

  // twitter:title
  html = replaceMeta(html, "twitter:title", "content", route.title);
  // twitter:description
  html = replaceMeta(html, "twitter:description", "content", route.description);
  // twitter:image
  html = replaceMeta(html, "twitter:image", "content", OG_IMAGE);

  // canonical
  html = replaceCanonical(html, canonicalUrl);

  return html;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const template = readFileSync(join(DIST, "index.html"), "utf-8");

let count = 0;
for (const route of allRoutes) {
  const html = buildHtml(template, route);

  // Determine output path: / → dist/public/index.html (already exists),
  // /pricing → dist/public/pricing/index.html, etc.
  const segments = route.path.replace(/^\//, "").split("/");
  const dir =
    route.path === "/"
      ? DIST
      : join(DIST, ...segments);

  if (route.path !== "/") {
    mkdirSync(dir, { recursive: true });
  }

  const outFile = join(dir, "index.html");
  writeFileSync(outFile, html, "utf-8");
  count++;
  console.log(`  prerendered → ${outFile.replace(DIST, "")}`);
}

console.log(`\nprerender: wrote ${count} route(s).`);
