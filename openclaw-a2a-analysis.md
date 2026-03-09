# OpenClaw A2A Gateway Plugin - Technical Analysis

## Executive Summary

The **openclaw-a2a-gateway** is a TypeScript-based OpenClaw plugin that implements the [A2A (Agent-to-Agent) v0.3.0 protocol](https://github.com/google/A2A), enabling peer-to-peer agent communication across distributed OpenClaw servers. It bridges OpenClaw agents with the standard A2A protocol surface, allowing agents to discover and communicate with each other across network boundaries using Tailscale, LAN, or public IPs.

**Repository**: https://github.com/win4r/openclaw-a2a-gateway
**Language**: TypeScript (Node.js ≥ 22)
**License**: MIT
**Created**: February 20, 2026
**Latest Update**: March 7, 2026
**Version**: 1.0.0

---

## 1. What Is This Project?

The A2A Gateway transforms OpenClaw from a single-agent system into a **multi-agent mesh network**. It:

1. **Exposes OpenClaw agents** to the A2A protocol as compliant A2A agents
2. **Accepts inbound A2A messages** from peer agents via HTTP (JSON-RPC + REST) and gRPC
3. **Routes messages** to the underlying OpenClaw agent using the Gateway RPC API
4. **Publishes an Agent Card** (discovery metadata) at `/.well-known/agent-card.json`
5. **Allows outbound A2A calls** to peer agents via the A2A SDK Client

Key use cases:
- Multi-server OpenClaw deployments where agents need to collaborate
- Federated agent networks (cross-organization A2A communication)
- Breaking up monolithic agent responsibilities across specialized agents

---

## 2. Architecture: Bridging OpenClaw/WinClaw with A2A

### Inbound Flow (Peer → Your Agent)

1. Peer sends A2A JSON-RPC/REST/gRPC message to `:18800`
2. A2A SDK handles transport + protocol parsing
3. DefaultRequestHandler delegates to OpenClawAgentExecutor
4. Executor connects to OpenClaw gateway (:18789) via WebSocket
5. Calls `sessions.resolve(agentId)` to get/create chat session
6. Calls `agent(agentId, message)` RPC with message text
7. Waits for response (configurable timeout, default 300s)
8. Extracts text from agent response
9. Returns as A2A Task with "completed" state

### Outbound Flow (Your Agent → Peer)

1. OpenClaw agent calls gateway method: `gateway("a2a.send", {peer, message})`
2. Plugin handler looks up peer by name in config
3. A2AClient.sendMessage() uses SDK ClientFactory to:
   - Auto-discover peer's Agent Card via cardUrl
   - Select best transport (JSON-RPC, REST, or gRPC)
   - Inject bearer token or API key auth
   - Send `message/send` to peer
4. Response delivered back to agent

---

## 3. Key Files and Purposes

### Core Files

| File | Purpose |
|------|---------|
| **index.ts** | Plugin registration; initializes Express/gRPC servers, SDK handlers, bearer auth middleware |
| **src/types.ts** | Type definitions for config, peers, agent cards |
| **src/agent-card.ts** | Builds A2A Agent Card from OpenClaw config |
| **src/executor.ts** | OpenClawAgentExecutor - bridges A2A messages to OpenClaw agent dispatch |
| **src/client.ts** | A2AClient - sends outbound A2A messages to peers with auth |

### Configuration

| File | Purpose |
|------|---------|
| **openclaw.plugin.json** | Plugin manifest with JSON schema for all config options |
| **package.json** | Dependencies: @a2a-js/sdk, Express, gRPC |

### Internal Modules (Gateway Extensions, Non-A2A Standard)

| File | Purpose |
|------|---------|
| **src/internal/envelope.ts** | Custom a2a/v1 envelope format |
| **src/internal/transport.ts** | Custom HTTP transport with /a2a/v1/inbox endpoint |
| **src/internal/security.ts** | HMAC-SHA256 signing for gateway-to-gateway auth |
| **src/internal/routing.ts** | Route-key / agent-id based message routing |
| **src/internal/outbox.ts** | Outbox pattern with exponential backoff retry |
| **src/internal/idempotency.ts** | SHA-256 deduplication store |
| **src/internal/metrics.ts** | Protocol metrics and structured logging |

---

## 4. Agent Exposure as A2A-Compatible Agents

### Agent Card Generation

The plugin builds a dynamic A2A Agent Card:

```typescript
{
  protocolVersion: "0.3.0",
  version: "1.0.0",
  name: "Server-A",
  description: "A2A bridge for OpenClaw agents",
  url: "http://host:18800/a2a/jsonrpc",
  skills: [
    { id: "chat", name: "chat", description: "..." }
  ],
  securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
  additionalInterfaces: [
    { url: "http://host:18800/a2a/jsonrpc", transport: "JSONRPC" },
    { url: "http://host:18800/a2a/rest", transport: "HTTP+JSON" },
    { url: "host:18801", transport: "GRPC" }
  ]
}
```

### Discovery

- Peers find the card at `/.well-known/agent-card.json` (A2A standard)
- Legacy alias: `/.well-known/agent.json`
- Card includes all connection details + auth scheme

### Skills

OpenClaw agents typically expose a single **"chat" skill** because:
- All interaction goes through standard A2A message/send
- Specific domain skills are discovered by LLM via TOOLS.md
- Skills list is static metadata for basic capability declaration

---

## 5. Endpoints Implemented

### A2A Standard (Port 18800, configurable)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/agent-card.json` | GET | Agent Card discovery (A2A std) |
| `/.well-known/agent.json` | GET | Legacy alias for card |
| `/a2a/jsonrpc` | POST | JSON-RPC transport |
| `/a2a/rest` | GET/POST/PUT | REST HTTP+JSON transport |
| (gRPC on :18801) | RPC | Binary gRPC protocol |

### Gateway Method (OpenClaw-Specific)

- **Method**: `a2a.send`
- **Params**: `{peer: string, message: object}`
- **Response**: `{statusCode, response}` or error

---

## 6. Agent Discovery: Agent Card Details

The Agent Card is JSON metadata at `/.well-known/agent-card.json`. It includes:

- **Identity**: name, description, version
- **Endpoints**: url (primary) + additionalInterfaces (all transports)
- **Skills**: List of capabilities (usually just "chat")
- **Security**: Which auth schemes are required
- **Capabilities**: streaming, pushNotifications, stateTransitionHistory

Discovery flow:
1. Peer config specifies `agentCardUrl: "http://peer-ip:18800/.well-known/agent-card.json"`
2. A2AClient.discoverAgentCard() fetches it
3. SDK ClientFactory uses it to select transport + prepare auth
4. Client ready to send messages

---

## 7. Task Management

### Lifecycle

```
[Inbound A2A Request]
  ↓
[Task created with id=UUID, status="accepted"]
  ↓
[OpenClawAgentExecutor.execute()]
  → Publishes Task(status="working")
  → Connects to OpenClaw gateway
  → Calls agent RPC
  → Waits (timeout configurable, default 300s)
  → Publishes Task(status="completed", message, artifacts)
  ↓
[Caller polls tasks/get]
  ↓
[Task returned with result]
```

### State Transitions

- **accepted**: Request received
- **working**: Agent dispatch in progress
- **completed**: Response available
- **canceled**: Task cancelled by caller

### Async Task Mode (Recommended for Long Prompts)

```bash
a2a-send.mjs --non-blocking --wait --timeout-ms 600000 --poll-ms 1000 \
  --message "Long-running task"
```

This sends `blocking=false`, gets taskId, then polls `tasks/get` until complete.

### Limitation

Tasks stored in memory (InMemoryTaskStore). Restart loses all pending tasks. Roadmap includes persistence.

---

## 8. Technologies & Frameworks

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@a2a-js/sdk` | `^0.3.0` | A2A protocol SDK (client + server) |
| `express` | `^4.21.2` | HTTP framework |
| `@grpc/grpc-js` | `^1.14.3` | gRPC server |
| `@bufbuild/protobuf` | `^2.11.0` | Protobuf runtime |
| `uuid` | `^9.0.1` | Task/request IDs |

### Patterns

1. **Plugin Registration** - OpenClaw native `register(api)` pattern
2. **SDK Server** - DefaultRequestHandler from @a2a-js/sdk
3. **Bearer Token Middleware** - Validates auth per request
4. **Multi-Transport** - Same executor logic works with JSON-RPC/REST/gRPC

---

## 9. Limitations & TODOs

From the README's roadmap:

- **In-Memory Tasks**: Lost on restart; need durable store
- **No Streaming**: No SSE/WebSocket streaming; polling only
- **No Push Notifications**: Caller must poll tasks/get
- **No Concurrency Limits**: Can overload the OpenClaw gateway
- **Limited Observability**: Minimal structured logs + metrics
- **No Peer Health Checks**: No automatic failover
- **No Transport Fallback**: No fallback if preferred transport fails
- **No File Transfer**: A2A spec supports file parts; not implemented
- **No Token Rotation**: Single static token per peer
- **No Audit Log**: Can't track who called what

---

## 10. Configuration Reference

### Setup Steps

```bash
# Agent Card (required)
openclaw config set plugins.entries.a2a-gateway.config.agentCard.name 'Server-A'
openclaw config set plugins.entries.a2a-gateway.config.agentCard.url 'http://ip:18800/a2a/jsonrpc'
openclaw config set plugins.entries.a2a-gateway.config.agentCard.skills '[{"id":"chat","name":"chat"}]'

# Server
openclaw config set plugins.entries.a2a-gateway.config.server.port 18800

# Security
openclaw config set plugins.entries.a2a-gateway.config.security.inboundAuth 'bearer'
openclaw config set plugins.entries.a2a-gateway.config.security.token "$(openssl rand -hex 24)"

# Routing
openclaw config set plugins.entries.a2a-gateway.config.routing.defaultAgentId 'main'

# Peers
openclaw config set plugins.entries.a2a-gateway.config.peers '[{
  "name": "Peer-B",
  "agentCardUrl": "http://peer-ip:18800/.well-known/agent-card.json",
  "auth": {"type": "bearer", "token": "peer-token"}
}]'

