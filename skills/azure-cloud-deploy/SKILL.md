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

End-to-end deployment: requirements gathering → architecture design → cost estimation → infrastructure provisioning → code deployment → verification report.

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

## Base ARM Templates (in `assets/arm-base-templates/`)

| Template | Pattern | Resources | Description |
|----------|---------|-----------|-------------|
| `vm-lite.json` | lite | 5 | Single VM + VNet + NSG + Public IP |
| `appservice-db-standard.json` | standard | 4 | App Service + Azure DB Flexible |
| `appservice-ha.json` | ha | 7 | App Service + App Gateway + HA DB |
| `vmss-elastic.json` | elastic | 9 | VMSS + LB + Redis + CDN + DB |
| `functions-serverless.json` | serverless | 5 | Functions + API Management + Storage |
| `aks-container.json` | container | 4 | AKS + ACR + VNet |
| `vnet-nsg-base.json` | (base) | 2 | VNet + NSG foundation |
| `db-flexible-server.json` | (base) | 2-4 | MySQL/PostgreSQL Flexible Server + Firewall |
| `redis-cache.json` | (base) | 1 | Azure Cache for Redis |
| `storage-account.json` | (base) | 1 | Storage Account for Functions/blobs |

### Azure Documentation Reference

For complex deployments, consult the Azure Architecture Center docs:

```
C:\work\architecture-center\docs\guide\technology-choices\   → Compute/DB/LB selection
C:\work\architecture-center\docs\guide\aks\                  → AKS HA, firewall, blue-green
C:\work\architecture-center\docs\guide\architecture-styles\  → N-tier, microservices, serverless
C:\work\architecture-center\docs\best-practices\             → Caching, scaling, monitoring
C:\work\architecture-center\docs\example-scenario\           → Real-world architecture examples
```

## Workflow Overview

```
Phase 1: Hearing     → Ask user 5-6 questions, detect workspace project
Phase 2: Plan        → Recommend architecture, show cost table, get approval
Phase 3A: Infra      → Generate ARM template, validate, deploy via az CLI or Portal
Phase 3B: Code       → Generate deploy script, execute deployment
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
1. **Monthly Budget** (月額予算): ~$50 / ~$200 / ~$500 / $1000+ USD
2. **Daily Traffic Forecast**:
   - Current: __ visits/day
   - In 3 months: __ visits/day
   - In 1 year: __ visits/day
3. **Database**: None / MySQL / PostgreSQL / + Redis cache

**Round 2** (if needed based on Round 1):
4. **Security Level**: Basic / Standard / Enterprise
   - See `references/security-tiers.md` for definitions
5. **Region**: eastus / westus2 / westeurope / southeastasia / japaneast / etc.
6. **App Type**: Website / API / SPA+API / Microservice

### Step 1.3: Analyze Requirements

Run the analysis script:

```bash
python scripts/analyze_requirements.py \
  --budget <BUDGET_USD> \
  --traffic-now <NOW> --traffic-3m <3M> --traffic-1y <1Y> \
  --db <mysql|postgresql|redis|none> \
  --security <basic|standard|enterprise> \
  --app-type <web|api|spa-api|microservice> \
  --region <REGION_ID>
```

Output: JSON recommendation with pattern, services, cost breakdown, ARM template approach.

## Phase 2: Present Plan & Get Approval

### Step 2.1: Show Architecture Diagram

Display ASCII architecture based on the selected pattern. Read `references/architecture-patterns.md` for pattern-specific diagrams.

### Step 2.2: Show Cost Estimate

Pipe the recommendation JSON into the cost formatter:

```bash
echo '<RECOMMENDATION_JSON>' | python scripts/estimate_cost.py --format markdown
```

### Step 2.3: Verify Latest Pricing

Use WebSearch to check current Azure pricing for the recommended services. Search queries:
- `Azure App Service <tier> pricing 2026`
- `Azure SQL Database <tier> pricing`
- `Azure VM <size> pricing`

Update the estimate if prices have changed significantly.

### Step 2.4: Get User Approval

Present the complete plan and ask:
- "This is the recommended architecture. Approve to proceed?"
- If user wants changes, loop back to modify parameters

**After approval, ask for Azure access:**
- "Please log in to Azure Portal (https://portal.azure.com) or confirm `az login` is configured."

## Phase 3A: Infrastructure Deployment

### Step 3A.1: Generate & Validate ARM Template

```bash
# Generate template
echo '<RECOMMENDATION_JSON>' | python scripts/generate_arm_template.py --output /tmp/azuredeploy.json

