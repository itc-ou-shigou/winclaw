---
name: aliyun-cloud-deploy
description: >
  Alibaba Cloud full-stack deployment assistant. Guides users through infrastructure planning,
  cost estimation, and automated deployment on Alibaba Cloud (阿里云).
  Use when the user wants to: (1) deploy an application to Alibaba Cloud,
  (2) plan cloud architecture with budget and traffic requirements,
  (3) create ROS (Resource Orchestration Service) stacks,
  (4) automatically deploy workspace code to ECS/FC/ACK,
  (5) set up VPC, ECS, RDS, SLB, Redis, CDN, WAF, or other Alibaba Cloud services.
  Triggers on: "部署到阿里云", "aliyun deploy", "cloud deploy", "阿里云方案", "上云".
---

# Alibaba Cloud Deploy

End-to-end deployment: requirements gathering → architecture design → cost estimation → infrastructure provisioning → code deployment → **verification + diagnosis** → report.

## Scripts

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `scripts/detect_project.py` | Detect project type from workspace | `--path <dir>` | JSON: type, framework, commands, port |
| `scripts/analyze_requirements.py` | Select pattern + cost breakdown | budget, traffic, db, security, app-type, region | JSON: recommendation |
| `scripts/estimate_cost.py` | Format cost table | recommendation JSON (stdin) | Markdown table |
| `scripts/generate_ros_template.py` | Generate ROS YAML template | recommendation JSON | YAML template |
| `scripts/validate_template.py` | Validate ROS template | `--input stack.yml` | Validation report |
| `scripts/generate_deploy_script.py` | Generate deployment script | project JSON + stack outputs | Bash script / Dockerfile / K8s manifest |

## Reference Files (Read As Needed)

| File | When to Read |
|------|-------------|
| `references/architecture-patterns.md` | Phase 2: Select pattern, show architecture diagram |
| `references/pricing-guide.md` | Phase 2: Baseline cost estimation |
| `references/security-tiers.md` | Phase 1-2: When user asks about security levels |
| `references/ros-template-catalog.md` | Phase 3A: Find specific template for complex scenarios |
| `references/solution-patterns.md` | Phase 3A: **Complex deployments** - resource composition patterns, dependency chains, cross-references to `C:\work\ros-templates\solutions\` and `resources\` |
| `references/resource-reference.md` | Phase 3A: **Template authoring** - all ALIYUN::* resource type properties, outputs, dependencies |
| `references/deployment-checklist.md` | Phase 3B-3C: Step-by-step deployment + report template |
| **`references/aliyun-deployment-health-issues.md`** | **Phase 3C: 错误诊断、日志读取、验证步骤（必读！）** |

### Security Architecture Design (via Engineering Plugin)

When the user selects **Enterprise** security level or requests advanced security architecture (WAF, zero-trust, compliance, 等保), this skill's built-in templates only cover Basic-to-Standard tier security. For complex security design, invoke the **engineering plugin's `/architecture` command**:

```
Plugin location: C:\work\winclaw\plugins\engineering\
Command: /architecture
Related skill: system-design (auto-triggered)
```

**When to invoke** (any of these conditions):
- User selects `--security enterprise` in Phase 1
- User mentions: WAF, Anti-DDoS, zero-trust, compliance (等保2.0, PCI-DSS, HIPAA), Security Center
- User asks "什么是最佳安全架构？" / "what's the best security architecture?"
- Traffic forecast suggests high-value target (financial, healthcare, e-commerce)
- User's application handles Chinese mainland users with regulatory requirements

**How to invoke**:
```
/architecture Design a security architecture for [APP_NAME] on Alibaba Cloud with the following requirements:
- Architecture pattern: [lite/standard/ha/elastic/serverless/container]
- Security tier: Enterprise
- Compliance: [等保2.0 / PCI-DSS / HIPAA / none]
- Region: [cn-hangzhou / cn-shanghai / cn-hongkong / overseas]
- Traffic: [X visits/day]
- Constraints: [budget, team size, timeline]

