# Chrome Web Store Submission Notes

Use these notes when filling out the Chrome Web Store listing and privacy forms.

## Single Purpose

Map Lead Extractor extracts visible Bing Maps business listing data from the active Bing Maps results page and exports the collected rows to CSV or XLSX.

## Permission Justifications

- `storage`: saves local extension settings such as enrichment enabled/disabled and an anonymous local ID. Data stays in the user's browser.
- `tabs`: finds the active Bing Maps tab so the popup can open the extractor panel and route messages to the content script.
- Content script site access `*://*.bing.com/maps*`: the content script runs only on Bing Maps pages, where it reads visible business result listings.
- Broad host access `*://*/*` (host_permissions): required ONLY for the optional, off-by-default enrichment feature. When the user turns enrichment on, the extension fetches each business's own public website (e.g. its home, `/contact`, and `/about` pages) to look for a publicly listed email address and social media links. Because a business can have any domain, the extension cannot predict those domains in advance and therefore requests broad host access. These fetches go directly from the user's browser to the business website; nothing is sent to a developer server. If enrichment is left off, no cross-site fetches are made.

## Data Handling

The extension does not collect, sell, transmit, or share user data with the developer or any backend service.

All extraction and export logic runs locally in the browser. CSV/XLSX files are generated locally and downloaded directly to the user's device.

Optional enrichment is off by default. If the user enables it, the extension requests the public business websites listed in Bing Maps to look for publicly posted email addresses and social links. These requests go directly from the user's browser to the listed websites and are not routed through or stored on any developer server.

## Remote Code

No remote JavaScript, remote WebAssembly, CDN script, dynamic code execution, telemetry, install tracking, uninstall tracking, OAuth client ID, or backend host is included. The package contains no `update_url`; updates are handled by the Chrome Web Store.

## Review Notes

The package uses Manifest V3 and an explicit extension page CSP:

`script-src 'self'; object-src 'self';`

The source is unminified and split into reviewable modules.
