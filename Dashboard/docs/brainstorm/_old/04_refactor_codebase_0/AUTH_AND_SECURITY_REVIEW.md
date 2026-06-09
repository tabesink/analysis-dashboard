# Auth and Security Review

## Summary

The app uses a practical local-network auth model: bcrypt-backed users, JWTs in HttpOnly cookies, backend dependencies for authenticated/admin/write access, and DB-backed current-user resolution so role and `can_write` changes are reflected after login. This is a reasonable baseline for 5-10 internal users.

The main security gaps are coverage and documentation rather than obvious missing guards: export/import routes need explicit admin-guard tests, registration policy should be documented as open read-only self-service, and the stale "closed-registration" wording should be cleaned up in a later auth PR.

## Current Auth Flow

1. User submits credentials to `/api/v1/auth/login`.
2. `AuthService.authenticate()` verifies the password through `UserService.verify_credentials()`.
3. `server/routers/auth.py` creates a JWT and sets it in `settings.auth_cookie_name`.
4. Cookie settings are `httponly=True`, `secure=settings.auth_cookie_secure`, `samesite=settings.auth_cookie_samesite`, `max_age=settings.jwt_expiry_hours * 3600`.
5. `client/src/app/providers.tsx` calls `useAuthStore.bootstrap()`.
6. `useAuthStore.bootstrap()` calls `/api/v1/auth/me`.
7. `get_optional_user()` reads the cookie, decodes the token, and fetches the current DB user.
8. `get_current_user()`, `require_admin()`, and `require_write_or_admin()` enforce backend route access.

## Current Registration Policy

Self-service registration is intentionally treated as open for the local-network deployment. The current route creates a read-only user and signs them in:

- `server/routers/auth.py`
- `server/services/user.py`
- `tests/server/routers/test_auth_routes.py`
- `client/src/stores/auth-store.ts`
- `client/src/lib/api/auth.ts`

Important constraint: open registration does not imply write access. New users get `role="user"` and `can_write=False`.

## Authorization Model

| Dependency/helper | Location | Meaning |
|---|---|---|
| `get_optional_user` | `server/dependencies.py` | Return user or `None` from auth cookie |
| `get_current_user` | `server/dependencies.py` | Require authenticated user |
| `require_admin` | `server/dependencies.py` | Require `role == "admin"` |
| `require_write_or_admin` | `server/dependencies.py` | Require admin or `can_write` |
| `get_is_admin` | `server/dependencies.py` | Optional boolean admin helper |

Admin can:

- manage users in `server/routers/admin_users.py`
- access export/import in `server/routers/export.py`
- perform all write-enabled operations
- bypass owner-only delete/update restrictions where implemented

Read-only registered users can:

- authenticate
- view normal dashboard/database surfaces that backend allows
- change their own password
- create user-scoped sessions

Write-enabled users can:

- perform selected write routes guarded by `WriteUserDep`
- delete only owned program/version scopes when ownership checks require it

## Security Baseline

| Area | Current state | Evidence | Notes |
|---|---|---|---|
| Passwords | Stored as hashes through `UserService` | `server/services/auth.py`, `server/services/user.py`, tests | Good baseline; no plaintext password use seen in auth flow |
| Session/token storage | JWT stored in HttpOnly cookie | `server/routers/auth.py` | Good for frontend XSS risk compared with localStorage |
| Token freshness | `/auth/me` fetches fresh DB user | `server/routers/auth.py`, `server/dependencies.py` | Role changes can take effect after current-user refresh |
| Cookie policy | Secure/SameSite configurable; production validator enforces safer defaults | `server/config.py` | LAN escape hatch exists via `allow_insecure_cookies` |
| CORS | Explicit origins from settings, credentials enabled | `server/main.py`, `server/config.py` | Production rejects wildcard unless LAN opt-out is enabled |
| Rate limiting | Middleware installed; auth/register rates configured | `server/main.py`, `server/config.py` | Good local-network baseline |
| Audit logging | Login/register/logout/admin actions log audit events | `server/routers/auth.py`, `server/routers/admin_users.py` | Good baseline |

## Route Guard Summary

