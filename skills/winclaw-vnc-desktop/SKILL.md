---
name: winclaw-vnc-desktop
description: Guide users through setting up VNC desktop streaming to enable AI-driven Windows desktop automation via Claude in Chrome. Covers TightVNC server installation, websockify bridge setup, noVNC client configuration, and troubleshooting. Use when user asks about "desktop control", "VNC setup", "operate Windows apps", "click desktop", "automate Windows", "remote desktop in browser", or wants Claude to control native Windows applications.
metadata:
  {
    "winclaw":
      {
        "emoji": "🖥️",
        "os": ["win32"],
        "always": true,
      },
  }
---

# WinClaw VNC Desktop Control

Enable Claude in Chrome to see and operate the full Windows desktop by streaming it into a Chrome tab via VNC.

## Overview

**Problem:** Claude in Chrome can only interact with web page content inside Chrome tabs. It cannot click native Windows application buttons, operate desktop software, or interact with browser chrome (address bar, tabs).

**Solution:** Run a VNC server on Windows that captures the desktop, bridge it through WebSocket using websockify, and display it in Chrome via noVNC. Claude in Chrome can then take screenshots of the desktop and click coordinates to operate any Windows application.

**Architecture:**
```
Windows Desktop → TightVNC (port 5900) → websockify (port 6080) → noVNC → Chrome tab → Claude in Chrome
```

---

## Installer Integration

If you selected the "VNC Desktop Control" option in the WinClaw installer (WinClawSetup-*.exe),
TightVNC and noVNC are installed automatically. To get started:

1. Start Menu → click "VNC Desktop - Start"
2. Claude in Chrome will automatically open a noVNC tab and control the desktop

If you did not select VNC during installation, you can set it up later:

```powershell
# Run as Administrator
powershell -ExecutionPolicy Bypass -File "C:\Program Files\WinClaw\vnc\setup-vnc-desktop.ps1"
```

---

## Prerequisites

- Windows 10 or 11
- Chrome browser with Claude in Chrome extension installed
- Python 3.8+ (for websockify) OR Node.js 22+ (WinClaw bundled runtime works)
- Internet access (for initial download only)

---

## Automated Setup (Recommended)

WinClaw provides scripts to fully automate installation and configuration.

### One-time setup (requires Administrator)

```powershell
# Right-click PowerShell -> Run as Administrator
.\scripts\setup-vnc-desktop.ps1
```

This script automatically:
1. Installs TightVNC Server via winget (if not installed)
2. Configures registry: LoopbackOnly=1, UseVncAuthentication=0, Port=5900
3. Starts TightVNC as Windows service
4. Installs websockify via pip
5. Downloads noVNC HTML client to `~/.winclaw/vnc/novnc/`

### Start desktop streaming

```powershell
# No admin required
.\scripts\start-vnc-desktop.ps1
```

Starts websockify as a **hidden background process**. Output:
```
noVNC URL: http://localhost:6080/vnc.html?autoconnect=1&resize=remote
```

### Stop desktop streaming

```powershell
.\scripts\stop-vnc-desktop.ps1
```

### Claude in Chrome integration

The noVNC tab can be opened **automatically by AI** — the user doesn't need to touch it:

1. Claude in Chrome creates a new tab via `tabs_create_mcp`
2. Navigates to `http://localhost:6080/vnc.html?autoconnect=1&resize=remote`
3. Takes screenshots of the Windows desktop
4. Clicks / types to operate any application

The user only needs to run `start-vnc-desktop.ps1` once. After that, AI handles everything.

---

## Manual Setup (Alternative)

If the automated script doesn't work, follow these steps manually:

### Step 1: Install TightVNC Server

```powershell
winget install GlavSoft.TightVNC
```

### Step 2: Configure TightVNC

Open "TightVNC Service Configuration" from Start Menu:
1. **Server** tab → uncheck "Require VNC authentication"
2. **Access Control** tab → check "Allow loopback connections"
3. Click Apply → OK

### Step 3: Install websockify + noVNC

```powershell
pip install websockify
```

