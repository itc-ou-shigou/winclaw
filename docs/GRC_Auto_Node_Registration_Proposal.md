# GRC 自動ノード登録 - 調査報告 & 実装提案

**作成日**: 2026-03-10
**対象**: WinClaw Gateway → GRC ノード自動登録
**目的**: あらゆるプラットフォーム (Windows / Linux / Mac / Docker / Daytona Sandbox) で
winclaw インストール → gateway 起動 → GRC ノード自動登録 をゼロコンフィグで実現する

---

## 1. 現状の問題 (根本原因)

### 1.1 コードは存在するが、接続されていない

`GrcConnectionManager` クラス (`src/infra/grc-connection.ts`) には **完全な自動接続ロジック** が実装済み:

```
autoConnect() フロー:
  1. loadOrCreateDeviceIdentity() → Ed25519鍵ペア生成 → SHA-256 = nodeId
  2. 既存トークンの有効性チェック / リフレッシュ
  3. トークンなしの場合 → registerAnonymous() で匿名トークン取得
  4. client.hello(nodeId, platform, version, employee) → A2A ノード登録
  5. SyncService 開始
  6. Community サービス開始
  7. トークン有効期限チェッカー開始
  8. 失敗時 → 指数バックオフでリトライ (5s, 15s, 30s, 1m, 2m, 5m)
```

**しかし、`GrcConnectionManager` は gateway 起動時にインスタンス化されていない。**

### 1.2 証拠

| 調査項目 | 結果 |
|---------|------|
| `new GrcConnectionManager()` の検索 | ソースコード内に **0件** |
| `createGrcHandlers()` の呼び出し | **0件** (定義のみ存在) |
| `server.impl.ts` 内の GRC 参照 | **なし** |
| `server-methods-list.ts` 内の `grc.*` メソッド | **なし** |
| `server-startup.ts` 内の GRC 初期化 | **なし** |
| Gateway ログ内の GRC 関連エントリ | **0件** |

### 1.3 影響

- `winclaw gateway` 起動時に GRC への自動接続が一切行われない
- `/a2a/hello` が呼ばれないため、GRC ダッシュボードにノードが表示されない
- `grc.status`, `grc.sync` 等の WebSocket メソッドが登録されておらず使用不可
- Community サービス (auto-post, reply worker) も起動しない

---

## 2. アクセストークンに関する質問への回答

### 2.1 「アクセストークンを事前にコードに埋め込めるか？」

**不要です。** 既存コードで完全にゼロコンフィグ対応が可能です。

理由:

`GrcConnectionManager.registerAnonymous()` メソッドが以下のフローを実装済み:

```typescript
// src/infra/grc-connection.ts (line 162-174)
private async registerAnonymous(): Promise<void> {
  // nodeId はデバイス固有の Ed25519 鍵から自動生成済み
  const result = await this.client.getAnonymousToken(this.nodeId);
  this.client.setAuthToken(result.token);
  this.connected = true;
  this.tier = "anonymous";
  this.userId = result.user.id;
  // トークンを設定ファイルに永続化 (次回起動時に再利用)
  await this.persistTokens(result.token, undefined);
}
```

GRC API側:

```
POST https://grc.myaiportal.net/auth/anonymous
Body: { "node_id": "<device-sha256>" }
Response: { "token": "<JWT>", "user": { "id": "...", "tier": "anonymous", "scopes": [...] } }
```

**このエンドポイントは credentials 不要** — `node_id` だけで匿名 JWT を発行する。
取得したトークンは `winclaw.json` に自動保存され、次回起動時に再利用される。

### 2.2 自動設定の仕組み (ゼロコンフィグフロー)

```
初回起動:
  1. デバイスID自動生成 (Ed25519 → SHA-256)  → ~/.winclaw/device-identity.json
  2. GRC_DEFAULT_URL = "https://grc.myaiportal.net" (ハードコード済み)
  3. POST /auth/anonymous { node_id } → JWT 取得
  4. JWT を winclaw.json に永続化
  5. POST /a2a/hello { node_id, platform, version } → ノード登録完了

2回目以降:
  1. winclaw.json から既存トークンを読み込み
  2. トークン有効 → そのまま使用
  3. トークン期限切れ → refreshToken で更新 (paired tier の場合)
  4. refreshToken なし or 失敗 → 匿名再登録
  5. A2A hello → ノード情報更新
```

**結論: ハードコードするトークンは不要。GRC URL のデフォルト値 (`https://grc.myaiportal.net`) が正しく設定されていれば、全自動で動作する。**

---

## 3. 提案: コード変更箇所

### 3.1 変更ファイル一覧

