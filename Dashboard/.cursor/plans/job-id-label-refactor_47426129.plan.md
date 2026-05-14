---
name: job-id-label-refactor
overview: Refactor the upload/database UI labels and table columns without changing the DuckDB schema or moving any existing data. The internal API/database names remain `program_id`, `job_number`, and `work_order`, but the user-facing labels become Job ID, Program ID, and Work Order according to the confirmed mapping.
todos:
  - id: upload-labels
    content: Update upload required field labels, order, validation copy, and payload mapping comments without changing API keys.
    status: completed
  - id: database-columns
    content: Change the database tree header to Job ID and add Work Order and Program ID columns in the requested order.
    status: completed
  - id: copy-sweep
    content: Sweep related frontend copy/comments for Program ID vs Job ID consistency on database upload/table surfaces.
    status: completed
  - id: verify
    content: Run lint/typecheck or targeted frontend validation and summarize any residual risks.
    status: completed
isProject: false
---

# Job ID Label Refactor

## Decision Summary

- No DuckDB schema migration is needed. Existing uploaded data will not be rewritten.
- Keep `program_id` as the internal key for grouping, indexes, channel maps, cache keys, and API calls.
- Present `program_id` to users as **Job ID**.
- Present `job_number` to users as **Program ID**.
- Present `work_order` as **Work Order** in the database page table, immediately to the right of Job ID and before Program ID.

The current schema already has the needed columns in [docs/database-schema.txt](docs/database-schema.txt): `dim_event.program_id`, `dim_event.job_number`, and `dim_event.work_order`. Because this is label-only, it will not corrupt uploaded data or require backups/migration scripts.

## Implementation Steps

1. Update upload-form labels and validation copy in [client/src/components/upload/UploadDataSection.tsx](client/src/components/upload/UploadDataSection.tsx) and [client/src/app/database/page.tsx](client/src/app/database/page.tsx).
  - `filters['Program ID']` can remain the internal form key or be carefully renamed to a UI constant, but it must still populate `UploadMetadata.program_id`.
  - `filters['Job Number']` should become the user-facing **Program ID** field while still populating `UploadMetadata.job_number`.
  - Toasts and missing-required-field order should use the new labels.
2. Add database-table columns in [client/src/app/database/page.tsx](client/src/app/database/page.tsx).
  - Change the sticky tree/header label from **Program ID** to **Job ID** for the existing first/grouping column.
  - Add visible static columns for `work_order` labeled **Work Order** and `job_number` labeled **Program ID**.
  - Order them as: **Job ID**, **Work Order**, **Program ID**, then the existing metadata/status columns.
3. Keep [client/src/components/upload/DatabaseEventTree.tsx](client/src/components/upload/DatabaseEventTree.tsx) structurally unchanged except for comments/copy if needed.
  - It should still group by `dataset.program_id` and `programVersions.program_id`.
  - Only the displayed column header changes to **Job ID**; the internal grouping stays stable.
4. Sweep nearby frontend copy for consistency.
  - Update comments/tooltips/validation strings that expose **Program ID** for the internal key on the database upload page.
  - Avoid changing dashboard grouping, channel-map behavior, or backend model names.
5. Verify without migration.
  - Run frontend lint/typecheck if available.
  - Manually verify the database page shows existing rows with old `program_id` values under **Job ID**, existing `work_order` under **Work Order**, and existing `job_number` under **Program ID**.
  - Upload a small test dataset and confirm payload still sends `program_id`, `job_number`, and `work_order` to the backend.

## Why This Is Recommended

This gives you the desired UI semantics with the lowest data risk. A full database key migration would need to rewrite `dim_event`, `dim_program`, `dim_channel_map`, `custom_field_allowed_values`, preferences, sessions, caches, and portable import/export behavior. Since you chose a label-only change, keeping the internal key stable avoids breaking existing uploads and channel maps while still making the frontend match the new terminology.