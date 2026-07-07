import { Router } from "express";
import { getAuth } from "@clerk/express";
import { createHash } from "node:crypto";
import { db, leads, leadNotes, packOrders, computeScore, computeOpportunity, computeDemand, computeValue } from "@workspace/db";
import { sql, ilike, or, gte, and, count, eq, ne, inArray, isNull, type SQL } from "drizzle-orm";
import { storage } from "../storage";
import { getUncachableStripeClient } from "../stripeClient";
import { discoverBusinesses } from "../lib/discover";
import { generateOutreach } from "../lib/outreach";
import { getOutreachSettings, enrollLeads } from "../lib/outreach-auto";

const router = Router();

// ---- Helpers ----------------------------------------------------------------

function extractSocial(socialRaw: string, pattern: RegExp): string | null {
  const m = socialRaw.match(pattern);
  return m ? m[0] : null;
}

function parseSocials(raw: string | null | undefined): {
  social: string | null;
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  linkedin: string | null;
} {
  if (!raw) return { social: null, facebook: null, instagram: null, twitter: null, linkedin: null };
  const facebook = extractSocial(raw, /https?:\/\/(?:www\.)?facebook\.com\/[^\s,\n"'<>]+/i);
  const instagram = extractSocial(raw, /https?:\/\/(?:www\.)?instagram\.com\/[^\s,\n"'<>]+/i);
  const twitter = extractSocial(raw, /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s,\n"'<>]+/i);
  const linkedin = extractSocial(raw, /https?:\/\/(?:www\.)?linkedin\.com\/[^\s,\n"'<>]+/i);
  const social = [facebook, instagram, twitter, linkedin].filter(Boolean).join(", ") || raw || null;
  return { social, facebook, instagram, twitter, linkedin };
}

function parseReviewCount(ratingInfo: string | undefined | null): number | null {
  if (!ratingInfo) return null;
  const m = ratingInfo.match(/[\d,]+/);
  if (!m) return null;
  return parseInt(m[0].replace(/,/g, ""), 10) || null;
}

const VALID_STATUSES = ["new", "contacted", "converted", "not_interested"] as const;
type LeadStatus = typeof VALID_STATUSES[number];

// Whitelisted sort columns (avoids SQL injection from the `sort` query param).
const SORT_COLUMNS: Record<string, string> = {
  value: "value_score",            // most valuable = need × demand
  demand: "demand_score",          // most wanted by members
  opportunity: "opportunity_score", // weakest businesses (most need)
  score: "score",                  // profile completeness (default)
};
function orderForSort(sort: string) {
  const col = SORT_COLUMNS[sort] ?? "score";
  return sql.raw(`${col} DESC, created_at DESC`);
}

// ---- CORS — extension calls /save cross-origin, must allow * ----------------
router.options("/save", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Api-Key");
  res.status(204).end();
});

// Score, dedupe and upsert a batch of raw lead objects, attributing them to a
// member when known. Shared by the extension's /save and the AI /find flow.
async function saveLeadBatch(batch: Record<string, unknown>[], memberId: string | null): Promise<{ saved: number; duplicates: number }> {
  let saved = 0;
  let duplicates = 0;

  const rows = batch.map((lead: Record<string, unknown>) => {
    const name = String(lead["Name"] ?? lead["name"] ?? "");
    const phone = String(lead["Phone"] ?? lead["phone"] ?? "");
    const emailsRaw = lead["Emails"] ?? lead["emails"] ?? "";
    const emails = Array.isArray(emailsRaw) ? emailsRaw.join(", ") : String(emailsRaw ?? "");
    const website = String(lead["Website"] ?? lead["website"] ?? "");
    const socialRaw = String(lead["Social Medias"] ?? lead["social"] ?? "");
    const address = String(lead["Address"] ?? lead["address"] ?? "");
    const category = String(lead["Category"] ?? lead["category"] ?? "");
    const ratingRaw = lead["Rating"] ?? lead["rating"];
    const rating = ratingRaw != null ? parseFloat(String(ratingRaw)) : null;
    const ratingInfo = String(lead["Rating info"] ?? lead["ratingInfo"] ?? "");
    const reviewCount = parseReviewCount(ratingInfo);
    const gmapsUrl = String(lead["Google Maps URL"] ?? lead["gmapsUrl"] ?? "");
    const plusCode = String(lead["Plus Code"] ?? lead["plusCode"] ?? "");

    const key = createHash("sha256").update(name + phone + address).digest("hex");
    const { social, facebook, instagram, twitter, linkedin } = parseSocials(socialRaw || null);
    const ratingNum = (rating != null && !isNaN(rating)) ? rating : null;

    const scoreable = {
      phone: phone || null,
      emails: emails || null,
      website: website || null,
      facebook,
      instagram,
      twitter,
      linkedin,
      rating: ratingNum,
      reviewCount,
      category: category || null,
    };
    const score = computeScore(scoreable);
    const { opportunityScore, needs } = computeOpportunity(scoreable);

    return {
      key,
      clerkUserId: memberId,
      name: name || null,
      phone: phone || null,
      emails: emails || null,
      website: website || null,
      social,
      facebook,
      instagram,
      twitter,
      linkedin,
      address: address || null,
      category: category || null,
      rating: ratingNum != null ? String(ratingNum) : null,
      reviewCount,
      score,
      opportunityScore,
      needs,
      gmapsUrl: gmapsUrl || null,
      plusCode: plusCode || null,
      raw: lead,
      updatedAt: new Date(),
    };
  });

  for (const row of rows) {
    const [before] = await db
      .select({
        id: leads.id,
        extractedBy: leads.extractedBy,
        timesExtracted: leads.timesExtracted,
        clerkUserId: leads.clerkUserId,
      })
      .from(leads)
      .where(sql`key = ${row.key}`)
      .limit(1);

    // Merge demand: distinct members who've extracted this business + a running
    // count of total extractions. Recompute demand + value from the new totals.
    const prevMembers = (before?.extractedBy ?? []) as string[];
    const extractedBy = memberId && !prevMembers.includes(memberId)
      ? [...prevMembers, memberId]
      : prevMembers;
    const timesExtracted = (before?.timesExtracted ?? 0) + 1;
    const demandScore = computeDemand({ timesExtracted, distinctMembers: extractedBy.length });
    const valueScore = computeValue(row.opportunityScore, demandScore);
    // Preserve the original extractor; only fall back to current member if none.
    const clerkUserId = before?.clerkUserId ?? memberId;

    const values = { ...row, clerkUserId, extractedBy, timesExtracted, demandScore, valueScore };

    await db
      .insert(leads)
      .values(values)
      .onConflictDoUpdate({
        target: leads.key,
        set: {
          name: sql`excluded.name`,
          phone: sql`excluded.phone`,
          emails: sql`excluded.emails`,
          website: sql`excluded.website`,
          social: sql`excluded.social`,
          facebook: sql`excluded.facebook`,
          instagram: sql`excluded.instagram`,
          twitter: sql`excluded.twitter`,
          linkedin: sql`excluded.linkedin`,
          address: sql`excluded.address`,
          category: sql`excluded.category`,
          rating: sql`excluded.rating`,
          reviewCount: sql`excluded.review_count`,
          score: sql`excluded.score`,
          opportunityScore: sql`excluded.opportunity_score`,
          needs: sql`excluded.needs`,
          clerkUserId: sql`excluded.clerk_user_id`,
          extractedBy: sql`excluded.extracted_by`,
          timesExtracted: sql`excluded.times_extracted`,
          demandScore: sql`excluded.demand_score`,
          valueScore: sql`excluded.value_score`,
          gmapsUrl: sql`excluded.gmaps_url`,
          plusCode: sql`excluded.plus_code`,
          raw: sql`excluded.raw`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    if (before) duplicates++;
    else saved++;
  }

  return { saved, duplicates };
}

// ---- POST /save — no auth, no limits ----------------------------------------
router.post("/save", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const body = req.body;
  if (!Array.isArray(body) || body.length === 0) {
    res.status(400).json({ error: "Expected non-empty array of leads" });
    return;
  }

  // Resolve which member is extracting (extension sends their API key). This is
  // what lets us track member activity + per-lead demand. Anonymous if absent.
  const apiKey = String(req.headers["x-api-key"] ?? "").trim();
  const member = apiKey ? await storage.getUserByApiKey(apiKey) : null;

  const { saved, duplicates } = await saveLeadBatch(body.slice(0, 1000), member?.id ?? null);

  req.log.info({ saved, duplicates }, "leads saved");
  res.json({ saved, duplicates, syncedAt: new Date().toISOString() });
});

// ---- POST /find — AI Lead Finder for members ---------------------------------
// The customer describes who they want to reach in plain English; live
// web-search AI finds real matching businesses and saves them straight into
// their lead list. Daily-capped per member (higher cap for Pro).
const FIND_LIMIT_FREE = 3;
const FIND_LIMIT_PRO = 25;
const findUsage = new Map<string, { day: string; used: number }>();

router.post("/find", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Sign in to use the AI Lead Finder." });
    return;
  }

  const goal = String((req.body as { goal?: string })?.goal ?? "").trim();
  if (goal.length < 8) {
    res.status(400).json({ error: "Describe who you're looking for — e.g. \"roofing companies in Mobile AL with no website\"." });
    return;
  }

  // Daily quota — Pro members get a much higher cap.
  const user = await storage.getUser(userId);
  const sub = user?.stripeCustomerId ? await storage.getActiveSubscriptionForCustomer(user.stripeCustomerId) : null;
  const isPro = !!sub;
  const limit = isPro ? FIND_LIMIT_PRO : FIND_LIMIT_FREE;
  const today = new Date().toISOString().slice(0, 10);
  const usage = findUsage.get(userId);
  const used = usage?.day === today ? usage.used : 0;
  if (used >= limit) {
    res.status(429).json({
      error: isPro
        ? `You've used all ${limit} AI searches for today — more unlock tomorrow.`
        : `You've used your ${limit} free AI searches for today. Upgrade to Pro for ${FIND_LIMIT_PRO} searches a day.`,
      upgrade: !isPro,
      used, limit,
    });
    return;
  }

  let found;
  try {
    found = await discoverBusinesses(goal, 15);
  } catch (err) {
    req.log.error({ err, userId, goal }, "ai lead find failed");
    const msg = err instanceof Error ? err.message : "";
    res.status(502).json({
      error: /key/i.test(msg)
        ? "The AI Lead Finder isn't available right now — we're on it. Please try again later."
        : "The AI search didn't come back — please try again in a minute.",
    });
    return;
  }
  // A successful-but-empty search still counts toward the quota (it cost an AI call).
  findUsage.set(userId, { day: today, used: used + 1 });

  if (found.length === 0) {
    res.json({ found: 0, saved: 0, duplicates: 0, businesses: [], used: used + 1, limit });
    return;
  }

  const rows = found.map((b) => ({
    Name: b.name,
    Phone: b.phone ?? "",
    Website: b.website ?? "",
    Address: [b.city, b.state].filter(Boolean).join(", "),
    Category: b.category || goal.slice(0, 80),
  }));
  const { saved, duplicates } = await saveLeadBatch(rows, userId);

  req.log.info({ userId, goal, found: found.length, saved }, "ai lead find done");
  res.json({ found: found.length, saved, duplicates, businesses: found, used: used + 1, limit });
});

// ---- GET / — paginated list --------------------------------------------------
router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const search = String(req.query.search ?? "").trim();
  const minScore = parseInt(String(req.query.minScore ?? "0"), 10) || 0;
  const minOpportunity = parseInt(String(req.query.minOpportunity ?? "0"), 10) || 0;
  const category = String(req.query.category ?? "").trim();
  const status = String(req.query.status ?? "").trim();
  // sort = value | demand | opportunity | score (default). value = need × demand.
  const sort = String(req.query.sort ?? "");
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [isNull(leads.deletedAt)];
  if (search) {
    conditions.push(or(ilike(leads.name, `%${search}%`), ilike(leads.address, `%${search}%`))!);
  }
  if (minScore > 0) conditions.push(gte(leads.score, minScore));
  if (minOpportunity > 0) conditions.push(gte(leads.opportunityScore, minOpportunity));
  if (category) conditions.push(ilike(leads.category, `%${category}%`));
  // An unknown status must be an error, not silently ignored — ignoring it once
  // caused the SMS import to pull EVERY phone number instead of a subset.
  if (status && !VALID_STATUSES.includes(status as LeadStatus)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    return;
  }
  if (status) conditions.push(eq(leads.status, status));
  // exclude=contacted hides leads already in the follow-up queue from the main
  // working list (status may be NULL on old rows, which also means "new").
  const exclude = String(req.query.exclude ?? "").trim();
  if (exclude && !VALID_STATUSES.includes(exclude as LeadStatus)) {
    res.status(400).json({ error: `exclude must be one of: ${VALID_STATUSES.join(", ")}` });
    return;
  }
  if (exclude) conditions.push(or(isNull(leads.status), ne(leads.status, exclude))!);

  const where = and(...conditions)!;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(leads).where(where).orderBy(orderForSort(sort)).limit(limit).offset(offset),
    db.select({ total: count() }).from(leads).where(where),
  ]);

  res.json({ leads: rows, total: Number(total), page, pages: Math.ceil(Number(total) / limit) || 1 });
});

// ---- GET /stats — charts data -----------------------------------------------
router.get("/stats", async (_req, res) => {
  const [scoreRows, categoryRows, statusRows, lastRow, opportunityRows, needsRows, followUpRows] = await Promise.all([
    db.execute(sql`
      SELECT
        CASE
          WHEN score >= 80 THEN 'High (80+)'
          WHEN score >= 50 THEN 'Medium (50-79)'
          ELSE 'Low (<50)'
        END AS bucket,
        COUNT(*) AS cnt
      FROM leads
      GROUP BY bucket
    `),
    db.execute(sql`
      SELECT category, COUNT(*) AS cnt
      FROM leads
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY cnt DESC
      LIMIT 10
    `),
    db.execute(sql`
      SELECT COALESCE(status, 'new') AS status, COUNT(*) AS cnt
      FROM leads
      GROUP BY status
    `),
    db.execute(sql`SELECT MAX(updated_at) AS last_synced FROM leads`),
    db.execute(sql`
      SELECT
        CASE
          WHEN opportunity_score >= 70 THEN 'Hot (70+)'
          WHEN opportunity_score >= 40 THEN 'Warm (40-69)'
          ELSE 'Cold (<40)'
        END AS bucket,
        COUNT(*) AS cnt
      FROM leads
      GROUP BY bucket
    `),
    db.execute(sql`
      SELECT need AS need, COUNT(*) AS cnt
      FROM leads, jsonb_array_elements_text(COALESCE(needs, '[]'::jsonb)) AS need
      GROUP BY need
      ORDER BY cnt DESC
    `),
    // Contacted leads whose NEXT follow-up touch is due. outreach_step counts
    // touches sent (1 = first email), so the next touch is followUps[step-1];
    // leads with no AI sequence default to a 3-day wait after the first email.
    db.execute(sql`
      SELECT COUNT(*) AS cnt
      FROM leads
      WHERE deleted_at IS NULL
        AND status = 'contacted'
        AND contacted_at IS NOT NULL
        AND NOW() >= contacted_at + make_interval(days =>
          COALESCE(
            (outreach->'followUps'->(GREATEST(COALESCE(outreach_step, 1), 1) - 1)->>'day')::int,
            CASE WHEN GREATEST(COALESCE(outreach_step, 1), 1) = 1 THEN 3 ELSE NULL END
          ))
    `),
  ]);

  // Order opportunity buckets Hot → Warm → Cold for stable chart coloring.
  const oppOrder = ["Hot (70+)", "Warm (40-69)", "Cold (<40)"];
  const oppRaw = (opportunityRows.rows as { bucket: string; cnt: string }[]).map(r => ({ bucket: r.bucket, count: Number(r.cnt) }));

  res.json({
    scoreDistribution: (scoreRows.rows as { bucket: string; cnt: string }[]).map(r => ({ bucket: r.bucket, count: Number(r.cnt) })),
    opportunityDistribution: oppOrder.map(b => ({ bucket: b, count: oppRaw.find(r => r.bucket === b)?.count ?? 0 })).filter(r => r.count > 0),
    needsCounts: (needsRows.rows as { need: string; cnt: string }[]).map(r => ({ need: r.need, count: Number(r.cnt) })),
    topCategories: (categoryRows.rows as { category: string; cnt: string }[]).map(r => ({ category: r.category, count: Number(r.cnt) })),
    statusCounts: (statusRows.rows as { status: string; cnt: string }[]).map(r => ({ status: r.status, count: Number(r.cnt) })),
    followUpReady: Number((followUpRows.rows[0] as { cnt: string })?.cnt ?? 0),
    lastSyncedAt: (lastRow.rows[0] as { last_synced: string | null })?.last_synced ?? null,
  });
});

// ---- GET /notes?ids=1,2,3 — the current member's private notes + tags --------
router.get("/notes", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.json({ notes: {} }); return; }

  const ids = String(req.query.ids ?? "")
    .split(",").map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n > 0);
  if (ids.length === 0) { res.json({ notes: {} }); return; }

  const rows = await db
    .select({ leadId: leadNotes.leadId, note: leadNotes.note, tags: leadNotes.tags, reminderAt: leadNotes.reminderAt, reminderDone: leadNotes.reminderDone })
    .from(leadNotes)
    .where(and(eq(leadNotes.clerkUserId, userId), inArray(leadNotes.leadId, ids)));

  const notes: Record<number, { note: string | null; tags: string[]; reminderAt: string | null; reminderDone: boolean }> = {};
  for (const r of rows) notes[r.leadId] = {
    note: r.note, tags: (r.tags ?? []) as string[],
    reminderAt: r.reminderAt ? new Date(r.reminderAt).toISOString() : null,
    reminderDone: !!r.reminderDone,
  };
  res.json({ notes });
});

