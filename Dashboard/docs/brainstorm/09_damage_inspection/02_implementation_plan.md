# Implementation Plan: Inspect Damage Vertical Slice

## Goal

Implement a clean, lightweight path from raw RSP channel data in the database to per-event/per-channel damage values displayed in a new client route called `/inspect-damage`.

## Summary

Implement in this order:

1. Add pure calculation module.
2. Add tests for the module.
3. Add raw channel series query method.
4. Add server schemas.
5. Add API route.
6. Add client API wrapper.
7. Add inspect damage page and table.
8. Add optional caching.
9. Add documentation notes and regression tests.

---

# Phase 1 — Create pure calculation module

## Add file

```text
server/services/fatigue_damage.py
```

## Required objects

- `SNCurveConfig`
- `DamageSettings`
- `ChannelSeries`
- `ChannelDamageResult`
- `FatigueDamageCalculator`

## Required public methods

```python
calculate_channel_damage(series: ChannelSeries) -> ChannelDamageResult
calculate_many(series_list: Sequence[ChannelSeries]) -> list[ChannelDamageResult]
```

## Rules

The module must not import:

- FastAPI
- SQL/database adapters
- React/client code
- request/response schema classes
- app settings directly, unless passed in through configuration

The module may import:

- `numpy`
- `py_fatigue`
- standard library dataclasses/typing

## Acceptance criteria

- Given a numeric signal, returns one damage value.
- Given empty or invalid data, returns a structured invalid result instead of crashing the whole batch.
- Given multiple channels, returns a list of per-channel results.
- All settings are explicit and testable.

---

# Phase 2 — Add calculator tests

## Add file

```text
tests/server/services/test_fatigue_damage.py
```

## Tests

### Test 1: clean numeric signal

Input:

```python
[0, 100, -100, 100, -100, 0]
```

Expected:

- status is `ok`
- damage is not `None`
- damage is finite

### Test 2: invalid signal

Input:

```python
[]
```

Expected:

- status is `invalid`
- damage is `None`
- error message is populated

### Test 3: NaN handling

Input:

```python
[0, 100, float("nan"), -100, 50]
```

Expected:

- non-finite values are removed
- result is either valid or invalid depending on remaining length
- no unhandled exception

### Test 4: deterministic output

Run the same signal twice with the same settings.

Expected:

- damage values match within tolerance

---

# Phase 3 — Add raw RSP channel series query

## Add method

```text
server/services/query.py
```

Suggested method name:

```python
get_raw_channel_series(event_ids: list[str], channel_keys: list[str]) -> list[dict]
```

## Returned shape

```python
[
    {
        "event_id": "E001",
        "channel_key": "ch_01",
        "values": [0.0, 10.0, -5.0, ...],
    }
]
```

## Important

This method must return the full raw signal. It must not call the existing plot-data/downsampled visualization path.

## Implementation guidance

The coding agent should inspect the existing storage model and ingestion artifacts to determine where the full RSP channel arrays live.

Possible implementations:

1. Directly query raw stored event/channel arrays if they already exist.
2. Resolve `channel_key` to the source RSP column using the program/version channel map.
3. Load retained raw artifact rows if that is how the current app stores data.

The final implementation should be thin and local to the query/storage layer.

## Acceptance criteria

- Returns full numeric arrays for each requested event/channel.
- Preserves event/channel identity.
- Handles missing channel data gracefully.
- Does not return downsampled plot points.

---

# Phase 4 — Add server schemas

## Add file

```text
server/models/damage.py
```

## Suggested schemas

```python
class DamageSettingsRequest(BaseModel):
    mean_bin_width: float = 100.0
    range_bin_width: float = 100.0

class DamageInspectRequest(BaseModel):
    program_ids: list[str] | None = None
    versions: list[str] | None = None
    event_ids: list[str] | None = None
    channel_keys: list[str]
    limit: int = 100
    offset: int = 0
    damage_settings: DamageSettingsRequest = DamageSettingsRequest()

class DamageInspectRow(BaseModel):
    job_id: str | None = None
    work_order: str | None = None
    program_id: str
    version: str | None = None
    event_id: str
    damage_by_channel: dict[str, float | None]
    status_by_channel: dict[str, str]
    error_by_channel: dict[str, str | None] = {}

class DamageInspectResponse(BaseModel):
    rows: list[DamageInspectRow]
    channels: list[str]
    total: int
```

