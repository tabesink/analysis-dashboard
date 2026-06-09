# Candidate 1 Implementation Guide — Dashboard Workspace Module

## Goal

Create one deep module for dashboard selection, filters, and session persistence.

The module should make this easy for a caller:

```ts
const workspace = useDashboardWorkspace({
  catalog,
  initialSession,
  defaultFilters,
  persistSession,
});
```

The caller should not need to know about pruning, session sync, catalog whitelists, rendered IDs, or persistence timing.

## Proposed folder

```text
client/src/modules/dashboard-workspace/
  README.md
  types.ts
  resolve-dashboard-workspace.ts
  dashboard-workspace-reducer.ts
  use-dashboard-workspace.ts
  dashboard-workspace.test.ts
```

## README.md starter

```md
# Dashboard Workspace Module

This module owns the dashboard's user-facing state rules.

It decides:

- Which event IDs are selected.
- Which selected event IDs are still valid for the current catalog.
- Which filters are active.
- Which event IDs should be rendered.
- Which session fields are persisted.

Callers should use `useDashboardWorkspace`. Do not call the reducer directly from UI code.
```

## types.ts

```ts
export type EventId = string;

export type DashboardFilterValue =
  | string
  | number
  | boolean
  | Array<string | number>;

export type DashboardFilters = Record<string, DashboardFilterValue>;

export type EventCatalog = {
  isLoaded: boolean;
  eventIds: EventId[];
};

export type DashboardSession = {
  selectedEventIds: EventId[];
  filters: DashboardFilters;
};

export type DashboardWorkspaceInput = {
  catalog: EventCatalog;
  initialSession: DashboardSession | null;
  defaultFilters: DashboardFilters;
  persistSession: (session: DashboardSession) => void;
};

export type DashboardWorkspaceState = {
  selectedEventIds: EventId[];
  renderedEventIds: EventId[];
  filters: DashboardFilters;
  canRender: boolean;
};

export type DashboardWorkspaceActions = {
  selectEvents: (eventIds: EventId[]) => void;
  clearSelection: () => void;
  setFilter: (key: string, value: DashboardFilterValue | undefined) => void;
  resetFilters: () => void;
};

export type DashboardWorkspace = {
  state: DashboardWorkspaceState;
  actions: DashboardWorkspaceActions;
};
```

## resolve-dashboard-workspace.ts

Keep this file pure. It should not import React, browser storage, or query cache.

```ts
import type {
  DashboardFilters,
  DashboardSession,
  DashboardWorkspaceState,
  EventCatalog,
  EventId,
} from "./types";

type ResolveInput = {
  catalog: EventCatalog;
  session: DashboardSession | null;
  defaultFilters: DashboardFilters;
};

function pruneSelectedEventIds(
  selectedEventIds: EventId[],
  catalog: EventCatalog,
): EventId[] {
  if (!catalog.isLoaded) {
    // Important: do not destroy persisted selections while the catalog is still loading.
    return selectedEventIds;
  }

  const allowed = new Set(catalog.eventIds);
  return selectedEventIds.filter((id) => allowed.has(id));
}

function resolveRenderedEventIds(
  selectedEventIds: EventId[],
  catalog: EventCatalog,
): EventId[] {
  if (!catalog.isLoaded) return [];
  return selectedEventIds;
}

export function resolveDashboardWorkspace(
  input: ResolveInput,
): DashboardWorkspaceState {
  const filters = input.session?.filters ?? input.defaultFilters;
  const selectedEventIds = pruneSelectedEventIds(
    input.session?.selectedEventIds ?? [],
    input.catalog,
  );

  return {
    selectedEventIds,
    renderedEventIds: resolveRenderedEventIds(selectedEventIds, input.catalog),
    filters,
    canRender: input.catalog.isLoaded && selectedEventIds.length > 0,
  };
}
```

## dashboard-workspace-reducer.ts

Keep updates boring and explicit.

```ts
import type {
  DashboardFilterValue,
  DashboardWorkspaceState,
  EventId,
} from "./types";

export type DashboardWorkspaceAction =
  | { type: "select-events"; eventIds: EventId[] }
  | { type: "clear-selection" }
  | { type: "set-filter"; key: string; value: DashboardFilterValue | undefined }
  | { type: "reset-filters"; defaultFilters: Record<string, DashboardFilterValue> };

export function dashboardWorkspaceReducer(
  state: DashboardWorkspaceState,
  action: DashboardWorkspaceAction,
): DashboardWorkspaceState {
  switch (action.type) {
    case "select-events":
      return {
        ...state,
        selectedEventIds: action.eventIds,
        renderedEventIds: action.eventIds,
        canRender: action.eventIds.length > 0,
      };

    case "clear-selection":
      return {
        ...state,
        selectedEventIds: [],
        renderedEventIds: [],
        canRender: false,
      };

    case "set-filter": {
      const nextFilters = { ...state.filters };

      if (action.value === undefined) {
        delete nextFilters[action.key];
      } else {
        nextFilters[action.key] = action.value;
      }

      return {
        ...state,
        filters: nextFilters,
      };
    }

    case "reset-filters":
      return {
        ...state,
        filters: action.defaultFilters,
      };

    default:
      return state;
  }
}
```

