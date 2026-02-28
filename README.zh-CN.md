# WinClaw -- 个人AI助手

[![CI](https://github.com/itc-ou-shigou/winclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/itc-ou-shigou/winclaw/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/itc-ou-shigou/winclaw)](https://github.com/itc-ou-shigou/winclaw/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/itc-ou-shigou/winclaw/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/winclaw)](https://www.npmjs.com/package/winclaw)

[English](./README.md) | **简体中文**

---

## 概述

WinClaw 是一款开源的多渠道 AI 网关与个人助手。它将 Anthropic Claude、OpenAI GPT、Google Gemini 等大语言模型接入你日常使用的即时通讯工具，包括 WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、Microsoft Teams、Matrix、Zalo 以及内置 WebChat，让你通过熟悉的聊天界面与 AI 助手交互。

WinClaw 采用 ESM-only 架构，基于 Node.js 22+、pnpm monorepo 和 tsdown 构建工具链。完全跨平台：macOS 通过 launchd 守护进程运行，Linux 通过 systemd 管理服务，Windows 通过 schtasks (任务计划程序) 实现自动启动。

WinClaw 现已提供原生 Windows 支持，包含基于 Inno Setup 构建的 EXE 安装程序，内置 Node.js 22 运行时，无需任何额外依赖即可开箱使用。同时提供 Windows 专属技能：Office 文档操作、系统管理、文件资源管理器集成和 Outlook 邮件操控。

---

## Windows 安装

### 方法一：EXE 安装程序（推荐）

安装程序内置完整 Node.js 22 运行时，无需任何前置条件。

1. 从 [SourceForge](https://sourceforge.net/projects/winclaw/files/WinClawSetup-2026.2.28.exe/download) 或 [GitHub Releases](https://github.com/itc-ou-shigou/winclaw/releases/latest) 下载 `WinClawSetup-{version}.exe`（也可从本仓库 [`releases/`](releases/) 目录获取）
2. 运行安装程序（默认使用用户权限，无需管理员）
3. 在安装向导中按需选择选项：

| 选项                  | 说明                                    | 默认 |
| --------------------- | --------------------------------------- | ---- |
| 创建桌面快捷方式      | 在桌面生成 WinClaw 图标                 | 否   |
| 添加到 PATH           | 将 WinClaw 加入用户环境变量             | 是   |
| 安装 Gateway 守护进程 | 注册 Windows 任务计划程序任务，开机自启 | 是   |

安装程序会自动完成以下操作：

- 释放 Node.js 22 运行时到 `node\` 子目录
- 安装应用到 `app\` 子目录，设置 `WINCLAW_HOME` 环境变量
- 若勾选守护进程，执行 `winclaw daemon install` 注册计划任务
- 在安装完成页面提供 **交互式引导向导** 复选框（`winclaw onboard --flow quickstart`）

默认安装路径：`%LOCALAPPDATA%\Programs\WinClaw`

> **注意：** 如果之前安装的 WinClaw 的 Node.js 进程仍在运行，安装程序会提示关闭。
> 选择「自动关闭应用程序」并点击「下一步」即可继续。

### 安装后引导向导

安装完成页面勾选「Run WinClaw Setup Wizard」并点击完成后，会弹出终端窗口运行交互式引导向导。向导会依次完成以下配置：

1. **Gateway 模式** -- 设置 `gateway.mode` 为 `local`（单机推荐）
2. **认证令牌** -- 自动生成 `gateway.auth.token`，用于 Gateway WebSocket 安全认证
3. **AI 模型凭据** -- 配置 Anthropic (Claude)、OpenAI 等提供商的 API 密钥 / OAuth 令牌
4. **消息渠道** -- 可选连接 WhatsApp、Telegram、Slack 等渠道
5. **守护进程** -- 可选注册 Gateway 为 Windows 计划任务

如果安装时跳过了向导，或需要重新运行：

```powershell
winclaw onboard --flow quickstart
```

桌面快捷方式和开始菜单启动器（`winclaw-ui.cmd`）也会自动检测首次运行：如果 `gateway.mode` 未配置，会先启动引导向导。

### 安装后：访问控制面板 (Dashboard)

引导向导完成后，Gateway 监听 `http://127.0.0.1:18789/`。控制面板 (Dashboard) 需要使用 Gateway 令牌进行认证。

**方式一：自动打开（推荐）**

```powershell
winclaw dashboard
```

此命令会在浏览器中自动打开 Dashboard，URL 中已包含令牌（`http://127.0.0.1:18789/#token=<你的令牌>`）。

**方式二：仅打印 URL**

```powershell
winclaw dashboard --no-open
```

复制输出的 URL 粘贴到浏览器中打开。

**方式三：手动访问**

1. 在浏览器中打开 `http://127.0.0.1:18789/`
2. 如果显示「disconnected (1008): unauthorized: gateway token mismatch」，说明需要提供 Gateway 令牌
3. 获取令牌：
   ```powershell
   winclaw config get gateway.auth.token
   ```
4. 将令牌附加到 URL：`http://127.0.0.1:18789/#token=<你的令牌>`

### 安装后：AI 模型认证令牌

Gateway 需要有效的 AI 提供商凭据。如果遇到 `HTTP 401 authentication_error: OAuth token has expired`，需要刷新或添加新令牌：

```powershell
# 交互式登录（打开浏览器进行 OAuth 流程）
winclaw models auth login --provider anthropic

# 或手动粘贴令牌
winclaw models auth add
```

认证配置文件位于 `%USERPROFILE%\.winclaw\agents\main\agent\auth-profiles.json`，也可直接编辑此文件。

### 方法二：PowerShell 一键安装

```powershell
irm https://raw.githubusercontent.com/itc-ou-shigou/winclaw/main/install.ps1 | iex
```

自动检测环境、安装 Node.js、通过 npm 安装 WinClaw 并启动引导向导。

### 方法三：npm 安装（已安装 Node.js 的情况）

```bash
npm install -g winclaw@latest
winclaw onboard --install-daemon
```

### 方法四：winget

```powershell
winget install WinClaw.WinClaw
winclaw onboard --install-daemon
```

---

## macOS / Linux 安装

```bash
npm install -g winclaw@latest
winclaw onboard --install-daemon
```

- **macOS**：守护进程通过 launchd 注册为 `ai.winclaw.gateway`
- **Linux**：守护进程通过 systemd 注册为 `winclaw-gateway.service`

> 系统要求：Node.js 22+。建议使用 [nvm](https://github.com/nvm-sh/nvm) 或 [fnm](https://github.com/Schniz/fnm) 管理版本。

---

## 快速开始

### Windows（EXE 安装后）

```powershell
# 1. 如果安装时跳过了引导向导，现在运行
winclaw onboard --flow quickstart

# 2. 安装并启动守护进程（如未运行）
winclaw daemon install

# 3. 打开控制面板（自动在浏览器中打开并带令牌）
winclaw dashboard

# 4. 启动终端交互界面
winclaw tui

# 5. 发送测试消息
winclaw agent --message "你好" --thinking high

# 6. 诊断检查
winclaw doctor
```

### macOS / Linux

```bash
# 1. 引导设置（选择模型、配置密钥、选择渠道）
winclaw onboard --install-daemon

# 2. 启动网关
winclaw gateway --port 18789 --verbose

# 3. 打开控制面板
winclaw dashboard

# 4. 发送测试消息
winclaw agent --message "你好" --thinking high

# 5. 启动终端交互界面
winclaw tui
```

### 主要 CLI 命令

| 命令                                        | 说明                       |
| ------------------------------------------- | -------------------------- |
| `winclaw onboard`                           | 引导设置向导               |
| `winclaw gateway`                           | 启动网关服务               |
| `winclaw dashboard`                         | 打开控制面板（自动带令牌） |
| `winclaw agent --message "..."`             | 发送单条消息               |
| `winclaw daemon install / status / restart` | 守护进程管理               |
| `winclaw doctor`                            | 诊断配置问题               |
| `winclaw tui`                               | 终端交互界面               |
| `winclaw models auth login`                 | 刷新 AI 模型认证令牌       |
| `winclaw config get <key>`                  | 查看配置项                 |
| `winclaw config set <key> <value>`          | 修改配置项                 |

---

## ⭐ 重点推荐技能

WinClaw 内置了两个强大的自动化技能，大幅提升你在 Windows PC 上的开发效率。

### 🧪 AI Dev System Testing — Web 应用自动化测试

AI 驱动的全自动 Web 应用测试：代码结构分析、业务逻辑提取、代码审查并自动修复 BUG、优先级分层测试数据生成、双层测试协议（标准 CRUD + 场景化业务逻辑测试）—— **无需编写任何测试脚本**，AI agent 全程自动完成。

**支持自动修复的语言：** Python、PHP、Go、JavaScript/Node.js、TypeScript/React 等解释型语言。

> **注意：** 编译型语言（Java、C++、C# 等）的自动化测试和 BUG 自动修复不包含在开源版本中。如需企业级支持，请联系 **info@itccloudsoft.com**。

#### 前置条件

1. **WinClaw** 已安装在你的 Windows PC 上
2. **Claude in Chrome** 浏览器扩展 — 从 [Chrome 应用商店](https://chromewebstore.google.com/) 安装（Phase 5C 浏览器 UI 测试必需）
3. **Claude 订阅**（推荐 Pro/Max 以获得最佳效果），或使用替代模型（见下文）

#### 使用替代模型（如 GLM-5 智谱清言）

不一定需要 Claude 订阅 —— 任何 OpenAI 兼容模型都可以。例如使用**智谱 GLM-5**：

```cmd
Set ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic
Set ANTHROPIC_AUTH_TOKEN=你的GLM API Key
Set ANTHROPIC_MODEL=glm-5
```

#### 使用方法

**对话模式（推荐首次使用）：**

```powershell
# 在 WinClaw Chat 标签页中直接告诉 AI：
"帮我测试 C:\path\to\my-project 这个项目，前端是 http://localhost:3000，后端是 http://localhost:8000"
```

**直接运行脚本：**

```powershell
# 基本用法（交互式 — 会询问 URL 配置）
& "C:\Users\USER\AppData\Local\Programs\WinClaw\app\skills\ai-dev-system-testing\scripts\run-all.ps1" `
    -Workspace "C:\path\to\my-project"

# 完整参数（非交互式）
& "C:\Users\USER\AppData\Local\Programs\WinClaw\app\skills\ai-dev-system-testing\scripts\run-all.ps1" `
    -Workspace "C:\path\to\my-project" `
    -FrontendUrl "http://localhost:3000" `
    -BackendUrl "http://localhost:8000" `
    -NonInteractive

# Resume 模式（跳过已完成的阶段）
& "C:\Users\USER\AppData\Local\Programs\WinClaw\app\skills\ai-dev-system-testing\scripts\run-all.ps1" `
    -Workspace "C:\path\to\my-project" -Resume
```

#### 测试阶段

| 阶段 | 功能 | 输出文件 |
|------|------|----------|
| Phase 2 | 代码结构分析 | `CODE_ANALYSIS.md` |
| Phase 3 | 代码审查 + 自动修复 BUG + 业务逻辑提取（参考框架最佳实践） | `CODE_REVIEW_REPORT.md`、`BUSINESS_LOGIC_TESTCASES.md` |
| Phase 5A | 测试数据生成（基于业务逻辑理解的优先级分层 P0–P5 场景） | `test-data/` |
| Phase 5B | API 端点测试 — 覆盖全部 pattern 的双层协议（迭代式） | `test-logs/phase5b_*.json` |
| Phase 5C | 浏览器 UI 自动化测试 — 覆盖全部 pattern 的双层协议 | `test-logs/phase5c_*.json` |
| Phase 6 | 自动生成文档 | `docs/` |

#### 框架最佳实践（Phase 3 参考文档）

Phase 3 会根据项目检测到的技术栈，动态加载框架专属的最佳实践文档。这些文档定义了反模式（Bug 风险型 vs. 仅风格型）、安全检查清单和性能指南，用于指导代码审查和自动修复决策。

| 最佳实践文档 | 框架 | 主要领域 |
|-------------|------|----------|
| `python-fastapi.md` | Python 3.10+ / FastAPI + SQLAlchemy 2.0 | 三层架构、异步模式、Pydantic 验证、N+1 查询防护 |
| `java-spring-boot.md` | Java 21+ / Spring Boot 3.x–4.x | 依赖注入、Spring Security、JPA 模式、测试策略 |
| `php-laravel.md` | PHP 8.1+ / Laravel | Eloquent ORM、中间件、表单请求、验证规则 |
| `go-zero.md` | Go 1.19+ / go-zero | gRPC 模式、struct 标签验证、服务层设计 |
| `react-nextjs.md` | React 18+ / Next.js 13.5+ | Server vs Client 组件、状态管理、记忆化、不可变性 |

#### 业务逻辑管线（Phase 3 → 5A → 5B/5C）

Phase 3 参考上述最佳实践执行深度代码审查，然后从源代码中直接提取 **6 大类业务逻辑模式**：

1. **验证规则** — Pydantic `Field()`、JPA `@NotNull/@Size`、Laravel `rules()`、go-zero struct 标签
2. **状态机** — status/state 字段转换、枚举定义、if-chain/switch 逻辑
3. **授权模式** — `@login_required`、`@PreAuthorize`、auth guard、基于角色的中间件
4. **业务约束** — 库存检查、唯一约束、余额/配额限制、引用完整性
5. **错误处理路径** — 异常处理器、自定义异常、HTTP 错误响应
6. **条件业务逻辑** — 基于角色的功能、功能开关、分级定价、基于时间的规则

这些模式输出为 `BUSINESS_LOGIC_TESTCASES.md`，Phase 5A 消费该文件生成**优先级分层（P0–P5）多场景测试数据**：管理员用户、无效验证载荷、各种状态的记录、约束触发数据、错误路径触发器等。Phase 5B/5C 执行**覆盖全部提取 pattern 的双层测试协议**：Layer 1（标准 CRUD/页面测试）+ Layer 2（针对 Phase 3 发现的每个 pattern 的必选场景测试）。每个阶段最多运行 15 次迭代，自动修复失败的测试用例，直到通过率达到 95%+（API）或 100%（UI）。

#### 测试账号配置

Phase 5 测试需要测试账号凭据：

```powershell
$env:TEST_USER_EMAIL = "test@example.com"
$env:TEST_USER_PASSWORD = "YourTestPassword123"
```

---

### 🆓 Free LLM Updater — 10+ 免费模型 API，每天自动更新

自动发现并注册免费 LLM API 提供商到 WinClaw。技能从 [cheahjs/free-llm-api-resources](https://github.com/cheahjs/free-llm-api-resources) 获取最新的免费提供商列表，验证每个 API Key 和端点是否可用，然后将可用的提供商添加到你的模型列表中。**每天早上 10 点自动更新** —— 通过 cron 定时任务自动检查新的免费提供商，无需手动操作。

**可用的免费提供商：**

| 提供商 | 可用模型 | 注册地址 |
|--------|----------|----------|
| Groq | LLaMA, Mixtral | [console.groq.com](https://console.groq.com) |
| OpenRouter | 100+ 模型 | [openrouter.ai](https://openrouter.ai) |
| Google AI Studio | Gemini Pro/Flash | [aistudio.google.com](https://aistudio.google.com) |
| Cerebras | LLaMA 70B | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| Mistral | Mistral/Mixtral | [console.mistral.ai](https://console.mistral.ai) |
| GitHub Models | GPT-4o, LLaMA | [github.com/marketplace/models](https://github.com/marketplace/models) |
| NVIDIA NIM | LLaMA, Mixtral | [build.nvidia.com](https://build.nvidia.com) |
| HuggingFace | 开源模型 | [huggingface.co](https://huggingface.co) |
| Cohere | Command R+ | [cohere.com](https://cohere.com) |
| …更多 | 自动发现 | 每日更新 |

#### 使用方法

1. 在上面的免费提供商注册免费 API Key
2. 设置环境变量（如 `GROQ_API_KEY`、`GEMINI_API_KEY`）
3. 在 WinClaw Chat 中说：**"更新免费 LLM 提供商"**
4. WinClaw 自动验证每个提供商，将可用的添加到模型列表
5. 在 **WinClaw 模型切换下拉菜单** 中选择使用免费模型

首次运行时自动注册每日更新定时任务，无需手动配置。

---

## 内置插件

WinClaw 内置 **18 个预构建插件**，覆盖 15 个专业领域 —— **88 个斜杠命令**、**90+ AI 技能**、**40+ MCP 集成**，开箱即用。在聊天中说一句话，或在配置文件中改一行，即可启用任意插件。

### 快速开始

**方式 A — 自然语言**（直接在聊天中输入）：
```
你：   启用 sales 插件
AI：   已启用！Sales 插件包含 3 个命令和 6 个技能。
       输入 /sales:draft-outreach 即可调研潜在客户并起草外联消息。
```

**方式 B — 配置文件**（`winclaw.json`）：
```json
{
  "plugins": {
    "entries": {
      "data": { "enabled": true },
      "sales": { "enabled": true },
      "bio-research": { "enabled": true }
    }
  }
}
```

### 插件目录

#### 业务基础

<details>
<summary><b>productivity</b> — 任务管理与跨会话持久记忆</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/start` | 初始化生产力仪表盘并同步任务 |
| 命令 | `/update` | 从当前活动刷新任务和记忆 |
| 技能 | task-management | 通过 TASKS.md 跟踪任务和状态更新 |
| 技能 | memory-management | 跨会话的双层记忆系统 |

MCP: Slack, Notion, Asana, Linear, Monday, Atlassian, Google Calendar, Gmail
</details>

<details>
<summary><b>data</b> — SQL 生成、数据探索、仪表盘与可视化</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/analyze` | 回答数据问题，从快速查找到完整分析 |
| 命令 | `/build-dashboard` | 构建带图表和筛选器的交互式 HTML 仪表盘 |
| 命令 | `/create-viz` | 用 Python 创建出版级可视化图表 |
| 命令 | `/explore-data` | 数据集画像 — 分布、异常值、质量 |
| 命令 | `/validate` | 分享前的分析 QA 检查 |
| 命令 | `/write-query` | 按最佳实践生成优化 SQL |
| 技能 | sql-queries | 全主流数据库通用的正确高效 SQL |
| 技能 | data-exploration | 探索数据集的形状与质量 |
| 技能 | data-visualization | 用 Python（matplotlib, plotly）制作有效图表 |
| 技能 | interactive-dashboard-builder | 构建自包含的交互式 HTML 仪表盘 |
| 技能 | statistical-analysis | 描述统计、假设检验、回归分析 |
| 技能 | data-validation | 验证方法论、准确性和完整性 |
| 技能 | data-context-extractor | 生成企业特定的数据分析上下文 |

MCP: Snowflake, Databricks, BigQuery, Hex, Amplitude, Atlassian
</details>

<details>
<summary><b>finance</b> — 财务报表、差异分析、对账与审计</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/income-statement` | 生成带期间对比的利润表 |
| 命令 | `/journal-entry` | 编制借贷正确的记账凭证 |
| 命令 | `/reconciliation` | 总账与明细账、银行对账 |
| 命令 | `/sox-testing` | 生成 SOX 抽样和测试底稿 |
| 命令 | `/variance-analysis` | 按驱动因素分解差异并生成说明 |
| 技能 | financial-statements | 利润表、资产负债表、现金流量表 |
| 技能 | variance-analysis | 按驱动因素分解差异并解释 |
| 技能 | reconciliation | 总账与明细账、银行记录的匹配 |
| 技能 | journal-entry-prep | 附佐证的正确借贷凭证编制 |
| 技能 | audit-support | SOX 404 合规测试与抽样选择 |
| 技能 | close-management | 月结任务排序与跟踪 |

MCP: Snowflake, Databricks, BigQuery, Slack, Google Calendar, Gmail
</details>

<details>
<summary><b>operations</b> — 流程优化、供应商管理与风险评估</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/capacity-plan` | 预测资源需求与分配 |
| 命令 | `/change-request` | 起草和跟踪变更管理请求 |
| 命令 | `/process-doc` | 逐步记录运营流程 |
| 命令 | `/runbook` | 创建可重复操作的运行手册 |
| 命令 | `/status-report` | 生成运营状态报告 |
| 命令 | `/vendor-review` | 评估和比较供应商表现 |
| 技能 | process-optimization | 识别瓶颈并提出改进方案 |
| 技能 | vendor-management | 评估、比较和管理供应商关系 |
| 技能 | risk-assessment | 带严重度和缓解措施的风险评估 |
| 技能 | resource-planning | 容量规划与资源分配 |
| 技能 | change-management | 组织变更的结构化和跟踪 |
| 技能 | compliance-tracking | 监控合规要求和状态 |

MCP: Slack, ServiceNow, Asana, Atlassian, Notion, Google Calendar, Gmail
</details>

#### 客户相关

<details>
<summary><b>sales</b> — 管道管理、潜客调研与个性化外联</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/call-summary` | 从通话笔记或录音提取行动项 |
| 命令 | `/forecast` | 生成加权销售预测（最佳/预期/最差） |
| 命令 | `/pipeline-review` | 分析管道健康度 — 优先排序与风险标记 |
| 技能 | draft-outreach | 调研潜客后起草个性化消息 |
| 技能 | account-research | 调研企业并获取可操作的销售洞察 |
| 技能 | call-prep | 用参会者画像和谈话要点准备通话 |
| 技能 | competitive-intelligence | 调研竞品并制作战斗卡 |
| 技能 | create-an-asset | 生成定制销售资料（演示文稿、落地页） |
| 技能 | daily-briefing | 以优先级排序的销售简报开启每一天 |

MCP: HubSpot, Clay, ZoomInfo, Apollo, Slack, Notion, Outreach, Gmail
</details>

<details>
<summary><b>customer-support</b> — 工单分拣、回复起草、升级与知识库文章</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/draft-response` | 起草专业的客户回复 |
| 命令 | `/escalate` | 打包升级给工程或产品团队 |
| 命令 | `/kb-article` | 从已解决问题创建知识库文章 |
| 命令 | `/research` | 多源调研客户问题 |
| 命令 | `/triage` | 分类、排优先级并路由支持工单 |
| 技能 | ticket-triage | 按紧急度分类工单并路由到对应团队 |
| 技能 | response-drafting | 起草有同理心的专业客户回复 |
| 技能 | escalation | 构建面向工程的升级包 |
| 技能 | customer-research | 跨文档、日志、CRM 搜索上下文 |
| 技能 | knowledge-management | 将已解决问题转化为自助内容 |

MCP: Slack, Intercom, HubSpot, Guru, Atlassian, Notion, Gmail
</details>

<details>
<summary><b>marketing</b> — 活动策划、内容创作、SEO 与效果分析</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/brand-review` | 按品牌风格和调性审查内容 |
| 命令 | `/campaign-plan` | 生成含渠道和时间线的完整活动策划 |
| 命令 | `/competitive-brief` | 竞品调研和定位分析 |
| 命令 | `/draft-content` | 起草博客、社交媒体、邮件、简报 |
| 命令 | `/email-sequence` | 设计多邮件培育序列 |
| 命令 | `/performance-report` | 构建含关键指标的营销效果报告 |
| 命令 | `/seo-audit` | 关键词调研、页面审核与优化 |
| 技能 | campaign-planning | 含目标、受众和渠道的活动策划 |
| 技能 | content-creation | 全渠道营销内容创作 |
| 技能 | brand-voice | 保持一致的品牌调性和信息传达 |
| 技能 | competitive-analysis | 对比定位、信息传达和策略 |
| 技能 | performance-analytics | 分析指标、趋势和 ROI |

MCP: Canva, HubSpot, Ahrefs, Klaviyo, Figma, Amplitude, Notion, Slack
</details>

#### 产品与工程

<details>
<summary><b>product-management</b> — 功能规格、路线图、用户调研与利益相关者汇报</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/competitive-brief` | 创建竞品分析简报 |
| 命令 | `/metrics-review` | 审查和分析带趋势的产品指标 |
| 命令 | `/roadmap-update` | 更新或重新排列产品路线图优先级 |
| 命令 | `/sprint-planning` | 规划和结构化冲刺工作 |
| 命令 | `/stakeholder-update` | 按受众定制利益相关者更新 |
| 命令 | `/synthesize-research` | 从访谈和调查中综合调研结果 |
| 命令 | `/write-spec` | 从问题陈述编写功能规格或 PRD |
| 技能 | feature-spec | 编写带验收标准的结构化 PRD |
| 技能 | roadmap-management | 用 RICE/MoSCoW 框架排列优先级 |
| 技能 | user-research-synthesis | 综合定性与定量调研 |
| 技能 | competitive-analysis | 功能对比矩阵和定位分析 |
| 技能 | metrics-tracking | 定义、跟踪和分析产品指标 |
| 技能 | stakeholder-comms | 按受众定制汇报（高管、工程、销售） |

MCP: Linear, Amplitude, Pendo, Figma, Slack, Atlassian, Notion, Intercom
</details>

<details>
<summary><b>engineering</b> — 代码审查、系统设计、事件响应与文档</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/architecture` | 带权衡分析的系统架构设计 |
| 命令 | `/debug` | 带根因分析的系统化调试 |
| 命令 | `/deploy-checklist` | 生成部署前检查清单 |
| 命令 | `/incident` | 结构化事件响应和复盘 |
| 命令 | `/review` | 含安全和性能检查的代码审查 |
| 命令 | `/standup` | 从近期活动生成站会摘要 |
| 技能 | system-design | 带架构图的可扩展系统设计 |
| 技能 | code-review | 正确性和安全性的深度代码审查 |
| 技能 | incident-response | 结构化事件响应和无责复盘 |
| 技能 | documentation | 从代码自动生成技术文档 |
| 技能 | tech-debt | 识别和排列技术债优先级 |
| 技能 | testing-strategy | 设计全面的测试策略 |

MCP: GitHub, PagerDuty, Datadog, Linear, Slack, Atlassian, Notion
</details>

<details>
<summary><b>design</b> — 无障碍审核、UX 文案、设计评审与开发交接</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/accessibility` | 运行 WCAG 无障碍审核 |
| 命令 | `/critique` | 获取结构化的设计反馈 |
| 命令 | `/design-system` | 管理和文档化设计系统组件 |
| 命令 | `/handoff` | 生成像素级精确的开发交接规范 |
| 命令 | `/research-synthesis` | 综合 UX 调研发现 |
| 命令 | `/ux-copy` | 编写和审查微文案与界面文字 |
| 技能 | accessibility-review | WCAG 合规审核并提供修复建议 |
| 技能 | design-critique | 基于设计原则的结构化评审 |
| 技能 | design-handoff | 含设计令牌、间距和状态的开发规范 |
| 技能 | design-system-management | 文档化和维护组件库 |
| 技能 | user-research | 将用户调研综合为可操作洞察 |
| 技能 | ux-writing | 编写清晰一致的界面文案 |

MCP: Figma, Linear, Slack, Asana, Atlassian, Notion, Intercom
</details>

#### 专业领域

<details>
<summary><b>legal</b> — 合同审查、NDA 分拣、合规检查与法务简报</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/brief` | 生成上下文关联的法务简报 |
| 命令 | `/compliance-check` | 检查 GDPR、CCPA 与法规合规 |
| 命令 | `/respond` | 生成模板化法务回复 |
| 命令 | `/review-contract` | 按谈判剧本审查合同 |
| 命令 | `/signature-request` | 准备签署请求包 |
| 命令 | `/triage-nda` | 将 NDA 分类为 GREEN / YELLOW / RED |
| 命令 | `/vendor-check` | 查看现有供应商协议状态 |
| 技能 | contract-review | 按组织标准审查合同 |
| 技能 | nda-triage | 筛查 NDA — 标准（GREEN）或需审查（RED） |
| 技能 | compliance | 导航 GDPR、CCPA 和隐私法规 |
| 技能 | legal-risk-assessment | 带缓解建议的风险严重度评估 |
| 技能 | meeting-briefing | 为法务会议准备简报 |
| 技能 | canned-responses | 为常见咨询生成模板回复 |

MCP: Box, DocuSign, Egnyte, Atlassian, Slack, Google Calendar, Gmail
</details>

<details>
<summary><b>human-resources</b> — 招聘、薪酬分析、入职与绩效评估</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/comp-analysis` | 对标市场数据的薪酬分析 |
| 命令 | `/draft-offer` | 起草合规的录用通知书 |
| 命令 | `/onboarding` | 创建结构化入职计划 |
| 命令 | `/people-report` | 生成人员分析报告 |
| 命令 | `/performance-review` | 结构化绩效评估讨论 |
| 命令 | `/policy-lookup` | 查询公司政策和回答 HR 问题 |
| 技能 | interview-prep | 含评分卡的面试计划结构化 |
| 技能 | compensation-benchmarking | 对标市场数据的薪酬基准分析 |
| 技能 | recruiting-pipeline | 跟踪和优化招聘管道 |
| 技能 | org-planning | 组织架构与编制规划 |
| 技能 | people-analytics | 分析留存率、敬业度和人员指标 |
| 技能 | employee-handbook | 起草和维护员工手册政策 |

MCP: Slack, Google Calendar, Gmail, Notion, Atlassian
</details>

<details>
<summary><b>enterprise-search</b> — 一个查询搜遍全公司工具</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/digest` | 生成跨工具活动的日报/周报摘要 |
| 命令 | `/search` | 一次查询搜索全部已连接数据源 |
| 技能 | search-strategy | 将复杂查询分解为多源搜索 |
| 技能 | knowledge-synthesis | 综合搜索结果生成连贯摘要 |
| 技能 | source-management | 管理和配置已连接的 MCP 数据源 |

MCP: Slack, Notion, Guru, Atlassian, Asana, Google Calendar, Gmail
</details>

<details>
<summary><b>bio-research</b> — 文献搜索、临床试验、基因组学与实验室数据分析</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/start` | 设置生物研究环境并探索可用工具 |
| 技能 | scientific-problem-selection | 帮助科学家选择和确定研究问题优先级 |
| 技能 | single-cell-rna-qc | 用 scanpy 做单细胞 RNA-seq 数据质控 |
| 技能 | scvi-tools | 用 scvi-tools 进行单细胞分析的深度学习 |
| 技能 | nextflow-development | 运行 nf-core 生信流程（rnaseq, sarek） |
| 技能 | instrument-data-to-allotrope | 将实验室仪器输出文件转换为 Allotrope 格式 |

MCP: PubMed, bioRxiv, ChEMBL, ClinicalTrials.gov, Open Targets, Benchling, Synapse
</details>

#### 合作伙伴

<details>
<summary><b>apollo</b> — 通过 Apollo API 进行线索增强、潜客发掘与序列加载</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 技能 | prospect | 用自然语言描述 ICP，获取排序后的线索列表 |
| 技能 | enrich-lead | 通过姓名、邮箱或 LinkedIn URL 增强联系人信息 |
| 技能 | sequence-load | 一站式完成联系人搜索、增强并加载到序列 |

MCP: Apollo
</details>

<details>
<summary><b>brand-voice</b> — 从现有素材自动生成和执行品牌指南</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/discover-brand` | 从文档、通话和聊天中发现品牌信号 |
| 命令 | `/enforce-voice` | 对 AI 生成的内容应用品牌指南 |
| 命令 | `/generate-guidelines` | 从现有素材生成品牌调性指南 |
| 技能 | discover-brand | 跨 Notion、Drive、Gong、Slack 搜索品牌信号 |
| 技能 | guideline-generation | 将品牌素材提炼为可执行的指南 |
| 技能 | brand-voice-enforcement | 对所有 AI 生成内容应用指南 |

MCP: Notion, Figma, Gong, Atlassian, Box
</details>

<details>
<summary><b>common-room</b> — 基于产品使用、互动与意向信号的 GTM 情报</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/generate-account-plan` | 从信号数据创建战略客户计划 |
| 命令 | `/weekly-brief` | 为即将到来的通话生成周度简报 |
| 技能 | account-research | 用真实互动数据调研客户 |
| 技能 | contact-research | 从多信号源构建联系人画像 |
| 技能 | call-prep | 用参会者画像和谈话要点准备通话 |
| 技能 | prospect | 从信号数据构建目标潜客列表 |
| 技能 | compose-outreach | 跨邮件和 LinkedIn 起草个性化外联 |
| 技能 | weekly-prep-brief | 为每个即将到来的通话准备周度简报 |

MCP: Common Room
</details>

<details>
<summary><b>slack</b> — 通过 Slack API 实现频道摘要、站会总结与消息起草</summary>

| 类型 | 名称 | 功能说明 |
|------|------|---------|
| 命令 | `/channel-digest` | 总结指定时间段的频道活动 |
| 命令 | `/draft-announcement` | 起草团队公告 |
| 命令 | `/find-discussions` | 跨频道查找相关讨论 |
| 命令 | `/standup` | 从 Slack 活动生成站会摘要 |
| 命令 | `/summarize-channel` | 创建简洁的频道总结 |
| 技能 | slack-messaging | 发送和管理 Slack 消息与线程 |
| 技能 | slack-search | 跨 Slack 频道和对话搜索 |

MCP: Slack
</details>

### 插件使用示例

**生成优化 SQL**（data 插件）：
```
你：   写一个查询，找出本季度收入前 10 的客户
AI：   /data:write-query — 这是为你的 Snowflake 仓库优化的查询：
       SELECT customer_id, SUM(amount) as total_revenue
       FROM orders WHERE order_date >= DATE_TRUNC('quarter', CURRENT_DATE)
       GROUP BY customer_id ORDER BY total_revenue DESC LIMIT 10;
       已添加索引提示和分区裁剪以提升性能。
```

**NDA 分拣**（legal 插件）：
```
你：   审查供应商发来的这份保密协议
AI：   /legal:triage-nda — 分类：GREEN（标准条款）。
       期限：2 年，双向义务，标准例外条款。
       注意：第 7 条竞业限制范围偏大。
       建议：谈判缩小至直接竞争对手范围。
```

**搜索临床试验**（bio-research 插件）：
```
你：   查找 pembrolizumab 治疗肺癌的临床试验
AI：   /bio-research:start — 搜索 PubMed + ClinicalTrials.gov 中...
       找到 47 项正在招募的 III 期试验。排名靠前的结果：
       | NCT ID | 设计 | 入组 | 状态 |
       | NCT04567890 | 联合化疗 | n=800 | 招募中 |
       | NCT04891234 | 辅助治疗 | n=1200 | 招募中 |
       需要分析终点指标或查找相关 PubMed 论文吗？
```

**发掘销售线索**（apollo 插件）：
```
你：   查找湾区 B 轮 SaaS 公司的 VP Engineering 联系人
AI：   正在搜索 Apollo... 找到 12 个匹配联系人（按匹配度排序）：
       | 姓名 | 职位 | 公司 | 员工数 | 融资轮次 |
       | Jane Smith | VP Eng | Acme AI | 150 | B 轮 |
       | ...
       需要增强这些联系人信息或加载到序列吗？
```

**策划营销活动**（marketing 插件）：
```
你：   为我们的新 API 功能策划产品发布活动
AI：   /marketing:campaign-plan — 多渠道活动策划简报：
       目标：30 天内获取 500 个 API 注册
       渠道：邮件序列（3 封）、博客、社交媒体、网络研讨会
       时间线：第 1 周预告 → 第 2 周发布 → 第 3-4 周培育
       KPI：注册数、激活率、文档页面浏览量
```

**评估运营风险**（operations 插件）：
```
你：   评估支付系统迁移到新服务商的风险
AI：   /operations:risk-assessment — 风险矩阵：
       | 风险 | 严重度 | 可能性 | 缓解措施 |
       | 迁移中数据丢失 | 高 | 低 | 并行运行 30 天 |
       | API 宕机 | 中 | 中 | 功能开关 + 回滚 |
       | 合规缺口 | 高 | 低 | 迁移前审计 |
       综合评估：中等 — 建议分阶段上线并并行运行。
```

---

## 配置说明

### 配置文件路径

| 平台                    | 路径                                  |
| ----------------------- | ------------------------------------- |
| Windows（所有安装方式） | `%USERPROFILE%\.winclaw\winclaw.json` |
| macOS / Linux           | `~/.winclaw/winclaw.json`             |

可通过 `WINCLAW_CONFIG_PATH` 或 `WINCLAW_STATE_DIR` 环境变量覆盖。

Windows 下的主要配置文件：

| 文件     | 路径                                                          | 用途                                  |
| -------- | ------------------------------------------------------------- | ------------------------------------- |
| 主配置   | `%USERPROFILE%\.winclaw\winclaw.json`                         | Gateway、渠道、技能、代理设置         |
| 认证配置 | `%USERPROFILE%\.winclaw\agents\main\agent\auth-profiles.json` | AI 提供商令牌（Anthropic、OpenAI 等） |
| 渠道凭据 | `%USERPROFILE%\.winclaw\credentials\`                         | WhatsApp 会话等渠道认证数据           |
| 会话记录 | `%USERPROFILE%\.winclaw\agents\main\sessions\`                | 对话会话历史                          |

### 最小配置示例

```json
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "auth": {
      "mode": "token",
      "token": "<自动生成的令牌>"
    }
  },
  "agent": {
    "model": "claude-opus-4-6"
  }
}
```

> **提示：** 引导向导会自动生成此配置。手动编辑仅用于高级定制。

### 关键配置项

| 配置项                  | 说明                                                  |
| ----------------------- | ----------------------------------------------------- |
| `agent.model`           | AI 模型标识 (`claude-sonnet-4-20250514`, `gpt-4o` 等) |
| `agent.apiKey`          | 模型 API 密钥                                         |
| `agent.systemPrompt`    | 自定义系统提示词                                      |
| `channels.<id>.enabled` | 启用/禁用指定消息渠道                                 |
| `gateway.port`          | 网关监听端口，默认 18789                              |
| `skills.entries`        | 技能加载配置                                          |
| `skills.dynamicFilter`  | 动态技能加载配置                                      |

### 动态技能加载

大量技能场景下，基于关键词匹配按需加载技能，避免注入全部上下文：

```json
{
  "skills": {
    "dynamicFilter": {
      "mode": "auto",
      "maxSkills": 20,
      "maxSkillsPromptChars": 50000,
      "alwaysInclude": ["github", "coding-agent"]
    }
  }
}
```

`mode` 可选 `auto` / `on` / `off`；`alwaysInclude` 设置始终加载的技能列表。

---

## 插件系统

WinClaw 支持通过插件架构扩展网关功能。插件位于 `extensions/` 目录，
通过配置文件中的 `plugins.entries` 启用。

### MCP Bridge 插件

**MCP Bridge** 插件（`extensions/mcp-bridge/`）将外部
[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) 服务器
桥接为 WinClaw 代理的可调用工具。支持浏览器自动化、数据库访问、自定义 API 等
MCP 兼容的工具服务器，通过自然对话直接使用。

**核心功能：**

- 支持 **stdio**（子进程）和 **SSE**（HTTP）两种 MCP 传输方式
- 自动重连（可配置重试次数）
- 工具调用以 `mcp__<服务器名>__<工具名>` 格式命名空间化
- Chrome 标签页保护：`before_tool_call` 钩子阻止危险操作（关闭标签页、终止 Chrome、导航到用户标签页）

**配置示例：**

```json
{
  "plugins": {
    "entries": {
      "mcp-bridge": {
        "enabled": true,
        "servers": [
          {
            "name": "chrome-devtools",
            "transport": "stdio",
            "command": "npx",
            "args": ["-y", "@anthropic/chrome-devtools-mcp@latest"]
          }
        ]
      }
    }
  }
}
```

### 桌面应用操控（VNC + MCP）

**desktop-app-control** 技能使 AI 助手能够通过 VNC + Chrome DevTools MCP
管道操控原生桌面应用程序（Windows / macOS）。助手可以打开应用、点击按钮、
输入文字、操作菜单、截取屏幕截图——全部通过自然语言命令完成。

**架构：** 用户请求 → WinClaw 代理 → `mcp__chrome_devtools__*` 工具
→ Chrome DevTools Protocol → noVNC 标签页 → websockify → VNC 服务器 → 桌面

**前置条件：**

- 启用 MCP Bridge 插件并配置 `chrome-devtools` 服务器
- VNC 服务器运行中（Windows: TightVNC，macOS: 屏幕共享）
- websockify + noVNC（基于浏览器的 VNC 访问）
- Chrome 以 `--remote-debugging-port` 启动（端口自动选择）

**安全的 Chrome 调试：** 使用随附的 `scripts/ensure-chrome-debug.ps1` 脚本，
可在不中断现有浏览器会话的情况下安全启用 Chrome 远程调试。脚本自动扫描端口
**9222-9229**，使用第一个可用端口，无需担心端口冲突。

---

## Windows 专属功能

### Windows 原生技能

| 技能               | 说明                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `windows-office`   | 创建/编辑 Word、Excel、PowerPoint (python-docx, openpyxl, python-pptx)，可选 COM 支持 PDF 导出 |
| `windows-system`   | 系统管理：服务、进程、注册表、事件日志、计划任务 (PowerShell)                                  |
| `windows-explorer` | 文件操作：递归搜索、批量重命名、压缩解压、剪贴板                                               |
| `windows-outlook`  | 通过 Outlook COM Automation 发送/读取邮件                                                      |

### PowerShell 脚本支持

技能脚本同时提供 `.sh` 和 `.ps1` 版本，Windows 上自动使用 PowerShell 执行。

### Windows 包管理器

| 管理器   | 用途                       |
| -------- | -------------------------- |
| `winget` | Windows 原生包管理器       |
| `scoop`  | 便携式包管理器，面向开发者 |
| `choco`  | Chocolatey，企业级包管理   |
| `pip`    | Python 包 (Office 技能等)  |

### Gateway 守护进程 (schtasks)

- 任务名称：`WinClaw Gateway`，用户登录时自动启动
- 以当前用户身份运行，无需管理员权限
- 管理：`winclaw daemon install | uninstall | status`

### WINCLAW_HOME 与嵌入式 Node.js

```
%WINCLAW_HOME%\
  node\          ← 嵌入式 Node.js 22 运行时
  app\           ← WinClaw 应用代码与依赖
  winclaw.cmd    ← CLI 启动器 (自动使用嵌入式 Node.js)
  winclaw-ui.cmd ← UI 启动器 (启动 Gateway + 打开浏览器)
  assets\        ← 图标等资源
```

### 桌面快捷方式 / 开始菜单启动器

安装程序创建的桌面快捷方式和开始菜单项运行 `winclaw-ui.cmd`，该脚本：

1. 检测是否需要首次配置（无配置文件或 `gateway.mode` 未设置）
2. 如需要，自动启动引导向导
3. 以最小化窗口启动 Gateway（如未运行）
4. 在默认浏览器中打开控制面板（`http://127.0.0.1:18789/`）

### Windows 常见问题排查

**「disconnected (1008): unauthorized: gateway token mismatch」**

控制面板无法通过 Gateway 认证。解决方法：

```powershell
# 获取带令牌的正确 Dashboard URL
winclaw dashboard --no-open
# 在浏览器中打开输出的 URL
```

**Gateway 未启动 / 端口 18789 无响应**

```powershell
# 检查 Gateway 是否运行
winclaw health

# 检查守护进程状态
winclaw daemon status

# 重启守护进程
winclaw daemon restart

# 或手动启动
winclaw gateway --port 18789
```

**「OAuth token has expired」(HTTP 401)**

```powershell
# 重新认证 Anthropic
winclaw models auth login --provider anthropic

# 或手动添加令牌
winclaw models auth add

# 查看当前认证配置
winclaw models status
```

**控制面板 Config 为空 / 显示 Schema unavailable**

说明控制面板未连接到 Gateway。使用 `winclaw dashboard` 以正确的令牌打开面板，或重新运行引导向导：

```powershell
winclaw onboard --flow quickstart
```

**安装时提示「Node.js JavaScript Runtime 正在使用」**

之前的 WinClaw Gateway 进程仍在运行。选择「自动关闭应用程序」，或手动停止：

```powershell
winclaw daemon stop
# 或强制终止所有 WinClaw 的 Node.js 进程
Get-Process -Name node | Where-Object { $_.Path -like '*WinClaw*' } | Stop-Process -Force
```

---

## 渠道配置

| 渠道            | 配置键                | 协议                              |
| --------------- | --------------------- | --------------------------------- |
| WhatsApp        | `channels.whatsapp`   | WhatsApp Web (Baileys)            |
| Telegram        | `channels.telegram`   | Telegram Bot API                  |
| Slack           | `channels.slack`      | Slack Events API / Socket Mode    |
| Discord         | `channels.discord`    | Discord Bot API                   |
| Google Chat     | `channels.googlechat` | Google Chat API                   |
| Signal          | `channels.signal`     | Signal CLI / API                  |
| iMessage        | `channels.imessage`   | BlueBubbles / AppleScript (macOS) |
| Microsoft Teams | `channels.msteams`    | Microsoft Graph API               |
| Matrix          | `channels.matrix`     | Matrix Client-Server API          |
| Zalo            | `channels.zalo`       | Zalo OA API                       |
| WebChat         | `channels.webchat`    | 内置 Web 界面                     |

每个渠道需配置 `enabled`、认证凭据和允许列表 (`allowFrom`)。详见[官方文档](https://github.com/itc-ou-shigou/winclaw/tree/main/docs)。

---

## 技能系统

每个技能是一个 `SKILL.md` 文件，包含名称、描述、前置条件和使用说明。

| 类型       | 位置                          | 说明                      |
| ---------- | ----------------------------- | ------------------------- |
| 内置技能   | `skills/` (安装目录)          | 随 WinClaw 发布，开箱即用 |
| 托管技能   | `~/.winclaw/skills/`          | 用户安装或社区获取        |
| 工作区技能 | 项目目录下 `.winclaw/skills/` | 项目级，跟随项目分发      |

内置 50+ 技能，涵盖：**生产力** (github, notion, obsidian, trello)、**编码** (coding-agent, canvas)、**多媒体** (openai-image-gen, video-frames, whisper-api)、**通信** (himalaya, discord, voice-call)、**系统** (windows-office/system/explorer/outlook)、**智能家居** (openhue, sonoscli)。

技能依赖通过多种包管理器自动安装：`npm`, `pip`, `brew`, `apt`, `winget`, `scoop`, `choco`。

---

## 通过聊天配置（设置技能）

WinClaw 内置了 6 个**设置技能**，让你通过 Chat 标签页或任何已连接的消息渠道，用自然对话完成所有配置。无需手动编辑配置文件，只需告诉 AI 你想做什么。

### 设置技能一览

| 技能                 | 图标 | 功能                                                       |
| -------------------- | ---- | ---------------------------------------------------------- |
| `winclaw-setup`      | ⚙️   | Gateway 核心设置：端口、认证令牌、TLS、AI 模型、主题、日志 |
| `winclaw-channels`   | 🔗   | 添加、删除、启用/禁用消息渠道，管理 DM/群组策略            |
| `winclaw-agents`     | 🤖   | 创建和配置 AI 代理：模型、人设、工作区、思考级别           |
| `winclaw-cron`       | ⏰   | 调度定期任务：每日报告、提醒、定期检查                     |
| `winclaw-status`     | 📊   | 查看系统状态、使用统计、已连接渠道、活跃会话               |
| `winclaw-sns-wizard` | 📲   | 逐步引导连接 19 个支持平台中的任意一个                     |

### 使用方法

打开控制面板的 **Chat** 标签页（或通过已连接的消息渠道发送消息），用自然语言描述你想做的事。AI 会自动调用合适的技能，通过 Gateway API 完成设置。

### 对话示例

**初始设置：**

```
你:   帮我完成 WinClaw 的初始设置
AI:   我来引导你完成初始设置。正在检查当前配置…
      Gateway 正在端口 18789 上运行。先来配置 AI 模型吧，
      你想使用哪个提供商？
你:   Anthropic 的 Claude
AI:   搞定！已将 agent.model 设置为 claude-sonnet-4-20250514。
      接下来要连接消息渠道吗？
```

**连接消息平台：**

```
你:   我要连接 Telegram
AI:   好的！我们来逐步设置 Telegram。
      1. 在 Telegram 中搜索 @BotFather
      2. 发送 /newbot，按提示创建机器人
      3. 复制机器人令牌（格式如 123456:ABC-DEF...）
      准备好后把令牌粘贴到这里。
你:   7891234567:AAH2kx9...
AI:   ✅ Telegram 已连接！机器人现在可以接收消息了。
      需要配置 DM 策略或添加允许的用户吗？
```

**调度定期任务：**

```
你:   每天早上8点给我发天气摘要
AI:   我来创建一个定时任务。设置每天 08:00 执行的任务，
      提示词为"给出今天的简要天气摘要"…
      ✅ 定时任务已创建！每天早上 8 点你会收到天气摘要。
```

**查看系统状态：**

```
你:   一切正常吗？给我看看连接情况
AI:   📊 系统状态:
      • Gateway: 正常（运行时间 3 天 12 小时）
      • 渠道: WhatsApp ✅、Telegram ✅、Discord ❌（已禁用）
      • 活跃会话: 4
      • 模型: claude-sonnet-4-20250514
      • 已加载技能: 23/50
```

**管理代理：**

```
你:   创建一个叫"translator"的新代理，用 GPT-4o
AI:   我来创建一个使用 gpt-4o、ID 为"translator"的新代理。
      需要设置系统提示词或人设吗？
你:   好，让它做日英翻译
AI:   ✅ 代理"translator"已创建，配置了翻译专用的系统提示词。
      可以直接使用了。需要将它绑定到某个渠道吗？
```

> **提示：** 这些技能基于关键词匹配自动加载。只需自然地描述你的需求，WinClaw 会自动选择合适的技能来响应。

---

## 开发（从源码）

```bash
git clone https://github.com/itc-ou-shigou/winclaw.git
cd winclaw
pnpm install --frozen-lockfile
pnpm build
pnpm dev                 # 开发模式
pnpm test                # 运行测试
pnpm check               # 格式化 + 类型检查 + Lint
```

### 项目结构

```
winclaw/
  src/
    agents/         ← AI 代理核心、工具调用、技能加载
    channels/       ← 消息渠道插件系统
    config/         ← 配置解析、校验、迁移
    daemon/         ← 守护进程 (launchd/systemd/schtasks)
    acp/            ← Agent Communication Protocol
  skills/           ← 内置技能集合
  scripts/          ← 构建与打包脚本
  docs/             ← 文档
```

---

## 构建 Windows 安装程序

前置条件：[Inno Setup 6+](https://jrsoftware.org/isinfo.php)、PowerShell 5.1+、pnpm 10+。
最终安装程序通过自动化体积优化，严格控制在 **100 MB 以内**。

```powershell
# 完整构建（包含 pnpm build）
.\scripts\package-windows-installer.ps1

# 跳过 pnpm build 步骤（复用已有构建产物）
.\scripts\package-windows-installer.ps1 -SkipBuild

# 仅重新打包安装程序（复用已有构建产物，跳过 pnpm build）
.\scripts\rebuild-installer.ps1
```

构建流程：

1. 下载 Node.js 22 LTS 便携版到 `dist/cache/`
2. 运行 `pnpm build` 生成生产包（仅完整构建时执行）
3. 运行 `npm pack` 并解压到 `dist/win-staging/app/`
4. **清除冗余文件**：删除 `npm pack` 通过 `package.json` `files` 字段带入的旧安装程序 EXE、下载缓存和 staging 残留
5. **移除重型可选依赖**：GPU 运行时 (CUDA/Vulkan/ARM64)、`node-llama-cpp`、`@napi-rs/canvas`、`playwright-core`、`@lydell/node-pty` 和纯类型包 (`@types`、`bun-types` 等)。用户可在安装后按需单独安装
6. **精简 node_modules**：移除测试套件、文档、TypeScript 源文件、Source Map 等运行时不需要的文件
7. 复制 Node.js 运行时、启动脚本、WinClawUI 桌面应用和资源到 `dist/win-staging/`
8. 使用 Inno Setup 以 LZMA2/ultra64 固实压缩编译 `scripts/windows-installer.iss` 为 `dist/WinClawSetup-{version}.exe`
9. 复制安装程序到 `releases/`

Inno Setup 编译大约需要 1-2 分钟。生成的安装程序通常约 **84 MB**。

---

## 架构图

```
                        +------------------+
                        |  用户 (Chat App)  |
                        +--------+---------+
                                 |
            +--------------------+--------------------+
            |                    |                    |
      +-----v-----+      +------v------+      +-----v------+
      |  WhatsApp  |      |  Telegram   |      |  Discord   | ...
      +-----+------+      +------+------+      +-----+------+
            |                    |                    |
            +--------------------+--------------------+
                                 |
                        +--------v---------+
                        |    Gateway       |
                        |  (HTTP :18789)   |
                        +--------+---------+
                                 |
                  +--------------+--------------+
                  |                             |
           +------v-------+            +-------v--------+
           | Channel      |            | Session        |
           | Plugin       |            | Manager        |
           | Registry     |            +-------+--------+
           +--------------+                    |
                                       +-------v--------+
                                       |   AI Agent     |
                                       | (Claude/GPT/..) |
                                       +-------+--------+
                                               |
                                  +------------+------------+
                                  |            |            |
                            +-----v---+  +----v----+ +-----v-----+
                            | Shell   |  | Skills  | | Plugins   |
                            | Tools   |  | Engine  | | MCP Bridge|
                            +---------+  +---------+ +-----+-----+
                                                           |
                                                    +------v------+
                                                    | MCP Servers |
                                                    | (DevTools,  |
                                                    |  DB, etc.)  |
                                                    +-------------+
```

---

## 安全模型

**认证与授权**

- 渠道允许列表 (`allowFrom`)：仅允许指定用户/群组交互
- API 密钥通过环境变量替换 (`${ENV_VAR}`)，避免明文存储
- 多 Auth Profile 支持优先级轮询、冷却与故障转移

**工具执行安全**

- 敏感操作 (文件写入、Shell 命令) 需用户确认
- 支持 Docker 沙箱隔离；通过 `tools.alsoAllow` 控制工具白名单

**数据保护**

- 诊断输出自动脱敏密钥和 Token
- 会话隔离：每个用户/对话独立上下文
- 本地优先：数据不经过第三方中转服务器

**Windows 安全**

- 安装程序默认用户权限 (`PrivilegesRequired=lowest`)
- 计划任务以当前用户身份运行，注册表操作仅限 `HKCU`

---

## 许可证

[MIT License](https://github.com/itc-ou-shigou/winclaw/blob/main/LICENSE) -- Copyright (c) WinClaw Contributors