// ---- GET /reminders — the member's open follow-ups (with lead info) ----------
router.get("/reminders", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.json({ reminders: [] }); return; }

  const rows = await db
    .select({
      leadId: leadNotes.leadId, reminderAt: leadNotes.reminderAt, note: leadNotes.note,
      name: leads.name, phone: leads.phone, emails: leads.emails,
    })
    .from(leadNotes)
    .innerJoin(leads, eq(leads.id, leadNotes.leadId))
    .where(and(
      eq(leadNotes.clerkUserId, userId),
      eq(leadNotes.reminderDone, false),
      sql`${leadNotes.reminderAt} IS NOT NULL`,
    ))
    .orderBy(sql`reminder_at ASC`)
    .limit(100);

  res.json({
    reminders: rows.map(r => ({
      leadId: r.leadId,
      reminderAt: r.reminderAt ? new Date(r.reminderAt).toISOString() : null,
      note: r.note, name: r.name, phone: r.phone, emails: r.emails,
    })),
  });
});

// ---- PUT /:id/note — upsert the current member's note + tags on a lead -------
router.put("/:id/note", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to save notes" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = req.body as { note?: string; tags?: unknown; reminderAt?: string | null; reminderDone?: boolean };
  const note = typeof body.note === "string" ? body.note.slice(0, 5000) : null;
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 20))]
    : [];
  const reminderAt = body.reminderAt ? new Date(body.reminderAt) : null;
  const reminderDone = !!body.reminderDone;

  await db
    .insert(leadNotes)
    .values({ leadId: id, clerkUserId: userId, note, tags, reminderAt, reminderDone, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [leadNotes.leadId, leadNotes.clerkUserId],
      set: {
        note: sql`excluded.note`, tags: sql`excluded.tags`,
        reminderAt: sql`excluded.reminder_at`, reminderDone: sql`excluded.reminder_done`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  res.json({ ok: true, id, note, tags, reminderAt: reminderAt?.toISOString() ?? null, reminderDone });
});

// ---- PATCH /:id/status — update lead status ----------------------------------
router.patch("/:id/status", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { status } = req.body as { status: string };
  if (!VALID_STATUSES.includes(status as LeadStatus)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    return;
  }

  const now = new Date();
  if (status === "contacted") {
    // First email went out: stamp contactedAt (once) and enter the follow-up
    // queue at step 1. Re-marking an already-contacted lead keeps its clock.
    await db.update(leads).set({
      status,
      contactedAt: sql`COALESCE(${leads.contactedAt}, ${now})`,
      outreachStep: sql`GREATEST(COALESCE(${leads.outreachStep}, 0), 1)`,
      updatedAt: now,
    }).where(eq(leads.id, id));
  } else if (status === "new") {
    // Moving back to "new" resets the follow-up clock.
    await db.update(leads).set({ status, contactedAt: null, outreachStep: 0, updatedAt: now }).where(eq(leads.id, id));
  } else {
    await db.update(leads).set({ status, updatedAt: now }).where(eq(leads.id, id));
  }
  // If auto-enroll-on-contact is on, hand the freshly-contacted lead to the
  // engine so its follow-ups then send themselves (scheduled at the right day
  // offset — this never re-sends the first email).
  if (status === "contacted") {
    try {
      const s = await getOutreachSettings();
      if (s.autoEnrollOnContact && s.enabled) await enrollLeads([id]);
    } catch { /* enrollment is best-effort; the manual queue still works */ }
  }
  const [row] = await db.select({ contactedAt: leads.contactedAt, outreachStep: leads.outreachStep, autoOutreach: leads.autoOutreach, nextEmailAt: leads.nextEmailAt }).from(leads).where(eq(leads.id, id));
  res.json({ ok: true, id, status, contactedAt: row?.contactedAt ?? null, outreachStep: row?.outreachStep ?? 0, autoOutreach: row?.autoOutreach ?? false, nextEmailAt: row?.nextEmailAt ?? null });
});

