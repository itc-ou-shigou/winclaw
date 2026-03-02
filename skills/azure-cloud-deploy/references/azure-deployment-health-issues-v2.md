# azure-deployment-health-issues-v2.md

**Purpose**: Comprehensive troubleshooting guide for Azure App Service deployment including log retrieval, error investigation, and frontend static file serving issues.

**What's New in v2.3**:
- **Section 1: Azure Log Retrieval** - Complete guide for getting App Service logs
- **Section 2: Common Error Investigation** - 503/502/500 error diagnosis
- **Pattern 11: Node.js ZIP部署问题** - npm依赖缺失和启动命令问题 (DigitalHuman Frontend部署经验)
- **Pattern 12: 启动命令最佳实践** - bash vs sh vs npm start
- Claude CLI auto-fix integration with zero hardcoding

---

## Section 1: Azure App Service Log Retrieval

### 1.1 Real-time Log Streaming (Recommended First Step)

```bash
# Stream logs in real-time - see what's happening NOW
az webapp log tail \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --timeout 60

# With filter for errors only
az webapp log tail \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --filter Error
```

### 1.2 Download Complete Logs

```bash
# Download all logs to a zip file
az webapp log download \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --log-file azure-logs.zip

# Extract with overwrite (non-interactive)
unzip -o azure-logs.zip -d azure-logs/

# Key log files to examine:
# - azure-logs/LogFiles/*_docker.log   - Docker container logs (MOST IMPORTANT)
# - azure-logs/LogFiles/*_default_docker.log - Application stdout/stderr
# - azure-logs/LogFiles/kudu/trace/*.txt - Deployment traces
```

### 1.3 View Container Logs via Kudu Console

```bash
# Open Kudu console in browser
echo "https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/DebugConsole"

# Or via Azure Portal:
# Azure Portal > Web App > Development Tools > Advanced Tools (Kudu) > Debug Console
# Navigate to: /home/LogFiles/
```

### 1.4 Common Log Locations in Azure App Service

| Log Type | Location | Description |
|----------|----------|-------------|
| Docker logs | `/home/LogFiles/*_docker.log` | Container start/stop, errors |
| Application logs | `/home/LogFiles/*_default_docker.log` | stdout/stderr from app |
| Deployment logs | `/home/LogFiles/kudu/trace/` | Build and deploy history |
| HTTP logs | `/home/LogFiles/http/RawLogs/` | HTTP request logs |

---

## Section 2: Common Error Investigation

### Pattern 1: 503 Service Unavailable (Container Won't Start)

**Symptom**:
```
curl https://webapp.azurewebsites.net/health → 503 Service Unavailable
```

**Investigation Steps**:

```bash
# Step 1: Check if container is starting
az webapp log tail --name "$AZURE_WEBAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP"

# Look for these error patterns in logs:
# - "Container didn't respond to HTTP pings"
# - "Container crashed"
# - "ModuleNotFoundError"
# - "ImportError"
```

**Common Causes**:

| Cause | Log Pattern | Fix |
|-------|-------------|-----|
| Wrong port | "Container didn't respond to HTTP pings on port: 8080" | Set `WEBSITES_PORT=8000` |
| Missing package | "ModuleNotFoundError: No module named 'X'" | Add to requirements.txt |
| Import error | "ImportError: cannot import name 'jwt'" | Fix: `from jose import jwt` |
| DB connection fail | "Can't connect to MySQL server" | Check DATABASE_URL, firewall |

**Fix Commands**:

```bash
# Set correct port
az webapp config appsettings set \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --settings WEBSITES_PORT=8000

# Restart after config change
az webapp restart \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP"
```

### Pattern 2: 502 Bad Gateway

**Symptom**: Application starts but crashes during request handling

**Investigation**:
```bash
# Check for application-level errors
az webapp log tail --name "$AZURE_WEBAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --filter Error

# Common patterns:
# - "Traceback (most recent call last)"
# - "RuntimeError"
# - "asyncio" related errors
```