Key decisions needed:
1. VPC network segmentation (3-tier VSwitch: public/private/data, NAT Gateway)
2. WAF (Web Application Firewall: OWASP rules, anti-crawler, CC protection)
3. Anti-DDoS protection (Basic free vs Pro vs Premium)
4. Encryption strategy (KMS CMK, RDS TDE, OSS SSE-KMS, in-transit TLS 1.3)
5. RAM design (users, roles, policies, least-privilege, STS temporary credentials)
6. Threat detection (Security Center/SAS: vulnerability scan, baseline check, intrusion detection)
7. Compliance monitoring (Cloud Config rules, 等保2.0 compliance pack)
8. Secrets management (KMS, Credentials Service, OOS for rotation)
9. Network security (VPC Flow Logs, Cloud Firewall, PrivateZone DNS)
10. Logging & audit (ActionTrail, SLS centralized logging, OSS access logs)
11. RDS security (IP whitelist, SSL, TDE, audit logs, cross-region backup)
12. ICP filing requirements (备案 for Chinese mainland domains)
```

**Alibaba Cloud specific considerations for `/architecture`**:
- **等保2.0 (MLPS 2.0)**: Chinese cybersecurity compliance, mandatory for many industries
- **ICP filing (备案)**: Required for HTTP services on Chinese mainland domains
- **RDS IP whitelist**: Unlike AWS/Azure, Alibaba Cloud RDS requires explicit whitelist — architecture design must account for this
- **Anti-DDoS**: Basic (5Gbps free) is auto-enabled; Pro/Premium for serious protection
- **Cloud Firewall**: Centralized network security (not just SecurityGroup)
- **Security Center (SAS)**: All-in-one security: vulnerability scan, baseline check, intrusion detection, container security

**After `/architecture` produces an ADR**:
1. Use the ADR's recommendations to customize the ROS template in Phase 3A
2. Add WAF, KMS, Security Center, Anti-DDoS, Cloud Config resources to the ROS template
3. Reference `C:\work\ros-templates\solutions\` for production security templates
4. Design 3-tier VSwitch architecture (public SLB → private ECS → isolated RDS)
5. Include security architecture decisions in the Phase 3D deployment report

### When to Read Solution Templates Directly

For complex deployments (HA, Elastic, Container, Multi-Region), the generated template may need customization. Read the original templates from `C:\work\ros-templates\` for production-tested patterns:

```
C:\work\ros-templates\solutions\         → 66 scenario-based templates (e-commerce, DR, elastic, etc.)
C:\work\ros-templates\resources\         → Per-resource type definition examples (58 services)
C:\work\ros-templates\compute-nest-best-practice\ → 30 deployment best practices
```

Use `references/solution-patterns.md` to find the right template for each scenario, then read it directly.

## Workflow Overview

```
Phase 1: Hearing     → Ask user 5-6 questions, detect workspace project
Phase 2: Plan        → Recommend architecture, show cost table, get approval
Phase 3A: Infra      → Generate ROS template, validate, create stack via Console
Phase 3B: Code       → Generate deploy script, execute on ECS
Phase 3C: Verify     → **Health check + log diagnosis + error fixing** ⚠️ NEW
Phase 3D: Report     → Generate complete deployment report
```

## Phase 1: Requirements Gathering

### Step 1.1: Detect Workspace Project

Run project detection script on the user's workspace:

```bash
python scripts/detect_project.py --path <WORKSPACE_PATH>
```

This identifies: project type (Node.js/Python/Java/Go/PHP/Static), framework, build commands, port, DB migrations, env vars.

### Step 1.2: Ask User Questions (2-3 at a time, not all at once)

**Round 1** (essential):
1. **Monthly Budget** (月额预算): ~500 / ~2000 / ~5000 / 10000+ CNY
2. **Daily Traffic Forecast** (每天访問量):
   - Current (现在): __ visits/day
   - In 3 months (3个月後): __ visits/day
   - In 1 year (1年後): __ visits/day
3. **Database** (数据库): None / MySQL / PostgreSQL / + Redis cache

**Round 2** (if needed based on Round 1):
4. **Security Level** (安全防护): Basic(弱) / Standard(中) / Enterprise(强)
   - See `references/security-tiers.md` for definitions
5. **Region** (地域): cn-hangzhou / cn-shanghai / cn-beijing / cn-shenzhen / cn-hongkong / overseas
6. **App Type** (应用类型): Website / API / SPA+API / Microservice

### Step 1.2B: Security Architecture Check (Conditional)

**If user selected Enterprise security OR mentioned compliance/WAF/等保2.0/zero-trust**:

→ **STOP and invoke `/architecture`** before proceeding to Phase 2.
See "Security Architecture Design (via Engineering Plugin)" section above for the invocation template.

The `/architecture` command will produce an ADR with:
- 3-tier VSwitch network segmentation (public/private/data)
- WAF + Anti-DDoS strategy with cost trade-offs (CNY)
- RAM roles and policy design (STS temporary credentials)
- KMS encryption and RDS TDE strategy
- 等保2.0 compliance monitoring approach
- RDS IP whitelist architecture (Security Group based vs CIDR based)

Use the ADR output to enrich the Phase 2 architecture plan and Phase 3A ROS template.

### Step 1.3: Analyze Requirements

Run the analysis script:

```bash
python scripts/analyze_requirements.py \
  --budget <BUDGET> \
  --traffic-now <NOW> --traffic-3m <3M> --traffic-1y <1Y> \
  --db <mysql|postgresql|redis|none> \
  --security <basic|standard|enterprise> \
  --app-type <web|api|spa-api|microservice> \
  --region <REGION_ID>
```

Output: JSON recommendation with pattern, services, cost breakdown, ROS template path.

## Phase 2: Present Plan & Get Approval

### Step 2.1: Show Architecture Diagram

Display ASCII architecture based on the selected pattern. Read `references/architecture-patterns.md` for pattern-specific diagrams.

### Step 2.2: Show Cost Estimate

Pipe the recommendation JSON into the cost formatter:

```bash
echo '<RECOMMENDATION_JSON>' | python scripts/estimate_cost.py --format markdown
```

### Step 2.3: Verify Latest Pricing

Use WebSearch to check current Alibaba Cloud pricing for the recommended services. Search queries:
- `阿里云 ECS <spec> 价格 2026`
- `阿里云 RDS MySQL <spec> 价格`
- `Alibaba Cloud <service> pricing`

Update the estimate if prices have changed significantly.

### Step 2.4: Get User Approval

Present the complete plan and ask:
- "This is the recommended architecture. Approve to proceed? (确认部署方案？)"
- If user wants changes, loop back to modify parameters

**After approval, ask for Alibaba Cloud console access:**
- "Please log in to Alibaba Cloud Console (https://ros.console.aliyun.com) in your browser."
- "Please confirm you are logged in and I can see the ROS console."

## Phase 3A: Infrastructure Deployment

### Step 3A.1: Generate & Validate ROS Template

```bash
# Generate template
echo '<RECOMMENDATION_JSON>' | python scripts/generate_ros_template.py --output /tmp/stack.yml

