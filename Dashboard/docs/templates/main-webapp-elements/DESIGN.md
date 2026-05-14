---
name: Main Webapp Elements
description: Canonical frontend and backend architecture for the Dashboard-style app shell, icon sidebar, login/auth flow, changelog page, generic settings area, and admin user-management surface.
canonical_implementation:
  client_shell: reference/client/src/components/layout/ClientLayout.tsx
  sidebar: reference/client/src/components/layout/AppSidebar.tsx
  navigation: reference/client/src/components/layout/NavMain.tsx
  login: reference/client/src/app/login/page.tsx
  changelog: reference/client/src/app/changelog/page.tsx
  users_page: reference/client/src/app/settings/users/page.tsx
  auth_router: reference/server/routers/auth.py
  admin_users_router: reference/server/routers/admin_users.py
  user_service: reference/server/services/user.py
  auth_service: reference/server/services/auth.py
---

# Main Webapp Elements System Architecture

## Purpose

This document is for junior developers and coding agents who need to recreate the Dashboard application's main webapp elements in another Next.js + FastAPI project.

After reading it, the implementer should be able to build:

1. A desktop-focused app shell with a fixed icon sidebar and sticky header.
2. Login/register/logout using HttpOnly cookie authentication.
3. A changelog page rendered from `reference/CHANGELOG.md`.
4. A generic settings area.
5. The current admin user-management page and the backend APIs it requires.

> The shell is a small authenticated web application frame: Next.js owns the visible chrome and page state; FastAPI owns identity, permissions, user lifecycle, and audit records.

Reference code is copied under `reference/` in this template pack. Paths such as `reference/client/src/components/layout/AppSidebar.tsx` are stable local examples for agents; when implementing in a target app, copy the pattern into that app's normal source tree path.

---

# 1. System Goal

The main webapp elements provide a repeatable authenticated product frame around project-specific pages.

The canonical implementation is intentionally compact:

- `reference/client/src/app/providers.tsx` bootstraps auth and wraps routed content in `ClientLayout`.
- `reference/client/src/components/layout/ClientLayout.tsx` skips chrome for `/login` and wraps all other routes with `SidebarProvider`, `AppSidebar`, `SiteHeader`, and a scrollable content column.
- `reference/client/src/components/layout/AppSidebar.tsx` owns the fixed icon rail, changelog item, admin settings item, pending-user dot, and login/logout footer.
- `reference/server/routers/auth.py` and `reference/server/routers/admin_users.py` provide the backend contract consumed by `reference/client/src/lib/api/auth.ts` and `reference/client/src/lib/api/users.ts`.

This template should be used when the target app needs the same shell and the same lightweight admin user management, not just similar styling.

---

# 2. Mental Model

| Project Concept | Architecture Meaning |
| --------------- | -------------------- |
| `Providers` | Client-side root wrapper that initializes auth and React Query before rendering routed pages. |
| `ClientLayout` | Global app chrome switch: login is standalone; every other route gets sidebar and header. |
| `AppSidebar` | Fixed icon-only navigation rail with auth-aware footer actions and admin settings affordance. |
| `NavMain` | Config-driven primary navigation with permission-gated disabled states. |
| `SiteHeader` | Sticky top bar for optional page title/actions and the version label. |
| `authApi` | Client adapter for `/api/v1/auth/*`. Sends cookies with every request through `client.ts`. |
| `usersApi` | Client adapter for `/api/v1/admin/users/*`. Used by the settings page and sidebar badge. |
| `AuthService` | Backend service for credential verification and JWT encode/decode. |
| `UserService` | Backend service for user creation, mutation, password lifecycle, admin bootstrap, and pending-user counts. |
| `CurrentUserDep` | FastAPI dependency that requires a valid auth cookie. |
| `AdminRequiredDep` | FastAPI dependency that requires the DB-loaded user role to be `admin`. |
| `reference/CHANGELOG.md` | Root Markdown artifact rendered directly by the Next.js changelog route. |

---

# 3. Main Architectural Principle

The frontend never treats local state or JWT claims as the authorization source of truth.

The backend decodes the JWT only to identify the `sub`, then reloads the user row from the database in `AuthService.get_user_from_token()` and `get_optional_user()` before checking role or `can_write`. This is why changing a user in `/settings/users` can take effect without issuing a new token.

Rules:

1. Store the auth token in an HttpOnly cookie, not in `localStorage` or a client store.
2. Keep permission checks on both sides: frontend disables inaccessible navigation; backend dependencies enforce real access control.
3. Keep settings content generic, but preserve the user-management API contract when porting the Dashboard users page.
4. Keep the shell desktop-focused unless the target app explicitly asks for mobile behavior.

---

# 4. High-Level Architecture

```text
Browser
  |
  v
Next.js App Router
  |
  v
client/src/app/providers.tsx
  |
  +--> useAuthStore.bootstrap()
  |      |
  |      v
  |   authApi.me() --> GET /api/v1/auth/me
  |
  v
ClientLayout
  |
  +--> /login: render page without app chrome
  |
  +--> all other routes:
         AppSidebar + SiteHeader + scrollable page content
         |
         +--> /settings/users page
         |      |
         |      v
         |   usersApi.* --> /api/v1/admin/users/*
         |
         +--> /changelog page reads CHANGELOG.md in Next.js server component

FastAPI
  |
  v
server/main.py includes routers under /api/v1
  |
  +--> server/routers/auth.py
  +--> server/routers/admin_users.py
         |
         v
      dependencies.py --> AuthService / UserService --> UnifiedStore
         |
         v
      users table + audit_log table
```

---

# 5. System Layers

## 5.1 Client Root Layer

Responsibility:

- Own root-level providers and auth bootstrap.
- Render global chrome once for routed pages.

Key files:

- `reference/client/src/app/layout.tsx`
- `reference/client/src/app/providers.tsx`
- `reference/client/src/components/layout/ClientLayout.tsx`

Inputs:

- Next.js route `children`.
- Current path from `usePathname()`.

Outputs:

- Standalone login page for `/login`.
- Sidebar/header shell for all other routes.

Must not own:

- Backend auth decisions.
- Route-specific business logic.

## 5.2 Navigation And Header Layer

Responsibility:

- Render icon-only navigation.
- Apply disabled UI states based on client auth state.
- Show version and optional header actions.

Key files:

- `reference/client/src/components/layout/AppSidebar.tsx`
- `reference/client/src/components/layout/NavMain.tsx`
- `reference/client/src/components/layout/LogoHeader.tsx`
- `reference/client/src/components/layout/SiteHeader.tsx`
- `reference/client/src/components/layout/VersionLabel.tsx`
- `reference/client/src/config/sidebar-config.ts`
- `reference/client/src/config/header-config.ts`
- `reference/client/src/types/layout.ts`
- `reference/client/src/components/ui/sidebar.tsx`

Must not own:

- Product page data loading.
- Backend authorization enforcement.

## 5.3 Auth Client Layer

Responsibility:

- Expose a small `authApi`.
- Store current user and auth status in `useAuthStore`.
- Redirect after login/register/logout.

Key files:

- `reference/client/src/lib/api/client.ts`
- `reference/client/src/lib/api/auth.ts`
- `reference/client/src/stores/auth-store.ts`
- `reference/client/src/app/login/page.tsx`

Important invariant:

- `reference/client/src/lib/api/client.ts` uses `credentials: 'include'`; the auth cookie is sent automatically.

## 5.4 Admin User Management Client Layer

Responsibility:

- Render admin-only user-management UI.
- Call `usersApi`.
- Prevent obvious self-destructive actions in the UI.
- Coordinate pending-user notification state with the sidebar.

Key files:

- `reference/client/src/app/settings/users/page.tsx`
- `reference/client/src/lib/api/users.ts`
- `reference/client/src/types/user.ts`
- `reference/client/src/components/layout/AppSidebar.tsx`

Must not own:

- Final admin authorization.
- Password hashing.
- Audit records.

## 5.5 Backend Auth And User Layer

Responsibility:

- Issue and clear auth cookies.
- Validate JWTs.
- Load current user rows from the database.
- Enforce admin and write dependencies.
- Manage user lifecycle and audit records.

Key files:

- `reference/server/main.py`
- `reference/server/dependencies.py`
- `reference/server/routers/auth.py`
- `reference/server/routers/admin_users.py`
- `reference/server/models/auth.py`
- `reference/server/models/user.py`
- `reference/server/services/auth.py`
- `reference/server/services/user.py`
- `reference/server/storage/database.py`
- `reference/server/config.py`
- `reference/server/middleware/rate_limiter.py`

Must not own:

- React UI state.
- Changelog Markdown rendering.

---

# 6. Recommended Project Structure

Use this shape when recreating the template in another app:

```text
client/
  src/
    app/
      layout.tsx
      providers.tsx
      login/
        page.tsx
        loading.tsx
        error.tsx
      changelog/
        page.tsx
      settings/
        users/
          page.tsx
    components/
      layout/
        AppSidebar.tsx
        ClientLayout.tsx
        LogoHeader.tsx
        NavMain.tsx
        SiteHeader.tsx
        VersionLabel.tsx
        index.ts
      shared/
      ui/
        sidebar.tsx
        button.tsx
        card.tsx
        dialog.tsx
        table.tsx
    config/
      sidebar-config.ts
      header-config.ts
      version.ts
    lib/
      api/
        client.ts
        auth.ts
        users.ts
    stores/
      auth-store.ts
    types/
      layout.ts
      user.ts

server/
  main.py
  dependencies.py
  config.py
  routers/
    auth.py
    admin_users.py
  models/
    auth.py
    user.py
  services/
    auth.py
    user.py
  storage/
    database.py
  middleware/
    rate_limiter.py

CHANGELOG.md
```

The settings route can grow later, but the canonical implementation currently has only `reference/client/src/app/settings/users/page.tsx`. Do not invent a rich settings system unless the target app needs one.

---

# 7. Core File And Module Responsibilities

| Path | Responsibility | Important Callers | Notes |
| ---- | -------------- | ----------------- | ----- |
| `reference/client/src/app/providers.tsx` | Create `QueryClientProvider`, call `bootstrapAuth()`, render `ClientLayout`, and mount the toaster. | `reference/client/src/app/layout.tsx` | Auth bootstrap happens once in a `useEffect`. |
| `reference/client/src/components/layout/ClientLayout.tsx` | Choose standalone login vs full app chrome. | `Providers` | Current code bypasses chrome only for exact `/login`. |
| `reference/client/src/components/layout/AppSidebar.tsx` | Render logo, primary nav, changelog, admin settings, pending-user dot, and login/logout. | `ClientLayout` | Depends on `useAuthStore` and `usersApi`. |
| `reference/client/src/components/layout/NavMain.tsx` | Render `NavigationItem[]` with active and permission-gated states. | `AppSidebar` | Hardcodes separators around `/database` and `/database/edit` in the current app. |
| `reference/client/src/components/layout/SiteHeader.tsx` | Render sticky top header, optional config-driven title/actions, and `VersionLabel`. | `ClientLayout` | `getHeaderConfig()` is exact-path based. |
| `reference/client/src/config/sidebar-config.ts` | Define main route items and permission requirements. | `AppSidebar` | `requirePermission: 'write'` disables write routes for read-only users. |
| `reference/client/src/app/login/page.tsx` | Render sign-in/register tabs and redirect to `/dashboard` after auth. | Browser route `/login` | Uses `useAuthStore.login()` and `register()`. |
| `reference/client/src/app/changelog/page.tsx` | Server-render `reference/CHANGELOG.md` through `ReactMarkdown` and `remark-gfm`. | Browser route `/changelog` | No backend API endpoint exists for changelog. |
| `reference/client/src/app/settings/users/page.tsx` | Render admin-only user table and dialogs. | Browser route `/settings/users` | Calls `usersApi` directly and redirects non-admins to `/dashboard`. |
| `reference/client/src/lib/api/auth.ts` | Client auth endpoint map. | `auth-store` | Paths are `/api/v1/auth/login`, `/register`, `/change-password`, `/me`, `/logout`. |
| `reference/client/src/lib/api/users.ts` | Client admin users endpoint map. | `settings/users`, `AppSidebar` | Base path is `/api/v1/admin/users`. |
| `reference/server/main.py` | Create FastAPI app, initialize DB/cache/session manager, bootstrap admin, mount routers. | Uvicorn | Mounts `auth` and `admin_users` under `/api/v1`. |
| `reference/server/dependencies.py` | Provide DB/services and enforce auth/admin/write dependencies. | FastAPI routers | `get_optional_user()` reads cookie and loads DB user. |
| `reference/server/routers/auth.py` | Login, register, change-password, logout, and me endpoints. | `authApi` | Sets/deletes HttpOnly cookie and writes audit events. |
| `reference/server/routers/admin_users.py` | Admin user CRUD, password reset, pending count, mark visited. | `usersApi` | All routes require `AdminRequiredDep`. |
| `reference/server/services/auth.py` | Authenticate credentials and create/decode JWTs. | `auth.py`, dependencies | JWT contains claims but DB row remains source of authorization truth. |
| `reference/server/services/user.py` | User lifecycle, bcrypt hashing, admin bootstrap, pending-user count. | `auth.py`, `admin_users.py` | Bcrypt uses cost 12. |
| `reference/server/storage/database.py` | Store users and audit log rows. | `UserService`, routers | Current delete is a hard `DELETE FROM users`. |