### Pattern 3: 500 Internal Server Error

**Symptom**: Application running but returning errors

**Investigation**:
```bash
# Test specific endpoints
curl -v https://${AZURE_WEBAPP_NAME}.azurewebsites.net/health
curl -v https://${AZURE_WEBAPP_NAME}.azurewebsites.net/api/v1/auth/login

# Check application logs for stack traces
az webapp log download --name "$AZURE_WEBAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --log-file logs.zip
unzip -o logs.zip -d logs/
grep -r "Traceback" logs/
grep -r "Error" logs/ | head -50
```

---

## Section 3: Node.js Deployment Issues (DigitalHuman Frontend Experience)

### Pattern 11: Node.js ZIP部署 - npm依赖缺失 ⚠️ NEW

**Symptom**:
```
✅ Container启动成功
❌ 访问超时 or Exit code 127
az webapp log tail显示: "npm: command not found" or "module not found"
```

**根本原因**: 
**ZIP部署不会自动安装npm依赖！** node_modules目录不存在

**Real Case** (DigitalHuman Frontend 2026-03-02):
```
09:28 - 尝试bash startup.sh → Exit 127 (Node容器没有bash)
10:05 - 改为sh startup.sh → Exit 127 (脚本问题)
10:14 - 改为npm start → Exit 127 (node_modules不存在)
11:21 - 手动npm install → ✅ 成功
```

**Detection Script**:
```bash
check_node_modules_exists() {
    echo "[CHECK] Verifying node_modules in Azure App Service..."

    # Method 1: 通过Kudu API检查
    curl -s "https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/api/vfs/site/wwwroot/node_modules/" \
        -u "${PUBLISHING_USERNAME}:${PUBLISHING_PASSWORD}" \
        | grep -q "404" && echo "❌ node_modules不存在" && return 1

    # Method 2: 通过日志检查
    az webapp log tail --name "$AZURE_WEBAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --timeout 10 \
        2>&1 | grep -E "module not found|npm.*command not found" && return 1

    echo "✅ node_modules存在"
    return 0
}
```

**System-Level Fix (3个方案)**:

**方案1: Git部署（推荐）** - Azure Oryx自动安装依赖
```bash
# 优点: 自动npm install，自动检测启动命令
# 缺点: 需要Git仓库

# 步骤1: 初始化Git
cd <WORKSPACE_PATH>
git init
git add .
git commit -m "Initial deployment"

# 步骤2: 配置Git部署
az webapp deployment source config-local-git \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP"

# 步骤3: 推送代码（Azure会自动npm install）
git remote add azure <DEPLOYMENT_URL_FROM_STEP2>
git push azure master

# Azure会自动:
# - 检测Node.js应用
# - 运行npm install
# - 配置启动命令
# - 启动应用
```

**方案2: 手动安装（快速临时方案）** - 通过Kudu控制台
```bash
# 优点: 3-5分钟完成，无需重新部署
# 缺点: 重启后可能丢失（取决于持久化配置）

# 步骤1: 打开Kudu控制台
echo "https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/DebugConsole"

# 步骤2: 在控制台执行
cd /home/site/wwwroot
npm install --production

# 步骤3: 重启应用
az webapp restart --name "$AZURE_WEBAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP"

# 步骤4: 验证
sleep 60
curl -s -o /dev/null -w "%{http_code}" https://${AZURE_WEBAPP_NAME}.azurewebsites.net/
```

**方案3: Docker镜像（最可靠）** - 包含所有依赖
```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖（构建时安装）
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 3000

# 设置环境
ENV NODE_ENV=production
ENV PORT=3000

# 启动应用
CMD ["npm", "start"]
```

```bash
# 构建并部署
docker build -t ${IMAGE_NAME}:latest .
az acr login --name ${ACR_NAME}
docker tag ${IMAGE_NAME}:latest ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest
docker push ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest

az webapp config container set \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --docker-custom-image-name "${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest"
```

