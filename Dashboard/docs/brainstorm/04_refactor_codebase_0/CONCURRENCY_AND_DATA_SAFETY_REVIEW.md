# Concurrency and Data Safety Review

## Status

Updated for PR 3 on 2026-05-15.

## Write-Path Inventory

| Route or service | Data written | Auth dependency | Ownership rule | Transaction / rollback behavior | Cache invalidation | Existing tests | Follow-up |
|---|---|---|---|---|---|---|---|
| `POST /api/v1/upload/folder/start` -> `IngestionService.ingest` | Programs, events, channel maps, raw/LTTB measurements, retained artifacts, custom field values, audit log, upload task state | `CurrentUserDep`; status constrained by admin flag | Upload owner recorded as `uploaded_by_user_id`; non-admin status forced to `Pending` | Parse/validation preflight before event writes; each event write uses `UnifiedStore.write_connection()` transaction; failures return failed result and keep already committed events explicit in result | `IngestionService._invalidate_cache()` after successful ingestion or after partial event commits | `tests/server/services/test_ingestion_service_status.py` | Add more failure-mode tests for parser/downsampler exceptions if ingestion internals change. |
| Missing-channel-map upload branch | Program row and retained `ingestion_artifacts` rows/files | `CurrentUserDep` through upload route | Artifact owner stored as `owner_user_id` | Artifacts are intentionally retained with `pending` status; parse failure returns without artifact rows | `IngestionService._invalidate_cache()` after retained artifacts become visible | `test_ingest_without_channel_map_retains_pending_artifact` | None for current behavior. |
| `save_channel_map_and_process_artifacts` | Channel maps, events, raw/LTTB measurements, artifact status, custom field values | Called by write/admin dashboard route | Caller route must enforce write/admin and owner/admin rules | Channel map writes and per-artifact event writes use transactions; failed artifact is marked `failed` and later artifacts continue | `IngestionService._invalidate_cache()` after processing attempt | `test_saving_channel_map_processes_pending_artifact` | Add route-level ownership tests if dashboard channel-map route changes. |
| `DELETE /api/v1/upload/events/{event_id}` | Soft-delete flag | `CurrentUserDep` | Admin can delete any event; non-admin can delete only own event | Single store write via `soft_delete_event` | `QueryService.invalidate_event_caches()` after successful delete | Covered indirectly by service/store tests; router-specific coverage is still light | Add router tests for owner/admin/other-user responses. |
| `POST /api/v1/upload/events/delete` | Soft-delete flags | `CurrentUserDep` | Admin targets all requested IDs; non-admin targets only own non-deleted IDs | Store bulk soft delete writes matching target IDs | Invalidates event caches only when rows were deleted | Existing coverage unknown | Decide whether partial non-admin success should remain silent or return per-ID denied info. |
| `POST /api/v1/upload/program-version/delete` | Hard deletes events, measurements, custom field values, retained artifact rows/files, channel maps, empty program row | `WriteUserDep` | Admin can delete any scope; write-enabled non-admin must own every event/artifact in scope | DB rows delete inside one `write_connection()` transaction; file deletes happen after DB commit and are constrained to managed artifact root | `QueryService.invalidate_event_caches()` after successful delete | Scope delete tests in `test_ingestion_service_status.py`; route ownership/cache tests in `test_upload_router.py` | None for current ownership/cache behavior. |
| Metadata update routes in `server/routers/dashboard.py` -> `QueryService` | Event metadata, derived weight ranges, audit log | Router-level auth plus write/admin for mutation routes | Owner/admin for event metadata; admin-only for status | Store update and audit are separate service calls; behavior is covered at service boundary | `QueryService._invalidate_event_cache_groups()` | `tests/server/services/test_query_service_metadata.py` | Add conflict detection later under P8-07. |
| Custom field routes in `server/routers/dashboard.py` -> `CustomFieldService` / store | Custom field definitions and values | Write/admin dependency expected on mutation routes | Program/value scoped; no per-owner event write unless values are applied to events | Store methods use write transactions | Cache invalidation should be verified when fields affect filter/event payloads | Existing coverage unknown | Audit custom-field cache invalidation under P8-06. |
| `POST /api/v1/export/database/parquet/upload` | Staged ZIP file path in temp storage | `AdminRequiredDep` | Admin-only | Upload streams to temp file; invalid validation unlinks temp file before returning error | Not applicable; validation must not replace DB | `tests/server/services/test_export_service.py` path traversal validation | None for current unsafe path behavior. |
| `POST /api/v1/export/database/parquet/import/{upload_id}` -> `ExportService._run_import` | Whole DuckDB import replacement and managed artifacts | `AdminRequiredDep` | Admin-only | Upload ID is popped before background task; import runs in background; failures mark task failed and leave current DB intact unless `import_from_parquet` has already passed validation and replacement begins | Import replacement cache invalidation is not explicit | `test_import_task_rejects_path_traversal_without_replacing_current_data` | Add import replacement cache invalidation and broader failed-import tests when import internals change. |
| `DELETE /api/v1/export/database/parquet/upload/{upload_id}` | Staged upload temp file | `AdminRequiredDep` | Admin-only | Removes pending upload entry and unlinks file if present | Not applicable | Existing coverage unknown | Add router test if upload lifecycle changes. |
| `server/services/session.py` | User session rows | Current user via session routes | Session ID access is user-scoped | Store writes use DB transaction helpers | Not dashboard data cache | `test_session_manager_enforces_user_scoped_access` | None for PR 3. |

