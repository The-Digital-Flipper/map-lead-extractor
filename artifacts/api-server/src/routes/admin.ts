import express, { Router, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import {
  saveLandingImage, deleteLandingImage, listLandingImageSlugs, validSlug, allowedImageMime, MAX_IMAGE_BYTES,
} from "../lib/landingImages.js";
import { generateLandingCreative } from "../lib/landingCreative.js";
import { db, leads, users, logs, scrapeTargets, proxies, socialPosts, packOrders, testimonials, chatConversations, chatMessages, sampleRequests, computeOpportunity, computeValue, type ScrapePlatform } from "@workspace/db";
import { sql, count, gte, gt, eq, and, desc, asc, isNull, isNotNull, inArray, getTableColumns } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import { packWhere } from "../lib/packs";
import { sendOrder } from "../lib/packWorker";
import { scanAndSaveLead, socialScanSummary } from "../lib/socialScan";
import { scrapeAndSave } from "../lib/scrape";
import { researchTargets } from "../lib/research";
import { analyzeLeads } from "../lib/analyze";
import { discoverBusinesses } from "../lib/discover";
import { startRun, runScrapeJob, listRuns, getRun, deleteRun, runToCsv } from "../lib/scrapeRuns";
import { scrapeInFlight, acquireScrapeLock, releaseScrapeLock } from "../lib/scrapeLock";
import { reconSellAngle, composeBrief, type ReconBrief } from "../lib/recon";
import { parseProxyLines, testProxy } from "../lib/proxyPool";
import {
  getSocialSettings, updateSocialSettings, generateSocialPosts, generateFreeToolPosts, publishPost,
  facebookCreds, fbAppConfigured, fbConnectUrl, fbHandleCallback, fbSelectPage, fbDisconnect, FB_REDIRECT_URI,
  fbPickerToken, fbPickerTokenValid,
  generateGroupPosts, listGroups, addGroup, deleteGroup, markGroupPosted, discoverGroups,
  syncEngagementStats, generatePostImage, getPostImage, removePostImage,
  socialChat, type SocialChatMessage,
} from "../lib/social";
import { sendBuyerFollowup } from "../lib/buyer-followup";
import { autoScrapeTick, autoScrapeStatus, setAutoScrapeEnabled, seedAutoTargets, listAutoCandidates } from "../lib/autoScrape";
import { anyProviderConfigured, providerReady, getOutreachSettings } from "../lib/outreach-auto";

const router = Router();

// ── Admin secret guard ────────────────────────────────────────────────────────
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"] ?? req.query.secret;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// Lighter guard for the expensive endpoints (paid AI + headless browser): allow
// the admin secret OR a signed-in Clerk session. The admin dashboard is behind
// Clerk login and its same-origin fetches carry the session, so this blocks
// anonymous internet abuse without breaking the UI or exposing the secret.
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"] ?? req.query.secret;
  if (ADMIN_SECRET && secret === ADMIN_SECRET) { next(); return; }
  if (getAuth(req).userId) { next(); return; }
  res.status(401).json({ error: "Sign in as admin to use this." });
}

// ---- GET /logs — latest 100 extension telemetry rows -----------------------
router.get("/logs", requireAdmin, async (_req, res) => {
  const rows = await db.select().from(logs).orderBy(desc(logs.id)).limit(100);
  res.json({ count: rows.length, logs: rows });
});

// ---- GET /traffic — site-wide visitor analytics -----------------------------
// Aggregates the site_visits beacon rows into everything the Traffic tab shows:
// headline numbers, a daily series, top pages/referrers, device + source splits.
router.get("/traffic", requireAuth, async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(String(req.query.days ?? "30"), 10) || 30));
  const windowSql = sql`created_at >= NOW() - make_interval(days => ${days})`;

  const [
    summaryRows, liveRows, dailyRows, pageRows, refRows, deviceRows, sourceRows,
    newRetRows, entryRows, exitRows, heatRows, countryRows, engageRows,
  ] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS views_today,
        COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS visitors_today,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS views_week,
        COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS visitors_week,
        COUNT(*)::int AS views_total,
        COUNT(DISTINCT visitor_id)::int AS visitors_total,
        COUNT(DISTINCT session_id)::int AS sessions_total
      FROM site_visits WHERE ${windowSql}
    `),
    db.execute(sql`
      SELECT COUNT(DISTINCT visitor_id)::int AS live
      FROM site_visits WHERE created_at >= NOW() - INTERVAL '5 minutes'
    `),
    db.execute(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS views,
             COUNT(DISTINCT visitor_id)::int AS visitors
      FROM site_visits WHERE ${windowSql}
      GROUP BY 1 ORDER BY 1
    `),
    db.execute(sql`
      SELECT path, COUNT(*)::int AS views, COUNT(DISTINCT visitor_id)::int AS visitors
      FROM site_visits WHERE ${windowSql}
      GROUP BY path ORDER BY views DESC LIMIT 15
    `),
    db.execute(sql`
      SELECT regexp_replace(referrer, '^https?://(www\\.)?([^/]+).*$', '\\2') AS ref,
             COUNT(*)::int AS views
      FROM site_visits
      WHERE ${windowSql} AND referrer IS NOT NULL
        AND referrer NOT LIKE '%mapleadextractor.net%'
      GROUP BY 1 ORDER BY views DESC LIMIT 10
    `),
    db.execute(sql`
      SELECT device, COUNT(DISTINCT visitor_id)::int AS visitors
      FROM site_visits WHERE ${windowSql}
      GROUP BY device ORDER BY visitors DESC
    `),
    db.execute(sql`
      SELECT utm_source AS source, COUNT(DISTINCT visitor_id)::int AS visitors
      FROM site_visits WHERE ${windowSql} AND utm_source IS NOT NULL
      GROUP BY 1 ORDER BY visitors DESC LIMIT 10
    `),
    // New vs returning: a visitor is "returning" if their first-ever pageview
    // predates the window; "new" if they first appeared inside it.
    db.execute(sql`
      WITH active AS (
        SELECT DISTINCT visitor_id FROM site_visits WHERE ${windowSql}
      ), firsts AS (
        SELECT visitor_id, MIN(created_at) AS first_seen FROM site_visits GROUP BY visitor_id
      )
      SELECT
        COUNT(*) FILTER (WHERE f.first_seen >= NOW() - make_interval(days => ${days}))::int AS new_visitors,
        COUNT(*) FILTER (WHERE f.first_seen <  NOW() - make_interval(days => ${days}))::int AS returning_visitors
      FROM active a JOIN firsts f USING (visitor_id)
    `),
    // Entry pages: the first page of each session.
    db.execute(sql`
      SELECT path, COUNT(*)::int AS sessions FROM (
        SELECT DISTINCT ON (session_id) session_id, path
        FROM site_visits WHERE ${windowSql} AND session_id IS NOT NULL
        ORDER BY session_id, created_at ASC
      ) t GROUP BY path ORDER BY sessions DESC LIMIT 10
    `),
    // Exit pages: the last page of each session.
    db.execute(sql`
      SELECT path, COUNT(*)::int AS sessions FROM (
        SELECT DISTINCT ON (session_id) session_id, path
        FROM site_visits WHERE ${windowSql} AND session_id IS NOT NULL
        ORDER BY session_id, created_at DESC
      ) t GROUP BY path ORDER BY sessions DESC LIMIT 10
    `),
    // Hour-of-day × day-of-week heatmap, bucketed in the owner's local time
    // (Central) so peaks line up with when their audience is actually awake.
    db.execute(sql`
      SELECT
        EXTRACT(DOW  FROM created_at AT TIME ZONE 'America/Chicago')::int AS dow,
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Chicago')::int AS hour,
        COUNT(*)::int AS views
      FROM site_visits WHERE ${windowSql}
      GROUP BY 1, 2
    `),
    // Country breakdown (populated once a CDN/proxy sets the geo header).
    db.execute(sql`
      SELECT COALESCE(NULLIF(country, ''), '—') AS country,
             COUNT(DISTINCT visitor_id)::int AS visitors
      FROM site_visits WHERE ${windowSql}
      GROUP BY 1 ORDER BY visitors DESC LIMIT 12
    `),
    // Engagement: bounce rate + avg pages/session over sessions in the window.
    db.execute(sql`
      WITH s AS (
        SELECT session_id, COUNT(*) AS views
        FROM site_visits WHERE ${windowSql} AND session_id IS NOT NULL
        GROUP BY session_id
      )
      SELECT
        COUNT(*)::int AS sessions,
        COUNT(*) FILTER (WHERE views = 1)::int AS bounced,
        COALESCE(SUM(views), 0)::int AS total_views
      FROM s
    `),
  ]);

  type SumRow = {
    views_today: number; visitors_today: number; views_week: number; visitors_week: number;
    views_total: number; visitors_total: number; sessions_total: number;
  };
  const s = (summaryRows.rows[0] ?? {}) as SumRow;

  res.json({
    days,
    summary: {
      viewsToday: Number(s.views_today ?? 0),
      visitorsToday: Number(s.visitors_today ?? 0),
      viewsWeek: Number(s.views_week ?? 0),
      visitorsWeek: Number(s.visitors_week ?? 0),
      views: Number(s.views_total ?? 0),
      visitors: Number(s.visitors_total ?? 0),
      sessions: Number(s.sessions_total ?? 0),
      live: Number((liveRows.rows[0] as { live: number } | undefined)?.live ?? 0),
    },
    daily: (dailyRows.rows as { day: string; views: number; visitors: number }[])
      .map(r => ({ day: r.day, views: Number(r.views), visitors: Number(r.visitors) })),
    topPages: (pageRows.rows as { path: string; views: number; visitors: number }[])
      .map(r => ({ path: r.path, views: Number(r.views), visitors: Number(r.visitors) })),
    referrers: (refRows.rows as { ref: string; views: number }[])
      .filter(r => r.ref)
      .map(r => ({ referrer: r.ref, views: Number(r.views) })),
    devices: (deviceRows.rows as { device: string | null; visitors: number }[])
      .map(r => ({ device: r.device ?? "unknown", visitors: Number(r.visitors) })),
    sources: (sourceRows.rows as { source: string; visitors: number }[])
      .map(r => ({ source: r.source, visitors: Number(r.visitors) })),
    newVsReturning: (() => {
      const r = (newRetRows.rows[0] ?? {}) as { new_visitors?: number; returning_visitors?: number };
      return { new: Number(r.new_visitors ?? 0), returning: Number(r.returning_visitors ?? 0) };
    })(),
    entryPages: (entryRows.rows as { path: string; sessions: number }[])
      .map(r => ({ path: r.path, sessions: Number(r.sessions) })),
    exitPages: (exitRows.rows as { path: string; sessions: number }[])
      .map(r => ({ path: r.path, sessions: Number(r.sessions) })),
    heatmap: (heatRows.rows as { dow: number; hour: number; views: number }[])
      .map(r => ({ dow: Number(r.dow), hour: Number(r.hour), views: Number(r.views) })),
    countries: (countryRows.rows as { country: string; visitors: number }[])
      .map(r => ({ country: r.country, visitors: Number(r.visitors) })),
    engagement: (() => {
      const r = (engageRows.rows[0] ?? {}) as { sessions?: number; bounced?: number; total_views?: number };
      const sessions = Number(r.sessions ?? 0);
      const bounced = Number(r.bounced ?? 0);
      const totalViews = Number(r.total_views ?? 0);
      return {
        sessions,
        bounceRate: sessions ? bounced / sessions : 0,
        pagesPerSession: sessions ? totalViews / sessions : 0,
      };
    })(),
  });
});

