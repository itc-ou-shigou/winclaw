# AI社員チーム協働設計 — Workspace Context 自動配信方案

**バージョン**: 2.0
**作成日**: 2026-03-17
**ステータス**: 設計レビュー中

---

## 1. 設計思想

### 核心コンセプト

**「各AIエージェントのworkspaceにある AGENTS.md に会社Contextを埋め込み、GRCが自動配信・自動更新する」**

```
┌─────────────────────────────────────────────────┐
│  GRC (Single Source of Truth)                    │
│                                                  │
│  role_templates.agentsMd  ←  会社Context テンプレ │
│  ├── 組織図 (全社員一覧)                          │
│  ├── 各ロールの職責                              │
│  ├── 協働ルール (誰にいつ連絡)                    │
│  └── テンプレート変数 ${roster}, ${org_chart}     │
│                                                  │
│  resolveTemplateVariables() で変数を展開          │
│  ↓ SSE push / REST pull                         │
│                                                  │
├──────────────┬──────────────┬────────────────────┤
│ CEO Node     │ CFO Node     │ CTO Node     │ ... │
│ workspace/   │ workspace/   │ workspace/   │     │
│ AGENTS.md    │ AGENTS.md    │ AGENTS.md    │     │
│ (CEO向け     │ (CFO向け     │ (CTO向け     │     │
│  Context含む)│  Context含む)│  Context含む)│     │
└──────────────┴──────────────┴────────────────────┘
```

### なぜ Workspace MD ファイルが最適か

| アプローチ | 問題点 |
|---|---|
| APIツールで都度問い合わせ | ネットワーク障害時に使えない、毎回トークン消費 |
| System Promptに埋め込み | GRC経由で更新不可、ハードコード |
| **Workspace AGENTS.md** ✅ | GRC SSEで自動配信、オフライン耐性、既存メカニズム活用 |

---

## 2. 既存メカニズムの活用

### 配信パイプライン（既に実装済み）

```
GRC Admin がロール更新
  → configRevision++
  → SSE config_update イベント送信
  → WinClaw が REST で full config を pull
  → workspace/ に AGENTS.md 等を atomic write
  → エージェントが次の会話で最新 Context を読み込み
```

### 変数展開（既に実装済み）

`roles/service.ts` の `resolveTemplateVariables()` がテンプレート変数を展開：

```
${employee_id}    → 0784756
${employee_name}  → 橋本 透
${role_id}        → ceo
${company_name}   → ITC Cloud Soft
```

**本方案で追加する変数:**

```
${company_roster}   → 全社員一覧（名前・役職・状態）
${org_chart}        → 組織図（レポートライン）
${my_team}          → 自分の直属メンバー一覧
${collaboration_rules} → 協働ルール（誰にいつ連絡するか）
```

---

## 3. 実装設計

### 3.1 新しいテンプレート変数生成（GRC側）

**ファイル**: `C:\work\grc\src\modules\roles\context-generator.ts` (新規)

