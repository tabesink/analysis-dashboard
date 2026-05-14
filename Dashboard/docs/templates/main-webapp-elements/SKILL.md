---
name: main-webapp-elements
description: Recreate the Dashboard-style main webapp shell, icon sidebar, login/auth flow, changelog page, generic settings area, admin users page, and supporting FastAPI auth/user-management backend in another Next.js + Tailwind v4 + shadcn + FastAPI app. Use when the user wants to port the AppSidebar/main navigation, add lightweight user management, add a changelog page, or give coding agents references to implement both client and backend.
---

# Main Webapp Elements

This skill ports the canonical Dashboard app frame and user-management contract into another app. The portable artifacts in this folder are the source of truth:

- [DESIGN.md](DESIGN.md) - architecture, visual rules, client/server contracts, invariants, and failure modes.
- [AUDIT.md](AUDIT.md) - pass/fail checklist for comparing a target app against the canonical implementation.
- [REFACTOR.md](REFACTOR.md) - ordered implementation playbook.
- [reference/](reference/) - copied canonical source files that agents can inspect and port from.

The canonical implementation is split across:

- Client shell: `reference/client/src/components/layout/ClientLayout.tsx`
- Sidebar: `reference/client/src/components/layout/AppSidebar.tsx`
- Navigation: `reference/client/src/components/layout/NavMain.tsx`
- Login: `reference/client/src/app/login/page.tsx`
- Changelog: `reference/client/src/app/changelog/page.tsx`
- Users page: `reference/client/src/app/settings/users/page.tsx`
- Auth routes: `reference/server/routers/auth.py`
- Admin users routes: `reference/server/routers/admin_users.py`
- Auth/user services: `reference/server/services/auth.py`, `reference/server/services/user.py`
- Storage: `reference/server/storage/database.py`

## Stack Assumptions

The target app should use:

- Next.js App Router
- Tailwind CSS v4
- shadcn/Radix UI primitives
- lucide-react icons
- Zustand or equivalent client auth store
- FastAPI + Pydantic backend
- Cookie-based JWT auth with HttpOnly cookies
- A database layer capable of storing users and audit records

If the backend is not FastAPI, stop and ask whether to adapt the contract to the target backend framework. Do not silently implement a client-only version.

## Workflow

Track progress with this checklist:

```text
- [ ] Phase 1: Discovery
- [ ] Phase 2: Audit or scaffold inventory
- [ ] Phase 3: Plan
- [ ] Phase 4: Approval
- [ ] Phase 5: Execute
- [ ] Phase 6: Validate
```

### Phase 1: Discovery

Read [DESIGN.md](DESIGN.md) first.

Then inspect the target app:

```bash
rg -l "@import \"tailwindcss\"" --type css
rg -l "from ['\"]next/navigation['\"]" --type tsx
rg -l "from ['\"]lucide-react['\"]" --type tsx
rg -l "FastAPI|APIRouter" --type py
rg --files -g "app/layout.tsx" -g "src/app/layout.tsx"
rg --files -g "tailwind.config.*"
```

Decide the branch:

- **Scaffold**: target has no comparable shell/auth/users implementation.
- **Audit-and-align**: target already has some shell, auth, settings, or admin users implementation.
- **Backend-only**: user specifically asks only for auth/user-management APIs.
- **Client-only reference**: user asks only for docs or UI references and explicitly does not want backend implementation.

If branch is unclear, ask the user.

### Phase 2A: Audit

Use [AUDIT.md](AUDIT.md) top to bottom.

For each finding, capture:

- File path and line range
- Category number
- Severity: Critical, Warning, or Suggestion
- Current behavior
- Expected behavior from [DESIGN.md](DESIGN.md)

Do not fix findings during the audit phase.

### Phase 2B: Scaffold Inventory

Create a target path table:

```markdown
| Concern | Canonical Path | Target Path |
| ------- | -------------- | ----------- |
| Providers | `reference/client/src/app/providers.tsx` | |
| Client layout | `reference/client/src/components/layout/ClientLayout.tsx` | |
| App sidebar | `reference/client/src/components/layout/AppSidebar.tsx` | |
| Login page | `reference/client/src/app/login/page.tsx` | |
| Changelog page | `reference/client/src/app/changelog/page.tsx` | |
| Users page | `reference/client/src/app/settings/users/page.tsx` | |
| Auth router | `reference/server/routers/auth.py` | |
| Admin users router | `reference/server/routers/admin_users.py` | |
| User service | `reference/server/services/user.py` | |
| Storage | `reference/server/storage/database.py` | |
```

Confirm required shadcn primitives exist:

