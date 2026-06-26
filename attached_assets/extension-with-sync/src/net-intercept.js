// Runs in the PAGE (MAIN world). Google Maps downloads full business data
// (phone, website, etc.) in its own network responses, even though the visible
// cards hide most of it. We wrap fetch + XHR to read those responses and hand
// the raw text to the extension's content script via window.postMessage.
(function () {
  if (window.__mleNetHooked) return;
  window.__mleNetHooked = true;

  // Report every request's URL + size + whether we forwarded it, so the debug
  // dump shows exactly which Google endpoint carries results we're missing.
  function postMeta(url, status, len, forwarded, reason) {
    try {
      window.postMessage({ __mleNetMeta: true, url: String(url || "").slice(0, 300), status, len, forwarded, reason }, "*");
    } catch (e) { /* ignore */ }
  }

  function shouldForward(body) {
    if (typeof body !== "string" || body.length < 50) return { ok: false, reason: "too-short" };
    const head = body.slice(0, 16);
    if (head.indexOf(")]}'") !== -1) return { ok: true, reason: "rpc" };
    if (/0x[0-9a-f]+:0x[0-9a-f]+/i.test(body)) return { ok: true, reason: "ftid" };
    if (head.replace(/^\s+/, "")[0] === "[" && body.length > 2000) return { ok: true, reason: "json-array" };
    return { ok: false, reason: "no-match" };
  }

  // Forward any Google Maps DATA response. Every Google RPC starts with the
  // ")]}'" anti-hijack prefix; the content script + backend decide what parses.
  function post(body, url) {
    const verdict = shouldForward(body);
    if (url !== undefined) postMeta(url, 0, (body || "").length, verdict.ok, verdict.reason);
    if (!verdict.ok) return;
    try {
      window.postMessage({ __mleNet: true, body: body.slice(0, 6000000) }, "*");
    } catch (e) { /* ignore */ }
  }

  function urlOf(args) {
    try {
      const a = args[0];
      if (typeof a === "string") return a;
      if (a && typeof a.url === "string") return a.url; // Request object
    } catch (e) { /* ignore */ }
    return "";
  }

  const origFetch = window.fetch;
  if (origFetch) {
    window.fetch = function (...args) {
      const url = urlOf(args);
      return origFetch.apply(this, args).then((res) => {
        try { res.clone().text().then((b) => post(b, url)).catch(() => postMeta(url, res.status, 0, false, "body-read-failed")); } catch (e) { /* ignore */ }
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
        const url = this.__mleUrl || "";
        try {
          // responseText throws if responseType is arraybuffer/blob — that's a
          // binary response we can't read, so log it as missed.
          const rt = this.responseType;
          if (rt && rt !== "" && rt !== "text") { postMeta(url, this.status, 0, false, "binary-" + rt); return; }
          post(this.responseText, url);
        } catch (e) { postMeta(url, this.status, 0, false, "responseText-failed"); }
      });
    } catch (e) { /* ignore */ }
    return origSend.apply(this, arguments);
  };
})();
