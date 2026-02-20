# Phase 5B: Swagger UI API Testing with Claude In Chrome (Efficient Mode)

**Version**: 2.1 (Real-time Bug Fixing + Iteration Loop Control)
**Execution Mode**: Efficient Mode - Uses Claude In Chrome for context sharing
**Target Pass Rate**: 95% (real-time bug fixing until threshold achieved)
**Timeout**: 7200 seconds (2 hours)
**Max Iterations**: 15 (configurable via BUGFIX_MAX_ITERATIONS)
**Early Exit**: 3 consecutive iterations without improvement
**Mandatory Reference**: api-backend-common-issues.md for ALL bug fixes
**Execution Mode**: `claude --dangerously-skip-permissions` (uses Claude In Chrome MCP server)

---

## ⚠️ HOW TO RUN THIS TEST

**IMPORTANT**: This prompt must be executed via Claude CLI, which will use Claude In Chrome MCP tools.

### Method 1: Direct Claude CLI Call (Single Iteration)

```bash
# Run from project root (where DATABASE_INFO.md exists)
claude --dangerously-skip-permissions -p "请阅读并执行 references/prompts/phase5b-api-tests-efficient.md 中的所有测试步骤"
```

### Method 2: Iteration Loop Script (Recommended)

```bash
# Run with WORKSPACE_DIR pointing to the project root
WORKSPACE_DIR=/path/to/project bash references/scripts/phase5b-efficient-loop.sh
```

### Prerequisites

1. **Chrome Browser**: Must have Claude In Chrome extension installed
2. **Backend**: Must be running on the configured port
3. **Database**: MySQL must be configured (SQLite forbidden)
4. **MCP Server**: Claude In Chrome MCP server must be connected

### Environment Variables (Optional)

```bash
export BUGFIX_MAX_ITERATIONS=15      # Max loop iterations
export BUGFIX_TARGET_PASS_RATE=95    # Target pass rate
export BUGFIX_EARLY_EXIT_THRESHOLD=3 # Early exit threshold
```

---

## ⛔ CRITICAL: Iteration Loop Control (v2.1) ⛔

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║  ITERATION LOOP CONFIGURATION (v2.1)                                              ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  MAX_ITERATIONS: 15 (default)                                                     ║
║  - Can be overridden via BUGFIX_MAX_ITERATIONS environment variable               ║
║  - Read from: phase5-global-config.json or backend/.env                           ║
║                                                                                   ║
║  TARGET_PASS_RATE: 95%                                                            ║
║  - Loop continues until pass_rate >= 95% OR max iterations reached               ║
║                                                                                   ║
║  EARLY_EXIT_THRESHOLD: 3                                                          ║
║  - Exit loop if pass_rate doesn't improve for 3 consecutive iterations           ║
║  - Prevents infinite loops on unfixable issues                                    ║
║                                                                                   ║
║  ITERATION_TIMEOUT: 1800s (30 minutes per iteration)                             ║
║  - Each iteration has a timeout to prevent hanging                                ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### Loop Algorithm

```
ALGORITHM: Iterative Bug Fix Loop

INITIALIZATION:
  iteration = 1
  max_iterations = read_config("BUGFIX_MAX_ITERATIONS", 15)
  target_pass_rate = 95
  early_exit_threshold = 3
  no_improvement_count = 0
  previous_pass_rate = 0

LOOP:
  WHILE iteration <= max_iterations:

    1. EXECUTE TEST PHASE:
       - Test ALL API endpoints
       - Record results in JSON format
       - Calculate pass_rate

    2. CHECK PASS RATE:
       IF pass_rate >= target_pass_rate:
           LOG "Target achieved!"
           BREAK LOOP (SUCCESS)

    3. ANALYZE FAILURES:
       - Categorize failures (auth, validation, server, missing_data)
       - Identify fixable vs non-fixable issues
       - Generate dynamic reseed prompt if needed

    4. EXECUTE FIX PHASE:
       - Apply bug fixes
       - Restart services if needed
       - Re-seed test data if 404 errors detected

    5. EARLY EXIT CHECK:
       IF pass_rate <= previous_pass_rate:
           no_improvement_count += 1
           IF no_improvement_count >= early_exit_threshold:
               LOG "Early exit: No improvement for {early_exit_threshold} iterations"
               BREAK LOOP (NO_IMPROVEMENT)
       ELSE:
           no_improvement_count = 0

    6. UPDATE STATE:
       previous_pass_rate = pass_rate
       iteration += 1

END LOOP:

IF pass_rate >= target_pass_rate:
    STATUS = "SUCCESS"
ELIF no_improvement_count >= early_exit_threshold:
    STATUS = "EARLY_EXIT"
ELSE:
    STATUS = "MAX_ITERATIONS_REACHED"

REPORT final_status, iteration, pass_rate
```

---

## ⛔ CRITICAL: Database Import Rules ⛔

**WHEN GENERATING ANY CODE THAT ACCESSES THE DATABASE:**

```
❌ FORBIDDEN (causes ModuleNotFoundError):
   from app.core.database import async_session_factory
   from app.database import async_session

✅ REQUIRED: Use db_session_helper.py or inline discovery
   # First: copy helper
   cp .claude/scripts/db_session_helper.py /workspace/backend/

   # Then in code:
   from db_session_helper import get_async_session
   async with get_async_session() as session:
       # your code here
```

**See api-backend-common-issues.md Section "Database Import Rules" for full details.**

---

## EFFICIENT MODE OVERVIEW

```
+================================================================+
|  CLAUDE IN CHROME - EFFICIENT TEST MODE                         |
+================================================================+
|                                                                  |
|  KEY DIFFERENCES FROM STANDARD MODE:                             |
|                                                                  |
|  1. CONTEXT SHARING: Full context preserved across all tests    |
|  2. REAL-TIME FIXING: Fix bugs immediately when detected        |
|  3. NO BATCH LOOPS: No "collect bugs then fix loop"             |
|  4. TARGET: 95% pass rate (not 50%)                             |
|  5. EFFICIENCY: Faster completion due to shared context         |
|                                                                  |
|  WORKFLOW:                                                       |
|  Test -> Fail? -> Fix immediately -> Re-test -> Next            |
|                                                                  |
|  COST: 2x standard mode (200 points vs 100 points)              |
|                                                                  |
+================================================================+
```

---

## EXECUTION INSTRUCTIONS

**YOU ARE NOW IN EXECUTION MODE. THIS PROMPT CONTAINS ACTIVE TASKS YOU MUST PERFORM.**