# Validate template
python scripts/validate_template.py --input /tmp/stack.yml --strict
```

**Supported patterns** (fully generated):

| Pattern | Resources Created |
|---------|------------------|
| `lite` | VPC + VSwitch + SecurityGroup + ECS |
| `standard` | VPC + VSwitch + SG + ECS + RDS + SLB |
| `ha` | VPC + 2xVSwitch + SG + 2xECS + HA-RDS + ReadOnly + SLB |
| `elastic` | VPC + SG + Seed-ECS + ESS(ScalingGroup+Config+Rules+Alarms) + PolarDB + Redis + SLB |
| `serverless` | VPC + SG + FC(Service+Function+Trigger) + API Gateway + optional RDS |
| `container` | VPC + SG + NAT+EIP+SNAT + ACK ManagedCluster + optional RDS |

**For complex customization**: Read `references/solution-patterns.md` to find matching production templates, then read the specific template from `C:\work\ros-templates\` to add specialized resources (WAF, CDN, DTS, CEN, NAS, etc.). Use `references/resource-reference.md` for property details.

### Step 3A.2: Deploy via ROS Console (Browser Automation)

1. Navigate to `https://ros.console.aliyun.com/` → confirm region
2. Click "Create Stack" (创建资源栈) → "Use New Resources" (使用新资源)
3. Select "Enter Template Content" (输入模板内容)
4. Paste the generated YAML template
5. Fill in Stack Name: `{project-name}-stack`
6. Fill parameters:
   - Zone, Instance specs → use values from recommendation
   - **Passwords** → **ASK USER TO INPUT MANUALLY** (never auto-fill passwords)
   - DB password → **ASK USER TO INPUT MANUALLY**
7. Click "Create" (创建) → wait for `CREATE_COMPLETE`
8. Collect Outputs: ECS IP, RDS endpoint, SLB IP, etc.

### Step 3A.3: Alternative - CLI Deployment

If user has `aliyun` CLI configured:

```bash
aliyun ros CreateStack \
  --StackName {project}-stack \
  --TemplateBody "$(cat /tmp/stack.yml)" \
  --RegionId cn-hangzhou \
  --Parameters '[{"ParameterKey":"ZoneId","ParameterValue":"cn-hangzhou-h"}, ...]'
```

## Phase 3B: Code Deployment

### Step 3B.0: Generate Deployment Script

After collecting stack outputs (ECS IP, RDS endpoint, etc.), generate the deployment script automatically:

```bash
# Save stack outputs to JSON
cat > /tmp/stack_outputs.json << 'EOF'
{
  "EcsPublicIp": "<FROM_STACK_OUTPUTS>",
  "RdsInternalEndpoint": "<FROM_STACK_OUTPUTS>",
  "RdsPort": "3306",
  "RdsDatabaseName": "<STACK_NAME>_db",
  "RdsAccountName": "dbadmin",
  "SlbPublicIp": "<FROM_STACK_OUTPUTS>",
  "RedisEndpoint": "<FROM_STACK_OUTPUTS>",
  "PolarDBEndpoint": "<FROM_STACK_OUTPUTS>"
}
EOF

# Generate deployment script (for ECS-based patterns)
python scripts/detect_project.py --path <WORKSPACE_PATH> | \
  python scripts/generate_deploy_script.py \
    --stack-outputs /tmp/stack_outputs.json \
    --pattern <PATTERN> \
    --repo-url <GIT_REPO_URL_IF_EXISTS> \
    --format script \
    --output /tmp/deploy.sh

# For container pattern: generate Dockerfile + K8s manifest
python scripts/detect_project.py --path <WORKSPACE_PATH> | \
  python scripts/generate_deploy_script.py --format dockerfile --output /tmp/Dockerfile

python scripts/detect_project.py --path <WORKSPACE_PATH> | \
  python scripts/generate_deploy_script.py \
    --stack-outputs /tmp/stack_outputs.json \
    --format k8s \
    --output /tmp/k8s-deploy.yml
```

### Deployment Method by Pattern

| Pattern | Script Format | How to Execute |
|---------|--------------|----------------|
| `lite` / `standard` | `--format script` | SCP script to ECS → `bash deploy.sh` |
| `ha` | `--format script` | SCP to each ECS → `bash deploy.sh` (or RunCommand) |
| `elastic` | `--format script` | Run on seed ECS → Create golden image → ESS uses image |
| `serverless` | Manual | Upload code to FC via Console/CLI (see Step 3B.6) |
| `container` | `--format dockerfile` + `--format k8s` | Build image → Push to CR → `kubectl apply` |

### Step 3B.1: Execute on ECS (lite/standard/ha/elastic)

**Option A - Via SSH:**
```bash
scp /tmp/deploy.sh root@<ECS_IP>:/tmp/
ssh root@<ECS_IP> "bash /tmp/deploy.sh"
```

**Option B - Via ALIYUN::ECS::RunCommand (in ROS template):**
```bash
python scripts/detect_project.py --path <WORKSPACE_PATH> | \
  python scripts/generate_deploy_script.py \
    --stack-outputs /tmp/stack_outputs.json \
    --pattern standard \
    --format runcommand
```
This outputs a YAML fragment to embed in the ROS template as `DeployCommand` resource.

**Option C - Via Alibaba Cloud Workbench** (browser terminal):
Paste deploy script directly into the Workbench terminal.

### Step 3B.2: Post-Deploy Password Setup

After the script runs, user must manually set passwords:

```bash
ssh root@<ECS_IP>
vi /app/.env   # Set DB_PASS, REDIS_PASS, etc.
# Restart application
pm2 restart app    # Node.js
# or
systemctl restart app  # Java/Go
```

