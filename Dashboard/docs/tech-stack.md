# Tech Stack

**Version:** 1.1
**Last Updated:** 2026-05-21
**App version:** 1.3.7

---

## Backend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | FastAPI | >=0.109 | ASGI web framework |
| Server | Uvicorn | >=0.27 | ASGI server |
| Database | DuckDB | >=1.4.3 | Embedded analytical database |
| Validation | Pydantic v2 | >=2.5 | Request/response models |
| Config | pydantic-settings | >=2.1 | Settings from YAML + env |
| Data | pandas | >=2.1 | DataFrame operations |
| Data | numpy | >=1.26 | Numerical operations |
| Data | pyarrow | >=17.0 | Arrow export for fast query results |
| Plotting | matplotlib | >=3.8 | Server-side plot image generation |
| Auth | bcrypt | >=5.0 | Password hashing |
| Auth | PyJWT | >=2.11 | JWT token creation/verification |
| Config | PyYAML | >=6.0.1 | YAML config parsing |
| Upload | python-multipart | >=0.0.6 | Multipart file upload handling |
| System | psutil | >=5.9 | System resource monitoring |

**Python:** >=3.11

## Frontend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | Next.js | 16.1.6 | React framework (App Router) |
| UI Library | React | 19.2.3 | Component framework |
| Primitives | Radix UI | Various | Accessible headless components (13 packages) |
| Styling | Tailwind CSS | 4 | Utility-first CSS |
| State | Zustand | 5.0.9 | Client state management (auth, ui, render, pinned-events, plot-settings, color-selection) |
| Server State | TanStack React Query | 5.90.12 | Async state, caching, sync |
| Forms | React Hook Form | 7.69 | Form state management |
| Validation | Zod | 4.2.1 | Schema validation |
| Toasts | Sonner | 2.0.7 | Toast notifications |
| Icons | Lucide React | 0.562 | Icon library |
| Variants | class-variance-authority | 0.7.1 | Component variant styling |
| Utilities | clsx, tailwind-merge | Latest | Class name merging |

**TypeScript:** 5  |  **Node:** 20+

## Dev Tools

| Tool | Purpose |
|------|---------|
| Ruff | Python linting + formatting |
| mypy | Python static type checking |
| pytest + pytest-asyncio | Backend testing |
| pytest-cov | Coverage reporting |
| httpx | API test client |
| ESLint | Frontend linting |
| Vitest | Frontend unit tests (API client, sync, export, workspace, version label) |
| Playwright | E2E browser testing (dependency only; suite not written) |

## Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Containerization | Docker Compose | Repo-level `Deployment/docker-compose.yml` release bundle with `proxy`, `jwt-init`, `server`, and `client` services |
| Data Storage | DuckDB file | Single `dashboard.db` in `dashboard-data` volume at runtime |
| Portable backup | Parquet (ZSTD) + SQL in ZIP | Admin load-data export/import (`dashboard_export.zip`); see `docs/notes/database.md` |
| CI | GitHub Actions | Version sync workflow (`.github/workflows/version-sync.yml`) |
| Logs | Named volume | `dashboard-logs` volume |

---

## Architecture Patterns

**Dependency injection** -- FastAPI `Depends()` wires services, DB, cache, and auth guards. All service constructors receive protocols, not concrete classes.

**Protocol-driven DB abstraction** -- `UnifiedDatabase`, `SessionStorage`, `CacheProtocol` in `server/protocols.py` define interfaces. `UnifiedStore` implements them with raw SQL against DuckDB.

**Serialized DuckDB access** -- `UnifiedStore` uses one read-write DuckDB connection plus a `threading.RLock()`. Reads go through `_GuardedConnection` (execute + fetch and `description` under the lock; per-thread `last_description`). Writes use `BEGIN`/`COMMIT` on the same connection—no second connection and no closing the shared handle while other threads may still reference it (avoids mixed `read_only`/RW `ConnectionException` and `bad_weak_ptr`).

**YAML-driven code generation** -- `server/schema.yaml` defines dim tables and filter metadata. Build-time scripts generate `client/src/config/filters.ts`, `settings.ts`, and `version.ts` from YAML/VERSION files.

**LTTB downsampling** -- Ingestion pre-computes downsampled curves (`measurements_lttb`) using the Largest Triangle Three Buckets algorithm with inflection-aware extensions. Plot queries read pre-computed data.

**Binary data transfer** -- Plot data can be sent as compact binary payloads (not JSON) for large curve sets, decoded by a Web Worker on the client.

**Session persistence** -- Server-synced session state (filters, rendered events) with client-side sessionStorage backup and debounced server sync.

**Cross-user sync** -- Monotonic `data_version` in `_schema_metadata`; clients poll `/api/v1/sync/version` and invalidate TanStack Query caches on change.

**In-memory TTL cache** -- `SimpleCache` with per-key TTL for query results. Process-local (no Redis). Fine for single-instance deployment.

**Load-data portability** -- Admin export produces a Parquet ZIP of processed tables only. Import loads into a staging DuckDB file and atomically replaces live load data while preserving target users and configuration.
