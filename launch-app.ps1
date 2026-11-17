# Atlas Helios Platform - Full Application Launcher
# ================================================

$ErrorActionPreference = "Stop"

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-Output ""
Write-ColorOutput Cyan "============================================================="
Write-ColorOutput Cyan "  🌩️  Atlas Helios - Storm Intelligence Platform"
Write-ColorOutput Cyan "============================================================="
Write-Output ""

# Get the project root directory
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

# Function to check if a port is in use
function Test-PortInUse($Port) {
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $connection -ne $null
}

# Function to find an available port
function Get-AvailablePort($StartPort) {
    $port = $StartPort
    while (Test-PortInUse $port) {
        $port++
    }
    return $port
}

# Check Node.js
Write-ColorOutput Yellow "[1/5] Checking Node.js environment..."
try {
    $nodeVersion = node --version
    Write-ColorOutput Green "  ✓ Node.js found: $nodeVersion"
} catch {
    Write-ColorOutput Red "  ✗ Node.js not found! Please install Node.js 16+"
    exit 1
}

# Check npm
Write-ColorOutput Yellow "[2/5] Checking npm..."
try {
    $npmVersion = npm --version
    Write-ColorOutput Green "  ✓ npm found: $npmVersion"
} catch {
    Write-ColorOutput Red "  ✗ npm not found!"
    exit 1
}

# Install backend dependencies
Write-ColorOutput Yellow "[3/5] Installing backend dependencies..."
Set-Location "$ProjectRoot\backend"
if (-not (Test-Path "node_modules")) {
    try {
        npm install 2>&1 | Out-Null
        Write-ColorOutput Green "  ✓ Backend dependencies installed"
    } catch {
        Write-ColorOutput Red "  ✗ Failed to install backend dependencies"
        exit 1
    }
} else {
    Write-ColorOutput Green "  ✓ Backend dependencies already installed"
}

# Install frontend dependencies
Write-ColorOutput Yellow "[4/5] Installing frontend dependencies..."
Set-Location "$ProjectRoot\frontend"
if (-not (Test-Path "node_modules")) {
    try {
        npm install 2>&1 | Out-Null
        Write-ColorOutput Green "  ✓ Frontend dependencies installed"
    } catch {
        Write-ColorOutput Red "  ✗ Failed to install frontend dependencies"
        exit 1
    }
} else {
    Write-ColorOutput Green "  ✓ Frontend dependencies already installed"
}

# Find available ports
$backendPort = Get-AvailablePort 5000
$frontendPort = Get-AvailablePort 3000

Write-ColorOutput Yellow "[5/5] Starting services..."
Write-ColorOutput Gray "  Backend will run on port: $backendPort"
Write-ColorOutput Gray "  Frontend will run on port: $frontendPort"

# Start Backend
Set-Location "$ProjectRoot\backend"
$env:PORT = $backendPort
$backendJob = Start-Job -ScriptBlock {
    param($path, $port)
    Set-Location $path
    $env:PORT = $port
    npm start
} -ArgumentList "$ProjectRoot\backend", $backendPort

Write-ColorOutput Green "  ✓ Backend started (Port: $backendPort)"

# Wait for backend to initialize
Start-Sleep -Seconds 3

# Start Frontend
Set-Location "$ProjectRoot\frontend"
$frontendJob = Start-Job -ScriptBlock {
    param($path, $port, $apiPort)
    Set-Location $path
    $env:PORT = $port
    $env:REACT_APP_API_URL = "http://localhost:$apiPort"
    npm start
} -ArgumentList "$ProjectRoot\frontend", $frontendPort, $backendPort

Write-ColorOutput Green "  ✓ Frontend started (Port: $frontendPort)"

# Wait for frontend to initialize
Start-Sleep -Seconds 5

# Test connections
Write-Output ""
Write-ColorOutput Yellow "Testing connections..."

try {
    $healthResponse = Invoke-RestMethod -Uri "http://localhost:$backendPort/health" -TimeoutSec 10
    Write-ColorOutput Green "  ✓ Backend API: Connected"
    Write-ColorOutput Gray "    Status: $($healthResponse.status)"
} catch {
    Write-ColorOutput Red "  ✗ Backend API: Not responding"
}

Write-Output ""
Write-ColorOutput Cyan "============================================================="
Write-ColorOutput Green "  🚀 Atlas Helios Platform is now running!"
Write-ColorOutput Cyan "============================================================="
Write-Output ""
Write-Output "  📱 Application URLs:"
Write-Output "     Frontend (UI):   http://localhost:$frontendPort"
Write-Output "     Backend API:     http://localhost:$backendPort"
Write-Output "     Health Check:    http://localhost:$backendPort/health"
Write-Output ""
Write-Output "  📊 API Endpoints:"
Write-Output "     Weather Status:  GET  http://localhost:$backendPort/api/weather/status"
Write-Output "     Active Storms:   GET  http://localhost:$backendPort/api/storms/active"
Write-Output "     Alerts:          GET  http://localhost:$backendPort/api/weather/alerts"
Write-Output ""
Write-Output "  🗺️  Map Features:"
Write-Output "     • Click anywhere on map for weather details"
Write-Output "     • View active storm alerts and warnings"
Write-Output "     • Real-time severe weather tracking"
Write-Output ""
Write-ColorOutput Yellow "  Press Ctrl+C to stop all services"
Write-Output ""

# Monitor jobs
while ($true) {
    Start-Sleep -Seconds 2
    
    $backendStatus = $backendJob | Get-Job
    $frontendStatus = $frontendJob | Get-Job
    
    if ($backendStatus.State -eq 'Failed') {
        Write-ColorOutput Red ""
        Write-ColorOutput Red "Backend service failed!"
        Write-Output "Error details:"
        Receive-Job $backendJob
        break
    }
    
    if ($frontendStatus.State -eq 'Failed') {
        Write-ColorOutput Red ""
        Write-ColorOutput Red "Frontend service failed!"
        Write-Output "Error details:"
        Receive-Job $frontendJob
        break
    }
}

# Cleanup on exit
Stop-Job $backendJob -ErrorAction SilentlyContinue
Stop-Job $frontendJob -ErrorAction SilentlyContinue
Remove-Job $backendJob -ErrorAction SilentlyContinue
Remove-Job $frontendJob -ErrorAction SilentlyContinue

Write-Output ""
Write-ColorOutput Yellow "Services stopped."
