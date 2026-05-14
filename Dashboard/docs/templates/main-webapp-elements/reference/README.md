# Main Webapp Elements Reference Code

This folder contains copied source files from the canonical Dashboard implementation.

The template documents in `docs/templates/main-webapp-elements/` point here so a coding agent can use stable, local references without depending on the live application paths staying unchanged.

## Contents

- `reference/client/src/app/providers.tsx`
- `reference/client/src/app/layout.tsx`
- `reference/client/src/app/login/`
- `reference/client/src/app/changelog/page.tsx`
- `reference/client/src/app/settings/users/page.tsx`
- `reference/client/src/components/layout/`
- `reference/client/src/components/shared/`
- `reference/client/src/components/ui/sidebar.tsx`
- `reference/client/src/config/`
- `reference/client/src/lib/api/`
- `reference/client/src/stores/auth-store.ts`
- `reference/client/src/types/`
- `reference/server/main.py`
- `reference/server/dependencies.py`
- `reference/server/routers/auth.py`
- `reference/server/routers/admin_users.py`
- `reference/server/models/auth.py`
- `reference/server/models/user.py`
- `reference/server/services/auth.py`
- `reference/server/services/user.py`
- `reference/server/storage/database.py`
- `reference/server/config.py`
- `reference/server/settings.yaml`
- `reference/server/middleware/rate_limiter.py`
- `reference/tests/server/routers/`
- `reference/CHANGELOG.md`
- `reference/docs/database-schema.txt`

When applying the template to another app, copy patterns from `reference/` into the target app's own normal source tree paths.
