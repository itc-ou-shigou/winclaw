# WinClaw Multi-SNS Connection Proposal

> **Version**: 1.0
> **Date**: 2025-02-15
> **Status**: Review待ち

---

## 1. 現状分析

### 1.1 対応済みチャネル（19プラットフォーム）

WinClawは既に19のメッセージングプラットフォームに対応するExtensionを持っています：

| # | プラットフォーム | Extension | 接続方式 | QRスキャン | マルチアカウント | 状態 |
|---|----------------|-----------|---------|-----------|----------------|------|
| 1 | **WhatsApp** | `whatsapp` | QRコード (Baileys) | ✅ 対応済み | ✅ 対応済み | 安定 |
| 2 | **Telegram** | `telegram` | Bot Token (BotFather) | ❌ 不可 | ✅ 対応済み | 安定 |
| 3 | **Discord** | `discord` | Bot Token | ❌ 不可 | ✅ 対応済み | 安定 |
| 4 | **Slack** | `slack` | Bot Token + App Token | ❌ 不可 | ✅ 対応済み | 安定 |
| 5 | **Signal** | `signal` | signal-cli (リンク) | ⚠️ 部分的 | ✅ 対応済み | 安定 |
| 6 | **iMessage** | `imessage` | macOS限定 (AppleScript) | ❌ 不可 | ❌ 単一 | macOSのみ |
| 7 | **Google Chat** | `googlechat` | Service Account | ❌ 不可 | ✅ 対応済み | 安定 |
| 8 | **MS Teams** | `msteams` | App Credentials | ❌ 不可 | ✅ 対応済み | 安定 |
| 9 | **LINE** | `line` | Messaging API Token | ❌ 不可 | ✅ 対応済み | 安定 |
| 10 | **Feishu (飛書)** | `feishu` | App ID + Secret | ❌ 不可 | ✅ 対応済み | 安定 |
| 11 | **Matrix** | `matrix` | ユーザーID + Token | ❌ 不可 | ✅ 対応済み | 安定 |
| 12 | **Mattermost** | `mattermost` | Bot Token + URL | ❌ 不可 | ✅ 対応済み | 安定 |
| 13 | **Nextcloud Talk** | `nextcloud-talk` | ユーザー認証 | ❌ 不可 | ✅ 対応済み | 安定 |
| 14 | **Nostr** | `nostr` | 秘密鍵 | ❌ 不可 | ✅ 対応済み | 実験的 |
| 15 | **Zalo (公式)** | `zalo` | OA Token | ❌ 不可 | ✅ 対応済み | 安定 |
| 16 | **Zalo (個人)** | `zalouser` | Cookie認証 | ❌ 不可 | ✅ 対応済み | 非公式 |
| 17 | **BlueBubbles** | `bluebubbles` | Server URL + Password | ❌ 不可 | ❌ 単一 | 安定 |
| 18 | **Tlon** | `tlon` | Ship Name + Code | ❌ 不可 | ✅ 対応済み | 実験的 |
| 19 | **Twitch** | `twitch` | OAuth Token | ❌ 不可 | ✅ 対応済み | 安定 |

### 1.2 現在のアーキテクチャ

```
Gateway (server-channels.ts)
├── ChannelManager
│   ├── startChannels() → 全チャネル一括起動
│   ├── startChannel(name) → 個別チャネル起動
│   └── stopChannel(name) → 個別チャネル停止
│
├── Per-Channel Plugin
│   ├── config.listAccountIds() → アカウント一覧取得
│   ├── gateway.startAccount(id) → アカウント個別起動
│   └── Per-Account AbortController
│
└── Config (openclaw.json)
    └── channels.<platform>.<accountId> → アカウント設定
```

**重要な発見**: マルチアカウント対応は**アーキテクチャレベルで既に実装済み**です。各チャネルプラグインが `listAccountIds()` を提供し、`startAccount()` で個別に起動されます。

### 1.3 WhatsApp QRフローの詳細（参考実装）

```
ユーザー → Gateway Web UI → /api/login-qr/start
                                ↓
                    Baileys makeWASocket() 起動
                                ↓
                    QRコード生成 (qr-image.ts)
                                ↓
                    renderQrPngBase64() → Web UIに表示
                                ↓
                    ユーザーがスマホでスキャン
                                ↓
                    認証完了 → ~/.openclaw/oauth/whatsapp/{id}/
                                ↓
                    チャネル接続開始
```

