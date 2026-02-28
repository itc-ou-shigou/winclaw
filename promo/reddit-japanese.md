# 【OSS】Windows PCでClaude Code（AI開発ツール）を使いたい人へ — WinClaw を紹介します

**概要:** WinClaw は Claude Code（OpenClaw）の Windows 対応進化版です。EXEインストーラーで一発インストール、18個の業務自動化プラグイン（88コマンド + 90以上のAIスキル）、AI駆動の5段階Web自動テスト機能を搭載。OSSで無料です。

---

## こんな悩みありませんか？

- Web アプリの自動テストをしたいけど、テストスクリプトを書く時間がない
- Claude Code を使いたいけど、Windows に対応していない
- 営業レポート、契約書レビュー、月次決算…毎回同じ作業の繰り返し

## WinClaw とは？

Claude Code（現 OpenClaw）をベースに、Windows ユーザー向けに進化させたオープンソースツールです。

| 比較項目 | Claude Code | WinClaw |
|---------|------------|---------|
| 対応OS | macOS/Linux | **Windows + macOS + Linux** |
| インストール | npm手動設定 | **EXEインストーラー（Node.js内蔵）** |
| プラグイン | なし | **18個の業務プラグイン** |
| 業務自動化 | なし | **88コマンド + 90以上のAIスキル** |

### インストール方法

EXEをダウンロードして実行するだけ。Node.js 22ランタイム内蔵で前提条件ゼロ。

- **SourceForge**: https://sourceforge.net/projects/winclaw/files/WinClawSetup-2026.2.28.exe/download
- **GitHub**: https://github.com/itc-ou-shigou/winclaw/releases

### AI駆動Web自動テスト（最大の目玉機能）

5段階の完全自動テスト：

1. **コード静的解析** — フロント/バックエンドのセキュリティ・品質問題を検出
2. **コードレビュー + 自動修正** — AIが問題を修正、通過率95%以上まで最大15回反復
3. **APIテスト** — 全バックエンドAPIエンドポイントを自動テスト
4. **ブラウザUIテスト** — Chrome MCPで自動操作、ページ操作を検証
5. **ドキュメント生成** — テストレポート自動生成

AIが実際にブラウザを開いて、ボタンをクリックし、フォームに入力し、結果を検証します。

### 18個の業務プラグイン

- **ビジネス基盤**: productivity, data（SQL/ダッシュボード）, finance（財務諸表/SOX）, operations
- **顧客対応**: sales（パイプライン/アウトリーチ）, customer-support, marketing（キャンペーン/SEO）
- **プロダクト**: product-management, engineering, design
- **専門分野**: legal（契約/NDA）, human-resources, enterprise-search, bio-research（PubMed/臨床試験）
- **パートナー**: apollo, brand-voice, common-room, slack

### 無料LLM対応

Anthropic Claude だけでなく、無料のLLMプロバイダーにも対応：
- Google AI Studio（Gemini 2.5 Pro）
- Groq（Llama 3.3 70B — 超高速）
- OpenRouter、Ollama（完全オフライン）

## リンク

- **GitHub**: https://github.com/itc-ou-shigou/winclaw
- **Windows EXE**: https://sourceforge.net/projects/winclaw/files/WinClawSetup-2026.2.28.exe/download
- **npm**: `npm install -g winclaw`
- **ライセンス**: Apache-2.0（個人・商用とも無料）

Windows ユーザーでAI開発・業務自動化に興味がある方、ぜひ試してみてください！
