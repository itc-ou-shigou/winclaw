# MetaCoder × WinClaw 集成方案书

> **日期**: 2026-05-05
> **目的**: 在 WinClaw Docker image 中内置 MetaCoder，作为复杂开发任务（游戏开发/软件开发/大规模重构）的核心编程工具
> **基础**: MetaCoder v1.0.5 + WinClaw v2026.4.18+

---

## 1. 背景と目標

### 1.1 MetaCoder の核心価値（README_EN.md より）

| 機能 | 価値 |
|------|------|
| **Graphify Knowledge Graph** | コードベース全体を意味的知識グラフ化 → 大規模プロジェクトでも高精度な参照解決 |
| **3 Bundled Skills** | `/systest`（システムテスト）、`/modernize`（レガシー再構築）、`/newproject`（新規開発） |
| **Multi-Agent TDD** | PM + Coding + Reviewer + Tester の 4 役エージェント協調 |
| **Physical Completion Verification** | `.completion.json` + 実ファイル存在で AI の偽完了を防止 |
| **Best Practices Enforcement** | 言語別ベストプラクティスを Coding/Reviewer に自動適用 |
| **Resume Mode** | 中断したセッションの自動再開 |

### 1.2 統合のメリット

1. **WinClaw が大規模開発に対応**: 単純な対話 → COBOL→Web 全面再構築まで一貫処理
2. **GRC で配布された LLM API Key を再利用**: 各社員ノードで MetaCoder が自動的に同じ Anthropic キーを使用
3. **Lobster Pool（Docker コンテナ群）からゲーム開発が可能**: 各社員（CEO/PM/Engineer）が役割に応じた MetaCoder skill を実行
4. **企業統合管理**: API キー / モデル設定を GRC 中央管理 → MetaCoder へ自動配給

### 1.3 統合の前提

- MetaCoder は **Bun runtime ベース**だが、`metacoder-1.0.5-linux-x64.tar.gz` (43MB) は **standalone バイナリ**として配布されている → Bun を別途インストール不要
- `~/.metacoder/` にユーザデータを格納（Docker 内では `/home/winclaw/.metacoder/`）
- 認証方法 3 種類のうち **B（環境変数 ANTHROPIC_API_KEY）** が WinClaw 統合に最適

---

## 2. アーキテクチャ設計

### 2.1 全体図

```
┌──────────────────────────────────────────────────────────────────┐
│  GRC Server (中央管理)                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ai_model_keys table:                                     │    │
│  │   primary: anthropic/claude-opus-4-6 + sk-ant-xxx       │    │
│  │   auxiliary: gemini/gemini-2.0-flash + key              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          ↓ SSE config push                       │
└──────────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│  WinClaw Docker Container (Lobster, e.g. CEO/Pan/Suny)            │
│                                                                   │
│  ┌────────────────────────────────────────────┐                  │
│  │ winclaw.json (auto-synced from GRC)         │                  │
│  │   models.providers.anthropic.apiKey: sk-... │                  │
│  └────────────────────────────────────────────┘                  │
│                ↓ extract on demand                                │
│  ┌────────────────────────────────────────────┐                  │
│  │ MetaCoder Skill Bundle                      │                  │
│  │   metacoder.sh wrapper:                     │                  │
│  │     1. Read winclaw.json → ANTHROPIC_API_KEY│                  │
│  │     2. Read winclaw.json → ANTHROPIC_BASE_URL (if proxy)│      │
│  │     3. exec metacoder /systest|/newproject  │                  │
│  └────────────────────────────────────────────┘                  │
│                                                                   │
│  ┌────────────────────────────────────────────┐                  │
│  │ /usr/local/bin/metacoder (43MB bin)         │                  │
│  │ ~/.metacoder/projects/...                   │                  │
│  └────────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Skill の発火経路

```
User → WinClaw Chat UI / Telegram / WhatsApp
   → Agent receives task: "新しいゲームの mod システムを作って"
   → Tool: metacoder_invoke (winclaw side)
       ↓
   metacoder.sh wrapper script
       1. jq winclaw.json → 抽出 anthropic.apiKey
       2. export ANTHROPIC_API_KEY=$key
       3. metacoder /newproject --requirements "新しいゲームの mod システム..." --output /workspace/mod-system
       ↓
   MetaCoder runs internally: Phase 1-4 multi-agent
       ↓
   結果（.project/PHASE4_SUMMARY.md）を Agent に返却
       ↓
   Agent → User: "完成しました。/workspace/mod-system/ を確認してください。"
