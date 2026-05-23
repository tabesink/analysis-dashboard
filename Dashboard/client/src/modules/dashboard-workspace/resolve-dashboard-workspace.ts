import type {
  DashboardWorkspaceInput,
  DashboardWorkspaceState,
  EventCatalog,
  EventId,
} from './types';

function pruneSelectedEventIds(
  selectedEventIds: EventId[],
  catalog: EventCatalog,
): EventId[] {
  if (!catalog.isLoaded) {
    // Do not destroy persisted selections while the catalog is temporarily loading.
    return selectedEventIds;
  }

  const allowed = new Set(catalog.eventIds);
  return selectedEventIds.filter((id) => allowed.has(id));
}

function hasUnrenderedSelection(
  selectedEventIds: EventId[],
  renderedEventIds: EventId[],
): boolean {
  if (selectedEventIds.length === 0 && renderedEventIds.length === 0) {
    return false;
  }

  const selectedSet = new Set(selectedEventIds);
  const renderedSet = new Set(renderedEventIds);
  if (selectedSet.size !== renderedSet.size) {
    return true;
  }

  for (const id of selectedSet) {
    if (!renderedSet.has(id)) {
      return true;
    }
  }
  return false;
}

export function resolveDashboardWorkspace(
  input: DashboardWorkspaceInput,
): DashboardWorkspaceState {
  const rawSelectedEventIds = input.dataState.selected_event_ids;
  const selectedEventIds = pruneSelectedEventIds(rawSelectedEventIds, input.catalog);

  return {
    selectedEventIds,
    renderedEventIds: input.renderedEventIds,
    globalFilters: input.globalFilters,
    canRender: selectedEventIds.length > 0,
    hasUnrenderedChanges: hasUnrenderedSelection(
      selectedEventIds,
      input.renderedEventIds,
    ),
    shouldPersistPrunedSelection:
      input.catalog.isLoaded && selectedEventIds.length !== rawSelectedEventIds.length,
  };
}
