# OpenClaw A2A Gateway - Complete Technical Analysis

## Analysis Complete

I have completed a comprehensive technical analysis of the **openclaw-a2a-gateway** repository (https://github.com/win4r/openclaw-a2a-gateway).

## What You'll Find

### 4 Complete Documents (48 KB total)

1. **openclaw-a2a-analysis.md** (14 KB)
   - Full technical deep-dive covering all aspects
   - 16 major sections from architecture to security
   - Best for: Understanding how it works

2. **openclaw-a2a-architecture.txt** (9.9 KB)
   - ASCII diagrams and flow charts
   - Visual representation of all major flows
   - Best for: Grasping system design visually

3. **OPENCLAW-A2A-QUICK-REFERENCE.md** (12 KB)
   - Practical setup guide and reference
   - CLI examples and troubleshooting
   - Best for: Getting started quickly

4. **OPENCLAW-A2A-ANALYSIS-INDEX.md** (13 KB)
   - Navigation guide through all documents
   - Quick summaries and decision tables
   - Best for: Finding specific information

## What Is the Project?

The **openclaw-a2a-gateway** is a TypeScript-based OpenClaw plugin that implements the A2A (Agent-to-Agent) v0.3.0 protocol, enabling peer-to-peer communication between agents on different OpenClaw servers.

### Key Capabilities

- **Exposes** OpenClaw agents as A2A-compliant endpoints
- **Accepts** inbound A2A messages via JSON-RPC, REST, or gRPC
- **Routes** messages to OpenClaw agents via Gateway RPC
- **Publishes** Agent Cards for peer discovery
- **Enables** agents to call peer agents with bearer token auth

## Quick Start Path

1. Read **OPENCLAW-A2A-ANALYSIS-INDEX.md** (5 minutes)
2. Review **openclaw-a2a-architecture.txt** (10 minutes)
3. Follow **OPENCLAW-A2A-QUICK-REFERENCE.md** "5-Minute Setup" section
4. Test with provided CLI examples

## Understanding the Architecture

```
Your OpenClaw Server          Network          Peer Server
┌──────────────────┐                           ┌──────────────┐
│ Agent: "main"    │                           │ Agent: "bot" │
└────────┬─────────┘                           └────┬─────────┘
         │                                          │
         │                                          │
    Calls: gateway("a2a.send", {...})          Sends A2A message
         │                                          │
         ▼                                          ▼
┌──────────────────────────────────────────────────────────────┐
│         A2A Gateway Plugin (Port 18800)                       │
│                                                               │
│  ├─ Express Server (JSON-RPC + REST)                         │
│  ├─ gRPC Server (Port 18801)                                 │
│  ├─ A2A SDK Layer                                            │
│  └─ OpenClawAgentExecutor                                    │
│     └─ WebSocket to local OpenClaw Gateway (:18789)         │
│        └─ Executes agent via gateway RPC                    │
│                                                               │
│  Authentication: Bearer token per-request                    │
│  Discovery: Agent Card at /.well-known/agent-card.json      │
└──────────────────────────────────────────────────────────────┘
```

## Key Findings

### Strengths
✓ Multi-transport support (JSON-RPC, REST, gRPC)
✓ Standard A2A v0.3.0 protocol compliance
✓ Bearer token authentication
✓ Async task support with polling
✓ Agent-specific routing (OpenClaw extension)
✓ Dynamic agent card generation
✓ Gateway method for outbound A2A calls

### Limitations
✗ In-memory task storage (lost on restart)
✗ No streaming support (polling only)
✗ No concurrency limits (can overload)
✗ No peer health checks or failover
✗ No token rotation support
✗ No audit logging
✗ No file transfer support

### Configuration
- **Required**: agentCard.name, agentCard.skills
- **Recommended**: security.inboundAuth, security.token
- **Endpoints**: `/.well-known/agent-card.json` (discovery), `/a2a/jsonrpc` (messaging)
- **Port**: 18800 (HTTP), 18801 (gRPC)

## Technologies Used

- **A2A SDK**: @a2a-js/sdk@0.3.0
- **HTTP Framework**: Express.js
- **RPC**: gRPC + Protocol Buffers
- **Authentication**: Bearer token
- **Language**: TypeScript / Node.js

## How to Use This Analysis

### For Different Roles

**For System Architects**
→ Read: `openclaw-a2a-analysis.md` (sections 1-7)
→ Review: `openclaw-a2a-architecture.txt` (all sections)

**For Developers Implementing**
→ Follow: `OPENCLAW-A2A-QUICK-REFERENCE.md` (setup section)
→ Reference: `openclaw-a2a-analysis.md` (sections 10, 15)

**For DevOps/SRE**
→ Use: `OPENCLAW-A2A-QUICK-REFERENCE.md` (troubleshooting)
→ Reference: `openclaw-a2a-analysis.md` (section 12: security)

**For Security Review**
→ Read: `openclaw-a2a-analysis.md` (section 12)
→ Review: `openclaw-a2a-architecture.txt` (security architecture)

**For Integration**
→ Follow: `OPENCLAW-A2A-QUICK-REFERENCE.md` (TOOLS.md template)
→ Reference: `openclaw-a2a-analysis.md` (sections 4, 5)

## Document Navigation

| Looking For | Document | Section |
|-------------|----------|---------|
| How it works | openclaw-a2a-analysis.md | 1-7 |
| Visual diagrams | openclaw-a2a-architecture.txt | All |
| Setup steps | OPENCLAW-A2A-QUICK-REFERENCE.md | 5-Minute Setup |
| Configuration | OPENCLAW-A2A-QUICK-REFERENCE.md | Configuration Reference |
| Endpoints | Both | Sections 5, API Reference |
| Troubleshooting | OPENCLAW-A2A-QUICK-REFERENCE.md | Troubleshooting |
| Security | openclaw-a2a-analysis.md | Section 12 |
| Task management | openclaw-a2a-analysis.md | Section 7 |
| Limitations | openclaw-a2a-analysis.md | Section 9 |
| Examples | OPENCLAW-A2A-QUICK-REFERENCE.md | CLI Examples |

## Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/agent-card.json` | GET | Agent Card (discovery) |
| `/a2a/jsonrpc` | POST | JSON-RPC messaging |
| `/a2a/rest` | GET/POST/PUT | REST messaging |
| Port 18801 | gRPC | Binary protocol |

## Configuration Essentials

```bash
# Minimum required
agentCard.name="My-Server"
agentCard.skills=[{"id":"chat","name":"chat"}]

# Recommended
security.inboundAuth="bearer"
security.token=$(openssl rand -hex 24)
routing.defaultAgentId="main"

# For peering
peers=[{
  name:"Peer-B",
  agentCardUrl:"http://peer-ip:18800/.well-known/agent-card.json",
  auth:{type:"bearer",token:"<peer-token>"}
}]
```

## Security Model

**Inbound (Peer → You)**
- Peer sends: `Authorization: Bearer <token>`
- Plugin validates against config
- Result: Allow or JSON-RPC error -32000

**Outbound (You → Peer)**
- Config stores peer token
- A2AClient injects header
- Applied to all requests

**Best Practices**
1. Generate tokens: `openssl rand -hex 24`
2. Store in OpenClaw config (encrypted)
3. Share via secure channel (not logs/code)
4. Use Tailscale for network encryption

## Project Metadata

- **Repository**: https://github.com/win4r/openclaw-a2a-gateway
- **Version**: 1.0.0
- **Created**: February 20, 2026
- **Last Updated**: March 7, 2026
- **Language**: TypeScript (Node.js ≥ 22)
- **License**: MIT
- **Status**: Production-ready for single/small peer networks

## Analysis Completeness

✓ All 5 core source files analyzed
✓ Configuration schema fully documented
✓ All public endpoints documented
✓ Security model fully explained
✓ Task lifecycle complete
✓ 16 major topics covered
✓ Multiple example scenarios
✓ Complete troubleshooting guide
✓ Architecture visualized
✓ 1220 lines of analysis documentation

## Getting Started

1. Start here: **OPENCLAW-A2A-ANALYSIS-INDEX.md**
2. Then: **openclaw-a2a-quick-reference.md** (5-minute setup)
3. Reference: **openclaw-a2a-analysis.md** (deep understanding)
4. Visual: **openclaw-a2a-architecture.txt** (diagrams)

## Questions Answered

This analysis answers all your original questions:

1. **What is this project?** → OpenClaw plugin implementing A2A v0.3.0 protocol
2. **How does it bridge OpenClaw/WinClaw with A2A?** → Full flow documented in section 2
3. **Key files and purposes?** → Detailed in section 3
4. **How does it expose agents as A2A?** → Section 4 explains agent card generation
5. **What endpoints?** → Section 5 lists all 3 public endpoints
6. **How does agent discovery work?** → Section 6 covers Agent Card mechanism
7. **How does it manage tasks?** → Section 7 explains task lifecycle
8. **What technologies?** → Section 8 lists all dependencies
9. **Limitations and TODOs?** → Section 9 catalogs all 10+ limitations

## Additional Resources

- **A2A Specification**: https://github.com/google/A2A
- **TypeScript SDK**: https://www.npmjs.com/package/@a2a-js/sdk
- **OpenClaw**: https://github.com/openclaw/openclaw
- **Demo Video**: https://youtu.be/aI77F7vVodE

---

**Analysis Generated**: 2026-03-08
**Plugin Version Analyzed**: 1.0.0
**Repository Last Updated**: 2026-03-07

All documents are in this directory. Start with `OPENCLAW-A2A-ANALYSIS-INDEX.md`.
