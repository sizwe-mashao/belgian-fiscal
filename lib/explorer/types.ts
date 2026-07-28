import type { AbsenceReason, EntityId } from "@/lib/competence";

export type { EntityId };

export type Operation =
  | "total"
  | "breakdown"
  | "compare"
  | "change"
  | "share"
  | "rank";

export type Basis = "commitment" | "payment";
export type Metric = "total" | "perCapita";
export type Year = 2025 | 2026;

export type QueryPlan = {
  operation: Operation;
  entities: EntityId[]; // one; several for `compare`
  category: string | null; // DISPLAY NAME, not slug; null = whole budget
  year: Year;
  compareYear?: Year; // `change` only
  basis: Basis;
  metric: Metric;
  limit?: number; // `rank` only
};

/**
 * Stage 1. A failure carries a specific reason so the page can say what it
 * could not understand — it must never fall back to a guessed plan.
 */
export type MatchResult =
  | { ok: true; plan: QueryPlan }
  | { ok: false; error: string };

/**
 * Stage 2. Rejects impossible plans before any query runs — notably
 * commitment basis on federal, where every source figure is "n/q".
 */
export type ValidationResult =
  | { ok: true; plan: QueryPlan }
  | { ok: false; error: string };

/** An expenditure document as stored, narrowed to what the executor reads. */
export type ExpenditureSliceRow = {
  region_id: EntityId;
  department_id: string;
  financial_year: number;
  commitment_amount_eur_000: number | null;
  payment_amount_eur_000: number | null;
  notes: string | null;
};

export type ResultRow = {
  entity: EntityId;
  /** Display name, absent for whole-budget rows. */
  category?: string;
  label: string;
  /** Euros, already converted from the stored EUR '000. */
  amount_eur: number;
  /** Present when metric is perCapita; null when the population is unknown. */
  per_capita_eur?: number | null;
  /** `change` only. */
  previous_amount_eur?: number;
  previous_per_capita_eur?: number | null;
  delta_eur?: number;
  delta_pct?: number | null;
  /** `share` only. */
  share_pct?: number | null;
  /**
   * At least one contributing row was not quantified in the source, so this
   * figure is a partial sum rather than the full picture.
   */
  incomplete?: boolean;
};

/**
 * Why a valid plan returned nothing. Produced by the competence model, never
 * by the language model — `reason` is deterministic prose.
 */
export type AbsencePayload = {
  entity: EntityId;
  category: string;
  kind: AbsenceReason["kind"];
  reason: string;
};

export type QueryResult = {
  plan: QueryPlan;
  rows: ResultRow[];
  empty: boolean;
  /** Verbatim source notes from the rows that were actually summed. */
  caveats: string[];
  incomplete: boolean;
  absence?: AbsencePayload;
};

/**
 * Narrative is optional by design: if Gemini fails or is not configured, the
 * figures and caveats must still render. They do not depend on the model.
 */
export type AskSuccess = QueryResult & { narrative?: string };

export type AskError = { error: string };

export type AskResponse = AskSuccess | AskError;
