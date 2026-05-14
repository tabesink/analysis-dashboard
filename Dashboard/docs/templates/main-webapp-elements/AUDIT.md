# Audit Checklist

Use this checklist to compare a target implementation against the canonical main webapp elements described in [DESIGN.md](DESIGN.md). Capture each finding with file path, line range, category, severity, current behavior, and expected behavior.

## Severity Rubric

- **Critical**: Security, auth, route protection, or core shell behavior is broken. Must fix before shipping.
- **Warning**: Visible or behavioral drift from the canonical implementation. Should fix unless the target intentionally differs.
- **Suggestion**: Acceptable target-specific variation. Document the decision.

---

## 1. Stack Conformance

```bash
rg -l "@import \"tailwindcss\"" --type css
rg -l "from ['\"]next/navigation['\"]" --type tsx
rg -l "from ['\"]lucide-react['\"]" --type tsx
rg -l "FastAPI|APIRouter" --type py
rg --files -g "app/layout.tsx" -g "src/app/layout.tsx"
rg --files -g "tailwind.config.*"
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | Next.js App Router exists | `app/layout.tsx` or `src/app/layout.tsx` present |
| Critical | Tailwind v4 global stylesheet exists | `@import "tailwindcss"` present |
| Critical | FastAPI backend exists or adaptation is documented | `FastAPI` and `APIRouter` found, or explicit non-FastAPI decision |
| Warning | shadcn/Radix primitives present | `components/ui` has needed primitives |
| Warning | lucide-react used for icons | imports present |
| Suggestion | No Tailwind v3 config | no `tailwind.config.*` unless target intentionally differs |

---

## 2. Client Providers And Auth Bootstrap

```bash
rg "bootstrapAuth|bootstrap\\(" client/src/app client/src/stores --type tsx --type ts
rg "QueryClientProvider" client/src --type tsx
rg "ClientLayout" client/src/app client/src/components --type tsx
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | Root providers call auth bootstrap once | `Providers` calls `bootstrapAuth()` in `useEffect` |
| Critical | Routed content is wrapped in `ClientLayout` | `ClientLayout` wraps `{children}` |
| Warning | React Query provider is mounted once | `QueryClientProvider` wraps the app |
| Warning | Toaster is mounted globally | top-right rich-color toaster or documented equivalent |

---

## 3. Layout Shell Behavior

```bash
rg "pathname === ['\"]/login['\"]" client/src/components/layout client/src/app --type tsx
rg "SidebarProvider" client/src/components/layout client/src/components/ui --type tsx
rg "h-screen overflow-hidden" client/src --type tsx
rg "overflow-y-auto overflow-x-hidden" client/src --type tsx
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | `/login` bypasses app chrome | login route renders without sidebar/header |
| Critical | Non-login routes use sidebar/header shell | `SidebarProvider` + `AppSidebar` + `SiteHeader` |
| Critical | Main content scrolls independently | content area has `min-h-0 flex-1 overflow-y-auto overflow-x-hidden` |
| Warning | No nested semantic `<main>` landmarks | only one `main`, or deviation documented |
| Warning | Shell is desktop-focused | no unrequested mobile behavior added |

---

## 4. Sidebar Navigation

```bash
rg "AppSidebar|NavMain|LogoHeader" client/src/components/layout --type tsx
rg "getSidebarConfig|SidebarConfig|NavigationItem" client/src --type ts --type tsx
rg "requirePermission|selectCanWrite|selectIsAdmin" client/src --type ts --type tsx
rg "pendingCount|markVisited|mark-visited" client/src --type ts --type tsx
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | Primary nav is config-driven | `NavMain` receives `sidebarConfig.navMain` |
| Critical | Permission-gated nav is inert when unauthorized | unpermitted items render disabled buttons, not links |
| Critical | Admin settings disabled for non-admins | `/settings/users` link only active for admin |
| Warning | Icon-only sizing matches canonical style | icons use `size-5` |
| Warning | Active item styling matches | active item uses `bg-sidebar-accent` and active icon foreground |
| Warning | Pending-user dot is best-effort | pending-count failures are swallowed |
| Suggestion | Hardcoded separators removed or documented | current implementation special-cases database routes |

---

## 5. Header And Version Label

