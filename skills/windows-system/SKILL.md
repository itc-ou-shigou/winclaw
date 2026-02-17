---
name: windows-system
description: Operate Windows system tools via desktop GUI control (VNC + MCP). Manage Settings, Control Panel, Task Manager, Device Manager, and other system GUIs visually. Requires desktop-app-control skill active.
metadata:
  {
    "winclaw":
      {
        "emoji": "🖥️",
        "os": ["win32"],
        "requires": { "config": ["plugins.entries.mcp-bridge.enabled"] },
      },
  }
---

# Windows System Management Skill

Manage Windows system settings, services, tasks, and configuration by operating system GUIs (Settings, Control Panel, Task Manager, etc.) via VNC + MCP desktop control.

**Prerequisites:** The **desktop-app-control** skill must be active and VNC infrastructure running. Follow the desktop-app-control prerequisites check before using this skill.

---

## Open Windows Settings

```
1. mcp__chrome_devtools__take_screenshot              # Check current desktop
2. mcp__chrome_devtools__press_key  key: "Meta+i"     # Open Settings directly
3. (wait 1-2s)
4. mcp__chrome_devtools__take_screenshot              # Verify Settings is open
```

### Navigate Settings categories

```
# Settings opens to the main page with categories on the left
1. mcp__chrome_devtools__take_screenshot              # See Settings categories
2. Click the desired category (System, Network, Personalization, etc.)
   mcp__chrome_devtools__click  x: <category_x>  y: <category_y>
3. (wait 0.5s)
4. mcp__chrome_devtools__take_screenshot              # See category contents
```

### Use Settings search

```
1. Click the search bar at the top of Settings:
   mcp__chrome_devtools__click  x: <search_x>  y: <search_y>
2. Type search query:
   mcp__chrome_devtools__fill  value: "display resolution"
3. (wait 1s)
4. mcp__chrome_devtools__take_screenshot              # See search results
5. Click the desired result
```

---

## Display Settings

### Change resolution

```
1. mcp__chrome_devtools__press_key  key: "Meta+i"     # Open Settings
2. (wait 1s)
3. Navigate to System > Display (click System, then Display)
4. mcp__chrome_devtools__take_screenshot              # See display settings
5. Scroll down to "Display resolution" dropdown
6. Click the resolution dropdown:
   mcp__chrome_devtools__click  x: <resolution_dropdown_x>  y: <resolution_dropdown_y>
7. (wait 0.3s)
8. mcp__chrome_devtools__take_screenshot              # See resolution options
9. Click desired resolution (e.g., 1920 x 1080)
   mcp__chrome_devtools__click  x: <resolution_x>  y: <resolution_y>
10. If "Keep changes" dialog appears:
    mcp__chrome_devtools__take_screenshot
    mcp__chrome_devtools__click  x: <keep_changes_x>  y: <keep_changes_y>
```

### Change display scaling

```
1. In Display settings, find "Scale" or "Scale and layout"
2. Click the scale dropdown:
   mcp__chrome_devtools__click  x: <scale_dropdown_x>  y: <scale_dropdown_y>
3. mcp__chrome_devtools__take_screenshot              # See scale options
4. Click desired scale (100%, 125%, 150%, etc.)
   mcp__chrome_devtools__click  x: <scale_x>  y: <scale_y>
```

---

## Network Settings

### View network status

```
1. mcp__chrome_devtools__press_key  key: "Meta+i"     # Open Settings
2. (wait 1s)
3. Navigate to Network & Internet
4. mcp__chrome_devtools__take_screenshot              # See network status
```

### Wi-Fi settings

```
1. In Network & Internet, click "Wi-Fi"
   mcp__chrome_devtools__click  x: <wifi_x>  y: <wifi_y>
2. mcp__chrome_devtools__take_screenshot              # See Wi-Fi settings
3. To see available networks, click "Show available networks"
4. mcp__chrome_devtools__take_screenshot              # See network list
```

---

## Task Manager