---

# 8. Domain Types And API Contracts

## 8.1 Current User

Client:

```ts
interface CurrentUser {
  id: string;
  username: string;
  role: 'user' | 'admin';
  can_write: boolean;
}
```

Source: `reference/client/src/lib/api/auth.ts`.

Server:

```py
class CurrentUserResponse(BaseModel):
    id: str
    username: str
    role: Literal["user", "admin"]
    can_write: bool = False
    created_at: datetime | None = None
    last_login_at: datetime | None = None
```

Source: `reference/server/models/auth.py`.

## 8.2 Admin User Row

Client:

```ts
interface AdminUser {
  id: string;
  username: string;
  role: 'user' | 'admin';
  can_write: boolean;
  created_at: string | null;
  last_login_at: string | null;
  has_password: boolean;
}
```

Source: `reference/client/src/types/user.ts`.

Server:

```py
class UserListItem(BaseModel):
    id: str
    username: str
    role: Literal["user", "admin"]
    can_write: bool
    created_at: datetime | None = None
    last_login_at: datetime | None = None
    has_password: bool = True
```

Source: `reference/server/models/user.py`.

## 8.3 Auth Endpoints

| Method | Path | Client Adapter | Backend Handler | Auth |
| ------ | ---- | -------------- | --------------- | ---- |
| `POST` | `/api/v1/auth/login` | `authApi.login` | `login()` in `reference/server/routers/auth.py` | Public |
| `POST` | `/api/v1/auth/register` | `authApi.register` | `register()` | Public |
| `POST` | `/api/v1/auth/change-password` | `authApi.changePassword` | `change_password()` | `CurrentUserDep` |
| `GET` | `/api/v1/auth/me` | `authApi.me` | `me()` | `CurrentUserDep` |
| `POST` | `/api/v1/auth/logout` | `authApi.logout` | `logout()` | Optional cookie |

## 8.4 Admin User Endpoints

| Method | Path | Client Adapter | Backend Handler | Notes |
| ------ | ---- | -------------- | --------------- | ----- |
| `GET` | `/api/v1/admin/users` | `usersApi.list` | `list_users()` | Admin only. |
| `POST` | `/api/v1/admin/users` | `usersApi.create` | `create_user()` | Creates bcrypt-hashed password. |
| `PATCH` | `/api/v1/admin/users/{user_id}` | `usersApi.update` | `update_user()` | Admin cannot change own role/write access. |
| `DELETE` | `/api/v1/admin/users/{user_id}` | `usersApi.remove` | `delete_user()` | Admin cannot delete self. Current implementation hard-deletes. |
| `POST` | `/api/v1/admin/users/{user_id}/reset-password` | `usersApi.resetPassword` | `reset_password()` | Admin resets another user's password. |
| `GET` | `/api/v1/admin/users/pending-count` | `usersApi.pendingCount` | `pending_count()` | Drives sidebar dot. |
| `POST` | `/api/v1/admin/users/mark-visited` | `usersApi.markVisited` | `mark_visited()` | Clears pending-user dot after visiting settings. |

---

# 9. Naming Conventions

Use the existing names when porting this system:

| Name | Use |
| ---- | --- |
| `AppSidebar` | The global left navigation rail. |
| `ClientLayout` | The route-shell switch. |
| `NavMain` | Config-driven primary nav renderer. |
| `SiteHeader` | Sticky top header. |
| `authApi` | Client auth adapter. |
| `usersApi` | Client admin user adapter. |
| `useAuthStore` | Client auth state store. |
| `AuthService` | Backend JWT and credential service. |
| `UserService` | Backend user lifecycle service. |
| `CurrentUserDep` | Require an authenticated user. |
| `AdminRequiredDep` | Require admin role. |
| `WriteUserDep` | Require admin or `can_write`. |

Do not rename `can_write` to `canEdit` in the API contract unless you also update every client/server type and test. The current API uses snake_case payloads because it mirrors backend Pydantic models.

---

# 10. Metadata, Configuration, And Environment Standard

Client configuration:

- `reference/client/src/config/sidebar-config.ts` returns `SidebarConfig`.
- `reference/client/src/config/header-config.ts` returns `HeaderConfig`.
- `reference/client/src/config/version.ts` provides client version data used by `VersionLabel`.
- `reference/client/src/app/globals.css` defines Tailwind v4 tokens and the `@tailwindcss/typography` plugin used by changelog prose.

Server configuration:

- `reference/server/config.py` loads YAML plus environment overrides.
- `Settings.jwt_secret` is required for token creation.
- `Settings.auth_cookie_name`, `auth_cookie_secure`, `auth_cookie_samesite`, `auth_cookie_domain`, and `jwt_expiry_hours` control auth cookie behavior.
- Production validation rejects weak/default JWT secrets, `jwt_expiry_hours > 24`, debug mode, wildcard CORS, and insecure cookies unless the LAN escape hatch is explicitly enabled.
- `RateLimitingSettings` has separate categories for auth, register, and admin endpoints.

Deployment requirement:

- The Next.js runtime must have `reference/CHANGELOG.md` available at one of the paths attempted by `reference/client/src/app/changelog/page.tsx`: `../CHANGELOG.md` or `./CHANGELOG.md` relative to `process.cwd()`.

---

# 11. System Invariants

1. `/login` renders without `AppSidebar` or `SiteHeader`.
2. Non-login routes render inside `SidebarProvider`, `AppSidebar`, `SiteHeader`, and a scrollable page content area.
3. The sidebar is fixed-width, icon-only, desktop-focused, and uses hover tooltips.
4. Admin settings appears disabled for non-admin users.
5. `requirePermission` only affects frontend navigation affordances; backend dependencies still enforce authorization.
6. All auth API requests use `credentials: 'include'`.
7. Login and register set an HttpOnly cookie and return the current user.
8. Logout clears the auth cookie and redirects the browser to `/login`.
9. JWT claims are not the final authorization truth; the backend reloads the user row from the database.
10. Admin users always satisfy write permission.
11. Admins cannot change their own role/write access and cannot delete themselves.
12. Passwords are hashed with bcrypt before storage.
13. User-management mutations write audit records.
14. The sidebar pending-user dot is best-effort and must not block navigation if the count request fails.
15. The changelog page does not call the backend; it reads Markdown from disk in a Next.js server component.

---

# 12. Core Operation: App Bootstrap

## Input

Initial browser load of any Next.js route.

## Output

Auth state becomes `authenticated` or `unauthenticated`, and the route renders with the correct shell.

## Pipeline

```text
RootLayout -> Providers -> bootstrapAuth -> authApi.me -> GET /api/v1/auth/me -> ClientLayout
```

## Algorithm

1. `reference/client/src/app/layout.tsx` renders `Providers`.
2. `reference/client/src/app/providers.tsx` creates the React Query client and calls `bootstrapAuth()` in `useEffect`.
3. `useAuthStore.bootstrap()` calls `authApi.me()`.
4. `authApi.me()` calls `GET /api/v1/auth/me` with cookies included.
5. `reference/server/routers/auth.py` requires `CurrentUserDep`.
6. `reference/server/dependencies.py` reads the auth cookie, decodes it, loads the DB user, and returns the current user.
7. `ClientLayout` renders login standalone or app chrome based on `pathname`.

## Acceptance Criteria

- Anonymous users can load `/login` without sidebar/header.
- Authenticated users reload a protected route and keep their current user state.
- Missing or invalid auth cookies become `unauthenticated`, not a crash.

---

# 13. Core Operation: Login And Registration

## Input

Username and password from `reference/client/src/app/login/page.tsx`.

## Output

HttpOnly auth cookie plus `CurrentUser` in `useAuthStore`.

## Pipeline

```text
LoginPage form -> useAuthStore.login/register -> authApi -> /api/v1/auth -> AuthService/UserService -> users table
```

## Algorithm

1. Sign-in tab calls `login(username.trim(), password)`.
2. Register tab validates password length and confirmation, then calls `register(username.trim(), password)`.
3. Backend login uses `AuthService.authenticate()`, which verifies bcrypt credentials and stamps `last_login_at`.
4. Backend register uses `UserService.create_user()` with `role="user"` and `can_write=False`.
5. `_set_auth_cookie()` signs a JWT and sets `httponly=True`, configured `secure`, `samesite`, `domain`, and `path="/"`.
6. The client redirects to `/dashboard`.

## Acceptance Criteria

