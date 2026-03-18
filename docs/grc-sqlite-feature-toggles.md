# GRC Desktop (SQLite Mode) — 功能裁剪与开关方案

> **目标**: GRC 打包为 Windows Desktop App 后，默认使用 SQLite 作为嵌入式数据库。SQLite 的单写者模型、
> 无全文搜索引擎、JSON 查询性能有限等特性，要求对高数据量/高并发模块进行功能裁剪。
> **日期**: 2026-03-16
> **状态**: Draft — 待 Review

---

## 1. 现有模块清单与 SQLite 兼容性评估

GRC 后端共 **14 个功能模块**，每个模块已有环境变量开关（`GRC_MODULE_*`）。

| # | 模块 | 环境变量 | 默认值 | SQLite Desktop 建议 | 风险等级 | 原因 |
|---|------|---------|--------|---------------------|---------|------|
| 1 | **auth** | `GRC_MODULE_AUTH` | ✅ ON | ✅ ON | 低 | 用户表小，必须保留 |
| 2 | **strategy** | `GRC_MODULE_STRATEGY` | ✅ ON | ✅ ON | 低 | 核心功能，单公司单行数据 |
| 3 | **roles** | `GRC_MODULE_ROLES` | ✅ ON | ✅ ON | 低 | 角色模板数量有限 |
| 4 | **platform** | `GRC_MODULE_PLATFORM` | ✅ ON | ✅ ON | 低 | 平台价值观，数据量极小 |
| 5 | **model-keys** | `GRC_MODULE_MODEL_KEYS` | ✅ ON | ✅ ON | 低 | API Key 管理，必须保留 |
| 6 | **evolution** | `GRC_MODULE_EVOLUTION` | ✅ ON | ⚠️ **OFF** | **高** | 基因/胶囊池 + 8个 mediumtext MD 字段 + append-only 事件表无限增长 |
| 7 | **clawhub** | `GRC_MODULE_CLAWHUB` | ✅ ON | ⚠️ **OFF** | **高** | 技能市场依赖 Meilisearch 全文搜索 + Azure Blob 存储 + 下载计数高频写入 |
| 8 | **community** | `GRC_MODULE_COMMUNITY` | ❌ OFF | ❌ **OFF** | **高** | 论坛系统，6张表含大量 JSON 列，投票聚合、订阅推送，数据量无上限 |
| 9 | **telemetry** | `GRC_MODULE_TELEMETRY` | ✅ ON | ⚠️ **OFF** | **中** | 每节点每天一条遥测记录，append-only 时序数据，JSON 聚合查询重 |
| 10 | **update** | `GRC_MODULE_UPDATE` | ✅ ON | ⚠️ **OFF** | **中** | 客户端发布/更新管理，Desktop 版由安装程序自行管理更新 |
| 11 | **tasks** | `GRC_MODULE_TASKS` | ✅ ON | ⚠️ **可选** | **中** | 乐观锁 + 进度日志 append-only，中等数据量；小团队可保留 |
| 12 | **meetings** | `GRC_MODULE_MEETINGS` | ✅ ON | ⚠️ **可选** | **中** | 会议记录含 JSON 字段（议程/决策/行动项），中等数据量 |
| 13 | **relay** | `GRC_MODULE_RELAY` | ✅ ON | ✅ ON | 低 | A2A 消息队列，消息处理后清除，数据不会无限积累 |
| 14 | **a2a-gateway** | `GRC_MODULE_A2A_GATEWAY` | ✅ ON | ✅ ON | 低 | A2A 网关协议，无持久化数据 |

---

## 2. 推荐预设配置（Profiles）

### Profile A: **Desktop Lite**（推荐默认）
最小化配置，仅保留 GRC 核心管理功能。适合个人/小团队本地使用。

