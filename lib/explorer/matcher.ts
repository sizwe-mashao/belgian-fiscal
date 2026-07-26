import type { EntityId } from "@/lib/competence";
import { SORTED_CATEGORY_SYNONYMS } from "./categories";
import type {
  Basis,
  MatchResult,
  Metric,
  Operation,
  QueryPlan,
  Year,
} from "./types";

const ENTITY_PATTERNS: { id: EntityId; pattern: RegExp }[] = [
  { id: "flanders", pattern: /\b(flanders|flemish|vlaanderen)\b/i },
  { id: "wallonia", pattern: /\b(wallonia|walloon|wallonie)\b/i },
  { id: "brussels", pattern: /\b(brussels(?:[-\s]capital)?|bruxelles)\b/i },
  {
    id: "federal",
    pattern: /\b(federal(?:\s+government)?|belgium\s+federal)\b/i,
  },
];

const ALL_REGIONS: EntityId[] = ["flanders", "wallonia", "brussels"];

function findEntities(q: string): EntityId[] {
  const found: EntityId[] = [];
  for (const { id, pattern } of ENTITY_PATTERNS) {
    if (pattern.test(q) && !found.includes(id)) found.push(id);
  }
  return found;
}

function wantsAllRegions(q: string): boolean {
  return (
    /\bacross\s+(?:the\s+)?regions?\b/i.test(q) ||
    /\ball\s+(?:three\s+)?regions?\b/i.test(q) ||
    /\bthe\s+(?:three\s+)?regions?\b/i.test(q) ||
    /\bbelgium\b/i.test(q) ||
    /\bwhich\s+region\b/i.test(q) ||
    /\bcompare\b/i.test(q)
  );
}