```bash
rg "SiteHeader|VersionLabel|getHeaderConfig" client/src --type ts --type tsx
rg "h-12.*border-border/50.*backdrop-blur-subtle" client/src --type tsx
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | Header is sticky within app shell | `sticky top-0 z-10` |
| Warning | Header height and chrome match | `h-12`, `bg-background/95`, `border-border/50` |
| Warning | Version label appears on the right | `VersionLabel` rendered in header action area |
| Suggestion | Header config supports target routes | `getHeaderConfig()` handles exact or pattern routes deliberately |

---

## 6. Client Auth API And Store

```bash
rg "credentials: ['\"]include['\"]" client/src/lib/api --type ts
rg "/api/v1/auth/login|/api/v1/auth/register|/api/v1/auth/me|/api/v1/auth/logout" client/src --type ts
rg "useAuthStore|selectIsAdmin|selectCanWrite" client/src --type ts --type tsx
rg "localStorage|sessionStorage" client/src --type ts --type tsx
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | API client sends cookies | `credentials: 'include'` |
| Critical | Auth adapter maps all required endpoints | login/register/change-password/me/logout |
| Critical | No JWT in browser-readable storage | no token storage in `localStorage` or `sessionStorage` |
| Critical | Bootstrap treats `401` as unauthenticated | no crash loop |
| Warning | Selectors reflect backend roles | admin always write-capable |
| Warning | Logout redirects to `/login` | current page replaced after logout |

---

## 7. Login/Register Page

```bash
rg "min-h-svh.*items-center.*justify-center" client/src/app/login --type tsx
rg "TabsTrigger.*signin|TabsTrigger.*register|Create account|Sign In" client/src/app/login --type tsx
rg "Password must be at least 8|Passwords do not match" client/src/app/login --type tsx
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | Login page is standalone | centered full-viewport card, no shell |
| Critical | Sign-in and register actions call auth store | `login()` and `register()` |
| Warning | Register validates password length and confirmation | client-side validation present |
| Warning | New-account copy states read-only start | users understand admin grants write later |
| Warning | Busy state disables buttons | `status === 'loading'` or equivalent |

---

## 8. Settings/Users Client Page

```bash
rg "SettingsUsersPage" client/src/app/settings/users --type tsx
rg "usersApi\\.list|usersApi\\.create|usersApi\\.update|usersApi\\.remove|resetPassword" client/src --type tsx --type ts
rg "AlertDialog|Dialog|Table|DropdownMenu|Switch|Select" client/src/app/settings/users --type tsx
rg "router.replace\\(['\"]/dashboard['\"]\\)" client/src/app/settings/users --type tsx
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | Page redirects non-admin users | settled non-admin auth redirects to `/dashboard` |
| Critical | Page calls all required users API methods | list/create/update/remove/resetPassword/markVisited |
| Critical | Self-protection UI exists | current user's own role/write/delete controls disabled |
| Warning | Page width/chrome matches | `max-w-5xl`, shadcn `Card`, bordered `Table` |
| Warning | Dialogs match behavior | create, reset password, delete confirmation |
| Warning | API errors render visibly | `text-destructive` or table-level error |
| Warning | New badge uses last settings visit | created users after visit are marked new |

---

## 9. Backend Settings And Security Configuration

```bash
rg "jwt_secret|auth_cookie_name|auth_cookie_secure|auth_cookie_samesite|cors_origins" server/config.py
rg "validate_production_security|jwt_expiry_hours" server/config.py
rg "auth_requests_per_minute|register_requests_per_minute|admin_requests_per_minute" server/config.py server/middleware --type py
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | JWT secret is required for token creation | empty secret fails auth token creation |
| Critical | Production rejects weak secret | min 32 chars or stronger target policy |
| Critical | Production cookies are secure by default | insecure only via explicit LAN exception |
| Critical | CORS allows credentials and explicit origins | no wildcard in production |
| Warning | Auth/register/admin rate limits exist | distinct categories configured |
| Warning | JWT expiry is limited | production max is 24 hours or target-approved value |

---

## 10. Backend Auth Routes And Dependencies

```bash
rg "router = APIRouter\\(prefix=['\"]\\/auth" server/routers --type py
rg "@router\\.(post|get).*login|@router\\.(post|get).*register|change-password|logout|me" server/routers/auth.py
rg "CurrentUserDep|OptionalUserDep|AdminRequiredDep|WriteUserDep|get_optional_user|get_current_user|require_admin" server/dependencies.py
rg "get_user_from_token|create_token|decode_token|authenticate" server/services/auth.py
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | `/api/v1/auth/*` router is mounted | `reference/server/main.py` includes auth router under `/api/v1` |
| Critical | Required auth routes exist | login/register/change-password/logout/me |
| Critical | Cookie is HttpOnly | `httponly=True` in `set_cookie` |
| Critical | Current user reloads from DB | token `sub` resolves to DB user row |
| Critical | `CurrentUserDep` returns `401` when missing | no silent anonymous access |
| Warning | Login failure is generic | does not reveal username existence |
| Warning | Auth mutations write audit records | login/register/logout/password change logged |

