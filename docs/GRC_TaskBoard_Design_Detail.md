# GRC Task Board — Detailed Design Document

**Created**: 2026-03-07
**Updated**: 2026-03-07 (Rev.2 — added §15 Edge Cases, optimistic locking, RBAC, sanitization)
**Status**: Under Review
**Related**: GRC_AI_Employee_Office_Console_Plan.md, GRC_Role_Templates_All_8_Roles.md, GRC_Config_Distribution_Detail.md, GRC_Strategy_Management_Design.md

---

## 1. Overview

The Task Board is one of GRC's **core features** — the central hub for managing, tracking, and coordinating work across all AI employees. It serves as the bridge between the human CEO's strategic objectives and the execution by individual AI department agents.

### Core Functions
1. **Task Lifecycle Management** — Create, assign, track, review, and complete tasks
2. **Progress Visibility** — Real-time status of all tasks across all departments
3. **Cross-Department Coordination** — Manage dependencies and collaboration between roles
4. **CEO AI Oversight** — CEO AI independently manages all tasks; human CEO sees expense approvals
5. **Expense Tracking Integration** — Flag tasks requiring actual financial expenditure (human CEO approval needed)
6. **Automated Progress Reporting** — AI agents report progress via A2A → Task Board updates automatically

---

## 2. Task Data Model

### 2.1 Task Schema (Enhanced)

```sql
CREATE TABLE tasks (
  -- Identity
  id VARCHAR(50) PRIMARY KEY,               -- 'CEO-001', 'MKT-001', 'FIN-003'
  parent_task_id VARCHAR(50) DEFAULT NULL,   -- For subtasks (hierarchical tasks)

  -- Content
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category ENUM(
    'strategic',        -- Company-level strategic initiatives
    'operational',      -- Day-to-day department operations
    'project',          -- Multi-step projects with deliverables
    'expense',          -- Tasks requiring budget/payment (flagged for human CEO)
    'report',           -- Periodic reporting tasks
    'collaboration'     -- Cross-department joint tasks
  ) DEFAULT 'operational',

  -- Priority & Status
  priority ENUM('critical','high','medium','low') DEFAULT 'medium',
  status ENUM(
    'draft',            -- Created but not yet assigned
    'pending',          -- Assigned, waiting to start
    'in_progress',      -- Actively being worked on
    'blocked',          -- Waiting on dependency or approval
    'review',           -- Deliverables submitted, awaiting review
    'approved',         -- Reviewed and approved (for expense tasks: human CEO approved)
    'completed',        -- Done
    'cancelled'         -- Cancelled
  ) DEFAULT 'draft',

  -- Assignment
  assigned_node_id VARCHAR(255),             -- WinClaw node assigned to
  assigned_role_id VARCHAR(50),              -- Role of assignee (marketing, finance, etc.)
  assigned_by VARCHAR(255),                  -- Who created: 'human-ceo', 'agent:ceo:main', 'grc-admin'
  owner_display_name VARCHAR(255),           -- e.g., '📊 Maya (Marketing)'

  -- Timing
  deadline TIMESTAMP DEFAULT NULL,
  started_at TIMESTAMP DEFAULT NULL,
  completed_at TIMESTAMP DEFAULT NULL,
  estimated_hours DECIMAL(10,2) DEFAULT NULL,

  -- Dependencies & Collaboration
  depends_on JSON DEFAULT NULL,              -- ["MKT-001", "FIN-002"]
  collaborators JSON DEFAULT NULL,           -- ["agent:finance:main", "agent:sales:main"]
  blocking JSON DEFAULT NULL,                -- Tasks that this task blocks

  -- Deliverables & Progress
  deliverables JSON DEFAULT NULL,            -- [{"name": "report.md", "status": "pending"}]
  progress_percent INT DEFAULT 0,            -- 0-100
  progress_notes JSON DEFAULT NULL,          -- Array of timestamped progress entries

  -- Expense Tracking (for category='expense')
  requires_expense_approval BOOLEAN DEFAULT FALSE,
  expense_amount DECIMAL(15,2) DEFAULT NULL,
  expense_currency VARCHAR(10) DEFAULT NULL,  -- 'JPY', 'USD', etc.
  expense_purpose TEXT DEFAULT NULL,
  expense_approved_by VARCHAR(255) DEFAULT NULL,  -- 'human-ceo' when approved
  expense_approved_at TIMESTAMP DEFAULT NULL,
  expense_paid_at TIMESTAMP DEFAULT NULL,        -- When human CEO completes actual payment

  -- Concurrency Control
  version INT DEFAULT 1,                         -- Optimistic locking (incremented on each update)

  -- Metadata
  tags JSON DEFAULT NULL,                    -- ["q1", "urgent", "customer-facing"]
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
  reported_by VARCHAR(255) NOT NULL,         -- 'agent:marketing:main', 'human-ceo', 'grc-admin'
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  progress_percent INT,
  message TEXT,                              -- Progress description
  attachments JSON DEFAULT NULL,             -- ["report-draft-v1.md", "analysis.xlsx"]
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Task comments / discussion thread
CREATE TABLE task_comments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(50) NOT NULL,
  author VARCHAR(255) NOT NULL,              -- 'agent:ceo:main', 'human-ceo', 'agent:finance:main'
  author_display_name VARCHAR(255),          -- '👔 CEO AI', '💰 Ken (Finance)'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

### 2.2 Task ID Convention

Task IDs follow a department prefix convention for easy identification:

| Prefix | Department | Example |
|--------|-----------|---------|
| `CEO-` | CEO / Executive | `CEO-001` |
| `MKT-` | Marketing | `MKT-001` |
| `PM-` | Product Manager | `PM-001` |
| `STR-` | Strategic Planning | `STR-001` |
| `FIN-` | Finance | `FIN-001` |
| `SLS-` | Sales | `SLS-001` |
| `CS-` | Customer Support | `CS-001` |
| `HR-` | HR | `HR-001` |
| `ENG-` | Engineering | `ENG-001` |
| `GEN-` | General / Cross-department | `GEN-001` |

Auto-increment per prefix: `MKT-001`, `MKT-002`, `MKT-003`, ...

---

## 3. Task Lifecycle

### 3.1 State Machine

```
                   ┌──────────────────────────────────────────────┐
                   │                                              │
    ┌───────┐   ┌──▼────┐   ┌───────────┐   ┌─────────┐   ┌─────▼─────┐
    │ Draft │──►│Pending│──►│In Progress│──►│ Review  │──►│ Completed │
    └───────┘   └───┬───┘   └─────┬─────┘   └────┬────┘   └───────────┘
                    │             │                │
                    │        ┌────▼────┐           │
                    │        │ Blocked │           │
                    │        └────┬────┘           │
                    │             │                │
                    ▼             ▼                ▼
               ┌──────────┐  (unblock)       ┌─────────┐
               │Cancelled │  ───────►        │Approved │──► Completed
               └──────────┘  In Progress     └─────────┘
                                              (expense tasks only:
                                               human CEO approval)
