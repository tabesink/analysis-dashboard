# Candidate 2 Implementation Guide — Server Filter Semantics Module

## Goal

Create one deep module for dashboard filter meaning.

A caller should be able to do this:

```py
filter_plan = build_filter_plan(
    filters=request.filters,
    schema=schema,
    purpose="event_grid",
)
rows = event_store.query_events(filter_plan)
```

The caller should not need to know whether a filter is boolean, weight-based, custom-field-based, or schema-derived.

## Proposed folder

```text
server/modules/filter_semantics/
  README.md
  models.py
  schema.py
  normalize.py
  build_filter_plan.py
  errors.py
  test_filter_semantics.py
```

## README.md starter

```md
# Filter Semantics Module

This module owns the meaning of dashboard filters.

It converts user filter input into a validated `FilterPlan`.

Callers should not manually interpret boolean filters, weight filters, custom fields, or schema metadata.
```

## models.py

```py
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Literal


FilterPurpose = Literal["event_grid", "program_list", "version_list"]


class FieldKind(str, Enum):
    TEXT = "text"
    NUMBER = "number"
    BOOLEAN = "boolean"
    WEIGHT = "weight"


class Operator(str, Enum):
    EQ = "eq"
    IN = "in"
    RANGE = "range"


@dataclass(frozen=True)
class FieldDefinition:
    name: str
    kind: FieldKind
    allowed_operators: tuple[Operator, ...]


@dataclass(frozen=True)
class NormalizedFilter:
    field: str
    operator: Operator
    value: Any


@dataclass(frozen=True)
class FilterPlan:
    purpose: FilterPurpose
    filters: tuple[NormalizedFilter, ...]
```

## errors.py

```py
class FilterSemanticsError(ValueError):
    """Base error for invalid dashboard filters."""


class UnknownFilterFieldError(FilterSemanticsError):
    def __init__(self, field: str) -> None:
        super().__init__(f"Unknown filter field: {field}")
        self.field = field


class UnsupportedFilterOperatorError(FilterSemanticsError):
    def __init__(self, field: str, operator: str) -> None:
        super().__init__(f"Unsupported operator '{operator}' for field '{field}'")
        self.field = field
        self.operator = operator
```

## schema.py

This file adapts existing schema metadata into a small shape the filter module understands.

```py
from __future__ import annotations

from .models import FieldDefinition, FieldKind, Operator


def load_filter_fields(schema_metadata: dict) -> dict[str, FieldDefinition]:
    fields: dict[str, FieldDefinition] = {}

    for field in schema_metadata.get("fields", []):
        name = field["name"]
        kind = _to_field_kind(field.get("type"))

        fields[name] = FieldDefinition(
            name=name,
            kind=kind,
            allowed_operators=_default_operators_for(kind),
        )

    return fields


def _to_field_kind(raw_type: str | None) -> FieldKind:
    if raw_type == "boolean":
        return FieldKind.BOOLEAN
    if raw_type in {"number", "float", "integer"}:
        return FieldKind.NUMBER
    if raw_type == "weight":
        return FieldKind.WEIGHT
    return FieldKind.TEXT


def _default_operators_for(kind: FieldKind) -> tuple[Operator, ...]:
    if kind in {FieldKind.NUMBER, FieldKind.WEIGHT}:
        return (Operator.EQ, Operator.RANGE)
    if kind == FieldKind.BOOLEAN:
        return (Operator.EQ,)
    return (Operator.EQ, Operator.IN)
```

## normalize.py

```py
from __future__ import annotations

from typing import Any

from .errors import UnsupportedFilterOperatorError
from .models import FieldDefinition, FieldKind, NormalizedFilter, Operator


def normalize_filter(
    field: FieldDefinition,
    raw_value: Any,
    operator: Operator | None = None,
) -> NormalizedFilter:
    selected_operator = operator or _default_operator(raw_value)

    if selected_operator not in field.allowed_operators:
        raise UnsupportedFilterOperatorError(field.name, selected_operator.value)

    return NormalizedFilter(
        field=field.name,
        operator=selected_operator,
        value=_normalize_value(field, raw_value),
    )


def _default_operator(raw_value: Any) -> Operator:
    if isinstance(raw_value, list):
        return Operator.IN
    if isinstance(raw_value, dict) and {"min", "max"} & set(raw_value.keys()):
        return Operator.RANGE
    return Operator.EQ


def _normalize_value(field: FieldDefinition, raw_value: Any) -> Any:
    if field.kind == FieldKind.BOOLEAN:
        return _normalize_boolean(raw_value)

    if field.kind == FieldKind.WEIGHT:
        return _normalize_weight(raw_value)

    return raw_value


def _normalize_boolean(raw_value: Any) -> bool:
    if isinstance(raw_value, bool):
        return raw_value

    if isinstance(raw_value, str):
        lowered = raw_value.strip().lower()
        if lowered in {"true", "yes", "1"}:
            return True
        if lowered in {"false", "no", "0"}:
            return False

    raise ValueError(f"Invalid boolean filter value: {raw_value!r}")


def _normalize_weight(raw_value: Any) -> Any:
    # Keep this boring first. Add unit conversion only when the current code needs it.
    return raw_value
```

