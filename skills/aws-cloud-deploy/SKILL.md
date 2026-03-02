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

End-to-end deployment: requirements gathering → architecture design → cost estimation → infrastructure provisioning → code deployment → **verification + diagnosis** → report.

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
| **`references/aws-deployment-health-issues.md`** | **Phase 3C: 错误诊断、日志读取、验证步骤（必读！）** |

### Security Architecture Design (via Engineering Plugin)

When the user selects **Enterprise** security level or requests advanced security architecture (WAF, zero-trust, compliance, etc.), this skill's built-in templates only cover Basic-to-Standard tier security. For complex security design, invoke the **engineering plugin's `/architecture` command**:

```
Plugin location: C:\work\winclaw\plugins\engineering\
Command: /architecture
Related skill: system-design (auto-triggered)
```

**When to invoke** (any of these conditions):
- User selects `--security enterprise` in Phase 1
- User mentions: WAF, DDoS, zero-trust, compliance (PCI-DSS, HIPAA, SOC2), PrivateLink, GuardDuty
- User asks "what's the best security architecture for my deployment?"
- Traffic forecast suggests high-value target (financial, healthcare, e-commerce)

**How to invoke**:
```
/architecture Design a security architecture for [APP_NAME] on AWS with the following requirements:
- Architecture pattern: [lite/standard/ha/elastic/serverless/container]
- Security tier: Enterprise
- Compliance: [PCI-DSS / HIPAA / SOC2 / none]
- Traffic: [X visits/day]
- Constraints: [budget, team size, timeline]

Key decisions needed:
1. VPC network segmentation (public/private/isolated subnets, VPC endpoints)
2. WAF rules (OWASP Top 10, rate limiting, geo-blocking)
3. DDoS protection (Shield Standard vs Advanced)
4. Encryption strategy (KMS CMK, RDS TDE, S3 SSE-KMS, in-transit TLS 1.3)
5. IAM design (roles, permission boundaries, cross-account access)
6. Threat detection (GuardDuty, Security Hub, Macie)
7. Compliance monitoring (AWS Config rules, conformance packs)
8. Secrets management (Secrets Manager rotation, Parameter Store)
9. Network security (PrivateLink, VPC Flow Logs, Network Firewall)
10. Logging & audit (CloudTrail, centralized CloudWatch, S3 access logs)
```

**After `/architecture` produces an ADR**:
1. Use the ADR's recommendations to customize the CloudFormation template in Phase 3A
2. Add WAF, KMS, GuardDuty, Config resources to the generated template
3. Reference `C:\work\aws-eks-best-practices\` for EKS-specific security hardening
4. Reference `C:\work\cloud-operations-best-practices\` for CloudTrail/Config patterns
5. Include security architecture decisions in the Phase 3D deployment report

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

### Step 1.2B: Security Architecture Check (Conditional)

**If user selected Enterprise security OR mentioned compliance/WAF/zero-trust**:

→ **STOP and invoke `/architecture`** before proceeding to Phase 2.
See "Security Architecture Design (via Engineering Plugin)" section above for the invocation template.

The `/architecture` command will produce an ADR with:
- Network segmentation design (multi-tier VPC, VPC Endpoints, PrivateLink)
- WAF + DDoS strategy with cost trade-offs
- IAM roles and permission boundary design
- Encryption and secrets management strategy
- Compliance monitoring approach

Use the ADR output to enrich the Phase 2 architecture plan and Phase 3A CloudFormation template.

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

## Phase 3C: Verification & Diagnosis (⚠️ MANDATORY - 不可跳过)

### Step 3C.1: CloudFormation Stack Status Check

**必须执行**:
```bash
# 1. 检查CloudFormation Stack状态
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].StackStatus' --output text 2>/dev/null)

