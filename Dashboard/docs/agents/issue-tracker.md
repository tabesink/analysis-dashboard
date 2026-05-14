# Issue Tracker: GitHub

Issues, PRDs, refactor RFCs, and triage notes for this repo live in GitHub Issues for `tabesink/Dashboard`.

Use the `gh` CLI for GitHub operations.

## Conventions

- Create an issue: `gh issue create --title "..." --body "..."` with a heredoc for multi-line bodies.
- Read an issue: `gh issue view <number> --comments`.
- List issues: `gh issue list --state open --json number,title,body,labels,comments` with appropriate `--label` and `--state` filters.
- Comment on an issue: `gh issue comment <number> --body "..."`.
- Apply or remove labels: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- Close an issue: `gh issue close <number> --comment "..."`.

Run GitHub commands from the repository root so `gh` can infer the repo from `origin`.

## Publishing

When a skill says "publish to the issue tracker", create a GitHub issue unless the user explicitly asks for a local draft instead.
