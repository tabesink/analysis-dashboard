<#
.SYNOPSIS
    RSP Dashboard - one-command LAN deploy for Windows / Docker Desktop.

.DESCRIPTION
    PowerShell mirror of deploy.sh. Run from this folder on the prod host.

    Workflow:
        Copy-Item .env.example .env
        notepad .env                # set ADMIN_SECRET to a real password
        .\deploy.ps1

    What it does:
      1. Validates .env exists and ADMIN_SECRET is not the placeholder.
      2. If images.tar is present, `docker load` it.
      3. `docker compose --env-file .env up -d`.
      4. Waits up to 60 s for http://localhost:<SERVER_PORT>/health/ready -> 200.

    Requires: Docker Desktop (with compose v2) and curl.exe (ships with
    Windows 10/11). Run from an elevated PowerShell prompt if your host ports
    require admin to bind.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Sub($msg)  { Write-Host "    $msg" }

Push-Location -LiteralPath $PSScriptRoot
try {
    # --- preflight ----------------------------------------------------------
    foreach ($cmd in @('docker','curl.exe')) {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
            throw "required command not found in PATH: $cmd"
        }
    }
    & docker compose version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "'docker compose' (v2) plugin not available" }

    # --- 1. Validate .env ---------------------------------------------------
    if (-not (Test-Path -LiteralPath .\.env)) {
        Write-Error "`.env not found. Run: Copy-Item .env.example .env, then edit .env to set ADMIN_SECRET."
        exit 1
    }
    $envLines = Get-Content -LiteralPath .\.env
    $adminLine = $envLines | Where-Object { $_ -match '^\s*ADMIN_SECRET=' } | Select-Object -Last 1
    if (-not $adminLine) {
        Write-Error 'ADMIN_SECRET is missing from .env.'
        exit 1
    }
    if ($adminLine -match '^\s*ADMIN_SECRET=changeme\s*$') {
        Write-Error "ADMIN_SECRET in .env is still 'changeme'. Set a real password."
        exit 1
    }
    if ($adminLine -match '^\s*ADMIN_SECRET=\s*$') {
        Write-Error 'ADMIN_SECRET in .env is empty.'
        exit 1
    }

    # --- 2. Load images if a build bundle is present ------------------------
    if (Test-Path -LiteralPath .\images.tar) {
        Write-Step 'Loading images from images.tar'
        & docker load -i .\images.tar
        if ($LASTEXITCODE -ne 0) { throw 'docker load failed' }
    } else {
        Write-Step 'No images.tar found; assuming images are already loaded in Docker'
    }

    # --- 3. Bring stack up --------------------------------------------------
    $composeArgs = @('compose','--env-file','.env','-f','docker-compose.yml')

    Write-Step 'Validating compose config'
    & docker @composeArgs config | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'docker compose config failed' }

    Write-Step 'Starting stack'
    & docker @composeArgs up -d
    if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed' }
    & docker @composeArgs ps

    # --- 4. Health check ----------------------------------------------------
    function Get-EnvPort([string]$key, [int]$default) {
        $line = $envLines | Where-Object { $_ -match "^\s*$key=" } | Select-Object -Last 1
        if ($line -and ($line -match "^\s*$key=(.+)$")) {
            $val = $Matches[1].Trim()
            if ($val) { return $val }
        }
        return $default
    }
    $serverPort = Get-EnvPort 'SERVER_PORT' 8000
    $clientPort = Get-EnvPort 'CLIENT_PORT' 3000
    $url = "http://localhost:$serverPort/health/ready"

    Write-Step "Waiting up to 60 s for $url"
    for ($i = 0; $i -lt 30; $i++) {
        $code = & curl.exe -s -o NUL -w '%{http_code}' $url 2>$null
        if ($code -eq '200') {
            $hostname = [System.Net.Dns]::GetHostName()
            Write-Sub 'OK'
            Write-Host ''
            Write-Host 'Dashboard is up:' -ForegroundColor Green
            Write-Host "    UI:  http://${hostname}:${clientPort}"
            Write-Host "    API: http://${hostname}:${serverPort}"
            Write-Host ''
            Write-Host 'Day-2:'
            Write-Host ("    docker " + ($composeArgs -join ' ') + ' logs -f server')
            Write-Host ("    docker " + ($composeArgs -join ' ') + ' down')
            return
        }
        Start-Sleep -Seconds 2
    }

    Write-Warning 'Server did not become ready within 60 s. Investigate:'
    Write-Host ("    docker " + ($composeArgs -join ' ') + ' logs server')
    exit 1

} finally {
    Pop-Location
}
