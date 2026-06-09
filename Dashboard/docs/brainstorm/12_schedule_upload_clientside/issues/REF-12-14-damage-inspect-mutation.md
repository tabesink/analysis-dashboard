# REF-12-14: Extract use-damage-inspect-mutation + fix cache policy

**Type:** AFK  
**Phase:** 4  
**Effort:** Medium  
**Review reference:** H-02, M-04

## Parent

[refactor-plan.md](../refactor-plan.md)

## What to build

Extract damage calculate flow from `inspect-damage/page.tsx` into `useDamageInspectMutation` hook under `features/inspect-damage/hooks/`.

**Fix cache policy** (behavior improvement allowed here):
- Remove `clearCachedDamageResults()` on every success — only store result for current `damageCacheKey`
- Keep LRU eviction at max 10 entries
- Optionally expose `isStale` when `selectedEventIds` changed since last successful calculate key

Page wires hook; toast messages unchanged.

## Acceptance criteria

- [ ] `use-damage-inspect-mutation.ts` encapsulates `damageApi.inspect` mutation
- [ ] Successful calculate does not wipe unrelated cache entries
- [ ] Toast copy unchanged
- [ ] `inspect-damage-results-store.test.ts` updated for new cache policy
- [ ] `npm test` passes

## Blocked by

- REF-12-13 (damage channel keys should come from contract before large inspect-damage moves — soft blocker; can proceed if REF-12-13 delayed and keys untouched)

## Agent notes

- If REF-12-13 blocked, proceed with extraction only and defer cache fix to same PR if trivial