```

### 3.2 State Transitions

| From | To | Trigger | Who Can Do It |
|------|-----|---------|---------------|
| `draft` | `pending` | Admin assigns task to a node | GRC Admin, CEO AI |
| `pending` | `in_progress` | Agent starts working | Assigned agent |
| `in_progress` | `blocked` | Waiting on dependency or input | Assigned agent |
| `blocked` | `in_progress` | Dependency resolved | Assigned agent, system (auto) |
| `in_progress` | `review` | Agent submits deliverables | Assigned agent |
| `review` | `approved` | Reviewer accepts (expense tasks → human CEO) | CEO AI, Human CEO |
| `review` | `in_progress` | Reviewer requests changes | CEO AI, Human CEO |
| `approved` | `completed` | Final completion | System (auto), CEO AI |
| `review` | `completed` | Non-expense tasks can skip approval | CEO AI |
| Any | `cancelled` | Task no longer needed | GRC Admin, CEO AI, Human CEO |

### 3.3 Expense Task Special Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    EXPENSE TASK FLOW                              │
│                                                                  │
│  Department Agent                CEO AI              Human CEO   │
│       │                           │                      │       │
│  ① Creates task with             │                      │       │
│     requires_expense_approval    │                      │       │
│     = true                       │                      │       │
│       │                           │                      │       │
│  ② Works on task                 │                      │       │
│     (preparation, planning)      │                      │       │
│       │                           │                      │       │
│  ③ Submits to Review             │                      │       │
│       │──────────────────────────►│                      │       │
│       │                           │                      │       │
│       │                     ④ CEO AI reviews,           │       │
│       │                        validates cost,           │       │
│       │                        adds to Expense Report    │       │
│       │                           │                      │       │
│       │                     ⑤ Presents Expense           │       │
│       │                        Approval Report           │       │
│       │                           │─────────────────────►│       │
│       │                           │                      │       │
│       │                           │              ⑥ Human CEO     │
│       │                           │                 reviews,     │
│       │                           │                 approves     │
│       │                           │◄─────────────────────│       │
│       │                           │                      │       │
│       │                     ⑦ CEO AI marks              │       │
│       │                        task "approved"           │       │
│       │◄──────────────────────────│                      │       │
│       │                           │                      │       │
│  ⑧ Agent executes               │              ⑨ Human CEO     │
│     (non-payment parts)          │                 completes     │
│       │                           │                 actual        │
│       │                           │                 payment       │
│       │                           │                      │       │
│  ⑩ Task completed               │                      │       │
│                                   │                      │       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Progress Reporting Mechanism

### 4.1 How AI Agents Report Progress

AI agents report progress through **three channels**:

#### Channel 1: TASKS.md Sync (Automatic)
- Each agent's TASKS.md is synced between GRC and the WinClaw workspace
- When an agent updates task status locally → next GRC sync pushes changes
- GRC parses the TASKS.md content and updates the tasks DB accordingly

```
Agent updates TASKS.md locally
    ↓
GRC Sync (every 4 hours or on-demand)
    ↓
POST /a2a/tasks/:taskId/update
    {
      "status": "in_progress",
      "progress_percent": 60,
      "message": "Completed competitor analysis for 3 of 5 targets",
      "deliverables": [
        {"name": "competitor-analysis-partial.md", "status": "in_progress"}
      ]
    }
    ↓
GRC updates tasks table + task_progress_log
    ↓
Dashboard reflects new status in real-time
```

#### Channel 2: A2A Progress Report (Proactive)
- Agents send structured progress reports via A2A protocol to CEO AI
- CEO AI aggregates and presents to human CEO

```markdown
## A2A Progress Report Format

From: agent:marketing:main (📊 Maya)
To: agent:ceo:main (👔 CEO AI)
Type: status

### Progress Update — MKT-001: Q1 Marketing Strategy

**Status**: In Progress (60% complete)
**Key Accomplishments**:
- Completed competitor analysis for top 3 competitors
- Drafted initial campaign framework
- Requested budget data from finance agent

**Blockers**:
- Waiting for FIN-003 (Q1 budget allocation) to be completed

**Next Steps**:
- Complete remaining 2 competitor analyses
- Finalize campaign budget proposal
- Present strategy draft for CEO review

**Estimated Completion**: 2026-03-14 (on track)
```

#### Channel 3: HEARTBEAT-Driven Reports (Scheduled)
- Each role's HEARTBEAT.md defines reporting schedules
- Reports are automatically generated and submitted at specified intervals

| Role | Reporting Frequency | Report To |
|------|-------------------|-----------|
| All roles | Weekly (Monday) | CEO AI → Human CEO |
| Finance | Daily (expense summary) | CEO AI → Human CEO |
| Sales | Daily (pipeline update) | CEO AI |
| Marketing | Weekly (campaign metrics) | CEO AI |
| Engineering | Weekly (sprint progress) | Product Manager + CEO AI |
| Customer Support | Daily (ticket summary) | Product Manager + CEO AI |
| HR | Bi-weekly | CEO AI |
| Strategic Planner | Monthly | CEO AI → Human CEO |

### 4.2 Progress Report API

```
# Agent reports progress
POST /a2a/tasks/:taskId/progress
{
  "progress_percent": 60,
  "status": "in_progress",
  "message": "Completed competitor analysis for 3 of 5 targets",
  "deliverables_update": [
    {"name": "competitor-analysis-partial.md", "status": "in_progress"},
    {"name": "campaign-framework-v1.md", "status": "completed"}
  ],
  "blockers": ["Waiting for FIN-003"],
  "estimated_completion": "2026-03-14"
}

# Response
{
  "success": true,
  "log_id": 42,
  "task": { ... updated task object ... }
}
```

### 4.3 Auto-Generated Progress Summary (CEO AI)

CEO AI automatically generates company-wide progress summaries:

```markdown
## Weekly Progress Summary — Week of 2026-03-03

### Company KPI Dashboard
| KPI | Target | Current | Status |
|-----|--------|---------|--------|
| Revenue | ¥50M/month | ¥42M | ⚠️ 84% |
| New Customers | 100/month | 78 | ⚠️ 78% |
| CSAT | 4.5/5.0 | 4.6 | ✅ 102% |
| Uptime | 99.9% | 99.95% | ✅ 100% |

### Department Progress
| Dept | Active Tasks | Completed | Blocked | On Track |
|------|-------------|-----------|---------|----------|
| 📊 Marketing | 5 | 2 | 0 | ✅ |
| 🤝 Sales | 8 | 3 | 1 | ⚠️ |
| 💰 Finance | 4 | 4 | 0 | ✅ |
| ⚙️ Engineering | 6 | 1 | 2 | ❌ |
| 🎯 Product | 3 | 1 | 0 | ✅ |
| 💬 Support | 12 | 10 | 0 | ✅ |
| 👥 HR | 2 | 0 | 1 | ⚠️ |
| 🧭 Strategy | 1 | 0 | 0 | ✅ |

### Critical Items Requiring Human CEO Attention
1. 🔴 **ENG-003**: Infrastructure migration blocked — vendor contract needs signing (EXPENSE: ¥2M)
2. 🟡 **SLS-005**: Enterprise deal negotiation — pricing approval needed (EXPENSE: custom pricing)
3. 🟡 **HR-001**: Q2 hiring plan — budget approval needed (EXPENSE: ¥8M/quarter)

