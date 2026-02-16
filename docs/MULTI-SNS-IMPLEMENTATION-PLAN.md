# Multi-SNS Connection - Plan C Implementation Details

> **Version**: 2.0
> **Date**: 2025-02-15
> **Status**: Review (Updated - Skill-first approach, no code changes)

---

## UPDATE NOTE

After further review, the implementation plan has been revised:
- **Phase 0 (Completed)**: `winclaw-sns-wizard` skill created — AI can now guide users through connecting any of the 19 supported platforms via chat, without ANY code changes
- **Phases 1-3 below are FUTURE reference only** — code changes require separate review and approval
- WhatsApp's QR login works through `web.login.start`/`web.login.wait` API, which is specifically designed for the Baileys protocol — this must NOT be modified

---

## Overview

Based on thorough code analysis, this document specifies the exact files to modify, new files to create, and the implementation approach for Plan C (Hybrid: QR + AI Chat Guide).

**Important constraints discovered during analysis:**
- Only WhatsApp and Zalo Personal support QR code login (via `loginWithQrStart`/`loginWithQrWait`)
- This is by design — each platform's authentication protocol is fundamentally different
- The existing code architecture is well-designed and should not be modified without careful review

---

## Architecture Summary (Current State)

```
UI Layer (Lit Web Components)          Gateway Layer (Node.js)           Channel Plugins
─────────────────────────────          ─────────────────────────         ──────────────────
ui/src/ui/                              src/gateway/                     extensions/
├── app.ts (main state)                 ├── server-methods.ts            ├── whatsapp/
├── app-channels.ts (WA flow)           │   (handler registry)          │   └── src/channel.ts
├── controllers/                        ├── server-methods/              ├── telegram/
│   └── channels.ts (API calls)         │   ├── channels.ts             │   └── src/channel.ts
├── views/                              │   ├── web.ts (QR login)       ├── discord/
│   ├── channels.ts (main view)         │   ├── config.ts               ├── slack/
│   ├── channels.whatsapp.ts            │   └── wizard.ts               └── ... (19 total)
│   ├── channels.telegram.ts            └── server-channels.ts
│   └── channels.config.ts                 (lifecycle mgr)
└── navigation.ts (tabs/routes)
```

**Key Discovery: The platform already has:**
- `ChannelGatewayAdapter.loginWithQrStart/loginWithQrWait` interface (but only WhatsApp implements it)
- `web.login.start` / `web.login.wait` API methods (generic, finds QR-capable plugin)
- `channels.status` with `probe` parameter for health checks
- `channels.logout` for disconnection
- `config.patch` with hash-based optimistic locking
- `wizard.start/next/cancel` for step-by-step flows
- Channel plugin catalog with UI metadata (labels, icons, order)
- Multi-account support via `listAccountIds()` / `startAccount()` pattern

---

## Phase 1: Channel Connection Wizard API (Backend)

### 1.1 New File: `src/gateway/server-methods/channel-wizard.ts`

**Purpose**: Unified API for adding/connecting new channel accounts

```
Methods:
  channels.wizard.catalog   → List available channels with connection types
  channels.wizard.start     → Begin connection flow for a platform
  channels.wizard.qr        → Get/refresh QR code (for QR-type channels)
  channels.wizard.qr.status → Poll QR scan status
  channels.wizard.validate  → Validate token/credential (for token-type channels)
  channels.wizard.complete  → Finalize connection + apply config
```

**Logic flow:**
```
channels.wizard.catalog
  → listChannelPlugins()
  → For each plugin, check:
    - gateway.loginWithQrStart exists? → type: "qr"
    - configSchema has "botToken"? → type: "token"
    - configSchema has OAuth fields? → type: "oauth"
  → Return: [{id, label, icon, connectionType, description, setupSteps}]

channels.wizard.start({platform, accountId?})
  → Validate platform exists
  → Generate unique accountId if not provided
  → Return: {sessionId, connectionType, steps, currentStep}

channels.wizard.qr({platform, accountId, force?})
  → Call plugin.gateway.loginWithQrStart({accountId, force})
  → Return: {qrDataUrl, expiresIn, message}

channels.wizard.qr.status({platform, accountId})
  → Call plugin.gateway.loginWithQrWait({accountId, timeoutMs: 5000})
  → Return: {status: "pending"|"scanned"|"connected"|"expired", message}

channels.wizard.validate({platform, accountId, credentials})
  → Platform-specific validation:
    - Telegram: call getMe() with botToken
    - Discord: call /users/@me with token
    - Slack: call auth.test with token
    - LINE: call /v2/bot/info with token
  → Return: {valid, botName?, error?}

channels.wizard.complete({platform, accountId, config})
  → config.patch to add channels.<platform>.<accountId>
  → startChannel(platform, accountId)
  → Return: {success, channelStatus}
```

