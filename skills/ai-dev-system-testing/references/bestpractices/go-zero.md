# Go / go-zero Best Practices for Code Review

- **Language**: Go 1.19+
- **Framework**: go-zero 1.5+ (microservices framework)
- **Source**: https://github.com/zeromicro/zero-skills/tree/main
- **Applicable when**: `project-structure.json` → `backend.framework == "go-zero"` or (`backend.language == "go"` and go-zero imports detected)

---

## Architecture Patterns

### Three-Layer Separation (Mandatory)
```
Handler Layer  → HTTP routing, request parsing (httpx utilities only)
    ↓
Logic Layer    → ALL business logic implementation
    ↓
Model Layer    → Database operations and data access
```

- **Handlers must be thin**: Only HTTP request/response concerns
- **Never put business logic in handlers**
- **Never put database operations in handlers**
- Use `goctl` to generate handlers/routes — never hand-write them

### Configuration Pattern
- Use structured YAML files with typed Go structs
- Always embed `rest.RestConf` in REST API configs
- Always embed `zrpc.RpcServerConf` in gRPC configs
- Centralize all dependencies in `ServiceContext` struct
- Support environment variable overrides
- Use validation tags with defaults: `json:",default=10485760"`

---

## Code Quality Standards

### Request/Response Handling
- Use `httpx.Parse()` for all request parsing (body + path + query)
- Use `httpx.OkJsonCtx()` for success responses
- Use `httpx.ErrorCtx()` for error responses
- Define clear request/response types with validation tags
- Never use manual JSON marshaling in handlers

### gRPC Patterns
- Use Protocol Buffers for service definitions
- Use proper gRPC status codes:
  - `codes.InvalidArgument` — validation failures
  - `codes.NotFound` — resource not found
  - `codes.Internal` — server errors
- Never return generic errors — use typed status codes
- Never return `nil, nil` in gRPC handlers
- Implement proper context propagation throughout all calls

### Context Handling
- Always pass `context.Context` to all database operations
- Always pass `context.Context` to all RPC calls
- Use cascading timeouts via context at service, handler, and operation levels
- Never create goroutines without context cancellation

### Dependency Management
- Initialize single connection pools in `ServiceContext`
- Never create global variables for dependencies
- Never create new connections per request

---

## Naming Conventions

- Files: `snake_case.go` (`user_handler.go`, `order_logic.go`)
- Packages: `lowercase` single word (`handler`, `logic`, `model`)
- Exported types/functions: `PascalCase` (`UserInfo`, `CreateOrder`)
- Unexported: `camelCase` (`getUserById`, `orderRepo`)
- API paths: `/api/v1/resource` (lowercase, plural)
- Proto services: `PascalCase` (`UserService.GetUser`)

---

## Security Checklist

- [ ] Validate all inputs using struct tags with validator library
- [ ] Hash passwords with bcrypt before storage — never store plain text
- [ ] Use JWT tokens with HS256 signing for authentication
- [ ] Never log credentials, tokens, or sensitive data
- [ ] Return generic errors to clients, detailed logs internally
- [ ] Use parameterized queries (automatic in go-zero model layer)
- [ ] Rate limiting on public endpoints (token bucket or period-based)

---

## Performance Patterns

### Built-in Resilience
1. **Circuit Breaker** (automatic on all RPC, DB, Redis, HTTP calls)
   - Opens when error rate > 50% AND minimum 10 requests
   - Uses Google SRE algorithm
2. **Load Shedding** (monitors CPU, auto-rejects overloaded requests)
   - Enabled in production (`Mode: pro/pre`)
   - Disabled in development mode
3. **Rate Limiting** (token bucket + Redis-enforced for distributed)
4. **Graceful Shutdown** (proper cleanup of connections)

### Optimization
- Use `MapReduce` for batch operations with parallelization
- Use automatic caching for primary key and unique index lookups
- Avoid N+1 queries — use batch queries
- Avoid unbounded goroutines — use worker pools
- Cache property access in hot paths

---

## Anti-Patterns (Review Targets)

### Bug-Risk Anti-Patterns (Auto-Fix Candidates)
| Anti-Pattern | Bug Risk | Fix |
|-------------|----------|-----|
| Business logic in handler layer | Untestable, tight coupling | Move to logic layer |
| Manual JSON marshaling in handlers | Inconsistent error format | Use `httpx.OkJsonCtx()` |
| Missing `context.Context` in DB calls | No timeout/cancellation propagation | Add context parameter |
| `nil, nil` return in gRPC handler | Silent failure, hard to debug | Return proper status error |
| Global variables for dependencies | Race condition, untestable | Use `ServiceContext` |
| Hand-written handlers/routes | Inconsistent patterns, bugs | Use `goctl` generation |
| Generic `error` in gRPC responses | Client can't distinguish error types | Use `status.Error(codes.X)` |
| Unbounded goroutines | Memory leak, resource exhaustion | Use worker pool or context |
| Load shedding disabled in production | Server crash under load | Set `Mode: pro` or `pre` |

### Style Anti-Patterns (Report Only)
| Anti-Pattern | Recommendation |
|-------------|----------------|
| Verbose string interpolation in logs | Use structured `logx` with fields |
| Complex logic in handler tests | Test logic layer independently |
| Missing validation tags on request types | Add struct validation tags |
| Inline configuration values | Use config YAML + Go structs |

---

## Testing Standards

- Use table-driven test patterns (Go standard)
- Use `testify` assertions for validation
- Mock dependencies with GoMock
- Include both positive and negative test cases
- Integration tests with real database connections
- Never test generated code (handlers/routes) — test logic layer

---

## Database Operations

### Model Layer
- Use `goctl model` for auto-generation from SQL schemas
- Use `TransactCtx()` for atomic multi-step operations
- Handle `ErrNotFound` explicitly — do not treat as generic error
- Support both MySQL and MongoDB via go-zero model layer
- Always use parameterized queries (automatic)

### Caching
- Automatic cache for primary key lookups
- Automatic cache for unique index lookups
- Redis-backed for distributed caching
- LRU cache invalidation built-in
