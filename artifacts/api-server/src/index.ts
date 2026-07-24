import app from "./app";
import { logger } from "./lib/logger";
import { startSocialScheduler } from "./lib/social";
import { startOutreachScheduler } from "./lib/outreach-auto";
import { startReplyWatcher } from "./lib/outreach-reply";
import { startPackScheduler } from "./lib/packWorker";
import { startBlogScheduler } from "./lib/blog";
import { startBuyerFollowupScheduler } from "./lib/buyer-followup";
import { startAutoScrapeScheduler } from "./lib/autoScrape";
import { startGmailConnectorWatcher } from "./lib/gmailConnector";
import { startCapturedDigestScheduler } from "./lib/captured-digest";

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
  startSocialScheduler();
  startOutreachScheduler();
  startReplyWatcher();
  startPackScheduler();
  startBlogScheduler();
  startBuyerFollowupScheduler();
  startAutoScrapeScheduler();
  startGmailConnectorWatcher();
  startCapturedDigestScheduler();
});
