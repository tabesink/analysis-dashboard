---
name: Frontend Production Audit
overview: Run the full frontend reviewer template against the client/ codebase and produce a comprehensive audit document at docs/frontend-audit.md, covering all 10 review categories from the template.
todos:
  - id: write-audit-doc
    content: Write the full audit document to docs/frontend-audit.md with all 10 review sections, architecture proposal, design token system, and component structure recommendations
    status: done
isProject: false
---

# Frontend Production Audit

## Scope

Full audit of `client/src/` following the [app-frontend-reviewer.md](.references/docs/templates/app-frontend-reviewer.md) template. Output: `docs/frontend-audit.md`.

---

## Key Findings Summary

### Production Readiness Score: 6/10

The app has solid foundations (Tailwind v4, shadcn/ui, TanStack Query, Zustand, proper `next/font`) but several gaps prevent a "production-ready" rating: no dark mode, no error boundaries in use, no loading.tsx files, no `next/image`, missing keyboard accessibility, inconsistent typography, and no bundle analysis.

---

## 1. Architecture Issues

- **Almost everything is a client component.** 63 files have `"use client"` vs 10 server components. Pages like `dashboard/page.tsx`, `database/page.tsx`, `login/page.tsx` are all client components. Only layouts and a few shadcn primitives (`button.tsx`, `card.tsx`, `table.tsx`, `input.tsx`, `skeleton.tsx`) are server components.
- **No `loading.tsx` or `error.tsx**` at any route level -- routes show bare "Loading..." text strings instead of skeleton UIs or the existing `LoadingSpinner` component.
- **Dead shared components.** `ErrorBoundary`, `LoadingSpinner`, and `EmptyState` are exported from `@/components/shared` but never imported anywhere. Local inline equivalents exist instead.
- **Empty directory** `lib/chart-core/` exists with no files.
- **Redirect-only route** `database/filter-values/page.tsx` immediately redirects to `/database/edit` -- could be a Next.js redirect config instead.

## 2. Design System Problems

- **No dark mode variables.** `@custom-variant dark` is declared but `:root` has no `.dark` overrides -- dark mode classes in components (`dark:text-amber-600`) render against undefined tokens.
- **Hardcoded colors in SVG components.** `SVGAxes.tsx` uses `#e5e7eb`, `#000000`, `#6b7280` instead of CSS variables or Tailwind tokens.
- **Hardcoded color palette.** `color-picker.tsx` defines 80+ hex values inline instead of referencing a centralized palette config.
- `**UNPINNED_GREY` constant** in `InteractiveViewer.tsx` uses `rgba(128,128,128,0.2)` -- not tokenized.

## 3. Typography Inconsistencies

- **Arbitrary pixel sizes.** `text-[10px]` and `text-[11px]` appear in 9+ files (upload, charts, dashboard). These bypass the Tailwind type scale and create maintenance burden.
- **No typography scale.** No custom Tailwind `fontSize` tokens defined. Components mix `text-xs`, `text-sm`, `text-base` with arbitrary `text-[10px]`/`text-[11px]`.
- **Heading hierarchy broken.** `h1` only in `SiteHeader`; pages use `h2`/`h3` without a parent `h1`. `ImportConfirmationModal` jumps to `h4`. Database page has `h3` with no parent `h1`/`h2`.
- **Font-size in SVG.** `SVGAxes.tsx` uses raw `fontSize` attributes (lines 111, 126, 139, 152) instead of tokenized values.

## 4. Styling / Component Issues

- **Duplicated side panel layouts.** `SidePanel.tsx`, `DatabaseSidePanel.tsx`, `UploadSidePanel.tsx` share identical layout pattern (`relative bg-card border border-border rounded-l-lg`) via template literals instead of a shared component.
- **Raw `<button>` instead of `Button`.** `HierarchicalEventTree`, `ColorGroupingPanel`, `GlobalFilters`, `FilterSummaryBar`, `PartitionSection`, `DatabaseSection`, `UploadContent`, `color-picker` all use raw `<button>` elements.
- **Template literal classNames.** Several files use `className={`...${condition}...`}` instead of `cn()`, creating inconsistency (e.g., `database/page.tsx`, `SidePanel.tsx`, `DatabaseSidePanel.tsx`, `UploadSidePanel.tsx`, `ColorLegend.tsx`).
- **Arbitrary spacing.** 17+ files use `w-[320px]`, `h-[calc(100vh-7rem)]`, `max-h-[280px]` etc. Many could use Tailwind scale values or CSS variables.

## 5. Performance and Bundle Size

- **No code splitting.** Zero `next/dynamic` or `React.lazy` usage. Dashboard, database, and upload routes load eagerly.
- **No `next/image`.** Both `<img>` usages (logo, under-construction) skip Next.js image optimization.
- `**use-uploaded-datasets` bypasses TanStack Query** -- uses raw `useState` + `useCallback` + `useEffect`, losing caching and deduplication benefits.
- **Inline object allocation in render.** `toastOptions={{ duration: 4000 }}` in `providers.tsx`, `style={{ backgroundColor }}` in ColorLegend, `style={{ cursor }}` in InteractiveCanvasPlot create new objects every render.
- **No bundle analyzer.** No `@next/bundle-analyzer` configured.
- **Duplicate animation packages.** Both `tailwindcss-animate` and `tw-animate-css` are installed.
- `**@types/js-yaml` in dependencies** instead of devDependencies.
- `**radix-ui` meta-package** (1.4.3) is installed alongside individual `@radix-ui/*` packages -- likely redundant.

