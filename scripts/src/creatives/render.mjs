#!/usr/bin/env node
// Renders every ad creative from template.html with headless chromium, then
// downsamples the 2x screenshots to crisp JPGs (or PNG for facebook-ad).
//
//   node scripts/src/creatives/render.mjs [outDir] [variant ...]
//
// Outputs land in <outDir> (default: a tmp dir printed at the end). Copy the
// wide ones to lead-extractor-site/public/go/, the square leads-*/freetool-*
// to lead-extractor-site/public/creatives/, and fb-hero to /facebook-ad.png.
// Chromium binary: $CHROMIUM, or `chromium` on PATH.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const template = path.join(here, "template.html");
const chromium = process.env.CHROMIUM || "chromium";

// name -> [cssW, cssH]; rendered at device-scale 2 and downsampled to 1x size.
const WIDE = ["deal", "free-leads", "stop-scraping", "tonight", "agency"];
const SQUARE = ["leads-0", "leads-1", "leads-2", "leads-3", "leads-4", "freetool-0", "freetool-1", "freetool-2", "fb-hero"];

const outDir = process.argv[2] || mkdtempSync(path.join(tmpdir(), "creatives-"));
const only = process.argv.slice(3);
mkdirSync(outDir, { recursive: true });

for (const v of [...WIDE, ...SQUARE]) {
  if (only.length && !only.includes(v)) continue;
  const [w, h] = WIDE.includes(v) ? [1536, 1024] : [1080, 1080];
  const png = path.join(outDir, `${v}.png`);
  execFileSync(chromium, [
    "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    // This chromium counts window chrome in --window-size, so give the
    // window height slack and crop the shot to the exact canvas below.
    `--window-size=${w},${h + 240}`,
    "--virtual-time-budget=4000", `--screenshot=${png}`,
    `file://${template}?v=${v}`,
  ], { stdio: "pipe" });
  execFileSync("magick", [png, "-crop", `${w}x${h}+0+0`, "+repage", png]);
  // JPG for everything except fb-hero, which ships as facebook-ad.png.
  if (v !== "fb-hero") {
    execFileSync("magick", [png, "-quality", "92", path.join(outDir, `${v}.jpg`)]);
  }
  console.log(`rendered ${v}`);
}
console.log(`\nout: ${outDir}`);