// ---- GET /stats — headline numbers ------------------------------------------
router.get("/stats", async (_req, res) => {
  const [totalRow, todayRow, weekRow] = await Promise.all([
    db.select({ total: count() }).from(leads),
    db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM leads
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `),
    db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM leads
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `),
  ]);

  res.json({
    total: Number(totalRow[0].total),
    today: Number((todayRow.rows[0] as { cnt: number }).cnt),
    week: Number((weekRow.rows[0] as { cnt: number }).cnt),
  });
});

// ---- GET /revenue — Stripe MRR + subscriber data ----------------------------
router.get("/revenue", async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();

    const [activeSubs, userCountRow] = await Promise.all([
      stripe.subscriptions.list({ status: "active", limit: 100, expand: ["data.items.data.price"] }),
      db.select({ cnt: count() }).from(users),
    ]);

    let mrr = 0;
    for (const sub of activeSubs.data) {
      for (const item of sub.items.data) {
        const price = item.price as { unit_amount: number | null; recurring: { interval: string } | null };
        if (price.unit_amount && price.recurring) {
          const monthly = price.recurring.interval === "year"
            ? price.unit_amount / 12
            : price.unit_amount;
          mrr += monthly * (item.quantity ?? 1);
        }
      }
    }

    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const recentCharges = await stripe.charges.list({ limit: 100, created: { gte: thirtyDaysAgo } });
    const monthRevenue = recentCharges.data
      .filter(c => c.paid && c.amount_captured > 0)
      .reduce((sum, c) => sum + c.amount_captured, 0);

    res.json({
      mrr: Math.round(mrr) / 100,
      subscriberCount: activeSubs.data.length,
      monthRevenue: Math.round(monthRevenue) / 100,
      totalUsers: Number(userCountRow[0].cnt),
      hasMoreSubs: activeSubs.has_more,
    });
  } catch {
    res.json({ mrr: 0, subscriberCount: 0, monthRevenue: 0, totalUsers: 0, hasMoreSubs: false });
  }
});

// ---- GET /users — all registered users with plan + lead count ----------------
router.get("/users", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, parseInt(String(req.query.limit ?? "50"), 10) || 50);
  const offset = (page - 1) * limit;

  try {
    const [rows, totalRow] = await Promise.all([
      db.execute(sql`
        SELECT
          u.id,
          u.email,
          u.stripe_customer_id,
          u.created_at,
          COALESCE(s.sub_status, 'free') AS plan,
          s.period_end,
          s.cancel_at,
          COALESCE(lc.lead_count, 0)::int AS lead_count,
          COALESCE(lc.money_lead_count, 0)::int AS money_lead_count,
          COALESCE(lc.hot_lead_count, 0)::int AS hot_lead_count,
          lc.last_active
        FROM users u
        LEFT JOIN (
          SELECT customer, status AS sub_status,
                 current_period_end AS period_end,
                 cancel_at
          FROM stripe.subscriptions
          WHERE status = 'active'
        ) s ON s.customer = u.stripe_customer_id
        LEFT JOIN LATERAL (
          -- Count every lead this member extracted (including businesses also
          -- pulled by others) via the extracted_by demand list — true activity.
          SELECT
            COUNT(*)::int AS lead_count,
            COUNT(*) FILTER (WHERE opportunity_score >= 40)::int AS money_lead_count,
            COUNT(*) FILTER (WHERE opportunity_score >= 70)::int AS hot_lead_count,
            MAX(updated_at) AS last_active
          FROM leads
          WHERE jsonb_exists(COALESCE(extracted_by, '[]'::jsonb), u.id)
        ) lc ON TRUE
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `),
      db.select({ cnt: count() }).from(users),
    ]);

    const total = Number(totalRow[0].cnt);
    res.json({ users: rows.rows, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch {
    res.json({ users: [], total: 0, page: 1, pages: 1 });
  }
});

// ---- GET /geo — state-level lead counts parsed from addresses ---------------
// ?minOpportunity=N restricts to "money" leads so the heatmap can show where
// the sellable opportunity is concentrated (sell by territory).
router.get("/geo", async (req, res) => {
  const minOpportunity = parseInt(String(req.query.minOpportunity ?? "0"), 10) || 0;
  const oppFilter = minOpportunity > 0 ? sql` AND opportunity_score >= ${minOpportunity}` : sql``;

  const rows = await db.execute(sql`
    SELECT
      UPPER(
        (regexp_matches(address, '[A-Z]{2}\\s+\\d{5}', 'g'))[1]
      ) AS raw_match,
      COUNT(*)::int AS cnt
    FROM leads
    WHERE address IS NOT NULL
      AND address ~ '[A-Z]{2}\\s+\\d{5}'${oppFilter}
    GROUP BY raw_match
    ORDER BY cnt DESC
  `);

  type RawRow = { raw_match: string; cnt: number };

  const byState: Record<string, number> = {};
  for (const row of rows.rows as RawRow[]) {
    if (!row.raw_match) continue;
    const state = row.raw_match.slice(0, 2).toUpperCase();
    if (/^[A-Z]{2}$/.test(state)) {
      byState[state] = (byState[state] ?? 0) + Number(row.cnt);
    }
  }

  const cityRows = await db.execute(sql`
    SELECT
      TRIM(
        (string_to_array(address, ','))[array_length(string_to_array(address, ','), 1) - 1]
      ) AS city,
      COUNT(*)::int AS cnt
    FROM leads
    WHERE address IS NOT NULL AND address LIKE '%,%'${oppFilter}
    GROUP BY city
    ORDER BY cnt DESC
    LIMIT 20
  `);

  type CityRow = { city: string; cnt: number };

  const topCities = (cityRows.rows as CityRow[])
    .filter(r => r.city && r.city.length > 1)
    .map(r => ({ city: r.city.trim(), count: Number(r.cnt) }));

  res.json({ byState, topCities });
});

// ---- GET /opportunity-by-category — money intelligence per vertical ---------
// Powers the entire Command Center: leaderboard (which categories hold the most
// high-opportunity "money" leads), a summary (hot/warm/cold/no-website/reachable),
// and the needs breakdown — all optionally scoped to one state via ?state=XX
// so clicking a state on the heatmap re-filters everything.
router.get("/opportunity-by-category", async (req, res) => {
  const state = String(req.query.state ?? "").trim().toUpperCase();
  // Territory filter: match "<STATE> <ZIP>" inside the address (word-boundary).
  const stateFilter = /^[A-Z]{2}$/.test(state)
    ? sql` AND address ~ ${"\\y" + state + "\\s+\\d{5}"}`
    : sql``;

  const [catRows, summaryRows, needsRows] = await Promise.all([
    db.execute(sql`
      SELECT
        category,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE opportunity_score >= 70)::int AS hot,
        COUNT(*) FILTER (WHERE opportunity_score >= 40 AND opportunity_score < 70)::int AS warm,
        COALESCE(ROUND(AVG(opportunity_score)), 0)::int AS avg_opportunity,
        COUNT(*) FILTER (WHERE website IS NULL OR website = '')::int AS no_website,
        COUNT(*) FILTER (WHERE phone IS NOT NULL OR emails IS NOT NULL)::int AS reachable
      FROM leads
      WHERE category IS NOT NULL AND category <> ''${stateFilter}
      GROUP BY category
      ORDER BY hot DESC, total DESC
      LIMIT 30
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE opportunity_score >= 70)::int AS hot,
        COUNT(*) FILTER (WHERE opportunity_score >= 40 AND opportunity_score < 70)::int AS warm,
        COUNT(*) FILTER (WHERE opportunity_score < 40)::int AS cold,
        COUNT(*) FILTER (WHERE website IS NULL OR website = '')::int AS no_website,
        COUNT(*) FILTER (WHERE phone IS NOT NULL OR emails IS NOT NULL)::int AS reachable
      FROM leads
      WHERE TRUE${stateFilter}
    `),
    db.execute(sql`
      SELECT need AS need, COUNT(*)::int AS cnt
      FROM leads, jsonb_array_elements_text(COALESCE(needs, '[]'::jsonb)) AS need
      WHERE TRUE${stateFilter}
      GROUP BY need
      ORDER BY cnt DESC
    `),
  ]);

  type CatRow = {
    category: string; total: number; hot: number; warm: number;
    avg_opportunity: number; no_website: number; reachable: number;
  };
  type SumRow = {
    total: number; hot: number; warm: number; cold: number;
    no_website: number; reachable: number;
  };
  const s = (summaryRows.rows[0] ?? {}) as SumRow;

  res.json({
    state: /^[A-Z]{2}$/.test(state) ? state : null,
    categories: (catRows.rows as CatRow[]).map(r => ({
      category: r.category,
      total: Number(r.total),
      hot: Number(r.hot),
      warm: Number(r.warm),
      avgOpportunity: Number(r.avg_opportunity),
      noWebsite: Number(r.no_website),
      reachable: Number(r.reachable),
    })),
    summary: {
      total: Number(s.total ?? 0),
      hot: Number(s.hot ?? 0),
      warm: Number(s.warm ?? 0),
      cold: Number(s.cold ?? 0),
      noWebsite: Number(s.no_website ?? 0),
      reachable: Number(s.reachable ?? 0),
    },
    needs: (needsRows.rows as { need: string; cnt: number }[]).map(r => ({ need: r.need, count: Number(r.cnt) })),
  });
});

// ---- POST /enrich — crawl lead websites to score bad/old site + booking -----
// Fetches each website and detects: liveness, mobile-friendliness, and online
// booking links. Refines opportunity with signals we couldn't get from Google
// Maps alone. NOTE: "no ads showing" still isn't detectable here (it needs a
// paid SERP API), so it is deliberately not scored.
const BOOKING_RE = /calendly\.com|opentable\.com|acuityscheduling|squareup\.com\/(appointments|book)|booksy|vagaro|resy\.com|setmore|schedulicity|mindbodyonline|getsquire|tidycal|book\s*(now|online|an appointment)|schedule\s*(now|online|an appointment)/i;

function formatPhone(digits: string): string {
  const d = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : digits;
}

// Pull US phone numbers from a page — prefer tel: links, else formatted numbers.
function extractPhones(html: string): string[] {
  const phones = new Set<string>();
  for (const m of html.matchAll(/tel:\+?([0-9().\-\s]{7,16})/gi)) {
    const d = m[1].replace(/\D/g, "");
    if (d.length === 10 || (d.length === 11 && d[0] === "1")) phones.add(formatPhone(d));
  }
  if (phones.size === 0) {
    // Require separators/parens so we don't grab 10-digit ids, zips, prices.
    for (const m of html.matchAll(/\(?\b\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/g)) {
      const d = m[0].replace(/\D/g, "");
      if (d.length === 10) phones.add(formatPhone(d));
    }
  }
  return [...phones].slice(0, 3);
}

// Pull public emails + social profile links out of a page's HTML.
function extractContacts(html: string): { emails: string[]; phones: string[]; facebook: string | null; instagram: string | null; twitter: string | null; linkedin: string | null } {
  const emails = new Set<string>();
  // mailto: links are the most reliable.
  for (const m of html.matchAll(/mailto:([^"'?>\s]+@[^"'?>\s]+)/gi)) {
    try { emails.add(decodeURIComponent(m[1]).toLowerCase()); } catch { emails.add(m[1].toLowerCase()); }
  }
  // Bare addresses in the text, minus obvious junk (asset files, placeholders).
  for (const m of html.matchAll(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g)) {
    const e = m[0].toLowerCase();
    if (/\.(png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|mp4)$/i.test(e)) continue;
    if (/(example\.|sentry|wixpress|\.wix|yourdomain|domain\.com|email@|placeholder|@2x|@3x|\.png|\.jpg)/i.test(e)) continue;
    emails.add(e);
  }
  const firstSocial = (re: RegExp): string | null => {
    for (const m of html.matchAll(re)) {
      const url = m[0].replace(/["'<>)\\]+$/, "");
      // Skip share/intent/SDK/plugin/namespace links — we want the real profile.
      if (/sharer|\/share|\/intent|[?&]u=|\/tr\b|\/plugins|\/dialog\/|\/sdk|developers\.|connect\.|graph\.|\/20\d\d\/|fbml|\/v\d|\/policies|\/help\b|\/embed|\/login/i.test(url)) continue;
      return url;
    }
    return null;
  };
  return {
    emails: [...emails].slice(0, 5),
    phones: extractPhones(html),
    facebook: firstSocial(/https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>)]+/gi),
    instagram: firstSocial(/https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>)]+/gi),
    twitter: firstSocial(/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>)]+/gi),
    linkedin: firstSocial(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>)]+/gi),
  };
}

