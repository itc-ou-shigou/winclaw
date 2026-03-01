# Deployment Checklist

Step-by-step checklist for AWS infrastructure provisioning, code deployment, verification, and post-deployment reporting.

---

## Pre-Deployment Checks

### 1. AWS CLI and Credentials

- [ ] AWS CLI v2 installed: `aws --version` (expect `aws-cli/2.x.x`)
- [ ] Credentials configured: `aws sts get-caller-identity` (expect AccountId, Arn, UserId)
- [ ] Correct region set: `aws configure get region` (expect target region, e.g., `us-east-1`)
- [ ] Sufficient IAM permissions for deployment (see IAM requirements below)

If credentials are not configured:

```bash
# Option 1: Configure default profile
aws configure
# Prompts: Access Key ID, Secret Access Key, Region, Output format

# Option 2: Use named profile
aws configure --profile deploy
export AWS_PROFILE=deploy

# Option 3: Environment variables (CI/CD)
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
export AWS_DEFAULT_REGION=us-east-1
```

### 2. IAM Permission Requirements

Minimum permissions needed by pattern:

| Pattern | IAM Permissions Required |
|---------|------------------------|
| All | cloudformation:*, ec2:Describe*, ec2:CreateVpc, ec2:CreateSubnet, ec2:CreateSecurityGroup, ec2:CreateInternetGateway, ec2:CreateRouteTable |
| lite | + ec2:RunInstances, ec2:AllocateAddress, ec2:AssociateAddress |
| standard | + elasticloadbalancing:*, rds:* |
| ha | + autoscaling:*, elasticloadbalancing:*, rds:* |
| elastic | + elasticache:*, cloudfront:* |
| serverless | + lambda:*, apigateway:*, s3:*, dynamodb:* (if used) |
| container | + eks:*, ecr:* |
| All (if IAM resources) | + iam:CreateRole, iam:AttachRolePolicy, iam:CreateInstanceProfile, iam:PassRole |

Quick permission check:

```bash
# Verify CloudFormation access
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE --max-items 1

# Verify EC2 access
aws ec2 describe-vpcs --max-items 1

# Verify IAM access (if template creates roles)
aws iam list-roles --max-items 1
```

### 3. EC2 Key Pair

Required for SSH access to EC2 instances (lite, standard, ha, elastic patterns):

```bash
# List existing key pairs
aws ec2 describe-key-pairs --query 'KeyPairs[].KeyName'

# Create new key pair
aws ec2 create-key-pair --key-name my-deploy-key \
  --query 'KeyMaterial' --output text > my-deploy-key.pem
chmod 400 my-deploy-key.pem
```

- [ ] Key pair exists in target region
- [ ] Private key file (.pem) is available locally
- [ ] File permissions are restrictive (chmod 400)

### 4. Workspace Analysis

- [ ] Project type detected (Node.js / Python / Java / Go / PHP / Static)
- [ ] Framework identified (Next.js, Express, Django, Spring Boot, etc.)
- [ ] Build command confirmed (npm run build, pip install, mvn package, etc.)
- [ ] Start command confirmed (npm start, gunicorn, java -jar, etc.)
- [ ] Application port identified (3000, 8080, 5000, etc.)
- [ ] Database migrations identified (if any)
- [ ] Environment variables documented (.env.example or similar)

### 5. Budget and Resource Confirmation

- [ ] Monthly budget approved by user
- [ ] Architecture pattern selected and confirmed
- [ ] Cost estimate presented and acknowledged
- [ ] Region selected

---

## Phase 3A: Infrastructure Deployment

### Option A: AWS CLI Deployment

#### Step 1: Validate Template

```bash
aws cloudformation validate-template \
  --template-body file://stack.yaml
```

Expected output:
```json
{
  "Parameters": [...],
  "Description": "...",
  "Capabilities": ["CAPABILITY_IAM"]
}
```

If validation fails:
- Check YAML syntax (indentation, colons, quotes)
- Verify all `!Ref` and `!GetAtt` targets exist
- Ensure resource type names are correct (e.g., `AWS::EC2::Instance` not `AWS::EC2::Instances`)
- Check parameter types match expected values

#### Step 2: Create Stack