```typescript
/**
 * 会社Contextをテンプレート変数として動的生成する。
 * role_templates の agentsMd 内で ${company_roster} 等として参照される。
 */
export class CompanyContextGenerator {

  /**
   * ${company_roster} — 全AI社員一覧
   *
   * 出力例:
   * | 社員名 | 役職 | 担当領域 | 状態 |
   * |--------|------|----------|------|
   * | 橋本 透 | CEO | 経営戦略・最終意思決定 | ● オンライン |
   * | 田中二俊 | Marketing | マーケティング戦略・広告 | ● オンライン |
   * | 辻井至 | Finance | 財務管理・予算・経費 | ○ オフライン |
   */
  async generateRoster(): Promise<string> { ... }

  /**
   * ${org_chart} — 組織図（テキスト形式）
   *
   * 出力例:
   * CEO (橋本 透)
   * ├── CTO / Engineering-Lead (渡辺兼)
   * ├── CFO / Finance (辻井至)
   * ├── Product-Manager (李四)
   * ├── Marketing (田中二俊)
   * ├── Sales (王小二)
   * └── Strategic-Planner (蔡太郎)
   */
  async generateOrgChart(): Promise<string> { ... }

  /**
   * ${my_team} — 自分のロールから見た関連メンバー
   * CEO → 全員
   * Engineering-Lead → PM, Strategic-Planner
   * Finance → CEO, Sales
   * etc.
   */
  async generateMyTeam(roleId: string): Promise<string> { ... }

  /**
   * ${collaboration_rules} — 協働ルール
   *
   * 出力例:
   * ## いつ誰に連絡するか
   * - 予算に関する質問 → Finance (辻井至) に grc_relay_send
   * - 技術的な判断 → Engineering-Lead (渡辺兼) に相談
   * - 市場データが必要 → Marketing (田中二俊) に依頼
   * - 契約・商談 → Sales (王小二) に確認
   * - 経営判断・承認 → CEO (橋本 透) にエスカレーション
   * - 中長期戦略 → Strategic-Planner (蔡太郎) に相談
   */
  async generateCollaborationRules(roleId: string): Promise<string> { ... }
}
```

### 3.2 ロールテンプレート agentsMd の改修

**各ロールの `agentsMd` テンプレートに会社Contextセクションを追加:**

```markdown
# ${role_display_name} エージェント設定

## あなたのアイデンティティ
- 名前: ${employee_name}
- 社員番号: ${employee_id}
- 役職: ${role_display_name}
- 所属: ${company_name}

## 会社組織図

${org_chart}

## 全社員名簿

${company_roster}

## あなたのチーム

${my_team}

## 協働ルール

${collaboration_rules}

## コミュニケーション方法

他のAI社員に連絡する場合は以下のツールを使用:

### 個別連絡
`grc_relay_send` ツールを使用:
- `to_role_id`: 相手の役職ID（例: "finance", "engineering-lead"）
- `message_type`: "text" | "directive" | "query" | "report"
- `subject`: 件名
- `payload.body`: 本文

### 全体通知
`grc_broadcast` ツールを使用:
- `target_roles`: 対象の役職ID配列（省略で全員）
- `subject`: 件名
- `payload.body`: 本文

### 社員状態確認
`grc_roster` ツールを使用:
- オンライン/オフライン状態をリアルタイムで確認
```

### 3.3 新社員入社時の自動Context更新（核心機能）

**トリガー**: ノードがGRCに登録 or ロール割当変更時

**ファイル**: `C:\work\grc\src\modules\roles\service.ts` (既存の拡張)

