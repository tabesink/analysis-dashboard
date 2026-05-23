I’ll evaluate this as an architecture simplification question, not just a schema question: first the YAML/live DB split, then the same “split vs merge” pattern across the repo.

Thought for 1m 3s

Yes — the split exists because the repo is halfway between declarative schema management and imperative schema creation.

Right now:

schema.yaml
  = intended source of truth for dim tables + filter metadata

database.py
  = runtime DB initializer + migrations-by-ALTER + indexes + users/sessions/uploads/custom fields + query/write methods

migrations.py
  = version tracker, but mostly re-applies schema.yaml and compares schema.yaml tables to live DuckDB

The repo itself says schema.yaml is the source of truth for dim tables and filter options, while non-dim tables and index policy are still managed in server/storage/database.py. SchemaLoader also says it only emits SQL for objects defined in schema.yaml, and that runtime indexes and non-YAML tables are managed by UnifiedStore.

1. YAML vs live DB compare screen: should this split exist?
Current split
+-------------------+-------------------------------+---------------------------+
| Area              | Current owner                 | Problem                   |
+-------------------+-------------------------------+---------------------------+
| dim_program       | schema.yaml                   | Good                      |
| dim_event         | schema.yaml + database.py     | Duplicate authority       |
| filter metadata   | schema.yaml                   | Mostly good              |
| users             | database.py                   | Hidden runtime schema     |
| sessions          | database.py                   | Hidden runtime schema     |
| upload_tasks      | database.py                   | Hidden runtime schema     |
| custom fields     | database.py                   | Hidden runtime schema     |
| indexes           | database.py                   | Hidden performance policy |
| migrations        | migrations.py + database.py   | Split responsibility      |
+-------------------+-------------------------------+---------------------------+

The key issue is not that YAML and live DB differ. The issue is that both schema.yaml and database.py define schema facts, but only one of them looks like documentation. database.py creates extra sequences, tables such as users, sessions, upload_tasks, measurement tables, custom field tables, indexes, and also applies many ALTER TABLE ADD COLUMN IF NOT EXISTS changes.

So the compare screen is useful, but its current meaning should be clarified.

Current compare screen meaning
schema.yaml != live DB

That sounds like an error.

But in this codebase, it actually means:

schema.yaml = partial declared schema
live DB     = full runtime schema

So a simple “YAML vs live DB” screen may falsely make healthy runtime tables look like drift.

Recommendation: merge schema ownership, not necessarily all storage code

Do not merge everything into database.py.

Do not keep the current split either.

Use this target:

server/storage/schema_registry.yaml
  owns all declared DB objects:
  - tables
  - columns
  - sequences
  - indexes
  - runtime tables
  - app tables
  - metadata tables

server/storage/schema_loader.py
  reads registry and generates safe DDL

server/storage/migrations.py
  applies registry-driven migrations

server/storage/database.py
  contains DB operations only, not table definitions

This reduces entropy because junior devs can answer:

Where is the database schema?
Answer: schema_registry.yaml

Where is schema applied?
Answer: migrations.py

Where are DB reads/writes?
Answer: database.py
Revised compare screen

Instead of this:

YAML vs Live DB Compare

Use this:

Declared Schema vs Live DB

Then classify tables:

+-----------------------------+------------+------------+----------------+
| table                       | declared   | live       | status         |
+-----------------------------+------------+------------+----------------+
| dim_program                 | yes        | yes        | OK             |
| dim_event                   | yes        | yes        | OK             |
| users                       | yes        | yes        | OK             |
| sessions                    | yes        | yes        | OK             |
| upload_tasks                | yes        | yes        | OK             |
| measurements_raw            | yes        | yes        | OK             |
| measurements_lttb           | yes        | yes        | OK             |
| custom_field_definitions    | yes        | yes        | OK             |
| unexpected_temp_table       | no         | yes        | DRIFT          |
| missing_runtime_table       | yes        | no         | MISSING        |
+-----------------------------+------------+------------+----------------+

The CLI screen becomes a drift detector, not a confusing comparison between partial YAML and the real DB.

2. Should schema.yaml and database.py be merged?

Yes, but carefully.

Best merge

Move DDL definitions out of database.py.

Keep data access methods in database.py.

Before
database.py
  - opens DuckDB
  - creates schema
  - applies ALTER TABLE changes
  - creates indexes
  - manages users
  - manages sessions
  - manages events
  - manages measurements
  - manages custom fields
  - manages export/import
After
schema_registry.yaml
  - declarative schema

migrations.py
  - apply schema versions

database.py
  - read/write operations only

schema_introspection.py
  - admin CLI schema viewer support
