# Phase 5: Testing Reference

## Overview

Phase 5 runs three sub-phases:
- **5A**: Database validation (pre-check)
- **5B**: API endpoint testing
- **5C**: UI testing with browser automation

## Phase 5A: Database Validation

Pre-requisite check before API/UI testing.

### Steps
1. Check `DATABASE_URL` connectivity
2. Verify database schema (tables exist)
3. Run migrations if needed (`alembic upgrade head` / `prisma migrate deploy`)
4. Validate health endpoint responds

### Execution
```bash
# Auto-detect and validate DB
if [ -n "$DATABASE_URL" ]; then
  echo "Validating database connection..."
  python3 -c "
import sqlalchemy
engine = sqlalchemy.create_engine('$DATABASE_URL')
conn = engine.connect()
print('DB connection OK')
conn.close()
" 2>&1 || echo "DB validation failed (non-blocking)"
fi
```

### Skip Condition
If `DATABASE_URL` is not set and cannot be auto-detected, skip 5A entirely.

## Phase 5B: API Testing

### Pre-requisite: Start Backend
Before running API tests, ensure backend is running:

```bash
# Start backend service
bash pty:true workdir:$AIDEV_WORKSPACE timeout:60 command:"cd backend && pip install -r requirements.txt && python -m uvicorn app.main:app --port 3001 &"
# Wait for health
sleep 10
curl -s http://localhost:${BACKEND_PORT:-3001}/health
```

### Execution

```bash
# Standard mode: Use phase5b-api-tests.md prompt
bash pty:true workdir:$AIDEV_WORKSPACE timeout:7200 command:"cat .claude/prompts/phase5b-api-tests.md | claude --dangerously-skip-permissions"

# Efficient mode: Use phase5b-api-tests-efficient.md
bash pty:true workdir:$AIDEV_WORKSPACE timeout:7200 command:"cat .claude/prompts/phase5b-api-tests-efficient.md | claude --dangerously-skip-permissions"
```

### What It Tests
- All API endpoints from `/openapi.json`
- CRUD operations (Create, Read, Update, Delete)
- Authentication flows (login, token refresh)
- Error responses (400, 401, 404, 500)
- Target pass rate: 95%

### Port Configuration
Use `AIDEV_BACKEND_URL` if set, otherwise auto-detect:
```
Scan order: 3001 → 8000 → 8080 → 5000 → 3000
Health endpoint: /health (default)
```

## Phase 5C: UI Testing

### Pre-requisite: Start Frontend
```bash
# Start frontend
bash pty:true workdir:$AIDEV_WORKSPACE timeout:60 command:"cd frontend && npm ci && npm run dev &"
sleep 15
curl -s http://localhost:${FRONTEND_PORT:-3000}
```

### Execution

```bash
# Standard mode
bash pty:true workdir:$AIDEV_WORKSPACE timeout:7200 command:"cat .claude/prompts/phase5c-ui-tests.md | claude --dangerously-skip-permissions"

# Efficient mode
bash pty:true workdir:$AIDEV_WORKSPACE timeout:7200 command:"cat .claude/prompts/phase5c-ui-tests-efficient.md | claude --dangerously-skip-permissions"
```

### What It Tests (4 Categories)
1. **Form Input + Submit**: Fill forms with validation
2. **Button Click**: CRUD operations, modals, dialogs
3. **Link Navigation**: Page routing, breadcrumbs
4. **CSS/Visual**: Layout, responsive design

### Chrome DevTools MCP Setup
Phase 5C uses Chrome DevTools MCP for browser automation:
- `read_page`: Get page accessibility tree
- `find`: Find elements by description
- `computer`: Click, type, screenshot
- `javascript_tool`: Execute JS in page context

### Test Results
Output saved to `test-logs/`:
- `test-logs/phase5b_api_results.json` — API test results
- `test-logs/phase5c_ui_results.json` — UI test results
- `test-logs/screenshots/` — UI test screenshots

## Phase 5 Skip Conditions

Set `SKIP_PHASE5=1` to skip all Phase 5 testing (useful for re-runs after tests pass).
