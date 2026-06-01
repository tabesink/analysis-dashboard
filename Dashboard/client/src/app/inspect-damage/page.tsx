'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  Activity,
  ArrowDownIcon,
  ArrowUpIcon,
  Columns,
  Database,
  FilterIcon,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner, SidePanelLayout, SidePanelSection } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { GlobalFilters } from '@/components/dashboard/side-panel/GlobalFilters';
import { HierarchicalEventTree } from '@/components/dashboard/shared/HierarchicalEventTree';
import { DamageEventTree } from '@/components/damage/DamageEventTree';
import { ColumnResizeHandle } from '@/components/upload/ColumnResizeHandle';
import { useEventCatalog } from '@/hooks/use-event-catalog';
import { useFilterState } from '@/hooks/use-filter-state';
import { useInspectDamageState } from '@/hooks/use-inspect-damage-state';
import { useInspectDamageSelectedEvents } from '@/hooks/use-inspect-damage-selected-events';
import { useEventTreeColorProps } from '@/hooks/use-event-tree-color-props';
import { useDashboardWorkspace } from '@/modules/dashboard-workspace';
import { useAuthStore } from '@/stores/auth-store';
import {
  buildDamageResultCacheKey,
  useInspectDamageResultsStore,
} from '@/stores/inspect-damage-results-store';
import { DamagePlotSidePanel } from '@/features/inspect-damage-3d/components/DamagePlotSidePanel';
import { buildInspectDamagePlotRows } from '@/features/inspect-damage-3d/lib/build-inspect-damage-plot-rows';
import { damageApi } from '@/lib/api';
import {
  getDefaultColumnFilters,
  mergeTreeExpansionWithTreeKeys,
  resolvePersistedExpansion,
  tablePreferencesUiEqual,
  treeKeysFromEvents,
  type SortDirection,
} from '@/lib/inspect-damage-table-preferences';
import type { DamageInspectResponse, EventMetadata } from '@/types/api';
import { formatDamage } from '../../lib/inspect-damage-format';

const CHAR_PX = 7.2;
const PADDING_PX = 32;
const MIN_COLUMN_PX = 80;
const MAX_COLUMN_PX = 400;
const CHANNEL_COL_WIDTH = 56;
const PROGRAM_ID_DEFAULT_PX = 250;
const PROGRAM_ID_KEY = 'programId';

const METADATA_COLUMNS = [
  { key: 'work_order', label: 'Work Order' },
  { key: 'job_number', label: 'Program ID' },
] as const;

type ColumnDefinition = {
  key: string;
  label: string;
};

type SortField = string;

const widthForValues = (label: string, values: string[]): number => {
  const longest = values.reduce(
    (max, value) => Math.max(max, value.length),
    label.length,
  );
  return Math.min(
    MAX_COLUMN_PX,
    Math.max(MIN_COLUMN_PX, Math.ceil(longest * CHAR_PX) + PADDING_PX),
  );
};

function getColumnValue(event: EventMetadata, columnKey: string): string {
  if (columnKey === 'work_order') return event.work_order ?? '';
  if (columnKey === 'job_number') return event.job_number ?? '';
  return '';
}

