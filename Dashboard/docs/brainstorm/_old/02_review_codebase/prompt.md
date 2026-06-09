Here is a refined prompt you can give to a senior coding agent:

````markdown
# Task: Senior Codebase Review + Refactor Plan for `analysis-dashboard`

Repository: https://github.com/tabesink/analysis-dashboard.git

## Role

You are a senior software developer and software architecture reviewer.

Your job is to review this existing working application and produce a clear, practical refactor plan that a junior developer can follow.

The goal is **not** to rewrite everything from scratch. The goal is to understand the current implementation, identify risks and technical debt, and propose a clean refactor that keeps all current capabilities working.

---

## Context

This app is intended to run on a **local server inside a secure local network**.

It is intended for a small multi-user environment of approximately **5–10 users**.

Because this is not a public internet-facing SaaS app, security does not need to be enterprise-grade. However, the app should still have reasonable protections around:

- user authentication
- authorization / role access
- session handling
- local network exposure
- data access boundaries
- concurrent use by multiple users
- accidental data corruption
- maintainability

The app currently works. The review should focus on how to improve it safely without breaking existing behavior.

---

## Main Review Goals

Review the codebase and document:

1. **Current Architecture**
   - What is the app stack?
   - What are the frontend, backend, database, and auth layers?
   - How does data flow through the app?
   - What are the main modules, routes, services, and state-management areas?
   - Where are the most important files?

2. **Authentication and Authorization**
   - How is login currently implemented?
   - How are users stored and verified?
   - How are sessions, tokens, cookies, or local storage handled?
   - Are there user roles or permission boundaries?
   - Can one user access another user’s data?
   - What are the practical risks for a local-network app?

3. **Security Review for Local Multi-User Use**
   - Identify realistic security concerns without overengineering.
   - Check for:
     - hardcoded secrets
     - insecure password handling
     - weak session handling
     - missing backend authorization checks
     - unsafe API routes
     - CORS issues
     - file upload risks, if applicable
     - exposed admin operations
     - environment variable misuse
   - Classify each finding as:
     - Critical
     - High
     - Medium
     - Low
     - Nice-to-have

4. **Concurrency and Multi-User Safety**
   - Can 5–10 users use the app at the same time safely?
   - Are there shared files, in-memory state, JSON files, SQLite, or other storage choices that could cause race conditions?
   - Are writes handled safely?
   - Are there locking, transaction, or data consistency concerns?
   - Is the current database/storage approach acceptable for this small local deployment?
   - What would need to change if usage grows later?

5. **Technical Debt and Entropy**
   - Identify areas where the code is hard to understand, duplicated, overly coupled, or fragile.
   - Look for:
     - large files doing too much
     - duplicated API logic
     - unclear naming
     - mixed frontend/backend responsibilities
     - inconsistent error handling
     - inconsistent data models
     - scattered auth checks
     - unnecessary abstractions
     - missing tests
   - Recommend ways to reduce entropy while keeping the code simple.

6. **Refactor Strategy**
   - Propose a clean, lightweight refactor plan.
   - The plan should preserve all existing capabilities.
   - Prefer simple, boring, maintainable patterns.
   - Avoid introducing unnecessary frameworks or complexity.
   - The code should be understandable by a junior developer.
   - Prioritize changes that improve reliability, clarity, and maintainability.

---

## Refactor Principles

Use these principles when making recommendations:

- Keep the app lightweight.
- Do not overengineer for enterprise scale.
- Preserve current working behavior.
- Prefer clear module boundaries over clever abstractions.
- Put auth and permission logic in predictable backend locations.
- Use simple database transactions or safe persistence patterns where needed.
- Keep frontend state simple and understandable.
- Write code that a junior developer can trace end-to-end.
- Add documentation where it reduces confusion.
- Add tests around risky behavior before refactoring.

---

## Required Deliverables

Create the following documentation:

### 1. `CODEBASE_REVIEW.md`

Include:

- Executive summary
- Current architecture map
- Key files and responsibilities
- Auth flow explanation
- Security findings
- Concurrency findings
- Technical debt findings
- Risk matrix
- Recommended refactor direction

### 2. `AUTH_AND_SECURITY_REVIEW.md`

Include:

- Current auth flow
- Current authorization model
- Identified risks
- Recommended local-network security baseline
- Practical fixes
- What is intentionally not needed because this is a local app

