# 戦略作成・更新スキル（Strategy Manager Skill）設計提案

**作成日**: 2026-03-09
**ステータス**: レビュー待ち
**関連**: GRC_Strategy_Management_Design.md, GRC_Role_Templates_All_8_Roles.md

---

## 1. 概要

### 1.1 目的
**業界名や会社概要を入力するだけで、GRCの戦略テーブル（company_strategy）を自動生成・更新する** WinClawスキル。

### 1.2 ユーザーストーリー
```
ユーザー: 「うちはEC業界で、年商5億、主にアパレルのD2Cをやっている。
           今期は新規顧客獲得とリピート率向上に注力したい。」

WinClaw:  → LLMで戦略情報を生成 → GRC APIで戦略テーブルを更新:
            - ミッション / ビジョン / バリュー
            - 短期・中期・長期目標
            - 部門別予算配分案
            - 部門別KPI
            - 戦略的優先事項
          → オプション: deploy して全エージェントに配信
```

---

## 2. 既存システム分析

### 2.1 GRC 戦略テーブル

**companyStrategyTable** (`grc/src/modules/strategy/schema.ts`):
```
companyMission:       TEXT     — 企業ミッション
companyVision:        TEXT     — 企業ビジョン
companyValues:        TEXT     — 企業バリュー
shortTermObjectives:  JSON     — 短期目標（今期）
midTermObjectives:    JSON     — 中期目標（年次）
longTermObjectives:   JSON     — 長期目標（複数年）
departmentBudgets:    JSON     — 部門別予算
departmentKpis:       JSON     — 部門別KPI
strategicPriorities:  JSON     — 戦略的優先事項
revision:             INT      — リビジョン番号
updatedBy:            VARCHAR  — 更新者
```

**companyStrategyHistoryTable**: 全リビジョンのスナップショットを保持

### 2.2 既存API

- `GET /api/v1/admin/strategy` — 現在の戦略取得
- `PUT /api/v1/admin/strategy` — 戦略更新
- `POST /api/v1/admin/strategy/deploy` — 全エージェントに配信（カスケード）
- `GET /api/v1/admin/strategy/history` — 変更履歴
- `GET /api/v1/admin/strategy/diff/:r1/:r2` — リビジョン間差分
- `GET/PUT /api/v1/admin/strategy/budgets/:dept` — 部門別予算
- `GET/PUT /api/v1/admin/strategy/kpis/:dept` — 部門別KPI

### 2.3 戦略デプロイのカスケードフロー

```
PUT /strategy で更新
    │
    ▼
POST /strategy/deploy
    │
    ├─ 全ロール割当済みノードを取得
    │
    ├─ 各ノードの USER.md を戦略変数で再解決:
    │   ${company_mission}, ${department_budget}, ${department_kpis} 等
    │
    ├─ 各ノードの configRevision をインクリメント
    │
    └─ CEOタスク作成: "Strategic Realignment - Revision {rev}"
```

### 2.4 戦略変数 → ロール配信

`buildStrategyVariables()` で以下の変数を生成:
- **全ロール共通**: `company_mission`, `company_vision`, `company_values`, `strategic_priorities`, `strategy_revision`
- **CEO/Executive専用**: 全戦略詳細（目標、予算、KPI全部門）
- **部門ロール**: 自部門の budget, KPIs, current_quarter_goals のみ

---

## 3. スキル設計

### 3.1 スキル基本情報

```yaml
Skill ID:   strategy-manager
Name:       戦略作成・更新
Type:       WinClaw Skill (SKILL.md ベース)
Location:   C:\work\winclaw\skills\strategy-manager\
Trigger:    ユーザーが業界/会社情報を基に戦略生成・更新を依頼
```

### 3.2 2つの動作モード

#### モードA: 初期戦略生成（新規）
- 戦略テーブルが空 or リセットしたい場合
- 業界 + 会社概要 → 全フィールドを LLM で一括生成

#### モードB: 戦略更新（差分）
- 既存戦略に対して、特定分野の変更を指示
- 例: 「今期の目標を新規顧客獲得に変更」→ shortTermObjectives のみ更新

### 3.3 入力インターフェース

#### ダッシュボードUI（GRC Dashboard 戦略ページ拡張）

既存の `/strategy` ページに「AI生成」ボタンを追加:

```
┌─────────────────────────────────────────────────┐
│  戦略管理                    [AI生成] [デプロイ]   │
├─────────────────────────────────────────────────┤
│                                                   │
│  ◉ 新規生成  ○ 既存を更新                        │
│                                                   │
│  業界:                                            │
│  ┌───────────────────────────────────────────┐   │
│  │ EC / D2C / アパレル                        │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  会社概要:                                        │
│  ┌───────────────────────────────────────────┐   │
│  │ 年商5億、社員30名、B2Cメイン。             │   │
│  │ アパレルのD2Cブランドを3つ運営。            │   │
│  │ 主力チャネルはECサイトとInstagram。         │   │
│  │ 今期は新規顧客獲得とリピート率向上に注力。  │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  [AI で戦略を生成]                                │
│                                                   │
├─────────────────────────────────────────────────┤
│  生成プレビュー                                    │
│                                                   │
│  ミッション:                                      │
│  「ファッションを通じて、一人ひとりの個性を...」   │
│                                                   │
│  ビジョン:                                        │
│  「2027年までにD2Cアパレル業界で...」              │
│                                                   │
│  短期目標（今期）:                                 │
│  ├ 新規顧客獲得: 月間1000人 → 1500人              │
│  ├ リピート率: 25% → 35%                          │
│  └ LTV: ¥15,000 → ¥20,000                        │
│                                                   │
│  部門別予算配分:                                   │
│  ├ マーケティング: ¥80M (40%)                     │
│  ├ エンジニアリング: ¥40M (20%)                   │
│  ├ カスタマーサポート: ¥20M (10%)                 │
│  └ ...                                            │
│                                                   │
│  [編集して保存]  [そのまま保存]  [保存+デプロイ]   │
└─────────────────────────────────────────────────┘
```

### 3.4 処理フロー

```
ユーザー入力（業界 + 会社概要）
    │
    ▼
[1] 既存戦略・ロール情報取得
    - GET /api/v1/admin/strategy（既存戦略があれば参照）
    - GET /api/v1/admin/roles（既存ロール一覧 → 部門名を取得）
    │
    ▼
[2] LLM呼び出し（Claude API）
    - 入力: 業界 + 会社概要 + 既存ロール部門 + (既存戦略)
    - 出力: 戦略JSON（全フィールド）
    │
    ▼
[3] プレビュー表示
    - 各フィールドを分かりやすく表示
    - ユーザーが個別フィールドを編集可能
    │
    ▼
[4] 確認後保存
    - PUT /api/v1/admin/strategy でGRCに更新
    - 自動的にhistoryテーブルにスナップショット保存
    │
    ▼
[5] オプション: デプロイ
    - POST /api/v1/admin/strategy/deploy
    - 全エージェントの USER.md が戦略変数で更新される
    - CEO タスクが自動作成
```

### 3.5 LLMプロンプト設計

```markdown
# System Prompt

あなたは企業戦略コンサルタントAIです。
以下の業界・会社情報に基づき、企業戦略を JSON 形式で生成してください。

## 出力フォーマット
{
  "companyMission": "企業ミッション（1-2文）",
  "companyVision": "企業ビジョン（具体的な数値目標を含む）",
  "companyValues": "企業バリュー（3-5つの価値観）",
  "shortTermObjectives": [
    {"objective": "目標名", "target": "数値目標", "deadline": "期限"}
  ],
  "midTermObjectives": [
    {"objective": "...", "target": "...", "deadline": "..."}
  ],
  "longTermObjectives": [
    {"objective": "...", "target": "...", "deadline": "..."}
  ],
  "departmentBudgets": {
    "marketing": {"annual": 80000000, "currency": "JPY", "notes": "..."},
    "engineering": {"annual": 40000000, "currency": "JPY", "notes": "..."},
    ...
  },
  "departmentKpis": {
    "marketing": [
      {"name": "新規顧客獲得数", "target": "1500/月", "current": "1000/月"}
    ],
    ...
  },
  "strategicPriorities": [
    "最優先事項1", "最優先事項2", "最優先事項3"
  ]
}

## ルール
- 短期目標: 1-3ヶ月の達成可能な目標（3-5個）
- 中期目標: 年度内の成長目標（3-5個）
- 長期目標: 3-5年の方向性（2-3個）
- 予算: 既存の部門に対して配分（部門一覧は入力で提供）
- KPI: 各部門に2-4個のKPIを設定
- 数値は具体的に（曖昧な表現を避ける）
- 業界特性を反映した戦略にする
```

### 3.6 更新モード（差分更新）

既存戦略がある場合のプロンプト拡張:

```markdown
## 既存戦略（参考）
[現在の戦略JSONを挿入]

## ユーザー指示
「今期の目標を新規顧客獲得に変更したい」

## タスク
既存戦略をベースに、ユーザーの指示に従って必要なフィールドのみ更新してください。
変更したフィールドのみを含むJSONを返してください。
```

---

## 4. GRC API拡張

