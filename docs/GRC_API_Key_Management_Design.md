# GRC AI模型密钥管理与分发系统设计文档

> **Version**: 1.0
> **Date**: 2026-03-09
> **Status**: Approved
> **Related**: GRC_Config_Distribution_Detail.md, GRC_AI_Employee_Office_Console_Plan.md

---

## 1. 概要

### 1.1 背景

当前GRC Dashboard的API密钥页面（`/manage/apikeys`）仅管理GRC平台自身的认证令牌（JWT），不涉及AI模型API密钥的管理。WinClaw节点运行AI Agent时需要调用各类LLM API（OpenAI、Anthropic、Google等），目前密钥配置需要在每个节点上手动编辑 `.winclaw/winclaw.json`，缺乏集中管理和分发能力。

### 1.2 目标

构建**AI模型API密钥中央管理+自动分发系统**：

1. **集中管理** — 在GRC Dashboard中统一管理所有AI模型API密钥
2. **分类管理** — 分为「主业务密钥」和「辅助业务密钥」两类
3. **自动分发** — 复用现有Config Distribution机制，将密钥配置推送到指定节点
4. **安全存储** — 数据库中AES-256加密存储，仅在Pull时解密传输
5. **完整生命周期** — 支持分配、解绑、更新操作

### 1.3 密钥分类

| 类别 | 英文 | 用途说明 | winclaw.json键名 |
|------|------|---------|-----------------|
| **主业务密钥** | Primary | 核心LLM调用（Claude/GPT/Gemini等） | `providers[]` |
| **辅助业务密钥** | Auxiliary | 辅助工具API（搜索/翻译/嵌入等） | `auxiliaryKeys[]` |

---

## 2. 系统架构

### 2.1 整体数据流

```
GRC Admin Dashboard                    GRC Server                        WinClaw Node
═══════════════════                    ══════════                        ════════════

[密钥管理页面]                          [model-keys模块]
 ├ 添加密钥 ──────────→ POST /model-keys ──→ ai_model_keys表
 ├ 编辑密钥 ──────────→ PUT  /model-keys/:id
 └ 删除密钥 ──────────→ DELETE /model-keys/:id

[密钥分发页面]                          [model-keys模块]
 ├ 分配密钥 ──────────→ POST /nodes/:id/assign-keys
 │                       ├ 解密密钥 → 构建key_config_json
 │                       ├ 更新node.primary_key_id
 │                       ├ 更新node.auxiliary_key_id
 │                       └ node.configRevision++
 │                                                            [GRC Sync定时轮询]
 │                                                            GET /a2a/config/check
 │                                                             ↓ (revision变更)
 │                                                            GET /a2a/config/pull
 │                       [roles模块 - 扩展]                     ├ files: {8 MD files}
 │                       getNodeConfig() ←───────────────────── └ key_config: {...}
 │                         ├ 读取resolvedMd (既有)                     ↓
 │                         └ 读取key_config_json (新增)          syncKeyConfig()
 │                                                              ├ 读取winclaw.json
 │                                                              ├ 写入providers[]
 │                                                              └ 写入auxiliaryKeys[]
 │
 ├ 解绑密钥 ──────────→ POST /nodes/:id/unassign-keys
 │                       ├ node.key_config_json = null
 │                       └ configRevision++                  → Sync → 删除密钥配置
 │
 └ 更新密钥 ──────────→ PUT /nodes/:id/update-keys
                         ├ 重新构建key_config_json
                         └ configRevision++                  → Sync → 更新密钥配置
```

### 2.2 安全设计

- **存储加密**: API密钥在写入数据库前使用 AES-256-GCM 加密，密钥来自环境变量 `MODEL_KEY_ENCRYPTION_SECRET`
- **传输安全**: A2A config/pull 端点要求节点认证（Bearer Token），密钥仅在Pull响应中明文传输
- **前端遮蔽**: Dashboard显示密钥时仅展示前缀（如 `sk-xxxx...xxxx`），编辑时可选择性查看
- **审计日志**: 所有密钥创建、修改、删除、分配操作记录日志

---

## 3. 数据库设计

### 3.1 新增表: `ai_model_keys`

