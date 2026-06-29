#!/usr/bin/env node
/**
 * seo-audit.mjs — post-build SEO/quality gate.
 *
 * Validates the prerendered output in dist/public and exits non-zero on any
 * regression, so it can run in CI after `pnpm run build`.
 *
 * Checks: every JSON-LD block parses; exactly one <h1> per indexable page;
 * no broken internal links; no duplicate <title>, meta description, or
 * canonical; the sitemap index and all referenced child sitemaps exist.
 *
 * Usage: node scripts/seo-audit.mjs   (run after build)
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "public");
const ASSET_RE = /\.(svg|png|jpg|jpeg|webp|gif|css|js|ico|xml|txt|zip|pdf|woff2?)$/i;
// Pages intentionally not indexable / without injected content.
const NO_H1_OK = new Set(["/connect-extension"]);

if (!existsSync(DIST)) {
  console.error(`✗ ${DIST} not found — run \`pnpm run build\` first.`);
  process.exit(1);
}

function walk(d) {
  let out = [];
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (f === "index.html") out.push(p);
  }
  return out;
}

const files = walk(DIST);
const route = (f) => "/" + f.replace(DIST + "/", "").replace(/index\.html$/, "").replace(/\/$/, "") || "/";
const routes = new Set(files.map(route));
const problems = [];

const titles = {}, descs = {}, canons = {};
let ldBlocks = 0;

for (const f of files) {
  const r = route(f);
  const html = readFileSync(f, "utf8");

  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    ldBlocks++;
    try { JSON.parse(m[1]); } catch (e) { problems.push(`${r}: invalid JSON-LD (${e.message})`); }
  }

  // Count headings in the actual markup only — strip <script> contents so a
  // literal "<h1" inside an inline script string isn't miscounted as a heading.
  const markup = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const h1 = (markup.match(/<h1[ >]/g) || []).length;
  if (h1 !== 1 && !NO_H1_OK.has(r)) problems.push(`${r}: expected 1 <h1>, found ${h1}`);

  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  const canon = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || "";
  if (!title) problems.push(`${r}: missing <title>`);
  if (!desc) problems.push(`${r}: missing meta description`);
  if (!canon) problems.push(`${r}: missing canonical`);
  (titles[title] = titles[title] || []).push(r);
  (descs[desc] = descs[desc] || []).push(r);
  (canons[canon] = canons[canon] || []).push(r);

  const hrefs = [...new Set([...html.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1].replace(/\/$/, "") || "/"))]
    .filter((h) => !ASSET_RE.test(h) && !h.startsWith("/assets") && !h.startsWith("/api"));
  for (const h of hrefs) if (!routes.has(h)) problems.push(`${r}: broken internal link → ${h}`);
}

for (const [t, rs] of Object.entries(titles)) if (t && rs.length > 1) problems.push(`duplicate <title> "${t}" on: ${rs.join(", ")}`);
for (const [d, rs] of Object.entries(descs)) if (d && rs.length > 1) problems.push(`duplicate description on: ${rs.join(", ")}`);
for (const [c, rs] of Object.entries(canons)) if (c && rs.length > 1) problems.push(`duplicate canonical "${c}" on: ${rs.join(", ")}`);

// Sitemap index + children
const idx = join(DIST, "sitemap.xml");
if (!existsSync(idx)) problems.push("missing sitemap.xml");
else {
  for (const m of readFileSync(idx, "utf8").matchAll(/<loc>https?:\/\/[^/]+\/([^<]+)<\/loc>/g)) {
    if (!existsSync(join(DIST, m[1]))) problems.push(`sitemap index references missing file: ${m[1]}`);
  }
}

console.log(`Audited ${files.length} routes · ${ldBlocks} JSON-LD blocks`);
if (problems.length) {
  console.error(`\n✗ SEO audit failed with ${problems.length} issue(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("✓ SEO audit passed: schema valid, one H1/page, no broken links, no duplicate metadata, sitemaps present.");
