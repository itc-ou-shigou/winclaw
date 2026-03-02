---
name: azure-cloud-deploy
description: >
  Azure full-stack deployment assistant. Guides users through infrastructure planning,
  cost estimation, and automated deployment on Microsoft Azure.
  Use when the user wants to: (1) deploy an application to Azure,
  (2) plan cloud architecture with budget and traffic requirements,
  (3) create ARM template / Bicep infrastructure stacks,
  (4) automatically deploy workspace code to App Service/VM/AKS/Functions,
  (5) set up VNet, VM, Azure SQL, Load Balancer, Redis, CDN, WAF, or other Azure services.
  Triggers on: "deploy to azure", "Azure deploy", "Azure方案", "Azureにデプロイ", "azure cloud".
---

# Azure Cloud Deploy

End-to-end deployment: requirements gathering → architecture design → cost estimation → infrastructure provisioning → code deployment → **verification + diagnosis** → report.

## Scripts

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `scripts/detect_project.py` | Detect project type from workspace | `--path <dir>` | JSON: type, framework, commands, port |
| `scripts/analyze_requirements.py` | Select pattern + cost breakdown | budget, traffic, db, security, app-type, region | JSON: recommendation |
| `scripts/estimate_cost.py` | Format cost table | recommendation JSON (stdin) | Markdown table |
| `scripts/generate_arm_template.py` | Generate ARM JSON template | recommendation JSON | ARM template JSON |
| `scripts/validate_template.py` | Validate ARM template | `--input template.json` | Validation report |
| `scripts/generate_deploy_script.py` | Generate deployment script | project JSON + stack outputs | az CLI script / Dockerfile / K8s manifest |

## Reference Files (Read As Needed)

| File | When to Read |
|------|-------------|
| `references/architecture-patterns.md` | Phase 2: Select pattern, show architecture diagram |
| `references/pricing-guide.md` | Phase 2: Baseline cost estimation |
| `references/security-tiers.md` | Phase 1-2: When user asks about security levels |
| `references/resource-reference.md` | Phase 3A: ARM resource types, properties, SKUs, image references |
| `references/solution-patterns.md` | Phase 3A: Resource composition, dependency graphs, cross-pattern integrations |
| `references/deployment-checklist.md` | Phase 3A-3C: Step-by-step checklist, post-deployment report template |
| `references/service-selection-guide.md` | Phase 1-2: Compute/DB/Network selection decision trees, scaling strategies |
| `references/arm-template-catalog.md` | Phase 3A: Index of base templates in `assets/arm-base-templates/` |
| **`references/azure-deployment-health-issues-v2.md`** | **Phase 3C: 错误诊断、日志读取、验证步骤（必读！）** |

### Security Architecture Design (via Engineering Plugin)

When the user selects **Enterprise** security level or requests advanced security architecture (WAF, zero-trust, compliance, etc.), this skill's built-in templates only cover Basic-to-Standard tier security (simple NSG with HTTP/HTTPS). For complex security design, invoke the **engineering plugin's `/architecture` command**:

```
Plugin location: C:\work\winclaw\plugins\engineering\
Command: /architecture
Related skill: system-design (auto-triggered)
```

**When to invoke** (any of these conditions):
- User selects Enterprise security level in Phase 1
- User mentions: WAF, DDoS, zero-trust, compliance (PCI-DSS, HIPAA, SOC2), Private Endpoints, Defender
- User asks "what's the best security architecture for my deployment?"
- Traffic forecast suggests high-value target (financial, healthcare, e-commerce)

**How to invoke**:
```
/architecture Design a security architecture for [APP_NAME] on Azure with the following requirements:
- Architecture pattern: [lite/standard/ha/elastic/serverless/container]
- Security tier: Enterprise
- Compliance: [PCI-DSS / HIPAA / SOC2 / none]
- Traffic: [X visits/day]
- Constraints: [budget, team size, timeline]

Key decisions needed:
1. VNet network segmentation (multi-tier subnets, NSG per subnet, Private Endpoints)
2. Application Gateway WAF v2 (OWASP 3.2 rules, custom rules, bot protection)
3. Azure DDoS Protection (Standard vs Network Protection)
4. Encryption strategy (Key Vault, Managed HSM, TDE, disk encryption, TLS 1.3)
5. Identity design (Managed Identity, Conditional Access, PIM, RBAC)
6. Threat detection (Microsoft Defender for Cloud, Sentinel)
7. Compliance monitoring (Azure Policy, regulatory compliance dashboard)
8. Secrets management (Key Vault, certificate auto-rotation)
9. Network security (Private Link, Service Endpoints, Azure Firewall)
10. Logging & audit (Diagnostic Settings, Activity Log, NSG Flow Logs, Log Analytics)
```