```

---

## 3. 実装計画

### Phase 1: Docker Image に MetaCoder バイナリを内蔵（半日）

#### 3.1 ファイル準備
```bash
# WinClaw repo に追加
docker/metacoder-1.0.5-linux-x64.tar.gz  ← /c/work/meta-coder/dist/ から copy
```

#### 3.2 Dockerfile.node 修正

**追加する Layer（既存 Layer 2 の後）:**
```dockerfile
# Layer 2.5: Install MetaCoder (43MB Linux binary, no Bun needed - standalone)
COPY docker/metacoder-1.0.5-linux-x64.tar.gz /tmp/metacoder.tar.gz
RUN tar -xzf /tmp/metacoder.tar.gz -C /tmp \
  && install -m 755 /tmp/metacoder-1.0.5-linux-x64/metacoder /usr/local/bin/metacoder \
  && rm -rf /tmp/metacoder*
```

**最終的なイメージサイズ増加見込み:**
- 現在: 1.64GB
- MetaCoder 追加後: ~1.71GB（+70MB、binary 圧縮解除分）

### Phase 2: MetaCoder Skill Bundle 作成（1 日）

#### 3.3 ディレクトリ構造

```
skills/metacoder/
├── SKILL.md                       ← Skill 定義（WinClaw が認識）
├── scripts/
│   ├── metacoder-wrapper.sh       ← API key 抽出 + metacoder 起動
│   ├── extract-api-key.sh         ← winclaw.json → ANTHROPIC_API_KEY
│   └── prepare-workspace.sh       ← workspace ディレクトリ準備
└── references/
    ├── usage-systest.md           ← /systest 使用例
    ├── usage-modernize.md         ← /modernize 使用例
    ├── usage-newproject.md        ← /newproject 使用例
    └── api-key-mapping.md         ← Provider → 環境変数マッピング
```

#### 3.4 SKILL.md（雛形）

```markdown
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

WinClaw から MetaCoder の 3 つの skill (/systest, /modernize, /newproject) を呼び出します。

## API キーの自動継承

WinClaw の `winclaw.json` から GRC 配布済みの API key を読み取って MetaCoder の環境変数に渡します。

優先順位:
1. `models.providers.anthropic.apiKey` → `ANTHROPIC_API_KEY`
2. `models.providers.anthropic.baseUrl` → `ANTHROPIC_BASE_URL`（プロキシ使用時）
3. `models.providers.openai.apiKey` → 第二フォールバック

## 使用方法

### 既存システムのテスト
\`\`\`
metacoder-wrapper.sh systest \\
  --workspace /workspace \\
  --backend-url http://localhost:8000 \\
  --frontend-url http://localhost:5173
\`\`\`

### 新規プロジェクト開発
\`\`\`
metacoder-wrapper.sh newproject \\
  --requirements requirements.md \\
  --output /workspace/new-game-mod
\`\`\`

### レガシー移植
\`\`\`
metacoder-wrapper.sh modernize \\
  --workspace /workspace/legacy-cobol \\
  --output /workspace/modernized
\`\`\`
```

#### 3.5 metacoder-wrapper.sh（核心スクリプト）