### 3. `CONCURRENCY_AND_DATA_SAFETY_REVIEW.md`

Include:

- Current persistence model
- Current read/write flow
- Multi-user risks
- Race-condition risks
- Recommended approach for 5–10 users
- When to upgrade storage or locking strategy

### 4. `REFACTOR_PLAN.md`

Include a phased implementation plan:

#### Phase 1 — Stabilize and Document
- Map current routes and data flows
- Add missing `.env.example`
- Document local setup
- Identify critical auth/security bugs
- Add smoke tests for existing behavior

#### Phase 2 — Clean Auth and Access Boundaries
- Centralize auth logic
- Make protected routes explicit
- Add backend-side authorization checks
- Improve session/token handling if needed

#### Phase 3 — Reduce Code Entropy
- Split large files
- Remove duplicated logic
- Standardize API response shapes
- Standardize error handling
- Improve naming and folder structure

#### Phase 4 — Improve Multi-User Reliability
- Review database/file-write safety
- Add transactions or locking where appropriate
- Remove unsafe global mutable state
- Add tests for concurrent write scenarios

#### Phase 5 — Final Cleanup
- Update developer documentation
- Add junior-friendly comments only where useful
- Remove dead code
- Confirm all existing features still work

### 5. `JUNIOR_DEV_CODEBASE_GUIDE.md`

Write a short guide for a junior developer explaining:

- How the app is structured
- How login works
- How protected pages work
- How API routes work
- How data is stored
- Where to make common changes
- What files should not be changed casually

---

## Review Format

For each finding, use this format:

```markdown
## Finding: Short title

**Severity:** Critical / High / Medium / Low / Nice-to-have

**Area:** Auth / Security / Concurrency / Data / Frontend / Backend / Architecture

**Evidence:**
- File:
- Function/component/route:
- What the code currently does:

**Why this matters:**
Explain the risk in plain English.

**Recommended fix:**
Give a practical fix that keeps the app lightweight.

**Junior developer note:**
Explain the idea simply so a junior developer understands what to change and why.
````

---

## Important Constraints

* Do not remove existing capabilities.
* Do not propose a full rewrite unless absolutely necessary.
* Do not overengineer for cloud-scale usage.
* Assume local deployment for 5–10 trusted users.
* Security should be practical, not excessive.
* Keep the refactor plan incremental.
* Prefer simple backend-enforced access control over frontend-only checks.
* Prefer readable code over clever code.
* Documentation should be clear enough for a junior developer to follow.

---

## Final Output

At the end, provide:

1. A concise executive summary.
2. The top 5 risks to fix first.
3. The top 5 refactor opportunities.
4. A recommended target architecture.
5. A phased implementation checklist.
6. A list of files that should be changed first.
7. A list of files that should be left alone unless necessary.

````

A shorter version you can use directly in Cursor/Codex:

```markdown
Review this working codebase: https://github.com/tabesink/analysis-dashboard.git

Act as a senior software developer reviewing the app for a safe, clean refactor. The app runs on a local server in a secure local network and is intended for 5–10 users. It does not need enterprise SaaS-level security, but it does need reasonable authentication, authorization, session handling, data safety, and concurrency protection.

Focus on:
- current architecture
- user auth flow
- authorization boundaries
- local-network security concerns
- multi-user concurrency risks
- data persistence safety
- technical debt
- duplicated or tangled code
- opportunities to reduce entropy
- junior-friendly refactor strategy

Important: the app currently works. Do not recommend a full rewrite. Preserve all current capabilities. Propose an incremental refactor that keeps the code lightweight, readable, and easy for a junior developer to understand.

Create these markdown files:
1. `CODEBASE_REVIEW.md`
2. `AUTH_AND_SECURITY_REVIEW.md`
3. `CONCURRENCY_AND_DATA_SAFETY_REVIEW.md`
4. `REFACTOR_PLAN.md`
5. `JUNIOR_DEV_CODEBASE_GUIDE.md`

For each issue, include:
- severity
- affected file/function
- what the code currently does
- why it matters
- recommended fix
- junior developer explanation

End with:
- top 5 risks to fix first
- top 5 refactor opportunities
- recommended target architecture
- phased implementation checklist
- files to change first
- files to avoid changing unless necessary
````