- Successful login returns `200` and a current user.
- Successful registration returns `201`, creates a read-only user, and signs the user in.
- Invalid credentials return a generic `401` message.
- New accounts are read-only until an admin grants write permission.

---

# 14. Core Operation: Sidebar Navigation

## Input

Current route, current auth state, and `SidebarConfig`.

## Output

Icon-only sidebar with active route, disabled permission-gated items, changelog, settings, and auth footer.

## Pipeline

```text
AppSidebar -> getSidebarConfig -> NavMain -> useAuthStore selectors -> SidebarMenuButton
```

## Algorithm

1. `AppSidebar` gets current `pathname`, user, auth status, `logout`, and admin flag.
2. It renders `LogoHeader` in `SidebarHeader`.
3. It passes `sidebarConfig.navMain` into `NavMain`.
4. `NavMain` checks `requirePermission` against `selectIsAdmin` and `selectCanWrite`.
5. Permitted items render as `Link`; unpermitted items render as inert disabled buttons.
6. Changelog is rendered as a bottom content item before the footer.
7. Admin settings renders as a link only for admins and shows a red dot when `pendingCount > 0`.
8. Footer shows logout for authenticated users and login for anonymous users.

## Acceptance Criteria

- The active route uses `bg-sidebar-accent` and active icon foreground.
- Read-only users see write-required routes disabled.
- Non-admin users cannot activate settings.
- Logout clears auth state and sends the browser to `/login`.

---

# 15. Core Operation: Admin User Management

## Input

Admin opens `/settings/users`.

## Output

Admin can list, create, update, reset password, and delete users subject to self-protection rules.

## Pipeline

```text
SettingsUsersPage -> usersApi -> /api/v1/admin/users -> AdminRequiredDep -> UserService -> UnifiedStore
```

## Algorithm

1. `SettingsUsersPage` reads `status`, `currentUser`, and `selectIsAdmin`.
2. If auth is settled and the user is not admin, the page redirects to `/dashboard`.
3. Admin mount calls `usersApi.list()` and `usersApi.markVisited()`.
4. Create dialog posts `CreateUserPayload`.
5. Role/write controls patch `UpdateUserPayload`.
6. Reset dialog posts `{ new_password }`.
7. Delete confirmation calls `DELETE /api/v1/admin/users/{user_id}`.
8. Backend routes enforce `AdminRequiredDep`.
9. Backend routes reject self role/write mutation and self deletion.
10. `UserService` hashes passwords, forces admin write access through storage behavior, and writes updates through `UnifiedStore`.

## Acceptance Criteria

- Non-admin users cannot fetch the list: anonymous gets `401`, regular user gets `403`.
- Admins can list, create, update, reset, and delete other users.
- Promoting a user to admin returns `can_write: true`.
- Password reset allows the target user to log in with the new password.
- Pending count drops to zero after `mark-visited`.

Behavioral examples live in `reference/tests/server/routers/test_admin_users_router.py`.

---

# 16. Core Operation: Changelog

## Input

Browser route `/changelog`.

## Output

Rendered Markdown changelog inside the app shell.

## Pipeline

```text
/changelog route -> getChangelogMarkdown -> read CHANGELOG.md -> ReactMarkdown + remarkGfm
```

## Algorithm

1. `reference/client/src/app/changelog/page.tsx` runs as an async server component.
2. It tries `resolve(process.cwd(), "..", "CHANGELOG.md")`.
3. It falls back to `resolve(process.cwd(), "CHANGELOG.md")`.
4. It renders Markdown with `ReactMarkdown` and `remarkGfm`.
5. External `http(s)` links get `target="_blank"` and `rel="noreferrer"`.
6. Missing files render a bordered fallback message.

## Acceptance Criteria

- `/changelog` renders under `AppSidebar` and `SiteHeader`.
- Markdown tables render correctly through `remark-gfm`.
- Missing `reference/CHANGELOG.md` shows a friendly fallback, not a server crash.

---

# 17. Visual Design Rules

## Shell

Use the current `ClientLayout` structure:

```tsx
<SidebarProvider className="h-screen overflow-hidden">
  <div className="flex h-full flex-1 overflow-hidden">
    <AppSidebar />
    <SidebarInset className="min-h-0 flex flex-col overflow-hidden">
      <SiteHeader />
      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>
    </SidebarInset>
  </div>
</SidebarProvider>
```

Template improvement:

- Avoid nested semantic `<main>` landmarks. In the current code, `SidebarInset` renders a `main` and `ClientLayout` renders another `main`. When porting, make one of those a `div` or remove the inner `main`.

## Sidebar

Use:

- `Sidebar collapsible="none"`
- `SidebarHeader className="py-3"`
- `SidebarContent className="py-2"`
- `SidebarMenu className="gap-2 px-1"` for main nav.
- Icons with `className="size-5 transition-colors"`.
- Disabled icons with `text-sidebar-foreground/40`.
- Active item class `bg-sidebar-accent shadow-sm`.

## Header

Use:

```tsx
<header className="flex h-12 shrink-0 items-center border-b border-border/50 bg-background/95 backdrop-blur-subtle w-full sticky top-0 z-10">
```

Place page actions and `VersionLabel` on the right.

## Page Content

Use constrained content wrappers:

- Changelog: `mx-auto w-full max-w-4xl px-6 py-8 md:px-8 md:py-10`
- Users: `mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10`

Use shadcn `Card`, `Table`, `Dialog`, `AlertDialog`, `DropdownMenu`, `Input`, `Label`, `Select`, `Switch`, and `Badge` for the users page.

## Login

Use:

```tsx
<main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
  <div className="w-full max-w-sm">
    <Card>...</Card>
  </div>
</main>
```

---

# 18. Backend Storage Model

The canonical implementation stores users in `reference/server/storage/database.py`.

Required `users` fields:

| Field | Purpose |
| ----- | ------- |
| `id` | Stable internal user id. |
| `username` | Unique login name. |
| `role` | `user` or `admin`. |
| `password_hash` | Bcrypt hash. |
| `can_write` | Write permission for non-admin users. |
| `created_at` | Used by pending-user count. |
| `last_login_at` | Displayed in admin table. |
| `last_settings_visit_at` | Used to compute pending-user badge. |

Required audit fields:

| Field | Purpose |
| ----- | ------- |
| `action` | Event type such as `AUTH_LOGIN_SUCCESS` or `ADMIN_USER_CREATE`. |
| `user_id` | Acting user. |
| `event_id` | Optional domain event id. |
| `details` | JSON details. |
| `created_at` | Audit timestamp. |

If the target project changes this schema, update the target's schema source of truth and the admin routes/tests together.

---

# 19. Tests And Quality Gates

Use these source tests as behavior references:

| Test File | What It Proves |
| --------- | -------------- |
| `reference/tests/server/routers/test_auth_routes.py` | Login/register/change-password/me behavior and admin bootstrap fixtures. |
| `reference/tests/server/routers/test_admin_users_router.py` | Admin-only list, CRUD, reset password, admin write forcing, pending-count/mark-visited, write-gate behavior. |
| `reference/tests/server/routers/conftest.py` | TestClient setup, settings override, login helper. |

Minimum backend gates:

1. `GET /api/v1/admin/users` is `401` anonymous and `403` regular user.
2. Admin can create, list, update, reset password, and delete another user.
3. Admin cannot delete self or change own role/write access.
4. Registration creates read-only users.
5. `/api/v1/auth/me` reflects DB updates.
6. Rate-limit categories include auth, register, and admin.

Minimum frontend gates:

1. `/login` has no app chrome.
2. Non-login pages have sidebar/header chrome.
3. Permission-gated nav items disable correctly.
4. Admin users page redirects non-admin users.
5. Changelog renders Markdown tables.

---

# 20. Agent Operating Rules For Main Webapp Elements

## Mission

Recreate the Dashboard-style authenticated webapp frame and its backend auth/user-management contract with minimal target-specific assumptions.

## Permissions

You may:

- Copy the shell structure, class names, route patterns, API contracts, and service split from this document.
- Adapt product-specific nav items in `sidebar-config.ts`.
- Keep settings content generic outside the `/settings/users` admin surface.

You must not:

- Store JWTs in `localStorage` or `sessionStorage`.
- Treat frontend disabled nav as sufficient authorization.
- Add mobile sidebar behavior unless explicitly requested.
- Replace the backend admin guard with client-only checks.
- Invent a changelog API unless the target deployment cannot ship `reference/CHANGELOG.md` with the Next.js app.

## Workflow Rules

1. Read this `DESIGN.md`.
2. Read `AUDIT.md` if aligning an existing app.
3. Read `REFACTOR.md` before editing.
4. Confirm the target stack and route structure.
5. Implement backend auth/user APIs before wiring the admin users page.
6. Add tests for backend auth and admin users before relying on the UI.
7. Run client lint/typecheck and backend tests after implementation edits.

