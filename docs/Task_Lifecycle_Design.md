# WinClaw タスクライフサイクル設計書

> **ステータス:** Draft v1.0
> **作成日:** 2026-03-13
> **対象:** GRC Server + WinClaw Gateway
> **前提:** CEO Agent Autonomous Task Creation パイプライン完成済み

---

## 1. 概要

### 1.1 現状分析

CEO Agent が GRC に自律的にタスクを作成する E2E パイプラインは完成した:

```
Strategy Deploy → SSE Push → Heartbeat Wake → CEO Agent Session → grc_task Tool → POST /a2a/tasks/create
```

しかし、**作成されたタスクのライフサイクル後半が完全に欠落**している:

| 機能 | GRC (サーバー側) | WinClaw (ノード側) | 状態 |
|------|------------------|-------------------|------|
| タスク作成 | `POST /a2a/tasks/create` | `grc_task` ツール + `GrcClient.createAgentTask()` | **完成** |
| タスク配信 | `GET /a2a/tasks/mine` (ポーリング) | なし | **未実装** |
| SSE タスク通知 | なし (`config_update` のみ) | なし | **未実装** |
| タスク受領・実行 | — | なし | **未実装** |
| 進捗報告 | `POST /a2a/tasks/update` | なし | **未実装** |
| 完了報告 | ステータス遷移 `in_progress → review` | なし | **未実装** |
| 検収 (承認/差戻し) | ステータス遷移 `review → approved / in_progress` | なし | **未実装** |
| 復盤 | `task_progress_log` テーブル (データは蓄積) | なし | **未実装** |

### 1.2 設計目標

1. **各ノードが自分に割り当てられたタスクをリアルタイムに受信・実行できる**
2. **タスク完了時に起草者ノードへ自動通知し、検収ワークフローを起動**
3. **差戻し・再実行のループを支援**
4. **復盤データを自動集計し振り返りに活用**
5. **既存インフラ (SSE/Heartbeat/Relay Queue) を最大限再利用**
6. **新しい DB ステータスは追加しない** — 既存ステータスマシンで完結

### 1.3 既存ステータスマシン

```
VALID_TRANSITIONS = {
  draft:       ["pending"],
  pending:     ["in_progress", "cancelled"],
  in_progress: ["blocked", "review", "completed"],
  blocked:     ["in_progress", "cancelled"],
  review:      ["approved", "in_progress"],   ← 検収: 承認 or 差戻し
  approved:    ["completed"],
}
```

- `review` = 完了報告の提出 (「レビューしてください」)
- `review → approved` = 検収合格
- `review → in_progress` = 差戻し (コメントでフィードバック付与)
- `approved → completed` = 最終完了

---

## 2. アーキテクチャ概要

### 2.1 全体フロー

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GRC Server                                         │
│                                                                             │
│  ┌──────────────┐   SSE Push    ┌──────────────┐   SSE Push    ┌─────────┐ │
│  │ Task Service  │─────────────→│ SSE Manager   │─────────────→│ Node B  │ │
│  │              │              │ (node-config   │              │ (担当者) │ │
│  │ status →     │              │  -sse.ts)      │              │         │ │
│  │ review       │──────────────│───────────────→│──────────────│ Node A  │ │
│  │              │  task_completed               │              │ (起草者) │ │
│  └──────────────┘              └──────────────┘              └─────────┘ │
│         ↑                              ↑                                   │
│         │ POST /a2a/tasks/update       │ Heartbeat Poll (fallback)         │
│         │ POST /a2a/tasks/comment      │ GET /a2a/tasks/pending            │
│         └──────────────────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 配信モデル: ハイブリッド Push/Pull

| チャネル | 用途 | 遅延 | 条件 |
|----------|------|------|------|
| **SSE Push** (主) | タスク割当・完了・差戻しのリアルタイム通知 | ~即時 | ノードがSSE接続中 |
| **Heartbeat Poll** (副) | SSE切断中のフォールバック | ~heartbeat間隔 | SSE未接続時 |
| **Relay Queue** (補) | 長期オフラインノードへのメッセージ蓄積 | ノード復帰時 | SSE/Heartbeat両方失敗時 |

