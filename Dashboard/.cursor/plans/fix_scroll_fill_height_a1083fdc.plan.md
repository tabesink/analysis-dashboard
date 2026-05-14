---
name: Fix scroll fill height
overview: Fix the Load Data section and CurveSelector to expand and fill all remaining vertical space in the side panel, for both grid and interactive layouts.
todos:
  - id: fix-sidepanel
    content: Replace ScrollArea wrapper with flex container in SidePanel.tsx
    status: completed
  - id: fix-loaddatasection
    content: Add flex-1 min-h-0 className to SidePanelSection in LoadDataSection.tsx
    status: completed
  - id: fix-curveselector
    content: Remove fixed h-64, add flex-1 min-h-0 to SidePanelSection in CurveSelector.tsx
    status: completed
  - id: fix-tree
    content: Support flex-fill mode in HierarchicalEventTree.tsx ScrollArea
    status: completed
isProject: false
---

# Fix Load Data Section Fill Height

## Problem

The `HierarchicalEventTree` uses a fixed Tailwind height class (`h-36` default, `h-64` in CurveSelector) for its `ScrollArea`. The outer `SidePanel` wraps everything in a `ScrollArea`, which prevents children from participating in flex layout to fill remaining space. Result: the tree has a small fixed height instead of growing to the bottom of the panel.

## Root Cause

The flex chain from `SidePanelLayout` to the tree's `ScrollArea` is broken at 3 points:

1. `SidePanel.tsx` line 33-34: `ScrollArea` + non-flex `div` wrapper break the flex chain
2. `LoadDataSection.tsx` / `CurveSelector.tsx`: don't pass `flex-1 min-h-0` to their `SidePanelSection`
3. `HierarchicalEventTree.tsx` line 348: `ScrollArea` uses fixed `heightClass` instead of flexing

## Required Flex Chain

```
SidePanelLayout (flex-col h-full)
  -> inner div (flex-col h-full)
    -> SidePanel content (flex-1 min-h-0 flex-col)  <-- currently ScrollArea
      -> [GlobalFilters] (natural height)
      -> LoadDataSection (flex-1 min-h-0 flex-col)
        -> SidePanelSection (flex-1 flex-col)
          -> content div (flex-1 min-h-0)
            -> HierarchicalEventTree (flex-1 flex-col min-h-0)
              -> ScrollArea (flex-1)  <-- currently h-36
```

## Changes (4 files)

### 1. [SidePanel.tsx](client/src/components/dashboard/side-panel/SidePanel.tsx)

- Replace `<ScrollArea className="flex-1 min-h-0 w-full">` with a plain `<div>` using `flex-1 min-h-0 flex flex-col`
- Change inner `div` from `p-5 pb-4 space-y-4 overflow-hidden` to `p-5 pb-4 space-y-4 flex flex-col flex-1 min-h-0`

### 2. [LoadDataSection.tsx](client/src/components/dashboard/side-panel/LoadDataSection.tsx)

- Add `className="flex-1 min-h-0"` to the `SidePanelSection` wrapper

### 3. [CurveSelector.tsx](client/src/components/dashboard/interactive-viewer/CurveSelector.tsx)

- Remove `const SECTION_HEIGHT_CLASS = 'h-64'`
- Remove `heightClass: SECTION_HEIGHT_CLASS` from tree props
- Add `className="flex-1 min-h-0"` to the `SidePanelSection` wrapper

### 4. [HierarchicalEventTree.tsx](client/src/components/dashboard/shared/HierarchicalEventTree.tsx)

- Change root `<div>` to include `flex flex-col flex-1 min-h-0`
- Change `<ScrollArea className={heightClass}>` to `<ScrollArea className={heightClass ?? 'flex-1'}>` -- when no fixed height is specified, the scroll area grows to fill available space

