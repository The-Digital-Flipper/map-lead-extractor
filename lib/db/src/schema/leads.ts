import { pgTable, serial, text, numeric, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  key: text("key").unique().notNull(),
  clerkUserId: text("clerk_user_id"),
  name: text("name"),
  phone: text("phone"),
  emails: text("emails"),
  website: text("website"),
  social: text("social"),
  facebook: text("facebook"),
  instagram: text("instagram"),
  twitter: text("twitter"),
  linkedin: text("linkedin"),
  address: text("address"),
  category: text("category"),
  rating: numeric("rating"),
  reviewCount: integer("review_count"),
  score: integer("score").default(0),
  // Opportunity score (0-100): HIGH = weak online presence + reachable =
  // a prime business to sell websites / SEO / ads / reputation / automation to.
  // This is the inverse intent of `score` (which measures profile completeness).
  opportunityScore: integer("opportunity_score").default(0),
  // Human-readable weakness tags backing the opportunity score, e.g.
  // ["No website", "Few reviews", "No social"]. Drives the sales pitch.
  needs: jsonb("needs").$type<string[]>().default([]),
  // ── Demand signals (how much members want this lead) ──────────────────────
  // Total number of times any member extracted/saved this business.
  timesExtracted: integer("times_extracted").default(1),
  // Distinct member (clerk user) ids that have extracted this business.
  // Length = how many different members independently wanted it.
  extractedBy: jsonb("extracted_by").$type<string[]>().default([]),
  // Demand score 0-100 derived from the two signals above.
  demandScore: integer("demand_score").default(0),
  // Composite value 0-100 = need (opportunity) blended with demand. The single
  // "which leads are most valuable" ranking number.
  valueScore: integer("value_score").default(0),
  // ── Enrichment (from crawling the lead's website) ─────────────────────────
  enrichedAt: timestamp("enriched_at", { withTimezone: true }),
  siteLive: boolean("site_live"),       // website actually loads
  siteMobile: boolean("site_mobile"),   // has a mobile viewport (modern-ish)
  hasBooking: boolean("has_booking"),   // online booking link detected
  // Website-builder platform fingerprinted from the HTML, e.g. "Wix",
  // "GoDaddy", "Squarespace", "WordPress", "Shopify". DIY builders (Wix/GoDaddy/
  // Weebly) are a strong "sell them a real site" hook. null = couldn't tell.
  sitePlatform: text("site_platform"),
  // Copyright year found in the footer (e.g. 2016). Old year = stale site = hook.
  siteYear: integer("site_year"),
  // Google Ads / Meta Pixel tags present = they ALREADY spend on marketing
  // (warm, higher-budget lead), false = no ad tracking detected.
  runsAds: boolean("runs_ads"),
  gmapsUrl: text("gmaps_url"),
  plusCode: text("plus_code"),
  raw: jsonb("raw"),
  // ── AI lead intelligence (from the analyze pass) ──────────────────────────
  // High-ticket = AI judged this a big-money client worth prioritizing.
  highTicket: boolean("high_ticket").default(false),
  // Short sales bio for high-ticket leads: why valuable · what to pitch ·
  // how to approach · weak spots found.
  bio: text("bio"),
  // Quick business intel gathered from a social/web scan (what they do,
  // specialties, how active their socials are, useful pitch angles).
  socialIntel: text("social_intel"),
  // ── Social page scan (lib/socialScan.ts) ──────────────────────────────────
  // Per-platform analysis of the lead's actual social pages — followers, last
  // activity, missing platforms — plus a pitch built from those findings.
  // Sales ammo for both outreach and pack buyers.
  socialScan: jsonb("social_scan").$type<SocialScanReport>(),
  socialScanAt: timestamp("social_scan_at", { withTimezone: true }),
  // ── AI outreach drafts (from the outreach engine) ─────────────────────────
  // Personalized cold email + SMS + a follow-up sequence, generated from this
  // lead's own data (gaps, bio, socials). Cached so we don't re-bill the AI on
  // every view; regenerated on demand.
  outreach: jsonb("outreach").$type<LeadOutreach>(),
  outreachAt: timestamp("outreach_at", { withTimezone: true }),
  status: text("status").default("new"), // new | contacted | converted | not_interested
  // ── Follow-up pipeline ─────────────────────────────────────────────────────
  // Stamped the first time the lead is marked contacted (first email sent).
  // Follow-up due dates are computed from this: contactedAt + followUps[n].day.
  contactedAt: timestamp("contacted_at", { withTimezone: true }),
  // Outreach touches sent: 0 = none, 1 = first email sent (waiting on step 2),
  // 2 = follow-up 1 sent, … Resets to 0 if the lead is moved back to "new".
  outreachStep: integer("outreach_step").default(0),
  // ── Automated outreach enrollment ─────────────────────────────────────────
  // When true, the background engine sends this lead's sequence on its own
  // (first email + timed follow-ups) instead of the owner clicking send.
  autoOutreach: boolean("auto_outreach").default(false),
  // When the engine should send the next touch. null = nothing scheduled
  // (not enrolled, or the sequence finished). The scheduler picks the most
  // overdue lead each tick.
  nextEmailAt: timestamp("next_email_at", { withTimezone: true }),
  lastEmailedAt: timestamp("last_emailed_at", { withTimezone: true }),
  // Stable per-lead token backing the one-click unsubscribe link. Set on
  // enrollment; the unsubscribe endpoint looks the lead up by it.
  unsubToken: text("unsub_token").unique(),
  // Set when the lead opts out via the unsubscribe link — hard stop, the engine
  // skips them forever after this.
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  // Set when the owner marks that the lead replied — pauses the sequence so we
  // never keep cold-nudging someone who's already talking to us.
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  // Deliverability suppression: 'bounced' | 'complained' → never email again.
  emailHealth: text("email_health"),
  // RFC Message-ID of this lead's first email, so follow-ups thread beneath it.
  threadMessageId: text("thread_message_id"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Shape of the social-page analysis stored in leads.socialScan.
export type SocialScanPlatform = {
  platform: string;       // "facebook" | "instagram" | "twitter" | "linkedin" | ...
  url?: string;
  followers?: string;     // as found, e.g. "1.2K"
  lastActive?: string;    // e.g. "last post Nov 2025", "inactive ~8 months"
  note?: string;          // one concrete observation worth mentioning in a pitch
};
// Deeper business profile assembled from the lead's own public pages — every
// field optional; only what the scan could actually verify gets filled in.
export type SocialScanProfile = {
  about?: string;          // what they do, specialties, how they position themselves
  owner?: string;          // owner/decision-maker as the BUSINESS publishes it, e.g. 'Mike Smith (owner)'
  founded?: string;        // e.g. "est. 2012", "serving the Gulf Coast 15+ years"
  contentThemes?: string[];// what they actually post about (jobs done, promos, memes…)
  engagement?: string;     // how their audience responds (likes/comments per post, quality)
  reputation?: string;     // review sentiment highlights: what customers praise/complain about
  hooks?: string[];        // concrete personalization hooks for outreach, each tied to a real finding
};
export type SocialScanReport = {
  platforms: SocialScanPlatform[]; // pages that exist
  missing: string[];               // platforms they have NO presence on
  grade: "none" | "weak" | "ok" | "strong";
  profile?: SocialScanProfile;     // deep profile (added later — absent on old scans)
  pitch: string;                   // 2-3 sentences: how to sell them with this
  opener: string;                  // short first message referencing a real finding
  sources?: { title: string; url: string }[];
};

// Shape of the AI-generated outreach drafts stored in leads.outreach.
export type LeadOutreachStep = { day: number; channel: "email" | "sms"; subject?: string; body: string };
export type LeadOutreach = {
  angle: string;                 // the hook the AI is playing (one line)
  email: { subject: string; body: string };
  sms: string;
  followUps: LeadOutreachStep[]; // 2-3 timed nudges
};

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
