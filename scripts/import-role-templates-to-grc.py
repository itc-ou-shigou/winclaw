#!/usr/bin/env python3
"""
Extract all role templates from Part1-Part3 docs and INSERT into GRC role_templates table.
Each role has 8 MD files: IDENTITY, SOUL, AGENTS, TASKS, TOOLS, USER, HEARTBEAT, BOOTSTRAP
"""
import re
import os
import json
import sys

# Find the docs
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), 'docs')

FILES = [
    'Role_Templates_Part1_Engineering_Design_Testing_Support.md',
    'Role_Templates_Part2_Marketing_Sales_Product_PM.md',
    'Role_Templates_Part2_Data_Business_Operations.md',
    'Role_Templates_Part3_GameDev_Spatial_Specialized.md',
]

def extract_roles(filepath):
    """Extract all roles from a Part document."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    roles = []

    # Find role blocks: ### Role: {role-id}
    role_pattern = re.compile(
        r'### Role:\s*`?([a-z0-9-]+)`?\s*\n'
        r'(.*?)(?=\n### Role:|\n## [A-Z]|\Z)',
        re.DOTALL
    )

    for match in role_pattern.finditer(content):
        role_id = match.group(1).strip()
        role_block = match.group(2)

        # Extract metadata
        name_match = re.search(r'\*\*Name\*\*:\s*(.+)', role_block)
        emoji_match = re.search(r'\*\*Emoji\*\*:\s*(.+)', role_block)
        dept_match = re.search(r'\*\*Department\*\*:\s*(.+)', role_block)
        mode_match = re.search(r'\*\*Mode\*\*:\s*(.+)', role_block)
        desc_match = re.search(r'\*\*Description\*\*:\s*(.+)', role_block)

        name = name_match.group(1).strip() if name_match else role_id
        emoji = emoji_match.group(1).strip() if emoji_match else ''
        department = dept_match.group(1).strip() if dept_match else ''
        mode = mode_match.group(1).strip().lower() if mode_match else 'autonomous'
        description = desc_match.group(1).strip() if desc_match else ''

        # Extract MD file contents
        md_files = {}
        for md_name in ['IDENTITY.md', 'SOUL.md', 'AGENTS.md', 'TASKS.md', 'TOOLS.md', 'USER.md', 'HEARTBEAT.md', 'BOOTSTRAP.md']:
            pattern = re.compile(
                r'####\s*' + re.escape(md_name) + r'\s*\n```(?:markdown)?\n(.*?)```',
                re.DOTALL
            )
            md_match = pattern.search(role_block)
            if md_match:
                md_files[md_name] = md_match.group(1).strip()
            else:
                md_files[md_name] = ''

        roles.append({
            'id': role_id,
            'name': name,
            'emoji': emoji,
            'department': department,
            'mode': mode if mode in ('autonomous', 'copilot') else 'autonomous',
            'description': description,
            'identity_md': md_files.get('IDENTITY.md', ''),
            'soul_md': md_files.get('SOUL.md', ''),
            'agents_md': md_files.get('AGENTS.md', ''),
            'tasks_md': md_files.get('TASKS.md', ''),
            'tools_md': md_files.get('TOOLS.md', ''),
            'user_md': md_files.get('USER.md', ''),
            'heartbeat_md': md_files.get('HEARTBEAT.md', ''),
            'bootstrap_md': md_files.get('BOOTSTRAP.md', ''),
        })

    return roles

def generate_sql(roles):
    """Generate SQL INSERT statements."""
    sql_lines = []
    sql_lines.append("-- Auto-generated from Role_Templates_Part1-Part3 docs")
    sql_lines.append("-- Total roles: %d" % len(roles))
    sql_lines.append("")

    for role in roles:
        def esc(s):
            return s.replace("'", "\\'").replace("\\", "\\\\") if s else ''

        sql = f"""INSERT INTO role_templates (id, name, emoji, description, department, mode, is_builtin,
  agents_md, soul_md, identity_md, user_md, tools_md, heartbeat_md, bootstrap_md, tasks_md)
VALUES (
  '{esc(role["id"])}',
  '{esc(role["name"])}',
  '{esc(role["emoji"])}',
  '{esc(role["description"][:500])}',
  '{esc(role["department"])}',
  '{role["mode"]}',
  0,
  '{esc(role["agents_md"])}',
  '{esc(role["soul_md"])}',
  '{esc(role["identity_md"])}',
  '{esc(role["user_md"])}',
  '{esc(role["tools_md"])}',
  '{esc(role["heartbeat_md"])}',
  '{esc(role["bootstrap_md"])}',
  '{esc(role["tasks_md"])}'
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  emoji = VALUES(emoji),
  description = VALUES(description),
  department = VALUES(department),
  mode = VALUES(mode),
  agents_md = VALUES(agents_md),
  soul_md = VALUES(soul_md),
  identity_md = VALUES(identity_md),
  user_md = VALUES(user_md),
  tools_md = VALUES(tools_md),
  heartbeat_md = VALUES(heartbeat_md),
  bootstrap_md = VALUES(bootstrap_md),
  tasks_md = VALUES(tasks_md);
"""
        sql_lines.append(sql)

    return '\n'.join(sql_lines)

# Main
all_roles = []
for fname in FILES:
    fpath = os.path.join(DOCS_DIR, fname)
    if not os.path.exists(fpath):
        print(f"SKIP: {fname} not found")
        continue
    roles = extract_roles(fpath)
    print(f"{fname}: {len(roles)} roles extracted")
    all_roles.extend(roles)

print(f"\nTotal: {len(all_roles)} roles")

# Output SQL file
sql_output = os.path.join(SCRIPT_DIR, 'role-templates-import.sql')
with open(sql_output, 'w', encoding='utf-8') as f:
    f.write(generate_sql(all_roles))
print(f"SQL written to: {sql_output}")

# Also output JSON for programmatic import
json_output = os.path.join(SCRIPT_DIR, 'role-templates-import.json')
with open(json_output, 'w', encoding='utf-8') as f:
    json.dump(all_roles, f, ensure_ascii=False, indent=2)
print(f"JSON written to: {json_output}")
