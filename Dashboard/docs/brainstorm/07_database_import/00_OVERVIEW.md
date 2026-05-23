# Load-Data Import/Export Overview

## Purpose

Load-data import/export is the app's portability path for moving uploaded engineering data from one host to another without replacing target admin accounts.

1. On the source system, log in as `admin`.
2. Open the Database page.
3. Use the side-panel load-data export control to download `dashboard_export.zip`.
4. On the target system, log in as `admin`.
5. Use the import control to upload that ZIP.
6. Type `IMPORT` to confirm replacement of target load data.
7. Confirm that the target system now has the source system's load data and still has its own admin users/configuration.

This is useful for LAN transfers, production host replacement, fresh production deployments, and controlled backup/restore testing.

## Current Status

The underlying feature is productized for admins.

- Backend endpoints exist under `/api/v1/export/*` and require admin access.
- The export format is a ZIP containing Parquet files, `schema.sql`, and `load.sql`.
- The client API, modal, hook, and side-panel controls are wired for admins.
- Import requires typed confirmation because it replaces target load data.
- Deployment docs point operators here for cross-host load-data transfer.

## What The Export Contains

The export is not a raw copy of the live DuckDB file. `UnifiedStore.export_to_parquet()` writes only load-data tables to compressed Parquet and generates SQL files that describe that portable subset:

- `dim_program.parquet`
- `dim_event.parquet`
- `dim_channel_map.parquet`
- `measurements_raw.parquet`
- `measurements_lttb.parquet`
- `event_custom_field_values.parquet`
- `schema.sql` for sequences, tables, and indexes.
- `load.sql` with `COPY` statements for the load-data Parquet files.
- `_schema_metadata.parquet`, when present, for schema version and filter metadata checks.

The export intentionally excludes target-local tables such as `users`, `sessions`, `saved_filters`, `audit_log`, `event_access_log`, `custom_field_definitions`, and `custom_field_allowed_values`. It also excludes pending channel-map artifact rows (`ingestion_artifacts`) and retained raw/converted CSV files under `managed_artifacts/channel-map`; pending upload work is source-local and must be completed before export or re-uploaded on the target.

## What The Import Does

Import is a load-data replace operation.

The server receives the ZIP, validates it, stores it as a staged upload, and returns an `upload_id`. Import starts only after confirmation. The background import task extracts the ZIP, finds `schema.sql` and `load.sql`, then calls `UnifiedStore.import_from_parquet()`.

`UnifiedStore.import_from_parquet()` copies the current database to `dashboard.db.bak`, validates that the archive contains only portable load-data tables, deletes target load-data rows in a transaction, inserts imported rows from Parquet, and refreshes `_schema_metadata`. Legacy archives that include `managed_artifacts` are accepted, but those files are skipped during extraction and are not restored on the target.

It does not merge records into the existing target load data. It preserves target users, sessions, saved filters, audit history, and admin-created custom-field definitions.

## Important Distinction: Sync Is Not Import/Export

`/api/v1/sync/version` is a separate endpoint used by logged-in clients to coordinate cache refreshes. It returns the monotonic `data_version` from `_schema_metadata`.

Do not describe this endpoint as database import/export. It is a cache coordination mechanism.

## Recommended Product Language

Use these terms consistently:

- "Load-data export" means admin creates `dashboard_export.zip`.
- "Load-data import" means admin uploads a prior export ZIP and replaces target load data.
- "Staged upload" means a ZIP that has been uploaded and validated but not yet imported.
- "Task" means the in-memory background export or import job identified by `task_id`.
- "Data version sync" means client cache invalidation polling, not data migration.