case "$STACK_STATUS" in
    "CREATE_COMPLETE"|"UPDATE_COMPLETE")
        echo "✅ Stack status: $STACK_STATUS"
        ;;
    "CREATE_IN_PROGRESS"|"UPDATE_IN_PROGRESS")
        echo "⏳ Stack still in progress: $STACK_STATUS"
        echo "[ACTION] Wait for completion:"
        echo "aws cloudformation wait stack-create-complete --stack-name $STACK_NAME"
        ;;
    "ROLLBACK_COMPLETE"|"ROLLBACK_IN_PROGRESS"|"CREATE_FAILED"|"UPDATE_ROLLBACK_COMPLETE")
        echo "❌ CRITICAL: Stack failed: $STACK_STATUS"
        echo "[ACTION] Check stack events for root cause"
        aws cloudformation describe-stack-events \
            --stack-name "$STACK_NAME" \
            --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].[LogicalResourceId,ResourceStatusReason]' \
            --output table
        ;;
    *)
        echo "⚠️  Unexpected stack status: $STACK_STATUS"
        ;;
esac

# 2. 列出所有Stack Outputs
echo ""
echo "=== Stack Outputs ==="
aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' \
    --output table
```

### Step 3C.2: Basic Health Check

**必须执行** (根据部署模式):
```bash
# EC2/ALB 模式
check_ec2_health() {
    # 1. 检查EC2实例状态
    INSTANCE_ID="$1"
    INSTANCE_STATE=$(aws ec2 describe-instance-status \
        --instance-ids "$INSTANCE_ID" \
        --query 'InstanceStatuses[0].InstanceState.Name' --output text)

    if [ "$INSTANCE_STATE" = "running" ]; then
        echo "✅ EC2 instance state: running"
    else
        echo "❌ EC2 instance state: $INSTANCE_STATE"
        echo "[ACTION] Check system logs:"
        echo "aws ec2 get-console-output --instance-id $INSTANCE_ID"
    fi

    # 2. 检查系统状态检查
    SYSTEM_CHECK=$(aws ec2 describe-instance-status \
        --instance-ids "$INSTANCE_ID" \
        --query 'InstanceStatuses[0].SystemStatus.Status' --output text)

    INSTANCE_CHECK=$(aws ec2 describe-instance-status \
        --instance-ids "$INSTANCE_ID" \
        --query 'InstanceStatuses[0].InstanceStatus.Status' --output text)

    echo "System check: $SYSTEM_CHECK | Instance check: $INSTANCE_CHECK"

    # 3. 测试HTTP访问
    PUBLIC_IP=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$PUBLIC_IP/" --connect-timeout 10 || echo "000")

    case "$HTTP_STATUS" in
        "200"|"301"|"302")
            echo "✅ Health check passed (HTTP $HTTP_STATUS)"
            ;;
        "000")
            echo "❌ Connection refused/timeout"
            echo "[ACTION] Check Security Group allows inbound HTTP (port 80/443)"
            echo "[ACTION] Check application is started: ssh ec2-user@$PUBLIC_IP 'systemctl status app || pm2 status'"
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

# ALB 模式 - 检查Target Group健康状态
check_alb_health() {
    TARGET_GROUP_ARN="$1"

    echo "=== ALB Target Group Health ==="
    aws elbv2 describe-target-health \
        --target-group-arn "$TARGET_GROUP_ARN" \
        --query 'TargetHealthDescriptions[].[Target.Id,TargetHealth.State,TargetHealth.Reason,TargetHealth.Description]' \
        --output table

    # 检查不健康的目标
    UNHEALTHY=$(aws elbv2 describe-target-health \
        --target-group-arn "$TARGET_GROUP_ARN" \
        --query 'TargetHealthDescriptions[?TargetHealth.State!=`healthy`].Target.Id' --output text)

    if [ -z "$UNHEALTHY" ]; then
        echo "✅ All targets healthy"
    else
        echo "❌ Unhealthy targets: $UNHEALTHY"
        echo "[ACTION] Check Security Group, application status, and health check path"
    fi
}

