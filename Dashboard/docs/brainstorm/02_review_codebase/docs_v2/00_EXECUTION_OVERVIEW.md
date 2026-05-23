# Execution Overview

## Goal

Review and improve the current Dashboard codebase through small, tested slices. The app already works, so the goal is safer structure, clearer boundaries, and better regression coverage without changing visible behavior unless a slice explicitly calls for it.

## Ground Rules

- Preserve existing capabilities.
- Use behavior tests through public interfaces before changing risky logic.
- Keep auth and permission checks backend-enforced.
- Keep data writes ownership-aware, transaction-aware, and cache-aware.
- Avoid broad rewrites of working dashboard, upload, or metadata flows.
- Document evidence before recommending a refactor.

## Current Architecture Snapshot

Frontend:

- Next.js App Router under `client/src/app/`
- Shared shell under `client/src/components/layout/`
- API clients under `client/src/lib/api/`
- Dashboard UI under `client/src/components/dashboard/`
- Database/upload UI under `client/src/app/database/` and `client/src/components/upload/`
- Client state under `client/src/hooks/` and `client/src/stores/`

Backend:

- FastAPI app setup in `server/main.py`
- Auth dependencies in `server/dependencies.py`
- Routers in `server/routers/`
- Business logic in `server/services/`
- DuckDB store and schema setup in `server/storage/database.py`
- Schema source documents in `server/schema.yaml` and `docs/database-schema.txt`

Tests:

- Backend pytest lives under `tests/server/`
- Run backend tests from `server/` with `uv run pytest`
- Frontend has `npm run test` wired to Vitest, but no meaningful frontend tests yet
- Playwright is present as a dependency but does not have a configured suite yet

## Execution Loop

For each slice:

1. Confirm the public behavior.
2. Write one failing test.
3. Make the smallest implementation change.
4. Run the narrow test.
5. Refactor only while green.
6. Run the relevant broader tests.
7. Update review docs and task notes if behavior or architecture changed.

## Recommended First Command Set

```bash
cd server
uv run pytest
uv run ruff check .
uv run mypy .
```

```bash
cd client
npm run lint
npm run build
```

Use narrower commands during red-green cycles, then broaden before completing a PR.

## Initial Risks To Verify

- `client/src/components/dashboard/DashboardContent.tsx` imports `@/modules/dashboard-workspace`; verify that `client/src/modules/dashboard-workspace/` exists in the working tree before dashboard work.
- `/auth/register` appears to allow self-service registration; confirm whether this is intentional for the local-network deployment.
- `server/routers/export.py` is admin-facing and should have explicit router auth tests.
- `docs/architecture/database-multi-user.md` is referenced by repo instructions but may be missing.
- `client/src/app/database/page.tsx` and `client/src/app/database/edit/page.tsx` are large, high-risk files; split only behind tests or clear smoke checks.

## Completion Criteria

The work is complete when:

- `docs/refactor/` review outputs are generated or updated.
- High-risk auth and write paths have tests.
- Refactor PRs are small enough to review independently.
- Existing dashboard, database, upload, and admin-user workflows still pass smoke checks.
- No secrets, schema drift, or undocumented architecture decisions were introduced.

