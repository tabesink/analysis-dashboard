from __future__ import annotations

from pathlib import Path

from server.config import create_settings_from_yaml


def test_deployment_environment_values_override_yaml(
    tmp_path: Path,
    monkeypatch,
) -> None:
    settings_yaml = tmp_path / "settings.yaml"
    settings_yaml.write_text(
        "\n".join(
            [
                'app_env: "development"',
                'host: "127.0.0.1"',
                "port: 8000",
                'admin_secret: "yaml-admin-secret"',
                'jwt_secret: "yaml-jwt-secret-that-should-not-win"',
                'data_root: "yaml-data"',
                'log_dir: "yaml-logs"',
                "auth_cookie_secure: true",
                "cors_origins:",
                '  - "http://localhost:3001"',
            ]
        ),
        encoding="utf-8",
    )

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("HOST", "0.0.0.0")
    monkeypatch.setenv("PORT", "8123")
    monkeypatch.setenv("ADMIN_SECRET", "env-admin-secret")
    monkeypatch.setenv("JWT_SECRET", "x" * 64)
    monkeypatch.setenv("DATA_ROOT", str(tmp_path / "env-data"))
    monkeypatch.setenv("LOG_DIR", str(tmp_path / "env-logs"))
    monkeypatch.setenv("ALLOW_INSECURE_COOKIES", "true")
    monkeypatch.setenv("CORS_ORIGINS", "http://dashbox:3001")

    settings = create_settings_from_yaml(settings_yaml)

    assert settings.app_env == "production"
    assert settings.host == "0.0.0.0"
    assert settings.port == 8123
    assert settings.admin_secret == "env-admin-secret"
    assert settings.jwt_secret == "x" * 64
    assert settings.data_root == tmp_path / "env-data"
    assert settings.log_dir == tmp_path / "env-logs"
    assert settings.allow_insecure_cookies is True
    assert settings.auth_cookie_secure is False
    assert settings.cors_origins == ["http://dashbox:3001"]


def test_cors_origins_from_dotenv_file(tmp_path: Path, monkeypatch) -> None:
    settings_yaml = tmp_path / "settings.yaml"
    settings_yaml.write_text('app_env: "development"\n', encoding="utf-8")

    dotenv_path = tmp_path / ".env"
    dotenv_path.write_text(
        "CORS_ORIGINS=http://localhost:3001,http://127.0.0.1:3001\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("server.config._dotenv_path", lambda: dotenv_path)

    settings = create_settings_from_yaml(settings_yaml)

    assert settings.cors_origins == [
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]


def test_cors_origins_normalize_hostname_case(tmp_path: Path, monkeypatch) -> None:
    settings_yaml = tmp_path / "settings.yaml"
    settings_yaml.write_text('app_env: "development"\n', encoding="utf-8")
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "http://MTC-AIML-02:3001,http://LOCALHOST:3001,http://127.0.0.1:3001",
    )

    settings = create_settings_from_yaml(settings_yaml)

    assert settings.cors_origins == [
        "http://mtc-aiml-02:3001",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