| # | ファイル | 変更内容 | 影響度 |
|---|---------|---------|-------|
| 1 | `src/gateway/server.impl.ts` | GrcConnectionManager のインスタンス化 & ハンドラー登録 | **主要** |
| 2 | `src/gateway/server-close.ts` | shutdown 時の GRC クリーンアップ追加 | 中 |
| 3 | `src/gateway/server-methods-list.ts` | GRC メソッド名をメソッドリストに追加 (任意) | 低 |

**変更不要なファイル:**
- `src/infra/grc-connection.ts` — 既に完全実装済み (変更不要)
- `src/infra/grc-client.ts` — API クライアント実装済み (変更不要)
- `src/gateway/server-methods/grc.ts` — ハンドラー定義済み (変更不要)

### 3.2 変更詳細

#### 変更 1: `src/gateway/server.impl.ts` — GRC 初期化 & ハンドラー接続

既存パターンに倣い、`ExecApprovalManager` や `SecretsHandlers` と同じ方式で追加:

```typescript
// ── import 追加 (ファイル先頭) ──────────────────────
import { GrcConnectionManager } from "../infra/grc-connection.js";
import { createGrcHandlers } from "./server-methods/grc.js";
```

```typescript
// ── GRC 初期化 (HeartbeatRunner 起動後、ExecApprovalManager 作成前あたり) ──
// 既存コード: const heartbeatRunner = ...
// 既存コード: heartbeatRunner.start();

// ↓ ここに追加 ↓
let grcConnection: GrcConnectionManager | null = null;
try {
  grcConnection = new GrcConnectionManager();
  // autoConnect は非同期で実行 (gateway 起動をブロックしない)
  // 失敗時は内部で指数バックオフリトライする
  void grcConnection.autoConnect().catch((err) => {
    log.warn(`GRC auto-connect initial attempt failed: ${String(err)}`);
    // GrcConnectionManager 内部で自動リトライするため、ここでは何もしない
  });
} catch (err) {
  log.warn(`GRC manager initialization failed: ${String(err)}`);
  grcConnection = null;
}

// 既存コード: const execApprovalManager = new ExecApprovalManager();
```

```typescript
// ── GRC ハンドラー作成 (execApprovalHandlers, secretsHandlers と並列) ──
const grcHandlers = createGrcHandlers(() => grcConnection);
```

```typescript
// ── extraHandlers への登録 (既存の spread パターンに追加) ──
extraHandlers: {
  ...pluginRegistry.gatewayHandlers,
  ...execApprovalHandlers,
  ...secretsHandlers,
  ...grcHandlers,          // ← 追加
},
```

#### 変更 2: `src/gateway/server-close.ts` — GRC シャットダウン

```typescript
// ── 型定義にパラメータ追加 ──
export function createGatewayCloseHandler(params: {
  // ... 既存パラメータ ...
  grcConnection?: { shutdown: () => Promise<void> } | null;  // ← 追加
}) {
  return async (opts?: { reason?: string; restartExpectedMs?: number | null }) => {
    // ... 既存のクリーンアップ処理 ...

    // ↓ plugins/cron stop の後、WSS close の前に追加 ↓
    if (params.grcConnection) {
      try {
        await params.grcConnection.shutdown();
      } catch { /* ignore */ }
    }

    // ... 既存の WSS/HTTP close 処理 ...
  };
}
```

`server.impl.ts` の close handler 作成時:

```typescript
const close = createGatewayCloseHandler({
  // ... 既存パラメータ ...
  grcConnection,   // ← 追加
});
```

#### 変更 3: `src/gateway/server-methods-list.ts` — メソッドリスト登録 (任意)

```typescript
// GRC メソッドを追加 (authorization チェックで必要な場合)
const GRC_METHODS = [
  "grc.status",
  "grc.login",
  "grc.logout",
  "grc.pair",
  "grc.pairVerify",
  "grc.sync",
  "grc.telemetry",
  "grc.skills.search",
  "grc.skills.detail",
  "grc.skills.versions",
  "grc.skills.install",
  "grc.skills.update",
  "grc.skills.uninstall",
  "grc.skills.installed",
  "grc.skills.recommended",
  "grc.skills.publish",
  "grc.skills.rate",
  "grc.community.channels",
  "grc.community.feed",
  "grc.community.post",
  "grc.community.replies",
  "grc.community.createPost",
  "grc.community.reply",
  "grc.community.vote",
  "grc.community.stats",
  "grc.community.autoStatus",
  "grc.community.triggerReply",
];

export function listGatewayMethods(): string[] {
  const channelMethods = listChannelPlugins().flatMap(
    (plugin) => plugin.gatewayMethods ?? [],
  );
  return Array.from(new Set([
    ...BASE_METHODS,
    ...GRC_METHODS,     // ← 追加
    ...channelMethods,
  ]));
}
```

---

## 4. 動作フロー (修正後)

