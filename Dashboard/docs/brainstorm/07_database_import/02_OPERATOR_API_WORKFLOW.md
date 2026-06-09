# Operator API Workflow

Use this workflow when validating the backend independently or automating a controlled transfer. These examples assume the app is reachable at `http://localhost:3000` and that authentication uses the normal admin login cookie.

Set a base URL:

```bash
BASE_URL="http://localhost:3000"
COOKIE_JAR="./admin-cookie.txt"
```

## Log In As Admin

Use the production admin password from `ADMIN_SECRET`.

```bash
curl -sS -c "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/v1/auth/login" \
  -d '{"username":"admin","password":"<ADMIN_SECRET>"}'
```

Do not commit the cookie jar or paste it into tickets.

## Inspect Current Database

```bash
curl -sS -b "$COOKIE_JAR" \
  "$BASE_URL/api/v1/export/database/info"
```

Expected response shape:

```json
{
  "path": ".../dashboard.db",
  "size_mb": 0.0,
  "event_count": 0,
  "program_count": 0,
  "max_upload_size_mb": 15000
}
```

## Export From Source

Start an export task:

```bash
curl -sS -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/v1/export/database/parquet/export/start"
```

The response contains `task_id`.

Poll until `status` is `completed`:

```bash
TASK_ID="<task_id>"

curl -sS -b "$COOKIE_JAR" \
  "$BASE_URL/api/v1/export/database/parquet/task/$TASK_ID"
```

Download the ZIP:

```bash
curl -sS -L -b "$COOKIE_JAR" \
  -o dashboard_export.zip \
  "$BASE_URL/api/v1/export/database/parquet/download/$TASK_ID"
```

Keep the file private. It contains uploaded load data and retained artifacts in portable form.

## Upload To Target

Log in to the target system as admin, using a target-specific `BASE_URL` and cookie jar. Then upload the source ZIP:

```bash
curl -sS -b "$COOKIE_JAR" \
  -F "file=@dashboard_export.zip;type=application/zip" \
  "$BASE_URL/api/v1/export/database/parquet/upload"
```

The response contains:

- `upload_id`, used to confirm import.
- `validation.valid`, expected to be `true`.
- `validation.event_count`, the number of non-deleted events detected in the export.
- `validation.schema_compatibility`, including schema version and filter-column warnings.

If you decide not to import after upload:

```bash
UPLOAD_ID="<upload_id>"

curl -sS -b "$COOKIE_JAR" \
  -X DELETE "$BASE_URL/api/v1/export/database/parquet/upload/$UPLOAD_ID"
```

## Import On Target

Start import:

```bash
UPLOAD_ID="<upload_id>"

curl -sS -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -X POST "$BASE_URL/api/v1/export/database/parquet/import/$UPLOAD_ID"
```

The response contains `task_id`.

Poll until `status` is `completed`, `failed`, or `cancelled`:

```bash
TASK_ID="<task_id>"

curl -sS -b "$COOKIE_JAR" \
  "$BASE_URL/api/v1/export/database/parquet/task/$TASK_ID"
```

Cancel a running task if needed:

```bash
curl -sS -b "$COOKIE_JAR" \
  -X DELETE "$BASE_URL/api/v1/export/database/parquet/task/$TASK_ID"
```

## Post-Import Checks

After completion:

1. Call `/api/v1/export/database/info` on the target and compare event/program counts.
2. Open the Dashboard page and verify expected events are visible.
3. Open the Database page and verify uploaded dataset rows and filters.
4. Check server logs for import errors.
5. Confirm `dashboard.db.bak` exists where the live database is stored.

## API Caveats

- Background task state is in-process. Restarting the server can lose task and staged-upload state.
- A completed export can be downloaded once; the server schedules cleanup after download.
- Import replaces target load data, not target users or admin configuration.
- Schema mismatch currently produces warnings rather than a hard block.
- Upload size is limited by `max_upload_size_mb`, but uncompressed ZIP size is not yet separately capped.

