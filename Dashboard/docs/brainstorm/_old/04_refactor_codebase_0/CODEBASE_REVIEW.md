# Codebase Review

## Executive Summary

Dashboard is a local-network data analysis app with a Next.js client, FastAPI backend, and a single DuckDB database file. The app already has meaningful production hardening: HttpOnly JWT cookies, bcrypt-backed users, role/write dependencies, DuckDB write transactions, upload artifact retention, Parquet ZIP portability, and backend pytest coverage for auth, admin users, metadata ownership, RSP conversion, and pending channel-map flows.

The main refactor need is not a rewrite. The highest-value work is to tighten tests and documentation around existing boundaries: route authorization, write-path ownership, import/export failure safety, frontend API error handling, and dashboard selection state. Large frontend pages and the missing dashboard workspace module are the biggest immediate maintainability/build risks.

## Architecture Map

```text
Browser
  |
  v
Next.js App Router (`client/src/app`)
  |
  v
API wrappers (`client/src/lib/api`)
  |
  v
FastAPI routers (`server/routers`)
  |
  v
Auth dependencies (`server/dependencies.py`)
  |
  v
Services (`server/services`)
  |
  v
DuckDB store + artifacts (`server/storage/database.py`, `data/`)
```

## Stack Summary

| Layer | Current implementation | Evidence |
|---|---|---|
| Client | Next.js App Router, React, React Query, Zustand, shadcn/Radix components | `client/package.json`, `client/src/app/providers.tsx`, `client/src/stores/auth-store.ts` |
| Backend | FastAPI app factory with CORS, gzip, rate limiter, access logging, registered routers | `server/main.py` |
| Auth | HttpOnly JWT cookie, bcrypt-backed users, DB-backed current-user lookup | `server/routers/auth.py`, `server/services/auth.py`, `server/services/user.py` |
| Database | Single DuckDB file initialized by `UnifiedStore`; shared connection serialized by `RLock` | `server/storage/database.py` |
| Uploads | CSV/RSP upload, optional `channel_map`, retained pending artifacts | `server/routers/upload.py`, `server/services/ingestion.py` |
| Portability | Admin-only Parquet ZIP export/import with background tasks and staged uploads | `server/routers/export.py`, `server/services/export.py` |
| Tests | Backend pytest suite; frontend has Vitest script but no meaningful test files yet | `tests/server/`, `client/package.json`, `docs/test-strategy.md` |

## Key Files and Responsibilities

| File or folder | Responsibility | Change carefully? |
|---|---|---|
| `server/main.py` | App lifespan, migrations, store/cache/session setup, router registration | Yes |
| `server/config.py` | Settings, secrets, production validation, CORS/cookie policy | Yes |
| `server/dependencies.py` | Service injection and auth/role dependencies | Yes |
| `server/routers/auth.py` | Login, self-registration, password change, logout, current user | Yes |
| `server/routers/admin_users.py` | Admin-only user lifecycle routes | Yes |
| `server/routers/dashboard.py` | Dashboard queries, metadata edits, filter options, channel-map editor, render routes | Yes |
| `server/routers/upload.py` | Upload, dataset listing, event delete, scope delete, purge | Yes |
| `server/routers/export.py` | Admin-only Parquet ZIP export/import task API | Yes |
| `server/services/query.py` | Dashboard reads, metadata writes, cache invalidation | Yes |
| `server/services/ingestion.py` | CSV/RSP ingestion, pending artifacts, channel-map processing | Yes |
| `server/storage/database.py` | DuckDB schema, transaction model, persistence methods | Yes |
| `client/src/app/dashboard/page.tsx` | Dashboard page auth redirect and composition | Medium |
| `client/src/components/dashboard/DashboardContent.tsx` | Dashboard tabs/action toolbar and workspace dependency | Yes |
| `client/src/app/database/page.tsx` | Large database/upload/export/import page | Yes |
| `client/src/app/database/edit/page.tsx` | Large metadata/channel-map editor page | Yes |
| `client/src/lib/api/client.ts` | Shared fetch/XHR behavior, cookies, timeout, errors | Yes |
| `client/src/stores/auth-store.ts` | Frontend auth bootstrap, login/register/logout state | Medium |

## Runtime Flow

