# aws-deployment-health-issues.md

**Purpose**: Comprehensive troubleshooting guide for AWS deployment including CloudFormation failures, EC2/ECS/EKS issues, log retrieval, error investigation, and common fix procedures.

**Version**: 1.0 (2026-03-01)

---

## Section 1: AWS Log Retrieval

### 1.1 EC2 Instance Logs

```bash
# Method 1: Console Output (boot log - no SSH needed)
aws ec2 get-console-output \
    --instance-id "$INSTANCE_ID" \
    --output text

# Method 2: SSH into instance
ssh -i <KEY>.pem ec2-user@<PUBLIC_IP> << 'EOF'
# Cloud-init output (UserData script results)
cat /var/log/cloud-init-output.log | tail -100

# Application log
cat /var/log/app.log | tail -50

# System journal
journalctl -u app -n 50 --no-pager

# PM2 logs (Node.js)
pm2 logs --lines 50 --nostream

# Nginx error log
cat /var/log/nginx/error.log | tail -30
EOF
```

### 1.2 CloudWatch Logs

```bash
# List available log groups
aws logs describe-log-groups \
    --query 'logGroups[].logGroupName' --output text

# Get latest log stream
LOG_GROUP="/aws/ec2/$STACK_NAME"
STREAM=$(aws logs describe-log-streams \
    --log-group-name "$LOG_GROUP" \
    --order-by LastEventTime --descending --limit 1 \
    --query 'logStreams[0].logStreamName' --output text)

# Read recent logs
aws logs get-log-events \
    --log-group-name "$LOG_GROUP" \
    --log-stream-name "$STREAM" \
    --limit 100 \
    --query 'events[].message' --output text

# Tail logs in real-time
aws logs tail "$LOG_GROUP" --follow --since 10m

# Filter for errors
aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --filter-pattern "ERROR" \
    --limit 20 \
    --query 'events[].message' --output text
```

### 1.3 CloudFormation Events

```bash
# All stack events
aws cloudformation describe-stack-events \
    --stack-name "$STACK_NAME" \
    --query 'StackEvents[:20].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' \
    --output table

# Only failed events
aws cloudformation describe-stack-events \
    --stack-name "$STACK_NAME" \
    --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].[Timestamp,LogicalResourceId,ResourceType,ResourceStatusReason]' \
    --output table
```

### 1.4 ECS/EKS Container Logs

```bash
# ECS Task logs (via CloudWatch)
aws logs get-log-events \
    --log-group-name "/ecs/$SERVICE_NAME" \
    --log-stream-name "ecs/$CONTAINER_NAME/$TASK_ID" \
    --limit 50

# EKS Pod logs
kubectl logs deployment/app --tail=100
kubectl logs deployment/app --previous  # Previous crashed container
kubectl describe pod -l app=app         # Events and status
```

### 1.5 Common Log Locations on EC2

| Log Type | Location | Description |
|----------|----------|-------------|
| Cloud-init | `/var/log/cloud-init-output.log` | UserData script output |
| Cloud-init errors | `/var/log/cloud-init.log` | Cloud-init process log |
| Application | `/var/log/app.log` | Application stdout/stderr |
| PM2 logs | `~/.pm2/logs/` | Node.js PM2 process logs |
| Nginx access | `/var/log/nginx/access.log` | HTTP request logs |
| Nginx error | `/var/log/nginx/error.log` | Nginx error log |
| System | `/var/log/messages` or `journalctl` | System messages |

---

## Section 2: CloudFormation Failure Diagnosis

### Pattern 1: CREATE_FAILED - IAM Permission Denied

**Symptom**:
```
Resource CREATE_FAILED: API: ec2:RunInstances You are not authorized to perform this operation
```

**Fix**:
```bash
# Option 1: Add required permissions to IAM user/role
# Option 2: Use AdministratorAccess for initial deployment (tighten later)
aws iam attach-user-policy \
    --user-name <USER> \
    --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

### Pattern 2: CREATE_FAILED - Service Quota Exceeded

**Symptom**:
```
Resource CREATE_FAILED: You have requested more vCPU capacity than your current vCPU limit
```

**Fix**:
```bash
# Check current quota
aws service-quotas get-service-quota \
    --service-code ec2 \
    --quota-code L-1216C47A  # Running On-Demand Standard instances

