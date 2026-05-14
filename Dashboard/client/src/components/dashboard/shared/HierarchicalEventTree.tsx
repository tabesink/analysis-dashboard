'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { AlertCircle, Check, ChevronRight, History, Minus, RefreshCw, X } from 'lucide-react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/shadcn-io/color-picker';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn, getEventDisplayName, truncateLabel } from '@/lib/utils';
import { getStatusBadgeClassName } from '@/lib/status-badge';
import type { EventMetadata } from '@/types/api';

// =============================================================================
// Types
// =============================================================================

export interface HierarchicalEventTreeProps {
  /** Flat event array; grouped internally by program_id > version */
  events: EventMetadata[];
  /** Check if a specific event is checked */
  isChecked: (eventId: string) => boolean;
  /** Toggle a single event */
  onToggleEvent: (eventId: string) => void;
  /** Check if a specific event is pinned */
  isPinned?: (eventId: string) => boolean;
  /** Unpin a specific event */
  onUnpinEvent?: (eventId: string) => void;
  /** Set checked state for a batch of events */
  onBatchSetChecked: (eventIds: string[], checked: boolean) => void;
  /** Select all events */
  onSelectAll: () => void;
  /** Deselect all events */
  onSelectNone: () => void;
  /** Tailwind height class for scroll area */
  heightClass?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Show status badge on leaf events */
  showStatusBadge?: boolean;
  /** Show expand/collapse controls above the tree */
  showExpandCollapseControls?: boolean;
  /** Expand all program/version nodes on initial render and data refresh */
  defaultExpandAll?: boolean;
  /** Expand only program nodes on initial render and data refresh */
  defaultExpandPrograms?: boolean;
  /** Show right-side program/version color swatches */
  showColorSwatches?: boolean;
  /** Resolve program color */
  getProgramColor?: (programId: string) => string;
  /** Set program color */
  onProgramColorChange?: (programId: string, color: string) => void;
  /** Reset program color */
  onProgramColorReset?: (programId: string) => void;
  /** Returns true if program has user override */
  isProgramColorCustomized?: (programId: string) => boolean;
  /** Resolve version color (program-scoped) */
  getVersionColor?: (programId: string, version: string) => string;
  /** Set version color (program-scoped) */
  onVersionColorChange?: (programId: string, version: string, color: string) => void;
  /** Reset version color (program-scoped) */
  onVersionColorReset?: (programId: string, version: string) => void;
  /** Returns true if version has user override */
  isVersionColorCustomized?: (programId: string, version: string) => boolean;
}

// Internal tree structure
interface VersionGroup {
  version: string;
  events: EventMetadata[];
  eventIds: string[];
  selectableEventIds: string[];
  missingChannelMap: boolean;
}

interface ProgramGroup {
  programId: string;
  versions: VersionGroup[];
  allEventIds: string[];
  selectableEventIds: string[];
  missingChannelMap: boolean;
}

const MAX_EVENT_LABEL_CHARS = 40;
const PENDING_CHANNEL_MAP_EVENT_PREFIX = '__pending_channel_map__::';

// =============================================================================
// IndeterminateCheckbox
// =============================================================================

