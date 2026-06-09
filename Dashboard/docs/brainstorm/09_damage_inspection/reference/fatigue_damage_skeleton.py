"""Pure fatigue damage calculation utilities.

This module is intentionally independent of FastAPI, database access,
and client/UI concerns.

It converts one or more numeric channel time series into fatigue damage
results using py_fatigue.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

import numpy as np
import py_fatigue as pf


@dataclass(frozen=True)
class SNCurveConfig:
    """SN curve settings used by py_fatigue.

    Defaults should initially match the notebook. Before production use,
    confirm these are correct for the engineering use case and channel units.
    """

    slopes: tuple[float, ...] = (3.0, 5.0)
    intercepts: tuple[float, ...] = (12.592, 16.320)
    norm: str = "DNVGL-RP-C203/2016"
    environment: str = "Air"
    curve: str = "C"


@dataclass(frozen=True)
class DamageSettings:
    """Rainflow/cycle-counting settings."""

    mean_bin_width: float = 100.0
    range_bin_width: float = 100.0
    min_points: int = 3
    sn_curve: SNCurveConfig = field(default_factory=SNCurveConfig)


@dataclass(frozen=True)
class ChannelSeries:
    """One event/channel time series."""

    event_id: str
    channel_key: str
    values: Sequence[float]


@dataclass(frozen=True)
class ChannelDamageResult:
    """Damage result for one event/channel cell."""

    event_id: str
    channel_key: str
    damage: float | None
    cycle_count: int | None
    status: str
    error: str | None = None


class FatigueDamageCalculator:
    """Calculate fatigue damage for raw channel series."""

    def __init__(self, settings: DamageSettings | None = None) -> None:
        self.settings = settings or DamageSettings()
        self.sn_curve = self._build_sn_curve(self.settings.sn_curve)

    def calculate_channel_damage(self, series: ChannelSeries) -> ChannelDamageResult:
        """Calculate fatigue damage for one event/channel series.

        Normal bad data returns a structured invalid/error result instead of
        crashing the full damage inspection request.
        """

        try:
            values = self._clean_signal(series.values)

            if len(values) < self.settings.min_points:
                return ChannelDamageResult(
                    event_id=series.event_id,
                    channel_key=series.channel_key,
                    damage=None,
                    cycle_count=None,
                    status="invalid",
                    error="Not enough numeric samples",
                )

            time = np.arange(len(values))

            cycle_count = pf.CycleCount.from_timeseries(
                time=time,
                data=values,
                mean_bin_width=self.settings.mean_bin_width,
                range_bin_width=self.settings.range_bin_width,
            )

            damage_values = pf.damage.stress_life.get_pm(
                cycle_count=cycle_count,
                sn_curve=self.sn_curve,
            )

            return ChannelDamageResult(
                event_id=series.event_id,
                channel_key=series.channel_key,
                damage=float(np.sum(damage_values)),
                cycle_count=self._safe_cycle_count(cycle_count),
                status="ok",
                error=None,
            )

        except Exception as exc:  # Keep one bad channel from failing the whole table.
            return ChannelDamageResult(
                event_id=series.event_id,
                channel_key=series.channel_key,
                damage=None,
                cycle_count=None,
                status="error",
                error=str(exc),
            )

    def calculate_many(self, series_list: Sequence[ChannelSeries]) -> list[ChannelDamageResult]:
        """Calculate damage for many event/channel series."""

        return [self.calculate_channel_damage(series) for series in series_list]

    @staticmethod
    def _clean_signal(values: Sequence[float]) -> np.ndarray:
        """Convert to finite float numpy array."""

        arr = np.asarray(values, dtype=float)
        return arr[np.isfinite(arr)]

    @staticmethod
    def _build_sn_curve(config: SNCurveConfig):
        """Build py_fatigue SN curve object."""

        return pf.SNCurve(
            list(config.slopes),
            intercept=list(config.intercepts),
            norm=config.norm,
            environment=config.environment,
            curve=config.curve,
        )

    @staticmethod
    def _safe_cycle_count(cycle_count) -> int | None:
        """Extract an approximate total cycle count if available."""

        try:
            return int(np.sum(cycle_count.count_cycle))
        except Exception:
            return None

