# GRC → WinClaw 角色配置传递机制 详细设计

**作成日**: 2026-03-07
**関連**: GRC_AI_Employee_Office_Console_Plan.md, GRC_Role_Templates_All_8_Roles.md, GRC_TaskBoard_Design_Detail.md, GRC_Strategy_Management_Design.md
**目的**: GRC侧管理的Role模板内容如何传递到WinClaw Client侧的完整链路

---

## 现有机制概览（改造前）

当前WinClaw与GRC的通信链路已经存在，但**没有**角色配置传递功能：

```
现有数据流:
┌──────────────────────┐         ┌──────────────────────┐
│     GRC Server       │         │   WinClaw Client     │
│                      │         │                      │
│  /a2a/hello ◄────────┼─────────┤ 注册握手（启动时）    │
│  /a2a/fetch          │         │ GrcConnectionManager │
│  /a2a/report         │         │                      │
│  /a2a/publish        │         │ GrcSyncService       │
│  /api/v1/platform/   │         │ (每4小时同步)         │
│    values            │         │                      │
│  /api/v1/skills/*    │         │ 同步内容:             │
│                      │         │  ├ Update检查         │
│                      │         │  ├ Trending Skills    │
│                      │         │  ├ Evolution Assets   │
│                      │         │  ├ Platform Values    │
│                      │         │  └ Telemetry          │
│                      │         │                      │
│  ❌ 没有角色配置传递  │         │ ❌ 没有config pull    │
└──────────────────────┘         └──────────────────────┘
```

当前Bootstrap文件加载流程（纯本地）：
```
~/.winclaw/workspace/
  ├── AGENTS.md      ─┐
  ├── SOUL.md         │ loadWorkspaceBootstrapFiles()
  ├── IDENTITY.md     │ 从磁盘读取
  ├── USER.md         ├──→ buildBootstrapContextFiles()
  ├── TOOLS.md        │    最大150K字符预算
  ├── HEARTBEAT.md    │    70%头部+20%尾部截断
  ├── BOOTSTRAP.md    │
  └── MEMORY.md      ─┘──→ 注入System Prompt ──→ Claude API
```

**问题**: 这8个文件只能由用户手动编辑，GRC无法远程管理。

---

## 改造后的完整传递链路

### 总体流程图

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Phase A: GRC Admin 设置角色
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Admin Dashboard (浏览器)
       │
       │ ① 创建/编辑 Role Template (8个文件内容)
       │ ② 将 Role 分配给某个 Node
       ▼
  GRC Server API
       │
       │ ③ DB: role_templates 表存储模板
       │ ④ DB: nodes 表更新 role_id, config_revision++
       │
       ▼

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Phase B: WinClaw Client 检测到变更
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  WinClaw Client
       │
       │ ⑤ /a2a/hello 或 定期Sync时，发送本地 config_revision
       │
       ▼
  GRC Server
       │
       │ ⑥ 比较: 本地revision(3) < 服务器revision(5)
       │    Response: { latest_config_revision: 5 }
       │
       ▼

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Phase C: WinClaw Client 拉取配置
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  WinClaw Client
       │
       │ ⑦ GET /a2a/config/pull
       │
       ▼
  GRC Server
       │
       │ ⑧ 查询 nodes.role_id → role_templates
       │    + 查询 nodes 的个性化 config overrides
       │    + 模板变量替换 (${employee_id} → "EMP-MKT-001")
       │    Response: {
       │      revision: 5,
       │      role_id: "marketing",
       │      files: {
       │        "AGENTS.md": "# AGENTS.md - マーケティング部...",
       │        "SOUL.md": "# SOUL.md - マーケティングの...",
       │        "IDENTITY.md": "...",
       │        "USER.md": "...",
       │        "TOOLS.md": "...",
       │        "HEARTBEAT.md": "...",
       │        "BOOTSTRAP.md": "...",
       │        "TASKS.md": "..."
       │      }
       │    }
       │
       ▼

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          Phase D: 写入Workspace并生效
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  WinClaw Client
       │
       │ ⑨ 写入 ~/.winclaw/workspace/AGENTS.md 等8个文件
       │ ⑩ 更新本地 config.json5: grc.employee.configRevision = 5
       │ ⑪ POST /a2a/config/status { revision: 5, applied: true }
       │
       ▼
  下次 Chat Session 启动时
       │
       │ ⑫ loadWorkspaceBootstrapFiles() 读取最新文件
       │ ⑬ buildBootstrapContextFiles() 构建上下文
       │ ⑭ 注入 System Prompt → Claude API
       │
       ▼
  AI社员以新角色运行 ✅