# EKS 模式
check_eks_health() {
    echo "=== EKS Pod Status ==="
    kubectl get pods -l app=app -o wide

    # 检查CrashLoopBackOff
    CRASH_PODS=$(kubectl get pods -l app=app -o jsonpath='{.items[?(@.status.containerStatuses[0].state.waiting.reason=="CrashLoopBackOff")].metadata.name}')
    if [ -n "$CRASH_PODS" ]; then
        echo "❌ Pods in CrashLoopBackOff: $CRASH_PODS"
        echo "[ACTION] Check pod logs:"
        for pod in $CRASH_PODS; do
            echo "--- Logs for $pod ---"
            kubectl logs "$pod" --tail=50
        done
    fi

    echo ""
    echo "=== EKS Service Status ==="
    kubectl get svc app-svc
    EXTERNAL_IP=$(kubectl get svc app-svc -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
    if [ -n "$EXTERNAL_IP" ]; then
        echo "External endpoint: $EXTERNAL_IP"
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$EXTERNAL_IP/" --connect-timeout 10 || echo "000")
        echo "HTTP Status: $HTTP_STATUS"
    fi
}

# Lambda 模式
check_lambda_health() {
    FUNCTION_NAME="$1"

    # 检查函数配置
    echo "=== Lambda Function Status ==="
    aws lambda get-function-configuration \
        --function-name "$FUNCTION_NAME" \
        --query '{State:State,LastUpdateStatus:LastUpdateStatus,Runtime:Runtime,MemorySize:MemorySize,Timeout:Timeout}' \
        --output table

    # 调用测试
    echo "=== Lambda Invocation Test ==="
    aws lambda invoke \
        --function-name "$FUNCTION_NAME" \
        --payload '{}' \
        /tmp/lambda-response.json \
        --query '{StatusCode:StatusCode,FunctionError:FunctionError}' \
        --output table

    if [ -f /tmp/lambda-response.json ]; then
        echo "Response:"
        cat /tmp/lambda-response.json
    fi
}
```

### Step 3C.3: Log Download and Analysis

**如果健康检查失败，必须执行**:
```bash
diagnose_deployment() {
    echo "=========================================="
    echo "  AWS Deployment Failure Diagnosis"
    echo "=========================================="
    echo ""

    # ===== EC2 Diagnosis =====
    diagnose_ec2() {
        INSTANCE_ID="$1"

        # Step 1: EC2 Console Output (启动日志)
        echo "[1/5] Getting EC2 console output (boot log)..."
        aws ec2 get-console-output \
            --instance-id "$INSTANCE_ID" \
            --output text > /tmp/ec2-console.log 2>/dev/null

        if [ -f /tmp/ec2-console.log ]; then
            echo "Checking for boot errors..."

            # Cloud-init failures
            if grep -q "Cloud-init.*FAIL\|Cloud-init.*ERROR" /tmp/ec2-console.log; then
                echo ""
                echo "❌ DIAGNOSIS: Cloud-init (UserData) failed"
                echo "   PROBABLE CAUSE: UserData script has errors"
                echo "   ACTION: Check UserData script syntax and commands"
            fi

            # Package installation failures
            if grep -q "No package.*available\|E: Unable to locate package" /tmp/ec2-console.log; then
                echo ""
                echo "❌ DIAGNOSIS: Package installation failed"
                echo "   PROBABLE CAUSE: Package name incorrect or repo unavailable"
                echo "   ACTION: Verify package names for the AMI's OS"
            fi
        fi

        # Step 2: SSH检查应用日志
        echo ""
        echo "[2/5] Checking application logs via SSH..."
        echo "Commands to run on EC2:"
        echo "  ssh -i <KEY>.pem ec2-user@<IP> 'cat /var/log/cloud-init-output.log | tail -50'"
        echo "  ssh -i <KEY>.pem ec2-user@<IP> 'cat /var/log/app.log | tail -50'"
        echo "  ssh -i <KEY>.pem ec2-user@<IP> 'pm2 logs --lines 50'  # Node.js"
        echo "  ssh -i <KEY>.pem ec2-user@<IP> 'journalctl -u app -n 50'  # systemd"

        # Step 3: CloudWatch Logs (如果已配置)
        echo ""
        echo "[3/5] Checking CloudWatch Logs..."
        LOG_GROUP="/aws/ec2/$STACK_NAME"
        aws logs describe-log-streams \
            --log-group-name "$LOG_GROUP" \
            --order-by LastEventTime --descending \
            --limit 1 \
            --query 'logStreams[0].logStreamName' --output text 2>/dev/null

        if [ $? -eq 0 ]; then
            STREAM=$(aws logs describe-log-streams \
                --log-group-name "$LOG_GROUP" \
                --order-by LastEventTime --descending --limit 1 \
                --query 'logStreams[0].logStreamName' --output text)
            echo "Latest log stream: $STREAM"
            aws logs get-log-events \
                --log-group-name "$LOG_GROUP" \
                --log-stream-name "$STREAM" \
                --limit 50 \
                --query 'events[].[timestamp,message]' --output text
        else
            echo "⚠️  CloudWatch Log Group not found: $LOG_GROUP"
            echo "   Use SSH to check logs directly on EC2"
        fi

        # Step 4: Security Group检查
        echo ""
        echo "[4/5] Checking Security Group rules..."
        SG_ID=$(aws ec2 describe-instances \
            --instance-ids "$INSTANCE_ID" \
            --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text)

        echo "Inbound rules for $SG_ID:"
        aws ec2 describe-security-groups \
            --group-ids "$SG_ID" \
            --query 'SecurityGroups[0].IpPermissions[].[IpProtocol,FromPort,ToPort,IpRanges[0].CidrIp]' \
            --output table

        # 检查HTTP/HTTPS端口是否开放
        HTTP_OPEN=$(aws ec2 describe-security-groups \
            --group-ids "$SG_ID" \
            --query 'SecurityGroups[0].IpPermissions[?FromPort==`80`]' --output text)
        if [ -z "$HTTP_OPEN" ]; then
            echo "❌ Port 80 (HTTP) is NOT open in Security Group"
            echo "   ACTION: Add inbound rule for port 80"
        fi

        # Step 5: 生成修复建议
        echo ""
        echo "[5/5] Generating recommendations..."
        echo ""
        echo "=========================================="
        echo "  Diagnosis Complete"
        echo "=========================================="
    }

    # ===== CloudFormation Event Diagnosis =====
    diagnose_cfn_failure() {
        echo "=== CloudFormation Failed Events ==="
        aws cloudformation describe-stack-events \
            --stack-name "$STACK_NAME" \
            --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].[Timestamp,LogicalResourceId,ResourceType,ResourceStatusReason]' \
            --output table

        echo ""
        echo "=== Common CloudFormation Failures ==="
        echo ""

        # 检查IAM权限问题
        EVENTS=$(aws cloudformation describe-stack-events \
            --stack-name "$STACK_NAME" \
            --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].ResourceStatusReason' --output text)

        if echo "$EVENTS" | grep -qi "not authorized\|AccessDenied"; then
            echo "❌ DIAGNOSIS: IAM Permission Denied"
            echo "   ACTION: Ensure your IAM user/role has required permissions"
            echo "   HINT: Add AdministratorAccess for testing, then restrict later"
        fi

        if echo "$EVENTS" | grep -qi "limit\|quota\|LimitExceeded"; then
            echo "❌ DIAGNOSIS: Service Limit/Quota Exceeded"
            echo "   ACTION: Request quota increase via AWS Service Quotas console"
        fi

        if echo "$EVENTS" | grep -qi "already exists"; then
            echo "❌ DIAGNOSIS: Resource Already Exists"
            echo "   ACTION: Delete conflicting resource or use a different name"
        fi

        if echo "$EVENTS" | grep -qi "VPCIdNotSpecified\|SubnetNotFound\|InvalidSubnet"; then
            echo "❌ DIAGNOSIS: VPC/Subnet Configuration Error"
            echo "   ACTION: Verify VPC and subnet IDs exist in the target region/AZ"
        fi
    }
}
```

### Step 3C.4: Node.js Specific Verification

**如果是Node.js应用，必须执行**:
```bash
verify_nodejs_ec2() {
    EC2_IP="$1"
    KEY_FILE="$2"

    echo "=========================================="
    echo "  Node.js Deployment Verification (EC2)"
    echo "=========================================="

    # 1. 检查node_modules是否存在
    echo "[1/4] Checking node_modules..."
    NODE_MODULES=$(ssh -i "$KEY_FILE" ec2-user@"$EC2_IP" \
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
        echo "SSH into EC2 and install:"
        echo "  ssh -i $KEY_FILE ec2-user@$EC2_IP"
        echo "  cd /app && npm install --production"
        echo "  pm2 restart app  # or: systemctl restart app"
        echo ""
    fi

    # 2. 检查PM2进程状态
    echo "[2/4] Checking PM2 process..."
    ssh -i "$KEY_FILE" ec2-user@"$EC2_IP" 'pm2 status 2>/dev/null || echo "PM2 not running"'

    # 3. 检查应用端口
    echo "[3/4] Checking application port..."
    ssh -i "$KEY_FILE" ec2-user@"$EC2_IP" \
        'ss -tlnp | grep -E ":3000|:8080|:8000" || echo "No app listening on expected ports"'

    # 4. 检查应用日志
    echo "[4/4] Checking recent logs..."
    ssh -i "$KEY_FILE" ec2-user@"$EC2_IP" \
        'pm2 logs --lines 20 --nostream 2>/dev/null || tail -20 /var/log/app.log 2>/dev/null || echo "No logs found"'
}
```

### Step 3C.5: Common Fix Procedures

**Fix 1: Security Group - HTTP Not Open**
```bash
# Add HTTP (80) and HTTPS (443) inbound rules
aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" \
    --protocol tcp --port 80 --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" \
    --protocol tcp --port 443 --cidr 0.0.0.0/0

echo "✅ Security Group updated - HTTP/HTTPS ports opened"
```

**Fix 2: Application Not Running (EC2)**
```bash
# SSH into EC2 and restart
ssh -i "$KEY_FILE" ec2-user@"$EC2_IP" << 'FIXEOF'
cd /app

# Node.js: Restart with PM2
if command -v pm2 &>/dev/null; then
    pm2 restart app 2>/dev/null || pm2 start npm --name app -- start
    pm2 save
fi

# Check status
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
FIXEOF
```

**Fix 3: CloudFormation Stack Rollback - Delete and Recreate**
```bash
# 1. Delete failed stack
aws cloudformation delete-stack --stack-name "$STACK_NAME"
aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"
echo "Stack deleted"

# 2. Fix the template (based on diagnosis)
# ... edit template ...

# 3. Recreate stack
aws cloudformation create-stack \
    --stack-name "$STACK_NAME" \
    --template-body file:///tmp/stack.yaml \
    --parameters ParameterKey=DBPassword,ParameterValue=<ASK_USER> \
    --capabilities CAPABILITY_IAM

aws cloudformation wait stack-create-complete --stack-name "$STACK_NAME"
echo "Stack recreated"
```

**Fix 4: ALB Target Unhealthy**
```bash
# 检查Health Check配置
aws elbv2 describe-target-groups \
    --target-group-arns "$TARGET_GROUP_ARN" \
    --query 'TargetGroups[0].{Path:HealthCheckPath,Port:HealthCheckPort,Protocol:HealthCheckProtocol,Interval:HealthCheckIntervalSeconds}' \
    --output table

# 修改Health Check路径
aws elbv2 modify-target-group \
    --target-group-arn "$TARGET_GROUP_ARN" \
    --health-check-path "/" \
    --health-check-interval-seconds 30 \
    --healthy-threshold-count 2

echo "✅ Health check updated, wait 60s for re-evaluation..."
sleep 60
aws elbv2 describe-target-health \
    --target-group-arn "$TARGET_GROUP_ARN" \
    --output table
```

**Fix 5: EKS Pod CrashLoopBackOff**
```bash
# 1. 检查Pod日志
kubectl logs deployment/app --tail=50

# 2. 检查Pod事件
kubectl describe pod -l app=app | grep -A 10 "Events:"

# 3. 常见原因和修复
# - ImagePullBackOff: ECR登录过期 → 重新登录
aws ecr get-login-password --region $REGION | \
    docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# - CrashLoopBackOff: 应用启动失败 → 检查环境变量和配置
kubectl set env deployment/app PORT=3000 NODE_ENV=production

# - 重启deployment
kubectl rollout restart deployment/app
kubectl rollout status deployment/app
```

---

## Phase 3D: Deployment Report

### Step 3D.1: Generate Complete Report

**必须生成**:
```bash
generate_deployment_report() {
    STACK_NAME="$1"
    REGION="$2"

    # 收集Stack信息
    STACK_STATUS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
        --query 'Stacks[0].StackStatus' --output text)
    CREATION_TIME=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
        --query 'Stacks[0].CreationTime' --output text)

    # 收集所有Outputs
    OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
        --query 'Stacks[0].Outputs' --output json)

    # 提取关键信息
    PUBLIC_IP=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey | test("PublicIP|PublicIp|EIP")) | .OutputValue' | head -1)
    ALB_DNS=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey | test("ALB|LoadBalancer|DNS")) | .OutputValue' | head -1)
    RDS_ENDPOINT=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey | test("RDS|DB|Database")) | .OutputValue' | head -1)

    ACCESS_URL="${ALB_DNS:-$PUBLIC_IP}"

    # 测试HTTP
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://$ACCESS_URL/" --connect-timeout 10 || echo "000")

    # 生成报告
    cat > deployment-report.md <<EOF
