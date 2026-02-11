---
name: windows-explorer
description: Windows file system operations - search, bulk rename, permissions, compression, and clipboard via PowerShell.
metadata:
  {
    "openclaw": {
      "emoji": "📂",
      "os": ["win32"]
    }
  }
---

# Windows File Explorer

Advanced file system operations via PowerShell.

## File Search

Recursive search by name:
```powershell
Get-ChildItem -Path C:\Users -Recurse -Filter "*.pdf" -ErrorAction SilentlyContinue | Select-Object FullName, Length, LastWriteTime
```

Search file content (like grep):
```powershell
Select-String -Path "C:\project\*.ts" -Pattern "TODO" -Recurse | Format-Table Path, LineNumber, Line
```

Find large files:
```powershell
Get-ChildItem -Path C:\ -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Length -gt 100MB } | Sort-Object Length -Descending | Select-Object FullName, @{N='MB';E={[math]::Round($_.Length/1MB)}}
```

## Bulk Rename

Rename files with pattern:
```powershell
Get-ChildItem -Path .\photos -Filter "*.jpg" | Rename-Item -NewName { "vacation_" + $_.Name }
```

## Compression

Create zip:
```powershell
Compress-Archive -Path C:\source\folder -DestinationPath C:\output\archive.zip
```

Extract zip:
```powershell
Expand-Archive -Path C:\archive.zip -DestinationPath C:\extracted
```

## Clipboard

Copy text to clipboard:
```powershell
"Hello from WinClaw" | Set-Clipboard
```

Get clipboard content:
```powershell
Get-Clipboard
```

## File Hashes

```powershell
Get-FileHash -Path file.exe -Algorithm SHA256 | Format-List
```

## Notes
- Use `-ErrorAction SilentlyContinue` for recursive searches to skip access-denied directories
- Paths with spaces must be quoted
- Use `Test-Path` before operations to verify targets exist