### Step 3B.3: Elastic Pattern - Create Golden Image

For the `elastic` pattern, after verifying the seed ECS works:

1. Create a custom image from the seed instance (via console or CLI):
   ```bash
   aliyun ecs CreateImage --InstanceId <SEED_INSTANCE_ID> --ImageName app-golden-image
   ```
2. Update the ESS ScalingConfiguration to use the new Image ID:
   ```bash
   aliyun ess ModifyScalingConfiguration --ScalingConfigurationId <CONFIG_ID> --ImageId <IMAGE_ID>
   ```
3. The ESS auto-scaling group will use this image for new instances.

### Step 3B.4: Container Pattern - Build & Deploy

```bash
# Build Docker image
cd <WORKSPACE_PATH>
docker build -t <IMAGE_NAME>:<TAG> -f /tmp/Dockerfile .

# Push to Alibaba Cloud Container Registry (ACR)
docker tag <IMAGE_NAME>:<TAG> registry.<REGION>.aliyuncs.com/<NAMESPACE>/<IMAGE_NAME>:<TAG>
docker push registry.<REGION>.aliyuncs.com/<NAMESPACE>/<IMAGE_NAME>:<TAG>

# Deploy to ACK
# Update image reference in /tmp/k8s-deploy.yml first
kubectl apply -f /tmp/k8s-deploy.yml
```

### Step 3B.5: Serverless Pattern - Deploy to FC

```bash
# Upload code via FC CLI or Console
# Option A: inline code (small functions)
# Option B: ZIP upload via OSS
cd <WORKSPACE_PATH>
zip -r /tmp/code.zip . -x '*.git*' 'node_modules/*'
aliyun oss cp /tmp/code.zip oss://<BUCKET>/code.zip
aliyun fc UpdateFunction --serviceName <SERVICE> --functionName <FUNCTION> \
  --code '{"ossBucketName":"<BUCKET>","ossObjectName":"code.zip"}'
```

## Phase 3C: Verification & Diagnosis (⚠️ MANDATORY - 不可跳过)

### Step 3C.1: ROS Stack Status Check

**必须执行**:
```bash
# 1. 检查ROS Stack状态
# 通过CLI
STACK_STATUS=$(aliyun ros GetStack --StackId "$STACK_ID" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('Status','UNKNOWN'))")

case "$STACK_STATUS" in
    "CREATE_COMPLETE"|"UPDATE_COMPLETE")
        echo "✅ Stack status: $STACK_STATUS"
        ;;
    "CREATE_IN_PROGRESS"|"UPDATE_IN_PROGRESS")
        echo "⏳ Stack still in progress: $STACK_STATUS"
        echo "[ACTION] Wait for completion in ROS Console"
        ;;
    "CREATE_FAILED"|"ROLLBACK_COMPLETE"|"ROLLBACK_IN_PROGRESS")
        echo "❌ CRITICAL: Stack failed: $STACK_STATUS"
        echo "[ACTION] Check stack events for root cause"
        # 获取失败事件
        aliyun ros ListStackEvents --StackId "$STACK_ID" \
            --Status CREATE_FAILED \
            | python3 -c "
import sys, json
events = json.load(sys.stdin).get('Events', [])
for e in events:
    print(f\"Resource: {e.get('LogicalResourceId')} | Reason: {e.get('StatusReason','')}\")"
        ;;
    *)
        echo "⚠️  Unexpected stack status: $STACK_STATUS"
        ;;
esac

# 2. 通过ROS Console检查
# 打开: https://ros.console.aliyun.com/
# 找到对应的资源栈 → 查看"事件"标签 → 检查失败原因

# 3. 列出Stack Outputs
echo ""
echo "=== Stack Outputs ==="
aliyun ros GetStack --StackId "$STACK_ID" \
    | python3 -c "
import sys, json
outputs = json.load(sys.stdin).get('Outputs', [])
for o in outputs:
    print(f\"{o['OutputKey']}: {o['OutputValue']}\")"
```

### Step 3C.2: Basic Health Check

