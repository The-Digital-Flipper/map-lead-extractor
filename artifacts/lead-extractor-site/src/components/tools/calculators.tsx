import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const r = useMemo(() => {
    const customers = leads * (conv / 100);
    const revenue = customers * deal;
    const hoursSaved = (leads * minsPerLead) / 60;
    const roi = cost > 0 ? ((revenue - cost) / cost) * 100 : Infinity;
    return { customers, revenue, hoursSaved, roi };
  }, [leads, conv, deal, cost, minsPerLead]);

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

  const r = useMemo(() => {
    const perLead = value * (margin / 100) * (close / 100);
    const maxCpl = multiple > 0 ? perLead / multiple : 0;
    const customers = leads * (close / 100);
    return { perLead, maxCpl, customers };
  }, [value, margin, close, multiple, leads]);

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

  const r = useMemo(() => {
    const deliveryCost = hours * rate + overhead;
    const retainer = margin < 100 ? deliveryCost / (1 - margin / 100) : Infinity;
    const profit = retainer - deliveryCost;
    return { deliveryCost, retainer, profit };
  }, [hours, rate, overhead, margin]);

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

export function Calculator({ kind }: { kind: "roi" | "leadValue" | "agencyPricing" }) {
  if (kind === "roi") return <RoiCalculator />;
  if (kind === "leadValue") return <LeadValueCalculator />;
  return <AgencyPricingCalculator />;
}
