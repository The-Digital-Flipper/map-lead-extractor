# Map Lead Extractor Clean MV3

Clean Chrome Manifest V3 extension for extracting visible Bing Maps business listings to CSV or XLSX.

## Load Unpacked

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this folder: `MapLeadExtractorCleanMV3`.
5. Open Bing Maps search results and click the extension popup, then **Open Extractor**.

## Permissions

- `storage`: saves local UI settings and an anonymous local ID only.
- `tabs`: finds the active Bing Maps tab so the popup and panel can talk to the content script.
- Content script scope: `*://*.bing.com/maps*`.

There are no backend hosts, telemetry calls, remote code, CDN assets, subscription checks, tracking hooks, `update_url`, or install/uninstall tracking.

## Architecture

- `manifest.json`: MV3 wiring for popup, service worker, and Bing Maps content script.
- `src/version.js`: single source version constant used by extension source.
- `src/service-worker.js`: message router only. It contains no scraping logic.
- `src/content-script.js`: all Bing DOM reads, scrolls, waits, and page-control clicks.
- `src/selectors.js`: all Bing selectors live here in versioned fallback maps for modern and legacy layouts.
- `panel/panel.js`: run state, dedupe, parsing, live status, stop handling, enrichment queue hookup, and exports.
- `panel/export.js`: local CSV and XLSX generation.
- `panel/enrichment.js`: optional background enrichment queue.

Every Bing DOM touchpoint in the content script is commented as breakage-prone. If Bing changes layout, start with `src/selectors.js`.

## Extraction Flow

1. Popup asks the service worker to show the panel on the active Bing Maps tab.
2. Panel sends workflow commands through the service worker.
3. Service worker routes messages only.
4. Content script waits for the result container using selector fallbacks, `MutationObserver`, timeout, and retry.
5. Content script harvests only structured `data-entity` JSON from visible listings.
6. Panel converts entities to rows and deduplicates by Bing entity ID, with a local fallback key when the ID is missing.
7. Panel scrolls the result list until the total stops growing for the configured stable-attempt count, default `3`.
8. Content script clicks visible **Search this area** or **Next page** controls when present.
9. Panel repeats harvesting until no advance control remains, Stop is pressed, or a readable layout error is returned.
10. CSV/XLSX export is always based on the rows already collected, including after Stop.

## Export Fields

`ID`, `Name`, `Address`, `Featured image`, `Bing Maps URL`, `Latitude`, `Longitude`, `Rating`, `Rating info`, `Category`, `Open hours`, `Website`, `Phone`, `Emails`, `Social Medias`, `Facebook`, `Instagram`, `Twitter`, `LinkedIn`.

Missing values export blank. The extension never inserts placeholder text like `in progress`.

## Enrichment

Enrichment is off by default. Turn it on with the panel checkbox.

When enabled, it runs independently in the panel and never blocks scraping or export. It reads each entity website, then common pages like `/contact` and `/about`, with a timeout and concurrency cap. Failures leave enrichment fields blank.

Important: this build intentionally keeps permissions limited to `storage` and `tabs`. Because of that, website enrichment can only read pages that allow browser cross-origin fetches from the extension context. Main Bing Maps extraction does not depend on enrichment.
