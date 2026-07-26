/**
 * Canonical department_id slug used in Firestore.
 * Behaviour must stay identical to the former scripts/seed.js helper —
 * accents, ampersands, parentheses and slashes all become underscores.
 */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
