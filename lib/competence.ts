/**
 * Competence model — why a category is absent from an entity's budget.
 *
 * Belgian budget data has gaps, and they arise for three different reasons.
 * Conflating them produces confidently wrong explanations, so each is handled
 * separately here:
 *
 *   1. CONSTITUTIONAL — the entity does not hold the competence at all.
 *      Education under Wallonia: it is a community matter, funded by the
 *      Fédération Wallonie-Bruxelles, outside this dataset. Derived from the
 *      COMPETENCE and COVERAGE tables below.
 *
 *   2. BLENDED — the entity does fund it, but the spending sits inside another
 *      division and cannot be separated. Wallonia's local-government spending
 *      lives in DO17 alongside social action and health. Derived at runtime
 *      from the source `notes`, which already declare the absorbed bucket in
 *      the form "taxonomy bucket = <category>". Nothing to maintain here.
 *
 *   3. STRUCTURAL — the entity holds the competence and it is not blended, but
 *      no line was identifiable in the source extract. Declared explicitly in
 *      STRUCTURAL_ABSENCES, because there is no rule that predicts these.
 *
 * Anything not explained by one of the three is reported as an unexplained
 * absence. That is deliberate: the system says "not in this dataset" rather
 * than inventing a reason it has not been given.
 */

export type Competence =
  | "federal"
  | "regional"
  | "community"
  | "mixed"
  | "own-government"
  | "unclassified";

export type EntityId = "flanders" | "wallonia" | "brussels" | "federal";

/**
 * Which level of government holds each of the 17 broad categories.
 *
 * "own-government" means every entity has one by definition — its own finances,
 * administration, parliament and cabinets. An absence in this class is never
 * constitutional, so it is always a data gap. This is what lets Brussels'
 * missing ministerial-cabinet line be explained correctly without anyone
 * declaring it by hand.
 *
 * "mixed" categories are split across levels: health sits partly with the
 * communities (care, prevention), partly with the regions (elderly care since
 * the sixth state reform) and partly federal (social security). A "mixed"
 * category is never used to justify a full absence on its own.
 */
export const COMPETENCE: Record<string, Competence> = {
  Education: "community",
  "Culture, Youth, Sport & Media": "community",

  Defence: "federal",

  "Economy, Employment, Innovation & Research (incl. Agriculture)": "regional",
  "Environment, Housing & Energy": "regional",
  "Local Governments & Home Affairs": "regional",
  Tourism: "regional",

  "Health & Social Welfare/Care": "mixed",
  "Mobility & Infrastructure": "mixed",
  "Foreign Affairs & International": "mixed",

  "Finance & Budget": "own-government",
  "General Administration": "own-government",
  "Government Cabinet(s)": "own-government",
  "Parliament/Legislature": "own-government",
  "Provisions/Other": "own-government",
  "Support Services (personnel/digital/legal)": "own-government",

  "Unclassified / Not specified": "unclassified",
};

type Coverage = {
  levels: Competence[];
  /**
   * Community categories this entity funds despite not being a community.
   * Brussels carries culture and health through the three Community
   * Commissions (COCOF, VGC, COCOM) but not education, which stayed with the
   * communities proper. A blanket "partial community" flag would get this
   * wrong, so the exceptions are named.
   */
  communityCategories?: string[];
  /** Where the competence sits instead, for the explanation text. */
  communityFundedBy?: string;
};

export const COVERAGE: Record<EntityId, Coverage> = {
  flanders: {
    // Flanders merged its region and community into a single government, which
    // is why education appears here and nowhere else among the regions.
    levels: ["regional", "community", "own-government", "mixed"],
  },
  wallonia: {
    levels: ["regional", "own-government", "mixed"],
    communityFundedBy: "the Fédération Wallonie-Bruxelles",
  },
  brussels: {
    levels: ["regional", "own-government", "mixed"],
    communityCategories: [
      "Culture, Youth, Sport & Media",
      "Health & Social Welfare/Care",
    ],
    communityFundedBy:
      "the Flemish and French Communities, and the three Community Commissions",
  },
  federal: {
    levels: ["federal", "own-government", "mixed"],
  },
};

/**
 * Absences the rules cannot predict: the entity holds the competence, the
 * spending is not blended into another division, but no line was identifiable
 * in the source extract.
 *
 * Keep this list short. If it grows, the rules above are probably wrong and
 * should be corrected rather than patched here.
 */
const FEDERAL_FUNCTIONAL_EXTRACT =
  "The federal figures are extracted by COFOG function rather than by administrative division, so organisational lines such as cabinets, parliament and provisions do not appear as separate categories. The spending exists; it is distributed across the functional categories.";

