#!/usr/bin/env python3
"""
V2: Extract role templates using line-by-line parsing instead of regex.
Handles nested ``` blocks correctly.
"""
import os
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), 'docs')

FILES = [
    'Role_Templates_Part1_Engineering_Design_Testing_Support.md',
    'Role_Templates_Part2_Marketing_Sales_Product_PM.md',
    'Role_Templates_Part2_Data_Business_Operations.md',
    'Role_Templates_Part3_GameDev_Spatial_Specialized.md',
]

def extract_roles(filepath):
    """Line-by-line parser for role templates."""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    roles = []
    current_role = None
    current_section = None  # e.g. 'IDENTITY.md', 'SOUL.md'
    in_code_block = False
    code_lines = []

    for line in lines:
        stripped = line.rstrip('\n')

        # Detect role start: ### Role: xxx
        if stripped.startswith('### Role:') and not stripped.startswith('####'):
            # Save previous role
            if current_role and current_section and in_code_block:
                current_role[current_section] = '\n'.join(code_lines).strip()
                in_code_block = False
                code_lines = []
                current_section = None

            if current_role:
                roles.append(current_role)

            role_id = stripped.replace('### Role:', '').strip().strip('`')
            current_role = {
                'id': role_id, 'name': role_id, 'emoji': '', 'department': '',
                'mode': 'autonomous', 'description': '',
                'IDENTITY.md': '', 'SOUL.md': '', 'AGENTS.md': '', 'TASKS.md': '',
                'TOOLS.md': '', 'USER.md': '', 'HEARTBEAT.md': '', 'BOOTSTRAP.md': '',
            }
            current_section = None
            in_code_block = False
            code_lines = []
            continue

        if current_role is None:
            continue

        # Detect metadata lines
        if not in_code_block and not current_section:
            if stripped.startswith('- **Name**:'):
                current_role['name'] = stripped.split(':', 1)[1].strip().strip('*')
            elif stripped.startswith('- **Emoji**:'):
                current_role['emoji'] = stripped.split(':', 1)[1].strip().strip('*')
            elif stripped.startswith('- **Department**:'):
                current_role['department'] = stripped.split(':', 1)[1].strip().strip('*')
            elif stripped.startswith('- **Mode**:'):
                current_role['mode'] = stripped.split(':', 1)[1].strip().strip('*').lower()
            elif stripped.startswith('- **Description**:'):
                current_role['description'] = stripped.split(':', 1)[1].strip().strip('*')

        # Detect section header: #### IDENTITY.md, #### SOUL.md, etc.
        if stripped.startswith('#### ') and stripped.endswith('.md'):
            section_name = stripped.replace('####', '').strip()
            if section_name in current_role:
                # Save previous section
                if current_section and in_code_block:
                    current_role[current_section] = '\n'.join(code_lines).strip()
                current_section = section_name
                in_code_block = False
                code_lines = []
            continue

        # Handle code block boundaries
        if current_section and not in_code_block:
            if stripped.startswith('```'):
                in_code_block = True
                code_lines = []
                continue

        if current_section and in_code_block:
            # Check for closing ``` — must be at start of line with nothing else
            if stripped == '```':
                current_role[current_section] = '\n'.join(code_lines).strip()
                in_code_block = False
                current_section = None
                code_lines = []
                continue
            code_lines.append(line.rstrip('\n'))

    # Save last role
    if current_role:
        if current_section and in_code_block:
            current_role[current_section] = '\n'.join(code_lines).strip()
        roles.append(current_role)

    # Convert to output format
    result = []
    for r in roles:
        result.append({
            'id': r['id'],
            'name': r['name'],
            'emoji': r['emoji'],
            'department': r['department'],
            'mode': r['mode'] if r['mode'] in ('autonomous', 'copilot') else 'autonomous',
            'description': r['description'][:500],
            'identity_md': r['IDENTITY.md'],
            'soul_md': r['SOUL.md'],
            'agents_md': r['AGENTS.md'],
            'tasks_md': r['TASKS.md'],
            'tools_md': r['TOOLS.md'],
            'user_md': r['USER.md'],
            'heartbeat_md': r['HEARTBEAT.md'],
            'bootstrap_md': r['BOOTSTRAP.md'],
        })
    return result

# Main
all_roles = []
for fname in FILES:
    fpath = os.path.join(DOCS_DIR, fname)
    if not os.path.exists(fpath):
        print(f"SKIP: {fname}")
        continue
    roles = extract_roles(fpath)
    # Check quality
    empty_count = sum(1 for r in roles if not r['soul_md'] and not r['agents_md'])
    print(f"{fname}: {len(roles)} roles ({empty_count} with empty soul+agents)")
    all_roles.extend(roles)

print(f"\nTotal: {len(all_roles)} roles")

# Quality check
good = sum(1 for r in all_roles if r['soul_md'] and r['agents_md'] and r['tools_md'])
partial = sum(1 for r in all_roles if r['identity_md'] and not r['soul_md'])
empty = sum(1 for r in all_roles if not r['identity_md'])
print(f"Quality: {good} complete, {partial} partial (identity only), {empty} empty")

# Check specific role
test = next((r for r in all_roles if r['id'] == 'roblox-systems-scripter'), None)
if test:
    print(f"\nTest roblox-systems-scripter:")
    for key in ['identity_md', 'soul_md', 'agents_md', 'tools_md', 'heartbeat_md']:
        print(f"  {key}: {len(test[key])} chars")

# Write JSON
output = os.path.join(SCRIPT_DIR, 'role-templates-import.json')
with open(output, 'w', encoding='utf-8') as f:
    json.dump(all_roles, f, ensure_ascii=False, indent=2)
print(f"\nJSON written to: {output}")
