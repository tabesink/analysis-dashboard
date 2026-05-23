# Coding Agent Prompt: Implement Inspect Damage Vertical Slice

You are a senior software engineer working in the Dashboard app.

You write clean, lean, low-entropy code that junior developers can follow.

## Objective

Convert the logic from `Dashboard/notebooks/py_fatigue_cycle_counting.ipynb` into a reusable server-side Python module and wire it into the app through a new `Inspect Damage` page.

The user-facing goal:

- Add a client route called `/inspect-damage`.
- The page should live inside the existing main layout.
- The page should visually mirror the existing database/event table.
- The table columns should be:
  - `Job Id`
  - `Work Order`
  - `Program ID`
  - followed by 21 thin channel columns.
- For each event row and channel column, calculate and display fatigue damage.

## Notebook calculation to preserve

The notebook demonstrates this core flow:

1. Select a numeric time-series signal.
2. Build a time axis with `np.arange(len(signal))`.
3. Create a cycle count using `py_fatigue.CycleCount.from_timeseries(...)`.
4. Use `mean_bin_width=100.0` and `range_bin_width=100.0` initially, matching the notebook default.
5. Define an SN curve.
6. Calculate Palmgren-Miner damage using `pf.damage.stress_life.get_pm(...)`.
7. Sum the returned damage values.

## Critical rule

Do not compute damage from downsampled plot data.

Rainflow counting must use the full raw RSP channel series from the database. The existing plot-data path is for visualization and may use LTTB/downsampling. That is not acceptable for damage calculation.

## Implementation steps

### 1. Add pure calculation module

Create:

```text
server/services/fatigue_damage.py
```

Required objects:

- `SNCurveConfig`
- `DamageSettings`
- `ChannelSeries`
- `ChannelDamageResult`
- `FatigueDamageCalculator`

Required methods:

```python
calculate_channel_damage(series: ChannelSeries) -> ChannelDamageResult
calculate_many(series_list: Sequence[ChannelSeries]) -> list[ChannelDamageResult]
```

Rules:

- Do not import FastAPI.
- Do not import database code.
- Do not import UI/client code.
- Do not read app settings globally.
- Accept settings explicitly.
- Return structured per-channel status instead of throwing for normal bad data.

### 2. Add tests for calculation module

Create:

```text
tests/server/services/test_fatigue_damage.py
```

Test:

- valid signal returns finite damage,
- empty signal returns invalid result,
- NaN/Inf are handled,
- repeated calculation is deterministic.

### 3. Add raw channel series query method

In the existing query/storage layer, add a method like:

```python
get_raw_channel_series(event_ids: list[str], channel_keys: list[str]) -> list[dict]
```

Returned shape:

```python
[
    {
        "event_id": "E001",
        "channel_key": "ch_01",
        "values": [0.0, 10.0, -5.0, ...],
    }
]
```

This must read the full raw RSP channel series.

Do not call existing plot-data methods.

### 4. Add server schemas

Create:

```text
server/models/damage.py
```

Include:

- `DamageSettingsRequest`
- `DamageInspectRequest`
- `DamageInspectRow`
- `DamageInspectResponse`

The response must not include raw time-series arrays.

### 5. Add server router

Create:

```text
server/routers/damage.py
```

Add:

```http
POST /api/v1/damage/inspect
```

Route responsibilities:

1. Resolve selected events.
2. Fetch table metadata.
3. Fetch raw channel series.
4. Call `FatigueDamageCalculator`.
5. Return table-ready rows.

Route must not implement fatigue math.

### 6. Register route

Register the router in the same style as existing routers.

Prefer:

```text
/api/v1/damage/inspect
```

unless the existing route prefix convention requires a different prefix.

### 7. Add client API wrapper

Create:

```text
client/src/features/damage/damageApi.ts
```

Add typed function:

```ts
fetchDamageInspectRows(request)
```

Follow existing client API helper conventions.

### 8. Add damage table component

Create:

```text
client/src/features/damage/DamageInspectTable.tsx
```

Requirements:

- Visual parity with existing database/event table.
- Fixed metadata columns.
- 21 thin channel columns.
- Compact numeric formatting.
- Error state per cell.
- Tooltip for full precision or error message.

### 9. Add inspect damage page

Create:

```text
client/src/app/inspect-damage/page.tsx
```

Requirements:

- Uses existing main layout.
- Loads program/version/channel metadata using existing patterns.
- Defaults to first 21 damage-eligible channel keys.
- Calls damage API.
- Renders damage table.

### 10. Optional cache

Only after the route works, add caching.

Suggested key:

```text
damage:{event_id}:{channel_key}:{settings_hash}:{raw_data_revision}
```

Do not create a database table for damage results in v1 unless explicitly required.

## Acceptance criteria

Backend:

- `fatigue_damage.py` is pure and unit-tested.
- API route returns damage by event/channel.
- API route does not return raw time series.
- API route does not use downsampled plot data.
- Per-channel errors do not fail the whole request.

Frontend:

- `/inspect-damage` route exists.
- Table visually matches existing event table style.
- Shows Job Id, Work Order, Program ID, and selected channel columns.
- Damage cells are compact and readable.
- Loading/error/empty states exist.

Testing:

- Unit tests pass.
- API shape test exists.
- Existing dashboard behavior does not regress.

## What not to do

- Do not paste notebook cells directly into a FastAPI route.
- Do not calculate damage in React.
- Do not use LTTB/downsampled plot endpoints for damage.
- Do not introduce Celery/background jobs in v1.
- Do not add a `damage_results` table in v1.
- Do not refactor unrelated dashboard routes.
- Do not hard-code exactly 21 channels in the calculation module.

The UI can default to 21 channels, but the calculation module must accept any channel list.