export const STRUCTURAL_ABSENCES: Partial<
  Record<EntityId, Record<string, string>>
> = {
  wallonia: {
    Tourism:
      "Wallonia holds the tourism competence, but it has no dedicated budget division — it is administered through the Commissariat général au Tourisme rather than appearing as a separate line.",
    "Foreign Affairs & International":
      "Wallonia holds treaty powers in its own competences, but international relations are run through Wallonie-Bruxelles International, a joint body that sits outside the regional expenditure budget.",
  },
  brussels: {
    "Government Cabinet(s)":
      "No ministerial-cabinet line was identifiable in the Brussels source extract, unlike Wallonia's DO02 and Flanders' VF-VO. The figure is absent, not zero.",
  },
  federal: {
    // The federal extract is organised by COFOG function rather than by
    // administrative division, so it has no organisational lines at all. One
    // cause, three absences.
    "Government Cabinet(s)": FEDERAL_FUNCTIONAL_EXTRACT,
    "Parliament/Legislature": FEDERAL_FUNCTIONAL_EXTRACT,
    "Provisions/Other": FEDERAL_FUNCTIONAL_EXTRACT,
  },
};

export type AbsenceReason =
  | { kind: "constitutional"; competence: Competence; fundedBy?: string }
  | { kind: "not-a-category" }
  | { kind: "blended"; intoCategory: string; note: string }
  | { kind: "structural"; detail: string }
  | { kind: "unexplained" };

/**
 * A blend index built from the source notes rather than hand-written.
 *
 * Notes declare absorbed buckets as "taxonomy bucket = <category>", so a
 * category absorbed into another division can be detected without maintaining
 * a parallel list. Pass the notes for the entity being queried.
 */
export function buildBlendIndex(
  rows: { department_id: string; name_en: string; notes: string | null }[]
): Map<string, { intoCategory: string; note: string }> {
  const index = new Map<string, { intoCategory: string; note: string }>();

  for (const row of rows) {
    if (!row.notes) continue;
    // e.g. "BLENDED: division combines Local Authorities (taxonomy bucket =
    // Local Governments & Home Affairs) with Social Action and Health."
    const matches = row.notes.matchAll(/taxonomy bucket\s*=\s*([^)|]+)/gi);
    for (const match of matches) {
      const absorbed = match[1].trim();
      if (absorbed && absorbed !== row.name_en) {
        index.set(absorbed, { intoCategory: row.name_en, note: row.notes });
      }
    }
  }

  return index;
}

/**
 * Explains why `category` returned no rows for `entity`.
 *
 * Order matters: a category can be both outside an entity's competence and
 * mentioned in a note, and the constitutional reason is the more fundamental
 * one. Returns "unexplained" when no declared reason applies — the caller
 * should then say plainly that the dataset has no data, and not guess.
 */
export function explainAbsence(
  entity: EntityId,
  category: string,
  blendIndex: Map<string, { intoCategory: string; note: string }>
): AbsenceReason {
  const competence = COMPETENCE[category];
  const coverage = COVERAGE[entity];

  // Not a spending area: a residual bucket used only where the source could not
  // be mapped onto the taxonomy. Its absence is a good sign, not a gap.
  if (competence === "unclassified") {
    return { kind: "not-a-category" };
  }

  if (competence && coverage) {
    const covered =
      coverage.levels.includes(competence) ||
      (coverage.communityCategories?.includes(category) ?? false);

    // "own-government" and "mixed" never justify a full absence: every entity
    // has its own administration, and mixed categories are split rather than
    // withheld. Those fall through to the blend and structural checks.
    const canExplain = competence === "community" || competence === "federal";

    if (!covered && canExplain) {
      return {
        kind: "constitutional",
        competence,
        // communityFundedBy names where community matters go, so it must not be
        // attached to a federal absence — that produced "Defence ... funded by
        // the Fédération Wallonie-Bruxelles", which is nonsense.
        fundedBy:
          competence === "community"
            ? coverage.communityFundedBy
            : competence === "federal"
              ? "the federal government"
              : undefined,
      };
    }
  }

  const blended = blendIndex.get(category);
  if (blended) {
    return {
      kind: "blended",
      intoCategory: blended.intoCategory,
      note: blended.note,
    };
  }

  const structural = STRUCTURAL_ABSENCES[entity]?.[category];
  if (structural) {
    return { kind: "structural", detail: structural };
  }

  return { kind: "unexplained" };
}