```bash
#!/bin/bash
# MetaCoder wrapper for WinClaw Docker integration
# Extracts API keys from winclaw.json and invokes metacoder with proper env vars

set -e

CONFIG="${WINCLAW_CONFIG:-/home/winclaw/.winclaw/winclaw.json}"
COMMAND="$1"
shift

if [ ! -f "$CONFIG" ]; then
  echo "[metacoder-wrapper] FATAL: winclaw.json not found at $CONFIG" >&2
  exit 1
fi

# Extract Anthropic API key (primary provider)
ANTHROPIC_KEY=$(jq -r '.models.providers.anthropic.apiKey // empty' "$CONFIG")
ANTHROPIC_URL=$(jq -r '.models.providers.anthropic.baseUrl // empty' "$CONFIG")

if [ -z "$ANTHROPIC_KEY" ]; then
  echo "[metacoder-wrapper] FATAL: No anthropic API key found in winclaw.json" >&2
  echo "[metacoder-wrapper] GRC must push models.providers.anthropic.apiKey first" >&2
  exit 1
fi

export ANTHROPIC_API_KEY="$ANTHROPIC_KEY"
[ -n "$ANTHROPIC_URL" ] && export ANTHROPIC_BASE_URL="$ANTHROPIC_URL"

# Suppress Windows-specific warnings (this is Linux container)
export METACODER_SUPPRESS_TERMINAL_WARNING=1

# Persist user data within winclaw home (so 换水 keeps history)
export CLAUDE_CONFIG_DIR="/home/winclaw/.metacoder"
mkdir -p "$CLAUDE_CONFIG_DIR"

# Invoke MetaCoder with appropriate slash command
case "$COMMAND" in
  systest|/systest)
    exec metacoder -p "/systest run $*"
    ;;
  newproject|/newproject)
    exec metacoder -p "/newproject $*"
    ;;
  modernize|/modernize)
    exec metacoder -p "/modernize $*"
    ;;
  graph|/graph)
    exec metacoder -p "/graph $*"
    ;;
  *)
    # Pass through to interactive metacoder
    exec metacoder "$@"
    ;;
esac
```

#### 3.6 entrypoint-node.sh への追加

`PERSIST_DIR` の処理直後に追加（行 156 付近）:

```bash
# MetaCoder workspace persistence (preserve graph cache and conversation history)
METACODER_PERSIST="${PERSIST_DIR}/metacoder"
if [ -d "${METACODER_PERSIST}" ]; then
  mkdir -p /home/winclaw/.metacoder
  cp -r "${METACODER_PERSIST}"/* /home/winclaw/.metacoder/ 2>/dev/null || true
  echo "[entrypoint] Restored MetaCoder state (graph cache + history)"
fi
```

シャットダウン時のバックアップ（trap）も追加。

### Phase 3: Tool として WinClaw に登録（半日）

#### 3.7 WinClaw Tool 定義

```typescript
// src/agents/tools/metacoder.ts
import { execFileSync } from "node:child_process";

export const metacoderTool = {
  name: "metacoder",
  description: "Invoke MetaCoder for large-scale software development tasks (game dev, modernization, new projects). Uses semantic knowledge graphs and multi-agent TDD.",
  parameters: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["systest", "newproject", "modernize", "graph"],
        description: "MetaCoder skill to invoke"
      },
      args: {
        type: "string",
        description: "Arguments to pass (e.g. --workspace /path --output /out --requirements 'desc')"
      }
    },
    required: ["mode"]
  },
  execute: async ({ mode, args }: { mode: string; args?: string }) => {
    const cmd = `/usr/local/bin/metacoder-wrapper.sh ${mode} ${args ?? ""}`;
    const output = execFileSync("bash", ["-c", cmd], {
      cwd: "/home/winclaw",
      encoding: "utf-8",
      timeout: 7200_000  // 2 hours (matches MetaCoder phase 5 timeout)
    });
    return { result: output };
  }
};
```

### Phase 4: GRC 連携の自動化（半日）

#### 3.8 API キー同期保証

