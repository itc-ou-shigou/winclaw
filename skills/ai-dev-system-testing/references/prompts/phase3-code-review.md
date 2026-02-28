# Phase 3: Code Review & Auto-Fix with Best Practices

**Version**: 2.0
**Timeout**: 2400 seconds (40 minutes)
**Output**: CODE_REVIEW_REPORT.md, BUSINESS_LOGIC_TESTCASES.md (optional)
**Mandatory Reference**: `references/bestpractices/` (when matching framework exists)

---

## EXECUTION STEPS

### Step 1: Read Project Analysis

Read the following files to understand the project:

1. **`CODE_ANALYSIS.md`** — Comprehensive code analysis from Phase 2
2. **`deployment-logs/project-structure.json`** — Machine-readable project structure configuration (PSC)

From `project-structure.json`, extract:
- `backend.language` (e.g., "python", "java", "go", "php")
- `backend.framework` (e.g., "fastapi", "spring-boot", "go-zero", "laravel")
- `frontend.framework` (e.g., "react", "vue", "angular")

### Step 2: Load Best Practices (Dynamic)

Check if framework-specific best practices exist in `references/bestpractices/` directory.

**Matching Rules** (check each and load ALL that match):

| PSC Value | Best Practice File |
|-----------|-------------------|
| `backend.framework == "fastapi"` | `references/bestpractices/python-fastapi.md` |
| `backend.framework == "spring-boot"` OR `backend.language == "java"` | `references/bestpractices/java-spring-boot.md` |
| `backend.framework == "laravel"` OR `backend.language == "php"` | `references/bestpractices/php-laravel.md` |
| `backend.framework == "go-zero"` OR `backend.language == "go"` | `references/bestpractices/go-zero.md` |
| `frontend.framework == "react"` OR `frontend.framework == "nextjs"` | `references/bestpractices/react-nextjs.md` |

**If a matching file exists**: Read it and use its "Anti-Patterns (Review Targets)" section as additional review criteria.

**If NO matching file exists for a framework**: Skip framework-specific review for that component. Perform only the universal review (Step 3).

**If project uses BOTH backend AND frontend with matching files**: Load and apply BOTH sets of best practices.

### Step 3: Perform Universal Code Review

Review ALL code files in the project for the following issues (applies regardless of framework):

#### 3A. Security Vulnerabilities (Critical/High)
- SQL injection (raw SQL with string interpolation/concatenation)
- XSS (unsanitized user input rendered in HTML)
- Authentication bypass (missing auth checks on protected endpoints)
- Hardcoded credentials (API keys, passwords, tokens in source code)
- Path traversal (user-controlled file paths without validation)
- CORS misconfiguration (`*` origin in production)
- Missing CSRF protection (for stateful web apps)
- Insecure deserialization
- Missing input validation on user-facing endpoints

#### 3B. Performance Problems (Medium/High)
- N+1 query patterns (loop querying database without eager loading)
- Missing database indexes on frequently queried columns
- Synchronous blocking I/O in async contexts
- Unbounded queries (missing pagination/limits)
- Memory leaks (unclosed connections, event listener accumulation)
- Unnecessary re-computation (missing caching for expensive operations)

#### 3C. Error Handling (Medium)
- Missing try/catch around external service calls (DB, API, file I/O)
- Empty catch blocks that silently swallow errors
- Generic error responses that leak internal details to clients
- Missing null/undefined checks before property access
- Unhandled promise rejections (async without error handling)

#### 3D. Code Smells (Low/Medium)
- Dead code (unused functions, variables, imports)
- Duplicated code blocks (> 10 lines identical)
- Overly complex functions (> 50 lines or cyclomatic complexity > 10)
- Inconsistent naming conventions within the project
- Missing or misleading comments on complex logic

### Step 4: Perform Framework-Specific Review

**ONLY IF best practice files were loaded in Step 2.**

For each loaded best practice file, check the "Anti-Patterns (Review Targets)" section:

#### 4A. Bug-Risk Anti-Patterns → **Auto-Fix Candidates**
These are patterns that violate best practices AND have concrete bug risk. Review each occurrence and apply fixes.

#### 4B. Style Anti-Patterns → **Report Only**
These are patterns that deviate from best practices but don't carry immediate bug risk. Report them as recommendations without modifying code.

