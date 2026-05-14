---
name: Redesign DB Operation Modal
overview: Redesign the DatabaseOperationModal progress view from stacked progress bars into a monochromatic vertical stepper with in-phase detail (current table, table count, live timer), leveraging data the server already provides but the UI currently ignores.
todos:
  - id: stepper-component
    content: Create PhaseStep and StepperTimeline components replacing PhaseProgressRow with vertical timeline layout, in-phase detail (current table, table count, progress bar), and per-phase duration tracking
    status: completed
  - id: elapsed-timer
    content: Add live elapsed timer in modal header using useEffect interval, plus phase-transition timing via useRef
    status: completed
  - id: progress-renderers
    content: Rewrite renderExportProgress() and renderImportProgress() to use the new stepper, passing current_table/current/total/events_loaded into active steps
    status: completed
  - id: monochromatic-styling
    content: Remove green/amber color usage from progress and summary views; use foreground/muted-foreground opacity levels; add pulse keyframe to globals.css
    status: completed
  - id: summary-refinements
    content: Enhance summary screen with per-phase duration breakdown and events_loaded count display
    status: completed
isProject: false
---

# Redesign Database Operation Modal UX

## Problem

During export/import, users see only phase-level progress bars with percentages. The server already sends `current_table`, `current`/`total` (table-level counts), and `events_loaded` -- but none of this is shown. On large databases, users wait blindly for minutes with no indication of what's happening inside a phase.

## Design Direction: Monochromatic Vertical Stepper

Replace the stacked `PhaseProgressRow` bars with a **vertical timeline/stepper** pattern. Each phase becomes a "step" that expands when active and collapses when done:

```
Database Export                         0:34
Saving to Downloads as dashboard_export.zip
─────────────────────────────────────────────

  [done]  Export tables                  12s
          7 of 7 tables

  [active] Compress archive
           Creating ZIP archive...
           ───────── (indeterminate bar)

  [pending] Download
```

Key visual rules (monochromatic, matching Apple theme from `globals.css`):

- **Done step**: foreground-colored filled circle + label at full opacity + duration shown right-aligned (e.g. "12s")
- **Active step**: foreground-colored pulsing dot + label at full opacity + expanded detail area below
- **Pending step**: muted-foreground ring/circle + label at reduced opacity (50%)
- **No green/amber/red** in the progress view -- purely foreground vs muted-foreground
- A single slim `Progress` bar only in the expanded active step
- Connecting vertical line between steps uses `border` color

### In-Phase Detail (the main improvement)

When a phase is active, show beneath its label:

- **Current table name** from `taskStatus.current_table` (e.g. "dim_event")
- **Table count** from `taskStatus.current` / `taskStatus.total` (e.g. "3 of 7 tables")
- **Progress bar** with percentage
- For indeterminate phases (compress, extract): just the status message + indeterminate bar

### Live Elapsed Timer

- Add a live-updating elapsed timer in the modal header (top-right of title area)
- Uses a `useEffect` + `setInterval` that ticks every second when `wizardStep === 'progress'`
- Displays as `formatElapsed(seconds)` in `text-muted-foreground tabular-nums` style

### Per-Phase Duration Tracking

- Track when each phase starts/completes by watching `taskStatus.phase` transitions
- Show completed duration right-aligned on done steps (e.g. "12s")
- Stored as a `Record<string, { startedAt: number; completedAt?: number }>` via `useRef`

## Files to Change

### 1. `[Dashboard/client/src/components/upload/DatabaseOperationModal.tsx](Dashboard/client/src/components/upload/DatabaseOperationModal.tsx)`

Main changes:

- Replace `PhaseProgressRow` with a new `PhaseStep` component that renders the vertical stepper item
- New `StepperTimeline` wrapper that adds the connecting vertical line
- `renderExportProgress()` and `renderImportProgress()`: pass `taskStatus.current_table`, `taskStatus.current`, `taskStatus.total` into the active step for in-phase detail
- Add elapsed timer state (`elapsedSeconds` via `useEffect` interval), display in header
- Add phase timing tracking via `useRef` watching `taskStatus.phase` changes
- Remove all `text-green-600` / `text-green-500` color references from progress view (keep them only in summary if desired, or go fully monochromatic there too)
- Summary screen: optionally show per-phase duration breakdown

### 2. `[Dashboard/client/src/app/globals.css](Dashboard/client/src/app/globals.css)`

- Add a subtle `@keyframes` for the active step pulsing dot animation (a gentle opacity pulse on foreground color)

### 3. No server changes needed

`TaskStatusResponse` already provides `current_table`, `current`, `total`, `events_loaded`, and `progress`. All data is there -- it's purely a frontend display problem.

## Visual Mockup of the Active Phase Detail

When "Export tables" is active and processing the 3rd of 7 tables:

```
  [active] Export tables                 48%
           dim_event  --  3 of 7 tables
           ████████████░░░░░░░░░░░░░░░░
```

When "Import tables" is active and 15,231 events have been loaded:

```
  [active] Import tables                 62%
           measurements_lttb  --  5 of 7 tables
           ████████████████░░░░░░░░░░░░
           15,231 events loaded
```

## Summary Screen Refinements

- Keep the success/fail icon but use monochromatic variant (foreground circle-check instead of green)
- Add a small duration breakdown section showing each phase's time
- Display `events_loaded` count when available (import)

## What Stays the Same

- The confirm step (import) -- no changes needed, it already works well
- The modal shell (`AlertDialog` wrapper, footer buttons, open/close logic)
- The `DatabaseOperationModalProps` interface (no new props needed -- all data comes from existing `taskStatus`)
- All server-side code

