---
name: design-guidelines-sync-actual-ui
overview: Convert .cursor/skills/design-guidelines/ into an invokable Cursor skill (audit-and-align-ui) that captures the current client/ as the canonical Multimatic Workbench design system, elevated with expert UX additions, and teaches the agent to audit any Next.js + Tailwind v4 + shadcn codebase against it and produce a file-by-file refactor plan executed in the working tree.
todos:
  - id: write_skill_md
    content: "Create .cursor/skills/design-guidelines/SKILL.md with frontmatter (name: audit-and-align-ui, description) and a five-phase workflow (Discovery, Audit, Plan, Approval, Execute) under 500 lines."
    status: completed
  - id: rewrite_readme
    content: "Rewrite .cursor/skills/design-guidelines/README.md: title 'Multimatic Workbench Design System', list all files in the new skill folder."
    status: completed
  - id: rewrite_design_md
    content: "Rewrite .cursor/skills/design-guidelines/DESIGN.md (the canonical spec): frontmatter with shadcn tokens mirroring globals.css :root + Proposed dark block; body sections covering brand, colors, typography (semantic roles), layout, elevation (5 levels), shape, motion, focus, accessibility minimums, iconography, states, charts, z-index, dark, form patterns, components pointer."
    status: completed
  - id: rewrite_tokens_json
    content: Rewrite .cursor/skills/design-guidelines/design_tokens.json to DTCG format with color (light + dark Proposed), radius, font, elevation, z-index, motion, icon-size groups; remove M3 tokens, component tokens, custom spacing, M3 type ramp.
    status: completed
  - id: delete_tailwind_config
    content: Delete .cursor/skills/design-guidelines/tailwind.config.js.
    status: completed
  - id: create_theme_css
    content: Create .cursor/skills/design-guidelines/theme.css mirroring the real Tailwind v4 @theme inline + :root + keyframes + utility layer from client/src/app/globals.css (excluding the to-be-removed .text-caption/.text-label customs).
    status: completed
  - id: create_audit_md
    content: "Create .cursor/skills/design-guidelines/AUDIT.md with the audit checklist: 13 categories (tokens, typography, components, layout, elevation, shape, motion, focus, accessibility, iconography, states, charts, dark) each with severity criteria (Critical/Warning/Suggestion) and ripgrep recipes for finding drift."
    status: completed
  - id: create_refactor_md
    content: "Create .cursor/skills/design-guidelines/REFACTOR.md with refactor playbook: per-category before/after recipes, common drift patterns (e.g. text-gray-* -> text-muted-foreground, custom radius -> --radius scale), file-glob targeting strategy, ordering rules (tokens first, then components, then patterns)."
    status: completed
  - id: log_decision
    content: "Append a decision-log entry to docs/decisions/log.md recording: skill conversion, current client = canonical template, .text-caption/.text-label removal as a follow-up, Proposed dark palette captured."
    status: completed
  - id: verify
    content: "Verify: SKILL.md under 500 lines; description includes WHAT and WHEN with trigger terms; zero references to old M3/Atmospheric Glass tokens; all hex values trace back to globals.css :root or are flagged Proposed; theme.css matches globals.css except for documented omissions; all reference files are one level deep from SKILL.md."
    status: completed
isProject: false
---

# Design-guidelines as an audit-and-align skill

## Source-of-truth reconciliation

The current `.cursor/skills/design-guidelines/` folder describes a dark glassmorphism weather UI ("Atmospheric Glass") that is unrelated to the real client. The real client (`client/src/app/globals.css`, `client/src/app/layout.tsx`, `client/src/components/ui/*`) is light, Apple-minimal, on Geist + shadcn tokens with a fixed 64px icon sidebar and a two-panel workspace.

The user likes the current client's design and wants it **templated** so other codebases can be brought into alignment. The folder is therefore being converted into an invokable Cursor skill that:

1. Captures the current client as the canonical "Multimatic Workbench" design system, elevated with disciplined expert UX additions
2. Teaches the agent to audit any compatible codebase and produce a refactor plan
3. Executes the plan in the working tree after user approval

## Decisions locked in (from grilling)