---

## 3. Phase 1: タスク配信 (GRC → Node)

### 3.1 GRC側: SSE イベント拡張

**ファイル:** `src/modules/evolution/node-config-sse.ts`

現在は `config_update` イベントのみ。以下のタスクイベントを追加:

```typescript
// 新規イベント型定義
export interface TaskSSEEvent {
  event_type: "task_assigned" | "task_feedback" | "task_completed";
  task_id: string;
  task_code: string;
  title: string;
  priority: string;
  category: string;
  status: string;
  assigned_role_id?: string;
  creator_node_id?: string;
  creator_role_id?: string;
  feedback?: string;        // 差戻し時のコメント
  result_summary?: string;  // 完了時の結果概要
}
```

SSE送信:
```
event: task_event
data: {"event_type":"task_assigned","task_id":"...","task_code":"TSK-001",...}
```

**既存 `pushToNode()` メソッドを活用:**

```typescript
// 新メソッド追加
pushTaskEvent(nodeId: string, event: TaskSSEEvent): boolean {
  const conns = this.connections.get(nodeId);
  if (!conns?.size) return false;
  const payload = `event: task_event\ndata: ${JSON.stringify(event)}\n\n`;
  // ... 既存の pushToNode と同じ送信ロジック
}
```

### 3.2 GRC側: タスク割当時の SSE トリガー

**ファイル:** `src/modules/tasks/service.ts`

`changeStatus()` 内のステータス遷移時に SSE 通知を発火:

```typescript
// changeStatus() 内に追加
async changeStatus(id: string, newStatus: string, actor: string) {
  // ... 既存ロジック ...

  // SSE通知トリガー (新規追加)
  if (newStatus === "pending" && task.assignedNodeId) {
    // タスク割当通知 → 担当ノードへ
    nodeConfigSSE.pushTaskEvent(task.assignedNodeId, {
      event_type: "task_assigned",
      task_id: task.id,
      task_code: task.taskCode,
      title: task.title,
      priority: task.priority,
      category: task.category,
      status: newStatus,
      creator_node_id: task.assignedBy,  // 起草者情報
      creator_role_id: extractRoleFromAssignedBy(task.assignedBy),
    });
  }

  if (newStatus === "review") {
    // 完了報告通知 → 起草者ノードへ
    const creatorNodeId = extractNodeIdFromAssignedBy(task.assignedBy);
    if (creatorNodeId) {
      nodeConfigSSE.pushTaskEvent(creatorNodeId, {
        event_type: "task_completed",
        task_id: task.id,
        task_code: task.taskCode,
        title: task.title,
        priority: task.priority,
        category: task.category,
        status: newStatus,
        result_summary: task.resultSummary ?? undefined,
      });
    }
  }

  if (newStatus === "in_progress" && fromStatus === "review") {
    // 差戻し通知 → 担当ノードへ
    if (task.assignedNodeId) {
      nodeConfigSSE.pushTaskEvent(task.assignedNodeId, {
        event_type: "task_feedback",
        task_id: task.id,
        task_code: task.taskCode,
        title: task.title,
        priority: task.priority,
        category: task.category,
        status: newStatus,
        feedback: latestComment,  // 直近のコメントを取得
      });
    }
  }
}
```

### 3.3 GRC側: 新規エンドポイント

**ファイル:** `src/modules/tasks/routes.ts`

```typescript
// 新規: ノードに割り当てられた未処理タスク一覧
// GET /a2a/tasks/pending?node_id=xxx
app.get("/a2a/tasks/pending", async (c) => {
  const nodeId = c.req.query("node_id");
  // assignedNodeId = nodeId かつ status IN ("pending", "in_progress", "blocked") のタスクを返す
  // assignedRoleId でもマッチ (nodeId 未指定で roleId 指定のタスク)
});
```

既存の `GET /a2a/tasks/mine` との違い:
- `/mine` = ノードに割り当てられた全タスク (全ステータス)
- `/pending` = アクションが必要な未完了タスクのみ (pending, in_progress, blocked)

### 3.4 WinClaw側: GrcClient 拡張

**ファイル:** `src/infra/grc-client.ts`

