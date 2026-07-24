/**
 * TikTok auto-posting — the "Connect TikTok" flow plus photo publishing via
 * TikTok's Content Posting API, mirroring the Facebook integration in
 * lib/social.ts.
 *
 * The owner creates a TikTok developer app once (Login Kit + Content Posting
 * API products), pastes its Client Key/Secret in the admin Social tab, and
 * clicks Connect. Tokens live in the social_settings row: access tokens last
 * 24h and are refreshed on demand from the 365-day refresh token (which
 * TikTok ROTATES on every refresh — always persist the new one).
 *
 * Publishing posts our branded ad JPGs as photo posts. TikTok only accepts
 * photo media as PULL_FROM_URL (their server downloads it), and the URL's
 * domain must be verified in the developer portal — so images are always
 * served from the site's own domain.
 *
 * Until TikTok audits the app, direct posts are forced private (SELF_ONLY is
 * the only privacy level offered) — we pick the most public level the API
 * offers so posting starts working the moment the audit clears, no code
 * change needed.
 */
import crypto from "node:crypto";
import { db, socialSettings, type SocialSettings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const TIKTOK_API = "https://open.tiktokapis.com/v2";
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || "https://mapleadextractor.net";
export const TIKTOK_REDIRECT_URI = `${PUBLIC_ORIGIN}/api/admin/social/tiktok/callback`;
const TIKTOK_SCOPES = "user.info.basic,video.publish";
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

async function settingsRow(): Promise<SocialSettings> {
  const rows = await db.select().from(socialSettings).where(eq(socialSettings.id, 1));
  if (rows[0]) return rows[0];
  const inserted = await db.insert(socialSettings).values({ id: 1 }).onConflictDoNothing().returning();
  if (inserted[0]) return inserted[0];
  return (await db.select().from(socialSettings).where(eq(socialSettings.id, 1)))[0]!;
}

async function tiktokApp(): Promise<{ key: string; secret: string } | null> {
  const s = await settingsRow();
  const key = s.tiktokClientKey || process.env.TIKTOK_CLIENT_KEY || "";
  const secret = s.tiktokClientSecret || process.env.TIKTOK_CLIENT_SECRET || "";
  return key && secret ? { key, secret } : null;
}

export async function tiktokAppConfigured(): Promise<boolean> {
  return Boolean(await tiktokApp());
}

/** Connected = we hold a refresh token that hasn't expired. */
export async function tiktokConnected(): Promise<boolean> {
  const s = await settingsRow();
  return Boolean(
    s.tiktokRefreshToken &&
    (!s.tiktokRefreshExpiresAt || s.tiktokRefreshExpiresAt.getTime() > Date.now()) &&
    (await tiktokApp()),
  );
}

export async function tiktokAccountName(): Promise<string | null> {
  const s = await settingsRow();
  return s.tiktokDisplayName ?? null;
}

// ── OAuth ────────────────────────────────────────────────────────────────────

function signState(secret: string): string {
  const ts = Date.now().toString();
  return `${ts}.${crypto.createHmac("sha256", secret).update(ts).digest("hex")}`;
}

function stateIsValid(state: string, secret: string): boolean {
  const [ts, sig] = state.split(".");
  if (!ts || !sig) return false;
  const expected = crypto.createHmac("sha256", secret).update(ts).digest("hex");
  const ok = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  return ok && Date.now() - Number(ts) < STATE_MAX_AGE_MS;
}

export async function tiktokConnectUrl(): Promise<string> {
  const app = await tiktokApp();
  if (!app) throw new Error("TikTok app credentials missing — paste your developer app's Client Key and Secret in the Social tab first.");
  const q = new URLSearchParams({
    client_key: app.key,
    response_type: "code",
    scope: TIKTOK_SCOPES,
    redirect_uri: TIKTOK_REDIRECT_URI,
    state: signState(app.secret),
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  open_id?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(form: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${TIKTOK_API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || `TikTok token endpoint ${res.status}`);
  }
  return data;
}

async function saveTokens(t: TokenResponse): Promise<void> {
  await db
    .update(socialSettings)
    .set({
      tiktokAccessToken: t.access_token,
      tiktokExpiresAt: new Date(Date.now() + (t.expires_in ?? 86_400) * 1000),
      // TikTok rotates the refresh token — keep the newest one, always.
      ...(t.refresh_token ? { tiktokRefreshToken: t.refresh_token } : {}),
      ...(t.refresh_expires_in ? { tiktokRefreshExpiresAt: new Date(Date.now() + t.refresh_expires_in * 1000) } : {}),
      ...(t.open_id ? { tiktokOpenId: t.open_id } : {}),
      updatedAt: new Date(),
    })
    .where(eq(socialSettings.id, 1));
}

export async function tiktokHandleCallback(code: string, state: string): Promise<{ displayName: string | null }> {
  const app = await tiktokApp();
  if (!app) throw new Error("TikTok app credentials missing.");
  if (!stateIsValid(state, app.secret)) {
    throw new Error("Login link expired — go back to the admin Social tab and click Connect TikTok again.");
  }

  const tokens = await tokenRequest({
    client_key: app.key,
    client_secret: app.secret,
    code,
    grant_type: "authorization_code",
    redirect_uri: TIKTOK_REDIRECT_URI,
  });
  await saveTokens(tokens);

  // Display name is a nice-to-have for the admin chip; sending works without it.
  let displayName: string | null = null;
  try {
    const res = await fetch(`${TIKTOK_API}/user/info/?fields=open_id,display_name`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as { data?: { user?: { display_name?: string } } };
    displayName = data.data?.user?.display_name ?? null;
    if (displayName) {
      await db.update(socialSettings).set({ tiktokDisplayName: displayName, updatedAt: new Date() }).where(eq(socialSettings.id, 1));
    }
  } catch { /* ignore */ }

  logger.info({ displayName }, "TikTok account connected");
  return { displayName };
}

export async function tiktokDisconnect(): Promise<void> {
  await db
    .update(socialSettings)
    .set({
      tiktokAccessToken: null,
      tiktokRefreshToken: null,
      tiktokExpiresAt: null,
      tiktokRefreshExpiresAt: null,
      tiktokOpenId: null,
      tiktokDisplayName: null,
      updatedAt: new Date(),
    })
    .where(eq(socialSettings.id, 1));
}

/** A currently-valid access token, refreshing from the refresh token when the
 * stored one is missing or within 5 minutes of expiry. */
async function accessToken(): Promise<string> {
  const s = await settingsRow();
  const app = await tiktokApp();
  if (!app) throw new Error("TikTok app credentials missing.");
  if (!s.tiktokRefreshToken) throw new Error("TikTok not connected — use the Connect TikTok button in the admin Social tab.");
  if (s.tiktokAccessToken && s.tiktokExpiresAt && s.tiktokExpiresAt.getTime() > Date.now() + 5 * 60_000) {
    return s.tiktokAccessToken;
  }
  const tokens = await tokenRequest({
    client_key: app.key,
    client_secret: app.secret,
    grant_type: "refresh_token",
    refresh_token: s.tiktokRefreshToken,
  });
  await saveTokens(tokens);
  return tokens.access_token!;
}

// ── Public post-image URLs ───────────────────────────────────────────────────
// TikTok downloads photo media itself (PULL_FROM_URL), so DB-stored post
// images need a public, unauthenticated URL. The link carries an HMAC of the
// post id (keyed on the TikTok app secret — always present when TikTok is
// connected) so the endpoint can't be enumerated.

export async function signPublicImageId(postId: number): Promise<string | null> {
  const app = await tiktokApp();
  if (!app) return null;
  return crypto.createHmac("sha256", app.secret).update(`post-image:${postId}`).digest("hex").slice(0, 32);
}

export async function publicImageSigValid(postId: number, sig: string): Promise<boolean> {
  const expected = await signPublicImageId(postId);
  if (!expected || sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// ── Publishing ───────────────────────────────────────────────────────────────

type TikTokEnvelope<T> = { data?: T; error?: { code?: string; message?: string; log_id?: string } };

async function apiPost<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${TIKTOK_API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as TikTokEnvelope<T>;
  const errCode = data.error?.code;
  if (!res.ok || (errCode && errCode !== "ok")) {
    throw new Error(data.error?.message || `TikTok API ${res.status}`);
  }
  return (data.data ?? {}) as T;
}

type CreatorInfo = { privacy_level_options?: string[]; creator_nickname?: string };

/** Most-public privacy level TikTok currently allows this account/app. Until
 * the app passes TikTok's audit this is SELF_ONLY (posts stay private). */
function pickPrivacy(options: string[] | undefined): { level: string; restricted: boolean } {
  const opts = options ?? [];
  if (opts.includes("PUBLIC_TO_EVERYONE")) return { level: "PUBLIC_TO_EVERYONE", restricted: false };
  const level = opts[0] ?? "SELF_ONLY";
  return { level, restricted: true };
}

export type TikTokPublishResult = {
  publishId: string;
  status: string;            // PUBLISH_COMPLETE | PROCESSING_* | FAILED
  postId: string | null;     // TikTok's public post id, when it reported one
  privacyLevel: string;
  restricted: boolean;       // true = app unaudited, post went out private
};

/**
 * Publish one photo post (our ad creative + caption) to the connected account.
 * `imageUrls` must be public HTTPS URLs on the portal-verified domain.
 * Waits briefly for TikTok to finish processing; a still-processing post is
 * returned as success with its last known status (TikTok finishes async).
 */
export async function publishTikTokPhoto(opts: { caption: string; imageUrls: string[] }): Promise<TikTokPublishResult> {
  if (opts.imageUrls.length === 0) throw new Error("A TikTok photo post needs at least one image URL.");
  const token = await accessToken();

  const creator = await apiPost<CreatorInfo>("/post/publish/creator_info/query/", token, {});
  const { level, restricted } = pickPrivacy(creator.privacy_level_options);

  // TikTok splits the caption: `title` is the short headline (max 90 runes),
  // `description` carries the full text + hashtags (max 4000).
  const caption = opts.caption.trim();
  const firstLine = caption.split("\n")[0] ?? "";
  const title = (firstLine.length > 88 ? `${firstLine.slice(0, 87)}…` : firstLine) || "New post";

  const init = await apiPost<{ publish_id?: string }>("/post/publish/content/init/", token, {
    post_mode: "DIRECT_POST",
    media_type: "PHOTO",
    post_info: {
      title,
      description: caption.slice(0, 3900),
      privacy_level: level,
      disable_comment: false,
      auto_add_music: true,
      brand_content_toggle: false,
      // Our own promotional content → TikTok's "promotional content" label.
      brand_organic_toggle: true,
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_cover_index: 0,
      photo_images: opts.imageUrls.slice(0, 35),
    },
  });
  if (!init.publish_id) throw new Error("TikTok did not return a publish id.");

  // Poll for the outcome — TikTok downloads the image and publishes async.
  // The status endpoint allows 6 req/min per token, so poll gently.
  let status = "PROCESSING_DOWNLOAD";
  let postId: string | null = null;
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 12_000));
    try {
      const s = await apiPost<{ status?: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] }>(
        "/post/publish/status/fetch/", token, { publish_id: init.publish_id },
      );
      status = s.status ?? status;
      const ids = s.publicaly_available_post_id;
      if (ids?.length) postId = String(ids[0]);
      if (status === "FAILED") throw new Error(`TikTok rejected the post: ${s.fail_reason || "unknown reason"}`);
      if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") break;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("TikTok rejected")) throw err;
      // transient status-poll failure — keep the last known status
      logger.warn({ err, publishId: init.publish_id }, "TikTok status poll failed");
    }
  }

  logger.info({ publishId: init.publish_id, status, privacy: level }, "TikTok photo post submitted");
  return { publishId: init.publish_id, status, postId, privacyLevel: level, restricted };
}
