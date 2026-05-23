# Refactor Implementation Plan

## Goal

Refactor the existing working app incrementally while preserving all current capabilities.

The refactor should reduce entropy and technical debt, improve auth and multi-user safety, and make the codebase easier for a junior developer to understand.

## Refactor Philosophy

Use these principles:

- Preserve behavior first.
- Refactor in small steps.
- Add tests before changing risky code.
- Prefer simple module boundaries.
- Avoid large rewrites.
- Avoid clever abstractions.
- Keep files focused.
- Keep naming obvious.
- Centralize repeated logic.
- Document why important decisions were made.

## Phase 0: Safety Setup

Before changing application logic:

### Tasks

- Create a refactor branch.
- Confirm the app runs locally.
- Document the exact run commands.
- Capture screenshots or notes of current working flows.
- Add `.env.example` if missing.
- Add a basic smoke-test checklist.
- Identify current user credentials or seed process.

### Output

```text
LOCAL_SETUP.md
SMOKE_TEST_CHECKLIST.md
```

## Phase 1: Codebase Map

### Tasks

Create a system map before refactoring.

Document:

- frontend entry point
- backend entry point
- route map
- API map
- auth flow
- data flow
- storage model
- environment variables
- admin operations

### Output

```text
CODEBASE_REVIEW.md
```

## Phase 2: Stabilize Auth Boundaries

### Tasks

- Identify all protected pages.
- Identify all protected API routes.
- Identify all admin-only operations.
- Create centralized backend auth helpers.
- Replace scattered auth checks gradually.
- Make route protection explicit.
- Keep frontend route guards for UX only.
- Ensure backend enforces actual access.

### Suggested Target Shape

```text
auth/
  current-user
  require-auth
  require-admin
  password-utils
  session-or-token-utils
```

Use filenames appropriate to the actual language/framework.

### Done When

- protected routes are listed
- admin-only routes are listed
- backend checks are centralized
- frontend-only authorization is not trusted
- login/logout behavior is documented

## Phase 3: Standardize API Shape

### Problem

APIs often become hard to maintain when every route returns data and errors differently.

### Tasks

Define simple response conventions:

Successful response:

```json
{
  "ok": true,
  "data": {}
}
```

Error response:

```json
{
  "ok": false,
  "error": {
    "code": "SOME_ERROR",
    "message": "Human readable message"
  }
}
```

Only apply this where it does not break the existing frontend, or update frontend calls carefully.

### Done When

- API error handling is predictable
- common errors are documented
- frontend API client has less repeated code
- junior dev can understand how errors flow

## Phase 4: Reduce Large Files and Mixed Responsibilities

### Tasks

Review files that are doing too much.

Split only when the split improves clarity.

Common target split:

```text
routes/
services/
repositories/
schemas-or-types/
utils/
auth/
```

### Example Rule

A route should usually:

1. validate request
2. check auth
3. call service
4. return response

A service should usually:

1. implement business logic
2. call repository/data layer
3. not know about frontend concerns

A repository/data function should usually:

1. read/write the database or files
2. hide storage details from the route

## Phase 5: Data Safety Improvements

### Tasks

- Identify all write paths.
- Add transactions for multi-step writes.
- Add collision-safe file handling for uploads.
- Remove unsafe shared mutable state.
- Add clear validation before writes.
- Ensure admin-only write operations are protected.

### Done When

- simultaneous reads are safe
- common writes are transaction-safe
- upload/import failures do not corrupt existing data
- unsafe global state is removed or documented

## Phase 6: Frontend Cleanup

### Tasks

- Identify duplicated API calls.
- Create or clean a small API client layer.
- Keep auth state simple.
- Keep dashboard state predictable.
- Avoid deeply nested state if not needed.
- Avoid business rules hidden in components.
- Move reusable UI into small components.

### Frontend Rule

Components should be easy to read.

A junior developer should be able to answer:

- what data this component needs
- where the data comes from
- what actions the user can perform
- what API call happens after the action

## Phase 7: Testing

### Add Lightweight Tests

Prioritize:

- login success
- login failure
- protected route access
- admin-only route access
- normal user blocked from admin operation
- dashboard loads
- upload/import, if applicable
- concurrent write safety, if applicable

Do not add a large testing framework unless the codebase already supports it or the benefit is clear.

## Phase 8: Documentation

Create:

```text
JUNIOR_DEV_CODEBASE_GUIDE.md
AUTH_AND_SECURITY_REVIEW.md
CONCURRENCY_AND_DATA_SAFETY_REVIEW.md
REFACTOR_DECISIONS.md
```

## Phase 9: Final Verification

Before merging:

- run app locally
- run tests
- complete smoke-test checklist
- confirm all existing capabilities still work
- confirm login/logout works
- confirm admin/user permissions work
- confirm no secrets are committed
- confirm documentation matches code

## Recommended First Changes

Change first:

1. documentation and codebase map
2. `.env.example`
3. smoke-test checklist
4. backend auth helper centralization
5. route permission inventory
6. obvious hardcoded config/secrets
7. unsafe write paths

Avoid changing first:

1. core dashboard calculations
2. complex working UI flows
3. database schema, unless necessary
4. large component rewrites
5. routing structure, unless broken
6. styling-only cleanup that does not reduce risk

## Final Deliverable

The final refactored codebase should feel boring, predictable, and easy to trace.
