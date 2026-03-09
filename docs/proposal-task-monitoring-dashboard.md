# タスク監視看板（Task Monitoring Dashboard）設計提案

**作成日**: 2026-03-09
**ステータス**: レビュー待ち
**関連**: GRC_TaskBoard_Design_Detail.md, GRC_Role_Templates_All_8_Roles.md

---

## 1. 背景と目的

### 1.1 現状の課題
現在のGRCタスクボード（`/tasks/board`）は **全タスク** を一覧表示するが、以下の視点が不足：
- WinClawロール（CEO, CTO, CFO等）が **発起した臨時タスク** を一目で把握できない
- 日常タスク（heartbeat, 定期レポート等）とアドホックタスクの区別がない
- タスクの発起人・担当者の可視性が低い

### 1.2 目的
**WinClawの会社コアロール（CEO, CTO, CFO等）が発起したアドホックタスクを監視する専用ビュー** を提供する。

### 1.3 重要な前提確認
> ユーザー指摘: 「任務一般都由CEO,CTO,CFO等公司核心role発起，往往在任務看板中不会发起这么多的任务，只发起些临时任务」

- タスクは主に **戦略タスク（strategic）** および **臨時タスク（operational/project）** として発起される
- **日常タスク（daily heartbeat等）は除外**
- タスク数は少量（数十件程度）を想定 → ページネーション不要、全件表示で十分

---

## 2. 既存システム分析

### 2.1 GRC タスクシステム（実装済み）

**データベーススキーマ** (`grc/src/modules/tasks/schema.ts`):
```
tasksTable:
  id, taskCode (MKT-001等), title, description
  status: draft|pending|in_progress|blocked|review|approved|completed|cancelled
  priority: critical|high|medium|low
  category: strategic|operational|administrative|expense
  assignedRoleId, assignedNodeId, assignedBy
  deadline, completedAt
  resultSummary, resultData (JSON)
  version (楽観ロック)
```

**既存API** (`grc/src/modules/tasks/admin-routes.ts`):
- `GET /api/v1/admin/tasks` — 全タスク取得（pagination, filter対応）
  - フィルタ: `status`, `priority`, `category`, `assignedRoleId`, `assignedNodeId`
- `GET /api/v1/admin/tasks/stats` — 統計
- `GET /api/v1/admin/tasks/:id` — 詳細（progressLog, comments付き）

**タスクコード自動生成** (`service.ts`):
- ロール別プレフィックス: CEO→EXC, CTO→ENG, CFO→FIN, marketing→MKT, sales→SLS 等

### 2.2 WinClaw タスク関連

**A2Aルート** (`grc/src/modules/tasks/routes.ts`):
- `GET /a2a/tasks/mine?node_id=xxx` — 自ノードに割り当てられたタスク取得
- `POST /a2a/tasks/update` — タスクステータス/結果更新
- `POST /a2a/tasks/comment` — コメント追加

**タスク作成フロー**:
1. CEO/CTO等のロールが「タスク発起」 → GRCの `POST /api/v1/admin/tasks` で作成
2. `assignedBy` フィールドに発起元情報: `'human-ceo'`, `'agent:ceo:main'`, `'grc-admin'` 等
3. 担当ロール/ノードに割当 → 担当エージェントが `/a2a/tasks/mine` でポーリング

### 2.3 ダッシュボード既存UI

**タスクボードページ** (`dashboard/src/pages/tasks/TaskBoard.tsx`):
- カンバンビュー: draft/pending/in_progress/blocked/review/completed 列
- タスクカード表示: タイトル、優先度、担当者、期限

**タスク統計ページ** (`dashboard/src/pages/tasks/TaskStats.tsx`):
- ステータス別/優先度別/カテゴリ別の集計

---

## 3. 提案設計

### 3.1 方式: 既存タスクボードの拡張フィルタ

**新規ページ作成ではなく、既存のタスクボードにフィルタモードを追加** する方式を推奨。

理由:
- 既にタスクの全CRUD APIが存在
- UIコンポーネント（カンバン、テーブル）が実装済み
- タスク数が少ないためシンプルなフィルタで十分

### 3.2 UI追加項目

#### A) タスクボードへの「監視モード」トグル追加

```
[タスクボード]                    [監視モード ON/OFF]
┌─────────────────────────────────────────────┐
│ フィルタ:                                     │
│ [発起ロール ▼] [ステータス ▼] [優先度 ▼]       │
│ [□ 日常タスクを除外（推奨）]                    │
└─────────────────────────────────────────────┘
```

監視モード ON 時の動作:
- `category` フィルタで `administrative` を自動除外
- テーブルビューに切替（カンバンではなくリスト表示）
- 追加カラム: **発起人**、**担当者**、**経過時間**

