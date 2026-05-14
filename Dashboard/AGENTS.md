# PROJECT INSTRUCTIONS

## Documentation Structure

```
docs/
  master-build-plan.md        # Task tracker: phases, IDs, status, deps
  prd.md                      # Product requirements
  tech-stack.md               # Technology inventory
  database-schema.txt         # Schema source of truth
  test-strategy.md            # Test approach + current gaps
  decisions/
    log.md                    # Append-only decision log
  tasks/                      # Per-task implementation notes
  architecture/               # Deep-dive architecture docs
```

## Mandatory After Completing Work

1. Update task status in `docs/master-build-plan.md` (mark DONE with date).
2. Append an entry to `docs/decisions/log.md` if you made an architectural or design decision.
3. For non-trivial tasks, create implementation notes in `docs/tasks/{task-id}.md`.

## Task Tracking

- Each task has a unique ID (e.g., P8-03). Use these IDs in commit messages and doc references.
- When starting a task, mark it IN PROGRESS in `docs/master-build-plan.md`.
- When done, mark it DONE with the completion date.

## Agent Skills

This repo has Cursor skills under `.cursor/skills/` for recurring engineering workflows.

### Installed Core Workflow Skills

- `setup-matt-pocock-skills`: maintains this repo's skill configuration files.
- `grill-me`: interviews the user about a plan until the design tree is resolved.
- `grill-with-docs`: like `grill-me`, but also maintains `CONTEXT.md` and decision docs.
- `diagnose`: builds a feedback loop before debugging bugs or performance regressions.
- `tdd`: uses red-green-refactor with behavior tests and vertical slices.
- `triage`: classifies and prepares GitHub issues using the repo's triage labels.
- `to-issues`: converts plans or PRDs into independently implementable GitHub issues.
- `to-prd`: synthesizes the current context into a PRD and publishes it as a GitHub issue.
- `zoom-out`: maps unfamiliar code at a higher level before detailed work.

### Skill Configuration

- Issue tracker: GitHub Issues for `tabesink/Dashboard` via `gh`. See `docs/agents/issue-tracker.md`.
- Triage labels: default labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.
- Domain docs: single-context layout with root `CONTEXT.md` and decisions in `docs/decisions/log.md`. See `docs/agents/domain.md`.

When a skill asks for issue tracker, label, or domain-doc context, read the corresponding `docs/agents/*.md` file before acting.

## Database Changes

ALWAYS refer to `docs/database-schema.txt` before making any database changes. The schema file is the source of truth. ALWAYS update `docs/database-schema.txt` after making any schema changes.

Source files: `server/schema.yaml` (dim tables, filter config), `server/storage/database.py` (_init_schema for non-dim tables).

Runtime, portability export/import, and DuckDB connection model: `docs/notes/database.md`.

## Multi-User Awareness

When modifying write paths (upload, delete, metadata update, custom fields):
- Verify cache invalidation covers the change (check `server/utils/cache.py` usage)
- Verify ownership checks are enforced (owner or admin)
- Reference `docs/architecture/database-multi-user.md` for multi-user constraints
- Reference Phase 8 in `docs/master-build-plan.md` for the hardening roadmap

## Security Considerations (Production)

When writing or reviewing code, enforce these security practices:

### Authentication & Secrets

- NEVER hardcode secrets, API keys, or passwords. Use environment variables or `settings.yaml` with env overrides.
- JWT secret must be a strong random value (>=256-bit). Reject startup if `jwt_secret` is the default/placeholder.
- Set `auth_cookie_secure: true` and `auth_cookie_httponly: true` in production. Use `SameSite=Lax` or `Strict`.
- Token expiry should be short-lived (<=24h). Implement refresh tokens for long sessions rather than extending expiry.
- Hash passwords with bcrypt (cost factor >=12). Never log, return, or store plaintext passwords.

### Input Validation & Injection

- Validate ALL user inputs at the boundary (Pydantic models on backend, Zod schemas on frontend).
- Use parameterized queries for DuckDB -- never interpolate user input into SQL strings.
- Sanitize uploaded filenames: strip path traversal (`../`), null bytes, and special characters before any filesystem operation.
- Enforce file type and size limits at both the reverse proxy and application layer.
- Reject uploads with unexpected MIME types; do not rely solely on file extension.

### API Security

- CORS: restrict `allow_origins` to explicit domains in production. Never use `["*"]` outside local dev.
- Rate limiting must be active on all endpoints. Use stricter limits for auth (`/login`, `/register`) and upload paths.
- Return generic error messages to clients (e.g., "Invalid credentials"). Log detailed errors server-side only.
- Ensure all admin endpoints are guarded by `require_admin` dependency. Audit new routes for missing guards.
- Use HTTPS exclusively in production. Set `Strict-Transport-Security` header via reverse proxy.

### Data Protection

