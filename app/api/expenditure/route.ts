import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebaseAdmin";

/**
 * GET /api/expenditure
 *
 * Query params:
 *   region  - "flanders" | "wallonia" | "brussels" | "federal" | "all" (default: "all")
 *   year    - 2025 | 2026 (default: 2026)
 *   basis   - "commitment" | "payment" (default: "commitment")
 *
 * Returns real data only, straight from Firestore (seeded from the two
 * source CSVs). No placeholder or invented figures.
 *
 * Example: /api/expenditure?region=flanders&year=2026&basis=commitment
 */

const VALID_REGIONS = ["flanders", "wallonia", "brussels", "federal"];
const VALID_BASES = ["commitment", "payment"];

type ExpenditureDoc = {
  region_id: string;
  department_id: string;
  financial_year: number;
  cofog_division: string | null;
  cofog_division_name: string | null;
  cofog_basis: string | null;
  original_code: string | null;
  original_name_native: string | null;
  original_name_en: string | null;
  commitment_amount_eur_000: number | null;
  payment_amount_eur_000: number | null;
  notes: string | null;
};

type RegionDoc = {
  id: string;
  names: Record<string, string>;
  heraldic_color: string;
  populations: Record<string, number>;
  population_source: string;
};

function amountField(basis: string): "commitment_amount_eur_000" | "payment_amount_eur_000" {
  return basis === "payment" ? "payment_amount_eur_000" : "commitment_amount_eur_000";
}

// Guards against any non-numeric value that might end up in Firestore
// (e.g. a data-entry error) — treats it as "not quantified" (excluded from
// the sum) rather than corrupting the total via string concatenation or NaN.
function safeAmount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const regionParam = (searchParams.get("region") || "all").toLowerCase();
  const yearParam = parseInt(searchParams.get("year") || "2026", 10);
  const basisParam = (searchParams.get("basis") || "commitment").toLowerCase();

  if (regionParam !== "all" && !VALID_REGIONS.includes(regionParam)) {
    return NextResponse.json(
      { error: `Invalid region "${regionParam}". Must be one of: all, ${VALID_REGIONS.join(", ")}` },
      { status: 400 }
    );
  }
  if (![2025, 2026].includes(yearParam)) {
    return NextResponse.json({ error: `Invalid year "${yearParam}". Must be 2025 or 2026.` }, { status: 400 });
  }
  if (!VALID_BASES.includes(basisParam)) {
    return NextResponse.json(
      { error: `Invalid basis "${basisParam}". Must be one of: ${VALID_BASES.join(", ")}` },
      { status: 400 }
    );
  }

  const db = getDb();
  const field = amountField(basisParam);

  try {
    // Fetch region metadata (population, names, color) for the region(s) requested.
    const regionIds = regionParam === "all" ? VALID_REGIONS : [regionParam];
    const regionDocs = await Promise.all(
      regionIds.map((id) => db.collection("regions").doc(id).get())
    );
    const regions: Record<string, RegionDoc> = {};
    regionDocs.forEach((doc) => {
      if (doc.exists) regions[doc.id] = doc.data() as RegionDoc;
    });

    // Fetch expenditure rows for the requested region(s) + year.
    let query = db
      .collection("expenditure")
      .where("financial_year", "==", yearParam);
    if (regionParam !== "all") {
      query = query.where("region_id", "==", regionParam);
    }
    const snapshot = await query.get();
    const rows = snapshot.docs.map((d) => d.data() as ExpenditureDoc);

    // Fetch department names once for label lookups.
    const deptSnapshot = await db.collection("departments").get();
    const deptNames: Record<string, string> = {};
    deptSnapshot.docs.forEach((d) => {
      const data = d.data();
      deptNames[d.id] = data.name_en;
    });

    // Build per-region results: total, per-capita, and category breakdown.
    const results = regionIds
      .filter((id) => regions[id]) // skip if region doc somehow missing
      .map((id) => {
        const regionRows = rows.filter((r) => r.region_id === id);
        const population = regions[id].populations[String(yearParam)] ?? null;

        const totalAmount000 = regionRows.reduce((sum, r) => sum + safeAmount(r[field]), 0);

        // Roll up by department (broad category)
        const byDeptMap: Record<string, number> = {};
        const deptHasGaps: Record<string, boolean> = {};
        regionRows.forEach((r) => {
          byDeptMap[r.department_id] = (byDeptMap[r.department_id] ?? 0) + safeAmount(r[field]);
          if (r[field] === null || r[field] === undefined) {
            deptHasGaps[r.department_id] = true;
          }
        });
        const by_department = Object.entries(byDeptMap)
          .map(([department_id, amount_eur_000]) => ({
            department_id,
            name_en: deptNames[department_id] ?? department_id,
            amount_eur_000,
            amount_eur: amount_eur_000 * 1000,
            per_capita_eur: population ? (amount_eur_000 * 1000) / population : null,
            // true if at least one row in this category was "n/q" / not
            // applicable in the source data — the total here is a partial
            // sum, not the full picture. See each row's `notes` field.
            incomplete: deptHasGaps[department_id] ?? false,
          }))
          .sort((a, b) => b.amount_eur_000 - a.amount_eur_000);

        return {
          region_id: id,
          region_names: regions[id].names,
          heraldic_color: regions[id].heraldic_color,
          financial_year: yearParam,
          basis: basisParam,
          population,
          population_source: regions[id].population_source,
          total_amount_eur_000: totalAmount000,
          total_amount_eur: totalAmount000 * 1000,
          per_capita_eur: population ? (totalAmount000 * 1000) / population : null,
          by_department,
        };
      });

    return NextResponse.json({
      query: { region: regionParam, year: yearParam, basis: basisParam },
      results: regionParam === "all" ? results : results[0] ?? null,
    });
  } catch (err) {
    console.error("Error querying expenditure:", err);
    return NextResponse.json(
      { error: "Failed to query expenditure data. Check server logs." },
      { status: 500 }
    );
  }
}