```

---

## 各环节详细实现

### 环节①②: GRC Admin 操作

**GRC Dashboard 前端操作流程**:

```
Admin打开 /employees 页面
  → 看到所有已注册的WinClaw Node列表
  → 点击某个Node的「角色分配」按钮
  → 选择角色模板 (如 "marketing")
  → 预览8个文件的内容（可在线微调）
  → 填写模板变量 (company_name, employee_id 等)
  → 点击「配信」按钮
```

**API调用**:
```
POST /api/v1/admin/nodes/{nodeId}/assign-role
Content-Type: application/json

{
  "role_id": "marketing",
  "variables": {
    "employee_id": "EMP-MKT-001",
    "company_name": "株式会社Example",
    "industry": "SaaS / テクノロジー",
    "department": "マーケティング部"
  },
  "overrides": {
    "TOOLS.md": "# 自定义工具配置\n..."  // 可选: 个别文件覆盖
  }
}
```

### 环节③④: GRC Server 处理

```typescript
// GRC Server: src/modules/roles/service.ts (新规)

async function assignRoleToNode(
  nodeId: string,
  roleId: string,
  variables: Record<string, string>,
  overrides?: Record<string, string>
): Promise<void> {
  // 1. 获取角色模板
  const template = await db.select()
    .from(roleTemplatesTable)
    .where(eq(roleTemplatesTable.id, roleId))
    .first();

  // 2. 变量替换 — 将模板中的 ${xxx} 替换为实际值
  const resolvedFiles = resolveTemplateVariables(template, variables);

  // 3. 应用个别文件覆盖
  if (overrides) {
    Object.assign(resolvedFiles, overrides);
  }

  // 4. 存储节点的已解析配置（用于后续pull）
  await db.update(nodesTable)
    .set({
      role_id: roleId,
      department: variables.department || template.department,
      config_revision: sql`config_revision + 1`,  // ← 关键: revision递增
      last_config_push_at: new Date(),
      // 存储已解析的8个文件内容
      resolved_agents_md: resolvedFiles["AGENTS.md"],
      resolved_soul_md: resolvedFiles["SOUL.md"],
      resolved_identity_md: resolvedFiles["IDENTITY.md"],
      resolved_user_md: resolvedFiles["USER.md"],
      resolved_tools_md: resolvedFiles["TOOLS.md"],
      resolved_heartbeat_md: resolvedFiles["HEARTBEAT.md"],
      resolved_bootstrap_md: resolvedFiles["BOOTSTRAP.md"],
      resolved_tasks_md: resolvedFiles["TASKS.md"],
    })
    .where(eq(nodesTable.node_id, nodeId));
}

// 模板变量替换函数
function resolveTemplateVariables(
  template: RoleTemplate,
  variables: Record<string, string>
): Record<string, string> {
  const fileKeys = [
    "agents_md", "soul_md", "identity_md", "user_md",
    "tools_md", "heartbeat_md", "bootstrap_md", "tasks_md"
  ];
  const result: Record<string, string> = {};

  for (const key of fileKeys) {
    let content = template[key] || "";
    // 替换所有 ${variableName} 占位符
    for (const [varName, varValue] of Object.entries(variables)) {
      content = content.replaceAll(`\${${varName}}`, varValue);
    }
    // key: "agents_md" → "AGENTS.md"
    const filename = key.replace("_md", "").toUpperCase() + ".md";
    result[filename] = content;
  }

  return result;
}
```

**DB变更详细 — nodes 表新增列**:
```sql
ALTER TABLE nodes ADD COLUMN role_id VARCHAR(50) DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN role_mode ENUM('autonomous','copilot') DEFAULT NULL;  -- Mode override per node
ALTER TABLE nodes ADD COLUMN department VARCHAR(100) DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN config_revision INT DEFAULT 0;
ALTER TABLE nodes ADD COLUMN last_config_push_at TIMESTAMP DEFAULT NULL;
-- 存储已解析（变量替换后）的文件内容
ALTER TABLE nodes ADD COLUMN resolved_agents_md TEXT DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN resolved_soul_md TEXT DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN resolved_identity_md TEXT DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN resolved_user_md TEXT DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN resolved_tools_md TEXT DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN resolved_heartbeat_md TEXT DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN resolved_bootstrap_md TEXT DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN resolved_tasks_md TEXT DEFAULT NULL;
```

### 环节⑤⑥: Hello握手中的Revision检测

**现有 `/a2a/hello` 请求体 (需要扩展)**:

```typescript
// WinClaw Client: src/infra/grc-client.ts — hello() 方法修改