### Expense Approval Queue
| Task | Department | Amount | Purpose | Recommendation |
|------|-----------|--------|---------|----------------|
| ENG-003 | Engineering | ¥2,000,000 | Cloud migration vendor | ✅ Approve |
| SLS-005 | Sales | Custom | Enterprise pricing | ⚠️ Review needed |
| HR-001 | HR | ¥8,000,000 | Q2 hiring (3 positions) | ✅ Approve |
| MKT-007 | Marketing | ¥500,000 | Q1 ad campaign | ✅ Approve |
| **Total** | | **¥10,500,000+** | | |
```

---

## 5. Task Board UI Design

### 5.1 Primary View: Kanban Board

The default Task Board view is a **Kanban board** with swim lanes by status:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Task Board                                    [+ New Task] [⚙ Filters] [📊 Reports]│
│                                                                                   │
│ Filter: [All Departments ▼] [All Priorities ▼] [All Categories ▼] [🔍 Search]    │
│                                                                                   │
│ ┌─── Pending (4) ───┐ ┌─ In Progress (6) ─┐ ┌─── Review (2) ────┐ ┌ Done (12) ─┐│
│ │                    │ │                    │ │                    │ │             ││
│ │ ┌────────────────┐ │ │ ┌────────────────┐ │ │ ┌────────────────┐ │ │ ┌─────────┐││
│ │ │ MKT-003       ▪│ │ │ │ MKT-001       ▪│ │ │ │ FIN-002       ▪│ │ │ │FIN-001  │││
│ │ │ SNS Campaign   │ │ │ │ Q1 Strategy    │ │ │ │ Budget Report  │ │ │ │Monthly  │││
│ │ │ Plan           │ │ │ │                │ │ │ │                │ │ │ │Close    │││
│ │ │ 📊 Maya       │ │ │ │ 📊 Maya       │ │ │ │ 💰 Ken        │ │ │ │💰 Ken   │││
│ │ │ Due: 3/25     │ │ │ │ ████████░░ 75% │ │ │ │ ⏳ Awaiting    │ │ │ │✅ 3/5   │││
│ │ │ 🏷️ medium     │ │ │ │ Due: 3/15     │ │ │ │    CEO review  │ │ │ └─────────┘││
│ │ └────────────────┘ │ │ │ 🏷️ critical   │ │ │ └────────────────┘ │ │             ││
│ │                    │ │ └────────────────┘ │ │                    │ │ ┌─────────┐││
│ │ ┌────────────────┐ │ │                    │ │ ┌────────────────┐ │ │ │CS-003   │││
│ │ │ HR-001        ▪│ │ │ ┌────────────────┐ │ │ │ ENG-003  💰   ▪│ │ │ │FAQ      │││
│ │ │ Hiring Plan    │ │ │ │ ENG-001       ▪│ │ │ │ Infra Migration│ │ │ │Update   │││
│ │ │ 👥 Hana       │ │ │ │ Architecture   │ │ │ │ ⚙️ Taro       │ │ │ │💬 Saki  │││
│ │ │ Due: 3/25     │ │ │ │ Design         │ │ │ │ 💰 ¥2M        │ │ │ │✅ 3/4   │││
│ │ │ 💰 ¥8M       │ │ │ │ ⚙️ Taro       │ │ │ │ ⚠️ EXPENSE    │ │ │ └─────────┘││
│ │ │ ⚠️ EXPENSE   │ │ │ │ ████░░░░░░ 40% │ │ │ │ NEEDS APPROVAL │ │ │             ││
│ │ └────────────────┘ │ │ │ Due: 3/18     │ │ │ └────────────────┘ │ │             ││
│ │                    │ │ └────────────────┘ │ │                    │ │             ││
│ │ ┌────────────────┐ │ │                    │ │                    │ │             ││
│ │ │ SLS-003       ▪│ │ │ ┌────────────────┐ │ │                    │ │             ││
│ │ │ Q1 Pipeline    │ │ │ │ CEO-001       ▪│ │ │                    │ │             ││
│ │ │ Outreach       │ │ │ │ Weekly Report  │ │ │                    │ │             ││
│ │ │ 🤝 Riku       │ │ │ │ 👔 CEO AI     │ │ │                    │ │             ││
│ │ │ Due: 3/20     │ │ │ │ ██████████ 100%│ │ │                    │ │             ││
│ │ └────────────────┘ │ │ │ 🏷️ report     │ │ │                    │ │             ││
│ │                    │ │ └────────────────┘ │ │                    │ │             ││
│ └────────────────────┘ └────────────────────┘ └────────────────────┘ └─────────────┘│
│                                                                                   │
│ 💰 Expense tasks awaiting human CEO approval: 3 items (¥10.5M total)  [View All]  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Task Card Design

Each task card shows key information at a glance:

```
┌────────────────────────────────────┐
│ MKT-001                    ● critical │  ← Task ID + priority dot (🔴🟡🟢⚪)
│                                       │
│ Q1 Marketing Strategy                 │  ← Title
│                                       │
│ 📊 Maya (Marketing)                  │  ← Assignee emoji + name + department
│ [Autonomous]                          │  ← Mode badge
│                                       │
│ ████████░░░░░░░░ 75%                 │  ← Progress bar
│                                       │
│ 📅 Due: 2026-03-15                   │  ← Deadline
│ 🔗 Depends: FIN-002                  │  ← Dependencies (if any)
│ 👥 Collab: 💰Finance, 🤝Sales       │  ← Collaborators (if any)
│                                       │
│ [💰 EXPENSE: ¥500K — NEEDS APPROVAL] │  ← Expense badge (if applicable)
│                                       │
│ 💬 3 comments  📎 2 files            │  ← Activity indicators
└────────────────────────────────────┘
```

**Card Color Coding:**
- 🔴 Red border: `critical` priority
- 🟡 Yellow border: `high` priority
- Default: `medium` / `low`
- 💰 Gold badge: expense-related task requiring approval
- 🔒 Grey overlay: `blocked` status

### 5.3 Task Detail View (Click to Expand)

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back to Board                                              │
│                                                              │
│ MKT-001: Q1 Marketing Strategy                       ● critical│
│                                                              │
│ ┌─ Info ─────────────────────────────────────────────────┐   │
│ │ Assigned to: 📊 Maya (Marketing) [Autonomous]          │   │
│ │ Created by:  👔 CEO AI                                 │   │
│ │ Created:     2026-03-01 09:00                          │   │
│ │ Deadline:    2026-03-15                                │   │
│ │ Category:    Strategic                                 │   │
│ │ Tags:        #q1 #strategy #customer-acquisition       │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─ Description ──────────────────────────────────────────┐   │
│ │ Develop comprehensive Q1 marketing strategy focusing   │   │
│ │ on new customer acquisition. Budget is 120% of last    │   │
│ │ quarter. Coordinate with finance for budget approval   │   │
│ │ and sales for lead handoff process.                    │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─ Progress ─────────────────────────────────────────────┐   │
│ │ ████████████████░░░░░░ 75%                             │   │
│ │                                                        │   │
│ │ Timeline:                                              │   │
│ │ ✅ Mar 3 — Competitor analysis complete                │   │
│ │ ✅ Mar 5 — Campaign framework drafted                  │   │
│ │ ✅ Mar 7 — Budget proposal sent to finance agent       │   │
│ │ 🔄 Mar 10 — Finalizing channel allocation (current)    │   │
│ │ ⬜ Mar 12 — Strategy deck preparation                  │   │
│ │ ⬜ Mar 14 — Final review and submission                │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─ Dependencies ─────────────────────────────────────────┐   │
│ │ ← Depends on:  FIN-002 (Budget Allocation) ✅ Done     │   │
│ │ → Blocks:       MKT-002 (Competitor Deep-dive)         │   │
│ │ 👥 Collaborators: 💰 Finance, 🤝 Sales                │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─ Deliverables ─────────────────────────────────────────┐   │
│ │ ✅ competitor-analysis.md          (completed 3/3)      │   │
│ │ 🔄 marketing-strategy-q1.md       (in progress)        │   │
│ │ ⬜ budget-proposal.xlsx            (pending)            │   │
│ │ ⬜ campaign-calendar.md            (pending)            │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─ Expense Details (if applicable) ──────────────────────┐   │
│ │ 💰 Budget Required: ¥500,000                           │   │
│ │ Purpose: Q1 digital advertising campaign               │   │
│ │ Approval Status: ⏳ Pending human CEO approval         │   │
│ │ [Approve ✅] [Reject ❌] [Request Changes 📝]          │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─ Activity Log ─────────────────────────────────────────┐   │
│ │ 📊 Maya • Mar 7, 14:30                                 │   │
│ │   Sent budget proposal to 💰 Ken for review            │   │
│ │                                                        │   │
│ │ 💰 Ken • Mar 7, 15:00                                  │   │
│ │   Budget is within allocation. Approved from finance    │   │
│ │   side. Needs CEO final approval for payment.          │   │
│ │                                                        │   │
│ │ 👔 CEO AI • Mar 7, 15:30                               │   │
│ │   Added to today's Expense Approval Report for human   │   │
│ │   CEO review. Recommendation: Approve.                 │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                              │
│ ┌─ Comments ─────────────────────────────────────────────┐   │
│ │ [Add comment...                                    Send]│   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### 5.4 Alternative Views

#### View 2: Table / List View

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Task Board — List View                                   [Kanban] [List] [Timeline]│
│                                                                                    │
│ Sort: [Priority ▼]  Filter: [All Departments ▼] [Status ▼] [Category ▼]          │
│                                                                                    │
│ ┌────┬─────────┬────────────────────┬──────────┬─────────┬──────┬───────┬────────┐│
│ │ ●  │ ID      │ Title              │ Assignee │ Status  │ Prog │ Due   │ 💰     ││
│ ├────┼─────────┼────────────────────┼──────────┼─────────┼──────┼───────┼────────┤│
│ │ 🔴 │CEO-001  │Weekly Report       │👔 CEO AI │▶ Active │100%  │3/7    │        ││
│ │ 🔴 │MKT-001  │Q1 Strategy         │📊 Maya  │▶ Active │ 75%  │3/15   │¥500K   ││
│ │ 🔴 │ENG-003  │Infra Migration     │⚙️ Taro  │⏸ Review │ 90%  │3/10   │¥2M  ⚠️ ││
│ │ 🟡 │ENG-001  │Architecture Design │⚙️ Taro  │▶ Active │ 40%  │3/18   │        ││
│ │ 🟡 │FIN-002  │Budget Report       │💰 Ken   │⏸ Review │100%  │3/12   │        ││
│ │ 🟡 │SLS-003  │Pipeline Outreach   │🤝 Riku  │◻ Pending│  0%  │3/20   │        ││
│ │ 🟡 │HR-001   │Hiring Plan         │👥 Hana  │◻ Pending│  0%  │3/25   │¥8M  ⚠️ ││
│ │ 🟢 │MKT-003  │SNS Campaign Plan   │📊 Maya  │◻ Pending│  0%  │3/25   │        ││
│ │ 🟢 │CS-004   │FAQ Expansion       │💬 Saki  │▶ Active │ 50%  │3/20   │        ││
│ └────┴─────────┴────────────────────┴──────────┴─────────┴──────┴───────┴────────┘│
│                                                                                    │
│ Showing 9 of 24 tasks  [◀ Prev] [Page 1 of 3] [Next ▶]                           │
└────────────────────────────────────────────────────────────────────────────────────┘
```

