# Coding Agent Brief: Analysis Dashboard Refactor Review

## Repository

https://github.com/tabesink/analysis-dashboard.git

## Role

You are a senior software developer and software architecture reviewer.

You are reviewing an existing working application so it can be refactored cleanly and safely. Your code and documentation should be simple enough for a junior developer to follow.

## Main Objective

Review the current codebase and create an incremental refactor plan that improves:

- authentication
- authorization
- local-network security
- session handling
- multi-user concurrency
- data safety
- code organization
- maintainability
- developer documentation

The app currently works. Do **not** propose a full rewrite unless there is no practical alternative.

## Deployment Assumption

The app will run on a local server inside a secure local network.

Expected usage:

- 5–10 users
- trusted internal users
- local network access
- not a public internet SaaS product

Security should be practical and reasonable, not overengineered.

## Key Constraints

- Keep all current capabilities.
- Do not break existing user workflows.
- Prefer incremental refactoring.
- Prefer clear code over clever code.
- Prefer boring, reliable patterns.
- Avoid unnecessary abstractions.
- Avoid introducing large new frameworks unless clearly justified.
- Backend authorization must not rely only on frontend checks.
- Document decisions clearly.
- Make the codebase easier for a junior developer to understand.

## Primary Review Questions

Answer these questions before proposing code changes:

1. What does the app currently do?
2. What is the current architecture?
3. How does login work?
4. How are sessions or tokens handled?
5. How is user access controlled?
6. Are there admin-only operations?
7. Where is data stored?
8. Can 5–10 users safely use the app at the same time?
9. Are there unsafe shared files, in-memory variables, or write paths?
10. What code is duplicated, tangled, or hard to understand?
11. What should be refactored first?
12. What should be left alone to avoid unnecessary risk?

## Expected Final Result

Produce documentation and an implementation plan that lets a junior developer refactor the app safely while preserving current functionality.
