# Smoke Test Checklist

Use this checklist before and after refactor PRs that touch auth, uploads, dashboard loading, metadata, export/import, or shared API behavior.

## Startup

- [ ] Backend starts with the documented command.
- [ ] Frontend starts with the documented command.
- [ ] App opens in browser.
- [ ] No missing environment variable errors appear.
- [ ] `/health/ready` returns a healthy response.

## Login and Session

- [ ] Valid admin can log in.
- [ ] Valid read-only user can log in.
- [ ] Invalid password is rejected.
- [ ] `/api/v1/auth/me` restores session after page refresh.
- [ ] Logout clears the session and redirects to `/login`.
- [ ] Unauthenticated user cannot call protected dashboard APIs directly.
- [ ] Self-service registration creates a read-only user.

## Admin and Permissions

- [ ] Admin can access `/settings/users`.
- [ ] Normal user cannot access user management.
- [ ] Normal user cannot call `/api/v1/admin/users` directly.
- [ ] New self-registered user has `can_write=false`.
- [ ] Admin can grant write access.
- [ ] Write-enabled user behavior matches documented policy.
- [ ] Read-only user cannot access database write surfaces.

## Dashboard

- [ ] Dashboard page loads after login.
- [ ] Load-data tree appears.
- [ ] Program IDs and versions load.
- [ ] Mapped versions are selectable.
- [ ] Missing-channel-map versions are not selectable for plotting.
- [ ] Plot grid renders expected data.
- [ ] Interactive viewer renders expected data.
- [ ] Refresh does not leave stale selected/rendered state.
- [ ] Switching between grid and interactive views does not lose valid loaded data.

## Database and Uploads

- [ ] Database page loads for an allowed write/admin user.
- [ ] Read-only user is redirected away from database write page.
- [ ] Upload with channel map succeeds.
- [ ] Upload without channel map creates visible pending channel-map state.
- [ ] RSP upload without channel map still performs RSP-to-CSV conversion before pending retention.
- [ ] Mixed CSV/RSP upload is rejected.
- [ ] Failed upload shows a clear error.
- [ ] Failed upload does not corrupt existing data.
- [ ] Single event soft delete follows owner/admin rules.
- [ ] Bulk event soft delete follows owner/admin rules.
- [ ] Program/version scope delete follows write/admin plus owner rules.

## Export and Import

- [ ] Admin can open database export/import controls.
- [ ] Normal user cannot start export.
- [ ] Normal user cannot upload import ZIP.
- [ ] Admin can start Parquet ZIP export.
- [ ] Export task status updates until completion.
- [ ] Export download succeeds.
- [ ] Invalid import package is rejected.
- [ ] Failed import does not replace existing data.
- [ ] Staged import upload can be cancelled if supported.
- [ ] Task cancellation does not leave misleading running status.

## Metadata and Channel Maps

- [ ] Edit metadata page loads for allowed user.
- [ ] Event metadata update succeeds for owner/admin.
- [ ] Unauthorized metadata update is rejected.
- [ ] Program/version metadata update applies to expected events.
- [ ] Filter values refresh after metadata changes.
- [ ] Pending channel-map editor shows fixed plot rows.
- [ ] Saving channel map processes pending artifacts.
- [ ] Invalid channel-map values show a clear error.

## Multi-User

- [ ] Two users can log in from different browsers.
- [ ] One user's logout does not log out another user.
- [ ] Two users can view dashboard at the same time.
- [ ] Dashboard can be viewed while admin performs an upload.
- [ ] Dashboard can be viewed while admin starts an export.
- [ ] Conflicting writes fail safely or are serialized.
- [ ] Non-owner cannot modify or delete another user's data unless admin.

## Regression Commands

Backend:

```bash
cd server
uv run pytest
uv run ruff check .
uv run mypy .
```

Frontend:

```bash
cd client
npm run lint
npm run build
npm run test
```

