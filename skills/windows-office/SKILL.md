---
name: windows-office
description: Operate Microsoft Office applications (Word, Excel, PowerPoint) via desktop GUI control (VNC + MCP). Create, edit, format documents by visually interacting with Office apps. Requires Office installed and desktop-app-control skill active.
metadata:
  {
    "winclaw":
      {
        "emoji": "📄",
        "os": ["win32"],
        "requires": { "config": ["plugins.entries.mcp-bridge.enabled"] },
      },
  }
---

# Windows Office Skill

Create, edit, format, and manage Microsoft Office documents (Word, Excel, PowerPoint) by operating the Office desktop applications via VNC + MCP desktop control.

**Prerequisites:** The **desktop-app-control** skill must be active and VNC infrastructure running. Follow the desktop-app-control prerequisites check before using this skill.

---

## Open an Office Application

```
1. mcp__chrome_devtools__take_screenshot              # Check current desktop
2. mcp__chrome_devtools__press_key  key: "Meta"       # Open Start menu
3. (wait 1s)
4. mcp__chrome_devtools__fill  value: "word"          # Or "excel" or "powerpoint"
5. (wait 1s)
6. mcp__chrome_devtools__press_key  key: "Enter"      # Launch app
7. (wait 3-5s)                                        # Office apps take time to load
8. mcp__chrome_devtools__take_screenshot              # Verify app is open
```

To open a specific file:

```
1. mcp__chrome_devtools__press_key  key: "Control+o"  # File > Open
2. (wait 1s)
3. mcp__chrome_devtools__take_screenshot              # See Open dialog
4. Navigate to the file location using the dialog
5. mcp__chrome_devtools__fill  value: "C:\path\to\file.docx"   # Type path in filename field
6. mcp__chrome_devtools__press_key  key: "Enter"
7. (wait 2s)
8. mcp__chrome_devtools__take_screenshot              # Verify file opened
```

---

## Word — Document Operations

### Create a new document

```
1. Open Word (see "Open an Office Application" above)
2. mcp__chrome_devtools__take_screenshot              # See Word start screen
3. Click "Blank document" template
   mcp__chrome_devtools__click  x: <blank_doc_x>  y: <blank_doc_y>
4. (wait 1s)
5. mcp__chrome_devtools__take_screenshot              # See blank document
```

### Type and format text

```
1. Click in the document body area:
   mcp__chrome_devtools__click  x: <body_x>  y: <body_y>
2. Type text:
   mcp__chrome_devtools__fill  value: "Document Title"
3. Select the text for formatting:
   mcp__chrome_devtools__press_key  key: "Control+a"   # Select all (or use Shift+arrows)
4. Apply formatting via ribbon or shortcuts:
   mcp__chrome_devtools__press_key  key: "Control+b"   # Bold
   mcp__chrome_devtools__press_key  key: "Control+i"   # Italic
   mcp__chrome_devtools__press_key  key: "Control+u"   # Underline
5. mcp__chrome_devtools__take_screenshot              # Verify formatting
```

### Apply heading styles

```
# Use the Styles section in the Home ribbon tab
1. Select the text to style
2. mcp__chrome_devtools__take_screenshot              # Locate style buttons in ribbon
3. Click the desired heading style (Heading 1, Heading 2, etc.)
   mcp__chrome_devtools__click  x: <style_x>  y: <style_y>
4. mcp__chrome_devtools__take_screenshot              # Verify style applied
```

### Save and export

```
# Save
mcp__chrome_devtools__press_key  key: "Control+s"

# Save As
mcp__chrome_devtools__press_key  key: "F12"
(wait 1s)
mcp__chrome_devtools__take_screenshot                 # See Save As dialog
# Navigate and set filename, then press Enter

# Export as PDF
mcp__chrome_devtools__press_key  key: "Control+Shift+s"  # Or File > Save As
# In Save As dialog, change "Save as type" to PDF
```

---

## Excel — Spreadsheet Operations

### Create a new spreadsheet

```
1. Open Excel (see "Open an Office Application")
2. Click "Blank workbook"
   mcp__chrome_devtools__click  x: <blank_wb_x>  y: <blank_wb_y>
3. (wait 1s)
4. mcp__chrome_devtools__take_screenshot              # See blank spreadsheet
```

### Enter data into cells

```
1. Click on cell A1:
   mcp__chrome_devtools__click  x: <a1_x>  y: <a1_y>
2. Type header:
   mcp__chrome_devtools__fill  value: "Date"
3. Press Tab to move to next cell:
   mcp__chrome_devtools__press_key  key: "Tab"
4. mcp__chrome_devtools__fill  value: "Product"
5. mcp__chrome_devtools__press_key  key: "Tab"
6. mcp__chrome_devtools__fill  value: "Amount"
7. Press Enter to move to next row:
   mcp__chrome_devtools__press_key  key: "Enter"
8. Continue entering data...
9. mcp__chrome_devtools__take_screenshot              # Verify data entered
```

### Navigate cells

