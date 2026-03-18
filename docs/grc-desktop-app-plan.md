# GRC Desktop App 改造方案

> **文档版本**: v2.0
> **日期**: 2026-03-16
> **状态**: Draft — 待 Review
> **UI 方案**: Electron（与 Claude Code Desktop / WinClaw Desktop 一致）

---

## 1. 目标概述

将 GRC（Global Resource Center）从 Docker/云端部署模式改造为 **Windows 桌面应用程序**，实现：

- 用户通过 `.exe` 安装程序一键安装
- **SQLite 作为默认数据库**（零配置开箱即用）
- 可选切换到本地/云端 MySQL
- 前后端合并为单进程 Node.js 服务
- Electron 窗口壳连接 localhost 服务（与 Claude Code Desktop 相同模式）
- 与 WinClaw 本地 Gateway 无缝集成

---

## 2. 现状分析

### 2.1 当前架构

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────┐
│  Dashboard       │────▶│  Express API     │────▶│  MySQL   │
│  (Vite :3200)    │     │  (:3100)         │     │  (:3306) │
│  React 19        │     │  Drizzle ORM     │     │  8.0     │
└─────────────────┘     │  14 Modules      │     └──────────┘
                        │  JWT Auth        │
                        │  Zod Validation  │     ┌──────────┐
                        │                  │────▶│  Redis   │ (可选)
                        └─────────────────┘     └──────────┘
