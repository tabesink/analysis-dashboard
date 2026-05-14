"""Application configuration with YAML and environment variable support."""

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def load_yaml_config(yaml_path: Path) -> dict[str, Any]:
    """Load configuration from YAML file."""
    if yaml_path.exists():
        with open(yaml_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    return {}


class RateLimitingSettings(BaseSettings):
    """Rate limiting configuration."""

    enabled: bool = True
    default_requests_per_minute: int = 120
    upload_requests_per_minute: int = 10
    render_requests_per_minute: int = 20
    admin_requests_per_minute: int = 30
    auth_requests_per_minute: int = 10
    register_requests_per_minute: int = 3
    burst_allowance: int = 10


class CachingSettings(BaseSettings):
    """Caching configuration."""

    enabled: bool = True
    filter_options_ttl_seconds: int = 3600
    program_ids_ttl_seconds: int = 300   # 5 minutes (was 60)
    versions_ttl_seconds: int = 300      # 5 minutes (was 60)
    events_ttl_seconds: int = 120        # 2 minutes (was 30)
    plot_data_ttl_seconds: int = 600     # 10 minutes (plot data is immutable)


class ValidationSettings(BaseSettings):
    """Data validation configuration."""

    max_nan_percentage: float = 5.0
    min_rows: int = 10
    max_rows: int = 1000000
    check_timestamp_monotonicity: bool = True


class Settings(BaseSettings):
    """
    Application settings - loaded from YAML and environment.

    Priority: Environment Variables > .env > settings.yaml > Defaults
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_nested_delimiter="__",
    )

    # Runtime mode
    app_env: Literal["development", "production"] = Field(default="development")

    # Server
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8000)
    debug: bool = Field(default=False)
    log_level: str = Field(default="INFO")

    # Security
    admin_secret: str = Field(default="")  # Empty = admin endpoints disabled
    jwt_secret: str = Field(default="")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expiry_hours: int = Field(default=24)
    auth_cookie_name: str = Field(default="rsp_auth")
    auth_cookie_secure: bool = Field(default=True)
    auth_cookie_samesite: str = Field(default="lax")
    auth_cookie_domain: str | None = Field(default=None)
    cors_origins: list[str] = Field(default=["http://localhost:3000"])

    # LAN / intranet opt-in: when true, the production-mode validator skips the
    # `auth_cookie_secure` and CORS-wildcard checks. Intended for trusted
    # internal LAN deployments that serve plain HTTP without a TLS terminator.
    # NEVER enable this for an internet-reachable deployment.
    allow_insecure_cookies: bool = Field(default=False)

    # Storage paths
    data_root: Path = Field(default=Path("data"))
    log_dir: Path = Field(default=Path("logs"))

    # Logging
    log_to_file: bool = Field(default=False)
    slow_query_ms: int = Field(default=1000)

    # LTTB settings
    lttb_resolution: int = Field(default=5000)
    lttb_reduction_factor: float = Field(default=0.4)
    lttb_inflection_eps: float = Field(default=1e-6)
    lttb_point_budget: int = Field(default=100)

    # Limits
    max_upload_size_mb: int = Field(default=500)
    max_events_per_query: int = Field(default=200)

    # Performance
    enable_performance_metrics: bool = Field(default=True)

    # Nested settings
    rate_limiting: RateLimitingSettings = Field(default_factory=RateLimitingSettings)
    caching: CachingSettings = Field(default_factory=CachingSettings)
    validation: ValidationSettings = Field(default_factory=ValidationSettings)

    # NOTE: Filter options are now defined in schema.yaml (single source of truth)
    # Use SchemaLoader.get_filter_options() to retrieve them

    @model_validator(mode="before")
    @classmethod
    def hydrate_secrets_from_environment(cls, data: Any) -> Any:
        """Backfill secret fields from env before validation."""
        if not isinstance(data, dict):
            return data

        jwt_secret = data.get("jwt_secret")
        if not jwt_secret:
            env_jwt_secret = os.getenv("JWT_SECRET") or os.getenv("jwt_secret")
            if env_jwt_secret:
                data = {**data, "jwt_secret": env_jwt_secret.strip()}

        return data

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        """Enforce secure defaults when running in production mode."""
        if self.app_env != "production":
            return self

        if self.debug:
            raise ValueError("debug must be false in production mode")
        if self.host in {"127.0.0.1", "localhost"}:
            raise ValueError(
                "host must be network-reachable in production mode (e.g. 0.0.0.0)"
            )
        if not self.allow_insecure_cookies:
            if not self.auth_cookie_secure:
                raise ValueError(
                    "auth_cookie_secure must be true in production mode "
                    "(set ALLOW_INSECURE_COOKIES=true to opt out on a trusted LAN)"
                )
            if "*" in self.cors_origins:
                raise ValueError(
                    "cors_origins must not contain '*' in production mode "
                    "(set ALLOW_INSECURE_COOKIES=true to opt out on a trusted LAN)"
                )
        if self.jwt_expiry_hours > 24:
            raise ValueError("jwt_expiry_hours must be <= 24 in production mode")
        if self.jwt_secret in {"", "dev-jwt-secret-change-me"} or len(self.jwt_secret) < 32:
            secret_len = len(self.jwt_secret or "")
            raise ValueError(
                "jwt_secret must be set and at least 32 characters in production mode "
                f"(current length={secret_len}); set JWT_SECRET in the server environment"
            )

        return self

    @property
    def database_path(self) -> Path:
        """Path to the unified DuckDB file containing all data."""
        return self.data_root / "dashboard.db"

    def model_post_init(self, __context: Any) -> None:
        """Ensure paths are Path objects."""
        if isinstance(self.data_root, str):
            object.__setattr__(self, "data_root", Path(self.data_root))
        if isinstance(self.log_dir, str):
            object.__setattr__(self, "log_dir", Path(self.log_dir))


def create_settings_from_yaml(yaml_path: Path | None = None) -> Settings:
    """
    Create Settings instance with YAML file as base configuration.

    Priority: Environment Variables > .env > settings.yaml > Defaults
    """
    if yaml_path is None:
        # Allow explicit settings file selection for non-container deployments.
        env_settings_path = os.getenv("SETTINGS_YAML_PATH")
        if env_settings_path:
            yaml_path = Path(env_settings_path).expanduser().resolve()
        else:
            # Default to settings.yaml in server directory
            yaml_path = Path(__file__).parent / "settings.yaml"

    yaml_config = load_yaml_config(yaml_path)
    app_env = str(os.getenv("APP_ENV", yaml_config.get("app_env", "development"))).lower()
    if app_env not in {"development", "production"}:
        raise ValueError("app_env must be either 'development' or 'production'")

    # app_env is the source of truth for these core runtime defaults unless
    # the operator explicitly overrides via environment variables.
    yaml_config["app_env"] = app_env
    if "HOST" not in os.environ:
        yaml_config["host"] = "127.0.0.1" if app_env == "development" else "0.0.0.0"
    if "DEBUG" not in os.environ:
        yaml_config["debug"] = app_env == "development"
    allow_insecure_cookies_env = os.getenv("ALLOW_INSECURE_COOKIES", "").strip().lower()
    allow_insecure_cookies = allow_insecure_cookies_env in {"1", "true", "yes", "on"}
    if allow_insecure_cookies:
        yaml_config["allow_insecure_cookies"] = True
    if "AUTH_COOKIE_SECURE" not in os.environ:
        # In production, default to secure cookies UNLESS the operator has
        # explicitly opted into the LAN/intranet escape hatch.
        yaml_config["auth_cookie_secure"] = (
            app_env == "production" and not allow_insecure_cookies
        )

    # Ensure critical secrets coming from container environments are not lost
    # when Settings is instantiated with YAML-derived init kwargs.
    jwt_secret_from_env = os.getenv("JWT_SECRET") or os.getenv("jwt_secret")
    if jwt_secret_from_env:
        yaml_config["jwt_secret"] = jwt_secret_from_env

    # CORS_ORIGINS is environment-specific; the YAML default in the Docker
    # image (settings.docker.yaml) is a fixed allowlist that does not match
    # the LAN host the operator actually deploys to. Pydantic-settings would
    # normally let env vars override field values, but because we pass the
    # YAML dict to Settings(**yaml_config) the YAML value enters as an
    # explicit init kwarg and beats the env var. Replicate the same explicit
    # env-wins-over-yaml pattern used above for HOST/DEBUG.
    #
    # Three accepted shapes (first match wins):
    #   1. CORS_ORIGINS='["http://a:3000","http://b:3000"]'  - JSON list
    #   2. CORS_ORIGINS='*'  or  'http://a:3000,http://b:3000'  - bare/CSV
    #   3. CORS_ORIGINS__0=*, CORS_ORIGINS__1=http://b:3000  - indexed
    #
    # We must also pop the env vars off os.environ after consuming them:
    # pydantic-settings eagerly JSON-parses env vars for list-typed fields
    # before merging with init kwargs, and a bare value like '*' raises a
    # JSONDecodeError - even though our init kwarg would have won the merge.
    cors_env = os.environ.pop("CORS_ORIGINS", None)
    cors_indexed = sorted(
        (int(key.split("__", 1)[1]), value)
        for key, value in list(os.environ.items())
        if key.startswith("CORS_ORIGINS__")
        and key.split("__", 1)[1].isdigit()
        and value
    )
    for key in [k for k in os.environ if k.startswith("CORS_ORIGINS__")]:
        os.environ.pop(key, None)

    if cors_env is not None:
        cors_env = cors_env.strip()
        parsed: list[str] | None = None
        if cors_env.startswith("["):
            try:
                loaded = json.loads(cors_env)
                if isinstance(loaded, list):
                    parsed = [str(item) for item in loaded]
            except json.JSONDecodeError:
                parsed = None
        if parsed is None:
            parsed = [item.strip() for item in cors_env.split(",") if item.strip()]
        if parsed:
            yaml_config["cors_origins"] = parsed
    elif cors_indexed:
        yaml_config["cors_origins"] = [value for _, value in cors_indexed]

    # Handle nested settings
    rate_limiting_config = yaml_config.pop("rate_limiting", {})
    caching_config = yaml_config.pop("caching", {})
    validation_config = yaml_config.pop("validation", {})

    # Create nested settings objects
    rate_limiting = RateLimitingSettings(**rate_limiting_config)
    caching = CachingSettings(**caching_config)
    validation = ValidationSettings(**validation_config)

    # Create main settings with YAML as base
    return Settings(
        rate_limiting=rate_limiting,
        caching=caching,
        validation=validation,
        **yaml_config,
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return create_settings_from_yaml()