---

## 2. 問題点と課題

### 2.1 現在の問題

| 問題 | 詳細 |
|------|------|
| **統一UIがない** | 新しいSNSを追加するには設定ファイルを手動編集するか、AI経由のコマンド実行が必要 |
| **QR対応が限定的** | 19チャネル中、QRスキャンで接続できるのはWhatsAppのみ |
| **接続方式がバラバラ** | Bot Token、API Key、QR、Cookie等、プラットフォーム毎に全く異なる |
| **一般ユーザーには難しい** | Discord Bot作成、Telegram BotFather等の開発者向け手順が必要 |
| **WeChat未対応** | 中国市場で最重要のWeChatに対応するExtensionが存在しない |

### 2.2 プラットフォーム別の接続難易度

```
[簡単] ────────────────────────────────── [難しい]
  │                                          │
  WhatsApp    Signal     Telegram   Discord   Slack
  (QRスキャン)  (QR+CLI)  (BotFather) (Dev Portal) (App作成)
                                     │
                              LINE   Google Chat
                           (Dev Console) (GCP)
                                     │
                                  MS Teams
                                (Azure AD)
```

---

## 3. 提案：統一SNS接続フロー

### 3.1 方案A：「スキャン＆コネクト」ウィザード（推奨）

**コンセプト**: 全プラットフォームに対して統一的な「追加」フローを提供。QR対応プラットフォームはスキャン、それ以外はAIガイド付きステップバイステップ。

#### UI フロー

```
┌─────────────────────────────────────────┐
│  ＋ SNS を追加                           │
│                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 📱  │ │ 💬  │ │ 📨  │ │ 🎮  │      │
│  │ WA  │ │ TG  │ │LINE │ │ DC  │      │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐      │
│  │ 💼  │ │ 📡  │ │ 🔒  │ │ 🐦  │      │
│  │Slack│ │Teams│ │Signal│ │Twitch│     │
│  └─────┘ └─────┘ └─────┘ └─────┘      │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🔍 その他のプラットフォームを検索... │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
            ↓ WhatsAppを選択
┌─────────────────────────────────────────┐
│  📱 WhatsApp を接続                      │
│                                         │
│  ステップ 1/2: QRコードをスキャン         │
│                                         │
│  ┌─────────────────────┐                │
│  │                     │                │
│  │    ██████████████   │                │
│  │    ██          ██   │                │
│  │    ██  ██████  ██   │                │
│  │    ██  ██████  ██   │                │
│  │    ██          ██   │                │
│  │    ██████████████   │                │
│  │                     │                │
│  └─────────────────────┘                │
│                                         │
│  スマートフォンのWhatsAppで              │
│  設定 → リンク済みデバイス →              │
│  デバイスをリンク をタップしてスキャン     │
│                                         │
│  [キャンセル]              [再生成]       │
└─────────────────────────────────────────┘
            ↓ Telegramを選択
┌─────────────────────────────────────────┐
│  💬 Telegram を接続                      │
│                                         │
│  ステップ 1/3: Botを作成                 │
│                                         │
│  Telegramで @BotFather にメッセージを     │
│  送信し、/newbot コマンドでBotを作成      │
│  してください。                           │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Bot Token を貼り付け             │    │
│  │ 例: 123456:ABC-DEF...           │    │
│  └─────────────────────────────────┘    │
│                                         │
│  💡 わからない場合は「手伝って」と        │
│     チャットで聞いてください              │
│                                         │
│  [戻る]                    [接続テスト]   │
└─────────────────────────────────────────┘
```

#### 接続タイプ別のフロー分類

| タイプ | フロー | 対象プラットフォーム |
|--------|--------|---------------------|
| **Type A: QRスキャン** | QR表示 → スマホスキャン → 自動接続 | WhatsApp, Signal |
| **Type B: Token貼り付け** | ガイド表示 → Token入力 → 接続テスト | Telegram, Discord, LINE, Twitch |
| **Type C: OAuth認証** | 認証画面リダイレクト → 承認 → コールバック | Slack, Google Chat, MS Teams |
| **Type D: AIガイド** | チャットでAIが手順を案内 → 設定自動適用 | Feishu, Matrix, Mattermost, etc. |

#### 技術実装

