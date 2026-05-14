---
name: Multimatic Workbench
description: Apple-inspired light minimal design system for engineering workbench applications. Geist Sans/Mono on shadcn tokens, Tailwind v4 with @theme inline, fixed 64px icon sidebar, two-panel workspace.
canonical_implementation: client/src/app/globals.css
colors:
  light:
    background: "#ffffff"
    foreground: "#1d1d1f"
    card: "#ffffff"
    card-foreground: "#1d1d1f"
    popover: "#ffffff"
    popover-foreground: "#1d1d1f"
    primary: "#1d1d1f"
    primary-foreground: "#ffffff"
    secondary: "#f5f5f7"
    secondary-foreground: "#1d1d1f"
    muted: "#f5f5f7"
    muted-foreground: "#86868b"
    accent: "#f5f5f7"
    accent-foreground: "#1d1d1f"
    destructive: "#ff3b30"
    destructive-foreground: "#ffffff"
    border: "#e8e8ed"
    input: "#e8e8ed"
    ring: "#1d1d1f"
    chart-1: "#1d1d1f"
    chart-2: "#34c759"
    chart-3: "#5856d6"
    chart-4: "#ff9500"
    chart-5: "#af52de"
    sidebar: "#fafafa"
    sidebar-foreground: "#1d1d1f"
    sidebar-primary: "#1d1d1f"
    sidebar-primary-foreground: "#ffffff"
    sidebar-accent: "#f0f0f2"
    sidebar-accent-foreground: "#1d1d1f"
    sidebar-border: "#e8e8ed"
    sidebar-ring: "#1d1d1f"
  dark:
    # Proposed -- review before adding to globals.css
    background: "#000000"
    foreground: "#f5f5f7"
    card: "#1c1c1e"
    card-foreground: "#f5f5f7"
    popover: "#1c1c1e"
    popover-foreground: "#f5f5f7"
    primary: "#f5f5f7"
    primary-foreground: "#1d1d1f"
    secondary: "#2c2c2e"
    secondary-foreground: "#f5f5f7"
    muted: "#2c2c2e"
    muted-foreground: "#8e8e93"
    accent: "#2c2c2e"
    accent-foreground: "#f5f5f7"
    destructive: "#ff453a"
    destructive-foreground: "#ffffff"
    border: "#2c2c2e"
    input: "#3a3a3c"
    ring: "#f5f5f7"
    chart-1: "#f5f5f7"
    chart-2: "#30d158"
    chart-3: "#5e5ce6"
    chart-4: "#ff9f0a"
    chart-5: "#bf5af2"
    sidebar: "#1c1c1e"
    sidebar-foreground: "#f5f5f7"
    sidebar-primary: "#f5f5f7"
    sidebar-primary-foreground: "#1d1d1f"
    sidebar-accent: "#2c2c2e"
    sidebar-accent-foreground: "#f5f5f7"
    sidebar-border: "#2c2c2e"
    sidebar-ring: "#f5f5f7"
typography:
  font-family:
    sans: "Geist Sans, var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    mono: "Geist Mono, var(--font-geist-mono), ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace"
  semantic-roles:
    display:
      class: "text-4xl font-semibold tracking-tight leading-tight"
      use: "Hero headings, marketing surfaces, large empty-state titles."
    title:
      class: "text-2xl font-semibold tracking-tight"
      use: "Page titles, modal titles."
    heading:
      class: "text-lg font-semibold"
      use: "Subsection headers."
    card-title:
      class: "leading-none font-semibold"
      use: "shadcn Card titles. See client/src/components/ui/card.tsx."
    section-title:
      class: "text-base font-semibold tracking-tight"
      use: "Side-panel section headers. See client/src/components/shared/SidePanelSection.tsx."
    body-lg:
      class: "text-base"
      use: "Primary reading text in dialogs and detail views."
    body:
      class: "text-sm"
      use: "Default body text in dense workbench surfaces. shadcn default."
    subtitle:
      class: "text-xs text-muted-foreground"
      use: "Section subtitles, secondary descriptions."
    caption:
      class: "text-[10px] text-muted-foreground"
      use: "Plot labels, dense table captions, supporting metadata."
    label:
      class: "text-[11px] font-medium text-muted-foreground"
      use: "Form micro-labels, badges, taxonomy chips."