```typescript
/**
 * 新社員が入社（ノード登録 + ロール割当）した時:
 * 1. 新社員の agentsMd を展開（最新の roster, org_chart 含む）
 * 2. 関連する既存社員の agentsMd を再展開（新社員情報を含めるため）
 * 3. 全対象ノードに SSE push で config_update を送信
 * 4. 各ノードが自動で workspace/AGENTS.md を更新
 */
async onRoleAssignmentChanged(nodeId: string, roleId: string): Promise<void> {
  const contextGen = new CompanyContextGenerator(this.db);

  // 1. 影響を受けるノードを特定
  const affectedNodes = await this.getAffectedNodes(nodeId, roleId);
  // CEO → 全ノードが影響を受ける
  // Finance → CEO, Sales, PM が影響を受ける
  // 新人 → 全ノード（名簿が変わるため）

  // 2. 各ノードの agentsMd を再展開
  for (const node of affectedNodes) {
    const variables = {
      ...this.getBaseVariables(node),
      company_roster: await contextGen.generateRoster(),
      org_chart: await contextGen.generateOrgChart(),
      my_team: await contextGen.generateMyTeam(node.roleId),
      collaboration_rules: await contextGen.generateCollaborationRules(node.roleId),
    };

    // テンプレート変数を展開して DB 更新
    const resolved = this.resolveTemplateVariables(
      node.roleTemplate.agentsMd,
      variables
    );
    await this.updateResolvedMd(node.nodeId, 'resolvedAgentsMd', resolved);

    // configRevision をインクリメント
    await this.incrementConfigRevision(node.nodeId);
  }

  // 3. SSE で全対象ノードに通知（既存メカニズム活用）
  for (const node of affectedNodes) {
    nodeConfigSSE.pushConfigUpdate(node.nodeId);
    // → WinClaw が REST pull → workspace/AGENTS.md 更新
  }

  logger.info({
    trigger: 'role_assignment_changed',
    nodeId,
    roleId,
    affectedCount: affectedNodes.length,
  }, 'Company context propagated to all affected nodes');
}

/**
 * 影響範囲の判定ロジック
 */
private async getAffectedNodes(
  changedNodeId: string,
  changedRoleId: string
): Promise<Node[]> {
  // 名簿が変わるので原則全ノードが影響を受ける
  // ただし ${my_team} の内容はロール依存なので、
  // 関連ロールだけ my_team を再生成すればよい

  const allActiveNodes = await this.db
    .select()
    .from(nodesTable)
    .where(
      and(
        isNotNull(nodesTable.roleId),
        gte(nodesTable.lastHeartbeat, dayjs().subtract(24, 'hour').toDate())
      )
    );

  return allActiveNodes;
}
```

### 3.4 影響範囲マトリクス

```
新入社員のロール    → 更新が必要なノード
─────────────────────────────────────
CEO               → 全ノード (全員がCEOを知る必要)
Engineering-Lead  → CEO, PM, Strategic-Planner, 自分
Finance           → CEO, Sales, PM, 自分
Marketing         → CEO, Sales, PM, 自分
Sales             → CEO, Finance, Marketing, PM, 自分
PM                → 全ノード (PMは全員と連携)
Strategic-Planner → CEO, PM, 自分
ANY (名簿変更)    → 全ノード (${company_roster} が変わるため)
```

**結論**: 名簿が変わる以上、実質的に**全アクティブノードを更新**するのが最もシンプルで確実。

---

## 4. 配信シーケンス図

### 4.1 新社員入社フロー

```
Admin (GRC Dashboard)        GRC Server                WinClaw Nodes
     │                           │                          │
     │ POST /admin/employees     │                          │
     │  assign role to new node  │                          │
     │ ─────────────────────────>│                          │
     │                           │                          │
     │                           │ onRoleAssignmentChanged() │
     │                           │  1. generateRoster()      │
     │                           │  2. generateOrgChart()    │
     │                           │  3. for each active node: │
     │                           │     resolveTemplateVars() │
     │                           │     updateResolvedMd()    │
     │                           │     configRevision++      │
     │                           │                          │
     │                           │  SSE: config_update      │
     │                           │ ─────────────────────────>│
     │                           │                          │ GET /a2a/config/pull
     │                           │ <─────────────────────────│
     │                           │  { files: { AGENTS.md }}  │
     │                           │ ─────────────────────────>│
     │                           │                          │ atomic write
     │                           │                          │ workspace/AGENTS.md
     │                           │                          │
     │                           │                          │ [次の会話で自動読み込み]
     │                           │                          │ CEO: "新しいFinance担当の
     │                           │                          │  辻井至さんが入社しました"
```

### 4.2 CEO が Finance に連絡するフロー

