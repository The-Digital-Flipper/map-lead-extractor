/**
 * Loads the workspace-root .env file (gitignored) before anything else reads
 * process.env. Real environment variables (Replit Secrets) take precedence
 * over .env values. Also normalizes Gmail credentials: strips the spaces
 * Google displays inside app passwords and falls back to the legacy
 * `gmil_email` secret name for the account address.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(here, "../../../.env"), // dist/index.mjs -> workspace root
  path.resolve(process.cwd(), ".env"),
];
for (const file of candidates) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}

if (!process.env.GMAIL_USER && process.env.gmil_email) {
  process.env.GMAIL_USER = process.env.gmil_email.trim();
}
if (process.env.GMAIL_APP_PASSWORD) {
  process.env.GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, "");
}
