(async () => {
  const { Commands } = await import(chrome.runtime.getURL("src/messages.js"));
  const { BING_LAYOUTS, BING_SELECTOR_VERSION } = await import(chrome.runtime.getURL("src/selectors.js"));

  const PANEL_ID = "map-lead-extractor-panel";
  const PANEL_OPEN_KEY = "mapLeadExtractor.panelOpen";
  const PANEL_POS_KEY = "mapLeadExtractor.panelPos";
  const DEFAULT_PANEL_HEIGHT = "min(740px, 82vh)";

  function readableError(error, fallback) {
    return error?.message || String(error || fallback);
  }

  function ok(data = {}) {
    return { ok: true, ...data };
  }

  function fail(error, fallback = "Bing Maps extraction failed.") {
    return { ok: false, error: readableError(error, fallback) };
  }

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    if (!style || style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function queryFirst(root, selectors, label) {
    // Bing DOM touchpoint: selector fallback lookup for a fragile Bing-owned element.
    for (const selector of selectors) {
      try {
        const element = root.querySelector(selector);
        if (element) return { element, selector };
      } catch (error) {
        return { element: null, selector, error: `Bad selector for ${label}: ${selector}` };
      }
    }
    return { element: null, selector: null, error: `No ${label} matched any known Bing selector.` };
  }

  function queryAllFallback(root, selectors, label) {
    // Bing DOM touchpoint: listing item lookup across known Bing layout fallbacks.
    const nodes = [];
    const usedSelectors = [];
    for (const selector of selectors) {
      try {
        const found = Array.from(root.querySelectorAll(selector));
        if (found.length > 0) {
          usedSelectors.push(selector);
          nodes.push(...found);
        }
      } catch (error) {
        return { nodes: [], usedSelectors, error: `Bad selector for ${label}: ${selector}` };
      }
    }
    return { nodes: Array.from(new Set(nodes)), usedSelectors, error: null };
  }

  function detectLayout() {
    for (const layout of [...BING_LAYOUTS].sort((a, b) => a.priority - b.priority)) {
      // Bing DOM touchpoint: layout detection checks known Bing-owned markers.
      const detector = queryFirst(document, layout.detectors, `${layout.id} detector`);
      if (detector.element) {
        return { layout, detector: detector.selector };
      }
    }
    return { layout: null, detector: null };
  }

  function getListContext() {
    const detected = detectLayout();
    if (!detected.layout) {
      return {
        ok: false,
        error: "Bing layout not recognized — results may have changed.",
        selectorVersion: BING_SELECTOR_VERSION
      };
    }

    const container = queryFirst(document, detected.layout.listContainer, "results list container");
    if (!container.element) {
      return {
        ok: false,
        error: container.error || "Results list container was not found.",
        layoutId: detected.layout.id,
        selectorVersion: BING_SELECTOR_VERSION
      };
    }

    return {
      ok: true,
      layout: detected.layout,
      layoutId: detected.layout.id,
      layoutLabel: detected.layout.label,
      detector: detected.detector,
      container: container.element,
      containerSelector: container.selector,
      selectorVersion: BING_SELECTOR_VERSION
    };
  }

  function findEntityCarrier(node) {
    // Bing DOM touchpoint: data-entity is an internal Bing attribute and can change.
    if (!node) return null;
    if (node.getAttribute?.("data-entity")) return node;
    const closest = node.closest?.("[data-entity]");
    if (closest) return closest;
    return node.querySelector?.("[data-entity]") || null;
  }

  function parseEntity(node) {
    const carrier = findEntityCarrier(node);
    const raw = carrier?.getAttribute?.("data-entity");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.entity ? parsed : { entity: parsed };
    } catch {
      return null;
    }
  }

  function harvestVisibleEntities() {
    const context = getListContext();
    if (!context.ok) return context;

    const itemQuery = queryAllFallback(context.container, context.layout.listItems, "result items");
    if (itemQuery.error) return fail(itemQuery.error);
    if (itemQuery.nodes.length === 0) {
      return {
        ok: false,
        error: "No business listing items matched the known Bing selectors.",
        layoutId: context.layoutId,
        selectorVersion: context.selectorVersion
      };
    }

    // Collapse all matched nodes to their unique [data-entity] carriers, so the
    // same card matched by several selectors is only counted and parsed once.
    const carriers = [];
    const seenCarriers = new Set();
    for (const node of itemQuery.nodes) {
      const carrier = findEntityCarrier(node);
      if (carrier && !seenCarriers.has(carrier)) {
        seenCarriers.add(carrier);
        carriers.push(carrier);
      }
    }

    const entities = [];
    const ids = new Set();

    for (const carrier of carriers) {
      const wrapped = parseEntity(carrier);
      const entity = wrapped?.entity;
      const id = entity?.id || wrapped?.id || entity?.entityId || null;
      if (!entity) continue;
      if (id) {
        if (ids.has(id)) continue;
        ids.add(id);
      }
      entities.push(wrapped);
    }

    return ok({
      layoutId: context.layoutId,
      layoutLabel: context.layoutLabel,
      selectorVersion: context.selectorVersion,
      containerSelector: context.containerSelector,
      itemSelectors: itemQuery.usedSelectors,
      visibleItemCount: carriers.length,
      entityCount: entities.length,
      entities
    });
  }

  function hasLoadingIndicator(layout) {
    // Bing DOM touchpoint: loading indicators are Bing-owned classes and may change.
    for (const selector of layout.loadingIndicators) {
      try {
        const node = document.querySelector(selector);
        if (node && isVisible(node)) return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  function waitForMutation(timeoutMs) {
    return new Promise((resolve) => {
      let debounceTimer = null;

      const timer = window.setTimeout(() => {
        if (debounceTimer) window.clearTimeout(debounceTimer);
        observer.disconnect();
        resolve(false);
      }, timeoutMs);

      const check = () => {
        if (debounceTimer) window.clearTimeout(debounceTimer);
        debounceTimer = window.setTimeout(() => {
          const harvested = harvestVisibleEntities();
          if (harvested.ok && harvested.entityCount > 0) {
            window.clearTimeout(timer);
            observer.disconnect();
            resolve(true);
          }
        }, 150);
      };

      const context = getListContext();
      const target = (context.ok && context.container) ? context.container : (document.body || document.documentElement);
      const observer = new MutationObserver(check);
      observer.observe(target, { childList: true, subtree: true });
    });
  }

  async function waitForResults({ timeoutMs = 10000, retries = 2 } = {}) {
    let lastResult = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const harvested = harvestVisibleEntities();
      if (harvested.ok && harvested.entityCount > 0) return harvested;
      lastResult = harvested;

      const detected = detectLayout();
      if (detected.layout && hasLoadingIndicator(detected.layout)) {
        await waitForMutation(Math.min(timeoutMs, 4000));
      } else {
        await waitForMutation(timeoutMs);
      }
    }

    return lastResult || {
      ok: false,
      error: "No business listings found. Make sure Bing Maps search results are visible.",
      selectorVersion: BING_SELECTOR_VERSION
    };
  }

  function scrollResults() {
    const context = getListContext();
    if (!context.ok) return context;
    const scrollLookup = queryFirst(document, context.layout.scrollContainer, "scroll container");
    const scrollTarget = scrollLookup.element || context.container;

    // Bing DOM touchpoint: scrollable results panel is a Bing-owned container.
    const before = {
      top: scrollTarget.scrollTop,
      height: scrollTarget.scrollHeight
    };
    scrollTarget.scrollTop = scrollTarget.scrollHeight;
    scrollTarget.dispatchEvent(new Event("scroll", { bubbles: true }));
    const after = getScrollMetrics(scrollTarget);

    return ok({
      layoutId: context.layoutId,
      moved: scrollTarget.scrollTop !== before.top || scrollTarget.scrollHeight !== before.height,
      scrollTop: after.scrollTop,
      scrollHeight: after.scrollHeight,
      clientHeight: after.clientHeight,
      distanceToBottom: after.distanceToBottom,
      atBottom: after.atBottom
    });
  }

  function getScrollMetrics(element) {
    const scrollTop = Number(element.scrollTop || 0);
    const scrollHeight = Number(element.scrollHeight || 0);
    const clientHeight = Number(element.clientHeight || window.innerHeight || 0);
    const distanceToBottom = Math.max(0, scrollHeight - scrollTop - clientHeight);
    return {
      scrollTop,
      scrollHeight,
      clientHeight,
      distanceToBottom,
      atBottom: distanceToBottom <= Math.max(24, Math.round(clientHeight * 0.08))
    };
  }

  function isSafeControl(element) {
    const tag = element.tagName?.toLowerCase();
    const role = element.getAttribute?.("role") || "";
    if (tag !== "button" && tag !== "a" && role !== "button") return false;
    const label = `${element.getAttribute?.("aria-label") || ""} ${element.textContent || ""}`.toLowerCase();
    return /\b(search this area|next|more results|load more|show more)\b/.test(label);
  }

  function isNearContainerBottom(element, container) {
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const bottom = Math.min(containerRect.bottom || window.innerHeight, window.innerHeight);
    return elementRect.top >= containerRect.top && elementRect.bottom <= bottom + 80 && elementRect.top >= bottom - 220;
  }

  function clickFirstVisible(selectors, label, { container = null, bottomOnly = false } = {}) {
    // Bing DOM touchpoint: button discovery for next/search-area controls.
    for (const selector of selectors) {
      try {
        const nodes = Array.from(document.querySelectorAll(selector));
        const node = nodes.find((candidate) => {
          if (!isVisible(candidate) || !isSafeControl(candidate)) return false;
          return !bottomOnly || !container || isNearContainerBottom(candidate, container);
        });
        if (node) {
          node.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
          node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          return { clicked: true, selector };
        }
      } catch (error) {
        return { clicked: false, error: `Bad selector for ${label}: ${selector}` };
      }
    }
    return { clicked: false, selector: null };
  }

  function clickBottomControl() {
    const context = getListContext();
    if (!context.ok) return context;
    const scrollLookup = queryFirst(document, context.layout.scrollContainer, "scroll container");
    const scrollTarget = scrollLookup.element || context.container;
    const metrics = getScrollMetrics(scrollTarget);

    if (!metrics.atBottom) {
      return ok({ action: "none", atBottom: false, message: "Result list is not at the bottom yet." });
    }

    const loadMore = clickFirstVisible(context.layout.bottomLoadMoreButton || [], "bottom load-more button", {
      container: scrollTarget,
      bottomOnly: true
    });
    if (loadMore.error) return fail(loadMore.error);
    if (loadMore.clicked) return ok({ action: "load-more", selector: loadMore.selector, atBottom: true });

    const nextPage = clickFirstVisible(context.layout.nextPageButton, "bottom next-page button", {
      container: scrollTarget,
      bottomOnly: true
    });
    if (nextPage.error) return fail(nextPage.error);
    if (nextPage.clicked) return ok({ action: "next-page", selector: nextPage.selector, atBottom: true });

    return ok({ action: "none", atBottom: true, message: "No safe bottom control is visible." });
  }

  function advanceResults() {
    const context = getListContext();
    if (!context.ok) return context;

    const searchArea = clickFirstVisible(context.layout.searchThisAreaButton, "search this area button");
    if (searchArea.error) return fail(searchArea.error);
    if (searchArea.clicked) return ok({ action: "search-this-area", selector: searchArea.selector });

    const nextPage = clickFirstVisible(context.layout.nextPageButton, "next page button");
    if (nextPage.error) return fail(nextPage.error);
    if (nextPage.clicked) return ok({ action: "next-page", selector: nextPage.selector });

    return ok({ action: "none", message: "No search-area or next-page control is visible." });
  }

  function clampIntoView(iframe) {
    const rect = iframe.getBoundingClientRect();
    const offscreen =
      rect.left < 0 || rect.top < 0 ||
      rect.left > window.innerWidth - 80 || rect.top > window.innerHeight - 40;
    if (offscreen) {
      iframe.style.left = "auto";
      iframe.style.right = "28px";
      iframe.style.top = "72px";
    }
  }

  function ensurePanel() {
    let iframe = document.getElementById(PANEL_ID);
    if (iframe) {
      iframe.style.display = "block";
      clampIntoView(iframe);
      return iframe;
    }

    iframe = document.createElement("iframe");
    iframe.id = PANEL_ID;
    iframe.title = "Map Lead Extractor";
    iframe.src = chrome.runtime.getURL("panel/panel.html");
    Object.assign(iframe.style, {
      position: "fixed",
      top: "72px",
      right: "28px",
      width: "min(840px, 56vw)",
      height: DEFAULT_PANEL_HEIGHT,
      border: "0",
      borderRadius: "12px",
      zIndex: "2147483647",
      boxShadow: "0 22px 58px rgba(0, 0, 0, 0.42)",
      background: "#070b22"
    });
    document.documentElement.appendChild(iframe);

    // Restore a previously dragged position, if any — but always clamp it into
    // view so a stale off-screen position can never make the panel "not open".
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

  // The panel content lives inside the iframe, so it asks the content script
  // (which owns the iframe element) to move or resize it via postMessage.
  function setupPanelControls() {
    let dragOffset = null;
    let overlay = null;

    function endDrag() {
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
      dragOffset = null;
    }

    // Safety net: never leave the page stuck in drag mode.
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("blur", endDrag);

    window.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || typeof data !== "object" || typeof data.type !== "string" || !data.type.startsWith("MLE_")) {
        return;
      }
      const iframe = document.getElementById(PANEL_ID);
      if (!iframe || event.source !== iframe.contentWindow) return;

      if (data.type === "MLE_DRAG_START") {
        const rect = iframe.getBoundingClientRect();
        iframe.style.left = `${rect.left}px`;
        iframe.style.top = `${rect.top}px`;
        iframe.style.right = "auto";
        dragOffset = { x: data.offsetX || 0, y: data.offsetY || 0 };

        overlay = document.createElement("div");
        Object.assign(overlay.style, {
          position: "fixed",
          inset: "0",
          // Must sit ON TOP of the panel (same max z-index, appended later) so
          // mousemove/mouseup are captured even when the cursor is over the panel.
          zIndex: "2147483647",
          cursor: "move",
          background: "transparent"
        });
        overlay.addEventListener("mousemove", (moveEvent) => {
          if (!dragOffset) return;
          const maxLeft = Math.max(0, window.innerWidth - iframe.offsetWidth);
          const maxTop = Math.max(0, window.innerHeight - 40);
          const left = Math.min(Math.max(0, moveEvent.clientX - dragOffset.x), maxLeft);
          const top = Math.min(Math.max(0, moveEvent.clientY - dragOffset.y), maxTop);
          iframe.style.left = `${left}px`;
          iframe.style.top = `${top}px`;
        });
        const stop = () => {
          endDrag();
          const rect2 = iframe.getBoundingClientRect();
          chrome.storage.local.set({ [PANEL_POS_KEY]: { left: rect2.left, top: rect2.top } }).catch(() => {});
        };
        overlay.addEventListener("mouseup", stop);
        overlay.addEventListener("mouseleave", stop);
        document.documentElement.appendChild(overlay);
      }

      if (data.type === "MLE_RESIZE" && typeof data.height === "number") {
        // Size the panel to its actual content so there is never a wasted
        // empty block — capped so huge result lists scroll inside the table.
        const max = Math.round(window.innerHeight * 0.85);
        iframe.style.height = `${Math.min(Math.max(data.height + 2, 44), max)}px`;
        // Collapsed = compact control box so most of the map is uncovered.
        iframe.style.width = data.collapsed ? "min(420px, 92vw)" : "min(840px, 56vw)";
      }
    });
  }

  setupPanelControls();

  function hidePanel() {
    const iframe = document.getElementById(PANEL_ID);
    if (iframe) iframe.style.display = "none";
  }

  const handlers = {
    [Commands.GET_STATUS]: async () => ok({ ready: true, selectorVersion: BING_SELECTOR_VERSION }),
    [Commands.SHOW_PANEL]: async () => {
      await chrome.storage.local.set({ [PANEL_OPEN_KEY]: true });
      return ok({ panel: !!ensurePanel() });
    },
    [Commands.HIDE_PANEL]: async () => {
      await chrome.storage.local.set({ [PANEL_OPEN_KEY]: false });
      hidePanel();
      return ok();
    },
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
    [Commands.RESET_RUN]: async () => ok()
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      const handler = handlers[message?.command];
      if (!handler) {
        sendResponse(fail("Unknown content script command."));
        return;
      }

      try {
        sendResponse(await handler(message || {}));
      } catch (error) {
        sendResponse(fail(error));
      }
    })();

    return true;
  });

  // Auto-restore panel visibility from storage (persists across navigation and page reloads).
  chrome.storage.local.get(PANEL_OPEN_KEY).then((stored) => {
    if (stored[PANEL_OPEN_KEY] === true) {
      ensurePanel();
    }
  }).catch(() => {});
})();
