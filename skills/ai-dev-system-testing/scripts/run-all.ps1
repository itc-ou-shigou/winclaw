#!/usr/bin/env pwsh
# ================================================================
# ai-dev-system-testing - Main Entry Script
# ================================================================
# This script enforces strict execution of the system testing workflow.
# AI agents should ONLY run this script - do not improvise!
# ================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$Workspace,
    
    [string]$BackendUrl = "",
    [string]$FrontendUrl = "",
    [string]$DatabaseUrl = "",
    
    # Skip phases that already have output files
    [switch]$Resume,
    
    # Run only specific phases (comma-separated: init,phase2,phase3,phase5a,phase5b,phase5c,phase6)
    [string]$Phases = "",
    
    # Non-interactive mode (use provided URLs without prompting)
    [switch]$NonInteractive,
    
    # Custom timeout seconds (optional)
    [int]$TimeoutSeconds = 0
)

$ErrorActionPreference = "Stop"

# Fix encoding: ensure UTF-8 output on Japanese Windows (CP932 → UTF-8)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
# Also set code page to UTF-8 for child processes (cmd.exe, bash, etc.)
chcp 65001 | Out-Null

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SKILL_DIR = Split-Path -Parent $SCRIPT_DIR

# ================================================================
# Configuration (loaded from config file, no hardcoded values)
# ================================================================
$CONFIG_FILE = Join-Path $SKILL_DIR "references\config\phase5-loop-control.json"
$WORKFLOW_TEMPLATE = Join-Path $SKILL_DIR "references\config\workflow-state-template.json"

# Load configuration
function Get-Config {
    if (Test-Path $CONFIG_FILE) {
        return Get-Content $CONFIG_FILE | ConvertFrom-Json
    }
    # Return defaults if config file not found
    return @{
        global = @{
            target_pass_rate_5b = 95
            target_pass_rate_5c = 100
        }
        iteration_control = @{
            max_iterations = 15
            iteration_timeout_seconds = 1800
        }
    }
}

$Config = Get-Config

# ================================================================
# Real-time Log Viewer
# ================================================================
$LOG_DIR = Join-Path $Workspace "test-logs"
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
}
$REALTIME_LOG = Join-Path $LOG_DIR "realtime.log"

# Clear previous log
"" | Set-Content $REALTIME_LOG -Encoding UTF8

