---
name: missing-channel-map-selection-lock
overview: Prevent program/version scopes without a channel map from being selectable in dashboard side panels, and auto-prune stale selections so non-selectable events cannot remain plotted.
todos:
  - id: backend-selectable-flag
    content: Derive selectable_for_plotting from has_channel_map in query service outputs.
    status: completed
  - id: tree-disable-rules
    content: Disable version/program checkboxes based on selectable descendants and fix indeterminate logic.
    status: completed
  - id: selection-auto-prune
    content: Auto-prune selected_event_ids when catalog marks events non-selectable.
    status: completed
  - id: verify-tests
    content: Run targeted backend test(s) and confirm dashboard side-panel behavior for mixed/unmapped scopes.
    status: completed
isProject: false
---

# Missing Channel Map Selection Lock

## Goal

Ensure dashboard side panels (Grid + Interactive) never allow selecting program/version/event rows that do not have a channel map, while keeping mixed programs selectable for mapped versions only.

## Implementation Plan

- **Backend selectable contract**
  - Update event metadata shaping in [server/services/query.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/services/query.py) so `selectable_for_plotting` is derived from `has_channel_map`.
  - Keep existing pending pseudo-events as non-selectable (`selectable_for_plotting: false`).
  - Expected rule:
    - mapped program/version events -> selectable
    - unmapped program/version events -> non-selectable
- **Tree checkbox disable behavior**
  - In [client/src/components/dashboard/shared/HierarchicalEventTree.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/dashboard/shared/HierarchicalEventTree.tsx):
    - disable version checkbox when `selectableEventIds.length === 0`
    - disable program checkbox only when *all* child versions are non-selectable (matches your choice: mixed programs remain checkable for mapped versions)
    - keep batch actions scoped to `selectableEventIds`
  - Fix program-row indeterminate state to use true partial-selection logic (not "any unchecked").
- **Selection-state pruning**
  - In [client/src/components/dashboard/side-panel/LoadDataSection.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/dashboard/side-panel/LoadDataSection.tsx) (or the existing selection-sync hook path), add auto-prune:
    - whenever event catalog updates, remove selected IDs whose events now have `selectable_for_plotting === false`
  - Preserve current behavior that select-all only targets selectable events.
- **Type and behavior consistency checks**
  - Confirm `EventMetadata` typing in [client/src/types/api.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/types/api.ts) still matches backend payload usage (`has_channel_map`, `missing_channel_map`, `selectable_for_plotting`).
  - Verify both Grid and Interactive tabs share the same `Load Data` component path, so this change applies to both without duplication.
- **Verification**
  - Backend: targeted test in [tests/server/services/test_ingestion_service_status.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/tests/server/services/test_ingestion_service_status.py) or query-service tests asserting unmapped events return `selectable_for_plotting=false`.
  - Frontend manual checks:
    - pending/unmapped version is visible but not checkable
    - mixed program remains checkable and selects only mapped versions
    - stale selected IDs in unmapped scope are auto-cleared after refresh
    - render payload excludes unmapped IDs after pruning
- **Docs update (if behavior decision is durable)**
  - Add a short decision note in [docs/decisions/log.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md) clarifying: "selection eligibility is channel-map-gated and stale non-selectable IDs are auto-pruned."

