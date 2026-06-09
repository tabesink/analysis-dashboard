# Codebase Review Execution Plans v2

## Purpose

This package turns the v1 review prompt into execution-ready work for the current Dashboard repo.

It is meant for coding agents and junior developers who need to improve the app without rewriting it. Every implementation slice should follow the TDD loop:

```text
RED: write one behavior test through a public interface
GREEN: implement the smallest change that passes
REFACTOR: clean while tests stay green
```

## Repo Context

The current app is a Next.js client plus FastAPI backend with DuckDB storage. It already has auth, admin users, upload/import/export, dashboard querying, metadata editing, cache invalidation, and several backend pytest suites.

Important source areas:

- `client/src/app/`
- `client/src/components/`
- `client/src/hooks/`
- `client/src/lib/api/`
- `client/src/stores/`
- `server/routers/`
- `server/services/`
- `server/storage/`
- `server/dependencies.py`
- `tests/server/`

## Documents Included

| File | Use |
|---|---|
| `00_EXECUTION_OVERVIEW.md` | How to run the review/refactor work safely |
| `01_DISCOVERY_AND_REVIEW_PLAN.md` | Evidence-first codebase review plan |
| `02_AUTH_SECURITY_TDD_PLAN.md` | Auth, permissions, sessions, and local-network security slices |
| `03_DATA_SAFETY_TDD_PLAN.md` | DuckDB, uploads, export/import, cache, and concurrency slices |
| `04_FRONTEND_TDD_PLAN.md` | Frontend architecture, state, API client, and UI safety slices |
| `05_REFACTOR_PR_SEQUENCE.md` | Small PR order with done criteria |
| `06_OUTPUT_TEMPLATES.md` | Required tables, finding format, and checklists |

## How To Use

Start with `00_EXECUTION_OVERVIEW.md`, then run `01_DISCOVERY_AND_REVIEW_PLAN.md`.

Do not begin risky refactors until the discovery outputs exist and the first TDD slice is written. Prefer one small behavior at a time over broad cleanup.