```
+================================================================+
|  CRITICAL: DO NOT JUST READ THIS FILE - YOU MUST EXECUTE IT!    |
+================================================================+
|                                                                  |
|  This is an EXECUTION PROMPT, not documentation.                 |
|  You must IMMEDIATELY start executing the following steps:       |
|                                                                  |
|  1. Verify backend is running and discover port                  |
|  2. Open Swagger UI using Claude In Chrome tools                 |
|  3. Test ALL API endpoints one by one                            |
|  4. Fix ANY failure immediately (before moving to next endpoint) |
|  5. Continue until 95% pass rate achieved                        |
|                                                                  |
|  DO NOT exit until you have:                                     |
|    - Tested ALL API endpoints                                    |
|    - Fixed ALL bugs encountered                                  |
|    - Achieved 95% pass rate (or timeout reached)                 |
|    - Generated comprehensive test report                         |
|                                                                  |
+================================================================+
```

---

## Browser Automation Tools (Claude In Chrome)

Use these MCP tools for browser interaction:

| Tool | Usage |
|------|-------|
| `mcp__claude-in-chrome__tabs_context_mcp` | Get current browser tabs |
| `mcp__claude-in-chrome__tabs_create_mcp` | Create new browser tab |
| `mcp__claude-in-chrome__navigate` | Navigate to Swagger UI URL |
| `mcp__claude-in-chrome__read_page` | Read page content (accessibility tree) |
| `mcp__claude-in-chrome__find` | Find elements by natural language |
| `mcp__claude-in-chrome__computer` | Click, type, screenshot actions |
| `mcp__claude-in-chrome__form_input` | Fill form fields |
| `mcp__claude-in-chrome__javascript_tool` | Execute JavaScript on page |
| `mcp__claude-in-chrome__read_network_requests` | Monitor API responses |
| `mcp__claude-in-chrome__read_console_messages` | Check for errors |

**Advantages of Claude In Chrome**:
- Full context sharing across entire session
- Real-time bug fixing without context loss
- No need for separate bug collection phase
- More efficient for complex test scenarios

---

## Step 1: Pre-Test Setup

### ⛔⛔⛔ Step 1.0: MANDATORY MySQL Validation (SQLite FORBIDDEN) ⛔⛔⛔

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                   ║
║   CRITICAL: MYSQL IS MANDATORY - SQLITE IS ABSOLUTELY FORBIDDEN!                  ║
║                                                                                   ║
║   Phase 5B/5C tests MUST use the same MySQL database as production.               ║
║   Using SQLite makes tests meaningless - driver issues won't be detected!         ║
║                                                                                   ║
║   IF SQLITE DETECTED → STOP IMMEDIATELY → FIX → DO NOT PROCEED                    ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

**EXECUTE THIS VALIDATION BEFORE ANY OTHER STEP:**

```bash
# ============================================================
# MANDATORY: MySQL Validation (SQLite FORBIDDEN)
# ============================================================
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  MANDATORY DATABASE VALIDATION                              ║"
echo "╚════════════════════════════════════════════════════════════╝"

VALIDATION_FAILED=0

# Check 1: DATABASE_INFO.md must exist
if [ ! -f "DATABASE_INFO.md" ]; then
    echo "[FATAL] DATABASE_INFO.md not found!"
    echo "[FATAL] Cannot proceed without project database configuration"
    VALIDATION_FAILED=1
fi

# Check 2: backend/.env must NOT contain sqlite
if [ -f "backend/.env" ]; then
    if grep -qi "sqlite" "backend/.env"; then
        echo "[FATAL] ❌ SQLite detected in backend/.env!"
        echo "[FATAL] SQLite is FORBIDDEN - must use MySQL from DATABASE_INFO.md"
        grep -i "sqlite" "backend/.env"
        VALIDATION_FAILED=1
    fi

    # Check 3: DATABASE_URL must use mysql+aiomysql (async driver)
    DB_URL=$(grep "^DATABASE_URL=" "backend/.env" | head -1)
    if echo "$DB_URL" | grep -q "mysql+pymysql://"; then
        echo "[FATAL] ❌ DATABASE_URL uses pymysql (sync driver)!"
        echo "[FATAL] database.py uses create_async_engine which requires aiomysql"
        echo "[FATAL] Change to: mysql+aiomysql://"
        VALIDATION_FAILED=1
    fi

    if echo "$DB_URL" | grep -q "mysql+aiomysql://"; then
        echo "[OK] ✅ DATABASE_URL uses aiomysql (async driver)"
    fi

    # Check 4: Verify MySQL host is remote (not localhost with SQLite fallback)
    if echo "$DB_URL" | grep -qE "mysql.*@(localhost|127\.0\.0\.1):3306"; then
        echo "[WARNING] DATABASE_URL points to localhost MySQL"
        echo "[WARNING] Ensure this is not a fallback - should use DATABASE_INFO.md host"
    fi
else
    echo "[FATAL] backend/.env not found!"
    VALIDATION_FAILED=1
fi

# Check 5: Verify config.py doesn't have sqlite default
if [ -f "backend/app/core/config.py" ]; then
    if grep -qi "sqlite" "backend/app/core/config.py"; then
        echo "[FATAL] ❌ SQLite reference found in config.py!"
        grep -i "sqlite" "backend/app/core/config.py"
        VALIDATION_FAILED=1
    fi
fi

# STOP if validation failed
if [ "$VALIDATION_FAILED" -eq 1 ]; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║  ❌ DATABASE VALIDATION FAILED - CANNOT PROCEED!            ║"
    echo "╠════════════════════════════════════════════════════════════╣"
    echo "║  FIX REQUIRED:                                              ║"
    echo "║  1. Run: python3 .claude/scripts/update_env_from_database_info.py"
    echo "║  2. Ensure DATABASE_URL uses mysql+aiomysql:// (not pymysql)"
    echo "║  3. Remove any sqlite references                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    exit 1
fi

echo ""
echo "[OK] ✅ Database validation passed - MySQL configured correctly"
echo ""
```

**IF VALIDATION FAILS:**
1. Run `python3 .claude/scripts/update_env_from_database_info.py`
2. Edit `backend/.env` and change `mysql+pymysql://` to `mysql+aiomysql://`
3. Re-run validation until it passes
4. DO NOT proceed with tests until MySQL is properly configured

---

### Step 1.1: Discover Backend Port (Zero Hardcoding)

```bash
# Read port from backend/.env (Primary source)
# Priority: backend/.env > environment variable > fallback 8000
if [ -f "backend/.env" ]; then
    PORT=$(grep -E "^BACKEND_PORT=" backend/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
fi
PORT="${PORT:-${BACKEND_PORT:-8000}}"
echo "Backend port: $PORT"

# Verify backend is running
curl -s "http://localhost:$PORT/health" || curl -s "http://localhost:$PORT/openapi.json" | head -c 100
```

### Step 1.2: Verify Expected Endpoint Count (CRITICAL)

**⚠️ MANDATORY: Run endpoint verification BEFORE testing to establish the authoritative count.**

