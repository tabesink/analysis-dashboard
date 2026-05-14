# Refactor Playbook

Use this playbook during Phase 3 (Plan) and Phase 5 (Execute) of the audit-and-align-ui workflow. Each section below covers one audit category from [AUDIT.md](AUDIT.md), with concrete before/after recipes.

## Ordering rule

Refactor in this order. Each layer builds on the previous; do not skip ahead.

```
1. Theme setup        (theme.css / globals.css; the foundation)
2. Color tokens       (replace gray-family + raw hex with semantic tokens)
3. Typography         (snap class strings to semantic roles)
4. Components         (replace hand-rolled with shadcn primitives)
5. Layout patterns    (sidebar width, two-panel workbench, side-panel sections)
6. States             (loading / empty / error / toast)
7. Motion + focus + accessibility   (durations, focus rings, ARIA, motion-reduce)
```

Reasoning: token swaps are noisy but mechanical. Doing them after typography or component refactors creates merge churn; doing them first means subsequent steps work in the right vocabulary.

## What NOT to refactor

- Domain-specific business logic.
- Data fetching, API shapes, server contracts.
- Database queries, ORM models, migrations.
- Test infrastructure (other than aligning visual snapshot tests after the refactor).
- Anything outside the design surface. If you find yourself editing a service or a server route, stop and ask.

---

## 1. Theme setup

Replace (or create) the target's global stylesheet to match [theme.css](theme.css).

**Before** (typical Tailwind v3 + custom config):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: #3b82f6;
  --background: #f9fafb;
}
```

```js
// tailwind.config.js
module.exports = {
  theme: { extend: { colors: { primary: "#3b82f6" } } }
};
```

**After**:

1. Delete `tailwind.config.js` (Tailwind v4 reads tokens from `@theme inline`).
2. Replace the global stylesheet contents with [theme.css](theme.css).
3. Update `app/layout.tsx` to wire Geist:

```tsx
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

<body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
```

4. Ensure `package.json` has the right dependencies: `tailwindcss@^4`, `@tailwindcss/postcss@^4`, `tw-animate-css`, `@tailwindcss/typography`.

**Verify**: the app boots and renders with the new theme; no `tailwind.config.js` file remains.

---

## 2. Color tokens

Mechanical swap table. Apply with `rg` + manual edit (the agent does both):

| Before | After | Notes |
|--------|-------|-------|
| `bg-white` | `bg-background` or `bg-card` | `card` if it's a content surface; `background` if it's the page canvas. |
| `bg-gray-50` / `bg-gray-100` | `bg-muted` or `bg-secondary` | Semantically identical (`muted` = `secondary` = `accent` = `#f5f5f7`). Pick by intent. |
| `bg-gray-200` | `bg-border` | Rare -- usually a misuse of border as a fill. Reconsider. |
| `text-black` / `text-gray-900` / `text-zinc-950` | `text-foreground` | |
| `text-gray-500` / `text-gray-600` / `text-gray-700` | `text-muted-foreground` | Single secondary text color in the system. |
| `text-white` | `text-primary-foreground` | When on a `primary` background. Otherwise pick the right token. |
| `border-gray-200` / `border-gray-300` | `border-border` (or just `border`) | |
| `bg-red-500` / `bg-rose-500` (action) | `bg-destructive` | Only if it's a destructive action. Otherwise leave or pick a token. |
| `text-red-500` / `text-red-600` (error) | `text-destructive` | |
| `ring-blue-500` / `ring-black` | `ring-ring` | |
| Hardcoded hex matching a token (`#1d1d1f`, `#f5f5f7`, etc.) | Nearest semantic token | Cite [DESIGN.md](DESIGN.md) frontmatter. |

For hardcoded hexes that don't match any token: stop and surface as a UX decision for the user. Don't invent a mapping.

**Verify**: `rg "(text\|bg\|border)-(gray\|slate\|zinc\|neutral\|stone)-" --type tsx` returns zero matches in component files.

---

## 3. Typography

Map ad-hoc class strings to the semantic roles in [DESIGN.md](DESIGN.md). Common drift:

| Drift | Role | Class string |
|-------|------|--------------|
| `text-3xl font-bold` | display | `text-4xl font-semibold tracking-tight leading-tight` |
| `text-xl font-bold` | title | `text-2xl font-semibold tracking-tight` |
| `text-lg font-bold` | heading | `text-lg font-semibold` |
| `text-md font-medium` (md isn't a Tailwind size) | body-lg | `text-base` |
| `text-[14px]` | body | `text-sm` |
| `text-[12px] text-gray-500` | subtitle | `text-xs text-muted-foreground` |
| `text-[10px]` (raw) | caption | `text-[10px] text-muted-foreground` (intentional arbitrary value) |
| `text-[11px] font-medium text-gray-500` | label | `text-[11px] font-medium text-muted-foreground` |
| Anything using `font-bold` (700) | demote to semibold | `font-semibold` |

If the codebase still has legacy `.text-caption` or `.text-label` utilities defined in its `globals.css`, remove them and update the callsites to the arbitrary-value form. The Workbench's source-of-truth `client/` has these flagged for removal in a follow-up; the spec already reflects the desired end state.

**Verify**: zero `font-bold`; zero non-role-table arbitrary text sizes; semantic roles applied consistently to the same kind of element.

---

## 4. Components

Replace hand-rolled HTML with shadcn primitives. Preserve behavior; port intent into props.

**Before**:

```tsx
<button
  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
  onClick={onSubmit}
>
  Save
</button>
```

**After**:

```tsx
<Button onClick={onSubmit}>Save</Button>
```

The shadcn `<Button>` `default` variant already provides `bg-primary text-primary-foreground hover:bg-primary/90 rounded-md h-9 px-4`. No className needed.

**Before**:

```tsx
<input
  type="text"
  className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

**After**:

```tsx
<Input value={value} onChange={(e) => setValue(e.target.value)} />
```

The shadcn `<Input>` includes the focus ring, border, padding, and rounded corners.

**Before** (custom modal chrome):

```tsx
{isOpen && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
    <div className="bg-white rounded-lg p-6 max-w-md">
      <h2>Title</h2>
      ...
    </div>
  </div>
)}
```

**After**:

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    ...
  </DialogContent>
</Dialog>
```

If a target is missing a shadcn primitive entirely (no `components/ui/dialog.tsx`), install it via the shadcn CLI rather than hand-writing it. The shadcn registry is the source of truth for primitive shapes.

**Anti-pattern**: shadcn primitive used with `className` that fights the variant.

```tsx
// Bad
<Button variant="default" className="bg-red-500 hover:bg-red-600">Delete</Button>

// Good
<Button variant="destructive">Delete</Button>
```

**Verify**: zero hand-rolled `<button>` / `<input>` / `<dialog>` in component files; shadcn primitives never have `bg-*` / `text-*` / `border-*` overrides.

---

## 5. Layout patterns

Three sub-patterns. Each requires a UX decision -- surface in Phase 4 explicitly, do not auto-apply.

### App sidebar

If the target has an expanding sidebar:

- Ask the user: "Convert to fixed 64px icon-only (Workbench convention) or keep expanding?"
- If converting: replace expand/collapse machinery with a fixed `w-16` shell; replace nav labels with icon + tooltip pairs (Radix `<Tooltip>`).

If the target has a hamburger / mobile sidebar:

- Ask the user: "The Workbench is desktop-first and intentionally drops mobile sidebar machinery. Drop or keep?"
- Default: keep the responsive behavior unless the user explicitly opts in to desktop-only.

### Two-panel workbench

If the target has page content with side filters / settings panels:

- Apply the `flex gap-0` pattern: a 400px collapsible `SidePanel` to the left of a content area.
- Use `SidePanelLayout` and `SidePanelSection` (or recreate them following the canonical implementations in `client/src/components/shared/` and `client/src/components/dashboard/side-panel/`).

### Side-panel section toggles

Convention: `Plus` (collapsed) / `Minus` (expanded) icons in the header, not chevrons. Drop-in change:

```tsx
{isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
```

---

## 6. States

| State | Canonical pattern |
|-------|-------------------|
| Loading -- spinner | `<LoadingSpinner />` from `components/shared` |
| Loading -- skeleton | `<Skeleton className="h-... w-..." />` |
| Loading -- progress (indeterminate) | `<div className="animate-[progress-indeterminate_1.5s_ease-in-out_infinite]" />` inside a thin track |
| In-progress step | `<div className="size-2 rounded-full bg-foreground animate-stepper-pulse" />` |
| Toast | `import { toast } from "sonner"; toast.success(...)` |
| Notification dot | `<span className="absolute right-1 top-1 size-2 rounded-full bg-destructive" />` |
| Empty state | Centered stack: `<lucide-icon size="lg" /> <h2 className={display}>Title</h2> <p className={subtitle}>...</p> <Button>...</Button>` |
| Error state (inline) | `<p className="text-sm text-destructive">{message}</p>` next to a retry `<Button variant="ghost" size="sm">` |
| Error state (page) | Same shape as empty state, with destructive icon and primary action |

