---
name: windows-explorer
description: Operate Windows File Explorer via desktop GUI control (VNC + MCP). Browse folders, manage files, drag & drop, use context menus, and navigate the file system visually. Requires desktop-app-control skill active.
metadata:
  {
    "winclaw":
      {
        "emoji": "📂",
        "os": ["win32"],
        "requires": { "config": ["plugins.entries.mcp-bridge.enabled"] },
      },
  }
---

# Windows File Explorer Skill

Browse, manage, and organize files by operating Windows File Explorer via VNC + MCP desktop control.

**Prerequisites:** The **desktop-app-control** skill must be active and VNC infrastructure running. Follow the desktop-app-control prerequisites check before using this skill.

---

## Open File Explorer

```
1. mcp__chrome_devtools__take_screenshot              # Check current desktop
2. mcp__chrome_devtools__press_key  key: "Meta+e"     # Open File Explorer directly
3. (wait 1-2s)
4. mcp__chrome_devtools__take_screenshot              # Verify Explorer is open
```

Alternative — open a specific folder:

```
1. mcp__chrome_devtools__press_key  key: "Meta+r"     # Open Run dialog
2. (wait 0.5s)
3. mcp__chrome_devtools__fill  value: "C:\Users"      # Type path
4. mcp__chrome_devtools__press_key  key: "Enter"
5. (wait 1s)
6. mcp__chrome_devtools__take_screenshot              # See folder contents
```

---

## Navigate Folders

### Using the address bar

```
1. Click on the address bar (or press Alt+D):
   mcp__chrome_devtools__press_key  key: "Alt+d"      # Focus address bar
2. Type the path:
   mcp__chrome_devtools__fill  value: "C:\Users\USER\Documents"
3. mcp__chrome_devtools__press_key  key: "Enter"
4. (wait 1s)
5. mcp__chrome_devtools__take_screenshot              # See folder contents
```

### Double-click to open folders

```
1. mcp__chrome_devtools__take_screenshot              # See current folder
2. Identify the target folder in the file list
3. Double-click on the folder:
   mcp__chrome_devtools__click  x: <folder_x>  y: <folder_y>
   mcp__chrome_devtools__click  x: <folder_x>  y: <folder_y>   # Double-click
4. (wait 0.5s)
5. mcp__chrome_devtools__take_screenshot              # See folder contents
```

### Go back / forward / up

```
# Back
mcp__chrome_devtools__press_key  key: "Alt+Left"

# Forward
mcp__chrome_devtools__press_key  key: "Alt+Right"

# Go up one level
mcp__chrome_devtools__press_key  key: "Alt+Up"
```

---

## File Operations

### Select files

```
# Click to select single file
mcp__chrome_devtools__click  x: <file_x>  y: <file_y>

# Ctrl+Click to add to selection
mcp__chrome_devtools__click  x: <file2_x>  y: <file2_y>  modifiers: "Control"

# Shift+Click to select range
mcp__chrome_devtools__click  x: <first_file_x>  y: <first_file_y>
mcp__chrome_devtools__click  x: <last_file_x>  y: <last_file_y>  modifiers: "Shift"

# Select all
mcp__chrome_devtools__press_key  key: "Control+a"
```

### Copy / Cut / Paste files

```
# Copy selected files
mcp__chrome_devtools__press_key  key: "Control+c"

# Cut selected files (move)
mcp__chrome_devtools__press_key  key: "Control+x"

# Navigate to destination folder
mcp__chrome_devtools__press_key  key: "Alt+d"
mcp__chrome_devtools__fill  value: "C:\destination\folder"
mcp__chrome_devtools__press_key  key: "Enter"
(wait 1s)

# Paste files
mcp__chrome_devtools__press_key  key: "Control+v"
(wait for copy to complete)
mcp__chrome_devtools__take_screenshot              # Verify files pasted
```

### Rename files

```
1. Click on the file to select it
   mcp__chrome_devtools__click  x: <file_x>  y: <file_y>
2. Press F2 to enter rename mode:
   mcp__chrome_devtools__press_key  key: "F2"
3. Type new name:
   mcp__chrome_devtools__fill  value: "new_filename.txt"
4. mcp__chrome_devtools__press_key  key: "Enter"
5. mcp__chrome_devtools__take_screenshot              # Verify renamed
```

### Delete files

```
1. Select the file(s) to delete
2. ASK THE USER for confirmation before deleting
3. If confirmed:
   mcp__chrome_devtools__press_key  key: "Delete"     # Move to Recycle Bin
4. If a confirmation dialog appears:
   mcp__chrome_devtools__take_screenshot              # See dialog
   mcp__chrome_devtools__press_key  key: "Enter"      # Confirm
```

**IMPORTANT:** Always confirm with the user before deleting any files.

### Create new folder

