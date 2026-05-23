# Refactor Plan

## Goal

Improve safety and maintainability through small, behavior-tested slices. The app already has useful boundaries, so this plan deepens and tests them instead of replacing them.

## Principles

- Preserve current user workflows.
- Add behavior tests before changing risky code.
- Keep backend authorization authoritative.
- Keep DuckDB write and filesystem behavior explicit.
- Split large frontend files only after smoke checks or tests exist.
- Avoid broad styling or folder churn in safety PRs.

## Phase 0: Evidence and Smoke Tests

### Goal

Create baseline docs and smoke checks before behavior changes.

### Tasks

- Maintain `docs/refactor/CODEBASE_REVIEW.md`.
- Maintain `docs/refactor/AUTH_AND_SECURITY_REVIEW.md`.
- Maintain `docs/refactor/CONCURRENCY_AND_DATA_SAFETY_REVIEW.md`.
- Maintain `docs/refactor/SMOKE_TEST_CHECKLIST.md`.
- Record missing `docs/architecture/database-multi-user.md` as documentation drift.

### Files likely affected

- `docs/refactor/*`
- `docs/architecture/database-multi-user.md` if created later

### Risks

- Docs can drift if not updated after later code changes.

### Done when

- Route, capability, persistence, write-path, and risk tables exist.
- No application behavior changed.

## Phase 1: Auth Policy and Guard Coverage

### Goal

Make current auth behavior hard to regress.

### Tasks

- Keep self-service `/auth/register` open for local-network read-only users.
- Add dedicated export/import admin guard tests.
- Extend cookie contract tests for login/logout.
- Fix stale "closed-registration" wording.
- Add route tests where write/admin dependencies are currently covered only indirectly.

### Files likely affected

- `server/routers/auth.py`
- `server/routers/export.py`
- `server/services/auth.py`
- `tests/server/routers/test_auth_routes.py`
- `tests/server/routers/test_export_router.py`

### Risks

- Closing registration would change product behavior.
- Testing export/import directly can become slow if not stubbed.

### Done when

- Public registration behavior is tested and documented.
- Normal users cannot access export/import routes in tests.
- Cookie creation and logout clearing are asserted.

## Phase 2: Data Safety Guardrails

### Goal

Prove high-risk writes fail safely.

### Tasks

- Add failed upload non-corruption tests.
- Add failed import non-replacement tests.
- Add scope delete owner/admin route tests.
- Add cache invalidation tests for metadata/upload/delete/import changes.
- Document filesystem artifact cleanup expectations.

### Files likely affected

- `server/services/ingestion.py`
- `server/services/export.py`
- `server/services/query.py`
- `server/routers/upload.py`
- `server/routers/export.py`
- `server/storage/database.py`
- `server/utils/cache.py`
- `tests/server/services/`
- `tests/server/routers/`

### Risks

- Upload and import paths combine DB writes and filesystem writes.
- Full export/import tests can be slow without small fixtures/stubs.

### Done when

- Failed writes leave existing data intact.
- Owner/admin rules are covered at route level.
- Cache invalidation is covered by tests.

## Phase 3: Frontend Test Foundation

### Goal

Add the smallest useful frontend test coverage before splitting large UI files.

### Tasks

- Add Vitest tests for `client/src/lib/api/client.ts`.
- Test credentials inclusion, error normalization, and timeout behavior.
- Consider store-level auth bootstrap tests.
- Document frontend test command in `docs/test-strategy.md`.

### Files likely affected

- `client/src/lib/api/client.ts`
- `client/src/lib/api/client.test.ts`
- `client/src/stores/auth-store.ts`
- `client/package.json` only if test setup needs adjustment
- `docs/test-strategy.md`

### Risks

- Overbuilding frontend test infrastructure before there is a clear behavior target.

### Done when

- `npm run test` runs at least one meaningful frontend test.
- `npm run lint` and `npm run build` still pass.

## Phase 4: Dashboard Workspace Stabilization

### Goal

Restore or stabilize the dashboard workspace boundary.

### Tasks

- Resolve `@/modules/dashboard-workspace` used by `DashboardContent`.
- Add behavior tests for dashboard selection pruning if pure logic exists.
- Keep missing-channel-map non-selectability aligned with backend catalog flags.

### Files likely affected

- `client/src/components/dashboard/DashboardContent.tsx`
- `client/src/modules/dashboard-workspace/`
- `client/src/hooks/use-session.ts`
- `client/src/hooks/use-event-catalog.ts`
- `client/src/hooks/use-filter-selection-sync.ts`
- `client/src/stores/render-store.ts`

### Risks

- Dashboard selection state spans hooks, stores, backend flags, and rendered plots.

### Done when

- Dashboard imports resolve.
- Build passes.
- Selection behavior has tests or explicit smoke coverage.

## Phase 5: Large Page Decomposition

### Goal

Make database and edit pages easier to maintain after safety nets exist.

### Tasks

- Extract one pure helper or component at a time from `client/src/app/database/page.tsx`.
- Extract one pure helper or component at a time from `client/src/app/database/edit/page.tsx`.
- Keep permission redirects and API refetch behavior stable.

### Files likely affected

- `client/src/app/database/page.tsx`
- `client/src/app/database/edit/page.tsx`
- `client/src/components/upload/`
- possible future `client/src/components/database/`

### Risks

- Splitting can create unnecessary indirection if done before tests.
- UI regressions may be missed without smoke checks.

### Done when

- Page files are smaller and easier to scan.
- No user-visible behavior changes.
- Smoke checklist still passes.

## Phase 6: Documentation Closeout

### Goal

Keep docs aligned with the implemented architecture.

### Tasks

- Finalize `docs/refactor/JUNIOR_DEV_CODEBASE_GUIDE.md`.
- Update `docs/test-strategy.md` for any new frontend/backend test commands.
- Add `docs/architecture/database-multi-user.md` or update references if renamed.
- Append to `docs/decisions/log.md` for durable architecture decisions.
- Update `docs/master-build-plan.md` if tracked task IDs apply.

### Done when

- A junior developer can trace auth, dashboard reads, uploads, metadata writes, export/import, and common change points.

## Files to Change First

1. `tests/server/routers/test_export_router.py`
2. `tests/server/routers/test_auth_routes.py`
3. `server/services/auth.py` docstring only
4. `tests/server/services/test_ingestion_service_status.py`
5. `tests/server/services/test_query_service_metadata.py`
6. `client/src/lib/api/client.test.ts`
7. `client/src/modules/dashboard-workspace/` or the import in `DashboardContent`

## Files to Avoid Changing First

1. `client/src/app/database/page.tsx`
2. `client/src/app/database/edit/page.tsx`
3. `server/storage/database.py` schema methods
4. `server/services/export.py` import replacement internals
5. dashboard plotting components under `client/src/components/charts/`

## Suggested First TDD Slice

Create `tests/server/routers/test_export_router.py` and prove `/api/v1/export/database/info` rejects unauthenticated and read-only users while allowing admin users.