// ---- POST /:id/advance-step — mark the next follow-up touch as sent ----------
// outreachStep counts touches sent: 1 = first email, 2 = follow-up 1, etc.
router.post("/:id/advance-step", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), isNull(leads.deletedAt)));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  const now = new Date();
  const nextStep = Math.max(1, (lead.outreachStep ?? 0)) + 1;
  await db.update(leads).set({
    status: "contacted",
    contactedAt: lead.contactedAt ?? now,
    outreachStep: nextStep,
    updatedAt: now,
  }).where(eq(leads.id, id));
  res.json({ ok: true, id, outreachStep: nextStep });
});

// ---- POST /outreach/bulk — generate AI outreach for many leads --------------
// Registered BEFORE /:id/outreach so "outreach" isn't captured as :id.
router.post("/outreach/bulk", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to generate outreach" }); return; }

  const { ids, force } = req.body as { ids?: unknown; force?: boolean };
  const validIds = Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 25) : [];
  if (validIds.length === 0) { res.status(400).json({ error: "ids must be a non-empty array (max 25)" }); return; }

  const settings = await getOutreachSettings();
  const sender = { name: settings.fromName, offer: settings.offer };

  const rows = await db.select().from(leads).where(and(inArray(leads.id, validIds), isNull(leads.deletedAt)));
  const results: { id: number; ok: boolean; error?: string }[] = [];
  // Sequential to stay within AI rate limits and keep memory flat.
  for (const lead of rows) {
    if (lead.outreach && !force) { results.push({ id: lead.id, ok: true }); continue; }
    try {
      const outreach = await generateOutreach(lead, sender);
      await db.update(leads).set({ outreach, outreachAt: new Date(), updatedAt: new Date() }).where(eq(leads.id, lead.id));
      results.push({ id: lead.id, ok: true });
    } catch (err) {
      results.push({ id: lead.id, ok: false, error: err instanceof Error ? err.message : "failed" });
    }
  }
  res.json({ ok: true, generated: results.filter((r) => r.ok).length, results });
});