**方案对比**:

| 方案 | 时间 | 难度 | 可靠性 | 推荐度 |
|------|------|------|--------|--------|
| Git部署 | 5-10分钟 | 简单 | ⭐⭐⭐⭐⭐ | ✅ **推荐** |
| 手动安装 | 3-5分钟 | 简单 | ⭐⭐ | 临时方案 |
| Docker | 15-20分钟 | 中等 | ⭐⭐⭐⭐⭐ | 生产环境 |

**Claude CLI Auto-Fix Integration**:
```bash
# Detection in deployment verification step
if ! check_node_modules_exists; then
    echo ""
    echo "=========================================="
    echo "  ISSUE DETECTED: node_modules Missing"
    echo "=========================================="
    echo ""
    echo "[AUTO-FIX] Asking user to manually install dependencies..."
    echo ""
    echo "Please follow these steps:"
    echo "1. Open: https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/DebugConsole"
    echo "2. Run: cd /home/site/wwwroot && npm install --production"
    echo "3. Wait 3-5 minutes"
    echo "4. I'll verify the deployment after you confirm completion"
    echo ""
    read -p "Press ENTER after npm install is complete..."

    # Verify
    if curl -s -o /dev/null -w "%{http_code}" https://${AZURE_WEBAPP_NAME}.azurewebsites.net/ | grep -q "200"; then
        echo "✅ Deployment successful after manual npm install"
    else
        echo "❌ Still failing - further investigation needed"
    fi
fi
```

---

### Pattern 12: 启动命令最佳实践 (bash vs sh vs npm start) ⚠️ NEW

**问题**: Exit code 127 (命令未找到)

**根本原因**: Azure Node.js容器只有sh，没有bash

**Real Case** (DigitalHuman Frontend 2026-03-02):
```bash
# ❌ 错误尝试1: bash startup.sh
Container has finished running with exit code: 127
原因: /bin/bash不存在

# ❌ 错误尝试2: sh startup.sh
Container has finished running with exit code: 127
原因: startup.sh内部命令可能有问题

# ✅ 正确方案: npm start
az webapp config set --startup-file "npm start"
原因: 简单可靠，直接使用Node.js内置命令
```

**最佳实践决策树**:

```
Node.js应用启动命令选择:

├─ 情况1: 简单应用 (package.json中有start脚本)
│  └─ 推荐: npm start ✅
│     - 优点: 简单可靠
│     - 缺点: 无
│
├─ 情况2: 需要首次启动时安装依赖
│  ├─ 方案A: Git部署 (Azure Oryx自动处理) ✅ 推荐
│  └─ 方案B: startup.sh (POSIX兼容)
│     - 必须使用: #!/bin/sh (不是#!/bin/bash)
│     - 检测: if [ ! -d "node_modules" ]; then npm install; fi
│     - 启动: exec npm start
│
├─ 情况3: Python应用
│  ├─ 有startup.sh: bash startup.sh ✅ (Python容器有bash)
│  └─ 无startup.sh: 直接配置启动命令
│
└─ 情况4: 复杂启动逻辑
   └─ Docker部署 ✅ (完全控制启动流程)
```

**启动命令对比表**:

| 命令 | Node.js容器 | Python容器 | 推荐度 | 备注 |
|------|------------|-----------|--------|------|
| `npm start` | ✅ | ❌ | ⭐⭐⭐⭐⭐ | Node.js最简单可靠 |
| `bash startup.sh` | ❌ (无bash) | ✅ | ⭐⭐⭐⭐ | Python容器推荐 |
| `sh startup.sh` | ⚠️ | ✅ | ⭐⭐⭐ | 需确保脚本兼容POSIX sh |
| `node server.js` | ✅ | ❌ | ⭐⭐⭐⭐ | 备选方案 |
| `python app.py` | ❌ | ✅ | ⭐⭐⭐⭐ | Python简单应用 |

