# CEO Agent 自律タスク作成 — 実装計画書

**作成日**: 2026-03-13
**ステータス**: レビュー待ち
**関連**: GRC_Strategy_Management_Design.md, proposal-strategy-update-skill.md

---

## 1. 背景と課題

### 1.1 現状の問題

戦略デプロイ（ダッシュボードの「保存並部署到所有代理」ボタン）実行時の現在のフロー:

```
Admin ダッシュボード → POST /api/v1/admin/strategy/deploy
  → GRC: strategy/service.ts deployStrategy()
     → 全ノードのUSER.md更新
     → SSEプッシュ (reason: "strategy_deploy")
     → GRC側でCEOタスク "EXC-STR-005" を直接DB作成  ← ★問題点
  → WinClaw Gateway: SSE受信 → syncRoleConfig() → ファイル書き込み
     → ★ここで終了。エージェントは何も実行しない
```

**問題**: タスク `EXC-STR-005` はGRCバックエンドコードが直接DBに挿入したもの。
CEOエージェントが自律的に戦略変更を分析してタスクを作成しているわけではない。

### 1.2 あるべき姿（ゴール）

```
Admin ダッシュボード → POST /api/v1/admin/strategy/deploy
  → GRC: 全ノードのUSER.md更新 + SSEプッシュ
  → WinClaw Gateway: SSE受信 → syncRoleConfig() → ファイル書き込み
     → ★ requestHeartbeatNow({ reason: "strategy_deploy" })
     → Heartbeat Runner: エージェントセッション起動
        → エージェント: USER.md (最新戦略) を読み込み
        → エージェント: 戦略変更を分析
        → エージェント: createAgentTask() で GRC にタスクを作成
        → エージェント: 分析結果をレポート
```

**CEOエージェントが自らの判断で、戦略変更に基づきタスクを生成・委任する。**

---

## 2. 技術調査結果

### 2.1 WinClaw側 — 既存の仕組み

| 仕組み | ファイル | 状態 |
|--------|----------|------|
| Hook System | `src/hooks/internal-hooks.ts` | ✅ 利用可能 |
| Heartbeat Runner | `src/infra/heartbeat-runner.ts` | ✅ 利用可能 |
| `requestHeartbeatNow()` | `src/infra/heartbeat-wake.ts` | ✅ 即時起動API |
| `GrcClient.createAgentTask()` | `src/infra/grc-client.ts:1275` | ✅ 実装済み |
| `syncRoleConfig()` | `src/infra/grc-sync.ts:775` | ⚠️ 同期後のフック未発火 |
| Bootstrap Files | `src/agents/bootstrap-files.ts` | ✅ ファイル注入可能 |
| Heartbeat Events | `src/infra/heartbeat-events-filter.ts` | ✅ reason別処理可能 |

### 2.2 GRC側 — 既存のAPI

| エンドポイント | 用途 | 認証 |
|---------------|------|------|
| `POST /a2a/tasks/create` | エージェントタスク作成 | JWT (ノード認証) |
| `GET /a2a/tasks/mine` | 自ノードのタスク取得 | JWT (ノード認証) |
| `POST /a2a/tasks/update` | タスクステータス更新 | JWT (ノード認証) |

### 2.3 CEOタスクポリシー (`agent-task-policy.ts`)

```
canCreateTasks: true
maxTasksPerDay: 10
maxTasksPerHour: 5
allowedCategories: ["strategic", "operational", "expense"]
canDelegateToRoles: ["*"]  (全ロールに委任可能)
requiresApproval: false     (即座にpendingステータス)
maxExpenseAmount: null      (制限なし)
```

### 2.4 `POST /a2a/tasks/create` スキーマ