# Request increase
aws service-quotas request-service-quota-increase \
    --service-code ec2 \
    --quota-code L-1216C47A \
    --desired-value 20
```

### Pattern 3: CREATE_FAILED - Resource Already Exists

**Symptom**:
```
Resource CREATE_FAILED: <resource-name> already exists
```

**Fix**:
```bash
# Delete the conflicting resource, or use a different name in template
# For S3 buckets (globally unique):
aws s3 rb s3://<bucket-name> --force

# For security groups in same VPC:
aws ec2 delete-security-group --group-id sg-xxx
```

### Pattern 4: ROLLBACK_COMPLETE - Stack Stuck

**Symptom**:
```
Stack status: ROLLBACK_COMPLETE (cannot update or recreate)
```

**Fix**:
```bash
# Must delete the failed stack first
aws cloudformation delete-stack --stack-name "$STACK_NAME"
aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"

# Then fix the template and recreate
aws cloudformation create-stack \
    --stack-name "$STACK_NAME" \
    --template-body file:///tmp/stack.yaml \
    --capabilities CAPABILITY_IAM
```

### Pattern 5: CREATE_FAILED - AZ Not Supported

**Symptom**:
```
Resource CREATE_FAILED: <instance-type> is not available in <az>
```

**Fix**:
```bash
# Check which AZs support the instance type
aws ec2 describe-instance-type-offerings \
    --location-type availability-zone \
    --filters "Name=instance-type,Values=t3.micro" \
    --query 'InstanceTypeOfferings[].Location' --output text

# Update template to use a supported AZ
```

---

## Section 3: EC2 Deployment Issues

### Pattern 6: EC2 Instance Running But App Not Accessible

**Symptom**: EC2 running, SSH works, but `curl http://<IP>/` returns connection refused

**Investigation**:
```bash
ssh -i <KEY>.pem ec2-user@<IP> << 'CHECKEOF'
# Check if app is listening
ss -tlnp | grep -E ":80|:3000|:8080"

# Check if app process exists
ps aux | grep -E "node|python|java"
pm2 status 2>/dev/null

# Check app logs
tail -30 /var/log/app.log 2>/dev/null
pm2 logs --lines 30 --nostream 2>/dev/null
journalctl -u app -n 30 --no-pager 2>/dev/null
CHECKEOF
```

**Common Causes**:

| Cause | Diagnosis | Fix |
|-------|-----------|-----|
| App not started | No process listening | Start app: `pm2 start npm -- start` |
| Wrong port | App on 3000, SG only allows 80 | Add Nginx proxy or update SG |
| Security Group | Port 80 not open | `aws ec2 authorize-security-group-ingress` |
| Firewall (iptables) | iptables blocking | `iptables -F` (for testing) |
| node_modules missing | npm errors in log | `cd /app && npm install --production` |
| .env not configured | DB connection errors | `vi /app/.env` set passwords |

### Pattern 7: UserData Script Failure

**Symptom**: EC2 starts but app not deployed (cloud-init failed)

**Investigation**:
```bash
# Check cloud-init output
ssh -i <KEY>.pem ec2-user@<IP> 'cat /var/log/cloud-init-output.log | tail -50'

# Check cloud-init status
ssh -i <KEY>.pem ec2-user@<IP> 'cloud-init status'
# Expected: "status: done" with "errors: []"
# Problem: "status: error"
```

**Common Causes**:

| Cause | Log Pattern | Fix |
|-------|-------------|-----|
| Package not found | `No package nodejs available` | Use correct repo for AMI OS |
| Network timeout | `Could not retrieve mirrorlist` | Check VPC internet gateway / NAT |
| Permission denied | `Permission denied` | Script runs as root by default |
| Script syntax error | `syntax error` | Test script locally first |
| Encoding issue | `\r: command not found` | Save script with Unix line endings |

**Fix Template**:
```bash
# Run the deploy script manually after fixing
ssh -i <KEY>.pem ec2-user@<IP> << 'FIXEOF'
# Re-run deployment manually
cd /app

# Install Node.js (Amazon Linux 2023)
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs

# Install dependencies
npm install --production

# Start with PM2
npm install -g pm2
pm2 start npm --name app -- start
pm2 save
pm2 startup | tail -1 | bash
FIXEOF
```

### Pattern 8: EC2 Cannot Connect to RDS

**Symptom**: App starts but database connection fails

