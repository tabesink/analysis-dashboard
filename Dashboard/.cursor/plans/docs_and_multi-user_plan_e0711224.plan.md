---
name: Docs and multi-user plan
overview: Create lean, well-organized project documentation reverse-engineered from the existing RSP Dashboard codebase, including a multi-user hardening phase derived from the brainstorm analysis. Update AGENTS.md to govern the new doc structure.
todos:
  - id: db-schema
    content: Create docs/database-schema.txt from schema.yaml + database.py _init_schema
    status: completed
  - id: tech-stack
    content: Create docs/tech-stack.md from pyproject.toml + package.json
    status: completed
  - id: prd
    content: Create docs/prd.md reverse-engineered from implemented features
    status: completed
  - id: test-strategy
    content: Create docs/test-strategy.md with current gaps identified
    status: completed
  - id: master-build-plan
    content: Create docs/master-build-plan.md with Phases 1-9, Phase 8 = multi-user hardening from brainstorm
    status: completed
  - id: decisions-log
    content: Create docs/decisions/log.md with initial entry
    status: completed
  - id: agents-md
    content: "Update AGENTS.md: fix paths, add doc structure ref, add multi-user rule, add task tracking rule, remove entity-relationship-diagram.md ref"
    status: completed
isProject: false
---

# Reverse-Engineer Project Docs + Multi-User Roadmap

## Doc Structure (Lean)

Drop redundant `rsp-dashboard-` prefixes. Flat where possible, subdirs only where grouping adds value.

```
docs/
  master-build-plan.md        # Task tracker: phases, IDs, status, deps
  prd.md                      # Product requirements
  tech-stack.md               # Technology inventory
  database-schema.txt         # Schema source of truth (AGENTS.md refs this)
  test-strategy.md            # Test approach + current gaps
  decisions/
    log.md                    # Append-only decision log (rename from decisions_made.md)
  tasks/                      # Per-task implementation notes (rename from tasks_output/)
  architecture/               # Already exists, keep as-is
    database.md
    database-multi-user.md
    interactive-layout-side-panel-arch.md
```

Why leaner:

