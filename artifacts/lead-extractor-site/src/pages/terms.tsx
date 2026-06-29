import { Zap } from "lucide-react";
import { useSeo } from "@/lib/seo";
import { MobileNav } from "@/components/site/mobile-nav";

const STORE_URL =
  "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";
const SUPPORT_EMAIL = "support@mapleadextractor.net";
const LAST_UPDATED = "June 29, 2026";

export default function Terms() {
  useSeo({
    title: "Terms of Service — Map Lead Extractor",
    description:
      "The terms governing your use of the Map Lead Extractor browser extensions and website for finding local business leads from Google Maps and Bing Maps.",
    path: "/terms",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <a
            href="/"
            className="flex items-center gap-2 font-display font-bold text-xl tracking-tight hover:opacity-90 transition-opacity"
          >
            <Zap className="w-5 h-5 text-primary" />
            <span>
              Map<span className="text-primary">Lead</span>Extractor
            </span>
          </a>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
            <a href="/#extensions" className="hover:text-foreground transition-colors">Products</a>
            <a href="/pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <a href="/blog" className="hover:text-foreground transition-colors">Blog</a>
          </nav>
          <MobileNav />
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Install Free
          </a>
        </div>
      </header>

      <main className="pt-32 pb-32">
        <div className="container mx-auto px-6 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">Terms of Service</h1>
          <p className="text-muted-foreground mb-12">Last updated: {LAST_UPDATED}</p>

          <div className="prose prose-invert max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-primary">
            <p>
              These Terms of Service ("Terms") govern your use of the Map Lead Extractor browser
              extensions and website (the "Service"). By installing the extension or using the
              website, you agree to these Terms.
            </p>

            <h2>Use of the Service</h2>
            <p>
              We grant you a personal, non-exclusive, non-transferable license to use the Service.
              The extension extracts publicly available business information from map platforms and
              exports it to a CSV file on your device. You may use the Service only for lawful
              purposes.
            </p>

            <h2>Your responsibilities</h2>
            <ul>
              <li>
                You are solely responsible for how you collect and use the data you extract,
                including compliance with applicable laws such as GDPR and CAN-SPAM, and with the
                terms of service of the platforms you collect data from.
              </li>
              <li>You will not use the Service to send unlawful spam or to harass anyone.</li>
              <li>
                You will not resell, reverse-engineer, or attempt to disrupt the Service or its
                infrastructure.
              </li>
            </ul>

            <h2>Plans and payments</h2>
            <p>
              The core extraction tools are free to use. Optional paid plans, where offered, are
              billed through Stripe. Fees are described on our{" "}
              <a href="/pricing">pricing page</a>. Except where required by law, payments are
              non-refundable.
            </p>

            <h2>No warranty</h2>
            <p>
              The Service is provided "as is" and "as available", without warranties of any kind.
              We do not guarantee that extracted data will be complete, accurate, or fit for any
              particular purpose, or that the Service will be uninterrupted or error-free.
            </p>

            <h2>Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, Map Lead Extractor will not be liable for any
              indirect, incidental, or consequential damages arising from your use of the Service.
            </p>

            <h2>Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after a
              change means you accept the revised Terms.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about these Terms? Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-card border-t border-border py-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground gap-4">
          <div>&copy; {new Date().getFullYear()} MapLeadExtractor. All rights reserved.</div>
          <nav className="flex gap-6">
            <a href="/privacy" className="hover:text-primary transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-primary transition-colors">Terms</a>
            <a href="/blog" className="hover:text-primary transition-colors">Blog</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