```typescript
{
  creator_role_id: string    // 必須 — "ceo"
  creator_node_id: string    // 必須 — ノードID
  title: string              // 必須 — タスク名
  trigger_type: enum         // 必須 — "strategy" を使用
  description?: string       // 任意 — 詳細説明
  category?: enum            // 任意 — "strategic" | "operational" | "expense"
  priority?: enum            // 任意 — "critical" | "high" | "medium" | "low"
  target_role_id?: string    // 任意 — 委任先ロール (省略時=自分)
  deliverables?: string[]    // 任意 — 成果物リスト
  deadline?: string          // 任意 — 期限 (ISO 8601)
  notes?: string             // 任意 — 備考
}
```

---

## 3. 実装方針 — Heartbeat Wake アプローチ

### 3.1 方針の選定理由

3つのアプローチを検討した結果:

| アプローチ | メリット | デメリット |
|-----------|---------|----------|
| A. 新規Hook Event + Isolated Agent | 柔軟性が高い | 大規模な新規実装が必要 |
| B. **Heartbeat Wake** (採用) | 既存の仕組みを最大活用、安定性が高い | heartbeatが有効である前提 |
| C. Cron Job | シンプル | リアルタイム性がない |

**アプローチB (Heartbeat Wake) を採用する理由:**

1. `requestHeartbeatNow()` は既に実装済みで、テスト済みの安定したAPI
2. Heartbeat Runnerはデュープ防止、リトライ、コアレシングを内蔵
3. エージェントはheartbeat実行時にワークスペースファイル(USER.md等)を自動読み込み
4. コマンドキュー・レーンシステムと統合済み（並行実行制御）
5. **最小限のコード変更で実現可能**

### 3.2 実装の全体像

```
[変更箇所1] grc-sync.ts — pullAndApplyConfig()
  syncRoleConfig() 成功後に requestHeartbeatNow() を呼ぶ
  reason にSSEイベントの reason ("strategy_deploy") を渡す

[変更箇所2] heartbeat-events-filter.ts (または新規ファイル)
  reason="strategy_deploy" の場合、戦略分析用プロンプトを構築

[変更箇所3] HEARTBEAT.md (ワークスペースファイル)
  戦略変更時の行動指示を追加（GRCロールテンプレートから配信）

[確認のみ] GRC POST /a2a/tasks/create
  既存APIが正しく動作することを検証（新規変更不要）
```

---

## 4. 詳細実装計画

### 4.1 変更1: `grc-sync.ts` — 同期完了後にHeartbeat起動

**ファイル**: `src/infra/grc-sync.ts`
**場所**: `pullAndApplyConfig()` メソッド (line 1072-1091)

**現在のコード:**
```typescript
private pullAndApplyConfig(revision: number): void {
  const signal = this.sseAbortController?.signal;
  this.syncRoleConfig(signal)
    .then((result) => {
      if (result.pulled) {
        this.sseCurrentRevision = result.revisionApplied ?? revision;
        sseLog.info("SSE-triggered full config sync completed", {
          revision: result.revisionApplied,
          filesWritten: result.filesWritten,
        });
        // ★ ここで終了 — エージェントは起動しない
      }
      // ...
    })
```

**変更後のコード:**
```typescript
private pullAndApplyConfig(revision: number, reason?: string): void {
  const signal = this.sseAbortController?.signal;
  this.syncRoleConfig(signal)
    .then((result) => {
      if (result.pulled) {
        this.sseCurrentRevision = result.revisionApplied ?? revision;
        sseLog.info("SSE-triggered full config sync completed", {
          revision: result.revisionApplied,
          filesWritten: result.filesWritten,
        });

        // ★ 追加: 戦略デプロイ時はHeartbeatを即時起動
        if (reason && this.shouldTriggerHeartbeat(reason)) {
          sseLog.info("Triggering heartbeat for config sync event", { reason });
          requestHeartbeatNow({
            reason: `config_sync:${reason}`,
            coalesceMs: 2000,  // 2秒のコアレシング (複数イベント合体)
          });
        }
      }
      // ...
    })
```

