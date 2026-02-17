<#
.SYNOPSIS
  Launcher for chrome-devtools-mcp that auto-detects the Chrome debugging port.

.DESCRIPTION
  This script scans ports 9222-9229 for an active Chrome DevTools instance,
  then launches chrome-devtools-mcp with the correct --browserUrl.
  If no Chrome debugging port is found, it runs ensure-chrome-debug.ps1 first.

  Designed to be used as the MCP Bridge stdio command:
    "command": "powershell",
    "args": ["-ExecutionPolicy", "Bypass", "-File", "scripts/launch-chrome-devtools-mcp.ps1"]

.NOTES
  This script's stdout is the MCP stdio channel. Only chrome-devtools-mcp
  should write to stdout. All diagnostic messages use stderr (Write-Error /
  [Console]::Error).
#>

$ErrorActionPreference = "Stop"

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

# --- Step 1: Find an active Chrome debugging port ---
$DebugPort = $null
foreach ($port in 9222..9229) {
    if (Test-PortListening -Port $port) {
        $DebugPort = $port
        break
    }
}

# --- Step 2: If no port found, launch Chrome ---
if (-not $DebugPort) {
    [Console]::Error.WriteLine("[chrome-devtools-mcp-launcher] No Chrome debugging port found, launching Chrome...")
    $ensureScript = Join-Path $PSScriptRoot "ensure-chrome-debug.ps1"
    if (Test-Path $ensureScript) {
        $output = & powershell -ExecutionPolicy Bypass -File $ensureScript 2>&1
        foreach ($line in $output) {
            if ($line -match 'CHROME_DEBUG_PORT=(\d+)') {
                $DebugPort = [int]$Matches[1]
                break
            }
            # Forward non-port lines to stderr
            [Console]::Error.WriteLine($line)
        }
    }
}

if (-not $DebugPort) {
    [Console]::Error.WriteLine("[chrome-devtools-mcp-launcher] ERROR: Could not find or start Chrome with debugging port.")
    exit 1
}

[Console]::Error.WriteLine("[chrome-devtools-mcp-launcher] Using Chrome on port $DebugPort")

# --- Step 3: Set environment variable for downstream tools ---
$env:CHROME_DEBUG_PORT = $DebugPort

# --- Step 4: Launch chrome-devtools-mcp with the correct port ---
# npx will inherit this process's stdin/stdout for MCP stdio transport
$browserUrl = "http://127.0.0.1:$DebugPort"
& npx -y "chrome-devtools-mcp@latest" --browserUrl $browserUrl