```
User → CEO Agent                    GRC Server            Finance Agent
  │                                     │                      │
  │ "来月の予算を確認して"                │                      │
  │ ───────────────────>                │                      │
  │                                     │                      │
  │ [AGENTS.md を参照]                   │                      │
  │ "予算 → Finance (辻井至)"            │                      │
  │                                     │                      │
  │ grc_relay_send({                    │                      │
  │   to_role_id: "finance",            │                      │
  │   subject: "来月予算確認依頼",        │                      │
  │   payload: { body: "..." }          │                      │
  │ }) ────────────────────────────────>│                      │
  │                                     │ SSE relay_message    │
  │                                     │ ───────────────────>│
  │                                     │                      │
  │                                     │    [タスクとして処理]  │
  │                                     │ <───────────────────│
  │                                     │  grc_relay_send({    │
  │                                     │   to_role_id: "ceo", │
  │                                     │   subject: "予算報告"│
  │                                     │  })                  │
  │ <──────────────────────────────────│                      │
  │ "Finance辻井至から回答が届きました"    │                      │
```

---

## 5. DB スキーマ変更

### 5.1 role_templates テーブル（既存拡張）

変更不要。既存の `agentsMd` フィールドにテンプレート変数を追加するだけ。

### 5.2 role_job_descriptions テーブル（新規）

```sql
CREATE TABLE role_job_descriptions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  role_id       VARCHAR(50) NOT NULL UNIQUE,
  display_name  VARCHAR(100) NOT NULL,     -- "最高経営責任者 (CEO)"
  summary       TEXT NOT NULL,              -- 1行の概要
  responsibilities TEXT NOT NULL,           -- 職務内容（箇条書きMarkdown）
  expertise     JSON DEFAULT NULL,          -- ["経営戦略", "意思決定", "人事"]
  reports_to    VARCHAR(50) DEFAULT NULL,   -- 上司の role_id (CEOはNULL)
  collaboration JSON DEFAULT NULL,          -- 連携先 {"finance": "予算承認", "engineering": "技術判断"}
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (role_id) REFERENCES role_templates(roleId) ON DELETE CASCADE
);
```

**初期データ例:**

```sql
INSERT INTO role_job_descriptions (role_id, display_name, summary, responsibilities, expertise, reports_to) VALUES
('ceo', '最高経営責任者 (CEO)',
 '会社全体の経営方針を策定し、各部門を統括する最終意思決定者',
 '- 経営戦略の策定と実行\n- 各部門の業績監督\n- 重要な意思決定と承認\n- 外部ステークホルダーとの関係管理\n- 組織全体の方向性設定',
 '["経営戦略","意思決定","組織マネジメント","リーダーシップ"]',
 NULL),

('engineering-lead', 'エンジニアリングリード',
 '技術戦略の策定とエンジニアリングチームの統括',
 '- 技術アーキテクチャの設計と意思決定\n- 開発チームのマネジメント\n- 技術的課題の解決\n- コードレビューと品質管理\n- 技術ロードマップの策定',
 '["ソフトウェア開発","システム設計","技術マネジメント","DevOps"]',
 'ceo'),

('finance', '財務担当',
 '会社の財務管理、予算策定、経費管理を担当',
 '- 予算の策定と管理\n- 経費の承認と監査\n- 財務レポートの作成\n- キャッシュフロー管理\n- 財務リスクの評価',
 '["財務管理","予算策定","会計","財務分析"]',
 'ceo'),

('product-manager', 'プロダクトマネージャー',
 '製品戦略の策定と開発プロセスの管理',
 '- 製品ロードマップの策定\n- ユーザーリサーチと要件定義\n- 開発チームとの連携\n- KPIの設定と追跡\n- 競合分析',
 '["プロダクト戦略","UX","アジャイル","市場分析"]',
 'ceo'),

('marketing', 'マーケティング担当',
 'マーケティング戦略の策定と実行',
 '- マーケティング戦略の策定\n- 広告キャンペーンの企画と実行\n- ブランド管理\n- 市場調査とデータ分析\n- コンテンツ制作',
 '["マーケティング","広告","ブランディング","データ分析"]',
 'ceo'),

('sales', '営業担当',
 '営業戦略の策定と顧客開拓',
 '- 営業戦略の策定\n- 顧客開拓と関係構築\n- 商談管理\n- 売上予測\n- 契約交渉',
 '["営業","顧客管理","交渉","CRM"]',
 'ceo'),

('strategic-planner', '戦略企画担当',
 '中長期戦略の策定と事業計画の立案',
 '- 中長期戦略の策定\n- 市場動向の分析\n- 新規事業の評価\n- KPIフレームワークの設計\n- 経営会議の資料作成',
 '["戦略企画","事業計画","市場分析","KPI設計"]',
 'ceo');
```

