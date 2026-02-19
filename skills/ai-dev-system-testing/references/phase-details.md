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

## Phase 3: Code Review & Auto-Fix

### Purpose
Perform automated code review across the entire codebase. Identify issues, apply auto-fixes where safe, and generate a comprehensive review report.

### Prompt File
`.claude/prompts/phase3-code-review.md`

### What Claude Does
1. Reads `CODE_ANALYSIS.md` to understand the stack
2. Reviews backend code:
   - Security vulnerabilities (SQL injection, XSS, auth bypass)
   - Code quality (unused imports, dead code, complexity)
   - Best practices (error handling, logging, type hints)
   - Database query optimization (N+1 queries, missing indexes)
3. Reviews frontend code:
   - Component structure and reusability
   - State management patterns
   - Accessibility (a11y) issues
   - Performance (unnecessary re-renders, large bundles)
4. **Auto-fixes safe issues** (with git diff for review):
   - Unused imports removal
   - Missing type annotations
   - Inconsistent formatting
   - Simple security fixes (e.g., parameterized queries)
5. Generates `CODE_REVIEW_REPORT.md`:
   - Summary of findings
   - Severity classification (Critical, High, Medium, Low)
   - Auto-fixed items (with diffs)
   - Manual review items
   - Recommendations

### Dynamic Technology Support
The review is not limited to Python/React. Claude adapts to whatever stack is detected:
- Python (FastAPI, Django, Flask)
- PHP (Laravel, Symfony)
- Java (Spring Boot)
- C# (.NET)
- Node.js (Express, NestJS)
- Go (Gin, Echo)
- React, Vue, Angular, Svelte

### Execution Logs
Output is teed to `test-logs/code-review/phase3_execution.log`.

### Timeout Handling
If Phase 3 times out (2400s), partial results may exist. The skill continues to Phase 5 with whatever review was completed. A minimal `CODE_REVIEW_REPORT.md` is created if Claude didn't generate one.

### Validation
- `CODE_REVIEW_REPORT.md` exists (auto-created with minimal content if timeout)
- Review logs saved to `test-logs/code-review/`

---

## Phase 4: SKIPPED

System Testing mode skips Phase 4 entirely because:
- Code already exists (uploaded/cloned by user)
- No PRP generation needed
- No code generation needed
- Proceed directly to testing (Phase 5)