1. `server/main.py` creates the FastAPI app.
2. App lifespan loads settings, applies migrations, creates `UnifiedStore`, creates `SimpleCache`, creates `SessionManager`, and bootstraps the configured admin user.
3. Routers are mounted under `/api/v1` except health routes.
4. The client starts in `client/src/app/providers.tsx`, creates a React Query client, and calls `useAuthStore.bootstrap()`.
5. `useAuthStore.bootstrap()` calls `/api/v1/auth/me`; backend resolves the HttpOnly cookie with `get_current_user`.
6. Protected pages redirect unauthenticated users client-side, while backend dependencies enforce actual API access.

## Route Inventory

| Route | Method | Router file | Purpose | Auth required | Admin/write required | Reads | Writes | Existing tests | Risk |
|---|---|---|---|---|---|---|---|---|---|
| `/health`, `/health/live`, `/health/ready` | GET | `server/routers/health.py` | Health checks | No | No | App/store status | No | Unknown | Low |
| `/api/v1/info` | GET | `server/routers/info.py` | App/version info | No | No | Settings/version | No | Unknown | Low |
| `/api/v1/auth/login` | POST | `server/routers/auth.py` | Authenticate and set cookie | No | No | Users | Last login, audit | `tests/server/routers/test_auth_routes.py` | Low |
| `/api/v1/auth/register` | POST | `server/routers/auth.py` | Self-service read-only registration | No | No | Users | User, last login, audit | `tests/server/routers/test_auth_routes.py` | Medium |
| `/api/v1/auth/change-password` | POST | `server/routers/auth.py` | Change own password | Yes | No | Users | Password hash, audit | `tests/server/routers/test_auth_routes.py` | Medium |
| `/api/v1/auth/logout` | POST | `server/routers/auth.py` | Clear cookie | Optional | No | User if cookie exists | Audit | Indirect | Low |
| `/api/v1/auth/me` | GET | `server/routers/auth.py` | Current user from DB | Yes | No | Users | No | `tests/server/routers/test_auth_routes.py` | Low |
| `/api/v1/admin/users*` | mixed | `server/routers/admin_users.py` | Admin user management | Yes | Admin | Users | Users, audit, settings-visited state | `tests/server/routers/test_admin_users_router.py` | Medium |
| `/api/v1/upload/folder/start` | POST | `server/routers/upload.py` | Start upload task | Yes | Current user; status constrained by role | Files, metadata | Events/artifacts/channel maps | Service tests | High |
| `/api/v1/upload/folder/events/{task_id}` | GET | `server/routers/upload.py` | Upload SSE progress | Yes | Task owner implied by current user | Upload task state | Expired task cleanup | Unknown | Medium |
| `/api/v1/upload/datasets` | GET | `server/routers/upload.py` | Database table data | Yes | No | Events/artifacts/facets | No | Unknown | Medium |
| `/api/v1/upload/events/{event_id}` | DELETE | `server/routers/upload.py` | Soft-delete one event | Yes | Owner or admin | Event | Soft delete, cache | Unknown | High |
| `/api/v1/upload/events/delete` | POST | `server/routers/upload.py` | Bulk soft delete | Yes | Owner/admin filtering | Events | Soft delete, cache | Unknown | High |
| `/api/v1/upload/program-version/delete` | POST | `server/routers/upload.py` | Hard-delete program/version scope | Yes | Write/admin plus owner rule | Events/artifacts/channel maps/files | Hard delete, cache invalidation | Service tests; `tests/server/routers/test_upload_router.py` | High |
| `/api/v1/upload/events/purge-deleted` | POST | `server/routers/upload.py` | Purge soft-deleted data | Yes | Write/admin | Deleted events | Hard delete, cache | `tests/server/routers/test_admin_users_router.py` | High |
| `/api/v1/dashboard/*` | mixed | `server/routers/dashboard.py` | Dashboard data, metadata, filters, channel maps | Router-level auth | Write/admin on mutation routes | Events/metadata/measurements | Metadata/filter/channel-map writes | Service tests | High |
| `/api/v1/session/*` | mixed | `server/routers/session.py` | User-scoped session state | Yes | Owner via user ID | Sessions | Sessions | Unknown | Medium |
| `/api/v1/export/*` | mixed | `server/routers/export.py` | Parquet ZIP export/import | Yes | Admin | DB/archive/task state | Archive staging/import replacement/task state | `tests/server/routers/test_export_router.py` | High |

