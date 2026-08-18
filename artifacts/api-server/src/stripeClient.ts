import Stripe from 'stripe';
import { StripeSync } from 'stripe-replit-sync';

async function getStripeCredentials(): Promise<{ secretKey: string; webhookSecret?: string }> {
  // Direct-key path (takes precedence): if a Stripe secret key is provided as a
  // plain Replit Secret / env var, use it and skip the Replit connector
  // entirely. This lets the owner paste an sk_live_… key straight into Secrets
  // and have every checkout use it immediately. The key is never logged.
  const directKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (directKey) {
    return {
      secretKey: directKey,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || undefined,
    };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      'Missing Replit environment variables. ' +
      'Ensure the Stripe integration is connected via the Integrations tab.'
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as { items?: { settings?: { secret?: string; publishable?: string; webhook_secret?: string } }[] };
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret) {
    throw new Error(
      'Stripe integration not connected or missing secret key. ' +
      'Connect Stripe via the Integrations tab first.'
    );
  }

  return {
    secretKey: settings.secret,
    // Prefer the integration-managed secret; fall back to the env var set
    // after registering the webhook endpoint with Stripe.
    webhookSecret: settings.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET,
  };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

/**
 * Report whether the configured secret key is LIVE or TEST — by prefix only.
 * NEVER returns, logs, or exposes any part of the key itself. Returns
 * "unknown" if the key can't be read or has an unrecognized prefix.
 */
export async function getStripeMode(): Promise<"live" | "test" | "unknown"> {
  try {
    const { secretKey } = await getStripeCredentials();
    if (secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_")) return "live";
    if (secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_")) return "test";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/** True when a webhook signing secret is available (integration or env var).
 *  Returns a boolean only — never the secret. */
export async function isWebhookSecretConfigured(): Promise<boolean> {
  try {
    const { webhookSecret } = await getStripeCredentials();
    return typeof webhookSecret === "string" && webhookSecret.length > 0;
  } catch {
    return false;
  }
}

export async function getWebhookSecret(): Promise<string> {
  const { webhookSecret } = await getStripeCredentials();
  return webhookSecret ?? '';
}

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const { secretKey, webhookSecret } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? '',
  });
}
