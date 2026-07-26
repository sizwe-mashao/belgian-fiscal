import type { EntityId } from "../competence";

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

export type MatchResult =
  | { ok: true; plan: QueryPlan }
  | { ok: false; reason: string };
