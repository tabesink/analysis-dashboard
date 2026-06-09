# FALLOW-14: Add global-filters utils test coverage

**Type:** AFK  
**Effort:** Low  
**Fallow category:** Untested risk (Fallow health)  
**Fallow evidence:** Efficiency 7.2 — complex functions lack test coverage path

## What to build

`src/components/dashboard/side-panel/global-filters/utils.ts` contains complex logic that Fallow flags as **untested risk** before modification:

- `buildCountsByField` — cyclomatic 10, cognitive 24, CRAP 110
- `buildActiveFilterChips` — cyclomatic 7, cognitive 9, CRAP 56

Add behavior tests (Vitest) covering:

- Empty filter state → empty chips / zero counts
- Single active filter → correct chip label and count
- Multiple filters across fields → correct aggregation
- Unknown or stale filter values → graceful handling

This is a safety net for FALLOW-09 and future filter refactors. Do not change production logic unless tests expose a bug.

## Acceptance criteria

- [ ] `src/components/dashboard/side-panel/global-filters/utils.test.ts` exists
- [ ] Tests cover `buildCountsByField` and `buildActiveFilterChips` happy paths and edge cases
- [ ] `npx fallow health --coverage-gaps` no longer flags these functions (or count decreases)
- [ ] All new and existing tests pass

## Blocked by

None — can start immediately

## Fallow finding reference

```
Refactoring target (efficiency 7.2):
  global-filters/utils.ts — 2 complex functions lack test coverage path,
  add tests before modifying
```