async function fetchHtml(url: string): Promise<{ status: number; html: string } | null> {
  try {
    const resp = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MapLeadEnrich/1.0)" },
    });
    let html = "";
    try { html = (await resp.text()).slice(0, 400_000); } catch { /* body read failed */ }
    return { status: resp.status, html };
  } catch {
    return null;
  }
}

// Website-builder fingerprints. Ordered most- to least-specific; first hit wins.
// DIY builders (Wix/GoDaddy/Weebly/Duda) are the prime "sell them a real site"
// targets; WordPress/Shopify/Squarespace are more capable but still upsell-able.
const PLATFORM_RE: Array<[string, RegExp]> = [
  ["Wix", /static\.wixstatic\.com|wixsite\.com|X-Wix|_wixCssStates|Wix\.com Website Builder/i],
  ["GoDaddy", /img1\.wsimg\.com|GoDaddy Website Builder|godaddy|websitebuilder\.godaddy/i],
  ["Squarespace", /static1\.squarespace\.com|squarespace\.com|Squarespace\b|sqs-block/i],
  ["Weebly", /weebly\.com|editmysite\.com|Weebly\b/i],
  ["Duda", /dudaone|d3f31ykozc0j5j\.cloudfront|Duda Website Builder|dmalbum/i],
  ["Webflow", /\.webflow\.io|webflow\.com|data-wf-page|Webflow\b/i],
  ["Shopify", /cdn\.shopify\.com|myshopify\.com|Shopify\.theme|X-ShopId/i],
  ["Wordpress", /wp-content|wp-includes|WordPress\b/i],
];

// Google Ads / Meta Pixel remarketing tags — presence = they actively pay to
// advertise (a warmer, higher-budget lead). Plain analytics is NOT counted.
const ADS_RE = /googleadservices\.com|gtag\(['"]config['"],\s*['"]AW-|google_conversion|\/pagead\/|connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(['"](?:init|track)['"]/i;

function detectPlatform(html: string): string | null {
  for (const [name, re] of PLATFORM_RE) if (re.test(html)) return name;
  return null;
}

// Most-recent copyright year in the footer, if any (e.g. "© 2016"). We take the
// MAX year seen so a "© 2004-2018" range reports 2018 (the last time they cared).
// Ignore implausible/future years to avoid grabbing prices, ids, or JS dates.
function detectSiteYear(html: string): number | null {
  const now = new Date().getFullYear();
  let best: number | null = null;
  // Anchor on a copyright marker, then take the LATEST year in the short window
  // after it, so a "© 2011-2019" range reports 2019 (the last time they cared).
  for (const m of html.matchAll(/(?:©|&copy;|&#169;|copyright)([^<]{0,40})/gi)) {
    for (const ym of m[1].matchAll(/(?:19|20)\d{2}/g)) {
      const y = parseInt(ym[0], 10);
      if (y >= 1998 && y <= now + 1 && (best === null || y > best)) best = y;
    }
  }
  return best;
}

type Crawl = {
  siteLive: boolean; siteMobile: boolean; hasBooking: boolean;
  sitePlatform: string | null; siteYear: number | null; runsAds: boolean;
  emails: string[]; phones: string[]; facebook: string | null; instagram: string | null; twitter: string | null; linkedin: string | null;
};

async function crawlSite(rawUrl: string): Promise<Crawl> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const empty: Crawl = { siteLive: false, siteMobile: false, hasBooking: false, sitePlatform: null, siteYear: null, runsAds: false, emails: [], phones: [], facebook: null, instagram: null, twitter: null, linkedin: null };

  // In a sandbox that blocks outbound traffic this returns null too, so run
  // enrichment where the server can reach the public internet.
  const home = await fetchHtml(url);
  if (!home) return empty;

  const siteLive = home.status < 400;
  const siteMobile = /<meta[^>]+name=["']viewport["']/i.test(home.html);
  const hasBooking = BOOKING_RE.test(home.html);
  const sitePlatform = detectPlatform(home.html);
  const siteYear = detectSiteYear(home.html);
  const runsAds = ADS_RE.test(home.html);
  let c = extractContacts(home.html);

  // No email on the homepage? Many sites hide it on a Contact page — follow one.
  if (c.emails.length === 0) {
    const link = home.html.match(/href=["']([^"']*contact[^"']*)["']/i);
    if (link) {
      try {
        const cp = await fetchHtml(new URL(link[1], url).toString());
        if (cp) {
          const c2 = extractContacts(cp.html);
          c = {
            emails: [...new Set([...c.emails, ...c2.emails])].slice(0, 5),
            phones: [...new Set([...c.phones, ...c2.phones])].slice(0, 3),
            facebook: c.facebook ?? c2.facebook,
            instagram: c.instagram ?? c2.instagram,
            twitter: c.twitter ?? c2.twitter,
            linkedin: c.linkedin ?? c2.linkedin,
          };
        }
      } catch { /* bad contact URL — ignore */ }
    }
  }

  return { siteLive, siteMobile, hasBooking, sitePlatform, siteYear, runsAds, ...c };
}

// Crawl + fill-in contacts for a batch of leads, in parallel. Reused by the
// manual /enrich button AND by auto-enrich right after a scrape.
type EnrichStats = { enriched: number; emailsFound: number; socialsFound: number; phonesFound: number };
async function enrichLeadBatch(batch: (typeof leads.$inferSelect)[]): Promise<EnrichStats> {
  const has = (v: string | null | undefined) => !!(v && v.trim());
  let emailsFound = 0, socialsFound = 0, phonesFound = 0;

  await Promise.all(batch.map(async (lead) => {
    const c = await crawlSite(lead.website as string);

    // Only FILL what's missing — never overwrite contact data the lead already
    // has, since a crawled link can be a designer's/partner's profile.
    const emails = has(lead.emails) ? lead.emails : (c.emails.length ? c.emails.join(", ") : null);
    const phone = has(lead.phone) ? lead.phone : (c.phones[0] ?? null);
    const gotNewPhone = !has(lead.phone) && !!c.phones[0];
    const facebook = has(lead.facebook) ? lead.facebook : c.facebook;
    const instagram = has(lead.instagram) ? lead.instagram : c.instagram;
    const twitter = has(lead.twitter) ? lead.twitter : c.twitter;
    const linkedin = has(lead.linkedin) ? lead.linkedin : c.linkedin;
    const social = [facebook, instagram, twitter, linkedin].filter(Boolean).join(", ") || lead.social;
    const socialCount = [facebook, instagram, twitter, linkedin].filter(Boolean).length;

    const { opportunityScore, needs } = computeOpportunity({
      phone, emails, website: lead.website,
      facebook, instagram, twitter, linkedin,
      rating: lead.rating != null ? parseFloat(String(lead.rating)) : null,
      reviewCount: lead.reviewCount, category: lead.category,
    }, { siteLive: c.siteLive, siteMobile: c.siteMobile, hasBooking: c.hasBooking, sitePlatform: c.sitePlatform, siteYear: c.siteYear });
    const valueScore = computeValue(opportunityScore, lead.demandScore ?? 0);

    await db.update(leads).set({
      enrichedAt: new Date(),
      siteLive: c.siteLive, siteMobile: c.siteMobile, hasBooking: c.hasBooking,
      sitePlatform: c.sitePlatform, siteYear: c.siteYear, runsAds: c.runsAds,
      phone, emails, facebook, instagram, twitter, linkedin, social,
      opportunityScore, needs, valueScore,
    }).where(eq(leads.id, lead.id));

    if (c.emails.length) emailsFound++;
    if (socialCount) socialsFound++;
    if (gotNewPhone) phonesFound++;
  }));

  return { enriched: batch.length, emailsFound, socialsFound, phonesFound };
}

// Enrich the leads a scrape just produced: the most-recently-touched unenriched
// leads in that category that have a website (the scrape just stamped them, so
// ordering by updated_at puts them first). Bounded so it stays snappy.
export async function autoEnrichScraped(category: string): Promise<EnrichStats> {
  const fresh = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.category, category),
      isNull(leads.enrichedAt),
      sql`website IS NOT NULL AND website <> ''`,
    ))
    .orderBy(sql`updated_at DESC`)
    .limit(30);
  return enrichLeadBatch(fresh);
}

router.post("/enrich", async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(String((req.body as { limit?: number })?.limit ?? 25), 10) || 25));

  const batch = await db
    .select()
    .from(leads)
    .where(sql`website IS NOT NULL AND website <> ''`)
    .orderBy(sql`enriched_at ASC NULLS FIRST`)
    .limit(limit);

  const stats = await enrichLeadBatch(batch);

  const remRows = await db.execute(sql`SELECT COUNT(*)::int AS c FROM leads WHERE website IS NOT NULL AND website <> '' AND enriched_at IS NULL`);
  const remaining = (remRows.rows[0] as { c: number }).c;

  req.log.info({ ...stats, remaining }, "enrichment batch done");
  res.json({ ...stats, remaining });
});

