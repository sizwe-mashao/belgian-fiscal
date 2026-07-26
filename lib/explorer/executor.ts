import type { EntityId } from "@/lib/competence";
import { safeAmount } from "@/lib/safeAmount";
import type {
  ExpenditureSliceRow,
  QueryPlan,
  QueryResult,
  ResultRow,
  Year,
} from "./types";

export type PopulationMap = Record<EntityId, Partial<Record<Year, number>>>;

export type DepartmentNames = Record<string, string>;

/** What the route must fetch for a plan — pure, no I/O. */
export function requiredSlices(
  plan: QueryPlan
): { entity: EntityId; year: Year }[] {
  const years: Year[] =
    plan.operation === "change" && plan.compareYear !== undefined
      ? Array.from(new Set([plan.year, plan.compareYear]))
      : [plan.year];

  const slices: { entity: EntityId; year: Year }[] = [];
  for (const entity of plan.entities) {
    for (const year of years) {
      slices.push({ entity, year });
    }
  }
  return slices;
}

function amountField(
  basis: QueryPlan["basis"]
): "commitment_amount_eur_000" | "payment_amount_eur_000" {
  return basis === "payment"
    ? "payment_amount_eur_000"
    : "commitment_amount_eur_000";
}

function toEuros(eur000: number): number {
  return eur000 * 1000;
}

function perCapita(eur000: number, population: number | undefined): number | null {
  if (!population || population <= 0) return null;
  return toEuros(eur000) / population;
}

function entityLabel(id: EntityId): string {
  switch (id) {
    case "flanders":
      return "Flanders";
    case "wallonia":
      return "Wallonia";
    case "brussels":
      return "Brussels-Capital";
    case "federal":
      return "Federal";
  }
}

function deptIdForCategory(
  category: string,
  deptNames: DepartmentNames
): string | null {
  const entry = Object.entries(deptNames).find(([, name]) => name === category);
  return entry ? entry[0] : null;
}

type Agg = {
  eur000: number;
  incomplete: boolean;
  notes: string[];
  rowCount: number;
};

function aggregate(
  rows: ExpenditureSliceRow[],
  field: "commitment_amount_eur_000" | "payment_amount_eur_000",
  filter?: { entity?: EntityId; year?: number; departmentId?: string | null }
): Agg {
  let eur000 = 0;
  let incomplete = false;
  let rowCount = 0;
  const notes: string[] = [];

  for (const row of rows) {
    if (filter?.entity && row.region_id !== filter.entity) continue;
    if (filter?.year !== undefined && row.financial_year !== filter.year)
      continue;
    if (
      filter?.departmentId !== undefined &&
      filter.departmentId !== null &&
      row.department_id !== filter.departmentId
    ) {
      continue;
    }

    rowCount += 1;
    const value = safeAmount(row[field]);
    if (value === null) {
      incomplete = true;
    } else {
      eur000 += value;
    }
    if (row.notes) notes.push(row.notes);
  }

  return { eur000, incomplete, notes, rowCount };
}

