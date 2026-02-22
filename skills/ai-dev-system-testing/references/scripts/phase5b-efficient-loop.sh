#!/bin/bash
# ================================================================
# Phase 5B Efficient Mode - Iteration Loop Controller
# ================================================================
# This script controls the iteration loop for Phase 5B API testing
# Uses Claude CLI with Claude In Chrome MCP for browser automation
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_REF_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$SKILL_REF_DIR/config/phase5-loop-control.json"
PROMPT_FILE="$SKILL_REF_DIR/prompts/phase5b-api-tests-efficient.md"
# PROJECT_ROOT is the user's workspace (argument or pwd)
PROJECT_ROOT="${WORKSPACE_DIR:-$(pwd)}"
LOG_DIR="$PROJECT_ROOT/test-logs"

# Create log directory
mkdir -p "$LOG_DIR"

# Real-time log helper: outputs to both console and realtime log file
log_msg() {
    echo "$1"
    [ -n "$REALTIME_LOG" ] && echo "[$(date +%H:%M:%S)] $1" >> "$REALTIME_LOG"
}

# ================================================================
# Check Claude In Chrome MCP Connectivity
# ================================================================
check_chrome_mcp() {
    log_msg "[CHECK] Verifying Claude In Chrome MCP..."
    local out
    out=$(timeout 60 claude --dangerously-skip-permissions \
        -p 'Call mcp__Claude_in_Chrome__tabs_context_mcp with createIfEmpty=true. If succeeds output EXACTLY: CHROME_MCP_OK  If fails output EXACTLY: CHROME_MCP_FAIL' 2>&1)
    if echo "$out" | grep -q "CHROME_MCP_OK"; then
        log_msg "[OK] Claude In Chrome MCP connected"
        return 0
    fi
    log_msg "[ERROR] Claude In Chrome MCP NOT available!"
    log_msg "[ERROR] Please: 1) Open Chrome  2) Enable Claude In Chrome extension  3) Verify MCP Connected"
    return 1
}