function findCategory(q: string): string | null {
  for (const { synonym, category } of SORTED_CATEGORY_SYNONYMS) {
    const re = new RegExp(
      `\\b${synonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i"
    );
    if (re.test(q)) return category;
  }
  return null;
}

function findYear(q: string): Year {
  if (/\b2025\b/.test(q) || /\blast\s+year\b/i.test(q)) return 2025;
  if (/\b2026\b/.test(q) || /\bthis\s+year\b/i.test(q)) return 2026;
  return 2026;
}

function findBasis(q: string): Basis {
  if (/\b(payment|payments|paid|pay|pays|disbursed)\b/i.test(q))
    return "payment";
  if (/\b(commitment|committed|commit|commits|engagement)\b/i.test(q))
    return "commitment";
  return "commitment";
}

function findMetric(q: string): Metric {
  if (
    /\bper\s+(resident|capita|person|inhabitant|inhabitants)\b/i.test(q)
  ) {
    return "perCapita";
  }
  return "total";
}

function detectOperation(
  q: string,
  entities: EntityId[],
  category: string | null
): Operation | null {
  // change — needs a temporal comparison cue
  if (
    /\b(change|changed|evolved|evolution)\b/i.test(q) ||
    /\bsince\s+2025\b/i.test(q) ||
    /\bvs\.?\s+2025\b/i.test(q) ||
    /\bcompared\s+to\s+2025\b/i.test(q) ||
    /\bfrom\s+2025\s+to\s+2026\b/i.test(q)
  ) {
    return "change";
  }

  // share
  if (
    /\b(share|percentage|percent|proportion|fraction)\b/i.test(q) ||
    /\bwhat\s+share\b/i.test(q) ||
    /\bhow\s+much\s+of\b/i.test(q)
  ) {
    return "share";
  }

  // rank
  if (
    /\b(biggest|largest|top|main|major)\b/i.test(q) &&
    /\b(spending|areas|categories|departments|items)\b/i.test(q)
  ) {
    return "rank";
  }
  if (/\brank\b/i.test(q) || /\btop\s+\d+\b/i.test(q)) {
    return "rank";
  }

  // compare — multiple entities, or an explicit comparative cue
  if (
    /\bcompare\b/i.test(q) ||
    /\bwhich\s+region\b/i.test(q) ||
    /\bmost\s+on\b/i.test(q) ||
    /\bacross\s+(?:the\s+)?regions?\b/i.test(q) ||
    entities.length >= 2
  ) {
    return "compare";
  }

  // breakdown — open-ended "spend on?" without a named category
  if (
    category === null &&
    (/\bspend(?:s|ing)?\s+on\b\??\s*$/i.test(q.trim()) ||
      /\bbreak\s*down\b/i.test(q) ||
      /\bby\s+categor(?:y|ies)\b/i.test(q) ||
      /\bwhat\s+does\s+.+\s+spend\s+on\b\??\s*$/i.test(q.trim()))
  ) {
    return "breakdown";
  }

  // total — a single figure for an entity (± category)
  if (
    /\b(spend|spends|spending|budget|total|how\s+much|commit|committed|commitment|pay|paid|payment|payments|disbursed)\b/i.test(
      q
    ) ||
    category !== null
  ) {
    return "total";
  }

  return null;
}

/**
 * Deterministic English-only matcher. Never guesses a nearby plan: if the
 * question cannot be matched confidently, return a failure with a reason.
 */
export function matchQuestion(question: string): MatchResult {
  const q = question.trim();
  if (!q) {
    return { ok: false, error: "no question provided" };
  }

  // Refuse obvious nonsense / keyboard mash — no plan is guessed.
  if (!/[a-zA-Z]{3,}/.test(q) || /^[^a-zA-Z]*$/.test(q)) {
    return { ok: false, error: "no entity recognised" };
  }

  let entities = findEntities(q);
  const category = findCategory(q);
  const year = findYear(q);
  const basis = findBasis(q);
  const metric = findMetric(q);

  // "Belgium" / "all regions" with a comparative cue → the three regions.
  if (entities.length === 0 && wantsAllRegions(q)) {
    entities = [...ALL_REGIONS];
  } else if (
    entities.length === 1 &&
    entities[0] === "federal" &&
    wantsAllRegions(q) &&
    /\bcompare\b/i.test(q)
  ) {
    // leave federal alone for compare-with-federal questions
  } else if (
    entities.length === 0 &&
    /\bcompare\b/i.test(q) &&
    category
  ) {
    entities = [...ALL_REGIONS];
  }

  if (entities.length === 0) {
    return { ok: false, error: "no entity recognised" };
  }

  const operation = detectOperation(q, entities, category);
  if (!operation) {
    return { ok: false, error: "could not interpret the question" };
  }

  // Share and a category-specific compare need a recognised category.
  if (operation === "share" && !category) {
    return { ok: false, error: "no category recognised" };
  }

  // Compare with a "which region … on X" cue but no category → fail rather
  // than inventing a whole-budget comparison the user did not ask for.
  if (
    operation === "compare" &&
    !category &&
    /\bon\b/i.test(q) &&
    !/\bbudget\b/i.test(q)
  ) {
    return { ok: false, error: "no category recognised" };
  }

  if (operation === "compare" && entities.length < 2) {
    if (wantsAllRegions(q) || /\bwhich\s+region\b/i.test(q)) {
      entities = [...ALL_REGIONS];
    }
  }

  const plan: QueryPlan = {
    operation,
    entities,
    category,
    year,
    basis,
    metric,
  };

  if (operation === "change") {
    // Default: current year vs previous. If the question names only 2025 as
    // the "since" year, year stays 2026 and compareYear is 2025.
    if (/\b2025\b/.test(q) && !/\b2026\b/.test(q) && /\bsince\b/i.test(q)) {
      plan.year = 2026;
      plan.compareYear = 2025;
    } else if (year === 2025) {
      plan.year = 2026;
      plan.compareYear = 2025;
    } else {
      plan.compareYear = 2025;
    }
  }

  if (operation === "rank") {
    const m = q.match(/\btop\s+(\d+)\b/i);
    plan.limit = m ? Math.min(Math.max(parseInt(m[1], 10), 1), 17) : 6;
    plan.category = null;
  }

  if (operation === "breakdown") {
    plan.category = null;
  }

  return { ok: true, plan };
}
