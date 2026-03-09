# OpenClaw A2A Gateway - Complete Analysis Index

## Documents Generated

This analysis package contains comprehensive technical documentation of the **openclaw-a2a-gateway** repository (https://github.com/win4r/openclaw-a2a-gateway).

### 1. **openclaw-a2a-analysis.md** (466 lines)
   - **Complete technical analysis document**
   - Covers all 16 major sections:
     - Executive summary
     - Project overview & use cases
     - Architecture & data flows
     - Key files & purposes
     - Agent exposure as A2A endpoints
     - Endpoints & API reference
     - Agent Card discovery mechanism
     - Task management lifecycle
     - Technologies & frameworks used
     - Limitations & TODOs
     - Configuration reference with examples
     - Security considerations
     - Multi-transport support
     - Data flow examples
     - Development & testing
     - Summary tables

   **Use this for**: Deep understanding, implementation decisions, architecture review

### 2. **openclaw-a2a-architecture.txt** (361 lines)
   - **Visual architecture diagrams & flow charts**
   - ASCII-style diagrams showing:
     - Overall system topology
     - Single server internals
     - Inbound message flow (peer → your agent)
     - Outbound message flow (your agent → peer)
     - Configuration hierarchy
     - Task state machine
     - Transport selection logic
     - Key timeouts
     - Bearer token flow
     - Agent routing (default vs per-message)
     - Multi-agent routing extension
     - File structure
     - Multi-transport parallel execution
     - Security architecture

   **Use this for**: Visual understanding, presentations, whiteboarding

### 3. **OPENCLAW-A2A-QUICK-REFERENCE.md** (394 lines)
   - **Fast reference & setup guide**
   - Practical sections:
     - What it does (1-minute summary)
     - Installation steps
     - 5-minute setup
     - Configuration reference
     - All endpoints
     - Gateway method (a2a.send)
     - CLI messaging examples
     - Network setup options
     - Agent TOOLS.md template
     - Troubleshooting table
     - Security practices
     - Testing procedures
     - File locations
     - Known limitations
     - Two-server example

   **Use this for**: Getting started, troubleshooting, daily reference

---

## Key Findings Summary

### What Is It?

The openclaw-a2a-gateway is a **TypeScript-based OpenClaw plugin that implements the A2A (Agent-to-Agent) v0.3.0 protocol**, enabling peer-to-peer agent communication across distributed OpenClaw servers.

### Core Functionality

1. **Exposes** your OpenClaw agents as A2A-compliant agents
2. **Accepts** inbound A2A messages from peers (JSON-RPC, REST, gRPC)
3. **Routes** messages to OpenClaw agents via Gateway RPC
4. **Publishes** Agent Cards for peer discovery
5. **Enables** your agents to call peer agents

### Architecture Overview

```
Peer A ──HTTP/gRPC──> Your A2A Gateway Plugin
                      ├─ Express Server (port 18800)
                      ├─ gRPC Server (port 18801)
                      ├─ A2A SDK Layer
                      └─ OpenClawAgentExecutor
                         └─ WebSocket to OpenClaw Gateway (:18789)
                            └─ agent RPC call
```

### Key Technologies

- **Framework**: TypeScript / Node.js
- **A2A SDK**: `@a2a-js/sdk@0.3.0`
- **HTTP**: Express.js
- **RPC**: gRPC + Protocol Buffers
- **Auth**: Bearer token
- **Configuration**: JSON schema (openclaw.plugin.json)

### Critical Capabilities

| Feature | Support | Notes |
|---------|---------|-------|
| **JSON-RPC** | ✓ Full | Primary transport |
| **REST** | ✓ Full | HTTP+JSON alternative |
| **gRPC** | ✓ Full | Binary protocol |
| **Bearer Auth** | ✓ Full | Per-request validation |
| **Agent Card Discovery** | ✓ Full | Standard endpoint |
| **Task Polling** | ✓ Full | Async wait support |
| **Multi-Agent Routing** | ✓ Full | Default + per-message |
| **Streaming** | ✗ No | Polling only |
| **Task Persistence** | ✗ No | Lost on restart |
| **Concurrency Limits** | ✗ No | Can overload |

### Main Limitations

1. **In-Memory Tasks** - Lost on restart
2. **No Streaming** - Polling only
3. **No Push Notifications** - Must poll
4. **No Rate Limiting** - Can overload gateway
5. **No Peer Health Checks** - No failover
6. **No Token Rotation** - Manual process
7. **No Audit Log** - Can't track calls
8. **No File Transfer** - Text only

---

## Quick Navigation

### For Different Use Cases

**I want to understand how it works**
→ Start with `openclaw-a2a-analysis.md` sections 1-7

**I want to see the architecture**
→ Look at `openclaw-a2a-architecture.txt`

**I want to set it up**
→ Follow `OPENCLAW-A2A-QUICK-REFERENCE.md` "5-Minute Setup"

**I need to troubleshoot**
→ Check `OPENCLAW-A2A-QUICK-REFERENCE.md` "Troubleshooting" section

**I need a specific endpoint**
→ See `openclaw-a2a-analysis.md` section 5 or Quick Reference

**I want to understand security**
→ Read `openclaw-a2a-analysis.md` section 12

**I'm implementing a feature**
→ Review `openclaw-a2a-analysis.md` "Key Files and Their Purposes"

---

## Repository Information

- **Repository**: https://github.com/win4r/openclaw-a2a-gateway
- **Language**: TypeScript (Node.js ≥ 22)
- **License**: MIT
- **Version Analyzed**: 1.0.0
- **Created**: February 20, 2026
- **Last Updated**: March 7, 2026
- **Stars**: 20
- **Forks**: 4

---

## Configuration Essentials

### Minimum Configuration
```bash
agentCard.name              # REQUIRED: Display name
agentCard.skills            # REQUIRED: Capabilities list
security.inboundAuth        # RECOMMENDED: "bearer"
security.token              # RECOMMENDED: 48-hex token
routing.defaultAgentId      # Your agent ID
```

### Full Configuration
```bash
agentCard.name              # Name
agentCard.description       # Description
agentCard.url               # Endpoint URL (auto if omitted)
agentCard.skills            # Capabilities
server.host                 # Bind address (0.0.0.0)
server.port                 # Port (18800)
security.inboundAuth        # Auth type (bearer/none)
security.token              # Token
routing.defaultAgentId      # Agent ID
peers[]                     # Peer configurations
timeouts.agentResponseTimeoutMs  # Timeout in ms (300000)
```

---

## API Endpoints Reference

### Discovery
- `GET /.well-known/agent-card.json` - Agent Card (standard)
- `GET /.well-known/agent.json` - Legacy alias

### Messaging
- `POST /a2a/jsonrpc` - JSON-RPC transport
- `GET/POST/PUT /a2a/rest` - REST transport
- Port 18801 (gRPC) - Binary protocol

### Gateway Method
- `gateway("a2a.send", {peer, message})` - Send A2A message

---

## Task Lifecycle

```
Request Received
    ↓
Task Created (status=accepted)
    ↓
Agent Execution (status=working)
    ↓
Response Received (status=completed)
    ↓
Caller Polls tasks/get
    ↓
Final Result Returned
```

---

## Security Model

### Inbound (Peer → You)
1. Peer sends: `Authorization: Bearer <token>`
2. Plugin validates against `config.security.token`
3. If match: allow; else: JSON-RPC error -32000

### Outbound (You → Peer)
1. Config stores `peers[].auth.token`
2. A2AClient injects header: `Authorization: Bearer <token>`
3. Applied to Agent Card fetch + message send

### Best Practices
- Generate: `openssl rand -hex 24`
- Store: In OpenClaw config (encrypted)
- Share: Via secure channel (not logs/code)
- Network: Use Tailscale (recommended)

---

## Development Checklist

### Understanding the Code
- [ ] Read sections 1-3 of main analysis
- [ ] Review architecture diagram
- [ ] Study Key Files section

### Setup
- [ ] Follow "5-Minute Setup" in Quick Reference
- [ ] Verify: `curl http://localhost:18800/.well-known/agent-card.json`
- [ ] Test: Send message via `a2a-send.mjs`

### Configuration
- [ ] Generate security token
- [ ] Set agentCard fields
- [ ] Configure routing
- [ ] Add peers if needed
- [ ] Restart OpenClaw

### Integration
- [ ] Add A2A section to agent TOOLS.md
- [ ] Update agent skills to call peers
- [ ] Test peer communication

### Troubleshooting
- [ ] Check logs: `tail -f /tmp/openclaw/openclaw-*.log | grep a2a`
- [ ] Verify connectivity: `curl http://peer:18800/.well-known/agent-card.json`
- [ ] Check tokens: Ensure exact match on both sides

---

## Common Patterns

### Simple Message
```bash
node a2a-send.mjs \
  --peer-url http://peer:18800 \
  --token <token> \
  --message "Hello!"
```

### Long-Running Task
```bash
node a2a-send.mjs \
  --peer-url http://peer:18800 \
  --token <token> \
  --non-blocking --wait \
  --message "Long task..."
```

### Target Specific Agent
```bash
node a2a-send.mjs \
  --peer-url http://peer:18800 \
  --token <token> \
  --agent-id coder \
  --message "Write code"
```

### From Agent Code
```javascript
gateway("a2a.send", {
  peer: "Peer-B",
  message: {text: "Hello peer!"}
})
```

---

## File Organization

```
openclaw-a2a-gateway/
├── index.ts                 # Plugin entry
├── package.json             # Dependencies
├── openclaw.plugin.json     # Config schema
├── src/
│   ├── types.ts            # Type definitions
│   ├── agent-card.ts       # Card generation
│   ├── executor.ts         # Inbound handler
│   ├── client.ts           # Outbound client
│   └── internal/           # Gateway extensions
│       ├── envelope.ts
│       ├── transport.ts
│       ├── routing.ts
│       ├── security.ts
│       ├── outbox.ts
│       ├── idempotency.ts
│       └── metrics.ts
├── skill/                  # Setup skill
│   ├── SKILL.md
│   ├── scripts/a2a-send.mjs
│   └── references/
├── tests/                  # Test suite
└── README.md              # Full documentation
```

---

## Performance Characteristics

| Metric | Value |
|--------|-------|
| JSON-RPC roundtrip (local) | 100-500ms |
| Agent execution timeout | Configurable (300s default) |
| Task polling interval | Configurable (1s typical) |
| In-memory task limit | 10,000 tasks |
| Typical latency per hop | 50-200ms |

---

## Deployment Scenarios

### Single Server (No Peering)
- One gateway plugin
- Hosts local agents
- No peer communication

### Two Servers (Mutual Peering)
- Each has gateway plugin
- Configure each other as peers
- Exchange tokens
- Use Tailscale for network

### Multi-Server Mesh
- N servers, each with plugin
- Full-mesh or partial-mesh topology
- Each server knows relevant peers
- Central discovery or static config

### Scale Out (Not Recommended Currently)
- In-memory task store = single point of failure
- No horizontal scaling
- Would need task persistence + shared store

---

## Decision Factors

### Choose This Plugin If:
✓ You have multiple OpenClaw servers
✓ You need standard A2A protocol compliance
✓ You want agents to collaborate across servers
✓ You prefer Tailscale for networking
✓ You can tolerate eventual consistency

### Choose Alternatives If:
✗ You need guaranteed message delivery → use message queue
✗ You need task persistence → implement custom storage
✗ You need rate limiting → add API gateway
✗ You need complete audit trail → add event log
✗ You need horizontal scaling → use distributed task store

---

## Resources

**Official Documentation**
- Repository: https://github.com/win4r/openclaw-a2a-gateway
- README: Full setup + troubleshooting
- SKILL.md: Guided setup procedure

**Standards & SDKs**
- A2A Specification: https://github.com/google/A2A
- TypeScript SDK: https://www.npmjs.com/package/@a2a-js/sdk

**Related Projects**
- OpenClaw: https://github.com/openclaw/openclaw
- WinClaw: Commercial OpenClaw distribution
- Demo Video: https://youtu.be/aI77F7vVodE

---

## Analysis Metadata

- **Analysis Date**: 2026-03-08
- **Repository Snapshot**: 2026-03-07
- **Plugin Version**: 1.0.0
- **Analysis Completeness**: Comprehensive (all 16 sections)
- **Code Files Reviewed**: 12+ core files
- **Documentation Generated**: 3 detailed documents + index

---

## Next Steps

1. **Read**: Start with Quick Reference for overview
2. **Review**: Study architecture diagram
3. **Configure**: Follow 5-minute setup
4. **Test**: Send a message to peer
5. **Integrate**: Add A2A awareness to agents
6. **Monitor**: Watch logs for issues
7. **Optimize**: Adjust timeouts based on your workload

---

**Last Updated**: 2026-03-08
**Plugin Version**: 1.0.0
**Analysis Version**: 1.0.0