```

### 2.2 改造阻碍点

| 领域 | 问题 | 严重度 |
|------|------|--------|
| 数据库 | Drizzle Schema 使用 MySQL 方言（`mysqlTable`、`DEFAULT (UUID())`、JSON列、FULLTEXT索引） | **高** |
| 迁移脚本 | 12 个 SQL 文件全部为 MySQL 语法 | **高** |
| 连接池 | `mysql2/promise` 硬编码为 MySQL 驱动 | **高** |
| 自定义类型 | `datetimeUtc` 使用 MySQL DATETIME 格式 | **中** |
| 外部依赖 | Redis（可选）、Meilisearch（可选）、Azure Blob（可选） | **低** |
| 前后端分离 | 开发时 Vite :3200 → 代理到 :3100 | **低** |
| 部署模型 | Docker Compose 编排多容器 | **低** |

---

## 3. 整体架构设计

### 3.1 目标架构

采用与 Claude Code Desktop / WinClaw Desktop **完全一致**的混合架构：
**Electron（Chromium UI壳）+ Node.js 子进程（GRC 后端服务）+ localhost HTTP 通信**。

```
┌──────────────────────────────────────────────────────────┐
│                    GRC Desktop App                        │
│                                                          │
│  ┌─────────────────────────────────────────────┐         │
│  │          Electron 主进程 (main.js)            │         │
│  │                                              │         │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐ │         │
│  │  │ 窗口管理  │  │ 系统托盘  │  │  GRC 后端   │ │         │
│  │  │ BrowserWin│  │ Tray Icon│  │ 进程管理    │ │         │
│  │  └─────┬────┘  └──────────┘  └──────┬─────┘ │         │
│  │        │                            │        │         │
│  └────────┼────────────────────────────┼────────┘         │
│           │ loads                       │ spawns           │
│           ▼                            ▼                  │
│  ┌─────────────────┐    ┌──────────────────────────┐      │
│  │  Chromium 渲染   │    │  Node.js 子进程           │      │
│  │  进程 (renderer) │    │  (GRC Express Server)    │      │
│  │                  │    │                          │      │
│  │  加载:            │    │  Express :3100           │      │
│  │  http://127.0.0.1│──▶│  ├── /api/* (REST API)  │      │
│  │  :3100/          │    │  ├── /auth/* (JWT Auth) │      │
│  │                  │    │  ├── /a2a/*  (Agent)    │      │
│  │  显示:            │    │  └── /*     (Dashboard  │      │
│  │  GRC Dashboard   │    │           静态资源)      │      │
│  └─────────────────┘    │                          │      │
│                          │  ┌─────────────────┐    │      │
│                          │  │  Database Layer  │    │      │
│                          │  │  ┌─────┐ ┌─────┐│    │      │
│                          │  │  │SQLite│ │MySQL││    │      │
│                          │  │  │默认  │ │可选 ││    │      │
│                          │  │  └─────┘ └─────┘│    │      │
│                          │  └─────────────────┘    │      │
│                          └──────────────────────────┘      │
│                                                          │
│  用户数据: %APPDATA%/GRC/                                  │
│  ├── grc.db           (SQLite 数据库)                      │
│  ├── config.json      (用户配置)                           │
│  ├── logs/            (日志文件)                           │
│  └── backups/         (自动备份)                           │
└──────────────────────────────────────────────────────────┘
```

### 3.2 架构关键决策

**为什么选 Electron 而非 WebView2：**

| 维度 | Electron | WebView2 (.NET) |
|------|----------|-----------------|
| 与现有项目一致性 | Claude Code Desktop、WinClaw Desktop 均使用 Electron | WinClaw 有 WebView2 但作为可选方案 |
| 跨平台潜力 | macOS / Linux 可复用 | 仅 Windows |
| 技术栈统一 | 全 JavaScript/TypeScript，与 GRC 后端一致 | 需要额外 C# / .NET 技能 |
| 原生能力 | Tray、菜单、快捷键、文件对话框、通知 — 全原生 API | 同等能力但需 WinForms 互操作 |
| Node.js 内嵌 | Electron 内嵌 Node.js，可直接 require 后端模块 | 需单独打包 Node.js 运行时 |
| 调试 | Chrome DevTools 内置 | 需额外工具 |
| 生态 | electron-builder、auto-updater、crash-reporter | 需自建更新机制 |

**核心模式（与 WinClaw Electron 完全一致）：**

1. Electron **不内嵌后端到 ASAR** — 后端独立部署在 `app/` 目录
2. Electron 主进程 **spawn Node.js 子进程** 运行 GRC Express 服务
3. BrowserWindow **加载 `http://127.0.0.1:3100/`**（不用 file:// 协议）
4. 通过 **健康检查轮询** 等待后端就绪后才显示窗口
5. UI 和服务端完全解耦 — 也可在浏览器中直接访问

---

## 4. 数据库层改造（核心工程）

### 4.1 Drizzle 多方言适配策略

Drizzle ORM 原生支持 MySQL 和 SQLite 两种方言，但 Schema 定义 API 不同：

```
drizzle-orm/mysql-core  → mysqlTable, varchar, int, json, ...
drizzle-orm/sqlite-core → sqliteTable, text, integer, blob, ...
```

**方案：抽象层 + 双 Schema**

```
src/shared/db/
├── adapter.ts              # 数据库适配器工厂
├── connection.ts           # 当前 MySQL 连接（保留）
├── connection-sqlite.ts    # 新增 SQLite 连接
├── dialect.ts              # 方言检测 & 切换
├── schema/
│   ├── mysql/              # 现有 MySQL Schema（保持不变）
│   │   ├── users.ts
│   │   ├── nodes.ts
│   │   └── ...
│   └── sqlite/             # 新增 SQLite Schema（等价映射）
│       ├── users.ts
│       ├── nodes.ts
│       └── ...
├── migrations/
│   ├── mysql/              # 现有 MySQL 迁移（移入子目录）
│   │   ├── 001_initial.sql
│   │   └── ...
│   └── sqlite/             # 新增 SQLite 迁移
│       ├── 001_initial.sql
│       └── ...
└── migrate.ts              # 适配多方言的迁移运行器
```

### 4.2 MySQL → SQLite 映射规则

| MySQL 特性 | SQLite 等价方案 | 备注 |
|------------|----------------|------|
| `VARCHAR(N)` | `TEXT` | SQLite 无长度限制 |
| `INT` / `BIGINT` | `INTEGER` | — |
| `DATETIME` | `TEXT` (ISO 8601) | 存储为 `2026-03-16T12:00:00.000Z` |
| `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` | `TEXT DEFAULT (datetime('now'))` | SQLite 函数语法 |
| `ON UPDATE CURRENT_TIMESTAMP` | 应用层触发器或 Drizzle hook | SQLite 无原生支持 |
| `DEFAULT (UUID())` | 应用层 `crypto.randomUUID()` | 在 service 层生成 |
| `JSON` 列 | `TEXT` + JSON序列化 | `JSON.parse/stringify` |
| `FULLTEXT INDEX` | FTS5 虚拟表 或 应用层 `LIKE` | 功能降级可接受 |
| `FOREIGN KEY ... CASCADE` | `PRAGMA foreign_keys = ON` + 同语法 | 需显式开启 |
| `CHARSET utf8mb4` | 默认 UTF-8 | 无需处理 |
| `BOOLEAN` | `INTEGER` (0/1) | Drizzle 自动映射 |
| `TEXT` (MySQL) | `TEXT` (SQLite) | 直接映射 |

### 4.3 适配器实现

```typescript
// src/shared/db/adapter.ts

import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import mysql from "mysql2/promise";

export type DbDialect = "mysql" | "sqlite";

export interface DbAdapter {
  dialect: DbDialect;
  db: ReturnType<typeof drizzleMysql> | ReturnType<typeof drizzleSqlite>;
  close(): Promise<void>;
}

export async function createDbAdapter(config: {
  dialect: DbDialect;
  mysqlUrl?: string;
  sqlitePath?: string;
}): Promise<DbAdapter> {
  if (config.dialect === "mysql") {
    const pool = mysql.createPool(config.mysqlUrl!);
    return {
      dialect: "mysql",
      db: drizzleMysql(pool),
      close: () => pool.end(),
    };
  }

  // SQLite (默认)
  const dbPath = config.sqlitePath ?? getDefaultSqlitePath();
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");

  return {
    dialect: "sqlite",
    db: drizzleSqlite(sqlite),
    close: async () => sqlite.close(),
  };
}

function getDefaultSqlitePath(): string {
  const appData = process.env.APPDATA
    || path.join(os.homedir(), "AppData", "Roaming");
  const dir = path.join(appData, "GRC");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "grc.db");
}
```

### 4.4 Schema 抽象方案（推荐：代码生成）

手动维护双 Schema 容易出现同步偏差。推荐方案：

```
MySQL Schema (source of truth)
        │
        ▼
   Code Generator (scripts/gen-sqlite-schema.ts)
        │
        ▼
SQLite Schema (auto-generated)
```

生成器负责：
- `mysqlTable` → `sqliteTable`
- `varchar(N)` → `text()`
- `int()` → `integer()`
- `datetime()` → `text()` + 自定义 `datetimeUtc` mapper
- `json()` → `text()` + JSON serialize/deserialize wrapper
- 移除 `FULLTEXT INDEX`、`ON UPDATE` 等不兼容语法

### 4.5 Service 层兼容处理

部分 Service 代码使用了 MySQL 特有的 SQL 功能，需要条件分支：

```typescript
// 示例: 搜索功能 (FULLTEXT vs LIKE)
export function searchSkills(query: string, dialect: DbDialect) {
  if (dialect === "mysql") {
    return db.execute(sql`
      SELECT * FROM skills
      WHERE MATCH(name, description) AGAINST(${query} IN BOOLEAN MODE)
    `);
  }
  // SQLite: LIKE 模糊搜索 (或 FTS5)
  return db.select().from(skills)
    .where(or(
      like(skills.name, `%${query}%`),
      like(skills.description, `%${query}%`),
    ));
}
```

**需要逐一排查的 MySQL 特有用法：**

| 模块 | 文件 | MySQL 特有用法 | SQLite 替代 |
|------|------|---------------|-------------|
| clawhub | skill 搜索 | `MATCH AGAINST` | `LIKE` / FTS5 |
| auth | token 过期清理 | `DATE_SUB(NOW(), ...)` | `datetime('now', '-N days')` |
| strategy | JSON 聚合 | `JSON_ARRAYAGG` | 应用层聚合 |
| telemetry | 时间分组 | `DATE_FORMAT` | `strftime()` |
| community | 投票计数 | `ON DUPLICATE KEY UPDATE` | `INSERT OR REPLACE` |
| model-keys | 加密存储 | `AES_ENCRYPT/DECRYPT` | Node.js `crypto` 模块 |

---

## 5. 前后端合并

### 5.1 静态资源内嵌

生产构建时将 Dashboard 的 Vite 输出嵌入 Express 服务：

```typescript
// src/index.ts (桌面模式)

import express from "express";
import path from "node:path";

const app = express();

// API 路由 (保持不变)
registerModules(app, config);

// 静态资源服务 (Dashboard 编译产物)
const dashboardDir = path.join(__dirname, "dashboard-dist");
app.use(express.static(dashboardDir));

// SPA fallback — 所有非 API 路由返回 index.html
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api") && !req.path.startsWith("/auth")) {
    res.sendFile(path.join(dashboardDir, "index.html"));
  }
});

app.listen(config.port, "127.0.0.1", () => {
  console.log(`GRC running at http://localhost:${config.port}`);
});
```

### 5.2 构建流程

```bash
# 1. 编译 Dashboard
cd dashboard && npm run build      # → dashboard/dist/

# 2. 拷贝到后端产物
cp -r dashboard/dist/ dist/dashboard-dist/

# 3. 编译后端 (TypeScript → JavaScript)
npm run build                      # → dist/

# 4. 打包 Electron + Server
npm run package:desktop            # → releases/GRCSetup-x.x.x.exe
```

---

## 6. Electron 桌面壳（与 Claude Code Desktop 同架构）

### 6.1 项目结构

参照 WinClaw 的 `apps/electron/` 结构：

```
apps/electron/
├── main.js              # Electron 主进程 (~500行)
│                        # - 窗口管理 (BrowserWindow)
│                        # - GRC Server 进程管理 (child_process.spawn)
│                        # - 系统托盘 (Tray)
│                        # - IPC 通信 (ipcMain)
│                        # - 配置读取 (%APPDATA%/GRC/config.json)
│                        # - 健康检查轮询 (http://127.0.0.1:3100/health)
├── preload.js           # 安全的 IPC 桥接 (contextBridge)
├── package.json         # Electron app manifest
├── assets/
│   ├── grc-icon.ico     # 窗口图标
│   ├── grc-icon.png     # Tray 图标 (16x16, 32x32)
│   └── splash.html      # 启动加载页 (可选)
└── build/
    └── electron-builder.yml  # 打包配置
```

### 6.2 主进程核心实现 (main.js)

```javascript
// apps/electron/main.js
// 完全参照 WinClaw apps/electron/main.js 的架构

const { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const os = require("os");

// ─── 常量 ──────────────────────────────────────────────────
const APP_NAME = "GRC";
const DEFAULT_PORT = 3100;
const DATA_DIR = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "GRC",
);
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

let mainWindow = null;
let tray = null;
let serverProcess = null;
let serverPort = DEFAULT_PORT;

// ─── 1. 配置读取 ──────────────────────────────────────────
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {}
  return { server: { port: DEFAULT_PORT }, database: { dialect: "sqlite" } };
}

// ─── 2. GRC Server 进程管理 ────────────────────────────────
// 与 WinClaw main.js 的 startGateway() 完全同模式

function findNodeExe() {
  // 优先级:
  // 1. 安装目录下的便携 Node.js (node/node.exe)
  const embeddedNode = path.join(app.getAppPath(), "..", "node", "node.exe");
  if (fs.existsSync(embeddedNode)) return embeddedNode;

  // 2. 系统 Node.js (PATH 中)
  // 3. Electron 内嵌的 Node.js (fallback)
  return process.execPath;
}

function startServer() {
  const config = loadConfig();
  serverPort = config.server?.port || DEFAULT_PORT;

  const nodeExe = findNodeExe();
  const serverEntry = path.join(app.getAppPath(), "..", "server", "dist", "index.js");

  // 确保数据目录存在
  fs.mkdirSync(DATA_DIR, { recursive: true });

  serverProcess = spawn(nodeExe, [serverEntry], {
    env: {
      ...process.env,
      PORT: String(serverPort),
      NODE_ENV: "production",
      GRC_DB_DIALECT: config.database?.dialect || "sqlite",
      GRC_DATA_DIR: DATA_DIR,
      // SQLite 路径
      DATABASE_URL: config.database?.dialect === "mysql"
        ? config.database.mysql?.url
        : undefined,
      GRC_SQLITE_PATH: path.join(DATA_DIR, "grc.db"),
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,  // 与 Electron 生命周期绑定
  });

  // 日志写入文件
  const logStream = fs.createWriteStream(path.join(DATA_DIR, "logs", "server.log"), { flags: "a" });
  serverProcess.stdout?.pipe(logStream);
  serverProcess.stderr?.pipe(logStream);

  serverProcess.on("exit", (code) => {
    console.log(`[GRC] Server exited with code ${code}`);
    serverProcess = null;
  });
}

// ─── 3. 健康检查轮询 ──────────────────────────────────────
// 与 WinClaw main.js 的 waitForGateway() 同模式

function waitForServer(maxRetries = 30, intervalMs = 2000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      http.get(`http://127.0.0.1:${serverPort}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      }).on("error", retry);
    };

    function retry() {
      if (++attempts >= maxRetries) {
        reject(new Error("Server failed to start within 60 seconds"));
        return;
      }
      setTimeout(check, intervalMs);
    }

    check();
  });
}

// ─── 4. 窗口管理 ──────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, "assets", "grc-icon.ico"),
    title: "GRC - Global Resource Center",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
    show: false,   // 等服务就绪后再显示
  });

  // 加载 GRC Dashboard (http://localhost:3100)
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // 最小化到托盘而非退出
  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // 外部链接用系统浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ─── 5. 系统托盘 ──────────────────────────────────────────

function createTray() {
  tray = new Tray(path.join(__dirname, "assets", "grc-icon.png"));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "打开 GRC Dashboard",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "在浏览器中打开",
      click: () => shell.openExternal(`http://127.0.0.1:${serverPort}/`),
    },
    { type: "separator" },
    {
      label: `服务端口: ${serverPort}`,
      enabled: false,
    },
    {
      label: "数据库设置...",
      click: () => showDbSettingsDialog(),
    },
    {
      label: "打开数据目录",
      click: () => shell.openPath(DATA_DIR),
    },
    {
      label: "查看日志",
      click: () => shell.openPath(path.join(DATA_DIR, "logs")),
    },
    { type: "separator" },
    {
      label: "重启服务",
      click: () => restartServer(),
    },
    {
      label: "退出",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("GRC - Global Resource Center");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

// ─── 6. 数据库设置对话框 ──────────────────────────────────

function showDbSettingsDialog() {
  const config = loadConfig();
  const currentDialect = config.database?.dialect || "sqlite";

  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "数据库设置",
    message: `当前数据库: ${currentDialect === "sqlite" ? "SQLite (本地)" : "MySQL (远程)"}`,
    detail: currentDialect === "sqlite"
      ? `数据库文件: ${path.join(DATA_DIR, "grc.db")}`
      : `连接: ${config.database?.mysql?.url || "未配置"}`,
    buttons: ["切换到 MySQL", "切换到 SQLite", "取消"],
  }).then(({ response }) => {
    if (response === 0) switchToMysql();
    if (response === 1) switchToSqlite();
  });
}

// ─── 7. 应用生命周期 ──────────────────────────────────────

app.whenReady().then(async () => {
  // 1. 启动 GRC Server 子进程
  startServer();

  // 2. 等待服务就绪
  try {
    await waitForServer();
  } catch (err) {
    dialog.showErrorBox("GRC 启动失败", err.message);
    app.quit();
    return;
  }

  // 3. 创建窗口和托盘
  createMainWindow();
  createTray();
});

app.on("before-quit", () => {
  // 优雅关闭 GRC Server
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
  }
});

// 单实例锁定 (防止重复打开)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
```

### 6.3 Preload 脚本

```javascript
// apps/electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("grcDesktop", {
  // 暴露给 Dashboard 前端的安全 API
  platform: process.platform,
  showMenu: (x, y) => ipcRenderer.send("show-context-menu", x, y),
  getVersion: () => ipcRenderer.invoke("get-version"),
  openExternal: (url) => ipcRenderer.send("open-external", url),
  onServerRestart: (callback) => ipcRenderer.on("server-restarting", callback),
});
```

### 6.4 Electron package.json

```json
{
  "name": "grc-desktop",
  "version": "1.0.0",
  "description": "GRC - Global Resource Center Desktop",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "package": "electron-packager . grc --platform=win32 --arch=x64 --overwrite --out=../../dist/electron-out --icon=assets/grc-icon.ico --prune=true --asar"
  },
  "dependencies": {
    "electron": "^33.0.0"
  },
  "devDependencies": {
    "electron-packager": "^17.1.2"
  }
}
```

### 6.5 与 WinClaw Electron 的对照

| 特性 | WinClaw Electron | GRC Electron |
|------|-----------------|-------------|
| 管理的子进程 | `winclaw gateway` | `node dist/index.js` (Express) |
| 加载的 URL | `http://127.0.0.1:18789/` | `http://127.0.0.1:3100/` |
| 健康检查 | `/health` (30 次重试) | `/health` (30 次重试) |
| 进程生命周期 | detached（可脱离 Electron 运行） | 非 detached（与 Electron 绑定） |
| 系统托盘 | 有（网关状态显示） | 有（数据库设置、日志） |
| 单实例锁 | 有 | 有 |
| Node.js 发现 | 系统 Node → Electron 内置 | 内嵌 Node → 系统 Node → Electron 内置 |
| 配置文件 | `~/.winclaw/winclaw.json` | `%APPDATA%/GRC/config.json` |

**关键差异**：GRC 的子进程设为 `detached: false`，因为 GRC 服务不需要在 Electron 退出后继续运行（不像 WinClaw Gateway 需要持久在线）。

---

## 7. 安装程序（Inno Setup）

参照 WinClaw 的 `scripts/windows-installer.iss`，创建 GRC 安装脚本。

### 7.1 安装目录结构

```
{app}\                           安装目录 (例: C:\Users\USER\AppData\Local\Programs\GRC)
├── desktop\                     Electron 壳 (electron-packager 输出)
│   ├── grc.exe                  Electron 主入口 (~120MB, 含 Chromium)
│   ├── resources\
│   │   └── app.asar             main.js + preload.js (打包后)
│   ├── locales\                 Chromium 多语言资源
│   └── ...                      Electron/Chromium 运行时文件
├── server\                      GRC Express 后端
│   ├── dist\                    TypeScript 编译产物
│   │   ├── index.js             入口
│   │   ├── modules\             14个模块
│   │   └── shared\              共享层
│   ├── dashboard-dist\          Vite 前端编译产物
│   │   ├── index.html
│   │   ├── assets\
│   │   └── locales\             i18n (en, ja, zh, ko)
│   ├── node_modules\            生产依赖 (精简后)
│   └── package.json
├── node\                        内嵌 Node.js 运行时
│   └── node.exe                 Node.js 22 LTS (便携版)
├── assets\
│   ├── grc-icon.ico
│   └── grc.cmd                  CLI 启动脚本 (可选)
└── uninstall.exe                Inno Setup 卸载器
```

### 7.2 安装脚本

```ini
; scripts/grc-windows-installer.iss

#define AppName "GRC"
#define AppFullName "GRC - Global Resource Center"
#define AppVersion GetStringFileInfo("dist\electron-out\grc-win32-x64\grc.exe", "FileVersion")
#define AppPublisher "ITC CloudSoft"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#AppFullName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppFullName}
OutputBaseFilename=GRCSetup-{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=lowest
MinVersion=10.0.17763
SetupIconFile=assets\grc-icon.ico
UninstallDisplayIcon={app}\desktop\grc.exe
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "japanese"; MessagesFile: "compiler:Languages\Japanese.isl"
Name: "chinesesimplified"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "autostart"; Description: "开机自启动 (Start with Windows)"

[Files]
; Electron desktop shell
Source: "dist\electron-out\grc-win32-x64\*"; DestDir: "{app}\desktop"; \
  Flags: ignoreversion recursesubdirs createallsubdirs

; GRC server (Express + Dashboard)
Source: "dist\server\*"; DestDir: "{app}\server"; \
  Flags: ignoreversion recursesubdirs createallsubdirs

; Embedded Node.js
Source: "dist\node\*"; DestDir: "{app}\node"; \
  Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppFullName}"; Filename: "{app}\desktop\grc.exe"; IconFilename: "{app}\assets\grc-icon.ico"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\desktop\grc.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\desktop\grc.exe"; Description: "启动 GRC"; Flags: nowait postinstall skipifsilent

[Registry]
; 开机自启动
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "GRC"; \
  ValueData: """{app}\desktop\grc.exe"" --background"; \
  Flags: uninsdeletevalue; Tasks: autostart

[UninstallRun]
; 卸载时停止服务
Filename: "taskkill"; Parameters: "/F /IM grc.exe"; Flags: runhidden; RunOnceId: "StopGrc"
Filename: "taskkill"; Parameters: "/F /IM node.exe"; Flags: runhidden; RunOnceId: "StopNode"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
```

### 7.3 安装包体积预估

| 组件 | 原始体积 | 压缩后 |
|------|---------|--------|
| Electron 壳 (Chromium + Node.js) | ~180 MB | ~65 MB |
| GRC Server (dist + node_modules) | ~80 MB | ~25 MB |
| Dashboard 前端 (Vite build) | ~5 MB | ~2 MB |
| 内嵌 Node.js 22 运行时 | ~45 MB | ~15 MB |
| better-sqlite3 原生模块 | ~5 MB | ~2 MB |
| **安装包总计** | **~315 MB** | **~109 MB** |

> 与 WinClaw Electron 安装包 (111 MB) 体积相当。

### 7.4 瘦身优化（参照 WinClaw windows-installer.ps1）

WinClaw 的打包脚本在 npm install 后会执行 bloat 清理，GRC 同样适用：

```powershell
# scripts/package-desktop.ps1 (参照 WinClaw 的 windows-installer.ps1)

# 1. 删除不需要的 native addon 变体
Remove-Item -Recurse -Force "server\node_modules\*cuda*", "*vulkan*", "*arm64*"

# 2. 删除开发文件
Get-ChildItem -Recurse -Include "*.ts","*.map","*.md","LICENSE*","CHANGELOG*" |
  Where { $_.FullName -notlike "*dashboard-dist*" } |
  Remove-Item -Force

# 3. 删除测试文件
Get-ChildItem -Recurse -Directory -Filter "test" | Remove-Item -Recurse -Force
Get-ChildItem -Recurse -Directory -Filter "__tests__" | Remove-Item -Recurse -Force

# 4. 删除 @types (运行时不需要)
Get-ChildItem "server\node_modules\@types" -Directory |
  Remove-Item -Recurse -Force

# 5. 清理 Node.js 便携版 (移除 npm, corepack, 文档)
Remove-Item -Recurse -Force "node\lib", "node\include", "node\share"
Remove-Item -Force "node\npm*", "node\corepack*", "node\npx*"
```

---

## 8. 配置与数据管理

### 8.1 配置文件

```jsonc
// %APPDATA%/GRC/config.json
{
  "server": {
    "port": 3100,
    "host": "127.0.0.1"
  },
  "database": {
    "dialect": "sqlite",           // "sqlite" | "mysql"
    "sqlite": {
      "path": "%APPDATA%/GRC/grc.db"
    },
    "mysql": {
      "url": "mysql://root:password@localhost:3306/grc-server"
    }
  },
  "auth": {
    "jwtExpiresIn": "15m",
    "refreshExpiresIn": "30d"
  },
  "modules": {
    "community": true,
    "clawhub": true,
    "evolution": true,
    "meetings": true
  },
  "winclaw": {
    "autoConnect": true,
    "gatewayUrl": "http://localhost:18789"
  }
}
```

### 8.2 数据库切换流程

```
用户选择 "切换到 MySQL" (Tray → 数据库设置)
        │
        ▼
  ┌───────────────┐
  │  输入 MySQL URL │  ← Electron dialog.showInputBox
  │  测试连接       │
  └───────┬───────┘
          │ 连接成功
          ▼
  ┌───────────────┐
  │  运行 MySQL    │  ← 自动执行 migrations/mysql/*.sql
  │  迁移脚本      │
  └───────┬───────┘
          │
          ▼
  ┌───────────────┐
  │  提供数据迁移   │  ← 可选：SQLite → MySQL 数据导出/导入
  │  选项          │
  └───────┬───────┘
          │
          ▼
  ┌───────────────┐
  │  更新 config   │  ← 写入 config.json
  │  重启 Server   │  ← kill + re-spawn 子进程
  │  重载窗口      │  ← mainWindow.reload()
  └───────────────┘
```

### 8.3 自动备份

```typescript
// SQLite 模式下的自动备份 (使用 VACUUM INTO)
async function autoBackup(dbPath: string) {
  const backupDir = path.join(path.dirname(dbPath), "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `grc-${timestamp}.db`);

  const db = new Database(dbPath, { readonly: true });
  db.exec(`VACUUM INTO '${backupPath}'`);
  db.close();

  // 保留最近 7 个备份
  cleanOldBackups(backupDir, 7);
}
```

---

## 9. 实施计划

### Phase 1: 数据库抽象层（2-3 周）

| 任务 | 工时 | 优先级 |
|------|------|--------|
| 创建 `DbAdapter` 工厂和方言检测 | 2d | P0 |
| 编写 SQLite Schema（从 MySQL Schema 映射） | 3d | P0 |
| 编写 SQLite 迁移脚本（12个文件） | 3d | P0 |
| 替换 `datetimeUtc` 自定义类型为方言感知版本 | 1d | P0 |
| 排查并修复 Service 层 MySQL 特有 SQL | 3d | P0 |
| 创建 Schema 代码生成器 | 2d | P1 |
| 单元测试（SQLite 模式下全模块） | 3d | P0 |

**交付物**: GRC 可以在 SQLite 模式下完整运行所有模块

### Phase 2: 前后端合并（1 周）

| 任务 | 工时 | 优先级 |
|------|------|--------|
| Dashboard 嵌入到 Express 静态服务 | 1d | P0 |
| SPA fallback 路由 | 0.5d | P0 |
| 环境变量驱动的 API baseUrl 消除 | 0.5d | P0 |
| 生产构建脚本（build-desktop.sh） | 1d | P0 |
| 移除 Vite proxy 依赖 | 0.5d | P1 |
| 端到端测试 | 1d | P0 |

**交付物**: `node dist/index.js` 单命令启动包含 Dashboard 的完整 GRC

### Phase 3: Electron 桌面壳（1-2 周）

| 任务 | 工时 | 优先级 |
|------|------|--------|
| 创建 Electron 项目 (main.js, preload.js, package.json) | 1d | P0 |
| 实现 Server 子进程管理 (spawn, health check, restart) | 2d | P0 |
| 系统托盘图标 & 右键菜单 | 1d | P0 |
| 首次启动向导（初始用户创建、SQLite 初始化） | 1d | P0 |
| 数据库切换对话框 (SQLite ↔ MySQL) | 1d | P1 |
| 窗口大小记忆、最小化到托盘、单实例锁 | 0.5d | P1 |
| electron-packager 打包脚本 | 0.5d | P0 |
| 图标 & 品牌资源 | 0.5d | P2 |

**交付物**: `grc.exe` 可独立运行，双击启动完整 GRC

### Phase 4: 安装程序 & 打包（1 周）

| 任务 | 工时 | 优先级 |
|------|------|--------|
| Inno Setup 安装脚本 (参照 WinClaw windows-installer.iss) | 1d | P0 |
| 打包脚本 (package-desktop.ps1) — npm install + bloat清理 | 1d | P0 |
| 内嵌 Node.js 便携版 + better-sqlite3 预编译 | 0.5d | P0 |
| 首次启动数据库自动初始化 (迁移脚本执行) | 1d | P0 |
| 卸载清理逻辑 (停止进程、可选删除数据) | 0.5d | P1 |
| 自动更新 (electron-updater, 可选) | 2d | P2 |

**交付物**: `GRCSetup-1.0.0.exe` 一键安装

### Phase 5: 集成测试 & 优化（1 周）

| 任务 | 工时 | 优先级 |
|------|------|--------|
| Windows 10/11 兼容性测试 | 1d | P0 |
| SQLite 性能基准（vs MySQL） | 1d | P1 |
| WinClaw Gateway 联调 | 1d | P0 |
| 数据库切换（SQLite ↔ MySQL）E2E 测试 | 1d | P0 |
| Electron 内存 & 启动时间优化 | 0.5d | P1 |
| 安装/卸载/升级回归测试 | 0.5d | P0 |

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| MySQL JSON 函数在 SQLite 中无等价 | 部分查询需重写 | 在 Service 层做条件分支；JSON 操作改为应用层 |
| better-sqlite3 原生模块编译 | Windows 上需 C++ 编译工具 | 使用预编译 binary（`prebuild-install`）；安装包直接附带 |
| FULLTEXT 搜索降级 | ClawHub 搜索体验下降 | SQLite FTS5 虚拟表提供近似功能 |
| SQLite 并发写入限制 | 多用户场景性能 | WAL 模式 + 单用户桌面场景影响小；重度用户建议切 MySQL |
| Electron 体积 (~120MB) | 安装包偏大 | LZMA2 压缩后 ~65MB；可接受（与 Claude Code Desktop 体积相当） |
| Electron 内存占用 (~150MB) | 桌面资源消耗 | Chromium 进程共享；最小化到托盘时占用降低 |
| Node.js 版本兼容 | Electron 内嵌 Node 20 vs 项目需要 Node 22 | 内嵌独立 Node.js 22 便携版，不依赖 Electron 的 Node |

---

## 11. 可选增强

### 11.1 electron-builder 替代 electron-packager

如需自动更新、安装程序签名等高级功能，可升级到 `electron-builder`：

```yaml
# build/electron-builder.yml
appId: com.itccloudsoft.grc
productName: GRC
directories:
  output: ../../releases
win:
  target:
    - target: nsis
      arch: [x64]
  icon: assets/grc-icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  runAfterFinish: true
publish:
  provider: github
  owner: itccloudsoft
  repo: grc
```

### 11.2 自动发现本地 WinClaw

```javascript
// Electron main.js — 启动时探测
async function discoverLocalWinClaw() {
  try {
    const res = await fetch("http://localhost:18789/healthz");
    if (res.ok) return "http://localhost:18789";
  } catch {}
  return null;
}
```

### 11.3 Splash Screen（启动加载页）

```javascript
// 在服务启动等待期间显示 splash
function showSplash() {
  const splash = new BrowserWindow({
    width: 400, height: 300,
    frame: false, transparent: true,
    alwaysOnTop: true,
  });
  splash.loadFile(path.join(__dirname, "assets", "splash.html"));
  return splash;
}

app.whenReady().then(async () => {
  const splash = showSplash();
  startServer();
  await waitForServer();
  splash.close();
  createMainWindow();
  createTray();
});
```

### 11.4 数据导入/导出

```typescript
// SQLite → MySQL 迁移工具
async function migrateData(from: DbAdapter, to: DbAdapter) {
  const tables = ["users", "nodes", "skills", "roles", ...];
  for (const table of tables) {
    const rows = await from.db.select().from(table);
    await to.db.insert(table).values(rows);
  }
}
```

---

## 12. 对比总结

| 维度 | 当前 (Docker) | 桌面版 (目标) |
|------|--------------|-------------|
| 安装难度 | `docker-compose up` + 配置 | 双击 `.exe`，一路 Next |
| 数据库 | MySQL 8.0（必须） | SQLite（默认）/ MySQL（可选） |
| 外部依赖 | Docker, MySQL, Redis | 无（Electron + Node.js 全内嵌） |
| 启动时间 | 容器拉取 + 初始化 ~2min | 双击后 ~5s（含服务启动） |
| UI 渲染 | 浏览器 | Electron (Chromium) 原生窗口 |
| 系统集成 | 无 | 系统托盘、开机自启、通知 |
| 适用场景 | 团队/企业服务器 | 个人/小团队本地使用 |
| 更新方式 | `docker pull` + 重启 | 安装器覆盖安装 / electron-updater |
| 数据位置 | Docker Volume | `%APPDATA%/GRC/` |
| 内存占用 | ~500MB (MySQL+Redis+Node) | ~200MB (Electron+Node+SQLite) |
| 安装包体积 | ~2GB (Docker images) | **~109 MB** (安装包) |
| 跨平台 | 任何 Docker 环境 | Windows（可扩展 macOS/Linux） |

---

## 附录 A: 依赖变更

### 新增依赖 (GRC 后端)

```json
{
  "better-sqlite3": "^11.0.0",
  "drizzle-orm": "^0.39.0"       // 已有，需同时引入 sqlite-core
}
```

### 新增依赖 (Electron 壳)

```json
{
  "electron": "^33.0.0",
  "electron-packager": "^17.1.2"
}
```

### 可选移除依赖（SQLite 桌面模式下）

```json
{
  "mysql2": "保留（MySQL 模式仍需）",
  "ioredis": "可选移除（桌面模式用内存缓存替代）",
  "meilisearch": "可选移除（桌面模式用 SQLite FTS5）",
  "@azure/storage-blob": "可选移除（桌面模式用本地文件存储）"
}
```

---

## 附录 B: 与 Claude Code Desktop 的架构对照

```
Claude Code Desktop          GRC Desktop
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Electron main.js             Electron main.js
    │                            │
    ├─ spawn 子进程               ├─ spawn 子进程
    │  └─ claude-code CLI        │  └─ node dist/index.js
    │     (交互式 REPL)           │     (Express HTTP 服务)
    │                            │
    ├─ BrowserWindow             ├─ BrowserWindow
    │  └─ 加载内置 UI              │  └─ 加载 http://localhost:3100
    │                            │
    ├─ Tray Icon                 ├─ Tray Icon
    │                            │
    └─ 数据: ~/.claude/           └─ 数据: %APPDATA%/GRC/

共同点:
  ✓ Electron 仅作 UI 壳，不嵌入业务逻辑
  ✓ 子进程管理 (spawn + health check)
  ✓ contextIsolation: true, nodeIntegration: false
  ✓ 单实例锁 (requestSingleInstanceLock)
  ✓ 系统托盘
  ✓ Inno Setup / electron-packager 打包

差异点:
  △ Claude: 子进程为交互式 CLI (stdin/stdout)
  △ GRC:    子进程为 HTTP 服务 (localhost:3100)
  △ Claude: 自建 UI 渲染
  △ GRC:    加载已有 React Dashboard via HTTP
```