#### B) 監視テーブルのカラム定義

| カラム | フィールド | 説明 |
|--------|-----------|------|
| タスクコード | `taskCode` | EXC-001, MKT-003 等 |
| タスク名 | `title` | タスクタイトル |
| 発起人 | `assignedBy` | CEO, CTO, CFO 等（ロール名に変換） |
| 担当者 | `assignedRoleId` + `assignedNodeId` | ロール名 + ノード名 |
| ステータス | `status` | バッジ表示 |
| 優先度 | `priority` | アイコン + 色 |
| カテゴリ | `category` | strategic / operational / project / expense |
| 期限 | `deadline` | 期限日時、超過は赤表示 |
| 進捗 | `progress_percent` | プログレスバー（0-100%） |
| 作成日 | `createdAt` | 作成日時 |
| 操作 | — | 詳細/編集ボタン |

#### C) 行クリックで詳細パネル展開

詳細パネルに表示:
- タスク説明（`description`）
- 進捗ログ（`taskProgressLog`テーブル）
- コメント（`taskComments`テーブル）
- 成果物（`deliverables` JSON）
- 結果サマリ（`resultSummary`）

### 3.3 API変更

**既存APIで対応可能** — 追加APIは不要。

既存 `GET /api/v1/admin/tasks` のクエリパラメータ:
```
?status=pending,in_progress,blocked,review
&category=strategic,operational,project,expense   (administrativeを除外)
&page=1&limit=100
```

ただし、`assignedBy` フィールドでのフィルタが現在未対応の場合、サービス層に追加:
```typescript
// tasks/service.ts の listTasks に追加
if (opts.assignedBy) {
  query = query.where(like(tasksTable.assignedBy, `%${opts.assignedBy}%`));
}
```

### 3.4 「発起人」表示の変換ロジック

`assignedBy` の値からロール名への変換:
```typescript
function resolveCreatorName(assignedBy: string): string {
  if (assignedBy === 'human-ceo') return 'CEO (人間)';
  if (assignedBy === 'grc-admin') return 'GRC管理者';
  // agent:ceo:main → CEO
  const match = assignedBy.match(/^agent:(\w+):/);
  if (match) {
    const roleMap: Record<string, string> = {
      ceo: 'CEO', cto: 'CTO', cfo: 'CFO',
      marketing: 'マーケティング', sales: '営業',
      engineering: 'エンジニアリング', hr: '人事',
      legal: '法務', support: 'サポート',
    };
    return roleMap[match[1]] || match[1];
  }
  return assignedBy;
}
```

---

## 4. 実装計画

### Phase 1: バックエンド（GRC）
1. `tasks/service.ts` — `listTasks` に `assignedBy` フィルタ追加
2. `tasks/admin-routes.ts` — クエリパラメータに `assigned_by` 追加

### Phase 2: フロントエンド（Dashboard）
1. `TaskBoard.tsx` にテーブルビューモード追加（既存カンバンと切替）
2. フィルタバー実装（ロール選択、ステータス、日常タスク除外チェック）
3. 監視テーブルコンポーネント実装
4. 行クリック → 詳細パネル展開
5. 多言語対応（`tasks.json` に監視モード用キー追加）

### Phase 3: 翻訳
- EN/ZH/JA/KO の4言語で監視モードUI文言追加

---

## 5. 確認事項

### 5.1 タスク発起の頻度について
> 「任務看板出不会发起这么多的任务，只发起些临时任务」

**確認**: 現在のシステムでは、タスクは以下の経路で作成される：
1. **管理画面から手動作成** — `POST /api/v1/admin/tasks`（GRC Dashboard）
2. **戦略デプロイ時の自動タスク** — `deployStrategy()` が CEO タスクを1件自動作成
3. **A2Aエージェント間** — 現在は直接のタスク作成APIがA2Aにはない（mine取得とupdate/commentのみ）

→ つまり **現状ではエージェントが自律的にタスクを大量発起する仕組みはない**。
→ タスクは主にGRC管理画面から人間CEOまたはCEOエージェントが手動/半手動で発起。
→ 少量のアドホックタスクを監視するビューとして設計するのが適切。

### 5.2 日常タスクの定義
- `category = 'administrative'` のタスク → 日常タスクとみなす
- heartbeatやレポートは taskシステム外で処理（別モジュール）

### 5.3 将来拡張
- エージェントがA2A経由でタスクを発起する機能を追加する場合、`assignedBy` に `agent:ceo:xxx` 形式で記録される想定
- その際もこの監視ビューで自動的に表示可能

