# OpenClaw A2A Gateway - Quick Reference

## What It Does

The **openclaw-a2a-gateway** plugin enables agents on different OpenClaw servers to communicate with each other via the standard A2A (Agent-to-Agent) v0.3.0 protocol.

- **Exposes** your OpenClaw agents as A2A-compliant agents
- **Receives** messages from peer agents on port 18800
- **Discovers** peer agents via Agent Cards at `/.well-known/agent-card.json`
- **Routes** messages to your OpenClaw agents via Gateway RPC
- **Allows** your agents to call peer agents

## Installation

```bash
mkdir -p ~/.openclaw/workspace/plugins
cd ~/.openclaw/workspace/plugins
git clone https://github.com/win4r/openclaw-a2a-gateway.git a2a-gateway
cd a2a-gateway
npm install --production

# Register plugin
openclaw config set plugins.allow '["a2a-gateway", ...]'
openclaw config set plugins.load.paths '["/absolute/path/to/a2a-gateway"]'
```

## 5-Minute Setup

### 1. Basic Configuration

```bash
# Generate security token
TOKEN=$(openssl rand -hex 24)
echo "Your token: $TOKEN"

# Configure agent card
openclaw config set plugins.entries.a2a-gateway.config.agentCard.name 'My-Server'
openclaw config set plugins.entries.a2a-gateway.config.agentCard.url 'http://<YOUR_IP>:18800/a2a/jsonrpc'
openclaw config set plugins.entries.a2a-gateway.config.agentCard.skills '[{"id":"chat","name":"chat"}]'

# Configure server
openclaw config set plugins.entries.a2a-gateway.config.server.port 18800

# Configure security
openclaw config set plugins.entries.a2a-gateway.config.security.inboundAuth 'bearer'
openclaw config set plugins.entries.a2a-gateway.config.security.token "$TOKEN"

# Configure routing
openclaw config set plugins.entries.a2a-gateway.config.routing.defaultAgentId 'main'

# Restart
openclaw gateway restart
```

### 2. Add Peer

```bash
# Get peer's Agent Card (from peer, substitute <PEER_IP> and <PEER_TOKEN>)
curl http://<PEER_IP>:18800/.well-known/agent-card.json

# Add as peer
openclaw config set plugins.entries.a2a-gateway.config.peers '[{
  "name": "PeerName",
  "agentCardUrl": "http://<PEER_IP>:18800/.well-known/agent-card.json",
  "auth": {"type": "bearer", "token": "<PEER_TOKEN>"}
}]'

# Restart
openclaw gateway restart
```

### 3. Verify

```bash
# Check your Agent Card
curl -s http://localhost:18800/.well-known/agent-card.json | python3 -m json.tool

# Try to send a message to peer
node ~/.openclaw/workspace/plugins/a2a-gateway/skill/scripts/a2a-send.mjs \
  --peer-url http://<PEER_IP>:18800 \
  --token <PEER_TOKEN> \
  --message "Hello from Server A!"
```

## Configuration Reference

### agentCard (Required)

```bash
name: "Server-A"                    # Display name
description: "My A2A Agent"         # Description (optional)
url: "http://ip:18800/a2a/jsonrpc" # JSON-RPC endpoint (auto-generated if omitted)
skills: [                           # List of capabilities
  {"id": "chat", "name": "chat", "description": "Chat bridge"}
]
```

### server

```bash
host: "0.0.0.0"   # Bind address (default)
port: 18800       # Port (default)
```

### security

```bash
inboundAuth: "bearer"      # "none" or "bearer" (default: none)
token: "abc123...xyz"      # 48-hex token (required if bearer)
```

### routing

```bash
defaultAgentId: "main"     # Agent to receive inbound A2A messages
```

### peers

```bash
[
  {
    "name": "Peer-B",
    "agentCardUrl": "http://peer-ip:18800/.well-known/agent-card.json",
    "auth": {
      "type": "bearer",
      "token": "peer-token-here"
    }
  }
]
```

### timeouts

