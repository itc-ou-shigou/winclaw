$procs = Get-Process chrome -ErrorAction SilentlyContinue | Select-Object -First 1
if ($procs) {
    $wmi = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" | Select-Object -First 1
    Write-Host "CommandLine: $($wmi.CommandLine)"
} else {
    Write-Host "Chrome not running"
}
