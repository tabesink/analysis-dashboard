'use client';

/**
 * Two-level hierarchical tree (Group > Leaf).
 *
 * Derived from HierarchicalTable.three-level.tsx by collapsing the inner
 * Collapsible — there is no Subgroup level. The rollup column (if configured)
 * paints at the Group row instead of at a Subgroup row.
 *
 * Use this variant for targets like Customer > Order, Project > Task,
 * Organization > Member, etc.
 *
 * All other behaviors and class strings are identical to the 3-level variant.
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
// Spacing tokens (see ../tokens.md)
// =============================================================================

const ROW_PADDING_X_PX = 12;
const LEAF_INDENT_PX = 20 + 1;
const FALLBACK_COLUMN_PX = 80;

// =============================================================================
// Types
// =============================================================================

export interface HierarchicalTableProps {
  rows: LeafRow[];
  summary: GroupSummary[];
  selectedIds: string[];
  onBatchSelect: (leafIds: string[], checked: boolean) => void;
  isDeletingIds?: string[];
  columnDefinitions: ColumnDef[];
  getColumnValue: (row: LeafRow, columnKey: string) => string;
  columnWidths: Record<string, number>;
  /** Pixel width of the level-1 (Group) column. The leaf row's first cell is
   *  computed as `level1Width - paddingX - LEAF_INDENT_PX` so the data columns
   *  stay aligned with the headers regardless of indent. */
  level1Width: number;
  /** Optional rollup config. The badge paints at the Group row in this variant. */
  rollup?: RollupConfig;
}

interface GroupNode {
  groupKey: string;
  rows: LeafRow[];
  leafIds: string[];
  totalLeafCount: number;
  rollupValues: string[];
}

// =============================================================================
// HierarchicalTable (2-level)
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
  const leafRowFirstCellWidth = Math.max(
    0,
    level1Width - ROW_PADDING_X_PX - LEAF_INDENT_PX,
  );
  const widthOf = (key: string) => columnWidths[key] ?? FALLBACK_COLUMN_PX;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const tree: GroupNode[] = useMemo(() => {
    const rowsByGroup = new Map<string, LeafRow[]>();
    for (const row of rows) {
      if (!rowsByGroup.has(row.groupKey)) rowsByGroup.set(row.groupKey, []);
      rowsByGroup.get(row.groupKey)!.push(row);
    }

    return summary
      .slice()
      .sort((a, b) => a.groupKey.localeCompare(b.groupKey))
      .map((s) => {
        const groupRows = rowsByGroup.get(s.groupKey) ?? [];
        return {
          groupKey: s.groupKey,
          rows: groupRows,
          leafIds: groupRows.map((r) => r.id),
          totalLeafCount: s.leafCount,
          rollupValues: s.rollupValues ?? [],
        };
      });
  }, [rows, summary]);

  useEffect(() => {
    setExpandedGroups(new Set(tree.map((g) => g.groupKey)));
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

  if (tree.length === 0) return null;

  return (
    <div className="w-full">
      {tree.map((group, groupIndex) => {
        const isGroupOpen = expandedGroups.has(group.groupKey);
        const gState = getGroupState(group.leafIds);
        const isFirstGroup = groupIndex === 0;
        const isLastGroup = groupIndex === tree.length - 1;
        const suppressLastRowBorder = !isLastGroup;
        const groupRollup = rollup
          ? rollupByPriority(
              group.rollupValues,
              rollup.priority,
              rollup.classNameFor,
            )
          : null;
        // Group row IS the visible group tail when collapsed. When expanded,
        // the last leaf row is the tail.
        const groupRowIsGroupTail = !isGroupOpen;

        return (
          <Collapsible
            key={group.groupKey}
            open={isGroupOpen}
            onOpenChange={() => toggleGroupExpanded(group.groupKey)}
          >
            {/* Group row */}
            <div
              className={cn(
                'flex items-center py-2 px-3 border-t border-b bg-muted/60 hover:bg-muted/70 transition-colors',
                isFirstGroup && '-mt-px',
                groupRowIsGroupTail && suppressLastRowBorder && 'border-b-0',
              )}
            >
              <div
                className="flex items-center gap-2 shrink-0 pl-1"
                style={{ width: Math.max(0, level1Width - ROW_PADDING_X_PX) }}
              >
                <IndeterminateCheckbox
                  checked={gState.allChecked}
                  indeterminate={gState.indeterminate}
                  onCheckedChange={(checked) =>
                    onBatchSelect(group.leafIds, checked)
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
              <div className="flex items-center">
                {columnDefinitions.map((col) => {
                  if (rollup && col.key === rollup.field && groupRollup) {
                    return (
                      <span
                        key={col.key}
                        className="shrink-0 px-2 flex items-center"
                        style={{ width: widthOf(col.key) }}
                      >
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium truncate',
                            groupRollup.className,
                          )}
                        >
                          {groupRollup.label}
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
                  {group.rows.map((row, leafIndex) => {
                    const isDeleting = isDeletingIds.includes(row.id);
                    const isGroupTailLeaf = leafIndex === group.rows.length - 1;

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
                            // Rollup column stays empty at the leaf row.
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
  );
}