async hello(): Promise<HelloResponse> {
  // NOTE: The actual hello() signature in grc-client.ts accepts a structured
  // options object. The fields below are added to the existing body, not replacing it.
  const body = {
    node_id: this.nodeId,
    platform: process.platform,
    winclaw_version: APP_VERSION,
    // Existing personal info fields (from grc config section)
    employee_id: this.config.grc?.employeeId,
    employee_name: this.config.grc?.employeeName,
    employee_email: this.config.grc?.employeeEmail,
    // ★ NEW: local config revision for change detection
    config_revision: this.config.grc?.employee?.configRevision ?? 0,
  };

  return this.request<HelloResponse>("POST", "/a2a/hello", body);
}
```

**GRC Server: `/a2a/hello` 响应扩展**:

```typescript
// GRC Server: src/modules/evolution/routes.ts — hello handler 修改

app.post("/a2a/hello", async (req, res) => {
  const { node_id, platform, winclaw_version, config_revision, ...rest } = req.body;

  // 既存: 节点注册/更新
  await upsertNode(node_id, { platform, winclaw_version, ...rest });

  // ★ 新增: 查询该节点的最新 config_revision
  const node = await db.select({
    config_revision: nodesTable.config_revision,
    role_id: nodesTable.role_id,
    role_mode: nodesTable.role_mode,
  })
  .from(nodesTable)
  .where(eq(nodesTable.node_id, node_id))
  .first();

  res.json({
    ok: true,
    node: { id: node_id },
    // ★ NEW fields for config distribution
    latest_config_revision: node?.config_revision ?? 0,
    role_id: node?.role_id ?? null,
    role_mode: node?.role_mode ?? null,  // 'autonomous' | 'copilot' | null
  });
});
```

**WinClaw Client: 收到hello响应后的处理**:

```typescript
// WinClaw Client: src/infra/grc-connection.ts — autoConnect() 修改

async autoConnect(): Promise<void> {
  // ... 既存的 token 取得 & hello 逻辑 ...

  const helloResult = await this.client.hello();

  // ★ 新增: config revision 比较
  const localRevision = this.config.grc?.employee?.configRevision ?? 0;
  const serverRevision = helloResult.latest_config_revision ?? 0;

  if (serverRevision > localRevision) {
    log.info(
      `Config revision mismatch: local=${localRevision}, server=${serverRevision}. ` +
      `Triggering config pull...`
    );
    await this.pullAndApplyConfig();
  }
}
```

### 环节⑦⑧: Config Pull（配置拉取）

**WinClaw Client: 新增 pullConfig 方法**:

```typescript
// WinClaw Client: src/infra/grc-client.ts — 新增方法

async pullConfig(): Promise<ConfigPullResponse> {
  // 认证必须: 使用已有的 Bearer token
  return this.request<ConfigPullResponse>("GET", "/a2a/config/pull");
}

// 响应类型
interface ConfigPullResponse {
  revision: number;
  role_id: string | null;
  role_mode: "autonomous" | "copilot" | null;  // ← NEW
  department: string | null;
  files: {
    "AGENTS.md"?: string;
    "SOUL.md"?: string;
    "IDENTITY.md"?: string;
    "USER.md"?: string;
    "TOOLS.md"?: string;
    "HEARTBEAT.md"?: string;
    "BOOTSTRAP.md"?: string;
    "TASKS.md"?: string;
  };
}
```

**GRC Server: `/a2a/config/pull` 端点实现**:

```typescript
// GRC Server: 新增路由

app.get("/a2a/config/pull", requireAuth, async (req, res) => {
  const nodeId = req.auth.nodeId;  // 从JWT token解析

  const node = await db.select()
    .from(nodesTable)
    .where(eq(nodesTable.node_id, nodeId))
    .first();

  if (!node || !node.role_id) {
    return res.json({
      revision: node?.config_revision ?? 0,
      role_id: null,
      role_mode: null,
      department: null,
      files: {},  // 没有分配角色 → 空文件集
    });
  }

  // 返回已解析（变量替换完毕）的8个文件
  res.json({
    revision: node.config_revision,
    role_id: node.role_id,
    role_mode: node.role_mode,  // ← NEW: 'autonomous' | 'copilot'
    department: node.department,
    files: {
      "AGENTS.md": node.resolved_agents_md,
      "SOUL.md": node.resolved_soul_md,
      "IDENTITY.md": node.resolved_identity_md,
      "USER.md": node.resolved_user_md,
      "TOOLS.md": node.resolved_tools_md,
      "HEARTBEAT.md": node.resolved_heartbeat_md,
      "BOOTSTRAP.md": node.resolved_bootstrap_md,
      "TASKS.md": node.resolved_tasks_md,
    },
  });
});
```

### 环节⑨⑩⑪: 写入Workspace并报告

**WinClaw Client: 配置应用逻辑**:

```typescript
// WinClaw Client: src/infra/grc-connection.ts — 新增方法

