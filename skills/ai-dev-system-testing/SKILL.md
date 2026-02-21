---
name: ai-dev-system-testing
description: "Test and validate an existing codebase. Analyzes code structure, performs automated code review with auto-fix, runs API endpoint tests and UI tests via Chrome browser automation, generates documentation. Phase 4 (code generation) is skipped since code already exists. Use when user asks to test existing code, run quality assurance, perform code review, or validate a system."
metadata:
  {
    "winclaw":
      { "emoji": "🧪", "os": ["win32", "darwin", "linux"], "requires": { "bins": ["claude"] } },
  }
---

# System Testing (Script-Driven)

Automates code analysis, review, testing, and documentation for an existing codebase.

## ⚠️ 重要：执行规则

**AI agent 必须严格遵守以下规则：**

1. **只能执行脚本** - 运行 `scripts/run-all.ps1`，不得自行发挥
2. **禁止替代方案** - 禁止用 `sessions_spawn`、手动命令或其他方式替代脚本
3. **禁止跳过步骤** - 除非脚本自身判断可跳过（Resume 模式）
4. **必须显示日志** - 使用 `pty:true` 或直接运行脚本显示实时输出
5. **必须交互确认** - 除非用户指定 `-NonInteractive`，必须询问配置

## 测试数据配置

Phase 5 测试需要测试账号。在运行测试前，请确保：

1. **测试账号存在** - 在目标系统中创建测试账号
2. **配置凭据** - 在 `references/prompts/phase5b-api-tests-efficient.md` 中修改：
   - `TEST_USER_EMAIL` - 测试用户邮箱
   - `TEST_USER_PASSWORD` - 测试用户密码
3. **或使用环境变量**：
   ```powershell
   $env:TEST_USER_EMAIL = "your-test@example.com"
   $env:TEST_USER_PASSWORD = "YourPassword123"
   ```

## 快速开始

```powershell
# 基本用法（交互式）- 替换为实际的 skill 路径
& "$env:USERPROFILE\.winclaw\skills\ai-dev-system-testing\scripts\run-all.ps1" -Workspace "C:\path\to\project"

# 或者使用 skill 目录变量
$skillDir = Split-Path -Parent $MyInvocation.MyCommand.Path  # 如果在 skill 目录下
& "$skillDir\scripts\run-all.ps1" -Workspace "C:\path\to\project"

# 完整参数（非交互式）
& "run-all.ps1" `
    -Workspace "C:\path\to\project" `
    -FrontendUrl "http://localhost:3000" `
    -BackendUrl "http://localhost:8000" `
    -DatabaseUrl "mysql+pymysql://user:pass@host/db" `
    -NonInteractive

# Resume 模式（跳过已完成的 Phase）
& "run-all.ps1" -Workspace "C:\path\to\project" -Resume

# 只运行特定 Phase
& "run-all.ps1" -Workspace "C:\path\to\project" -Phases "phase5b,phase5c"
```

## 参数说明

| 参数 | 必需 | 说明 |
|------|------|------|
| `-Workspace` | ✅ | 项目根目录路径 |
| `-FrontendUrl` | ❌ | 前端 URL（不提供则跳过 Phase 5C） |
| `-BackendUrl` | ❌ | 后端 URL（不提供则跳过 Phase 5B） |
| `-DatabaseUrl` | ❌ | 数据库连接字符串 |
| `-Resume` | ❌ | 启用 Smart Resume，跳过已完成的 Phase |
| `-NonInteractive` | ❌ | 非交互模式，不询问用户配置 |
| `-Phases` | ❌ | 指定运行的 Phase（逗号分隔） |

## Phase 概览

| Phase | 功能 | 输出文件 | 超时 |
|-------|------|----------|------|
| Init | 环境检查 & 配置 | `deployment-logs/workflow-state.json` | — |
| 2 | 代码结构分析 | `CODE_ANALYSIS.md`, `project-structure.json` | 30min |
| 3 | 代码审查 & 自动修复 | `CODE_REVIEW_REPORT.md` | 40min |
| 4 | **跳过**（代码已存在） | — | — |
| 5B | API 端点测试 | `test-logs/phase5b_*.json` | 30min/iter x 15 |
| 5C | UI 浏览器测试 | `test-logs/phase5c_*.json` | 30min/iter x 15 |
| 6 | 文档生成 | `docs/` | 30min |

## Smart Resume 机制

脚本会检查每个 Phase 的输出文件：

```
Phase 2: CODE_ANALYSIS.md + deployment-logs/project-structure.json 存在 → SKIP
Phase 3: CODE_REVIEW_REPORT.md 存在 → SKIP
Phase 5B: pass_rate >= 95% → SKIP
Phase 5C: pass_rate == 100% → SKIP
```

## 配置文件（可选）

在 `~/.winclaw/winclaw.json` 中预配置：

```json
{
  "skills": {
    "entries": {
      "ai-dev-system-testing": {
        "env": {
          "AIDEV_BACKEND_URL": "http://localhost:8000",
          "AIDEV_FRONTEND_URL": "http://localhost:3000",
          "DATABASE_URL": "mysql+pymysql://user:pass@host/db"
        }
      }
    }
  }
}
```

**注意**: 上面的端口号和 URL 仅为示例，请根据实际项目配置修改。

## 脚本结构

```
ai-dev-system-testing/
├── SKILL.md                          # 本文件
├── scripts/
│   └── run-all.ps1                   # 主入口脚本（强制使用）
└── references/
    ├── phase-details.md              # Phase 详细说明
    ├── config/
    │   ├── phase5-loop-control.json  # Phase 5 循环控制配置
    │   └── workflow-state-template.json # 工作流状态模板
    ├── docs/
    │   └── PHASE5_EXECUTION_GUIDE.md # Phase 5 执行指南
    ├── prompts/
    │   ├── phase5b-api-tests-efficient.md
    │   └── phase5c-ui-tests-efficient.md
    └── scripts/
        ├── phase5b-efficient-loop.sh # Phase 5B 迭代循环
        └── phase5c-efficient-loop.sh # Phase 5C 迭代循环
```

## 错误处理

- Phase 失败 → 脚本立即停止，显示错误
- 超时 → 当前迭代终止，继续下一个
- 输出文件缺失 → Phase 标记为失败

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| claude CLI 未找到 | 安装 Claude Code: `npm install -g @anthropic/claude-code` |
| Chrome 扩展未安装 | 从 Chrome Web Store 安装 Claude In Chrome |
| 后端健康检查失败 | 检查端口配置，确保服务已启动 |
| Phase 5B 被意外跳过 | 确认提供了 `-BackendUrl` 参数 |

## 与其他 Skill 的区别

| 方面 | System Testing | Legacy Modernization | New Project |
|------|----------------|---------------------|-------------|
| Phase 2 | 代码分析 | 遗留分析 | 需求分析 |
| Phase 3 | 代码审查 | PRP 生成 | PRP 生成 |
| Phase 4 | **跳过** | PRP 执行 | PRP 执行 |
| 输入 | 现有代码库 | 遗留代码库 | 用户需求 |
