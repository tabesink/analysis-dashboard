---
name: version-status-inline-icons
overview: Remove the program-row status badge from `HierarchicalEventTree` (used by both the Load Data and Interactive viewer side panels) and replace it with a tiny neutral lucide icon next to each version name when the version's status is Pending or Obsolete. The database table page is untouched and keeps its full status pills.
todos:
  - id: edit_tree
    content: "Edit HierarchicalEventTree.tsx: add AlertCircle/History imports; remove programStatusForBadge helper; remove program-row badge span and its variable; insert inline version-status icon after the version name."
    status: completed
  - id: verify_visual
    content: Manually verify Load Data tab, Interactive viewer tab, and Database page render correctly per the verification checklist.
    status: completed
  - id: lint
    content: Run npm run lint in client/ and fix any unused-import or related warnings introduced by the deletion.
    status: completed
  - id: decision_log
    content: Append a one-line entry to docs/decisions/log.md per AGENTS.md mandatory after-work rule.
    status: completed
isProject: false
---

## Decisions (confirmed)

- **Status source per version**: a version always has a uniform status, so use `vg.events[0].status`. No aggregation logic.
- **Program rows**: badge removed entirely, no replacement indicator.
- **Icons** (lucide): Pending = `AlertCircle`, Obsolete = `History`. Approved = no icon.
- **Color**: neutral `text-muted-foreground` (no tint), with hover tooltip via the `title` attribute (matches existing convention in the file, e.g. line 407).
- **Scope**: changes apply wherever `HierarchicalEventTree` renders without `showStatusBadge` — i.e. both `LoadDataSection` and `CurveSelector`. The database page (`app/database/page.tsx`) does not use this tree, so it stays exactly as-is.

## Single file edited

[client/src/components/dashboard/shared/HierarchicalEventTree.tsx](client/src/components/dashboard/shared/HierarchicalEventTree.tsx)

### 1. Imports (line 4)

Add `AlertCircle, History` to the lucide import; everything else stays. `getStatusBadgeClassName` (line 15) stays — still used by the per-event leaf badge when `showStatusBadge=true`.

### 2. Remove `programStatusForBadge` (lines 86-108)

Delete the helper entirely — no longer needed.

### 3. Remove program-row badge (lines 387-394)

Delete this block from the program row:

```387:394:client/src/components/dashboard/shared/HierarchicalEventTree.tsx
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0',
                      programBadge.className,
                    )}
                  >
                    {programBadge.label}
                  </span>
```

Also remove the `const programBadge = programStatusForBadge(program);` line (353) that feeds it.

### 4. Add inline version-status icon (right after line 455)

In the version row, immediately after the `<span>{vg.version}</span>` (lines 450-455), insert a small inline icon. Status is read off the first event of the version:

```tsx
{(() => {
  const status = vg.events[0]?.status;
  if (status === 'Pending') {
    return (
      <AlertCircle
        className="size-3 text-muted-foreground shrink-0"
        aria-label="Pending"
      >
        <title>Pending</title>
      </AlertCircle>
    );
  }
  if (status === 'Obsolete') {
    return (
      <History
        className="size-3 text-muted-foreground shrink-0"
        aria-label="Obsolete"
      >
        <title>Obsolete</title>
      </History>
    );
  }
  return null;
})()}
```

(Uses an inline SVG `<title>` child for the native hover tooltip — works on lucide icons since they render `<svg>`.)

### 5. Per-event leaf badge — leave untouched

The block at lines 503-512 (`{showStatusBadge && (...)}`) stays as-is. Both `LoadDataSection` and `CurveSelector` already pass `showStatusBadge=false` (default), so nothing leaks into the side panels. The database table page does not use this tree.

## What does NOT change

- [client/src/components/dashboard/side-panel/LoadDataSection.tsx](client/src/components/dashboard/side-panel/LoadDataSection.tsx) — no edits needed.
- [client/src/components/dashboard/interactive-viewer/CurveSelector.tsx](client/src/components/dashboard/interactive-viewer/CurveSelector.tsx) — no edits needed.
- [client/src/app/database/page.tsx](client/src/app/database/page.tsx) — untouched; status pills in the database table behave exactly as before.
- [client/src/lib/status-badge.ts](client/src/lib/status-badge.ts) — kept (still used by the database table and the per-event leaf rendering path).

## Verification (loop until all pass)

1. **Load Data tab**: open the dashboard, expand a program. Program-row badge is gone. Version rows whose status is Pending show an `AlertCircle` immediately right of the version label; Obsolete versions show a `History` icon; Approved versions show nothing. Hover an icon → native tooltip says "Pending" or "Obsolete".
2. **Interactive viewer tab**: same behavior in the `CurveSelector` tree.
3. **Database page** (`/database`): per-row status pills unchanged, full pill colors (green/amber/red).
4. **Lint/build**: `cd client && npm run lint` passes. No unused imports left over (`programStatusForBadge` and any leftover refs gone).
5. **Mandatory after-work** per `AGENTS.md`: append a one-line entry to [docs/decisions/log.md](docs/decisions/log.md) noting the UX change ("dashboard side-panel program badges replaced with inline version-row Pending/Obsolete icons; database table unaffected").

