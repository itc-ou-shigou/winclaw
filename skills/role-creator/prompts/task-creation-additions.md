# Task Creation Additions — Standard Templates

各ロールのMDファイルに組み込むタスク発起機能の標準テンプレートセクション。
LLMはこれらのセクションを参考にし、ロール固有の内容に適合させて組み込む。

---

## AGENTS.md への追加セクション

```markdown
## タスク発起権限

### 発起可能な対象ロール
- （ロール固有: 直属の部下ロール、横断連携ロールを列挙）
- 例: `marketing-manager`, `content-writer`, `data-analyst`

### 発起上限（日次）
- 自律発起: 最大 10 タスク/日
- 優先度 critical: 上限なし（緊急時）
- 承認待ちタスクが 5 件以上の場合、新規発起を一時停止

### 発起時の必須事項
1. `context` フィールドに発起理由を必ず明記する（「〜のため」で終わる具体的な文章）
2. `priority` は業務影響度に基づいて設定（デフォルト: `medium`）
3. `deadline` は現実的な期日を設定（当日締切は `critical` 案件のみ）
4. 依存関係がある場合は `depends_on` に先行タスクIDを列挙

### 発起禁止事項
- 同一内容のタスクを重複発起しない（24時間以内に類似タスクがないか確認）
- 権限範囲外のロールへの直接発起（上位ロールへはエスカレーション経由）
- `context` が空のタスク発起
```

---

## TOOLS.md への追加セクション

```markdown
## タスク発起 API

### POST /a2a/tasks/create

エージェントが他のノードにタスクを発起する際に使用する。

**必須フィールド:**
| フィールド | 型 | 説明 |
|-----------|-----|------|
| `node_id` | string | 発起元ノードID（自分自身の `${node_id}`） |
| `title` | string | タスクタイトル（50文字以内、動詞で始める） |
| `context` | string | 発起理由（必須、「〜のため」形式） |

**任意フィールド:**
| フィールド | 型 | 説明 |
|-----------|-----|------|
| `description` | string | タスクの詳細説明 |
| `category` | string | `strategic` / `operational` / `administrative` / `expense` |
| `priority` | string | `critical` / `high` / `medium` / `low` |
| `target_role_id` | string | 対象ロールID（指定時は対象ロールを持つノードに配送） |
| `target_node_id` | string | 対象ノードID（特定ノード指定時） |
| `deadline` | string | ISO 8601 形式 (`2026-03-15T17:00:00+09:00`) |
| `depends_on` | string[] | 先行タスクIDの配列 |
| `deliverables` | string[] | 期待する成果物リスト |
| `notes` | string | 補足事項 |
| `expense_amount` | string | 経費申請金額（`expense` カテゴリ時） |
| `expense_currency` | string | 通貨コード（例: `JPY`, `USD`） |

**レスポンス:**
```json
{
  "ok": true,
  "task": {
    "id": "task_xxxxxxxx",
    "taskCode": "TASK-0042",
    "title": "タスクタイトル",
    "status": "pending",
    "assignedBy": "node_xxxxxxxx",
    "createdAt": "2026-03-10T09:00:00Z"
  }
}
```

**承認待ち時のレスポンス:**
```json
{
  "ok": false,
  "approval_required": true,
  "message": "このタスクは管理者承認が必要です",
  "retry_after": "2026-03-10T10:00:00Z"
}
```

**使用例（operational タスク）:**
```json
{
  "node_id": "${node_id}",
  "title": "月次レポートの作成",
  "context": "月末締めの売上集計が完了したため、経営会議用レポートの作成が必要なため",
  "category": "operational",
  "priority": "high",
  "target_role_id": "report-writer",
  "deadline": "2026-03-31T17:00:00+09:00",
  "deliverables": ["月次売上レポート.pdf", "前月比較チャート"]
}
```

**使用例（escalation タスク）:**
```json
{
  "node_id": "${node_id}",
  "title": "【エスカレーション】予算超過の承認依頼",
  "context": "Q1予算が120%を超過したため、追加予算の承認が必要なため",
  "category": "strategic",
  "priority": "critical",
  "target_role_id": "cfo",
  "notes": "超過額: ¥2,500,000 / 原因: 緊急インフラ対応"
}
```
```

---

## HEARTBEAT.md への追加セクション

```markdown
## 異常検知 → タスク自動発起パターン

### トリガー条件マッピング

| 検知条件 | タスク category | priority | 発起先ロール |
|---------|----------------|----------|------------|
| KPI が目標値の 80% 未満（週次） | `operational` | `high` | 担当ロール |
| KPI が目標値の 60% 未満（月次） | `strategic` | `critical` | 上位管理ロール |
| エラーレート > 5%（時間単位） | `operational` | `high` | tech-lead |
| 未処理タスクが 48 時間超過 | `administrative` | `medium` | 同一ロール別ノード |
| 予算消化率 > 90%（月中） | `administrative` | `high` | 財務ロール |

### 標準異常検知フロー

```
1. 定期チェック実行（heartbeat_interval に従う）
2. 閾値チェック:
   - 正常範囲内 → ログ記録のみ
   - 警告ゾーン → ノート作成 + 次回チェックで再確認
   - 異常値   → タスク発起（下記テンプレート使用）