radius:
  base: "0.5rem"  # --radius
  sm: "calc(var(--radius) - 4px)"   # 0.25rem / 4px
  md: "calc(var(--radius) - 2px)"   # 0.375rem / 6px
  lg: "var(--radius)"               # 0.5rem  / 8px
  xl: "calc(var(--radius) + 4px)"   # 0.75rem / 12px
  2xl: "calc(var(--radius) + 8px)"  # 1rem    / 16px
  3xl: "calc(var(--radius) + 12px)" # 1.25rem / 20px
  4xl: "calc(var(--radius) + 16px)" # 1.5rem  / 24px
  full: "9999px"
elevation:
  flat:
    shadow: "none"
    use: "Inline content, table rows, plain text. No surface separation."
  surface:
    shadow: "0 1px 2px rgba(0, 0, 0, 0.04)"  # shadow-xs
    use: "Inputs, buttons, very subtle separation from background."
  raised:
    shadow: "0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)"  # shadow-subtle
    use: "Cards, side-panel containers, default workbench surfaces."
  overlay:
    shadow: "0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)"  # shadow-elevated
    use: "Popovers, dropdowns, tooltips, hover-elevated cards."
  modal:
    shadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"  # shadow-xl
    use: "Dialogs, sheets, command palette."
z-index:
  base: 0
  sticky: 10
  dropdown: 20
  sidebar: 30
  header: 40
  overlay: 50
  modal: 60
  toast: 70
  tooltip: 80
motion:
  duration:
    fast: "150ms"
    normal: "200ms"
    slow: "300ms"
  easing:
    standard: "cubic-bezier(0.4, 0, 0.2, 1)"  # .transition-smooth
  keyframes:
    - accordion-down
    - accordion-up
    - progress-indeterminate
    - stepper-pulse
  reduced-motion: "Respect prefers-reduced-motion: reduce. Set transitions to 0ms; disable non-essential keyframes."
icon:
  library: lucide-react
  size:
    xs: "12px"   # size-3
    sm: "16px"   # size-4 (default in shadcn buttons)
    md: "20px"   # size-5 (sidebar nav, app chrome)
    lg: "24px"   # size-6
    xl: "32px"   # size-8
  stroke: 2
  decorative: "aria-hidden=\"true\""
  semantic: "aria-label required"
sidebar:
  width: "4rem"  # 64px, icon-only, fixed
  collapsible: false
side-panel:
  expanded-width: "400px"
  collapsed-width: "56px"
  toggle-icons: ["Plus", "Minus"]
accessibility:
  contrast:
    body: "4.5:1 minimum (WCAG AA)"
    large-text: "3:1 minimum (>=18pt or >=14pt bold)"
    ui-elements: "3:1 minimum for borders, focus indicators, icons"
  focus:
    spec: "ring-2 ring-ring ring-offset-2 (global :focus-visible)"
    button: "ring-[3px] ring-ring/50 (heavier ring for primary action focus)"
  hit-target:
    minimum: "44x44px (or h-9/size-9 with adequate adjacent padding)"
  motion: "Respect prefers-reduced-motion: reduce"
  forms: "Every Input must be paired with a Label; errors connected via aria-describedby; aria-invalid set on invalid fields"
---

## Brand & Style

The Multimatic Workbench is an Apple-inspired light minimal design system built for dense engineering data surfaces. The personality is restrained, content-forward, and warm: pure white canvas, near-black ink, soft warm-gray supporting surfaces, and a single high-saturation accent (iOS red) reserved for destructive actions.

The system rejects ornamentation. There are no glassmorphism gradients, no dark vibrant backgrounds, no decorative shadows, no soft skeuomorphic textures. Visual hierarchy is built from typography, spacing, and a five-level elevation scale -- not from color or material effects.

The user is meant to forget the chrome and focus on the data.

## Colors