**startup.sh模板** (POSIX兼容):
```bash
#!/bin/sh
# POSIX兼容的启动脚本 (适用于Node.js和Python容器)

set -e

echo "=== Application Startup ==="
echo "Working directory: $(pwd)"
echo "User: $(whoami)"

# 检测应用类型
if [ -f "package.json" ]; then
    echo "Detected: Node.js application"

    # 检查node_modules
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install --production
    fi

    echo "Starting Node.js application..."
    exec npm start

elif [ -f "requirements.txt" ]; then
    echo "Detected: Python application"

    # 检查虚拟环境
    if [ ! -d "venv" ]; then
        echo "Creating virtual environment..."
        python3 -m venv venv
        . venv/bin/activate
        pip install -r requirements.txt
    else
        . venv/bin/activate
    fi

    echo "Starting Python application..."
    exec python app.py

else
    echo "ERROR: Unknown application type"
    exit 1
fi
```

**验证启动命令是否正确**:
```bash
# Step 1: 检查当前配置
az webapp config show \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --query "{linuxFxVersion:linuxFxVersion, startupFile:startupFile, appCommandLine:appCommandLine}"

# Step 2: 测试访问
curl -s -o /dev/null -w "%{http_code}" https://${AZURE_WEBAPP_NAME}.azurewebsites.net/

# Step 3: 如果失败，查看日志
az webapp log tail --name "$AZURE_WEBAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --timeout 30

# 查找Exit code
# - Exit 127: 命令未找到 (检查bash/sh问题)
# - Exit 1: 应用错误 (检查依赖和配置)
# - Exit 0但无响应: 端口错误 (检查WEBSITES_PORT)
```

---

## Section 4: Enhanced Verification Steps (强制验证流程)

### Step 4.1: 基础健康检查

**必须执行** (不可跳过):
```bash
# 1. 检查容器状态
az webapp show \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --query state

# 预期输出: "Running"
# 如果不是Running → 立即停止并检查日志

# 2. 测试HTTP访问
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://${AZURE_WEBAPP_NAME}.azurewebsites.net/)

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Health check passed"
elif [ "$HTTP_STATUS" = "503" ]; then
    echo "❌ Service Unavailable - Container not responding"
    echo "[ACTION] Check logs:"
    az webapp log tail --name "$AZURE_WEBAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --timeout 30
    exit 1
elif [ "$HTTP_STATUS" = "500" ]; then
    echo "❌ Internal Server Error - Application error"
    echo "[ACTION] Check application logs:"
    az webapp log download --name "$AZURE_WEBAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --log-file error-logs.zip
    exit 1
else
    echo "⚠️  Unexpected status: $HTTP_STATUS"
fi
```

### Step 4.2: 日志诊断流程