```bash
# Run endpoint verification script to get AUTHORITATIVE endpoint count
# This parses /openapi.json directly - no AI interpretation errors
python3 .claude/scripts/verify_api_endpoints.py --port $PORT --output test-logs/api_endpoint_verification.json

# Read the expected count from the verification result
if [ -f "test-logs/api_endpoint_verification.json" ]; then
    EXPECTED_ENDPOINTS=$(python3 -c "import json; print(json.load(open('test-logs/api_endpoint_verification.json'))['total_endpoints'])")
    echo "════════════════════════════════════════════════════════"
    echo "AUTHORITATIVE ENDPOINT COUNT: $EXPECTED_ENDPOINTS"
    echo "YOU MUST TEST ALL $EXPECTED_ENDPOINTS ENDPOINTS"
    echo "════════════════════════════════════════════════════════"
fi
```

**IMPORTANT**: The endpoint count from `verify_api_endpoints.py` is the ground truth.
- If you discover fewer endpoints in Swagger UI, you MISSED some
- Expand ALL categories and sections to ensure complete coverage

### Step 1.3: MANDATORY Test Data Seed (CRITICAL - DO NOT SKIP)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║  MANDATORY: CREATE TEST DATA BEFORE ANY API TESTING                              ║
║  テスト開始前にテストデータを必ず作成すること                                    ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  FORBIDDEN:                                                                       ║
║  ❌ Using hardcoded IDs (avatar_id=1, user_id=1, etc.)                           ║
║  ❌ Skipping this step and classifying 404s as "acceptable failures"              ║
║  ❌ Testing GET/PUT/DELETE without first creating the target resource             ║
║  ❌ Proceeding to API testing without test_data.json                              ║
║                                                                                   ║
║  REQUIRED:                                                                        ║
║  ✅ All IDs must come from actual POST/DB INSERT responses                        ║
║  ✅ 404 on GET/PUT/DELETE = missing data → re-seed → retry                        ║
║  ✅ Schema-Driven: field names and types from OpenAPI spec                        ║
║  ✅ FK resolution: create parent entities before child entities                    ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

**MANDATORY DATA CREATION FLOW (execute in order):**

1. **GET /openapi.json** → Retrieve all endpoint schemas
2. **Identify all POST endpoints** → These create resources
3. **Resolve dependency order** (parent → child):
   - Entities with no FK references are created FIRST (e.g., User, Category)
   - Entities with FK references are created AFTER their parents (e.g., Video needs User)
4. **Execute POST for each resource type** in dependency order:
   - Parse required fields from OpenAPI schema
   - Generate test values using Smart Field Mapping (see Step B/C below)
   - If POST returns 201/200: Record the created entity ID
   - If POST fails (402 payment/503 external): Fall back to direct DB insertion
5. **Save all created IDs to test-logs/test_data.json**

```bash
# After creating test data, save to JSON
mkdir -p test-logs
cat > test-logs/test_data.json << 'SEED_EOF'
{
  "created_at": "$(date -Iseconds)",
  "generator": "phase5b-api-seed",
  "entities": {
    "users": [{"id": <ACTUAL_CREATED_ID>, "email": "testuser@example.com"}],
    "categories": [{"id": <ACTUAL_CREATED_ID>, "name": "Test Category"}]
  },
  "creation_method": {
    "users": "POST /api/v1/users/",
    "categories": "POST /api/v1/categories/"
  }
}
SEED_EOF
echo "[SEED] Test data saved to test-logs/test_data.json"
```

**How to Use test_data.json (after seeding)**:
1. **GET /items/{id}**: Use IDs from `entities` (e.g., `entities.users[0].id`)
2. **PUT /items/{id}**: Use existing IDs to update records
3. **DELETE /items/{id}**: Use existing IDs (test LAST to avoid affecting other tests)
4. **POST /items**: Create new records (additional to seeded data)
5. **GET /items**: Verify list contains seeded entities

**If a 404 occurs during testing**: This means test data is missing. DO NOT classify as "acceptable failure". Instead:
1. Create the missing resource via POST or direct DB insertion
2. Record the new ID in test_data.json
3. Retry the failing test with the correct ID

- Cross-check your final tested count against EXPECTED_ENDPOINTS

### Step 1.4: Get Browser Context

```
TASK: Initialize Browser Context

1. Call mcp__claude-in-chrome__tabs_context_mcp to get available tabs
2. If no tabs exist in group, call mcp__claude-in-chrome__tabs_create_mcp
3. Save the tab ID for subsequent operations
```

### Step 1.4: Navigate to Swagger UI

```
TASK: Navigate to Swagger UI

1. Use navigate tool: mcp__claude-in-chrome__navigate(url="http://localhost:{PORT}/docs", tabId={TAB_ID})
2. Wait for page to load (use computer tool with "wait" action)
3. Take screenshot to confirm page loaded: mcp__claude-in-chrome__computer(action="screenshot", tabId={TAB_ID})
4. Use read_page to get accessibility tree: mcp__claude-in-chrome__read_page(tabId={TAB_ID})
```

---

## Step 2: Authentication Setup (MANDATORY FIRST)

```
+================================================================+
|  AUTHENTICATION IS MANDATORY - CANNOT SKIP!                      |
+================================================================+
|                                                                  |
|  IF AUTHENTICATION IS NOT COMPLETED:                             |
|  - Quality Gate = FAILED (regardless of individual test results) |
|  - 401 responses = ALL counted as FAILED                         |
|                                                                  |
|  IF AUTHENTICATION IS COMPLETED:                                 |
|  - 401 responses = FAILED (should not happen with valid token)   |
|  - 200/201/204 responses = PASSED                                |
|                                                                  |
+================================================================+
```

### Step 2.1: Login with Pre-Seeded Account

```
TASK: Login and Get JWT Token

1. Find and expand "auth" or "Authentication" category in Swagger UI
2. Locate POST /api/v1/auth/login endpoint
3. Click "Try it out" button using find tool or computer tool click
4. Fill credentials with PRE-SEEDED account:
   - Email: "admin@preview.example.com"
   - Password: "Test@123"
5. Click "Execute" button
6. Extract JWT token from response (access_token field)

IF LOGIN FAILS with 401:
   => IMMEDIATE FIX: Check api-backend-common-issues.md Pattern 8 (bcrypt issue)
   => Fix the code immediately
   => Restart backend
   => Retry login
```

### Step 2.2: Set Authorization in Swagger UI

```
TASK: Set Bearer Token

1. Find and click the green "Authorize" button (usually top-right)
2. In the dialog, find "bearerAuth" input field
3. Enter: Bearer {JWT_TOKEN}
4. Click "Authorize" button in dialog
5. Click "Close" to dismiss dialog
6. Take screenshot to confirm authorization is set

SAVE credentials for Phase 5C and Phase 7:
- Create test-logs/phase5b_test_user.json with email, password, token
```

---

## Step 2.5: Network Monitoring Setup (NEW - MANDATORY)