Download noVNC:
```powershell
mkdir $env:USERPROFILE\.winclaw\vnc
Invoke-WebRequest -Uri "https://github.com/novnc/noVNC/archive/refs/tags/v1.5.0.zip" -OutFile "$env:USERPROFILE\.winclaw\vnc\novnc.zip"
Expand-Archive -Path "$env:USERPROFILE\.winclaw\vnc\novnc.zip" -DestinationPath "$env:USERPROFILE\.winclaw\vnc"
Rename-Item "$env:USERPROFILE\.winclaw\vnc\noVNC-1.5.0" "novnc"
```

### Step 4: Start streaming

```powershell
websockify --web="$env:USERPROFILE\.winclaw\vnc\novnc" 6080 localhost:5900
```

### Step 5: Open in Chrome

```
http://localhost:6080/vnc.html?autoconnect=1&resize=remote
```

---

## Usage Examples

**Opening an application:**
```
You:   Open Notepad and write "Hello World"
Claude: [Takes screenshot of the desktop]
        I can see the Windows desktop. Let me click the Start button.
        [Clicks Start button coordinates]
        [Types "notepad" and presses Enter]
        [Takes screenshot - Notepad is now open]
        Now I'll type the text.
        [Clicks the text area and types "Hello World"]
        Done! I've opened Notepad and written "Hello World".
```

**File management:**
```
You:   Create a new folder called "test" on the Desktop
Claude: [Takes screenshot]
        I'll right-click on an empty area of the desktop.
        [Right-clicks desktop area]
        [Clicks "New" → "Folder"]
        [Types "test" and presses Enter]
        The "test" folder has been created on your desktop.
```

**System settings:**
```
You:   Open Windows Settings and change the display resolution to 1920x1080
Claude: [Takes screenshot]
        Let me open Settings via the Start menu.
        [Clicks Start → Settings → System → Display]
        [Navigates to resolution dropdown]
        [Selects 1920x1080]
        [Clicks "Apply"]
        Resolution changed to 1920x1080.
```

---

## Optimization Tips

### For best performance

1. **Set Windows display scaling to 100%**
   - High DPI scaling (150%, 200%) can cause click coordinate misalignment
   - Settings → System → Display → Scale → 100%

2. **Use a standard resolution**
   - 1920x1080 or 1280x720 work best
   - Lower resolution = faster VNC encoding

3. **Disable Windows transparency effects**
   - Settings → Personalization → Colors → Transparency effects → Off
   - Reduces VNC encoding overhead

4. **Use noVNC quality settings**
   - In the noVNC toolbar (left side), adjust quality vs speed
   - For AI automation, medium quality is usually sufficient

### noVNC URL parameters

| Parameter | Value | Effect |
|-----------|-------|--------|
| `autoconnect` | `1` | Auto-connect on page load |
| `resize` | `remote` | Scale VNC to browser window |
| `resize` | `scale` | Scale view without changing remote resolution |
| `quality` | `0-9` | JPEG quality (0=best compression, 9=best quality) |
| `compression` | `0-9` | Compression level (0=none, 9=max) |
| `view_only` | `1` | View only, no input (for monitoring) |

**Recommended URL for AI automation:**
```
http://localhost:6080/vnc.html?autoconnect=1&resize=remote&quality=6&compression=2
```

---

## Troubleshooting

### Common issues

| Issue | Cause | Solution |
|-------|-------|----------|
| noVNC shows "Disconnected" | VNC server not running | Start TightVNC: `Start-Service tvnserver` |
| noVNC shows "Connection refused" | websockify not running | Start websockify: `websockify --web=... 6080 localhost:5900` |
| Black screen in noVNC | VNC server on wrong display | Check TightVNC settings, restart service |
| Click coordinates are misaligned | DPI scaling > 100% | Set Windows scaling to 100% |
| Very slow / laggy | High resolution or effects | Reduce resolution, disable transparency |
| Port 5900 already in use | Another VNC server running | `netstat -ano \| findstr :5900` to check, stop conflicting process |
| Port 6080 already in use | Another websockify instance | Use different port: `websockify --web=... 6081 localhost:5900` |
| Claude can't identify UI elements | Low quality / small resolution | Increase quality parameter, zoom into specific area |

### Diagnostic commands

