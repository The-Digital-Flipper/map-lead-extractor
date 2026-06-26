import { Commands, ROUTE_TO_CONTENT } from "../src/messages.js";
import { EXTENSION_VERSION } from "../src/version.js";
import { downloadCsv, downloadXlsx, getHeaders } from "./export.js";
import { EnrichmentQueue } from "./enrichment.js";

const STORAGE_KEYS = Object.freeze({
  enrichment: "mapLeadExtractor.enableEnrichment",
  stableAttempts: "mapLeadExtractor.stableAttempts",
  autoScroll: "mapLeadExtractor.autoScroll",
  apiKey: "mapLeadExtractor.apiKey"
});

// Loaded once at init, updated when the user saves the settings form.
let _cachedApiKey = "";

const DEFAULT_STABLE_ATTEMPTS = 3;
const WAIT_TIMEOUT_MS = 10000;
const WAIT_RETRIES = 2;
const SCROLL_DELAY_MS = 700;
const MANUAL_POLL_MS = 1200;
const PAGE_ADVANCE_DELAY_MS = 1000;

// Safety limits so a huge search can never run away and crash the page.
const MAX_ROWS = 1000;
const MAX_PAGE_ADVANCES = 60;
const MAX_SCROLLS_PER_PAGE = 90;

const rowsByKey = new Map();
const seenKeys = new Set();
const COLUMN_SYMBOLS = new Map([
  ["Address", "✓"],
  ["Google Maps URL", "📍"],
  ["Website", "🌐"],
  ["Emails", "📧"],
  ["Social Medias", "🔗"]
]);

// Shorter header labels for the on-screen preview only (exports keep full names).
const PREVIEW_LABELS = new Map([
  ["Address", "Addr ✓"],
  ["Google Maps URL", "Map 📍"],
  ["Rating info", "Reviews"],
  ["Open hours", "Hours"],
  ["Website", "Site 🌐"],
  ["Emails", "Email 📧"],
  ["Social Medias", "Social 🔗"]
]);

// Columns hidden from the on-screen preview only (still included in exports).
const PREVIEW_HIDDEN = new Set(["Open hours", "Status", "Price", "Has Website", "Plus Code"]);

function getPreviewHeaders() {
  return getHeaders().filter((header) => !PREVIEW_HIDDEN.has(header));
}

// Column widths so all columns fit the panel with no side-scrolling.
const COLUMN_WIDTHS = new Map([
  ["Name", "18%"],
  ["Phone", "13%"],
  ["Emails", "9%"],
  ["Website", "7%"],
  ["Social Medias", "9%"],
  ["Address", "7%"],
  ["Google Maps URL", "7%"],
  ["Category", "16%"],
  ["Rating", "7%"],
  ["Rating info", "9%"]
]);

const SOCIAL_ICONS = [
  { test: /facebook\.com/i, icon: "f", label: "Facebook", brand: "fb" },
  { test: /instagram\.com/i, icon: "", label: "Instagram", brand: "ig" },
  { test: /(?:twitter|x)\.com/i, icon: "🐦", label: "Twitter / X" },
  { test: /linkedin\.com/i, icon: "💼", label: "LinkedIn" }
];

let running = false;
let stopRequested = false;
let loadedVisibleCount = 0;
let netCapturedCount = 0;
let lastLayoutName = "";
let statusLevel = "idle";
let lastRenderedCount = -1;
let sampleEntity = null;
let previewDirty = false;
let lastEnrichCompleted = 0;

// Live event timeline — every significant action the extension takes, with a
// relative timestamp. The debug dump includes this so the whole run can be
// replayed/read at a glance. Survives across runs until Clear.
const debugTimeline = [];
const DEBUG_T0 = Date.now();
function dbg(event, data) {
  try {
    debugTimeline.push({ t: ((Date.now() - DEBUG_T0) / 1000).toFixed(2) + "s", event, ...(data ? { data } : {}) });
    if (debugTimeline.length > 600) debugTimeline.shift();
  } catch { /* never let logging break a run */ }
}

const els = {
  version: document.querySelector("[data-version]"),
  status: document.querySelector("[data-status]"),
  statusDot: document.querySelector("[data-status-dot]"),
  counts: document.querySelector("[data-counts]"),
  progress: document.querySelector("[data-progress]"),
  details: document.querySelector("[data-details]"),
  previewHead: document.querySelector("[data-preview-head]"),
  previewBody: document.querySelector("[data-preview-body]"),
  start: document.querySelector("[data-start]"),
  stop: document.querySelector("[data-stop]"),
  clear: document.querySelector("[data-clear]"),
  exportCsv: document.querySelector("[data-export-csv]"),
  exportXlsx: document.querySelector("[data-export-xlsx]"),
  close: document.querySelector("[data-close]"),
  enrichment: document.querySelector("[data-enrichment]"),
  autoScroll: document.querySelector("[data-autoscroll]"),
  copySample: document.querySelector("[data-copy-sample]"),
  collapse: document.querySelector("[data-collapse]"),
  header: document.querySelector("header"),
  infobox: document.querySelector("[data-infobox]"),
  diagnose: document.querySelector("[data-diagnose]"),
  dumpCapture: document.querySelector("[data-dump-capture]"),
  collapseLabel: document.querySelector("[data-collapse-label]")
};

const SUPPORT_NUMBER = "1-448-204-3040";
const SUPPORT_SMS = "sms:+14482043040";
const SUPPORT_EMAIL = "swoopaai@protonmail.com";

