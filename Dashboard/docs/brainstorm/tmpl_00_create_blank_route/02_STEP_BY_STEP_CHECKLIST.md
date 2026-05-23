# Step-by-Step Checklist — Create a Blank Route

Use this checklist in order. Replace every `{placeholder}` before committing.

Canonical copy source: [`Dashboard/client/src/app/inspect-damage/page.tsx`](../../client/src/app/inspect-damage/page.tsx).

---

## Step 0 — Decide inputs

Fill in these values before writing code:

| Placeholder | Example | Notes |
|-------------|---------|-------|
| `{routeSlug}` | `inspect-damage` | kebab-case; becomes URL `/{routeSlug}` |
| `{navTitle}` | `Inspect Damage` | Sidebar hover tooltip (`title` in config) |
| `{LucideIcon}` | `Calculator` | Import from `lucide-react` |
| `{PageComponent}` | `InspectDamagePage` | PascalCase export default function name |
| `{navPosition}` | after Dashboard | Where to insert in `navMain` array (order = visual order) |
| `{requirePermission}` | _(omit)_ | Optional: `write` or `admin` |
| `{disabledTooltip}` | _(omit)_ | Required when `{requirePermission}` is set |
| `{headerTitle}` | `undefined` | `undefined` = blank header; or a string like `"My Tool"` |

---

## Step 1 — Create the page file

**Path:** `Dashboard/client/src/app/{routeSlug}/page.tsx`

**Action:** Create the file using the template below (or copy [`inspect-damage/page.tsx`](../../client/src/app/inspect-damage/page.tsx) and rename).

- [ ] File created at `client/src/app/{routeSlug}/page.tsx`
- [ ] `{PageComponent}` replaced
- [ ] Auth guard kept (unless route is intentionally public)
- [ ] `'use client'` directive present (required for hooks)

### Copy-paste page template

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LoadingSpinner, SidePanelLayout } from '@/components/shared';
import { useAuthStore } from '@/stores/auth-store';

export default function {PageComponent}() {
  const router = useRouter();
  const authStatus = useAuthStore((s) => s.status);
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/login');
    }
  }, [authStatus, router]);

  if (authStatus === 'loading' || authStatus === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 min-h-[calc(100vh-3.5rem)]">
      <div className="flex gap-0 h-[calc(100vh-7rem)]">
        <SidePanelLayout
          isCollapsed={sidePanelCollapsed}
          onToggleCollapse={() => setSidePanelCollapsed((prev) => !prev)}
          expandedWidth="w-[320px]"
        >
          <ScrollArea className="flex-1 min-h-0 w-full">
            <div className="p-5" />
          </ScrollArea>
        </SidePanelLayout>

        <div className="flex-1 min-w-0 min-h-0">
          <Card className="h-full rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden shadow-subtle border py-0">
            <CardContent className="flex-1 min-h-0 overflow-auto p-0" />
          </Card>
        </div>
      </div>
    </div>
  );
}
```

**Do not change** the outer layout class names unless you have read [`04_VARIANTS.md`](04_VARIANTS.md) and chosen a different layout variant.

---

## Step 2 — Register sidebar navigation

**File:** [`Dashboard/client/src/config/sidebar-config.ts`](../../client/src/config/sidebar-config.ts)

- [ ] Import `{LucideIcon}` from `lucide-react`
- [ ] Add entry to `navMain` at `{navPosition}`

### Open access (all authenticated users)

Copy shape from the Inspect Damage entry:

```typescript
{
  title: '{navTitle}',
  url: '/{routeSlug}',
  icon: {LucideIcon},
},
```

### Write-gated access

Copy shape from the Database entry:

```typescript
{
  title: '{navTitle}',
  url: '/{routeSlug}',
  icon: {LucideIcon},
  requirePermission: 'write',
  disabledTooltip: 'Read-only access — contact admin',
},
```

### Admin-gated access

```typescript
{
  title: '{navTitle}',
  url: '/{routeSlug}',
  icon: {LucideIcon},
  requirePermission: 'admin',
  disabledTooltip: 'Admin access required',
},
```

No changes to [`NavMain.tsx`](../../client/src/components/layout/NavMain.tsx) are needed — it reads `navMain` automatically.

---

## Step 3 — Register app header

**File:** [`Dashboard/client/src/config/header-config.ts`](../../client/src/config/header-config.ts)

- [ ] Add entry to `routeTitles`:

```typescript
'/{routeSlug}': {headerTitle},
```

Examples:

```typescript
'/inspect-damage': undefined,        // blank header (version label only)
'/my-tool': 'My Tool',               // shows "My Tool" in SiteHeader
```

---

## Step 4 — Verify manually

Run the client dev server (`cd client && npm run dev`) and confirm:

- [ ] Sidebar shows `{LucideIcon}` icon at `{navPosition}`
- [ ] Hover tooltip reads `{navTitle}`
- [ ] Clicking navigates to `/{routeSlug}` with active highlight on the icon
- [ ] Top app bar matches intent (`{headerTitle}` shown or blank)
- [ ] Page shows empty collapsible left panel + empty main `Card`
- [ ] Collapse toggle works (chevron shrinks panel to `w-14`)
- [ ] Logged-out user is redirected to `/login`
- [ ] If write/admin gated: read-only user sees grayed icon and `{disabledTooltip}`

Optional automated checks:

```bash
cd client
npm run lint
npm run build
```

---

## Step 5 — Optional follow-ups (when the page grows)

Do these only when needed — not part of the initial blank scaffold.

| Need | Action | Reference |
|------|--------|-----------|
| Section titles in side panel | Add `SidePanelSection` inside the `ScrollArea` | [`SidePanelSection.tsx`](../../client/src/components/shared/SidePanelSection.tsx) |
| Reusable side panel | Extract component (e.g. `{Route}SidePanel.tsx`) | [`DatabaseSidePanel.tsx`](../../client/src/components/upload/DatabaseSidePanel.tsx) |
| Toolbar in main area | Add a `border-b` row above `CardContent` | [`database/page.tsx`](../../client/src/app/database/page.tsx) |
| API data | Add backend router + `client/src/lib/api/` method | `server/routers/`, `client/src/lib/api/` |
| Changelog entry | Update [`CHANGELOG.md`](../../CHANGELOG.md) under `[Unreleased]` | Project root |

---

## Example: Inspect Damage (completed reference)

| Input | Value |
|-------|-------|
| `{routeSlug}` | `inspect-damage` |
| `{navTitle}` | `Inspect Damage` |
| `{LucideIcon}` | `Calculator` |
| `{PageComponent}` | `InspectDamagePage` |
| `{navPosition}` | after Dashboard |
| `{requirePermission}` | none |
| `{headerTitle}` | `undefined` |

Files touched:

- [`client/src/app/inspect-damage/page.tsx`](../../client/src/app/inspect-damage/page.tsx)
- [`client/src/config/sidebar-config.ts`](../../client/src/config/sidebar-config.ts)
- [`client/src/config/header-config.ts`](../../client/src/config/header-config.ts)
