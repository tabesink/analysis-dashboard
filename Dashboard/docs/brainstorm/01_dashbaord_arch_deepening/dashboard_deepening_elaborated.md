# Dashboard Architecture Deepening — Elaborated Review

## Purpose

This document expands the architecture review into practical, junior-friendly refactoring guidance.

The goal is **not** to rewrite the dashboard. The goal is to deepen the most important shallow modules so future changes are easier to test, easier to understand, and safer for a junior developer to maintain.

## Architecture language used in this document

Use these words consistently in code reviews and implementation notes:

- **Module**: anything with an interface and an implementation.
- **Interface**: everything a caller must know to use the module correctly, including types, invariants, ordering, error modes, configuration, and performance expectations.
- **Implementation**: the code hidden behind the module's interface.
- **Depth**: how much useful behaviour sits behind a small interface.
- **Seam**: where the interface lives.
- **Adapter**: a concrete thing that satisfies an interface at a seam.
- **Leverage**: what callers get from depth.
- **Locality**: what maintainers get when related logic lives in one place.

## Senior developer read

The review found the same architecture smell in several places:

> A dashboard concept is spread across many small modules. Each individual module looks simple, but the caller must understand the whole cluster to make a safe change.

That is the definition of a **shallow** design. The fix is not to add more helper files. The fix is to create a deeper module whose interface describes the real user-facing behaviour.

## Recommended order

### Start with Candidate 1: Dashboard selection, filters, and session persistence

This is the best client-side first refactor because it owns the user-facing state rules:

- Which events are selected.
- Which selected events are still valid after catalog/filter changes.
- Which filters are global dashboard filters.
- Which state is persisted.
- Which state is derived and should not be persisted.
- Which IDs are rendered.

### Then do Candidate 2: Server global filter/query semantics

This is the best server-side first refactor because one filter meaning should apply consistently to:

- Event grids.
- Program lists.
- Version lists.
- Custom fields.
- Boolean filters.
- Weight filters.
- Metadata-driven schema fields.

### Then do Candidate 3: Plot data fetch/decode/render pipeline

This is high value if plot rendering bugs or performance regressions are common. It should come after Candidate 1 because plot rendering depends on selected events and active filters.

## Candidate ranking

| Rank | Candidate | Why it matters | Risk | Recommendation |
|---:|---|---|---|---|
| 1 | Dashboard selection, filters, and session persistence | Core dashboard behaviour is spread across hooks and UI mount behaviour. | Medium | Do first. Smallest visible slice with high leverage. |
| 2 | Server global filter/query semantics | One filter contract is scattered across query, store, YAML metadata, and utilities. | Medium | Do second. Add behaviour tests before moving logic. |
| 3 | Plot data fetch/decode/render pipeline | Grid and viewer duplicate knowledge about cache, decode, curves, sorting, pinned mode, and coloring. | Medium-high | Do after state/filter semantics stabilize. |
| 4 | Upload, ingestion, artifacts, and cache invalidation | Upload lifecycle spans router, ingestion, ETL, filesystem, DB writes, task status, and cache invalidation. | High | Do as a dedicated workflow module later. |
| 5 | Database mutation cache coherence | Client and server repeat stale-cache knowledge. | Medium | Do after upload and query semantics are explicit. |
| 6 | Export/import portability job orchestration | Job state, cancellation, schema validation, ZIP/parquet, and DB swap behaviour cross many modules. | High | Treat as separate job module once store seams are cleaner. |
| 7 | Auth identity and user administration | Token claims, roles, write permissions, route guards, and DB user fields must stay aligned. | Medium | Good later security-focused refactor. |
| 8 | UnifiedStore persistence monolith | One store owns too many unrelated responsibilities. | Very high | Do not start here. Split only after clearer domain modules exist. |

## Candidate 1 — Dashboard selection, filters, and session persistence

### Current friction

The review identifies this cluster:

```text
client/src/hooks/use-session.ts
client/src/lib/session/session-sync.ts
client/src/hooks/use-filter-state.ts
client/src/hooks/use-event-catalog.ts
client/src/hooks/use-filter-selection-sync.ts
client/src/components/dashboard/DashboardContent.tsx
```

