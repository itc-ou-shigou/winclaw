---
name: windows-system
description: Windows system management - services, processes, registry, event logs, and scheduled tasks via PowerShell.
metadata: { "winclaw": { "emoji": "🖥️", "os": ["win32"] } }
---

# Windows System Management

Manage Windows services, processes, scheduled tasks, and system configuration via PowerShell.

## Services

List running services:

```powershell
Get-Service | Where-Object { $_.Status -eq 'Running' } | Format-Table Name, DisplayName, Status
```

Start/stop/restart a service:

```powershell
Start-Service -Name "ServiceName"
Stop-Service -Name "ServiceName" -Force
Restart-Service -Name "ServiceName"
```

## Processes

List processes by memory usage:

```powershell
Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 20 Name, Id, @{N='MB';E={[math]::Round($_.WorkingSet64/1MB,1)}}
```

## Registry

Read a registry value:

```powershell
Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion" -Name "ProgramFilesDir"
```

## Event Logs

Recent errors from Application log:

```powershell
Get-WinEvent -LogName Application -MaxEvents 20 | Where-Object { $_.Level -eq 2 } | Format-Table TimeCreated, Message -Wrap
```

## Scheduled Tasks

List custom tasks:

```powershell
Get-ScheduledTask | Where-Object { $_.TaskPath -notlike '\Microsoft*' } | Format-Table TaskName, State, TaskPath
```

## Disk and Network

Disk usage:

```powershell
Get-PSDrive -PSProvider FileSystem | Format-Table Name, @{N='Used(GB)';E={[math]::Round($_.Used/1GB,1)}}, @{N='Free(GB)';E={[math]::Round($_.Free/1GB,1)}}
```

Network connections:

```powershell
Get-NetTCPConnection -State Established | Select-Object LocalPort, RemoteAddress, RemotePort, OwningProcess | Sort-Object LocalPort
```

## Installed Software

```powershell
winget list --source winget | Select-Object -Skip 2
```

## GUI Operations (via VNC)

For GUI operations such as Windows Settings and Control Panel,
use **winclaw-vnc-desktop** skill for desktop control via VNC.
- Windows Settings (Display, Network, Bluetooth, Privacy)
- Control Panel (items not accessible via PowerShell)
- Hardware troubleshooting in Device Manager
- Visual process management in Task Manager
- Windows Update GUI interface
- System tray icon interaction

Most system management tasks can be handled programmatically with the PowerShell commands above. Use VNC only when GUI interaction is required.

## Notes

- Some commands require elevated (Administrator) PowerShell
- Use `-WhatIf` for dry-run before destructive operations
- Prefer `Get-*` cmdlets over legacy commands (ipconfig, netstat, etc.)