```bash
aws cloudformation create-stack \
  --stack-name <PROJECT_NAME>-stack \
  --template-body file://stack.yaml \
  --parameters \
    ParameterKey=InstanceType,ParameterValue=t3.small \
    ParameterKey=DBPassword,ParameterValue=<USER_INPUT> \
    ParameterKey=KeyPairName,ParameterValue=<KEY_NAME> \
  --capabilities CAPABILITY_IAM \
  --tags Key=Project,Value=<PROJECT_NAME> Key=Environment,Value=production \
  --region <REGION>
```

Important flags:
- `--capabilities CAPABILITY_IAM` : Required if template creates IAM roles/policies
- `--capabilities CAPABILITY_NAMED_IAM` : Required if template creates IAM resources with custom names
- `--tags` : Always tag stacks for cost tracking and organization

#### Step 3: Wait for Completion

```bash
# Wait (blocks until complete or fails, ~5-20 minutes)
aws cloudformation wait stack-create-complete \
  --stack-name <PROJECT_NAME>-stack \
  --region <REGION>

# Alternative: Poll status manually
aws cloudformation describe-stacks \
  --stack-name <PROJECT_NAME>-stack \
  --query 'Stacks[0].StackStatus' \
  --output text
```

Expected final status: `CREATE_COMPLETE`

Failure statuses:
- `CREATE_FAILED` : A resource failed to create
- `ROLLBACK_IN_PROGRESS` : Stack is rolling back after failure
- `ROLLBACK_COMPLETE` : Rollback finished, stack in failed state

#### Step 4: Collect Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name <PROJECT_NAME>-stack \
  --query 'Stacks[0].Outputs' \
  --output table
```

Save outputs for Phase 3B:

```bash
aws cloudformation describe-stacks \
  --stack-name <PROJECT_NAME>-stack \
  --query 'Stacks[0].Outputs' \
  --output json > stack_outputs.json
```

### Option B: AWS Console Deployment

1. Navigate to: `https://console.aws.amazon.com/cloudformation/`
2. Click **Create stack** > **With new resources (standard)**
3. **Template source**: Upload a template file > Choose file > Select generated YAML
4. **Stack name**: Enter `<PROJECT_NAME>-stack`
5. **Parameters**: Fill in each parameter (ASK USER for passwords, never auto-fill)
6. **Configure stack options**: Add tags (Project, Environment)
7. **Review**: Check the "I acknowledge that AWS CloudFormation might create IAM resources" checkbox
8. Click **Submit**
9. Wait for status: **CREATE_COMPLETE** (monitor Events tab for progress)
10. Go to **Outputs** tab and collect all values

### Output Collection by Pattern

| Pattern | Key Outputs |
|---------|-------------|
| lite | EC2 PublicIP, InstanceId, SecurityGroupId, VpcId |
| standard | ALB DNSName, EC2 PublicIP, RDS Endpoint, RDS Port |
| ha | ALB DNSName, ASG Name, RDS Endpoint, LaunchTemplate ID |
| elastic | CloudFront Domain, ALB DNSName, Redis Endpoint, RDS Endpoint |
| serverless | API Gateway URL, Lambda Function Name, S3 Bucket Name |
| container | EKS Cluster Name, Cluster Endpoint, ECR Repository URI |

---

## Phase 3B: Code Deployment

### EC2-Based Patterns (lite, standard)

#### Step 1: Transfer Code

```bash
# SCP entire project
scp -i <KEY>.pem -r ./* ec2-user@<PUBLIC_IP>:/home/ec2-user/app/

# Alternative: Use rsync for incremental updates
rsync -avz -e "ssh -i <KEY>.pem" ./ ec2-user@<PUBLIC_IP>:/home/ec2-user/app/ \
  --exclude node_modules --exclude .git --exclude .env
```

#### Step 2: Execute Deployment

```bash
ssh -i <KEY>.pem ec2-user@<PUBLIC_IP> 'bash /home/ec2-user/app/deploy.sh'
```

Typical deploy.sh contents (generated by `generate_deploy_script.py`):

```bash
#!/bin/bash
set -e
cd /home/ec2-user/app

# Install dependencies
npm install --production  # Node.js
# pip install -r requirements.txt  # Python
# mvn package -DskipTests  # Java

# Set environment variables
export NODE_ENV=production
export PORT=3000
export DATABASE_URL="mysql://admin:<password>@<rds-endpoint>:3306/appdb"

# Start application with process manager
npm install -g pm2
pm2 start npm --name app -- start
pm2 save
pm2 startup
```

#### Step 3: Verify EC2 Deployment

