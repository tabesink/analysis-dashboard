---
name: db-zst portability
overview: Add optional `.db.zst` export/import support on top of the existing DuckDB portability flow, while preserving plain `.db` as the default and fully supported path. Normalize the backend to always export from a checkpointed snapshot, detect/decompress compressed uploads server-side, and extend the frontend picker/API wiring to handle both formats cleanly.
todos:
  - id: task-docs
    content: Add a new Phase 7 task entry plus implementation notes for compressed DB portability work.
    status: completed
  - id: backend-format-layer
    content: Add `zstandard` and refactor `ExportService`/export router to support snapshot-based `.db` and `.db.zst` export plus compressed import validation/materialization.
    status: completed
  - id: frontend-format-support
    content: Extend the export API and database page UI to choose export format, preserve filenames, and accept `.db.zst` imports without breaking default `.db` behavior.
    status: completed
  - id: verification-docs
    content: Add targeted export/import tests, verify lint/type checks, and document the architecture decision and updated portability contract.
    status: completed
isProject: false
---

# Add `.db.zst` Export/Import Support

## Goal

Preserve the current plain `.db` workflow, add optional compressed `.db.zst` export/import, and keep the storage layer operating only on plain DuckDB files.

## Current Leverage

- [server/storage/database.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/storage/database.py) already has the right plain-file primitives: `export_to_file()` checkpoints then copies the DB, and `import_from_file()` replaces the active DB from a plain `.db` path.
- [server/routers/export.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/export.py) currently bypasses that safer snapshot path and serves the live file directly from `GET /database`.
- [server/services/export.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/services/export.py) is the clean extension point for format detection, temp-file lifecycle, compression/decompression, and validation orchestration.
- [client/src/app/database/page.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/app/database/page.tsx) already preserves user activation for Save As; keep that flow and make format selection additive.

## Implementation Plan

1. Add a new task entry and implementation note before code changes.
  - Update [docs/master-build-plan.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/master-build-plan.md) with a new Phase 7 portability subtask for compressed DB export/import.
  - Create a task note under [docs/tasks](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/tasks/) describing the chosen `.db` + `.db.zst` contract.
2. Add a small backend compression dependency and keep compression server-side.
  - Add `zstandard` to [server/pyproject.toml](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/pyproject.toml).
  - Avoid client-side compression/decompression so the browser only uploads/downloads files; the server stays authoritative for validation and format handling.
3. Refactor the backend export service into format-aware orchestration without changing `UnifiedStore` semantics.
  - In [server/services/export.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/services/export.py), introduce helpers along these lines:
  - `detect_import_format(filename, bytes) -> db | db.zst`
  - `materialize_import_db(...) -> temp .db path`
  - `create_export_artifact(format) -> temp file path + filename + media type`
  - Keep [server/storage/database.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/storage/database.py) plain-file only: `.db.zst` should be decompressed to a temp `.db` before calling `import_from_file()` and compressed only after calling `export_to_file()`.
  - Add compressed-size and decompressed-size guards so a small `.zst` upload cannot expand beyond the intended import limit.
  - Reuse the existing validation/import path after decompression so `.db` and `.db.zst` share the same schema checks and replacement behavior.
4. Normalize the export router to use snapshot-based exports for both formats.
  - Update [server/routers/export.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/export.py) so `GET /api/v1/export/database` accepts a `format` query param with a default of plain `.db`.
  - Return server-selected filename/content-type for `dashboard.db` vs `dashboard.db.zst`.
  - Use `BackgroundTasks` to clean up temp export artifacts after `FileResponse` is sent.
  - Pass upload filename/content type into validate/import service methods so `.db.zst` detection is based on extension plus bytes, not MIME alone.
5. Expand import validation and import endpoints to support compressed uploads safely.
  - Keep the same endpoints and modal flow in [server/routers/export.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/export.py).
  - Accept both `.db` and `.db.zst` as additive formats; imported compressed files should still replace the active database exactly like plain `.db` imports.
  - Preserve the existing backup behavior (`dashboard.db.bak`) and current schema metadata refresh, but clear any process cache after a successful import so the app does not serve stale results from the previous DB contents.
6. Extend the frontend API layer to preserve server-selected file metadata.
  - In [client/src/lib/api/export.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/lib/api/export.ts), change `exportDatabase()` from `Promise<Blob>` to a richer response that includes the blob plus the server filename from `Content-Disposition`.
  - Add a `format: 'db' | 'db.zst'` parameter to the export request.
  - Keep validate/import methods unchanged except for supporting `.db.zst` uploads transparently.
7. Add minimal, non-breaking UI support for choosing export format and importing compressed files.
  - In [client/src/app/database/page.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/app/database/page.tsx), keep plain `.db` as the default export path and add an explicit compressed option rather than guessing from the filename.
  - Update the Save As picker types and fallback download filename to match the chosen format.
  - Widen the import file input from `.db` to `.db,.db.zst`.
  - Keep [client/src/components/upload/ImportConfirmationModal.tsx](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/upload/ImportConfirmationModal.tsx) mostly unchanged, with only copy tweaks if needed to mention compressed DB support.
8. Add targeted backend coverage for both portability formats and a small frontend sanity pass.
  - Add/extend backend integration tests under [tests/server](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/tests/server/) to cover:
  - export plain `.db`
  - export `.db.zst`
  - validate compressed upload
  - import compressed upload replaces active DB and creates backup
  - decompressed-size rejection / invalid compressed payload handling
  - Run backend lint/types plus frontend lint/build to verify the changed API/UI wiring.
9. Document the new portability contract.
  - Append a decision entry to [docs/decisions/log.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md) explaining why compression lives in `ExportService` rather than `UnifiedStore`.
  - Update user-facing portability references in [docs/prd.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/prd.md) and, if touched during implementation, the existing UX plan/docs to mention support for both `.db` and `.db.zst`.

## Verification

- Exporting with default settings still downloads `dashboard.db` and uses the safer checkpointed snapshot path.
- Exporting with compressed format downloads `dashboard.db.zst` and can be decompressed/imported back into the app.
- Import accepts both `.db` and `.db.zst`, validates them before replacement, and still creates `dashboard.db.bak`.
- A successful import clears stale in-process cache and the Database/Dashboard views refresh against the new DB contents.
- Existing `.db` consumers are unaffected because the backend storage layer and default UI path remain plain `.db`.