// ---- POST /:id/outreach — generate (or return cached) AI outreach for a lead -
router.post("/:id/outreach", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign in to generate outreach" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const force = !!(req.body as { force?: boolean })?.force;

  const [lead] = await db.select().from(leads).where(and(eq(leads.id, id), isNull(leads.deletedAt)));
  if (!lead) { res.status(404).json({ error: "Lead not found" }); return; }

  if (lead.outreach && !force) {
    res.json({ ok: true, id, outreach: lead.outreach, outreachAt: lead.outreachAt, cached: true });
    return;
  }
  const settings = await getOutreachSettings();
  try {
    const outreach = await generateOutreach(lead, { name: settings.fromName, offer: settings.offer });
    const at = new Date();
    await db.update(leads).set({ outreach, outreachAt: at, updatedAt: at }).where(eq(leads.id, id));
    res.json({ ok: true, id, outreach, outreachAt: at, cached: false });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Outreach generation failed" });
  }
});

// ---- DELETE /bulk — soft-delete multiple leads ------------------------------
// Registered BEFORE /:id — otherwise Express matches "bulk" as :id and 400s.
router.delete("/bulk", async (req, res) => {
  const { ids } = req.body as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" });
    return;
  }
  const validIds = ids.map(Number).filter(n => !isNaN(n) && n > 0);
  await db.execute(sql`UPDATE leads SET deleted_at = NOW() WHERE id = ANY(${sql.raw(`ARRAY[${validIds.join(",")}]::int[]`)})`);
  res.json({ ok: true, deleted: validIds.length });
});

