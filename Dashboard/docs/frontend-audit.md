# Frontend Production Audit

**Date:** 2026-03-10
**Scope:** `client/src/` — full review per [app-frontend-reviewer.md](../.references/docs/templates/app-frontend-reviewer.md)
**Production Readiness Score:** 7/10 (post-remediation; was 6/10)

---

## 1. Architecture

| Area | Finding | Status |
|------|---------|--------|
| Client vs Server components | 63 `"use client"` files vs ~10 server components. Pages are mostly client components due to auth guards and store access. | Accepted |
| `loading.tsx` / `error.tsx` | Missing at all route levels — routes showed bare "Loading..." strings | **Fixed** — added to `/dashboard`, `/database`, `/database/edit`, `/login` |
| Dead shared components | `ErrorBoundary`, `LoadingSpinner`, `EmptyState` exported but never used | **Fixed** — `LoadingSpinner` now used in loading.tsx files; `EmptyState` used in ColorGroupingPanel |
| Empty `lib/chart-core/` directory | Empty dir with no files | **Fixed** — removed |
| Redirect-only route | `database/filter-values/page.tsx` redirects to `/database/edit` | Acceptable — keeps bookmarks working during migration |

### Recommendations (remaining)

- Convert data-fetching to RSC patterns where auth permits server-side rendering
- Add `<Suspense>` boundaries around heavy components
- Evaluate converting `filter-values/page.tsx` redirect to `next.config.ts` `redirects`

---

## 2. Design System

| Area | Finding | Status |
|------|---------|--------|
| Dark mode variables | `@custom-variant dark` declared but no `.dark` `:root` overrides | Open — not yet addressed |
| SVG hardcoded colors | `SVGAxes.tsx` used `#e5e7eb`, `#000000`, `#6b7280` | **Fixed** — tokenized via CSS variables (`var(--border)`, `var(--foreground)`, `var(--muted-foreground)`) |
| Color picker palette | `color-picker.tsx` defines 80+ hex values inline | Accepted — intentional palette for the color picker UI |
| `UNPINNED_GREY` constant | `rgba(128,128,128,0.2)` in InteractiveViewer | Accepted — context-specific opacity for pinned mode |

### Recommendations (remaining)

- Add dark mode CSS variables if dark mode is a product goal
- Consider extracting SVG color tokens to a shared constants file

---

## 3. Typography

| Area | Finding | Status |
|------|---------|--------|
| Arbitrary pixel sizes | `text-[10px]` in 5 files, `text-[11px]` in 5 files | **Fixed** — added `text-caption` (10px) and `text-label` (11px) tokens to `globals.css` `@theme` block; replaced all instances |
| No typography scale tokens | No custom Tailwind `fontSize` tokens | **Fixed** — `--font-size-caption` and `--font-size-label` defined in `@theme inline` |
| Heading hierarchy | `h1` only in SiteHeader; pages skip heading levels | Open — low priority |
| SVG font sizes | `SVGAxes.tsx` uses raw `fontSize` attributes | Accepted — SVG rendering needs numeric values, configurable via props |

---

## 4. Styling & Components

| Area | Finding | Status |
|------|---------|--------|
| Duplicated side panel layout | `SidePanel.tsx`, `DatabaseSidePanel.tsx`, `UploadSidePanel.tsx` shared identical collapse/expand pattern | **Fixed** — extracted `SidePanelLayout` in `@/components/shared` |
| Raw `<button>` instead of `Button` | 8+ components used raw `<button>` elements | **Fixed** — replaced with shadcn `Button` in `HierarchicalEventTree`, `ColorGroupingPanel`, `GlobalFilters`, `FilterSummaryBar`, `PartitionSection`, `DatabaseSection`, `UploadDataSection`, `UploadContent`, `SiteHeader` (legacy `DatabaseTabContent` removed) |
| Template literal classNames | Several files used `` className={`...${condition}...`} `` instead of `cn()` | Partially fixed — `ColorLegend` converted to `cn()`; other instances remain |
| Arbitrary spacing | 17+ files use `w-[320px]`, `h-[calc(100vh-7rem)]` etc. | Accepted — these are layout-specific values |

