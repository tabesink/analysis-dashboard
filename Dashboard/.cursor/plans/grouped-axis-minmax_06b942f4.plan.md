---
name: grouped-axis-minmax
overview: Locate and update axis domain calculation so BJ and Shock plots share grouped min/max, while all Bushing plots use their own separate grouped min/max. Keep Interactive Viewer unchanged (local scaling).
todos:
  - id: map-plotkey-to-group
    content: Define BJ/Shock vs Bushing grouping from plot keys
    status: completed
  - id: compute-group-axis-limits
    content: Replace global-all axis merge with group-level merged axis limits
    status: completed
  - id: wire-group-limits-to-cards
    content: Pass group axis limits to synced SVG plot cards
    status: completed
  - id: verify-grid-and-viewer-behavior
    content: Check grouped sync in grid and unchanged local Interactive Viewer
    status: completed
  - id: update-project-docs
    content: Update build plan, decisions log, and task notes per AGENTS.md
    status: completed
isProject: false
---

# Grouped Axis Min/Max For Plot Grid

## Goal

Change dashboard grid axis syncing so it no longer computes one global min/max across all plots. Instead:

- BJ + Shock plots share one grouped axis envelope.
- Bushing plots share a separate grouped axis envelope.
- Interactive Viewer keeps current local min/max behavior.

## Current Axis Flow (to change)

- Local plot limits are computed in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/dashboard/plot-grid/PlotGrid.tsx`] using `calculateAxisLimits(curves)`.
- Cross-plot synced limits are currently merged globally in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/dashboard/plot-grid/PlotGrid.tsx`] (`globalAxisLimits`).
- The selected limits are applied in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/charts/SVGPlotCard.tsx`] (`synced ? globalAxisLimits : localAxisLimits`).

## Implementation Plan

1. Add plot-key grouping utility in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/dashboard/plot-grid/PlotGrid.tsx`] (or a small colocated helper) to classify each `plotKey` into:
  - `bjShockGroup`
  - `bushingGroup`
2. Replace single `globalAxisLimits` computation with group-level aggregation:
  - Build `groupAxisLimits` map: group -> merged min/max from plots in that group.
  - Keep existing per-plot `localAxisLimits` untouched.
3. Update card wiring in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/charts/SVGPlotCard.tsx`] usage path so synced cards receive their group’s limits instead of one global limits object.
4. Keep Interactive Viewer unchanged in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/dashboard/interactive-viewer/InteractiveViewer.tsx`] and [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/client/src/components/charts/InteractiveCanvasPlot.tsx`] (still local calculation).
5. Validate behavior manually:
  - With sync enabled, BJ/Shock cards share common range with each other.
  - Bushing cards share their own common range.
  - BJ/Shock and Bushing ranges differ when data ranges differ.
  - Interactive Viewer remains locally scaled.

## Docs/Process Updates Required After Code Change

- Update task status in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/master-build-plan.md`].
- Append decision note in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md`] (grouped sync replaces global-all sync).
- Add task note in [`/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/tasks/`] for the task ID you’re tracking.

