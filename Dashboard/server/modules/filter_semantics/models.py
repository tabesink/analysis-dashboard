"""Models for validated Dashboard filter plans."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

FilterPurpose = Literal["event_grid", "program_list", "version_list"]


@dataclass(frozen=True)
class FilterCondition:
    """A validated SQL predicate plus bound parameters."""

    sql: str
    params: tuple[Any, ...]


@dataclass(frozen=True)
class FilterPlan:
    """Validated filter conditions for a specific Dashboard query purpose."""

    purpose: FilterPurpose
    conditions: tuple[FilterCondition, ...]
