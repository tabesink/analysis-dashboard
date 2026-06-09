# Inspect Damage Design Package

This consolidated document combines the key design decisions and implementation notes for adding per-channel fatigue damage inspection to the Dashboard app.

## 1. Target Feature

Create a new client route:

```text
/inspect-damage
```

The page should live inside the existing main layout and visually mirror the existing database/event table.

Target table columns:

```text
Job Id | Work Order | Program ID | Ch01 | Ch02 | ... | Ch21
```

Each event/channel cell displays the calculated fatigue damage value.

## 2. Core Calculation Flow From Notebook

The notebook demonstrates the reusable calculation pattern:

1. Select a numeric time series.
2. Build `time = np.arange(len(signal))`.
3. Create `py_fatigue.CycleCount.from_timeseries(...)`.
4. Use `mean_bin_width=100.0` and `range_bin_width=100.0` initially.
5. Define an SN curve.
6. Calculate damage using `pf.damage.stress_life.get_pm(...)`.
7. Sum the returned damage values.

This logic should be moved into a pure Python module.

## 3. Main Architecture Decision

Do not paste notebook code into a FastAPI route.

Implement this vertical slice:

```text
server/services/fatigue_damage.py   # pure calculation
server/models/damage.py             # request/response schemas
server/routers/damage.py            # thin orchestration route
client/src/features/damage/*        # API wrapper and table
client/src/app/inspect-damage       # page route
```

## 4. Critical Rule

Use full raw RSP channel data from the database.

Do not compute fatigue damage from existing plot-data endpoints or any LTTB/downsampled data.

Reason: fatigue damage depends on cycle amplitudes and peak/valley preservation. Visualization data may remove damaging peaks.

## 5. Proposed Pure Module

```text
server/services/fatigue_damage.py
```

Required objects:

- `SNCurveConfig`
- `DamageSettings`
- `ChannelSeries`
- `ChannelDamageResult`
- `FatigueDamageCalculator`

Public methods:

```python
calculate_channel_damage(series: ChannelSeries) -> ChannelDamageResult
calculate_many(series_list: Sequence[ChannelSeries]) -> list[ChannelDamageResult]
```

The module should not import FastAPI, database code, or client/UI code.

## 6. Proposed API

```http
POST /api/v1/damage/inspect
```

Request:

```json
{
  "program_ids": ["P123"],
  "versions": ["v35"],
  "event_ids": [],
  "channel_keys": ["ch_01", "ch_02", "ch_03"],
  "limit": 100,
  "offset": 0,
  "damage_settings": {
    "mean_bin_width": 100.0,
    "range_bin_width": 100.0
  }
}
```

Response:

```json
{
  "rows": [
    {
      "job_id": "J001",
      "work_order": "WO-123",
      "program_id": "P123",
      "version": "v35",
      "event_id": "E001",
      "damage_by_channel": {
        "ch_01": 0.0021,
        "ch_02": 0.0,
        "ch_03": 1.4235
      },
      "status_by_channel": {
        "ch_01": "ok",
        "ch_02": "ok",
        "ch_03": "ok"
      },
      "error_by_channel": {
        "ch_01": null,
        "ch_02": null,
        "ch_03": null
      }
    }
  ],
  "channels": ["ch_01", "ch_02", "ch_03"],
  "total": 1200
}
```

## 7. Implementation Steps

1. Add `server/services/fatigue_damage.py`.
2. Add `tests/server/services/test_fatigue_damage.py`.
3. Add `QueryService.get_raw_channel_series(...)` or equivalent.
4. Add `server/models/damage.py`.
5. Add `server/routers/damage.py`.
6. Register route.
7. Add `client/src/features/damage/damageApi.ts`.
8. Add `client/src/features/damage/DamageInspectTable.tsx`.
9. Add `client/src/app/inspect-damage/page.tsx`.
10. Add optional cache after baseline works.

## 8. What Not To Do

- Do not calculate damage in React.
- Do not send full raw arrays to the browser.
- Do not use plot/downsampled data.
- Do not introduce background jobs in v1.
- Do not add a permanent damage results table in v1.
- Do not hard-code 21 channels inside the calculation module.
- Do not refactor unrelated dashboard routes.

## 9. Testing Priorities

Unit tests:

- valid signal returns finite damage,
- empty signal returns invalid result,
- NaN/Inf are handled,
- output is deterministic.

API tests:

- response shape is correct,
- per-channel errors do not fail whole request,
- response does not include raw arrays.

UI tests:

- table renders metadata columns,
- table renders selected channel columns,
- compact damage formatting works,
- loading/error/empty states work.

Engineering checks:

- reproduce notebook value for a known fixture,
- compare raw vs downsampled damage to prove why raw is needed,
- confirm units and scaling.

## 10. Future Extension

Only add a persisted damage run model if users need:

- audit trail,
- export history,
- comparing damage configurations,
- approval/signoff workflow,
- repeated heavy computation across large event sets.

Possible future schema:

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

