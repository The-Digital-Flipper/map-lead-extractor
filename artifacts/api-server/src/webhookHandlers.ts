import Stripe from 'stripe';
import { getStripeSync, getUncachableStripeClient, getWebhookSecret } from './stripeClient';
import { resendConfigured, gmailSendReady, sendGmailMail, replitMailConfigured, sendReplitMail } from './lib/outreach-auto';
import { logger } from './lib/logger';
import { storage } from './storage';

const LICENSE_PRODUCT_ID = 'prod_UzYDwzsJLH96T0';
const LIFETIME_PRODUCT_ID = 'prod_UzaVAAEqG0DsZH';
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'https://mapleadextractor.net';
const STORE_URL =
  'https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg';

// ── License fulfillment email ────────────────────────────────────────────────

function licenseEmailHtml(): string {
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px">
  <p style="font-size:18px;font-weight:700;margin-bottom:4px">🎉 You're in — here's how to get started</p>
  <p style="color:#555;margin-top:0">Thanks for purchasing Map Lead Extractor. Follow the steps below and you'll be pulling leads in under two minutes.</p>

  <div style="background:#f6fff9;border:1px solid #00b84a;border-radius:10px;padding:20px 24px;margin:20px 0">
    <p style="margin:0 0 12px;font-weight:700;font-size:16px">Step 1 — Install the Chrome extension</p>
    <a href="${STORE_URL}" style="display:inline-block;background:#00b84a;color:#fff;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px">
      Install from Chrome Web Store →
    </a>
    <p style="margin:12px 0 0;font-size:13px;color:#666">Works in Chrome and any Chromium-based browser (Edge, Brave, Arc).</p>
  </div>

  <div style="background:#fafafa;border:1px solid #e0e0e0;border-radius:10px;padding:20px 24px;margin:20px 0">
    <p style="margin:0 0 10px;font-weight:700;font-size:15px">Step 2 — Use it</p>
    <ol style="margin:0;padding-left:20px;color:#444">
      <li style="margin-bottom:8px">Open <a href="https://www.google.com/maps" style="color:#00b84a">Google Maps</a> in Chrome.</li>
      <li style="margin-bottom:8px">Search for any type of business — e.g. <em>"roofers in Dallas TX"</em>.</li>
      <li style="margin-bottom:8px">Click the Map Lead Extractor icon in your toolbar.</li>
      <li style="margin-bottom:8px">Hit <strong>Start Extraction</strong> and watch leads fill up.</li>
      <li>Click <strong>Export to CSV</strong> when done — opens straight in Excel or Google Sheets.</li>
    </ol>
  </div>

  <p style="color:#555">
    Need help? Just reply to this email and we'll get back to you quickly.<br>
    You can also visit <a href="${PUBLIC_ORIGIN}" style="color:#00b84a">${PUBLIC_ORIGIN}</a> any time.
  </p>

  <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:12px;margin-top:20px">
    Map Lead Extractor · <a href="${PUBLIC_ORIGIN}/privacy" style="color:#999">Privacy Policy</a>
  </p>
</div>`.trim();
}

async function sendLicenseEmail(to: string, sessionId: string): Promise<void> {
  const subject = 'Your Map Lead Extractor license — install it now';
  const html = licenseEmailHtml();

  try {
    if (resendConfigured()) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: 'MapLeadExtractor <noreply@mapleadextractor.net>', to, subject, html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}`);
      logger.info({ to, sessionId }, 'License fulfillment email sent via Resend');
    } else if (gmailSendReady()) {
      await sendGmailMail({ fromName: 'MapLeadExtractor', to, subject, html });
      logger.info({ to, sessionId }, 'License fulfillment email sent via Gmail');
    } else if (replitMailConfigured()) {
      await sendReplitMail({ to, subject, html });
      logger.info({ to, sessionId }, 'License fulfillment email sent via Replit Mail');
    } else {
      logger.warn({ to, sessionId }, 'License purchased but no email provider configured — buyer not notified');
    }
  } catch (err) {
    logger.error({ err, to, sessionId }, 'License fulfillment email failed');
    throw err;
  }
}

// ── License fulfillment detection ───────────────────────────────────────────

