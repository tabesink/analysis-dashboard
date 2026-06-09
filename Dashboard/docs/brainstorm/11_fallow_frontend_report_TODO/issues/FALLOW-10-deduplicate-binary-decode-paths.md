# FALLOW-10: Deduplicate binary decode worker/main-thread code

**Type:** AFK  
**Effort:** Medium  
**Fallow category:** Duplication — clone family 17  
**Fallow evidence:** 51 lines duplicated across 3 clone groups

## What to build

Binary plot decoding logic is duplicated between the main thread and the Web Worker:

- `src/lib/utils/binary-decoder.ts`
- `src/workers/binary-decode.worker.ts`

Fallow clone family 17 reports **3 groups / 51 lines** shared between these files (groups 27–29).

Extract shared pure decode functions into a module importable by both the worker and main thread (e.g. `src/lib/utils/binary-decode-core.ts`). The worker and `binary-decoder.ts` become thin wrappers handling message passing vs direct invocation.

Ensure the worker bundle still compiles (no Node-only or DOM-only imports in the shared core).

## Acceptance criteria

- [ ] Shared decode core module with zero worker/DOM-specific imports
- [ ] Clone groups 27, 28, 29 eliminated
- [ ] Sequential plot fetch and lazy plot fetch still decode binary responses correctly
- [ ] Worker path still used for large payloads (no regression to main-thread-only)
- [ ] `npm run build` and tests pass

## Blocked by

None — can start immediately

## Fallow finding reference

```
Clone family 17: 3 groups, 51 lines
- src/lib/utils/binary-decoder.ts ↔ src/workers/binary-decode.worker.ts
```
