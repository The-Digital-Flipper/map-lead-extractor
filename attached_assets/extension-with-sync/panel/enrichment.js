const CONTACT_PATHS = ["/", "/contact", "/contact-us", "/about"];
const MAX_HTML_CHARS = 400000;
const SOCIAL_PATTERNS = {
  Facebook: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._\-/%?=&]+/gi,
  Instagram: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._\-/%?=&]+/gi,
  Twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[A-Za-z0-9._\-/%?=&]+/gi,
  LinkedIn: /https?:\/\/(?:www\.)?linkedin\.com\/[A-Za-z0-9._\-/%?=&]+/gi,
  YouTube: /https?:\/\/(?:www\.)?youtube\.com\/[A-Za-z0-9._\-/@%?=&]+/gi,
  TikTok: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._\-]+/gi
};
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Phone extraction: prefer tel: links, then phone-shaped text. Both are validated
// as real US/NANP numbers (area + exchange must start 2-9) so we never grab JS
// numbers, dates, or coordinates.
const TEL_LINK_PATTERN = /tel:\+?([0-9().\-\s]{7,}\d)/gi;
const PHONE_TEXT_PATTERN = /(?:\+?1[\s.\-]?)?\(?([2-9]\d{2})\)?[\s.\-]?([2-9]\d{2})[\s.\-]?(\d{4})(?!\d)/g;

export class EnrichmentQueue {
  constructor({ concurrency = 2, timeoutMs = 6000, onUpdate = () => {} } = {}) {
    this.concurrency = concurrency;
    this.timeoutMs = timeoutMs;
    this.onUpdate = onUpdate;
    this.queue = [];
    this.active = 0;
    this.completed = 0;
    this.enabled = false;
    this.seen = new Set();
    this.debugLog = []; // per-site enrichment results, for the debug dump
  }

  // Summary the debug dump can read to explain blank email/social/phone columns.
  debugSnapshot() {
    const log = this.debugLog;
    return {
      enabled: this.enabled,
      sitesAttempted: log.length,
      sitesReachable: log.filter((r) => r.reachable).length,
      sitesBlockedOrTimedOut: log.filter((r) => !r.reachable).length,
      sitesWithEmail: log.filter((r) => r.emails).length,
      sitesWithSocial: log.filter((r) => r.socials).length,
      sitesWithPhone: log.filter((r) => r.phone).length,
      perSite: log.slice(0, 80)
    };
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.onUpdate(this.snapshot());
    if (this.enabled) this.drain();
  }

  enqueue(row) {
    const key = row.__key || row.ID || row.Website;
    if (!this.enabled || !row.Website || this.seen.has(key)) return;
    this.seen.add(key);
    this.queue.push(row);
    this.drain();
    this.onUpdate(this.snapshot());
  }

  snapshot() {
    return {
      enabled: this.enabled,
      queued: this.queue.length,
      active: this.active,
      completed: this.completed
    };
  }

  reset() {
    this.queue = [];
    this.active = 0;
    this.completed = 0;
    this.seen = new Set();
    this.debugLog = [];
    this.onUpdate(this.snapshot());
  }

  drain() {
    while (this.enabled && this.active < this.concurrency && this.queue.length > 0) {
      const row = this.queue.shift();
      this.active += 1;
      this.enrich(row).catch(() => {}).finally(() => {
        this.active -= 1;
        this.completed += 1;
        this.onUpdate(this.snapshot());
        this.drain();
      });
    }
  }

  async enrich(row) {
    const origin = normalizeOrigin(row.Website);
    const rec = {
      name: row.Name || "",
      website: row.Website || "",
      origin,
      reachable: false,
      pages: [],        // { path, status, len, error }
      emails: "",
      socials: "",
      phone: "",
      hadPhoneFromGoogle: !!row.Phone
    };
    if (!origin) { rec.error = "bad website url"; this.debugLog.push(rec); return; }

    const emails = new Set();
    const socials = {};
    for (const field of Object.keys(SOCIAL_PATTERNS)) socials[field] = "";
    let phone = "";

    for (const path of CONTACT_PATHS) {
      const r = await fetchDetailed(`${origin}${path}`, this.timeoutMs);
      rec.pages.push({ path, status: r.status, len: r.text.length, error: r.error });
      const html = r.text;
      if (!html) continue;
      rec.reachable = true;
      for (const email of html.match(EMAIL_PATTERN) || []) {
        if (isRealEmail(email)) emails.add(email.toLowerCase());
      }
      for (const [field, pattern] of Object.entries(SOCIAL_PATTERNS)) {
        if (socials[field]) continue;
        for (const m of html.match(pattern) || []) {
          const url = cleanUrl(m);
          if (isRealSocial(url)) { socials[field] = url; break; }
        }
      }
      if (!phone) phone = extractPhone(html);
    }

    const foundEmails = Array.from(emails);
    if (foundEmails.length) {
      row.Emails = mergeList(row.Emails, foundEmails);
      rec.emails = foundEmails.join(", ");
    }

    const foundSocials = Object.values(socials).filter(Boolean);
    if (foundSocials.length) {
      row["Social Medias"] = mergeList(row["Social Medias"], foundSocials);
      rec.socials = foundSocials.join(", ");
    }

    // Only fill phone if the listing didn't already have one (never overwrite).
    if (phone && !row.Phone) {
      row.Phone = phone;
      rec.phone = phone;
    }

    this.debugLog.push(rec);
    if (this.debugLog.length > 300) this.debugLog.shift();
  }
}

