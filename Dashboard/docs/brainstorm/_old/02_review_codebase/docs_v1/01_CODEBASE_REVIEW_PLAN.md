# Codebase Review Plan

## Goal

Understand the current `analysis-dashboard` codebase before making changes.

The review should produce a clear map of the system so future refactoring is evidence-based rather than guess-based.

## Phase 1: Repository Orientation

### Tasks

1. Clone the repository.
2. Identify the technology stack.
3. Identify how the app is started locally.
4. Identify frontend, backend, database, and config boundaries.
5. Read existing documentation, if available.
6. Create a rough file/folder map.

### Questions to Answer

- Is this a monorepo or single app?
- What framework is used for the frontend?
- What framework is used for the backend?
- Is there a database?
- Are files or local JSON used for persistence?
- How is configuration handled?
- Are there existing tests?
- Are there existing scripts for setup or deployment?

### Output

Create or update:

```text
CODEBASE_REVIEW.md
```

Include:

- stack summary
- local setup summary
- folder structure
- key files
- high-level architecture map

## Phase 2: Runtime Flow Review

### Tasks

Trace the app from startup to user interaction.

Review:

- app entry points
- routing
- API route definitions
- database initialization
- config loading
- auth middleware, if any
- frontend state initialization
- data-fetching flow

### Questions to Answer

- What happens when the server starts?
- What happens when the user opens the app?
- What happens when the user logs in?
- What API routes are called after login?
- What data is loaded by default?
- Which routes require authentication?
- Which routes should require authentication but may not?

### Output

Add to `CODEBASE_REVIEW.md`:

```markdown
## Runtime Flow

## User Login Flow

## Main Data Flow

## API Route Map
```

## Phase 3: Capability Inventory

### Tasks

Create a list of current working capabilities.

Examples:

- login
- dashboard viewing
- user management
- data upload
- data editing
- reports
- settings
- exports
- admin operations

### Questions to Answer

- What features exist today?
- Which features are read-only?
- Which features write data?
- Which features should be admin-only?
- Which features are used by regular users?
- Which features are risky to refactor?

### Output

Create a capability table:

```markdown
| Capability | Frontend Location | Backend Route | Data Store | Auth Needed | Admin Only? | Refactor Risk |
|---|---|---|---|---|---|---|
```

## Phase 4: Technical Debt Review

### Tasks

Look for entropy in the codebase.

Check for:

- duplicated route logic
- duplicated auth checks
- very large files
- mixed responsibilities
- unclear names
- inconsistent error handling
- inconsistent API responses
- frontend components doing backend-like work
- hidden global state
- hardcoded config
- dead code
- commented-out old code

### Output

Add findings using this format:

```markdown
## Finding: Short title

**Severity:** Critical / High / Medium / Low / Nice-to-have

**Area:** Architecture / Frontend / Backend / Auth / Data / Testing

**Evidence:**
- File:
- Function/component/route:
- Current behavior:

**Why this matters:**

**Recommended fix:**

**Junior developer note:**
```

## Review Rule

Do not make refactor recommendations without evidence from the codebase.
