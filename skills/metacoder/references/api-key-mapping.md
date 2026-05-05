# API Key Mapping for MetaCoder

WinClaw `winclaw.json` の `models.providers.*` から MetaCoder の環境変数への対応表。

## 抽出ロジック (metacoder-wrapper.sh)

```bash
# Priority 1: Anthropic
ANTHROPIC_KEY=$(jq -r '.models.providers.anthropic.apiKey // empty' winclaw.json)
ANTHROPIC_URL=$(jq -r '.models.providers.anthropic.baseUrl // empty' winclaw.json)

# Priority 2: Fallback to first available provider
if [ -z "$ANTHROPIC_KEY" ]; then
  # 任意の provider で apiKey が設定されている最初のものを使用
  jq '.models.providers | to_entries[] | select(.value.apiKey != null and .value.apiKey != "")' ...
fi
```

## 環境変数

| MetaCoder env var | 用途 | winclaw.json の出所 |
|-------------------|------|--------------------|
| `ANTHROPIC_API_KEY` | API 認証 | `models.providers.anthropic.apiKey` |
| `ANTHROPIC_BASE_URL` | API ホスト切替（プロキシ用） | `models.providers.anthropic.baseUrl` |
| `CLAUDE_CONFIG_DIR` | 設定ディレクトリ | 固定: `/home/winclaw/.metacoder` |
| `METACODER_SUPPRESS_TERMINAL_WARNING` | Windows 警告抑制 | 固定: `1` |
| `META_CODER_SKIP_SANDBOX_CHECK` | サンドボックス検査スキップ | 固定: `1` |

## winclaw.json サンプル

```json
{
  "models": {
    "providers": {
      "anthropic": {
        "apiKey": "sk-ant-api03-xxxxx",
        "baseUrl": "https://api.anthropic.com"
      },
      "openai": {
        "apiKey": "sk-yyyyy",
        "baseUrl": "https://api.openai.com/v1"
      },
      "gemini": {
        "apiKey": "AIzaSyZZZZZ"
      }
    }
  }
}
```

GRC が SSE で push する更新もこの構造に従います。

## サードパーティプロキシ（BigModel 等）

```json
{
  "models": {
    "providers": {
      "anthropic": {
        "apiKey": "<provider-token>",
        "baseUrl": "https://your-proxy.example.com/api/anthropic"
      }
    }
  }
}
```

⚠️ サードパーティプロキシ使用時は MetaCoder の本来のプロンプト追従度が下がる可能性があります。
公式 Anthropic API 推奨。

## デバッグ

```bash
# wrapper の実行時に key preview がログ出力される:
[metacoder-wrapper] API key extracted: sk-ant-api...wxyz
[metacoder-wrapper] Using base URL: https://api.anthropic.com
```
