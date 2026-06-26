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
    chrome.tabs.create({ url: "https://www.bing.com/maps?q=food%20in%20Dallas" });
  }
});

async function getActiveBingMapsTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
    url: "*://*.bing.com/maps*"
  });
  return tabs[0] || null;
}

async function routeToContent(message, sender) {
  const tabId = sender.tab?.id || (await getActiveBingMapsTab())?.id;
  if (!tabId) {
    return {
      ok: false,
      error: "Open Bing Maps before starting extraction."
    };
  }

  try {
    return await chrome.tabs.sendMessage(tabId, message.payload || {});
  } catch (error) {
    return {
      ok: false,
      error: "Bing Maps content script is not ready. Refresh the Bing Maps tab and try again.",
      detail: error?.message || String(error)
    };
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

    sendResponse({ ok: false, error: "Unknown service worker message." });
  })();

  return true;
});

