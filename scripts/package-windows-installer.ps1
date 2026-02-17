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
# Remove npm and corepack — not needed at runtime (we run node.exe directly on .mjs files)
foreach ($unneeded in @("node_modules\npm", "node_modules\corepack", "npm.cmd", "npx.cmd", "corepack.cmd")) {
    $target = "$STAGING\node\$unneeded"
    if (Test-Path $target) { Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue }
}
# Remove empty node_modules if nothing left
$nodeModules = "$STAGING\node\node_modules"
if ((Test-Path $nodeModules) -and (Get-ChildItem $nodeModules -ErrorAction SilentlyContinue).Count -eq 0) {
    Remove-Item $nodeModules -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host "    node/ items: $((Get-ChildItem "$STAGING\node").Count) (npm/corepack removed)"

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
foreach ($pkgName in @("winclaw", "winclaw")) {
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

# -- 3b. Remove bloat from staged app (installer EXEs, caches, win-staging) ---
# npm pack includes dist/ per package.json "files", which may contain old
# installer artefacts and Node.js download caches.  Remove them here so
# they never end up inside the final installer.
Write-Host "    Removing bloat from staged app..."
$bloatPatterns = @(
    "$STAGING\app\dist\WinClawSetup-*.exe",
    "$STAGING\app\dist\cache",
    "$STAGING\app\dist\win-staging"
)
foreach ($pattern in $bloatPatterns) {
    foreach ($item in (Get-Item $pattern -ErrorAction SilentlyContinue)) {
        Write-Host "      Removing: $($item.Name) ($([math]::Round($item.Length / 1MB, 1)) MB)"
        Remove-Item $item -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Remove heavy optional packages to keep installer under 100 MB.
# These are either GPU-specific, used only for optional features, or type-only packages.
# Users can install them separately if needed (e.g. `npm i node-llama-cpp`).
$heavyPackages = @(
    # GPU runtime variants (CUDA, Vulkan, ARM64)
    "$STAGING\app\node_modules\@node-llama-cpp\win-x64-cuda",
    "$STAGING\app\node_modules\@node-llama-cpp\win-x64-cuda-ext",
    "$STAGING\app\node_modules\@node-llama-cpp\win-x64-vulkan",
    "$STAGING\app\node_modules\@node-llama-cpp\win-arm64",
    # Full LLM runtime (optional — users install separately for local models)
    "$STAGING\app\node_modules\@node-llama-cpp",
    "$STAGING\app\node_modules\node-llama-cpp",
    # Native image processing (optional — sharp handles most needs)
    "$STAGING\app\node_modules\@napi-rs\canvas-win32-x64-msvc",
    "$STAGING\app\node_modules\@napi-rs\canvas",
    "$STAGING\app\node_modules\@img\sharp-win32-x64",
    # Playwright (optional — only for browser automation features)
    "$STAGING\app\node_modules\playwright-core",
    # Node PTY (optional — only for terminal features)
    "$STAGING\app\node_modules\@lydell",
    # Type-only packages (not needed at runtime)
    "$STAGING\app\node_modules\@cloudflare\workers-types",
    "$STAGING\app\node_modules\bun-types",
    "$STAGING\app\node_modules\@types",
    "$STAGING\app\node_modules\@octokit\openapi-types",
    "$STAGING\app\node_modules\@octokit\openapi-webhooks-types",
    "$STAGING\app\node_modules\web-streams-polyfill"
)
foreach ($pkg in $heavyPackages) {
    if (Test-Path $pkg) {
        $sz = [math]::Round(((Get-ChildItem $pkg -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB), 1)
        Write-Host "      Removing: $(Split-Path $pkg -Leaf) ($sz MB)"
        Remove-Item $pkg -Recurse -Force -ErrorAction SilentlyContinue
    }
}
# Clean up empty scoped package directories
foreach ($scopeDir in (Get-ChildItem "$STAGING\app\node_modules\@*" -Directory -ErrorAction SilentlyContinue)) {
    if ((Get-ChildItem $scopeDir.FullName -ErrorAction SilentlyContinue).Count -eq 0) {
        Remove-Item $scopeDir.FullName -Force -ErrorAction SilentlyContinue
    }
}

# Remove tests, docs, source-maps, TypeScript sources from node_modules to save ~30-50 MB
Write-Host "      Trimming node_modules (tests, docs, TS sources)..."
$trimDirs = @("test", "tests", "__tests__", "spec", ".github", "benchmarks", "examples", "example")
foreach ($trimDir in $trimDirs) {
    Get-ChildItem "$STAGING\app\node_modules" -Directory -Recurse -Filter $trimDir -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
}
$trimFilePatterns = @("*.md", "CHANGELOG.md", "CHANGELOG.txt", "HISTORY.md", "HISTORY.txt", ".npmignore", ".eslintrc*", ".prettierrc*",
    "tsconfig*.json", ".editorconfig", ".travis.yml", ".taprc*", ".nojekyll")
foreach ($pat in $trimFilePatterns) {
    Get-ChildItem "$STAGING\app\node_modules" -File -Recurse -Filter $pat -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
}
# Remove .ts sources (keep .d.ts and .d.cts)
Get-ChildItem "$STAGING\app\node_modules" -File -Recurse -Filter "*.ts" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike "*.d.ts" -and $_.Name -notlike "*.d.cts" } |
    ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
# Remove source maps
Get-ChildItem "$STAGING\app\node_modules" -File -Recurse -Filter "*.map" -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
# Remove app/docs (not needed at runtime)
Remove-Item "$STAGING\app\docs" -Recurse -Force -ErrorAction SilentlyContinue

$appSizeMB = [math]::Round(((Get-ChildItem "$STAGING\app" -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB), 1)
Write-Host "    App directory size after cleanup: $appSizeMB MB" -ForegroundColor Yellow

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
if exist "%~dp0app\winclaw.mjs" (
    set "WINCLAW_APP=%~dp0app\winclaw.mjs"
) else (
    set "WINCLAW_APP=%~dp0app\winclaw.mjs"
)
"%WINCLAW_NODE%" "%WINCLAW_APP%" %*
"@ | Set-Content "$STAGING\winclaw.cmd" -Encoding ASCII

# UI Launcher script (starts gateway + opens browser)
Copy-Item "$ROOT\scripts\winclaw-ui.cmd" "$STAGING\winclaw-ui.cmd" -Force

# -- 4b. Copy WebView2 Bootstrapper (for auto-install on target machines) ---
$webview2Bootstrapper = "$ROOT\scripts\MicrosoftEdgeWebview2Setup.exe"
if (Test-Path $webview2Bootstrapper) {
    Copy-Item $webview2Bootstrapper "$STAGING\MicrosoftEdgeWebview2Setup.exe" -Force
    Write-Host "    WebView2 Bootstrapper: $([math]::Round((Get-Item $webview2Bootstrapper).Length / 1MB, 1)) MB"
} else {
    Write-Warning "WebView2 Bootstrapper not found at $webview2Bootstrapper"
}

# -- 4c. Stage VNC Desktop Control assets ----------------------------------
Write-Host "==> Staging VNC Desktop Control assets..."
$vncStaging = "$STAGING\vnc"
New-Item -ItemType Directory -Path $vncStaging -Force | Out-Null

# TightVNC MSI (download and cache)
$tightvncMsi = "$ROOT\dist\cache\tightvnc-setup.msi"
if (-not (Test-Path $tightvncMsi) -or (Get-Item $tightvncMsi -ErrorAction SilentlyContinue).Length -lt 100000) {
    Write-Host "    Downloading TightVNC MSI..."
    Invoke-WebRequest -Uri "https://www.tightvnc.com/download/2.8.85/tightvnc-2.8.85-gpl-setup-64bit.msi" -OutFile $tightvncMsi -UseBasicParsing
}
Copy-Item $tightvncMsi "$vncStaging\tightvnc-setup.msi" -Force
Write-Host "    TightVNC MSI: $([math]::Round((Get-Item "$vncStaging\tightvnc-setup.msi").Length / 1MB, 1)) MB"

# noVNC HTML client (download, extract essential files only)
$novncZip = "$ROOT\dist\cache\novnc-1.5.0.zip"
if (-not (Test-Path $novncZip) -or (Get-Item $novncZip -ErrorAction SilentlyContinue).Length -lt 100000) {
    Write-Host "    Downloading noVNC v1.5.0..."
    Invoke-WebRequest -Uri "https://github.com/novnc/noVNC/archive/refs/tags/v1.5.0.zip" -OutFile $novncZip -UseBasicParsing
}
$novncExtractTmp = "$vncStaging\novnc-extract"
Expand-Archive -Path $novncZip -DestinationPath $novncExtractTmp -Force
$extractedDir = Get-ChildItem $novncExtractTmp -Directory | Select-Object -First 1
New-Item -ItemType Directory -Path "$vncStaging\novnc" -Force | Out-Null
# Copy only essential files (skip docs, tests, screenshots)
foreach ($item in @("vnc.html", "vnc_lite.html", "app", "core", "vendor")) {
    $src = Join-Path $extractedDir.FullName $item
    if (Test-Path $src) { Copy-Item $src "$vncStaging\novnc\$item" -Recurse -Force }
}
Copy-Item (Join-Path $extractedDir.FullName "package.json") "$vncStaging\novnc\" -Force -ErrorAction SilentlyContinue
Remove-Item $novncExtractTmp -Recurse -Force

# VNC PowerShell scripts
Copy-Item "$ROOT\scripts\setup-vnc-desktop.ps1" "$vncStaging\" -Force
Copy-Item "$ROOT\scripts\start-vnc-desktop.ps1" "$vncStaging\" -Force
Copy-Item "$ROOT\scripts\stop-vnc-desktop.ps1" "$vncStaging\" -Force
if (Test-Path "$ROOT\scripts\vnc-check-status.ps1") {
    Copy-Item "$ROOT\scripts\vnc-check-status.ps1" "$vncStaging\" -Force
}

$vncSizeMB = [math]::Round(((Get-ChildItem "$vncStaging" -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB), 1)
Write-Host "    VNC staging size: $vncSizeMB MB" -ForegroundColor Yellow

# -- 4d-2. Chrome DevTools MCP launcher scripts ----------------------------
$scriptsStaging = "$STAGING\scripts"
New-Item -ItemType Directory -Path $scriptsStaging -Force | Out-Null
foreach ($scriptName in @("launch-chrome-devtools-mcp.ps1", "ensure-chrome-debug.ps1")) {
    $scriptPath = "$ROOT\scripts\$scriptName"
    if (Test-Path $scriptPath) {
        Copy-Item $scriptPath "$scriptsStaging\" -Force
        Write-Host "    Copied $scriptName to staging\scripts\"
    } else {
        Write-Host "    WARNING: $scriptName not found at $scriptPath" -ForegroundColor Yellow
    }
}

# -- 4e. Build WinClawUI desktop app (C# + WebView2) ----------------------
$winclawUiProject = "$ROOT\apps\windows\WinClawUI\WinClawUI.csproj"
if (Test-Path $winclawUiProject) {
    Write-Host "==> Building WinClawUI desktop app..."
    $publishDir = "$STAGING\winclawui-publish"
    $prevEAP2 = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    # NOTE: PublishTrimmed is intentionally disabled.  WebView2 relies on COM
    # interop and runtime reflection that the IL trimmer silently breaks, even
    # with TrimMode=partial.  EnableCompressionInSingleFile keeps the EXE small
    # (~49 MB compressed vs ~57 MB trimmed, ~109 MB uncompressed).
    dotnet publish $winclawUiProject `
        -c Release `
        -r win-x64 `
        --self-contained true `
        -p:PublishSingleFile=true `
        -p:EnableCompressionInSingleFile=true `
        -p:IncludeNativeLibrariesForSelfExtract=true `
        -o $publishDir 2>&1 | ForEach-Object { Write-Host "    $_" }
    $ErrorActionPreference = $prevEAP2

    $publishedExe = "$publishDir\WinClawUI.exe"
    if (Test-Path $publishedExe) {
        Copy-Item $publishedExe "$STAGING\WinClawUI.exe" -Force
        Remove-Item $publishDir -Recurse -Force -ErrorAction SilentlyContinue
        $exeSize = [math]::Round((Get-Item "$STAGING\WinClawUI.exe").Length / 1MB, 1)
        Write-Host "    WinClawUI.exe: $exeSize MB" -ForegroundColor Green
    } else {
        Write-Warning "WinClawUI.exe not found after publish; desktop app will not be included"
    }
} else {
    Write-Host "==> Skipping WinClawUI (project not found)"
}

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
