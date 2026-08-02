// Only one headless Chromium scrape at a time, process-wide — shared across
// the admin dashboard, the scrape-targets runner, and the public Scraper page
// so none of them can launch a second browser on top of another's run.
let inFlight = false;

export function scrapeInFlight(): boolean {
  return inFlight;
}

export function acquireScrapeLock(): boolean {
  if (inFlight) return false;
  inFlight = true;
  return true;
}

export function releaseScrapeLock(): void {
  inFlight = false;
}
