# RSP Data Analytics Dashboard - Master Build Plan

**Version:** 1.1
**Last Updated:** 2026-05-21
**App version:** 1.3.7
**Reference Documents:**
- PRD: `docs/prd.md`
- Tech Stack: `docs/tech-stack.md`
- Database Schema: `docs/database-schema.txt`
- Test Strategy: `docs/test-strategy.md`

---

## Overview

This build plan was reverse-engineered from the existing codebase to establish a baseline for tracked, incremental development going forward. All completed work is marked DONE with source file references. Phases 1–7, 10–14 are complete. Phase 8 multi-user hardening is largely complete (P2 production items remain). Phase 9 testing and CI automation is partially complete.

---

## Phase 1: Infrastructure & Foundation (DONE)

**Objective:** Docker environment, FastAPI project structure, DuckDB schema, configuration system

| Task ID | Task | Status | Key Files |
|---------|------|--------|-----------|
| P1-01 | Docker Compose setup (server + client, named volumes) | DONE | `docker-compose.yml` |
| P1-02 | FastAPI app factory with lifespan (startup/shutdown) | DONE | `server/main.py` |
| P1-03 | DuckDB schema initialization (`_init_schema`) | DONE | `server/storage/database.py` |
| P1-04 | YAML-based schema definition for dim tables | DONE | `server/schema.yaml` |
| P1-05 | Schema loader (YAML to SQL generation) | DONE | `server/storage/schema_loader.py` |
| P1-06 | Migration framework with version tracking | DONE | `server/storage/migrations.py`, `scripts/migrate.py` |
| P1-07 | Settings from YAML + env with Pydantic | DONE | `server/config.py`, `server/settings.yaml` |
| P1-08 | Structured JSON logging | DONE | `server/utils/logging.py` |
| P1-09 | Health check endpoints (liveness, readiness) | DONE | `server/routers/health.py` |
| P1-10 | Version info endpoint | DONE | `server/routers/info.py` |
| P1-19 | Unified release version sync + changelog workflow | DONE (2026-03-30) | `VERSION`, `CHANGELOG.md`, `scripts/release_version.py`, `scripts/check_version_sync.py`, `client/next.config.ts`, `.github/workflows/version-sync.yml`, `docs/release-versioning.md` |
| P1-11 | Rate limiting middleware (token bucket, per-category) | DONE | `server/middleware/rate_limiter.py` |
| P1-12 | Performance monitoring middleware (timing, request ID) | DONE | `server/middleware/performance.py` |
| P1-13 | Error handler middleware (exception to JSON mapping) | DONE | `server/middleware/error_handler.py` |
| P1-14 | Custom exception hierarchy | DONE | `server/exceptions.py` |
| P1-15 | Protocol-driven DB abstraction | DONE | `server/protocols.py` |
| P1-16 | Dependency injection container | DONE | `server/dependencies.py` |
| P1-17 | In-memory TTL cache | DONE | `server/utils/cache.py` |
| P1-18 | CORS + GZip middleware configuration | DONE | `server/main.py` |

---

## Phase 2: Data Ingestion Pipeline (DONE)

**Objective:** CSV upload, parse, validate, transform, downsample, store

| Task ID | Task | Status | Key Files |
|---------|------|--------|-----------|
| P2-01 | CSV parser supporting RSP-format (`#DATA`/`#TITLES` markers) | DONE | `server/services/etl/csv_parser.py` |
| P2-02 | Channel map YAML loader | DONE | `server/services/etl/channel_map.py` |
| P2-03 | Data validator (duplicates, NaN%, row limits, monotonicity) | DONE | `server/services/etl/validator.py` |
| P2-04 | Data transformer (wide CSV to long-format measurements) | DONE | `server/services/etl/transformer.py` |
| P2-05 | LTTB downsampler with inflection-aware extensions | DONE | `server/services/downsampling.py` |
| P2-06 | Transactional ingestion service (orchestrates ETL + write) | DONE | `server/services/ingestion.py` |
| P2-07 | Upload router (multipart file + metadata) | DONE | `server/routers/upload.py` |
| P2-08 | Bulk soft-delete and purge endpoints | DONE | `server/routers/upload.py` |
| P2-09 | Dataset listing endpoint | DONE | `server/routers/upload.py` |
| P2-09b | Dataset listing: server-side pagination + column facets | DONE (2026-03-26) | `server/routers/upload.py`, `server/models/upload.py`, `client/src/hooks/use-uploaded-datasets.ts`, `client/src/app/database/page.tsx` | `DatasetListResponse` with `items/total/has_more/facets`; default 200/page, max 1000; pagination controls + rows-per-page selector; column filter dropdowns use server facets. See DEC-017. |
| P2-10 | Audit logging on ingestion | DONE | `server/storage/database.py` |
| P2-11 | CSV upload SSE progress with per-event commit milestones | DONE (2026-03-30) | `server/routers/upload.py`, `server/services/ingestion.py`, `server/storage/database.py`, `server/models/upload.py`, `client/src/lib/api/upload.ts`, `client/src/hooks/use-upload.ts`, `client/src/types/upload.ts` |
| P2-12 | Direct RSP upload conversion through existing CSV ingestion | DONE (2026-04-29) | `server/services/etl/rsp_converter.py`, `server/services/ingestion.py`, `server/routers/upload.py`, `client/src/app/database/page.tsx`, `client/src/components/upload/UploadDataSection.tsx`, `client/src/hooks/use-upload.ts`, `client/src/lib/api/upload.ts` |
| P2-13 | Pending channel-map uploads with retained CSV artifacts | DONE (2026-04-29) | `server/services/ingestion.py`, `server/storage/database.py`, `server/routers/dashboard.py`, `server/services/upload_query.py`, `server/services/export.py` |
| P2-14 | Program/version hard-delete scope for processed and pending uploads | DONE (2026-04-29) | `server/storage/database.py`, `server/routers/upload.py`, `server/models/upload.py`, `client/src/app/database/page.tsx`, `client/src/components/upload/DatabaseEventTree.tsx` |