const HELP_CONTENT = {
  how: `<h3>⭐ The #1 rule for best results</h3>
    <p><b>One clean search at a time.</b> Type a single search (e.g. <i>restaurants in Dallas</i>),
    press <b>Enter</b>, then <b>do NOT retype in the search box or click city names on the map during a run.</b>
    Doing that swaps the list out from under the tool and the data won't match. Search → Enter → Start →
    let it finish → then move to a new area.</p>
    <h3>How it works</h3>
    <ol>
      <li>Open <b>Google Maps</b> and type <b>one</b> search — a business type + area, e.g.
      <i>restaurants in Dallas</i> — then press <b>Enter</b>.</li>
      <li>Click the extension icon, then <b>Open Extractor</b>.</li>
      <li>Press <b>Start Extraction</b>. It scrolls the results list and pulls each business —
      <b>name, phone, website, address, rating, reviews, category, hours, price &amp; status</b> — straight
      from Google's own data. Phone numbers come in automatically and are validated (no junk numbers).</li>
      <li><b>Leave the search box alone</b> while it runs. Want a different area? Wait for the run to finish first.</li>
      <li><b>Enrich</b> is on by default — it visits each business website to add the <b>email</b>, missing
      <b>phone</b>, and <b>social links</b> Google never shows. Wait for <b>✓ Enriched X sites</b> before exporting.</li>
      <li>Click any <b>📧 email</b> or <b>social logo</b> in the table to contact the lead instantly.</li>
      <li>Press <b>Export CSV</b> or <b>Export XLSX</b> to download all your leads.</li>
    </ol>
    <h3>About the result count</h3>
    <p>The <b>total found</b> number counts <b>unique businesses</b> — duplicates are removed automatically.</p>
    <h3>Why it stops — and how to get MORE leads</h3>
    <p><b>This is normal, not a glitch.</b> Google only hands the browser about <b>20–40 businesses per
    search</b> before it stops sending data. When the tool stops (say at 35), it pulled <b>everything Google
    was willing to give for that search</b>. The way to build a big list is to run <b>many searches across
    the map</b> — exactly how the expensive paid scrapers do it (they split the map into chunks). Routine:</p>
    <ol>
      <li>Type <b>one</b> search (e.g. <i>restaurants in Dallas</i>), press <b>Enter</b>.</li>
      <li><b>Zoom IN</b> on one neighborhood — a tighter area gives fresh businesses.</li>
      <li>Press <b>Start Extraction</b>, let it finish (and let <b>Enrich</b> finish).</li>
      <li><b>Pan the map</b> to the next neighborhood (North Dallas → Plano → Irving…), search again,
      and press <b>Start Extraction</b> again.</li>
      <li>Change the keyword too — <i>cafes</i>, <i>bars</i>, <i>diners</i> — to surface different businesses.</li>
      <li>When you've got enough, press <b>Export CSV / XLSX</b>.</li>
    </ol>
    <p>✅ <b>Don't worry about overlap.</b> The tool removes duplicates automatically (by Google's place ID),
    so running an area twice never gives you repeats — new businesses just stack on top of your list.</p>
    <p>⚠️ <b>If a run comes back with few phones/websites,</b> the list probably came from browsing the map
    or a changed search. Just do one clean search (type it, press Enter, don't retype) and Start again.</p>
    <h3>No website = your best prospects</h3>
    <p>Check the <b>Has Website</b> column (in your CSV/XLSX export): businesses marked <b>No</b> are prime
    targets if you sell websites, SEO, or Google-listing services.</p>`,
  ads: `<h3>Need a custom tool?</h3>
    <p>I also build custom extensions, automations, and apps. If you'd like something
    built for your business, feel free to reach out — happy to help.</p>
    <p><a href="${SUPPORT_SMS}">📲 Text: ${SUPPORT_NUMBER}</a></p>
    <p><a href="mailto:${SUPPORT_EMAIL}?subject=Custom%20build%20inquiry">✉️ Email: ${SUPPORT_EMAIL}</a></p>`,
  support: `<h3>Support</h3>
    <p>Questions or trouble? We're happy to help — reach out anytime.</p>
    <p><a href="${SUPPORT_SMS}">💬 Text ${SUPPORT_NUMBER}</a></p>
    <p><a href="mailto:${SUPPORT_EMAIL}?subject=Google%20Maps%20Lead%20Extractor%20support">✉️ Email: ${SUPPORT_EMAIL}</a></p>`
};

let activeHelp = null;

const enrichmentQueue = new EnrichmentQueue({
  concurrency: 5,
  timeoutMs: 9000,
  onUpdate: (snapshot) => {
    // Only force a table rebuild when a website fetch actually finished
    // (so newly found emails/socials appear) — not on every queue tick.
    if (snapshot && snapshot.completed !== lastEnrichCompleted) {
      lastEnrichCompleted = snapshot.completed;
      previewDirty = true;
      // Log enrichment progress every 10 sites so the timeline shows its pace.
      if (snapshot.completed % 10 === 0 || (snapshot.queued === 0 && snapshot.active === 0)) {
        dbg("enrich-progress", { completed: snapshot.completed, queued: snapshot.queued, active: snapshot.active });
      }
    }
    render();
  }
});

init().catch((error) => {
  setStatus(readableError(error), "error");
  render();
});

async function init() {
  els.version.textContent = `v${EXTENSION_VERSION}`;
  buildPreviewHeader();

  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.enrichment,
    STORAGE_KEYS.stableAttempts,
    STORAGE_KEYS.autoScroll,
    STORAGE_KEYS.apiKey
  ]);
  _cachedApiKey = stored[STORAGE_KEYS.apiKey] || "";
  // Auto-scroll defaults ON (only off if the user explicitly turned it off).
  els.autoScroll.checked = stored[STORAGE_KEYS.autoScroll] !== false;
  // Enrichment defaults ON (only off if the user explicitly turned it off).
  // It needs all-sites access; if that isn't granted, fall back to off.
  let enabled = stored[STORAGE_KEYS.enrichment] !== false;
  if (enabled && !(await hasEnrichmentPermission())) {
    enabled = false;
  }
  els.enrichment.checked = enabled;
  enrichmentQueue.setEnabled(enabled);

  wireApiKeySettings();
  wireEvents();
  setStatus("Ready. Open Google Maps search results, then start extraction.", "idle");
  render();
  reportPanelHeight();
}

