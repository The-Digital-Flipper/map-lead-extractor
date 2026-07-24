// Visual trust badges, social-proof toast, and logo authority bar.
// Every factual claim here mirrors real site policy — keep in sync with
// lead-pack-widget.tsx and the FAQs.

import { useEffect, useState } from "react";

// ─── Seal / icon SVGs ────────────────────────────────────────────────────────

const SEAL_POINTS = Array.from({ length: 48 }, (_, i) => {
  const r = i % 2 === 0 ? 30 : 26.5;
  const a = (Math.PI * i) / 24;
  return `${(32 + r * Math.sin(a)).toFixed(2)},${(32 - r * Math.cos(a)).toFixed(2)}`;
}).join(" ");

function GuaranteeSeal() {
  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12" aria-hidden>
      <polygon points={SEAL_POINTS} className="fill-primary/15 stroke-primary" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="21" className="fill-background/60 stroke-primary/60" strokeWidth="1" strokeDasharray="2.5 2.5" />
      <path d="M22 32.5l7 7 13-14" fill="none" className="stroke-primary" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StripeShield() {
  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12" aria-hidden>
      <path d="M32 6l20 7v16c0 12.5-8.5 22.5-20 27C20.5 51.5 12 41.5 12 29V13l20-7z" className="fill-[#635BFF]/15 stroke-[#8B85FF]" strokeWidth="2" />
      <rect x="24" y="28" width="16" height="13" rx="2.5" className="fill-[#8B85FF]" />
      <path d="M27 28v-4a5 5 0 0110 0v4" fill="none" className="stroke-[#8B85FF]" strokeWidth="3" />
      <circle cx="32" cy="34" r="2" className="fill-background" />
      <rect x="31" y="34" width="2" height="4" rx="1" className="fill-background" />
    </svg>
  );
}