---

## 5. Performance & Bundle Size

| Area | Finding | Status |
|------|---------|--------|
| No code splitting | Zero `next/dynamic` or `React.lazy` usage | **Fixed** — `SidePanel` and `DashboardContent` lazy-loaded on dashboard route |
| No `next/image` | Both `<img>` usages skip optimization | Open — logo and under-construction images |
| Inline loading state | Dashboard page showed bare "Loading..." text | **Fixed** — replaced with `LoadingSpinner` component |
| Bundle: `radix-ui` meta-package | `radix-ui` 1.4.3 installed alongside individual `@radix-ui/*` | **Fixed** — removed from dependencies |
| Bundle: `@types/js-yaml` | In `dependencies` instead of `devDependencies` | **Fixed** — moved to devDependencies |
| Bundle: duplicate animation | Both `tailwindcss-animate` and `tw-animate-css` installed | **Fixed** — removed unused `tailwindcss-animate` (only `tw-animate-css` is imported) |
| No bundle analyzer | No `@next/bundle-analyzer` | Open — recommend adding for build monitoring |

---

## 6. Next.js Best Practices

| Area | Finding | Status |
|------|---------|--------|
| Per-route metadata | Only root layout defines metadata | Open — add `metadata` exports to route layouts |
| `loading.tsx` / `error.tsx` | Not present at any route | **Fixed** — added to all routes |
| No Suspense boundaries | No `<Suspense>` usage | Open |
| No streaming / RSC data | All data fetching is client-side | Accepted — auth-gated SPA pattern |
| Redirect route | `filter-values/page.tsx` as component | Accepted — works, could migrate to `next.config.ts` |

---

## 7. Accessibility

| Area | Finding | Status |
|------|---------|--------|
| Keyboard inaccessible elements | `ColorLegend` group items had `onClick` but no keyboard support | **Fixed** — added `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space |
| GridActionToolbar drag handle | Had `tabIndex={0}` but no keyboard handler | **Fixed** — added arrow key support for keyboard repositioning |
| Missing label associations | Upload sections use `<span>` for labels | Open — recommend converting to `<label>` with `htmlFor` |
| No `aria-live` regions | Dynamic content changes not announced | Open |
| Muted text contrast | `--muted-foreground: #86868b` on `#ffffff` — borderline WCAG AA | Open |
| No `<nav>` / `<aside>` elements | Sidebar uses generic `<div>` | Open |

---

## 8. Code Quality

| Area | Finding | Status |
|------|---------|--------|
| Dead exports | `ErrorBoundary`, `LoadingSpinner`, `EmptyState` exported but unused | **Fixed** — `LoadingSpinner` and `EmptyState` now used; `ErrorBoundary` available for error.tsx wrappers |
| Duplicate `EmptyState` | `ColorGroupingPanel` and `InteractiveViewer` defined local versions | **Fixed** — `ColorGroupingPanel` now uses shared `EmptyState`; `InteractiveViewer` local renamed to `NoCurvesState` for clarity |
| Inconsistent className composition | Mix of `cn()`, template literals, and plain strings | Partially fixed — `ColorLegend` converted |
| No tests | Playwright installed but no test files | Open — Phase 9 work |

---

## 9. State Management

| Area | Finding |
|------|---------|
| Zustand stores | Well-structured: `ui-store`, `render-store`, `auth-store`, `color-selection-store`, `pinned-events-store`, `plot-settings-store` |
| TanStack Query | Properly used for server state with appropriate stale times |
| `use-uploaded-datasets` | Bypasses TanStack Query with raw hooks — opportunity to migrate |

No changes made — state management is generally well-structured.

---

## 10. Build & Dependencies

