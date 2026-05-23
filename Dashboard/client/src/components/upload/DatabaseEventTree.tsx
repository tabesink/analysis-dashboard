'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { AlertCircle, ChevronDown, Minus, Check } from 'lucide-react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getStatusBadgeClassName } from '@/lib/status-badge';
import type { DatasetInfo, ProgramVersionSummary } from '@/types/upload';

// =============================================================================
// Types
// =============================================================================

export type DatasetRow = DatasetInfo;

export interface ColumnDef {
  key: string;
  label: string;
}

export interface DatabaseEventTreeProps {
  datasets: DatasetRow[];
  /**
   * Full program/version structure across all non-deleted rows (not just the
   * current page). Drives the tree skeleton so the tree never disagrees with
   * /dashboard/versions even when the current page is a subset.
   */
  programVersions: ProgramVersionSummary[];
  selectedDatasets: string[];
  onBatchSelect: (selectionKeys: string[], checked: boolean) => void;
  isDeletingIds: string[];
  columnDefinitions: ColumnDef[];
  getColumnValue: (dataset: DatasetRow, columnKey: string) => string;
  /**
   * Pixel width per column key. The Job ID column is keyed under
   * `programIdWidth` and is supplied separately so the tree can subtract
   * each level's indent and keep the right edge of the first cell aligned
   * with the column header above it.
   */
  columnWidths: Record<string, number>;
  programIdWidth: number;
}

// Indents inside a row that consume part of the Job ID column. The
// first cell at each level is sized as `programIdWidth - <indent at level>`
// so its right edge lands at the same x-coordinate from the row's
// outer-left, keeping the data columns aligned with the header above.
const ROW_PADDING_X_PX = 12;        // matches `px-3`
const VERSION_INDENT_PX = 24 + 1;   // ml-6 + border-l on the wrapper
const LEAF_INDENT_PX = 20 + 1;      // ml-5 + border-l on the wrapper
const FALLBACK_COLUMN_PX = 80;
export const PROGRAM_SCOPE_PREFIX = 'program:';
export const VERSION_SCOPE_PREFIX = 'version:';

export const programScopeKey = (programId: string): string =>
  `${PROGRAM_SCOPE_PREFIX}${programId}`;

export const versionScopeKey = (programId: string, version: string): string =>
  `${VERSION_SCOPE_PREFIX}${programId}::${version}`;

interface VersionGroup {
  version: string;
  events: DatasetRow[];
  eventIds: string[];
  selectionKey: string;
  /** Total event count across the whole database (not just current page). */
  totalEventCount: number;
  /** Distinct status values across the whole database for this version. */
  totalStatuses: string[];
  missingChannelMap: boolean;
  pendingArtifactCount: number;
  failedArtifactCount: number;
}

interface ProgramGroup {
  programId: string;
  versions: VersionGroup[];
  allEventIds: string[];
  selectionKey: string;
  /** Sum of totalEventCount across all versions for this program. */
  totalEventCount: number;
  missingChannelMap: boolean;
}

const STATUS_PRIORITY: Array<DatasetInfo['status']> = ['Obsolete', 'Pending', 'Approved'];

function rollUpStatusFromValues(
  statusValues: string[],
): { label: string; className: string } {
  const unique = [...new Set(statusValues.filter(Boolean))];
  if (unique.length === 0) {
    return { label: '-', className: getStatusBadgeClassName(undefined) };
  }
  if (unique.length === 1) {
    return { label: unique[0], className: getStatusBadgeClassName(unique[0]) };
  }
  for (const p of STATUS_PRIORITY) {
    if (p && unique.includes(p)) {
      return { label: p, className: getStatusBadgeClassName(p) };
    }
  }
  const s = unique[0];
  return { label: s, className: getStatusBadgeClassName(s) };
}

// =============================================================================
// IndeterminateCheckbox
// =============================================================================

