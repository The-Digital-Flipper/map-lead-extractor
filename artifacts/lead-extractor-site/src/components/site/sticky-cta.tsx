import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

// Mobile-only sticky bottom CTA for the paid/social landing pages. Appears
// once the visitor scrolls past the hero and hides while the #buy section is
// on screen, so it never covers the checkout button it points to. Claims here
// mirror real site policy — keep in sync with trust-badges.tsx.
export default function StickyCta({
  label = "Get 100 for $29",
  free = false,
}: {
  label?: string;
  /** Sample-first pages lead with the free preview instead of the price. */
  free?: boolean;
}) {
  const [pastHero, setPastHero] = useState(false);
  const [buyInView, setBuyInView] = useState(false);

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const buy = document.getElementById("buy");
    let io: IntersectionObserver | null = null;
    if (buy && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        ([entry]) => setBuyInView(entry.isIntersecting),
        { threshold: 0.08 },
      );
      io.observe(buy);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, []);

  const show = pastHero && !buyInView;

  return (
    <div
      className={`md:hidden fixed bottom-0 inset-x-0 z-50 transition-transform duration-300 ${show ? "translate-y-0" : "translate-y-full"}`}
      aria-hidden={!show}
    >
      <div className="bg-background/95 backdrop-blur-md border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {free ? (
              <>
                <div className="text-base font-display font-bold text-foreground leading-tight">
                  5 real leads — free
                </div>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                  <ShieldCheck className="w-3 h-3 text-primary shrink-0" /> No credit card required
                </p>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-display font-bold text-foreground">$29</span>
                  <span className="text-xs text-muted-foreground">100 leads · 29¢ each</span>
                </div>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                  <ShieldCheck className="w-3 h-3 text-primary shrink-0" /> Money-back guarantee
                </p>
              </>
            )}
          </div>
          <a
            href="#buy"
            data-testid="btn-sticky-cta"
            className="shrink-0 inline-flex items-center gap-1.5 h-12 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/30 hover:opacity-90 transition-opacity"
          >
            {label} <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
