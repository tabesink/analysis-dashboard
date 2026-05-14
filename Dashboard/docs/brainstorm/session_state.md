# Session State Reference

Last updated: 2026-04-14

## 1) Purpose and scope

This document maps the session/state surfaces that drive dashboard behavior, with special focus on:
- what persists vs resets
- UX continuity when switching `grid` <-> `interactive`
- color state behavior
- plot-axis state coverage and gaps for interactive layout continuity

This doc distinguishes:
- **Documented intent** from `docs/*`
- **Observed implementation** from `client/src/*` stores/hooks/components
- **Confirmed gaps/risks** where expected persistence or UX continuity is missing

## 2) State/store catalog

### Server-side persisted state (DuckDB)

- **`sessions`** (`docs/database-schema.txt`)
  - Session identity and user scoping: `session_id`, `user_id`
  - Unified selection: `data_state`
  - Filters: `global_filters`
  - Render continuity: `rendered_event_ids`
  - UI preferences: `ui_preferences`
  - Expiration lifecycle: `expires_at`
- **`saved_filters`** (`docs/database-schema.txt`)
  - Persisted user presets with `data_state` + `global_filters`
- **`user_preferences`** (`docs/database-schema.txt`)
  - Layout and personalization fields: `grid_columns`, `grid_layout_order`, `theme`, baseline defaults
- **`upload_tasks`** (`docs/database-schema.txt`, `docs/decisions/log.md` DEC-022)
  - Creator-scoped persisted progress state for long-running CSV ingest UX

### Client-side state (Zustand + hooks)

- **`useSession` + `session-sync`** (`client/src/hooks/use-session.ts`, `client/src/lib/session/session-sync.ts`)
  - Session ID in `localStorage`
  - Session backup snapshot in `sessionStorage`
  - Debounced server sync + optimistic cache-first updates
- **`ui-store`** (`client/src/stores/ui-store.ts`)
  - `activeTab`, `curveVisibility`, side panel collapsed state, color legend panel dock/float state
  - Explicitly documented as ephemeral and resets on refresh
- **`render-store`** (`client/src/stores/render-store.ts`)
  - render lifecycle (`isRendering`), selected plot, in-memory cached plots, color revision checkpoint
  - documents that `rendered_event_ids` persistence belongs to server session, not this store
- **`color-selection-store`** (`client/src/stores/color-selection-store.ts`)
  - Color mode, per-program/version/event colors, per-event overrides, filter-coloring controls
  - Persisted via Zustand `persist` to `localStorage`
- **`plot-settings-store`** (`client/src/stores/plot-settings-store.ts`)
  - Per-plot axis sync toggle (`syncState`) only
  - No persisted min/max domain or zoom/pan state
- **`pinned-events-store`** (`client/src/stores/pinned-events-store.ts`)
  - Uses `sessionStorage` middleware but explicitly clears pinned state on rehydrate (effectively ephemeral across refresh)
- **`auth-store`** (`client/src/stores/auth-store.ts`)
  - Runtime auth status and user profile in memory

## 3) Persistence matrix

| State surface | Primary location | Persistence mechanism | Survives tab switch | Survives refresh | Notes |
|---|---|---|---|---|---|
| Session selection/filter/rendered IDs | `sessions` table + React Query cache | Server session + debounced sync | Yes | Yes (session restore path) | Includes `data_state`, `global_filters`, `rendered_event_ids` |
| Session backup | Browser `sessionStorage` | `session-sync.ts` periodic backup | N/A | Yes (same tab/window session) | Best-effort backup used during session create/load |
| Session ID | Browser `localStorage` | `SESSION_ID_KEY` | N/A | Yes | Enables session lookup after restart |
| UI tab + panel chrome | `ui-store` | In-memory Zustand | Yes | No | Store header says resets on refresh |
| Plot cache / render runtime | `render-store` | In-memory Zustand | Yes | No | Cached plots survive tab switches only |
| Color settings/overrides | `color-selection-store` | Zustand `persist` to `localStorage` | Yes | Yes | `partialize` persists user-meaningful color fields |
| Pinned events | `pinned-events-store` | `sessionStorage` + forced clear on rehydrate | Yes | No (cleared intentionally) | Middleware present, but lifecycle is ephemeral by design |
| Axis sync toggles | `plot-settings-store` | In-memory Zustand | Yes | No | Defaults to synced when undefined |
| User preference records | `user_preferences` table | Server DB | Yes | Yes | Includes `theme`, `grid_layout_order`, `grid_columns` |