**After `/architecture` produces an ADR**:
1. Use the ADR's recommendations to customize the ARM template in Phase 3A
2. Add Application Gateway WAF, Key Vault, DDoS Protection, Private Endpoints to the generated template
3. Add multi-tier NSG rules (web/app/db subnet separation) — not included in base templates
4. Reference `C:\work\architecture-center\docs\guide\` for Azure best practices
5. Include security architecture decisions in the Phase 3D deployment report

**Phase 1 integration**:
During Step 1.2 (Ask User Questions), if the user selects Enterprise security or mentions compliance requirements:
→ **STOP and invoke `/architecture`** before proceeding to Phase 2.
The ADR output will guide VNet segmentation, WAF configuration, Key Vault setup, and Defender for Cloud integration.

## Base ARM Templates (in `assets/arm-base-templates/`)

| Template | Pattern | Resources | Description |
|----------|---------|-----------|-------------|
| `vm-lite.json` | lite | 5 | Single VM + VNet + NSG + Public IP |
| `appservice-db-standard.json` | standard | 4 | App Service + Azure DB Flexible |
| `appservice-ha.json` | ha | 7 | App Service + App Gateway + HA DB |
| `vmss-elastic.json` | elastic | 9 | VMSS + LB + Redis + CDN + DB |
| `functions-serverless.json` | serverless | 5 | Functions + API Management + Storage |
| `aks-container.json` | container | 4 | AKS + ACR + VNet |

## Workflow Overview

```
Phase 1: Hearing     → Ask user 5-6 questions, detect workspace project
Phase 2: Plan        → Recommend architecture, show cost table, get approval
Phase 3A: Infra      → Generate ARM template, validate, deploy via az CLI or Portal
Phase 3B: Code       → Generate deploy script, execute deployment
Phase 3C: Verify     → **Health check + log diagnosis + error fixing** ⚠️ NEW
Phase 3D: Report     → Generate complete deployment report
```

## Phase 3B: Code Deployment (Enhanced with Node.js Best Practices)

### Step 3B.1: Deployment Method Selection

**Decision Tree**:

```
Deployment Method Selection:

├─ Node.js Frontend
│  ├─ 推荐: Git部署 ✅
│  │  - Azure Oryx自动npm install
│  │  - 自动检测启动命令
│  │  - 适合Next.js/React/Vue应用
│  │
│  ├─ 备选: ZIP部署 + 手动npm install
│  │  - ZIP部署代码
│  │  - 通过Kudu手动安装依赖
│  │  - 快速但需要手动操作
│  │
│  └─ 生产: Docker镜像
│     - 构建时包含所有依赖
│     - 最可靠但耗时
│
├─ Python Backend
│  ├─ 推荐: ZIP部署 + startup.sh ✅
│  │  - startup.sh自动安装依赖
│  │  - Python容器有bash
│  │
│  └─ 备选: Git部署
│     - Azure Oryx自动处理
│
└─ Container
   └─ Docker镜像 ✅
      - ACR构建推送
      - AKS部署
```

### Step 3B.2: Node.js Deployment (⚠️ CRITICAL - 避免依赖缺失)

**Option A: Git Deploy (强烈推荐)** ⭐⭐⭐⭐⭐

```bash
# Step 1: 初始化Git（如果还没有）
cd <WORKSPACE_PATH>
if [ ! -d ".git" ]; then
    git init
    git add .
    git commit -m "Initial deployment"
fi

# Step 2: 配置Git部署
az webapp deployment source config-local-git \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP"

# Step 3: 获取部署URL
DEPLOYMENT_URL=$(az webapp deployment source show \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --query repoUrl -o tsv)

# Step 4: 推送代码（Azure会自动npm install）
git remote add azure "$DEPLOYMENT_URL"
git push azure master

# Azure自动执行:
# 1. 检测Node.js应用（package.json）
# 2. 运行 npm install
# 3. 运行 npm run build（如果需要）
# 4. 配置启动命令（npm start）
# 5. 启动应用
```

**Option B: ZIP Deploy + Manual npm install (临时方案)** ⭐⭐⭐

```bash
# Step 1: ZIP部署代码（不含node_modules）
cd <WORKSPACE_PATH>
zip -r /tmp/app.zip . -x '*.git*' 'node_modules/*'
az webapp deploy \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --src-path /tmp/app.zip \
    --type zip

