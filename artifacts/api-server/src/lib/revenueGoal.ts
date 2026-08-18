/**
 * Revenue Goal Tracker — the math behind "grow toward $10k/month". Pulls live
 * MRR (Stripe) + recent one-time pack revenue, sums the estimated pipeline from
 * lead_intel, and computes exactly what it takes to hit the monthly goal: how
 * many Starter/Pro/Agency subscribers are needed, the close rate the current
 * pipeline implies, and how many fresh leads to work per week.
 */
import { db, leadIntel, packOrders, OPEN_STAGES } from "@workspace/db";
import { and, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";

// Display-only subscription tiers (matches the pricing page). Whole dollars/mo.
export const TIERS = { starter: 49, pro: 149, agency: 499 } as const;

function goalCents(): number {
  const env = Number(process.env.REVENUE_GOAL_CENTS);
  return Number.isFinite(env) && env > 0 ? env : 1_000_000; // $10,000/mo
}

async function stripeMrrCents(): Promise<{ mrrCents: number; subscribers: number; month30Cents: number }> {
  try {
    const stripe = await getUncachableStripeClient();
    const activeSubs = await stripe.subscriptions.list({ status: "active", limit: 100, expand: ["data.items.data.price"] });
    let mrr = 0;
    for (const sub of activeSubs.data) {
      for (const item of sub.items.data) {
        const price = item.price as { unit_amount: number | null; recurring: { interval: string } | null };
        if (price.unit_amount && price.recurring) {
          mrr += (price.recurring.interval === "year" ? price.unit_amount / 12 : price.unit_amount) * (item.quantity ?? 1);
        }
      }
    }
    const thirtyAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const charges = await stripe.charges.list({ limit: 100, created: { gte: thirtyAgo } });
    const month30 = charges.data.filter((c) => c.paid && c.amount_captured > 0).reduce((s, c) => s + c.amount_captured, 0);
    return { mrrCents: Math.round(mrr), subscribers: activeSubs.data.length, month30Cents: Math.round(month30) };
  } catch {
    return { mrrCents: 0, subscribers: 0, month30Cents: 0 };
  }
}

export type RevenueGoal = {
  goal: number; // dollars/mo
  currentMrr: number;
  subscribers: number;
  monthRevenue: number; // last-30-day actual revenue (Stripe charges), dollars
  packRevenue30: number; // last-30-day one-time pack revenue, dollars
  pipelineValue: number; // sum of estimated open deals, dollars
  closedWonValue: number; // estimated value already marked Closed Won, dollars
  gapToGoal: number; // dollars of MRR still needed
  percentToGoal: number; // 0-100
  usersNeeded: { starter: number; pro: number; agency: number };
  closeRate: number; // 0-1, from pipeline outcomes (or assumed)
  closeRateAssumed: boolean;
  avgDealValue: number; // dollars
  leadsNeededPerWeek: number;
  dealsNeededPerMonth: number;
};

export async function computeRevenueGoal(): Promise<RevenueGoal> {
  const goalDollars = Math.round(goalCents() / 100);

  const [{ mrrCents, subscribers, month30Cents }, pipeRows, packRow] = await Promise.all([
    stripeMrrCents(),
    db
      .select({
        stage: leadIntel.stage,
        cnt: sql<number>`count(*)::int`,
        total: sql<number>`coalesce(sum(${leadIntel.estimatedDealValue}), 0)::int`,
      })
      .from(leadIntel)
      .groupBy(leadIntel.stage),
    db
      .select({ cents: sql<number>`coalesce(sum(${packOrders.amountCents}), 0)::int` })
      .from(packOrders)
      .where(and(isNotNull(packOrders.paidAt), gte(packOrders.paidAt, new Date(Date.now() - 30 * 864e5)))),
  ]);

  const byStage = new Map(pipeRows.map((r) => [r.stage ?? "", { cnt: Number(r.cnt), total: Number(r.total) }]));
  const openStages = new Set<string>(OPEN_STAGES);
  let pipelineValue = 0;
  for (const [stage, v] of byStage) if (openStages.has(stage)) pipelineValue += v.total;
  const won = byStage.get("Closed Won") ?? { cnt: 0, total: 0 };
  const lost = byStage.get("Closed Lost") ?? { cnt: 0, total: 0 };
  const closedWonValue = won.total;

  const currentMrr = Math.round(mrrCents / 100);
  const gapToGoal = Math.max(0, goalDollars - currentMrr);
  const usersNeeded = {
    starter: Math.ceil(gapToGoal / TIERS.starter),
    pro: Math.ceil(gapToGoal / TIERS.pro),
    agency: Math.ceil(gapToGoal / TIERS.agency),
  };

  // Close rate from real outcomes; fall back to a conservative assumption.
  const decided = won.cnt + lost.cnt;
  const closeRateAssumed = decided < 5;
  const closeRate = closeRateAssumed ? 0.2 : won.cnt / decided;

  // Average deal value across everything we've estimated (open + won).
  const valuedRows = [...byStage.values()].filter((v) => v.total > 0);
  const totalValued = valuedRows.reduce((s, v) => s + v.total, 0);
  const valuedCount = valuedRows.reduce((s, v) => s + v.cnt, 0);
  const avgDealValue = valuedCount > 0 ? Math.round(totalValued / valuedCount) : 1500;

  // How many NEW closed deals/month cover the gap, and the lead volume that
  // implies at the current close rate (÷ 4.3 weeks).
  const dealsNeededPerMonth = avgDealValue > 0 ? Math.ceil(gapToGoal / avgDealValue) : 0;
  const leadsNeededPerWeek = closeRate > 0 ? Math.ceil(dealsNeededPerMonth / closeRate / 4.3) : 0;

  return {
    goal: goalDollars,
    currentMrr,
    subscribers,
    monthRevenue: Math.round(month30Cents / 100),
    packRevenue30: Math.round(Number(packRow[0]?.cents ?? 0) / 100),
    pipelineValue,
    closedWonValue,
    gapToGoal,
    percentToGoal: goalDollars > 0 ? Math.min(100, Math.round((currentMrr / goalDollars) * 100)) : 0,
    usersNeeded,
    closeRate: Math.round(closeRate * 100) / 100,
    closeRateAssumed,
    avgDealValue,
    leadsNeededPerWeek,
    dealsNeededPerMonth,
  };
}