```
# Arrow keys to move between cells
mcp__chrome_devtools__press_key  key: "ArrowRight"
mcp__chrome_devtools__press_key  key: "ArrowDown"

# Go to specific cell
mcp__chrome_devtools__press_key  key: "Control+g"     # Go To dialog
# Or click the Name Box (top-left) and type cell reference
mcp__chrome_devtools__click  x: <name_box_x>  y: <name_box_y>
mcp__chrome_devtools__fill  value: "A1"
mcp__chrome_devtools__press_key  key: "Enter"
```

### Formulas

```
1. Click on the target cell
2. Type formula:
   mcp__chrome_devtools__fill  value: "=SUM(C2:C100)"
3. mcp__chrome_devtools__press_key  key: "Enter"
4. mcp__chrome_devtools__take_screenshot              # Verify formula result
```

### Create a chart

```
1. Select data range:
   mcp__chrome_devtools__click  x: <start_cell_x>  y: <start_cell_y>
   # Hold Shift and click end cell, or use Ctrl+Shift+End to select range
   mcp__chrome_devtools__press_key  key: "Control+Shift+End"
2. mcp__chrome_devtools__take_screenshot              # Verify selection
3. Click "Insert" tab in ribbon:
   mcp__chrome_devtools__click  x: <insert_tab_x>  y: <insert_tab_y>
4. mcp__chrome_devtools__take_screenshot              # See chart options in ribbon
5. Click desired chart type (Column, Line, Pie, etc.)
   mcp__chrome_devtools__click  x: <chart_type_x>  y: <chart_type_y>
6. (wait 1s)
7. mcp__chrome_devtools__take_screenshot              # See chart inserted
```

---

## PowerPoint — Presentation Operations

### Create a new presentation

```
1. Open PowerPoint (see "Open an Office Application")
2. Click "Blank Presentation"
   mcp__chrome_devtools__click  x: <blank_pres_x>  y: <blank_pres_y>
3. (wait 1s)
4. mcp__chrome_devtools__take_screenshot              # See blank slide
```

### Edit slides

```
# Click on title placeholder
1. mcp__chrome_devtools__click  x: <title_x>  y: <title_y>
2. mcp__chrome_devtools__fill  value: "Presentation Title"

# Click on subtitle placeholder
3. mcp__chrome_devtools__click  x: <subtitle_x>  y: <subtitle_y>
4. mcp__chrome_devtools__fill  value: "Subtitle text"
5. mcp__chrome_devtools__take_screenshot              # Verify slide content
```

### Add new slide

```
mcp__chrome_devtools__press_key  key: "Control+m"     # Insert new slide
(wait 0.5s)
mcp__chrome_devtools__take_screenshot                 # See new slide
```

### Navigate slides

```
# In the slide panel (left side), click on a slide thumbnail
mcp__chrome_devtools__click  x: <slide_thumb_x>  y: <slide_thumb_y>

# Or use keyboard:
mcp__chrome_devtools__press_key  key: "PageDown"      # Next slide
mcp__chrome_devtools__press_key  key: "PageUp"        # Previous slide
```

### Start presentation mode

```
mcp__chrome_devtools__press_key  key: "F5"            # From beginning
# or
mcp__chrome_devtools__press_key  key: "Shift+F5"      # From current slide
```

---

## Common Office Keyboard Shortcuts

```
# File operations
mcp__chrome_devtools__press_key  key: "Control+n"     # New document
mcp__chrome_devtools__press_key  key: "Control+o"     # Open
mcp__chrome_devtools__press_key  key: "Control+s"     # Save
mcp__chrome_devtools__press_key  key: "F12"           # Save As
mcp__chrome_devtools__press_key  key: "Control+p"     # Print
mcp__chrome_devtools__press_key  key: "Control+w"     # Close document

# Edit operations
mcp__chrome_devtools__press_key  key: "Control+z"     # Undo
mcp__chrome_devtools__press_key  key: "Control+y"     # Redo
mcp__chrome_devtools__press_key  key: "Control+c"     # Copy
mcp__chrome_devtools__press_key  key: "Control+x"     # Cut
mcp__chrome_devtools__press_key  key: "Control+v"     # Paste
mcp__chrome_devtools__press_key  key: "Control+a"     # Select all
mcp__chrome_devtools__press_key  key: "Control+f"     # Find
mcp__chrome_devtools__press_key  key: "Control+h"     # Find & Replace

# Text formatting
mcp__chrome_devtools__press_key  key: "Control+b"     # Bold
mcp__chrome_devtools__press_key  key: "Control+i"     # Italic
mcp__chrome_devtools__press_key  key: "Control+u"     # Underline

# Font size
mcp__chrome_devtools__press_key  key: "Control+Shift+>" # Increase font size
mcp__chrome_devtools__press_key  key: "Control+Shift+<" # Decrease font size
```

---

## Notes

- Requires Microsoft Office (Word, Excel, PowerPoint) installed
- Office apps may show a start screen on launch — click the desired template or "Blank" option
- **Always confirm with the user before overwriting existing files** (Save As)
- For large documents, use Page Down/Up and screenshots to navigate
- If an Office dialog appears (update prompt, activation, etc.), take a screenshot to identify and handle it
- VNC infrastructure setup is covered in the **winclaw-vnc-desktop** skill
- Full MCP tool workflow is documented in the **desktop-app-control** skill
