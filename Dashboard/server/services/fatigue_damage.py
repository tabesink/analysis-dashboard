"""Fatigue damage calculation using the notebook-defined method."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

import numpy as np
import py_fatigue as pf


@dataclass(frozen=True)
class FatigueDamageSettings:
    """Notebook fatigue constants promoted to explicit settings."""

    mean_bin_width: float = 100.0
    range_bin_width: float = 100.0
    sn_slopes: tuple[int, int] = (3, 5)
    sn_intercepts: tuple[float, float] = (12.592, 16.320)
    sn_norm: str = "DNVGL-RP-C203/2016"
    sn_environment: str = "Air"
    sn_curve: str = "C"
    min_points: int = 3


@dataclass(frozen=True)
class ChannelSeries:
    """Full-resolution time series for one fatigue channel."""

    channel_key: str
    channel_name: str
    unit: str | None
    values: Iterable[float]


@dataclass(frozen=True)
class ChannelDamageResult:
    """Damage result for one channel in one event."""

    channel_key: str
    channel_name: str
    unit: str | None
    damage: float | None
    status: str
    error: str | None = None


class FatigueDamageCalculator:
    """Calculate Palmgren-Miner damage using the notebook's py-fatigue flow."""

    def __init__(self, settings: FatigueDamageSettings | None = None) -> None:
        self.settings = settings or FatigueDamageSettings()
        self._sn_curve = pf.SNCurve(
            list(self.settings.sn_slopes),
            intercept=list(self.settings.sn_intercepts),
            norm=self.settings.sn_norm,
            environment=self.settings.sn_environment,
            curve=self.settings.sn_curve,
        )

    def calculate_channel(self, series: ChannelSeries) -> ChannelDamageResult:
        values = np.asarray(list(series.values), dtype=float)
        finite_values = values[np.isfinite(values)]

        if finite_values.size < self.settings.min_points:
            return ChannelDamageResult(
                channel_key=series.channel_key,
                channel_name=series.channel_name,
                unit=series.unit,
                damage=None,
                status="invalid",
                error=f"Need at least {self.settings.min_points} finite samples",
            )

        try:
            time = np.arange(finite_values.size, dtype=float)
            cycle_count = pf.CycleCount.from_timeseries(
                finite_values,
                time=time,
                mean_bin_width=self.settings.mean_bin_width,
                range_bin_width=self.settings.range_bin_width,
            )
            damage = pf.damage.stress_life.get_pm(
                cycle_count=cycle_count,
                sn_curve=self._sn_curve,
            )
            return ChannelDamageResult(
                channel_key=series.channel_key,
                channel_name=series.channel_name,
                unit=series.unit,
                damage=float(sum(damage)),
                status="ok",
            )
        except Exception as exc:
            return ChannelDamageResult(
                channel_key=series.channel_key,
                channel_name=series.channel_name,
                unit=series.unit,
                damage=None,
                status="error",
                error=str(exc),
            )
