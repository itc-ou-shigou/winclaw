# 新規ロール作成スキル（Role Creator Skill）設計提案

**作成日**: 2026-03-09
**ステータス**: レビュー待ち
**関連**: GRC_Role_Templates_All_8_Roles.md, GRC_Config_Distribution_Detail.md

---

## 1. 概要

### 1.1 目的
**会社の業務概要 + 岗位の自然言語説明** を入力するだけで、GRCデータベースに新規ロールテンプレートを自動生成するWinClawスキル。

### 1.2 ユーザーストーリー
```
ユーザー（CEO）: 「うちの会社はEC事業をやっていて、新しくカスタマーサクセス担当の
                  AIロールが欲しい。顧客の利用状況を監視して、チャーン予測と
                  プロアクティブなサポートを行うロールを作って。」

WinClaw:         → GRC API を呼び出し、以下を自動生成:
                    - ロールID: customer-success
                    - 8つのMDファイル（AGENTS.md, SOUL.md, IDENTITY.md, ...）
                    - 適切なdepartment, industryタグ
```

---

## 2. 既存システム分析

### 2.1 GRC ロールテンプレート構造

**roleTemplatesTable** (`grc/src/modules/roles/schema.ts`):
```
id:          VARCHAR(50)  — "ceo", "marketing", "customer-success" 等
name:        VARCHAR(200) — "CEO", "マーケティング部長" 等
emoji:       VARCHAR(10)  — "🎯", "📊" 等
description: TEXT         — ロール概要
department:  VARCHAR(100) — "executive", "marketing", "engineering" 等
industry:    VARCHAR(100) — "general", "ec", "saas" 等
mode:        ENUM         — "autonomous" | "copilot"
isBuiltin:   TINYINT      — 0 (カスタム) | 1 (組み込み)

# 8つのMDファイル（ロール行動定義）:
agentsMd:     MEDIUMTEXT — エージェント設定・指示
soulMd:       MEDIUMTEXT — 性格・価値観
identityMd:   MEDIUMTEXT — ロールアイデンティティ
userMd:       MEDIUMTEXT — ユーザー向け情報（戦略変数受信先）
toolsMd:      MEDIUMTEXT — 利用可能ツール定義
heartbeatMd:  MEDIUMTEXT — 定期実行ロジック
bootstrapMd:  MEDIUMTEXT — 初期起動時の指示
tasksMd:      MEDIUMTEXT — タスク処理の行動定義
```

### 2.2 既存ロール例（8ロール定義済み）

| ロールID | 名前 | Department |
|---------|------|------------|
| ceo | CEO | executive |
| cto | CTO | engineering |
| cfo | CFO | finance |
| marketing | Marketing Director | marketing |
| sales | Sales Director | sales |
| hr | HR Director | hr |
| legal | Legal Counsel | legal |
| support | Customer Support Lead | support |

### 2.3 既存API

- `POST /api/v1/admin/roles` — ロールテンプレート作成
- `PUT /api/v1/admin/roles/:id` — 更新
- `POST /api/v1/admin/roles/:id/clone` — クローン
- `POST /api/v1/admin/nodes/:nodeId/assign-role` — ノードへ割当

### 2.4 変数テンプレートシステム

MDファイル内で `${variable_name}` パターンで変数参照:
- 割当変数: `${employee_name}`, `${company_name}`, `${department}` 等
- 戦略変数: `${company_mission}`, `${company_vision}`, `${department_budget}` 等

---

## 3. スキル設計

### 3.1 スキル基本情報

```yaml
Skill ID:   role-creator
Name:       新規ロール作成
Type:       WinClaw Skill (SKILL.md ベース)
Location:   C:\work\winclaw\skills\role-creator\
Trigger:    ユーザーが自然言語でロール作成を依頼
```

### 3.2 入力インターフェース

#### ダッシュボードUI（GRC Dashboard）

新規ページ: `/roles/create-wizard`

```
┌─────────────────────────────────────────────────┐
│  新規ロール作成ウィザード                          │
├─────────────────────────────────────────────────┤
│                                                   │
│  会社情報（任意 - 戦略から自動取得可）               │
│  ┌───────────────────────────────────────────┐   │
│  │ EC事業、年商5億、社員30名、B2Cメイン...     │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ロール説明（必須）                                │
│  ┌───────────────────────────────────────────┐   │
│  │ カスタマーサクセス担当。顧客の利用状況を     │   │
│  │ 監視して、チャーン予測とプロアクティブな     │   │
│  │ サポートを行う。LTVの最大化が目標。         │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  動作モード:  ◉ 自律型  ○ コパイロット             │
│                                                   │
│  [AIで生成]                                       │
│                                                   │
├─────────────────────────────────────────────────┤
│  プレビュー（AI生成後表示）                        │
│                                                   │
│  ロールID: customer-success                       │
│  名前: カスタマーサクセスマネージャー 🤝            │
│  部門: customer-success                           │
│  業種: ec                                         │
│                                                   │
│  [AGENTS.md] [SOUL.md] [IDENTITY.md] [USER.md]   │
│  [TOOLS.md] [HEARTBEAT.md] [BOOTSTRAP.md]         │
│  [TASKS.md]                                       │
│  ┌───────────────────────────────────────────┐   │
│  │ # AGENTS.md プレビュー                      │   │
│  │ あなたはカスタマーサクセスマネージャー...    │   │
│  │ ## 主要KPI                                  │   │
│  │ - チャーンレート < 5%                       │   │
│  │ - NPS > 50                                  │   │
│  │ ...                                         │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  [編集して保存]  [そのまま保存]                     │
└─────────────────────────────────────────────────┘
```

