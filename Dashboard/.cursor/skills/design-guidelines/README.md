# Multimatic Workbench Design System

An invokable Cursor skill that audits a Next.js + Tailwind v4 + shadcn + Radix codebase against the Workbench design system (Apple-inspired light minimalism on Geist + lucide-react) and aligns it through a structured plan executed in the working tree.

The system is templated from the canonical reference implementation in this repo's `client/`. Other codebases that adopt this skill are audited against the spec captured here, not against `client/` directly.

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Invokable entrypoint. Frontmatter (`name: audit-and-align-ui`, `description`) plus the five-phase workflow (Discovery, Audit, Plan, Approval, Execute). Read first. |
| `DESIGN.md` | Canonical spec. YAML frontmatter holds the design tokens (shadcn-named, mirroring the client's `globals.css` `:root`); markdown body covers brand, colors, typography roles, layout patterns, elevation, shape, motion, focus, accessibility minimums, iconography, states, charts, z-index, dark mode, form patterns. |
| `theme.css` | Portable Tailwind v4 reference: `@import "tailwindcss"`, `@theme inline { ... }`, `:root { ... }` (light) + `:root.dark { ... }` (Proposed), keyframes, and the custom utility layer. Drop into any compatible target's global stylesheet. |
| `design_tokens.json` | DTCG-format token export (color light + dark Proposed, radius, font, elevation, z-index, motion, icon size). For interop with Figma, Style Dictionary, and other token pipelines. |
| `AUDIT.md` | Audit checklist, 13 categories. Each with severity criteria (Critical / Warning / Suggestion) and ripgrep recipes for surfacing drift. Used in Phase 2. |
| `REFACTOR.md` | Refactor playbook. Per-category before/after recipes, common drift patterns, ordering rules. Used in Phase 3. |
| `README.md` | This file. Folder map. |

## Quick start

To invoke the skill on another codebase, ask the agent:

> "Audit my UI against the Workbench design system and propose a refactor plan."

The agent will read `SKILL.md`, follow the workflow, and ask for approval before changing any files.