## 6. Next.js Best Practice Violations

- **No per-route metadata.** Only root layout defines metadata. `/dashboard`, `/database`, `/login` have no title/description.
- **No `loading.tsx` / `error.tsx`.** No route-level loading or error UI. Existing `ErrorBoundary` class component is never mounted.
- **No Suspense boundaries.** No `<Suspense>` usage anywhere.
- **No streaming.** All data fetching is client-side; no server-side streaming or RSC data patterns.
- `**database/filter-values/page.tsx**` should use `next.config.ts` `redirects` instead of a page component.

## 7. Accessibility Gaps

- **Keyboard inaccessible elements.** `ColorLegend` group items have `onClick` but no `onKeyDown`, `role`, or `tabIndex`. `GridActionToolbar` drag handle has `tabIndex={0}` but no keyboard handler.
- **Missing label associations.** `UploadDataSection` and `UploadContent` use `<span>` for labels instead of `<label>`, and inputs lack `id`/`aria-label`.
- **No `aria-live` regions.** Dynamic content changes (filter counts, loading states, toast counts) are not announced to screen readers.
- **Muted text contrast.** `--muted-foreground: #86868b` on `--background: #ffffff` yields ~4.5:1 ratio -- borderline for WCAG AA normal text, fails for small text.
- **No `<nav>` element.** `AppSidebar` navigation is wrapped in generic `<div>`s.
- **No `<aside>` element.** Sidebar uses `<div>` instead of `<aside>`.

## 8. Code Quality

- **Dead exports.** `ErrorBoundary`, `LoadingSpinner`, `EmptyState` in `@/components/shared` are exported but never used.
- **Duplicate `EmptyState` implementations.** `ColorGroupingPanel` and `InteractiveViewer` define local `EmptyState` components instead of using the shared one.
- **Inconsistent className composition.** Mix of `cn()`, template literals, and plain strings across the codebase.
- **No tests.** `playwright` is installed but no test files exist under `client/src/`.

---

## Top 10 Improvements (Priority Order)

1. **Add `error.tsx` and `loading.tsx` to all routes** -- use existing `LoadingSpinner`/`Skeleton` for loading, use `ErrorBoundary` pattern for errors.
2. **Standardize typography** -- define `text-caption` (10px) and `text-label` (11px) tokens in `globals.css` `@theme` block; replace all `text-[10px]`/`text-[11px]` instances.
3. **Extract shared `SidePanelLayout` component** -- unify the 3 duplicated side panel wrappers.
4. **Replace raw `<button>` with shadcn `Button**` across 8+ components for consistent styling and accessibility.
5. **Add dark mode CSS variables** -- define `.dark` `:root` overrides to make existing `dark:` classes functional.
6. **Use `next/dynamic` for heavy route content** -- lazy-load `DashboardContent`, `InteractiveViewer`, `PlotGrid` on the dashboard route.
7. **Tokenize hardcoded colors** in `SVGAxes.tsx` and `color-picker.tsx` -- use CSS variables.
8. **Fix keyboard accessibility** -- add `role="button"`, `tabIndex={0}`, `onKeyDown` to clickable elements in `ColorLegend`, `GridActionToolbar`.
9. **Add proper form labels** in `UploadDataSection` and `UploadContent` -- replace `<span>` with `<label>`.
10. **Remove dead code** -- delete unused `chart-core/` directory, remove duplicate `EmptyState` implementations, clean up unused exports.

---

## Concrete Refactoring Suggestions

### Typography tokens in globals.css

Add to `@theme inline`:

```css
--font-size-caption: 0.625rem;   /* 10px */
--font-size-label: 0.6875rem;    /* 11px */
```

Then create utility classes and replace all `text-[10px]` / `text-[11px]` usages.

### Shared SidePanelLayout component

Extract from the 3 files (`SidePanel.tsx`, `DatabaseSidePanel.tsx`, `UploadSidePanel.tsx`) into `components/shared/SidePanelLayout.tsx` with props for `width`, `children`, `isOpen`, and `onClose`.

### Route-level error/loading files

Create `app/dashboard/loading.tsx`, `app/dashboard/error.tsx`, `app/database/loading.tsx`, `app/database/error.tsx` using the existing `LoadingSpinner` and `ErrorBoundary` components.

### Dynamic imports for dashboard

```tsx
const DashboardContent = dynamic(
  () => import('@/components/dashboard/DashboardContent'),
  { loading: () => <LoadingSpinner /> }
);
```

### Bundle cleanup

- Remove `radix-ui` meta-package (individual `@radix-ui/*` packages are already installed)
- Move `@types/js-yaml` to devDependencies
- Evaluate whether both `tailwindcss-animate` and `tw-animate-css` are needed (likely only one is)

---

## Final Deliverable Structure

The audit document will be written to [docs/frontend-audit.md](docs/frontend-audit.md) with all 10 sections from the template output format, plus the three concluding sections:

- Leaner architecture proposal
- Recommended design token system
- Simplified component structure

