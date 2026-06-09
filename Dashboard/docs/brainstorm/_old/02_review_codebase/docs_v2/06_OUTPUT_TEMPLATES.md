# Output Templates

## Finding Format

```markdown
## Finding: Short title

**Severity:** Critical / High / Medium / Low / Nice-to-have

**Area:** Auth / Security / Concurrency / Data / Frontend / Backend / Architecture / Testing

**Evidence:**
- File:
- Function/component/route:
- What the code currently does:

**Why this matters:**
Plain-English risk or maintainability impact.

**Recommended fix:**
Small practical fix that preserves behavior.

**TDD slice:**
The first behavior test to write before changing code.

**Junior developer note:**
Simple explanation of what to change and why.
```

## Route Inventory

```markdown
| Route | Method | Router file | Purpose | Auth required | Admin/write required | Reads | Writes | Existing tests | Risk |
|---|---|---|---|---|---|---|---|---|---|
```

## Capability Inventory

```markdown
| Capability | Frontend location | API client | Backend route | Service/store | Data store | User role | Refactor risk |
|---|---|---|---|---|---|---|---|
```

## Persistence Map

```markdown
| Data type | Storage location | Read by | Written by | Owner field | Transaction/locking | Cache invalidation | Multi-user risk |
|---|---|---|---|---|---|---|---|
```

## Write-Path Inventory

```markdown
| Write path | Entry point | Auth/owner rule | Tables/files touched | Rollback behavior | Cache invalidation | Tests | Follow-up |
|---|---|---|---|---|---|---|---|
```

## Risk Matrix

```markdown
| Risk | Severity | Likelihood | User impact | Evidence | Proposed TDD slice | Fix phase |
|---|---|---|---|---|---|---|
```

## Smoke Test Checklist

```markdown
# Smoke Test Checklist

## Startup
- [ ] Backend starts with documented command
- [ ] Frontend starts with documented command
- [ ] App opens in browser
- [ ] No missing environment variable errors

## Login and Session
- [ ] Valid user can log in
- [ ] Invalid password is rejected
- [ ] `/auth/me` restores session after refresh
- [ ] Logout clears the session
- [ ] Unauthenticated user cannot call protected APIs directly

## Admin and Permissions
- [ ] Admin can access user management
- [ ] Normal user cannot access user management
- [ ] Normal user cannot call admin APIs directly
- [ ] Write-enabled user behavior matches documented policy

## Dashboard
- [ ] Dashboard page loads
- [ ] Load-data tree appears
- [ ] Mapped versions are selectable
- [ ] Missing-channel-map versions are not selectable for plotting
- [ ] Plot grid renders expected data
- [ ] Interactive viewer renders expected data

## Database and Uploads
- [ ] Database page loads
- [ ] Upload with channel map succeeds
- [ ] Upload without channel map creates a visible pending state
- [ ] Failed upload shows a clear error
- [ ] Failed upload does not corrupt existing data
- [ ] Scope delete follows admin/owner rules

## Export and Import
- [ ] Admin can start export
- [ ] Normal user cannot start export
- [ ] Invalid import package is rejected
- [ ] Failed import does not replace existing data
- [ ] Staged import can be cancelled if supported

## Metadata
- [ ] Edit metadata page loads
- [ ] Metadata update succeeds for allowed user
- [ ] Unauthorized metadata update is rejected
- [ ] Filter values refresh after metadata changes

## Multi-User
- [ ] Two users can log in from different browsers
- [ ] One user's logout does not log out another user
- [ ] Dashboard can be viewed while admin performs a write
- [ ] Conflicting writes fail safely or are serialized
```

## Per-Slice TDD Checklist

```markdown
## Slice: Name

**Behavior:** Observable behavior under test.

**Public interface:** Route, service, hook, or API client under test.

**RED:** Test name and expected failing reason.

**GREEN:** Smallest implementation path.

**REFACTOR:** Cleanup allowed only while tests pass.

**Verification:** Narrow command and broader command.

**Docs:** Files to update if behavior or architecture changes.
```

## Final Summary Template

```markdown
# Final Summary

## Top 5 Risks to Fix First

## Top 5 Refactor Opportunities

## Recommended Target Architecture

## Files to Change First

## Files to Avoid Changing Unless Necessary

## Suggested First Pull Request

## Suggested Second Pull Request

## Suggested Third Pull Request
```

