#Requires -Version 5.1
<#
.SYNOPSIS
    Build WinClaw Windows installer (.exe) via Inno Setup.
.DESCRIPTION
    1. Downloads/verifies Node.js 22 LTS portable
    2. Builds WinClaw (pnpm build)
    3. Creates a pre-installed app directory with all deps
    4. Compiles the Inno Setup script into WinClawSetup-{version}.exe
.EXAMPLE
    .\scripts\package-windows-installer.ps1
    .\scripts\package-windows-installer.ps1 -SkipBuild
#>
param(
    [switch]$SkipBuild,
    [string]$NodeVersion = "22.14.0",
    [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path $PSScriptRoot -Parent
$STAGING = "$ROOT\dist\win-staging"
$PKG_VERSION = (Get-Content "$ROOT\package.json" | ConvertFrom-Json).version

Write-Host "==> WinClaw Windows Installer Builder v$PKG_VERSION" -ForegroundColor Cyan

# -- 1. Download Node.js portable -----------------------------------------
$nodeArch = $(if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" })
$nodeZip = "node-v$NodeVersion-win-$nodeArch.zip"
$nodeUrl = "https://nodejs.org/dist/v$NodeVersion/$nodeZip"
$nodeCache = "$ROOT\dist\cache\$nodeZip"

if (-not (Test-Path $nodeCache) -or (Get-Item $nodeCache -ErrorAction SilentlyContinue).Length -lt 1000000) {
    Write-Host "==> Downloading Node.js v$NodeVersion ($nodeArch)..."
    New-Item -ItemType Directory -Path (Split-Path $nodeCache) -Force | Out-Null
    if (Test-Path $nodeCache) { Remove-Item $nodeCache -Force }
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeCache -UseBasicParsing
}
Write-Host "    Node.js zip: $([math]::Round((Get-Item $nodeCache).Length / 1MB, 1)) MB"

# -- 2. Build WinClaw ------------------------------------------------------
if (-not $SkipBuild) {
    Write-Host "==> Building WinClaw (pnpm build)..."
    Push-Location $ROOT
    pnpm install --frozen-lockfile
    pnpm build
    Pop-Location
}

# -- 3. npm pack (BEFORE staging to avoid including staging in tarball) ------
# Remove old staging first so it doesn't get included in the tarball
if (Test-Path $STAGING) { Remove-Item $STAGING -Recurse -Force }
Write-Host "==> Creating tarball..."
$packDest = "$ROOT\dist\cache"
New-Item -ItemType Directory -Path $packDest -Force | Out-Null
Push-Location $ROOT
$env:NO_COLOR = "1"
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$packOutput = npm pack --ignore-scripts --pack-destination "$packDest" 2>&1
$ErrorActionPreference = $prevEAP
Pop-Location
$tarball = ($packOutput | ForEach-Object { "$_" } | Where-Object { $_.Trim() -ne "" } | Select-Object -Last 1).Trim()
$tarballPath = "$packDest\$tarball"
if (-not $tarball -or -not (Test-Path $tarballPath)) {
    $tgzFile = Get-ChildItem "$packDest\*.tgz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($tgzFile) { $tarballPath = $tgzFile.FullName }
}
Write-Host "    Tarball: $tarballPath"
if (-not (Test-Path $tarballPath)) { Write-Error "npm pack failed"; exit 1 }

# -- 4. Stage installer files -----------------------------------------------
Write-Host "==> Staging installer files..."
if (Test-Path $STAGING) { Remove-Item $STAGING -Recurse -Force }
New-Item -ItemType Directory -Path $STAGING -Force | Out-Null

# Node.js portable
Write-Host "    Extracting Node.js..."
$tmpDir = "$STAGING\node-extract"
Expand-Archive -Path $nodeCache -DestinationPath $tmpDir -Force
$nodeDir = Get-ChildItem $tmpDir -Directory | Select-Object -First 1
New-Item -ItemType Directory -Path "$STAGING\node" -Force | Out-Null
& robocopy "$($nodeDir.FullName)" "$STAGING\node" /E /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
Remove-Item $tmpDir -Recurse -Force
Write-Host "    node/ items: $((Get-ChildItem "$STAGING\node").Count)"

# App directory
Write-Host "    Creating app directory..."
New-Item -ItemType Directory -Path "$STAGING\app" -Force | Out-Null

# Install from tarball using system npm
Write-Host "    Installing from tarball (this may take a few minutes)..."
$ErrorActionPreference = "Continue"
npm install --global --prefix "$STAGING\app-global" "$tarballPath" 2>&1 | ForEach-Object { Write-Host "    $_" }
$ErrorActionPreference = $prevEAP

# Locate installed package
$appSrc = $null
foreach ($pkgName in @("openclaw", "winclaw")) {
    foreach ($subDir in @("node_modules\$pkgName", "lib\node_modules\$pkgName")) {
        $candidate = "$STAGING\app-global\$subDir"
        if (Test-Path $candidate) { $appSrc = $candidate; break }
    }
    if ($appSrc) { break }
}
if (-not $appSrc) { Write-Error "Could not find installed package"; exit 1 }
Write-Host "    Found package: $appSrc"

# Copy package and deps using robocopy (handles nested dirs reliably)
& robocopy "$appSrc" "$STAGING\app" /E /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
$depsDir = Split-Path $appSrc -Parent
$deps = Get-ChildItem $depsDir -Directory | Where-Object { $_.Name -ne (Split-Path $appSrc -Leaf) }
if ($deps.Count -gt 0) {
    Write-Host "    Copying $($deps.Count) dependencies..."
    New-Item -ItemType Directory -Path "$STAGING\app\node_modules" -Force | Out-Null
    foreach ($dep in $deps) {
        & robocopy "$($dep.FullName)" "$STAGING\app\node_modules\$($dep.Name)" /E /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    }
}
Remove-Item "$STAGING\app-global" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$STAGING\$tarball" -Force -ErrorAction SilentlyContinue

# Assets
Write-Host "    Copying assets..."
New-Item -ItemType Directory -Path "$STAGING\assets" -Force | Out-Null
Copy-Item "$ROOT\assets\winclaw.ico" "$STAGING\assets\" -Force
Copy-Item "$ROOT\assets\logo.png" "$STAGING\assets\" -Force

# Launcher script
@"
@echo off
setlocal
set "WINCLAW_NODE=%~dp0node\node.exe"
set "WINCLAW_APP=%~dp0app\openclaw.mjs"
"%WINCLAW_NODE%" "%WINCLAW_APP%" %*
"@ | Set-Content "$STAGING\winclaw.cmd" -Encoding ASCII

# UI Launcher script (starts gateway + opens browser)
Copy-Item "$ROOT\scripts\winclaw-ui.cmd" "$STAGING\winclaw-ui.cmd" -Force

# -- 5. Compile Inno Setup --------------------------------------------------
Write-Host "==> Compiling Inno Setup installer..."
$iscc = Get-Command iscc.exe -ErrorAction SilentlyContinue
if (-not $iscc) {
    $iscc = Get-Command "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" -ErrorAction SilentlyContinue
}
if (-not $iscc) {
    $iscc = Get-Command "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" -ErrorAction SilentlyContinue
}
if (-not $iscc) {
    Write-Error "Inno Setup Compiler (ISCC.exe) not found. Install: winget install JRSoftware.InnoSetup"
    exit 1
}

& $iscc.Source `
    "/DAppVersion=$PKG_VERSION" `
    "/DStagingDir=$STAGING" `
    "/DOutputDir=$ROOT\$OutputDir" `
    "$ROOT\scripts\windows-installer.iss"

$installer = Get-ChildItem "$ROOT\$OutputDir\WinClawSetup-$PKG_VERSION.exe" -ErrorAction SilentlyContinue
if ($installer) {
    Write-Host "==> Installer built: $($installer.FullName)" -ForegroundColor Green
    Write-Host "    Size: $([math]::Round($installer.Length / 1MB, 1)) MB"
} else {
    Write-Error "Installer not found after compilation"
    exit 1
}
