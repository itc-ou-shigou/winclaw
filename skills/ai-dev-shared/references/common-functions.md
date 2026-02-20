# Common Functions Reference

## Service Auto-Detection

### Backend Detection

Scan order for backend directory: `backend/`, `server/`, `api/`, `.`

Detection by file presence:

- `requirements.txt` or `pyproject.toml` → Python (FastAPI/Django/Flask)
- `package.json` with express/fastify/nest → Node.js
- `go.mod` → Go
- `pom.xml` or `build.gradle` → Java/Spring

### Frontend Detection

Scan order: `frontend/`, `client/`, `web/`, `.`

Detection by `package.json` content:

- `next` → Next.js
- `react-scripts` → Create React App
- `vite` + `react` → Vite + React
- `@angular/core` → Angular
- `vue` → Vue.js

### Port Discovery

Backend port scan order: `3001, 8000, 8080, 5000, 3000`
Frontend port scan order: `3000, 5173, 5174, 8080, 4200`

```bash
# Auto-detect running backend port
for PORT in 3001 8000 8080 5000 3000; do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/health" | grep -q "200\|404"; then
    BACKEND_PORT=$PORT; break
  fi
done
```

### Install Command Detection

| Lock File           | Install Command                   |
| ------------------- | --------------------------------- |
| `poetry.lock`       | `poetry install`                  |
| `package-lock.json` | `npm ci`                          |
| `yarn.lock`         | `yarn install --frozen-lockfile`  |
| `pnpm-lock.yaml`    | `pnpm install --frozen-lockfile`  |
| `requirements.txt`  | `pip install -r requirements.txt` |
| `Pipfile.lock`      | `pipenv install`                  |

## Service Startup & Health Check

### Start Backend

```bash
# Read from project-structure.json if available
PSC="$AIDEV_WORKSPACE/deployment-logs/project-structure.json"
PYTHON=$(command -v python3 || command -v python)
if [ -f "$PSC" ]; then
  BACKEND_DIR=$($PYTHON -c "import json; d=json.load(open('$PSC')); print(d.get('backend',{}).get('directory','backend'))")
  BACKEND_CMD=$($PYTHON -c "import json; d=json.load(open('$PSC')); print(d.get('testing',{}).get('startup',{}).get('backend',{}).get('command',''))")
fi

# Fallback: auto-detect
BACKEND_DIR="${BACKEND_DIR:-backend}"
cd "$AIDEV_WORKSPACE/$BACKEND_DIR"

# Install dependencies
pip install -r requirements.txt 2>/dev/null || npm ci 2>/dev/null

# Start service in background
nohup $BACKEND_CMD > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for health check
for i in $(seq 1 30); do
  if curl -s "http://localhost:${BACKEND_PORT:-3001}/health" >/dev/null 2>&1; then
    echo "Backend ready on port ${BACKEND_PORT:-3001}"
    break
  fi
  sleep 2
done
```

## 4-Stage Service Repair

When a service fails to start, apply this escalating repair strategy:

### Stage 1: Dependency Fix

```bash
cd "$BACKEND_DIR"
pip install -r requirements.txt  # or npm ci
```

### Stage 2: Migration Fix

```bash
# Auto-detect migration tool
if [ -f "alembic.ini" ]; then
  alembic upgrade head
elif [ -d "prisma" ]; then
  npx prisma migrate deploy
elif [ -f "manage.py" ]; then
  python manage.py migrate
fi
```

### Stage 3: Port Conflict Fix

```bash
# Kill process on target port (Mac/Linux)
PORT=${BACKEND_PORT:-3001}
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
# Windows alternative: netstat -ano | findstr :$PORT → taskkill /PID <pid> /F
```

### Stage 4: Claude Auto-Repair

```bash
# Ask Claude to diagnose and fix
claude --dangerously-skip-permissions -p "The backend service failed to start. Error log: $(tail -50 /tmp/backend.log). Diagnose and fix the issue."
```

## Database URL Handling

### Auto-Detection Chain

1. Environment variable `DATABASE_URL`
2. `$AIDEV_WORKSPACE/.env` → `grep "^DATABASE_URL="`
3. `$AIDEV_WORKSPACE/backend/.env` → `grep "^DATABASE_URL="`
4. Skip DB-dependent steps if not found

### Sync/Async Conversion

```bash
# Convert async URL to sync for Alembic
SYNC_URL=$(echo "$DATABASE_URL" | sed 's/mysql+aiomysql:/mysql+pymysql:/g' | sed 's/postgresql+asyncpg:/postgresql:/g')
```