**新規ヘルパーメソッド:**
```typescript
/**
 * Heartbeatトリガー対象のSSE reasonかどうか判定。
 * 戦略デプロイ時のみHeartbeatを起動する。
 * 将来的に他のreason (例: "role_reassignment") も追加可能。
 */
private shouldTriggerHeartbeat(reason: string): boolean {
  const HEARTBEAT_TRIGGER_REASONS = [
    "strategy_deploy",
  ];
  return HEARTBEAT_TRIGGER_REASONS.includes(reason);
}
```

**SSEイベントハンドラの変更** (handleSSEEvent内):
```typescript
// 現在: this.pullAndApplyConfig(parsed.revision);
// 変更: this.pullAndApplyConfig(parsed.revision, parsed.reason);
```

**必要なimport追加:**
```typescript
import { requestHeartbeatNow } from "./heartbeat-wake.js";
```

### 4.2 変更2: Heartbeat戦略分析プロンプト

Heartbeat Runnerが `reason: "config_sync:strategy_deploy"` で起動された場合、
通常のheartbeatプロンプトに加えて戦略分析用の指示を注入する。

**方針**: `heartbeat-events-filter.ts` の既存パターンに従い、
`isConfigSyncEvent()` と `buildConfigSyncEventPrompt()` を追加する。

**新規ファイル**: `src/infra/heartbeat-strategy-prompt.ts`

```typescript
/**
 * 戦略デプロイ起因のHeartbeat用プロンプト構築。
 * USER.md から最新戦略を読み取り、CEOとして分析・タスク作成を指示する。
 */
export function buildStrategyDeployPrompt(params: {
  reason: string;
  workspaceDir: string;
}): string {
  return `
## 重要: 戦略変更通知

会社の戦略が更新されました (理由: ${params.reason})。
ワークスペースの USER.md に最新の戦略情報が反映されています。

### あなたの任務

1. **USER.md を読み込み**、更新された戦略内容を確認してください
2. **AGENTS.md を読み込み**、あなたの役割と権限を確認してください
3. 戦略変更の内容を分析し、以下を判断してください:
   - 新しい目標やKPIへの対応に必要なアクション
   - 各部門に委任すべきタスク
   - 優先度とデッドライン
4. **タスクを作成**してください:
   - \`create_agent_task\` ツールを使用
   - trigger_type: "strategy" を指定
   - category: "strategic" または "operational"
   - 適切な target_role_id で各部門に委任
5. 作成したタスクのサマリーを報告してください

### タスク作成の指針

- 実行可能で具体的なタスクを作成すること
- 1回のデプロイにつき最大5タスクを目安に
- 重複するタスクを作成しないこと
- 戦略の優先事項に沿った内容であること
`.trim();
}
```

### 4.3 変更3: Heartbeat Events Filter統合

**ファイル**: `src/infra/heartbeat-events-filter.ts`

既存のパターン(`isCronSystemEvent`, `isExecCompletionEvent`)に従い追加:

```typescript
/** SSE config_sync由来のheartbeat wakeかどうか判定 */
export function isConfigSyncEvent(reason: string): boolean {
  return reason.startsWith("config_sync:");
}

/** config_sync reasonから元のSSE reasonを取り出す */
export function extractConfigSyncReason(reason: string): string {
  return reason.replace(/^config_sync:/, "");
}

