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

1. [GitHub Releases](https://github.com/itc-ou-shigou/winclaw/releases) から `WinClawSetup-{version}.exe` をダウンロード（リポジトリの [`releases/`](releases/) ディレクトリからも取得可能）
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
                        |
                +-------+-------+
                |       |       |
                v       v       v
             CLI    WebChat   Apps
                            (macOS/iOS/Android)
```

コンポーネント: **Gateway**（WS コントロールプレーン）、**Pi Agent**（AI ランタイム）、**Channels**（メッセージング接続）、**Skills**（拡張ツール）、**Tools**（ブラウザ/Cron/Webhook）、**WebChat**（Web UI）、**Apps**（macOS/iOS/Android）

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