The palette is shadcn-named (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `chart-1..5`, `sidebar*`). The canonical hex values live in `:root` of [client/src/app/globals.css](../../../client/src/app/globals.css) and are mirrored in this document's frontmatter.

Core palette intent:

- **`background` (#ffffff) / `foreground` (#1d1d1f)** -- pure white canvas with Apple-near-black ink. Used everywhere except sidebar.
- **`card` / `popover`** -- match `background`. Surface separation is shape + shadow, not fill.
- **`primary`** -- inverted (#1d1d1f on white). Primary buttons are dark on light, not branded color.
- **`secondary` / `muted` / `accent` (#f5f5f7)** -- single warm-gray for chips, hover states, inactive surfaces. Same hex used three ways for semantic clarity at the component layer.
- **`muted-foreground` (#86868b)** -- the only secondary text color. No grays in between.
- **`destructive` (#ff3b30)** -- iOS red. Reserved for delete actions, error text, and destructive notification dots. Never used decoratively.
- **`border` (#e8e8ed)** -- nearly invisible. Borders define structure, never decorate.
- **`ring`** -- matches `foreground`. Focus rings inherit the ink color.
- **`sidebar` (#fafafa)** -- the *only* off-white in the system. Subtly distinguishes the navigation rail from the content canvas.
- **`chart-1..5`** -- iOS-flavored categorical palette for non-curve visualizations.

The system is **light-only today**. A `.dark` variant hook exists (`@custom-variant dark (&:is(.dark *))`), but no dark tokens are wired into `globals.css`. The frontmatter `colors.dark` block is **Proposed** -- derived from the iOS dark system palette -- and should be reviewed before being added to a target codebase.

## Typography

The system uses **Geist Sans** for UI and **Geist Mono** for code, both loaded via `next/font/google` in [client/src/app/layout.tsx](../../../client/src/app/layout.tsx).

There is no custom semantic ramp (no `display-lg`, `headline-md`, `body-lg`). Instead, the system documents **semantic roles** that map to concrete Tailwind class strings -- so authors compose with the same primitives shadcn uses. The full role table is in the frontmatter under `typography.semantic-roles`.

Discipline rules:

- Use **role names** (`title`, `body`, `subtitle`, `caption`) when discussing intent. Use the class string directly when writing code.
- Don't invent new sizes. If you reach for `text-[NNpx]` outside the role table, you're missing a role -- propose an addition rather than freelancing.
- `caption` (`text-[10px]`) and `label` (`text-[11px]`) intentionally use Tailwind arbitrary values. The current client still has legacy `.text-caption` / `.text-label` utility classes in `globals.css` (used in 6 files); these are scheduled for removal in a follow-up. New code should use the arbitrary-value form from the role table.
- Weights: `font-normal` (default), `font-medium`, `font-semibold`. Do not use `font-bold` (`700`); the system tops out at `600`.

## Layout & Spacing

The system has one canonical layout: **fixed icon sidebar + content canvas**, with content surfaces composed from the **two-panel workbench** pattern (collapsible side panel + main work area).

Spec:

- **App sidebar**: 64px (`SIDEBAR_WIDTH = "4rem"`), icon-only, fixed, never expands. See [client/src/components/ui/sidebar.tsx](../../../client/src/components/ui/sidebar.tsx). Mobile is intentionally not supported -- the workbench is desktop-first.
- **Site header**: thin (h-14), holds context-specific actions, sits inside `SidebarInset`.
- **Two-panel workbench**: a 400px-wide collapsible `SidePanel` flanked by a `DashboardContent` area, mounted with `flex gap-0` so the panels share borders. Pattern from [client/src/app/dashboard/page.tsx](../../../client/src/app/dashboard/page.tsx).
- **Side-panel sections**: collapsible groups using `Plus`/`Minus` icons in the header (not chevrons). See [client/src/components/shared/SidePanelSection.tsx](../../../client/src/components/shared/SidePanelSection.tsx).

Spacing uses the standard Tailwind scale -- no custom keys. Common idioms:

- Form field stack: `space-y-4` between fields, `space-y-2` between label and input.
- Card padding: `py-6` + `px-6` (shadcn defaults).
- Side-panel inner padding: `p-5`.
- Section margin: `mt-4` to introduce a new section.

## Elevation & Depth

Five levels. Elevation is created with a small set of shadow utilities -- not borders, not blur, not gradients.

| Level | Token name | Class / value | Use |
|-------|-----------|---------------|-----|
| 0 | flat | none | Inline content, table rows |
| 1 | surface | `shadow-xs` | Inputs, buttons |
| 2 | raised | `.shadow-subtle` | Cards, default workbench surfaces |
| 3 | overlay | `.shadow-elevated` | Popovers, dropdowns, tooltips |
| 4 | modal | `shadow-xl` | Dialogs, sheets |

Dialogs additionally use a `bg-black/50 backdrop-blur-sm` overlay (see [client/src/components/ui/dialog.tsx](../../../client/src/components/ui/dialog.tsx)). The `.backdrop-blur-subtle` utility (`backdrop-filter: blur(20px) saturate(180%)`) is available but used sparingly -- glass effects are *not* the primary aesthetic.

## Shape

The radius scale is derived from `--radius: 0.5rem`. See `radius` in frontmatter.

Component conventions:

- Buttons, inputs, badges -> `rounded-md` (6px)
- Cards, panels -> `rounded-lg` (8px)
- Dialogs, sheets -> `rounded-xl` (12px)
- Pills, avatars, indicator dots -> `rounded-full`

Don't mix radii arbitrarily inside a single surface. A Card containing Inputs is fine; a Card with another Card of a different radius is not.

## Motion

Durations and easings are tokenized in the frontmatter under `motion`. The `.transition-smooth` utility (`transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`) is the canonical wrapper for state transitions.

Available keyframes (defined in `globals.css`):

- `accordion-down` / `accordion-up` -- Radix Collapsible default
- `progress-indeterminate` -- horizontal sweep for loading bars
- `stepper-pulse` -- opacity pulse for in-progress steps (`.animate-stepper-pulse`)

Discipline:

- Default duration is `200ms` (normal). Use `150ms` (fast) for hover/focus, `300ms` (slow) only for entrance animations longer than a button press.
- Always honor `prefers-reduced-motion: reduce`. Wrap non-essential animations in a media query that disables them; for `transition-smooth`, override to `transition: none`.

## Focus & Interaction

The system has a global focus-visible spec defined in `globals.css`:

```css
:focus-visible {
  outline: none;
  ring: 2 ring-ring ring-offset-2 ring-offset-background;
}
```

shadcn primitives layer on a heavier ring:

- Buttons: `focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring`
- Inputs: `focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring`
- Inputs add `aria-invalid:border-destructive aria-invalid:ring-destructive/20` for error states

Never set `outline: none` without a replacement. The global rule provides the replacement; component-level overrides should compose, not strip it.

## Accessibility minimums

The Workbench enforces these baselines (also captured in the `accessibility` frontmatter block):

- **Contrast**: WCAG AA -- 4.5:1 body text, 3:1 large text and UI components (icons, borders, focus indicators).
- **Focus**: Always visible. The global `:focus-visible` rule satisfies this; do not break it with `outline-none` overrides.
- **Hit targets**: 44x44px minimum. shadcn `size="icon"` (`size-9` = 36x36) is acceptable only when surrounded by ≥4px padding; otherwise use `size="icon-lg"` (`size-10`).
- **Motion**: Honor `prefers-reduced-motion`.
- **Icons**: Decorative -> `aria-hidden="true"`. Semantic (icon-only buttons) -> `aria-label="..."` describing the action.
- **Forms**: Every `<Input>` paired with a `<Label htmlFor>`. Errors rendered as `text-sm text-destructive` and connected via `aria-describedby` referencing the message id. Set `aria-invalid` on invalid fields.

## Iconography

Single library: **lucide-react**. Do not mix in `react-icons`, `@heroicons`, `@tabler/icons`, or `@radix-ui/react-icons`.

Size scale (from frontmatter `icon.size`):

| Token | Tailwind | Pixels | Use |
|-------|----------|--------|-----|
| xs | `size-3` | 12px | Inline glyphs in dense tables, badge prefixes |
| sm | `size-4` | 16px | shadcn button default, form-field affordances |
| md | `size-5` | 20px | App sidebar nav, header actions |
| lg | `size-6` | 24px | Empty-state illustrations, focal indicators |
| xl | `size-8` | 32px | Hero illustrations |

Stroke width: 2 (lucide default). Don't override.

## Feedback States

Each state has one canonical pattern:

- **Loading -- spinner**: `<LoadingSpinner />` (`client/src/components/shared`). Use for full-area waits.
- **Loading -- skeleton**: shadcn `<Skeleton>`. Use for content-shaped placeholders.
- **Loading -- progress**: `progress-indeterminate` keyframe wrapped in a thin track. For bounded progress, render a determinate bar.
- **In-progress step**: `.animate-stepper-pulse` on the active step indicator.
- **Toast**: `sonner`. Imported once at the app root; called via `toast.success(...)`, `toast.error(...)`.
- **Notification dot**: 8px (`size-2`) `rounded-full bg-destructive`, absolutely positioned top-right of the host element. See the admin-pending-count pattern in [client/src/components/layout/AppSidebar.tsx](../../../client/src/components/layout/AppSidebar.tsx).
- **Empty state**: centered stack with a `lg`/`xl` lucide icon, a `title`-role heading, an optional `subtitle`, and an optional CTA `<Button>`.
- **Error state (inline)**: `text-sm text-destructive` near the failing element; optionally a small `<Button variant="ghost" size="sm">` retry beside it.
- **Error state (page)**: full-area centered stack with a destructive icon, title, body explanation, and primary action (retry / go back).

## Form patterns

Vertical layout, label above input, defined in [client/src/app/login/page.tsx](../../../client/src/app/login/page.tsx) and the standard shadcn shape:

```tsx
<form className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="x">Field name</Label>
    <Input id="x" required />
    <p className="text-xs text-muted-foreground">Help text.</p>
    <p className="text-sm text-destructive">Error message.</p>
  </div>
  <Button type="submit" className="w-full">Submit</Button>
</form>
```

- `space-y-4` between fields; `space-y-2` between label and input (and from input to help/error text).
- Help text: `text-xs text-muted-foreground` below the input.
- Error text: `text-sm text-destructive` below the input. Connect via `aria-describedby`.
- Submit buttons in narrow forms (login, single-column dialogs): `className="w-full"`. In wide forms or toolbars: default width, right-aligned.

## Charts

The `chart-1..5` tokens (`#1d1d1f`, `#34c759`, `#5856d6`, `#ff9500`, `#af52de`) are the categorical palette for **UI charts** -- bar/pie/donut/sparkline visualizations of categorical or summary data.

They are **not** the per-curve plotting palette. The workbench's data plots use a runtime curve-coloring system in [client/src/lib/chart-utils/color.ts](../../../client/src/lib/chart-utils/color.ts) with its own deterministic color assignment. That system is intentionally outside the design token surface.

Use `var(--chart-N)` (or the Tailwind `chart-N` token) for UI charts. Use the curve coloring API for data plots.

## Dark Mode

The `.dark` class hook is wired in `globals.css`:

```css
@custom-variant dark (&:is(.dark *));
```

But no dark tokens are currently defined in `:root.dark`. The frontmatter `colors.dark` block contains a **Proposed** Apple-derived dark palette ready to be reviewed and copied into a target's `globals.css` (and into `.dark` overrides in `theme.css`).

Until dark tokens ship in `globals.css`, avoid scattering `dark:` utilities in components -- they will silently fall through to light values.

## Components pointer

Component-level decisions (variant taxonomies, size scales, hover/active patterns) are the responsibility of the shadcn primitives in [client/src/components/ui/](../../../client/src/components/ui/). The `cva` definitions there are the source of truth.

This document does **not** duplicate variant tokens. If you need to know what variants `<Button>` supports, read [client/src/components/ui/button.tsx](../../../client/src/components/ui/button.tsx). If you need to extend a variant, edit the cva definition; do not invent a new component.
