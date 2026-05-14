# Build → Hand-off → Windows Deploy

End-to-end walkthrough using the new `Deployment/` setup. Treats the build host (your Linux dev box) and the prod host (a Windows machine running Docker Desktop) as two separate steps.

---

## Part 1 — Build the release bundle (on your Linux dev box)

Prereqs on the build host: `docker` (with the compose v2 plugin) and `python3` + PyYAML (only used by the preflight to parse `schema.yaml`).

### Step 1 — Confirm the version is what you want to ship

```bash
cat Dashboard/VERSION
# 1.1.0
python3 Dashboard/scripts/check_version_sync.py
```

If you need to bump first, run `Dashboard/scripts/release_version.sh <semver>` and then update `Dashboard/CHANGELOG.md` (move `[Unreleased]` entries into a new `## [X.Y.Z] - YYYY-MM-DD` block). The build's preflight will warn if `CHANGELOG.md` doesn't mention the version.

### Step 2 — Run the build

```bash
cd Deployment
./build.sh
```

What it does, in order:

1. **Preflight.** Asserts `Dashboard/VERSION` is valid SemVer, `Dashboard/server/schema.yaml` parses as YAML, and `CHANGELOG.md` mentions the version (warning only).
2. **Build images** (no `NEXT_PUBLIC_API_URL` build-arg — the client resolves the API host at runtime now):
   - `rsp-dashboard-server:<VERSION>`
   - `rsp-dashboard-client:<VERSION>`
3. **Save** both images into a single `images.tar` via `docker save`.
4. **Bundle** the operator-facing files. The bundled `docker-compose.yml` is sed-rewritten so its `IMAGE_TAG` default matches the version you just built — devops doesn't need to set `IMAGE_TAG` in `.env` unless they want to override.
5. **Checksum + tar.gz.** Per-file `CHECKSUMS.sha256` inside the bundle, plus an outer `.sha256` next to the `.tar.gz`.

### Step 3 — Verify the output

```bash
ls -lh Deployment/releases/
# rsp-dashboard-1.1.0/                      (the unpacked bundle)
# rsp-dashboard-1.1.0.tar.gz                (what you ship)
# rsp-dashboard-1.1.0.tar.gz.sha256         (what they verify with)

sha256sum -c Deployment/releases/rsp-dashboard-1.1.0.tar.gz.sha256
```

The unpacked bundle (`Deployment/releases/rsp-dashboard-1.1.0/`) contains exactly:

| File | Purpose |
| --- | --- |
| `images.tar` | Combined `docker save` of server + client (the only large file, ~hundreds of MB). |
| `docker-compose.yml` | The stack definition (`jwt-init` + `server` + `client`). |
| `.env.example` | Template for the operator. Only `ADMIN_SECRET` is required. |
| `deploy.sh` | One-command Linux deploy. |
| `deploy.ps1` | One-command Windows / Docker Desktop deploy. |
| `README.md` | Operator-facing instructions (this is the one devops reads, not the repo `README.md`). |
| `VERSION` | Plain text, the version number. Useful for `docker compose ps` cross-checks. |
| `CHECKSUMS.sha256` | Per-file SHA-256 of every file above (defense-in-depth). |

---

## Part 2 — What to hand to the devops engineer

**Two files. That's it.**

```
Deployment/releases/rsp-dashboard-1.1.0.tar.gz
Deployment/releases/rsp-dashboard-1.1.0.tar.gz.sha256
```

Email/SFTP/share-drive — whatever your handoff channel is. They don't need access to the repo, they don't need `git`, they don't need to install anything on the build side.

Tell them:

- **Prereq on the Windows host:** Docker Desktop 4.x or later (ships with Compose v2; `tar` and `curl.exe` are already in PowerShell on Windows 10/11).
- **One required edit:** set `ADMIN_SECRET` in `.env`. Every other variable is optional.
- **Result:** dashboard reachable at `http://<windows-host>:3000` from any machine on the LAN.

---

## Part 3 — Windows / Docker Desktop deploy (what devops does)

All commands run in **PowerShell**. Open it as **Administrator** if your host port 3000/8000 needs admin to bind (usually fine for non-admin on dev boxes; required if a corporate firewall policy locks low ports).

### Step 1 — Drop both files somewhere writeable

Pick any working folder. Example:

```powershell
mkdir C:\rsp-dashboard
cd C:\rsp-dashboard
# copy rsp-dashboard-1.1.0.tar.gz and .sha256 into here, any way you like
```

### Step 2 — Verify the checksum

```powershell
$expected = (Get-Content .\rsp-dashboard-1.1.0.tar.gz.sha256).Split(' ')[0].Trim().ToLower()
$actual   = (Get-FileHash .\rsp-dashboard-1.1.0.tar.gz -Algorithm SHA256).Hash.ToLower()
if ($expected -ne $actual) { throw "Checksum mismatch! Expected $expected, got $actual" }
"OK"
```

