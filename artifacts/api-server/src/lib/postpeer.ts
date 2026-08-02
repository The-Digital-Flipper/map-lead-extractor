/**
 * PostPeer integration — social posting without per-platform developer apps.
 *
 * The official TikTok Content Posting API (lib/tiktok.ts) needs an approved
 * developer app and an audit before posts can be public. PostPeer sidesteps
 * that: the owner signs up at postpeer.dev, links accounts through PostPeer's
 * OAuth flows once, and we publish through their API with a single key
 * (POSTPEER_API_KEY). Posts are public immediately.
 *
 * The daily cross-post goes to EVERY image-capable account linked in
 * PostPeer — link Instagram/Facebook/LinkedIn/X there and they're picked up
 * automatically on the next post, no code or config change. YouTube (video
 * only) and Pinterest (needs a board) are skipped. Each platform in a post
 * consumes one PostPeer credit (free tier: 20/month).
 *
 * When the key is present this path takes priority over the official TikTok
 * API in crossPostToTikTok; remove the key to fall back. Same pull model:
 * PostPeer downloads the image from our public URL.
 */
import { logger } from "./logger";

const POSTPEER_API = "https://api.postpeer.dev/v1";

// Platforms that accept a single-image post with no extra required config.
const IMAGE_PLATFORMS = new Set([
  "tiktok", "instagram", "facebook", "linkedin", "twitter", "threads", "bluesky", "googlebusiness",
]);

export function postpeerConfigured(): boolean {
  return !!process.env.POSTPEER_API_KEY;
}

function authHeaders(): Record<string, string> {
  return { "x-access-key": process.env.POSTPEER_API_KEY!, "Content-Type": "application/json" };
}

export type Integration = { id: string; platform: string; username: string | null; displayName: string | null };

// Linked accounts, cached briefly — they change only when the owner links or
// unlinks something, but we want new links picked up without a restart.
let cached: { at: number; list: Integration[] } | null = null;
const CACHE_MS = 10 * 60 * 1000;

export async function postpeerIntegrations(): Promise<Integration[]> {
  if (!postpeerConfigured()) return [];
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.list;
  const res = await fetch(`${POSTPEER_API}/connect/integrations`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return cached?.list ?? [];
  const data = (await res.json().catch(() => ({}))) as { integrations?: Integration[] };
  cached = { at: Date.now(), list: data.integrations ?? [] };
  return cached.list;
}

export async function postpeerTikTokAccount(): Promise<{ id: string; username: string | null } | null> {
  const acct = (await postpeerIntegrations()).find((i) => i.platform === "tiktok");
  return acct ? { id: acct.id, username: acct.username ?? acct.displayName } : null;
}

export type PlatformResult = { platform: string; success: boolean; postUrl: string | null; error: string | null };

/** Publish one image post to every image-capable account linked in PostPeer.
 * Returns a per-platform result list; throws only when nothing could even be
 * attempted (no linked accounts / request-level failure). */
export async function postpeerPostImageAll(opts: { caption: string; imageUrl: string }): Promise<{
  postId: string | null;
  results: PlatformResult[];
}> {
  const targets = (await postpeerIntegrations()).filter((i) => IMAGE_PLATFORMS.has(i.platform));
  if (targets.length === 0) {
    throw new Error("No image-capable accounts linked in PostPeer — connect TikTok (or others) at postpeer.dev first.");
  }
  const res = await fetch(`${POSTPEER_API}/posts/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      content: opts.caption,
      mediaItems: [{ type: "image", url: opts.imageUrl }],
      platforms: targets.map((t) => ({
        platform: t.platform,
        accountId: t.id,
        ...(t.platform === "tiktok" ? { platformSpecificData: { privacyLevel: "PUBLIC_TO_EVERYONE" } } : {}),
      })),
    }),
    // PostPeer holds the request while the networks process the media.
    signal: AbortSignal.timeout(120_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean; message?: string; postId?: string;
    platforms?: { platform: string; success: boolean; platformPostUrl?: string; error?: string }[];
  };
  if (!res.ok || !Array.isArray(data.platforms)) {
    const msg = data.message || `PostPeer ${res.status}`;
    logger.error({ status: res.status, msg }, "PostPeer post failed");
    throw new Error(msg);
  }
  return {
    postId: data.postId ?? null,
    results: data.platforms.map((p) => ({
      platform: p.platform,
      success: p.success,
      postUrl: p.platformPostUrl ?? null,
      error: p.error ?? null,
    })),
  };
}

/** OAuth URL the owner opens to link (or re-link) a platform inside PostPeer. */
export async function postpeerConnectUrl(platform: string): Promise<string | null> {
  if (!postpeerConfigured()) return null;
  const res = await fetch(`${POSTPEER_API}/connect/${platform}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; authUrl?: string };
  return data.url ?? data.authUrl ?? null;
}
