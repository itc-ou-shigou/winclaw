---
name: windows-outlook
description: Send and read emails via Microsoft Outlook COM Automation. Requires Outlook installed.
metadata:
  {
    "winclaw":
      {
        "emoji": "📧",
        "os": ["win32"],
        "requires": { "bins": ["python3"] },
        "install":
          [
            {
              "id": "pip-pywin32",
              "kind": "pip",
              "package": "pywin32",
              "label": "Install pywin32 for COM Automation",
            },
          ],
      },
  }
---

# Windows Outlook Skill

Send, read, and manage emails through Microsoft Outlook COM Automation.

## Read recent inbox emails

```powershell
python3 -c "
import win32com.client
outlook = win32com.client.Dispatch('Outlook.Application').GetNamespace('MAPI')
inbox = outlook.GetDefaultFolder(6)
messages = inbox.Items
messages.Sort('[ReceivedTime]', True)
for i, msg in enumerate(messages):
    if i >= 10: break
    print(f'{msg.ReceivedTime}: {msg.SenderName} - {msg.Subject}')
"
```

## Send an email

```powershell
python3 -c "
import win32com.client
outlook = win32com.client.Dispatch('Outlook.Application')
mail = outlook.CreateItem(0)
mail.To = 'recipient@example.com'
mail.Subject = 'Subject Line'
mail.Body = 'Email body text here.'
mail.Display()  # Opens draft for review; use mail.Send() to send directly
print('Email prepared')
"
```

## Search emails

```powershell
python3 -c "
import win32com.client
outlook = win32com.client.Dispatch('Outlook.Application').GetNamespace('MAPI')
inbox = outlook.GetDefaultFolder(6)
results = inbox.Items.Restrict(\"[Subject] = 'meeting'\")
for msg in results:
    print(f'{msg.ReceivedTime}: {msg.Subject}')
"
```

## GUI Operations (via VNC)

For Outlook GUI operations (calendar drag & drop, rich text editing, Rules Wizard, etc.),
use **winclaw-vnc-desktop** skill for desktop control via VNC.
- Calendar event drag & drop
- Rich text formatting via the Outlook editor
- Rule management via the Rules Wizard GUI
- Visual navigation of the Outlook folder tree
- Features not available via COM (Focused Inbox, @mentions, etc.)

Most email / calendar operations can be handled programmatically with the COM commands above. Use VNC only when GUI interaction is required.

## Notes

- Requires Microsoft Outlook installed and configured
- `mail.Display()` opens draft for review; `mail.Send()` sends immediately
- Always confirm with user before calling `mail.Send()`
- Folder IDs: 6=Inbox, 5=Sent, 3=Deleted, 4=Outbox
