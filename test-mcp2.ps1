# Test 2: Let claude CLI auto-read .mcp.json from working directory (no --mcp-config flag)

$Workspace = "C:\work\workspaces\autoproject"
$mcpConfigPath = Join-Path $Workspace ".mcp.json"

# Create .mcp.json in workspace
$config = @{
    mcpServers = @{
        Claude_in_Chrome = @{
            command = "chrome-devtools-mcp"
            args = @("--browserUrl", "http://127.0.0.1:9222")
        }
    }
}
$config | ConvertTo-Json -Depth 5 | Set-Content $mcpConfigPath -Encoding UTF8
Write-Host "[OK] Created $mcpConfigPath"

$claudePath = (Get-Command claude -ErrorAction SilentlyContinue).Source
Write-Host "[OK] Claude: $claudePath"

# Test WITHOUT --mcp-config (rely on auto-read from CWD)
Write-Host ""
Write-Host "Test: claude CLI auto-read .mcp.json from CWD=$Workspace"
Write-Host "---"

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.RedirectStandardInput = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.WorkingDirectory = $Workspace
$psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
$psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

if ($claudePath -like "*.cmd") {
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c `"$claudePath`" --dangerously-skip-permissions --verbose"
} else {
    $psi.FileName = $claudePath
    $psi.Arguments = "--dangerously-skip-permissions --verbose"
}

Write-Host "CMD: $($psi.FileName) $($psi.Arguments)"
Write-Host "CWD: $($psi.WorkingDirectory)"

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$proc.Start() | Out-Null

$stdinWriter = New-Object System.IO.StreamWriter($proc.StandardInput.BaseStream, [System.Text.Encoding]::UTF8)
$stdinWriter.Write("Do you have any tools that start with mcp__Claude_in_Chrome? Reply YES or NO, then list the tool names if YES.")
$stdinWriter.Flush()
$stdinWriter.Close()

if (-not $proc.WaitForExit(90000)) {
    Write-Host "[TIMEOUT] Killing process..."
    $proc.Kill()
}

$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()

Write-Host ""
Write-Host "EXIT CODE: $($proc.ExitCode)"
Write-Host ""
Write-Host "=== STDOUT ==="
$stdout
Write-Host ""
Write-Host "=== STDERR (last 1000 chars) ==="
if ($stderr.Length -gt 1000) {
    $stderr.Substring($stderr.Length - 1000)
} else {
    $stderr
}

# Cleanup
Remove-Item $mcpConfigPath -Force -ErrorAction SilentlyContinue
Write-Host "[CLEANUP] Done"