```typescript
// 新規メソッド追加

/** 未処理タスクの取得 (Heartbeat ポーリング用) */
async fetchPendingTasks(nodeId: string): Promise<GrcApiResult<{ tasks: Task[]; count: number }>> {
  return this.request(`/a2a/tasks/pending?node_id=${encodeURIComponent(nodeId)}`, {});
}

/** タスクステータス更新 (進捗報告) */
async updateTaskStatus(params: {
  task_id: string;
  node_id: string;
  status?: string;
  result_summary?: string;
  result_data?: Record<string, unknown>;
}): Promise<GrcApiResult<{ task: Task }>> {
  return this.request("/a2a/tasks/update", { method: "POST", body: JSON.stringify(params) });
}

/** タスクコメント追加 */
async addTaskComment(params: {
  task_id: string;
  node_id: string;
  content: string;
}): Promise<GrcApiResult<{ comment: TaskComment }>> {
  return this.request("/a2a/tasks/comment", { method: "POST", body: JSON.stringify(params) });
}
```

### 3.5 WinClaw側: SSE タスクイベントハンドラー

**ファイル:** `src/infra/grc-sync.ts`

`handleSSEEvent()` に `task_event` 処理を追加:

```typescript
// handleSSEEvent() 内に追加
if (eventType === "task_event") {
  const taskEvent = JSON.parse(data);
  const { event_type, task_id, task_code, title, priority } = taskEvent;

  switch (event_type) {
    case "task_assigned":
      // システムイベントをキューに追加 → Heartbeat wake
      enqueueSystemEvent(
        `[Task Assigned] ${task_code}: ${title} (Priority: ${priority})`,
        { contextKey: `task:assigned:${task_id}` }
      );
      requestHeartbeatNow({
        reason: `task_assigned:${task_id}`,
        coalesceMs: 2000,
      });
      break;

    case "task_completed":
      // 起草者側: 完了通知受信 → 検収セッション起動
      enqueueSystemEvent(
        `[Task Completed] ${task_code}: ${title} - Review Required`,
        { contextKey: `task:completed:${task_id}` }
      );
      requestHeartbeatNow({
        reason: `task_completed:${task_id}`,
        coalesceMs: 2000,
      });
      break;

    case "task_feedback":
      // 担当者側: 差戻し通知受信 → 再作業セッション起動
      enqueueSystemEvent(
        `[Task Feedback] ${task_code}: ${title} - Rework Required. Feedback: ${taskEvent.feedback ?? "See comments"}`,
        { contextKey: `task:feedback:${task_id}` }
      );
      requestHeartbeatNow({
        reason: `task_feedback:${task_id}`,
        coalesceMs: 2000,
      });
      break;
  }
}
```

### 3.6 WinClaw側: Heartbeat フォールバックポーリング

**ファイル:** `src/infra/heartbeat-events-filter.ts`

```typescript
// 新規: タスクイベント検出
export function isTaskEvent(reason: string): boolean {
  return reason.startsWith("task_assigned:") ||
         reason.startsWith("task_completed:") ||
         reason.startsWith("task_feedback:");
}

export function extractTaskEventType(reason: string): string {
  return reason.split(":")[0];  // "task_assigned" | "task_completed" | "task_feedback"
}

export function extractTaskId(reason: string): string {
  return reason.split(":").slice(1).join(":");  // UUID部分
}

// 新規: タスク処理用プロンプト生成
export function buildTaskEventPrompt(reason: string, taskDetails?: TaskSSEEvent): string {
  const eventType = extractTaskEventType(reason);

  switch (eventType) {
    case "task_assigned":
      return `# Task Assignment Notification

You have been assigned a new task from GRC. Please review and execute this task.

## Task Details
- Task ID: ${taskDetails?.task_id ?? "unknown"}
- Task Code: ${taskDetails?.task_code ?? "unknown"}
- Title: ${taskDetails?.title ?? "unknown"}
- Priority: ${taskDetails?.priority ?? "medium"}
- Category: ${taskDetails?.category ?? "operational"}

