# GRC Server タイムゾーン / JWT 修正マージプラン

**日付**: 2026-03-11
**問題**: MySQL (東京タイムゾーン JST=UTC+9) と Node.js コード (UTC) のタイムゾーン不一致により、verification_codes テーブルの有効期限判定が破綻し、JWT 認証フロー (メール認証・ペアリング) が失敗する。

---

## 修正元ファイル

```
C:\Users\USER\Downloads\grc-server.fixed\grc-server.fixed\
├── src/config.ts
├── src/modules/auth/routes.ts
├── src/modules/auth/schema.ts
├── src/modules/auth/service.ts
└── src/shared/db/datetime-utc.ts  ← 新規ファイル
```

## 適用先

```
C:\work\grc\
```

---

## 変更サマリー（5 ファイル）

### 1. 新規: `src/shared/db/datetime-utc.ts` ★ タイムゾーン修正の核心

**アクション**: ファイルをそのまま新規作成

カスタム Drizzle カラム型。`timestamp` の代わりに `datetime` を使い、ローカルタイムゾーン（TZ 環境変数に従う）で Date ↔ MySQL 文字列を変換する。MySQL の `timestamp` 型は自動的に UTC 変換されるため、サーバーの TZ が MySQL と異なる場合にズレが生じるが、`datetime` 型はリテラル文字列として保存されるため TZ 問題を回避できる。

```typescript
// toDriver: Date → "YYYY-MM-DD HH:MM:SS" (ローカル時刻)
// fromDriver: "YYYY-MM-DD HH:MM:SS" → Date (ローカル時刻として解釈)
```

---

### 2. 修正: `src/modules/auth/schema.ts`

**アクション**: 差分適用（3 箇所）

#### 変更点 A — import 追加
```diff
 import crypto from "node:crypto";
+import { datetimeUtc } from "../../shared/db/datetime-utc.js";
 import {
   mysqlTable,
```

#### 変更点 B — verification_codes テーブルの 3 カラムを `timestamp` → `datetimeUtc` に変更
```diff
     code: varchar("code", { length: 64 }).notNull(), // SHA256 hash length
-    expiresAt: timestamp("expires_at").notNull(),
-    usedAt: timestamp("used_at"),
+    expiresAt: datetimeUtc("expires_at").notNull(),
+    usedAt: datetimeUtc("used_at"),
     attempts: int("attempts").notNull().default(0),
-    createdAt: timestamp("created_at").notNull().defaultNow(),
+    createdAt: datetimeUtc("created_at").notNull().$defaultFn(() => new Date()),
```

**理由**: `timestamp` 型は MySQL が UTC 変換を行うため、東京 TZ の MySQL では JS `new Date()` (UTC) との間に 9 時間のズレが発生。`datetime` 型に切り替えることで、保存した値がそのまま返される。

---

### 3. 修正: `src/modules/auth/service.ts`

**アクション**: 差分適用（4 箇所の機能変更 + ログ追加）

#### 変更点 A — `sendVerificationCode()` のレートリミット条件強化 (L573-584)
```diff
-    // Rate limit: check if a code was sent to this email within the last 60 seconds
+    // Rate limit: check if an unused, unexpired code was sent to this email within the last 60 seconds
     const recent = await db
       .select()
       .from(verificationCodes)
       .where(
         and(
           eq(verificationCodes.email, normalizedEmail),
           gt(verificationCodes.createdAt, cutoff),
+          isNull(verificationCodes.usedAt),
+          gt(verificationCodes.expiresAt, new Date()),
         ),
       )
       .limit(1);
```
**理由**: 使用済みまたは期限切れのコードがあっても、新しいコードを送信できるようにする。