## Acceptance criteria

- Schemas are small.
- Request is table-oriented.
- Response is already shaped for the UI table.
- No raw time-series arrays are returned to the client.

---

# Phase 5 — Add API route

## Add file

```text
server/routers/damage.py
```

## Add route

```http
POST /api/v1/damage/inspect
```

## Route responsibilities

1. Validate request.
2. Resolve event IDs if request uses program/version filters instead of explicit event IDs.
3. Fetch event metadata for table columns.
4. Fetch raw channel series.
5. Call `FatigueDamageCalculator.calculate_many(...)`.
6. Group results by event.
7. Return table-ready rows.

## Route should not

- Implement fatigue math.
- Expose raw time-series arrays.
- Call plot-data endpoints.
- Create database tables.
- Start background jobs.

## Acceptance criteria

- Returns rows for selected events.
- Includes one value per requested channel.
- Handles per-channel errors without failing the entire request.
- Enforces existing query limits.

---

# Phase 6 — Register router

Find the existing FastAPI app setup and include the damage router with the same prefix/auth style as the existing dashboard routes.

Example:

```python
app.include_router(damage.router, prefix="/api/v1/damage", tags=["damage"])
```

Use the existing project convention rather than inventing a new one.

---

# Phase 7 — Add client API wrapper

## Add file

```text
client/src/features/damage/damageApi.ts
```

## Suggested function

```ts
export async function fetchDamageInspectRows(
  request: DamageInspectRequest,
): Promise<DamageInspectResponse> {
  return api.post('/damage/inspect', request)
}
```

Use the existing client API helper style.

---

# Phase 8 — Add client table

## Add file

```text
client/src/features/damage/DamageInspectTable.tsx
```

## Required columns

- Job Id
- Work Order
- Program ID
- 21 selected channel columns

## Display rule

Use compact numeric formatting:

| Damage value | Display |
|---:|---|
| `null` | `-` |
| error | `ERR` |
| `0` | `0` |
| `0.00042` | `4e-4` |
| `0.0421` | `0.04` |
| `4.213` | `4.21` |
| `123.4` | `123` |

## CSS idea

```css
.damage-cell {
  width: 4.5ch;
  min-width: 4.5ch;
  max-width: 4.5ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
```

## Acceptance criteria

- Maintains visual parity with existing event/database table.
- Does not introduce a totally new table design language.
- Supports horizontal scrolling if needed.
- Shows loading/error/empty states.

---

# Phase 9 — Add route page

## Add file

```text
client/src/app/inspect-damage/page.tsx
```

## Page contents

- Existing main layout.
- Existing program/version/filter controls where practical.
- Channel selection defaulting to the first 21 usable channels from channel map.
- Damage table.
- Refresh/recalculate action.

## Acceptance criteria

- Page can be opened directly at `/inspect-damage`.
- Defaults are sensible.
- User can inspect damage without knowing the notebook details.

---

# Phase 10 — Optional cache

Add this only after the route works.

## Cache key idea

```text
damage:{event_id}:{channel_key}:{settings_hash}:{raw_data_revision}
```

## Cache invalidation

Invalidate when:

- Event raw data changes.
- Channel map changes.
- Damage settings change.
- Event is deleted/purged.

## Do not overbuild

Start with in-memory/simple cache if the app already has one. Do not introduce Redis-only damage caching unless the current app already uses Redis for this kind of server cache.

---

# Phase 11 — Documentation update

Add a short doc to existing `Dashboard/docs`:

```text
docs/inspect-damage.md
```

It should explain:

- What the page does.
- What the calculation uses.
- Why raw data is required.
- What the damage number means.
- Known limitations.

