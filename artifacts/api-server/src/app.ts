import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import privacyRouter from "./routes/privacy.js";
import { mountSite, resolveSiteDir } from "./serveSite.js";
import { mountBlog } from "./blogSite.js";
import { loadLandingImage, validSlug } from "./lib/landingImages.js";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { WebhookHandlers } from "./webhookHandlers";
import { isWebhookSecretConfigured } from "./stripeClient";

const app: Express = express();

// Redirect .replit.dev browser traffic to the custom domain (skip API calls)
app.use((req, res, next) => {
  const host = req.hostname ?? "";
  if (
    (host.endsWith(".replit.dev") || host.endsWith(".riker.replit.dev")) &&
    !req.path.startsWith("/api/")
  ) {
    const target = `https://mapleadextractor.net${req.originalUrl}`;
    return res.redirect(308, target);
  }
  next();
});

// Clerk proxy
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ⚠️ Stripe webhook MUST be registered BEFORE express.json() so the handler
// receives the RAW request body (a Buffer). Signature verification only works
// against the exact bytes Stripe signed — a JSON-parsed/re-serialized body
// breaks it. `type: () => true` captures the raw body regardless of the
// Content-Type header Stripe sends.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: () => true }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    const raw = req.body as Buffer;

    // 0) Webhook secret is OPTIONAL. The $29 pack and the $24/mo subscription
    //    fulfill by polling Stripe with the secret key (see packWorker.ts /
    //    subscriptions.ts) — no webhook needed. Only the $197 license/lifetime
    //    email relies on this endpoint. With no secret we can't verify
    //    authenticity, so we safely acknowledge and ignore rather than trust an
    //    unverified payload. Set STRIPE_WEBHOOK_SECRET only to enable $197 email.
    if (!(await isWebhookSecretConfigured())) {
      logger.info("Stripe webhook received but no signing secret configured — ignoring (pack + subscription orders fulfill via polling).");
      res.status(200).json({ received: true, ignored: "no_webhook_secret" });
      return;
    }

    // 1) Verify the signature against the RAW body FIRST. A forged/invalid
    //    webhook is rejected here — before we acknowledge — with a distinct log.
    let event;
    try {
      event = await WebhookHandlers.verify(raw, sig);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err: msg }, "STRIPE WEBHOOK SIGNATURE VERIFICATION FAILED");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    // 2) Acknowledge immediately so Stripe doesn't wait on fulfillment work
    //    (email sends, DB writes, StripeSync) and never times out / retries.
    res.status(200).json({ received: true });

    // 3) Run fulfillment AFTER acknowledging. Failures are logged loudly for
    //    manual reconciliation — we've already told Stripe 200, so it won't retry.
    void WebhookHandlers.processWebhook(raw, sig).catch((err: unknown) => {
      logger.error(
        { err, eventId: event.id, eventType: event.type },
        "Stripe webhook fulfillment failed AFTER acknowledgement — reconcile manually",
      );
    });
  }
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  }))
);

app.use(privacyRouter);
app.use("/api", router);

// Owner-uploaded landing-page pictures win over the bundled static file at the
// same URL. Registered before the static site so an override is served when one
// exists; otherwise we fall through to the file in dist/public/go/<slug>.jpg.
app.get(/^\/go\/([a-z0-9][a-z0-9-]{0,63})\.jpg$/, async (req, res, next) => {
  const slug = req.params[0];
  if (!validSlug(slug)) return next();
  try {
    const img = await loadLandingImage(slug);
    if (!img) return next();
    // no-cache (revalidate every view) so a freshly uploaded picture shows up
    // immediately — the admin preview and landing pages reuse the same URL, so
    // any max-age keeps showing the old creative after a change. Conditional
    // 304s keep repeat views cheap.
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Last-Modified", img.updatedAt.toUTCString());
    const ims = Date.parse(String(req.headers["if-modified-since"] ?? ""));
    // Last-Modified has second precision, so compare on whole seconds.
    if (!Number.isNaN(ims) && Math.floor(img.updatedAt.getTime() / 1000) * 1000 <= ims) {
      res.status(304).end();
      return;
    }
    res.setHeader("Content-Type", img.mime);
    res.send(img.bytes);
  } catch (err) {
    logger.error({ err, slug }, "landing image serve failed");
    next();
  }
});

// Serve the prerendered marketing site so each public route returns its OWN
// HTML (correct per-page title/meta/canonical/JSON-LD), with SPA fallback for
// app routes like /dashboard. Registered after /api so the API always wins.
const SITE_DIR = resolveSiteDir();
if (SITE_DIR) {
  // Auto-generated blog posts are rendered here (DB-backed, full SEO HTML)
  // BEFORE the static server so a slug we own wins; everything else falls
  // through to the prerendered files.
  mountBlog(app, SITE_DIR);
  mountSite(app, SITE_DIR);
  logger.info({ siteDir: SITE_DIR }, "Serving prerendered site");
} else {
  logger.warn("Prerendered site not found — static site serving disabled");
}

export default app;