**Changes to existing file:**

| File | Change |
|------|--------|
| `src/gateway/server-methods.ts` | Import and spread `channelWizardHandlers` |
| `src/gateway/server-methods.ts` | Add new methods to `READ_METHODS` / `WRITE_METHODS` sets |

### 1.2 New File: `src/gateway/protocol/schema/channel-wizard.ts`

**Purpose**: TypeBox validation schemas for channel wizard params

```
ChannelWizardCatalogParamsSchema   → {} (no params)
ChannelWizardStartParamsSchema     → {platform: string, accountId?: string}
ChannelWizardQrParamsSchema        → {platform: string, accountId: string, force?: boolean}
ChannelWizardQrStatusParamsSchema  → {platform: string, accountId: string}
ChannelWizardValidateParamsSchema  → {platform: string, accountId: string, credentials: object}
ChannelWizardCompleteParamsSchema  → {platform: string, accountId: string, config?: object}
```

**Changes to existing file:**

| File | Change |
|------|--------|
| `src/gateway/protocol/index.ts` | Export new validators |

### 1.3 Modify: Channel Plugin Type Extensions

**File: `src/channels/plugins/types.adapters.ts`**

Add optional `connectionType` and `validateCredentials` to plugin types:

```typescript
// Add to ChannelPlugin or ChannelMetaAdapter:
connectionInfo?: {
  type: "qr" | "token" | "oauth" | "manual";
  tokenFields?: string[];        // e.g. ["botToken"] for Telegram
  setupGuideUrl?: string;        // link to setup docs
  setupSteps?: string[];         // human-readable steps
};

validateCredentials?: (params: {
  credentials: Record<string, unknown>;
  timeoutMs?: number;
}) => Promise<{valid: boolean; name?: string; error?: string}>;
```

**Files to modify:**

| File | Change |
|------|--------|
| `src/channels/plugins/types.adapters.ts` | Add `connectionInfo` and `validateCredentials` to adapter types |
| `src/channels/plugins/types.plugin.ts` | Add `connectionInfo` to `ChannelPlugin` interface |

### 1.4 Modify: Channel Plugin Implementations

Add `connectionInfo` and `validateCredentials` to each extension:

| Extension File | connectionType | Changes |
|---------------|---------------|---------|
| `extensions/whatsapp/src/channel.ts` | `"qr"` | Add `connectionInfo: {type: "qr", setupSteps: [...]}` |
| `extensions/telegram/src/channel.ts` | `"token"` | Add `connectionInfo`, `validateCredentials` (call Telegram API `getMe`) |
| `extensions/discord/src/channel.ts` | `"token"` | Add `connectionInfo`, `validateCredentials` (call Discord `GET /users/@me`) |
| `extensions/slack/src/channel.ts` | `"token"` | Add `connectionInfo`, `validateCredentials` (call Slack `auth.test`) |
| `extensions/signal/src/channel.ts` | `"qr"` | Add `connectionInfo: {type: "qr"}` (signal-cli linking QR) |
| `extensions/line/src/channel.ts` | `"token"` | Add `connectionInfo`, `validateCredentials` |
| `extensions/googlechat/src/channel.ts` | `"oauth"` | Add `connectionInfo: {type: "oauth"}` |
| `extensions/msteams/src/channel.ts` | `"oauth"` | Add `connectionInfo: {type: "oauth"}` |
| Others (feishu, matrix, mattermost, etc.) | `"manual"` | Add `connectionInfo: {type: "manual"}` |

---

## Phase 2: Channel Connection Wizard UI (Frontend)

### 2.1 New File: `ui/src/ui/views/channel-wizard.ts`

**Purpose**: The main wizard UI component

```
renderChannelWizard(props) → html template
  ├── Step 0: Platform selector grid (icons + labels)
  ├── Step 1a: QR code display (for QR-type)
  │   ├── QR image from qrDataUrl
  │   ├── Platform-specific scan instructions
  │   ├── Auto-polling qr.status every 3s
  │   └── Success → auto-close + refresh channels
  ├── Step 1b: Token input form (for token-type)
  │   ├── Label + input field per tokenField
  │   ├── Platform setup guide text + link
  │   ├── "Validate" button → channels.wizard.validate
  │   └── Validation result display
  ├── Step 1c: AI guide prompt (for oauth/manual-type)
  │   └── "Chat with AI to setup" button → navigate to chat
  └── Step 2: Connection test + success
      ├── channels.wizard.complete
      ├── Status display
      └── "Done" / "Add another" buttons
```