## Instructions
1. Analyze the task requirements
2. Use the \`grc_task_update\` tool to set status to "in_progress"
3. Execute the task deliverables
4. Use the \`grc_task_complete\` tool to submit results for review

IMPORTANT: Use the available GRC task tools to report progress and completion.`;

    case "task_completed":
      return `# Task Completion Review Required

A task you created has been completed and requires your review.

## Task Details
- Task ID: ${taskDetails?.task_id ?? "unknown"}
- Task Code: ${taskDetails?.task_code ?? "unknown"}
- Title: ${taskDetails?.title ?? "unknown"}
- Result: ${taskDetails?.result_summary ?? "See task details"}

## Instructions
1. Review the task results
2. Use \`grc_task_accept\` to approve if satisfactory
3. Use \`grc_task_reject\` to request rework with feedback if not satisfactory`;

    case "task_feedback":
      return `# Task Rework Required

Your task submission was returned for rework.

## Task Details
- Task ID: ${taskDetails?.task_id ?? "unknown"}
- Task Code: ${taskDetails?.task_code ?? "unknown"}
- Title: ${taskDetails?.title ?? "unknown"}
- Feedback: ${taskDetails?.feedback ?? "See comments"}

## Instructions
1. Review the feedback
2. Address the issues identified
3. Use \`grc_task_complete\` to resubmit`;

    default:
      return "";
  }
}
```

**Heartbeat Runner への統合:**

**ファイル:** `src/infra/heartbeat-runner.ts`

`resolveHeartbeatRunPrompt()` 内に追加:

```typescript
// 既存の config_sync 判定の直後に追加
if (opts.reason && isTaskEvent(opts.reason)) {
  const taskPrompt = buildTaskEventPrompt(opts.reason);
  if (taskPrompt) {
    prompt = taskPrompt + "\n---\n\n" + prompt;
  }
}
```

### 3.7 Heartbeat ポーリングによるタスク取得 (SSE フォールバック)

**ファイル:** `src/infra/heartbeat-runner.ts`

Heartbeat 実行時に、SSE 未接続の場合は GRC からタスクをポーリング:

```typescript
// runHeartbeatOnce() のプリフライト段階に追加
if (!grcSync.isSSEConnected()) {
  const client = getGrcClient();
  const result = await client.fetchPendingTasks(nodeId);
  if (result.ok && result.tasks.length > 0) {
    for (const task of result.tasks) {
      if (task.status === "pending") {
        enqueueSystemEvent(
          `[Task Pending] ${task.taskCode}: ${task.title}`,
          { contextKey: `task:assigned:${task.id}` }
        );
      }
    }
  }
}
```

---

## 4. Phase 2: タスク実行 (Node 内部)

### 4.1 タスク実行フロー

```
SSE task_assigned → enqueueSystemEvent → requestHeartbeatNow
                                              ↓
                               Heartbeat Runner 起動
                                              ↓
                          タスク専用プロンプト付きセッション
                                              ↓
                    Agent が grc_task_update で status → in_progress
                                              ↓
                           Agent がタスク成果物を生成
                                              ↓
                    Agent が grc_task_complete で status → review
```

### 4.2 新規ツール: `grc_task_update`

**ファイル:** `src/agents/tools/grc-task-update-tool.ts` (新規)

```typescript
// ツール定義
{
  name: "grc_task_update",
  label: "GRC Task Update",
  description: "Update the status of an assigned GRC task. Use this to report progress.",
  parameters: {
    task_id: string (required),
    status: enum ["in_progress", "blocked"] (required),
    result_summary?: string,
    result_data?: object,
  },
  execute: async (toolCallId, args) => {
    const client = getGrcClient();
    const result = await client.updateTaskStatus({
      task_id: args.task_id,
      node_id: getNodeId(),
      status: args.status,
      result_summary: args.result_summary,
      result_data: args.result_data,
    });
    return jsonResult(result);
  }
}
```

### 4.3 新規ツール: `grc_task_complete`

**ファイル:** `src/agents/tools/grc-task-complete-tool.ts` (新規)

```typescript
// ツール定義
{
  name: "grc_task_complete",
  label: "GRC Task Complete",
  description: "Submit task results for review. Sets status to 'review'.",
  parameters: {
    task_id: string (required),
    result_summary: string (required),
    result_data?: object,
    comment?: string,
  },
  execute: async (toolCallId, args) => {
    const client = getGrcClient();

    // 1. ステータスを review に遷移
    const statusResult = await client.updateTaskStatus({
      task_id: args.task_id,
      node_id: getNodeId(),
      status: "review",
      result_summary: args.result_summary,
      result_data: args.result_data,
    });

    // 2. 完了コメントを追加 (任意)
    if (args.comment) {
      await client.addTaskComment({
        task_id: args.task_id,
        node_id: getNodeId(),
        content: args.comment,
      });
    }

    return jsonResult({ status: "submitted_for_review", task: statusResult.task });
  }
}
```

### 4.4 ツール登録

**ファイル:** `src/agents/tools/index.ts` (または該当するツール登録箇所)

```typescript
// 既存の grc_task ツールと並列に登録
import { createGrcTaskUpdateTool } from "./grc-task-update-tool.js";
import { createGrcTaskCompleteTool } from "./grc-task-complete-tool.js";
import { createGrcTaskAcceptTool } from "./grc-task-accept-tool.js";
import { createGrcTaskRejectTool } from "./grc-task-reject-tool.js";

