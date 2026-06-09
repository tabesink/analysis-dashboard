# Discovery and Review Plan

## Goal

Create an evidence-backed map of the system before changing code. The output should be useful to a junior developer and specific enough for follow-on TDD slices.

## Deliverables

Create or update:

- `docs/refactor/CODEBASE_REVIEW.md`
- `docs/refactor/AUTH_AND_SECURITY_REVIEW.md`
- `docs/refactor/CONCURRENCY_AND_DATA_SAFETY_REVIEW.md`
- `docs/refactor/REFACTOR_PLAN.md`
- `docs/refactor/JUNIOR_DEV_CODEBASE_GUIDE.md`
- `docs/refactor/SMOKE_TEST_CHECKLIST.md`

## Phase 1: Repository Map

### Tasks

- Identify the frontend entry points, layouts, routes, and major feature areas.
- Identify backend app setup, routers, services, storage, and config loading.
- Identify test commands and existing test coverage.
- Identify docs that are source of truth for schema, decisions, and test strategy.

### Start With

- `client/src/app/layout.tsx`
- `client/src/app/providers.tsx`
- `client/src/components/layout/ClientLayout.tsx`
- `server/main.py`
- `server/config.py`
- `server/dependencies.py`
- `server/storage/database.py`
- `docs/database-schema.txt`
- `docs/test-strategy.md`
- `docs/decisions/log.md`

### Output

Add a folder and module map to `docs/refactor/CODEBASE_REVIEW.md`.

## Phase 2: Route and Capability Inventory

### Tasks

- List backend routes by router, method, auth dependency, and write behavior.
- List frontend pages and the API clients they call.
- Connect user-facing capabilities to backend routes and storage.

### Start With

- `server/routers/auth.py`
- `server/routers/admin_users.py`
- `server/routers/dashboard.py`
- `server/routers/upload.py`
- `server/routers/export.py`
- `server/routers/session.py`
- `client/src/lib/api/`
- `client/src/app/dashboard/page.tsx`
- `client/src/app/database/page.tsx`
- `client/src/app/database/edit/page.tsx`
- `client/src/app/settings/users/page.tsx`

### Output

Add route and capability tables using the templates in `06_OUTPUT_TEMPLATES.md`.

## Phase 3: Auth and Permission Review

### Tasks

- Trace login, cookie creation, `/auth/me`, logout, and admin checks.
- Verify every mutating backend route uses `get_current_user`, `require_admin`, or `require_write_or_admin`.
- Verify ownership checks exist for user-owned or artifact-owned resources.
- Confirm whether self-service registration is intended.

### Start With

- `server/services/auth.py`
- `server/services/user.py`
- `server/routers/auth.py`
- `server/dependencies.py`
- `server/routers/admin_users.py`
- `client/src/stores/auth-store.ts`
- `client/src/lib/api/auth.ts`

### Output

Add findings to `docs/refactor/AUTH_AND_SECURITY_REVIEW.md`.

## Phase 4: Data and Concurrency Review

### Tasks

- Inventory DuckDB writes, artifact writes, export/import jobs, cache invalidation, and ownership boundaries.
- Identify multi-step writes that need transactions or rollback tests.
- Identify filesystem operations that need generated names, path constraints, or cleanup tests.
- Verify `docs/database-schema.txt` matches schema-affecting code before proposing schema changes.

### Start With

- `server/storage/database.py`
- `server/services/ingestion.py`
- `server/services/export.py`
- `server/services/query.py`
- `server/services/custom_fields.py`
- `server/routers/upload.py`
- `server/routers/export.py`
- `server/utils/cache.py`

### Output

Add a persistence map and write-path table to `docs/refactor/CONCURRENCY_AND_DATA_SAFETY_REVIEW.md`.

## Phase 5: Frontend Risk Review

### Tasks

- Identify large pages and state clusters that should not be refactored blindly.
- Trace how dashboard selection, filters, render state, and plot fetches interact.
- Trace database upload/export/import state and modal behavior.
- Trace edit metadata behavior and API calls.

### Start With

- `client/src/components/dashboard/DashboardContent.tsx`
- `client/src/components/dashboard/side-panel/LoadDataSection.tsx`
- `client/src/hooks/use-session.ts`
- `client/src/hooks/use-filter-state.ts`
- `client/src/hooks/use-event-catalog.ts`
- `client/src/hooks/use-filter-selection-sync.ts`
- `client/src/app/database/page.tsx`
- `client/src/app/database/edit/page.tsx`
- `client/src/hooks/use-database-operation.ts`

### Output

Add frontend risks and recommended refactor boundaries to `docs/refactor/REFACTOR_PLAN.md`.

## Done When

- Every recommendation cites concrete files.
- No refactor is proposed without an observable behavior or maintainability risk.
- The next implementation slice can start with one behavior test.

