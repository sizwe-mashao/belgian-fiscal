import {
  buildBlendIndex,
  explainAbsence,
  type EntityId,
  type AbsenceReason,
} from "@/lib/competence";
import type {
  AbsencePayload,
  ExpenditureSliceRow,
  QueryPlan,
  QueryResult,
} from "./types";

function entityLabel(id: EntityId): string {
  switch (id) {
    case "flanders":
      return "Flanders";
    case "wallonia":
      return "Wallonia";
    case "brussels":
      return "Brussels-Capital";
    case "federal":
      return "the federal government";
  }
}

/**
 * Deterministic prose for an absence. The model must never write this text.
 */
export function formatAbsenceReason(
  entity: EntityId,
  category: string,
  reason: AbsenceReason
): string {
  const who = entityLabel(entity);

  switch (reason.kind) {
    case "constitutional": {
      if (reason.competence === "community") {
        const funded = reason.fundedBy
          ? `, funded by ${reason.fundedBy}`
          : "";
        return `${category} does not appear under ${who} because it is a community competence${funded}, outside this dataset.`;
      }
      if (reason.competence === "federal") {
        return `${category} does not appear under ${who} because it is a federal competence, held by ${reason.fundedBy ?? "the federal government"}, outside this entity's budget.`;
      }
      return `${category} does not appear under ${who} for constitutional reasons.`;
    }
    case "blended":
      return `${category} spending for ${who} sits inside ${reason.intoCategory} and cannot be separated at the division level available here. ${reason.note}`;
    case "structural":
      return reason.detail;
    case "not-a-category":
      return `"${category}" is a residual mapping bucket, not a spending area — its absence is expected.`;
    case "unexplained":
      return `This dataset has no data for ${category} under ${who}, and no declared reason for the gap.`;
  }
}

/**
 * When a valid plan returns no rows, attach the competence explanation.
 * Builds the blend index from the notes of the entity being queried.
 */
export function attachAbsence(
  result: QueryResult,
  plan: QueryPlan,
  rows: ExpenditureSliceRow[],
  deptNames: Record<string, string>
): QueryResult {
  if (!result.empty || !plan.category || plan.entities.length === 0) {
    return result;
  }

  // For compare, explain the first entity that lacked the category — the
  // constitutional/blend answer is entity-specific.
  const entity = plan.entities[0];
  const entityRows = rows
    .filter((r) => r.region_id === entity)
    .map((r) => ({
      department_id: r.department_id,
      name_en: deptNames[r.department_id] ?? r.department_id,
      notes: r.notes,
    }));

  const blendIndex = buildBlendIndex(entityRows);
  const reason = explainAbsence(entity, plan.category, blendIndex);
  const absence: AbsencePayload = {
    entity,
    category: plan.category,
    kind: reason.kind,
    reason: formatAbsenceReason(entity, plan.category, reason),
  };

  return { ...result, absence };
}