- **Skill purpose**: audit + refactor any compatible codebase to match the canonical template
- **Skill scope**: stack-specific -- Next.js + Tailwind v4 + shadcn + Radix + lucide-react
- **Skill name** (frontmatter): `audit-and-align-ui`
- **Brand of the design system itself**: Multimatic Workbench
- **Source of truth**: current `client/` is the template; not a refactor target
- **Token vocabulary**: shadcn only (mirror `globals.css` 1:1)
- **Tailwind artifact**: delete `tailwind.config.js`; ship `theme.css` mirroring real `@theme inline` + `:root`
- **Type ramp**: drop M3 ramp; document Tailwind defaults + semantic roles; `.text-caption`/`.text-label` flagged for removal (follow-up, not this task)
- **Components**: no per-component token blocks; shadcn `cva` variants in `.tsx` are source of truth
- **Charts**: only `chart-1..5` tokens (iOS palette); per-curve plot coloring is runtime, not a design token
- **Dark mode**: Apple-style dark palette derived and shipped as **Proposed**
- **Expert additions** (all approved): semantic type roles, accessibility minimums (WCAG, focus-ring spec, motion-reduce, hit targets), 5-level elevation hierarchy, z-index scale, iconography rules (lucide-react sizes/stroke), form/state patterns, Proposed dark palette
- **Audit output**: report + refactor plan; ask user before executing
- **Refactor freedom**: high freedom -- pure text instructions, no scripts/codemods
- **Refactor execution**: in current working tree (no auto-commit, no PR)

## File layout (final)

```
.cursor/skills/design-guidelines/
├── SKILL.md           # Required: invokable entrypoint with workflow
├── README.md          # Folder overview + file table
├── DESIGN.md          # Canonical spec: tokens + body sections
├── theme.css          # Portable Tailwind v4 @theme inline + :root snippet
├── design_tokens.json # DTCG-format token export
├── AUDIT.md           # Audit checklist with severity + rg recipes
└── REFACTOR.md        # Refactor playbook with before/after recipes
```

`tailwind.config.js` is deleted.

## Files to write

### `SKILL.md` (new)

Frontmatter (must satisfy create-skill conventions):

- `name: audit-and-align-ui`
- `description` (third person, includes WHAT and WHEN with trigger terms): "Audit a Next.js + Tailwind v4 + shadcn + Radix codebase against the Multimatic Workbench design system (Apple-inspired light minimal) and produce a file-by-file refactor plan to bring it into alignment. Use when the user wants to apply the Workbench design system to another app, audit UI for token/pattern drift, align colors/typography/spacing/components/states with the canonical template, or mentions design guidelines, audit UI, apply Workbench design, or align design tokens."

Body sections (target ~150-250 lines, must stay under 500):

1. **Quick start** -- one-paragraph orientation: read DESIGN.md to learn the system, read AUDIT.md and REFACTOR.md when running the workflow, theme.css/design_tokens.json are portable artifacts.
2. **Stack assumptions** -- list the required stack (Next.js, Tailwind v4 with `@theme inline`, shadcn primitives in `components/ui/`, Radix, lucide-react). If the target codebase doesn't match, halt and report.
3. **Workflow** -- five phases:
  - **Phase 1: Discovery** -- locate `app/layout.tsx`, `globals.css` (or equivalent), `tailwind.config.*` (must be absent for v4), `components/ui/`, `components/layout/`. Confirm stack assumptions. Report any blockers and stop if unmet.
  - **Phase 2: Audit** -- read AUDIT.md and walk the 13 categories. For each finding, capture file path, line range, current vs expected, and severity (Critical/Warning/Suggestion). Use ripgrep recipes from AUDIT.md to enumerate drift quickly.
  - **Phase 3: Plan** -- read REFACTOR.md and convert findings into a grouped, ordered file-by-file plan. Group by category for reviewability. Order: tokens first (foundation), then components, then patterns, then states. For each plan item: file path + before/after diff sketch + which audit finding it resolves.
  - **Phase 4: Approval** -- present the audit report and the refactor plan together. Ask the user which findings to apply (all / by category / individual numbers). Wait for explicit approval.
  - **Phase 5: Execute** -- apply approved changes file-by-file in the working tree. Show what was changed. Do NOT auto-commit. Surface anything that couldn't be auto-resolved (e.g. ambiguous semantic intent) and flag for manual review.
4. **Reference files** -- linked one level deep:
  - [DESIGN.md](DESIGN.md) -- the canonical token + pattern spec
  - [AUDIT.md](AUDIT.md) -- audit checklist
  - [REFACTOR.md](REFACTOR.md) -- refactor playbook
  - [theme.css](theme.css) -- portable Tailwind v4 snippet
  - [design_tokens.json](design_tokens.json) -- DTCG export

### `README.md` (rewrite)

