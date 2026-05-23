# Test Strategy

**Version:** 1.1  
**Last Updated:** 2026-05-21  
**App version:** 1.3.7

---

## 1. Testing Stack

### Backend

| Tool | Version | Purpose |
|------|---------|---------|
| pytest | >=7.4 | Test runner |
| pytest-asyncio | >=0.21 | Async test support |
| pytest-cov | >=4.1 | Coverage reporting |
| httpx | >=0.25 | API test client (async) |
| Ruff | >=0.1.9 | Linting + formatting |
| mypy | >=1.8 | Static type checking (strict mode) |

### Frontend

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | 4.x | Frontend unit tests (`client/vitest.config.ts`) |
| ESLint | 9 | Linting |
| Playwright | 1.58 | E2E browser testing (dependency present, no suite yet) |
| TypeScript | 5 | Type checking (build-time) |

---

## 2. Test Categories

### 2.1 Backend Unit Tests

**Scope:** Individual service methods and utilities in isolation.

| Area | Target Files | Coverage status |
|------|-------------|-----------------|
| Filter semantics | `server/modules/filter_semantics/` | Covered |
| Weight ranges | `server/utils/weight_ranges.py` | Covered |
| RSP converter | `server/services/etl/rsp_converter.py` | Covered |
| Export service | `server/services/export.py` | Covered (ZIP safety, load-data boundaries) |
| User service | `server/services/user.py` | Covered |
| Query/metadata | `server/services/query.py` | Partial (metadata, concurrency, cache invalidation) |
| ETL - CSV Parser | `server/services/etl/csv_parser.py` | **Gap** |
| ETL - Validator | `server/services/etl/validator.py` | **Gap** |
| ETL - Transformer | `server/services/etl/transformer.py` | **Gap** |
| Downsampling | `server/services/downsampling.py` | **Gap** |
| Auth | `server/services/auth.py` | Partial (via router tests) |
| Cache | `server/utils/cache.py` | **Gap** |
| Config | `server/config.py` | Covered |

### 2.2 Backend Integration / Router Tests

**Scope:** API endpoints with real or test DuckDB fixtures.

| Area | Target Files | Coverage status |
|------|-------------|-----------------|
| Export/import | `server/routers/export.py` | Covered (admin guards, contracts) |
| Upload | `server/routers/upload.py` | Covered (scope delete, ownership, cache) |
| Dashboard | `server/routers/dashboard.py` | Partial (metadata 409, router contracts) |
| Auth | `server/routers/auth.py` | Covered (login, register, password change) |
| Admin users | `server/routers/admin_users.py` | Covered |
| Sync | `server/routers/sync.py` | Covered |
| Health / info | `server/routers/health.py`, `info.py` | Covered |
| Storage / schema | `server/storage/` | Covered (schema init, bulk import session, migrations) |

**Current count:** ~114 pytest tests under `tests/server/`.

### 2.3 Frontend Unit Tests (Vitest)

| Area | Target Files | Coverage status |
|------|-------------|-----------------|
| API client | `client/src/lib/api/client.test.ts` | Covered |
| Sync API | `client/src/lib/api/sync.test.ts` | Covered |
| Export API helpers | `client/src/lib/api/export.test.ts` | Covered |
| Version label | `client/src/components/layout/VersionLabel.test.ts` | Covered |
| Dashboard workspace | `client/src/modules/dashboard-workspace/dashboard-workspace.test.ts` | Covered |

**Current count:** ~30 Vitest tests (5 source files). Run from `client/` with `npm run test`.

### 2.4 Frontend E2E Tests (Playwright)

| Flow | Status |
|------|--------|
| Auth (login, register, logout) | **Not written** |
| Upload CSV + channel map | **Not written** |
| Filter + plot render | **Not written** |
| Admin load-data export/import | **Not written** |
| Read-only nav gating | **Not written** |

Playwright is listed in `client/package.json` but no `tests/e2e/` suite exists yet.

### 2.5 Linting & Type Checking

| Check | Command | Scope |
|-------|---------|-------|
| Python lint | `cd server && uv run ruff check .` | Backend |
| Python types | `cd server && uv run mypy .` | Backend (strict) |
| JS lint | `cd client && npm run lint` | Frontend |
| TS types | `cd client && npm run build` | Frontend |

---

## 3. Current Gaps

| Gap | Impact | Recommendation |
|-----|--------|---------------|
| ETL unit tests missing | Parser/validator regressions possible | Add fixtures under `tests/fixtures/` and cover csv_parser, validator, transformer |
| Playwright suite absent | No automated critical-path coverage | Start with auth + upload + filter smoke tests |
| CI limited to version sync | Regressions not caught on push | Extend `.github/workflows/` with pytest + vitest + lint |
| Frontend component coverage thin | UI regressions in complex trees/modals | Add tests for `use-data-version-sync`, database operation hook |
| No load/performance tests | No baseline for upload/plot latency | Add k6 or locust scripts when baseline is defined |
| Cache layer untested | TTL/invalidation edge cases | Unit test `server/utils/cache.py` |

---

## 4. Coverage Targets

| Layer | Target | Current |
|-------|--------|---------|
| Backend unit | 80% line coverage | Below target — router/service paths prioritized first |
| Backend integration | All API routers have happy-path + guard tests | Mostly met for auth, export, upload, sync, admin |
| Frontend unit | Core API + workspace contracts | Baseline established (5 files) |
| Frontend E2E | 5 critical-path flows | 0 automated |
| Lint/type | Zero errors on CI | Manual/local only except version-sync workflow |

---

## 5. Test Data

- `server/schema.yaml` provides filter allowed values for generating valid test events
- Sample CSV files and channel maps should live in `tests/fixtures/` (partially populated)
- Backend integration tests use temporary DuckDB files via `tests/conftest.py`
- Export/import tests use in-memory or temp ZIP fixtures in `tests/server/services/test_export_service.py`

---

## 6. Test Execution

```bash
# Backend (from Dashboard/)
cd server
uv run pytest                      # all tests (~114)
uv run pytest --cov=.              # with coverage
uv run ruff check .                # lint
uv run mypy .                      # type check

# Frontend (from Dashboard/client/)
npm run lint                       # eslint
npm run build                      # type check + production build
npm run test                       # vitest unit tests (~30)

# E2E (when written)
npx playwright test
```

---

## 7. CI Today

| Workflow | Path | What it checks |
|----------|------|----------------|
| version-sync | `.github/workflows/version-sync.yml` | `VERSION`, `package.json`, `pyproject.toml`, and generated `version.ts` stay aligned |

Full test/lint CI is tracked as P9-04 in `docs/master-build-plan.md`.
