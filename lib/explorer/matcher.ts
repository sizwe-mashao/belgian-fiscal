import type { EntityId } from "../competence";
import type { Basis, MatchResult, Metric, Operation, QueryPlan, Year } from "./types";

/**
 * Canonical category display names — character-for-character matches of the
 * departments collection name_en values and COMPETENCE keys.
 */
const CATEGORY_SYNONYMS: { category: string; phrases: string[] }[] = [
  {
    category: "Culture, Youth, Sport & Media",
    phrases: [
      "broadcasting",
      "culture",
      "arts",
      "youth",
      "sports",
      "sport",
      "media",
    ],
  },
  {
    category: "Defence",
    phrases: ["defence", "defense", "military", "army"],
  },
  {
    category: "Economy, Employment, Innovation & Research (incl. Agriculture)",
    phrases: [
      "agriculture",
      "employment",
      "innovation",
      "enterprise",
      "economic",
      "research",
      "farming",
      "business",
      "economy",
      "jobs",
    ],
  },
  {
    category: "Education",
    phrases: [
      "higher education",
      "universities",
      "university",
      "education",
      "teachers",
      "teaching",
      "students",
      "schools",
      "school",
    ],
  },
  {
    category: "Environment, Housing & Energy",
    phrases: [
      "spatial planning",
      "environment",
      "climate",
      "housing",
      "energy",
    ],
  },
  {
    category: "Finance & Budget",
    phrases: ["finances", "finance", "budget", "taxation", "debt"],
  },
  {
    category: "Foreign Affairs & International",
    phrases: [
      "development cooperation",
      "foreign affairs",
      "international",
      "diplomacy",
    ],
  },
  {
    category: "General Administration",
    phrases: ["government services", "civil service", "administration"],
  },
  {
    category: "Government Cabinet(s)",
    phrases: [
      "ministerial cabinets",
      "ministers' offices",
      "cabinets",
      "cabinet",
    ],
  },
  {
    category: "Health & Social Welfare/Care",
    phrases: [
      "social protection",
      "healthcare",
      "hospitals",
      "welfare",
      "health",
      "social",
      "care",
    ],
  },
  {
    category: "Local Governments & Home Affairs",
    phrases: [
      "local government",
      "local authorities",
      "municipalities",
      "home affairs",
      "communes",
      "interior",
    ],
  },
  {
    category: "Mobility & Infrastructure",
    phrases: [
      "public transport",
      "infrastructure",
      "railways",
      "mobility",
      "transport",
      "roads",
      "rail",
    ],
  },
  {
    category: "Parliament/Legislature",
    phrases: ["legislature", "parliament"],
  },
  {
    // "other" is deliberately omitted — it appears in ordinary phrasing.
    category: "Provisions/Other",
    phrases: ["provisions"],
  },
  {
    category: "Support Services (personnel/digital/legal)",
    phrases: [
      "support services",
      "personnel",
      "digital",
      "staff",
      "hr",
      // Match the standalone acronym, not the common pronoun "it".
      "IT",
    ],
  },
  {
    category: "Tourism",
    phrases: ["tourism", "tourists"],
  },
];

type PhraseCandidate = { phrase: string; category: string };

const PHRASE_CANDIDATES: PhraseCandidate[] = CATEGORY_SYNONYMS.flatMap(
  ({ category, phrases }) => phrases.map((phrase) => ({ phrase, category }))
).sort((a, b) => b.phrase.length - a.phrase.length);

const ENTITY_PATTERNS: { id: EntityId; pattern: RegExp }[] = [
  { id: "flanders", pattern: /\b(flanders|flemish|vlaanderen|flandre)\b/i },
  {
    id: "wallonia",
    pattern: /\b(wallonia|walloon|wallonie|wallonië)\b/i,
  },
  {
    id: "brussels",
    pattern: /\b(brussels(?:[-\s]capital)?|bruxelles|brussel)\b/i,
  },
  {
    id: "federal",
    pattern: /\b(federal(?:\s+government)?)\b/i,
  },
];

