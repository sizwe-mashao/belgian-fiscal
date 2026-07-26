import { getDb } from "@/lib/firebaseAdmin";
import type { EntityId } from "@/lib/competence";
import type {
  ExpenditureSliceRow,
  QueryPlan,
  Year,
} from "./types";
import { requiredSlices, type DepartmentNames, type PopulationMap } from "./executor";

type RegionDoc = {
  populations?: Record<string, number>;
};

type ExpenditureDoc = {
  region_id: string;
  department_id: string;
  financial_year: number;
  commitment_amount_eur_000: number | null;
  payment_amount_eur_000: number | null;
  notes: string | null;
};

/**
 * Fetch the expenditure slices and metadata a plan needs. Keeps notes text —
 * the explorer needs them; /api/expenditure deliberately drops them.
 */
export async function fetchPlanData(plan: QueryPlan): Promise<{
  rows: ExpenditureSliceRow[];
  populations: PopulationMap;
  deptNames: DepartmentNames;
}> {
  const db = getDb();
  const slices = requiredSlices(plan);
  const entityIds = [...new Set(slices.map((s) => s.entity))];
  const years = [...new Set(slices.map((s) => s.year))];

  const [regionDocs, deptSnapshot, ...yearSnaps] = await Promise.all([
    Promise.all(entityIds.map((id) => db.collection("regions").doc(id).get())),
    db.collection("departments").get(),
    ...years.map((year) =>
      db.collection("expenditure").where("financial_year", "==", year).get()
    ),
  ]);

  const populations: PopulationMap = {
    flanders: {},
    wallonia: {},
    brussels: {},
    federal: {},
  };
  regionDocs.forEach((doc, i) => {
    const id = entityIds[i];
    if (!doc.exists) return;
    const data = doc.data() as RegionDoc;
    for (const year of years) {
      const pop = data.populations?.[String(year)];
      if (typeof pop === "number") {
        populations[id][year] = pop;
      }
    }
  });

  const deptNames: DepartmentNames = {};
  deptSnapshot.docs.forEach((d) => {
    const data = d.data();
    if (typeof data.name_en === "string") {
      deptNames[d.id] = data.name_en;
    }
  });

  const entitySet = new Set(entityIds);
  const rows: ExpenditureSliceRow[] = [];
  for (const snap of yearSnaps) {
    for (const doc of snap.docs) {
      const data = doc.data() as ExpenditureDoc;
      if (!entitySet.has(data.region_id as EntityId)) continue;
      rows.push({
        region_id: data.region_id as EntityId,
        department_id: data.department_id,
        financial_year: data.financial_year as Year,
        commitment_amount_eur_000: data.commitment_amount_eur_000,
        payment_amount_eur_000: data.payment_amount_eur_000,
        notes: data.notes,
      });
    }
  }

  return { rows, populations, deptNames };
}