```sql
-- file: src/shared/db/migrations/010_ai_model_keys.sql

CREATE TABLE IF NOT EXISTS ai_model_keys (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  category      ENUM('primary','auxiliary') NOT NULL COMMENT '密钥类别: 主业务/辅助业务',
  name          VARCHAR(100) NOT NULL COMMENT '显示名称, 如"生产环境 OpenAI"',
  provider      VARCHAR(50)  NOT NULL COMMENT '提供商: openai/anthropic/google/deepseek/qwen/custom',
  model_name    VARCHAR(100) NOT NULL COMMENT '模型名称: gpt-4o/claude-sonnet-4-20250514 等',
  api_key_enc   TEXT         NOT NULL COMMENT 'AES-256-GCM 加密后的API密钥',
  base_url      VARCHAR(500) DEFAULT NULL COMMENT '自定义API端点URL (可选)',
  notes         TEXT         DEFAULT NULL COMMENT '备注信息',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE COMMENT '是否激活',
  created_by    VARCHAR(255) NOT NULL COMMENT '创建者邮箱',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_category (category),
  INDEX idx_provider (provider),
  INDEX idx_active   (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.2 nodes表扩展

```sql
-- file: src/shared/db/migrations/010_ai_model_keys.sql (续)

ALTER TABLE nodes
  ADD COLUMN primary_key_id   CHAR(36)  DEFAULT NULL COMMENT '已分配的主业务密钥ID',
  ADD COLUMN auxiliary_key_id  CHAR(36)  DEFAULT NULL COMMENT '已分配的辅助业务密钥ID',
  ADD COLUMN key_config_json   JSON      DEFAULT NULL COMMENT '已解析的密钥配置JSON (Pull时返回)',
  ADD INDEX idx_primary_key_id  (primary_key_id),
  ADD INDEX idx_auxiliary_key_id (auxiliary_key_id);
```

### 3.3 Drizzle ORM 定义

```typescript
// file: src/modules/model-keys/schema.ts

import { mysqlTable, char, varchar, text, boolean, timestamp, mysqlEnum, json } from "drizzle-orm/mysql-core";

export const aiModelKeys = mysqlTable("ai_model_keys", {
  id:          char("id", { length: 36 }).primaryKey(),
  category:    mysqlEnum("category", ["primary", "auxiliary"]).notNull(),
  name:        varchar("name", { length: 100 }).notNull(),
  provider:    varchar("provider", { length: 50 }).notNull(),
  modelName:   varchar("model_name", { length: 100 }).notNull(),
  apiKeyEnc:   text("api_key_enc").notNull(),
  baseUrl:     varchar("base_url", { length: 500 }),
  notes:       text("notes"),
  isActive:    boolean("is_active").notNull().default(true),
  createdBy:   varchar("created_by", { length: 255 }).notNull(),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});
```

---

## 4. GRC Backend API 设计

### 4.1 模块结构

```
src/modules/model-keys/
  ├── schema.ts          # Drizzle表定义
  ├── service.ts         # 业务逻辑 (CRUD + 加密 + 分配)
  └── admin-routes.ts    # Admin API路由 (9个端点)
```

### 4.2 API 端点

#### 密钥 CRUD

| Method | Path | Description |
|--------|------|-------------|
| `GET`    | `/api/v1/admin/model-keys` | 密钥列表 (支持 category/provider/is_active 筛选, 分页) |
| `POST`   | `/api/v1/admin/model-keys` | 创建密钥 |
| `GET`    | `/api/v1/admin/model-keys/:id` | 获取密钥详情 (含解密后的api_key) |
| `PUT`    | `/api/v1/admin/model-keys/:id` | 更新密钥 |
| `DELETE` | `/api/v1/admin/model-keys/:id` | 删除密钥 (如已分配给节点则拒绝) |

#### 节点密钥分配

| Method | Path | Description |
|--------|------|-------------|
| `POST`   | `/api/v1/admin/nodes/:nodeId/assign-keys` | 为节点分配密钥 |
| `POST`   | `/api/v1/admin/nodes/:nodeId/unassign-keys` | 解除节点密钥 |
| `PUT`    | `/api/v1/admin/nodes/:nodeId/update-keys` | 更新节点已分配密钥 |
| `GET`    | `/api/v1/admin/nodes/:nodeId/assigned-keys` | 查看节点密钥分配状态 |

### 4.3 请求/响应Schema

#### 创建密钥

```typescript
// POST /api/v1/admin/model-keys
const createKeySchema = z.object({
  category:   z.enum(["primary", "auxiliary"]),
  name:       z.string().min(1).max(100),
  provider:   z.enum(["openai", "anthropic", "google", "deepseek", "qwen", "custom"]),
  model_name: z.string().min(1).max(100),
  api_key:    z.string().min(1),              // 明文传入, 服务端加密存储
  base_url:   z.string().url().optional(),
  notes:      z.string().max(500).optional(),
});

