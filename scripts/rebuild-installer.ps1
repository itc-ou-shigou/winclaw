$ErrorActionPreference = "Stop"
$ROOT = "C:\work\winclaw"
$STAGING = "$ROOT\dist\win-staging"
$NODE_VERSION = "22.14.0"
$PKG_VERSION = (Get-Content "$ROOT\package.json" | ConvertFrom-Json).version

Write-Host "==> WinClaw Installer Rebuild v$PKG_VERSION" -ForegroundColor Cyan

# -- 1. Download Node.js portable --
$zipPath = "$ROOT\dist\cache\node-v$NODE_VERSION-win-x64.zip"
$nodeUrl = "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-win-x64.zip"
if (-not (Test-Path $zipPath) -or (Get-Item $zipPath -ErrorAction SilentlyContinue).Length -lt 1000000) {
    Write-Host "==> Downloading Node.js v$NODE_VERSION..."
    New-Item -ItemType Directory -Path (Split-Path $zipPath) -Force | Out-Null
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Invoke-WebRequest -Uri $nodeUrl -OutFile $zipPath -UseBasicParsing
}
Write-Host "    Node.js zip: $([math]::Round((Get-Item $zipPath).Length / 1MB, 1)) MB"

# -- 2. npm pack (BEFORE staging to avoid including staging in tarball) --
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

# -- 3. Stage --
Write-Host "==> Staging installer files..."
if (Test-Path $STAGING) { Remove-Item $STAGING -Recurse -Force }
New-Item -ItemType Directory -Path $STAGING -Force | Out-Null

# Extract Node.js
Write-Host "    Extracting Node.js..."
$tmpDir = "$STAGING\node-extract"
Expand-Archive -Path $zipPath -DestinationPath $tmpDir -Force
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

# Locate and copy package
$appSrc = $null
foreach ($pkgName in @("openclaw", "winclaw")) {
    foreach ($subDir in @("node_modules\$pkgName", "lib\node_modules\$pkgName")) {
        $candidate = "$STAGING\app-global\$subDir"
        if (Test-Path $candidate) { $appSrc = $candidate; break }
    }
    if ($appSrc) { break }
}
if (-not $appSrc) { Write-Error "Package not found"; exit 1 }
Write-Host "    Package: $appSrc"

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