**Investigation**:
```bash
ssh -i <KEY>.pem ec2-user@<IP> << 'DBEOF'
# Test TCP connectivity to RDS
timeout 5 bash -c "echo > /dev/tcp/<RDS_ENDPOINT>/3306" && echo "OK" || echo "FAIL"

# Test with mysql client
mysql -h <RDS_ENDPOINT> -u dbadmin -p<PASSWORD> -e "SELECT 1"

# Check if RDS endpoint resolves
nslookup <RDS_ENDPOINT>
DBEOF
```

**Common Causes**:

| Cause | Fix |
|-------|-----|
| RDS SG doesn't allow EC2 SG | Add inbound rule: EC2 SG → RDS port |
| EC2 and RDS in different VPCs | Must be in same VPC or use peering |
| Wrong DB credentials | Check .env file, update password |
| RDS not yet available | Wait for RDS to finish creating |

---

## Section 4: EKS/Container Issues

### Pattern 9: Pod ImagePullBackOff

**Symptom**: `kubectl get pods` shows ImagePullBackOff

**Fix**:
```bash
# Re-authenticate with ECR
aws ecr get-login-password --region $REGION | \
    docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Verify image exists
aws ecr describe-images \
    --repository-name <REPO> \
    --query 'imageDetails[].imageTags' --output text

# Create/update pull secret for EKS
kubectl create secret docker-registry ecr-secret \
    --docker-server=$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com \
    --docker-username=AWS \
    --docker-password=$(aws ecr get-login-password --region $REGION)
```

### Pattern 10: Pod CrashLoopBackOff

**Symptom**: `kubectl get pods` shows CrashLoopBackOff

**Investigation**:
```bash
# Check pod logs
kubectl logs deployment/app --tail=50

# Check previous container logs (crashed)
kubectl logs deployment/app --previous --tail=50

# Check pod events
kubectl describe pod -l app=app | grep -A 20 "Events:"

# Check container exit code
kubectl get pods -o jsonpath='{.items[0].status.containerStatuses[0].lastState.terminated.exitCode}'
```

**Common Causes**:

| Exit Code | Cause | Fix |
|-----------|-------|-----|
| 1 | Application error | Check logs, fix code |
| 127 | Command not found | Fix CMD in Dockerfile |
| 137 | OOM Killed | Increase memory limits |
| 139 | Segfault | Debug application |

### Pattern 11: ALB Target Unhealthy

**Symptom**: ALB returns 502/503, targets show "unhealthy"

**Investigation**:
```bash
# Check target health
aws elbv2 describe-target-health \
    --target-group-arn "$TG_ARN" \
    --query 'TargetHealthDescriptions[].[Target.Id,TargetHealth.State,TargetHealth.Reason]' \
    --output table
```

**Common Causes**:

| Reason | Cause | Fix |
|--------|-------|-----|
| Target.NotRegistered | EC2 not in target group | Register target |
| Elb.InternalError | ALB config issue | Check listener rules |
| Target.Timeout | App too slow to respond | Increase health check timeout |
| Target.FailedHealthChecks | Wrong health check path | Update to `/` or `/health` |
| Target.NotInUse | AZ not enabled | Enable AZ on ALB |

---

## Section 5: Lambda Issues

### Pattern 12: Lambda Invocation Failure

**Symptom**: Lambda returns error or times out

**Investigation**:
```bash
# Check function configuration
aws lambda get-function-configuration \
    --function-name "$FUNC_NAME" \
    --query '{State:State,Runtime:Runtime,Timeout:Timeout,MemorySize:MemorySize}'

# Check recent invocation errors
aws logs filter-log-events \
    --log-group-name "/aws/lambda/$FUNC_NAME" \
    --filter-pattern "ERROR" \
    --limit 10

# Test invoke
aws lambda invoke \
    --function-name "$FUNC_NAME" \
    --payload '{"test": true}' \
    --log-type Tail \
    /tmp/response.json

# Decode log output
aws lambda invoke \
    --function-name "$FUNC_NAME" \
    --payload '{}' \
    --log-type Tail \
    /tmp/response.json \
    --query 'LogResult' --output text | base64 --decode
```

**Common Causes**:

| Error | Cause | Fix |
|-------|-------|-----|
| Timeout | Function runs too long | Increase timeout (max 900s) |
| OutOfMemory | Insufficient memory | Increase MemorySize |
| ModuleNotFoundError | Missing dependency | Include in deployment package |
| AccessDeniedException | IAM role missing permission | Update Lambda execution role |
| Handler not found | Wrong handler config | Verify handler path matches code |

---

## Section 6: Enhanced Verification Flow

### Step 6.1: Mandatory Health Check

```bash
verify_aws_deployment() {
    STACK_NAME="$1"
    PATTERN="$2"  # lite/standard/ha/elastic/serverless/container

    echo "=========================================="
    echo "  AWS Deployment Verification"
    echo "  Stack: $STACK_NAME"
    echo "  Pattern: $PATTERN"
    echo "=========================================="
    echo ""

    # Step 1: CloudFormation状態確認
    echo "[1/4] Checking CloudFormation stack..."
    STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].StackStatus' --output text 2>/dev/null)

    if [ "$STACK_STATUS" = "CREATE_COMPLETE" ] || [ "$STACK_STATUS" = "UPDATE_COMPLETE" ]; then
        echo "✅ Stack: $STACK_STATUS"
    else
        echo "❌ Stack: $STACK_STATUS"
        echo "[ACTION] Check stack events for root cause"
        return 1
    fi

    # Step 2: リソース固有チェック
    echo ""
    echo "[2/4] Checking resources..."

    case "$PATTERN" in
        lite|standard|ha|elastic)
            # EC2チェック
            INSTANCE_ID=$(aws cloudformation describe-stack-resources \
                --stack-name "$STACK_NAME" \
                --query 'StackResources[?ResourceType==`AWS::EC2::Instance`].PhysicalResourceId' --output text | head -1)
            if [ -n "$INSTANCE_ID" ]; then
                echo "EC2 Instance: $INSTANCE_ID"
                check_ec2_health "$INSTANCE_ID"
            fi

            # ALBチェック (standard/ha/elastic)
            TG_ARN=$(aws cloudformation describe-stack-resources \
                --stack-name "$STACK_NAME" \
                --query 'StackResources[?ResourceType==`AWS::ElasticLoadBalancingV2::TargetGroup`].PhysicalResourceId' --output text | head -1)
            if [ -n "$TG_ARN" ]; then
                check_alb_health "$TG_ARN"
            fi
            ;;
        serverless)
            FUNC_NAME=$(aws cloudformation describe-stack-resources \
                --stack-name "$STACK_NAME" \
                --query 'StackResources[?ResourceType==`AWS::Lambda::Function`].PhysicalResourceId' --output text | head -1)
            if [ -n "$FUNC_NAME" ]; then
                check_lambda_health "$FUNC_NAME"
            fi
            ;;
        container)
            check_eks_health
            ;;
    esac

    # Step 3: DB接続チェック
    echo ""
    echo "[3/4] Checking database connectivity..."
    RDS_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].Outputs[?OutputKey==`DBEndpoint`].OutputValue' --output text 2>/dev/null)

    if [ -n "$RDS_ENDPOINT" ] && [ "$RDS_ENDPOINT" != "None" ]; then
        echo "RDS Endpoint: $RDS_ENDPOINT"
        # Note: TCP check requires running from within VPC (EC2)
        echo "  [INFO] Verify DB connection from EC2 instance"
    else
        echo "  [SKIP] No RDS in this stack"
    fi

    # Step 4: 最終結果
    echo ""
    echo "[4/4] Final result..."
    echo "=========================================="
    echo "  Verification Complete"
    echo "=========================================="
}
```

---

## Fix Priority Order

1. **CRITICAL**: CloudFormation ROLLBACK → Fix template and redeploy
2. **CRITICAL**: Security Group blocking traffic → Open ports 80/443
3. **CRITICAL**: EC2 app not running → SSH and restart / fix UserData
4. **CRITICAL**: node_modules missing → SSH and npm install
5. **HIGH**: ALB target unhealthy → Fix health check path/port
6. **HIGH**: RDS connection failure → Check SG rules between EC2 and RDS
7. **HIGH**: EKS pod CrashLoopBackOff → Check logs and container config
8. **MEDIUM**: Lambda timeout → Increase timeout/memory
9. **MEDIUM**: CloudWatch Logs not configured → Add log agent

---

**Last Updated**: 2026-03-01
**Version**: 1.0
**Based on**: Azure deployment health issues v2.12, adapted for AWS services
