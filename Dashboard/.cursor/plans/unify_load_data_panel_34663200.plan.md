---
name: Unify Load Data Panel
overview: Merge the "Historical Data" and "New Data" side panel sections into a single "Load Data" section with one merged HierarchicalEventTree, unified selection state, program-based colors for all events, and dynamic tree height. This is a full-stack refactor removing the baseline/new-data partition concept.
todos:
  - id: backend-models
    content: "Phase 1A/1D: Flatten EventsResponse, remove partition from curve models, unify session models (dashboard.py, session.py)"
    status: completed
  - id: backend-query
    content: "Phase 1B: Simplify QueryService to return single events list without status-based split"
    status: completed
  - id: backend-router
    content: "Phase 1C: Update dashboard router endpoints to use new response shapes"
    status: completed
  - id: backend-session
    content: "Phase 1D cont: Add session migration logic (merge baseline_state + new_data_state on load)"
    status: completed
  - id: frontend-types
    content: "Phase 2: Update api.ts, session.ts types and API client to match new backend contract"
    status: completed
  - id: frontend-hooks
    content: "Phase 3: Refactor useAllEvents, useEventCatalog, useFilterState, useCurveColoring hooks"
    status: completed
  - id: frontend-sidepanel
    content: "Phase 4A: Create LoadDataSection, update SidePanel, remove BaselinePartition/NewDataPartition"
    status: completed
  - id: frontend-components
    content: "Phase 4B-E: Update CurveSelector, PlotGrid, ColorGroupingPanel, ColorLegend"
    status: completed
  - id: scroll-height
    content: "Phase 5: Fix scroll height to fill remaining panel space with appropriate bottom gap"
    status: completed
  - id: cleanup-docs
    content: "Phase 6: Delete orphaned files, clean imports, update docs/decisions/log.md"
    status: completed
isProject: false
---

# Unify "Load Data" Panel -- Full Partition Removal Refactor

## Summary

Replace the dual "Historical Data" / "New Data" partition model with a single unified event list throughout the stack. The dashboard side panel gets a single "Load Data" section with one `HierarchicalEventTree`, a single `selected_event_ids` state, program-based coloring for all events, and dynamic scroll height filling the panel.

---

## Phase 1: Backend API Changes

### 1A. Flatten EventsResponse

**[server/models/dashboard.py](server/models/dashboard.py)** -- Replace split response:

```python
# BEFORE
class EventsResponse(BaseModel):
    baseline_events: list[EventMetadata] = ...
    new_data_events: list[EventMetadata] = ...
    baseline_count: int = 0
    new_data_count: int = 0

# AFTER
class EventsResponse(BaseModel):
    events: list[EventMetadata] = Field(default_factory=list)
    total_count: int = 0
    has_more: bool = False
```

Also simplify `EventsRequest` -- remove separate `baseline` / `new_data` partition fields; keep only `global_filters`.

Remove `partition` field from: `PlotSeries`, `SVGCurveData`, `CurveData`, `ClickQueryResponse`, `RenderInteractiveResponse.curves`.

### 1B. Update QueryService

**[server/services/query.py](server/services/query.py)** -- `get_partitioned_events()` becomes `get_all_events()`: single query without status-based splitting. The internal `_get_events_metadata()` helper remains (it still derives partition from status for backward compat) but the partition field is no longer surfaced in responses.

### 1C. Update Dashboard Router

**[server/routers/dashboard.py](server/routers/dashboard.py)** -- Update the `/events` endpoint to call the simplified query method, return flat `EventsResponse`. Update `/svg-plot-data`, `/render/grid`, `/render/interactive`, `/click-query` endpoints to stop populating `partition` in their response models.

### 1D. Update Session Models

**[server/models/session.py](server/models/session.py)** -- Replace `baseline_state` / `new_data_state` with a single `data_state: PartitionState`. Apply to `SessionCreate`, `SessionUpdate`, `SessionResponse`, `SavedFilterCreate`, `SavedFilterResponse`.

**[server/services/session.py](server/services/session.py)** -- Add migration logic: on session load, if `baseline_state` or `new_data_state` exist in stored JSON but `data_state` does not, merge their `selected_event_ids` into a single `data_state`.