## use-dashboard-workspace.ts

This hook is the React-facing interface. UI code should call this, not internal helpers.

```ts
import { useEffect, useMemo, useReducer } from "react";
import {
  dashboardWorkspaceReducer,
  type DashboardWorkspaceAction,
} from "./dashboard-workspace-reducer";
import { resolveDashboardWorkspace } from "./resolve-dashboard-workspace";
import type {
  DashboardWorkspace,
  DashboardWorkspaceInput,
  DashboardWorkspaceState,
  EventId,
} from "./types";

function toPersistedSession(state: DashboardWorkspaceState) {
  return {
    selectedEventIds: state.selectedEventIds,
    filters: state.filters,
  };
}

export function useDashboardWorkspace(
  input: DashboardWorkspaceInput,
): DashboardWorkspace {
  const initialState = useMemo(
    () =>
      resolveDashboardWorkspace({
        catalog: input.catalog,
        session: input.initialSession,
        defaultFilters: input.defaultFilters,
      }),
    // Keep this dependency list intentional. Initial session should seed state.
    // After that, actions own changes.
    [],
  );

  const [state, dispatch] = useReducer(
    dashboardWorkspaceReducer,
    initialState,
  );

  useEffect(() => {
    input.persistSession(toPersistedSession(state));
  }, [input, state]);

  return {
    state,
    actions: {
      selectEvents: (eventIds: EventId[]) =>
        dispatch({ type: "select-events", eventIds }),

      clearSelection: () =>
        dispatch({ type: "clear-selection" }),

      setFilter: (key, value) =>
        dispatch({ type: "set-filter", key, value }),

      resetFilters: () =>
        dispatch({
          type: "reset-filters",
          defaultFilters: input.defaultFilters,
        } satisfies DashboardWorkspaceAction),
    },
  };
}
```

## dashboard-workspace.test.ts

```ts
import { describe, expect, it } from "vitest";
import { resolveDashboardWorkspace } from "./resolve-dashboard-workspace";

describe("resolveDashboardWorkspace", () => {
  it("keeps selected IDs while the catalog is still loading", () => {
    const state = resolveDashboardWorkspace({
      catalog: { isLoaded: false, eventIds: [] },
      session: {
        selectedEventIds: ["event-1"],
        filters: {},
      },
      defaultFilters: {},
    });

    expect(state.selectedEventIds).toEqual(["event-1"]);
    expect(state.renderedEventIds).toEqual([]);
    expect(state.canRender).toBe(false);
  });

  it("prunes selected IDs after the catalog is loaded", () => {
    const state = resolveDashboardWorkspace({
      catalog: { isLoaded: true, eventIds: ["event-1"] },
      session: {
        selectedEventIds: ["event-1", "deleted-event"],
        filters: {},
      },
      defaultFilters: {},
    });

    expect(state.selectedEventIds).toEqual(["event-1"]);
    expect(state.renderedEventIds).toEqual(["event-1"]);
    expect(state.canRender).toBe(true);
  });

  it("uses default filters when there is no session", () => {
    const state = resolveDashboardWorkspace({
      catalog: { isLoaded: true, eventIds: [] },
      session: null,
      defaultFilters: { program: "A" },
    });

    expect(state.filters).toEqual({ program: "A" });
  });
});
```

## Migration steps

1. Create the new module folder.
2. Add the pure resolver and tests first.
3. Keep existing hooks unchanged.
4. Wrap existing hook behaviour behind `useDashboardWorkspace`.
5. Update `DashboardContent.tsx` to consume `workspace.state` and `workspace.actions`.
6. Remove old hook tests only after the new interface tests cover the same behaviour.

## Junior developer checklist

Before opening a pull request:

- [ ] I added or updated behaviour tests.
- [ ] UI code calls only the module interface.
- [ ] I did not expose internal helpers for tests.
- [ ] Persisted session state contains no temporary loading state.
- [ ] Selected event IDs are not destroyed during temporary catalog loading.
- [ ] The old logic is removed or clearly marked as temporary wrapper code.
