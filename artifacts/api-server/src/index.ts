import "./env";
import app from "./app";
import { logger } from "./lib/logger";
import { getStripeMode, isWebhookSecretConfigured } from "./stripeClient";
import { startSocialScheduler } from "./lib/social";
import { startOutreachScheduler } from "./lib/outreach-auto";
import { startReplyWatcher } from "./lib/outreach-reply";
import { startPackScheduler } from "./lib/packWorker";
import { startBlogScheduler } from "./lib/blog";
import { startBuyerFollowupScheduler } from "./lib/buyer-followup";
import { startAutoScrapeScheduler } from "./lib/autoScrape";
import { startGmailConnectorWatcher } from "./lib/gmailConnector";
import { startCapturedDigestScheduler } from "./lib/captured-digest";
import { startDailyBriefingScheduler } from "./lib/daily-briefing";
import { startSubscriptionScheduler } from "./lib/subscriptions";
import { startIntelScheduler } from "./lib/intelAuto";

const rawPort = process.env["PORT"];
if (!rawPort) throw new Error("PORT environment variable is required but was not provided.");
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  // One-line visibility into which Stripe key the app booted with — mode word
  // and a boolean only, never the key or any part of it. Lets the live-mode
  // swap be confirmed from the logs without guessing.
  void Promise.all([getStripeMode(), isWebhookSecretConfigured()])
    .then(([stripeMode, webhookSecretConfigured]) => {
      // Webhook secret is optional — packs + subscriptions fulfill via polling.
      // It only enables the $197 license/lifetime fulfillment email.
      logger.info(
        { stripeMode, webhookSecretConfigured },
        `Stripe key mode: ${stripeMode.toUpperCase()} · webhook secret ${webhookSecretConfigured ? "configured ($197 email on)" : "not set (optional; packs+subs fulfill via polling)"}`,
      );
    })
    .catch((err) => logger.warn({ err }, "Could not determine Stripe mode at startup"));

  startSocialScheduler();
  startOutreachScheduler();
  startReplyWatcher();
  startPackScheduler();
  startBlogScheduler();
  startBuyerFollowupScheduler();
  startAutoScrapeScheduler();
  startGmailConnectorWatcher();
  startCapturedDigestScheduler();
  startDailyBriefingScheduler();
  startSubscriptionScheduler();
  startIntelScheduler(); // auto-audits new scraped leads (grade + offer); no AI spend, no sending
});