# Launch viewer window (write to temp script file for reliability)
$startTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$viewerProcess = $null
try {
    $viewerScript = Join-Path $LOG_DIR "_log_viewer.ps1"
    @"
`$Host.UI.RawUI.WindowTitle = 'AI Dev System Testing - Log Viewer'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
Write-Host '=== AI Dev System Testing - Real-time Log ===' -ForegroundColor Cyan
Write-Host 'Workspace: $Workspace' -ForegroundColor Gray
Write-Host 'Started: $startTime' -ForegroundColor Gray
Write-Host ''
Get-Content -Path '$REALTIME_LOG' -Wait -Tail 0 -Encoding UTF8
"@ | Set-Content $viewerScript -Encoding UTF8

    $viewerProcess = Start-Process powershell -ArgumentList @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $viewerScript
    ) -PassThru -ErrorAction SilentlyContinue
} catch {
    # Non-GUI environment — log viewer window not available
}

# Write-Log: outputs to both console (for agent capture) and log file (for viewer window)
# Uses FileShare.ReadWrite to avoid locking conflicts with Get-Content -Wait viewer
function Write-Log {
    param(
        [string]$Message,
        [string]$ForegroundColor = "White"
    )
    Write-Host $Message -ForegroundColor $ForegroundColor
    $timestamp = Get-Date -Format "HH:mm:ss"
    $line = "[$timestamp] $Message`r`n"
    try {
        $fs = [System.IO.FileStream]::new($REALTIME_LOG, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
        $sw = [System.IO.StreamWriter]::new($fs, [System.Text.Encoding]::UTF8)
        $sw.Write($line)
        $sw.Flush()
        $sw.Close()
        $fs.Close()
    } catch {
        # Silently ignore log write failures to not break workflow
    }
}

# Helper to get timeout (parameter > config > default)
function Get-Timeout {
    param([string]$Phase)
    if ($TimeoutSeconds -gt 0) {
        return $TimeoutSeconds
    }
    $configTimeout = $Config.iteration_control.iteration_timeout_seconds
    if ($configTimeout) {
        return $configTimeout
    }
    return 3600  # Final fallback (60 min for browser automation)
}

# ================================================================
# Helper Functions
# ================================================================

function Write-Header {
    param([string]$Title)
    Write-Log ""
    Write-Log "============================================================" -ForegroundColor Cyan
    Write-Log "  $Title" -ForegroundColor Cyan
    Write-Log "============================================================" -ForegroundColor Cyan
    Write-Log ""
}

function Write-PhaseCheck {
    param([string]$Phase, [string]$Status, [string]$Output = "")
    $statusColor = if ($Status -eq "COMPLETE") { "Green" } elseif ($Status -eq "SKIP") { "Yellow" } else { "Red" }
    Write-Log "[PHASE_CHECK] Phase $Phase : $Status" -ForegroundColor $statusColor
    if ($Output) {
        Write-Log "  - Output: $Output" -ForegroundColor Gray
    }
}

function Get-PassRateFromFile {
    param([string]$FilePath)
    if (-not (Test-Path $FilePath)) { return $null }

    $rawJson = Get-Content $FilePath -Raw -Encoding UTF8
    $passRate = $null

    # Try proper JSON parsing first
    try {
        $results = $rawJson | ConvertFrom-Json

        # Support all known key variants (snake_case, camelCase, Phase 5B/5C variants)
        $passRate = $results.pass_rate
        if (-not $passRate) { $passRate = $results.passRate }
        if (-not $passRate) { $passRate = $results.adjusted_pass_rate }
        if (-not $passRate) { $passRate = $results.adjustedPassRate }
        if (-not $passRate) { $passRate = $results.actual_pass_rate }
        if (-not $passRate) { $passRate = $results.actualPassRate }
        # Check summary sub-object
        if (-not $passRate -and $results.summary) {
            $passRate = $results.summary.pass_rate
            if (-not $passRate) { $passRate = $results.summary.passRate }
            if (-not $passRate) { $passRate = $results.summary.actual_pass_rate }
            if (-not $passRate) { $passRate = $results.summary.actualPassRate }
        }
        # Handle percentage strings like "75.00%"
        if ($passRate -is [string]) { $passRate = [double]($passRate -replace '%', '') }
        # Fallback: calculate from passed/total
        if (-not $passRate) {
            $total = $results.totalTests
            if (-not $total) { $total = $results.total_tests }
            if (-not $total) { $total = $results.total }
            if (-not $total) { $total = $results.total_pages_tested }
            if (-not $total) { $total = $results.totalPagesTested }
            if (-not $total) { $total = $results.total_endpoints }
            if (-not $total) { $total = $results.totalEndpoints }
            $passed = $results.passed
            if (-not $passed) { $passed = $results.tests_passed }
            if (-not $passed) { $passed = $results.total_pages_passed }
            if (-not $passed) { $passed = $results.totalPagesPassed }
            if (-not $passed) { $passed = $results.endpoints_passed }
            if (-not $passed) { $passed = $results.endpointsPassed }
            if ($total -and $total -gt 0) {
                $passRate = [math]::Round(($passed / $total) * 100, 1)
            }
        }
    } catch {
        Write-Log "[WARN] JSON parse error in $FilePath - using regex fallback" -ForegroundColor Yellow

        # Regex fallback: extract pass_rate from raw text even if JSON is malformed
        if ($rawJson -match '"(?:pass_rate|passRate|adjusted_pass_rate|adjustedPassRate|actual_pass_rate|actualPassRate)"\s*:\s*"?(\d+\.?\d*)%?"?') {
            $passRate = [double]$Matches[1]
        }
        # Try summary sub-object pattern
        if (-not $passRate -and $rawJson -match '"summary"\s*:\s*\{[^}]*"(?:pass_rate|passRate|actual_pass_rate|actualPassRate)"\s*:\s*"?(\d+\.?\d*)%?"?') {
            $passRate = [double]$Matches[1]
        }
    }

    return $passRate
}

function Test-PhaseOutput {
    param(
        [string]$Phase,
        [string[]]$RequiredFiles,
        [switch]$ResumeMode
    )
    
    $allExist = $true
    foreach ($file in $RequiredFiles) {
        $fullPath = Join-Path $Workspace $file
        if (-not (Test-Path $fullPath)) {
            $allExist = $false
            break
        }
    }
    
    if ($allExist -and $ResumeMode) {
        Write-PhaseCheck $Phase "SKIP" "Files already exist"
        return $true
    }
    
    return $false
}

function Invoke-ClaudeCommand {
    param(
        [string]$Prompt,
        [int]$TimeoutSeconds = 0
    )

    if ($TimeoutSeconds -eq 0) {
        $TimeoutSeconds = Get-Timeout
    }

    $logDir = Join-Path $Workspace "test-logs"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }

    $outputLog = Join-Path $logDir "claude_output.log"
    $errorLog = Join-Path $logDir "claude_error.log"

    # Find claude CLI
    $claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
    if (-not $claudeCmd) {
        Write-Log "[ERROR] claude CLI not found in PATH" -ForegroundColor Red
        return $false
    }

    $claudePath = $claudeCmd.Source
    Write-Log "[INFO] Using claude at: $claudePath" -ForegroundColor Gray
    Write-Log "[INFO] Timeout: ${TimeoutSeconds}s" -ForegroundColor Gray

    # Build process: use cmd.exe /c for .cmd wrappers (Volta), direct for others
    # IMPORTANT: Do NOT use -p flag — it disables tools (Write/Edit/Bash).
    # Instead, pipe prompt via stdin so claude runs in session mode with tools enabled.
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    # claude CLI auto-reads .mcp.json from WorkingDirectory — no --mcp-config needed
    if ($claudePath -like "*.cmd") {
        $psi.FileName = "cmd.exe"
        $psi.Arguments = "/c `"$claudePath`" --dangerously-skip-permissions --verbose"
    } else {
        $psi.FileName = $claudePath
        $psi.Arguments = "--dangerously-skip-permissions --verbose"
    }
    $psi.WorkingDirectory = $Workspace
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    # Initialize log files
    "" | Set-Content $outputLog -Encoding UTF8
    "" | Set-Content $errorLog -Encoding UTF8

    # Thread-safe builders for output collection
    $outputBuilder = [System.Text.StringBuilder]::new()
    $errorBuilder = [System.Text.StringBuilder]::new()

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    $process.EnableRaisingEvents = $true

    # Async output handlers for realtime log streaming
    # Use FileStream with FileShare.ReadWrite to avoid lock conflicts with log viewer
    $outHandler = {
        if ($EventArgs.Data) {
            $Event.MessageData.Builder.AppendLine($EventArgs.Data) | Out-Null
            try {
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($EventArgs.Data + "`r`n")
                $fs = [System.IO.FileStream]::new($Event.MessageData.LogFile, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
                $fs.Write($bytes, 0, $bytes.Length); $fs.Close()
                $ts = Get-Date -Format "HH:mm:ss"
                $rtBytes = [System.Text.Encoding]::UTF8.GetBytes("[$ts] $($EventArgs.Data)`r`n")
                $fs2 = [System.IO.FileStream]::new($Event.MessageData.RealtimeLog, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
                $fs2.Write($rtBytes, 0, $rtBytes.Length); $fs2.Close()
            } catch {}
        }
    }
    $errHandler = {
        if ($EventArgs.Data) {
            $Event.MessageData.Builder.AppendLine($EventArgs.Data) | Out-Null
            try {
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($EventArgs.Data + "`r`n")
                $fs = [System.IO.FileStream]::new($Event.MessageData.LogFile, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
                $fs.Write($bytes, 0, $bytes.Length); $fs.Close()
            } catch {}
        }
    }

    $outEvent = Register-ObjectEvent $process OutputDataReceived -Action $outHandler -MessageData @{
        Builder = $outputBuilder; LogFile = $outputLog; RealtimeLog = $REALTIME_LOG
    }
    $errEvent = Register-ObjectEvent $process ErrorDataReceived -Action $errHandler -MessageData @{
        Builder = $errorBuilder; LogFile = $errorLog
    }

    try {
        Write-Log "[INFO] Starting claude CLI session..." -ForegroundColor Gray
        $process.Start() | Out-Null
        $process.BeginOutputReadLine()
        $process.BeginErrorReadLine()

        # Pipe prompt via stdin (UTF-8) and close to signal EOF
        # Force English output to avoid encoding issues on Windows console
        $fullPrompt = "IMPORTANT: Always respond in English only. Do NOT use Japanese or any other non-ASCII language in your responses or file content.`n`n" + $Prompt
        $stdinWriter = New-Object System.IO.StreamWriter($process.StandardInput.BaseStream, [System.Text.Encoding]::UTF8)
        $stdinWriter.Write($fullPrompt)
        $stdinWriter.Flush()
        $stdinWriter.Close()

        # Wait with timeout
        $completed = $process.WaitForExit($TimeoutSeconds * 1000)

        if (-not $completed) {
            Write-Log "[ERROR] Command timed out after $TimeoutSeconds seconds" -ForegroundColor Red
            try { $process.Kill() } catch {}
            try { Start-Process cmd -ArgumentList "/c taskkill /PID $($process.Id) /T /F" -NoNewWindow -Wait -ErrorAction SilentlyContinue } catch {}
            return $false
        }

        # Wait for async handlers to flush
        Start-Sleep -Milliseconds 500

        $exitCode = $process.ExitCode
        Write-Log "[INFO] claude CLI exited with code: $exitCode" -ForegroundColor Gray

        # Log captured output to console
        $output = $outputBuilder.ToString()
        if ($output) {
            $output -split "`n" | ForEach-Object { if ($_.Trim()) { Write-Log $_ } }
        }

        $capturedError = $errorBuilder.ToString()
        if ($capturedError.Trim()) {
            Write-Log "[STDERR] $capturedError" -ForegroundColor Yellow
        }

        return $exitCode -eq 0
    }
    catch {
        Write-Log "[ERROR] Failed to execute claude CLI: $_" -ForegroundColor Red
        return $false
    }
    finally {
        Unregister-Event $outEvent.Name -ErrorAction SilentlyContinue
        Unregister-Event $errEvent.Name -ErrorAction SilentlyContinue
        if (-not $process.HasExited) {
            try { & taskkill /PID $process.Id /T /F 2>&1 | Out-Null } catch {
                try { $process.Kill() } catch {}
            }
        }
        $process.Dispose()
    }
}

function Ask-User {
    param([string]$Question)

    if ($NonInteractive) {
        return ""
    }

    Write-Log $Question -ForegroundColor Yellow
    $response = Read-Host "> "
    return $response
}

function Test-ChromeMcpConnection {
    Write-Log "[CHECK] Verifying Claude In Chrome MCP connection..." -ForegroundColor Yellow

    # MCP check uses stdin pipe (not -p flag) so tools are enabled and MCP calls work
    $testPrompt = 'Call mcp__Claude_in_Chrome__tabs_context_mcp with createIfEmpty=true. If it succeeds output EXACTLY: CHROME_MCP_OK  If it fails output EXACTLY: CHROME_MCP_FAIL'

    try {
        $claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
        if (-not $claudeCmd) { return $false }

        $claudePath = $claudeCmd.Source

        $psi = New-Object System.Diagnostics.ProcessStartInfo
        # claude CLI auto-reads .mcp.json from WorkingDirectory — no --mcp-config needed
        if ($claudePath -like "*.cmd") {
            $psi.FileName = "cmd.exe"
            $psi.Arguments = "/c `"$claudePath`" --dangerously-skip-permissions --verbose"
        } else {
            $psi.FileName = $claudePath
            $psi.Arguments = "--dangerously-skip-permissions --verbose"
        }
        $psi.WorkingDirectory = $Workspace
        $psi.UseShellExecute = $false
        $psi.RedirectStandardInput = $true
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.CreateNoWindow = $true
        $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
        $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo = $psi
        $proc.Start() | Out-Null

        # Pipe prompt and close stdin (UTF-8)
        $stdinWriter = New-Object System.IO.StreamWriter($proc.StandardInput.BaseStream, [System.Text.Encoding]::UTF8)
        $stdinWriter.Write($testPrompt)
        $stdinWriter.Flush()
        $stdinWriter.Close()

        # Read stdout asynchronously to avoid deadlock (ReadToEnd blocks until process exits)
        $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
        $completed = $proc.WaitForExit(90000)  # 90 second timeout

        if (-not $completed) {
            try { $proc.Kill() } catch {}
            try { Start-Process cmd -ArgumentList "/c taskkill /PID $($proc.Id) /T /F" -NoNewWindow -Wait -ErrorAction SilentlyContinue } catch {}
            Write-Log "[WARN] Chrome MCP check timed out after 90s" -ForegroundColor Yellow
            return $false
        }

        $output = $stdoutTask.Result
        $proc.Dispose()
        return ($output -match "CHROME_MCP_OK")
    } catch {
        Write-Log "[WARN] Chrome MCP check failed: $_" -ForegroundColor Yellow
        return $false
    }
}

function Find-Bash {
    # Auto-detect bash — prefer Git Bash over WSL bash
    $bashPath = $null

    # Check PATH first, but skip WSL bash (C:\Windows\system32\bash.exe)
    # WSL bash cannot run Windows-path scripts and lacks claude CLI
    $bashInPath = Get-Command "bash" -ErrorAction SilentlyContinue
    if ($bashInPath -and $bashInPath.Source -notmatch 'system32') {
        return $bashInPath.Source
    }
    
    # Check common locations using environment variables
    $candidates = @()
    
    # Git Bash locations
    if ($env:ProgramFiles) {
        $candidates += Join-Path $env:ProgramFiles "Git\bin\bash.exe"
    }
    if ($env:ProgramFiles -and (Test-Path (Join-Path $env:ProgramFiles "Git\usr\bin\bash.exe"))) {
        $candidates += Join-Path $env:ProgramFiles "Git\usr\bin\bash.exe"
    }
    if (${env:ProgramFiles(x86)}) {
        $candidates += Join-Path ${env:ProgramFiles(x86)} "Git\bin\bash.exe"
    }
    if ($env:LOCALAPPDATA) {
        $candidates += Join-Path $env:LOCALAPPDATA "Programs\Git\bin\bash.exe"
    }
    if ($env:USERPROFILE) {
        $candidates += Join-Path $env:USERPROFILE "scoop\apps\git\current\bin\bash.exe"
        $candidates += Join-Path $env:USERPROFILE "AppData\Local\Programs\Git\bin\bash.exe"
    }
    
    # WSL
    $candidates += "wsl"
    
    foreach ($candidate in $candidates) {
        if ($candidate -ne "wsl" -and (Test-Path $candidate)) {
            return $candidate
        }
    }
    
    # Last resort: wsl
    $wslCmd = Get-Command "wsl" -ErrorAction SilentlyContinue
    if ($wslCmd) {
        return "wsl"
    }
    
    return $null
}

function Find-ChromeDebugPort {
    foreach ($port in 9222..9229) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", $port)
            $tcp.Close()
            return $port
        } catch { }
    }
    return $null
}

function Start-ChromeWithDebugPort {
    param([int]$Port = 9222)
    Write-Log "[INFO] Attempting to start Chrome with debug port $Port..." -ForegroundColor Yellow

    # Kill all existing Chrome processes
    $chromeProcs = Get-Process chrome -ErrorAction SilentlyContinue
    if ($chromeProcs) {
        Write-Log "[INFO] Killing $($chromeProcs.Count) existing Chrome processes..." -ForegroundColor Yellow
        $chromeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
        # Double-check
        Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }

    # Find Chrome executable
    $chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    if (-not (Test-Path $chromePath)) {
        $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    }
    if (-not (Test-Path $chromePath)) {
        Write-Log "[ERROR] Chrome executable not found" -ForegroundColor Red
        return $false
    }

    # Start Chrome with debug port (default profile for extensions)
    Start-Process $chromePath -ArgumentList "--remote-debugging-port=$Port", "--remote-allow-origins=*"
    Write-Log "[INFO] Chrome started, waiting 5 seconds for initialization..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5

    # Verify port is open
    $found = Find-ChromeDebugPort
    if ($found) {
        Write-Log "[OK] Chrome debug port $found is now open" -ForegroundColor Green
        return $true
    }

    # If default profile fails, try separate DebugProfile
    Write-Log "[WARN] Debug port not open with default profile, trying DebugProfile..." -ForegroundColor Yellow
    Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3

    $debugProfileDir = Join-Path $env:LOCALAPPDATA "Google\Chrome\DebugProfile"
    Start-Process $chromePath -ArgumentList "--remote-debugging-port=$Port", "--remote-allow-origins=*", "--user-data-dir=$debugProfileDir"
    Start-Sleep -Seconds 5

    $found = Find-ChromeDebugPort
    if ($found) {
        Write-Log "[OK] Chrome debug port $found is open (DebugProfile)" -ForegroundColor Green
        return $true
    }

    Write-Log "[ERROR] Failed to start Chrome with debug port" -ForegroundColor Red
    return $false
}

function New-McpConfigFile {
    param([int]$ChromePort)
    $mcpConfigPath = Join-Path $Workspace ".mcp.json"
    $config = @{
        mcpServers = @{
            Claude_in_Chrome = @{
                command = "chrome-devtools-mcp"
                args = @("--browserUrl", "http://127.0.0.1:$ChromePort")
            }
        }
    }
    $config | ConvertTo-Json -Depth 5 | Set-Content $mcpConfigPath -Encoding UTF8
    Write-Log "[OK] Created .mcp.json with Claude_in_Chrome MCP (port $ChromePort)" -ForegroundColor Green
    return $mcpConfigPath
}

# ================================================================
# Phase Init
# ================================================================
function Invoke-PhaseInit {
    Write-Header "Phase Init: Environment Check"
    
    # Check workspace exists
    if (-not (Test-Path $Workspace)) {
        Write-Log "[ERROR] Workspace does not exist: $Workspace" -ForegroundColor Red
        exit 1
    }

    # Check claude CLI (no hardcoded path)
    $claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
    if (-not $claudeCmd) {
        Write-Log "[ERROR] claude CLI not found in PATH. Please install Claude Code first." -ForegroundColor Red
        exit 1
    }

    Write-Log "[OK] claude CLI found at: $($claudeCmd.Source)" -ForegroundColor Green

    # Interactive configuration if not provided
    if (-not $NonInteractive -and -not $FrontendUrl -and -not $BackendUrl) {
        Write-Log ""
        Write-Log "Please configure the test environment:" -ForegroundColor Yellow
        Write-Log ""
        
        $script:FrontendUrl = Ask-User "Frontend URL (e.g., http://localhost:3000)"
        $script:BackendUrl = Ask-User "Backend URL (e.g., http://localhost:8000) [leave empty if not separate]"
        $script:DatabaseUrl = Ask-User "Database connection string (e.g., mysql+pymysql://user:pass@host/db) [optional]"
    } else {
        $script:FrontendUrl = $FrontendUrl
        $script:BackendUrl = $BackendUrl
        $script:DatabaseUrl = $DatabaseUrl
    }
    
    # Save configuration
    $config = @{
        workspace = $Workspace
        frontend_url = $script:FrontendUrl
        backend_url = $script:BackendUrl
        database_url = $script:DatabaseUrl
        timestamp = (Get-Date -Format "o")
        skill_dir = $SKILL_DIR
        chrome_mcp_verified = $false
    }
    
    $configDir = Join-Path $Workspace "deployment-logs"
    if (-not (Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    
    $configPath = Join-Path $configDir "workflow-state.json"
    $config | ConvertTo-Json -Depth 3 | Out-File $configPath -Encoding UTF8
    
    # Determine flow
    $script:RunPhase5B = $script:BackendUrl -ne ""
    $script:RunPhase5C = $script:FrontendUrl -ne ""
    
    Write-Log ""
    Write-Log "Configuration saved:" -ForegroundColor Green
    Write-Log "  - Frontend: $($script:FrontendUrl)"
    Write-Log "  - Backend: $($script:BackendUrl)"
    Write-Log "  - Database: $(if ($script:DatabaseUrl) { 'configured' } else { 'not configured' })"
    Write-Log ""
    Write-Log "Flow:" -ForegroundColor Yellow
    Write-Log "  - Phase 5B (API): $(if ($script:RunPhase5B) { 'WILL RUN' } else { 'SKIP (no backend URL)' })"
    Write-Log "  - Phase 5C (UI): $(if ($script:RunPhase5C) { 'WILL RUN' } else { 'SKIP (no frontend URL)' })"

    # Check Chrome debug port and create .mcp.json for child processes (required for Phase 5B/5C)
    if ($script:RunPhase5B -or $script:RunPhase5C) {
        Write-Log ""
        # Detect Chrome debug port
        $chromePort = Find-ChromeDebugPort
        if (-not $chromePort) {
            Write-Log "[WARN] No Chrome debug port found — attempting auto-start..." -ForegroundColor Yellow
            if (Start-ChromeWithDebugPort -Port 9222) {
                $chromePort = Find-ChromeDebugPort
            }
        }

        if ($chromePort) {
            Write-Log "[OK] Chrome debug port found: $chromePort" -ForegroundColor Green
            # Generate .mcp.json so child claude CLI processes can connect
            $script:McpConfigPath = New-McpConfigFile -ChromePort $chromePort
            # Quick HTTP check against Chrome DevTools Protocol (fast, no claude CLI spawn needed)
            try {
                $cdpResponse = Invoke-RestMethod -Uri "http://127.0.0.1:$chromePort/json/version" -TimeoutSec 5 -ErrorAction Stop
                Write-Log "[OK] Chrome DevTools Protocol verified: $($cdpResponse.Browser)" -ForegroundColor Green
                $config.chrome_mcp_verified = $true
                $config | ConvertTo-Json -Depth 3 | Out-File $configPath -Encoding UTF8
            } catch {
                Write-Log "[WARN] Chrome DevTools Protocol check failed — .mcp.json created, Phase 5B/5C will retry at runtime" -ForegroundColor Yellow
            }
        } else {
            Write-Log "[ERROR] No Chrome debug port found (9222-9229)" -ForegroundColor Red
            Write-Log "  Please start Chrome with --remote-debugging-port=9222" -ForegroundColor Yellow
            # Don't exit — Phase 2/3/6 can still run, Phase 5B/5C get disabled
            $script:RunPhase5B = $false
            $script:RunPhase5C = $false
            Write-Log "[WARN] Phase 5B/5C disabled (no Chrome debug port)" -ForegroundColor Yellow
        }
    }

    Write-PhaseCheck "Init" "COMPLETE" "deployment-logs/workflow-state.json"
    return $true
}

# ================================================================
# Phase 2: Code Analysis
# ================================================================
function Invoke-Phase2 {
    Write-Header "Phase 2: Code Structure Analysis"
    
    # Resume check
    if (Test-PhaseOutput "2" @("CODE_ANALYSIS.md", "deployment-logs/project-structure.json") -ResumeMode:$Resume) {
        return $true
    }
    
    $prompt = @"
Analyze the codebase structure and generate:

1. CODE_ANALYSIS.md - Comprehensive code analysis report including:
   - Technology stack (backend, frontend, database)
   - Directory structure
   - Entry points and configuration
   - Dependencies

2. deployment-logs/project-structure.json - JSON with:
   - backend.directory, backend.port, backend.start_command
   - frontend.directory, frontend.port, frontend.start_command
   - database.type, database.host

Do NOT skip any analysis. Read actual files to determine structure.
"@
    
    $timeout = Get-Timeout
    $result = Invoke-ClaudeCommand $prompt -TimeoutSeconds $timeout
    
    # Verify outputs
    $codeAnalysis = Test-Path (Join-Path $Workspace "CODE_ANALYSIS.md")
    $projectStruct = Test-Path (Join-Path $Workspace "deployment-logs\project-structure.json")
    
    if ($codeAnalysis -and $projectStruct) {
        Write-PhaseCheck "2" "COMPLETE" "CODE_ANALYSIS.md, deployment-logs/project-structure.json"
        return $true
    } else {
        Write-PhaseCheck "2" "FAILED" "Missing output files"
        return $false
    }
}

# ================================================================
# Phase 3: Code Review
# ================================================================
function Invoke-Phase3 {
    Write-Header "Phase 3: Code Review & Auto-Fix"

    # Resume check
    if (Test-PhaseOutput "3" @("CODE_REVIEW_REPORT.md") -ResumeMode:$Resume) {
        return $true
    }

    # Phase 3 prompt template (external file, with inline fallback)
    $skillDir = $PSScriptRoot | Split-Path -Parent  # ai-dev-system-testing/
    $promptFile = Join-Path $skillDir "references\prompts\phase3-code-review.md"

    if (Test-Path $promptFile) {
        $prompt = "Please read and execute ALL instructions in the following file: $promptFile"
        Write-Log "[INFO] Phase 3 using prompt template: $promptFile" -ForegroundColor Gray
    } else {
        # Fallback: inline prompt (legacy behavior)
        $prompt = @"
Perform comprehensive code review:

1. Analyze all code files in the project
2. Identify issues:
   - Security vulnerabilities
   - Performance problems
   - Code smells
   - Missing error handling
   - Inconsistent patterns
3. Auto-fix issues where possible
4. Generate CODE_REVIEW_REPORT.md with:
   - Summary of issues found
   - Fixes applied
   - Remaining recommendations

Do NOT skip any files. Use actual code analysis tools.
"@
        Write-Log "[WARN] Phase 3 prompt template not found at $promptFile, using inline fallback" -ForegroundColor Yellow
    }

    $timeout = Get-Timeout
    $result = Invoke-ClaudeCommand $prompt -TimeoutSeconds ($timeout + 600)  # Extra time for review

    # Verify output
    if (Test-Path (Join-Path $Workspace "CODE_REVIEW_REPORT.md")) {
        Write-PhaseCheck "3" "COMPLETE" "CODE_REVIEW_REPORT.md"
        # Check for optional BUSINESS_LOGIC_TESTCASES.md (used by Phase 5A for scenario data)
        if (Test-Path (Join-Path $Workspace "BUSINESS_LOGIC_TESTCASES.md")) {
            Write-Log "[INFO] Phase 3 also generated BUSINESS_LOGIC_TESTCASES.md (will enhance Phase 5A test data)" -ForegroundColor Green
        } else {
            Write-Log "[INFO] BUSINESS_LOGIC_TESTCASES.md not generated (Phase 5A will use basic CRUD only)" -ForegroundColor Gray
        }
        return $true
    } else {
        Write-PhaseCheck "3" "FAILED" "Missing CODE_REVIEW_REPORT.md"
        return $false
    }
}

# ================================================================
# Phase 5A: Test Data Seeding (Code Analysis)
# ================================================================
function Invoke-Phase5A {
    Write-Header "Phase 5A: Test Data Seeding (Code Analysis)"

    # Resume check
    if (Test-PhaseOutput "5A" @("test-logs/test_data_seed.json") -ResumeMode:$Resume) {
        return $true
    }

    # Load backend URL from saved state or parameter
    $configPath = Join-Path $Workspace "deployment-logs\workflow-state.json"
    $backendUrl = $BackendUrl
    if (Test-Path $configPath) {
        $savedConfig = Get-Content $configPath | ConvertFrom-Json
        if ($savedConfig.backend_url) { $backendUrl = $savedConfig.backend_url }
    }

    $promptFile = Join-Path $SKILL_DIR "references\prompts\phase5a-test-data-seeding.md"

    # Load timeout from config (phase5a_seeding section) or use default
    $seedingTimeout = $Config.phase5a_seeding.timeout_seconds
    if (-not $seedingTimeout) { $seedingTimeout = 1800 }

    $prompt = @"
You are executing Phase 5A: Test Data Seeding.
Backend URL: $backendUrl
Workspace: $Workspace

Read and execute ALL steps in: $promptFile

CRITICAL RULES:
1. Analyze model classes in the codebase (Read/Glob/Grep tools ONLY for discovery)
2. Discover entity relationships and FK dependencies dynamically — NO hardcoded schemas
3. Create test data via API calls (curl) or direct DB insertion (python3)
4. Save results to: test-logs/test_data_seed.json
5. Save auth credentials to: test-logs/phase5b_test_user.json
6. Write summary to: test-logs/PHASE5A_SEEDING_REPORT.md
7. Do NOT use browser automation — use Bash tool with curl/python3 only
8. If BUSINESS_LOGIC_TESTCASES.md exists (from Phase 3), create multi-scenario test data with admin user, validation payloads, state machine records, and authorization scenarios
9. If BUSINESS_LOGIC_TESTCASES.md does NOT exist, create only basic CRUD test data (standard behavior)

You MUST generate test-logs/test_data_seed.json before finishing.
"@

    $timeout = if ($TimeoutSeconds -gt 0) { $TimeoutSeconds } else { $seedingTimeout }
    Invoke-ClaudeCommand $prompt -TimeoutSeconds $timeout | Out-Null

    if (Test-Path (Join-Path $Workspace "test-logs\test_data_seed.json")) {
        Write-PhaseCheck "5A" "COMPLETE" "test-logs/test_data_seed.json"
        return $true
    } else {
        Write-PhaseCheck "5A" "FAILED" "Missing test_data_seed.json"
        return $false
    }
}

# ================================================================
# Chrome Pre-Flight Check (for Phase 5B/5C)
# ================================================================
function Ensure-ChromeAvailable {
    Write-Log "[CHECK] Pre-flight: verifying Chrome debug port..." -ForegroundColor Yellow
    $chromePort = Find-ChromeDebugPort
    if ($chromePort) {
        Write-Log "[OK] Chrome debug port $chromePort is available" -ForegroundColor Green
        return $true
    }

    Write-Log "[WARN] Chrome debug port lost — attempting restart..." -ForegroundColor Yellow
    if (Start-ChromeWithDebugPort -Port 9222) {
        $chromePort = Find-ChromeDebugPort
        if ($chromePort) {
            # Regenerate .mcp.json with the new port
            New-McpConfigFile -ChromePort $chromePort | Out-Null
            Write-Log "[OK] Chrome restarted on port $chromePort" -ForegroundColor Green
            return $true
        }
    }

    Write-Log "[ERROR] Failed to restore Chrome debug port" -ForegroundColor Red
    return $false
}

# ================================================================
# Phase 5B: API Testing
# ================================================================
function Invoke-Phase5B {
    Write-Header "Phase 5B: API Endpoint Testing"

    # Load configuration from saved state (works even if Init was skipped)
    $configPath = Join-Path $Workspace "deployment-logs\workflow-state.json"
    if (Test-Path $configPath) {
        $savedConfig = Get-Content $configPath | ConvertFrom-Json
        $backendUrl = $savedConfig.backend_url
    } else {
        # Fallback to parameter if no saved config
        $backendUrl = $BackendUrl
    }

    # Check if we should run
    if (-not $backendUrl) {
        Write-PhaseCheck "5B" "SKIP" "No backend URL configured"
        return $true
    }

    # Pre-flight: ensure Chrome debug port is still available
    if (-not (Ensure-ChromeAvailable)) {
        Write-PhaseCheck "5B" "FAILED" "Chrome debug port unavailable"
        return $false
    }

    # Get target pass rate from config
    $targetPassRate = $Config.global.target_pass_rate_5b
    if (-not $targetPassRate) { $targetPassRate = 95 }

    # Resume check
    $resultFile = Join-Path $Workspace "test-logs\phase5b_efficient_test_results.json"
    if ($Resume -and (Test-Path $resultFile)) {
        $passRate = Get-PassRateFromFile $resultFile
        if ($passRate -and $passRate -ge $targetPassRate) {
            Write-PhaseCheck "5B" "SKIP" "Already passed (pass_rate: $passRate%)"
            return $true
        }
    }

    # Run the official script (path relative to SKILL_DIR)
    $script5b = Join-Path $SKILL_DIR "references\scripts\phase5b-efficient-loop.sh"

    if (Test-Path $script5b) {
        # Set environment variables
        $env:WORKSPACE_DIR = $Workspace
        $env:AIDEV_BACKEND_URL = $backendUrl
        $env:REALTIME_LOG = $REALTIME_LOG

        # Find bash executable
        $bashPath = Find-Bash

        if (-not $bashPath) {
            Write-Log "[ERROR] bash not found. Please install Git Bash or WSL." -ForegroundColor Red
            return $false
        }

        Write-Log "Running: $bashPath $script5b" -ForegroundColor Yellow
        Write-Log "WORKSPACE_DIR: $Workspace" -ForegroundColor Gray
        Write-Log "AIDEV_BACKEND_URL: $backendUrl" -ForegroundColor Gray
        
        if ($bashPath -eq "wsl") {
            # Convert Windows path to WSL path
            $wslPath = ($script5b -replace '\\', '/' -replace '^([A-Za-z]):', { "/mnt/$($_.Groups[1].Value.ToLower())" })
            & wsl bash $wslPath
        } else {
            & $bashPath $script5b
        }
        $exitCode = $LASTEXITCODE
    } else {
        Write-Log "[WARN] Script not found: $script5b" -ForegroundColor Yellow
        Write-Log "Falling back to claude CLI..." -ForegroundColor Yellow

        $promptFile = Join-Path $SKILL_DIR "references\prompts\phase5b-api-tests-efficient.md"
        $prompt = @"
Run Phase 5B API Testing using claude CLI with the test specification from:
$promptFile

Backend URL: $backendUrl

Requirements:
1. Test ALL API endpoints
2. Generate test-logs/phase5b_efficient_test_results.json
3. Target: $targetPassRate% pass rate
4. Report any bugs found

Use Claude In Chrome MCP for browser automation if needed.
"@
        
        $timeout = Get-Timeout
        Invoke-ClaudeCommand $prompt -TimeoutSeconds ($timeout * 4) | Out-Null
        $exitCode = if (Test-Path $resultFile) { 0 } else { 1 }
    }
    
    # Verify results
    if (Test-Path $resultFile) {
        $passRate = Get-PassRateFromFile $resultFile
        Write-PhaseCheck "5B" "COMPLETE" "pass_rate: $passRate%"
        return $true
    } else {
        Write-PhaseCheck "5B" "FAILED" "No results file generated"
        return $false
    }
}

# ================================================================
# Phase 5C: UI Testing
# ================================================================
function Invoke-Phase5C {
    Write-Header "Phase 5C: UI Testing (Browser Automation)"

    # Load configuration from saved state (works even if Init was skipped)
    $configPath = Join-Path $Workspace "deployment-logs\workflow-state.json"
    if (Test-Path $configPath) {
        $savedConfig = Get-Content $configPath | ConvertFrom-Json
        $frontendUrl = $savedConfig.frontend_url
    } else {
        # Fallback to parameter if no saved config
        $frontendUrl = $FrontendUrl
    }

    # Check if we should run
    if (-not $frontendUrl) {
        Write-PhaseCheck "5C" "SKIP" "No frontend URL configured"
        return $true
    }

    # Pre-flight: ensure Chrome debug port is still available
    if (-not (Ensure-ChromeAvailable)) {
        Write-PhaseCheck "5C" "FAILED" "Chrome debug port unavailable"
        return $false
    }

    # Get target pass rate from config (100% for UI)
    $targetPassRate = $Config.global.target_pass_rate_5c
    if (-not $targetPassRate) { $targetPassRate = 100 }
    
    # Resume check
    $resultFile = Join-Path $Workspace "test-logs\phase5c_test_results.json"
    if ($Resume -and (Test-Path $resultFile)) {
        $passRate = Get-PassRateFromFile $resultFile
        if ($passRate -and $passRate -ge $targetPassRate) {
            Write-PhaseCheck "5C" "SKIP" "Already passed (pass_rate: $passRate%)"
            return $true
        }
    }

    # Run the official script (path relative to SKILL_DIR)
    $script5c = Join-Path $SKILL_DIR "references\scripts\phase5c-efficient-loop.sh"
    
    if (Test-Path $script5c) {
        # Set environment variables
        $env:WORKSPACE_DIR = $Workspace
        $env:AIDEV_FRONTEND_URL = $frontendUrl
        $env:REALTIME_LOG = $REALTIME_LOG

        # Find bash executable
        $bashPath = Find-Bash

        if (-not $bashPath) {
            Write-Log "[ERROR] bash not found. Please install Git Bash or WSL." -ForegroundColor Red
            return $false
        }

        Write-Log "Running: $bashPath $script5c" -ForegroundColor Yellow
        Write-Log "WORKSPACE_DIR: $Workspace" -ForegroundColor Gray
        Write-Log "AIDEV_FRONTEND_URL: $frontendUrl" -ForegroundColor Gray
        
        if ($bashPath -eq "wsl") {
            # Convert Windows path to WSL path
            $wslPath = ($script5c -replace '\\', '/' -replace '^([A-Za-z]):', { "/mnt/$($_.Groups[1].Value.ToLower())" })
            & wsl bash $wslPath
        } else {
            & $bashPath $script5c
        }
        $exitCode = $LASTEXITCODE
    } else {
        Write-Log "[WARN] Script not found: $script5c" -ForegroundColor Yellow
        Write-Log "Falling back to claude CLI..." -ForegroundColor Yellow

        $promptFile = Join-Path $SKILL_DIR "references\prompts\phase5c-ui-tests-efficient.md"
        $prompt = @"
Run Phase 5C UI Testing using claude CLI with the test specification from:
$promptFile

Frontend URL: $frontendUrl

Requirements:
1. Test ALL UI pages
2. Execute 4 CORE TESTS per page
3. Execute 6-GATE validation
4. Generate test-logs/phase5c_test_results.json
5. Target: $targetPassRate% pass rate

Use Claude In Chrome MCP for browser automation.
"@
        
        $timeout = Get-Timeout
        Invoke-ClaudeCommand $prompt -TimeoutSeconds ($timeout * 4) | Out-Null
        $exitCode = if (Test-Path $resultFile) { 0 } else { 1 }
    }
    
    # Verify results
    if (Test-Path $resultFile) {
        $passRate = Get-PassRateFromFile $resultFile
        Write-PhaseCheck "5C" "COMPLETE" "pass_rate: $passRate%"
        return $true
    } else {
        Write-PhaseCheck "5C" "FAILED" "No results file generated"
        return $false
    }
}

# ================================================================
# Phase 6: Documentation
# ================================================================
function Invoke-Phase6 {
    Write-Header "Phase 6: Documentation Generation"
    
    $prompt = @"
Generate comprehensive documentation:

1. docs/API.md - API documentation from OpenAPI spec
2. docs/ARCHITECTURE.md - System architecture overview
3. docs/DEPLOYMENT.md - Deployment guide
4. docs/USER_GUIDE.md - User guide

Use actual code analysis, do not hallucinate.
"@
    
    $timeout = Get-Timeout
    $result = Invoke-ClaudeCommand $prompt -TimeoutSeconds $timeout
    
    Write-PhaseCheck "6" "COMPLETE" "docs/"
    return $true
}

# ================================================================
# Main Entry Point
# ================================================================

Write-Log @"

+==============================================================+
|                                                              |
|     ai-dev-system-testing - Strict Workflow Executor         |
|                                                              |
+==============================================================+

"@ -ForegroundColor Cyan

Write-Log "Workspace: $Workspace" -ForegroundColor White
Write-Log "Skill Dir: $SKILL_DIR" -ForegroundColor White
Write-Log "Resume Mode: $Resume" -ForegroundColor White
Write-Log "Non-Interactive: $NonInteractive" -ForegroundColor White
if ($viewerProcess) {
    Write-Log "Log Viewer: PID $($viewerProcess.Id)" -ForegroundColor White
} else {
    Write-Log "Log Viewer: not launched (non-GUI environment)" -ForegroundColor Gray
}
Write-Log ""

# Create log directory
$logDir = Join-Path $Workspace "test-logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Determine phases to run
if ($Phases) {
    $phaseList = ($Phases -split ",") | ForEach-Object { $_.Trim().ToLower() }

    # Auto-inject Phase Init when Phase 5B/5C is included (required for MCP check)
    $needs5b = $phaseList -contains "phase5b"
    $needs5c = $phaseList -contains "phase5c"
    $hasInit = $phaseList -contains "init"
    $has5a = $phaseList -contains "phase5a"

    if (($needs5b -or $needs5c) -and -not $hasInit) {
        Write-Log "[AUTO] Injecting Phase Init (required for Phase 5B/5C MCP check)" -ForegroundColor Yellow
        $phaseList = @("init") + $phaseList
    }

    # Auto-inject Phase 5A when Phase 5B/5C is included (test data seeding)
    if (($needs5b -or $needs5c) -and -not $has5a) {
        Write-Log "[AUTO] Injecting Phase 5A (test data seeding for Phase 5B/5C)" -ForegroundColor Yellow
        # Insert phase5a before phase5b/phase5c
        $newList = @()
        $inserted = $false
        foreach ($p in $phaseList) {
            if (($p -eq "phase5b" -or $p -eq "phase5c") -and -not $inserted) {
                $newList += "phase5a"
                $inserted = $true
            }
            $newList += $p
        }
        $phaseList = $newList
    }
} else {
    $phaseList = @("init", "phase2", "phase3", "phase5a", "phase5b", "phase5c", "phase6")
}

# Execute phases
$allSuccess = $true

foreach ($phase in $phaseList) {
    $phase = $phase.Trim().ToLower()
    $success = $true
    
    switch ($phase) {
        "init" { $success = Invoke-PhaseInit }
        "phase2" { $success = Invoke-Phase2 }
        "phase3" { $success = Invoke-Phase3 }
        "phase5a" { $success = Invoke-Phase5A }
        "phase5b" { $success = Invoke-Phase5B }
        "phase5c" { $success = Invoke-Phase5C }
        "phase6" { $success = Invoke-Phase6 }
        default { Write-Log "[WARN] Unknown phase: $phase" -ForegroundColor Yellow }
    }

    if (-not $success) {
        $allSuccess = $false
        Write-Log ""
        Write-Log "[ERROR] Phase $phase failed. Stopping workflow." -ForegroundColor Red
        break
    }
}

# Cleanup: remove generated .mcp.json to avoid polluting the project
$mcpCleanupPath = Join-Path $Workspace ".mcp.json"
if (Test-Path $mcpCleanupPath) {
    Remove-Item $mcpCleanupPath -Force -ErrorAction SilentlyContinue
    Write-Log "[CLEANUP] Removed .mcp.json" -ForegroundColor Gray
}

# Final summary
Write-Header "Workflow Summary"

if ($allSuccess) {
    Write-Log "[OK] All phases completed successfully!" -ForegroundColor Green
    Write-Log ""
    Write-Log "============================================================" -ForegroundColor Green
    Write-Log "  ALL PHASES COMPLETE - Log viewer will remain open" -ForegroundColor Green
    Write-Log "============================================================" -ForegroundColor Green
    exit 0
} else {
    Write-Log "[FAIL] Workflow failed. Check logs for details." -ForegroundColor Red
    Write-Log ""
    Write-Log "============================================================" -ForegroundColor Red
    Write-Log "  WORKFLOW FAILED - Check log viewer for details" -ForegroundColor Red
    Write-Log "============================================================" -ForegroundColor Red
    exit 1
}
