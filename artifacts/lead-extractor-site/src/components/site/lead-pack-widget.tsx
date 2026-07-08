import { useState, useEffect } from "react";
import { Download, Lock, Shield, Mail } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Volume tiers in the pricing grid, for buyers who want MORE than the 100-lead
// pack sold in the main conversion card above (that's why 100 isn't repeated
// here — repeating it read as two competing offers). Sizes/prices must stay
// in sync with PACK_TIERS in api-server/src/lib/packs.ts (the server
// re-prices anyway — these are display values).
const PACK_TIERS_UI = [
  { size: 500, qty: "500", price: "$99", per: "$0.20/lead", save: "Save $46", highlight: false },
  { size: 1000, qty: "1,000", price: "$179", per: "$0.18/lead", save: "Save $111", highlight: true },
  { size: 5000, qty: "5,000", price: "$599", per: "$0.12/lead", save: "Save $856", highlight: false },
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

// The shared "buy leads" purchase widget: free-text quote + availability
// picker, one-click $29 pack checkout, trust strip, mini social proof, volume
// tiers, and the human-review quality section. Used on both the home page's
// #leads-for-sale section and the pricing page. This is the single source of
// truth for the pack-buying flow.
export default function LeadPackWidget() {
  const [packLoading, setPackLoading] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  const [packCategory, setPackCategory] = useState("");
  const [packState, setPackState] = useState("");
  // Free-text request path
  const [packRequest, setPackRequest] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<
    | { ok: true; instant: boolean; available: number; label: string; location: string; displayName: string }
    | { ok: false; message: string }
    | null
  >(null);

  const handleQuote = async () => {
    const request = packRequest.trim();
    if (request.length < 3) return;
    setQuoteLoading(true);
    setQuote(null);
    setPackError(null);
    try {
      const res = await fetch(`${basePath}/api/stripe/pack-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      });
      const data = await res.json();
      if (data.ok) {
        setQuote({ ok: true, instant: data.instant, available: data.available, label: data.label, location: data.location, displayName: data.displayName });
      } else {
        setQuote({ ok: false, message: data.message ?? "We couldn't read that request — try e.g. \"roofers in Mobile, AL\"." });
      }
    } catch {
      setQuote({ ok: false, message: "Couldn't check availability right now — please try again." });
    }
    setQuoteLoading(false);
  };

  const handleBuyRequest = async () => {
    setPackLoading(true);
    setPackError(null);
    try {
      const res = await fetch(`${basePath}/api/stripe/pack-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: packRequest.trim() }),
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
    setPackLoading(false);
  };
  // null = not yet known (endpoint unreachable or still loading)
  const [packAvail, setPackAvail] = useState<{ available: number; ok: boolean } | null>(null);
  const [packAvailLoading, setPackAvailLoading] = useState(false);

  // Live availability check so the buyer sees "only N available" before paying.
  useEffect(() => {
    let cancelled = false;
    setPackAvailLoading(true);
    setPackError(null);
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
        return;
      }
      setPackError(data.error ?? "Checkout is unavailable right now — please try again.");
    } catch {
      setPackError("Checkout is unavailable right now — please try again.");
    }
    setPackLoading(false);
  };

  // Volume-tier checkout (the pricing grid). Clicking a tier opens a picker
  // so the buyer chooses WHAT kind of leads fill the pack; the picker shares
  // packCategory/packState with the main dropdowns, so selections carry over.
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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Price + value header */}
      <div className="text-center mb-6">
        <div className="flex items-baseline justify-center gap-3 mb-2">
          <span className="text-5xl font-display font-bold text-foreground">$29</span>
          <span className="text-xl text-muted-foreground line-through">$99</span>
          <span className="px-2.5 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">71% OFF</span>
        </div>
        <p className="text-muted-foreground">100 targeted local business leads — phone, email, website, ratings & more</p>
      </div>

      {/* Main conversion card */}
      <div className="bg-card/60 border border-primary/20 rounded-2xl p-6 shadow-lg shadow-primary/5 mb-4">

        {/* Free-text request */}
        <label className="block text-sm font-semibold text-foreground mb-2">Tell us what you're looking for</label>
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <input
            type="text"
            value={packRequest}
            onChange={e => { setPackRequest(e.target.value); setQuote(null); }}
            onKeyDown={e => { if (e.key === "Enter") handleQuote(); }}
            placeholder="e.g. roofers in Mobile, AL — or plumbers anywhere"
            data-testid="input-pack-request"
            className="flex-1 h-12 px-4 rounded-xl bg-white border border-[#e8eaed] text-[#202124] text-sm placeholder:text-[#9aa0a6] focus:outline-none focus:border-primary transition-colors"
          />
          <button
            onClick={handleQuote}
            disabled={quoteLoading || packRequest.trim().length < 3}
            data-testid="btn-pack-quote"
            className="h-12 px-5 rounded-xl border border-primary/60 text-primary font-bold text-sm hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
            {quoteLoading ? "Checking…" : "Check availability"}
          </button>
        </div>

        {quote && quote.ok === false && (
          <p className="text-sm text-amber-400 mb-4 text-left" data-testid="text-quote-error">{quote.message}</p>
        )}
        {quote && quote.ok && (
          <div className="mb-5 text-left p-4 rounded-xl bg-primary/5 border border-primary/20" data-testid="box-quote-result">
            {quote.instant ? (
              <p className="text-sm text-primary mb-3 font-medium">
                ✅ In stock — {quote.available.toLocaleString()} {quote.label}{quote.location ? ` in ${quote.location}` : ""} ready. CSV emailed after a quick quality check, usually within a few hours.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mb-3">
                We don't have 100 {quote.label}{quote.location ? ` in ${quote.location}` : ""} on hand right now ({quote.available.toLocaleString()} in stock). Order it and we'll <strong className="text-foreground">gather 100 fresh leads and email your CSV within 24 hours</strong> — if we come up short, we automatically refund the difference.
              </p>
            )}
            <button
              onClick={handleBuyRequest}
              disabled={packLoading}
              data-testid="btn-buy-request"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed">
              {packLoading ? (
                <><span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> Redirecting…</>
              ) : (
                <><Download className="w-5 h-5" /> {quote.instant ? "Buy now — $29 (emailed to you)" : "Order for $29 — email me the CSV"}</>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or pick from a list</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <select
            value={packCategory}
            onChange={e => setPackCategory(e.target.value)}
            data-testid="select-pack-category"
            aria-label="Business type"
            className="h-12 flex-1 px-4 rounded-xl bg-white border border-[#e8eaed] text-[#202124] text-sm font-medium focus:outline-none focus:border-primary transition-colors">
            <option value="">All business types</option>
            {PACK_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={packState}
            onChange={e => setPackState(e.target.value)}
            data-testid="select-pack-state"
            aria-label="State"
            className="h-12 flex-1 px-4 rounded-xl bg-white border border-[#e8eaed] text-[#202124] text-sm font-medium focus:outline-none focus:border-primary transition-colors">
            <option value="">All states (nationwide)</option>
            {US_STATES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Every category/state is always orderable. If we have 100+ on hand it
            ships instantly; if not, it's built to order (queued for fulfillment,
            24h delivery, auto refund on any shortfall) — never blocked. */}
        {(packCategory || packState) && !packAvailLoading && packAvail && (
          packAvail.ok ? (
            <p className="text-sm text-primary mb-4 font-medium" data-testid="text-pack-available">
              ✅ {packAvail.available.toLocaleString()} matching leads in stock — you'll get the top 100.
            </p>
          ) : (
            <p className="text-sm text-primary mb-4 font-medium" data-testid="text-pack-buildorder">
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
            <>
              <span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Redirecting to checkout…
            </>
          ) : (
            <>
              <Download className="w-5 h-5" /> Get 100 Leads — $29
            </>
          )}
        </button>
        {packError && <p className="text-sm text-red-400 mt-3">{packError}</p>}
      </div>

      {/* Trust strip */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground mb-6">
        <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-primary" /> Secure Stripe checkout</span>
        <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-primary" /> Refund if we come up short</span>
        <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-primary" /> CSV usually emailed within hours</span>
      </div>

      {/* Mini social proof */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 bg-card/40 border border-border rounded-xl p-4">
          <div className="flex gap-px mb-2">{[1,2,3,4,5].map(s=><svg key={s} className="w-3 h-3 fill-[#f59e0b]" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>)}</div>
          <p className="text-xs text-muted-foreground leading-relaxed">"Bought a pack Friday afternoon, had the CSV in my inbox within the hour. Data was clean and ready to import."</p>
          <p className="text-xs font-semibold text-foreground mt-2">— James O.</p>
        </div>
        <div className="flex-1 bg-card/40 border border-border rounded-xl p-4">
          <div className="flex gap-px mb-2">{[1,2,3,4,5].map(s=><svg key={s} className="w-3 h-3 fill-[#f59e0b]" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/></svg>)}</div>
          <p className="text-xs text-muted-foreground leading-relaxed">"Lead storage on this site is what sold me. Everything syncs to my account and CSV export is one click."</p>
          <p className="text-xs font-semibold text-foreground mt-2">— Diego R.</p>
        </div>
      </div>

      {/* Volume pricing */}
      <div className="mt-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm font-semibold text-foreground">Need more than 100? Buy in bulk & save.</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PACK_TIERS_UI.map(tier => (
            <div key={tier.qty} className={`relative rounded-xl p-4 text-center border transition-colors flex flex-col ${selectedTier === tier.size ? "border-primary bg-primary/10 shadow-md shadow-primary/20" : tier.highlight ? "border-primary/50 bg-primary/5 shadow-md shadow-primary/10" : "border-border bg-card/40 hover:border-primary/30"}`}>
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
                {selectedTier === tier.size ? "✓ Selected" : "Buy now"}
              </button>
            </div>
          ))}
        </div>

        {/* Tier picker: choose WHAT kind of leads fill the pack */}
        {selectedTier !== null && (
          <div className="mt-4 max-w-2xl mx-auto rounded-2xl border border-primary/40 bg-card/60 p-5 text-left" data-testid="box-tier-picker">
            <p className="text-sm font-bold text-foreground mb-3">
              What kind of leads do you want in your {selectedTier.toLocaleString()}-lead pack?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <select
                value={packCategory}
                onChange={e => setPackCategory(e.target.value)}
                aria-label="Business type for this pack"
                data-testid="select-tier-category"
                className="h-12 flex-1 px-4 rounded-xl bg-background border border-border text-foreground text-sm font-medium focus:outline-none focus:border-primary transition-colors">
                <option value="">All business types (top-scored)</option>
                {PACK_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <select
                value={packState}
                onChange={e => setPackState(e.target.value)}
                aria-label="State for this pack"
                data-testid="select-tier-state"
                className="h-12 flex-1 px-4 rounded-xl bg-background border border-border text-foreground text-sm font-medium focus:outline-none focus:border-primary transition-colors">
                <option value="">All states (nationwide)</option>
                {US_STATES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
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
        {tierError && <p className="text-center text-sm text-red-400 mt-3">{tierError}</p>}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Want a custom volume? <a href="mailto:support@mapleadextractor.net?subject=Bulk%20Lead%20Order" className="text-primary hover:underline">Email us</a> — we handle orders of any size.
        </p>
      </div>

      {/* Human review quality section */}
      <div className="mt-10 rounded-2xl border border-border bg-card/30 overflow-hidden">
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
              { icon: "✉️", title: "Email format validated", desc: "Every email address is checked for correct format and a live mail server — no obvious bounces." },
              { icon: "📍", title: "Location confirmed", desc: "Addresses are verified to be in your requested city or region — no out-of-area listings slipping through." },
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