---

## 6. 【重要】エージェント自律タスク発起メカニズム

### 6.1 背景：なぜ必要か

現在のシステムの制限:
- エージェントの A2A API は **読取・更新のみ** (`/a2a/tasks/mine`, `/a2a/tasks/update`, `/a2a/tasks/comment`)
- タスク作成は **管理者API** (`POST /api/v1/admin/tasks`) のみ → 管理者JWT必須
- 唯一の自動タスク生成は `deployStrategy()` による CEO 戦略タスク1件のみ

**必要なシナリオ**:
1. CEO エージェントが戦略分析後に CTO/CFO へ調査タスクを発起
2. CTO エージェントが技術的な問題を発見 → エンジニアリングチームにバグ修正タスクを発起
3. マーケティングエージェントがキャンペーン分析 → 営業チームにフォローアップタスクを委譲
4. ハートビート巡回中に異常検知 → 緊急対応タスクを自動作成

### 6.2 設計原則

```
┌──────────────────────────────────────────────────────────────────┐
│                     エージェント自律タスク発起                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  原則1: ロール階層に基づく権限制御                                  │
│    - 上位ロール（CEO/CTO/CFO）→ 下位ロールへのタスク発起可           │
│    - 同位ロール間 → 相互にタスク発起可（協業）                       │
│    - 下位ロール → 上位ロールへは「提案」のみ（承認待ち）              │
│                                                                  │
│  原則2: レート制限による暴走防止                                    │
│    - ロール別の日次タスク作成上限                                   │
│    - 同一タスクの重複検知                                          │
│    - 緊急度に応じた閾値調整                                        │
│                                                                  │
│  原則3: 監査証跡の完全記録                                         │
│    - 全エージェント発起タスクを taskProgressLog に記録               │
│    - assignedBy 形式: "agent:{roleId}:{nodeId}"                  │
│    - 発起理由（context）を必須フィールドとして追加                    │
│                                                                  │
│  原則4: 人間によるオーバーライド可能                                 │
│    - 管理者はいつでもエージェント発起タスクをキャンセル可              │
│    - ダッシュボードの監視ビューで全エージェントタスクを一覧            │
│    - 「承認待ち」ステータスによる人間ゲートキーピング                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 6.3 A2A 新規エンドポイント

#### エンドポイント定義

```typescript
// POST /a2a/tasks/create — エージェントによるタスク発起
// 認証: A2A JWT 必須
// ファイル: grc/src/modules/tasks/routes.ts に追加

const agentCreateTaskSchema = z.object({
  node_id: z.string().min(1),                              // 発起元ノードID
  title: z.string().min(1).max(500),                       // タスクタイトル
  description: z.string().max(5000).optional(),             // 詳細説明
  context: z.string().min(1).max(2000),                    // ★ 発起理由（必須）
  category: z.enum([
    'strategic', 'operational', 'administrative', 'expense'
  ]).default('operational'),
  priority: z.enum([
    'critical', 'high', 'medium', 'low'
  ]).default('medium'),
  target_role_id: z.string().optional(),                   // 委譲先ロール
  target_node_id: z.string().optional(),                   // 委譲先ノード（特定指名）
  deadline: z.string().datetime().optional(),               // 期限
  depends_on: z.array(z.string().uuid()).optional(),        // 依存タスク
  deliverables: z.array(z.string()).optional(),             // 期待する成果物
  notes: z.string().optional(),
  expense_amount: z.string().optional(),                    // 予算が必要な場合
  expense_currency: z.string().default('JPY').optional(),
});
```

#### レスポンス

```typescript
// 成功時
{
  ok: true,
  task: {
    id: "uuid",
    taskCode: "ENG-042",
    title: "...",
    status: "pending",       // または "draft"（承認待ち時）
    assignedBy: "agent:cto:node-abc123",
    createdAt: "2026-03-10T..."
  },
  approval_required: false   // 承認待ちかどうか
}

// 制限超過時
{
  ok: false,
  error: "RATE_LIMIT_EXCEEDED",
  message: "Daily task creation limit reached (5/5)",
  retry_after: "2026-03-11T00:00:00Z"
}

// 権限不足時
{
  ok: false,
  error: "INSUFFICIENT_PERMISSION",
  message: "Role 'support' cannot create tasks for role 'ceo'"
}
```

### 6.4 ロール別タスク発起ポリシー

#### ポリシーテーブル設計

```typescript
// grc/src/modules/tasks/agent-task-policy.ts