function wireApiKeySettings() {
  const input = document.getElementById("apiKeyInput");
  const saveBtn = document.getElementById("apiKeySave");
  const statusEl = document.getElementById("apiKeyStatus");
  if (!input || !saveBtn) return;
  chrome.storage.local.get([STORAGE_KEYS.apiKey]).then((stored) => {
    const key = stored[STORAGE_KEYS.apiKey] || "";
    input.value = key;
    _cachedApiKey = key;
    if (key) statusEl.textContent = "✓ API key saved";
  });
  saveBtn.addEventListener("click", async () => {
    const key = input.value.trim();
    await chrome.storage.local.set({ [STORAGE_KEYS.apiKey]: key });
    _cachedApiKey = key;
    statusEl.textContent = key ? "✓ API key saved — leads will sync to your dashboard." : "API key cleared.";
    setTimeout(() => { statusEl.textContent = ""; }, 4000);
  });
}

function wireEvents() {
  els.start.addEventListener("click", () => {
    runHarvest().catch((error) => {
      running = false;
      setStatus(readableError(error), "error");
      render();
    });
  });

  els.stop.addEventListener("click", () => {
    stopRequested = true;
    setStatus("Stopping after the current page step. Current rows remain exportable.", "warn");
    render();
  });

  els.clear.addEventListener("click", () => {
    if (running) {
      stopRequested = true;
    }
    clearRows();
    setStatus("Cleared local results.", "idle");
    render();
  });

  els.exportCsv.addEventListener("click", () => {
    downloadCsv(getRows());
  });

  els.exportXlsx.addEventListener("click", () => {
    downloadXlsx(getRows());
  });

  els.close.addEventListener("click", () => {
    void sendToContent(Commands.HIDE_PANEL);
  });

  // Diagnose: capture what Google's page looks like and save it to Downloads.
  els.diagnose.addEventListener("click", async () => {
    setStatus("Capturing page diagnostics...", "running");
    render();
    const res = await sendToContent(Commands.DIAGNOSE);
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "maplead-google-diagnose.txt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Saved 'maplead-google-diagnose.txt' to your Downloads. Send it to your developer.", "complete");
    render();
  });

  els.dumpCapture.addEventListener("click", async () => {
    setStatus("Dumping captured network data...", "running");
    render();
    const res = await sendToContent(Commands.DUMP_NET_DEBUG);
    // Also grab the live DOM/scroll diagnostics in the same file.
    let diag = null;
    try { diag = await sendToContent(Commands.DIAGNOSE); } catch { /* optional */ }

    // EVERYTHING AT ONCE: capture + enrichment + rows + timeline + DOM/scroll.
    const rows = getRows();
    const has = (k) => rows.filter((r) => r[k]).length;
    const fullReport = {
      version: EXTENSION_VERSION,
      capturedAt: new Date().toISOString(),
      settings: {
        enrichmentPermissionGranted: await hasEnrichmentPermission(),
        enrichmentEnabled: els.enrichment.checked,
        autoScrollEnabled: els.autoScroll.checked
      },
      rowCoverage: {
        totalRows: rows.length,
        withPhone: has("Phone"),
        withEmail: has("Emails"),
        withWebsite: has("Website"),
        withSocial: has("Social Medias"),
        withRating: has("Rating"),
        withAddress: has("Address")
      },
      enrichmentDebug: enrichmentQueue.debugSnapshot(),
      capture: res,
      domScroll: diag,
      timeline: debugTimeline,
      rows: rows.slice(0, 200).map((r) => ({
        Name: r.Name, Phone: r.Phone, Emails: r.Emails, Website: r.Website,
        "Social Medias": r["Social Medias"], Address: r.Address, Rating: r.Rating,
        Category: r.Category, __key: r.__key
      }))
    };
    const blob = new Blob([JSON.stringify(fullReport, null, 2)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "maplead-capture-debug.txt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    const s = res?.summary;
    setStatus(
      s
        ? `Saved 'maplead-capture-debug.txt'. Captured ${s.netDataSize}, DOM ${s.domFtidCount}, missing ${s.domFtidsMissingFromNet?.length ?? "?"}.`
        : "Saved 'maplead-capture-debug.txt' to your Downloads.",
      "complete"
    );
    render();
  });

  // Collapse / expand the results area; panel auto-fits either way.
  els.collapse.addEventListener("click", () => {
    const collapsed = document.body.classList.toggle("collapsed");
    if (els.collapseLabel) els.collapseLabel.textContent = collapsed ? "Show List" : "See Map";
    els.collapse.title = collapsed ? "Expand the panel to see your leads" : "Shrink the panel so you can see the map";
    reportPanelHeight();
  });

  // How it works / Advertise / Support info buttons.
  for (const button of document.querySelectorAll("[data-help]")) {
    button.addEventListener("click", () => {
      const key = button.dataset.help;
      if (activeHelp === key) {
        els.infobox.hidden = true;
        els.infobox.innerHTML = "";
        activeHelp = null;
      } else {
        els.infobox.innerHTML = HELP_CONTENT[key] || "";
        els.infobox.hidden = false;
        activeHelp = key;
      }
      reportPanelHeight();
    });
  }

  // Drag the whole panel by its header (the content script moves the iframe).
  els.header.addEventListener("mousedown", (event) => {
    if (event.target.closest("button")) return;
    window.parent.postMessage(
      { type: "MLE_DRAG_START", offsetX: event.clientX, offsetY: event.clientY },
      "*"
    );
  });

  els.copySample.addEventListener("click", async () => {
    if (!sampleEntity) {
      setStatus("Run extraction first, then click Copy sample data.", "warn");
      render();
      return;
    }
    const text = JSON.stringify(sampleEntity, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Sample data copied to clipboard. Paste it to your developer.", "complete");
    } catch {
      console.log("[MapLeadExtractor] sample entity:\n" + text);
      setStatus("Could not copy automatically — open the console to copy the sample.", "warn");
    }
    render();
  });

  els.autoScroll.addEventListener("change", async () => {
    const on = els.autoScroll.checked;
    await chrome.storage.local.set({ [STORAGE_KEYS.autoScroll]: on });
    setStatus(
      on
        ? "Auto-scroll ON — the tool scrolls the list for you."
        : "Auto-scroll OFF — scroll the Google list yourself; the tool captures as you go.",
      "idle"
    );
    render();
  });

  els.enrichment.addEventListener("change", async () => {
    const enabled = els.enrichment.checked;

    // Enrichment reads business websites, which needs all-sites access.
    // Request it at runtime (this is the user gesture) instead of at install.
    if (enabled && !(await requestEnrichmentPermission())) {
      els.enrichment.checked = false;
      enrichmentQueue.setEnabled(false);
      await chrome.storage.local.set({ [STORAGE_KEYS.enrichment]: false });
      setStatus("Enrichment needs permission to read business websites — left off. Main extraction still works.", "warn");
      render();
      return;
    }

    enrichmentQueue.setEnabled(enabled);
    await chrome.storage.local.set({ [STORAGE_KEYS.enrichment]: enabled });
    if (enabled) {
      for (const row of getRows()) {
        enrichmentQueue.enqueue(row);
      }
      setStatus("Enrichment on — this takes a little longer since it visits each website for emails & socials. Export still works.", "idle");
    } else {
      setStatus("Enrichment is off. Main extraction is unaffected.", "idle");
    }
    render();
  });
}

const ENRICH_ORIGINS = { origins: ["*://*/*"] };

async function hasEnrichmentPermission() {
  try {
    return await chrome.permissions.contains(ENRICH_ORIGINS);
  } catch {
    return false;
  }
}

async function requestEnrichmentPermission() {
  if (await hasEnrichmentPermission()) return true;
  try {
    return await chrome.permissions.request(ENRICH_ORIGINS);
  } catch {
    return false;
  }
}

async function runHarvest() {
  if (running) {
    return;
  }

  clearRows();
  running = true;
  stopRequested = false;
  loadedVisibleCount = 0;
  lastLayoutName = "";
  setStatus("Finding Google Maps result list...", "running");
  render();

  const stableAttempts = await getStableAttempts();
  const autoScroll = els.autoScroll.checked;
  dbg("run-start", { autoScroll, enrich: els.enrichment.checked, stableAttempts });
  await sendToContent(Commands.RESET_RUN);

  const initialWait = await sendToContent(Commands.WAIT_FOR_RESULTS, {
    timeoutMs: WAIT_TIMEOUT_MS,
    retries: WAIT_RETRIES
  });
  if (!initialWait?.ok) {
    setStatus(initialWait?.error || "Google Maps layout not recognized - results may have changed.", "warn");
  }

  let pageAdvances = 0;
  while (!stopRequested) {
    const pageResult = await harvestCurrentPage(stableAttempts, autoScroll);
    dbg("page-harvested", { found: rowsByKey.size, captured: netCapturedCount, loaded: loadedVisibleCount });
    if (!pageResult.ok) {
      dbg("page-error", { message: pageResult.message });
      setStatus(pageResult.message, "error");
      break;
    }

    if (stopRequested) {
      break;
    }

    if (rowsByKey.size >= MAX_ROWS) {
      setStatus(`Reached the ${MAX_ROWS}-result safety limit. Stopping — export your leads.`, "complete");
      break;
    }

    const advanced = await sendToContent(Commands.ADVANCE_RESULTS);
    if (!advanced?.ok) {
      setStatus(advanced?.error || "Could not advance the result list.", "warn");
      break;
    }

    if (advanced.action === "none") {
      dbg("run-complete", { found: rowsByKey.size, captured: netCapturedCount });
      setStatus(`Run complete - ${rowsByKey.size} found, ${netCapturedCount} with full contact data. Filling the rest...`, "complete");
      break;
    }

    pageAdvances += 1;
    if (pageAdvances >= MAX_PAGE_ADVANCES) {
      setStatus(`Reached the page-advance safety limit with ${rowsByKey.size} found. Stopping.`, "complete");
      break;
    }

    setStatus(`Advanced results with ${describeAdvanceAction(advanced.action)}. Waiting for new listings...`, "running");
    render();
    await sleep(PAGE_ADVANCE_DELAY_MS);
    const wait = await sendToContent(Commands.WAIT_FOR_RESULTS, { timeoutMs: 5000, retries: 0 });
    if (!wait?.ok) {
      setStatus(wait?.error || "Google Maps layout not recognized - results may have changed.", "warn");
    }
  }

  if (stopRequested) {
    setStatus(`Stopped - ${rowsByKey.size} total found so far.`, "warn");
  }

  running = false;
  render();

  // Save the harvested leads to the cloud database (covers both the normal
  // finish and the stopRequested path, which both converge here).
  saveLeadsToBackend(getRows());

  // Pull the full phone/website data (incl. anything the backend decoded) and
  // fill every row. Retry a few times to catch late backend responses.
  for (const delay of [0, 1500, 3500, 6000, 9000, 13000]) {
    setTimeout(() => { applyNetData().catch(() => {}); }, delay);
  }
  // After it all settles, warn if almost nothing matched — that means the list
  // came from browsing the map / a changed search rather than a clean search,
  // so Google never sent us that data.
  setTimeout(() => {
    const rows = getRows();
    if (running || rows.length < 5) return;
    const withContact = rows.filter((r) => r.Phone || r.Website).length;
    const ratio = withContact / rows.length;
    if (ratio < 0.25) {
      dbg("low-coverage-warning", { rows: rows.length, withContact, ratio: ratio.toFixed(2) });
      setStatus(
        `⚠ Only ${withContact}/${rows.length} got contact data. This happens when the list came from browsing the map or a changed search. Fix: type ONE search (e.g. "restaurants in Dallas"), press Enter, don't retype, then Start.`,
        "warn"
      );
      render();
    }
    // Re-save once enrichment + decoding have settled, so the cloud copy gets
    // the emails, socials and late phones too (backend upserts by key).
    saveLeadsToBackend(getRows());
  }, 15000);
}

async function saveLeadsToBackend(rows) {
  if (!rows || rows.length === 0) return;
  const API = "https://mapleadextractor.net/api/leads/save";
  const buildHeaders = () => {
    const h = { "Content-Type": "application/json" };
    if (_cachedApiKey) h["X-Api-Key"] = _cachedApiKey;
    return h;
  };
  const attempt = async () => {
    const res = await fetch(API, {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(rows),
    });
    if (res.status === 402) {
      const data = await res.json().catch(() => ({}));
      throw new Error("limit:" + (data.message || "Upgrade to Pro to save more leads."));
    }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  };
  try {
    const result = await attempt();
    const current = els.status.textContent || "";
    els.status.textContent = current + " · ☁ " + result.saved + " saved";
  } catch (err) {
    const msg = (err && err.message) || "";
    if (msg.startsWith("limit:")) {
      setStatus("⚠ " + msg.slice(6) + " Visit mapleadextractor.net to upgrade.", "warn");
      render();
      return;
    }
    await new Promise(r => window.setTimeout(r, 3000));
    try { await attempt(); } catch { /* silent */ }
  }
}

async function applyNetData() {
  const res = await sendToContent(Commands.GET_NET_DATA);
  if (!res?.ok || !Array.isArray(res.net)) return;
  const map = new Map(res.net.map((n) => [String(n.ftid).toLowerCase(), n]));
  let updated = 0;
  let queued = 0;
  for (const row of getRows()) {
    const n = map.get(String(row.__key || "").toLowerCase());
    if (!n) continue;
    if (n.phone && row.Phone !== n.phone) { row.Phone = n.phone; updated += 1; }
    if (n.website && !row.Website) row.Website = n.website;
    if (n.plusCode && !row["Plus Code"]) row["Plus Code"] = n.plusCode;
    if (n.address && !row.Address) row.Address = n.address;
    if (row.Website && row["Has Website"] !== "Yes") row["Has Website"] = "Yes";
    // A website that arrived AFTER harvest means this row was never queued for
    // enrichment. Queue it now so every site gets email/social/phone (the queue
    // skips ones it already did). This is what lets enrichment cover ALL rows,
    // not just the ~20 that happened to have a website at harvest time.
    if (row.Website) {
      const before = enrichmentQueue.seen.size;
      enrichmentQueue.enqueue(row);
      if (enrichmentQueue.seen.size > before) queued += 1;
    }
  }
  if (updated || queued) {
    previewDirty = true;
    dbg("netdata-applied", { filledPhones: updated, queuedForEnrich: queued, netDataSize: map.size });
    const bits = [];
    if (updated) bits.push(`filled ${updated} phone(s)`);
    if (queued) bits.push(`queued ${queued} more site(s) for email/social`);
    setStatus(`Decoder ${bits.join(" and ")}. ${rowsByKey.size} leads.`, "complete");
  }
  render();
}

async function harvestCurrentPage(stableAttempts, autoScroll = true) {
  let stableCount = 0;
  let lastTotal = rowsByKey.size;
  let scrolls = 0;

  while (!stopRequested) {
    const harvest = await sendToContent(Commands.HARVEST_VISIBLE);
    if (!harvest?.ok) {
      return { ok: false, message: harvest?.error || "Could not read visible Google Maps results." };
    }

    ingestHarvest(harvest);
    if (rowsByKey.size > lastTotal) {
      stableCount = 0;
      lastTotal = rowsByKey.size;
    } else {
      stableCount += 1;
    }

    if (rowsByKey.size >= MAX_ROWS) {
      return { ok: true };
    }

    // Manual mode: the user scrolls the Google list themselves. We just keep
    // re-reading what's visible (and capturing network data) until they press
    // Stop — never auto-scroll, never auto-finish.
    if (!autoScroll) {
      setStatus(`Manual scroll — ${rowsByKey.size} found · scroll the Google list yourself, then press Stop. (${netCapturedCount} captured)`, "running");
      render();
      await sleep(MANUAL_POLL_MS);
      continue;
    }

    setStatus(`Harvesting - ${rowsByKey.size} found · Google network data: ${netCapturedCount} places captured`, "running");
    render();

    if (stableCount >= stableAttempts) {
      return { ok: true };
    }

    scrolls += 1;
    if (scrolls >= MAX_SCROLLS_PER_PAGE) {
      return { ok: true };
    }

    const scroll = await sendToContent(Commands.SCROLL_RESULTS);
    if (!scroll?.ok) {
      return { ok: false, message: scroll?.error || "Could not scroll the Google Maps result list." };
    }

    await sleep(SCROLL_DELAY_MS);

    if (scroll.atBottom && stableCount > 0) {
      const bottomClick = await sendToContent(Commands.CLICK_BOTTOM_CONTROL);
      if (!bottomClick?.ok) {
        return { ok: false, message: bottomClick?.error || "Could not click the bottom result control." };
      }
      if (bottomClick.action !== "none") {
        setStatus(`Bottom reached - clicked ${describeAdvanceAction(bottomClick.action)}. Waiting for more listings...`, "running");
        render();
        stableCount = 0;
        await sleep(PAGE_ADVANCE_DELAY_MS);
        const wait = await sendToContent(Commands.WAIT_FOR_RESULTS, { timeoutMs: 5000, retries: 0 });
        if (!wait?.ok) {
          setStatus(wait?.error || "Waiting for new bottom results timed out; continuing harvest.", "warn");
        }
      }
    }
  }

  return { ok: true };
}

function ingestHarvest(harvest) {
  loadedVisibleCount = Number(harvest.visibleItemCount || harvest.entityCount || harvest.entities?.length || 0);
  netCapturedCount = Number(harvest.netCaptured || netCapturedCount || 0);
  lastLayoutName = harvest.layoutLabel || harvest.layoutId || lastLayoutName;

  if (!sampleEntity && harvest.entities?.length) {
    sampleEntity = harvest.entities[0];
    console.log("[MapLeadExtractor] sample entity:", JSON.stringify(sampleEntity, null, 2));
  }

  for (const wrapped of harvest.entities || []) {
    // Compute the dedupe key cheaply FIRST and skip listings we already have,
    // so the expensive row build (rating/hours/social scans) runs once per
    // listing instead of for every visible item on every scroll.
    try {
      const key = computeRowKey(wrapped);
      if (!key || seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);
      const row = entityToRow(wrapped);
      rowsByKey.set(key, row);
      enrichmentQueue.enqueue(row);
    } catch (error) {
      // A single malformed listing must never break or freeze the whole run.
      console.warn("[MapLeadExtractor] skipped a listing:", error);
    }
  }
}

// Cheap key derivation (no deep scans) used to skip already-captured listings.
function computeRowKey(wrapped) {
  const entity = wrapped?.entity && typeof wrapped.entity === "object" ? wrapped.entity : wrapped;
  const realId = firstValue(entity.id, entity.entityId, entity.localEntityId, wrapped?.id);
  if (realId) return realId;
  const name = firstValue(entity.title, entity.name, entity.displayName);
  const address = addressToText(firstValue(entity.address, entity.addressLines, entity.location?.address));
  const latitude = firstValue(entity.routablePoint?.latitude, entity.point?.latitude, entity.geo?.latitude);
  const longitude = firstValue(entity.routablePoint?.longitude, entity.point?.longitude, entity.geo?.longitude);
  return [name, address, latitude, longitude].filter(Boolean).join("|");
}

function entityToRow(wrapped) {
  const entity = wrapped?.entity && typeof wrapped.entity === "object" ? wrapped.entity : wrapped;
  const realId = firstValue(entity.id, entity.entityId, entity.localEntityId, wrapped?.id);
  const name = firstValue(entity.title, entity.name, entity.displayName);
  const address = addressToText(firstValue(entity.address, entity.addressLines, entity.location?.address));
  const latitude = firstValue(entity.routablePoint?.latitude, entity.point?.latitude, entity.geo?.latitude);
  const longitude = firstValue(entity.routablePoint?.longitude, entity.point?.longitude, entity.geo?.longitude);
  const key = realId || [name, address, latitude, longitude].filter(Boolean).join("|");
  const textBlob = collectStrings(entity, []).join(" ").slice(0, 20000);

  return {
    __key: key,
    Name: name,
    Address: address,
    "Google Maps URL": firstValue(entity.mapsUrl, entity.url) || buildGoogleMapsUrl(name, address, latitude, longitude),
    Rating: firstValue(
      entity.rating,
      entity.averageRating,
      entity.ratingScore,
      entity.reviewScore,
      entity.starRating,
      entity.stars,
      entity.ratingValue,
      entity.reviewData?.averageRating,
      entity.reviewData?.rating,
      entity.reviewSummary?.rating,
      entity.reviewSummary?.ratingValue,
      entity.reviewSummary?.score,
      entity.aggregateRating?.ratingValue,
      entity.localBusiness?.averageRating,
      entity.localBusiness?.rating
    ) || deepFindRating(entity),
    "Rating info": firstValue(
      entity.ratingInfo,
      entity.ratingCount,
      entity.reviewCount,
      entity.numReviews,
      entity.totalRatings,
      entity.totalReviews,
      entity.reviewData?.reviewCount,
      entity.reviewData?.count,
      entity.reviewSummary?.text,
      entity.reviewSummary?.reviewCount,
      entity.reviewSummary?.count,
      entity.aggregateRating?.reviewCount,
      entity.localBusiness?.reviewCount
    ) || deepFindRatingInfo(entity),
    Category: categoryToText(firstValue(entity.primaryCategoryName, entity.category, entity.categories)),
    "Open hours": hoursToText(firstValue(entity.openHours, entity.hours, entity.businessHours, entity.openingHours)) || deepFindHours(entity),
    Website: normalizeWebsite(firstValue(entity.website, entity.url, entity.homepage)),
    Phone: phoneToText(firstValue(entity.phone, entity.telephone, entity.phoneNumber)),
    Emails: findEmailInText(textBlob),
    "Social Medias": findSocialsInText(textBlob),
    Status: firstValue(entity.status) || "Open",
    Price: firstValue(entity.priceLevel),
    "Has Website": firstValue(entity.hasWebsite) || (entity.website ? "Yes" : "No"),
    "Plus Code": firstValue(entity.plusCode)
  };
}

function firstValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    if (typeof value === "string" && value.trim() === "") {
      continue;
    }
    return value;
  }
  return "";
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (cleaned === "") return NaN;
    return Number(cleaned);
  }
  return NaN;
}

