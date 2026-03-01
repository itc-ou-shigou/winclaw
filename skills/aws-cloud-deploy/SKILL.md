---
name: aws-cloud-deploy
description: >
  AWS full-stack deployment assistant. Guides users through infrastructure planning,
  cost estimation, and automated deployment on Amazon Web Services.
  Use when the user wants to: (1) deploy an application to AWS,
  (2) plan cloud architecture with budget and traffic requirements,
  (3) create CloudFormation infrastructure stacks,
  (4) automatically deploy workspace code to EC2/ECS/EKS/Lambda,
  (5) set up VPC, EC2, RDS, ALB, ElastiCache, CloudFront, WAF, or other AWS services.
  Triggers on: "deploy to aws", "AWS deploy", "AWS方案", "AWSにデプロイ", "aws cloud".
---

# AWS Cloud Deploy

End-to-end deployment: requirements gathering → architecture design → cost estimation → infrastructure provisioning → code deployment → verification report.

## Scripts

| Script | Purpose | Input | Output |
|--------|---------|-------|--------|
| `scripts/detect_project.py` | Detect project type from workspace | `--path <dir>` | JSON: type, framework, commands, port |
| `scripts/analyze_requirements.py` | Select pattern + cost breakdown | budget, traffic, db, security, app-type, region | JSON: recommendation |
| `scripts/estimate_cost.py` | Format cost table | recommendation JSON (stdin) | Markdown table |
| `scripts/generate_cfn_template.py` | Generate CloudFormation YAML template | recommendation JSON | CloudFormation template YAML |
| `scripts/validate_template.py` | Validate CloudFormation template | `--input template.yaml` | Validation report |
| `scripts/generate_deploy_script.py` | Generate deployment script | project JSON + stack outputs | AWS CLI script / Dockerfile / K8s manifest |

## Reference Files (Read As Needed)

| File | When to Read |
|------|-------------|
| `references/architecture-patterns.md` | Phase 2: Select pattern, show architecture diagram |
| `references/pricing-guide.md` | Phase 2: Baseline cost estimation |
| `references/security-tiers.md` | Phase 1-2: When user asks about security levels |
| `references/resource-reference.md` | Phase 3A: CloudFormation resource types, properties, instance types |
| `references/solution-patterns.md` | Phase 3A: Resource composition, dependency graphs, cross-pattern integrations |
| `references/deployment-checklist.md` | Phase 3A-3C: Step-by-step checklist, post-deployment report template |
| `references/service-selection-guide.md` | Phase 1-2: Compute/DB/Network selection decision trees, scaling strategies |
| `references/cfn-template-catalog.md` | Phase 3A: Index of base templates in `assets/cfn-base-templates/` |

## Base CloudFormation Templates (in `assets/cfn-base-templates/`)

| Template | Pattern | Resources | Description |
|----------|---------|-----------|-------------|
| `ec2-lite.yaml` | lite | 5 | Single EC2 + VPC + SG + EIP |
| `ec2-rds-standard.yaml` | standard | 7 | EC2 + RDS + ALB |
| `alb-asg-rds-ha.yaml` | ha | 10 | ALB + ASG + Multi-AZ RDS |
| `asg-elasticache-elastic.yaml` | elastic | 12 | ASG + ElastiCache + CloudFront |
| `lambda-serverless.yaml` | serverless | 6 | Lambda + API Gateway + DynamoDB/RDS |
| `eks-container.yaml` | container | 6 | EKS + ECR + Node Group |
| `vpc-sg-base.yaml` | (base) | 4 | VPC + Subnets + IGW + SG |
| `rds-standalone.yaml` | (base) | 3 | RDS MySQL/PostgreSQL + Subnet Group |
| `elasticache-redis.yaml` | (base) | 3 | ElastiCache Redis cluster |
| `s3-bucket.yaml` | (base) | 1 | S3 bucket with encryption |

### AWS Documentation Reference