export interface AgentTaskPolicy {
  canCreateTasks: boolean;          // タスク発起権限
  maxTasksPerDay: number;           // 日次上限
  maxTasksPerHour: number;          // 時間上限（バースト防止）
  allowedCategories: string[];      // 許可カテゴリ
  canDelegateToRoles: string[];     // 委譲可能なロール
  requiresApproval: boolean;        // 人間の承認が必要か
  maxExpenseAmount: number | null;  // 自動承認できる最大費用額
}

export const AGENT_TASK_POLICIES: Record<string, AgentTaskPolicy> = {
  // ── 経営層 ─────────────────────────────
  ceo: {
    canCreateTasks: true,
    maxTasksPerDay: 10,
    maxTasksPerHour: 5,
    allowedCategories: ['strategic', 'operational', 'expense'],
    canDelegateToRoles: ['*'],          // 全ロールに委譲可能
    requiresApproval: false,            // CEO は承認不要
    maxExpenseAmount: null,             // 無制限
  },
  cto: {
    canCreateTasks: true,
    maxTasksPerDay: 8,
    maxTasksPerHour: 4,
    allowedCategories: ['strategic', 'operational'],
    canDelegateToRoles: ['engineering', 'support', 'marketing'],
    requiresApproval: false,
    maxExpenseAmount: 500000,           // 50万円まで自動承認
  },
  cfo: {
    canCreateTasks: true,
    maxTasksPerDay: 6,
    maxTasksPerHour: 3,
    allowedCategories: ['strategic', 'operational', 'expense'],
    canDelegateToRoles: ['*'],
    requiresApproval: false,
    maxExpenseAmount: null,
  },

  // ── 部門長 ─────────────────────────────
  marketing: {
    canCreateTasks: true,
    maxTasksPerDay: 5,
    maxTasksPerHour: 3,
    allowedCategories: ['operational'],
    canDelegateToRoles: ['sales', 'support'],  // 関連部門のみ
    requiresApproval: false,
    maxExpenseAmount: 100000,
  },
  sales: {
    canCreateTasks: true,
    maxTasksPerDay: 5,
    maxTasksPerHour: 3,
    allowedCategories: ['operational'],
    canDelegateToRoles: ['marketing', 'support'],
    requiresApproval: false,
    maxExpenseAmount: 100000,
  },
  engineering: {
    canCreateTasks: true,
    maxTasksPerDay: 5,
    maxTasksPerHour: 3,
    allowedCategories: ['operational'],
    canDelegateToRoles: ['support'],
    requiresApproval: false,
    maxExpenseAmount: 50000,
  },
  hr: {
    canCreateTasks: true,
    maxTasksPerDay: 3,
    maxTasksPerHour: 2,
    allowedCategories: ['operational', 'administrative'],
    canDelegateToRoles: [],              // HR は他部門に委譲しない
    requiresApproval: false,
    maxExpenseAmount: 50000,
  },
  legal: {
    canCreateTasks: true,
    maxTasksPerDay: 3,
    maxTasksPerHour: 2,
    allowedCategories: ['operational'],
    canDelegateToRoles: [],
    requiresApproval: true,             // 法務タスクは承認必要
    maxExpenseAmount: 0,
  },
  support: {
    canCreateTasks: true,
    maxTasksPerDay: 3,
    maxTasksPerHour: 2,
    allowedCategories: ['operational'],
    canDelegateToRoles: [],
    requiresApproval: true,             // 承認必要
    maxExpenseAmount: 0,
  },

  // ── デフォルト（カスタムロール） ─────────
  _default: {
    canCreateTasks: true,
    maxTasksPerDay: 2,
    maxTasksPerHour: 1,
    allowedCategories: ['operational'],
    canDelegateToRoles: [],
    requiresApproval: true,             // カスタムロールは承認必要
    maxExpenseAmount: 0,
  },
};
```

#### 委譲権限マトリックス

```
           委譲先 →
発起元 ↓    CEO  CTO  CFO  MKT  SLS  ENG  HR   LGL  SUP
CEO         —    ✓    ✓    ✓    ✓    ✓    ✓    ✓    ✓
CTO         ✗    —    ✗    ✓    ✗    ✓    ✗    ✗    ✓
CFO         ✓    ✓    —    ✓    ✓    ✓    ✓    ✓    ✓
Marketing   ✗    ✗    ✗    —    ✓    ✗    ✗    ✗    ✓
Sales       ✗    ✗    ✗    ✓    —    ✗    ✗    ✗    ✓
Engineering ✗    ✗    ✗    ✗    ✗    —    ✗    ✗    ✓
HR          ✗    ✗    ✗    ✗    ✗    ✗    —    ✗    ✗
Legal       ✗    ✗    ✗    ✗    ✗    ✗    ✗    —    ✗
Support     ✗    ✗    ✗    ✗    ✗    ✗    ✗    ✗    —