import {
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_USER_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
  DEFAULT_TASKS_FILENAME,    // ← 新增
} from "../agents/workspace.js";

async pullAndApplyConfig(): Promise<void> {
  try {
    // ⑦ 拉取配置
    const config = await this.client.pullConfig();

    if (!config.files || Object.keys(config.files).length === 0) {
      log.info("No config files from GRC (no role assigned)");
      return;
    }

    // ⑨ 写入workspace目录
    const workspaceDir = resolveWorkspaceDir(this.config);

    // 文件名映射 (确保用正确的常量)
    const fileMapping: Record<string, string> = {
      "AGENTS.md": DEFAULT_AGENTS_FILENAME,
      "SOUL.md": DEFAULT_SOUL_FILENAME,
      "IDENTITY.md": DEFAULT_IDENTITY_FILENAME,
      "USER.md": DEFAULT_USER_FILENAME,
      "TOOLS.md": DEFAULT_TOOLS_FILENAME,
      "HEARTBEAT.md": DEFAULT_HEARTBEAT_FILENAME,
      "BOOTSTRAP.md": DEFAULT_BOOTSTRAP_FILENAME,
      "TASKS.md": DEFAULT_TASKS_FILENAME,
    };

    let filesWritten = 0;
    for (const [key, content] of Object.entries(config.files)) {
      if (content == null) continue;

      const filename = fileMapping[key] || key;
      const filePath = path.join(workspaceDir, filename);

      // 安全检查: 防止路径遍历
      if (!filePath.startsWith(workspaceDir)) {
        log.warn(`Skipping suspicious path: ${filePath}`);
        continue;
      }

      // 写入文件 (UTF-8)
      await fs.writeFile(filePath, content, { encoding: "utf-8" });
      filesWritten++;
      log.info(`Updated workspace file: ${filename}`);
    }

    // ⑩ 更新本地配置 — 记录当前revision + role mode
    await updateConfig((draft) => {
      if (!draft.grc) draft.grc = {};
      if (!draft.grc.employee) draft.grc.employee = {};
      draft.grc.employee.roleId = config.role_id ?? undefined;
      draft.grc.employee.roleMode = config.role_mode ?? undefined;  // ← NEW
      draft.grc.employee.department = config.department ?? undefined;
      draft.grc.employee.configRevision = config.revision;
    });

    log.info(
      `Config applied: revision=${config.revision}, ` +
      `role=${config.role_id}, files=${filesWritten}`
    );

    // ⑪ 向GRC报告应用结果
    await this.client.reportConfigStatus(config.revision, true);

  } catch (err) {
    log.error("Failed to pull/apply config from GRC:", err);
    // 报告失败
    try {
      await this.client.reportConfigStatus(0, false);
    } catch { /* ignore */ }
  }
}
```

### 环节⑫⑬⑭: 下次Chat时生效

**这部分不需要任何代码修改！** 既有机制自动生效：

```
用户发起新的Chat Session
  │
  ▼
PI Embedded Runner 启动
  │
  ▼
loadWorkspaceBootstrapFiles()
  │ 读取 ~/.winclaw/workspace/ 下的所有 bootstrap 文件
  │ AGENTS.md, SOUL.md, ... （已经被Step ⑨ 更新为新角色内容）
  ▼
filterBootstrapFilesForSession(files, sessionKey)
  │ 根据 session 类型过滤（主session获取全部文件）
  ▼
buildBootstrapContextFiles(files, opts)
  │ 字符预算分配（每文件20K，总计150K）
  │ 头70%+尾20% 截断策略
  ▼
注入 System Prompt
  │
  ▼
Claude API 调用
  │ System Prompt 中包含新角色的全部配置
  │ AI 以 "マーケティングAI社員 Maya" 身份运行
  ▼
