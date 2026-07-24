import type { Express } from "express";
import path from "node:path";
import fs from "node:fs";
import type { BlogPost, BlogSection, BlogPart } from "@workspace/db";
import { getPublishedPostBySlug, listPublishedPosts } from "./lib/blog";
import { heroSlugSet } from "./lib/blogImages";
import { logger } from "./lib/logger";

/**
 * Serves AI-generated blog posts (rows in `blog_posts`) as fully crawlable HTML
 * — the same per-page title/meta/canonical/JSON-LD and inlined article body the
 * static prerender produces — so auto-published posts rank exactly like the
 * hand-written ones. Also merges those posts into /blog and sitemap-blog.xml.
 *
 * Mounted AFTER /api and BEFORE the static site: a slug we own is rendered here;
 * anything else (existing prerendered posts, other routes) falls through.
 */

const SITE = "https://mapleadextractor.net";
const OG_IMAGE = `${SITE}/opengraph.jpg`;
const OG_IMAGE_ALT = "Map Lead Extractor — extract Google & Bing Maps leads to CSV";

// ── escaping + meta helpers (ported from prerender.mjs) ───────────────────────
const escAttr = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Escape `$` so injected content is never read as a String.replace substitution.
const escRep = (s: string) => String(s).replace(/\$/g, "$$$$");

function replaceMeta(html: string, selector: string, value: string): string {
  const escaped = escAttr(selector);
  const safe = escRep(escAttr(value));
  const re1 = new RegExp(`(<meta[^>]+(?:name|property)="${escaped}"[^>]*content=")([^"]*)(")`, "i");
  const out = html.replace(re1, `$1${safe}$3`);
  if (out !== html) return out;
  const re2 = new RegExp(`(<meta[^>]+content=")([^"]*)("[^>]*(?:name|property)="${escaped}")`, "i");
  return html.replace(re2, `$1${safe}$3`);
}
const replaceTitle = (html: string, t: string) =>
  html.replace(/<title>[^<]*<\/title>/, () => `<title>${escAttr(t)}</title>`);
const replaceCanonical = (html: string, url: string) =>
  html.replace(/<link rel="canonical"[^>]*>/, () => `<link rel="canonical" href="${escAttr(url)}" />`);

function renderParts(parts: BlogPart[]): string {
  return parts
    .map((p) => (p.type === "link" ? `<a href="${escAttr(p.href)}">${escHtml(p.value)}</a>` : escHtml(p.value)))
    .join("");
}
function renderSections(sections: BlogSection[]): string {
  return (sections || [])
    .map((s) => {
      switch (s.type) {
        case "h2": return `<h2>${escHtml(s.text ?? "")}</h2>`;
        case "h3": return `<h3>${escHtml(s.text ?? "")}</h3>`;
        case "p": return `<p>${s.parts ? renderParts(s.parts) : escHtml(s.text ?? "")}</p>`;
        case "ul": return `<ul>${(s.items ?? []).map((i) => `<li>${escHtml(i)}</li>`).join("")}</ul>`;
        case "ol": return `<ol>${(s.items ?? []).map((i) => `<li>${escHtml(i)}</li>`).join("")}</ol>`;
        case "tip": return `<p><strong>Tip:</strong> ${escHtml(s.text ?? "")}</p>`;
        default: return "";
      }
    })
    .join("");
}

const navHtml =
  `<nav aria-label="Primary"><a href="/">Map Lead Extractor</a> <a href="/#extensions">Products</a> <a href="/#how-it-works">How it works</a> <a href="/#industries">Industries</a> <a href="/#faq">FAQ</a> <a href="/pricing">Pricing</a> <a href="/blog">Blog</a> <a href="/tools">Free Tools</a></nav>`;
const footerHtml =
  `<footer><a href="/privacy">Privacy Policy</a> <a href="/terms">Terms of Service</a> <a href="/blog">Blog</a> <a href="/pricing">Pricing</a> <a href="/tools">Free Tools</a></footer>`;

function isoDate(d: Date | string): string {
  return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
}

function blogPostJsonLd(post: BlogPost, heroUrl: string | null): string {
  const url = `${SITE}/blog/${post.slug}`;
  const published = isoDate(post.datePublished);
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        image: heroUrl ?? OG_IMAGE,
        datePublished: published,
        dateModified: post.dateModified ? isoDate(post.dateModified) : published,
        author: { "@type": "Organization", name: "Map Lead Extractor" },
        publisher: { "@type": "Organization", name: "Map Lead Extractor", logo: { "@type": "ImageObject", url: `${SITE}/logo.svg` } },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        articleSection: post.category,
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

function postBodyHtml(post: BlogPost, related: BlogPost[], heroUrl: string | null): string {
  const relatedHtml = related
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3)
    .map((p) => `<li><a href="/blog/${p.slug}">${escHtml(p.title)}</a></li>`)
    .join("");
  const heroHtml = heroUrl
    ? `<img src="${escAttr(heroUrl)}" alt="${escAttr(post.title)}" width="1536" height="1024" style="width:100%;height:auto;border-radius:12px;margin:0 0 1.5rem" />`
    : "";
  return `
    ${navHtml}
    <main>
      <nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/blog">Blog</a> / <span>${escHtml(post.title)}</span></nav>
      <article>
        <h1>${escHtml(post.title)}</h1>
        ${heroHtml}
        <p>${escHtml(post.description)}</p>
        ${renderSections(post.content)}
        <p><a href="/blog">&larr; Back to all guides</a></p>
      </article>
      ${relatedHtml ? `<aside><h2>Related guides</h2><ul>${relatedHtml}</ul></aside>` : ""}
    </main>
    ${footerHtml}
  `;
}

