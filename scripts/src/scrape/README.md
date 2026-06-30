# Google Maps lead scraper (24/7)

A headless-browser worker that automatically pulls Google Maps business leads
into the site — the same pipeline the Chrome extension uses, just automated.

```
queries.json ─▶ headless Chromium ─▶ /api/parse-gmaps ─▶ /api/leads/save ─▶ DB
```

For each query it drives a real Maps search, reads the listings Google embeds in
the page (`APP_INITIALIZATION_STATE`, ~20 results) plus any pagination payloads
from scrolling, parses them with the **existing** `/api/parse-gmaps` endpoint,
and saves them via `/api/leads/save`. Leads are scored (opportunity / demand /
value) and de-duped server-side automatically.

## 1. Edit your target list

`queries.json` — the categories × locations to scrape. Add as many as you want:

```json
[
  { "category": "plumbers", "location": "Mobile AL" },
  { "category": "roofing contractors", "location": "Pensacola FL" }
]
```

Each entry becomes the search `"<category> in <location>"`. The `category` is
also stamped onto every saved lead. Plain strings work too: `"hvac in Biloxi MS"`.

## 2. Run it

```bash
pnpm --filter @workspace/scripts run scrape
```

It makes **one full pass** over every query, then exits — designed for a cron /
scheduled run. Each pass yields ~20 leads per query (more with higher `MAX_SCROLLS`).

### Config (env vars, all optional)

| Var               | Default                  | Purpose                                                        |
| ----------------- | ------------------------ | -------------------------------------------------------------- |
| `SITE_URL`        | `http://localhost:5000`  | Base URL of the deployed site API the leads flow into.         |
| `SCRAPER_API_KEY` | _(none)_                 | `X-Api-Key` so saved leads attribute to your account.          |
| `QUERIES_FILE`    | `./queries.json`         | Path to the query list.                                        |
| `MAX_SCROLLS`     | `8`                      | Feed scrolls per query — higher = more results, slower.        |
| `QUERY_DELAY_MS`  | `6000`                   | Pause between queries (looks human / avoids rate limits).      |
| `LOOP`            | _(off)_                  | `1` = run forever with `LOOP_DELAY_MS` (default 1h) between passes — for an always-on Reserved VM instead of cron. |
| `CHROMIUM_PATH`   | Replit's bundled browser | Override the Chromium binary.                                  |

> The browser binary comes from Replit's `REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE`
> (fully wired with its system libraries). Playwright's own bundled Chromium does
> **not** work on Replit's nix image (missing `libglib`), so don't rely on it.

## 3. Schedule it 24/7 (Replit Scheduled Deployment)

The site runs on an **autoscale** deployment, which scales to zero — it can't host
a persistent worker. Run the scraper as a separate **Scheduled Deployment**:

1. Replit → **Deploy** → **Scheduled**.
2. **Schedule:** e.g. every 6 hours (`0 */6 * * *`).
3. **Build command:** `pnpm install`
4. **Run command:**
   ```
   SITE_URL=https://YOUR-SITE.replit.app pnpm --filter @workspace/scripts run scrape
   ```
   (Set `SCRAPER_API_KEY` too if you want the leads attributed to your account.)

Each firing scrapes every query once and exits. To run continuously instead, set
`LOOP=1` and deploy it as a **Reserved VM** background worker rather than scheduled.

## Notes / limits

- **ToS:** Automated scraping of Google Maps is against Google's Terms of Service.
  At low volume with the built-in pacing it's usually fine; if you scale up
  aggressively you may hit CAPTCHAs / IP blocks and would need rotating proxies.
  The ToS-compliant alternative is the official Google Places API.
- De-duplication is automatic (server keys on name+phone+address), so re-running
  the same queries refreshes existing leads rather than creating duplicates.
