# REF-12-19: Stale damage results banner on selection change

**Type:** AFK  
**Phase:** 5  
**Effort:** Low  
**Review reference:** M-04, ADR-ID-04

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

When the user changes `selected_event_ids` after a successful Calculate, the table may show events without damage cells (or mismatched cache). Add a non-blocking banner above the damage table:

- Visible when: there are selected events AND (`damageCacheKey` !== key for last successful result OR no result for current key)
- Copy: e.g. "Selection changed — click Calculate to update damage values"
- Dismissible optional — not required

Use `useDamageResults` helper or extend mutation hook from REF-12-14.

## Acceptance criteria

- [ ] Banner appears after toggling event selection without recalculating
- [ ] Banner hides after successful Calculate for current selection
- [ ] No banner when no events selected
- [ ] `npm run build` passes

## Blocked by

- REF-12-18

## Agent notes

- Small UX improvement — keep styling consistent with existing dashed border info panels on inspect-damage page