---

## Phase 3: Query & Filter System (DONE)

**Objective:** Dashboard queries, hierarchical filtering, partition logic, custom fields

| Task ID | Task | Status | Key Files |
|---------|------|--------|-----------|
| P3-01 | QueryService with caching | DONE | `server/services/query.py` |
| P3-02 | Program IDs endpoint (with global filter support) | DONE | `server/routers/dashboard.py` |
| P3-03 | Versions endpoint (multi-program, filter-aware) | DONE | `server/routers/dashboard.py` |
| P3-04 | Events endpoint (unified, global filters) | DONE | `server/routers/dashboard.py` |
| P3-05 | Event count endpoint | DONE | `server/routers/dashboard.py` |
| P3-06 | Filter options CRUD (read, update, reset) | DONE | `server/routers/dashboard.py` |
| P3-07 | ~~Partition logic~~ Removed in DEC-019 (unified load data) | DONE | `server/services/query.py` |
| P3-08 | Bidirectional filter propagation | DONE | `server/storage/database.py` |
| P3-09 | Event metadata update endpoint (with admin status guard) | DONE | `server/routers/dashboard.py` |
| P3-10 | Custom field definitions CRUD | DONE | `server/routers/dashboard.py`, `server/services/custom_fields.py` |
| P3-11 | Program-scoped custom field allowed values | DONE | `server/storage/database.py` |
| P3-12 | Channel map and metadata endpoints | DONE | `server/routers/dashboard.py` |

---

## Phase 4: Plotting & Visualization Backend (DONE)

**Objective:** Plot image generation, SVG data, binary transfer, interactive queries

| Task ID | Task | Status | Key Files |
|---------|------|--------|-----------|
| P4-01 | Matplotlib plot image service | DONE | `server/services/plot_image.py` |
| P4-02 | SSE grid rendering endpoint | DONE | `server/routers/dashboard.py` |
| P4-03 | Interactive plot rendering endpoint | DONE | `server/routers/dashboard.py` |
| P4-04 | SVG plot data endpoint (JSON) | DONE | `server/routers/dashboard.py` |
| P4-05 | Binary plot data endpoint | DONE | `server/routers/dashboard.py` |
| P4-06 | Click-query nearest curve endpoint | DONE | `server/routers/dashboard.py` |
| P4-07 | LTTB bulk query (multi-plot, Arrow export) | DONE | `server/storage/database.py` |

---

## Phase 5: Frontend Application (DONE)

**Objective:** Next.js app, component architecture, dashboard UI, data visualization

| Task ID | Task | Status | Key Files |
|---------|------|--------|-----------|
| P5-01 | Next.js 16 project with App Router | DONE | `client/package.json`, `client/src/app/layout.tsx` |
| P5-02 | Radix UI + shadcn component library setup | DONE | `client/src/components/ui/` |
| P5-03 | Build-time code generation (filters, settings, version from YAML) | DONE | `client/scripts/generate-*.js` |
| P5-04 | App layout shell (sidebar + header + inset) | DONE | `client/src/components/layout/` |
| P5-05 | Sidebar navigation with config-driven items | DONE | `client/src/config/sidebar-config.ts`, `client/src/components/layout/AppSidebar.tsx` |
| P5-06 | Header with route-based title | DONE | `client/src/config/header-config.ts`, `client/src/components/layout/SiteHeader.tsx` |
| P5-07 | Providers: QueryClient + Toaster + ClientLayout | DONE | `client/src/app/providers.tsx` |
| P5-08 | Dashboard page with Grid/Interactive tabs | DONE | `client/src/app/dashboard/page.tsx` |
| P5-09 | Side panel with GlobalFilters + unified Load Data | DONE | `client/src/components/dashboard/side-panel/` |
| P5-10 | GlobalFilters component (accordion, chips, event search) | DONE | `client/src/components/dashboard/side-panel/GlobalFilters.tsx` |
| P5-11 | LoadDataSection component (unified, replaces partitions) | DONE | `client/src/components/dashboard/side-panel/LoadDataSection.tsx` |
| P5-12 | HierarchicalEventTree (program > version > event) | DONE | `client/src/components/dashboard/shared/HierarchicalEventTree.tsx` |
| P5-13 | SVGPlot + SVGPlotCard components | DONE | `client/src/components/charts/` |
| P5-14 | PlotGrid with progressive loading | DONE | `client/src/components/dashboard/` |
| P5-15 | InteractiveCanvasPlot | DONE | `client/src/components/charts/` |
| P5-16 | Color selection store (by version, by filter, per-event) | DONE | `client/src/stores/color-selection-store.ts` |
| P5-17 | ColorLegend panel (docked/floating) | DONE | `client/src/components/dashboard/color-legend/ColorLegend.tsx` |
| P5-18 | GridActionToolbar (render, clear, export, pin mode) | DONE | `client/src/components/dashboard/` |
| P5-19 | Upload/Database page | DONE | `client/src/app/database/page.tsx` |
| P5-20 | UploadDataSection component | DONE (2026-03-30) | `client/src/components/upload/UploadDataSection.tsx`, `client/src/app/database/page.tsx`, `tests/server/services/test_ingestion_service_status.py` |
| P5-21 | Database export/import section | DONE | `client/src/components/upload/` |
| P5-22 | Filter values admin page | DONE | `client/src/app/database/filter-values/page.tsx` |
| P5-23 | Zustand stores (ui, render, pinned-events, plot-settings) | DONE | `client/src/stores/` |
| P5-24 | useSession hook (server sync, debounce, backup) | DONE | `client/src/hooks/` |
| P5-25 | useFilterState hook (unified data state, global filters) | DONE | `client/src/hooks/` |
| P5-26 | useAllEvents + useEventCatalog hooks | DONE | `client/src/hooks/use-all-events.ts`, `client/src/hooks/use-event-catalog.ts` |
| P5-27 | useFilterOptions hook | DONE | `client/src/hooks/use-filter-options.ts` |
| P5-28 | Binary plot data Web Worker | DONE | `client/src/workers/` |
| P5-29 | API client layer (typed wrappers, error handling) | DONE | `client/src/lib/api/` |
| P5-30 | Interactive viewer fallback to rendered event visibility source | DONE (2026-03-26) | `client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx` |
| P5-31 | Hide Database portability subsection on Database route (temporary) | SUPERSEDED (2026-05-19) | `client/src/components/upload/DatabaseSidePanel.tsx` | Hidden during 1.1.x; re-exposed as admin **Load Data Transfer** in 1.3.0 (see Phase 14). |
| P5-32 | Increase CSV upload client timeout to 60 minutes for local-network large uploads | DONE (2026-03-30) | `client/src/lib/api/upload.ts` |
| P5-33 | Add dashboard SidePanel vertical scrolling for Global Filters overflow | DONE (2026-03-30) | `client/src/components/dashboard/side-panel/SidePanel.tsx` |
| P5-34 | Apply side-panel scroll through expanded Load Data subsection | DONE (2026-03-30) | `client/src/components/dashboard/side-panel/LoadDataSection.tsx` |
| P5-35 | Interactive viewer empty plot when no curves visible (replace text message with axes-only plot) | DONE (2026-04-22) | `client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx` |
| P5-36 | Database upload panel single drag/drop import control | DONE (2026-04-29) | `client/src/components/upload/UploadDataSection.tsx` |
| P5-37 | Channel-map editor and missing-map warnings | DONE (2026-04-29) | `client/src/app/database/edit/page.tsx`, `client/src/components/upload/DatabaseEventTree.tsx`, `client/src/components/dashboard/shared/HierarchicalEventTree.tsx`, `client/src/components/dashboard/side-panel/LoadDataSection.tsx` |
| P5-38 | Dashboard load-data selection is channel-map gated | DONE (2026-04-29) | `server/services/query.py`, `client/src/components/dashboard/shared/HierarchicalEventTree.tsx`, `client/src/components/dashboard/side-panel/LoadDataSection.tsx`, `tests/server/services/test_ingestion_service_status.py` |
| P5-39 | Dashboard pending pseudo-event UI cleanup + events flag passthrough fix | DONE (2026-04-29) | `server/routers/dashboard.py`, `client/src/components/dashboard/shared/HierarchicalEventTree.tsx`, `tests/server/services/test_ingestion_service_status.py` |