### 3.3 処理フロー

```
ユーザー入力
    │
    ▼
[1] 会社情報を補完
    - 戦略テーブルから company_mission, company_vision 取得
    - 既存ロール一覧を取得（重複チェック）
    │
    ▼
[2] LLM呼び出し（Claude API）
    - システムプロンプト + 会社情報 + ロール説明 → 8つのMDファイル生成
    - 既存ロール例を few-shot として参照
    │
    ▼
[3] プレビュー表示
    - 生成された8ファイルをUI上で確認
    - ユーザーが各ファイルを個別に編集可能
    │
    ▼
[4] 確認後保存
    - POST /api/v1/admin/roles でGRCに登録
    - ロールテンプレートがDBに保存
    │
    ▼
[5] オプション: ノードに割当
    - 既存ノードへの割当を提案
    - POST /api/v1/admin/nodes/:nodeId/assign-role
```

### 3.4 LLMプロンプト設計

```markdown
# System Prompt

あなたはWinClawのロールテンプレート生成エキスパートです。
以下の会社情報とロール説明に基づき、AIエージェントのロール定義を
8つのMDファイルとして生成してください。

## 出力フォーマット
JSON形式で以下の8フィールドを出力:
{
  "id": "kebab-case-id",
  "name": "ロール表示名",
  "emoji": "適切な絵文字1つ",
  "description": "1-2行の概要",
  "department": "部門名",
  "industry": "業種",
  "agentsMd": "...",
  "soulMd": "...",
  "identityMd": "...",
  "userMd": "...",
  "toolsMd": "...",
  "heartbeatMd": "...",
  "bootstrapMd": "...",
  "tasksMd": "..."
}

## 各MDファイルの役割
- AGENTS.md: エージェントの主要指示、行動ルール、KPI
- SOUL.md: 性格、価値観、コミュニケーションスタイル
- IDENTITY.md: ロールの正式名称、責任範囲、権限
- USER.md: ${company_mission} 等の戦略変数プレースホルダを含むテンプレート
- TOOLS.md: 利用するツール・API定義
- HEARTBEAT.md: 定期実行すべきタスク（日次/週次チェック等）
- BOOTSTRAP.md: 初回起動時の初期化手順
- TASKS.md: タスク受信時の処理フロー・完了判定基準

## 変数プレースホルダ
USER.md では以下の変数を使用可能:
${company_mission}, ${company_vision}, ${company_values},
${department_budget}, ${department_kpis}, ${current_quarter_goals},
${strategy_revision}, ${employee_name}, ${company_name}

## 既存ロール参考（概要のみ）
[ここに既存ロールのAGENTS.mdの冒頭部分を挿入]
```

### 3.5 GRC API拡張

**新規エンドポイント（推奨）:**

```typescript
// POST /api/v1/admin/roles/generate-preview
// LLMを使ったロール生成（プレビュー用、DB保存しない）
{
  company_info?: string,      // 会社情報（任意）
  role_description: string,   // ロール自然言語説明（必須）
  mode: 'autonomous' | 'copilot'
}
→ Response: ロールテンプレートJSON（8MDファイル含む）
```

このAPIはGRCサーバー側でLLM呼び出しを行うか、フロントエンドで直接LLM APIを呼び出すかの2択：

**選択肢A: GRCサーバー側LLM呼び出し** (推奨)
- メリット: APIキー管理がサーバー側で完結、既存ロール情報の参照が容易
- デメリット: GRCサーバーにLLMクライアント追加が必要

**選択肢B: フロントエンドLLM呼び出し**
- メリット: GRCサーバー変更不要
- デメリット: APIキーをフロントに露出するか、プロキシが必要

---

## 4. WinClawスキルとしての実装

### 4.1 スキルディレクトリ構成

```
skills/role-creator/
  SKILL.md          — スキル定義・ドキュメント
  prompts/
    system.md       — LLMシステムプロンプト
    examples/       — few-shot例（既存ロールのサンプル）
```

### 4.2 SKILL.md概要

```markdown
---
name: Role Creator
description: 自然言語からAIロールテンプレートを自動生成
version: 1.0.0
---

# Role Creator Skill

## Overview
会社の業務紹介と岗位の自然言語説明から、
GRCロールテンプレート（8MDファイル）を自動生成する。

## Actions
1. generate — ロール生成（プレビュー）
2. save — 生成結果をGRCに保存
3. assign — ノードへの割当

## Required Config
- GRC API endpoint (grc_url)
- LLM API key (model_key_id or direct key)
```

---

## 5. 実装計画

### Phase 1: バックエンド
1. GRCに `/api/v1/admin/roles/generate-preview` エンドポイント追加
2. LLMプロンプトテンプレート作成
3. 既存ロールからfew-shotサンプル抽出

### Phase 2: フロントエンド
1. `/roles/create-wizard` ページ作成
2. 入力フォーム（会社情報 + ロール説明）
3. プレビュー表示（8タブ切替 + MDエディタ）
4. 保存/割当フロー

### Phase 3: WinClawスキル
1. `skills/role-creator/SKILL.md` 作成
2. プロンプトテンプレート作成

---

## 6. 工数見積もり

| 項目 | 工数 |
|------|------|
| LLMプロンプト設計・チューニング | 2h |
| GRC API追加（generate-preview） | 1.5h |
| Dashboard ウィザードUI | 3-4h |
| WinClawスキル定義 | 1h |
| テスト・調整 | 1.5h |
| **合計** | **9-10h** |