```env
# ===== Database =====
DATABASE_DRIVER=sqlite
DATABASE_URL=file:./data/grc.db

# ===== Core modules — ON =====
GRC_MODULE_AUTH=true
GRC_MODULE_STRATEGY=true
GRC_MODULE_ROLES=true
GRC_MODULE_PLATFORM=true
GRC_MODULE_MODEL_KEYS=true
GRC_MODULE_RELAY=true
GRC_MODULE_A2A_GATEWAY=true

# ===== Heavy modules — OFF =====
GRC_MODULE_EVOLUTION=false
GRC_MODULE_CLAWHUB=false
GRC_MODULE_COMMUNITY=false
GRC_MODULE_TELEMETRY=false
GRC_MODULE_UPDATE=false

# ===== Optional modules — OFF by default =====
GRC_MODULE_TASKS=false
GRC_MODULE_MEETINGS=false

# ===== External services — disabled =====
MEILISEARCH_URL=
REDIS_URL=
AZURE_STORAGE_ACCOUNT_NAME=
```

**保留功能**: 战略管理、角色模板、节点管理、模型密钥分发、A2A 消息中继
**关闭功能**: 基因进化池、技能市场、社区论坛、遥测统计、更新管理

### Profile B: **Desktop Full**
启用任务和会议模块，适合需要完整项目管理能力的团队。

```env
DATABASE_DRIVER=sqlite
DATABASE_URL=file:./data/grc.db

GRC_MODULE_AUTH=true
GRC_MODULE_STRATEGY=true
GRC_MODULE_ROLES=true
GRC_MODULE_PLATFORM=true
GRC_MODULE_MODEL_KEYS=true
GRC_MODULE_RELAY=true
GRC_MODULE_A2A_GATEWAY=true
GRC_MODULE_TASKS=true          # 启用任务管理
GRC_MODULE_MEETINGS=true       # 启用会议管理

GRC_MODULE_EVOLUTION=false
GRC_MODULE_CLAWHUB=false
GRC_MODULE_COMMUNITY=false
GRC_MODULE_TELEMETRY=false
GRC_MODULE_UPDATE=false
```

### Profile C: **Server (MySQL)**
完整功能，连接 MySQL + Meilisearch + Redis，适合云部署。

```env
DATABASE_DRIVER=mysql
DATABASE_URL=mysql://root:password@localhost:3306/grc

GRC_MODULE_AUTH=true
GRC_MODULE_STRATEGY=true
GRC_MODULE_ROLES=true
GRC_MODULE_PLATFORM=true
GRC_MODULE_MODEL_KEYS=true
GRC_MODULE_RELAY=true
GRC_MODULE_A2A_GATEWAY=true
GRC_MODULE_TASKS=true
GRC_MODULE_MEETINGS=true
GRC_MODULE_EVOLUTION=true
GRC_MODULE_CLAWHUB=true
GRC_MODULE_COMMUNITY=true
GRC_MODULE_TELEMETRY=true
GRC_MODULE_UPDATE=true

MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_KEY=your-key
REDIS_URL=redis://localhost:6379
```

---

## 3. 实现方案：数据库驱动层改造

### 3.1 新增 `DATABASE_DRIVER` 配置项

```typescript
// src/config.ts — 新增字段
export interface GrcConfig {
  database: {
    driver: "mysql" | "sqlite";    // 新增
    url: string;
    sqlitePath?: string;           // 新增: SQLite 文件路径
  };
  // ...
}

// loadConfig() 中：
database: {
  driver: envString("DATABASE_DRIVER", "mysql") as "mysql" | "sqlite",
  url: envString("DATABASE_URL", "mysql://root:Admin123@13.78.81.86:18306/grc-server"),
  sqlitePath: envString("SQLITE_PATH", "./data/grc.db"),
},
```

### 3.2 Drizzle ORM 双驱动支持

Drizzle ORM 原生支持 MySQL 和 SQLite，但 schema 定义语法不同。采用 **适配器模式**：