✓ = 直接発起可  ✗ = 「提案」として draft ステータスで作成
```

### 6.5 サービス層の実装

```typescript
// grc/src/modules/tasks/service.ts に追加

async createAgentTask(
  nodeId: string,
  roleId: string,
  data: AgentCreateTaskInput
): Promise<{ task: Task; approvalRequired: boolean }> {

  // 1. ポリシー取得
  const policy = AGENT_TASK_POLICIES[roleId] ?? AGENT_TASK_POLICIES._default;

  if (!policy.canCreateTasks) {
    throw new ForbiddenError(`Role '${roleId}' does not have task creation rights`);
  }

  // 2. レート制限チェック
  const todayCount = await this.countAgentTasksToday(nodeId);
  if (todayCount >= policy.maxTasksPerDay) {
    throw new RateLimitError(
      `Daily task creation limit reached (${todayCount}/${policy.maxTasksPerDay})`
    );
  }
  const hourCount = await this.countAgentTasksLastHour(nodeId);
  if (hourCount >= policy.maxTasksPerHour) {
    throw new RateLimitError(
      `Hourly task creation limit reached (${hourCount}/${policy.maxTasksPerHour})`
    );
  }

  // 3. カテゴリ権限チェック
  if (!policy.allowedCategories.includes(data.category)) {
    throw new ForbiddenError(
      `Category '${data.category}' not allowed for role '${roleId}'`
    );
  }

  // 4. 委譲先ロール権限チェック
  const targetRole = data.target_role_id ?? roleId;
  let approvalRequired = policy.requiresApproval;

  if (targetRole !== roleId) {
    const canDelegate =
      policy.canDelegateToRoles.includes('*') ||
      policy.canDelegateToRoles.includes(targetRole);

    if (!canDelegate) {
      // 委譲権限がない場合、draft ステータスで作成（承認待ち）
      approvalRequired = true;
    }
  }

  // 5. 費用チェック
  if (data.expense_amount) {
    const amount = parseFloat(data.expense_amount);
    if (policy.maxExpenseAmount !== null && amount > policy.maxExpenseAmount) {
      approvalRequired = true;  // 上限超過は承認必要
    }
  }

  // 6. 重複チェック（同一タイトル + 同一担当 + 未完了）
  const duplicate = await this.findDuplicateTask(data.title, targetRole);
  if (duplicate) {
    throw new ConflictError(
      `Similar active task already exists: ${duplicate.taskCode} "${duplicate.title}"`
    );
  }

  // 7. タスク作成
  const assignedBy = `agent:${roleId}:${nodeId}`;
  const status = approvalRequired ? 'draft' : 'pending';

  const task = await this.createTask({
    title: data.title,
    description: data.description
      ? `${data.description}\n\n---\n**発起理由**: ${data.context}`
      : `**発起理由**: ${data.context}`,
    category: data.category,
    priority: data.priority,
    status,
    assignedRoleId: targetRole,
    assignedNodeId: data.target_node_id ?? undefined,
    assignedBy,
    deadline: data.deadline ? new Date(data.deadline) : undefined,
    dependsOn: data.depends_on,
    deliverables: data.deliverables,
    notes: data.notes,
    expenseAmount: data.expense_amount,
    expenseCurrency: data.expense_currency,
  });

  // 8. 監査ログ記録
  await this.addProgressLog(task.id, {
    actor: assignedBy,
    action: 'created',
    toStatus: status,
    details: {
      source: 'agent_autonomous',
      creatorRoleId: roleId,
      creatorNodeId: nodeId,
      context: data.context,
      approvalRequired,
      targetRoleId: targetRole,
    },
  });

  return { task, approvalRequired };
}

// レート制限ヘルパー
private async countAgentTasksToday(nodeId: string): Promise<number> {
  const result = await this.db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tasksTable)
    .where(
      and(
        like(tasksTable.assignedBy, `%:${nodeId}`),
        sql`DATE(${tasksTable.createdAt}) = CURDATE()`
      )
    );
  return result[0]?.count ?? 0;
}

private async countAgentTasksLastHour(nodeId: string): Promise<number> {
  const result = await this.db
    .select({ count: sql<number>`COUNT(*)` })
    .from(tasksTable)
    .where(
      and(
        like(tasksTable.assignedBy, `%:${nodeId}`),
        sql`${tasksTable.createdAt} > DATE_SUB(NOW(), INTERVAL 1 HOUR)`
      )
    );
  return result[0]?.count ?? 0;
}

