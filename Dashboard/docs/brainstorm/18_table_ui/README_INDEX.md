# 18 — Table UI (Excel-like CRUD + Workbench Hierarchy)

Brainstorm package for reproducing the **canartdb-ui** table surfaces in other Next.js apps with matching visual parity.

| Document | Description |
|----------|-------------|
| [prd.md](./prd.md) | Scope, two table paradigms, and locked decisions |
| [AGENT_HANDOFF.md](./AGENT_HANDOFF.md) | Start-here instructions for coding agents |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | How navigation, data flow, and CRUD layers fit together |
| [VISUAL_SPEC.md](./VISUAL_SPEC.md) | Flex-based hierarchy/flat tables — classes, tokens, layout |
| [HANDSONTABLE_GUIDE.md](./HANDSONTABLE_GUIDE.md) | Excel-like spreadsheet editor — setup, CRUD, validation |
| [STEP_BY_STEP.md](./STEP_BY_STEP.md) | Port checklist for a greenfield or existing app |
| [REFERENCE_FILES.md](./REFERENCE_FILES.md) | Index of every file in `reference/` and why it matters |
| [reference/canartdb-ui/](./reference/canartdb-ui/) | Local copies of canartdb-ui table sources |
| [reference/database-table-skill/](./reference/database-table-skill/) | Flex-table design spec + templates from `.cursor/skills/database-table` |

## What this package covers

The reference app ([`.references/canartdb-ui`](../../../.references/canartdb-ui)) implements **two complementary table UIs**:

1. **Workbench flex tables** — custom flex rows (not `<table>`), sticky header, column resize, sort/filter, batch select, hierarchical expand/collapse. Used for certificate lists and page→table navigation.
2. **Handsontable spreadsheet editors** — Excel-like in-cell editing with row context-menu CRUD. Used for test-result rows and failed-page CSV repair.

This package gives a junior dev or coding agent everything needed to port either (or both) paradigms into a different app while preserving look-and-feel.

## Quick start

1. Read [AGENT_HANDOFF.md](./AGENT_HANDOFF.md).
2. Decide which paradigm you need — see [ARCHITECTURE.md](./ARCHITECTURE.md) § "Pick your variant".
3. For flex tables: [VISUAL_SPEC.md](./VISUAL_SPEC.md) + `reference/database-table-skill/`.
4. For spreadsheet CRUD: [HANDSONTABLE_GUIDE.md](./HANDSONTABLE_GUIDE.md) + `reference/canartdb-ui/src/components/upload/TableResultsEditor.tsx`.
5. Follow [STEP_BY_STEP.md](./STEP_BY_STEP.md).
6. Refresh local copies after upstream changes: `bash docs/brainstorm/18_table_ui/scripts/refresh-references.sh`

## Reference source

Canonical reference codebase: [`.references/canartdb-ui`](../../../.references/canartdb-ui)

Flex-table design skill (shared visual language): [`.cursor/skills/database-table`](../../../.cursor/skills/database-table)
