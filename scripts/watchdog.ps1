# WinClaw + GRC Desktop Watchdog
# Checks that WinClaw gateway and GRC Desktop are running, restarts if not.
#
# Register as a Windows Scheduled Task (runs every 5 minutes):
#   schtasks /create /tn "WinClaw Watchdog" /tr "powershell -ExecutionPolicy Bypass -File C:\work\winclaw\scripts\watchdog.ps1" /sc minute /mo 5

$winclawPort = 18789
$grcPort = 3100

# Check WinClaw gateway
$winclaw = Get-NetTCPConnection -LocalPort $winclawPort -State Listen -ErrorAction SilentlyContinue
if (-not $winclaw) {
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') WinClaw gateway not running, restarting..."
    Start-Process -FilePath "winclaw" -ArgumentList "gateway" -WindowStyle Hidden
} else {
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') WinClaw gateway is running on port $winclawPort"
}

# Check GRC Desktop
$grc = Get-NetTCPConnection -LocalPort $grcPort -State Listen -ErrorAction SilentlyContinue
if (-not $grc) {
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') GRC not running, restarting..."
    $grcExe = "$env:LOCALAPPDATA\Programs\GRC\desktop\grc.exe"
    if (Test-Path $grcExe) {
        Start-Process -FilePath $grcExe -WindowStyle Hidden
    } else {
        Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') GRC executable not found at $grcExe"
    }
} else {
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') GRC Desktop is running on port $grcPort"
}