### 4.1 新規エンドポイント

```typescript
// POST /api/v1/admin/strategy/generate-preview
// LLMで戦略を生成（プレビュー用、DB保存しない）
Request:
{
  industry: string,          // 業界
  company_info: string,      // 会社概要（自然言語）
  mode: 'new' | 'update',   // 新規生成 or 差分更新
  update_instruction?: string // 更新時の指示（mode=update時）
}

Response:
{
  strategy: {
    companyMission: string,
    companyVision: string,
    companyValues: string,
    shortTermObjectives: Array,
    midTermObjectives: Array,
    longTermObjectives: Array,
    departmentBudgets: Object,
    departmentKpis: Object,
    strategicPriorities: Array
  },
  changedFields?: string[]  // mode=update時、変更されたフィールド一覧
}
```

### 4.2 既存APIはそのまま利用

保存は既存の `PUT /api/v1/admin/strategy`、デプロイは `POST /api/v1/admin/strategy/deploy` をそのまま使用。新規APIは **プレビュー生成のみ**。

---

## 5. WinClawスキルとしての実装

### 5.1 スキルディレクトリ構成

```
skills/strategy-manager/
  SKILL.md          — スキル定義・ドキュメント
  prompts/
    generate-new.md     — 新規戦略生成プロンプト
    update-partial.md   — 差分更新プロンプト
    examples/
      ec-strategy.json  — EC業界の戦略例
      saas-strategy.json — SaaS業界の戦略例
```

### 5.2 SKILL.md概要

```markdown
---
name: Strategy Manager
description: 業界/会社情報から企業戦略を自動生成・更新
version: 1.0.0
---

# Strategy Manager Skill

## Overview
業界名と会社概要の自然言語入力から、
GRCの戦略テーブルを自動生成・更新する。

## Actions
1. generate — 新規戦略生成（プレビュー）
2. update — 既存戦略の差分更新（プレビュー）
3. save — 戦略をGRCに保存
4. deploy — 保存済み戦略を全エージェントに配信

## Required Config
- GRC API endpoint (grc_url)
- LLM API key
```

---

## 6. 安全性・考慮事項

### 6.1 戦略変更の影響範囲
- 戦略更新 + デプロイ → **全エージェントの USER.md が書き換わる**
- 必ずプレビュー → ユーザー確認 → 保存の3ステップを踏む
- デプロイは明示的にユーザーが実行（自動デプロイしない）

### 6.2 履歴・ロールバック
- 全変更が `companyStrategyHistory` に自動保存される
- `GET /api/v1/admin/strategy/diff/:r1/:r2` で差分確認可能
- 古いリビジョンの内容で `PUT /api/v1/admin/strategy` すればロールバック可能

### 6.3 部門整合性
- LLM生成時に既存ロール一覧を参照し、**実在する部門のみ** に予算・KPIを設定
- 存在しない部門への予算配分は警告表示

---

## 7. 実装計画

### Phase 1: バックエンド
1. GRCに `/api/v1/admin/strategy/generate-preview` エンドポイント追加
2. LLMプロンプトテンプレート作成（new + update）
3. 業界別の例（EC, SaaS等）をfew-shotサンプルとして準備

### Phase 2: フロントエンド
1. 既存 `/strategy` ページに「AI生成」ボタン追加
2. 入力フォーム（業界 + 会社概要）
3. プレビュー表示（各フィールド展開表示）
4. 編集機能 + 保存/デプロイフロー

### Phase 3: WinClawスキル
1. `skills/strategy-manager/SKILL.md` 作成
2. プロンプトテンプレート作成

---

## 8. 工数見積もり

| 項目 | 工数 |
|------|------|
| LLMプロンプト設計・チューニング | 2h |
| GRC API追加（generate-preview） | 1.5h |
| Dashboard UI拡張（AI生成モーダル） | 2-3h |
| WinClawスキル定義 | 1h |
| テスト・調整 | 1.5h |
| **合計** | **8-9h** |

---

## 9. ロール作成スキルとの連携

戦略更新スキルとロール作成スキルは以下のワークフローで連携可能:

```
[1] 戦略生成 → 部門構成が決まる
        │
        ▼
[2] 不足ロールの特定
    「戦略に"カスタマーサクセス"KPIがあるが、
     対応ロールが存在しません。作成しますか？」
        │
        ▼
[3] ロール作成スキルを起動
    → 戦略から自動的に部門情報・KPIを引き継ぎ
        │
        ▼
[4] 戦略デプロイ
    → 新ロール含む全エージェントに配信
```

この連携は将来フェーズで実装可能。初期版では各スキル独立動作とする。
