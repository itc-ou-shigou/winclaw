# GRC → Company Strategy Management 详细设计

**作成日**: 2026-03-07
**関連**: GRC_AI_Employee_Office_Console_Plan.md, GRC_Config_Distribution_Detail.md, GRC_Role_Templates_All_8_Roles.md, GRC_TaskBoard_Design_Detail.md
**目的**: GRC Dashboard に「会社経営戦略管理画面」を追加し、経営目標・方針・予算計画の入力→全AI社員への自動伝達→タスク再計画のカスケードフローを実現する

---

## 背景と課題

現状のGRC AI Employee Office Console は、ロールテンプレートに `${annual_revenue_target}` 等の変数を含むが、以下の課題がある：

1. **初期化条件の入力画面がない** — 経営目標・予算計画を入力するGRC画面が存在しない
2. **変更伝達の仕組みがない** — テンプレート変数はロール割当時に1回設定されるのみ。経営方針変更時の再配信メカニズムがない
3. **カスケード再計画ができない** — 戦略変更がCEO AI→各部門AIへの業務計画再調整を自動トリガーできない

**本設計の目的**: 上記3課題を解決し、Human CEO → GRC Dashboard → 全AI社員への戦略カスケードフローを実現する。

**設計原則**: 既存のconfig distribution機構（`config_revision` + pull model）を最大限再利用。新しいブートストラップファイルは追加せず、戦略データをUSER.mdテンプレート変数として注入。

---

## アーキテクチャ概要

```
Human CEO (Dashboard /strategy)
    │ Save & Deploy strategy changes
    ▼
GRC Server (Strategy Module)
    │ 1. company_strategy テーブル更新 (revision++)
    │ 2. company_strategy_history にスナップショット保存
    │ 3. 全ノードのUSER.md再レンダリング（戦略変数注入）
    │ 4. 全ノードの config_revision++
    │ 5. CEO ノードに「Strategic Realignment」タスク自動作成
    ▼
次回Sync時（既存Pull Model）
    ├── CEO Node: USER.md更新 + タスク受信 → 部門別KPI再配分
    ├── Strategy Node: USER.md更新 → OKR再調整
    └── 各部門 Node: USER.md更新（部門予算・KPI更新）
```

---

## 1. DBスキーマ

### 1.1 company_strategy テーブル（単一行 = 現在の有効戦略）