### 2.2 New File: `ui/src/ui/controllers/channel-wizard.ts`

**Purpose**: Business logic for wizard UI state management

```typescript
interface ChannelWizardState {
  // Catalog
  channelCatalog: ChannelCatalogEntry[] | null;
  channelCatalogLoading: boolean;

  // Wizard flow
  wizardPlatform: string | null;
  wizardAccountId: string | null;
  wizardConnectionType: "qr" | "token" | "oauth" | "manual" | null;
  wizardStep: "select" | "connect" | "test" | "done";

  // QR flow
  wizardQrDataUrl: string | null;
  wizardQrStatus: "pending" | "scanned" | "connected" | "expired" | null;
  wizardQrPolling: boolean;

  // Token flow
  wizardTokenValue: string;
  wizardTokenValid: boolean | null;
  wizardTokenBotName: string | null;
  wizardTokenError: string | null;
  wizardTokenValidating: boolean;

  // Result
  wizardResult: {success: boolean; message: string} | null;
  wizardBusy: boolean;
}

// Functions:
loadChannelCatalog(state)      → GET channels.wizard.catalog
startChannelWizard(state, platform) → POST channels.wizard.start
requestQrCode(state)           → POST channels.wizard.qr
pollQrStatus(state)            → GET channels.wizard.qr.status (3s interval)
validateToken(state, token)    → POST channels.wizard.validate
completeWizard(state)          → POST channels.wizard.complete
cancelWizard(state)            → Reset state
```

### 2.3 New File: `ui/src/ui/app-channel-wizard.ts`

**Purpose**: Glue between app state and wizard controller (follows existing pattern of `app-channels.ts`)

```typescript
export async function handleWizardOpen(host: WinClawApp) { ... }
export async function handleWizardPlatformSelect(host: WinClawApp, platform: string) { ... }
export async function handleWizardQrRefresh(host: WinClawApp) { ... }
export async function handleWizardTokenValidate(host: WinClawApp) { ... }
export async function handleWizardComplete(host: WinClawApp) { ... }
export async function handleWizardCancel(host: WinClawApp) { ... }
```

### 2.4 Modify: `ui/src/ui/views/channels.ts`

**Changes**: Add "＋ Add Channel" button at the top of the channels page

```typescript
// Before the existing grid, add:
<div class="row" style="justify-content: space-between; margin-bottom: 16px;">
  <div>
    <div class="card-title">Connected Channels</div>
  </div>
  <button class="btn primary" @click=${() => props.onOpenWizard()}>
    ＋ Add Channel
  </button>
</div>

// After existing grid, conditionally render wizard overlay:
${props.wizardOpen ? renderChannelWizard(props.wizardProps) : nothing}
```

### 2.5 Modify: `ui/src/ui/views/channels.whatsapp.ts`

**Changes**: Make QR flow account-aware (currently assumes single account)

- Add `accountId` parameter to `onWhatsAppStart(force, accountId?)`
- Show account selector when multiple WhatsApp accounts exist

### 2.6 Modify: `ui/src/ui/app.ts`

**Changes**: Add wizard state properties to WinClawApp

```typescript
// New state properties:
@state() channelWizardOpen = false;
@state() channelWizardPlatform: string | null = null;
@state() channelWizardStep = "select";
@state() channelWizardCatalog: ChannelCatalogEntry[] | null = null;
// ... (all ChannelWizardState properties)
```

### 2.7 Modify: `ui/src/ui/app-render.ts`

**Changes**: Pass wizard props through to channels view

### 2.8 New File: `ui/src/styles/channel-wizard.css`

**Purpose**: Styles for wizard UI

```css
/* Platform selector grid */
.wizard-overlay { ... }
.wizard-platform-grid { ... }
.wizard-platform-card { ... }
.wizard-qr-container { ... }
.wizard-token-form { ... }
.wizard-step-indicator { ... }
.wizard-success { ... }
```

---

## Phase 3: Enhance Existing Channel Views

### 3.1 Modify: `ui/src/ui/views/channels.ts`

**Changes**: Add connection status dashboard with visual indicators

