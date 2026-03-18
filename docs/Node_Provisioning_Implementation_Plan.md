# ノードプロビジョニング機能 実装計画書

**作成日**: 2026-03-15
**対象プロジェクト**: GRC Admin Dashboard (`C:\work\grc`)
**対象ページ**: 進化 > ノード管理 (`/evolution/nodes`)

---

## 1. 機能概要

ノード管理画面に以下の機能を追加する：

| 機能 | 説明 |
|------|------|
| **ノード作成** | ローカルDocker / Daytona Sandbox ノードをワンクリックで作成 |
| **ノード削除（拡張）** | GRCデータ削除に加え、Docker / Sandbox コンテナも同時削除 |
| **ノード再起動** | Docker再作成 / Sandbox再作成（最新イメージ使用） |
| **Gateway接続** | Chat UIを新しいタブで開く |
| **i18n** | 4言語対応 (en / ja / zh / ko) |

---

## 2. モード判定ロジック

```
GRC URL が localhost / 127.0.0.1 / host.docker.internal
  → ローカルDockerモード（docker run で作成）

GRC URL がそれ以外（例: https://grc.myaiportal.net）
  → Daytona Sandboxモード（Daytona API で作成）
```

**判定箇所**: バックエンドの `/nodes/provision` API 内で `req.headers.host` またはサーバーconfig から判定。
**フロントエンド**: `window.location.hostname` が `localhost` / `127.0.0.1` かどうかで popup の入力項目を切り替え。

---

## 3. 変更ファイル一覧

### 3.1 データベース

| ファイル | 変更内容 |
|---------|---------|
| `src/shared/db/migrations/014_node_provisioning.sql` | **新規** — nodesテーブルにプロビジョニング列を追加 |
| `src/modules/evolution/schema.ts` | nodesTable にDrizzle列定義を追加 |

### 3.2 バックエンド

| ファイル | 変更内容 |
|---------|---------|
| `src/modules/evolution/admin-routes.ts` | 3つのAPIエンドポイントを追加 + 削除API拡張 |

### 3.3 フロントエンド

| ファイル | 変更内容 |
|---------|---------|
| `dashboard/src/api/hooks.ts` | Node型拡張 + 3つの新しいhookを追加 |
| `dashboard/src/pages/evolution/Nodes.tsx` | 作成ボタン + 作成モーダル + 再起動モーダル + Gatewayボタン + 削除拡張 |

### 3.4 国際化 (4ファイル)

| ファイル | 言語 |
|---------|------|
| `dashboard/public/locales/en/evolution.json` | English |
| `dashboard/public/locales/ja/evolution.json` | 日本語 |
| `dashboard/public/locales/zh/evolution.json` | 中文 |
| `dashboard/public/locales/ko/evolution.json` | 한국어 |

---

## 4. データベース変更

### 4.1 Migration: `014_node_provisioning.sql`

```sql
ALTER TABLE `nodes`
  ADD COLUMN `provisioning_mode` ENUM('local_docker', 'daytona_sandbox') NULL
    COMMENT 'プロビジョニング方式' AFTER `key_config_json`,
  ADD COLUMN `container_id` VARCHAR(255) NULL
    COMMENT 'Docker container ID' AFTER `provisioning_mode`,
  ADD COLUMN `sandbox_id` VARCHAR(255) NULL
    COMMENT 'Daytona sandbox ID' AFTER `container_id`,
  ADD COLUMN `gateway_url` VARCHAR(500) NULL
    COMMENT 'Gateway Chat UI URL (token含む)' AFTER `sandbox_id`,
  ADD COLUMN `gateway_port` INT NULL
    COMMENT 'ホスト側マッピングポート' AFTER `gateway_url`,
  ADD COLUMN `workspace_path` VARCHAR(500) NULL
    COMMENT 'ホスト側workspaceパス' AFTER `gateway_port`;
```

### 4.2 Drizzle Schema 追加 (`schema.ts`)

```typescript
// nodesTable に追加:
provisioningMode: mysqlEnum("provisioning_mode", ["local_docker", "daytona_sandbox"]),
containerId: varchar("container_id", { length: 255 }),
sandboxId: varchar("sandbox_id", { length: 255 }),
gatewayUrl: varchar("gateway_url", { length: 500 }),
gatewayPort: int("gateway_port"),
workspacePath: varchar("workspace_path", { length: 500 }),
```

---

## 5. バックエンド API 設計