```bash
agentResponseTimeoutMs: 300000   # Max wait for agent response (default: 5 min)
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/agent-card.json` | GET | Agent Card (peer discovery) |
| `/.well-known/agent.json` | GET | Legacy alias |
| `/a2a/jsonrpc` | POST | JSON-RPC transport |
| `/a2a/rest` | GET/POST/PUT | REST/HTTP+JSON transport |
| `:18801` (gRPC) | RPC | Binary gRPC transport |

## Gateway Method: a2a.send

Call from OpenClaw agent or skill:

```javascript
gateway("a2a.send", {
  peer: "Peer-B",
  message: {text: "Hello peer!"}
})
```

**Response**:
- Success: `{ok: true, statusCode: 200, response: {...}}`
- Error: `{ok: false, statusCode: 500, response: {error: "..."}}`

## Sending Messages from CLI

### Simple (Blocking)

```bash
node ~/.openclaw/workspace/plugins/a2a-gateway/skill/scripts/a2a-send.mjs \
  --peer-url http://<PEER_IP>:18800 \
  --token <PEER_TOKEN> \
  --message "Hello peer!"
```

### Long-Running (Async with Polling)

```bash
node ~/.openclaw/workspace/plugins/a2a-gateway/skill/scripts/a2a-send.mjs \
  --peer-url http://<PEER_IP>:18800 \
  --token <PEER_TOKEN> \
  --non-blocking \
  --wait \
  --timeout-ms 600000 \
  --poll-ms 1000 \
  --message "Analyze 1000 documents"
```

### Target Specific Agent on Peer (OpenClaw Extension)

```bash
node ~/.openclaw/workspace/plugins/a2a-gateway/skill/scripts/a2a-send.mjs \
  --peer-url http://<PEER_IP>:18800 \
  --token <PEER_TOKEN> \
  --agent-id coder \
  --message "Write a function"
```

## Network Setup

### Option A: Tailscale (Recommended)

```bash
# Install on both servers
curl -fsSL https://tailscale.com/install.sh | sh

# Authenticate (same account on both)
sudo tailscale up

# Get Tailscale IPs
tailscale status

# Use Tailscale IP in A2A config
# e.g., http://100.x.x.x:18800
```

### Option B: LAN

Use local IP addresses directly (e.g., `192.168.1.100`).

### Option C: Public IP

Use public IPs + bearer token authentication.

## Agent Awareness (TOOLS.md)

Add A2A info to agent's TOOLS.md so it knows how to call peers:

```markdown
## A2A Gateway

You have an A2A Gateway plugin running on port 18800.

### Peers

| Peer | IP | Token |
|------|-----|-------|
| Server-B | 100.10.10.2 | xyz-token |

### Send a message to a peer

Use exec tool:

\`\`\`bash
node ~/.openclaw/workspace/plugins/a2a-gateway/skill/scripts/a2a-send.mjs \
  --peer-url http://100.10.10.2:18800 \
  --token xyz-token \
  --message "YOUR MESSAGE"
\`\`\`
```

Then agents can say:
- "Send to Server-B: what's your status?"
- "Ask Server-B to run a health check"

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Agent Card 404** | Plugin not loaded. Check `plugins.allow`, `plugins.load.paths` in config |
| **Connection refused :18800** | Server not listening. Restart: `openclaw gateway restart` |
| **"Unauthorized: invalid bearer token"** | Token mismatch. Verify exact token match on both servers |
| **"Request accepted (no dispatch)"** | Agent dispatch failed. Check AI provider configured |
| **"agent dispatch failed (timeout)"** | Long prompt. Increase `agentResponseTimeoutMs` or use async mode |
| **Peer not found** | Peer name in config doesn't match. Check `a2a.send` peer parameter |

## Security Practices

1. **Generate tokens**: `openssl rand -hex 24`
2. **Store securely**: Keep in OpenClaw config (encrypted by OpenClaw)
3. **Share out-of-band**: Don't put tokens in code or logs
4. **Use Tailscale**: For network isolation + encryption
5. **Monitor logs**: Watch for unusual A2A activity
6. **Rotate periodically**: Manual process (store new token in config)

