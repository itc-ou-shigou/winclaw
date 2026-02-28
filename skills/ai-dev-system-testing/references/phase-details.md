# System Testing Phase Details

## Phase 2: Code Structure Analysis

### Purpose

Analyze the existing codebase to understand its structure, technology stack, and generate machine-readable configuration (`project-structure.json`) for subsequent phases.

### Prompt File

`.claude/prompts/phase2-code-analysis.md`

### What Claude Does

1. Scans all source files to identify technology stack
2. Detects backend framework (FastAPI, Django, Express, Spring, etc.)
3. Detects frontend framework (React, Vue, Angular, etc.)
4. Identifies database type and ORM
5. Maps API endpoints and data models
6. Generates two outputs:

#### Output 1: `CODE_ANALYSIS.md`

Comprehensive human-readable analysis:

- Technology stack overview
- Directory structure description
- Backend architecture (routes, services, models)
- Frontend architecture (components, pages, state management)
- Database schema analysis
- API endpoint inventory
- Identified issues and recommendations

#### Output 2: `deployment-logs/project-structure.json`

Machine-readable configuration (PSC):

```json
{
  "backend": {
    "directory": "backend",
    "framework": "fastapi",
    "language": "python",
    "port": 3001
  },
  "frontend": {
    "directory": "frontend",
    "framework": "react",
    "port": 3000
  },
  "testing": {
    "setup": {
      "backend": {
        "install_command": "pip install -r requirements.txt",
        "pre_start_commands": ["alembic upgrade head"]
      },
      "frontend": {
        "install_command": "npm ci"
      }
    },
    "startup": {
      "backend": {
        "command": "python -m uvicorn app.main:app --port 3001",
        "health_check_endpoint": "/health"
      },
      "frontend": {
        "command": "npm run dev"
      }
    }
  }
}
```

### PSC-Only Recovery

If `CODE_ANALYSIS.md` exists but `project-structure.json` is missing, a focused prompt generates only the PSC file (timeout: 600s).

### Validation

- `CODE_ANALYSIS.md` > 3,000 bytes
- `deployment-logs/project-structure.json` is valid JSON

### Timeout

1800 seconds (30 minutes)

---

## Phase 3: Code Review & Auto-Fix (with Best Practices)

### Purpose

Perform automated code review across the entire codebase using both universal checks and framework-specific best practices. Identify issues, apply auto-fixes where safe (only when bug risk exists), and generate a comprehensive review report.

### Prompt File

`references/prompts/phase3-code-review.md`

### Best Practices Reference

Framework-specific best practices are stored in `references/bestpractices/`:

| File | Language + Framework | Source |
|------|---------------------|--------|
| `react-nextjs.md` | JavaScript/TypeScript + React 18+ / Next.js | vercel-labs/agent-skills |
| `java-spring-boot.md` | Java 21+ / Spring Boot 3.x-4.x | jdubois/dr-jskill |
| `go-zero.md` | Go 1.19+ / go-zero | zeromicro/zero-skills |
| `php-laravel.md` | PHP 8.1+ / Laravel | JustSteveKing/laravel-api-skill |
| `python-fastapi.md` | Python 3.10+ / FastAPI | fastapi-practices/skills |

**Matching Logic**: Phase 3 reads `project-structure.json` (from Phase 2) and loads matching best practice files based on `backend.language`, `backend.framework`, and `frontend.framework`. If no matching file exists, only universal review is performed.

**Adding New Frameworks**: Create a new file in `references/bestpractices/` following the naming convention `{language}-{framework}.md` and the standard template (Architecture, Code Quality, Naming, Security, Performance, Anti-Patterns, Testing sections).

### What Claude Does

1. Reads `CODE_ANALYSIS.md` and `project-structure.json` to understand the stack
2. Loads matching best practice files from `references/bestpractices/`
3. **Universal review** (all projects):
   - Security vulnerabilities (SQL injection, XSS, auth bypass, hardcoded credentials)
   - Performance problems (N+1 queries, blocking I/O, missing pagination)
   - Error handling (missing try/catch, empty catch blocks, leaked internals)
   - Code smells (dead code, duplication, complexity)
4. **Framework-specific review** (only when best practice file matches):
   - Anti-pattern detection per "Bug-Risk Anti-Patterns" table
   - Architecture pattern violations
   - Naming convention violations
5. **Auto-fix criteria** (ALL must be true):
   - Violates a best practice
   - Has concrete bug risk (security, crash, data loss)
   - Does NOT change business logic
   - Does NOT change API contracts or database schema
   - Fix is safe and reversible
6. **Business logic extraction** (READ-ONLY, no code changes):
   - Validation rules (Pydantic, JPA, FormRequest, go-zero struct tags)
   - State machines (status/state field transitions)
   - Authorization patterns (route decorators, middleware, guards)
   - Business constraints (domain invariant conditions)
   - Error handling paths (exception handlers, error responses)
   - Conditional business logic (role-based, feature-flag-based)
7. Generates `CODE_REVIEW_REPORT.md`:
   - Summary with severity counts
   - Best practices files referenced
   - Critical/High issues with diffs
   - Medium/Low issues
   - Recommendations (style anti-patterns, report only)
8. Generates `BUSINESS_LOGIC_TESTCASES.md` (optional):
   - 6-category structured Markdown tables
   - Validation rules with valid/invalid examples
   - State machine transitions with test scenarios
   - Authorization endpoint-role mappings
   - Business constraints with error conditions
   - Consumed by Phase 5A for multi-scenario test data creation

### Dynamic Technology Support

The review adapts to whatever stack is detected. Currently supported with best practices:

- Python (FastAPI) — `python-fastapi.md`
- PHP (Laravel) — `php-laravel.md`
- Java (Spring Boot) — `java-spring-boot.md`
- Go (go-zero) — `go-zero.md`
- React / Next.js — `react-nextjs.md`

Other stacks (Django, Flask, Vue, Angular, Express, NestJS, .NET, Svelte, etc.) receive universal review only until their best practice files are added.

### Execution Logs

Output is teed to `test-logs/code-review/phase3_execution.log`.

### Timeout Handling

If Phase 3 times out (2400s), partial results may exist. The skill continues to Phase 5 with whatever review was completed. A minimal `CODE_REVIEW_REPORT.md` is created if Claude didn't generate one.

### Validation

- `CODE_REVIEW_REPORT.md` exists (auto-created with minimal content if timeout)
- `BUSINESS_LOGIC_TESTCASES.md` exists (optional — Phase 5A will use basic CRUD only if missing)
- Review logs saved to `test-logs/code-review/`

---

## Phase 4: SKIPPED

System Testing mode skips Phase 4 entirely because:

- Code already exists (uploaded/cloned by user)
- No PRP generation needed
- No code generation needed
- Proceed directly to testing (Phase 5)

---

## Phase 5A: Test Data Seeding (Scenario-Aware)

### Purpose

Analyze the project's model/entity classes and create test data for Phase 5B (API testing) and Phase 5C (UI testing). When `BUSINESS_LOGIC_TESTCASES.md` exists from Phase 3, creates multi-scenario test data covering validation, state transitions, authorization, and business constraints.

### Prompt File

`references/prompts/phase5a-test-data-seeding.md`

### What Claude Does

1. Reads `CODE_ANALYSIS.md` and `project-structure.json` to understand the stack
2. Reads `BUSINESS_LOGIC_TESTCASES.md` (optional, from Phase 3) for scenario catalog
3. Discovers model/entity classes, fields, FK relationships
4. Builds dependency graph with topological sort
5. Creates test data in priority-tiered order:

| Priority | Category | Description |
|----------|---------|-------------|
| **P0** (mandatory) | Basic CRUD | 1 record per entity, regular test user |
| **P1** | Authorization | Admin user creation |
| **P2** | Validation | Invalid payload definitions (no DB writes) |
| **P3** | State Machine | Records in different states |
| **P4** | Business Constraints | Setup data for constraint tests |
| **P5** | Error Paths | Edge case data |

6. Saves results:
   - `test-logs/test_data_seed.json` — entities + auth + scenarios
   - `test-logs/phase5b_test_user.json` — regular user auth
   - `test-logs/phase5a_admin_user.json` — admin user auth (if created)
   - `test-logs/PHASE5A_SEEDING_REPORT.md` — summary with scenario counts

### Scenario Data Format

When `BUSINESS_LOGIC_TESTCASES.md` exists, `test_data_seed.json` includes a `scenarios` key:

```json
{
  "entities": { ... },
  "auth": { ... },
  "auth_admin": { ... },
  "scenarios": {
    "validation": [{ "entity", "field", "payload", "expected_status" }],
    "state_transitions": [{ "entity", "record_id", "from", "to", "expected_status" }],
    "authorization": [{ "endpoint", "auth_as", "expected_status" }],
    "business_constraints": [{ "constraint", "endpoint", "expected_status" }]
  }
}
```

Phase 5B/5C consume this JSON and execute EVERY scenario as a MANDATORY test case.

### Graceful Fallback

- If `BUSINESS_LOGIC_TESTCASES.md` does not exist → P0 only (standard behavior)
- If file is incomplete (partial categories) → scenarios for available categories only
- If time runs out during P1-P5 → save whatever has been created so far
- If admin user creation fails → omit `auth_admin` and authorization scenarios

### Timeout

1800 seconds (30 minutes)

---

## Phase 5B/5C: Two-Layer Testing Protocol

### Overview

Phase 5B (API) and Phase 5C (UI) execute tests using a two-layer protocol:

- **LAYER 1** (Standard): CRUD endpoint tests / Page tests (4-CORE + 6-GATE)
- **LAYER 2** (Scenario): Mandatory execution of ALL scenarios from `test_data_seed.json`

### Layer 2 Scenario Categories

| Category | Phase 5B (API) | Phase 5C (UI) |
|----------|---------------|---------------|
| validation | POST invalid payloads → verify 422 | Submit invalid form → verify error display |
| state_transitions | PATCH state change → verify 200/400 | Click UI button → verify state change |
| authorization | Request with admin/user token → verify 200/403 | Login as admin/user → verify access control |
| business_constraints | Violate constraint → verify 400 | Attempt constrained action → verify error |

### Pass Rate Calculation

```
pass_rate = (CRUD_passed + scenario_passed) / (CRUD_total + scenario_total) × 100
```

Scenario tests are NOT separate. They are included in the overall pass rate used by the iteration loop for early exit decisions.

### Results JSON Format

Both Phase 5B and 5C include `scenario_results` in their output JSON:

```json
{
  "total_tests": 35,
  "passed": 30,
  "pass_rate": 85.7,
  "crud_results": { "total": 20, "passed": 18 },
  "scenario_results": {
    "total": 15, "passed": 12,
    "validation": { "total": 5, "passed": 4, "details": [...] },
    "state_transitions": { "total": 4, "passed": 3, "details": [...] },
    "authorization": { "total": 4, "passed": 3, "details": [...] },
    "business_constraints": { "total": 2, "passed": 2, "details": [...] }
  }
}
```
