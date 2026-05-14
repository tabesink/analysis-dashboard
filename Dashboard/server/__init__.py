"""RSP Data Analytics Dashboard API Server.

A FastAPI-based server with DuckDB storage for time-series data analytics.
"""

from pathlib import Path


def _read_version() -> str:
    """
    Read version from the root VERSION file (single source of truth).
    
    Falls back to "0.0.0-dev" if the file is not found, which should only
    happen during development when running from unexpected locations.
    """
    # VERSION file is in the project root (parent of server/)
    version_file = Path(__file__).parent.parent / "VERSION"
    
    try:
        return version_file.read_text().strip()
    except FileNotFoundError:
        # Fallback for edge cases (e.g., running from installed package)
        return "0.0.0-dev"


__version__ = _read_version()