```sql
CREATE TABLE company_strategy (
  id CHAR(36) PRIMARY KEY,

  -- Company Profile
  company_mission TEXT DEFAULT NULL,                -- ミッション
  company_vision TEXT DEFAULT NULL,                 -- ビジョン
  company_values TEXT DEFAULT NULL,                 -- 企業価値観

  -- Short-term Objectives (四半期目標)
  short_term_objectives JSON DEFAULT NULL,
  -- Structure:
  -- [
  --   {
  --     "quarter": "Q1-2026",
  --     "goals": ["Launch new product line", "Expand to APAC"],
  --     "kpis": [
  --       { "name": "New customers", "target": 500, "unit": "count", "owner": "sales" },
  --       { "name": "Revenue", "target": 2500000, "unit": "USD", "owner": "sales" }
  --     ]
  --   }
  -- ]

  -- Mid-term Objectives (年度目標)
  mid_term_objectives JSON DEFAULT NULL,
  -- Structure:
  -- {
  --   "fiscal_year": "FY2026",
  --   "revenue_target": 10000000,
  --   "revenue_currency": "USD",
  --   "goals": ["Achieve market leadership in segment X", "IPO preparation"],
  --   "kpis": [
  --     { "name": "Annual Revenue", "target": 10000000, "unit": "USD" },
  --     { "name": "Customer Retention", "target": 95, "unit": "%" }
  --   ]
  -- }

  -- Long-term Objectives (3-5年ビジョン)
  long_term_objectives JSON DEFAULT NULL,
  -- Structure:
  -- {
  --   "horizon": "3-5 years",
  --   "vision_statement": "Become the global leader in...",
  --   "milestones": [
  --     { "year": 2027, "description": "Series B funding" },
  --     { "year": 2028, "description": "IPO" }
  --   ]
  -- }

  -- Department Budgets (部門別予算配分)
  department_budgets JSON DEFAULT NULL,
  -- Structure:
  -- {
  --   "fiscal_year": "FY2026",
  --   "currency": "USD",
  --   "departments": {
  --     "marketing":        { "annual": 500000, "q1": 150000, "q2": 125000, "q3": 125000, "q4": 100000 },
  --     "sales":            { "annual": 800000, "q1": 200000, "q2": 200000, "q3": 200000, "q4": 200000 },
  --     "engineering":      { "annual": 1200000, "q1": 300000, "q2": 300000, "q3": 300000, "q4": 300000 },
  --     "hr":               { "annual": 200000, "q1": 50000, "q2": 50000, "q3": 50000, "q4": 50000 },
  --     "finance":          { "annual": 150000, "q1": 37500, "q2": 37500, "q3": 37500, "q4": 37500 },
  --     "customer-support": { "annual": 300000, "q1": 75000, "q2": 75000, "q3": 75000, "q4": 75000 },
  --     "product-manager":  { "annual": 100000, "q1": 25000, "q2": 25000, "q3": 25000, "q4": 25000 }
  --   }
  -- }

  -- Department KPIs (部門別KPI目標)
  department_kpis JSON DEFAULT NULL,
  -- Structure:
  -- {
  --   "marketing": [
  --     { "name": "MQL Generated", "target": 1000, "unit": "count", "period": "quarterly" },
  --     { "name": "CAC", "target": 50, "unit": "USD", "period": "monthly" }
  --   ],
  --   "sales": [
  --     { "name": "Revenue", "target": 2500000, "unit": "USD", "period": "quarterly" },
  --     { "name": "Close Rate", "target": 25, "unit": "%", "period": "monthly" }
  --   ],
  --   ...
  -- }

  -- Strategic Priorities (優先順位付きリスト)
  strategic_priorities JSON DEFAULT NULL,
  -- Structure:
  -- [
  --   { "rank": 1, "title": "Product-Market Fit", "description": "..." },
  --   { "rank": 2, "title": "Team Expansion", "description": "..." },
  --   { "rank": 3, "title": "International Expansion", "description": "..." }
  -- ]

  -- Revision & Metadata
  revision INT DEFAULT 1,                          -- 楽観的ロック + 変更追跡
  updated_by VARCHAR(255) DEFAULT NULL,            -- 最後に更新したAdmin
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**設計ポイント**:
- **単一行設計**: company_strategyテーブルは常に1行のみ。初回アクセス時に自動INSERT（upsert）。
- **JSON列**: 四半期目標・予算・KPI等は構造化JSONで保存。将来のスキーマ変更に柔軟。
- **revision**: 変更のたびにインクリメント。Config Distribution のconfig_revisionと連動。

### 1.2 company_strategy_history テーブル（append-only監査ログ）

```sql
CREATE TABLE company_strategy_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  strategy_id CHAR(36) NOT NULL,
  revision INT NOT NULL,
  snapshot JSON NOT NULL,                           -- 全フィールドのスナップショット
  changed_by VARCHAR(255) NOT NULL,
  change_summary TEXT DEFAULT NULL,                 -- Admin入力の変更理由
  changed_fields JSON DEFAULT NULL,                 -- 変更されたフィールド名リスト
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_strategy_history_rev (strategy_id, revision),
  INDEX idx_strategy_history_date (created_at)
);
```

### 1.3 マイグレーション

```sql
-- migrations/007_company_strategy.sql

-- Company Strategy (single active row)
CREATE TABLE company_strategy (
  id CHAR(36) PRIMARY KEY,
  company_mission TEXT DEFAULT NULL,
  company_vision TEXT DEFAULT NULL,
  company_values TEXT DEFAULT NULL,
  short_term_objectives JSON DEFAULT NULL,
  mid_term_objectives JSON DEFAULT NULL,
  long_term_objectives JSON DEFAULT NULL,
  department_budgets JSON DEFAULT NULL,
  department_kpis JSON DEFAULT NULL,
  strategic_priorities JSON DEFAULT NULL,
  revision INT DEFAULT 1,
  updated_by VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Strategy History (append-only audit log)
CREATE TABLE company_strategy_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  strategy_id CHAR(36) NOT NULL,
  revision INT NOT NULL,
  snapshot JSON NOT NULL,
  changed_by VARCHAR(255) NOT NULL,
  change_summary TEXT DEFAULT NULL,
  changed_fields JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_strategy_history_rev (strategy_id, revision),
  INDEX idx_strategy_history_date (created_at)
);
```

---

## 2. APIエンドポイント

### 2.1 Admin Routes（Human CEO / GRC Admin）

```
GET    /api/v1/admin/strategy                 # 現在の戦略取得
PUT    /api/v1/admin/strategy                 # 戦略更新（Save Draft — カスケードなし）
POST   /api/v1/admin/strategy/deploy          # Save & Deploy to All Agents（カスケードトリガー）
GET    /api/v1/admin/strategy/history         # リビジョン履歴一覧
GET    /api/v1/admin/strategy/history/:rev    # 特定リビジョンのスナップショット
GET    /api/v1/admin/strategy/diff/:r1/:r2    # 2リビジョン間の差分比較
GET    /api/v1/admin/strategy/budgets         # 部門別予算サマリー
PUT    /api/v1/admin/strategy/budgets/:dept   # 個別部門予算更新
GET    /api/v1/admin/strategy/kpis            # 部門別KPIサマリー
PUT    /api/v1/admin/strategy/kpis/:dept      # 個別部門KPI更新
```

### 2.2 Agent-Facing Routes

```
GET    /a2a/strategy/summary                  # ノードロール向け戦略サマリー（全ロール共通）
GET    /a2a/strategy/department/:dept          # 部門別予算+KPI（各部門ロール向け）
```

### 2.3 主要APIの詳細

#### PUT /api/v1/admin/strategy（Save Draft）

ドラフト保存。`revision`はインクリメントするが、カスケードトリガーしない。

```typescript
// Request
{
  "company_mission": "To revolutionize enterprise AI...",
  "company_vision": "Global leader in AI-powered workforce...",
  "company_values": "Innovation, Trust, Speed, Integrity",
  "short_term_objectives": [...],
  "mid_term_objectives": {...},
  "revision": 3   // 楽観的ロック — 現在のrevisionと一致しなければ409
}