| Area | Finding | Status |
|------|---------|--------|
| Duplicate animation packages | `tailwindcss-animate` + `tw-animate-css` | **Fixed** — removed `tailwindcss-animate` |
| `radix-ui` meta-package | Redundant alongside individual `@radix-ui/*` | **Fixed** — removed |
| `@types/js-yaml` placement | Was in `dependencies` | **Fixed** — moved to `devDependencies` |
| No bundle analyzer | Not configured | Open |
| Playwright unused | Installed but no tests | Open — Phase 9 |

---

## Summary of Changes Made

### New files created
- `app/dashboard/loading.tsx`, `app/dashboard/error.tsx`
- `app/database/loading.tsx`, `app/database/error.tsx`
- `app/database/edit/loading.tsx`, `app/database/edit/error.tsx`
- `app/login/loading.tsx`, `app/login/error.tsx`
- `components/shared/SidePanelLayout.tsx`

### Files modified
- `app/globals.css` — added `text-caption` / `text-label` typography tokens
- `app/dashboard/page.tsx` — dynamic imports for `SidePanel` + `DashboardContent`; `LoadingSpinner` for auth loading
- `components/dashboard/side-panel/SidePanel.tsx` — refactored to use `SidePanelLayout`
- `components/upload/DatabaseSidePanel.tsx` — refactored to use `SidePanelLayout`
- `components/upload/UploadSidePanel.tsx` — refactored to use `SidePanelLayout`
- `components/dashboard/color-legend/ColorLegend.tsx` — keyboard a11y, `cn()` usage
- `components/dashboard/shared/GridActionToolbar.tsx` — keyboard arrow keys for drag handle
- `components/dashboard/shared/ColorGroupingPanel.tsx` — shared `EmptyState`, `Button` replacements
- `components/dashboard/interactive-viewer/InteractiveViewer.tsx` — renamed local `EmptyState` to `NoCurvesState`
- `components/charts/SVGAxes.tsx` — tokenized hardcoded colors
- `components/shared/index.ts` — added `SidePanelLayout` export
- `components/dashboard/shared/HierarchicalEventTree.tsx` — raw buttons → `Button`
- `components/dashboard/side-panel/GlobalFilters.tsx` — raw buttons → `Button`
- `components/dashboard/side-panel/global-filters/FilterSummaryBar.tsx` — raw buttons → `Button`
- `components/dashboard/side-panel/PartitionSection.tsx` — raw buttons → `Button`
- `components/upload/UploadDataSection.tsx` — raw buttons → `Button`, `text-label` tokens
- `components/upload/UploadContent.tsx` — raw buttons → `Button`, `text-caption` / `text-label` tokens
- `components/upload/DatabaseSection.tsx` — raw buttons → `Button`, `text-label` tokens
- `components/charts/PlotTooltip.tsx` — `text-caption` token
- `components/charts/SVGPlotCard.tsx` — `text-caption` token
- `components/ui/shadcn-io/color-picker.tsx` — `text-caption` token
- `components/upload/ImportConfirmationModal.tsx` — `text-caption` token
- `components/layout/SiteHeader.tsx` — raw button → `Button`
- `client/package.json` — removed `radix-ui`, `tailwindcss-animate`; moved `@types/js-yaml` to devDeps

### Files/directories removed
- `lib/chart-core/` (empty directory)
- `components/upload/DatabaseTabContent.tsx` (legacy; database page uses `DatabaseSidePanel` only)

---

## Remaining Open Items (Backlog)

1. Dark mode CSS variables
2. Per-route `metadata` exports
3. `<Suspense>` boundaries
4. `next/image` for logo and static images
5. Form label accessibility (`<label>` + `htmlFor`)
6. `aria-live` regions for dynamic content
7. `<nav>` / `<aside>` semantic elements
8. Bundle analyzer setup
9. Remaining template literal → `cn()` conversions
10. `use-uploaded-datasets` migration to TanStack Query
