# Blank Route Overview

## What you are building

A **blank route** is a new URL in the Next.js App Router that:

1. Appears as an icon in the main app sidebar (with a hover tooltip).
2. Renders inside the shared app shell (sidebar + header + scrollable main area).
3. Shows an empty layout shell — typically a collapsible left side panel and an empty main `Card` — ready for future UI.

You are **not** building a standalone page. The route plugs into infrastructure that already exists.

## App shell (automatic — do not recreate)

Every authenticated route is wrapped by [`ClientLayout`](../../client/src/components/layout/ClientLayout.tsx):

```
Providers
└── ClientLayout
    ├── AppSidebar          ← fixed 64px icon rail (left)
    └── SidebarInset
        ├── SiteHeader      ← top bar (title + version label)
        └── {your page}     ← scrollable main content
```

- `/login` is the only route that skips the shell.
- You do **not** need to edit `ClientLayout`, `AppSidebar`, or `providers.tsx` for a standard blank route.

## What you create (route-specific)

| Piece | Purpose |
|-------|---------|
| `app/{routeSlug}/page.tsx` | Page content and layout inside the main area |
| `sidebar-config.ts` entry | Sidebar icon, URL, tooltip, optional permission gate |
| `header-config.ts` entry | Optional page title in the top app bar |

Optional later:

| Piece | When |
|-------|------|
| `app/{routeSlug}/layout.tsx` | Route-specific wrapper (rare; existing ones are pass-through) |
| Dedicated side-panel component | When side panel logic grows (see `DatabaseSidePanel`) |
| Backend router | When the page needs API data |

## Default blank layout anatomy

The standard blank route uses the same split-pane shell as Database and Edit Metadata:

```
┌─────────────────────────────────────────────────────────┐
│ SiteHeader (blank title or route title + version label) │
├──────────┬──────────────────────────────────────────────┤
│ Side     │ Main Card                                    │
│ Panel    │ (empty CardContent)                          │
│ (320px,  │                                              │
│ collaps- │                                              │
│ ible)    │                                              │
└──────────┴──────────────────────────────────────────────┘
```

Built from:

- [`SidePanelLayout`](../../client/src/components/shared/SidePanelLayout.tsx) — left panel chrome + collapse toggle
- [`Card`](../../client/src/components/ui/card.tsx) — right main workspace

Reference implementation: [`inspect-damage/page.tsx`](../../client/src/app/inspect-damage/page.tsx).

## Sidebar navigation

Main nav items live in [`sidebar-config.ts`](../../client/src/config/sidebar-config.ts) inside the `navMain` array.

[`NavMain`](../../client/src/components/layout/NavMain.tsx) renders each item as:

- **Icon only** in the sidebar rail
- **Tooltip on hover** — uses the `title` field (e.g. `"Inspect Damage"`)
- **Active highlight** when `pathname` matches `url` (or starts with it for nested routes)
- **Permission gate** when `requirePermission` is set (item grayed out + different tooltip)

Nav item shape is defined in [`types/layout.ts`](../../client/src/types/layout.ts) as `NavigationItem`.

**Order matters.** Items appear top-to-bottom in the order listed in `navMain`.

Separators around Database entries are hardcoded in `NavMain` — a new item does not get a separator unless you extend `NavMain`.

## App header

[`header-config.ts`](../../client/src/config/header-config.ts) maps pathname → title.

- `undefined` → blank header bar (border + version label only). Used by Database, Dashboard, Inspect Damage.
- A string → `<h1>` title rendered in `SiteHeader`.

## Auth

Most tool pages redirect unauthenticated users to `/login` and show a spinner while auth is loading.

Copy the auth guard from [`inspect-damage/page.tsx`](../../client/src/app/inspect-damage/page.tsx) or [`dashboard/page.tsx`](../../client/src/app/dashboard/page.tsx).

Changelog is an exception — it has no client-side auth guard (server-rendered content page).

## Naming conventions

| Concept | Convention | Example |
|---------|------------|---------|
| URL slug | kebab-case | `/inspect-damage` |
| Page file path | `app/{routeSlug}/page.tsx` | `app/inspect-damage/page.tsx` |
| Page component | PascalCase + `Page` suffix | `InspectDamagePage` |
| Nav tooltip | Human-readable title in sidebar config | `"Inspect Damage"` |
| Lucide icon | Import from `lucide-react` | `Calculator` |

## No backend required (initially)

A blank route is frontend-only. Do not add FastAPI routers, DuckDB queries, or API client methods until the page needs data.

When you do add a backend, follow the existing pattern in `server/routers/` and `client/src/lib/api/` separately — that is out of scope for this template.

## Related docs

- Junior codebase guide: [`docs/brainstorm/04_refactor_codebase_0/JUNIOR_DEV_CODEBASE_GUIDE.md`](../04_refactor_codebase_0/JUNIOR_DEV_CODEBASE_GUIDE.md)
- Layout types: [`client/src/types/layout.ts`](../../client/src/types/layout.ts)