For complex deployments, consult local best practices repositories:

```
C:\work\aws-eks-best-practices\                     → EKS security, networking, scaling, cost
C:\work\cloud-operations-best-practices\             → CloudTrail, Config, Control Tower, patching
```

## Workflow Overview

```
Phase 1: Hearing     → Ask user 5-6 questions, detect workspace project
Phase 2: Plan        → Recommend architecture, show cost table, get approval
Phase 3A: Infra      → Generate CloudFormation template, validate, deploy via AWS CLI
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
1. **Monthly Budget** : ~$50 / ~$200 / ~$500 / $1000+ USD
2. **Daily Traffic Forecast**:
   - Current: __ visits/day
   - In 3 months: __ visits/day
   - In 1 year: __ visits/day
3. **Database**: None / MySQL / PostgreSQL / + Redis cache

**Round 2** (if needed based on Round 1):
4. **Security Level**: Basic / Standard / Enterprise
   - See `references/security-tiers.md` for definitions
5. **Region**: us-east-1 / us-west-2 / eu-west-1 / ap-southeast-1 / ap-northeast-1 / etc.
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

Output: JSON recommendation with pattern, services, cost breakdown, CloudFormation template approach.

## Phase 2: Present Plan & Get Approval

### Step 2.1: Show Architecture Diagram

Display ASCII architecture based on the selected pattern. Read `references/architecture-patterns.md` for pattern-specific diagrams.

### Step 2.2: Show Cost Estimate

Pipe the recommendation JSON into the cost formatter:

```bash
echo '<RECOMMENDATION_JSON>' | python scripts/estimate_cost.py --format markdown
```

### Step 2.3: Verify Latest Pricing

Use WebSearch to check current AWS pricing for the recommended services. Search queries:
- `AWS EC2 <instance-type> pricing 2026`
- `AWS RDS <instance-type> pricing`
- `AWS Lambda pricing`

Update the estimate if prices have changed significantly.

### Step 2.4: Get User Approval

Present the complete plan and ask:
- "This is the recommended architecture. Approve to proceed?"
- If user wants changes, loop back to modify parameters

**After approval, ask for AWS access:**
- "Please confirm `aws configure` is configured or log in to AWS Console."

## Phase 3A: Infrastructure Deployment

### Step 3A.1: Generate & Validate CloudFormation Template

```bash
# Generate template
echo '<RECOMMENDATION_JSON>' | python scripts/generate_cfn_template.py --output /tmp/stack.yaml

# Validate template
python scripts/validate_template.py --input /tmp/stack.yaml --strict
```

**Supported patterns** (fully generated):

| Pattern | Resources Created |
|---------|------------------|
| `lite` | VPC + Subnets + IGW + SG + EC2 + EIP |
| `standard` | VPC + Subnets + IGW + SG + EC2 + ALB + RDS |
| `ha` | VPC + Subnets + IGW + SG + ALB + ASG + Launch Template + Multi-AZ RDS |
| `elastic` | VPC + Subnets + IGW + SG + ALB + ASG + RDS + ElastiCache + CloudFront |
| `serverless` | Lambda Function + API Gateway + IAM Role + S3 + optional RDS/DynamoDB |
| `container` | VPC + Subnets + EKS Cluster + Node Group + ECR + optional RDS |

### Step 3A.2: Deploy via AWS CLI

```bash
# Validate template
aws cloudformation validate-template --template-body file:///tmp/stack.yaml

# Deploy stack
aws cloudformation create-stack \
  --stack-name <PROJECT>-stack \
  --template-body file:///tmp/stack.yaml \
  --parameters ParameterKey=DBPassword,ParameterValue=<ASK_USER> \
  --capabilities CAPABILITY_IAM \
  --region <REGION>

# Wait for completion
aws cloudformation wait stack-create-complete --stack-name <PROJECT>-stack

# Get outputs
aws cloudformation describe-stacks --stack-name <PROJECT>-stack \
  --query 'Stacks[0].Outputs'
