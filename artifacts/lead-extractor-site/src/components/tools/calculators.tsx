import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CsvCleaner } from "@/components/tools/csv-cleaner";
import {
  computeRoi,
  computeLeadValue,
  computeAgencyPricing,
  computeLeadScore,
  analyzeSubject,
} from "@/lib/calc";

const usd = (n: number) =>
  isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "—";
const num = (n: number) => (isFinite(n) ? Math.round(n).toLocaleString("en-US") : "—");
const pct = (n: number) => (isFinite(n) ? `${Math.round(n)}%` : "—");

function Field({
  id,
  label,
  value,
  onChange,
  suffix,
  step = 1,
  min = 0,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
          className="h-12 text-lg"
          data-testid={`input-${id}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function Result({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? "border-primary/50 bg-primary/5" : "border-border bg-card/40"}`}>
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className={`font-display font-bold ${highlight ? "text-3xl text-primary" : "text-2xl text-foreground"}`}>{value}</div>
    </div>
  );
}

export function RoiCalculator() {
  const [leads, setLeads] = useState(500);
  const [conv, setConv] = useState(2);
  const [deal, setDeal] = useState(1500);
  const [cost, setCost] = useState(99);
  const [minsPerLead, setMins] = useState(0.75);

  const r = useMemo(() => computeRoi({ leads, conv, deal, cost, minsPerLead }), [leads, conv, deal, cost, minsPerLead]);

  return (
    <Card className="border-border bg-background">
      <CardContent className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
        <div className="space-y-5">
          <Field id="leads" label="Leads extracted per month" value={leads} onChange={setLeads} step={50} />
          <Field id="conv" label="Conversion rate" value={conv} onChange={setConv} suffix="%" step={0.5} />
          <Field id="deal" label="Average deal value" value={deal} onChange={setDeal} suffix="$" step={100} />
          <Field id="cost" label="Monthly tool cost" value={cost} onChange={setCost} suffix="$" step={10} />
          <Field id="mins" label="Minutes saved per lead vs. manual" value={minsPerLead} onChange={setMins} step={0.25} />
        </div>
        <div className="space-y-4 self-start">
          <Result label="New customers / month" value={num(r.customers)} />
          <Result label="New revenue / month" value={usd(r.revenue)} />
          <Result label="Hours saved / month" value={`${num(r.hoursSaved)} hrs`} />
          <Result label="Monthly ROI" value={r.roi === Infinity ? "∞" : pct(r.roi)} highlight />
        </div>
      </CardContent>
    </Card>
  );
}

export function LeadValueCalculator() {
  const [value, setValue] = useState(1200);
  const [margin, setMargin] = useState(50);
  const [close, setClose] = useState(3);
  const [multiple, setMultiple] = useState(4);
  const [leads, setLeads] = useState(200);

  const r = useMemo(() => computeLeadValue({ value, margin, close, multiple, leads }), [value, margin, close, multiple, leads]);

  return (
    <Card className="border-border bg-background">
      <CardContent className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
        <div className="space-y-5">
          <Field id="value" label="Average customer value" value={value} onChange={setValue} suffix="$" step={100} />
          <Field id="margin" label="Gross margin" value={margin} onChange={setMargin} suffix="%" step={5} />
          <Field id="close" label="Lead-to-customer close rate" value={close} onChange={setClose} suffix="%" step={0.5} />
          <Field id="multiple" label="Target return multiple" value={multiple} onChange={setMultiple} suffix="x" step={1} />
          <Field id="leads" label="Leads in a batch" value={leads} onChange={setLeads} step={50} />
        </div>
        <div className="space-y-4 self-start">
          <Result label="Value per lead" value={usd(r.perLead)} highlight />
          <Result label="Max cost per lead" value={usd(r.maxCpl)} />
          <Result label="Customers from this batch" value={num(r.customers)} />
        </div>
      </CardContent>
    </Card>
  );
}

