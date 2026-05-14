# Audit Checklist

Use this checklist during Phase 2 of the audit-and-align-ui workflow. Walk every category top to bottom on the target codebase. The expected values for each check live in [DESIGN.md](DESIGN.md) frontmatter and [theme.css](theme.css).

## Severity definitions

| Severity | Meaning | Examples |
|----------|---------|----------|
| **Critical** | Token is wrong or missing in a way that breaks the design system contract. Color drift, missing focus indicators, hand-rolled component shadowing a shadcn primitive. | Hardcoded hex in a component file; `outline-none` without a focus replacement; non-Geist font family. |
| **Warning** | Pattern violation that visibly drifts from the system but is not strictly broken. | `text-gray-500` instead of `text-muted-foreground`; arbitrary radius; arbitrary motion duration. |
| **Suggestion** | Disciplined improvement opportunity. Cleaner alignment with the role table; not a bug. | `text-[14px]` could be `text-sm`; loose icon size could snap to the scale. |

## Output format

Capture every finding with these fields:

- **Number** (sequential within category, e.g. `1.1`, `1.2`)
- **Severity**
- **File** (relative path)
- **Line** (or line range)
- **Current** (offending snippet, kept short)
- **Expected** (the token or pattern from DESIGN.md)

Render the report using the template in [SKILL.md](SKILL.md#phase-2-audit).

## Ripgrep conventions

All `rg` recipes below assume you scope to source directories (`src/`, `app/`, `components/`) -- not `node_modules`, `.next`, build outputs, or vendor copies. Add `-g '!node_modules' -g '!.next' -g '!dist'` if your target lacks a `.gitignore`.

---

## 1. Tokens (color)

What to find: raw hex values in component files, gray-family Tailwind utilities that should map to `muted-foreground` / `border` / `secondary`, `border` / `bg` / `text` colors that don't reference the shadcn token.

Recipes:

```bash
# Hardcoded hex in TSX (excludes .css files where hexes are expected)
rg "#[0-9a-fA-F]{3,8}\b" --type tsx

# Gray-family Tailwind utilities
rg "(text|bg|border)-(gray|slate|zinc|neutral|stone)-" --type tsx

# Arbitrary color values
rg "(text|bg|border)-\[#" --type tsx
```

Severity guide:

- **Critical**: Hardcoded hex in a `.tsx` component or layout. CSS variable in `globals.css` is fine -- it's the system's source.
- **Warning**: Any `text-gray-*`, `bg-gray-*`, `border-gray-*` (or sibling family). Maps to `muted-foreground` / `muted` / `border`.
- **Suggestion**: `bg-white` / `text-black` / `text-zinc-950` -- functional but not semantic. Should become `bg-background` / `text-foreground`.

## 2. Tokens (radius)

What to find: arbitrary radii bypassing the `--radius` scale.

Recipes:

```bash
rg "rounded-\[" --type tsx
rg "border-radius:" --type css
```

Severity guide:

- **Warning**: `rounded-[Npx]` with N not in {2, 4, 6, 8, 12, 16, 20, 24} (the scale derived from `--radius`).
- **Suggestion**: A radius that's in the scale but expressed as an arbitrary value -- prefer the named token (`rounded-md`, etc.).

## 3. Tokens (font)

What to find: non-Geist font families anywhere.

Recipes:

```bash
rg "font-family:" --type css --type tsx
rg "(Inter|Roboto|Helvetica|Arial|SF Pro|Manrope|Plus Jakarta|Poppins)" --type tsx --type css
rg "from \"next/font/google\"" --type tsx -A 3 | rg -v "Geist"
```

Severity guide:

- **Critical**: Any font family declaration that isn't Geist Sans / Geist Mono.
- **Critical**: A `next/font/google` import that names a non-Geist font.

## 4. Typography

What to find: inline font-size escapes outside the semantic role table.

Recipes:

```bash
# Arbitrary font sizes
rg "text-\[\d+px\]" --type tsx

# Raw font-size in CSS
rg "font-size:" --type css
```

Severity guide:

- **Warning**: `text-[NNpx]` for N not in {10, 11} (the values in the `caption` and `label` roles). Cross-reference DESIGN.md role table -- propose adding a role rather than freelancing.
- **Suggestion**: Class string drifts from a role's canonical class string by a single utility (e.g. `text-sm font-bold` instead of `text-sm font-semibold`).

## 5. Components

What to find: hand-rolled HTML elements where a shadcn primitive exists; shadcn components imported but with `className` overrides that fight the variant.

Recipes:

```bash
# Hand-rolled buttons
rg "<button " --type tsx

# Hand-rolled inputs
rg "<input " --type tsx

# Hand-rolled dialogs / details chrome
rg "<dialog " --type tsx
rg "<details " --type tsx

# shadcn buttons with override className that re-declares variant intent
rg "<Button[^>]+className=\"[^\"]*bg-" --type tsx
```

Severity guide:

- **Critical**: Hand-rolled `<button>` / `<input>` / `<dialog>` in a UI component file. Should use `<Button>` / `<Input>` / `<Dialog>` from `components/ui/`.
- **Warning**: shadcn primitive used with className that fights the variant (e.g. `<Button variant="default" className="bg-blue-500 text-white">`). The right move is choosing the right variant or extending the cva.
- **Suggestion**: shadcn primitive used with verbose className when a `size` prop would be cleaner.

## 6. Layout

What to find: sidebar width drift, custom expand/collapse logic, missing `SidePanelSection` pattern.

Recipes:

```bash
# Sidebar width changes
rg "w-\[\d+rem\]" components/layout components/ui/sidebar*

# Sidebar expand/collapse state machinery (the Workbench is fixed)
rg "(SIDEBAR_WIDTH|sidebar.*expanded|sidebar.*collapsed)" --type tsx
```

Severity guide:

- **Warning**: Sidebar width !== 4rem. Surface this as a UX choice -- don't auto-apply. Some apps legitimately want an expanding sidebar.
- **Suggestion**: Side-panel section toggle uses chevrons or other icons instead of `Plus` / `Minus`. Convention drift.

## 7. Elevation

What to find: raw `box-shadow:` declarations and Tailwind shadow utilities outside the 5-level scale.

Recipes:

```bash
rg "box-shadow:" --type css
rg "shadow-(2xl|inner)" --type tsx
rg "shadow-\[" --type tsx
```

Severity guide:

- **Warning**: `shadow-2xl` or `shadow-inner` -- not in the 5-level scale (flat / surface / raised / overlay / modal).
- **Suggestion**: Arbitrary `shadow-[...]` value. Map to the nearest scale level.

## 8. Shape

What to find: mixed radii inside a single surface.

Manual review only. Look at composed surfaces (Card containing inner Cards, Sheet containing inner panels). Different radii are fine across hierarchy levels (Card 8px containing Input 6px); same-level siblings should match.

Severity:

- **Suggestion**: Adjacent same-level siblings with different radii.

## 9. Motion

What to find: arbitrary durations, raw `animation:` declarations.

Recipes:

```bash
rg "duration-\[\d+ms\]" --type tsx
rg "transition-duration:" --type css
rg "animation:" --type css
```

Severity guide:

- **Warning**: `duration-[Nms]` for N not in {150, 200, 300}. Map to fast/normal/slow.
- **Warning**: Raw `animation:` in CSS that defines a new keyframe outside the four declared in `theme.css`. Propose adding it formally.

## 10. Focus & Accessibility

What to find: stripped focus indicators, missing `aria-label` on icon-only buttons, `outline-none` without replacement.

Recipes:

```bash
# outline-none without a focus replacement nearby
rg "outline-none" --type tsx -A 2 | rg -v "(focus-visible|ring-)"

# Icon-only buttons without aria-label
rg "<Button[^>]+size=\"icon[^\"]*\"" --type tsx -A 1 | rg -v "aria-label"

# size-icon variants (fallback for non-Button components)
rg "size-9.*<svg" --type tsx
```

Severity guide:

- **Critical**: `outline-none` (or `outline: none`) without a `focus-visible` ring replacement.
- **Critical**: Icon-only `<Button size="icon">` without `aria-label`.
- **Critical**: Form `<Input>` without an associated `<Label>` (cross-reference matching `htmlFor`).
- **Warning**: Hit target smaller than 44x44 (e.g. `size-6` standalone clickable).

## 11. Iconography

What to find: non-lucide icon libraries.

Recipes:

```bash
rg "from \"(react-icons|@heroicons|@tabler/icons|@radix-ui/react-icons|@phosphor-icons)" --type tsx

# Mixed icon sizes outside the scale
rg "<[A-Z][a-zA-Z]+ +(size|className)=\"[^\"]*size-\d+\"" --type tsx
```

Severity guide:

- **Critical**: Any non-lucide icon import.
- **Suggestion**: Icon sized outside the scale {3, 4, 5, 6, 8}. Snap to the nearest token.

## 12. States

What to find: data-fetching components missing loading / empty / error coverage; ad-hoc loading patterns instead of shadcn `Skeleton` or `LoadingSpinner`; raw alert chrome instead of `sonner`.

Recipes:

```bash
# Custom toast / alert chrome
rg "(<Alert|<Toast|<Snackbar)" --type tsx

# Ad-hoc loading text
rg "Loading\\.\\.\\." --type tsx

# Components with useQuery / useSWR but no isLoading branch nearby
rg "useQuery|useSWR" --type tsx
```

Severity guide:

- **Warning**: Component with async data but no skeleton / spinner branch.
- **Warning**: Component with async data but no error branch (no `isError` / `error` UI).
- **Critical**: Custom toast or alert chrome instead of `sonner`.
- **Suggestion**: Empty state without the canonical icon + title + (optional) CTA pattern.

## 13. Charts

What to find: hardcoded chart colors instead of the `chart-N` tokens or the curve coloring system.

Recipes:

```bash
rg "stroke=" components/charts --type tsx
rg "fill=" components/charts --type tsx
rg "var\\(--chart-" --type tsx --type css
```

Severity guide:

- **Warning**: Hardcoded hex on `stroke=` / `fill=` in a chart component. Should reference `var(--chart-N)` for UI charts or use the curve-coloring API for data plots.
- **Suggestion**: Inline color where a token is available.

---

## Cross-cutting check: dark mode

If the target codebase uses `dark:` Tailwind utilities anywhere, also check:

```bash
rg "\\bdark:" --type tsx | wc -l
rg ":root.dark|\\.dark\\b" --type css
```

If there are >0 `dark:` utilities but no `:root.dark { ... }` block defining the dark tokens, raise a **Warning** for cross-cutting category "Dark mode" with note: "dark variants present but no dark palette wired -- styles will fall through to light values".

The Workbench's Proposed dark palette in [theme.css](theme.css) is available to copy in if the user wants dark mode shipped.