interface IndeterminateCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onCheckedChange,
  className,
  disabled = false,
}: IndeterminateCheckboxProps) {
  const state = indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked';

  return (
    <CheckboxPrimitive.Root
      data-state={state}
      checked={indeterminate ? 'indeterminate' : checked}
      onCheckedChange={(val) => onCheckedChange(val === true)}
      disabled={disabled}
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
// HierarchicalEventTree
// =============================================================================

export function HierarchicalEventTree({
  events,
  isChecked,
  onToggleEvent,
  isPinned,
  onUnpinEvent,
  onBatchSetChecked,
  onSelectAll,
  onSelectNone,
  heightClass,
  emptyMessage = 'No events available',
  showStatusBadge = false,
  showExpandCollapseControls = true,
  defaultExpandAll = false,
  defaultExpandPrograms = false,
  showColorSwatches = false,
  getProgramColor: _getProgramColor,
  onProgramColorChange: _onProgramColorChange,
  onProgramColorReset,
  isProgramColorCustomized: _isProgramColorCustomized,
  getVersionColor,
  onVersionColorChange,
  onVersionColorReset: _onVersionColorReset,
  isVersionColorCustomized: _isVersionColorCustomized,
}: HierarchicalEventTreeProps) {
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(
    new Set(),
  );
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    new Set(),
  );

  // ── Build tree: Program > Version > Events ──
  const tree: ProgramGroup[] = useMemo(() => {
    const programMap = new Map<string, Map<string, EventMetadata[]>>();

    for (const event of events) {
      if (!programMap.has(event.program_id)) {
        programMap.set(event.program_id, new Map());
      }
      const versionMap = programMap.get(event.program_id)!;
      if (!versionMap.has(event.version)) {
        versionMap.set(event.version, []);
      }
      versionMap.get(event.version)!.push(event);
    }

    return [...programMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([programId, versionMap]) => {
        const versions: VersionGroup[] = [...versionMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([version, versionEvents]) => ({
            version,
            events: versionEvents,
            eventIds: versionEvents.map((e) => e.event_id),
            selectableEventIds: versionEvents
              .filter((e) => e.selectable_for_plotting !== false)
              .map((e) => e.event_id),
            missingChannelMap: versionEvents.some((e) => e.missing_channel_map),
          }));

        return {
          programId,
          versions,
          allEventIds: versions.flatMap((v) => v.eventIds),
          selectableEventIds: versions.flatMap((v) => v.selectableEventIds),
          missingChannelMap: versions.some((v) => v.missingChannelMap),
        };
      });
  }, [events]);

  // ── Checked-state helper for any group of event IDs ──
  const getGroupState = useCallback(
    (eventIds: string[]) => {
      let checked = 0;
      for (const id of eventIds) {
        if (isChecked(id)) checked++;
      }
      return {
        allChecked: checked === eventIds.length && eventIds.length > 0,
        indeterminate: checked > 0 && checked < eventIds.length,
        checked,
        total: eventIds.length,
      };
    },
    [isChecked],
  );

  // ── Expand / collapse ──
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

  const expandAll = useCallback(() => {
    setExpandedPrograms(new Set(tree.map((p) => p.programId)));
    setExpandedVersions(
      new Set(
        tree.flatMap((p) =>
          p.versions.map((v) => `${p.programId}::${v.version}`),
        ),
      ),
    );
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedPrograms(new Set());
    setExpandedVersions(new Set());
  }, []);

  const expandProgramsOnly = useCallback(() => {
    setExpandedPrograms(new Set(tree.map((p) => p.programId)));
    setExpandedVersions(new Set());
  }, [tree]);

  useEffect(() => {
    if (defaultExpandAll) {
      expandAll();
      return;
    }
    if (defaultExpandPrograms) {
      expandProgramsOnly();
    }
  }, [defaultExpandAll, defaultExpandPrograms, expandAll, expandProgramsOnly]);

  // ── Empty state ──
  if (events.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-2">
      {/* Controls */}
      <div className="flex items-center justify-between">
        {showExpandCollapseControls ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={expandAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors h-auto py-0 px-1"
            >
              Expand
            </Button>
            <span className="text-xs text-muted-foreground">/</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={collapseAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors h-auto py-0 px-1"
            >
              Collapse
            </Button>
          </div>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSelectAll}
            className="text-xs text-primary hover:underline font-medium h-auto py-0 px-1"
          >
            All
          </Button>
          <span className="text-xs text-muted-foreground">/</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onSelectNone}
            className="text-xs text-primary hover:underline font-medium h-auto py-0 px-1"
          >
            None
          </Button>
        </div>
      </div>

      {/* Tree */}
      <ScrollArea className={heightClass ?? 'flex-1 min-h-0'}>
        <div className="space-y-0.5 pr-3">
          {tree.map((program) => {
            const isProgramOpen = expandedPrograms.has(program.programId);
            const pState = getGroupState(program.selectableEventIds);
            const isProgramDisabled = program.selectableEventIds.length === 0;

            return (
              <Collapsible
                key={program.programId}
                open={isProgramOpen}
                onOpenChange={() => toggleProgramExpanded(program.programId)}
              >
                {/* ── Program row ── */}
                <div
                  className={cn(
                    'flex items-center gap-1 py-1.5 px-1 rounded-md hover:bg-muted/50 transition-colors',
                    isProgramDisabled && 'opacity-60',
                  )}
                >
                  <CollapsibleTrigger className="p-0.5 hover:bg-muted rounded-sm transition-colors">
                    <ChevronRight
                      className={cn(
                        'size-3.5 text-muted-foreground transition-transform duration-200',
                        isProgramOpen && 'rotate-90',
                      )}
                    />
                  </CollapsibleTrigger>

                  <IndeterminateCheckbox
                    checked={pState.allChecked}
                    indeterminate={pState.indeterminate}
                    onCheckedChange={(checked) =>
                      onBatchSetChecked(program.selectableEventIds, checked)
                    }
                    disabled={isProgramDisabled}
                  />

                  <span
                    className={cn(
                      'text-xs font-semibold flex-1 min-w-0 select-none truncate cursor-pointer',
                      program.missingChannelMap ? 'text-muted-foreground' : 'text-foreground',
                    )}
                    onClick={() => toggleProgramExpanded(program.programId)}
                  >
                    {program.missingChannelMap && (
                      <AlertCircle
                        className="mr-1 inline size-3 text-destructive"
                        aria-label="Channel map required"
                      />
                    )}
                    {program.programId}
                  </span>

                  {showColorSwatches && onProgramColorReset && (
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onProgramColorReset(program.programId);
                        }}
                        className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
                        title="Reset program and all version colors to defaults"
                        aria-label={`Reset all version colors for program ${program.programId}`}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                </div>

                {/* ── Nested versions ── */}
                <CollapsibleContent>
                  <div className="ml-5 border-l-2 border-border/40 pl-3 space-y-0 py-0.5">
                    {program.versions.map((vg) => {
                      const vKey = `${program.programId}::${vg.version}`;
                      const isVersionOpen = expandedVersions.has(vKey);
                      const vState = getGroupState(vg.selectableEventIds);
                      const isVersionDisabled = vg.selectableEventIds.length === 0;

                      return (
                        <Collapsible
                          key={vKey}
                          open={isVersionOpen}
                          onOpenChange={() => toggleVersionExpanded(vKey)}
                        >
                          {/* Version row */}
                          <div
                            className={cn(
                              'flex items-center gap-1 py-1 px-1 rounded-md hover:bg-muted/50 transition-colors',
                              isVersionDisabled && 'opacity-60',
                            )}
                          >
                            <CollapsibleTrigger className="p-0.5 hover:bg-muted rounded-sm transition-colors">
                              <ChevronRight
                                className={cn(
                                  'size-3 text-muted-foreground transition-transform duration-200',
                                  isVersionOpen && 'rotate-90',
                                )}
                              />
                            </CollapsibleTrigger>

                            <IndeterminateCheckbox
                              checked={vState.allChecked}
                              indeterminate={vState.indeterminate}
                              onCheckedChange={(checked) =>
                                onBatchSetChecked(vg.selectableEventIds, checked)
                              }
                              disabled={isVersionDisabled}
                            />

                            <div className="flex-1 min-w-0 flex items-center gap-1">
                              <span
                                className={cn(
                                  'text-xs font-medium min-w-0 select-none truncate cursor-pointer',
                                  isVersionDisabled ? 'text-muted-foreground' : 'text-foreground',
                                )}
                                onClick={() => toggleVersionExpanded(vKey)}
                              >
                                {vg.missingChannelMap && (
                                  <AlertCircle
                                    className="mr-1 inline size-3 text-destructive"
                                    aria-label="Channel map required"
                                  />
                                )}
                                {vg.version}
                              </span>

                              {(() => {
                                const status = vg.events[0]?.status;
                                if (status === 'Pending') {
                                  return (
                                    <AlertCircle
                                      className="size-3 text-muted-foreground shrink-0"
                                      aria-label="Pending"
                                    >
                                      <title>Pending</title>
                                    </AlertCircle>
                                  );
                                }
                                if (status === 'Obsolete') {
                                  return (
                                    <History
                                      className="size-3 text-muted-foreground shrink-0"
                                      aria-label="Obsolete"
                                    >
                                      <title>Obsolete</title>
                                    </History>
                                  );
                                }
                                return null;
                              })()}
                            </div>

                            {showColorSwatches && getVersionColor && onVersionColorChange && (
                              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                <ColorPicker
                                  value={getVersionColor(program.programId, vg.version)}
                                  onChange={(color) =>
                                    onVersionColorChange(program.programId, vg.version, color)
                                  }
                                  className="h-3.5 w-3.5"
                                />
                              </div>
                            )}

                          </div>

                          {/* Event leaves */}
                          <CollapsibleContent>
                            <div className="ml-5 border-l-2 border-border/40 pl-3 space-y-0 py-0.5">
                              {vg.events
                                .filter(
                                  (event) =>
                                    !event.event_id.startsWith(PENDING_CHANNEL_MAP_EVENT_PREFIX),
                                )
                                .map((event) => {
                                const pinned = isPinned?.(event.event_id) ?? false;
                                const disabled = event.selectable_for_plotting === false;
                                const fullEventName = getEventDisplayName(event.event_id);
                                const displayEventName = truncateLabel(
                                  fullEventName,
                                  MAX_EVENT_LABEL_CHARS,
                                );

                                return (
                                  <div
                                    key={event.event_id}
                                    className={cn(
                                      'flex items-center gap-2 py-1 px-1.5 rounded-md hover:bg-muted/50 transition-colors group',
                                      disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                                    )}
                                  >
                                    <IndeterminateCheckbox
                                      checked={isChecked(event.event_id)}
                                      indeterminate={false}
                                      onCheckedChange={() =>
                                        onToggleEvent(event.event_id)
                                      }
                                      disabled={disabled}
                                    />
                                    <span
                                      className={cn(
                                        'text-xs truncate flex-1 min-w-0 select-none',
                                        pinned ? 'font-semibold text-foreground' : 'text-muted-foreground',
                                      )}
                                      title={fullEventName}
                                    >
                                      {displayEventName}
                                    </span>
                                    {showStatusBadge && (
                                      <span
                                        className={cn(
                                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0',
                                          getStatusBadgeClassName(event.status),
                                        )}
                                      >
                                        {event.status}
                                      </span>
                                    )}
                                    {pinned && onUnpinEvent && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onUnpinEvent(event.event_id)}
                                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                        aria-label={`Unpin ${fullEventName}`}
                                        title="Unpin event"
                                      >
                                        <X className="size-3" />
                                      </Button>
                                    )}
                                  </div>
                                );
                                })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
