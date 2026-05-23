# Database Table Schema (Junior Dev Quick Guide)

Source: `server/schema.yaml`

## How to read this

- **Write path** = when rows are created/updated.
- **Read path** = when features depend on rows.
- Most relationships are **logical** (app-enforced), not strict DB foreign keys.

## Core data flow

1. CSV upload starts -> `ingestion_artifacts`, `upload_tasks`
2. Event metadata saved -> `dim_event`, `dim_program`
3. Raw signals stored -> `measurements_raw`
4. Plot config + downsampled data used -> `dim_channel_map`, `measurements_lttb`
5. User/session/filter state saved -> `sessions`, `saved_filters`, `user_preferences`

## Table-by-table

### `dim_program`
- **Why**: master list of programs.
- **Write path**: when a new program appears during ingestion/admin setup.
- **Read path**: program pickers and program-scoped filtering.
- **Key columns**: `program_id` (PK), `name`.

### `dim_event`
- **Why**: main metadata row per uploaded event file.
- **Write path**: CSV ingest, metadata edits, soft-delete (`is_deleted`), ownership updates.
- **Read path**: dashboard filtering, event lists, plot selection, ownership checks.
- **Key columns**: `event_id` (PK), `program_id`, `version`, filter columns (`status`, `rfq`, `dv`, `pv`, etc.), `uploaded_by_user_id`, `is_deleted`, `file_hash`.

### `dim_channel_map`
- **Why**: defines x/y channels per plot for each `(program_id, version, plot_key)`.
- **Write path**: when user/admin configures channel mapping.
- **Read path**: plot rendering and channel lookup.
- **Key columns**: `id` (PK), unique `(program_id, version, plot_key)`, `x_channel`, `y_channel`, scale/unit fields.

### `ingestion_artifacts`
- **Why**: keeps uploaded artifact metadata/files while mapping/reprocessing is pending.
- **Write path**: upload start, processing state changes (`status`), error capture.
- **Read path**: pending upload UI, retry/reprocess flows.
- **Key columns**: `artifact_id` (PK), unique `(program_id, version, file_hash)`, `artifact_path`, `status`, `owner_user_id`, `event_id`.

### `measurements_raw`
- **Why**: stores raw long-format time-series points.
- **Write path**: successful event ingestion.
- **Read path**: data processing, recomputation, source for derived plot datasets.
- **Key columns**: `id` (PK), `event_id`, `timestamp`, `channel_name`, `value`.

### `measurements_lttb`
- **Why**: stores downsampled points for fast plotting.
- **Write path**: post-ingestion/downsample job per `plot_key`.
- **Read path**: interactive chart rendering.
- **Key columns**: `id` (PK), `event_id`, `plot_key`, `x`, `y`.

### `upload_tasks`
- **Why**: tracks async upload progress state.
- **Write path**: upload lifecycle updates (`status`, `phase`, counts, errors).
- **Read path**: progress streaming/polling UI.
- **Key columns**: `task_id` (PK), `created_by_user_id`, `status`, `phase`, `expires_at`.

### `users`
- **Why**: authentication + authorization.
- **Write path**: user create/update/login metadata updates.
- **Read path**: login, role checks, write-permission checks.
- **Key columns**: `id` (PK), `username` (unique), `role`, `can_write`, `password_hash`.

### `sessions`
- **Why**: persists user session UI/data state.
- **Write path**: session create/update, state saves, expiry refresh.
- **Read path**: restoring user state after refresh/login.
- **Key columns**: `session_id` (PK), `user_id`, `data_state`, `global_filters`, `expires_at`.

### `saved_filters`
- **Why**: stores named filter presets.
- **Write path**: save/update/delete filter preset.
- **Read path**: loading presets in dashboard filters.
- **Key columns**: `id` (PK), `user_id`, `name`, `data_state`, `global_filters`, `is_default`.

### `user_preferences`
- **Why**: per-user persistent UI preferences.
- **Write path**: settings/preferences updates.
- **Read path**: initial UI setup (theme, layout, defaults).
- **Key columns**: `user_id` (PK), `default_program_id`, `grid_columns`, `theme`, `baseline_opacity`.

### `custom_field_definitions`
- **Why**: admin-defined metadata fields used in filtering.
- **Write path**: admin creates/edits/deletes custom fields.
- **Read path**: filter UI build + validation of custom field keys.
- **Key columns**: `field_key` (PK), `display_name` (unique), `data_type`, `is_filterable`.

### `custom_field_allowed_values`
- **Why**: allowed values for custom fields scoped by program.
- **Write path**: admin manages allowed value lists.
- **Read path**: dropdown options + validation for custom field values.
- **Key columns**: `id` (PK), unique `(field_key, program_id, value)`, `sort_order`.

### `event_custom_field_values`
- **Why**: stores actual custom field values per event.
- **Write path**: ingestion/metadata edit sets custom values for an event.
- **Read path**: filtering and event details display.
- **Key columns**: `id` (PK), unique `(event_id, field_key)`, `value`.

### `audit_log`
- **Why**: tracks important user/system actions.
- **Write path**: action logging for create/update/delete/import/export-like events.
- **Read path**: audit/debug/admin review.
- **Key columns**: `id` (PK), `action`, `user_id`, `event_id`, `details`, `timestamp`.

### `event_access_log`
- **Why**: tracks event read/access activity.
- **Write path**: when events are accessed in app flows.
- **Read path**: usage diagnostics and recent access queries.
- **Key columns**: `id` (PK), `event_id`, `access_type`, `partition`, `accessed_at`.

### `_schema_metadata`
- **Why**: runtime schema/filter metadata for compatibility and portability.
- **Write path**: schema/init/export/import metadata updates.
- **Read path**: startup checks and import/export compatibility logic.
- **Key columns**: `key` (PK), `value` (JSON), `updated_at`.

## What to be careful about

- `dim_event.is_deleted` means soft-delete; queries must exclude deleted rows unless intentionally auditing.
- `file_hash` is used for dedupe/identity in ingestion paths.
- Ownership columns (`uploaded_by_user_id`, `owner_user_id`, `user_id`) matter for multi-user access checks.
- JSON columns (`data_state`, `global_filters`, `metadata_json`, etc.) are app contracts; keep shape stable.
- `measurements_lttb` is derived data; if logic changes, regenerate from `measurements_raw`.
