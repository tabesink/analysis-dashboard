# Coding Agent Work Order — Dashboard Architecture Deepening

## Role

You are a senior software developer implementing a low-risk architecture deepening refactor.

Write code clearly enough that a junior developer can follow it.

## Scope

Work only on the dashboard-related architecture candidates.

Start with:

1. `client/src/modules/dashboard-workspace/`
2. `server/modules/filter_semantics/`

Do not begin with the broad persistence store split.

## Architecture rules

Use this vocabulary consistently:

- Module
- Interface
- Implementation
- Seam
- Adapter
- Depth
- Leverage
- Locality

Avoid the word "boundary" unless quoting existing code/docs.

## Refactor principle

Create deeper modules.

A deeper module hides scattered logic behind one small interface. It should reduce what callers need to know.

Do not create a new module if it is only a pass-through.

## Candidate 1 task — Dashboard Workspace Module

### Files to inspect

```text
client/src/hooks/use-session.ts
client/src/lib/session/session-sync.ts
client/src/hooks/use-filter-state.ts
client/src/hooks/use-event-catalog.ts
client/src/hooks/use-filter-selection-sync.ts
client/src/components/dashboard/DashboardContent.tsx
```

### Problem to solve

Selection, filters, session persistence, catalog pruning, and rendered IDs are spread across hooks and UI mount behaviour.

### Target

Create:

```text
client/src/modules/dashboard-workspace/
  README.md
  types.ts
  resolve-dashboard-workspace.ts
  dashboard-workspace-reducer.ts
  use-dashboard-workspace.ts
  dashboard-workspace.test.ts
```

### Acceptance criteria

- `DashboardContent.tsx` calls `useDashboardWorkspace`.
- UI code does not directly coordinate session sync and selection pruning.
- Selected event IDs are not destroyed during temporary catalog loading.
- Selected event IDs are pruned after the catalog is confirmed loaded.
- Rendered IDs are derived, not persisted directly.
- Tests assert behaviour through the module interface.

## Candidate 2 task — Filter Semantics Module

### Files to inspect

```text
server/services/query.py
server/storage/database.py
server/storage/schema_loader.py
server/utils/boolean_filters.py
server/utils/weight_filters.py
```

### Problem to solve

The meaning of dashboard filters is spread across query service, store methods, schema metadata, and utility functions.

### Target

Create:

```text
server/modules/filter_semantics/
  README.md
  models.py
  schema.py
  normalize.py
  build_filter_plan.py
  errors.py
  test_filter_semantics.py
```

### Acceptance criteria

- QueryService delegates filter meaning to `build_filter_plan`.
- Store methods execute a `FilterPlan`; they do not decide user-facing semantics.
- Unknown fields fail before query execution.
- Boolean filters normalize in one place.
- Weight filters normalize in one place.
- Event grid, program list, and version list use one filter contract.

## Testing rule

The interface is the test surface.

Add tests at the new module interface. Delete old shallow tests only after their behaviour is covered.

## Pull request sequence

### PR 1 — Documentation and safety tests

- Add this work order to docs.
- Add tests for current behaviour.
- No production logic changes except test hooks/fixtures.

### PR 2 — Dashboard workspace module

- Create the client module.
- Move pure state rules first.
- Keep old hooks as wrappers if needed.
- Update the dashboard UI to call the new module.

### PR 3 — Filter semantics module

- Create the server module.
- Move normalization and validation.
- Connect QueryService to the module.
- Keep SQL execution inside storage.

## Non-goals

- Do not redesign the UI.
- Do not split the whole database store in the first pass.
- Do not introduce ports unless there are two justified adapters.
- Do not expose internal helpers just for tests.
- Do not change route contracts unless a test proves the old contract is broken.

## Final deliverable expected from coding agent

Produce:

1. Code changes.
2. Tests.
3. Short module README files.
4. A short migration note explaining what old logic was replaced.
5. A list of old tests that were deleted or replaced, if any.
