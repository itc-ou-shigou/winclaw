# Phase 5C: Comprehensive UI Testing with Claude In Chrome (Efficient Mode)

**Version**: 3.1 (6-GATE UNFORGEABLE VERIFICATION SYSTEM + Iteration Loop Control)
**Execution Mode**: Efficient Mode - Uses Claude In Chrome for context sharing
**Target Pass Rate**: 100% (real-time bug fixing until all tests pass)
**Timeout**: 7200 seconds (2 hours)
**Max Iterations**: 15 (configurable via BUGFIX_MAX_ITERATIONS)
**Early Exit**: 3 consecutive iterations without improvement
**Mandatory References**:

- `.claude/prompts/react-spa-common-issues.md` - React/Frontend bug fixes (MUST READ)
- `.claude/prompts/api-backend-common-issues.md` - API/Backend bug fixes (MUST READ)
  **Execution Mode**: `claude --dangerously-skip-permissions` (uses Claude In Chrome MCP server)

---

## ⚠️ HOW TO RUN THIS TEST

**IMPORTANT**: This prompt must be executed via Claude CLI, which will use Claude In Chrome MCP tools.

### Method 1: Direct Claude CLI Call (Single Iteration)

```bash
# Run from project root (where DATABASE_INFO.md exists)
claude --dangerously-skip-permissions -p "请阅读并执行 references/prompts/phase5c-ui-tests-efficient.md 中的所有测试步骤"
```

### Method 2: Iteration Loop Script (Recommended)

```bash
# Run with WORKSPACE_DIR pointing to the project root
WORKSPACE_DIR=/path/to/project bash references/scripts/phase5c-efficient-loop.sh
```

### Prerequisites

1. **Chrome Browser**: Must have Claude In Chrome extension installed and active
2. **Frontend**: Must be running on the configured port (usually 3000)
3. **Backend**: Must be running for API calls
4. **Test User**: Phase 5B test user credentials in test-logs/phase5b_test_user.json
5. **MCP Server**: Claude In Chrome MCP server must be connected

### Environment Variables (Optional)

```bash
export BUGFIX_MAX_ITERATIONS=15      # Max loop iterations
export BUGFIX_TARGET_PASS_RATE=100   # Target pass rate (100% for Phase 5C)
export BUGFIX_EARLY_EXIT_THRESHOLD=3 # Early exit threshold
```

---

## ⛔ CRITICAL: Iteration Loop Control (v3.1) ⛔

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║  ITERATION LOOP CONFIGURATION (v3.1)                                              ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  MAX_ITERATIONS: 15 (default)                                                     ║
║  - Can be overridden via BUGFIX_MAX_ITERATIONS environment variable               ║
║  - Read from: phase5-global-config.json or frontend/.env                          ║
║                                                                                   ║
║  TARGET_PASS_RATE: 100%                                                           ║
║  - Phase 5C requires 100% pass rate (all pages must pass)                        ║
║  - Loop continues until all pages pass OR max iterations reached                 ║
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
ALGORITHM: Iterative UI Bug Fix Loop

INITIALIZATION:
  iteration = 1
  max_iterations = read_config("BUGFIX_MAX_ITERATIONS", 15)
  target_pass_rate = 100  # Phase 5C requires 100%
  early_exit_threshold = 3
  no_improvement_count = 0
  previous_pass_rate = 0

LOOP:
  WHILE iteration <= max_iterations:

    1. EXECUTE UI TEST PHASE:
       - Test ALL pages with 4 CORE TESTS
       - Run 6-GATE verification per page
       - Record results in JSON format
       - Calculate pass_rate

    2. CHECK PASS RATE:
       IF pass_rate >= target_pass_rate (100%):
           LOG "All pages passed!"
           BREAK LOOP (SUCCESS)

    3. ANALYZE FAILURES:
       - Categorize by GATE failure (1-6)
       - Identify root cause for each failure
       - Check react-spa-common-issues.md for fix patterns

    4. EXECUTE FIX PHASE:
       - Apply UI bug fixes
       - Rebuild frontend if CSS changes
       - Fix API endpoints if Network errors
       - Fix React components if Console errors

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

### Configuration Loading

```bash
# Load iteration configuration
MAX_ITERATIONS=$(python3 -c "
import os, json
env_val = os.environ.get('BUGFIX_MAX_ITERATIONS')
if env_val and env_val.isdigit():
    print(env_val)
else:
    try:
        with open('.claude/config/phase5-global-config.json') as f:
            cfg = json.load(f)
            print(cfg.get('ralph_wiggum', {}).get('phase5c_bugfix', {}).get('max_iterations', 15))
    except: print(15)
" 2>/dev/null || echo "15")

TARGET_PASS_RATE=100  # Phase 5C requires 100%
EARLY_EXIT_THRESHOLD=3

echo "Max iterations: $MAX_ITERATIONS"
echo "Target pass rate: $TARGET_PASS_RATE%"
echo "Early exit threshold: $EARLY_EXIT_THRESHOLD"
```

---

## ⛔⛔⛔ ABSOLUTELY MANDATORY: 4 CORE TESTS (v3.1) ⛔⛔⛔

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                   ║
║   THE FOLLOWING 4 TEST CATEGORIES ARE ABSOLUTELY MANDATORY!                       ║
║   SKIPPING ANY OF THESE = AUTOMATIC TEST FAILURE                                  ║
║                                                                                   ║
║   ┌─────────────────────────────────────────────────────────────────────────┐     ║
║   │ TEST 1: FORM INPUT → SUBMIT (フォーム入力→送信)                         │     ║
║   │    ✓ Discover ALL forms on each page                                    │     ║
║   │    ✓ Fill EVERY input field with appropriate test data                  │     ║
║   │    ✓ Submit EVERY form                                                  │     ║
║   │    ✓ Verify success message OR valid error response                     │     ║
║   │    ✓ Test validation: empty submit, invalid email, short password       │     ║
║   │    ✓ IF FAILS → FIX CODE → RE-TEST → MUST PASS                          │     ║
║   └─────────────────────────────────────────────────────────────────────────┘     ║
║                                                                                   ║
║   ┌─────────────────────────────────────────────────────────────────────────┐     ║
║   │ TEST 2: BUTTON CLICK (全ボタンクリック)                                 │     ║
║   │    ✓ Discover ALL buttons on each page                                  │     ║
║   │    ✓ Click EVERY button (except disabled)                               │     ║
║   │    ✓ Verify expected action: modal opens, API called, page changes      │     ║
║   │    ✓ Test CRUD: Create→verify, Edit→verify, Delete→confirm→verify       │     ║
║   │    ✓ Test modals: open, interact, close (cancel + submit)               │     ║
║   │    ✓ IF FAILS → FIX CODE → RE-TEST → MUST PASS                          │     ║
║   └─────────────────────────────────────────────────────────────────────────┘     ║
║                                                                                   ║
║   ┌─────────────────────────────────────────────────────────────────────────┐     ║
║   │ TEST 3: LINK NAVIGATION (全リンク遷移)                                  │     ║
║   │    ✓ Discover ALL internal links on each page                           │     ║
║   │    ✓ Click EVERY link                                                   │     ║
║   │    ✓ Verify destination page loads (no 404, no 500, no blank)           │     ║
║   │    ✓ Verify correct content appears on destination                      │     ║
║   │    ✓ Test browser back button returns to original page                  │     ║
║   │    ✓ IF FAILS → FIX ROUTE/COMPONENT → RE-TEST → MUST PASS               │     ║
║   └─────────────────────────────────────────────────────────────────────────┘     ║
║                                                                                   ║
║   ┌─────────────────────────────────────────────────────────────────────────┐     ║
║   │ TEST 4: CSS/VISUAL VERIFICATION (CSS視覚検証)                           │     ║
║   │    ✓ Check CSS files are loaded (not raw HTML appearance)               │     ║
║   │    ✓ Verify buttons have background color (NOT transparent)             │     ║
║   │    ✓ Verify text has proper font (NOT Times New Roman)                  │     ║
║   │    ✓ Verify layout uses flex/grid (elements properly aligned)           │     ║
║   │    ✓ Verify spacing/padding/margin is applied                           │     ║
║   │    ✓ Take SCREENSHOT as visual proof                                    │     ║
║   │    ✓ Compare: Does page look styled or broken?                          │     ║
║   │    ✓ IF BROKEN → CHECK tailwind.config → FIX → REBUILD → RE-TEST        │     ║
║   └─────────────────────────────────────────────────────────────────────────┘     ║
║                                                                                   ║
║   ⚠️ EVERY PAGE MUST PASS ALL 4 TEST CATEGORIES                                   ║
║   ⚠️ BUG FOUND → STOP → FIX IMMEDIATELY → RE-TEST → MUST PASS → CONTINUE          ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### MANDATORY TEST EXECUTION CHECKLIST (Per Page)

For EACH page, execute these MCP tool calls:

| #   | Test Category   | MCP Tool Calls                                                                                                                                   | Pass Criteria                                      |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1   | **Form Test**   | `find(query="form")` → `form_input(ref, value)` → `computer(action="left_click", ref=submit)` → `read_network_requests()`                        | API returns 200/201 or validation error displayed  |
| 2   | **Button Test** | `find(query="button")` → `computer(action="left_click", ref)` → `computer(action="screenshot")`                                                  | Expected action occurs (modal/navigation/API call) |
| 3   | **Link Test**   | `javascript_tool(text="document.querySelectorAll('a')")` → `computer(action="left_click", ref)` → `javascript_tool(text="window.location.href")` | Correct page loads, no errors                      |
| 4   | **CSS Test**    | `javascript_tool(text="getComputedStyle(button).backgroundColor")` → `computer(action="screenshot")`                                             | Background not transparent, layout not broken      |

### MANDATORY TEST COUNT VERIFICATION (v3.0 - EVIDENCE-BOUND)

**FINAL REPORT MUST INCLUDE EVIDENCE-BOUND COUNTS:**

Every count MUST be backed by raw evidence collected via MCP tools. Self-reported counts without matching raw data = AUTOMATIC FAILURE.

```json
{
  "mandatory_test_summary": {
    "forms_discovered": 15,
    "forms_filled_submitted": 15,
    "form_validation_tested": true,
    "buttons_discovered": 42,
    "buttons_clicked": 42,
    "crud_operations_tested": true,
    "links_discovered": 28,
    "links_clicked": 28,
    "navigation_verified": true,
    "pages_css_verified": 12,
    "screenshots_taken": 12,
    "visual_inspection_passed": true
  },
  "evidence_chain": {
    "per_page_evidence": [
      {
        "page_url": "/dashboard",
        "gate1_css": {
          "raw_computed_styles": {
            "buttons_with_bg": 5,
            "flex_computed": 3,
            "font_family": "Inter, sans-serif"
          },
          "verdict": "STYLED",
          "verdict_derivation": "buttons_with_bg > 0 AND flex_computed > 0 AND font_family != Times"
        },
        "gate2_content": {
          "raw_dom_depth": 12,
          "raw_visible_text_length": 450,
          "raw_loading_elements": 0,
          "verdict": "RENDERED",
          "verdict_derivation": "dom_depth >= 3 AND visible_text_length >= 50 AND loading_elements == 0"
        },
        "gate3_loop": {
          "raw_request_counts": { "GET /api/users": 1, "GET /api/stats": 1 },
          "max_single_endpoint_calls": 1,
          "verdict": "NO_LOOP",
          "verdict_derivation": "max_single_endpoint_calls < 50"
        },
        "gate4_screenshot": {
          "screenshot_taken": true,
          "screenshot_imageId": "img_abc123",
          "verdict": "CAPTURED"
        },
        "overall_verdict": "PASS",
        "all_gates_passed": true
      }
    ]
  }
}
```

**EVIDENCE VALIDATION RULES:**

- **IF `screenshots_taken` > 0 BUT no `screenshot_imageId` in evidence_chain = FORGERY DETECTED = AUTOMATIC FAILURE**
- **IF `pages_css_verified` > 0 BUT no `raw_computed_styles` in evidence_chain = FORGERY DETECTED = AUTOMATIC FAILURE**
- **IF forms_filled_submitted < forms_discovered = TEST FAILURE**
- **IF buttons_clicked < buttons_discovered = TEST FAILURE**
- **IF links_clicked < links_discovered = TEST FAILURE**
- **IF any gate verdict is negative BUT overall_verdict is PASS = CONTRADICTION = AUTOMATIC FAILURE**

---

## ⛔ STOP! READ THIS BEFORE PROCEEDING ⛔

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   THIS IS A BROWSER AUTOMATION TEST - NOT A CODE REVIEW!                     ║
║                                                                              ║
║   You MUST use MCP tools to interact with the actual browser.                ║
║   You MUST NOT analyze source code and claim tests pass.                     ║
║   You MUST NOT generate reports without actual browser interaction.          ║
║                                                                              ║
║   PROOF OF EXECUTION REQUIRED:                                               ║
║   - Screenshot of each page visited                                          ║
║   - Network request logs from each page                                      ║
║   - Console message logs from each page                                      ║
║   - Form submission results                                                  ║
║   - Button click results                                                     ║
║                                                                              ║
║   "Static code analysis" = AUTOMATIC FAILURE                                 ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## ⛔ CRITICAL: BASH TEMPLATE LITERAL SAFETY

When writing or executing JavaScript code within bash commands:

- **NEVER** use JavaScript template literals `${...}` inside bash commands or heredocs
- Bash interprets `${variable.method()}` as shell variable substitution, causing "Bad substitution" errors
- **ALWAYS** write JavaScript code to a `.js` file first, then execute with `node script.js`
- If you must embed JavaScript inline, use **single quotes** to prevent bash expansion:

  ```bash
  # WRONG - bash will try to expand ${pageData.path}
  node -e "const url = \`${pageData.path.replace(/\\//g, '_')}\`"

  # CORRECT - write to file first
  cat > /tmp/test.js << 'JSEOF'
  const url = `${pageData.path.replace(/\//g, '_')}`;
  JSEOF
  node /tmp/test.js
  ```

## ⚠️ CRITICAL: MANDATORY BUG FIX REFERENCES

**Before fixing ANY bug, you MUST read these documents:**

```
+================================================================+
|  MANDATORY REFERENCE DOCUMENTS FOR BUG FIXES                     |
+================================================================+
|                                                                  |
|  1. .claude/prompts/react-spa-common-issues.md                   |
|     - React component errors                                     |
|     - State management issues                                    |
|     - Router configuration                                       |
|     - Build/TypeScript errors                                    |
|                                                                  |
|  2. .claude/prompts/api-backend-common-issues.md                 |
|     - API connection errors (CORS, 401, 500)                     |
|     - Authentication flow issues                                 |
|     - Request/Response format                                    |
|                                                                  |
|  DO NOT GUESS FIXES - ALWAYS check these documents first!        |
+================================================================+
```

---

## EFFICIENT MODE OVERVIEW

```
+================================================================+
|  CLAUDE IN CHROME - EFFICIENT UI TEST MODE                       |
+================================================================+
|                                                                  |
|  KEY DIFFERENCES FROM STANDARD MODE:                             |
|                                                                  |
|  1. CONTEXT SHARING: Full context preserved across all tests    |
|  2. REAL-TIME FIXING: Fix bugs immediately when detected        |
|  3. NO BATCH LOOPS: No "collect bugs then fix loop"             |
|  4. TARGET: 100% pass rate (not 50%)                            |
|  5. EFFICIENCY: Faster completion due to shared context         |
|                                                                  |
|  WORKFLOW:                                                       |
|  Visit Page -> Check Criteria -> Fail? -> Fix -> Re-check       |
|                                                                  |
|  COST: 2x standard mode (200 points vs 100 points)              |
|                                                                  |
+================================================================+
```

---

## ⚠️ MANDATORY: BUSINESS LOGIC TESTING (v2.0)

```
+================================================================+
|  CRITICAL: ALL UI ELEMENTS MUST BE TESTED - NO EXCEPTIONS!       |
+================================================================+
|                                                                  |
|  THE FOLLOWING TESTS ARE MANDATORY FOR EVERY PAGE:               |
|                                                                  |
|  1. FORM TESTING (100% coverage required)                        |
|     - EVERY form field must be filled                            |
|     - EVERY form must be submitted                               |
|     - Success/Error handling must be verified                    |
|                                                                  |
|  2. NAVIGATION TESTING (100% coverage required)                  |
|     - EVERY link must be clicked                                 |
|     - Destination page must be verified                          |
|     - Browser back must work correctly                           |
|                                                                  |
|  3. BUTTON TESTING (100% coverage required)                      |
|     - EVERY button must be clicked                               |
|     - Expected action must occur                                 |
|     - Modal/dialog must be handled                               |
|                                                                  |
|  4. CRUD OPERATIONS (where applicable)                           |
|     - Create: Add new item → verify appears in list              |
|     - Read: View item details → verify data displays             |
|     - Update: Edit item → verify changes saved                   |
|     - Delete: Remove item → verify removed from list             |
|                                                                  |
|  5. IMMEDIATE BUG FIX (NO DELAY ALLOWED)                         |
|     - Bug found → STOP testing                                   |
|     - Analyze → Fix code → Rebuild if needed                     |
|     - Re-test SAME element → MUST PASS                           |
|     - Only then proceed to next test                             |
|                                                                  |
|  FAILURE TO TEST ALL ELEMENTS = TEST FAILURE                     |
|                                                                  |
+================================================================+
```

### MANDATORY TEST CHECKLIST (Every Page)

| Test Category  | Required Actions               | Pass Criteria                  |
| -------------- | ------------------------------ | ------------------------------ |
| **Forms**      | Fill ALL fields, Submit        | Success message OR valid error |
| **Links**      | Click ALL links                | Correct page loads             |
| **Buttons**    | Click ALL buttons              | Expected action occurs         |
| **Inputs**     | Type in ALL text fields        | Value accepted                 |
| **Selects**    | Select option in ALL dropdowns | Option selected                |
| **Modals**     | Open/Close ALL modals          | Modal behaves correctly        |
| **Tables**     | Click rows if clickable        | Detail view opens              |
| **Pagination** | Click ALL page numbers         | Correct data loads             |

## P0 Judgment Criteria

Each page test must satisfy ALL of these criteria:

| #   | Criteria                      | Description                                              | Check Method                                                  |
| --- | ----------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | **Screen Display OK**         | No visible error messages on page                        | Visual inspection + DOM check                                 |
| 2   | **Network No Errors**         | No 4xx/5xx responses in Network panel                    | `read_network_requests`                                       |
| 3   | **Console No Errors**         | No JavaScript errors in browser console                  | `read_console_messages` (ENHANCED - see below)                |
| 4   | **No Infinite Loops**         | No API endpoint called >= 50 times (HARD BLOCK)          | `performance.getEntriesByType('resource')` + GATE 3           |
| 5   | **Empty Data Handled**        | Page handles null/undefined gracefully                   | Fresh user test                                               |
| 6   | **GATE 1: CSS Computed**      | CSS styles actually rendered (not just class attributes) | `getComputedStyle()` verification (NOT `[class*=]` selectors) |
| 7   | **GATE 2: Content Rendered**  | Page content actually visible (not loading/blank)        | DOM depth + visible text + loading state check                |
| 8   | **GATE 3: No Infinite Loops** | No endpoint called >= 50 times (HARD BLOCK)              | `performance.getEntriesByType('resource')` frequency analysis |
| 9   | **GATE 4: Screenshot Proof**  | Screenshot captured with valid imageId                   | `computer(action="screenshot")` returns imageId               |
| 10  | **Forms Tested**              | ALL forms filled & submitted successfully                | Form submission test                                          |
| 11  | **Navigation Tested**         | ALL links clicked & destination verified                 | Link click test                                               |
| 12  | **Buttons Tested**            | ALL buttons clicked & action verified                    | Button click test                                             |
| 13  | **CRUD Tested**               | Create/Read/Update/Delete operations work                | CRUD operation test                                           |
| 14  | **Runtime Error Free**        | No TypeError/ReferenceError in console                   | Enhanced console monitoring                                   |
| 15  | **API Response Valid**        | API responses match expected format                      | Response format validation                                    |

---

## ⛔⛔⛔ 6-GATE UNFORGEABLE VERIFICATION SYSTEM (v3.0) ⛔⛔⛔

```
+========================================================================================+
|                                                                                         |
|   6-GATE SYSTEM: 4 GATES PER PAGE + 2 ARCHITECTURAL GATES                               |
|   GATES 1-4: Run per page. GATE 5: Evidence structure. GATE 6: Post-run validation.   |
|   ANY GATE FAILURE = PAGE/RUN CANNOT PASS = NO EXCEPTIONS                              |
|                                                                                         |
|   GATE 1: CSS COMPUTED STYLE VERIFICATION                                               |
|     - Uses getComputedStyle() to verify ACTUAL rendered CSS                             |
|     - Class attribute selectors [class*=flex] are FORBIDDEN (they lie)                  |
|     - Checks: backgroundColor, display:flex/grid, fontFamily, padding                  |
|     - FAIL if: buttons transparent, no flex/grid layout, default serif font             |
|                                                                                         |
|   GATE 2: CONTENT RENDERING VERIFICATION                                                |
|     - Verifies page content is ACTUALLY visible (not loading/blank/error)               |
|     - Checks: DOM depth >= 3, visible text >= 50 chars, loading elements = 0            |
|     - FAIL if: page stuck on loading, blank screen, only error message                  |
|                                                                                         |
|   GATE 3: INFINITE LOOP DETECTION (HARD BLOCK)                                          |
|     - Counts requests per endpoint via performance.getEntriesByType('resource')         |
|     - Threshold: any single endpoint called >= 50 times = HARD BLOCK                   |
|     - CANNOT proceed until loop is fixed (not WARN, not skip - BLOCKED)                |
|     - Common cause: useEffect dependency causing re-render loop                         |
|                                                                                         |
|   GATE 4: SCREENSHOT EVIDENCE (MANDATORY)                                               |
|     - Every page MUST have a screenshot with valid imageId                              |
|     - screenshots_taken > 0 WITHOUT imageId proof = FORGERY = AUTOMATIC FAILURE         |
|     - Screenshot must be taken AFTER page fully loads (not during loading)              |
|                                                                                         |
|   GATE 5: EVIDENCE CHAIN ARCHITECTURE                                                   |
|     - Every verdict MUST be derived from raw data collected via MCP tools               |
|     - Report structure: { raw_data: {...}, verdict: "...", derivation: "..." }          |
|     - Self-reported verdicts without raw data = FORGERY = AUTOMATIC FAILURE             |
|                                                                                         |
|   GATE 6: CROSS-VALIDATION                                                              |
|     - Detects contradictions between raw data and verdicts                              |
|     - Example: css_ok=true but raw_computed_styles shows transparent buttons = FORGERY  |
|     - Example: screenshots_taken=12 but evidence_chain has 0 imageIds = FORGERY         |
|     - Any contradiction = ENTIRE TEST RUN INVALIDATED                                   |
|                                                                                         |
+========================================================================================+
```

---

## EXECUTION INSTRUCTIONS

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  ⚠️⚠️⚠️ CRITICAL: STATIC ANALYSIS IS FORBIDDEN! ⚠️⚠️⚠️                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  YOU MUST USE MCP TOOLS TO ACTUALLY INTERACT WITH THE BROWSER!               ║
║                                                                              ║
║  ❌ FORBIDDEN:                                                               ║
║    - "Through static code analysis..."                                       ║
║    - Reading source code and assuming tests pass                             ║
║    - Generating reports without actual browser interaction                   ║
║    - Skipping MCP tool calls                                                 ║
║                                                                              ║
║  ✅ REQUIRED:                                                                ║
║    - Call mcp__claude-in-chrome__tabs_context_mcp FIRST                      ║
║    - Call mcp__claude-in-chrome__navigate to visit pages                     ║
║    - Call mcp__claude-in-chrome__form_input to fill forms                    ║
║    - Call mcp__claude-in-chrome__computer to click buttons                   ║
║    - Call mcp__claude-in-chrome__read_network_requests to check API          ║
║    - Call mcp__claude-in-chrome__read_console_messages for JS errors         ║
║                                                                              ║
║  IF YOU DO NOT CALL MCP TOOLS = TEST FAILURE                                 ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### FIRST ACTION (MANDATORY - DO THIS IMMEDIATELY)

**You MUST execute these steps NOW, before anything else:**

```
STEP 0: READ MANDATORY REFERENCE DOCUMENTS (MUST DO BEFORE ANY TESTING/FIXING)
>>> Read file: .claude/prompts/react-spa-common-issues.md
>>> Read file: .claude/prompts/api-backend-common-issues.md
    - These contain ALL known bug patterns and proven fix solutions
    - DO NOT attempt any bug fix without consulting these documents first
    - Skipping this step = reinventing the wheel = wasted time and wrong fixes

STEP 1: Get browser tab context
>>> mcp__claude-in-chrome__tabs_context_mcp(createIfEmpty=true)

STEP 2: Create new tab if needed
>>> mcp__claude-in-chrome__tabs_create_mcp()

STEP 3: Navigate to frontend URL
>>> mcp__claude-in-chrome__navigate(url="{FRONTEND_URL}", tabId={TAB_ID})

STEP 4: Take screenshot to verify
>>> mcp__claude-in-chrome__computer(action="screenshot", tabId={TAB_ID})
```

**IF YOU DO NOT EXECUTE THESE TOOLS = YOU ARE DOING IT WRONG!**

### TEST EXECUTION CHECKLIST (MUST COMPLETE ALL)

For EACH page you test, you MUST call these MCP tools:

| Step | MCP Tool Call                                                              | Purpose           |
| ---- | -------------------------------------------------------------------------- | ----------------- |
| 1    | `mcp__claude-in-chrome__navigate(url=..., tabId=...)`                      | Navigate to page  |
| 2    | `mcp__claude-in-chrome__computer(action="screenshot", tabId=...)`          | Take screenshot   |
| 3    | `mcp__claude-in-chrome__read_page(tabId=...)`                              | Get page elements |
| 4    | `mcp__claude-in-chrome__find(query="login button", tabId=...)`             | Find elements     |
| 5    | `mcp__claude-in-chrome__form_input(ref=..., value=..., tabId=...)`         | Fill forms        |
| 6    | `mcp__claude-in-chrome__computer(action="left_click", ref=..., tabId=...)` | Click buttons     |
| 7    | `mcp__claude-in-chrome__read_network_requests(tabId=...)`                  | Check API calls   |
| 8    | `mcp__claude-in-chrome__read_console_messages(tabId=...)`                  | Check JS errors   |

```
+================================================================+
|  DO NOT exit until you have:                                     |
|    - ACTUALLY visited ALL pages (with navigate tool)             |
|    - ACTUALLY clicked ALL buttons (with computer tool)           |
|    - ACTUALLY filled ALL forms (with form_input tool)            |
|    - ACTUALLY checked ALL API responses (with network tool)      |
|    - ACTUALLY fixed ALL bugs encountered                         |
|    - Generated test report WITH MCP TOOL EVIDENCE                |
+================================================================+
```

---

## Browser Automation Tools (Claude In Chrome)

Use these MCP tools for browser interaction:

| Tool                                           | Usage                                   |
| ---------------------------------------------- | --------------------------------------- |
| `mcp__claude-in-chrome__tabs_context_mcp`      | Get current browser tabs                |
| `mcp__claude-in-chrome__tabs_create_mcp`       | Create new browser tab                  |
| `mcp__claude-in-chrome__navigate`              | Navigate to page URL                    |
| `mcp__claude-in-chrome__read_page`             | Read page content (accessibility tree)  |
| `mcp__claude-in-chrome__find`                  | Find elements by natural language       |
| `mcp__claude-in-chrome__computer`              | Click, type, screenshot, scroll actions |
| `mcp__claude-in-chrome__form_input`            | Fill form fields                        |
| `mcp__claude-in-chrome__javascript_tool`       | Execute JavaScript on page              |
| `mcp__claude-in-chrome__read_network_requests` | Monitor API responses                   |
| `mcp__claude-in-chrome__read_console_messages` | Check for JS errors                     |
| `mcp__claude-in-chrome__get_page_text`         | Extract text content from page          |

**Advantages of Claude In Chrome**:

- Full context sharing across entire session
- Real-time bug fixing without context loss
- No need for separate bug collection phase
- More efficient for complex UI test scenarios

---

## ⛔⛔⛔ CRITICAL: ENHANCED ERROR MONITORING (v2.3) ⛔⛔⛔

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                   ║
║   ENHANCED CONSOLE & NETWORK ERROR MONITORING                                     ║
║   - Catches ALL JavaScript runtime errors (TypeError, ReferenceError, etc.)       ║
║   - Validates API response formats (not just status codes)                        ║
║   - 100% error detection and fixing required                                      ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

### MANDATORY: Enhanced Console Error Check (Per Page)

**AFTER EVERY page navigation and interaction, execute this check:**

```
TASK: Comprehensive Console Error Detection

1. CHECK FOR ALL ERROR TYPES:
   mcp__claude-in-chrome__read_console_messages(
     tabId={TAB_ID},
     pattern="TypeError|ReferenceError|SyntaxError|Error|Uncaught|failed|undefined is not|null is not|is not a function|Cannot read|map is not",
     onlyErrors=true
   )

2. ERROR PATTERNS TO DETECT:
   | Error Pattern | Common Cause | Fix Required |
   |--------------|--------------|--------------|
   | TypeError: X.map is not a function | API returns object instead of array | Fix API client or add data extraction |
   | TypeError: Cannot read property 'X' of undefined | Data not loaded yet | Add null check / optional chaining |
   | TypeError: X is not a function | Wrong import or missing method | Fix import / method name |
   | ReferenceError: X is not defined | Undeclared variable or bad import | Fix variable declaration |
   | Uncaught (in promise) | Unhandled async error | Add try-catch or .catch() |
   | SyntaxError | Code syntax issue | Fix code syntax |

3. IF ANY ERROR FOUND:
   => STOP IMMEDIATELY
   => Read full error message and stack trace
   => Identify source file and line number
   => FIX THE CODE
   => Re-test the same page
   => MUST BE ERROR-FREE before proceeding

4. JAVASCRIPT ERROR LISTENER (Additional Check):
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="(() => {
       const errors = [];
       // Check for errors caught by window.onerror
       if (window.__captured_errors) {
         errors.push(...window.__captured_errors);
       }
       // Check React error boundaries
       const errorBoundaries = document.querySelectorAll('[data-error-boundary]');
       errorBoundaries.forEach(eb => {
         if (eb.textContent.includes('error') || eb.textContent.includes('Error')) {
           errors.push(eb.textContent.substring(0, 200));
         }
       });
       // Check for error UI elements
       const errorElements = document.querySelectorAll('.error-message, .error-boundary, [class*=error], [role=alert]');
       errorElements.forEach(el => {
         const text = el.textContent.trim();
         if (text && text.length > 0 && text.length < 500) {
           errors.push(text);
         }
       });
       return JSON.stringify({
         hasErrors: errors.length > 0,
         errorCount: errors.length,
         errors: errors.slice(0, 10)
       });
     })()"
   )
```

### MANDATORY: Enhanced Network Response Validation (Per Page)

**Check not just status codes, but also response FORMAT:**

```
TASK: API Response Format Validation

