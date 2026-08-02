/**
 * Owner-uploaded landing-page pictures (the /go/<slug>.jpg share/ad creative).
 *
 * Defaults ship as static files in the built site; an owner can override any
 * one from the admin Social tab. Overrides live in the landing_images table so
 * they survive redeploys (the autoscale filesystem is rebuilt each release).
 * The /go/<slug>.jpg route calls loadLandingImage() first and only falls back
 * to the bundled file when there's no override.
 */
import { db, landingImages } from "@workspace/db";
import { eq } from "drizzle-orm";

// Slugs are admin-supplied but still validated so they can't wander outside a
// simple filename shape.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export function validSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export function allowedImageMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime.toLowerCase());
}

// 8 MB ceiling on the decoded image — generous for a social creative, small
// enough to keep the row and the base64 round-trip cheap.
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function saveLandingImage(slug: string, mime: string, bytes: Buffer): Promise<void> {
  const data = bytes.toString("base64");
  await db.insert(landingImages)
    .values({ slug, mime, data, updatedAt: new Date() })
    .onConflictDoUpdate({ target: landingImages.slug, set: { mime, data, updatedAt: new Date() } });
}

export async function deleteLandingImage(slug: string): Promise<boolean> {
  const res = await db.delete(landingImages)
    .where(eq(landingImages.slug, slug))
    .returning({ slug: landingImages.slug });
  return res.length > 0;
}

/** Returns the override image for a slug, or null to use the bundled default. */
export async function loadLandingImage(slug: string): Promise<{ mime: string; bytes: Buffer; updatedAt: Date } | null> {
  const [row] = await db.select().from(landingImages).where(eq(landingImages.slug, slug)).limit(1);
  if (!row) return null;
  return { mime: row.mime, bytes: Buffer.from(row.data, "base64"), updatedAt: row.updatedAt };
}

/** Which slugs currently have an owner override (for the admin UI badges). */
export async function listLandingImageSlugs(): Promise<string[]> {
  const rows = await db.select({ slug: landingImages.slug }).from(landingImages);
  return rows.map((r) => r.slug);
}