```
+================================================================+
|  NETWORK MONITORING - Verify ALL API Responses                   |
+================================================================+
|                                                                  |
|  CRITICAL: Every API call MUST be verified via Network monitor   |
|  - Use read_network_requests AFTER each endpoint test            |
|  - Verify: Status codes, response times, error bodies            |
|  - Detect: Slow APIs (>3s), failed requests, unexpected 4xx/5xx  |
|                                                                  |
+================================================================+
```

### Step 2.5.1: Initialize Network Monitoring

```
TASK: Setup Network Request Monitoring

1. Clear existing network requests:
   mcp__claude-in-chrome__read_network_requests(tabId={TAB_ID}, clear=true)

2. Verify monitoring is active:
   mcp__claude-in-chrome__read_network_requests(tabId={TAB_ID}, urlPattern="/api/")

3. Expected: Empty or minimal requests list (cleared state)
```

### Step 2.5.2: Network Verification Protocol

```
FOR EACH endpoint test:

1. BEFORE TEST:
   - Clear network: read_network_requests(clear=true)

2. EXECUTE TEST:
   - Perform the API call via Swagger UI

3. AFTER TEST:
   - Capture network: read_network_requests(urlPattern="/api/")
   - Verify response:

   | Check | Pass Criteria | Fail Action |
   |-------|--------------|-------------|
   | Status | 2xx or expected 4xx | Mark FAILED, fix |
   | Time | <3000ms | WARN: slow API |
   | Body | Valid JSON | Check serialization |
   | CORS | No CORS errors | Fix backend CORS |

4. RECORD in NETWORK_LOG:
   - Endpoint URL
   - HTTP method
   - Status code
   - Response time (ms)
   - Error details (if any)
```

### Step 2.5.3: Network Error Classification

```
NETWORK ERROR PATTERNS:

PATTERN: Connection Refused
  => Backend not running
  => Fix: Restart backend service

PATTERN: CORS Blocked
  => Backend CORS misconfigured
  => Fix: Add frontend origin to CORS settings
  => See: api-backend-common-issues.md Pattern 4

PATTERN: Timeout (>30s)
  => Database query slow or deadlock
  => Fix: Check database connections, add indexes

PATTERN: Empty Response
  => Handler not returning data
  => Fix: Check endpoint return statement

PATTERN: 502/503/504
  => Backend crashed or overloaded
  => Fix: Check logs, restart service
```

---


## ⚡ SMART TEST DATA GENERATION (SYSTEM-LEVEL - NO HARDCODING) ⚡

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║  CRITICAL: 422 VALIDATION ERROR PREVENTION - SCHEMA-DRIVEN TEST DATA             ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  ROOT CAUSE OF 422 ERRORS:                                                        ║
║  - Test data missing required fields (schema mismatch)                            ║
║  - Wrong field names (e.g., "message" instead of "content")                       ║
║  - Type mismatches (e.g., string instead of integer)                              ║
║                                                                                   ║
║  SOLUTION: Parse OpenAPI schema and generate data based on FIELD NAMES            ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### Step A: Fetch and Parse OpenAPI Schema

```bash
# Fetch OpenAPI schema (ZERO HARDCODING)
PORT=$(grep -E "^BACKEND_PORT=" backend/.env 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "8000")
curl -s "http://localhost:$PORT/openapi.json" > /tmp/openapi.json

# Verify schema was fetched
if [ ! -s /tmp/openapi.json ]; then
    echo "[ERROR] Failed to fetch OpenAPI schema"
    exit 1
fi
```

### Step A.1: VALIDATION RULES (422 Prevention)

```
┌────────────────────────────────────────────────────────────────────────┐
│ FIELD TYPE    │ VALIDATION RULE                                       │
├────────────────────────────────────────────────────────────────────────┤
│ username      │ ASCII ONLY: [a-zA-Z0-9_] - NO Chinese/spaces/hyphens  │
│ password      │ 8+ chars, must have: uppercase + lowercase + digit    │
│ enum values   │ ALWAYS lowercase (e.g., "active" not "ACTIVE")        │
│ *_id fields   │ Create entity via POST first, then use returned ID    │
└────────────────────────────────────────────────────────────────────────┘

BEFORE generating test data, CHECK OpenAPI schema for:
- "pattern" constraint → follow the regex
- "enum" constraint → use first value (lowercase)
- "minLength/maxLength" → respect bounds
```

### Step B: Smart Field Name → Value Mapping (PRIORITY ORDER)

**⚠️ CRITICAL: Match field NAME first, then fall back to TYPE!**

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║  FIELD NAME PATTERNS → SMART DEFAULT VALUES                                       ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐ ║
║  │ PATTERN (case-insensitive)  │ DEFAULT VALUE                                 │ ║
║  ├─────────────────────────────────────────────────────────────────────────────┤ ║
║  │ *email*                     │ "test@example.com"                            │ ║
║  │ *password*, *passwd*        │ "Test@123"                                    │ ║
║  │ *token*, *access_token*     │ "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"   │ ║
║  │ *refresh_token*             │ "refresh_token_123"                           │ ║
║  ├─────────────────────────────────────────────────────────────────────────────┤ ║
║  │ *user_id*                   │ 1                                             │ ║
║  │ *avatar_id*                 │ 1                                             │ ║
║  │ *video_id*, *project_id*    │ 1                                             │ ║
║  │ *session_id*                │ "test-session-123"                            │ ║
║  │ *role_id*                   │ "test-role-123"                               │ ║
║  │ *job_id*                    │ "test-job-123"                                │ ║
║  │ *plan_id*, *method_id*      │ 1                                             │ ║
║  │ *payment_method_id*         │ "pm_test_123"                                 │ ║
║  ├─────────────────────────────────────────────────────────────────────────────┤ ║
║  │ *url*, *_url (suffix)       │ "https://example.com/test"                    │ ║
║  │ *image_url*                 │ "https://example.com/image.jpg"               │ ║
║  │ *audio_url*                 │ "https://example.com/audio.mp3"               │ ║
║  │ *video_url*                 │ "https://example.com/video.mp4"               │ ║
║  │ *callback_url*              │ "https://example.com/callback"                │ ║
║  ├─────────────────────────────────────────────────────────────────────────────┤ ║
║  │ *content*, *message*        │ "Test content message"                        │ ║
║  │ *text*, *script*            │ "Test text content"                           │ ║
║  │ *description*, *desc*       │ "Test description"                            │ ║
║  │ *title*                     │ "Test Title"                                  │ ║
║  │ *name*, *full_name*         │ "Test Name"                                   │ ║
║  ├─────────────────────────────────────────────────────────────────────────────┤ ║
║  │ *voice_id*, *voice_type*    │ "zh_female_1"                                 │ ║
║  │ *language*, *lang*          │ "zh"                                          │ ║
║  │ *feature*                   │ "realtime_interaction"                        │ ║
║  │ *session_type*              │ "text"                                        │ ║
║  │ *video_type*                │ "short"                                       │ ║
║  │ *provider*                  │ "stripe"                                      │ ║
║  │ *status*                    │ "active"                                      │ ║
║  │ *reason*                    │ "Test reason"                                 │ ║
║  ├─────────────────────────────────────────────────────────────────────────────┤ ║
║  │ *amount*, *credits*         │ 10                                            │ ║
║  │ *page*                      │ 1                                             │ ║
║  │ *limit*, *page_size*        │ 20                                            │ ║
║  │ *duration*                  │ 60                                            │ ║
║  │ *width*                     │ 1920                                          │ ║
║  │ *height*                    │ 1080                                          │ ║
║  └─────────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                   ║
║  FALLBACK (if no pattern matches):                                                ║
║  - string  → "test_string"                                                        ║
║  - integer → 1                                                                    ║
║  - number  → 1.0                                                                  ║
║  - boolean → true                                                                 ║
║  - array   → []                                                                   ║
║  - enum    → first option from enum list                                          ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### Step C: Schema-Driven Test Data Generation Algorithm