### 5.1 `POST /api/v1/admin/evolution/nodes/provision` — ノード作成

**リクエスト**:
```typescript
{
  mode: "local_docker" | "daytona_sandbox",
  // Local Docker のみ:
  gatewayPort: number,        // 必須 (例: 10001)
  workspacePath: string,      // 必須 (例: "C:\\work\\workspaces\\wk1")
  // 共通（すべて任意）:
  employeeName?: string,      // 社員姓名
  employeeCode?: string,      // 社員番号
  employeeEmail?: string,     // 社員メール
}
```

**ローカルDockerモード処理フロー**:

```
1. docker run -d \
     -p <gatewayPort>:18789 \
     -e WINCLAW_GRC_URL=http://host.docker.internal:<grcPort> \
     -e employee_name=<employeeName> \
     -e employee_code=<employeeCode> \
     -v <workspacePath>:/home/winclaw/.winclaw/workspace \
     itccloudsoft/winclaw-node:latest

2. stdout から container_id を取得

3. docker logs <container_id> を500ms間隔で最大15秒ポーリング
   → バナー内の "Token:" 行から gateway token を抽出
   → 正規表現: /Token:\s+(winclaw-node-[a-f0-9]+)/

4. gateway_url = "http://localhost:<gatewayPort>/chat?token=<token>"

5. コンテナがGRCに自動登録されるのを待つ（最大15秒ポーリング）
   → nodesTable から nodeId を取得

6. nodesTable を UPDATE:
   - provisioning_mode = 'local_docker'
   - container_id = <containerId>
   - gateway_url = <gatewayUrl>
   - gateway_port = <gatewayPort>
   - workspace_path = <workspacePath>
```

**Daytona Sandboxモード処理フロー**:

```
1. Daytona API でサンドボックス作成:
   POST https://app.daytona.io/api/sandbox
   Headers:
     Authorization: Bearer dtn_a92ccd0521fdaf9bc2c173087e23a3a52edc2d67fbb6a3508871a614a474b023
   Body:
     {
       "image": "itccloudsoft/winclaw-node:latest",
       "target": "us",
       "envVars": {
         "WINCLAW_GRC_URL": "<grcUrl>",      // 例: https://grc.myaiportal.net
         "employee_name": "<employeeName>",
         "employee_code": "<employeeCode>"
       },
       "resources": { "cpu": 2, "memory": 2, "disk": 5 }
     }

2. レスポンスから sandbox_id を取得

3. gateway_url = "https://18789-<sandbox_id>.pit-1.try-us.daytona.app"

4. GRC登録を待ち、nodesTable を UPDATE:
   - provisioning_mode = 'daytona_sandbox'
   - sandbox_id = <sandboxId>
   - gateway_url = <gatewayUrl>
```

**レスポンス**:
```json
{
  "data": {
    "nodeId": "xxx",
    "containerId": "abc123...",
    "sandboxId": null,
    "gatewayUrl": "http://localhost:10001/chat?token=winclaw-node-xxx",
    "provisioningMode": "local_docker"
  }
}
```

---

### 5.2 `DELETE /api/v1/admin/evolution/nodes/:nodeId` — 削除（拡張）

**既存処理**: GRCデータベースから削除のみ
**拡張後**: プロビジョニングモードに応じてコンテナも削除

```typescript
// 削除前にプロビジョニング情報を取得
const node = await db.select().from(nodesTable).where(eq(nodesTable.nodeId, nodeId)).limit(1);

if (node[0]?.provisioningMode === 'local_docker' && node[0]?.containerId) {
  // Docker コンテナを停止・削除
  execSync(`docker stop ${node[0].containerId}`);
  execSync(`docker rm ${node[0].containerId}`);
}

if (node[0]?.provisioningMode === 'daytona_sandbox' && node[0]?.sandboxId) {
  // Daytona Sandbox を削除
  await fetch(`https://app.daytona.io/api/sandbox/${node[0].sandboxId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${DAYTONA_API_KEY}` }
  });
}