// Response
{
  "id": "uuid",
  "category": "primary",
  "name": "Production OpenAI",
  "provider": "openai",
  "model_name": "gpt-4o",
  "key_prefix": "sk-xxxx...xxxx",    // 前缀+后4位
  "base_url": null,
  "is_active": true,
  "created_at": "2026-03-09T..."
}
```

#### 分配密钥

```typescript
// POST /api/v1/admin/nodes/:nodeId/assign-keys
const assignKeysSchema = z.object({
  primary_key_id:   z.string().uuid().optional(),   // null = 不分配主密钥
  auxiliary_key_id:  z.string().uuid().optional(),   // null = 不分配辅助密钥
});
```

### 4.4 核心Service逻辑

```typescript
// file: src/modules/model-keys/service.ts

class ModelKeysService {
  // ── 加密/解密 ──
  encrypt(plainKey: string): string;    // AES-256-GCM
  decrypt(encKey: string): string;

  // ── CRUD ──
  async listKeys(filters: { category?, provider?, is_active?, page, page_size }): Promise<PaginatedResult>;
  async createKey(data: CreateKeyInput, createdBy: string): Promise<ModelKey>;
  async getKey(id: string): Promise<ModelKey>;        // 含解密key
  async updateKey(id: string, data: UpdateKeyInput): Promise<ModelKey>;
  async deleteKey(id: string): Promise<void>;         // 检查是否被节点引用

  // ── 节点分配 ──
  async assignKeysToNode(nodeId: string, primaryKeyId?: string, auxiliaryKeyId?: string): Promise<void> {
    // 1. 验证节点存在
    // 2. 验证密钥存在且 is_active
    // 3. 解密密钥 → 构建 key_config_json
    // 4. UPDATE nodes SET primary_key_id, auxiliary_key_id, key_config_json
    // 5. INCREMENT config_revision → 触发现有Sync机制
  }

  async unassignKeysFromNode(nodeId: string): Promise<void> {
    // 1. UPDATE nodes SET primary_key_id=NULL, auxiliary_key_id=NULL, key_config_json=NULL
    // 2. INCREMENT config_revision
  }

  async updateNodeKeys(nodeId: string, primaryKeyId?: string, auxiliaryKeyId?: string): Promise<void> {
    // 同 assignKeysToNode, 但用于已分配节点的密钥更换
  }

  // ── 构建密钥配置 ──
  buildKeyConfig(primaryKey?: ModelKey, auxiliaryKey?: ModelKey): KeyConfigJson {
    return {
      primary: primaryKey ? {
        provider: primaryKey.provider,
        model: primaryKey.modelName,
        apiKey: this.decrypt(primaryKey.apiKeyEnc),
        ...(primaryKey.baseUrl ? { baseUrl: primaryKey.baseUrl } : {})
      } : null,
      auxiliary: auxiliaryKey ? {
        provider: auxiliaryKey.provider,
        model: auxiliaryKey.modelName,
        apiKey: this.decrypt(auxiliaryKey.apiKeyEnc),
        ...(auxiliaryKey.baseUrl ? { baseUrl: auxiliaryKey.baseUrl } : {})
      } : null
    };
  }
}
```

### 4.5 A2A Config Pull 扩展

修改 `src/modules/roles/service.ts` 的 `getNodeConfig()`:

```typescript
// 现有
async getNodeConfig(nodeId: string) {
  return { ok: true, revision, role_id, role_mode, files };
}

