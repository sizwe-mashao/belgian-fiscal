/**
 * Guards against any non-numeric value that might end up in Firestore
 * (e.g. a data-entry error) — treats it as "not quantified" rather than
 * corrupting a total via string concatenation or NaN.
 *
 * Returns the amount when it is a finite number, otherwise null so callers
 * can exclude it from a sum and mark the row incomplete.
 */
export function safeAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Same guard as a zero-coerced summand — used only where a missing figure
 * must not contribute, and the caller already tracks incompleteness separately. */
export function safeAmountOrZero(value: unknown): number {
  return safeAmount(value) ?? 0;
}
