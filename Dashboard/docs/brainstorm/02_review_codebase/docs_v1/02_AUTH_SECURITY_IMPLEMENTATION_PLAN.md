# Auth and Local-Network Security Implementation Plan

## Goal

Improve authentication, authorization, and practical security for a small local-network application used by 5–10 people.

This is not intended to become an enterprise SaaS security system. The goal is to prevent accidental misuse, obvious unauthorized access, and fragile auth behavior.

## Target Security Baseline

The application should have:

- clear login flow
- secure password verification
- no plaintext passwords
- backend-protected routes
- clear session or token handling
- admin-only checks for sensitive operations
- predictable logout behavior
- safe environment variable usage
- no hardcoded secrets in source code
- practical CORS settings for local deployment
- basic protection against accidental local-network misuse

## Phase 1: Understand Current Auth

### Tasks

Trace:

1. login form
2. login API call
3. credential verification
4. session/token creation
5. frontend storage of auth state
6. protected page handling
7. logout flow
8. backend route protection

### Questions to Answer

- Where are users stored?
- Are passwords hashed?
- Which hashing method is used?
- Are sessions stored server-side or client-side?
- Are JWTs used?
- Are cookies used?
- Is localStorage used?
- Are tokens expired?
- Are protected routes enforced on the backend?
- Are admin operations protected on the backend?
- Can a user bypass the frontend and call protected APIs directly?

## Phase 2: Define User Roles

For a small local app, keep roles simple.

Recommended baseline:

```text
admin
user
```

### Admin Can

- manage users
- upload or modify shared data
- access admin settings
- perform destructive actions
- view all dashboard data if required by the app

### Regular User Can

- log in
- view allowed dashboards
- interact with non-admin features
- access only routes intended for normal users

### Implementation Guidance

Create a single predictable authorization helper, such as:

```text
requireAuthenticatedUser()
requireAdminUser()
getCurrentUser()
```

Avoid scattering custom role checks across many files.

## Phase 3: Centralize Auth Logic

### Current Problem to Look For

Auth code may be scattered across:

- frontend route guards
- API handlers
- utility files
- components
- local storage helpers
- repeated conditional checks

### Recommended Target

Create a clear backend auth boundary:

```text
backend/
  auth/
    password.ts or password.py
    session.ts or session.py
    permissions.ts or permissions.py
    middleware.ts or middleware.py
```

The exact filenames should match the existing stack.

### Rule

Frontend guards improve user experience, but backend checks provide actual protection.

Never rely only on hiding buttons or pages in the frontend.

## Phase 4: Password Handling

### Required Review

Check whether passwords are:

- plaintext
- hardcoded
- hashed
- salted
- stored in environment variables
- stored in a database
- stored in local files

### Recommended Baseline

For local 5–10 user use:

- use a standard password hashing library
- store only password hashes
- seed an initial admin from environment variables or a setup script
- force the default admin password to be changed, if practical
- never commit real credentials

## Phase 5: Session or Token Handling

### If Using Cookies

Prefer:

- HTTP-only cookie
- same-site setting
- reasonable expiration
- logout clears cookie

For local HTTP-only deployment, `secure` cookies may not work unless HTTPS is configured. Document this clearly.

### If Using JWT/localStorage

Review risks:

- token theft through XSS
- no server-side invalidation
- stale tokens after role changes
- unclear expiration

For a simple local app, JWT can be acceptable if:

- token expiration exists
- secret is stored in environment variables
- backend validates every protected request
- admin checks are performed server-side

## Phase 6: CORS and Local Network Exposure

### Review

Check current CORS settings.

Avoid:

```text
allow all origins
allow all methods without reason
allow credentials with wildcard origins
```

### Recommended Local Baseline

Allow only known local frontend origins, such as:

```text
http://localhost:3000
http://127.0.0.1:3000
http://LOCAL_SERVER_IP:3000
```

Document how to configure this in `.env`.

## Phase 7: Environment Variables

Create or update:

```text
.env.example
```

Include non-secret placeholders only:

```env
APP_ENV=local
APP_HOST=0.0.0.0
APP_PORT=8000
FRONTEND_ORIGIN=http://localhost:3000
SESSION_SECRET=replace-with-local-random-secret
DATABASE_URL=replace-with-local-database-url
INITIAL_ADMIN_EMAIL=admin@example.local
INITIAL_ADMIN_PASSWORD=change-me
```

Do not commit real secrets.

## Phase 8: Security Findings Format

Use this format for each auth/security issue:

```markdown
## Finding: Short title

**Severity:** Critical / High / Medium / Low / Nice-to-have

**Area:** Auth / Authorization / Session / Config / CORS / Data

**Evidence:**
- File:
- Route/function:
- Current behavior:

**Why this matters:**

**Recommended fix:**

**Junior developer note:**
```

## Practical Security Fix Priority

1. Remove hardcoded secrets or passwords.
2. Ensure passwords are hashed.
3. Protect backend routes.
4. Add backend admin checks.
5. Standardize session/token handling.
6. Restrict CORS to known local origins.
7. Add `.env.example`.
8. Document local deployment assumptions.