// Response: 200 OK
{
  "ok": true,
  "revision": 4,
  "deployed": false
}

// Error: 409 Conflict (revision mismatch)
{
  "error": "Version conflict",
  "current_revision": 5,
  "your_revision": 3
}
```

#### POST /api/v1/admin/strategy/deploy（Save & Deploy）

保存 + 全ノードへのカスケード配信をトリガー。

```typescript
// Request
{
  "change_summary": "Updated Q2 targets based on Q1 results"  // 監査ログ用
}

// Response: 200 OK
{
  "ok": true,
  "revision": 5,
  "deployed": true,
  "affected_nodes": 8,                // 影響を受けたノード数
  "auto_task_created": "CEO-STR-5"    // CEOに自動作成されたタスクID
}
```

#### GET /api/v1/admin/strategy/diff/:r1/:r2

2つのリビジョン間の差分を構造化して返す。

```typescript
// Response
{
  "from_revision": 3,
  "to_revision": 5,
  "changes": [
    {
      "field": "company_mission",
      "from": "To innovate...",
      "to": "To revolutionize..."
    },
    {
      "field": "department_budgets.marketing.q2",
      "from": 125000,
      "to": 175000
    },
    {
      "field": "strategic_priorities",
      "from": [...],
      "to": [...]
    }
  ]
}
```

---

## 3. GRC Dashboard画面 `/strategy`

### 3.1 画面構成（6タブ）

```
┌──────────────────────────────────────────────────────────────────┐
│ 🏢 Company Strategy Management                    Rev.5 (Draft) │
│                                                                  │
│ ┌──────────┬────────────┬──────────┬──────────┬────────┬──────┐ │
│ │ Company  │ Short-term │ Mid-term │Long-term │Budgets │ KPIs │ │
│ │ Profile  │ (Quarterly)│ (Annual) │(3-5 Yr)  │        │      │ │
│ └──────────┴────────────┴──────────┴──────────┴────────┴──────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  [Active Tab Content Area]                                 │  │
│  │                                                            │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [Save Draft]  [Save & Deploy to All Agents]  [📜 History]      │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 各タブの内容

#### Tab 1: Company Profile
- **Mission** — テキストエリア（Markdown対応）
- **Vision** — テキストエリア
- **Core Values** — テキストエリア（カンマ区切りまたは箇条書き）

#### Tab 2: Short-term（四半期目標）

```
┌─────────────────────────────────────────────────────┐
│ Quarter: [Q1-2026 ▼]                                │
│                                                     │
│ Goals:                                              │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 1. Launch new product line           [✕]       │ │
│ │ 2. Expand to APAC market             [✕]       │ │
│ │ [+ Add Goal]                                    │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ KPIs:                                               │
│ ┌─────────┬─────────┬──────┬──────────┐            │
│ │ KPI     │ Target  │ Unit │ Owner    │            │
│ ├─────────┼─────────┼──────┼──────────┤            │
│ │ New Cust│ 500     │count │ sales    │            │
│ │ Revenue │ 2.5M    │ USD  │ sales    │            │
│ │ MQLs    │ 1000    │count │ marketing│            │
│ │ [+ Add] │         │      │          │            │
│ └─────────┴─────────┴──────┴──────────┘            │
└─────────────────────────────────────────────────────┘
```

