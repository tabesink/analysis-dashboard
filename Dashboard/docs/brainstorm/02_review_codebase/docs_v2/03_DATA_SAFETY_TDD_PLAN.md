# Data Safety TDD Plan

## Goal

Protect the app from data corruption and cross-user mistakes during uploads, metadata edits, export/import, deletes, and cache invalidation.

## Public Interfaces

Prefer these surfaces for tests:

- HTTP routes in `server/routers/upload.py`, `server/routers/export.py`, and `server/routers/dashboard.py`
- Service behavior in `server/services/ingestion.py`, `server/services/export.py`, `server/services/query.py`, and `server/services/custom_fields.py`
- Store behavior in `server/storage/database.py`
- Cache behavior in `server/utils/cache.py`

## Slice A: Write-Path Inventory

### Behavior To Confirm

Every write path has an owner/admin boundary, rollback story, and cache invalidation story.

### RED

No code test first. The first failing artifact is a missing table in `CONCURRENCY_AND_DATA_SAFETY_REVIEW.md`.

Create a write-path inventory with:

- route or service
- data written
- auth dependency
- ownership rule
- transaction or rollback behavior
- cache invalidation
- existing tests

### GREEN

Fill the table from evidence in:

- `server/routers/upload.py`
- `server/routers/dashboard.py`
- `server/routers/export.py`
- `server/routers/session.py`
- `server/services/ingestion.py`
- `server/services/query.py`
- `server/services/export.py`
- `server/storage/database.py`

### Done When

- High-risk writes have named follow-up slices.
- Unknown behavior is marked as unknown instead of guessed.

## Slice B: Upload Failure Does Not Corrupt Existing Data

### Behavior To Confirm

A failed upload/import leaves existing events, measurements, artifact rows, and cache state consistent.

### RED

Add or extend tests near:

- `tests/server/services/test_ingestion_service_status.py`
- `tests/server/services/test_boundary_regressions.py`

Test one failure mode at a time, such as invalid CSV, missing channel map branch, or parser failure.

### GREEN

Adjust only the smallest necessary path in:

- `server/services/ingestion.py`
- `server/storage/database.py`
- `server/routers/upload.py`

### REFACTOR

If rollback logic is duplicated, extract a narrow helper inside the service or store.

### Done When

- Existing data remains visible after failed import.
- Partial artifacts are cleaned or explicitly retained with status metadata.
- Relevant cache keys are invalidated only when state changes.

## Slice C: Scope Delete Ownership

### Behavior To Confirm

Admins can delete any selected scope, while write-enabled non-admin users can delete only scopes fully owned by them.

### RED

Extend tests near `tests/server/services/test_ingestion_service_status.py` or add router tests for `server/routers/upload.py`.

Cover:

- admin delete succeeds
- owner delete succeeds
- mixed ownership delete returns 403
- pending-only version can be deleted

### GREEN

Adjust:

- `server/routers/upload.py`
- `server/services/ingestion.py`
- `server/storage/database.py`

### REFACTOR

Keep the ownership rule in one backend-owned location. Do not rely on disabled frontend controls.

### Done When

- Tests cover live events and pending artifact-only rows.
- Cache invalidation happens after successful delete.

## Slice D: Export/Import Job Safety

### Behavior To Confirm

Export/import jobs are admin-only, status is isolated per job, and temporary files are constrained to managed paths.

### RED

Add tests around `server/services/export.py` and `server/routers/export.py`.

Focus on:

- invalid import package is rejected before replacing data
- failed import does not replace current DB
- status polling cannot expose unrelated local files

### GREEN

Adjust:

- `server/services/export.py`
- `server/routers/export.py`
- `server/config.py`

### REFACTOR

Separate validation from replacement if the current flow makes failure states hard to test.

### Done When

- Portable import/export remains Parquet ZIP based.
- Tests can run without large fixture files.
- Managed artifact and temp roots are documented.

## Slice E: Cache Invalidation Contract

### Behavior To Confirm

Mutations invalidate the query cache prefixes that can show stale dashboard, database, or metadata results.

### RED

Add service tests for cache invalidation in:

- `tests/server/services/test_query_service_metadata.py`
- `tests/server/services/test_ingestion_service_status.py`

### GREEN

Adjust:

- `server/services/query.py`
- `server/services/ingestion.py`
- `server/utils/cache.py`

### REFACTOR

Use one cache-invalidation vocabulary. Avoid scattered literal prefixes if a helper already exists.

### Done When

- Metadata writes, upload completion, delete, and import replacement refresh affected reads.

## Verification Commands

```bash
cd server
uv run pytest ../tests/server/services/test_ingestion_service_status.py
uv run pytest ../tests/server/services/test_query_service_metadata.py
uv run pytest ../tests/server/services/test_boundary_regressions.py
```

Before completing a data-safety PR:

```bash
cd server
uv run pytest
uv run ruff check .
uv run mypy .
```

