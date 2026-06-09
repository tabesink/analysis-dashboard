# ADR: Lightweight Per-Channel Damage Inspection Integration

## Status

Proposed for implementation.

## Context

The current notebook demonstrates the calculation flow for fatigue damage using `py_fatigue`:

1. Load or select a numeric time-series signal.
2. Build a synthetic time axis using `np.arange(len(signal))`.
3. Create a `py_fatigue.CycleCount` object using `CycleCount.from_timeseries(...)`.
4. Define an SN curve.
5. Calculate Palmgren-Miner damage using `pf.damage.stress_life.get_pm(...)`.
6. Sum the returned damage values.

The application goal is to make this available inside the Dashboard app as a new `Inspect Damage` page.

The desired UI is a table that visually mirrors the existing database/event table but adds 21 thin channel columns. Each row represents one event. Each channel cell displays the calculated damage for that event/channel.

## Decision

Implement damage inspection as a small vertical slice:

```text
server/services/fatigue_damage.py
server/models/damage.py
server/routers/damage.py
client/src/features/damage/*
client/src/app/inspect-damage/page.tsx
```

The fatigue calculation must live in a pure Python module.

The API route should orchestrate:

1. Validate request.
2. Fetch event metadata.
3. Fetch full raw channel series.
4. Call the pure calculator.
5. Return rows shaped for the table.

The client should not receive raw time-series data. It should only receive metadata and damage values.

## Non-goals for v1

Do not implement these in v1:

- Full background job system for damage calculation.
- Permanent `damage_results` table.
- Full damage-run history/audit UI.
- Client-side fatigue calculation.
- Global refactor of existing dashboard routes.
- Replacing existing plot-data endpoints.
- Computing damage from downsampled plot data.

## Why this is the lowest-entropy approach

### 1. Pure calculation module is easy to test

The notebook logic becomes deterministic, callable, and unit-testable without spinning up FastAPI or the database.

### 2. FastAPI route stays thin

The route should only coordinate data access and response shaping. It should not contain calculation math.

### 3. UI stays simple

The React page only renders a table. It does not understand rainflow counting, SN curves, or database schema details.

### 4. No premature persistence

For inspection, compute-on-read is sufficient initially. A persisted `damage_results` table can be added later if users need audit trails, exports, or repeated comparison of saved damage runs.

## Recommended v1 architecture

```text
Dashboard/
  server/
    services/
      fatigue_damage.py          # pure calculation module
      query.py                   # add raw-series fetch method
    models/
      damage.py                  # request/response schemas
    routers/
      damage.py                  # POST /api/v1/damage/inspect

  client/
    src/
      app/
        inspect-damage/
          page.tsx
      features/
        damage/
          damageApi.ts
          DamageInspectTable.tsx
          damageFormatting.ts
```

## Main data flow

```text
User selects program/version/filter/channel set
        |
        v
Client calls POST /api/v1/damage/inspect
        |
        v
Route resolves event rows + raw channel series
        |
        v
FatigueDamageCalculator calculates damage per channel
        |
        v
Route returns table-ready rows
        |
        v
Client renders Job Id | Work Order | Program ID | Ch01 ... Ch21
```

## Important engineering rule

The raw time series used for rainflow counting must come from the canonical stored RSP data, not from visualization endpoints.

Plot endpoints often downsample data to keep rendering fast. That is valid for visualization but unsafe for fatigue damage because fatigue damage depends on cycle amplitudes and peak/valley content.

## Future decision: persisted damage runs

Add persistent damage runs only when one of these becomes true:

| Trigger | Add persistence? |
|---|---:|
| Users only need quick inspection | No |
| Users need CSV export of current view | Maybe, but export can be on demand |
| Users need repeatable audit records | Yes |
| Users need compare run A vs run B | Yes |
| Damage calculation becomes slow for normal filtering | Maybe, first try cache |
| Users need approval/signoff workflow | Yes |

## Recommended later schema, if needed

Only if persisted runs become necessary:

```text
damage_runs
  id
  created_at
  created_by
  program_id
  version
  settings_json
  status

damage_results
  id
  run_id
  event_id
  channel_key
  damage
  cycle_count
  status
  error
```

Do not add this schema in v1 unless performance or audit requirements are already confirmed.