#### View 3: Department View (Grouped by Role)

```
┌──────────────────────────────────────────────────────────────────┐
│ Task Board — Department View                                      │
│                                                                    │
│ ┌─ 👔 CEO / Executive ──────────────────────────────────────┐    │
│ │ CEO-001 Weekly Report        ▶ Active  100%  Due: 3/7      │    │
│ │ CEO-002 Q1 OKR Review        ◻ Pending   0%  Due: 3/31     │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ ┌─ 📊 Marketing ────────────────────────────────────────────┐    │
│ │ MKT-001 Q1 Strategy          ▶ Active   75%  Due: 3/15 💰  │    │
│ │ MKT-002 Competitor Analysis  ◻ Pending   0%  Due: 3/20     │    │
│ │ MKT-003 SNS Campaign Plan    ◻ Pending   0%  Due: 3/25     │    │
│ │ Total: 3 tasks | 1 active | 0 blocked | 0 completed        │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ ┌─ ⚙️ Engineering ──────────────────────────────────────────┐    │
│ │ ENG-001 Architecture Design  ▶ Active   40%  Due: 3/18     │    │
│ │ ENG-002 CI/CD Pipeline       ▶ Active   60%  Due: 3/15     │    │
│ │ ENG-003 Infra Migration      ⏸ Review   90%  Due: 3/10 💰  │    │
│ │ Total: 3 tasks | 2 active | 0 blocked | 0 completed        │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ ... (other departments) ...                                        │
└────────────────────────────────────────────────────────────────────┘
```

#### View 4: Timeline / Gantt View

```
┌──────────────────────────────────────────────────────────────────┐
│ Task Board — Timeline View                          March 2026    │
│                                                                    │
│           W1      W2       W3       W4                            │
│ Task    │3/1  │3/8   │3/15  │3/22  │3/29                        │
│ ────────┼──────┼──────┼──────┼──────┼───                         │
│ MKT-001 │██████████████████│       │                              │
│         │   Q1 Strategy (75%)      │                              │
│ ENG-001 │      │████████████████████│                             │
│         │      │ Arch Design (40%)  │                              │
│ ENG-003 │██████████████│            │                             │
│         │ Infra Migration (90%) 💰  │                              │
│ FIN-002 │██████████│                │                              │
│         │Budget Report (100%)       │                              │
│ HR-001  │            │██████████████████│                          │
│         │            │ Hiring Plan (0%) 💰                         │
│ SLS-003 │      │██████████████│       │                           │
│         │      │Pipeline Outreach (0%)│                            │
│                                                                    │
│ Legend: ████ Completed  ████ In Progress  ▒▒▒▒ Remaining          │
│         💰 = Requires expense approval                             │
└────────────────────────────────────────────────────────────────────┘
```

