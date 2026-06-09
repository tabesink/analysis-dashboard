/**
 * Shared types for the hierarchical database-table card.
 *
 * Distilled from:
 *   client/src/components/upload/DatabaseEventTree.tsx
 *   client/src/types/upload.ts (DatasetInfo, ProgramVersionSummary)
 *
 * Naming convention:
 *   - LeafRow      = the unit of data in the table (one row per leaf entity)
 *   - GroupSummary = the aggregate that drives the tree skeleton even when the
 *                    current page is a subset of the database (so the tree
 *                    never disagrees with the server-side total)
 *   - ColumnDef    = a presentation-level column descriptor
 *   - RollupConfig = priority + class-map for rolling up a leaf field at the
 *                    group / subgroup level
 */

/**
 * Index signature so the table can read arbitrary column values off a leaf row
 * without coupling to the target's domain shape. The page wires `getColumnValue`
 * to read these by key.
 */
export interface LeafRow {
  /** Stable id used for selection batching and React keys. */
  id: string;
  /** Level-1 grouping key (e.g. customer id, project id, program id). */
  groupKey: string;
  /** Level-2 grouping key for the 3-level variant. Omit for the 2-level variant. */
  subgroupKey?: string;
  /** Display label rendered in the leaf row's first cell (e.g. event id, task name). */
  label: string;
  /** Free-form metadata read by `getColumnValue`. Strings or booleans only;
   *  cast to string for display. */
  [columnKey: string]: string | number | boolean | null | undefined;
}

/**
 * Server-side aggregate that drives the tree skeleton. The skeleton (which
 * groups exist, their counts, their rolled-up value) must come from this so
 * the tree never disagrees with the database total when the current page is a
 * subset.
 */
export interface GroupSummary {
  /** Level-1 grouping key. */
  groupKey: string;
  /** Level-2 grouping key. Omit for the 2-level variant. */
  subgroupKey?: string;
  /** Total leaf count across the whole database for this group/subgroup. */
  leafCount: number;
  /** Distinct rollup-field values across the whole database for this
   *  group/subgroup. Omit if the table has no rollup column. */
  rollupValues?: string[];
}

export interface ColumnDef {
  /** Stable key used for sort/filter/visibility state and `getColumnValue`. */
  key: string;
  /** Header label shown to the user. */
  label: string;
}

export interface RollupConfig {
  /** Column key the rollup is computed from. */
  field: string;
  /** Ordered priority list. When a group has mixed values, the first one in
   *  this list that any leaf has wins. */
  priority: readonly string[];
  /** Maps a rollup value to the Tailwind class string for its badge.
   *  Return a default class for unknown values. */
  classNameFor: (value: string) => string;
}
