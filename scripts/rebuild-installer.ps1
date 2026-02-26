$ErrorActionPreference = "Stop"
$ROOT = "C:\work\winclaw"
$STAGING = "$ROOT\dist\win-staging"
$PKG_VERSION = (Get-Content "$ROOT\package.json" | ConvertFrom-Json).version

Write-Host "==> WinClaw Installer Rebuild v$PKG_VERSION (Electron)" -ForegroundColor Cyan

# -- 0. Build Control UI assets (must run before npm pack so dist/control-ui/ is included in tarball) --
$controlUiIndex = "$ROOT\dist\control-ui\index.html"
if (-not (Test-Path $controlUiIndex)) {
    Write-Host "==> Building Control UI assets..."
    Push-Location $ROOT
    pnpm ui:build
    Pop-Location
    if (-not (Test-Path $controlUiIndex)) {
        Write-Error "Control UI build failed - dist/control-ui/index.html not found"
        exit 1
    }
    Write-Host "    Control UI built successfully." -ForegroundColor Green
} else {
    Write-Host "==> Control UI assets already built (dist/control-ui/index.html exists)" -ForegroundColor Green
}

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
foreach ($pkgName in @("winclaw", "winclaw")) {
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

# 1. TypeScript source (.ts, but keep .d.ts/.d.cts) and source maps (.map) in node_modules
$tsFiles = Get-ChildItem $nm -Recurse -File -Filter "*.ts" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notlike "*.d.ts" -and $_.Name -notlike "*.d.cts" }
$sz = ($tsFiles | Measure-Object -Property Length -Sum).Sum / 1MB
$tsFiles | Remove-Item -Force -ErrorAction SilentlyContinue
$saved += $sz
Write-Host "      Removed $($tsFiles.Count) .ts source files ($([math]::Round($sz, 1)) MB)"
$mapFiles = Get-ChildItem $nm -Recurse -File -Filter "*.map" -ErrorAction SilentlyContinue
$sz = ($mapFiles | Measure-Object -Property Length -Sum).Sum / 1MB
$mapFiles | Remove-Item -Force -ErrorAction SilentlyContinue
$saved += $sz
Write-Host "      Removed $($mapFiles.Count) .map files ($([math]::Round($sz, 1)) MB)"

# 2. Debug symbols (.pdb)
$pdbFiles = Get-ChildItem $STAGING -Recurse -File -Filter "*.pdb" -ErrorAction SilentlyContinue
if ($pdbFiles) {
    $sz = ($pdbFiles | Measure-Object -Property Length -Sum).Sum / 1MB
    $pdbFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    $saved += $sz
    Write-Host "      Removed $($pdbFiles.Count) .pdb files ($([math]::Round($sz, 1)) MB)"
}

# 3. README/CHANGELOG/CONTRIBUTING etc in node_modules
$docFiles = Get-ChildItem $nm -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(README|CHANGELOG|HISTORY|CONTRIBUTING|AUTHORS|CODE_OF_CONDUCT)' -and $_.Extension -in @('.md', '.txt', '.rst', '.adoc', '') }
if ($docFiles) {
    $sz = ($docFiles | Measure-Object -Property Length -Sum).Sum / 1MB
    $docFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    $saved += $sz
    Write-Host "      Removed $($docFiles.Count) doc files ($([math]::Round($sz, 1)) MB)"
}