// 重複検知ヘルパー
private async findDuplicateTask(
  title: string, targetRole: string
): Promise<Task | null> {
  const results = await this.db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.title, title),
        eq(tasksTable.assignedRoleId, targetRole),
        notInArray(tasksTable.status, ['completed', 'cancelled'])
      )
    )
    .limit(1);
  return results[0] ?? null;
}
```

### 6.6 WinClaw クライアント統合

#### GRC Client 拡張

```typescript
// winclaw/src/infra/grc-client.ts に追加

export type AgentTaskCreateParams = {
  node_id: string;
  title: string;
  description?: string;
  context: string;            // 発起理由（必須）
  category?: 'strategic' | 'operational' | 'administrative' | 'expense';
  priority?: 'critical' | 'high' | 'medium' | 'low';
  target_role_id?: string;
  target_node_id?: string;
  deadline?: string;
  depends_on?: string[];
  deliverables?: string[];
  notes?: string;
  expense_amount?: string;
  expense_currency?: string;
};

export type AgentTaskCreateResult = {
  ok: boolean;
  task?: {
    id: string;
    taskCode: string;
    title: string;
    status: string;
    assignedBy: string;
    createdAt: string;
  };
  approval_required?: boolean;
  error?: string;
  message?: string;
  retry_after?: string;
};

// GrcClient クラスに追加
async createAgentTask(
  params: AgentTaskCreateParams,
  abortSignal?: AbortSignal
): Promise<AgentTaskCreateResult> {
  return this.request<AgentTaskCreateResult>(
    '/a2a/tasks/create',
    { method: 'POST', body: JSON.stringify(params) },
    abortSignal
  );
}

async getMyTasks(
  nodeId: string,
  abortSignal?: AbortSignal
): Promise<{ ok: boolean; tasks: GrcTask[] }> {
  return this.request<{ ok: boolean; tasks: GrcTask[] }>(
    `/a2a/tasks/mine?node_id=${encodeURIComponent(nodeId)}`,
    { method: 'GET' },
    abortSignal
  );
}
```

#### エージェント側のタスク発起パターン

```typescript
// winclaw 側の利用例（エージェントの TASKS.md / HEARTBEAT.md で定義する行動パターン）

// パターン1: ハートビート巡回中に問題発見 → タスク発起
async function heartbeatTaskCreation(
  grcClient: GrcClient,
  nodeId: string,
  analysis: HeartbeatAnalysis
) {
  if (analysis.issuesFound.length === 0) return;

  for (const issue of analysis.issuesFound) {
    try {
      const result = await grcClient.createAgentTask({
        node_id: nodeId,
        title: issue.title,
        description: issue.description,
        context: `ハートビート巡回中に検知: ${issue.source}`,
        category: 'operational',
        priority: issue.severity === 'critical' ? 'critical' : 'medium',
        target_role_id: issue.suggestedRole,
      });

      if (result.ok) {
        log.info({ taskCode: result.task?.taskCode }, 'Agent created task');
      } else if (result.error === 'RATE_LIMIT_EXCEEDED') {
        log.warn('Rate limit reached, skipping remaining issues');
        break;
      }
    } catch (err) {
      log.error({ error: err }, 'Failed to create agent task');
    }
  }
}

// パターン2: 戦略分析後にアクションアイテム生成
async function strategyActionItems(
  grcClient: GrcClient,
  nodeId: string,
  strategyInsights: StrategyInsight[]
) {
  for (const insight of strategyInsights) {
    await grcClient.createAgentTask({
      node_id: nodeId,
      title: insight.actionItem,
      description: insight.rationale,
      context: `戦略分析結果に基づくアクション: ${insight.strategyArea}`,
      category: 'strategic',
      priority: 'high',
      target_role_id: insight.responsibleRole,
      deadline: insight.suggestedDeadline,
    });
  }
}
```

### 6.7 タスク発起トリガーの種類

エージェントがタスクを発起する場面を明確に定義:

```
┌─────────────────────────────────────────────────────────────────┐
│              エージェント タスク発起 トリガー分類                    │
├───────────┬─────────────────────────────────────────────────────┤
│ トリガー   │ 説明                                                │
├───────────┼─────────────────────────────────────────────────────┤
│ heartbeat │ 定期巡回(30分)中に異常/機会を検知                      │
│           │ 例: KPI未達、セキュリティアラート、期限超過              │
│           │ → HEARTBEAT.md の指示に基づき自動タスク作成             │
├───────────┼─────────────────────────────────────────────────────┤
│ task_chain│ 受領タスク完了時に後続タスクを発起                      │
│           │ 例: 「調査完了→レポート作成タスクを別ロールに委譲」       │
│           │ → TASKS.md の完了アクション定義に基づく                 │
├───────────┼─────────────────────────────────────────────────────┤
│ strategy  │ 戦略変数変更の受信 → アクションアイテム生成              │
│           │ 例: 「Q2予算削減→各部門に最適化タスク発起」              │
│           │ → USER.md の戦略変数テンプレートに基づく                │
├───────────┼─────────────────────────────────────────────────────┤
│ meeting   │ 会議(A2A Meeting)の決議事項 → アクションタスク          │
│           │ 例: 「マーケ会議→SNSキャンペーン実施タスク」             │
│           │ → 会議議事録からの自動抽出                              │
├───────────┼─────────────────────────────────────────────────────┤
│ escalation│ 問題のエスカレーション → 上位ロールへ対応依頼            │
│           │ 例: 「サポート→CTOへ技術的障害エスカレ」                 │
│           │ → ステータス変更不可時の自動エスカレーション              │
└───────────┴─────────────────────────────────────────────────────┘
```

### 6.8 assignedBy 形式と監視ビューへの影響

#### assignedBy 値の標準化

```
人間操作:
  "human-ceo"           — 人間CEOがダッシュボードから手動作成
  "grc-admin"           — GRC管理者が手動作成

