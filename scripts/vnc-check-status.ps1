<#
.SYNOPSIS
    Check VNC Desktop Control status (no admin required)
.DESCRIPTION
    Diagnoses the VNC desktop streaming setup: TightVNC, websockify, noVNC, and port status.
    Outputs a summary table showing what is installed and what is running.
.EXAMPLE
    .\scripts\vnc-check-status.ps1
#>

$NoVncDir = Join-Path $env:USERPROFILE ".winclaw\vnc\novnc"
# Fallback to installer directory
if (-not (Test-Path (Join-Path $NoVncDir "vnc.html"))) {
    $fallback = Join-Path $PSScriptRoot "novnc"
    if (Test-Path (Join-Path $fallback "vnc.html")) {
        $NoVncDir = $fallback
    }
}

Write-Host ""
Write-Host "  WinClaw VNC Desktop Control - Status Check" -ForegroundColor Cyan
Write-Host "  ===========================================" -ForegroundColor Cyan
Write-Host ""

$results = @()

# 1. TightVNC installed?
$tvnPath = "C:\Program Files\TightVNC\tvnserver.exe"
$tvnInstalled = Test-Path $tvnPath
$results += [PSCustomObject]@{
    Component = "TightVNC Server"
    Status    = if ($tvnInstalled) { "Installed" } else { "Not installed" }
    Detail    = if ($tvnInstalled) { $tvnPath } else { "Run setup-vnc-desktop.ps1 as Admin" }
    OK        = $tvnInstalled
}

# 2. TightVNC service running?
$svc = Get-Service -Name tvnserver -ErrorAction SilentlyContinue
$svcRunning = $svc -and ($svc.Status -eq 'Running')
$results += [PSCustomObject]@{
    Component = "TightVNC Service"
    Status    = if (-not $svc) { "Not installed" } elseif ($svcRunning) { "Running" } else { "Stopped" }
    Detail    = if ($svcRunning) { "Service active" } elseif ($svc) { "Start-Service tvnserver" } else { "Install TightVNC first" }
    OK        = $svcRunning
}

# 3. VNC port 5900 listening?
$vnc5900 = $false
try {
    $tcpVnc = Test-NetConnection -ComputerName localhost -Port 5900 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    $vnc5900 = $tcpVnc.TcpTestSucceeded
} catch {}
$results += [PSCustomObject]@{
    Component = "VNC Port 5900"
    Status    = if ($vnc5900) { "Listening" } else { "Closed" }
    Detail    = if ($vnc5900) { "TightVNC accepting connections" } else { "Start TightVNC service" }
    OK        = $vnc5900
}

# 4. websockify installed?
$wsockify = Get-Command websockify -ErrorAction SilentlyContinue
$results += [PSCustomObject]@{
    Component = "websockify"
    Status    = if ($wsockify) { "Installed" } else { "Not found" }
    Detail    = if ($wsockify) { $wsockify.Source } else { "pip install websockify" }
    OK        = [bool]$wsockify
}

# 5. noVNC files present?
$novncExists = Test-Path (Join-Path $NoVncDir "vnc.html")
$results += [PSCustomObject]@{
    Component = "noVNC HTML Client"
    Status    = if ($novncExists) { "Present" } else { "Missing" }
    Detail    = if ($novncExists) { $NoVncDir } else { "Run setup-vnc-desktop.ps1" }
    OK        = $novncExists
}

# 6. websockify port 6080 listening?
$ws6080 = $false
try {
    $tcpWs = Test-NetConnection -ComputerName localhost -Port 6080 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    $ws6080 = $tcpWs.TcpTestSucceeded
} catch {}
$results += [PSCustomObject]@{
    Component = "WebSocket Port 6080"
    Status    = if ($ws6080) { "Listening" } else { "Closed" }
    Detail    = if ($ws6080) { "websockify bridge active" } else { "Run start-vnc-desktop.ps1" }
    OK        = $ws6080
}

# Display results
foreach ($r in $results) {
    $icon = if ($r.OK) { "[OK]" } else { "[--]" }
    $color = if ($r.OK) { "Green" } else { "Yellow" }
    Write-Host ("  {0,-5} {1,-22} {2,-15} {3}" -f $icon, $r.Component, $r.Status, $r.Detail) -ForegroundColor $color
}

Write-Host ""

# Overall status
$allOk = ($results | Where-Object { -not $_.OK }).Count -eq 0
if ($allOk) {
    Write-Host "  All components ready! noVNC URL:" -ForegroundColor Green
    Write-Host "  http://localhost:6080/vnc.html?autoconnect=1&resize=remote" -ForegroundColor Cyan
} else {
    $setupNeeded = ($results | Where-Object { -not $_.OK -and $_.Component -notlike "*Port*" }).Count -gt 0
    $startNeeded = ($results | Where-Object { -not $_.OK -and $_.Component -like "*Port*" }).Count -gt 0
    if ($setupNeeded) {
        Write-Host "  Setup needed: Run setup-vnc-desktop.ps1 as Administrator" -ForegroundColor Yellow
    }
    if ($startNeeded -and -not $setupNeeded) {
        Write-Host "  Start needed: Run start-vnc-desktop.ps1" -ForegroundColor Yellow
    }
}
Write-Host ""