const ALL_REGIONS: EntityId[] = ["flanders", "wallonia", "brussels"];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findCategory(q: string): string | null {
  for (const { phrase, category } of PHRASE_CANDIDATES) {
    const flags = phrase === "IT" ? "" : "i";
    const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, flags);
    if (re.test(q)) return category;
  }
  return null;
}

function findEntities(q: string): EntityId[] {
  const found: EntityId[] = [];
  for (const { id, pattern } of ENTITY_PATTERNS) {
    if (pattern.test(q) && !found.includes(id)) found.push(id);
  }
  return found;
}

function mentionsAllRegions(q: string): boolean {
  return (
    /\ball\s+regions?\b/i.test(q) ||
    /\beach\s+region\b/i.test(q) ||
    /\bevery\s+region\b/i.test(q) ||
    /\bthe\s+regions?\b/i.test(q) ||
    /\bacross\s+(?:the\s+)?regions?\b/i.test(q)
  );
}

function isComparative(q: string): boolean {
  return (
    /\bcompare\b/i.test(q) ||
    /\bwhich\s+region\b/i.test(q) ||
    /\bwho\s+spends\s+most\b/i.test(q) ||
    /\bversus\b/i.test(q) ||
    /\bvs\.?\b/i.test(q) ||
    /\bacross\s+(?:the\s+)?regions?\b/i.test(q)
  );
}

function findYear(q: string): Year {
  // Prefer an explicit year token when present.
  if (/\b2025\b/.test(q)) return 2025;
  if (/\b2026\b/.test(q)) return 2026;
  if (/\blast\s+year\b/i.test(q)) return 2025;
  if (/\bthis\s+year\b/i.test(q)) return 2026;
  return 2026;
}

function findBasis(q: string): Basis {
  if (/\b(payment|payments|paid|pay|pays|disbursed)\b/i.test(q)) {
    return "payment";
  }
  if (/\b(commitment|commitments|committed|commit|commits|engagement)\b/i.test(q)) {
    return "commitment";
  }
  return "commitment";
}

function findMetric(q: string): Metric {
  if (/\bper\s+(resident|capita|person|inhabitant|inhabitants)\b/i.test(q)) {
    return "perCapita";
  }
  return "total";
}

function detectOperation(q: string): Operation {
  // Order is fixed: first match wins.
  if (
    /\b(change|changed|growth|increase|decrease)\b/i.test(q) ||
    /\byear\s+on\s+year\b/i.test(q) ||
    /\bsince\b/i.test(q) ||
    /\bcompared\s+to\s+2025\b/i.test(q)
  ) {
    return "change";
  }

  if (
    /\bcompare\b/i.test(q) ||
    /\bwhich\s+region\b/i.test(q) ||
    /\bwho\s+spends\s+most\b/i.test(q) ||
    /\bversus\b/i.test(q) ||
    /\bvs\.?\b/i.test(q)
  ) {
    return "compare";
  }

  if (
    /\bshare\b/i.test(q) ||
    /\bwhat\s+percentage\b/i.test(q) ||
    /\bwhat\s+proportion\b/i.test(q) ||
    /\bhow\s+much\s+of\b/i.test(q)
  ) {
    return "share";
  }

  if (
    /\b(biggest|largest|ranked|rank)\b/i.test(q) ||
    /\btop\b/i.test(q) ||
    /\bmost\s+on\b/i.test(q) ||
    /\bmain\s+areas\b/i.test(q)
  ) {
    return "rank";
  }

  if (
    /\bbreak\s*down\b/i.test(q) ||
    /\bby\s+categor(?:y|ies)\b/i.test(q) ||
    /\bwhat\s+does\s+\S.+\s+spend\s+on\b\??\s*$/i.test(q.trim())
  ) {
    return "breakdown";
  }

  // total is the residual when an entity (± category) is present — applied
  // by the caller once entities/category are known.
  return "total";
}

/**
 * Deterministic English-only matcher. Never guesses a nearby plan.
 */