Title: **Multimatic Workbench Design System**. Brief paragraph: "An invokable Cursor skill that audits a Next.js + Tailwind v4 + shadcn codebase against the Workbench design system (Apple-inspired light minimal) and aligns it through a structured plan. The system is templated from the canonical reference implementation in `client/`."

File table lists: SKILL.md, DESIGN.md, theme.css, design_tokens.json, AUDIT.md, REFACTOR.md.

### `DESIGN.md` (rewrite)

Frontmatter:

- `name: Multimatic Workbench`
- `colors`: shadcn tokens mirroring `:root` in [client/src/app/globals.css](client/src/app/globals.css) verbatim (background, foreground, card, card-foreground, popover, popover-foreground, primary, primary-foreground, secondary, secondary-foreground, muted, muted-foreground, accent, accent-foreground, destructive, destructive-foreground, border, input, ring, chart-1..5, sidebar + 6 sidebar-* tokens)
- `dark`: a **Proposed** Apple-derived dark palette (e.g. `background: #000`, `foreground: #f5f5f7`, `card: #1c1c1e`, `popover: #1c1c1e`, `primary: #f5f5f7`, `secondary: #2c2c2e`, `muted: #2c2c2e`, `muted-foreground: #8e8e93`, `accent: #2c2c2e`, `destructive: #ff453a`, `border: #2c2c2e`, `input: #3a3a3c`, `ring: #f5f5f7`, `chart-1..5` shifted to iOS dark variants, `sidebar` tokens shifted accordingly) -- block clearly labelled "Proposed -- review before adding to globals.css"
- `typography`: families Geist Sans + Geist Mono; explicit semantic role table mapping each role to a concrete Tailwind class string (display/title/heading/body/caption/label) -- no custom semantic ramp invented
- `radius`: derived from `--radius: 0.5rem` (sm/md/lg/xl/2xl/3xl/4xl per `globals.css`)
- `elevation`: 5 levels mapping shadow utilities to roles (flat / surface / raised / overlay / modal -- e.g. shadow-xs for inputs, shadow-sm for cards, shadow-subtle for hover-elevated cards, shadow-elevated for popovers, shadow-xl for dialogs)
- `z-index`: scale (base 0, sticky 10, dropdown 20, sidebar 30, header 40, overlay 50, modal 60, toast 70, tooltip 80)
- `motion`: durations (fast 150ms, normal 200ms, slow 300ms), easings (cubic-bezier(0.4, 0, 0.2, 1) -- mirroring `.transition-smooth`), keyframes (accordion-down, accordion-up, progress-indeterminate, stepper-pulse), respects `prefers-reduced-motion`
- `icon`: lucide-react; size scale (xs 12px, sm 16px, md 20px, lg 24px, xl 32px), default stroke 2, decorative icons get aria-hidden, semantic icons get aria-label

Body sections (each cites the canonical implementation in `client/`):

1. **Brand & Style** -- Apple-inspired minimalism, warm neutrals, content-forward, restraint over decoration; explicit non-goal: no glassmorphism as a primary aesthetic
2. **Colors** -- shadcn semantic role table; cite [client/src/app/globals.css](client/src/app/globals.css)
3. **Typography** -- Geist Sans/Mono via `next/font/google` in [client/src/app/layout.tsx](client/src/app/layout.tsx); semantic role table:
  - `display` -> `text-4xl font-semibold tracking-tight leading-tight`
  - `title` -> `text-2xl font-semibold tracking-tight`
  - `card-title` -> `leading-none font-semibold` (matches [client/src/components/ui/card.tsx](client/src/components/ui/card.tsx))
  - `section-title` -> `text-base font-semibold tracking-tight` (matches [client/src/components/shared/SidePanelSection.tsx](client/src/components/shared/SidePanelSection.tsx))
  - `body` -> `text-sm` (default)
  - `body-lg` -> `text-base`
  - `subtitle` -> `text-xs text-muted-foreground`
  - `caption` -> `text-[10px] text-muted-foreground`
  - `label` -> `text-[11px] font-medium text-muted-foreground`
  - Note: the live `.text-caption`/`.text-label` utilities in `globals.css` are flagged for removal in a follow-up task; semantic roles use Tailwind arbitrary values instead