- No project-name prefix on filenames (you're already in the project)
- `decisions/log.md` instead of `decisions/decisions_made.md` (shorter, clearer intent)
- `tasks/` instead of `tasks_output/` (shorter, standard)
- Flat top-level for the five core docs; architecture stays nested since it already exists

---

## File-by-File Plan

### 1. `docs/master-build-plan.md`

Structure mirrors the [reference build plan](.references/build-plan-reference.md) but with phases reflecting what was ACTUALLY built. Header references the four companion docs.

**Phases (reverse-engineered from code):**

- **Phase 1 - Infrastructure & Foundation (DONE)**
Docker Compose, FastAPI project structure, DuckDB schema init, `settings.yaml` + `config.py`, `schema.yaml`, logging (`JsonFormatter`), health endpoints, migration framework (`MigrationRunner`), rate limiter, performance middleware, error handler middleware
- **Phase 2 - Data Ingestion Pipeline (DONE)**
CSV parser (RSP-format with `#DATA`/`#TITLES`), `channel_map.yaml` loader, `DataValidator`, `DataTransformer` (wide-to-long), `LTTBDownsampler`, transactional ingestion (`IngestionService`), upload router, `dim_event`/`measurements_raw`/`measurements_lttb`/`dim_channel_map` tables
- **Phase 3 - Query & Filter System (DONE)**
`QueryService` with cache, 12 filter dimensions from `schema.yaml`, partition logic (baseline=Approved|Obsolete, new_data=Pending), program/version/event hierarchical queries, custom field definitions + program-scoped values, filter options CRUD
- **Phase 4 - Plotting & Visualization (DONE)**
`PlotImageService` (matplotlib), SVG plot data endpoint, binary plot data transfer, SSE grid rendering, interactive plot data, click-query nearest-curve
- **Phase 5 - Frontend Application (DONE)**
Next.js 16 App Router, Radix/shadcn components, layout shell (AppSidebar + SiteHeader), code-gen scripts (filters/settings/version from YAML), Zustand stores (6 stores), TanStack Query hooks, dashboard page (Grid/Interactive tabs + SidePanel), `HierarchicalEventTree`, `SVGPlot`/`SVGPlotCard`, color selection/legend, upload/database pages, session persistence (`useSession`)
- **Phase 6 - Authentication (DONE)**
JWT + bcrypt auth service, login page, cookie-based sessions, user/admin roles, `auth-store`, route guards, `get_current_user`/`require_admin` dependencies
- **Phase 7 - Database Portability & Admin (DONE)**
DB export/import, schema validation, `_schema_metadata`, admin-only export endpoints, custom field admin UI, filter-values admin page
- **Phase 8 - Multi-User Hardening (TODO)** -- NEW from brainstorm
Split into P0/P1/P2 priority tiers:
  - P0: Fix `status`/`status_value` kwarg mismatch in upload path, add ownership check on metadata updates
  - P1: `data_version` counter + `GET /api/v1/sync/version` endpoint, frontend polling (5-15s), consistent cache invalidation on all write paths, optimistic concurrency control (`updated_at` + 409 on conflict)
  - P2: Env-only secrets, secure cookie enforcement, horizontal scaling prep notes
- **Phase 9 - Testing & Production (TODO)**
Backend pytest suite, frontend Playwright e2e, CI pipeline, coverage targets, production Docker config, monitoring

Key source files for each task will be cited (e.g., `server/services/ingestion.py`, `client/src/hooks/use-all-events.ts`).

### 2. `docs/prd.md`

Sections:

- **Product overview:** Data analytics dashboard for automotive suspension component test data
- **Users:** Engineers (upload CSV data, view plots, filter events), Admins (manage filter options, custom fields, users, export/import DB)
- **Core workflows:** Upload -> Ingest -> Filter -> Plot -> Export
- **Functional requirements** (derived from implemented features): Upload (CSV + channel_map, validation rules from `settings.yaml`), Filtering (12 dimensions, partitions, custom fields), Visualization (grid SVG plots, interactive mode, LTTB downsampling), Session state (server-synced, backup to sessionStorage), Auth (JWT, roles), Portability (DB export/import with schema validation)
- **Non-functional requirements:** Rate limits (from `settings.yaml`), caching TTLs, validation rules (NaN%, row limits), CORS policy, max upload size
- **Data schema:** Points to `database-schema.txt`
- **Multi-user roadmap:** Summary of Phase 8 from build plan

### 3. `docs/tech-stack.md`

Concise inventory. Two main sections (Backend, Frontend) + Infrastructure + Dev Tools. Version numbers from `pyproject.toml` and `package.json`. Architecture patterns section covering: DI via FastAPI `Depends`, protocol-driven DB abstraction, YAML-driven code generation, LTTB downsampling, binary data transfer, single-file DuckDB with write-lock semantics.

### 4. `docs/database-schema.txt`

Extracted from `[server/schema.yaml](server/schema.yaml)` (dim tables) and `[server/storage/database.py](server/storage/database.py)` (`_init_schema` for non-dim tables). Content:

- 4 sequences
- 16+ tables with columns, types, nullability, defaults, constraints
- Indexes
- Logical relationships (no enforced FKs)
- Filter metadata (12 filter columns with allowed values)
- Multi-user proposal notes (from `schema.yaml` comments)

Note: filename is `database-schema.txt` (hyphenated) -- will update AGENTS.md reference to match.

### 5. `docs/test-strategy.md`

Sections: Backend testing (pytest stack, test categories), Frontend testing (Playwright, ESLint), Test categories (unit, integration, e2e with specific targets), Current gaps (no Jest/Testing Library, no Playwright tests written, no CI), Recommended coverage targets, Test data approach (from existing seed scripts in `.references/`).

### 6. `docs/decisions/log.md`

Initialize with a single entry documenting the creation of these docs and the multi-user hardening decision. Format: date, decision, rationale, alternatives considered.

### 7. `AGENTS.md` Updates

Current AGENTS.md references:

- `docs/master-build-plan.md` (correct)
- `docs/decisions/decisions_made.md` (rename to `docs/decisions/log.md`)
- `docs/tasks_output/` (rename to `docs/tasks/`)
- `docs/database_schema.txt` (rename to `docs/database-schema.txt`)
- `entity-relationship-diagram.md` (does not exist -- remove reference or create)

Changes to make:

1. **Update file paths** to match new doc structure
2. **Add doc structure reference section** so agents know where each doc lives and its purpose
3. **Add multi-user awareness rule**: "When modifying write paths, verify cache invalidation and ownership checks. Reference `docs/architecture/database-multi-user.md` for multi-user constraints."
4. **Add task tracking rule**: "Each task gets a unique ID (e.g., P8-03). Log start/completion in `docs/master-build-plan.md`. Create implementation notes in `docs/tasks/{task-id}.md` for non-trivial tasks."
5. **Remove `entity-relationship-diagram.md` reference** (does not exist, not needed alongside `database-schema.txt` and `docs/architecture/database.md`)
6. **Keep all four coding principles** as-is (they're solid)

---

## Execution Order

Sequential -- each doc builds on context from the previous:

1. `docs/database-schema.txt` (foundation, referenced by others)
2. `docs/tech-stack.md` (inventory, referenced by build plan)
3. `docs/prd.md` (requirements, referenced by build plan)
4. `docs/test-strategy.md` (strategy, referenced by build plan)
5. `docs/master-build-plan.md` (references all four above)
6. `docs/decisions/log.md` (initial entry)
7. `AGENTS.md` (updated paths and rules)