```python
# PSEUDOCODE - Implement in your test script
def generate_test_data_from_schema(openapi_spec, path, method):
    """
    Generate test data by parsing OpenAPI schema - NO HARDCODING

    Priority:
    1. Use "example" from schema if exists
    2. Use "default" from schema if exists
    3. Use first "enum" value if exists
    4. Match field NAME pattern (see table above)
    5. Fall back to TYPE default
    """

    # Get request body schema
    operation = openapi_spec["paths"][path][method.lower()]
    request_body = operation.get("requestBody", {})
    content = request_body.get("content", {}).get("application/json", {})
    schema = content.get("schema", {})

    # Resolve $ref if needed
    if "$ref" in schema:
        ref_path = schema["$ref"].split("/")  # "#/components/schemas/ModelName"
        schema = openapi_spec["components"]["schemas"][ref_path[-1]]

    # Generate data for required fields
    test_data = {}
    required_fields = schema.get("required", [])
    properties = schema.get("properties", {})

    for field_name in required_fields:
        field_schema = properties.get(field_name, {})

        # Priority 1: Use example
        if "example" in field_schema:
            test_data[field_name] = field_schema["example"]
            continue

        # Priority 2: Use default
        if "default" in field_schema:
            test_data[field_name] = field_schema["default"]
            continue

        # Priority 3: Use first enum value
        if "enum" in field_schema:
            test_data[field_name] = field_schema["enum"][0]
            continue

        # Priority 4: Match field name pattern (see FIELD_PATTERNS table)
        test_data[field_name] = get_smart_default_by_name(field_name, field_schema)

    return test_data


def get_smart_default_by_name(field_name, field_schema):
    """Match field name pattern to get smart default value"""
    name_lower = field_name.lower()

    # ID fields
    if "email" in name_lower: return "test@example.com"
    if "password" in name_lower: return "Test@123"
    if "access_token" in name_lower: return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"
    if "refresh_token" in name_lower: return "refresh_token_123"
    if "token" in name_lower: return "test_token_123"

    # Numeric IDs
    if "user_id" in name_lower: return 1
    if "avatar_id" in name_lower: return 1
    if "video_id" in name_lower: return 1
    if "project_id" in name_lower: return 1
    if "plan_id" in name_lower: return 1
    if name_lower.endswith("_id") and field_schema.get("type") == "integer": return 1

    # String IDs
    if "session_id" in name_lower: return "test-session-123"
    if "role_id" in name_lower: return "test-role-123"
    if "job_id" in name_lower: return "test-job-123"
    if "payment_method_id" in name_lower: return "pm_test_123"

    # URLs
    if "image_url" in name_lower: return "https://example.com/image.jpg"
    if "audio_url" in name_lower: return "https://example.com/audio.mp3"
    if "video_url" in name_lower: return "https://example.com/video.mp4"
    if "callback_url" in name_lower: return "https://example.com/callback"
    if "url" in name_lower or name_lower.endswith("_url"): return "https://example.com/test"

    # Content fields
    if "content" in name_lower: return "Test content message"
    if "message" in name_lower: return "Test message"
    if "text" in name_lower: return "Test text content"
    if "script" in name_lower: return "Test script content"
    if "description" in name_lower or name_lower == "desc": return "Test description"
    if "title" in name_lower: return "Test Title"
    if "name" in name_lower or "full_name" in name_lower: return "Test Name"

    # Config fields
    if "voice_type" in name_lower or "voice_id" in name_lower: return "zh_female_1"
    if "feature" in name_lower: return "realtime_interaction"
    if "session_type" in name_lower: return "text"
    if "video_type" in name_lower: return "short"
    if "reason" in name_lower: return "Test reason"

    # Numeric fields
    if "amount" in name_lower or "credits" in name_lower: return 10
    if "page" in name_lower and "size" not in name_lower: return 1
    if "limit" in name_lower or "page_size" in name_lower: return 20
    if "duration" in name_lower: return 60

    # Fall back to type default
    field_type = field_schema.get("type", "string")
    TYPE_DEFAULTS = {
        "string": "test_string",
        "integer": 1,
        "number": 1.0,
        "boolean": True,
        "array": [],
        "object": {}
    }
    return TYPE_DEFAULTS.get(field_type, "test")
```

### Step D: Validation Before Test Execution

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║  PRE-FLIGHT CHECK: VALIDATE TEST DATA BEFORE SENDING REQUEST                      ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  BEFORE executing each API test:                                                  ║
║                                                                                   ║
║  1. Parse endpoint's request body schema from /openapi.json                       ║
║  2. Identify ALL required fields (schema.required array)                          ║
║  3. Generate test data using the algorithm above                                  ║
║  4. VERIFY all required fields are present in test data                           ║
║  5. ONLY THEN execute the API call                                                ║
║                                                                                   ║
║  IF validation fails:                                                              ║
║  - Log: "[WARN] Missing required field: {field_name}"                             ║
║  - Add missing field with smart default value                                     ║
║  - Continue with corrected test data                                              ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```


---

## Step 3: API Testing with Real-Time Bug Fixing

### Testing Algorithm (Efficient Mode)

```
ALGORITHM: Real-Time Test and Fix

INITIALIZATION:
- TEST_RESULTS = []
- BUGS_FIXED = []
- pass_count = 0
- fail_count = 0
- fix_count = 0

