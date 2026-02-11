#Requires -Version 5.1
<#
.SYNOPSIS
    Extract a single video frame using ffmpeg.
.PARAMETER InputFile
    Path to the video file.
.PARAMETER Time
    Timestamp to extract (e.g. "00:01:30").
.PARAMETER Index
    Frame index to extract (0-based).
.PARAMETER Out
    Output image file path (required).
.EXAMPLE
    .\frame.ps1 video.mp4 -Time "00:00:05" -Out thumb.jpg
    .\frame.ps1 video.mp4 -Index 0 -Out first.png
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [string]$InputFile,

    [string]$Time = "",
    [int]$Index = -1,
    [Parameter(Mandatory)]
    [string]$Out
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $InputFile)) {
    Write-Error "File not found: $InputFile"
    exit 1
}

$outDir = Split-Path $Out -Parent
if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$ffmpeg = "ffmpeg"
if (-not (Get-Command $ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Error "ffmpeg not found in PATH. Install via: winget install Gyan.FFmpeg"
    exit 1
}

if ($Index -ge 0) {
    & $ffmpeg -hide_banner -loglevel error -y `
        -i $InputFile `
        -vf "select=eq(n\,$Index)" `
        -vframes 1 `
        $Out
} elseif ($Time) {
    & $ffmpeg -hide_banner -loglevel error -y `
        -ss $Time `
        -i $InputFile `
        -frames:v 1 `
        $Out
} else {
    & $ffmpeg -hide_banner -loglevel error -y `
        -i $InputFile `
        -vf "select=eq(n\,0)" `
        -vframes 1 `
        $Out
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "ffmpeg failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Output $Out
