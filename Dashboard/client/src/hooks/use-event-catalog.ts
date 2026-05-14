'use client';

import { useMemo } from 'react';
import { useAllEvents } from './use-all-events';
import { useFilterState } from './use-filter-state';
import { useFilterOptions } from './use-filter-options';
import type { GlobalFilters } from '@/types/api';

export function useEventCatalog() {
  const { globalFilters } = useFilterState();
  const { data: filterOptions } = useFilterOptions();

  const allowedFilterFields = useMemo(() => {
    const fields = new Set<string>();
    Object.values(filterOptions ?? {}).forEach((config) => {
      if (config.column !== 'status') {
        fields.add(config.column);
      }
    });
    return fields;
  }, [filterOptions]);

  // Server request includes only dimension filters (program, version, etc.) -- never
  // event_id_query. The Event-ID search is a client-side find tool and must not
  // shrink the dimension-filtered whitelist that drives selection pruning.
  const requestFilters = useMemo<GlobalFilters>(() => {
    const next: GlobalFilters = {};
    Object.entries(globalFilters).forEach(([field, selectedRaw]) => {
      if (field === 'event_id_query') return;
      if (!allowedFilterFields.has(field)) return;
      if (Array.isArray(selectedRaw)) {
        next[field] = selectedRaw;
      }
    });
    return next;
  }, [globalFilters, allowedFilterFields]);

  const { allEvents, isLoading, error, refetch } = useAllEvents(requestFilters);

  // Whitelist of events that pass the active dimension filters, used by
  // useFilterSelectionSync to prune selected_event_ids when filters change.
  const dimensionFilteredEventIds = useMemo(
    () => new Set(allEvents.map((e) => e.event_id)),
    [allEvents],
  );

  const searchQuery = useMemo(
    () => (globalFilters.event_id_query ?? '').toString().trim().toLowerCase(),
    [globalFilters.event_id_query],
  );

  const events = useMemo(
    () =>
      searchQuery
        ? allEvents.filter((e) => e.event_id.toLowerCase().includes(searchQuery))
        : allEvents,
    [allEvents, searchQuery],
  );

  return {
    events,
    allVisibleEvents: events,
    dimensionFilteredEventIds,
    isLoading,
    error,
    refetch,
  };
}