FOR EACH endpoint in API inventory:

    1. TEST THE ENDPOINT:
       - Navigate to endpoint in Swagger UI
       - Click "Try it out"
       - Fill required parameters (from schema examples)
       - Click "Execute"
       - Capture response status and body

    2. EVALUATE RESULT:
       IF status_code in [200, 201, 204]:
           result = "PASSED"
           pass_count += 1
           CONTINUE to next endpoint

       ELSE:
           result = "FAILED"
           fail_count += 1

    3. IMMEDIATE BUG FIX (Efficient Mode Key Feature):

       IF status_code == 500:
           - Read api-backend-common-issues.md
           - Check backend logs for stack trace
           - Identify and fix the bug
           - Restart backend if needed
           - RETRY the same endpoint

       IF status_code == 401/403:
           - Check token validity
           - Check api-backend-common-issues.md Pattern 8 (bcrypt)
           - Fix authentication code
           - RETRY the same endpoint

       IF status_code == 404:
           - Check if endpoint path is correct
           - If missing, implement the endpoint
           - RETRY the same endpoint

       IF status_code == 422:
           ⚡ MUST READ ERROR RESPONSE AND FIX INPUT DATA! ⚡
           1. Read Swagger UI response body - it shows EXACTLY what's missing:
              {"detail": [{"loc": ["body", "field_name"], "msg": "Field required"}]}
           2. Use read_network_requests to capture full error if needed
           3. Identify missing/invalid field from error "loc" array
           4. Add field with SMART DEFAULT (see api-backend-common-issues.md Section 4):
              - *password* → "Test@123"
              - *current_password* → "Test@123"
              - *email* → "test@example.com"
              - *name* → "Test User"
              - *_id (integer) → 1
           5. RETRY with corrected data
           DO NOT skip 422 as "validation error" - FIX IT!

    4. AFTER FIX:
       fix_count += 1
       BUGS_FIXED.append({endpoint, original_error, fix_applied})

       # Re-test after fix
       GOTO step 1 for same endpoint

       IF still fails after 3 fix attempts:
           LOG: "Unable to fix after 3 attempts"
           TEST_RESULTS.append({endpoint, "FAILED", attempts=3})
           CONTINUE to next endpoint

    5. RECORD FINAL RESULT:
       TEST_RESULTS.append({endpoint, result, fix_attempts})

END FOR

FINAL STATS:
- Total tested: len(TEST_RESULTS)
- Passed: pass_count
- Failed: fail_count
- Bugs fixed: fix_count
- Pass rate: pass_count / len(TEST_RESULTS) * 100
```

### Bug Fix Reference Guide

```
+================================================================+
|  MANDATORY: READ api-backend-common-issues.md BEFORE FIXING!     |
+================================================================+

FOR EACH BUG, APPLY THE CORRECT PATTERN:

HTTP 401 - Unauthorized:
  => Pattern 8: bcrypt/passlib compatibility
  => Fix: Pin bcrypt==4.0.1 in requirements.txt
  => Restart backend

HTTP 404 - Not Found:
  => Check endpoint path in router definition
  => Fix: Add missing route or correct path
  => No restart needed (if using --reload)

HTTP 422 - Validation Error:
  => Read error message for field and constraint
  => Fix: Adjust test data or schema validation
  => May need to update OpenAPI examples

HTTP 500 - Server Error:
  => Check backend logs: tail -100 backend/app.log
  => Common causes: NoneType, IntegrityError, AttributeError
  => Fix the specific Python code issue
  => Restart backend

+================================================================+
```

---


---

## ⚡⚡⚡ DYNAMIC TEST DATA CREATION (v2.0 - NO HARDCODING) ⚡⚡⚡

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║  CRITICAL: AI-DRIVEN DYNAMIC TEST DATA CREATION                                    ║
║  テストデータは AI が動的に作成する（ハードコード禁止！！！）                      ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  OLD APPROACH (DEPRECATED - DO NOT USE):                                          ║
║  ❌ Pre-defined seeding scripts with hardcoded models                             ║
║  ❌ auto_seed_for_test.py with hardcoded User/Product/Category                    ║
║                                                                                   ║
║  NEW APPROACH (MANDATORY):                                                        ║
║  ✅ AI detects 404 error during testing                                           ║
║  ✅ AI analyzes OpenAPI schema to understand resource structure                   ║
║  ✅ AI attempts to CREATE the resource via POST endpoint                          ║
║  ✅ If POST fails (402 payment/etc), AI creates via direct DB insertion           ║
║  ✅ AI re-tests the original failing endpoint                                     ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### Dynamic Test Data Algorithm

```
ALGORITHM: AI-Driven Test Data Creation on 404

WHEN you encounter a 404 on GET/PUT/DELETE /api/v1/{resource}/{id}:

1. IDENTIFY THE RESOURCE:
   - Extract resource type from URL path (e.g., "videos", "files", "users")
   - Find corresponding POST endpoint in OpenAPI spec
   - Parse the request body schema for POST endpoint

2. ATTEMPT CREATION VIA API (First Choice):
   a. Navigate to POST /api/v1/{resource}/ in Swagger UI
   b. Parse required fields from OpenAPI schema (ZERO HARDCODING)
   c. Generate test data using SMART FIELD MAPPING (see Step B above)
   d. Execute POST request
   e. IF status 201/200: Record created ID → Re-test original endpoint

3. IF API CREATION FAILS (402 Payment Required, 503 External Service, etc):
   => FALL BACK TO DIRECT DB INSERTION

   a. Identify the model class:
      - Parse backend/app/models/__init__.py
      - Find class matching resource name (videos → Video, files → UploadedFile)

   b. Inspect model schema dynamically:
      ```python
      # Run in sandbox to get model fields
      cd backend && python3 -c "
      from sqlalchemy import inspect
      from app.models import {ModelName}
      mapper = inspect({ModelName})
      for col in mapper.columns:
          nullable = 'optional' if col.nullable else 'REQUIRED'
          print(f'{col.name}: {col.type} ({nullable})')
      "
      ```

   c. Generate INSERT statement with ONLY required fields:
      ```python
      # Dynamic insertion - fields discovered at runtime
      cd backend && python3 -c "
      import asyncio
      from app.models import {ModelName}

      # Step 1: Discover database module path (project-specific)
      def find_session_factory():
          patterns = [
              ('app.database', 'async_session', 'AsyncSessionLocal', 'get_db', 'SessionLocal'),
              ('app.core.database', 'async_session_factory', 'AsyncSessionLocal', 'get_db'),
              ('app.db', 'async_session', 'SessionLocal'),
              ('database', 'async_session', 'SessionLocal'),
          ]
          for module_path, *session_names in patterns:
              try:
                  mod = __import__(module_path, fromlist=[''])
                  for name in session_names:
                      if hasattr(mod, name):
                          return getattr(mod, name)
              except ImportError:
                  continue
          return None
      session_factory = find_session_factory()

      async def create_test_data():
          async with session_factory() as session:
              # Dynamically build data based on schema inspection
              data = {discovered_required_fields}
              entity = {ModelName}(**data)
              session.add(entity)
              await session.commit()
              await session.refresh(entity)
              print(f'Created {ModelName} with ID: {entity.id}')
              return entity.id

      asyncio.run(create_test_data())
      "
      ```

   d. Record created ID → Re-test original endpoint

4. AFTER SUCCESSFUL CREATION:
   - Update test results: Change 404 → Re-test result
   - Log: "[DYNAMIC-DATA] Created {resource} ID={id} for testing"

