import json
import sys

fpath = r'C:\Users\USER\.claude\projects\C--work-winclaw\dc564569-8f94-4524-867d-974edbe1cf4f\tool-results\mcp-claude-in-chrome-read_console_messages-1771999365981.txt'
with open(fpath, encoding='utf-8') as f:
    data = json.load(f)
errors = [m for m in data if 'ReferenceError' in m.get('text','') or 'TypeError' in m.get('text','') or 'SyntaxError' in m.get('text','')]
for e in errors[:3]:
    print(e['text'][:500])
    print('---')
if not errors:
    print('No Reference/Type/Syntax errors found')
    for e in data[:5]:
        print(e.get('type',''), e['text'][:500])
        print('---')
