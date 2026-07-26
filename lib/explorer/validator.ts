import { isKnownCategory } from "./categories";
import type { QueryPlan, ValidateResult } from "./types";

const VALID_YEARS = new Set([2025, 2026]);
const VALID_ENTITIES = new Set([
  "flanders",
  "wallonia",
  "brussels",
  "federal",
]);

/**
 * Rejects impossible plans before any Firestore query runs.
 *
 * A valid plan that returns no rows is NOT a validation failure — that path
 * belongs to absence handling (stage 4).
 */
export function validatePlan(plan: QueryPlan): ValidateResult {
  for (const entity of plan.entities) {
    if (!VALID_ENTITIES.has(entity)) {
      return {
        ok: false,
        error: `Unknown entity "${entity}". Ask about Flanders, Wallonia, Brussels-Capital or the federal government.`,
      };
    }
  }

  if (plan.category !== null && !isKnownCategory(plan.category)) {
    return {
      ok: false,
      error: `Unknown category "${plan.category}".`,
    };
  }

  if (!VALID_YEARS.has(plan.year)) {
    return {
      ok: false,
      error: `Year ${plan.year} is outside the available range (2025–2026).`,
    };
  }

  if (
    plan.compareYear !== undefined &&
    !VALID_YEARS.has(plan.compareYear)
  ) {
    return {
      ok: false,
      error: `Comparison year ${plan.compareYear} is outside the available range (2025–2026).`,
    };
  }

  // Every federal commitment figure in the source is n/q. Refuse rather than
  // silently returning zero or silently switching basis.
  if (
    plan.basis === "commitment" &&
    plan.entities.includes("federal")
  ) {
    return {
      ok: false,
      error:
        "Federal figures are available on a payment basis only — every commitment amount in the federal extract is marked not quantified. Ask again with payment basis (for example: “What did the federal government pay in 2026?”).",
    };
  }

  if (plan.operation === "compare" && plan.entities.length < 2) {
    return {
      ok: false,
      error:
        "A comparison needs at least two entities. Try naming several regions, or ask which region spends most on a category.",
    };
  }

  if (plan.operation === "change" && plan.compareYear === undefined) {
    return {
      ok: false,
      error:
        "A change question needs a comparison year (for example: “…since 2025”).",
    };
  }

  return { ok: true, plan };
}