## Capability Inventory

| Capability | Frontend location | API client | Backend route | Service/store | Data store | User role | Refactor risk |
|---|---|---|---|---|---|---|---|
| Login/logout/session restore | `client/src/app/login/page.tsx`, `client/src/stores/auth-store.ts` | `client/src/lib/api/auth.ts` | `server/routers/auth.py` | `AuthService`, `UserService` | `users`, audit log | Any registered user | Medium |
| Self-registration | `client/src/stores/auth-store.ts` | `authApi.register` | `/auth/register` | `UserService.create_user` | `users`, audit log | Anonymous creates read-only user | Medium |
| Admin user management | `client/src/app/settings/users/page.tsx` | `client/src/lib/api/users.ts` | `server/routers/admin_users.py` | `UserService` | `users` | Admin | Medium |
| Dashboard load/select/render | `client/src/app/dashboard/page.tsx`, `client/src/components/dashboard/` | `client/src/lib/api/dashboard.ts` | `server/routers/dashboard.py` | `QueryService`, `UnifiedStore` | events, measurements, channel maps | Authenticated user | High |
| Upload CSV/RSP | `client/src/app/database/page.tsx`, `client/src/components/upload/` | `client/src/lib/api/upload.ts` | `server/routers/upload.py` | `IngestionService` | events, measurements, artifacts | Authenticated; role affects status | High |
| Pending channel-map workflow | `client/src/app/database/edit/page.tsx` | `dashboardApi` | `server/routers/dashboard.py` | `IngestionService`, `QueryService` | artifacts, channel maps, events | Write/admin/owner-sensitive | High |
| Database table and delete | `client/src/app/database/page.tsx` | `uploadApi` | `server/routers/upload.py` | `UploadQueryService`, `UnifiedStore` | events, artifacts, files | Write/admin/owner-sensitive | High |
| Metadata edit | `client/src/app/database/edit/page.tsx` | `dashboardApi` | `server/routers/dashboard.py` | `QueryService` | dim_event, custom fields | Owner/admin/write paths | High |
| Parquet export/import | `client/src/hooks/use-database-operation.ts`, `client/src/lib/api/export.ts` | `exportApi` | `server/routers/export.py` | `ExportService` | DuckDB, ZIP temp files | Admin | High |
| Saved UI/session state | dashboard hooks/stores | `client/src/lib/api/session.ts` | `server/routers/session.py` | `SessionManager` | sessions table | Authenticated owner | Medium |

## Findings

## Finding: Dashboard workspace module import appears unresolved

**Severity:** High

**Area:** Frontend / Architecture

**Evidence:**
- File: `client/src/components/dashboard/DashboardContent.tsx`
- Function/component/route: `DashboardContent`
- What the code currently does: imports `useDashboardWorkspace` from `@/modules/dashboard-workspace`, but `client/src/modules/` has no files in the current working tree.

**Why this matters:**
This can break frontend build/runtime for the dashboard and blocks safe dashboard refactors.

**Recommended fix:**
In the next frontend slice, restore `client/src/modules/dashboard-workspace/` or update the import to the intended module location, then add a build/test guard for the workspace boundary.

**TDD slice:**
Add a focused build or module-resolution test, then behavior tests for selection pruning if the workspace module exposes pure logic.

**Junior developer note:**
Do not move dashboard selection logic back into the page just to fix the import. The goal is to keep one small module owning selection/session rules.

## Finding: Export/import admin surface now has dedicated router tests

**Severity:** Resolved (2026-05-15)

**Area:** Security / Testing

**Evidence:**
- File: `server/routers/export.py`
- Function/component/route: `/api/v1/export/*`
- What the code currently does: uses `AdminRequiredDep` on export/import routes; `tests/server/routers/test_export_router.py` now covers unauthenticated, non-admin, and admin route-contract behavior.

**Why this matters:**
The route looks correctly guarded, but export/import is destructive and admin-only. Missing tests make future regressions easy.

**Recommended fix:**
Keep the lightweight router tests in place before changing export/import internals.

