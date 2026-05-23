# Frontend TDD Plan

## Goal

Reduce frontend risk in small slices while preserving the current dashboard, database, upload, metadata, and admin-user workflows.

## Current Test Reality

The client has `npm run test` wired to Vitest, but no established frontend test suite. Until a small test harness exists, use backend/API contract tests plus manual smoke checks for UI-heavy slices.

Do not start by adding broad E2E coverage. Add one focused test harness only when it unlocks a specific behavior.

## High-Risk Areas

- `client/src/components/dashboard/DashboardContent.tsx`
- `client/src/app/database/page.tsx`
- `client/src/app/database/edit/page.tsx`
- `client/src/hooks/use-database-operation.ts`
- `client/src/lib/api/client.ts`
- `client/src/hooks/use-session.ts`
- `client/src/hooks/use-filter-state.ts`
- `client/src/hooks/use-filter-selection-sync.ts`
- `client/src/stores/`

## Slice A: API Client Error Contract

### Behavior To Confirm

All feature API wrappers receive consistent status, message, and cookie behavior from the shared client.

### RED

Add a small Vitest test for `client/src/lib/api/client.ts`.

Cover:

- credentials are included
- JSON errors are normalized
- network failures produce a useful client error

### GREEN

Adjust only:

- `client/src/lib/api/client.ts`

### REFACTOR

Keep feature-specific clients thin.

### Done When

- `npm run test -- client/src/lib/api/client.test.ts` passes.
- Existing API wrappers do not need duplicated error parsing.

## Slice B: Auth Bootstrap UI Contract

### Behavior To Confirm

The app bootstraps the current user from `/auth/me`, redirects unauthenticated users, and keeps admin navigation tied to the backend user role.

### RED

Add a focused store or component test around:

- `client/src/stores/auth-store.ts`
- `client/src/app/page.tsx`
- `client/src/components/layout/ClientLayout.tsx`

If component tests are too heavy, document the manual smoke check first and defer automation to the API-client slice.

### GREEN

Adjust:

- `client/src/stores/auth-store.ts`
- `client/src/lib/api/auth.ts`
- `client/src/components/layout/AppSidebar.tsx`

### REFACTOR

Keep frontend guards as UX. Backend auth remains the source of truth.

### Done When

- Admin-only navigation follows the authenticated user.
- Logout clears UI session state.
- Backend route tests still cover actual access control.

## Slice C: Dashboard Workspace Import and Selection Contract

### Behavior To Confirm

Dashboard selection, filter, catalog, rendered events, and session state stay synchronized.

### RED

First verify whether `client/src/modules/dashboard-workspace/` exists. If missing, add a failing build or unit test that captures the expected public hook/module path.

Then add behavior tests for the pure selection resolver if available.

### GREEN

Restore or relocate the module expected by:

- `client/src/components/dashboard/DashboardContent.tsx`

Candidate surrounding files:

- `client/src/hooks/use-session.ts`
- `client/src/hooks/use-event-catalog.ts`
- `client/src/hooks/use-filter-selection-sync.ts`
- `client/src/stores/render-store.ts`

### REFACTOR

Prefer a small `dashboard-workspace` module interface over spreading selection rules back into page components.

### Done When

- `npm run build` resolves dashboard imports.
- Non-selectable or missing-channel-map events cannot remain selected.
- Backend catalog flags remain the source for plot eligibility.

## Slice D: Database Operation State

### Behavior To Confirm

Upload, export, import, delete, and pending-channel-map actions present predictable modal state and refresh data after successful mutation.

### RED

Add tests around pure helpers first, or extract a pure reducer from:

- `client/src/hooks/use-database-operation.ts`

Behaviors:

- operation starts in pending state
- success invalidates/refetches datasets
- failure shows a clear error and keeps previous data visible
- cancelling staged import calls the API if required

### GREEN

Adjust:

- `client/src/hooks/use-database-operation.ts`
- `client/src/components/upload/DatabaseOperationModal.tsx`
- `client/src/lib/api/upload.ts`
- `client/src/lib/api/export.ts`

### REFACTOR

Untangle UI modal types from API operation state only after tests exist.

### Done When

- The database page can refresh after successful writes.
- Failed writes leave the UI recoverable.
- Manual smoke checks cover upload/export/import/delete.

## Slice E: Split Large Pages After Safety Nets

### Behavior To Confirm

Splitting `database/page.tsx` or `database/edit/page.tsx` does not change user-visible behavior.

### RED

Create a smoke checklist entry before the split:

- page loads
- current data appears
- mutation action works
- error state is visible
- permission state is respected

Add focused tests only for extracted pure helpers.

### GREEN

Extract one component or hook at a time from:

- `client/src/app/database/page.tsx`
- `client/src/app/database/edit/page.tsx`

### REFACTOR

Stop after each small extraction and run lint/build.

### Done When

- The page files are easier to scan.
- No behavior changed.
- Extracted pieces have names that describe user intent, not implementation detail.

## Verification Commands

```bash
cd client
npm run lint
npm run build
npm run test
```

If frontend tests are introduced, document the exact new command in `docs/test-strategy.md`.

