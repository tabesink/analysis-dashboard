<#
.SYNOPSIS
    RSP Dashboard - non-container LAN smoke deploy for Windows.

.DESCRIPTION
    PowerShell mirror of start-server-lan.sh. Builds the Next.js client for
    production, starts the FastAPI backend on all interfaces, and serves the
    standalone frontend for trusted-LAN smoke testing.

    Workflow:
        cd analysis-dashboard\Dashboard
        .\scripts\start-server-lan.ps1

    Requires: uv, node, npm. Firewall may need inbound rules on 8000/3001 for
    remote LAN clients.
#>

[CmdletBinding()]
param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 3001
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

function Test-PortInUse([int]$Port) {
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conn) { return $true }
    }
    $pattern = ":\s*$Port\s+.*LISTENING"
    return $null -ne (netstat -ano | Select-String -Pattern $pattern)
}

function Stop-ChildProcess([System.Diagnostics.Process]$Process) {
    if ($null -eq $Process -or $Process.HasExited) { return }
    try {
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    } catch {
        # Best-effort cleanup on exit.
    }
}

function Prepare-Standalone([string]$ClientDir) {
    $standaloneRoot = Join-Path $ClientDir '.next\standalone'
    $serverJs = Join-Path $standaloneRoot 'server.js'
    if (-not (Test-Path -LiteralPath $serverJs)) {
        throw 'Expected .next/standalone/server.js after build. Run npm run build first.'
    }

    $nextStaticSrc = Join-Path $ClientDir '.next\static'
    $nextStaticDst = Join-Path $standaloneRoot '.next\static'
    $publicSrc = Join-Path $ClientDir 'public'
    $publicDst = Join-Path $standaloneRoot 'public'

    New-Item -ItemType Directory -Force -Path (Join-Path $standaloneRoot '.next'), $publicDst | Out-Null
    if (Test-Path -LiteralPath $nextStaticDst) {
        Remove-Item -Recurse -Force -LiteralPath $nextStaticDst
    }
    Copy-Item -Recurse -Force -LiteralPath $nextStaticSrc -Destination $nextStaticDst
    Copy-Item -Recurse -Force -Path (Join-Path $publicSrc '*') -Destination $publicDst
}

function Wait-ForAnyProcess([System.Diagnostics.Process[]]$Processes) {
    if ($PSVersionTable.PSVersion.Major -ge 7) {
        Wait-Process -Id ($Processes | ForEach-Object { $_.Id }) -Any
        return
    }

    while ($true) {
        foreach ($proc in $Processes) {
            if ($proc.HasExited) { return }
        }
        Start-Sleep -Milliseconds 500
    }
}

if ($env:BACKEND_PORT) { $BackendPort = [int]$env:BACKEND_PORT }
if ($env:FRONTEND_PORT) { $FrontendPort = [int]$env:FRONTEND_PORT }

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ServerDir = Join-Path $RepoRoot 'server'
$ClientDir = Join-Path $RepoRoot 'client'
$LanHostname = [System.Net.Dns]::GetHostName().ToLowerInvariant()

foreach ($cmd in @('uv', 'node', 'npm')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Required command not found in PATH: $cmd"
    }
}

if (Test-PortInUse -Port $BackendPort) {
    Write-Error "Backend port $BackendPort is already in use. Stop existing process first."
    exit 1
}
if (Test-PortInUse -Port $FrontendPort) {
    Write-Error "Frontend port $FrontendPort is already in use. Stop existing process first."
    exit 1
}

# Non-container LAN mode:
# - Backend uses development env so HTTP auth cookies can be set on LAN
# - Backend binds to all interfaces for remote access
$env:APP_ENV = 'development'
$env:HOST = '0.0.0.0'
$env:DEBUG = 'false'
$env:SETTINGS_YAML_PATH = Join-Path $ServerDir 'settings.yaml'
if (-not $env:ADMIN_SECRET) { $env:ADMIN_SECRET = 'dev-admin-password-change-me' }
if (-not $env:JWT_SECRET) { $env:JWT_SECRET = 'dev-jwt-secret-change-me' }
if (-not $env:CORS_ORIGINS) {
    $env:CORS_ORIGINS = "http://localhost:$FrontendPort,http://127.0.0.1:$FrontendPort,http://${LanHostname}:$FrontendPort"
}

$backend = $null
$frontend = $null
$exitCode = 0

try {
    Write-Step "Starting backend on 0.0.0.0:$BackendPort..."
    $backend = Start-Process -FilePath 'uv' `
        -ArgumentList @('run', '--project', $ServerDir, 'python', '-m', 'server') `
        -WorkingDirectory $RepoRoot `
        -PassThru `
        -NoNewWindow

    Push-Location -LiteralPath $ClientDir
    try {
        Write-Step 'Building frontend for production...'
        npm ls --depth=0 js-yaml 2>$null | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Installing frontend dependencies (missing js-yaml)...'
            npm install
            if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
        }

        npm run build
        if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }

        Prepare-Standalone -ClientDir $ClientDir

        Write-Step "Starting frontend on 0.0.0.0:$FrontendPort..."
        $env:HOSTNAME = '0.0.0.0'
        $env:PORT = "$FrontendPort"
        $frontend = Start-Process -FilePath 'node' `
            -ArgumentList @('.next/standalone/server.js') `
            -WorkingDirectory $ClientDir `
            -PassThru `
            -NoNewWindow
    } finally {
        Pop-Location
    }

    Write-Host "Backend PID: $($backend.Id)"
    Write-Host "Frontend PID: $($frontend.Id)"
    Write-Host "App URL: http://${LanHostname}:$FrontendPort"

    Wait-ForAnyProcess -Processes @($backend, $frontend)
    if ($backend.HasExited -and $backend.ExitCode -ne 0) {
        $exitCode = $backend.ExitCode
    } elseif ($frontend.HasExited -and $frontend.ExitCode -ne 0) {
        $exitCode = $frontend.ExitCode
    }
} catch {
    Write-Error $_
    $exitCode = 1
} finally {
    Stop-ChildProcess -Process $backend
    Stop-ChildProcess -Process $frontend
}

exit $exitCode
