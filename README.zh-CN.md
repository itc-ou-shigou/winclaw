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

1. 从 [GitHub Releases](https://github.com/itc-ou-shigou/winclaw/releases/latest) 下载 `WinClawSetup-{version}.exe`（也可从本仓库 [`releases/`](releases/) 目录获取）
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

| 技能 | 图标 | 功能 |
|------|------|------|
| `winclaw-setup` | ⚙️ | Gateway 核心设置：端口、认证令牌、TLS、AI 模型、主题、日志 |
| `winclaw-channels` | 🔗 | 添加、删除、启用/禁用消息渠道，管理 DM/群组策略 |
| `winclaw-agents` | 🤖 | 创建和配置 AI 代理：模型、人设、工作区、思考级别 |
| `winclaw-cron` | ⏰ | 调度定期任务：每日报告、提醒、定期检查 |
| `winclaw-status` | 📊 | 查看系统状态、使用统计、已连接渠道、活跃会话 |
| `winclaw-sns-wizard` | 📲 | 逐步引导连接 19 个支持平台中的任意一个 |

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
