import type { EventMetadata, DataState } from '@/types/api';

/**
 * Derive a consistent data state from selected event IDs.
 * Keeps parent program/version selections synchronized with event selection.
 */
export function syncDataStateFromSelectedEvents(
  selectedEventIds: string[],
  events: EventMetadata[]
): DataState {
  const selectedSet = new Set(selectedEventIds);
  const normalizedSelectedEventIds: string[] = [];
  const programIds = new Set<string>();
  const versions = new Set<string>();

  for (const event of events) {
    if (!selectedSet.has(event.event_id)) {
      continue;
    }

    normalizedSelectedEventIds.push(event.event_id);
    programIds.add(event.program_id);
    versions.add(event.version);
  }

  return {
    selected_event_ids: normalizedSelectedEventIds,
    program_ids: Array.from(programIds),
    versions: Array.from(versions),
  };
}
