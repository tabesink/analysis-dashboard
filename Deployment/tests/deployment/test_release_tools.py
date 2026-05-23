from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
DEPLOYMENT_DIR = REPO_ROOT / "Deployment"


class DeploymentReleaseToolsTest(unittest.TestCase):
    def test_promote_unreleased_moves_notes_to_dated_version(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            changelog = tmp_path / "CHANGELOG.md"
            changelog.write_text(
                textwrap.dedent(
                    """\
                    # Changelog

                    ## [Unreleased]

                    ### Added
                    - New release workflow.

                    ### Fixed
                    - Release checksum verification.

                    ## [1.1.0] - 2026-03-31

                    ### Added
                    - Previous release.
                    """
                ),
                encoding="utf-8",
            )

            subprocess.run(
                [
                    "bash",
                    str(DEPLOYMENT_DIR / "scripts" / "promote_unreleased.sh"),
                    "--changelog",
                    str(changelog),
                    "--version",
                    "1.2.0",
                    "--date",
                    "2026-05-15",
                ],
                check=True,
            )

            updated = changelog.read_text(encoding="utf-8")
            self.assertIn("## [Unreleased]\n\n## [1.2.0] - 2026-05-15", updated)
            self.assertIn("- New release workflow.", updated)
            self.assertIn("- Release checksum verification.", updated)
            self.assertIn("## [1.1.0] - 2026-03-31", updated)

    def test_promote_unreleased_fails_when_unreleased_is_empty(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            changelog = Path(tmp) / "CHANGELOG.md"
            changelog.write_text("# Changelog\n\n## [Unreleased]\n", encoding="utf-8")

            result = subprocess.run(
                [
                    "bash",
                    str(DEPLOYMENT_DIR / "scripts" / "promote_unreleased.sh"),
                    "--changelog",
                    str(changelog),
                    "--version",
                    "1.2.0",
                    "--date",
                    "2026-05-15",
                ],
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("[Unreleased] section is empty", result.stderr)

    def test_promote_unreleased_fails_when_target_version_exists(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            changelog = Path(tmp) / "CHANGELOG.md"
            changelog.write_text(
                textwrap.dedent(
                    """\
                    # Changelog

                    ## [Unreleased]

                    ### Added
                    - New release workflow.

                    ## [1.2.0] - 2026-05-15

                    ### Added
                    - Existing release.
                    """
                ),
                encoding="utf-8",
            )

            result = subprocess.run(
                [
                    "bash",
                    str(DEPLOYMENT_DIR / "scripts" / "promote_unreleased.sh"),
                    "--changelog",
                    str(changelog),
                    "--version",
                    "1.2.0",
                    "--date",
                    "2026-05-15",
                ],
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("already contains a release section for 1.2.0", result.stderr)

    def test_extract_release_notes_writes_only_requested_version(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            changelog = tmp_path / "CHANGELOG.md"
            changelog.write_text(
                textwrap.dedent(
                    """\
                    # Changelog

                    ## [Unreleased]

                    ### Added
                    - Future work.

                    ## [1.2.0] - 2026-05-15

                    ### Added
                    - Single-origin LAN deployment.

                    ### Fixed
                    - Release bundle notes.

                    ## [1.1.0] - 2026-03-31

                    ### Added
                    - Previous release.
                    """
                ),
                encoding="utf-8",
            )
            output = tmp_path / "RELEASE_NOTES.md"

            subprocess.run(
                [
                    sys.executable,
                    str(DEPLOYMENT_DIR / "scripts" / "extract_release_notes.py"),
                    "--changelog",
                    str(changelog),
                    "--version",
                    "1.2.0",
                    "--output",
                    str(output),
                ],
                check=True,
            )

            notes = output.read_text(encoding="utf-8")
            self.assertIn("# RSP Dashboard 1.2.0 Release Notes", notes)
            self.assertIn("Single-origin LAN deployment.", notes)
            self.assertIn("Release bundle notes.", notes)
            self.assertNotIn("Future work.", notes)
            self.assertNotIn("Previous release.", notes)

    def test_release_wrapper_requires_changelog_section_before_build(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            repo = tmp_path / "repo"
            dashboard = repo / "Dashboard"
            deployment = repo / "Deployment"
            scripts = dashboard / "scripts"
            scripts.mkdir(parents=True)
            deployment.mkdir()
            (deployment / "scripts").mkdir()

            shutil.copy2(DEPLOYMENT_DIR / "release.sh", deployment / "release.sh")
            shutil.copy2(
                DEPLOYMENT_DIR / "scripts" / "extract_release_notes.py",
                deployment / "scripts" / "extract_release_notes.py",
            )
            (dashboard / "CHANGELOG.md").write_text(
                "# Changelog\n\n## [Unreleased]\n",
                encoding="utf-8",
            )
            (scripts / "release_version.sh").write_text(
                "#!/usr/bin/env bash\nset -euo pipefail\necho \"$1\" > ../VERSION\n",
                encoding="utf-8",
            )
            (deployment / "build.sh").write_text(
                "#!/usr/bin/env bash\nset -euo pipefail\necho build-ran > build.marker\n",
                encoding="utf-8",
            )
            os.chmod(scripts / "release_version.sh", 0o755)
            os.chmod(deployment / "build.sh", 0o755)
            os.chmod(deployment / "release.sh", 0o755)

            result = subprocess.run(
                ["bash", str(deployment / "release.sh"), "1.2.0"],
                cwd=deployment,
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertNotEqual(result.returncode, 0)
            self.assertIn(
                "CHANGELOG.md does not contain a release section for 1.2.0",
                result.stderr,
            )
            self.assertFalse((deployment / "build.marker").exists())

    def test_root_release_wrapper_runs_full_release_flow(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            repo = tmp_path / "repo"
            dashboard = repo / "Dashboard"
            deployment = repo / "Deployment"
            scripts = dashboard / "scripts"
            deploy_scripts = deployment / "scripts"
            releases = deployment / "releases"
            scripts.mkdir(parents=True)
            deploy_scripts.mkdir(parents=True)
            releases.mkdir()

            shutil.copy2(REPO_ROOT / "release.sh", repo / "release.sh")
            shutil.copy2(
                DEPLOYMENT_DIR / "scripts" / "promote_unreleased.sh",
                deploy_scripts / "promote_unreleased.sh",
            )
            (dashboard / "CHANGELOG.md").write_text(
                textwrap.dedent(
                    """\
                    # Changelog

                    ## [Unreleased]

                    ### Added
                    - One-command release.
                    """
                ),
                encoding="utf-8",
            )
            (scripts / "release_version.sh").write_text(
                textwrap.dedent(
                    """\
                    #!/usr/bin/env bash
                    set -euo pipefail
                    grep -Fq "## [$1]" CHANGELOG.md
                    echo "$1" > VERSION
                    echo sync >> ../order.log
                    """
                ),
                encoding="utf-8",
            )
            (deployment / "release.sh").write_text(
                textwrap.dedent(
                    """\
                    #!/usr/bin/env bash
                    set -euo pipefail
                    test "${SKIP_VERSION_SYNC:-0}" = "1"
                    test "$(cat ../Dashboard/VERSION)" = "$1"
                    echo build >> ../order.log
                    printf 'bundle\\n' > "releases/rsp-dashboard-$1.tar.gz"
                    ( cd releases && sha256sum "rsp-dashboard-$1.tar.gz" > "rsp-dashboard-$1.tar.gz.sha256" )
                    """
                ),
                encoding="utf-8",
            )
            os.chmod(repo / "release.sh", 0o755)
            os.chmod(deploy_scripts / "promote_unreleased.sh", 0o755)
            os.chmod(scripts / "release_version.sh", 0o755)
            os.chmod(deployment / "release.sh", 0o755)

            result = subprocess.run(
                ["bash", str(repo / "release.sh"), "1.2.0"],
                cwd=repo,
                text=True,
                capture_output=True,
                check=True,
            )

            self.assertEqual((repo / "order.log").read_text(encoding="utf-8"), "sync\nbuild\n")
            self.assertIn("Release ready. Ship these files:", result.stdout)
            self.assertTrue((releases / "rsp-dashboard-1.2.0.tar.gz").exists())
            self.assertTrue((releases / "rsp-dashboard-1.2.0.tar.gz.sha256").exists())

    def test_compose_exposes_only_proxy_port_and_routes_api_and_health(self) -> None:
        compose = (DEPLOYMENT_DIR / "docker-compose.yml").read_text(encoding="utf-8")
        self.assertIn("proxy:", compose)
        self.assertIn('"${DASHBOARD_PORT:-3000}:8080"', compose)
        self.assertNotIn('"${SERVER_PORT:-8000}:8000"', compose)
        self.assertNotIn('"${CLIENT_PORT:-3000}:3000"', compose)
        self.assertNotIn("container_name:", compose)

        nginx_conf = (DEPLOYMENT_DIR / "nginx.conf").read_text(encoding="utf-8")
        self.assertIn("location /api/", nginx_conf)
        self.assertIn("proxy_pass http://server:8000", nginx_conf)
        self.assertIn("client_max_body_size 60G", nginx_conf)
        self.assertIn("proxy_request_buffering off", nginx_conf)
        self.assertIn("location /health", nginx_conf)
        self.assertIn("proxy_pass http://client:3000", nginx_conf)

    def test_deploy_dry_run_prints_single_proxy_url(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            bundle = Path(tmp) / "bundle"
            bundle.mkdir()
            shutil.copy2(DEPLOYMENT_DIR / "scripts" / "deploy.sh", bundle / "deploy.sh")
            (bundle / "docker-compose.yml").write_text("services: {}\n", encoding="utf-8")
            (bundle / ".env").write_text(
                "ADMIN_SECRET=not-the-placeholder\nDASHBOARD_PORT=3010\n",
                encoding="utf-8",
            )
            os.chmod(bundle / "deploy.sh", 0o755)

            result = subprocess.run(
                ["bash", str(bundle / "deploy.sh"), "--dry-run"],
                cwd=bundle,
                text=True,
                capture_output=True,
                check=True,
            )

            self.assertIn("Dashboard URL: http://localhost:3010", result.stdout)
            self.assertNotIn("API:", result.stdout)
            self.assertNotIn("UI:", result.stdout)

    def test_server_image_includes_root_version_file(self) -> None:
        dockerfile = (REPO_ROOT / "Dashboard" / "server" / "Dockerfile").read_text(
            encoding="utf-8"
        )

        self.assertIn("COPY VERSION ./VERSION", dockerfile)

    def test_client_image_includes_changelog_for_runtime_page(self) -> None:
        dockerfile = (REPO_ROOT / "Dashboard" / "client" / "Dockerfile").read_text(
            encoding="utf-8"
        )

        self.assertIn("COPY CHANGELOG.md /app/CHANGELOG.md", dockerfile)
        self.assertIn("COPY --from=builder /app/CHANGELOG.md ./CHANGELOG.md", dockerfile)


if __name__ == "__main__":
    unittest.main()
