# RSP Dashboard 1.3.7 Release Notes

## [1.3.7] - 2026-05-19

### Changed
- Staging Parquet import tunes DuckDB for large ZIPs: `preserve_insertion_order=false`, single-threaded load, 10GB staging memory limit (configurable), and a reduced live-connection cap during import.
- Docker server `mem_limit` increased to 12 GiB to match multi-gigabyte measurement imports.
- Load-data export/import now omits retained raw CSV/RSP artifacts and `ingestion_artifacts`, so portable ZIPs carry processed load data only and legacy `managed_artifacts` entries are skipped during import.
- Deployment docs clarify disk vs RAM after artifact exclusion: plan for extracted Parquet tables, staging DB, backup, and scratch margin rather than retained raw files.
