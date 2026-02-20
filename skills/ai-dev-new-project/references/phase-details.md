# New Project Phase Details

## Phase 2: Requirements → INITIAL.md

### Purpose

Convert user requirements into a comprehensive technical specification (`INITIAL.md`) for the new application.

### Prompt File

`.claude/prompts/create-initial-new-project.md`

### Input Sources

1. **User requirements text** — provided via chat or saved to `user-requirements.md`
2. **Sample code** — optional reference code in the workspace
3. **Tech stack preferences** — user may specify React, Vue, FastAPI, etc.

### What Claude Does

1. Reads user requirements (from `user-requirements.md` or workspace context)
2. Analyzes any sample code or reference implementations
3. Designs the application architecture
4. Generates `INITIAL.md` with:
   - Section 1: Frontend specification (framework, pages, components)
   - Section 2: Backend API design (endpoints, services, middleware)
   - Section 3: Database schema (tables, relationships, migrations)
   - Section 4: User interface overview (screens, navigation flow)
   - Section 5: Testing strategy (unit, API, UI)

### Pre-Approved INITIAL.md

If the user already has an approved `INITIAL.md` (e.g., from a previous planning session), they can place it directly in `$AIDEV_WORKSPACE/INITIAL.md` and Phase 2 will be skipped.

### Validation

- `INITIAL.md` exists and is > 3,000 bytes
- Contains sections for frontend, backend, and database

### Timeout

1800 seconds (30 minutes)

---

## Phase 3-4: Same as Legacy Modernization

Phase 3 (PRP generation) and Phase 4 (PRP execution) follow identical logic.
See `ai-dev-legacy-modernization/references/phase-details.md` for details.

Key difference: The PRPs are based on greenfield requirements (not legacy code analysis), so they tend to have cleaner architecture and fewer compatibility constraints.

---

## Requirements Collection Best Practices

### Minimum Viable Requirements

At minimum, the user should provide:

1. **What** the app does (core features)
2. **Who** uses it (user types/roles)
3. **Tech stack** preference (or accept defaults: React + FastAPI + MySQL)

### Example Requirements Format

```markdown
# Task Management App

## Features

- User registration and login
- Create, edit, delete tasks
- Assign tasks to team members
- Dashboard with task statistics
- Email notifications for due dates

## Users

- Admin: manage all tasks and users
- Member: manage own tasks

## Tech Stack

- Frontend: React with TypeScript
- Backend: FastAPI (Python)
- Database: MySQL
```

### Default Architecture (if not specified)

- Frontend: React 18 + TypeScript + Vite
- Backend: FastAPI + SQLAlchemy + Alembic
- Database: MySQL 8.0
- Auth: JWT tokens
- Frontend port: 3000
- Backend port: 3001