// 扩展后
async getNodeConfig(nodeId: string) {
  const node = await getNodeByNodeId(nodeId);
  const files = mapResolvedMdToFiles(node);
  const keyConfig = node.keyConfigJson ?? null;   // 新增: 从节点记录直接读取

  return { ok: true, revision, role_id, role_mode, files, key_config: keyConfig };
}
```

修改 `src/modules/roles/routes.ts` 的 `/a2a/config/pull` 端点响应:

```typescript
// 扩展响应
res.json({
  ok: true,
  revision: node.configRevision,
  role_id: node.roleId,
  role_mode: node.roleMode,
  files: resolvedFiles,
  key_config: node.keyConfigJson ?? null   // 新增字段
});
```

---

## 5. Dashboard UI 设计

### 5.1 页面路由

| 路由 | 组件 | 说明 |
|------|------|------|
| `/manage/model-keys` | `ModelKeys.tsx` | AI模型密钥管理 (CRUD) |
| `/manage/model-keys/distribute` | `ModelKeyDistribute.tsx` | 密钥分发 (节点分配) |

### 5.2 AI模型密钥管理页面

```
┌──────────────────────────────────────────────────────────────────┐
│  AI 模型密钥                                    [+ 添加密钥]     │
│  管理所有AI模型的API密钥                                          │
├──────────────────────────────────────────────────────────────────┤
│  [主业务密钥]  [辅助业务密钥]               ← 标签页切换           │
├──────────────────────────────────────────────────────────────────┤
│  🔍 搜索密钥名称...   提供商 [全部 ▼]   状态 [全部 ▼]  [Search]  │
├──────────────────────────────────────────────────────────────────┤
│  名称         │ 提供商     │ 模型名称            │ 状态 │ 操作    │
│ ─────────────┼───────────┼────────────────────┼──────┼──────── │
│  生产环境主Key │ OpenAI    │ gpt-4o             │ ✅   │ [✏][🗑] │
│  测试环境     │ Anthropic │ claude-sonnet-4-.. │ ✅   │ [✏][🗑] │
│  备用密钥     │ Google    │ gemini-2.0-flash   │ ❌   │ [✏][🗑] │
└──────────────┴───────────┴────────────────────┴──────┴─────────┘
```

### 5.3 添加/编辑密钥模态框

```
┌───────────────────────────────────────────────┐
│  添加 AI 模型密钥                   [×]        │
├───────────────────────────────────────────────┤
│                                               │
│  类别                                         │
│  (●) 主业务密钥    (○) 辅助业务密钥             │
│                                               │
│  名称 *                                       │
│  ┌─────────────────────────────────────────┐  │
│  │ 生产环境 OpenAI                          │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  提供商 *                                      │
│  ┌─────────────────────────────────────────┐  │
│  │ OpenAI                              ▼   │  │
│  └─────────────────────────────────────────┘  │
│   OpenAI │ Anthropic │ Google │ DeepSeek │    │
│   Qwen │ Custom                               │
│                                               │
│  模型名称 *                                    │
│  ┌─────────────────────────────────────────┐  │
│  │ gpt-4o                              ▼   │  │
│  └─────────────────────────────────────────┘  │
│   (根据提供商动态切换可选列表)                    │
│                                               │
│  API 密钥 *                                    │
│  ┌─────────────────────────────────────┐ 👁   │
│  │ sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx │      │
│  └─────────────────────────────────────┘      │
│                                               │
│  基础URL (可选, 自定义端点)                      │
│  ┌─────────────────────────────────────────┐  │
│  │ https://api.openai.com/v1               │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  备注 (可选)                                    │
│  ┌─────────────────────────────────────────┐  │
│  │                                         │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  ☑ 激活                                       │
│                                               │
│             [取消]              [保存]          │
└───────────────────────────────────────────────┘
```

#### 提供商→模型名称映射表

| 提供商 | 可选模型 |
|--------|---------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, o1, o1-mini, o3-mini |
| Anthropic | claude-sonnet-4-20250514, claude-3-5-haiku-20241022, claude-3-opus-20240229 |
| Google | gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash |
| DeepSeek | deepseek-chat, deepseek-reasoner |
| Qwen | qwen-plus, qwen-turbo, qwen-max |
| Custom | (自由输入) |

### 5.4 密钥分发页面

复用 RoleAssign 的卡片+模态框UI模式:

```
┌──────────────────────────────────────────────────────────────────┐
│  密钥分发                                                        │
│  为节点分配主业务密钥和辅助业务密钥                                   │
├──────────────────────────────────────────────────────────────────┤
│  🔍 搜索节点 (名称/邮箱/节点ID)...                                 │
│                                                                  │
│  筛选: [全部 ▼]  已分配 / 未分配 / 全部                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ 🟢 橋本 透        │  │ 🔴 test-node     │  │ 🟢 node-win    │ │
│  │ ou-shigou@...    │  │ test-nod..2e-001 │  │ nt_002         │ │
│  │ e6527cbe..2c7812 │  │                  │  │                │ │
│  │                  │  │                  │  │                │ │
│  │ ───────────────  │  │ ───────────────  │  │ ──────────── │   │
│  │ 主: ✅ gpt-4o    │  │ 主: ─            │  │ 主: ─          │ │
│  │ 辅: ✅ deepseek  │  │ 辅: ─            │  │ 辅: ─          │ │
│  │                  │  │                  │  │                │ │
│  │  [管理密钥]      │  │  [分配密钥]      │  │  [分配密钥]      │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 5.5 分配/管理密钥模态框

#### 新分配 (未分配节点):

```
┌───────────────────────────────────────────────┐
│  分配密钥 — 橋本 透                             │
│  节点: e6527cbe..2c7812                        │
├───────────────────────────────────────────────┤
│                                               │
│  主业务密钥                                     │
│  ┌─────────────────────────────────────────┐  │
│  │ 生产环境 OpenAI (gpt-4o)            ▼   │  │
│  └─────────────────────────────────────────┘  │
│   • 生产环境 OpenAI (gpt-4o)                  │
│   • 测试 Anthropic (claude-sonnet-4-...)      │
│   • (无)                                      │
│                                               │
│  辅助业务密钥                                   │
│  ┌─────────────────────────────────────────┐  │
│  │ DeepSeek (deepseek-chat)            ▼   │  │
│  └─────────────────────────────────────────┘  │
│   • DeepSeek (deepseek-chat)                  │
│   • Qwen (qwen-plus)                         │
│   • (无)                                      │
│                                               │
│             [取消]              [分配]          │
└───────────────────────────────────────────────┘
```