export function renderPostHtml(template: string, post: BlogPost, related: BlogPost[], hasHero = false): string {
  const title = `${post.title} | Map Lead Extractor`;
  const canonical = `${SITE}/blog/${post.slug}`;
  const heroPath = hasHero ? `/api/blog/hero/${post.slug}.jpg` : null;
  const heroAbs = heroPath ? `${SITE}${heroPath}` : null;
  let html = template;
  html = replaceTitle(html, title);
  html = replaceMeta(html, "description", post.description);
  html = replaceMeta(html, "og:title", title);
  html = replaceMeta(html, "og:description", post.description);
  html = replaceMeta(html, "og:url", canonical);
  html = replaceMeta(html, "og:image", heroAbs ?? OG_IMAGE);
  html = replaceMeta(html, "og:image:alt", hasHero ? post.title : OG_IMAGE_ALT);
  if (hasHero) {
    html = replaceMeta(html, "og:image:width", "1536");
    html = replaceMeta(html, "og:image:height", "1024");
  }
  html = replaceMeta(html, "og:type", "article");
  html = replaceMeta(html, "twitter:title", title);
  html = replaceMeta(html, "twitter:description", post.description);
  html = replaceMeta(html, "twitter:image", heroAbs ?? OG_IMAGE);
  html = replaceCanonical(html, canonical);
  html = html.replace("</head>", () => `${blogPostJsonLd(post, heroAbs)}\n</head>`);
  const body = postBodyHtml(post, related, heroPath);
  html = html.replace(
    /<div id="root"><\/div>/,
    () => `<div id="root"><div id="seo-prerender" style="min-height:100vh;background:#0d1117;color:#c9d1d9;font-family:Inter,system-ui,sans-serif;max-width:880px;margin:0 auto;padding:6rem 1.5rem;line-height:1.6">${escRep(body)}</div></div>`,
  );
  return html;
}

export function mountBlog(app: Express, siteDir: string): void {
  const root = path.resolve(siteDir);
  const shellPath = path.join(root, "index.html");

  let shellCache: string | null = null;
  const shell = (): string | null => {
    if (shellCache) return shellCache;
    try { shellCache = fs.readFileSync(shellPath, "utf-8"); return shellCache; }
    catch { return null; }
  };

  // Individual auto-generated post → full SEO HTML. Existing prerendered posts
  // (a real file on disk) fall through to the static server untouched.
  app.get("/blog/:slug", async (req, res, next) => {
    const slug = req.params.slug;
    const staticFile = path.join(root, "blog", slug, "index.html");
    if (fs.existsSync(staticFile)) return next();
    try {
      const post = await getPublishedPostBySlug(slug);
      const template = shell();
      if (!post || !template) return next();
      const related = (await listPublishedPosts()).filter((p) => p.slug !== slug);
      const hasHero = await heroSlugSet().then((s) => s.has(slug)).catch(() => false);
      res.setHeader("Cache-Control", "no-cache");
      return res.type("html").send(renderPostHtml(template, post, related, hasHero));
    } catch (err) {
      logger.warn({ err, slug }, "Blog post render failed — falling through to SPA");
      return next();
    }
  });

  // Blog index: inject the DB posts' links into the prerendered list so crawlers
  // see every post. (Human visitors also get them via the client-side fetch.)
  app.get("/blog", async (_req, res, next) => {
    const indexFile = path.join(root, "blog", "index.html");
    let template: string;
    try { template = fs.readFileSync(indexFile, "utf-8"); } catch { return next(); }
    try {
      const posts = await listPublishedPosts();
      if (posts.length === 0) return next();
      const extra = posts
        .map((p) => `<li><a href="/blog/${p.slug}">${escHtml(p.title)}</a> — ${escHtml(p.description)}</li>`)
        .join("");
      // Insert before the first list close inside the prerendered blog list.
      const injected = template.replace(/<\/ul>/, () => `${escRep(extra)}</ul>`);
      res.setHeader("Cache-Control", "no-cache");
      return res.type("html").send(injected);
    } catch (err) {
      logger.warn({ err }, "Blog index injection failed — serving static index");
      res.setHeader("Cache-Control", "no-cache");
      return res.type("html").send(template);
    }
  });

  // Merge DB posts into the blog sitemap so Google discovers them.
  app.get("/sitemap-blog.xml", async (_req, res, next) => {
    const sitemapFile = path.join(root, "sitemap-blog.xml");
    let base: string;
    try { base = fs.readFileSync(sitemapFile, "utf-8"); } catch { return next(); }
    try {
      const posts = await listPublishedPosts();
      const entries = posts
        .map(
          (p) =>
            `  <url>\n    <loc>${SITE}/blog/${p.slug}</loc>\n    <lastmod>${isoDate(p.dateModified ?? p.datePublished)}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`,
        )
        .join("\n");
      const merged = entries ? base.replace(/<\/urlset>/, () => `${escRep(entries)}\n</urlset>`) : base;
      res.setHeader("Cache-Control", "no-cache");
      return res.type("application/xml").send(merged);
    } catch (err) {
      logger.warn({ err }, "Blog sitemap merge failed — serving static sitemap");
      res.setHeader("Cache-Control", "no-cache");
      return res.type("application/xml").send(base);
    }
  });
}