---

## Phase 6: Authentication (DONE)

**Objective:** JWT auth, login page, role-based access

| Task ID | Task | Status | Key Files |
|---------|------|--------|-----------|
| P6-01 | Auth service (JWT create/decode, bcrypt verify) | DONE | `server/services/auth.py` |
| P6-02 | Login/logout/me endpoints | DONE | `server/routers/auth.py` |
| P6-03 | Auth dependencies (get_current_user, require_admin) | DONE | `server/dependencies.py` |
| P6-04 | Login page | DONE | `client/src/app/login/page.tsx` |
| P6-05 | Auth store (Zustand, bootstrap on load) | DONE | `client/src/stores/auth-store.ts` |
| P6-06 | Auth API client | DONE | `client/src/lib/api/auth.ts` |
| P6-07 | Route protection (redirect unauthenticated to /login) | DONE | `client/src/app/dashboard/page.tsx`, `client/src/app/database/page.tsx` |
| P6-08 | Home page redirect (/ -> /login) | DONE | `client/src/app/page.tsx` |

---

## Phase 7: Database Portability & Admin (DONE)

**Objective:** DB export/import, schema metadata, admin tools

| Task ID | Task | Status | Key Files |
|---------|------|--------|-----------|
| P7-01 | Export service (Parquet+zstd ZIP, task lifecycle, upload staging) | DONE (2026-03-20) | `server/services/export.py` |
| P7-02 | Import with schema validation, streaming ZIP upload, backup | DONE (2026-03-20) | `server/services/export.py`, `server/routers/export.py` |
| P7-03 | Export/import Parquet API (admin-only) | DONE (2026-03-20) | `server/routers/export.py` |
| P7-04 | Schema metadata table and operations | DONE | `server/storage/database.py` |
| P7-05 | Database info endpoint | DONE | `server/routers/export.py` (`GET .../database/info`) |
| P7-06 | Validate-on-upload (`POST .../parquet/upload` returns `upload_id` + validation) | DONE (2026-03-20) | `server/routers/export.py` |
| P7-07 | Export UX: native Save As for final ZIP blob | DONE | `client/src/app/database/page.tsx` |
| P7-08 | Export UX: Save As before long-running export (preserve user activation) | DONE | `client/src/app/database/page.tsx` |
| P7-09 | Fallback browsers: blob download after task poll (no direct single-URL DB download) | DONE (2026-03-20) | `client/src/app/database/page.tsx` |
| P7-10 | Export UX: toast uses live DB size + network hint before export task | DONE | `client/src/app/database/page.tsx`, `client/src/lib/api/export.ts` |
| P7-11 | `UnifiedStore.export_to_parquet` / `import_from_parquet` (per-table COPY, `chdir` for load paths) | DONE (2026-03-20) | `server/storage/database.py` |
| P7-12 | Staged upload cancel (`DELETE .../parquet/upload/{upload_id}`) | DONE (2026-03-20) | `server/routers/export.py`, `client` |
| P7-13 | Portable export/import includes retained channel-map artifacts | DONE (2026-04-29) | `server/services/export.py`, `server/storage/database.py` |

---

## Phase 8: Multi-User Hardening (MOSTLY DONE)

**Objective:** Close correctness and concurrency gaps for production multi-user usage

Source: Multi-user brainstorm analysis (2026-03-09). P0/P1 items shipped in 1.3.0; P2 production hardening items remain open.

### P0 - Critical Bugs

