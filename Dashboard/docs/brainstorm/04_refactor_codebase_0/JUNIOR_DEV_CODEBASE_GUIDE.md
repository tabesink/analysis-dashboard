# Junior Developer Codebase Guide

## 1. What This App Does

Dashboard lets internal users log in, upload CSV/RSP data, manage uploaded program/version data, edit metadata and channel maps, view dashboard plots, and let admins manage users and portable database export/import.

The app is intended for a small local-network deployment, not a public SaaS environment.

## 2. How to Run the App Locally

Backend commands are documented in `server/main.py` and `docs/test-strategy.md`.

```bash
# backend tests/checks
cd server
uv run pytest
uv run ruff check .
uv run mypy .
```

```bash
# frontend checks
cd client
npm run lint
npm run build
npm run test
```

The frontend dev script uses port `3001` or `3002`:

```bash
cd client
npm run dev
```

The backend app can be started with the documented uvicorn command from the project root:

```bash
uv run uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload
```

## 3. Important Folders

| Folder | Purpose | Change carefully? |
|---|---|---|
| `client/src/app/` | Next.js pages, layouts, loading/error routes | Yes for large pages |
| `client/src/components/layout/` | Main app shell and navigation | Medium |
| `client/src/components/dashboard/` | Dashboard tree, side panel, plot grid, interactive viewer | Yes |
| `client/src/components/upload/` | Database upload/table/modal components | Yes |
| `client/src/hooks/` | Client data/state hooks | Yes |
| `client/src/lib/api/` | Frontend API wrappers | Yes |
| `client/src/stores/` | Zustand stores | Medium |
| `server/routers/` | FastAPI route handlers | Yes |
| `server/services/` | Business logic | Yes |
| `server/storage/` | DuckDB persistence and migrations | Yes |
| `tests/server/` | Backend pytest tests | No, add tests here first |
| `docs/` | Architecture, decisions, schema, test strategy | Keep updated |

## 4. High-Level Architecture

```text
Browser UI
   |
   v
Next.js pages and components
   |
   v
API clients in `client/src/lib/api`
   |
   v
FastAPI routers in `server/routers`
   |
   v
Auth dependencies in `server/dependencies.py`
   |
   v
Services in `server/services`
   |
   v
DuckDB + artifact files through `server/storage/database.py`
```

## 5. How Login Works

- The login page calls `authApi.login()` from `client/src/lib/api/auth.ts`.
- `authApi.login()` posts to `/api/v1/auth/login`.
- `server/routers/auth.py` calls `AuthService.authenticate()`.
- `AuthService` verifies credentials through `UserService`.
- The backend sets an HttpOnly JWT cookie.
- On app startup, `client/src/app/providers.tsx` calls `useAuthStore.bootstrap()`.
- Bootstrap calls `/api/v1/auth/me` to restore the current user.
- Logout calls `/api/v1/auth/logout`, clears the cookie, clears frontend auth state, and redirects to `/login`.

## 6. How Permissions Work

Backend permissions live in `server/dependencies.py`.

| Helper | Use |
|---|---|
| `get_current_user` | Require any logged-in user |
| `require_admin` | Require admin role |
| `require_write_or_admin` | Require admin or `can_write` |

Do not add security rules only in the frontend. Frontend redirects and disabled buttons are useful for user experience, but backend route dependencies are the actual protection.

Registration is currently open for local-network self-service and creates read-only users. Admins can later grant write access or admin role.

## 7. How API Routes Work

Most backend routes follow this pattern:

```text
request comes in
validate Pydantic model or FastAPI params
resolve current user through dependency
call service
return response model
```

Good examples:

- `server/routers/auth.py` for auth routes
- `server/routers/admin_users.py` for admin-only routes
- `server/routers/session.py` for user-scoped session routes

High-risk examples:

- `server/routers/upload.py` because it combines files, metadata, ownership, deletion, and cache invalidation
- `server/routers/export.py` because it can export/import the whole database
- `server/routers/dashboard.py` because it has many read and write routes in one file

## 8. How Data Is Stored

The app uses one DuckDB database file through `UnifiedStore` in `server/storage/database.py`.

Important stored data:

- users and roles
- sessions
- programs and events
- raw and downsampled measurements
- channel maps
- custom fields
- ingestion artifacts
- audit log

Uploaded artifacts can also be retained on disk under the configured `data_root`. The database stores artifact paths and metadata.

Schema sources:

- `server/schema.yaml`
- `server/storage/database.py`
- `docs/database-schema.txt`

Before changing schema, read and update `docs/database-schema.txt`.

## 9. Where to Make Common Changes

| Task | Start here | Notes |
|---|---|---|
| Add auth route behavior | `server/routers/auth.py`, `tests/server/routers/test_auth_routes.py` | Add route test first |
| Add admin-only endpoint | `server/dependencies.py`, `server/routers/`, `tests/server/routers/` | Use `AdminRequiredDep` |
| Change upload behavior | `server/services/ingestion.py`, `server/routers/upload.py` | Add failure/rollback test first |
| Change database table UI | `client/src/app/database/page.tsx`, `client/src/components/upload/` | Run smoke checklist |
| Change metadata editing | `client/src/app/database/edit/page.tsx`, `server/routers/dashboard.py` | Check owner/admin rules |
| Change export/import | `server/routers/export.py`, `server/services/export.py` | Admin-only and failure tests first |
| Change API error handling | `client/src/lib/api/client.ts` | Add frontend test first |
| Change dashboard selection | `client/src/components/dashboard/DashboardContent.tsx`, dashboard hooks/stores | Verify workspace module boundary |

## 10. Files to Be Careful With

- `server/storage/database.py`
- `server/services/ingestion.py`
- `server/services/export.py`
- `server/services/query.py`
- `server/dependencies.py`
- `server/config.py`
- `client/src/lib/api/client.ts`
- `client/src/app/database/page.tsx`
- `client/src/app/database/edit/page.tsx`
- `client/src/components/dashboard/DashboardContent.tsx`

## 11. Common Debugging Tips

Login fails:

- Check `/api/v1/auth/login` response.
- Check `JWT_SECRET` and settings.
- Confirm admin bootstrap ran.

API returns unauthorized:

- Confirm the browser is sending credentials.
- Check `client/src/lib/api/client.ts` uses `credentials: 'include'`.
- Check backend route dependency.

Normal user cannot write:

- This may be correct. New registrations are read-only.
- Admin must grant `can_write` in user management.

Dashboard does not build or load:

- Check `client/src/components/dashboard/DashboardContent.tsx`.
- Verify `@/modules/dashboard-workspace` exists or is intentionally relocated.

Upload fails:

- Confirm files are only CSV or only RSP, not mixed.
- Confirm `job_number` and `work_order` are present.
- Check whether a missing channel map creates pending artifacts.

Import/export fails:

- Confirm user is admin.
- Confirm the ZIP is a supported Parquet export.
- Check task status endpoint for error text.

## 12. Refactor Rules

1. Add or update a behavior test before changing risky backend logic.
2. Do not rely on frontend-only permission checks.
3. Do not commit secrets.
4. Do not change schema without updating `docs/database-schema.txt`.
5. Do not split large frontend pages until smoke checks or tests exist.
6. Keep route handlers focused on validation, auth, service call, response.
7. Keep storage details in `server/storage/database.py` or service methods.
8. Ask before changing auth policy, import/export replacement behavior, or dashboard selection semantics.

