# Implementation Audit

## Executive Summary

Load-data portability is implemented as an admin-only Parquet ZIP flow. The server has routes, background tasks, upload validation, ZIP extraction safety checks, and DuckDB export/import code. The client has an API wrapper, orchestration hook, modal state, and admin-only side-panel controls.

The main remaining engineering gap is task durability: task/upload state is still process-local.

## Client Audit

### Visible Database Page

`Dashboard/client/src/app/database/page.tsx` mounts `DatabaseSidePanel` and `DatabaseOperationModal`. It creates `dbOperation` via `useDatabaseOperation()` and wires `databaseProps` into the side panel.

The page protects access at the write level:

- Unauthenticated users redirect to `/login`.
- Authenticated users without write permission redirect to `/dashboard`.
- Export/import handlers additionally require `isAdmin`.

On successful import, the page refreshes filter options, clears local selection/filter state, refetches datasets, and invalidates several TanStack Query caches.

### Hidden Side-Panel Controls

`Dashboard/client/src/components/upload/DatabaseSidePanel.tsx` renders `DatabaseSection` only when `showDatabaseSection` is true. The Database page passes that flag from `isAdmin`.

### Database Buttons

`Dashboard/client/src/components/upload/DatabaseSection.tsx` defines:

- Export Load Data button.
- Import Load Data button.
- "Replaces target load data" warning under import.
- Progress/disabled states for export, import, and upload validation.

This component is reachable for admins only.

### Client API

`Dashboard/client/src/lib/api/export.ts` matches the server route contract:

- `GET /api/v1/export/database/info`
- `POST /api/v1/export/database/parquet/export/start`
- `GET /api/v1/export/database/parquet/task/{task_id}`
- `GET /api/v1/export/database/parquet/download/{task_id}`
- `POST /api/v1/export/database/parquet/upload`
- `POST /api/v1/export/database/parquet/import/{upload_id}`
- `DELETE /api/v1/export/database/parquet/upload/{upload_id}`
- `DELETE /api/v1/export/database/parquet/task/{task_id}`

The upload path uses progress-aware form upload with a long timeout. Task polling runs every 2 seconds and has no client-side timeout.

### Client Gaps

- `exportApi` has route contract coverage.
- No component/hook test found for `useDatabaseOperation()` or `DatabaseOperationModal`.
- UI visibility still needs broader component coverage if the test stack adds React Testing Library.
- Polling does not accept an abort signal for component unmount/navigation.
- Download loads the ZIP into a `Blob` before writing, which can be expensive for large exports.

## Server Audit

### Routes

`Dashboard/server/routers/export.py` exposes all portability routes under `/api/v1/export`. Each route uses `AdminRequiredDep`, so unauthenticated users receive `401` and non-admin users receive `403`.

The router also enforces compressed upload size by streaming upload chunks to a temp file and rejecting files larger than `settings.max_upload_size_mb`.

### Export Service

`Dashboard/server/services/export.py` handles task lifecycle and ZIP validation.

Export path:

1. Create in-memory task.
2. Start daemon thread.
3. Call `UnifiedStore.export_to_parquet()` for the load-data table allowlist.
4. Copy managed channel-map artifacts when present.
5. Zip the export directory.
6. Mark task completed with filename and archive size.
7. Clean up after download.

Import path:

1. Upload ZIP to temp file.
2. Validate ZIP and schema metadata.
3. Register staged upload by `upload_id`.
4. On confirmation, pop the upload and start a daemon import thread.
5. Extract ZIP using path traversal guards.
6. Call `UnifiedStore.import_from_parquet()` to replace load-data rows transactionally.
7. Copy imported channel-map artifacts when present.
8. Mark task completed or failed.

### Storage Layer

`Dashboard/server/storage/database.py` implements the actual DuckDB export/import.

`export_to_parquet()`:

- Refreshes `_schema_metadata`.
- Writes the load-data table allowlist to Parquet with ZSTD compression.
- Writes `schema.sql` and `load.sql`.

`import_from_parquet()`:

- Requires `schema.sql` and `load.sql`.
- Locks the store.
- Copies the existing database to `dashboard.db.bak`.
- Rejects preserved target-local tables in the archive.
- Deletes and reloads load-data tables in a transaction.
- Leaves users, sessions, saved filters, audit history, and admin custom-field definitions intact.
- Refreshes schema metadata.
- Returns imported event count, new database size, and backup path.

## Validation Behavior

Validation is useful but not yet strict enough to be a hard compatibility gate.

Current validation checks:

- File is a ZIP.
- ZIP member paths are safe.
- `schema.sql` and `load.sql` are present at root or one subfolder.
- `dim_event.parquet` exists.
- `measurements_lttb.parquet` exists.
- Event count can be read from `dim_event.parquet`.
- `_schema_metadata.parquet`, when present, can provide schema version and filter columns.

Current compatibility behavior:

- `is_compatible` is always returned as `true`.
- Missing or extra filter columns become warnings.
- Schema version mismatch becomes a warning.
- Legacy exports without metadata become warnings.

## Test Coverage Today

Existing server route tests cover:

- Export/import routes reject unauthenticated callers.
- Non-admin users cannot access database info.
- Admin route contract for database info and export start.
- Upload route contract with a stub service.
- Import and cleanup route contracts with a stub service.

Existing service tests cover:

- ZIP validation rejects unsafe member paths.
- Import task rejects path traversal before replacing current data.

Missing tests:

- Full export-to-import round trip using a real DuckDB test database. Covered for load-data-only semantics.
- Failure during import preserves a usable target DB. Covered for load-data-only semantics.
- Missing `schema.sql` / `load.sql` upload behavior through the router.
- Schema mismatch as an explicit allow/warn/block decision.
- Large upload rejection.
- Cancel behavior for export and import.
- Cache invalidation after server-side import.
- Client API contract tests. Covered for current endpoint family.
- Client modal and admin visibility tests.

## Documentation Gaps

`Deployment/README.md` covers release extraction, `.env`, deploy, health check, login, day-2 commands, and upgrade directory layout. It does not explain how to move data between hosts.

`Dashboard/docs/prd.md` describes database portability accurately at a product level. `Dashboard/docs/database-schema.txt` also documents the portable format. The missing piece is an operator-ready runbook plus a junior-friendly implementation plan for hardening.