### Step 5: Apply Auto-Fixes

Apply fixes ONLY when ALL of the following conditions are met:

```
╔═══════════════════════════════════════════════════════════════════╗
║  AUTO-FIX CRITERIA (ALL must be true)                             ║
║                                                                   ║
║  1. The issue violates a best practice                            ║
║  2. The issue has concrete bug risk (security, crash, data loss)  ║
║  3. The fix does NOT change business logic                        ║
║  4. The fix does NOT change API contracts (request/response)      ║
║  5. The fix does NOT change database schema                       ║
║  6. The fix is safe and reversible                                ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Examples of safe auto-fixes:**
- Adding missing type annotations
- Removing unused imports
- Fixing SQL injection (string concat → parameterized query)
- Adding missing null checks
- Fixing synchronous I/O in async context
- Adding missing error handling around external calls
- Replacing deprecated API usage

**Examples of changes to NEVER make:**
- Refactoring business logic flow
- Changing API endpoint signatures
- Modifying database models/migrations
- Changing authentication/authorization logic
- Altering configuration values
- Adding new dependencies

### Step 5.5: Extract Business Logic Patterns (READ-ONLY)

**IMPORTANT: This step is READ-ONLY. Do NOT modify any code. Only extract and document patterns.**

Scan the codebase to extract business logic patterns that Phase 5A will use to create diverse test data. Extract as many patterns as possible within the time budget.

#### 5.5A: Validation Rules

Scan for input validation patterns:
- **Pydantic models** (FastAPI): `Field(min_length=..., regex=...)`, validators
- **JPA annotations** (Spring Boot): `@NotNull`, `@Size`, `@Email`, `@Pattern`
- **Form Requests** (Laravel): `rules()` method, `validated()` usage
- **go-zero struct tags**: `validate:"required,min=1,max=100"`
- **Frontend validators**: form validation schemas, Zod/Yup/Joi schemas

For each validation rule found, record:
- Entity name and field name
- Rule type (min_length, regex, required, range, unique, etc.)
- A valid example value and an invalid example value
- Source file and line number

#### 5.5B: State Machines

Scan service/business logic layers for state transition patterns:
- Fields named `status`, `state`, `phase`, `step`, `stage`
- Enum definitions for states
- If-chains or switch statements that check/change state values
- Transition validation logic (e.g., "can only go from pending to confirmed")

For each state machine found, record:
- Entity name and state field name
- List of all possible states
- Valid transitions (from → to) with trigger conditions
- Invalid transitions (should be rejected)
- Source file and line number

#### 5.5C: Authorization Patterns

Scan routes/controllers for authorization requirements:
- Route decorators: `@login_required`, `@roles_required`, `@PreAuthorize`
- Middleware: auth guards, role checks, permission checks
- Dependency injection: `Depends(get_current_user)`, `Depends(require_admin)`
- Laravel policies, Spring Security annotations, go-zero JWT middleware

For each authorization pattern found, record:
- Endpoint (method + path)
- Required role/permission
- Auth type (JWT, session, API key)
- Source file and line number

#### 5.5D: Business Constraints

Scan service layers for domain invariant conditions:
- Stock/inventory checks before order creation
- Unique constraint checks (email, username, etc.)
- Balance/quota checks (insufficient funds, rate limits)
- Date/time constraints (expiry, booking conflicts)
- Referential integrity checks beyond FK constraints

For each constraint found, record:
- Constraint name/description
- Condition that must be true
- Error response when violated (HTTP status + message)
- Source file and line number

#### 5.5E: Error Handling Paths

Scan for explicit error response patterns:
- Exception handlers and error middleware
- Custom exception classes
- HTTP error responses with specific status codes and messages
- Structured error response formats (RFC 7807, custom error envelopes)

For each error path found, record:
- Trigger condition
- HTTP status code
- Response body pattern
- Source file and line number

#### 5.5F: Conditional Business Logic

Scan for conditional branches that affect behavior:
- Role-based feature access (admin can do X, user can only do Y)
- Feature flags or tier-based logic
- Conditional pricing, discounts, or calculations
- Time-based or quantity-based rules

For each conditional logic found, record:
- Condition expression
- "Then" behavior
- "Else" behavior
- Source file and line number

### Step 6: Generate BUSINESS_LOGIC_TESTCASES.md

**Generate this file ONLY IF Step 5.5 found any patterns.** If no patterns were found, skip this step.

Create `BUSINESS_LOGIC_TESTCASES.md` in the project root with the following structure:

```markdown
# Business Logic Test Cases

