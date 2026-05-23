# Concurrency and Data Safety Plan

## Goal

Ensure the application can safely support 5–10 local-network users at the same time without data corruption, inconsistent writes, or unsafe shared state.

This plan focuses on practical reliability for a small internal app.

## Key Review Areas

Review how the app handles:

- database reads
- database writes
- file writes
- uploads
- shared in-memory state
- caching
- user-specific data
- admin operations
- long-running tasks
- simultaneous requests

## Phase 1: Identify Persistence Model

### Tasks

Find out whether the app uses:

- SQLite
- Postgres
- MySQL
- local JSON files
- CSV files
- uploaded spreadsheets
- in-memory objects
- browser storage
- external services

### Output

Create a persistence map:

```markdown
| Data Type | Storage Location | Read By | Written By | Multi-user Risk |
|---|---|---|---|---|
```

## Phase 2: Review Write Paths

### Tasks

List every operation that writes or modifies data.

Examples:

- user creation
- password changes
- dashboard data upload
- CSV import
- spreadsheet processing
- record edits
- deletes
- settings changes
- report generation
- cache updates

### Questions

- Can two users perform this write at the same time?
- Is the write atomic?
- Is there a transaction?
- Is there file locking?
- Can partial writes corrupt data?
- Can one user overwrite another user's changes?
- Are admin-only writes protected?

## Phase 3: Evaluate Database Choice

### For 5–10 Local Users

SQLite can be acceptable when:

- writes are small and quick
- write frequency is low
- transactions are used correctly
- there are not many concurrent writes
- the database file is on a reliable local disk
- the app avoids long write locks

SQLite may become risky when:

- multiple users upload/process data at the same time
- long-running writes occur
- reports are generated while writes are happening
- the database is stored on a network drive
- write-heavy workflows become common

Postgres is better when:

- concurrent writes matter
- data integrity is important
- multiple processes access the database
- user roles and audit trails grow
- the app may later move beyond a local server

### Recommended Baseline

For this app:

- If the current app uses SQLite and write volume is low, it may be acceptable.
- If there are frequent imports/uploads or simultaneous edits, prefer Postgres.
- Do not migrate databases unless there is a clear data-safety reason.
- If using local JSON/CSV files for writes, strongly consider moving those write paths into a database or adding strict locking.

## Phase 4: Shared State Review

### Look For

- global mutable variables
- module-level caches
- in-memory user/session stores
- temporary files with fixed names
- shared upload directories
- background task state
- frontend state assumed to be authoritative

### Risks

Shared state can cause:

- user A seeing user B's data
- overwritten temp files
- stale dashboard values
- inconsistent calculations
- data loss during simultaneous uploads

### Recommended Fixes

- Use per-user or per-request IDs for temporary files.
- Avoid fixed filenames for uploaded files.
- Store persistent data in the database.
- Keep cache read-only or safely invalidated.
- Do not store important data only in memory.
- Use transactions for multi-step writes.

## Phase 5: Transactions and Atomicity

### For Database Writes

Use transactions for:

- creating related records
- imports
- user creation
- settings changes
- destructive operations
- multi-table updates

### For File Writes

Use safer file-write pattern:

1. write to temp file
2. flush/close file
3. atomically rename temp file to final filename
4. avoid two writers using the same filename

## Phase 6: Upload and Import Safety

If the app supports file uploads:

### Review

- allowed file types
- max file size
- upload directory
- filename handling
- overwrite behavior
- parsing failures
- partial import rollback
- admin-only upload access

### Recommended Baseline

- uploads should be admin-only
- never trust original filenames
- use generated filenames
- validate file extension and content type
- store upload metadata
- wrap imports in transactions
- show clear error messages when imports fail

## Phase 7: Concurrency Test Scenarios

Add simple tests or manual validation for:

1. two users logging in at the same time
2. two users loading the dashboard at the same time
3. admin uploading while user is viewing dashboard
4. two admins attempting conflicting writes
5. failed upload does not corrupt existing data
6. logout from one browser does not log out another user unless intended
7. user cannot access admin write routes directly

## Phase 8: Findings Format

```markdown
## Finding: Short title

**Severity:** Critical / High / Medium / Low / Nice-to-have

**Area:** Database / File IO / Uploads / State / Cache / API

**Evidence:**
- File:
- Function/route:
- Current behavior:

**Why this matters:**

**Recommended fix:**

**Junior developer note:**
```

## Priority Fixes

1. Identify all write paths.
2. Protect write routes with backend authorization.
3. Add transactions around multi-step writes.
4. Remove unsafe shared mutable state.
5. Make uploads/admin writes collision-safe.
6. Add simple concurrent-use tests.