#### 已分配节点 (管理):

```
┌───────────────────────────────────────────────┐
│  管理密钥 — 橋本 透                             │
│  节点: e6527cbe..2c7812                        │
├───────────────────────────────────────────────┤
│                                               │
│  主业务密钥                                     │
│  ┌─────────────────────────────────────────┐  │
│  │ 生产环境 OpenAI (gpt-4o)            ▼   │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  辅助业务密钥                                   │
│  ┌─────────────────────────────────────────┐  │
│  │ DeepSeek (deepseek-chat)            ▼   │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│   [解绑全部]       [取消]         [更新]        │
└───────────────────────────────────────────────┘
```

---

## 6. WinClaw 客户端更新

### 6.1 grc-client.ts 类型扩展

```typescript
// 现有类型
export type GrcConfigPullResult = {
  ok: boolean;
  revision: number;
  role_id: string | null;
  role_mode: string | null;
  files: Record<string, string>;
};

// 扩展后
export type KeyConfigEntry = {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
};

export type KeyConfig = {
  primary: KeyConfigEntry | null;
  auxiliary: KeyConfigEntry | null;
};

export type GrcConfigPullResult = {
  ok: boolean;
  revision: number;
  role_id: string | null;
  role_mode: string | null;
  files: Record<string, string>;
  key_config: KeyConfig | null;        // 新增
};
```

### 6.2 grc-sync.ts 密钥同步逻辑

在现有 `syncRoleConfig()` 方法中追加密钥配置处理:

```typescript
// 现有流程: check → pull → write MD files → report

async syncRoleConfig(): Promise<void> {
  const state = await this.readConfigState();
  const check = await this.client.checkConfig(this.nodeId, state.appliedRevision);

  if (!check.has_update) return;

  const result = await this.client.pullConfig(this.nodeId);

  // 现有: 写入MD文件到workspace
  for (const [filename, content] of Object.entries(result.files)) {
    const filePath = path.join(this.workspaceDir, filename);
    await fs.writeFile(filePath, content, "utf-8");
  }

  // 新增: 密钥配置同步到 winclaw.json
  if (result.key_config !== undefined) {
    await this.syncKeyConfig(result.key_config);
  }

  // 报告同步完成
  await this.client.reportConfigStatus(this.nodeId, result.revision, true);
  await this.writeConfigState({ ...state, appliedRevision: result.revision });
}

/**
 * 将密钥配置写入 ~/.winclaw/winclaw.json
 */
private async syncKeyConfig(keyConfig: KeyConfig | null): Promise<void> {
  const configPath = path.join(this.stateDir, "winclaw.json");
  let config: Record<string, unknown> = {};

  try {
    const raw = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(raw);
  } catch {
    // 文件不存在或解析失败, 使用空对象
  }

  if (keyConfig === null) {
    // 解绑: 删除密钥配置段
    delete config.providers;
    delete config.auxiliaryKeys;
    this.logger.info("Key config removed from winclaw.json");
  } else {
    // 分配/更新: 写入密钥配置
    if (keyConfig.primary) {
      config.providers = [{
        provider: keyConfig.primary.provider,
        model:    keyConfig.primary.model,
        apiKey:   keyConfig.primary.apiKey,
        ...(keyConfig.primary.baseUrl ? { baseUrl: keyConfig.primary.baseUrl } : {}),
      }];
    } else {
      delete config.providers;
    }

    if (keyConfig.auxiliary) {
      config.auxiliaryKeys = [{
        provider: keyConfig.auxiliary.provider,
        model:    keyConfig.auxiliary.model,
        apiKey:   keyConfig.auxiliary.apiKey,
        ...(keyConfig.auxiliary.baseUrl ? { baseUrl: keyConfig.auxiliary.baseUrl } : {}),
      }];
    } else {
      delete config.auxiliaryKeys;
    }

    this.logger.info("Key config synced to winclaw.json");
  }

  // 原子写入 (temp → rename)
  const tmpPath = configPath + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(config, null, 2), "utf-8");
  await fs.rename(tmpPath, configPath);
}
```

### 6.3 winclaw.json 密钥配置结构

同步后的 `~/.winclaw/winclaw.json` 结构:

```json
{
  "nodeId": "e6527cbe-2c7812",
  "version": "2026.3.6",

  "providers": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "baseUrl": "https://api.openai.com/v1"
    }
  ],

  "auxiliaryKeys": [
    {
      "provider": "deepseek",
      "model": "deepseek-chat",
      "apiKey": "sk-yyyyyyyyyyyyyyyyyyyy"
    }
  ]
}
```