- Show green/yellow/red status dots
- Show last activity time
- Show message counts
- Add "Reconnect" / "Remove" quick actions per channel

### 3.2 Modify: Multiple channel view files

Each channel-specific view gets account management:

| File | Changes |
|------|---------|
| `channels.telegram.ts` | Add per-account status cards, "Add Account" button |
| `channels.discord.ts` | Add per-account status cards, "Add Account" button |
| `channels.slack.ts` | Add per-account status cards, "Add Account" button |
| `channels.signal.ts` | Add QR-based linking flow (similar to WhatsApp) |

### 3.3 Modify: `ui/src/ui/controllers/channels.ts`

**Changes**: Extend with multi-account operations

```typescript
// New functions:
export async function startChannelLogin(state, platform, accountId) { ... }
export async function waitChannelLogin(state, platform, accountId) { ... }
export async function logoutChannel(state, platform, accountId) { ... }
export async function removeChannelAccount(state, platform, accountId) { ... }
```

---

## Phase 4: Skill Enhancement (Chat-driven Setup)

### 4.1 Modify: `skills/winclaw-channels/SKILL.md`

**Changes**: Enhance with wizard-like guided conversation flow

```yaml
# Add new sections:
- Platform-specific setup guides with step-by-step AI narration
- Token validation via channels.wizard.validate API
- QR code display guidance (direct user to Channels tab)
- Multi-account management commands
- Connection troubleshooting decision tree
```

### 4.2 New File: `skills/winclaw-sns-wizard/SKILL.md`

**Purpose**: Dedicated skill for SNS connection wizard via chat

```
User: "Add Telegram"
AI: [Step-by-step guide with links, then token input, then validation]
User: "123456:ABC..."
AI: [Calls channels.wizard.validate, then channels.wizard.complete]
AI: "Done! Your bot @xxx is connected."
```

---

## Complete File Change Summary

### New Files (8 files)

| # | File Path | Purpose | Lines (est.) |
|---|-----------|---------|--------------|
| 1 | `src/gateway/server-methods/channel-wizard.ts` | Wizard API handlers | ~300 |
| 2 | `src/gateway/protocol/schema/channel-wizard.ts` | Validation schemas | ~80 |
| 3 | `ui/src/ui/views/channel-wizard.ts` | Wizard UI component | ~250 |
| 4 | `ui/src/ui/controllers/channel-wizard.ts` | Wizard state/logic | ~200 |
| 5 | `ui/src/ui/app-channel-wizard.ts` | App-wizard glue | ~100 |
| 6 | `ui/src/styles/channel-wizard.css` | Wizard styles | ~150 |
| 7 | `skills/winclaw-sns-wizard/SKILL.md` | Chat-driven SNS setup | ~200 |
| 8 | `ui/src/ui/views/channel-wizard.types.ts` | Wizard type definitions | ~60 |

### Modified Files (16 files)

| # | File Path | Change Description | Impact |
|---|-----------|-------------------|--------|
| 1 | `src/gateway/server-methods.ts` | Add channelWizardHandlers import + spread, update method scopes | Small |
| 2 | `src/gateway/protocol/index.ts` | Export new validators | Small |
| 3 | `src/channels/plugins/types.adapters.ts` | Add `connectionInfo`, `validateCredentials` types | Small |
| 4 | `src/channels/plugins/types.plugin.ts` | Add `connectionInfo` to ChannelPlugin | Small |
| 5 | `extensions/whatsapp/src/channel.ts` | Add `connectionInfo: {type: "qr"}` | Trivial |
| 6 | `extensions/telegram/src/channel.ts` | Add `connectionInfo`, `validateCredentials` | Medium |
| 7 | `extensions/discord/src/channel.ts` | Add `connectionInfo`, `validateCredentials` | Medium |
| 8 | `extensions/slack/src/channel.ts` | Add `connectionInfo`, `validateCredentials` | Medium |
| 9 | `extensions/signal/src/channel.ts` | Add `connectionInfo: {type: "qr"}` | Trivial |
| 10 | `extensions/line/src/channel.ts` | Add `connectionInfo`, `validateCredentials` | Medium |
| 11 | `ui/src/ui/app.ts` | Add wizard state properties | Small |
| 12 | `ui/src/ui/app-render.ts` | Pass wizard props to channels view | Small |
| 13 | `ui/src/ui/views/channels.ts` | Add "Add Channel" button + wizard mount | Small |
| 14 | `ui/src/ui/views/channels.whatsapp.ts` | Multi-account support in QR flow | Medium |
| 15 | `ui/src/ui/controllers/channels.ts` | Add multi-account login/logout functions | Medium |
| 16 | `skills/winclaw-channels/SKILL.md` | Enhance with wizard API references | Small |

