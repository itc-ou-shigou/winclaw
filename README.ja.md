# WinClaw --- Personal AI Assistant

<p align="center">
  <a href="https://github.com/itc-ou-shigou/winclaw/actions/workflows/ci.yml?branch=main"><img src="https://img.shields.io/github/actions/workflow/status/itc-ou-shigou/winclaw/ci.yml?branch=main&style=for-the-badge" alt="CI"></a>
  <a href="https://github.com/itc-ou-shigou/winclaw/releases"><img src="https://img.shields.io/github/v/release/itc-ou-shigou/winclaw?include_prereleases&style=for-the-badge" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

## 概要

WinClaw は、自分のデバイス上で動作する **パーソナル AI アシスタント / マルチチャネル AI ゲートウェイ** です。
WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、Microsoft Teams、Matrix、Zalo、WebChat など、普段使っているメッセージングチャネルを通じて AI アシスタントと対話できます。
Gateway がコントロールプレーンとして機能し、セッション管理、チャネル接続、ツール実行、スキル連携を統合的に処理します。

WinClaw はクロスプラットフォーム対応です。macOS では launchd、Linux では systemd、Windows では schtasks（タスクスケジューラ）を通じてデーモンとして常駐します。
Windows 向けには Node.js ランタイム内蔵の EXE インストーラーが用意されており、前提条件なしでセットアップが完了します。

AI モデルは **Anthropic Claude**（Pro/Max + Opus 4.6 推奨）および **OpenAI**（ChatGPT/Codex）に対応しています。
OAuth プロファイルローテーション、API キーフォールバック、モデルフェイルオーバーにより、安定した AI アクセスを実現します。

## Windows インストール

### 方法 1: EXE インストーラー（推奨）

Windows ユーザーに最も推奨される方法です。Node.js 22 ランタイムが内蔵されており、前提条件は一切不要です。