## 4) Layout/tab switching UX behavior

### Documented intent

- PRD defines two primary render contexts: grid and interactive (`docs/prd.md`).
- Session persistence is intended for state continuity (server-synced + sessionStorage backup).
- DEC-020 captures continuity fix for interactive fallback to rendered events when selection is empty.

### Observed implementation

- `activeTab` is kept in `ui-store` and changed through `setActiveTab` (`client/src/app/dashboard/page.tsx`).
- `gridColumns` is local component state in dashboard page (`useState`), not a shared persisted client store.
- `render-store.cachedPlots` is explicitly intended to survive tab switches.
- Toolbar actions create additional UX transitions beyond simple tab-switch behavior (`client/src/components/dashboard/DashboardContent.tsx`):
  - **Render in grid:** clears pinned events and clears all event override colors before starting render.
  - **Clear in interactive:** resets only curve visibility.
  - **Clear in grid:** clears rendered event IDs, selected interactive plot, curve visibility, and active render loop.

### Practical UX continuity outcomes

- Switching tabs alone is mostly continuity-preserving.
- Starting a new grid render is not neutral; it acts as a reset point for pins and event override colors.
- Full page refresh resets ephemeral UI/store surfaces (tab state, panel state, runtime plot cache, sync toggles, pins), while server session and persisted color settings are restored.

## 5) Color and theme UX behavior

### Color state handling

- Color mode and customizations are durable (`color-selection-store` persisted to `localStorage`).
- Store supports:
  - `byVersion` mode (program/version/event color maps)
  - `byFilter` mode (focus filter + shade distribution)
  - per-event override colors
  - mode-switch caching for color restoration
- Render lifecycle tracks color freshness using:
  - `colorRevision` (`color-selection-store`)
  - `lastRenderedColorRevision` (`render-store`)
  - This enables pending re-render indicators when colors change after last render.

### Theme handling

- DB schema includes per-user `theme` in `user_preferences`.
- Frontend audit and build-plan backlog still flag dark-mode completion as open (`docs/frontend-audit.md`, `docs/master-build-plan.md` BL-07).

## 6) Plot-axis state analysis (required gap section)

### What exists

- `plot-settings-store` stores only a boolean sync toggle per plot key:
  - synced -> use shared/global limits
  - unsynced -> use local limits
- DEC-018 adds grouped syncing strategy (BJ+Shock vs Bushing) for grid usability.

### What does not exist (confirmed gap)

There is **no dedicated durable axis-domain store** for user-driven axis state such as:
- zoom window
- pan offset
- manual axis min/max overrides
- per-tab/per-layout remembered axis domains

Current axis limits are data-derived at render time; axis-domain interaction state is not persisted in a dedicated store or session contract.

### Why this is a gap for interactive layout

For an interactive layout, users typically expect axis view context (zoom/pan/manual framing) to survive:
- switching between grid and interactive
- temporary navigation away and back
- refresh/session restore (at least optionally)

Today, only sync/unsync intent is modeled, not axis-domain state itself. This creates continuity risk for advanced analysis flows.

## 7) Known gaps and risks

1. **Axis-domain persistence gap (high relevance):** no store/session contract for interactive axis view state.
2. **Ephemeral layout chrome:** `activeTab`, panel geometry, grid-columns local state, and curve visibility reset on refresh.
3. **Action-coupled reset behavior:** grid render intentionally clears pins and event override colors; users may perceive this as unexpected if not surfaced in UX messaging.
4. **Theme completeness gap:** DB has `theme`, but dark-mode implementation remains partial/open.
5. **Documentation fragmentation:** persistence and continuity rules are spread across PRD, decision logs, task docs, and store comments rather than one canonical state contract.

## 8) Recommended next actions

1. Add an `axes_state` model (client store + session API payload) with clear ownership:
   - per plot key, store domain `{xMin, xMax, yMin, yMax}` and interaction metadata
2. Define lifecycle semantics explicitly:
   - survives tab switch? route switch? refresh? new render?
3. Decide interaction precedence:
   - when does data-derived domain override user domain (new selection/render)?
4. Add acceptance tests for continuity:
   - switch tab, return to same axis framing
   - refresh, confirm expected axis restore policy
5. Add a short UX note in dashboard docs:
   - call out intentional resets (grid render clears pins/overrides) and persistence boundaries
