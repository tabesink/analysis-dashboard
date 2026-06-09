# REF-12-15: Extract DamageLoadDataPanel component

**Type:** AFK  
**Phase:** 4  
**Effort:** Low  
**Review reference:** H-02

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

Move `DamageLoadDataPanel` function component from `inspect-damage/page.tsx` to `features/inspect-damage/components/DamageLoadDataPanel.tsx`.

No logic changes — props interface stays the same.

## Acceptance criteria

- [ ] Component file created with same props type exported
- [ ] Page imports from feature module
- [ ] Collapsed side panel icon button behavior unchanged
- [ ] Calculate button disabled states unchanged
- [ ] `npm run build` passes

## Blocked by

None — can start immediately (parallel with Phase 1)

## Agent notes

- Good first inspect-damage issue for junior dev — mechanical extraction