export function match(question: string): MatchResult {
  const q = question.trim();
  if (!q) {
    return {
      ok: false,
      reason: "I couldn't tell which region or government you mean.",
    };
  }

  // Bare keyboard mash / non-words: no entity will match, but fail early with
  // a clear reason rather than drifting into a half-parsed plan.
  if (!/[a-zA-ZàâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ]{3,}/.test(q)) {
    return {
      ok: false,
      reason: "I couldn't tell which region or government you mean.",
    };
  }

  const category = findCategory(q);
  const year = findYear(q);
  const basis = findBasis(q);
  const metric = findMetric(q);

  let entities = findEntities(q);
  const belgiumMentioned = /\bbelgium\b/i.test(q);
  const allRegionsMentioned = mentionsAllRegions(q);
  const comparative = isComparative(q);

  // Resolve entity set before operation, since compare may need the three
  // regions filled in from phrasing that does not name them individually.
  if (entities.length === 0) {
    if (allRegionsMentioned || (belgiumMentioned && comparative)) {
      entities = [...ALL_REGIONS];
    } else if (belgiumMentioned) {
      return {
        ok: false,
        reason:
          "I couldn't tell which region or government you mean. Say Flanders, Wallonia, Brussels, the federal government, or ask across the regions.",
      };
    } else {
      return {
        ok: false,
        reason: "I couldn't tell which region or government you mean.",
      };
    }
  }

  let operation = detectOperation(q);

  // Two or more named entities imply compare even without compare-keywords,
  // unless a higher-priority operation (change/share/rank) already matched.
  if (
    entities.length >= 2 &&
    operation !== "change" &&
    operation !== "share" &&
    operation !== "rank"
  ) {
    operation = "compare";
  }

  // "what does X spend on?" with no category → breakdown; with a category → total.
  if (
    operation === "breakdown" &&
    category !== null
  ) {
    operation = "total";
  }

  // Residual total only applies when we have an entity and nothing above matched
  // a more specific operation. detectOperation already returns "total" as the
  // last branch for unmatched phrasing — keep it only if we have enough signal.
  if (operation === "total") {
    const hasTotalCue =
      /\b(spend|spends|spending|budget|total|how\s+much|commit|committed|commitment|pay|paid|payment|payments|disbursed)\b/i.test(
        q
      ) || category !== null;
    if (!hasTotalCue) {
      return {
        ok: false,
        reason: "I couldn't interpret that.",
      };
    }
  }

  if (operation === "compare") {
    if (allRegionsMentioned || (belgiumMentioned && comparative)) {
      entities = [...ALL_REGIONS];
    }
    if (entities.length < 2) {
      return {
        ok: false,
        reason:
          "I couldn't tell which region or government you mean.",
      };
    }
    if (!category) {
      return {
        ok: false,
        reason: "I couldn't tell which spending area you mean.",
      };
    }
  }

  if (operation === "share") {
    if (!category) {
      return {
        ok: false,
        reason: "I couldn't tell which spending area you mean.",
      };
    }
  }

  if (operation === "change" && entities.length !== 1) {
    // Change needs one entity; comparative multi-entity phrasing is compare.
    if (entities.length >= 2) {
      return {
        ok: false,
        reason: "I couldn't interpret that.",
      };
    }
  }

  const plan: QueryPlan = {
    operation,
    entities,
    category: operation === "rank" || operation === "breakdown" ? null : category,
    year,
    basis,
    metric,
  };

  if (operation === "change") {
    // "since 2025" / default: report 2026 vs 2025.
    if (/\bsince\s+2025\b/i.test(q) || /\bcompared\s+to\s+2025\b/i.test(q)) {
      plan.year = 2026;
      plan.compareYear = 2025;
    } else if (/\bsince\s+2026\b/i.test(q)) {
      plan.year = 2026;
      plan.compareYear = 2025;
    } else if (year === 2025 && !/\b2026\b/.test(q)) {
      // Named only 2025 as the reference point — still compare against it from 2026.
      plan.year = 2026;
      plan.compareYear = 2025;
    } else {
      plan.compareYear = (year === 2026 ? 2025 : 2026) as Year;
    }
  }

  if (operation === "rank") {
    const m = q.match(/\btop\s+(\d+)\b/i);
    plan.limit = m ? Math.min(Math.max(parseInt(m[1], 10), 1), 17) : 6;
  }

  return { ok: true, plan };
}
