# Phase 5B/5C 执行流程说明

## 概述

Phase 5B (API 测试) 和 Phase 5C (UI 测试) 使用 **Efficient Mode** 迭代循环进行测试和 bug 修复。

## 关键组件

### 1. Prompt 文件
- `references/prompts/phase5b-api-tests-efficient.md` - API 测试 prompt (v2.1)
- `references/prompts/phase5c-ui-tests-efficient.md` - UI 测试 prompt (v3.1)

### 2. 循环控制脚本
- `references/scripts/phase5b-efficient-loop.sh` - API 测试循环控制器
- `references/scripts/phase5c-efficient-loop.sh` - UI 测试循环控制器

### 3. 配置文件
- `references/config/phase5-loop-control.json` - 循环参数配置

## 执行流程

```
┌─────────────────────────────────────────────────────────────┐
│                    迭代循环控制器                            │
│  (phase5b-efficient-loop.sh / phase5c-efficient-loop.sh)    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  初始化: iteration=1, no_improvement_count=0               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │                                     │
        │   ┌─────────────────────────────┐   │
        │   │ 1. 调用 Claude CLI          │   │
        │   │    claude --dangerously-skip │   │
        │   │    -p "prompt"              │   │
        │   └─────────────────────────────┘   │
        │                 │                   │
        │                 ▼                   │
        │   ┌─────────────────────────────┐   │
        │   │ 2. Claude 使用 MCP 工具     │   │
        │   │    - Claude In Chrome       │   │
        │   │    - 测试 API/UI            │   │
        │   │    - 发现 bug 立即修复      │   │
        │   └─────────────────────────────┘   │
        │                 │                   │
        │                 ▼                   │
        │   ┌─────────────────────────────┐   │
        │   │ 3. 生成 JSON 结果文件       │   │
        │   │    test-logs/phase5x_*.json │   │
        │   └─────────────────────────────┘   │
        │                 │                   │
        │                 ▼                   │
        │   ┌─────────────────────────────┐   │
        │   │ 4. 检查 pass_rate           │   │
        │   │    - >= target? → SUCCESS   │   │
        │   │    - 无改进? → 检查 early   │   │
        │   └─────────────────────────────┘   │
        │                 │                   │
        └─────────────────┼───────────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │ 判断: 继续循环 or 退出?              │
        │                                     │
        │ pass_rate >= target → SUCCESS 退出  │
        │ no_improvement >= 3 → EARLY_EXIT    │
        │ iteration >= 15 → MAX_REACHED       │
        │ 否则 → iteration++ → 继续循环       │
        └─────────────────────────────────────┘
```

## 执行方式

### 方式 1: 直接调用 (单次迭代)

```bash
# WORKSPACE_DIR を設定してから実行
# Phase 5B
WORKSPACE_DIR=/path/to/project claude --dangerously-skip-permissions -p "请阅读并执行 references/prompts/phase5b-api-tests-efficient.md 中的所有测试步骤"

# Phase 5C
WORKSPACE_DIR=/path/to/project claude --dangerously-skip-permissions -p "请阅读并执行 references/prompts/phase5c-ui-tests-efficient.md 中的所有测试步骤"
```

### 方式 2: 循环脚本 (推荐)

```bash
# WORKSPACE_DIR を設定して循環スクリプトを実行
WORKSPACE_DIR=/path/to/project bash references/scripts/phase5b-efficient-loop.sh

WORKSPACE_DIR=/path/to/project bash references/scripts/phase5c-efficient-loop.sh
```

## 循环参数

| 参数 | 默认值 | 环境变量 | 说明 |
|------|--------|----------|------|
| MAX_ITERATIONS | 15 | BUGFIX_MAX_ITERATIONS | 最大迭代次数 |
| TARGET_PASS_RATE (5B) | 95% | BUGFIX_TARGET_PASS_RATE | 目标通过率 |
| TARGET_PASS_RATE (5C) | 100% | BUGFIX_TARGET_PASS_RATE | 目标通过率 |
| EARLY_EXIT_THRESHOLD | 3 | BUGFIX_EARLY_EXIT_THRESHOLD | 无改进退出阈值 |
| ITERATION_TIMEOUT | 1800s | BUGFIX_ITERATION_TIMEOUT | 单次迭代超时 |

## 退出条件

1. **SUCCESS**: pass_rate >= target_pass_rate
2. **EARLY_EXIT**: 连续 3 次迭代 pass_rate 无改进
3. **MAX_ITERATIONS**: 达到 15 次迭代上限

## 前置条件

### Phase 5B
- [x] Backend 服务运行中
- [x] Chrome 浏览器安装了 Claude In Chrome 插件
- [x] Claude CLI 可用

### Phase 5C
- [x] Phase 5B 已完成 (有测试用户)
- [x] Frontend 服务运行中
- [x] Backend 服务运行中
- [x] Chrome 浏览器安装了 Claude In Chrome 插件
- [x] Claude CLI 可用

## 结果文件

### Phase 5B
- `test-logs/phase5b_efficient_test_results.json` - JSON 结果
- `test-logs/PHASE5B_EFFICIENT_REPORT.md` - Markdown 报告
- `test-logs/phase5b_test_user.json` - 测试用户凭证

### Phase 5C
- `test-logs/phase5c_test_results.json` - JSON 结果 (含 evidence_chain)
- `test-logs/PHASE5C_EFFICIENT_REPORT.md` - Markdown 报告
- `test-logs/screenshots/` - 截图证据
