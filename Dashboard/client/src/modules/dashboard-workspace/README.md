# Dashboard Workspace Module

This module owns the Dashboard's user-facing state rules.

It decides:

- Which event IDs are selected.
- Which selected event IDs are still valid for the current catalog.
- Which event IDs have already been rendered.
- Whether the current selection has unrendered changes.
- When a catalog update should persist a pruned selection.

Callers should use `useDashboardWorkspace`. UI code should not coordinate session sync and selection pruning directly.
