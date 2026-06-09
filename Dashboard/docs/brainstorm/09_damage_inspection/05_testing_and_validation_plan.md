# Testing and Validation Plan: Inspect Damage

## Philosophy

Test the fatigue calculation separately from the API and UI.

The most important risk is silent numerical misuse, especially computing damage from downsampled plot data or incorrectly scaled channel values.

---

# 1. Unit tests for `fatigue_damage.py`

## Test: numeric signal returns damage

```python
def test_calculate_channel_damage_returns_finite_damage():
    calculator = FatigueDamageCalculator(DamageSettings())
    result = calculator.calculate_channel_damage(
        ChannelSeries(
            event_id="E1",
            channel_key="ch_01",
            values=[0, 100, -100, 100, -100, 0],
        )
    )

    assert result.status == "ok"
    assert result.damage is not None
    assert math.isfinite(result.damage)
```

## Test: empty signal does not crash

```python
def test_empty_signal_is_invalid():
    calculator = FatigueDamageCalculator(DamageSettings())
    result = calculator.calculate_channel_damage(
        ChannelSeries(event_id="E1", channel_key="ch_01", values=[])
    )

    assert result.status == "invalid"
    assert result.damage is None
    assert result.error
```

## Test: non-finite values are cleaned

```python
def test_nan_and_inf_values_are_removed():
    calculator = FatigueDamageCalculator(DamageSettings())
    result = calculator.calculate_channel_damage(
        ChannelSeries(
            event_id="E1",
            channel_key="ch_01",
            values=[0, 100, float("nan"), -100, float("inf"), 0],
        )
    )

    assert result.status in {"ok", "invalid"}
```

## Test: deterministic result

```python
def test_damage_is_deterministic_for_same_signal_and_settings():
    calculator = FatigueDamageCalculator(DamageSettings())
    series = ChannelSeries(
        event_id="E1",
        channel_key="ch_01",
        values=[0, 100, -100, 100, -100, 0],
    )

    a = calculator.calculate_channel_damage(series)
    b = calculator.calculate_channel_damage(series)

    assert a.status == b.status
    assert a.damage == pytest.approx(b.damage)
```

---

# 2. Query tests for raw data access

## Purpose

Confirm that the new query method returns full raw channel arrays, not downsampled plot points.

## Test idea

Seed one event/channel with a known signal length of 10,000 samples.

Call:

```python
get_raw_channel_series(event_ids=["E1"], channel_keys=["ch_01"])
```

Expected:

- returned values length is 10,000
- values match original data
- response is keyed by `event_id` and `channel_key`

## Negative test

Request a missing channel.

Expected:

- no unhandled exception
- route can represent missing channel as invalid cell

---

# 3. API tests

## Test: response shape

Call:

```http
POST /api/v1/damage/inspect
```

With:

```json
{
  "event_ids": ["E1"],
  "channel_keys": ["ch_01", "ch_02"],
  "limit": 10,
  "offset": 0,
  "damage_settings": {
    "mean_bin_width": 100.0,
    "range_bin_width": 100.0
  }
}
```

Expected:

```json
{
  "rows": [
    {
      "event_id": "E1",
      "damage_by_channel": {
        "ch_01": 0.123,
        "ch_02": null
      },
      "status_by_channel": {
        "ch_01": "ok",
        "ch_02": "invalid"
      }
    }
  ],
  "channels": ["ch_01", "ch_02"],
  "total": 1
}
```

## Test: no raw signal in response

Assert response does not include:

- `values`
- `points`
- `time`
- large raw arrays

## Test: partial failure

One channel valid, one channel invalid.

Expected:

- HTTP 200
- valid channel has value
- invalid channel has status `invalid`
- entire row does not fail

---

# 4. UI tests

## Component test: formatting

Test `formatDamageCell`:

| Input | Status | Expected |
|---:|---|---|
| `null` | `invalid` | `-` |
| `null` | `error` | `ERR` |
| `0` | `ok` | `0` |
| `0.00042` | `ok` | scientific/compact |
| `4.2` | `ok` | compact decimal |

## Component test: table columns

Given channels:

```ts
['ch_01', 'ch_02', 'ch_03']
```

Expected columns:

```text
Job Id | Work Order | Program ID | ch_01 | ch_02 | ch_03
```

## Page test: loading and error states

- Shows loading indicator while fetching.
- Shows empty state if no rows.
- Shows error banner on API failure.

---

# 5. Engineering validation checks

These are not purely software tests but should be done before trusting the output.

## Check 1: reproduce notebook value

Use one known signal from the notebook or a fixture extracted from it.

Expected:

- `fatigue_damage.py` produces the same summed damage as the notebook for the same settings.

## Check 2: raw vs downsampled difference

For one high-frequency or peaky signal:

1. Calculate damage from full raw data.
2. Calculate damage from downsampled plot data.
3. Compare.

Expected:

- Values may differ.
- This demonstrates why raw data must be used.

## Check 3: unit/scaling sanity

For selected channels, confirm:

- what physical quantity the channel represents,
- units,
- whether scale factors are applied,
- whether the SN curve assumes stress units.

Do not silently mix load units and stress SN curves.

---

# 6. Performance checks

Initial target:

- 100 events × 21 channels should return in acceptable time for local network usage.

If slow:

1. Add calculator-level profiling.
2. Add server cache.
3. Add batch limits.
4. Consider background jobs only after proving compute-on-read is insufficient.

---

# 7. Regression checklist

Before merging:

- Existing dashboard table still works.
- Existing plot-data endpoints still work.
- Existing channel-map editor still works.
- Existing upload/ingestion flow still works.
- New damage route is registered.
- New client route loads.
- No raw arrays are accidentally sent to browser in damage response.
- Damage calculation never uses LTTB/downsampled plot endpoint.