#### Tab 3: Mid-term（年度目標）
- Fiscal Year 選択
- Annual Revenue Target（金額 + 通貨）
- Annual Goals リスト
- Annual KPIs テーブル

#### Tab 4: Long-term（3-5年ビジョン）
- Horizon 選択（3年/5年/10年）
- Vision Statement テキストエリア
- Milestones タイムライン（年 + マイルストーン説明）

#### Tab 5: Budgets（部門別予算配分）

```
┌──────────────────────────────────────────────────────────┐
│ Fiscal Year: FY2026    Currency: [USD ▼]                 │
│                                                          │
│ ┌──────────────┬─────────┬────────┬────────┬────────┬────────┐
│ │ Department   │ Annual  │   Q1   │   Q2   │   Q3   │   Q4   │
│ ├──────────────┼─────────┼────────┼────────┼────────┼────────┤
│ │ Marketing    │ $500K   │ $150K  │ $125K  │ $125K  │ $100K  │
│ │ Sales        │ $800K   │ $200K  │ $200K  │ $200K  │ $200K  │
│ │ Engineering  │ $1.2M   │ $300K  │ $300K  │ $300K  │ $300K  │
│ │ HR           │ $200K   │ $50K   │ $50K   │ $50K   │ $50K   │
│ │ Finance      │ $150K   │ $37.5K │ $37.5K │ $37.5K │ $37.5K │
│ │ Support      │ $300K   │ $75K   │ $75K   │ $75K   │ $75K   │
│ │ Product      │ $100K   │ $25K   │ $25K   │ $25K   │ $25K   │
│ ├──────────────┼─────────┼────────┼────────┼────────┼────────┤
│ │ TOTAL        │ $3.25M  │ $837K  │ $812K  │ $812K  │ $787K  │
│ └──────────────┴─────────┴────────┴────────┴────────┴────────┘
└──────────────────────────────────────────────────────────┘
```

#### Tab 6: KPIs（部門別KPI目標）

```
┌──────────────────────────────────────────────────────────┐
│ Department: [All ▼]                                      │
│                                                          │
│ 📊 Marketing                                            │
│ ┌──────────────┬────────┬──────┬──────────┐             │
│ │ KPI          │ Target │ Unit │ Period   │             │
│ ├──────────────┼────────┼──────┼──────────┤             │
│ │ MQL Generated│ 1000   │count │quarterly │             │
│ │ CAC          │ $50    │ USD  │ monthly  │             │
│ │ Brand Aware. │ 25%    │ %    │quarterly │             │
│ └──────────────┴────────┴──────┴──────────┘             │
│                                                          │
│ 🤝 Sales                                                │
│ ┌──────────────┬────────┬──────┬──────────┐             │
│ │ KPI          │ Target │ Unit │ Period   │             │
│ ├──────────────┼────────┼──────┼──────────┤             │
│ │ Revenue      │ $2.5M  │ USD  │quarterly │             │
│ │ Close Rate   │ 25%    │ %    │ monthly  │             │
│ │ Pipeline Val.│ $5M    │ USD  │quarterly │             │
│ └──────────────┴────────┴──────┴──────────┘             │
│ ...                                                      │
└──────────────────────────────────────────────────────────┘
```

### 3.3 History パネル

「📜 History」ボタンで展開されるサイドパネル：

```
┌─────────────────────────────────┐
│ Strategy History                │
│                                 │
│ Rev.5 — 2026-03-07 14:30       │
│   By: admin@example.com        │
│   "Updated Q2 targets"         │
│   Changed: budgets, kpis       │
│   [View] [Compare with Rev.4]  │
│                                 │
│ Rev.4 — 2026-03-05 10:00       │
│   By: ceo@example.com          │
│   "Added long-term milestones" │
│   Changed: long_term_objectives│
│   [View] [Compare with Rev.3]  │
│                                 │
│ Rev.3 — 2026-03-01 09:00       │
│   By: admin@example.com        │
│   "Initial strategy setup"     │
│   Changed: all fields           │
│   [View]                        │
│                                 │
└─────────────────────────────────┘
```

### 3.4 Diff ビュー

リビジョン間の差分をビジュアル表示：

```
┌──────────────────────────────────────────────────────┐
│ Compare: Rev.4 → Rev.5                               │
│                                                      │
│ 🔴 company_mission                                   │
│   - "To innovate enterprise workflows"               │
│   + "To revolutionize enterprise AI operations"      │
│                                                      │
│ 🔵 department_budgets.marketing.q2                   │
│   - $125,000                                         │
│   + $175,000                                         │
│                                                      │
│ 🟢 strategic_priorities[2] (added)                   │
│   + { rank: 3, title: "International Expansion" }    │
│                                                      │
│ [Close]                                              │
└──────────────────────────────────────────────────────┘
```

