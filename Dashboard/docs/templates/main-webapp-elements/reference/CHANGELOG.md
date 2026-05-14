# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Direct `.rsp` uploads in the Database panel, converting them through the existing channel-map-based ingestion flow.

### Changed
- Database upload now uses a single drag-and-drop import control instead of separate file and folder buttons.

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
