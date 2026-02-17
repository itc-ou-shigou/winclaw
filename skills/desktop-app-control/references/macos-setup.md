# macOS VNC Desktop Setup

Set up macOS Screen Sharing (built-in VNC) + websockify + noVNC for AI-driven desktop control.

## Overview

macOS includes a built-in VNC server via Screen Sharing. Combined with websockify and noVNC, this enables the same desktop control pipeline as Windows.

```
macOS Desktop → Screen Sharing (port 5900) → websockify (port 6080) → noVNC → Chrome tab → Chrome DevTools MCP
```

---

## Step 1: Enable Screen Sharing (VNC Server)

### macOS Ventura / Sonoma / Sequoia (13+)

1. Open **System Settings** → **General** → **Sharing**
2. Turn on **Screen Sharing**
3. Click the **(i)** info button next to Screen Sharing
4. Under "Allow access for": select **All users** or add specific users
5. Click **Computer Settings...**
6. Check **VNC viewers may control screen with password**
7. Set a VNC password (required by macOS)

### macOS Monterey and earlier (12-)

1. Open **System Preferences** → **Sharing**
2. Check **Screen Sharing**
3. Click **Computer Settings...**
4. Check **VNC viewers may control screen with password**
5. Set a VNC password

### Verify VNC server is running

```bash
# Check if Screen Sharing is enabled
sudo launchctl list | grep com.apple.screensharing
# Should show the process if active

# Test VNC connection locally
nc -z localhost 5900 && echo "VNC server is running" || echo "VNC server is NOT running"
```

---

## Step 2: Install websockify

### Option A: Via pip (recommended)

```bash
pip3 install websockify
```

### Option B: Via Homebrew

```bash
brew install websockify
```

### Option C: From source

```bash
git clone https://github.com/novnc/websockify.git ~/websockify
cd ~/websockify
python3 setup.py install
```

---

## Step 3: Install noVNC

```bash
# Create directory
mkdir -p ~/.winclaw/vnc

# Download noVNC
curl -L https://github.com/novnc/noVNC/archive/refs/tags/v1.5.0.tar.gz -o /tmp/novnc.tar.gz
tar xzf /tmp/novnc.tar.gz -C ~/.winclaw/vnc
mv ~/.winclaw/vnc/noVNC-1.5.0 ~/.winclaw/vnc/novnc
rm /tmp/novnc.tar.gz
```

---

## Step 4: Start websockify

```bash
websockify --web=$HOME/.winclaw/vnc/novnc 6080 localhost:5900 &
```

This runs websockify in the background, bridging VNC (port 5900) to WebSocket (port 6080) with the noVNC web client.

---

## Step 5: Launch Chrome with Remote Debugging

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 &
```

> **Note:** If Chrome is already running without `--remote-debugging-port`, you must quit it first and relaunch with the flag.

---

## Step 6: Open noVNC

Navigate to:
```
http://localhost:6080/vnc.html?autoconnect=1&resize=remote
```

Enter the VNC password you set in Step 1 when prompted.

---

## Quick Start Script

Create `~/.winclaw/vnc/start-vnc-desktop-mac.sh`:

```bash
#!/bin/bash
set -e

# Check Screen Sharing
if ! nc -z localhost 5900 2>/dev/null; then
    echo "ERROR: Screen Sharing (VNC) is not running."
    echo "Enable it in System Settings → General → Sharing → Screen Sharing"
    exit 1
fi

# Check if websockify is already running
if lsof -i :6080 >/dev/null 2>&1; then
    echo "websockify already running on port 6080"
else
    echo "Starting websockify..."
    websockify --web=$HOME/.winclaw/vnc/novnc 6080 localhost:5900 &
    sleep 1
    echo "websockify started on port 6080"
fi

echo ""
echo "noVNC URL: http://localhost:6080/vnc.html?autoconnect=1&resize=remote"
echo ""
echo "To stop: kill \$(lsof -t -i :6080)"
```

Make it executable:
```bash
chmod +x ~/.winclaw/vnc/start-vnc-desktop-mac.sh
```

---

## Quick Stop

```bash
# Stop websockify
kill $(lsof -t -i :6080) 2>/dev/null
echo "websockify stopped"
```

---

## Permissions

macOS requires explicit permissions for screen recording and accessibility:

### Screen Recording Permission

The terminal or app running websockify needs Screen Recording permission:

1. **System Settings** → **Privacy & Security** → **Screen Recording**
2. Add **Terminal.app** (or iTerm2, Warp, etc.)
3. Restart the terminal after granting permission

### Accessibility Permission (for input control)

If VNC input (click/type) doesn't work:

1. **System Settings** → **Privacy & Security** → **Accessibility**
2. Add the VNC client or terminal app

---

## Retina Display Notes

macOS Retina displays have 2x pixel density. This can affect coordinate mapping:

- **With `resize=remote`**: noVNC matches the VNC server resolution. Coordinates should map 1:1 if the VNC server reports the logical resolution.
- **If coordinates are off by 2x**: The VNC server may be reporting physical pixel resolution. Try:
  - Use `resize=scale` instead of `resize=remote` in the noVNC URL
  - Or divide screenshot coordinates by 2 before clicking

**Recommended URL for Retina Macs:**
```
http://localhost:6080/vnc.html?autoconnect=1&resize=scale&quality=6
```

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Connection refused" on port 5900 | Screen Sharing not enabled | Enable in System Settings → Sharing |
| Password prompt in noVNC | macOS requires VNC password | Enter the password you set in Step 1 |
| Black screen | Screen Recording permission missing | Grant permission (see Permissions above) |
| Click coordinates offset | Retina 2x scaling | Use `resize=scale` or divide coordinates by 2 |
| "Address already in use" on 6080 | websockify already running | `kill $(lsof -t -i :6080)` then restart |
| Input (click/type) not working | Accessibility permission missing | Grant Accessibility permission |
| Chrome won't connect | Not launched with debug port | Quit Chrome completely, relaunch with `--remote-debugging-port=9222` |

### Diagnostic commands

```bash
# Check VNC server
nc -z localhost 5900 && echo "VNC OK" || echo "VNC not running"

# Check websockify
lsof -i :6080

# Check Chrome remote debugging
curl -s http://localhost:9222/json/version | python3 -m json.tool

# Check Screen Sharing status
sudo launchctl list | grep screensharing
```
