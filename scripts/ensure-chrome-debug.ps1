<#
.SYNOPSIS
  Safely ensure a Chrome instance with --remote-debugging-port=9222 is available.

.DESCRIPTION
  This script is the ONLY approved way for the WinClaw agent to handle Chrome
  debugging mode. It follows a safe sequence:

  1. If port 9222 is already listening → do nothing (already OK)
  2. If Chrome is running WITHOUT debugging port → launch a SEPARATE Chrome
     instance with its own user-data-dir for WinClaw (does NOT affect the
     user's existing Chrome windows or tabs)
  3. If Chrome is NOT running at all → launch it with debugging port

  This script NEVER kills Chrome processes. It NEVER touches user tabs.
#>

$ErrorActionPreference = "Stop"

# --- Configuration ---
$ChromePath     = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$DebugPort      = 9222
$WinClawDataDir = Join-Path $env:USERPROFILE ".winclaw\chrome-debug-profile"

# --- Step 1: Check if port is already listening ---
$tcp = Test-NetConnection -ComputerName localhost -Port $DebugPort -WarningAction SilentlyContinue
if ($tcp.TcpTestSucceeded) {
    Write-Host "OK: Port $DebugPort is already listening. Chrome DevTools MCP can connect."
    exit 0
}

# --- Step 2: Port not listening — need to launch Chrome with debugging ---
# Ensure WinClaw Chrome profile directory exists
if (-not (Test-Path $WinClawDataDir)) {
    New-Item -ItemType Directory -Path $WinClawDataDir -Force | Out-Null
    Write-Host "Created WinClaw Chrome profile at: $WinClawDataDir"
}

# Launch a dedicated Chrome instance for WinClaw with its own profile
# This runs alongside any existing Chrome windows without affecting them
Write-Host "Launching dedicated WinClaw Chrome instance with --remote-debugging-port=$DebugPort ..."
Write-Host "  Profile: $WinClawDataDir"
$chromeArgs = @(
    "--remote-debugging-port=$DebugPort"
    "--user-data-dir=$WinClawDataDir"
    "--no-first-run"
    "--no-default-browser-check"
    "--start-minimized"
)
Start-Process -FilePath $ChromePath -ArgumentList ($chromeArgs -join " ")

# --- Step 3: Wait for port to become available ---
$maxWait = 20
$waited  = 0
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++
    $tcp = Test-NetConnection -ComputerName localhost -Port $DebugPort -WarningAction SilentlyContinue
    if ($tcp.TcpTestSucceeded) {
        Write-Host "OK: WinClaw Chrome started. Port $DebugPort is listening after ${waited}s."
        exit 0
    }
}

Write-Host "WARNING: Chrome launched but port $DebugPort not listening after ${maxWait}s."
Write-Host "Please check if another process is using port $DebugPort."
exit 1