✅ 角色生效
```

**关键点**: `loadWorkspaceBootstrapFiles()` 每次session启动都会重新从磁盘读取，所以只要文件被更新，下一个session自动使用新内容。文件读取有缓存（基于 `dev:inode:size:mtime`），但文件被覆写后mtime变化，缓存自动失效。

---

## 集成到现有Sync Service

### GrcSyncService 新增Phase

```typescript
// WinClaw Client: src/infra/grc-sync.ts — runSync() 修改

async runSync(): Promise<GrcSyncResult> {
  // ... 既存 Phase 1-7 ...

  // ★ Phase 8 (新增): Config Revision Check & Pull
  try {
    log.debug("[sync] Phase 8: Config revision check");
    const localRevision = this.config.grc?.employee?.configRevision ?? 0;

    // 利用 hello 的返回值（如果本次sync有hello），
    // 或者单独调用 checkConfigRevision
    const serverRevision = this.latestHelloResult?.latest_config_revision
      ?? (await this.client.checkConfigRevision()).latestRevision;

    if (serverRevision > localRevision) {
      log.info(
        `[sync] Config update available: ${localRevision} → ${serverRevision}`
      );
      await this.connectionManager.pullAndApplyConfig();
      result.configUpdated = true;
      result.configRevision = serverRevision;
    } else {
      log.debug(`[sync] Config up-to-date: revision=${localRevision}`);
      result.configUpdated = false;
    }
  } catch (err) {
    result.errors.push(`Config sync failed: ${err.message}`);
  }

  // ★ Phase 9 (新增): Task Sync
  try {
    log.debug("[sync] Phase 9: Task sync");
    const tasks = await this.client.getMyTasks();
    if (tasks.length > 0) {
      await syncTasksToWorkspace(tasks, this.workspaceDir);
      result.tasksSynced = tasks.length;
    }
  } catch (err) {
    result.errors.push(`Task sync failed: ${err.message}`);
  }

  // ★ Phase 10 (新增): A2A Relay Inbox Poll
  try {
    log.debug("[sync] Phase 10: Relay inbox poll");
    const messages = await this.client.pollRelayInbox();
    for (const msg of messages) {
      await this.relayService.processIncomingRelay(msg);
      await this.client.ackRelayMessage(msg.id);
    }
    result.relayMessagesReceived = messages.length;
  } catch (err) {
    result.errors.push(`Relay poll failed: ${err.message}`);
  }

  return result;
}
```

---

## 触发时机总结

配置检测和拉取会在以下3个时机触发：

| 时机 | 触发条件 | 检测方式 |
|------|----------|----------|
| **① 启动时** | WinClaw Gateway 启动 | `autoConnect()` → `hello()` → revision比较 |
| **② 定期同步** | 每4小时（默认） | `runSync()` Phase 8 → revision比较 |
| **③ 手动触发** | 用户在UI点击「同步」 | Gateway RPC → `forceSync()` → 同上 |

```
时间轴:
0s       30s        4h          8h         12h
│         │          │           │           │
▼         ▼          ▼           ▼           ▼
Gateway   hello()    Sync #1    Sync #2    Sync #3
启动      ↓          ↓           ↓           ↓
         revision    revision    revision    revision
         check       check       check       check
         ↓           ↓
         有变更!     无变更
         ↓           (skip)
         pull →
         写入文件