## PR 3 Fix

Parquet ZIP validation and background import now reject archive members with absolute paths, `..` components, empty components, or backslashes before writing them to disk. Both code paths use the same extraction guard so a malformed archive cannot write outside the managed temporary extraction root.

## Remaining Risk

Import replacement cache invalidation and broader failed-upload tests are still useful follow-ups, but the immediate unsafe ZIP extraction gap and scope-delete ownership/cache route contract are covered by regression tests.
# Concurrency and Data Safety Review

## Summary

The backend centralizes persistence through `UnifiedStore`, a single DuckDB file with a shared connection serialized by `threading.RLock`. Writes use a context-managed transaction that commits on success and rolls back on exception. This is a reasonable local-server model for 5-10 users if long-running writes remain controlled and all write paths keep owner/admin checks and cache invalidation.

The most important next work is test coverage for failure cases: failed upload/import should not corrupt existing data, scope deletes must enforce ownership, export/import should not replace good data after validation failure, and cache invalidation should be asserted after mutations.

## Persistence Model

| Data type | Storage location | Read by | Written by | Owner field | Transaction/locking | Cache invalidation | Multi-user risk |
|---|---|---|---|---|---|---|---|
| Users | DuckDB `users` table | `AuthService`, `UserService`, admin router | `UserService`, auth/admin routes | user `id` | `UnifiedStore.write_connection()` | Not query-cache backed | Medium |
| Sessions | DuckDB sessions table | `SessionManager`, session router | `SessionManager` | user ID passed to manager | Store transaction | Not query-cache backed | Medium |
| Programs/events metadata | DuckDB dim tables | `QueryService`, `UploadQueryService` | `IngestionService`, `QueryService`, delete paths | `uploaded_by_user_id`, update fields | Store transaction | `QueryService` and `IngestionService` invalidate event-related prefixes | High |
| Raw/LTTB measurements | DuckDB measurement tables | `QueryService` plot routes | `IngestionService`, purge/delete paths | Event ownership via event rows | Store transaction | Event/plot-related cache must be refreshed | High |
| Channel maps | DuckDB `dim_channel_map` | Dashboard/channel-map routes, query service | Upload and channel-map editor flows | Program/version plus caller ownership rules | Store transaction | Event/program/version cache invalidation required | High |
| Ingestion artifacts | DuckDB `ingestion_artifacts` plus files under `data_root` | Upload/database pages, channel-map editor | `IngestionService`, delete paths | `owner_user_id` | DB transaction plus filesystem operations | Upload/dashboard cache invalidation required | High |
| Portable exports/imports | Temporary ZIPs plus DuckDB replacement/import service | Export router/service | `ExportService` background tasks | Admin-only | Service-managed; needs failure tests | Should refresh all affected reads after import | High |
| Query cache | In-process `SimpleCache` | `QueryService`, `IngestionService` | Cache helper calls | None | Thread lock in cache | Prefix invalidation | Medium |

