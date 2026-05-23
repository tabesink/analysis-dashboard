# API and UI Contract: Inspect Damage

## Route

```http
POST /api/v1/damage/inspect
```

## Purpose

Return table-ready per-event/per-channel damage values for the new `/inspect-damage` page.

The endpoint computes damage server-side using raw RSP channel data.

It does not return raw time-series arrays to the browser.

---

# Request contract

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

## Field notes

| Field | Meaning |
|---|---|
| `program_ids` | Optional filter when selecting a program/programs. |
| `versions` | Optional version filter. |
| `event_ids` | Optional explicit event selection. If provided, use these directly. |
| `channel_keys` | Required channels to calculate. UI should default to 21 selected channels. |
| `limit` | Page size. |
| `offset` | Pagination offset. |
| `damage_settings` | Rainflow/binning settings. |

## Validation rules

- `channel_keys` must not be empty.
- `limit` must obey existing application limits.
- If `event_ids` are provided, use those events.
- If `event_ids` are not provided, resolve events through existing program/version/filter query logic.
- Invalid channels should return per-cell status, not fail the whole request.

---

# Response contract

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

## Response field notes

| Field | Meaning |
|---|---|
| `rows` | Table rows. |
| `channels` | Channel columns in the order the UI should render them. |
| `total` | Total event count for pagination. |
| `damage_by_channel` | Damage value by channel; value can be null. |
| `status_by_channel` | Per-cell status. |
| `error_by_channel` | Per-cell error message if status is not `ok`. |

---

# UI page contract

## Route

```text
/inspect-damage
```

## Layout

The page should use the existing main app layout.

Suggested structure:

```text
Inspect Damage
├── toolbar/filter area
│   ├── Program selector
│   ├── Version selector
│   ├── Channel selector
│   └── Refresh/Recalculate button
└── damage table
    ├── Job Id
    ├── Work Order
    ├── Program ID
    ├── Ch01
    ├── Ch02
    ├── ...
    └── Ch21
```

## Table behavior

- Preserve visual parity with existing database/event table.
- Use horizontal scrolling if 21 channel columns exceed available width.
- Use compact numeric formatting.
- Use tooltips for full precision and error messages.
- Use tabular numerals for readability.
- Keep columns thin but readable.

## Channel selection defaults

Initial v1 behavior:

- Load channel map for selected program/version.
- Choose first 21 damage-eligible channels.
- Allow user to adjust channel selection later if existing UI patterns support it.

If channel map has fewer than 21 channels, show available channels only.

## Cell formatting

Recommended function:

```ts
export function formatDamageCell(value: number | null, status: string): string {
  if (status === 'error') return 'ERR'
  if (status === 'invalid') return '-'
  if (value === null || value === undefined) return '-'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs < 0.001) return value.toExponential(0)
  if (abs < 1) return value.toPrecision(2)
  if (abs < 100) return value.toFixed(1)
  return value.toFixed(0)
}
```

## Cell styling

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

## Error handling

The page should handle:

| Case | UI behavior |
|---|---|
| No events selected | Empty state. |
| Channel missing | Cell shows `-`; tooltip explains. |
| Calculation error | Cell shows `ERR`; tooltip shows error. |
| API error | Page-level error banner. |
| Long calculation | Loading state; disable refresh button. |

---

# Backend orchestration pseudocode

```python
@router.post("/inspect", response_model=DamageInspectResponse)
def inspect_damage(request: DamageInspectRequest, query_service: QueryServiceDep):
    event_rows = query_service.resolve_damage_events(
        program_ids=request.program_ids,
        versions=request.versions,
        event_ids=request.event_ids,
        limit=request.limit,
        offset=request.offset,
    )

    series_rows = query_service.get_raw_channel_series(
        event_ids=[row["event_id"] for row in event_rows],
        channel_keys=request.channel_keys,
    )

    calculator = FatigueDamageCalculator(settings=to_damage_settings(request.damage_settings))

    results = calculator.calculate_many([
        ChannelSeries(
            event_id=row["event_id"],
            channel_key=row["channel_key"],
            values=row["values"],
        )
        for row in series_rows
    ])

    grouped = group_results_by_event(results)

    return DamageInspectResponse(
        rows=build_rows(event_rows, request.channel_keys, grouped),
        channels=request.channel_keys,
        total=query_service.count_damage_events(...),
    )
```

---

# API route naming options

Recommended:

```text
POST /api/v1/damage/inspect
```

Acceptable alternatives:

```text
POST /api/v1/dashboard/damage/inspect
POST /api/v1/events/damage
```

Avoid:

```text
GET /api/v1/damage
```

Reason: request payload may include many event IDs and channel keys. POST avoids URL length issues.