---

## 7. Dashboard React Query Hooks

```typescript
// file: dashboard/src/api/hooks.ts (追加)

// ── 密钥 CRUD ──
export function useModelKeys(params?: { category?: string; provider?: string; is_active?: boolean; page?: number; page_size?: number }) {
  return useQuery({ queryKey: ['admin', 'model-keys', params], queryFn: () => apiClient.get('/api/v1/admin/model-keys', params) });
}
export function useModelKey(id: string) {
  return useQuery({ queryKey: ['admin', 'model-keys', id], queryFn: () => apiClient.get(`/api/v1/admin/model-keys/${id}`), enabled: !!id });
}
export function useCreateModelKey() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data) => apiClient.post('/api/v1/admin/model-keys', data), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'model-keys'] }) });
}
export function useUpdateModelKey() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...data }) => apiClient.put(`/api/v1/admin/model-keys/${id}`, data), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'model-keys'] }) });
}
export function useDeleteModelKey() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => apiClient.del(`/api/v1/admin/model-keys/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'model-keys'] }) });
}

// ── 节点密钥分配 ──
export function useAssignKeys() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ nodeId, ...data }) => apiClient.post(`/api/v1/admin/nodes/${nodeId}/assign-keys`, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'employees'] }); qc.invalidateQueries({ queryKey: ['admin', 'nodes'] }); } });
}
export function useUnassignKeys() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (nodeId: string) => apiClient.post(`/api/v1/admin/nodes/${nodeId}/unassign-keys`, {}), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'employees'] }); qc.invalidateQueries({ queryKey: ['admin', 'nodes'] }); } });
}
export function useUpdateNodeKeys() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ nodeId, ...data }) => apiClient.put(`/api/v1/admin/nodes/${nodeId}/update-keys`, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'employees'] }); qc.invalidateQueries({ queryKey: ['admin', 'nodes'] }); } });
}
```

---

## 8. 国际化 (i18n)

扩展 `public/locales/{en,zh,ja,ko}/apikeys.json`, 添加 `modelKeys` 命名空间:

### EN

```json
{
  "modelKeys": {
    "title": "AI Model Keys",
    "subtitle": "Manage API keys for AI model providers",
    "tabs": { "primary": "Primary Keys", "auxiliary": "Auxiliary Keys" },
    "table": { "name": "Name", "provider": "Provider", "model": "Model", "status": "Status", "updated": "Updated", "actions": "Actions" },
    "addKey": "Add Key",
    "editKey": "Edit Key",
    "form": { "category": "Category", "categoryPrimary": "Primary Business Key", "categoryAuxiliary": "Auxiliary Business Key", "name": "Name", "provider": "Provider", "model": "Model Name", "apiKey": "API Key", "showKey": "Show Key", "hideKey": "Hide Key", "baseUrl": "Base URL", "baseUrlHint": "Optional, for custom endpoints", "notes": "Notes", "active": "Active", "save": "Save", "saving": "Saving...", "cancel": "Cancel" },
    "distribute": { "title": "Key Distribution", "subtitle": "Assign primary and auxiliary keys to nodes", "search": "Search nodes...", "filterAll": "All", "filterAssigned": "Assigned", "filterUnassigned": "Unassigned", "primaryKey": "Primary", "auxiliaryKey": "Auxiliary", "assignBtn": "Assign Keys", "manageBtn": "Manage Keys", "noneOption": "(None)", "assigned": "Assigned", "unassigned": "Unassigned" },
    "assignModal": { "assignTitle": "Assign Keys — {{name}}", "manageTitle": "Manage Keys — {{name}}", "node": "Node", "selectPrimary": "Select primary key...", "selectAuxiliary": "Select auxiliary key...", "assign": "Assign", "assigning": "Assigning...", "update": "Update", "updating": "Updating...", "unbindAll": "Unbind All" },
    "confirm": { "delete": "Are you sure you want to delete this key?", "deleteInUse": "This key is assigned to {{count}} node(s). Unbind first.", "unbind": "Unbind all keys from this node?" }
  }
}
```

### ZH

```json
{
  "modelKeys": {
    "title": "AI 模型密钥",
    "subtitle": "管理AI模型提供商的API密钥",
    "tabs": { "primary": "主业务密钥", "auxiliary": "辅助业务密钥" },
    "table": { "name": "名称", "provider": "提供商", "model": "模型名称", "status": "状态", "updated": "更新时间", "actions": "操作" },
    "addKey": "添加密钥",
    "editKey": "编辑密钥",
    "form": { "category": "类别", "categoryPrimary": "主业务密钥", "categoryAuxiliary": "辅助业务密钥", "name": "名称", "provider": "提供商", "model": "模型名称", "apiKey": "API 密钥", "showKey": "显示密钥", "hideKey": "隐藏密钥", "baseUrl": "基础URL", "baseUrlHint": "可选, 用于自定义端点", "notes": "备注", "active": "激活", "save": "保存", "saving": "保存中...", "cancel": "取消" },
    "distribute": { "title": "密钥分发", "subtitle": "为节点分配主业务密钥和辅助业务密钥", "search": "搜索节点...", "filterAll": "全部", "filterAssigned": "已分配", "filterUnassigned": "未分配", "primaryKey": "主密钥", "auxiliaryKey": "辅密钥", "assignBtn": "分配密钥", "manageBtn": "管理密钥", "noneOption": "(无)", "assigned": "已分配", "unassigned": "未分配" },
    "assignModal": { "assignTitle": "分配密钥 — {{name}}", "manageTitle": "管理密钥 — {{name}}", "node": "节点", "selectPrimary": "选择主业务密钥...", "selectAuxiliary": "选择辅助业务密钥...", "assign": "分配", "assigning": "分配中...", "update": "更新", "updating": "更新中...", "unbindAll": "解绑全部" },
    "confirm": { "delete": "确定要删除此密钥吗？", "deleteInUse": "此密钥已分配给 {{count}} 个节点，请先解绑。", "unbind": "确定要解绑此节点的所有密钥吗？" }
  }
}
```

### JA

```json
{
  "modelKeys": {
    "title": "AIモデル密鍵",
    "subtitle": "AIモデルプロバイダーのAPI密鍵を管理",
    "tabs": { "primary": "主業務密鍵", "auxiliary": "補助業務密鍵" },
    "table": { "name": "名称", "provider": "プロバイダー", "model": "モデル名", "status": "ステータス", "updated": "更新日", "actions": "操作" },
    "addKey": "密鍵を追加",
    "editKey": "密鍵を編集",
    "form": { "category": "カテゴリー", "categoryPrimary": "主業務密鍵", "categoryAuxiliary": "補助業務密鍵", "name": "名称", "provider": "プロバイダー", "model": "モデル名", "apiKey": "API密鍵", "showKey": "密鍵を表示", "hideKey": "密鍵を非表示", "baseUrl": "ベースURL", "baseUrlHint": "任意、カスタムエンドポイント用", "notes": "メモ", "active": "有効", "save": "保存", "saving": "保存中...", "cancel": "キャンセル" },
    "distribute": { "title": "密鍵配布", "subtitle": "ノードに主業務密鍵と補助業務密鍵を割り当て", "search": "ノードを検索...", "filterAll": "すべて", "filterAssigned": "割当済", "filterUnassigned": "未割当", "primaryKey": "主密鍵", "auxiliaryKey": "補助密鍵", "assignBtn": "密鍵を割当", "manageBtn": "密鍵を管理", "noneOption": "(なし)", "assigned": "割当済", "unassigned": "未割当" },
    "assignModal": { "assignTitle": "密鍵割当 — {{name}}", "manageTitle": "密鍵管理 — {{name}}", "node": "ノード", "selectPrimary": "主業務密鍵を選択...", "selectAuxiliary": "補助業務密鍵を選択...", "assign": "割当", "assigning": "割当中...", "update": "更新", "updating": "更新中...", "unbindAll": "全解除" },
    "confirm": { "delete": "この密鍵を削除しますか？", "deleteInUse": "この密鍵は{{count}}個のノードに割当済みです。先に解除してください。", "unbind": "このノードの全密鍵を解除しますか？" }
  }
}
```

### KO

```json
{
  "modelKeys": {
    "title": "AI 모델 키",
    "subtitle": "AI 모델 제공업체의 API 키 관리",
    "tabs": { "primary": "주요 업무 키", "auxiliary": "보조 업무 키" },
    "table": { "name": "이름", "provider": "제공업체", "model": "모델명", "status": "상태", "updated": "업데이트", "actions": "작업" },
    "addKey": "키 추가",
    "editKey": "키 편집",
    "form": { "category": "카테고리", "categoryPrimary": "주요 업무 키", "categoryAuxiliary": "보조 업무 키", "name": "이름", "provider": "제공업체", "model": "모델명", "apiKey": "API 키", "showKey": "키 표시", "hideKey": "키 숨기기", "baseUrl": "기본 URL", "baseUrlHint": "선택사항, 커스텀 엔드포인트용", "notes": "메모", "active": "활성", "save": "저장", "saving": "저장 중...", "cancel": "취소" },
    "distribute": { "title": "키 배포", "subtitle": "노드에 주요 업무 키와 보조 업무 키 할당", "search": "노드 검색...", "filterAll": "전체", "filterAssigned": "할당됨", "filterUnassigned": "미할당", "primaryKey": "주요 키", "auxiliaryKey": "보조 키", "assignBtn": "키 할당", "manageBtn": "키 관리", "noneOption": "(없음)", "assigned": "할당됨", "unassigned": "미할당" },
    "assignModal": { "assignTitle": "키 할당 — {{name}}", "manageTitle": "키 관리 — {{name}}", "node": "노드", "selectPrimary": "주요 업무 키 선택...", "selectAuxiliary": "보조 업무 키 선택...", "assign": "할당", "assigning": "할당 중...", "update": "업데이트", "updating": "업데이트 중...", "unbindAll": "전체 해제" },
    "confirm": { "delete": "이 키를 삭제하시겠습니까?", "deleteInUse": "이 키는 {{count}}개 노드에 할당되어 있습니다. 먼저 해제하세요.", "unbind": "이 노드의 모든 키를 해제하시겠습니까?" }
  }
}
```

---

## 9. 文件变更清单

### GRC Server (`C:\work\grc`)

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `src/shared/db/migrations/010_ai_model_keys.sql` | **新建** | DDL: ai_model_keys表 + nodes列扩展 |
| `src/modules/model-keys/schema.ts` | **新建** | Drizzle ORM 定义 |
| `src/modules/model-keys/service.ts` | **新建** | CRUD + AES加密 + 节点分配逻辑 |
| `src/modules/model-keys/admin-routes.ts` | **新建** | Express Router (9个端点) |
| `src/module-loader.ts` | **修改** | moduleMap + adminModuleMap 添加 model-keys |
| `src/config.ts` | **修改** | modules.modelKeys 开关 |
| `src/modules/evolution/schema.ts` | **修改** | nodesTable 添加3列 |
| `src/modules/roles/service.ts` | **修改** | getNodeConfig() 返回 key_config |
| `src/modules/roles/routes.ts` | **修改** | /a2a/config/pull 响应追加 key_config |

### GRC Dashboard (`C:\work\grc\dashboard`)

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `src/pages/auth/ModelKeys.tsx` | **新建** | 密钥管理页面 (CRUD + Tabs) |
| `src/pages/auth/ModelKeyDistribute.tsx` | **新建** | 密钥分发页面 (Cards + Modal) |
| `src/App.tsx` | **修改** | 添加2个路由 |
| `src/components/Sidebar.tsx` | **修改** | AUTH子菜单添加2项 |
| `src/api/hooks.ts` | **修改** | 添加8个React Query hooks |
| `public/locales/en/apikeys.json` | **修改** | 添加 modelKeys 翻译 |
| `public/locales/zh/apikeys.json` | **修改** | 添加 modelKeys 翻译 |
| `public/locales/ja/apikeys.json` | **修改** | 添加 modelKeys 翻译 |
| `public/locales/ko/apikeys.json` | **修改** | 添加 modelKeys 翻译 |

### WinClaw (`C:\work\winclaw`)

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `src/infra/grc-client.ts` | **修改** | GrcConfigPullResult 类型添加 key_config |
| `src/infra/grc-sync.ts` | **修改** | 添加 syncKeyConfig() 方法 |

### 设计文档 (`C:\work\winclaw\docs`)

| 文件路径 | 变更类型 |
|---------|---------|
| `GRC_API_Key_Management_Design.md` | **新建** — 本文档 |

---

## 10. 验证计划

| # | 测试项 | 验证方法 |
|---|--------|---------|
| 1 | 数据库迁移 | 执行SQL, 确认表和列创建成功 |
| 2 | 密钥创建 | Dashboard添加主/辅密钥, 确认DB中加密存储 |
| 3 | 密钥编辑 | 修改密钥名称/模型/API Key, 确认更新 |
| 4 | 密钥删除 | 删除未分配密钥成功; 删除已分配密钥被拒绝 |
| 5 | 密钥分配 | 分发页面为节点分配主+辅密钥, 确认configRevision++ |
| 6 | Config Pull | WinClaw pull时响应包含 key_config 字段 |
| 7 | winclaw.json写入 | 节点同步后确认providers和auxiliaryKeys写入正确 |
| 8 | 密钥解绑 | 解绑后configRevision++, 同步后winclaw.json密钥段被删除 |
| 9 | 密钥更新 | 更换密钥后configRevision++, 同步后winclaw.json更新为新密钥 |
| 10 | TypeScript | `tsc --noEmit` 零错误 |
| 11 | 构建 | `npm run build` 成功 |
| 12 | 多语言 | 4语言(EN/ZH/JA/KO)下密钥管理和分发页面正确显示 |