エージェント自律:
  "agent:ceo:nodeId"    — CEOエージェントが自律発起
  "agent:cto:nodeId"    — CTOエージェントが自律発起
  "agent:marketing:nodeId" — マーケエージェントが自律発起

自動システム:
  "system:strategy"     — 戦略デプロイ時の自動タスク
  "system:meeting"      — 会議決議からの自動タスク
  "system:escalation"   — エスカレーション自動タスク
```

#### 監視ビューの「発起人」表示 拡張

```typescript
// 6.8 で定義した形式に対応する表示ロジック
function resolveCreatorName(assignedBy: string): {
  name: string;
  type: 'human' | 'agent' | 'system';
  badge: string;
} {
  // 人間操作
  if (assignedBy.startsWith('human-')) {
    const role = assignedBy.replace('human-', '');
    return { name: ROLE_NAMES[role] || role, type: 'human', badge: '👤' };
  }
  if (assignedBy === 'grc-admin') {
    return { name: 'GRC管理者', type: 'human', badge: '👤' };
  }

  // エージェント自律
  const agentMatch = assignedBy.match(/^agent:(\w[\w-]*):(.+)$/);
  if (agentMatch) {
    const roleName = ROLE_NAMES[agentMatch[1]] || agentMatch[1];
    return { name: `${roleName} (AI)`, type: 'agent', badge: '🤖' };
  }

  // 自動システム
  const systemMatch = assignedBy.match(/^system:(\w+)$/);
  if (systemMatch) {
    const systemNames: Record<string, string> = {
      strategy: '戦略デプロイ',
      meeting: '会議決議',
      escalation: 'エスカレーション',
    };
    return {
      name: systemNames[systemMatch[1]] || systemMatch[1],
      type: 'system',
      badge: '⚙️',
    };
  }

  return { name: assignedBy, type: 'human', badge: '❓' };
}
```

#### 監視テーブルの「発起元」カラム表示例

```
┌──────────┬────────────────┬──────────┬────────────────┬──────┐
│ タスクコード│ タスク名       │ 発起元    │ 担当者         │ 状態  │
├──────────┼────────────────┼──────────┼────────────────┼──────┤
│ EXC-001  │ Q2戦略見直し    │ 👤 CEO   │ CTO           │ 進行中│
│ ENG-012  │ API性能改善     │ 🤖CTO(AI)│ エンジニアリング │ 保留  │
│ MKT-005  │ SNSキャンペーン │ 🤖MKT(AI)│ 営業           │ 新規  │
│ EXC-STR-3│ 戦略展開R3     │ ⚙️戦略   │ CEO            │ 完了  │
│ SUP-008  │ 障害エスカレ    │ 🤖SUP(AI)│ CTO            │ 承認待│
└──────────┴────────────────┴──────────┴────────────────┴──────┘
```

### 6.9 承認ワークフロー（requiresApproval = true のケース）

```
エージェント タスク発起
       │
       ▼
  [ポリシーチェック]
       │
  requiresApproval?
       │
  ┌────┴────┐
  │ false   │ true
  │         ▼
  │    status = 'draft'
  │    ダッシュボードに「承認待ち」バッジ表示
  │         │
  │    人間管理者がレビュー
  │         │
  │    ┌────┴────┐
  │    │ 承認     │ 却下
  │    │         │
  │    ▼         ▼
  │  status→    status→
  │  'pending'  'cancelled'
  │    │
  ▼    ▼