**Migration**: replace custom `<Toast>` / `<Snackbar>` / `<Alert>` chrome with `sonner`. Replace ad-hoc loading text (`<p>Loading...</p>`) with `<LoadingSpinner />` or `<Skeleton>`.

---

## 7. Motion + focus + accessibility

### Motion

- `duration-[Nms]` -> map to the scale (`duration-150`, `duration-200`, `duration-300`).
- `transition all duration-[200ms] ease-[...]` -> `transition-smooth` (the canonical wrapper).
- New keyframes -> add to `theme.css` under the canonical four; do not let component-local keyframes proliferate.
- Always emit a `prefers-reduced-motion` guard. The block in `theme.css` handles this globally; don't undo it.

### Focus

- Strip every `outline-none` / `outline: none` that lacks a `focus-visible` ring replacement.
- For shadcn primitives, never override the focus utilities via `className`.
- For custom interactive elements (rare), apply: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.

### Accessibility

- Icon-only `<Button size="icon">` -> add `aria-label="..."`.
- Decorative icons -> add `aria-hidden="true"`.
- `<Input>` -> ensure paired `<Label htmlFor>` and (when applicable) `aria-invalid`, `aria-describedby` for the error message.
- Hit targets -> ensure 44x44 effective (with padding); `size-9` icon buttons need adjacent padding.

---

## 8. Iconography migration

Replace any non-lucide icon library:

```bash
npm uninstall react-icons @heroicons/react @tabler/icons-react @radix-ui/react-icons
npm install lucide-react
```

Then map the imports. Common renames:

| Heroicons / Radix / Tabler | lucide-react |
|----------------------------|--------------|
| `ChevronLeftIcon` | `ChevronLeft` |
| `ChevronRightIcon` | `ChevronRight` |
| `XMarkIcon` / `Cross1Icon` | `X` |
| `CheckIcon` | `Check` |
| `Cog6ToothIcon` / `GearIcon` | `Settings` |
| `BellIcon` | `Bell` |
| `MagnifyingGlassIcon` / `MagnifyingGlassIcon` | `Search` |

Sizing: replace any size override with the scale tokens (`size-3` / `4` / `5` / `6` / `8`). Remove `strokeWidth` overrides -- the lucide default of 2 is the convention.

---

## 9. Dark mode migration

Only do this if the user explicitly asks for dark mode.

1. Copy the `:root.dark { ... }` block from [theme.css](theme.css) into the target's `globals.css`.
2. Verify all `dark:` Tailwind utilities in the target reference a token (e.g. `dark:bg-card`, not `dark:bg-[#1c1c1e]`).
3. Add a theme toggle UI (typically in the header or sidebar footer) that toggles a `.dark` class on `<html>`.
4. Run the audit again with dark mode active to surface contrast issues.

---

## 10. Charts migration

Replace hardcoded chart colors:

**Before**:

```tsx
<Bar fill="#3b82f6" />
<Line stroke="#10b981" />
```

**After**:

```tsx
<Bar fill="var(--chart-3)" />
<Line stroke="var(--chart-2)" />
```

For per-curve plot coloring (engineering data plots, not UI charts), do **not** invent a palette. Use the curve-coloring system from `client/src/lib/chart-utils/color.ts` if porting the same visual idiom; otherwise leave as-is and surface as a Suggestion that a deterministic curve-coloring scheme would help.

---

## Recipe template

When applying any swap, the agent should:

1. Run the `rg` recipe from [AUDIT.md](AUDIT.md) for the category.
2. For each match, apply the before -> after swap from this playbook.
3. Show the diff for review.
4. Note which audit findings (`1.1`, `2.3`, etc.) the change resolves.
5. Run a follow-up `rg` to confirm the drift pattern is no longer present.

If a swap depends on user judgment (semantic intent unclear, conflicts with a domain-specific override, multiple valid mappings), pause and ask. Don't guess.
