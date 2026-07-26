/**
 * The 17 broad-category name_en values, plus English synonyms the matcher
 * accepts. Order within each list is longest/most-specific first so a phrase
 * like "higher education" wins over the bare "education" substring scan.
 *
 * Do not invent variants of the canonical strings — they must match the
 * departments collection exactly.
 */

export const CATEGORIES = [
  "Culture, Youth, Sport & Media",
  "Defence",
  "Economy, Employment, Innovation & Research (incl. Agriculture)",
  "Education",
  "Environment, Housing & Energy",
  "Finance & Budget",
  "Foreign Affairs & International",
  "General Administration",
  "Government Cabinet(s)",
  "Health & Social Welfare/Care",
  "Local Governments & Home Affairs",
  "Mobility & Infrastructure",
  "Parliament/Legislature",
  "Provisions/Other",
  "Support Services (personnel/digital/legal)",
  "Tourism",
  "Unclassified / Not specified",
] as const;

export type CategoryName = (typeof CATEGORIES)[number];

/** Synonyms → canonical name_en. "Unclassified" is intentionally omitted. */
export const CATEGORY_SYNONYMS: { synonym: string; category: CategoryName }[] = [
  // Culture
  { synonym: "broadcasting", category: "Culture, Youth, Sport & Media" },
  { synonym: "culture", category: "Culture, Youth, Sport & Media" },
  { synonym: "youth", category: "Culture, Youth, Sport & Media" },
  { synonym: "sport", category: "Culture, Youth, Sport & Media" },
  { synonym: "sports", category: "Culture, Youth, Sport & Media" },
  { synonym: "media", category: "Culture, Youth, Sport & Media" },
  { synonym: "arts", category: "Culture, Youth, Sport & Media" },

  // Defence
  { synonym: "defence", category: "Defence" },
  { synonym: "defense", category: "Defence" },
  { synonym: "military", category: "Defence" },
  { synonym: "army", category: "Defence" },

  // Economy (long phrases first)
  { synonym: "innovation", category: "Economy, Employment, Innovation & Research (incl. Agriculture)" },
  { synonym: "research", category: "Economy, Employment, Innovation & Research (incl. Agriculture)" },
  { synonym: "science", category: "Economy, Employment, Innovation & Research (incl. Agriculture)" },
  { synonym: "agriculture", category: "Economy, Employment, Innovation & Research (incl. Agriculture)" },
  { synonym: "farming", category: "Economy, Employment, Innovation & Research (incl. Agriculture)" },
  { synonym: "employment", category: "Economy, Employment, Innovation & Research (incl. Agriculture)" },
  { synonym: "enterprise", category: "Economy, Employment, Innovation & Research (incl. Agriculture)" },
  { synonym: "business", category: "Economy, Employment, Innovation & Research (incl. Agriculture)" },
  { synonym: "economy", category: "Economy, Employment, Innovation & Research (incl. Agriculture)" },
  { synonym: "jobs", category: "Economy, Employment, Innovation & Research (incl. Agriculture)" },
  { synonym: "work", category: "Economy, Employment, Innovation & Research (incl. Agriculture)" },

  // Education
  { synonym: "higher education", category: "Education" },
  { synonym: "universities", category: "Education" },
  { synonym: "university", category: "Education" },
  { synonym: "education", category: "Education" },
  { synonym: "schools", category: "Education" },
  { synonym: "teaching", category: "Education" },
  { synonym: "students", category: "Education" },

  // Environment
  { synonym: "spatial planning", category: "Environment, Housing & Energy" },
  { synonym: "environment", category: "Environment, Housing & Energy" },
  { synonym: "climate", category: "Environment, Housing & Energy" },
  { synonym: "housing", category: "Environment, Housing & Energy" },
  { synonym: "energy", category: "Environment, Housing & Energy" },

  // Finance
  { synonym: "taxation", category: "Finance & Budget" },
  { synonym: "finance", category: "Finance & Budget" },
  { synonym: "budget", category: "Finance & Budget" },
  { synonym: "debt", category: "Finance & Budget" },

  // Foreign affairs
  { synonym: "development cooperation", category: "Foreign Affairs & International" },
  { synonym: "foreign affairs", category: "Foreign Affairs & International" },
  { synonym: "international", category: "Foreign Affairs & International" },
  { synonym: "diplomacy", category: "Foreign Affairs & International" },

  // Administration
  { synonym: "government services", category: "General Administration" },
  { synonym: "civil service", category: "General Administration" },
  { synonym: "administration", category: "General Administration" },

  // Cabinets
  { synonym: "ministerial cabinets", category: "Government Cabinet(s)" },
  { synonym: "ministers' offices", category: "Government Cabinet(s)" },
  { synonym: "cabinets", category: "Government Cabinet(s)" },

  // Health
  { synonym: "social protection", category: "Health & Social Welfare/Care" },
  { synonym: "social welfare", category: "Health & Social Welfare/Care" },
  { synonym: "healthcare", category: "Health & Social Welfare/Care" },
  { synonym: "health care", category: "Health & Social Welfare/Care" },
  { synonym: "hospitals", category: "Health & Social Welfare/Care" },
  { synonym: "welfare", category: "Health & Social Welfare/Care" },
  { synonym: "health", category: "Health & Social Welfare/Care" },
  { synonym: "social", category: "Health & Social Welfare/Care" },
  { synonym: "care", category: "Health & Social Welfare/Care" },

  // Local governments
  { synonym: "local governments", category: "Local Governments & Home Affairs" },
  { synonym: "local government", category: "Local Governments & Home Affairs" },
  { synonym: "home affairs", category: "Local Governments & Home Affairs" },
  { synonym: "municipalities", category: "Local Governments & Home Affairs" },
  { synonym: "communes", category: "Local Governments & Home Affairs" },
  { synonym: "interior", category: "Local Governments & Home Affairs" },

  // Mobility
  { synonym: "public transport", category: "Mobility & Infrastructure" },
  { synonym: "infrastructure", category: "Mobility & Infrastructure" },
  { synonym: "mobility", category: "Mobility & Infrastructure" },
  { synonym: "transport", category: "Mobility & Infrastructure" },
  { synonym: "roads", category: "Mobility & Infrastructure" },
  { synonym: "rail", category: "Mobility & Infrastructure" },

  // Parliament
  { synonym: "legislature", category: "Parliament/Legislature" },
  { synonym: "parliament", category: "Parliament/Legislature" },

  // Provisions
  { synonym: "provisions", category: "Provisions/Other" },

  // Support services
  { synonym: "support services", category: "Support Services (personnel/digital/legal)" },
  { synonym: "personnel", category: "Support Services (personnel/digital/legal)" },
  { synonym: "digital", category: "Support Services (personnel/digital/legal)" },
  { synonym: "legal", category: "Support Services (personnel/digital/legal)" },
  { synonym: "hr", category: "Support Services (personnel/digital/legal)" },

  // Tourism
  { synonym: "tourism", category: "Tourism" },
  { synonym: "tourists", category: "Tourism" },
];

/** Sort synonyms longest-first so multi-word phrases match before fragments. */
export const SORTED_CATEGORY_SYNONYMS = [...CATEGORY_SYNONYMS].sort(
  (a, b) => b.synonym.length - a.synonym.length
);

export function isKnownCategory(name: string): name is CategoryName {
  return (CATEGORIES as readonly string[]).includes(name);
}