```
src/shared/db/
├── connection.ts          # 统一入口，根据 driver 选择
├── mysql-connection.ts    # 现有 MySQL 连接（mysql2 driver）
├── sqlite-connection.ts   # 新增 SQLite 连接（better-sqlite3）
├── schema/
│   ├── mysql/             # 现有 MySQL schema（不变）
│   └── sqlite/            # 新增 SQLite schema（类型映射）
└── migrations/
    ├── mysql/             # 现有 MySQL migrations
    └── sqlite/            # 新增 SQLite migrations
```

**关键类型映射**:

| MySQL 类型 | SQLite 类型 | 说明 |
|-----------|-------------|------|
| `int unsigned auto_increment` | `integer primary key autoincrement` | 主键 |
| `varchar(N)` | `text` | SQLite 无长度限制 |
| `mediumtext` | `text` | 无区别 |
| `json` | `text` | JSON 存为文本，用 `json_extract()` 查询 |
| `enum(...)` | `text check(...)` | CHECK 约束模拟 |
| `timestamp` | `text` | ISO 8601 字符串 |
| `boolean` | `integer` | 0/1 |

### 3.3 统一连接入口

```typescript
// src/shared/db/connection.ts
import { config } from "../../config.js";

export async function createDatabase() {
  if (config.database.driver === "sqlite") {
    const { createSqliteDb } = await import("./sqlite-connection.js");
    return createSqliteDb(config.database.sqlitePath!);
  } else {
    const { createMysqlDb } = await import("./mysql-connection.js");
    return createMysqlDb(config.database.url);
  }
}
```

---

## 4. 模块关闭的具体影响与替代方案

### 4.1 Evolution（基因进化池）— 关闭

| 影响 | 说明 |
|------|------|
| **节点管理** | 节点注册/心跳/配置推送 **不受影响**（节点表在 evolution 模块但属核心功能） |
| **基因/胶囊** | 无法创建/管理基因和胶囊 |
| **进化事件** | 无 append-only 事件日志 |
| **替代方案** | 节点相关表（`nodes`）应**迁出到独立的 `nodes` 模块**，与进化池解耦 |

> ⚠️ **重要**: 当前 `nodes` 表定义在 `evolution/schema.ts` 中。Desktop 模式必须把节点管理从 evolution 模块中**拆分**出来作为独立的核心模块，否则关闭 evolution 会导致节点管理不可用。

**拆分方案**:
```
src/modules/
├── nodes/           # 新增：从 evolution 拆出
│   ├── schema.ts    # nodes 表 + resolved_*_md 字段
│   ├── service.ts   # 节点注册/心跳/配置推送
│   └── routes.ts
├── evolution/       # 瘦身：仅保留基因/胶囊/事件
│   ├── schema.ts    # genes, capsules, asset_reports, evolution_events
│   ├── service.ts
│   └── routes.ts
```

### 4.2 ClawHub（技能市场）— 关闭

| 影响 | 说明 |
|------|------|
| **技能搜索/下载** | 不可用 |
| **Meilisearch** | 不需要部署 |
| **Azure Blob** | 不需要配置 |
| **替代方案** | 技能可通过本地文件系统管理（WinClaw 已支持本地 skills 目录） |

### 4.3 Community（社区论坛）— 关闭

| 影响 | 说明 |
|------|------|
| **论坛** | 不可用 |
| **替代方案** | Desktop 版不需要社区功能，个人/小团队使用场景无需论坛 |

### 4.4 Telemetry（遥测统计）— 关闭

| 影响 | 说明 |
|------|------|
| **使用统计** | 不收集节点遥测数据 |
| **报表** | 不可用 |
| **替代方案** | 简化版：在 Dashboard 上直接展示节点在线状态（已由 SSE 心跳提供） |

### 4.5 Update（更新管理）— 关闭

