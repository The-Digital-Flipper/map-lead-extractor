import { Zap } from "lucide-react";
import { useSeo } from "@/lib/seo";
import { MobileNav } from "@/components/site/mobile-nav";

const STORE_URL =
  "https://chromewebstore.google.com/detail/map-lead-extractor/hdcllknjhfjlgifobniljjgfgmdjhfmg";
const SUPPORT_EMAIL = "support@mapleadextractor.net";
const LAST_UPDATED = "June 29, 2026";

export default function Privacy() {
  useSeo({
    title: "Privacy Policy — Map Lead Extractor",
    description:
      "How Map Lead Extractor handles your data. The browser extension runs entirely on your device — we run no tracking telemetry and store extracted leads only on your own computer.",
    path: "/privacy",
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
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground mb-12">Last updated: {LAST_UPDATED}</p>

          <div className="prose prose-invert max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-primary">
            <p>
              Map Lead Extractor ("we", "us") builds browser extensions and a website that help
              people find local business leads from Google Maps and Bing Maps. We designed the
              product to collect as little of your data as possible. This policy explains what we do
              and don't collect.
            </p>

            <h2>The extension runs on your device</h2>
            <p>
              The Map Lead Extractor browser extensions run entirely inside your own browser. When
              you extract leads, the data is processed in your browser's local memory and exported
              directly to your computer's Downloads folder as a CSV file. We do not transmit the
              leads you extract to our servers, and we do not store them.
            </p>

            <h2>What we don't collect</h2>
            <ul>
              <li>We do not run analytics or tracking telemetry inside the extension.</li>
              <li>We do not sell, rent, or share your personal information.</li>
              <li>We do not store the business leads you extract.</li>
            </ul>

            <h2>Account and website data</h2>
            <p>
              If you create an account on our website, authentication is handled by our identity
              provider (Clerk). To operate your account we process basic details such as your email
              address and sign-in metadata. Our website may set essential cookies required for
              sign-in and security. Payment processing, if you upgrade, is handled by Stripe; we do
              not store your full card details.
            </p>

            <h2>Third-party services</h2>
            <p>
              We rely on a small number of reputable processors to run the service, including Clerk
              (authentication) and Stripe (payments). Each processes data only as needed to provide
              its function and under its own privacy terms.
            </p>

            <h2>Your rights</h2>
            <p>
              You can request access to, correction of, or deletion of any account data we hold.
              Because extracted leads never leave your device, there is nothing on our side to
              delete for that data. To make a request, email us at the address below.
            </p>

            <h2>Your responsibilities</h2>
            <p>
              You are responsible for how you use the data you extract. Use leads lawfully and in
              line with applicable regulations such as GDPR, CAN-SPAM, and the terms of the
              platforms you collect data from.
            </p>

            <h2>Changes to this policy</h2>
            <p>
              We may update this policy from time to time. When we do, we'll revise the "Last
              updated" date above.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about privacy? Email{" "}
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
