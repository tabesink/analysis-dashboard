'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useEventCatalog } from '@/hooks/use-event-catalog';
import { useFilterState } from '@/hooks/use-filter-state';
import { resolveDashboardWorkspace } from './resolve-dashboard-workspace';
import type { DashboardWorkspace } from './types';

export function useDashboardWorkspace(): DashboardWorkspace {
  const {
    isSessionReady,
    dataState,
    globalFilters,
    renderedEventIds,
    updateDataState,
    clearRenderedEventIds,
  } = useFilterState();
  const { dimensionFilteredEventIds, isLoading } = useEventCatalog();
  const lastWhitelistRef = useRef<Set<string> | null>(null);

  const state = useMemo(
    () =>
      resolveDashboardWorkspace({
        catalog: {
          isLoaded: !isLoading,
          eventIds: dimensionFilteredEventIds,
        },
        dataState,
        globalFilters,
        renderedEventIds,
      }),
    [dataState, dimensionFilteredEventIds, globalFilters, isLoading, renderedEventIds],
  );

  useEffect(() => {
    if (!isSessionReady || isLoading) return;
    if (lastWhitelistRef.current === dimensionFilteredEventIds) return;
    lastWhitelistRef.current = dimensionFilteredEventIds;

    if (state.shouldPersistPrunedSelection) {
      updateDataState({ selected_event_ids: state.selectedEventIds });
    }
  }, [
    isSessionReady,
    isLoading,
    dimensionFilteredEventIds,
    state.shouldPersistPrunedSelection,
    state.selectedEventIds,
    updateDataState,
  ]);

  return useMemo(
    () => ({
      state,
      actions: {
        clearRenderedEventIds,
      },
    }),
    [clearRenderedEventIds, state],
  );
}