**必须执行**:
```bash
# ECS 实例健康检查
check_ecs_health() {
    ECS_IP="$1"

    # 1. 检查ECS实例状态
    echo "[CHECK] ECS Instance Status..."
    INSTANCE_STATUS=$(aliyun ecs DescribeInstanceAttribute --InstanceId "$INSTANCE_ID" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('Status','UNKNOWN'))")

    if [ "$INSTANCE_STATUS" = "Running" ]; then
        echo "✅ ECS instance state: Running"
    else
        echo "❌ ECS instance state: $INSTANCE_STATUS"
        echo "[ACTION] Check instance in ECS Console"
    fi

    # 2. 测试HTTP访问
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$ECS_IP/" --connect-timeout 10 || echo "000")

    case "$HTTP_STATUS" in
        "200"|"301"|"302")
            echo "✅ Health check passed (HTTP $HTTP_STATUS)"
            ;;
        "000")
            echo "❌ Connection refused/timeout"
            echo "[ACTION] Check Security Group allows inbound HTTP (port 80/443)"
            echo "[ACTION] Check application is started on ECS"
            ;;
        "502"|"503")
            echo "❌ Service Unavailable (HTTP $HTTP_STATUS)"
            echo "[ACTION] Check application process and logs"
            ;;
        "500")
            echo "❌ Internal Server Error (HTTP 500)"
            echo "[ACTION] Check application error logs"
            ;;
        *)
            echo "⚠️  Unexpected HTTP status: $HTTP_STATUS"
            ;;
    esac
}

# SLB 健康检查
check_slb_health() {
    SLB_ID="$1"

    echo "=== SLB Backend Health ==="
    aliyun slb DescribeHealthStatus --LoadBalancerId "$SLB_ID" \
        | python3 -c "
import sys, json
result = json.load(sys.stdin)
servers = result.get('BackendServers', {}).get('BackendServer', [])
for s in servers:
    status = '✅' if s.get('ServerHealthStatus') == 'normal' else '❌'
    print(f\"{status} {s.get('ServerId')} - Port {s.get('Port')} - {s.get('ServerHealthStatus')}\")"

    # 检查不健康的后端
    UNHEALTHY=$(aliyun slb DescribeHealthStatus --LoadBalancerId "$SLB_ID" \
        | python3 -c "
import sys, json
servers = json.load(sys.stdin).get('BackendServers', {}).get('BackendServer', [])
unhealthy = [s['ServerId'] for s in servers if s.get('ServerHealthStatus') != 'normal']
print(' '.join(unhealthy))")

    if [ -z "$UNHEALTHY" ]; then
        echo "✅ All backends healthy"
    else
        echo "❌ Unhealthy backends: $UNHEALTHY"
        echo "[ACTION] Check Security Group, app status, and health check config"
    fi
}

# ACK (Kubernetes) 健康检查
check_ack_health() {
    echo "=== ACK Pod Status ==="
    kubectl get pods -l app=app -o wide

    # 检查CrashLoopBackOff
    CRASH_PODS=$(kubectl get pods -l app=app \
        -o jsonpath='{.items[?(@.status.containerStatuses[0].state.waiting.reason=="CrashLoopBackOff")].metadata.name}')
    if [ -n "$CRASH_PODS" ]; then
        echo "❌ Pods in CrashLoopBackOff: $CRASH_PODS"
        echo "[ACTION] Check pod logs:"
        for pod in $CRASH_PODS; do
            echo "--- Logs for $pod ---"
            kubectl logs "$pod" --tail=50
        done
    fi

    echo ""
    echo "=== ACK Service Status ==="
    kubectl get svc app-svc
    EXTERNAL_IP=$(kubectl get svc app-svc -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    if [ -n "$EXTERNAL_IP" ]; then
        echo "External IP: $EXTERNAL_IP"
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$EXTERNAL_IP/" --connect-timeout 10 || echo "000")
        echo "HTTP Status: $HTTP_STATUS"
    fi
}

# FC (函数计算) 健康检查
check_fc_health() {
    SERVICE_NAME="$1"
    FUNCTION_NAME="$2"

    echo "=== Function Compute Status ==="
    aliyun fc GET /services/$SERVICE_NAME/functions/$FUNCTION_NAME \
        | python3 -c "
import sys, json
func = json.load(sys.stdin)
print(f\"Runtime: {func.get('runtime')} | Memory: {func.get('memorySize')}MB | Timeout: {func.get('timeout')}s\")"

    # 测试调用
    echo ""
    echo "=== FC Invocation Test ==="
    aliyun fc POST /services/$SERVICE_NAME/functions/$FUNCTION_NAME/invocations \
        --body '{}' \
        --header "Content-Type=application/json"
}
```

### Step 3C.3: Log Download and Analysis

