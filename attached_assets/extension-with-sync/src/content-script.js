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
  // The element that actually scrolls may be the feed OR a wrapper around it.
  function getScrollContainer() {
    const feed = getFeed();
    if (!feed) return null;
    if (feed.scrollHeight > feed.clientHeight + 20) return feed;
    let el = feed.parentElement;
    for (let i = 0; el && i < 8; i += 1) {
      try {
        const style = window.getComputedStyle(el);
        if ((style.overflowY === "auto" || style.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 20) {
          return el;
        }
      } catch { /* ignore */ }
      el = el.parentElement;
    }
    return feed;
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

  // --- Debug capture log: keeps a record of every raw body the interceptor
  // forwarded, so we can see exactly what Google sent and why it parsed (or not).
  const netDebug = {
    bodies: [],      // metadata for every forwarded body
    fullSamples: [], // a few FULL large bodies for deep inspection
    smallBodies: [], // full small ftid-bearing bodies (scroll batches)
    backend: [],     // backend responses: { sent, status, count }
    requests: []     // EVERY request URL Google made: { url, len, forwarded, reason }
  };
  function logNetBody(body) {
    try {
      const ftids = Array.from(new Set((body.match(/0x[0-9a-f]+:0x[0-9a-f]+/gi) || []).map((s) => s.toLowerCase())));
      const root = tryParse(body);
      const places = [];
      if (root) collectPlaces(root, places, 0);
      netDebug.bodies.push({
        len: body.length,
        head: body.slice(0, 120),
        startsRpc: body.slice(0, 16).indexOf(")]}'") !== -1,
        parsedOk: !!root,
        ftidCount: ftids.length,
        placesFound: places.length,
        sample: body.slice(0, 1500)
      });
      if (netDebug.bodies.length > 200) netDebug.bodies.shift();
      // Keep up to 4 full LARGE bodies (capped) that contain place ids.
      if (ftids.length && netDebug.fullSamples.length < 4) {
        netDebug.fullSamples.push(body.slice(0, 900000));
      }
      // Also keep every SMALL ftid-bearing body in full — these are the scroll
      // batches (under ~250k) where we need to find the phone index.
      if (ftids.length && body.length < 250000 && netDebug.smallBodies.length < 8) {
        netDebug.smallBodies.push(body);
      }
    } catch { /* ignore */ }
  }

  function cleanNetUrl(u) {
    return (u || "")
      .replace(/\\u003d/gi, "=").replace(/\\u0026/gi, "&").replace(/\\\//g, "/")
      .replace(/["'\\)\]]+$/g, "");
  }

  // Validate that a candidate string is a REAL phone number, not a coordinate,
  // ZIP, ID, or random digits. Uses North American Numbering Plan rules.
  function isRealPhone(raw) {
    if (!raw) return false;
    // Reject obvious decimals/coordinates: a dot followed by 5+ digits (e.g. 0.270588235).
    if (/\.\d{5,}/.test(raw)) return false;
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

  // Safe nested-array access: sa(arr, 178, 0, 0) === arr[178][0][0] or "".
  function sa(obj, ...idx) {
    let cur = obj;
    for (const i of idx) {
      if (cur == null) return null;
      try { cur = cur[i]; } catch { return null; }
    }
    return cur == null ? null : cur;
  }
  function tryParse(text) {
    try { return JSON.parse(String(text).replace(/^\)\]\}'\s*/, "")); } catch { return null; }
  }
  // A Google Maps place is an array whose [11] is the name and [10] is the 0x..:0x.. id.
  function looksLikePlace(a) {
    return Array.isArray(a) && typeof a[11] === "string" && typeof a[10] === "string"
      && /0x[0-9a-f]+:0x[0-9a-f]+/i.test(a[10]);
  }
  function collectPlaces(node, out, depth) {
    if (depth > 14 || node == null || out.length > 400) return;
    if (typeof node === "string") {
      if (node.length > 200 && node.indexOf("0x") >= 0 && (node[0] === "[" || node.startsWith(")]}'"))) {
        const parsed = tryParse(node);
        if (parsed) collectPlaces(parsed, out, depth + 1);
      }
      return;
    }
    if (Array.isArray(node)) {
      if (looksLikePlace(node)) { out.push(node); return; }
      for (const v of node) collectPlaces(v, out, depth + 1);
    } else if (typeof node === "object") {
      for (const v of Object.values(node)) collectPlaces(v, out, depth + 1);
    }
  }

  // EXACT parse of Google's /search response using the known index map
  // (phone = place[178][0][0], website = place[7][0], etc.). Falls back to the
  // fuzzy scan only if the body isn't parseable JSON.
  function ingestNet(body) {
    const root = tryParse(body);
    const places = [];
    if (root) collectPlaces(root, places, 0);
    for (const zr of places) {
      try {
        const ftid = String(sa(zr, 10) || "").toLowerCase();
        if (!/0x[0-9a-f]+:0x[0-9a-f]+/i.test(ftid)) continue;
        const rawPhone = sa(zr, 178, 0, 0);
        const website = sa(zr, 7, 0);
        const plus = sa(zr, 183, 2, 2);
        const addr = sa(zr, 39);
        const cur = netData.get(ftid) || { phone: "", website: "", status: "", price: "", plusCode: "", address: "" };
        if (rawPhone && isRealPhone(String(rawPhone))) cur.phone = normalizePhone(String(rawPhone));
        if (typeof website === "string" && /^https?:\/\//i.test(website)) cur.website = website;
        if (typeof plus === "string" && plus) cur.plusCode = plus;
        if (typeof addr === "string" && addr && !cur.address) cur.address = addr;
        netData.set(ftid, cur);
      } catch { /* skip one bad place */ }
    }
    // Always also run the text scan — it catches ids the structured parse missed
    // (e.g. later batches in a different shape). It only fills gaps, never overwrites.
    ingestNetProximity(body);
  }

  // Fallback: fuzzy text scan around each id (used only if JSON parse fails).
  function ingestNetProximity(body) {
    const ftidRe = /0x[0-9a-f]+:0x[0-9a-f]+/gi;
    let m;
    while ((m = ftidRe.exec(body)) !== null) {
      const ftid = m[0].toLowerCase();
      const win = body.slice(Math.max(0, m.index - 1500), m.index + 5000);
      let phone = "";
      const phoneRes = [
        /\(\d{3}\)[\s.\-]?\d{3}[\s.\-]?\d{4}/,
        /\+\d{1,3}[\s.\-]\(?\d{2,4}\)?[\s.\-]?\d{3,4}[\s.\-]\d{3,4}/,
        /\+\d{10,13}(?!\d)/,
        /\b\d{3}[\s.\-]\d{3}[\s.\-]\d{4}\b/
      ];
      for (const re of phoneRes) {
        const pm = win.match(re);
        if (pm && isRealPhone(pm[0])) { phone = normalizePhone(pm[0]); break; }
      }
      const urls = win.match(/https?:\/\/[^\s"'\\\]]+/gi) || [];
      let website = urls.find((u) => !/google\.|gstatic\.|ggpht\.|googleusercontent|schema\.org|youtube\.|maps\./i.test(u)) || "";
      website = cleanNetUrl(website);
      const cur = netData.get(ftid) || { phone: "", website: "", status: "", price: "", plusCode: "" };
      if (phone && !cur.phone) cur.phone = phone;
      if (website && !cur.website) cur.website = website;
      if (cur.phone || cur.website) netData.set(ftid, cur);
    }
  }

  // Your backend decodes the responses the browser can't (the later batches).
  const BACKEND_URL = "https://mapleadextractor.net/api/parse-gmaps";
  const sentSigs = new Set();
  async function sendToBackend(body) {
    const sig = body.length + ":" + body.slice(0, 24);
    if (sentSigs.has(sig)) return;
    sentSigs.add(sig);
    try {
      const res = await fetch(BACKEND_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body });
      if (!res.ok) { netDebug.backend.push({ sent: body.length, status: res.status, count: -1 }); return; }
      const data = await res.json();
      netDebug.backend.push({ sent: body.length, status: res.status, count: data && Array.isArray(data.leads) ? data.leads.length : 0 });
      if (netDebug.backend.length > 100) netDebug.backend.shift();
      if (!data || !Array.isArray(data.leads)) return;
      for (const lead of data.leads) {
        const ftid = String(lead.ftid || "").toLowerCase();
        if (!/0x[0-9a-f]+:0x[0-9a-f]+/i.test(ftid)) continue;
        const cur = netData.get(ftid) || { phone: "", website: "", status: "", price: "", plusCode: "", address: "" };
        if (lead.phone && isRealPhone(String(lead.phone))) cur.phone = normalizePhone(String(lead.phone));
        if (typeof lead.website === "string" && /^https?:\/\//i.test(lead.website)) cur.website = lead.website;
        if (lead.plusCode && !cur.plusCode) cur.plusCode = String(lead.plusCode);
        if (lead.address && !cur.address) cur.address = String(lead.address);
        netData.set(ftid, cur);
      }
    } catch { /* backend offline — local parse still works */ }
  }

  window.addEventListener("message", (event) => {
    const d = event.data;
    if (!d) return;
    // URL metadata for every request (the diagnostic that finds missed batches).
    if (d.__mleNetMeta === true) {
      try {
        const u = String(d.url || "");
        const short = u.replace(/^https?:\/\/[^/]+/, "").slice(0, 140);
        netDebug.requests.push({ url: short, len: d.len, forwarded: !!d.forwarded, reason: d.reason });
        if (netDebug.requests.length > 400) netDebug.requests.shift();
      } catch { /* ignore */ }
      return;
    }
    if (d.__mleNet !== true || typeof d.body !== "string") return;
    logNetBody(d.body);
    try { ingestNet(d.body); } catch { /* ignore one bad body */ }
    sendToBackend(d.body);
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

  async function scrollResults() {
    const feed = getFeed();
    if (!feed) return fail("Google Maps results list not found.");
    const beforeCount = queryAll(feed, GOOGLE_SELECTORS.placeLink).length;
    const scroller = getScrollContainer() || feed;

    // DELIBERATE, one-step scroll — NOT a jump to the bottom. Google Maps loads
    // results in batches and only fires the data request for the next batch when
    // you pause near the current bottom. Slamming to scrollHeight skips those
    // requests (so phone/website never get captured) and makes Google reset the
    // list. Instead we creep down ~one screen, then the harvest loop pauses and
    // lets that batch load + get captured before we scroll again.
    const step = Math.max(450, Math.round((scroller.clientHeight || 700) * 0.85));
    try {
      scroller.scrollTop = Math.min(scroller.scrollHeight, scroller.scrollTop + step);
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    } catch { /* ignore */ }
    // Nudge the lazy-loader with a wheel event at the current bottom card.
    try {
      const links = queryAll(feed, GOOGLE_SELECTORS.placeLink);
      const anchor = links[links.length - 1] || scroller;
      anchor.dispatchEvent(new WheelEvent("wheel", { deltaY: step, bubbles: true }));
    } catch { /* ignore */ }

    // Wait for the next batch to actually appear (or the end marker). Returns the
    // moment new results show up; waits the full window only if stalled.
    await waitFor(() => {
      const f = getFeed();
      return (f && queryAll(f, GOOGLE_SELECTORS.placeLink).length > beforeCount)
        || !!queryFirst(document, GOOGLE_SELECTORS.endOfList);
    }, 2200);
    const sc = getScrollContainer() || feed;
    const after = getScrollMetrics(sc);
    const ended = !!queryFirst(document, GOOGLE_SELECTORS.endOfList);
    return ok({
      layoutId: "google",
      moved: true,
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

  // Google Maps has no "next page" — scrolling loads everything for the current
  // search. We do NOT auto-click anything here (clicking was hitting Google's
  // map/satellite toggle and flipping it). To get a new area, the user pans the
  // map and runs again.
  function advanceResults() {
    const ended = !!queryFirst(document, GOOGLE_SELECTORS.endOfList);
    return ok({
      action: "none",
      message: ended ? "Reached the end of the list." : "Done loading this view — pan to a new area for more."
    });
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
    // Collect candidates from the detail pane (most reliable first), then return
    // only one that VALIDATES as a real phone, normalized to (xxx) xxx-xxxx.
    const candidates = [];
    let el = document.querySelector('button[data-item-id^="phone:tel:"]');
    if (el) candidates.push((el.getAttribute("data-item-id") || "").replace(/^phone:tel:/i, ""));
    el = document.querySelector('[data-item-id^="phone"]');
    if (el) { candidates.push(el.getAttribute("aria-label") || ""); candidates.push(el.textContent || ""); }
    el = document.querySelector('[aria-label^="Phone:"], [aria-label^="Phone :"]');
    if (el) candidates.push((el.getAttribute("aria-label") || "").replace(/^phone\s*:\s*/i, ""));
    el = document.querySelector('a[href^="tel:"]');
    if (el) candidates.push(decodeURIComponent((el.getAttribute("href") || "").replace(/^tel:/, "")));
    for (const c of candidates) {
      if (isRealPhone(c)) return normalizePhone(c);
    }
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
          // Only read if the detail that opened is THIS place (avoid mismatches).
          const openFtid = (parseId(location.href) || "").toLowerCase();
          if (!openFtid || openFtid === id.toLowerCase()) {
            details.push({ id, phone: readDetailPhone(), website: readDetailWebsite(), address: readDetailAddress() });
          }
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
    // Walk up from the feed and report each ancestor's scrollability — this tells
    // me exactly which element holds the scrollbar so I can target it.
    const scrollChain = [];
    let el = feed;
    for (let i = 0; el && i < 8; i += 1) {
      let oy = "";
      try { oy = window.getComputedStyle(el).overflowY; } catch { /* ignore */ }
      scrollChain.push({
        tag: el.tagName, cls: (el.className || "").toString().slice(0, 80),
        role: el.getAttribute && el.getAttribute("role"),
        overflowY: oy, scrollH: el.scrollHeight, clientH: el.clientHeight,
        scrollable: el.scrollHeight > el.clientHeight + 20
      });
      el = el.parentElement;
    }
    return ok({
      url: location.href,
      selectorVersion: GOOGLE_SELECTOR_VERSION,
      feedFound: !!feed,
      scrollContainerPicked: (() => { const s = getScrollContainer(); return s ? (s.tagName + "." + (s.className || "").toString().slice(0, 60)) : null; })(),
      scrollChain,
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

  // ---------- Panel (the extractor UI shown over Google Maps) ----------
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
    [Commands.DIAGNOSE]: async () => diagnose(),
    [Commands.GET_NET_DATA]: async () => ok({ net: Array.from(netData.entries()).map(([ftid, v]) => ({ ftid, ...v })) }),
    [Commands.DUMP_NET_DEBUG]: async () => {
      // ftids currently visible in the DOM list (what we *should* have captured).
      const feed = getFeed();
      const links = feed ? queryAll(feed, GOOGLE_SELECTORS.placeLink) : [];
      const domFtids = Array.from(new Set(
        links.map((l) => String(parseId(l.href || "") || "").toLowerCase()).filter((s) => s.includes("0x"))
      ));
      const netKeys = new Set(netData.keys());
      const withPhone = Array.from(netData.values()).filter((v) => v.phone).length;
      const withSite = Array.from(netData.values()).filter((v) => v.website).length;
      return ok({
        summary: {
          backendUrl: BACKEND_URL,
          netDataSize: netData.size,
          netWithPhone: withPhone,
          netWithWebsite: withSite,
          domFtidCount: domFtids.length,
          domFtidsMissingFromNet: domFtids.filter((f) => !netKeys.has(f)),
          bodiesForwarded: netDebug.bodies.length,
          backendCalls: netDebug.backend,
          totalRequests: netDebug.requests.length,
          requestsForwarded: netDebug.requests.filter((r) => r.forwarded).length
        },
        requests: netDebug.requests,
        bodyMeta: netDebug.bodies,
        fullSamples: netDebug.fullSamples,
        smallBodies: netDebug.smallBodies
      });
    }
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