---

## 4. 戦略テンプレート変数

### 4.1 新規テンプレート変数一覧

USER.mdに注入される新規テンプレート変数（`resolveTemplateVariables()` 第2パスで解決）：

| 変数 | 内容 | 注入先ロール | ソース |
|------|------|-------------|--------|
| `${company_mission}` | ミッション | 全ロール | `company_strategy.company_mission` |
| `${company_vision}` | ビジョン | 全ロール | `company_strategy.company_vision` |
| `${company_values}` | 企業価値観 | 全ロール | `company_strategy.company_values` (**既存変数を上書き**) |
| `${company_strategy_summary}` | 戦略全体サマリー（自動生成） | CEO, 戦略企画 | 全フィールドの要約テキスト |
| `${current_quarter_goals}` | 今四半期の目標（Markdown） | 全ロール | `short_term_objectives` の現在四半期分 |
| `${annual_targets}` | 年度目標（Markdown） | CEO, 戦略企画, 財務 | `mid_term_objectives` |
| `${long_term_vision}` | 長期ビジョン（Markdown） | CEO, 戦略企画 | `long_term_objectives` |
| `${department_budget}` | 自部門の予算（Markdown） | 各部門ロール | `department_budgets.departments[role_id]` |
| `${department_kpis}` | 自部門のKPI（Markdown） | 各部門ロール | `department_kpis[role_id]` |
| `${strategic_priorities}` | 優先順位リスト（Markdown） | CEO, 戦略企画 | `strategic_priorities` |
| `${strategy_revision}` | 戦略バージョン番号 | 全ロール | `company_strategy.revision` |

### 4.2 変数の解決タイミング

```
ロール割当時（既存フロー）:
  resolveTemplateVariables(template, variables)
    │
    │ 第1パス（既存）: ロール割当時の静的変数を解決
    │   ${employee_id} → "EMP-MKT-001"
    │   ${company_name} → "Example Corp"
    │   ${human_name} → "John Smith"
    │   ...
    │
    │ 第2パス（新規）: company_strategy テーブルから戦略変数を解決
    │   ${company_mission} → "To revolutionize..."
    │   ${company_values} → "Innovation, Trust, Speed"
    │   ${department_budget} → "Annual: $500K | Q1: $150K | Q2: $125K..."
    │   ${department_kpis} → "MQL: 1000/quarter | CAC: $50/month..."
    │   ${strategy_revision} → "5"
    │   ...
    │
    ▼
  resolved USER.md (全変数解決済み)
```

### 4.3 部門ロール向け変数の自動マッピング

`${department_budget}` と `${department_kpis}` は、ノードに割り当てられたロールIDに基づいて自動的に対応する部門のデータを注入する：

```typescript
function buildStrategyVariables(
  strategy: CompanyStrategy,
  roleId: string
): Record<string, string> {
  const vars: Record<string, string> = {};

  // 全ロール共通変数
  vars.company_mission = strategy.company_mission ?? "";
  vars.company_vision = strategy.company_vision ?? "";
  vars.company_values = strategy.company_values ?? "";
  vars.strategy_revision = String(strategy.revision);
  vars.current_quarter_goals = formatQuarterGoals(
    strategy.short_term_objectives,
    getCurrentQuarter()
  );

  // CEO・戦略企画向けフル変数
  if (roleId === "ceo" || roleId === "strategic-planner") {
    vars.company_strategy_summary = buildStrategySummary(strategy);
    vars.annual_targets = formatAnnualTargets(strategy.mid_term_objectives);
    vars.long_term_vision = formatLongTermVision(strategy.long_term_objectives);
    vars.strategic_priorities = formatPriorities(strategy.strategic_priorities);
  }

  // 財務向け: 年度目標追加
  if (roleId === "finance") {
    vars.annual_targets = formatAnnualTargets(strategy.mid_term_objectives);
  }

  // 部門別変数（ロールIDで自動マッピング）
  const budgets = strategy.department_budgets?.departments;
  if (budgets && budgets[roleId]) {
    vars.department_budget = formatDepartmentBudget(budgets[roleId], roleId);
  }

  const kpis = strategy.department_kpis;
  if (kpis && kpis[roleId]) {
    vars.department_kpis = formatDepartmentKpis(kpis[roleId], roleId);
  }

  return vars;
}
```

---

## 5. Config Distribution統合

### 5.1 resolveTemplateVariables() 第2パス追加

既存の `resolveTemplateVariables()` 関数に戦略変数解決の第2パスを追加：