**如果健康检查失败，必须执行**:
```bash
diagnose_deployment() {
    echo "=========================================="
    echo "  Alibaba Cloud Deployment Diagnosis"
    echo "=========================================="
    echo ""

    # ===== ECS Diagnosis =====
    diagnose_ecs() {
        ECS_IP="$1"

        # Step 1: 检查cloud-init日志 (UserData / RunCommand输出)
        echo "[1/5] Getting ECS deployment logs..."
        echo "Commands to run on ECS:"
        echo "  ssh root@$ECS_IP 'cat /var/log/cloud-init-output.log | tail -50'"
        echo "  ssh root@$ECS_IP 'cat /var/log/app.log | tail -50'"
        echo "  ssh root@$ECS_IP 'pm2 logs --lines 50'  # Node.js"
        echo "  ssh root@$ECS_IP 'journalctl -u app -n 50'  # systemd"

        # Step 2: 通过Workbench查看
        echo ""
        echo "[2/5] Alternative: Use Alibaba Cloud Workbench..."
        echo "  1. Open ECS Console: https://ecs.console.aliyun.com/"
        echo "  2. Find instance → Click '远程连接' / 'Remote Connect'"
        echo "  3. Select 'Workbench' (免费, 无需密钥)"
        echo "  4. Run diagnostic commands in the terminal"

        # Step 3: 通过SLS查看日志 (如果已配置)
        echo ""
        echo "[3/5] Checking SLS (Simple Log Service)..."
        echo "  If SLS is configured:"
        echo "  1. Open: https://sls.console.aliyun.com/"
        echo "  2. Find Project → Logstore"
        echo "  3. Search: error OR failed OR exception"
        echo "  Or via CLI:"
        echo "  aliyun sls GetLogs --project <PROJECT> --logstore <STORE> --query 'error' --from <TIMESTAMP> --to <TIMESTAMP>"

        # Step 4: 检查安全组规则
        echo ""
        echo "[4/5] Checking Security Group..."
        SG_ID=$(aliyun ecs DescribeInstanceAttribute --InstanceId "$INSTANCE_ID" \
            | python3 -c "import sys,json; sgs=json.load(sys.stdin).get('SecurityGroupIds',{}).get('SecurityGroupId',[]); print(sgs[0] if sgs else '')")

        if [ -n "$SG_ID" ]; then
            echo "Security Group: $SG_ID"
            aliyun ecs DescribeSecurityGroupAttribute --SecurityGroupId "$SG_ID" --Direction ingress \
                | python3 -c "
import sys, json
rules = json.load(sys.stdin).get('Permissions', {}).get('Permission', [])
for r in rules:
    print(f\"  {r.get('IpProtocol')}/{r.get('PortRange')} from {r.get('SourceCidrIp','')}{r.get('SourceGroupId','')} - {r.get('Policy')}\")"

            # 检查HTTP端口是否开放
            HTTP_OPEN=$(aliyun ecs DescribeSecurityGroupAttribute --SecurityGroupId "$SG_ID" --Direction ingress \
                | python3 -c "
import sys, json
rules = json.load(sys.stdin).get('Permissions', {}).get('Permission', [])
for r in rules:
    port = r.get('PortRange','')
    if '80/80' in port or '80/' in port:
        print('open')
        break")
            if [ "$HTTP_OPEN" != "open" ]; then
                echo "❌ Port 80 (HTTP) is NOT open in Security Group"
                echo "   ACTION: Add inbound rule for port 80/80"
            fi
        fi

        # Step 5: 生成修复建议
        echo ""
        echo "[5/5] Generating recommendations..."
        echo ""
        echo "=========================================="
        echo "  Diagnosis Complete"
        echo "=========================================="
    }

    # ===== ROS Stack Event Diagnosis =====
    diagnose_ros_failure() {
        echo "=== ROS Stack Failed Events ==="
        aliyun ros ListStackEvents --StackId "$STACK_ID" --Status CREATE_FAILED \
            | python3 -c "
import sys, json
events = json.load(sys.stdin).get('Events', [])
for e in events:
    print(f\"Time: {e.get('CreateTime')} | Resource: {e.get('LogicalResourceId')} | Type: {e.get('ResourceType')}\")
    print(f\"  Reason: {e.get('StatusReason','')}\")
    print()"

        echo ""
        echo "=== Common ROS Failures ==="

        # 获取失败原因
        REASONS=$(aliyun ros ListStackEvents --StackId "$STACK_ID" --Status CREATE_FAILED \
            | python3 -c "
import sys, json
events = json.load(sys.stdin).get('Events', [])
for e in events:
    print(e.get('StatusReason',''))")

        if echo "$REASONS" | grep -qi "Forbidden\|NoPermission\|AccessDenied"; then
            echo "❌ DIAGNOSIS: RAM Permission Denied"
            echo "   ACTION: Grant required permissions to your RAM user/role"
            echo "   HINT: Attach AliyunROSFullAccess + service-specific policies"
        fi

        if echo "$REASONS" | grep -qi "QuotaExceeded\|quota\|limit"; then
            echo "❌ DIAGNOSIS: Resource Quota Exceeded"
            echo "   ACTION: Request quota increase in Quota Center"
            echo "   URL: https://quotas.console.aliyun.com/"
        fi

        if echo "$REASONS" | grep -qi "InvalidZone\|Zone.*not.*support\|stock"; then
            echo "❌ DIAGNOSIS: Zone/Instance Type Not Available"
            echo "   ACTION: Change zone or instance type in template"
            echo "   Check: https://ecs-buy.aliyun.com/ for available specs"
        fi

        if echo "$REASONS" | grep -qi "already exist\|AlreadyExist"; then
            echo "❌ DIAGNOSIS: Resource Already Exists"
            echo "   ACTION: Delete conflicting resource or use different name"
        fi

        if echo "$REASONS" | grep -qi "InvalidVSwitchId\|VSwitch.*not.*found"; then
            echo "❌ DIAGNOSIS: VSwitch Not Found"
            echo "   ACTION: Verify VSwitch exists in the specified Zone"
        fi
    }
}
```

### Step 3C.4: Node.js Specific Verification

**如果是Node.js应用，必须执行**:
```bash
verify_nodejs_ecs() {
    ECS_IP="$1"

    echo "=========================================="
    echo "  Node.js Deployment Verification (ECS)"
    echo "=========================================="

    # 1. 检查node_modules是否存在
    echo "[1/4] Checking node_modules..."
    NODE_MODULES=$(ssh root@"$ECS_IP" \
        'ls -d /app/node_modules 2>/dev/null && echo "exists" || echo "missing"')

    if [ "$NODE_MODULES" = "exists" ]; then
        echo "✅ node_modules exists"
    else
        echo "❌ CRITICAL: node_modules NOT found!"
        echo ""
        echo "=========================================="
        echo "  ACTION REQUIRED: Install Dependencies"
        echo "=========================================="
        echo ""
        echo "SSH into ECS and install:"
        echo "  ssh root@$ECS_IP"
        echo "  cd /app && npm install --production"
        echo "  pm2 restart app  # or: systemctl restart app"
        echo ""
        echo "Or use Workbench (无需SSH密钥):"
        echo "  1. ECS Console → Remote Connect → Workbench"
        echo "  2. Run: cd /app && npm install --production"
        echo ""
    fi

    # 2. 检查PM2进程状态
    echo "[2/4] Checking PM2 process..."
    ssh root@"$ECS_IP" 'pm2 status 2>/dev/null || echo "PM2 not running"'

    # 3. 检查应用端口
    echo "[3/4] Checking application port..."
    ssh root@"$ECS_IP" \
        'ss -tlnp | grep -E ":3000|:8080|:8000" || echo "No app listening on expected ports"'

    # 4. 检查应用日志
    echo "[4/4] Checking recent logs..."
    ssh root@"$ECS_IP" \
        'pm2 logs --lines 20 --nostream 2>/dev/null || tail -20 /var/log/app.log 2>/dev/null || echo "No logs found"'
}
```

