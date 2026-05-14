---
name: Changelog from decisions
overview: Update the Dashboard changelog from the decision log and prepare a release bump using a SemVer that matches the scope of completed changes.
todos:
  - id: collect-release-items
    content: Map post-1.0.0 decisions to concise changelog bullets and remove superseded duplicates.
    status: completed
  - id: write-release-section
    content: Create 1.1.0 section dated 2026-03-31 and reset Unreleased section.
    status: completed
  - id: bump-and-sync-version
    content: Set version to 1.1.0 in VERSION and synchronize mirrored package metadata.
    status: completed
  - id: run-version-validation
    content: Run release-versioning checks and confirm changelog/version consistency.
    status: completed
isProject: false
---

# Update changelog and bump release version

## Proposed release target

- Use `**1.1.0**` as the next version (minor bump from `1.0.0`) because the decision log shows multiple shipped feature additions and behavior changes without an explicit breaking-change migration requirement for users.

## Implementation plan

- Review release window from current released entry in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/CHANGELOG.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/CHANGELOG.md)` and collect applicable decisions from `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/decisions/log.md)` (primarily DEC-014 through DEC-029, excluding superseded details that should not be presented as current behavior).
- Rewrite `Unreleased` bullets into clear Keep-a-Changelog sections (`Added`, `Changed`, `Fixed`) focused on user-visible outcomes (Parquet export/import pipeline, upload progress SSE, pagination/facets, side-panel UX fixes, metadata boundary hardening, role-locked Status behavior).
- Create a new release section `## [1.1.0] - 2026-03-31` in the changelog and move finalized bullets under it; leave a fresh empty `## [Unreleased]` section at the top for future work.
- Bump canonical version in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/VERSION](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/VERSION)` from `1.0.0` to `1.1.0`, and sync mirrors (`client/package.json`, `server/pyproject.toml`) using the project’s release workflow documented in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/release-versioning.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/docs/release-versioning.md)`.
- Validate consistency by running the documented sync checks, then do a final pass to ensure changelog wording reflects the decision log accurately and avoids duplicate/superseded notes.

## Notes on scope

- Follow the `grill-me` instruction in `[/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/.cursor/skills/grill-me/SKILL.md](/data/home/tkodippili/Desktop/localTest_Analysis_DashboardV3/Dashboard/.cursor/skills/grill-me/SKILL.md)` by pressure-testing decision-to-changelog mapping during implementation (resolve ambiguities from the codebase when possible, and ask only if unresolved).