// ツールリストに追加
tools.push(
  createGrcTaskUpdateTool(options),
  createGrcTaskCompleteTool(options),
  createGrcTaskAcceptTool(options),
  createGrcTaskRejectTool(options),
);
```

---

## 5. Phase 3: 完了報告 (Node → GRC → 起草者)

### 5.1 フロー

```
担当者 Node                  GRC Server                    起草者 Node
    |                           |                              |
    |-- grc_task_complete -----→|                              |
    |   status: "review"       |                              |
    |   result_summary: "..."  |                              |
    |                           |-- SSE task_completed -------→|
    |                           |                              |
    |                           |                    Heartbeat Wake
    |                           |                    検収セッション起動
    |                           |                              |
    |                           |←-- grc_task_accept ----------|
    |                           |    status: "approved"        |
    |                           |                              |
    |                           |-- SSE task_feedback --------→|  (差戻しの場合)
    |                           |   event_type: "task_feedback" |
```

### 5.2 GRC側: review 遷移時の SSE 通知

`changeStatus()` で `newStatus === "review"` の場合、起草者の `assignedBy` フィールドからノードIDを抽出し、`task_completed` イベントをプッシュ。

**`assignedBy` のフォーマット:**
```
"agent:{roleId}:{nodeHash}"
```

抽出ロジック:
```typescript
function extractCreatorNodeIdFromAssignedBy(assignedBy: string): string | null {
  // "agent:ceo:96541a73..." → nodeId はノード登録テーブルからhash逆引き
  // または assignedBy にnodeIdを直接格納する設計変更を検討
}
```

> **設計検討:** `assignedBy` にノードIDを直接含めるか、タスクテーブルに `creatorNodeId` カラムを追加するか。
> **推奨:** `creatorNodeId` カラム追加 — `assignedBy` はactorラベルとして保持し、通知用ノードIDは別途管理。

### 5.3 タスクテーブル拡張 (推奨)

```sql
ALTER TABLE tasks ADD COLUMN creator_node_id VARCHAR(255) NULL AFTER assigned_node_id;
```

`createAgentTask()` 内で `creatorNodeId = params.creatorNodeId` を設定。

---

## 6. Phase 4: 検収 (Acceptance & Verification)

### 6.1 新規ツール: `grc_task_accept`

**ファイル:** `src/agents/tools/grc-task-accept-tool.ts` (新規)

```typescript
{
  name: "grc_task_accept",
  label: "GRC Task Accept",
  description: "Accept and approve a completed task. Only the task creator can accept.",
  parameters: {
    task_id: string (required),
    comment?: string,
  },
  execute: async (toolCallId, args) => {
    const client = getGrcClient();

    // ステータスを approved に遷移
    const result = await client.updateTaskStatus({
      task_id: args.task_id,
      node_id: getNodeId(),
      status: "approved",
    });

    if (args.comment) {
      await client.addTaskComment({
        task_id: args.task_id,
        node_id: getNodeId(),
        content: `[Accepted] ${args.comment}`,
      });
    }

    // さらに completed に遷移 (approved → completed)
    await client.updateTaskStatus({
      task_id: args.task_id,
      node_id: getNodeId(),
      status: "completed",
    });

    return jsonResult({ status: "accepted_and_completed", task: result.task });
  }
}
```

### 6.2 新規ツール: `grc_task_reject`

**ファイル:** `src/agents/tools/grc-task-reject-tool.ts` (新規)

```typescript
{
  name: "grc_task_reject",
  label: "GRC Task Reject",
  description: "Reject a task submission and request rework with feedback.",
  parameters: {
    task_id: string (required),
    feedback: string (required, min 10 chars),
  },
  execute: async (toolCallId, args) => {
    const client = getGrcClient();

    // 1. コメントでフィードバック追加
    await client.addTaskComment({
      task_id: args.task_id,
      node_id: getNodeId(),
      content: `[Rejected - Rework Required] ${args.feedback}`,
    });

    // 2. ステータスを in_progress に差戻し (review → in_progress)
    const result = await client.updateTaskStatus({
      task_id: args.task_id,
      node_id: getNodeId(),
      status: "in_progress",
    });

    // GRC側で task_feedback SSE イベントが発火 → 担当者に通知

    return jsonResult({ status: "rejected_for_rework", task: result.task });
  }
}
```

### 6.3 検収ワークフロー

```
1. 起草者 Node が task_completed SSE を受信
2. Heartbeat Wake → 検収用エージェントセッション起動
3. Agent が成果物を確認
4. 承認: grc_task_accept → review → approved → completed
5. 差戻し: grc_task_reject → review → in_progress + コメント
   → GRC が task_feedback SSE → 担当者 Node → 再作業
