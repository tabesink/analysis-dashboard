# Auth and Security TDD Plan

## Goal

Make authentication, authorization, session handling, and local-network security clearer and safer while preserving the current cookie-based login flow.

## Public Interfaces

Treat these as the main testable surfaces:

- HTTP routes in `server/routers/auth.py`
- HTTP routes in `server/routers/admin_users.py`
- Auth dependencies in `server/dependencies.py`
- Auth/user services in `server/services/auth.py` and `server/services/user.py`
- Client session bootstrap through `client/src/stores/auth-store.ts`
- API calls in `client/src/lib/api/auth.ts` and `client/src/lib/api/users.ts`

## Slice A: Registration Policy

### Behavior To Confirm

The app should either intentionally allow self-service registration or explicitly disable it outside setup/admin flows.

### RED

Add a router test beside `tests/server/routers/test_auth_routes.py` that documents the desired `/auth/register` behavior.

Examples:

- If registration is closed, unauthenticated register returns a clear forbidden response.
- If registration is allowed, duplicate users and invalid roles are rejected and the policy is documented.

### GREEN

Implement the smallest change in:

- `server/routers/auth.py`
- `server/services/auth.py`
- `server/config.py`

### REFACTOR

Move policy checks into one helper if route code becomes unclear.

### Done When

- The behavior is tested.
- The deployment assumption is documented in `AUTH_AND_SECURITY_REVIEW.md`.
- No frontend-only assumption controls registration.

## Slice B: Export Admin Guard

### Behavior To Confirm

Export/import operations are admin-only.

### RED

Create `tests/server/routers/test_export_router.py` with tests for:

- unauthenticated caller is rejected
- normal user is rejected
- admin can reach the route contract

Use lightweight stubs for expensive export/import work.

### GREEN

Make only the route/dependency changes needed in:

- `server/routers/export.py`
- `server/dependencies.py`

### REFACTOR

Keep admin checks dependency-based. Do not duplicate role checks inline unless resource ownership requires extra logic.

### Done When

- Export/import auth behavior is covered.
- Tests do not perform large filesystem or DuckDB exports unless they are explicitly integration tests.

## Slice C: Permission Inventory Guardrail

### Behavior To Confirm

Every mutating route requires an authenticated user, admin user, or write-enabled user as appropriate.

### RED

Add focused tests around one missing or risky route at a time. Prefer route tests in `tests/server/routers/`.

Candidate surfaces:

- `server/routers/upload.py`
- `server/routers/dashboard.py`
- `server/routers/session.py`
- `server/routers/admin_users.py`

### GREEN

Apply route dependencies or ownership checks with the existing helpers:

- `get_current_user`
- `require_admin`
- `require_write_or_admin`

### REFACTOR

If a route mixes auth, ownership, and persistence logic, extract a service method only after tests pass.

### Done When

- Route inventory shows auth/admin/write requirements.
- New tests prevent direct API bypass by normal users.

## Slice D: Session Cookie Contract

### Behavior To Confirm

Login sets the expected HttpOnly cookie, `/auth/me` resolves the current DB user, and logout clears the cookie.

### RED

Extend `tests/server/routers/test_auth_routes.py` for cookie attributes and current-user refresh behavior.

### GREEN

Adjust:

- `server/services/auth.py`
- `server/routers/auth.py`
- `server/config.py`

### REFACTOR

Keep token construction and cookie settings centralized.

### Done When

- Tests describe login, current-user, and logout behavior.
- Token settings are documented in `AUTH_AND_SECURITY_REVIEW.md`.

## Verification Commands

```bash
cd server
uv run pytest ../tests/server/routers/test_auth_routes.py
uv run pytest ../tests/server/routers/test_admin_users_router.py
uv run pytest ../tests/server/routers/test_export_router.py
```

Before completing an auth PR:

```bash
cd server
uv run pytest
uv run ruff check .
uv run mypy .
```