**如果Step 4.1失败，必须执行**:
```bash
diagnose_deployment_failure() {
    echo "=========================================="
    echo "  Deployment Failure Diagnosis"
    echo "=========================================="
    echo ""

    # Step 1: 下载日志
    echo "[1/5] Downloading logs..."
    az webapp log download \
        --name "$AZURE_WEBAPP_NAME" \
        --resource-group "$AZURE_RESOURCE_GROUP" \
        --log-file diagnosis-logs.zip

    unzip -o diagnosis-logs.zip -d diagnosis-logs/

    # Step 2: 检查Docker日志（最重要）
    echo ""
    echo "[2/5] Checking Docker logs..."
    DOCKER_LOG=$(find diagnosis-logs/LogFiles -name "*_docker.log" | head -1)

    if [ -f "$DOCKER_LOG" ]; then
        echo "Last 20 lines of Docker log:"
        tail -20 "$DOCKER_LOG"

        # 检查常见错误模式
        if grep -q "exit code: 127" "$DOCKER_LOG"; then
            echo ""
            echo "❌ DIAGNOSIS: Command not found (Exit 127)"
            echo "   PROBABLE CAUSE: bash/sh/npm command not available"
            echo "   ACTION: Check startup command compatibility"
            echo "   SEE: Pattern 11 & 12 in azure-deployment-health-issues-v2.md"
        fi

        if grep -q "exit code: 1" "$DOCKER_LOG"; then
            echo ""
            echo "❌ DIAGNOSIS: Application error (Exit 1)"
            echo "   PROBABLE CAUSE: Missing dependencies or configuration"
            echo "   ACTION: Check node_modules exists, verify env vars"
        fi

        if grep -q "Container did not start within expected time limit" "$DOCKER_LOG"; then
            echo ""
            echo "❌ DIAGNOSIS: Container timeout"
            echo "   PROBABLE CAUSE: Long startup time or wrong port"
            echo "   ACTION: Increase startup time, verify WEBSITES_PORT"
        fi
    fi

    # Step 3: 检查应用日志
    echo ""
    echo "[3/5] Checking application logs..."
    APP_LOG=$(find diagnosis-logs/LogFiles -name "*_default_docker.log" | head -1)

    if [ -f "$APP_LOG" ]; then
        echo "Application errors:"
        grep -i "error\|failed\|exception" "$APP_LOG" | tail -10
    fi

    # Step 4: 检查部署日志
    echo ""
    echo "[4/5] Checking deployment logs..."
    DEPLOYMENT_LOG=$(find diagnosis-logs/deployments -name "log.log" | head -1)

    if [ -f "$DEPLOYMENT_LOG" ]; then
        echo "Deployment status:"
        grep -i "error\|failed" "$DEPLOYMENT_LOG" | tail -5
    fi

    # Step 5: 生成修复建议
    echo ""
    echo "[5/5] Generating fix recommendations..."
    echo ""
    echo "=========================================="
    echo "  Diagnosis Complete"
    echo "=========================================="
    echo ""
    echo "Next Steps:"
    echo "1. Review the error patterns above"
    echo "2. Consult azure-deployment-health-issues-v2.md"
    echo "3. Apply the recommended fix"
    echo "4. Redeploy and verify"
}
```

### Step 4.3: Node.js特殊验证

**如果是Node.js应用，必须执行**:
```bash
verify_nodejs_deployment() {
    echo "=========================================="
    echo "  Node.js Deployment Verification"
    echo "=========================================="
    echo ""

    # 1. 检查node_modules是否存在
    echo "[1/3] Checking node_modules..."
    # 通过Kudu API检查
    NODE_MODULES_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
        "https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/api/vfs/site/wwwroot/node_modules/" \
        -u "${PUBLISHING_USERNAME}:${PUBLISHING_PASSWORD}")

    if [ "$NODE_MODULES_CHECK" = "200" ]; then
        echo "✅ node_modules exists"
    else
        echo "❌ node_modules NOT found!"
        echo ""
        echo "[ACTION REQUIRED]"
        echo "Please manually install dependencies:"
        echo "1. Open: https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/DebugConsole"
        echo "2. Run: cd /home/site/wwwroot && npm install --production"
        echo "3. Restart: az webapp restart --name $AZURE_WEBAPP_NAME --resource-group $AZURE_RESOURCE_GROUP"
        return 1
    fi

    # 2. 检查启动命令
    echo ""
    echo "[2/3] Checking startup command..."
    STARTUP_FILE=$(az webapp config show \
        --name "$AZURE_WEBAPP_NAME" \
        --resource-group "$AZURE_RESOURCE_GROUP" \
        --query startupFile -o tsv)

    echo "Current startup command: $STARTUP_FILE"

    if [ "$STARTUP_FILE" = "bash startup.sh" ]; then
        echo "⚠️  WARNING: bash may not be available in Node.js container"
        echo "   RECOMMEND: Change to 'npm start' or 'sh startup.sh'"
    fi

    # 3. 测试应用响应
    echo ""
    echo "[3/3] Testing application response..."
    RESPONSE=$(curl -s -w "\n%{http_code}" https://${AZURE_WEBAPP_NAME}.azurewebsites.net/)
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | head -n -1)

    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ Application responding correctly"

        # 检查是否返回HTML (对于frontend)
        if echo "$BODY" | grep -q "<!DOCTYPE html>"; then
            echo "✅ HTML content detected (Frontend OK)"
        else
            echo "ℹ️  JSON response (API OK)"
        fi
    else
        echo "❌ Application not responding (HTTP $HTTP_CODE)"
        return 1
    fi
}
```

