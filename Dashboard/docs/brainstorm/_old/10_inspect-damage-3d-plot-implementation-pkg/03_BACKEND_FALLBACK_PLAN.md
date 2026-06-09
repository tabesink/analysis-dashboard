# Backend Fallback Plan

## Preferred approach

Do not add a backend route if the Inspect Damage table already has all required data.

The plot should be built from the same calculated Inspect Damage response used by the table so table/plot parity is guaranteed.

## Add a route only if required

Add this only if the current `POST /api/v1/damage/inspect` response cannot provide the selected events, versions, and calculated damage cells needed by the adapter:

```http
POST /api/v1/damage/plot-matrix
```

## Request shape

Reuse the same filters/selection already used by Inspect Damage.

```json
{
  "selected_event_ids": ["EVT-001", "EVT-002"],
  "filters": {
    "program_id": ["P001"],
    "version": ["V1"]
  },
  "include_channels": [
    "bj_x_force",
    "bj_y_force",
    "bj_z_force",
    "shock_x_force",
    "shock_y_force",
    "shock_z_force",
    "bushing_f_x_momt",
    "bushing_f_y_momt",
    "bushing_f_z_momt",
    "bushing_r_x_momt",
    "bushing_r_y_momt",
    "bushing_r_z_momt"
  ]
}
```

## Response shape

```json
{
  "versions": ["V1", "V2"],
  "channels": [
    { "key": "bj_x_force", "label": "BJ X Force", "order": 1 }
  ],
  "rows": [
    {
      "event_id": "EVT-001",
      "job_number": "J001",
      "work_order": "WO-001",
      "program_id": "P001",
      "version": "V1",
      "damages": {
        "bj_x_force": { "status": "ok", "damage": 0.012 },
        "bj_y_force": { "status": "ok", "damage": 0.009 }
      }
    }
  ],
  "warnings": []
}
```

## Backend rules

- Use existing auth dependency.
- Use Pydantic request/response models.
- Validate event IDs and filters.
- Validate allowed channel keys against a whitelist.
- Do not interpolate user input into SQL.
- Do not duplicate damage calculation logic.
- Reuse existing Inspect Damage service functions.
- Return only selected events with calculated damage rows.
- Preserve the existing `DamageCell` semantics (`status`, `damage`, `error`) if this route is ever added.

## Tests if route is added

- invalid channel key rejected
- selected event IDs respected
- version list derived correctly
- response rows include `job_number`, `version`, and `damages[channelKey]`
- unauthorized requests rejected