```

---

## 安全性考虑

### 1. 认证

```
所有 /a2a/config/* 端点都需要 Bearer Token 认证

WinClaw Client                          GRC Server
    │                                      │
    │ GET /a2a/config/pull                 │
    │ Authorization: Bearer <jwt-token>    │
    │─────────────────────────────────────►│
    │                                      │
    │                                      │ JWT解码 → 获取 nodeId
    │                                      │ 验证: nodeId 与 token 匹配
    │                                      │ 查询: nodes WHERE node_id = nodeId
    │                                      │
    │                                      │ ✅ 只返回该节点自己的配置
    │                                      │ ❌ 不能读取其他节点的配置
    │◄─────────────────────────────────────│
```

### 2. 文件写入安全

```typescript
// 路径遍历防护
const filePath = path.join(workspaceDir, filename);
if (!filePath.startsWith(workspaceDir)) {
  // 拒绝写入workspace外的路径
  throw new Error("Path traversal detected");
}

// 文件名白名单
const VALID_CONFIG_FILES = new Set([
  "AGENTS.md", "SOUL.md", "IDENTITY.md", "USER.md",
  "TOOLS.md", "HEARTBEAT.md", "BOOTSTRAP.md", "TASKS.md"
]);
if (!VALID_CONFIG_FILES.has(filename)) {
  throw new Error("Invalid config filename");
}

// 大小限制
if (content.length > 100_000) {  // 100KB per file max
  throw new Error("Config file too large");
}
```

### 3. 版本冲突处理

```typescript
// 只接受更高版本的配置（防止回滚攻击）
if (serverRevision <= localRevision) {
  log.warn("Ignoring config with same or lower revision");
  return;
}

// 备份当前文件（供回滚）
const backupDir = path.join(workspaceDir, ".config-backup", String(localRevision));
await fs.mkdir(backupDir, { recursive: true });
for (const file of VALID_CONFIG_FILES) {
  const src = path.join(workspaceDir, file);
  if (await fileExists(src)) {
    await fs.copyFile(src, path.join(backupDir, file));
  }
}
```

---

## 变更文件清单（仅配置传递相关）

### GRC Server 侧

| 文件 | 变更 | 说明 |
|------|------|------|
| `migrations/006_nodes_config_columns.sql` | **新增** | nodes表增加 resolved_*_md 列 |
| `src/modules/evolution/schema.ts` | **修改** | Drizzle schema 增加新列 |
| `src/modules/evolution/routes.ts` | **修改** | `/a2a/hello` 响应增加 `latest_config_revision` |
| `src/modules/roles/service.ts` | **新增** | `assignRoleToNode()`, `resolveTemplateVariables()` |
| `src/modules/roles/routes.ts` | **新增** | config/pull, config/check, config/status 端点 |

### WinClaw Client 侧

| 文件 | 变更 | 说明 |
|------|------|------|
| `src/infra/grc-client.ts` | **修改** | 增加 `pullConfig()`, `checkConfigRevision()`, `reportConfigStatus()`, task/relay methods |
| `src/infra/grc-connection.ts` | **修改** | 增加 `pullAndApplyConfig()`, hello后的revision检查 |
| `src/infra/grc-sync.ts` | **修改** | 增加 Phase 8 (Config Sync), Phase 9 (Task Sync: bidirectional), Phase 10 (Relay Poll) |
| `src/config/types.winclaw.ts` | **修改** | `grc.employee` 增加 `configRevision`, `roleId`, `roleMode` |
| `src/agents/workspace.ts` | **修改** | 增加 `DEFAULT_TASKS_FILENAME`, VALID_BOOTSTRAP_NAMES |

### 不需要修改的文件（既有机制自动适配）

| 文件 | 原因 |
|------|------|
| `src/agents/pi-embedded-helpers/bootstrap.ts` | `buildBootstrapContextFiles()` 从磁盘读取，文件更新后自动生效。**注意**: 该文件在整体Plan中需要修改以支持 TASKS.md 过滤和内容消毒（详见 Plan doc），但配置传递机制本身不需要改该文件。 |
| `src/agents/workspace.ts` (读取部分) | `loadWorkspaceBootstrapFiles()` 基于mtime缓存，文件更新后自动刷新 |
| System Prompt 注入逻辑 | 无需修改，每次session自动读取最新文件 |

---

## 端到端示例

### 场景: Admin将Node-A分配为「Marketing」角色

```
[时间 T+0] Admin操作

  Admin在Dashboard选择 Node-A → 分配角色 "marketing"
  填写变量: company_name="Example Inc", employee_id="EMP-001"
  点击「配信」

  → POST /api/v1/admin/nodes/Node-A/assign-role
    { role_id: "marketing", variables: { company_name: "Example Inc", employee_id: "EMP-001" } }

  → GRC Server:
    1. 读取 role_templates WHERE id = "marketing"
    2. 变量替换: "${company_name}" → "Example Inc", "${employee_id}" → "EMP-001"
    3. UPDATE nodes SET
         role_id = "marketing",
         config_revision = config_revision + 1,  -- 假设变成 revision=1
         resolved_agents_md = "# AGENTS.md - マーケティング部AI社員...",
         resolved_soul_md = "# SOUL.md - マーケティングのプロフェッショナル...",
         ...
       WHERE node_id = "Node-A"

[时间 T+30s ~ T+4h] WinClaw Client 检测到变更

  情况A: 如果Client刚好启动 → hello() 返回 latest_config_revision=1 > local(0)
  情况B: 如果Client已运行 → 下次4h sync 时检测到

  → Client: "Config revision mismatch: local=0, server=1"

[时间 T+Xs] Config Pull

  → GET /a2a/config/pull (Authorization: Bearer <token>)
  ← {
      revision: 1,
      role_id: "marketing",
      files: {
        "AGENTS.md": "# AGENTS.md - マーケティング部AI社員\n\n## Your Role\nあなたは会社のマーケティング部門を統括するAI社員です。...",
        "SOUL.md": "# SOUL.md - マーケティングのプロフェッショナル\n\n## Core Truths\n- データドリブンな判断を最優先する\n...",
        "IDENTITY.md": "# IDENTITY.md\n- **Name:** Maya\n- **Employee ID:** EMP-001\n...",
        ...
      }
    }

[时间 T+Xs+1s] 写入文件

  → Write ~/.winclaw/workspace/AGENTS.md   (覆盖既有内容)
  → Write ~/.winclaw/workspace/SOUL.md
  → Write ~/.winclaw/workspace/IDENTITY.md
  → Write ~/.winclaw/workspace/USER.md
  → Write ~/.winclaw/workspace/TOOLS.md
  → Write ~/.winclaw/workspace/HEARTBEAT.md
  → Write ~/.winclaw/workspace/BOOTSTRAP.md
  → Write ~/.winclaw/workspace/TASKS.md

  → 更新 config.json5:
    {
      "grc": {
        "employee": {
          "roleId": "marketing",
          "department": "マーケティング部",
          "configRevision": 1
        }
      }
    }

  → POST /a2a/config/status { revision: 1, applied: true }

[时间 T+任意] 用户开始新Chat

  → loadWorkspaceBootstrapFiles()
    → 读取 AGENTS.md → "# AGENTS.md - マーケティング部AI社員..."
    → 读取 SOUL.md   → "# SOUL.md - マーケティングのプロフェッショナル..."
    → ...

  → System Prompt:
    """
    path: ~/.winclaw/workspace/AGENTS.md
    content: # AGENTS.md - マーケティング部AI社員
    ## Your Role
    あなたは会社のマーケティング部門を統括するAI社員です。
    ...

    path: ~/.winclaw/workspace/SOUL.md
    content: # SOUL.md - マーケティングのプロフェッショナル
    ## Core Truths
    - データドリブンな判断を最優先する
    ...

    path: ~/.winclaw/workspace/IDENTITY.md
    content: # IDENTITY.md
    - Name: Maya (マーケティングAI社員)
    - Employee ID: EMP-001
    ...
    """

  → Claude 以 Maya（マーケティングAI社員）身份回答用户 ✅
```

---

## Q&A

### Q1: 如果Admin修改了已分配角色的模板内容，Client会自动更新吗？

**是的。** Admin修改角色模板 → 需要重新「配信」到目标节点 → `config_revision++` → Client在下次同步时检测到revision变更 → 自动pull最新内容。

### Q2: 如果Client离线怎么办？

Pull模型的优势：Client上线后会自动检测revision差异并拉取最新配置。不需要GRC主动推送。即使离线1周，上线后的第一次hello就会触发更新。

### Q3: 用户本地手动修改了AGENTS.md，会被GRC覆盖吗？

**是的，会被覆盖。** GRC管理模式下，8个bootstrap文件由GRC统一管理。本地修改会在下次config pull时被覆盖。如果需要保留本地自定义，应该：
- 通过GRC Dashboard的「个别文件覆盖」功能修改
- 或者在GRC中不分配角色（保持本地管理模式）

### Q4: TASKS.md 和其他7个文件的更新频率一样吗？

**不一样。** TASKS.md有独立的**双方向**同步通道（Phase 9: Task Sync），因为任务变更比角色配置变更频繁得多：
- 角色配置（7个文件）: 通过 config_revision 检测，变更不频繁
- TASKS.md **下载方向**: 通过 `GET /a2a/tasks/mine` 获取GRC分配的任务 → 生成TASKS.md
- TASKS.md **上传方向**: Agent在本地更新了任务状态/进度 → 下次sync时解析TASKS.md → `POST /a2a/tasks/:taskId/progress` 推送到GRC

**变更检测（上传方向）**: 使用文件mtime比较。Sync service在每次pull后记录TASKS.md的mtime。如果下次sync时mtime已变化，说明Agent修改了文件，触发上传解析。详见 `GRC_TaskBoard_Design_Detail.md §10.2`。

### Q5: 多个Agent共用一个Node时怎么处理？

WinClaw支持一个节点运行多个Agent（通过agents配置）。在企业场景下，建议**一个节点 = 一个AI社员**，简化管理。如果确实需要一个节点多角色，可以通过agents配置中的per-agent workspace来实现。

### Q6: CEO角色如何下达指令给其他AI社员？

CEO通过A2A协议向各部门Agent下达指令：
```
CEO Agent (Node-CEO)
  │
  │ sessions_send → remote:nodeA:agent:marketing:main
  │ "请在3月15日前完成Q1营销策略，预算上限5万美元，KPI: CAC<$50, MQL>200"
  │──────────────────────────────────────────────────►
  │                                   Marketing Agent (Node-A)
  │                                   收到指令 → 创建TASK → 执行
  │
  │ sessions_send → remote:nodeB:agent:finance:main
  │ "请审批Marketing部门Q1预算申请，上限5万美元"
  │──────────────────────────────────────────────────►
  │                                   Finance Agent (Node-B)
```

同时，CEO通过GRC的Task Board为各Agent创建Task，Task会自动同步到对应Node的TASKS.md。

### Q6.5: CEO角色的mode是什么？

**CEO默认为copilot mode。** CEO AI是人类CEO的AI助手（copilot），具有完全的组织管理权限，**唯一例外是财务支出**：
- CEO AI自主处理: KPI分配、战略决策、部门指令、绩效评估、跨部门协调
- 需要人类CEO审批: 所有涉及实际资金支出的任务（通过Expense Approval Queue呈现）
- 人类CEO完成: 实际支付和财务承诺

Config Distribution时，CEO节点的`role_mode`固定为`copilot`，AGENTS.md中包含相应的copilot模式指令。详见 `GRC_Role_Templates_All_8_Roles.md §0 CEO`。

### Q7: CEO的KPI分配和监控机制是什么？

CEO role的HEARTBEAT.md中定义了KPI监控节奏：
- **Weekly**: 收集所有部门Agent的周报 → 生成公司级KPI仪表盘
- **Monthly**: 执行月度绩效评审 → 对偏离目标的部门下达纠偏指令
- **Quarterly**: 更新各部门KPI目标 → 下达季度战略指令

CEO通过A2A向各Agent请求数据，汇总后生成执行报告。

### Q8: 所有config文件为什么必须用英文？

1. **LLM理解度**: 英文训练数据最丰富，AI对英文指令的理解最准确
2. **多国部署**: 英文config确保跨国团队一致性，AI仍可用本地语言与用户交流
3. **审计标准化**: 统一语言便于审计和合规检查
4. **变量兼容**: 模板变量 `${xxx}` 在英文环境下解析最稳定

### Q9: 经营战略变更时如何传递给所有AI社员？

通过 `GRC_Strategy_Management_Design.md` 中定义的**戦略カスケードフロー**实现。核心机制是在 `resolveTemplateVariables()` 中追加**第2パス**：

```
变量解决的两个阶段:

  第1パス（既存 — 角色分配时）:
    静态变量替换: ${employee_id}, ${company_name}, ${human_name} 等
    ↓
  第2パス（新规 — 角色分配时 + 战略Deploy时）:
    战略变量替换: ${company_mission}, ${department_budget}, ${department_kpis} 等
    数据来源: company_strategy テーブル（GRC Strategy Management 画面で入力）
```

**战略变更时的完整流程**:

1. Human CEO 在 Dashboard `/strategy` 画面输入/修改经营目标、方针、预算
2. 点击「Save & Deploy to All Agents」→ `POST /api/v1/admin/strategy/deploy`
3. GRC Server:
   - `company_strategy.revision++`
   - 全分配済みノードのUSER.md再レンダリング（第2パスで新しい戦略変数を注入）
   - 全ノードの `config_revision++`
   - CEO ノードに「Strategic Realignment」タスク自動作成
4. 各ノードが次回sync時にconfig_revision変更を検出 → pull → USER.md更新
5. CEO AI がタスクを受信 → 部門別KPI再配分 → 各部門AIにタスク/A2A指令
6. 各部門AIが新しいUSER.md（更新された予算・KPI）に基づいて業務計画を再調整

**戦略変数の注入先**:
- CEO・戦略企画: フルバージョン（mission, vision, strategy_summary, annual_targets, long_term_vision, strategic_priorities + 部門予算・KPI）
- 財務: サマリー + annual_targets
- 他の部門ロール: サマリーバージョン（mission, values, department_budget, department_kpis, current_quarter_goals）

詳細は `GRC_Strategy_Management_Design.md` §4-§5 を参照。

**変更ファイル（戦略カスケード関連）**:

| 文件 | 変更 | 説明 |
|------|------|------|
| `src/modules/strategy/service.ts` | **新増** | `deployStrategy()`, `buildStrategyVariables()` |
| `src/modules/roles/service.ts` | **修正** | `resolveTemplateVariables()` に第2パス追加 |
