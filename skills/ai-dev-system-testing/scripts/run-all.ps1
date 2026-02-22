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
    
    # Run only specific phases (comma-separated: init,phase2,phase3,phase5b,phase5c,phase6)
    [string]$Phases = "",
    
    # Non-interactive mode (use provided URLs without prompting)
    [switch]$NonInteractive,
    
    # Custom timeout seconds (optional)
    [int]$TimeoutSeconds = 0
)

$ErrorActionPreference = "Stop"
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

# Launch viewer window
$startTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$viewerProcess = Start-Process powershell -ArgumentList @(
    "-NoProfile", "-Command",
    "`$Host.UI.RawUI.WindowTitle = 'AI Dev System Testing - Log Viewer'; Write-Host '=== AI Dev System Testing - Real-time Log ===' -ForegroundColor Cyan; Write-Host 'Workspace: $Workspace' -ForegroundColor Gray; Write-Host 'Started: $startTime' -ForegroundColor Gray; Write-Host ''; Get-Content -Path '$REALTIME_LOG' -Wait -Tail 0"
) -PassThru

# Write-Log: outputs to both console (for agent capture) and log file (for viewer window)
function Write-Log {
    param(
        [string]$Message,
        [string]$ForegroundColor = "White"
    )
    Write-Host $Message -ForegroundColor $ForegroundColor
    $timestamp = Get-Date -Format "HH:mm:ss"
    "[$timestamp] $Message" | Add-Content $REALTIME_LOG -Encoding UTF8
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
    return 1800  # Final fallback
}

# ================================================================
# Helper Functions
# ================================================================