### Step 3 — Extract the bundle

`tar` is built into modern Windows. If you'd rather use a GUI, 7-Zip works too; the layout below is what you should end up with.

```powershell
tar -xzf .\rsp-dashboard-1.1.0.tar.gz
cd .\rsp-dashboard-1.1.0
dir
# images.tar, docker-compose.yml, .env.example, deploy.sh, deploy.ps1,
# README.md, VERSION, CHECKSUMS.sha256
```

### Step 4 — Configure the admin password

```powershell
Copy-Item .env.example .env
notepad .env
```

In Notepad, change the line:

```env
ADMIN_SECRET=changeme
```

…to a real password, e.g.

```env
ADMIN_SECRET=S0meStrongPasswordHere!
```

Save and close. Leave the rest of the file alone unless you need to override ports.

> If you want to be cautious, also lock the file down so only this user can read it:
> ```powershell
> icacls .env /inheritance:r /grant:r "$env:USERNAME:(R,W)"
> ```

### Step 5 — Run the one-command deploy

```powershell
.\deploy.ps1
```

If PowerShell blocks the script with an execution-policy error, unblock it for this session only:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
.\deploy.ps1
```

What `deploy.ps1` does, in order, and what you'll see on screen:

1. **Preflight.** Confirms `docker` and `curl.exe` are on PATH and that Docker Desktop's compose v2 plugin is alive.
2. **Validates `.env`.** Refuses to continue if it's missing, if `ADMIN_SECRET` is empty, or if it's still the `changeme` placeholder.
3. **`docker load -i images.tar`.** Loads the two images into Docker Desktop. This is the only step that takes a while (hundreds of MB).
4. **`docker compose --env-file .env -f docker-compose.yml config`.** Validates the rendered compose.
5. **`docker compose … up -d`.** Starts `jwt-init` (one-shot — generates `JWT_SECRET` into a Docker volume on first run only), then `server`, then `client`.
6. **Health poll.** Hits `http://localhost:8000/health/ready` every 2 s for up to 60 s. On `200`, prints:
   ```
   Dashboard is up:
       UI:  http://<host>:3000
       API: http://<host>:8000
   ```

### Step 6 — Smoke test

From the Windows host:

```powershell
curl.exe http://localhost:8000/health/ready
# {"status":"ok",...}
```

From any other machine on the LAN, open a browser to `http://<windows-hostname-or-ip>:3000`. Log in as `admin` / `<the password you put in .env>`.

---

## Day-2 commands (Windows, from inside `C:\rsp-dashboard\rsp-dashboard-1.1.0`)

```powershell
# Tail the server logs
docker compose --env-file .env -f docker-compose.yml logs -f server

# Status
docker compose --env-file .env -f docker-compose.yml ps

# Restart just the server (e.g. after rotating ADMIN_SECRET in .env)
docker compose --env-file .env -f docker-compose.yml up -d --force-recreate server

# Stop the stack (data and JWT volumes are preserved)
docker compose --env-file .env -f docker-compose.yml down
```

---

## Common Windows gotchas

| Symptom | Cause | Fix |
| --- | --- | --- |
| `deploy.ps1 cannot be loaded because running scripts is disabled on this system` | Default ExecutionPolicy | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force`, then re-run. |
| `Bind for 0.0.0.0:3000 failed: port is already allocated` | Another process is on 3000 or 8000 | Edit `.env`, set `CLIENT_PORT=` and/or `SERVER_PORT=` to free ports, re-run `.\deploy.ps1`. |
| `docker: error during connect... open //./pipe/docker_engine` | Docker Desktop not running | Start Docker Desktop, wait for the whale icon to go solid, retry. |
| Browser hits the UI but API calls 404/CORS-fail | The Windows host's firewall is blocking port 8000 from the LAN | Open inbound TCP 8000 in Windows Defender Firewall. The browser's runtime URL resolver assumes port 8000 is reachable from wherever the browser is. |
| `error: ADMIN_SECRET in .env is still 'changeme'` | Step 4 was skipped or saved with the placeholder | Open `.env`, set a real password, save, re-run. |
| Deploy succeeds, but old code is running | `IMAGE_TAG=` is set in `.env` to an older version | Delete that line from `.env` (the bundle's compose pins to the bundle's version by default), then `.\deploy.ps1`. |

---

## TL;DR for the handoff email

> Attached: `rsp-dashboard-1.1.0.tar.gz` and `rsp-dashboard-1.1.0.tar.gz.sha256`.
>
> On the Windows host (Docker Desktop required):
> 1. Verify checksum, then `tar -xzf rsp-dashboard-1.1.0.tar.gz`.
> 2. `cd rsp-dashboard-1.1.0`, `Copy-Item .env.example .env`, edit `.env` and set `ADMIN_SECRET`.
> 3. `.\deploy.ps1`.
>
> Dashboard will be at `http://<this-host>:3000`. Full instructions are in the `README.md` inside the bundle.
