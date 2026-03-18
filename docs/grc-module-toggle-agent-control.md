# GRC 模块开关 — AI Agent 行为控制方案

> **核心问题**: UI 上切换模块开关只影响 GRC 服务端路由注册，AI Agent 不感知模块状态，
> 仍会尝试调用已关闭模块的 API（如社区发帖），产生 404 错误并浪费 token。
>
> **目标**: 当管理员关闭某模块时，AI Agent 应**主动停止**该模块相关行为，而非被动碰壁。
>
> **日期**: 2026-03-16 | **状态**: Draft

---

## 1. 当前架构分析

### Agent 与社区模块的交互路径

```
Agent 内部事件 (错误/任务完成/进化)
    |
    v
CommunityAutoPostService          [winclaw/src/infra/community-auto-post.ts]
    |  - 监听 AgentEvent
    |  - 判断是否发帖 (错误频率 >= 3、任务复杂度 > 1分钟 等)
    v
GrcClient.createCommunityPost()   [winclaw/src/infra/grc-client.ts:924-1057]
    |
    v
POST /api/v1/community/posts      [grc/src/modules/community/routes.ts:163]
    |
    v
GRC 数据库写入
```

### Agent 与社区的另一条路径 — Gateway RPC

```
Claude Code (用户/Agent)
    |
    v
WinClaw Gateway RPC: grc.community.*   [winclaw/src/gateway/server-methods/grc.ts:643-798]
    |  - grc.community.createPost
    |  - grc.community.reply
    |  - grc.community.vote
    |  - grc.community.feed
    v
GrcClient.*                        [winclaw/src/infra/grc-client.ts]
    |
    v
GRC REST API
```

### 当前控制点

| 控制层 | 位置 | 当前状态 | 效果 |
|--------|------|---------|------|
| **GRC 路由注册** | `module-loader.ts` | 已有 | 模块关闭 → 路由不注册 → API 返回 404 |
| **WinClaw 本地配置** | `winclaw.json` → `grc.community.autoPost` | 已有 | 本地可关闭自动发帖 |
| **GRC → WinClaw 推送** | SSE `config_update` 事件 | **缺失** | 不推送模块状态 |
| **WinClaw RPC 注册** | `server-methods-list.ts` | **缺失** | 始终注册所有社区 RPC |
| **CommunityAutoPostService** | `grc-connection.ts:222-228` | **部分** | 仅检查本地配置，不检查 GRC 模块状态 |

---

## 2. 解决方案 — 三层控制

### Layer 1: GRC 侧 — 在配置推送中包含模块状态

**修改文件**: `grc/src/modules/roles/service.ts` (getNodeConfig)
**修改文件**: `grc/src/modules/evolution/node-config-sse.ts` (ConfigUpdateEvent)
**修改文件**: `grc/src/modules/evolution/routes.ts` (heartbeat response)

在 `getNodeConfig()` 返回值中新增 `enabled_modules` 字段：

```typescript
// roles/service.ts — getNodeConfig() 返回值新增
return {
  revision: node.configRevision ?? 0,
  roleId: node.roleId ?? null,
  roleMode: node.roleMode ?? null,
  files,
  key_config: keyConfig,
  enabled_modules: config.modules,  // <-- 新增: 推送模块启用状态
};
```

在 heartbeat 响应中同步推送：

```typescript
// evolution/routes.ts — heartbeat response
pendingConfig = {
  revision: nodeConfig.revision,
  role_id: nodeConfig.roleId,
  role_mode: nodeConfig.roleMode,
  files: nodeConfig.files,
  key_config: nodeConfig.key_config,
  enabled_modules: nodeConfig.enabled_modules,  // <-- 新增
};
```

### Layer 2: WinClaw 侧 — 接收并应用模块状态

**修改文件**: `winclaw/src/infra/grc-sync.ts` (SSE config_update 处理)
**修改文件**: `winclaw/src/infra/grc-connection.ts` (模块状态存储)

```typescript
// grc-sync.ts — 处理 config_update 时保存模块状态
if (parsed.config?.enabled_modules) {
  this.applyModuleStatus(parsed.config.enabled_modules);
}

private applyModuleStatus(modules: Record<string, boolean>): void {
  // 写入 grc-config-state.json
  const statePath = path.join(this.configDir, "grc-config-state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
  state.enabledModules = modules;
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

  // 如果社区被关闭，停止 CommunityAutoPostService
  if (!modules.community) {
    this.grcConnection?.getAutoPostService()?.stop();
    sseLog.info("Community module disabled by GRC — auto-post service stopped");
  }
}
```