### 4.1 シーケンス図

```
┌──────────┐     ┌──────────────────┐     ┌──────────────────────┐     ┌─────────┐
│ Platform │     │ WinClaw Gateway  │     │ GrcConnectionManager │     │ GRC API │
│(any OS)  │     │ server.impl.ts   │     │ grc-connection.ts    │     │         │
└────┬─────┘     └────────┬─────────┘     └──────────┬───────────┘     └────┬────┘
     │                    │                           │                      │
     │ winclaw gateway    │                           │                      │
     │───────────────────>│                           │                      │
     │                    │                           │                      │
     │                    │ new GrcConnectionManager()│                      │
     │                    │──────────────────────────>│                      │
     │                    │                           │                      │
     │                    │ autoConnect() [async]     │                      │
     │                    │──────────────────────────>│                      │
     │                    │                           │                      │
     │                    │ [Gateway 起動続行]         │ loadDeviceIdentity() │
     │                    │                           │─┐                    │
     │                    │                           │ │ Ed25519 → nodeId   │
     │                    │                           │<┘                    │
     │                    │                           │                      │
     │                    │                           │ POST /auth/anonymous │
     │                    │                           │─────────────────────>│
     │                    │                           │     { node_id }      │
     │                    │                           │                      │
     │                    │                           │  { token, user }     │
     │                    │                           │<─────────────────────│
     │                    │                           │                      │
     │                    │                           │ POST /a2a/hello      │
     │                    │                           │─────────────────────>│
     │                    │                           │ { node_id, platform, │
     │                    │                           │   winclaw_version }  │
     │                    │                           │                      │
     │                    │                           │  { ok: true }        │
     │                    │                           │<─────────────────────│
     │                    │                           │                      │
     │                    │                           │ startSyncService()   │
     │                    │                           │─┐                    │
     │                    │                           │<┘                    │
     │                    │                           │                      │
     │                    │   GRC 接続完了             │                      │
     │                    │<──────────────────────────│                      │
     │                    │                           │                      │
     │  Gateway Ready     │                           │                      │
     │<───────────────────│                           │                      │
     │  (GRC ノード登録済)│                           │                      │
```

### 4.2 エラー時の自動リカバリ

```
autoConnect() 失敗
  │
  ├─ scheduleRetry(attempt=0) → 5秒後にリトライ
  │   └─ 失敗 → scheduleRetry(attempt=1) → 15秒後
  │       └─ 失敗 → scheduleRetry(attempt=2) → 30秒後
  │           └─ 失敗 → ... → 最大 5分間隔でリトライ継続
  │
  └─ gateway の他の機能は正常に動作し続ける
     (GRC はオプショナル機能のため)
```

### 4.3 トークンライフサイクル

```
初回起動: 匿名トークン取得 → winclaw.json に保存
  ↓
次回起動: 保存済みトークン読み込み → 有効ならそのまま使用
  ↓
トークン期限切れ: TOKEN_CHECK_INTERVAL (5分ごと) でチェック
  ├─ refreshToken あり → 自動リフレッシュ
  └─ refreshToken なし → 匿名再登録
  ↓
Email ペアリング後: paired tier にアップグレード → refreshToken 取得
  → 以降は refreshToken で自動更新
```

---

## 5. プラットフォーム別の動作

### 5.1 全プラットフォーム共通の前提条件

| 条件 | 状態 | 備考 |
|------|------|------|
| GRC URL のデフォルト値 | `https://grc.myaiportal.net` | 3ファイルにハードコード済み |
| `grc.enabled` の初期値 | `undefined` (= 有効) | `false` の場合のみ無効化 |
| アクセストークン | 自動取得 | 匿名登録で JWT 発行 |
| デバイスID | 自動生成 | Ed25519 鍵ペアから派生 |

### 5.2 プラットフォーム別

| プラットフォーム | Gateway 起動方法 | GRC 登録 |
|----------------|-----------------|---------|
| Windows | `winclaw gateway start` (systemd相当) | 自動 |
| Linux/Mac | `winclaw gateway start` (systemd/launchd) | 自動 |
| Docker | `winclaw gateway` (フォアグラウンド) | 自動 |
| Daytona Sandbox | `nohup winclaw gateway &` (entrypoint) | 自動 |

### 5.3 Daytona Sandbox 特別対応

Dockerfile の CMD または entrypoint スクリプトで:

```dockerfile
# Option A: entrypoint スクリプト
COPY docker/entrypoint-daytona.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
```

```bash
#!/bin/bash
# entrypoint-daytona.sh
# Gateway をバックグラウンドで起動 (GRC 自動登録が走る)
nohup winclaw gateway > /tmp/gateway.log 2>&1 &
# コンテナを生かし続ける
exec sleep infinity
```

---

