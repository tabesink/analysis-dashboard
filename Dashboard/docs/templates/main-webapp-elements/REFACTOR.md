# Refactor Playbook

Ordered playbook for adding or aligning the canonical main webapp elements in a target app. Apply backend foundations before client pages so the UI is wired to real contracts, not mocks.

For a new scaffold, create the listed files. For an existing app, audit first with [AUDIT.md](AUDIT.md), then apply only the needed categories in this order.

## Order

1. Stack and target route inventory
2. Backend settings, persistence, and admin bootstrap
3. Backend auth dependencies and services
4. Backend `/api/v1/auth` routes and tests
5. Backend `/api/v1/admin/users` routes and tests
6. Client API adapters and auth store
7. Client providers and layout shell
8. Sidebar navigation and header
9. Login/register page
10. Changelog page
11. Settings/users page and sidebar pending badge
12. Security, deployment, and visual parity validation

---

## 1. Stack And Target Route Inventory

Resolves audit category 1.

Confirm the target stack:

```bash
rg -l "@import \"tailwindcss\"" --type css
rg -l "from ['\"]next/navigation['\"]" --type tsx
rg -l "from ['\"]lucide-react['\"]" --type tsx
rg --files -g "app/layout.tsx" -g "src/app/layout.tsx"
rg --files -g "tailwind.config.*"
```

Expected:

- Next.js App Router.
- Tailwind v4 global stylesheet.
- shadcn/Radix UI primitives.
- lucide-react.
- FastAPI + Pydantic backend, or an explicit decision to adapt the backend contract to another framework.

Create this target map before editing:

| Concern | Canonical Path | Target Path |
| ------- | -------------- | ----------- |
| Root layout | `reference/client/src/app/layout.tsx` | |
| Providers | `reference/client/src/app/providers.tsx` | |
| Shell layout | `reference/client/src/components/layout/ClientLayout.tsx` | |
| Sidebar | `reference/client/src/components/layout/AppSidebar.tsx` | |
| Login route | `reference/client/src/app/login/page.tsx` | |
| Changelog route | `reference/client/src/app/changelog/page.tsx` | |
| Users route | `reference/client/src/app/settings/users/page.tsx` | |
| Auth router | `reference/server/routers/auth.py` | |
| Admin users router | `reference/server/routers/admin_users.py` | |
| User persistence | `reference/server/storage/database.py` | |

Verify:

- The target has a place for both client and backend code.
- Any route-group differences are written down before implementation.

---

## 2. Backend Settings, Persistence, And Admin Bootstrap

Resolves audit categories 8 and 9.

Use these reference files while creating or aligning target equivalents:

- `reference/server/config.py`
- `reference/server/storage/database.py`
- `reference/docs/database-schema.txt` or the target's schema source of truth
- `reference/server/services/user.py`

Required settings:

```py
admin_secret: str
jwt_secret: str
jwt_algorithm: str = "HS256"
jwt_expiry_hours: int = 24
auth_cookie_name: str
auth_cookie_secure: bool
auth_cookie_samesite: str
auth_cookie_domain: str | None
cors_origins: list[str]
rate_limiting: RateLimitingSettings
```

Required `users` columns:

```text
id
username
role
password_hash
can_write
created_at
last_login_at
last_settings_visit_at
```

Required `audit_log` columns:

```text
id
action
user_id
event_id
details
created_at
```

Implement:

1. `UserService.bootstrap_admin()` from `settings.admin_secret`.
2. `UserService.create_user()` with bcrypt hashing.
3. `UserService.update_user()`, `delete_user()`, `reset_password()`, `change_own_password()`.
4. `UserService.get_pending_count()` and `mark_settings_visited()`.
5. Storage methods for all user operations and audit writes.

Verify:

- Empty or missing `jwt_secret` fails token creation.
- Production settings reject weak JWT secrets and insecure cookie/CORS defaults.
- Admin bootstrap creates an `admin` user only when one does not already exist.
- Password hashes are never plaintext.

---

## 3. Backend Auth Dependencies And Services

Resolves audit category 7.

Use these reference files while creating or aligning target equivalents:

- `reference/server/dependencies.py`
- `reference/server/services/auth.py`
- `reference/server/services/user.py`

Dependency contract:

```py
CurrentUserDep = Annotated[AuthenticatedUser, Depends(get_current_user)]
OptionalUserDep = Annotated[AuthenticatedUser | None, Depends(get_optional_user)]
AdminRequiredDep = Annotated[AuthenticatedUser, Depends(require_admin)]
WriteUserDep = Annotated[AuthenticatedUser, Depends(require_write_or_admin)]
```

Service contract:

```py
class AuthService:
    def authenticate(self, username: str, password: str) -> dict: ...
    def create_token(self, user: dict) -> str: ...
    def decode_token(self, token: str) -> dict: ...
    def get_user_from_token(self, token: str) -> dict | None: ...
```

Critical rule:

`get_user_from_token()` must decode the token and then load the current user row from storage. Do not rely on stale `role` or `can_write` JWT claims for authorization.

Verify:

- Anonymous users get `401` from `CurrentUserDep`.
- Non-admin users get `403` from `AdminRequiredDep`.
- Admin users satisfy write checks.
- Non-admin users satisfy write checks only when `can_write` is true in the database.

---

## 4. Backend `/api/v1/auth` Routes And Tests

Resolves audit category 10.

Use these reference files while creating or aligning target equivalents:

- `reference/server/models/auth.py`
- `reference/server/routers/auth.py`
- `reference/tests/server/routers/test_auth_routes.py`

Routes:

| Method | Path | Handler | Expected Status |
| ------ | ---- | ------- | --------------- |
| `POST` | `/api/v1/auth/login` | `login` | `200` |
| `POST` | `/api/v1/auth/register` | `register` | `201` |
| `POST` | `/api/v1/auth/change-password` | `change_password` | `204` |
| `POST` | `/api/v1/auth/logout` | `logout` | `204` |
| `GET` | `/api/v1/auth/me` | `me` | `200` |

Request/response models:

```py
LoginRequest(username: str, password: str)
RegisterRequest(username: str, password: str)
ChangePasswordRequest(current_password: str, new_password: str)
CurrentUserResponse(id, username, role, can_write, created_at, last_login_at)
```

Cookie behavior:

```py
response.set_cookie(
    key=settings.auth_cookie_name,
    value=token,
    httponly=True,
    secure=settings.auth_cookie_secure,
    samesite=settings.auth_cookie_samesite,
    max_age=settings.jwt_expiry_hours * 3600,
    domain=settings.auth_cookie_domain,
    path="/",
)
```

Verify with tests:

- Login succeeds for valid credentials and fails generically for invalid credentials.
- Register creates a read-only `user`.
- `GET /me` requires a cookie and reflects DB changes.
- Change password requires current password.
- Logout clears the cookie.

---

## 5. Backend `/api/v1/admin/users` Routes And Tests

Resolves audit category 11.

Use these reference files while creating or aligning target equivalents:

- `reference/server/models/user.py`
- `reference/server/routers/admin_users.py`
- `reference/tests/server/routers/test_admin_users_router.py`

Routes:

| Method | Path | Handler | Expected Status |
| ------ | ---- | ------- | --------------- |
| `GET` | `/api/v1/admin/users` | `list_users` | `200` |
| `POST` | `/api/v1/admin/users` | `create_user` | `201` |
| `PATCH` | `/api/v1/admin/users/{user_id}` | `update_user` | `200` |
| `DELETE` | `/api/v1/admin/users/{user_id}` | `delete_user` | `204` |
| `POST` | `/api/v1/admin/users/{user_id}/reset-password` | `reset_password` | `204` |
| `GET` | `/api/v1/admin/users/pending-count` | `pending_count` | `200` |
| `POST` | `/api/v1/admin/users/mark-visited` | `mark_visited` | `204` |

Models:

```py
UserListItem(id, username, role, can_write, created_at, last_login_at, has_password)
CreateUserRequest(username, password, role="user", can_write=False)
UpdateUserRequest(role=None, can_write=None)
ResetPasswordRequest(new_password)
PendingCountResponse(count)
```

Rules:

1. Every route requires `AdminRequiredDep`.
2. Admin cannot delete self.
3. Admin cannot change own role or write access.
4. Admin role forces `can_write=True` in returned rows.
5. Mutations write audit records.

Verify with tests:

- Anonymous `GET /api/v1/admin/users` returns `401`.
- Regular user returns `403`.
- Admin can list, create, delete, update, reset passwords.
- Reset password lets the target user log in with the new password.
- Promoting to admin returns `can_write: true`.
- Pending count drops after mark visited.

---

## 6. Client API Adapters And Auth Store

Resolves audit categories 5 and 6.

Use these reference files while creating or aligning target equivalents:

- `reference/client/src/lib/api/client.ts`
- `reference/client/src/lib/api/auth.ts`
- `reference/client/src/lib/api/users.ts`
- `reference/client/src/stores/auth-store.ts`
- `reference/client/src/types/user.ts`

Required API adapters:

```ts
export const authApi = {
  login: (payload) => post('/api/v1/auth/login', payload),
  register: (payload) => post('/api/v1/auth/register', payload),
  changePassword: (payload) => post('/api/v1/auth/change-password', payload),
  me: () => get('/api/v1/auth/me'),
  logout: () => post('/api/v1/auth/logout', {}),
};

const BASE = '/api/v1/admin/users';
export const usersApi = {
  list: () => get(BASE),
  create: (payload) => post(BASE, payload),
  update: (userId, payload) => patch(`${BASE}/${userId}`, payload),
  remove: (userId) => del(`${BASE}/${userId}`),
  resetPassword: (userId, payload) => post(`${BASE}/${userId}/reset-password`, payload),
  pendingCount: () => get(`${BASE}/pending-count`),
  markVisited: () => post(`${BASE}/mark-visited`, {}),
};
```

Required fetch behavior:

```ts
credentials: 'include'
```

Auth store selectors:

```ts
selectIsAdmin: user?.role === 'admin'
selectCanWrite: user?.role === 'admin' || user?.can_write
```

Verify:

- Bootstrap maps `401` from `/me` to `unauthenticated`.
- Login/register set `user` and `authenticated`.
- Logout clears `user` and redirects to `/login`.
- No token is stored in browser-readable storage.

---

## 7. Client Providers And Layout Shell

Resolves audit categories 2 and 3.

Use these reference files while creating or aligning target equivalents:

- `reference/client/src/app/providers.tsx`
- `reference/client/src/components/layout/ClientLayout.tsx`
- `reference/client/src/components/ui/sidebar.tsx`

Canonical shell:

```tsx
<QueryClientProvider client={queryClient}>
  <ClientLayout>{children}</ClientLayout>
  <Toaster position="top-right" richColors closeButton />
</QueryClientProvider>
```

Canonical layout:

```tsx
if (pathname === '/login') return <>{children}</>;

return (
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
);
```

Template improvement:

- Avoid nested `<main>` landmarks if your `SidebarInset` already renders `main`.

Verify:

- `/login` has no app chrome.
- `/dashboard`, `/changelog`, and `/settings/users` have sidebar/header.
- Main content scrolls vertically without the sidebar/header scrolling away.

---

## 8. Sidebar Navigation And Header

Resolves audit category 4.

Use these reference files while creating or aligning target equivalents:

- `reference/client/src/components/layout/AppSidebar.tsx`
- `reference/client/src/components/layout/NavMain.tsx`
- `reference/client/src/components/layout/LogoHeader.tsx`
- `reference/client/src/components/layout/SiteHeader.tsx`
- `reference/client/src/components/layout/VersionLabel.tsx`
- `reference/client/src/config/sidebar-config.ts`
- `reference/client/src/config/header-config.ts`
- `reference/client/src/types/layout.ts`

Navigation item contract:

```ts
export type NavigationPermission = 'write' | 'admin';

export interface NavigationItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  requirePermission?: NavigationPermission;
  disabledTooltip?: string;
}
```

Header contract:

```ts
export interface HeaderConfig {
  title?: string;
  actions?: HeaderAction[];
}
```

Implementation notes:

- Render `LogoHeader` in `SidebarHeader`.
- Render `NavMain` from `getSidebarConfig().navMain`.
- Keep changelog as `/changelog`.
- Keep admin settings as `/settings/users`.
- Call `usersApi.pendingCount()` only when admin.
- Swallow pending-count failures because the dot is best-effort.
- Header uses `h-12`, `border-border/50`, `bg-background/95`, and `backdrop-blur-subtle`.

Verify:

- Active route is highlighted.
- Permission-gated routes are disabled and inert.
- Settings item is disabled for non-admins.
- Pending-user dot appears when count is positive.
- Header stays sticky at top of content.

---

## 9. Login/Register Page

Resolves audit category 5.

Use these reference files while creating or aligning target equivalents:

- `reference/client/src/app/login/page.tsx`
- `reference/client/src/app/login/loading.tsx`
- `reference/client/src/app/login/error.tsx`

Canonical layout:

```tsx
<main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
  <div className="w-full max-w-sm">
    <Card>
      <CardHeader>...</CardHeader>
      <CardContent>
        <Tabs value={tab}>...</Tabs>
      </CardContent>
    </Card>
  </div>
</main>
```

Rules:

1. Sign-in form requires username and password.
2. Register form requires username, password, and confirm password.
3. Password minimum is 8 characters.
4. New account copy says accounts start read-only.
5. On success, redirect to the app's post-auth route.

Verify:

- Already-authenticated users are redirected away from `/login`.
- Busy state disables submit buttons.
- Validation errors appear as `text-sm text-destructive`.

---

## 10. Changelog Page

Resolves audit category 12.

Use these reference files while creating or aligning target equivalents:

- `reference/client/src/app/changelog/page.tsx`
- root `reference/CHANGELOG.md`
- production Docker/build copy rules, if applicable

Canonical behavior:

```ts
const CHANGELOG_PATHS = [
  resolve(process.cwd(), "..", "CHANGELOG.md"),
  resolve(process.cwd(), "CHANGELOG.md"),
];
```

Render:

```tsx
<section className="mx-auto w-full max-w-4xl px-6 py-8 md:px-8 md:py-10">
  <article className="prose prose-neutral max-w-none prose-headings:scroll-mt-24 prose-a:text-primary hover:prose-a:opacity-80">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
  </article>
</section>
```

Verify:

- Markdown tables and lists render correctly.
- External links open in a new tab with `rel="noreferrer"`.
- Missing changelog shows a bordered fallback.
- Runtime image includes `reference/CHANGELOG.md`.

---

## 11. Settings/Users Page And Sidebar Pending Badge

Resolves audit category 6.

Use these reference files while creating or aligning target equivalents:

- `reference/client/src/app/settings/users/page.tsx`
- `reference/client/src/lib/api/users.ts`
- `reference/client/src/types/user.ts`
- `reference/client/src/components/layout/AppSidebar.tsx`

Page structure:

```text
section max-w-5xl
  header/title/description
  Card
    CardHeader
    CardContent
      Table
  Create Dialog
  Reset Password Dialog
  Delete AlertDialog
```

User actions:

1. `loadUsers()` calls `usersApi.list()`.
2. Create dialog posts username/password/role/can_write.
3. Role select patches `{ role }`.
4. Write switch patches `{ can_write }`.
5. Reset dialog validates password length and confirmation, then posts `{ new_password }`.
6. Delete dialog calls `usersApi.remove(id)`.

Self-protection UI:

- Disable role/write/delete controls for the current user's own row.
- Show admins as write-forced.

Pending badge:

- `AppSidebar` calls `usersApi.pendingCount()` for admins when pathname changes.
- Settings click calls `usersApi.markVisited()` and clears local dot state.
- Users page mount also calls `markVisited()`; this is idempotent but duplicated.

Verify:

- Non-admin users are redirected to `/dashboard`.
- Admin users see the full table and actions.
- API errors are displayed without leaking stack traces.
- New badge appears for users created after the admin's last settings visit.

---

## 12. Security, Deployment, And Visual Parity Validation

Resolves all remaining audit categories.

Run backend checks:

```bash
pytest tests/server/routers/test_auth_routes.py tests/server/routers/test_admin_users_router.py
```

Run client checks, using the target project's package scripts:

```bash
npm run lint
npm run typecheck
```

Manual smoke tests:

1. Anonymous `/login` renders standalone.
2. Register creates a read-only user.
3. Read-only user cannot open admin users or write-gated API routes.
4. Admin can create a user.
5. Admin pending badge appears after a user is created and clears after visiting settings.
6. Admin can reset a user's password and the target user can log in with it.
7. `/changelog` renders in the shell.

Security review:

- No JWT in browser-readable storage.
- Production `jwt_secret` is strong.
- CORS origins are explicit.
- Cookie settings match deployment protocol and domain.
- Admin endpoints use backend guards.
- Rate limiter categorizes auth, register, and admin routes.

---

## Anti-Patterns

Do not:

- Implement only `authApi`/`usersApi` without backend routes.
- Use client-side route hiding as the only authorization.
- Read role/write access solely from JWT claims.
- Store the JWT in `localStorage`.
- Make settings project-specific before the generic shell and users page are working.
- Add a full settings framework unless requested.
- Add mobile sidebar behavior unless requested.
- Ignore changelog production file placement.
- Skip backend tests for auth and admin users.