4. **Layout & Spacing** -- two-panel workspace, fixed 64px icon-only sidebar (`SIDEBAR_WIDTH = "4rem"` in [client/src/components/ui/sidebar.tsx](client/src/components/ui/sidebar.tsx)), `SidebarInset` content area with `SiteHeader`, dashboard `flex gap-0` from [client/src/app/dashboard/page.tsx](client/src/app/dashboard/page.tsx), `SidePanelLayout` collapsible side panel (400px expanded), `SidePanelSection` collapsible groups using `Plus`/`Minus` icons (convention: not chevrons), Tailwind default spacing scale
5. **Elevation & Depth** -- 5-level hierarchy mapping the `:elevation` token block to roles; cite `.shadow-subtle`, `.shadow-elevated`, `shadow-xs`, `shadow-sm`, `shadow-xl`; dialog overlay `bg-black/50 backdrop-blur-sm`; `.backdrop-blur-subtle` for occasional translucent overlays
6. **Shape** -- radius scale; buttons/inputs `rounded-md`, cards `rounded-lg`, dialogs `rounded-xl`, badges `rounded-md`, full-pill `rounded-full`
7. **Motion** -- map `:motion` tokens to actual usages; respect `prefers-reduced-motion: reduce` (set transitions to 0ms, disable non-essential animations)
8. **Focus & Interaction** -- global `:focus-visible` ring (`ring-2 ring-ring ring-offset-2`), button `focus-visible:ring-[3px] focus-visible:ring-ring/50`, `aria-invalid:border-destructive` from [client/src/components/ui/button.tsx](client/src/components/ui/button.tsx) and [client/src/components/ui/input.tsx](client/src/components/ui/input.tsx)
9. **Accessibility minimums** -- WCAG AA contrast (4.5:1 body, 3:1 large text and UI), focus indicators always visible (no `outline: none` without replacement), interactive hit targets >= 44x44px (or `size-9`/`h-9` icon buttons paired with adequate padding), motion respects user preference, all icons have `aria-hidden` (decorative) or `aria-label` (semantic), form inputs paired with `<Label>`, error messages connected via `aria-describedby`
10. **Iconography** -- lucide-react only; size scale tokens; default stroke 2; semantic vs decorative usage rules
11. **Feedback States** -- loading (`LoadingSpinner`, `Skeleton`), toast (`sonner`), progress (`progress-indeterminate`), in-progress step (`stepper-pulse`), destructive notification dot (admin sidebar pending count in [client/src/components/layout/AppSidebar.tsx](client/src/components/layout/AppSidebar.tsx)), empty state pattern (centered, muted text, optional CTA), error state pattern (inline `text-destructive` with optional retry)
12. **Form patterns** -- vertical layout with `<Label>` above `<Input>`, `space-y-2` between label-input pairs, `space-y-4` between fields, error text below as `text-sm text-destructive`, help text below as `text-xs text-muted-foreground`, submit button full-width in narrow forms (login pattern from [client/src/app/login/page.tsx](client/src/app/login/page.tsx))
13. **Z-index** -- map `:z-index` tokens to layers; cite shadcn defaults
14. **Charts** -- `chart-1..5` tokens (`#1d1d1f`, `#34c759`, `#5856d6`, `#ff9500`, `#af52de`) are the categorical UI palette for non-curve visualizations; non-goal: per-curve plot coloring (runtime concern in [client/src/lib/chart-utils/color.ts](client/src/lib/chart-utils/color.ts))
15. **Dark Mode** -- `.dark` hook present in `globals.css`; tokens currently undefined; Proposed palette in frontmatter for review
16. **Components pointer** -- shadcn primitives in [client/src/components/ui/](client/src/components/ui/) are the source of truth; cva variants encode all component-level decisions; do NOT duplicate variant tokens in this doc

### `theme.css` (new)

Self-contained excerpt mirroring real Tailwind v4 setup from [client/src/app/globals.css](client/src/app/globals.css):

- `@import "tailwindcss"`, `@plugin "@tailwindcss/typography"`, `@custom-variant dark (...)`
- `@theme inline { ... }` block with all `--color-*`, `--font-*`, `--radius-*`, `--animate-*` tokens
- `:root { ... }` block with all CSS variable values (light)
- `:root.dark { ... }` block with the Proposed dark palette (commented header: "Proposed -- review before enabling")
- `@keyframes` (accordion-down, accordion-up, progress-indeterminate, stepper-pulse)
- `@layer utilities` (`.shadow-subtle`, `.shadow-elevated`, `.backdrop-blur-subtle`, `.text-balance`, `.transition-smooth`, `.animate-stepper-pulse`)
- **Excludes** `.text-caption`/`.text-label` and their `--font-size-*` vars (intentional drift -- documented end state)
- Header comment: "Portable reference. The live source for this template is `client/src/app/globals.css`."