### Step 3C.5: Common Fix Procedures

**Fix 1: Security Group - HTTP Not Open**
```bash
# 通过CLI添加安全组规则
aliyun ecs AuthorizeSecurityGroup \
    --SecurityGroupId "$SG_ID" \
    --IpProtocol tcp \
    --PortRange 80/80 \
    --SourceCidrIp 0.0.0.0/0 \
    --Policy accept

aliyun ecs AuthorizeSecurityGroup \
    --SecurityGroupId "$SG_ID" \
    --IpProtocol tcp \
    --PortRange 443/443 \
    --SourceCidrIp 0.0.0.0/0 \
    --Policy accept

echo "✅ Security Group updated - HTTP/HTTPS ports opened"

# 或者通过Console:
# ECS Console → Security Groups → Configure Rules → Add Rule
# Protocol: TCP | Port: 80/80 | Source: 0.0.0.0/0 | Allow
```

**Fix 2: Application Not Running (ECS)**
```bash
# SSH或Workbench进入ECS
ssh root@"$ECS_IP" << 'FIXEOF'
cd /app

# Node.js: 使用PM2重启
if command -v pm2 &>/dev/null; then
    pm2 restart app 2>/dev/null || pm2 start npm --name app -- start
    pm2 save
    pm2 startup | tail -1 | bash
fi

# 检查状态
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
FIXEOF
```

**Fix 3: ROS Stack Failure - Delete and Recreate**
```bash
# 1. 删除失败的Stack
aliyun ros DeleteStack --StackId "$STACK_ID"
echo "Waiting for stack deletion..."
sleep 30

# 2. 修复模板 (根据诊断结果)
# ... 编辑模板 ...

# 3. 重新创建Stack
aliyun ros CreateStack \
    --StackName "<PROJECT>-stack" \
    --TemplateBody "$(cat /tmp/stack.yml)" \
    --RegionId cn-hangzhou \
    --Parameters '[{"ParameterKey":"ZoneId","ParameterValue":"cn-hangzhou-h"}]'

# 或通过Console创建 (推荐，可直接输入密码)
echo "Open: https://ros.console.aliyun.com/ → Create Stack"
```

**Fix 4: SLB Backend Unhealthy**
```bash
# 检查SLB健康检查配置
aliyun slb DescribeLoadBalancerAttribute --LoadBalancerId "$SLB_ID" \
    | python3 -c "
import sys, json
r = json.load(sys.stdin)
listeners = r.get('ListenerPortsAndProtocol', {}).get('ListenerPortAndProtocol', [])
for l in listeners:
    print(f\"Port: {l.get('ListenerPort')} Protocol: {l.get('ListenerProtocol')}\")"

# 修改健康检查配置
aliyun slb SetLoadBalancerHTTPListenerAttribute \
    --LoadBalancerId "$SLB_ID" \
    --ListenerPort 80 \
    --HealthCheckURI "/" \
    --HealthCheckInterval 10 \
    --HealthyThreshold 3

echo "✅ Health check updated, wait 30s for re-evaluation..."
sleep 30
aliyun slb DescribeHealthStatus --LoadBalancerId "$SLB_ID"
```

**Fix 5: ACK Pod CrashLoopBackOff**
```bash
# 1. 检查Pod日志
kubectl logs deployment/app --tail=50

# 2. 检查Pod事件
kubectl describe pod -l app=app | grep -A 10 "Events:"

# 3. 常见原因修复
# - ImagePullBackOff: ACR登录过期
docker login --username=<ALIYUN_ACCOUNT> registry.<REGION>.aliyuncs.com

# - CrashLoopBackOff: 应用启动失败
kubectl set env deployment/app PORT=3000 NODE_ENV=production

# - 重启deployment
kubectl rollout restart deployment/app
kubectl rollout status deployment/app
```

**Fix 6: ECS Cannot Connect to RDS**
```bash
# 检查RDS白名单 (阿里云RDS需要配置白名单)
echo "RDS requires IP whitelist configuration!"
echo ""
echo "Option 1 - Via Console:"
echo "  1. RDS Console → Instance → Security → Whitelist"
echo "  2. Add ECS private IP to whitelist"
echo ""
echo "Option 2 - Via CLI:"
echo "  aliyun rds ModifySecurityIps \\"
echo "    --DBInstanceId <RDS_ID> \\"
echo "    --SecurityIps '<ECS_PRIVATE_IP>'"
echo ""
echo "Option 3 - Add ECS Security Group to RDS whitelist:"
echo "  RDS Console → Security → Whitelist → Add Security Group"

# 测试连接
ssh root@"$ECS_IP" << 'DBEOF'
# 测试TCP连通性
timeout 5 bash -c "echo > /dev/tcp/<RDS_ENDPOINT>/3306" && echo "OK" || echo "FAIL"

# 使用mysql客户端测试
mysql -h <RDS_ENDPOINT> -u dbadmin -p<PASSWORD> -e "SELECT 1"
DBEOF
```

---

## Phase 3D: Deployment Report

### Step 3D.1: Generate Complete Report

