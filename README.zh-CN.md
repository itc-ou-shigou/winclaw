# WinClaw -- 个人AI助手

[![CI](https://github.com/itc-ou-shigou/winclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/itc-ou-shigou/winclaw/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/itc-ou-shigou/winclaw)](https://github.com/itc-ou-shigou/winclaw/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/itc-ou-shigou/winclaw/blob/main/LICENSE)
[![npm](https://img.shields.io/npm/v/openclaw)](https://www.npmjs.com/package/openclaw)

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

| 选项 | 说明 | 默认 |
|------|------|------|
| 创建桌面快捷方式 | 在桌面生成 WinClaw 图标 | 否 |
| 添加到 PATH | 将 WinClaw 加入用户环境变量 | 是 |
| 安装 Gateway 守护进程 | 注册 Windows 任务计划程序任务，开机自启 | 是 |

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

认证配置文件位于 `%USERPROFILE%\.openclaw\agents\main\agent\auth-profiles.json`，也可直接编辑此文件。

### 方法二：PowerShell 一键安装

```powershell
irm https://raw.githubusercontent.com/itc-ou-shigou/winclaw/main/install.ps1 | iex
```

自动检测环境、安装 Node.js、通过 npm 安装 WinClaw 并启动引导向导。

### 方法三：npm 安装（已安装 Node.js 的情况）

```bash
npm install -g openclaw@latest
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
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

- **macOS**：守护进程通过 launchd 注册为 `ai.openclaw.gateway`
- **Linux**：守护进程通过 systemd 注册为 `openclaw-gateway.service`

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
openclaw onboard --install-daemon

# 2. 启动网关
openclaw gateway --port 18789 --verbose

# 3. 打开控制面板
openclaw dashboard

# 4. 发送测试消息
openclaw agent --message "你好" --thinking high

# 5. 启动终端交互界面
openclaw tui
```

### 主要 CLI 命令

| 命令 | 说明 |
|------|------|
| `winclaw onboard` | 引导设置向导 |
| `winclaw gateway` | 启动网关服务 |
| `winclaw dashboard` | 打开控制面板（自动带令牌） |
| `winclaw agent --message "..."` | 发送单条消息 |
| `winclaw daemon install / status / restart` | 守护进程管理 |
| `winclaw doctor` | 诊断配置问题 |
| `winclaw tui` | 终端交互界面 |
| `winclaw models auth login` | 刷新 AI 模型认证令牌 |
| `winclaw config get <key>` | 查看配置项 |
| `winclaw config set <key> <value>` | 修改配置项 |

---

## 配置说明

### 配置文件路径

| 平台 | 路径 |
|------|------|
| Windows（所有安装方式） | `%USERPROFILE%\.openclaw\openclaw.json` |
| macOS / Linux | `~/.openclaw/openclaw.json` |

可通过 `OPENCLAW_CONFIG_PATH` 或 `OPENCLAW_STATE_DIR` 环境变量覆盖。

Windows 下的主要配置文件：

| 文件 | 路径 | 用途 |
|------|------|------|
| 主配置 | `%USERPROFILE%\.openclaw\openclaw.json` | Gateway、渠道、技能、代理设置 |
| 认证配置 | `%USERPROFILE%\.openclaw\agents\main\agent\auth-profiles.json` | AI 提供商令牌（Anthropic、OpenAI 等） |
| 渠道凭据 | `%USERPROFILE%\.openclaw\credentials\` | WhatsApp 会话等渠道认证数据 |
| 会话记录 | `%USERPROFILE%\.openclaw\agents\main\sessions\` | 对话会话历史 |

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

| 配置项 | 说明 |
|--------|------|
| `agent.model` | AI 模型标识 (`claude-sonnet-4-20250514`, `gpt-4o` 等) |
| `agent.apiKey` | 模型 API 密钥 |
| `agent.systemPrompt` | 自定义系统提示词 |
| `channels.<id>.enabled` | 启用/禁用指定消息渠道 |
| `gateway.port` | 网关监听端口，默认 18789 |
| `skills.entries` | 技能加载配置 |
| `skills.dynamicFilter` | 动态技能加载配置 |

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

## Windows 专属功能

### Windows 原生技能

| 技能 | 说明 |
|------|------|
| `windows-office` | 创建/编辑 Word、Excel、PowerPoint (python-docx, openpyxl, python-pptx)，可选 COM 支持 PDF 导出 |
| `windows-system` | 系统管理：服务、进程、注册表、事件日志、计划任务 (PowerShell) |
| `windows-explorer` | 文件操作：递归搜索、批量重命名、压缩解压、剪贴板 |
| `windows-outlook` | 通过 Outlook COM Automation 发送/读取邮件 |

### PowerShell 脚本支持

技能脚本同时提供 `.sh` 和 `.ps1` 版本，Windows 上自动使用 PowerShell 执行。

### Windows 包管理器

| 管理器 | 用途 |
|--------|------|
| `winget` | Windows 原生包管理器 |
| `scoop` | 便携式包管理器，面向开发者 |
| `choco` | Chocolatey，企业级包管理 |
| `pip` | Python 包 (Office 技能等) |

### Gateway 守护进程 (schtasks)

- 任务名称：`OpenClaw Gateway`，用户登录时自动启动
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

| 渠道 | 配置键 | 协议 |
|------|--------|------|
| WhatsApp | `channels.whatsapp` | WhatsApp Web (Baileys) |
| Telegram | `channels.telegram` | Telegram Bot API |
| Slack | `channels.slack` | Slack Events API / Socket Mode |
| Discord | `channels.discord` | Discord Bot API |
| Google Chat | `channels.googlechat` | Google Chat API |
| Signal | `channels.signal` | Signal CLI / API |
| iMessage | `channels.imessage` | BlueBubbles / AppleScript (macOS) |
| Microsoft Teams | `channels.msteams` | Microsoft Graph API |
| Matrix | `channels.matrix` | Matrix Client-Server API |
| Zalo | `channels.zalo` | Zalo OA API |
| WebChat | `channels.webchat` | 内置 Web 界面 |

每个渠道需配置 `enabled`、认证凭据和允许列表 (`allowFrom`)。详见[官方文档](https://github.com/itc-ou-shigou/winclaw/tree/main/docs)。

---

## 技能系统

每个技能是一个 `SKILL.md` 文件，包含名称、描述、前置条件和使用说明。

| 类型 | 位置 | 说明 |
|------|------|------|
| 内置技能 | `skills/` (安装目录) | 随 WinClaw 发布，开箱即用 |
| 托管技能 | `~/.openclaw/skills/` | 用户安装或社区获取 |
| 工作区技能 | 项目目录下 `.openclaw/skills/` | 项目级，跟随项目分发 |

内置 50+ 技能，涵盖：**生产力** (github, notion, obsidian, trello)、**编码** (coding-agent, canvas)、**多媒体** (openai-image-gen, video-frames, whisper-api)、**通信** (himalaya, discord, voice-call)、**系统** (windows-office/system/explorer/outlook)、**智能家居** (openhue, sonoscli)。

技能依赖通过多种包管理器自动安装：`npm`, `pip`, `brew`, `apt`, `winget`, `scoop`, `choco`。

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

前置条件：[Inno Setup 6+](https://jrsoftware.org/isinfo.php)、PowerShell 5.1+、pnpm 9+。

```powershell
# 完整构建（包含 pnpm build）
.\scripts\package-windows-installer.ps1

# 仅重新打包安装程序（复用已有构建产物，跳过 pnpm build）
.\scripts\rebuild-installer.ps1
```

构建流程：

1. 下载 Node.js 22 LTS 便携版到 `dist/cache/`
2. 运行 `pnpm build` 生成生产包（仅完整构建时执行）
3. 运行 `npm pack` 并解压到 `dist/win-staging/app/`
4. 复制 Node.js 运行时、启动脚本和资源到 `dist/win-staging/`
5. 使用 Inno Setup 编译 `scripts/windows-installer.iss` 为 `dist/WinClawSetup-{version}.exe`
6. 复制安装程序到 `releases/` 和 `C:\work\docs\`

Inno Setup 编译大约需要 30 分钟（因 node_modules 文件数量庞大）。

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
                            | Shell   |  | Skills  | | Channel   |
                            | Tools   |  | Engine  | | Tools     |
                            +---------+  +---------+ +-----------+
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

> WinClaw 的 npm 包名为 `openclaw`，这是历史名称，功能完全一致。
