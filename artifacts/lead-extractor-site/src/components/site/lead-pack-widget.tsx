import { useState, useEffect } from "react";
import { Download, Lock, Shield, Mail, Eye, Phone, Star, Sparkles, Facebook, Instagram, Twitter, Linkedin, Globe, ChevronDown, AlertCircle, RefreshCw } from "lucide-react";

import { PaymentMethods, GuaranteeCallout } from "@/components/site/trust-badges";
import { PlatformReviews } from "@/components/site/landing-sections";

type SocialLink = { platform: string; url: string };
type SampleLead = { name: string; city: string; category: string; rating: number | null; reviewCount: number | null; website: string | null; phoneMasked: string | null; hasEmail: boolean; socials?: string[] };
type UnlockedLead = { name: string; city: string; category: string; rating: number | null; reviewCount: number | null; website: string | null; websiteUrl: string | null; phone: string | null; email: string | null; socials?: SocialLink[] };

function SocialIcon({ platform }: { platform: string }) {
  const cls = "w-3.5 h-3.5";
  switch (platform) {
    case "facebook": return <Facebook className={cls} />;
    case "instagram": return <Instagram className={cls} />;
    case "twitter": return <Twitter className={cls} />;
    case "linkedin": return <Linkedin className={cls} />;
    default: return <Globe className={cls} />;
  }
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Volume tiers, tucked into the collapsed "every month or in bulk" section so
// they never compete with the single $29 pack. Sizes/prices must stay in sync
// with PACK_TIERS in api-server/src/lib/packs.ts (the server re-prices anyway —
// these are display values).
const PACK_TIERS_UI = [
  { size: 500, qty: "500", price: "$99", per: "$0.20/lead", save: "Save $46", highlight: false },
  { size: 1000, qty: "1,000", price: "$179", per: "$0.18/lead", save: "Save $111", highlight: true },
  { size: 5000, qty: "5,000", price: "$599", per: "$0.12/lead", save: "Save $851", highlight: false },
] as const;

// Business types for the lead-pack dropdown. `value` is the search term the
// API matches against lead categories — keep in sync with PACK_CATEGORIES in
// api-server/src/routes/stripe.ts.
const PACK_CATEGORIES: { value: string; label: string }[] = [
  { value: "accountant", label: "Accountants" },
  { value: "auto repair", label: "Auto Repair Shops" },
  { value: "barber", label: "Barber Shops" },
  { value: "cafe", label: "Cafés" },
  { value: "car deal", label: "Car Dealerships" },
  { value: "chiropract", label: "Chiropractors" },
  { value: "clean", label: "Cleaning Services" },
  { value: "coffee", label: "Coffee Shops" },
  { value: "contractor", label: "Contractors & Construction" },
  { value: "dentist", label: "Dentists" },
  { value: "electric", label: "Electricians" },
  { value: "fence", label: "Fence Contractors" },
  { value: "floor", label: "Flooring Contractors" },
  { value: "florist", label: "Florists" },
  { value: "garage door", label: "Garage Door Services" },
  { value: "gutter", label: "Gutter Services" },
  { value: "gym", label: "Gyms & Fitness" },
  { value: "handyman", label: "Handyman Services" },
  { value: "home inspect", label: "Home Inspectors" },
  { value: "hvac", label: "HVAC Contractors" },
  { value: "insurance", label: "Insurance Agents" },
  { value: "junk", label: "Junk Removal" },
  { value: "landscap", label: "Landscapers" },
  { value: "lawn", label: "Lawn Care" },
  { value: "lawyer", label: "Lawyers" },
  { value: "locksmith", label: "Locksmiths" },
  { value: "mason", label: "Masonry Contractors" },
  { value: "massage", label: "Massage Therapists" },
  { value: "medical", label: "Medical Practices" },
  { value: "moving", label: "Moving Companies" },
  { value: "paint", label: "Painters" },
  { value: "pest", label: "Pest Control" },
  { value: "pet groom", label: "Pet Groomers" },
  { value: "photograph", label: "Photographers" },
  { value: "plumb", label: "Plumbers" },
  { value: "pool", label: "Pool Services" },
  { value: "pressure wash", label: "Pressure Washing" },
  { value: "real estate", label: "Real Estate Agents" },
  { value: "restaurant", label: "Restaurants" },
  { value: "retail", label: "Retail Stores" },
  { value: "roof", label: "Roofers" },
  { value: "salon", label: "Salons" },
  { value: "septic", label: "Septic Services" },
  { value: "spa", label: "Spas" },
  { value: "tile", label: "Tile Contractors" },
  { value: "towing", label: "Towing Services" },
  { value: "tree", label: "Tree Services" },
  { value: "veterinar", label: "Veterinarians" },
  { value: "window", label: "Window Cleaning" },
];

const US_STATES: { value: string; label: string }[] = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" }, { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" }, { value: "DC", label: "Washington DC" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" }, { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" }, { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" }, { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" }, { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" }, { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" }, { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" }, { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
];