```bash
# Check process is running
ssh -i <KEY>.pem ec2-user@<PUBLIC_IP> 'pm2 list'

# Check application port
ssh -i <KEY>.pem ec2-user@<PUBLIC_IP> 'curl -s localhost:3000'

# Check from outside
curl -s -o /dev/null -w "%{http_code}" http://<PUBLIC_IP_OR_ALB_DNS>/
```

### Auto Scaling Patterns (ha, elastic)

Auto Scaling Group instances bootstrap via LaunchTemplate UserData. No manual SCP needed.

**For code updates:**

Option 1: Create new AMI and update Launch Template

```bash
# Create AMI from configured instance
aws ec2 create-image --instance-id <INSTANCE_ID> --name "app-v2-$(date +%Y%m%d)"

# Update Launch Template with new AMI
aws ec2 create-launch-template-version \
  --launch-template-id <LT_ID> \
  --source-version 1 \
  --launch-template-data '{"ImageId":"<NEW_AMI_ID>"}'

# Trigger rolling update
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name <ASG_NAME> \
  --preferences '{"MinHealthyPercentage":50}'
```

Option 2: Use AWS CodeDeploy (recommended for production)

```bash
# Create deployment
aws deploy create-deployment \
  --application-name <APP_NAME> \
  --deployment-group-name <DG_NAME> \
  --s3-location bucket=<BUCKET>,key=app.zip,bundleType=zip
```

### Lambda (serverless)

```bash
# Package code
cd /path/to/project
zip -r function.zip . -x "*.git*" "node_modules/aws-sdk/*" "__pycache__/*"

# For Node.js with dependencies
npm install --production
zip -r function.zip . -x "*.git*"

# For Python with dependencies
pip install -r requirements.txt -t ./package
cd package && zip -r ../function.zip . && cd ..
zip -g function.zip lambda_function.py

# Deploy
aws lambda update-function-code \
  --function-name <FUNCTION_NAME> \
  --zip-file fileb://function.zip \
  --region <REGION>

# Verify deployment
aws lambda invoke \
  --function-name <FUNCTION_NAME> \
  --payload '{"httpMethod":"GET","path":"/"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/response.json

cat /tmp/response.json
```

### EKS Container (container)

#### Step 1: Authenticate with ECR

```bash
aws ecr get-login-password --region <REGION> | \
  docker login --username AWS --password-stdin \
  <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
```

#### Step 2: Build and Push Docker Image

```bash
# Build image
docker build -t <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<REPO>:latest .

# Tag with version
docker tag \
  <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<REPO>:latest \
  <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<REPO>:v1.0.0

# Push
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<REPO>:latest
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<REPO>:v1.0.0
```

#### Step 3: Configure kubectl

```bash
aws eks update-kubeconfig \
  --name <CLUSTER_NAME> \
  --region <REGION>

# Verify connection
kubectl get nodes
```

#### Step 4: Deploy to Kubernetes

```bash
# Create namespace (optional)
kubectl create namespace production

# Create secrets
kubectl create secret generic app-secrets \
  --from-literal=database-url="mysql://admin:<password>@<rds-endpoint>:3306/appdb" \
  -n production

# Apply deployment manifest
kubectl apply -f k8s-deploy.yml -n production

# Wait for rollout
kubectl rollout status deployment/app -n production

# Verify
kubectl get pods -n production
kubectl get svc -n production
```

---

## Phase 3C: Verification

### Health Check Commands

| Target | Command | Expected |
|--------|---------|----------|
| EC2 direct | `curl -s -o /dev/null -w "%{http_code}" http://<PUBLIC_IP>/` | 200 |
| ALB | `curl -s -o /dev/null -w "%{http_code}" http://<ALB_DNS>/` | 200 |
| CloudFront | `curl -s -o /dev/null -w "%{http_code}" https://<CF_DOMAIN>/` | 200 |
| API Gateway | `curl -s -o /dev/null -w "%{http_code}" https://<API_ID>.execute-api.<REGION>.amazonaws.com/prod/` | 200 |
| Lambda | `aws lambda invoke --function-name <NAME> /tmp/resp.json && cat /tmp/resp.json` | statusCode: 200 |
| EKS pods | `kubectl get pods -n production` | STATUS: Running |
| EKS service | `kubectl get svc -n production` | EXTERNAL-IP assigned |
| RDS | Check app logs for successful DB connection | No connection errors |

### Performance Baseline

After deployment, verify baseline metrics:

```bash
# Response time check (should be < 500ms)
curl -w "\n  DNS: %{time_namelookup}s\n  Connect: %{time_connect}s\n  TTFB: %{time_starttransfer}s\n  Total: %{time_total}s\n" \
  -o /dev/null -s http://<ENDPOINT>/

# EC2 CPU check (should be < 30% at idle)
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=<INSTANCE_ID> \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average

# RDS connection check
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=<DB_INSTANCE_ID> \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

### CloudWatch Logs Check

```bash
# Check for errors in recent logs
aws logs filter-log-events \
  --log-group-name "/aws/<STACK_NAME>/application" \
  --start-time $(date -u -d '10 minutes ago' +%s000) \
  --filter-pattern "ERROR" \
  --limit 10
```

### Verification Checklist

- [ ] Application URL returns HTTP 200
- [ ] Response time < 500ms
- [ ] CPU utilization < 30% at idle
- [ ] Memory usage < 60%
- [ ] No ERROR entries in CloudWatch Logs
- [ ] Database connection successful (if applicable)
- [ ] Redis cache connection successful (if applicable)
- [ ] Auto Scaling Group instances all Healthy (ha/elastic)
- [ ] All Kubernetes pods Running (container)
- [ ] SSL/HTTPS working (if configured)

---

## Post-Deployment Report Template

Present this report to the user after successful deployment:

```
+======================================================+
|           AWS DEPLOYMENT REPORT                       |
+======================================================+
| Stack Name:    <PROJECT_NAME>-stack                   |
| Region:        <REGION>                               |
| Status:        CREATE_COMPLETE                        |
| Pattern:       <PATTERN>                              |
| Deploy Time:   <DURATION>                             |
+======================================================+
| INFRASTRUCTURE                                        |
| +-- VPC:           vpc-xxxx (10.0.0.0/16)            |
| +-- Subnets:       <N>x public, <N>x private         |
| +-- Security Group: sg-xxxx                           |
| +-- Compute:       <type> (<instance-spec>)           |
| +-- Database:      <engine> (<instance-class>)        |
| +-- Cache:         Redis (<node-type>)                |
| +-- CDN:           CloudFront (<price-class>)         |
+======================================================+
| APPLICATION                                           |
| +-- Project:       <name> (<framework>)               |
| +-- Runtime:       <runtime> <version>                |
| +-- Port:          <port>                             |
| +-- Process:       <pm2|gunicorn|java -jar|...>       |
| +-- Health:        OK (HTTP 200, <response-time>ms)   |
+======================================================+
| ACCESS                                                |
| +-- App URL:       http://<endpoint>/                 |
| +-- SSH:           ssh -i <key>.pem ec2-user@<IP>     |
| +-- DB Endpoint:   <rds-endpoint>:<port>              |
| +-- DB Name:       <database-name>                    |
| +-- Cache:         <redis-endpoint>:6379              |
+======================================================+
| COST                                                  |
| +-- Estimated:     $XX.XX/month                       |
| +-- Breakdown:                                        |
|     +-- Compute:   $XX.XX/mo                          |
|     +-- Database:  $XX.XX/mo                          |
|     +-- Network:   $XX.XX/mo                          |
|     +-- Storage:   $XX.XX/mo                          |
|     +-- Other:     $XX.XX/mo                          |
+======================================================+
| NEXT STEPS                                            |
| +-- [ ] Custom domain (Route 53 / external DNS)       |
| +-- [ ] SSL certificate (ACM + ALB/CloudFront)        |
| +-- [ ] CloudWatch Alarms + SNS notifications         |
| +-- [ ] RDS automated backups verification            |
| +-- [ ] Review Security Groups (restrict SSH)         |
| +-- [ ] Set up CI/CD pipeline                         |
| +-- [ ] Enable AWS Config for compliance monitoring   |
+======================================================+
```

### Report Data Collection Commands

```bash
# Stack info
STACK_NAME="<PROJECT_NAME>-stack"
aws cloudformation describe-stacks --stack-name $STACK_NAME \
  --query 'Stacks[0].{Status:StackStatus,Created:CreationTime,Outputs:Outputs}'

# Resource list
aws cloudformation list-stack-resources --stack-name $STACK_NAME \
  --query 'StackResourceSummaries[].{Type:ResourceType,Id:PhysicalResourceId,Status:ResourceStatus}' \
  --output table

