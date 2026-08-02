// First-party pageview beacon — fires on every route change (see App.tsx).
// Anonymous: a random UUID in localStorage identifies the browser, a second one
// in sessionStorage groups a visit into a session. No cookies, no PII.

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function storedId(store: Storage, key: string): string {
  try {
    let v = store.getItem(key);
    if (!v) {
      v = crypto.randomUUID();
      store.setItem(key, v);
    }
    return v;
  } catch {
    return "anon";
  }
}

// Owner/authenticated app surfaces — usage here is the operator running the
// business, not marketing-site traffic, so it never counts as a pageview.
const UNTRACKED = ["/admin", "/admin-login", "/dashboard", "/command-center"];

let lastPath: string | null = null;

export function trackPageview(path: string): void {
  // Don't count the owner's own app/admin usage as site traffic.
  if (UNTRACKED.some((p) => path === p || path.startsWith(p + "/"))) return;
  // wouter re-renders can repeat the same location — one row per real change.
  if (path === lastPath) return;
  lastPath = path;

  try {
    const params = new URLSearchParams(window.location.search);
    // Source attribution beyond utm_source: a bare ?src= tag, and the click
    // ids Facebook/Google append to ad/share links (present even when the
    // app strips the referrer — common on mobile).
    const source =
      params.get("utm_source") ||
      params.get("src") ||
      params.get("ref") ||
      (params.get("fbclid") ? "facebook" : null) ||
      (params.get("gclid") ? "google-ads" : null) ||
      (params.get("ttclid") ? "tiktok" : null);
    const payload = JSON.stringify({
      path,
      referrer: document.referrer || null,
      visitorId: storedId(localStorage, "mle_visitor_id"),
      sessionId: storedId(sessionStorage, "mle_session_id"),
      utmSource: source,
      utmMedium: params.get("utm_medium"),
      utmCampaign: params.get("utm_campaign"),
      screenWidth: window.screen?.width ?? null,
    });

    const url = `${basePath}/api/track`;
    const blob = new Blob([payload], { type: "application/json" });
    if (!navigator.sendBeacon?.(url, blob)) {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* analytics must never break the site */
  }
}
