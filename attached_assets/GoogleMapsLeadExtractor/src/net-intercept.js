// Runs in the PAGE (MAIN world). Google Maps downloads full business data
// (phone, website, etc.) in its own network responses, even though the visible
// cards hide most of it. We wrap fetch + XHR to read those responses and hand
// the raw text to the extension's content script via window.postMessage.
(function () {
  if (window.__mleNetHooked) return;
  window.__mleNetHooked = true;

  function post(body) {
    if (typeof body !== "string" || body.length < 50) return;
    // Only forward responses that actually contain Google place IDs (ftids).
    if (!/0x[0-9a-f]+:0x[0-9a-f]+/i.test(body)) return;
    try {
      window.postMessage({ __mleNet: true, body: body.slice(0, 3000000) }, "*");
    } catch (e) { /* ignore */ }
  }

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (...args) {
      return origFetch.apply(this, args).then((res) => {
        try { res.clone().text().then(post).catch(() => {}); } catch (e) { /* ignore */ }
        return res;
      });
    };
  }

  // Google also embeds the first batch of results in the page itself.
  function grabEmbedded() {
    try {
      if (window.APP_INITIALIZATION_STATE) post(JSON.stringify(window.APP_INITIALIZATION_STATE));
    } catch (e) { /* ignore */ }
    try {
      // Some builds stash it on other globals or inline scripts.
      for (const s of document.scripts) {
        const t = s.textContent || "";
        if (t.length > 2000 && /0x[0-9a-f]+:0x[0-9a-f]+/i.test(t)) post(t);
      }
    } catch (e) { /* ignore */ }
  }
  setTimeout(grabEmbedded, 1500);
  setTimeout(grabEmbedded, 4000);
  setTimeout(grabEmbedded, 8000);

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function () {
    try { this.__mleUrl = arguments[1]; } catch (e) { /* ignore */ }
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    try {
      this.addEventListener("load", () => {
        try { post(this.responseText); } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
    return origSend.apply(this, arguments);
  };
})();
