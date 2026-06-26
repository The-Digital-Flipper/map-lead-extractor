import { Router } from "express";

const router = Router();

const PRIVACY_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Privacy Policy — Map Lead Extractor - Google Maps</title>
  <style>
    body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; color: #1a2238; line-height: 1.6; background: #f7f9fe; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    .updated { color: #6b779b; font-size: 14px; margin-bottom: 28px; }
    h2 { font-size: 19px; margin-top: 30px; color: #0d1534; }
    ul { padding-left: 20px; }
    a { color: #2aa3ff; }
    .foot { margin-top: 36px; font-size: 13px; color: #6b779b; border-top: 1px solid #e3e8f4; padding-top: 16px; }
  </style>
</head>
<body>
  <h1>Privacy Policy — Map Lead Extractor - Google Maps</h1>
  <div class="updated">Last updated: June 26, 2026</div>

  <p>Map Lead Extractor - Google Maps (&ldquo;the extension&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a browser extension that helps users extract publicly visible business listing information from Google Maps and export it for their own lead-generation use. This policy explains what the extension accesses, how that information is used, and what we do not do.</p>

  <h2>1. Information the extension accesses</h2>
  <ul>
    <li>Public business listing data shown in Google Maps search results: business name, address, phone number, website URL, star rating, review count, category, hours, price level, and Plus Code.</li>
    <li>When the optional &ldquo;Enrichment&rdquo; feature is enabled by the user, the public content of each business&rsquo;s own website, to collect the email address and social media links the business publishes there (e.g., Facebook, Instagram, X, LinkedIn, YouTube, TikTok).</li>
  </ul>
  <p>This is publicly available business contact information. It is not the personal data of the person using the extension.</p>

  <h2>2. How information is used</h2>
  <ul>
    <li>Extracted business data is displayed inside the extension and can be exported by the user to CSV or XLSX files.</li>
    <li>When the user runs an extraction, the extracted business leads are sent to our backend at mapleadextractor.net so the user can save their lists and re-export them later. This data is stored only to provide the save/export feature.</li>
  </ul>

  <h2>3. Local storage</h2>
  <p>The extension stores the user&rsquo;s own settings (such as whether Auto-scroll and Enrichment are enabled) and partial results locally in the browser, so progress is not lost between sessions.</p>

  <h2>4. Information we do not collect</h2>
  <ul>
    <li>We do not collect the user&rsquo;s personal identity, account credentials, or payment information.</li>
    <li>We do not collect the user&rsquo;s browsing history, keystrokes, mouse activity, or location (IP/GPS).</li>
    <li>We do not track users across websites.</li>
  </ul>

  <h2>5. Data sharing</h2>
  <ul>
    <li>We do not sell or rent user data to third parties.</li>
    <li>We do not use or transfer data for purposes unrelated to the extension&rsquo;s single purpose.</li>
    <li>We do not use data to determine creditworthiness or for lending.</li>
  </ul>

  <h2>6. Data retention &amp; removal</h2>
  <p>Leads a user chooses to save are retained on our backend so the user can access and export them. To request deletion of saved data, contact us at the email below.</p>

  <h2>7. Permissions</h2>
  <ul>
    <li><strong>storage</strong> — to save the user&rsquo;s settings and partial results locally.</li>
    <li><strong>tabs</strong> — to open Google Maps and target the active Google Maps tab.</li>
    <li><strong>host access</strong> — so the optional Enrichment feature can fetch each extracted business&rsquo;s public website to read its contact details, and so leads can be sent to the user&rsquo;s backend for saving.</li>
  </ul>

  <h2>8. Changes to this policy</h2>
  <p>We may update this policy from time to time. The &ldquo;Last updated&rdquo; date above reflects the latest revision.</p>

  <h2>9. Contact</h2>
  <p>Questions or data-deletion requests: <a href="mailto:swoopaai@protonmail.com">swoopaai@protonmail.com</a></p>

  <div class="foot">This extension is an independent tool and is not affiliated with, endorsed by, or sponsored by Google. &ldquo;Google&rdquo; and &ldquo;Google Maps&rdquo; are trademarks of Google LLC.</div>
</body>
</html>`;

router.get("/privacy", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(PRIVACY_HTML);
});

export default router;
