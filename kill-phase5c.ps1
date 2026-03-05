# Kill all Phase 5C related processes (started after 22:00 on 2026-02-23)
$cutoff = Get-Date '2026-02-23 22:00:00'

foreach ($name in @('claude','bash','powershell')) {
    Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.StartTime -gt $cutoff) {
            Write-Output "Killing $name PID $($_.Id) (started $($_.StartTime.ToString('HH:mm:ss')))"
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
    }
}
Write-Output "Done"
