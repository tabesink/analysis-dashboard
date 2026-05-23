"""Inspect Damage channel mapping derived from dashboard plot channel maps."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal

Axis = Literal["x", "y"]
DamageAxis = Literal["x", "y", "z"]


@dataclass(frozen=True)
class DamageChannelSpec:
    """Canonical Inspect Damage channel backed by one channel-map axis."""

    key: str
    label: str
    plot_key: str
    axis: Axis
    channel_name: str | None
    unit: str | None
    error: str | None = None


@dataclass(frozen=True)
class DamageChannelResolution:
    """Resolved raw measurement channel for a damage spec."""

    channel_name: str | None
    error: str | None = None


@dataclass(frozen=True)
class _GroupDefinition:
    xy_plot_key: str
    xz_plot_key: str
    x_key: str
    y_key: str
    z_key: str
    x_label: str
    y_label: str
    z_label: str


_GROUPS: tuple[_GroupDefinition, ...] = (
    _GroupDefinition(
        xy_plot_key="bj_xy_force_plot",
        xz_plot_key="bj_xz_force_plot",
        x_key="bj_x_force",
        y_key="bj_y_force",
        z_key="bj_z_force",
        x_label="BJ X Force",
        y_label="BJ Y Force",
        z_label="BJ Z Force",
    ),
    _GroupDefinition(
        xy_plot_key="shock_xy_force_plot",
        xz_plot_key="shock_xz_force_plot",
        x_key="shock_x_force",
        y_key="shock_y_force",
        z_key="shock_z_force",
        x_label="Shock X Force",
        y_label="Shock Y Force",
        z_label="Shock Z Force",
    ),
    _GroupDefinition(
        xy_plot_key="bushing_f_xy_force_plot",
        xz_plot_key="bushing_f_xz_force_plot",
        x_key="bushing_f_x_momt",
        y_key="bushing_f_y_momt",
        z_key="bushing_f_z_momt",
        x_label="Bushing F X Momt",
        y_label="Bushing F Y Momt",
        z_label="Bushing F Z Momt",
    ),
    _GroupDefinition(
        xy_plot_key="bushing_r_xy_force_plot",
        xz_plot_key="bushing_r_xz_force_plot",
        x_key="bushing_r_x_momt",
        y_key="bushing_r_y_momt",
        z_key="bushing_r_z_momt",
        x_label="Bushing R X Momt",
        y_label="Bushing R Y Momt",
        z_label="Bushing R Z Momt",
    ),
)


def derive_damage_channel_specs(
    channel_map_rows: list[dict[str, Any]],
) -> list[DamageChannelSpec]:
    """Derive the fixed 12 Inspect Damage channels from 8 plot definitions."""
    rows_by_key = {str(row.get("plot_key")): row for row in channel_map_rows}
    specs: list[DamageChannelSpec] = []

    for group in _GROUPS:
        xy_row = rows_by_key.get(group.xy_plot_key)
        xz_row = rows_by_key.get(group.xz_plot_key)
        if xy_row is None or xz_row is None:
            missing = [
                plot_key
                for plot_key, row in (
                    (group.xy_plot_key, xy_row),
                    (group.xz_plot_key, xz_row),
                )
                if row is None
            ]
            specs.extend(
                _unavailable_group_specs(
                    group,
                    f"Missing channel-map plot(s): {', '.join(missing)}",
                )
            )
            continue

        xy_x_col = xy_row.get("x_col")
        xz_x_col = xz_row.get("x_col")
        xy_x_channel = _channel_name(xy_row, "x")
        xz_x_channel = _channel_name(xz_row, "x")
        if xy_x_col != xz_x_col or xy_x_channel != xz_x_channel:
            specs.extend(
                _unavailable_group_specs(
                    group,
                    (
                        "XY and XZ plots disagree on the shared X channel "
                        f"({group.xy_plot_key}.x={xy_x_channel or xy_x_col}, "
                        f"{group.xz_plot_key}.x={xz_x_channel or xz_x_col})"
                    ),
                )
            )
            continue

        specs.extend(
            [
                _spec(group.x_key, group.x_label, group.xy_plot_key, "x", xy_row),
                _spec(group.y_key, group.y_label, group.xy_plot_key, "y", xy_row),
                _spec(group.z_key, group.z_label, group.xz_plot_key, "y", xz_row),
            ]
        )

    return specs


def is_generic_channel_name(value: str | None) -> bool:
    if value is None:
        return False
    return _is_generic_col_name(value)


def resolve_damage_channel_name(
    spec: DamageChannelSpec,
    raw_channel_names: list[str],
) -> DamageChannelResolution:
    """Resolve legacy generic channel-map names to known raw LCA channels."""
    if not is_generic_channel_name(spec.channel_name):
        return DamageChannelResolution(spec.channel_name)

    component_patterns = _component_patterns(spec.key)
    axis = _axis_for_key(spec.key)
    if component_patterns is None or axis is None:
        return DamageChannelResolution(
            None,
            f"No legacy resolver pattern is configured for {spec.key}",
        )

    matches = [
        name
        for name in raw_channel_names
        if _matches_component(name, component_patterns) and _matches_axis(name, axis)
    ]
    unique_matches = sorted(set(matches))
    if len(unique_matches) == 1:
        return DamageChannelResolution(unique_matches[0])
    if not unique_matches:
        return DamageChannelResolution(
            None,
            f"No raw measurement channel matched legacy {spec.channel_name} for {spec.label}",
        )
    return DamageChannelResolution(
        None,
        (
            f"Multiple raw measurement channels matched legacy {spec.channel_name} "
            f"for {spec.label}: {', '.join(unique_matches)}"
        ),
    )


def _unavailable_group_specs(
    group: _GroupDefinition,
    error: str,
) -> list[DamageChannelSpec]:
    return [
        DamageChannelSpec(group.x_key, group.x_label, group.xy_plot_key, "x", None, None, error),
        DamageChannelSpec(group.y_key, group.y_label, group.xy_plot_key, "y", None, None, error),
        DamageChannelSpec(group.z_key, group.z_label, group.xz_plot_key, "y", None, None, error),
    ]


def _spec(
    key: str,
    label: str,
    plot_key: str,
    axis: Axis,
    row: dict[str, Any],
) -> DamageChannelSpec:
    channel_name = _channel_name(row, axis)
    error = None
    if channel_name is None:
        error = f"{plot_key}.{axis}_channel is not configured"
    return DamageChannelSpec(
        key=key,
        label=label,
        plot_key=plot_key,
        axis=axis,
        channel_name=channel_name,
        unit=_unit(row, axis),
        error=error,
    )


def _channel_name(row: dict[str, Any], axis: Axis) -> str | None:
    value = row.get(f"{axis}_channel")
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _unit(row: dict[str, Any], axis: Axis) -> str | None:
    value = row.get(f"{axis}_unit")
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _is_generic_col_name(value: str) -> bool:
    if not value.startswith("col_"):
        return False
    return value[4:].isdigit()


def _component_patterns(key: str) -> tuple[str, ...] | None:
    if key.startswith("bj_"):
        return ("balljoint", "balljnt", "lbj", "otrbj", "outerbj")
    if key.startswith("shock_"):
        return ("shock", "shk")
    if key.startswith("bushing_f_"):
        return ("frontattachment", "frontbush", "frontbsh", "frontbushing", "lcabushingf")
    if key.startswith("bushing_r_"):
        return ("rearattachment", "rearbush", "rearbsh", "rearbushing", "lcabushingr")
    return None


def _axis_for_key(key: str) -> DamageAxis | None:
    parts = key.split("_")
    if len(parts) < 2:
        return None
    axis = parts[-2] if parts[-1] in {"force", "momt"} else parts[-1]
    if axis in {"x", "y", "z"}:
        return axis
    return None


def _matches_component(channel_name: str, patterns: tuple[str, ...]) -> bool:
    normalized = _normalized(channel_name)
    return any(pattern in normalized for pattern in patterns)


def _matches_axis(channel_name: str, axis: str) -> bool:
    tokens = _tokens(channel_name)
    return axis in tokens or f"f{axis}" in tokens


def _tokens(value: str) -> set[str]:
    return {token for token in re.split(r"[^a-z0-9]+", value.lower()) if token}


def _normalized(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())
