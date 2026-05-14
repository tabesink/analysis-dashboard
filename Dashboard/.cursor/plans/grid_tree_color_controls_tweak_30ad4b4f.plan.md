---
name: Grid tree color controls tweak
overview: Update [`HierarchicalEventTree.tsx`](Dashboard/client/src/components/dashboard/shared/HierarchicalEventTree.tsx) so program rows show only the reset control in the former color-patch slot (no program ColorPicker), and version rows keep the ColorPicker but drop the reset button beside it. Only the grid side panel uses `showColorSwatches` ([`PartitionSection.tsx`](Dashboard/client/src/components/dashboard/side-panel/PartitionSection.tsx)).
todos:
  - id: program-row-ui
    content: "HierarchicalEventTree: remove program ColorPicker; keep reset only in that slot; adjust showColorSwatches gate"
    status: completed
  - id: version-row-ui
    content: "HierarchicalEventTree: remove version reset button; keep version ColorPicker"
    status: completed
  - id: verify-types
    content: Run tsc / lint on touched file
    status: completed
isProject: false
---

# Grid side panel: program reset / version color only

## Current behavior (to change)

In `[HierarchicalEventTree.tsx](Dashboard/client/src/components/dashboard/shared/HierarchicalEventTree.tsx)`:

- **Program row** (~396–423): When `showColorSwatches` and program color callbacks exist, renders `[optional ResetCw] [ColorPicker]` in a `shrink-0` group after the status badge.
- **Version row** (~467–495): Renders `[optional reset button] [ColorPicker]`.

## Target behavior

1. **Program row**
  - Remove the **program** `[ColorPicker](Dashboard/client/src/components/dashboard/shared/HierarchicalEventTree.tsx)` entirely.  
  - Keep **only** the reset control (`Button` + `RefreshCw`), in the **same right-side slot** (after status badge, before any trailing gap—i.e. where the color patch was).  
  - Show reset **only when** `isProgramColorCustomized?.(program.programId)` and `onProgramColorReset` are available (same as today); when not customized, that slot is empty (no placeholder).
2. **Version row**
  - Keep the **version** `ColorPicker` inline on the right.  
  - Remove the **reset** `<button>` block (~472–486) entirely.
3. **Gate condition for program block**
  - Today: `showColorSwatches && getProgramColor && onProgramColorChange`.  
  - After: require `showColorSwatches && onProgramColorReset` (and only render the reset when customized). `getProgramColor` / `onProgramColorChange` are no longer required for this row’s UI; **props stay on the component** for API stability and in case other call sites need them later—only the program-row branch stops rendering the picker.

## Tradeoff (call out to you)

With no program-row `ColorPicker`, **program-level colors can no longer be chosen from the program row**—only **version-level** swatches remain for picking. Resetting a program override still works from the program row when a custom program color exists.

## Files

- **Edit**: `[Dashboard/client/src/components/dashboard/shared/HierarchicalEventTree.tsx](Dashboard/client/src/components/dashboard/shared/HierarchicalEventTree.tsx)` (program + version blocks only).  
- **No changes** expected to `[PartitionSection.tsx](Dashboard/client/src/components/dashboard/side-panel/PartitionSection.tsx)` unless you want to stop passing unused program color setters (optional cleanup, not required).

## Verification

- Grid tab: Historical / New Data trees—program row shows badge + reset (when customized), **no** program color dot.  
- Version row: color dot only, **no** reset icon left of it.  
- `npx tsc --noEmit` in `client/`.