export function AgencyPricingCalculator() {
  const [hours, setHours] = useState(12);
  const [rate, setRate] = useState(40);
  const [overhead, setOverhead] = useState(150);
  const [margin, setMargin] = useState(60);

  const r = useMemo(() => computeAgencyPricing({ hours, rate, overhead, margin }), [hours, rate, overhead, margin]);

  return (
    <Card className="border-border bg-background">
      <CardContent className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
        <div className="space-y-5">
          <Field id="hours" label="Delivery hours per client / month" value={hours} onChange={setHours} step={1} />
          <Field id="rate" label="Blended hourly cost" value={rate} onChange={setRate} suffix="$" step={5} />
          <Field id="overhead" label="Tools + ad overhead / month" value={overhead} onChange={setOverhead} suffix="$" step={25} />
          <Field id="margin" label="Target profit margin" value={margin} onChange={setMargin} suffix="%" step={5} />
        </div>
        <div className="space-y-4 self-start">
          <Result label="Monthly delivery cost" value={usd(r.deliveryCost)} />
          <Result label="Recommended retainer" value={usd(r.retainer)} highlight />
          <Result label="Monthly profit" value={usd(r.profit)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-4 cursor-pointer rounded-xl border border-border bg-card/40 p-4">
      <span className="text-sm font-medium">{label}</span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} data-testid={`toggle-${id}`} />
    </label>
  );
}

export function LeadScoreCalculator() {
  const [hasWebsite, setHasWebsite] = useState(false);
  const [outdatedSite, setOutdatedSite] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [runsAds, setRunsAds] = useState(false);
  const [rating, setRating] = useState(3.8);
  const [reviews, setReviews] = useState(20);

  const r = useMemo(
    () => computeLeadScore({ hasWebsite, outdatedSite, claimed, runsAds, rating, reviews }),
    [hasWebsite, outdatedSite, claimed, runsAds, rating, reviews],
  );

  return (
    <Card className="border-border bg-background">
      <CardContent className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Toggle id="hasWebsite" label="Business has a website" checked={hasWebsite} onChange={setHasWebsite} />
          {hasWebsite && <Toggle id="outdated" label="…but it looks outdated / not mobile-friendly" checked={outdatedSite} onChange={setOutdatedSite} />}
          <Toggle id="claimed" label="Google listing is claimed / verified" checked={claimed} onChange={setClaimed} />
          <Toggle id="runsAds" label="Business is running ads" checked={runsAds} onChange={setRunsAds} />
          <Field id="rating" label="Google star rating" value={rating} onChange={setRating} suffix="★" step={0.1} />
          <Field id="reviews" label="Number of reviews" value={reviews} onChange={setReviews} step={5} />
        </div>
        <div className="space-y-4 self-start">
          <Result label="Opportunity score" value={`${r.score} / 100`} highlight />
          <Result label="Verdict" value={r.tier} />
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="text-sm text-muted-foreground mb-2">Why this score</div>
            {r.parts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Strong online presence — limited obvious gaps to pitch.</p>
            ) : (
              <ul className="space-y-1">
                {r.parts.map((p, i) => (
                  <li key={i} className="flex justify-between text-sm"><span>{p.label}</span><span className="text-primary font-semibold">+{p.pts}</span></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SubjectLineTester() {
  const [subject, setSubject] = useState("Quick idea for {{company}}'s Google listing");

  const r = useMemo(() => analyzeSubject(subject), [subject]);

  const grade = r.score >= 80 ? "Strong" : r.score >= 55 ? "Okay" : "Needs work";

  return (
    <Card className="border-border bg-background">
      <CardContent className="p-6 md:p-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="subject" className="text-sm font-medium">Your subject line</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-12 text-lg" placeholder="e.g. Quick idea for {{company}}" data-testid="input-subject" />
          <p className="text-xs text-muted-foreground">{r.chars} characters · {r.words} words</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <Result label="Score" value={`${r.score} / 100`} highlight />
          <Result label="Grade" value={grade} />
          <Result label="Length" value={`${r.chars} chars`} />
        </div>
        {r.issues.length > 0 && (
          <div>
            <div className="text-sm font-semibold mb-2 text-foreground">Fix these</div>
            <ul className="space-y-1">{r.issues.map((it, i) => <li key={i} className="text-sm text-muted-foreground">• {it}</li>)}</ul>
          </div>
        )}
        {r.wins.length > 0 && (
          <div>
            <div className="text-sm font-semibold mb-2 text-primary">Working well</div>
            <ul className="space-y-1">{r.wins.map((it, i) => <li key={i} className="text-sm text-muted-foreground">✓ {it}</li>)}</ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Calculator({ kind }: { kind: "roi" | "leadValue" | "agencyPricing" | "leadScore" | "subjectTester" | "csvCleaner" }) {
  if (kind === "roi") return <RoiCalculator />;
  if (kind === "leadValue") return <LeadValueCalculator />;
  if (kind === "agencyPricing") return <AgencyPricingCalculator />;
  if (kind === "leadScore") return <LeadScoreCalculator />;
  if (kind === "subjectTester") return <SubjectLineTester />;
  return <CsvCleaner />;
}
