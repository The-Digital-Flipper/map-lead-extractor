(async () => {
  const { Commands } = await import(chrome.runtime.getURL("src/messages.js"));
  const { GOOGLE_SELECTORS, GOOGLE_SELECTOR_VERSION } = await import(chrome.runtime.getURL("src/selectors.js"));

  const PANEL_ID = "map-lead-extractor-panel";
  const PANEL_OPEN_KEY = "mapLeadExtractor.panelOpen";
  const PANEL_POS_KEY = "mapLeadExtractor.panelPos";
  const DEFAULT_PANEL_HEIGHT = "min(740px, 82vh)";

  function readableError(error, fallback) {
    return error?.message || String(error || fallback);
  }
  function ok(data = {}) { return { ok: true, ...data }; }
  function fail(error, fallback = "Google Maps extraction failed.") {
    return { ok: false, error: readableError(error, fallback) };
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (!style || style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  // ---- Google DOM helpers (all fragile; tune in selectors.js) ----
  function queryFirst(root, selectors) {
    for (const selector of selectors) {
      try {
        const el = root.querySelector(selector);
        if (el) return el;
      } catch { /* bad selector, skip */ }
    }
    return null;
  }
  function queryAll(root, selectors) {
    const out = [];
    const seen = new Set();
    for (const selector of selectors) {
      try {
        for (const el of root.querySelectorAll(selector)) {
          if (!seen.has(el)) { seen.add(el); out.push(el); }
        }
      } catch { /* skip */ }
    }
    return out;
  }
  function getFeed() {
    return queryFirst(document, GOOGLE_SELECTORS.feed);
  }
  function getScrollMetrics(el) {
    const scrollTop = Number(el.scrollTop || 0);
    const scrollHeight = Number(el.scrollHeight || 0);
    const clientHeight = Number(el.clientHeight || 0);
    const distanceToBottom = Math.max(0, scrollHeight - scrollTop - clientHeight);
    return { scrollTop, scrollHeight, clientHeight, distanceToBottom, atBottom: distanceToBottom <= Math.max(40, clientHeight * 0.1) };
  }

  // --- Network-captured data: phone/website Google hides in the cards ---
  // Filled from the MAIN-world interceptor (net-intercept.js) via postMessage.
  const netData = new Map(); // ftid (lowercase) -> { phone, website }

  function cleanNetUrl(u) {
    return (u || "")
      .replace(/\\u003d/gi, "=").replace(/\\u0026/gi, "&").replace(/\\\//g, "/")
      .replace(/["'\\)\]]+$/g, "");
  }

  // Validate that a candidate string is a REAL phone number, not a coordinate,
  // ZIP, ID, or random digits. Uses North American Numbering Plan rules.
  function isRealPhone(raw) {
    if (!raw || /\d\.\d/.test(raw)) return false;          // decimal => coordinate
    const digits = raw.replace(/\D/g, "");
    let n = digits;
    if (n.length === 11 && n[0] === "1") n = n.slice(1);    // drop US country code
    if (n.length === 10) {
      // Area code + exchange must each start 2-9 (real NANP numbers do).
      if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(n)) return false;
      if (/^(\d)\1{9}$/.test(n)) return false;              // 0000000000 etc.
      return true;
    }
    // International: a leading + and a sane length, not all-identical digits.
    if (raw.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15 && !/^(\d)\1+$/.test(digits)) {
      return true;
    }
    return false;
  }

  function normalizePhone(raw) {
    const digits = raw.replace(/\D/g, "");
    let n = digits;
    if (n.length === 11 && n[0] === "1") n = n.slice(1);
    if (n.length === 10) return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
    return raw.trim();
  }

  function ingestNet(body) {
    const ftidRe = /0x[0-9a-f]+:0x[0-9a-f]+/gi;
    let m;
    while ((m = ftidRe.exec(body)) !== null) {
      const ftid = m[0].toLowerCase();
      // Google packs each place's fields around its id — scan a window both ways.
      const win = body.slice(Math.max(0, m.index - 1500), m.index + 5000);
      // Phone: ONLY accept properly-formatted phone shapes (parens / dashes /
      // leading +). Bare digit blobs near the id are IDs/values, not phones.
      let phone = "";
      const phoneRes = [
        /\(\d{3}\)[\s.\-]?\d{3}[\s.\-]?\d{4}/,                       // (214) 748-3647
        /\+\d{1,3}[\s.\-]\(?\d{2,4}\)?[\s.\-]?\d{3,4}[\s.\-]\d{3,4}/, // +1 214-748-3647
        /\+\d{10,13}(?!\d)/,                                         // +12147483647
        /\b\d{3}[\s.\-]\d{3}[\s.\-]\d{4}\b/                          // 214-748-3647
      ];
      for (const re of phoneRes) {
        const pm = win.match(re);
        if (pm && isRealPhone(pm[0])) { phone = normalizePhone(pm[0]); break; }
      }
      const urls = win.match(/https?:\/\/[^\s"'\\\]]+/gi) || [];
      let website = urls.find((u) => !/google\.|gstatic\.|ggpht\.|googleusercontent|schema\.org|youtube\.|maps\./i.test(u)) || "";
      website = cleanNetUrl(website);
      let status = "";
      if (/permanently[ _]?closed|CLOSED_PERMANENTLY/i.test(win)) status = "Permanently closed";
      else if (/temporarily[ _]?closed|CLOSED_TEMPORARILY/i.test(win)) status = "Temporarily closed";
      // Price level ($ to $$$$) and a Plus Code location, when present.
      const priceMatch = win.match(/\$\d{1,4}[–-]\$?\d{1,4}|\${1,4}(?![0-9A-Za-z])/);
      const price = priceMatch ? priceMatch[0] : "";
      const plusMatch = win.match(/\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/);
      const plusCode = plusMatch ? plusMatch[0] : "";
      const cur = netData.get(ftid) || { phone: "", website: "", status: "", price: "", plusCode: "" };
      if (phone && !cur.phone && phone.replace(/\D/g, "").length >= 7) cur.phone = phone;
      if (website && !cur.website) cur.website = website;
      if (status && !cur.status) cur.status = status;
      if (price && !cur.price) cur.price = price;
      if (plusCode && !cur.plusCode) cur.plusCode = plusCode;
      if (cur.phone || cur.website || cur.status || cur.price || cur.plusCode) netData.set(ftid, cur);
    }
  }

  window.addEventListener("message", (event) => {
    const d = event.data;
    if (!d || d.__mleNet !== true || typeof d.body !== "string") return;
    try { ingestNet(d.body); } catch { /* ignore one bad body */ }
  });

  function parseLatLng(href) {
    let m = href.match(/!3d(-?[0-9.]+)!4d(-?[0-9.]+)/);
    if (m) return { lat: m[1], lng: m[2] };
    m = href.match(/@(-?[0-9.]+),(-?[0-9.]+)/);
    if (m) return { lat: m[1], lng: m[2] };
    return { lat: "", lng: "" };
  }
  function parseId(href) {
    const m = href.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
    return m ? m[1] : "";
  }
  function extractRating(card) {
    let rating = "", reviews = "";
    const img = queryFirst(card, GOOGLE_SELECTORS.ratingImg);
    if (img) {
      const al = img.getAttribute("aria-label") || "";
      const rm = al.match(/([0-9][0-9.,]*)\s*stars?/i);
      if (rm) rating = rm[1].replace(",", ".");
      const cm = al.match(/([0-9][0-9,]*)\s*reviews?/i);
      if (cm) reviews = cm[1].replace(/,/g, "");
    }
    if (!rating) { const rv = queryFirst(card, GOOGLE_SELECTORS.ratingValue); if (rv) rating = (rv.textContent || "").trim(); }
    if (!reviews) { const rc = queryFirst(card, GOOGLE_SELECTORS.reviewCount); if (rc) reviews = (rc.textContent || "").replace(/[(),]/g, "").trim(); }
    return { rating, reviews };
  }
  function extractWebsite(card) {
    const w = queryFirst(card, GOOGLE_SELECTORS.website);
    if (w && w.href && !/google\.[a-z.]+\/maps/i.test(w.href) && !/\/maps\//.test(w.href)) return w.href;
    return "";
  }
  function extractPhone(card) {
    // Google shows the phone on list cards in a dedicated span when present.
    const el = queryFirst(card, GOOGLE_SELECTORS.phone);
    if (el && isRealPhone(el.textContent || "")) return normalizePhone(el.textContent);
    // Fallback: only formatted phone shapes from the card text (no bare numbers).
    for (const cand of (card.innerText || "").match(/\(\d{3}\)[\s.\-]?\d{3}[\s.\-]?\d{4}|\+\d[\d \-().]{8,16}\d|\b\d{3}[\s.\-]\d{3}[\s.\-]\d{4}\b/g) || []) {
      if (isRealPhone(cand)) return normalizePhone(cand);
    }
    return "";
  }
  function extractCategoryAddress(card) {
    // Collect every "·"-separated chunk from all info rows, then classify —
    // Google mixes rating, price, category and address across these rows.
    const parts = [];
    for (const row of card.querySelectorAll(GOOGLE_SELECTORS.infoRows[0])) {
      for (const p of (row.innerText || "").split("·").map((s) => s.trim()).filter(Boolean)) {
        parts.push(p);
      }
    }
    const isPrice = (s) => /[$£€¥₹]|\d+\s*[–-]\s*\d+\b/.test(s);
    const isRating = (s) => /^\d[\d.,]*\s*[(\d]/.test(s);
    let category = "", address = "";
    for (const p of parts) {
      if (isPrice(p) || isRating(p)) continue;
      if (!category) { category = p; continue; }
      if (!address && /\d/.test(p)) { address = p; continue; }
    }
    // If nothing with a digit looked like an address, take the next text chunk.
    if (!address) {
      const leftovers = parts.filter((p) => p !== category && !isPrice(p) && !isRating(p));
      if (leftovers.length) address = leftovers[0];
    }
    return { category, address };
  }

  function extractEntity(link) {
    const card = link.closest(GOOGLE_SELECTORS.card.join(",")) || link.parentElement || link;
    const name = (link.getAttribute("aria-label") || "").trim()
      || (queryFirst(card, GOOGLE_SELECTORS.name)?.textContent || "").trim();
    if (!name) return null;
    const href = link.href || "";
    const { lat, lng } = parseLatLng(href);
    const { rating, reviews } = extractRating(card);
    const { category, address } = extractCategoryAddress(card);
    const ftid = parseId(href);
    const id = ftid || [name, lat, lng].filter(Boolean).join("|");
    // Prefer Google's network data (has phone/website the cards hide).
    const net = ftid ? netData.get(ftid.toLowerCase()) : null;
    const website = extractWebsite(card) || (net && net.website) || "";
    const cardText = card.innerText || "";
    let status = "Open";
    if (/permanently closed/i.test(cardText)) status = "Permanently closed";
    else if (/temporarily closed/i.test(cardText)) status = "Temporarily closed";
    else if (net && net.status) status = net.status;
    const hoursMatch = cardText.match(/(Open|Closed|Opens|Closes)[^\n·]{0,40}/i);
    return {
      id,
      entity: {
        id,
        title: name,
        mapsUrl: href,
        point: { latitude: lat, longitude: lng },
        rating,
        reviewCount: reviews,
        primaryCategoryName: category,
        address,
        website,
        phone: extractPhone(card) || (net && net.phone) || "",
        openHours: hoursMatch ? hoursMatch[0].trim() : "",
        status,
        priceLevel: (net && net.price) || "",
        plusCode: (net && net.plusCode) || "",
        hasWebsite: website ? "Yes" : "No"
      }
    };
  }

  function harvestVisibleEntities() {
    const feed = getFeed();
    if (!feed) {
      return { ok: false, error: "Google Maps results list not found. Run a search and make sure the list is visible.", selectorVersion: GOOGLE_SELECTOR_VERSION };
    }
    const links = queryAll(feed, GOOGLE_SELECTORS.placeLink);
    if (links.length === 0) {
      return { ok: false, error: "No business results matched the known Google Maps selectors.", selectorVersion: GOOGLE_SELECTOR_VERSION };
    }
    const entities = [];
    const ids = new Set();
    for (const link of links) {
      try {
        const wrapped = extractEntity(link);
        if (!wrapped) continue;
        if (ids.has(wrapped.id)) continue;
        ids.add(wrapped.id);
        entities.push(wrapped);
      } catch { /* one bad card can't break the harvest */ }
    }
    return ok({
      layoutId: "google",
      layoutLabel: "Google Maps results",
      selectorVersion: GOOGLE_SELECTOR_VERSION,
      visibleItemCount: links.length,
      entityCount: entities.length,
      netCaptured: netData.size,
      entities
    });
  }

  function hasLoadingIndicator() {
    const node = queryFirst(document, GOOGLE_SELECTORS.loading);
    return node ? isVisible(node) : false;
  }

  function waitForMutation(timeoutMs) {
    return new Promise((resolve) => {
      let debounce = null;
      const feed = getFeed() || document.body || document.documentElement;
      const observer = new MutationObserver(() => {
        if (debounce) window.clearTimeout(debounce);
        debounce = window.setTimeout(() => {
          const h = harvestVisibleEntities();
          if (h.ok && h.entityCount > 0) { window.clearTimeout(timer); observer.disconnect(); resolve(true); }
        }, 150);
      });
      const timer = window.setTimeout(() => { if (debounce) window.clearTimeout(debounce); observer.disconnect(); resolve(false); }, timeoutMs);
      observer.observe(feed, { childList: true, subtree: true });
    });
  }

  async function waitForResults({ timeoutMs = 10000, retries = 2 } = {}) {
    let last = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const h = harvestVisibleEntities();
      if (h.ok && h.entityCount > 0) return h;
      last = h;
      await waitForMutation(hasLoadingIndicator() ? Math.min(timeoutMs, 4000) : timeoutMs);
    }
    return last || { ok: false, error: "No Google Maps results found. Make sure a search is showing.", selectorVersion: GOOGLE_SELECTOR_VERSION };
  }

  function scrollResults() {
    const feed = getFeed();
    if (!feed) return fail("Google Maps results list not found.");
    const before = { top: feed.scrollTop, height: feed.scrollHeight };
    feed.scrollTo({ top: feed.scrollHeight, behavior: "auto" });
    feed.dispatchEvent(new Event("scroll", { bubbles: true }));
    const after = getScrollMetrics(feed);
    const ended = !!queryFirst(document, GOOGLE_SELECTORS.endOfList);
    return ok({
      layoutId: "google",
      moved: feed.scrollTop !== before.top || feed.scrollHeight !== before.height,
      ...after,
      atBottom: after.atBottom || ended,
      endOfList: ended
    });
  }

  function clickFirst(selectors) {
    for (const selector of selectors) {
      try {
        const node = Array.from(document.querySelectorAll(selector)).find((n) => isVisible(n));
        if (node) {
          node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          return { clicked: true, selector };
        }
      } catch { /* skip */ }
    }
    return { clicked: false, selector: null };
  }

  // Google Maps loads more on scroll, so there is no "load more" button.
  function clickBottomControl() {
    const ended = !!queryFirst(document, GOOGLE_SELECTORS.endOfList);
    return ok({ action: "none", atBottom: true, endOfList: ended, message: "Google Maps loads more by scrolling." });
  }

  // No pagination on Google Maps. Optionally re-query after panning.
  function advanceResults() {
    const ended = !!queryFirst(document, GOOGLE_SELECTORS.endOfList);
    if (ended) return ok({ action: "none", message: "Reached the end of the Google Maps list." });
    const search = clickFirst(GOOGLE_SELECTORS.searchThisArea);
    if (search.clicked) return ok({ action: "search-this-area", selector: search.selector });
    return ok({ action: "none", message: "No more Google Maps results to load." });
  }

  // ---------- Deep details (experimental): open each visible place ----------
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  async function waitFor(predicate, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try { if (predicate()) return true; } catch { /* keep waiting */ }
      await sleep(120);
    }
    return false;
  }
  function readDetailPhone() {
    // 1. Dedicated phone button: data-item-id="phone:tel:+15551234567"
    let el = document.querySelector('button[data-item-id^="phone:tel:"]');
    if (el) {
      const v = (el.getAttribute("data-item-id") || "").replace(/^phone:tel:/i, "").trim();
      if (v.replace(/\D/g, "").length >= 7) return v;
    }
    // 2. Any element with a phone data-item-id (aria-label or text).
    el = document.querySelector('[data-item-id^="phone"]');
    if (el) {
      const al = (el.getAttribute("aria-label") || "").replace(/^phone:?\s*/i, "").trim();
      if (al.replace(/\D/g, "").length >= 7) return al;
      const m = (el.textContent || "").match(/(\+?\d[\d()\-.\s]{7,}\d)/);
      if (m) return m[1].trim();
    }
    // 3. aria-label "Phone: ..."
    el = document.querySelector('[aria-label^="Phone:"], [aria-label^="Phone :"]');
    if (el) return (el.getAttribute("aria-label") || "").replace(/^phone\s*:\s*/i, "").trim();
    // 4. A tel: link anywhere in the detail pane.
    el = document.querySelector('a[href^="tel:"]');
    if (el) return decodeURIComponent((el.getAttribute("href") || "").replace(/^tel:/, "")).trim();
    return "";
  }
  function readDetailWebsite() {
    const el = queryFirst(document, GOOGLE_SELECTORS.detailWebsite);
    if (el && el.href && !/google\.[a-z.]+/i.test(el.href)) return el.href;
    return "";
  }
  function readDetailAddress() {
    const el = queryFirst(document, GOOGLE_SELECTORS.detailAddress);
    if (!el) return "";
    return (el.getAttribute("aria-label") || el.textContent || "").replace(/^address:\s*/i, "").trim();
  }
  function clickEl(el) {
    // Google needs a full pointer/mouse sequence to trigger its SPA navigation.
    el.scrollIntoView({ block: "center", behavior: "auto" });
    for (const type of ["pointerover", "pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })); } catch { /* ignore */ }
    }
  }
  function detailIsOpen() {
    return !!document.querySelector('button[data-item-id^="phone:tel:"]')
      || !!document.querySelector('a[data-item-id="authority"]')
      || !!document.querySelector('button[data-item-id="address"]')
      || !!queryFirst(document, GOOGLE_SELECTORS.detailTitle);
  }

  // Opens each currently-visible result, reads phone/website/address, returns to
  // the list. Experimental: Google virtualizes the list, so this covers what's
  // on screen, not the whole result set.
  async function deepDetailsVisible({ limit = 20 } = {}) {
    const done = new Set();
    const details = [];
    for (let i = 0; i < limit; i += 1) {
      const feed = getFeed();
      if (!feed) break;
      const links = queryAll(feed, GOOGLE_SELECTORS.placeLink);
      const link = links.find((a) => !done.has(parseId(a.href) || a.href));
      if (!link) break;
      const id = parseId(link.href) || link.href;
      done.add(id);
      try {
        clickEl(link);
        const loaded = await waitFor(detailIsOpen, 5000);
        if (loaded) {
          await sleep(400); // let the phone/website fields populate
          details.push({ id, phone: readDetailPhone(), website: readDetailWebsite(), address: readDetailAddress() });
        }
        // Go back to the list (button, or browser back as a fallback).
        const back = queryFirst(document, GOOGLE_SELECTORS.back);
        if (back) clickEl(back); else window.history.back();
        await waitFor(() => !detailIsOpen() && queryAll(getFeed() || document, GOOGLE_SELECTORS.placeLink).length > 0, 3500);
        await sleep(250);
      } catch { /* skip this place */ }
    }
    return ok({ details, processed: done.size });
  }

  // ---------- Diagnostics: capture what the page actually looks like ----------
  function diagnose() {
    const feed = getFeed();
    const links = feed ? queryAll(feed, GOOGLE_SELECTORS.placeLink) : [];
    const firstLink = links[0] || null;
    const firstCard = firstLink ? (firstLink.closest(GOOGLE_SELECTORS.card.join(",")) || firstLink.parentElement) : null;
    const detailPhone = document.querySelector('button[data-item-id^="phone:tel:"]');
    const anyPhoneItem = document.querySelector('[data-item-id^="phone"]');
    const telLink = document.querySelector('a[href^="tel:"]');
    return ok({
      url: location.href,
      selectorVersion: GOOGLE_SELECTOR_VERSION,
      feedFound: !!feed,
      placeLinks: links.length,
      cardsNv2PK: document.querySelectorAll("div.Nv2PK").length,
      sampleName: firstLink?.getAttribute("aria-label") || null,
      sampleCardHtml: firstCard ? firstCard.outerHTML.slice(0, 5000) : null,
      detailOpen: !!document.querySelector(GOOGLE_SELECTORS.detailTitle.join(",")),
      detailPhoneButton: detailPhone?.getAttribute("data-item-id") || null,
      anyPhoneItemId: anyPhoneItem?.getAttribute("data-item-id") || null,
      anyPhoneAria: anyPhoneItem?.getAttribute("aria-label") || null,
      telLink: telLink?.getAttribute("href") || null,
      netCapturedPlaces: netData.size,
      netSample: Array.from(netData.entries()).slice(0, 3).map(([ftid, v]) => ({ ftid, ...v })),
      detailPaneHtml: (document.querySelector('div[role="main"]')?.outerHTML || "").slice(0, 6000)
    });
  }

  // ---------- Panel (identical to the Bing build — your UI) ----------
  function clampIntoView(iframe) {
    const rect = iframe.getBoundingClientRect();
    const offscreen = rect.left < 0 || rect.top < 0 || rect.left > window.innerWidth - 80 || rect.top > window.innerHeight - 40;
    if (offscreen) { iframe.style.left = "auto"; iframe.style.right = "28px"; iframe.style.top = "72px"; }
  }

  function ensurePanel() {
    let iframe = document.getElementById(PANEL_ID);
    if (iframe) { iframe.style.display = "block"; clampIntoView(iframe); return iframe; }
    iframe = document.createElement("iframe");
    iframe.id = PANEL_ID;
    iframe.title = "Google Maps Lead Extractor";
    iframe.src = chrome.runtime.getURL("panel/panel.html");
    Object.assign(iframe.style, {
      position: "fixed", top: "72px", right: "28px",
      width: "min(840px, 56vw)", height: DEFAULT_PANEL_HEIGHT,
      border: "0", borderRadius: "12px", zIndex: "2147483647",
      boxShadow: "0 22px 58px rgba(0, 0, 0, 0.42)", background: "#070b22"
    });
    document.documentElement.appendChild(iframe);
    chrome.storage.local.get(PANEL_POS_KEY).then((stored) => {
      const pos = stored[PANEL_POS_KEY];
      if (!pos || !Number.isFinite(pos.left) || !Number.isFinite(pos.top)) return;
      const maxLeft = Math.max(0, window.innerWidth - 120);
      const maxTop = Math.max(0, window.innerHeight - 60);
      iframe.style.left = `${Math.min(Math.max(0, pos.left), maxLeft)}px`;
      iframe.style.top = `${Math.min(Math.max(0, pos.top), maxTop)}px`;
      iframe.style.right = "auto";
    }).catch(() => {});
    return iframe;
  }

  function hidePanel() {
    const iframe = document.getElementById(PANEL_ID);
    if (iframe) iframe.style.display = "none";
  }

  function setupPanelControls() {
    let dragOffset = null;
    let overlay = null;
    function endDrag() { if (overlay) { overlay.remove(); overlay = null; } dragOffset = null; }
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("blur", endDrag);
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || typeof data !== "object" || typeof data.type !== "string" || !data.type.startsWith("MLE_")) return;
      const iframe = document.getElementById(PANEL_ID);
      if (!iframe || event.source !== iframe.contentWindow) return;
      if (data.type === "MLE_DRAG_START") {
        const rect = iframe.getBoundingClientRect();
        iframe.style.left = `${rect.left}px`; iframe.style.top = `${rect.top}px`; iframe.style.right = "auto";
        dragOffset = { x: data.offsetX || 0, y: data.offsetY || 0 };
        overlay = document.createElement("div");
        Object.assign(overlay.style, { position: "fixed", inset: "0", zIndex: "2147483647", cursor: "move", background: "transparent" });
        overlay.addEventListener("mousemove", (m) => {
          if (!dragOffset) return;
          const maxLeft = Math.max(0, window.innerWidth - iframe.offsetWidth);
          const maxTop = Math.max(0, window.innerHeight - 40);
          iframe.style.left = `${Math.min(Math.max(0, m.clientX - dragOffset.x), maxLeft)}px`;
          iframe.style.top = `${Math.min(Math.max(0, m.clientY - dragOffset.y), maxTop)}px`;
        });
        const stop = () => { endDrag(); const r = iframe.getBoundingClientRect(); chrome.storage.local.set({ [PANEL_POS_KEY]: { left: r.left, top: r.top } }).catch(() => {}); };
        overlay.addEventListener("mouseup", stop);
        overlay.addEventListener("mouseleave", stop);
        document.documentElement.appendChild(overlay);
      }
      if (data.type === "MLE_RESIZE" && typeof data.height === "number") {
        const max = Math.round(window.innerHeight * 0.85);
        iframe.style.height = `${Math.min(Math.max(data.height + 2, 44), max)}px`;
        iframe.style.width = data.collapsed ? "min(420px, 92vw)" : "min(840px, 56vw)";
      }
    });
  }
  setupPanelControls();

  const handlers = {
    [Commands.GET_STATUS]: async () => ok({ ready: true, selectorVersion: GOOGLE_SELECTOR_VERSION }),
    [Commands.SHOW_PANEL]: async () => { await chrome.storage.local.set({ [PANEL_OPEN_KEY]: true }); return ok({ panel: !!ensurePanel() }); },
    [Commands.HIDE_PANEL]: async () => { await chrome.storage.local.set({ [PANEL_OPEN_KEY]: false }); hidePanel(); return ok(); },
    [Commands.TOGGLE_PANEL]: async () => {
      const iframe = ensurePanel();
      const nowVisible = iframe.style.display === "none";
      iframe.style.display = nowVisible ? "block" : "none";
      await chrome.storage.local.set({ [PANEL_OPEN_KEY]: nowVisible });
      return ok({ visible: nowVisible });
    },
    [Commands.WAIT_FOR_RESULTS]: async (message) => waitForResults(message),
    [Commands.HARVEST_VISIBLE]: async () => harvestVisibleEntities(),
    [Commands.SCROLL_RESULTS]: async () => scrollResults(),
    [Commands.CLICK_BOTTOM_CONTROL]: async () => clickBottomControl(),
    [Commands.ADVANCE_RESULTS]: async () => advanceResults(),
    [Commands.RESET_RUN]: async () => ok(),
    [Commands.DEEP_DETAILS_VISIBLE]: async (message) => deepDetailsVisible(message),
    [Commands.DIAGNOSE]: async () => diagnose()
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      const handler = handlers[message?.command];
      if (!handler) { sendResponse(fail("Unknown content script command.")); return; }
      try { sendResponse(await handler(message || {})); }
      catch (error) { sendResponse(fail(error)); }
    })();
    return true;
  });

  chrome.storage.local.get(PANEL_OPEN_KEY).then((stored) => {
    if (stored[PANEL_OPEN_KEY] === true) ensurePanel();
  }).catch(() => {});
})();
