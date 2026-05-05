---
name: metacoder
description: "Large-scale software development via MetaCoder's semantic knowledge graph and multi-agent TDD. Three modes: /systest (test existing system), /modernize (legacy → web), /newproject (new development). Uses GRC-synced API keys automatically. Best for: game development, COBOL/AS400 modernization, complex web apps."
metadata:
  {
    "winclaw":
      {
        "emoji": "🧠",
        "os": ["linux"],
        "requires": { "bins": ["metacoder", "jq"] }
      }
  }
---

# MetaCoder Integration Skill

WinClaw から MetaCoder の 4 つの skill を呼び出します。

## 機能概要

| Skill | 用途 |
|-------|------|
| `/systest` | 既存プロジェクトのシステムテスト（API + E2E + 自動バグ修正、95%合格率目標） |
| `/modernize` | レガシーコード（COBOL/VB/AS-400/拡張子なし）→ 現代的 Web システムへ全面再構築 |
| `/newproject` | 要件定義書 → フロントエンド + バックエンド + テスト付き Web システム自動生成 |
| `/graph` | コードベースの意味的知識グラフ操作（status / rebuild / query） |

## API キーの自動継承

WinClaw の `winclaw.json` から GRC 配布済みの API キーを読み取って MetaCoder に渡します。

優先順位:
1. `models.providers.anthropic.apiKey` → `ANTHROPIC_API_KEY`
2. `models.providers.anthropic.baseUrl` → `ANTHROPIC_BASE_URL`（プロキシ使用時）
3. その他のプロバイダー（Gemini/OpenAI/etc）に apiKey があればフォールバック

## 使用方法

### 既存システムのテスト
```bash
metacoder-wrapper.sh systest \
  --workspace /workspace \
  --backend-url http://localhost:8000 \
  --frontend-url http://localhost:5173
```

### 新規プロジェクト開発
```bash
metacoder-wrapper.sh newproject \
  --requirements requirements.md \
  --output /workspace/new-game-mod
```

### レガシー移植
```bash
metacoder-wrapper.sh modernize \
  --workspace /workspace/legacy-cobol \
  --output /workspace/modernized
```

### 知識グラフ
```bash
metacoder-wrapper.sh graph status
metacoder-wrapper.sh graph rebuild
metacoder-wrapper.sh graph query "How is user authentication handled?"
```

## 永続化

`/home/winclaw/.metacoder/` のデータ（会話履歴、グラフキャッシュ、プロジェクト state）は
`/home/winclaw/.winclaw/config-persist/metacoder/` にバックアップされ、
コンテナの 換水（restart）後も保持されます。

## トラブルシューティング

### "No usable API key found"
GRC からの SSE config push がまだ届いていない可能性。`winclaw.json` を確認:
```bash
jq '.models.providers' /home/winclaw/.winclaw/winclaw.json
```

### グラフ rebuild が遅い
大規模プロジェクトでは初回 rebuild に数分かかります。プロジェクトサイズに応じて
`--max-files` 引数で制限可能。

## 関連ドキュメント

- 詳細: `references/usage-systest.md`, `usage-modernize.md`, `usage-newproject.md`
- API キーマッピング: `references/api-key-mapping.md`