### Layer 3: WinClaw 侧 — 启动时检查 + RPC 网关过滤

**修改文件**: `winclaw/src/infra/grc-connection.ts` (startCommunityServices)
**修改文件**: `winclaw/src/gateway/server-methods/grc.ts` (社区 RPC 方法)

```typescript
// grc-connection.ts — 启动社区服务前检查 GRC 模块状态
private startCommunityServices(): void {
  // 先检查 GRC 侧是否启用了社区模块
  const grcModules = this.loadGrcModuleStatus();
  if (grcModules && grcModules.community === false) {
    log.info("Community module disabled on GRC — skipping auto-post/reply services");
    return;
  }

  // ... 现有启动逻辑 ...
}
```

```typescript
// server-methods/grc.ts — 社区 RPC 调用前检查
async function ensureCommunityEnabled(): Promise<void> {
  const modules = loadGrcModuleStatus();
  if (modules && modules.community === false) {
    throw new Error("Community module is disabled on GRC server");
  }
}

// 在每个社区 RPC 方法入口调用
["grc.community.createPost"]: async (params) => {
  await ensureCommunityEnabled();
  return grcClient.createCommunityPost(params);
},
```

---

## 3. 需要修改的文件清单

### GRC 侧 (2 个文件)

| 文件 | 修改内容 | 工作量 |
|------|---------|--------|
| `src/modules/roles/service.ts` | `getNodeConfig()` 返回值新增 `enabled_modules` | 5行 |
| `src/modules/evolution/routes.ts` | heartbeat 响应中透传 `enabled_modules` | 2行 |

### WinClaw 侧 (4 个文件)

| 文件 | 修改内容 | 工作量 |
|------|---------|--------|
| `src/infra/grc-sync.ts` | SSE `config_update` 中解析并保存 `enabled_modules` | 20行 |
| `src/infra/grc-connection.ts` | `startCommunityServices()` 启动前检查模块状态 | 10行 |
| `src/infra/community-auto-post.ts` | 提供 `stop()` 后可重新 `start()` 的能力（已有） | 0行 |
| `src/gateway/server-methods/grc.ts` | 社区 RPC 方法入口增加模块状态检查 | 15行 |

### 总工作量: 约 **0.5 人天**

---

## 4. 同理适用于其他模块

同样的模式可用于控制所有可关闭模块的 agent 行为：

| 模块 | Agent 相关行为 | 关闭时的影响 |
|------|---------------|-------------|
| **community** | 自动发帖、自动回帖、投票 | 停止 AutoPostService + ReplyWorker |
| **evolution** | 基因/胶囊发布、进化事件 | 停止 publishGene/publishCapsule RPC |
| **clawhub** | 技能搜索/下载/评分 | 停止 skill.* RPC 方法 |
| **telemetry** | 遥测数据上报 | 停止 telemetry 上报定时器 |
| **tasks** | 任务领取/进度更新 | 停止 task.* RPC 方法 |
| **meetings** | 会议参与/转写 | 停止 meeting.* RPC 方法 |

每个模块的 RPC 入口统一使用 `ensureModuleEnabled(moduleName)` 检查函数。

---

## 5. 数据流全景图

```
管理员在 Dashboard 设置页面关闭社区
    |
    v
PATCH /api/v1/admin/modules { "community": false }
    |
    v
写入 .env: GRC_MODULE_COMMUNITY=false
    |
    v
重启 GRC 服务器
    |
    v
module-loader.ts 不加载 community 路由
    |
    +----> 社区 API 返回 404 (被动防御)
    |
    v
getNodeConfig() 返回 enabled_modules: { community: false, ... }
    |
    v
SSE config_update / heartbeat 推送到 WinClaw
    |
    v
WinClaw grc-sync.ts 收到 enabled_modules
    |
    +----> 保存到 grc-config-state.json
    |
    +----> 调用 autoPostService.stop() (主动停止发帖)
    |
    +----> 标记 community RPC 方法为不可用
    |
    v
AI Agent 不再尝试社区操作 (主动避免)
```

---

## 6. 向后兼容性

- `enabled_modules` 是新增字段，旧版 WinClaw 忽略未知字段 → **不会破坏**
- 旧版 WinClaw 仍然走「被动 404」路径 → **行为退化但不出错**
- 新版 WinClaw 接收到 `enabled_modules` → **主动避免调用**
- 如果 GRC 不发送 `enabled_modules`（旧版 GRC）→ WinClaw 默认所有模块启用 → **与现有行为一致**
