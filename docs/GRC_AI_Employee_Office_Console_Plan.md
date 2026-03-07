# GRC → AI Employee Office Console — Architecture Plan

**Created**: 2026-03-07
**Updated**: 2026-03-07
**Status**: Under Review
**Estimated Timeline**: ~10 weeks (6 Phases)

---

## Context

WinClaw is currently designed as a personal AI assistant. GRC (Global Resource Center) serves as a central server for node management, evolution asset sharing, and the skill marketplace.

**Goal**: Transform GRC into an enterprise-grade **AI Employee Office Console**. Each connected WinClaw client can be assigned a role (Marketing, PM, Finance, Engineering, etc.) to function as either a **fully autonomous AI employee** or an **AI copilot assisting a human employee**. Multiple AI employees coordinate through the A2A protocol to achieve company-wide automation.

**Core Mechanism**: Centrally manage and distribute 8 bootstrap config files (AGENTS.md, BOOTSTRAP.md, HEARTBEAT.md, IDENTITY.md, SOUL.md, TOOLS.md, USER.md, TASKS.md) per WinClaw client via role templates. All config file content **MUST be written in English**.

---

## Key Design Principles

### 1. English-Only Config Files
All 8 bootstrap MD files MUST be written in English regardless of the company's locale. This ensures:
- Consistency across multi-national deployments
- Better LLM comprehension (English training data dominance)
- Easier auditing and standardization
- The AI employee can still communicate with users in their local language — the config files control behavior, not conversation language

### 2. Extensible Role System
The 9 built-in roles (CEO, Marketing, PM, etc.) are **starter templates only**. The system supports:
- **Custom role creation** from GRC Dashboard — any industry, any function
- **Role cloning** — duplicate an existing template and modify
- **Industry presets** — optional industry-specific template packs (Healthcare, Legal, Manufacturing, Retail, etc.)
- **No hardcoded role limit** — the `role_templates` DB table accepts any `role_id`

### 3. Dual Operating Mode: Autonomous vs Copilot

| Aspect | Autonomous Mode | Copilot Mode |
|--------|----------------|--------------|
| **Who** | Pure AI employee, no human counterpart | AI assistant paired with a human employee |
| **Decision Authority** | Acts independently within defined boundaries | Suggests/drafts, human approves/executes |
| **AGENTS.md** | "You ARE the department head" | "You ASSIST the department head" |
| **HEARTBEAT.md** | Self-driven checklist execution | Reminder/preparation for human's schedule |
| **Task Completion** | Marks tasks done autonomously | Prepares deliverables, human reviews & submits |
| **A2A Communication** | Sends/receives directly | Drafts messages, human confirms before sending |
| **Use Case** | Fully automated company operations | Augmenting existing human workforce |

The `mode` field in `role_templates` controls this distinction. The AGENTS.md template contains mode-specific instructions.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                  GRC Server (AI Office Console)           │
│                                                           │
│  ┌───────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐ │
│  │ Employee  │ │ Role      │ │ Task     │ │ A2A Relay │ │
│  │ Registry  │ │ Templates │ │ Board    │ │ Hub       │ │
│  │           │ │ (Custom+) │ │          │ │           │ │
│  └───────────┘ └───────────┘ └──────────┘ └───────────┘ │
│                                                           │
│  ┌───────────────────────────────────────────────────┐   │
│  │         Admin Dashboard (localhost:3200)            │   │
│  │ Employees │ Roles │ Task Board │ A2A Log │ Org Chart│  │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────────┘
                           │ REST API + WebSocket
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ WinClaw #1  │ │ WinClaw #2  │ │ WinClaw #3  │
    │ 🎯 PM      │ │ 📊 Marketing│ │ 💰 Finance  │
    │ [Autonomous]│ │ [Copilot]   │ │ [Autonomous] │
    │             │ │ + Human     │ │              │
    │ 8 MD files  │ │ 8 MD files  │ │ 8 MD files   │
    └──────┬──────┘ └──────┬──────┘ └──────┬───────┘
           │    A2A Protocol│               │
           └───────────────┴───────────────┘
```

---

## Phase 1: Foundation — Role Templates & TASKS.md

### 1.1 TASKS.md Schema (New 9th Bootstrap File)

```markdown
---
title: "TASKS.md"
summary: "Active task queue for this AI employee"
sync_source: "grc"
last_synced: "2026-03-07T10:00:00Z"
---

# Active Tasks

## [TASK-001] Q1 Marketing Strategy
- **priority**: critical
- **status**: in_progress
- **assigned_by**: GRC/CEO-Agent
- **deadline**: 2026-03-15
- **depends_on**: []
- **collaborators**: [agent:finance:main, agent:sales:main]
- **deliverables**:
  - marketing-strategy-q1.md
  - budget-proposal.xlsx
- **notes**: |
    Focus on new customer acquisition. Budget is 120% of last quarter.
    Budget confirmation requested from finance agent.

