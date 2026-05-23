# Server Module Design: `fatigue_damage.py`

## Purpose

`server/services/fatigue_damage.py` converts a numeric channel time series into a scalar fatigue damage value.

The module should be the only place where the notebook's fatigue calculation logic lives.

## Boundary rules

This module is pure calculation code.

It must not know about:

- FastAPI routes
- database sessions
- storage tables
- React routes
- table column names
- Dashboard UI state

It should only know about:

- numeric channel time series
- fatigue settings
- SN curve settings
- calculation result shape

## Proposed public API

```python
calculator = FatigueDamageCalculator(settings)
result = calculator.calculate_channel_damage(channel_series)
results = calculator.calculate_many(channel_series_list)
```

## Data classes

### `SNCurveConfig`

Represents SN curve parameters.

Suggested fields:

```python
@dataclass(frozen=True)
class SNCurveConfig:
    slopes: tuple[float, ...] = (3, 5)
    intercepts: tuple[float, ...] = (12.592, 16.320)
    norm: str = "DNVGL-RP-C203/2016"
    environment: str = "Air"
    curve: str = "C"
```

Keep defaults aligned with the notebook initially. Later, expose these as configurable engineering settings only after validating with users.

### `DamageSettings`

Represents rainflow/cycle-counting and SN curve settings.

```python
@dataclass(frozen=True)
class DamageSettings:
    mean_bin_width: float = 100.0
    range_bin_width: float = 100.0
    min_points: int = 3
    sn_curve: SNCurveConfig = field(default_factory=SNCurveConfig)
```

### `ChannelSeries`

One event/channel signal.

```python
@dataclass(frozen=True)
class ChannelSeries:
    event_id: str
    channel_key: str
    values: Sequence[float]
```

### `ChannelDamageResult`

One event/channel result.

```python
@dataclass(frozen=True)
class ChannelDamageResult:
    event_id: str
    channel_key: str
    damage: float | None
    cycle_count: int | None
    status: str
    error: str | None = None
```

Recommended statuses:

| Status | Meaning |
|---|---|
| `ok` | Damage was calculated. |
| `invalid` | Signal was missing, empty, or too short. |
| `error` | Unexpected calculation error occurred. |

## Calculation flow

```text
values
  -> convert to numpy array
  -> remove NaN/Inf
  -> verify minimum length
  -> time = np.arange(len(values))
  -> CycleCount.from_timeseries(time=time, data=values, ...)
  -> pf.damage.stress_life.get_pm(cycle_count=..., sn_curve=...)
  -> damage = sum(damage_values)
  -> return ChannelDamageResult
```

## Error handling policy

The calculator should not throw for normal bad data.

Bad data should produce:

```python
ChannelDamageResult(
    event_id="...",
    channel_key="...",
    damage=None,
    cycle_count=None,
    status="invalid",
    error="Not enough numeric samples",
)
```

Unexpected library or numeric errors should produce status `error` for that one channel. They should not fail the entire page.

## Why result object instead of raw float?

A raw float cannot express:

- missing channel
- invalid signal
- library error
- cycle count metadata
- future warnings

A small result dataclass keeps the UI and API honest.

## Units and scaling

The notebook treats the selected signal as the stress-like input to `py_fatigue`.

Before production use, confirm whether each channel in the RSP database is:

- already stress-like,
- force/moment history requiring conversion,
- scaled by channel map factors,
- in engineering units expected by the SN curve.

For v1, preserve the notebook assumption: the selected channel signal is used directly as the fatigue input.

If later channels are loads rather than stresses, add a separate explicit transformation layer before the fatigue module:

```text
raw load channel
  -> optional scaling/calibration/influence factor
  -> stress-equivalent signal
  -> fatigue_damage.py
```

Do not hide this conversion inside `FatigueDamageCalculator` without naming it clearly.

## Suggested module skeleton

See:

```text
reference/fatigue_damage_skeleton.py
```