- `Button`
- `Card`
- `Dialog`
- `AlertDialog`
- `DropdownMenu`
- `Input`
- `Label`
- `Select`
- `Switch`
- `Table`
- `Tabs`
- `Tooltip`

Confirm backend dependencies or equivalents exist:

- FastAPI
- Pydantic
- PyJWT
- bcrypt
- pytest/TestClient or equivalent test harness

### Phase 3: Plan

Use [REFACTOR.md](REFACTOR.md)'s order. The plan must include backend and client work unless the user explicitly narrowed the scope.

For each planned change include:

- Target file path
- Canonical reference path
- Small before/after sketch when editing existing code
- Verification check

Backend must come first for full implementations:

1. Settings, persistence, and admin bootstrap.
2. Auth dependencies and services.
3. `/api/v1/auth` routes and tests.
4. `/api/v1/admin/users` routes and tests.
5. Client API adapters and auth store.
6. Providers, layout shell, sidebar, header.
7. Login, changelog, settings/users page.

### Phase 4: Approval

Present the audit report and/or plan to the user.

Do not edit files until the user approves the implementation plan.

### Phase 5: Execute

Apply approved changes in small slices.

Rules:

1. Preserve the target app's route and naming conventions where they do not conflict with the contract.
2. Keep settings generic except the Dashboard-compatible `/settings/users` surface.
3. Implement the backend user-management contract if preserving the current users page.
4. Treat DB-loaded user rows as the authorization source of truth.
5. Keep JWTs in HttpOnly cookies.
6. Do not store auth tokens in client-readable storage.
7. Do not add mobile sidebar behavior unless requested.
8. Do not rely on client-side disabled nav for security.

### Phase 6: Validate

Run relevant backend tests:

```bash
pytest tests/server/routers/test_auth_routes.py tests/server/routers/test_admin_users_router.py
```

Run relevant client checks:

```bash
npm run lint
npm run typecheck
```

If the target project uses different scripts, inspect `package.json` and use the closest equivalents.

Manual checks:

- `/login` renders without shell chrome.
- Authenticated routes render sidebar/header.
- Login/register/logout work through cookies.
- Read-only users cannot access admin users.
- Admin users can list/create/update/delete/reset users.
- Pending-user dot appears and clears.
- `/changelog` renders `reference/CHANGELOG.md`.

## Canonical Client Contract

Auth adapter:

```ts
authApi.login -> POST /api/v1/auth/login
authApi.register -> POST /api/v1/auth/register
authApi.changePassword -> POST /api/v1/auth/change-password
authApi.me -> GET /api/v1/auth/me
authApi.logout -> POST /api/v1/auth/logout
```

Users adapter:

```ts
usersApi.list -> GET /api/v1/admin/users
usersApi.create -> POST /api/v1/admin/users
usersApi.update -> PATCH /api/v1/admin/users/{user_id}
usersApi.remove -> DELETE /api/v1/admin/users/{user_id}
usersApi.resetPassword -> POST /api/v1/admin/users/{user_id}/reset-password
usersApi.pendingCount -> GET /api/v1/admin/users/pending-count
usersApi.markVisited -> POST /api/v1/admin/users/mark-visited
```

Every request must include cookies:

```ts
credentials: 'include'
```

## Canonical Backend Contract

Required dependencies:

```py
CurrentUserDep
OptionalUserDep
AdminRequiredDep
WriteUserDep
```

Required services:

```py
AuthService.authenticate()
AuthService.create_token()
AuthService.decode_token()
AuthService.get_user_from_token()

UserService.bootstrap_admin()
UserService.create_user()
UserService.list_users()
UserService.update_user()
UserService.delete_user()
UserService.reset_password()
UserService.change_own_password()
UserService.get_pending_count()
UserService.mark_settings_visited()
```

Required storage concepts:

```text
users(id, username, role, password_hash, can_write, created_at, last_login_at, last_settings_visit_at)
audit_log(action, user_id, event_id, details, created_at)
```

## Anti-Patterns

Do not:

- Build the users page against fake data when the user asked for implementable backend references.
- Use JWT claims as final authorization truth.
- Hide admin pages in the UI but leave backend routes unguarded.
- Put refresh-token or invite-only flows into the template unless requested.
- Add a broad settings framework when a generic settings shell and `/settings/users` are enough.
- Convert the changelog page to a backend endpoint unless the deployment needs it.
- Skip tests for admin-only behavior.

## Completion Response

When done, report:

1. Files changed.
2. Backend API coverage added or aligned.
3. Client shell/pages added or aligned.
4. Validation commands run and results.
5. Any target-specific assumptions or unresolved risks.
