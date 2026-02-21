#!/bin/bash
# ================================================================
# Phase 5C Efficient Mode - Iteration Loop Controller
# ================================================================
# This script controls the iteration loop for Phase 5C UI testing
# Uses Claude CLI with Claude In Chrome MCP for browser automation
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_REF_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$SKILL_REF_DIR/config/phase5-loop-control.json"
PROMPT_FILE="$SKILL_REF_DIR/prompts/phase5c-ui-tests-efficient.md"
# PROJECT_ROOT is the user's workspace (argument or pwd)
PROJECT_ROOT="${WORKSPACE_DIR:-$(pwd)}"
LOG_DIR="$PROJECT_ROOT/test-logs"

# Create log directory
mkdir -p "$LOG_DIR"
mkdir -p "$LOG_DIR/screenshots"

# Real-time log helper: outputs to both console and realtime log file
log_msg() {
    echo "$1"
    [ -n "$REALTIME_LOG" ] && echo "[$(date +%H:%M:%S)] $1" >> "$REALTIME_LOG"
}

# ================================================================
# Load Configuration
# ================================================================
load_config() {
    # Default values
    MAX_ITERATIONS=15
    TARGET_PASS_RATE=100  # Phase 5C requires 100%
    EARLY_EXIT_THRESHOLD=3
    ITERATION_TIMEOUT=1800

    # Load from config file if exists
    if [ -f "$CONFIG_FILE" ]; then
        MAX_ITERATIONS=$(python3 -c "
import json
with open('$CONFIG_FILE') as f:
    cfg = json.load(f)
print(cfg.get('phase5c_bugfix', {}).get('max_iterations', cfg.get('iteration_control', {}).get('max_iterations', 15)))
" 2>/dev/null || echo "15")
    fi

    # Environment variable overrides
    MAX_ITERATIONS="${BUGFIX_MAX_ITERATIONS:-$MAX_ITERATIONS}"
    TARGET_PASS_RATE="${BUGFIX_TARGET_PASS_RATE:-100}"
    EARLY_EXIT_THRESHOLD="${BUGFIX_EARLY_EXIT_THRESHOLD:-$EARLY_EXIT_THRESHOLD}"

    log_msg "════════════════════════════════════════════════════════════"
    log_msg "Phase 5C Efficient Mode - Configuration"
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
    RESULT_FILE="$LOG_DIR/phase5c_test_results.json"
    
    if [ -f "$RESULT_FILE" ]; then
        python3 -c "
import json
try:
    with open('$RESULT_FILE') as f:
        data = json.load(f)
    rate = data.get('summary', {}).get('pass_rate', data.get('pass_rate', 0))
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
    ITERATION_PROMPT="你正在执行 Phase 5C UI 测试的第 ${iteration} 次迭代。

请阅读并执行以下测试提示词文件中的所有步骤：
${prompt_file_abs}

关键要求：
1. 使用 Claude In Chrome MCP 工具进行浏览器自动化
2. 对每个页面执行 4 CORE TESTS (Form/Link/Button/CSS)
3. 对每个页面执行 6-GATE 验证
4. 发现 bug 后立即修复
5. 生成 JSON 结果文件: test-logs/phase5c_test_results.json
6. 目标通过率: ${TARGET_PASS_RATE}% (所有页面必须通过)

测试前准备：
- 确保前端服务已启动
- 使用 Phase 5B 创建的测试账号登录
- 检查 Chrome 浏览器已安装 Claude In Chrome 插件

完成后请报告测试结果和 GATE 验证状态。"

    # Run Claude CLI with the prompt
    cd "$PROJECT_ROOT"
    
    if [ -n "$REALTIME_LOG" ]; then
        timeout $ITERATION_TIMEOUT claude --dangerously-skip-permissions -p "$ITERATION_PROMPT" 2>&1 | tee "$LOG_DIR/phase5c_iteration_${iteration}.log" | tee -a "$REALTIME_LOG"
    else
        timeout $ITERATION_TIMEOUT claude --dangerously-skip-permissions -p "$ITERATION_PROMPT" 2>&1 | tee "$LOG_DIR/phase5c_iteration_${iteration}.log"
    fi

    local exit_code=$?
    if [ $exit_code -eq 124 ]; then
        log_msg "[WARN] Iteration $iteration timed out after ${ITERATION_TIMEOUT}s"
    fi
    
    return $exit_code
}

# ================================================================
# Validate 6-GATE Results
# ================================================================
validate_gates() {
    RESULT_FILE="$LOG_DIR/phase5c_test_results.json"
    
    if [ ! -f "$RESULT_FILE" ]; then
        log_msg "[ERROR] Result file not found"
        return 1
    fi
    
    python3 -c "
import json
import sys

with open('$RESULT_FILE') as f:
    data = json.load(f)

# Check GATE 6 validation
gate6 = data.get('gate6_cross_validation', {})
if gate6.get('verdict') == 'CONTRADICTIONS_DETECTED':
    print('[FATAL] GATE 6 detected contradictions - test run invalid')
    sys.exit(1)

# Check all gates passed
gate_summary = data.get('gate_summary', {})
total = data.get('summary', {}).get('total', 0)

gate1_failed = gate_summary.get('gate1_css_failed', 0)
gate2_failed = gate_summary.get('gate2_content_failed', 0)
gate3_blocked = gate_summary.get('gate3_loop_blocked', 0)
gate4_failed = gate_summary.get('gate4_screenshot_failed', 0)

if gate1_failed > 0:
    print(f'[WARN] GATE 1 (CSS) failed on {gate1_failed} pages')
if gate2_failed > 0:
    print(f'[WARN] GATE 2 (Content) failed on {gate2_failed} pages')
if gate3_blocked > 0:
    print(f'[BLOCKED] GATE 3 (Loop) blocked {gate3_blocked} pages')
if gate4_failed > 0:
    print(f'[WARN] GATE 4 (Screenshot) failed on {gate4_failed} pages')

print(f'[OK] GATE validation complete')
" 2>/dev/null
}

# ================================================================
# Main Loop
# ================================================================
main() {
    log_msg "╔════════════════════════════════════════════════════════════╗"
    log_msg "║  Phase 5C Efficient Mode - Iteration Loop Controller       ║"
    log_msg "╚════════════════════════════════════════════════════════════╝"

    load_config

    iteration=1
    no_improvement_count=0
    previous_pass_rate=0

    while [ $iteration -le $MAX_ITERATIONS ]; do
        # Run iteration
        run_iteration $iteration || true

        # Validate GATE results
        validate_gates || log_msg "[WARN] GATE validation had issues"

        # Get pass rate from results
        current_pass_rate=$(get_pass_rate)
        log_msg ""
        log_msg "[RESULT] Pass Rate: $current_pass_rate%"

        # Check if target achieved (100% for Phase 5C)
        if [ $(python3 -c "print(1 if $current_pass_rate >= $TARGET_PASS_RATE else 0)" 2>/dev/null || echo "0") -eq 1 ]; then
            log_msg ""
            log_msg "╔════════════════════════════════════════════════════════════╗"
            log_msg "║  ✅ SUCCESS: All pages passed!                              ║"
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
                log_msg "║  Remaining pages need fixes                                ║"
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
    log_msg "║  Some pages still have issues                              ║"
    log_msg "╚════════════════════════════════════════════════════════════╝"
    exit 1
}

main "$@"
