// Visual trust badges shown near buy CTAs. Every claim here mirrors real
// site policy (Stripe checkout, auto-refund on shortfall, 24h delivery,
// human review) — keep them in sync with lead-pack-widget.tsx and the FAQs.

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

const BADGES = [
  {
    icon: GuaranteeSeal,
    title: "Money-Back Guarantee",
    sub: "Any shortfall is refunded automatically — no questions asked",
  },
  {
    icon: StripeShield,
    title: "Secured by Stripe",
    sub: "256-bit SSL checkout — card details never touch our servers",
  },
  {
    icon: DeliveryClock,
    title: "Delivered in Hours",
    sub: "CSV in your inbox same day — never more than 24 hours",
  },
  {
    icon: HumanCheck,
    title: "Human-Reviewed",
    sub: "A real person checks every pack before it ships",
  },
];

function CardMark({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex">
      {children}
    </span>
  );
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
