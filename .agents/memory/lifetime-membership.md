---
name: Lifetime Membership
description: How the $197 lifetime membership is implemented — Stripe IDs, DB flag, webhook detection, and frontend gates.
---

# Lifetime Membership Implementation

**Why:** Owner wanted a one-time $197 product giving access to platform tools (Scraper, Command Center, AI enrichment), same price as the Chrome extension.

## Stripe Objects (Live Mode)
- Product: `prod_UzaVAAEqG0DsZH` — "Map Lead Extractor — Lifetime Membership"
- Price: `price_1TzbKy0eyemRWWM4srkhRaIB` — $197 one-time
- Both IDs are hardcoded in `artifacts/api-server/src/routes/stripe.ts` as `LIFETIME_PRODUCT_ID` / `LIFETIME_PRICE_ID`

## Database
- `lib/db/src/schema/users.ts` — added `isLifetime: boolean("is_lifetime").default(false)` and `lifetimeGrantedAt: timestamp`
- Migration applied via `drizzle-kit push`

## Backend Flow
- `POST /api/stripe/lifetime-checkout` — creates a Stripe one-time checkout session, guards against double purchase
- `GET /api/stripe/status` — now returns `isLifetime: boolean` and `plan: "free" | "pro" | "lifetime"`
- `artifacts/api-server/src/webhookHandlers.ts` — on `checkout.session.completed`, detects `LIFETIME_PRODUCT_ID`, calls `storage.setLifetimeMemberByCustomerId()`, sends welcome email
- `artifacts/api-server/src/storage.ts` — added `setLifetimeMember()`, `setLifetimeMemberByCustomerId()`, `getUserByCustomerId()`

**Why:** Lifetime is one-time (not subscription), so it can't be checked via `stripe.subscriptions`. Stored as a DB flag set by webhook.

## Frontend Gates
- `/membership` — new upgrade page (sign-in → Stripe checkout)
- `/scraper` — shows upgrade wall if `isLifetime === false` (fetches `/api/stripe/status` on mount)
- `/command-center` — same upgrade wall
- `App.tsx` — `/membership` added to `AUTH_PREFIXES` so Clerk loads
- `AuthApp.tsx` — `/membership` route registered
- Dashboard `PlanBanner` — shows gradient "Lifetime Membership" card with quick links to Scraper + Command Center
- Dashboard header badge — shows "Lifetime" instead of "Pro"
- Dashboard upgrade CTA — now links to `/membership` as primary, Pro subscription as secondary