# Step 2: 手动安装依赖（⚠️ 必须步骤）
echo "Please manually install dependencies:"
echo "1. Open: https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/DebugConsole"
echo "2. Run: cd /home/site/wwwroot && npm install --production"
echo "3. Wait 3-5 minutes for installation"
read -p "Press ENTER after npm install is complete..."

# Step 3: 重启应用
az webapp restart \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP"

# Step 4: 验证（等待60秒）
sleep 60
curl -s -o /dev/null -w "%{http_code}" https://${AZURE_WEBAPP_NAME}.azurewebsites.net/
```

**Option C: Docker Deploy (生产环境)** ⭐⭐⭐⭐⭐

```bash
# Step 1: 创建Dockerfile
cat > Dockerfile <<'EOF'
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
EOF

# Step 2: 构建并推送
az acr login --name ${ACR_NAME}
docker build -t ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest .
docker push ${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest

# Step 3: 配置App Service使用容器
az webapp config container set \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --docker-custom-image-name "${ACR_NAME}.azurecr.io/${IMAGE_NAME}:latest"
```

### Step 3B.3: Startup Command Configuration (⚠️ CRITICAL)

**启动命令选择表**:

| 项目类型 | 推荐命令 | 备选命令 | 避免使用 | 原因 |
|---------|---------|---------|---------|------|
| Node.js (简单) | `npm start` ✅ | `node server.js` | `bash startup.sh` | Node容器无bash |
| Node.js (复杂) | Git部署自动配置 | `sh startup.sh` | `bash startup.sh` | 需POSIX兼容 |
| Python (有startup.sh) | `bash startup.sh` ✅ | `python app.py` | - | Python容器有bash |
| Python (简单) | `python app.py` | - | - | 直接启动 |
| Static | `nginx -g "daemon off;"` | - | - | Nginx服务 |

**设置启动命令**:
```bash
# Node.js (推荐)
az webapp config set \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --startup-file "npm start"

# Python (推荐)
az webapp config set \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --startup-file "bash startup.sh"
```

---

## Phase 3C: Verification & Diagnosis (⚠️ MANDATORY - 不可跳过)

### Step 3C.1: Basic Health Check

**必须执行**:
```bash
# 1. 检查容器状态
CONTAINER_STATE=$(az webapp show \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --query state -o tsv)

if [ "$CONTAINER_STATE" != "Running" ]; then
    echo "❌ CRITICAL: Container state is $CONTAINER_STATE"
    echo "[ACTION] Starting diagnosis..."
    # 跳转到Step 3C.4
else
    echo "✅ Container state: Running"
fi

# 2. 测试HTTP访问
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://${AZURE_WEBAPP_NAME}.azurewebsites.net/)

case "$HTTP_STATUS" in
    "200")
        echo "✅ Health check passed (HTTP 200)"
        ;;
    "503")
        echo "❌ Service Unavailable - Container not responding"
        echo "[ACTION] Run diagnosis: Step 3C.4"
        ;;
    "500")
        echo "❌ Internal Server Error - Application error"
        echo "[ACTION] Check application logs"
        ;;
    "404")
        echo "❌ Not Found - Wrong endpoint"
        echo "[ACTION] Verify URL and routing"
        ;;
    *)
        echo "⚠️  Unexpected HTTP status: $HTTP_STATUS"
        ;;
esac
```

### Step 3C.2: Node.js Specific Verification

**如果是Node.js应用**:
```bash
# 1. 检查node_modules是否存在
echo "[CHECK] Verifying node_modules..."

# 通过Kudu API检查
PUBLISHING_CREDS=$(az webapp deployment list-publishing-credentials \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --output json)

PUBLISHING_USER=$(echo "$PUBLISHING_CREDS" | jq -r '.publishingUserName')
PUBLISHING_PASS=$(echo "$PUBLISHING_CREDS" | jq -r '.publishingPassword')

NODE_MODULES_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/api/vfs/site/wwwroot/node_modules/" \
    -u "${PUBLISHING_USER}:${PUBLISHING_PASS}")

if [ "$NODE_MODULES_CHECK" = "200" ]; then
    echo "✅ node_modules exists"