async function handleLicenseFulfillment(payload: Buffer, signature: string): Promise<void> {
  const webhookSecret = await getWebhookSecret();
  if (!webhookSecret) {
    logger.warn('No webhook secret available — skipping license fulfillment check');
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = await getUncachableStripeClient();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    // Signature errors will bubble up from StripeSync too — don't double-log
    return;
  }

  if (event.type !== 'checkout.session.completed') return;

  const session = event.data.object as Stripe.Checkout.Session;
  const email = session.customer_details?.email;
  if (!email) {
    logger.warn({ sessionId: session.id }, 'License checkout completed but no customer email');
    return;
  }

  // Expand line items to confirm which product was purchased
  const stripe = await getUncachableStripeClient();
  let full: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>> | null = null;
  try {
    full = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['line_items.data.price.product'],
    });
  } catch (err) {
    logger.error({ err, sessionId: session.id }, 'Could not expand session line items');
    return;
  }

  const lineItems = full.line_items?.data ?? [];

  const isLicense = lineItems.some((item) => {
    const product = item.price?.product;
    return (
      typeof product === 'object' && product !== null &&
      !('deleted' in product) &&
      (product as Stripe.Product).id === LICENSE_PRODUCT_ID
    );
  });

  if (isLicense) {
    logger.info({ email, sessionId: session.id }, '$197 license purchased — sending fulfillment email');
    await sendLicenseEmail(email, session.id);
  }

  // ── Lifetime Membership fulfillment ─────────────────────────────────────────
  const isLifetime = lineItems.some((item) => {
    const product = item.price?.product;
    return (
      typeof product === 'object' &&
      product !== null &&
      !('deleted' in product) &&
      (product as Stripe.Product).id === LIFETIME_PRODUCT_ID
    );
  });

  if (isLifetime) {
    logger.info({ email, sessionId: session.id }, 'Lifetime membership purchased — granting access');
    // Grant by customer ID (user must be signed in to have one) or by email fallback
    const customerId = typeof session.customer === 'string' ? session.customer : null;
    if (customerId) {
      try {
        await storage.setLifetimeMemberByCustomerId(customerId);
        logger.info({ customerId, email }, 'Lifetime membership granted by customer ID');
      } catch (err) {
        logger.error({ err, customerId }, 'Failed to grant lifetime membership by customer ID');
      }
    }
    // Send welcome email
    await sendLifetimeEmail(email, session.id);
  }
}

// ── Lifetime fulfillment email ───────────────────────────────────────────────

function lifetimeEmailHtml(): string {
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px">
  <p style="font-size:18px;font-weight:700;margin-bottom:4px">🎉 Welcome to Lifetime Membership!</p>
  <p style="color:#555;margin-top:0">You now have lifetime access to all Map Lead Extractor platform tools. Here's what you unlocked:</p>

  <div style="background:#f6fff9;border:1px solid #00b84a;border-radius:10px;padding:20px 24px;margin:20px 0">
    <p style="margin:0 0 12px;font-weight:700;font-size:16px">✅ Your lifetime tools</p>
    <ul style="margin:0;padding-left:20px;color:#444">
      <li style="margin-bottom:8px"><strong>Google Maps Scraper</strong> — Run unlimited scrape jobs and build your own lead lists</li>
      <li style="margin-bottom:8px"><strong>Command Center</strong> — SMS inbox + bulk text blasts to your leads</li>
      <li style="margin-bottom:8px"><strong>Lead Enrichment</strong> — AI-powered research on any business</li>
      <li style="margin-bottom:8px"><strong>Unlimited AI Lead Finds</strong> — No daily search limits</li>
    </ul>
  </div>

  <div style="background:#fafafa;border:1px solid #e0e0e0;border-radius:10px;padding:20px 24px;margin:20px 0">
    <p style="margin:0 0 10px;font-weight:700;font-size:15px">Getting started</p>
    <ol style="margin:0;padding-left:20px;color:#444">
      <li style="margin-bottom:8px"><a href="${PUBLIC_ORIGIN}/sign-in" style="color:#00b84a">Sign in to your dashboard</a> — your membership is already active.</li>
      <li style="margin-bottom:8px">Head to <a href="${PUBLIC_ORIGIN}/scraper" style="color:#00b84a">Scraper Store</a> to run your first scrape job.</li>
      <li>Open <a href="${PUBLIC_ORIGIN}/command-center" style="color:#00b84a">Command Center</a> to start your SMS outreach.</li>
    </ol>
  </div>

  <p style="color:#555">
    Questions? Just reply to this email — we'll get back to you quickly.<br>
    Your dashboard: <a href="${PUBLIC_ORIGIN}/dashboard" style="color:#00b84a">${PUBLIC_ORIGIN}/dashboard</a>
  </p>

  <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:12px;margin-top:20px">
    Map Lead Extractor · <a href="${PUBLIC_ORIGIN}/privacy" style="color:#999">Privacy Policy</a>
  </p>
</div>`.trim();
}

async function sendLifetimeEmail(to: string, sessionId: string): Promise<void> {
  const subject = '🎉 Your Lifetime Membership is active — here\'s how to get started';
  const html = lifetimeEmailHtml();

  try {
    if (resendConfigured()) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: 'MapLeadExtractor <noreply@mapleadextractor.net>', to, subject, html }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}`);
      logger.info({ to, sessionId }, 'Lifetime welcome email sent via Resend');
    } else if (gmailSendReady()) {
      await sendGmailMail({ fromName: 'MapLeadExtractor', to, subject, html });
      logger.info({ to, sessionId }, 'Lifetime welcome email sent via Gmail');
    } else if (replitMailConfigured()) {
      await sendReplitMail({ to, subject, html });
      logger.info({ to, sessionId }, 'Lifetime welcome email sent via Replit Mail');
    } else {
      logger.warn({ to, sessionId }, 'Lifetime purchased but no email provider configured');
    }
  } catch (err) {
    logger.error({ err, to, sessionId }, 'Lifetime welcome email failed');
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'This usually means express.json() parsed the body before reaching this handler.'
      );
    }

    // Handle $197 license fulfillment before passing to StripeSync.
    // Errors here are caught so a fulfillment failure never blocks the 200 OK
    // that tells Stripe not to retry the webhook.
    try {
      await handleLicenseFulfillment(payload, signature);
    } catch (err) {
      logger.error({ err }, 'License fulfillment handler threw — continuing to StripeSync');
    }

    // StripeSync handles subscription creation, renewals, invoice events, etc.
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }
}