// Pull a real US phone from page HTML. tel: links first (most reliable), then
// phone-shaped visible text. Every candidate is NANP-validated so we never grab
// a JS number, date, price, or map coordinate.
function extractPhone(html) {
  const valid = (digits) => {
    const d = digits.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? d : "";
  };
  const fmt = (d) => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  for (const m of html.matchAll(TEL_LINK_PATTERN)) {
    const d = valid(m[1]);
    if (d) return fmt(d);
  }
  for (const m of html.matchAll(PHONE_TEXT_PATTERN)) {
    const d = valid(m[1] + m[2] + m[3]);
    if (d) return fmt(d);
  }
  return "";
}

// Keep only real business emails — drop tracking hashes, theme-developer
// placeholders, image filenames, and analytics noise.
function isRealEmail(email) {
  const e = String(email).toLowerCase();
  const [local, domain] = e.split("@");
  if (!local || !domain) return false;
  // image / asset filenames caught as emails (logo@2x.png, icon@3x.jpg)
  if (/\.(png|jpe?g|gif|svg|webp|css|js|woff2?|ico)$/i.test(domain)) return false;
  // long hex hashes (tracking ids), e.g. ef5d9bbac3354b759bfd7a23c331...
  if (/^[0-9a-f]{16,}$/i.test(local)) return false;
  // common placeholder / vendor / noise addresses
  if (/^(filler|your|name|email|user|example|test|sample|info?@example|no-?reply|donotreply)$/i.test(local)) return false;
  if (/(example\.|sentry\.|wixpress\.|\.png$|godaddy|eyebytes|squarespace\.com$|wix\.com$|sentry\.io$|domain\.com$|yourdomain|mystore\.com$|myshopify\.com$|email\.com$|company\.com$|website\.com$|business\.com$)/i.test(domain)) return false;
  if (/^(hi|hello|contact|info)$/i.test(local) && /^(mystore|example|yourstore|store)\./i.test(domain)) return false;
  if (/@(2x|3x)\./i.test(e)) return false;
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e);
}

// Keep only real social PROFILE links — drop tracking pixels, share/login
// dialogs, plugin embeds, and ordering-platform accounts.
function isRealSocial(url) {
  const u = String(url).toLowerCase();
  if (/facebook\.com\/tr[/?]/.test(u)) return false;          // FB tracking pixel
  if (/\/20\d\d\/fbml|\/fbml|xmlns|schema\.org|\/v\d+\.\d+|\/plugins\//.test(u)) return false; // FB namespace / schema tags, not profiles
  if (/(twitter|x)\.com\/(intent|share|home|hashtag|search)/.test(u)) return false;
  if (/\/(sharer|share|dialog|plugins|login|signup|tr|intent|home|help|policy|privacy|policies|terms)\b/.test(u)) return false;
  if (/\/(toasttab|squarespace|wixsite|godaddy|shopify|opentable|doordable|ubereats|grubhub|yelp)\b/.test(u)) return false;
  // must have an actual handle/path beyond the bare domain
  if (/^https?:\/\/(?:www\.)?(facebook|instagram|twitter|x|linkedin|youtube|tiktok)\.com\/?$/.test(u)) return false;
  return true;
}

function mergeList(existing, additions) {
  const current = existing ? existing.split(",").map((item) => item.trim()).filter(Boolean) : [];
  return Array.from(new Set([...current, ...additions])).join(", ");
}

function normalizeOrigin(value) {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

// Returns { text, status, error }. Tries the BACKGROUND worker first (bypasses
// page CORS / many bot blocks), then falls back to a direct fetch.
async function fetchDetailed(url, timeoutMs) {
  try {
    const bg = await chrome.runtime.sendMessage({ command: "FETCH_SITE", url, timeoutMs });
    if (bg && bg.ok && bg.text) return { text: bg.text, status: bg.status, error: "" };
    // If the background reached the site but it wasn't usable, trust that result.
    if (bg && (bg.status || bg.error) && bg.error !== "fetch failed") {
      // Still try a direct fetch as a second chance for "Failed to fetch".
      const direct = await directFetch(url, timeoutMs);
      if (direct.text) return direct;
      return { text: "", status: bg.status || direct.status, error: bg.error || direct.error };
    }
  } catch { /* background unavailable — fall through to direct */ }
  return directFetch(url, timeoutMs);
}

async function directFetch(url, timeoutMs) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store"
    });
    if (!response.ok) return { text: "", status: response.status, error: `http ${response.status}` };
    const type = response.headers.get("content-type") || "";
    if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) {
      return { text: "", status: response.status, error: `non-html (${type.split(";")[0]})` };
    }
    const text = await response.text();
    return { text: text.length > MAX_HTML_CHARS ? text.slice(0, MAX_HTML_CHARS) : text, status: response.status, error: "" };
  } catch (e) {
    const msg = (e && e.name === "AbortError") ? "timeout" : ((e && e.message) || "fetch failed");
    return { text: "", status: 0, error: msg };
  } finally {
    window.clearTimeout(timer);
  }
}

function cleanUrl(value) {
  return value.replace(/[)"'<>\]]+$/g, "");
}
