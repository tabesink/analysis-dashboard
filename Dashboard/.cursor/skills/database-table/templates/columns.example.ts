/**
 * Example column definitions for the hierarchical-table card.
 *
 * Distilled from the staticColumnDefinitions + dynamicMetadataColumns pattern
 * in client/src/app/database/page.tsx.
 *
 * Pattern:
 *   1. STATIC_COLUMNS — known at compile time, ordered intentionally
 *   2. DYNAMIC_COLUMNS — built from a server-side filter/facet response
 *   3. Concatenate, with the rollup column appended last
 *
 * Replace these with the target's own columns. The keys must match the keys
 * the table's `getColumnValue(row, key)` reads off each leaf row.
 */

import type { ColumnDef } from './types';

/**
 * Static columns: the target knows these exist regardless of what's in the
 * database. Order matters — columns render left-to-right in this order.
 */
export const STATIC_COLUMNS: ColumnDef[] = [
  { key: 'component', label: 'Component' },
  { key: 'axleLocation', label: 'Axle Location' },
];

/**
 * Build dynamic columns from a server-side facet response. Filter out keys
 * already covered by STATIC_COLUMNS. Override the label per key when the raw
 * server label is too long.
 */
export function buildDynamicColumns(
  facets: Record<string, { column: string; label: string; order: number }>,
  coveredKeys: ReadonlySet<string>,
  labelOverrides: Record<string, string> = {},
): ColumnDef[] {
  return Object.values(facets)
    .filter((facet) => !coveredKeys.has(facet.column))
    .sort((a, b) => a.order - b.order)
    .map((facet) => ({
      key: facet.column,
      label: labelOverrides[facet.label] ?? facet.label,
    }));
}

/**
 * Final column list. The rollup column (e.g. status) is appended last so it
 * lives at the right edge of the table — visually separating it from the
 * editable metadata columns to its left.
 */
export function buildColumnDefinitions(
  dynamicColumns: ColumnDef[],
  rollupColumn?: ColumnDef,
): ColumnDef[] {
  return [
    ...STATIC_COLUMNS,
    ...dynamicColumns,
    ...(rollupColumn ? [rollupColumn] : []),
  ];
}

/**
 * Example: a target that has a `status` rollup. Pass to buildColumnDefinitions.
 */
export const EXAMPLE_ROLLUP_COLUMN: ColumnDef = { key: 'status', label: 'Status' };