## Testing

```bash
# Run plugin tests
npm test

# From command line
# 1. Check Agent Card is accessible
curl http://localhost:18800/.well-known/agent-card.json

# 2. Send simple message
node skill/scripts/a2a-send.mjs \
  --peer-url http://peer:18800 \
  --token <token> \
  --message "test"

# 3. Monitor logs
tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep a2a
```

## File Locations

```
~/.openclaw/workspace/plugins/a2a-gateway/
├── index.ts                    # Plugin entry point
├── package.json                # Dependencies
├── openclaw.plugin.json        # Plugin manifest
├── src/
│   ├── agent-card.ts          # Agent Card generation
│   ├── executor.ts            # Agent dispatch logic
│   ├── client.ts              # Outbound A2A client
│   ├── types.ts               # Type definitions
│   └── internal/              # Gateway extensions (non-A2A)
│       ├── envelope.ts
│       ├── transport.ts
│       ├── routing.ts
│       ├── security.ts
│       ├── outbox.ts
│       ├── idempotency.ts
│       └── metrics.ts
├── skill/                     # Setup skill for agents
│   ├── SKILL.md
│   ├── scripts/
│   │   └── a2a-send.mjs       # CLI for sending messages
│   └── references/
│       └── tools-md-template.md
└── tests/                     # Test suite
    └── a2a-gateway.test.ts
```

## Known Limitations

- **In-memory tasks**: Restart = lost pending tasks
- **No streaming**: Polling only (no SSE/WebSocket)
- **No concurrency limits**: Can overload gateway
- **No peer health checks**: No failover
- **No token rotation**: Manual process
- **No audit log**: Can't track calls
- **No file transfer**: Text only

## Resources

- **GitHub**: https://github.com/win4r/openclaw-a2a-gateway
- **A2A Spec**: https://github.com/google/A2A
- **@a2a-js/sdk**: https://www.npmjs.com/package/@a2a-js/sdk
- **OpenClaw**: https://github.com/openclaw/openclaw
- **Demo Video**: https://youtu.be/aI77F7vVodE

## Two-Server Example

### Server A Setup

```bash
# Generate token
A_TOKEN=$(openssl rand -hex 24)
echo "Token: $A_TOKEN"

# Configure A2A
openclaw config set plugins.entries.a2a-gateway.config.agentCard.name 'Server-A'
openclaw config set plugins.entries.a2a-gateway.config.agentCard.url 'http://100.10.10.1:18800/a2a/jsonrpc'
openclaw config set plugins.entries.a2a-gateway.config.agentCard.skills '[{"id":"chat","name":"chat"}]'
openclaw config set plugins.entries.a2a-gateway.config.server.port 18800
openclaw config set plugins.entries.a2a-gateway.config.security.inboundAuth 'bearer'
openclaw config set plugins.entries.a2a-gateway.config.security.token "$A_TOKEN"
openclaw config set plugins.entries.a2a-gateway.config.routing.defaultAgentId 'main'

# Add Server B as peer (use B's token)
openclaw config set plugins.entries.a2a-gateway.config.peers '[{
  "name": "Server-B",
  "agentCardUrl": "http://100.10.10.2:18800/.well-known/agent-card.json",
  "auth": {"type": "bearer", "token": "<B_TOKEN>"}
}]'

openclaw gateway restart
```

### Server B Setup (Similar)

```bash
B_TOKEN=$(openssl rand -hex 24)
# ... same as Server A but with different IP/name ...
# Add Server A as peer using $A_TOKEN
```

### Test Connection

```bash
# From Server A → Server B
node ~/.openclaw/workspace/plugins/a2a-gateway/skill/scripts/a2a-send.mjs \
  --peer-url http://100.10.10.2:18800 \
  --token <B_TOKEN> \
  --message "Hello from Server A!"

# Expected response from Server B's main agent
```

---

**Last Updated**: 2026-03-08
**Plugin Version**: 1.0.0
