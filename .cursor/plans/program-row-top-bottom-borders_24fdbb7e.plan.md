---
name: program-row-top-bottom-borders
overview: Give every Program ID row a top and bottom border without any visual thickening at boundaries by using border-t border-b -mt-px on the program row, and dropping the outer wrapper's redundant border-t.
todos:
  - id: drop_wrapper_top_border
    content: Drop `border-t` from the outer tree wrapper in DatabaseEventTree.tsx (keep `border-b`)
    status: completed
  - id: program_row_borders
    content: Add `border-t border-b -mt-px` to the program row in DatabaseEventTree.tsx, keeping existing `border-b` behavior unified into this set
    status: completed
  - id: lint_check
    content: ReadLints on DatabaseEventTree.tsx and fix any introduced issues
    status: completed
isProject: false
---

## Scope

Single file: [Dashboard/client/src/components/upload/DatabaseEventTree.tsx](Dashboard/client/src/components/upload/DatabaseEventTree.tsx).

## Change 1 — outer tree wrapper: drop border-t

```tsx
// before
<div className="w-full border-t border-b">

// after
<div className="w-full border-b">
```

The first program row now owns the top edge on its own (Change 2). Keeping the wrapper's `border-b` preserves the end-of-table line the user added earlier.

## Change 2 — program row: add border-t border-b and -mt-px

```tsx
// before
<div className="flex items-center gap-2 py-2 px-3 border-b bg-muted/60 hover:bg-muted/70 transition-colors">

// after
<div className="flex items-center gap-2 py-2 px-3 border-t border-b -mt-px bg-muted/60 hover:bg-muted/70 transition-colors">
```

The `-mt-px` pulls each program row up by exactly 1px so its `border-t` sits directly on top of whatever horizontal line is above it (column header's `border-b`, a previous version/event row's `border-b`, or a previous collapsed program's `border-b`). Two 1px lines at the same y-coordinate with the same color render as a single 1px line, so there is no perceptible thickening at any boundary.

### Boundary-by-boundary verification

- First program row under the column header row: column header `border-b` + program `border-t` pulled up 1px = 1px.
- Program row following a version or event row (when previous program is expanded): previous row's `border-b` + program `border-t` pulled up 1px = 1px.
- Two collapsed programs in a row: previous program `border-b` + next program `border-t` pulled up 1px = 1px.
- Bottom of the last row: last row's `border-b` + wrapper `border-b` sit at the same y = 1px.

## Side effect

Content inside each program row (checkbox, chevron, program id text, count) shifts up by 1px relative to its original baseline. The 32-ish px row height makes this imperceptible.

## Out of scope

- No change to version rows, event rows, column header, tier backgrounds, or tree guide lines.
- No change to [page.tsx](Dashboard/client/src/app/database/page.tsx).

