import { describe, expect, it } from 'vitest';
import { resolveDashboardWorkspace } from './resolve-dashboard-workspace';

describe('resolveDashboardWorkspace', () => {
  it('keeps selected IDs while the catalog is still loading', () => {
    const state = resolveDashboardWorkspace({
      catalog: { isLoaded: false, eventIds: [] },
      dataState: {
        program_ids: [],
        versions: [],
        selected_event_ids: ['event-1'],
      },
      globalFilters: {},
      renderedEventIds: [],
    });

    expect(state.selectedEventIds).toEqual(['event-1']);
    expect(state.canRender).toBe(true);
    expect(state.shouldPersistPrunedSelection).toBe(false);
  });

  it('prunes selected IDs after the catalog is loaded', () => {
    const state = resolveDashboardWorkspace({
      catalog: { isLoaded: true, eventIds: ['event-1'] },
      dataState: {
        program_ids: [],
        versions: [],
        selected_event_ids: ['event-1', 'deleted-event'],
      },
      globalFilters: {},
      renderedEventIds: ['event-1'],
    });

    expect(state.selectedEventIds).toEqual(['event-1']);
    expect(state.renderedEventIds).toEqual(['event-1']);
    expect(state.hasUnrenderedChanges).toBe(false);
    expect(state.shouldPersistPrunedSelection).toBe(true);
  });

  it('prunes the shared selection source for inspect damage consumers', () => {
    const state = resolveDashboardWorkspace({
      catalog: { isLoaded: true, eventIds: ['event-a', 'event-c'] },
      dataState: {
        program_ids: [],
        versions: [],
        selected_event_ids: ['event-a', 'event-b', 'event-c'],
      },
      globalFilters: { suspension_component: ['knuckle'] },
      renderedEventIds: [],
    });

    expect(state.selectedEventIds).toEqual(['event-a', 'event-c']);
    expect(state.shouldPersistPrunedSelection).toBe(true);
  });

  it('keeps search-hidden selections because event_id_query is not a prune filter', () => {
    const state = resolveDashboardWorkspace({
      catalog: { isLoaded: true, eventIds: ['event-a', 'event-b'] },
      dataState: {
        program_ids: [],
        versions: [],
        selected_event_ids: ['event-a', 'event-b'],
      },
      globalFilters: { event_id_query: 'event-a' },
      renderedEventIds: [],
    });

    expect(state.selectedEventIds).toEqual(['event-a', 'event-b']);
    expect(state.shouldPersistPrunedSelection).toBe(false);
  });

  it('drops non-selectable-only selections and disables render', () => {
    const state = resolveDashboardWorkspace({
      catalog: { isLoaded: true, eventIds: ['event-1'] },
      dataState: {
        program_ids: [],
        versions: [],
        selected_event_ids: ['missing-channel-map-event'],
      },
      globalFilters: {},
      renderedEventIds: ['missing-channel-map-event'],
    });

    expect(state.selectedEventIds).toEqual([]);
    expect(state.canRender).toBe(false);
    expect(state.shouldPersistPrunedSelection).toBe(true);
    expect(state.hasUnrenderedChanges).toBe(true);
  });

  it('marks a rendered selection dirty when selected IDs differ', () => {
    const state = resolveDashboardWorkspace({
      catalog: { isLoaded: true, eventIds: ['event-1', 'event-2'] },
      dataState: {
        program_ids: [],
        versions: [],
        selected_event_ids: ['event-1', 'event-2'],
      },
      globalFilters: {},
      renderedEventIds: ['event-1'],
    });

    expect(state.hasUnrenderedChanges).toBe(true);
  });
});