// ---- POST /scrape — live test of the Google Maps lead scraper ----------------
// Drives one headless Maps search and saves the leads, so the owner can verify
// the 24/7 scraper works from the dashboard. Bounded to a single short run.
router.post("/scrape", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { category?: string; location?: string; maxScrolls?: number };
  const category = String(body.category ?? "").trim();
  const location = String(body.location ?? "").trim();
  if (!category) {
    res.status(400).json({ error: "category is required (e.g. \"plumbers\")" });
    return;
  }
  if (!acquireScrapeLock()) {
    res.status(429).json({ error: "A scrape is already running — try again in a moment." });
    return;
  }

  const startedAt = Date.now();
  try {
    const result = await scrapeAndSave({
      category,
      location: location || undefined,
      maxScrolls: typeof body.maxScrolls === "number" ? body.maxScrolls : 3,
    });
    const enrich = await autoEnrichScraped(category).catch(() => null);
    req.log.info({ ...result, enrich, ms: Date.now() - startedAt }, "admin test scrape done");
    res.json({ ...result, enrich, ms: Date.now() - startedAt });
  } catch (err) {
    req.log.error({ err }, "admin test scrape failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Scrape failed" });
  } finally {
    releaseScrapeLock();
  }
});

// ── Scraper tab (Apify-style run console) ────────────────────────────────────
// Same scrapeAndSave engine as /scrape above, but every run is persisted as a
// row (input, status, dataset, counts) so the admin gets a run history and a
// browsable/exportable dataset per run instead of a one-shot test result.

// POST /scraper/runs — start a run
router.post("/scraper/runs", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { category?: string; location?: string; maxScrolls?: number; platform?: ScrapePlatform };
  const category = String(body.category ?? "").trim();
  const location = String(body.location ?? "").trim();
  const platform: ScrapePlatform = body.platform ?? "google_maps";
  if (!category) {
    res.status(400).json({ error: "category is required (e.g. \"plumbers\")" });
    return;
  }
  if (!acquireScrapeLock()) {
    res.status(429).json({ error: "A scrape is already running — try again in a moment." });
    return;
  }

  try {
    const run = await startRun(platform, category, location || undefined, null);
    const finished = await runScrapeJob(run.id, platform, {
      category,
      location: location || undefined,
      maxScrolls: typeof body.maxScrolls === "number" ? body.maxScrolls : 3,
    });
    const enrich = finished.status === "succeeded" ? await autoEnrichScraped(category).catch(() => null) : null;
    req.log.info({ runId: finished.id, status: finished.status, saved: finished.saved, enrich }, "scraper run done");
    res.json({ ok: finished.status === "succeeded", run: finished, enrich });
  } catch (err) {
    req.log.error({ err }, "scraper run failed to start");
    res.status(500).json({ error: err instanceof Error ? err.message : "Scrape failed" });
  } finally {
    releaseScrapeLock();
  }
});

// GET /scraper/runs — history (no dataset payload — keeps the list light).
// Site-wide (all users) — this is the owner's internal view.
router.get("/scraper/runs", requireAuth, async (req, res) => {
  const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit ?? "30"), 10) || 30));
  res.json({ runs: await listRuns(limit), inFlight: scrapeInFlight() });
});

// GET /scraper/runs/:id — one run's full detail, including its dataset
router.get("/scraper/runs/:id", requireAuth, async (req, res) => {
  const run = await getRun(Number(req.params.id));
  if (!run) { res.status(404).json({ error: "Run not found" }); return; }
  res.json({ run });
});

// GET /scraper/runs/:id/export — download the run's dataset as CSV
router.get("/scraper/runs/:id/export", requireAuth, async (req, res) => {
  const run = await getRun(Number(req.params.id));
  if (!run) { res.status(404).json({ error: "Run not found" }); return; }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="scrape-run-${run.id}.csv"`);
  res.send(runToCsv(run));
});

// DELETE /scraper/runs/:id — remove a run from history
router.delete("/scraper/runs/:id", requireAuth, async (req, res) => {
  await deleteRun(Number(req.params.id));
  res.json({ ok: true });
});

// ---- POST /research — AI finds the best places to scrape -------------------
// Claude turns a plain-English goal into ranked (category × metro) targets and
// upserts them into scrape_targets, which the map + scraper both read from.
router.post("/research", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { goal?: string; count?: number };
  const goal = String(body.goal ?? "").trim();
  if (!goal) {
    res.status(400).json({ error: "Tell the AI what you're looking for (e.g. \"Gulf Coast businesses that need a website\")." });
    return;
  }
  const count = typeof body.count === "number" ? body.count : 24;

  try {
    const targets = await researchTargets({ goal, count });
    if (targets.length === 0) {
      res.status(502).json({ error: "AI returned no targets — try rephrasing your goal." });
      return;
    }
    // Replace the previous AI plan so each research gives a clean list (manually
    // added targets, source='manual', are left untouched). One batched insert.
    await db.delete(scrapeTargets).where(eq(scrapeTargets.source, "ai"));
    await db
      .insert(scrapeTargets)
      .values(targets.map((t) => ({
        category: t.category,
        location: t.location,
        lat: t.lat != null ? String(t.lat) : null,
        lng: t.lng != null ? String(t.lng) : null,
        priority: t.priority,
        reason: t.reason,
        estLeads: t.estLeads,
        source: "ai",
        active: true,
      })))
      .onConflictDoUpdate({
        target: [scrapeTargets.category, scrapeTargets.location],
        set: {
          lat: sql`excluded.lat`,
          lng: sql`excluded.lng`,
          priority: sql`excluded.priority`,
          reason: sql`excluded.reason`,
          estLeads: sql`excluded.est_leads`,
          active: sql`true`,
        },
      });
    const rows = await db.select().from(scrapeTargets).orderBy(desc(scrapeTargets.priority));
    req.log.info({ goal, count: targets.length }, "ai research done");
    res.json({ targets: rows });
  } catch (err) {
    req.log.error({ err }, "ai research failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Research failed" });
  }
});

// ---- POST /discover — live web-search lead discovery (net-new businesses) ---
// Finds real businesses on the open web (not just Maps) and saves them as leads.
router.post("/discover", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { goal?: string; max?: number };
  const goal = String(body.goal ?? "").trim();
  if (!goal) { res.status(400).json({ error: "Describe what to find (e.g. \"used car dealers on the MS gulf coast with no website\")." }); return; }

  try {
    const found = await discoverBusinesses(goal, typeof body.max === "number" ? body.max : 15);
    if (found.length === 0) { res.status(502).json({ error: "Web search returned no businesses — try rephrasing." }); return; }

    // Save as leads through the same path the scraper uses (scores + dedupes).
    const rows = found.map((b) => ({
      Name: b.name,
      Phone: b.phone ?? "",
      Website: b.website ?? "",
      Address: [b.city, b.state].filter(Boolean).join(", "),
      Category: b.category || goal,
    }));
    let saved = 0, duplicates = 0;
    try {
      const r = await fetch(`http://127.0.0.1:${process.env.PORT ?? "5000"}/api/leads/save`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rows),
      });
      if (r.ok) { const d = (await r.json()) as { saved?: number; duplicates?: number }; saved = d.saved ?? 0; duplicates = d.duplicates ?? 0; }
    } catch { /* save best-effort */ }

    req.log.info({ goal, found: found.length, saved }, "web discovery done");
    res.json({ found: found.length, saved, duplicates, businesses: found });
  } catch (err) {
    req.log.error({ err }, "web discovery failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Discovery failed" });
  }
});

// ---- POST /recon — deep multi-platform sell-angle recon on leads -----------
// Hunts ad activity, buying/timing signals, competitor gaps & reputation across
// the web to surface a sharp, urgent sell angle per lead. Bounded (web search).
router.post("/recon", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { limit?: number; onlyHighTicket?: boolean };
  const limit = Math.min(8, Math.max(1, Number(body.limit) || 5));

  const conds = [isNull(leads.deletedAt), isNull(leads.socialIntel)];
  if (body.onlyHighTicket) conds.push(eq(leads.highTicket, true));
  const batch = await db.select().from(leads).where(and(...conds))
    .orderBy(sql`high_ticket DESC, updated_at DESC`).limit(limit);
  if (batch.length === 0) { res.json({ scanned: 0, results: [] }); return; }

  try {
    const results = await Promise.all(batch.map(async (l) => {
      const brief = await reconSellAngle({
        name: l.name, category: l.category, address: l.address, website: l.website,
        facebook: l.facebook, instagram: l.instagram, rating: l.rating, reviewCount: l.reviewCount,
        sitePlatform: l.sitePlatform, siteYear: l.siteYear, runsAds: l.runsAds,
      }).catch((): ReconBrief => ({}));
      const sources = brief.sources ?? [];
      const intel = composeBrief(brief);
      if (intel) await db.update(leads).set({ socialIntel: intel }).where(eq(leads.id, l.id));
      return {
        id: l.id, name: l.name, category: l.category, website: l.website, facebook: l.facebook,
        intel, summary: brief.summary ?? "", angle: brief.angle ?? "", opener: brief.opener ?? "",
        sources, verified: sources.length > 0,
      };
    }));
    const done = results.filter((r) => r.intel);
    req.log.info({ scanned: done.length }, "sell-angle recon done");
    res.json({ scanned: done.length, results: done });
  } catch (err) {
    req.log.error({ err }, "recon failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Recon failed" });
  }
});

