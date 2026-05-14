---
name: program-version metadata sync
overview: Implement program-version metadata editing and visibility end-to-end using schema-driven fields, with role-aware editability and canonical post-save refetch behavior.
todos:
  - id: task-tracking
    content: Mark the relevant Phase 8 task IN PROGRESS and create/update docs/tasks implementation note file.
    status: completed
  - id: backend-contract
    content: Make program-version metadata fields schema-driven and exposed consistently by dashboard APIs.
    status: completed
  - id: rbac-and-save
    content: Enforce role editability rules and keep owner/admin write authorization intact.
    status: completed
  - id: frontend-metadata-panel
    content: Update Selection Metadata panel and API typings to include update/upload user and status fields.
    status: completed
  - id: database-columns-filters
    content: Wire new metadata fields into Database column visibility and Global Filters auto-discovery.
    status: completed
  - id: post-save-refetch
    content: Implement targeted query invalidation/refetch after save and verify end-to-end behavior.
    status: completed
  - id: docs-closeout
    content: Update database schema doc (if needed), append decision log entry, and mark task DONE with date.
    status: completed
isProject: false
---

# Program-Version Metadata End-to-End Implementation Plan

## Scope

Implement the behavior captured in `docs/activity/2026-09-03.md`:

- Program-version metadata fields are editable in Edit Metadata (RBAC-aware).
- New metadata fields appear automatically in Database page columns and Global Filters.
- Save updates persist globally at program-version level.
- Selection Metadata panel shows audit metadata (`last_updated_by`, `uploaded_by`, timestamps, `status`).
- Use lean conflict strategy: **last-write-wins**.
- Use lean refresh strategy: **targeted server refetch after save**.

## Key Decisions Locked

- **Concurrency:** last-write-wins (no optimistic conflict protocol for this task).
- **UI update:** canonical data refetch after save (no optimistic local merge).
- **Config model:** program-version metadata fields are schema/config-driven from server source of truth.
- **Out of scope:** custom fields expansion remains unchanged.

## Implementation Steps

1. **Start task tracking + align task IDs**
  - Mark relevant Phase 8 task(s) as `IN PROGRESS` in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/master-build-plan.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/master-build-plan.md)`.
  - Add/adjust a dedicated task note file under `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/tasks](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/tasks)`.
2. **Backend schema + API contract verification for program-version metadata**
  - Ensure metadata fields exist in schema source of truth and are surfaced by API payloads used by:
    - Edit Metadata view
    - Database table rows/column descriptors
    - Global filter options
  - Touchpoints to validate/update:
    - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/schema.yaml](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/schema.yaml)`
    - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/storage/database.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/storage/database.py)`
    - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/dashboard.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/dashboard.py)`
    - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/models/dashboard.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/models/dashboard.py)`
3. **RBAC editability rules in metadata update path**
  - Enforce:
    - Admin: all fields editable.
    - Non-admin: all non-`status` fields editable; `status` read-only.
  - Confirm write authorization still honors owner/admin constraints already introduced.
4. **Selection Metadata panel data model expansion**
  - Replace panel fields to include:
    - `Last update by`
    - `Last update time`
    - `Uploaded by`
    - `Uploaded time`
    - `Status`
  - Ensure backend returns needed user identity fields and frontend maps them consistently.
  - Likely touchpoints:
    - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/app/database/page.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/app/database/page.tsx)`
    - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/types/api.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/types/api.ts)`
    - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/lib/api/dashboard.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/lib/api/dashboard.ts)`
5. **Schema-driven Database page column visibility support**
  - Ensure new program-version metadata fields are part of the same column registry/config used by existing metadata fields.
  - Preserve existing show/hide column behavior with no hardcoded special-casing.
  - Likely touchpoints:
    - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/app/database/page.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/app/database/page.tsx)`
    - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/config/filters.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/config/filters.ts)`
6. **Global Filters auto-discovery for new metadata fields**
  - Ensure fields flow into filter option endpoints and frontend filter rendering without per-field UI code changes.
  - Touchpoints:
    - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/services/query.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/services/query.py)`
    - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/dashboard/side-panel/GlobalFilters.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/dashboard/side-panel/GlobalFilters.tsx)`
    - `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/hooks/use-filter-options.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/hooks/use-filter-options.ts)`
7. **Post-save consistency via targeted refetch**
  - After successful metadata save, trigger scoped invalidation/refetch for:
    - Database row source
    - Filter options/global filters
    - Any metadata panel query depending on updated record
  - Keep this deterministic and lean (no optimistic cache patching).
8. **Verification + documentation obligations**
  - Validate role behavior and end-to-end propagation path manually (Edit -> Save -> Database columns -> Global Filters).
  - Update docs required by project rules:
    - Schema changes in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/database-schema.txt](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/database-schema.txt)` (if changed)
    - Decision entry in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md)` for the locked choices
    - Task implementation notes in `docs/tasks/{task-id}.md`
    - Mark task `DONE (date)` in master build plan

## Success Criteria

- Non-admin can edit/save all non-`status` program-version metadata fields.
- Admin can edit/save all program-version metadata fields including `status`.
- Save persists globally and is visible after refetch in Database page.
- New metadata fields are visible/toggleable as Database columns.
- New metadata fields appear in Global Filters and filter dashboard curves.
- Selection Metadata panel displays requested audit fields with correct values.