1. CAPTURE AND VALIDATE NETWORK RESPONSES:
   mcp__claude-in-chrome__read_network_requests(
     tabId={TAB_ID},
     urlPattern="/api/"
   )

2. FOR EACH API RESPONSE, VERIFY:
   a. Status code is 2xx (success)
   b. Response body format matches frontend expectations

3. COMMON FORMAT MISMATCHES TO DETECT:
   | Frontend Expects | Backend Returns | Error | Fix |
   |-----------------|-----------------|-------|-----|
   | Array `[]` | Object `{items: []}` | X.map is not a function | Extract: `response.items` or `response.data` |
   | Object `{}` | Array `[]` | Cannot read property | Check response type |
   | `{user: {...}}` | `{data: {user: {...}}}` | undefined property | Update data path |
   | Number | String | NaN or type error | Parse: `parseInt()` or `Number()` |

4. RESPONSE FORMAT VERIFICATION SCRIPT:
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="(() => {
       // Get all fetch/XHR responses from performance entries
       const apiCalls = performance.getEntriesByType('resource')
         .filter(r => r.name.includes('/api/'))
         .map(r => ({
           url: r.name,
           duration: r.duration,
           status: 'completed'
         }));

       // Check for any pending or failed requests visible in UI
       const loadingElements = document.querySelectorAll('[class*=loading], [class*=spinner], .loading');
       const errorDisplays = document.querySelectorAll('[class*=error], .error, [role=alert]');

       return JSON.stringify({
         apiCallCount: apiCalls.length,
         apiCalls: apiCalls.slice(0, 10),
         stillLoading: loadingElements.length > 0,
         hasErrorDisplays: errorDisplays.length > 0,
         errorTexts: Array.from(errorDisplays).map(e => e.textContent.trim().substring(0, 100)).slice(0, 5)
       });
     })()"
   )

5. IF RESPONSE FORMAT MISMATCH:
   Example: API returns {airports: [...], total: 10} but frontend expects [...]

   FIX IN FRONTEND API CLIENT:
   - Before: return request<Airport[]>('/airports');
   - After:  return request<{airports: Airport[], total: number}>('/airports')
                    .then(res => res.airports);

   OR FIX IN BACKEND:
   - Before: return AirportListResponse(airports=airports, total=len(airports))
   - After:  return airports  (if frontend expects array)
```

### MANDATORY: Post-Interaction Error Check

**AFTER EVERY user interaction (click, submit, navigate), run this check:**

```
TASK: Post-Interaction Error Verification

1. AFTER EVERY CLICK/SUBMIT:
   a. Wait 2-3 seconds for async operations
   b. Check console for new errors:
      mcp__claude-in-chrome__read_console_messages(
        tabId={TAB_ID},
        pattern="TypeError|ReferenceError|Error|Uncaught|failed|is not",
        onlyErrors=true,
        clear=false
      )
   c. Check network for failed requests:
      mcp__claude-in-chrome__read_network_requests(
        tabId={TAB_ID},
        urlPattern="/api/"
      )
   d. Take screenshot for evidence

2. ERROR SEVERITY LEVELS:
   | Level | Pattern | Action |
   |-------|---------|--------|
   | CRITICAL | TypeError, ReferenceError | STOP - Fix immediately |
   | HIGH | 500 Server Error | STOP - Fix backend |
   | MEDIUM | 400/422 Validation | Check if expected, fix if not |
   | LOW | Console warnings | Log and continue |

3. ZERO TOLERANCE POLICY:
   - ANY TypeError = MUST FIX
   - ANY ReferenceError = MUST FIX
   - ANY "is not a function" = MUST FIX
   - ANY "Cannot read property" = MUST FIX
   - ANY 500 error = MUST FIX
   - NO EXCEPTIONS - NO "KNOWN ISSUES"
```

### Error Detection Summary Checklist

```
╔════════════════════════════════════════════════════════════════╗
║  BEFORE MARKING PAGE AS PASSED, VERIFY ALL CHECKS:              ║
╠════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  □ Console has ZERO TypeErrors                                  ║
║  □ Console has ZERO ReferenceErrors                             ║
║  □ Console has ZERO "is not a function" errors                  ║
║  □ Console has ZERO "Cannot read property" errors               ║
║  □ Console has ZERO Uncaught exceptions                         ║
║  □ Network has ZERO 5xx errors                                  ║
║  □ Network has ZERO unexpected 4xx errors                       ║
║  □ API responses match expected format                          ║
║  □ No loading spinners stuck indefinitely                       ║
║  □ No error messages displayed on page                          ║
║                                                                 ║
║  IF ANY CHECK FAILS → STOP → FIX → RE-TEST → MUST PASS          ║
║                                                                 ║
╚════════════════════════════════════════════════════════════════╝
```

---

## Step 1: Pre-Test Setup

### ⛔⛔⛔ Step 1.0: MANDATORY MySQL Validation (SQLite FORBIDDEN) ⛔⛔⛔

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                   ║
║   CRITICAL: MYSQL IS MANDATORY - SQLITE IS ABSOLUTELY FORBIDDEN!                  ║
║                                                                                   ║
║   Phase 5C tests MUST use the same MySQL database as production.                  ║
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
echo "║  MANDATORY DATABASE VALIDATION (Phase 5C)                   ║"
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

    # Check 4: Verify MySQL host matches DATABASE_INFO.md
    if [ -f "DATABASE_INFO.md" ]; then
        DB_HOST=$(grep -E "\*\*Host\*\*:" DATABASE_INFO.md | head -1 | sed 's/.*: *//')
        if [ -n "$DB_HOST" ] && ! echo "$DB_URL" | grep -q "$DB_HOST"; then
            echo "[WARNING] DATABASE_URL host doesn't match DATABASE_INFO.md"
            echo "[WARNING] Expected host: $DB_HOST"
        fi
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
4. DO NOT proceed with UI tests until MySQL is properly configured

---

### Step 1.1: Load Configuration (Zero Hardcoding)

```bash
# Load frontend URL from startup config
WORKSPACE_DIR="${WORKSPACE_DIR:-$(pwd)}"
CONFIG_FILE="$WORKSPACE_DIR/startup_config.json"

if [ -f "$CONFIG_FILE" ]; then
    FRONTEND_URL=$(python3 -c "
import json
with open('$CONFIG_FILE') as f:
    cfg = json.load(f)
print(cfg.get('frontend', {}).get('url', 'http://localhost:3000'))
" 2>/dev/null)
else
    FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
fi
echo "Frontend URL: $FRONTEND_URL"
```

### Step 1.2: Get Browser Context

```
TASK: Initialize Browser Context

1. Call mcp__claude-in-chrome__tabs_context_mcp to get available tabs
2. If no tabs exist in group, call mcp__claude-in-chrome__tabs_create_mcp
3. Save the tab ID for subsequent operations
```

### Step 1.3: Load Test Credentials from Phase 5B

```
TASK: Load Test User Credentials

1. Read test-logs/phase5b_test_user.json
2. Extract: TEST_EMAIL, TEST_PASSWORD, AUTH_TOKEN
3. These will be used for login and authenticated page tests

IF credentials file not found:
   - Use fallback: admin@preview.example.com / Test@123
```

### Step 1.4: Load Test Data from Phase 5B (CRITICAL)

```
TASK: Load Pre-Seeded Test Data for UI Testing

The system generates test data before Phase 5B. This data is available at:
- Location: /workspace/test-logs/test_data.json

1. Read test_data.json if it exists
2. Extract entity IDs for testing (e.g., video IDs, user IDs)
3. Use these IDs when testing detail pages, edit forms, delete buttons

test_data.json Structure:
{
  "entities": {
    "table_name": [{"id": 1, ...}, {"id": 2, ...}]
  },
  "test_scenarios": {
    "detail_view": {"model": "model_name", "id": 1},
    "list_view": {"model": "model_name", "expected_count": 2}
  }
}

How to Use:
- Detail page tests: Navigate to /items/{id} using IDs from entities
- List page tests: Verify item count matches expected_count
- Edit/Delete tests: Use existing IDs to test CRUD operations
- Form tests: Can create new data (don't need pre-seeded data)

IF test_data.json doesn't exist:
- Test list pages (may show empty)
- Test create forms (will create new data)
- Skip detail/edit/delete tests that require existing IDs
```

### Step 1.5: Middleware Cookie Sync Verification (2026-01-21)

```
+================================================================+
|  CRITICAL: MIDDLEWARE COOKIE SYNC PRE-CHECK                      |
+================================================================+
|                                                                  |
|  PROBLEM: Login works in dev but fails in prod                   |
|           - Auth store uses localStorage only                    |
|           - SSR middleware requires cookies (can't read localStorage) |
|           - User logs in successfully but redirected to /login   |
|                                                                  |
|  SOLUTION: Verify auth store syncs cookies for middleware        |
|                                                                  |
+================================================================+
```

```bash
# ================================================================
# Middleware Cookie Sync Verification (ZERO HARDCODING)
# All file detection is pattern-based, no hardcoded filenames
# ================================================================
WORKSPACE_DIR="${WORKSPACE_DIR:-$(pwd)}"
FRONTEND_DIR="$WORKSPACE_DIR/frontend"
[ ! -d "$FRONTEND_DIR" ] && FRONTEND_DIR="$WORKSPACE_DIR/src/frontend"
[ ! -d "$FRONTEND_DIR" ] && FRONTEND_DIR="$WORKSPACE_DIR/client"

echo "============================================"
echo "Step 1.4: Middleware Cookie Sync Verification"
echo "============================================"

if [ ! -d "$FRONTEND_DIR" ]; then
    echo "[SKIP] No frontend directory found"
else
    # Step 1: Find middleware file (pattern-based)
    MIDDLEWARE_FILE=""
    for pattern in "middleware.ts" "middleware.js" "src/middleware.ts" "src/middleware.js"; do
        [ -f "$FRONTEND_DIR/$pattern" ] && MIDDLEWARE_FILE="$FRONTEND_DIR/$pattern" && break
    done
    [ -z "$MIDDLEWARE_FILE" ] && MIDDLEWARE_FILE=$(find "$FRONTEND_DIR" -maxdepth 3 -type f -name "middleware.*" \( -name "*.ts" -o -name "*.js" \) 2>/dev/null | head -1)

    if [ -z "$MIDDLEWARE_FILE" ]; then
        echo "[INFO] No middleware file found (SSR middleware not used)"
    else
        echo "[DETECT] Middleware: $MIDDLEWARE_FILE"

        # Step 2: Extract cookie name from middleware (pattern-based)
        MIDDLEWARE_COOKIE_NAME=$(grep -oE "cookies\.get\(['\"][^'\"]+['\"]|request\.cookies\.get\(['\"][^'\"]+['\"]|cookies\.has\(['\"][^'\"]+['\"]" "$MIDDLEWARE_FILE" 2>/dev/null | head -1 | sed "s/.*(['\"]//;s/['\"].*//")

        if [ -z "$MIDDLEWARE_COOKIE_NAME" ]; then
            echo "[INFO] Middleware does not check cookies"
        else
            echo "[DETECT] Middleware expects cookie: '$MIDDLEWARE_COOKIE_NAME'"

            # Step 3: Find auth store file (pattern-based, exclude API clients)
            AUTH_STORE=""
            AUTH_STORE=$(find "$FRONTEND_DIR" -path "*/stores/*" -type f -name "*[Aa]uth*" \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) 2>/dev/null | grep -v "/api/" | head -1)
            [ -z "$AUTH_STORE" ] && AUTH_STORE=$(find "$FRONTEND_DIR" -type f \( -iname "*authstore*" -o -iname "*storeauth*" \) \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) 2>/dev/null | grep -v "/api/" | head -1)
            [ -z "$AUTH_STORE" ] && AUTH_STORE=$(find "$FRONTEND_DIR" -path "*/lib/stores/*" -type f -name "*[Aa]uth*" \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) 2>/dev/null | head -1)
            [ -z "$AUTH_STORE" ] && AUTH_STORE=$(find "$FRONTEND_DIR" -type f \( -path "*/state/*" -o -path "*/store/*" \) -name "*[Aa]uth*" \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) 2>/dev/null | grep -v "/api/" | head -1)

            if [ -z "$AUTH_STORE" ]; then
                echo "[WARN] No auth store found"
            else
                echo "[DETECT] Auth store: $AUTH_STORE"

                # Step 4: Verify cookie sync exists
                if grep -qE "document\.cookie|setCookie|Cookies\.set|cookies\.set|js-cookie|cookie\.set" "$AUTH_STORE" 2>/dev/null; then
                    echo "[OK] Auth store has cookie sync"
                else
                    echo ""
                    echo "╔═══════════════════════════════════════════════════════════════════╗"
                    echo "║  [CRITICAL] AUTH STORE MISSING COOKIE SYNC!                       ║"
                    echo "╠═══════════════════════════════════════════════════════════════════╣"
                    echo "║  Middleware expects '$MIDDLEWARE_COOKIE_NAME' cookie              ║"
                    echo "║  Auth store only uses localStorage (no cookie sync)               ║"
                    echo "║                                                                   ║"
                    echo "║  IMPACT: Login success -> redirect to /login (auth failure)       ║"
                    echo "║                                                                   ║"
                    echo "║  FIX: Add to auth store login function:                           ║"
                    echo "║  document.cookie = '$MIDDLEWARE_COOKIE_NAME=' + token + '; path=/'║"
                    echo "║                                                                   ║"
                    echo "║  FIX: Add to auth store logout function:                          ║"
                    echo "║  document.cookie = '$MIDDLEWARE_COOKIE_NAME=; path=/; max-age=0'  ║"
                    echo "╚═══════════════════════════════════════════════════════════════════╝"
                    echo ""

                    # Auto-fix with Claude CLI if available
                    if command -v claude &> /dev/null; then
                        echo "[AUTO-FIX] Attempting to fix with Claude CLI..."
                        mkdir -p "$WORKSPACE_DIR/deployment-logs"
                        cat > "$WORKSPACE_DIR/deployment-logs/cookie-sync-fix.md" << EOF
# Cookie Sync Fix Required

## Files
- Middleware: $MIDDLEWARE_FILE (expects cookie '$MIDDLEWARE_COOKIE_NAME')
- Auth Store: $AUTH_STORE (needs cookie sync)

## Required Changes
1. In login function (after storing token):
   document.cookie = '$MIDDLEWARE_COOKIE_NAME=' + token + '; path=/; max-age=' + (7 * 24 * 60 * 60);

2. In logout function (when clearing auth):
   document.cookie = '$MIDDLEWARE_COOKIE_NAME=; path=/; max-age=0';
EOF
                        cd "$WORKSPACE_DIR"
                        timeout 300 bash -c "cat '$WORKSPACE_DIR/deployment-logs/cookie-sync-fix.md' | claude --dangerously-skip-permissions 2>&1" | tee "$WORKSPACE_DIR/deployment-logs/cookie-sync-claude.log"
                        if grep -qE "document\.cookie|setCookie|Cookies\.set" "$AUTH_STORE" 2>/dev/null; then
                            echo "[OK] Cookie sync fix applied!"
                        else
                            echo "[WARN] Manual fix may be required"
                        fi
                    fi
                fi
            fi
        fi
    fi
fi