```

### 6.4 権限制御

- `grc_task_accept` / `grc_task_reject` は **起草者ノードのみ** 実行可能
- GRC側 `POST /a2a/tasks/update` で `node_id` と `assignedBy` / `creatorNodeId` の一致を検証
- 担当者が自分のタスクを approve/reject することはできない

---

## 7. Phase 5: 復盤 (Retrospective)

### 7.1 既存データ基盤

`task_progress_log` テーブルに全ステータス遷移が記録されている:

```typescript
taskProgressLogTable = {
  id: serial,
  taskId: char(36),
  actor: varchar(255),
  action: varchar(50),     // "created", "status_change", "updated"
  fromStatus: varchar(30),
  toStatus: varchar(30),
  details: json,
  createdAt: timestamp,
}
```

### 7.2 自動メトリクス集計

タスク完了 (`approved → completed`) 時に自動集計:

```typescript
interface TaskRetrospective {
  task_id: string;
  task_code: string;

  // 時間メトリクス
  total_duration_hours: number;        // created → completed
  execution_duration_hours: number;    // in_progress → review (初回)
  review_duration_hours: number;       // review → approved/rejected

  // 品質メトリクス
  rejection_count: number;             // review → in_progress の回数
  status_transition_count: number;     // 総遷移回数
  blocked_count: number;               // blocked になった回数
  blocked_duration_hours: number;      // blocked 合計時間

