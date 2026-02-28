# Java / Spring Boot Best Practices for Code Review

- **Language**: Java 21+ (LTS recommended, up to Java 25)
- **Framework**: Spring Boot 3.x / 4.x, Spring Framework 6.x / 7.0
- **Source**: https://github.com/jdubois/dr-jskill/tree/main
- **Applicable when**: `project-structure.json` → `backend.framework == "spring-boot"` or `backend.language == "java"`

---

## Architecture Patterns

### Layered Architecture
```
Controller (REST endpoints — thin, HTTP concerns only)
    ↓
Service (business logic — only when complex logic exists)
    ↓
Repository (Spring Data JPA — data access)
    ↓
Entity (JPA domain objects)
```

- **Service layer is optional**: Simple CRUD operations go directly Controller → Repository
- Package organization: `config/`, `controller/`, `service/`, `repository/`, `domain/`
- Use `@ConfigurationProperties` for type-safe externalized configuration

### Key Spring Boot 4.x Changes
| Old (Spring Boot 3.x) | New (Spring Boot 4.x) | Impact |
|----------------------|----------------------|--------|
| `@MockBean` | `@MockitoBean` | Test annotation migration |
| `org.springframework.boot.test.mock.mockito` | `org.springframework.test.context.bean.override.mockito` | Package relocation |
| `@WebMvcTest` in `boot.test.autoconfigure.web.servlet` | Moved to `boot.webmvc.test.autoconfigure` | Import path change |
| Jackson `com.fasterxml.jackson.databind.*` | `tools.jackson.databind.*` | Jackson 3 migration (annotations unchanged) |
| TestContainers 1.x `org.testcontainers.containers` | TestContainers 2.0+ `org.testcontainers.postgresql` | Package rename |

---

## Code Quality Standards

### Mandatory
- Always declare explicit `<start-class>` in `pom.xml` `<properties>`
- Use `.properties` files exclusively (not YAML) for Spring configuration
- Externalize secrets via environment variables — never commit `.env`
- Provide `.env.sample` template (committed to git)
- Use `@Column`, `@Table`, `@Index` annotations for explicit schema definition

### Prohibited Dependencies
- **Lombok**: Never use — write explicit getters/setters/constructors
- **OpenAPI/springdoc**: Not included by default
- **Gradle**: Maven only
- **Liquibase/Flyway**: Use Hibernate `ddl-auto` only

### DDL Strategy by Environment
| Environment | `ddl-auto` | Purpose |
|------------|-----------|---------|
| Development | `update` | Auto-apply schema changes |
| Production | `validate` | Verify schema matches entities |
| Testing | `create-drop` | Clean slate each test run |

---

## Naming Conventions

- Classes: `PascalCase` (`UserController`, `OrderService`)
- Methods: `camelCase` (`findByEmail`, `createUser`)
- Constants: `UPPER_SNAKE_CASE` (`MAX_RETRY_COUNT`)
- Packages: `lowercase` (`com.example.app.controller`)
- Database tables: `snake_case` (`user_accounts`)
- REST endpoints: `/api/v1/resource-name` (plural, kebab-case)

---

## Security Checklist

- [ ] Passwords always hashed with `BCryptPasswordEncoder` — never plain text
- [ ] JWT secrets: 64+ character base64-encoded, appropriate expiration
- [ ] `SessionCreationPolicy.STATELESS` for REST APIs
- [ ] Method-level security with `@PreAuthorize` annotations
- [ ] HTTPS enforcement — redirect all HTTP to HTTPS
- [ ] CSRF enabled for web apps, disabled only for stateless REST
- [ ] CSP, X-Frame-Options, HSTS security headers enabled
- [ ] Rate limiting on auth endpoints (login, registration)
- [ ] Account lockout after failed login attempts
- [ ] Input validation and sanitization on all user input
- [ ] Audit logging for failed authentications and unauthorized access

---

## Performance Patterns

### JVM Configuration
- Use `-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0` in containers
- Enable virtual threads: `spring.threads.virtual.enabled=true` for I/O-bound workloads
- HikariCP connection pool with appropriate tuning

### Docker
- Multi-stage builds with Alpine/slim base images (`eclipse-temurin:25-jre-alpine`)
- Run as non-root user
- Pin specific image versions (never `latest` in production)
- Clean package manager cache after installation
- Health checks via Spring Boot Actuator

### Database
- Use `@Index` annotations for frequently queried columns
- Avoid N+1 queries — use `@EntityGraph` or `JOIN FETCH`
- Connection pooling via HikariCP defaults

---

## Anti-Patterns (Review Targets)

### Bug-Risk Anti-Patterns (Auto-Fix Candidates)
| Anti-Pattern | Bug Risk | Fix |
|-------------|----------|-----|
| `@MockBean` in Spring Boot 4.x | Compilation failure | Migrate to `@MockitoBean` |
| Old TestContainers 1.x imports | Build failure | Use `org.testcontainers.postgresql.*` |
| Missing `<start-class>` in pom.xml | Application startup failure | Add explicit main class property |
| `public` modifier on `@TestConfiguration` | Configuration leak across tests | Remove `public` modifier |
| Plain text passwords in database | Security vulnerability | Use `BCryptPasswordEncoder` |
| `ddl-auto=update` in production | Data loss risk | Change to `validate` |
| Secrets committed in `.properties` | Credential exposure | Externalize to environment variables |

### Style Anti-Patterns (Report Only)
| Anti-Pattern | Recommendation |
|-------------|----------------|
| Lombok usage | Write explicit Java code |
| YAML configuration files | Use `.properties` format |
| Service layer for simple CRUD | Remove unnecessary indirection |
| Fat controllers with business logic | Extract to Service layer |
| Missing `@Transactional` on write operations | Add explicit transaction boundary |

---

## Testing Standards

### Three-Tier Testing
1. **Unit Tests** (`*Test.java`): `@ExtendWith(MockitoExtension.class)`, no Spring container
2. **Spring Integration** (`*Test.java`): `@SpringBootTest` + `@MockitoBean`, `@WebMvcTest` for controllers
3. **Full Integration** (`*IT.java`): TestContainers 2.0+ with `@ServiceConnection`

### Quality Standards
- Target: 80%+ code coverage on business-critical paths
- Use AssertJ fluent syntax (`assertThat()`)
- Given-When-Then test structure
- Clean database state via `@BeforeEach`
- Test both success paths and edge cases
- Run: `./mvnw test` (unit), `./mvnw verify` (integration)

---

## Observability

- Spring Boot Actuator endpoints: `/actuator/health/liveness`, `/actuator/health/readiness`
- Structured logging with Logback
- OpenTelemetry integration via `spring-boot-starter-opentelemetry`
- Micrometer for application metrics