```powershell
# Check if VNC server is running
Get-Service -Name tvnserver
Get-Process -Name tvnserver -ErrorAction SilentlyContinue

# Check if ports are open
Test-NetConnection -ComputerName localhost -Port 5900
Test-NetConnection -ComputerName localhost -Port 6080

# Check what's using VNC port
netstat -ano | findstr :5900
netstat -ano | findstr :6080

# Restart TightVNC
Restart-Service -Name tvnserver

# Kill websockify (if frozen)
Get-Process -Name python* | Where-Object { $_.CommandLine -like '*websockify*' } | Stop-Process
```

---

## Security Notes

- **localhost only:** VNC and websockify should only listen on 127.0.0.1
- **No remote access:** Never expose VNC port 5900 or websockify port 6080 to the network
- **Firewall rules (defense in depth):**
  ```powershell
  # Block external access to VNC ports
  New-NetFirewallRule -DisplayName "Block VNC 5900 Inbound" -Direction Inbound -LocalPort 5900 -Protocol TCP -Action Block
  New-NetFirewallRule -DisplayName "Block noVNC 6080 Inbound" -Direction Inbound -LocalPort 6080 -Protocol TCP -Action Block
  ```
- **Important:** Enabling VNC desktop control gives the AI access to your entire Windows desktop. Only use this when you want AI-assisted desktop automation.

---

## Quick Start / Quick Stop

**Start all:**
```powershell
# 1. Start VNC server
Start-Service -Name tvnserver

# 2. Start websockify + noVNC (keep terminal open)
websockify --web="$env:USERPROFILE\.winclaw\vnc\novnc" 6080 localhost:5900

# 3. Open in Chrome
Start-Process "http://localhost:6080/vnc.html?autoconnect=1&resize=remote"
```

**Stop all:**
```powershell
# Stop websockify (Ctrl+C in terminal, or)
Get-Process -Name python* | Where-Object { $_.CommandLine -like '*websockify*' } | Stop-Process -Force

# Stop VNC server
Stop-Service -Name tvnserver
```

---

## Alternative VNC Servers

| Server | Pros | Cons |
|--------|------|------|
| **TightVNC** (recommended) | Stable, well-maintained, free | No native WebSocket support |
| **UltraVNC** | Mirror driver (low CPU), Windows-optimized | More complex setup |
| **TigerVNC** | Fastest encoding | Windows server poorly maintained |
| **RealVNC** | Commercial, polished UI | Not free for commercial use |

All work with websockify + noVNC. Just change the VNC port if needed.

---

## Conversation Guidelines

When the user asks about VNC desktop setup:
1. **Detect their current state**: Ask what's already installed (Python? VNC server?)
2. **Guide step by step**: Don't dump all steps at once; adapt to their situation
3. **Test incrementally**: After each step, verify it works before moving on
4. **Troubleshoot actively**: If something fails, check ports, processes, and logs
5. **Suggest optimizations**: After basic setup works, suggest performance tuning

When the user asks to perform desktop tasks via VNC:
1. **Take a screenshot first** to see the current desktop state
2. **Identify target UI element** by visual analysis
3. **Click precisely** using coordinates from the screenshot
4. **Verify result** with another screenshot
5. **Report completion** or troubleshoot if needed

### MCP Tool Integration

When the user asks to perform desktop tasks (open apps, click buttons, type text, etc.):
1. Ensure VNC infrastructure is running (check ports 5900 and 6080)
2. Use `mcp__chrome_devtools__*` tools via the MCP Bridge plugin for actual desktop interaction
3. The **desktop-app-control** skill provides the full MCP tool operation workflow, including:
   - Prerequisites verification chain (MCP Bridge → Chrome → VNC → noVNC tab)
   - Complete tool reference (`mcp__chrome_devtools__click`, `take_screenshot`, `press_key`, etc.)
   - Common operation patterns for Windows and macOS

**⛔ CRITICAL: Tab Safety & Chrome Protection**
- **`close_page` is BLOCKED at code level** — calling it will return an error, do NOT attempt it
- **NEVER use `exec` to kill, restart, or launch Chrome** — no `taskkill`, `Stop-Process`, `Start-Process chrome`, etc.
- Only create a NEW tab for noVNC (`mcp__chrome_devtools__new_page`) — never reuse existing tabs
- Only operate on the noVNC tab — never select or interact with the user's other tabs
- **If Chrome needs reconfiguration**, ask the USER to restart it manually
