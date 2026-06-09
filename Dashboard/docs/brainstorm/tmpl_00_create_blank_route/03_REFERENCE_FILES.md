# Reference Files — What to Copy From

Use this map to find the right existing file before writing new code. **Prefer copying over inventing layout or auth patterns.**

---

## Primary references (blank route scaffold)

| If you need to… | Open this file | What to copy |
|-----------------|----------------|--------------|
| Create blank split-pane page | [`client/src/app/inspect-damage/page.tsx`](../../client/src/app/inspect-damage/page.tsx) | Full page: auth guard + `SidePanelLayout` + empty `Card` |
| Add sidebar nav icon + tooltip | [`client/src/config/sidebar-config.ts`](../../client/src/config/sidebar-config.ts) | `navMain` object shape; Inspect Damage = open access, Database = write-gated |
| Set app bar title (or blank) | [`client/src/config/header-config.ts`](../../client/src/config/header-config.ts) | `routeTitles` entry |
| Understand nav item fields | [`client/src/types/layout.ts`](../../client/src/types/layout.ts) | `NavigationItem`, `NavigationPermission` |
| See how tooltips/active state work | [`client/src/components/layout/NavMain.tsx`](../../client/src/components/layout/NavMain.tsx) | Read only — usually no edits needed |

---

## App shell (read-only context)

| File | Role |
|------|------|
| [`client/src/components/layout/ClientLayout.tsx`](../../client/src/components/layout/ClientLayout.tsx) | Wraps all routes except `/login` with sidebar + header |
| [`client/src/components/layout/AppSidebar.tsx`](../../client/src/components/layout/AppSidebar.tsx) | Loads `sidebar-config`, renders `NavMain` + hardcoded Changelog/Settings |
| [`client/src/components/layout/SiteHeader.tsx`](../../client/src/components/layout/SiteHeader.tsx) | Reads `header-config`, renders title + `VersionLabel` |
| [`client/src/app/providers.tsx`](../../client/src/app/providers.tsx) | Wraps app with `ClientLayout` — no route changes needed |

---

## Layout building blocks

| If you need to… | Open this file | What to copy |
|-----------------|----------------|--------------|
| Collapsible side panel chrome | [`client/src/components/shared/SidePanelLayout.tsx`](../../client/src/components/shared/SidePanelLayout.tsx) | Props: `isCollapsed`, `onToggleCollapse`, `expandedWidth="w-[320px]"` |
| Collapsible section inside panel | [`client/src/components/shared/SidePanelSection.tsx`](../../client/src/components/shared/SidePanelSection.tsx) | Title/subtitle/collapse pattern used in Upload and Dashboard |
| Loading spinner during auth | [`client/src/components/shared/LoadingSpinner.tsx`](../../client/src/components/shared/LoadingSpinner.tsx) | Used in auth guard loading branch |
| Shared exports barrel | [`client/src/components/shared/index.ts`](../../client/src/components/shared/index.ts) | `LoadingSpinner`, `SidePanelLayout`, `SidePanelSection` |

---

## When the route grows beyond blank

| If you need to… | Open this file | What to copy |
|-----------------|----------------|--------------|
| Side panel as separate component | [`client/src/components/upload/DatabaseSidePanel.tsx`](../../client/src/components/upload/DatabaseSidePanel.tsx) | Wraps `SidePanelLayout` + `ScrollArea` + sections |
| Side panel section with actions | [`client/src/components/upload/UploadDataSection.tsx`](../../client/src/components/upload/UploadDataSection.tsx) | Uses `SidePanelSection` with form controls |
| Inline side panel content (no extract) | [`client/src/app/database/edit/page.tsx`](../../client/src/app/database/edit/page.tsx) | Split-pane shell with content directly in page |
| Main area toolbar + table | [`client/src/app/database/page.tsx`](../../client/src/app/database/page.tsx) | Right-column `Card` with toolbar strip + `CardContent` |
| Dashboard-style global collapse | [`client/src/app/dashboard/page.tsx`](../../client/src/app/dashboard/page.tsx) + [`client/src/components/dashboard/side-panel/SidePanel.tsx`](../../client/src/components/dashboard/side-panel/SidePanel.tsx) | Uses `useUIStore` — only copy if intentional |
| Simple single-column page (no side panel) | [`client/src/app/changelog/page.tsx`](../../client/src/app/changelog/page.tsx) | Centered prose layout, server component |
| Admin settings page pattern | [`client/src/app/settings/users/page.tsx`](../../client/src/app/settings/users/page.tsx) | Different layout; not a blank route template |

---

## Permission and nav placement

| If you need to… | Open this file | What to copy |
|-----------------|----------------|--------------|
| Write-gated nav item | [`client/src/config/sidebar-config.ts`](../../client/src/config/sidebar-config.ts) | Database or Edit Metadata entry |
| Admin-gated nav item | Same file | Use `requirePermission: 'admin'` |
| Lower sidebar item (Changelog style) | [`client/src/components/layout/AppSidebar.tsx`](../../client/src/components/layout/AppSidebar.tsx) | Hardcoded `SidebarMenuItem` block near line 99 — **not** in `sidebar-config` |
| Auth store selectors | [`client/src/stores/auth-store.ts`](../../client/src/stores/auth-store.ts) | `selectCanWrite`, `selectIsAdmin` (used by `NavMain`) |

---

## Optional route files

| File | When needed |
|------|-------------|
| [`client/src/app/dashboard/layout.tsx`](../../client/src/app/dashboard/layout.tsx) | Pass-through `{children}` only — optional |
| [`client/src/app/database/layout.tsx`](../../client/src/app/database/layout.tsx) | Same — optional |

You do **not** need a `layout.tsx` for a new blank route unless you have route-specific wrapping requirements.

---

## Do NOT edit for a standard blank route

| File | Why |
|------|-----|
| `ClientLayout.tsx` | Already wraps all non-login routes |
| `AppSidebar.tsx` | Reads `sidebar-config` automatically (unless using Changelog-style hardcoded nav) |
| `NavMain.tsx` | Renders `navMain` from config automatically |
| `providers.tsx` | Already provides layout wrapper |
| `server/` | No backend until page needs API |
| `client/src/lib/api/` | No API client until page fetches data |

---

## File tree after scaffold

```
Dashboard/client/src/
├── app/
│   └── {routeSlug}/
│       └── page.tsx          ← CREATE
└── config/
    ├── sidebar-config.ts     ← EDIT (navMain entry)
    └── header-config.ts      ← EDIT (routeTitles entry)
```

That is the complete minimum diff for a blank route.