### 5.5 Expense Approval Panel (Human CEO View)

A dedicated panel for human CEO to review and approve expenses:

```
┌──────────────────────────────────────────────────────────────────┐
│ 💰 Expense Approval Queue                    3 items pending      │
│                                                                    │
│ Total Pending: ¥10,500,000                                        │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────┐    │
│ │ 1. ENG-003 — Infrastructure Migration                       │    │
│ │    Department: ⚙️ Engineering (Taro)                        │    │
│ │    Amount: ¥2,000,000                                       │    │
│ │    Purpose: Cloud vendor contract for infrastructure        │    │
│ │             migration to improve reliability                │    │
│ │    ROI: 40% reduction in downtime, est. saving ¥5M/year    │    │
│ │    CEO AI Recommendation: ✅ APPROVE                        │    │
│ │    Deadline: 2026-03-10                                     │    │
│ │                                                             │    │
│ │    [✅ Approve] [❌ Reject] [📝 Comment] [⏸ Defer]         │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────┐    │
│ │ 2. HR-001 — Q2 Hiring Plan                                  │    │
│ │    Department: 👥 HR (Hana)                                 │    │
│ │    Amount: ¥8,000,000 / quarter                             │    │
│ │    Purpose: Hire 3 positions (2 engineers, 1 designer)      │    │
│ │    ROI: Required to meet ENG roadmap delivery targets       │    │
│ │    CEO AI Recommendation: ✅ APPROVE                        │    │
│ │    Deadline: 2026-03-25                                     │    │
│ │                                                             │    │
│ │    [✅ Approve] [❌ Reject] [📝 Comment] [⏸ Defer]         │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────┐    │
│ │ 3. MKT-001 — Q1 Ad Campaign Budget                         │    │
│ │    Department: 📊 Marketing (Maya)                          │    │
│ │    Amount: ¥500,000                                         │    │
│ │    Purpose: Digital advertising for Q1 customer acquisition │    │
│ │    ROI: Target 200 MQLs, est. ¥2,500/lead                  │    │
│ │    CEO AI Recommendation: ✅ APPROVE                        │    │
│ │    Deadline: 2026-03-15                                     │    │
│ │                                                             │    │
│ │    [✅ Approve] [❌ Reject] [📝 Comment] [⏸ Defer]         │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ ┌─ Batch Actions ────────────────────────────────────────────┐    │
│ │ [✅ Approve All Selected] [❌ Reject All Selected]          │    │
│ └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│ ┌─ Recent Approvals ────────────────────────────────────────┐    │
│ │ FIN-001 Monthly Close    ¥0        ✅ Auto-approved  3/5   │    │
│ │ CS-003  FAQ Update       ¥0        ✅ Auto-approved  3/4   │    │
│ │ MKT-002 SEO Tools        ¥120,000  ✅ Approved       3/3   │    │
│ └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Task Creation & Assignment

### 6.1 Task Creation Flow

Tasks can be created from multiple sources:

| Source | How | Example |
|--------|-----|---------|
| **GRC Admin Dashboard** | Manual form | Admin creates "Q1 Marketing Strategy" task |
| **Human CEO** | Via Expense Approval Panel or direct creation | CEO creates strategic initiative |
| **CEO AI Agent** | Via A2A → GRC API | CEO AI breaks annual plan into department tasks |
| **Department Agent** | Via A2A → GRC API | Marketing agent creates subtask for campaign |
| **HEARTBEAT Auto-creation** | Scheduled tasks from HEARTBEAT.md | Weekly report tasks auto-created |

### 6.2 Task Creation Form (Dashboard)

```
┌──────────────────────────────────────────────────────────────────┐
│ Create New Task                                                    │
│                                                                    │
│ Task ID Prefix: [MKT- ▼]  (auto-increment: MKT-004)              │
│                                                                    │
│ Title:       [Q1 Social Media Campaign Launch              ]      │
│                                                                    │
│ Category:    [● Strategic  ○ Operational  ○ Project                │
│               ○ Expense   ○ Report       ○ Collaboration]         │
│                                                                    │
│ Priority:    [○ Critical  ● High  ○ Medium  ○ Low]                │
│                                                                    │
│ Description: ┌────────────────────────────────────────────┐       │
│              │ Launch coordinated social media campaign    │       │
│              │ across Twitter, LinkedIn, and Instagram     │       │
│              │ targeting B2B SaaS decision-makers.         │       │
│              └────────────────────────────────────────────┘       │
│                                                                    │
│ Assign To:   [📊 Maya (Marketing) - Node: winclaw-002 ▼]         │
│                                                                    │
│ Deadline:    [2026-03-25]                                         │
│                                                                    │
│ ┌─ Dependencies ──────────────────────────────────────────┐       │
│ │ Depends on: [+ Add dependency]                           │       │
│ │   • MKT-001 (Q1 Strategy) — must complete first          │       │
│ │                                                          │       │
│ │ Collaborators: [+ Add collaborator]                      │       │
│ │   • 💰 Finance — budget validation                       │       │
│ └──────────────────────────────────────────────────────────┘       │
│                                                                    │
│ ┌─ Deliverables ──────────────────────────────────────────┐       │
│ │ [+ Add deliverable]                                      │       │
│ │   • social-media-plan.md                                 │       │
│ │   • content-calendar.xlsx                                │       │
│ │   • campaign-metrics-template.md                         │       │
│ └──────────────────────────────────────────────────────────┘       │
│                                                                    │
│ ┌─ Expense (if applicable) ───────────────────────────────┐       │
│ │ ☑ This task requires budget/payment                      │       │
│ │ Amount: [¥ 300,000]                                      │       │
│ │ Currency: [JPY ▼]                                        │       │
│ │ Purpose: [Social media advertising spend          ]      │       │
│ └──────────────────────────────────────────────────────────┘       │
│                                                                    │
│ Tags: [q1] [social-media] [campaign] [+ Add tag]                  │
│                                                                    │
│                            [Cancel]  [Save as Draft]  [Create]    │
└──────────────────────────────────────────────────────────────────┘
```

### 6.3 Task Assignment API

```
# Create task
POST /api/v1/admin/tasks
{
  "id_prefix": "MKT",
  "title": "Q1 Social Media Campaign Launch",
  "description": "Launch coordinated social media campaign...",
  "category": "project",
  "priority": "high",
  "assigned_node_id": "winclaw-002",
  "assigned_role_id": "marketing",
  "assigned_by": "grc-admin",
  "deadline": "2026-03-25T00:00:00Z",
  "depends_on": ["MKT-001"],
  "collaborators": ["agent:finance:main"],
  "deliverables": [
    {"name": "social-media-plan.md", "status": "pending"},
    {"name": "content-calendar.xlsx", "status": "pending"}
  ],
  "requires_expense_approval": true,
  "expense_amount": 300000,
  "expense_currency": "JPY",
  "expense_purpose": "Social media advertising spend",
  "tags": ["q1", "social-media", "campaign"]
}

