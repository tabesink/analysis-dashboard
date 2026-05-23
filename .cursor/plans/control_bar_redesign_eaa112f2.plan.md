---
name: control bar redesign
overview: Restyle the current dashboard `GridActionToolbar` to match the light translucent reference control bar while preserving the current app’s controls, icons, disabled/active behavior, tooltips, dragging, docking, keyboard movement, and persisted position.
todos:
  - id: restyle-toolbar-shell
    content: Restyle the `GridActionToolbar` root from dark floating panel to the reference light translucent rounded vertical shell.
    status: completed
  - id: restyle-buttons
    content: Update `ToolbarIconButton` classes to match reference ghost icon buttons while preserving labels, tooltips, disabled, and active behavior.
    status: completed
  - id: preserve-drag
    content: Keep and lightly restyle drag/dock/localStorage/keyboard behavior as a bottom control in the continuous stack.
    status: completed
  - id: verify-ui
    content: Check lints and perform a visual/behavioral smoke pass against the two provided screenshots.
    status: completed
isProject: false
---

# Control Bar Redesign Plan

## Target Outcome

Replace the current black floating toolbar styling in [`Dashboard/client/src/components/dashboard/shared/GridActionToolbar.tsx`](Dashboard/client/src/components/dashboard/shared/GridActionToolbar.tsx) with the reference control bar visual language from [`Dashboard/docs/brainstorm/08_control_bar/reference/src/features/graph/GraphViewer.tsx`](Dashboard/docs/brainstorm/08_control_bar/reference/src/features/graph/GraphViewer.tsx) and [`Dashboard/docs/brainstorm/08_control_bar/reference/src/components/graph/LayoutsControl.tsx`](Dashboard/docs/brainstorm/08_control_bar/reference/src/components/graph/LayoutsControl.tsx).

The new bar should keep the existing dashboard functions and app-specific icons, with the pinned-view control updated to the provided pin glyph:

- Return to grid: `Undo2`
- Toggle pinned view: replace `Flag` with the Lucide `Pin` icon matching the provided SVG path
- Export plots: `Download` currently disabled by caller
- Render / stop render: `Play` / `Square`
- Clear plots / reset visibility: `X`
- Drag handle: existing six-dot grip behavior, restyled for the light shell

## Implementation Shape

Use the reference shell style as the base:

```tsx
<div className="bg-background/60 flex flex-col rounded-xl border-2 backdrop-blur-lg">
```

Apply that visual language to the existing draggable root while preserving its positioning state:

- Keep `toolbarRef`, `position`, `dockedCorner`, pointer drag handlers, resize handling, `localStorage`, and arrow-key movement in `GridActionToolbar`.
- Change the root from dark `bg-zinc-800/90`, `border-zinc-700/90`, fixed `h-[16rem]`, `shadow-xl`, and dark text to a light translucent `bg-background/60`, `rounded-xl`, `border-2`, `backdrop-blur-lg` stack.
- Remove the visible separator bars and dark grouped spacing so the result is a continuous vertical control, like the reference image.
- Restyle `ToolbarIconButton` to rely on the app’s `Button` ghost/icon-sm design instead of dark custom classes, while preserving `aria-label`, `title`, disabled state, active state, tooltip content, and click handlers.
- Import/use `Pin` from `lucide-react` for the pinned-view button; its path matches the requested SVG (`M12 17v5`, body pin shape).
- Add a subtle active state for pinned mode/rendering that fits the reference style, likely `bg-accent text-accent-foreground` or the local equivalent already used by shadcn buttons.
- Restyle the drag handle as a compact bottom control inside the same continuous stack, using muted foreground color and hover state consistent with the light toolbar.

## Verification

After implementation, verify:

- Existing toolbar actions still call the same handlers from [`Dashboard/client/src/components/dashboard/DashboardContent.tsx`](Dashboard/client/src/components/dashboard/DashboardContent.tsx): render/stop, clear, return to grid, toggle pinned mode, and export placeholder.
- Dragging, corner docking, keyboard arrow movement, resize clamping, and persisted position still work.
- The toolbar visually matches [`Dashboard/controlbar.png`](Dashboard/controlbar.png): translucent light vertical shell, rounded outer border, compact icon buttons, no dark dividers.
- The current app-specific button count and icons remain aligned with [`Dashboard/currcontrolbar.png`](Dashboard/currcontrolbar.png).
- Run targeted frontend checks for the edited file, at minimum TypeScript/lint diagnostics via Cursor lints; run the project’s relevant client check if available and quick.