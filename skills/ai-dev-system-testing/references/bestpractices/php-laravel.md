# PHP / Laravel Best Practices for Code Review

- **Language**: PHP 8.1+
- **Framework**: Laravel (API development)
- **Source**: https://github.com/JustSteveKing/laravel-api-skill/tree/main
- **Applicable when**: `project-structure.json` → `backend.framework == "laravel"` or `backend.language == "php"`

---

## Architecture Patterns

### Resource-Scoped Organization
```
Routes       → Resource-scoped, one controller per resource action
Controllers  → Single __invoke() method (invokable controllers)
Form Requests → Validation + payload() method for DTO creation
DTOs         → Immutable data classes for inter-layer communication
Actions      → Single-responsibility business logic classes
Responses    → Responsable interface implementation
Models       → Data access only, no business logic
```

### Boundary-First Separation
- **HTTP layer**: Controllers, Form Requests, Responses
- **Business logic layer**: Actions, DTOs
- **Data layer**: Models, Repositories
- Stateless design: explicit data flow through DTOs, no hidden state

---

## Code Quality Standards

### Type Safety (Mandatory)
- `declare(strict_types=1)` at top of every PHP file
- Return type declarations on ALL methods
- Property type declarations on ALL class properties
- Use union types (`string|null`) instead of mixed
- PSR-12 coding standard compliance

### Controller Pattern
```php
// CORRECT: Single invokable controller
final class StoreUserController
{
    public function __invoke(StoreUserRequest $request): JsonResponse
    {
        $payload = $request->payload(); // DTO from Form Request
        $user = StoreUserAction::handle($payload);
        return new UserResponse($user);
    }
}
```

### Form Request Pattern
```php
final class StoreUserRequest extends FormRequest
{
    public function rules(): array { /* validation rules */ }

    public function payload(): CreateUserDTO
    {
        return new CreateUserDTO(
            name: $this->validated('name'),
            email: $this->validated('email'),
        );
    }
}
```

### ID Strategy
- Use ULIDs for all primary keys (not auto-increment integers)
- ULIDs are sortable, globally unique, and URL-safe

---

## Naming Conventions

- Classes: `PascalCase` (`UserController`, `StoreOrderAction`)
- Methods: `camelCase` (`findByEmail`, `payload`)
- Variables: `camelCase` (`$userData`, `$orderTotal`)
- Database tables: `snake_case` plural (`users`, `order_items`)
- Database columns: `snake_case` (`created_at`, `user_id`)
- Routes: `kebab-case` plural (`/api/v1/order-items`)
- Config keys: `snake_case` (`mail.from_address`)

---

## Security Checklist

- [ ] All user input validated via Form Requests — never use `$request->all()`
- [ ] Use `$request->validated()` or `$request->safe()` only
- [ ] Parameterized queries via Eloquent (automatic) — never raw SQL with user input
- [ ] CORS configured explicitly — not `*` in production
- [ ] Rate limiting on authentication endpoints
- [ ] API authentication via JWT (PHP Open Source Saver JWT library)
- [ ] Sensitive config values via `.env` only — never committed
- [ ] Mass assignment protection: explicit `$fillable` or `$guarded` on models

---

## Performance Patterns

### Query Optimization
- Use Spatie QueryBuilder for filtering, sorting, and relation loading
- Eager load relationships (`with()`) to prevent N+1 queries
- Use pagination for list endpoints
- Index frequently queried columns

### Response Optimization
- Use API Resources for response transformation
- Implement HTTP caching headers (ETag, Cache-Control)
- Use HTTP Sunset headers for API deprecation notices

---

## Anti-Patterns (Review Targets)

### Bug-Risk Anti-Patterns (Auto-Fix Candidates)
| Anti-Pattern | Bug Risk | Fix |
|-------------|----------|-----|
| `$request->all()` for mass assignment | Mass assignment vulnerability | Use `$request->validated()` |
| Missing `strict_types=1` | Type coercion bugs | Add declaration to every file |
| Business logic in Model | Untestable, violation of SRP | Move to Action class |
| Multi-action controllers | Hard to test, violates SRP | Use invokable `__invoke()` |
| Direct `$request->input()` access | Bypasses validation | Use Form Request `validated()` |
| Missing return types | Type confusion, runtime errors | Add return type declarations |
| Raw SQL with user input | SQL injection | Use Eloquent or parameterized queries |
| Missing `$fillable` / `$guarded` | Mass assignment vulnerability | Add explicit attribute lists |

### Style Anti-Patterns (Report Only)
| Anti-Pattern | Recommendation |
|-------------|----------------|
| Auto-increment IDs | Use ULIDs for primary keys |
| Generic error responses | Use RFC 7807 Problem+JSON format |
| Missing API deprecation headers | Add HTTP Sunset headers |
| Fat Form Requests without DTO | Add `payload()` method returning DTO |
| Service classes for simple CRUD | Consider direct Action pattern |

---

## Testing Standards

- Feature tests for HTTP endpoints (`$this->postJson('/api/...')`)
- Unit tests for Actions and DTOs
- Use `RefreshDatabase` trait for test isolation
- Factory-based test data setup
- Assert both response status and structure
- Test validation rules explicitly (invalid input → 422)
- Test authorization (forbidden → 403)

---

## Error Handling

### RFC 7807 Problem+JSON
```json
{
    "type": "https://api.example.com/problems/validation-error",
    "title": "Validation Error",
    "status": 422,
    "detail": "The email field is required.",
    "instance": "/api/v1/users"
}
```
- All error responses should follow RFC 7807 format
- Use `Responsable` interface for custom error response classes
- Log errors with context (request ID, user ID, endpoint)