// provisioningMode が null (通常のPC主機ノード) → GRCデータのみ削除
await db.delete(nodesTable).where(eq(nodesTable.nodeId, nodeId));
```

**削除動作まとめ**:

| ノードタイプ | provisioningMode | 削除動作 |
|------------|-----------------|---------|
| PC主機ノード | `null` | GRCデータベースのみ削除 |
| ローカルDocker | `local_docker` | `docker stop` + `docker rm` + GRC削除 |
| Daytona Sandbox | `daytona_sandbox` | Daytona API DELETE + GRC削除 |

---

### 5.3 `POST /api/v1/admin/evolution/nodes/:nodeId/restart` — 再起動

**リクエスト**: ボディなし
**処理**:

```
ローカルDocker:
  1. 既存のcontainerId, gatewayPort, workspacePath, employeeName等をDBから取得
  2. docker stop <containerId> && docker rm <containerId>
  3. docker run -d (同じパラメータで) → 新しいcontainerId取得
  4. docker logs から新しいtokenを取得
  5. nodesTable を UPDATE (containerId, gatewayUrl)

Daytona Sandbox:
  1. 既存のsandboxId, employeeName等をDBから取得
  2. DELETE https://app.daytona.io/api/sandbox/<sandboxId>
  3. POST https://app.daytona.io/api/sandbox (最新イメージで再作成)
  4. nodesTable を UPDATE (sandboxId, gatewayUrl)
```

**レスポンス**:
```json
{
  "data": {
    "nodeId": "xxx",
    "containerId": "new-container-id",
    "gatewayUrl": "http://localhost:10001/chat?token=new-token",
    "restarted": true
  }
}
```

---

### 5.4 `GET /api/v1/admin/evolution/nodes/:nodeId/gateway` — Gateway URL取得

```
レスポンス: { "data": { "gatewayUrl": "..." } }
```

---

## 6. フロントエンド設計

### 6.1 Node 型拡張 (`hooks.ts`)

```typescript
export interface Node {
  // 既存フィールド ...
  provisioningMode: 'local_docker' | 'daytona_sandbox' | null;
  containerId: string | null;
  sandboxId: string | null;
  gatewayUrl: string | null;
  gatewayPort: number | null;
  workspacePath: string | null;
}
```

### 6.2 新しい Hooks (`hooks.ts`)

```typescript
export function useProvisionNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProvisionNodeInput) =>
      apiClient.post('/api/v1/admin/evolution/nodes/provision', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'nodes'] }),
  });
}

export function useRestartNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) =>
      apiClient.post(`/api/v1/admin/evolution/nodes/${nodeId}/restart`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'nodes'] }),
  });
}
```

### 6.3 Nodes.tsx UI 変更

#### A. ページヘッダーに「ノード作成」ボタン追加

```tsx
<div className="page-header">
  <h1 className="page-title">{t('nodes.title')}</h1>
  <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
    + {t('nodes.create.button')}
  </button>
</div>
```

#### B. 作成モーダル (Create Modal)

**ローカルDockerモード** (GRC URL が localhost):

| フィールド | 必須 | タイプ | 説明 |
|-----------|------|-------|------|
| gatewayPort | ✅ | number | ホスト側マッピングポート (例: 10001) |
| workspacePath | ✅ | text | ワークスペースのローカルパス (例: C:\work\workspaces\wk1) |
| employeeName | - | text | 社員姓名 |
| employeeCode | - | text | 社員番号 |
| employeeEmail | - | email | 社員メール |

**Daytona Sandboxモード** (GRC URL が非localhost):

| フィールド | 必須 | タイプ | 説明 |
|-----------|------|-------|------|
| employeeName | - | text | 社員姓名 |
| employeeCode | - | text | 社員番号 |
| employeeEmail | - | email | 社員メール |

#### C. アクション列の拡張

各ノード行の右端に、既存の「削除」ボタンに加えて：

```
[ Gateway ] [ 再起動 ] [ 削除 ]
```

- **Gateway ボタン** (青/primary): `provisioningMode` が non-null のノードのみ表示
  - ローカル: `window.open(node.gatewayUrl, '_blank')` — token付きURL
  - Daytona: `window.open('https://18789-<sandboxId>.pit-1.try-us.daytona.app', '_blank')`

- **再起動ボタン** (黄/warning): `provisioningMode` が non-null のノードのみ表示
  - クリック → 確認モーダル表示 → 確認後に `useRestartNode` 実行

- **削除ボタン** (赤/danger): 全ノードに表示（既存）
  - `provisioningMode` によって削除確認メッセージを変更:
    - `null`: 「GRCデータのみ削除されます」
    - `local_docker`: 「Dockerコンテナも停止・削除されます」
    - `daytona_sandbox`: 「Daytona Sandboxも削除されます」

#### D. 再起動確認モーダル

既存の削除確認モーダルと同じスタイルで:

```
⚠️ ノードを再起動しますか？