// ---- POST /social-scan — analyze leads' actual social pages for pitch ammo --
// Per-platform followers/recency/missing-platform findings + a pitch built
// from them. Skips already-scanned leads; pass leadIds to target specific ones.
router.post("/social-scan", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { limit?: number; leadIds?: number[]; onlyHighTicket?: boolean };
  const limit = Math.min(8, Math.max(1, Number(body.limit) || 5));

  let batch;
  if (Array.isArray(body.leadIds) && body.leadIds.length) {
    const ids = body.leadIds.map(Number).filter(Number.isFinite).slice(0, 8);
    batch = await db.select().from(leads).where(and(isNull(leads.deletedAt), inArray(leads.id, ids)));
  } else {
    const conds = [isNull(leads.deletedAt), isNull(leads.socialScanAt)];
    if (body.onlyHighTicket) conds.push(eq(leads.highTicket, true));
    // Leads with a social URL on file first (probe-verifiable), best leads first.
    batch = await db.select().from(leads).where(and(...conds))
      .orderBy(sql`(facebook IS NOT NULL OR instagram IS NOT NULL OR twitter IS NOT NULL OR linkedin IS NOT NULL) DESC, high_ticket DESC, value_score DESC`)
      .limit(limit);
  }
  if (batch.length === 0) { res.json({ scanned: 0, results: [] }); return; }

  try {
    const results = await Promise.all(batch.map(async (l) => {
      try {
        const report = await scanAndSaveLead(l);
        return { id: l.id, name: l.name, category: l.category, report, summary: socialScanSummary(report) };
      } catch (err) {
        req.log.warn({ err, leadId: l.id }, "social scan failed for lead");
        return null;
      }
    }));
    const done = results.filter((r) => r !== null);
    req.log.info({ scanned: done.length }, "social scan done");
    res.json({ scanned: done.length, results: done });
  } catch (err) {
    req.log.error({ err }, "social scan failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Social scan failed" });
  }
});

// ---- POST /analyze — AI lead intelligence: rationale + high-ticket + bios ---
// Reads a batch of real leads and judges which are high-ticket, writing a sales
// bio for each. Defaults to the most-recently-touched leads (the latest scrape).
router.post("/analyze", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { category?: string; limit?: number };
  const limit = Math.min(40, Math.max(1, Number(body.limit) || 30));
  const category = String(body.category ?? "").trim();

  const conds = [isNull(leads.deletedAt)];
  if (category) conds.push(eq(leads.category, category));
  const batch = await db.select().from(leads).where(and(...conds)).orderBy(sql`updated_at DESC`).limit(limit);
  if (batch.length === 0) { res.json({ rationale: "", analyzed: 0, highTicket: [] }); return; }

  try {
    const analysis = await analyzeLeads(batch.map((l) => ({
      id: l.id, name: l.name, category: l.category, address: l.address, website: l.website,
      rating: l.rating, reviewCount: l.reviewCount, opportunityScore: l.opportunityScore,
      needs: (l.needs ?? []) as string[],
      sitePlatform: l.sitePlatform, siteYear: l.siteYear, runsAds: l.runsAds,
    })));

    const byId = new Map(analysis.verdicts.map((v) => [v.id, v]));
    await Promise.all(batch.map(async (l) => {
      const v = byId.get(l.id);
      if (!v) return;
      await db.update(leads).set({ highTicket: v.highTicket, bio: v.bio || null }).where(eq(leads.id, l.id));
    }));

    const highTicket = batch
      .filter((l) => byId.get(l.id)?.highTicket)
      .map((l) => ({
        id: l.id, name: l.name, category: l.category, phone: l.phone, emails: l.emails,
        website: l.website, address: l.address, opportunityScore: l.opportunityScore,
        bio: byId.get(l.id)?.bio ?? "",
      }));

    req.log.info({ analyzed: batch.length, highTicket: highTicket.length }, "lead analysis done");
    res.json({ rationale: analysis.rationale, analyzed: batch.length, highTicket });
  } catch (err) {
    req.log.error({ err }, "lead analysis failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Analyze failed" });
  }
});

// ---- GET /scrape-targets — the current scrape plan (for the map + list) -----
router.get("/scrape-targets", async (_req, res) => {
  const rows = await db.select().from(scrapeTargets).orderBy(desc(scrapeTargets.priority), asc(scrapeTargets.id));
  res.json({ targets: rows });
});

// ---- GET /scrape-targets/active — simple list the scraper consumes ----------
router.get("/scrape-targets/active", async (_req, res) => {
  const rows = await db
    .select({ category: scrapeTargets.category, location: scrapeTargets.location })
    .from(scrapeTargets)
    .where(eq(scrapeTargets.active, true))
    .orderBy(desc(scrapeTargets.priority));
  res.json({ targets: rows });
});

// ---- POST /scrape-targets/:id/scrape — scrape one target, update coverage ---
router.post("/scrape-targets/:id/scrape", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (!acquireScrapeLock()) { res.status(429).json({ error: "A scrape is already running." }); return; }

  const [target] = await db.select().from(scrapeTargets).where(eq(scrapeTargets.id, id)).limit(1);
  if (!target) { releaseScrapeLock(); res.status(404).json({ error: "Target not found" }); return; }

  try {
    const result = await scrapeAndSave({ category: target.category, location: target.location });
    const enrich = await autoEnrichScraped(target.category).catch(() => null);
    await db
      .update(scrapeTargets)
      .set({ lastScrapedAt: new Date(), leadCount: (target.leadCount ?? 0) + result.saved })
      .where(eq(scrapeTargets.id, id));
    res.json({ ...result, enrich, id });
  } catch (err) {
    req.log.error({ err, id }, "target scrape failed");
    res.status(500).json({ error: err instanceof Error ? err.message : "Scrape failed" });
  } finally {
    releaseScrapeLock();
  }
});

// ---- DELETE /scrape-targets — clear the whole plan --------------------------
router.delete("/scrape-targets", requireAdmin, async (_req, res) => {
  await db.delete(scrapeTargets);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
// Auto-scrape — the background scheduler that keeps inventory filled for the
// categories × core metros we sell (lib/autoScrape.ts).
// ════════════════════════════════════════════════════════════════════════════

// ---- GET /auto-scrape — scheduler status + a preview of what's next ---------
router.get("/auto-scrape", requireAuth, async (_req, res) => {
  const queue = (await listAutoCandidates(5)).map(({ target, inventory }) => ({
    id: target.id, category: target.category, location: target.location,
    priority: target.priority, lastScrapedAt: target.lastScrapedAt, inventory,
  }));
  res.json({ ...autoScrapeStatus(), inFlight: scrapeInFlight(), queue });
});

// ---- POST /auto-scrape — toggle the scheduler at runtime --------------------
router.post("/auto-scrape", requireAuth, async (req, res) => {
  const on = (req.body as { enabled?: unknown } | undefined)?.enabled;
  if (typeof on !== "boolean") { res.status(400).json({ error: "enabled (boolean) is required" }); return; }
  setAutoScrapeEnabled(on);
  res.json(autoScrapeStatus());
});

// ---- POST /auto-scrape/seed — fill the plan from what we offer --------------
router.post("/auto-scrape/seed", requireAuth, async (req, res) => {
  const added = await seedAutoTargets();
  req.log.info({ added }, "auto-scrape targets seeded");
  res.json({ added });
});

// ---- POST /auto-scrape/tick — run one scheduler pass right now --------------
router.post("/auto-scrape/tick", requireAuth, async (req, res) => {
  const result = await autoScrapeTick();
  req.log.info(result, "manual auto-scrape tick");
  res.json(result);
});

// ════════════════════════════════════════════════════════════════════════════
// Proxy center — rotating IP pool that shields the scraper. Admin-only (creds).
// ════════════════════════════════════════════════════════════════════════════

// Never leak passwords to the client; expose only whether auth is set.
function maskProxy(p: typeof proxies.$inferSelect) {
  const { password, ...rest } = p;
  return { ...rest, hasPassword: !!password };
}

// ---- GET /proxies — pool + summary ------------------------------------------
router.get("/proxies", requireAuth, async (_req, res) => {
  const rows = await db.select().from(proxies).orderBy(asc(proxies.id));
  const summary = {
    total: rows.length,
    healthy: rows.filter(r => r.status === "healthy").length,
    dead: rows.filter(r => r.status === "dead").length,
    active: rows.filter(r => r.active).length,
  };
  res.json({ proxies: rows.map(maskProxy), summary });
});

// ---- POST /proxies — add one or bulk-import many ----------------------------
router.post("/proxies", requireAuth, async (req, res) => {
  const body = (req.body ?? {}) as { text?: string };
  const text = String(body.text ?? "").trim();
  if (!text) { res.status(400).json({ error: "Paste at least one proxy (host:port[:user:pass])." }); return; }

  const parsed = parseProxyLines(text);
  if (parsed.length === 0) { res.status(400).json({ error: "Couldn't parse any proxies — check the format." }); return; }

  let added = 0;
  for (const p of parsed) {
    const r = await db
      .insert(proxies)
      .values({ protocol: p.protocol, host: p.host, port: p.port, username: p.username, password: p.password })
      .onConflictDoNothing({ target: [proxies.host, proxies.port] });
    added += r.rowCount ?? 0;
  }
  res.json({ added, parsed: parsed.length });
});

// ---- POST /proxies/test-all — health-check the whole pool -------------------
router.post("/proxies/test-all", requireAuth, async (_req, res) => {
  const rows = await db.select().from(proxies);
  await Promise.all(rows.map(async (p) => {
    const t = await testProxy(p);
    await db.update(proxies).set({
      status: t.ok ? "healthy" : "dead",
      latencyMs: t.ok ? t.ms : null,
      lastCheckedAt: new Date(),
    }).where(eq(proxies.id, p.id));
  }));
  const after = await db.select().from(proxies);
  res.json({ tested: rows.length, healthy: after.filter(p => p.status === "healthy").length });
});

// ---- POST /proxies/:id/test — health-check one ------------------------------
router.post("/proxies/:id/test", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [p] = await db.select().from(proxies).where(eq(proxies.id, id)).limit(1);
  if (!p) { res.status(404).json({ error: "Proxy not found" }); return; }

  const t = await testProxy(p);
  await db.update(proxies).set({
    status: t.ok ? "healthy" : "dead",
    latencyMs: t.ok ? t.ms : null,
    lastCheckedAt: new Date(),
  }).where(eq(proxies.id, id));
  res.json({ id, ok: t.ok, ms: t.ms, error: t.error });
});

// ---- PATCH /proxies/:id — toggle active / reset status ----------------------
router.patch("/proxies/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const body = (req.body ?? {}) as { active?: boolean; reset?: boolean };
  const set: Record<string, unknown> = {};
  if (typeof body.active === "boolean") set.active = body.active;
  if (body.reset) { set.status = "untested"; set.failCount = 0; }
  if (Object.keys(set).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  await db.update(proxies).set(set).where(eq(proxies.id, id));
  res.json({ ok: true, id });
});

// ---- DELETE /proxies/:id ----------------------------------------------------
router.delete("/proxies/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(proxies).where(eq(proxies.id, id));
  res.json({ ok: true, id });
});

