"""Errors raised while interpreting Dashboard filters."""


class FilterSemanticsError(ValueError):
    """Base error for invalid Dashboard filters."""


class UnknownFilterFieldError(FilterSemanticsError):
    """Raised when a filter field is not known to schema or custom metadata."""

    def __init__(self, field: str) -> None:
        super().__init__(f"Unknown filter field: {field}")
        self.field = field
