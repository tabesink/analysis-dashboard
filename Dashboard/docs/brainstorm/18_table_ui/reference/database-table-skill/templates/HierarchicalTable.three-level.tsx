'use client';

/**
 * Three-level hierarchical tree (Group > Subgroup > Leaf).
 *
 * Ported from client/src/components/upload/DatabaseEventTree.tsx with neutral
 * naming. The original used Program > Version > Event terminology specific to
 * the Multimatic Workbench domain.
 *
 * Behaviors preserved (all 12 must-haves from the database-table skill):
 *   - Indeterminate batch checkboxes at every group level
 *   - Collapsible group rows with rotating chevron
 *   - Indent-aware first-cell width math (the alignment trick)
 *   - Single-boundary rule (no double borders between groups)
 *   - Rollup badge at the subgroup level (priority-driven)
 *
 * Page-level concerns NOT in this file (see TablePage.example.tsx):
 *   - Sticky header rendering
 *   - Sort / filter / visibility state
 *   - Column resize handles in the header
 *   - Empty / loading / refreshing states
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { IndeterminateCheckbox } from './IndeterminateCheckbox';
import { rollupByPriority } from './rollup';
import type { ColumnDef, GroupSummary, LeafRow, RollupConfig } from './types';

// =============================================================================
// Spacing tokens (see ../tokens.md). Do not "simplify" the `+ 1` for the border.
// =============================================================================

const ROW_PADDING_X_PX = 12;        // matches `px-3`
const SUBGROUP_INDENT_PX = 24 + 1;  // ml-6 + 1px border-l
const LEAF_INDENT_PX = 20 + 1;      // ml-5 + 1px border-l
const FALLBACK_COLUMN_PX = 80;

// =============================================================================
// Types
// =============================================================================

export interface HierarchicalTableProps {
  /** Leaf rows for the *current page* of the data. The tree skeleton is built
   *  from `summary` so the tree never disagrees with the database total. */
  rows: LeafRow[];
  /** Server-side aggregate over all rows. Drives the tree skeleton and the
   *  per-group leaf counts. */
  summary: GroupSummary[];
  /** Selected leaf ids (controlled). */
  selectedIds: string[];
  /** Called when the user toggles selection at any level. */
  onBatchSelect: (leafIds: string[], checked: boolean) => void;
  /** Leaf ids currently being deleted (rendered with reduced opacity). */
  isDeletingIds?: string[];
  /** Visible columns in render order. The rollup column (if any) is included
   *  here; this component decides whether to render the rollup badge or an
   *  empty placeholder per row. */
  columnDefinitions: ColumnDef[];
  /** Reads a column's value off a leaf row. */
  getColumnValue: (row: LeafRow, columnKey: string) => string;
  /** Pixel widths per column key. */
  columnWidths: Record<string, number>;
  /** Pixel width of the level-1 (Group) column. The first cell at each level
   *  is computed as `level1Width - paddingX - sum(indents above)` so the data
   *  columns stay aligned with the headers regardless of indent. */
  level1Width: number;
  /** Optional rollup config. Omit to disable the rollup column entirely. */
  rollup?: RollupConfig;
  /** Localized labels for each tree level (purely cosmetic — used in the
   *  group/subgroup row text). Keys: levelOne, levelTwo. */
  labels?: { levelOne?: string; levelTwo?: string };
}

interface SubgroupNode {
  subgroupKey: string;
  rows: LeafRow[];
  leafIds: string[];
  totalLeafCount: number;
  rollupValues: string[];
}

interface GroupNode {
  groupKey: string;
  subgroups: SubgroupNode[];
  allLeafIds: string[];
  totalLeafCount: number;
}

// =============================================================================
// HierarchicalTable
// =============================================================================