```
1. mcp__chrome_devtools__press_key  key: "Control+Shift+Escape"  # Open Task Manager
2. (wait 1s)
3. mcp__chrome_devtools__take_screenshot              # See Task Manager
```

### View processes

```
1. Click "Processes" tab (if not already selected)
   mcp__chrome_devtools__take_screenshot              # See process list
2. To sort by CPU/Memory, click the column header:
   mcp__chrome_devtools__click  x: <cpu_header_x>  y: <cpu_header_y>
3. mcp__chrome_devtools__take_screenshot              # See sorted processes
```

### End a process

```
1. Click on the process to select it:
   mcp__chrome_devtools__click  x: <process_x>  y: <process_y>
2. ASK THE USER for confirmation before ending the process
3. If confirmed, click "End task" button:
   mcp__chrome_devtools__click  x: <end_task_x>  y: <end_task_y>
4. mcp__chrome_devtools__take_screenshot              # Verify process ended
```

**IMPORTANT:** Always confirm with the user before ending any process.

### View startup apps

```
1. Click "Startup" tab in Task Manager
   mcp__chrome_devtools__click  x: <startup_tab_x>  y: <startup_tab_y>
2. mcp__chrome_devtools__take_screenshot              # See startup items
```

---

## Control Panel

```
1. mcp__chrome_devtools__press_key  key: "Meta+r"     # Open Run dialog
2. (wait 0.5s)
3. mcp__chrome_devtools__fill  value: "control"
4. mcp__chrome_devtools__press_key  key: "Enter"
5. (wait 1s)
6. mcp__chrome_devtools__take_screenshot              # See Control Panel
```

### Navigate Control Panel items

```
1. mcp__chrome_devtools__take_screenshot              # See Control Panel categories
2. Click desired item (Programs and Features, System, etc.)
   mcp__chrome_devtools__click  x: <item_x>  y: <item_y>
3. (wait 0.5s)
4. mcp__chrome_devtools__take_screenshot              # See item details
```

---

## Device Manager

```
1. mcp__chrome_devtools__press_key  key: "Meta+r"     # Open Run dialog
2. (wait 0.5s)
3. mcp__chrome_devtools__fill  value: "devmgmt.msc"
4. mcp__chrome_devtools__press_key  key: "Enter"
5. (wait 1-2s)
6. mcp__chrome_devtools__take_screenshot              # See Device Manager
```

### Expand device categories

```
1. Click the expand arrow next to a device category:
   mcp__chrome_devtools__click  x: <expand_x>  y: <expand_y>
2. mcp__chrome_devtools__take_screenshot              # See devices in category
```

### View device properties

```
1. Double-click a device:
   mcp__chrome_devtools__click  x: <device_x>  y: <device_y>
   mcp__chrome_devtools__click  x: <device_x>  y: <device_y>   # Double-click
2. (wait 0.5s)
3. mcp__chrome_devtools__take_screenshot              # See device properties dialog
4. Close with Escape when done:
   mcp__chrome_devtools__press_key  key: "Escape"
```

---

## Services Manager

```
1. mcp__chrome_devtools__press_key  key: "Meta+r"     # Open Run dialog
2. (wait 0.5s)
3. mcp__chrome_devtools__fill  value: "services.msc"
4. mcp__chrome_devtools__press_key  key: "Enter"
5. (wait 1-2s)
6. mcp__chrome_devtools__take_screenshot              # See Services list
```

### Start / Stop a service

```
1. Find the service in the list (scroll or use search)
2. Right-click on the service:
   mcp__chrome_devtools__click  x: <service_x>  y: <service_y>  button: "right"
3. (wait 0.3s)
4. mcp__chrome_devtools__take_screenshot              # See context menu
5. Click "Start", "Stop", or "Restart"
   mcp__chrome_devtools__click  x: <action_x>  y: <action_y>
6. (wait 1s)
7. mcp__chrome_devtools__take_screenshot              # Verify service status
```

---

## Windows Update

