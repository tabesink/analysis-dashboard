---
name: single-machine-session-enforcement
overview: Implement lightweight server-enforced single-machine sessions where the latest login invalidates prior machine tokens, and logout invalidates all active tokens for the account. Keep frontend changes minimal for clean UX on forced invalidation.
todos:
  - id: schema-token-version
    content: Add users.token_version with safe default and migration-compatible initialization
    status: completed
  - id: auth-version-issue-validate
    content: Issue JWT with tv on login and validate tv against DB on every authenticated request
    status: completed
  - id: logout-everywhere
    content: Bump token_version during logout before cookie deletion
    status: completed
  - id: client-401-hardening
    content: Handle auth invalidation centrally and clear local workspace session keys on logout
    status: completed
  - id: tests-single-machine-policy
    content: Add/adjust backend tests for latest-login-wins and logout-everywhere behavior
    status: completed
isProject: false
---

# Single-Machine Session Enforcement Plan

## Goal
Enforce one active machine per account using a minimal extension of the existing JWT-cookie auth model:
- Latest login wins (new login invalidates previous machine tokens)
- Multiple tabs on same machine stay allowed
- Logout invalidates all account tokens (logout everywhere)

## Current-State Confirmation
The current implementation uses stateless JWT cookies without token revocation/version checks, so concurrent multi-machine login is currently possible.

Primary auth paths:
- [Dashboard/server/services/auth.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/services/auth.py)
- [Dashboard/server/dependencies.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/dependencies.py)
- [Dashboard/server/routers/auth.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/auth.py)

## Lightweight Design (Recommended)
Use `users.token_version` integer and embed it in JWT payload (`tv`):
1. On successful login, atomically increment `token_version` for that user.
2. Mint JWT with `tv = current token_version`.
3. On each authenticated request, reject token if `payload.tv != users.token_version`.
4. On logout, increment `token_version` again before deleting cookie (logout everywhere).

This is a small schema+service change and avoids introducing refresh-token/session tables.

## Planned File Changes
- Schema/data layer:
  - [Dashboard/server/schema.yaml](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/schema.yaml)
  - [Dashboard/server/storage/database.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/storage/database.py)
  - [Dashboard/server/storage/repositories/users_repository.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/storage/repositories/users_repository.py)
- Auth flow:
  - [Dashboard/server/services/auth.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/services/auth.py)
  - [Dashboard/server/dependencies.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/dependencies.py)
  - [Dashboard/server/routers/auth.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/server/routers/auth.py)
- Minimal client UX hardening:
  - [Dashboard/client/src/lib/api/client.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/lib/api/client.ts)
  - [Dashboard/client/src/stores/auth-store.ts](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/stores/auth-store.ts)
- Tests:
  - [Dashboard/tests/server/routers/test_auth_routes.py](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/tests/server/routers/test_auth_routes.py)
  - (If needed) existing client auth/api tests under [Dashboard/client/src/lib/api](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/lib/api)

## Implementation Steps
1. Add `token_version` column (default `0`) to `users` schema and migration/init path.
2. Add repository method to increment and return the latest `token_version` atomically.
3. Update login service/router path to increment version before token issuance and include `tv` in JWT payload.
4. Update token validation (`get_user_from_token`) to require payload `tv` match current DB `token_version`; mismatch => 401.
5. Update logout path to bump `token_version` (logout everywhere), then clear cookie.
6. Add minimal client behavior for 401 session invalidation:
   - central handling to set unauthenticated state/redirect
   - clear workspace session local keys on logout
7. Add/adjust tests for:
   - second login invalidates first machine token
   - logout invalidates all prior tokens
   - same browser tabs remain functional under shared cookie

## Validation Checklist
- Machine A login works.
- Machine B login with same account succeeds.
- Machine A next API call gets 401 and is redirected to login.
- Logout on any machine invalidates all outstanding tokens for account.
- Existing auth flows (register/login/me/logout/change-password) continue passing.

## Expert Recommendations
- Keep JWT expiry unchanged initially; rely on `token_version` for deterministic revocation.
- Return a stable error code (e.g., `SESSION_SUPERSEDED`) on version mismatch for clearer UX.
- Add a brief changelog/README note so operators understand “new login ends old machine session” behavior.
- Defer device fingerprinting/session tables unless audit/history per-device control becomes a requirement.