else
    echo "❌ CRITICAL: node_modules NOT found!"
    echo ""
    echo "=========================================="
    echo "  ACTION REQUIRED: Manual Installation"
    echo "=========================================="
    echo ""
    echo "Please follow these steps:"
    echo "1. Open Kudu Console:"
    echo "   https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/DebugConsole"
    echo ""
    echo "2. Execute in console:"
    echo "   cd /home/site/wwwroot"
    echo "   npm install --production"
    echo ""
    echo "3. Wait 3-5 minutes"
    echo ""
    echo "4. Restart application:"
    echo "   az webapp restart --name $AZURE_WEBAPP_NAME --resource-group $AZURE_RESOURCE_GROUP"
    echo ""
    echo "5. Verify:"
    echo "   curl https://${AZURE_WEBAPP_NAME}.azurewebsites.net/"
    echo ""
    read -p "Press ENTER after completing manual installation..."
fi

# 2. 检查启动命令
STARTUP_FILE=$(az webapp config show \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --query startupFile -o tsv)

echo "Current startup command: $STARTUP_FILE"

if [ "$STARTUP_FILE" = "bash startup.sh" ]; then
    echo "⚠️  WARNING: bash may not be available in Node.js container"
    echo "   RECOMMENDED: Change to 'npm start' or 'sh startup.sh'"
    echo ""
    echo "To fix:"
    echo "az webapp config set --name $AZURE_WEBAPP_NAME --resource-group $AZURE_RESOURCE_GROUP --startup-file 'npm start'"
fi
```

### Step 3C.3: Log Download and Analysis

**如果健康检查失败，必须执行**:
```bash
diagnose_deployment() {
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

    # Step 2: 分析Docker日志
    echo ""
    echo "[2/5] Analyzing Docker logs..."
    DOCKER_LOG=$(find diagnosis-logs/LogFiles -name "*_docker.log" | head -1)

    if [ -f "$DOCKER_LOG" ]; then
        echo "Checking for error patterns..."

        # Pattern 1: Exit code 127
        if grep -q "exit code: 127" "$DOCKER_LOG"; then
            echo ""
            echo "❌ DIAGNOSIS: Command not found (Exit 127)"
            echo "   PROBABLE CAUSE: bash command not available in Node.js container"
            echo "   ACTION: Change startup command to 'npm start'"
            echo "   SEE: Pattern 12 in references/azure-deployment-health-issues-v2.md"
            echo ""
            echo "Fix command:"
            echo "az webapp config set --name $AZURE_WEBAPP_NAME --resource-group $AZURE_RESOURCE_GROUP --startup-file 'npm start'"
            echo "az webapp restart --name $AZURE_WEBAPP_NAME --resource-group $AZURE_RESOURCE_GROUP"
        fi

        # Pattern 2: npm module not found
        if grep -q "module not found\|npm.*command not found" "$DOCKER_LOG"; then
            echo ""
            echo "❌ DIAGNOSIS: npm dependencies missing"
            echo "   PROBABLE CAUSE: ZIP deploy did not install npm packages"
            echo "   ACTION: Manual npm install via Kudu console"
            echo "   SEE: Pattern 11 in references/azure-deployment-health-issues-v2.md"
            echo ""
            echo "Fix steps:"
            echo "1. Open: https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/DebugConsole"
            echo "2. Run: cd /home/site/wwwroot && npm install --production"
        fi

        # Pattern 3: Container timeout
        if grep -q "Container did not start within expected time limit" "$DOCKER_LOG"; then
            echo ""
            echo "❌ DIAGNOSIS: Container startup timeout"
            echo "   PROBABLE CAUSE: Long startup time or wrong port"
            echo "   ACTION: Verify WEBSITES_PORT and increase startup time"
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
        tail -20 "$DEPLOYMENT_LOG"
    fi

    # Step 5: 生成修复建议
    echo ""
    echo "[5/5] Generating recommendations..."
    echo ""
    echo "=========================================="
    echo "  Diagnosis Complete"
    echo "=========================================="
}
```

### Step 3C.4: Common Fix Procedures

**Fix 1: Exit code 127 (Command not found)**
```bash
# Node.js: Change startup command
az webapp config set \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --startup-file "npm start"

az webapp restart \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP"

# Wait and verify
sleep 60
curl -s -o /dev/null -w "%{http_code}" https://${AZURE_WEBAPP_NAME}.azurewebsites.net/
```

**Fix 2: node_modules missing**
```bash
# Manual installation required
echo "Please follow these steps:"
echo "1. Open: https://${AZURE_WEBAPP_NAME}.scm.azurewebsites.net/DebugConsole"
echo "2. Run: cd /home/site/wwwroot && npm install --production"
echo "3. Wait 3-5 minutes"
read -p "Press ENTER after completion..."

