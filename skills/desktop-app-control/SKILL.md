---
name: desktop-app-control
description: Control desktop applications via VNC + Chrome DevTools MCP tools. Use when user asks to open, click, type in, or interact with any native desktop application (Excel, Word, Notepad, Settings, File Explorer, Outlook, Finder, Terminal, etc.), operate Windows/macOS GUI elements, automate desktop workflows, take screenshots of the desktop, or perform any visual desktop interaction. Triggers on "open app", "click button", "desktop automation", "operate app", "GUI control", "screen capture", "desktop screenshot", "type in app", "automate Windows", "automate macOS".
metadata:
  {
    "winclaw":
      {
        "emoji": "🖱️",
        "os": ["win32", "darwin"],
        "requires": { "config": ["plugins.entries.mcp-bridge.enabled"] },
      },
  }
---

# Desktop App Control

Operate native desktop applications (Windows/macOS) via VNC desktop streaming + Chrome DevTools MCP tools.

## CRITICAL RULES — READ FIRST

> **⛔ ABSOLUTE PROHIBITION — CHROME TAB PROTECTION**
>
> Violating these rules DESTROYS user data. You MUST follow them without exception.
>
> 1. **NEVER call `mcp__chrome_devtools__close_page`** — this tool is BLOCKED at code level and will return an error
> 2. **NEVER call `mcp__chrome_devtools__navigate_page`** on any existing user tab — ONLY on the noVNC tab you created
> 3. **NEVER use `exec` to run `taskkill`, `Stop-Process`, `kill`, or any command that terminates Chrome** — this closes ALL user tabs (BLOCKED at code level)
> 4. **NEVER use `exec` to run `Start-Process chrome` or launch Chrome directly** — this may replace the running session (BLOCKED at code level)
> 5. **To start/check Chrome debugging**, use ONLY: `powershell -ExecutionPolicy Bypass -File .\scripts\ensure-chrome-debug.ps1` — parse its `CHROME_DEBUG_PORT=<port>` output to get the actual port (may be 9222-9229)
> 6. **ONLY create NEW tabs** using `mcp__chrome_devtools__new_page` — never modify existing tabs
> 7. If `mcp__chrome_devtools__list_pages` shows existing tabs, **leave them all untouched**
>
> **If the safe script reports "NEEDS_USER_ACTION"**, relay the message to the user and WAIT. Do NOT attempt workarounds.

---

## Architecture

```
User Request -> WinClaw Agent
  -> mcp__chrome_devtools__* tools (MCP Bridge Plugin)
    -> chrome-devtools-mcp server (Chrome DevTools Protocol)
      -> Chrome browser (noVNC tab, runs in background)
        -> noVNC -> websockify -> VNC Server
          -> Windows/macOS Desktop
```

The noVNC tab runs **in background** — it does not need to be the active/visible tab. All CDP operations (screenshot, click, type) work on background tabs.

---

## Prerequisites Check

Before performing any desktop operation, verify the full chain is ready. Follow these steps **in order**.

### 1. Check MCP Bridge connection

Call `mcp__bridge_status` tool. Look for `chrome-devtools` server status.

- If **connected**: proceed to step 2
- If **disconnected**: call `mcp__bridge_status` with `reconnect: true`
- If **not configured**: MCP Bridge plugin or chrome-devtools server is not set up. Inform the user.

### 2. Ensure Chrome has remote debugging enabled

Chrome must be running with `--remote-debugging-port` for the MCP Bridge to connect.
The script automatically scans ports **9222-9229** and uses the first available one.

> **⛔ NEVER use `exec` to directly kill Chrome, restart Chrome, or launch Chrome with custom flags.**
> Always use the safe launcher script below. It protects user tabs.

**Use this safe script via `exec`:**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\ensure-chrome-debug.ps1
```

The script handles all cases automatically and NEVER kills Chrome:

- **Scans ports 9222-9229** for an existing Chrome debugging instance
- If a port is already listening → prints `CHROME_DEBUG_PORT=<port>` and "OK", proceed to step 3
- If no port is listening → finds the first free port in 9222-9229, launches a SEPARATE dedicated WinClaw Chrome instance with its own profile (`--user-data-dir`), alongside any existing Chrome. User tabs are NEVER affected.
- **Parse the output** to get the actual port: look for the `CHROME_DEBUG_PORT=<port>` line
- Wait for "OK" output before proceeding

**macOS:**

```bash
# Scan ports 9222-9229
for port in 9222 9223 9224 9225 9226 9227 9228 9229; do
  lsof -i :$port >/dev/null 2>&1 && echo "CHROME_DEBUG_PORT=$port" && break