```typescript
// 新規API: channels.wizard
interface WizardAPI {
  // ウィザード開始 - プラットフォーム情報を返す
  "channels.wizard.start": {
    params: { platform: string; accountId?: string };
    returns: {
      connectionType: "qr" | "token" | "oauth" | "guided";
      steps: WizardStep[];
      currentStep: number;
    };
  };

  // QRタイプ: QRコード取得
  "channels.wizard.qr": {
    params: { platform: string; accountId: string };
    returns: {
      qrDataUrl: string;  // base64 PNG
      expiresIn: number;  // seconds
      status: "pending" | "scanned" | "connected" | "expired";
    };
  };

  // Tokenタイプ: Token検証＆保存
  "channels.wizard.token": {
    params: { platform: string; accountId: string; token: string };
    returns: {
      valid: boolean;
      botName?: string;
      error?: string;
    };
  };

  // OAuthタイプ: 認証URL取得
  "channels.wizard.oauth": {
    params: { platform: string; accountId: string };
    returns: {
      authUrl: string;
      state: string;
    };
  };

  // 接続テスト
  "channels.wizard.test": {
    params: { platform: string; accountId: string };
    returns: {
      connected: boolean;
      details: { botName: string; channelCount: number };
    };
  };
}
```

### 3.2 方案B：「チャットドリブン」接続

**コンセプト**: UI上のウィザードは最小限にし、AIとの会話で全て完結。

```
ユーザー: 「Telegramを追加したい」
AI: 「Telegram Botを作成しましょう。以下の手順で進めます：
     1. Telegramで @BotFather を開いてください
     2. /newbot と送信してください
     3. Bot名とユーザー名を設定してください
     4. 取得したTokenを貼り付けてください」
ユーザー: 「123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11」
AI: 「✅ Token検証OK！Bot名: MyAssistant
     接続テスト中... 成功！
     Telegram @MyAssistant_bot が接続されました。

     次の設定をしますか？
     - DM許可ポリシー（現在: ペアリング制）
     - グループ参加の許可
     - メッセージ履歴の保持数」
```

**メリット**: UI開発コスト最小、スキルベースで既に実装可能（winclaw-channelsスキル）
**デメリット**: QRスキャンフローの視覚的表示が難しい

### 3.3 方案C：ハイブリッド方式（A+B統合、最推奨）

**コンセプト**: QR対応プラットフォームはUIウィザード、それ以外はAIチャットガイド。

```
┌──────────────────────────────────────────────────┐
│  接続済み SNS                                     │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────┐      │
│  │ 📱 WhatsApp      │  │ 💬 Telegram      │      │
│  │ +81-90-xxxx ✅   │  │ @MyBot ✅        │      │
│  │ 最終: 3分前      │  │ 最終: 1時間前     │      │
│  └──────────────────┘  └──────────────────┘      │
│                                                  │
│  ┌──────────────────┐                            │
│  │ 🎮 Discord       │                            │
│  │ MyClaw#1234 ✅   │                            │
│  │ 最終: 5分前      │                            │
│  └──────────────────┘                            │
│                                                  │
│  ─────────────────────────────────────────        │
│                                                  │
│  ＋ 新しいSNSを追加                               │
│                                                  │
│  📷 QRスキャンで追加:                              │
│  [WhatsApp] [Signal]                             │
│                                                  │
│  💬 チャットで追加（AIがガイド）:                    │
│  [Telegram] [Discord] [LINE] [Slack]             │
│  [Teams] [その他...]                              │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### 実装ロードマップ

```
Phase 1 (2週間) - 基盤
├── channels.wizard API 実装
├── QRフロー統一化（WhatsApp既存コード流用）
├── Token検証API共通化
└── winclaw-channels スキル強化

Phase 2 (2週間) - UI
├── 「SNS追加」ウィザードUI
├── QRコード表示コンポーネント
├── 接続状態ダッシュボード
└── リアルタイムステータス更新（WebSocket）

Phase 3 (2週間) - 拡張
├── OAuth フロー対応（Slack, Teams, Google Chat）
├── 友達追加フロー（WhatsApp連絡先, Telegram招待リンク）
├── マルチアカウント管理UI
└── 接続トラブルシューティング自動化