# Response
{
  "task": {
    "id": "MKT-004",
    "status": "pending",
    ...
  }
}
```

---

## 7. Cross-Department Task Dependencies

### 7.1 Dependency Visualization

```
┌──────────────────────────────────────────────────────────────────┐
│ Task Dependencies — MKT-001                                       │
│                                                                    │
│                    ┌─────────┐                                    │
│                    │ CEO-001 │ Annual Plan                         │
│                    │ 👔 CEO  │                                    │
│                    └────┬────┘                                    │
│                         │                                          │
│                    ┌────▼────┐                                    │
│              ┌─────│ STR-001 │ Q1 OKR Setting                     │
│              │     │ 🧭 Strat│                                    │
│              │     └────┬────┘                                    │
│              │          │                                          │
│         ┌────▼────┐ ┌───▼─────┐                                  │
│         │ FIN-002 │ │ MKT-001 │ ← Current task                   │
│         │ 💰 Budg │ │ 📊 Q1   │                                  │
│         │ ✅ Done │ │ Strategy │                                  │
│         └─────────┘ └────┬────┘                                  │
│                          │                                         │
│              ┌───────────┼───────────┐                            │
│         ┌────▼────┐ ┌────▼────┐ ┌────▼────┐                      │
│         │ MKT-002 │ │ MKT-003 │ │ MKT-004 │                      │
│         │ Compet. │ │ SNS     │ │ Campaign│                      │
│         │ Analysis│ │ Plan    │ │ Launch  │                      │
│         └─────────┘ └─────────┘ └─────────┘                      │
│                                                                    │
│ Legend: ✅ Completed  🔄 In Progress  ⬜ Pending  🔴 Blocked     │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Auto-Blocking Logic

When a task's dependency is not yet completed, the system automatically:
1. Sets the dependent task to `blocked` status
2. Notifies the assigned agent: "Task X is blocked waiting for Task Y"
3. When the dependency completes → auto-transitions to `pending` or `in_progress`
4. Sends notification: "Task Y completed. Task X is now unblocked."

```typescript
// Pseudo-code for dependency resolution
async function onTaskStatusChange(taskId: string, newStatus: string) {
  if (newStatus === 'completed') {
    // Find all tasks that depend on this one
    const dependentTasks = await db.tasks.findMany({
      where: { depends_on: { contains: taskId } }
    });

    for (const task of dependentTasks) {
      const allDepsCompleted = await checkAllDependencies(task.depends_on);
      if (allDepsCompleted && task.status === 'blocked') {
        await updateTaskStatus(task.id, 'pending');
        await notifyAgent(task.assigned_node_id, {
          type: 'task_unblocked',
          taskId: task.id,
          message: `Task ${task.id} is now unblocked. Dependency ${taskId} has been completed.`
        });
      }
    }
  }
}
```

---

## 8. Dashboard Summary Widgets

### 8.1 Task Board Header Statistics

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│  📋 Total    ▶ Active    ⏸ Review    🔴 Blocked    ✅ Done       │
│    24           8           3           2            11            │
│                                                                    │
│  💰 Pending Expense Approvals: 3 (¥10.5M)                        │
│  ⏰ Overdue Tasks: 1                                              │
│  📅 Due This Week: 5                                              │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Department Health Dashboard (CEO View)

```
┌──────────────────────────────────────────────────────────────────┐
│ Department Health Overview                                        │
│                                                                    │
│ Department       Active  Done  Blocked  On-Time  Completion Rate  │
│ ──────────────── ──────  ────  ───────  ───────  ──────────────  │
│ 📊 Marketing        3     2      0       ✅ 100%     40%          │
│ 🤝 Sales            4     1      1       ⚠️  75%     20%          │
│ 💰 Finance          2     4      0       ✅ 100%     67%          │
│ ⚙️ Engineering      3     0      2       ❌  33%      0%          │
│ 🎯 Product          2     1      0       ✅ 100%     33%          │
│ 💬 Support          5     8      0       ✅ 100%     62%          │
│ 👥 HR               1     0      1       ⚠️  50%      0%          │
│ 🧭 Strategy         1     1      0       ✅ 100%     50%          │
│ ──────────────── ──────  ────  ───────  ───────  ──────────────  │
│ TOTAL              21    17      4        81%         45%          │
│                                                                    │
│ 🔴 Attention Needed: Engineering (2 blocked), Sales (1 blocked)   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 9. Task Board API Endpoints

### 9.1 Full API Reference

```
# Task CRUD
GET    /api/v1/admin/tasks                     # List tasks with filters
POST   /api/v1/admin/tasks                     # Create task
GET    /api/v1/admin/tasks/:taskId             # Get task detail
PUT    /api/v1/admin/tasks/:taskId             # Update task
DELETE /api/v1/admin/tasks/:taskId             # Delete task

# Task Assignment & Status
POST   /api/v1/admin/tasks/:taskId/assign      # Assign to node
POST   /api/v1/admin/tasks/:taskId/unassign    # Remove assignment
PUT    /api/v1/admin/tasks/:taskId/status       # Change status

# Expense Approval (Human CEO actions)
GET    /api/v1/admin/tasks/expense-queue        # Pending expense approvals
POST   /api/v1/admin/tasks/:taskId/approve      # Approve expense
POST   /api/v1/admin/tasks/:taskId/reject       # Reject expense
POST   /api/v1/admin/tasks/batch-approve        # Batch approve

# Progress & Comments
POST   /api/v1/admin/tasks/:taskId/progress     # Log progress update
GET    /api/v1/admin/tasks/:taskId/progress-log  # Get progress history
POST   /api/v1/admin/tasks/:taskId/comments     # Add comment
GET    /api/v1/admin/tasks/:taskId/comments     # List comments

# Dashboard Statistics
GET    /api/v1/admin/tasks/stats                # Overall statistics
GET    /api/v1/admin/tasks/stats/department      # Per-department stats
GET    /api/v1/admin/tasks/stats/timeline        # Timeline/burndown data

# Agent-facing API (called by WinClaw clients)
GET    /a2a/tasks/mine                          # Get my assigned tasks
POST   /a2a/tasks/:taskId/progress              # Report progress
POST   /a2a/tasks/:taskId/status                # Update status
POST   /a2a/tasks/:taskId/comment               # Add comment
GET    /a2a/tasks/:taskId/dependencies           # Check dependency status
POST   /a2a/tasks/request                       # Request new task creation (agent → CEO)
```

### 9.2 Query Filters

```
GET /api/v1/admin/tasks?
  status=pending,in_progress          # Filter by status (comma-separated)
  &priority=critical,high             # Filter by priority
  &category=expense                   # Filter by category
  &assigned_role_id=marketing         # Filter by department/role
  &assigned_node_id=winclaw-002       # Filter by specific node
  &requires_expense_approval=true     # Only expense tasks
  &overdue=true                       # Only overdue tasks
  &due_before=2026-03-15              # Due before date
  &due_after=2026-03-01               # Due after date
  &search=strategy                    # Full-text search in title/description
  &sort=priority,-deadline            # Sort (- prefix = descending)
  &page=1&limit=20                    # Pagination
