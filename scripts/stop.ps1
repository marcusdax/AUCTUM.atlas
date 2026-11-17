#Requires -Version 7.0
<#
.SYNOPSIS
  Stop the RoofPro CRM docker stack.
.EXAMPLE
  pwsh -File scripts/stop.ps1            # stop containers, keep data
  pwsh -File scripts/stop.ps1 -Volumes   # stop and delete postgres/redis volumes
#>
[CmdletBinding()]
param([switch]$Volumes)

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if ($Volumes) {
  Write-Host 'Stopping stack and removing volumes (all data will be lost)...' -ForegroundColor Yellow
  docker compose down -v
} else {
  Write-Host 'Stopping stack (data volumes preserved)...' -ForegroundColor Cyan
  docker compose down
}
exit $LASTEXITCODE
