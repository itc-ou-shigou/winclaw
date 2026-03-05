# Test: Generate .mcp.json and verify claude CLI can see Chrome MCP tools

$Workspace = "C:\work\workspaces\autoproject"
$mcpConfigPath = Join-Path $Workspace ".mcp.json"

# Step 1: Create .mcp.json
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
Get-Content $mcpConfigPath

# Step 2: Find claude CLI
$claudePath = Get-Command claude -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $claudePath) {
    Write-Host "[ERROR] claude not found in PATH"
    exit 1
}
Write-Host "[OK] Claude CLI: $claudePath"

# Step 3: Test with a simple prompt that checks for MCP tools
Write-Host ""
Write-Host "Testing claude CLI with --mcp-config..."
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
    $psi.Arguments = "/c `"$claudePath`" --dangerously-skip-permissions --verbose --mcp-config `"$mcpConfigPath`""
} else {
    $psi.FileName = $claudePath
    $psi.Arguments = "--dangerously-skip-permissions --verbose --mcp-config `"$mcpConfigPath`""
}

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $psi
$proc.Start() | Out-Null

$stdinWriter = New-Object System.IO.StreamWriter($proc.StandardInput.BaseStream, [System.Text.Encoding]::UTF8)
$stdinWriter.Write("List all tools you have that start with 'mcp__Claude_in_Chrome'. Just list the tool names, nothing else. If you have none, say NONE.")
$stdinWriter.Flush()
$stdinWriter.Close()

$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit(60000)

Write-Host "EXIT CODE: $($proc.ExitCode)"
Write-Host ""
Write-Host "=== STDOUT ==="
Write-Host $stdout
if ($stderr) {
    Write-Host ""
    Write-Host "=== STDERR (last 500 chars) ==="
    if ($stderr.Length -gt 500) {
        Write-Host $stderr.Substring($stderr.Length - 500)
    } else {
        Write-Host $stderr
    }
}

# Cleanup
Remove-Item $mcpConfigPath -Force -ErrorAction SilentlyContinue
Write-Host ""
Write-Host "[CLEANUP] Removed .mcp.json"