#### 変更点 B — `sendVerificationCode()` の INSERT を raw SQL に変更 (L592-608)
```diff
-    const expiresAt = new Date(Date.now() + CODE_EXPIRES_MINUTES * 60 * 1000);
-
-    await db.insert(verificationCodes).values({
-      id: uuidv4(),
-      email: normalizedEmail,
-      code: hmacSha256(code, this.config.jwt.privateKey),
-      expiresAt,
-    });
+    const recordId = uuidv4();
+
+    // Insert record using raw SQL to set expires_at = created_at + 5 minutes
+    // This avoids JavaScript timezone conversion issues
+    await db.execute(sql`
+      INSERT INTO verification_codes (id, email, code, created_at, expires_at, attempts)
+      VALUES (
+        ${recordId},
+        ${normalizedEmail},
+        ${hmacSha256(code, this.config.jwt.privateKey)},
+        NOW(),
+        DATE_ADD(NOW(), INTERVAL ${CODE_EXPIRES_MINUTES} MINUTE),
+        0
+      )
+    `);
```
**理由**: ★ **タイムゾーン修正の核心部分**。JS の `new Date()` は UTC タイムスタンプを返すが、MySQL の `NOW()` はサーバーの TZ (東京) に従うため、`created_at` と `expires_at` が MySQL 側の時刻と整合する。`DATE_ADD(NOW(), INTERVAL 5 MINUTE)` で正確な 5 分後を保証。

#### 変更点 C — `verifyCode()` の期限チェックを SQL NOW() に変更 (L627)
```diff
     const rows = await db
       .select()
       .from(verificationCodes)
       .where(
         and(
           eq(verificationCodes.email, normalizedEmail),
-          gt(verificationCodes.expiresAt, new Date()),
+          sql`${verificationCodes.expiresAt} > NOW()`,
           isNull(verificationCodes.usedAt),
         ),
       )
```
**理由**: ★ JS の `new Date()` (UTC) と MySQL に保存された `expires_at` (ローカル TZ) を比較すると 9 時間ズレるため、MySQL 側の `NOW()` で比較する。

#### 変更点 D — ログ追加（複数箇所）
以下の箇所にデバッグ/警告ログを追加:
- `verifyCode()`: レコード未発見時、レコード発見時の詳細、コード不一致時、消費時
- `registerWithEmail()`: 開始ログ、失敗理由ログ

これらは **機能変更なし** のログ強化のみ。

---

### 4. 修正: `src/modules/auth/routes.ts`

**アクション**: 差分適用（2 箇所）

#### 変更点 A — `/email/verify-code` の consume パラメータ修正 (L411)
```diff
-      const verified = await authService.verifyCode(body.email, body.code, true);
+      const verified = await authService.verifyCode(body.email, body.code, false);
```
**理由**: verify-code エンドポイントは確認のみで消費しない。`consume=true` だと登録前にコードが使用済みになり、後続の register が常に失敗する。3 ステップフロー (send-code → verify-code → register) に合致させる。

#### 変更点 B — `/email/register` のスキーマ検証エラーログ (L424-430)
```diff
-      const body = emailRegisterSchema.parse(req.body);
+      let body;
+      try {
+        body = emailRegisterSchema.parse(req.body);
+      } catch (err) {
+        logger.warn({ error: err, body: req.body }, "Email registration schema validation failed");
+        throw err;
+      }
```
**理由**: デバッグ用ログ追加のみ。スキーマバリデーション失敗時にリクエストボディを記録。

---

### 5. 修正: `src/config.ts`

**アクション**: 差分適用（1 箇所のみ — PEM 改行処理）

#### 変更点 A — JWT PEM キーの `\n` リテラル置換 ★ 適用必須 (L126-127)
```diff
-  let jwtPrivateKey = process.env.JWT_PRIVATE_KEY?.trim() || "";
-  let jwtPublicKey = process.env.JWT_PUBLIC_KEY?.trim() || "";
+  // Replace literal \n with actual newlines for PEM format
+  let jwtPrivateKey = (process.env.JWT_PRIVATE_KEY?.trim() || "").replace(/\\n/g, "\n");
+  let jwtPublicKey = (process.env.JWT_PUBLIC_KEY?.trim() || "").replace(/\\n/g, "\n");
```
**理由**: ★ Kubernetes Secret / AKS 環境変数では PEM キーの改行が `\n` リテラル文字列として渡されることが多い。`.replace(/\\n/g, "\n")` で実際の改行に変換しないと、JWT 署名/検証に失敗する。