- Ownership checks: every write/update/delete must verify `user_id` matches the resource owner (or caller is admin).
- Soft-delete before hard-delete. Only admins can purge.
- Database file (`dashboard.db`) should have restrictive filesystem permissions (600). Backup files likewise.
- Export/import endpoints are admin-only. Portable format is a **Parquet ZIP** (not a raw `.db` download); uploads are streamed to disk. Validate schema compatibility before import; staged uploads can be cancelled via API if the user closes the import dialog.
- Never expose internal IDs, stack traces, or database errors in API responses.

### Frontend Security

- Store JWT in httpOnly cookies, not localStorage or sessionStorage.
- Protect against XSS: avoid `dangerouslySetInnerHTML`; sanitize any user-generated content before rendering.
- Protect against CSRF: use `SameSite` cookie attribute and consider CSRF tokens for state-changing requests.
- Validate redirect URLs to prevent open redirect vulnerabilities (only allow relative paths or whitelisted domains).
- Do not leak sensitive data in client-side state (Zustand stores, React Query cache) that could be inspected via dev tools.

### Infrastructure & Deployment

- Run containers as non-root users. Drop unnecessary Linux capabilities.
- Pin dependency versions in `pyproject.toml` and `package.json`. Audit dependencies for known CVEs periodically.
- Enable structured logging for audit trails (who did what, when). Never log secrets or full request bodies containing passwords.
- Set resource limits (memory, CPU) on Docker containers to prevent DoS via resource exhaustion.
- Disable debug mode, verbose error pages, and development middleware in production builds.

## Versioning Best Practices

Follow these practices for all releases and version management:

### Semantic Versioning

- Use [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):
  - **MAJOR** — breaking changes or incompatible API modifications.
  - **MINOR** — new features added in a backward-compatible manner.
  - **PATCH** — backward-compatible bug fixes.
- Pre-release versions use hyphenated suffixes (e.g., `1.2.0-beta.1`).
- Never reuse a version number once published.

### Changelog

- Document every user-facing change in `CHANGELOG.md` at the project root.
- Follow [Keep a Changelog](https://keepachangelog.com/) format with sections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- Write entries from the user's perspective, not implementation details.
- Keep an `[Unreleased]` section at the top for in-progress work; move entries under the version heading at release time.

### Git Tags & Branching

- Tag every release in Git with the version prefixed by `v` (e.g., `v1.3.0`).
- Tags must point to the exact commit that was tested and approved.
- Use annotated tags (`git tag -a`) with a short release summary.
- Never delete or move a published tag.

### Pre-Release Testing

- All automated tests (unit, integration, E2E) must pass before a version is tagged.
- Run the full test suite against the release candidate build, not just changed code.
- Perform manual smoke tests for critical user flows before publishing.
- Verify database migration compatibility if schema changes are included.

### Build Numbers

- Use build numbers (e.g., `1.3.0+build.42`) to differentiate internal/CI builds from public releases.
- Build metadata (after `+`) does not affect version precedence per SemVer.
- Expose the build number in the application UI or health endpoint for easy identification during QA and debugging.

### Version Source of Truth

- Maintain the version string in a single canonical location (e.g., `package.json` for the client, `pyproject.toml` for the server).
- All other references (Docker labels, API responses, UI footers) must derive from this source — never hardcode duplicates.
- CI/CD pipelines should read the version from the canonical source and inject it into build artifacts automatically.

### Checklist for New Endpoints

Before merging any new API route, verify:
1. Auth guard applied (`get_current_user` or `require_admin`)
2. Input validated via Pydantic model
3. Ownership or role check on the target resource
4. Rate limit category assigned
5. Error responses do not leak internals
6. Cache invalidation covered if the endpoint mutates data

## When Making Code Changes

1. **Think Before Coding**
Don't assume. Don't hide confusion. Surface tradeoffs.

State assumptions explicitly -- if uncertain, ask rather than guess.
Present multiple interpretations -- don't pick silently when ambiguity exists.
Push back when warranted -- if a simpler approach exists, say so.
Stop when confused -- name what's unclear and ask for clarification.

2. **Simplicity First**
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If 200 lines could be 50, rewrite it.
The test: Would a senior engineer say this is overcomplicated? If yes, simplify.

3. **Surgical Changes**
Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting
- Don't refactor things that aren't broken
- Match existing style, even if you'd do it differently
- If you notice unrelated dead code, mention it -- don't delete it

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused
- Don't remove pre-existing dead code unless asked

The test: Every changed line should trace directly to the user's request.

4. **Goal-Driven Execution**
Define success criteria. Loop until verified.

Transform imperative tasks into verifiable goals:

| Instead of... | Transform to... |
|--------------|-----------------|
| "Add validation" | "Write tests for invalid inputs, then make them pass" |
| "Fix the bug" | "Write a test that reproduces it, then make it pass" |
| "Refactor X" | "Ensure tests pass before and after" |

For multi-step tasks, state a brief plan:
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]

Strong success criteria let the LLM loop independently. Weak criteria ("make it work") require constant clarification.
