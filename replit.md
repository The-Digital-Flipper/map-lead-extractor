# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run scrape` — run the 24/7 Google Maps lead scraper once (see `scripts/src/scrape/README.md`)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Product

- Dashboard follow-up queue: marking a lead **contacted** (first email sent — via the AI Outreach modal's Gmail/"Email #1 sent" buttons, the bulk-email modal, or the status badge) stamps `leads.contacted_at` + `outreach_step=1` and moves it out of the main list (fetched with `exclude=contacted`) into the "Follow-Up" pill. It waits there until its next step is due (`contacted_at` + the AI sequence's `followUps[step-1].day`, default 3 days without a sequence), then shows "⚡ Step N ready", counts into `GET /api/leads/stats → followUpReady`, and surfaces via a banner. `POST /api/leads/:id/advance-step` records each follow-up touch; setting status back to "new" resets the clock. Board view still shows all statuses.

- **Automated outreach engine** (`api-server/src/lib/outreach-auto.ts`, scheduler started in `index.ts`, routes at `/api/outreach`): sends each enrolled lead's first email + timed follow-ups hands-free, on a human-like cadence — only inside a local send window (default 8am–6pm weekdays, `tz_offset_minutes`), a fresh random gap between every send (`min/max_gap_minutes`), a `daily_cap`, and follow-ups threaded as replies (In-Reply-To/References + `Re:` subject) beneath the first email (whose Message-ID is stored on `leads.thread_message_id`). Content comes from the per-lead `leads.outreach` drafts (generated on enroll if missing). **Nothing about the sender is hardcoded**: `generateOutreach(lead, {name, offer})` writes every email around the owner-provided `outreach_settings.offer` (their pitch, in their words) and signs with `from_name` (blank = no sign-off name). Blank offer falls back to `DEFAULT_OFFER` in `lib/outreach.ts` (websites/SEO/ads/reputation for local businesses) so generation, enroll, and auto-replies all work out of the box — the settings field customizes the pitch, it doesn't gate sending. Two sending providers, chosen by `outreach_settings.provider`: **Gmail** (default — SMTP via `nodemailer`, creds in the `GMAIL_USER` + `GMAIL_APP_PASSWORD` secrets, sends from the owner's real inbox; free, most personal, ~500/day Gmail limit) or **Resend** (`RESEND_API_KEY` + verified domain, scales better). `gmailConfigured()`/`resendConfigured()`/`providerReady()` gate sending; the dashboard shows the provider toggle + Gmail App-Password setup steps. The email *body* reads like a personal 1:1 message — no visible unsubscribe link; the opt-out is carried by the invisible `List-Unsubscribe`/`List-Unsubscribe-Post` headers (mailbox-provider native control + deliverability signal) backed by `GET/POST /api/outreach/u/:token`, plus reply-based opt-out. The physical business address stays in a small footer. The engine hard-stops on unsubscribe / bounce (`email_health`) / reply (`replied_at`). Activity feed: `GET /api/outreach/activity` powers the "Recent sends" list in the Automate modal. Config is the `outreach_settings` singleton; sends are logged to `outreach_emails` (backs the daily-cap count + activity feed). Dashboard drives it via the header **⚡ Automate** button (settings modal) and the bulk **Automate** action (enroll selected). Per-lead `🤖 Auto · <when>` badge with an ✕ to pause. `auto_enroll_on_contact` hands a manually-contacted lead to the engine for its follow-ups (never re-sends #1). **Requires `RESEND_API_KEY` + a verified sender domain to actually send — the UI hides all automation controls until Resend is configured.**

- **Reply automation** (`api-server/src/lib/outreach-reply.ts`, watcher started in `index.ts`): polls the Gmail inbox over IMAP (`imapflow` + `mailparser`, same `GMAIL_USER`/`GMAIL_APP_PASSWORD` secrets) every 2.5 min, matches inbound mail to leads by our sent Message-IDs (In-Reply-To/References) with a from-address fallback, and for every match: records it in `outreach_replies` (deduped on `message_id`, so re-scans are no-ops), auto-pauses the lead's cold sequence via `markReplied`, and honors opt-out language ("stop", "take me off…") as a permanent unsubscribe. When `outreach_settings.auto_reply` is ON (the one-click **"AI answers replies for me"** toggle in the Automate modal — it PATCHes immediately, no Save press), `generateReply(lead, thread, {name, offer})` writes a short grounded response (answers only from the owner's offer; refuses to invent prices/dates; detects auto-responders and "not interested" → stays silent / marks the lead done) and sends it threaded into the same conversation over Gmail SMTP. Hard cap: 3 AI responses per lead, then a human takes over. Feed: `GET /api/outreach/replies` powers the "Replies" list in the modal; turning the toggle on requires Gmail secrets (400 otherwise, even when sending via Resend — the Gmail inbox is what's watched).

## Gotchas

- Building the site locally needs env vars: `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/lead-extractor-site run build` (vite.config.ts throws without them; CI sets them in `ops/ci.github-workflow.yml`).
- `drizzle-kit push` currently trips on pre-existing drift (it wants to add `leads_unsub_token_unique` and interactively offers to **truncate the leads table** — never accept): apply additive schema changes with plain SQL against `DATABASE_URL` instead, matching drizzle's naming conventions.
- api-server must keep `pg`/`@types/pg` in its own deps: without them pnpm resolves a second peer-keyed `drizzle-orm` instance and typecheck explodes with hundreds of "separate declarations of a private property" errors across the repo. lib/db is a TS project reference — after schema changes run `pnpm exec tsc -b lib/db` or api-server typechecks against stale `dist/` declarations.
- Site analytics: every route change fires a beacon to `POST /api/track` (client: `src/lib/track.ts`, hooked in `App.tsx`), stored in the `site_visits` table, surfaced in the admin **Traffic** tab via `GET /api/admin/traffic`. `/admin*` visits and bot UAs are not counted.
- Social auto-poster: `api-server/src/lib/social.ts` owns AI post generation (OpenAI key), Facebook publishing, and a 5-min scheduler started in `index.ts` (1 post/day at `social_settings.post_hour_utc`, auto-refills the queue below 3). Admin **📣 Social** tab drives it via `/api/admin/social*`. Facebook connects via the tab's one-click OAuth button (`/api/admin/social/fb/connect` → callback stores the long-lived Page token in `social_settings`; app id/secret are seeded in that same DB row, env `FACEBOOK_*` vars are a fallback). The FB app (id 1073926301971765) needs the callback URL whitelisted under Facebook Login → Valid OAuth Redirect URIs.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