| Task ID | Task | Status | Key Files | Details |
|---------|------|--------|-----------|---------|
| P8-01 | Fix `status`/`status_value` kwarg mismatch in upload path | DONE (2026-03-09) | `server/routers/upload.py` L164, `server/services/ingestion.py` L123 | Router passes `status=` but service expects `status_value=`. Runtime bug on upload. |
| P8-02 | Add ownership check on metadata updates | DONE (2026-03-09) | `server/routers/dashboard.py` L487-499 | Currently any authenticated user can edit any event's non-status fields. Should be owner or admin. |

### P1 - Multi-User Correctness

| Task ID | Task | Status | Key Files | Details |
|---------|------|--------|-----------|---------|
| P8-03 | Add `data_version` monotonic counter | DONE (2026-05-15) | `server/storage/database.py`, `tests/server/storage/test_schema_initialization.py`, `docs/tasks/P8-03.md` | Added a monotonic `data_version` counter stored in `_schema_metadata` and bumped on committed write transactions, with explicit opt-out for non-mutating maintenance paths. |
| P8-04 | Add `GET /api/v1/sync/version` endpoint | DONE (2026-05-15) | `server/routers/sync.py`, `server/main.py`, `tests/server/routers/test_sync_router.py`, `docs/tasks/P8-04.md` | Added authenticated sync endpoint returning current `data_version` for polling clients, with route coverage for auth requirement and monotonic version behavior. |
| P8-05 | Frontend data version polling + query invalidation | DONE (2026-05-15) | `client/src/hooks/use-data-version-sync.ts`, `client/src/app/providers.tsx`, `client/src/lib/api/sync.ts`, `client/src/lib/api/sync.test.ts`, `docs/tasks/P8-05.md` | Added client polling of `/sync/version` and invalidation of sync-sensitive dashboard queries when `data_version` increases. |
| P8-06 | Consistent cache invalidation on all write paths | DONE (2026-05-15) | `server/routers/upload.py`, `server/routers/dashboard.py`, `server/services/query.py`, `tests/server/services/test_query_service_metadata.py`, `docs/tasks/P8-06.md` | Audited upload/dashboard write endpoints and aligned cache invalidation coverage: delete + metadata writes invalidate event/program/version groups, and custom-field writes invalidate filter-options cache. |
| P8-07 | Optimistic concurrency control on updates | DONE (2026-05-15) | `server/models/dashboard.py`, `server/services/query.py`, `server/storage/database.py`, `server/routers/dashboard.py`, `tests/server/services/test_query_service_metadata.py`, `tests/server/routers/test_dashboard_router.py`, `docs/tasks/P8-07.md` | Added atomic optimistic concurrency checks for single-event metadata writes: clients must send `if_unmodified_since`, stale tokens return `409`, and updates apply only when `updated_at` still matches. |
| P8-08 | Reduce frontend stale time for multi-user | TODO | `client/src/hooks/use-all-events.ts`, `client/src/app/providers.tsx` | `data_version` polling (P8-05) is shipped; staleTime tuning still open. |
| P8-13 | Metadata save UX feedback + bulk update performance | DONE (2026-03-09) | `client/src/app/database/filter-values/page.tsx`, `client/src/app/database/page.tsx`, `client/src/hooks/use-uploaded-datasets.ts`, `server/routers/dashboard.py`, `server/storage/database.py` | Add explicit save lifecycle feedback, endpoint timeout overrides, preserve table visibility during refresh, and replace per-event metadata loop with scoped batch update. |
| P8-14 | Edit Metadata split-pane refactor + route migration | DONE (2026-03-09) | `client/src/app/database/edit/page.tsx`, `client/src/app/database/filter-values/page.tsx`, `client/src/config/sidebar-config.ts`, `client/src/config/header-config.ts`, `client/src/components/layout/NavMain.tsx` | Move Edit Metadata to `/database/edit`, add compatibility redirect from legacy route, adopt Database-style split-pane UI, and replace Custom Fields tab with local under-construction placeholder. |
| P8-15 | Weight range filtering against raw values with SQL predicates | DONE (2026-03-09) | `server/services/query.py`, `server/storage/database.py`, `server/utils/weight_filters.py` | Apply GVWR/FGAWR/RGAWR range buckets to raw numeric fields in SQL for events/programs/versions queries, avoiding per-record application loops. |
| P8-16 | Replace Phase with RFQ/DV/PV/Post-Prod booleans across UI + API | DONE (2026-03-09) | `server/schema.yaml`, `server/routers/dashboard.py`, `server/routers/upload.py`, `server/models/dashboard.py`, `server/models/upload.py`, `server/storage/database.py`, `client/src/app/database/edit/page.tsx`, `client/src/config/filters.ts`, `client/src/types/api.ts`, `client/src/types/upload.ts` | Remove legacy `phase` filter, add boolean metadata fields and true/false filter semantics, refactor Edit Metadata UI for numeric weight inputs plus applicable phase checkboxes, and align frontend/backend filter contracts. |

### P2 - Production Hardening

| Task ID | Task | Status | Key Files | Details |
|---------|------|--------|-----------|---------|
| P8-09 | Move secrets to env-only (remove defaults from settings.yaml) | TODO | `server/settings.yaml`, `server/config.py` | `admin_secret` and `jwt_secret` should not have dev defaults in committed config. |
| P8-10 | Enforce secure cookie in production | TODO | `server/settings.yaml` | `auth_cookie_secure: true` when behind HTTPS. |
| P8-11 | Document horizontal scaling constraints | DONE (2026-05-21) | `docs/architecture/deployment-and-scaling.md` | Single DuckDB file = single writer; documents release bundle path, import resource limits, and when to migrate. |
| P8-12 | Program-version metadata edit flow + schema-driven visibility sync | DONE (2026-03-09) | `server/routers/dashboard.py`, `server/models/dashboard.py`, `client/src/app/database/filter-values/page.tsx`, `client/src/app/database/page.tsx` | Enable role-aware program-version metadata editing, selection metadata audit display updates, and ensure metadata fields auto-surface in Database columns and Global Filters. |
| P8-17 | Parquet import ZIP path safety + data-safety inventory | DONE (2026-05-15) | `server/services/export.py`, `tests/server/services/test_export_service.py`, `docs/refactor/CONCURRENCY_AND_DATA_SAFETY_REVIEW.md`, `docs/tasks/P8-17.md` | Reject unsafe archive member paths during validation and background import before extraction, preserving current data on failed imports. |