---

## 6. AGENTS.md テンプレート具体例

### 6.1 CEO 用 agentsMd テンプレート

```markdown
# CEO エージェント — ${employee_name}

あなたは ${company_name} の最高経営責任者（CEO）です。
社員番号: ${employee_id}

## 🏢 会社組織図

${org_chart}

## 👥 全社員名簿

${company_roster}

## 🤝 協働ルール

${collaboration_rules}

## 📞 連絡方法

### 個別連絡（grc_relay_send）
```json
{
  "to_role_id": "finance",        // 相手の役職ID
  "message_type": "directive",     // text/directive/query/report
  "subject": "来月予算確認",
  "payload": { "body": "来月の予算案を作成してください" }
}
```

### 全体通知（grc_broadcast）
```json
{
  "subject": "全体会議のお知らせ",
  "payload": { "body": "明日14時から全体会議を実施します" }
}
```

### オンライン確認（grc_roster）
引数なし。全社員の現在のオンライン状態を返します。
```

### 6.2 展開後の AGENTS.md 例（CEO）

```markdown
# CEO エージェント — 橋本 透

あなたは ITC Cloud Soft の最高経営責任者（CEO）です。
社員番号: 0784756

## 🏢 会社組織図

CEO — 橋本 透
├── Engineering-Lead — 渡辺兼
├── Finance — 辻井至
├── Product-Manager — 李四
├── Marketing — 田中二俊
├── Sales — 王小二
└── Strategic-Planner — 蔡太郎

## 👥 全社員名簿

| 社員名 | 社員番号 | 役職 | 担当領域 | 状態 |
|--------|---------|------|----------|------|
| 橋本 透 | 0784756 | CEO | 経営戦略・最終意思決定 | ● オンライン |
| 渡辺兼 | 9876544 | Engineering-Lead | 技術戦略・開発チーム統括 | ● オンライン |
| 辻井至 | 7654331 | Finance | 財務管理・予算・経費 | ● オンライン |
| 李四 | 4322222 | Product-Manager | 製品戦略・開発プロセス管理 | ● オンライン |
| 田中二俊 | 9009441 | Marketing | マーケティング戦略・広告 | ● オンライン |
| 王小二 | 9099999 | Sales | 営業戦略・顧客開拓 | ● オンライン |
| 蔡太郎 | 1234567 | Strategic-Planner | 中長期戦略・事業計画 | ● オンライン |

## 🤝 協働ルール

### あなたは全社員の上司です。以下の場面で各社員に連絡してください：

| 場面 | 連絡先 | 連絡方法 |
|------|--------|----------|
| 技術的な判断・アーキテクチャ | 渡辺兼 (Engineering-Lead) | grc_relay_send to_role_id="engineering-lead" |
| 予算・経費・財務報告 | 辻井至 (Finance) | grc_relay_send to_role_id="finance" |
| 製品方針・機能優先度 | 李四 (Product-Manager) | grc_relay_send to_role_id="product-manager" |
| マーケティング・広告 | 田中二俊 (Marketing) | grc_relay_send to_role_id="marketing" |
| 営業・商談・顧客 | 王小二 (Sales) | grc_relay_send to_role_id="sales" |
| 中長期戦略・市場分析 | 蔡太郎 (Strategic-Planner) | grc_relay_send to_role_id="strategic-planner" |
| 全員への通知 | 全社員 | grc_broadcast |

### 重要なルール
1. **タスク委任**: 自分で処理できない専門分野は、該当する社員にタスクを委任する
2. **承認フロー**: 重要な決定は関連部門の報告を受けてから判断する
3. **エスカレーション**: 部門間の対立は CEO であるあなたが仲裁する
4. **定期報告**: 各部門に定期的な進捗報告を求める

## 📞 連絡方法
...（省略）
```

