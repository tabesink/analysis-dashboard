# Changelog


## [Unreleased]

### Security
- Program-version metadata updates (`PUT /api/v1/dashboard/program-version/metadata`) now require write permission; read-only users can no longer bypass the edit-page route guard via direct API calls.

### Added
- Inspect Damage calculates per-event fatigue damage for the 12 canonical channels derived from the existing plot channel map.

### Changed
- Inspect Damage now uses canonical column labels such as `BJ X Force` and `Bushing F Z Momt`, backed by existing `measurements_raw` plot-channel rows.

## [1.3.7] - 2026-05-19

### Changed
- Staging Parquet import tunes DuckDB for large ZIPs: `preserve_insertion_order=false`, single-threaded load, 10GB staging memory limit (configurable), and a reduced live-connection cap during import.
- Docker server `mem_limit` increased to 12 GiB to match multi-gigabyte measurement imports.
- Load-data export/import now omits retained raw CSV/RSP artifacts and `ingestion_artifacts`, so portable ZIPs carry processed load data only and legacy `managed_artifacts` entries are skipped during import.
- Deployment docs clarify disk vs RAM after artifact exclusion: plan for extracted Parquet tables, staging DB, backup, and scratch margin rather than retained raw files.

## [1.3.6] - 2026-05-19

### Changed
- Parquet import/export task status is persisted under `data/tmp/parquet-tasks` so polling survives API restarts; orphaned running tasks are marked failed on startup.
- Large imports now load into an isolated `dashboard.db.staging` file and atomically replace the live database only after success, so a crash or segfault during load no longer leaves a partial `dashboard.db`. Load-data tables commit per table to reduce peak memory.
- Docker server healthcheck uses `/health/live` instead of `/health/ready` so DuckDB probes do not run against a locked database during import.

### Fixed
- Import UI no longer shows only “task state no longer available” when the server restarts mid-import: it recovers persisted task status or compares live event counts to the archive when possible.
- Readiness returns immediately while a background import is active, avoiding healthcheck hangs during heavy Parquet loads.

## [1.3.5] - 2026-05-19

### Changed
- Database import backup step reports byte-level progress during `dashboard.db` copy and shows clearer copy in the import dialog while backing up.

## [1.3.4] - 2026-05-19

### Changed
- Database import progress now reports backup, load-data, and finalization phases, retries transient server gateway errors during heavy imports, and pauses background data-version polling while an import is active.

### Fixed
- Changelog page loads in production Docker images (`CHANGELOG.md` is bundled at `/app/CHANGELOG.md`).
- React hydration error (#418) from nested `<main>` elements in the app shell layout.

## [1.3.3] - 2026-05-19

### Fixed
- LAN Docker proxy now streams large database import uploads to the API instead of buffering them on the proxy's small cache tmpfs, and the compressed import upload limit is now 60 GiB end-to-end.

## [1.3.2] - 2026-05-19

### Fixed
- Production Docker import/export now stages large Parquet ZIP temp files under `data/tmp` on the persistent data volume instead of the server container’s 128 MB `/tmp` tmpfs (fixes HTTP 500 on multi‑hundred‑MB uploads after the nginx body-size fix).

## [1.3.1] - 2026-05-19

### Fixed
- LAN Docker proxy now allows large database import uploads (`client_max_body_size` aligned with API `max_upload_size_mb`; extended API proxy timeouts for multi-GB ZIP uploads).

## [1.3.0] - 2026-05-19

### Added
- Cross-user data refresh: authenticated sessions poll for database changes and automatically refresh event catalogs, filters, and program/version lists.
- Admin-only Load Data Transfer section on the Database page for Parquet ZIP export and import.
- Version label in the header now shows client/server versions plus live and target database schema versions.

### Changed
- Event metadata updates require the row's last-modified token and return HTTP 409 when another user changed the same event first.
- Filter dropdowns and event listings now share validated server-side filter semantics for consistent results.

## [1.2.1] - 2026-05-19

### Fixed
- Production startup now reconciles declared schema DDL before runtime backfills, fixing crash loops on legacy databases missing `users.can_write`.
- Docker production server sets `MPLCONFIGDIR=/tmp/matplotlib` so matplotlib cache writes work on read-only root filesystems.

## [1.2.0] - 2026-05-15

### Added
- Direct `.rsp` uploads in the Database panel, converting them through the existing channel-map-based ingestion flow.
- Env-primary production deployment files with a one-shot LAN deployment script and version/schema status visibility.

### Changed
- Database upload now uses a single drag-and-drop import control instead of separate file and folder buttons.
- The committed server settings file is now a development template; production secrets are expected from environment variables.

### Security
- Parquet ZIP import now rejects unsafe archive paths before extraction to keep failed imports inside managed temporary directories.

## [1.1.0] - 2026-03-31

### Added
- Creator-scoped CSV upload progress over SSE with DuckDB-backed task state for durable progress visibility.
- Dataset listing pagination metadata (`total`, `limit`, `offset`, `has_more`) plus server-side global facets for filter dropdowns.
- Unified `Load Data` panel that replaces the historical/new-data split and simplifies event selection/caching behavior.
- Group-level axis sync in the plot grid so Bushing plots sync independently from BJ/Shock plots.
- Release governance tooling around root `VERSION` sync (`release_version.py`, `check_version_sync.py`, CI drift checks).

### Changed
- Database export/import UI block is temporarily hidden in the Database side panel while preserving backend portability endpoints.
- Interactive Viewer now falls back to rendered events when selected events are empty, reducing false "No curves visible" states after navigation.
- Dashboard side panel now scrolls as one column, and `Load Data` participates in shared panel scrolling to avoid nested-scroll clipping.
- Upload `Status` defaults to `Pending`, remains visible for all users, and is role-locked in the UI for non-admin users.
- Database hardening boundaries: upload dataset reads moved behind `UploadQueryService`, dashboard event username enrichment owned by service layer, and frontend event-loading contracts aligned with backend filters.
- Session API client payload typing now aligns with backend session models.

### Fixed
- Export-task polling and long-running database operations no longer fail from mixed DuckDB connection modes or stale connection handles (`ConnectionException` / `bad_weak_ptr` race path).
- Metadata update workflows now enforce service-layer ownership checks, audit logging, cache invalidation, and shared weight-range derivation with fewer router/service drift risks.

## [1.0.0] - 2026-01-26

### Added
- FastAPI server with DuckDB unified storage
- CSV data ingestion with ETL pipeline
- Dashboard API for time-series data queries
- Session management for user state persistence
- Export API for data extraction
- Next.js client with real-time data visualization
- Performance monitoring middleware
- CORS configuration for cross-origin requests

### Technical
- Python 3.11+ with FastAPI framework
- DuckDB for high-performance analytics
- Next.js 16 with React 19
- TanStack Query for data fetching
- Zustand for state management