[ローカルDocker]
Dockerコンテナが停止され、同じ設定で再作成されます。

[Daytona Sandbox]
サンドボックスが削除され、最新イメージで再作成されます。

        [ キャンセル ]  [ 再起動 ]
```

---

## 7. 国際化 (i18n)

### 追加キー

#### English (`en/evolution.json`)
```json
"create": {
  "button": "Create Node",
  "title": "Create Node",
  "titleLocal": "Create Local Docker Node",
  "titleRemote": "Create Daytona Sandbox Node",
  "gatewayPort": "Gateway Port",
  "gatewayPortPlaceholder": "e.g. 10001",
  "gatewayPortRequired": "Gateway port is required",
  "workspacePath": "Workspace Directory",
  "workspacePathPlaceholder": "e.g. C:\\Users\\user\\workspaces\\wk1",
  "workspacePathRequired": "Workspace directory is required",
  "employeeName": "Employee Name",
  "employeeNamePlaceholder": "e.g. Tanaka Ichiro",
  "employeeCode": "Employee Code",
  "employeeCodePlaceholder": "e.g. 0853242",
  "employeeEmail": "Employee Email",
  "employeeEmailPlaceholder": "e.g. tanaka@company.com",
  "submit": "Create",
  "creating": "Creating...",
  "success": "Node created successfully",
  "failed": "Failed to create node: {{error}}"
},
"restart": {
  "button": "Restart",
  "title": "Restart Node",
  "confirm": "Are you sure you want to restart this node?",
  "warningLocal": "The Docker container will be stopped and recreated with the same configuration.",
  "warningRemote": "The Daytona sandbox will be destroyed and recreated with the latest image.",
  "submit": "Restart",
  "restarting": "Restarting...",
  "success": "Node restarted successfully",
  "failed": "Failed to restart: {{error}}"
},
"gateway": {
  "button": "Gateway",
  "noUrl": "Gateway URL is not available"
}
```

#### 日本語 (`ja/evolution.json`)
```json
"create": {
  "button": "ノード作成",
  "title": "ノード作成",
  "titleLocal": "ローカル Docker ノードを作成",
  "titleRemote": "Daytona Sandbox ノードを作成",
  "gatewayPort": "ゲートウェイポート",
  "gatewayPortPlaceholder": "例: 10001",
  "gatewayPortRequired": "ゲートウェイポートは必須です",
  "workspacePath": "ワークスペースディレクトリ",
  "workspacePathPlaceholder": "例: C:\\Users\\user\\workspaces\\wk1",
  "workspacePathRequired": "ワークスペースディレクトリは必須です",
  "employeeName": "社員名",
  "employeeNamePlaceholder": "例: 田中一郎",
  "employeeCode": "社員番号",
  "employeeCodePlaceholder": "例: 0853242",
  "employeeEmail": "社員メール",
  "employeeEmailPlaceholder": "例: tanaka@company.com",
  "submit": "作成",
  "creating": "作成中...",
  "success": "ノードが正常に作成されました",
  "failed": "ノード作成に失敗しました：{{error}}"
},
"restart": {
  "button": "再起動",
  "title": "ノードを再起動",
  "confirm": "このノードを再起動しますか？",
  "warningLocal": "Dockerコンテナが停止され、同じ設定で再作成されます。",
  "warningRemote": "Daytona Sandboxが削除され、最新イメージで再作成されます。",
  "submit": "再起動",
  "restarting": "再起動中...",
  "success": "ノードが正常に再起動されました",
  "failed": "再起動に失敗しました：{{error}}"
},
"gateway": {
  "button": "ゲートウェイ",
  "noUrl": "ゲートウェイURLが利用できません"
}
```

#### 中文 (`zh/evolution.json`)
```json
"create": {
  "button": "创建节点",
  "title": "创建节点",
  "titleLocal": "创建本地 Docker 节点",
  "titleRemote": "创建 Daytona Sandbox 节点",
  "gatewayPort": "网关端口",
  "gatewayPortPlaceholder": "例如 10001",
  "gatewayPortRequired": "网关端口为必填项",
  "workspacePath": "工作区目录",
  "workspacePathPlaceholder": "例如 C:\\Users\\user\\workspaces\\wk1",
  "workspacePathRequired": "工作区目录为必填项",
  "employeeName": "员工姓名",
  "employeeNamePlaceholder": "例如 张三",
  "employeeCode": "员工编号",
  "employeeCodePlaceholder": "例如 0853242",
  "employeeEmail": "员工邮箱",
  "employeeEmailPlaceholder": "例如 zhangsan@company.com",
  "submit": "创建",
  "creating": "创建中...",
  "success": "节点创建成功",
  "failed": "节点创建失败：{{error}}"
},
"restart": {
  "button": "重启",
  "title": "重启节点",
  "confirm": "确定要重启此节点吗？",
  "warningLocal": "Docker 容器将被停止并以相同配置重新创建。",
  "warningRemote": "Daytona Sandbox 将被销毁并使用最新镜像重新创建。",
  "submit": "重启",
  "restarting": "重启中...",
  "success": "节点重启成功",
  "failed": "重启失败：{{error}}"
},
"gateway": {
  "button": "网关",
  "noUrl": "网关 URL 不可用"
}
```

#### 한국어 (`ko/evolution.json`)
```json
"create": {
  "button": "노드 생성",
  "title": "노드 생성",
  "titleLocal": "로컬 Docker 노드 생성",
  "titleRemote": "Daytona Sandbox 노드 생성",
  "gatewayPort": "게이트웨이 포트",
  "gatewayPortPlaceholder": "예: 10001",
  "gatewayPortRequired": "게이트웨이 포트는 필수입니다",
  "workspacePath": "워크스페이스 디렉토리",
  "workspacePathPlaceholder": "예: C:\\Users\\user\\workspaces\\wk1",
  "workspacePathRequired": "워크스페이스 디렉토리는 필수입니다",
  "employeeName": "직원 이름",
  "employeeNamePlaceholder": "예: 홍길동",
  "employeeCode": "직원 번호",
  "employeeCodePlaceholder": "예: 0853242",
  "employeeEmail": "직원 이메일",
  "employeeEmailPlaceholder": "예: hong@company.com",
  "submit": "생성",
  "creating": "생성 중...",
  "success": "노드가 성공적으로 생성되었습니다",
  "failed": "노드 생성 실패: {{error}}"
},
"restart": {
  "button": "재시작",
  "title": "노드 재시작",
  "confirm": "이 노드를 재시작하시겠습니까?",
  "warningLocal": "Docker 컨테이너가 중지되고 동일한 설정으로 다시 생성됩니다.",
  "warningRemote": "Daytona Sandbox가 삭제되고 최신 이미지로 다시 생성됩니다.",
  "submit": "재시작",
  "restarting": "재시작 중...",
  "success": "노드가 성공적으로 재시작되었습니다",
  "failed": "재시작 실패: {{error}}"
},
"gateway": {
  "button": "게이트웨이",
  "noUrl": "게이트웨이 URL을 사용할 수 없습니다"
}
```

#### 削除モーダルの拡張キー (全4言語)

| キー | en | ja | zh | ko |
|-----|----|----|----|----|
| `delete.warningDescriptionDocker` | The Docker container will also be stopped and removed. | Dockerコンテナも停止・削除されます。 | Docker 容器也将被停止并删除。 | Docker 컨테이너도 중지 및 삭제됩니다. |
| `delete.warningDescriptionSandbox` | The Daytona Sandbox will also be deleted. | Daytona Sandboxも削除されます。 | Daytona Sandbox 也将被删除。 | Daytona Sandbox도 삭제됩니다. |

---

## 8. Token 取得の詳細

Token取得は本機能の **最重要ポイント** である。

### 8.1 docker logs からの Token 抽出

```typescript
async function extractTokenFromDockerLogs(containerId: string, maxRetries = 30): Promise<string> {
  const TOKEN_REGEX = /Token:\s+(winclaw-node-[a-f0-9]+)/;

  for (let i = 0; i < maxRetries; i++) {
    await new Promise(r => setTimeout(r, 500)); // 500ms wait

    const logs = execSync(`docker logs ${containerId} 2>&1`, { encoding: 'utf-8' });
    const match = logs.match(TOKEN_REGEX);

    if (match) {
      return match[1]; // e.g. "winclaw-node-21ab057a11af6a4657e6f1a9c027453c"
    }
  }

  throw new Error('Token not found in container logs within timeout');
}
```

### 8.2 Gateway URL の構築

```typescript
// ローカルDocker
const gatewayUrl = `http://localhost:${gatewayPort}/chat?token=${token}`;

