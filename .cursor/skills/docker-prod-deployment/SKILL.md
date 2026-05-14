---
name: docker-prod-deployment
description: Harden any Dockerized application for production with non-root users, read-only root filesystems, dropped Linux capabilities, file-based secrets, scoped networks, pinned image tags, runtime-appropriate healthchecks, resource limits, and a TLS-terminating reverse proxy. Use when authoring or reviewing a production docker-compose file, a Dockerfile intended for production, a reverse-proxy config, secret rotation, or when the user mentions "production deployment", "harden", "docker compose prod", "production dockerfile", or asks for a deployment review.
---

# Docker production deployment

Apply this skill whenever the work touches a production-bound Docker artifact: `docker-compose*.prod.yml`, a `Dockerfile` whose image runs in production, a reverse-proxy config, or secret material.

The agent is already fluent with Docker syntax. This skill exists to prevent the specific failure modes that turn working dev containers into vulnerable production deployments.

## Adaptation workflow

Before changing anything, read the project to fit the recommendations to the actual stack.

```
Step 1 - Inventory:
  - Find all Dockerfiles. Note base image, runtime (Python/Node/Go/Java/...), exposed ports, current USER directive.
  - Find all docker-compose*.yml. Note services, host port bindings, networks, volumes, secrets handling.
  - Read AGENTS.md / README in deployment dirs for project-specific conventions.
  - Identify health endpoints in the application source (e.g. /health, /healthz, /api/health/ready).
  - Identify secret material currently in environment: blocks or .env files.

Step 2 - Diff against the hardening checklist (below). List every gap.

Step 3 - Propose minimal-diff changes:
  - Do not rewrite working multi-stage builds.
  - Match runtime-appropriate patterns (no curl-based healthchecks on alpine/distroless).
  - Preserve existing dev compose; create a separate *.prod.yml rather than mutating dev.

Step 4 - Verify after applying. Run the verification commands at the end of this file.
```

## Non-negotiable hardening checklist

Every production service must satisfy all of the following. If any is omitted, justify it explicitly.

| # | Requirement | Compose key / Dockerfile directive |
|---|---|---|
| 1 | Pinned image (tag, ideally digest); never `:latest` | `image: name:1.2.3@sha256:...` |
| 2 | Non-root user with fixed UID | `USER 1001:1001` (Dockerfile) and `user: "1001:1001"` (compose) |
| 3 | Read-only root filesystem | `read_only: true` |
| 4 | Writable scratch via tmpfs | `tmpfs: ["/tmp:size=64M,mode=1777"]` |
| 5 | All Linux capabilities dropped | `cap_drop: [ALL]`, `cap_add:` only what's documented as required |
| 6 | No privilege escalation | `security_opt: ["no-new-privileges:true"]` |
| 7 | Process count limit | `pids_limit: 200` (or higher for fork-heavy runtimes like JVM/Python multiprocessing) |
| 8 | CPU and memory limits | `deploy.resources.limits.{cpus,memory}` (Compose v2 honors this) |
| 9 | Restart policy | top-level `restart: unless-stopped` (NOT `deploy.restart_policy`, which is Swarm-only) |
| 10 | Healthcheck using a runtime-native client | see "Healthcheck patterns" |
| 11 | Log rotation | `logging.driver: json-file` with `max-size`, `max-file` |
| 12 | Application services have NO `ports:` mapping | only the reverse proxy binds host ports |

## Compose v2 vs Swarm gotchas

A common failure mode is copying Swarm-only directives into a plain Compose file where they are silently ignored.

| Directive | Plain `docker compose` | Swarm `docker stack deploy` |
|---|---|---|
| `deploy.resources.limits` | Honored (Compose v2) | Honored |
| `deploy.resources.reservations` | Limited | Honored |
| `deploy.restart_policy` | **Ignored** - use top-level `restart:` | Honored |
| `deploy.replicas` | **Ignored** - use `--scale` | Honored |
| `deploy.update_config` | **Ignored** | Honored |
| `deploy.rollback_config` | **Ignored** | Honored |
| `deploy.placement` | **Ignored** | Honored |

Rule: in plain Compose, only `deploy.resources.limits` is reliable. Everything else under `deploy:` should be assumed Swarm-only unless verified.

## Secret handling

Never put secrets in `environment:` blocks or in any `.env*` file checked into source. Use file-based secrets:

```yaml
# In each service that needs the secret:
secrets:
  - api_key

# At the bottom of the compose file:
secrets:
  api_key:
    file: ./secrets/api_key
```

The file is mounted at `/run/secrets/api_key` (mode 0400). If the application reads its config from environment variables, load the secret at container start with an entrypoint:

```yaml
command:
  - sh
  - -c
  - |
    export API_KEY="$$(cat /run/secrets/api_key)"
    exec /app/start
```

The `$$` escapes Compose's variable interpolation so a literal `$(...)` reaches the shell.

Secret hygiene rules:
- `chmod 600` on every secret file on disk.
- Add `secrets/` to `.gitignore` with an allowlist for `.example` placeholders.
- Generate symmetric secrets with `openssl rand -hex 32` (32 bytes minimum).
- Rotation: rewrite the file, then `docker compose up -d --force-recreate <service>`.

## Network topology rule

Three-tier pattern, from most exposed to least:

```
edge_net   - external bridge - reverse proxy only - host ports 80/443 mapped here
app_net    - internal: true  - reverse proxy + app services - no internet egress
backend_net- internal: true  - app services + datastores (db, cache) - no internet egress
```

