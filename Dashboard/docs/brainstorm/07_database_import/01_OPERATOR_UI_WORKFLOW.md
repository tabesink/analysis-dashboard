# Operator UI Workflow

## Status Of The UI

The operator workflow is reachable for admins from the Database page side panel. Non-admin writers can still use upload controls, but they do not see load-data transfer controls.

The rest of the client workflow still exists:

- `DatabaseSection` defines the Export Load Data and Import Load Data buttons.
- `useDatabaseOperation()` starts export, opens the file picker for import, uploads the ZIP, polls tasks, and renders modal state.
- `DatabaseOperationModal` is still mounted from the Database page.
- The Database page checks admin role before calling export or import actions.

## Source System: Export

Use this flow after the UI is re-enabled for admins.

1. Open the source system in a browser.
2. Log in as `admin`.
3. Open the Database page.
4. In the side panel, find the Load Data Transfer section.
5. Select Export Load Data.
6. Wait while the modal shows the background export progress.
7. Save the generated ZIP as `dashboard_export.zip`.
8. Keep the ZIP in a secure transfer location. It contains uploaded load data and retained artifacts.

Expected behavior:

- The client first requests database info to estimate size.
- The client starts a background export task.
- The client polls task status every 2 seconds.
- When the task completes, the client downloads `dashboard_export.zip`.
- The server cleans up the temporary export artifact after download.

## Target System: Import

Use this flow on a fresh or replacement production host after deploy.

1. Open the target system in a browser.
2. Log in as `admin`.
3. Open the Database page.
4. In the side panel, select Import Load Data.
5. Pick the `dashboard_export.zip` created on the source system.
6. Wait for upload and validation.
7. Review the validation summary and warnings.
8. Type `IMPORT` to confirm import only when replacing all target load data is intended.
9. Wait for the import task to complete.
10. Refresh dashboard views and verify source data appears on the target.

Expected behavior:

- The import modal warns that the operation replaces target load data while preserving users and admin configuration.
- The client enforces the configured maximum ZIP size when it can read database info.
- The server streams the upload to disk and validates it before returning `upload_id`.
- Closing the modal before confirmation cancels the staged upload.
- Confirming import starts a background task and consumes the staged upload.
- On success, the previous target database file is copied to `dashboard.db.bak`.

## Admin And Role Expectations

Only admins can export or import load data. Writers can open the Database page for upload work, but the portability endpoints reject non-admin callers and the side-panel transfer controls are hidden for them.

## Manual Verification Checklist

Use this checklist when testing the UI flow:

- Admin can see Export Load Data and Import Load Data controls.
- Non-admin writer cannot see those controls.
- Export produces a ZIP named `dashboard_export.zip`.
- Import accepts the ZIP exported by another host.
- Import summary reports event count.
- Target admin account still works after import.
- Target saved filters and admin custom-field definitions remain intact.
- Target Database page, Dashboard page, filter options, and event catalog reflect imported data.
- A backup file exists next to the live database after import.
- Cancelling a staged upload removes it and does not replace the target database.

## UI Safety Notes

- The controls are admin-only in the side panel.
- Handler-level admin checks remain as defense in depth.
- The import action stays disabled until upload validation passes and the admin types `IMPORT`.