### Step 4.4: 生成验证报告

**最终必须生成**:
```bash
generate_deployment_report() {
    cat > deployment-report.md <<EOF
# Azure Deployment Report

**Generated**: $(date '+%Y-%m-%d %H:%M:%S')
**Resource Group**: $AZURE_RESOURCE_GROUP
**Web App Name**: $AZURE_WEBAPP_NAME

## Health Check Results

| Check | Status | Details |
|-------|--------|---------|
| Container State | $(az webapp show --name $AZURE_WEBAPP_NAME --resource-group $AZURE_RESOURCE_GROUP --query state -o tsv) | - |
| HTTP Status | $HTTP_STATUS | - |
| Startup Command | $STARTUP_FILE | - |

## Application Details

- **Runtime**: $(az webapp config show --name $AZURE_WEBAPP_NAME --resource-group $AZURE_RESOURCE_GROUP --query linuxFxVersion -o tsv)
- **URL**: https://${AZURE_WEBAPP_NAME}.azurewebsites.net/
- **Kudu Console**: https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/DebugConsole

## Verification Steps Completed

- [x] Container state check
- [x] HTTP accessibility test
- [x] Log analysis
- [x] Runtime verification

## Issues Found

$(if [ "$HTTP_STATUS" != "200" ]; then
    echo "- ❌ HTTP status code: $HTTP_STATUS"
    echo "- See diagnosis section for details"
else
    echo "- ✅ No issues found"
fi)

## Next Steps

1. Monitor application performance
2. Configure custom domain (if needed)
3. Enable SSL certificate
4. Set up Azure Monitor alerts

---
Report saved to: deployment-report.md
EOF

    echo "✅ Deployment report generated: deployment-report.md"
    cat deployment-report.md
}
```

---

## Fix Priority Order (Updated with Node.js)

1. **CRITICAL**: Node.js - node_modules missing → Manual npm install (Pattern 11)
2. **CRITICAL**: Node.js - Startup command error (Exit 127) → Use npm start (Pattern 12)
3. **CRITICAL**: Fix JWT import error → Rebuild
4. **CRITICAL**: Add missing packages → Rebuild
5. **CRITICAL**: Database connection/tables missing → Set App Settings + Init DB
6. **HIGH**: Set WEBSITES_PORT=8000 → Restart
7. **HIGH**: Configure frontend static file serving → Rebuild

---

**Last Updated**: 2026-03-02 (Pattern 11 & 12: Node.js ZIP部署和启动命令问题)
**Version**: 2.12 - Enhanced Node.js deployment troubleshooting
**Maintainer**: Real deployment experience from DigitalHuman Frontend (2026-03-02)

**Change Log**:
- v2.12 (2026-03-02): Added Pattern 11 & 12 based on DigitalHuman Frontend deployment
  - Pattern 11: ZIP部署npm依赖缺失问题，提供3个解决方案
  - Pattern 12: 启动命令最佳实践（bash vs sh vs npm start）
  - Section 4: 强制验证流程，包括日志诊断和Node.js特殊验证
  - Real Case: DigitalHuman Frontend从09:28到11:23的完整诊断过程
- v2.11 (2026-01-23): Enhanced Pattern 10 & 13 with Zero Hardcoding Approach
