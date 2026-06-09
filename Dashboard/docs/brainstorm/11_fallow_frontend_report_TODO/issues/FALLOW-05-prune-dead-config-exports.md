# FALLOW-05: Prune dead config module exports

**Type:** AFK  
**Effort:** Low  
**Fallow category:** Dead code — unused exports  
**Fallow evidence:** 63–86% dead exports in config modules

## What to build

Remove or inline exported constants and helpers from config modules that nothing imports. Fallow flagged these as high dead-code ratio:

**`src/config/filters.ts`** (86% dead):
- `FILTER_COLUMNS`, `FILTER_DISPLAY_NAMES`, `COLUMN_TO_DISPLAY_NAME`, `DISPLAY_NAME_TO_COLUMN`, `getFilterValues`, `isValidFilterValue`

**`src/config/settings.ts`** (63% dead):
- `PLOT_WIDTH`, `PLOT_HEIGHT`, `DEFAULT_PLOT_KEYS`, `getPlotConfig`, `DEFAULT_BASELINE_OPACITY`, `NEW_DATA_OPACITY`, `GRID_COLUMN_OPTIONS`, `MAX_DISTINCT_GROUPS`, `SESSION_SAVE_DEBOUNCE`, `FILTER_DEBOUNCE`

**`src/config/version.ts`** (67% dead):
- `CLIENT_VERSION`, `getClientVersion`, `parseVersion`, `compareVersions`

**`src/config/dashboard-config.ts`** (50% dead):
- `getDashboardTabs`

Keep exports that are referenced. If an export is only used by a code generator script (`scripts/generate-*.js`), add a `fallow-ignore` comment with justification rather than deleting.

## Acceptance criteria

- [ ] Dead exports removed from the four config modules (or justified with suppression)
- [ ] `npx fallow` no longer lists these symbols under unused exports
- [ ] Filter/settings generation scripts still work if they depend on these modules
- [ ] `npm run build` and tests pass

## Blocked by

None — can start immediately

## Fallow finding reference

```
src/config/filters.ts   — 6 unused exports (86% dead)
src/config/settings.ts  — 10 unused exports (63% dead)
src/config/version.ts   — 4 unused exports (67% dead)
src/config/dashboard-config.ts — getDashboardTabs (50% dead)
```
