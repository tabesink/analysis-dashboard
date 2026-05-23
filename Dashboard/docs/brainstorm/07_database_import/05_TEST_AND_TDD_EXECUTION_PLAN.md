# Test And TDD Execution Plan

## Testing Philosophy

Test behavior through public interfaces. Do not lock tests to private helper functions or background-thread internals unless there is no public boundary for the behavior.

Use vertical slices:

1. Write one failing behavior test.
2. Implement the smallest change that makes it pass.
3. Refactor only while green.
4. Move to the next behavior.

Avoid writing the whole test suite first. Each test should respond to what the previous slice taught you.

## Public Interfaces To Prefer

Server behavior:

- FastAPI routes in `Dashboard/server/routers/export.py`.
- `ExportService` only where route-level setup would hide the behavior being tested.
- `UnifiedStore.export_to_parquet()` and `UnifiedStore.import_from_parquet()` for storage-level replacement and rollback rules.

Client behavior:

- `exportApi` methods as the HTTP contract boundary.
- `DatabasePage` or `DatabaseSidePanel` for visibility and role behavior.
- `useDatabaseOperation()` only when testing modal flow that is hard to observe through a page.

Operator behavior:

- Export ZIP can be produced.
- ZIP can be imported into another target database.
- Target data matches source data after import.
- Failed import does not destroy target data.

## Slice 1: Server Round Trip

Behavior: an exported ZIP from one populated database can be imported into another database and the target exposes the source events.

Suggested test location:

- `Dashboard/tests/server/services/test_export_service.py` or a new integration test file next to it.

RED:

- Create source `UnifiedStore`.
- Insert a small realistic event.
- Export to Parquet directory and ZIP it.
- Create target `UnifiedStore` with different existing data.
- Validate and import the ZIP through `ExportService`.
- Assert the target contains source event data after import.
- Assert old target-only data is gone.

GREEN:

- If current code passes, keep the test.
- If it fails because setup is awkward, improve test fixture ergonomics without changing product behavior.

Acceptance:

- Test proves replacement semantics and cross-store portability.

## Slice 2: Failed Replacement Preserves Usable Database

Behavior: if import fails during schema/load execution, the target database remains usable and original target data is still readable.

Suggested test location:

- `Dashboard/tests/server/storage/test_database_portability.py` or `test_export_service.py`.

RED:

- Create target database with an event.
- Build an import directory or ZIP that passes early validation but fails during `load.sql` execution.
- Start import.
- Assert import fails.
- Assert target event is still readable.

GREEN:

- Implement the smallest safe storage behavior.
- Preferred implementation direction: build imported DB at a temporary path first, run schema/load there, then atomically swap it into place only after success.
- Alternative: restore `dashboard.db.bak` on failure before returning error.

Acceptance:

- A failed import cannot leave the target database broken.
- Backup behavior remains documented and verified.

## Slice 3: Router-Level Upload Validation Contract

Behavior: admin upload returns validation details for a valid export ZIP and rejects invalid archives without staging them.

Suggested test location:

- `Dashboard/tests/server/routers/test_export_router.py`.

RED:

- Use a real minimal ZIP fixture instead of only the stubbed service.
- Assert missing `schema.sql` / `load.sql` returns `400`.
- Assert path traversal returns `400`.
- Assert successful upload returns `upload_id`, event count, table list, and schema compatibility fields.

GREEN:

- Keep route behavior clear.
- If dependency overrides hide too much, add a separate non-stub route test module.

Acceptance:

- Route contract reflects the behavior operators see through API and UI.

## Slice 4: Compatibility Decision

Behavior: schema differences are handled by an explicit policy.

Current state:

- `is_compatible` is always `true`.
- Version and filter-column differences become warnings.

RED:

- Create one test for the desired policy.
- If mismatches should warn only, assert the warning text and keep `is_compatible: true`.
- If mismatches should block import, assert upload returns a validation response that prevents confirmation or returns `400`.

GREEN:

- Implement only the selected policy.

Acceptance:

- Junior developers and operators can tell when imports are allowed, warned, or blocked.

## Slice 5: Server Cache Freshness After Import

Behavior: after a successful import, normal dashboard reads return imported data rather than stale data.

RED:

- Prime a dashboard/filter query.
- Import a ZIP with different event/filter data.
- Call the same public query again.
- Assert returned data reflects the imported database.

GREEN:

- Invalidate relevant server cache on successful import if needed.
- Keep client query invalidation as a separate concern.

Acceptance:

- API-only import and UI import both refresh backend-visible data.

## Slice 6: Client API Contract

Behavior: `exportApi` calls the expected URLs with credentials and methods.

Suggested test location:

- New `Dashboard/client/src/lib/api/export.test.ts`.

RED:

- Mock `fetch` and `postFormDataWithProgress`.
- Assert `getDatabaseInfo`, `startParquetExport`, `getParquetTaskStatus`, `downloadParquetExport`, `startParquetImport`, cancel upload, and cancel task use current route paths.

GREEN:

- Add tests without changing API behavior unless a mismatch appears.

Acceptance:

- Future route renames break tests near the client contract.

## Slice 7: Admin UI Visibility

Behavior: when product decides to expose portability, admins can see controls and non-admin writers cannot.

RED:

- Render the Database page or side panel with admin user state and assert Export Load Data and Import Load Data are visible.
- Render with writer user state and assert the controls are absent or disabled with clear text.

GREEN:

- Re-enable `DatabaseSection` only for admins.
- Keep backend admin guard.

Acceptance:

- Feature discoverability is intentional and role-safe.

## Slice 8: Modal Import/Export Flow

Behavior: the modal guides an admin through export progress, upload validation, confirmation, task polling, cancellation, and completion.

RED:

- Test one modal path at a time.
- Start with import upload success leading to confirmation state.
- Then test confirm import leading to completion state.
- Then cancellation behavior for staged upload.

GREEN:

- Use mocked `exportApi`.
- Avoid testing internal state names unless visible behavior depends on them.

Acceptance:

- Important user-facing states are covered without coupling to every hook setter.

## Manual Smoke Tests

Run these after the automated slices are green:

- Admin source export downloads `dashboard_export.zip`.
- Target import of that ZIP completes.
- Target Dashboard page shows source events.
- Target Database page table shows source program/version rows.
- Non-admin cannot access `/api/v1/export/database/info`.
- Path traversal ZIP is rejected and target data remains readable.
- Failed import fixture leaves target data readable.

## Do Not Start With These

These are useful later, but they are not the tracer bullet:

- Refactoring task state out of process memory.
- Building an admin CLI.
- Rewriting the modal.
- Changing export format.
- Adding merge import.

Those changes have larger product and operational tradeoffs. Prove the current public behavior first.

