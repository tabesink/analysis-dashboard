# Junior Developer Work Order

## Goal

Make load-data export/import safe, visible, and testable without changing the product shape unnecessarily. The current product shape is admin exports `dashboard_export.zip` on a source system, then admin imports that ZIP on a target system to replace load data while preserving target accounts and admin configuration.

Work in small vertical PRs. Each PR should include one behavior test, the smallest implementation change, and any doc adjustment needed for that behavior.

## Rules For This Work

- Do not change the export format unless a task explicitly says to.
- Do not introduce merge import.
- Do not remove backend admin guards.
- Do not expose UI controls to non-admin users.
- Do not treat `/api/v1/sync/version` as import/export.
- Do not refactor large parts of upload or dashboard state while working on portability.

## PR 1: Prove Round-Trip Portability

Question: can a ZIP exported from one store replace another store and expose the source data?

Steps:

1. Add a server integration test using public storage/service methods.
2. Insert one or two realistic source events.
3. Export source to Parquet ZIP.
4. Import into a target store that has different data.
5. Assert source events exist on target.
6. Assert target-only events are gone.

Acceptance:

- Test fails for real behavior if replacement breaks.
- Test documents full-replace semantics.
- No UI changes in this PR.

## PR 2: Protect Target DB On Failed Import

Question: what happens if import fails after the target has existing production data?

Steps:

1. Add one failing test that simulates schema/load failure during import.
2. Assert the original target event is still readable after failure.
3. Implement the smallest safe replacement strategy.
4. Keep `dashboard.db.bak` behavior or improve it deliberately.

Preferred implementation:

- Build the imported database at a temp path.
- Run schema/load against the temp DB.
- Close connections.
- Move current DB to backup.
- Atomically move temp DB into live path.
- If final swap fails, restore the original DB.

Acceptance:

- Failed import does not corrupt or remove the target database.
- Successful import still works.
- Existing path traversal tests still pass.

## PR 3: Make Validation Policy Explicit

Question: should schema mismatch warn or block?

Default recommendation:

- Keep mismatches as warnings for now because `_init_schema()` can reconcile additive schema changes.
- Document that this is compatibility warning, not proof of identical schemas.
- Make `is_compatible` meaningful if a future blocking condition exists.

Steps:

1. Add tests for legacy metadata, version mismatch, missing filter columns, and extra filter columns.
2. Assert the exact warning behavior expected by the UI.
3. Adjust `validate_import_zip()` only if tests reveal misleading output.

Acceptance:

- Operators can understand validation warnings.
- The client can display warnings without guessing.

## PR 4: Cover Client API Contract

Question: will the client call the right backend endpoints?

Steps:

1. Add `Dashboard/client/src/lib/api/export.test.ts`.
2. Mock `fetch` and `postFormDataWithProgress`.
3. Test each `exportApi` method path and HTTP method.
4. Verify credentials are included for `fetch` calls.

Acceptance:

- Route drift is caught by frontend tests.
- No behavior change unless a mismatch is discovered.

## PR 5: Re-Enable Admin UI Deliberately

Question: should admins be able to use the workflow from the Database side panel?

Steps:

1. Add a UI test for admin visibility when the frontend test stack supports component rendering.
2. Add a UI test or assertion for writer/non-admin hidden state.
3. Render `DatabaseSection` only when `isAdmin` is true.
4. Keep the existing admin checks inside `handleExportDatabase()` and `handleImportClick()`.
5. Update operator docs if the controls become visible.

Acceptance:

- Admins can reach Export Load Data and Import Load Data.
- Writers cannot see portability controls.
- Backend still rejects non-admin calls.

## PR 6: Cover Modal Happy Paths

Question: does the modal guide users through export and import without manual API calls?

Steps:

1. Test export start, progress, download, and completion summary with mocked API.
2. Test import upload validation, confirmation, task completion, and completion summary.
3. Test staged upload cancellation when the modal closes before confirmation.

Acceptance:

- UI behavior is covered at the user-visible level.
- Tests do not assert every hook setter or private state transition.

## PR 7: Promote Operator Docs

Question: where should production operators find the stable runbook?

Steps:

1. After implementation is verified, promote the relevant workflow from this brainstorm folder into stable docs.
2. Add a pointer from `Deployment/README.md` upgrade section to the stable database portability runbook.
3. Keep this brainstorm folder as the engineering audit/history.

Acceptance:

- Production deployment docs explain how to move data between hosts.
- Stable docs match tested behavior.

## Definition Of Done

The work is complete when:

- Admin source export and target import pass manual smoke testing.
- Round-trip and failed-import tests are automated.
- UI visibility is tested and intentional.
- API contract tests exist.
- Risk language in docs matches actual behavior.
- Deployment docs point operators to the final runbook.

## Review Checklist

Before asking for review, confirm:

- All new tests pass.
- No route lost `AdminRequiredDep`.
- No export ZIP fixture or production-like data was committed.
- Import still says it replaces target load data in user-facing copy.
- `dashboard_export.zip` remains the documented filename.
- The final docs do not promise merge, multi-worker durability, or automatic disaster recovery unless implemented.