#### ⚠️ 適用しない項目 (current repo の方が新しい)
以下の差分は fixed ファイル側が古いバージョンのため、**適用しない**:
- `"model-keys"` モジュールの削除 → 現行 repo には `"model-keys"` が追加済み。維持する
- デフォルト DB URL の変更 → 現行 repo の `mysql://root:Admin123@13.78.81.86:18306/grc-server` を維持する

---

## 適用手順チェックリスト

```
□ 1. 新規ファイル作成
     src/shared/db/datetime-utc.ts をそのままコピー

□ 2. schema.ts 修正
     - datetimeUtc import 追加
     - verification_codes の expiresAt, usedAt, createdAt を datetimeUtc に変更

□ 3. service.ts 修正
     - sendVerificationCode() のレートリミット条件に isNull + gt 追加
     - sendVerificationCode() の INSERT を raw SQL (NOW(), DATE_ADD) に変更
     - verifyCode() の期限チェックを sql`... > NOW()` に変更
     - 各所にデバッグログ追加

□ 4. routes.ts 修正
     - /email/verify-code の consume を true → false に変更
     - /email/register にスキーマ検証エラーログ追加

□ 5. config.ts 修正
     - JWT キーの \n リテラル置換追加
     - ⚠️ "model-keys" モジュールは削除しない
     - ⚠️ デフォルト DB URL は変更しない

□ 6. ビルド & テスト
     - npm run build (TypeScript コンパイル確認)
     - メール認証フロー E2E テスト
     - ペアリングフロー E2E テスト

□ 7. DB マイグレーション
     - verification_codes テーブルの expires_at, used_at, created_at を
       TIMESTAMP → DATETIME に ALTER TABLE する必要がある可能性あり
       (Drizzle の customType は DDL に影響しないため、既存データとの
       互換性を確認すること)
```

---

## リスク評価

| リスク | 影響度 | 対策 |
|--------|--------|------|
| DB カラム型不一致 (TIMESTAMP vs DATETIME) | 中 | 既存テーブルの DDL を確認。`datetimeUtc` は SQL 上 `datetime` を生成するため、既存が `timestamp` なら ALTER TABLE が必要 |
| `model-keys` モジュール消失 | 高 | fixed ファイルの config.ts からは model-keys が削除されているが、**現行 repo のまま維持** |
| デフォルト DB URL 上書き | 中 | fixed ファイルは `localhost` だが、**現行 repo の外部 IP を維持** |
| 既存 verification_codes データ | 低 | TZ 変更により既存レコードの有効期限解釈が変わる可能性。デプロイ前に未使用コードをクリーンアップ推奨 |

---

## 根本原因の解説

```
MySQL サーバー: TZ = Asia/Tokyo (UTC+9)
Node.js (AKS): TZ = UTC (デフォルト)

旧コード (TIMESTAMP 型):
  JS: new Date("2026-03-11T10:00:00Z")  // UTC 10:00
  → MySQL TIMESTAMP: 自動変換 → "2026-03-11 19:00:00" (JST で保存)
  → 読み出し時: MySQL → "2026-03-11 19:00:00" → JS は UTC として解釈
  → 結果: 9時間ズレ → 有効期限判定が破綻

修正後 (DATETIME 型 + NOW()):
  MySQL NOW(): "2026-03-11 19:00:00" (JST)
  → DATETIME: そのまま "2026-03-11 19:00:00" で保存 (TZ 変換なし)
  → expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE) = "2026-03-11 19:05:00"
  → 比較: expires_at > NOW() → 同一 TZ 内で完結 → 正確
```
