#Requires -Version 5.1
<#
.SYNOPSIS
    WinClaw one-click installer for Windows.
.DESCRIPTION
    Checks prerequisites, installs Node.js if needed, installs WinClaw via npm,
    and launches the onboarding wizard.
.EXAMPLE
    irm https://get.winclaw.dev/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"

function Write-Step { param([string]$msg) Write-Host "`n=> $msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$msg) Write-Host "   $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "   $msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$msg) Write-Host "   $msg" -ForegroundColor Red }

# -- Banner ----------------------------------------------------------------
Write-Host @"

 __        ___       ____ _
 \ \      / (_)_ __ / ___| | __ ___      __
  \ \ /\ / /| | '_ \| |   | |/ _`  \ \ /\ / /
   \ V  V / | | | | | |___| | (_| |\ V  V /
    \_/\_/  |_|_| |_|\____|_|\__,_| \_/\_/
                  Windows Installer

"@ -ForegroundColor Magenta

# -- 1. Check Windows version ----------------------------------------------
Write-Step "Checking Windows version..."
$osVersion = [System.Environment]::OSVersion.Version
if ($osVersion.Build -lt 17134) {
    Write-Fail "Windows 10 1803+ or Windows 11 required (build 17134+)."
    exit 1
}
Write-Ok "Windows $($osVersion.Major).$($osVersion.Minor) (Build $($osVersion.Build))"

# -- 2. Check/install Node.js 22+ ------------------------------------------
Write-Step "Checking Node.js..."
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nodeVer = (node --version) -replace '^v', ''
    $major = [int]($nodeVer.Split('.')[0])
    if ($major -ge 22) {
        Write-Ok "Node.js v$nodeVer found"
    } else {
        Write-Warn "Node.js v$nodeVer found but v22+ required"
        $nodeCmd = $null
    }
}

if (-not $nodeCmd) {
    Write-Step "Installing Node.js 22 LTS..."
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install nodejs-lts -y
    } elseif (Get-Command scoop -ErrorAction SilentlyContinue) {
        scoop install nodejs-lts
    } else {
        Write-Fail "No package manager found. Install Node.js 22+ manually from https://nodejs.org"
        exit 1
    }
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Fail "Node.js installation succeeded but 'node' not in PATH. Restart your terminal."
        exit 1
    }
    Write-Ok "Node.js installed: $(node --version)"
}

# -- 3. Install WinClaw ----------------------------------------------------
Write-Step "Installing WinClaw..."
npm install -g winclaw
if ($LASTEXITCODE -ne 0) {
    Write-Fail "npm install failed. Try running as Administrator."
    exit 1
}
$version = (winclaw --version 2>$null) | Select-Object -First 1
Write-Ok "WinClaw $version installed"

# -- 4. Launch onboarding --------------------------------------------------
Write-Step "Launching setup wizard..."
Write-Host ""
winclaw onboard