// ---- DELETE /:id — soft-delete a lead (recoverable from admin) --------------
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(leads).set({ deletedAt: new Date() }).where(eq(leads.id, id));
  res.json({ ok: true, id });
});

// ---- GET /export.csv — download CSV -----------------------------------------
router.get("/export.csv", async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const minScore = parseInt(String(req.query.minScore ?? "0"), 10) || 0;
  const minOpportunity = parseInt(String(req.query.minOpportunity ?? "0"), 10) || 0;
  const category = String(req.query.category ?? "").trim();
  const status = String(req.query.status ?? "").trim();
  const state = String(req.query.state ?? "").trim().toUpperCase();
  const sort = String(req.query.sort ?? "");

  const conditions: SQL[] = [isNull(leads.deletedAt)];
  if (search) conditions.push(or(ilike(leads.name, `%${search}%`), ilike(leads.address, `%${search}%`))!);
  if (minScore > 0) conditions.push(gte(leads.score, minScore));
  if (minOpportunity > 0) conditions.push(gte(leads.opportunityScore, minOpportunity));
  if (category) conditions.push(ilike(leads.category, `%${category}%`));
  // Territory filter: match "<STATE> <ZIP>" inside the address (word-boundary).
  if (/^[A-Z]{2}$/.test(state)) conditions.push(sql`address ~ ${"\\y" + state + "\\s+\\d{5}"}`);
  if (status && VALID_STATUSES.includes(status as LeadStatus)) conditions.push(eq(leads.status, status));

  const rows = await db.select().from(leads).where(and(...conditions)!).orderBy(orderForSort(sort));

  const dateStr = new Date().toISOString().slice(0, 10);
  const isMoney = sort === "opportunity" || sort === "value" || sort === "demand" || minOpportunity > 0;
  const catSlug = category ? category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "";
  const stateSlug = /^[A-Z]{2}$/.test(state) ? state.toLowerCase() : "";
  const slug = [catSlug, stateSlug].filter(Boolean).join("-");
  const filename = isMoney
    ? `money-leads${slug ? `-${slug}` : ""}-${dateStr}.csv`
    : `leads${slug ? `-${slug}` : ""}-${dateStr}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  function csvCell(v: unknown): string {
    if (v == null) return "";
    const s = Array.isArray(v) ? v.join("; ") : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  const headers = ["Name","Phone","Emails","Website","Facebook","Instagram","Twitter","LinkedIn","Address","Category","Rating","Reviews","Score","Opportunity","Value","Demand","Members","Times Extracted","Needs","Status","Google Maps URL","Plus Code"];
  let csv = headers.join(",") + "\n";
  for (const row of rows) {
    const members = Array.isArray(row.extractedBy) ? row.extractedBy.length : 0;
    csv += [row.name,row.phone,row.emails,row.website,row.facebook,row.instagram,row.twitter,row.linkedin,row.address,row.category,row.rating,row.reviewCount,row.score,row.opportunityScore,row.valueScore,row.demandScore,members,row.timesExtracted,row.needs,row.status,row.gmapsUrl,row.plusCode].map(csvCell).join(",") + "\n";
  }

  req.log.info({ rows: rows.length, money: isMoney }, "leads exported to csv");
  res.send(csv);
});

// ---- Sell packs: paid CSV download gated by a Stripe Checkout session --------
function csvCellSafe(v: unknown): string {
  if (v == null) return "";
  const s = Array.isArray(v) ? v.join("; ") : String(v);
  return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /pack-success — friendly page Stripe redirects to after payment.
router.get("/pack-success", (req, res) => {
  const sessionId = String(req.query.session_id ?? "");
  const dl = `/api/leads/pack-download?session_id=${encodeURIComponent(sessionId)}`;
  res.setHeader("Content-Type", "text/html");
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Your leads are ready</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{background:#0b0f14;color:#e6edf3;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#111722;border:1px solid #21262d;border-radius:16px;padding:40px;text-align:center;max-width:420px}
.btn{display:inline-block;margin-top:20px;background:#00e676;color:#0b0f14;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none}
h1{font-size:22px}p{color:#8b949e}</style></head>
<body><div class="card"><div style="font-size:42px">✅</div><h1>Payment received</h1>
<p>Thanks! Your lead pack is ready to download.</p>
<a class="btn" href="${dl}">⬇ Download leads CSV</a>
<p style="font-size:12px;margin-top:18px">Keep this page — you can re-download anytime from this link.</p></div></body></html>`);
});

