---
name: clawteam-dev
description: >
  This skill should be used when the user asks to "run e2e test", "test clawteam",
  "end-to-end test", "test agent team", "verify clawteam works", "dev test", or wants
  to validate the full ClawTeam lifecycle. Runs a complete end-to-end test: cleanup →
  create team → create tasks with dependencies → spawn agents → wait for completion →
  verify results → cleanup.
version: 0.1.0
---

# ClawTeam End-to-End Test

This skill runs a full lifecycle test of ClawTeam: cleanup residual state, create a team
with tasks and dependency chains, spawn real Claude agents in tmux, wait for all tasks to
complete, verify results, and clean up.

## Prerequisites

- ClawTeam installed (`pip install -e .` from the ClawTeam repo)
- `tmux` available
- `claude` CLI available
- Current directory is the ClawTeam git repo (for worktree isolation)

## Test Procedure

Follow these steps **exactly in order**. Run each bash block and verify the expected output
before proceeding to the next step.

### Step 1: Cleanup ALL Previous State

Remove **all** residual clawteam teams, worktrees, tmux sessions, and branches from any prior runs.
This ensures a clean slate regardless of what team names were used before or if a previous test crashed.

```bash
# 1. Kill ALL clawteam tmux sessions
for sess in $(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^clawteam-'); do
  tmux kill-session -t "$sess" 2>/dev/null
done
echo "tmux sessions cleaned"

# 2. Remove ALL clawteam worktrees
for wt in $(git worktree list --porcelain | grep 'worktree.*/\.clawteam/' | awk '{print $2}'); do
  git worktree remove --force "$wt" 2>/dev/null
done
echo "worktrees cleaned"

# 3. Delete ALL clawteam branches
for br in $(git branch --list 'clawteam/*' | tr -d ' +'); do
  git branch -D "$br" 2>/dev/null
done
echo "branches cleaned"

# 4. Remove all team/task/workspace data (preserve config.json)
rm -rf ~/.clawteam/teams/ ~/.clawteam/tasks/ ~/.clawteam/workspaces/ ~/.clawteam/inboxes/ ~/.clawteam/events/ ~/.clawteam/plans/
echo "data cleaned"

# 5. Verify clean state
echo "=== Verification ==="
git worktree list
git branch --list 'clawteam/*' | grep . || echo "OK: no clawteam branches"
tmux list-sessions 2>&1 | grep '^clawteam-' || echo "OK: no clawteam tmux sessions"
ls ~/.clawteam/ 2>/dev/null
```

**Expected**: Only the main worktree remains, no clawteam branches, no clawteam tmux sessions,
`~/.clawteam/` contains only `config.json`.

### Step 2: Set Leader Identity

```bash
export CLAWTEAM_AGENT_ID="e2e-leader-001"
export CLAWTEAM_AGENT_NAME="leader"
export CLAWTEAM_AGENT_TYPE="leader"
```

These env vars MUST be set for all subsequent commands in this test.

### Step 3: Create Team

```bash
clawteam team spawn-team e2e-test -d "End-to-end test team" -n leader
```

**Expected**: `OK Team 'e2e-test' created`

### Step 4: Create Tasks with Dependencies

Create 3 tasks: 2 independent tasks and 1 dependent task that is blocked until both complete.

```bash
T1=$(clawteam --json task create e2e-test "Implement feature A" -o worker1 -d "Add a hello() function to a new file hello.py" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
T2=$(clawteam --json task create e2e-test "Implement feature B" -o worker2 -d "Add a goodbye() function to a new file goodbye.py" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
T3=$(clawteam --json task create e2e-test "Write tests" -o worker3 -d "Write pytest tests for hello.py and goodbye.py" --blocked-by "$T1,$T2" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "Tasks created: T1=$T1 T2=$T2 T3=$T3"
```

**Expected**: Three task IDs printed. Then verify:

```bash
clawteam task list e2e-test
```

**Expected**: worker1 and worker2 tasks are `pending`, worker3 task is `blocked`.

### Step 5: Spawn Agents

Spawn 3 agents. Each gets its own git worktree and tmux window.

```bash
clawteam spawn --team e2e-test --agent-name worker1 \
  --task "Create hello.py with a hello() function that returns 'Hello, World!'. When done, mark your task as completed and send a summary to leader."

clawteam spawn --team e2e-test --agent-name worker2 \
  --task "Create goodbye.py with a goodbye() function that returns 'Goodbye, World!'. When done, mark your task as completed and send a summary to leader."

clawteam spawn --team e2e-test --agent-name worker3 \
  --task "Write pytest tests in test_all.py for hello.py (hello function) and goodbye.py (goodbye function). When done, mark your task as completed and send a summary to leader."
```