/** config_sync heartbeat用のプロンプトを構築 */
export function buildConfigSyncEventPrompt(reason: string, workspaceDir: string): string {
  const sseReason = extractConfigSyncReason(reason);
  if (sseReason === "strategy_deploy") {
    return buildStrategyDeployPrompt({ reason: sseReason, workspaceDir });
  }
  // 将来: 他のreason (role_reassignment等) もここに追加
  return "";
}
```

### 4.4 変更4: Heartbeat Runner統合

**ファイル**: `src/infra/heartbeat-runner.ts`

Heartbeat実行時に `reason` を検査し、config_sync由来であれば戦略分析プロンプトを
通常のheartbeatプロンプトに**追加**（置換ではない）する。

```typescript
// runHeartbeatOnce() 内、プロンプト構築セクション
if (isConfigSyncEvent(resolvedReason)) {
  const configSyncPrompt = buildConfigSyncEventPrompt(resolvedReason, workspaceDir);
  if (configSyncPrompt) {
    // 通常のheartbeatプロンプトの先頭に戦略分析指示を追加
    prompt = configSyncPrompt + "\n\n---\n\n" + prompt;
  }
}
```

### 4.5 エージェントツール: `create_agent_task`

**現状**: `GrcClient.createAgentTask()` はすでに実装済み (`grc-client.ts:1275`)。

**必要な確認**: エージェントがheartbeat実行中にこのツールを呼び出せるか。

```
呼び出しチェーン:
  Agent (LLM) → sessions_spawn or tool call
    → create_agent_task tool
    → GrcClient.createAgentTask()
    → POST /a2a/tasks/create

認証: ノードのJWTトークン (winclaw.jsonに保存済み)
```

**補足**: `create_agent_task` がエージェントツールとしてまだ登録されていない場合、
専用のツール定義ファイルを作成する必要がある。
調査結果では `src/agents/tools/` 配下に各種ツールが定義されている。

**新規ファイル** (必要な場合): `src/agents/tools/grc-task-tool.ts`

```typescript
export function createGrcTaskTool(grcClient: GrcClient, nodeId: string, roleId: string) {
  return {
    name: "create_agent_task",
    description: "GRCにエージェントタスクを作成する。戦略変更への対応や部門への委任に使用。",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "タスクのタイトル" },
        description: { type: "string", description: "タスクの詳細説明" },
        category: { type: "string", enum: ["strategic", "operational", "expense"] },
        priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
        target_role_id: { type: "string", description: "委任先ロールID (例: cto, marketing)" },
        deliverables: { type: "array", items: { type: "string" } },
        deadline: { type: "string", description: "期限 (ISO 8601)" },
        notes: { type: "string" },
      },
      required: ["title"],
    },
    execute: async (_callId, args) => {
      const result = await grcClient.createAgentTask({
        node_id: nodeId,
        title: args.title,
        description: args.description,
        category: args.category || "strategic",
        priority: args.priority || "high",
        target_role_id: args.target_role_id,
        trigger_type: "strategy",
        deliverables: args.deliverables,
        deadline: args.deadline,
        notes: args.notes,
      });
      return JSON.stringify(result);
    },
  };
}
```

---

## 5. GRC側の変更（最小限）

### 5.1 `deployStrategy()` — 自動タスク作成の削除

**ファイル**: `src/modules/strategy/service.ts`

現在 `deployStrategy()` 内で直接CEOタスクを作成しているロジックを**削除**する。
タスク作成はCEOエージェントが自律的に行うため、GRC側での自動作成は不要。

```
削除対象: deployStrategy() 内の createTask() 呼び出し部分
  → "Strategic Realignment - Revision X" タスクの自動生成コード
```

**理由**: エージェントが自律的にタスクを作成するのが目標であり、
GRC側での自動作成と重複してしまうため。

### 5.2 検証: ノード認証でのタスク作成

`POST /a2a/tasks/create` はノード認証 (`authRequired`) で保護されている。
WinClawのJWTトークンでこのエンドポイントが利用可能であることを検証する必要がある。

**検証手順**:
```bash
curl -X POST -H "Authorization: Bearer <node_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "creator_role_id": "ceo",
    "creator_node_id": "<node_id>",
    "title": "Test Agent Task",
    "trigger_type": "strategy",
    "category": "strategic",
    "priority": "medium"
  }' \
  http://localhost:3100/a2a/tasks/create
```

---

## 6. E2Eフロー（実装後の期待動作）

```
Step 1: Admin がダッシュボードで「保存並部署到所有代理」をクリック
  → POST /api/v1/admin/strategy/deploy

