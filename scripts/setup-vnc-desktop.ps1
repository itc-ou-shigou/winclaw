#Requires -RunAsAdministrator
<#
.SYNOPSIS
    WinClaw VNC Desktop Control - One-click setup script
.DESCRIPTION
    Installs and configures TightVNC + websockify + noVNC for AI desktop automation.
    After setup, Claude in Chrome can see and operate the full Windows desktop.
.NOTES
    Must be run as Administrator (TightVNC service requires HKLM registry access).
    Usage: Right-click PowerShell -> Run as Administrator -> .\setup-vnc-desktop.ps1
#>

param(
    [int]$VncPort = 5900,
    [int]$WebSocketPort = 6080,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$VncDir = Join-Path $env:USERPROFILE ".winclaw\vnc"
$NoVncDir = Join-Path $VncDir "novnc"
$NoVncVersion = "1.5.0"
$TightVncRegPath = "HKLM:\SOFTWARE\TightVNC\Server"

function Write-Step { param([string]$msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$msg) Write-Host "   OK: $msg" -ForegroundColor Green }
function Write-Skip { param([string]$msg) Write-Host "   SKIP: $msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$msg) Write-Host "   ERROR: $msg" -ForegroundColor Red }

# ─── Uninstall ───────────────────────────────────────────────
if ($Uninstall) {
    Write-Step "Stopping websockify..."
    Get-Process -Name python* -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like '*websockify*' } |
        Stop-Process -Force -ErrorAction SilentlyContinue
    Write-OK "websockify stopped"

    Write-Step "Stopping TightVNC service..."
    Stop-Service -Name tvnserver -ErrorAction SilentlyContinue
    Write-OK "TightVNC stopped"

    Write-Host "`nVNC desktop control stopped. To fully uninstall TightVNC:" -ForegroundColor Yellow
    Write-Host "  winget uninstall GlavSoft.TightVNC" -ForegroundColor White
    exit 0
}

# ─── Step 1: Install TightVNC ────────────────────────────────
Write-Step "Step 1/5: Checking TightVNC Server..."

$tvnPath = "C:\Program Files\TightVNC\tvnserver.exe"
if (Test-Path $tvnPath) {
    Write-Skip "TightVNC already installed at $tvnPath"
} else {
    # Prefer bundled MSI (when run from installer directory)
    $bundledMsi = Join-Path $PSScriptRoot "tightvnc-setup.msi"
    if (Test-Path $bundledMsi) {
        Write-Host "   Installing TightVNC from bundled MSI..." -ForegroundColor White
        $msiArgs = "/i `"$bundledMsi`" /quiet /norestart ADDLOCAL=Server SET_ALLOWLOOPBACK=1 VALUE_OF_ALLOWLOOPBACK=1 SET_LOOPBACKONLY=1 VALUE_OF_LOOPBACKONLY=1 SET_USEVNCAUTHENTICATION=1 VALUE_OF_USEVNCAUTHENTICATION=0 SET_USECONTROLAUTHENTICATION=1 VALUE_OF_USECONTROLAUTHENTICATION=0"
        Start-Process msiexec.exe -ArgumentList $msiArgs -Wait -NoNewWindow
    } else {
        Write-Host "   Installing TightVNC Server via winget..." -ForegroundColor White
        winget install GlavSoft.TightVNC --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
    }
    if (Test-Path $tvnPath) {
        Write-OK "TightVNC installed"
    } else {
        Write-Err "TightVNC installation failed. Please install manually from https://www.tightvnc.com/download.php"
        exit 1
    }
}

# ─── Step 2: Configure TightVNC ──────────────────────────────
Write-Step "Step 2/5: Configuring TightVNC (localhost-only, no password)..."

# Ensure registry path exists
if (-not (Test-Path $TightVncRegPath)) {
    New-Item -Path $TightVncRegPath -Force | Out-Null
}

# Allow loopback connections
Set-ItemProperty -Path $TightVncRegPath -Name "AllowLoopback" -Value 1 -Type DWord
# Only allow loopback (block all remote access)
Set-ItemProperty -Path $TightVncRegPath -Name "LoopbackOnly" -Value 1 -Type DWord
# Disable VNC password authentication (safe because localhost-only)
Set-ItemProperty -Path $TightVncRegPath -Name "UseVncAuthentication" -Value 0 -Type DWord
# Disable control password
Set-ItemProperty -Path $TightVncRegPath -Name "UseControlAuthentication" -Value 0 -Type DWord
# Set RFB port
Set-ItemProperty -Path $TightVncRegPath -Name "RfbPort" -Value $VncPort -Type DWord
# Accept connections
Set-ItemProperty -Path $TightVncRegPath -Name "AcceptRfbConnections" -Value 1 -Type DWord

Write-OK "Registry configured: LoopbackOnly=1, UseVncAuthentication=0, Port=$VncPort"

# Start/restart TightVNC service
$svc = Get-Service -Name tvnserver -ErrorAction SilentlyContinue
if ($svc) {
    Restart-Service -Name tvnserver
    Write-OK "TightVNC service restarted"
} else {
    # Register as service if not already
    & $tvnPath -install -silent 2>&1 | Out-Null
    Start-Service -Name tvnserver
    Write-OK "TightVNC service installed and started"
}

# Reload config
& $tvnPath -controlservice -reload 2>&1 | Out-Null
Write-OK "Configuration reloaded"

# ─── Step 3: Install websockify ──────────────────────────────
Write-Step "Step 3/5: Checking websockify..."

$wsockify = Get-Command websockify -ErrorAction SilentlyContinue
if ($wsockify) {
    Write-Skip "websockify already installed: $($wsockify.Source)"
} else {
    # Check if pip is available
    $pip = Get-Command pip -ErrorAction SilentlyContinue
    if (-not $pip) {
        $pip = Get-Command pip3 -ErrorAction SilentlyContinue
    }
    if ($pip) {
        Write-Host "   Installing websockify via pip..." -ForegroundColor White
        & $pip.Source install websockify 2>&1 | Out-Null
        Write-OK "websockify installed via pip"
    } else {
        Write-Err "Python/pip not found. Please install Python 3.8+ first, then re-run this script."
        Write-Host "   Download from: https://www.python.org/downloads/" -ForegroundColor White
        exit 1
    }
}

# ─── Step 4: Download noVNC ──────────────────────────────────
Write-Step "Step 4/5: Checking noVNC HTML client..."

if (Test-Path (Join-Path $NoVncDir "vnc.html")) {
    Write-Skip "noVNC already exists at $NoVncDir"
} else {
    # Prefer bundled noVNC (when run from installer directory)
    $bundledNoVnc = Join-Path $PSScriptRoot "novnc"
    if (Test-Path (Join-Path $bundledNoVnc "vnc.html")) {
        Write-Host "   Copying bundled noVNC..." -ForegroundColor White
        [System.IO.Directory]::CreateDirectory($VncDir) | Out-Null
        Copy-Item -Path $bundledNoVnc -Destination $NoVncDir -Recurse -Force
        Write-OK "noVNC copied from bundled files"
    } else {
        Write-Host "   Downloading noVNC v$NoVncVersion..." -ForegroundColor White
        [System.IO.Directory]::CreateDirectory($VncDir) | Out-Null
        $zipPath = Join-Path $VncDir "novnc.zip"
        Invoke-WebRequest -Uri "https://github.com/novnc/noVNC/archive/refs/tags/v$NoVncVersion.zip" -OutFile $zipPath
        Expand-Archive -Path $zipPath -DestinationPath $VncDir -Force
        # Rename extracted folder
        $extracted = Join-Path $VncDir "noVNC-$NoVncVersion"
        if (Test-Path $NoVncDir) { Remove-Item $NoVncDir -Recurse -Force }
        Rename-Item -Path $extracted -NewName "novnc"
        Remove-Item $zipPath -Force
        Write-OK "noVNC downloaded to $NoVncDir"
    }
}

# ─── Step 5: Verify ─────────────────────────────────────────
Write-Step "Step 5/5: Verifying..."

# Check VNC port
$tcpTest = Test-NetConnection -ComputerName localhost -Port $VncPort -WarningAction SilentlyContinue
if ($tcpTest.TcpTestSucceeded) {
    Write-OK "TightVNC listening on port $VncPort"
} else {
    Write-Err "TightVNC not responding on port $VncPort"
}

# ─── Done ────────────────────────────────────────────────────
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  VNC Desktop Control setup complete!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start desktop streaming:" -ForegroundColor White
Write-Host "  .\scripts\start-vnc-desktop.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop:" -ForegroundColor White
Write-Host "  .\scripts\stop-vnc-desktop.ps1" -ForegroundColor Cyan
Write-Host ""