interface IndeterminateCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onCheckedChange,
  className,
}: IndeterminateCheckboxProps) {
  const state = indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked';

  return (
    <CheckboxPrimitive.Root
      data-state={state}
      checked={indeterminate ? 'indeterminate' : checked}
      onCheckedChange={(val) => onCheckedChange(val === true)}
      className={cn(
        'peer border-border/70 bg-background dark:bg-input/20 data-[state=checked]:bg-primary/90 data-[state=indeterminate]:bg-primary/90 data-[state=checked]:text-primary-foreground data-[state=indeterminate]:text-primary-foreground data-[state=checked]:border-primary/90 data-[state=indeterminate]:border-primary/90 focus-visible:border-ring focus-visible:ring-ring/50 size-3.5 shrink-0 rounded-[3px] border shadow-none transition-shadow outline-none focus-visible:ring-[2px] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <CheckboxPrimitive.Indicator className="grid place-content-center text-current transition-none">
        {indeterminate ? (
          <Minus className="size-3" />
        ) : (
          <Check className="size-3" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

// =============================================================================
// DatabaseEventTree
// =============================================================================

export function DatabaseEventTree({
  datasets,
  programVersions,
  selectedDatasets,
  onBatchSelect,
  isDeletingIds,
  columnDefinitions,
  getColumnValue,
  columnWidths,
  programIdWidth,
}: DatabaseEventTreeProps) {
  const programRowFirstCellWidth = Math.max(
    0,
    programIdWidth - ROW_PADDING_X_PX,
  );
  const versionRowFirstCellWidth = Math.max(
    0,
    programIdWidth - ROW_PADDING_X_PX - VERSION_INDENT_PX,
  );
  const leafRowFirstCellWidth = Math.max(
    0,
    programIdWidth - ROW_PADDING_X_PX - VERSION_INDENT_PX - LEAF_INDENT_PX,
  );
  const widthOf = (key: string) => columnWidths[key] ?? FALLBACK_COLUMN_PX;
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  const tree: ProgramGroup[] = useMemo(() => {
    // Index events from the current page by program/version so the leaf rows
    // can be rendered when the user expands a version. The skeleton itself
    // (which program/version combos exist, their counts, their rolled-up
    // status) is driven entirely by `programVersions` — the server-side
    // aggregate over all non-deleted rows.
    const eventsByGroup = new Map<string, DatasetRow[]>();
    for (const ds of datasets) {
      const key = `${ds.program_id}::${ds.version}`;
      if (!eventsByGroup.has(key)) eventsByGroup.set(key, []);
      eventsByGroup.get(key)!.push(ds);
    }

    const programMap = new Map<string, VersionGroup[]>();
    for (const summary of programVersions) {
      const key = `${summary.program_id}::${summary.version}`;
      const events = eventsByGroup.get(key) ?? [];
      const group: VersionGroup = {
        version: summary.version,
        events,
        eventIds: events.map((e) => e.event_id),
        selectionKey: versionScopeKey(summary.program_id, summary.version),
        totalEventCount: summary.event_count,
        totalStatuses: summary.statuses,
        missingChannelMap: summary.missing_channel_map,
        pendingArtifactCount: summary.pending_artifact_count,
        failedArtifactCount: summary.failed_artifact_count,
      };
      if (!programMap.has(summary.program_id)) {
        programMap.set(summary.program_id, []);
      }
      programMap.get(summary.program_id)!.push(group);
    }

    return [...programMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([programId, versions]) => {
        const sortedVersions = [...versions].sort((a, b) =>
          a.version.localeCompare(b.version),
        );
        return {
          programId,
          versions: sortedVersions,
          allEventIds: sortedVersions.flatMap((v) => v.eventIds),
          selectionKey: programScopeKey(programId),
          totalEventCount: sortedVersions.reduce(
            (sum, v) => sum + v.totalEventCount,
            0,
          ),
          missingChannelMap: sortedVersions.some((v) => v.missingChannelMap),
        };
      });
  }, [datasets, programVersions]);

  useEffect(() => {
    setExpandedPrograms(new Set(tree.map((p) => p.programId)));
    setExpandedVersions(new Set());
  }, [tree]);

  const selectedSet = useMemo(() => new Set(selectedDatasets), [selectedDatasets]);

  const getGroupState = useCallback(
    (scopeKey: string, eventIds: string[], childScopeKeys: string[] = []) => {
      if (selectedSet.has(scopeKey)) {
        return { allChecked: true, indeterminate: false };
      }
      let checked = 0;
      for (const key of childScopeKeys) {
        if (selectedSet.has(key)) checked++;
      }
      for (const id of eventIds) {
        if (selectedSet.has(id)) checked++;
      }
      const totalSelectable = childScopeKeys.length + eventIds.length;
      return {
        allChecked: checked === totalSelectable && totalSelectable > 0,
        indeterminate: checked > 0 && checked < totalSelectable,
      };
    },
    [selectedSet],
  );

  const toggleProgramExpanded = useCallback((id: string) => {
    setExpandedPrograms((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleVersionExpanded = useCallback((key: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  if (tree.length === 0) return null;

  return (
    <div className="w-full">
      {tree.map((program, programIndex) => {
        const isProgramOpen = expandedPrograms.has(program.programId);
        const pState = getGroupState(
          program.selectionKey,
          program.allEventIds,
          program.versions.map((version) => version.selectionKey),
        );
        const isFirstProgram = programIndex === 0;
        // Program-tail rows should not render their own bottom border.
        // A single table-tail divider is rendered after all rows instead.
        const suppressLastRowBorder = true;

        return (
          <Collapsible
            key={program.programId}
            open={isProgramOpen}
            onOpenChange={() => toggleProgramExpanded(program.programId)}
          >
            {/* Program row */}
            <div
              className={cn(
                'flex items-center gap-2 py-2 px-3 border-t border-b bg-muted/60 hover:bg-muted/70 transition-colors',
                isFirstProgram && '-mt-px',
              )}
            >
              <IndeterminateCheckbox
                checked={pState.allChecked}
                indeterminate={pState.indeterminate}
                onCheckedChange={(checked) =>
                  onBatchSelect([program.selectionKey], checked)
                }
              />
              <CollapsibleTrigger className="p-0.5 hover:bg-muted rounded-sm transition-colors">
                <ChevronDown
                  className={cn(
                    'size-3.5 text-muted-foreground transition-transform duration-200',
                    !isProgramOpen && '-rotate-90',
                  )}
                />
              </CollapsibleTrigger>
              <span
                className="text-xs font-semibold text-foreground select-none cursor-pointer"
                onClick={() => toggleProgramExpanded(program.programId)}
              >
                {program.missingChannelMap && (
                  <AlertCircle
                    className="mr-1 inline size-3.5 text-destructive"
                    aria-label="Channel map required"
                  />
                )}
                {program.programId}
              </span>
              <span className="text-xs text-muted-foreground">
                ({program.totalEventCount})
              </span>
            </div>

            <CollapsibleContent>
              <div>
                <div className="ml-6 border-l border-border">
                  {program.versions.map((vg, versionIndex) => {
                    const vKey = `${program.programId}::${vg.version}`;
                    const isVersionOpen = expandedVersions.has(vKey);
                    const vState = getGroupState(vg.selectionKey, vg.eventIds);
                    const versionStatus = rollUpStatusFromValues(vg.totalStatuses);
                    const isLastVersionInProgram =
                      versionIndex === program.versions.length - 1;
                    // If this is the last version in the program AND it's
                    // collapsed (no events rendered below it), this version
                    // row is the overall last row in the program. Drop its
                    // border-b only when we need to suppress (non-last
                    // program), so the next program's border-t is the single
                    // line at the boundary.
                    const versionRowIsProgramTail =
                      isLastVersionInProgram && !isVersionOpen;

                    return (
                      <Collapsible
                        key={vKey}
                        open={isVersionOpen}
                        onOpenChange={() => toggleVersionExpanded(vKey)}
                      >
                        {/* Version row */}
                        <div
                          className={cn(
                            'flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors',
                            versionRowIsProgramTail && suppressLastRowBorder && 'border-b-0',
                          )}
                        >
                          <div
                            className="flex items-center gap-2 shrink-0 pl-1"
                            style={{ width: versionRowFirstCellWidth }}
                          >
                            <IndeterminateCheckbox
                              checked={vState.allChecked}
                              indeterminate={vState.indeterminate}
                              onCheckedChange={(checked) =>
                                onBatchSelect([vg.selectionKey], checked)
                              }
                            />
                            <CollapsibleTrigger className="p-0.5 hover:bg-muted rounded-sm transition-colors">
                              <ChevronDown
                                className={cn(
                                  'size-3 text-muted-foreground transition-transform duration-200',
                                  !isVersionOpen && '-rotate-90',
                                )}
                              />
                            </CollapsibleTrigger>
                            <span
                              className="text-xs font-medium text-foreground select-none cursor-pointer"
                              onClick={() => toggleVersionExpanded(vKey)}
                            >
                              {vg.missingChannelMap && (
                                <AlertCircle
                                  className="mr-1 inline size-3.5 text-destructive"
                                  aria-label="Channel map required"
                                />
                              )}
                              {vg.version}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({vg.totalEventCount})
                            </span>
                          </div>
                          <div className="flex items-center">
                            {columnDefinitions.map((col) => {
                              if (col.key === 'status') {
                                return (
                                  <span
                                    key={col.key}
                                    className="shrink-0 px-2 flex items-center"
                                    style={{ width: widthOf(col.key) }}
                                  >
                                    <span
                                      className={cn(
                                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium truncate',
                                        versionStatus.className,
                                      )}
                                    >
                                      {versionStatus.label}
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
                              {vg.events.map((dataset, eventIndex) => {
                                const cleanEventId = dataset.event_id.replace(/^.*\//, '');
                                const isDeleting = isDeletingIds.includes(dataset.event_id);
                                // The last event of the last expanded version
                                // is the overall last row in the program. Drop
                                // its border-b when another program follows,
                                // so the next program's border-t is the
                                // single line at the boundary.
                                const isProgramTailEvent =
                                  isLastVersionInProgram &&
                                  eventIndex === vg.events.length - 1;

                                return (
                                  <div
                                    key={dataset.event_id}
                                    className={cn(
                                      'flex items-center py-1.5 px-3 border-b hover:bg-muted/30 transition-colors group',
                                      isDeleting && 'opacity-50',
                                      isProgramTailEvent && suppressLastRowBorder && 'border-b-0',
                                    )}
                                  >
                                    <div
                                      className="flex items-center gap-2 shrink-0 pl-1"
                                      style={{ width: leafRowFirstCellWidth }}
                                    >
                                      <span
                                        className="text-xs text-muted-foreground truncate"
                                        title={cleanEventId}
                                      >
                                        {cleanEventId}
                                      </span>
                                    </div>
                                    <div className="flex items-center">
                                      {columnDefinitions.map((col) => {
                                        const isStatus = col.key === 'status';

                                        if (isStatus) {
                                          return (
                                            <span
                                              key={col.key}
                                              className="shrink-0 px-2"
                                              style={{ width: widthOf(col.key) }}
                                            />
                                          );
                                        }

                                        const value = getColumnValue(dataset, col.key);
                                        return (
                                          <span
                                            key={col.key}
                                            className="shrink-0 text-xs text-foreground/80 truncate px-2 text-center"
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
      <div className="border-b border-border" aria-hidden />
    </div>
  );
}
