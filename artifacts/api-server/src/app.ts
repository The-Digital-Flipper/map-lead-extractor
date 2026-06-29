import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import privacyRouter from "./routes/privacy.js";
import { mountSite, resolveSiteDir } from "./serveSite.js";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { WebhookHandlers } from "./webhookHandlers";

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

// ⚠️ Stripe webhook MUST be registered BEFORE express.json()
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: msg });
    }
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

// Serve the prerendered marketing site so each public route returns its OWN
// HTML (correct per-page title/meta/canonical/JSON-LD), with SPA fallback for
// app routes like /dashboard. Registered after /api so the API always wins.
const SITE_DIR = resolveSiteDir();
if (SITE_DIR) {
  mountSite(app, SITE_DIR);
  logger.info({ siteDir: SITE_DIR }, "Serving prerendered site");
} else {
  logger.warn("Prerendered site not found — static site serving disabled");
}

export default app;
