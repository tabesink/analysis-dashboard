/**
 * Unified filter state management
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useSession } from './use-session';
import type { DataState, GlobalFilters } from '@/types/api';
import { hasUnrenderedSelection } from '@/lib/session/session-sync';

const DEFAULT_DATA_STATE: DataState = {
  program_ids: [],
  versions: [],
  selected_event_ids: [],
};

export function useFilterState() {
  const { session, updateSession, isLoading, sessionId } = useSession();

  const dataState = useMemo<DataState>(
    () => session?.data_state ?? DEFAULT_DATA_STATE,
    [session?.data_state]
  );

  const globalFilters = useMemo<GlobalFilters>(
    () => session?.global_filters ?? {},
    [session?.global_filters]
  );

  const updateDataState = useCallback(
    (updates: Partial<DataState>) => {
      const current = session?.data_state ?? DEFAULT_DATA_STATE;
      const newState = { ...current, ...updates };
      updateSession({ data_state: newState });
    },
    [session?.data_state, updateSession]
  );

  const setDataState = useCallback(
    (state: DataState) => {
      updateSession({ data_state: state });
    },
    [updateSession]
  );

  const setGlobalFilters = useCallback(
    (filters: GlobalFilters) => {
      updateSession({ global_filters: filters });
    },
    [updateSession]
  );

  const allSelectedEventIds = useMemo(
    () => dataState.selected_event_ids,
    [dataState.selected_event_ids]
  );

  const renderedEventIds = useMemo<string[]>(
    () => session?.rendered_event_ids ?? [],
    [session?.rendered_event_ids]
  );

  const hasUnrenderedChanges = useMemo(() => {
    return hasUnrenderedSelection(allSelectedEventIds, renderedEventIds);
  }, [allSelectedEventIds, renderedEventIds]);

  const setRenderedEventIds = useCallback(
    (eventIds: string[]) => {
      updateSession({ rendered_event_ids: eventIds });
    },
    [updateSession]
  );

  const clearRenderedEventIds = useCallback(() => {
    updateSession({ rendered_event_ids: [] });
  }, [updateSession]);

  return {
    isSessionLoading: isLoading,
    isSessionReady: Boolean(session) && !isLoading,

    dataState,
    globalFilters,
    allSelectedEventIds,
    renderedEventIds,
    hasUnrenderedChanges,

    updateDataState,
    setDataState,
    setGlobalFilters,

    setRenderedEventIds,
    clearRenderedEventIds,
  };
}
