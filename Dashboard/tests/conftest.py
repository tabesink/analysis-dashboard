"""Root-level test fixtures shared across all test modules."""

import tempfile
from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient

from server.config import Settings, ValidationSettings, CachingSettings, RateLimitingSettings
from server.main import create_app
from server.storage.database import UnifiedStore
from server.utils.cache import SimpleCache


@pytest.fixture
def tmp_data_dir(tmp_path: Path) -> Path:
    """Create temporary data directory."""
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


@pytest.fixture
def test_settings(tmp_data_dir: Path) -> Settings:
    """Create test settings with temporary directories."""
    return Settings(
        data_root=tmp_data_dir,
        log_dir=tmp_data_dir / "logs",
        debug=True,
        admin_secret="test-admin-secret",
        cors_origins=["http://localhost:3000"],
        lttb_resolution=1000,  # Lower for faster tests
        max_events_per_query=50,
        rate_limiting=RateLimitingSettings(enabled=False),
        caching=CachingSettings(enabled=True),
        validation=ValidationSettings(
            max_nan_percentage=10.0,
            min_rows=1,
            max_rows=100000,
        ),
    )


@pytest.fixture
def test_database(test_settings: Settings) -> Generator[UnifiedStore, None, None]:
    """Create test database instance."""
    db = UnifiedStore(test_settings.database_path)
    yield db
    db.close()


@pytest.fixture
def test_cache() -> SimpleCache:
    """Create test cache instance."""
    return SimpleCache(default_ttl_seconds=60)


@pytest.fixture
def test_app(test_settings: Settings):
    """Create test FastAPI application."""
    from server.dependencies import get_settings
    
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: test_settings
    return app


@pytest.fixture
def test_client(test_app) -> TestClient:
    """Create test client."""
    return TestClient(test_app)


@pytest.fixture
def admin_headers() -> dict[str, str]:
    """Headers with admin authentication."""
    return {"X-Admin-Key": "test-admin-secret"}


@pytest.fixture
def sample_csv_content() -> bytes:
    """Sample CSV content for testing."""
    return b"""#HEADER
#TITLES
,,Time,Force_X,Force_Y,Force_Z
#UNITS
,,s,N,N,N
#DATATYPES
Huge,Double,Float,Float,Float,Float
#DATA
1,0.000,100.0,200.0,300.0
2,0.001,101.0,201.0,301.0
3,0.002,102.0,202.0,302.0
4,0.003,103.0,203.0,303.0
5,0.004,104.0,204.0,304.0
6,0.005,105.0,205.0,305.0
7,0.006,106.0,206.0,306.0
8,0.007,107.0,207.0,307.0
9,0.008,108.0,208.0,308.0
10,0.009,109.0,209.0,309.0
"""


@pytest.fixture
def sample_channel_map_content() -> bytes:
    """Sample channel_map.yaml content for testing."""
    return b"""plot_1:
  x_col: 2
  y_col: 3
  x_channel: Time
  y_channel: Force_X
  x_unit: s
  y_unit: N
plot_2:
  x_col: 2
  y_col: 4
  x_channel: Time
  y_channel: Force_Y
  x_unit: s
  y_unit: N
"""