**Expected**: Each prints `OK Agent '<name>' spawned in tmux (clawteam-e2e-test:<name>)` with a workspace path.

### Step 6: Verify Team State

```bash
clawteam team status e2e-test
clawteam board show e2e-test
git worktree list
tmux list-windows -t clawteam-e2e-test
```

**Expected**:
- 4 members (leader + 3 workers)
- Board shows 2 pending, 1 blocked tasks
- 3 worktrees under `~/.clawteam/workspaces/e2e-test/`
- 3 tmux windows

### Step 7: Wait for All Tasks to Complete

Block until all agents finish. Timeout 10 minutes, poll every 5 seconds.

```bash
clawteam task wait e2e-test --timeout 600 --poll-interval 5
```

**Expected**:
- Progress updates as tasks complete (e.g., `1/3 tasks completed`)
- Messages from workers displayed as they arrive
- Final line: `All 3 tasks completed!`
- Exit code 0

### Step 8: Verify Results

```bash
# All tasks should be completed
clawteam task list e2e-test

# Board should show 3 completed, 0 pending/blocked
clawteam board show e2e-test

# Read any remaining inbox messages
clawteam inbox receive e2e-test
```

**Expected**:
- All 3 tasks show status `completed`
- Board shows 3 in COMPLETED column
- Messages from workers summarizing their work

### Step 9: Cleanup

Reuse the same full cleanup from Step 1 to remove everything created during this test.

```bash
# Kill ALL clawteam tmux sessions
for sess in $(tmux list-sessions -F '#{session_name}' 2>/dev/null | grep '^clawteam-'); do
  tmux kill-session -t "$sess" 2>/dev/null
done

# Remove ALL clawteam worktrees
for wt in $(git worktree list --porcelain | grep 'worktree.*/\.clawteam/' | awk '{print $2}'); do
  git worktree remove --force "$wt" 2>/dev/null
done

# Delete ALL clawteam branches
for br in $(git branch --list 'clawteam/*' | tr -d ' +'); do
  git branch -D "$br" 2>/dev/null
done

# Remove all team/task/workspace data (preserve config.json)
rm -rf ~/.clawteam/teams/ ~/.clawteam/tasks/ ~/.clawteam/workspaces/ ~/.clawteam/inboxes/ ~/.clawteam/events/ ~/.clawteam/plans/

echo "E2E test cleanup complete"
```

**Expected**: `E2E test cleanup complete`

### Step 10: Final Verification

```bash
git worktree list | grep -v '^\/' | head -1  # should show only main
git branch --list 'clawteam/*' | grep . || echo "OK: no clawteam branches"
tmux list-sessions 2>&1 | grep '^clawteam-' || echo "OK: no clawteam tmux sessions"
ls ~/.clawteam/teams/ 2>&1 | grep -q "No such file" && echo "OK: no team data"
ls ~/.clawteam/tasks/ 2>&1 | grep -q "No such file" && echo "OK: no task data"
ls ~/.clawteam/workspaces/ 2>&1 | grep -q "No such file" && echo "OK: no workspace data"
```

**Expected**: All lines start with `OK:`.

## Test Variants

### With P2P Transport

Add `--transport p2p` and `export CLAWTEAM_TRANSPORT=p2p` before Step 3 to test ZeroMQ direct messaging with file fallback. The rest of the steps remain the same.

### With subprocess Backend

Replace `clawteam spawn` with `clawteam spawn subprocess claude` to test the subprocess backend instead of tmux. Note: `board attach` and tmux verification steps won't apply.

## What This Test Validates

| Component | Validated |
|-----------|-----------|
| `team spawn-team` | Team creation with leader |
| `task create --blocked-by` | Task dependency chains |
| `spawn` (tmux backend) | Agent process launch with worktree isolation |
| Identity propagation | Env vars passed to sub-agents |
| Agent coordination | Workers update task status and send messages to leader |
| Auto-unblock | Blocked task unblocked when dependencies complete |
| `task wait` | Progress tracking, inbox drain, completion detection |
| `inbox send/receive` | Point-to-point messaging between agents |
| `board show` | Kanban board rendering |
| `workspace` (auto) | Git worktree creation and isolation |
| Cleanup | Worktree removal, branch deletion, data cleanup |