// Last-resort fallback: recursively scan the entity for a rating/review field
// when none of the known key names matched. Prefers shallow matches.
function deepFind(node, keyMatches, valueMatches, depth = 0) {
  if (!node || typeof node !== "object" || depth > 6) return undefined;
  const entries = Object.entries(node);
  for (const [key, value] of entries) {
    if ((value === null || typeof value !== "object") && keyMatches(key) && valueMatches(value)) {
      return value;
    }
  }
  for (const [, value] of entries) {
    if (value && typeof value === "object") {
      const found = deepFind(value, keyMatches, valueMatches, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function deepFindRating(entity) {
  const found = deepFind(
    entity,
    (key) => /rating|stars?|score/i.test(key) && !/count|info|num|total|reviews?$/i.test(key),
    (value) => {
      const n = toNumber(value);
      return Number.isFinite(n) && n > 0 && n <= 5;
    }
  );
  return found === undefined ? "" : found;
}

function deepFindRatingInfo(entity) {
  const found = deepFind(
    entity,
    (key) => /(review|rating).*count|numreviews|totalreviews|totalratings|reviewcount/i.test(key),
    (value) => {
      const n = toNumber(value);
      return Number.isFinite(n) && n >= 0;
    }
  );
  return found === undefined ? "" : found;
}

function deepFindHours(entity) {
  const found = deepFind(
    entity,
    (key) => /hours|openhours|businesshours|hoursofoperation|openinghours/i.test(key),
    (value) => typeof value === "string" && value.trim() !== ""
  );
  return found === undefined ? "" : found;
}

// Gather every string value anywhere in the listing object into one blob,
// so we can scan it for social links / emails the listing already exposes.
function collectStrings(node, acc, depth = 0) {
  if (node == null || depth > 6) return acc;
  if (typeof node === "string") {
    if (node) acc.push(node);
  } else if (typeof node === "object") {
    for (const value of Object.values(node)) collectStrings(value, acc, depth + 1);
  }
  return acc;
}

const SOCIAL_URL_PATTERNS = [
  /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/i,
  /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i,
  /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>]+/i,
  /https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/i
];

const ENTITY_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function findSocialsInText(text) {
  const found = [];
  for (const pattern of SOCIAL_URL_PATTERNS) {
    const match = text.match(pattern);
    if (match) found.push(match[0]);
  }
  return found.join(", ");
}

function findEmailInText(text) {
  const match = text.match(ENTITY_EMAIL_PATTERN);
  return match ? match[0] : "";
}

function addressToText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(addressToText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return firstValue(
      value.formattedAddress,
      value.addressLine,
      value.streetAddress,
      [value.addressLine, value.locality, value.adminDistrict, value.postalCode].filter(Boolean).join(", ")
    );
  }
  return String(value);
}

function categoryToText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(categoryToText).filter(Boolean).join("; ");
  }
  if (typeof value === "object") {
    return firstValue(value.name, value.title, value.text);
  }
  return String(value);
}