5. IF STILL FAILING AFTER DATA CREATION:
   - This is a REAL BUG, not missing data
   - Proceed with normal bug fixing workflow
```

### Smart Field Value Generation for Dynamic Creation

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║  FIELD DETECTION → VALUE GENERATION (Runtime, NOT Hardcoded)                      ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  Step 1: Get required fields from model at RUNTIME                                ║
║  Step 2: For each field, determine value based on:                                ║
║    a. Field NAME pattern matching (email → "test@example.com")                    ║
║    b. Field TYPE (integer → 1, string → "test_value")                             ║
║    c. Foreign key constraints (user_id → query first User.id)                     ║
║    d. Enum constraints (status → first enum value)                                ║
║                                                                                   ║
║  FOREIGN KEY RESOLUTION (CRITICAL):                                               ║
║  - If field ends with "_id" AND is foreign key:                                   ║
║    → Query the referenced table for first existing ID                             ║
║    → If no data exists, recursively create parent entity first                    ║
║                                                                                   ║
║  Example Flow for Video creation:                                                 ║
║  1. Inspect Video model → requires user_id (FK to users)                          ║
║  2. Query: SELECT id FROM users LIMIT 1                                           ║
║  3. If user exists: user_id = result                                              ║
║  4. If no user: Create User first → get user_id → then create Video               ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### Example: Handling Video Endpoint 404

```
SCENARIO: Testing GET /api/v1/videos/{video_id} returns 404

AI ACTIONS:
1. [DETECT] "GET /api/v1/videos/1 returned 404 - resource not found"

2. [ANALYZE] Parse /openapi.json for POST /api/v1/videos/ schema:
   - Required: user_id, video_type, title, input_text, voice_type, status, credits_used
   - Optional: video_url, thumbnail_url, duration_seconds, etc.

3. [ATTEMPT API] Try POST /api/v1/videos/:
   - Generate data from schema
   - Execute request
   - Result: 402 Payment Required (external AI service)

4. [FALLBACK DB] Direct DB insertion:
   ```bash
   cd backend && python3 -c "
   import asyncio
   from app.models.video import Video
   from sqlalchemy import select

   # Dynamic database module discovery (project-agnostic)
   def find_session_factory():
       patterns = [
           ('app.database', 'async_session', 'AsyncSessionLocal', 'get_db', 'SessionLocal'),
           ('app.core.database', 'async_session_factory', 'AsyncSessionLocal', 'get_db'),
           ('app.db', 'async_session', 'SessionLocal'),
           ('database', 'async_session', 'SessionLocal'),
       ]
       for module_path, *session_names in patterns:
           try:
               mod = __import__(module_path, fromlist=[''])
               for name in session_names:
                   if hasattr(mod, name):
                       return getattr(mod, name)
           except ImportError:
               continue
       return None
   session_factory = find_session_factory()

   async def create():
       async with session_factory() as session:
           # Get first user_id dynamically
           from app.models.user import User
           result = await session.execute(select(User.id).limit(1))
           user_id = result.scalar_one_or_none() or 1

           video = Video(
               user_id=user_id,
               video_type='short',
               title='Test Video for API Testing',
               input_text='Test input text',
               voice_type='default',
               status='completed',
               credits_used=0
           )
           session.add(video)
           await session.commit()
           await session.refresh(video)
           print(f'VIDEO_ID={video.id}')

   asyncio.run(create())
   "
   ```

5. [RE-TEST] Execute GET /api/v1/videos/{created_id}
   - Expected: 200 OK with video data

6. [RECORD] Update results: video endpoint now PASSED
```

### DO NOT Section (Prohibited Approaches)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║  ❌ DO NOT DO THESE (Hardcoding Anti-Patterns)                                    ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  ❌ DO NOT use pre-written seed scripts with hardcoded model lists                ║
║     Wrong: for model in ['User', 'Product', 'Video']:                             ║
║                                                                                   ║
║  ❌ DO NOT hardcode field names in seed scripts                                   ║
║     Wrong: video = Video(title='Test', status='completed')                        ║
║                                                                                   ║
║  ❌ DO NOT assume table/model names without inspection                            ║
║     Wrong: from app.models.video import Video  # might not exist                  ║
║                                                                                   ║
║  ❌ DO NOT skip foreign key resolution                                            ║
║     Wrong: video = Video(user_id=1, ...)  # user 1 might not exist                ║
║                                                                                   ║
║  ✅ DO inspect model at runtime                                                   ║
║  ✅ DO discover required fields dynamically                                       ║
║  ✅ DO resolve foreign keys by querying related tables                            ║
║  ✅ DO attempt API creation first, DB fallback second                             ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

---

## Step 4: Quality Gate Evaluation

### Target: 95% Pass Rate

```
QUALITY GATE CRITERIA (Efficient Mode):

Target: 95% pass rate (95% of endpoints must pass)

+----------------------------------------------------------------+
| Pass Rate | Quality Gate | Action Required                      |
+----------------------------------------------------------------+
| >=95%     | PASSED       | Proceed to Phase 5C                 |
| 80-94%    | WARN         | Document remaining issues, proceed   |
| 50-79%    | FAILED       | Should not happen in efficient mode  |
| <50%      | CRITICAL     | Major issues - investigate           |
+----------------------------------------------------------------+

NOTE: In efficient mode, bugs are fixed in real-time.
If pass rate is below 95%, investigate why fixes didn't work.
```

---

## Step 5: Generate Final Report

### Step 5.1: Generate JSON Results (MANDATORY - Iteration Loop Depends On This)

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║  ⚠️ CRITICAL: CREATE THIS JSON FILE IMMEDIATELY AFTER TESTING COMPLETES!          ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  FILENAME MUST BE EXACTLY: test-logs/phase5b_efficient_test_results.json          ║
║                                                                                   ║
║  WHY: The iteration loop reads this file to determine pass_rate                   ║
║  - If file doesn't exist → loop shows 0% → unnecessary re-runs                    ║
║  - If filename is wrong → loop can't find it → shows 0%                           ║
║                                                                                   ║
║  CREATE THIS FILE AS YOUR FIRST ACTION AFTER TESTING!                             ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

**⚠️ CRITICAL: You MUST create this JSON file BEFORE the Markdown report.**
**Without this file, the iteration loop cannot read pass_rate and will always show 0%.**

```bash
# Calculate values from your test results
PASS_COUNT=<number of passed endpoints>
FAIL_COUNT=<number of failed endpoints>
TOTAL_TESTED=$((PASS_COUNT + FAIL_COUNT))
PASS_RATE=$(python3 -c "print(round(100 * $PASS_COUNT / max($TOTAL_TESTED, 1), 1))")
BUGS_FIXED=<number of bugs fixed during testing>