function Write-Header {
    param([string]$Title)
    Write-Log ""
    Write-Log "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Log "  $Title" -ForegroundColor Cyan
    Write-Log "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
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
    $outHandler = {
        if ($EventArgs.Data) {
            $Event.MessageData.Builder.AppendLine($EventArgs.Data) | Out-Null
            $EventArgs.Data | Add-Content $Event.MessageData.LogFile -Encoding UTF8
            $ts = Get-Date -Format "HH:mm:ss"
            "[$ts] $($EventArgs.Data)" | Add-Content $Event.MessageData.RealtimeLog -Encoding UTF8
        }
    }
    $errHandler = {
        if ($EventArgs.Data) {
            $Event.MessageData.Builder.AppendLine($EventArgs.Data) | Out-Null
            $EventArgs.Data | Add-Content $Event.MessageData.LogFile -Encoding UTF8
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
            try { & taskkill /PID $process.Id /T /F 2>&1 | Out-Null } catch {
                try { $process.Kill() } catch {}
            }
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

        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo = $psi
        $proc.Start() | Out-Null

        # Pipe prompt and close stdin
        $proc.StandardInput.Write($testPrompt)
        $proc.StandardInput.Close()

        $output = $proc.StandardOutput.ReadToEnd()
        $completed = $proc.WaitForExit(60000)  # 60 second timeout

        if (-not $completed) {
            try { & taskkill /PID $proc.Id /T /F 2>&1 | Out-Null } catch {
                try { $proc.Kill() } catch {}
            }
            Write-Log "[WARN] Chrome MCP check timed out after 60s" -ForegroundColor Yellow
            return $false
        }

        $proc.Dispose()
        return ($output -match "CHROME_MCP_OK")
    } catch {
        Write-Log "[WARN] Chrome MCP check failed: $_" -ForegroundColor Yellow
        return $false
    }
}

function Find-Bash {
    # Auto-detect bash (no hardcoded paths)
    $bashPath = $null
    
    # Check PATH first
    $bashInPath = Get-Command "bash" -ErrorAction SilentlyContinue
    if ($bashInPath) {
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

    # Check Claude In Chrome MCP connection (required for Phase 5B/5C)
    if ($script:RunPhase5B -or $script:RunPhase5C) {
        Write-Log ""
        if (Test-ChromeMcpConnection) {
            Write-Log "[OK] Claude In Chrome MCP is connected" -ForegroundColor Green
        } else {
            Write-Log "" -ForegroundColor Red
            Write-Log "================================================================" -ForegroundColor Red
            Write-Log "  [ERROR] Claude In Chrome MCP is NOT available!" -ForegroundColor Red
            Write-Log "================================================================" -ForegroundColor Red
            Write-Log "" -ForegroundColor Red
            Write-Log "  Phase 5B/5C REQUIRE Chrome + Claude In Chrome extension." -ForegroundColor Yellow
            Write-Log "  1. Open Chrome browser" -ForegroundColor Yellow
            Write-Log "  2. Install/enable 'Claude In Chrome' extension" -ForegroundColor Yellow
            Write-Log "  3. Ensure MCP shows 'Connected'" -ForegroundColor Yellow
            Write-Log "  4. Re-run this script" -ForegroundColor Yellow
            Write-Log "" -ForegroundColor Red
            Write-Log "================================================================" -ForegroundColor Red
            exit 1
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
    
    $timeout = Get-Timeout
    $result = Invoke-ClaudeCommand $prompt -TimeoutSeconds ($timeout + 600)  # Extra time for review
    
    # Verify output
    if (Test-Path (Join-Path $Workspace "CODE_REVIEW_REPORT.md")) {
        Write-PhaseCheck "3" "COMPLETE" "CODE_REVIEW_REPORT.md"
        return $true
    } else {
        Write-PhaseCheck "3" "FAILED" "Missing CODE_REVIEW_REPORT.md"
        return $false
    }
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
    
    # Get target pass rate from config
    $targetPassRate = $Config.global.target_pass_rate_5b
    if (-not $targetPassRate) { $targetPassRate = 95 }
    
    # Resume check
    $resultFile = Join-Path $Workspace "test-logs\phase5b_efficient_test_results.json"
    if ($Resume -and (Test-Path $resultFile)) {
        $results = Get-Content $resultFile | ConvertFrom-Json
        $passRate = $results.pass_rate
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
        $results = Get-Content $resultFile | ConvertFrom-Json
        $passRate = $results.pass_rate
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
    
    # Get target pass rate from config (100% for UI)
    $targetPassRate = $Config.global.target_pass_rate_5c
    if (-not $targetPassRate) { $targetPassRate = 100 }
    
    # Resume check
    $resultFile = Join-Path $Workspace "test-logs\phase5c_test_results.json"
    if ($Resume -and (Test-Path $resultFile)) {
        $results = Get-Content $resultFile | ConvertFrom-Json
        $passRate = $results.summary.pass_rate
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
        $results = Get-Content $resultFile | ConvertFrom-Json
        $passRate = $results.summary.pass_rate
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

╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     ai-dev-system-testing - Strict Workflow Executor         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

Write-Log "Workspace: $Workspace" -ForegroundColor White
Write-Log "Skill Dir: $SKILL_DIR" -ForegroundColor White
Write-Log "Resume Mode: $Resume" -ForegroundColor White
Write-Log "Non-Interactive: $NonInteractive" -ForegroundColor White
Write-Log "Log Viewer: PID $($viewerProcess.Id)" -ForegroundColor White
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

    if (($needs5b -or $needs5c) -and -not $hasInit) {
        Write-Log "[AUTO] Injecting Phase Init (required for Phase 5B/5C MCP check)" -ForegroundColor Yellow
        $phaseList = @("init") + $phaseList
    }
} else {
    $phaseList = @("init", "phase2", "phase3", "phase5b", "phase5c", "phase6")
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

# Final summary
Write-Header "Workflow Summary"

if ($allSuccess) {
    Write-Log "[OK] All phases completed successfully!" -ForegroundColor Green
    Write-Log ""
    Write-Log "════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Log "  ALL PHASES COMPLETE - Log viewer will remain open" -ForegroundColor Green
    Write-Log "════════════════════════════════════════════════════════════" -ForegroundColor Green
    exit 0
} else {
    Write-Log "[FAIL] Workflow failed. Check logs for details." -ForegroundColor Red
    Write-Log ""
    Write-Log "════════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Log "  WORKFLOW FAILED - Check log viewer for details" -ForegroundColor Red
    Write-Log "════════════════════════════════════════════════════════════" -ForegroundColor Red
    exit 1
}