export function HierarchicalTable({
  rows,
  summary,
  selectedIds,
  onBatchSelect,
  isDeletingIds = [],
  columnDefinitions,
  getColumnValue,
  columnWidths,
  level1Width,
  rollup,
}: HierarchicalTableProps) {
  // groupRowFirstCellWidth is intentionally NOT computed here: the group row
  // uses natural inline sizing because its first cell holds the chevron +
  // label rather than a fixed-width container. If a target needs a fixed
  // width on the group row's first cell, compute it as
  //   `Math.max(0, level1Width - ROW_PADDING_X_PX)`
  // and apply via `style={{ width }}` on the row's first content wrapper.
  const subgroupRowFirstCellWidth = Math.max(
    0,
    level1Width - ROW_PADDING_X_PX - SUBGROUP_INDENT_PX,
  );
  const leafRowFirstCellWidth = Math.max(
    0,
    level1Width - ROW_PADDING_X_PX - SUBGROUP_INDENT_PX - LEAF_INDENT_PX,
  );
  const widthOf = (key: string) => columnWidths[key] ?? FALLBACK_COLUMN_PX;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedSubgroups, setExpandedSubgroups] = useState<Set<string>>(new Set());

  const tree: GroupNode[] = useMemo(() => {
    // Index current-page rows by group/subgroup so the leaves can be rendered
    // when the user expands a subgroup. The skeleton itself comes from
    // `summary` (the server-side aggregate over all rows).
    const rowsByGroup = new Map<string, LeafRow[]>();
    for (const row of rows) {
      const key = `${row.groupKey}::${row.subgroupKey ?? ''}`;
      if (!rowsByGroup.has(key)) rowsByGroup.set(key, []);
      rowsByGroup.get(key)!.push(row);
    }

    const groupMap = new Map<string, SubgroupNode[]>();
    for (const s of summary) {
      const key = `${s.groupKey}::${s.subgroupKey ?? ''}`;
      const subRows = rowsByGroup.get(key) ?? [];
      const node: SubgroupNode = {
        subgroupKey: s.subgroupKey ?? '',
        rows: subRows,
        leafIds: subRows.map((r) => r.id),
        totalLeafCount: s.leafCount,
        rollupValues: s.rollupValues ?? [],
      };
      if (!groupMap.has(s.groupKey)) groupMap.set(s.groupKey, []);
      groupMap.get(s.groupKey)!.push(node);
    }

    return [...groupMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupKey, subgroups]) => {
        const sortedSubgroups = [...subgroups].sort((a, b) =>
          a.subgroupKey.localeCompare(b.subgroupKey),
        );
        return {
          groupKey,
          subgroups: sortedSubgroups,
          allLeafIds: sortedSubgroups.flatMap((s) => s.leafIds),
          totalLeafCount: sortedSubgroups.reduce(
            (sum, s) => sum + s.totalLeafCount,
            0,
          ),
        };
      });
  }, [rows, summary]);

  useEffect(() => {
    setExpandedGroups(new Set(tree.map((g) => g.groupKey)));
    setExpandedSubgroups(new Set());
  }, [tree]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const getGroupState = useCallback(
    (leafIds: string[]) => {
      let checked = 0;
      for (const id of leafIds) {
        if (selectedSet.has(id)) checked++;
      }
      return {
        allChecked: checked === leafIds.length && leafIds.length > 0,
        indeterminate: checked > 0 && checked < leafIds.length,
      };
    },
    [selectedSet],
  );

  const toggleGroupExpanded = useCallback((id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSubgroupExpanded = useCallback((key: string) => {
    setExpandedSubgroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (tree.length === 0) return null;

  return (
    <div className="w-full">
      {tree.map((group, groupIndex) => {
        const isGroupOpen = expandedGroups.has(group.groupKey);
        const gState = getGroupState(group.allLeafIds);
        const isFirstGroup = groupIndex === 0;
        const isLastGroup = groupIndex === tree.length - 1;
        // Last row in a group drops its bottom border when another group
        // follows, so the next group's border-t paints the single line at
        // that boundary (no stacking). The last group keeps its bottom
        // border — it IS the bottom of the table.
        const suppressLastRowBorder = !isLastGroup;

        return (
          <Collapsible
            key={group.groupKey}
            open={isGroupOpen}
            onOpenChange={() => toggleGroupExpanded(group.groupKey)}
          >
            {/* Group row */}
            <div
              className={cn(
                'flex items-center gap-2 py-2 px-3 border-t border-b bg-muted/60 hover:bg-muted/70 transition-colors',
                isFirstGroup && '-mt-px',
              )}
            >
              <IndeterminateCheckbox
                checked={gState.allChecked}
                indeterminate={gState.indeterminate}
                onCheckedChange={(checked) =>
                  onBatchSelect(group.allLeafIds, checked)
                }
              />
              <CollapsibleTrigger className="p-0.5 hover:bg-muted rounded-sm transition-colors">
                <ChevronDown
                  className={cn(
                    'size-3.5 text-muted-foreground transition-transform duration-200',
                    !isGroupOpen && '-rotate-90',
                  )}
                />
              </CollapsibleTrigger>
              <span
                className="text-xs font-semibold text-foreground select-none cursor-pointer"
                onClick={() => toggleGroupExpanded(group.groupKey)}
              >
                {group.groupKey}
              </span>
              <span className="text-xs text-muted-foreground">
                ({group.totalLeafCount})
              </span>
            </div>

            <CollapsibleContent>
              <div>
                <div className="ml-6 border-l border-border">
                  {group.subgroups.map((sub, subIndex) => {
                    const sKey = `${group.groupKey}::${sub.subgroupKey}`;
                    const isSubOpen = expandedSubgroups.has(sKey);
                    const sState = getGroupState(sub.leafIds);
                    const subRollup = rollup
                      ? rollupByPriority(
                          sub.rollupValues,
                          rollup.priority,
                          rollup.classNameFor,
                        )
                      : null;
                    const isLastSubInGroup = subIndex === group.subgroups.length - 1;
                    // Subgroup row is the visible group tail when it's the last
                    // subgroup AND it's collapsed (no leaves rendered below).
                    const subRowIsGroupTail = isLastSubInGroup && !isSubOpen;

                    return (
                      <Collapsible
                        key={sKey}
                        open={isSubOpen}
                        onOpenChange={() => toggleSubgroupExpanded(sKey)}
                      >
                        {/* Subgroup row */}
                        <div
                          className={cn(
                            'flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors',
                            subRowIsGroupTail && suppressLastRowBorder && 'border-b-0',
                          )}
                        >
                          <div
                            className="flex items-center gap-2 shrink-0 pl-1"
                            style={{ width: subgroupRowFirstCellWidth }}
                          >
                            <IndeterminateCheckbox
                              checked={sState.allChecked}
                              indeterminate={sState.indeterminate}
                              onCheckedChange={(checked) =>
                                onBatchSelect(sub.leafIds, checked)
                              }
                            />
                            <CollapsibleTrigger className="p-0.5 hover:bg-muted rounded-sm transition-colors">
                              <ChevronDown
                                className={cn(
                                  'size-3 text-muted-foreground transition-transform duration-200',
                                  !isSubOpen && '-rotate-90',
                                )}
                              />
                            </CollapsibleTrigger>
                            <span
                              className="text-xs font-medium text-foreground select-none cursor-pointer"
                              onClick={() => toggleSubgroupExpanded(sKey)}
                            >
                              {sub.subgroupKey}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({sub.totalLeafCount})
                            </span>
                          </div>
                          <div className="flex items-center">
                            {columnDefinitions.map((col) => {
                              if (rollup && col.key === rollup.field && subRollup) {
                                return (
                                  <span
                                    key={col.key}
                                    className="shrink-0 px-2 flex items-center"
                                    style={{ width: widthOf(col.key) }}
                                  >
                                    <span
                                      className={cn(
                                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium truncate',
                                        subRollup.className,
                                      )}
                                    >
                                      {subRollup.label}
                                    </span>
                                  </span>
                                );
                              }
                              return (
                                <span
                                  key={col.key}
                                  className="shrink-0 px-2"
                                  style={{ width: widthOf(col.key) }}
                                />
                              );
                            })}
                          </div>
                        </div>

                        <CollapsibleContent>
                          <div>
                            <div className="ml-5 border-l border-border">
                              {sub.rows.map((row, leafIndex) => {
                                const isDeleting = isDeletingIds.includes(row.id);
                                // Last leaf of the last subgroup is the
                                // overall group tail. Drop its border-b when
                                // another group follows.
                                const isGroupTailLeaf =
                                  isLastSubInGroup &&
                                  leafIndex === sub.rows.length - 1;

                                return (
                                  <div
                                    key={row.id}
                                    className={cn(
                                      'flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors group',
                                      isDeleting && 'opacity-50',
                                      isGroupTailLeaf && suppressLastRowBorder && 'border-b-0',
                                    )}
                                  >
                                    <div
                                      className="flex items-center gap-2 shrink-0 pl-1"
                                      style={{ width: leafRowFirstCellWidth }}
                                    >
                                      <span
                                        className="text-xs text-muted-foreground truncate"
                                        title={row.label}
                                      >
                                        {row.label}
                                      </span>
                                    </div>
                                    <div className="flex items-center">
                                      {columnDefinitions.map((col) => {
                                        // The rollup column stays empty at the
                                        // leaf row — the badge belongs only at
                                        // the rollup level.
                                        if (rollup && col.key === rollup.field) {
                                          return (
                                            <span
                                              key={col.key}
                                              className="shrink-0 px-2"
                                              style={{ width: widthOf(col.key) }}
                                            />
                                          );
                                        }

                                        const value = getColumnValue(row, col.key);
                                        return (
                                          <span
                                            key={col.key}
                                            className="shrink-0 text-xs text-foreground/80 truncate px-2"
                                            style={{ width: widthOf(col.key) }}
                                            title={value}
                                          >
                                            {value || '-'}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