Two-tier (when there is no separate datastore):

```
edge_net   - external bridge - reverse proxy only - host ports 80/443
app_net    - internal: true  - reverse proxy + app services
```

Setting `internal: true` blocks outbound internet from any container attached only to that network, which limits exfiltration paths if a service is compromised. Inbound host port mappings still work because they are NAT-ed by docker-proxy independent of network egress.

Application services must not declare `ports:` in production compose. The reverse proxy is the only public surface.

## Reverse proxy choice

| Proxy | Strength | Pick when |
|---|---|---|
| Caddy | Simplest config; auto TLS via ACME or `tls internal` for LAN | Default choice |
| Nginx | Largest ecosystem, most documentation | Team already runs nginx or needs an obscure module |
| Traefik | Label-driven service discovery | Many dynamic services, frequent topology changes |

Required headers in production (regardless of proxy):

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options:    nosniff
X-Frame-Options:           DENY
Referrer-Policy:           strict-origin-when-cross-origin
Permissions-Policy:        geolocation=(), microphone=(), camera=()
Server:                    (suppressed)
```

For full reverse-proxy snippets see [reference.md](reference.md).

## Healthcheck patterns

Pick the snippet that matches the container's runtime. Do not assume `curl` exists.

```yaml
# Python (any image with python on PATH)
test:
  - CMD
  - python
  - -c
  - "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:<PORT><PATH>').status==200 else 1)"

# Node alpine (wget is built-in)
test: ["CMD", "wget", "--spider", "-q", "http://localhost:<PORT><PATH>"]

# Distroless / scratch / no shell
# Bake a tiny health binary into the image and call it directly.
test: ["CMD", "/app/healthcheck"]

# Last resort - TCP port probe (no app-level liveness)
test: ["CMD", "nc", "-z", "localhost", "<PORT>"]
```

Liveness vs readiness:
- **Liveness** = process is alive. Failing this restarts the container.
- **Readiness** = dependencies are reachable (DB, cache, upstream). Use this in `depends_on.condition: service_healthy` so dependent services wait until the upstream is actually serving requests.

Set `start_period` generously (30-60s) for slow-starting runtimes (JVM, large Python apps) to avoid restart loops during boot.

## Pre-deploy verification

Run before the first production `up` and after every prod compose change:

```bash
# 1. Compose syntax + secret resolution
docker compose -f docker-compose.prod.yml config >/dev/null

# 2. Bring up
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps   # all services should report (healthy)

# 3. Hardening took effect
docker inspect $(docker compose -f docker-compose.prod.yml ps -q) \
  | jq '.[] | {name:.Name, ro:.HostConfig.ReadonlyRootfs, caps:.HostConfig.CapDrop, sec:.HostConfig.SecurityOpt, pids:.HostConfig.PidsLimit, user:.Config.User}'
# Expect: ro=true, caps=["ALL"], sec contains "no-new-privileges:true", pids set, user not empty/0

# 4. Containers running as non-root
for c in $(docker compose -f docker-compose.prod.yml ps -q); do
  docker exec "$c" id 2>/dev/null || echo "no shell - check user: in compose"
done

# 5. Secrets reach the process but are not in plain env files
docker exec <service> printenv | grep -iE 'secret|password|token|key' | sed 's/=.*/=<redacted>/'

# 6. Application services do not have host ports
docker compose -f docker-compose.prod.yml ps --format json | jq '.[] | select(.Publishers != null) | {Service, Publishers}'
# Expect: only the reverse proxy in the output
```

## Anti-patterns to refuse

When asked to apply any of the following, push back and propose the safer alternative:

| Anti-pattern | Why it's wrong | Alternative |
|---|---|---|
| `image: foo:latest` | No reproducibility, no rollback, no provenance | Pin tag and digest |
| Secrets (`API_KEY`, `DB_PASSWORD`, signing keys, etc.) in `environment:` or committed `.env` | Ends up in `docker inspect`, image layers, logs, git history | File-based secret + entrypoint export |
| Application service with `ports: ["8080:8080"]` in prod | Bypasses reverse proxy, no TLS, no security headers | Remove `ports:`, route through proxy |
| `privileged: true` | Removes the entire container security boundary | `cap_add` only the specific capability needed |
| Mounting `/var/run/docker.sock` into an app container | Equivalent to root on the host | Use a dedicated socket-proxy with strict allowlist, on its own network |
| Mounting host `/` into any container | Exposes `/etc/shadow`, SSH keys, secrets | Mount only the specific paths needed, read-only |
| `cors_origins: ["*"]` (or equivalent) | Disables browser same-origin protections | Pin to the exact public origin |
| `deploy.restart_policy:` in plain Compose | Silently ignored; container will not auto-restart | Use top-level `restart: unless-stopped` |
| `HEALTHCHECK ... curl ...` on alpine/distroless | curl is not installed; healthcheck always fails | Use the runtime-native pattern from this skill |
| No `USER` directive in Dockerfile | Container runs as root | Add `RUN useradd ...` and `USER 1001:1001` |
| Cadvisor / monitoring containers with the host mount on the app stack | Vastly expands blast radius | Run monitoring on a separate, isolated stack |

## Pointers

- Starter `docker-compose.prod.yml` template, full Caddy/Nginx/Traefik snippets, and a per-runtime healthcheck cookbook are in [reference.md](reference.md). Read it when generating a fresh prod compose from scratch.