```

### Step 3A.3: Alternative - Deploy via AWS Console

1. Navigate to `https://console.aws.amazon.com/cloudformation/`
2. Click "Create stack" → "With new resources"
3. Upload the generated template YAML
4. Fill parameters: stack name, passwords (ASK USER), instance specs
5. Acknowledge IAM capabilities → Click "Create stack"
6. Wait for CREATE_COMPLETE, collect outputs

## Phase 3B: Code Deployment

### Step 3B.0: Generate Deployment Script

After collecting stack outputs:

```bash
# For EC2-based patterns
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
| `lite` | SSH + script | SCP to EC2 → `bash deploy.sh` |
| `standard` | SSH + script | SCP to EC2 behind ALB → `bash deploy.sh` |
| `ha` | UserData + CodeDeploy | Auto Scaling Group handles deployment |
| `elastic` | UserData + CodeDeploy | ASG + Launch Template with UserData |
| `serverless` | aws lambda deploy | `aws lambda update-function-code` / SAM deploy |
| `container` | kubectl + ECR | Build → push to ECR → `kubectl apply` |

### Step 3B.1: EC2 Deploy (lite/standard)

```bash
# SCP code to instance
scp -i <KEY>.pem -r ./* ec2-user@<PUBLIC_IP>:/app/

# SSH and run deploy script
ssh -i <KEY>.pem ec2-user@<PUBLIC_IP> 'bash /app/deploy.sh'
```

### Step 3B.2: Container Deploy (container pattern)

```bash
# Authenticate with ECR
aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com

# Build and push
docker build -t <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<REPO>:<TAG> .
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<REPO>:<TAG>

# Deploy to EKS
aws eks update-kubeconfig --name <CLUSTER_NAME> --region <REGION>
kubectl apply -f /tmp/k8s-deploy.yml
```

### Step 3B.3: Serverless Deploy (serverless pattern)

```bash
# Package and upload
zip -r /tmp/function.zip .
aws lambda update-function-code \
  --function-name <FUNCTION_NAME> \
  --zip-file fileb:///tmp/function.zip
```

## Phase 3C: Verification & Report

### Step 3C.1: Health Checks

1. **EC2**: `curl -s -o /dev/null -w "%{http_code}" http://<PUBLIC_IP>/` → expect `200`
2. **ALB**: `curl http://<ALB_DNS>/` → expect `200`
3. **EKS**: `kubectl get svc` → verify external IP, `curl http://<EXTERNAL_IP>/`
4. **Lambda**: `aws lambda invoke --function-name <NAME> /tmp/response.json`
5. **Database**: Verify app can connect (check app logs / CloudWatch)

### Step 3C.2: Generate Deployment Report

Present a complete report:
- Stack Name, Region, Status
- All resource IDs and IPs/endpoints
- Application access URL
- Database connection info (except password)
- Estimated monthly cost
- Next steps (custom domain, SSL, monitoring, backup)

### Step 3C.3: Recommend Next Steps

1. **Custom Domain**: Add CNAME/A record via Route 53 or external DNS
2. **SSL**: Configure ACM certificate (free) + attach to ALB/CloudFront
3. **Monitoring**: Enable CloudWatch Alarms + SNS notification
4. **Backup**: Configure RDS automated backup, S3 lifecycle policies
5. **Security**: Review Security Groups, enable AWS WAF if needed

## Important Notes

- **NEVER auto-fill passwords or secrets** - always ask user to input manually
- **NEVER store AWS credentials** in code or templates
- **Always confirm before creating paid resources** - show cost estimate first
- **Use On-Demand by default** unless user explicitly requests Reserved/Savings Plans
- **Pricing is in USD** - convert to user's currency if requested
- For the latest pricing, always use WebSearch before presenting cost estimates
- EKS best practices reference: `C:\work\aws-eks-best-practices\` for container patterns
- Always validate generated templates with `validate_template.py` before deployment
