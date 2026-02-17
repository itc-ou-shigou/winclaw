---
name: windows-outlook
description: Operate Microsoft Outlook via desktop GUI control (VNC + MCP). Read, send, search, and manage emails by visually interacting with the Outlook application. Requires Outlook installed and desktop-app-control skill active.
metadata:
  {
    "winclaw":
      {
        "emoji": "📧",
        "os": ["win32"],
        "requires": { "config": ["plugins.entries.mcp-bridge.enabled"] },
      },
  }
---

# Windows Outlook Skill

Read, send, search, and manage emails by operating the Microsoft Outlook desktop application via VNC + MCP desktop control.

**Prerequisites:** The **desktop-app-control** skill must be active and VNC infrastructure running. Follow the desktop-app-control prerequisites check before using this skill.

---

## Open Outlook

```
1. mcp__chrome_devtools__take_screenshot              # Check current desktop
2. mcp__chrome_devtools__press_key  key: "Meta"       # Open Start menu
3. (wait 1s)
4. mcp__chrome_devtools__fill  value: "outlook"       # Type app name
5. (wait 1s)
6. mcp__chrome_devtools__press_key  key: "Enter"      # Launch Outlook
7. (wait 3-5s)                                        # Outlook takes time to load
8. mcp__chrome_devtools__take_screenshot              # Verify Outlook is open
```

If Outlook is already open but not visible, use Alt+Tab:
```
mcp__chrome_devtools__press_key  key: "Alt+Tab"
mcp__chrome_devtools__take_screenshot
```

---

## Read Inbox Emails

```
1. mcp__chrome_devtools__take_screenshot              # See Outlook window
2. Identify the Inbox folder in the left navigation pane
3. mcp__chrome_devtools__click  x: <inbox_x>  y: <inbox_y>    # Click Inbox
4. (wait 1s)
5. mcp__chrome_devtools__take_screenshot              # See inbox email list
6. Read email subjects, senders, and dates from the screenshot
7. To read an email body, click on the email in the list:
   mcp__chrome_devtools__click  x: <email_x>  y: <email_y>
8. (wait 0.5s)
9. mcp__chrome_devtools__take_screenshot              # Read email content in preview pane
```

To scroll through more emails:
```
mcp__chrome_devtools__press_key  key: "PageDown"
mcp__chrome_devtools__take_screenshot
```

---

## Send an Email

```
1. mcp__chrome_devtools__take_screenshot              # See Outlook window
2. Locate the "New Email" button (usually top-left of ribbon)
3. mcp__chrome_devtools__click  x: <new_email_x>  y: <new_email_y>   # Click New Email
4. (wait 1-2s)
5. mcp__chrome_devtools__take_screenshot              # See new email compose window

6. Click the "To" field:
   mcp__chrome_devtools__click  x: <to_field_x>  y: <to_field_y>
   mcp__chrome_devtools__fill  value: "recipient@example.com"

7. Click the "Subject" field:
   mcp__chrome_devtools__click  x: <subject_x>  y: <subject_y>
   mcp__chrome_devtools__fill  value: "Subject Line"

8. Click the email body area:
   mcp__chrome_devtools__click  x: <body_x>  y: <body_y>
   mcp__chrome_devtools__fill  value: "Email body text here."

9. mcp__chrome_devtools__take_screenshot              # Verify email content before sending
10. ASK THE USER for confirmation before clicking Send
11. If confirmed, click the Send button:
    mcp__chrome_devtools__click  x: <send_x>  y: <send_y>
```

**IMPORTANT:** Always show the user a screenshot of the composed email and get confirmation before clicking Send.

---

## Search Emails

```
1. mcp__chrome_devtools__take_screenshot              # See Outlook window
2. Locate the search bar (usually at top of email list)
3. mcp__chrome_devtools__click  x: <search_x>  y: <search_y>    # Click search bar
4. mcp__chrome_devtools__fill  value: "meeting"                   # Type search query
5. mcp__chrome_devtools__press_key  key: "Enter"                  # Execute search
6. (wait 1-2s)
7. mcp__chrome_devtools__take_screenshot              # See search results
```

