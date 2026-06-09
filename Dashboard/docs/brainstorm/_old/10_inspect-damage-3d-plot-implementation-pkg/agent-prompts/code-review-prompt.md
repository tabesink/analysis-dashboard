# Code Review Prompt — Inspect Damage 3D Plot Side Panel

Review the implementation for the Inspect Damage 3D plot side panel.

Check these items:

1. JsPlot3D is not imported, installed, vendored, or referenced as runtime dependency.
2. React Three Fiber v9 is used because the dashboard uses React 19.
3. No standalone `/plots/3d` route was created.
4. The plot lives inside Inspect Damage.
5. The calculated Inspect Damage response is the source of truth; no duplicate damage calculation exists.
6. The adapter joins `EventMetadata.event_id` to `DamageInspectRow.event_id`.
7. Version dropdown lists versions from selected events that have calculated damage rows.
8. The adapter uses `EventMetadata.version` and `job_number`; it does not invent `job_id`.
9. X axis reserves exactly the 12 fixed DEC-066 channels in the required order.
10. `damageResponse.channels` is not allowed to shrink or reorder the fixed channel axis.
11. Event/depth axis shows selected-version calculated events.
12. Bars render only `status: ok`, finite, non-negative damage values.
13. Zero damage remains valid; missing/error/null/NaN/infinite/negative values are skipped, not rendered as missing zeroes.
14. Three.js internal coordinate mapping is documented.
15. WebGL canvas is client-only and SSR-safe.
16. No data fetching happens inside low-level mesh components.
17. Pure adapter/utilities are unit-tested through public interfaces.
18. WebGL-heavy component tests are not added unless they catch real behavior.
19. Canvas component does not own business semantics.
20. Panel collapse/expand does not break table layout.
21. Large event counts have a visible cap/warning or a clear path toward `InstancedMesh`.
22. Docs and changelog were updated only where relevant.
23. Lint, tests, and build pass.

Push back on any speculative abstraction or unrelated refactor.