Phase 4 (オプション) - 新プラットフォーム
├── WeChat対応（※技術的困難、後述）
├── KakaoTalk対応（API調査必要）
├── Instagram DM対応（Meta Graph API）
└── Facebook Messenger対応（Meta Graph API）
```

---

## 4. プラットフォーム別の実装難易度

### 4.1 QRスキャン対応可能なプラットフォーム

| プラットフォーム | QR実装方法 | 難易度 | 備考 |
|----------------|-----------|--------|------|
| **WhatsApp** | Baileys (既存) | ✅ 実装済み | そのまま使える |
| **Signal** | signal-cli リンク | ⭐⭐ | QR生成にsignal-cli必要、デバイスリンクQR対応 |
| **LINE** | LIFF/Login | ⭐⭐⭐ | 公式Bot APIはToken方式、個人アカウントQRは非公式 |
| **WeChat** | wechaty/puppet | ⭐⭐⭐⭐⭐ | 非公式API、Ban リスク高、UOS-patchで一部可能 |
| **KakaoTalk** | なし | ⭐⭐⭐⭐⭐ | 公式API未公開、リバースエンジニアリング必要 |

### 4.2 Token/API Key方式のプラットフォーム

| プラットフォーム | 簡易化方法 | 難易度 | 備考 |
|----------------|-----------|--------|------|
| **Telegram** | BotFatherリンク → Token貼付 | ⭐ | AIガイドで充分簡単 |
| **Discord** | Dev Portal → Token貼付 | ⭐⭐ | Intent設定が必要 |
| **Twitch** | OAuth Token | ⭐⭐ | OAuth フロー自動化可能 |

### 4.3 OAuth方式のプラットフォーム

| プラットフォーム | 簡易化方法 | 難易度 | 備考 |
|----------------|-----------|--------|------|
| **Slack** | OAuth Install URL | ⭐⭐ | App作成は1回、Install URLでワンクリック |
| **Google Chat** | Service Account | ⭐⭐⭐ | GCPプロジェクト設定が必要 |
| **MS Teams** | Azure AD App | ⭐⭐⭐⭐ | Azure設定が複雑 |

---

## 5. 友達追加・連絡先管理

### 5.1 現在の仕組み

WinClawの各チャネルには `dmPolicy` と `allowFrom` で誰と会話できるかを制御：

```json
{
  "channels": {
    "whatsapp": {
      "default": {
        "dmPolicy": "pairing",     // pairing | allowlist | open | disabled
        "allowFrom": [],            // ホワイトリスト (user IDs)
        "groupPolicy": "open",     // グループメッセージポリシー
        "groupAllowFrom": []       // グループホワイトリスト
      }
    }
  }
}
```

### 5.2 友達追加フロー提案

```
┌────────────────────────────────────────────┐
│  👥 友達・連絡先管理                         │
│                                            │
│  WhatsApp の連絡先:                         │
│  ┌────────────────────────────┐            │
│  │ 📱 田中太郎 (+81-90-xxxx) │ [許可] [拒否] │
│  │ 📱 佐藤花子 (+81-80-xxxx) │ [許可] [拒否] │
│  │ 📱 (新規) +1-555-xxxx    │ [許可] [拒否] │
│  └────────────────────────────┘            │
│                                            │
│  Telegram の連絡先:                         │
│  ┌────────────────────────────┐            │
│  │ 💬 @alice ペアリング待ち    │ [承認]      │
│  │ 💬 @bob   接続済み         │ [管理]      │
│  └────────────────────────────┘            │
│                                            │
│  ─── ペアリングコード ───                    │
│  新しいユーザーにこのコードを共有:            │
│  ┌──────────────────────┐                  │
│  │ winclaw:pair:a3xK9m  │  [コピー]        │
│  └──────────────────────┘                  │
│  またはQRコードで共有:                       │
│  [QRコードを表示]                            │
└────────────────────────────────────────────┘
```

#### ペアリングフロー

```
1. WinClawユーザー → ペアリングコード/QR生成
2. 友達 → WinClawのBot宛にペアリングコードを送信
3. WinClaw → 自動承認 or 手動承認（設定による）
4. 以後、友達はWinClawのAIと会話可能
```

---

## 6. WeChat対応について（特別セクション）

### 6.1 技術的課題

WeChatは最も実装が困難なプラットフォームです：

| 課題 | 詳細 |
|------|------|
| **公式APIなし** | WeChat Bot APIは企業向けのみ（WeWork/企業微信） |
| **非公式APIリスク** | wechaty/itchat等の非公式ライブラリはアカウントBANのリスクが高い |
| **UOS patch** | 一部の非公式ツールはUOSブラウザを偽装するが不安定 |
| **Web WeChat制限** | 2017年以降、新規アカウントではWeb WeChat無効化 |
| **法的リスク** | 中国国内法でのリバースエンジニアリング制限 |

### 6.2 WeChat対応の選択肢

| 方式 | 実現性 | リスク | 備考 |
|------|--------|--------|------|
| **A. 企業微信API** | ⭐⭐⭐ | 低 | 企業アカウント必要、個人利用には不向き |
| **B. wechaty (puppet-wechat4u)** | ⭐⭐ | 高 | BANリスク、不安定 |
| **C. wechaty (puppet-padlocal)** | ⭐⭐⭐ | 中 | 有料サービス、iPad プロトコル |
| **D. 対応見送り** | — | — | 他プラットフォーム強化に集中 |

**推奨**: 初期リリースではWeChat対応を**見送り**、企業微信APIでの限定対応を将来検討。

---

## 7. 推奨実装計画

### 7.1 方案Cハイブリッド方式で段階実装

#### 即座に実現可能（スキルベース、UI変更なし）

既に作成した `winclaw-channels` スキルで以下が可能：
- ✅ AIチャットでTelegram Bot追加
- ✅ AIチャットでDiscord Bot追加
- ✅ AIチャットでSlack App追加
- ✅ AIチャットでチャネル有効/無効切り替え
- ✅ AIチャットで接続状態確認
- ✅ AIチャットでDMポリシー変更

#### Phase 1: QR統一化 + ダッシュボード (2-3週間)

```
開発項目:
1. channels.wizard API（4つのメソッド）
2. 接続状態ダッシュボードUI
3. WhatsApp QRフローのウィザード統合
4. Signal QRリンクフロー追加
```

#### Phase 2: ガイド付きセットアップ (2週間)

```
開発項目:
1. Telegram セットアップウィザード（手順表示 + Token入力）
2. Discord セットアップウィザード（手順表示 + Token入力 + Intent確認）
3. LINE セットアップウィザード
4. 接続テスト自動化
```

#### Phase 3: OAuth + 友達管理 (3週間)

```
開発項目:
1. Slack OAuth Install URL フロー
2. MS Teams Azure AD フロー
3. 友達ペアリングシステム
4. 連絡先管理UI
```

### 7.2 工数見積もり

| Phase | 期間 | 主な成果物 |
|-------|------|-----------|
| Phase 0 (完了) | - | winclaw-channels スキル（AIガイド） |
| Phase 1 | 2-3週間 | QR接続 + ダッシュボード |
| Phase 2 | 2週間 | Token接続ウィザード |
| Phase 3 | 3週間 | OAuth + 友達管理 |
| **合計** | **7-8週間** | **統一SNS管理システム** |

---

## 8. 比較まとめ

| 項目 | 方案A (ウィザード) | 方案B (チャット) | 方案C (ハイブリッド) |
|------|------------------|-----------------|---------------------|
| 開発コスト | 高 | 低（既存スキルで対応） | 中 |
| ユーザー体験 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| QR対応 | ✅ 完全 | ⚠️ チャット内で画像表示 | ✅ 完全 |
| Token入力 | UI入力フォーム | チャット内貼付 | 両方対応 |
| 拡張性 | 新UI開発必要 | スキル追加のみ | スキル + 必要に応じUI |
| 一般ユーザー向け | ◎ | △ | ◎ |
| 即座に利用可能 | ✗ | ✅ (Phase 0) | ✅ (Phase 0 + 段階拡張) |
| **推奨度** | ★★★ | ★★ | **★★★★★** |

---

## 9. 結論と推奨

### 推奨: 方案C「ハイブリッド方式」

**理由**:
1. **即座に効果**: 既存のwinclaw-channelsスキルで、今日からAIガイド接続が可能
2. **段階的改善**: UIウィザードは優先度高いもの（QR）から段階追加
3. **コスト効率**: 全プラットフォーム用のUI開発は不要、必要なものだけ
4. **WinClawの思想に合致**: 「設定はAIに任せる」というコンセプトと整合

### 次のアクション

- [ ] 方案C承認後、Phase 1の詳細設計開始
- [ ] channels.wizard API仕様の確定
- [ ] 新UI（UI-REDESIGN-PROPOSALS.md）との統合計画
- [ ] WeChat対応の最終判断（見送り or 企業微信限定）