```typescript
// GRC Server: src/modules/roles/service.ts — 修正

async function assignRoleToNode(
  nodeId: string,
  roleId: string,
  variables: Record<string, string>,
  overrides?: Record<string, string>
): Promise<void> {
  const template = await db.select()
    .from(roleTemplatesTable)
    .where(eq(roleTemplatesTable.id, roleId))
    .first();

  // ★ 第2パス: 戦略変数を取得してマージ
  const strategy = await getActiveStrategy();
  const strategyVars = strategy
    ? buildStrategyVariables(strategy, roleId)
    : {};

  // 静的変数 + 戦略変数をマージ（戦略変数が優先）
  const allVariables = { ...variables, ...strategyVars };

  // 変数解決
  const resolvedFiles = resolveTemplateVariables(template, allVariables);

  // ... 以降は既存のDB更新ロジック ...
}
```

### 5.2 戦略変更時のカスケードフロー

```typescript
// GRC Server: src/modules/strategy/service.ts — 新規

async function deployStrategy(
  changedBy: string,
  changeSummary: string
): Promise<DeployResult> {
  const strategy = await getActiveStrategy();
  if (!strategy) throw new Error("No active strategy");

  // 1. company_strategy_history にスナップショット保存
  await db.insert(strategyHistoryTable).values({
    strategy_id: strategy.id,
    revision: strategy.revision,
    snapshot: JSON.stringify(strategy),
    changed_by: changedBy,
    change_summary: changeSummary,
    changed_fields: JSON.stringify(detectChangedFields(strategy)),
  });

  // 2. 全ロール割当済みノードのUSER.md再レンダリング
  const assignedNodes = await db.select()
    .from(nodesTable)
    .where(isNotNull(nodesTable.role_id));

  let affectedCount = 0;
  for (const node of assignedNodes) {
    // ノードのロール割当時変数を取得（stored in separate table or re-derive）
    const roleTemplate = await db.select()
      .from(roleTemplatesTable)
      .where(eq(roleTemplatesTable.id, node.role_id))
      .first();

    if (!roleTemplate) continue;

    // 戦略変数を再構築
    const strategyVars = buildStrategyVariables(strategy, node.role_id);

    // ロール割当時の静的変数を保持しつつ、戦略変数を上書き
    // NOTE: 静的変数は nodes テーブルの assignment_variables JSON列に保存されている想定
    const staticVars = JSON.parse(node.assignment_variables || "{}");
    const allVariables = { ...staticVars, ...strategyVars };

    // USER.md のみ再レンダリング（他の7ファイルは戦略変数を含まない）
    const resolvedUserMd = resolveTemplateVariables(
      { user_md: roleTemplate.user_md } as any,
      allVariables
    )["USER.md"];

    // 3. DB更新: resolved_user_md + config_revision++
    await db.update(nodesTable)
      .set({
        resolved_user_md: resolvedUserMd,
        config_revision: sql`config_revision + 1`,
      })
      .where(eq(nodesTable.node_id, node.node_id));

    affectedCount++;
  }

  // 4. CEO ノードに「Strategic Realignment」タスク自動作成
  const ceoNode = assignedNodes.find(n => n.role_id === "ceo");
  let autoTaskId: string | null = null;

  if (ceoNode) {
    autoTaskId = `CEO-STR-${strategy.revision}`;
    await db.insert(tasksTable).values({
      id: autoTaskId,
      title: `Strategic Realignment - Revision ${strategy.revision}`,
      description:
        `Company strategy has been updated (Revision ${strategy.revision}). ` +
        `Change summary: ${changeSummary}\n\n` +
        `Action required:\n` +
        `1. Review the updated strategy in your USER.md\n` +
        `2. Recalculate department-level KPIs based on new targets\n` +
        `3. Issue updated KPI directives to each department via A2A\n` +
        `4. Create follow-up tasks for departments that need plan adjustments`,
      category: "strategic",
      priority: "critical",
      status: "pending",
      assigned_node_id: ceoNode.node_id,
      assigned_role_id: "ceo",
      assigned_by: "grc-system",
      version: 1,
      tags: JSON.stringify(["strategy-update", `rev-${strategy.revision}`]),
    });
  }

  return {
    revision: strategy.revision,
    deployed: true,
    affected_nodes: affectedCount,
    auto_task_created: autoTaskId,
  };
}
```

### 5.3 カスケード再計画フロー（全体図）

