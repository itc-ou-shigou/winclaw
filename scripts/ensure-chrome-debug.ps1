<#
.SYNOPSIS
  Safely ensure a Chrome instance with remote debugging is available.

.DESCRIPTION
  This script is the ONLY approved way for the WinClaw agent to handle Chrome
  debugging mode. It follows a safe sequence:

  1. Scan ports 9222-9229 for an existing Chrome debugging port → use it
  2. If no debugging port found, find the first available port in range
     9222-9229 and launch a SEPARATE Chrome instance with its own
     user-data-dir for WinClaw (does NOT affect the user's existing
     Chrome windows or tabs)
  3. Output the active port as a structured message for the caller

  This script NEVER kills Chrome processes. It NEVER touches user tabs.

.PARAMETER PreferredPort
  The preferred starting port (default: 9222). The script will try this
  port first, then fall back to 9223, 9224, ... up to 9229.

.OUTPUTS
  Writes structured output lines:
    CHROME_DEBUG_PORT=<port>   — the port where Chrome debugging is active
    OK: ...                    — human-readable success message

.EXAMPLE
  .\ensure-chrome-debug.ps1
  .\ensure-chrome-debug.ps1 -PreferredPort 9223
#>

param(
    [int]$PreferredPort = 9222
)

$ErrorActionPreference = "Stop"

# --- Configuration ---
$ChromePath     = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$WinClawDataDir = Join-Path $env:USERPROFILE ".winclaw\chrome-debug-profile"
$PortRangeStart = $PreferredPort
$PortRangeEnd   = 9229

# --- Helper: Test if a port is listening ---
function Test-PortListening {
    param([int]$Port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $result = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
        $success = $result.AsyncWaitHandle.WaitOne(1000)
        if ($success) {
            $tcp.EndConnect($result)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

# --- Step 1: Scan port range for an existing Chrome debugging instance ---
Write-Host "Scanning ports ${PortRangeStart}-${PortRangeEnd} for Chrome DevTools..."

for ($port = $PortRangeStart; $port -le $PortRangeEnd; $port++) {
    if (Test-PortListening -Port $port) {
        Write-Host "CHROME_DEBUG_PORT=$port"
        Write-Host "OK: Port $port is already listening. Chrome DevTools MCP can connect."
        exit 0
    }
}

# --- Step 2: No debugging port found — launch Chrome on first available port ---
# Find first available port
$DebugPort = $null
for ($port = $PortRangeStart; $port -le $PortRangeEnd; $port++) {
    # Check if port is truly free (not just non-Chrome)
    $inUse = (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue)
    if (-not $inUse) {
        $DebugPort = $port
        break
    }
}

if (-not $DebugPort) {
    Write-Host "ERROR: All ports in range ${PortRangeStart}-${PortRangeEnd} are in use."
    Write-Host "NEEDS_USER_ACTION: Free up a port in range ${PortRangeStart}-${PortRangeEnd} or close other debugging sessions."
    exit 1
}

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
    if (Test-PortListening -Port $DebugPort) {
        Write-Host "CHROME_DEBUG_PORT=$DebugPort"
        Write-Host "OK: WinClaw Chrome started. Port $DebugPort is listening after ${waited}s."
        exit 0
    }
}

Write-Host "WARNING: Chrome launched but port $DebugPort not listening after ${maxWait}s."
Write-Host "Please check if another process is using port $DebugPort."
exit 1
