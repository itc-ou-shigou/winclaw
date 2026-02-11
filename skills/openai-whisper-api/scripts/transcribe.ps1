#Requires -Version 5.1
<#
.SYNOPSIS
    Transcribe audio using the OpenAI Whisper API.
.PARAMETER InputFile
    Path to the audio file to transcribe.
.PARAMETER Model
    Whisper model to use (default: whisper-1).
.PARAMETER Out
    Output file path (auto-generated if omitted).
.PARAMETER Language
    Optional language hint (ISO 639-1).
.PARAMETER Prompt
    Optional prompt to guide transcription style.
.PARAMETER Json
    Output JSON format instead of plain text.
.EXAMPLE
    .\transcribe.ps1 audio.mp3
    .\transcribe.ps1 audio.mp3 -Out result.txt -Language en
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [string]$InputFile,

    [string]$Model = "whisper-1",
    [string]$Out = "",
    [string]$Language = "",
    [string]$Prompt = "",
    [switch]$Json
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $InputFile)) {
    Write-Error "File not found: $InputFile"
    exit 1
}

$apiKey = $env:OPENAI_API_KEY
if (-not $apiKey) {
    Write-Error "Missing OPENAI_API_KEY environment variable"
    exit 1
}

$responseFormat = if ($Json) { "json" } else { "text" }

if (-not $Out) {
    $base = [System.IO.Path]::ChangeExtension($InputFile, $null).TrimEnd('.')
    $ext = if ($Json) { ".json" } else { ".txt" }
    $Out = "$base$ext"
}

$outDir = Split-Path $Out -Parent
if ($outDir -and -not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$form = @{
    file            = Get-Item $InputFile
    model           = $Model
    response_format = $responseFormat
}
if ($Language) { $form["language"] = $Language }
if ($Prompt)   { $form["prompt"]   = $Prompt }

$headers = @{ "Authorization" = "Bearer $apiKey" }

$response = Invoke-RestMethod `
    -Uri "https://api.openai.com/v1/audio/transcriptions" `
    -Method Post `
    -Headers $headers `
    -Form $form

if ($Json) {
    $response | ConvertTo-Json -Depth 10 | Set-Content -Path $Out -Encoding UTF8
} else {
    $response | Set-Content -Path $Out -Encoding UTF8
}

Write-Output $Out