```
Phase 1: Human CEO Updates Strategy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Human CEO → Dashboard /strategy
    │ Edits mission, budgets, KPIs, priorities
    │ Clicks "Save & Deploy to All Agents"
    ▼
  GRC Server: POST /api/v1/admin/strategy/deploy
    │ 1. company_strategy.revision++ (e.g., 4 → 5)
    │ 2. Snapshot saved to company_strategy_history
    │ 3. All assigned nodes: USER.md re-rendered with new strategy vars
    │ 4. All assigned nodes: config_revision++
    │ 5. CEO node: "Strategic Realignment" task auto-created
    ▼

Phase 2: CEO AI Receives & Processes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CEO Node (next sync)
    │ Detects config_revision change → pulls new USER.md
    │ Detects new task: "Strategic Realignment - Rev.5"
    ▼
  CEO AI reads updated USER.md
    │ New strategy context is now in system prompt:
    │   ${company_strategy_summary} — full strategy overview
    │   ${annual_targets} — updated revenue targets
    │   ${strategic_priorities} — new priority ranking
    ▼
  CEO AI executes Strategic Realignment task:
    │ 1. Analyzes new strategy vs. current department KPIs
    │ 2. Recalculates department-level targets
    │ 3. Creates tasks for each department head:
    │    - "MKT-KPI-5: Update Marketing KPIs for Rev.5"
    │    - "SALES-KPI-5: Update Sales targets for Rev.5"
    │    - "ENG-KPI-5: Realign Engineering priorities for Rev.5"
    │ 4. Sends A2A directives to each department agent
    ▼

Phase 3: Department AIs Adjust Plans
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Each Department Node (next sync)
    │ Receives updated USER.md (new ${department_budget}, ${department_kpis})
    │ Receives KPI Update task from CEO
    ▼
  Each Department AI:
    │ 1. Reviews new budget allocation and KPI targets
    │ 2. Adjusts operational plans to meet new objectives
    │ 3. Reports progress on KPI Update task
    │ 4. Marks task as completed when plan is adjusted
    ▼
  Company-wide strategy alignment achieved ✅
```

---

## 6. 自動作成タスクの構造

### 6.1 Strategic Realignment タスク（CEO向け）

戦略デプロイ時にCEOノードに自動作成されるタスク：

```json
{
  "id": "CEO-STR-{revision}",
  "title": "Strategic Realignment - Revision {revision}",
  "description": "Company strategy has been updated (Revision {revision}). Change summary: {change_summary}\n\nAction required:\n1. Review the updated strategy in your USER.md\n2. Recalculate department-level KPIs based on new targets\n3. Issue updated KPI directives to each department via A2A\n4. Create follow-up tasks for departments that need plan adjustments",
  "category": "strategic",
  "priority": "critical",
  "status": "pending",
  "assigned_node_id": "{ceo_node_id}",
  "assigned_role_id": "ceo",
  "assigned_by": "grc-system",
  "tags": ["strategy-update", "rev-{revision}"],
  "deliverables": [
    "Updated department KPI directives",
    "Follow-up tasks for each department"
  ]
}
```

### 6.2 タスクライフサイクル

```
Strategy Deploy
    ↓
CEO-STR-5: "Strategic Realignment" [pending]
    ↓ (CEO AI picks up on next sync)
CEO-STR-5: [in_progress]
    ↓ (CEO AI creates department tasks)
    ├── MKT-KPI-5: "Update Marketing KPIs" → Marketing AI
    ├── SALES-KPI-5: "Update Sales targets" → Sales AI
    ├── ENG-KPI-5: "Realign Engineering priorities" → Engineering AI
    ├── FIN-KPI-5: "Adjust Financial forecasts" → Finance AI
    ├── HR-KPI-5: "Update Hiring plan" → HR AI
    ├── CS-KPI-5: "Adjust Support SLAs" → Customer Support AI
    └── PM-KPI-5: "Update Product roadmap" → Product Manager AI
    ↓ (All department tasks completed)
CEO-STR-5: [completed]
```

---

## 7. nodes テーブル追加列

戦略変数の再レンダリング時に静的変数を保持するため、`nodes` テーブルに `assignment_variables` 列を追加：

```sql
-- migrations/007_company_strategy.sql に追加
ALTER TABLE nodes ADD COLUMN assignment_variables JSON DEFAULT NULL;
```

この列にはロール割当時に入力された静的変数（`employee_id`, `company_name` 等）をJSON形式で保存する。戦略変更時の再レンダリングで、この静的変数と新しい戦略変数をマージしてUSER.mdを再生成する。

---

## 8. セキュリティ考慮

### 8.1 認可

- `/api/v1/admin/strategy/*` — GRC Admin権限が必要
- `/a2a/strategy/*` — 認証済みノードのみアクセス可。自ノードのロールに応じたデータのみ返す

### 8.2 楽観的ロック

`PUT /api/v1/admin/strategy` は `revision` フィールドで楽観的ロックを実装。複数Adminが同時編集した場合、後発の更新はrevision不一致で409エラーとなる。