## build_filter_plan.py

```py
from __future__ import annotations

from typing import Any

from .errors import UnknownFilterFieldError
from .models import FieldDefinition, FilterPlan, FilterPurpose
from .normalize import normalize_filter


def build_filter_plan(
    *,
    filters: dict[str, Any],
    fields: dict[str, FieldDefinition],
    purpose: FilterPurpose,
) -> FilterPlan:
    normalized = []

    for field_name, raw_value in filters.items():
        field = fields.get(field_name)
        if field is None:
            raise UnknownFilterFieldError(field_name)

        normalized.append(normalize_filter(field, raw_value))

    return FilterPlan(
        purpose=purpose,
        filters=tuple(normalized),
    )
```

## Example usage inside query.py

This is intentionally simple. Do not rewrite all query code in the first PR.

```py
from server.modules.filter_semantics.build_filter_plan import build_filter_plan
from server.modules.filter_semantics.schema import load_filter_fields


class QueryService:
    def get_events(self, request):
        schema_metadata = self.schema_loader.load()
        fields = load_filter_fields(schema_metadata)

        filter_plan = build_filter_plan(
            filters=request.filters,
            fields=fields,
            purpose="event_grid",
        )

        return self.store.query_events(filter_plan)
```

## Example store usage

Keep SQL execution in the store. The filter module decides meaning; the store decides how to execute it.

```py
def query_events(self, filter_plan):
    query = ["SELECT * FROM events"]
    params = []

    where_parts = []

    for item in filter_plan.filters:
        if item.operator == "eq":
            where_parts.append(f"{item.field} = ?")
            params.append(item.value)
        elif item.operator == "in":
            placeholders = ", ".join("?" for _ in item.value)
            where_parts.append(f"{item.field} IN ({placeholders})")
            params.extend(item.value)
        elif item.operator == "range":
            if "min" in item.value:
                where_parts.append(f"{item.field} >= ?")
                params.append(item.value["min"])
            if "max" in item.value:
                where_parts.append(f"{item.field} <= ?")
                params.append(item.value["max"])

    if where_parts:
        query.append("WHERE " + " AND ".join(where_parts))

    return self.connection.execute(" ".join(query), params).fetchall()
```

## test_filter_semantics.py

```py
import pytest

from server.modules.filter_semantics.build_filter_plan import build_filter_plan
from server.modules.filter_semantics.errors import UnknownFilterFieldError
from server.modules.filter_semantics.models import FieldDefinition, FieldKind, Operator


FIELDS = {
    "program": FieldDefinition(
        name="program",
        kind=FieldKind.TEXT,
        allowed_operators=(Operator.EQ, Operator.IN),
    ),
    "is_valid": FieldDefinition(
        name="is_valid",
        kind=FieldKind.BOOLEAN,
        allowed_operators=(Operator.EQ,),
    ),
}


def test_builds_filter_plan_for_event_grid():
    plan = build_filter_plan(
        filters={"program": "A"},
        fields=FIELDS,
        purpose="event_grid",
    )

    assert plan.purpose == "event_grid"
    assert plan.filters[0].field == "program"
    assert plan.filters[0].operator == Operator.EQ
    assert plan.filters[0].value == "A"


def test_normalizes_boolean_string_values():
    plan = build_filter_plan(
        filters={"is_valid": "yes"},
        fields=FIELDS,
        purpose="event_grid",
    )

    assert plan.filters[0].value is True


def test_unknown_field_fails_before_query_execution():
    with pytest.raises(UnknownFilterFieldError):
        build_filter_plan(
            filters={"does_not_exist": "x"},
            fields=FIELDS,
            purpose="event_grid",
        )
```

## Migration steps

1. Create the module folder.
2. Add tests for the desired filter behaviour.
3. Add `FilterPlan`.
4. Make one query path use `FilterPlan`.
5. Move boolean filter logic into the module.
6. Move weight filter logic into the module.
7. Move custom field/schema lookup into the module.
8. Delete replaced utility tests when module tests cover the same behaviour.

## Junior developer checklist

Before opening a pull request:

- [ ] Unknown fields fail clearly.
- [ ] Boolean values normalize in one place.
- [ ] Weight filters normalize in one place.
- [ ] QueryService does not interpret filter meaning directly.
- [ ] Store executes a filter plan; it does not decide user-facing filter semantics.
- [ ] Event grid, program list, and version list use the same filter contract.