# AWS Deployment Report

**Generated**: $(date '+%Y-%m-%d %H:%M:%S')
**Stack Name**: $STACK_NAME
**Region**: $REGION
**Stack Status**: $STACK_STATUS
**Created**: $CREATION_TIME

---

## Deployment Summary

| Item | Value |
|------|-------|
| Stack Status | $STACK_STATUS |
| HTTP Status | $HTTP_STATUS |
| Access URL | http://$ACCESS_URL/ |

---

## Stack Outputs

$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' --output table)

---

## Access URLs

- **Application**: http://$ACCESS_URL/
$(if [ -n "$ALB_DNS" ]; then echo "- **ALB DNS**: http://$ALB_DNS/"; fi)
$(if [ -n "$PUBLIC_IP" ]; then echo "- **EC2 IP**: http://$PUBLIC_IP/"; fi)
- **AWS Console**: https://$REGION.console.aws.amazon.com/cloudformation/home?region=$REGION#/stacks

---

## Verification Steps Completed

- [x] CloudFormation stack deployment
- [x] Code deployment
- [x] Health check (HTTP $HTTP_STATUS)
- [x] Log analysis
$(if [ -n "$RDS_ENDPOINT" ]; then echo "- [x] Database connectivity check"; fi)

---

## Issues Found

