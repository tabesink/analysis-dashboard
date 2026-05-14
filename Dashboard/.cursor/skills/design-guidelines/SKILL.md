---
name: audit-and-align-ui
description: Audits a Next.js + Tailwind v4 + shadcn + Radix codebase against the Multimatic Workbench design system (an Apple-inspired light minimal template captured from this repo's client/) and produces a file-by-file refactor plan to bring it into alignment, executed in the working tree only after explicit user approval. Use when the user wants to apply the Workbench design system to another app, audit UI for token or pattern drift, align colors typography spacing components or states with the canonical template, normalize an existing UI to the house style, or mentions "design guidelines", "audit UI", "apply Workbench design", "align design tokens", or "design system audit".
---

# Audit and Align UI

This skill captures the Multimatic Workbench design system (a Next.js + Tailwind v4 + shadcn light-minimal template) and gives the agent a structured workflow to audit a target codebase against it and refactor it into alignment.

The canonical template lives in this repo's `client/`. The `DESIGN.md`, `theme.css`, and `design_tokens.json` files in this folder are the portable artifacts derived from that template.

## Stack assumptions

The skill targets codebases that use:

- Next.js (App Router preferred)
- Tailwind CSS v4 with `@theme inline` in a global stylesheet (not a `tailwind.config.js`)
- shadcn primitives in `components/ui/` built on Radix
- lucide-react for icons
- Geist Sans + Geist Mono via `next/font/google`

If the target codebase does not match these assumptions, halt at the end of Phase 1 and report what is missing. Do not attempt to refactor a Vue, Svelte, plain-CSS, or Tailwind v3 codebase with this skill.

## Workflow

Follow these five phases in order. Track progress with a checklist:

```
- [ ] Phase 1: Discovery
- [ ] Phase 2: Audit
- [ ] Phase 3: Plan
- [ ] Phase 4: Approval
- [ ] Phase 5: Execute
```

### Phase 1: Discovery

Locate and confirm the stack entry points in the target codebase:

1. `app/layout.tsx` (or `src/app/layout.tsx`) -- root layout, font wiring
2. The global stylesheet (e.g. `app/globals.css`) -- must contain `@import "tailwindcss"` and `@theme inline { ... }`
3. `tailwind.config.*` -- should be **absent** for v4. If present, flag as a stack mismatch.
4. `components/ui/` -- shadcn primitives
5. `components/layout/` (or equivalent) -- sidebar, header, page chrome

Run a ripgrep sweep to confirm:

```bash
rg -l "@import \"tailwindcss\"" --type css
rg -l "from \"lucide-react\"" --type tsx
rg -l "from \"@radix-ui" --type tsx
```

If any of the stack assumptions fail, write a short blocker report and stop. Do **not** continue to Phase 2.

### Phase 2: Audit

Read [AUDIT.md](AUDIT.md) and walk every category top to bottom. For each finding, capture:

- File path and line range
- Category (one of the 13 in AUDIT.md)
- Severity: **Critical** / **Warning** / **Suggestion**
- Current value (the offending snippet)
- Expected value (cite the relevant token or pattern from [DESIGN.md](DESIGN.md))

Use the ripgrep recipes from AUDIT.md to enumerate drift quickly. Read the canonical token values from [DESIGN.md](DESIGN.md) frontmatter and [theme.css](theme.css) when checking conformance.

Produce the audit report using this template:

```markdown
## Audit Report: <project name>

### Summary
- Critical: N findings
- Warning: N findings
- Suggestion: N findings

### Findings by Category

#### 1. Tokens (color)
| #    | Severity | File         | Line | Current        | Expected        |
|------|----------|--------------|------|----------------|-----------------|
| 1.1  | Critical | src/foo.tsx  | 42   | `bg-[#1d1d1f]` | `bg-primary`    |
...
```

Do not propose fixes yet. Hand the report to Phase 3 as input.

### Phase 3: Plan

Read [REFACTOR.md](REFACTOR.md) and convert each finding into a concrete, actionable change.

Group the plan by category for reviewability. Order categories using the rule from REFACTOR.md (foundation first):

1. Theme setup (`theme.css` / `globals.css`)
2. Color tokens
3. Typography
4. Components (replace hand-rolled equivalents with shadcn primitives)
5. Layout patterns
6. States
7. Motion + focus + accessibility

For each plan item include:

- File path
- Before / after snippet (small diff sketch)
- Which audit finding it resolves (cite by `1.1`, `2.3`, etc.)
- A verify check (e.g. "no visual regression in this view", "axe reports no new violations")

### Phase 4: Approval

Present the audit report **and** the refactor plan to the user. Ask which findings to apply:

- All
- By category (e.g. "all of category 1, 2, 3")
- By severity (e.g. "all Critical, none of Warning/Suggestion")
- By individual finding number

Wait for explicit approval. Do not begin Phase 5 without it.

### Phase 5: Execute

Apply the approved changes file-by-file in the working tree. After each file:

- Show the diff
- Note which audit findings are now resolved

Do **not** auto-commit. Do **not** open a PR. Leave the working tree dirty for the user to review and commit themselves.

If a finding cannot be auto-resolved (ambiguous semantic intent, requires a UX decision, conflicts with a domain-specific override), surface it explicitly with the reason and ask the user to decide.

When done, print a final summary:

```
Refactor complete.
- Findings applied: N
- Findings deferred (need user input): N
- Files changed: N
```

## Reference files

Read these when their phase calls for them. Keep references one level deep:

- [DESIGN.md](DESIGN.md) -- canonical token + pattern spec for the Workbench design system. Read in Phase 2 (to know the expected values) and Phase 3 (to cite roles in plan items).
- [AUDIT.md](AUDIT.md) -- 13-category audit checklist with severity criteria and ripgrep recipes. Read in Phase 2.
- [REFACTOR.md](REFACTOR.md) -- ordered refactor playbook with before/after recipes per category. Read in Phase 3.
- [theme.css](theme.css) -- portable Tailwind v4 `@theme inline` + `:root` snippet. Copy or merge into the target's global stylesheet during Phase 5 (Theme setup step).
- [design_tokens.json](design_tokens.json) -- DTCG-format token export. Use only when the target needs interop with Figma, Style Dictionary, or another token pipeline. Skip otherwise.

## Anti-patterns

Do not:

- Refactor business logic, data fetching, API shapes, or anything outside the design surface.
- Auto-apply layout changes without asking. Switching from an expanding sidebar to the Workbench's fixed 64px icon-only sidebar is a meaningful UX choice; surface it in Phase 4 explicitly.
- Mix shadcn variant overrides via `className` in ways that fight the variant. Prefer choosing the right variant + size props.
- Introduce glassmorphism, dark vibrant gradients, or non-Geist fonts. The Workbench is intentionally restrained.
- Skip Phase 4. The user must approve before any file is edited.