// The single "buy leads" funnel, in three ordered stages:
//   1. Target selection — business type + location, then "Show My 5 Free Leads".
//   2. Sample preview   — up to 5 real matching businesses (or clearly-labelled
//      example rows when the API has none on hand yet), with an email unlock.
//   3. Purchase         — one dominant $29 pack CTA; monthly/bulk collapsed below.
// Shared by the home hero, /pricing, and /get-leads — the single source of
// truth for the pack-buying flow.
export default function LeadPackWidget({ showReviews = false, hidePrice = false }: { showReviews?: boolean; hidePrice?: boolean }) {
  const [packCategory, setPackCategory] = useState("");
  const [packState, setPackState] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);

  const categoryLabel = PACK_CATEGORIES.find(c => c.value === packCategory)?.label ?? "";
  const stateLabel = US_STATES.find(s => s.value === packState)?.label ?? "";

  // ── Stage 1 validation ──────────────────────────────────────────────────────
  // Require a business type before anything runs. A blank "all types" order is
  // allowed via bulk, but must never look like the recommended default here.
  const validateTarget = (): boolean => {
    if (!packCategory) {
      setTargetError("Choose a business type first — that's how we match your leads.");
      return false;
    }
    setTargetError(null);
    return true;
  };

  // ── Stage 2: free sample leads (proof-first email capture) ──────────────────
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [sample, setSample] = useState<
    { sampleId: number; totalAvailable: number; label: string; location: string; leads: SampleLead[]; isDemo: boolean } | null
  >(null);
  const [unlockEmail, setUnlockEmail] = useState("");
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState<UnlockedLead[] | null>(null);

  // Reset samples whenever the target changes so results always match — but keep
  // the user's category/state selections intact.
  useEffect(() => {
    setSample(null);
    setSampleError(null);
    setUnlocked(null);
    setUnlockError(null);
  }, [packCategory, packState]);

  const handleSeeSamples = async () => {
    if (!validateTarget()) return;
    setSampleLoading(true);
    setSampleError(null);
    setUnlocked(null);
    setUnlockError(null);
    try {
      const res = await fetch(`${basePath}/api/stripe/pack-sample`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: packCategory, state: packState }),
      });
      const data = await res.json();
      if (data.ok) {
        setSample({
          sampleId: data.sampleId,
          totalAvailable: data.totalAvailable,
          label: data.label,
          location: data.location,
          leads: data.leads,
          isDemo: !!data.isDemo,
        });
        // Bring the results into view without wiping the targeting selections.
        setTimeout(() => document.getElementById("sample-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      } else {
        setSampleError(data.message ?? "No preview for that combination yet — try another type or state.");
      }
    } catch {
      setSampleError("Couldn't load a preview right now — please try again.");
    }
    setSampleLoading(false);
  };

  const handleUnlock = async () => {
    if (!sample) return;
    const email = unlockEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setUnlockError("Enter a valid email address.");
      return;
    }
    setUnlockLoading(true);
    setUnlockError(null);
    try {
      const res = await fetch(`${basePath}/api/stripe/pack-sample-unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleId: sample.sampleId, email }),
      });
      const data = await res.json();
      if (data.ok) setUnlocked(data.leads);
      else setUnlockError(data.error ?? "Couldn't unlock — please try again.");
    } catch {
      setUnlockError("Couldn't unlock right now — please try again.");
    }
    setUnlockLoading(false);
  };

  // ── Stage 3: purchase ───────────────────────────────────────────────────────
  const [packLoading, setPackLoading] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);

  // null = not yet known (endpoint unreachable or still loading)
  const [packAvail, setPackAvail] = useState<{ available: number; ok: boolean } | null>(null);
  const [packAvailLoading, setPackAvailLoading] = useState(false);

  // Live availability so the buyer sees whether it ships from stock or is built
  // to order before paying.
  useEffect(() => {
    if (!packCategory && !packState) { setPackAvail(null); return; }
    let cancelled = false;
    setPackAvailLoading(true);
    const params = new URLSearchParams();
    if (packCategory) params.set("category", packCategory);
    if (packState) params.set("state", packState);
    fetch(`${basePath}/api/stripe/pack-availability?${params}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled) setPackAvail(typeof d?.available === "number" ? { available: d.available, ok: !!d.ok } : null);
      })
      .catch(() => { if (!cancelled) setPackAvail(null); })
      .finally(() => { if (!cancelled) setPackAvailLoading(false); });
    return () => { cancelled = true; };
  }, [packCategory, packState]);

  const handleBuyPack = async () => {
    if (packLoading) return;                 // prevent duplicate checkout sessions
    if (!validateTarget()) return;
    setPackLoading(true);
    setPackError(null);
    try {
      const res = await fetch(`${basePath}/api/stripe/pack-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: packCategory, state: packState }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;                              // keep the spinner up through redirect
      }
      setPackError(data.error ?? "Checkout is unavailable right now — please try again.");
    } catch {
      setPackError("Checkout is unavailable right now — please try again.");
    }
    setPackLoading(false);
  };

  // Monthly subscription checkout — same filters, recurring price.
  const [subLoading, setSubLoading] = useState(false);
  const handleSubscribe = async () => {
    if (subLoading) return;
    if (!validateTarget()) return;
    setSubLoading(true);
    setPackError(null);
    try {
      const res = await fetch(`${basePath}/api/stripe/pack-subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: packCategory, state: packState }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setPackError(data.error ?? "Checkout is unavailable right now — please try again.");
    } catch {
      setPackError("Checkout is unavailable right now — please try again.");
    }
    setSubLoading(false);
  };

  // Volume-tier checkout (collapsed bulk section). Shares packCategory/packState
  // with Stage 1, so the buyer's selections carry straight over.
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [tierLoading, setTierLoading] = useState<number | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
  const handleBuyTier = async (size: number) => {
    if (tierLoading !== null) return;
    setTierLoading(size);
    setTierError(null);
    try {
      const res = await fetch(`${basePath}/api/stripe/pack-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: packCategory, state: packState, size }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setTierError(data.error ?? "Checkout is unavailable right now — please try again.");
    } catch {
      setTierError("Checkout is unavailable right now — please try again.");
    }
    setTierLoading(null);
  };

  const targetChosen = !!packCategory;
  const targetSummary = [categoryLabel || null, stateLabel || "Nationwide"].filter(Boolean).join(" · ");

  return (
    <div id="pack-buy" className="max-w-2xl mx-auto">
      {!hidePrice && (
        <div className="text-center mb-6">
          <div className="flex items-baseline justify-center gap-3 mb-1">
            <span className="text-5xl font-display font-bold text-foreground">$29</span>
            <span className="text-sm text-muted-foreground">one-time · no account required</span>
          </div>
          <p className="text-muted-foreground">100 targeted local business leads — business names, phone numbers, websites, publicly listed emails when available, ratings, addresses &amp; more.</p>
        </div>
      )}

      {/* ── STAGE 1 · Target selection ─────────────────────────────────────── */}
      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black shrink-0">1</span>
          <p className="text-sm font-bold text-foreground">Choose your industry &amp; location</p>
        </div>
        <p className="text-xs text-muted-foreground mb-4 pl-8">
          For example: <span className="text-foreground/80">Roofers in Pensacola, FL</span> · <span className="text-foreground/80">Plumbers in Houston, TX</span> · <span className="text-foreground/80">Auto repair shops in Mobile, AL</span>
        </p>

        <div className="flex flex-col gap-4">
          {/* Business type — comes BEFORE the sample button */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="select-pack-category" className="text-sm font-bold text-foreground">
              Business type
            </label>
            <select
              id="select-pack-category"
              value={packCategory}
              onChange={e => { setPackCategory(e.target.value); if (e.target.value) setTargetError(null); }}
              data-testid="select-pack-category"
              aria-invalid={!!targetError}
              className={`w-full h-14 px-4 rounded-xl bg-white border-2 text-[#202124] text-base font-semibold focus:outline-none focus:border-primary transition-colors cursor-pointer shadow-sm ${targetError ? "border-red-400" : "border-[#e8eaed]"}`}>
              <option value="">Select a business type…</option>
              {PACK_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {targetError && (
              <p className="flex items-center gap-1.5 text-sm text-red-500 font-medium" data-testid="text-target-error">
                <AlertCircle className="w-4 h-4 shrink-0" /> {targetError}
              </p>
            )}
          </div>

          {/* Location */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="select-pack-state" className="text-sm font-bold text-foreground">
              Location
            </label>
            <select
              id="select-pack-state"
              value={packState}
              onChange={e => setPackState(e.target.value)}
              data-testid="select-pack-state"
              className="w-full h-14 px-4 rounded-xl bg-white border-2 border-[#e8eaed] text-[#202124] text-base font-semibold focus:outline-none focus:border-primary transition-colors cursor-pointer shadow-sm">
              <option value="">Nationwide — any state</option>
              {US_STATES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Primary CTA — Show My 5 Free Leads */}
          <button
            onClick={handleSeeSamples}
            disabled={sampleLoading}
            data-testid="btn-see-samples"
            className="w-full flex items-center justify-center gap-2 min-h-[52px] px-6 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/25">
            {sampleLoading ? (
              <><span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Finding your leads…</>
            ) : (
              <><Eye className="w-5 h-5" /> Show My 5 Free Leads</>
            )}
          </button>
          <p className="text-center text-[11px] text-muted-foreground -mt-1">Free preview · no credit card · no signup</p>
        </div>
      </div>

      {sampleError && (
        <p className="flex items-center gap-1.5 text-sm text-amber-500 mt-4" data-testid="text-sample-error">
          <AlertCircle className="w-4 h-4 shrink-0" /> {sampleError}
        </p>
      )}

      {/* ── STAGE 2 · Real sample preview ──────────────────────────────────── */}
      {sample && (
        <div id="sample-results" className="mt-4 scroll-mt-24 bg-card/60 border border-primary/25 rounded-2xl p-5" data-testid="box-samples">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black shrink-0">2</span>
            <p className="text-sm font-bold text-foreground">
              {sample.isDemo ? "Example of what your pack looks like" : "Your matching leads"}
            </p>
          </div>

          {sample.isDemo ? (
            <p className="text-xs text-muted-foreground mb-3 pl-8" data-testid="text-sample-caption">
              We don't have {sample.label || "these"}{sample.location ? ` in ${sample.location}` : ""} on hand yet, so here are
              <strong className="text-foreground"> example rows</strong> showing the exact fields you'll receive. Order below and we gather 100 fresh matching leads within 24 hours.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-3 pl-8" data-testid="text-sample-caption">
              {sample.leads.length} of <strong className="text-foreground">{sample.totalAvailable.toLocaleString()}</strong> real {sample.label || "leads"}{sample.location ? ` in ${sample.location}` : ""} —
              {unlocked ? " full contact details shown." : " contact details are locked until you unlock them below."}
            </p>
          )}

          <div className="space-y-2">
            {sample.leads.map((lead, i) => {
              const u = unlocked?.[i];
              return (
                <div key={i} className="rounded-xl border border-border bg-background/40 p-3" data-testid={`row-sample-${i}`}>
                  {/* Top row: name + rating */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground text-sm truncate">{lead.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {lead.city}
                        {lead.website ? (
                          <>
                            {" · "}
                            <a
                              href={u?.websiteUrl ?? `https://${lead.website}`}
                              target="_blank"
                              rel="noopener nofollow"
                              className="text-foreground/70 hover:text-primary hover:underline transition-colors"
                              data-testid={`link-website-${i}`}
                            >
                              {lead.website}
                            </a>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {lead.rating != null && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Star className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                        <span className="font-semibold text-foreground">{lead.rating.toFixed(1)}</span>
                        {lead.reviewCount != null && <span>({lead.reviewCount})</span>}
                      </div>
                    )}
                  </div>
                  {/* Category chip */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {lead.category && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">
                        {lead.category}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
                    {/* Phone — visible vs locked */}
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                      {u ? (
                        <a href={`tel:${u.phone}`} className="font-semibold text-foreground hover:text-primary hover:underline transition-colors" data-testid={`text-phone-${i}`}>{u.phone}</a>
                      ) : (
                        <span className="text-muted-foreground font-mono">{lead.phoneMasked}</span>
                      )}
                    </span>
                    {/* Email — accurate: only shown as included when present */}
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                      {u ? (
                        u.email ? (
                          <a href={`mailto:${u.email}`} className="font-semibold text-foreground hover:text-primary hover:underline transition-colors truncate max-w-[180px]" data-testid={`text-email-${i}`}>{u.email}</a>
                        ) : (
                          <span className="text-muted-foreground" data-testid={`text-email-${i}`}>no public email</span>
                        )
                      ) : lead.hasEmail ? (
                        <span className="flex items-center gap-1 text-muted-foreground"><Lock className="w-3 h-3" /> email included</span>
                      ) : (
                        <span className="text-muted-foreground/60">no public email</span>
                      )}
                    </span>
                    {/* Social pages */}
                    <span className="flex items-center gap-1.5" data-testid={`row-socials-${i}`}>
                      <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
                      {u ? (
                        (u.socials ?? []).length > 0 ? (
                          (u.socials ?? []).map((s) => (
                            <a key={s.url} href={s.url} target="_blank" rel="noopener nofollow" title={s.platform}
                              className="text-primary hover:opacity-70 transition-opacity">
                              <SocialIcon platform={s.platform} />
                            </a>
                          ))
                        ) : (
                          <span className="text-muted-foreground/60">no socials</span>
                        )
                      ) : (lead.socials ?? []).length > 0 ? (
                        (lead.socials ?? []).map((p) => (
                          <span key={p} title={`${p} — unlock to open`} className="text-muted-foreground/50">
                            <SocialIcon platform={p} />
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground/60">no socials</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Email unlock — only meaningful for real leads (demo has no live details) */}
          {!sample.isDemo && !unlocked && (
            <div className="mt-4 rounded-xl bg-primary/5 border border-primary/25 p-4">
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-primary" /> Unlock the full phone &amp; email for all 5 — free
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={unlockEmail}
                  onChange={e => { setUnlockEmail(e.target.value); setUnlockError(null); }}
                  onKeyDown={e => { if (e.key === "Enter") handleUnlock(); }}
                  placeholder="you@email.com"
                  data-testid="input-unlock-email"
                  className="flex-1 min-h-[44px] px-4 rounded-xl bg-white border border-[#e8eaed] text-[#202124] text-sm placeholder:text-[#9aa0a6] focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  onClick={handleUnlock}
                  disabled={unlockLoading}
                  data-testid="btn-unlock-samples"
                  className="min-h-[44px] px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap">
                  {unlockLoading ? "Unlocking…" : "Unlock all 5 →"}
                </button>
              </div>
              {unlockError && <p className="flex items-center gap-1.5 text-sm text-red-500 mt-2" data-testid="text-unlock-error"><AlertCircle className="w-4 h-4 shrink-0" /> {unlockError}</p>}
              <p className="text-[11px] text-muted-foreground mt-2">We'll email you these 5 and occasional lead deals. No spam — unsubscribe anytime.</p>
            </div>
          )}

          {/* Bridge to purchase — no navigation, buys the same target */}
          <div className="mt-4 rounded-xl bg-primary/10 border border-primary/40 p-4 text-center">
            <p className="text-sm font-bold text-foreground flex items-center justify-center gap-1.5 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              {sample.isDemo
                ? `Get all 100 ${sample.label || "leads"}${sample.location ? ` in ${sample.location}` : ""} for $29.`
                : `That's 5 of ${sample.totalAvailable.toLocaleString()}. Get all 100 for $29.`}
            </p>
            <button
              onClick={handleBuyPack}
              disabled={packLoading}
              data-testid="btn-sample-to-buy"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed">
              {packLoading ? (
                <><span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Redirecting…</>
              ) : (
                <><Download className="w-4 h-4" /> Get All 100 Leads — $29</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── STAGE 3 · Purchase ─────────────────────────────────────────────── */}
      <div className="mt-4 bg-card/60 border border-primary/20 rounded-2xl p-5 sm:p-6 shadow-lg shadow-primary/5">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black shrink-0">3</span>
          <p className="text-sm font-bold text-foreground">Get your complete pack</p>
        </div>

        {targetChosen && (
          <p className="text-xs text-muted-foreground mb-3 pl-8" data-testid="text-buy-target">
            <span className="font-semibold text-foreground">{targetSummary}</span>
          </p>
        )}

        {/* Availability / delivery expectation — mirrors backend fulfillment */}
        {targetChosen && !packAvailLoading && packAvail && (
          packAvail.ok ? (
            <p className="text-sm text-primary mb-4 font-medium pl-8" data-testid="text-pack-available">
              ✅ {packAvail.available.toLocaleString()} matching leads in stock — your top 100 are emailed after a quick human quality check, usually within a few hours.
            </p>
          ) : (
            <p className="text-sm text-primary mb-4 font-medium pl-8" data-testid="text-pack-buildorder">
              ✨ Built to order — we gather 100 fresh matching leads and email your CSV within 24 hours. Automatic refund if we come up short.
            </p>
          )
        )}

        <button
          onClick={handleBuyPack}
          disabled={packLoading || packAvailLoading}
          data-testid="btn-buy-lead-pack"
          className="w-full flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/30">
          {packLoading ? (
            <><span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Redirecting to checkout…</>
          ) : (
            <><Download className="w-5 h-5" /> Get All 100 Leads — $29</>
          )}
        </button>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">One-time $29 payment · no account required · CSV emailed to your Stripe receipt address.</p>

        {packError && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-red-400/40 bg-red-500/5 p-3" data-testid="box-pack-error">
            <p className="flex items-center gap-1.5 text-sm text-red-500 flex-1"><AlertCircle className="w-4 h-4 shrink-0" /> {packError}</p>
            <button
              onClick={handleBuyPack}
              disabled={packLoading}
              data-testid="btn-retry-checkout"
              className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 rounded-lg border border-primary/50 text-primary font-bold text-sm hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-60">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        {/* Point-of-payment reassurance */}
        <GuaranteeCallout className="mt-4" />
        <PaymentMethods className="mt-4" />

        {/* Recurring / bulk — collapsed so it never competes with the $29 pack */}
        <details className="group mt-5 rounded-xl border border-border bg-background/40" data-testid="details-more-options">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            Need leads every month or in bulk?
            <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-4 pb-4 pt-1 space-y-4">
            {/* Monthly */}
            <div>
              <button
                onClick={handleSubscribe}
                disabled={subLoading}
                data-testid="btn-subscribe-lead-pack"
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-primary/60 text-primary font-bold hover:bg-primary/10 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                {subLoading ? (
                  <><span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Redirecting…</>
                ) : (
                  <>🔁 100 fresh leads every month — $24/mo (save 17%)</>
                )}
              </button>
              <p className="text-[11px] text-muted-foreground mt-1.5 text-center">Cancel anytime — just reply to any delivery email.</p>
            </div>

            {/* Volume tiers */}
            <div>
              <p className="text-center text-sm font-semibold text-foreground mb-3">Buy in bulk &amp; save</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PACK_TIERS_UI.map(tier => (
                  <div key={tier.qty} className={`relative rounded-xl p-4 text-center border transition-colors flex flex-col ${selectedTier === tier.size ? "border-primary bg-primary/10 shadow-md shadow-primary/20" : tier.highlight ? "border-primary/50 bg-primary/5" : "border-border bg-card/40 hover:border-primary/30"}`}>
                    {tier.highlight && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">Most popular</div>
                    )}
                    <div className="text-xl font-display font-bold text-foreground">{tier.qty}</div>
                    <div className="text-xs text-muted-foreground mb-2">leads</div>
                    <div className="text-lg font-bold text-foreground">{tier.price}</div>
                    <div className="text-[11px] text-muted-foreground">{tier.per}</div>
                    {"save" in tier && tier.save && <div className="mt-1.5 text-[11px] font-semibold text-primary">{tier.save}</div>}
                    <button
                      onClick={() => setSelectedTier(selectedTier === tier.size ? null : tier.size)}
                      disabled={tierLoading !== null}
                      data-testid={`btn-buy-tier-${tier.size}`}
                      className={`mt-3 w-full py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${selectedTier === tier.size || tier.highlight ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground"}`}>
                      {selectedTier === tier.size ? "✓ Selected" : "Choose"}
                    </button>
                  </div>
                ))}
              </div>

              {selectedTier !== null && (
                <div className="mt-4 rounded-2xl border border-primary/40 bg-card/60 p-5 text-left" data-testid="box-tier-picker">
                  <p className="text-sm font-bold text-foreground mb-3">
                    Your {selectedTier.toLocaleString()}-lead pack: <span className="text-primary">{targetSummary}</span>
                  </p>
                  {packAvail && !packAvailLoading && (
                    <p className="text-xs text-muted-foreground mb-4" data-testid="text-tier-availability">
                      {packAvail.available.toLocaleString()} matching leads in stock —{" "}
                      {packAvail.available >= selectedTier
                        ? <span className="text-primary font-semibold">the top {selectedTier.toLocaleString()} ship after a quick quality check (usually a few hours).</span>
                        : <span>we'll gather the rest fresh and email your CSV within 24 hours — any shortfall is automatically refunded.</span>}
                    </p>
                  )}
                  <button
                    onClick={() => handleBuyTier(selectedTier)}
                    disabled={tierLoading !== null}
                    data-testid="btn-tier-checkout"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed">
                    {tierLoading !== null ? (
                      <><span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Redirecting…</>
                    ) : (
                      <><Download className="w-5 h-5" /> Checkout — {PACK_TIERS_UI.find(t => t.size === selectedTier)?.price}</>
                    )}
                  </button>
                </div>
              )}
              {tierError && <p className="flex items-center justify-center gap-1.5 text-sm text-red-500 mt-3"><AlertCircle className="w-4 h-4 shrink-0" /> {tierError}</p>}
              <p className="text-center text-xs text-muted-foreground mt-4">
                Want a custom volume? <a href="mailto:support@mapleadextractor.net?subject=Bulk%20Lead%20Order" className="text-primary hover:underline">Email us</a> — we handle orders of any size.
              </p>
            </div>
          </div>
        </details>
      </div>

      {showReviews && <PlatformReviews />}

      {/* Human review quality section */}
      <div className="mt-8 rounded-2xl border border-border bg-card/30 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-card/40">
          <Shield className="w-5 h-5 text-primary shrink-0" />
          <span className="font-display font-bold text-foreground">Every lead is human-reviewed before it ships</span>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            We don't just dump raw scraped data into a CSV and call it done. Before your pack leaves our hands, a real person goes through every record and checks it against our quality standards.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { icon: "🔍", title: "Dead records removed", desc: "Permanently closed, moved, or duplicate businesses are filtered out before delivery." },
              { icon: "📞", title: "Phone numbers spot-checked", desc: "We verify a sample of phone numbers are active and match the listed business." },
              { icon: "✉️", title: "Emails validated when present", desc: "Publicly listed emails are format-checked against a live mail server — not every business publishes one." },
              { icon: "📍", title: "Location confirmed", desc: "Addresses are verified to be in your requested area — no out-of-area listings slipping through." },
            ].map(item => (
              <div key={item.title} className="flex gap-3 items-start">
                <span className="text-lg shrink-0 mt-0.5">{item.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-foreground">{item.title}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-1 border-t border-border">
            If a pack comes up short after review, we either source more leads to hit your count or refund the difference automatically — no questions asked.
          </p>
        </div>
      </div>
    </div>
  );
}
