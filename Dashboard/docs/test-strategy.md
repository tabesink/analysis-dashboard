# Test Strategy

**Version:** 1.0
**Last Updated:** 2026-03-09

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
| ESLint | 9 | Linting |
| Playwright | 1.58 | E2E browser testing |
| TypeScript | 5 | Type checking (build-time) |

---

## 2. Test Categories

### 2.1 Backend Unit Tests

**Scope:** Individual service methods and utilities in isolation.

| Area | Target Files | Key Tests |
|------|-------------|-----------|
| ETL - CSV Parser | `server/services/etl/csv_parser.py` | RSP-format parsing, `#DATA`/`#TITLES` markers, malformed files |
| ETL - Validator | `server/services/etl/validator.py` | Duplicate hash detection, NaN limits, row count, monotonicity |
| ETL - Transformer | `server/services/etl/transformer.py` | Wide-to-long conversion, column mapping |
| Downsampling | `server/services/downsampling.py` | LTTB output length, inflection preservation, edge cases |
| Auth | `server/services/auth.py` | JWT creation/decode, bcrypt verify, expiry handling |
| Session | `server/services/session.py` | TTL enforcement, JSON field handling |
| Custom Fields | `server/services/custom_fields.py` | Definition CRUD, program-scoped values |
| Cache | `server/utils/cache.py` | TTL expiry, thread safety, invalidation |
| Config | `server/config.py` | YAML loading, env override priority |

### 2.2 Backend Integration Tests

**Scope:** API endpoints with real DuckDB (in-memory or temp file).

| Area | Target Files | Key Tests |
|------|-------------|-----------|
| Upload | `server/routers/upload.py` | Full ingestion flow, validation errors, duplicate rejection |
| Dashboard | `server/routers/dashboard.py` | Filter queries, partition logic, event CRUD, plot data |
| Auth | `server/routers/auth.py` | Login/logout, cookie setting, role enforcement |
| Session | `server/routers/session.py` | CRUD, user scoping, expiry |
| Export | `server/routers/export.py`, `server/services/export.py` | Parquet ZIP round-trip, streaming upload limit, task poll + download, staged upload cancel, schema validation, admin guard |
| Storage | `server/storage/database.py` | Schema init, CRUD operations, orphan detection |

### 2.3 Frontend E2E Tests (Playwright)

| Flow | Steps |
|------|-------|
| Auth | Login, redirect to dashboard, logout, redirect to login |
| Upload | Navigate to database page, upload CSV + channel_map, verify dataset appears |
| Filter | Apply global filters, verify event tree updates, verify plot data changes |
| Plot | Render grid, verify SVG plots appear, test color mode switching |
| Session | Refresh page, verify session state restored |
| Admin | Login as admin, export DB (ZIP task flow), import ZIP, manage filter options, create user |

### 2.4 Linting & Type Checking

| Check | Command | Scope |
|-------|---------|-------|
| Python lint | `ruff check server/` | Backend |
| Python types | `mypy server/` | Backend (strict) |
| JS lint | `npm run lint` | Frontend |
| TS types | `next build` (type-checks at build time) | Frontend |

---

## 3. Current Gaps

| Gap | Impact | Recommendation |
|-----|--------|---------------|
| No frontend unit tests | Component logic untested | Add Vitest + Testing Library for hooks and store testing |
| Playwright tests not written | No automated E2E coverage | Write critical-path tests for auth, upload, filter, plot flows |
| No CI pipeline | Tests don't run automatically | Add GitHub Actions workflow: lint, type-check, pytest, Playwright |
| Backend test suite incomplete | Integration paths not verified | Prioritize upload and dashboard integration tests |
| No test data fixtures | Tests depend on manual setup | Create pytest fixtures with temp DuckDB and sample CSV data |
| No load/performance tests | No baseline for regression | Add k6 or locust scripts for upload and plot query endpoints |

---

## 4. Coverage Targets

| Layer | Target | Metric |
|-------|--------|--------|
| Backend unit | 80% line coverage | pytest-cov |
| Backend integration | All API endpoints have at least one happy-path + one error test | Manual tracking |
| Frontend E2E | 5 critical-path flows automated | Playwright test count |
| Lint/type | Zero errors on CI | Ruff, mypy, ESLint, tsc |

---

## 5. Test Data

- `server/schema.yaml` provides filter allowed values for generating valid test events
- Sample CSV files and channel maps should be stored in `tests/fixtures/`
- Backend integration tests should use temporary DuckDB files (cleaned up after each test)
- Frontend E2E tests should seed data via API before running flows

---

## 6. Test Execution

```bash
# Backend
cd server
uv run pytest                      # all tests
uv run pytest --cov=server         # with coverage
uv run ruff check .                # lint
uv run mypy .                      # type check

# Frontend
cd client
npm run lint                       # eslint
npm run build                      # type check (tsc)
npx playwright test                # e2e (when written)
```