# Restart
openclaw gateway restart
```

### Config Schema

```typescript
agentCard: {
  name: string;              // REQUIRED
  description?: string;
  url?: string;              // Auto if omitted
  skills: (string | {id, name, description})[]; // REQUIRED
}
server: {
  host?: string;             // Default: "0.0.0.0"
  port?: number;             // Default: 18800
}
peers?: PeerConfig[];        // Default: []
security: {
  inboundAuth?: "none" | "bearer"; // Default: "none"
  token?: string;            // Required if bearer
}
routing: {
  defaultAgentId?: string;   // Default: "default"
}
timeouts?: {
  agentResponseTimeoutMs?: number; // Default: 300000
}
```

---

## 11. Security Considerations

### Authentication

**Inbound**: Bearer token in Authorization header, validated per request
**Outbound**: Bearer token sent to peer; peer validates using its inbound token

### Network

- **Tailscale** (recommended): Encrypted mesh
- **LAN**: Local network only
- **Public IP**: Bearer token + firewall rules

### Token Practices

1. Generate: `openssl rand -hex 24`
2. Share securely (out-of-band)
3. Store in OpenClaw config
4. Monitor logs for anomalies
5. Rotate periodically (manual)

### Gaps

- No token rotation support yet
- No audit log
- No SSRF protection (if file parts added)
- Memory task store not persisted

---

## 12. Multi-Transport Support

All three A2A transports run in parallel on :18800:

| Transport | Protocol | Library | Endpoint |
|-----------|----------|---------|----------|
| **JSON-RPC** | HTTP POST | express | `/a2a/jsonrpc` |
| **REST/HTTP+JSON** | HTTP REST | express | `/a2a/rest` |
| **gRPC** | Binary | @grpc/grpc-js | `:18801` |

SDK client automatically selects best available based on Agent Card.

---

## 13. Data Flow Example: Simple Two-Agent Chat

```
[User] "AGI, ask Coco what time is it?"
  ↓
