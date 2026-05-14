---
name: Reverse-engineer project docs
overview: "Reverse-engineer five foundational project documents from the existing RSP Data Analytics Dashboard codebase: a master build plan, PRD, tech stack, database schema, and test strategy. All documents will reflect the actual implemented architecture and serve as the baseline for future AGENTS.md-governed development."
todos:
  - id: master-build-plan
    content: Create docs/master-build-plan.md - reverse-engineered build plan with phases reflecting actual implementation, tasks marked DONE/TODO
    status: pending
  - id: prd
    content: Create docs/rsp-dashboard-prd.md - product requirements document adapted from reference PRD structure
    status: pending
  - id: tech-stack
    content: Create docs/rsp-dashboard-tech-stack.md - complete technology inventory from pyproject.toml and package.json
    status: pending
  - id: db-schema
    content: Create docs/database_schema.txt - comprehensive schema from schema.yaml + database.py with all tables, columns, types, relationships
    status: pending
  - id: test-strategy
    content: Create docs/rsp-dashboard-test-strategy.md - test strategy covering backend/frontend with current gaps identified
    status: pending
  - id: update-decisions
    content: Populate docs/decisions/decisions_made.md with initial entry documenting the creation of these foundational docs
    status: pending
isProject: false
---

# Reverse-Engineer Project Documentation from Existing Codebase

## Context

The RSP Data Analytics Dashboard is a full-stack application for uploading, filtering, and visualizing automotive suspension component test data. It uses:

- **Backend:** FastAPI + DuckDB (single-file embedded DB) + LTTB downsampling
- **Frontend:** Next.js 16 (App Router) + React 19 + Radix UI/shadcn + Zustand + TanStack Query
- **Deployment:** Docker Compose (server + client containers, `dashboard_data` volume)

The reference build plan (`[.references/build-plan-reference.md](.references/build-plan-reference.md)`) is for a different project (DeepPatient MVP) but provides the structural template for all five documents.

---

## Documents to Create

### 1. Master Build Plan: `[docs/master-build-plan.md](docs/master-build-plan.md)`

Reverse-engineered from the actual codebase. Organized into phases reflecting what was actually built:

- **Phase 1 - Infrastructure & Foundation:** Docker setup, DuckDB schema, FastAPI project structure, settings/config system, logging, health checks, migrations framework
- **Phase 2 - Data Ingestion Pipeline:** CSV parsing (RSP-format), ETL pipeline (parser, validator, transformer), channel map loading, LTTB downsampling, `measurements_raw` + `measurements_lttb` tables, upload API
- **Phase 3 - Dashboard Query & Filter System:** `QueryService` with caching, filter options from `schema.yaml`, partition logic (baseline/new_data), program/version/event hierarchical queries, custom fields
- **Phase 4 - Plotting & Visualization Backend:** Matplotlib plot images, SVG plot data endpoints, binary plot data, SSE grid rendering, interactive plot queries, click-query nearest-curve
- **Phase 5 - Frontend Application:** Next.js setup, shadcn/Radix components, layout (sidebar + header), dashboard pages (Grid/Interactive tabs), side panel (GlobalFilters, partitions, event tree), SVG plotting, upload/database pages, session persistence, color selection/legend
- **Phase 6 - Authentication & Multi-User:** JWT + bcrypt auth, login page, cookie-based sessions, user/admin roles, route protection, auth store
- **Phase 7 - Database Portability & Admin Tools:** Export/import DB, validation, schema metadata, admin-only endpoints, rate limiting, performance middleware
- **Phase 8 (Planned) - Integration Testing & Production:** Outstanding TODOs from codebase exploration

Each task will be marked DONE (with evidence from code) or TODO (gaps identified).

### 2. PRD: `[docs/rsp-dashboard-prd.md](docs/rsp-dashboard-prd.md)`

Product requirements document adapted from the DeepPatient PRD structure:

- **Product Overview:** RSP Data Analytics Dashboard for automotive suspension test data visualization and analysis
- **User Personas:** Engineers (upload/view data), Admins (manage users, export/import, filter options)
- **Core Features:** Data upload (CSV + channel_map), hierarchical filtering (12 filter dimensions from `schema.yaml`), grid plot visualization (LTTB-downsampled), interactive plot mode, baseline/new_data partitioning, session persistence, database portability
- **Functional Requirements:** Upload flow, filter system, plot rendering, session management, auth, export/import
- **Non-Functional Requirements:** Performance targets (from `settings.yaml` rate limits, caching TTLs), security (JWT, admin key, CORS), data validation rules
- **Data Schema:** Reference to `database_schema.txt`

### 3. Tech Stack: `[docs/rsp-dashboard-tech-stack.md](docs/rsp-dashboard-tech-stack.md)`

Complete technology inventory derived from `[server/pyproject.toml](server/pyproject.toml)` and `[client/package.json](client/package.json)`:

- **Backend:** FastAPI 0.109+, Uvicorn, DuckDB 1.4.3+, Pydantic v2, pandas, numpy, pyarrow, matplotlib, bcrypt, PyJWT, PyYAML, pydantic-settings
- **Frontend:** Next.js 16.1.6, React 19.2.3, Radix UI primitives (13 packages), Tailwind CSS 4, Zustand 5.0.9, TanStack React Query 5.90.12, React Hook Form 7.69, Zod 4.2.1, Sonner, Lucide React, class-variance-authority
- **Dev Tools:** Ruff, mypy, pytest, ESLint, Playwright, TypeScript 5
- **Infrastructure:** Docker Compose, DuckDB file storage, named volumes
- **Architecture patterns:** Dependency injection, protocol-driven DB abstraction, code-generation (filters/settings/version from YAML), LTTB downsampling, binary plot data transfer

### 4. Database Schema: `[docs/database_schema.txt](docs/database_schema.txt)`

Comprehensive schema extracted from `[server/schema.yaml](server/schema.yaml)` and `[server/storage/database.py](server/storage/database.py)`:

- All 16+ tables with columns, types, constraints, and descriptions
- Sequences (4 auto-increment sequences)
- Indexes (from `database.py` `_init_schema`)
- Logical relationships (no enforced FKs)
- Filter metadata (12 filter dimensions with allowed values)
- Multi-user proposal notes (from `schema.yaml` comments)

### 5. Test Strategy: `[docs/rsp-dashboard-test-strategy.md](docs/rsp-dashboard-test-strategy.md)`

Test strategy adapted from the DeepPatient test strategy template:

- **Backend:** pytest + pytest-asyncio, httpx for API tests, pytest-cov, Ruff linting, mypy type checking
- **Frontend:** Playwright (scaffolded in devDependencies), ESLint
- **Test categories:** Unit (services, ETL pipeline, downsampling), Integration (API endpoints, DB operations), E2E (upload flow, dashboard rendering, auth flow)
- **Current gaps:** No frontend unit tests (Jest/Testing Library not installed), Playwright tests not yet written, no CI pipeline
- **Coverage targets and recommendations**

---

## Key Decisions

- All filenames use `rsp-dashboard-` prefix instead of `deeppatient-` to match the actual project
- Build plan phases are re-organized to reflect how the RSP Dashboard was actually built (data ingestion before auth, unlike DeepPatient which had auth first)
- Tasks are marked DONE or TODO based on code evidence, not assumptions
- `database_schema.txt` will be the canonical schema reference per `[AGENTS.md](AGENTS.md)` requirements
- The master build plan references the other four documents, following the same pattern as the reference

