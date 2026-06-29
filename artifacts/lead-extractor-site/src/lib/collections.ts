// Types + pure helpers for the Saved Lead Collections feature. Kept free of
// React/DOM so the logic is reusable and unit-testable. Network calls live in
// the useCollections hook; this module is just data shaping + validation.

export interface Collection {
  id: number;
  name: string;
  color: string | null;
  archived: boolean;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
  leadCount: number;
}

export const MAX_NAME = 80;

/** Trim + clamp a name; returns null when empty (mirrors server validation). */
export function sanitizeName(raw: string): string | null {
  const name = raw.trim().slice(0, MAX_NAME);
  return name.length ? name : null;
}

export function duplicateName(name: string): string {
  return `${name} (copy)`.slice(0, MAX_NAME);
}

/** Unique, positive integer ids. */
export function dedupeIds(ids: number[]): number[] {
  return [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
}

/** Case-insensitive name search. */
export function filterCollections(list: Collection[], query: string): Collection[] {
  const q = query.trim().toLowerCase();
  return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
}

/** Stable order: manual sortOrder, then name. */
export function sortCollections(list: Collection[]): Collection[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/** Swap an item up (-1) or down (+1); returns a new array (no-op at bounds). */
export function reorder<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (index < 0 || index >= items.length || j < 0 || j >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[j]] = [copy[j], copy[index]];
  return copy;
}