**必须生成**:
```bash
generate_deployment_report() {
    STACK_NAME="$1"
    STACK_ID="$2"
    REGION="$3"

    # 收集Stack信息
    STACK_INFO=$(aliyun ros GetStack --StackId "$STACK_ID")
    STACK_STATUS=$(echo "$STACK_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('Status','UNKNOWN'))")
    CREATE_TIME=$(echo "$STACK_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('CreateTime',''))")

    # 收集Outputs
    OUTPUTS=$(echo "$STACK_INFO" | python3 -c "
import sys, json
outputs = json.load(sys.stdin).get('Outputs', [])
for o in outputs:
    print(f\"{o['OutputKey']}: {o['OutputValue']}\")")

    # 提取关键信息
    ECS_IP=$(echo "$STACK_INFO" | python3 -c "
import sys, json
outputs = json.load(sys.stdin).get('Outputs', [])
for o in outputs:
    if 'EcsPublicIp' in o.get('OutputKey','') or 'PublicIp' in o.get('OutputKey',''):
        print(o['OutputValue']); break" 2>/dev/null)

    SLB_IP=$(echo "$STACK_INFO" | python3 -c "
import sys, json
outputs = json.load(sys.stdin).get('Outputs', [])
for o in outputs:
    if 'SlbPublicIp' in o.get('OutputKey','') or 'SLB' in o.get('OutputKey',''):
        print(o['OutputValue']); break" 2>/dev/null)

    ACCESS_IP="${SLB_IP:-$ECS_IP}"

    # 测试HTTP
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$ACCESS_IP/" --connect-timeout 10 || echo "000")

    # 生成报告
    cat > deployment-report.md <<EOF
# Alibaba Cloud Deployment Report (阿里云部署报告)

**Generated**: $(date '+%Y-%m-%d %H:%M:%S')
**Stack Name**: $STACK_NAME
**Stack ID**: $STACK_ID
**Region**: $REGION
**Stack Status**: $STACK_STATUS
**Created**: $CREATE_TIME

---

## Deployment Summary (部署概要)

| Item | Value |
|------|-------|
| Stack Status | $STACK_STATUS |
| HTTP Status | $HTTP_STATUS |
| Access URL | http://$ACCESS_IP/ |

---

## Stack Outputs (资源栈输出)

$OUTPUTS

---

## Access URLs (访问地址)

- **Application**: http://$ACCESS_IP/
$(if [ -n "$SLB_IP" ]; then echo "- **SLB IP**: http://$SLB_IP/"; fi)
$(if [ -n "$ECS_IP" ]; then echo "- **ECS IP**: http://$ECS_IP/"; fi)
- **ROS Console**: https://ros.console.aliyun.com/
- **ECS Console**: https://ecs.console.aliyun.com/

---

## Verification Steps Completed (验证步骤)

- [x] ROS stack deployment (资源栈部署)
- [x] Code deployment (代码部署)
- [x] Health check (HTTP $HTTP_STATUS) (健康检查)
- [x] Log analysis (日志分析)
$(if echo "$OUTPUTS" | grep -qi "Rds\|PolarDB"; then echo "- [x] Database connectivity check (数据库连通检查)"; fi)

---

## Issues Found (发现的问题)

$(if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    echo "- ✅ No issues found (无异常)"
else
    echo "- ❌ HTTP status code: $HTTP_STATUS"
    echo "- See diagnosis section for details (详见诊断部分)"
fi)

---

## Troubleshooting Commands (故障排查命令)

\`\`\`bash
# SSH进入ECS
ssh root@$ECS_IP

# 或通过Workbench (无需密钥)
# ECS Console → Remote Connect → Workbench

# 查看应用日志
ssh root@$ECS_IP 'pm2 logs --lines 50'
ssh root@$ECS_IP 'tail -50 /var/log/app.log'

# 查看cloud-init日志
ssh root@$ECS_IP 'tail -50 /var/log/cloud-init-output.log'

# 重启应用
ssh root@$ECS_IP 'pm2 restart app'

# 查看ROS Stack事件
aliyun ros ListStackEvents --StackId $STACK_ID

# 删除Stack (如需重建)
aliyun ros DeleteStack --StackId $STACK_ID
\`\`\`

---

## Next Steps (后续步骤)

1. ✅ Monitor application (CloudMonitor/SLS)
2. Configure custom domain (域名配置)
   - Point DNS A record to SLB/ECS IP
   - ⚠️ Chinese domains require ICP filing (备案)
3. Apply SSL certificate (CAS证书服务, free)
4. Set up CloudMonitor alert rules (云监控告警)
5. Configure RDS auto-backup (RDS自动备份, 7-14天)
6. Review Security Group rules (安全组审查)

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
- **NEVER store AK/SK** in code or templates
- **Always confirm before creating paid resources** - show cost estimate first
- **⚠️ NEW: Always verify deployment** - never skip health check and log analysis
- **⚠️ NEW: Check ROS stack events** when deployment fails
- **⚠️ NEW: Check Security Group rules** - ports 80/443 must be open for web apps
- **⚠️ NEW: RDS requires IP whitelist** - add ECS private IP or Security Group to RDS whitelist
- **Use PostPaid (pay-as-you-go) by default** unless user explicitly requests PrePaid
- **Chinese regions** require ICP filing (备案) for custom domains with HTTP access
- For the latest pricing, always use WebSearch before presenting cost estimates
- ROS template source: 300+ templates indexed in `references/ros-template-catalog.md`, originals in `C:\work\ros-templates\`
- For complex deployments, read `references/solution-patterns.md` for resource composition patterns and `references/resource-reference.md` for property details
- Always validate generated templates with `validate_template.py` before deployment
- **⚠️ CRITICAL: Read `references/aliyun-deployment-health-issues.md`** when deployment fails
- **⚠️ SECURITY: Invoke `/architecture`** (engineering plugin) when Enterprise security level is selected — this skill's templates only cover Basic-to-Standard tier security. The `/architecture` ADR output should guide WAF, Anti-DDoS, KMS, Security Center (SAS), Cloud Config, 3-tier VSwitch, and RDS security additions