# Restart and verify
az webapp restart --name "$AZURE_WEBAPP_NAME" --resource-group "$AZURE_RESOURCE_GROUP"
sleep 60
curl -s https://${AZURE_WEBAPP_NAME}.azurewebsites.net/
```

**Fix 3: Port configuration**
```bash
# Set correct port
az webapp config appsettings set \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP" \
    --settings WEBSITES_PORT=8000

az webapp restart \
    --name "$AZURE_WEBAPP_NAME" \
    --resource-group "$AZURE_RESOURCE_GROUP"
```

---

## Phase 3D: Deployment Report

### Step 3D.1: Generate Complete Report

**必须生成**:
```bash
generate_deployment_report() {
    # 收集信息
    RESOURCE_GROUP="$AZURE_RESOURCE_GROUP"
    WEBAPP_NAME="$AZURE_WEBAPP_NAME"
    REGION=$(az webapp show --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP --query location -o tsv)
    RUNTIME=$(az webapp config show --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP --query linuxFxVersion -o tsv)
    STARTUP_FILE=$(az webapp config show --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP --query startupFile -o tsv)
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://${WEBAPP_NAME}.azurewebsites.net/)

    # 生成报告
    cat > deployment-report.md <<EOF
# Azure Deployment Report

**Generated**: $(date '+%Y-%m-%d %H:%M:%S')
**Resource Group**: $RESOURCE_GROUP
**Web App Name**: $WEBAPP_NAME
**Region**: $REGION

---

## Deployment Summary

| Item | Value |
|------|-------|
| Runtime | $RUNTIME |
| Startup Command | $STARTUP_FILE |
| HTTP Status | $HTTP_STATUS |
| Container State | $(az webapp show --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP --query state -o tsv) |

---

## Access URLs

- **Application**: https://${WEBAPP_NAME}.azurewebsites.net/
- **Kudu Console**: https://${WEBAPP_NAME}.scm.azurewebsites.net/DebugConsole
- **Log Stream**: https://${WEBAPP_NAME}.scm.azurewebsites.net/api/logstream

---

## Verification Steps Completed

- [x] Infrastructure deployment
- [x] Code deployment
- [x] Health check
- [x] Log analysis
$(if [ "$RUNTIME" = "NODE|20-lts" ]; then
    echo "- [x] Node.js specific verification"
fi)

---

## Issues Found

$(if [ "$HTTP_STATUS" != "200" ]; then
    echo "- ❌ HTTP status code: $HTTP_STATUS"
    echo "- See diagnosis section for details"
else
    echo "- ✅ No issues found"
fi)

---

## Troubleshooting Commands

# View logs
az webapp log tail --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP

# Download logs
az webapp log download --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP --log-file logs.zip

# Restart application
az webapp restart --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP

# Check configuration
az webapp config show --name $WEBAPP_NAME --resource-group $RESOURCE_GROUP

---

## Next Steps

1. ✅ Monitor application performance
2. Configure custom domain (if needed)
3. Enable SSL certificate
4. Set up Azure Monitor alerts
5. Configure backup (if using database)

---

**Report saved to**: deployment-report.md
EOF

    echo "✅ Deployment report generated: deployment-report.md"
    cat deployment-report.md
}
```

---

## Important Notes

- **NEVER auto-fill passwords or secrets** - always ask user to input manually
- **NEVER store service principal credentials** in code or templates
- **Always confirm before creating paid resources** - show cost estimate first
- **⚠️ NEW: Always verify deployment** - never skip health check and log analysis
- **⚠️ NEW: Node.js ZIP部署必须手动npm install** - 或者使用Git部署
- **⚠️ NEW: Check startup command compatibility** - Node.js容器无bash
- **Use Pay-As-You-Go by default** unless user explicitly requests Reserved Instances
- **Pricing is in USD** - convert to user's currency if requested
- **For the latest pricing, always use WebSearch** before presenting cost estimates
- **ARM template reference**: `C:\work\architecture-center\docs\guide\` for best practices
- **Always validate generated templates** with `validate_template.py` before deployment
- **⚠️ CRITICAL: Read `references/azure-deployment-health-issues-v2.md`** when deployment fails
- **⚠️ SECURITY: Invoke `/architecture`** (engineering plugin) when Enterprise security level is selected — this skill's base NSG templates only cover HTTP/HTTPS inbound. The `/architecture` ADR output should guide Application Gateway WAF, Key Vault, Defender for Cloud, Private Endpoints, and multi-tier NSG additions
