import { Router, type IRouter } from "express";
import type { BlogPost } from "@workspace/db";
import { listPublishedPosts, getPublishedPostBySlug } from "../lib/blog";
import { loadBlogHero, heroSlugSet, validHeroSlug } from "../lib/blogImages";

const router: IRouter = Router();

export function heroUrlPath(slug: string): string {
  return `/api/blog/hero/${slug}.jpg`;
}

// Shape the frontend's Post type expects (src/data/posts.ts), so DB posts and
// static posts render through the same components.
function toClient(p: BlogPost, withContent: boolean, hasHero: boolean) {
  const published = p.datePublished instanceof Date ? p.datePublished : new Date(p.datePublished);
  const modified = p.dateModified ? (p.dateModified instanceof Date ? p.dateModified : new Date(p.dateModified)) : undefined;
  return {
    slug: p.slug,
    title: p.title,
    description: p.description,
    date: published.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    datePublished: published.toISOString().slice(0, 10),
    dateModified: modified?.toISOString().slice(0, 10),
    readTime: p.readTime,
    category: p.category,
    authorName: p.authorName,
    ...(hasHero ? { image: heroUrlPath(p.slug) } : {}),
    ...(withContent ? { content: p.content } : {}),
  };
}

// List (metadata only — no heavy content) for the blog index.
router.get("/posts", async (_req, res) => {
  try {
    const [posts, heroes] = await Promise.all([listPublishedPosts(), heroSlugSet()]);
    res.json({ posts: posts.map((p) => toClient(p, false, heroes.has(p.slug))) });
  } catch {
    res.json({ posts: [] }); // never break the blog index if the DB hiccups
  }
});

// Full single post for client-side rendering of an auto-generated article.
router.get("/posts/:slug", async (req, res) => {
  try {
    const post = await getPublishedPostBySlug(req.params.slug);
    if (!post) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const hero = await loadBlogHero(post.slug).catch(() => null);
    res.json({ post: toClient(post, true, !!hero) });
  } catch {
    res.status(500).json({ error: "unavailable" });
  }
});

// The hero photo itself. Works for BOTH auto-generated and static posts (the
// backfill generates images for every slug it knows about).
router.get("/hero/:file", async (req, res) => {
  const slug = String(req.params.file ?? "").replace(/\.jpg$/i, "");
  if (!validHeroSlug(slug)) {
    res.status(404).end();
    return;
  }
  try {
    const img = await loadBlogHero(slug);
    if (!img) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", img.mime);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(img.bytes);
  } catch {
    res.status(404).end();
  }
});

export default router;
