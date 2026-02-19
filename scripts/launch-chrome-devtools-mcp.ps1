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
  CRITICAL: This script's stdout is the MCP stdio channel (JSON-RPC).
  ONLY chrome-devtools-mcp (npx) may write to stdout.
  ALL diagnostic messages MUST use [Console]::Error.WriteLine (stderr).
  Any non-JSON text on stdout will break the MCP transport.
#>

$ErrorActionPreference = "Stop"

# Ensure UTF-8 encoding for stdout (JSON-RPC) and stderr
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

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
        try {
            # IMPORTANT: Do NOT use 2>&1 here — that merges stderr into stdout
            # which pollutes the MCP stdio channel with non-JSON text.
            # ensure-chrome-debug.ps1 writes diagnostics to stderr and only
            # CHROME_DEBUG_PORT=<port> to stdout.
            $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ensureScript 2>$null
            foreach ($line in $output) {
                $lineStr = "$line"
                if ($lineStr -match 'CHROME_DEBUG_PORT=(\d+)') {
                    $DebugPort = [int]$Matches[1]
                    break
                }
                # Forward non-port lines to stderr (never stdout)
                [Console]::Error.WriteLine("[ensure] $lineStr")
            }
        } catch {
            [Console]::Error.WriteLine("[chrome-devtools-mcp-launcher] ensure-chrome-debug failed: $($_.Exception.Message)")
        }
    } else {
        [Console]::Error.WriteLine("[chrome-devtools-mcp-launcher] ensure-chrome-debug.ps1 not found at: $ensureScript")
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
# npx will inherit this process's stdin/stdout for MCP stdio transport.
# Its stderr goes to our stderr (safe — won't pollute MCP channel).

# Ensure npx is available — when run under a scheduled task the PATH may
# not include the user's Node.js tool directories. We check well-known
# locations (Volta, nvm-for-windows, default) and prepend them.
$npxCmd = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npxCmd) {
    $knownNodeDirs = @(
        "$env:LOCALAPPDATA\Volta\bin",
        "$env:ProgramFiles\Volta",
        "$env:LOCALAPPDATA\nvm",
        "$env:ProgramFiles\nodejs"
    )
    foreach ($d in $knownNodeDirs) {
        if ((Test-Path "$d\npx.exe") -or (Test-Path "$d\npx.cmd")) {
            $env:PATH = "$d;$env:PATH"
            [Console]::Error.WriteLine("[chrome-devtools-mcp-launcher] Added $d to PATH for npx")
            break
        }
    }
    # Retry
    $npxCmd = Get-Command npx -ErrorAction SilentlyContinue
}

if (-not $npxCmd) {
    [Console]::Error.WriteLine("[chrome-devtools-mcp-launcher] ERROR: npx not found. Install Node.js or Volta.")
    exit 1
}

$browserUrl = "http://127.0.0.1:$DebugPort"
[Console]::Error.WriteLine("[chrome-devtools-mcp-launcher] Starting: npx chrome-devtools-mcp --browserUrl $browserUrl")
& npx -y "chrome-devtools-mcp@latest" --browserUrl $browserUrl