## Writing Style

- Cite real paths and symbols.
- Separate current canonical behavior from recommended template improvements.
- Mark project-specific choices as assumptions or open questions.

---

# 21. Common Failure Modes

## Failure Mode 1: Sidebar Appears On Login

Symptom:

```text
/login renders inside the app shell with sidebar and header.
```

Fix:

```text
Make ClientLayout bypass chrome for the login route, or define route groups that keep auth pages outside the app shell.
```

## Failure Mode 2: Client Can See Admin UI But Backend Allows Too Much

Symptom:

```text
Non-admin users can call /api/v1/admin/users directly.
```

Fix:

```text
Use AdminRequiredDep on every admin user route. Add tests for anonymous 401 and regular-user 403.
```

## Failure Mode 3: Permission Changes Do Not Take Effect

Symptom:

```text
An admin revokes write access, but the user can still call write APIs until logout.
```

Fix:

```text
Decode JWT only to identify the user, then load the current DB row before checking role/can_write.
```

## Failure Mode 4: Changelog Works Locally But Not In Docker

Symptom:

```text
/changelog shows "Unable to load changelog content" in the deployed image.
```

Fix:

```text
Include CHANGELOG.md in the runtime image at one of the paths the Next.js server component checks, or update the path list deliberately.
```

## Failure Mode 5: Admin Badge Never Clears

Symptom:

```text
The red settings dot remains after visiting /settings/users.
```

Fix:

```text
Verify usersApi.markVisited() calls POST /api/v1/admin/users/mark-visited and that UserService.mark_settings_visited() updates last_settings_visit_at.
```

## Failure Mode 6: Auth Works In Dev But Fails In Production

Symptom:

```text
Login returns 200 but the browser does not persist the session.
```

Fix:

```text
Check auth_cookie_secure, SameSite, cookie domain, HTTPS, CORS allow_credentials, and cors_origins.
```

---

# 22. Security And Privacy

Required:

1. Use HttpOnly cookies for JWT transport.
2. Require strong `jwt_secret` in production.
3. Keep `jwt_expiry_hours <= 24` in production.
4. Restrict production CORS to explicit origins.
5. Use bcrypt cost 12 or better for password hashes.
6. Return generic login errors.
7. Audit auth and admin user-management mutations.
8. Enforce admin guards server-side.

Risk decisions to revisit per target:

- Self-service registration may be inappropriate for invite-only products.
- Current user deletion is hard delete; some products need soft delete.
- Rate limiting is in-process; multi-worker deployments need a shared limiter such as Redis.
- There is no refresh-token flow; long-lived sessions require a product/security decision.

---

# 23. Definition Of Done

The template has been implemented correctly when:

1. The target app has the shell, login, changelog, settings/users page, client APIs, backend APIs, services, dependencies, persistence, and tests described here.
2. Frontend route behavior matches the canonical implementation.
3. Backend auth and admin user tests pass.
4. Important deviations are documented as explicit target decisions.
5. No auth secret, password, or JWT is exposed in client-readable storage.

---

# 24. Minimal First Task For A Coding Agent

Implement the backend auth contract first:

```text
server/config.py
server/dependencies.py
server/models/auth.py
server/models/user.py
server/services/auth.py
server/services/user.py
server/routers/auth.py
server/routers/admin_users.py
server/storage/database.py
tests/server/routers/test_auth_routes.py
tests/server/routers/test_admin_users_router.py
```

Acceptance criteria:

1. Admin bootstrap creates the initial admin when configured.
2. Login/register/logout/me work through HttpOnly cookies.
3. Admin user-management endpoints enforce `AdminRequiredDep`.
4. Tests prove non-admin users cannot call admin endpoints.

Then wire the Next.js shell and pages to the working API.

---

# 25. Final Architecture Summary

Main Webapp Elements is an authenticated web application frame with five layers:

```text
Next.js providers -> App shell -> Client API adapters -> FastAPI routers -> Services + database
```

It has five core actions:

```text
Bootstrap auth -> Navigate shell -> Login/register/logout -> Manage users -> Render changelog
```

It becomes reusable because:

1. Navigation is config-driven and permission-aware.
2. Settings are generic except for the explicitly documented admin users page.
3. The backend contract is small, testable, and mapped directly to client adapters.
4. Security-critical behavior lives in backend dependencies and services, not in UI conditionals.
