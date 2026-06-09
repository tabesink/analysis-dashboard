# FALLOW-01: Remove unused npm dependencies

**Type:** AFK  
**Effort:** Low  
**Fallow category:** Dependency hygiene  
**Fallow evidence:** 3 unused production dependencies

## What to build

Remove npm packages that Fallow reports as having zero import references anywhere in `client/src`. These were likely added for a form-validation pattern that was never implemented or was removed.

Packages to remove from `client/package.json`:

- `@hookform/resolvers`
- `react-hook-form`
- `zod`

After removal, regenerate the lockfile and confirm the client still builds and tests pass.

## Acceptance criteria

- [ ] `@hookform/resolvers`, `react-hook-form`, and `zod` are removed from `dependencies` or `devDependencies` in `client/package.json`
- [ ] `package-lock.json` is updated (no orphaned entries)
- [ ] `rg 'react-hook-form|@hookform/resolvers|from ["\']zod' client/src` returns no matches
- [ ] `npx fallow dead-code` reports 0 unused dependencies (down from 3)
- [ ] `npm run build` succeeds in `client/`
- [ ] Existing client tests pass

## Blocked by

None — can start immediately

## Fallow finding reference

```
### Unused dependencies (3)
- @hookform/resolvers
- react-hook-form
- zod
```