export default function InspectDamagePage() {
  const router = useRouter();
  const authStatus = useAuthStore((s) => s.status);
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const cachedDamageResults = useInspectDamageResultsStore((s) => s.cachedResults);
  const setCachedDamageResult = useInspectDamageResultsStore((s) => s.setCachedResult);
  const clearCachedDamageResults = useInspectDamageResultsStore((s) => s.clearCachedResults);
  const { dataState, updateDataState, isSessionReady } = useFilterState();
  const { events, isLoading: isEventsLoading } = useEventCatalog();
  useDashboardWorkspace();
  const selectedEventIds = dataState.selected_event_ids;
  const { selectedEvents } = useInspectDamageSelectedEvents(
    selectedEventIds,
    events,
  );
  const colorProps = useEventTreeColorProps();
  const isPanelReady = isSessionReady && !isEventsLoading;
  const expandSidePanel = useCallback(() => setSidePanelCollapsed(false), []);

  const selectedSet = useMemo(() => new Set(selectedEventIds), [selectedEventIds]);
  const damageCacheKey = useMemo(
    () => buildDamageResultCacheKey(selectedEventIds),
    [selectedEventIds],
  );
  const damageResponse = cachedDamageResults.get(damageCacheKey) ?? null;
  const damageRowsByEventId = useMemo(() => {
    const map = new Map<string, DamageInspectResponse['rows'][number]>();
    for (const row of damageResponse?.rows ?? []) {
      map.set(row.event_id, row);
    }
    return map;
  }, [damageResponse]);
  const damagePlotRows = useMemo(
    () => buildInspectDamagePlotRows({ selectedEvents, damageRowsByEventId }),
    [damageRowsByEventId, selectedEvents],
  );
  const channelMetadata = useMemo(() => {
    const map = new Map<string, DamageInspectResponse['channels'][number]>();
    for (const channel of damageResponse?.channels ?? []) {
      map.set(channel.channel_key, channel);
    }
    return map;
  }, [damageResponse]);

  const inspectMutation = useMutation({
    mutationFn: ({ eventIds }: { eventIds: string[]; damageCacheKey: string }) =>
      damageApi.inspect(eventIds),
    onSuccess: (response, variables) => {
      clearCachedDamageResults();
      setCachedDamageResult(variables.damageCacheKey, response);
      if (response.channels.length === 0) {
        toast.info('No damage channels found for the selected events');
        return;
      }
      toast.success(`Calculated damage for ${response.channels.length} channel${response.channels.length === 1 ? '' : 's'}`);
    },
  });
  const hasNoDamageChannels =
    damageResponse !== null &&
    selectedEventIds.length > 0 &&
    damageResponse.channels.length === 0;

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/login');
    }
  }, [authStatus, router]);

  const isEventChecked = useCallback(
    (eventId: string) => selectedSet.has(eventId),
    [selectedSet],
  );

  const setSelectedEventIds = useCallback(
    (next: string[] | ((current: string[]) => string[])) => {
      const resolved = typeof next === 'function' ? next(selectedEventIds) : next;
      updateDataState({ selected_event_ids: resolved });
    },
    [selectedEventIds, updateDataState],
  );

  const handleToggleEvent = useCallback(
    (eventId: string) => {
      const event = events.find((item) => item.event_id === eventId);
      if (event?.selectable_for_plotting === false) return;
      setSelectedEventIds((current) =>
        current.includes(eventId)
          ? current.filter((id) => id !== eventId)
          : [...current, eventId],
      );
    },
    [events, setSelectedEventIds],
  );

  const handleBatchToggle = useCallback(
    (eventIds: string[], checked: boolean) => {
      const selectableIds = eventIds.filter((id) => {
        const event = events.find((item) => item.event_id === id);
        return event?.selectable_for_plotting !== false;
      });
      const selectableSet = new Set(selectableIds);
      setSelectedEventIds((current) =>
        checked
          ? [...new Set([...current, ...selectableIds])]
          : current.filter((id) => !selectableSet.has(id)),
      );
    },
    [events, setSelectedEventIds],
  );

  const handleSelectAll = useCallback(() => {
    setSelectedEventIds(
      events
        .filter((event) => event.selectable_for_plotting !== false)
        .map((event) => event.event_id),
    );
  }, [events, setSelectedEventIds]);

  const handleSelectNone = useCallback(() => {
    updateDataState({ selected_event_ids: [], program_ids: [], versions: [] });
  }, [updateDataState]);

  const handleCalculate = useCallback(() => {
    inspectMutation.mutate({ eventIds: selectedEventIds, damageCacheKey });
  }, [damageCacheKey, inspectMutation, selectedEventIds]);

  if (authStatus === 'loading' || authStatus === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 min-h-[calc(100vh-3.5rem)]">
      <div className="flex gap-0 h-[calc(100vh-7rem)]">
        <SidePanelLayout
          isCollapsed={sidePanelCollapsed}
          onToggleCollapse={() => setSidePanelCollapsed((prev) => !prev)}
          expandedWidth="w-[320px]"
        >
          <div className="flex-1 min-h-0 flex flex-col w-full">
            <ScrollArea className="flex-1 min-h-0 w-full">
              <div className="p-5 space-y-5">
                {!isPanelReady ? (
                  <div className="space-y-4">
                    <Skeleton className="h-5 w-32 rounded" />
                    <Skeleton className="h-24 w-full rounded-lg" />
                  </div>
                ) : (
                  <>
                    <GlobalFilters
                      isCollapsed={sidePanelCollapsed}
                      onExpand={expandSidePanel}
                    />
                    <div className="py-1">
                      <Separator className="bg-border/70" />
                    </div>
                    <DamageLoadDataPanel
                      isCollapsed={sidePanelCollapsed}
                      onExpand={expandSidePanel}
                      events={events}
                      selectedCount={selectedEventIds.length}
                      isCalculating={inspectMutation.isPending}
                      calculateError={inspectMutation.error}
                      calculateDisabled={
                        selectedEventIds.length === 0 ||
                        inspectMutation.isPending
                      }
                      onCalculate={handleCalculate}
                      isEventChecked={isEventChecked}
                      onToggleEvent={handleToggleEvent}
                      onBatchSetChecked={handleBatchToggle}
                      onSelectAll={handleSelectAll}
                      onSelectNone={handleSelectNone}
                      colorProps={colorProps}
                    />
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </SidePanelLayout>

        <div className="flex-1 min-w-0 min-h-0">
          <Card className="h-full rounded-none flex flex-col gap-0 overflow-hidden shadow-subtle border-y border-l py-0">
            <DamageTable
              events={selectedEvents}
              damageRowsByEventId={damageRowsByEventId}
              channelMetadata={channelMetadata}
              isCalculating={inspectMutation.isPending}
              hasNoDamageChannels={hasNoDamageChannels}
            />
          </Card>
        </div>
        <DamagePlotSidePanel rows={damagePlotRows} />
      </div>
    </div>
  );
}

function DamageLoadDataPanel({
  isCollapsed = false,
  onExpand,
  events,
  selectedCount,
  isCalculating,
  calculateDisabled,
  calculateError,
  onCalculate,
  isEventChecked,
  onToggleEvent,
  onBatchSetChecked,
  onSelectAll,
  onSelectNone,
  colorProps,
}: {
  isCollapsed?: boolean;
  onExpand?: () => void;
  events: EventMetadata[];
  selectedCount: number;
  isCalculating: boolean;
  calculateDisabled: boolean;
  calculateError: Error | null;
  onCalculate: () => void;
  isEventChecked: (eventId: string) => boolean;
  onToggleEvent: (eventId: string) => void;
  onBatchSetChecked: (eventIds: string[], checked: boolean) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  colorProps: Partial<ComponentProps<typeof HierarchicalEventTree>>;
}) {
  const subtitle =
    selectedCount > 0
      ? `${selectedCount} selected`
      : 'Select events for analysis';
  const errorMessage = calculateError instanceof Error ? calculateError.message : null;

  if (isCollapsed) {
    return (
      <Button
        variant="ghost"
        onClick={onExpand}
        className="p-2 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-accent"
        aria-label="Expand Load Data section"
        title="Load Data"
      >
        <Database className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <SidePanelSection
      title="Load Data"
      subtitle={subtitle}
      defaultExpanded={true}
      contentClassName="overflow-x-auto"
    >
      <HierarchicalEventTree
        events={events}
        isChecked={isEventChecked}
        onToggleEvent={onToggleEvent}
        onBatchSetChecked={onBatchSetChecked}
        onSelectAll={onSelectAll}
        onSelectNone={onSelectNone}
        emptyMessage="No events available"
        showExpandCollapseControls={false}
        defaultExpandPrograms={true}
        {...colorProps}
      />
      <div className="mt-5 border-t border-border/70 pt-4 space-y-2">
        <div className="flex justify-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            disabled={calculateDisabled}
            onClick={onCalculate}
            className="h-8 px-6 text-xs font-medium"
          >
            {isCalculating ? 'Calculating...' : 'Calculate'}
          </Button>
        </div>
        {errorMessage ? (
          <p className="text-xs text-destructive text-center">{errorMessage}</p>
        ) : null}
      </div>
    </SidePanelSection>
  );
}

function DamageTable({
  events,
  damageRowsByEventId,
  channelMetadata,
  isCalculating,
  hasNoDamageChannels,
}: {
  events: EventMetadata[];
  damageRowsByEventId: Map<string, DamageInspectResponse['rows'][number]>;
  channelMetadata: Map<string, DamageInspectResponse['channels'][number]>;
  isCalculating: boolean;
  hasNoDamageChannels: boolean;
}) {
  const channelColumnDefinitions = useMemo<ColumnDefinition[]>(
    () =>
      Array.from(channelMetadata.values()).map((channel) => ({
        key: channel.channel_key,
        label: channel.channel_name || channel.channel_key,
      })),
    [channelMetadata],
  );
  const channelKeys = useMemo(
    () => new Set(channelColumnDefinitions.map((col) => col.key)),
    [channelColumnDefinitions],
  );
  const columnDefinitions = useMemo<ColumnDefinition[]>(
    () => [...METADATA_COLUMNS, ...channelColumnDefinitions],
    [channelColumnDefinitions],
  );
  const {
    isSessionReady,
    tablePreferencesUi,
    setTablePreferences,
    resetTablePreferences: resetSessionTablePreferences,
  } = useInspectDamageState();
  const sessionTablePreferences = tablePreferencesUi;
  const preferencesLoaded = isSessionReady;
  const [sortField, setSortField] = useState<SortField>('job_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(
    getDefaultColumnFilters,
  );
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const col of columnDefinitions) {
      next[col.key] = true;
    }
    return next;
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const expansionInitializedRef = useRef(false);
  const expansionTreeHydratedRef = useRef(false);
  const expandedProgramsRef = useRef(expandedPrograms);
  const expandedVersionsRef = useRef(expandedVersions);

  useEffect(() => {
    expandedProgramsRef.current = expandedPrograms;
    expandedVersionsRef.current = expandedVersions;
  }, [expandedPrograms, expandedVersions]);

  const defaultColumnWidths = useMemo(() => {
    const next: Record<string, number> = {
      [PROGRAM_ID_KEY]: PROGRAM_ID_DEFAULT_PX,
    };
    for (const col of METADATA_COLUMNS) {
      const values = events
        .map((event) => getColumnValue(event, col.key))
        .filter((value) => value !== '');
      next[col.key] = widthForValues(col.label, values);
    }
    for (const col of channelColumnDefinitions) {
      next[col.key] = Math.max(CHANNEL_COL_WIDTH, widthForValues(col.label, []));
    }
    return next;
  }, [channelColumnDefinitions, events]);

  const treeKeySignature = useMemo(() => {
    const { programIds, versionKeys } = treeKeysFromEvents(events);
    return JSON.stringify({ programIds, versionKeys });
  }, [events]);

  useEffect(() => {
    if (!preferencesLoaded || preferencesHydrated) return;
    if (!sessionTablePreferences) return;
    setSortField(sessionTablePreferences.sortField);
    setSortDirection(sessionTablePreferences.sortDirection);
    setColumnFilters(sessionTablePreferences.columnFilters);
  }, [preferencesHydrated, preferencesLoaded, sessionTablePreferences]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    const { programIds, versionKeys } = JSON.parse(treeKeySignature) as {
      programIds: string[];
      versionKeys: string[];
    };
    if (programIds.length === 0) return;

    const stored = expansionInitializedRef.current
      ? {
          expandedPrograms: [...expandedProgramsRef.current],
          expandedVersions: [...expandedVersionsRef.current],
        }
      : {
          expandedPrograms: sessionTablePreferences?.expandedPrograms ?? [],
          expandedVersions: sessionTablePreferences?.expandedVersions ?? [],
        };

    const merged = mergeTreeExpansionWithTreeKeys(stored, programIds, versionKeys);
    const nextPrograms = new Set(merged.expandedPrograms);
    const nextVersions = new Set(merged.expandedVersions);

    setExpandedPrograms((prev) => {
      if (prev.size === nextPrograms.size && [...prev].every((id) => nextPrograms.has(id))) {
        return prev;
      }
      return nextPrograms;
    });
    setExpandedVersions((prev) => {
      if (prev.size === nextVersions.size && [...prev].every((key) => nextVersions.has(key))) {
        return prev;
      }
      return nextVersions;
    });
    expansionInitializedRef.current = true;
    expansionTreeHydratedRef.current = true;
  }, [preferencesLoaded, sessionTablePreferences, treeKeySignature]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    let didHydrateInThisRun = false;

    setVisibleColumns((prev) => {
      const next: Record<string, boolean> = {};
      for (const col of columnDefinitions) {
        if (preferencesHydrated && col.key in prev) {
          next[col.key] = prev[col.key];
          continue;
        }
        if (sessionTablePreferences?.visibleColumns[col.key] !== undefined) {
          next[col.key] = sessionTablePreferences.visibleColumns[col.key];
          continue;
        }
        next[col.key] = true;
      }
      if (!preferencesHydrated && preferencesLoaded) {
        didHydrateInThisRun = true;
      }
      const nextEntries = Object.entries(next);
      if (
        nextEntries.length === Object.keys(prev).length &&
        nextEntries.every(([key, value]) => prev[key] === value)
      ) {
        return prev;
      }
      return next;
    });

    if (didHydrateInThisRun) {
      setPreferencesHydrated(true);
    }
  }, [columnDefinitions, preferencesHydrated, preferencesLoaded, sessionTablePreferences]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    setColumnWidths((prev) => {
      const next: Record<string, number> = {};
      next[PROGRAM_ID_KEY] =
        (preferencesHydrated ? prev[PROGRAM_ID_KEY] : undefined) ??
        sessionTablePreferences?.columnWidths[PROGRAM_ID_KEY] ??
        defaultColumnWidths[PROGRAM_ID_KEY];
      for (const col of columnDefinitions) {
        const existing = preferencesHydrated ? prev[col.key] : undefined;
        const stored = sessionTablePreferences?.columnWidths[col.key];
        const fallback = defaultColumnWidths[col.key] ?? MIN_COLUMN_PX;
        next[col.key] = existing ?? stored ?? fallback;
      }
      const nextEntries = Object.entries(next);
      if (
        nextEntries.length === Object.keys(prev).length &&
        nextEntries.every(([key, value]) => prev[key] === value)
      ) {
        return prev;
      }
      return next;
    });
  }, [
    columnDefinitions,
    defaultColumnWidths,
    preferencesHydrated,
    preferencesLoaded,
    sessionTablePreferences,
  ]);

  useEffect(() => {
    if (!preferencesHydrated) return;
    const persistedExpansion = resolvePersistedExpansion(
      expansionTreeHydratedRef.current,
      {
        expandedPrograms: [...expandedPrograms],
        expandedVersions: [...expandedVersions],
      },
      sessionTablePreferences ?? undefined,
    );
    const nextPayload = {
      visibleColumns,
      columnWidths,
      expandedPrograms: persistedExpansion.expandedPrograms,
      expandedVersions: persistedExpansion.expandedVersions,
      sortField,
      sortDirection,
      columnFilters,
    };
    if (tablePreferencesUiEqual(tablePreferencesUi, nextPayload)) return;
    setTablePreferences(nextPayload);
  }, [
    columnFilters,
    columnWidths,
    expandedPrograms,
    expandedVersions,
    preferencesHydrated,
    setTablePreferences,
    sessionTablePreferences,
    sortDirection,
    sortField,
    tablePreferencesUi,
    visibleColumns,
  ]);

  const setColumnWidth = useCallback((key: string, next: number) => {
    setColumnWidths((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField],
  );

  const handleColumnFilterChange = useCallback(
    (column: string, value: string, checked: boolean) => {
      setColumnFilters((prev) => {
        const currentFilters = prev[column] || [];
        if (checked) {
          return { ...prev, [column]: [...currentFilters, value] };
        }
        return { ...prev, [column]: currentFilters.filter((item) => item !== value) };
      });
    },
    [],
  );

  const handleColumnVisibilityToggle = useCallback((columnKey: string, checked: boolean) => {
    const currentVisibleCount = Object.values(visibleColumns).filter(Boolean).length;
    if (!checked && currentVisibleCount <= 1) {
      toast.error('At least one column must be visible');
      return;
    }
    setVisibleColumns((prev) => ({ ...prev, [columnKey]: checked }));
  }, [visibleColumns]);

  const resetTablePreferences = useCallback(() => {
    resetSessionTablePreferences();
    const nextVisible: Record<string, boolean> = {};
    for (const col of columnDefinitions) {
      nextVisible[col.key] = true;
    }
    setVisibleColumns(nextVisible);
    setColumnWidths({
      ...defaultColumnWidths,
      [PROGRAM_ID_KEY]: PROGRAM_ID_DEFAULT_PX,
    });
    setSortField('job_number');
    setSortDirection('asc');
    setColumnFilters(getDefaultColumnFilters());
    const { programIds, versionKeys } = treeKeysFromEvents(events);
    const merged = mergeTreeExpansionWithTreeKeys(
      { expandedPrograms: [], expandedVersions: [] },
      programIds,
      versionKeys,
    );
    setExpandedPrograms(new Set(merged.expandedPrograms));
    setExpandedVersions(new Set(merged.expandedVersions));
    expansionInitializedRef.current = programIds.length > 0;
    expansionTreeHydratedRef.current = programIds.length > 0;
    setPreferencesHydrated(true);
  }, [columnDefinitions, defaultColumnWidths, events, resetSessionTablePreferences]);

  const toggleProgramExpanded = useCallback((programId: string) => {
    setExpandedPrograms((prev) => {
      const next = new Set(prev);
      if (next.has(programId)) {
        next.delete(programId);
      } else {
        next.add(programId);
      }
      return next;
    });
  }, []);

  const toggleVersionExpanded = useCallback((versionKey: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionKey)) {
        next.delete(versionKey);
      } else {
        next.add(versionKey);
      }
      return next;
    });
  }, []);

  const getUniqueValues = useMemo(() => {
    const uniqueValues: Record<string, string[]> = {};
    for (const col of METADATA_COLUMNS) {
      const values = new Set<string>();
      events.forEach((event) => {
        const value = getColumnValue(event, col.key);
        if (value) values.add(value);
      });
      uniqueValues[col.key] = Array.from(values).sort();
    }
    return uniqueValues;
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      for (const [column, selectedValues] of Object.entries(columnFilters)) {
        if (selectedValues.length === 0) continue;
        const eventValue = getColumnValue(event, column);
        if (!selectedValues.includes(eventValue)) return false;
      }
      return true;
    });
  }, [columnFilters, events]);

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const valueA = getColumnValue(a, sortField);
      const valueB = getColumnValue(b, sortField);
      const sortMultiplier = sortDirection === 'asc' ? 1 : -1;
      return sortMultiplier * valueA.localeCompare(valueB);
    });
  }, [filteredEvents, sortDirection, sortField]);

  const visibleColumnDefs = useMemo(
    () => columnDefinitions.filter((col) => visibleColumns[col.key]),
    [columnDefinitions, visibleColumns],
  );

  const visibleMetadataColumns = useMemo(
    () => visibleColumnDefs.filter((col) =>
      METADATA_COLUMNS.some((meta) => meta.key === col.key),
    ),
    [visibleColumnDefs],
  );

  const visibleChannelColumns = useMemo(
    () => visibleColumnDefs.filter((col) => channelKeys.has(col.key)),
    [channelKeys, visibleColumnDefs],
  );

  const programIdWidth = columnWidths[PROGRAM_ID_KEY] ?? PROGRAM_ID_DEFAULT_PX;

  const totalRowWidth = useMemo(() => {
    const metadataAndChannelWidth = visibleColumnDefs.reduce(
      (sum, col) => sum + (columnWidths[col.key] ?? MIN_COLUMN_PX),
      0,
    );
    return programIdWidth + metadataAndChannelWidth;
  }, [columnWidths, programIdWidth, visibleColumnDefs]);

  const renderFilterableColumnHeader = useCallback(
    (label: string, field: SortField, width: number) => (
      <div
        key={field}
        className="relative shrink-0 px-2"
        style={{ width }}
      >
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => handleSort(field)}
            className="flex items-center justify-center gap-1 hover:text-foreground transition-colors text-center min-w-0"
          >
            <span className="truncate">{label}</span>
            {sortField === field && (
              <span className="text-primary shrink-0">
                {sortDirection === 'asc' ? (
                  <ArrowUpIcon size={10} />
                ) : (
                  <ArrowDownIcon size={10} />
                )}
              </span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`shrink-0 p-1 rounded hover:bg-accent transition-colors ${
                  columnFilters[field]?.length > 0
                    ? 'text-primary'
                    : 'text-muted-foreground/50 hover:text-muted-foreground'
                }`}
                onClick={(event) => event.stopPropagation()}
              >
                <FilterIcon size={10} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 max-h-[280px] overflow-y-auto rounded-lg shadow-lg"
            >
              {getUniqueValues[field]?.length > 0 ? (
                getUniqueValues[field].map((value) => (
                  <DropdownMenuCheckboxItem
                    key={value}
                    checked={columnFilters[field]?.includes(value) || false}
                    onCheckedChange={(checked: boolean) =>
                      handleColumnFilterChange(field, value, checked)
                    }
                    className="text-xs"
                  >
                    {value}
                  </DropdownMenuCheckboxItem>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No values
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ColumnResizeHandle
          width={width}
          onResize={(next) => setColumnWidth(field, next)}
        />
      </div>
    ),
    [
      columnFilters,
      getUniqueValues,
      handleColumnFilterChange,
      handleSort,
      setColumnWidth,
      sortDirection,
      sortField,
    ],
  );

  return (
    <>
      <div className="shrink-0 flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">Inspect Damage</p>
          {isCalculating && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Calculating...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                aria-label="Column visibility"
                className="min-w-23 justify-center"
              >
                <Columns className="size-4" />
                Cols
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              <div className="space-y-3">
                <div className="text-xs font-semibold">Column Visibility</div>
                <div className="space-y-2 bg-muted/70 rounded-md p-2 max-h-[280px] overflow-y-auto">
                  {columnDefinitions.map((col) => (
                    <div key={col.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`damage-col-${col.key}`}
                        checked={visibleColumns[col.key]}
                        onCheckedChange={(checked) =>
                          handleColumnVisibilityToggle(col.key, checked as boolean)
                        }
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <label
                        htmlFor={`damage-col-${col.key}`}
                        className="text-xs cursor-pointer flex-1"
                      >
                        {col.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  {Object.values(visibleColumns).filter(Boolean).length} columns visible
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetTablePreferences}
                  className="h-7 w-full justify-start px-2 text-xs"
                >
                  Reset table preferences
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <CardContent className="flex-1 min-h-0 overflow-auto p-0">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">
              No events selected
            </h3>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              Select load data from the side panel, then click Calculate to inspect damage.
            </p>
          </div>
        ) : (
          <div style={{ minWidth: totalRowWidth }}>
            {hasNoDamageChannels ? (
              <div className="m-3 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">No damage channels found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Calculate completed, but the selected events do not have backfilled damage-channel
                  rows yet. Run the raw-folder backfill write mode, then calculate again.
                </p>
              </div>
            ) : null}
            <div className="sticky top-0 z-10 flex items-center py-2 px-3 border-b bg-card text-xs font-semibold text-foreground/70">
              <div
                className="relative flex items-center gap-2 shrink-0 pl-1"
                style={{ width: programIdWidth }}
              >
                <span>Job ID</span>
                <ColumnResizeHandle
                  width={programIdWidth}
                  onResize={(next) => setColumnWidth(PROGRAM_ID_KEY, next)}
                />
              </div>
              <div className="flex items-center">
                {visibleMetadataColumns.map((col) =>
                  renderFilterableColumnHeader(
                    col.label,
                    col.key,
                    columnWidths[col.key] ?? MIN_COLUMN_PX,
                  ),
                )}
                {visibleChannelColumns.map((col) => {
                  const metadata = channelMetadata.get(col.key);
                  const title = metadata
                    ? `${metadata.channel_name}${metadata.unit ? ` (${metadata.unit})` : ''}`
                    : col.label;
                  const width = columnWidths[col.key] ?? CHANNEL_COL_WIDTH;
                  return (
                    <div
                      key={col.key}
                      title={title}
                      className="relative shrink-0 px-2 text-center"
                      style={{ width }}
                    >
                      {col.label}
                    </div>
                  );
                })}
              </div>
            </div>
            <DamageEventTree
              events={sortedEvents}
              columnDefinitions={visibleMetadataColumns}
              channelKeys={visibleChannelColumns.map((col) => col.key)}
              columnWidths={columnWidths}
              programIdWidth={programIdWidth}
              expandedPrograms={expandedPrograms}
              expandedVersions={expandedVersions}
              onToggleProgramExpanded={toggleProgramExpanded}
              onToggleVersionExpanded={toggleVersionExpanded}
              getColumnValue={getColumnValue}
              renderChannelCell={(eventId, channelKey) => {
                const row = damageRowsByEventId.get(eventId);
                const cell = row?.damages[channelKey];
                const value = cell?.status === 'ok' ? formatDamage(cell.damage) : '';
                if (isCalculating && !cell) return '...';
                return value;
              }}
            />
          </div>
        )}
      </CardContent>
    </>
  );
}