### `design_tokens.json` (rewrite)

DTCG-format JSON with `$type` per group:

- `color.light` -- every shadcn token from `globals.css :root`
- `color.dark` -- Proposed palette (each token has `$extensions.proposed: true`)
- `radius` -- sm/md/lg/xl/2xl/3xl/4xl derived from `--radius`
- `font.family` -- sans (Geist Sans + fallbacks), mono (Geist Mono + fallbacks)
- `elevation` -- 5 levels with shadow strings + intended role
- `z-index` -- 9 named layers
- `motion.duration` -- fast/normal/slow
- `motion.easing` -- standard cubic-bezier
- `icon.size` -- xs/sm/md/lg/xl

Removed: all `component.*` tokens, all M3 surface/tertiary tokens, the spacing custom keys, the M3 type ramp.

### `AUDIT.md` (new)

Audit checklist organized by 13 categories. For each: severity criteria, ripgrep recipes, what counts as a finding.

Categories:

1. **Tokens (color)** -- find raw hex usage, `text-gray-*`/`bg-gray-*` shorthand, mismatched dark-mode hexes. rg recipes: `rg "#[0-9a-fA-F]{3,8}\\b" --type tsx --type css`, `rg "(text|bg|border)-(gray|slate|zinc|neutral|stone)-" --type tsx`. Critical: hardcoded hex in component file. Warning: gray-family Tailwind utility (should be `muted-foreground` / `border` / etc).
2. **Tokens (radius)** -- find `rounded-[Npx]`, custom `border-radius` declarations. rg: `rg "rounded-\\[" --type tsx`, `rg "border-radius:" --type css`. Suggestion: arbitrary radius (should map to scale).
3. **Tokens (font)** -- font-family declarations outside the layout. rg: `rg "font-family:" --type css`, `rg "Inter|Roboto|Helvetica" --type tsx --type css`. Critical: non-Geist font.
4. **Typography** -- find inline font sizes outside semantic roles. rg: `rg "text-\\[\\d+px\\]" --type tsx`, `rg "font-size:" --type css`. Warning: arbitrary text size (cross-reference DESIGN.md role table).
5. **Components** -- find hand-rolled equivalents of shadcn primitives. rg: `rg "<button " --type tsx` (should use `<Button>`), `rg "<input " --type tsx`, custom `<dialog>` / `<details>` chrome. Critical: hand-rolled button/input. Warning: shadcn component imported but with className overrides that fight the variant.
6. **Layout** -- check for sidebar width drift, side-panel section pattern. rg: `rg "w-\\[\\d+rem\\]" client/src/components/layout`, `rg "Sidebar" --type tsx`. Warning: sidebar wider than 4rem in icon-only mode.
7. **Elevation** -- find `box-shadow:` declarations and stray `shadow-2xl`/`shadow-inner`. rg: `rg "box-shadow:" --type css`, `rg "shadow-(2xl|inner)" --type tsx`. Suggestion: cross-reference 5-level scale.
8. **Shape** -- detect mixed radius styles in adjacent elements (Card+Dialog with different radii is OK; Card+Card with different radii is not).
9. **Motion** -- find `animation:` and `transition:` declarations not using tokens. rg: `rg "transition-duration:" --type css`, `rg "duration-\\[\\d+ms\\]" --type tsx`. Suggestion: arbitrary duration (should map to motion tokens).
10. **Focus & Accessibility** -- find `outline: none` without replacement, missing `aria-label` on icon-only buttons, missing focus-visible. rg: `rg "outline-none" --type tsx -A 2 | rg -v "focus-visible"`, `rg "<Button[^>]*size=\\\"icon" --type tsx -A 1 | rg -v "aria-label"`. Critical: outline removed without replacement.
11. **Iconography** -- non-lucide icons. rg: `rg "from ['\"](react-icons|@heroicons|@tabler/icons|@radix-ui/react-icons)" --type tsx`. Critical: alternate icon library.
12. **States** -- empty-state and error-state coverage. Manual review only; check that data-fetching components handle loading/empty/error.
13. **Charts** -- non-token chart colors. rg: `rg "stroke=|fill=" client/src/components/charts --type tsx | rg "#[0-9a-fA-F]"`. Warning: hardcoded chart hex (should reference `var(--chart-N)` or curve coloring system).
14. **Dark mode** -- presence of `.dark` variant utilities without dark token coverage. rg: `rg "dark:" --type tsx`. Warning if extensive `dark:` use without a dark palette in `globals.css`.