Why not put everything in YAML blindly?

Some things are better declared in YAML:

tables
columns
indexes
sequences
default values
nullable rules
display metadata
filter metadata

Some things should stay in code:

data validation logic
query construction
permission checks
cache invalidation
audit writes
bulk import/export operations

The rule is:

Schema facts go in the registry.
Behavior stays in Python.
3. Deeper codebase entropy findings
A. Schema ownership split
Current state

schema.yaml has dim tables and filters. database.py creates many additional runtime tables. migrations.py tracks schema version and compares schema tables against live DB, but its own diff logic will naturally see DB-only runtime tables as “extra” unless explicitly excluded.

Problem

This creates three mental models:

schema.yaml says what should exist
database.py creates what actually exists
migrations.py partially checks drift
Recommendation

Merge into one schema registry.

Action: HIGH PRIORITY
B. Migration system vs _init_schema
Current state

main.py applies migrations before initializing UnifiedStore, then UnifiedStore also runs _init_schema() and creates/updates tables.

Problem

Two places can change schema:

migrations.py
database.py::_init_schema()

That means future schema changes may be added to the wrong place.

Recommendation

Make this rule:

migrations.py is the only place that mutates schema.
database.py assumes schema exists.

For transition, keep _init_schema() temporarily but shrink it until it only verifies required tables.

Action: HIGH PRIORITY
C. Filter configuration split
Current state

Filter options come from schema.yaml, but QueryService can save global filter overrides to filter_option_overrides.json, and custom fields come from DB tables.

This split is partly valid

There are three kinds of filters:

core filters       = declared in schema
admin overrides    = runtime configurable
custom fields      = user/admin-created DB state

That is not automatically bad. The problem is naming and visibility.

Recommendation

Do not merge all filters into one file. Instead create a single resolver:

FilterOptionResolver
  - load core filters from schema registry
  - apply admin overrides
  - append custom field filters
  - return final API shape

The CLI should show this as:

+----------------------+----------+---------------------------+
| filter               | source   | storage                   |
+----------------------+----------+---------------------------+
| Status               | core     | schema_registry.yaml      |
| Suspension Component | core     | schema_registry.yaml      |
| Custom Program Field | custom   | custom_field_definitions  |
| Overridden Values    | override | filter_option_overrides   |
+----------------------+----------+---------------------------+
Action: MEDIUM PRIORITY
D. Backend Pydantic models vs frontend TypeScript types
Current state

Backend response/request models are defined in server/models/dashboard.py. Frontend API types are manually duplicated in client/src/types/api.ts.

Problem

This is a common entropy source. If a backend field changes, the frontend can silently drift.

Example: backend EventMetadata.status is nullable, but frontend EventMetadata.status is typed as a fixed union of 'Approved' | 'Obsolete' | 'Pending'.

Recommendation

Do not hand-maintain duplicate types long-term. Generate frontend types from the FastAPI OpenAPI schema.

Target flow:

FastAPI Pydantic models
        |
        v
OpenAPI JSON
        |
        v
generated TypeScript types

Keep hand-written frontend helpers, but generate the API contracts.

Action: HIGH PRIORITY
E. Router query parameter duplication
Current state

The dashboard router repeats many filter query parameters across endpoints: suspension_component, axle_location, rfq, dv, pv, post_prod, drive_type, weight ranges, and so on.

Problem

Every new filter can require edits in multiple endpoints.

Recommendation

Create a shared dependency:

def get_global_filters_from_query(...) -> dict[str, list[str] | str]:
    ...

Then use:

GlobalFiltersDep = Annotated[dict[str, list[str] | str], Depends(get_global_filters_from_query)]

This keeps routes short and junior-readable.

Action: MEDIUM PRIORITY
F. API endpoint duplication and fallback behavior
Current state

The frontend dashboard API has explicit calls for each endpoint and has a POST-to-GET fallback for binary plot data. The backend also keeps both POST and GET plot data endpoints, with POST preferred for large selections and GET kept for backward compatibility.

This split is acceptable short-term

Backward compatibility is a valid reason.

Recommendation

Keep both for now, but label one as legacy:

GET /plots/data        legacy, small requests only
POST /plots/data       preferred
POST /plots/data/binary preferred for high-volume rendering

Add a small API deprecation note so junior devs know which path to use.

Action: LOW PRIORITY
G. Client state split across many stores
Current state

The frontend has separate stores for auth, color selection, pinned events, plot settings, rendering, and UI state.

This split may be good

This is not necessarily entropy. Separate Zustand stores can be clean if each owns a bounded concern.

Risk

Entropy appears if the same state exists in:

Zustand store
React Query cache
server session table
URL params
local component state

The repo also has hooks for session, filter state, filter sync, plot fetching, uploaded datasets, and event catalog.

Recommendation

Do not merge all stores into one mega-store. Instead document ownership:

+---------------------+--------------------------+
| State type          | Owner                    |
+---------------------+--------------------------+
| server data         | React Query              |
| authenticated user  | auth-store               |
| UI-only layout      | ui-store                 |
| plot preferences    | plot-settings-store      |
| persisted session   | server sessions table    |
| URL/share state     | URL params if needed     |
+---------------------+--------------------------+
Action: MEDIUM PRIORITY
H. Config split: YAML, env vars, .env, defaults
Current state

The settings layer intentionally supports YAML, environment variables, .env, and defaults. It documents priority as environment variables over .env, settings.yaml, and defaults.

This split is valid

Do not merge this into one config file. Deployment needs env overrides.

Problem

The config file is doing a lot: production security validation, LAN insecure-cookie escape hatch, CORS parsing, nested settings, and path handling.

Recommendation

Keep the split, but separate helpers:

config.py
  Settings models only

config_loader.py
  YAML/env merge logic

security_config.py
  production validation rules

cors_config.py
  CORS parsing helpers
Action: LOW/MEDIUM PRIORITY
I. Storage class doing too much
Current state

UnifiedStore handles connection lifecycle, schema initialization, user operations, program/event operations, measurements, sessions, custom fields, export/import, and indexes. It is described as a single-file DuckDB store for all app data.

Problem

This is probably the biggest backend entropy source after schema ownership.

Recommendation

Do not split it into tiny files immediately. First split by repository modules while keeping one shared connection owner:

storage/
  database.py              # connection owner only
  schema_registry.yaml
  migrations.py
  repositories/
    users_repo.py
    events_repo.py
    sessions_repo.py
    measurements_repo.py
    custom_fields_repo.py
    uploads_repo.py

Keep the DB lock and connection policy centralized. Do not let each repo create its own DuckDB connection.

Action: HIGH PRIORITY, but phased
Overall recommendation

Use this decision table:

+-------------------------------------+----------------------+----------------------------+
| Area                                | Merge?               | Recommendation             |
+-------------------------------------+----------------------+----------------------------+
| YAML schema + database.py DDL       | Yes                  | One schema registry        |
| migrations.py + database.py DDL     | Yes                  | Migrations own schema      |
| DB operations in UnifiedStore       | Partially            | Split into repositories    |
| core filters + overrides + custom   | No, but centralize   | FilterOptionResolver       |
| Pydantic models + TS types          | Yes via generation   | Generate TS from OpenAPI   |
| repeated filter query params        | Yes                  | Shared FastAPI dependency  |
| frontend Zustand stores             | No                   | Document ownership         |
| GET/POST/binary plot endpoints      | Not yet              | Mark preferred vs legacy   |
| YAML/env/default config             | No                   | Keep split, clean helpers  |
+-------------------------------------+----------------------+----------------------------+
Best next instruction to give the coding agent
Refactor the schema architecture to reduce entropy without changing runtime behavior.

Goal:
Create one declared schema registry for all DuckDB schema objects, then make migrations.py the only place that applies schema changes. Keep database.py focused on read/write operations.

Scope:
1. Replace server/schema.yaml with a broader server/storage/schema_registry.yaml or extend schema.yaml to include:
   - all tables
   - all columns
   - all sequences
   - all indexes
   - runtime tables
   - measurement tables
   - user/session/upload/custom-field tables
2. Update SchemaLoader so it can generate:
   - CREATE SEQUENCE
   - CREATE TABLE
   - CREATE INDEX
   - ALTER TABLE ADD COLUMN IF NOT EXISTS for safe additive migrations
3. Update MigrationRunner so schema changes are applied there.
4. Shrink UnifiedStore._init_schema() so it no longer owns schema definitions.
5. Add a schema doctor command/report that compares declared schema vs live DuckDB:
   - OK
   - MISSING
   - TYPE_MISMATCH
   - EXTRA_RUNTIME_ALLOWED
   - DRIFT
6. Preserve all existing behavior.
7. Keep code lightweight and junior-readable.
8. Do not introduce Alembic or SQLAlchemy unless there is a strong reason.
9. Add tests for schema registry loading, generated SQL, and live DB compare.

Important:
Do not merge runtime data behavior into YAML. Only schema facts belong in the registry.

My strongest recommendation: merge schema ownership first. That gives the admin ASCII CLI a clean foundation and will reduce confusion everywhere else. Then address generated frontend API types and UnifiedStore decomposition.