done
# If none active, ask user to restart Chrome with:
# open -a "Google Chrome" --args --remote-debugging-port=9222
```

### 3. Verify VNC + websockify is running

**Windows:**

```powershell
.\scripts\vnc-check-status.ps1
# If not running:
.\scripts\start-vnc-desktop.ps1
```

**macOS:** See [references/macos-setup.md](references/macos-setup.md)

### 4. Ensure noVNC tab exists (AUTOMATIC — first action)

This step MUST be performed automatically as the very first desktop operation. Do NOT ask the user to open the noVNC tab manually.

```
Step 4a: List all existing pages
  mcp__chrome_devtools__list_pages

Step 4b: Search for existing noVNC tab
  Look through ALL pages for a URL containing "localhost:6080" or "127.0.0.1:6080"

Step 4c: If noVNC tab FOUND:
  mcp__chrome_devtools__select_page  (select the noVNC tab by index)
  -> Ready to operate

Step 4d: If noVNC tab NOT FOUND:
  mcp__chrome_devtools__new_page  -> creates a NEW tab (does NOT affect existing tabs)
  mcp__chrome_devtools__navigate_page  url: "http://localhost:6080/vnc.html?autoconnect=1&resize=remote"
  -> Wait 2-3 seconds for noVNC to connect
  -> Take a screenshot to verify the desktop is visible
```

**REMEMBER**: In step 4a, you will see ALL existing user tabs. **Leave every single one of them untouched.** Only create a NEW tab for noVNC if one does not exist.

---

## Operation Workflow

Every desktop interaction follows a 4-step loop:

### Step 1: Select noVNC tab

```
mcp__chrome_devtools__list_pages   (find the noVNC tab)
mcp__chrome_devtools__select_page  (select the noVNC tab by its index)
```

**IMPORTANT:** Always re-select the noVNC tab before operations. If the user's Chrome has many tabs, the active tab may have changed. Only select the noVNC tab — never select any other tab.

### Step 2: Take screenshot

```
mcp__chrome_devtools__take_screenshot
```

Analyze the returned screenshot to understand the current desktop state.

### Step 3: Interact

Choose the appropriate tool based on the desired action (see Tool Reference below).

### Step 4: Verify

Wait 1-2 seconds for UI update, then take another screenshot to confirm the action succeeded.

Repeat steps 2-4 as needed until the task is complete.

---

## MCP Tool Reference

All tools are prefixed with `mcp__chrome_devtools__`:

### Input Tools

| Tool            | Description                        | Key Parameters                                     |
| --------------- | ---------------------------------- | -------------------------------------------------- |
| `click`         | Click at coordinates or on element | `selector`, `x`, `y`, `button` (left/right/middle) |
| `drag`          | Drag from one point to another     | `startX`, `startY`, `endX`, `endY`                 |
| `fill`          | Type text into focused element     | `selector`, `value`                                |
| `fill_form`     | Fill multiple form fields at once  | `fields` (array of {selector, value})              |
| `hover`         | Hover over element/coordinates     | `selector`, `x`, `y`                               |
| `press_key`     | Press keyboard key or shortcut     | `key` (e.g. "Enter", "Tab", "Control+c")           |
| `handle_dialog` | Accept or dismiss dialogs          | `accept` (boolean), `promptText`                   |
| `upload_file`   | Upload file to input element       | `selector`, `filePath`                             |

### Screenshot & Inspection

| Tool              | Description                | Key Parameters                  |
| ----------------- | -------------------------- | ------------------------------- |
| `take_screenshot` | Capture current page view  | (none — captures full viewport) |
| `take_snapshot`   | Get DOM accessibility tree | (none)                          |

### Navigation

| Tool            | Description                 | Safety                                                      |
| --------------- | --------------------------- | ----------------------------------------------------------- |
| `navigate_page` | Navigate CURRENT tab to URL | **ONLY use on the noVNC tab you selected**                  |
| `new_page`      | Open new tab                | Safe — adds a new tab without affecting others              |
| `close_page`    | ~~Close current tab~~       | **⛔ BLOCKED — calling this returns an error. Do NOT use.** |
| `list_pages`    | List all open tabs          | Safe — read-only                                            |
| `select_page`   | Switch to a tab             | **ONLY select the noVNC tab**                               |
| `wait_for`      | Wait for condition          | `selector`, `timeout`                                       |

### Advanced

| Tool              | Description                | Key Parameters    |
| ----------------- | -------------------------- | ----------------- |
| `evaluate_script` | Execute JavaScript in page | `expression`      |
| `resize_page`     | Change viewport dimensions | `width`, `height` |
| `emulate`         | Emulate device settings    | `device`          |

### Network & Performance (rarely needed for desktop control)

| Tool                          | Description             |
| ----------------------------- | ----------------------- |
| `list_network_requests`       | List network activity   |
| `get_network_request`         | Get request details     |
| `performance_start_trace`     | Start performance trace |
| `performance_stop_trace`      | Stop trace              |
| `performance_analyze_insight` | Analyze trace data      |

---

## Desktop Interaction via noVNC

When interacting with the desktop through noVNC, the canvas element represents the entire desktop. To click at desktop coordinates:

1. **Take screenshot** to identify the target element location
2. **Click** using coordinates relative to the noVNC canvas
3. For text input, **click** on the target field first, then use **press_key** for individual keys or **fill** for text strings

### Important: noVNC coordinate mapping

The noVNC canvas maps 1:1 to the VNC desktop when `resize=remote` is used. Coordinates in the screenshot directly correspond to click targets.

- Set Windows display scaling to **100%** for accurate coordinate mapping
- Recommended resolution: **1920x1080** or **1280x720**

---

## Common Patterns

### Open an application (Windows)

```
1. mcp__chrome_devtools__take_screenshot              # See current desktop
2. mcp__chrome_devtools__press_key  key: "Meta"       # Open Start menu
3. (wait 1s)
4. mcp__chrome_devtools__take_screenshot              # Verify Start menu opened
5. mcp__chrome_devtools__fill  value: "excel"         # Type app name
6. (wait 1s)
7. mcp__chrome_devtools__press_key  key: "Enter"      # Launch app
8. (wait 2-3s)
9. mcp__chrome_devtools__take_screenshot              # Verify app opened
```

### Open an application (macOS)

```
1. mcp__chrome_devtools__take_screenshot
2. mcp__chrome_devtools__press_key  key: "Meta+Space"  # Open Spotlight
3. (wait 0.5s)
4. mcp__chrome_devtools__fill  value: "excel"
5. mcp__chrome_devtools__press_key  key: "Enter"
6. (wait 2-3s)
7. mcp__chrome_devtools__take_screenshot
```

### Type text into an application

```
1. mcp__chrome_devtools__click  x: <target_x>  y: <target_y>   # Focus the text field
2. mcp__chrome_devtools__fill  value: "Hello World"              # Type text
```

### Right-click context menu (Windows)

```
1. mcp__chrome_devtools__click  x: <target_x>  y: <target_y>  button: "right"
2. (wait 0.5s)
3. mcp__chrome_devtools__take_screenshot      # See context menu
4. mcp__chrome_devtools__click  x: <menu_item_x>  y: <menu_item_y>  # Click menu item
```

### Keyboard shortcuts

```
# Copy
mcp__chrome_devtools__press_key  key: "Control+c"