# VPC details
VPC_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME \
  --query 'Stacks[0].Outputs[?OutputKey==`VpcId`].OutputValue' --output text)
aws ec2 describe-vpcs --vpc-ids $VPC_ID \
  --query 'Vpcs[0].{VpcId:VpcId,CidrBlock:CidrBlock,State:State}'
```

---

## Troubleshooting Guide

### CloudFormation Deployment Failures

**Status: ROLLBACK_COMPLETE**

```bash
# View failure events
aws cloudformation describe-stack-events \
  --stack-name <STACK_NAME> \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].{Resource:LogicalResourceId,Reason:ResourceStatusReason}' \
  --output table
```

Common causes:
| Error | Cause | Fix |
|-------|-------|-----|
| `InsufficientInstanceCapacity` | No capacity for instance type in AZ | Change instance type or AZ |
| `VcpuLimitExceeded` | vCPU quota reached | Request limit increase or use smaller instances |
| `InvalidParameterValue` for AMI | AMI not found in region | Use region-specific AMI mapping |
| `InvalidKeyPair.NotFound` | Key pair not in target region | Create key pair in correct region |
| `LimitExceeded` for EIP | Exceeded 5 EIP limit | Release unused EIPs or request increase |
| `DBInstanceAlreadyExists` | RDS identifier already taken | Use unique stack name |
| `SubnetNotFound` | Subnet referenced before creation | Add DependsOn or fix !Ref |
| `Access Denied` | Missing IAM permissions | Verify deployer IAM policy |

**Recovery after ROLLBACK_COMPLETE:**

```bash
# Must delete failed stack before retrying
aws cloudformation delete-stack --stack-name <STACK_NAME>
aws cloudformation wait stack-delete-complete --stack-name <STACK_NAME>

# Fix the issue, then re-create
aws cloudformation create-stack ...
```

### EC2 Instance Unreachable

| Symptom | Check | Fix |
|---------|-------|-----|
| SSH timeout | Security Group ingress rules | Add rule: SSH (22) from your IP |
| SSH timeout | Route Table | Verify default route to IGW exists |
| SSH timeout | Subnet | Verify MapPublicIpOnLaunch=true or EIP attached |
| SSH "Permission denied" | Key pair mismatch | Verify correct .pem file for the key pair name |
| HTTP timeout | Security Group | Add rule: HTTP (80) from 0.0.0.0/0 |
| HTTP timeout | Application not running | SSH in and check `systemctl status` / `pm2 list` |
| HTTP timeout | Wrong port | Check app listens on 0.0.0.0, not 127.0.0.1 |

```bash
# Check Security Group rules
aws ec2 describe-security-groups --group-ids <SG_ID> \
  --query 'SecurityGroups[0].IpPermissions'

# Check Route Table
aws ec2 describe-route-tables --filters Name=vpc-id,Values=<VPC_ID> \
  --query 'RouteTables[].Routes'

# Check instance state
aws ec2 describe-instance-status --instance-ids <INSTANCE_ID>

# View system log (boot output)
aws ec2 get-console-output --instance-id <INSTANCE_ID> --output text
```

### RDS Connection Failures

| Symptom | Check | Fix |
|---------|-------|-----|
| Connection timeout | DB Security Group | Allow port 3306/5432 from App-SG |
| Connection timeout | DB in private subnet | Verify app is in same VPC; no direct internet access to private RDS |
| Connection timeout | DB not ready | Check RDS status is "available" |
| Access denied | Wrong credentials | Verify username/password match template parameters |
| Unknown database | DB not created | App must CREATE DATABASE on first connection |

```bash
# Check RDS status
aws rds describe-db-instances --db-instance-identifier <DB_ID> \
  --query 'DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint,Port:Endpoint.Port}'

# Check Security Group
aws rds describe-db-instances --db-instance-identifier <DB_ID> \
  --query 'DBInstances[0].VpcSecurityGroups'
```

### EKS Troubleshooting

| Symptom | Check | Fix |
|---------|-------|-----|
| `CrashLoopBackOff` | Container crash | `kubectl logs <pod>` - fix app errors |
| `ImagePullBackOff` | Cannot pull image | Verify ECR URI, check ECR auth, verify node IAM role has ECR access |
| `Pending` pods | No schedulable nodes | Check node group scaling, verify resource requests |
| `CreateContainerConfigError` | Missing secrets/configmaps | Create required secrets before deploying |
| No external IP on Service | No LB provisioned | Install AWS Load Balancer Controller or use NLB |

```bash
# Pod diagnostics
kubectl describe pod <POD_NAME> -n <NAMESPACE>
kubectl logs <POD_NAME> -n <NAMESPACE> --previous