---

## Dependency Graph

```
Phase 1 (Backend - No UI changes needed, can test via API)
  ├── 1.3 Plugin type extensions (types.adapters.ts, types.plugin.ts)
  │     ↓
  ├── 1.4 Plugin implementations (whatsapp, telegram, discord, etc.)
  │     ↓
  ├── 1.2 Protocol schemas (channel-wizard.ts)
  │     ↓
  └── 1.1 Wizard API handler (channel-wizard.ts)
        ↓
Phase 2 (Frontend - Builds on Phase 1 API)
  ├── 2.8 Styles (channel-wizard.css)
  ├── 2.2 Controller (channel-wizard controller)
  ├── 2.1 View (channel-wizard view)
  │     ↓
  ├── 2.3 App glue (app-channel-wizard.ts)
  ├── 2.4 Modify channels.ts (add button + mount)
  └── 2.6 Modify app.ts (state + render)
        ↓
Phase 3 (Enhancement - Builds on Phase 2)
  ├── 3.1-3.3 Channel view enhancements
        ↓
Phase 4 (Skills - Independent, can start anytime)
  ├── 4.1 Enhance winclaw-channels skill
  └── 4.2 New sns-wizard skill
```

---

## Implementation Order (Recommended)

```
Week 1-2: Phase 1 (Backend)
  Day 1-2: Type extensions (1.3) + WhatsApp connectionInfo (1.4 partial)
  Day 3-4: Protocol schemas (1.2) + Wizard API handler (1.1)
  Day 5-7: Telegram/Discord/Slack validateCredentials (1.4)
  Day 8-10: Testing via debug tab RPC calls

Week 3-4: Phase 2 (Frontend)
  Day 1-2: Styles + types (2.8, 2.2 types)
  Day 3-4: Wizard view component (2.1)
  Day 5-6: Controller + app glue (2.2, 2.3, 2.6)
  Day 7-8: Mount in channels page (2.4) + test full flow
  Day 9-10: WhatsApp multi-account QR (2.5) + polish

Week 5: Phase 3 (Enhancement)
  Day 1-3: Channel dashboard improvements (3.1)
  Day 4-5: Multi-account views (3.2, 3.3)

Week 6: Phase 4 (Skills)
  Day 1-2: Enhanced winclaw-channels skill (4.1)
  Day 3-4: New sns-wizard skill (4.2)
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token validation API rate limits | Medium | Cache validation results, use reasonable timeouts |
| QR code expiration during wizard | Low | Auto-refresh QR, clear status messaging |
| Config patch conflicts during wizard | Medium | Use baseHash locking (already implemented) |
| Signal QR linking complexity | High | Phase 3+ priority, document limitations |
| Plugin type changes break existing code | Medium | All new fields are optional, backward compatible |
| Large state addition to app.ts | Low | Keep wizard state in separate controller object |

---

## Testing Strategy

| Test | Method |
|------|--------|
| Wizard API unit tests | Mocha/Jest for each handler |
| Token validation mocking | Mock HTTP responses for each platform API |
| QR flow E2E | Manual test with real WhatsApp |
| UI wizard flow | Manual test + screenshot verification |
| Config persistence | Verify winclaw.json after wizard.complete |
| Multi-account startup | Verify channels.status shows all accounts |
| Skill-driven setup | Test via chat interface in debug tab |

---

## Key Design Decisions

1. **Why extend `ChannelPlugin` type instead of hardcoding?**
   - Each plugin self-declares its `connectionType` and validation logic
   - New plugins automatically appear in the wizard catalog
   - No central mapping file to maintain

2. **Why separate `channel-wizard.ts` from existing `channels.ts`?**
   - Channels.ts handles runtime status; wizard handles setup flow
   - Different authorization scopes (wizard needs admin, status needs read)
   - Cleaner separation of concerns

3. **Why overlay in channels page instead of separate tab?**
   - No navigation.ts changes needed
   - Wizard is transient (not a permanent view)
   - Context is clear: user is already looking at channels

4. **Why keep AI chat path alongside UI wizard?**
   - Not all platforms can have UI wizards (complex OAuth, manual config)
   - Power users may prefer chat-driven setup
   - Skills work without UI changes (immediate value)