// ---- POST /packs/checkout — create a Stripe Checkout link to SELL a pack ----
// The owner sets a price for a category/territory pack; the buyer pays via the
// returned Stripe URL and is redirected to a payment-gated CSV download.
router.post("/packs/checkout", async (req, res) => {
  const body = req.body as { category?: string; state?: string; minOpportunity?: number; priceCents?: number; label?: string };
  const priceCents = Math.max(100, Math.round(Number(body.priceCents) || 0)); // $1 minimum
  const category = (body.category ?? "").trim();
  const state = (body.state ?? "").trim().toUpperCase();
  const minOpportunity = Math.max(0, Math.round(Number(body.minOpportunity) || 0));

  // Count what the buyer will get, so we can refuse to sell an empty pack.
  const conditions = [];
  if (category) conditions.push(sql`category ILIKE ${"%" + category + "%"}`);
  if (/^[A-Z]{2}$/.test(state)) conditions.push(sql`address ~ ${"\\y" + state + "\\s+\\d{5}"}`);
  if (minOpportunity > 0) conditions.push(sql`opportunity_score >= ${minOpportunity}`);
  const whereSql = conditions.length ? sql.join([sql` WHERE `, sql.join(conditions, sql` AND `)]) : sql``;
  const cntRows = await db.execute(sql`SELECT COUNT(*)::int AS c FROM leads${whereSql}`);
  const leadCount = (cntRows.rows[0] as { c: number }).c;
  if (leadCount === 0) { res.status(400).json({ error: "That pack has 0 leads — nothing to sell." }); return; }

  const name = body.label?.trim()
    || `Lead pack${category ? ` — ${category}` : ""}${state ? ` (${state})` : ""}${minOpportunity ? ` · opp ${minOpportunity}+` : ""} · ${leadCount} leads`;

  try {
    const stripe = await getUncachableStripeClient();
    const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost"}`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price_data: { currency: "usd", unit_amount: priceCents, product_data: { name } }, quantity: 1 }],
      metadata: { pack_category: category, pack_state: state, pack_min_opp: String(minOpportunity) },
      success_url: `${baseUrl}/api/leads/pack-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/admin`,
    });
    res.json({ url: session.url, leadCount, priceCents, name });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Stripe not connected" });
  }
});

// ---- GET /leads — all leads paginated for admin view ------------------------
const ADMIN_SORT_COLUMNS: Record<string, string> = {
  value: "value_score",
  demand: "demand_score",
  opportunity: "opportunity_score",
};
router.get("/leads", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const minOpportunity = parseInt(String(req.query.minOpportunity ?? "0"), 10) || 0;
  // sort = value | demand | opportunity surfaces the most valuable / wanted /
  // weakest leads across all members; default is newest first.
  const sortCol = ADMIN_SORT_COLUMNS[String(req.query.sort ?? "")];
  const offset = (page - 1) * limit;

  const where = minOpportunity > 0 ? gte(leads.opportunityScore, minOpportunity) : undefined;
  const orderBy = sortCol ? sql.raw(`${sortCol} DESC, created_at DESC`) : sql`created_at DESC`;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(leads).where(where).orderBy(orderBy).limit(limit).offset(offset),
    db.select({ total: count() }).from(leads).where(where),
  ]);

  res.json({ leads: rows, total: Number(total), page, pages: Math.ceil(Number(total) / limit) || 1 });
});

// ---- GET /admin/deleted-leads — list soft-deleted leads --------------------
router.get("/deleted-leads", requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = (page - 1) * limit;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(leads).where(isNotNull(leads.deletedAt)).orderBy(desc(leads.deletedAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(leads).where(isNotNull(leads.deletedAt)),
  ]);

  res.json({ leads: rows, total: Number(total), page, pages: Math.ceil(Number(total) / limit) || 1 });
});

// ---- POST /admin/restore/:id — restore a soft-deleted lead -----------------
router.post("/restore/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(leads).set({ deletedAt: null, updatedAt: new Date() }).where(eq(leads.id, id));
  res.json({ ok: true, id });
});

// ---- POST /admin/restore-bulk — restore multiple soft-deleted leads --------
router.post("/restore-bulk", requireAdmin, async (req, res) => {
  const { ids } = req.body as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" }); return;
  }
  const validIds = ids.map(Number).filter(n => !isNaN(n) && n > 0);
  await db.execute(sql`UPDATE leads SET deleted_at = NULL, updated_at = NOW() WHERE id = ANY(${sql.raw(`ARRAY[${validIds.join(",")}]::int[]`)})`);
  res.json({ ok: true, restored: validIds.length });
});

// ═══ Social auto-poster ═══════════════════════════════════════════════════════

// ---- GET /social — everything the Social tab needs in one call ---------------
router.get("/social", requireAuth, async (_req, res) => {
  // Never select image_b64 in lists — it's megabytes per row.
  const { imageB64: _imageB64, ...postCols } = getTableColumns(socialPosts);
  const listCols = { ...postCols, hasImage: sql<boolean>`${socialPosts.imageB64} IS NOT NULL` };
  const [settings, fb, appConfigured, queue, groupQueue, history, groups, customImages] = await Promise.all([
    getSocialSettings(),
    facebookCreds(),
    fbAppConfigured(),
    db.select(listCols).from(socialPosts).where(and(eq(socialPosts.status, "queued"), eq(socialPosts.platform, "facebook"))).orderBy(asc(socialPosts.id)),
    db.select(listCols).from(socialPosts).where(and(eq(socialPosts.status, "queued"), eq(socialPosts.platform, "facebook_group"))).orderBy(asc(socialPosts.id)),
    db.select(listCols).from(socialPosts).where(sql`${socialPosts.status} <> 'queued'`).orderBy(desc(socialPosts.id)).limit(30),
    listGroups(),
    listLandingImageSlugs(),
  ]);
  // Never ship tokens/secrets to the browser.
  const { fbAppSecret: _s, fbUserToken: _u, fbPageToken: _p, ...safeSettings } = settings;
  res.json({
    settings: safeSettings,
    facebookConnected: Boolean(fb),
    pageName: fb?.pageName ?? null,
    appConfigured,
    redirectUri: FB_REDIRECT_URI,
    aiConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.CHAT_GPT_API),
    queue,
    groupQueue,
    history,
    groups,
    customImages,
  });
});

// ── Facebook Groups (assisted posting — Meta killed the Groups API in 2024) ──

