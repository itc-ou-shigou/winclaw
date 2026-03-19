#!/usr/bin/env python3
"""Add standard GRC sections to all role templates in Part1-Part3 docs."""
import re
import sys

TOOLS_ADDITION = """
## GRC Platform Tools (Fixed)
- Meetings: ALWAYS use GRC meetings for 2+ agent discussions
- Expense Requests: ALL spending through GRC task system (category="expense")
- Task Management: grc_task, grc_task_update, grc_task_complete, grc_task_accept, grc_task_reject
- A2A Communication: sessions_send (direct), web_fetch (API calls)

## Community Forum (A2A)
- POST /a2a/community/post — share knowledge, achievements, challenges
- GET /a2a/community/feed — read team updates
- Weekly posting minimum required

## Evolution Network (GEP Protocol)
- Search before solving: grc_assets search_query="error keywords"
- Register Gene: problem pattern with signals_match + strategy (mandatory fields)
- Register Capsule: execution record with gene_asset_id + outcome
- Vote: POST /a2a/evolution/vote { asset_id, vote: "upvote"|"downvote" }
"""

AGENTS_ADDITION = """
## Communication Channel Guide
- Visible to all agents? → Community Forum post
- Private or urgent? → grc_relay_send (Direct Message)
- 2+ agents coordination needed? → GRC Meeting

## Community Forum (MANDATORY)
- Post weekly: achievements, learnings, challenges, questions
- Read and reply to peer posts regularly
- Channels: general, evolution-showcase, department-specific
- Minimum: 1 post/week

## Evolution Network (MANDATORY)
- Before solving a new problem: search existing Gene/Capsule first
- After solving: register Gene (problem pattern) + Capsule (solution record)
- Minimum: 1 capsule/month
- Vote on useful Gene/Capsule from other agents
"""

HEARTBEAT_ADDITION = """
## Daily (09:00)
- [ ] Check inbox and pending tasks
- [ ] Review assigned work priority
- [ ] Monitor key metrics

## Weekly (Monday 10:00)
- [ ] Post to Community Forum (achievements/learnings)
- [ ] Review Evolution Network for useful Gene/Capsule
- [ ] Check peer posts and reply

## Monthly (1st business day)
- [ ] Publish at least 1 Capsule to Evolution Network
- [ ] Review department KPIs and report to supervisor
- [ ] Update roadmap/backlog priorities
"""

def update_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Count roles by finding "#### TOOLS.md" occurrences
    tools_count = content.count('#### TOOLS.md')
    agents_count = content.count('#### AGENTS.md')
    heartbeat_count = content.count('#### HEARTBEAT.md')

    print(f"  Found: {tools_count} TOOLS.md, {agents_count} AGENTS.md, {heartbeat_count} HEARTBEAT.md sections")

    # Strategy: For each role's TOOLS.md section, find the closing ``` and insert before it
    # Pattern: #### TOOLS.md\n```markdown\n...\n```
    # We need to find the LAST ``` before the next #### or ## section

    def add_to_section(content, section_name, addition):
        """Add content before the closing ``` of each section."""
        # Find all occurrences of #### {section_name}
        pattern = re.compile(
            r'(#### ' + re.escape(section_name) + r'\s*\n```(?:markdown)?\n)(.*?)(```)',
            re.DOTALL
        )

        def replacer(match):
            prefix = match.group(1)
            body = match.group(2)
            closing = match.group(3)

            # Check if addition already exists
            if 'GRC Platform Tools' in body and 'Evolution Network' in body:
                return match.group(0)  # Already has it

            return prefix + body.rstrip() + '\n' + addition.strip() + '\n' + closing

        new_content, count = pattern.subn(replacer, content)
        return new_content, count

    # Add to TOOLS.md sections
    content, tools_updated = add_to_section(content, 'TOOLS.md', TOOLS_ADDITION)
    print(f"  Updated {tools_updated} TOOLS.md sections")

    # Add to AGENTS.md sections
    content, agents_updated = add_to_section(content, 'AGENTS.md', AGENTS_ADDITION)
    print(f"  Updated {agents_updated} AGENTS.md sections")

    # Add to HEARTBEAT.md sections
    content, heartbeat_updated = add_to_section(content, 'HEARTBEAT.md', HEARTBEAT_ADDITION)
    print(f"  Updated {heartbeat_updated} HEARTBEAT.md sections")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

    total = tools_updated + agents_updated + heartbeat_updated
    print(f"  Total: {total} sections updated")
    return total

files = [
    'docs/Role_Templates_Part1_Engineering_Design_Testing_Support.md',
    'docs/Role_Templates_Part2_Marketing_Sales_Product_PM.md',
    'docs/Role_Templates_Part2_Data_Business_Operations.md',
    'docs/Role_Templates_Part3_GameDev_Spatial_Specialized.md',
]

total_all = 0
for f in files:
    import os
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), f)
    print(f'\nProcessing: {f}')
    try:
        total_all += update_file(path)
    except Exception as e:
        print(f'  ERROR: {e}')

print(f'\n=== Done: {total_all} total sections updated across {len(files)} files ===')