**TDD slice:**
Done in `tests/server/routers/test_export_router.py` with stubbed export service behavior.

**Junior developer note:**
For admin-only routes, the test should prove that hiding buttons in the UI is not the only protection.

## Finding: Large database pages are high-conflict refactor targets

**Severity:** Medium

**Area:** Frontend / Architecture

**Evidence:**
- File: `client/src/app/database/page.tsx`
- File: `client/src/app/database/edit/page.tsx`
- What the code currently does: both files contain substantial UI state, API calls, data transformation, and permission redirects in single page files.

**Why this matters:**
Large pages are difficult to test and easy to break during unrelated UI changes.

**Recommended fix:**
Do not split broadly yet. Add smoke checks and extract one pure helper/component at a time after PR 4 frontend tests exist.

**TDD slice:**
Extract a pure database operation reducer/helper and test operation states before moving UI pieces.

**Junior developer note:**
A split is useful only if the new piece has a clear name and a small job. Avoid creating folders of tiny wrappers.

## Finding: Documentation references missing multi-user architecture doc

**Severity:** Medium

**Area:** Architecture / Documentation

**Evidence:**
- File: `AGENTS.md`
- Function/component/route: multi-user awareness instructions
- What the code currently does: references `docs/architecture/database-multi-user.md`; that file is not present in `docs/architecture/`.

**Why this matters:**
Write-path and ownership work depends on shared multi-user rules. A missing source document increases the chance of inconsistent decisions.

**Recommended fix:**
Create `docs/architecture/database-multi-user.md` or update the reference to the actual document if it was renamed.

**TDD slice:**
Documentation-only: list the current DuckDB lock model, owner/admin rules, cache invalidation rules, and export/import constraints.

**Junior developer note:**
When a repo instruction points at a missing file, treat it as a documentation bug, not as permission to invent new rules.

## Finding: Auth service documentation conflicts with open registration

**Severity:** Low

**Area:** Auth / Documentation

**Evidence:**
- File: `server/services/auth.py`
- Function/component/route: module docstring
- What the code currently does: says "Closed-registration model"; `server/routers/auth.py` implements `/auth/register`, and tests assert read-only self-registration works.

**Why this matters:**
The code and tests support open local self-registration, but the docstring can mislead future agents into closing registration accidentally.

**Recommended fix:**
In the auth slice, update terminology to "self-service read-only registration" if product policy remains open.

**TDD slice:**
Keep or extend `test_register_creates_read_only_user_and_logs_in`.

**Junior developer note:**
Tests are stronger evidence than stale comments. Do not change registration policy without an explicit product decision.

## Risk Matrix

| Risk | Severity | Likelihood | User impact | Evidence | Proposed TDD slice | Fix phase |
|---|---|---|---|---|---|---|
| Dashboard build/runtime break from missing workspace module | High | High | Dashboard may not load | `DashboardContent.tsx`, empty `client/src/modules/` | Module import/build guard | PR 5 |
| Export/import authorization regression | High | Low | Non-admin could access portability operations if a future edit drops guards | `server/routers/export.py`, `tests/server/routers/test_export_router.py` | Export admin guard tests added | DONE (2026-05-15) |
| Upload/import failure corrupts or partially exposes data | High | Medium | Bad data, stale artifacts, stale cache | `server/services/ingestion.py`, `server/storage/database.py`, `tests/server/routers/test_upload_router.py` | Failed upload rollback/retention tests; scope-delete route ownership/cache covered | PR 3 |
| Large database pages become unreviewable | Medium | High | UI regressions and merge conflicts | `client/src/app/database/page.tsx`, `client/src/app/database/edit/page.tsx` | Pure helper tests before extraction | PR 6 |
| Missing multi-user architecture doc | Medium | High | Inconsistent owner/cache/write decisions | missing `docs/architecture/database-multi-user.md` | Documentation slice | PR 1 or PR 7 |
| Frontend has test script but no useful test coverage | Medium | High | API/state regressions caught late | `client/package.json`, no client tests found | API client Vitest test | PR 4 |

## Recommended First Pull Requests

1. PR 3: Add data-safety tests for failed upload/import, scope delete ownership, and cache invalidation.
2. PR 4/5: Add frontend API-client tests, then fix/stabilize the dashboard workspace module boundary.