---

## Phase 9: Testing & Production (PARTIAL)

**Objective:** Automated test suite, CI pipeline, production readiness

| Task ID | Task | Status | Key Files | Details |
|---------|------|--------|-----------|---------|
| P9-01 | Backend unit tests (ETL, services, cache) | PARTIAL (2026-05-21) | `tests/server/` | ~114 pytest tests; ETL parser/validator/transformer and cache still gaps. See test-strategy.md. |
| P9-02 | Backend integration tests (API endpoints) | PARTIAL (2026-05-21) | `tests/server/routers/` | Router coverage for auth, export, upload, sync, admin, health, dashboard metadata. |
| P9-03 | Frontend E2E tests (Playwright) | TODO | `tests/e2e/` | Playwright dependency present; no suite written. |
| P9-04 | CI pipeline (GitHub Actions) | PARTIAL (2026-05-21) | `.github/workflows/version-sync.yml` | Version sync only; full lint/test CI still TODO. |
| P9-05 | Test data fixtures | PARTIAL (2026-05-21) | `tests/server/fixtures/`, `tests/conftest.py` | Temp DuckDB + export ZIP fixtures exist; sample CSV/channel_map library incomplete. |
| P9-06 | Production Docker config | DONE (2026-05-15) | `Deployment/docker-compose.yml`, `Deployment/.env.example`, `Deployment/scripts/deploy.sh`, `Deployment/scripts/deploy.ps1`, `Deployment/README.md` | Superseded the older `Dashboard/deployment/` path with the repo-level release bundle: single-origin LAN proxy, versioned image tarball, release notes, checksums, and Windows/Linux deploy scripts. |
| P9-07 | Performance baseline | TODO | `tests/performance/` | k6 or locust scripts for upload + plot queries |
| P9-08 | Mode-driven network exposure + production config guards | DONE (2026-03-10) | `server/config.py`, `server/settings.yaml`, `client/package.json`, `docker-compose.yml` | Add `app_env` mode for non-container runs, keep dev localhost-only, expose network only in production mode, and enforce production security checks (debug/cookie/jwt/CORS constraints). |
| P9-09 | Export/import admin guard router tests | DONE (2026-05-15) | `server/routers/export.py`, `tests/server/routers/test_export_router.py` | Add route-level coverage proving database portability endpoints reject unauthenticated/read-only/write users and allow admins through lightweight route contracts; fix reserved logging key on admin import upload. |
| P9-10 | Upload scope-delete ownership and cache router tests | DONE (2026-05-15) | `tests/server/routers/test_upload_router.py` | Add route-level coverage proving write-enabled users can hard-delete only fully owned program/version scopes, admins can delete mixed-owner scopes, and successful deletes invalidate event-related cache groups. |
| P9-11 | Frontend API client regression tests and Vitest wiring | DONE (2026-05-15) | `client/src/lib/api/client.test.ts`, `client/vitest.config.ts`, `docs/test-strategy.md`, `docs/tasks/P9-11.md` | Add frontend regression tests for API client credentials inclusion, error normalization, and timeout behavior; wire Vitest alias resolution for `@/` imports. |
| P9-12 | Dashboard workspace pruning contract hardening | DONE (2026-05-15) | `client/src/hooks/use-event-catalog.ts`, `client/src/components/dashboard/side-panel/LoadDataSection.tsx`, `client/src/modules/dashboard-workspace/dashboard-workspace.test.ts`, `docs/tasks/P9-12.md` | Keep selection pruning sourced from dashboard workspace dimension-filter whitelist; prevent search-only UI filtering from mutating session selection; add regression coverage for non-selectable-only selections. |

---

## Phase 10: Frontend Production Audit (DONE)

**Objective:** Systematic frontend quality improvements based on full production audit

| Task ID | Task | Status | Key Files | Details |
|---------|------|--------|-----------|---------|
| P10-01 | Add `loading.tsx` and `error.tsx` to all routes | DONE (2026-03-10) | `client/src/app/dashboard/`, `client/src/app/database/`, `client/src/app/login/`, `client/src/app/database/edit/` | Route-level loading spinners and error recovery UIs using shared components |
| P10-02 | Standardize typography with design tokens | DONE (2026-03-10) | `client/src/app/globals.css`, 10 component files | Added `text-caption` (10px) and `text-label` (11px) CSS tokens; replaced all arbitrary `text-[10px]`/`text-[11px]` |
| P10-03 | Extract shared `SidePanelLayout` component | DONE (2026-03-10) | `client/src/components/shared/SidePanelLayout.tsx`, 3 side panel files | Unified 3 duplicated side panel wrappers into single component |
| P10-04 | Replace raw `<button>` with shadcn `Button` | DONE (2026-03-10) | 11 component files | Consistent styling and keyboard accessibility across all interactive elements |
| P10-05 | Dynamic imports for dashboard | DONE (2026-03-10) | `client/src/app/dashboard/page.tsx` | Lazy-load `SidePanel` and `DashboardContent` via `next/dynamic` |
| P10-06 | Keyboard accessibility fixes | DONE (2026-03-10) | `ColorLegend.tsx`, `GridActionToolbar.tsx` | Added `role`, `tabIndex`, `onKeyDown` to clickable elements; arrow key support for toolbar drag handle |
| P10-07 | Tokenize SVG hardcoded colors | DONE (2026-03-10) | `client/src/components/charts/SVGAxes.tsx` | Replaced `#e5e7eb`, `#000000`, `#6b7280` with CSS variable references |
| P10-08 | Remove dead code | DONE (2026-03-10) | `lib/chart-core/`, `ColorGroupingPanel.tsx`, `InteractiveViewer.tsx` | Removed empty directory, eliminated duplicate `EmptyState` definitions |
| P10-09 | Bundle cleanup | DONE (2026-03-10) | `client/package.json` | Removed `radix-ui` meta-package, `tailwindcss-animate`; moved `@types/js-yaml` to devDeps |
| P10-10 | Write audit document | DONE (2026-03-10) | `docs/frontend-audit.md` | Comprehensive 10-section audit with findings, fixes, and remaining backlog |

