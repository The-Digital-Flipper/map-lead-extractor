/**
 * Replit "Google Mail" connector — lets the owner send from their own Gmail by
 * clicking Connect in Replit's integrations panel (OAuth) instead of pasting
 * GMAIL_USER/GMAIL_APP_PASSWORD secrets. Tokens come from the Replit
 * connectors service (which refreshes them server-side); sending goes through
 * the Gmail REST API, so no SMTP credentials ever touch this codebase.
 *
 * SMTP app-password secrets, when present, still take precedence (they also
 * unlock IMAP reply-watching, which the connector token doesn't cover).
 */
import { logger } from "./logger";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

type ConnState = { accessToken: string; expiresAt: number; email: string | null };
let cached: ConnState | null = null;
// Sync mirror of "is a connection present" for the provider-readiness checks,
// refreshed by the watcher and by every token fetch.
let available = false;

function replitToken(): string | null {
  if (process.env.REPL_IDENTITY) return "repl " + process.env.REPL_IDENTITY;
  if (process.env.WEB_REPL_RENEWAL) return "depl " + process.env.WEB_REPL_RENEWAL;
  return null;
}

async function fetchConnection(): Promise<ConnState | null> {
  const host = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = replitToken();
  if (!host || !token) return null;
  const res = await fetch(`https://${host}/api/v2/connection?include_secrets=true&connector_names=google-mail`, {
    headers: { Accept: "application/json", X_REPLIT_TOKEN: token },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { items?: { settings?: Record<string, unknown> }[] };
  const s = data.items?.[0]?.settings as
    | { access_token?: string; expires_at?: string; oauth?: { credentials?: { access_token?: string; expires_at?: string } } }
    | undefined;
  const accessToken = s?.access_token ?? s?.oauth?.credentials?.access_token;
  if (!accessToken) return null;
  const expiresRaw = s?.expires_at ?? s?.oauth?.credentials?.expires_at;
  const expiresAt = expiresRaw ? new Date(expiresRaw).getTime() : Date.now() + 5 * 60_000;

  // The account's address (used as the From) — ask Gmail once and keep it.
  let email = cached?.email ?? null;
  if (!email) {
    try {
      const p = await fetch(`${GMAIL_API}/profile`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (p.ok) email = ((await p.json()) as { emailAddress?: string }).emailAddress ?? null;
    } catch { /* profile is a nice-to-have; sending still works as "me" */ }
  }
  return { accessToken, expiresAt, email };
}

async function connection(): Promise<ConnState | null> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached;
  cached = await fetchConnection().catch((err) => {
    logger.warn({ err }, "google-mail connector fetch failed");
    return null;
  });
  available = !!cached;
  return cached;
}

export function connectorGmailAvailable(): boolean {
  return available;
}
export function connectorGmailAddress(): string | null {
  return cached?.email ?? null;
}

export async function refreshGmailConnector(): Promise<boolean> {
  await connection();
  return available;
}

/** Poll for the connection at startup and every few minutes, so the sync
 * readiness checks notice the owner clicking Connect without a restart. */
export function startGmailConnectorWatcher(): void {
  void refreshGmailConnector().then((ok) => {
    if (ok) logger.info({ email: connectorGmailAddress() }, "google-mail connector active");
  });
  setInterval(() => void refreshGmailConnector(), 5 * 60_000);
}

// ── Sending ──────────────────────────────────────────────────────────────────

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// RFC 2047 encode a header value when it contains non-ASCII.
function encHeader(v: string): string {
  return /[^\x20-\x7e]/.test(v) ? `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=` : v;
}

export async function sendViaGmailConnector(opts: {
  fromName: string;
  to: string;
  replyTo?: string;
  subject: string;
  text?: string;
  html: string;
  messageId?: string;
  headers?: Record<string, string>;
}): Promise<{ providerId: string | null; from: string }> {
  const conn = await connection();
  if (!conn) throw new Error("Google Mail is not connected — open Replit's integrations panel and connect it.");
  const from = conn.email ?? "me";

  const top: string[] = [
    `From: ${opts.fromName ? `${encHeader(opts.fromName)} <${from}>` : from}`,
    `To: ${opts.to}`,
    ...(opts.replyTo ? [`Reply-To: ${opts.replyTo}`] : []),
    `Subject: ${encHeader(opts.subject)}`,
    ...(opts.messageId ? [`Message-ID: ${opts.messageId}`] : []),
    ...Object.entries(opts.headers ?? {}).map(([k, v]) => `${k}: ${v}`),
    "MIME-Version: 1.0",
  ];
  const htmlPart = [
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.html, "utf8").toString("base64"),
  ];
  const body = opts.text
    ? (() => {
        const boundary = `b${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        return [
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          "",
          `--${boundary}`,
          'Content-Type: text/plain; charset="UTF-8"',
          "Content-Transfer-Encoding: base64",
          "",
          Buffer.from(opts.text, "utf8").toString("base64"),
          `--${boundary}`,
          ...htmlPart,
          `--${boundary}--`,
        ];
      })()
    : htmlPart;

  const raw = b64url(Buffer.from([...top, ...body].join("\r\n"), "utf8"));
  const res = await fetch(`${GMAIL_API}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${conn.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok) throw new Error(data.error?.message || `Gmail API ${res.status}`);
  return { providerId: data.id ?? null, from };
}