```

---

## 10. TASKS.md Sync Protocol

### 10.1 GRC → TASKS.md (Download)

When GRC sync runs, the client fetches assigned tasks and generates TASKS.md:

```markdown
---
title: "TASKS.md"
summary: "Active task queue for this AI employee"
sync_source: "grc"
last_synced: "2026-03-07T15:30:00Z"
config_revision: 5
---

# Active Tasks

## [MKT-001] Q1 Marketing Strategy
- **priority**: critical
- **status**: in_progress
- **progress**: 75%
- **assigned_by**: agent:ceo:main
- **deadline**: 2026-03-15
- **depends_on**: [FIN-002 ✅]
- **collaborators**: [agent:finance:main, agent:sales:main]
- **deliverables**:
  - ✅ competitor-analysis.md
  - 🔄 marketing-strategy-q1.md
  - ⬜ budget-proposal.xlsx
  - ⬜ campaign-calendar.md
- **expense**: ¥500,000 (⏳ pending human CEO approval)
- **notes**: |
    Focus on new customer acquisition. Budget is 120% of last quarter.
    Budget validated by finance agent. Awaiting CEO expense approval.

## [MKT-003] SNS Campaign Plan
- **priority**: medium
- **status**: pending
- **progress**: 0%
- **assigned_by**: agent:ceo:main
- **deadline**: 2026-03-25
- **depends_on**: [MKT-001]
- **collaborators**: []
- **deliverables**:
  - ⬜ social-media-plan.md
  - ⬜ content-calendar.xlsx
- **notes**: "Blocked until MKT-001 completes."

# Completed Tasks

## [MKT-000] Initial Market Research
- **completed_at**: 2026-03-02
- **result**: Delivered market-research-2026.md
```

### 10.2 TASKS.md → GRC (Upload)

When agent updates TASKS.md locally (e.g., changes progress, adds notes), the next sync pushes changes.

#### Change Detection Mechanism

The sync service tracks TASKS.md modifications using **file mtime comparison**:

```typescript
// In grc-sync.ts — Phase 9: Task Sync (bidirectional)

// State persisted across syncs
let lastTasksMdMtime: number | null = null;
let lastTasksMdHash: string | null = null;

async function syncTasksBidirectional(workspaceDir: string, grcClient: GrcClient) {
  const tasksPath = path.join(workspaceDir, 'TASKS.md');
  if (!fs.existsSync(tasksPath)) return;

  const stat = fs.statSync(tasksPath);
  const currentMtime = stat.mtimeMs;

  // STEP 1: Upload — Check if agent modified TASKS.md locally
  if (lastTasksMdMtime !== null && currentMtime > lastTasksMdMtime) {
    log.info('[sync] TASKS.md modified locally, uploading changes to GRC');
    const content = fs.readFileSync(tasksPath, 'utf-8');
    const localTasks = parseTasksMd(content);

    for (const task of localTasks) {
      // Compare with last-known state to detect actual changes
      if (task.hasLocalChanges) {
        await grcClient.updateTaskProgress(task.id, {
          status: task.status,
          progress_percent: task.progress,
          message: task.latestNote,
          deliverables_update: task.deliverables,
          version: task.version  // Optimistic locking
        });
      }
    }
  }

  // STEP 2: Download — Fetch latest tasks from GRC
  const serverTasks = await grcClient.getMyTasks();
  if (serverTasks.length > 0) {
    await writeTasksMdToWorkspace(serverTasks, tasksPath);
  }

  // Update tracking state
  lastTasksMdMtime = fs.statSync(tasksPath).mtimeMs;
}
```

**Key design decisions:**
- **Upload before download**: Ensures local agent changes are pushed to GRC before being overwritten by the download step
- **Mtime-based detection**: Simple, reliable, works across platforms. No filesystem watchers needed.
- **Hash fallback**: Optional content hash comparison for edge cases where mtime is unreliable
- **Conflict resolution**: If both local and server have changes to the same task, the `version` field (optimistic locking) determines the winner. The upload may receive a 409 Conflict, in which case the server version wins and the agent sees the updated state on next download.

---

## 11. Notification System

### 11.1 Notification Types

| Event | Notify | Channel |
|-------|--------|---------|
| Task assigned | Assignee agent | A2A + TASKS.md sync |
| Task deadline approaching (24h) | Assignee agent | A2A message |
| Task overdue | Assignee agent + CEO AI | A2A message + Dashboard alert |
| Task blocked | Assignee agent + blocking task owner | A2A message |
| Task unblocked | Assignee agent | A2A message |
| Dependency completed | Dependent task owners | A2A message |
| Expense approved | Requesting agent + Finance agent | A2A message |
| Expense rejected | Requesting agent | A2A message + reason |
| Progress update | Task collaborators | A2A message (optional) |
| Task completed | Task creator + collaborators | A2A message |
| Status change | Related agents | Activity log |

### 11.2 Notification Delivery

Notifications are delivered via the existing A2A relay system:

```json
{
  "from_node_id": "grc-system",
  "to_node_id": "winclaw-002",
  "message_type": "notification",
  "payload": {
    "type": "task_deadline_approaching",
    "task_id": "MKT-001",
    "task_title": "Q1 Marketing Strategy",
    "deadline": "2026-03-15T00:00:00Z",
    "hours_remaining": 24,
    "current_progress": 75,
    "message": "Task MKT-001 is due in 24 hours. Current progress: 75%."
  }
}
```

---

## 12. Integration with Existing GRC Features

### 12.1 Task Board ↔ Node Management

- Node list shows: role + active task count + completion rate
- Node detail page links to assigned tasks
- When a node goes offline → tasks are flagged with warning

### 12.2 Task Board ↔ A2A Relay

- Task status changes generate A2A messages
- A2A messages can reference task IDs for context
- CEO AI uses A2A to collect progress reports → updates Task Board

### 12.3 Task Board ↔ Role Templates

- Role assignment auto-creates initial tasks from role template TASKS.md
- Role-specific HEARTBEAT.md generates recurring tasks
- Department-grouped view matches role assignments

---

## 13. Dashboard Routes

```
/tasks                    → Kanban board (default view)
/tasks?view=list          → Table/list view
/tasks?view=timeline      → Gantt/timeline view
/tasks?view=department    → Department-grouped view
/tasks/new                → Create new task form
/tasks/:taskId            → Task detail view
/tasks/expenses           → Expense approval queue (human CEO)
/tasks/stats              → Statistics & analytics
/tasks/dependencies       → Dependency graph view
```

---

## 14. Technical Implementation Notes

### 14.1 Real-Time Updates

- Use WebSocket for live Task Board updates (card moves, progress changes)
- Server-Sent Events (SSE) as fallback
- Optimistic UI updates for drag-and-drop in Kanban view

### 14.2 Performance Considerations

- Paginate task lists (default 50 per page)
- **Required indexes**:
  ```sql
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
  ```
- Cache department statistics (invalidate on task change)
- Lazy-load task comments and progress history

### 14.3 Dashboard Technology

- React (consistent with existing GRC Dashboard)
- React DnD or @hello-pangea/dnd for Kanban drag-and-drop
- Recharts or Chart.js for statistics visualizations
- Monaco Editor for TASKS.md preview (consistent with Role Editor)

---

## Summary

The Task Board is a core GRC feature that:

1. **Manages the full task lifecycle** from creation through completion
2. **Enforces expense approval workflow** — all financial tasks route through CEO AI to human CEO
3. **Provides multiple views** — Kanban, List, Timeline, Department for different use cases
4. **Enables cross-department coordination** via dependency tracking and collaborator assignments
5. **Integrates deeply with TASKS.md sync** — bidirectional sync between GRC and WinClaw agents
6. **Supports automated progress reporting** — agents report via A2A and TASKS.md updates
7. **Delivers real-time visibility** — dashboard statistics, notifications, and live updates
8. **Respects the CEO copilot model** — human CEO has final authority on expenses via dedicated approval panel

---

## 15. Edge Cases & Safety Mechanisms

### 15.1 Circular Dependency Prevention

Before accepting `depends_on` values, the system performs a BFS/DFS cycle check:

```typescript
async function detectCircularDependency(taskId: string, newDependsOn: string[]): Promise<boolean> {
  const visited = new Set<string>();
  const queue = [...newDependsOn];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) return true; // Circular dependency detected!
    if (visited.has(current)) continue;
    visited.add(current);
    const task = await getTask(current);
    if (task?.depends_on) queue.push(...JSON.parse(task.depends_on));
  }
  return false;
}
```

- If circular dependency detected → API returns `400 Bad Request` with explanation
- Dashboard shows visual warning when user tries to add problematic dependency
- Applied on: task creation, task update (depends_on field change)

### 15.2 Optimistic Locking (Concurrent Update Protection)

Tasks use a `version` column to prevent conflicting simultaneous updates:

```
PUT /api/v1/admin/tasks/:taskId
{
  "status": "completed",
  "version": 3  // Must match current DB version
}

