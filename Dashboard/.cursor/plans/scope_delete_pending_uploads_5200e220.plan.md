---
name: scope delete pending uploads
overview: Extend Database table deletion so program/version rows can delete processed data and pending channel-map artifacts, including versions with no channel map and no event rows.
todos:
  - id: scope-delete-backend
    content: Add backend hard-delete program/version scope operation with ownership checks and artifact file removal.
    status: completed
  - id: scope-delete-api
    content: Expose typed upload API endpoint for program/version scope deletion and cache invalidation.
    status: completed
  - id: scope-delete-ui
    content: Update Database tree selection/delete flow so pending-only program/version rows are selectable and deletable.
    status: completed
  - id: scope-delete-tests-docs
    content: Add focused tests and document hard-delete scope semantics.
    status: completed
isProject: false
---

# Program/Version Delete for Pending Uploads

## Decisions Captured

- Database main table must allow deleting a whole Program ID or Version even when it has no channel map and therefore no `dim_event` rows.
- Deleting a program/version scope should hard-delete everything in that scope:
  - processed events
  - raw and LTTB measurements
  - event custom field values
  - retained pending/processed artifact rows
  - retained artifact CSV files
  - `dim_channel_map` rows
- For mixed ownership:
  - Admins can delete the full selected scope.
  - Write-enabled users can delete a scope only when they own everything in that scope.
  - If the selected scope contains another user's data, block the action and show a message requiring admin help.

## Backend Plan

- Add scope-delete store methods in `[server/storage/database.py](server/storage/database.py)`:
  - Compute ownership for `(program_id)` and `(program_id, version)` across both `dim_event.uploaded_by_user_id` and `ingestion_artifacts.owner_user_id`.
  - Return a preview/count summary before deletion: events, raw rows, LTTB rows, artifact rows, artifact paths, channel-map rows, owners.
  - Execute hard delete in one DB transaction for DB rows, then remove retained artifact files from the managed artifact directory.
  - Prefer a safe file-delete phase that only deletes paths registered in `ingestion_artifacts` and under the configured artifact root.
- Add API models in `[server/models/upload.py](server/models/upload.py)`:
  - `DeleteProgramVersionScopeRequest` with `program_id` and optional `version`.
  - `DeleteProgramVersionScopeResponse` with deleted counts and skipped/blocked reason fields.
- Add an authenticated write endpoint in `[server/routers/upload.py](server/routers/upload.py)`:
  - Example: `POST /api/v1/upload/program-version/delete`.
  - If admin, delete the full scope.
  - If writer, first verify full ownership; return `403` when mixed ownership is detected.
  - Invalidate upload/query/dashboard caches after successful delete.

## Frontend Plan

- Update Database tree selection in `[client/src/components/upload/DatabaseEventTree.tsx](client/src/components/upload/DatabaseEventTree.tsx)`:
  - Program/version checkboxes must represent scope selection, not only event IDs.
  - Pending-only versions with empty `eventIds` must still be selectable.
  - Track selected scope keys such as `program:00000` and `version:00000::00` separately from leaf event IDs, or normalize all selections into a typed selection object.
- Update Database page delete behavior in `[client/src/app/database/page.tsx](client/src/app/database/page.tsx)`:
  - If selected rows are event leaves only, existing bulk event delete can remain or be routed through the new endpoint.
  - If a selected item includes program/version scope, call the new scope-delete endpoint.
  - Confirmation copy should clearly say this permanently deletes processed data, channel maps, retained artifacts, and files for the selected scope.
  - On `403` mixed ownership response, show a toast requiring admin help.
- Extend API/types in `[client/src/lib/api/upload.ts](client/src/lib/api/upload.ts)` and `[client/src/types/upload.ts](client/src/types/upload.ts)`:
  - Add typed request/response for scope delete.
  - Include pending artifact counts already exposed by `ProgramVersionSummary` in the confirmation summary when available.

## Verification

- Backend tests in `[tests/server/services/test_ingestion_service_status.py](tests/server/services/test_ingestion_service_status.py)` or a new upload delete test file:
  - Pending-only version can be deleted and removes artifact DB row plus retained CSV file.
  - Version with processed events deletes `dim_event`, measurements, channel map, and artifacts.
  - Program-level delete removes all versions under the program.
  - Writer is blocked on mixed ownership.
  - Admin can delete mixed ownership.
- Frontend checks:
  - Pending-only version row can be selected in Database table.
  - Delete button enables for pending-only version/program selection.
  - Confirmation copy reflects permanent scope deletion.
  - After delete, the program/version disappears from Database and Dashboard pending selectors.

## Documentation Updates

- Update `[docs/database-schema.txt](docs/database-schema.txt)` only if new persistent fields are added.
- Add a decision entry to `[docs/decisions/log.md](docs/decisions/log.md)` for hard-delete scope semantics.
- Add task notes under `[docs/tasks/](docs/tasks/)` for the scope delete implementation.