echo "[DONE] Step 1.4 Complete"
```

### Step 1.5: CSS/Tailwind Configuration Pre-Check (MANDATORY - v1.2)

```
+================================================================+
|  CRITICAL: CSS VISUAL VERIFICATION PRE-CHECK                     |
+================================================================+
|                                                                  |
|  PROBLEM: All functional tests pass but UI looks broken!         |
|           - Tailwind classes not applied (unstyled elements)     |
|           - No colors, no spacing, no layout                     |
|           - Buttons and forms are plain HTML without styling     |
|                                                                  |
|  ROOT CAUSE: Config conflict or empty content array              |
|           - tailwind.config.js AND tailwind.config.ts both exist |
|           - .js has content: [] (empty), .ts has correct paths   |
|           - Tailwind prefers .js over .ts, causing CSS failure   |
|                                                                  |
+================================================================+
```

```bash
# ================================================================
# CSS/Tailwind Configuration Pre-Check (ZERO HARDCODING)
# ================================================================
WORKSPACE_DIR="${WORKSPACE_DIR:-$(pwd)}"
FRONTEND_DIR="$WORKSPACE_DIR/frontend"
[ ! -d "$FRONTEND_DIR" ] && FRONTEND_DIR="$WORKSPACE_DIR/src/frontend"
[ ! -d "$FRONTEND_DIR" ] && FRONTEND_DIR="$WORKSPACE_DIR/client"

echo "============================================"
echo "Step 1.5: CSS/Tailwind Configuration Check"
echo "============================================"

CSS_ISSUES=0

if [ ! -d "$FRONTEND_DIR" ]; then
    echo "[SKIP] No frontend directory found"
else
    # Check 1: Detect tailwind config conflict (.js AND .ts both exist)
    JS_CONFIG="$FRONTEND_DIR/tailwind.config.js"
    TS_CONFIG="$FRONTEND_DIR/tailwind.config.ts"

    if [ -f "$JS_CONFIG" ] && [ -f "$TS_CONFIG" ]; then
        echo "[CRITICAL] TAILWIND CONFIG CONFLICT! Both .js AND .ts exist"
        echo "[IMPACT] CSS classes will NOT be generated correctly!"

        # Check if .js has empty content array
        if grep -q 'content.*\[\s*\]' "$JS_CONFIG" 2>/dev/null; then
            echo "[AUTO-FIX] tailwind.config.js has empty content - removing..."
            rm "$JS_CONFIG"
            echo "[OK] tailwind.config.js removed - rebuild required"
            CSS_ISSUES=$((CSS_ISSUES + 1))
        else
            echo "[FIX] Manually check which config file to keep"
        fi
    fi

    # Check 2: Verify content array is not empty
    ACTIVE_CONFIG=""
    [ -f "$JS_CONFIG" ] && ACTIVE_CONFIG="$JS_CONFIG"
    [ -f "$TS_CONFIG" ] && ACTIVE_CONFIG="$TS_CONFIG"

    if [ -n "$ACTIVE_CONFIG" ]; then
        echo "[DETECT] Active Tailwind config: $ACTIVE_CONFIG"
        if grep -q 'content.*\[\s*\]' "$ACTIVE_CONFIG" 2>/dev/null; then
            echo "[CRITICAL] Tailwind config has EMPTY content array!"
            CSS_ISSUES=$((CSS_ISSUES + 1))
        else
            echo "[OK] Tailwind content paths configured"
        fi
    fi
fi

if [ $CSS_ISSUES -gt 0 ]; then
    echo "[WARN] CSS issues detected - rebuild frontend after fixing"
    cd "$FRONTEND_DIR" && npm run build 2>&1 | tail -10
fi
echo "[DONE] Step 1.5 Complete"
```

### Step 1.5.1: GATE 1 - Computed Style Verification (Per Page) [v3.0]

```
+========================================================================================+
|  GATE 1: CSS COMPUTED STYLE VERIFICATION                                                |
|  ⛔ FORBIDDEN: document.querySelectorAll('[class*=flex]') — checks HTML attribute ONLY  |
|  ✅ REQUIRED:  getComputedStyle(element).display — checks ACTUAL RENDERED CSS           |
|                                                                                         |
|  WHY: When CSS framework (Tailwind/etc) is not installed, elements have class="flex"    |
|       in HTML but display:block in computed style. [class*=flex] returns TRUE (lie).     |
|       getComputedStyle() returns the TRUTH of what the browser actually renders.         |
+========================================================================================+
```

For EVERY page tested, verify CSS is ACTUALLY RENDERED (not just class attributes):

```
TASK: GATE 1 - CSS Computed Style Verification

1. After page loads, check COMPUTED styles (ALL checks use getComputedStyle):
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="(() => {
       const result = { raw: {}, verdict: '', derivation: '' };

       // === CHECK 1: Button Computed Background ===
       // MUST use getComputedStyle, NOT [class*=bg-] selector
       const buttons = document.querySelectorAll('button, [type=submit], [role=button]');
       let buttonsWithBg = 0;
       let buttonsTransparent = 0;
       const buttonDetails = [];
       buttons.forEach((btn, i) => {
         const cs = getComputedStyle(btn);
         const bg = cs.backgroundColor;
         const isTransparent = bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
         if (!isTransparent) { buttonsWithBg++; } else { buttonsTransparent++; }
         if (i < 5) {
           buttonDetails.push({
             text: btn.textContent.trim().substring(0, 20),
             computedBg: bg,
             computedPadding: cs.padding,
             computedBorderRadius: cs.borderRadius
           });
         }
       });

       // === CHECK 2: Layout Computed Display (flex/grid) ===
       // MUST use getComputedStyle().display, NOT [class*=flex] selector
       const allElements = document.querySelectorAll('body *');
       let flexCount = 0;
       let gridCount = 0;
       let blockOnlyCount = 0;
       const sampleSize = Math.min(allElements.length, 200);
       for (let i = 0; i < sampleSize; i++) {
         const cs = getComputedStyle(allElements[i]);
         if (cs.display === 'flex' || cs.display === 'inline-flex') flexCount++;
         else if (cs.display === 'grid' || cs.display === 'inline-grid') gridCount++;
         else blockOnlyCount++;
       }

       // === CHECK 3: Typography Computed Font ===
       // MUST use getComputedStyle().fontFamily
       const bodyFont = getComputedStyle(document.body).fontFamily;
       const isDefaultSerif = /^\"?Times/i.test(bodyFont) || bodyFont === 'serif';

       // === CHECK 4: Input Computed Styling ===
       const inputs = document.querySelectorAll('input, textarea, select');
       let styledInputs = 0;
       inputs.forEach(inp => {
         const cs = getComputedStyle(inp);
         const hasBorderRadius = cs.borderRadius !== '0px';
         const hasPadding = cs.paddingLeft !== '0px' || cs.paddingTop !== '0px';
         const hasBorder = cs.borderWidth !== '0px';
         if (hasBorderRadius || hasPadding || hasBorder) styledInputs++;
       });

       // === CHECK 5: Spacing Computed (padding/margin on containers) ===
       const containers = document.querySelectorAll('main, section, article, div[class]');
       let containersWithPadding = 0;
       const containerSample = Math.min(containers.length, 50);
       for (let i = 0; i < containerSample; i++) {
         const cs = getComputedStyle(containers[i]);
         if (cs.paddingLeft !== '0px' || cs.paddingTop !== '0px') containersWithPadding++;
       }

       // === RAW DATA (unforgeable) ===
       result.raw = {
         current_url: window.location.href,  // GATE 6: proves which page this ran on
         buttons_total: buttons.length,
         buttons_with_computed_bg: buttonsWithBg,
         buttons_transparent: buttonsTransparent,
         button_details: buttonDetails,
         flex_computed_count: flexCount,
         grid_computed_count: gridCount,
         block_only_count: blockOnlyCount,
         elements_sampled: sampleSize,
         body_computed_font: bodyFont.substring(0, 80),
         is_default_serif: isDefaultSerif,
         inputs_total: inputs.length,
         inputs_styled_computed: styledInputs,
         containers_with_padding: containersWithPadding,
         containers_sampled: containerSample
       };

       // === VERDICT DERIVATION (transparent logic) ===
       const hasStyledButtons = buttons.length === 0 || buttonsWithBg > 0;
       const hasFlexOrGrid = flexCount > 0 || gridCount > 0;
       const hasCustomFont = !isDefaultSerif;
       const hasStyledInputs = inputs.length === 0 || styledInputs > 0;

       const allCssPassed = hasStyledButtons && hasFlexOrGrid && hasCustomFont && hasStyledInputs;

       result.derivation = 'hasStyledButtons(' + hasStyledButtons +
         ': ' + buttonsWithBg + '/' + buttons.length +
         ') AND hasFlexOrGrid(' + hasFlexOrGrid +
         ': flex=' + flexCount + ',grid=' + gridCount +
         ') AND hasCustomFont(' + hasCustomFont +
         ': ' + bodyFont.substring(0, 30) +
         ') AND hasStyledInputs(' + hasStyledInputs +
         ': ' + styledInputs + '/' + inputs.length + ')';

       result.verdict = allCssPassed ? 'STYLED' : 'BROKEN_CSS';

       return JSON.stringify(result);
     })()"
   )

2. INTERPRET GATE 1 RESULTS:
   | Check | PASS Condition | FAIL Condition | Root Cause if FAIL |
   |-------|----------------|----------------|---------------------|
   | buttons_with_computed_bg > 0 | Buttons have background color | All buttons transparent | CSS framework not installed/loaded |
   | flex_computed_count > 0 | Flex layout rendered | No flex elements | CSS framework not generating flex |
   | is_default_serif = false | Custom font loaded | Times New Roman / serif | Font import missing or CSS not loaded |
   | inputs_styled_computed > 0 | Inputs have styling | Raw unstyled inputs | CSS framework not applied |

3. IF verdict = 'BROKEN_CSS':
   => GATE 1 FAILED — PAGE CANNOT PASS
   => Diagnosis steps:
      a. Check if CSS framework package is installed: package.json
      b. Check if CSS config exists: tailwind.config.*, postcss.config.*
      c. Check if CSS directives exist: @tailwind base/components/utilities
      d. Check for config conflicts: .js AND .ts both exist
   => Fix per react-spa-common-issues.md Section 5.3
   => Rebuild frontend: npm run build OR restart dev server
   => Re-run GATE 1 — MUST PASS before proceeding

4. STORE GATE 1 evidence in page result:
   gate1_css: {
     raw_computed_styles: { ... },  // RAW data from getComputedStyle
     verdict: "STYLED" | "BROKEN_CSS",
     verdict_derivation: "..."  // HOW verdict was derived from raw data
   }

⛔ ANTI-FORGERY RULES FOR GATE 1:
   - FORBIDDEN: Using [class*=flex] or [class*=bg-] to check CSS
   - FORBIDDEN: Reporting css_ok=true without raw_computed_styles
   - FORBIDDEN: Skipping GATE 1 for any page
   - IF raw shows buttons_transparent > 0 AND buttons_with_computed_bg == 0
     BUT verdict says "STYLED" → GATE 6 will detect this as FORGERY
```

### Step 1.5.2: GATE 2 - Content Rendering Verification (Per Page) [v3.0]

```
+========================================================================================+
|  GATE 2: CONTENT RENDERING VERIFICATION                                                 |
|  Verifies page content is ACTUALLY VISIBLE — not loading, not blank, not error-only     |
|                                                                                         |
|  WHY: HTTP 200 does NOT mean the page rendered. A page can return 200 but show:         |
|       - Blank screen (component crash)                                                  |
|       - Infinite "Loading..." spinner (data fetch loop)                                 |
|       - Error boundary message only                                                     |
|       - HTTP 307 redirect masking as success                                            |
+========================================================================================+
```

For EVERY page tested, verify content is ACTUALLY RENDERED:

```
TASK: GATE 2 - Content Rendering Verification

1. After page loads (wait 3-5 seconds), check content rendering:
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="(() => {
       const result = { raw: {}, verdict: '', derivation: '' };

       // === CHECK 1: DOM Depth ===
       // A rendered page has depth >= 3. A blank/crash page has depth 1-2.
       function getMaxDepth(el, depth) {
         if (!el.children || el.children.length === 0) return depth;
         let maxChild = depth;
         const limit = Math.min(el.children.length, 20);
         for (let i = 0; i < limit; i++) {
           maxChild = Math.max(maxChild, getMaxDepth(el.children[i], depth + 1));
         }
         return maxChild;
       }
       const domDepth = getMaxDepth(document.body, 0);

       // === CHECK 2: Visible Text Content ===
       // A rendered page has meaningful text. A blank page has 0 or near-0 chars.
       const bodyText = document.body.innerText || '';
       const visibleTextLength = bodyText.trim().length;
       // Exclude common loading-only text
       const loadingPatterns = /^(loading|読み込み中|加載中|ロード中|\.\.\.)[\\s.]*$/i;
       const isLoadingOnly = loadingPatterns.test(bodyText.trim());

       // === CHECK 3: Loading State ===
       // Page should NOT be stuck on loading spinner
       const loadingSelectors = [
         '[class*=loading]', '[class*=spinner]', '[class*=skeleton]',
         '[role=progressbar]', '.loading', '.spinner'
       ];
       let loadingElements = 0;
       loadingSelectors.forEach(sel => {
         document.querySelectorAll(sel).forEach(el => {
           const cs = getComputedStyle(el);
           if (cs.display !== 'none' && cs.visibility !== 'hidden') loadingElements++;
         });
       });

       // === CHECK 4: Error State ===
       // Page should not show ONLY error content
       const errorSelectors = [
         '[class*=error-boundary]', '[class*=error-page]',
         '[class*=not-found]', '[class*=500]', '[class*=404]'
       ];
       let errorElements = 0;
       errorSelectors.forEach(sel => {
         errorElements += document.querySelectorAll(sel).length;
       });

       // === CHECK 5: Interactive Content ===
       // A functional page has interactive elements (links, buttons, inputs)
       const interactiveCount = document.querySelectorAll(
         'a[href], button, input, select, textarea, [role=button], [role=link]'
       ).length;

       // === RAW DATA ===
       result.raw = {
         dom_depth: domDepth,
         visible_text_length: visibleTextLength,
         visible_text_preview: bodyText.trim().substring(0, 100),
         is_loading_only: isLoadingOnly,
         loading_elements_visible: loadingElements,
         error_elements: errorElements,
         interactive_elements: interactiveCount,
         current_url: window.location.href
       };

       // === VERDICT DERIVATION ===
       const hasDepth = domDepth >= 3;
       const hasText = visibleTextLength >= 50;
       const notLoadingOnly = !isLoadingOnly && loadingElements === 0;
       const notErrorOnly = errorElements === 0 || interactiveCount > 2;

       const contentRendered = hasDepth && hasText && notLoadingOnly && notErrorOnly;

       result.derivation = 'hasDepth(' + hasDepth + ': ' + domDepth +
         ') AND hasText(' + hasText + ': ' + visibleTextLength +
         'chars) AND notLoadingOnly(' + notLoadingOnly +
         ': loading=' + loadingElements +
         ') AND notErrorOnly(' + notErrorOnly +
         ': errors=' + errorElements + ',interactive=' + interactiveCount + ')';

       result.verdict = contentRendered ? 'RENDERED' : 'NOT_RENDERED';

       return JSON.stringify(result);
     })()"
   )

2. INTERPRET GATE 2 RESULTS:
   | Check | PASS | FAIL | Meaning |
   |-------|------|------|---------|
   | dom_depth >= 3 | Content tree exists | Blank or crash | Component failed to render |
   | visible_text_length >= 50 | Text content present | No content | Page is blank or loading |
   | is_loading_only = false | Content loaded | Stuck loading | Data fetch failed or loops |
   | loading_elements = 0 | No spinners visible | Spinners active | Still fetching data |
   | error_elements = 0 | No error displays | Error shown | Component or API error |

3. IF verdict = 'NOT_RENDERED':
   => GATE 2 FAILED — PAGE CANNOT PASS
   => Diagnosis:
      a. If dom_depth < 3: Component crash → check console for errors
      b. If is_loading_only: Data fetch stuck → check network for loop/timeout
      c. If loading_elements > 0: Still loading → wait longer or check API
      d. If error_elements > 0: Error displayed → read error text and fix
   => Fix the underlying issue
   => Re-run GATE 2 — MUST PASS before proceeding

