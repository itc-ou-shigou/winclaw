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
  Writes to stdout (for caller to parse):
    CHROME_DEBUG_PORT=<port>   — the port where Chrome debugging is active
  Writes to stderr (diagnostics only, safe for MCP stdio channel):
    OK: ...                    — human-readable success message
    ERROR: ...                 — error conditions
    WARNING: ...               — timeout warnings

.EXAMPLE
  .\ensure-chrome-debug.ps1
  .\ensure-chrome-debug.ps1 -PreferredPort 9223
#>

param(
    [int]$PreferredPort = 9222
)

$ErrorActionPreference = "Stop"

# CRITICAL: This script's stdout may feed into the MCP stdio channel via
# launch-chrome-devtools-mcp.ps1. ONLY the "CHROME_DEBUG_PORT=<port>" line
# should go to stdout (Write-Host). ALL other diagnostic messages MUST use
# [Console]::Error.WriteLine (stderr) to avoid polluting the JSON-RPC channel.

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
[Console]::Error.WriteLine("Scanning ports ${PortRangeStart}-${PortRangeEnd} for Chrome DevTools...")

for ($port = $PortRangeStart; $port -le $PortRangeEnd; $port++) {
    if (Test-PortListening -Port $port) {
        # Set environment variable for current session and persist for user
        $env:CHROME_DEBUG_PORT = $port
        [System.Environment]::SetEnvironmentVariable("CHROME_DEBUG_PORT", "$port", "User")
        Write-Host "CHROME_DEBUG_PORT=$port"
        [Console]::Error.WriteLine("OK: Port $port is already listening. Chrome DevTools MCP can connect.")
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
    [Console]::Error.WriteLine("ERROR: All ports in range ${PortRangeStart}-${PortRangeEnd} are in use.")
    [Console]::Error.WriteLine("NEEDS_USER_ACTION: Free up a port in range ${PortRangeStart}-${PortRangeEnd} or close other debugging sessions.")
    exit 1
}

# Ensure WinClaw Chrome profile directory exists
if (-not (Test-Path $WinClawDataDir)) {
    New-Item -ItemType Directory -Path $WinClawDataDir -Force | Out-Null
    [Console]::Error.WriteLine("Created WinClaw Chrome profile at: $WinClawDataDir")
}

# Launch a dedicated Chrome instance for WinClaw with its own profile
# This runs alongside any existing Chrome windows without affecting them
[Console]::Error.WriteLine("Launching dedicated WinClaw Chrome instance with --remote-debugging-port=$DebugPort ...")
[Console]::Error.WriteLine("  Profile: $WinClawDataDir")
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
        # Set environment variable for current session and persist for user
        $env:CHROME_DEBUG_PORT = $DebugPort
        [System.Environment]::SetEnvironmentVariable("CHROME_DEBUG_PORT", "$DebugPort", "User")
        Write-Host "CHROME_DEBUG_PORT=$DebugPort"
        [Console]::Error.WriteLine("OK: WinClaw Chrome started. Port $DebugPort is listening after ${waited}s.")
        exit 0
    }
}

[Console]::Error.WriteLine("WARNING: Chrome launched but port $DebugPort not listening after ${maxWait}s.")
[Console]::Error.WriteLine("Please check if another process is using port $DebugPort.")
exit 1