# Remove optional heavy native binaries (peerDependencies, not needed for most users)
# @node-llama-cpp: ~690 MB of CUDA/Vulkan/ARM64 binaries for local LLM inference
$heavyOptionals = @(
    "$STAGING\app\node_modules\@node-llama-cpp"
)
foreach ($optDir in $heavyOptionals) {
    if (Test-Path $optDir) {
        $optSize = [math]::Round((Get-ChildItem $optDir -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
        Write-Host "    Removing optional: $(Split-Path $optDir -Leaf) ($optSize MB)"
        Remove-Item $optDir -Recurse -Force
    }
}

# Remove build artifacts that npm pack includes from project dist/ dir
# (installer EXEs, Node.js download cache, staging leftovers)
$appDist = "$STAGING\app\dist"
if (Test-Path $appDist) {
    $junkPatterns = @("WinClawSetup-*.exe", "*.tgz")
    foreach ($pattern in $junkPatterns) {
        Get-ChildItem $appDist -Filter $pattern -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "    Removing junk from app/dist: $($_.Name) ($([math]::Round($_.Length / 1MB, 1)) MB)"
            Remove-Item $_.FullName -Force
        }
    }
    $junkDirs = @("cache", "win-staging")
    foreach ($jd in $junkDirs) {
        $jdPath = "$appDist\$jd"
        if (Test-Path $jdPath) {
            $jdSize = [math]::Round((Get-ChildItem $jdPath -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
            Write-Host "    Removing junk dir from app/dist: $jd/ ($jdSize MB)"
            Remove-Item $jdPath -Recurse -Force
        }
    }
}

# Slim down staging: remove files not needed at runtime (~200 MB savings)
Write-Host "    Slimming down staging..."
$nm = "$STAGING\app\node_modules"
$saved = 0

# 1. TypeScript source (.ts) and source maps (.map) in node_modules - not needed at runtime
foreach ($ext in @("*.ts", "*.map")) {
    $files = Get-ChildItem $nm -Recurse -File -Filter $ext -ErrorAction SilentlyContinue
    $sz = ($files | Measure-Object -Property Length -Sum).Sum / 1MB
    $files | Remove-Item -Force -ErrorAction SilentlyContinue
    $saved += $sz
    Write-Host "      Removed $($files.Count) $ext files ($([math]::Round($sz, 1)) MB)"
}

# 2. Debug symbols (.pdb)
$pdbFiles = Get-ChildItem $STAGING -Recurse -File -Filter "*.pdb" -ErrorAction SilentlyContinue
if ($pdbFiles) {
    $sz = ($pdbFiles | Measure-Object -Property Length -Sum).Sum / 1MB
    $pdbFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    $saved += $sz
    Write-Host "      Removed $($pdbFiles.Count) .pdb files ($([math]::Round($sz, 1)) MB)"
}

# 3. README/CHANGELOG/CONTRIBUTING etc in node_modules
$docFiles = Get-ChildItem $nm -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(README|CHANGELOG|HISTORY|CONTRIBUTING|AUTHORS|CODE_OF_CONDUCT)' }
if ($docFiles) {
    $sz = ($docFiles | Measure-Object -Property Length -Sum).Sum / 1MB
    $docFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    $saved += $sz
    Write-Host "      Removed $($docFiles.Count) doc files ($([math]::Round($sz, 1)) MB)"
}

# 4. app/docs/ directory (internal dev docs, not needed for runtime)
if (Test-Path "$STAGING\app\docs") {
    $sz = (Get-ChildItem "$STAGING\app\docs" -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    Remove-Item "$STAGING\app\docs" -Recurse -Force
    $saved += $sz
    Write-Host "      Removed app/docs/ ($([math]::Round($sz, 1)) MB)"
}

# 5. Dev-only packages: bun-types, @types (type definitions not needed at runtime)
foreach ($devPkg in @("bun-types", "@types")) {
    $devPath = "$nm\$devPkg"
    if (Test-Path $devPath) {
        $sz = (Get-ChildItem $devPath -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
        Remove-Item $devPath -Recurse -Force
        $saved += $sz
        Write-Host "      Removed $devPkg ($([math]::Round($sz, 1)) MB)"
    }
}

# 6. node-llama-cpp main package (llama/ subdir has 27 MB of model binaries)
$llamaMain = "$nm\node-llama-cpp"
if (Test-Path $llamaMain) {
    $sz = (Get-ChildItem $llamaMain -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    Remove-Item $llamaMain -Recurse -Force
    $saved += $sz
    Write-Host "      Removed node-llama-cpp ($([math]::Round($sz, 1)) MB)"
}

# 7. node/node_modules (bundled npm, not needed since we use app's own npm)
$nodeNm = "$STAGING\node\node_modules"
if (Test-Path $nodeNm) {
    $sz = (Get-ChildItem $nodeNm -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    Remove-Item $nodeNm -Recurse -Force
    $saved += $sz
    Write-Host "      Removed node/node_modules ($([math]::Round($sz, 1)) MB)"
}

Write-Host "    Total slimmed: $([math]::Round($saved, 0)) MB" -ForegroundColor Green

# Assets + launcher
New-Item -ItemType Directory -Path "$STAGING\assets" -Force | Out-Null
Copy-Item "$ROOT\assets\winclaw.ico" "$STAGING\assets\" -Force
Copy-Item "$ROOT\assets\logo.png" "$STAGING\assets\" -Force
@"
@echo off
setlocal
set "WINCLAW_NODE=%~dp0node\node.exe"
set "WINCLAW_APP=%~dp0app\winclaw.mjs"
"%WINCLAW_NODE%" "%WINCLAW_APP%" %*
"@ | Set-Content "$STAGING\winclaw.cmd" -Encoding ASCII

# UI Launcher script (starts gateway + opens browser)
Copy-Item "$ROOT\scripts\winclaw-ui.cmd" "$STAGING\winclaw-ui.cmd" -Force

# -- 4. Compile ISCC --
Write-Host "==> Compiling Inno Setup installer..."
$iscc = Get-Command iscc.exe -ErrorAction SilentlyContinue
if (-not $iscc) { $iscc = Get-Command "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe" -ErrorAction SilentlyContinue }
if (-not $iscc) { $iscc = Get-Command "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" -ErrorAction SilentlyContinue }
if (-not $iscc) { Write-Error "ISCC.exe not found"; exit 1 }

& $iscc.Source "/DAppVersion=$PKG_VERSION" "/DStagingDir=$STAGING" "/DOutputDir=$ROOT\dist" "$ROOT\scripts\windows-installer.iss"

$installer = Get-ChildItem "$ROOT\dist\WinClawSetup-$PKG_VERSION.exe" -ErrorAction SilentlyContinue
if ($installer) {
    Write-Host "==> SUCCESS: $($installer.FullName)" -ForegroundColor Green
    Write-Host "    Size: $([math]::Round($installer.Length / 1MB, 1)) MB"
    # Copy to docs and releases
    Copy-Item $installer.FullName "C:\work\docs\" -Force
    Write-Host "==> Copied to C:\work\docs\$($installer.Name)" -ForegroundColor Green
    $releasesDir = "$ROOT\releases"
    if (Test-Path $releasesDir) {
        Copy-Item $installer.FullName "$releasesDir\" -Force
        Write-Host "==> Copied to $releasesDir\$($installer.Name)" -ForegroundColor Green
    }
} else {
    Write-Error "Installer not found"
    exit 1
}