// Daytona Sandbox
const gatewayUrl = `https://18789-${sandboxId}.pit-1.try-us.daytona.app`;
```

---

## 9. Daytona API 連携

### 9.1 認証情報

```
DAYTONA_API_KEY = dtn_a92ccd0521fdaf9bc2c173087e23a3a52edc2d67fbb6a3508871a614a474b023
DAYTONA_API_URL = https://app.daytona.io/api
DAYTONA_TARGET  = us
```

### 9.2 サンドボックス作成

```http
POST https://app.daytona.io/api/sandbox
Authorization: Bearer dtn_a92ccd...
Content-Type: application/json

{
  "image": "itccloudsoft/winclaw-node:latest",
  "target": "us",
  "envVars": {
    "WINCLAW_GRC_URL": "https://grc.myaiportal.net",
    "employee_name": "田中二",
    "employee_code": "0853242"
  },
  "resources": {
    "cpu": 2,
    "memory": 2,
    "disk": 5
  }
}
```

### 9.3 サンドボックス削除

```http
DELETE https://app.daytona.io/api/sandbox/{sandboxId}
Authorization: Bearer dtn_a92ccd...
```

---

## 10. セキュリティ考慮事項

| 項目 | 対策 |
|------|------|
| Daytona API Key | 環境変数 `DAYTONA_API_KEY` で管理。デフォルト値をコードに埋め込まない（config経由） |
| Docker コマンドインジェクション | `gatewayPort` は整数バリデーション、`workspacePath` はパスインジェクション防止 |
| Token 漏洩 | gateway_url はDB内に保存。APIレスポンスでは admin 権限のみ返却 |
| Container ID | 12文字hex形式のバリデーション |
| Sandbox ID | UUID形式のバリデーション |

---

## 11. UI レイアウト（アクション列）

### 現在:
```
[ 削除 ]
```

### 変更後:
```
[ Gateway ] [ 再起動 ] [ 削除 ]
   (青)       (黄)      (赤)