---

## 7. 実装フェーズ

### Phase 1: DB + Context Generator（1-2時間）

1. `role_job_descriptions` テーブル作成 + 初期データ投入
2. `CompanyContextGenerator` クラス実装
   - `generateRoster()` — nodes + role_job_descriptions JOIN
   - `generateOrgChart()` — reports_to をツリー表示
   - `generateMyTeam()` — ロール依存のチーム一覧
   - `generateCollaborationRules()` — ロール依存の協働ルール

### Phase 2: テンプレート変数展開の拡張（30分）

1. `roles/service.ts` の `resolveTemplateVariables()` に新変数追加
2. `assignRoleToNode()` 内で Context Generator を呼び出し
3. 展開結果を `resolvedAgentsMd` に保存

### Phase 3: 自動伝播トリガー（1時間）

1. `onRoleAssignmentChanged()` イベントハンドラ実装
2. ノード登録時（hello API）のフック追加
3. ノード削除時（放生）のフック追加
4. 全影響ノードの `configRevision++` + SSE push

### Phase 4: ロールテンプレート更新（30分）

1. 全9ロールの `agentsMd` テンプレートに Context セクション追加
2. `seed-roles.mjs` 更新
3. 再シード実行

### Phase 5: 動作検証（30分）

1. 新社員を「再养一只」で追加 → 全ノードの AGENTS.md が更新されることを確認
2. CEO が Finance に `grc_relay_send` で連絡できることを確認
3. 「放生」で社員削除 → 全ノードの名簿から消えることを確認

---

## 8. 重要な設計判断

### Q: なぜ AGENTS.md に埋め込むのか？
**A**: WinClaw エージェントは会話開始時に workspace/ の MD ファイルを自動読み込みする。
AGENTS.md に会社Context を含めることで、エージェントは API を呼ばずに同僚の情報を把握でき、
オフライン時でも協働ルールに基づいた判断が可能。

### Q: 名簿のオンライン状態は古くならないか？
**A**: AGENTS.md の名簿は「誰がいるか・何の役職か」の静的情報。
リアルタイムのオンライン状態は `grc_roster` ツールで確認する。
AGENTS.md には「状態を確認するには grc_roster を使え」と記載する。

### Q: 全ノード更新のパフォーマンスは？
**A**: 現在7ノード、将来的にも100ノード以下を想定。
各ノードの agentsMd 再展開 + DB更新 + SSE通知は 100ms 以内で完了する。
SSE 通知後の REST pull は各ノードが非同期で実行するため、GRC への負荷は軽微。

### Q: TOOLS.md ではなく AGENTS.md を使う理由は？
**A**: TOOLS.md はツールの使い方の説明。AGENTS.md はエージェントの
アイデンティティと行動規範を定義する場所であり、
「会社の中での自分の位置づけ」は AGENTS.md が適切。

---

## 9. ファイル変更一覧

| ファイル | 変更 | 内容 |
|---------|------|------|
| `grc/src/modules/roles/context-generator.ts` | 新規 | 会社Context動的生成 |
| `grc/src/modules/roles/service.ts` | 修正 | 変数展開拡張 + 自動伝播 |
| `grc/src/modules/evolution/routes.ts` | 修正 | hello API にフック追加 |
| `grc/src/shared/db/schema.ts` | 修正 | role_job_descriptions テーブル |
| `grc/scripts/seed-roles.mjs` | 修正 | agentsMd テンプレートに Context 変数追加 |
| `grc/scripts/seed-job-descriptions.mjs` | 新規 | 職務記述初期データ投入 |

WinClaw 側の変更は **不要**。既存の SSE → REST pull → atomic write メカニズムがそのまま機能する。