The problem is not that these files exist. The problem is that the **meaning** of dashboard state is spread across them.

A junior developer changing one hook must know:

- Whether selected event IDs are raw user choice or already pruned against the event catalog.
- Whether filters should be persisted immediately or after debounce.
- Whether session state wins over defaults on first load.
- Whether filter changes should clear invalid selected events.
- Whether rendered IDs are stored or derived.
- Whether catalog loading can temporarily make a valid selection look invalid.

That is too much knowledge for every caller.

### Deeper module shape

Create a deep module named something like:

```text
client/src/modules/dashboard-workspace/
```

It should own the dashboard state rules.

A reasonable first interface is:

```ts
const workspace = useDashboardWorkspace({
  catalog,
  initialSession,
  defaultFilters,
  persistSession,
});
```

The caller should not know how pruning, persistence, filter synchronization, and rendered IDs are implemented.

### What the module hides

The implementation hides:

- Session loading and session persistence.
- Selected event pruning.
- Catalog whitelist rules.
- Filter normalization.
- Derived rendered event IDs.
- Debounce or timing details.
- Defensive behaviour while catalog/query data is still loading.

### Invariants to document in code

Put these comments near the types and tests:

```text
1. selectedEventIds must only contain IDs present in the current catalog.
2. renderedEventIds are derived from selectedEventIds + filters; callers do not write them directly.
3. persisted session state must not contain temporary loading state.
4. changing global filters may prune selectedEventIds.
5. loading an empty catalog must not permanently erase a valid persisted selection unless the catalog is confirmed loaded.
```

### Testing strategy

Replace timing-heavy hook tests with behaviour tests at the module interface.

Good tests:

- Given a persisted session and a loaded catalog, invalid selected IDs are pruned.
- Given a filter change, rendered IDs update.
- Given a temporary loading catalog, persisted selected IDs are not destroyed.
- Given a valid selection, persistence receives only serializable session state.
- Given default filters, first render is deterministic.

Bad tests:

- Testing that hook A calls hook B.
- Testing internal state variables.
- Testing implementation order instead of observable state.

## Candidate 2 — Server global filter/query semantics

### Current friction

The review identifies this cluster:

```text
server/services/query.py
server/storage/database.py
server/storage/schema_loader.py
server/utils/boolean_filters.py
server/utils/weight_filters.py
```

The problem is that one user action — applying dashboard filters — is interpreted in many places.

A junior developer adding a new filter must understand:

- QueryService event filtering.
- Store methods for program IDs and versions.
- YAML schema metadata.
- Boolean utility behaviour.
- Weight utility behaviour.
- How custom fields map to SQL/query expressions.

That spreads one concept across too many modules.

### Deeper module shape

Create a module named something like:

```text
server/modules/filter_semantics/
```

It should own one filter contract.

A reasonable first interface is:

```py
plan = build_filter_plan(
    filters=request.filters,
    schema=schema,
    purpose="event_grid",
)
rows = event_store.query_events(plan)
```

The caller should not know whether a filter is boolean, weight-based, custom-field-based, or schema-derived.

### What the module hides

The implementation hides:

- Boolean filter normalization.
- Weight filter normalization.
- Schema field lookup.
- Allowed operators per field type.
- Conversion from request filter values to query expressions.
- Validation errors for unknown fields or unsupported operators.

### Invariants to document in code

```text
1. The same filter input must mean the same thing for event grids, program lists, and version lists.
2. Unknown fields fail clearly before SQL/query execution.
3. Boolean filters accept only documented truthy/falsy forms.
4. Weight filters normalize units/ranges in one place.
5. Schema metadata is read once at the filter module seam, not scattered across callers.
```

### Testing strategy

Add behaviour tests around the filter module before changing query internals.

Good tests:

- One filter input produces the expected event-grid query plan.
- The same filter input produces consistent program/version filtering.
- Unknown filter field raises a clear validation error.
- Boolean filters normalize consistently.
- Weight filters normalize consistently.
- Custom field filters use schema metadata correctly.

Bad tests:

- Testing private SQL string fragments everywhere.
- Testing boolean and weight utilities separately after the filter module owns their behaviour.
- Repeating equivalent filter tests at every route.

## Candidate 3 — Plot data fetch/decode/render pipeline

### Current friction

The review identifies this cluster:

```text
client/src/components/dashboard/plot-grid/PlotGrid.tsx
client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx
client/src/hooks/use-sequential-plot-data.ts
client/src/hooks/use-lazy-plot-fetch.ts
client/src/stores/render-store.ts
client/src/lib/plot-pipeline.ts
client/src/lib/utils/decode-worker-client.ts
```

The grid and interactive viewer are separate UI surfaces, but they share the same plot data rules.

That means a developer fixing one plot path may accidentally break the other.

### Deeper module shape

Create:

```text
client/src/modules/plot-data/
```

A reasonable first interface is:

```ts
const plotData = usePlotData({
  selectedEventIds,
  viewMode,
  axes,
  colorBy,
  pinnedEventIds,
});
```

The caller should not coordinate fetch order, worker decode, render cache, curve assembly, sorting, pinned mode, and color mapping.

### What the module hides

- Lazy fetch.
- Sequential fetch.
- Binary decode worker.
- Cache read/write.
- Curve construction.
- Axis mapping.
- Color mapping.
- Pinned event handling.
- Loading/error states.

### Testing strategy

Test fetch/cache/decode/curve shaping through the plot-data module interface.

Use an in-memory adapter for fetch/decode in tests only if there are at least two real adapters: production and test. Do not create ports for everything just because tests are easier.

## Candidate 4 — UnifiedStore persistence monolith

### Current friction

The review identifies:

```text
server/storage/database.py
server/storage/schema_loader.py
server/schema.yaml
```

The store currently appears to own too much:

- Connection lifecycle.
- Schema initialization.
- Users.
- Events.
- Uploads.
- Ingestion artifacts.
- Sessions.
- Audit.
- Custom fields.
- Export/import.

This is a real issue, but it is a risky starting point. Splitting persistence too early can create many shallow stores instead of one deep one.

### Recommendation

Do not begin by splitting the store. First make query/filter, ingestion, identity, and export modules clearer. Then extract persistence modules around those domain concepts.

Target future shape:

```text
server/storage/
  connection.py
  schema.py
  event_store.py
  upload_store.py
  session_store.py
  user_store.py
  audit_store.py
```

Each store should be justified by a deeper domain module that uses it.

## Candidate 5 — Upload, ingestion, artifacts, and cache invalidation

### Current friction

The review identifies:

```text
server/services/ingestion.py
server/routers/upload.py
server/services/etl/
server/services/query.py
server/utils/cache.py
server/storage/database.py
```

This is one workflow spread across router, ETL, filesystem, database, task status, ownership, and cache invalidation.

### Deeper module shape

Create:

```text
server/modules/upload_ingestion/
```

A future interface could look like:

```py
result = ingestion_workflow.ingest_upload(
    user=current_user,
    upload_file=file,
    options=ingestion_options,
)
```

### What the module hides

- File parsing.
- Validation.
- Downsampling.
- Artifact writing.
- Task status.
- Ownership checks.
- DB writes.
- Cache invalidation.

### Testing strategy

Use local filesystem and local DuckDB test stand-ins. Test observable outcomes:

- Upload accepted.
- Artifacts written.
- Dataset visible in query.
- Owner set correctly.
- Relevant caches invalidated.
- Invalid files fail cleanly.

## Candidate 6 — Database mutation cache coherence

### Current friction

The review identifies that both client and server repeat knowledge of which cache/query families become stale after upload, edit, delete, metadata, and artifact changes.

This is dangerous because cache bugs often look like random UI bugs.

### Deeper module shape

Create a shared mutation policy, not necessarily shared code at first.

Example server-side shape:

```py
affected = mutation_policy.after_dataset_deleted(dataset_id)
cache.invalidate(affected.server_cache_keys)
return {"clientInvalidations": affected.client_query_keys}
```

Example client-side shape:

```ts
applyDashboardInvalidations(queryClient, response.clientInvalidations);
```

