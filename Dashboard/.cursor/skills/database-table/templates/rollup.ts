/**
 * Generalized priority-based rollup utility.
 *
 * Distilled from:
 *   client/src/components/upload/DatabaseEventTree.tsx (rollUpStatusFromValues)
 *   client/src/lib/status-badge.ts (getStatusBadgeClassName)
 *
 * Rollup semantics:
 *   1. If all leaves share one value, show that value.
 *   2. Else, walk the priority list in order — the first value that appears
 *      in any leaf wins.
 *   3. Else (no values at all), show '-'.
 *
 * The class map is target-supplied so the same rollup utility can drive a
 * Status badge, a Severity badge, a Risk badge, etc.
 */

export interface RollupResult {
  /** The chosen value to render in the badge (or '-' for no values). */
  label: string;
  /** Tailwind class string supplied by `classNameFor` for the chosen value. */
  className: string;
}

export function rollupByPriority<T extends string>(
  values: readonly (T | string | null | undefined)[],
  priority: readonly T[],
  classNameFor: (value: string | null | undefined) => string,
): RollupResult {
  const unique = [...new Set(values.filter((v): v is T => Boolean(v)))];

  if (unique.length === 0) {
    return { label: '-', className: classNameFor(undefined) };
  }
  if (unique.length === 1) {
    return { label: unique[0], className: classNameFor(unique[0]) };
  }
  for (const p of priority) {
    if (p && unique.includes(p)) {
      return { label: p, className: classNameFor(p) };
    }
  }
  // No priority match — fall back to the first value (preserves a stable
  // result rather than picking arbitrarily).
  const fallback = unique[0];
  return { label: fallback, className: classNameFor(fallback) };
}

/**
 * Example class map matching the canonical implementation. Replace per target.
 *
 * The Workbench convention: `Approved → green`, `Obsolete → red`, default → amber.
 * Use the same `bg-X-100 text-X-700` shape so badges read at a glance against
 * the muted/60 group-row background.
 */
export function exampleStatusClassName(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (v === 'Approved') return 'bg-green-100 text-green-700';
  if (v === 'Obsolete') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}

/**
 * Example priority order matching the canonical implementation. Replace per
 * target. Earlier entries win when a group has mixed values.
 */
export const EXAMPLE_STATUS_PRIORITY = ['Obsolete', 'Pending', 'Approved'] as const;