# Validate template
python scripts/validate_template.py --input /tmp/azuredeploy.json --strict
```

**Supported patterns** (fully generated):

| Pattern | Resources Created |
|---------|------------------|
| `lite` | Resource Group + VNet + NSG + VM + Public IP |
| `standard` | RG + VNet + NSG + App Service Plan + App Service + Azure Database |
| `ha` | RG + VNet + NSG + App Service Plan (S1+) + 2 App instances + HA Database + Application Gateway |
| `elastic` | RG + VNet + NSG + VMSS + Azure Database Flexible + Azure Cache for Redis + Load Balancer + CDN |
| `serverless` | RG + VNet + Storage Account + Function App + API Management + optional Database |
| `container` | RG + VNet + NSG + AKS Cluster + Azure Container Registry + optional Database |

### Step 3A.2: Deploy via az CLI

```bash
# Create resource group
az group create --name <PROJECT>-rg --location <REGION>

# Deploy ARM template
az deployment group create \
  --resource-group <PROJECT>-rg \
  --template-file /tmp/azuredeploy.json \
  --parameters adminPassword=<ASK_USER>

# Wait and collect outputs
az deployment group show \
  --resource-group <PROJECT>-rg \
  --name azuredeploy \
  --query properties.outputs
```

### Step 3A.3: Alternative - Deploy via Azure Portal

1. Navigate to `https://portal.azure.com` → "Deploy a custom template"
2. Click "Build your own template in the editor"
3. Paste the generated ARM JSON
4. Fill parameters: resource group, region, passwords (ASK USER), specs
5. Click "Review + Create" → "Create"
6. Wait for deployment complete, collect outputs

## Phase 3B: Code Deployment

### Step 3B.0: Generate Deployment Script

After collecting deployment outputs:

```bash
# Generate deployment script (for VM-based patterns)
python scripts/detect_project.py --path <WORKSPACE_PATH> | \
  python scripts/generate_deploy_script.py \
    --stack-outputs /tmp/stack_outputs.json \
    --pattern <PATTERN> \
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

| Pattern | Method | How to Execute |
|---------|--------|----------------|
| `lite` | SSH + script | SCP to VM → `bash deploy.sh` |
| `standard` | az webapp deploy | `az webapp deploy --resource-group <RG> --name <APP>` |
| `ha` | az webapp deploy | Same as standard, App Service handles distribution |
| `elastic` | VMSS custom script ext | Custom Script Extension on VMSS |
| `serverless` | func azure publish | `func azure functionapp publish <APP>` |
| `container` | kubectl + ACR | Build → push to ACR → `kubectl apply` |

### Step 3B.1: App Service Deploy (standard/ha)

```bash
# Option A: ZIP deploy
cd <WORKSPACE_PATH>
zip -r /tmp/app.zip . -x '*.git*' 'node_modules/*'
az webapp deploy --resource-group <RG> --name <APP> --src-path /tmp/app.zip --type zip

# Option B: Git deploy
az webapp deployment source config-local-git --resource-group <RG> --name <APP>
git remote add azure <DEPLOYMENT_URL>
git push azure main
```

### Step 3B.2: Container Deploy (container pattern)

```bash
# Build and push to ACR
az acr login --name <ACR_NAME>
docker build -t <ACR_NAME>.azurecr.io/<IMAGE>:<TAG> .
docker push <ACR_NAME>.azurecr.io/<IMAGE>:<TAG>

# Deploy to AKS
az aks get-credentials --resource-group <RG> --name <AKS_NAME>
kubectl apply -f /tmp/k8s-deploy.yml
```

### Step 3B.3: Serverless Deploy (serverless pattern)

```bash
cd <WORKSPACE_PATH>
func azure functionapp publish <FUNCTION_APP_NAME>
```

## Phase 3C: Verification & Report

### Step 3C.1: Health Checks

1. **VM**: `curl -s -o /dev/null -w "%{http_code}" http://<PUBLIC_IP>/` → expect `200`
2. **App Service**: `curl https://<APP>.azurewebsites.net/` → expect `200`
3. **AKS**: `kubectl get svc` → verify external IP, `curl http://<EXTERNAL_IP>/`
4. **Database**: Verify app can connect (check app logs)

### Step 3C.2: Generate Deployment Report

Present a complete report:
- Resource Group, Deployment Name, Status
- All resource IDs and IPs/endpoints
- Application access URL
- Database connection info (except password)
- Estimated monthly cost
- Next steps (custom domain, SSL, monitoring, backup)

### Step 3C.3: Recommend Next Steps

1. **Custom Domain**: Add CNAME/A record, configure in App Service or AKS Ingress
2. **SSL**: Configure managed certificate (free for App Service)
3. **Monitoring**: Enable Azure Monitor + Application Insights
4. **Backup**: Configure automated backup for Azure Database
5. **Security**: Review NSG rules, enable Azure Defender if needed

## Important Notes

- **NEVER auto-fill passwords or secrets** - always ask user to input manually
- **NEVER store service principal credentials** in code or templates
- **Always confirm before creating paid resources** - show cost estimate first
- **Use Pay-As-You-Go by default** unless user explicitly requests Reserved Instances
- **Pricing is in USD** - convert to user's currency if requested
- For the latest pricing, always use WebSearch before presenting cost estimates
- ARM template reference: `C:\work\architecture-center\docs\guide\` for best practices
- Always validate generated templates with `validate_template.py` before deployment