| 影响 | 说明 |
|------|------|
| **版本发布** | 不管理客户端发布 |
| **更新检查** | 不提供 |
| **替代方案** | Desktop 版由 exe 安装程序自带的 auto-updater 处理（Tauri/Electron 均有内置方案） |

---

## 5. Dashboard UI 改造

### 5.1 功能入口条件渲染

前端需根据后端返回的模块状态隐藏/显示导航项：

```typescript
// 后端已有端点: GET /api/v1/admin/modules/status
// 返回: { auth: true, evolution: false, clawhub: false, ... }

// 前端 Dashboard 侧边栏
const { data: modules } = useQuery({
  queryKey: ["modules-status"],
  queryFn: () => api.get("/admin/modules/status"),
});

// 导航菜单条件渲染
const navItems = [
  { key: "strategy",  label: t("nav.strategy"),  show: modules?.strategy },
  { key: "roles",     label: t("nav.roles"),     show: modules?.roles },
  { key: "nodes",     label: t("nav.nodes"),     show: true },  // 核心功能，始终显示
  { key: "evolution", label: t("nav.evolution"), show: modules?.evolution },
  { key: "clawhub",   label: t("nav.clawhub"),   show: modules?.clawhub },
  { key: "community", label: t("nav.community"), show: modules?.community },
  { key: "tasks",     label: t("nav.tasks"),     show: modules?.tasks },
  { key: "meetings",  label: t("nav.meetings"),  show: modules?.meetings },
  { key: "telemetry", label: t("nav.telemetry"), show: modules?.telemetry },
].filter(item => item.show);
```

### 5.2 新增 Settings 页面 — 数据库与模块配置

```
Settings (设置)
├── General (通用)
│   ├── Language (语言)
│   └── Theme (主题)
├── Database (数据库)                    ← 新增
│   ├── Current Driver: SQLite / MySQL
│   ├── SQLite 文件路径 (只读显示)
│   ├── 切换到 MySQL (输入连接字符串)
│   └── 数据迁移工具 (SQLite → MySQL)
├── Modules (功能模块)                   ← 新增
│   ├── 核心模块 (只读，始终启用)
│   │   ├── ✅ Auth
│   │   ├── ✅ Strategy
│   │   ├── ✅ Roles
│   │   ├── ✅ Platform
│   │   ├── ✅ Model Keys
│   │   ├── ✅ Relay
│   │   └── ✅ A2A Gateway
│   ├── 可选模块 (切换开关)
│   │   ├── 🔘 Tasks — 任务管理
│   │   └── 🔘 Meetings — 会议管理
│   └── 高级模块 (需 MySQL, 开关灰显)
│       ├── 🔒 Evolution — 需要 MySQL
│       ├── 🔒 ClawHub — 需要 MySQL + Meilisearch
│       ├── 🔒 Community — 需要 MySQL
│       ├── 🔒 Telemetry — 需要 MySQL
│       └── 🔒 Update — Desktop 版不适用
└── About (关于)
    ├── Version
    ├── Database driver & path
    └── Active modules count
```

---

## 6. 关闭功能的后端实现方式

### 6.1 现有机制（已可用）

GRC 的 `module-loader.ts` 已经支持模块的条件加载：

```typescript
// src/module-loader.ts (现有代码)
if (config.modules.evolution) {
  const mod = await import("./modules/evolution/routes.js");
  mod.registerRoutes(app);
}
// 模块未启用时，路由不注册，表不创建
```

**现有机制的不足**:
- 数据库迁移仍会创建所有表（包括已关闭模块的表）
- 前端侧边栏仍然显示所有导航项
- 没有 API 端点返回当前模块启用状态

### 6.2 需要新增的改造

#### A. 条件迁移（仅创建启用模块的表）