3. タスク発起後:
   - 発起済みフラグをセット（重複発起防止）
   - フラグは対象タスクが完了/却下されたらリセット
```

### 異常検知タスク発起テンプレート

```json
{
  "node_id": "${node_id}",
  "title": "【アラート】${metric_name} が閾値を超過",
  "context": "${metric_name} が ${current_value} となり、閾値 ${threshold} を超過したため対応が必要なため",
  "category": "operational",
  "priority": "${priority_based_on_severity}",
  "target_role_id": "${responsible_role_id}",
  "notes": "検知時刻: ${detected_at} / 前回正常値: ${last_normal_value}"
}
```

### Heartbeat スケジュール例

```markdown
## 定期実行スケジュール

### 毎時チェック
- [ ] リアルタイムKPIの閾値確認
- [ ] エラーレート確認
- [ ] 未処理タスクの滞留確認

### 日次チェック（09:00）
- [ ] 日次KPI達成率の確認
- [ ] 昨日の完了タスク集計
- [ ] 今日の優先タスク確認
- [ ] 必要に応じてタスク発起

### 週次チェック（月曜 09:00）
- [ ] 週次KPI進捗確認
- [ ] 月次目標との乖離計算
- [ ] 部門横断連携タスクの確認
- [ ] 週次レポート作成タスク発起

### 月次チェック（1日 09:00）
- [ ] 月次KPI達成率の最終確認
- [ ] 次月目標の設定確認
- [ ] 予算消化率の確認
- [ ] 経営報告タスク発起
```
```

---

## TASKS.md への追加セクション

```markdown
## タスク完了後の連鎖発起パターン（task_chain）

### 基本パターン

```
タスク受信
  └→ 処理実行
       ├→ 成功: 完了報告 + 後続タスク発起（定義がある場合）
       └→ 失敗: エスカレーション or リトライ
```

### 連鎖発起テンプレート

タスク完了後に後続タスクを発起する場合は以下のフローに従う:

```
1. タスク完了を記録（ステータス更新）
2. task_chain 定義を確認
3. 後続タスクの前提条件をチェック
4. 条件を満たす場合、後続タスクを発起
   - context に「${completed_task_title} が完了したため」を必ず含める
   - depends_on に完了タスクのIDを設定
5. 後続タスク発起を完了報告に記載
```

**例: データ収集 → 分析 → レポート の連鎖**
```json
// Step 1 完了後に Step 2 を発起
{
  "node_id": "${node_id}",
  "title": "収集データの分析実行",
  "context": "データ収集タスク（TASK-0041）が完了したため、分析フェーズを開始するため",
  "category": "operational",
  "priority": "medium",
  "target_role_id": "data-analyst",
  "depends_on": ["task_id_of_step1"],
  "deliverables": ["分析結果レポート", "可視化チャート"]
}
```

### エスカレーションパターン

自律解決できない場合は上位ロールへエスカレーションする:

```
エスカレーション条件:
  - 3回リトライしても解決しない
  - 権限範囲を超える意思決定が必要
  - 予算承認が必要（expense_amount > 承認不要閾値）
  - 緊急事態（システム障害、法的問題等）

エスカレーションタスク発起テンプレート:
```json
{
  "node_id": "${node_id}",
  "title": "【エスカレーション】${original_task_title}",
  "context": "${problem_description}のため、上位の判断が必要なため",
  "category": "${original_category}",
  "priority": "high",
  "target_role_id": "${manager_role_id}",
  "notes": "元タスク: ${original_task_code} / 試みた解決策: ${attempted_solutions} / 現在の状況: ${current_status}"
}
```
```

### 完了報告フロー

```markdown
## タスク完了時の標準フロー

1. **作業実行**: タスク内容を実行
2. **成果物確認**: deliverables リストの全アイテムを確認
3. **完了記録**: タスクステータスを `completed` に更新
4. **報告作成**: 以下を含む完了報告を作成
   - 実施した作業の概要
   - 成果物の確認結果
   - 発見した課題や改善点
   - 後続タスクの発起状況（発起した場合はタスクコードを記載）
5. **後続タスク発起**: task_chain 定義に従い後続タスクを発起
6. **クローズ**: 全後続タスクの発起確認後、本タスクをクローズ
```

### タスク受信時の処理フロー

```
受信
  └→ タスク内容の解析
       ├→ category の確認（strategic/operational/administrative/expense）
       ├→ priority の確認（critical → 即時対応, low → 通常キュー）
       ├→ depends_on の確認（先行タスクが未完了なら待機）
       └→ deliverables の確認（期待成果物リストの把握）
            └→ 実行開始
                 ├→ 完了 → 完了報告 + 連鎖発起
                 ├→ 要確認 → 質問タスク発起 or 人間へのエスカレーション
                 └→ 失敗 → リトライ or エスカレーション
```
```
