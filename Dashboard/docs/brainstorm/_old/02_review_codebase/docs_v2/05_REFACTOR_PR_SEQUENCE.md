# Refactor PR Sequence

## Goal

Keep review and implementation work small enough to merge safely. Each PR should preserve behavior and include its own verification.

## PR 1: Evidence and Smoke Tests

### Goal

Create the review outputs and baseline smoke checklist without changing application behavior.

### Tasks

- Create `docs/refactor/CODEBASE_REVIEW.md`.
- Create `docs/refactor/AUTH_AND_SECURITY_REVIEW.md`.
- Create `docs/refactor/CONCURRENCY_AND_DATA_SAFETY_REVIEW.md`.
- Create `docs/refactor/SMOKE_TEST_CHECKLIST.md`.
- Fill route, capability, persistence, write-path, and risk tables.
- Record missing docs such as `docs/architecture/database-multi-user.md` if still absent.

### Done When

- Every finding cites files.
- Smoke checklist covers login, dashboard, database, upload/export/import, metadata edit, and admin users.
- No app code changed except docs-only fixes.

## PR 2: Auth Policy and Guard Coverage

### Goal

Make auth policy explicit and protect admin/write routes with tests.

### TDD Slices

- Registration policy test.
- Export/import admin guard test.
- Admin-user normal-user denial test if not already complete.
- Session cookie contract test.

### Files Likely Affected

- `server/routers/auth.py`
- `server/routers/export.py`
- `server/routers/admin_users.py`
- `server/services/auth.py`
- `server/services/user.py`
- `server/dependencies.py`
- `tests/server/routers/`

### Done When

- Auth behavior is tested through HTTP routes.
- Registration policy is documented.
- `uv run pytest ../tests/server/routers` passes from `server/`.

## PR 3: Data Safety and Cache Guardrails

### Goal

Cover the highest-risk write paths before deeper refactors.

### TDD Slices

- Failed upload/import leaves existing data intact.
- Scope delete enforces admin/owner rules.
- Export/import job failures do not replace good data.
- Cache invalidation happens after successful mutations.

### Files Likely Affected

- `server/routers/upload.py`
- `server/routers/export.py`
- `server/services/ingestion.py`
- `server/services/export.py`
- `server/services/query.py`
- `server/storage/database.py`
- `server/utils/cache.py`
- `tests/server/services/`

### Done When

- Mutating paths have focused tests.
- Ownership checks and cache invalidation are described in the review docs.
- `docs/database-schema.txt` is updated if any schema change occurs.

## PR 4: Frontend Foundation Tests

### Goal

Add the smallest useful frontend test harness and stabilize shared frontend contracts.

### TDD Slices

- API client error and cookie behavior.
- Auth bootstrap state behavior.
- Database operation state helper or reducer if extracted.

### Files Likely Affected

- `client/src/lib/api/client.ts`
- `client/src/lib/api/auth.ts`
- `client/src/stores/auth-store.ts`
- `client/src/hooks/use-database-operation.ts`
- `client/package.json`
- `client/src/**/*.test.ts`

### Done When

- `npm run test` executes meaningful frontend tests.
- `npm run lint` and `npm run build` pass.
- Test strategy docs list the frontend test command.

## PR 5: Dashboard Workspace Stabilization

### Goal

Restore or stabilize the dashboard workspace boundary and keep selection behavior tested.

### TDD Slices

- Dashboard workspace import/build check.
- Selection pruning behavior.
- Missing-channel-map non-selectable behavior.
- Rendered selection dirty-state behavior.

### Files Likely Affected

- `client/src/components/dashboard/DashboardContent.tsx`
- `client/src/modules/dashboard-workspace/`
- `client/src/hooks/use-session.ts`
- `client/src/hooks/use-event-catalog.ts`
- `client/src/hooks/use-filter-selection-sync.ts`
- `client/src/stores/render-store.ts`

### Done When

- `npm run build` passes.
- Dashboard selection rules are covered by behavior tests or documented smoke checks.
- No route contracts or visible UI behavior changed.

## PR 6: Large Page Decomposition

### Goal

Split large frontend pages only after tests and smoke checks exist.

### TDD Slices

- Extract one pure helper or component from `database/page.tsx`.
- Extract one pure helper or component from `database/edit/page.tsx`.
- Verify no user-visible behavior changes.

### Files Likely Affected

- `client/src/app/database/page.tsx`
- `client/src/app/database/edit/page.tsx`
- `client/src/components/upload/`
- `client/src/components/database/` if introduced

### Done When

- Each extraction has a clear purpose.
- Manual smoke checklist still passes.
- No broad styling-only churn is included.

## PR 7: Documentation Closeout

### Goal

Make the docs match the implemented architecture.

### Tasks

- Finalize `docs/refactor/JUNIOR_DEV_CODEBASE_GUIDE.md`.
- Update `docs/test-strategy.md` if new tests exist.
- Update `docs/decisions/log.md` for durable architecture decisions.
- Update `docs/master-build-plan.md` if a tracked task ID was used.

### Done When

- A junior developer can trace login, permissions, data writes, dashboard loading, and common changes.
- Review docs no longer contain stale unknowns that were resolved during implementation.

