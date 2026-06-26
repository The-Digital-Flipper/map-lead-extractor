const CONTACT_PATHS = ["/", "/contact", "/about"];
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
// Prefer tel: links (most reliable), then a visible phone-shaped number.
const TEL_LINK_PATTERN = /tel:\+?([0-9()\-.\s]{7,}[0-9])/i;
const PHONE_TEXT_PATTERN = /(\+?\d[\d()\-.\s]{8,}\d)/;

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
    if (!origin) return;

    const emails = new Set();
    const socials = {};
    for (const field of Object.keys(SOCIAL_PATTERNS)) socials[field] = "";
    let phone = "";

    for (const path of CONTACT_PATHS) {
      const html = await fetchText(`${origin}${path}`, this.timeoutMs);
      if (!html) continue;
      for (const email of html.match(EMAIL_PATTERN) || []) emails.add(email);
      for (const [field, pattern] of Object.entries(SOCIAL_PATTERNS)) {
        const match = html.match(pattern)?.[0];
        if (match && !socials[field]) socials[field] = cleanUrl(match);
      }
      if (!phone) {
        const tel = html.match(TEL_LINK_PATTERN) || html.match(PHONE_TEXT_PATTERN);
        if (tel) {
          const candidate = tel[1].replace(/\s+/g, " ").trim();
          if (candidate.replace(/\D/g, "").length >= 7) phone = candidate;
        }
      }
    }

    const foundEmails = Array.from(emails);
    if (foundEmails.length) {
      row.Emails = mergeList(row.Emails, foundEmails);
    }

    const foundSocials = Object.values(socials).filter(Boolean);
    if (foundSocials.length) {
      row["Social Medias"] = mergeList(row["Social Medias"], foundSocials);
    }

    // Only fill phone if the listing didn't already have one (never overwrite).
    if (phone && !row.Phone) {
      row.Phone = phone;
    }
  }
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

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store"
    });
    if (!response.ok) return "";
    // Only parse HTML/text, and cap the size so a huge page can't spike memory.
    const type = response.headers.get("content-type") || "";
    if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) return "";
    const text = await response.text();
    return text.length > MAX_HTML_CHARS ? text.slice(0, MAX_HTML_CHARS) : text;
  } catch {
    return "";
  } finally {
    window.clearTimeout(timer);
  }
}

function cleanUrl(value) {
  return value.replace(/[)"'<>\]]+$/g, "");
}