```typescript
// src/shared/db/migrator.ts — 新增
export async function runMigrations(db: Database, config: GrcConfig) {
  // 核心表始终创建
  await runCoreMigrations(db);  // auth, strategy, roles, platform, nodes, model_keys

  // 可选模块按配置创建
  if (config.modules.tasks)     await runModuleMigration(db, "tasks");
  if (config.modules.meetings)  await runModuleMigration(db, "meetings");
  if (config.modules.evolution) await runModuleMigration(db, "evolution");
  // ...
}
```

#### B. 模块状态 API

```typescript
// src/routes/admin.ts — 新增端点
app.get("/api/v1/admin/modules/status", (req, res) => {
  res.json({
    driver: config.database.driver,
    modules: config.modules,
    profiles: {
      current: detectProfile(config),  // "desktop-lite" | "desktop-full" | "server"
    },
  });
});
```

#### C. 模块热切换 API（可选，需重启）

```typescript
// PATCH /api/v1/admin/modules
// Body: { "tasks": true, "meetings": false }
// 效果: 更新 .env 文件，提示用户重启
app.patch("/api/v1/admin/modules", async (req, res) => {
  const updates = req.body as Partial<Record<string, boolean>>;
  await updateEnvFile(updates);
  res.json({ success: true, message: "请重启 GRC 以应用更改" });
});
```

---

## 7. SQLite 下的性能保护措施

即使启用了 Tasks / Meetings 模块，也需要以下保护：

### 7.1 数据量限制

```typescript
// src/shared/db/sqlite-guards.ts
export const SQLITE_LIMITS = {
  tasks: {
    maxActiveTasks: 500,        // 活跃任务上限
    maxProgressLogs: 10000,     // 进度日志上限（超出自动归档）
  },
  meetings: {
    maxMeetings: 200,           // 会议记录上限
    maxTranscriptSize: 50_000,  // 单条转写文本上限 (字符)
  },
};
```

### 7.2 自动归档

```typescript
// 定时任务: 每天凌晨清理超出限制的旧数据
async function archiveOldData(db: Database) {
  // 将超出限制的记录导出到 JSON 文件，然后从 SQLite 删除
  const oldLogs = await db.select().from(taskProgressLog)
    .orderBy(desc(taskProgressLog.createdAt))
    .offset(SQLITE_LIMITS.tasks.maxProgressLogs);

  if (oldLogs.length > 0) {
    await exportToJsonFile(oldLogs, `archive/task-logs-${Date.now()}.json`);
    await db.delete(taskProgressLog)
      .where(inArray(taskProgressLog.id, oldLogs.map(l => l.id)));
  }
}
```

### 7.3 WAL 模式启用

```typescript
// SQLite 连接时立即启用 WAL 模式，提升并发读取性能
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("cache_size = -64000");   // 64MB cache
db.pragma("foreign_keys = ON");
```

---

## 8. Desktop 安装程序中的 Profile 选择

安装向导中提供预设选择：

```
┌─────────────────────────────────────────┐
│        GRC Desktop Setup Wizard         │
│                                         │
│  选择运行模式:                            │
│                                         │
│  ○ Lite (推荐)                           │
│    SQLite 数据库，核心管理功能              │
│    适合个人或小团队                        │
│                                         │
│  ○ Full                                 │
│    SQLite 数据库，含任务和会议管理          │
│    适合需要项目管理的团队                   │
│                                         │
│  ○ Server                               │
│    连接 MySQL 数据库，全部功能              │
│    适合企业级部署                          │
│                                         │
│           [< 上一步]  [下一步 >]           │
└─────────────────────────────────────────┘
```

---

## 9. 数据库切换方案（SQLite ↔ MySQL）

### 9.1 SQLite → MySQL 升级

```bash
# CLI 命令
grc-desktop migrate --from sqlite --to mysql --mysql-url "mysql://..."
```

流程：
1. 连接 SQLite，导出所有表数据为 JSON
2. 连接 MySQL，运行完整迁移脚本建表
3. 逐表导入数据，处理类型转换（text → json, integer → boolean）
4. 验证数据完整性
5. 更新 `.env` 中的 `DATABASE_DRIVER` 和 `DATABASE_URL`
6. 重启 GRC

