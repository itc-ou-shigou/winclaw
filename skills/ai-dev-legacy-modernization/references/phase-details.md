# Legacy Modernization Phase Details

## Phase 2: Legacy Code Analysis → INITIAL.md

### Purpose

Analyze the legacy codebase and generate a comprehensive technical specification (`INITIAL.md`) that describes the modernized system architecture.

### Prompt File

`.claude/prompts/create-initail.md`

### What Claude Does

1. Scans all legacy source files (COBOL, Java, C#, VB, etc.)
2. Identifies business logic, data models, and workflows
3. Maps legacy features to modern equivalents
4. Generates `INITIAL.md` with:
   - Section 1: Frontend specification (React/Vue/Angular)
   - Section 2: Backend API design (FastAPI/Express/Spring)
   - Section 3: Database schema migration plan
   - Section 4: User interface overview with screens
   - Section 5: Testing strategy

### Validation

- `INITIAL.md` exists and is > 5,000 bytes
- Contains sections for frontend, backend, and database

### Timeout

1800 seconds (30 minutes)

---

## Phase 3: Modular PRP Generation

### Purpose

Split `INITIAL.md` into multiple focused PRP (Product Requirements Prompt) files for parallel development.

### What Claude Does

1. Reads `INITIAL.md`
2. Identifies logical modules (auth, CRUD, UI, etc.)
3. Creates `PRPs/` directory with individual PRP files:
   - Naming: `<ProjectName>_<ModuleName>.md`
   - Each PRP < 1000 lines
   - Includes TEST SPECIFICATION for TDD
4. Creates `PRPs/MODULE_INDEX.md` with dependency graph

### PRP Structure

```
## Module: Authentication
### Requirements
### Data Models
### API Endpoints
### Frontend Components
### TEST SPECIFICATION (for TDD)
#### Unit Tests
#### API Endpoint Tests
#### Component Tests
#### Acceptance Criteria
```

### Typical Module Split

- **Backend**: `Database_Schema.md`, `Authentication_Service.md`, `Core_Business_API.md`
- **Frontend**: `Frontend_Application.md` or per-feature split
- Total: 3-8 modules depending on project size

---

## Phase 4: PRP Iterative Execution

### Purpose

Execute each PRP module using TDD (Red-Green-Refactor) to generate actual code.

### Prompt File

`.claude/prompts/execute-prp-prompt.md` (with `{{PRP_FILE}}` placeholder)

### Execution Pattern

For each PRP file:

1. Generate prompt by replacing `{{PRP_FILE}}` with actual path
2. Execute with timeout (default: 14400s = 4 hours per PRP)
3. Validate: code directories created, exit code 0, output > 500 bytes
4. Mark completed: `date > .prp_status/<PRP_NAME>.done`

### What Claude Does Per PRP

1. Reads the PRP specification
2. **RED**: Writes failing tests based on TEST SPECIFICATION
3. **GREEN**: Implements code to pass tests
4. **REFACTOR**: Cleans up code structure
5. Creates backend API endpoints, database models, frontend components as specified

### Recovery

Failed PRPs are logged but don't block subsequent PRPs. Re-run with `start_phase=4` to retry.

### Status Tracking

```
.prp_status/
├── Authentication.md.done          # Completed marker
├── Authentication.md/
│   ├── prompt.md                   # Generated prompt
│   ├── output.log                  # Execution output
│   ├── debug.log                   # Debug information
│   └── status.json                 # Structured status
├── Core_API.md.done
└── Frontend.md/                    # In progress (no .done)
    ├── prompt.md
    └── output.log
```
