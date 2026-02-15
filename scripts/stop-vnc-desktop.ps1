<#
.SYNOPSIS
    Stop VNC desktop streaming (kill websockify process)
.DESCRIPTION
    Stops the websockify background process. TightVNC service is left running
    (it's lightweight and causes no issues).
#>

param(
    [switch]$StopVnc   # Also stop TightVNC service
)

function Write-Step { param([string]$msg) Write-Host "`n>> $msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$msg) Write-Host "   OK: $msg" -ForegroundColor Green }

Write-Step "Stopping websockify..."

# Find and kill websockify processes
$killed = 0
Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessName -match 'python|websockify' -and
    ($_.CommandLine -like '*websockify*' -or $_.MainModule.FileName -like '*websockify*')
} | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    $killed++
}

if ($killed -gt 0) {
    Write-OK "Stopped $killed websockify process(es)"
} else {
    Write-OK "No websockify processes found (already stopped)"
}

if ($StopVnc) {
    Write-Step "Stopping TightVNC service..."
    Stop-Service -Name tvnserver -ErrorAction SilentlyContinue
    Write-OK "TightVNC service stopped"
}

Write-Host ""
Write-Host "VNC desktop streaming stopped." -ForegroundColor Green
Write-Host ""