---

## Reply / Forward

```
1. First select the email to reply to (click on it in the list)
2. mcp__chrome_devtools__take_screenshot              # Verify correct email selected

# Reply
3. Locate the "Reply" button in the ribbon or reading pane
   mcp__chrome_devtools__click  x: <reply_x>  y: <reply_y>
4. (wait 1s)
5. mcp__chrome_devtools__take_screenshot              # See reply compose area
6. Click reply body and type:
   mcp__chrome_devtools__click  x: <reply_body_x>  y: <reply_body_y>
   mcp__chrome_devtools__fill  value: "Reply text here."
7. Confirm with user, then click Send

# Forward
3. Locate the "Forward" button
   mcp__chrome_devtools__click  x: <forward_x>  y: <forward_y>
4. Fill in the "To" field with the forward recipient
5. Confirm with user, then click Send
```

---

## Manage Folders

```
1. mcp__chrome_devtools__take_screenshot              # See folder pane
2. To navigate to Sent Items, Drafts, etc.:
   mcp__chrome_devtools__click  x: <folder_x>  y: <folder_y>
3. (wait 0.5s)
4. mcp__chrome_devtools__take_screenshot              # Verify folder contents

# Create new folder (right-click on parent folder)
5. mcp__chrome_devtools__click  x: <parent_folder_x>  y: <parent_folder_y>  button: "right"
6. (wait 0.5s)
7. mcp__chrome_devtools__take_screenshot              # See context menu
8. Click "New Folder..." in context menu
9. mcp__chrome_devtools__fill  value: "New Folder Name"
10. mcp__chrome_devtools__press_key  key: "Enter"
```

---

## Calendar Operations

```
1. Click the Calendar icon in the bottom navigation bar of Outlook
   mcp__chrome_devtools__click  x: <calendar_icon_x>  y: <calendar_icon_y>
2. (wait 1s)
3. mcp__chrome_devtools__take_screenshot              # See calendar view

# Create new event
4. Double-click on the desired date/time slot
   mcp__chrome_devtools__click  x: <slot_x>  y: <slot_y>
   mcp__chrome_devtools__click  x: <slot_x>  y: <slot_y>   # Double-click
5. (wait 1s)
6. mcp__chrome_devtools__take_screenshot              # See event creation form
7. Fill in event details (Subject, Location, time, etc.)
8. Click "Save & Close"
```

---

## Keyboard Shortcuts in Outlook

```
# New email
mcp__chrome_devtools__press_key  key: "Control+n"

# Reply
mcp__chrome_devtools__press_key  key: "Control+r"

# Reply All
mcp__chrome_devtools__press_key  key: "Control+Shift+r"

# Forward
mcp__chrome_devtools__press_key  key: "Control+f"

# Send (in compose window)
mcp__chrome_devtools__press_key  key: "Alt+s"

# Search
mcp__chrome_devtools__press_key  key: "Control+e"

# Switch to Mail view
mcp__chrome_devtools__press_key  key: "Control+1"

# Switch to Calendar view
mcp__chrome_devtools__press_key  key: "Control+2"

# Switch to Contacts
mcp__chrome_devtools__press_key  key: "Control+3"

# Mark as read/unread
mcp__chrome_devtools__press_key  key: "Control+q"
```

---

## Notes

- Requires Microsoft Outlook installed and configured with an email account
- **Always confirm with the user before sending any email** — show a screenshot of the composed email first
- **Ask before deleting emails** — deletion may be irreversible depending on Outlook settings
- Outlook may show dialog boxes (meeting reminders, update prompts) — take a screenshot to identify and handle them
- VNC infrastructure setup is covered in the **winclaw-vnc-desktop** skill
- Full MCP tool workflow is documented in the **desktop-app-control** skill