function uniqueNotes(lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const note of list) {
      const trimmed = note.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

/**
 * Pure executor — no I/O. Convert EUR '000 → euros here, at the edge.
 * Populations are year-specific: per-resident divides each year by that
 * year's headcount, matching the dashboard.
 */
export function execute(
  plan: QueryPlan,
  rows: ExpenditureSliceRow[],
  populations: PopulationMap,
  deptNames: DepartmentNames
): QueryResult {
  const field = amountField(plan.basis);
  const departmentId = plan.category
    ? deptIdForCategory(plan.category, deptNames)
    : null;

  // Category named but unknown to the departments collection — treat as empty
  // rather than silently summing the whole budget.
  if (plan.category && departmentId === null) {
    return {
      plan,
      rows: [],
      empty: true,
      caveats: [],
      incomplete: false,
    };
  }

  switch (plan.operation) {
    case "total":
      return execTotal(plan, rows, populations, field, departmentId);
    case "breakdown":
      return execBreakdown(plan, rows, populations, deptNames, field);
    case "compare":
      return execCompare(plan, rows, populations, field, departmentId);
    case "change":
      return execChange(plan, rows, populations, field, departmentId);
    case "share":
      return execShare(plan, rows, populations, field, departmentId);
    case "rank":
      return execRank(plan, rows, populations, deptNames, field);
  }
}

function execTotal(
  plan: QueryPlan,
  rows: ExpenditureSliceRow[],
  populations: PopulationMap,
  field: "commitment_amount_eur_000" | "payment_amount_eur_000",
  departmentId: string | null
): QueryResult {
  const entity = plan.entities[0];
  const agg = aggregate(rows, field, {
    entity,
    year: plan.year,
    departmentId: plan.category ? departmentId : undefined,
  });

  if (plan.category && agg.rowCount === 0) {
    return {
      plan,
      rows: [],
      empty: true,
      caveats: [],
      incomplete: false,
    };
  }

  const pop = populations[entity]?.[plan.year];
  const amount_eur = toEuros(agg.eur000);
  const row: ResultRow = {
    entity,
    category: plan.category ?? undefined,
    label: plan.category
      ? `${entityLabel(entity)} — ${plan.category}`
      : entityLabel(entity),
    amount_eur,
    per_capita_eur:
      plan.metric === "perCapita" ? perCapita(agg.eur000, pop) : undefined,
    incomplete: agg.incomplete,
  };

  return {
    plan,
    rows: [row],
    empty: false,
    caveats: uniqueNotes([agg.notes]),
    incomplete: agg.incomplete,
  };
}

function execBreakdown(
  plan: QueryPlan,
  rows: ExpenditureSliceRow[],
  populations: PopulationMap,
  deptNames: DepartmentNames,
  field: "commitment_amount_eur_000" | "payment_amount_eur_000"
): QueryResult {
  const entity = plan.entities[0];
  const pop = populations[entity]?.[plan.year];
  const byDept = new Map<
    string,
    { eur000: number; incomplete: boolean; notes: string[] }
  >();

  for (const row of rows) {
    if (row.region_id !== entity || row.financial_year !== plan.year) continue;
    const cur = byDept.get(row.department_id) ?? {
      eur000: 0,
      incomplete: false,
      notes: [],
    };
    const value = safeAmount(row[field]);
    if (value === null) cur.incomplete = true;
    else cur.eur000 += value;
    if (row.notes) cur.notes.push(row.notes);
    byDept.set(row.department_id, cur);
  }

  if (byDept.size === 0) {
    return {
      plan,
      rows: [],
      empty: true,
      caveats: [],
      incomplete: false,
    };
  }

  const ranked = [...byDept.entries()]
    .map(([deptId, agg]) => ({
      deptId,
      agg,
      sort: agg.eur000,
    }))
    .sort((a, b) => b.sort - a.sort);

  const resultRows: ResultRow[] = ranked.map(({ deptId, agg }) => {
    const name = deptNames[deptId] ?? deptId;
    return {
      entity,
      category: name,
      label: name,
      amount_eur: toEuros(agg.eur000),
      per_capita_eur:
        plan.metric === "perCapita" ? perCapita(agg.eur000, pop) : undefined,
      incomplete: agg.incomplete,
    };
  });

  const caveats = uniqueNotes(ranked.map(({ agg }) => agg.notes));

  return {
    plan,
    rows: resultRows,
    empty: false,
    caveats,
    incomplete: resultRows.some((r) => r.incomplete),
  };
}

function execCompare(
  plan: QueryPlan,
  rows: ExpenditureSliceRow[],
  populations: PopulationMap,
  field: "commitment_amount_eur_000" | "payment_amount_eur_000",
  departmentId: string | null
): QueryResult {
  const resultRows: ResultRow[] = [];
  const noteLists: string[][] = [];
  let anyIncomplete = false;
  let anyData = false;

  for (const entity of plan.entities) {
    const agg = aggregate(rows, field, {
      entity,
      year: plan.year,
      departmentId: plan.category ? departmentId : undefined,
    });
    if (plan.category && agg.rowCount === 0) {
      // Entity has no line for this category — skip rather than inventing zero.
      continue;
    }
    anyData = true;
    anyIncomplete = anyIncomplete || agg.incomplete;
    noteLists.push(agg.notes);
    const pop = populations[entity]?.[plan.year];
    resultRows.push({
      entity,
      category: plan.category ?? undefined,
      label: entityLabel(entity),
      amount_eur: toEuros(agg.eur000),
      per_capita_eur:
        plan.metric === "perCapita"
          ? perCapita(agg.eur000, pop)
          : undefined,
      incomplete: agg.incomplete,
    });
  }

  resultRows.sort(
    (a, b) => (b.amount_eur ?? 0) - (a.amount_eur ?? 0)
  );

  if (!anyData) {
    return {
      plan,
      rows: [],
      empty: true,
      caveats: [],
      incomplete: false,
    };
  }

  return {
    plan,
    rows: resultRows,
    empty: false,
    caveats: uniqueNotes(noteLists),
    incomplete: anyIncomplete,
  };
}

function execChange(
  plan: QueryPlan,
  rows: ExpenditureSliceRow[],
  populations: PopulationMap,
  field: "commitment_amount_eur_000" | "payment_amount_eur_000",
  departmentId: string | null
): QueryResult {
  const entity = plan.entities[0];
  const compareYear = plan.compareYear!;
  const current = aggregate(rows, field, {
    entity,
    year: plan.year,
    departmentId: plan.category ? departmentId : undefined,
  });
  const previous = aggregate(rows, field, {
    entity,
    year: compareYear,
    departmentId: plan.category ? departmentId : undefined,
  });

  if (plan.category && current.rowCount === 0 && previous.rowCount === 0) {
    return {
      plan,
      rows: [],
      empty: true,
      caveats: [],
      incomplete: false,
    };
  }

  const popNow = populations[entity]?.[plan.year];
  const popPrev = populations[entity]?.[compareYear];
  const amount_eur = toEuros(current.eur000);
  const previous_amount_eur = toEuros(previous.eur000);
  const delta_eur = amount_eur - previous_amount_eur;
  const delta_pct =
    previous.eur000 === 0
      ? null
      : ((current.eur000 - previous.eur000) / previous.eur000) * 100;

  const row: ResultRow = {
    entity,
    category: plan.category ?? undefined,
    label: plan.category
      ? `${entityLabel(entity)} — ${plan.category}`
      : entityLabel(entity),
    amount_eur,
    previous_amount_eur,
    delta_eur,
    delta_pct,
    per_capita_eur:
      plan.metric === "perCapita"
        ? perCapita(current.eur000, popNow)
        : undefined,
    previous_per_capita_eur:
      plan.metric === "perCapita"
        ? perCapita(previous.eur000, popPrev)
        : undefined,
    incomplete: current.incomplete || previous.incomplete,
  };

  return {
    plan,
    rows: [row],
    empty: false,
    caveats: uniqueNotes([current.notes, previous.notes]),
    incomplete: row.incomplete ?? false,
  };
}

function execShare(
  plan: QueryPlan,
  rows: ExpenditureSliceRow[],
  populations: PopulationMap,
  field: "commitment_amount_eur_000" | "payment_amount_eur_000",
  departmentId: string | null
): QueryResult {
  const entity = plan.entities[0];
  const part = aggregate(rows, field, {
    entity,
    year: plan.year,
    departmentId,
  });
  const whole = aggregate(rows, field, {
    entity,
    year: plan.year,
  });

  if (part.rowCount === 0) {
    return {
      plan,
      rows: [],
      empty: true,
      caveats: [],
      incomplete: false,
    };
  }

  const share_pct =
    whole.eur000 === 0 ? null : (part.eur000 / whole.eur000) * 100;
  const pop = populations[entity]?.[plan.year];

  return {
    plan,
    rows: [
      {
        entity,
        category: plan.category ?? undefined,
        label: plan.category
          ? `${plan.category} share of ${entityLabel(entity)}`
          : entityLabel(entity),
        amount_eur: toEuros(part.eur000),
        share_pct,
        per_capita_eur:
          plan.metric === "perCapita"
            ? perCapita(part.eur000, pop)
            : undefined,
        incomplete: part.incomplete || whole.incomplete,
      },
    ],
    empty: false,
    caveats: uniqueNotes([part.notes]),
    incomplete: part.incomplete || whole.incomplete,
  };
}

function execRank(
  plan: QueryPlan,
  rows: ExpenditureSliceRow[],
  populations: PopulationMap,
  deptNames: DepartmentNames,
  field: "commitment_amount_eur_000" | "payment_amount_eur_000"
): QueryResult {
  const breakdown = execBreakdown(
    plan,
    rows,
    populations,
    deptNames,
    field
  );
  if (breakdown.empty) return breakdown;

  const limit = plan.limit ?? 6;
  return {
    ...breakdown,
    rows: breakdown.rows.slice(0, limit),
  };
}