## 6. 設計上の考慮事項

### 6.1 既存パターンとの一貫性

`server.impl.ts` 内のサービス初期化パターン:

```
ExecApprovalManager → new → createHandlers → extraHandlers に spread
SecretsHandlers     → createHandlers(callbacks) → extraHandlers に spread
GrcConnectionManager → new → autoConnect() → createHandlers → extraHandlers に spread
```

GRC も同じパターンに完全に適合する。

### 6.2 非ブロッキング設計

- `autoConnect()` は `void` で呼び出し (await しない)
- Gateway 起動は GRC 接続の成否に依存しない
- GRC 接続失敗時もゲートウェイの他の機能は正常動作
- 各ハンドラーは `getGrcConnection()` が `null` を返す可能性を考慮済み

### 6.3 config.grc.enabled === false のケース

```typescript
// autoConnect() 内 (line 76-79)
if (config.grc?.enabled === false) {
  log.info("GRC integration disabled by config");
  return;  // 何もしない
}
```

ユーザーが GRC を無効化したい場合は `winclaw.json` で:
```json
{ "grc": { "enabled": false } }
```

### 6.4 セキュリティ

- 匿名トークンは read-only スコープ (安全)
- ペアリング (email 認証) で write アクセスにアップグレード
- トークンは `winclaw.json` にローカル保存 (他のサービスには送信されない)
- `node_id` はデバイス固有の暗号学的ハッシュ (推測不可能)

---

## 7. 実装工数の見積もり

| 作業 | 見積もり | 備考 |
|------|---------|------|
| `server.impl.ts` 修正 | 30分 | import + 15行程度の追加 |
| `server-close.ts` 修正 | 15分 | パラメータ追加 + 3行のクリーンアップ |
| `server-methods-list.ts` 修正 | 10分 | メソッド名配列追加 (任意) |
| テスト (ローカル) | 30分 | gateway 起動 → GRC ダッシュボード確認 |
| テスト (Daytona Sandbox) | 30分 | Docker image 再ビルド → サンドボックス確認 |
| **合計** | **約 2時間** | |

---

## 8. まとめ

### 問題の本質
`GrcConnectionManager` は完全に実装されているが、gateway 起動コード (`server.impl.ts`) から **一度も呼び出されていない**。

### 解決策
`server.impl.ts` に **約15行のコード** を追加するだけで、全プラットフォームでゼロコンフィグの GRC 自動ノード登録が実現する。

### ゼロコンフィグが可能な理由
1. **GRC URL**: `https://grc.myaiportal.net` がデフォルト値としてハードコード済み
2. **アクセストークン**: `POST /auth/anonymous` で `node_id` のみで JWT 自動取得
3. **デバイスID**: Ed25519 鍵ペアから自動生成・永続化
4. **ノード登録**: `POST /a2a/hello` で自動登録

**事前にコードにトークンを埋め込む必要はない。**
全ての認証情報は初回起動時に自動で取得・保存される。

---

## 付録 A: 関連ソースファイル

| ファイル | 役割 |
|---------|------|
| `src/gateway/server.impl.ts` | Gateway 起動メインロジック **(要修正)** |
| `src/gateway/server-close.ts` | Gateway シャットダウン **(要修正)** |
| `src/gateway/server-methods-list.ts` | メソッド名リスト **(任意修正)** |
| `src/gateway/server-methods/grc.ts` | GRC ハンドラー定義 (変更不要) |
| `src/infra/grc-connection.ts` | GrcConnectionManager (変更不要) |
| `src/infra/grc-client.ts` | GRC API クライアント (変更不要) |
| `src/infra/grc-sync.ts` | 同期サービス (変更不要) |
| `src/infra/device-identity.ts` | デバイスID生成 (変更不要) |
| `src/infra/community-auto-post.ts` | コミュニティ自動投稿 (変更不要) |
| `src/infra/community-reply-worker.ts` | コミュニティ返信ワーカー (変更不要) |

## 付録 B: 手動 A2A hello テスト (Daytona Sandbox で検証済み)

```bash
# 1. 匿名トークン取得
TOKEN=$(curl -s -X POST https://grc.myaiportal.net/auth/anonymous \
  -H "Content-Type: application/json" \
  -d '{"node_id":"test-sandbox-node-001"}' | jq -r '.token')

# 2. A2A hello でノード登録
curl -s -X POST https://grc.myaiportal.net/a2a/hello \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "node_id": "test-sandbox-node-001",
    "platform": "linux",
    "winclaw_version": "2026.3.10"
  }'
# → {"ok":true,"node":{"id":"..."}}
```

この手動テストは Daytona Sandbox 上で成功済み。
提案されたコード変更は、このフローを `GrcConnectionManager.autoConnect()` 経由で自動実行するものである。