→ Server: UPDATE tasks SET ..., version = version + 1 WHERE id = :taskId AND version = 3
→ If 0 rows affected (version mismatch) → 409 Conflict response
→ Client must re-fetch task and retry with updated version
```

This prevents scenarios like: CEO AI marks task "completed" while agent simultaneously sets it to "blocked".

### 15.3 Agent Offline Handling

When a WinClaw node goes offline (no heartbeat for configurable threshold, default 30 minutes):

1. **Detection**: GRC checks `nodes.last_seen_at` on each dashboard refresh / periodic job
2. **Visual Flag**: All tasks assigned to offline node show `⚠️ Agent Offline` badge in Dashboard
3. **Notification**: CEO AI receives A2A notification: "Node X (role: marketing) offline. Tasks affected: MKT-001, MKT-003"
4. **Reassignment**: GRC Admin or CEO AI can reassign tasks via:
   ```
   POST /api/v1/admin/tasks/:taskId/reassign
   { "new_node_id": "winclaw-005", "reason": "Original node offline" }
   ```
5. **Recovery**: When node reconnects, it syncs and receives updated TASKS.md (reassigned tasks removed, remaining tasks intact)

### 15.4 RBAC for Task Operations

| Operation | GRC Admin | Human CEO | CEO AI | Assigned Agent | Other Agent |
|-----------|-----------|-----------|--------|---------------|-------------|
| Create task | ✅ | ✅ | ✅ | ✅ (subtasks only) | ❌ |
| Assign/reassign task | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update own task status | ✅ | ✅ | ✅ | ✅ | ❌ |
| Update other's task | ✅ | ✅ | ✅ (CEO oversight) | ❌ | ❌ |
| Approve expense | ❌ | ✅ only | ❌ (recommend only) | ❌ | ❌ |
| Delete task | ✅ | ✅ | ✅ (non-expense only) | ❌ | ❌ |
| Add comment | ✅ | ✅ | ✅ | ✅ | ✅ (collaborators only) |
| View tasks | All | All | All | Own + collaborating | Own + collaborating |

Role check is enforced at the API layer. Agent-facing endpoints (`/a2a/tasks/*`) automatically scope to the requesting node's assignments.

### 15.5 TASKS.md Content Sanitization

Since TASKS.md is injected into the AI agent's system prompt, content sanitization is critical to prevent prompt injection:

- **Strip executable patterns**: Remove HTML comments (`<!-- -->`), `<script>` tags, and suspicious code fences
- **Length limit**: TASKS.md is capped at 20KB (enforced by workspace.ts character budget system)
- **Field validation**: Task notes and descriptions max 2000 chars each
- **Character filtering**: Strip control characters (except newlines/tabs) from all text fields
- **Template variable isolation**: `${xxx}` patterns in user-generated task content are escaped to `$\{xxx\}` to prevent variable injection during template resolution

### 15.6 JSON Field Structures

#### `blocking` field
```json
// Array of task IDs that THIS task blocks (reverse of depends_on)
["MKT-002", "MKT-003", "MKT-004"]
```
Automatically maintained by the system when tasks set `depends_on`. When task A depends on task B, task B's `blocking` field includes "A".

#### `progress_notes` field
```json
[
  {
    "timestamp": "2026-03-05T14:30:00Z",
    "message": "Completed competitor analysis for 3 of 5 targets",
    "progress_percent": 60,
    "reported_by": "agent:marketing:main"
  },
  {
    "timestamp": "2026-03-07T10:00:00Z",
    "message": "All 5 competitor analyses complete, drafting strategy",
    "progress_percent": 75,
    "reported_by": "agent:marketing:main"
  }
]
```

#### `deliverables` field
```json
[
  {"name": "competitor-analysis.md", "status": "completed", "completed_at": "2026-03-05"},
  {"name": "marketing-strategy-q1.md", "status": "in_progress"},
  {"name": "budget-proposal.xlsx", "status": "pending"},
  {"name": "campaign-calendar.md", "status": "pending"}
]
```

### 15.7 Expense Approval Presentation to Human CEO

The CEO AI presents expense approvals to the human CEO through **three channels**:

1. **GRC Dashboard**: Dedicated Expense Approval Panel (§5.5) — always accessible at `/tasks/expenses`
2. **CEO AI Summary Report**: CEO AI's HEARTBEAT.md includes daily expense summary. The CEO AI compiles all pending expenses into a structured report and presents it during the copilot conversation.
3. **A2A Notification**: When an expense task enters `review` status, CEO AI sends a structured notification via the copilot interface:
   ```markdown
   ## 💰 Expense Approval Required

   | Task | Dept | Amount | Purpose | My Recommendation |
   |------|------|--------|---------|-------------------|
   | ENG-003 | Engineering | ¥2M | Cloud migration | ✅ Approve |
   | HR-001 | HR | ¥8M | Q2 hiring | ✅ Approve |

   Please review in the GRC Dashboard at /tasks/expenses
   or reply with "approve ENG-003" / "reject HR-001 reason: ..."
   ```

The human CEO can approve directly from the Dashboard UI or via conversation with the CEO AI (which then calls the approve API on their behalf after confirmation).