# Node status
kubectl get nodes -o wide
kubectl describe node <NODE_NAME>

# Events
kubectl get events -n <NAMESPACE> --sort-by='.lastTimestamp'
```

### Lambda Troubleshooting

| Symptom | Check | Fix |
|---------|-------|-----|
| Timeout | Function duration | Increase Timeout (max 900s) |
| Out of memory | Memory usage | Increase MemorySize (128-10240 MB) |
| Permission denied | Execution role | Add required permissions to Lambda role |
| Module not found | Packaging error | Ensure all dependencies in deployment package |
| VPC timeout | No NAT/endpoints | Add NAT Gateway or VPC endpoints for AWS services |

```bash
# View recent invocations
aws logs tail /aws/lambda/<FUNCTION_NAME> --since 10m

# View function configuration
aws lambda get-function-configuration --function-name <FUNCTION_NAME>

# Test invoke
aws lambda invoke --function-name <FUNCTION_NAME> \
  --payload '{"test": true}' /tmp/response.json
cat /tmp/response.json
```

### ALB 502/504 Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 502 Bad Gateway | Target not responding | Check target instance health, app running on correct port |
| 502 Bad Gateway | Health check failing | Verify health check path returns 200 |
| 504 Gateway Timeout | Target too slow | Increase idle timeout, optimize app |
| 503 Service Unavailable | No healthy targets | Check ASG instances, verify app health |

```bash
# Check target health
aws elbv2 describe-target-health \
  --target-group-arn <TG_ARN>

# Check ALB access logs
aws s3 ls s3://<LOG_BUCKET>/AWSLogs/<ACCOUNT_ID>/elasticloadbalancing/<REGION>/
```

---

## Stack Update Procedure

When modifying deployed infrastructure:

```bash
# 1. Validate updated template
aws cloudformation validate-template --template-body file://stack-updated.yaml

# 2. Preview changes (ALWAYS do this before updating)
aws cloudformation create-change-set \
  --stack-name <STACK_NAME> \
  --change-set-name update-$(date +%Y%m%d%H%M) \
  --template-body file://stack-updated.yaml \
  --parameters ParameterKey=DBPassword,UsePreviousValue=true \
  --capabilities CAPABILITY_IAM

# 3. Review changes
aws cloudformation describe-change-set \
  --stack-name <STACK_NAME> \
  --change-set-name update-$(date +%Y%m%d%H%M) \
  --query 'Changes[].ResourceChange.{Action:Action,Resource:LogicalResourceId,Replacement:Replacement}'

# 4. Execute change set (after user approval)
aws cloudformation execute-change-set \
  --stack-name <STACK_NAME> \
  --change-set-name update-$(date +%Y%m%d%H%M)

# 5. Wait for completion
aws cloudformation wait stack-update-complete --stack-name <STACK_NAME>
```

**WARNING**: Some changes cause resource replacement (e.g., changing RDS engine, VPC CIDR). Always review the change set before executing.

---

## Stack Deletion Procedure

```bash
# 1. List stack resources (verify what will be deleted)
aws cloudformation list-stack-resources --stack-name <STACK_NAME> \
  --query 'StackResourceSummaries[].{Type:ResourceType,Id:PhysicalResourceId}' \
  --output table

# 2. Check for retained resources (S3 buckets with data, RDS snapshots)
# S3 buckets with DeletionPolicy: Retain will NOT be deleted

# 3. Empty S3 buckets first (if any, CloudFormation cannot delete non-empty buckets)
aws s3 rm s3://<BUCKET_NAME> --recursive

# 4. Delete stack
aws cloudformation delete-stack --stack-name <STACK_NAME>

# 5. Wait for completion
aws cloudformation wait stack-delete-complete --stack-name <STACK_NAME>

# 6. Verify deletion
aws cloudformation describe-stacks --stack-name <STACK_NAME> 2>&1 | \
  grep -q "does not exist" && echo "Stack deleted successfully"
```

**Post-deletion cleanup:**
- Release any unused Elastic IPs
- Delete unused EC2 key pairs
- Remove orphaned EBS snapshots
- Check for retained S3 buckets
- Remove RDS final snapshots if not needed
