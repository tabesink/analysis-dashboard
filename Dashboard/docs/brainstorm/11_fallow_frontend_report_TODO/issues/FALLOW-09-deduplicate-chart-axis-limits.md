# FALLOW-09: Deduplicate chart axis limit calculation

**Type:** AFK  
**Effort:** Medium  
**Fallow category:** Duplication + complexity  
**Fallow evidence:** 35-line clone; cognitive complexity 38 in two functions

## What to build

Axis limit calculation is duplicated:

- `src/components/dashboard/plot-grid/PlotGrid.tsx` — `calculateRawAxisLimits` (cognitive 38, CRAP 240)
- `src/lib/chart-utils/scales.ts` — `calculateAxisLimits` (cognitive 38, CRAP 240)

Fallow clone group 17 flags 35 duplicated lines between these files.

Consolidate into a single canonical implementation in `src/lib/chart-utils/scales.ts`. `PlotGrid` should import and use it (with any plot-grid-specific adapter if needed). Break the consolidated function into smaller helpers to bring cognitive complexity below 15.

## Acceptance criteria

- [ ] One canonical axis-limits implementation in chart-utils
- [ ] `PlotGrid` no longer contains a parallel `calculateRawAxisLimits` implementation
- [ ] Clone group 17 eliminated
- [ ] Cyclomatic/cognitive complexity of the consolidated function is below Fallow thresholds (cognitive ≤ 15)
- [ ] Plot grid renders correct axis ranges for single-curve and multi-curve groups
- [ ] Interactive viewer and SVG plot cards unaffected
- [ ] `npm run build` and tests pass

## Blocked by

None — can start immediately

## Fallow finding reference

```
Clone group 17: 35 lines — PlotGrid.tsx ↔ scales.ts
Refactoring targets:
- PlotGrid.tsx: Extract calculateRawAxisLimits (cognitive: 38)
- scales.ts: Extract calculateAxisLimits (cognitive: 38)
```
