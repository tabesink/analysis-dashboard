---
name: enable db import export
overview: Enable database import/export in the UI by first converting the hidden full-database portability path into a safer load-data-only transfer that preserves target admin accounts and configuration.
todos:
  - id: write-load-data-tests
    content: Add server tests proving load-data-only export/import preserves target users and excludes preserved tables
    status: completed
  - id: convert-export-allowlist
    content: Refactor export to use an explicit load-data table allowlist and generate ZIP contents from that boundary
    status: completed
  - id: convert-import-load-data
    content: Refactor import to replace only load-owned tables/artifacts while preserving users and admin configuration
    status: completed
  - id: harden-failure-safety
    content: Add staging or transaction behavior so failed import leaves target data readable
    status: completed
  - id: update-api-validation-tests
    content: Update validation, route tests, and client API contract tests for the repurposed endpoint flow
    status: completed
  - id: enable-admin-ui
    content: Render the existing Database side-panel transfer controls for admins only and add typed import confirmation
    status: completed
  - id: update-runbooks
    content: Update brainstorm docs and deployment/operator runbook pointers to describe load-data-only behavior
    status: completed
isProject: false
---

# Enable Load-Data Import/Export Plan

## Resolved Decisions
- Server hardening comes before UI exposure.
- UI entry point will be the existing Database side panel, rendered only for admins.
- Import confirmation will require a typed acknowledgement.
- Export/import scope is load data only: events, measurements, channel maps, ingestion artifacts, and event custom-field values.
- Import mode replaces target load data while preserving target users, sessions, saved filters, audit log, admin-created custom-field definitions, and allowed custom-field values.
- The existing hidden `/api/v1/export/database/parquet/*` flow will be repurposed to load-data-only semantics instead of adding duplicate endpoint families.

## Why This Direction
- Pros: one API/UI path, lowest entropy, preserves target admin accounts, keeps current modal/hook investment, and gives operators a clear source-to-target workflow.
- Cons: current manual API users would see changed semantics, event custom-field values may reference missing target definitions, and replacing only load data requires careful table/artifact cleanup.
- Recommendation: proceed with this route because the current UI is hidden, the backend is already admin-only, and the product requirement is explicit that target accounts must survive import.

## Target Data Boundary
Implement a single server-side allowlist for portable load-data tables. Start with:
- `dim_program`
- `dim_event`
- `dim_channel_map`
- `measurements_raw`
- `measurements_lttb`
- `ingestion_artifacts`
- `event_custom_field_values`

Preserve these target-local tables:
- `users`
- `sessions`
- `upload_tasks`
- `saved_filters`
- `audit_log`
- `event_access_log`
- `custom_field_definitions`
- `custom_field_allowed_values`
- `_schema_metadata` except for normal post-import metadata refresh

If the actual schema review finds additional load-owned tables, add them only through the same allowlist and a test.

## Implementation Phases

### Phase 1: Prove Current Risk And Desired Semantics
Add behavior tests before changing implementation:
- In [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/tests/server/services/test_export_service.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/tests/server/services/test_export_service.py), add a round-trip test where source load data imports into target but target users remain unchanged.
- Add a failure test proving target load data remains usable if import fails mid-load.
- Add assertions that exported ZIP does not contain preserved tables like `users.parquet`, `sessions.parquet`, or `audit_log.parquet`.

### Phase 2: Convert Export To Load-Data-Only
Refactor [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/storage/database.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/storage/database.py):
- Replace export-all-base-tables discovery in `export_to_parquet()` with an explicit load-data allowlist.
- Generate `schema.sql` and `load.sql` only for allowed tables and required sequences/indexes.
- Keep `_schema_metadata` export only for compatibility validation, not as a target-state replacement.
- Continue copying `managed_artifacts/channel-map` through [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/services/export.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/services/export.py).

### Phase 3: Convert Import To Replace Load Data Only
Refactor `UnifiedStore.import_from_parquet()` or introduce a clearer `import_load_data_from_parquet()` in [`database.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/storage/database.py):
- Build imported load data in a temporary DuckDB database or staging tables.
- Validate required tables and row relationships before touching live load tables.
- Under the DB lock, delete target load-owned rows/tables in dependency order.
- Insert imported load data into the existing live DB without replacing preserved tables.
- Refresh `_schema_metadata` and bump/refresh data version so other clients invalidate caches.
- Preserve target users, sessions, saved filters, audit log, and admin custom-field definitions.

### Phase 4: Harden Import Failure Safety
Make failed imports leave target data readable:
- Prefer staging into a temporary DB first, then copying into live tables only after validation passes.
- If live-table replacement has begun, use one transaction where DuckDB supports it for the table delete/insert section.
- Add explicit cleanup for imported channel-map artifacts: stage artifact replacement first, then swap only after DB import succeeds.
- Fix misleading import audit logging in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/export.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/export.py) so “completed” logs only after successful task completion.

### Phase 5: Update Validation And API Contract
Keep the existing route family, but make names/copy clear:
- Update validation in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/services/export.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/services/export.py) to require only load-data export contents.
- Reject ZIPs that contain preserved tables unless explicitly ignored by design; recommendation is reject to avoid ambiguity.
- Keep schema mismatch warnings unless a real incompatible load-data condition is found.
- Add/adjust route tests in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/tests/server/routers/test_export_router.py`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/tests/server/routers/test_export_router.py).
- Add client API tests for [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/lib/api/export.ts`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/lib/api/export.ts).

### Phase 6: Enable Admin-Only UI With Strong UX
Update [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/upload/DatabaseSidePanel.tsx`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/upload/DatabaseSidePanel.tsx) and related props:
- Add `isAdmin` to side-panel props or pass a `showDatabaseSection` flag.
- Render `<Separator />` and `<DatabaseSection />` only for admins.
- Keep handler-level admin checks in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/app/database/page.tsx`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/app/database/page.tsx).
- Update `DatabaseSection` copy from “Database” to “Load Data Transfer” or equivalent to avoid implying account/config replacement.
- Update `DatabaseOperationModal` to require typed confirmation, such as typing `IMPORT`, before enabling final import.
- Make the modal copy explicit: import replaces target load data but preserves target users and admin configuration.

### Phase 7: Documentation And Smoke Validation
Update docs after implementation matches behavior:
- Revise [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/brainstorm/07_database_import`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/brainstorm/07_database_import) from full-database assessment to load-data-only implementation notes.
- Add a stable operator runbook pointer from [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Deployment/README.md`](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Deployment/README.md) once verified.
- Manual smoke: source admin exports ZIP, target admin imports ZIP, target load data changes, target admin account still logs in, target saved filters/users remain intact.

## TDD Sequence
1. RED: export ZIP excludes preserved tables and includes required load-data tables.
2. GREEN: allowlist export implementation.
3. RED: load-data import replaces target events/measurements but preserves target users.
4. GREEN: staging/import implementation.
5. RED: failed import leaves target load data and users readable.
6. GREEN: transaction/staging rollback behavior.
7. RED: admin UI visibility and typed confirmation tests.
8. GREEN: side-panel render + modal confirmation.
9. RED: API/client contract tests for current endpoint family.
10. GREEN: copy, route, and client updates.

## Open Implementation Notes For The Developer
- Keep the table allowlist close to `UnifiedStore` or a small storage portability module; do not scatter table names across router, service, and UI.
- Prefer a deep storage API: simple method name, strict table boundary inside.
- Do not add merge semantics in this pass.
- Do not add a second endpoint family unless preserving old API behavior becomes mandatory.
- Avoid UI redesign; reuse the existing side-panel section, hook, API client, and modal.
