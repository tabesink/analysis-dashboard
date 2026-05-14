# RSP Dashboard - LAN deployment

Plain-HTTP Docker Compose stack for trusted internal LAN deployments. No reverse
proxy, no certs, no `hosts` file edits, no per-host image rebuilds. The operator
edits one variable (`ADMIN_SECRET`) and runs one command.

> **Scope:** internal LAN only. This stack serves plain HTTP and intentionally
> opts the server out of its production-mode HTTPS guardrail. Do **not** expose
> these ports to the public internet without putting an HTTPS-terminating
> reverse proxy in front and reverting `ALLOW_INSECURE_COOKIES`.

---

## Two flows

### A. Build a release bundle (dev / build host)

```bash
cd Deployment
./build.sh
```

Produces `releases/rsp-dashboard-<VERSION>.tar.gz` plus `.sha256`. The bundle
contains exactly:

- `images.tar` - combined `docker save` of `rsp-dashboard-server` + `rsp-dashboard-client`
- `docker-compose.yml`
- `.env.example`
- `deploy.sh` / `deploy.ps1`
- `README.md` (this file)
- `VERSION`
- `CHECKSUMS.sha256`

`<VERSION>` comes from `Dashboard/VERSION`. To cut a new version, run
`Dashboard/scripts/release_version.sh <semver>` first.

### B. Deploy on the prod host

Linux:

```bash
scp releases/rsp-dashboard-<VERSION>.tar.gz{,.sha256} prod-host:/tmp/
ssh prod-host
sha256sum -c /tmp/rsp-dashboard-<VERSION>.tar.gz.sha256
sudo tar xzf /tmp/rsp-dashboard-<VERSION>.tar.gz -C /opt
cd /opt/rsp-dashboard-<VERSION>
cp .env.example .env
nano .env                       # set ADMIN_SECRET
chmod 600 .env
sudo ./deploy.sh
```

Windows / Docker Desktop (PowerShell as Administrator):

```powershell
# Copy the .tar.gz + .sha256 to the host (any way you like).
$expected = (Get-Content .\rsp-dashboard-<VERSION>.tar.gz.sha256).Split(' ')[0]
$actual   = (Get-FileHash .\rsp-dashboard-<VERSION>.tar.gz -Algorithm SHA256).Hash.ToLower()
if ($expected -ne $actual) { throw 'Checksum mismatch' }

tar -xzf .\rsp-dashboard-<VERSION>.tar.gz
cd .\rsp-dashboard-<VERSION>
Copy-Item .env.example .env
notepad .env                    # set ADMIN_SECRET
.\deploy.ps1
```

After `deploy.{sh,ps1}` finishes, the dashboard is at `http://<host>:3000`.

---

## What `deploy.sh` / `deploy.ps1` does

1. Refuses to run if `.env` is missing, `ADMIN_SECRET` is unset, or
   `ADMIN_SECRET=changeme` (the placeholder).
2. `docker load -i images.tar` (skipped if the file is absent and the images
   are already loaded).
3. `docker compose --env-file .env up -d`.
4. Polls `http://localhost:<SERVER_PORT>/health/ready` for up to 60 s.

Manual equivalent (if you want to skip the wrapper):

```bash
docker load -i images.tar
docker compose --env-file .env up -d
```

---

## `.env` reference

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `ADMIN_SECRET` | yes | (none) | Dashboard admin user password. Plaintext or bcrypt hash. Used by `Dashboard/server/services/auth.py`. |
| `IMAGE_TAG` | no | the bundle's `VERSION` | Override only if you want to run a different image version than the one shipped in `images.tar`. |
| `CLIENT_PORT` | no | `3000` | Host port for the Next.js client. |
| `SERVER_PORT` | no | `8000` | Host port for the FastAPI server. |
| `SLOW_QUERY_MS` | no | `1000` | Slow-request threshold (ms) for `app.log`. |

The deploy scripts pass `.env` to compose with `--env-file .env`. `JWT_SECRET`
is intentionally **not** in `.env` - the `jwt-init` service generates one on
first start and persists it in a Docker volume.

---

## Day-2 commands

From the unpacked bundle directory:

```bash
docker compose --env-file .env -f docker-compose.yml logs -f server
docker compose --env-file .env -f docker-compose.yml ps
docker compose --env-file .env -f docker-compose.yml restart server
docker compose --env-file .env -f docker-compose.yml down
```

Backup the database (with the stack stopped, to capture a quiesced WAL):

```bash
docker compose --env-file .env -f docker-compose.yml down
docker run --rm -v rsp-dashboard_data:/d -v "$PWD":/b alpine \
    tar czf /b/dashboard-data-$(date +%F).tar.gz -C /d .
docker compose --env-file .env -f docker-compose.yml up -d
```

Rotating `ADMIN_SECRET`:

```bash
nano .env                       # change ADMIN_SECRET
docker compose --env-file .env -f docker-compose.yml up -d --force-recreate server
```

Rotating `JWT_SECRET` (invalidates all existing user sessions):

```bash
docker volume rm rsp-dashboard_jwt
docker compose --env-file .env -f docker-compose.yml up -d
```

---

## Trade-offs you accepted by deploying this stack

- **Plaintext HTTP on the LAN.** Anyone with packet capture on the LAN can
  observe API requests, session cookies, and the admin password during login.
  This is the same threat model as any internal HTTP intranet app -
  industry-normal for trusted corporate LANs, **never acceptable for
  internet-facing deployments**.
- **`AUTH_COOKIE_SECURE=false` and `ALLOW_INSECURE_COOKIES=true`.** The
  server's production-mode validator would normally reject these. The compose
  file opts in deliberately. `SameSite=Lax` is still set, so most CSRF vectors
  are covered.
- **`CORS_ORIGINS=*`.** Acceptable on a LAN where the server is unreachable
  from outside. Tighten to the exact LAN origin if you know it.
- **`.env` lives on disk with the admin password in it.** `chmod 600 .env`
  and treat the host as a secrets-bearing machine. Don't commit `.env`.
- **No external HTTPS proxy.** If you ever expose this beyond the LAN, put
  Caddy / nginx / traefik in front, terminate TLS, set `AUTH_COOKIE_SECURE=true`
  and `ALLOW_INSECURE_COOKIES=false`, and lock `CORS_ORIGINS` down.

---

## How the client knows where the server lives

The client image does not bake an API URL at build time. At runtime, the
browser reads `window.location.hostname` and constructs
`http://<that-host>:<SERVER_PORT>` for every API call. That's why one image
works on every LAN host with no rebuild.

If you ever need to override (e.g. server on a different host than the client),
build the client with `NEXT_PUBLIC_API_URL=http://api.foo.lan:8000` set and the
runtime fallback is bypassed.
