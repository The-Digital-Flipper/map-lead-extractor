import { Commands, ROUTE_TO_CONTENT } from "./messages.js";
import { EXTENSION_VERSION } from "./version.js";

const LOCAL_ID_KEY = "mapLeadExtractor.localId";

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const existing = await chrome.storage.local.get(LOCAL_ID_KEY);
  if (!existing[LOCAL_ID_KEY]) {
    await chrome.storage.local.set({ [LOCAL_ID_KEY]: crypto.randomUUID() });
  }
  if (reason === "install") {
    await chrome.storage.local.set({ "mapLeadExtractor.panelOpen": true });
    // First-time landing: a dense, results-packed search so new users immediately
    // see a full list of leads. Manhattan restaurants is one of the densest areas.
    chrome.tabs.create({ url: "https://www.google.com/maps/search/restaurants+in+Manhattan+New+York" });
  }
});

async function getActiveGoogleMapsTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (tab && tab.url && /^https:\/\/www\.google\.[a-z.]+\/maps\//.test(tab.url)) return tab;
  return null;
}

async function routeToContent(message, sender) {
  const tabId = sender.tab?.id || (await getActiveGoogleMapsTab())?.id;
  if (!tabId) {
    return {
      ok: false,
      error: "Open Google Maps before starting extraction."
    };
  }

  try {
    return await chrome.tabs.sendMessage(tabId, message.payload || {});
  } catch (error) {
    return {
      ok: false,
      error: "Google Maps content script is not ready. Refresh the Google Maps tab and try again.",
      detail: error?.message || String(error)
    };
  }
}

const MAX_SITE_CHARS = 400000;
async function fetchSite(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      redirect: "follow",
      headers: {
        // A normal-looking UA reduces bot blocks (e.g. Cloudflare) vs. no UA.
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
      }
    });
    if (!response.ok) return { ok: false, text: "", status: response.status, error: `http ${response.status}` };
    const type = response.headers.get("content-type") || "";
    if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) {
      return { ok: false, text: "", status: response.status, error: `non-html (${type.split(";")[0]})` };
    }
    const text = await response.text();
    return { ok: true, text: text.length > MAX_SITE_CHARS ? text.slice(0, MAX_SITE_CHARS) : text, status: response.status, error: "" };
  } catch (e) {
    const msg = (e && e.name === "AbortError") ? "timeout" : ((e && e.message) || "fetch failed");
    return { ok: false, text: "", status: 0, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === ROUTE_TO_CONTENT) {
      sendResponse(await routeToContent(message, sender));
      return;
    }

    if (message?.command === Commands.GET_STATUS) {
      sendResponse({ ok: true, version: EXTENSION_VERSION });
      return;
    }

    // Enrichment website fetch, run from the BACKGROUND worker. Background
    // requests aren't subject to page-level CORS the way the panel iframe is, so
    // this recovers many sites that fail with "Failed to fetch" from the panel.
    if (message?.command === Commands.FETCH_SITE) {
      sendResponse(await fetchSite(message.url, message.timeoutMs || 9000));
      return;
    }

    sendResponse({ ok: false, error: "Unknown service worker message." });
  })();

  return true;
});

