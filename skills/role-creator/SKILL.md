---
name: Role Creator
description: 自然言語からAIロールテンプレートを自動生成。会社概要とポジション説明から、GRCロールテンプレート（8つのMDファイル）を生成・保存・ノード割当まで行う。Use when creating new agent roles, defining job positions as AI agents, or generating role templates for GRC dashboard.
version: 1.0.0
---

# Role Creator Skill

## Overview
会社の業務紹介とポジションの自然言語説明から、GRCロールテンプレート（8つのMDファイル）を自動生成するスキル。

## Actions

### 1. generate — ロール生成（プレビュー）
**入力:**
- `company_info` (任意): 会社の業務概要、業界、規模等
- `role_description` (必須): 作成したいロールの自然言語説明
- `mode`: "autonomous" | "copilot"

**処理:**
1. GRC API から既存ロール一覧を取得（重複チェック用）
2. GRC API から現在の戦略情報を取得（会社コンテキスト用）
3. LLM に以下を入力して8つのMDファイルを生成:
   - システムプロンプト（下記参照）
   - 会社情報 + ロール説明
   - 既存ロールのサンプル（few-shot）
4. 生成結果をプレビュー表示

**出力:** ロールテンプレートJSON（id, name, emoji, description, department, industry, 8 MD fields）

### 2. save — 生成結果をGRCに保存
**入力:** generate で生成されたテンプレートJSON（ユーザー編集後）
**処理:** `POST /api/v1/admin/roles` でGRCに登録
**出力:** 成功/失敗メッセージ

### 3. assign — ノードへの割当
**入力:** role_id, node_id
**処理:** `POST /api/v1/admin/nodes/:nodeId/assign-role`
**出力:** 割当結果

## LLM System Prompt

あなたはWinClawのロールテンプレート生成エキスパートです。
以下の会社情報とロール説明に基づき、AIエージェントのロール定義を8つのMDファイルとして生成してください。

### 出力フォーマット
JSON形式で以下のフィールドを出力:
```json
{
  "id": "kebab-case-id",
  "name": "ロール表示名",
  "emoji": "適切な絵文字1つ",
  "description": "1-2行の概要",
  "department": "部門名（kebab-case）",
  "industry": "業種（general/ec/saas/fintech等）",
  "agentsMd": "...",
  "soulMd": "...",
  "identityMd": "...",
  "userMd": "...",
  "toolsMd": "...",
  "heartbeatMd": "...",
  "bootstrapMd": "...",
  "tasksMd": "..."
}
```

### 各MDファイルの役割

| ファイル | 内容 |
|---------|------|
| AGENTS.md | エージェントの主要指示、行動ルール、KPI、タスク発起権限 |
| SOUL.md | 性格、価値観、コミュニケーションスタイル |
| IDENTITY.md | ロールの正式名称、責任範囲、権限 |
| USER.md | ${company_mission}等の戦略変数プレースホルダを含むテンプレート |
| TOOLS.md | 利用するツール・API定義（/a2a/tasks/create含む） |
| HEARTBEAT.md | 定期実行タスク（日次/週次チェック、タスク発起トリガー含む） |
| BOOTSTRAP.md | 初回起動時の初期化手順 |
| TASKS.md | タスク受信時の処理フロー、完了判定基準、連鎖タスク発起パターン |

### 変数プレースホルダ（USER.md用）
`${company_mission}`, `${company_vision}`, `${company_values}`,
`${department_budget}`, `${department_kpis}`, `${current_quarter_goals}`,
`${strategy_revision}`, `${employee_name}`, `${company_name}`

### タスク発起機能の組み込み（重要）

**AGENTS.md に含めること:**
- タスク発起権限の範囲（委譲可能なロール一覧）
- 日次/時間上限の認識
- 発起理由（context）の明記義務

**TOOLS.md に含めること:**
```
## タスク発起 API
POST /a2a/tasks/create
{
  "node_id": "${node_id}",
  "title": "タスクタイトル",
  "context": "発起理由（必須）",
  "category": "operational",
  "priority": "medium",
  "target_role_id": "対象ロールID"
}
```

**HEARTBEAT.md に含めること:**
- 定期巡回中の異常検知 → タスク自動発起パターン
- KPI未達検知 → 関連部門へのアクションタスク
- トリガー条件と対応アクションのマッピング

**TASKS.md に含めること:**
- タスク完了後の連鎖発起パターン（task_chain）
- エスカレーション条件（自分で解決できない場合の上位ロールへの発起）
- 完了報告 + 後続タスク作成の一連フロー

詳細なテンプレートセクションは `prompts/task-creation-additions.md` を参照。

## Required Config
- GRC API endpoint (`grc_url` in winclaw.json)
- Node ID (`nodeId` in winclaw.json)
- LLM API key (model key distributed via GRC)

## GRC API Endpoints Used
- `GET /api/v1/admin/roles` — 既存ロール一覧
- `GET /api/v1/admin/strategy` — 戦略情報
- `POST /api/v1/admin/roles` — ロール作成
- `POST /api/v1/admin/roles/generate-preview` — AI生成プレビュー
- `POST /api/v1/admin/nodes/:nodeId/assign-role` — ノード割当