Step 2: GRC — 戦略をデプロイ
  → 全ノードのUSER.md更新 (revision N+1)
  → SSEプッシュ: { revision: N+1, reason: "strategy_deploy" }
  → ★ GRC側のCEOタスク自動作成は削除

Step 3: WinClaw Gateway — SSE受信
  → config_update イベント受信
  → pullAndApplyConfig(revision, "strategy_deploy")
  → syncRoleConfig(): USER.md, AGENTS.md等をワークスペースに書き込み
  → shouldTriggerHeartbeat("strategy_deploy") → true
  → requestHeartbeatNow({ reason: "config_sync:strategy_deploy" })

Step 4: Heartbeat Runner — エージェントセッション起動
  → reason: "config_sync:strategy_deploy" を検出
  → 戦略分析プロンプトを構築 + 通常heartbeatプロンプトに合体
  → runEmbeddedPiAgent() でエージェントセッション実行
  → エージェントにツール create_agent_task を提供

Step 5: CEO エージェント — 自律実行
  → USER.md から最新の戦略(Mission, Vision, Q1-Q4 Goals等)を読み込み
  → AGENTS.md からCEOの責務・権限を読み込み
  → 戦略変更を分析:
     例: "Q2のARR目標$1Mに対して、SDK Downloads 500+が必要"
  → create_agent_task で具体的なタスクを作成:
     例1: { title: "Agent Guardrails SDK リリース準備",
            target_role_id: "cto", category: "strategic", priority: "high" }
     例2: { title: "日本金融セクター向けデザインパートナー5社契約",
            target_role_id: "marketing", category: "operational", priority: "high" }

Step 6: GRC — タスク保存
  → POST /a2a/tasks/create でタスクがDB保存
  → ポリシーチェック通過 (CEO: 10/day, requiresApproval=false)
  → タスクコード自動生成 (例: EXC-STR-006, MKT-001)

Step 7: 検証
  → ダッシュボードのタスクボードに新タスクが表示
  → assignedBy: "agent:ceo:<node_id>" で識別可能
  → trigger_type: "strategy" がnotes内に記録
```

---

## 7. 実装タスクリスト

### Phase 1: コア実装 (最優先)

| # | タスク | ファイル | 難易度 |
|---|--------|----------|--------|
| 1 | `pullAndApplyConfig()` に reason 引数追加 | `grc-sync.ts` | 低 |
| 2 | SSEハンドラから reason を `pullAndApplyConfig()` に渡す | `grc-sync.ts` | 低 |
| 3 | `shouldTriggerHeartbeat()` メソッド追加 | `grc-sync.ts` | 低 |
| 4 | `requestHeartbeatNow()` 呼び出し追加 | `grc-sync.ts` | 低 |
| 5 | `isConfigSyncEvent()` + `buildConfigSyncEventPrompt()` 追加 | `heartbeat-events-filter.ts` | 中 |
| 6 | Heartbeat Runner に config_sync プロンプト注入 | `heartbeat-runner.ts` | 中 |
| 7 | `create_agent_task` ツール定義 (存在しない場合) | `agents/tools/grc-task-tool.ts` | 中 |

### Phase 2: GRC側整理

| # | タスク | ファイル | 難易度 |
|---|--------|----------|--------|
| 8 | `deployStrategy()` の自動タスク作成コード削除 | `strategy/service.ts` | 低 |
| 9 | ノード認証でのタスク作成API検証 | `tasks/routes.ts` | 低 |

### Phase 3: E2Eテスト

| # | タスク | 難易度 |
|---|--------|--------|
| 10 | GRC + Gateway再起動 → SSE接続確認 | 低 |
| 11 | ダッシュボードから戦略デプロイ実行 | 低 |
| 12 | Heartbeat起動確認 (ログ確認) | 中 |
| 13 | エージェントのタスク作成確認 (DB/ダッシュボード) | 中 |
| 14 | タスクの内容品質検証 (戦略に沿った内容か) | 高 |

---

## 8. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| Heartbeat未有効 | エージェント起動しない | heartbeat有効チェック + 警告ログ |
| LLMキー未配布 | エージェント応答不能 | GRC key_config 配布済みか事前確認 |
| タスク重複作成 | 同じタスクが複数回作成 | GRC側の重複検出 (同タイトル+ロール 24h以内) |
| API認証エラー | タスク作成失敗 | JWTトークン自動リフレッシュ対応 |
| 戦略内容が空 | 無意味なタスク生成 | プロンプト内でバリデーション指示 |
| SSEコアレシング | 複数SSEイベント合体 | 2秒のcoalesceMs設定で自然な合体 |
| Heartbeat実行中に再度SSE | 二重実行 | heartbeat-wake内蔵のデュープ防止 |

---

## 9. 将来の拡張

1. **他のロールへの展開**: CTOやMarketing等のロールも戦略変更時に自律タスク作成
2. **タスクチェーン**: CEOが作成したタスクに対し、委任先ロールが子タスクを自動生成
3. **ロール変更トリガー**: `reason: "role_assignment"` でもHeartbeat起動
4. **フィードバックループ**: タスク完了時にCEOに報告 → 次のアクション判断
5. **HEARTBEAT.md テンプレート**: GRCロールテンプレートに戦略対応指示を含める

---

## 10. 見積もり

- **Phase 1 (コア実装)**: 2-3時間
- **Phase 2 (GRC整理)**: 30分
- **Phase 3 (E2Eテスト)**: 1-2時間
- **合計**: 約4-6時間

---

## 付録A: ファイル依存関係マップ

```
src/infra/grc-sync.ts
  ├── import { requestHeartbeatNow } from "./heartbeat-wake.js"   ★追加
  ├── pullAndApplyConfig() に reason引数追加                        ★変更
  ├── shouldTriggerHeartbeat() 追加                                 ★追加
  └── handleSSEEvent() から reason を渡す                           ★変更

