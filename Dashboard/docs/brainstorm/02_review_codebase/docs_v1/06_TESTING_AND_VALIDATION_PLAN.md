# Testing and Validation Plan

## Goal

Add enough testing and validation to refactor safely without overengineering.

The app is small and local, so the testing strategy should be practical.

## Testing Priorities

Focus tests on behavior that could break users or corrupt data:

1. authentication
2. authorization
3. dashboard loading
4. admin-only operations
5. data writes
6. uploads/imports
7. concurrent use
8. environment/config issues

## Phase 1: Smoke Test Checklist

Create:

```text
SMOKE_TEST_CHECKLIST.md
```

Include manual checks for:

```markdown
# Smoke Test Checklist

## Startup
- [ ] Backend starts with documented command
- [ ] Frontend starts with documented command
- [ ] App opens in browser
- [ ] No missing environment variable errors

## Login
- [ ] Valid user can log in
- [ ] Invalid password is rejected
- [ ] Logout works
- [ ] Protected page redirects or blocks unauthenticated user

## Admin
- [ ] Admin can access admin page
- [ ] Normal user cannot access admin page
- [ ] Normal user cannot call admin API directly

## Dashboard
- [ ] Main dashboard loads
- [ ] Expected data appears
- [ ] Refresh does not break state
- [ ] Multiple browser sessions can load dashboard

## Data Writes
- [ ] Admin write operation works
- [ ] Failed write shows clear error
- [ ] Failed write does not corrupt existing data

## Multi-User
- [ ] Two users can log in from different browsers
- [ ] One user logging out does not break another user's session
- [ ] Two users can view dashboard at same time
```

## Phase 2: Auth Tests

Add tests for:

- valid login
- invalid login
- missing credentials
- protected API without session/token
- protected API with normal user
- admin API with normal user
- admin API with admin user

## Phase 3: Data Safety Tests

Add tests for:

- successful write
- failed write rollback
- invalid input rejected
- two writes do not corrupt data
- upload failure does not overwrite previous data

## Phase 4: API Contract Tests

For important API routes, verify:

- success response shape
- error response shape
- auth required
- admin required where needed
- bad input handled clearly

## Phase 5: Frontend Validation

Use lightweight frontend tests if the codebase already supports them.

Prioritize:

- login form
- dashboard loading state
- error message display
- admin-only UI visibility
- API failure behavior

## Phase 6: Concurrency Manual Tests

For small local apps, manual concurrency tests are acceptable.

Test using:

- two browser profiles
- two different users
- one admin and one normal user
- simultaneous dashboard loads
- admin upload while user views dashboard

## Phase 7: Regression Rules

Before each refactor PR:

- run tests
- run smoke checklist
- document changed behavior
- confirm existing capabilities still work
- confirm no secrets were added
- confirm docs updated if architecture changed

## Do Not Overdo Testing

Avoid spending time on:

- testing every visual component
- complex mocks for low-risk UI
- brittle snapshot tests
- enterprise-scale load testing
- unnecessary end-to-end complexity

Focus on tests that prevent broken auth, broken data, and broken core workflows.