GRC SSE config push で API キーが届いた瞬間に MetaCoder にも反映するよう、`grc-sync.ts` の処理に hook を追加：

```typescript
// src/infra/grc-sync.ts (modify existing handler)
async function applyKeyConfig(...) {
  // ... existing winclaw.json update logic ...

  // NEW: Notify MetaCoder skill that key is available
  log.info("[infra/grc-sync] API key updated; MetaCoder ready");
  // (実際は wrapper が起動時に毎回読むので明示的通知は不要、ログのみ)
}
```

#### 3.9 Tool 自動登録

Docker image に metacoder バイナリが存在する場合のみ tool を登録：

```typescript
// src/agents/tools/registry.ts
import { existsSync } from "node:fs";

if (existsSync("/usr/local/bin/metacoder")) {
  registerTool(metacoderTool);
  log.info("[tools] MetaCoder tool registered");
}
```

### Phase 5: ビルド・公開・テスト（半日）

#### 3.10 ビルド手順

1. `cp /c/work/meta-coder/dist/metacoder-1.0.5-linux-x64.tar.gz docker/`
2. `Dockerfile.node` 編集（Phase 1 の Layer 2.5 追加）
3. `skills/metacoder/` 作成（Phase 2）
4. `entrypoint-node.sh` 編集（Phase 2.6）
5. `src/agents/tools/metacoder.ts` 作成（Phase 3）
6. `pnpm build && pnpm pack`
7. バージョン bump: `2026.4.18` → `2026.5.1`
8. `npm publish`
9. `docker build -f docker/Dockerfile.node -t itccloudsoft/winclaw-node:2026.5.1 -t itccloudsoft/winclaw-node:latest .`
10. `docker push itccloudsoft/winclaw-node:2026.5.1`
11. `docker push itccloudsoft/winclaw-node:latest`

#### 3.11 動作確認

各 Lobster コンテナで以下が成功することを確認：
```bash
docker exec <container_id> bash -c "
  metacoder --version &&
  metacoder-wrapper.sh systest --help &&
  ls -la /home/winclaw/.metacoder/
"
```

期待出力：
```
1.0.5
[metacoder-wrapper] Anthropic key extracted from winclaw.json: sk-ant-...
[systest help text]
drwxr-xr-x ... .metacoder
```

---

## 4. リスクと対策

| リスク | 等級 | 対策 |
|------|------|------|
| イメージサイズ +70MB | 低 | Acceptable（1.71GB total）。multi-stage build で更に削減可能（将来） |
| MetaCoder 内部からの API 高頻度呼出 | 中 | GRC で API rate limit / cost monitoring を強化。 各 Lobster の月次予算を設定 |
| API key が persist 領域に書かれない | 中 | wrapper は環境変数渡しのみ。 `~/.metacoder/` にキャッシュされない設計を確認 |
| Bun ランタイム互換 | 低 | standalone binary なので不要。glibc 2.27+ 必須 → bookworm-slim は 2.36 で OK |
| Long-running task が container 健康チェック失敗 | 中 | healthcheck の `start-period` を 60s → 300s に延長検討 |
| 同時複数 MetaCoder 実行 | 中 | 1 container で並列 metacoder NG（state が衝突）。tool execute 内で mutex |

---

## 5. テスト計画

### 5.1 統合テスト

| テストケース | 期待結果 |
|----|----|
| Docker image に metacoder が含まれる | `docker exec ... metacoder --version` → `1.0.5` |
| API key が wrapper で抽出される | wrapper 実行時のログに `Anthropic key extracted` |
| `/systest` 実行 | 既存テストプロジェクト（airlinesys6）で完走 |
| `/newproject` 実行 | "シンプルな TODO アプリ" 要件 → 動作する Web app 生成 |
| 换水後も graph cache 残る | 2 回目起動で `[entrypoint] Restored MetaCoder state` |
| GRC が API key を更新 | 5 秒以内に次の wrapper 起動で新キー使用 |
| 複数 Lobster 並列実行 | 3 container 同時 `/newproject` で全部成功 |