# ================================================================
# Load Configuration
# ================================================================
load_config() {
    # Default values
    MAX_ITERATIONS=15
    TARGET_PASS_RATE=95
    EARLY_EXIT_THRESHOLD=3
    ITERATION_TIMEOUT=1800

    # Load from config file if exists
    if [ -f "$CONFIG_FILE" ]; then
        MAX_ITERATIONS=$(python3 -c "
import json
with open('$CONFIG_FILE') as f:
    cfg = json.load(f)
print(cfg.get('phase5b_bugfix', {}).get('max_iterations', cfg.get('iteration_control', {}).get('max_iterations', 15)))
" 2>/dev/null || echo "15")
        
        TARGET_PASS_RATE=$(python3 -c "
import json
with open('$CONFIG_FILE') as f:
    cfg = json.load(f)
print(cfg.get('global', {}).get('target_pass_rate_5b', cfg.get('global', {}).get('target_pass_rate', 95)))
" 2>/dev/null || echo "95")
    fi

    # Environment variable overrides
    MAX_ITERATIONS="${BUGFIX_MAX_ITERATIONS:-$MAX_ITERATIONS}"
    TARGET_PASS_RATE="${BUGFIX_TARGET_PASS_RATE:-$TARGET_PASS_RATE}"
    EARLY_EXIT_THRESHOLD="${BUGFIX_EARLY_EXIT_THRESHOLD:-$EARLY_EXIT_THRESHOLD}"

    log_msg "════════════════════════════════════════════════════════════"
    log_msg "Phase 5B Efficient Mode - Configuration"
    log_msg "════════════════════════════════════════════════════════════"
    log_msg "Max Iterations: $MAX_ITERATIONS"
    log_msg "Target Pass Rate: $TARGET_PASS_RATE%"
    log_msg "Early Exit Threshold: $EARLY_EXIT_THRESHOLD"
    log_msg "Iteration Timeout: ${ITERATION_TIMEOUT}s"
    log_msg "════════════════════════════════════════════════════════════"
}

# ================================================================
# Get Pass Rate from Results
# ================================================================
get_pass_rate() {
    RESULT_FILE="$LOG_DIR/phase5b_efficient_test_results.json"
    
    if [ -f "$RESULT_FILE" ]; then
        # Try adjusted_pass_rate first, then pass_rate
        python3 -c "
import json
try:
    with open('$RESULT_FILE') as f:
        data = json.load(f)
    # Priority: adjusted_pass_rate > pass_rate
    rate = data.get('adjusted_pass_rate', data.get('pass_rate', 0))
    print(rate)
except:
    print(0)
" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# ================================================================
# Run Single Iteration
# ================================================================
run_iteration() {
    local iteration=$1
    log_msg ""
    log_msg "════════════════════════════════════════════════════════════"
    log_msg "ITERATION $iteration/$MAX_ITERATIONS"
    log_msg "════════════════════════════════════════════════════════════"
    
    # Build prompt with iteration context
    local prompt_file_abs="$PROMPT_FILE"
    ITERATION_PROMPT="你正在执行 Phase 5B API 测试的第 ${iteration} 次迭代。

请阅读并执行以下测试提示词文件中的所有步骤：
${prompt_file_abs}

⛔ 必须遵守的执行方法 ⛔:
所有 API 测试必须且只能通过 Claude In Chrome MCP 工具进行浏览器自动化。
严格禁止以下替代方法：
- curl / wget / httpie 直接调用 API
- python requests / httpx / aiohttp
- Playwright / Puppeteer / Selenium
- Node.js fetch / axios
- 任何非 MCP 的 HTTP 客户端

必须使用的 MCP 工具：
- mcp__Claude_in_Chrome__tabs_context_mcp
- mcp__Claude_in_Chrome__navigate
- mcp__Claude_in_Chrome__read_page / find
- mcp__Claude_in_Chrome__computer (点击/截图)
- mcp__Claude_in_Chrome__form_input
- mcp__Claude_in_Chrome__javascript_tool
- mcp__Claude_in_Chrome__read_network_requests

第一步：调用 mcp__Claude_in_Chrome__tabs_context_mcp 验证 MCP 连接。
如果不可用 → 立即停止并报告错误，不要使用替代方案。

关键要求：
1. 使用 Claude In Chrome MCP 进行浏览器自动化（唯一允许的方法）
2. 测试所有 API 端点
3. 发现 bug 后立即修复
4. 生成结果文件: test-logs/phase5b_efficient_test_results.json
5. 目标通过率: ${TARGET_PASS_RATE}%

完成后请报告测试结果。"

    # Run Claude CLI with the prompt
    cd "$PROJECT_ROOT"
    
    if [ -n "$REALTIME_LOG" ]; then
        timeout $ITERATION_TIMEOUT claude --dangerously-skip-permissions -p "$ITERATION_PROMPT" 2>&1 | tee "$LOG_DIR/phase5b_iteration_${iteration}.log" | tee -a "$REALTIME_LOG"
    else
        timeout $ITERATION_TIMEOUT claude --dangerously-skip-permissions -p "$ITERATION_PROMPT" 2>&1 | tee "$LOG_DIR/phase5b_iteration_${iteration}.log"
    fi

    local exit_code=$?
    if [ $exit_code -eq 124 ]; then
        log_msg "[WARN] Iteration $iteration timed out after ${ITERATION_TIMEOUT}s"
    fi
    
    return $exit_code
}

# ================================================================
# Main Loop
# ================================================================
main() {
    log_msg "╔════════════════════════════════════════════════════════════╗"
    log_msg "║  Phase 5B Efficient Mode - Iteration Loop Controller       ║"
    log_msg "╚════════════════════════════════════════════════════════════╝"

    load_config

    # Pre-check: Claude In Chrome MCP must be available
    if ! check_chrome_mcp; then
        log_msg "[FATAL] Cannot proceed without Claude In Chrome MCP."
        exit 1
    fi

    iteration=1
    no_improvement_count=0
    previous_pass_rate=0

    while [ $iteration -le $MAX_ITERATIONS ]; do
        # Run iteration
        run_iteration $iteration || true

        # Get pass rate from results
        current_pass_rate=$(get_pass_rate)
        log_msg ""
        log_msg "[RESULT] Pass Rate: $current_pass_rate%"

        # Check if target achieved
        if [ $(python3 -c "print(1 if $current_pass_rate >= $TARGET_PASS_RATE else 0)" 2>/dev/null || echo "0") -eq 1 ]; then
            log_msg ""
            log_msg "╔════════════════════════════════════════════════════════════╗"
            log_msg "║  ✅ SUCCESS: Target pass rate achieved!                     ║"
            log_msg "║  Final Pass Rate: $current_pass_rate%                              ║"
            log_msg "║  Iterations Used: $iteration                                        ║"
            log_msg "╚════════════════════════════════════════════════════════════╝"
            exit 0
        fi

        # Check early exit (strict less-than: plateau is NOT treated as no-improvement)
        if [ $(python3 -c "print(1 if $current_pass_rate < $previous_pass_rate else 0)" 2>/dev/null || echo "0") -eq 1 ]; then
            no_improvement_count=$((no_improvement_count + 1))
            log_msg "[WARN] No improvement ($no_improvement_count/$EARLY_EXIT_THRESHOLD)"

            if [ $no_improvement_count -ge $EARLY_EXIT_THRESHOLD ]; then
                log_msg ""
                log_msg "╔════════════════════════════════════════════════════════════╗"
                log_msg "║  ⚠️ EARLY EXIT: No improvement for $EARLY_EXIT_THRESHOLD iterations        ║"
                log_msg "║  Final Pass Rate: $current_pass_rate%                              ║"
                log_msg "║  Iterations Used: $iteration                                        ║"
                log_msg "╚════════════════════════════════════════════════════════════╝"
                exit 1
            fi
        else
            log_msg "[OK] Improvement: $previous_pass_rate% → $current_pass_rate%"
            no_improvement_count=0
        fi

        previous_pass_rate=$current_pass_rate
        iteration=$((iteration + 1))
    done

    # Max iterations reached
    log_msg ""
    log_msg "╔════════════════════════════════════════════════════════════╗"
    log_msg "║  ❌ MAX_ITERATIONS_REACHED: $MAX_ITERATIONS iterations completed        ║"
    log_msg "║  Final Pass Rate: $current_pass_rate%                              ║"
    log_msg "╚════════════════════════════════════════════════════════════╝"
    exit 1
}

main "$@"
