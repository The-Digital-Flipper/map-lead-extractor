// One-off backfill: compute opportunityScore + needs for every existing lead,
// using the same shared scoring used on live saves so numbers stay in sync.
//
//   pnpm --filter @workspace/scripts run backfill-opportunity
//
// Safe to re-run — it simply recomputes from current column values.
import { db, leads, computeOpportunity, computeDemand, computeValue } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({
      id: leads.id,
      phone: leads.phone,
      emails: leads.emails,
      website: leads.website,
      facebook: leads.facebook,
      instagram: leads.instagram,
      twitter: leads.twitter,
      linkedin: leads.linkedin,
      rating: leads.rating,
      reviewCount: leads.reviewCount,
      category: leads.category,
      timesExtracted: leads.timesExtracted,
      extractedBy: leads.extractedBy,
    })
    .from(leads);

  console.log(`Backfilling opportunity + demand + value for ${rows.length} lead(s)…`);

  let updated = 0;
  for (const row of rows) {
    const { opportunityScore, needs } = computeOpportunity({
      phone: row.phone,
      emails: row.emails,
      website: row.website,
      facebook: row.facebook,
      instagram: row.instagram,
      twitter: row.twitter,
      linkedin: row.linkedin,
      // rating is stored as numeric → comes back as string
      rating: row.rating != null ? parseFloat(String(row.rating)) : null,
      reviewCount: row.reviewCount,
      category: row.category,
    });

    const timesExtracted = row.timesExtracted ?? 1;
    const distinctMembers = Array.isArray(row.extractedBy) ? row.extractedBy.length : 0;
    const demandScore = computeDemand({ timesExtracted, distinctMembers });
    const valueScore = computeValue(opportunityScore, demandScore);

    await db.update(leads).set({ opportunityScore, needs, demandScore, valueScore }).where(eq(leads.id, row.id));
    updated++;
    if (updated % 500 === 0) console.log(`  …${updated}/${rows.length}`);
  }

  console.log(`Done. Updated ${updated} lead(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