---

## Phase 11: Architecture Deepening & Boundary Testability (DONE)

**Objective:** Deepen shallow modules across frontend/backend and move fragile integration seams behind testable boundaries.

| Task ID | Task | Status | Key Files | Details |
|---------|------|--------|-----------|---------|
| P11-01 | Frontend plot pipeline deep module (shared fetch/decode transform) | DONE (2026-03-30) | `client/src/lib/plot-pipeline.ts`, `client/src/hooks/use-lazy-plot-fetch.ts`, `client/src/hooks/use-sequential-plot-data.ts` | Unified binary plot fetch/decode lifecycle in one module consumed by both lazy and sequential hooks. |
| P11-02 | Frontend session/filter boundary helpers | DONE (2026-03-30) | `client/src/lib/session/session-sync.ts`, `client/src/hooks/use-session.ts`, `client/src/hooks/use-filter-state.ts` | Centralized session storage/sync helpers and unrendered-selection boundary logic to reduce hook-level coupling. |
| P11-03 | Backend metadata orchestration + weight range domain dedupe + protocol seam cleanup + boundary tests | DONE (2026-03-30) | `server/services/query.py`, `server/routers/dashboard.py`, `server/utils/weight_ranges.py`, `server/services/ingestion.py`, `server/services/auth.py`, `server/dependencies.py`, `server/protocols.py`, `tests/server/services/test_query_service_metadata.py`, `tests/server/utils/test_weight_ranges.py` | Moved metadata mutation orchestration into service layer, extracted shared weight bucket derivation, removed stale `UnifiedDatabase` protocol, and added boundary tests for metadata/weight logic. |
| P11-04 | Minimal DB hardening: router boundary tightening + upload query service + filter/session contract alignment + regression tests | DONE (2026-03-30) | `server/services/query.py`, `server/routers/dashboard.py`, `server/services/upload_query.py`, `server/routers/upload.py`, `server/dependencies.py`, `client/src/hooks/use-all-events.ts`, `client/src/hooks/use-event-catalog.ts`, `client/src/types/session.ts`, `client/src/lib/api/session.ts`, `tests/server/services/test_boundary_regressions.py` | Removed router DB reach-through, moved dataset read SQL behind a service boundary, aligned frontend event retrieval with backend filter semantics, tightened session request payload typing, and added service-level regression tests for DB invariants. |
| P11-05 | Database nested event tree + `display*` indirection removal + Edit Events mixed-null save fix | DONE (2026-04-16) | `client/src/components/upload/DatabaseEventTree.tsx`, `client/src/app/database/page.tsx`, `client/src/app/database/edit/page.tsx` | Replaced the flat Database table with a nested Program > Version > Event `Collapsible` tree, scoped status and delete to the level where they are semantically meaningful, removed the stale `display*` / `meta:*` column-key indirection in favor of raw `DatasetInfo` keys, and split `buildProgramVersionDraftValues` into `{ draft, baseline }` so Save correctly propagates values to mixed-null event groups. See DEC-030, DEC-031. |
| P11-06 | Dashboard workspace and filter semantics modules | DONE (2026-05-15) | `client/src/modules/dashboard-workspace/`, `client/src/components/dashboard/DashboardContent.tsx`, `server/modules/filter_semantics/`, `server/services/query.py`, `server/storage/database.py`, `tests/server/modules/filter_semantics/test_filter_semantics.py`, `tests/server/services/test_filter_semantics_integration.py` | Added deeper module interfaces for Dashboard selection/catalog/session rules and server-side filter meaning. Event, program, and version query paths now execute validated filter plans. See DEC-046 and `docs/tasks/P11-06.md`. |
| P11-07 | Database schema DDL ownership consolidation | DONE (2026-05-15) | `server/schema.yaml`, `server/storage/schema_loader.py`, `server/storage/schema_applier.py`, `server/storage/database.py`, `server/storage/migrations.py`, `tests/server/storage/test_schema_initialization.py`, `docs/database-schema.txt`, `docs/tasks/P11-07.md` | Normalized `server/schema.yaml` into the full declared DuckDB DDL registry, moved schema application behind a shared applier used by startup and migrations, kept data backfills in `_init_schema()`, and added behavior coverage for fresh initialization and additive upgrades. See DEC-049. |
| P11-08 | Declared-vs-live schema doctor classification report | DONE (2026-05-15) | `server/storage/migrations.py`, `tests/server/storage/test_schema_initialization.py`, `docs/tasks/P11-08.md` | Added schema doctor reporting in migration diff output to classify declared vs live tables as `OK`, `MISSING`, `TYPE_MISMATCH`, or `DRIFT`, while preserving existing missing/extra table compatibility fields and adding behavior coverage for all statuses. See DEC-050. |
| P11-09 | Data backfill extraction from schema initialization path | DONE (2026-05-15) | `server/storage/data_backfills.py`, `server/storage/database.py`, `tests/server/storage/test_schema_initialization.py`, `docs/database-schema.txt`, `docs/tasks/P11-09.md` | Extracted startup row-backfills into a dedicated module invoked after declared schema apply, preserving startup behavior and idempotency with focused storage coverage. See DEC-052. |
| P11-10 | Startup schema mutation ownership cleanup | DONE (2026-05-15) | `server/main.py`, `server/storage/migrations.py`, `server/storage/database.py`, `tests/server/storage/test_schema_initialization.py`, `docs/tasks/P11-10.md` | Added one canonical startup entry point that runs schema migration/apply, opens `UnifiedStore` as the connection owner, and applies startup backfills in-order without changing runtime behavior or locking model. See DEC-053. |
| P11-11 | Initial `UnifiedStore` repository extraction (users/sessions first) | DONE (2026-05-15) | `server/storage/repositories/`, `server/storage/database.py`, `tests/server/storage/test_schema_initialization.py`, `docs/tasks/P11-11.md` | Extracted low-risk `users` and `sessions` SQL operations into repository modules while keeping `UnifiedStore` as the only DuckDB connection owner and preserving existing service contracts/behavior. See DEC-054. |

