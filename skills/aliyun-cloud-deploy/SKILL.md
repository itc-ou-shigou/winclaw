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

End-to-end deployment: requirements gathering → architecture design → cost estimation → infrastructure provisioning → code deployment → verification report.

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
Phase 3C: Verify     → Health check, report results
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

## Phase 3C: Verification & Report

### Step 3C.1: Health Checks

1. **ECS**: `curl -s -o /dev/null -w "%{http_code}" http://<ECS_IP>/` → expect `200`
2. **SLB**: Check backend health in console → expect "healthy"
3. **RDS**: Verify app can connect (check app logs)
4. **Domain**: If configured, verify DNS resolution

### Step 3C.2: Generate Deployment Report

Present a complete report to the user. Read `references/deployment-checklist.md` "Post-Deployment Report Template" section and fill in all collected values:

- Stack Name, ID, Status
- All resource IDs and IPs/endpoints
- Application access URL
- Database connection info (except password)
- Estimated monthly cost
- Next steps (domain DNS, SSL, monitoring, backup)

### Step 3C.3: Recommend Next Steps

1. **Domain**: Point DNS A record to SLB/ECS public IP
2. **SSL**: Apply free certificate via CAS (证书服务)
3. **Monitoring**: Enable CloudMonitor alert rules
4. **Backup**: Configure RDS auto-backup policy (7-14 days)
5. **Security**: Review security tier recommendations in `references/security-tiers.md`

## Important Notes

- **NEVER auto-fill passwords or secrets** - always ask user to input manually
- **NEVER store AK/SK** in code or templates
- **Always confirm before creating paid resources** - show cost estimate first
- **Use PostPaid (pay-as-you-go) by default** unless user explicitly requests PrePaid
- **Chinese regions** require ICP filing (备案) for custom domains with HTTP access
- For the latest pricing, always use WebSearch before presenting cost estimates
- ROS template source: 300+ templates indexed in `references/ros-template-catalog.md`, originals in `C:\work\ros-templates\`
- For complex deployments, read `references/solution-patterns.md` for resource composition patterns and `references/resource-reference.md` for property details
- Always validate generated templates with `validate_template.py` before deployment