## Write-Path Inventory

| Write path | Entry point | Auth/owner rule | Tables/files touched | Rollback behavior | Cache invalidation | Tests | Follow-up |
|---|---|---|---|---|---|---|---|
| Login last-login stamp | `/api/v1/auth/login` | Valid credentials | users, audit log | Store methods | None | `test_auth_routes.py` | Add cookie attribute test |
| Self-registration | `/api/v1/auth/register` | Public local-network policy; creates read-only user | users, audit log | Store methods | None | `test_auth_routes.py` | Fix stale wording |
| Password change | `/api/v1/auth/change-password` | Current user | users, audit log | Store methods | None | `test_auth_routes.py` | Good baseline |
| Admin user management | `/api/v1/admin/users*` | Admin | users, audit log | Store methods | None | `test_admin_users_router.py` | Good baseline |
| Session create/update/delete | `/api/v1/session/*` | Current user; scoped by user ID | sessions | SessionManager/store | None | Unknown | Add route tests later |
| Upload CSV/RSP | `/api/v1/upload/folder/start` | Current user; non-admin status forced pending | events, measurements, artifacts, channel maps, files | Store transactions; filesystem retention needs failure coverage | `IngestionService._invalidate_cache()` | `test_ingestion_service_status.py` | Add failed upload corruption tests |
| Pending channel-map processing | dashboard channel-map save route | Write user; service processes artifacts | channel maps, artifacts, events, measurements | Store/service logic | `IngestionService._invalidate_cache()` | `test_ingestion_service_status.py` | Add owner/permission route coverage |
| Event metadata update | `/api/v1/dashboard/events/{event_id}/metadata` | Current user; service ownership/admin rule | dim_event | Store transaction | `QueryService._invalidate_event_cache_groups()` | `test_query_service_metadata.py` | Add route-level denial test |
| Program/version metadata update | `/api/v1/dashboard/program-version/metadata` | Current user; service ownership/admin rule | dim_event rows | Store transaction | `QueryService._invalidate_event_cache_groups()` | `test_query_service_metadata.py` | Add mixed-owner test if missing |
| Filter options update/reset | `/api/v1/dashboard/filter-options*` | Auth; status update admin-only; reset write/admin | schema/filter overrides | Store/service logic | filter-options cache invalidation | Unknown | Add route tests |
| Custom fields | `/api/v1/dashboard/custom-fields*` | Write/admin | custom field tables | Store/service logic | event/filter caches may apply | Unknown | Add service tests |
| Soft event delete | `/api/v1/upload/events/{event_id}`, `/events/delete` | Owner or admin | dim_event soft delete | Store transaction | Query service invalidates event caches | Unknown | Add route tests |
| Hard program/version delete | `/api/v1/upload/program-version/delete` | Write/admin plus all-data owner rule unless admin | events, measurements, artifacts, channel maps, files | Store hard delete; file deletion constrained by stored artifact paths | Event cache invalidation | Service tests exist | Add router ownership tests |
| Purge deleted events | `/api/v1/upload/events/purge-deleted` | Write/admin | deleted events, measurements | Store hard delete | Event cache invalidation | `test_admin_users_router.py` covers write/admin gate | Add data integrity tests |
| Parquet export/import | `/api/v1/export/*` | Admin | temp ZIPs, DuckDB data | `ExportService`; needs explicit failure tests | Full refresh needed after import | No dedicated router tests found | Add admin guard and failed import tests |

