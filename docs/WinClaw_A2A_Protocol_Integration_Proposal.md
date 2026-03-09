# WinClaw A2A Protocol Integration Proposal

**Multi-Agent Discussion & Meeting System via Google A2A Protocol**

| 項目 | 内容 |
|------|------|
| Author | WinClaw Architecture Team |
| Date | 2026-03-08 |
| Status | Draft — Review Required |
| Related | GRC_AI_Employee_Office_Console_Plan.md, GRC_Config_Distribution_Detail.md |
| Reference | [Google A2A Protocol](https://github.com/google/A2A), [openclaw-a2a-gateway](https://github.com/win4r/openclaw-a2a-gateway) |

---

## 1. Executive Summary

本提案は、WinClaw Client間の通信を現行のGRC A2A Relay（Pull型DBキュー）から**Google A2A Protocol準拠のリアルタイム通信**へ進化させる設計を提示する。特に「複数AIエージェントが議論・協議・会議を行う」シナリオを実現するためのアーキテクチャを定義する。

**核心的な結論**: GRC A2A Relayを完全に置き換えるのではなく、**A2A Gatewayレイヤーを追加**し、既存Relayをasync永続化バックエンドとして活用しつつ、リアルタイム討議機能をA2Aプロトコルで実現する**ハイブリッドアーキテクチャ**を推奨する。

---

## 2. 現状分析

### 2.1 現行GRC A2A Relay アーキテクチャ

```
WinClaw Client A                    GRC Server                    WinClaw Client B
    │                                   │                              │
    ├── POST /relay/send ──────────────►│ INSERT a2a_relay_queue       │
    │                                   │                              │
    │   (4時間後...)                     │                              │
    │                                   │◄──── GET /relay/inbox ───────┤
    │                                   │  SELECT ... WHERE status=queued
    │                                   │────── messages[] ────────────►│
    │                                   │                              │
    │                                   │◄──── POST /relay/ack ────────┤
    │                                   │  UPDATE status=acknowledged  │
```

**特徴**:
- **Pull型**: 各ノードが4時間間隔でsync時にinboxをポーリング
- **DB永続化**: MySQL `a2a_relay_queue` テーブルに全メッセージを保存
- **メッセージ型**: text / task_assignment / directive / report / query
- **ライフサイクル**: queued → delivered → acknowledged → expired/failed
- **優先度**: critical / high / normal / low
- **有効期限**: 72時間（デフォルト）

### 2.2 現行Relayの限界

| 問題 | 詳細 |
|------|------|
| **高レイテンシ** | 4時間ポーリング間隔。リアルタイム討議は不可能 |
| **一方向通信** | 送信→受信の1ショット。対話的なやり取り未対応 |
| **ピア発見なし** | クライアント同士が相互の能力・状態を知る手段がない |
| **ストリーミング未対応** | 長時間タスクの進捗をリアルタイムに共有できない |
| **会議/グループ討議不可** | 1対1メッセージのみ。N対Nの討議ルーム概念がない |
| **単一障害点** | GRC Serverダウンで全通信停止 |

### 2.3 リアルタイム討議に必要な機能

マルチエージェント会議シナリオには以下が必要:

1. **リアルタイムメッセージ交換** — ms～秒単位のレイテンシ
2. **マルチターン対話** — 文脈を保持した連続的なやり取り
3. **参加者発見** — 誰が会議に参加可能か動的に把握
4. **ストリーミング応答** — AIが思考中の途中結果をリアルタイム共有
5. **会議ルーム管理** — セッション作成・参加・退出・終了
6. **議事録/コンセンサス記録** — 結論と合意事項の永続化

---

## 3. Google A2A Protocol概要

### 3.1 プロトコル基本

Google A2A (Agent-to-Agent) Protocol は、異種AIエージェント間の標準通信プロトコル。

| 要素 | 内容 |
|------|------|
| トランスポート | HTTP + JSON-RPC 2.0 |
| ストリーミング | Server-Sent Events (SSE) |
| 発見 | `/.well-known/agent.json` (Agent Card) |
| 認証 | OAuth 2.0 / Bearer Token / mTLS |
| バージョン | v0.3.0 (2025年時点) |

### 3.2 コアコンセプト

#### Agent Card（エージェント発見）

```json
{
  "name": "CEO Agent",
  "description": "Chief Executive Officer AI - Strategic decision making",
  "url": "https://ceo-agent.local:18800",
  "version": "1.0.0",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateTransitionHistory": true
  },
  "skills": [
    {
      "id": "strategic-planning",
      "name": "Strategic Planning",
      "description": "Quarterly/annual strategic planning and KPI allocation"
    },
    {
      "id": "budget-approval",
      "name": "Budget Approval",
      "description": "Department budget review and approval"
    }
  ],
  "authentication": {
    "schemes": ["bearer"]
  }
}
```

#### Task ライフサイクル

```
submitted → working → [input-required ↔ working] → completed/failed/canceled
```

- **submitted**: タスク送信済み
- **working**: エージェントが処理中（ストリーミング中）
- **input-required**: 追加情報を要求（マルチターン対話のキー）
- **completed**: 成功完了（Artifactに結果）
- **failed/canceled**: 失敗/キャンセル

#### JSON-RPC エンドポイント

| メソッド | 用途 |
|---------|------|
| `tasks/send` | タスク送信（同期応答） |
| `tasks/sendSubscribe` | タスク送信 + SSEストリーミング |
| `tasks/get` | タスク状態取得 |
| `tasks/cancel` | タスク取消 |
| `tasks/pushNotification/set` | プッシュ通知登録 |
| `tasks/pushNotification/get` | プッシュ通知取得 |

#### マルチターン対話

`contextId` を共有することで、同一文脈での連続的なやり取りが可能:

```
Client A → CEO Agent: tasks/send { contextId: "meeting-001", message: "Q2予算案を提示してください" }
CEO Agent → Client A: { status: "completed", artifact: "Q2予算案: ..." }
Client A → CEO Agent: tasks/send { contextId: "meeting-001", message: "マーケティング部の配分を10%増やせますか？" }
CEO Agent → Client A: { status: "input-required", message: "財務部の承認が必要です" }
```

### 3.3 openclaw-a2a-gateway の実装分析

[openclaw-a2a-gateway](https://github.com/win4r/openclaw-a2a-gateway) はOpenClaw向けA2Aゲートウェイプラグイン。

**アーキテクチャ**:
- TypeScript、OpenClaw Plugin API準拠
- HTTP (Express, port 18800) + gRPC (port 18801)
- A2A v0.3.0 準拠

**主要ファイル構成**:

```
openclaw-a2a-gateway/
├── index.ts              # プラグインエントリ（lifecycle hooks）
├── src/
│   ├── executor.ts       # Inbound A2Aリクエスト → OpenClaw CLI へルーティング
│   ├── client.ts         # Outbound A2A呼び出し（他エージェントへ送信）
│   ├── agent-card.ts     # Agent Card動的生成
│   ├── server.ts         # Express HTTPサーバー
│   ├── grpc-server.ts    # gRPCサーバー
│   └── task-store.ts     # InMemoryTaskStore
├── proto/
│   └── a2a.proto         # gRPCスキーマ定義
```

**参考になる設計パターン**:

1. **Plugin型アーキテクチャ**: OpenClawのskillシステムにA2Aを外付け
2. **Agent Card動的生成**: ノードのスキル情報からAgent Cardを自動構築
3. **Executor Pattern**: 受信A2Aリクエストをローカルエージェントの処理にルーティング
4. **Dual Protocol**: HTTP + gRPCの二重公開

**現状の制限**:

| 制限 | 詳細 |
|------|------|
| InMemoryTaskStore | サーバー再起動でタスク消失 |
| ストリーミング未実装 | SSE未対応、同期応答のみ |
| レート制限なし | DoS耐性なし |
| ピアヘルスチェックなし | 相手エージェントの死活監視なし |
| 会議/グループ機能なし | 1対1通信のみ |

---

## 4. 提案アーキテクチャ: ハイブリッドA2A Meeting System

### 4.1 設計方針

**GRC A2A Relayを廃止せず、A2A Gatewayを重ねるハイブリッド型**を採用する。

理由:
1. 既存Relayは非同期タスク配信（directive, task_assignment）に適しており、そのユースケースは残る
2. A2Aプロトコルはリアルタイム討議に最適だが、永続化・監査ログはDB Relayが担うべき
3. 段階的移行が可能（Phase 1でA2A Gateway追加、Phase 2で既存Relay統合）

### 4.2 全体アーキテクチャ

```
                          ┌─────────────────────────────────┐
                          │        GRC Server (Central)     │
                          │                                 │
                          │  ┌───────────────────────────┐  │
                          │  │    Meeting Orchestrator    │  │
                          │  │  - Session管理             │  │
                          │  │  - 参加者ルーティング       │  │
                          │  │  - 議事録記録              │  │
                          │  │  - コンセンサス判定        │  │
                          │  └─────────┬─────────────────┘  │
                          │            │                     │
                          │  ┌─────────┴─────────────────┐  │
                          │  │      A2A Gateway Hub       │  │
                          │  │  - Agent Card Registry     │  │
                          │  │  - JSON-RPC Router         │  │
                          │  │  - SSE Multiplexer         │  │
                          │  │  - Task Store (DB-backed)  │  │
                          │  └─────────┬─────────────────┘  │
                          │            │                     │
                          │  ┌─────────┴─────────────────┐  │
                          │  │   Existing A2A Relay       │  │
                          │  │  (async永続化バックエンド)  │  │
                          │  └───────────────────────────┘  │
                          └──────┬──────────┬──────────┬────┘
                                 │          │          │
                    SSE/HTTP     │          │          │     SSE/HTTP
                ┌────────────────┘          │          └────────────────┐
                │                           │                          │
        ┌───────┴────────┐         ┌────────┴───────┐        ┌────────┴───────┐
        │  WinClaw Node  │         │  WinClaw Node  │        │  WinClaw Node  │
        │  (CEO Agent)   │         │  (CTO Agent)   │        │  (CFO Agent)   │
        │                │         │                │        │                │
        │  A2A Client    │         │  A2A Client    │        │  A2A Client    │
        │  Agent Card    │         │  Agent Card    │        │  Agent Card    │
        └────────────────┘         └────────────────┘        └────────────────┘
```

### 4.3 Hub型 vs P2P型 の選択

| 方式 | メリット | デメリット |
|------|---------|-----------|
| **Hub型（採用）** | 中央管理、監査容易、NAT透過、既存GRCと統合 | 単一障害点、Hub負荷集中 |
| P2P型 | 低レイテンシ、分散型 | NAT問題、発見困難、監査困難 |

**Hub型を採用する理由**: GRC Serverは既にクライアント管理・認証・監査の中核であり、A2A GatewayをGRCに組み込むことで既存インフラを最大活用できる。WinClawクライアントはNAT/ファイアウォール背後にあることが多く、P2P接続は現実的でない。

### 4.4 コンポーネント詳細

#### 4.4.1 A2A Gateway Hub（GRC Server側）

GRC Serverに追加する新モジュール。

**責務**:
- Agent Card Registry: 全ノードのAgent Cardを集中管理
- JSON-RPC Router: A2Aリクエストを適切なノードへルーティング
- SSE Multiplexer: 複数クライアントへのストリーミング配信
- Task Store: DB永続化されたタスク管理（既存relay_queueと統合）

```typescript
// src/modules/a2a-gateway/routes.ts

// Agent Card Registry
GET  /a2a/agents                        // 登録済み全エージェント一覧
GET  /a2a/agents/:nodeId/agent.json     // 特定ノードのAgent Card
POST /a2a/agents/:nodeId/register       // Agent Card登録/更新

// A2A JSON-RPC Endpoint (proxy)
POST /a2a/rpc/:targetNodeId             // ターゲットノードへのA2Aリクエスト転送

// Meeting Management (Agent + Admin 共用)
POST /a2a/meetings                      // 会議セッション作成（Agent発起 or Admin発起）
GET  /a2a/meetings/:sessionId           // 会議状態取得
POST /a2a/meetings/:sessionId/join      // 会議参加
POST /a2a/meetings/:sessionId/leave     // 会議退出
POST /a2a/meetings/:sessionId/message   // 会議メッセージ送信
GET  /a2a/meetings/:sessionId/stream    // SSEストリーム（会議の全メッセージ受信）
POST /a2a/meetings/:sessionId/close     // 会議終了

// Admin Only
GET  /api/v1/admin/a2a/meetings                // 全会議一覧
GET  /api/v1/admin/a2a/meetings/:id            // 会議詳細（議事録含む）
POST /api/v1/admin/a2a/meetings/:id/pause      // 会議一時停止
POST /api/v1/admin/a2a/meetings/:id/resume     // 会議再開
POST /api/v1/admin/a2a/meetings/:id/end        // 会議強制終了
POST /api/v1/admin/a2a/meetings/:id/message    // 管理者として発言挿入
GET  /api/v1/admin/a2a/agents                  // エージェント一覧・状態
GET  /api/v1/admin/a2a/triggers                // 自動トリガー一覧
POST /api/v1/admin/a2a/triggers                // 自動トリガー作成
PUT  /api/v1/admin/a2a/triggers/:id            // 自動トリガー更新
DELETE /api/v1/admin/a2a/triggers/:id          // 自動トリガー削除
```

#### 4.4.2 A2A Client（WinClaw Client側）

各WinClawクライアントに組み込むA2Aクライアントモジュール。

**責務**:
- Agent Card公開（GRC Hub経由）
- A2Aリクエスト受信・処理
- 会議への参加・発言
- SSEストリームの購読

```typescript
// WinClaw Client A2A Module

interface A2AClientConfig {
  nodeId: string;
  grcBaseUrl: string;
  agentCard: AgentCard;
  capabilities: string[];
}

class WinClawA2AClient {
  // Agent Card登録
  async registerAgentCard(): Promise<void>;

  // 他エージェントへメッセージ送信（Hub経由）
  async sendTask(targetNodeId: string, message: Message): Promise<Task>;

  // ストリーミング送信
  async sendTaskSubscribe(targetNodeId: string, message: Message): AsyncGenerator<TaskEvent>;

  // === 会議発起（Agent自律発起） ===
  async initiateMeeting(request: {
    title: string;
    type: MeetingType;
    reason: string;                    // 発起理由（必須）
    participants: string[];            // 招待するnodeId / roleId
    agenda: AgendaItem[];
    priority?: 'critical' | 'high' | 'normal' | 'low';
    maxDurationMinutes?: number;
  }): Promise<{ sessionId: string; status: 'scheduled' | 'active' }>;

  // 会議参加
  async joinMeeting(sessionId: string): Promise<MeetingSession>;

  // 会議メッセージ送信
  async sendMeetingMessage(sessionId: string, message: string): Promise<void>;

  // 会議SSEストリーム購読
  subscribeMeetingStream(sessionId: string): EventSource;
}
```

#### 4.4.3 Meeting Orchestrator（会議管理）

マルチエージェント討議の中核コンポーネント。

```typescript
interface MeetingSession {
  id: string;                    // UUID
  title: string;                 // "Q2 Budget Planning Meeting"
  type: 'discussion' | 'review' | 'brainstorm' | 'decision';
  status: 'scheduled' | 'active' | 'paused' | 'concluded' | 'cancelled';

  // 参加者
  participants: MeetingParticipant[];
  facilitator: string;           // nodeId of meeting facilitator (any agent can be facilitator)

  // アジェンダ
  agenda: AgendaItem[];
  currentAgendaIndex: number;

  // コンテキスト
  contextId: string;             // A2A contextId（マルチターン文脈）
  sharedContext: string;         // 全参加者共有のコンテキスト情報

  // 記録
  transcript: TranscriptEntry[];
  decisions: Decision[];
  actionItems: ActionItem[];

  // タイミング
  scheduledAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
  maxDurationMinutes: number;

  // 発起者情報
  createdBy: string;             // nodeId or 'admin' (Dashboard)
  initiatorType: 'human' | 'agent';  // 人間(Dashboard) or Agent(自律発起)
  initiationReason?: string;     // Agent発起時の理由
}

interface MeetingParticipant {
  nodeId: string;
  role: string;                  // 'ceo', 'cto', 'cfo', etc.
  displayName: string;
  status: 'invited' | 'joined' | 'speaking' | 'left';
  joinedAt?: Date;
}

interface AgendaItem {
  id: string;
  title: string;
  description: string;
  duration: number;              // minutes
  status: 'pending' | 'discussing' | 'concluded';
  presenter: string;             // nodeId
  decisions: Decision[];
}

interface TranscriptEntry {
  timestamp: Date;
  speakerNodeId: string;
  speakerRole: string;
  content: string;
  type: 'statement' | 'question' | 'answer' | 'proposal' | 'objection' | 'agreement';
  replyTo?: string;              // 返答先のentry ID
}

interface Decision {
  id: string;
  agendaItemId: string;
  description: string;
  type: 'consensus' | 'majority' | 'escalated' | 'deferred';
  supporters: string[];          // nodeIds
  dissenters: string[];
  rationale: string;
  actionItems: ActionItem[];
}

interface ActionItem {
  id: string;
  description: string;
  assignee: string;              // nodeId
  dueDate?: Date;
  priority: 'critical' | 'high' | 'medium' | 'low';
  relatedDecisionId?: string;
}
```

### 4.5 会議発起モデル

会議は**2つのルート**から発起可能:

| 発起者 | ルート | ユースケース |
|--------|--------|-------------|
| **人間（Dashboard）** | Admin API → Meeting Orchestrator | 定例会議、戦略討議、予算承認 |
| **Agent（WinClaw Node）** | Agent API → Meeting Orchestrator | 緊急課題、技術判断、クロスチーム調整 |

#### 4.5.1 発起権限モデル

Agent間の会議は**人間の承認なしに自律的に実施**される。これはWinClawの設計思想（AIエージェントが自律的に協働する）に沿った方針である。人間管理者はDashboardで会議状況を事後的にモニタリング・介入できる。

ただし、リソース保護のためロール毎の上限制御は設ける:

```typescript
interface MeetingInitiationPolicy {
  // ロール毎の会議発起権限
  rolePermissions: {
    [roleId: string]: {
      canInitiate: boolean;              // 会議発起可能か
      maxConcurrentMeetings: number;     // 同時開催数上限
      allowedTypes: MeetingType[];       // 発起可能な会議タイプ
      canInviteRoles: string[];          // 招待可能なロール
    };
  };
}

// デフォルト設定例
const defaultPolicy: MeetingInitiationPolicy = {
  rolePermissions: {
    'ceo': {
      canInitiate: true,
      maxConcurrentMeetings: 3,
      allowedTypes: ['discussion', 'review', 'brainstorm', 'decision'],
      canInviteRoles: ['*'],             // 全ロール招待可
    },
    'cto': {
      canInitiate: true,
      maxConcurrentMeetings: 2,
      allowedTypes: ['discussion', 'review', 'brainstorm', 'decision'],
      canInviteRoles: ['ceo', 'dev_lead', 'security_officer', 'devops'],
    },
    'cfo': {
      canInitiate: true,
      maxConcurrentMeetings: 2,
      allowedTypes: ['discussion', 'review', 'decision'],
      canInviteRoles: ['ceo', 'marketing_head', 'hr_manager'],
    },
    'dev_lead': {
      canInitiate: true,
      maxConcurrentMeetings: 2,
      allowedTypes: ['discussion', 'brainstorm', 'review'],
      canInviteRoles: ['cto', 'devops', 'security_officer'],
    },
    // その他のロール...
    '_default': {
      canInitiate: true,
      maxConcurrentMeetings: 1,
      allowedTypes: ['discussion', 'brainstorm'],
      canInviteRoles: [],                // 同階層・上位ロールのみ
    }
  }
};
```

**人間管理者の関与**:
- **事前承認は不要** — Agent間会議は全て自律的に開始される
- **リアルタイム監視** — Dashboard MeetingLivePageで進行中の会議を閲覧可能
- **介入** — 必要に応じて管理者が発言、一時停止、アジェンダスキップ、強制終了が可能
- **事後レビュー** — 議事録・決定事項・Action Itemsを確認し、必要なら却下・修正

#### 4.5.2 Agent発起の会議フロー

```
WinClaw Node (CTO Agent)
    │
    │ 検出: セキュリティ脆弱性CVE-2026-XXXXが自社製品に影響
    │ 判断: 緊急会議が必要（CEO + Security Officer + DevOps）
    │
    ├── POST /a2a/meetings
    │   { title: "Critical Security Vulnerability Response",
    │     type: "decision",
    │     initiatorType: "agent",
    │     initiationReason: "CVE-2026-XXXX detected in production dependency",
    │     facilitator: "cto",             // 発起者自身がfacilitator
    │     participants: ["ceo", "security_officer", "devops"],
    │     agenda: [
    │       { title: "脆弱性の影響範囲分析", presenter: "security_officer" },
    │       { title: "修正パッチ計画", presenter: "devops" },
    │       { title: "顧客通知判断", presenter: "ceo" }
    │     ],
    │     priority: "critical",
    │     maxDurationMinutes: 30 }
    ▼
GRC A2A Gateway Hub
    │
    │ 1. 権限チェック: CTO → canInitiate=true, 'decision'許可, 同時開催数OK
    │ 2. MeetingSession作成 (status: scheduled, initiatorType: agent)
    │ 3. 参加者ノードにA2A招待送信（即時）
    │ 4. Dashboard通知: "CTO Agentが緊急会議を発起しました"（情報通知のみ）
    │ 5. 全参加者join → status: active
    ▼
Meeting Orchestrator
    │
    │ CTO(facilitator)がアジェンダを進行
    │ ... (通常の会議フローと同じ)
    │
    └── 会議終了 → Action Items配信 + Dashboard議事録表示
```

#### 4.5.3 管理者モニタリングと介入

Agent間会議は自律的に進行するが、人間管理者はいつでもDashboardから介入可能:

```
進行中のAgent会議
    │
    ├── Dashboard通知（情報のみ）
    │   "CTO Agent が 'Security Incident Response' を発起しました"
    │   [会議を見る]
    │
    ├── MeetingLivePage でリアルタイム監視
    │   ├── トランスクリプト閲覧
    │   ├── 参加者状況確認
    │   └── アジェンダ進行状況確認
    │
    └── 必要時のみ介入
        ├── [Send as Admin] — 管理者として発言を挿入
        ├── [Pause] — 会議を一時停止
        ├── [Skip Item] — アジェンダ項目をスキップ
        └── [End Meeting] — 会議を強制終了
```

#### 4.5.4 自動会議トリガー

特定のシステムイベントで会議を自動発起:

```typescript
interface AutoMeetingTrigger {
  id: string;
  name: string;
  event: string;                     // トリガーイベント
  meetingTemplate: Partial<MeetingSession>;
  enabled: boolean;
}

// 設定例
const autoTriggers: AutoMeetingTrigger[] = [
  {
    id: 'strategy-change-review',
    name: '戦略変更レビュー',
    event: 'strategy.deployed',           // 戦略がデプロイされた時
    meetingTemplate: {
      title: 'Strategy Change Review: ${event.revision}',
      type: 'review',
      initiatorType: 'agent',
      facilitator: 'ceo',
      participants: ['ceo', 'cto', 'cfo', 'hr_manager'],
      agenda: [
        { title: '変更内容の確認', presenter: 'ceo' },
        { title: '各部門への影響分析', presenter: 'cto' },
        { title: '実行計画の策定', presenter: 'ceo' }
      ]
    },
    enabled: true
  },
  {
    id: 'budget-overrun-alert',
    name: '予算超過アラート',
    event: 'task.expense.overrun',        // タスク経費が予算超過
    meetingTemplate: {
      title: 'Budget Overrun Review: ${event.taskCode}',
      type: 'decision',
      facilitator: 'cfo',
      participants: ['cfo', 'ceo', '${event.assignedRole}'],
    },
    enabled: true
  },
  {
    id: 'security-incident',
    name: 'セキュリティインシデント',
    event: 'security.critical',           // クリティカルなセキュリティイベント
    meetingTemplate: {
      title: 'Security Incident Response',
      type: 'decision',
      facilitator: 'cto',
      participants: ['cto', 'ceo', 'security_officer', 'devops'],
      priority: 'critical',
      maxDurationMinutes: 30
    },
    enabled: true
  }
];
```

### 4.6 会議フローの詳細

#### シナリオ1: Dashboard発起 — Q2予算計画会議

```
Human CEO (Dashboard)
    │
    │ POST /a2a/meetings
    │ { title: "Q2 Budget Planning", type: "decision",
    │   participants: ["ceo", "cfo", "cto", "marketing_head"],
    │   agenda: [
    │     { title: "Q1 実績レビュー", presenter: "cfo" },
    │     { title: "Q2 各部門予算案", presenter: "cfo" },
    │     { title: "技術投資優先度", presenter: "cto" },
    │     { title: "最終承認", presenter: "ceo" }
    │   ] }
    ▼
GRC A2A Gateway Hub
    │
    │ 1. MeetingSession作成 (status: scheduled)
    │ 2. 全参加者ノードにA2A通知:
    │    tasks/send { type: "meeting-invitation", sessionId: "..." }
    │ 3. 参加者からの応答待ち
    ▼
各WinClaw Node (CEO, CFO, CTO, Marketing Head)
    │
    │ Agent Card確認 → 会議参加可能
    │ POST /a2a/meetings/:sessionId/join
    │ GET  /a2a/meetings/:sessionId/stream  (SSE接続開始)
    ▼
Meeting Orchestrator (active)
    │
    ├── Agenda Item 1: "Q1 実績レビュー"
    │   ├── Facilitator(CEO) → CFOに発言要請
    │   ├── CFO: "Q1売上は目標比95%..." (SSEで全参加者に配信)
    │   ├── CTO: "技術投資のROIは..." (SSEで全参加者に配信)
    │   ├── CEO: "次のアジェンダへ" (議題ステータス: concluded)
    │   └── [transcript記録 + decision記録]
    │
    ├── Agenda Item 2: "Q2 各部門予算案"
    │   ├── CFO: "全社予算枠は$2M、部門配分案: ..."
    │   ├── Marketing: "マーケ予算を15%増を要望..."
    │   ├── CTO: "R&D予算据え置きでは新機能開発に支障..."
    │   ├── CFO: "trade-off分析: マーケ+10%, R&D+5%なら..."
    │   ├── CEO: "CFO案を採用。投票を"
    │   ├── [Voting: CEO=agree, CFO=agree, CTO=agree, Marketing=agree]
    │   └── Decision { type: "consensus", description: "Q2予算配分: ..." }
    │
    ├── ... (Agenda Item 3, 4)
    │
    └── Meeting Concluded
        ├── 議事録 (transcript) をDB永続化
        ├── 決定事項 (decisions) をDB永続化
        ├── Action Items → GRC A2A Relay経由で各ノードにタスク配信
        └── 会議サマリーをDashboardに表示
```

### 4.6 SSE ストリーミング設計

会議中のリアルタイムメッセージ配信にSSEを使用:

```
Client A (CEO)                GRC A2A Gateway                Client B (CFO)
    │                              │                              │
    ├── GET /meetings/001/stream ─►│◄── GET /meetings/001/stream ─┤
    │   (SSE connection)           │    (SSE connection)          │
    │                              │                              │
    ├── POST /meetings/001/message │                              │
    │   { content: "Q2の方針は？" } │                              │
    │                              │                              │
    │◄── SSE: data: {             │                              │
    │     speaker: "ceo",          │──── SSE: data: {            │
    │     content: "Q2の方針は？"   │      speaker: "ceo",        │
    │   }                          │      content: "Q2の方針は？" ├►│
    │                              │    }                         │
    │                              │                              │
    │                              │◄── POST /meetings/001/message│
    │                              │   { content: "予算案: ..." }  │
    │                              │                              │
    │◄── SSE: data: {             │                              │
    │     speaker: "cfo",          │──── SSE: data: {            │
    │     content: "予算案: ..."    │      speaker: "cfo",        │
    │   }                          │      content: "予算案: ..."  ├►│
```

### 4.7 発話順序制御（Turn Management）

マルチエージェント会議では発言の順序制御が重要:

```typescript
interface TurnPolicy {
  type: 'round-robin' | 'facilitator-directed' | 'free-form' | 'raise-hand';

  // round-robin: アジェンダのpresenter → 各参加者順番に
  // facilitator-directed: ファシリテーター（CEO）が次の発言者を指名
  // free-form: 自由発言（同時発言あり）
  // raise-hand: 挙手制（発言要求 → ファシリテーター承認）
}

// 推奨デフォルト: facilitator-directed
// - CEO (facilitator) がアジェンダ進行と発言者指名を制御
// - 各エージェントは指名されるまで待機
// - 質問・異議はraise-handで割り込み可能
```

### 4.8 WinClaw Agent Card設計

各WinClawノードが公開するAgent Card:

```json
{
  "name": "${role_display_name} Agent",
  "description": "${role_description}",
  "url": "https://grc-server.local:3100/a2a/rpc/${node_id}",
  "version": "1.0.0",
  "provider": {
    "organization": "WinClaw GRC",
    "url": "https://github.com/anthropics/winclaw"
  },
  "capabilities": {
    "streaming": true,
    "pushNotifications": true,
    "stateTransitionHistory": true,
    "meetings": true
  },
  "skills": [
    // ロールテンプレートから動的生成
    // CEO: strategic-planning, budget-approval, team-management, ...
    // CFO: financial-analysis, budget-planning, compliance, ...
    // CTO: tech-architecture, r&d-planning, security-review, ...
  ],
  "authentication": {
    "schemes": ["bearer"],
    "credentials": "${node_api_key}"
  },
  "defaultInputModes": ["text"],
  "defaultOutputModes": ["text"]
}
```

---

## 5. Dashboard UI設計

GRC Dashboardに以下の画面を追加する。既存のカスタムCSS + React パターンに準拠。

### 5.1 サイドバー追加項目

```
Sidebar Navigation:
├── ... (既存メニュー)
├── 🤖 A2A Agents          ← Phase 1 で追加
├── 📋 Meetings            ← Phase 2 で追加
│   ├── Active Meetings
│   ├── History
│   └── Auto Triggers
└── ... (既存メニュー)
```

### 5.2 会議一覧画面 — MeetingListPage

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Meetings                                            [+ New Meeting]   │
│  Manage and monitor multi-agent meetings                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │  Total   │ │  Active  │ │ Scheduled│ │Concluded │ │Cancelled │     │
│  │   12     │ │    2     │ │    3     │ │    6     │ │    1     │     │
│  │          │ │  ●green  │ │  ●blue   │ │  ●gray   │ │  ●red    │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                                         │
│  ┌─ Filters ─────────────────────────────────────────────────────┐     │
│  │ Status: [All ▼]   Type: [All ▼]   Initiator: [All ▼]         │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌─ Meeting Table ───────────────────────────────────────────────┐     │
│  │ Title              │Type     │Status   │Facilitator│Initiator │     │
│  │                    │         │         │           │  Type    │     │
│  ├────────────────────┼─────────┼─────────┼───────────┼──────────┤     │
│  │ Q2 Budget Planning │decision │●active  │ CEO       │ 👤human │     │
│  │ Security Incident  │decision │●active  │ CTO       │ 🤖agent │     │
│  │ Sprint Review      │review   │●sched.  │ Dev Lead  │ 🤖agent │     │
│  │ Marketing Strategy │discuss. │●concluded│ CEO      │ 👤human │     │
│  │ Tech Debt Review   │discuss. │●concluded│ CTO      │ 🤖agent │     │
│  └────────────────────┴─────────┴─────────┴───────────┴──────────┘     │
│                                                                         │
│  Actions per row: [View] [Join Live] [Intervene]                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**特記**: `Initiator Type` カラムで人間発起(👤)とAgent発起(🤖)を一目で区別。
Active状態の会議には [Join Live] で即座にリアルタイムビューに遷移、[Intervene] で管理者介入。

### 5.3 会議作成画面 — MeetingCreatePage

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Meetings                                                    │
│  Create New Meeting                                                    │
│  Set up a multi-agent discussion session                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ Basic Information ───────────────────────────────────────────┐     │
│  │                                                               │     │
│  │  Meeting Title *                                              │     │
│  │  ┌─────────────────────────────────────────────────────────┐  │     │
│  │  │ Q2 Budget Planning Meeting                              │  │     │
│  │  └─────────────────────────────────────────────────────────┘  │     │
│  │                                                               │     │
│  │  ┌─ Type ──────────────┐  ┌─ Turn Policy ──────────────┐    │     │
│  │  │ [Decision       ▼]  │  │ [Facilitator-Directed  ▼]  │    │     │
│  │  └─────────────────────┘  └─────────────────────────────┘    │     │
│  │                                                               │     │
│  │  ┌─ Max Duration ──────┐  ┌─ Priority ─────────────────┐    │     │
│  │  │ [60 minutes     ▼]  │  │ [Normal               ▼]  │    │     │
│  │  └─────────────────────┘  └─────────────────────────────┘    │     │
│  │                                                               │     │
│  │  Shared Context (optional)                                    │     │
│  │  ┌─────────────────────────────────────────────────────────┐  │     │
│  │  │ Background information shared with all participants...  │  │     │
│  │  │                                                         │  │     │
│  │  └─────────────────────────────────────────────────────────┘  │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌─ Participants ────────────────────────────────────────────────┐     │
│  │                                                               │     │
│  │  Facilitator *                                                │     │
│  │  ┌─────────────────────────────────────────────────────────┐  │     │
│  │  │ 🤖 CEO Agent (node-001) ● Online                       │  │     │
│  │  └─────────────────────────────────────────────────────────┘  │     │
│  │                                                               │     │
│  │  Invite Participants *         (select from online agents)    │     │
│  │  ┌─────────────────────────────────────────────────────────┐  │     │
│  │  │ ☑ 🤖 CFO Agent (node-002) ● Online                     │  │     │
│  │  │ ☑ 🤖 CTO Agent (node-003) ● Online                     │  │     │
│  │  │ ☐ 🤖 Dev Lead (node-004)  ● Online                     │  │     │
│  │  │ ☐ 🤖 Marketing Head (node-005) ○ Offline               │  │     │
│  │  │ ☐ 🤖 HR Manager (node-006) ● Online                    │  │     │
│  │  └─────────────────────────────────────────────────────────┘  │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌─ Agenda ──────────────────────────────────────────────────────┐     │
│  │                                                     [+ Add]   │     │
│  │  1. ┌──────────────────────────────────────┐ Presenter: ┌──┐ │     │
│  │     │ Q1 Performance Review               │            │CFO│ │     │
│  │     └──────────────────────────────────────┘ Duration:  │15m│ │     │
│  │                                                         └──┘ │     │
│  │  2. ┌──────────────────────────────────────┐ Presenter: ┌──┐ │     │
│  │     │ Q2 Department Budget Proposals       │            │CFO│ │     │
│  │     └──────────────────────────────────────┘ Duration:  │20m│ │     │
│  │                                                         └──┘ │     │
│  │  3. ┌──────────────────────────────────────┐ Presenter: ┌──┐ │     │
│  │     │ Technology Investment Priorities      │            │CTO│ │     │
│  │     └──────────────────────────────────────┘ Duration:  │15m│ │     │
│  │                                                         └──┘ │     │
│  │  4. ┌──────────────────────────────────────┐ Presenter: ┌──┐ │     │
│  │     │ Final Approval                       │            │CEO│ │     │
│  │     └──────────────────────────────────────┘ Duration:  │10m│ │     │
│  │                                                         └──┘ │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│                                        [Cancel]  [Schedule]  [Start Now]│
└─────────────────────────────────────────────────────────────────────────┘
```

**操作フロー**:
- **Schedule**: 指定時刻に自動開始（参加者に招待通知）
- **Start Now**: 即座に会議開始（参加者に即時招待 → join待ち）
- 参加者リストはAgent Card Registryの `status` (online/offline/busy) をリアルタイム表示

### 5.4 会議ライブビュー — MeetingLivePage

管理者がリアルタイムで会議を監視・介入する画面:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    Q2 Budget Planning Meeting              ●LIVE  [End Meeting]│
│  Decision · Facilitator: CEO · Duration: 23:45 / 60:00                 │
├───────────────────────────────────────────┬─────────────────────────────┤
│                                           │                             │
│  ┌─ Live Transcript ───────────────────┐  │  ┌─ Participants ────────┐ │
│  │                                     │  │  │                        │ │
│  │  [14:01] 🤖 CEO (facilitator)       │  │  │ 🤖 CEO     ● Speaking │ │
│  │  "Let's begin with Q1 review.       │  │  │ 🤖 CFO     ● Joined  │ │
│  │   CFO, please present the numbers." │  │  │ 🤖 CTO     ● Joined  │ │
│  │                                     │  │  │ 🤖 Dev Lead ○ Invited │ │
│  │  [14:02] 🤖 CFO                     │  │  │                        │ │
│  │  "Q1 revenue reached 95% of target. │  │  └────────────────────────┘ │
│  │   Key highlights: ..."              │  │                             │
│  │                                     │  │  ┌─ Agenda Progress ─────┐ │
│  │  [14:05] 🤖 CTO                     │  │  │                        │ │
│  │  "From a technology perspective,    │  │  │ ✅ 1. Q1 Review        │ │
│  │   our R&D investment ROI was ..."   │  │  │ ▶  2. Q2 Budgets      │ │
│  │                                     │  │  │ ○  3. Tech Investment  │ │
│  │  [14:08] 🤖 CEO                     │  │  │ ○  4. Final Approval   │ │
│  │  "Good. Moving to the next item."   │  │  │                        │ │
│  │                                     │  │  └────────────────────────┘ │
│  │  [14:08] 📋 SYSTEM                  │  │                             │
│  │  "Agenda item 1 concluded.          │  │  ┌─ Decisions ───────────┐ │
│  │   Moving to: Q2 Budget Proposals"   │  │  │                        │ │
│  │                                     │  │  │ #1 Q1 Review           │ │
│  │  [14:09] 🤖 CFO                     │  │  │ consensus: Approved    │ │
│  │  "Total budget: $2M. Proposed       │  │  │ 3/3 agreed             │ │
│  │   allocation: Marketing 35% ..."    │  │  │                        │ │
│  │                                     │  │  │ (more as meeting       │ │
│  │  │                                  │  │  │  progresses...)        │ │
│  │  ▼ (auto-scroll)                    │  │  │                        │ │
│  └─────────────────────────────────────┘  │  └────────────────────────┘ │
│                                           │                             │
│  ┌─ Admin Intervention ────────────────┐  │  ┌─ Action Items ────────┐ │
│  │ ┌─────────────────────────────┐     │  │  │                        │ │
│  │ │ Type a message as admin...  │     │  │  │ (populated when        │ │
│  │ └─────────────────────────────┘     │  │  │  meeting concludes)    │ │
│  │ [Send as Admin]  [Pause] [Skip Item]│  │  │                        │ │
│  └─────────────────────────────────────┘  │  └────────────────────────┘ │
└───────────────────────────────────────────┴─────────────────────────────┘
```

**管理者介入機能**:
- **Send as Admin**: 人間管理者がリアルタイムで発言（type: `system`としてトランスクリプトに記録）
- **Pause**: 会議を一時停止（全参加者に通知）
- **Skip Item**: 現在のアジェンダを飛ばして次へ
- **End Meeting**: 会議を強制終了

### 5.5 会議詳細/議事録画面 — MeetingDetailPage

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back to Meetings                                                    │
│  Q2 Budget Planning Meeting                         Status: Concluded  │
│  Decision · 2026-03-08 14:00 - 14:52 (52 min)                         │
│  Initiated by: 👤 Human (Dashboard)                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Summary]  [Transcript]  [Decisions]  [Action Items]                  │
│                                                                         │
│  ┌─ AI Summary ──────────────────────────────────────────────────┐     │
│  │                                                               │     │
│  │  The Q2 Budget Planning Meeting concluded with consensus on   │     │
│  │  all agenda items. Key outcomes:                              │     │
│  │                                                               │     │
│  │  • Q1 revenue reached 95% of target, approved by all         │     │
│  │  • Q2 budget allocated: Marketing 35%, R&D 30%, Ops 20%,     │     │
│  │    HR 15% — total $2M                                        │     │
│  │  • R&D budget increased by 5% per CTO request                │     │
│  │  • 4 action items assigned across 3 departments              │     │
│  │                                                               │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌─ Participants ────────────────────────────────────────────────┐     │
│  │ 🤖 CEO (facilitator) · Joined 14:00 · 12 statements          │     │
│  │ 🤖 CFO               · Joined 14:00 · 18 statements          │     │
│  │ 🤖 CTO               · Joined 14:01 · 8 statements           │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌─ Decisions (3) ───────────────────────────────────────────────┐     │
│  │                                                               │     │
│  │  #1  Q1 Performance Approved              consensus (3/3)     │     │
│  │  #2  Q2 Budget Allocation: $2M            consensus (3/3)     │     │
│  │  #3  R&D +5% Increase                     majority  (2/3)     │     │
│  │                                                               │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  ┌─ Action Items (4) ────────────────────────────────────────────┐     │
│  │                                                               │     │
│  │  ☐ CFO: Prepare detailed Q2 budget breakdown      Due: 3/15  │     │
│  │  ☐ CTO: Submit R&D investment proposal            Due: 3/12  │     │
│  │  ☐ Marketing: Launch Q2 campaign brief            Due: 3/20  │     │
│  │  ☐ CEO: Final budget sign-off                     Due: 3/22  │     │
│  │                                                               │     │
│  │  [→ Create Tasks in Task Board]                               │     │
│  └───────────────────────────────────────────────────────────────┘     │
│                                                                         │
│                                              [Export PDF] [Re-open]     │
└─────────────────────────────────────────────────────────────────────────┘
```

**特記**:
- **[→ Create Tasks in Task Board]**: Action ItemsをワンクリックでGRC Task Boardにタスクとして登録
- **[Export PDF]**: 議事録をPDFエクスポート
- **[Re-open]**: 会議を再開（追加討議が必要な場合）
- **Initiated by** 表示で発起者がHumanかAgentか明示

### 5.6 自動トリガー管理画面 — AutoTriggersPage

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Meeting Auto Triggers                               [+ New Trigger]   │
│  Configure automatic meeting initiation rules                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ Trigger Table ───────────────────────────────────────────────┐     │
│  │ Name                  │Event              │Facilitator│Enabled│     │
│  ├───────────────────────┼───────────────────┼───────────┼───────┤     │
│  │ Strategy Change Review│strategy.deployed  │ CEO       │ ✅ On │     │
│  │ Budget Overrun Alert  │task.expense.overrun│ CFO      │ ✅ On │     │
│  │ Security Incident     │security.critical  │ CTO       │ ✅ On │     │
│  │ Weekly Standup        │cron: 0 9 * * 1    │ CEO       │ ❌ Off│     │
│  └───────────────────────┴───────────────────┴───────────┴───────┘     │
│                                                                         │
│  Actions: [Edit] [Toggle] [Delete]                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.7 Agent発起通知バナー

Agentが会議を発起すると、Dashboard上部に情報通知バナーを表示（承認不要、情報提供のみ）:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔔 New Meeting: CTO Agent started "Security Incident Response"        │
│    Reason: "CVE-2026-XXXX detected in production dependency"           │
│    Participants: CEO, CTO, Security Officer, DevOps                    │
│                                          [View Live]  [Dismiss]        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. DBスキーマ拡張

### 5.1 新規テーブル

```sql
-- 会議セッション
CREATE TABLE meeting_sessions (
  id          CHAR(36)     PRIMARY KEY,
  title       VARCHAR(500) NOT NULL,
  type        ENUM('discussion','review','brainstorm','decision') NOT NULL DEFAULT 'discussion',
  status      ENUM('scheduled','active','paused','concluded','cancelled') NOT NULL DEFAULT 'scheduled',

  initiator_type  ENUM('human','agent') NOT NULL DEFAULT 'human',
  initiation_reason TEXT,                -- Agent発起時の理由

  facilitator_node_id  CHAR(36) NOT NULL,
  context_id           CHAR(36) NOT NULL,  -- A2A contextId
  shared_context       TEXT,               -- 参加者共有コンテキスト
  turn_policy          VARCHAR(50) NOT NULL DEFAULT 'facilitator-directed',
  max_duration_minutes INT NOT NULL DEFAULT 60,

  agenda      JSON,           -- AgendaItem[]
  decisions   JSON,           -- Decision[]  (会議終了時に確定)
  action_items JSON,          -- ActionItem[] (会議終了時に確定)
  summary     TEXT,           -- AI生成会議サマリー

  scheduled_at DATETIME,
  started_at   DATETIME,
  ended_at     DATETIME,
  created_by   VARCHAR(255) NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (facilitator_node_id) REFERENCES nodes(id),
  INDEX idx_status (status),
  INDEX idx_scheduled (scheduled_at)
);

-- 会議参加者
CREATE TABLE meeting_participants (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id  CHAR(36) NOT NULL,
  node_id     CHAR(36) NOT NULL,
  role_id     VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  status      ENUM('invited','joined','speaking','left') NOT NULL DEFAULT 'invited',

  invited_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  joined_at   DATETIME,
  left_at     DATETIME,

  FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES nodes(id),
  UNIQUE KEY uk_session_node (session_id, node_id)
);

-- 会議トランスクリプト（発言ログ）
CREATE TABLE meeting_transcript (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id   CHAR(36) NOT NULL,
  speaker_node_id CHAR(36) NOT NULL,
  speaker_role VARCHAR(100) NOT NULL,

  content      TEXT NOT NULL,
  type         ENUM('statement','question','answer','proposal','objection','agreement','system') NOT NULL DEFAULT 'statement',
  reply_to_id  BIGINT,         -- 返答先

  agenda_item_index INT,       -- 現在のアジェンダ項目
  metadata     JSON,           -- 追加メタデータ

  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (session_id) REFERENCES meeting_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (speaker_node_id) REFERENCES nodes(id),
  INDEX idx_session_time (session_id, created_at)
);

-- Agent Card Registry
CREATE TABLE agent_cards (
  node_id      CHAR(36) PRIMARY KEY,
  agent_card   JSON NOT NULL,       -- 完全なAgent Card JSON
  skills       JSON,                -- スキル一覧（検索用）
  capabilities JSON,                -- 能力フラグ
  last_seen_at DATETIME,            -- 最終通信時刻
  status       ENUM('online','offline','busy') NOT NULL DEFAULT 'offline',

  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- 会議自動トリガー
CREATE TABLE meeting_auto_triggers (
  id          CHAR(36)     PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  event       VARCHAR(255) NOT NULL,      -- 'strategy.deployed', 'security.critical', 'cron:0 9 * * 1'
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,

  facilitator_role VARCHAR(100) NOT NULL,  -- ファシリテーターのroleId
  meeting_template JSON NOT NULL,          -- MeetingSession テンプレート (JSON)

  last_triggered_at DATETIME,
  trigger_count     INT NOT NULL DEFAULT 0,

  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_event (event),
  INDEX idx_enabled (enabled)
);
```

---

## 7. 実装フェーズ

### Phase 1: A2A Gateway Foundation（2週間）

**目標**: GRC ServerにA2Aプロトコル基盤を追加

| タスク | 詳細 |
|--------|------|
| Agent Card Registry | DB永続化 + CRUD API |
| JSON-RPC Router | `tasks/send`, `tasks/get` の基本実装 |
| SSE基盤 | EventEmitter + SSEエンドポイント |
| Task Store | DB永続化（既存relay_queueスキーマ拡張） |
| WinClaw A2A Client | 基本クライアントライブラリ |
| Dashboard画面 | エージェント一覧・状態モニタリング |

**成果物**:
- 2ノード間のA2Aメッセージ送受信が動作
- Agent Card登録・発見が動作
- SSEストリーミングの基本動作確認

### Phase 2: Meeting System（2週間）

**目標**: マルチエージェント会議機能の実装

| タスク | 詳細 |
|--------|------|
| Meeting Orchestrator | セッション管理、アジェンダ進行 |
| Turn Management | facilitator-directed + raise-hand |
| SSE Multiplexer | 複数参加者への同時配信 |
| Transcript Recording | 発言ログのDB永続化 |
| Decision Tracking | 決定事項・投票の記録 |
| Dashboard画面 | 会議作成・モニタリング・議事録閲覧 |

**成果物**:
- 3+ ノードでの会議セッションが動作
- アジェンダに沿った議論進行
- 議事録の自動記録

### Phase 3: Integration & Intelligence（1週間）

**目標**: 既存システムとの統合、AIアシスト機能

| タスク | 詳細 |
|--------|------|
| Relay統合 | Action Items → 既存A2A Relay経由でタスク自動配信 |
| Strategy統合 | 戦略変更時に自動会議招集 |
| AI会議サマリー | 議事録からの自動サマリー生成 |
| コンセンサス判定 | 全員合意/多数決/エスカレーション自動判定 |
| Agent Card自動生成 | Role Templateからの動的Agent Card構築 |

**成果物**:
- 戦略変更→会議招集→討議→決定→タスク配信の完全自動フロー
- AI生成議事録サマリー

---

## 8. ファイル変更一覧

### GRC Server（`C:\work\grc\src`）

| ファイル | 変更 | Phase |
|---------|------|-------|
| `migrations/008_a2a_gateway.sql` | **新規** — agent_cards テーブル | 1 |
| `migrations/009_meetings.sql` | **新規** — meeting_* 3テーブル | 2 |
| `src/modules/a2a-gateway/schema.ts` | **新規** — Drizzleスキーマ | 1 |
| `src/modules/a2a-gateway/agent-card.ts` | **新規** — Agent Card管理 | 1 |
| `src/modules/a2a-gateway/task-store.ts` | **新規** — A2A Task永続化 | 1 |
| `src/modules/a2a-gateway/jsonrpc-router.ts` | **新規** — JSON-RPCルーティング | 1 |
| `src/modules/a2a-gateway/sse-manager.ts` | **新規** — SSEストリーム管理 | 1 |
| `src/modules/a2a-gateway/routes.ts` | **新規** — Agent向けAPI | 1 |
| `src/modules/a2a-gateway/admin-routes.ts` | **新規** — Admin API | 1 |
| `src/modules/meetings/schema.ts` | **新規** — Drizzleスキーマ | 2 |
| `src/modules/meetings/orchestrator.ts` | **新規** — 会議進行エンジン | 2 |
| `src/modules/meetings/turn-manager.ts` | **新規** — 発話順序制御 | 2 |
| `src/modules/meetings/transcript.ts` | **新規** — 議事録管理 | 2 |
| `src/modules/meetings/routes.ts` | **新規** — Agent向けAPI | 2 |
| `src/modules/meetings/admin-routes.ts` | **新規** — Admin API | 2 |
| `src/module-loader.ts` | **修正** — 2モジュール登録 | 1 |

### GRC Dashboard（`C:\work\grc\dashboard\src`）

| ファイル | 変更 | Phase |
|---------|------|-------|
| `src/pages/a2a-agents/AgentListPage.tsx` | **新規** — エージェント一覧 | 1 |
| `src/pages/a2a-agents/AgentDetailPage.tsx` | **新規** — Agent Card詳細 | 1 |
| `src/pages/meetings/MeetingListPage.tsx` | **新規** — 会議一覧 | 2 |
| `src/pages/meetings/MeetingDetailPage.tsx` | **新規** — 会議詳細・議事録 | 2 |
| `src/pages/meetings/MeetingCreatePage.tsx` | **新規** — 会議作成 | 2 |
| `src/pages/meetings/MeetingLivePage.tsx` | **新規** — 会議リアルタイムビュー | 2 |
| `src/pages/meetings/AutoTriggersPage.tsx` | **新規** — 自動トリガー管理 | 3 |
| `src/components/MeetingNotificationBanner.tsx` | **新規** — Agent発起通知バナー | 2 |
| `src/App.tsx` | **修正** — ルート追加 | 1 |
| `src/components/Sidebar.tsx` | **修正** — ナビ追加 | 1 |
| `src/api/hooks.ts` | **修正** — useAgentCards, useMeetings系フック | 1-2 |

### WinClaw Client

| ファイル | 変更 | Phase |
|---------|------|-------|
| `src/a2a/client.ts` | **新規** — A2Aクライアント | 1 |
| `src/a2a/agent-card.ts` | **新規** — Agent Card生成 | 1 |
| `src/a2a/meeting-client.ts` | **新規** — 会議参加クライアント | 2 |
| `src/sync/index.ts` | **修正** — sync時にAgent Card更新 | 1 |

---

## 9. openclaw-a2a-gateway からの教訓と差別化

### 8.1 参考にするパターン

| パターン | openclaw実装 | WinClaw適用 |
|---------|-------------|-------------|
| Plugin Architecture | OpenClaw Plugin APIでA2Aを外付け | GRC Moduleとして統合（module-loader） |
| Agent Card動的生成 | スキル情報からCard構築 | Role Templateから自動生成 |
| Executor Pattern | 受信→ローカルCLIへルーティング | 受信→WinClaw Agent Loopへルーティング |
| Dual Protocol | HTTP + gRPC | HTTP + SSE（gRPCは将来検討） |

### 8.2 差別化ポイント

| 領域 | openclaw-a2a-gateway | WinClaw A2A Meeting System |
|------|---------------------|---------------------------|
| Task永続化 | InMemory（再起動で消失） | MySQL永続化（既存Relay統合） |
| ストリーミング | 未実装 | SSEフル実装 |
| 会議機能 | なし | Meeting Orchestrator完備 |
| 発話制御 | なし | Turn Manager（4ポリシー） |
| 議事録 | なし | DB永続化 + AIサマリー |
| ピア発見 | 手動設定 | Agent Card Registry自動 |
| 認証 | Bearer Token | GRC既存認証統合 |
| スケーラビリティ | 単一プロセス | Hub型 + DB永続化 |

---

## 10. セキュリティ考慮事項

| 項目 | 対策 |
|------|------|
| 認証 | GRC既存JWT認証を継続利用。A2Aリクエストにはnode API keyを使用 |
| 認可 | ノードは自身のロールに許可された会議のみ参加可能 |
| メッセージ暗号化 | TLS必須。会議内容のE2E暗号化は将来検討 |
| レート制限 | ノード毎の発言レート制限（DoS防止） |
| 監査ログ | 全会議トランスクリプトをDB永続化 |
| セッションハイジャック | セッション固有トークン + 参加者リスト検証 |

---

## 11. 将来拡張

### 10.1 gRPCサポート（Phase 4）

HTTPに加えてgRPCも対応し、低レイテンシ通信を実現:
- `proto/meeting.proto` 定義
- Bidirectional Streamingで会議通信
- WinClaw Client にgRPC clientも追加

### 10.2 P2Pフォールバック（Phase 5）

GRC Server障害時のP2Pフォールバック:
- WebRTC DataChannel利用
- Agent Card に direct_url フィールド追加
- Hub到達不能時にP2P接続にフォールバック

### 10.3 外部A2Aエージェント接続

Google A2A準拠の外部エージェント（非WinClaw）との相互運用:
- 標準Agent Card発見プロトコル
- 外部エージェント用のゲストアクセストークン
- capability negotation

### 10.4 ボイス/マルチモーダル会議

音声・画像を含むマルチモーダル会議:
- A2A Protocol のPart型（TextPart, FilePart, DataPart）を活用
- TTS/STT統合（会議内容の音声再生）

---

## 12. 結論

**推奨アプローチ**: ハイブリッドA2A Meeting Systemの段階的実装

1. **Phase 1（2週間）**: A2A Gateway基盤 — Agent Card Registry + JSON-RPC + SSE
2. **Phase 2（2週間）**: Meeting System — Orchestrator + Turn Management + Transcript
3. **Phase 3（1週間）**: 統合 — Relay連携 + Strategy連携 + AIサマリー

**合計見積**: 約5週間

**リスク**:
- A2Aプロトコル自体がまだv0.3.0で発展途上。仕様変更への追従が必要
- Hub型の単一障害点問題 → Phase 5のP2Pフォールバックで軽減
- 大規模会議（10+ノード）でのSSEスケーラビリティ → Redis Pub/Sub導入で対応可能

**最大のメリット**: Google A2A標準準拠により、将来的にWinClaw以外のA2A準拠エージェントとの相互運用が可能になる。これはエコシステム拡張の基盤となる。
