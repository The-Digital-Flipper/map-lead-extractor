// Pure, framework-free business logic behind the free tools. Extracted from the
// calculator widgets so the math (which is the product's value proposition) is
// reusable and unit-testable. UI components import from here.

export interface RoiInput {
  leads: number;
  conv: number; // %
  deal: number; // $
  cost: number; // $/mo
  minsPerLead: number;
}
export interface RoiResult {
  customers: number;
  revenue: number;
  hoursSaved: number;
  roi: number; // %, Infinity when cost is 0
}
export function computeRoi({ leads, conv, deal, cost, minsPerLead }: RoiInput): RoiResult {
  const customers = leads * (conv / 100);
  const revenue = customers * deal;
  const hoursSaved = (leads * minsPerLead) / 60;
  const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : Infinity;
  return { customers, revenue, hoursSaved, roi };
}

export interface LeadValueInput {
  value: number; // $ avg customer value
  margin: number; // %
  close: number; // %
  multiple: number; // target return multiple
  leads: number;
}
export interface LeadValueResult {
  perLead: number;
  maxCpl: number;
  customers: number;
}
export function computeLeadValue({ value, margin, close, multiple, leads }: LeadValueInput): LeadValueResult {
  const perLead = value * (margin / 100) * (close / 100);
  const maxCpl = multiple > 0 ? perLead / multiple : 0;
  const customers = leads * (close / 100);
  return { perLead, maxCpl, customers };
}

export interface AgencyPricingInput {
  hours: number;
  rate: number; // $/hr blended cost
  overhead: number; // $/mo tools + ads
  margin: number; // % target
}
export interface AgencyPricingResult {
  deliveryCost: number;
  retainer: number; // Infinity when margin >= 100
  profit: number;
}
export function computeAgencyPricing({ hours, rate, overhead, margin }: AgencyPricingInput): AgencyPricingResult {
  const deliveryCost = hours * rate + overhead;
  const retainer = margin < 100 ? deliveryCost / (1 - margin / 100) : Infinity;
  const profit = retainer - deliveryCost;
  return { deliveryCost, retainer, profit };
}

export interface LeadScoreInput {
  hasWebsite: boolean;
  outdatedSite: boolean;
  claimed: boolean;
  runsAds: boolean;
  rating: number;
  reviews: number;
}
export interface LeadScorePart {
  label: string;
  pts: number;
}
export interface LeadScoreResult {
  score: number; // 0-100
  parts: LeadScorePart[];
  tier: string;
}
export function computeLeadScore({ hasWebsite, outdatedSite, claimed, runsAds, rating, reviews }: LeadScoreInput): LeadScoreResult {
  let score = 0;
  const parts: LeadScorePart[] = [];
  const add = (label: string, pts: number) => {
    if (pts) { score += pts; parts.push({ label, pts }); }
  };
  if (!hasWebsite) add("No website", 35);
  else if (outdatedSite) add("Outdated website", 20);
  if (reviews < 10) add("Very few reviews", 20);
  else if (reviews < 50) add("Low review count", 12);
  else if (reviews < 150) add("Moderate review count", 4);
  if (rating < 3.5) add("Weak rating (reputation gap)", 18);
  else if (rating < 4.2) add("Mediocre rating", 10);
  if (!claimed) add("Unclaimed / unverified listing", 15);
  if (!runsAds) add("Not advertising", 12);
  score = Math.min(100, score);
  const tier = score >= 70 ? "High-opportunity prospect" : score >= 40 ? "Worth pursuing" : "Lower priority — already well-served";
  return { score, parts, tier };
}

export const SPAM_WORDS = [
  "free", "guarantee", "guaranteed", "act now", "buy now", "cash", "cheap", "discount",
  "earn", "income", "limited time", "offer", "risk-free", "winner", "$$$", "click here",
  "urgent", "100%",
];
export interface SubjectAnalysis {
  score: number; // 0-100
  issues: string[];
  wins: string[];
  chars: number;
  words: number;
}
export function analyzeSubject(subject: string): SubjectAnalysis {
  const s = subject.trim();
  const chars = s.length;
  const words = s ? s.split(/\s+/).length : 0;
  const issues: string[] = [];
  const wins: string[] = [];
  let score = 100;

  if (chars === 0) return { score: 0, issues: ["Enter a subject line to test."], wins: [], chars, words };
  if (chars > 60) { score -= 20; issues.push(`Too long (${chars} chars) — aim for under ~50 so it isn't cut off on mobile.`); }
  else if (chars <= 50) wins.push("Good length for mobile inboxes.");
  if (words > 9) { score -= 10; issues.push(`Wordy (${words} words) — short subjects (3–7 words) open better.`); }

  const lower = s.toLowerCase();
  const foundSpam = SPAM_WORDS.filter((w) => lower.includes(w));
  if (foundSpam.length) { score -= Math.min(30, foundSpam.length * 12); issues.push(`Spam-trigger words: ${foundSpam.join(", ")}.`); }
  else wins.push("No common spam-trigger words.");

  const capsWords = s.match(/\b[A-Z]{3,}\b/g) || [];
  if (capsWords.length) { score -= 15; issues.push(`Avoid ALL CAPS (${capsWords.join(", ")}) — it reads as shouting and trips filters.`); }

  const bangs = (s.match(/[!?]/g) || []).length;
  if (bangs >= 2) { score -= 12; issues.push("Too much punctuation (!! or ?!) looks like spam."); }

  const personalized = /\{\{?\s*[\w.]+\s*\}?\}|\[[\w ]+\]|\b(your|you'?re|you)\b/i.test(s);
  if (personalized) wins.push("Personalized / relevant to the reader.");
  else { score -= 12; issues.push("No personalization — add a name, company, or city token."); }

  if (/^\s*(re:|fwd:)/i.test(s)) { score -= 20; issues.push("Fake 'Re:'/'Fwd:' is deceptive and erodes trust."); }

  score = Math.max(0, Math.min(100, score));
  return { score, issues, wins, chars, words };
}
