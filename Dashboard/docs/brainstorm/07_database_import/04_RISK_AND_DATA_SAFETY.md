# Risk And Data Safety

## Risk Summary

Load-data import/export is powerful and should be treated like production data transfer. Export can disclose uploaded engineering data and retained artifacts. Import replaces the target system's load data, but preserves target users and admin configuration.

## Security Boundaries

### Admin Only

All `/api/v1/export/*` routes require `AdminRequiredDep`. This is the correct boundary because export/import can expose or replace load data.

Keep this invariant:

- No database portability endpoint should be callable by a writer or reader.
- Client UI visibility is not a security boundary.
- Backend admin checks must remain in place even if the UI hides controls.

### Sensitive Export Contents

The export includes events, measurements, channel maps, retained ingestion artifacts, and event-level custom-field values. It intentionally excludes target-local users, sessions, saved filters, audit history, and admin custom-field definitions.

Recommended handling:

- Store ZIPs only in approved secure locations.
- Avoid email or chat transfer.
- Delete temporary local copies after verification.
- Do not attach ZIPs to bug reports.
- Do not commit ZIPs to git.

## Destructive Import Behavior

Import is not additive and not merge-based. It replaces target load data.

Expected operator impact:

- Existing target events, measurements, channel maps, ingestion artifacts, and event custom-field values are removed unless they are present in the ZIP.
- Existing target users, sessions, saved filters, audit rows, and admin custom-field definitions remain.
- The target host receives the source load data, subject to current schema reconciliation.

UI and API docs should always use load-data replacement language. Avoid words like "sync" or "restore missing data" unless a future implementation actually supports that behavior.

## Backup Behavior

Before load-data replacement, `UnifiedStore.import_from_parquet()` copies the existing live database to `dashboard.db.bak`.

This is useful, but it is not a complete rollback strategy:

- The backup is a single fixed filename and can be overwritten by later imports.
- The load-data table replacement runs in a transaction, so failed loads leave target data readable.
- The backup is local to the target host and should not be treated as an off-host backup.

Recommended operator safeguard:

1. Take a host-level or volume-level backup before production import.
2. Keep the source export ZIP until target verification passes.
3. Verify `dashboard.db.bak` exists after import.
4. Do not run repeated imports without preserving older backups when rollback matters.

## Failure Modes

### Upload Or Validation Failure

The server streams uploads to disk and deletes temp files on validation errors. ZIP path traversal is guarded during validation.

Expected result: live database remains unchanged.

### Failed Import Before Replacement

Path traversal or invalid archive structure should fail before `UnifiedStore.import_from_parquet()` replaces the database.

Expected result: live database remains unchanged.

### Failed Import During Replacement

Failed imports should leave target load data and users readable.

Needed improvement:

- Keep behavior tests that simulate failure during load execution.
- Keep live-table replacement inside a transaction.
- Stage filesystem artifact replacement so artifacts are not swapped before database import succeeds.

## Large ZIP And Resource Risks

Current controls:

- Upload is streamed in chunks.
- Compressed upload size is capped by `max_upload_size_mb`.
- Import extraction uses safe path checks.
- Import task reports progress while extracting large files.

Gaps:

- Uncompressed ZIP size is not separately capped.
- ZIP validation extracts the archive once, and import extracts it again.
- Client download stores the ZIP as a `Blob`.
- Long-running imports block database access through the store lock.
- Background task state is in memory, so restart or multi-worker deployment can lose task state.

Recommended hardening:

- Add an uncompressed-size cap during validation.
- Document expected max database size for production.
- Avoid multi-worker deployment for this endpoint until task state is durable or externally coordinated.
- Consider streaming export download directly rather than buffering in the browser for very large databases.

## Cache And Freshness Risks

The client invalidates query caches after an import completes through the UI. That helps the active browser session.

Remaining risks:

- API-only import may not invalidate server-side caches if any are holding old query results.
- Other browser sessions rely on `/api/v1/sync/version` and query invalidation behavior.
- Import path refreshes `_schema_metadata`, but cache invalidation should be verified as a behavior, not assumed.

Recommended behavior test:

- After successful import, a normal dashboard query should return imported data and not stale pre-import data.

## Audit And Logging Notes

The server logs export start and export completion. Upload logs an import-start style event. `start_parquet_import()` currently logs "db import completed" when the background import task is only started. That message is misleading.

Recommended cleanup:

- Log import requested/started at route confirmation time.
- Log import completed only after `_run_import()` finishes successfully.
- Include task ID and event count in completion logs.

## Production Go/No-Go Guidance

Reasonable for controlled admin transfer when:

- Source and target versions are known.
- Operator has a separate backup.
- Import is tested in staging or on a disposable target.
- Admin understands target replacement semantics.

Not yet sufficient for unattended disaster recovery until:

- Cache invalidation after import is verified.
- Task/upload state is durable across server restarts.