Output format template (for the agent's audit report):

```
## Audit Report: [Project Name]

### Summary
- Critical: N findings
- Warning: N findings
- Suggestion: N findings

### Findings by Category

#### 1. Tokens (color)
| # | Severity | File | Line | Current | Expected |
|---|----------|------|------|---------|----------|
| 1.1 | Critical | src/foo.tsx | 42 | `bg-[#1d1d1f]` | `bg-primary` |
...
```

### `REFACTOR.md` (new)

Refactor playbook with before/after recipes per category. For each: ordering rule, common drift patterns, exact swap recipes.

Sections:

1. **Ordering rule** -- always refactor in this order: (1) install/align Tailwind v4 + theme.css + globals.css, (2) align color tokens, (3) align typography, (4) replace hand-rolled components with shadcn primitives, (5) align layout patterns, (6) align states, (7) align motion + focus + accessibility. Each layer depends on the previous.
2. **Token swaps** -- table of common drift patterns:
  - `bg-white` -> `bg-background` or `bg-card`
  - `text-black` / `text-gray-900` -> `text-foreground`
  - `text-gray-500` / `text-gray-600` -> `text-muted-foreground`
  - `border-gray-200` / `border-gray-300` -> `border-border` (or `border` after Tailwind defaults are aligned)
  - `bg-gray-100` -> `bg-muted` or `bg-secondary`
  - `bg-red-500` / `bg-rose-500` (action) -> `bg-destructive`
  - hardcoded hex -> nearest semantic token (cite DESIGN.md frontmatter)
3. **Typography migration** -- map common ad-hoc class strings to semantic roles from DESIGN.md
4. **Component migration** -- replace hand-rolled `<button>`/`<input>`/`<dialog>` with shadcn primitives; keep behavior identical, port className intentions to variant + size props
5. **Layout migration** -- if existing app has expanding sidebar, decide with user whether to convert to fixed 64px icon-only or keep current (this is a meaningful UX choice; don't auto-apply)
6. **State migration** -- ensure loading uses `Skeleton` or `LoadingSpinner`, errors use `text-destructive`, toasts use sonner
7. **Motion migration** -- replace arbitrary `duration-[Nms]` with `transition-smooth` or token-aligned utilities
8. **Accessibility migration** -- add `aria-label` to icon-only buttons, replace `outline-none` with `focus-visible:ring-2 ring-ring ring-offset-2`, add `aria-invalid` patterns
9. **Dark mode migration** -- if user wants dark, copy the Proposed `:root.dark { ... }` block from theme.css into target's `globals.css` and audit `dark:` usage
10. **What NOT to refactor** -- domain-specific logic, business rules, data layer, API shapes, anything outside the design surface

Each recipe includes: rg pattern to find, before snippet, after snippet, "verify" check (e.g. "the rendered visual output is unchanged in a snapshot test"). The agent runs the rg, applies the swap, presents the diff for review.

### `tailwind.config.js` (delete)

### `docs/decisions/log.md` (append)

New entry recording: (a) `.cursor/skills/design-guidelines/` converted to invokable `audit-and-align-ui` skill; (b) current `client/` formally designated as the canonical Multimatic Workbench template; (c) `.text-caption`/`.text-label` removal scheduled as a follow-up task; (d) Proposed dark palette captured in DESIGN.md and theme.css but not yet wired into `globals.css`.

## Verification (before finishing)

- `SKILL.md` is under 500 lines; description includes both WHAT and WHEN with trigger terms; written in third person
- All reference files (`DESIGN.md`, `AUDIT.md`, `REFACTOR.md`, `theme.css`, `design_tokens.json`) are one level deep from `SKILL.md`
- `rg "Atmospheric Glass|surface-container|on-surface|tertiary-container" .cursor/skills/design-guidelines/` returns zero matches
- All color hex values in `DESIGN.md` frontmatter and `design_tokens.json` exist verbatim in [client/src/app/globals.css](client/src/app/globals.css) `:root` (or are flagged as `dark` Proposed)
- `theme.css` parses as valid CSS; `@theme inline` and `:root` blocks are byte-identical to `globals.css` except for the documented omissions
- `README.md` file table lists exactly the seven artifacts in the folder (SKILL.md, README.md, DESIGN.md, theme.css, design_tokens.json, AUDIT.md, REFACTOR.md)

