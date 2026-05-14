---
name: channel map pending uploads
overview: Implement durable uploads without channel_map.yaml by storing managed CSV artifacts, showing missing-map warnings, and adding a fixed 8-plot channel-map editor that automatically processes pending files when saved.
todos:
  - id: schema-artifacts
    content: Design DB schema and managed artifact storage for pending/reprocessable uploads.
    status: completed
  - id: missing-map-ingest
    content: Refactor ingestion to persist missing-map uploads and keep normal mapped uploads unchanged.
    status: completed
  - id: channel-map-api
    content: Add channel-map read/save/process APIs with ownership checks and cache invalidation.
    status: completed
  - id: database-tree-ui
    content: Show warning icons in the Database hierarchy using new channel-map status fields.
    status: completed
  - id: channel-map-editor
    content: Replace the Custom Fields placeholder with the two-panel fixed 8-plot editor and preview.
    status: completed
  - id: dashboard-disable
    content: Show unmapped program/versions in the Dashboard tree as disabled gray rows.
    status: completed
  - id: portable-artifacts
    content: Include managed artifacts in export/import and verify restoration.
    status: completed
  - id: tests-docs
    content: Add focused backend/frontend coverage and update required project docs.
    status: completed
isProject: false
---

# Channel Map Pending Uploads Plan

## Resolved Product Behavior

- Uploads with `channel_map.yaml` keep the current extraction and insertion workflow.
- Uploads without `channel_map.yaml` are accepted as durable pending uploads:
  - `.rsp` files are still converted to CSV first.
  - The original/converted CSV artifact is stored under a managed filesystem data directory.
  - DB rows track program, version, owner, pending status, source filename, artifact path, preview metadata, and processing errors.
- Pending program/versions appear in the Database hierarchical table with a subtle red exclamation-in-circle icon beside the version; the program row rolls up the same icon when any child version is missing a map.
- Pending program/versions appear in the Dashboard load-data tree but are grayed out and cannot be selected for plotting.
- The Edit Filters page replaces the placeholder Custom Fields tab with a fixed 8-plot Channel Map editor.
- The editor uses zero-based numeric indexes, validates strictly against the preview CSV, saves the channel map, then automatically processes all pending files for that program/version.
- Existing channel maps can be edited. Because artifacts are retained indefinitely, saving a changed map can reprocess existing files where artifacts are available.
- Reprocessing is partial-success: successful files become available; failed files remain pending with error details.
- Managed artifacts are included in portable export/import bundles.

## Backend Design

- Add durable pending-upload storage to [server/storage/database.py](server/storage/database.py) and update [docs/database-schema.txt](docs/database-schema.txt).
  - Create a table such as `pending_upload_artifacts` or `ingestion_artifacts` with `artifact_id`, `program_id`, `version`, `source_file`, `artifact_path`, `artifact_kind`, `file_hash`, `row_count`, `preview_json`, `status`, `error`, `owner_user_id`, timestamps, and optional `event_id` when processed.
  - Keep `dim_channel_map` as the source of truth for saved maps.
  - Add idempotent migrations in `_init_schema` and store artifact paths relative to the managed data root.
- Refactor [server/services/ingestion.py](server/services/ingestion.py) so missing channel maps no longer return `channel_map.yaml is required` after normalization.
  - Continue `_normalize_files` so RSP conversion still runs.
  - Parse CSV enough to validate/store row count and capture the first 20 raw/CSV lines for preview.
  - Persist artifacts and pending rows, then return a successful upload task result that indicates `pending_channel_map`.
  - Preserve current full ingestion path when `channel_map_content` exists.
- Add a reusable processing service for artifacts.
  - Given `(program_id, version, channel_map)`, load retained artifacts, run the existing parser/validator/transformer/downsampler path, write `dim_event`, `measurements_raw`, and `measurements_lttb`, and update artifact status.
  - Reuse `ChannelMapLoader` semantics from [server/services/etl/channel_map.py](server/services/etl/channel_map.py), but build map payloads from the fixed editor entries.
  - Enforce strict validation before processing: exactly the fixed 8 plot keys, numeric zero-based indexes, and referenced columns within the preview CSV column count.
- Expose channel-map and pending-artifact APIs in [server/routers/dashboard.py](server/routers/dashboard.py) or a closely related router.
  - Read: program/version channel-map status, current map entries, pending artifact summaries, and first-file preview lines.
  - Write: save/update fixed 8-row channel map for a program/version and enqueue or run automatic processing.
  - Permission: admin or write-enabled owner of the relevant uploaded artifacts/program-version.
  - Invalidate affected caches after map save and processing.
