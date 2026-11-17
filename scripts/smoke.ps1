#Requires -Version 7.0
<#
.SYNOPSIS
  RoofPro CRM — post-launch smoke test.

.DESCRIPTION
  Exercises the live stack end-to-end: health, auth, CRM, storm intelligence and the
  AI gateway (storm brief + map copilot + lead insights + provider status). Writes a
  JSON report to runs/ for evidence. Exits non-zero if any required check fails.

.EXAMPLE
  pwsh -File scripts/smoke.ps1
  pwsh -File scripts/smoke.ps1 -Api http://localhost:5000 -SkipRegistration
#>
[CmdletBinding()]
param(
  [string]$Api = 'http://localhost:5000',
  [string]$Web = 'http://localhost:3000',
  [string]$Email = '',
  [string]$Password = 'RoofPro!2026'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$results = [System.Collections.Generic.List[object]]::new()
$token = $null
$leadId = $null
$stormId = $null
$demoEmail = 'demo@roofprocrm.com'

function Record($name, $status, $detail) {
  $results.Add([pscustomobject]@{ Check = $name; Status = $status; Detail = $detail })
  $color = if ($status -eq 'PASS') { 'Green' } elseif ($status -eq 'SKIP') { 'Yellow' } else { 'Red' }
  Write-Host ("  {0,-7} {1,-42} {2}" -f $status, $name, $detail) -ForegroundColor $color
}

function Invoke-Api {
  param(
    [string]$Method = 'GET',
    [string]$Path,
    $Body = $null,
    [switch]$AllowFail
  )
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($script:token) { $headers['Authorization'] = "Bearer $($script:token)" }
  try {
    $params = @{
      Method      = $Method
      Uri         = "$Api/api/v1$Path"
      Headers     = $headers
      TimeoutSec  = 45
      UseBasicParsing = $true
    }
    if ($null -ne $Body) { $params['Body'] = ($Body | ConvertTo-Json -Depth 12 -Compress) }
    $r = Invoke-WebRequest @params
    return @{ ok = $true; status = [int]$r.StatusCode; data = ($r.Content | ConvertFrom-Json) }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($AllowFail) { return @{ ok = $false; status = $code; error = $_.Exception.Message } }
    throw
  }
}

Write-Host "`nRoofPro CRM smoke test  ->  $Api" -ForegroundColor Cyan
Write-Host ('-' * 74) -ForegroundColor DarkGray

# 1. Backend health
try {
  $r = Invoke-Api -Path '/health'
  Record 'backend health' 'PASS' "HTTP $($r.status) / $($r.data.service)"
} catch {
  Record 'backend health' 'FAIL' $_.Exception.Message
  Write-Host "`nBackend is not reachable. Start the stack with: npm run launch`n" -ForegroundColor Red
  exit 1
}

# 2. Web app
try {
  $w = Invoke-WebRequest -Uri $Web -UseBasicParsing -TimeoutSec 20
  Record 'web app' 'PASS' "HTTP $($w.StatusCode), $($w.RawContentLength) bytes"
} catch {
  Record 'web app' 'FAIL' $_.Exception.Message
}

# 3. Auth — log in as demo, else register a disposable account
$targetEmail = if ($Email) { $Email } else { $demoEmail }
try {
  $r = Invoke-Api -Method POST -Path '/auth/login' -Body @{ email = $targetEmail; password = $Password } -AllowFail
  if ($r.ok) {
    $script:token = $r.data.accessToken
    Record 'auth login (demo)' 'PASS' "role=$($r.data.user.role)"
  } else {
    $email = if ($Email) { $Email } else { "smoke+$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())@roofprocrm.com" }
    $r2 = Invoke-Api -Method POST -Path '/auth/register' -Body @{
      email       = $email
      password    = $Password
      firstName   = 'Smoke'
      lastName    = 'Test'
      companyName = 'Smoke Test Roofing'
    }
    $script:token = $r2.data.accessToken
    Record 'auth register (fallback)' 'PASS' "new account $email"
  }
} catch {
  Record 'auth' 'FAIL' $_.Exception.Message
}

# 4. CRM
try {
  $r = Invoke-Api -Path '/leads?limit=5'
  $leads = @($r.data.data)
  if ($leads.Count -gt 0 -and $leads[0].id) { $script:leadId = $leads[0].id }
  Record 'leads list' 'PASS' "$($leads.Count) lead(s) returned"
} catch { Record 'leads list' 'FAIL' $_.Exception.Message }

try {
  $r = Invoke-Api -Path '/jobs?limit=5'
  Record 'jobs list' 'PASS' "$(@($r.data.data).Count) job(s) returned"
} catch { Record 'jobs list' 'FAIL' $_.Exception.Message }

try {
  $r = Invoke-Api -Path '/calendar?start=2000-01-01&end=2100-01-01'
  Record 'calendar events' 'PASS' "$(@($r.data.data).Count) event(s) returned"
} catch { Record 'calendar events' 'FAIL' $_.Exception.Message }

# 5. Storm tracking (NOAA)
try {
  $r = Invoke-Api -Path '/storms/active'
  Record 'NOAA active storms' 'PASS' "$($r.data.count) alert(s), source NOAA"
} catch {
  Record 'NOAA active storms' 'SKIP' "NOAA unreachable (expected offline): $($_.Exception.Message)"
}

try {
  $r = Invoke-Api -Path '/storm-intel/overview?days=7'
  $events = @($r.data.events)
  if ($events.Count -gt 0) { $script:stormId = $events[0].id }
  Record 'storm-intel overview' 'PASS' "$($events.Count) event(s)"
} catch { Record 'storm-intel overview' 'FAIL' $_.Exception.Message }

try {
  $r = Invoke-Api -Method POST -Path '/storm-intel/sync' -Body @{ limit = 100 }
  Record 'storm-intel sync' 'PASS' "created=$($r.data.created) updated=$($r.data.updated)"
} catch { Record 'storm-intel sync' 'FAIL' $_.Exception.Message }

try {
  $r = Invoke-Api -Path '/storm-intel/events.geojson?days=7'
  Record 'storm events GeoJSON' 'PASS' "$(@($r.data.features).Count) feature(s)"
} catch { Record 'storm events GeoJSON' 'FAIL' $_.Exception.Message }

try {
  $r = Invoke-Api -Path '/storm-intel/impact?lat=33.05&lng=-96.75'
  Record 'point impact score' 'PASS' "score=$($r.data.score) severity=$($r.data.severity)"
} catch { Record 'point impact score' 'FAIL' $_.Exception.Message }

try {
  $r = Invoke-Api -Method POST -Path '/storm-intel/rescore-leads' -Body @{}
  Record 'rescore leads' 'PASS' "scored=$($r.data.scored) updated=$($r.data.updated)"
} catch { Record 'rescore leads' 'FAIL' $_.Exception.Message }

# 6. AI gateway
try {
  $r = Invoke-Api -Path '/ai/status'
  Record 'AI status' 'PASS' "enabled=$($r.data.enabled) providers=$(@($r.data.providers).Count) localFallback=$($r.data.localFallback.available)"
} catch { Record 'AI status' 'FAIL' $_.Exception.Message }

try {
  $r = Invoke-Api -Method POST -Path '/ai/storm-brief' -Body @{ days = 7 }
  $brief = $r.data.brief
  Record 'AI storm brief' 'PASS' "source=$($r.data.source) severity=$($brief.severity) risk=$($brief.riskScore) actions=$(@($brief.recommendedActions).Count)"
} catch { Record 'AI storm brief' 'FAIL' $_.Exception.Message }

try {
  $r = Invoke-Api -Method POST -Path '/ai/map-copilot' -Body @{ query = 'show extreme tornado warnings'; view = @{ center = @{ lat = 33.05; lng = -96.75 }; zoom = 6 } }
  Record 'AI map copilot' 'PASS' "intent=$($r.data.plan.intent) source=$($r.data.source) overlays=$(@($r.data.plan.overlays).Count)"
} catch { Record 'AI map copilot' 'FAIL' $_.Exception.Message }

if ($script:leadId) {
  try {
    $r = Invoke-Api -Method POST -Path '/ai/lead-insights' -Body @{ leadId = $script:leadId }
    Record 'AI lead insights' 'PASS' "score=$($r.data.score) source=$($r.data.source)"
  } catch { Record 'AI lead insights' 'FAIL' $_.Exception.Message }
} else {
  Record 'AI lead insights' 'SKIP' 'no leads available (seed the demo workspace)'
}

try {
  $r = Invoke-Api -Path '/ai/usage?days=7'
  Record 'AI usage metering' 'PASS' "requests=$($r.data.totals.requests) tokens=$($r.data.totals.tokens)"
} catch { Record 'AI usage metering' 'FAIL' $_.Exception.Message }

try {
  $r = Invoke-Api -Path '/ai/providers'
  Record 'AI provider admin' 'PASS' "$(@($r.data.providers).Count) provider config(s)"
} catch { Record 'AI provider admin' 'FAIL' $_.Exception.Message }

# 7. Report
$failed = @($results | Where-Object { $_.Status -eq 'FAIL' })
$passed = @($results | Where-Object { $_.Status -eq 'PASS' })
$skipped = @($results | Where-Object { $_.Status -eq 'SKIP' })

Write-Host ('-' * 74) -ForegroundColor DarkGray
Write-Host ("  {0} passed, {1} failed, {2} skipped" -f $passed.Count, $failed.Count, $skipped.Count) -ForegroundColor $(if ($failed.Count) { 'Red' } else { 'Green' })

$runsDir = Join-Path $Root 'runs'
New-Item -ItemType Directory -Force -Path $runsDir | Out-Null
$reportPath = Join-Path $runsDir ("smoke-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  api         = $Api
  summary     = @{ passed = $passed.Count; failed = $failed.Count; skipped = $skipped.Count }
  checks      = $results
} | ConvertTo-Json -Depth 6 | Set-Content -Path $reportPath -Encoding utf8
Write-Host "  report: $reportPath" -ForegroundColor DarkGray

if ($failed.Count -gt 0) { exit 1 }
exit 0
