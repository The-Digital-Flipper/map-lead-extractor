# Stripe Go-Live — Setup Request for Replit Agent

Copy everything below this line into the Replit Agent chat.

---

**Goal:** Switch my app's Stripe integration from **test mode** to **live mode** so it can accept real payments. The code is already written and a full test-mode dry run passed (payment → webhook → access granted all work). What's left is Stripe **account + configuration**, not code logic.

Here's the current state and exactly what I need done. Please do the parts you can, and give me clear step-by-step instructions for the parts only I can do (account onboarding, entering my legal/bank info).

## Current state
- Connected Stripe account `acct_1TmNkWRGKV3HKFpl` (email: gulfcoastcashforcars@gmail.com) is in **TEST mode**, `charges_enabled = false`, onboarding never completed, no business registered.
- No live webhook endpoint is registered.
- Product/price IDs are **hardcoded to test/placeholder values** and must be replaced with real **live-mode** IDs (see below).

## What needs to happen

### 1. Activate the account for live payments (I will do this — guide me)
Walk me through completing Stripe onboarding: business type (individual vs company), legal name, address, bank account for payouts, and identity verification — until `charges_enabled = true`. Tell me exactly which screen/toggle in the Stripe dashboard to use.

### 2. Create 2 products in LIVE mode
Only these two need to exist as Stripe dashboard products:
- **Lifetime Membership** — one-time price **$197.00 USD**
- **License** (Chrome extension) — one-time price **$197.00 USD**

Everything else the app sells is created automatically in code and needs NO Stripe setup:
- Lead Packs ($29 / $99 / $179 / $599 one-time)
- Monthly Lead Pack ($24/mo subscription)
- Referral coupon `REF5USD` ($5 off)

### 3. Update these hardcoded IDs in the code with the new LIVE IDs
After creating the live products, replace these:

- `artifacts/api-server/src/routes/stripe.ts`
  - line ~116: `LIFETIME_PRODUCT_ID = "prod_UzaVAAEqG0DsZH"` → **new live product ID**
  - line ~117: `LIFETIME_PRICE_ID = "price_1TzbKy0eyemRWWM4srkhRaIB"` → **new live price ID**
- `artifacts/api-server/src/webhookHandlers.ts`
  - line ~7: `LICENSE_PRODUCT_ID = 'prod_UzYDwzsJLH96T0'` → **new live License product ID**
  - line ~8: `LIFETIME_PRODUCT_ID = 'prod_UzaVAAEqG0DsZH'` → **same new live Lifetime product ID as above**

(The Lifetime product ID appears in BOTH files — keep them identical.)

### 4. Register the LIVE webhook endpoint
- URL: `https://<MY-PRODUCTION-DOMAIN>/api/stripe/webhook`
- Events: send **all events** (simplest), or at minimum `checkout.session.completed` plus all `customer.subscription.*` and `invoice.*` events.
- Copy the endpoint's signing secret (`whsec_...`) into the **`STRIPE_WEBHOOK_SECRET`** environment variable / secret.
- Confirm what my production domain should be (the dev domain currently in `REPLIT_DOMAINS` is not the live one).

### 5. Connect the LIVE key
In Replit → Integrations → Stripe, reconnect so the app receives a **live** secret key (`sk_live_...`) instead of the current test key.

## How to verify it's live when done
- Stripe dashboard shows account **not** in Test mode and `charges_enabled = true`.
- Developers → Webhooks shows the endpoint above, enabled and receiving events.
- A real (small) test purchase flips the buyer's `is_lifetime` flag to `true` in the database and sends the welcome email.

Please start with step 1 and tell me what info to have ready.
