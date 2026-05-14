---
name: Sidebar changelog icon page
overview: Add an info icon above the auth action in the sidebar footer and wire it to a new in-app changelog route that renders `Dashboard/CHANGELOG.md` with polished typography.
todos:
  - id: sidebar-footer-action
    content: Insert changelog icon button above auth action in AppSidebar footer and wire to /changelog with active tooltip behavior.
    status: completed
  - id: changelog-route
    content: Create /changelog page that loads Dashboard/CHANGELOG.md and renders it as formatted markdown.
    status: completed
  - id: markdown-support
    content: Add markdown rendering dependencies and any minimal styles needed for consistent typography.
    status: completed
  - id: verify
    content: Run lint/build checks and validate sidebar navigation + changelog rendering behavior.
    status: completed
isProject: false
---

# Add Sidebar Changelog Entry

## Goal

Implement a bottom-sidebar info action (above logout/login) that navigates to a dedicated changelog page rendering the repo changelog markdown.

## Planned changes

- Update sidebar footer UI in `[Dashboard/client/src/components/layout/AppSidebar.tsx](Dashboard/client/src/components/layout/AppSidebar.tsx)` to add a new `SidebarMenuItem` before the existing auth item.
  - Use Lucide `Info` icon (same visual as your provided SVG).
  - Use `SidebarMenuButton asChild` + `Link` pattern already used in sidebar.
  - Route target default: `/changelog`.
  - Active state based on `usePathname()` for consistent sidebar highlighting.
- Add a new App Router page at `[Dashboard/client/src/app/changelog/page.tsx](Dashboard/client/src/app/changelog/page.tsx)`.
  - Server component reads markdown from repo root file `../CHANGELOG.md` (relative to `client`).
  - Render inside a centered content container with Tailwind typography (`prose`), tuned for readability (headings, spacing, list rhythm, max width).
  - Include graceful fallback UI if file read fails.
- Add markdown rendering dependency in `[Dashboard/client/package.json](Dashboard/client/package.json)`.
  - Use `react-markdown` + `remark-gfm` so existing changelog formatting (lists, links, headings) renders correctly.
- If needed, add minimal style support in `[Dashboard/client/src/app/globals.css](Dashboard/client/src/app/globals.css)` for changelog prose consistency with the app’s design tokens.

## UX decisions

- Keep this icon in the footer block so it is spatially grouped with app-level actions, matching your “above logout” requirement.
- Keep icon-only affordance with tooltip label `Changelog` to match current sidebar language and density.
- Preserve existing logout/login behavior and only insert the new action above it.

## Validation plan

- Run client lint/build checks to confirm no type or lint regressions.
- Manually verify:
  - Sidebar shows `Info` icon above logout/login.
  - Clicking icon navigates to `/changelog`.
  - Changelog markdown renders with readable formatting and working links.
  - Active icon state appears when on `/changelog`.
  - Login route still hides sidebar as before.