```

- **Gateway**: `provisioningMode` が non-null のノードのみ表示
- **再起動**: `provisioningMode` が non-null のノードのみ表示
- **削除**: 全ノードに常に表示

通常のPC主機ノード（`provisioningMode = null`）には `[ 削除 ]` のみ表示される。

---

## 12. 実装順序

| Step | 内容 | 所要時間目安 |
|------|------|------------|
| 1 | DB migration + Drizzle schema | 5分 |
| 2 | バックエンド: POST /nodes/provision (Docker) | 20分 |
| 3 | バックエンド: POST /nodes/provision (Daytona) | 15分 |
| 4 | バックエンド: DELETE拡張 (Docker/Sandbox削除) | 10分 |
| 5 | バックエンド: POST /nodes/:nodeId/restart | 15分 |
| 6 | フロントエンド: hooks.ts 型拡張 + hooks追加 | 5分 |
| 7 | フロントエンド: 作成モーダル (Local) | 15分 |
| 8 | フロントエンド: 作成モーダル (Daytona) | 10分 |
| 9 | フロントエンド: 再起動・Gatewayボタン | 10分 |
| 10 | i18n: 4言語の翻訳キー追加 | 10分 |
| 11 | テスト: ローカルDocker作成→接続→再起動→削除 | 10分 |

**合計: 約 2時間**

---

## 13. テスト計画

### 13.1 ローカルDocker テスト

```bash
# 1. ノード作成 (port 10003, workspace C:\work\workspaces\test1)
# 2. Gateway ボタン → http://localhost:10003/chat?token=xxx が開く
# 3. GRC ダッシュボードにノードが表示される
# 4. 再起動 → 新しい container_id, 新しい token で動作確認
# 5. 削除 → docker ps でコンテナが消えていることを確認
```

### 13.2 Daytona Sandbox テスト

```bash
# 1. ノード作成 (Daytona API 経由)
# 2. Gateway ボタン → https://18789-<id>.pit-1.try-us.daytona.app が開く
# 3. 再起動 → 新しい sandbox_id で動作確認
# 4. 削除 → Daytona Dashboard でサンドボックスが消えていることを確認
```

### 13.3 通常PCノード テスト

```bash
# 1. 既存のPC主機ノードの削除ボタン → GRCデータのみ削除
# 2. 再起動/Gatewayボタンが表示されないことを確認
```