## Current Concurrency Controls

- `UnifiedStore` opens one shared DuckDB connection.
- Reads and writes are serialized through `_db_lock`.
- `write_connection()` starts a DuckDB transaction, commits on success, and rolls back on exception.
- `SimpleCache` uses a thread lock around get/set/invalidate operations.
- Export/import uses background task state and staged uploads.
- Uploads enforce max total upload bytes and reject mixed CSV/RSP batches.

## Existing Data-Safety Coverage

| Test file | Coverage |
|---|---|
| `tests/server/services/test_ingestion_service_status.py` | non-admin upload status, admin upload status, RSP conversion, mixed CSV/RSP rejection, pending channel-map artifact retention, channel-map processing, scope delete behavior |
| `tests/server/services/test_query_service_metadata.py` | event metadata ownership and derived ranges, program/version metadata summary |
| `tests/server/services/test_boundary_regressions.py` | regression tests around backend boundaries |
| `tests/server/routers/test_admin_users_router.py` | admin-user auth plus write/admin dependency coverage via purge endpoint |
| `tests/server/routers/test_upload_router.py` | upload scope-delete owner/admin route contract and event-cache invalidation |
| `tests/server/routers/test_auth_routes.py` | login/register/password behavior |

## Findings

## Finding: Failed import/export paths need explicit corruption tests

**Severity:** High

**Area:** Data / Testing

**Evidence:**
- File: `server/routers/export.py`
- File: `server/services/export.py`
- Function/component/route: Parquet ZIP upload, validation, import, task status
- What the code currently does: implements staged upload and admin-only import/export, but no dedicated router tests were found.

**Why this matters:**
Import can replace or alter the database. A failed import must not damage the current DB.

**Recommended fix:**
Add tests for invalid ZIP validation, failed import rollback/non-replacement, and admin guard behavior.

**TDD slice:**
Start with `test_normal_user_cannot_start_parquet_export`.

**Junior developer note:**
Treat import like a dangerous write. Validate first, replace last.

## Finding: Cache invalidation behavior should be tested as a contract

**Severity:** Medium

**Area:** Data / Cache / Testing

**Evidence:**
- File: `server/services/ingestion.py`
- File: `server/services/query.py`
- Function/component/route: `_invalidate_cache()`, `_invalidate_event_cache_groups()`
- What the code currently does: invalidates program/version/events/event-count and filter-option prefixes after selected mutations.

**Why this matters:**
Stale caches can make a successful write look broken or make deleted data remain visible.

**Recommended fix:**
Add focused tests that mutations invalidate the expected cache prefixes.

**TDD slice:**
Seed a cache key, perform a metadata write or upload completion, then assert the key is gone.

**Junior developer note:**
If a write changes what a page reads, the cache for that read needs to be refreshed.

## Finding: Filesystem and DB writes cross a boundary

**Severity:** Medium

**Area:** File IO / Data

**Evidence:**
- File: `server/services/ingestion.py`
- File: `server/storage/database.py`
- Function/component/route: upload artifact retention and hard delete
- What the code currently does: retains upload artifacts on disk and records paths in `ingestion_artifacts`; hard delete removes stored artifact paths.

**Why this matters:**
The database transaction cannot automatically roll back filesystem changes. Tests need to confirm failed writes either clean files or leave retained artifacts in a documented state.

**Recommended fix:**
Add failure-mode tests for upload artifact cleanup/retention and scope delete file removal.

**TDD slice:**
Force a parser failure after artifact creation and assert the database and files are in the expected state.

**Junior developer note:**
Databases can roll back rows. Files need explicit cleanup.

## Recommended Next Data-Safety Slices

1. Add failed upload/import non-corruption tests.
2. Add cache invalidation tests for metadata writes and upload completion.
3. Add session route tests for user-scoped session access.