# Paste
mcp__chrome_devtools__press_key  key: "Control+v"

# Save
mcp__chrome_devtools__press_key  key: "Control+s"

# Alt+Tab (switch window)
mcp__chrome_devtools__press_key  key: "Alt+Tab"

# macOS equivalents use Meta instead of Control
mcp__chrome_devtools__press_key  key: "Meta+c"   # Copy on macOS
```

### Scroll in an application

```
# Scroll is done via keyboard
mcp__chrome_devtools__press_key  key: "PageDown"
mcp__chrome_devtools__press_key  key: "PageUp"
# Or mouse wheel via evaluate_script if needed
```

---

## Platform-Specific Notes

### Windows

- **VNC Server**: TightVNC on port 5900
- **websockify**: Port 6080
- **Setup**: `.\scripts\setup-vnc-desktop.ps1` (admin) + `.\scripts\start-vnc-desktop.ps1`
- **DPI**: Set display scaling to 100% (Settings > Display > Scale)
- **Resolution**: 1920x1080 recommended
- **Keyboard**: Use `Control` for Ctrl key shortcuts

### macOS

- **VNC Server**: Built-in Screen Sharing on port 5900
- **websockify**: Port 6080
- **Setup**: See [references/macos-setup.md](references/macos-setup.md)
- **Retina**: May need coordinate scaling adjustment
- **Keyboard**: Use `Meta` for Cmd key shortcuts
- **Permissions**: Screen Recording permission required for Terminal/app running websockify

---

## Important Rules

1. **⛔ NEVER close any Chrome tab** — `close_page` is BLOCKED. Do not attempt it.
2. **⛔ NEVER kill/restart Chrome via exec** — no `taskkill /IM chrome.exe`, `Stop-Process -Name chrome`, `kill`, or `Start-Process chrome`. Use `.\scripts\ensure-chrome-debug.ps1` instead.
3. **NEVER navigate existing user tabs** — only navigate the noVNC tab you created
4. **Always take a screenshot before AND after any action** to verify state changes
5. **Wait between actions** (1-2 seconds) for UI animations and transitions
6. **Report what you see and what you're doing** — tell the user the coordinates and element you are clicking
7. **Ask before destructive actions** — closing unsaved documents, deleting files, modifying system settings
8. **Use VNC/MCP tools for all desktop GUI interaction** — do NOT use `exec` to run PowerShell/Python scripts for GUI automation (pyautogui, pywin32 COM, etc.)
9. **If an action fails**, take a screenshot to diagnose, then try an alternative approach
10. **noVNC tab can stay in background** — do not tell the user they need to keep it visible
11. **Automatically ensure the noVNC tab exists** as the first action — create it if missing, find and reuse it if already open
