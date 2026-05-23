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

  // Whitelist of selectable events that pass active dimension filters, used by
  // dashboard workspace pruning. Keep non-selectable events visible in the UI,
  // but never keep them in selected_event_ids.
  const dimensionFilteredEventIds = useMemo(
    () =>
      new Set(
        allEvents
          .filter((event) => event.selectable_for_plotting !== false)
          .map((event) => event.event_id),
      ),
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