### 5.2 失敗ケーステスト

| ケース | 期待される handling |
|----|----|
| winclaw.json に anthropic key なし | wrapper が exit 1 + 明確エラーメッセージ |
| API key が無効 | metacoder 自体のエラーをそのまま伝播 |
| ネットワーク切断中 | retry → タイムアウト後 fail（コンテナは生き続ける） |

---

## 6. ロールアウト戦略

### Step 1: 開発環境で検証（1 日）
- ローカルで Dockerfile build → 1 container 起動
- 全テストケース pass を確認

### Step 2: 1 ノードでベータ（1 日）
- 既存 Lobster 1 つを新 image に更新
- 24h 連続稼働 + GRC 連携正常を確認

### Step 3: 全 Lobster 一斉更新（半日）
- `换水` 機能で全 9 ノードを v2026.5.1 に
- すべて healthy を確認

### Step 4: 公式リリース（即日）
- DockerHub `latest` タグ更新
- README に MetaCoder 利用例追記
- 社内アナウンス

---

## 7. 成果物リスト

| 成果物 | パス | 内容 |
|----|----|----|
| Docker image | `itccloudsoft/winclaw-node:2026.5.1` | metacoder 内蔵 |
| npm package | `winclaw@2026.5.1` | metacoder tool 登録 |
| Skill bundle | `skills/metacoder/` | wrapper + 使用ガイド |
| Wrapper script | `/usr/local/bin/metacoder-wrapper.sh` | container 内に配置 |
| Tool 定義 | `src/agents/tools/metacoder.ts` | WinClaw が呼出可能 |
| Documentation | `docs/metacoder-integration-proposal-2026-05-05.md` | 本ファイル |

---

## 8. 工数見積

| Phase | 内容 | 工数 |
|----|----|----|
| Phase 1 | Dockerfile + binary copy | 0.5d |
| Phase 2 | Skill bundle + wrapper | 1.0d |
| Phase 3 | Tool 登録 | 0.5d |
| Phase 4 | GRC 連携 | 0.5d |
| Phase 5 | Build + 公開 + テスト | 0.5d |
| **合計** | | **3.0d** |

---

## 9. 不確定要素 / Open Questions

1. **MetaCoder 内部の Claude モデル選択**: WinClaw の `agents.defaults.model`（例: `claude-opus-4-6`）と一致させるべきか、それとも MetaCoder にデフォルトを任せるか？
   - **提案**: 第 1 期は MetaCoder デフォルト、将来 `--model` 引数で連動

2. **`/login` OAuth 経路は使うか？**
   - **提案**: 不使用。Container には fixed API key 渡しのみ（OAuth は対話必要で自動化困難）

3. **`/graph` キャッシュの永続化粒度**
   - **提案**: `~/.metacoder/projects/<slug>/graphify-out/` を `config-persist/metacoder/` にコピー
   - 但しこれは数百 MB に成り得るため、graph rebuild トリガを 7 日 TTL で設定推奨

4. **メッセージング channel から直接 metacoder を呼ぶ UX**
   - **提案**: `@bot 新规プロジェクト 名前: TodoApp` のような自然言語 → agent が tool 経由で metacoder を起動。詳細は別 proposal

---

## 10. 結論

MetaCoder は WinClaw の "AI ゲートウェイ"+ "対話" レイヤーを補完する **大規模開発実行レイヤー** として最適。standalone Linux binary 配布のため統合コストが低く（3 人日）、既存の GRC 中央管理 API key 配布インフラをそのまま活用できる。

特に **ゲーム開発 / レガシー移植 / 新規 SaaS** といった "規模の大きい一回的タスク" を WinClaw 経由で各 Lobster に分散投入できるようになり、企業全体の開発スループットが大きく向上する見込み。

---

**Review please** — 上記方針で進めて良いか、変更点があれば指示願います。