## Addendum: Database Script Overengineering Requirements

This plan should be constrained by the database simplification requirements in `database_script_overengineered_fix.md`. The goal is not to split the storage layer broadly on day one. The first coding-agent task should remove schema ownership confusion while preserving the working app.

### Updated First Priority

Start with schema ownership, not repository extraction.

The current problem is that `database.py` owns too many unrelated jobs:

- DuckDB connection management
- table and sequence creation
- additive `ALTER TABLE` migrations
- index creation
- legacy data backfills
- user, session, event, measurement, upload, and custom-field operations

The first refactor should move schema facts out of `database.py` before splitting read/write methods into repositories. If repositories are extracted while schema definitions remain scattered, the confusion moves into more files instead of disappearing.

### Target Dependency Direction

Use this direction for the implementation plan:

```text
schema_registry.yaml
        ↓
schema_loader.py
        ↓
schema_applier.py / migrations.py
        ↓
database.py
        ↓
repositories
        ↓
services / routers
```

`database.py` should remain the DuckDB connection owner and temporary facade during the first phase. Repositories are a later phase and must not open their own DuckDB connections.

### Phase Constraints

Phase 1 should:

1. Inventory every schema object currently created or altered by `database.py`.
2. Move sequences, table definitions, additive columns, and indexes into a declared schema registry.
3. Extend the schema loader only enough to generate the DDL already needed by the current app.
4. Add a schema applier that runs idempotent schema DDL.
5. Keep behavior unchanged for app startup, auth, uploads, metadata, sessions, export/import, and dashboard reads.
6. Add behavior tests around the public schema initialization path and schema drift/doctor output.

Phase 1 should not:

- introduce SQLAlchemy, Alembic, or an ORM
- split every `UnifiedStore` method into repositories
- change runtime data behavior through YAML
- rewrite router or service layers
- change the DuckDB connection or locking policy

### Schema DDL vs Data Backfills

The implementation plan must separate idempotent schema changes from data-changing backfills.

Schema applier responsibilities:

- `CREATE SEQUENCE IF NOT EXISTS`
- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ADD COLUMN IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`

Data backfill responsibilities:

- legacy status/maturity normalization
- boolean flag normalization
- any `UPDATE` that changes existing rows

Backfills should live in a separate module or migration step so reviewers can distinguish structural changes from data mutations.

### TDD Requirement For The Coding Agent

Use vertical red-green-refactor cycles. Do not write all schema tests first and then implement everything.

Each slice should define one observable behavior through a public path, for example:

1. A fresh DuckDB database initializes with all required declared tables, sequences, and indexes.
2. An existing database missing a newly declared column is upgraded without losing data.
3. The schema doctor reports declared-vs-live status without treating expected runtime tables as drift.
4. Startup still creates a usable store for auth/session/upload/dashboard flows.

Every cycle should keep the app green before the next behavior is added.

### Revised First Coding-Agent Instruction

Refactor the database schema initialization path to reduce schema ownership entropy without changing runtime behavior.

Create one declared schema registry for all DuckDB schema objects, make migrations/schema application own schema DDL, and shrink `UnifiedStore._init_schema()` so it delegates schema creation instead of embedding raw table/index definitions. Keep `database.py` as the connection owner and facade for now. Separate data backfills from schema DDL. Add behavior tests that prove fresh initialization, additive upgrade, and declared-vs-live schema comparison work through public interfaces.

## Execution Status + Next Refactor Steps (2026-05-15)

Completed:

- Declared schema registry normalization and shared DDL application path (`SchemaLoader` + `SchemaApplier`).
- `_init_schema()` no longer embeds raw DDL definitions.
- Migration diff includes schema doctor classification reporting.
- Current doctor statuses in use:
  - `OK`
  - `MISSING`
  - `TYPE_MISMATCH`
  - `DRIFT`

Next slices to document/implement in order:

1. **Backfill extraction slice**
   - Move row-mutating `UPDATE` backfills out of `_init_schema()` into a dedicated module.
   - Keep invocation order explicit: schema apply first, backfills second.
   - Add focused regression tests for backfill idempotency and unchanged behavior.

2. **Startup ownership cleanup slice**
   - Clarify one schema mutation path for startup/migrations.
   - Keep existing app startup behavior and DuckDB connection/locking policy unchanged.

3. **Repository extraction slice (low-risk domains first)**
   - Extract `users` repository first, then `sessions`.
   - Preserve `database.py` as the single shared connection owner.
   - Do not open standalone DuckDB connections in repositories.

4. **Later decomposition slices**
   - `uploads`, `custom_fields`, `measurements`, `events` repositories after low-risk domains are stable.