---

## 11. Backend Admin User Routes

```bash
rg "router = APIRouter\\(prefix=['\"]\\/admin\\/users" server/routers --type py
rg "AdminRequiredDep" server/routers/admin_users.py
rg "pending-count|mark-visited|reset-password" server/routers/admin_users.py
rg "Admins cannot delete themselves|Admins cannot change their own role" server/routers/admin_users.py
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | `/api/v1/admin/users/*` router is mounted | `reference/server/main.py` includes admin users router under `/api/v1` |
| Critical | Every route requires admin | each handler depends on `AdminRequiredDep` |
| Critical | Required endpoints exist | list/create/update/delete/reset-password/pending-count/mark-visited |
| Critical | Self-delete is blocked | returns `400` |
| Critical | Self role/write mutation is blocked | returns `400` |
| Warning | Mutations write audit records | create/update/delete/reset-password logged |
| Warning | Pending count excludes acting admin | admin's own account does not count as new |

---

## 12. Backend Models And Persistence

```bash
rg "CurrentUserResponse|LoginRequest|RegisterRequest|ChangePasswordRequest" server/models/auth.py
rg "UserListItem|CreateUserRequest|UpdateUserRequest|ResetPasswordRequest|PendingCountResponse" server/models/user.py
rg "CREATE TABLE IF NOT EXISTS users|CREATE TABLE IF NOT EXISTS audit_log" server/storage/database.py
rg "bcrypt|gensalt\\(rounds=12\\)|checkpw" server/services/user.py
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | Pydantic models match client payloads | no missing required fields |
| Critical | Username validation exists | min length and allowed characters |
| Critical | Password length validation exists | min 8, max bounded |
| Critical | Passwords are bcrypt hashed | no plaintext password storage |
| Critical | Users table has visit/login timestamps | supports admin UI and pending badge |
| Warning | Audit table exists | auth/admin actions can be logged |
| Warning | Hard delete is documented if used | target accepts deletion semantics |

---

## 13. Changelog Page

```bash
rg "ReactMarkdown|remarkGfm|CHANGELOG_PATHS|getChangelogMarkdown" client/src/app/changelog --type tsx
rg "@plugin \"@tailwindcss/typography\"" client/src/app client/src --type css
rg --files -g "CHANGELOG.md"
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | Changelog route exists | `/changelog` page present |
| Critical | Markdown rendered server-side | `ReactMarkdown` and `remark-gfm` |
| Warning | Typography plugin exists | prose classes render correctly |
| Warning | External links are safe | `target="_blank"` and `rel="noreferrer"` |
| Warning | Missing file fallback exists | friendly bordered message |
| Warning | Runtime image includes changelog | production can read `reference/CHANGELOG.md` |

---

## 14. Tests And Verification

```bash
rg "test_.*auth|test_.*admin" tests --type py
rg "/api/v1/auth|/api/v1/admin/users" tests --type py
```

| Severity | Check | Expected |
| -------- | ----- | -------- |
| Critical | Auth route tests exist | login/register/me/logout/change-password covered |
| Critical | Admin user tests exist | list/create/update/delete/reset-password/pending-count covered |
| Critical | Authorization failures tested | anonymous `401`, regular user `403` |
| Warning | Client lint/typecheck scripts exist | target can verify TS/React changes |
| Warning | Manual smoke checklist completed | login, sidebar, users, changelog exercised |

---

## Audit Report Template

```markdown
## Audit Report: <target app>

### Summary

- Critical: N
- Warning: N
- Suggestion: N

### Findings

| # | Severity | Category | File | Current | Expected |
| - | -------- | -------- | ---- | ------- | -------- |
| 1 | Critical | Backend Admin User Routes | `reference/server/routers/admin_users.py` | route lacks `AdminRequiredDep` | every admin users route requires backend admin guard |

### Assumptions

- <List target-specific decisions>

### Recommended Next Step

Apply [REFACTOR.md](REFACTOR.md) categories in order, starting with the first Critical finding.
```