  // コメント数
  comment_count: number;
}
```

### 7.3 復盤エンドポイント (将来)

```
GET /a2a/tasks/{taskId}/retrospective
```

`task_progress_log` からタスクのライフサイクルメトリクスを計算して返す。

---

## 8. 変更対象ファイル一覧

### GRC Server (`C:\work\grc`)

| ファイル | 変更内容 | 種類 |
|---------|---------|------|
| `src/modules/evolution/node-config-sse.ts` | `pushTaskEvent()` メソッド追加、`TaskSSEEvent` 型定義 | 修正 |
| `src/modules/tasks/service.ts` | `changeStatus()` にSSE通知トリガー追加、`creatorNodeId` 対応 | 修正 |
| `src/modules/tasks/routes.ts` | `GET /a2a/tasks/pending` エンドポイント追加 | 修正 |
| `src/modules/tasks/schema.ts` | `creator_node_id` カラム追加 (推奨) | 修正 |

### WinClaw Gateway (`C:\work\winclaw`)

| ファイル | 変更内容 | 種類 |
|---------|---------|------|
| `src/infra/grc-client.ts` | `fetchPendingTasks()`, `updateTaskStatus()`, `addTaskComment()` 追加 | 修正 |
| `src/infra/grc-sync.ts` | `handleSSEEvent()` に `task_event` ハンドラー追加 | 修正 |
| `src/infra/heartbeat-events-filter.ts` | タスクイベント検出・プロンプト生成関数追加 | 修正 |
| `src/infra/heartbeat-runner.ts` | タスクイベント時のプロンプト注入、SSEフォールバックポーリング追加 | 修正 |
| `src/agents/tools/grc-task-update-tool.ts` | 進捗報告ツール | **新規** |
| `src/agents/tools/grc-task-complete-tool.ts` | 完了報告ツール | **新規** |
| `src/agents/tools/grc-task-accept-tool.ts` | 検収承認ツール | **新規** |
| `src/agents/tools/grc-task-reject-tool.ts` | 差戻しツール | **新規** |

---

## 9. データフロー: 完全シーケンス図

```
CEO Agent (Node A)                GRC Server                    担当者 (Node B)
       |                              |                              |
  [1] grc_task tool                   |                              |
       |--- POST /a2a/tasks/create --→|                              |
       |                              | status: "pending"            |
       |                              |                              |
       |                              |--- SSE task_assigned -------→|
       |                              |                              |
       |                              |                    [2] Heartbeat Wake
       |                              |                    タスクセッション起動
       |                              |                              |
       |                              |←--- grc_task_update ---------|
       |                              |     status: "in_progress"    |
       |                              |                              |
       |                              |           ... 作業実行 ...    |
       |                              |                              |
       |                              |←--- grc_task_complete -------|
       |                              |     status: "review"         |
       |                              |     result_summary: "..."    |
       |                              |                              |
       |←-- SSE task_completed -------|                              |
       |                              |                              |
  [3] Heartbeat Wake                  |                              |
  検収セッション起動                    |                              |
       |                              |                              |
  [4a] grc_task_accept                |                              |
       |--- status: "approved" ------→|                              |
       |--- status: "completed" -----→|                              |
       |                              | (タスク完了・復盤データ生成)    |
       |                              |                              |
  [4b] grc_task_reject (差戻しの場合)  |                              |
       |--- status: "in_progress" ---→|                              |
       |--- comment: feedback -------→|                              |
       |                              |--- SSE task_feedback -------→|
       |                              |                              |
       |                              |                    [5] Heartbeat Wake
       |                              |                    再作業セッション起動
       |                              |                    (Phase 2 に戻る)
```

---

## 10. 実装優先順位

| 順序 | 内容 | 理由 |
|------|------|------|
| 1 | GRC: SSE タスクイベント拡張 | 全ての通知の基盤 |
| 2 | GRC: `/a2a/tasks/pending` エンドポイント | ポーリングフォールバックの基盤 |
| 3 | WinClaw: `GrcClient` 拡張 (fetch/update/comment) | ツール実装の前提 |
| 4 | WinClaw: `grc_task_update` + `grc_task_complete` ツール | タスク実行の核心 |
| 5 | WinClaw: SSE `task_event` ハンドラー + Heartbeat 統合 | リアルタイム配信 |
| 6 | WinClaw: `grc_task_accept` + `grc_task_reject` ツール | 検収フロー |
| 7 | GRC: 復盤メトリクス API | 将来拡張 |

---

## 11. 設計方針まとめ

1. **既存ステータスマシン完全活用** — 新ステータス不要。`review` = 提出、`approved` = 承認、`review → in_progress` = 差戻し
2. **SSE 優先・Heartbeat フォールバック** — オンラインならリアルタイム、オフラインなら次回 heartbeat でキャッチアップ
3. **既存パターン踏襲** — `grc_task` ツールの実装パターン (GrcClient + loadConfig + readRoleIdFromConfigState) を全ツールで統一
4. **最小限の DB 変更** — `creator_node_id` カラム追加のみ (通知先ノード特定用)
5. **段階的実装可能** — 各 Phase は独立してデプロイ可能、Phase 1-2 だけで基本動作開始