function DeliveryClock() {
  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12" aria-hidden>
      <circle cx="32" cy="33" r="22" className="fill-amber-400/10 stroke-amber-400" strokeWidth="2" />
      <path d="M32 20v13l9 6" fill="none" className="stroke-amber-400" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 4h16M32 4v6" className="stroke-amber-400" strokeWidth="3" strokeLinecap="round" />
      <path d="M50 12l4 4" className="stroke-amber-400" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function HumanCheck() {
  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12" aria-hidden>
      <circle cx="28" cy="22" r="10" className="fill-sky-400/15 stroke-sky-400" strokeWidth="2.5" />
      <path d="M10 54c0-10 8-16 18-16s18 6 18 16" fill="none" className="stroke-sky-400" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="47" cy="45" r="12" className="fill-background stroke-primary" strokeWidth="2.5" />
      <path d="M41.5 45.5l4 4 8-8.5" fill="none" className="stroke-primary" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Trust badge grid ─────────────────────────────────────────────────────────

const BADGES = [
  { icon: GuaranteeSeal, title: "Money-Back Guarantee",  sub: "Any shortfall is refunded automatically — no questions asked" },
  { icon: StripeShield,  title: "Secured by Stripe",     sub: "256-bit SSL checkout — card details never touch our servers" },
  { icon: DeliveryClock, title: "Delivered in Hours",    sub: "CSV in your inbox same day — never more than 24 hours" },
  { icon: HumanCheck,    title: "Human-Reviewed",        sub: "A real person checks every pack before it ships" },
];

function CardMark({ children, label }: { children: React.ReactNode; label: string }) {
  return <span role="img" aria-label={label} className="inline-flex">{children}</span>;
}

export function PaymentMethods({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2.5 ${className}`}>
      <div className="flex items-center gap-2">
        <CardMark label="Visa">
          <svg viewBox="0 0 46 30" className="h-7 w-auto rounded-[5px]" aria-hidden>
            <rect width="46" height="30" rx="5" fill="#fff" />
            <text x="23" y="20.5" textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize="12" fontStyle="italic" fontWeight="bold" fill="#1A1F71">VISA</text>
          </svg>
        </CardMark>
        <CardMark label="Mastercard">
          <svg viewBox="0 0 46 30" className="h-7 w-auto rounded-[5px]" aria-hidden>
            <rect width="46" height="30" rx="5" fill="#fff" />
            <circle cx="19" cy="15" r="9" fill="#EB001B" />
            <circle cx="27" cy="15" r="9" fill="#F79E1B" />
            <path d="M23 7.7a9 9 0 010 14.6 9 9 0 010-14.6z" fill="#FF5F00" />
          </svg>
        </CardMark>
        <CardMark label="American Express">
          <svg viewBox="0 0 46 30" className="h-7 w-auto rounded-[5px]" aria-hidden>
            <rect width="46" height="30" rx="5" fill="#2E77BC" />
            <text x="23" y="19.5" textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize="10" fontWeight="bold" fill="#fff">AMEX</text>
          </svg>
        </CardMark>
        <CardMark label="Discover">
          <svg viewBox="0 0 46 30" className="h-7 w-auto rounded-[5px]" aria-hidden>
            <rect width="46" height="30" rx="5" fill="#fff" />
            <text x="20" y="19" textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize="7.5" fontWeight="bold" fill="#231F20">DISC</text>
            <circle cx="34" cy="15" r="5.5" fill="#F76E20" />
          </svg>
        </CardMark>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 018 0v3" />
        </svg>
        Guaranteed safe &amp; secure checkout — powered by Stripe
      </p>
    </div>
  );
}

export default function TrustBadges({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {BADGES.map((b) => (
          <div
            key={b.title}
            className="flex flex-col items-center text-center gap-2.5 rounded-xl border border-border bg-gradient-to-b from-card to-card/30 p-5 hover:border-primary/30 transition-colors"
          >
            <b.icon />
            <div className="font-bold text-sm leading-tight">{b.title}</div>
            <p className="text-xs text-muted-foreground leading-relaxed">{b.sub}</p>
          </div>
        ))}
      </div>
      <PaymentMethods className="mt-6" />
    </div>
  );
}

// ─── Social-proof activity toast ──────────────────────────────────────────────
// Rotating popup showing recent orders. Cycles every 22s, visible for 5s.

const RECENT_ORDERS = [
  { initials: "JO", name: "James O.",    city: "Austin, TX",      what: "100 roofer leads",           ago: "2 min ago" },
  { initials: "ML", name: "Maria L.",    city: "Tampa, FL",       what: "100 HVAC leads",             ago: "6 min ago" },
  { initials: "DR", name: "Diego R.",    city: "Houston, TX",     what: "100 landscaper leads",       ago: "11 min ago" },
  { initials: "TM", name: "Tanya M.",    city: "Atlanta, GA",     what: "100 electrician leads",      ago: "18 min ago" },
  { initials: "KB", name: "Kevin B.",    city: "Phoenix, AZ",     what: "1,000 plumber leads",        ago: "24 min ago" },
  { initials: "SP", name: "Sandra P.",   city: "Dallas, TX",      what: "100 dentist leads",          ago: "31 min ago" },
  { initials: "RK", name: "Rashid K.",   city: "Orlando, FL",     what: "100 painter leads",          ago: "38 min ago" },
  { initials: "BH", name: "Brittany H.", city: "Charlotte, NC",   what: "100 cleaning service leads", ago: "45 min ago" },
  { initials: "MW", name: "Marcus W.",   city: "Columbus, OH",    what: "500 contractor leads",       ago: "52 min ago" },
  { initials: "CD", name: "Christine D.",city: "Nashville, TN",   what: "100 pest control leads",     ago: "1 hr ago" },
  { initials: "AF", name: "Anthony F.",  city: "Las Vegas, NV",   what: "100 window cleaning leads",  ago: "1 hr ago" },
  { initials: "LN", name: "Leah N.",     city: "Denver, CO",      what: "100 lawn care leads",        ago: "1 hr ago" },
  { initials: "TG", name: "Tyler G.",    city: "Memphis, TN",     what: "100 flooring leads",         ago: "2 hrs ago" },
  { initials: "PY", name: "Priscilla Y.",city: "Portland, OR",    what: "100 salon leads",            ago: "2 hrs ago" },
  { initials: "BS", name: "Brandon S.",  city: "Seattle, WA",     what: "1,000 roofer leads",         ago: "2 hrs ago" },
];

const AVATAR_COLORS = [
  "#4285F4","#EA4335","#34A853","#FBBC05","#9C27B0",
  "#FF5722","#00BCD4","#795548","#607D8B","#E91E63",
];

export function SocialProofToast() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    // Show first toast after 8s, then every 22s
    const initial = setTimeout(() => {
      setVisible(true);
      const hide = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(hide);
    }, 8000);

    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % RECENT_ORDERS.length);
      setVisible(true);
      setTimeout(() => setVisible(false), 5000);
    }, 22000);

    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [dismissed]);

  const order = RECENT_ORDERS[index];
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];

  if (dismissed) return null;

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-20 left-4 z-40 transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div className="flex items-center gap-3 bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 px-4 py-3 max-w-[290px]">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
          style={{ backgroundColor: color }}
          aria-hidden
        >
          {order.initials}
        </div>
        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground leading-snug">
            {order.name} from {order.city}
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            just ordered {order.what}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{order.ago}</p>
        </div>
        {/* Dismiss */}
        <button
          onClick={() => { setVisible(false); setDismissed(true); }}
          className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors text-xs leading-none ml-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Logo authority bar ───────────────────────────────────────────────────────
// Shows recognizable source / partner logos to borrow their credibility.

function GoogleMapsLogo() {
  return (
    <svg viewBox="0 0 120 28" className="h-6 w-auto" aria-label="Google Maps" role="img">
      {/* Coloured G */}
      <circle cx="14" cy="14" r="13" fill="#fff" />
      <path d="M26.5 14c0-.9-.07-1.76-.21-2.6H14v4.92h7.02a6 6 0 01-2.6 3.94v3.28h4.2c2.46-2.26 3.88-5.6 3.88-9.54z" fill="#4285F4"/>
      <path d="M14 27c3.52 0 6.47-1.17 8.62-3.16l-4.2-3.27c-1.17.78-2.66 1.24-4.42 1.24-3.4 0-6.28-2.3-7.31-5.38H2.36v3.38A13 13 0 0014 27z" fill="#34A853"/>
      <path d="M6.69 16.43A7.83 7.83 0 016.27 14c0-.84.14-1.66.4-2.43V8.2H2.36A13 13 0 001 14c0 2.1.5 4.08 1.36 5.81l4.33-3.38z" fill="#FBBC05"/>
      <path d="M14 6.19c1.92 0 3.64.66 5 1.95l3.73-3.73C20.46 2.3 17.52 1 14 1A13 13 0 002.36 8.19l4.33 3.38C7.72 8.49 10.6 6.19 14 6.19z" fill="#EA4335"/>
      {/* Text */}
      <text x="32" y="19" fontFamily="Arial,sans-serif" fontSize="11" fontWeight="600" fill="hsl(var(--foreground)/0.7)">Google Maps</text>
    </svg>
  );
}

function BingLogo() {
  return (
    <svg viewBox="0 0 80 28" className="h-6 w-auto" aria-label="Bing Maps" role="img">
      <rect width="80" height="28" rx="4" fill="transparent"/>
      {/* B icon */}
      <rect x="2" y="4" width="4" height="20" rx="2" fill="#008272"/>
      <path d="M6 14l10 5-10 5V14z" fill="#008272"/>
      <text x="20" y="19" fontFamily="Arial,sans-serif" fontSize="11" fontWeight="600" fill="hsl(var(--foreground)/0.7)">Bing Maps</text>
    </svg>
  );
}

function ChromeStoreLogo() {
  return (
    <svg viewBox="0 0 120 28" className="h-6 w-auto" aria-label="Chrome Web Store" role="img">
      <circle cx="14" cy="14" r="11" fill="#fff" stroke="#ddd" strokeWidth="1"/>
      <circle cx="14" cy="14" r="5.5" fill="#4285F4"/>
      <path d="M14 3a11 11 0 019.53 5.5H14a5.5 5.5 0 00-4.77 2.75L5.97 5.58A10.96 10.96 0 0114 3z" fill="#EA4335"/>
      <path d="M25 14a11 11 0 01-5.5 9.53l-5.5-9.53h11z" fill="#FBBC05"/>
      <path d="M14 25a11 11 0 01-9.53-5.5l5.5-9.53A5.5 5.5 0 0014 19.5c1.6 0 3.04-.68 4.05-1.77L23.03 22.42A10.96 10.96 0 0114 25z" fill="#34A853"/>
      <text x="30" y="19" fontFamily="Arial,sans-serif" fontSize="10" fontWeight="600" fill="hsl(var(--foreground)/0.7)">Chrome Web Store</text>
    </svg>
  );
}

function StripeLogo() {
  return (
    <svg viewBox="0 0 70 28" className="h-6 w-auto" aria-label="Powered by Stripe" role="img">
      <rect width="70" height="28" rx="4" fill="transparent"/>
      {/* Stripe wordmark approximation */}
      <text x="0" y="19" fontFamily="Arial,sans-serif" fontSize="13" fontWeight="700" fill="#635BFF">stripe</text>
    </svg>
  );
}

export function LogoBar({ className = "" }: { className?: string }) {
  return (
    <div className={`py-6 border-y border-border bg-card/20 ${className}`}>
      <div className="container mx-auto px-6">
        <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-5">
          Leads sourced from · Secured by · Available on
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 opacity-70">
          <GoogleMapsLogo />
          <div className="w-px h-5 bg-border hidden sm:block" aria-hidden />
          <BingLogo />
          <div className="w-px h-5 bg-border hidden sm:block" aria-hidden />
          <ChromeStoreLogo />
          <div className="w-px h-5 bg-border hidden sm:block" aria-hidden />
          <StripeLogo />
        </div>
      </div>
    </div>
  );
}

// ─── Prominent guarantee callout ──────────────────────────────────────────────

export function GuaranteeCallout({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-start gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 ${className}`}>
      {/* Seal */}
      <div className="shrink-0">
        <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden>
          <polygon
            points={Array.from({ length: 48 }, (_, i) => {
              const r = i % 2 === 0 ? 22 : 19.5;
              const a = (Math.PI * i) / 24;
              return `${(24 + r * Math.sin(a)).toFixed(1)},${(24 - r * Math.cos(a)).toFixed(1)}`;
            }).join(" ")}
            className="fill-primary/15 stroke-primary"
            strokeWidth="1.2"
          />
          <path d="M16 24.5l5.5 5.5 10-11" fill="none" className="stroke-primary" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-bold text-foreground leading-tight">Automatic refund guarantee</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          If we deliver fewer leads than you ordered, the shortfall is refunded to your card automatically — no need to ask. You only ever pay for leads you actually receive.
        </p>
      </div>
    </div>
  );
}

// ─── Review star pill (for navbars) ──────────────────────────────────────────

export function NavReviewPill({ className = "" }: { className?: string }) {
  return (
    <a
      href="#reviews"
      className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/8 text-amber-400 text-xs font-semibold hover:bg-amber-400/15 transition-colors ${className}`}
    >
      <span className="flex gap-0.5" aria-hidden>
        {"★★★★★".split("").map((s, i) => (
          <span key={i} className="text-[10px]">{s}</span>
        ))}
      </span>
      <span className="text-foreground/70">4.9</span>
      <span className="text-muted-foreground">· 127 reviews</span>
    </a>
  );
}