// POST /social/groups — save a group to the rotation
router.post("/social/groups", requireAuth, async (req, res) => {
  try {
    const { name, url, notes } = req.body as { name?: string; url?: string; notes?: string };
    if (!name?.trim() || !url?.trim()) { res.status(400).json({ error: "Group name and link are both required." }); return; }
    res.json({ ok: true, group: await addGroup(name, url, notes) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// DELETE /social/groups/:id — drop a group from the rotation
router.delete("/social/groups/:id", requireAuth, async (req, res) => {
  await deleteGroup(Number(req.params.id));
  res.json({ ok: true });
});

// POST /social/groups/discover — AI web-search finds real public FB Groups
// that fit the product's audience and auto-adds the new ones to the rotation
router.post("/social/groups/discover", requireAuth, async (req, res) => {
  try {
    const count = Math.min(15, Math.max(3, Number((req.body as { count?: number })?.count) || 8));
    const result = await discoverGroups(count);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /social/groups/generate — AI writes group-flavored posts (no links/ads)
router.post("/social/groups/generate", requireAuth, async (req, res) => {
  try {
    const count = Math.min(10, Math.max(1, Number((req.body as { count?: number })?.count) || 5));
    res.json({ ok: true, posts: await generateGroupPosts(count) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST /social/groups/:id/posted — admin pasted a post into the group by hand
router.post("/social/groups/:id/posted", requireAuth, async (req, res) => {
  try {
    const postId = Number((req.body as { postId?: number })?.postId);
    if (!postId) { res.status(400).json({ error: "postId required" }); return; }
    await markGroupPosted(Number(req.params.id), postId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---- Facebook OAuth: GET /social/fb/connect → Facebook login dialog ----------
router.get("/social/fb/connect", requireAuth, async (_req, res) => {
  try {
    res.redirect(await fbConnectUrl());
  } catch (err) {
    res.status(400).send(err instanceof Error ? err.message : String(err));
  }
});

// The dashboard button can't attach its auth header to a plain navigation, so
// it fetches the dialog URL here (authorized) and redirects the browser itself.
router.get("/social/fb/connect-url", requireAuth, async (_req, res) => {
  try {
    res.json({ url: await fbConnectUrl() });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Tiny standalone result page — the callback lands as a top-level navigation,
// so respond with plain HTML that sends the admin back to the dashboard.
function fbResultPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0d1117;color:#e6edf3;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{max-width:460px;background:#161b22;border:1px solid #30363d;border-radius:16px;padding:32px;text-align:center}
a.btn{display:inline-block;margin-top:8px;padding:10px 20px;border-radius:10px;background:#00E676;color:#0d1117;font-weight:700;text-decoration:none}
a.pick{display:block;margin:8px 0;padding:12px;border-radius:10px;background:#21262d;color:#e6edf3;text-decoration:none;font-weight:600}
p{color:#8b949e}</style></head><body><div class="card">${body}</div></body></html>`;
}

// ---- GET /social/fb/callback — Facebook redirects here after Approve ---------
// No requireAuth: Facebook's redirect is a bare top-level navigation with no
// admin session attached. The HMAC-signed, 15-minute `state` param (created by
// fbConnectUrl, verified inside fbHandleCallback) is what proves this callback
// belongs to a connect flow an authenticated admin started.
router.get("/social/fb/callback", async (req, res) => {
  const { code, state, error_description: fbError } = req.query as Record<string, string | undefined>;
  if (fbError || !code || !state) {
    res.status(400).send(fbResultPage("Facebook connection failed",
      `<h2>😕 Connection cancelled</h2><p>${fbError || "Facebook didn't send a login code."}</p><a class="btn" href="/admin">Back to admin</a>`));
    return;
  }
  try {
    const { connected, pages } = await fbHandleCallback(code, state);
    const sig = await fbPickerToken();
    if (connected) {
      res.send(fbResultPage("Facebook connected",
        `<h2>✅ Connected to ${connected.name}</h2><p>The auto-poster can now publish to your Page. You can close this and head back.</p><a class="btn" href="/admin">Back to admin</a>`));
      return;
    }
    res.send(fbResultPage("Pick a Page",
      `<h2>Almost done — which Page?</h2><p>Your account manages more than one Page. Pick the one to auto-post to:</p>` +
      pages.map((p) => `<a class="pick" href="/api/admin/social/fb/select?pageId=${encodeURIComponent(p.id)}&sig=${encodeURIComponent(sig)}">${p.name}</a>`).join("")));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).send(fbResultPage("Facebook connection failed",
      `<h2>😕 Something went wrong</h2><p>${msg}</p><a class="btn" href="/admin">Back to admin</a>`));
  }
});

// ---- GET /social/fb/select?pageId= — finish connect when multiple Pages ------
// Also a top-level navigation (clicked on the callback result page), so it is
// guarded by the signed `sig` token minted by the callback, not requireAuth.
router.get("/social/fb/select", async (req, res) => {
  try {
    if (!(await fbPickerTokenValid(String(req.query.sig ?? "")))) {
      res.status(401).send(fbResultPage("Link expired",
        `<h2>😕 That link expired</h2><p>Page-picker links are only valid for 15 minutes. Head back and click Connect Facebook again.</p><a class="btn" href="/admin">Back to admin</a>`));
      return;
    }
    const page = await fbSelectPage(String(req.query.pageId ?? ""));
    res.send(fbResultPage("Facebook connected",
      `<h2>✅ Connected to ${page.name}</h2><p>The auto-poster can now publish to your Page.</p><a class="btn" href="/admin">Back to admin</a>`));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).send(fbResultPage("Facebook connection failed",
      `<h2>😕 Something went wrong</h2><p>${msg}</p><a class="btn" href="/admin">Back to admin</a>`));
  }
});

// ---- Landing-page pictures: upload / revert the /go/<slug>.jpg creative -------
// The image is sent as the raw request body (Content-Type = the file's type),
// so a route-local raw parser with a generous limit reads it without touching
// the global JSON body parser. Stored in the DB so it survives redeploys.
router.post(
  "/social/landing-image/:slug",
  requireAuth,
  express.raw({ type: () => true, limit: MAX_IMAGE_BYTES + 1024 }),
  async (req, res) => {
    const slug = String(req.params.slug ?? "");
    if (!validSlug(slug)) { res.status(400).json({ error: "Bad slug." }); return; }
    const mime = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    if (!allowedImageMime(mime)) {
      res.status(400).json({ error: "Please upload a JPG, PNG, WebP or GIF image." });
      return;
    }
    const bytes = req.body as Buffer;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      res.status(400).json({ error: "No image received." });
      return;
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
      res.status(400).json({ error: "Image is too large — keep it under 8 MB." });
      return;
    }
    try {
      await saveLandingImage(slug, mime, bytes);
      res.json({ ok: true, slug, bytes: bytes.length });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Save failed." });
    }
  },
);

// One-click "Change picture": AI-generates a brand-new ad creative for the
// page and stores it as the override — no file picking. The client sends the
// page's name/angle/headline (single source of truth lives in the site data).
router.post("/social/landing-image/:slug/generate", requireAuth, async (req, res) => {
  const slug = String(req.params.slug ?? "");
  if (!validSlug(slug)) { res.status(400).json({ error: "Bad slug." }); return; }
  const body = (req.body ?? {}) as { name?: unknown; angle?: unknown; headline?: unknown };
  const brief = {
    name: String(body.name ?? slug).slice(0, 200),
    angle: String(body.angle ?? "").slice(0, 500),
    headline: String(body.headline ?? "").slice(0, 300),
  };
  try {
    const { mime, bytes } = await generateLandingCreative(brief);
    if (bytes.length > MAX_IMAGE_BYTES) {
      res.status(500).json({ error: "Generated image was unexpectedly large — please try again." });
      return;
    }
    await saveLandingImage(slug, mime, bytes);
    res.json({ ok: true, slug, bytes: bytes.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Image generation failed." });
  }
});

router.delete("/social/landing-image/:slug", requireAuth, async (req, res) => {
  const slug = String(req.params.slug ?? "");
  if (!validSlug(slug)) { res.status(400).json({ error: "Bad slug." }); return; }
  const removed = await deleteLandingImage(slug);
  res.json({ ok: true, reverted: removed });
});

// ---- POST /social/fb/disconnect — forget the connected Page ------------------
router.post("/social/fb/disconnect", requireAuth, async (_req, res) => {
  await fbDisconnect();
  res.json({ ok: true });
});

// ---- POST /social/generate — top the queue up with AI-written posts ----------
router.post("/social/generate", requireAuth, async (req, res) => {
  try {
    const count = Math.min(10, Math.max(1, Number((req.body as { count?: number })?.count) || 5));
    const posts = await generateSocialPosts(count);
    res.json({ ok: true, posts });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---- POST /social/generate-freetool — free-extension ads (Chrome install) ----
router.post("/social/generate-freetool", requireAuth, async (req, res) => {
  try {
    const count = Math.min(10, Math.max(1, Number((req.body as { count?: number })?.count) || 3));
    const posts = await generateFreeToolPosts(count);
    res.json({ ok: true, posts });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---- POST /social/chat — AI assistant that manages the posting queue ---------
// Body: { messages: [{role: "user"|"assistant", content}] } (the running chat).
// The model edits the queue via tool calls; `changed` tells the UI to reload it.
router.post("/social/chat", requireAuth, async (req, res) => {
  try {
    const raw = (req.body as { messages?: unknown })?.messages;
    const messages = Array.isArray(raw)
      ? raw.filter((m): m is SocialChatMessage =>
          !!m && typeof m === "object" &&
          ((m as SocialChatMessage).role === "user" || (m as SocialChatMessage).role === "assistant") &&
          typeof (m as SocialChatMessage).content === "string")
      : [];
    if (messages.length === 0 || messages[messages.length - 1]!.role !== "user") {
      res.status(400).json({ error: "messages must end with a user message" });
      return;
    }
    res.json({ ok: true, ...(await socialChat(messages)) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---- POST /social/sync-stats — refresh engagement numbers from Facebook ------
router.post("/social/sync-stats", requireAuth, async (_req, res) => {
  try {
    res.json({ ok: true, synced: await syncEngagementStats(25) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---- Post images: generate / view / remove -----------------------------------
router.post("/social/:id/image", requireAuth, async (req, res) => {
  try {
    await generatePostImage(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/social/:id/image", requireAuth, async (req, res) => {
  const img = await getPostImage(Number(req.params.id));
  if (!img) { res.status(404).json({ error: "No image on this post" }); return; }
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(img);
});

router.delete("/social/:id/image", requireAuth, async (req, res) => {
  await removePostImage(Number(req.params.id));
  res.json({ ok: true });
});

// ---- POST /social/:id/post-now — publish immediately (skips the schedule) ----
router.post("/social/:id/post-now", requireAuth, async (req, res) => {
  try {
    const post = await publishPost(Number(req.params.id));
    if (post.status === "failed") { res.status(502).json({ error: post.error, post }); return; }
    res.json({ ok: true, post });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---- PATCH /social/:id — edit a queued post's text / requeue a failed one ----
router.patch("/social/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { body, requeue } = req.body as { body?: string; requeue?: boolean };
  const patch: Partial<typeof socialPosts.$inferInsert> = {};
  if (typeof body === "string" && body.trim()) patch.body = body.trim();
  if (requeue) { patch.status = "queued"; patch.error = null; }
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
  const rows = await db.update(socialPosts).set(patch).where(eq(socialPosts.id, id)).returning();
  if (!rows[0]) { res.status(404).json({ error: "Post not found" }); return; }
  res.json({ ok: true, post: rows[0] });
});

// ---- DELETE /social/:id — remove a post from the queue/history ---------------
router.delete("/social/:id", requireAuth, async (req, res) => {
  await db.delete(socialPosts).where(eq(socialPosts.id, Number(req.params.id)));
  res.json({ ok: true });
});

// ---- PUT /social/settings — pause/resume, posting hour, auto-refill ----------
// Also accepts fbAppId/fbAppSecret so the Facebook app credentials can be
// seeded into whichever database this deployment uses (dev and prod differ).
router.put("/social/settings", requireAuth, async (req, res) => {
  const { enabled, postHourUtc, autoRefill, fbAppId, fbAppSecret, fbPageId, fbPageName, fbPageToken } = req.body as {
    enabled?: boolean; postHourUtc?: number; autoRefill?: boolean;
    fbAppId?: string; fbAppSecret?: string; fbPageId?: string; fbPageName?: string; fbPageToken?: string;
  };
  const patch: Record<string, boolean | number | string> = {};
  if (typeof enabled === "boolean") patch.enabled = enabled;
  if (typeof autoRefill === "boolean") patch.autoRefill = autoRefill;
  if (typeof postHourUtc === "number" && postHourUtc >= 0 && postHourUtc <= 23) patch.postHourUtc = postHourUtc;
  if (typeof fbAppId === "string" && fbAppId.trim()) patch.fbAppId = fbAppId.trim();
  if (typeof fbAppSecret === "string" && fbAppSecret.trim()) patch.fbAppSecret = fbAppSecret.trim();
  if (typeof fbPageId === "string" && fbPageId.trim()) patch.fbPageId = fbPageId.trim();
  if (typeof fbPageName === "string" && fbPageName.trim()) patch.fbPageName = fbPageName.trim();
  if (typeof fbPageToken === "string" && fbPageToken.trim()) patch.fbPageToken = fbPageToken.trim();
  const settings = await updateSocialSettings(patch);
  const { fbAppSecret: _s, fbUserToken: _u, fbPageToken: _p, ...safeSettings } = settings;
  res.json({ ok: true, settings: safeSettings });
});

// ---- Live site chat: watch conversations + take over from the AI -------------

// GET /chats — conversation list, newest activity first, with unread counts.
router.get("/chats", requireAuth, async (_req, res) => {
  const convs = await db.select().from(chatConversations).orderBy(desc(chatConversations.updatedAt)).limit(50);
  const out = [];
  for (const c of convs) {
    const [last] = await db
      .select({ id: chatMessages.id, sender: chatMessages.sender, body: chatMessages.body, createdAt: chatMessages.createdAt })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, c.id))
      .orderBy(desc(chatMessages.id))
      .limit(1);
    const [{ unread }] = await db
      .select({ unread: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(and(eq(chatMessages.conversationId, c.id), sql`${chatMessages.id} > ${c.lastAdminReadId}`, eq(chatMessages.sender, "visitor")));
    out.push({
      id: c.id,
      page: c.page,
      adminJoined: c.adminJoined,
      updatedAt: c.updatedAt,
      lastVisitorAt: c.lastVisitorAt,
      lastMessage: last ?? null,
      unread,
    });
  }
  res.json({ conversations: out });
});

// GET /chats/:id/messages?after= — full/incremental thread; marks it read.
router.get("/chats/:id/messages", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const conv = (await db.select().from(chatConversations).where(eq(chatConversations.id, id)))[0];
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const after = Number(req.query.after) || 0;
  const rows = await db
    .select({ id: chatMessages.id, sender: chatMessages.sender, body: chatMessages.body, createdAt: chatMessages.createdAt })
    .from(chatMessages)
    .where(and(eq(chatMessages.conversationId, id), gt(chatMessages.id, after)))
    .orderBy(asc(chatMessages.id))
    .limit(500);
  const maxId = rows.length ? rows[rows.length - 1]!.id : conv.lastAdminReadId;
  if (maxId > conv.lastAdminReadId) {
    await db.update(chatConversations).set({ lastAdminReadId: maxId }).where(eq(chatConversations.id, id));
  }
  res.json({ messages: rows, adminJoined: conv.adminJoined });
});

// POST /chats/:id/reply — owner replies; AI goes silent for this conversation.
router.post("/chats/:id/reply", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const text = typeof (req.body as { body?: unknown })?.body === "string" ? ((req.body as { body: string }).body).trim() : "";
  if (!text) { res.status(400).json({ error: "Message is empty." }); return; }
  const conv = (await db.select().from(chatConversations).where(eq(chatConversations.id, id)))[0];
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const [msg] = await db.insert(chatMessages).values({ conversationId: id, sender: "admin", body: text.slice(0, 4000) }).returning();
  await db.update(chatConversations)
    .set({ adminJoined: true, updatedAt: new Date(), lastAdminReadId: msg!.id })
    .where(eq(chatConversations.id, id));
  res.json({ ok: true, message: msg });
});

// POST /chats/:id/release — hand the conversation back to the AI assistant.
router.post("/chats/:id/release", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.update(chatConversations).set({ adminJoined: false, updatedAt: new Date() }).where(eq(chatConversations.id, id));
  res.json({ ok: true });
});

// ---- Buyer testimonials: moderation queue ------------------------------------
// Real reviews submitted by delivered buyers (/review?token=...). Only
// `approved` ones ever render on the public site.

router.get("/testimonials", requireAuth, async (_req, res) => {
  const rows = await db.select().from(testimonials).orderBy(desc(testimonials.createdAt)).limit(200);
  res.json({ testimonials: rows });
});

router.patch("/testimonials/:id", requireAuth, async (req, res) => {
  const status = (req.body as { status?: string })?.status;
  if (status !== "approved" && status !== "hidden" && status !== "pending") {
    res.status(400).json({ error: "status must be approved, hidden, or pending" });
    return;
  }
  const rows = await db.update(testimonials).set({ status }).where(eq(testimonials.id, Number(req.params.id))).returning();
  if (!rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ok: true, testimonial: rows[0] });
});

router.delete("/testimonials/:id", requireAuth, async (req, res) => {
  await db.delete(testimonials).where(eq(testimonials.id, Number(req.params.id)));
  res.json({ ok: true });
});

// ---- Pack orders: the owner's review-and-send queue -------------------------
// Every paid lead-pack order parks at needs_review; nothing reaches the buyer
// until the owner hits Send here.

router.get("/pack-orders", requireAuth, async (_req, res) => {
  const rows = await db.select().from(packOrders).orderBy(desc(packOrders.id)).limit(200);
  res.json({ orders: rows });
});

function packCsvCell(v: unknown): string {
  if (v == null) return "";
  const s = Array.isArray(v) ? v.join("; ") : String(v);
  return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g, '""')}"` : s;
}

// The exact rows the buyer would receive. Snapshotted orders use their frozen
// lead IDs; still-building orders preview the current best matches.
router.get("/pack-orders/:id/preview.csv", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const [order] = Number.isFinite(id) ? await db.select().from(packOrders).where(eq(packOrders.id, id)) : [];
  if (!order) { res.status(404).json({ error: "Order not found." }); return; }

  const ids = (order.leadIds ?? []) as number[];
  const rows = ids.length
    ? await db.select().from(leads).where(inArray(leads.id, ids)).orderBy(sql`value_score DESC, opportunity_score DESC`)
    : await db.select().from(leads).where(packWhere(order)).orderBy(sql`value_score DESC, opportunity_score DESC`).limit(order.requested);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="order-${order.id}-preview.csv"`);
  const headers = ["Name", "Phone", "Emails", "Website", "Facebook", "Instagram", "Twitter", "LinkedIn", "Address", "Category", "Rating", "Reviews", "Opportunity", "Value", "Needs", "Social Intel", "Google Maps URL"];
  let csv = headers.join(",") + "\n";
  for (const r of rows) {
    csv += [r.name, r.phone, r.emails, r.website, r.facebook, r.instagram, r.twitter, r.linkedin, r.address, r.category, r.rating, r.reviewCount, r.opportunityScore, r.valueScore, r.needs, socialScanSummary(r.socialScan), r.gmapsUrl].map(packCsvCell).join(",") + "\n";
  }
  res.send(csv);
});

// The Send button: emails the buyer their download link (refunding any
// shortfall first) and marks the order delivered.
router.post("/pack-orders/:id/send", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Bad order id." }); return; }
  try {
    const order = await sendOrder(id);
    res.json({ ok: true, order });
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : "Send failed." });
  }
});

// ── Captured leads (free-sample email capture) ────────────────────────────────
// The people who unlocked free sample leads with an email. `sample_requests`
// WHERE email IS NOT NULL is the list; the whole table is the sample funnel.

/** GET /api/admin/captured-leads — the captured email list + funnel stats. */
router.get("/captured-leads", requireAuth, async (_req, res) => {
  const rows = await db.select().from(sampleRequests)
    .where(isNotNull(sampleRequests.email))
    .orderBy(desc(sampleRequests.id))
    .limit(500);

  const [[views], [captures]] = await Promise.all([
    db.select({ n: count() }).from(sampleRequests),
    db.select({ n: count() }).from(sampleRequests).where(isNotNull(sampleRequests.email)),
  ]);
  const followedUp = rows.filter(r => r.followedUpAt).length;
  const unsubscribed = rows.filter(r => r.unsubscribedAt).length;

  // Which captured emails have actually bought a pack (matched on Stripe email).
  const emails = Array.from(new Set(rows.map(r => (r.email ?? "").toLowerCase()).filter(Boolean)));
  const buyers = emails.length
    ? await db.select({ email: packOrders.email }).from(packOrders)
        .where(and(isNotNull(packOrders.paidAt), inArray(sql`lower(${packOrders.email})`, emails)))
    : [];
  const bought = new Set(buyers.map(b => (b.email ?? "").toLowerCase()));

  const s = await getOutreachSettings();
  res.json({
    leads: rows.map(r => ({
      id: r.id,
      email: r.email,
      label: r.label,
      location: [r.city, r.state].filter(Boolean).join(", "),
      rawRequest: r.rawRequest,
      sampleCount: (r.leadIds ?? []).length,
      createdAt: r.createdAt,
      unlockedAt: r.unlockedAt,
      followedUpAt: r.followedUpAt,
      unsubscribedAt: r.unsubscribedAt,
      purchased: bought.has((r.email ?? "").toLowerCase()),
    })),
    stats: {
      totalViews: views?.n ?? 0,
      captures: captures?.n ?? 0,
      followedUp,
      unsubscribed,
      purchased: bought.size,
    },
    followupReady: anyProviderConfigured() && providerReady(s),
  });
});

/** GET /api/admin/captured-leads/export.csv — download the captured emails. */
router.get("/captured-leads/export.csv", requireAuth, async (_req, res) => {
  const rows = await db.select().from(sampleRequests)
    .where(isNotNull(sampleRequests.email))
    .orderBy(desc(sampleRequests.id));

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="captured-leads.csv"`);
  const headers = ["Email", "Requested", "City", "State", "Sample Size", "Captured At", "Unlocked At", "Followed Up At", "Unsubscribed At"];
  let csv = headers.join(",") + "\n";
  for (const r of rows) {
    csv += [r.email, r.label, r.city, r.state, (r.leadIds ?? []).length, r.createdAt?.toISOString(), r.unlockedAt?.toISOString(), r.followedUpAt?.toISOString(), r.unsubscribedAt?.toISOString()].map(packCsvCell).join(",") + "\n";
  }
  res.send(csv);
});

/** POST /api/admin/captured-leads/:id/follow-up — send the buyer nudge now. */
router.post("/captured-leads/:id/follow-up", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Bad id." }); return; }
  const r = await sendBuyerFollowup(id);
  if (r.ok) { res.json({ ok: true }); return; }
  const status = r.reason === "no_provider" ? 409 : r.reason === "not_found" ? 404 : 400;
  const msg = r.reason === "no_provider"
    ? "No email provider configured — set up Gmail or Resend in the Automate settings first."
    : r.reason === "already_sent" ? "Already followed up."
    : r.reason === "unsubscribed" ? "This person unsubscribed."
    : r.reason === "no_email" ? "No email on this capture."
    : `Send failed: ${r.reason}`;
  res.status(status).json({ error: msg });
});

export default router;