---

## Phase 12: Admin User Management & Permission Tier (DONE)

**Objective:** Replace open auto-create login with a closed, admin-managed user roster that has an explicit `can_write` permission tier and a self-serve registration path defaulting to read-only.

Source: DEC-032 + plan `.cursor/plans/admin-settings-and-permissions_6df9da97.plan.md`.

| Task ID | Task | Status | Key Files | Details |
|---------|------|--------|-----------|---------|
| P12-01 | Schema migration + `UserService` + closed `AuthService.authenticate` | DONE (2026-04-22) | `server/storage/database.py`, `server/services/user.py`, `server/services/auth.py` | Added `can_write` and `last_settings_visit_at` columns (idempotent ALTERs). New `UserService` owns bootstrap_admin / list / create / update / delete / set_password / change_own_password / pending_count / mark_visited. `AuthService.authenticate` shrinks to bcrypt verify against an existing row. |
| P12-02 | Auth models + `/auth/register` and `/auth/change-password` routes with rate limits | DONE (2026-04-22) | `server/models/auth.py`, `server/routers/auth.py`, `server/middleware/rate_limiter.py`, `server/config.py` | `LoginRequest.password` is required (`min_length=8`), `RegisterRequest` and `ChangePasswordRequest` added, `CurrentUserResponse.can_write` exposed, register/auth rate-limit categories added. |
| P12-03 | Admin user management router + `require_write_or_admin` dependency + bootstrap on startup | DONE (2026-04-22) | `server/routers/admin_users.py`, `server/dependencies.py`, `server/main.py`, `server/routers/upload.py`, `server/routers/dashboard.py`, `server/models/user.py` | `/admin/users` CRUD + `reset-password` + `pending-count` + `mark-visited` (all `require_admin`). New `require_write_or_admin` applied to upload/custom-field/program-version-metadata mutations; per-version `Status` field gate stays `require_admin`. |
| P12-04 | Frontend API + auth store: `usersApi`, register/changePassword on authApi, `can_write` on `CurrentUser`, `selectIsAdmin` / `selectCanWrite` selectors | DONE (2026-04-22) | `client/src/lib/api/users.ts`, `client/src/lib/api/auth.ts`, `client/src/lib/api/client.ts`, `client/src/lib/api/index.ts`, `client/src/stores/auth-store.ts`, `client/src/types/user.ts` | Generic `patch` helper added; `usersApi` covers list/create/update/remove/resetPassword/pendingCount/markVisited. |
| P12-05 | Sidebar Settings icon + read-only nav gating | DONE (2026-04-22) | `client/src/components/layout/AppSidebar.tsx`, `client/src/components/layout/NavMain.tsx`, `client/src/types/layout.ts`, `client/src/config/sidebar-config.ts` | Settings icon as last `<SidebarContent>` item with admin tooltip + notification dot; Database/Edit Filters disabled with "Read-only access" tooltip for read-only users. |
| P12-06 | `/settings/users` admin page (monochrome shadcn) | DONE (2026-04-22) | `client/src/app/settings/users/page.tsx`, `client/src/components/ui/dialog.tsx`, `client/src/components/ui/label.tsx`, `client/src/components/ui/badge.tsx`, `client/src/components/ui/switch.tsx` | Route guard, change-my-password card, create-user dialog, user table with masked password + reset dialog, role select, write switch (forced ON for admins), delete via `AlertDialog`, `usersApi.markVisited()` on mount, "New" badge for self-registered rows since last visit. |
| P12-07 | Login Register tab + `/database` and `/database/edit` `canWrite` route guards | DONE (2026-04-22) | `client/src/app/login/page.tsx`, `client/src/app/database/page.tsx`, `client/src/app/database/edit/page.tsx` | Login page wraps Sign in + Register in shadcn `<Tabs>`; both write routes redirect read-only users to `/dashboard`. |
| P12-08 | Docs + server tests for closed login, register, permission deps, password change/reset | DONE (2026-04-22) | `docs/master-build-plan.md`, `docs/decisions/log.md`, `docs/database-schema.txt`, `docs/tasks/P12-01.md`, `tests/server/services/test_user_service.py`, `tests/server/routers/test_auth_routes.py`, `tests/server/routers/test_admin_users_router.py` | Documentation refreshed and pytest coverage added for closed-login rejection, register flow, `require_write_or_admin`, admin password reset, and self-service password change. |

---

## Phase 13: Agent Workflow Tooling (DONE)

**Objective:** Adapt the core engineering skills package for Cursor agents and configure repo-local issue tracking/domain documentation consumed by those skills.

| Task ID | Task | Status | Key Files | Details |
|---------|------|--------|-----------|---------|
| P13-01 | Cursor engineering skills + issue-tracker setup | DONE (2026-04-29) | `.cursor/skills/`, `AGENTS.md`, `CONTEXT.md`, `docs/agents/`, `docs/tasks/P13-01.md` | Ported core engineering workflow skills for Cursor, configured GitHub issue tracking and default triage labels, and added a single-context domain glossary setup. |
| P13-02 | Main webapp elements template pack | DONE (2026-05-04) | `docs/templates/main-webapp-elements/`, `docs/tasks/P13-02.md` | Added reusable architecture, audit, refactor, skill docs, and local `reference/` source copies for recreating the Dashboard app shell, navigation, login/auth, changelog, settings/users page, and supporting FastAPI user-management backend. |

