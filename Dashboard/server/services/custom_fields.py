"""Service layer for admin-managed custom filter fields."""

from collections import defaultdict
from typing import Any

from server.storage.database import UnifiedStore


class CustomFieldService:
    """Manages custom field definitions and program-scoped allowed values."""

    def __init__(self, db: UnifiedStore):
        self.db = db

    @staticmethod
    def _normalize_field_key(field_key: str) -> str:
        normalized = field_key.strip().lower().replace(" ", "_")
        if not normalized:
            raise ValueError("field_key is required")
        return normalized

    @staticmethod
    def _normalize_values(values: list[str]) -> list[str]:
        normalized: list[str] = []
        for value in values:
            trimmed = value.strip()
            if trimmed and trimmed not in normalized:
                normalized.append(trimmed)
        return normalized

    def create_or_update_definition(
        self,
        field_key: str,
        display_name: str,
        data_type: str = "string",
        is_filterable: bool = True,
        created_by_user_id: str | None = None,
    ) -> dict[str, Any]:
        normalized_key = self._normalize_field_key(field_key)
        display = display_name.strip()
        if not display:
            raise ValueError("display_name is required")

        allowed_data_types = {"string"}
        if data_type not in allowed_data_types:
            raise ValueError("Unsupported data_type")

        return self.db.upsert_custom_field_definition(
            field_key=normalized_key,
            display_name=display,
            data_type=data_type,
            is_filterable=is_filterable,
            created_by_user_id=created_by_user_id,
        )

    def list_definitions(self, filterable_only: bool = False) -> list[dict[str, Any]]:
        return self.db.get_custom_field_definitions(filterable_only=filterable_only)

    def update_program_allowed_values(
        self,
        field_key: str,
        program_id: str,
        values: list[str],
    ) -> list[str]:
        normalized_key = self._normalize_field_key(field_key)
        clean_program = program_id.strip()
        if not clean_program:
            raise ValueError("program_id is required")

        definition = self.db.get_custom_field_definition(normalized_key)
        if definition is None:
            raise ValueError(f"Unknown custom field: {normalized_key}")

        normalized_values = self._normalize_values(values)
        self.db.replace_custom_field_allowed_values(
            field_key=normalized_key,
            program_id=clean_program,
            values=normalized_values,
        )
        return normalized_values

    def get_program_allowed_values(
        self,
        program_id: str,
    ) -> dict[str, list[str]]:
        rows = self.db.get_custom_field_allowed_values(program_id=program_id.strip())
        values_by_field: dict[str, list[str]] = defaultdict(list)
        for row in rows:
            values_by_field[row["field_key"]].append(row["value"])
        return dict(values_by_field)
