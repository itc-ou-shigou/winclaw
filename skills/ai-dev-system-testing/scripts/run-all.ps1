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
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Write-PhaseCheck {
    param([string]$Phase, [string]$Status, [string]$Output = "")
    $statusColor = if ($Status -eq "COMPLETE") { "Green" } elseif ($Status -eq "SKIP") { "Yellow" } else { "Red" }
    Write-Host "[PHASE_CHECK] Phase $Phase : $Status" -ForegroundColor $statusColor
    if ($Output) {
        Write-Host "  - Output: $Output" -ForegroundColor Gray
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
    
    Push-Location $Workspace
    try {
        $outputLog = Join-Path $logDir "claude_output.log"
        $errorLog = Join-Path $logDir "claude_error.log"
        
        # On Windows, claude might be a .ps1 script, use proper invocation
        $claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
        if (-not $claudeCmd) {
            Write-Host "[ERROR] claude CLI not found in PATH" -ForegroundColor Red
            return $false
        }
        
        # Check if it's a PowerShell script
        if ($claudeCmd.Source -like "*.ps1") {
            # Use PowerShell to execute
            $job = Start-Job -ScriptBlock {
                param($Ws, $P)
                Set-Location $Ws
                & claude --dangerously-skip-permissions -p $P 2>&1
            } -ArgumentList $Workspace, $Prompt
            
            $completed = Wait-Job $job -Timeout $TimeoutSeconds
            
            if (-not $completed) {
                Stop-Job $job
                Remove-Job $job
                Write-Host "[ERROR] Command timed out after $TimeoutSeconds seconds" -ForegroundColor Red
                return $false
            }
            
            $output = Receive-Job $job
            Remove-Job $job
            
            $output | Out-File $outputLog -Encoding UTF8
            $output | ForEach-Object { Write-Host $_ }
            
            return $true
        } else {
            # Use Start-Process for executable
            $process = Start-Process -FilePath $claudeCmd.Source `
                -ArgumentList "--dangerously-skip-permissions", "-p", $Prompt `
                -NoNewWindow -PassThru -RedirectStandardOutput $outputLog `
                -RedirectStandardError $errorLog
            
            $completed = $process.WaitForExit($TimeoutSeconds * 1000)
            
            if (-not $completed) {
                $process.Kill()
                Write-Host "[ERROR] Command timed out after $TimeoutSeconds seconds" -ForegroundColor Red
                return $false
            }
            
            if (Test-Path $outputLog) {
                Get-Content $outputLog
            }
            
            return $process.ExitCode -eq 0
        }
    }
    finally {
        Pop-Location
    }
}

function Ask-User {
    param([string]$Question)
    
    if ($NonInteractive) {
        return ""
    }
    
    Write-Host $Question -ForegroundColor Yellow
    $response = Read-Host "> "
    return $response
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
        Write-Host "[ERROR] Workspace does not exist: $Workspace" -ForegroundColor Red
        exit 1
    }
    
    # Check claude CLI (no hardcoded path)
    $claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
    if (-not $claudeCmd) {
        Write-Host "[ERROR] claude CLI not found in PATH. Please install Claude Code first." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "[OK] claude CLI found at: $($claudeCmd.Source)" -ForegroundColor Green
    
    # Interactive configuration if not provided
    if (-not $NonInteractive -and -not $FrontendUrl -and -not $BackendUrl) {
        Write-Host ""
        Write-Host "Please configure the test environment:" -ForegroundColor Yellow
        Write-Host ""
        
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
    
    Write-Host ""
    Write-Host "Configuration saved:" -ForegroundColor Green
    Write-Host "  - Frontend: $($script:FrontendUrl)"
    Write-Host "  - Backend: $($script:BackendUrl)"
    Write-Host "  - Database: $(if ($script:DatabaseUrl) { 'configured' } else { 'not configured' })"
    Write-Host ""
    Write-Host "Flow:" -ForegroundColor Yellow
    Write-Host "  - Phase 5B (API): $(if ($script:RunPhase5B) { 'WILL RUN' } else { 'SKIP (no backend URL)' })"
    Write-Host "  - Phase 5C (UI): $(if ($script:RunPhase5C) { 'WILL RUN' } else { 'SKIP (no frontend URL)' })"
    
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
        
        # Find bash executable
        $bashPath = Find-Bash
        
        if (-not $bashPath) {
            Write-Host "[ERROR] bash not found. Please install Git Bash or WSL." -ForegroundColor Red
            return $false
        }
        
        Write-Host "Running: $bashPath $script5b" -ForegroundColor Yellow
        Write-Host "WORKSPACE_DIR: $Workspace" -ForegroundColor Gray
        Write-Host "AIDEV_BACKEND_URL: $backendUrl" -ForegroundColor Gray
        
        if ($bashPath -eq "wsl") {
            # Convert Windows path to WSL path
            $wslPath = ($script5b -replace '\\', '/' -replace '^([A-Za-z]):', { "/mnt/$($_.Groups[1].Value.ToLower())" })
            & wsl bash $wslPath
        } else {
            & $bashPath $script5b
        }
        $exitCode = $LASTEXITCODE
    } else {
        Write-Host "[WARN] Script not found: $script5b" -ForegroundColor Yellow
        Write-Host "Falling back to claude CLI..." -ForegroundColor Yellow
        
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
        
        # Find bash executable
        $bashPath = Find-Bash
        
        if (-not $bashPath) {
            Write-Host "[ERROR] bash not found. Please install Git Bash or WSL." -ForegroundColor Red
            return $false
        }
        
        Write-Host "Running: $bashPath $script5c" -ForegroundColor Yellow
        Write-Host "WORKSPACE_DIR: $Workspace" -ForegroundColor Gray
        Write-Host "AIDEV_FRONTEND_URL: $frontendUrl" -ForegroundColor Gray
        
        if ($bashPath -eq "wsl") {
            # Convert Windows path to WSL path
            $wslPath = ($script5c -replace '\\', '/' -replace '^([A-Za-z]):', { "/mnt/$($_.Groups[1].Value.ToLower())" })
            & wsl bash $wslPath
        } else {
            & $bashPath $script5c
        }
        $exitCode = $LASTEXITCODE
    } else {
        Write-Host "[WARN] Script not found: $script5c" -ForegroundColor Yellow
        Write-Host "Falling back to claude CLI..." -ForegroundColor Yellow
        
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

Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     ai-dev-system-testing - Strict Workflow Executor         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor Cyan

Write-Host "Workspace: $Workspace" -ForegroundColor White
Write-Host "Skill Dir: $SKILL_DIR" -ForegroundColor White
Write-Host "Resume Mode: $Resume" -ForegroundColor White
Write-Host "Non-Interactive: $NonInteractive" -ForegroundColor White
Write-Host ""

# Create log directory
$logDir = Join-Path $Workspace "test-logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Determine phases to run
if ($Phases) {
    $phaseList = $Phases -split ","
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
        default { Write-Host "[WARN] Unknown phase: $phase" -ForegroundColor Yellow }
    }
    
    if (-not $success) {
        $allSuccess = $false
        Write-Host ""
        Write-Host "[ERROR] Phase $phase failed. Stopping workflow." -ForegroundColor Red
        break
    }
}

# Final summary
Write-Header "Workflow Summary"

if ($allSuccess) {
    Write-Host "[OK] All phases completed successfully!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAIL] Workflow failed. Check logs for details." -ForegroundColor Red
    exit 1
}
