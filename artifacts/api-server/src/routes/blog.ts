import { Router, type IRouter } from "express";
import type { BlogPost } from "@workspace/db";
import { listPublishedPosts, getPublishedPostBySlug } from "../lib/blog";

const router: IRouter = Router();

// Shape the frontend's Post type expects (src/data/posts.ts), so DB posts and
// static posts render through the same components.
function toClient(p: BlogPost, withContent: boolean) {
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
    ...(withContent ? { content: p.content } : {}),
  };
}

// List (metadata only — no heavy content) for the blog index.
router.get("/posts", async (_req, res) => {
  try {
    const posts = await listPublishedPosts();
    res.json({ posts: posts.map((p) => toClient(p, false)) });
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
    res.json({ post: toClient(post, true) });
  } catch {
    res.status(500).json({ error: "unavailable" });
  }
});

export default router;