---

## Phase 14: Load-Data Portability & Import Production Hardening (DONE)

**Objective:** Ship admin load-data transfer for cross-host migration and harden large ZIP import/export for production Docker deployments.

Source: DEC-062, DEC-063, CHANGELOG 1.3.0–1.3.7.

| Task ID | Task | Status | Key Files | Details |
|---------|------|--------|-----------|---------|
| P14-01 | Cross-user `data_version` sync + version label schema display | DONE (2026-05-19) | `server/routers/sync.py`, `client/src/hooks/use-data-version-sync.ts`, `client/src/components/layout/VersionLabel.tsx` | Poll `/sync/version`; header shows client/server versions and DB schema live vs target. |
| P14-02 | Re-expose admin Load Data Transfer UI on Database page | DONE (2026-05-19) | `client/src/components/upload/DatabaseSection.tsx`, `DatabaseOperationModal.tsx`, `DatabaseSidePanel.tsx` | Export/import controls visible to admins; writers see upload only. Supersedes temporary hide (P5-31). |
| P14-03 | Load-data-only portability semantics | DONE (2026-05-19) | `server/storage/database.py`, `server/services/export.py`, `tests/server/services/test_export_service.py` | Export/import processed load data only; preserve target users/config; exclude pending artifacts (DEC-062, DEC-063). |
| P14-04 | Optimistic concurrency on event metadata (HTTP 409) | DONE (2026-05-19) | `server/services/query.py`, `server/routers/dashboard.py`, `server/models/dashboard.py` | Requires `if_unmodified_since` on single-event metadata updates. |
| P14-05 | Production proxy + upload limits for large ZIPs | DONE (2026-05-19) | `Deployment/docker-compose.yml`, proxy config | Stream uploads through proxy; 60 GiB body limit; extended timeouts. |
| P14-06 | Staging DB import + persisted task state | DONE (2026-05-19) | `server/services/export.py`, `data/tmp/parquet-tasks` | Load into `dashboard.db.staging`, atomic swap; tasks survive API restart; orphan cleanup on startup. |
| P14-07 | Import progress UX + polling pause | DONE (2026-05-19) | `client/src/hooks/use-database-operation.ts`, `client/src/stores/ui-store.ts`, `use-data-version-sync.ts` | Backup/load/finalize phases; retry gateway errors; pause background sync during import. |
| P14-08 | Docker healthcheck + resource tuning for imports | DONE (2026-05-19) | `Deployment/docker-compose.yml`, `server/routers/health.py` | `/health/live` during import; 12 GiB server mem_limit; DuckDB import memory/thread limits. |
| P14-09 | Changelog page in production images | DONE (2026-05-19) | `client/src/app/changelog/page.tsx`, server Dockerfile | Bundle `CHANGELOG.md` at `/app/CHANGELOG.md`. |
| P14-10 | Documentation refresh for 1.3.x operator workflow | DONE (2026-05-21) | `docs/prd.md`, `docs/notes/database.md`, `docs/architecture/deployment-and-scaling.md`, `Deployment/README.md` | Align product docs with load-data semantics and deployment constraints. |

---

## Phase 15: Damage Inspection (IN PROGRESS)

**Objective:** Calculate per-event, per-channel fatigue damage from full-resolution RSP channel data.

Source: `docs/brainstorm/09_damage_inspection`, DEC-064.

| Task ID | Task | Status | Key Files | Details |
|---------|------|--------|-----------|---------|
| P15-01 | Inspect Damage vertical slice | DONE (2026-05-21) | `server/services/fatigue_damage.py`, `server/routers/damage.py`, `server/schema.yaml`, `client/src/app/inspect-damage/page.tsx`, `scripts/backfill-fatigue-channels.sh` | Extract notebook fatigue calculation into a pure service, store/query `Ch01`-`Ch21` full-resolution channels from DuckDB, add authenticated compute-on-read API, and wire the Inspect Damage side panel/table flow. |
| P15-02 | Header-detected damage channels | DONE (2026-05-22) | `server/services/etl/transformer.py`, `server/services/ingestion.py`, `server/services/damage_backfill.py`, `client/src/app/inspect-damage/page.tsx` | Detect `P_UG_` force/moment channels from source headers, store cleaned labels with source-order `ChNN` keys, update reprocessing/backfill, and render Inspect Damage columns from API channel metadata. |
| P15-03 | Lean plot-channel damage refactor | DONE (2026-05-22) | `server/services/damage_channels.py`, `server/services/query.py`, `server/services/ingestion.py`, `server/storage/data_backfills.py`, `client/src/app/inspect-damage/page.tsx` | Refactor Inspect Damage to derive 12 canonical damage columns from the existing plot channel map, query existing `measurements_raw.channel_name` rows, remove full-channel damage storage/backfill, and repair legacy generic channel-map names from retained previews. |

---

## Known Issues (Backlog)

Issues identified during codebase analysis, not yet assigned to a phase:

| ID | Issue | Priority |
|----|-------|----------|
| BL-01 | Responsive design not implemented (desktop-only) | Low |
| BL-02 | Loading states and error handling incomplete in some views | Medium |
| BL-03 | Edit user functionality broken (delete + re-add works) | Medium |
| BL-04 | Evaluation scripts load slowly on first visit | Low |
| BL-05 | Endpoints slow on first load (cold start) | Medium |
| BL-06 | Some card header font sizes inconsistent (admin dashboard) | Low |
| BL-07 | Dark mode CSS variables not defined | Low |
| BL-08 | Per-route metadata exports missing | Low |
| BL-09 | Form label accessibility (`<label>` + `htmlFor`) incomplete | Medium |
| BL-10 | No `<nav>` / `<aside>` semantic elements for sidebar | Low |
| BL-11 | No bundle analyzer configured | Low |