src/infra/heartbeat-events-filter.ts
  ├── isConfigSyncEvent()                                          ★追加
  ├── extractConfigSyncReason()                                    ★追加
  └── buildConfigSyncEventPrompt()                                 ★追加

src/infra/heartbeat-strategy-prompt.ts                             ★新規
  └── buildStrategyDeployPrompt()

src/infra/heartbeat-runner.ts
  └── runHeartbeatOnce() 内にconfig_syncプロンプト注入              ★変更

src/agents/tools/grc-task-tool.ts                                  ★新規 (必要な場合)
  └── createGrcTaskTool()

--- GRC側 ---

src/modules/strategy/service.ts
  └── deployStrategy() の自動タスク作成コード削除                    ★変更
```

## 付録B: SSEイベント reason 値一覧

| reason | 発生元 | Heartbeatトリガー |
|--------|--------|-------------------|
| `"strategy_deploy"` | strategy/service.ts deployStrategy() | ✅ Yes |
| `"role_assignment"` | roles/service.ts assignRoleToNode() | ❌ No (将来対応) |
| `"key_config_update"` | evolution/node-config-sse.ts | ❌ No |

## 付録C: `create_agent_task` ツール呼び出し例

エージェントが実際にツールを呼び出す際のJSON:

```json
{
  "tool": "create_agent_task",
  "arguments": {
    "title": "Q2 Agent Guardrails SDK — Python/Java対応版リリース",
    "description": "Q2目標のSDK Downloads 500+達成のため、Python/Java両言語対応のAgent Guardrails SDKを開発・リリースする。",
    "category": "strategic",
    "priority": "high",
    "target_role_id": "cto",
    "deliverables": [
      "Python SDK パッケージ (PyPI公開)",
      "Java SDK パッケージ (Maven Central公開)",
      "SDKドキュメント (EN/JA)",
      "サンプルコード"
    ],
    "deadline": "2025-06-30T23:59:59Z",
    "notes": "Q2 KPI: SDK Downloads 500+ に直結する最重要施策"
  }
}
```