[AGI Agent] (reads TOOLS.md, learns about Peer-Coco)
  ↓
[AGI Skill] gateway("a2a.send", {peer: "Coco", message: "What time?"})
  ↓
[A2AClient.sendMessage()]
  → Discovers Coco's Agent Card
  → Selects JSON-RPC transport
  → Sends with Bearer token
  ↓
[Server B - OpenClawAgentExecutor]
  → Creates Task(status="working")
  → Connects to local gateway
  → Calls agent(agentId="coco", message="What time?")
  → Gets response: "It is 3:45 PM"
  → Publishes Task(status="completed")
  ↓
[A2A Client - Server A] Gets response
  ↓
[AGI] "Coco says: It is 3:45 PM"
```

---

## 14. Development & Testing

### Test Suite

Location: `tests/a2a-gateway.test.ts`

Covers:
- Bearer token validation
- Agent Card generation
- JSON-RPC routing
- Task state transitions
- Error handling

Run: `npm test`

### Build & Install

```bash
git clone https://github.com/win4r/openclaw-a2a-gateway.git a2a-gateway
cd a2a-gateway
npm install --production
openclaw config set plugins.load.paths '["/path/to/a2a-gateway"]'
openclaw gateway restart
```

### Plugin Skill

The repo includes `skill/SKILL.md` - a guided skill for setup:
- Installation
- Configuration
- TOOLS.md update
- Verification

---

## 15. Troubleshooting Quick Reference

| Problem | Cause | Fix |
|---------|-------|-----|
| Agent Card 404 | Plugin not loaded | Check plugins.allow, plugins.load.paths |
| Connection refused :18800 | Server not listening | Restart gateway, check port |
| "Unauthorized: invalid token" | Token mismatch | Verify token matches peer exactly |
| "Request accepted (no dispatch)" | Agent dispatch failed | Check AI provider configured |
| "agent dispatch failed (timeout)" | Long prompt | Increase agentResponseTimeoutMs or use async |

---

## 16. Summary

**The openclaw-a2a-gateway is**:

✓ A production-ready A2A protocol implementation for OpenClaw
✓ Multi-transport (JSON-RPC, REST, gRPC) agent server
✓ Bearer token authentication
✓ Dynamic agent card generation + discovery
✓ Async task support with polling
✓ Skill-based setup guide for agents

**Main limitations**:

✗ In-memory task store (lost on restart)
✗ No streaming (polling only)
✗ No concurrency limits
✗ No peer health checks
✗ No file transfer support

**Best for**:

- Multi-server OpenClaw deployments
- Federated agent networks
- Agent collaboration across firewalls (Tailscale)
- Breaking up monolithic agents

---

**Analysis Generated**: 2026-03-08
**Repository Last Updated**: 2026-03-07
**Plugin Version**: 1.0.0

**Resources**:
- Repository: https://github.com/win4r/openclaw-a2a-gateway
- A2A Spec: https://github.com/google/A2A
- @a2a-js/sdk: https://www.npmjs.com/package/@a2a-js/sdk
- YouTube Demo: https://youtu.be/aI77F7vVodE
