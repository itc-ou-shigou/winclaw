# 【OSS無料】WinClaw の AI 自動テスト機能が凄い — テストスクリプト不要で Web アプリを全自動テスト

**投稿先**: r/programming_jp, r/softwaretesting, r/webdev_ja

---

## はじめに

Web アプリの自動テストを導入したいけど、テストスクリプトを書く時間がない。E2E テストフレームワークの学習コストが高い。そんな悩みを抱えていた時に見つけたのが **WinClaw** の AI 自動テスト機能です。

実際に使ってみて驚いたのは、**テストスクリプトを一行も書かずに**、AIがソースコードを読み解き、ビジネスロジックを抽出し、テストデータを生成し、APIテストからブラウザUIテストまで全自動で実行してくれるところです。

## WinClaw とは

WinClaw は Claude Code（現 OpenClaw）をベースにした Windows 対応のオープンソースツールです。18個の業務自動化プラグイン（88コマンド + 90以上のAIスキル）を搭載していますが、中でも一番の目玉が **AI Dev System Testing** スキルです。

## テストの実行フロー（Phase 2 〜 Phase 6）

### Phase 2: コード静的解析

フロントエンドとバックエンドのソースコードを AI が自動スキャンします。セキュリティの脆弱性、コーディング規約違反、パフォーマンス問題などを検出し、レポートを生成します。

### Phase 3: コードレビュー + 自動修正 + ビジネスロジック抽出

ここが最も重要なフェーズです。AI がコードを深く分析し、以下の **6カテゴリのビジネスロジックパターン** を抽出します：

1. **Validation Rules（バリデーションルール）** — 入力検証、フォーマットチェック、必須フィールド
2. **State Machines（状態遷移）** — 注文ステータスの遷移、ワークフローの状態管理
3. **Authorization Patterns（認可パターン）** — ロールベースアクセス制御、リソースの所有権チェック
4. **Business Constraints（業務制約）** — 在庫上限、価格範囲、日付制約
5. **Error Handling Paths（エラーハンドリング）** — 異常系の処理フロー
6. **Conditional Business Logic（条件分岐ロジック）** — 割引計算、税率適用、会員ランク別処理

抽出したビジネスロジックは `business-logic-*.md` ファイルに保存され、後続のテストフェーズで活用されます。

さらに、コードレビューで発見された問題を AI が自動修正し、**通過率95%以上になるまで最大15回反復** します。

### Phase 5A: テストデータ生成

Phase 3 で抽出したビジネスロジックに基づいて、テストデータを自動生成します。正常系だけでなく、境界値や異常系のテストデータも含まれます。

### Phase 5B: API テスト（二層テストプロトコル）

バックエンドの全 API エンドポイントに対して、**二層構造のテストプロトコル** を実行します：

- **Layer 1（標準CRUDテスト）**: 全エンドポイントの作成・読取・更新・削除を網羅的にテスト
- **Layer 2（シナリオベーステスト）**: Phase 3 で抽出したビジネスロジックに基づく、シナリオ型のテスト（例：「在庫0の商品に対する注文処理」「管理者権限でないユーザーが管理画面にアクセス」）

テストが失敗した場合、AI が原因を分析し、コードを修正して再テスト。**最大15回の反復** で通過率を高めます。

### Phase 5C: ブラウザ UI テスト（二層テストプロトコル）

Chrome MCP（Claude in Chrome 拡張機能）を通じて、AI が実際にブラウザを操作します：

- **Layer 1**: 全ページの基本表示・ナビゲーション・フォーム操作をテスト
- **Layer 2**: ビジネスロジックに基づくシナリオテスト（例：「ログイン → 商品をカートに追加 → 在庫上限を超える数量を入力 → エラーメッセージを確認」）

AI が実際にボタンをクリックし、フォームに入力し、画面遷移を確認し、表示結果を検証します。

### Phase 6: ドキュメント生成

全フェーズのテスト結果を集約し、HTML形式のテストレポートを自動生成します。

## なぜテストが信頼できるのか

1. **ビジネスロジック駆動**: ランダムなテストではなく、実際のコードから抽出した6カテゴリのビジネスロジックに基づくテスト
2. **二層テストプロトコル**: 標準CRUDテスト + シナリオベーステストの二層構造で漏れを防止
3. **反復自動修正**: 失敗時に最大15回の修正ループで通過率を向上
4. **フレームワーク最適化**: Python-FastAPI、Java-Spring Boot、PHP-Laravel、Go-Zero、React-Next.js 向けのベストプラクティスを内蔵

## 導入方法

### 1. WinClaw のインストール

- **Windows EXE（推奨）**: [SourceForge からダウンロード](https://sourceforge.net/projects/winclaw/files/WinClawSetup-2026.2.30.exe/download)（Node.js 22 ランタイム内蔵、前提条件ゼロ）
- **GitHub**: https://github.com/itc-ou-shigou/winclaw/releases
- **npm**: `npm install -g winclaw`

### 2. Claude in Chrome のインストール

ブラウザUIテスト（Phase 5C）には **Claude in Chrome** 拡張機能が必要です。Chrome ウェブストアからインストールしてください。

### 3. GLM-5 で安く使う方法（推奨）

Anthropic の API や Pro サブスクリプション（月額$20）の代わりに、**智譜 GLM-5**（中国のLLM）を使えば無料枠で試せます。

**Windows での設定手順:**

1. [z.ai](https://z.ai/) でアカウント登録
2. API キーを取得
3. Windows の環境変数を設定：

```
set ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
set ANTHROPIC_AUTH_TOKEN=あなたのAPIキー
set ANTHROPIC_MODEL=glm-5
```

永続化する場合はシステム環境変数に追加：
```
setx ANTHROPIC_BASE_URL "https://api.z.ai/api/anthropic"
setx ANTHROPIC_AUTH_TOKEN "あなたのAPIキー"
setx ANTHROPIC_MODEL "glm-5"
```

## リンク

- **GitHub**: https://github.com/itc-ou-shigou/winclaw
- **Windows EXE**: https://sourceforge.net/projects/winclaw/files/WinClawSetup-2026.2.30.exe/download
- **npm**: `npm install -g winclaw`
- **ライセンス**: Apache-2.0（個人・商用とも完全無料）

テストスクリプトを書くのに疲れた方、ぜひ試してみてください！質問があればコメントで聞いてください。