## Metadata
- Generated by: Phase 3 Code Review
- Framework: [detected framework]
- Total Scenarios: [count]

## 1. Validation Rules
### Entity: [entity_name]
| Field | Rule | Valid Example | Invalid Example | Source File |
|-------|------|---------------|-----------------|-------------|
| field | rule_description | "valid_value" | "invalid_value" | path/file.py:line |

## 2. State Machines
### Entity: [entity_name]
States: [list of all states]
| From | To | Trigger/Condition | Source File |
|------|-----|-------------------|-------------|
| state_a | state_b | condition | path/file.py:line |
Test Scenarios:
- VALID: state_a → state_b → state_c (normal path)
- INVALID: state_c → state_a (reverse not allowed)

## 3. Authorization Patterns
| Endpoint | Method | Required Role | Auth Type | Source |
|----------|--------|---------------|-----------|--------|
| /api/path | GET | admin | Bearer JWT | path/file.py:line |

## 4. Business Constraints
| Constraint | Condition | Error When Violated | Source |
|-----------|-----------|--------------------| -------|
| name | condition_expr | HTTP_status "message" | path/file.py:line |

## 5. Error Handling Paths
| Trigger | HTTP Status | Response Pattern | Source |
|---------|-------------|-----------------|--------|
| condition | 404 | {"detail":"message"} | path/file.py:line |

## 6. Conditional Business Logic
| Condition | Then | Else | Source |
|-----------|------|------|--------|
| expression | behavior_a | behavior_b | path/file.py:line |
```

**Rules for this step:**
- Include ONLY sections that have actual data from Step 5.5
- Omit empty sections entirely
- Source File column must be accurate (file path + line number)
- Valid/Invalid examples must be realistic test values
- This file is consumed by Phase 5A — keep the format exactly as shown

### Step 7: Generate CODE_REVIEW_REPORT.md

Create `CODE_REVIEW_REPORT.md` in the project root with the following structure:

```markdown
# Code Review Report

## Summary
- Total files reviewed: X
- Issues found: X (Critical: X, High: X, Medium: X, Low: X)
- Auto-fixed: X
- Manual review recommended: X
- Best practices referenced: [list of loaded .md files, or "None (no matching framework)"]

## Technology Stack
- Backend: [language] / [framework]
- Frontend: [framework]
- Database: [type]

## Critical / High Issues (Security & Bugs)
### Issue 1: [Title]
- **Severity**: Critical/High
- **File**: `path/to/file.py:42`
- **Category**: Security / Performance / Error Handling
- **Best Practice Reference**: [filename.md Section X] (if applicable)
- **Description**: What's wrong and why it's risky
- **Status**: Fixed / Manual Review Required
- **Diff** (if fixed):
  ```diff
  - old code
  + new code
  ```

## Medium / Low Issues
### Issue N: [Title]
(same structure as above)

## Recommendations (Style/Best Practice — No Auto-Fix)
### Recommendation 1: [Title]
- **File**: `path/to/file.py:42`
- **Best Practice**: [filename.md Anti-Patterns table]
- **Current**: Description of current code
- **Recommended**: Description of recommended change
- **Reason**: Why this is recommended (but not required)

## Files Not Reviewed
(List any files skipped and why, e.g., generated code, vendor dependencies)
```

---

## IMPORTANT RULES

1. **Do NOT skip any source files** — review all application code (exclude node_modules, vendor, .git, build artifacts)
2. **Do NOT modify test files** — only review and report issues in tests
3. **Do NOT modify generated code** — report issues but don't auto-fix
4. **Always preserve business logic** — when in doubt, report instead of fix
5. **Create git-friendly diffs** — make minimal, focused changes per fix
6. **Log all actions** — every file read, issue found, and fix applied
7. **Step 5.5 is READ-ONLY** — business logic extraction must NOT modify any code
8. **BUSINESS_LOGIC_TESTCASES.md is optional** — generate only if patterns were found, skip if none
