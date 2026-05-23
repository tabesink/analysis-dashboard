# Database notes

## Runtime

- Single DuckDB file: `dashboard.db` (path from server settings / `data/` volume in production).
- Schema overview: [`docs/database-schema.txt`](../database-schema.txt).
- Declared DDL: `server/schema.yaml` applied via `server/storage/schema_applier.py`.
- Startup path: `MigrationRunner.initialize_store_for_startup()` in `server/storage/migrations.py`.

### Connection model (`UnifiedStore`)

- All access to one `dashboard.db` file is serialized with a reentrant lock (`RLock`). Reads use read-write mode (not `read_only=True`) so DuckDB never sees mixed connection configurations on the same file.
- **One shared connection** for both reads and writes. `write_connection()` runs `BEGIN` / `COMMIT` on that connection instead of opening a second connection or closing the shared handle.
- **`read_connection`** is a thin facade (`_GuardedConnection`): each `execute` defers work until `fetch*` runs, always under the lock.
- Background Parquet export/import uses this store; long writes block other readers briefly. See `docs/decisions/log.md` (DEC-015, DEC-016).

### Multi-user coordination

- `_schema_metadata.data_version` is a monotonic counter incremented on committed write transactions.
- Clients poll `GET /api/v1/sync/version` (authenticated) and invalidate dashboard query caches when the version increases.
- Single-event metadata updates require `if_unmodified_since`; stale tokens return HTTP 409.

## Admin load-data portability (export / import)

This is **not** a raw `.db` download. Operators move **processed load data** between hosts while keeping target-local accounts and configuration.

### Export

- Background job writes load-data tables to Parquet (ZSTD), generates `schema.sql` + `load.sql`, zips as `dashboard_export.zip`.
- Client polls `GET /api/v1/export/database/parquet/task/{task_id}` then downloads `GET .../parquet/download/{task_id}`.
- **Included:** programs, events, channel maps, measurements, event custom-field values, schema metadata needed for compatibility checks.
- **Excluded:** users, sessions, saved filters, audit history, custom-field definitions/allowed values, pending `ingestion_artifacts`, and retained raw/converted CSV files under `managed_artifacts/channel-map`. See DEC-062, DEC-063.

### Import

- `POST /api/v1/export/database/parquet/upload` streams the ZIP to disk (up to 60 GiB compressed in production) and returns `upload_id` + validation.
- `POST .../parquet/import/{upload_id}` starts a background import after typed `IMPORT` confirmation in the UI.
- `DELETE .../parquet/upload/{upload_id}` drops a staged upload if the operator cancels.
- Import loads into an isolated `dashboard.db.staging` file, then atomically replaces the live database on success. A `dashboard.db.bak` backup is created first.
- Task status is persisted under `data/tmp/parquet-tasks` so polling survives API restarts.
- Unsafe ZIP member paths are rejected before extraction.
- Pending/no-channel-map uploads are not portable — complete channel-map setup before export or re-upload on the target.

### Auth

All portability endpoints require **admin**. Writers can upload CSV/RSP data on the Database page but cannot export or import load data.

## Implementation pointers

- Storage: `server/storage/database.py` (`export_to_parquet`, `import_from_parquet`)
- Service: `server/services/export.py`
- API: `server/routers/export.py`
- Client: `client/src/lib/api/export.ts`, `client/src/components/upload/DatabaseOperationModal.tsx`, `client/src/hooks/use-database-operation.ts`
- Operator guide: `Deployment/README.md` section "Import load data from another host"