function hoursToText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(hoursToText).filter(Boolean).join("; ");
  }
  if (typeof value === "object") {
    return firstValue(value.text, value.displayText, value.status, JSON.stringify(value));
  }
  return String(value);
}

function phoneToText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(phoneToText).filter(Boolean).join("; ");
  if (typeof value === "object") return firstValue(value.number, value.displayNumber, value.text);
  return String(value);
}

function normalizeWebsite(value) {
  if (!value) return "";
  if (typeof value === "object") {
    return firstValue(value.url, value.href, value.displayUrl);
  }
  return String(value);
}

function buildGoogleMapsUrl(name, address, latitude, longitude) {
  const query = encodeURIComponent([name, address].filter(Boolean).join(" "));
  if (latitude && longitude) {
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=&ll=${latitude},${longitude}`;
  }
  if (query) {
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  return "";
}

async function sendToContent(command, payload = {}) {
  const response = await chrome.runtime.sendMessage({
    type: ROUTE_TO_CONTENT,
    payload: { command, ...payload }
  });
  return response;
}

async function getStableAttempts() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.stableAttempts);
  const value = Number(stored[STORAGE_KEYS.stableAttempts]);
  if (Number.isFinite(value) && value > 0 && value <= 20) {
    return Math.floor(value);
  }
  return DEFAULT_STABLE_ATTEMPTS;
}

function clearRows() {
  rowsByKey.clear();
  seenKeys.clear();
  loadedVisibleCount = 0;
  lastLayoutName = "";
  lastRenderedCount = -1;
  sampleEntity = null;
  previewDirty = false;
  lastEnrichCompleted = 0;
  enrichmentQueue.reset();
}

function getRows() {
  return [...rowsByKey.values()];
}

function buildPreviewHeader() {
  els.previewHead.innerHTML = "";
  const row = document.createElement("tr");
  for (const header of getPreviewHeaders()) {
    const th = document.createElement("th");
    th.textContent = PREVIEW_LABELS.get(header) || header;
    th.title = header;
    const width = COLUMN_WIDTHS.get(header);
    if (width) th.style.width = width;
    row.append(th);
  }
  els.previewHead.append(row);
}

function render() {
  els.status.textContent = currentStatusText();
  els.statusDot.dataset.level = statusLevel;
  els.counts.textContent = `${loadedVisibleCount} loaded / ${rowsByKey.size} total found`;
  if (running) {
    els.progress.removeAttribute("value");
  } else {
    els.progress.value = statusLevel === "complete" ? 100 : 0;
  }
  els.details.textContent = detailsText();

  els.start.disabled = running;
  els.stop.disabled = !running;
  els.clear.disabled = running && rowsByKey.size === 0;
  els.exportCsv.disabled = rowsByKey.size === 0;
  els.exportXlsx.disabled = rowsByKey.size === 0;

  renderPreview();
}

// Higher score = more complete lead. Drives the "most important at top" ordering.
function importanceScore(row) {
  let score = 0;
  if (row.Phone) score += 4;
  if (row.Emails) score += 4;
  if (row.Website) score += 3;
  if (row["Social Medias"]) score += 3;
  if (row.Rating) score += 1;
  if (row.Address) score += 1;
  if (row.Name) score += 1;
  return score;
}

function renderPreview() {
  if (!previewDirty && rowsByKey.size === lastRenderedCount) return;
  previewDirty = false;
  lastRenderedCount = rowsByKey.size;
  els.previewBody.innerHTML = "";
  const rows = getRows()
    .sort((a, b) => importanceScore(b) - importanceScore(a))
    .slice(0, 50);
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const header of getPreviewHeaders()) {
      const td = document.createElement("td");
      const value = row[header] || "";
      if (COLUMN_SYMBOLS.has(header)) {
        fillIconCell(td, header, value);
      } else {
        td.textContent = value;
      }
      tr.append(td);
    }
    els.previewBody.append(tr);
  }
  reportPanelHeight();
}

// Renders the clickable-logo cells. Email and social logos open the lead
// directly (mailto / the social profile) — one-click outreach.
function fillIconCell(td, header, value) {
  td.className = "cell-links";
  if (!value) {
    td.textContent = "";
    return;
  }

  if (header === "Address") {
    td.textContent = "✓";
    td.classList.add("cell-check");
    return;
  }

  if (header === "Social Medias") {
    for (const url of splitList(value)) {
      const match = SOCIAL_ICONS.find((social) => social.test.test(url));
      td.append(makeLogoLink(url, match ? match.icon : "🔗", match ? match.label : url, match?.brand));
    }
    return;
  }

  if (header === "Emails") {
    for (const email of splitList(value)) {
      td.append(makeLogoLink(`mailto:${email}`, "📧", email));
    }
    return;
  }

  if (header === "Website") {
    td.append(makeLogoLink(ensureHttp(value), "🌐", value));
    return;
  }

  if (header === "Google Maps URL") {
    td.append(makeLogoLink(value, "📍", "Open in Google Maps"));
    return;
  }

  td.textContent = COLUMN_SYMBOLS.get(header) || "";
}

function splitList(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function ensureHttp(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function makeLogoLink(href, icon, label, brand) {
  const link = document.createElement("a");
  link.href = href;
  if (!href.startsWith("mailto:")) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  link.className = brand ? `logo-btn brand-${brand}` : "logo-btn";
  link.textContent = icon;
  link.title = label;
  return link;
}

function setStatus(text, level = "idle") {
  els.status.dataset.text = text;
  statusLevel = level;
}

function currentStatusText() {
  const base = els.status.dataset.text || "";
  const e = enrichmentQueue.snapshot();
  // While enrichment is still working in the background, make IT the headline —
  // this is the step that fills email, social links, and the phones Google hid.
  // The user must wait for it before exporting or those columns look "missing".
  if (e.enabled && (e.active > 0 || e.queued > 0)) {
    const total = e.completed + e.active + e.queued;
    return `🔎 Getting email / phone / social from websites — ${e.completed}/${total} done. Please wait before exporting...`;
  }
  if (e.enabled && e.completed > 0 && !running) {
    return `${base}  ✓ Enriched ${e.completed} sites (email/social/phone added).`;
  }
  if (!e.enabled && !running && rowsByKey.size > 0) {
    return `${base}  ⚠ Enrich is OFF — turn it on to get email, social links & missing phones.`;
  }
  return base;
}

function detailsText() {
  const parts = [];
  if (lastLayoutName) {
    parts.push(`Layout: ${lastLayoutName}`);
  }
  const enrichment = enrichmentQueue.snapshot();
  if (enrichment.enabled) {
    if (enrichment.queued === 0 && enrichment.active === 0 && enrichment.completed > 0) {
      parts.push(`Enrichment: done — ${enrichment.completed} sites checked`);
    } else if (enrichment.queued > 0 || enrichment.active > 0) {
      parts.push(`Enrichment: ${enrichment.queued} pending, ${enrichment.active} active`);
    } else {
      parts.push("Enrichment: on");
    }
  } else {
    parts.push("Enrichment: off");
  }
  if (running) {
    parts.push("Export can be used during the run.");
  }
  return parts.join(" | ");
}

function describeAdvanceAction(action) {
  if (action === "search-this-area") return "Search this area";
  if (action === "next-page") return "Next page";
  if (action === "load-more") return "More results";
  return action || "page control";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Tell the content script how tall the panel content is, so the iframe
// shrinks/grows to fit and never shows a wasted empty block. Coalesced into
// one frame so rapid calls during a run can't flood the content script.
let heightReportPending = false;
function reportPanelHeight() {
  if (heightReportPending) return;
  heightReportPending = true;
  requestAnimationFrame(() => {
    heightReportPending = false;
    const height = Math.ceil(document.documentElement.scrollHeight);
    const collapsed = document.body.classList.contains("collapsed");
    window.parent.postMessage({ type: "MLE_RESIZE", height, collapsed }, "*");
  });
}

function readableError(error) {
  if (!error) return "Unknown error.";
  if (typeof error === "string") return error;
  return error.message || String(error);
}