# 4. app/docs/ directory EXCEPT docs/reference/templates (workspace templates needed at runtime)
$appDocsRef = "$STAGING\app\docs\reference\templates"
if (Test-Path "$STAGING\app\docs") {
    $sz = (Get-ChildItem "$STAGING\app\docs" -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    if (Test-Path $appDocsRef) {
        $tmpTemplates = "$STAGING\_templates_preserve"
        Copy-Item $appDocsRef $tmpTemplates -Recurse -Force
        Remove-Item "$STAGING\app\docs" -Recurse -Force
        New-Item -ItemType Directory -Path $appDocsRef -Force | Out-Null
        Copy-Item "$tmpTemplates\*" $appDocsRef -Recurse -Force
        Remove-Item $tmpTemplates -Recurse -Force -ErrorAction SilentlyContinue
        $keptCount = (Get-ChildItem $appDocsRef -File).Count
        Write-Host "      Removed app/docs/ ($([math]::Round($sz, 1)) MB), kept docs/reference/templates/ ($keptCount files)"
    } else {
        Remove-Item "$STAGING\app\docs" -Recurse -Force
        Write-Host "      Removed app/docs/ ($([math]::Round($sz, 1)) MB)"
    }
    $saved += $sz
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

# 7. Platform-specific native binaries: keep only win32-x64 (koffi, etc.)
# koffi ships ALL platform builds (darwin, linux, freebsd, musl, openbsd, win32_ia32, win32_arm64)
$koffiBuild = "$nm\koffi\build\koffi"
if (Test-Path $koffiBuild) {
    $koffiDirs = Get-ChildItem $koffiBuild -Directory | Where-Object { $_.Name -ne "win32_x64" }
    if ($koffiDirs.Count -gt 0) {
        $sz = ($koffiDirs | ForEach-Object { (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum } | Measure-Object -Sum).Sum / 1MB
        $koffiDirs | Remove-Item -Recurse -Force
        $saved += $sz
        Write-Host "      Removed koffi non-win64 platforms ($($koffiDirs.Count) dirs, $([math]::Round($sz, 1)) MB)"
    }
}
# koffi/src (C source) and koffi/doc not needed at runtime
foreach ($koffiExtra in @("$nm\koffi\src", "$nm\koffi\doc", "$nm\koffi\vendor")) {
    if (Test-Path $koffiExtra) {
        $sz = (Get-ChildItem $koffiExtra -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
        Remove-Item $koffiExtra -Recurse -Force
        $saved += $sz
        Write-Host "      Removed $(Split-Path $koffiExtra -Leaf)/ ($([math]::Round($sz, 1)) MB)"
    }
}

# 8. pdfjs-dist/legacy (duplicate legacy build, not needed for modern Node/Electron)
$pdfjsLegacy = "$nm\pdfjs-dist\legacy"
if (Test-Path $pdfjsLegacy) {
    $sz = (Get-ChildItem $pdfjsLegacy -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    Remove-Item $pdfjsLegacy -Recurse -Force
    $saved += $sz
    Write-Host "      Removed pdfjs-dist/legacy ($([math]::Round($sz, 1)) MB)"
}
# pdfjs-dist/types (TypeScript declarations) not needed at runtime
$pdfjsTypes = "$nm\pdfjs-dist\types"
if (Test-Path $pdfjsTypes) {
    $sz = (Get-ChildItem $pdfjsTypes -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    Remove-Item $pdfjsTypes -Recurse -Force
    $saved += $sz
    Write-Host "      Removed pdfjs-dist/types ($([math]::Round($sz, 1)) MB)"
}

# 9. playwright-core/types (TypeScript declarations, ~1.7 MB)
$pwTypes = "$nm\playwright-core\types"
if (Test-Path $pwTypes) {
    $sz = (Get-ChildItem $pwTypes -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
    Remove-Item $pwTypes -Recurse -Force
    $saved += $sz
    Write-Host "      Removed playwright-core/types ($([math]::Round($sz, 1)) MB)"
}

# 10. Remove all .d.ts and .d.cts declaration files in node_modules (not needed at runtime)
$dtsFiles = Get-ChildItem $nm -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*.d.ts" -or $_.Name -like "*.d.cts" -or $_.Name -like "*.d.mts" }
if ($dtsFiles) {
    $sz = ($dtsFiles | Measure-Object -Property Length -Sum).Sum / 1MB
    $dtsFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    $saved += $sz
    Write-Host "      Removed $($dtsFiles.Count) .d.ts/.d.cts declaration files ($([math]::Round($sz, 1)) MB)"
}

# 11. Test/spec directories in node_modules (not needed at runtime)
$testDirs = Get-ChildItem $nm -Directory -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -in @("test", "tests", "__tests__", "spec", "__mocks__", "fixtures", "benchmark", "benchmarks", "examples", "example") }
if ($testDirs) {
    $sz = ($testDirs | ForEach-Object { (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum } | Measure-Object -Sum).Sum / 1MB
    $testDirs | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    $saved += $sz
    Write-Host "      Removed $($testDirs.Count) test/example directories ($([math]::Round($sz, 1)) MB)"
}

# 12. Dev config files in node_modules packages (tsconfig, eslint, prettier, etc.)
$devConfigs = Get-ChildItem $nm -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(tsconfig.*\.json|\.eslintrc.*|\.prettierrc.*|jest\.config\.*|\.npmignore|\.gitignore|\.editorconfig|\.babelrc.*|rollup\.config\.*|webpack\.config\.*|vite\.config\.*|vitest\.config\.*|karma\.conf\.*|\.travis\.yml|\.github|Makefile|Gruntfile\.*|Gulpfile\.*)$' }
if ($devConfigs) {
    $sz = ($devConfigs | Measure-Object -Property Length -Sum).Sum / 1MB
    $devConfigs | Remove-Item -Force -ErrorAction SilentlyContinue
    $saved += $sz
    Write-Host "      Removed $($devConfigs.Count) dev config files ($([math]::Round($sz, 1)) MB)"
}

# 13. LICENSE files in node_modules (legal text not needed at runtime, LICENSE in app root preserved)
$licenseFiles = Get-ChildItem $nm -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^(LICENSE|LICENCE|COPYING|NOTICE)(\..*)?$' }
if ($licenseFiles) {
    $sz = ($licenseFiles | Measure-Object -Property Length -Sum).Sum / 1MB
    $licenseFiles | Remove-Item -Force -ErrorAction SilentlyContinue
    $saved += $sz
    Write-Host "      Removed $($licenseFiles.Count) license files ($([math]::Round($sz, 1)) MB)"
}

# 14. Native addon build dependencies (source/headers not needed when prebuilt binaries exist)
$nativeBuildDirs = @(
    "$nm\@discordjs\opus\deps",    # opus C source headers (~5.5 MB), prebuild exists
    "$nm\@discordjs\opus\src",     # C++ binding source
    "$nm\sharp\src"                # sharp C++ source, prebuilt @img/sharp-win32-x64 exists
)
foreach ($nbd in $nativeBuildDirs) {
    if (Test-Path $nbd) {
        $sz = (Get-ChildItem $nbd -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
        Remove-Item $nbd -Recurse -Force
        $saved += $sz
        $relPath = $nbd -replace [regex]::Escape($nm + "\"), ""
        Write-Host "      Removed native source: $relPath ($([math]::Round($sz, 1)) MB)"
    }
}

# 15. Dual CJS/ESM builds: remove duplicate format when both exist
# @larksuiteoapi ships both lib/ (CJS) and es/ (ESM) - keep lib/ only
$dualBuildRemove = @(
    "$nm\@larksuiteoapi\node-sdk\es"   # ESM duplicate (~4.6 MB), lib/ (CJS) is used
)
foreach ($dbr in $dualBuildRemove) {
    if (Test-Path $dbr) {
        $sz = (Get-ChildItem $dbr -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
        Remove-Item $dbr -Recurse -Force
        $saved += $sz
        $relPath = $dbr -replace [regex]::Escape($nm + "\"), ""
        Write-Host "      Removed dual build: $relPath ($([math]::Round($sz, 1)) MB)"
    }
}

Write-Host "    Total slimmed: $([math]::Round($saved, 0)) MB" -ForegroundColor Green

# -- Post-cleanup integrity check: verify critical runtime files weren't removed --
Write-Host "    Verifying critical runtime files..."
$criticalFiles = @(
    "$STAGING\app\dist\control-ui\index.html",
    "$STAGING\app\docs\reference\templates\AGENTS.md",
    "$STAGING\app\docs\reference\templates\SOUL.md",
    "$STAGING\app\docs\reference\templates\TOOLS.md",
    "$STAGING\app\docs\reference\templates\IDENTITY.md",
    "$STAGING\app\docs\reference\templates\USER.md",
    "$STAGING\app\docs\reference\templates\HEARTBEAT.md",
    "$STAGING\app\docs\reference\templates\BOOTSTRAP.md",
    "$nm\@whiskeysockets\baileys\lib\Utils\history.js",
    "$nm\@whiskeysockets\baileys\lib\Utils\history.d.ts",
    "$nm\@modelcontextprotocol\sdk\dist\esm\client\index.js"
)
$missingCount = 0
foreach ($cf in $criticalFiles) {
    if (-not (Test-Path $cf)) {
        $missingCount++
        Write-Host "      MISSING: $($cf -replace [regex]::Escape($STAGING), '')" -ForegroundColor Red
        # Attempt to restore from source tree
        $relPath = ($cf -replace [regex]::Escape("$STAGING\app\"), "")
        $srcPath = "$ROOT\$relPath"
        if (Test-Path $srcPath) {
            $destDir = Split-Path $cf -Parent
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            Copy-Item $srcPath $cf -Force
            Write-Host "      RESTORED from source: $relPath" -ForegroundColor Yellow
            $missingCount--
        }
    }
}
if ($missingCount -gt 0) {
    Write-Warning "  $missingCount critical file(s) could not be restored - installer may produce broken builds!"
} else {
    Write-Host "    All critical runtime files verified." -ForegroundColor Green
}

# Assets + launcher
New-Item -ItemType Directory -Path "$STAGING\assets" -Force | Out-Null
Copy-Item "$ROOT\assets\winclaw.ico" "$STAGING\assets\" -Force
Copy-Item "$ROOT\assets\logo.png" "$STAGING\assets\" -Force
# winclaw.cmd uses system Node.js (requires Node >= 22.12)
# Electron v33 embeds Node 20.x which is too old for winclaw
@"
@echo off
setlocal
set "WINCLAW_APP=%~dp0app\winclaw.mjs"
node "%WINCLAW_APP%" %*
"@ | Set-Content "$STAGING\winclaw.cmd" -Encoding ASCII

# UI Launcher script (starts gateway + opens browser)
Copy-Item "$ROOT\scripts\winclaw-ui.cmd" "$STAGING\winclaw-ui.cmd" -Force

# Build and stage Electron desktop app (replaces C#/WebView2 shell)
Write-Host "==> Building Electron desktop app..."
$electronDir = "$ROOT\apps\electron"
if (-not (Test-Path "$electronDir\node_modules")) {
    Write-Host "    Installing Electron dependencies..."
    Push-Location $electronDir
    npm install 2>&1 | ForEach-Object { Write-Host "    $_" }
    Pop-Location
}

# Use a unique output dir to avoid EBUSY conflicts with previous runs
$electronOut = "$ROOT\dist\electron-pkg-$([guid]::NewGuid().ToString('N').Substring(0,8))"
Write-Host "    Packaging Electron app to $electronOut ..."
Push-Location $electronDir
$prevEAP2 = $ErrorActionPreference
$ErrorActionPreference = "Continue"
npx electron-packager . winclaw `
    --platform=win32 --arch=x64 `
    --overwrite `
    "--out=$electronOut" `
    "--icon=$ROOT\assets\winclaw.ico" `
    "--app-version=$PKG_VERSION" `
    --prune=true --asar 2>&1 | ForEach-Object { Write-Host "    $_" }
$ErrorActionPreference = $prevEAP2
Pop-Location

$electronSrc = "$electronOut\winclaw-win32-x64"
if (Test-Path $electronSrc) {
    # Slim: remove unnecessary locales (keep en-US and ja only)
    $localesDir = "$electronSrc\locales"
    if (Test-Path $localesDir) {
        Get-ChildItem "$localesDir\*.pak" | Where-Object { $_.Name -notin @("en-US.pak", "ja.pak") } | Remove-Item -Force
        Write-Host "    Locales slimmed to en-US + ja"
    }
    # Remove Chromium license file (9 MB)
    Remove-Item "$electronSrc\LICENSES.chromium.html" -Force -ErrorAction SilentlyContinue
    Remove-Item "$electronSrc\LICENSE" -Force -ErrorAction SilentlyContinue
    # Remove DLLs not needed for standard web UI rendering (~8 MB)
    # vk_swiftshader/vulkan: Vulkan software renderer, not needed
    # d3dcompiler_47: D3D shader compiler, not needed
    # NOTE: ffmpeg.dll is REQUIRED by Electron — do NOT remove it
    $electronJunk = @("vk_swiftshader.dll", "d3dcompiler_47.dll", "vulkan-1.dll", "vk_swiftshader_icd.json")
    foreach ($ejf in $electronJunk) {
        $ejPath = "$electronSrc\$ejf"
        if (Test-Path $ejPath) {
            $ejSize = [math]::Round((Get-Item $ejPath).Length / 1MB, 1)
            Remove-Item $ejPath -Force
            Write-Host "    Removed $ejf ($ejSize MB)"
        }
    }

    # Copy to staging as desktop/
    New-Item -ItemType Directory -Path "$STAGING\desktop" -Force | Out-Null
    & robocopy "$electronSrc" "$STAGING\desktop" /E /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    $desktopSize = [math]::Round((Get-ChildItem "$STAGING\desktop" -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB, 1)
    Write-Host "    desktop/ (Electron): $desktopSize MB" -ForegroundColor Green
    # Cleanup temp electron packaging dir
    Remove-Item $electronOut -Recurse -Force -ErrorAction SilentlyContinue
} else {
    Write-Warning "Electron packaging failed; desktop app will not be included"
}

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
