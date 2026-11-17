#Requires -Version 7.0
<#
.SYNOPSIS
  RoofPro CRM — one-command launch.

.DESCRIPTION
  Bootstraps backend/.env (generating real secrets on first run), builds and starts
  the Docker stack (PostgreSQL + Redis + API + web), waits for health, optionally
  seeds the demo workspace, and prints URLs + credentials.

.EXAMPLE
  pwsh -File scripts/launch.ps1
  pwsh -File scripts/launch.ps1 -Rebuild -NoSeed
#>
[CmdletBinding()]
param(
  [switch]$Rebuild,
  [switch]$NoSeed,
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "    OK  $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    !!  $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "    XX  $msg" -ForegroundColor Red }

function New-HexSecret([int]$bytes = 32) {
  $buf = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($buf)
  return ($buf | ForEach-Object { $_.ToString('x2') }) -join ''
}

Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "  RoofPro CRM - Storm Intelligence Platform  |  launcher" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan

# ── 1. Prerequisites ────────────────────────────────────────────
Step 1 'Checking prerequisites'
foreach ($cmd in @('docker', 'node', 'npm')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Fail "$cmd not found on PATH. Install it and re-run."
    exit 1
  }
}
docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Fail 'docker compose (v2) is required.'; exit 1 }
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail 'Docker daemon is not running. Start Docker Desktop and re-run.'; exit 1 }
Ok "docker $(docker --version), node $(node --version)"

# ── 2. Environment bootstrap ────────────────────────────────────
Step 2 'Preparing backend/.env'
$envPath = Join-Path $Root 'backend/.env'
if (-not (Test-Path $envPath)) {
  Copy-Item (Join-Path $Root 'backend/.env.example') $envPath
  $content = Get-Content $envPath -Raw
  $content = $content -replace 'JWT_SECRET=.*', "JWT_SECRET=$(New-HexSecret 48)"
  $content = $content -replace 'JWT_REFRESH_SECRET=.*', "JWT_REFRESH_SECRET=$(New-HexSecret 48)"
  $content = $content -replace 'AI_ENCRYPTION_KEY=.*', "AI_ENCRYPTION_KEY=$(New-HexSecret 32)"
  Set-Content -Path $envPath -Value $content -Encoding utf8
  Ok 'created backend/.env with generated JWT + AI encryption secrets'
} else {
  $content = Get-Content $envPath -Raw
  if ($content -match '(?m)^AI_ENCRYPTION_KEY=\s*$') {
    $content = $content -replace '(?m)^AI_ENCRYPTION_KEY=\s*$', "AI_ENCRYPTION_KEY=$(New-HexSecret 32)"
    Set-Content -Path $envPath -Value $content -Encoding utf8
    Ok 'generated missing AI_ENCRYPTION_KEY'
  }
  if ($content -notmatch '(?m)^DATABASE_URL=') {
    Add-Content -Path $envPath -Value "`nDATABASE_URL=postgresql://postgres:roofpro123@localhost:5432/roofpro_crm?schema=public`nREDIS_URL=redis://localhost:6379"
    Ok 'added local DATABASE_URL / REDIS_URL'
  } else {
    Ok 'backend/.env already present'
  }
}

# ── 3. Build + start ─────────────────────────────────────────────
Step 3 'Building and starting the stack (postgres, redis, api, web)'
$args = @('compose', 'up', '-d')
if ($Rebuild) { $args += '--build' } else { $args += '--build' }
& docker @args
if ($LASTEXITCODE -ne 0) { Fail 'docker compose up failed. See: docker compose logs'; exit 1 }
Ok 'containers started'

# ── 4. Wait for health ──────────────────────────────────────────
Step 4 'Waiting for services to become healthy'
function Wait-Http($url, $name, [int]$timeoutSec = 180) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { Ok "$name reachable ($url)"; return $true }
    } catch { Start-Sleep -Seconds 3 }
  }
  Fail "$name did not become reachable within ${timeoutSec}s ($url)"
  return $false
}

$api = Wait-Http 'http://localhost:5000/api/v1/health' 'API' 240
$web = Wait-Http 'http://localhost:3000/' 'Web app' 120
if (-not ($api -and $web)) {
  Warn 'Recent backend logs:'
  docker compose logs --tail=40 backend
  exit 1
}

# ── 5. Demo data ────────────────────────────────────────────────
if (-not $NoSeed) {
  Step 5 'Seeding demo workspace (idempotent)'
  docker compose run --rm -T seed
  if ($LASTEXITCODE -eq 0) { Ok 'demo data ready (demo@roofprocrm.com)' }
  else { Warn 'seed failed - the app still works with an empty workspace' }
} else {
  Step 5 'Skipping demo seed (-NoSeed)'
}

# ── 6. Report ───────────────────────────────────────────────────
Write-Host "`n==============================================================" -ForegroundColor Green
Write-Host "  RoofPro CRM is live" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Green
Write-Host @"
  Web app          http://localhost:3000
  API              http://localhost:5000/api/v1
  Health           http://localhost:5000/api/v1/health
  AI gateway       http://localhost:5000/api/v1/ai/status
  Storm intel      http://localhost:5000/api/v1/storm-intel/overview

  Demo sign-in     demo@roofprocrm.com / RoofPro!2026
  Create account   http://localhost:3000/register
  Settings > AI    http://localhost:3000/settings/ai

  Demo data        npm run seed:demo      (host, needs node)
  Smoke test       npm run smoke
  Logs             npm run stack:logs
  Stop             npm run stop
"@ -ForegroundColor Gray

docker compose ps

if (-not $NoOpen) {
  try { Start-Process 'http://localhost:3000' } catch { }
}
Write-Host "`nDone.`n" -ForegroundColor Green