```
1. mcp__chrome_devtools__press_key  key: "Control+Shift+n"   # New folder shortcut
2. (wait 0.5s)
3. mcp__chrome_devtools__fill  value: "New Folder Name"
4. mcp__chrome_devtools__press_key  key: "Enter"
5. mcp__chrome_devtools__take_screenshot              # Verify folder created
```

### Create new file (via context menu)

```
1. Right-click on empty space in the folder:
   mcp__chrome_devtools__click  x: <empty_x>  y: <empty_y>  button: "right"
2. (wait 0.5s)
3. mcp__chrome_devtools__take_screenshot              # See context menu
4. Click "New" in context menu:
   mcp__chrome_devtools__click  x: <new_x>  y: <new_y>
5. (wait 0.3s)
6. mcp__chrome_devtools__take_screenshot              # See submenu
7. Click desired file type (Text Document, etc.)
   mcp__chrome_devtools__click  x: <type_x>  y: <type_y>
8. Type filename and press Enter
```

---

## Drag & Drop

```
1. mcp__chrome_devtools__take_screenshot              # See source and destination
2. Click and hold on the file to drag:
   mcp__chrome_devtools__drag  startX: <file_x>  startY: <file_y>  endX: <dest_x>  endY: <dest_y>
3. (wait 0.5s)
4. mcp__chrome_devtools__take_screenshot              # Verify file moved/copied
```

Note: Drag within same drive = move, drag between drives = copy. Hold Ctrl while dragging to force copy.

---

## Right-Click Context Menu

```
1. Right-click on a file:
   mcp__chrome_devtools__click  x: <file_x>  y: <file_y>  button: "right"
2. (wait 0.5s)
3. mcp__chrome_devtools__take_screenshot              # See context menu options
4. Click the desired option:
   mcp__chrome_devtools__click  x: <option_x>  y: <option_y>

# Common context menu items:
# - Open / Open with
# - Copy / Cut / Paste
# - Rename
# - Delete
# - Properties
# - Compress to ZIP (Windows 11)
# - Share
```

---

## Search Files

```
1. Make sure Explorer is focused on the correct folder
2. Click the search bar (or press Ctrl+E / Ctrl+F):
   mcp__chrome_devtools__press_key  key: "Control+e"
3. Type search query:
   mcp__chrome_devtools__fill  value: "*.pdf"         # Search by extension
4. mcp__chrome_devtools__press_key  key: "Enter"
5. (wait 2-5s, depending on folder size)
6. mcp__chrome_devtools__take_screenshot              # See search results
```

---

## View Options

```
# Change view mode (list, details, icons, etc.)
# Click the "View" tab in ribbon or use the view buttons in Explorer toolbar
mcp__chrome_devtools__take_screenshot                 # Identify view controls

# Toggle preview pane
mcp__chrome_devtools__press_key  key: "Alt+p"

# Toggle details pane
mcp__chrome_devtools__press_key  key: "Alt+Shift+p"

# Show/hide hidden files
# Navigate to View tab > Options > "Show hidden files"
```

---

## File Properties

```
1. Select the file
   mcp__chrome_devtools__click  x: <file_x>  y: <file_y>
2. Open properties:
   mcp__chrome_devtools__press_key  key: "Alt+Enter"
3. (wait 0.5s)
4. mcp__chrome_devtools__take_screenshot              # See properties dialog
5. Read file size, dates, attributes from the screenshot
6. Close dialog:
   mcp__chrome_devtools__press_key  key: "Escape"
```

---

## Keyboard Shortcuts in Explorer

```
# Navigation
mcp__chrome_devtools__press_key  key: "Meta+e"        # Open Explorer
mcp__chrome_devtools__press_key  key: "Alt+d"         # Focus address bar
mcp__chrome_devtools__press_key  key: "Alt+Left"      # Go back
mcp__chrome_devtools__press_key  key: "Alt+Right"     # Go forward
mcp__chrome_devtools__press_key  key: "Alt+Up"        # Go up one level
mcp__chrome_devtools__press_key  key: "F5"            # Refresh

# File operations
mcp__chrome_devtools__press_key  key: "Control+Shift+n" # New folder
mcp__chrome_devtools__press_key  key: "F2"            # Rename
mcp__chrome_devtools__press_key  key: "Delete"        # Delete (Recycle Bin)
mcp__chrome_devtools__press_key  key: "Shift+Delete"  # Permanent delete (CAUTION)
mcp__chrome_devtools__press_key  key: "Alt+Enter"     # Properties

# Selection
mcp__chrome_devtools__press_key  key: "Control+a"     # Select all
```

---

## Notes

- **Always confirm with the user before deleting files** — especially Shift+Delete (permanent)
- For very large folders, scrolling and screenshots may be needed to see all files
- File paths with spaces work correctly when typed into the address bar
- If a "File Access Denied" or UAC dialog appears, take a screenshot and inform the user
- VNC infrastructure setup is covered in the **winclaw-vnc-desktop** skill
- Full MCP tool workflow is documented in the **desktop-app-control** skill