- Extend dataset/event query surfaces.
  - [server/services/upload_query.py](server/services/upload_query.py): include `has_channel_map`, `missing_channel_map`, and pending/error counts in `ProgramVersionSummary` for the Database tree.
  - [server/services/query.py](server/services/query.py): include unmapped pending program/versions in the Dashboard load-data source, marked disabled/non-selectable, without returning them as selectable plot events.
- Update portable export/import.
  - Extend the existing Parquet ZIP export/import flow to include managed artifact files plus metadata.
  - On import, restore artifact files under the managed data root and rehydrate DB references.

## Frontend Design

- Relax upload gating in [client/src/components/upload/UploadDataSection.tsx](client/src/components/upload/UploadDataSection.tsx) and [client/src/app/database/page.tsx](client/src/app/database/page.tsx).
  - Allow CSV/RSP uploads without a channel map.
  - Update copy so `channel_map.yml` is truly optional.
  - On completion, show success-with-action messaging when files are pending channel-map setup.
- Add missing-map indicators to [client/src/components/upload/DatabaseEventTree.tsx](client/src/components/upload/DatabaseEventTree.tsx).
  - Render a small destructive red exclamation-circle immediately left of affected version labels.
  - Roll up the icon to program labels when any child version is missing a map.
  - Surface tooltip text such as `Channel map required`.
- Replace the placeholder Custom Fields tab in [client/src/app/database/edit/page.tsx](client/src/app/database/edit/page.tsx).
  - Rename the tab to Channel Map unless you want to keep the old label temporarily.
  - Use the existing selected Program ID / Version controls.
  - Left panel: fixed 8-row editor for `bj_xy_force_plot`, `bj_xz_force_plot`, `shock_xy_force_plot`, `shock_xz_force_plot`, `bushing_f_xy_force_plot`, `bushing_f_xz_force_plot`, `bushing_r_xy_force_plot`, `bushing_r_xz_force_plot`, each with `x_col` and `y_col` zero-based numeric inputs.
  - Right panel: first 20 lines from the first CSV artifact for that program/version.
  - Use table styling cues from [.references/client-side-table-code](.references/client-side-table-code), especially sticky header, compact rows, and resize-friendly panel layout.
  - Save action validates strictly, calls the new API, then shows processing progress/results.
- Disable unmapped Dashboard selections.
  - Update [client/src/components/dashboard/side-panel/LoadDataSection.tsx](client/src/components/dashboard/side-panel/LoadDataSection.tsx) and [client/src/components/dashboard/shared/HierarchicalEventTree.tsx](client/src/components/dashboard/shared/HierarchicalEventTree.tsx) so pending/unmapped program versions are visible, muted/gray, and not selectable.
  - Prevent batch/program-level selection from selecting disabled child versions.
- Add API/types support.
  - Extend [client/src/lib/api/upload.ts](client/src/lib/api/upload.ts), [client/src/lib/api/dashboard.ts](client/src/lib/api/dashboard.ts), [client/src/types/upload.ts](client/src/types/upload.ts), and [client/src/types/api.ts](client/src/types/api.ts) for channel-map status, pending artifact preview, disabled dashboard rows, and save/reprocess responses.

## Verification

- Backend tests:
  - Missing channel-map CSV upload creates pending artifact rows and does not write measurement rows.
  - Missing channel-map RSP upload runs conversion, stores converted CSV artifact, and creates pending rows.
  - Saving a valid fixed 8-plot map processes pending files into events/measurements.
  - Strict validation rejects missing plots, non-numeric columns, and out-of-range zero-based indexes.
  - Partial processing preserves failed files as pending with errors.
  - Export/import preserves managed artifacts and DB references.
- Frontend tests or manual checks:
  - Upload panel allows no-map uploads and shows pending-channel-map completion messaging.
  - Database tree shows version and program rollup warning icons.
  - Channel Map tab loads preview, validates inputs, saves, and displays processing results.
  - Dashboard load-data tree shows unmapped versions grayed out and unselectable.

## Documentation Updates

- Mark the selected implementation task in [docs/master-build-plan.md](docs/master-build-plan.md) as in progress/done during execution.
- Add an architectural decision to [docs/decisions/log.md](docs/decisions/log.md) for filesystem-managed retained artifacts and export/import portability.
- Add task notes under [docs/tasks/](docs/tasks/) for the pending-channel-map upload workflow.