# External service exclusions ONLY for adjusted rate
# NOTE: Missing Test Data (404) is NO LONGER excluded - you MUST re-seed and retry
EXT_SVC_COUNT=<count of 502/503 external service failures>
MISSING_DATA_COUNT=0  # Should be 0 after mandatory re-seed step
EXCLUDED=$((EXT_SVC_COUNT))
ADJUSTED_TOTAL=$((TOTAL_TESTED - EXCLUDED))
ADJUSTED_PASS_RATE=$(python3 -c "print(round(100 * $PASS_COUNT / max($ADJUSTED_TOTAL, 1), 1))")

mkdir -p test-logs
cat > test-logs/phase5b_efficient_test_results.json << EOF
{
  "phase": "5b",
  "mode": "efficient",
  "total_tested": $TOTAL_TESTED,
  "passed": $PASS_COUNT,
  "failed": $FAIL_COUNT,
  "pass_rate": $PASS_RATE,
  "adjusted_pass_rate": $ADJUSTED_PASS_RATE,
  "bugs_fixed": $BUGS_FIXED,
  "exclusions": {
    "external_services": $EXT_SVC_COUNT,
    "missing_test_data": $MISSING_DATA_COUNT, "_note": "should be 0 after mandatory re-seed",
    "total_excluded": $EXCLUDED
  },
  "timestamp": "$(date -Iseconds)"
}
EOF
echo "[PHASE5B] JSON results saved to test-logs/phase5b_efficient_test_results.json"
cat test-logs/phase5b_efficient_test_results.json
```

### Step 5.2: Generate Markdown Report

Create comprehensive test report:

```
TASK: Generate Final Report

Create: test-logs/PHASE5B_EFFICIENT_REPORT.md

## Phase 5B API Test Report (Efficient Mode)

### Summary

| Metric | Value |
|--------|-------|
| **Mode** | Efficient (Claude In Chrome) |
| **Expected Endpoints** | {from api_endpoint_verification.json} |
| **Tested Endpoints** | {total} |
| **Coverage** | {tested/expected * 100}% |
| **Passed** | {pass_count} |
| **Failed** | {fail_count} |
| **Bugs Fixed** | {fix_count} |
| **Pass Rate** | {pass_rate}% |
| **Adjusted Pass Rate** | {adjusted_pass_rate}% |
| **Quality Gate** | {PASSED/FAILED} |
| **Authentication** | {Token Set / None} |

**⚠️ COVERAGE CHECK**: If Tested Endpoints < Expected Endpoints, some APIs were missed!

### Failure Categorization (for Adjusted Pass Rate)

Categorize EACH failure into one of these categories:

| Category | Count | Excluded | Criteria |
|----------|-------|----------|----------|
| **External Services** | {ext_svc_count} | Yes | 503/502 errors, AI API failures, Stripe/Payment service errors |
| **Missing Test Data** | {missing_data_count} | **No** | 404 on GET/PUT/DELETE - must re-seed and retry (should be 0) |
| **Validation Errors** | {validation_count} | No | 422/400 errors due to request format issues |
| **Auth Errors** | {auth_count} | No | 401/403 errors (should not occur if auth is set up) |
| **Real Bugs** | {real_bug_count} | No | 500 errors, unexpected behavior, logic errors |

**Adjusted Pass Rate Calculation**:
```
excluded_failures = ext_svc_count  (ONLY external services)
adjusted_total = total - excluded_failures
adjusted_pass_rate = (pass_count / adjusted_total) * 100

Example:
  Total: 72, Passed: 58, Failed: 14
  External Services: 13
  Excluded: 13
  Adjusted Total: 72 - 13 = 59
  Adjusted Pass Rate: 58 / 59 * 100 = 98.3%
```

> **Note**: Adjusted Pass Rate excludes ONLY external service failures (502/503).
> Missing Test Data (404) is NO LONGER excluded — you MUST re-seed data and retry.
> If 404s remain after re-seed attempts, they are counted as real failures.

### Bugs Fixed During Testing

| # | Endpoint | Original Error | Fix Applied |
|---|----------|----------------|-------------|
| 1 | {endpoint} | {error} | {fix_description} |
| ... | ... | ... | ... |

### Remaining Issues (Categorized)

| # | Endpoint | Error | Category | Excluded |
|---|----------|-------|----------|----------|
| 1 | POST /api/v1/ai/... | 503 Service Unavailable | External Services | Yes |
| 2 | GET /api/v1/users/{id} | 404 Not Found | Missing Test Data | **No** (must re-seed) |
| 3 | POST /api/v1/... | 422 Validation Error | Validation Errors | No |
| ... | ... | ... | ... | ... |

### Detailed Results

| # | Method | Endpoint | Status | Category | Result |
|---|--------|----------|--------|----------|--------|
| ... | ... | ... | ... | ... | ... |
```

---

## Step 6: Save Test Credentials for Subsequent Phases

```bash
# Save credentials for Phase 5C and Phase 7
mkdir -p test-logs
cat > test-logs/phase5b_test_user.json << EOF
{
  "email": "${TEST_USER_EMAIL}",
  "password": "${TEST_USER_PASSWORD}",
  "name": "Admin Test",
  "auth_token": "${AUTH_TOKEN}",
  "created_at": "$(date -Iseconds)",
  "test_mode": "efficient",
  "auth_completed": true
}
EOF
echo "[INFO] Test credentials saved to test-logs/phase5b_test_user.json"
```

---

## Step 7: Commit Test Results

```bash
# Navigate to workspace root
cd "${WORKSPACE_DIR:-/workspace}"

echo "[GIT] Adding Phase 5B Efficient Mode test results..."

# Add all Phase 5B test artifacts
for FILE in \
    "test-logs/phase5b_efficient_test_results.json" \
    "test-logs/PHASE5B_EFFICIENT_REPORT.md" \
    "test-logs/phase5b_test_user.json" \
    "test-logs/phase5b_bugs_fixed.json"; do
    if [ -f "$FILE" ]; then
        git add "$FILE" 2>/dev/null || true
        echo "[GIT] Added: $FILE"
    fi
done

# Commit if changes exist
if ! git diff --cached --quiet; then
    git commit -m "Phase 5B (Efficient Mode): API test results

- Real-time bug fixing completed
- Test mode: Claude In Chrome
- Pass rate: ${PASS_RATE}%"

    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    git push origin "$CURRENT_BRANCH"
    echo "[GIT] Phase 5B results committed successfully"
fi
```

---

## Reference Documents

- **Bug Fix Guide**: `.claude/prompts/api-backend-common-issues.md`
- **Test Configuration**: `.claude/config/phase5-global-config.json`
- **Standard Mode Prompt**: `.claude/prompts/phase5b-api-tests.md`

---

## Notes

- **Context Sharing**: Full context is preserved - no need to re-read files
- **Immediate Fixing**: Fix bugs as soon as they're detected
- **95% Target**: Aim for 95% success rate, not partial (50%)
- **Cost**: This mode costs 2x standard mode points
- **Efficiency**: Typically faster despite higher target due to no batch loops
