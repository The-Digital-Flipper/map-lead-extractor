import { useState } from "react";
import { Menu, Zap } from "lucide-react";
import { SiGooglechrome } from "react-icons/si";
import { Sheet, SheetContent, SheetClose, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

const STORE_URL =
  "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/#industries", label: "Industries" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/tools", label: "Free Tools" },
  { href: "/#faq", label: "FAQ" },
];

/**
 * Accessible mobile navigation for the marketing site. Hidden on md+ (desktop
 * nav is unchanged). Built on the Sheet (Radix Dialog) primitive, so it gets a
 * focus trap, Escape-to-close, aria-modal, and an animated slide-in for free —
 * with no layout shift (it overlays).
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg border border-border text-foreground hover:border-primary hover:text-primary transition-colors"
          data-testid="button-mobile-nav"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[80vw] max-w-xs bg-background border-border p-0">
        <div className="flex items-center gap-2 font-display font-bold text-xl tracking-tight px-6 h-16 border-b border-border">
          <Zap className="w-5 h-5 text-primary" />
          <SheetTitle className="font-display font-bold text-xl">
            Map<span className="text-primary">Lead</span>Extractor
          </SheetTitle>
        </div>
        <nav aria-label="Mobile" className="flex flex-col p-4 gap-1">
          {LINKS.map((l) => (
            <SheetClose asChild key={l.href}>
              <a
                href={l.href}
                className="rounded-lg px-4 py-3 text-base font-medium text-foreground hover:bg-card hover:text-primary transition-colors"
              >
                {l.label}
              </a>
            </SheetClose>
          ))}
          <SheetClose asChild>
            <a
              href={STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-3 text-base font-bold hover:opacity-90 transition-opacity"
            >
              <SiGooglechrome className="h-5 w-5" /> Install Free
            </a>
          </SheetClose>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
