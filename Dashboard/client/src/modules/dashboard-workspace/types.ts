import type { DataState, GlobalFilters } from '@/types/api';

export type EventId = string;

export type EventCatalog = {
  isLoaded: boolean;
  eventIds: Iterable<EventId>;
};

export type DashboardWorkspaceInput = {
  catalog: EventCatalog;
  dataState: DataState;
  globalFilters: GlobalFilters;
  renderedEventIds: EventId[];
};

export type DashboardWorkspaceState = {
  selectedEventIds: EventId[];
  renderedEventIds: EventId[];
  globalFilters: GlobalFilters;
  canRender: boolean;
  hasUnrenderedChanges: boolean;
  shouldPersistPrunedSelection: boolean;
};

export type DashboardWorkspaceActions = {
  clearRenderedEventIds: () => void;
};

export type DashboardWorkspace = {
  state: DashboardWorkspaceState;
  actions: DashboardWorkspaceActions;
};
