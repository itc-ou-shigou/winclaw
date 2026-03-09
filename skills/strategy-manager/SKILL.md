---
name: Strategy Manager
description: 業界/会社情報から企業戦略を自動生成・更新。GRCの戦略テーブルへの保存と全エージェントへの配信まで対応。Use when generating company strategy, updating mission/vision/KPIs, deploying strategy updates to all agents, or managing company_strategy in GRC.
version: 1.0.0
---

# Strategy Manager Skill

## Overview
業界名と会社概要の自然言語入力から、GRCの戦略テーブル（company_strategy）を自動生成・更新するスキル。

## Actions

### 1. generate — 新規戦略生成
**入力:**
- `industry` (必須): 業界名（EC, SaaS, FinTech等）
- `company_info` (必須): 会社概要（自然言語）

**処理:**
1. GRC API から既存ロール一覧を取得（部門名を取得）
2. LLM に業界+会社情報+部門リストを入力
3. 戦略JSON全フィールドを生成

**出力:** 戦略プレビューJSON

### 2. update — 既存戦略の差分更新
**入力:**
- `update_instruction` (必須): 変更指示（自然言語）

**処理:**
1. GRC API から現在の戦略を取得
2. LLM に現在戦略+変更指示を入力
3. 変更対象フィールドのみを生成

**出力:** 差分戦略JSON + 変更フィールドリスト

### 3. save — 戦略をGRCに保存
**入力:** generate/update で生成されたJSON
**処理:** `PUT /api/v1/admin/strategy` でGRCに更新
**出力:** 新リビジョン番号

### 4. deploy — 保存済み戦略を全エージェントに配信
**処理:** `POST /api/v1/admin/strategy/deploy`
**出力:** デプロイ結果（影響ノード数、作成されたCEOタスク）

## LLM System Prompt

あなたは企業戦略コンサルタントAIです。
以下の業界・会社情報に基づき、企業戦略をJSON形式で生成してください。

### 出力フォーマット
```json
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
    "marketing": {"annual": 80000000, "currency": "JPY", "notes": "..."}
  },
  "departmentKpis": {
    "marketing": [{"name": "KPI名", "target": "目標値", "current": "現在値"}]
  },
  "strategicPriorities": ["最優先事項1", "最優先事項2", "最優先事項3"]
}
```

### ルール
- 短期目標: 1-3ヶ月の達成可能な目標（3-5個）
- 中期目標: 年度内の成長目標（3-5個）
- 長期目標: 3-5年の方向性（2-3個）
- 予算: 既存の部門に対してのみ配分
- KPI: 各部門に2-4個
- 数値は具体的に（曖昧な表現を避ける）
- 業界特性を反映した戦略にする

## Safety Considerations
- 戦略更新+デプロイ → 全エージェントのUSER.mdが書き換わる
- 必ずプレビュー→確認→保存の3ステップ
- デプロイはユーザー明示的操作のみ（自動デプロイしない）
- 全変更がcompanyStrategyHistoryに自動保存

## Required Config
- GRC API endpoint (`grc_url` in winclaw.json)
- LLM API key (model key distributed via GRC)

## GRC API Endpoints Used
- `GET /api/v1/admin/strategy` — 現在の戦略取得
- `PUT /api/v1/admin/strategy` — 戦略更新
- `POST /api/v1/admin/strategy/deploy` — デプロイ
- `GET /api/v1/admin/roles` — 既存ロール一覧（部門情報）
- `POST /api/v1/admin/strategy/generate-preview` — AI生成プレビュー