### Recommendation

Do this after Candidate 2 and Candidate 5. The invalidation policy is easier once filters and ingestion outcomes are explicit.

## Candidate 7 — Export/import portability job orchestration

### Current friction

The review identifies:

```text
server/services/export.py
server/routers/export.py
server/storage/database.py
server/storage/schema_loader.py
```

This is a job orchestration problem, not just export helper code.

### Deeper module shape

Create:

```text
server/modules/portable_archive_jobs/
```

It should own:

- Job creation.
- Job status.
- Cancellation.
- Staging area.
- Schema validation.
- ZIP/parquet reading/writing.
- DB swap behaviour.

### Recommendation

Keep router globals out of the long-term design. Routers should delegate to a job module.

## Candidate 8 — Auth identity and user administration

### Current friction

The review identifies:

```text
server/services/auth.py
server/services/user.py
server/dependencies.py
server/routers/auth.py
server/routers/admin_users.py
server/storage/database.py
```

Auth is not just login. It includes:

- Identity.
- Token claims.
- Role/write permissions.
- User lifecycle.
- Route guards.
- DB user fields.

### Deeper module shape

Create:

```text
server/modules/identity/
```

The identity module should answer:

- Who is the current user?
- What permissions does the user have?
- Can this user perform this action?
- How are users created, disabled, updated, or deleted?

### Recommendation

Do this carefully because it is security-sensitive. Add behaviour tests before refactoring.

## Implementation plan

### Phase 0 — Safety net

Before changing code:

1. Add a short `docs/architecture/dashboard-deepening.md`.
2. Document the current invariants for Candidate 1 and Candidate 2.
3. Add golden behaviour tests around current behaviour.
4. Avoid large renames.
5. Avoid changing UI appearance.

### Phase 1 — Candidate 1 client module

1. Create `client/src/modules/dashboard-workspace/`.
2. Move pure state rules into a reducer/resolver first.
3. Keep old hooks as wrappers temporarily.
4. Change `DashboardContent.tsx` to call the new module.
5. Delete replaced tests once interface tests exist.

### Phase 2 — Candidate 2 server module

1. Create `server/modules/filter_semantics/`.
2. Move boolean/weight/custom-field normalization into this module.
3. Make `QueryService` call the filter module.
4. Keep database query execution in the store.
5. Add tests for one filter contract across event/program/version queries.

### Phase 3 — Candidate 3 plot module

1. Create `client/src/modules/plot-data/`.
2. Move fetch/decode/cache/curve shaping behind one hook.
3. Make grid and viewer call the same module.
4. Test with in-memory fetch/decode adapters.
5. Delete duplicated grid/viewer data assembly logic.

## Junior developer rules for this refactor

1. Do not move code until there is a behaviour test describing what must stay true.
2. Do not create a new interface unless it hides real complexity.
3. Do not expose internal helper functions just so tests can call them.
4. Do not add a port when there is only one adapter.
5. Keep old routes and UI props stable during the first pass.
6. Prefer boring names over clever names.
7. Every module folder needs a short `README.md`.
8. Every module should have one obvious entry point.

## Suggested pull request breakdown

### PR 1 — Documentation and safety tests

- Add architecture doc.
- Add Candidate 1 behaviour tests.
- Add Candidate 2 behaviour tests.
- No production logic changes.

### PR 2 — Dashboard workspace module

- Add `client/src/modules/dashboard-workspace/`.
- Move selection/filter/session rules.
- Keep old hooks as wrappers.
- Update dashboard content gradually.

### PR 3 — Filter semantics module

- Add `server/modules/filter_semantics/`.
- Move boolean/weight/custom-field filter rules.
- Make query paths use the module.

### PR 4 — Plot data module

- Add `client/src/modules/plot-data/`.
- Move fetch/decode/cache/curve shaping.
- Make grid and viewer share the same module.

## Definition of done

A candidate is done when:

- Callers use the deeper module's interface.
- Tests assert behaviour through that interface.
- Replaced shallow tests are deleted.
- The old scattered logic is removed, not duplicated.
- A junior developer can read the module README and know where to make the next change.