1. [SourceForge](https://sourceforge.net/projects/winclaw/files/WinClawSetup-2026.3.10.exe/download) または [GitHub Releases](https://github.com/itc-ou-shigou/winclaw/releases) から `WinClawSetup-{version}.exe` をダウンロード（リポジトリの [`releases/`](releases/) ディレクトリからも取得可能）
2. インストーラーを実行（管理者権限不要 -- ユーザープロファイルにインストールされます）
3. インストール時のオプションを選択:

| オプション                 | 説明                                                     | デフォルト |
| -------------------------- | -------------------------------------------------------- | ---------- |
| デスクトップショートカット | デスクトップに WinClaw アイコンを作成                    | オフ       |
| PATH に追加                | ユーザー PATH に `{app}` ディレクトリを追加              | オン       |
| デーモンインストール       | Gateway をタスクスケジューラに登録（ログオン時自動起動） | オン       |

インストーラーが自動的に行うこと:

- `WINCLAW_HOME` 環境変数の設定
- （選択時）Gateway デーモンのタスクスケジューラ登録
- インストール完了画面で **対話式セットアップウィザード**（`winclaw onboard --flow quickstart`）の起動オプションを表示

アンインストール時には、デーモンの停止・削除と PATH のクリーンアップが自動的に実行されます。

> **注意:** 以前のインストールの Node.js プロセスが実行中の場合、インストーラーが閉じるよう促します。
> 「自動的にアプリケーションを終了する」を選択し、「次へ」をクリックして続行してください。

### インストール後のオンボーディングウィザード

インストール完了画面で「Run WinClaw Setup Wizard」にチェックを入れて「完了」をクリックすると、ターミナルウィンドウが開き、対話式セットアップウィザードが起動します。ウィザードでは以下を順番に設定します:

1. **Gateway モード** -- `gateway.mode` を `local` に設定（シングルマシン利用に推奨）
2. **認証トークン** -- `gateway.auth.token` を自動生成（Gateway WebSocket のセキュリティ認証用）
3. **AI モデル認証情報** -- Anthropic (Claude)、OpenAI などのプロバイダー API キー / OAuth トークンを設定
4. **メッセージングチャネル** -- WhatsApp、Telegram、Slack などの接続設定（オプション）
5. **デーモンインストール** -- Gateway を Windows タスクスケジューラに登録（オプション）

インストール時にウィザードをスキップした場合、または再実行が必要な場合:

```powershell
winclaw onboard --flow quickstart
```

デスクトップショートカットとスタートメニューのランチャー（`winclaw-ui.cmd`）は初回起動を自動検出します: `gateway.mode` が未設定の場合、Gateway 起動前にオンボーディングウィザードを起動します。

### インストール後: Dashboard（コントロール UI）へのアクセス

オンボーディングウィザード完了後、Gateway は `http://127.0.0.1:18789/` でリッスンします。**Dashboard（コントロール UI）** は Gateway トークンによる認証が必要です。

**方法 1: 自動オープン（推奨）**

```powershell
winclaw dashboard
```

このコマンドはデフォルトブラウザで Dashboard を開きます。URL フラグメントにトークンが含まれています（`http://127.0.0.1:18789/#token=<あなたのトークン>`）。

**方法 2: URL のみ表示**

```powershell
winclaw dashboard --no-open
```

表示された URL をコピーしてブラウザに貼り付けてください。

**方法 3: 手動アクセス**

1. ブラウザで `http://127.0.0.1:18789/` を開く
2. 「disconnected (1008): unauthorized: gateway token mismatch」と表示される場合、Gateway トークンが必要
3. トークンを取得:
   ```powershell
   winclaw config get gateway.auth.token
   ```
4. URL にトークンを付加: `http://127.0.0.1:18789/#token=<あなたのトークン>`

### インストール後: AI モデル認証トークンの設定

Gateway には有効な AI プロバイダーの認証情報が必要です。`HTTP 401 authentication_error: OAuth token has expired` が表示される場合、トークンを更新または追加してください:

```powershell
# 対話式ログイン（ブラウザで OAuth フローを実行）
winclaw models auth login --provider anthropic

# またはトークンを手動で貼り付け
winclaw models auth add
```

認証プロファイルは `%USERPROFILE%\.winclaw\agents\main\agent\auth-profiles.json` に保存されます。このファイルを直接編集してトークンを追加・更新することもできます。

### 方法 2: PowerShell ワンライナー

```powershell
irm https://raw.githubusercontent.com/itc-ou-shigou/winclaw/main/install.ps1 | iex
```

このスクリプトは Windows バージョンを確認し、Node.js 22 が未インストールの場合は winget/choco/scoop 経由でインストールした上で、WinClaw をセットアップします。
Windows 10 1803 以降（Build 17134+）が必要です。

### 方法 3: npm（Node.js インストール済みの場合）

```bash
npm install -g winclaw@latest
winclaw onboard --install-daemon
```

### 方法 4: winget

```powershell
winget install WinClaw.WinClaw
```

サイレントインストール:

```powershell
winget install WinClaw.WinClaw --silent
```

## macOS / Linux インストール

ランタイム要件: **Node.js 22 以上**

```bash
npm install -g winclaw@latest
# または: pnpm add -g winclaw@latest

winclaw onboard --install-daemon
```

ウィザードが Gateway デーモンをインストールします:

| プラットフォーム | デーモン方式                   | 管理コマンド       |
| ---------------- | ------------------------------ | ------------------ |
| macOS            | launchd ユーザーサービス       | `launchctl`        |
| Linux            | systemd ユーザーサービス       | `systemctl --user` |
| Windows          | schtasks（タスクスケジューラ） | `schtasks`         |

## クイックスタート

### Windows（EXE インストール後）

```powershell
# 1. インストール時にウィザードをスキップした場合、ここで実行
winclaw onboard --flow quickstart

# 2. デーモンをインストール・起動（未実行の場合）
winclaw daemon install

# 3. コントロール UI Dashboard を開く（トークン付きで自動オープン）
winclaw dashboard

# 4. ターミナル UI を起動
winclaw tui

# 5. AI アシスタントと対話
winclaw agent --message "こんにちは" --thinking high

# 6. ヘルスチェック
winclaw doctor
```

### macOS / Linux

```bash
# 1. セットアップウィザード（初回のみ）
winclaw onboard --install-daemon

# 2. Gateway を手動起動（デーモン未使用の場合）
winclaw gateway --port 18789 --verbose

# 3. コントロール UI Dashboard を開く
winclaw dashboard

# 4. AI アシスタントと対話
winclaw agent --message "こんにちは" --thinking high

# 5. ターミナル UI を起動
winclaw tui
```

### 主要 CLI コマンド

| コマンド                                    | 説明                                   |
| ------------------------------------------- | -------------------------------------- |
| `winclaw onboard`                           | セットアップウィザード                 |
| `winclaw gateway`                           | Gateway 起動                           |
| `winclaw dashboard`                         | コントロール UI を開く（トークン付き） |
| `winclaw agent`                             | AI エージェント対話                    |
| `winclaw doctor`                            | ヘルスチェック・診断                   |
| `winclaw daemon install / status / restart` | デーモン管理                           |
| `winclaw tui`                               | ターミナル UI                          |
| `winclaw models auth login`                 | AI モデル認証トークンの更新            |
| `winclaw config get <key>`                  | 設定値の取得                           |
| `winclaw config set <key> <value>`          | 設定値の変更                           |
| `winclaw update`                            | アップデート                           |

## ⭐ おすすめスキル

WinClaw には、Windows PC での開発ワークフローを大幅に強化する 5 つの強力な自動化スキルが搭載されています。

### 🧪 AI Dev System Testing — Web アプリ自動テスト

AI エージェントが Web アプリケーションを全自動でテストします。コード構造分析、ビジネスロジック抽出、コードレビュー＆バグ自動修正、優先度別テストデータの自動生成、2層テストプロトコル（標準 CRUD ＋ シナリオベースのビジネスロジックテスト）—— **テストスクリプトを一行も書くことなく**、AI が全工程を実行します。

**自動修正対応言語:** Python、PHP、Go、JavaScript/Node.js、TypeScript/React など、インタープリタ型言語。

> **注意:** コンパイル型言語（Java、C++、C# など）の自動テスト・バグ自動修正は OSS 版には含まれていません。エンタープライズサポートが必要な場合は **info@itccloudsoft.com** にお問い合わせください。

#### 前提条件

1. **WinClaw** が Windows PC にインストール済み
2. **Claude in Chrome** 拡張機能を [Chrome ウェブストア](https://chromewebstore.google.com/) からインストール（Phase 5C ブラウザ UI テストに必須）
3. **Claude サブスクリプション**（Pro/Max 推奨）、または代替モデルを使用（下記参照）

#### 代替モデルの使用（GLM-5 など）

Claude サブスクリプションは必須ではありません。OpenAI 互換の任意のモデルが使えます。例えば **GLM-5**（智譜 AI）を使用する場合：

```cmd
Set ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic
Set ANTHROPIC_AUTH_TOKEN=あなたのGLM APIキー
Set ANTHROPIC_MODEL=glm-5
```

#### 使い方

**チャットモード（初回推奨）：**

```powershell
# WinClaw の Chat タブで AI に直接伝える：
"C:\path\to\my-project のプロジェクトをテストして。フロントエンドは http://localhost:3000、バックエンドは http://localhost:8000"
```

**スクリプト直接実行：**

```powershell
# 基本使用法（対話式 — URL 設定を質問されます）
& "C:\Users\USER\AppData\Local\Programs\WinClaw\app\skills\ai-dev-system-testing\scripts\run-all.ps1" `
    -Workspace "C:\path\to\my-project"

# 全パラメータ指定（非対話式）
& "C:\Users\USER\AppData\Local\Programs\WinClaw\app\skills\ai-dev-system-testing\scripts\run-all.ps1" `
    -Workspace "C:\path\to\my-project" `
    -FrontendUrl "http://localhost:3000" `
    -BackendUrl "http://localhost:8000" `
    -NonInteractive

# Resume モード（完了済みフェーズをスキップ）
& "C:\Users\USER\AppData\Local\Programs\WinClaw\app\skills\ai-dev-system-testing\scripts\run-all.ps1" `
    -Workspace "C:\path\to\my-project" -Resume
```

#### テストフェーズ

| フェーズ | 機能 | 出力ファイル |
|----------|------|-------------|
| Phase 2 | コード構造分析 | `CODE_ANALYSIS.md` |
| Phase 3 | コードレビュー＋バグ自動修正＋ビジネスロジック抽出（フレームワーク別ベストプラクティス参照） | `CODE_REVIEW_REPORT.md`、`BUSINESS_LOGIC_TESTCASES.md` |
| Phase 5A | テストデータ生成（ビジネスロジック理解に基づく優先度別 P0〜P5 シナリオ） | `test-data/` |
| Phase 5B | API エンドポイントテスト — 全パターン網羅の2層プロトコル（反復式） | `test-logs/phase5b_*.json` |
| Phase 5C | Chrome ブラウザ UI テスト — 全パターン網羅の2層プロトコル | `test-logs/phase5c_*.json` |
| Phase 6 | ドキュメント自動生成 | `docs/` |

#### フレームワーク別ベストプラクティス（Phase 3 参照ドキュメント）

Phase 3 では、プロジェクトの検出された技術スタックに基づき、フレームワーク固有のベストプラクティスドキュメントを動的にロードします。これらのドキュメントはアンチパターン（バグリスク vs. スタイルのみ）、セキュリティチェックリスト、パフォーマンスガイドラインを定義し、コードレビューと自動修正の判断を導きます。

| ベストプラクティスドキュメント | フレームワーク | 主な対象領域 |
|-------------------------------|---------------|-------------|
| `python-fastapi.md` | Python 3.10+ / FastAPI + SQLAlchemy 2.0 | 3層アーキテクチャ、非同期パターン、Pydantic バリデーション、N+1 クエリ防止 |
| `java-spring-boot.md` | Java 21+ / Spring Boot 3.x–4.x | DI、Spring Security、JPA パターン、テスト戦略 |
| `php-laravel.md` | PHP 8.1+ / Laravel | Eloquent ORM、ミドルウェア、フォームリクエスト、バリデーションルール |
| `go-zero.md` | Go 1.19+ / go-zero | gRPC パターン、struct タグバリデーション、サービス層設計 |
| `react-nextjs.md` | React 18+ / Next.js 13.5+ | Server vs Client コンポーネント、状態管理、メモ化、イミュータビリティ |

#### ビジネスロジックパイプライン（Phase 3 → 5A → 5B/5C）

Phase 3 では上記ベストプラクティスを参照しながら深層コードレビューを実行し、ソースコードから **6 カテゴリのビジネスロジックパターン** を直接抽出します：

1. **バリデーションルール** — Pydantic `Field()`、JPA `@NotNull/@Size`、Laravel `rules()`、go-zero struct タグ
2. **ステートマシン** — status/state フィールドの遷移、enum 定義、if-chain/switch ロジック
3. **認可パターン** — `@login_required`、`@PreAuthorize`、auth ガード、ロールベースミドルウェア
4. **ビジネス制約** — 在庫チェック、ユニーク制約、残高/クォータ制限、参照整合性
5. **エラーハンドリングパス** — 例外ハンドラ、カスタム例外、HTTP エラーレスポンス
6. **条件分岐ビジネスロジック** — ロール別機能、フィーチャーフラグ、ティア別料金、時間ベースルール

これらのパターンは `BUSINESS_LOGIC_TESTCASES.md` として出力され、Phase 5A がこれを消費して **優先度別（P0〜P5）マルチシナリオテストデータ** を生成します：管理者ユーザー、不正バリデーションペイロード、各種状態のレコード、制約トリガーデータ、エラーパストリガーなど。Phase 5B/5C は **抽出された全パターンを網羅する2層テストプロトコル** を実行します：Layer 1（標準 CRUD/ページテスト）＋ Layer 2（Phase 3 で発見された全パターンに対する必須シナリオテスト）。各フェーズは最大 15 回の反復を実行し、合格率が 95%+（API）または 100%（UI）に達するまで自動修正を繰り返します。

#### テストアカウントの設定

Phase 5 テストにはテスト用アカウントの認証情報が必要です：

```powershell
$env:TEST_USER_EMAIL = "test@example.com"
$env:TEST_USER_PASSWORD = "YourTestPassword123"
```

---

### 🆓 Free LLM Updater — 10 以上の無料モデル API、毎日自動更新

無料 LLM API プロバイダーを自動発見し、WinClaw に登録します。[cheahjs/free-llm-api-resources](https://github.com/cheahjs/free-llm-api-resources) から最新の無料プロバイダー情報を取得し、各 API キーとエンドポイントの動作を検証した上で、利用可能なプロバイダーをモデルリストに追加します。**毎朝 10 時に自動更新** —— cron ジョブが新しい無料プロバイダーを自動チェックします。手動操作は不要です。

**利用可能な無料プロバイダー：**

| プロバイダー | 利用可能モデル | 登録先 |
|-------------|--------------|--------|
| Groq | LLaMA, Mixtral | [console.groq.com](https://console.groq.com) |
| OpenRouter | 100 以上のモデル | [openrouter.ai](https://openrouter.ai) |
| Google AI Studio | Gemini Pro/Flash | [aistudio.google.com](https://aistudio.google.com) |
| Cerebras | LLaMA 70B | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| Mistral | Mistral/Mixtral | [console.mistral.ai](https://console.mistral.ai) |
| GitHub Models | GPT-4o, LLaMA | [github.com/marketplace/models](https://github.com/marketplace/models) |
| NVIDIA NIM | LLaMA, Mixtral | [build.nvidia.com](https://build.nvidia.com) |
| HuggingFace | オープンソースモデル | [huggingface.co](https://huggingface.co) |
| Cohere | Command R+ | [cohere.com](https://cohere.com) |
| …その他 | 自動発見 | 毎日更新 |

#### 使い方

1. 上記の無料プロバイダーで無料 API キーを取得
2. 環境変数に設定（例：`GROQ_API_KEY`、`GEMINI_API_KEY`）
3. WinClaw Chat で **「無料 LLM プロバイダーを更新して」** と伝える
4. WinClaw が各プロバイダーを検証し、利用可能なものをモデルリストに追加
5. **WinClaw モデル選択ドロップダウン** で無料モデルを切り替えて使用

初回実行時に毎日更新の cron ジョブが自動登録されるため、手動設定は不要です。

---

### ☁️ クラウドデプロイスキル — AWS・Azure・Alibaba Cloud へワンコマンドデプロイ

WinClaw には 3 つのクラウドデプロイスキルが内蔵されており、シンプルなインフラ構成からエンタープライズ級のセキュリティアーキテクチャまで、WinClaw Chat での自然な会話で完了できます。各スキルは要件ヒアリング → アーキテクチャ設計 → インフラ構築 → コードデプロイ → デプロイ後検証の全工程をガイドします。エンタープライズレベルのセキュリティが必要な場合は、`/architecture` コマンド（Engineering Plugin）を自動呼び出しし、包括的なセキュリティアーキテクチャ（WAF、DDoS 対策、KMS、IAM、脅威検知、コンプライアンス監視）を設計してからデプロイします。

| スキル | クラウドプロバイダー | トリガーフレーズ | IaC 形式 |
|--------|---------------------|-----------------|---------|
| **aws-cloud-deploy** | Amazon Web Services | "deploy to aws", "AWS deploy", "AWSにデプロイ" | CloudFormation (YAML) |
| **azure-cloud-deploy** | Microsoft Azure | "deploy to azure", "Azure deploy", "Azureにデプロイ" | ARM Templates (JSON) |
| **aliyun-cloud-deploy** | Alibaba Cloud | "deploy to aliyun", "Alibaba Cloud deploy", "アリクラウドデプロイ" | ROS Templates (JSON) |

#### 6 つのアーキテクチャパターン

予算・トラフィック・要件に応じて、最適なアーキテクチャパターンが自動選択されます：

| パターン | 予算 | トラフィック | AWS | Azure | Alibaba Cloud |
|---------|------|------------|-----|-------|--------------|
| **Lite** | $10-40/月 | <500/日 | EC2 + EIP | VM + Public IP | ECS + EIP |
| **Standard** | $50-150/月 | 500-5K/日 | EC2 + ALB + RDS | App Service + DB | ECS + SLB + RDS |
| **HA** | $150-300/月 | 5K-50K/日 | ASG + Multi-AZ RDS | App Gateway + HA DB | ESS + Multi-AZ RDS |
| **Elastic** | $250-600/月 | 50K-500K/日 | ASG + ElastiCache + CloudFront | VMSS + Redis + CDN | ESS + Redis + CDN |
| **Serverless** | $0-100/月 | 可変 | Lambda + API Gateway | Functions + API Mgmt | FC + API Gateway |
| **Container** | $300+/月 | 50K-1M+/日 | EKS + ECR | AKS + ACR | ACK + ACR |

#### ワークフロー

```
Phase 1: 要件ヒアリング    → プロジェクト検出、予算/トラフィック/DB/セキュリティを質問
                            Enterprise セキュリティ？ → /architecture で ADR 設計を自動実行
Phase 2: 設計 & 承認       → アーキテクチャ推薦、コスト見積表示、ユーザー承認取得
Phase 3A: インフラ構築     → IaC テンプレート生成＆検証、CLI またはコンソールでデプロイ
Phase 3B: コードデプロイ   → デプロイスクリプト生成、SCP/Docker/kubectl/CLI 実行
Phase 3C: 検証 & 自動修復  → ヘルスチェック → エラー診断 → 自動修復 → 再デプロイ（ループ）
Phase 3D: レポート         → アクセス URL 付きデプロイレポート生成
```

> **自動リカバリ:** Phase 3C の検証でエラーが検出された場合（HTTP 障害、サービスクラッシュ、リソース設定ミス）、WinClaw が自動的にログを分析し、根本原因を特定して修正を適用し、再デプロイを実行します。すべてのヘルスチェックに合格するまでこのサイクルを繰り返します。手動操作が必要な場合（DNS 設定、IAM 権限など）は、ステップバイステップのガイダンスを提示し、迅速な解決のために最小限のユーザー協力を求めます。

#### 前提条件 — クラウド CLI 認証の事前設定

**これらのスキルを使用する前に、クラウド CLI の認証設定が必要です。** WinClaw はクレデンシャルの入力を求めません — ターミナル環境で事前に設定してください。

| プロバイダー | 認証コマンド | 確認コマンド |
|-------------|------------|------------|
| AWS | `aws configure`（Access Key + Secret Key） | `aws sts get-caller-identity` |
| Azure | `az login`（ブラウザ SSO 認証） | `az account show` |
| Alibaba Cloud | `aliyun configure`（Access Key + Secret Key） | `aliyun sts GetCallerIdentity` |

> **セキュリティ注意:** クレデンシャルを WinClaw Chat に直接貼り付けないでください。認証は必ずクラウドプロバイダーの CLI ツールを使ってターミナルで設定してください。WinClaw は CLI 環境から事前設定済みのクレデンシャルを読み取り、保存することはありません。

#### 使い方

1. **開始** — WinClaw に伝える：*「AWS にデプロイして」*（Azure / Alibaba Cloud も同様）
2. **質問に回答** — WinClaw がプロジェクトを検出し、予算・トラフィック・DB・セキュリティ要件を質問
3. **セキュリティ設計** *（必要時）* — エンタープライズ要件がある場合、`/architecture` を自動呼び出しし、WAF・KMS・IAM・脅威検知・コンプライアンスを設計
4. **設計レビュー** — 推奨アーキテクチャとコスト内訳を確認。承認または調整
5. **デプロイ** — WinClaw がインフラテンプレートを生成し、リソースをプロビジョニングし、コードをデプロイ
6. **自動検証 & 修復** — ヘルスチェックを実行し、エラー検出時は自動診断・修復・再デプロイ。手動操作が必要な場合のみユーザーに簡単な協力を依頼

```
あなた：  Express アプリを AWS にデプロイして、予算は月 $100 くらい
WinClaw:  Node.js/Express プロジェクトを検出しました（ポート 3000）。
          最適なアーキテクチャを設計するため、いくつか質問します…
          [トラフィック、データベース、セキュリティについて質問]
          …
          推奨: Standard パターン（EC2 + ALB + RDS MySQL）
          推定コスト: $71.62/月 — 承認しますか？
あなた：  はい、デプロイして
WinClaw:  [CloudFormation 生成 → スタックデプロイ → コード SCP → ヘルスチェック]
          ⚠ ヘルスチェックで HTTP 502 を検出 — 調査中…
          原因: PM2 起動失敗（ecosystem.config.js 不足）
          [自動修復: 設定ファイル生成 → 再デプロイ → 再チェック]
          ✅ すべてのヘルスチェックに合格しました！
          デプロイ完了！アクセス URL: http://my-app-alb-123.us-east-1.elb.amazonaws.com/
```

---

## 組み込みプラグイン

WinClaw には **18 個のビルトインプラグイン** が搭載されており、15 の専門分野をカバーしています — **88 個のスラッシュコマンド**、**90 以上の AI スキル**、**40 以上の MCP 連携** がすぐに使えます。チャットで一言伝えるか、設定ファイルを 1 行変更するだけで有効化できます。

### クイックスタート

**方法 A — 自然言語**（チャットで入力するだけ）：
```
あなた：  sales プラグインを有効にして
AI：      有効化しました！3 つのコマンドと 6 つのスキルが使えます。
          /sales:draft-outreach で見込み客の調査とアウトリーチ文面の作成ができます。
```

**方法 B — 設定ファイル**（`winclaw.json`）：
```json
{
  "plugins": {
    "entries": {
      "data": { "enabled": true },
      "sales": { "enabled": true },
      "bio-research": { "enabled": true }
    }
  }
}
```

### プラグインカタログ

#### ビジネス基盤

<details>
<summary><b>productivity</b> — タスク管理とセッション横断の記憶保持</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/start` | 生産性ダッシュボードの初期化とタスク同期 |
| コマンド | `/update` | 現在のアクティビティからタスクとメモリを更新 |
| スキル | task-management | TASKS.md を使ったタスク追跡とステータス更新 |
| スキル | memory-management | セッション横断の 2 層メモリシステム |

MCP: Slack, Notion, Asana, Linear, Monday, Atlassian, Google Calendar, Gmail
</details>

<details>
<summary><b>data</b> — SQL 生成、データ探索、ダッシュボード、可視化</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/analyze` | クイック検索から詳細分析までデータ質問に回答 |
| コマンド | `/build-dashboard` | インタラクティブな HTML ダッシュボードを構築 |
| コマンド | `/create-viz` | Python で出版品質のビジュアライゼーションを作成 |
| コマンド | `/explore-data` | データセットのプロファイリング — 分布・異常値 |
| コマンド | `/validate` | 共有前の分析を QA チェック |
| コマンド | `/write-query` | 最適化された SQL をベストプラクティスで生成 |
| スキル | sql-queries | 主要データベース全対応の正確・高速な SQL |
| スキル | data-exploration | データセットの形状と品質を探索 |
| スキル | data-visualization | Python（matplotlib, plotly）で効果的なチャート作成 |
| スキル | interactive-dashboard-builder | 自己完結型の対話型 HTML ダッシュボード構築 |
| スキル | statistical-analysis | 記述統計、仮説検定、回帰分析 |
| スキル | data-validation | 方法論・正確性・完全性の検証 |
| スキル | data-context-extractor | 企業固有のデータ分析コンテキスト生成 |

MCP: Snowflake, Databricks, BigQuery, Hex, Amplitude, Atlassian
</details>

<details>
<summary><b>finance</b> — 財務諸表、差異分析、勘定照合、監査対応</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/income-statement` | 期間比較付き損益計算書の生成 |
| コマンド | `/journal-entry` | 借方・貸方が適切な仕訳伝票の作成 |
| コマンド | `/reconciliation` | GL と補助元帳・銀行口座の照合 |
| コマンド | `/sox-testing` | SOX サンプル選定・テストワークペーパー生成 |
| コマンド | `/variance-analysis` | ドライバー別の差異分解とナラティブ |
| スキル | financial-statements | 損益計算書、貸借対照表、キャッシュフロー |
| スキル | variance-analysis | ドライバー別の差異分解と説明 |
| スキル | reconciliation | GL と補助元帳・銀行記録の照合 |
| スキル | journal-entry-prep | 証憑付き適正な仕訳伝票作成 |
| スキル | audit-support | SOX 404 準拠テストとサンプル選定 |
| スキル | close-management | 月次決算タスクの順序管理と追跡 |

MCP: Snowflake, Databricks, BigQuery, Slack, Google Calendar, Gmail
</details>

<details>
<summary><b>operations</b> — プロセス最適化、ベンダー管理、リスク評価</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/capacity-plan` | リソース需要の予測と配分 |
| コマンド | `/change-request` | 変更管理リクエストの起案・追跡 |
| コマンド | `/process-doc` | 業務手順のステップ別ドキュメント化 |
| コマンド | `/runbook` | 繰り返し作業用のランブック作成 |
| コマンド | `/status-report` | 業務ステータスレポートの生成 |
| コマンド | `/vendor-review` | ベンダーパフォーマンスの評価・比較 |
| スキル | process-optimization | ボトルネック特定と改善提案 |
| スキル | vendor-management | ベンダーの評価・比較・管理 |
| スキル | risk-assessment | 重大度と緩和策付きのリスク評価 |
| スキル | resource-planning | キャパシティ計画とリソース配分 |
| スキル | change-management | 組織変更の構造化と追跡 |
| スキル | compliance-tracking | コンプライアンス要件の監視 |

MCP: Slack, ServiceNow, Asana, Atlassian, Notion, Google Calendar, Gmail
</details>

#### 顧客対応

<details>
<summary><b>sales</b> — パイプライン管理、見込み客調査、パーソナライズドアウトリーチ</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/call-summary` | 通話メモやトランスクリプトからアクション抽出 |
| コマンド | `/forecast` | 加重売上予測（最良/予想/最悪） |
| コマンド | `/pipeline-review` | パイプライン健全性分析 — 優先順位とリスク |
| スキル | draft-outreach | 見込み客を調査してパーソナライズメッセージ作成 |
| スキル | account-research | 企業調査とアクショナブルな営業インサイト |
| スキル | call-prep | 参加者プロフィールとトークポイントで通話準備 |
| スキル | competitive-intelligence | 競合調査とバトルカード作成 |
| スキル | create-an-asset | テーラードな営業資料（デッキ、LP）生成 |
| スキル | daily-briefing | 優先度付き営業ブリーフィングで1日をスタート |

MCP: HubSpot, Clay, ZoomInfo, Apollo, Slack, Notion, Outreach, Gmail
</details>

<details>
<summary><b>customer-support</b> — チケットトリアージ、回答作成、エスカレーション、KB 記事</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/draft-response` | プロフェッショナルな顧客向け回答の下書き |
| コマンド | `/escalate` | エンジニアリングやプロダクトへのエスカレーション |
| コマンド | `/kb-article` | 解決済み問題から KB 記事を作成 |
| コマンド | `/research` | 顧客質問のマルチソースリサーチ |
| コマンド | `/triage` | サポートチケットの分類・優先順位付け・ルーティング |
| スキル | ticket-triage | 緊急度別にチケットを分類し適切なチームへルーティング |
| スキル | response-drafting | 共感的でプロフェッショナルな顧客返信の作成 |
| スキル | escalation | エンジニアリング向けエスカレーションパッケージ構築 |
| スキル | customer-research | ドキュメント・ログ・CRM 横断でコンテキスト調査 |
| スキル | knowledge-management | 解決済み問題をセルフサービスコンテンツに変換 |

MCP: Slack, Intercom, HubSpot, Guru, Atlassian, Notion, Gmail
</details>

<details>
<summary><b>marketing</b> — キャンペーン企画、コンテンツ制作、SEO、パフォーマンス分析</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/brand-review` | ブランドボイスとスタイルガイドに対するコンテンツレビュー |
| コマンド | `/campaign-plan` | チャネルとタイムライン付きキャンペーンブリーフ生成 |
| コマンド | `/competitive-brief` | 競合調査とポジショニング分析 |
| コマンド | `/draft-content` | ブログ、SNS、メール、ニュースレターの下書き |
| コマンド | `/email-sequence` | マルチメールのナーチャーシーケンス設計 |
| コマンド | `/performance-report` | 主要指標付きマーケティングパフォーマンスレポート |
| コマンド | `/seo-audit` | キーワードリサーチ・オンページ監査・最適化 |
| スキル | campaign-planning | 目的・対象・チャネル付きキャンペーン計画 |
| スキル | content-creation | 全チャネル向けマーケティングコンテンツ制作 |
| スキル | brand-voice | 一貫したブランドボイスとメッセージの適用 |
| スキル | competitive-analysis | ポジショニング・メッセージ・戦略の比較 |
| スキル | performance-analytics | 指標・トレンド・ROI の分析 |

MCP: Canva, HubSpot, Ahrefs, Klaviyo, Figma, Amplitude, Notion, Slack
</details>

#### プロダクト & 開発

<details>
<summary><b>product-management</b> — 機能仕様、ロードマップ、ユーザーリサーチ、ステークホルダー報告</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/competitive-brief` | 競合分析ブリーフの作成 |
| コマンド | `/metrics-review` | トレンド付きプロダクト指標のレビュー |
| コマンド | `/roadmap-update` | ロードマップの更新・再優先順位付け |
| コマンド | `/sprint-planning` | スプリント作業の計画と構造化 |
| コマンド | `/stakeholder-update` | 対象に合わせたステークホルダーアップデート |
| コマンド | `/synthesize-research` | インタビュー・アンケートからリサーチ統合 |
| コマンド | `/write-spec` | 問題文から機能仕様書・PRD を作成 |
| スキル | feature-spec | 受入基準付き構造化 PRD の作成 |
| スキル | roadmap-management | RICE/MoSCoW フレームワークで優先順位付け |
| スキル | user-research-synthesis | 定性・定量リサーチの統合 |
| スキル | competitive-analysis | 機能比較マトリクスとポジショニング |
| スキル | metrics-tracking | プロダクト指標の定義・追跡・分析 |
| スキル | stakeholder-comms | 対象別アップデート（経営・開発・営業） |

MCP: Linear, Amplitude, Pendo, Figma, Slack, Atlassian, Notion, Intercom
</details>

<details>
<summary><b>engineering</b> — コードレビュー、システム設計、インシデント対応、ドキュメント</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/architecture` | トレードオフ分析付きシステムアーキテクチャ設計 |
| コマンド | `/debug` | 根本原因分析による体系的デバッグ |
| コマンド | `/deploy-checklist` | デプロイ前チェックリストの生成 |
| コマンド | `/incident` | インシデント対応とポストモーテムの構造化 |
| コマンド | `/review` | セキュリティ・パフォーマンスチェック付きコードレビュー |
| コマンド | `/standup` | 直近のアクティビティからスタンドアップサマリー生成 |
| スキル | system-design | アーキテクチャ図付きスケーラブルシステム設計 |
| スキル | code-review | 正確性とセキュリティの徹底コードレビュー |
| スキル | incident-response | 構造化インシデント対応とブレイムレスポストモーテム |
| スキル | documentation | コードからの技術ドキュメント自動生成 |
| スキル | tech-debt | 技術的負債の特定と優先順位付け |
| スキル | testing-strategy | 包括的テスト戦略の設計 |

MCP: GitHub, PagerDuty, Datadog, Linear, Slack, Atlassian, Notion
</details>

<details>
<summary><b>design</b> — アクセシビリティ監査、UX ライティング、デザインクリティーク、開発ハンドオフ</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/accessibility` | WCAG アクセシビリティ監査の実行 |
| コマンド | `/critique` | 構造化されたデザインフィードバック |
| コマンド | `/design-system` | デザインシステムコンポーネントの管理・文書化 |
| コマンド | `/handoff` | ピクセルパーフェクトな開発ハンドオフ仕様書の生成 |
| コマンド | `/research-synthesis` | UX リサーチ結果の統合 |
| コマンド | `/ux-copy` | マイクロコピーと UI テキストの作成・レビュー |
| スキル | accessibility-review | WCAG 準拠監査と修正提案 |
| スキル | design-critique | デザイン原則に基づく構造化クリティーク |
| スキル | design-handoff | トークン・スペーシング・ステート付き開発向け仕様書 |
| スキル | design-system-management | コンポーネントライブラリの文書化・保守 |
| スキル | user-research | ユーザーリサーチをアクショナブルなインサイトに統合 |
| スキル | ux-writing | 明確で一貫性のある UI コピーの作成 |

MCP: Figma, Linear, Slack, Asana, Atlassian, Notion, Intercom
</details>

#### 専門分野

<details>
<summary><b>legal</b> — 契約レビュー、NDA トリアージ、コンプライアンスチェック、法務ブリーフ</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/brief` | コンテキスト付き法務ブリーフィングの生成 |
| コマンド | `/compliance-check` | GDPR、CCPA、規制コンプライアンスチェック |
| コマンド | `/respond` | テンプレート化された法務回答の生成 |
| コマンド | `/review-contract` | 交渉プレイブックに基づく契約レビュー |
| コマンド | `/signature-request` | 署名リクエストパッケージの準備 |
| コマンド | `/triage-nda` | NDA を GREEN / YELLOW / RED に分類 |
| コマンド | `/vendor-check` | 既存ベンダー契約のステータス確認 |
| スキル | contract-review | 自社基準に基づく契約レビュー |
| スキル | nda-triage | NDA スクリーニング — 標準（GREEN）or 要レビュー（RED） |
| スキル | compliance | GDPR、CCPA、プライバシー規制のナビゲーション |
| スキル | legal-risk-assessment | 緩和策付きリスク重大度評価 |
| スキル | meeting-briefing | 法務ミーティング用ブリーフィング準備 |
| スキル | canned-responses | よくある問い合わせへのテンプレート回答生成 |

MCP: Box, DocuSign, Egnyte, Atlassian, Slack, Google Calendar, Gmail
</details>

<details>
<summary><b>human-resources</b> — 採用、報酬分析、オンボーディング、パフォーマンスレビュー</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/comp-analysis` | 市場データに基づく報酬ベンチマーク |
| コマンド | `/draft-offer` | コンプライアンス準拠のオファーレター作成 |
| コマンド | `/onboarding` | 構造化されたオンボーディングプランの作成 |
| コマンド | `/people-report` | ピープルアナリティクスレポートの生成 |
| コマンド | `/performance-review` | パフォーマンスレビューの構造化 |
| コマンド | `/policy-lookup` | 社内ポリシー検索と HR 質問への回答 |
| スキル | interview-prep | スコアカード付き面接計画の構造化 |
| スキル | compensation-benchmarking | 市場データに基づく給与ベンチマーク |
| スキル | recruiting-pipeline | 採用パイプラインの追跡と最適化 |
| スキル | org-planning | 組織構造とヘッドカウントの計画 |
| スキル | people-analytics | 定着率・エンゲージメント・人員指標の分析 |
| スキル | employee-handbook | 従業員ハンドブックポリシーの起案・保守 |

MCP: Slack, Google Calendar, Gmail, Notion, Atlassian
</details>

<details>
<summary><b>enterprise-search</b> — 全社ツールを一括検索</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/digest` | ツール横断のアクティビティ日次/週次ダイジェスト |
| コマンド | `/search` | 接続された全ソースを一括検索 |
| スキル | search-strategy | 複雑なクエリをマルチソース検索に分解 |
| スキル | knowledge-synthesis | 検索結果を統合してサマリーを生成 |
| スキル | source-management | 接続 MCP データソースの管理・設定 |

MCP: Slack, Notion, Guru, Atlassian, Asana, Google Calendar, Gmail
</details>

<details>
<summary><b>bio-research</b> — 文献検索、臨床試験、ゲノミクス、ラボデータ分析</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/start` | バイオリサーチ環境のセットアップと利用可能ツールの確認 |
| スキル | scientific-problem-selection | 研究課題の選定と優先順位付けを支援 |
| スキル | single-cell-rna-qc | scanpy によるシングルセル RNA-seq データの QC |
| スキル | scvi-tools | scvi-tools によるシングルセル解析のディープラーニング |
| スキル | nextflow-development | nf-core バイオインフォパイプライン（rnaseq, sarek）実行 |
| スキル | instrument-data-to-allotrope | ラボ機器出力を Allotrope 形式に変換 |

MCP: PubMed, bioRxiv, ChEMBL, ClinicalTrials.gov, Open Targets, Benchling, Synapse
</details>

#### パートナー連携

<details>
<summary><b>apollo</b> — Apollo API によるリードエンリッチメント、プロスペクティング、シーケンスロード</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| スキル | prospect | ICP を自然言語で記述 → ランク付きリードを取得 |
| スキル | enrich-lead | 名前・メール・LinkedIn URL からコンタクトをエンリッチ |
| スキル | sequence-load | コンタクトの検索・エンリッチ・シーケンスへの登録を一括実行 |

MCP: Apollo
</details>

<details>
<summary><b>brand-voice</b> — 既存素材からブランドガイドラインを自動生成・適用</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/discover-brand` | ドキュメント・通話・チャットからブランドシグナルを発見 |
| コマンド | `/enforce-voice` | AI 生成コンテンツにブランドガイドラインを適用 |
| コマンド | `/generate-guidelines` | 既存素材からブランドボイスガイドラインを生成 |
| スキル | discover-brand | Notion, Drive, Gong, Slack 横断でブランドシグナル検索 |
| スキル | guideline-generation | ブランド素材を実行可能なガイドラインに凝縮 |
| スキル | brand-voice-enforcement | 全 AI 生成コンテンツにガイドラインを適用 |

MCP: Notion, Figma, Gong, Atlassian, Box
</details>

<details>
<summary><b>common-room</b> — プロダクト利用・エンゲージメント・インテントシグナルからの GTM インテリジェンス</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/generate-account-plan` | シグナルデータから戦略的アカウントプランを作成 |
| コマンド | `/weekly-brief` | 今後の通話に向けた週次ブリーフィング生成 |
| スキル | account-research | リアルなエンゲージメントデータでアカウント調査 |
| スキル | contact-research | 複数シグナルからコンタクトプロフィールを構築 |
| スキル | call-prep | 参加者プロフィールとトークポイントで通話準備 |
| スキル | prospect | シグナルデータからターゲット見込みリスト構築 |
| スキル | compose-outreach | メールと LinkedIn でパーソナライズドアウトリーチ作成 |
| スキル | weekly-prep-brief | 今後の全通話に向けた週次ブリーフィング |

MCP: Common Room
</details>

<details>
<summary><b>slack</b> — Slack API によるチャネルダイジェスト、スタンドアップ、メッセージ作成</summary>

| 種別 | 名前 | 機能 |
|------|------|------|
| コマンド | `/channel-digest` | 指定期間のチャネルアクティビティをサマリー |
| コマンド | `/draft-announcement` | チームアナウンスメントの下書き |
| コマンド | `/find-discussions` | チャネル横断で関連ディスカッションを検索 |
| コマンド | `/standup` | Slack アクティビティからスタンドアップサマリー生成 |
| コマンド | `/summarize-channel` | チャネルの要約を作成 |
| スキル | slack-messaging | Slack メッセージとスレッドの送信・管理 |
| スキル | slack-search | Slack チャネルと会話を横断検索 |

MCP: Slack
</details>

### プラグイン使用例

**最適化 SQL の生成**（data プラグイン）：
```
あなた：  今四半期の売上トップ 10 顧客を抽出するクエリを書いて
AI：      /data:write-query — Snowflake 向けに最適化したクエリです：
          SELECT customer_id, SUM(amount) as total_revenue
          FROM orders WHERE order_date >= DATE_TRUNC('quarter', CURRENT_DATE)
          GROUP BY customer_id ORDER BY total_revenue DESC LIMIT 10;
          インデックスヒントとパーティションプルーニングを追加しました。
```

**NDA のトリアージ**（legal プラグイン）：
```
あなた：  新しいベンダーからの NDA をレビューして
AI：      /legal:triage-nda — 分類: GREEN（標準条項）。
          期間: 2 年、双方向義務、標準的な除外条項。
          注意: 第 7 条の競業避止が通常より広範。
          推奨: 直接的な競合他社に限定するよう交渉してください。
```

**臨床試験の検索**（bio-research プラグイン）：
```
あなた：  ペムブロリズマブの肺がん臨床試験を検索して
AI：      /bio-research:start — PubMed + ClinicalTrials.gov を検索中...
          47 件の募集中 Phase III 試験を発見。上位結果：
          | NCT ID | デザイン | 登録 | ステータス |
          | NCT04567890 | 化学療法併用 | n=800 | 募集中 |
          | NCT04891234 | 術後補助 | n=1200 | 募集中 |
          エンドポイント分析または関連 PubMed 論文の検索を行いますか？
```

**営業リードの発掘**（apollo プラグイン）：
```
あなた：  ベイエリアの Series B SaaS 企業の VP Engineering を検索して
AI：      Apollo を検索中... 12 件のマッチングコンタクトを発見（適合度順）：
          | 名前 | 役職 | 企業 | 従業員数 | 資金調達 |
          | Jane Smith | VP Eng | Acme AI | 150 | Series B |
          | ...
          エンリッチメントまたはシーケンスへのロードを実行しますか？
```

**キャンペーン企画**（marketing プラグイン）：
```
あなた：  新しい API 機能のプロダクトローンチキャンペーンを計画して
AI：      /marketing:campaign-plan — マルチチャネルキャンペーンブリーフ：
          目標: 30 日間で 500 件の API サインアップ
          チャネル: メールシーケンス（3 回）、ブログ、SNS、ウェビナー
          タイムライン: 第 1 週ティーザー → 第 2 週ローンチ → 第 3-4 週ナーチャー
          KPI: サインアップ数、アクティベーション率、ドキュメントPV
```

**オペレーションリスク評価**（operations プラグイン）：
```
あなた：  決済システムの新プロバイダーへの移行リスクを評価して
AI：      /operations:risk-assessment — リスクマトリクス：
          | リスク | 重大度 | 可能性 | 緩和策 |
          | 移行中のデータ損失 | 高 | 低 | 30 日間の並行運用 |
          | API ダウンタイム | 中 | 中 | フィーチャーフラグ + ロールバック |
          | コンプライアンスギャップ | 高 | 低 | 移行前監査 |
          総合: MEDIUM — 並行運用付き段階的ロールアウトを推奨。
```

---

## 設定

### 設定ファイルパス

| プラットフォーム                  | パス                                  |
| --------------------------------- | ------------------------------------- |
| Windows（全インストール方法共通） | `%USERPROFILE%\.winclaw\winclaw.json` |
| macOS / Linux                     | `~/.winclaw/winclaw.json`             |

環境変数 `WINCLAW_CONFIG_PATH` または `WINCLAW_STATE_DIR` で任意のパスに上書き可能です。

Windows 上の主要な設定ファイル:

| ファイル         | パス                                                          | 用途                                            |
| ---------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| メイン設定       | `%USERPROFILE%\.winclaw\winclaw.json`                         | Gateway、チャネル、スキル、エージェント設定     |
| 認証プロファイル | `%USERPROFILE%\.winclaw\agents\main\agent\auth-profiles.json` | AI プロバイダートークン（Anthropic、OpenAI 等） |
| チャネル認証情報 | `%USERPROFILE%\.winclaw\credentials\`                         | WhatsApp セッション等のチャネル認証データ       |
| セッション履歴   | `%USERPROFILE%\.winclaw\agents\main\sessions\`                | 会話セッション履歴                              |

### 最小設定例

```json
{
  "gateway": {
    "mode": "local",
    "port": 18789,
    "auth": {
      "mode": "token",
      "token": "<自動生成されたトークン>"
    }
  },
  "agent": {
    "model": "claude-opus-4-6"
  }
}
```

> **注記:** オンボーディングウィザードがこの設定を自動的に生成します。手動編集は高度なカスタマイズの場合のみ必要です。

### 主要設定項目

| セクション | 説明                                                   |
| ---------- | ------------------------------------------------------ |
| `auth`     | モデルプロバイダー認証（OAuth / API キー）             |
| `models`   | モデル選択、エイリアス、フェイルオーバー               |
| `agents`   | エージェント設定（ワークスペース、ツール、プロンプト） |
| `channels` | チャネル接続設定（WhatsApp, Telegram, Slack 等）       |
| `gateway`  | Gateway ポート、バインド、認証、Tailscale              |
| `skills`   | スキルの有効化、読み込み、インストール設定             |
| `tools`    | ブラウザ制御、ノード、Cron 等のツール設定              |
| `session`  | セッションプルーニング、コンパクション                 |
| `memory`   | ベクトルメモリ設定                                     |
| `hooks`    | メッセージフック（トランスクリプション等）             |

### ダイナミックスキルフィルタリング

大量のスキル（100 以上）がある場合、`skills.dynamicFilter` でコンテキストオーバーフローを防止できます:

```json
{
  "skills": {
    "dynamicFilter": {
      "mode": "auto",
      "maxSkills": 50,
      "alwaysInclude": ["github", "slack"]
    }
  }
}
```

モード: `off`（デフォルト）/ `auto`（100 超で有効化）/ `on`（常時有効）

## プラグインシステム

WinClaw はプラグインアーキテクチャによる Gateway 機能の拡張をサポートしています。
プラグインは `extensions/` ディレクトリに配置され、設定ファイルの `plugins.entries` で有効化します。

### MCP Bridge プラグイン

**MCP Bridge** プラグイン（`extensions/mcp-bridge/`）は、外部の
[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) サーバーを
WinClaw エージェントのツールとして統合します。ブラウザ自動化、データベースアクセス、
カスタム API など、MCP 互換のツールサーバーを自然な会話から直接利用できます。

**主な機能:**

- **stdio**（サブプロセス）と **SSE**（HTTP）の両方の MCP トランスポートに対応
- 自動再接続（リトライ回数設定可）
- ツール呼び出しは `mcp__<サーバー名>__<ツール名>` の命名規則でネームスペース化
- Chrome タブ保護: `before_tool_call` フックにより危険な操作（タブの閉鎖、Chrome の終了、ユーザータブへのナビゲーション）をブロック

**設定例:**

```json
{
  "plugins": {
    "entries": {
      "mcp-bridge": {
        "enabled": true,
        "servers": [
          {
            "name": "chrome-devtools",
            "transport": "stdio",
            "command": "npx",
            "args": ["-y", "@anthropic/chrome-devtools-mcp@latest"]
          }
        ]
      }
    }
  }
}
```

### デスクトップアプリ操作（VNC + MCP）

**desktop-app-control** スキルにより、AI アシスタントが VNC + Chrome DevTools MCP
パイプラインを通じてネイティブデスクトップアプリケーション（Windows / macOS）を操作できます。
アプリの起動、ボタンクリック、テキスト入力、メニュー操作、スクリーンショット取得が、
すべて自然言語コマンドで実行可能です。

**アーキテクチャ:** ユーザーリクエスト → WinClaw エージェント → `mcp__chrome_devtools__*`
ツール → Chrome DevTools Protocol → noVNC タブ → websockify → VNC サーバー →
デスクトップ

**前提条件:**

- MCP Bridge プラグインが有効（`chrome-devtools` サーバーを設定）
- VNC サーバーが稼働中（Windows: TightVNC、macOS: 画面共有）
- websockify + noVNC（ブラウザベースの VNC アクセス用）
- Chrome を `--remote-debugging-port` 付きで起動（ポートは自動選択）

**安全な Chrome デバッグ:** 同梱の `scripts/ensure-chrome-debug.ps1` スクリプトで、
既存のブラウザセッションを中断せずに Chrome リモートデバッグを安全に有効化できます。
スクリプトはポート **9222-9229** を自動スキャンし、最初の空きポートを使用するため、
ポート競合を気にする必要はありません。

---

## Windows 固有機能

### Windows ネイティブスキル

Windows 専用の組み込みスキルが用意されています:

| スキル             | 説明                                                                                                          | 前提条件          |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------- |
| `windows-office`   | Word, Excel, PowerPoint の作成・編集（python-docx, openpyxl, python-pptx）。COM 経由で PDF エクスポートも可能 | Python 3, pip     |
| `windows-system`   | サービス、プロセス、レジストリ、イベントログ、タスクスケジューラの管理                                        | PowerShell        |
| `windows-explorer` | ファイル検索、一括リネーム、圧縮、クリップボード操作                                                          | PowerShell        |
| `windows-outlook`  | Outlook COM 経由でメール送受信・検索                                                                          | Python 3, Outlook |

### PowerShell スクリプトサポート

WinClaw の exec ツールは PowerShell スクリプトをネイティブに実行します。Windows スキルは PowerShell cmdlet を活用してシステム管理タスクを実行します。

### Windows パッケージマネージャー

スキルの依存関係インストール時に `skills.install.windowsPackageManager` で優先パッケージマネージャーを指定できます。
対応: `winget`、`scoop`、`choco`、`pip`

### Windows タスクスケジューラによるデーモン

Gateway はタスクスケジューラに `ONLOGON` トリガーで登録され、ログオン時に自動起動します。
タスク名は `WINCLAW_WINDOWS_TASK_NAME` 環境変数で上書き可能です。

```powershell
winclaw daemon install     # インストール
winclaw daemon stop        # 停止
winclaw daemon restart     # 再起動
winclaw daemon uninstall   # 削除
```

### WINCLAW_HOME と組み込み Node.js

EXE インストーラーは `WINCLAW_HOME` 環境変数を自動設定し、Node.js 22 LTS ランタイムを内蔵します。
ランチャー（`winclaw.cmd`）が組み込み Node.js でアプリを実行するため、システムの Node.js は不要です。

### デスクトップショートカット / スタートメニューランチャー

インストーラーが作成するデスクトップショートカットとスタートメニュー項目は `winclaw-ui.cmd` を実行します。このスクリプトは:

1. 初回セットアップが必要か確認（設定ファイルなし、または `gateway.mode` 未設定）
2. 必要な場合、オンボーディングウィザードを自動起動
3. Gateway を最小化ウィンドウで起動（未実行の場合）
4. デフォルトブラウザで Dashboard（`http://127.0.0.1:18789/`）を開く

### Windows トラブルシューティング

**「disconnected (1008): unauthorized: gateway token mismatch」**

Dashboard が Gateway と認証できていません。対処法:

```powershell
# トークン付きの正しい Dashboard URL を取得
winclaw dashboard --no-open
# 表示された URL をブラウザで開く
```

**Gateway が起動しない / ポート 18789 が応答しない**

```powershell
# Gateway の稼働確認
winclaw health

# デーモンステータス確認
winclaw daemon status

# デーモンを再起動
winclaw daemon restart

# または手動で起動
winclaw gateway --port 18789
```

**「OAuth token has expired」(HTTP 401)**

```powershell
# Anthropic に再認証
winclaw models auth login --provider anthropic

# または手動でトークンを追加
winclaw models auth add

# 現在の認証プロファイルを確認
winclaw models status
```

**Dashboard の Config が空 / 「Schema unavailable」と表示される**

Dashboard が Gateway に接続できていません。`winclaw dashboard` で正しいトークン付きの URL を開くか、オンボーディングウィザードを再実行してください:

```powershell
winclaw onboard --flow quickstart
```

**インストーラーが「Node.js JavaScript Runtime が使用中です」と表示**

以前の WinClaw Gateway プロセスが実行中です。インストーラーの画面で「自動的にアプリケーションを終了する」を選択するか、手動で停止してください:

```powershell
winclaw daemon stop
# または WinClaw の Node.js プロセスを強制終了
Get-Process -Name node | Where-Object { $_.Path -like '*WinClaw*' } | Stop-Process -Force
```

## チャネル設定

対応チャネルの概要:

| チャネル        | プロトコル          | 設定キー               |
| --------------- | ------------------- | ---------------------- |
| WhatsApp        | Baileys (Web API)   | `channels.whatsapp`    |
| Telegram        | grammY              | `channels.telegram`    |
| Slack           | Bolt for JS         | `channels.slack`       |
| Discord         | discord.js          | `channels.discord`     |
| Google Chat     | Chat API            | `channels.googlechat`  |
| Signal          | signal-cli          | `channels.signal`      |
| iMessage        | BlueBubbles（推奨） | `channels.bluebubbles` |
| Microsoft Teams | Extension           | `channels.msteams`     |
| Matrix          | Extension           | `channels.matrix`      |
| Zalo            | Extension           | `channels.zalo`        |
| WebChat         | 組み込み            | `web.webchat`          |

各チャネルは `enabled: true` と必要な認証情報を設定することで有効化されます。
DM ポリシーはデフォルトで `pairing`（ペアリングコード方式）に設定されており、未知の送信者からのメッセージは自動処理されません。

## スキルシステム

WinClaw のスキルは 3 つのカテゴリに分類されます:

| カテゴリ                   | 説明                 | 場所                           |
| -------------------------- | -------------------- | ------------------------------ |
| 内蔵 (Bundled)             | npm パッケージに同梱 | `skills/` ディレクトリ         |
| マネージド (Managed)       | ClawHub から取得     | `~/.winclaw/managed-skills/`   |
| ワークスペース (Workspace) | ユーザー定義         | `skills.load.extraDirs` で指定 |

スキルは `SKILL.md` ファイルで定義されます。各スキルにはメタデータ（名前、説明、OS 制限、依存関係）とツール使用例が含まれます。

### スキルの設定例

```json
{
  "skills": {
    "allowBundled": ["github", "slack", "windows-system"],
    "entries": {
      "github": { "enabled": true, "apiKey": "ghp_..." }
    },
    "install": {
      "nodeManager": "pnpm",
      "windowsPackageManager": "winget"
    }
  }
}
```

## チャットで設定（設定スキル）

WinClaw には 6 つの**設定スキル**が内蔵されており、Chat タブや接続済みメッセージングチャネルからの自然な会話だけで、すべての設定を行えます。設定ファイルを手動で編集する必要はありません。AI にやりたいことを伝えるだけです。

### 設定スキル一覧

| スキル               | アイコン | 機能                                                                       |
| -------------------- | -------- | -------------------------------------------------------------------------- |
| `winclaw-setup`      | ⚙️       | Gateway コア設定：ポート、認証トークン、TLS、AI モデル、テーマ、ログ       |
| `winclaw-channels`   | 🔗       | メッセージングチャネルの追加・削除・有効/無効切替、DM/グループポリシー管理 |
| `winclaw-agents`     | 🤖       | AI エージェントの作成・設定：モデル、性格、ワークスペース、思考レベル      |
| `winclaw-cron`       | ⏰       | 定期タスクのスケジュール：日次レポート、リマインダー、定期チェック         |
| `winclaw-status`     | 📊       | システム状態、使用統計、接続チャネル、アクティブセッション確認             |
| `winclaw-sns-wizard` | 📲       | 19 の対応プラットフォームのステップバイステップ接続ガイド                  |

### 使い方

ダッシュボードの **Chat** タブを開き（または接続済みチャネルからメッセージを送信して）、やりたいことを自然な言葉で伝えるだけです。AI が適切なスキルを自動的に呼び出し、Gateway API を通じて設定を適用します。

### 会話例

**初期セットアップ：**

```
あなた:  WinClaw の初期設定を手伝って
AI:      初期設定をガイドしますね。現在の設定を確認しています…
         Gateway はポート 18789 で動作中です。AI モデルを設定しましょう。
         どのプロバイダーを使いますか？
あなた:  Anthropic の Claude で
AI:      完了！agent.model を claude-sonnet-4-20250514 に設定しました。
         次にメッセージングチャネルを接続しますか？
```

**メッセージングプラットフォームの接続：**

```
あなた:  Telegram を接続したい
AI:      Telegram をステップバイステップで設定しましょう。
         1. Telegram で @BotFather を検索してください
         2. /newbot を送信して、画面の指示に従ってボットを作成
         3. ボットトークン（123456:ABC-DEF... のような形式）をコピー
         準備ができたらトークンを貼り付けてください。
あなた:  7891234567:AAH2kx9...
AI:      ✅ Telegram 接続完了！ボットがメッセージを受信できるようになりました。
         DM ポリシーの設定や許可ユーザーの追加は必要ですか？
```

**定期タスクのスケジュール：**

```
あなた:  毎朝8時に天気の要約を送って
AI:      そのためのクロンジョブを作成します。毎日 08:00 に
         「今日の天気概要を教えて」というプロンプトで実行するタスクを設定中…
         ✅ クロンジョブ作成完了！毎日午前 8 時に要約が届きます。
```

**システム状態の確認：**

```
あなた:  全部ちゃんと動いてる？接続状況を見せて
AI:      📊 システム状態:
         • Gateway: 正常（稼働時間 3 日 12 時間）
         • チャネル: WhatsApp ✅、Telegram ✅、Discord ❌（無効）
         • アクティブセッション: 4
         • モデル: claude-sonnet-4-20250514
         • 読み込み済みスキル: 23/50
```

**エージェントの管理：**

```
あなた:  「translator」という名前の新しいエージェントを GPT-4o で作って
AI:      gpt-4o を使用する ID「translator」の新しいエージェントを作成します。
         システムプロンプトや性格を設定しますか？
あなた:  うん、日英翻訳者にして
AI:      ✅ エージェント「translator」を翻訳特化のシステムプロンプトで作成しました。
         すぐに使えます。特定のチャネルに紐付けますか？
```

> **ヒント:** これらのスキルはキーワードマッチングで自動読み込みされます。やりたいことを自然に伝えるだけで、WinClaw が適切なスキルを選んでくれます。

---

## 開発（ソースから）

ソースからビルドする場合は `pnpm` を使用してください。

```bash
git clone https://github.com/itc-ou-shigou/winclaw.git
cd winclaw

pnpm install
pnpm ui:build
pnpm build

# 開発実行
pnpm winclaw onboard --install-daemon

# Gateway 開発モード（ファイル変更時自動リロード）
pnpm gateway:watch
```

主要な開発コマンド:

| コマンド         | 説明                          |
| ---------------- | ----------------------------- |
| `pnpm build`     | tsdown でプロダクションビルド |
| `pnpm test`      | ユニットテスト（並列実行）    |
| `pnpm test:e2e`  | E2E テスト                    |
| `pnpm test:live` | ライブモデルテスト            |
| `pnpm lint`      | oxlint による静的解析         |
| `pnpm format`    | oxfmt によるフォーマット      |
| `pnpm check`     | lint + format + 型チェック    |

技術スタック: ESM-only, Node.js 22+, TypeScript, pnpm monorepo, tsdown バンドラー, vitest テストフレームワーク

## Windows インストーラーのビルド

EXE インストーラーをソースからビルドする手順です。最終的なインストーラーは自動的なサイズ最適化により **100 MB 以内** に収まります。

### 前提条件

- [Inno Setup 6](https://jrsoftware.org/isinfo.php)（`winget install JRSoftware.InnoSetup`）
- Node.js 22+
- pnpm

### ビルド手順

```powershell
# フルビルド（pnpm build 含む）
.\scripts\package-windows-installer.ps1

# pnpm build をスキップ（既存のビルド成果物を再利用）
.\scripts\package-windows-installer.ps1 -SkipBuild

# インストーラーのみ再ビルド（既存のビルド成果物を再利用、pnpm build をスキップ）
.\scripts\rebuild-installer.ps1
```

ビルドプロセス:

1. Node.js 22 LTS ポータブル版を `dist/cache/` にダウンロード
2. `pnpm build` でプロダクションバンドルを生成（フルビルド時のみ）
3. `npm pack` でターボールを作成し `dist/win-staging/app/` に展開
4. **Bloat 除去**: `npm pack` が `package.json` の `files` フィールド経由で含む古いインストーラー EXE、ダウンロードキャッシュ、ステージングファイルを削除
5. **重量級オプショナルパッケージ削除**: GPU ランタイム（CUDA/Vulkan/ARM64）、`node-llama-cpp`、`@napi-rs/canvas`、`playwright-core`、`@lydell/node-pty`、型定義パッケージ（`@types`、`bun-types` 等）を削除。これらはインストール後に個別に追加可能
6. **node_modules トリミング**: テストスイート、ドキュメント、TypeScript ソース、ソースマップ等のランタイム不要ファイルを削除
7. Node.js ランタイム、ランチャースクリプト、WinClawUI デスクトップアプリ、アセットを `dist/win-staging/` にコピー
8. Inno Setup で `scripts/windows-installer.iss` を LZMA2/ultra64 ソリッド圧縮で `dist/WinClawSetup-{version}.exe` にコンパイル
9. インストーラーを `releases/` にコピー

Inno Setup のコンパイルは約 1〜2 分で完了します。生成されるインストーラーは通常 **約 84 MB** です。

## アーキテクチャ

```
WhatsApp / Telegram / Slack / Discord / Google Chat
Signal / iMessage / Microsoft Teams / Matrix / Zalo / WebChat
                        |
                        v
         +------------------------------+
         |           Gateway             |
         |       (コントロールプレーン)     |
         |     ws://127.0.0.1:18789      |
         +------+-----------+-----------+
                |           |           |
                v           v           v
          +----------+ +--------+ +---------+
          | Channels | | Skills | | Tools   |
          | (入出力)  | | (拡張)  | | (実行)   |
          +----------+ +--------+ +---------+
                |           |           |
                v           v           v
         +------------------------------+
         |       Pi Agent (RPC)          |
         |   Anthropic / OpenAI / etc.   |
         +------------------------------+
                |               |
         +------+------+ +-----+--------+
         |      |      | |   Plugins    |
         v      v      v |  MCP Bridge  |
      CLI  WebChat  Apps  +------+------+
                 (macOS/   |  MCP Servers |
                  iOS/     |  (DevTools,  |
                  Android) |   DB, etc.)  |
                           +-------------+
```

コンポーネント: **Gateway**（WS コントロールプレーン）、**Pi Agent**（AI ランタイム）、**Channels**（メッセージング接続）、**Skills**（拡張ツール）、**Tools**（ブラウザ/Cron/Webhook）、**Plugins**（MCP Bridge 等の拡張プラグイン）、**WebChat**（Web UI）、**Apps**（macOS/iOS/Android）

## セキュリティモデル

WinClaw は実際のメッセージングプラットフォームに接続するため、受信 DM は **信頼できない入力** として扱われます。

### DM ポリシー

| ポリシー                | 動作                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `pairing`（デフォルト） | 未知の送信者にペアリングコードを送信。`winclaw pairing approve` で承認後にメッセージ処理開始 |
| `open`                  | 全ての DM を処理（`allowFrom: ["*"]` と併用）                                                |

### Web インターフェース

Gateway の Web UI はローカル使用専用です。パブリックインターネットにバインドしないでください。
リモートアクセスが必要な場合は Tailscale Serve/Funnel または SSH トンネルを使用してください。

### セキュリティ監査

```bash
winclaw security audit --deep
winclaw doctor
```

### ランタイム要件

- **Node.js 22.12.0 以上** が必要です（重要なセキュリティパッチを含むため）
- Docker 使用時は非 root ユーザー（`node`）で実行し、`--cap-drop=ALL` を推奨

## ライセンス

[MIT License](LICENSE)

Copyright (c) WinClaw Contributors
