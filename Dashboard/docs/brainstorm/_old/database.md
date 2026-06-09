# Database notes

> **Canonical copy:** [`docs/notes/database.md`](../notes/database.md). This brainstorm note may lag behind shipped behavior.

## Runtime

- Single DuckDB file: `dashboard.db` (path from server settings / `data/`).
- Schema overview: [`docs/database-schema.txt`](../database-schema.txt).

### Connection model (`UnifiedStore`)

- All use of one `dashboard.db` file is serialized with a reentrant lock (`RLock`). Reads use read-write mode (not `read_only=True`) so DuckDB never sees mixed connection configurations on the same file.
- **One shared connection** for both reads and writes. `write_connection()` runs `BEGIN` / `COMMIT` on that connection instead of opening a second connection or closing the shared handle—closing while other threads still hold `read_connection` references caused DuckDB `bad_weak_ptr` errors.
- **`read_connection`** is a thin facade (`_GuardedConnection`): each `execute` defers work until `fetch*` runs, always under the lock. Per-thread `last_description` supports the common `execute` → `fetch*` → `read_connection.description` pattern safely.
- Background Parquet export/import still uses this store; long writes block other readers briefly. See `docs/decisions/log.md` (DEC-015, DEC-016).

## Admin portability (export / import)

- **Export:** Background job builds Parquet (ZSTD) per table + `schema.sql` + `load.sql`, then zips as `dashboard_export.zip`. Client polls `GET /api/v1/export/database/parquet/task/{task_id}` then downloads `GET .../parquet/download/{task_id}`.
- **Import:** `POST /api/v1/export/database/parquet/upload` (multipart ZIP, streamed) returns `upload_id` and validation payload. `POST .../parquet/import/{upload_id}` starts the import task. `DELETE .../parquet/upload/{upload_id}` drops a staged file if the user cancels.
- **Auth:** All of the above require admin; see `AdminRequiredDep` in `server/routers/export.py`.

Implementation pointers: `server/storage/database.py` (`export_to_parquet`, `import_from_parquet`), `server/services/export.py`, `client/src/lib/api/export.ts`, `client/src/app/database/page.tsx`.
