import express, { type Express } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Locate the built marketing site (artifacts/lead-extractor-site/dist/public).
 * Tries SITE_DIR, then paths relative to this module, then the cwd.
 */
export function resolveSiteDir(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.SITE_DIR,
    path.resolve(here, "../../lead-extractor-site/dist/public"), // from dist/ or src/
    path.resolve(here, "../../../lead-extractor-site/dist/public"),
    path.resolve(process.cwd(), "artifacts/lead-extractor-site/dist/public"),
    path.resolve(process.cwd(), "../lead-extractor-site/dist/public"),
    path.resolve(process.cwd(), "dist/public"),
  ].filter((c): c is string => Boolean(c));

  for (const c of candidates) {
    try {
      if (fs.existsSync(path.join(c, "index.html"))) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Serve the prerendered SPA so each public route gets its OWN HTML:
 *   1. Real files (hashed assets, sitemap.xml, robots.txt, images) are served directly.
 *   2. Clean URLs map to their prerendered page (/tools -> /tools/index.html,
 *      /leads/plumbers -> /leads/plumbers/index.html) — preserving per-page
 *      title/description/canonical/JSON-LD.
 *   3. Only routes WITHOUT a prerendered file (e.g. /dashboard, /admin,
 *      /sign-in) fall back to the root index.html for client-side routing.
 * /api/* is never handled here.
 */
export function mountSite(app: Express, siteDir: string): void {
  const root = path.resolve(siteDir);

  // 1) Static files. index:false so "/" is handled by the page resolver below;
  //    HTML is never cached so deploys take effect immediately.
  app.use(
    express.static(root, {
      index: false,
      redirect: false,
      maxAge: "1h",
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
      },
    }),
  );

  // 2) Page resolver + SPA fallback (final middleware; Express 5 has no "*" route).
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/")) return next();

    const rel = req.path.replace(/^\/+/, "").replace(/\/+$/, "");
    if (rel) {
      const pageFile = path.resolve(root, rel, "index.html");
      // Guard against path traversal: must stay inside the site root.
      if (pageFile.startsWith(root + path.sep) && fs.existsSync(pageFile)) {
        res.setHeader("Cache-Control", "no-cache");
        return res.sendFile(pageFile);
      }
    }

    // App routes without a prerendered file → SPA shell.
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(path.join(root, "index.html"));
  });
}
