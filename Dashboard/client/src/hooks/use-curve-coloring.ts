'use client';

import { useMemo, useCallback, useEffect } from 'react';
import { useAllEvents } from './use-all-events';
import { useFilterState } from './use-filter-state';
import { useColorSelectionStore } from '@/stores/color-selection-store';

interface UseCurveColoringOptions {
  syncColors?: boolean;
}

const FALLBACK_COLOR = '#000000';

export function useCurveColoring(options: UseCurveColoringOptions = {}) {
  const { syncColors = false } = options;
  const { dataState } = useFilterState();
  const { allEvents } = useAllEvents();

  const eventOverrideColors = useColorSelectionStore((s) => s.eventOverrideColors);
  // Subscribe to the color *data* (not just the getter) so React re-derives
  // `getCurveColor` whenever a swatch is changed in either side panel.
  const programColors = useColorSelectionStore((s) => s.programColors);
  const programVersionColors = useColorSelectionStore((s) => s.programVersionColors);
  const getProgramVersionColor = useColorSelectionStore((s) => s.getProgramVersionColor);
  const syncProgramColors = useColorSelectionStore((s) => s.syncProgramColors);

  const selectedEventIds = dataState.selected_event_ids;

  const selectedEvents = useMemo(() => {
    if (selectedEventIds.length === 0) return [];
    const selectedSet = new Set(selectedEventIds);
    return allEvents.filter((event) => selectedSet.has(event.event_id));
  }, [allEvents, selectedEventIds]);

  const selectedVersions = useMemo(() => {
    const versions = new Set<string>();
    for (const event of selectedEvents) {
      versions.add(event.version);
    }
    return Array.from(versions).sort();
  }, [selectedEvents]);

  const eventVersionMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const event of allEvents) {
      map[event.event_id] = event.version;
    }
    return map;
  }, [allEvents]);

  const eventMetaMap = useMemo(() => {
    const map: Record<string, { programId: string; version: string }> = {};
    for (const event of allEvents) {
      map[event.event_id] = { programId: event.program_id, version: event.version };
    }
    return map;
  }, [allEvents]);

  const versionsByProgramId = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of allEvents) {
      if (!m.has(e.program_id)) {
        m.set(e.program_id, new Set());
      }
      m.get(e.program_id)!.add(e.version);
    }
    const record: Record<string, string[]> = {};
    for (const [programId, set] of m.entries()) {
      record[programId] = Array.from(set).sort((a, b) => a.localeCompare(b));
    }
    return record;
  }, [allEvents]);

  const globalSortedProgramIds = useMemo(() => {
    const ids = new Set<string>();
    allEvents.forEach((e) => ids.add(e.program_id));
    return Array.from(ids).sort();
  }, [allEvents]);

  useEffect(() => {
    if (!syncColors || globalSortedProgramIds.length === 0) return;
    syncProgramColors(globalSortedProgramIds);
  }, [syncColors, globalSortedProgramIds, syncProgramColors]);

  const getCurveColor = useCallback(
    (eventId: string): string => {
      const override = eventOverrideColors[eventId];
      if (override) return override;
      const meta = eventMetaMap[eventId];
      if (!meta) return FALLBACK_COLOR;
      return getProgramVersionColor(
        meta.programId,
        meta.version,
        globalSortedProgramIds,
        versionsByProgramId[meta.programId],
      );
    },
    [
      eventOverrideColors,
      programColors,
      programVersionColors,
      eventMetaMap,
      getProgramVersionColor,
      globalSortedProgramIds,
      versionsByProgramId,
    ]
  );

  return {
    selectedVersions,
    eventVersionMap,
    getCurveColor,
  };
}
