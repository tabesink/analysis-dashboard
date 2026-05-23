"""CSV file parsing with header detection."""

import io
import logging
from dataclasses import dataclass, field

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class ParsedFile:
    """Result of parsing a CSV file."""

    filename: str
    dataframe: pd.DataFrame
    headers: list[str] = field(default_factory=list)
    units: list[str] = field(default_factory=list)
    is_valid: bool = True
    error: str | None = None
    row_count: int = 0


class CSVParser:
    """
    Parse CSV files with specialized header detection.

    Handles RSP-format CSV files with metadata rows:
    - #HEADER
    - #TITLES (column names)
    - #UNITS
    - #DATATYPES
    - #DATA (actual data starts here)
    """

    # Known metadata markers
    MARKERS = {"#HEADER", "#TITLES", "#UNITS", "#DATATYPES", "#DATA"}

    def parse(self, content: bytes, filename: str) -> ParsedFile:
        """
        Parse CSV content and return ParsedFile.

        Args:
            content: Raw bytes of CSV file
            filename: Original filename for error reporting

        Returns:
            ParsedFile with DataFrame and metadata
        """
        try:
            # Decode content
            text = content.decode("utf-8", errors="replace")
            lines = text.strip().split("\n")

            # Find data start and extract metadata
            data_start_idx = 0
            headers: list[str] = []
            units: list[str] = []

            for i, line in enumerate(lines):
                stripped = line.strip()
                if stripped == "#DATA":
                    data_start_idx = i + 1
                    break
                elif stripped == "#TITLES" and i + 1 < len(lines):
                    # Next line contains headers
                    header_line = lines[i + 1]
                    headers = [h.strip() for h in header_line.split(",")]
                elif stripped == "#UNITS" and i + 1 < len(lines):
                    # Next line contains units
                    unit_line = lines[i + 1]
                    units = [u.strip() for u in unit_line.split(",")]

            # If no #DATA marker found, assume data starts at first non-marker line
            if data_start_idx == 0:
                for i, line in enumerate(lines):
                    stripped = line.strip()
                    if stripped and not stripped.startswith("#"):
                        # Check if this looks like a header row
                        if i == 0 or not any(c.isdigit() for c in stripped.split(",")[0]):
                            headers = [h.strip() for h in stripped.split(",")]
                            data_start_idx = i + 1
                        else:
                            data_start_idx = i
                        break

            # Parse data section
            data_text = "\n".join(lines[data_start_idx:])
            df = pd.read_csv(
                io.StringIO(data_text),
                header=None,
                dtype=float,
                on_bad_lines="warn",
            )

            # Assign headers if we have them and they match column count
            if headers and len(headers) == len(df.columns):
                df.columns = headers
            elif headers:
                # Pad or truncate headers to match column count
                if len(headers) < len(df.columns):
                    headers.extend([f"col_{i}" for i in range(len(headers), len(df.columns))])
                df.columns = headers[: len(df.columns)]
            df.attrs["units"] = units

            logger.info(f"Parsed {filename}: {len(df)} rows, {len(df.columns)} columns")

            return ParsedFile(
                filename=filename,
                dataframe=df,
                headers=list(df.columns),
                units=units,
                is_valid=True,
                row_count=len(df),
            )

        except Exception as e:
            logger.error(f"Failed to parse {filename}: {e}")
            return ParsedFile(
                filename=filename,
                dataframe=pd.DataFrame(),
                is_valid=False,
                error=str(e),
            )

