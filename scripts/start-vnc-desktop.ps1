<#
.SYNOPSIS
    Start VNC desktop streaming (TightVNC + websockify + noVNC)
.DESCRIPTION
    Ensures TightVNC is running, starts websockify as a background job,
    and prints the noVNC URL. Does NOT require Administrator.
#>

param(
    [int]$VncPort = 5900,
    [int]$WebSocketPort = 6080,
    [switch]$Open   # Open noVNC in default browser
)

$ErrorActionPreference = "Stop"
# Resolve noVNC directory: prefer user home, fallback to installer directory
$NoVncDir = Join-Path $env:USERPROFILE ".winclaw\vnc\novnc"
if (-not (Test-Path (Join-Path $NoVncDir "vnc.html"))) {
    $fallback = Join-Path $PSScriptRoot "novnc"
    if (Test-Path (Join-Path $fallback "vnc.html")) {
        $NoVncDir = $fallback
    }
}

function Write-Step { param([string]$msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$msg) Write-Host "   OK: $msg" -ForegroundColor Green }
function Write-Err  { param([string]$msg) Write-Host "   ERROR: $msg" -ForegroundColor Red }

# ─── Check prerequisites ─────────────────────────────────────
Write-Step "Checking prerequisites..."

if (-not (Test-Path (Join-Path $NoVncDir "vnc.html"))) {
    Write-Err "noVNC not found. Run setup-vnc-desktop.ps1 first."
    exit 1
}

$wsockify = Get-Command websockify -ErrorAction SilentlyContinue
if (-not $wsockify) {
    Write-Err "websockify not found. Run setup-vnc-desktop.ps1 first."
    exit 1
}

# ─── Check TightVNC ──────────────────────────────────────────
Write-Step "Checking TightVNC service..."

$svc = Get-Service -Name tvnserver -ErrorAction SilentlyContinue
if (-not $svc) {
    Write-Err "TightVNC service not installed. Run setup-vnc-desktop.ps1 as Administrator."
    exit 1
}
if ($svc.Status -ne 'Running') {
    Write-Host "   Starting TightVNC service..." -ForegroundColor White
    Start-Service -Name tvnserver -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

$tcpTest = Test-NetConnection -ComputerName localhost -Port $VncPort -WarningAction SilentlyContinue
if ($tcpTest.TcpTestSucceeded) {
    Write-OK "TightVNC listening on port $VncPort"
} else {
    Write-Err "TightVNC not responding on port $VncPort"
    exit 1
}

# ─── Check if websockify already running ─────────────────────
Write-Step "Starting websockify..."

$wsPortTest = Test-NetConnection -ComputerName localhost -Port $WebSocketPort -WarningAction SilentlyContinue
if ($wsPortTest.TcpTestSucceeded) {
    Write-OK "websockify already running on port $WebSocketPort"
} else {
    # Start websockify as background job
    $wsArgs = "--web=`"$NoVncDir`" $WebSocketPort localhost:$VncPort"
    Start-Process -FilePath $wsockify.Source -ArgumentList $wsArgs -WindowStyle Hidden -PassThru | Out-Null

    # Wait for it to start
    $retries = 0
    do {
        Start-Sleep -Milliseconds 500
        $retries++
        $wsPortTest = Test-NetConnection -ComputerName localhost -Port $WebSocketPort -WarningAction SilentlyContinue
    } while (-not $wsPortTest.TcpTestSucceeded -and $retries -lt 10)

    if ($wsPortTest.TcpTestSucceeded) {
        Write-OK "websockify started on port $WebSocketPort (background process)"
    } else {
        Write-Err "websockify failed to start"
        exit 1
    }
}

# ─── Output ──────────────────────────────────────────────────
$url = "http://localhost:$WebSocketPort/vnc.html?autoconnect=1&resize=remote"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  VNC Desktop Streaming is ACTIVE" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  noVNC URL:" -ForegroundColor White
Write-Host "  $url" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Claude in Chrome can now control your desktop" -ForegroundColor White
Write-Host "  via this URL in a browser tab." -ForegroundColor White
Write-Host ""

if ($Open) {
    Start-Process $url
}