$(if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "301" ] || [ "$HTTP_STATUS" = "302" ]; then
    echo "- ✅ No issues found"
else
    echo "- ❌ HTTP status code: $HTTP_STATUS"
    echo "- See diagnosis section for details"
fi)

---

## Troubleshooting Commands

\`\`\`bash
# View CloudFormation events
aws cloudformation describe-stack-events --stack-name $STACK_NAME --query 'StackEvents[:10]'

# SSH into EC2
ssh -i <KEY>.pem ec2-user@$PUBLIC_IP

# View application logs
ssh -i <KEY>.pem ec2-user@$PUBLIC_IP 'pm2 logs --lines 50'

# View CloudWatch Logs
aws logs tail /aws/ec2/$STACK_NAME --since 1h

# Restart application
ssh -i <KEY>.pem ec2-user@$PUBLIC_IP 'pm2 restart app'

# Delete stack (if needed)
aws cloudformation delete-stack --stack-name $STACK_NAME
\`\`\`

---

## Next Steps

1. ✅ Monitor application performance (CloudWatch)
2. Configure custom domain via Route 53
3. Enable SSL with ACM certificate (free)
4. Set up CloudWatch Alarms + SNS notification
5. Configure RDS automated backup
6. Review Security Groups for production hardening

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
- **NEVER store AWS credentials** in code or templates
- **Always confirm before creating paid resources** - show cost estimate first
- **⚠️ NEW: Always verify deployment** - never skip health check and log analysis
- **⚠️ NEW: Check CloudFormation stack events** when deployment fails
- **⚠️ NEW: Verify Security Group rules** - ports 80/443 must be open for web apps
- **Use On-Demand by default** unless user explicitly requests Reserved/Savings Plans
- **Pricing is in USD** - convert to user's currency if requested
- For the latest pricing, always use WebSearch before presenting cost estimates
- EKS best practices reference: `C:\work\aws-eks-best-practices\` for container patterns
- Always validate generated templates with `validate_template.py` before deployment
- **⚠️ CRITICAL: Read `references/aws-deployment-health-issues.md`** when deployment fails
- **⚠️ SECURITY: Invoke `/architecture`** (engineering plugin) when Enterprise security level is selected — this skill's templates only cover Basic-to-Standard tier security. The `/architecture` ADR output should guide WAF, KMS, GuardDuty, Config, and PrivateLink resource additions
