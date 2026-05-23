'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api/dashboard';
import type { EventMetadata } from '@/types/api';

export function useInspectDamageSelectedEvents(
  selectedEventIds: string[],
  catalogEvents: EventMetadata[],
) {
  const catalogById = useMemo(
    () => new Map(catalogEvents.map((event) => [event.event_id, event])),
    [catalogEvents],
  );

  const missingIds = useMemo(
    () => selectedEventIds.filter((id) => !catalogById.has(id)),
    [selectedEventIds, catalogById],
  );

  const { data: fetchedEvents = [], isLoading: isResolvingMissing } = useQuery({
    queryKey: ['events-by-ids', missingIds],
    queryFn: async () => {
      const response = await dashboardApi.getEventsByIds(missingIds);
      return response.events;
    },
    enabled: missingIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const selectedEvents = useMemo(() => {
    const byId = new Map<string, EventMetadata>();
    for (const event of catalogEvents) {
      byId.set(event.event_id, event);
    }
    for (const event of fetchedEvents) {
      byId.set(event.event_id, event);
    }
    return selectedEventIds
      .map((id) => byId.get(id))
      .filter((event): event is EventMetadata => Boolean(event));
  }, [selectedEventIds, catalogEvents, fetchedEvents]);

  return {
    selectedEvents,
    missingIds,
    isResolvingMissing,
  };
}
