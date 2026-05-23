# Coding Agent Output Requirements

## Goal

The coding agent must produce clear review and implementation documentation before making risky changes.

## Required Review Documents

The coding agent should create the following files in the repository:

```text
docs/refactor/CODEBASE_REVIEW.md
docs/refactor/AUTH_AND_SECURITY_REVIEW.md
docs/refactor/CONCURRENCY_AND_DATA_SAFETY_REVIEW.md
docs/refactor/REFACTOR_PLAN.md
docs/refactor/JUNIOR_DEV_CODEBASE_GUIDE.md
docs/refactor/SMOKE_TEST_CHECKLIST.md
docs/refactor/REFACTOR_DECISIONS.md
```

## Required Finding Format

Every issue must use this format:

```markdown
## Finding: Short title

**Severity:** Critical / High / Medium / Low / Nice-to-have

**Area:** Auth / Security / Concurrency / Data / Frontend / Backend / Architecture / Testing

**Evidence:**
- File:
- Function/component/route:
- What the code currently does:

**Why this matters:**
Plain-English explanation.

**Recommended fix:**
Practical, lightweight fix.

**Junior developer note:**
Simple explanation of what to change and why.
```

## Required Architecture Map

Include a simple architecture diagram:

```text
Browser
  |
  v
Frontend
  |
  v
API Client
  |
  v
Backend Routes
  |
  v
Auth / Permission Check
  |
  v
Services
  |
  v
Database / Files
```

Then replace generic labels with actual project folders/files after reviewing the repo.

## Required Route Inventory

Create:

```markdown
| Route | Method | Purpose | Auth Required | Admin Required | Reads | Writes |
|---|---|---|---|---|---|---|
```

## Required Capability Inventory

Create:

```markdown
| Capability | Frontend File | Backend Route | Data Store | User Role | Refactor Risk |
|---|---|---|---|---|---|
```

## Required Risk Matrix

Create:

```markdown
| Risk | Severity | Likelihood | Impact | Fix Phase |
|---|---|---|---|---|
```

## Required Refactor Plan Format

Use phases:

```markdown
## Phase 0: Safety Setup
## Phase 1: Codebase Map
## Phase 2: Auth Boundary Cleanup
## Phase 3: API and Error Standardization
## Phase 4: Data Safety Improvements
## Phase 5: Frontend Cleanup
## Phase 6: Tests and Validation
## Phase 7: Documentation Update
```

Each phase must include:

```markdown
### Goal
### Tasks
### Files likely affected
### Risks
### Done when
```

## Required Final Summary

At the end of the review, include:

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

## Coding Style Requirements

When modifying code:

- keep functions small
- use clear names
- avoid unnecessary abstractions
- avoid clever one-liners
- add comments only where they explain why
- keep auth logic centralized
- keep data access predictable
- keep route handlers readable
- preserve existing behavior
- update docs when behavior changes

## Commit / PR Strategy

Use small PRs:

### PR 1: Documentation and Smoke Tests

- add review docs
- add setup notes
- add smoke checklist
- no major behavior changes

### PR 2: Auth Boundary Cleanup

- centralize auth helpers
- protect backend routes
- document permissions

### PR 3: Data Safety Cleanup

- improve transactions/file safety
- protect admin writes
- add write-path tests

### PR 4: Entropy Reduction

- split large files
- remove duplication
- standardize errors
- clean frontend API calls

### PR 5: Final Documentation

- update junior guide
- update architecture map
- document refactor decisions