### 8.3 監査トレイル

全ての戦略変更は `company_strategy_history` に記録。変更者、変更内容、変更理由が追跡可能。

---

## 9. 変更ファイル一覧

### GRC Server (`C:\work\grc`)

| ファイル | 変更 | 説明 |
|---------|------|------|
| `migrations/007_company_strategy.sql` | **新規** | company_strategy + history テーブル + nodes.assignment_variables列 |
| `src/modules/strategy/schema.ts` | **新規** | Drizzle ORM スキーマ定義 |
| `src/modules/strategy/service.ts` | **新規** | CRUD + deployStrategy() + buildStrategyVariables() |
| `src/modules/strategy/routes.ts` | **新規** | Agent向けAPI (`/a2a/strategy/*`) |
| `src/modules/strategy/admin-routes.ts` | **新規** | Admin API (`/api/v1/admin/strategy/*`) |
| `src/module-loader.ts` | **修正** | strategy モジュール登録 |
| `src/config.ts` | **修正** | strategy モジュール有効化 |
| `src/modules/roles/service.ts` | **修正** | `resolveTemplateVariables()` 第2パス追加、`assignRoleToNode()` で静的変数保存 |

### GRC Dashboard (`C:\work\grc\dashboard`)

| ファイル | 変更 | 説明 |
|---------|------|------|
| `src/pages/strategy/Strategy.tsx` | **新規** | メイン画面（6タブ） |
| `src/pages/strategy/CompanyProfileTab.tsx` | **新規** | ミッション・ビジョン・価値観 |
| `src/pages/strategy/ShortTermTab.tsx` | **新規** | 四半期目標+KPI |
| `src/pages/strategy/MidTermTab.tsx` | **新規** | 年度目標 |
| `src/pages/strategy/LongTermTab.tsx` | **新規** | 長期ビジョン |
| `src/pages/strategy/BudgetsTab.tsx` | **新規** | 部門別予算グリッド |
| `src/pages/strategy/KpisTab.tsx` | **新規** | 部門別KPI目標 |
| `src/pages/strategy/StrategyHistory.tsx` | **新規** | リビジョン履歴パネル |
| `src/pages/strategy/StrategyDiff.tsx` | **新規** | リビジョン差分ビュー |
| `src/App.tsx` | **修正** | `/strategy` ルート追加 |
| `src/components/Sidebar.tsx` | **修正** | ナビゲーション「Strategy」追加 |
| `src/api/hooks.ts` | **修正** | `useStrategy`, `useStrategyHistory`, `useStrategyDeploy` フック追加 |

### WinClaw Client

**変更不要** — 戦略データはUSER.mdテンプレート変数として既存config distributionメカニズムで配信。クライアント側は `config_revision` 変更を検出して通常のpull → 書き込みフローで処理。

---

## Q&A

### Q1: 戦略を設定せずにロールを割り当てた場合はどうなる？

戦略未設定の場合、戦略変数（`${company_mission}` 等）は空文字列で解決される。USER.mdの該当セクションは空になるが、エラーにはならない。後から戦略を設定してDeployすれば、全ノードのUSER.mdが更新される。

### Q2: 特定の部門だけ予算/KPIを変更したい場合は？

`PUT /api/v1/admin/strategy/budgets/:dept` または `PUT /api/v1/admin/strategy/kpis/:dept` で個別部門の変更が可能。ただし、Deployは全ノード一括。部分デプロイは現時点ではサポートしない（設計簡素化のため）。

### Q3: company_strategyテーブルが空の場合の初期化は？

Dashboard `/strategy` に初回アクセスした際、`GET /api/v1/admin/strategy` がレコード未存在を検出した場合、デフォルト値（空のミッション・ビジョン等）で自動INSERT（upsert）する。Adminは初回アクセス時に空のフォームを見て、値を入力する。

### Q4: 戦略変更は即座に全ノードに反映される？

いいえ。戦略Deploy時に `config_revision` がインクリメントされるが、各ノードが新しいUSER.mdを受信するのは次回のsync時（デフォルト4時間間隔）。緊急の場合はGRC Adminが手動で各ノードにsyncトリガーを送信できる（既存の `POST /a2a/sync/now`）。

### Q5: `${company_values}` は既存の静的変数と衝突しない？

`${company_values}` は Role Templates の `GRC_Role_Templates_All_8_Roles.md` で既に使われている変数。戦略変数の第2パスで解決される値が、ロール割当時の静的変数（第1パス）を上書きする設計。つまり、戦略管理画面から入力した `company_values` が常に最新値として使われる。
