#Requires -Version 5.1
<#
.SYNOPSIS
    Wait for text to appear in a tmux pane via WSL bridge.
.DESCRIPTION
    Polls a tmux pane through WSL until the specified pattern appears
    or the timeout expires.
.PARAMETER Target
    tmux target pane (e.g. "session:window.pane").
.PARAMETER Pattern
    Text pattern to wait for.
.PARAMETER Fixed
    Use fixed string matching instead of regex.
.PARAMETER Timeout
    Maximum seconds to wait (default: 15).
.PARAMETER Interval
    Polling interval in seconds (default: 0.5).
.PARAMETER Lines
    Number of pane lines to capture per poll (default: 1000).
.EXAMPLE
    .\wait-for-text.ps1 -Target "main:0.0" -Pattern "ready"
    .\wait-for-text.ps1 -Target "dev:0" -Pattern "compiled" -Timeout 30
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][Alias("t")][string]$Target,
    [Parameter(Mandatory)][Alias("p")][string]$Pattern,
    [Alias("F")][switch]$Fixed,
    [Alias("T")][int]$Timeout = 15,
    [Alias("i")][double]$Interval = 0.5,
    [Alias("l")][int]$Lines = 1000
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Write-Error "WSL not available. tmux requires WSL on Windows."
    exit 1
}

$scriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$shScript = Join-Path $scriptDir "wait-for-text.sh"

if (-not (Test-Path $shScript)) {
    Write-Error "Companion script not found: $shScript"
    exit 1
}

$wslScript = (wsl.exe wslpath -u ($shScript -replace '\\', '/')) | Out-String
$wslScript = $wslScript.Trim()

$wslArgs = @("-t", $Target, "-p", $Pattern, "-T", $Timeout, "-i", $Interval, "-l", $Lines)
if ($Fixed) { $wslArgs += "-F" }

wsl.exe bash $wslScript @wslArgs
exit $LASTEXITCODE