| Route family | Guard | Evidence | Coverage |
|---|---|---|---|
| `/api/v1/auth/login` | Public | `server/routers/auth.py` | Tested |
| `/api/v1/auth/register` | Public, creates read-only user | `server/routers/auth.py` | Tested |
| `/api/v1/auth/change-password` | `CurrentUserDep` | `server/routers/auth.py` | Tested |
| `/api/v1/auth/me` | `CurrentUserDep` | `server/routers/auth.py` | Tested |
| `/api/v1/admin/users` | `AdminRequiredDep` | `server/routers/admin_users.py` | Tested |
| `/api/v1/export/*` | `AdminRequiredDep` | `server/routers/export.py` | Needs dedicated tests |
| `/api/v1/dashboard/*` | Router-level `Depends(get_current_user)` plus write guards on mutations | `server/routers/dashboard.py` | Partly service-tested |
| `/api/v1/upload/*` | `CurrentUserDep` or `WriteUserDep`; owner checks for deletes | `server/routers/upload.py` | Partly tested |
| `/api/v1/session/*` | `CurrentUserDep`, scoped by `current_user["id"]` | `server/routers/session.py` | Unknown |

## Findings

## Finding: Export/import admin guards need dedicated tests

**Severity:** High

**Area:** Auth / Security / Testing

**Evidence:**
- File: `server/routers/export.py`
- Function/component/route: all `/api/v1/export/*` routes
- What the code currently does: uses `AdminRequiredDep`; no dedicated export router test file is present.

**Why this matters:**
Export/import can expose or replace the full database. The guard appears correct today, but the route needs regression tests before refactoring.

**Recommended fix:**
Add `tests/server/routers/test_export_router.py` with unauthenticated, read-only user, write-enabled user, and admin cases.

**TDD slice:**
Write the failing normal-user access test first, then stub service calls so tests stay lightweight.

**Junior developer note:**
Never assume an admin-only button is enough. The backend route must reject the request.

## Finding: Auth policy wording is inconsistent

**Severity:** Low

**Area:** Auth / Documentation

**Evidence:**
- File: `server/services/auth.py`
- Function/component/route: module docstring
- What the code currently does: says "Closed-registration model" while `/api/v1/auth/register` is implemented and tested.

**Why this matters:**
Future auth work may accidentally close or remove registration because the docs disagree with tests and product intent.

**Recommended fix:**
In the auth PR, update the docstring and security docs to say self-service registration creates read-only local-network users.

**TDD slice:**
Keep `test_register_creates_read_only_user_and_logs_in` green.

**Junior developer note:**
Comments are not source of truth when tests and routes prove different behavior.

## Finding: Session cookie contract could be more explicit in tests

**Severity:** Medium

**Area:** Session / Testing

**Evidence:**
- File: `server/routers/auth.py`
- Function/component/route: `_set_auth_cookie`, `logout`, `me`
- What the code currently does: sets HttpOnly JWT cookie and clears it on logout; tests cover login and `/me` behavior but not all cookie attributes.

**Why this matters:**
Cookie settings are a core security control. Refactors to auth can accidentally weaken HttpOnly/SameSite/Secure behavior.

**Recommended fix:**
Add tests asserting the cookie is set, HttpOnly is present, logout clears it, and production settings validation remains strict.

**TDD slice:**
Extend `tests/server/routers/test_auth_routes.py`.

**Junior developer note:**
The browser cannot read HttpOnly cookies with JavaScript. That is a feature.

## Local-Network Security Notes

Intentionally not needed for this deployment unless the app becomes internet-facing:

- complex SSO integration
- multi-tenant isolation beyond owner/admin rules
- enterprise audit/reporting pipeline
- advanced bot mitigation
- public OAuth app registration

Still needed:

- strong `JWT_SECRET` in production
- explicit CORS origins for the deployed LAN host
- backend route guards on all protected routes
- admin-only export/import
- ownership checks for user-owned data
- careful upload/import validation

## Next Auth TDD Slice

Implement PR 2 by starting with export/import admin guard tests, then clean up the registration-policy wording while preserving open read-only self-service registration.