# Completed Tasks
<!-- Completed tasks are moved here -->
```

**File changes**: `src/agents/workspace.ts`
- Add `DEFAULT_TASKS_FILENAME = "TASKS.md"`
- Add to `VALID_BOOTSTRAP_NAMES`

### 1.2 Role Template System

#### DB Schema — `role_templates` Table

```sql
CREATE TABLE role_templates (
  id VARCHAR(50) PRIMARY KEY,            -- 'marketing', 'finance', 'custom-xyz'
  name VARCHAR(255) NOT NULL,            -- Display name
  emoji VARCHAR(10),
  description TEXT,
  department VARCHAR(100),
  industry VARCHAR(100) DEFAULT NULL,    -- NULL = universal, 'healthcare', 'retail', etc.
  mode ENUM('autonomous','copilot') DEFAULT 'autonomous',
  is_builtin BOOLEAN DEFAULT FALSE,      -- TRUE for the 8 starter templates
  -- 8 config file contents (MUST be English)
  agents_md TEXT NOT NULL,
  soul_md TEXT NOT NULL,
  identity_md TEXT NOT NULL,
  user_md TEXT NOT NULL,
  tools_md TEXT NOT NULL,
  heartbeat_md TEXT NOT NULL,
  bootstrap_md TEXT NOT NULL,
  tasks_md TEXT NOT NULL,
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Key design points:**
- `mode` field: `autonomous` or `copilot` — changes behavior instructions in AGENTS.md
- `industry` field: `NULL` = universal template, or specific industry tag
- `is_builtin`: protects the 9 starter templates from accidental deletion
- **No limit on number of roles** — Admin can create unlimited custom roles

#### 9 Built-in Starter Roles

| Role ID | Name | Emoji | Mode | Industry | Hierarchy |
|---------|------|-------|------|----------|-----------|
| `ceo` | **CEO (Chief Executive)** | 👔 | **copilot** | NULL (universal) | **Top — commands all** |
| `strategic-planner` | Strategic Planner | 🧭 | autonomous | NULL | Reports to CEO |
| `marketing` | Marketing | 📊 | autonomous | NULL | Reports to CEO/Strategy |
| `product-manager` | Product Manager | 🎯 | autonomous | NULL | Reports to CEO/Strategy |
| `finance` | Finance & Accounting | 💰 | autonomous | NULL | Reports to CEO/Strategy |
| `sales` | Sales | 🤝 | autonomous | NULL | Reports to CEO/Strategy |
| `customer-support` | Customer Support | 💬 | autonomous | NULL | Reports to PM |
| `hr` | Human Resources | 👥 | autonomous | NULL | Reports to CEO/Strategy |
| `engineering-lead` | Engineering Lead | ⚙️ | autonomous | NULL | Reports to CEO/Strategy |

**CEO is the mandatory top-level role** and defaults to **copilot mode**. It operates with full CEO authority within the AI organization — the ONLY exception is financial expenditure:
- Distributes annual/quarterly KPIs to all department roles (independently)
- Monitors company-wide execution progress (independently)
- Issues specific directives to department heads (independently)
- Makes strategic decisions, resolves conflicts, reallocates resources (independently)
- **Summarizes and reports expense-related tasks to the human CEO for approval**
- **Actual payments and financial commitments are completed by the human CEO**

> **Key principle**: The CEO AI does everything a CEO does EXCEPT spend money. All tasks involving actual financial expenditure are summarized, reported, and require explicit human CEO approval before execution. Everything else — KPI management, directives, strategy, performance reviews, cross-department coordination — is handled autonomously by the CEO AI.

These are starter templates. Admin can:
- Clone any template → modify for their needs
- Switch mode from `autonomous` to `copilot`
- Create entirely new roles (e.g., `legal`, `logistics`, `quality-assurance`)
- Create industry-specific variants (e.g., `finance-healthcare`, `sales-retail`)

#### Custom Role Examples (not built-in, created by Admin)

| Role ID | Name | Industry | Mode |
|---------|------|----------|------|
| `legal-counsel` | Legal Counsel | NULL | copilot |
| `quality-assurance` | QA Engineer | NULL | autonomous |
| `supply-chain` | Supply Chain Manager | Manufacturing | autonomous |
| `nurse-coordinator` | Nurse Coordinator | Healthcare | copilot |
| `store-manager` | Store Manager | Retail | copilot |
| `compliance-officer` | Compliance Officer | Finance | copilot |
| `content-creator` | Content Creator | Media | autonomous |
| `data-analyst` | Data Analyst | NULL | copilot |

### 1.3 Mode-Specific AGENTS.md Pattern

The AGENTS.md template uses a conditional section based on `mode`:

**Autonomous Mode** — AI IS the employee:
```markdown
## Operating Mode: Autonomous

You are a fully autonomous AI employee. You:
- Make decisions independently within your defined boundaries
- Execute tasks without human approval (unless explicitly required)
- Complete deliverables and mark tasks as done
- Communicate directly with other AI agents via A2A protocol
- Report results to your supervisor (strategic-planner or CEO)

### Decision Authority
- Budget under $${budget_limit}: Approve independently
- Budget over $${budget_limit}: Escalate to finance agent
- Strategic changes: Consult strategic-planner agent
```

**Copilot Mode** — AI ASSISTS a human:
```markdown
## Operating Mode: Copilot

You are an AI assistant working alongside a human employee (${human_name}).
You:
- Prepare drafts, analyses, and recommendations for human review
- Never execute irreversible actions without human confirmation
- Organize and prioritize the human's workload
- Draft A2A messages for human approval before sending
- Flag urgent items that need immediate human attention

### Interaction Protocol
- Present options with pros/cons, let human decide
- Pre-fill templates and forms, human reviews before submission
- Monitor deadlines and send reminders to the human
- Summarize incoming A2A messages for human review
```

---

## Phase 2: GRC Server Extensions

### 2.1 DB Schema Extensions

```sql
-- Role assignment to nodes
ALTER TABLE nodes
  ADD COLUMN role_id VARCHAR(50) DEFAULT NULL,
  ADD COLUMN role_mode ENUM('autonomous','copilot') DEFAULT NULL,
  ADD COLUMN department VARCHAR(100) DEFAULT NULL,
  ADD COLUMN config_revision INT DEFAULT 0,
  ADD COLUMN last_config_push_at TIMESTAMP DEFAULT NULL,
  -- Resolved (variable-substituted) config files
  ADD COLUMN resolved_agents_md TEXT DEFAULT NULL,
  ADD COLUMN resolved_soul_md TEXT DEFAULT NULL,
  ADD COLUMN resolved_identity_md TEXT DEFAULT NULL,
  ADD COLUMN resolved_user_md TEXT DEFAULT NULL,
  ADD COLUMN resolved_tools_md TEXT DEFAULT NULL,
  ADD COLUMN resolved_heartbeat_md TEXT DEFAULT NULL,
  ADD COLUMN resolved_bootstrap_md TEXT DEFAULT NULL,
  ADD COLUMN resolved_tasks_md TEXT DEFAULT NULL,
  ADD FOREIGN KEY (role_id) REFERENCES role_templates(id);

-- Task board (CANONICAL SCHEMA: see GRC_TaskBoard_Design_Detail.md §2.1 for full 30+ column definition)
-- Summary of key fields here; the TaskBoard doc is the authoritative source.
CREATE TABLE tasks (
  -- Identity
  id VARCHAR(50) PRIMARY KEY,               -- 'CEO-001', 'MKT-001', 'FIN-003'
  parent_task_id VARCHAR(50) DEFAULT NULL,   -- For subtasks (hierarchical tasks)
  -- Content
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category ENUM('strategic','operational','project','expense','report','collaboration') DEFAULT 'operational',
  -- Priority & Status (8-value status lifecycle)
  priority ENUM('critical','high','medium','low') DEFAULT 'medium',
  status ENUM('draft','pending','in_progress','blocked','review','approved','completed','cancelled') DEFAULT 'draft',
  -- Assignment
  assigned_node_id VARCHAR(255),
  assigned_role_id VARCHAR(50),
  assigned_by VARCHAR(255),
  owner_display_name VARCHAR(255),
  -- Timing
  deadline TIMESTAMP DEFAULT NULL,
  started_at TIMESTAMP DEFAULT NULL,
  completed_at TIMESTAMP DEFAULT NULL,
  estimated_hours DECIMAL(10,2) DEFAULT NULL,
  -- Dependencies & Collaboration
  depends_on JSON DEFAULT NULL,
  collaborators JSON DEFAULT NULL,
  blocking JSON DEFAULT NULL,
  -- Deliverables & Progress
  deliverables JSON DEFAULT NULL,
  progress_percent INT DEFAULT 0,
  progress_notes JSON DEFAULT NULL,
  -- Expense Tracking
  requires_expense_approval BOOLEAN DEFAULT FALSE,
  expense_amount DECIMAL(15,2) DEFAULT NULL,
  expense_currency VARCHAR(10) DEFAULT NULL,
  expense_purpose TEXT DEFAULT NULL,
  expense_approved_by VARCHAR(255) DEFAULT NULL,
  expense_approved_at TIMESTAMP DEFAULT NULL,
  expense_paid_at TIMESTAMP DEFAULT NULL,       -- When human CEO completes payment
  -- Concurrency Control
  version INT DEFAULT 1,                        -- Optimistic locking
  -- Metadata
  tags JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Foreign Keys
  FOREIGN KEY (assigned_node_id) REFERENCES nodes(node_id),
  FOREIGN KEY (assigned_role_id) REFERENCES role_templates(id),
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
);

-- Task progress history (append-only log)
CREATE TABLE task_progress_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(50) NOT NULL,
  reported_by VARCHAR(255) NOT NULL,
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  progress_percent INT,
  message TEXT,
  attachments JSON DEFAULT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Task comments / discussion thread
CREATE TABLE task_comments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(50) NOT NULL,
  author VARCHAR(255) NOT NULL,
  author_display_name VARCHAR(255),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Required indexes for Task Board performance
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_assigned_node ON tasks(assigned_node_id);
CREATE INDEX idx_tasks_assigned_role ON tasks(assigned_role_id);
CREATE INDEX idx_tasks_category ON tasks(category);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_expense ON tasks(requires_expense_approval, status);
CREATE INDEX idx_progress_log_task ON task_progress_log(task_id, reported_at);
CREATE INDEX idx_comments_task ON task_comments(task_id, created_at);
CREATE FULLTEXT INDEX idx_tasks_search ON tasks(title, description);

-- A2A relay message queue
CREATE TABLE a2a_relay_queue (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  from_node_id VARCHAR(255) NOT NULL,
  to_node_id VARCHAR(255) NOT NULL,
  message_type ENUM('task','chat','notification','status') DEFAULT 'chat',
  payload JSON NOT NULL,
  status ENUM('pending','delivered','failed','expired') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP DEFAULT NULL,
  expires_at TIMESTAMP DEFAULT NULL
);
```

### 2.2 API Endpoints

```
# Role template management (CRUD — unlimited custom roles)
GET    /api/v1/admin/roles                    # List all templates (filter by industry, mode)
GET    /api/v1/admin/roles/:roleId            # Template detail (all 8 files)
POST   /api/v1/admin/roles                    # Create new template
PUT    /api/v1/admin/roles/:roleId            # Update template
DELETE /api/v1/admin/roles/:roleId            # Delete (blocked for is_builtin=true)
POST   /api/v1/admin/roles/:roleId/clone      # Clone template → new custom role

# Node ↔ Role assignment
POST   /api/v1/admin/nodes/:nodeId/assign-role   # Assign role (with mode + variables)
POST   /api/v1/admin/nodes/:nodeId/unassign-role  # Remove role assignment
GET    /api/v1/admin/nodes/:nodeId/config         # Get current 8 files
PUT    /api/v1/admin/nodes/:nodeId/config/:file   # Update individual file

# Task management (CRUD)
GET    /api/v1/admin/tasks                    # List tasks with filters (see §9.2 in TaskBoard doc)
POST   /api/v1/admin/tasks                    # Create task
GET    /api/v1/admin/tasks/:taskId            # Get task detail
PUT    /api/v1/admin/tasks/:taskId            # Update task
DELETE /api/v1/admin/tasks/:taskId            # Delete task

# Task assignment & status
POST   /api/v1/admin/tasks/:taskId/assign     # Assign task to node
POST   /api/v1/admin/tasks/:taskId/unassign   # Remove assignment
PUT    /api/v1/admin/tasks/:taskId/status      # Change status

# Expense approval (human CEO actions)
GET    /api/v1/admin/tasks/expense-queue       # Pending expense approvals
POST   /api/v1/admin/tasks/:taskId/approve     # Approve expense
POST   /api/v1/admin/tasks/:taskId/reject      # Reject expense
POST   /api/v1/admin/tasks/batch-approve       # Batch approve

# Progress & comments
POST   /api/v1/admin/tasks/:taskId/progress    # Log progress update
GET    /api/v1/admin/tasks/:taskId/progress-log # Get progress history
POST   /api/v1/admin/tasks/:taskId/comments    # Add comment
GET    /api/v1/admin/tasks/:taskId/comments    # List comments

# Dashboard statistics
GET    /api/v1/admin/tasks/stats               # Overall statistics
GET    /api/v1/admin/tasks/stats/department     # Per-department stats
GET    /api/v1/admin/tasks/stats/timeline       # Timeline/burndown data

# A2A relay
POST   /a2a/relay/send                        # Send relay message
GET    /a2a/relay/inbox                       # Poll pending messages
POST   /a2a/relay/ack                         # Acknowledge delivery

# Config sync (called by WinClaw clients)
GET    /a2a/config/check                      # Check config_revision
GET    /a2a/config/pull                       # Download all 8 files
POST   /a2a/config/status                     # Report apply result

# Agent-facing task API (called by WinClaw clients)
GET    /a2a/tasks/mine                        # Get my assigned tasks
POST   /a2a/tasks/:taskId/progress            # Report progress
POST   /a2a/tasks/:taskId/status              # Update task status
POST   /a2a/tasks/:taskId/comment             # Add comment
GET    /a2a/tasks/:taskId/dependencies        # Check dependency status
POST   /a2a/tasks/request                     # Request new task creation (agent → CEO)
```

### 2.3 Role Assignment with Mode Override

When assigning a role to a node, Admin can override the template's default mode:

```
POST /api/v1/admin/nodes/{nodeId}/assign-role
{
  "role_id": "marketing",
  "mode": "copilot",          // Override: template default is "autonomous"
  "variables": {
    "employee_id": "EMP-MKT-001",
    "company_name": "Example Corp",
    "industry": "SaaS",
    "human_name": "John Smith",     // Only needed for copilot mode
    "human_title": "VP Marketing",  // Only needed for copilot mode
    "budget_limit": "5000"
  }
}
```

The server resolves templates differently based on mode:
- **autonomous**: Injects autonomous-mode AGENTS.md section
- **copilot**: Injects copilot-mode AGENTS.md section + human employee context

### 2.4 Config Distribution (Pull Model + Revision Number)

```
GRC Server                          WinClaw Client
    │                                     │
    │  ① /a2a/hello (config_revision=3)   │
    │◄────────────────────────────────────│
    │                                     │
    │  ② response: latest_revision=5      │
    │────────────────────────────────────►│
    │                                     │
    │  ③ /a2a/config/pull                 │
    │◄────────────────────────────────────│
    │                                     │
    │  ④ { revision:5, files: {...} }     │
    │────────────────────────────────────►│
    │                                     │
    │  ⑤ Client writes 8 files to workspace│
    │  ⑥ /a2a/config/status (applied=true)│
    │◄────────────────────────────────────│
```

---

## Phase 3: WinClaw Client Extensions

### 3.1 Config Sync Client

**Changes to**: `src/infra/grc-client.ts`
```typescript
async checkConfigRevision(): Promise<{ latestRevision: number }>
async pullConfig(): Promise<{ revision: number; files: Record<string, string> }>
async reportConfigStatus(revision: number, applied: boolean): Promise<void>
async getMyTasks(): Promise<Task[]>
async updateTaskStatus(taskId: string, status: string): Promise<void>
async relayMessage(toNodeId: string, payload: object): Promise<void>
async pollRelayInbox(): Promise<RelayMessage[]>
async ackRelayMessage(messageId: string): Promise<void>
```

### 3.2 Config type extension

**Changes to**: `src/config/types.winclaw.ts`
```typescript
grc?: {
  // ... existing fields ...
  employee?: {
    roleId?: string;
    roleMode?: "autonomous" | "copilot";
    department?: string;
    configRevision?: number;
  };
};
```

### 3.3 GRC Sync new phases

**Changes to**: `src/infra/grc-sync.ts`
- Phase 8: Config Revision Check → pull & write if newer
- Phase 9: Task Sync → update TASKS.md
- Phase 10: Relay Inbox Poll → route to sessions

### 3.4 A2A Relay

**New file**: `src/infra/grc-relay.ts`
- Bridge between local A2A (sessions_send) and remote A2A (GRC relay)
- Extended session key: `remote:nodeB:agent:finance:main`

---

## Phase 4: GRC Admin Dashboard Extensions

### 4.1 New Screens

| Screen | Path | Features |
|--------|------|----------|
| **Employees** | `/employees` | Node list with role, mode, status, last activity |
| **Role Templates** | `/roles` | CRUD for templates, filter by industry/mode |
| **Role Editor** | `/roles/:id/edit` | 8-file tab editor with preview |
| **Create Role** | `/roles/new` | From scratch or clone existing |
| **Role Assign** | `/employees/:nodeId/role` | Assign role + choose mode + fill variables |
| **Task Board** | `/tasks` | Kanban (Pending → In Progress → Review → Done) |
| **Task Detail** | `/tasks/:taskId` | Task detail with progress log, comments, expense info |
| **Task Create** | `/tasks/new` | Create task with assignment |
| **Expense Approvals** | `/tasks/expenses` | Human CEO expense approval queue |
| **Task Stats** | `/tasks/stats` | Department health dashboard & KPI overview |
| **Strategy Management** | `/strategy` | Company strategy input: mission, vision, objectives, budgets, KPIs (6-tab) |
| **Strategy History** | `/strategy` (panel) | Revision history with diff comparison |
| **A2A Relay Log** | `/relay` | Message send/receive history |
| **Org Chart** | `/org-chart` | Department → Role → Agent relationship diagram |

### 4.2 Role Template Editor

```
┌──────────────────────────────────────────────────────┐
│ Role Template: Marketing 📊                           │
│                                                        │
│ Mode: [Autonomous ▼]   Industry: [Universal ▼]        │
│                                                        │
│ [AGENTS.md] [SOUL.md] [IDENTITY.md] [USER.md]         │
│ [TOOLS.md] [HEARTBEAT.md] [BOOTSTRAP.md] [TASKS.md]   │
│                                                        │
│ ┌────────────────────────────────────────────────┐    │
│ │ # AGENTS.md - Marketing Department             │    │
│ │                                                │    │
│ │ ## Your Role                                   │    │
│ │ You are the head of the Marketing department.  │    │
│ │ ...                                            │    │
│ │ ⚠️ Content MUST be in English                  │    │
│ └────────────────────────────────────────────────┘    │
│                                                        │
│ [Variable Preview]  [Save]  [Clone]  [Deploy to Node]  │
└──────────────────────────────────────────────────────┘
```

### 4.3 Task Board (Kanban)

> **Detailed Task Board design**: See `GRC_TaskBoard_Design_Detail.md` for comprehensive design including task data model, lifecycle state machine, expense approval workflow, progress reporting mechanisms, all UI views (Kanban/List/Timeline/Department), and API endpoints.

```
┌─ Pending ──────┐ ┌─ In Progress ──┐ ┌─ Review ───────┐ ┌─ Done ──────────┐
│ ┌────────────┐ │ │ ┌────────────┐ │ │                │ │ ┌─────────────┐ │
│ │MKT-002     │ │ │ │MKT-001     │ │ │                │ │ │FIN-001      │ │
│ │Competitor  │ │ │ │Q1 Strategy │ │ │                │ │ │Monthly Close│ │
│ │📊 Maya    │ │ │ │📊 Maya    │ │ │                │ │ │💰 Ken      │ │
│ │[Autonomous]│ │ │ │Due: 3/15  │ │ │                │ │ │Done: 3/5   │ │
│ └────────────┘ │ │ └────────────┘ │ │                │ │ └─────────────┘ │
│ ┌────────────┐ │ │ ┌────────────┐ │ │ ┌────────────┐ │ │                 │
│ │HR-001      │ │ │ │ENG-001     │ │ │ │ENG-003  💰│ │ │                 │
│ │Hiring Plan │ │ │ │Arch Design │ │ │ │Infra Migr. │ │ │                 │
│ │👥 Hana    │ │ │ │⚙️ Taro   │ │ │ │⚙️ Taro   │ │ │                 │
│ │💰¥8M      │ │ │ │[Autonomous]│ │ │ │💰¥2M NEEDS│ │ │                 │
│ └────────────┘ │ │ └────────────┘ │ │ │CEO APPROVAL│ │ │                 │
│                │ │                │ │ └────────────┘ │ │                 │
└────────────────┘ └────────────────┘ └────────────────┘ └─────────────────┘

💰 Expense tasks awaiting human CEO approval: 2 items (¥10M)
```

**Key Task Board Features:**
- 4 views: Kanban (default), List, Timeline/Gantt, Department-grouped
- Expense tasks flagged with 💰 badge — routed to human CEO via Expense Approval Queue
- Task cards show: ID, title, assignee, progress bar, deadline, dependencies, expense badge
- CEO AI manages all non-expense tasks autonomously
- Auto-blocking when dependencies are incomplete
- Real-time WebSocket updates for live board changes

---

## Phase 5: A2A Coordination Protocol Extensions

### 5.1 Local vs Remote A2A

```
┌─────────────────────────────┐
│       WinClaw Node A        │
│  agent:pm ──A2A──► agent:eng│  ← Local A2A (existing sessions_send)
│       │                     │
│       │ Remote A2A          │
│       ▼                     │
│  GRC Relay API              │
└──────────┬──────────────────┘
           │
    GRC Server (Relay)
           │
┌──────────▼──────────────────┐
│       WinClaw Node B        │
│  agent:finance ◄── Relay    │  ← Remote A2A via GRC
└─────────────────────────────┘
```

### 5.2 Extended Session Keys

```
# Local (existing)
agent:marketing:main

# Remote (new)
remote:nodeB:agent:finance:main
```

### 5.3 Copilot Mode A2A Behavior

In copilot mode, A2A messages are handled differently:
- **Incoming**: AI drafts a response, presents to human for review
- **Outgoing**: AI prepares message, waits for human confirmation
- **Urgent**: AI flags message with `[URGENT]` tag for human attention

---

## Implementation Phases

### Phase 1 (2 weeks): Foundation
1. Add TASKS.md as 9th bootstrap file
2. DB tables: role_templates, tasks, a2a_relay_queue
3. Role template CRUD API (with clone endpoint)
4. Config distribution API (check, pull, status)

### Phase 2 (2 weeks): Role Management
5. Create 9 built-in role templates (English, both modes, including CEO)
6. Dashboard: Role template editor with mode/industry fields
7. Node role assignment API & UI (with mode override)
8. Client: config pull & workspace write

### Phase 3 (2 weeks): Task Management
9. Task CRUD API
10. Dashboard: Kanban task board
11. Client: task sync → TASKS.md auto-update
12. Task assignment flow (GRC → Node → TASKS.md)

### Phase 4 (2 weeks): A2A Relay
13. GRC relay queue API
14. Client: relay send/receive
15. Extended session keys (remote:nodeId:agent:...)
16. Dashboard: A2A communication log

### Phase 5 (1 week): Integration & Optimization
17. Org chart UI
18. AI Employee dashboard (overall KPIs)
19. Workflow templates (multi-agent coordination patterns)
20. Monitoring & alerts (task overdue, agent unresponsive)

### Phase 6 (1 week): Strategy Management
21. DB: company_strategy + company_strategy_history tables
22. Strategy module: CRUD API + Deploy cascade + buildStrategyVariables()
23. Dashboard: /strategy 6-tab screen (Profile, Short-term, Mid-term, Long-term, Budgets, KPIs)
24. resolveTemplateVariables() second pass: strategy variable injection
25. Strategic Realignment auto-task creation on deploy

> **Detailed Strategy Management design**: See `GRC_Strategy_Management_Design.md` for comprehensive design including DB schema, API endpoints, Dashboard UI, template variables, cascade flow, and auto-task structure.

---

## File Change Summary

### GRC Server (`C:\work\grc`)

| File | Change |
|---|---|
| `migrations/003_role_templates.sql` | **New** — role_templates table (with mode, industry) |
| `migrations/004_tasks.sql` | **New** — tasks, task_progress_log, task_comments tables + indexes |
| `migrations/005_a2a_relay.sql` | **New** — a2a_relay_queue table |
| `migrations/006_nodes_role.sql` | **New** — Add role/config columns to nodes (incl. role_mode) |
| `src/modules/roles/schema.ts` | **New** — Drizzle schema |
| `src/modules/roles/service.ts` | **New** — CRUD + clone + variable resolution |
| `src/modules/roles/routes.ts` | **New** — Admin API + config endpoints |
| `src/modules/tasks/schema.ts` | **New** — tasks + progress_log + comments Drizzle schema |
| `src/modules/tasks/service.ts` | **New** — Task CRUD + dependency resolution + expense workflow |
| `src/modules/tasks/routes.ts` | **New** — Admin + Agent-facing task API routes |
| `src/modules/relay/schema.ts` | **New** |
| `src/modules/relay/service.ts` | **New** |
| `src/modules/relay/routes.ts` | **New** |
| `src/modules/strategy/schema.ts` | **New** — company_strategy + history Drizzle schema |
| `src/modules/strategy/service.ts` | **New** — CRUD + deployStrategy() + buildStrategyVariables() |
| `src/modules/strategy/routes.ts` | **New** — Agent-facing strategy API (/a2a/strategy/*) |
| `src/modules/strategy/admin-routes.ts` | **New** — Admin strategy API (/api/v1/admin/strategy/*) |
| `migrations/007_company_strategy.sql` | **New** — company_strategy + history tables + nodes.assignment_variables |
| `src/modules/roles/service.ts` | **Modify** — resolveTemplateVariables() second pass for strategy vars |
| `src/modules/evolution/routes.ts` | **Modify** — hello response add config_revision, role_id |
| `src/modules/evolution/admin-routes.ts` | **Modify** — node list includes role info |

### GRC Dashboard (`C:\work\grc\dashboard`)

| File | Change |
|---|---|
| `src/pages/Employees.tsx` | **New** — Employee list with role, mode, status, task count |
| `src/pages/RoleTemplates.tsx` | **New** — Template list with industry/mode filter |
| `src/pages/RoleEditor.tsx` | **New** — 8-file tab editor (Monaco/CodeMirror) |
| `src/pages/RoleCreate.tsx` | **New** — Create/clone role |
| `src/pages/RoleAssign.tsx` | **New** — Assign role + mode override + variable form |
| `src/pages/TaskBoard.tsx` | **New** — Kanban board (default view) |
| `src/pages/TaskList.tsx` | **New** — Table/list view |
| `src/pages/TaskDetail.tsx` | **New** — Task detail with progress, comments, expense |
| `src/pages/TaskCreate.tsx` | **New** — Task creation form |
| `src/pages/ExpenseApprovalPanel.tsx` | **New** — Human CEO expense approval queue |
| `src/pages/TaskStats.tsx` | **New** — Statistics & department health dashboard |
| `src/pages/RelayLog.tsx` | **New** — A2A communication log |
| `src/pages/OrgChart.tsx` | **New** — Organization chart |
| `src/pages/strategy/Strategy.tsx` | **New** — Strategy management main screen (6-tab) |
| `src/pages/strategy/CompanyProfileTab.tsx` | **New** — Mission, Vision, Values |
| `src/pages/strategy/ShortTermTab.tsx` | **New** — Quarterly objectives + KPIs |
| `src/pages/strategy/MidTermTab.tsx` | **New** — Annual objectives |
| `src/pages/strategy/LongTermTab.tsx` | **New** — 3-5 year vision + milestones |
| `src/pages/strategy/BudgetsTab.tsx` | **New** — Department budget allocation grid |
| `src/pages/strategy/KpisTab.tsx` | **New** — Department KPI targets |
| `src/pages/strategy/StrategyHistory.tsx` | **New** — Revision history panel |
| `src/pages/strategy/StrategyDiff.tsx` | **New** — Revision diff view |
| `src/api/hooks.ts` | **Modify** — Add hooks: useRoles, useTasks, useRelay, useExpenseQueue, useStrategy, useStrategyHistory, useStrategyDeploy |
| `src/components/Sidebar.tsx` | **Modify** — Add navigation for new pages |
| `src/App.tsx` | **Modify** — Add routes for all new pages |

### WinClaw Client (`C:\work\winclaw`)

| File | Change |
|---|---|
| `src/agents/workspace.ts` | **Modify** — Add DEFAULT_TASKS_FILENAME, VALID_BOOTSTRAP_NAMES |
| `src/agents/pi-embedded-helpers/bootstrap.ts` | **Modify** — TASKS.md filtering + sanitization |
| `src/config/types.winclaw.ts` | **Modify** — Add grc.employee section (roleId, roleMode, configRevision) |
| `src/infra/grc-client.ts` | **Modify** — Add config/tasks/relay API methods |
| `src/infra/grc-connection.ts` | **Modify** — Add pullAndApplyConfig(), revision check in autoConnect |
| `src/infra/grc-sync.ts` | **Modify** — Add Phase 8 (Config Sync), Phase 9 (Task Sync), Phase 10 (Relay Poll) |
| `src/infra/grc-relay.ts` | **New** — GrcRelayService (local↔remote A2A bridge) |
| `src/agents/tools/sessions-send-tool.a2a.ts` | **Modify** — Remote A2A fallback via GRC relay |
| `src/routing/session-key.ts` | **Modify** — Parse remote: prefix for cross-node sessions |

---

## Template Variable Reference

### Core Variables (Required for all roles)

| Variable | Description | Example |
|----------|-------------|---------|
| `${employee_id}` | AI Employee ID | `EMP-MKT-001` |
| `${employee_name}` | AI Employee display name | `Maya` |
| `${company_name}` | Company name | `Example Corp` |
| `${industry}` | Industry | `SaaS` |
| `${department}` | Department name | `Marketing` |
| `${timezone}` | Operating timezone | `Asia/Tokyo` |
| `${language}` | Communication language | `Japanese` |
| `${fiscal_year_start}` | Fiscal year start month | `April` |

### Copilot Mode Variables (Required when mode=copilot)

| Variable | Description | Example |
|----------|-------------|---------|
| `${human_name}` | Human partner name | `John Smith` |
| `${human_title}` | Human partner title | `VP Marketing` |
| `${human_email}` | Human partner email | `john@example.com` |
| `${human_schedule}` | Human's working hours | `9:00-18:00 JST, Mon-Fri` |

### System Variables (auto-resolved)

| Variable | Description | Example |
|----------|-------------|---------|
| `${mode}` | Operating mode (from assignment) | `autonomous` or `copilot` |

### Role-Specific Variables

| Variable | Description | Example | Used By |
|----------|-------------|---------|---------|
| `${budget_limit}` | Spending authority (USD) | `5000` | Finance, Marketing, HR |
| `${currency}` | Primary currency | `JPY` | Finance, CEO |
| `${annual_revenue_target}` | Annual revenue target | `$10M` | CEO |
| `${fiscal_year_end}` | Fiscal year end date | `2027-03-31` | CEO, Finance |
| `${employee_count}` | Total employee count | `50` | CEO, HR |
| `${tech_stack}` | Tech stack | `TypeScript, React` | Engineering |
| `${dev_count}` | Engineering team size | `15` | Engineering |
| `${cloud_provider}` | Cloud infrastructure | `AWS` | Engineering |
| `${repo_list}` | Git repositories | `winclaw, grc` | Engineering |
| `${product_name}` | Product name | `WinClaw` | PM, Support, Engineering |
| `${monthly_target}` | Monthly sales target | `$50000` | Sales |
| `${territory}` | Sales territory | `North America` | Sales |
| `${large_deal_threshold}` | Large deal limit (CEO approval) | `$100000` | Sales |
| `${sla_hours}` | SLA response time | `4` | Customer Support |
| `${support_hours}` | Support operating hours | `9:00-18:00 JST` | Customer Support |
| `${hiring_budget}` | Quarterly hiring budget | `$50000` | HR |
| `${reporting_to}` | Supervisor role | `CEO` | All except CEO |
| `${annual_plan_url}` | Annual plan location | `workspace/plans/2026.md` | CEO, Strategy |
| `${company_values}` | Company values/mission | `Innovation, Trust, Speed` | All |
| `${legal_jurisdiction}` | Legal jurisdiction | `Japan` | Finance, HR |

### Strategy Variables (auto-resolved from company_strategy table)

| Variable | Description | Example | Used By |
|----------|-------------|---------|---------|
| `${company_mission}` | Company mission statement | `To revolutionize...` | All roles |
| `${company_vision}` | Company vision | `Global leader in...` | All roles |
| `${company_values}` | Company core values (**overrides static var**) | `Innovation, Trust, Speed` | All roles |
| `${company_strategy_summary}` | Full strategy summary | (auto-generated Markdown) | CEO, Strategic Planner |
| `${current_quarter_goals}` | Current quarter objectives | (Markdown) | All roles |
| `${annual_targets}` | Annual revenue & goals | (Markdown) | CEO, Strategic Planner, Finance |
| `${long_term_vision}` | 3-5 year vision & milestones | (Markdown) | CEO, Strategic Planner |
| `${department_budget}` | This department's budget | `Annual: $500K \| Q1: $150K...` | Each department role |
| `${department_kpis}` | This department's KPIs | `MQL: 1000/quarter...` | Each department role |
| `${strategic_priorities}` | Ranked priority list | (Markdown) | CEO, Strategic Planner |
| `${strategy_revision}` | Strategy version number | `5` | All roles |

> **Strategy variable details**: See `GRC_Strategy_Management_Design.md` §4 for variable resolution mechanics, role-based injection rules, and the second-pass resolution in `resolveTemplateVariables()`.

> **Complete variable reference**: See `GRC_Role_Templates_All_8_Roles.md` §Variable Reference for the full canonical list of all template variables used across all 9 roles.

**Note**: Variables are resolved in two passes during role assignment:
1. **Pass 1 (static)**: Role assignment variables (employee_id, company_name, etc.) — see Config Distribution §3-4
2. **Pass 2 (strategy)**: Live strategy data from `company_strategy` table — see `GRC_Strategy_Management_Design.md` §5

---

## Operational Design Notes

### 1. Agent Offline Handling & Task Reassignment

When a WinClaw node goes offline (no heartbeat/sync for configurable threshold, default 30 min):

1. **Detection**: GRC detects offline via `last_seen_at` timestamp in nodes table
2. **Task Flagging**: All `in_progress` tasks on that node are flagged with `⚠️ Agent Offline` in Dashboard
3. **Notification**: CEO AI is notified via A2A relay: "Node X (role Y) is offline. N tasks affected."
4. **Reassignment Option**: GRC Admin or CEO AI can reassign tasks to another node with the same role
5. **Recovery**: When node comes back online, it syncs and receives updated TASKS.md (reassigned tasks removed, remaining tasks intact)

```
POST /api/v1/admin/tasks/:taskId/reassign
{
  "new_node_id": "winclaw-005",
  "reason": "Original node offline for 2+ hours"
}
```

### 2. Circular Dependency Detection

Before accepting `depends_on` values, the system performs a cycle check:

```typescript
async function detectCircularDependency(taskId: string, dependsOn: string[]): Promise<boolean> {
  // BFS/DFS from each dependency → check if any path leads back to taskId
  const visited = new Set<string>();
  const queue = [...dependsOn];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) return true; // Circular!
    if (visited.has(current)) continue;
    visited.add(current);
    const task = await getTask(current);
    if (task?.depends_on) queue.push(...task.depends_on);
  }
  return false;
}
```

If circular dependency is detected → API returns 400 error with explanation.

### 3. Concurrent Update Protection (Optimistic Locking)

Tasks use a `version` column for optimistic locking:

```
PUT /api/v1/admin/tasks/:taskId
{
  "status": "completed",
  "version": 3  // Must match current DB version
}

// If version mismatch → 409 Conflict
// Client must re-fetch and retry
```

This prevents two agents from simultaneously updating the same task with conflicting changes.

### 4. RBAC for Task Operations

Task operations are restricted by role:

| Operation | GRC Admin | Human CEO | CEO AI | Assigned Agent | Other Agent |
|-----------|-----------|-----------|--------|---------------|-------------|
| Create task | ✅ | ✅ | ✅ | ✅ (subtasks only) | ❌ |
| Assign task | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update own task status | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update other's task | ✅ | ✅ | ✅ (CEO oversight) | ❌ | ❌ |
| Approve expense | ❌ | ✅ | ❌ (recommend only) | ❌ | ❌ |
| Delete task | ✅ | ✅ | ✅ (non-expense) | ❌ | ❌ |
| Add comment | ✅ | ✅ | ✅ | ✅ | ✅ (collab only) |
| View all tasks | ✅ | ✅ | ✅ | Own + collaborating | Own + collaborating |

### 5. TASKS.md Content Sanitization

Since TASKS.md content is injected into the AI agent's system prompt, sanitization is critical:

- **Strip executable patterns**: Remove any `<!-- -->` HTML comments, `<script>`, code fences with shell commands
- **Length limit**: TASKS.md is capped at 20KB per the bootstrap file budget (workspace.ts character budget)
- **Field validation**: Task notes and descriptions are validated for max length (2000 chars each)
- **Character filtering**: Strip control characters (except newlines) from all text fields
- **Template variable isolation**: `${xxx}` patterns in task notes are escaped to prevent variable injection

### 6. WebSocket Real-Time Updates

The Task Board Dashboard uses WebSocket for live updates:

```
ws://localhost:3200/ws/tasks

// Client subscribes:
{ "type": "subscribe", "channels": ["tasks", "expense-queue"] }

// Server pushes on any task change:
{ "type": "task_updated", "task": { id: "MKT-001", status: "completed", ... } }
{ "type": "expense_pending", "count": 3, "total": "¥10.5M" }
{ "type": "task_created", "task": { ... } }
```

Fallback: Server-Sent Events (SSE) at `GET /api/v1/admin/tasks/stream` for environments where WebSocket is unavailable.

### 7. Sync Frequency & Real-Time Gap

Default sync interval is 4 hours, but for Task Board responsiveness:
- **Config sync** (role files): 4-hour interval is acceptable (changes rarely)
- **Task sync**: Recommended every 15-30 minutes for active AI employees
- **A2A relay poll**: Every 5 minutes (or use WebSocket push when available)
- **On-demand sync**: Agents can trigger immediate sync via `POST /a2a/sync/now`

The `syncIntervalMs` in WinClaw config should be configurable per-node from GRC Admin.
