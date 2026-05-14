"""Data validation during CSV ingestion."""

import hashlib
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import numpy as np
import pandas as pd

from server.config import ValidationSettings

logger = logging.getLogger(__name__)


class ValidationSeverity(str, Enum):
    """Validation issue severity levels."""

    ERROR = "error"  # Blocks ingestion
    WARNING = "warning"  # Logged, allows ingestion
    INFO = "info"  # Informational only


@dataclass
class ValidationIssue:
    """A single validation issue."""

    severity: ValidationSeverity
    code: str
    message: str
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationResult:
    """Result of data validation."""

    is_valid: bool
    issues: list[ValidationIssue] = field(default_factory=list)
    file_hash: str | None = None
    row_count: int = 0

    @property
    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == ValidationSeverity.ERROR]

    @property
    def warnings(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == ValidationSeverity.WARNING]


class DataValidator:
    """Validates CSV data during ingestion."""

    def __init__(self, settings: ValidationSettings):
        self.max_nan_percentage = settings.max_nan_percentage
        self.min_rows = settings.min_rows
        self.max_rows = settings.max_rows
        self.check_monotonicity = settings.check_timestamp_monotonicity

    def validate(
        self,
        df: pd.DataFrame,
        channel_map: dict[str, Any],
        file_content: bytes,
        existing_hashes: set[str] | None = None,
    ) -> ValidationResult:
        """
        Validate a DataFrame before ingestion.

        Args:
            df: Parsed DataFrame from CSV
            channel_map: Channel mapping configuration
            file_content: Raw file bytes for hash computation
            existing_hashes: Set of existing file hashes for duplicate detection

        Returns:
            ValidationResult with is_valid flag and any issues
        """
        issues: list[ValidationIssue] = []

        # Compute file hash (first 16 chars of SHA256)
        file_hash = hashlib.sha256(file_content).hexdigest()[:16]

        # Check for duplicate file
        if existing_hashes and file_hash in existing_hashes:
            issues.append(
                ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    code="DUPLICATE_FILE",
                    message="This file has already been uploaded",
                    details={"file_hash": file_hash},
                )
            )

        # Check row count bounds
        row_count = len(df)
        if row_count < self.min_rows:
            issues.append(
                ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    code="TOO_FEW_ROWS",
                    message=f"File has {row_count} rows, minimum is {self.min_rows}",
                    details={"row_count": row_count, "min_rows": self.min_rows},
                )
            )

        if row_count > self.max_rows:
            issues.append(
                ValidationIssue(
                    severity=ValidationSeverity.ERROR,
                    code="TOO_MANY_ROWS",
                    message=f"File has {row_count} rows, maximum is {self.max_rows}",
                    details={"row_count": row_count, "max_rows": self.max_rows},
                )
            )

        # Check column existence for channel_map requirements
        num_columns = len(df.columns)
        for plot_key, mapping in channel_map.items():
            x_col = mapping.get("x_col", 0)
            y_col = mapping.get("y_col", 1)

            if x_col >= num_columns:
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        code="MISSING_X_COLUMN",
                        message=f"Column index {x_col} not found for plot '{plot_key}'",
                        details={
                            "plot_key": plot_key,
                            "x_col": x_col,
                            "num_columns": num_columns,
                        },
                    )
                )

            if y_col >= num_columns:
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.ERROR,
                        code="MISSING_Y_COLUMN",
                        message=f"Column index {y_col} not found for plot '{plot_key}'",
                        details={
                            "plot_key": plot_key,
                            "y_col": y_col,
                            "num_columns": num_columns,
                        },
                    )
                )

        # Check NaN/Inf percentage
        if not df.empty:
            total_cells = df.size
            nan_count = df.isna().sum().sum()

            # Count inf values only in numeric columns
            numeric_df = df.select_dtypes(include=[np.number])
            inf_count = 0
            if not numeric_df.empty:
                inf_count = np.isinf(numeric_df).sum().sum()

            invalid_count = nan_count + inf_count
            invalid_pct = (invalid_count / total_cells) * 100 if total_cells > 0 else 0

            if invalid_pct > self.max_nan_percentage:
                issues.append(
                    ValidationIssue(
                        severity=ValidationSeverity.WARNING,
                        code="HIGH_INVALID_RATIO",
                        message=(
                            f"{invalid_pct:.1f}% invalid values (NaN/Inf) "
                            f"exceeds threshold of {self.max_nan_percentage}%"
                        ),
                        details={
                            "nan_count": int(nan_count),
                            "inf_count": int(inf_count),
                            "invalid_percentage": round(invalid_pct, 2),
                            "threshold": self.max_nan_percentage,
                        },
                    )
                )

            # Check timestamp monotonicity (if first column is time)
            if self.check_monotonicity and len(df) > 1:
                first_col = df.iloc[:, 0]
                if pd.api.types.is_numeric_dtype(first_col):
                    if not first_col.is_monotonic_increasing:
                        issues.append(
                            ValidationIssue(
                                severity=ValidationSeverity.WARNING,
                                code="NON_MONOTONIC_TIME",
                                message=(
                                    "First column (assumed time) is not "
                                    "monotonically increasing"
                                ),
                            )
                        )

        is_valid = not any(i.severity == ValidationSeverity.ERROR for i in issues)

        return ValidationResult(
            is_valid=is_valid,
            issues=issues,
            file_hash=file_hash,
            row_count=row_count,
        )