---

## Phase 2: Frontend Type & API Changes

### 2A. Update API Types

**[client/src/types/api.ts](client/src/types/api.ts)**:

- `EventsResponse` -- single `events: EventMetadata[]` + `total_count`.
- Remove `partition` field from `SVGCurveData`, etc.
- `EventsRequest` -- remove `baseline` / `new_data`, keep `global_filters`.

### 2B. Update Session Types

**[client/src/types/session.ts](client/src/types/session.ts)**:

- Replace `baseline_state` / `new_data_state` with `data_state: PartitionState`.
- Remove `baseline_count` / `new_data_count` from `ColorGroup`.

### 2C. Update API Client

**[client/src/lib/api/dashboard.ts](client/src/lib/api/dashboard.ts)** (or wherever `getEvents` lives) -- adjust request/response shapes.

---

## Phase 3: Frontend Hooks Refactor

### 3A. `useAllEvents`

**[client/src/hooks/use-all-events.ts](client/src/hooks/use-all-events.ts)**:

- Return `allEvents: EventMetadata[]` only (remove `baselineEvents` / `newDataEvents` split).
- The `select` transform no longer splits by status.

### 3B. `useEventCatalog`

**[client/src/hooks/use-event-catalog.ts](client/src/hooks/use-event-catalog.ts)**:

- Return `events` (single filtered list) instead of `baselineEvents` / `newDataEvents`.
- Keep `allVisibleEvents` as-is (it's already a merged list).

### 3C. `useFilterState`

**[client/src/hooks/use-filter-state.ts](client/src/hooks/use-filter-state.ts)**:

- Replace `baselineState` / `newDataState` / `updateBaseline` / `updateNewData` / `updateBothPartitions` with single `dataState` / `updateDataState`.
- `allSelectedEventIds` becomes just `dataState.selected_event_ids`.
- Migration on load: if session has old `baseline_state` / `new_data_state`, merge them.

### 3D. `useCurveColoring`

**[client/src/hooks/use-curve-coloring.ts](client/src/hooks/use-curve-coloring.ts)**:

- Remove `CurvePartition` type and all partition-based branching in `getCurveColor`.
- All events get program-based coloring (`byVersion` mode logic applied uniformly).
- Merge `baselineEventMetaMap` and `newDataEventMetaMap` into a single `eventMetaMap`.
- `getCurveColor(eventId)` signature (drop partition parameter).

---

## Phase 4: Frontend Components

### 4A. Side Panel -- Unified "Load Data"

**[client/src/components/dashboard/side-panel/SidePanel.tsx](client/src/components/dashboard/side-panel/SidePanel.tsx)**:

- Remove top-level "Data Selection" heading.
- Replace `<BaselinePartition>` + `<Separator>` + `<NewDataPartition>` with a single unified `<LoadDataSection>`.
- Remove `<Separator>` between GlobalFilters and the data section.
- Change `ScrollArea` to fill remaining panel height with no max-height cap. Ensure `pb-4` (or similar) gap at bottom.

**New: [client/src/components/dashboard/side-panel/LoadDataSection.tsx**](client/src/components/dashboard/side-panel/LoadDataSection.tsx) -- replaces both `BaselinePartition` and `NewDataPartition`. Uses `useFilterState().dataState` and `useEventCatalog().events`. Single `HierarchicalEventTree` with dynamic height (`flex-1 min-h-0` instead of fixed `h-64`).

**Delete**: `BaselinePartition.tsx`, `NewDataPartition.tsx` (and potentially `PartitionSection.tsx` if no other consumers remain).

### 4B. Interactive Viewer Tab

**[client/src/components/dashboard/interactive-viewer/CurveSelector.tsx](client/src/components/dashboard/interactive-viewer/CurveSelector.tsx)**:

- Props change from `{ baselineEvents, newDataEvents }` to `{ events }`.
- Internal merge removed.

**[client/src/components/dashboard/interactive-viewer/types.ts](client/src/components/dashboard/interactive-viewer/types.ts)**:

- `CurveSelectorProps` -- `events: EventMetadata[]` replaces split props.

### 4C. PlotGrid

**[client/src/components/dashboard/plot-grid/PlotGrid.tsx](client/src/components/dashboard/plot-grid/PlotGrid.tsx)**:

- `getCurveColor` calls drop the `partition` argument.
- No other structural changes (it already uses `allSelectedEventIds` / `renderedEventIds`).

### 4D. ColorGroupingPanel

**[client/src/components/dashboard/shared/ColorGroupingPanel.tsx](client/src/components/dashboard/shared/ColorGroupingPanel.tsx)**:

- Remove "Historical Data" / "New Data" section labels.
- Remove `NewDataIcon` export (or keep for other uses).
- All events get uniform color treatment.

### 4E. ColorLegend

**[client/src/components/dashboard/color-legend/ColorLegend.tsx](client/src/components/dashboard/color-legend/ColorLegend.tsx)**:

- Remove "Show New Data Only" toggle.
- Remove any baseline/new-data color distinction.

---

## Phase 5: Scroll Height Fix

In the final `SidePanel.tsx` layout, ensure:

```
<SidePanelLayout>
  <div className="flex flex-col h-full">
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="p-5 pb-4 space-y-4">
        <GlobalFilters />
        <LoadDataSection />   {/* tree uses flex-1, no fixed h-64 */}
      </div>
    </div>
  </div>
</SidePanelLayout>
```

The `HierarchicalEventTree` inside `LoadDataSection` should use `flex-1 min-h-0` (or `className="h-full"` with a parent that constrains) so it grows to fill remaining vertical space. Remove the fixed `h-64` class.

The outer `ScrollArea` already wraps everything -- just ensure it uses `flex-1 min-h-0` on the `SidePanelLayout` child to fill the full panel height. Add `pb-4` at the bottom of the content for appropriate spacing.

---

## Phase 6: Cleanup

- Remove `BaselinePartition.tsx`, `NewDataPartition.tsx`.
- If `PartitionSection.tsx` has no other consumers, delete it.
- Update `color-selection-store.ts` to remove any baseline/new-data color distinction.
- Remove dead imports across all touched files.
- Update `docs/database-schema.txt` and `docs/decisions/log.md`.
- Mark task as DONE in `docs/master-build-plan.md`.

---

## Files Changed (estimated ~20 files)

**Backend (5 files)**:

- `server/models/dashboard.py`
- `server/models/session.py`
- `server/services/query.py`
- `server/services/session.py`
- `server/routers/dashboard.py`

**Frontend types/API (3 files)**:

- `client/src/types/api.ts`
- `client/src/types/session.ts`
- `client/src/lib/api/dashboard.ts`

**Frontend hooks (4 files)**:

- `client/src/hooks/use-all-events.ts`
- `client/src/hooks/use-event-catalog.ts`
- `client/src/hooks/use-filter-state.ts`
- `client/src/hooks/use-curve-coloring.ts`

**Frontend components (8 files)**:

- `client/src/components/dashboard/side-panel/SidePanel.tsx`
- `client/src/components/dashboard/side-panel/LoadDataSection.tsx` (new)
- `client/src/components/dashboard/side-panel/BaselinePartition.tsx` (delete)
- `client/src/components/dashboard/side-panel/NewDataPartition.tsx` (delete)
- `client/src/components/dashboard/side-panel/PartitionSection.tsx` (delete if orphaned)
- `client/src/components/dashboard/interactive-viewer/CurveSelector.tsx`
- `client/src/components/dashboard/interactive-viewer/types.ts`
- `client/src/components/dashboard/shared/ColorGroupingPanel.tsx`
- `client/src/components/dashboard/color-legend/ColorLegend.tsx`
- `client/src/components/dashboard/plot-grid/PlotGrid.tsx`
- `client/src/stores/color-selection-store.ts`

## Risk Mitigation

- Phase 1 (backend) can be done with backward compatibility: keep accepting old request shapes, return new response shapes.
- Session migration (merge on load) prevents data loss for existing users.
- Test after each phase -- backend first, then hooks, then components.

