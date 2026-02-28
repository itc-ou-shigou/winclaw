# Python / FastAPI Best Practices for Code Review

- **Language**: Python 3.10+
- **Framework**: FastAPI, SQLAlchemy 2.0+, Pydantic v2
- **Source**: https://github.com/fastapi-practices/skills/tree/master/skills/fastapi-best-architecture
- **Applicable when**: `project-structure.json` → `backend.framework == "fastapi"` or (`backend.language == "python"` and FastAPI imports detected)

---

## Architecture Patterns

### Pseudo 3-Tier Architecture
```
API Layer     → Request handling, route definitions
    ↓
Schema Layer  → DTOs and validation (Pydantic v2)
    ↓
Service Layer → Business logic implementation
    ↓
CRUD Layer    → Data persistence operations
    ↓
Model Layer   → Entity definitions (SQLAlchemy 2.0)
```

### Development Sequence
1. Define database models (SQLAlchemy)
2. Create validation schemas (Pydantic)
3. Implement API routes
4. Develop service logic
5. Implement CRUD operations

### Service Layer Rules
- Use `*` to force keyword-only arguments in service methods:
  ```python
  async def create_user(*, name: str, email: str) -> User:
  ```
- Services contain all business logic — controllers/routes are thin
- Services call CRUD layer, never access ORM directly

---

## Code Quality Standards

### Type Annotations (Mandatory)
- ALL functions must have complete type annotations (params + return)
- Use `Annotated` for dependency injection and validation:
  ```python
  async def get_user(user_id: Annotated[int, Path(gt=0)]) -> UserResponse:
  ```
- Use `Mapped[]` type for all SQLAlchemy model columns
- Use `str | None` instead of `Optional[str]` (Python 3.10+)

### Import Rules
- Import modules, not individual names (prefer `import module` over `from module import X`)
- No wildcard imports (`from module import *`)
- No relative imports (`from .module import X`)
- Group imports: stdlib → third-party → local

### Async Patterns
- Use `async/await` for ALL I/O operations (database, HTTP, file)
- Never use synchronous I/O in async endpoints
- Use `asyncio.gather()` for parallel async operations

### Code Formatting
- Use Ruff for formatting AND linting
- Line length: 120 characters max
- Follow PEP 8 with Ruff enforcement

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files / directories | `lowercase_with_underscores` | `user_service.py` |
| Classes | `PascalCase` | `UserService`, `OrderSchema` |
| Functions / methods | `lowercase_with_underscores` | `get_user_by_id` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_PAGE_SIZE` |
| CRUD methods | `get()`, `get_by_xxx()`, `create()`, `update()`, `delete()` | `get_by_email()` |
| Service methods | Same as CRUD | `create_user()` |
| API functions | `lowercase_with_underscores` | `get_users_paginated` |
| Schema classes | Pattern-based naming | See below |

### Schema Naming Convention
```
XxxSchemaBase   → Base schema with shared fields
XxxParam        → Request parameters (query/path)
CreateXxxParam  → Create request body
UpdateXxxParam  → Update request body
GetXxxDetail    → Single item response
GetXxxList      → List response
```

---

## Security Checklist

- [ ] JWT authentication following RFC 6750 (Bearer token)
- [ ] RBAC authorization: `module:resource:action` permission format
- [ ] Rate limiting via route dependencies
- [ ] Input validation via Pydantic schemas — never trust raw request data
- [ ] Parameterized database queries (SQLAlchemy handles this automatically)
- [ ] CORS configured explicitly — not `*` in production
- [ ] Passwords hashed with bcrypt — never stored plain text
- [ ] Sensitive config via environment variables, not in code
- [ ] No sensitive data in error responses to clients

---

## Performance Patterns

### Database
- Use async SQLAlchemy sessions for non-blocking queries
- Eager load relationships to prevent N+1 queries
- Use pagination for all list endpoints
- Index frequently queried columns
- Use connection pooling (SQLAlchemy default)

### API
- Use dependency injection for shared resources (DB session, auth)
- Cache expensive computations with `functools.lru_cache` or Redis
- Use background tasks for non-blocking operations (`BackgroundTasks`)
- Use streaming responses for large data transfers

---

## Anti-Patterns (Review Targets)

### Bug-Risk Anti-Patterns (Auto-Fix Candidates)
| Anti-Pattern | Bug Risk | Fix |
|-------------|----------|-----|
| Synchronous I/O in async endpoint | Event loop blocking, timeout | Use `async/await` |
| Missing type annotations | Runtime type errors, unclear API | Add full type hints |
| `Optional[str]` instead of `str \| None` | Inconsistent, deprecated style | Use union syntax |
| Missing `*` in service method signatures | Positional arg confusion | Add `*` after self/cls |
| Raw SQL string with f-string interpolation | SQL injection | Use SQLAlchemy parameterized |
| Missing Pydantic validation on input | Invalid data passes through | Add schema validation |
| `from module import *` wildcard | Namespace pollution, hidden deps | Import explicitly |
| Relative imports (`from .x import y`) | Fragile, hard to refactor | Use absolute imports |
| Missing `async` on I/O functions | Blocks event loop | Add `async def` |

### Style Anti-Patterns (Report Only)
| Anti-Pattern | Recommendation |
|-------------|----------------|
| Business logic in route functions | Move to service layer |
| Inline validation instead of schema | Create Pydantic schema class |
| Mixed naming conventions | Follow naming table above |
| Missing docstrings on public APIs | Add reStructuredText docstrings |
| Direct ORM access from routes | Use CRUD layer |

---

## Testing Standards

- Use `pytest` with `pytest-asyncio` for async tests
- Use `httpx.AsyncClient` for API endpoint testing
- Use factory pattern for test data creation
- Test schema validation (valid + invalid inputs)
- Test each service method independently
- Mock external dependencies (DB, HTTP, cache)
- Test both success paths and error paths (400, 401, 403, 404, 422, 500)

---

## Model Definition Standards

### SQLAlchemy 2.0 Mapped Columns
```python
class User(Base):
    __tablename__ = 'users'

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(sa.String(64))
    email: Mapped[str | None] = mapped_column(default=None)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
```

- Always specify `__tablename__` explicitly
- Always define primary key explicitly
- Use `Mapped[]` type for all columns
- Use timezone-aware datetime columns