4. STORE GATE 2 evidence in page result:
   gate2_content: {
     raw_dom_depth: N,
     raw_visible_text_length: N,
     raw_loading_elements: N,
     verdict: "RENDERED" | "NOT_RENDERED",
     verdict_derivation: "..."
   }
```

### Step 1.5.3: GATE 3 - Infinite Loop Detection (HARD BLOCK) [v3.0]

```
+========================================================================================+
|  GATE 3: INFINITE LOOP DETECTION — HARD BLOCK (NOT WARNING)                             |
|                                                                                         |
|  IF ANY endpoint is called >= 50 times:                                                 |
|    → PAGE IS BLOCKED — CANNOT PASS — MUST FIX BEFORE PROCEEDING                        |
|    → This is NOT a warning. This is NOT skippable. This is a HARD BLOCK.                |
|                                                                                         |
|  WHY: Infinite loops cause:                                                             |
|    - Browser tab crash / memory exhaustion                                              |
|    - Backend overload / rate limiting                                                   |
|    - All subsequent test results unreliable (page state corrupted)                      |
|    - 998+ requests in a session = definitive proof of loop                              |
+========================================================================================+
```

For EVERY page tested, detect infinite loops BEFORE other testing:

```
TASK: GATE 3 - Infinite Loop Detection (HARD BLOCK)

⚠️ This gate MUST run BEFORE forms/buttons/navigation testing.
    If loop detected, ALL other tests are INVALID until loop is fixed.

0. CLEAR previous page's performance entries (CRITICAL for accurate measurement):
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="performance.clearResourceTimings(); performance.setResourceTimingBufferSize(500); 'cleared'"
   )

1. WAIT 5 seconds for requests to accumulate (MANDATORY - do NOT skip):
   mcp__claude-in-chrome__computer(
     action="wait",
     duration=5,
     tabId={TAB_ID}
   )

2. Check request frequency:
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="(() => {
       const result = { raw: {}, verdict: '', derivation: '' };

       // Count requests per endpoint using Performance API
       const entries = performance.getEntriesByType('resource');
       const urlCounts = {};
       entries.forEach(entry => {
         // Normalize URL: remove query params for grouping
         let url;
         try {
           const parsed = new URL(entry.name);
           url = parsed.pathname;
         } catch(e) {
           url = entry.name.split('?')[0];
         }
         urlCounts[url] = (urlCounts[url] || 0) + 1;
       });

       // Find the most-called endpoint
       let maxUrl = '';
       let maxCount = 0;
       Object.entries(urlCounts).forEach(([url, count]) => {
         if (count > maxCount) { maxCount = count; maxUrl = url; }
       });

       // Sort by frequency (top 10)
       const sortedEndpoints = Object.entries(urlCounts)
         .sort((a, b) => b[1] - a[1])
         .slice(0, 10)
         .map(([url, count]) => ({ url, count }));

       // === RAW DATA ===
       result.raw = {
         current_url: window.location.href,  // GATE 6: proves which page this ran on
         total_requests: entries.length,
         unique_endpoints: Object.keys(urlCounts).length,
         max_single_endpoint_url: maxUrl,
         max_single_endpoint_calls: maxCount,
         top_endpoints: sortedEndpoints,
         measurement_window: '5s_after_page_load',
         buffer_size: 500
       };

       // === VERDICT (HARD THRESHOLD: 50) ===
       const LOOP_THRESHOLD = 50;
       const hasLoop = maxCount >= LOOP_THRESHOLD;

       result.derivation = 'max_single_endpoint_calls(' + maxCount +
         ') ' + (hasLoop ? '>=' : '<') + ' threshold(' + LOOP_THRESHOLD +
         ') endpoint=' + maxUrl;

       result.verdict = hasLoop ? 'INFINITE_LOOP_DETECTED' : 'NO_LOOP';

       return JSON.stringify(result);
     })()"
   )

3. ALSO check via MCP network monitoring:
   mcp__claude-in-chrome__read_network_requests(
     tabId={TAB_ID},
     urlPattern="/api/"
   )
   → Count duplicate URLs in response. If any URL appears >= 50 times → LOOP.

4. INTERPRET GATE 3 RESULTS:

   IF verdict = 'INFINITE_LOOP_DETECTED':
   ╔══════════════════════════════════════════════════════════════╗
   ║  ⛔ HARD BLOCK: INFINITE LOOP DETECTED                      ║
   ║                                                              ║
   ║  Endpoint: {max_single_endpoint_url}                         ║
   ║  Calls: {max_single_endpoint_calls} (threshold: 50)         ║
   ║                                                              ║
   ║  THIS PAGE IS BLOCKED UNTIL LOOP IS FIXED.                  ║
   ║  DO NOT proceed with form/button/link tests.                ║
   ║  DO NOT mark this page as PASS or WARN.                     ║
   ║  DO NOT skip this page.                                     ║
   ║                                                              ║
   ║  COMMON FIXES:                                               ║
   ║  - useEffect dependency array missing/wrong                  ║
   ║  - loadUser()/fetchData() in dep array causing re-render    ║
   ║  - Wrap function in useCallback with correct dependencies   ║
   ║  - See: react-spa-common-issues.md Pattern 2                ║
   ╚══════════════════════════════════════════════════════════════╝

   => FIX THE LOOP
   => Restart frontend if needed
   => Re-navigate to page
   => Re-run GATE 3 — MUST show NO_LOOP before proceeding

5. STORE GATE 3 evidence in page result:
   gate3_loop: {
     raw_request_counts: { ... },
     max_single_endpoint_calls: N,
     verdict: "NO_LOOP" | "INFINITE_LOOP_DETECTED",
     verdict_derivation: "..."
   }
```

### Step 1.5.4: GATE 4 - Screenshot Evidence (MANDATORY) [v3.0]

```
+========================================================================================+
|  GATE 4: SCREENSHOT EVIDENCE — MANDATORY FOR EVERY PAGE                                 |
|                                                                                         |
|  Every page MUST have a screenshot taken AFTER content loads (not during loading).       |
|  The screenshot imageId MUST be recorded in the evidence chain.                          |
|  screenshots_taken > 0 WITHOUT imageId = FORGERY = AUTOMATIC FAILURE                    |
+========================================================================================+
```

```
TASK: GATE 4 - Screenshot Evidence

1. AFTER GATE 1, GATE 2, GATE 3 all pass, take screenshot:
   mcp__claude-in-chrome__computer(
     action="screenshot",
     tabId={TAB_ID}
   )
   → This returns a screenshot with an imageId.
   → RECORD the imageId in the evidence chain.

2. VERIFY screenshot was captured:
   - The screenshot tool returns an image. If it fails, retry once.
   - The imageId from the tool response MUST be stored.

3. STORE GATE 4 evidence in page result:
   gate4_screenshot: {
     screenshot_taken: true,
     screenshot_imageId: "{imageId_from_tool_response}",
     verdict: "CAPTURED"
   }

4. IF screenshot fails after 2 attempts:
   gate4_screenshot: {
     screenshot_taken: false,
     screenshot_imageId: null,
     verdict: "CAPTURE_FAILED",
     error: "{error_message}"
   }
   => GATE 4 FAILED — PAGE CANNOT PASS without screenshot evidence

⛔ ANTI-FORGERY RULE:
   - screenshots_taken: 12 in summary but 0 imageIds in evidence_chain = FORGERY
   - Each screenshot_imageId must correspond to an actual tool call
```

---

## Step 2: Page Discovery

### Step 2.1: Identify All Pages to Test

```
TASK: Discover All Application Pages

