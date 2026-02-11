#Requires -Version 5.1
<#
.SYNOPSIS
    List tmux sessions via WSL bridge.
.DESCRIPTION
    tmux does not run natively on Windows. This script calls the
    corresponding .sh script through WSL (Windows Subsystem for Linux).
.PARAMETER Socket
    tmux socket name (-L).
.PARAMETER SocketPath
    tmux socket path (-S).
.PARAMETER All
    Show all sessions including detached.
.PARAMETER Query
    Filter sessions by name pattern.
.EXAMPLE
    .\find-sessions.ps1
    .\find-sessions.ps1 -Query "dev"
#>
[CmdletBinding()]
param(
    [Alias("L")][string]$Socket = "",
    [Alias("S")][string]$SocketPath = "",
    [Alias("A")][switch]$All,
    [Alias("q")][string]$Query = ""
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Write-Error "WSL not available. tmux requires WSL on Windows."
    exit 1
}

$scriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$shScript = Join-Path $scriptDir "find-sessions.sh"

if (-not (Test-Path $shScript)) {
    Write-Error "Companion script not found: $shScript"
    exit 1
}

# Convert Windows path to WSL path
$wslScript = (wsl.exe wslpath -u ($shScript -replace '\\', '/')) | Out-String
$wslScript = $wslScript.Trim()

$wslArgs = @()
if ($Socket)     { $wslArgs += "-L", $Socket }
if ($SocketPath) { $wslArgs += "-S", $SocketPath }
if ($All)        { $wslArgs += "-A" }
if ($Query)      { $wslArgs += "-q", $Query }

wsl.exe bash $wslScript @wslArgs
exit $LASTEXITCODE
