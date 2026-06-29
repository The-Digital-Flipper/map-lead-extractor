import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeRoi,
  computeLeadValue,
  computeAgencyPricing,
  computeLeadScore,
  analyzeSubject,
} from "../calc.ts";

test("computeRoi: revenue, customers, hours, ROI", () => {
  const r = computeRoi({ leads: 500, conv: 2, deal: 1500, cost: 99, minsPerLead: 0.75 });
  assert.equal(r.customers, 10);
  assert.equal(r.revenue, 15000);
  assert.equal(r.hoursSaved, 6.25);
  assert.ok(Math.abs(r.roi - ((15000 - 99) / 99) * 100) < 1e-6);
});

test("computeRoi: zero cost yields Infinity ROI (no divide-by-zero)", () => {
  assert.equal(computeRoi({ leads: 100, conv: 1, deal: 100, cost: 0, minsPerLead: 1 }).roi, Infinity);
});

test("computeLeadValue: value per lead and max CPL", () => {
  const r = computeLeadValue({ value: 1200, margin: 50, close: 3, multiple: 4, leads: 200 });
  assert.ok(Math.abs(r.perLead - 18) < 1e-9);
  assert.ok(Math.abs(r.maxCpl - 4.5) < 1e-9);
  assert.equal(r.customers, 6);
});

test("computeAgencyPricing: margin-first retainer", () => {
  const r = computeAgencyPricing({ hours: 12, rate: 40, overhead: 150, margin: 60 });
  assert.equal(r.deliveryCost, 630);
  assert.ok(Math.abs(r.retainer - 1575) < 1e-9);
  assert.ok(Math.abs(r.profit - 945) < 1e-9);
});

test("computeAgencyPricing: 100% margin does not divide by zero", () => {
  assert.equal(computeAgencyPricing({ hours: 1, rate: 1, overhead: 0, margin: 100 }).retainer, Infinity);
});

test("computeLeadScore: weak prospect scores high with reasons", () => {
  const r = computeLeadScore({ hasWebsite: false, outdatedSite: false, claimed: false, runsAds: false, rating: 3.4, reviews: 5 });
  // 35 + 20 + 18 + 15 + 12 = 100
  assert.equal(r.score, 100);
  assert.equal(r.tier, "High-opportunity prospect");
  assert.ok(r.parts.some((p) => p.label === "No website" && p.pts === 35));
});

test("computeLeadScore: strong business scores low with no parts", () => {
  const r = computeLeadScore({ hasWebsite: true, outdatedSite: false, claimed: true, runsAds: true, rating: 4.9, reviews: 400 });
  assert.equal(r.score, 0);
  assert.equal(r.parts.length, 0);
  assert.equal(r.tier, "Lower priority — already well-served");
});

test("computeLeadScore: caps at 100", () => {
  const r = computeLeadScore({ hasWebsite: false, outdatedSite: false, claimed: false, runsAds: false, rating: 1, reviews: 0 });
  assert.ok(r.score <= 100);
});

test("analyzeSubject: strong subject scores well", () => {
  const r = analyzeSubject("Quick idea for {{company}}");
  assert.ok(r.score >= 80);
  assert.ok(r.wins.length > 0);
});

test("analyzeSubject: spammy subject is penalized (incl. $$$)", () => {
  const r = analyzeSubject("FREE WEBSITE AUDIT!!! $$$");
  assert.ok(r.score < 55);
  assert.ok(r.issues.length >= 2);
});

test("analyzeSubject: empty input", () => {
  assert.equal(analyzeSubject("   ").score, 0);
});