METHOD 1: Read from frontend route configuration
- Check: frontend/src/routes.tsx, frontend/src/App.tsx, frontend/src/router/*
- Extract all route paths defined in React Router

METHOD 2: Read from sitemap or navigation
- Look for: sidebar component, navbar, menu items
- Extract all link destinations

METHOD 3: Explore from login page
- Start at login page
- After login, explore all navigable pages
- Build page inventory dynamically

SAVE page inventory to: test-logs/phase5c_page_inventory.json
```

---

## Step 3: Login Flow Testing

### Step 3.1: Test Login Page

```
TASK: Test Login Flow (MUST USE MCP TOOLS!)

1. Navigate to Frontend URL:
   >>> mcp__claude-in-chrome__navigate(url="{FRONTEND_URL}", tabId={TAB_ID})

2. Take screenshot of initial page:
   >>> mcp__claude-in-chrome__computer(action="screenshot", tabId={TAB_ID})

3. Find login form elements:
   >>> mcp__claude-in-chrome__find(query="email input field", tabId={TAB_ID})
   >>> mcp__claude-in-chrome__find(query="password input field", tabId={TAB_ID})
   >>> mcp__claude-in-chrome__find(query="login button", tabId={TAB_ID})

4. Fill login form with test credentials:
   >>> mcp__claude-in-chrome__form_input(ref="{email_ref}", value="{TEST_EMAIL}", tabId={TAB_ID})
   >>> mcp__claude-in-chrome__form_input(ref="{password_ref}", value="{TEST_PASSWORD}", tabId={TAB_ID})

5. Click login button:
   >>> mcp__claude-in-chrome__computer(action="left_click", ref="{login_button_ref}", tabId={TAB_ID})

6. Wait and verify:
   >>> mcp__claude-in-chrome__computer(action="wait", duration=3, tabId={TAB_ID})
   >>> mcp__claude-in-chrome__computer(action="screenshot", tabId={TAB_ID})

7. Check network requests:
   >>> mcp__claude-in-chrome__read_network_requests(tabId={TAB_ID}, urlPattern="/api/")

8. Check URL changed:
   >>> mcp__claude-in-chrome__javascript_tool(action="javascript_exec", text="window.location.href", tabId={TAB_ID})

9. IF LOGIN FAILS:
   => STOP - Fix the code
   => Re-run steps 4-8
   => MUST PASS before continuing
```

### Step 3.2: Post-Login Verification (Hydration Test)

```
CRITICAL: Hydration Test

After successful login, verify:
1. Page renders correctly (no flash of login page)
2. No redirect back to /login
3. Token is stored correctly
4. Authenticated API calls work

IF redirect to /login after login:
   => This is a CRITICAL bug (hydration failure)
   => Check: Token storage, auth context, route guards
   => Fix immediately before proceeding
```

---

## Step 3.5: Enhanced State Verification (NEW - MANDATORY)

```
+================================================================+
|  ENHANCED STATE VERIFICATION                                     |
+================================================================+
|                                                                  |
|  NEW CHECKS (v1.1):                                              |
|  1. Network Requests Monitoring                                  |
|  2. Cookie State Verification                                    |
|  3. LocalStorage State Verification                              |
|  4. Post-Redirect Auth State Confirmation                        |
|  5. Build Log Encoding Analysis                                  |
|                                                                  |
|  Reference: react-spa-common-issues.md Section 2.5               |
|                                                                  |
+================================================================+
```

### Step 3.5.1: Network Request Monitoring

```
TASK: Initialize and Monitor Network Requests

1. Initialize Monitoring:
   mcp__claude-in-chrome__read_network_requests(tabId={TAB_ID}, clear=true)

2. AFTER EACH Page Navigation:
   a. Wait 3 seconds for requests to complete
   b. Capture requests:
      mcp__claude-in-chrome__read_network_requests(tabId={TAB_ID}, urlPattern="/api/")

   c. Verify ALL responses:
      | Status | Interpretation | Action |
      |--------|---------------|--------|
      | 200-204 | Success | PASS |
      | 400 | Bad request | Check request body format |
      | 401 | Unauthorized | Check token validity |
      | 403 | Forbidden | Check permissions |
      | 404 | Not found | Check endpoint path |
      | 422 | Validation error | Check request schema |
      | 500 | Server error | Check backend logs |

3. DETECT Infinite Loop (aligned with GATE 3 threshold):
   - If same endpoint appears >= 50 times → HARD BLOCK (see GATE 3, Step 1.5.3)
   - CAUSE: Missing useCallback/useMemo dependency
   - FIX: Wrap API call in useCallback with proper deps
   - See: react-spa-common-issues.md Pattern 2

4. Record network health per page:
   - Total requests made
   - Failed requests (4xx/5xx)
   - Slow requests (>3000ms)
```

### Step 3.5.2: Cookie State Verification

```
TASK: Verify Cookie State After Login

1. After successful login, check cookies via JavaScript:
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="JSON.stringify({
       cookies: document.cookie,
       hasAuthCookie: document.cookie.includes('token') ||
                      document.cookie.includes('session') ||
                      document.cookie.includes('auth')
     })"
   )

2. Expected Cookie Patterns:
   | Framework | Cookie Name Pattern | SameSite |
   |-----------|---------------------|----------|
   | Next.js | next-auth.* or __Secure-* | Lax or Strict |
   | Custom JWT | token, access_token | Lax |
   | Session | session_id, JSESSIONID | Strict |

3. IF NO AUTH COOKIE FOUND:
   => Token may be stored in localStorage (check Step 3.5.3)
   => Or HttpOnly cookie (cannot read via JS, but verify via API calls)

4. Cookie Persistence Test:
   a. After login, take screenshot
   b. Refresh page (navigate to same URL)
   c. Verify user is still logged in
   d. If logged out after refresh => Cookie/Token not persisted
   e. FIX: Check cookie expiry, SameSite, Secure flags
   f. See: react-spa-common-issues.md Section 2.5
```

### Step 3.5.3: LocalStorage State Verification

```
TASK: Verify LocalStorage Authentication State

1. After login, check localStorage:
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="JSON.stringify({
       token: localStorage.getItem('token') || localStorage.getItem('access_token'),
       user: localStorage.getItem('user'),
       authState: localStorage.getItem('auth-storage'),
       allKeys: Object.keys(localStorage)
     })"
   )

2. Expected LocalStorage Patterns:
   | State Manager | Storage Key | Format |
   |--------------|-------------|--------|
   | Zustand persist | auth-storage | JSON with state.* |
   | Redux persist | persist:root | JSON with auth slice |
   | Custom | token, user | Raw or JSON |

3. Zustand Persist Verification (Common Pattern):
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="(() => {
       try {
         const store = JSON.parse(localStorage.getItem('auth-storage') || '{}');
         return JSON.stringify({
           hasState: !!store.state,
           token: store.state?.token ? 'present' : 'missing',
           user: store.state?.user ? 'present' : 'missing',
           isAuthenticated: store.state?.isAuthenticated || false
         });
       } catch(e) { return JSON.stringify({error: e.message}); }
     })()"
   )

4. IF LocalStorage Empty After Login:
   => Check middleware cookie sync issue
   => See: react-spa-common-issues.md Section 2.5
   => Fix: Ensure server-side sets cookies that client reads
```

### Step 3.5.4: Post-Redirect Authentication State

```
TASK: Verify Auth State Persists After Redirect

1. Scenario: Login redirects to /dashboard
   a. Complete login
   b. Wait for redirect to complete
   c. Take screenshot
   d. Verify:
      - URL is now /dashboard (not /login)
      - User info visible in navbar/header
      - No "Login" button visible (should be "Logout")
      - Protected content is displayed

2. Deep Link Test:
   a. Navigate directly to protected page: {FRONTEND_URL}/dashboard
   b. Expected behaviors:
      - If logged in: Page loads normally
      - If not logged in: Redirect to /login
   c. Verify no infinite redirect loop (/login -> /dashboard -> /login)

3. Auth State After Page Reload:
   a. On /dashboard, perform page refresh:
      mcp__claude-in-chrome__navigate(url="{CURRENT_URL}", tabId={TAB_ID})
   b. Wait 3 seconds
   c. Verify still on /dashboard (not redirected to /login)
   d. IF REDIRECTED TO LOGIN:
      => CRITICAL BUG: Auth state not persisting
      => Check: Cookie/localStorage persistence
      => Check: SSR hydration mismatch
      => See: react-spa-common-issues.md Section 2.5

4. Record Auth Persistence:
   | Check | Expected | Result |
   |-------|----------|--------|
   | Login redirect | /dashboard | PASS/FAIL |
   | Post-redirect auth | Authenticated | PASS/FAIL |
   | Page reload auth | Still authenticated | PASS/FAIL |
   | Deep link access | Authenticated | PASS/FAIL |
```

### Step 3.5.5: Build Log Encoding Analysis (Windows)

```
TASK: Prevent Build Log Encoding Errors

1. Check for encoding-sensitive files:
   - Files with non-ASCII characters in paths
   - Source files with Japanese/Chinese comments
   - Config files with special characters

2. Common Encoding Errors:
   | Error Pattern | Cause | Fix |
   |--------------|-------|-----|
   | cp932 codec can't decode | Windows shift-jis vs UTF-8 | Set PYTHONIOENCODING=utf-8 |
   | UnicodeDecodeError | File opened without encoding | Add encoding='utf-8' |
   | Invalid byte sequence | Mixed encodings in file | Convert to UTF-8 |

3. Pre-Build Encoding Verification:
   - Check console output encoding:
     mcp__claude-in-chrome__read_console_messages(tabId={TAB_ID}, pattern="codec|encode|decode")

   - If encoding errors detected:
     a. Identify problematic file
     b. Convert to UTF-8
     c. Or set environment variable: PYTHONIOENCODING=utf-8

4. Frontend Build Log Check:
   - After npm run build, check for:
     - "error" or "failed" in output
     - Encoding-related warnings
     - Path resolution issues with non-ASCII

5. Record Encoding Health:
   | Check | Status |
   |-------|--------|
   | Console encoding | UTF-8 / cp932 |
   | Build log errors | None / Count |
   | File path issues | None / List |
```

### Step 3.5.6: Enhanced State Verification Summary

```
MANDATORY: Run All Enhanced Checks

AFTER LOGIN (Steps 3.5.1-3.5.4):

1. Network: Clear → Login → Verify 200/204 → No 4xx/5xx
2. Cookie: Check auth cookie exists (or HttpOnly confirmed via API)
3. LocalStorage: Check token/user state persisted
4. Redirect: Verify on /dashboard, not /login
5. Reload: Refresh page, verify still authenticated

CREATE: test-logs/phase5c_state_verification.json

{
  "timestamp": "{ISO_TIMESTAMP}",
  "network": {
    "total_requests": 10,
    "failed_requests": 0,
    "slow_requests": 1,
    "infinite_loops_detected": false
  },
  "cookies": {
    "auth_cookie_present": true,
    "cookie_name": "token",
    "same_site": "Lax"
  },
  "localStorage": {
    "token_present": true,
    "user_present": true,
    "state_manager": "zustand-persist"
  },
  "redirect": {
    "login_redirects_to": "/dashboard",
    "post_redirect_authenticated": true,
    "reload_maintains_auth": true
  },
  "encoding": {
    "console_encoding": "utf-8",
    "build_errors": 0
  },
  "overall_status": "PASS"
}
```

---

## Step 4: Comprehensive Page Testing with Real-Time Bug Fixing

### Testing Algorithm (Efficient Mode + 6-GATE System v3.0)

```
ALGORITHM: Real-Time UI Test and Fix with 6-GATE Verification

INITIALIZATION:
- PAGE_RESULTS = []
- EVIDENCE_CHAIN = []   // v3.0: Evidence for GATE 5
- BUGS_FIXED = []
- pass_count = 0
- fail_count = 0
- fix_count = 0

FOR EACH page in page_inventory:

    page_evidence = {
      page_url: "{page_url}",
      gate1_css: null,
      gate2_content: null,
      gate3_loop: null,
      gate4_screenshot: null,
      criteria_results: {},
      overall_verdict: null,
      all_gates_passed: false
    }

    1. NAVIGATE TO PAGE:
       - Use navigate tool to go to page URL
       - Wait 5 seconds for page to fully load
       - Clear performance entries for clean measurement

    2. RUN 6-GATE VERIFICATION (IN ORDER — GATES ARE SEQUENTIAL):

       ┌─────────────────────────────────────────────────────┐
       │ GATE 3: Infinite Loop Detection (RUN FIRST!)       │
       │ → See Step 1.5.3                                    │
       │ → IF INFINITE_LOOP_DETECTED → HARD BLOCK            │
       │ → CANNOT proceed to any other gate or test          │
       │ → FIX LOOP → RE-NAVIGATE → RE-RUN GATE 3           │
       └─────────────────────────────────────────────────────┘
       ↓ (only if GATE 3 = NO_LOOP)
       ┌─────────────────────────────────────────────────────┐
       │ GATE 2: Content Rendering Verification              │
       │ → See Step 1.5.2                                    │
       │ → IF NOT_RENDERED → FIX → RE-RUN                    │
       └─────────────────────────────────────────────────────┘
       ↓ (only if GATE 2 = RENDERED)
       ┌─────────────────────────────────────────────────────┐
       │ GATE 1: CSS Computed Style Verification             │
       │ → See Step 1.5.1                                    │
       │ → IF BROKEN_CSS → FIX → REBUILD → RE-RUN            │
       └─────────────────────────────────────────────────────┘
       ↓ (only if GATE 1 = STYLED)
       ┌─────────────────────────────────────────────────────┐
       │ GATE 4: Screenshot Evidence                         │
       │ → See Step 1.5.4                                    │
       │ → Take screenshot, record imageId                   │
       │ → IF CAPTURE_FAILED → RETRY once                    │
       └─────────────────────────────────────────────────────┘

       IF ANY GATE FAILS:
           → FIX the issue
           → RE-NAVIGATE to page
           → RE-RUN ALL GATES from GATE 3
           → MAX 3 fix attempts per gate

       IF ALL 4 GATES PASS:
           → Record gate evidence in page_evidence
           → Proceed to P0 criteria testing

    3. CHECK REMAINING P0 CRITERIA:

       CRITERION 1: Screen Display OK
       - Use read_page to check for error elements
       - Search for: "error", "failed", "404", "500", "exception"
       - IF visible errors found => FAIL, go to step 4

       CRITERION 2: Network No Errors
       - Use read_network_requests
       - Check for any 4xx or 5xx status codes
       - IF network errors found => FAIL, go to step 4

       CRITERION 3: Console No Errors
       - Use read_console_messages with pattern "error"
       - Check for JavaScript errors
       - IF console errors found => FAIL, go to step 4

       CRITERION 4: Empty Data Handled
       - If page shows data lists, check for undefined/null handling
       - If errors appear for empty data => FAIL, go to step 4

       IF ALL CRITERIA AND ALL GATES PASS:
           page_evidence.overall_verdict = "PASS"
           page_evidence.all_gates_passed = true
           PAGE_RESULTS.append({page, "PASSED"})
           EVIDENCE_CHAIN.append(page_evidence)
           pass_count += 1
           CONTINUE to next page

    4. IMMEDIATE BUG FIX (Efficient Mode Key Feature):

       ⚠️ BEFORE ANY FIX: Consult reference documents!
       >>> react-spa-common-issues.md - for ALL frontend/React/CSS bugs
       >>> api-backend-common-issues.md - for ALL API/backend bugs
       DO NOT GUESS - find the matching pattern in reference docs first!

       Identify the failing criterion/gate and fix:

       GATE 3 FAILED (Infinite Loop):
         - Identify repeating endpoint from gate3_loop.raw
         - CONSULT: react-spa-common-issues.md Pattern 2 (useCallback/useMemo)
         - Fix React hook dependencies per reference doc
         - Restart frontend if needed
         - RETRY from GATE 3

       GATE 2 FAILED (Not Rendered):
         - Check gate2_content.raw for diagnosis
         - If dom_depth < 3: Component crash → fix component
         - If loading_elements > 0: Data fetch issue → fix API/hooks
         - CONSULT: react-spa-common-issues.md Section 1
         - RETRY from GATE 3

       GATE 1 FAILED (CSS Broken):
         - Check gate1_css.raw for diagnosis
         - CONSULT: react-spa-common-issues.md Section 5.3 (4-layer Tailwind diagnosis)
         - Fix CSS framework installation/config
         - Rebuild frontend
         - RETRY from GATE 3

       SCREEN DISPLAY ERROR:
         - Read error message on screen
         - CONSULT: react-spa-common-issues.md (Section 1: Blank Page)
         - Fix the React component per reference doc pattern
         - RETRY same page

       NETWORK 4xx/5xx:
         - Identify failing API endpoint
         - CONSULT: api-backend-common-issues.md (CORS, Auth, Route errors)
         - Fix backend/frontend per reference doc
         - RETRY same page

       CONSOLE JS ERROR:
         - Read error stack trace
         - CONSULT: react-spa-common-issues.md (Section 1: Router, Section 2: API format)
         - Fix the code per reference doc pattern
         - RETRY same page

    5. AFTER FIX:
       fix_count += 1
       BUGS_FIXED.append({page, gate_or_criterion_failed, fix_applied})

       # Re-test after fix — RE-RUN ALL GATES from scratch
       GOTO step 1 for same page

       IF still fails after 3 fix attempts per gate/criterion:
           LOG: "Unable to fix after 3 attempts"
           page_evidence.overall_verdict = "FAILED"
           page_evidence.all_gates_passed = false
           PAGE_RESULTS.append({page, "FAILED", attempts=3})
           EVIDENCE_CHAIN.append(page_evidence)
           fail_count += 1
           CONTINUE to next page

    6. RECORD FINAL RESULT WITH EVIDENCE (GATE 5):
       PAGE_RESULTS.append({page, result, fix_attempts, gate_results})
       EVIDENCE_CHAIN.append(page_evidence)

END FOR

FINAL STATS:
- Total pages tested: len(PAGE_RESULTS)
- Passed: pass_count
- Failed: fail_count
- Bugs fixed: fix_count
- Pass rate: pass_count / len(PAGE_RESULTS) * 100
- Evidence chain entries: len(EVIDENCE_CHAIN)
- Gates passed (all pages): count where all_gates_passed=true
```

---

---

## Step 4.8: IMMEDIATE BUG FIX PROTOCOL (MANDATORY)

```
+================================================================+
|  BUG FIX PROTOCOL - NO DELAYS ALLOWED                            |
+================================================================+
|                                                                  |
|  When ANY test fails:                                            |
|                                                                  |
|  1. STOP TESTING IMMEDIATELY                                     |
|     - Do NOT proceed to next element                             |
|     - Do NOT skip the failing test                               |
|     - Do NOT mark as "known issue"                               |
|                                                                  |
|  2. ANALYZE THE FAILURE                                          |
|     - Check console for errors                                   |
|     - Check network for API failures                             |
|     - Check DOM for missing elements                             |
|     - Identify root cause                                        |
|                                                                  |
|  3. FIX THE CODE                                                 |
|     - Frontend: Edit React/Vue/etc component                     |
|     - Backend: Edit API endpoint                                 |
|     - Config: Fix environment/settings                           |
|                                                                  |
|  4. REBUILD IF NECESSARY                                         |
|     - npm run build (if static)                                  |
|     - Restart dev server (if hot reload fails)                   |
|                                                                  |
|  5. RE-TEST THE SAME ELEMENT                                     |
|     - Same form, same button, same link                          |
|     - MUST PASS before continuing                                |
|                                                                  |
|  6. RECORD THE FIX                                               |
|     - File changed                                               |
|     - Lines modified                                             |
|     - Bug description                                            |
|     - Fix description                                            |
|                                                                  |
+================================================================+
```

### Bug Fix Decision Tree

```
TEST FAILED
    │
    ├─ Console Error?
    │   ├─ TypeError → Add null check / optional chaining
    │   ├─ ReferenceError → Check imports / variable names
    │   └─ SyntaxError → Fix code syntax
    │
    ├─ Network Error?
    │   ├─ 401 → Fix authentication / token
    │   ├─ 403 → Fix permissions / CORS
    │   ├─ 404 → Fix API route / endpoint URL
    │   ├─ 422 → Fix request body / validation
    │   └─ 500 → Fix backend code
    │
    ├─ UI Not Working?
    │   ├─ Button no action → Add onClick handler
    │   ├─ Form not submitting → Fix form onSubmit
    │   ├─ Link not navigating → Fix href / router
    │   └─ Modal not opening → Fix state management
    │
    └─ Data Not Showing?
        ├─ Empty list → Check API response / data fetching
        ├─ Wrong data → Check data mapping / state
        └─ Stale data → Add refresh / re-fetch
```

### Bug Fix Record Template

```json
{
  "bug_id": "BUG-001",
  "timestamp": "2024-01-21T10:30:00Z",
  "page": "/dashboard",
  "element": "Create Button",
  "test_type": "button_click",
  "failure_description": "Button click does nothing",
  "root_cause": "Missing onClick handler",
  "fix_applied": {
    "file": "frontend/components/Dashboard.tsx",
    "line": 45,
    "before": "<Button>Create</Button>",
    "after": "<Button onClick={handleCreate}>Create</Button>"
  },
  "retest_result": "PASS",
  "fixed_at": "2024-01-21T10:35:00Z"
}
```

---

## Step 4.7: MANDATORY Button Testing (100% Coverage)

```
+================================================================+
|  BUTTON TESTING - EVERY BUTTON MUST BE TESTED                    |
+================================================================+
```

### Step 4.7.1: Button Discovery

```
TASK: Discover ALL Buttons on Page

mcp__claude-in-chrome__javascript_tool(
  action="javascript_exec",
  tabId={TAB_ID},
  text="(() => {
    const buttons = document.querySelectorAll('button, [role=button], input[type=button], .btn, [class*=button]');

    return JSON.stringify({
      totalButtons: buttons.length,
      buttons: Array.from(buttons).map((btn, i) => ({
        index: i,
        text: btn.textContent.trim().substring(0, 30) || btn.value || btn.title || 'No text',
        type: btn.type || 'button',
        disabled: btn.disabled,
        classes: btn.className.substring(0, 50)
      })).slice(0, 20)
    });
  })()"
)
```

### Step 4.7.2: Button Click Testing

```
TASK: Click and Verify EVERY Button

FOR EACH button (excluding disabled):

1. IDENTIFY button purpose:
   | Button Text Pattern | Expected Action |
   |---------------------|-----------------|
   | 新規, Add, Create, + | Open create form/modal |
   | 編集, Edit, ✏️ | Open edit form/modal |
   | 削除, Delete, 🗑️ | Show confirmation dialog |
   | 保存, Save, Submit | Submit form data |
   | キャンセル, Cancel | Close modal/form |
   | 検索, Search, 🔍 | Execute search |
   | ログアウト, Logout | Redirect to login |
   | ダウンロード, Download | Download file |

2. CLICK button:
   mcp__claude-in-chrome__computer(
     action="left_click",
     tabId={TAB_ID},
     ref="{button_ref}"
   )

3. WAIT for action (2 seconds)

4. VERIFY expected action occurred:
   - Modal opened? Check for modal element
   - Form appeared? Check for form element
   - API called? Check network requests
   - Page changed? Check URL
   - Message shown? Check for toast/alert

5. HANDLE modals/dialogs:
   IF modal opened:
     - Test modal content
     - Test modal buttons (Submit, Cancel)
     - Verify modal closes correctly

6. RESULT recording:
   {
     "button": "Add New",
     "action": "left_click",
     "expected": "Modal opens",
     "actual": "Modal opened with form",
     "status": "PASS"
   }

7. IF BUTTON TEST FAILS:
   => STOP immediately
   => Identify issue:
      - Button does nothing? → Add onClick handler
      - Wrong action? → Fix handler logic
      - Error occurs? → Fix the handler code
   => Re-test same button
   => Proceed only after PASS
```

### Step 4.7.3: CRUD Button Testing

```
TASK: Test Create/Read/Update/Delete Operations

IF page has data list/table:

1. CREATE TEST:
   a. Click "Add" / "新規作成" button
   b. Fill form with test data
   c. Submit form
   d. VERIFY: New item appears in list
   e. IF NOT VISIBLE:
      => FAIL - Fix create logic
      => Re-test

2. READ TEST:
   a. Click on item row (if clickable)
   b. OR click "View" / "詳細" button
   c. VERIFY: Detail page/modal shows correct data
   d. IF DATA WRONG:
      => FAIL - Fix data display
      => Re-test

3. UPDATE TEST:
   a. Click "Edit" / "編集" button
   b. Modify form data
   c. Submit changes
   d. VERIFY: Updated data appears in list
   e. IF NOT UPDATED:
      => FAIL - Fix update logic
      => Re-test

4. DELETE TEST:
   a. Click "Delete" / "削除" button
   b. VERIFY: Confirmation dialog appears
   c. Click confirm
   d. VERIFY: Item removed from list
   e. IF NOT REMOVED:
      => FAIL - Fix delete logic
      => Re-test

CRUD TEST RESULTS:
{
  "page": "/items",
  "crud": {
    "create": "PASS",
    "read": "PASS",
    "update": "PASS",
    "delete": "PASS"
  }
}
```

---

## Step 4.6: MANDATORY Navigation Testing (100% Coverage)

```
+================================================================+
|  NAVIGATION TESTING - EVERY LINK MUST BE TESTED                  |
+================================================================+
```

### Step 4.6.1: Link Discovery

```
TASK: Discover ALL Links on Page

1. Find all navigable elements:
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="(() => {
       const links = document.querySelectorAll('a[href]');
       const buttons = document.querySelectorAll('button, [role=button]');
       const clickables = document.querySelectorAll('[onclick], [data-href]');

       const linkData = Array.from(links).map(a => ({
         text: a.textContent.trim().substring(0, 50),
         href: a.href,
         isExternal: a.hostname !== window.location.hostname,
         isAnchor: a.href.startsWith('#') || a.href.includes('#')
       })).filter(l => !l.isExternal && !l.isAnchor && l.href);

       return JSON.stringify({
         totalLinks: linkData.length,
         links: linkData.slice(0, 20)
       });
     })()"
   )

2. CREATE navigation inventory:
   test-logs/phase5c_navigation_inventory.json
```

### Step 4.6.2: Link Click Testing

```
TASK: Click and Verify EVERY Internal Link

FOR EACH internal link:

1. RECORD current URL
2. CLICK the link:
   mcp__claude-in-chrome__computer(
     action="left_click",
     tabId={TAB_ID},
     ref="{link_ref}"
   )

3. WAIT for navigation (max 5 seconds)

4. VERIFY destination:
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="window.location.href"
   )

5. CHECK page loaded correctly:
   - No error page (404, 500)
   - No JavaScript errors
   - Content renders

6. NAVIGATE BACK:
   mcp__claude-in-chrome__navigate(
     url="back",
     tabId={TAB_ID}
   )

7. VERIFY returned to original page

8. RESULT:
   | Outcome | Status | Action |
   |---------|--------|--------|
   | Correct page loads | PASS | Continue |
   | 404 error | FAIL | Fix route |
   | 500 error | FAIL | Fix backend |
   | Blank page | FAIL | Fix component |
   | JS error | FAIL | Fix code |
   | Wrong page | FAIL | Fix href |

9. IF NAVIGATION FAILS:
   => STOP - Fix immediately
   => Re-test same link
   => Proceed only after PASS
```

### Step 4.6.3: Menu/Sidebar Navigation

```
TASK: Test ALL Menu Items

1. IDENTIFY menu/sidebar:
   mcp__claude-in-chrome__find(
     tabId={TAB_ID},
     query="navigation menu or sidebar"
   )

2. FOR EACH menu item:
   - Click menu item
   - Verify page loads
   - Verify menu indicates active state
   - Navigate back or to next item

3. VERIFY menu state:
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="(() => {
       const activeItems = document.querySelectorAll('[class*=active], [aria-current=page], .selected');
       return JSON.stringify({
         activeCount: activeItems.length,
         activeTexts: Array.from(activeItems).map(a => a.textContent.trim().substring(0, 30))
       });
     })()"
   )
```

---

## Step 4.5: MANDATORY Form Testing (100% Coverage)

```
+================================================================+
|  FORM TESTING - EVERY FORM MUST BE TESTED                        |
+================================================================+
```

### Step 4.5.1: Form Discovery

```
TASK: Discover ALL Forms on Page

1. Find all forms on current page:
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="(() => {
       const forms = document.querySelectorAll('form');
       const formInputs = document.querySelectorAll('input, textarea, select');
       const submitButtons = document.querySelectorAll('button[type=submit], input[type=submit], button:not([type])');

       const formData = [];
       forms.forEach((form, i) => {
         const inputs = form.querySelectorAll('input, textarea, select');
         formData.push({
           formIndex: i,
           action: form.action || 'N/A',
           method: form.method || 'GET',
           inputCount: inputs.length,
           inputs: Array.from(inputs).map(inp => ({
             type: inp.type || inp.tagName.toLowerCase(),
             name: inp.name || inp.id || 'unnamed',
             required: inp.required,
             placeholder: inp.placeholder || ''
           }))
         });
       });

       return JSON.stringify({
         totalForms: forms.length,
         totalInputs: formInputs.length,
         submitButtons: submitButtons.length,
         forms: formData
       });
     })()"
   )

2. CREATE form inventory:
   test-logs/phase5c_form_inventory.json
   {
     "page": "/current-page",
     "forms": [...],
     "tested": false,
     "results": []
   }

3. IF forms.length > 0:
   => MUST TEST EVERY FORM (no exceptions)
```

### Step 4.5.2: Form Input Testing

```
TASK: Fill and Submit EVERY Form

FOR EACH form discovered:

1. FILL ALL INPUT FIELDS:

   Text inputs (text, email, password):
   mcp__claude-in-chrome__form_input(
     tabId={TAB_ID},
     ref="{input_ref}",
     value="{test_value}"
   )

   Test values by field type:
   | Field Type | Test Value |
   |------------|------------|
   | email | test@example.com |
   | password | Test@123456 |
   | text (name) | Test User |
   | text (title) | Test Title |
   | number | 100 |
   | tel | 09012345678 |
   | url | https://example.com |
   | date | 2024-01-15 |
   | textarea | This is a test description for the form field. |

2. HANDLE SELECT DROPDOWNS:
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="(() => {
       const select = document.querySelector('select[name={name}]');
       if (select && select.options.length > 1) {
         select.selectedIndex = 1;
         select.dispatchEvent(new Event('change', { bubbles: true }));
         return 'Selected: ' + select.options[1].text;
       }
       return 'No options available';
     })()"
   )

3. HANDLE CHECKBOXES/RADIOS:
   mcp__claude-in-chrome__computer(
     action="left_click",
     tabId={TAB_ID},
     ref="{checkbox_ref}"
   )

4. SUBMIT THE FORM:
   - Find submit button:
     mcp__claude-in-chrome__find(
       tabId={TAB_ID},
       query="submit button"
     )
   - Click submit:
     mcp__claude-in-chrome__computer(
       action="left_click",
       tabId={TAB_ID},
       ref="{submit_ref}"
     )

5. VERIFY SUBMISSION RESULT:
   - Wait 3 seconds for response
   - Check for:
     a. Success message/toast
     b. Page redirect
     c. Error message (validation)
     d. Network response (200/201/400/422)

   mcp__claude-in-chrome__read_network_requests(
     tabId={TAB_ID},
     urlPattern="/api/"
   )

6. RESULT INTERPRETATION:
   | Response | Status | Action |
   |----------|--------|--------|
   | 200/201 | PASS | Form works correctly |
   | 400/422 with message | PASS | Validation works |
   | 400/422 no message | FAIL | Add error display |
   | 500 | FAIL | Fix backend |
   | No response | FAIL | Check form action |

7. IF FORM TEST FAILS:
   => STOP - DO NOT PROCEED
   => Analyze the error
   => Fix the code (frontend or backend)
   => Re-test the SAME form
   => Only proceed after PASS
```

### Step 4.5.3: Form Validation Testing

```
TASK: Test Form Validation (Required Fields)

FOR EACH form with required fields:

1. SUBMIT EMPTY FORM:
   - Clear all fields
   - Click submit
   - VERIFY: Error messages appear for required fields

2. SUBMIT INVALID DATA:
   | Field | Invalid Value | Expected Error |
   |-------|--------------|----------------|
   | email | "notanemail" | Invalid email format |
   | password | "123" | Password too short |
   | phone | "abc" | Invalid phone number |
   | url | "notaurl" | Invalid URL |

3. CHECK ERROR DISPLAY:
   mcp__claude-in-chrome__javascript_tool(
     action="javascript_exec",
     tabId={TAB_ID},
     text="(() => {
       const errors = document.querySelectorAll('.error, .invalid, [class*=error], [class*=invalid], [aria-invalid=true]');
       return JSON.stringify({
         errorCount: errors.length,
         errorMessages: Array.from(errors).map(e => e.textContent.trim()).slice(0, 5)
       });
     })()"
   )

4. IF NO ERROR MESSAGES:
   => FAIL - Validation not implemented
   => Add error display to form
   => Re-test
```

## Step 5: Interactive Element Testing

For each page, also test interactive elements:

```
TASK: Test Interactive Elements

FOR EACH page that passed basic tests:

    1. IDENTIFY INTERACTIVE ELEMENTS:
       - Use read_page with filter="interactive"
       - Find: buttons, links, form inputs, dropdowns

    2. TEST EACH ELEMENT:

       BUTTONS:
       - Click each button
       - Verify action occurs (modal opens, navigation, API call)
       - Check for errors after click

       FORMS:
       - Fill form fields with valid data
       - Submit form
       - Verify success or proper validation error

       NAVIGATION:
       - Click each link
       - Verify correct page loads
       - Use navigate("back") to return

       DROPDOWNS/SELECTS:
       - Open dropdown
       - Select an option
       - Verify selection persists

    3. IF ANY INTERACTION FAILS:
       => IMMEDIATE FIX
       => Record bug and fix
       => Re-test element
```

---

### ⛔ NO SHORTCUTS ALLOWED

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  YOU CANNOT:                                                                 ║
║  - Skip testing because "code looks correct"                                 ║
║  - Assume forms work without filling them                                    ║
║  - Assume buttons work without clicking them                                 ║
║  - Assume navigation works without clicking links                            ║
║  - Generate a passing report without actual MCP tool calls                   ║
║                                                                              ║
║  EVERY TEST MUST HAVE:                                                       ║
║  - An MCP tool call that performed the action                                ║
║  - A screenshot or result that proves the action occurred                    ║
║  - A network request log if API was called                                   ║
║                                                                              ║
║  "I analyzed the code and it should work" = FAILURE                          ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

## Step 6: Bug Fix Reference Guide

```
+================================================================+
|  COMMON UI BUG PATTERNS AND FIXES                                |
+================================================================+

PATTERN 1: TypeError - Cannot read property of undefined
  SYMPTOM: Page crashes, white screen
  CAUSE: Accessing property before data loads
  FIX: Add optional chaining (data?.property) or null check
  EXAMPLE:
    - Before: user.name
    - After: user?.name || 'Loading...'

PATTERN 2: Infinite API Loop (useCallback missing)
  SYMPTOM: Network shows same endpoint called repeatedly
  CAUSE: Effect dependency causes re-render loop
  FIX: Wrap function in useCallback with proper dependencies
  EXAMPLE:
    - Before: const fetchData = () => {...}
    - After: const fetchData = useCallback(() => {...}, [deps])

PATTERN 3: Hydration Failure (redirect to login after login)
  SYMPTOM: Login succeeds but immediately redirects back to /login
  CAUSE: Auth context not updating before route guard checks
  FIX: Add loading state to auth context, wait before redirect check
  EXAMPLE:
    - Add: if (authLoading) return <Loading />
    - Before: if (!isAuthenticated) navigate('/login')

PATTERN 4: CORS Error
  SYMPTOM: Console shows CORS blocked
  CAUSE: Backend not configured for frontend origin
  FIX: Add frontend URL to CORS allowed origins in backend
  FILE: backend/app/main.py or backend/app/core/config.py

PATTERN 5: Empty Data Display Error
  SYMPTOM: Error when no data exists (new user scenario)
  CAUSE: Component assumes data array exists
  FIX: Add empty state handling
  EXAMPLE:
    - Before: data.map(...)
    - After: data?.length ? data.map(...) : <EmptyState />

PATTERN 6: Form Submission Error (422)
  SYMPTOM: Form submit returns 422 validation error
  CAUSE: Missing required field or wrong format
  FIX: Check form data matches API schema, add validation

PATTERN 7: Page Not Found (404)
  SYMPTOM: Page loads but shows 404 content
  CAUSE: Route not defined or API endpoint missing
  FIX: Check router config and backend routes

PATTERN 8: Tailwind CSS Not Applied (v1.2)
  SYMPTOM: All tests pass but UI looks like raw HTML (no styling)
  DETECTION:
    - Button backgroundColor is 'transparent'
    - No flex/grid layout elements found
    - No Tailwind color classes applied
  ROOT CAUSE:
    - tailwind.config.js AND .ts both exist (conflict)
    - tailwind.config content: [] is empty
    - postcss.config.js missing
  FIX:
    1. Remove duplicate: rm frontend/tailwind.config.js
    2. Verify content paths in tailwind.config.ts
    3. Rebuild: npm run build
    4. Restart: npm start
  REFERENCE: react-spa-common-issues.md Section 5.3 (Tailwind CSS 4-layer diagnosis)

PATTERN 9: API Response Format Mismatch (v2.3 - CRITICAL)
  SYMPTOM: TypeError: X.map is not a function
  DETECTION:
    - Console shows "TypeError: n.map is not a function"
    - Page loads but data doesn't display
    - API returns 200 OK but frontend crashes
  ROOT CAUSE:
    - Backend returns: {items: [...], total: 10}
    - Frontend expects: [...]
    - Direct .map() call on object fails
  FIX OPTIONS:
    Option A - Fix Frontend API Client:
      - Before: return request<Item[]>('/items');
      - After:  return request<{items: Item[], total: number}>('/items')
                       .then(res => res.items);

    Option B - Fix Backend Response:
      - Before: return ItemListResponse(items=items, total=len(items))
      - After:  return items  # Direct array if frontend expects it

    Option C - Add Safe Array Check in Component:
      - Before: items.map(...)
      - After:  (Array.isArray(items) ? items : items?.items || []).map(...)
  DETECTION METHOD:
    - Console check: pattern="is not a function|map is not"
    - Network check: Verify response body structure matches expected type

PATTERN 10: Async Data Race Condition (v2.3)
  SYMPTOM: Data sometimes shows, sometimes doesn't, or wrong data
  DETECTION:
    - Console shows intermittent errors
    - Data display is inconsistent on page refresh
  ROOT CAUSE:
    - Multiple async operations completing in wrong order
    - State updates after component unmount
  FIX:
    - Add loading states
    - Use AbortController for cleanup
    - Check mounted status before state update

+================================================================+
```

---

## Step 7: Quality Gate Evaluation

### Target: 100% Pass Rate (v3.0 — 6-GATE Enforced)

```
QUALITY GATE CRITERIA (v3.0 - 6-GATE ENFORCED):

Target: 100% pass rate (ALL tests AND ALL 6 GATES must pass)

+----------------------------------------------------------------+
| Pass Rate | Quality Gate | Action Required                      |
+----------------------------------------------------------------+
| 100%      | PASSED       | Proceed to Phase 6                  |
| 95-99%    | BLOCKED      | MUST fix ALL remaining issues (v3.0) |
| <95%      | FAILED       | STOP - Fix all bugs before deploy   |
+----------------------------------------------------------------+

⛔ v3.0 CHANGE: 95-99% is now BLOCKED (was WARN in v2.0)
   REASON: "WARN → proceed" allowed 5% of pages to pass without
   verification, enabling test result forgery.
   NOW: 95-99% = BLOCKED = MUST FIX before proceeding.

GATE ENFORCEMENT:
+----------------------------------------------------------------+
| Gate    | Requirement          | If Failed                       |
+----------------------------------------------------------------+
| GATE 1  | CSS computed STYLED  | BLOCKED until CSS fixed          |
| GATE 2  | Content RENDERED     | BLOCKED until rendering fixed    |
| GATE 3  | No infinite loops    | HARD BLOCK until loop fixed      |
| GATE 4  | Screenshot captured  | BLOCKED until evidence provided  |
| GATE 5  | Evidence chain valid | Report REJECTED if missing       |
| GATE 6  | No contradictions    | Entire run INVALIDATED           |
+----------------------------------------------------------------+

MANDATORY COVERAGE REQUIREMENTS:
+----------------------------------------------------------------+
| Test Type       | Required Coverage | Failure Action             |
+----------------------------------------------------------------+
| Forms           | 100% of forms     | Fix form, re-test          |
| Navigation      | 100% of links     | Fix route, re-test         |
| Buttons         | 100% of buttons   | Fix handler, re-test       |
| CRUD Operations | All CRUD on page  | Fix operation, re-test     |
| 6-GATE per page | ALL 4 gates       | Fix and re-run all gates   |
+----------------------------------------------------------------+

IMMEDIATE BUG FIX RULE:
- ANY failure → STOP → FIX → RE-TEST → PASS → Continue
- ANY GATE failure → STOP → FIX → RE-RUN ALL GATES → Continue
- NO SKIPPING ALLOWED
- NO "KNOWN ISSUES" ALLOWED
- NO PROCEEDING WITH FAILURES
- NO "WARN → proceed" (eliminated in v3.0)
```

---

## Step 7.5: GATE 6 - Cross-Validation (BEFORE Report Generation) [v3.0]

```
+========================================================================================+
|  GATE 6: CROSS-VALIDATION — DETECTS CONTRADICTIONS IN EVIDENCE                          |
|                                                                                         |
|  This gate runs AFTER all page tests are complete, BEFORE report generation.             |
|  It validates the ENTIRE evidence chain for internal consistency.                        |
|  ANY contradiction = ENTIRE TEST RUN INVALIDATED.                                       |
|                                                                                         |
|  WHY: Even with GATEs 1-5, an agent could theoretically:                               |
|     - Report css_ok=true while raw data shows all buttons transparent                   |
|     - Report screenshots_taken=12 but no imageIds in evidence                           |
|     - Report pass_rate=100% but evidence chain shows GATE failures                      |
|  GATE 6 catches these contradictions.                                                   |
+========================================================================================+
```

```
TASK: GATE 6 - Cross-Validation

Run this validation on the COMPLETE evidence chain before generating any report.

VALIDATION RULES (ALL must pass):

1. CSS CONSISTENCY CHECK:
   FOR EACH page in evidence_chain:
     IF page.gate1_css.verdict == "STYLED":
       ASSERT page.gate1_css.raw_computed_styles.buttons_with_computed_bg > 0
              OR page.gate1_css.raw_computed_styles.buttons_total == 0
       ASSERT page.gate1_css.raw_computed_styles.flex_computed_count > 0
              OR page.gate1_css.raw_computed_styles.grid_computed_count > 0
       ASSERT page.gate1_css.raw_computed_styles.is_default_serif == false
     IF ASSERTION FAILS → CONTRADICTION: raw data contradicts verdict

2. CONTENT CONSISTENCY CHECK:
   FOR EACH page in evidence_chain:
     IF page.gate2_content.verdict == "RENDERED":
       ASSERT page.gate2_content.raw_dom_depth >= 3
       ASSERT page.gate2_content.raw_visible_text_length >= 50
       ASSERT page.gate2_content.raw_loading_elements == 0
     IF ASSERTION FAILS → CONTRADICTION: raw data contradicts verdict

3. LOOP CONSISTENCY CHECK:
   FOR EACH page in evidence_chain:
     IF page.gate3_loop.verdict == "NO_LOOP":
       ASSERT page.gate3_loop.max_single_endpoint_calls < 50
     IF page.gate3_loop.verdict == "INFINITE_LOOP_DETECTED":
       ASSERT page.overall_verdict != "PASS"
     IF ASSERTION FAILS → CONTRADICTION: loop detected but page passed

4. SCREENSHOT CONSISTENCY CHECK:
   count_screenshots_claimed = mandatory_test_summary.screenshots_taken
   count_imageIds_in_evidence = count of non-null screenshot_imageId in evidence_chain
   ASSERT count_screenshots_claimed == count_imageIds_in_evidence
   IF ASSERTION FAILS → FORGERY: screenshot count doesn't match evidence

5. OVERALL VERDICT CONSISTENCY CHECK:
   FOR EACH page in evidence_chain:
     IF page.overall_verdict == "PASS":
       ASSERT page.all_gates_passed == true
       ASSERT page.gate1_css.verdict == "STYLED"
       ASSERT page.gate2_content.verdict == "RENDERED"
       ASSERT page.gate3_loop.verdict == "NO_LOOP"
       ASSERT page.gate4_screenshot.verdict == "CAPTURED"
     IF ASSERTION FAILS → CONTRADICTION: page passed without all gates passing

6. PAGE URL CONSISTENCY CHECK (prevents cross-page evidence reuse):
   FOR EACH page in evidence_chain:
     IF page.gate1_css.raw_computed_styles.current_url exists:
       ASSERT page.gate1_css.raw_computed_styles.current_url contains page.page_url
     IF page.gate3_loop.raw_request_counts.current_url exists:
       ASSERT page.gate3_loop.raw_request_counts.current_url contains page.page_url
     IF page.gate2_content.raw.current_url exists:
       ASSERT page.gate2_content.raw.current_url contains page.page_url
   IF ASSERTION FAILS → FORGERY: gate evidence collected on wrong page

7. PASS RATE CONSISTENCY CHECK:
   calculated_pass_rate = count(overall_verdict=="PASS") / total_pages * 100
   reported_pass_rate = summary.pass_rate
   ASSERT abs(calculated_pass_rate - reported_pass_rate) < 0.1
   IF ASSERTION FAILS → FORGERY: reported pass rate doesn't match evidence

GATE 6 RESULT:
   IF ALL assertions pass:
     gate6_validation: {
       verdict: "CONSISTENT",
       checks_passed: 7,
       checks_failed: 0,
       contradictions: []
     }
   IF ANY assertion fails:
     gate6_validation: {
       verdict: "CONTRADICTIONS_DETECTED",
       checks_passed: N,
       checks_failed: M,
       contradictions: [
         { rule: "CSS_CONSISTENCY", page: "/dashboard",
           expected: "buttons_with_bg > 0", actual: "buttons_with_bg = 0",
           implication: "css_ok reported true but no buttons have background" }
       ]
     }
     => ⛔ ENTIRE TEST RUN INVALIDATED
     => MUST re-run all tests from scratch
     => DO NOT submit report with contradictions
```

---

## Step 8: Generate Final Report

### Step 8.0: Generate JSON Results (MANDATORY - GATE 5 Evidence-Bound) [v3.0]

**⚠️ CRITICAL: You MUST create this JSON file BEFORE the Markdown report.**
**⚠️ This step is MANDATORY on EVERY iteration — not just the first run!**
**⚠️ v3.0: Report MUST include evidence_chain (GATE 5) and gate6_validation (GATE 6)**
**Without this file, the iteration loop cannot read pass_rate and will always show 0%.**

```bash
# Calculate values from your test results
PASS_COUNT=<number of pages that passed ALL P0 criteria AND ALL 4 GATES>
FAIL_COUNT=<number of pages that failed any P0 criteria OR any GATE>
TOTAL_TESTED=$((PASS_COUNT + FAIL_COUNT))
PASS_RATE=$(python3 -c "print(round(100 * $PASS_COUNT / max($TOTAL_TESTED, 1), 1))")
BUGS_FIXED=<number of bugs fixed during this iteration>

mkdir -p test-logs
cat > test-logs/phase5c_test_results.json << EOF
{
  "phase": "5c",
  "mode": "efficient",
  "version": "3.0-6gate",
  "total_tested": $TOTAL_TESTED,
  "passed": $PASS_COUNT,
  "failed": $FAIL_COUNT,
  "pass_rate": $PASS_RATE,
  "adjusted_pass_rate": $PASS_RATE,
  "bugs_fixed": $BUGS_FIXED,
  "timestamp": "$(date -Iseconds)",
  "summary": {
    "total": $TOTAL_TESTED,
    "passed": $PASS_COUNT,
    "failed": $FAIL_COUNT,
    "pass_rate": $PASS_RATE
  },
  "gate_summary": {
    "gate1_css_passed": <count>,
    "gate1_css_failed": <count>,
    "gate2_content_passed": <count>,
    "gate2_content_failed": <count>,
    "gate3_loop_passed": <count>,
    "gate3_loop_blocked": <count>,
    "gate4_screenshot_captured": <count>,
    "gate4_screenshot_failed": <count>,
    "gate6_validation": "CONSISTENT or CONTRADICTIONS_DETECTED"
  },
  "evidence_chain": [
    {
      "page_url": "/page-path",
      "gate1_css": {
        "raw_computed_styles": {},
        "verdict": "STYLED",
        "verdict_derivation": "..."
      },
      "gate2_content": {
        "raw_dom_depth": 0,
        "raw_visible_text_length": 0,
        "raw_loading_elements": 0,
        "verdict": "RENDERED",
        "verdict_derivation": "..."
      },
      "gate3_loop": {
        "raw_request_counts": {},
        "max_single_endpoint_calls": 0,
        "verdict": "NO_LOOP",
        "verdict_derivation": "..."
      },
      "gate4_screenshot": {
        "screenshot_taken": true,
        "screenshot_imageId": "...",
        "verdict": "CAPTURED"
      },
      "overall_verdict": "PASS",
      "all_gates_passed": true
    }
  ],
  "gate6_cross_validation": {
    "verdict": "CONSISTENT",
    "checks_passed": 6,
    "checks_failed": 0,
    "contradictions": []
  }
}
EOF
echo "[PHASE5C] JSON results saved to test-logs/phase5c_test_results.json"
cat test-logs/phase5c_test_results.json
```

### Step 8.1: Generate Markdown Report (v3.0 - 6-GATE)

```
TASK: Generate Final Report with 6-GATE Evidence

Create: test-logs/PHASE5C_EFFICIENT_REPORT.md

## Phase 5C UI Test Report (Efficient Mode - v3.0 6-GATE)

### Summary

| Metric | Value |
|--------|-------|
| **Mode** | Efficient (Claude In Chrome) |
| **Version** | 3.0 (6-GATE Verification) |
| **Total Pages** | {total} |
| **Passed** | {pass_count} |
| **Failed** | {fail_count} |
| **Bugs Fixed** | {fix_count} |
| **Pass Rate** | {pass_rate}% |
| **Quality Gate** | {PASSED/BLOCKED/FAILED} |
| **GATE 6 Validation** | {CONSISTENT/CONTRADICTIONS_DETECTED} |

### 6-GATE Results Per Page

| Page | GATE 1 (CSS) | GATE 2 (Content) | GATE 3 (Loop) | GATE 4 (Screenshot) | P0 Criteria | Overall |
|------|-------------|-----------------|--------------|-------------------|------------|---------|
| /login | STYLED/BROKEN | RENDERED/NOT | NO_LOOP/BLOCKED | CAPTURED/FAILED | ALL_OK/FAIL | PASS/FAIL |
| /dashboard | ... | ... | ... | ... | ... | ... |

### GATE 1 Evidence (CSS Computed Styles)

| Page | Buttons w/ BG | Flex Computed | Grid Computed | Font | Verdict |
|------|--------------|--------------|--------------|------|---------|
| /login | {N}/{total} | {N} | {N} | {font} | STYLED/BROKEN |

### GATE 3 Evidence (Request Frequency)

| Page | Total Requests | Max Endpoint | Max Calls | Verdict |
|------|---------------|-------------|-----------|---------|
| /dashboard | {N} | {endpoint} | {N} | NO_LOOP/BLOCKED |

### GATE 6 Cross-Validation Results

| Check | Result | Details |
|-------|--------|---------|
| CSS Consistency | PASS/FAIL | {details} |
| Content Consistency | PASS/FAIL | {details} |
| Loop Consistency | PASS/FAIL | {details} |
| Screenshot Consistency | PASS/FAIL | {details} |
| Verdict Consistency | PASS/FAIL | {details} |
| Pass Rate Consistency | PASS/FAIL | {details} |

### Bugs Fixed During Testing

| # | Page | Gate/Criterion | Original Error | Fix Applied |
|---|------|---------------|----------------|-------------|
| 1 | {page} | {gate_or_criterion} | {error} | {fix_description} |

### Remaining Issues (if any)

| # | Page | Gate/Criterion | Error | Notes |
|---|------|---------------|-------|-------|
| ... | ... | ... | ... | ... |

### Screenshots (GATE 4 Evidence)

All test screenshots saved in: test-logs/screenshots/
Each screenshot has a corresponding imageId in the evidence_chain.
- login_page.png (imageId: {id})
- login_success.png (imageId: {id})
- dashboard.png (imageId: {id})
```

---

## Step 9: Commit Test Results

```bash
# Navigate to workspace root
cd "${WORKSPACE_DIR:-/workspace}"

echo "[GIT] Adding Phase 5C Efficient Mode test results..."

# Add all Phase 5C test artifacts
for FILE in \
    "test-logs/PHASE5C_EFFICIENT_REPORT.md" \
    "test-logs/phase5c_test_results.json" \
    "test-logs/phase5c_page_inventory.json" \
    "test-logs/phase5c_bugs_fixed.json"; do
    if [ -f "$FILE" ]; then
        git add "$FILE" 2>/dev/null || true
        echo "[GIT] Added: $FILE"
    fi
done

# Add screenshots
if [ -d "test-logs/screenshots" ]; then
    git add test-logs/screenshots/*.png 2>/dev/null || true
    echo "[GIT] Added screenshots"
fi

# Commit if changes exist
if ! git diff --cached --quiet; then
    git commit -m "Phase 5C (Efficient Mode): UI test results

- Real-time bug fixing completed
- Test mode: Claude In Chrome
- Pages tested: ${TOTAL_PAGES}
- Pass rate: ${PASS_RATE}%"

    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    git push origin "$CURRENT_BRANCH"
    echo "[GIT] Phase 5C results committed successfully"
fi
```

---

## Reference Documents

- **Bug Fix Guide**: `.claude/prompts/ui-frontend-common-issues.md`
- **API Test Results**: `test-logs/phase5b_test_user.json`
- **Test Configuration**: `.claude/config/phase5-global-config.json`
- **Standard Mode Prompt**: `.claude/prompts/phase5c-ui-tests.md`

---

## Notes

- **Context Sharing**: Full context is preserved - no need to re-read files
- **Immediate Fixing**: Fix bugs as soon as they're detected
- **100% Target**: Aim for complete success, not partial (50%)
- **Cost**: This mode costs 2x standard mode points
- **Efficiency**: Typically faster despite higher target due to no batch loops
- **Screenshots**: Take screenshots at each page for evidence and debugging
- **Credentials**: Reuse credentials from Phase 5B for consistency
