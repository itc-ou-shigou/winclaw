---
name: windows-office
description: Create and edit Microsoft Office documents (Word, Excel, PowerPoint) via python-docx, openpyxl, python-pptx, and optional COM Automation.
metadata:
  {
    "openclaw":
      {
        "emoji": "📄",
        "os": ["win32"],
        "requires": { "bins": ["python3"] },
        "install":
          [
            {
              "id": "pip-office",
              "kind": "pip",
              "package": "python-docx openpyxl python-pptx",
              "label": "Install Office Python libraries",
            },
          ],
      },
  }
---

# Windows Office Skill

Create, edit, and convert Microsoft Office documents.
Supports two modes:

- **Python libraries** (python-docx, openpyxl, python-pptx): No Office installation required
- **COM Automation** (pywin32): Requires Office installed, supports full feature set including PDF export

## Setup

Install Python libraries:

```powershell
pip install python-docx openpyxl python-pptx
```

For COM Automation (optional, requires Office installed):

```powershell
pip install pywin32
```

## Word Documents

### Create a document

```powershell
python3 -c "
from docx import Document
from docx.shared import Pt, Inches
doc = Document()
doc.add_heading('Title', 0)
doc.add_paragraph('Body text here.')
doc.add_table(rows=3, cols=3)
doc.save('output.docx')
print('Created: output.docx')
"
```

### Read document content

```powershell
python3 -c "
from docx import Document
doc = Document('input.docx')
for para in doc.paragraphs:
    print(para.text)
"
```

## Excel Spreadsheets

### Create a spreadsheet

```powershell
python3 -c "
from openpyxl import Workbook
wb = Workbook()
ws = wb.active
ws.title = 'Data'
ws.append(['Date', 'Product', 'Amount'])
ws.append(['2026-02-10', 'Widget A', 150])
wb.save('report.xlsx')
print('Created: report.xlsx')
"
```

### Read Excel data

```powershell
python3 -c "
from openpyxl import load_workbook
wb = load_workbook('report.xlsx')
ws = wb.active
for row in ws.iter_rows(values_only=True):
    print('\t'.join(str(c) for c in row))
"
```

## PowerPoint Presentations

### Create a presentation

```powershell
python3 -c "
from pptx import Presentation
from pptx.util import Inches, Pt
prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[0])
slide.shapes.title.text = 'Presentation Title'
slide.placeholders[1].text = 'Subtitle'
prs.save('presentation.pptx')
print('Created: presentation.pptx')
"
```

## COM Automation (Advanced, requires Office)

### Convert Word to PDF

```powershell
python3 -c "
import win32com.client, os
word = win32com.client.Dispatch('Word.Application')
word.Visible = False
doc = word.Documents.Open(os.path.abspath('input.docx'))
doc.SaveAs2(os.path.abspath('output.pdf'), FileFormat=17)
doc.Close()
word.Quit()
print('Exported PDF')
"
```

## GUI Operations (via VNC)

For complex formatting via the Office ribbon UI, visual layout adjustments, SmartArt, etc.,
use **winclaw-vnc-desktop** skill for desktop control via VNC.
- Apply styles and themes via the Office ribbon
- PowerPoint slide design (drag & drop)
- Excel chart creation and visual adjustments
- Features not available via Python libraries / COM (Copilot, Designer, etc.)

Most document operations can be handled programmatically with the Python / COM commands above. Use VNC only when GUI interaction is required.

## Notes

- python-docx/openpyxl/python-pptx work without Office installed
- COM Automation requires Microsoft Office installed
- Always use `os.path.abspath()` for Windows file paths in COM calls
- Confirm before overwriting existing files