status = 'pending'
  │
  ▼
担当エージェントが /a2a/tasks/mine で受領
  │
  ▼
タスク実行 → 完了報告
```

### 6.10 DB変更（最小限）

```sql
-- tasksテーブルに発起理由カラム追加（任意）
ALTER TABLE tasks
  ADD COLUMN creation_context TEXT DEFAULT NULL
  COMMENT 'エージェント自律発起時の発起理由';

-- インデックス追加（エージェント発起タスクの検索高速化）
ALTER TABLE tasks
  ADD INDEX idx_assigned_by_created (assigned_by, created_at);
```

**注**: `assignedBy` のフォーマット変更はなし（既存の自由形式文字列をそのまま活用）。

### 6.11 セキュリティ考慮事項

| リスク | 対策 |
|-------|------|
| タスク大量生成（暴走） | ロール別日次/時間レート制限 |
| 権限外ロールへの委譲 | canDelegateToRoles マトリックスで制御 |
| 重複タスク作成 | タイトル+ロール+未完了の重複検知 |
| 費用の不正承認 | maxExpenseAmount 超過は自動的に承認待ち |
| 偽装（なりすまし） | A2A JWT + nodeId とロール割当の照合 |
| 循環依存タスク | depends_on の循環検知（既存ロジック活用） |

---

## 7. 実装計画（更新版）

### Phase 1: バックエンド — 監視ダッシュボード基盤（0.5h）
1. `tasks/service.ts` — `listTasks` に `assignedBy` フィルタ追加
2. `tasks/admin-routes.ts` — クエリパラメータに `assigned_by` 追加

### Phase 2: フロントエンド — 監視ビュー（3-4h）
1. `TaskBoard.tsx` にテーブルビューモード追加
2. フィルタバー実装（ロール選択、ステータス、日常タスク除外）
3. 監視テーブルコンポーネント（発起人バッジ表示含む）
4. 行クリック → 詳細パネル展開
5. 多言語対応

### Phase 3: バックエンド — エージェント自律タスク発起API（3-4h）
1. `tasks/agent-task-policy.ts` — ロール別ポリシー定義
2. `tasks/service.ts` — `createAgentTask()` + レート制限 + 重複検知
3. `tasks/routes.ts` — `POST /a2a/tasks/create` エンドポイント追加
4. `tasks/schema.ts` — `creation_context` カラム追加（任意）
5. マイグレーション SQL

### Phase 4: WinClaw統合（2-3h）
1. `grc-client.ts` — `createAgentTask()`, `getMyTasks()` メソッド追加
2. ハートビート内でのタスク取得・発起ロジック
3. TASKS.md / HEARTBEAT.md テンプレートへのタスク発起指示追加

### Phase 5: フロントエンド — 承認ワークフロー（1-2h）
1. 監視ビューに「承認待ち」フィルタ追加
2. 承認/却下ボタン（draft → pending / cancelled）
3. 発起理由（context）の表示

### Phase 6: 翻訳（0.5h）
- EN/ZH/JA/KO の4言語で全UI文言追加

---

## 8. 工数見積もり（更新版）

| 項目 | 工数 |
|------|------|
| Phase 1: バックエンド監視基盤 | 0.5h |
| Phase 2: フロントエンド監視ビュー | 3-4h |
| Phase 3: エージェント自律タスクAPI | 3-4h |
| Phase 4: WinClaw統合 | 2-3h |
| Phase 5: 承認ワークフローUI | 1-2h |
| Phase 6: 翻訳 | 0.5h |
| テスト・調整 | 1-2h |
| **合計** | **11.5-16h** |

---

## 9. まとめ

### 監視ダッシュボード
- **新規ページ不要**: 既存タスクボードにテーブルビュー（監視モード）を追加
- **API変更最小限**: `assignedBy` フィルタ1件追加のみ
- **日常タスク除外**: `category != administrative` でフィルタ
- **少量タスク前提**: ページネーション不要、全件表示
- **発起人表示**: `assignedBy` → ロール名変換 + 人間/AI/システムバッジ

### エージェント自律タスク発起（新規）
- **新規A2A API**: `POST /a2a/tasks/create` — ロール別認可 + レート制限
- **ポリシーエンジン**: ロール別タスク作成権限・委譲権限・費用上限の定義
- **安全機構**: 日次/時間レート制限、重複検知、承認ワークフロー
- **監査完全**: taskProgressLog に全エージェント発起を記録
- **assignedBy 標準化**: `agent:{roleId}:{nodeId}` 形式で発起元を完全追跡
- **5種類のトリガー**: heartbeat / task_chain / strategy / meeting / escalation
