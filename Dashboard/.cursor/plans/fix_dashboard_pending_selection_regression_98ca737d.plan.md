---
name: Fix Dashboard Pending Selection Regression
overview: Fix dashboard selectability by preserving channel-map flags through the events API and hide pseudo pending leaves while keeping disabled version/program rows visible.
todos:
  - id: fix-events-metadata-passthrough
    content: Pass has_channel_map, missing_channel_map, and selectable_for_plotting through /dashboard/events response mapping.
    status: completed
  - id: hide-pending-pseudo-leaf
    content: Stop rendering __pending_channel_map__ pseudo events as tree leaves while keeping version/program warning visibility.
    status: completed
  - id: regression-verify
    content: Add/adjust focused tests and run backend+type-check verification for dashboard selection contract.
    status: completed
isProject: false
---

# Fix Dashboard Pending Selection Regression

## Confirmed Root Cause

- In [server/routers/dashboard.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/dashboard.py), the `/dashboard/events` response mapping omits `has_channel_map`, `missing_channel_map`, and `selectable_for_plotting` from query output.
- Because [server/models/dashboard.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/models/dashboard.py) defaults `selectable_for_plotting` to `True`, unmapped rows become selectable on the client.
- Pending-only placeholders come from [server/services/query.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/services/query.py) as pseudo-event IDs (`__pending_channel_map__::...`), and [client/src/components/dashboard/shared/HierarchicalEventTree.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/dashboard/shared/HierarchicalEventTree.tsx) renders them as normal leaves.

## Implementation Plan

- **Preserve selectable metadata in API response**
  - Update `/dashboard/events` mapping in [server/routers/dashboard.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/dashboard.py) to pass through:
    - `has_channel_map`
    - `missing_channel_map`
    - `selectable_for_plotting`
  - This restores backend-authoritative non-selectable behavior for unmapped scopes.
- **Hide pseudo pending leaf rows**
  - In [client/src/components/dashboard/shared/HierarchicalEventTree.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/dashboard/shared/HierarchicalEventTree.tsx), filter out pseudo events (`event_id` starts with `__pending_channel_map__::`) from rendered leaf rows while still using version/program-level `missing_channel_map` + disabled checkbox state.
  - Keep mixed program behavior intact: mapped descendants remain selectable; unmapped-only branches stay disabled.
- **Selection cleanup behavior**
  - Keep existing pruning behavior in [client/src/components/dashboard/side-panel/LoadDataSection.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/dashboard/side-panel/LoadDataSection.tsx), which will clear stale selected pseudo IDs once API flags flow correctly.
- **Regression tests**
  - Extend tests in [tests/server/services/test_ingestion_service_status.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/tests/server/services/test_ingestion_service_status.py) (or add focused router test) to assert `/dashboard/events` returns the channel-map/selectable fields correctly.
- **Verification**
  - Backend: run focused pytest for updated tests.
  - Frontend: check that an unmapped version shows as disabled and no longer renders `__pending_channel_map__` leaf; ensure selected count does not persist stale pending ID.
  - Type-check changed client/server files.

## Expected UX After Fix

- Program/version without channel map: visible, disabled, warning icon.
- No raw `__pending_channel_map__` leaf text.
- Cannot select or keep selected any unmapped-only scope.

