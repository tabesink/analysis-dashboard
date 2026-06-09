# FALLOW-03: Prune 100%-dead shadcn scaffold files

**Type:** AFK  
**Effort:** Low  
**Fallow category:** Dead code — refactoring targets  
**Fallow evidence:** Efficiency scores 23.7–12.1 on 100% dead UI files

## What to build

Confirm and remove shadcn UI scaffold files that are entirely unused. FALLOW-02 covers file deletion; this issue ensures no dangling imports or `components.json` entries remain for:

- `avatar.tsx` (efficiency 22.6)
- `button-group.tsx` (efficiency 23.7)
- `pagination.tsx` (efficiency 12.2)
- `sheet.tsx` (efficiency 12.1)

Also audit `components.json` (or shadcn config) and remove registry entries for deleted components so future `shadcn add` runs do not reintroduce them.

**Do not** prune partial dead exports from actively-used shadcn files (`sidebar.tsx`, `dropdown-menu.tsx`, `dialog.tsx`, etc.) — those are normal shadcn scaffold surface.

## Acceptance criteria

- [ ] The four 100%-dead shadcn files are gone (via FALLOW-02 or this issue)
- [ ] `components.json` / shadcn config has no stale entries for removed components
- [ ] `npx fallow health --targets` no longer lists `button-group.tsx`, `avatar.tsx`, `pagination.tsx`, or `sheet.tsx`
- [ ] `npm run build` and tests pass

## Blocked by

- FALLOW-02 (file deletion)

## Fallow finding reference

```
| 23.7 | dead code | button-group.tsx | Remove 4 unused exports (100% dead) |
| 22.6 | dead code | avatar.tsx       | Remove 3 unused exports (100% dead) |
| 12.2 | dead code | pagination.tsx   | Remove 7 unused exports (100% dead) |
| 12.1 | dead code | sheet.tsx        | Remove 8 unused exports (100% dead) |
```