// GET /pack-download — verifies the session is paid, then streams the pack CSV.
router.get("/pack-download", async (req, res) => {
  const sessionId = String(req.query.session_id ?? "");
  if (!sessionId) { res.status(400).send("Missing session_id"); return; }

  let paid = false;
  let meta: Record<string, string> = {};
  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    paid = session.payment_status === "paid";
    meta = (session.metadata ?? {}) as Record<string, string>;
  } catch {
    res.status(400).send("Could not verify payment.");
    return;
  }
  if (!paid) { res.status(402).send("Payment not completed."); return; }

  const category = meta.pack_category ?? "";
  const state = (meta.pack_state ?? "").toUpperCase();
  const city = meta.pack_city ?? "";
  const minOpp = parseInt(meta.pack_min_opp ?? "0", 10) || 0;
  // Fixed-size packs (e.g. the $29 / 100-lead pack) set pack_limit; admin-sold
  // packs without it deliver everything matching the filters.
  const packLimit = parseInt(meta.pack_limit ?? "0", 10) || 0;

  const conditions: SQL[] = [isNull(leads.deletedAt)];
  if (category) conditions.push(ilike(leads.category, `%${category}%`));
  if (city) conditions.push(ilike(leads.address, `%${city}%`));
  if (/^[A-Z]{2}$/.test(state)) conditions.push(sql`address ~ ${"\\y" + state + "\\s+\\d{5}"}`);
  if (minOpp > 0) conditions.push(gte(leads.opportunityScore, minOpp));
  const baseQuery = db.select().from(leads).where(and(...conditions)!).orderBy(sql`value_score DESC, opportunity_score DESC`);
  const rows = packLimit > 0 ? await baseQuery.limit(packLimit) : await baseQuery;

  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="lead-pack-${dateStr}.csv"`);
  const headers = ["Name", "Phone", "Emails", "Website", "Facebook", "Instagram", "Twitter", "LinkedIn", "Address", "Category", "Rating", "Reviews", "Opportunity", "Value", "Needs", "Google Maps URL"];
  let csv = headers.join(",") + "\n";
  for (const r of rows) {
    csv += [r.name, r.phone, r.emails, r.website, r.facebook, r.instagram, r.twitter, r.linkedin, r.address, r.category, r.rating, r.reviewCount, r.opportunityScore, r.valueScore, r.needs, r.gmapsUrl].map(csvCellSafe).join(",") + "\n";
  }
  req.log.info({ rows: rows.length, category, state }, "paid pack downloaded");
  res.send(csv);
});

// ---- Build-to-order packs: token-gated status page + CSV download -----------

// GET /pack-order-received — the page Stripe redirects a BUILD buyer to after
// payment. Their leads aren't ready yet (the worker gathers them async), so
// this just confirms the order and tells them to watch their email.
router.get("/pack-order-received", async (req, res) => {
  const token = String(req.query.token ?? "");
  const [order] = token ? await db.select().from(packOrders).where(eq(packOrders.token, token)) : [];
  res.setHeader("Content-Type", "text/html");
  if (!order) { res.status(404).send("<p>Order not found.</p>"); return; }
  const ready = order.status === "ready" || order.status === "partial";
  const dl = `/api/leads/pack-order-download?token=${encodeURIComponent(token)}`;
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Order received</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{background:#0b0f14;color:#e6edf3;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#111722;border:1px solid #21262d;border-radius:16px;padding:40px;text-align:center;max-width:440px}
.btn{display:inline-block;margin-top:20px;background:#00e676;color:#0b0f14;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none}
h1{font-size:22px}p{color:#8b949e;line-height:1.6}</style></head>
<body><div class="card"><div style="font-size:42px">${ready ? "✅" : "⏳"}</div>
<h1>${ready ? "Your leads are ready" : "Order received — we're on it"}</h1>
${ready
  ? `<p>Your lead pack is ready to download.</p><a class="btn" href="${dl}">⬇ Download leads CSV</a>`
  : `<p>Thanks! We're putting together <strong>100 ${order.label || "local business"} leads</strong>${order.city || order.state ? ` in ${[order.city, order.state].filter(Boolean).join(", ")}` : ""} for you now — every pack gets a human quality check before it ships. We'll email your CSV download link${order.email ? ` to <strong>${order.email}</strong>` : ""} usually within a few hours (24 hours max). If we come up short, we'll automatically refund the difference.</p>`}
<p style="font-size:12px;margin-top:18px">Order ref: ${order.token.slice(0, 8)}</p></div></body></html>`);
});

// GET /pack-order-download — streams a build order's snapshotted CSV, gated by
// its unguessable token (the link we email the buyer). Works once fulfilled.
router.get("/pack-order-download", async (req, res) => {
  const token = String(req.query.token ?? "");
  const [order] = token ? await db.select().from(packOrders).where(eq(packOrders.token, token)) : [];
  if (!order) { res.status(404).send("Order not found."); return; }
  if (order.status !== "ready" && order.status !== "partial") {
    res.status(425).send("Your leads aren't ready yet — we'll email you the moment they are.");
    return;
  }
  const ids = (order.leadIds ?? []) as number[];
  const rows = ids.length
    ? await db.select().from(leads).where(inArray(leads.id, ids)).orderBy(sql`value_score DESC, opportunity_score DESC`)
    : [];

  const dateStr = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="lead-pack-${order.token.slice(0, 8)}-${dateStr}.csv"`);
  const headers = ["Name", "Phone", "Emails", "Website", "Facebook", "Instagram", "Twitter", "LinkedIn", "Address", "Category", "Rating", "Reviews", "Opportunity", "Value", "Needs", "Google Maps URL"];
  let csv = headers.join(",") + "\n";
  for (const r of rows) {
    csv += [r.name, r.phone, r.emails, r.website, r.facebook, r.instagram, r.twitter, r.linkedin, r.address, r.category, r.rating, r.reviewCount, r.opportunityScore, r.valueScore, r.needs, r.gmapsUrl].map(csvCellSafe).join(",") + "\n";
  }
  req.log.info({ orderId: order.id, rows: rows.length, status: order.status }, "build pack downloaded");
  res.send(csv);
});

export default router;