```
1. mcp__chrome_devtools__press_key  key: "Meta+i"     # Open Settings
2. (wait 1s)
3. Navigate to Windows Update (usually last item in left sidebar)
   mcp__chrome_devtools__click  x: <windows_update_x>  y: <windows_update_y>
4. mcp__chrome_devtools__take_screenshot              # See update status
5. To check for updates, click "Check for updates":
   mcp__chrome_devtools__click  x: <check_updates_x>  y: <check_updates_y>
6. (wait 5-10s)
7. mcp__chrome_devtools__take_screenshot              # See update results
```

---

## System Tray Interaction

```
1. mcp__chrome_devtools__take_screenshot              # See taskbar
2. Locate the system tray area (bottom-right of screen)
3. Click the "^" arrow to show hidden icons:
   mcp__chrome_devtools__click  x: <tray_expand_x>  y: <tray_expand_y>
4. (wait 0.3s)
5. mcp__chrome_devtools__take_screenshot              # See tray icons
6. Click on the desired tray icon:
   mcp__chrome_devtools__click  x: <icon_x>  y: <icon_y>
7. mcp__chrome_devtools__take_screenshot              # See icon menu/popup
```

---

## Quick Launch Commands (via Run dialog)

```
# Open Run dialog first:
mcp__chrome_devtools__press_key  key: "Meta+r"
(wait 0.5s)

# Then type and press Enter:
mcp__chrome_devtools__fill  value: "cmd"              # Command Prompt
mcp__chrome_devtools__fill  value: "powershell"       # PowerShell
mcp__chrome_devtools__fill  value: "msconfig"         # System Configuration
mcp__chrome_devtools__fill  value: "diskmgmt.msc"     # Disk Management
mcp__chrome_devtools__fill  value: "eventvwr.msc"     # Event Viewer
mcp__chrome_devtools__fill  value: "taskschd.msc"     # Task Scheduler
mcp__chrome_devtools__fill  value: "regedit"          # Registry Editor
mcp__chrome_devtools__fill  value: "appwiz.cpl"       # Programs and Features
mcp__chrome_devtools__fill  value: "ncpa.cpl"         # Network Connections
mcp__chrome_devtools__fill  value: "sysdm.cpl"        # System Properties

mcp__chrome_devtools__press_key  key: "Enter"
```

---

## Keyboard Shortcuts

```
# System tools
mcp__chrome_devtools__press_key  key: "Meta+i"                # Settings
mcp__chrome_devtools__press_key  key: "Meta+r"                # Run dialog
mcp__chrome_devtools__press_key  key: "Control+Shift+Escape"  # Task Manager
mcp__chrome_devtools__press_key  key: "Meta+x"                # Quick Link menu (Win+X)
mcp__chrome_devtools__press_key  key: "Meta+Pause"            # System info (About)

# Desktop management
mcp__chrome_devtools__press_key  key: "Meta+d"                # Show desktop
mcp__chrome_devtools__press_key  key: "Meta+l"                # Lock screen
mcp__chrome_devtools__press_key  key: "Meta+Tab"              # Task View
mcp__chrome_devtools__press_key  key: "Alt+F4"                # Close active window

# Window management
mcp__chrome_devtools__press_key  key: "Meta+Up"               # Maximize window
mcp__chrome_devtools__press_key  key: "Meta+Down"             # Restore / minimize
mcp__chrome_devtools__press_key  key: "Meta+Left"             # Snap left
mcp__chrome_devtools__press_key  key: "Meta+Right"            # Snap right
```

---

## Notes

- Some system tools require Administrator privileges — if a UAC prompt appears, take a screenshot and inform the user
- **Always confirm with the user before ending processes, stopping services, or changing system settings**
- For system changes that require a restart, inform the user and let them decide when to restart
- If a dialog box appears unexpectedly, take a screenshot to identify it before proceeding
- VNC infrastructure setup is covered in the **winclaw-vnc-desktop** skill
- Full MCP tool workflow is documented in the **desktop-app-control** skill