### 9.2 MySQL → SQLite 降级

```bash
grc-desktop migrate --from mysql --to sqlite
```

流程：
1. 检查 MySQL 中是否有 SQLite 不支持模块的数据（evolution, clawhub 等）
2. 警告用户这些数据将不会迁移
3. 仅导出核心模块 + 可选模块的数据
4. 写入 SQLite
5. 自动关闭不兼容模块

---

## 10. 改造优先级与工作量估计

| 优先级 | 任务 | 工作量 | 说明 |
|--------|------|--------|------|
| **P0** | 从 evolution 模块拆分 nodes 模块 | 2d | 阻塞项：不拆则关闭 evolution 时节点管理不可用 |
| **P0** | SQLite Drizzle schema + 连接层 | 3d | 双驱动支持，类型映射 |
| **P0** | SQLite migrations | 2d | 核心表 + 可选模块表 |
| **P1** | 模块状态 API + 前端条件渲染 | 1d | 隐藏关闭模块的导航项 |
| **P1** | Settings 页面 — 模块管理 UI | 2d | 开关界面 + 重启提示 |
| **P1** | Desktop 预设 Profile 系统 | 1d | Lite / Full / Server |
| **P2** | SQLite 性能保护（限制/归档） | 2d | 数据量限制 + 自动归档 |
| **P2** | 数据库迁移工具 (SQLite ↔ MySQL) | 3d | 双向迁移 + 验证 |
| **P3** | Settings 页面 — 数据库切换 UI | 1d | 可视化迁移向导 |

**总计**: 约 **17 人天**

---

## 11. 配置文件示例

### Desktop 默认 `.env`

```env
# ===== GRC Desktop Configuration =====
NODE_ENV=production
PORT=3100
LOG_LEVEL=info

# ===== Database =====
DATABASE_DRIVER=sqlite
SQLITE_PATH=./data/grc.db
# DATABASE_URL=              # MySQL 模式时设置

# ===== Module Toggles =====
GRC_PROFILE=desktop-lite     # desktop-lite | desktop-full | server

# Profile 会自动设置以下开关，也可手动覆盖:
# GRC_MODULE_AUTH=true
# GRC_MODULE_STRATEGY=true
# GRC_MODULE_ROLES=true
# GRC_MODULE_PLATFORM=true
# GRC_MODULE_MODEL_KEYS=true
# GRC_MODULE_RELAY=true
# GRC_MODULE_A2A_GATEWAY=true
# GRC_MODULE_TASKS=false
# GRC_MODULE_MEETINGS=false
# GRC_MODULE_EVOLUTION=false
# GRC_MODULE_CLAWHUB=false
# GRC_MODULE_COMMUNITY=false
# GRC_MODULE_TELEMETRY=false
# GRC_MODULE_UPDATE=false

# ===== External Services (Desktop 模式不需要) =====
# MEILISEARCH_URL=
# REDIS_URL=
# AZURE_STORAGE_ACCOUNT_NAME=
# AZURE_STORAGE_ACCOUNT_KEY=
```

---

## 12. 总结

| 维度 | Desktop Lite (SQLite) | Desktop Full (SQLite) | Server (MySQL) |
|------|----------------------|----------------------|----------------|
| 数据库 | SQLite | SQLite | MySQL |
| 全文搜索 | ❌ | ❌ | Meilisearch |
| 缓存 | 内存 | 内存 | Redis |
| 文件存储 | 本地 | 本地 | Azure Blob |
| 核心模块 | 7/14 | 9/14 | 14/14 |
| 适用场景 | 个人/小团队 | 中小团队 | 企业 |
| 数据上限 | ~500 任务 | ~500 任务 | 无限制 |
| 外部依赖 | 无 | 无 | MySQL + Meilisearch + Redis |
