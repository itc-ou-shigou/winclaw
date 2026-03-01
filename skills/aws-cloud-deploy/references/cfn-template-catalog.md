# CloudFormation Template Catalog

Index of base CloudFormation templates in `assets/cfn-base-templates/`. Use this catalog to find the right template for each deployment pattern and understand template structure, parameters, and deployment commands.

---

## Quick Lookup by Architecture Pattern

| Pattern | Template File | Resource Count | Description | Typical Cost |
|---------|--------------|----------------|-------------|-------------|
| lite | `ec2-lite.yaml` | 5 core + VPC base | Single EC2 + VPC + SG + EIP | ~$13/mo |
| standard | `ec2-rds-standard.yaml` | 7 core + VPC base | EC2 + ALB + RDS | ~$40/mo |
| ha | `alb-asg-rds-ha.yaml` | 10 core + VPC base | ALB + ASG + Multi-AZ RDS | ~$92/mo |
| elastic | `asg-elasticache-elastic.yaml` | 12 core + VPC base | ASG + ElastiCache + CloudFront | ~$107/mo |
| serverless | `lambda-serverless.yaml` | 6 | Lambda + API Gateway + S3 | ~$1-10/mo |
| container | `eks-container.yaml` | 6 core + VPC base | EKS + ECR + Node Group | ~$156/mo |

### Composable Base Templates

| Template File | Resource Count | Description | Used With |
|--------------|----------------|-------------|-----------|
| `vpc-sg-base.yaml` | 4 | VPC + Subnets + IGW + Security Group | All EC2/EKS patterns |
| `rds-standalone.yaml` | 3 | RDS MySQL/PostgreSQL + DB Subnet Group | Any pattern needing a database |
| `elasticache-redis.yaml` | 3 | ElastiCache Redis replication group | Elastic pattern or standalone cache |
| `s3-bucket.yaml` | 1 | S3 bucket with server-side encryption | Any pattern needing object storage |

---

## Service Quick Lookup

Which template(s) contain each AWS service:

### Compute

| AWS Service | Template(s) |
|-------------|------------|
| EC2 Instance | `ec2-lite.yaml`, `ec2-rds-standard.yaml` |
| Launch Template | `alb-asg-rds-ha.yaml`, `asg-elasticache-elastic.yaml` |
| Auto Scaling Group | `alb-asg-rds-ha.yaml`, `asg-elasticache-elastic.yaml` |
| Scaling Policy | `alb-asg-rds-ha.yaml`, `asg-elasticache-elastic.yaml` |
| Lambda Function | `lambda-serverless.yaml` |
| EKS Cluster | `eks-container.yaml` |
| EKS Node Group | `eks-container.yaml` |

### Networking

| AWS Service | Template(s) |
|-------------|------------|
| VPC | all pattern templates, `vpc-sg-base.yaml` |
| Subnet | all pattern templates, `vpc-sg-base.yaml` |
| Internet Gateway | all pattern templates, `vpc-sg-base.yaml` |
| Route Table | all pattern templates, `vpc-sg-base.yaml` |
| NAT Gateway | `alb-asg-rds-ha.yaml`, `asg-elasticache-elastic.yaml`, `eks-container.yaml` |
| Security Group | all pattern templates, `vpc-sg-base.yaml` |
| Elastic IP | `ec2-lite.yaml`, `alb-asg-rds-ha.yaml` (for NAT) |

### Load Balancing & CDN

| AWS Service | Template(s) |
|-------------|------------|
| ALB (Application Load Balancer) | `ec2-rds-standard.yaml`, `alb-asg-rds-ha.yaml`, `asg-elasticache-elastic.yaml` |
| Target Group | `ec2-rds-standard.yaml`, `alb-asg-rds-ha.yaml`, `asg-elasticache-elastic.yaml` |
| Listener | `ec2-rds-standard.yaml`, `alb-asg-rds-ha.yaml`, `asg-elasticache-elastic.yaml` |
| CloudFront Distribution | `asg-elasticache-elastic.yaml` |

### Database & Cache

| AWS Service | Template(s) |
|-------------|------------|
| RDS Instance | `ec2-rds-standard.yaml`, `alb-asg-rds-ha.yaml`, `asg-elasticache-elastic.yaml`, `rds-standalone.yaml` |
| DB Subnet Group | `ec2-rds-standard.yaml`, `alb-asg-rds-ha.yaml`, `asg-elasticache-elastic.yaml`, `rds-standalone.yaml` |
| ElastiCache Replication Group | `asg-elasticache-elastic.yaml`, `elasticache-redis.yaml` |
| ElastiCache Subnet Group | `asg-elasticache-elastic.yaml`, `elasticache-redis.yaml` |
| DynamoDB Table | `lambda-serverless.yaml` (optional) |

### Storage & Registry

| AWS Service | Template(s) |
|-------------|------------|
| S3 Bucket | `lambda-serverless.yaml`, `s3-bucket.yaml` |
| ECR Repository | `eks-container.yaml` |

### Identity & Access

| AWS Service | Template(s) |
|-------------|------------|
| IAM Role (Lambda) | `lambda-serverless.yaml` |
| IAM Role (EKS Cluster) | `eks-container.yaml` |
| IAM Role (EKS Node) | `eks-container.yaml` |
| IAM Instance Profile | `ec2-lite.yaml`, `ec2-rds-standard.yaml`, `alb-asg-rds-ha.yaml`, `asg-elasticache-elastic.yaml` |

### API & Integration

| AWS Service | Template(s) |
|-------------|------------|
| API Gateway RestApi | `lambda-serverless.yaml` |
| API Gateway Resource | `lambda-serverless.yaml` |
| API Gateway Method | `lambda-serverless.yaml` |
| API Gateway Deployment | `lambda-serverless.yaml` |
| API Gateway Stage | `lambda-serverless.yaml` |
| Lambda Permission | `lambda-serverless.yaml` |

---

## Template Details

### ec2-lite.yaml

**Pattern**: lite
**Description**: Single EC2 instance with VPC, security group, and Elastic IP. Simplest production-capable deployment.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| InstanceType | String | t3.small | EC2 instance type |
| KeyPairName | String | (required) | EC2 key pair for SSH access |
| VpcCIDR | String | 10.0.0.0/16 | VPC CIDR block |
| SubnetCIDR | String | 10.0.1.0/24 | Public subnet CIDR |
| AMI | String | (region-dependent) | Amazon Linux 2023 AMI ID |

**Outputs**:
| Output | Value | Export Name |
|--------|-------|-------------|
| PublicIP | Elastic IP address | `${StackName}-PublicIP` |
| InstanceId | EC2 Instance ID | `${StackName}-InstanceId` |
| VpcId | VPC ID | `${StackName}-VpcId` |
| SecurityGroupId | Security Group ID | `${StackName}-SGId` |

**Security Group Rules**:
- Inbound: SSH (22) from 0.0.0.0/0, HTTP (80) from 0.0.0.0/0, HTTPS (443) from 0.0.0.0/0
- Outbound: All traffic

---

### ec2-rds-standard.yaml

**Pattern**: standard
**Description**: EC2 instance behind Application Load Balancer with RDS database in private subnets.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| InstanceType | String | t3.small | EC2 instance type |
| KeyPairName | String | (required) | EC2 key pair for SSH |
| DBEngine | String | mysql | Database engine (mysql, postgres) |
| DBInstanceClass | String | db.t3.micro | RDS instance class |
| DBName | String | appdb | Database name |
| DBUsername | String | admin | Master username |
| DBPassword | String (NoEcho) | (required) | Master password (user input) |
| VpcCIDR | String | 10.0.0.0/16 | VPC CIDR block |

**Outputs**:
| Output | Value | Export Name |
|--------|-------|-------------|
| ALBDNSName | ALB DNS name | `${StackName}-ALBDNS` |
| EC2PublicIP | EC2 public IP | `${StackName}-EC2IP` |
| RDSEndpoint | RDS endpoint address | `${StackName}-RDSEndpoint` |
| RDSPort | Database port | `${StackName}-RDSPort` |

**Security Group Chain**:
- ALB-SG: Inbound 80, 443 from 0.0.0.0/0
- App-SG: Inbound app port from ALB-SG; SSH (22) from 0.0.0.0/0
- DB-SG: Inbound 3306/5432 from App-SG only

---

### alb-asg-rds-ha.yaml

**Pattern**: ha
**Description**: Auto Scaling Group behind ALB with Multi-AZ RDS. Full high availability with automatic scaling.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| InstanceType | String | t3.small | Launch Template instance type |
| KeyPairName | String | (required) | EC2 key pair for SSH |
| MinSize | Number | 2 | ASG minimum instances |
| MaxSize | Number | 6 | ASG maximum instances |
| DesiredCapacity | Number | 2 | ASG desired instances |
| TargetCPU | Number | 70 | Target tracking CPU % |
| DBEngine | String | mysql | Database engine |
| DBInstanceClass | String | db.t3.small | RDS instance class |
| DBName | String | appdb | Database name |
| DBUsername | String | admin | Master username |
| DBPassword | String (NoEcho) | (required) | Master password |
| MultiAZ | String | true | Enable Multi-AZ RDS |
| VpcCIDR | String | 10.0.0.0/16 | VPC CIDR block |

**Outputs**:
| Output | Value | Export Name |
|--------|-------|-------------|
| ALBDNSName | ALB DNS name | `${StackName}-ALBDNS` |
| ASGName | Auto Scaling Group name | `${StackName}-ASGName` |
| LaunchTemplateId | Launch Template ID | `${StackName}-LTId` |
| RDSEndpoint | RDS endpoint | `${StackName}-RDSEndpoint` |
| RDSPort | Database port | `${StackName}-RDSPort` |

**Key Resources**:
- NAT Gateway in public subnet for private subnet outbound access
- Launch Template with UserData for instance bootstrap
- Target Tracking Scaling Policy (CPU-based)
- RDS with MultiAZ for automatic database failover

---

### asg-elasticache-elastic.yaml

**Pattern**: elastic
**Description**: Full production stack with ASG, ElastiCache Redis, and CloudFront CDN.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| InstanceType | String | t3.small | Launch Template instance type |
| KeyPairName | String | (required) | EC2 key pair |
| MinSize | Number | 2 | ASG minimum |
| MaxSize | Number | 10 | ASG maximum |
| DBEngine | String | mysql | Database engine |
| DBInstanceClass | String | db.t3.small | RDS instance class |
| DBPassword | String (NoEcho) | (required) | Master password |
| CacheNodeType | String | cache.t3.micro | ElastiCache node type |
| NumCacheNodes | Number | 2 | Redis replica count |
| CloudFrontPriceClass | String | PriceClass_100 | CDN price class |
| VpcCIDR | String | 10.0.0.0/16 | VPC CIDR |

**Outputs**:
| Output | Value | Export Name |
|--------|-------|-------------|
| CloudFrontDomain | CloudFront domain name | `${StackName}-CFDomain` |
| ALBDNSName | ALB DNS name | `${StackName}-ALBDNS` |
| RedisEndpoint | Redis primary endpoint | `${StackName}-RedisEndpoint` |
| RedisPort | Redis port (6379) | `${StackName}-RedisPort` |
| RDSEndpoint | RDS endpoint | `${StackName}-RDSEndpoint` |

**Additional Components**:
- ElastiCache Redis ReplicationGroup with automatic failover
- CloudFront Distribution with ALB as origin
- Cache Security Group allowing port 6379 from App-SG

---

### lambda-serverless.yaml

**Pattern**: serverless
**Description**: Serverless application with Lambda, API Gateway, and S3. Optional DynamoDB table.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| Runtime | String | nodejs20.x | Lambda runtime |
| Handler | String | index.handler | Lambda handler function |
| MemorySize | Number | 256 | Lambda memory (MB) |
| Timeout | Number | 30 | Lambda timeout (seconds) |
| StageName | String | prod | API Gateway stage name |
| EnableDynamoDB | String | false | Create DynamoDB table |
| DynamoDBTableName | String | AppData | DynamoDB table name |

**Outputs**:
| Output | Value | Export Name |
|--------|-------|-------------|
| ApiUrl | API Gateway invoke URL | `${StackName}-ApiUrl` |
| FunctionName | Lambda function name | `${StackName}-FunctionName` |
| FunctionArn | Lambda ARN | `${StackName}-FunctionArn` |
| S3BucketName | Code bucket name | `${StackName}-S3Bucket` |
| DynamoDBTable | Table name (if enabled) | `${StackName}-DynamoDB` |

**IAM Role Policies**:
- AWSLambdaBasicExecutionRole (CloudWatch Logs)
- S3 read access to code bucket
- DynamoDB CRUD access (if enabled)

**API Gateway Configuration**:
- REST API with `{proxy+}` catch-all resource
- ANY method with AWS_PROXY integration
- Single deployment stage

---

### eks-container.yaml

**Pattern**: container
**Description**: EKS Kubernetes cluster with managed node group and ECR repository.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| ClusterName | String | (required) | EKS cluster name |
| KubernetesVersion | String | 1.29 | Kubernetes version |
| NodeInstanceType | String | t3.medium | Node group instance type |
| NodeMinSize | Number | 2 | Node group minimum |
| NodeMaxSize | Number | 5 | Node group maximum |
| NodeDesiredSize | Number | 2 | Node group desired |
| VpcCIDR | String | 10.0.0.0/16 | VPC CIDR |
| ECRRepoName | String | app | ECR repository name |

**Outputs**:
| Output | Value | Export Name |
|--------|-------|-------------|
| ClusterName | EKS cluster name | `${StackName}-ClusterName` |
| ClusterEndpoint | EKS API server endpoint | `${StackName}-ClusterEndpoint` |
| ECRRepositoryUri | ECR repository URI | `${StackName}-ECRUri` |
| NodeGroupName | Managed node group name | `${StackName}-NodeGroup` |
| ClusterSecurityGroup | Cluster security group ID | `${StackName}-ClusterSG` |

**IAM Roles**:
- EKS Cluster Role: AmazonEKSClusterPolicy, AmazonEKSVPCResourceController
- Node Group Role: AmazonEKSWorkerNodePolicy, AmazonEKS_CNI_Policy, AmazonEC2ContainerRegistryReadOnly

**VPC Configuration**:
- 2 public subnets (EKS API, load balancers)
- 2 private subnets (worker nodes)
- NAT Gateway for node outbound access
- Kubernetes subnet tags applied automatically

---

### vpc-sg-base.yaml

**Pattern**: (base component)
**Description**: Standalone VPC with public and private subnets, Internet Gateway, and security group. Use as a foundation template.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| VpcCIDR | String | 10.0.0.0/16 | VPC CIDR |
| PublicSubnetACIDR | String | 10.0.1.0/24 | Public subnet A |
| PublicSubnetBCIDR | String | 10.0.2.0/24 | Public subnet B |
| PrivateSubnetACIDR | String | 10.0.11.0/24 | Private subnet A |
| PrivateSubnetBCIDR | String | 10.0.12.0/24 | Private subnet B |
| AllowedSSHCIDR | String | 0.0.0.0/0 | SSH source CIDR |

**Outputs**:
| Output | Value | Export Name |
|--------|-------|-------------|
| VpcId | VPC ID | `${StackName}-VpcId` |
| PublicSubnetA | Subnet ID | `${StackName}-PublicSubnetA` |
| PublicSubnetB | Subnet ID | `${StackName}-PublicSubnetB` |
| PrivateSubnetA | Subnet ID | `${StackName}-PrivateSubnetA` |
| PrivateSubnetB | Subnet ID | `${StackName}-PrivateSubnetB` |
| SecurityGroupId | SG ID | `${StackName}-SGId` |

**Use for cross-stack references**: Import VPC outputs into other stacks via `Fn::ImportValue`.

---

### rds-standalone.yaml

**Pattern**: (base component)
**Description**: Standalone RDS instance with DB subnet group. Requires existing VPC with private subnets.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| VpcId | String | (required) | Existing VPC ID |
| PrivateSubnetA | String | (required) | Private subnet A ID |
| PrivateSubnetB | String | (required) | Private subnet B ID |
| AppSecurityGroupId | String | (required) | App SG to allow DB access from |
| DBEngine | String | mysql | mysql or postgres |
| DBEngineVersion | String | 8.0 | Engine version |
| DBInstanceClass | String | db.t3.micro | Instance class |
| DBName | String | appdb | Database name |
| DBUsername | String | admin | Master username |
| DBPassword | String (NoEcho) | (required) | Master password |
| MultiAZ | String | false | Enable Multi-AZ |
| AllocatedStorage | Number | 20 | Storage in GB |

**Outputs**:
| Output | Value | Export Name |
|--------|-------|-------------|
| RDSEndpoint | Endpoint address | `${StackName}-RDSEndpoint` |
| RDSPort | Port number | `${StackName}-RDSPort` |
| DBInstanceId | RDS instance identifier | `${StackName}-DBInstanceId` |

---

### elasticache-redis.yaml

**Pattern**: (base component)
**Description**: Standalone ElastiCache Redis replication group. Requires existing VPC with private subnets.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| VpcId | String | (required) | Existing VPC ID |
| PrivateSubnetA | String | (required) | Private subnet A ID |
| PrivateSubnetB | String | (required) | Private subnet B ID |
| AppSecurityGroupId | String | (required) | App SG to allow cache access from |
| CacheNodeType | String | cache.t3.micro | Cache node type |
| NumCacheClusters | Number | 2 | Number of cache nodes |
| EngineVersion | String | 7.0 | Redis engine version |

**Outputs**:
| Output | Value | Export Name |
|--------|-------|-------------|
| RedisEndpoint | Primary endpoint | `${StackName}-RedisEndpoint` |
| RedisPort | Port (6379) | `${StackName}-RedisPort` |
| ReplicationGroupId | Replication group ID | `${StackName}-RedisGroupId` |

---

### s3-bucket.yaml

**Pattern**: (base component)
**Description**: S3 bucket with server-side encryption and versioning.

**Parameters**:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| BucketName | String | (auto-generated) | Bucket name (globally unique) |
| EnableVersioning | String | Enabled | Versioning status |
| EncryptionType | String | AES256 | SSE-S3 (AES256) or aws:kms |

**Outputs**:
| Output | Value | Export Name |
|--------|-------|-------------|
| BucketName | Bucket name | `${StackName}-BucketName` |
| BucketArn | Bucket ARN | `${StackName}-BucketArn` |
| BucketDomainName | Bucket domain | `${StackName}-BucketDomain` |

---

## Template Structure Reference

Every CloudFormation template follows this structure:

```yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: "Brief description of what this template deploys"

# Optional: Metadata for CloudFormation console parameter grouping
Metadata:
  AWS::CloudFormation::Interface:
    ParameterGroups:
      - Label:
          default: "Network Configuration"
        Parameters:
          - VpcCIDR
      - Label:
          default: "Compute Configuration"
        Parameters:
          - InstanceType
          - KeyPairName

# Input parameters (user-configurable values)
Parameters:
  ParameterName:
    Type: String              # String, Number, List<Number>, CommaDelimitedList,
                              # AWS::EC2::KeyPair::KeyName, AWS::SSM::Parameter::Value<String>, etc.
    Default: "default-value"  # Optional default
    AllowedValues:            # Optional enumeration
      - value1
      - value2
    AllowedPattern: "[a-zA-Z0-9]*"  # Optional regex validation
    MinLength: 1                     # Optional string length validation
    MaxLength: 64
    MinValue: 1                      # Optional numeric range validation
    MaxValue: 100
    ConstraintDescription: "Must be..."  # Error message for validation failure
    Description: "Human-readable description"
    NoEcho: true              # Mask input (for passwords)

# Optional: Static lookup tables
Mappings:
  MapName:
    Key1:
      SubKey: Value
    Key2:
      SubKey: Value

# Optional: Conditional resource creation
Conditions:
  ConditionName: !Equals [!Ref SomeParam, "some-value"]
  IsProduction: !Equals [!Ref Environment, "production"]
  HasDatabase: !Not [!Equals [!Ref DBEngine, "none"]]

# Required: AWS resources to create
Resources:
  LogicalResourceId:
    Type: AWS::Service::Resource    # e.g., AWS::EC2::Instance
    DependsOn: [OtherResource]      # Optional explicit dependency
    Condition: ConditionName         # Optional: only create if condition is true
    DeletionPolicy: Retain           # Optional: Retain, Snapshot, or Delete (default)
    UpdateReplacePolicy: Retain      # Optional: behavior on resource replacement
    Properties:
      PropertyName: Value
      AnotherProperty: !Ref ParameterOrResource
      ComputedProperty: !GetAtt OtherResource.Attribute

# Optional: Values to return after stack creation
Outputs:
  OutputName:
    Description: "What this output provides"
    Value: !Ref Resource            # or !GetAtt Resource.Attribute
    Condition: ConditionName        # Optional: only output if condition true
    Export:
      Name: !Sub "${AWS::StackName}-OutputName"  # For cross-stack references
```

---

## Common Parameters Reference

Parameters shared across multiple templates:

| Parameter | Type | Default | Used In | Notes |
|-----------|------|---------|---------|-------|
| InstanceType | String | t3.small | EC2, ASG templates | AllowedValues should include t3.micro through t3.xlarge |
| DBInstanceClass | String | db.t3.small | RDS templates | AllowedValues: db.t3.micro through db.r6g.xlarge |
| DBEngine | String | mysql | RDS templates | mysql or postgres |
| DBPassword | String (NoEcho) | -- | RDS templates | Always NoEcho, never default, minimum 8 chars |
| DBUsername | String | admin | RDS templates | Master username |
| DBName | String | appdb | RDS templates | Initial database name |
| KeyPairName | AWS::EC2::KeyPair::KeyName | -- | EC2/ASG templates | Must exist in target region |
| VpcCIDR | String | 10.0.0.0/16 | All VPC templates | /16 recommended |
| CacheNodeType | String | cache.t3.micro | ElastiCache templates | cache.t3.micro is smallest |
| MultiAZ | String | false | RDS templates | true doubles RDS cost |

---

## Deployment Commands

### Create New Stack

```bash
# Step 1: Validate template syntax and references
aws cloudformation validate-template \
  --template-body file://template.yaml

# Step 2: Create stack
aws cloudformation create-stack \
  --stack-name my-app-stack \
  --template-body file://template.yaml \
  --parameters \
    ParameterKey=InstanceType,ParameterValue=t3.small \
    ParameterKey=KeyPairName,ParameterValue=my-key \
    ParameterKey=DBPassword,ParameterValue=<ASK_USER> \
  --capabilities CAPABILITY_IAM \
  --tags Key=Project,Value=MyApp Key=Environment,Value=production \
  --region us-east-1

# Step 3: Wait for completion (blocks until done)
aws cloudformation wait stack-create-complete \
  --stack-name my-app-stack

# Step 4: Retrieve outputs
aws cloudformation describe-stacks \
  --stack-name my-app-stack \
  --query 'Stacks[0].Outputs' \
  --output table
```

### Update Existing Stack

```bash
# Preview changes first (ALWAYS do this)
aws cloudformation create-change-set \
  --stack-name my-app-stack \
  --change-set-name update-preview \
  --template-body file://template-updated.yaml \
  --parameters ParameterKey=DBPassword,UsePreviousValue=true \
  --capabilities CAPABILITY_IAM

# Review what will change
aws cloudformation describe-change-set \
  --stack-name my-app-stack \
  --change-set-name update-preview \
  --query 'Changes[].ResourceChange.{Action:Action,Resource:LogicalResourceId,Type:ResourceType,Replace:Replacement}'

# Execute change set (after user confirmation)
aws cloudformation execute-change-set \
  --stack-name my-app-stack \
  --change-set-name update-preview

# Wait for update
aws cloudformation wait stack-update-complete \
  --stack-name my-app-stack
```

### Delete Stack

```bash
# List resources that will be deleted
aws cloudformation list-stack-resources \
  --stack-name my-app-stack \
  --query 'StackResourceSummaries[].{Type:ResourceType,Id:PhysicalResourceId}' \
  --output table

# Empty S3 buckets first (CloudFormation cannot delete non-empty buckets)
aws s3 rm s3://<BUCKET_NAME> --recursive

# Delete stack
aws cloudformation delete-stack --stack-name my-app-stack

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name my-app-stack
```

### Useful Diagnostic Commands

```bash
# View stack events (for debugging creation/update)
aws cloudformation describe-stack-events \
  --stack-name my-app-stack \
  --query 'StackEvents[0:10].{Time:Timestamp,Resource:LogicalResourceId,Status:ResourceStatus,Reason:ResourceStatusReason}' \
  --output table

# View failed resources
aws cloudformation describe-stack-events \
  --stack-name my-app-stack \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`].{Resource:LogicalResourceId,Reason:ResourceStatusReason}' \
  --output table

# List all resources in stack
aws cloudformation describe-stack-resources \
  --stack-name my-app-stack \
  --query 'StackResources[].{Type:ResourceType,LogicalId:LogicalResourceId,PhysicalId:PhysicalResourceId,Status:ResourceStatus}' \
  --output table

# Get specific output value
aws cloudformation describe-stacks \
  --stack-name my-app-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
  --output text

# Export stack as JSON (for review)
aws cloudformation get-template \
  --stack-name my-app-stack \
  --query 'TemplateBody' > exported-template.yaml
```

---

## Template Validation Checklist

Before deploying any template, verify:

### Syntax and Structure

- [ ] `AWSTemplateFormatVersion` is `"2010-09-09"` (the only valid value)
- [ ] `Description` is present and meaningful
- [ ] YAML indentation is consistent (2 spaces recommended)
- [ ] No tabs used (YAML does not allow tabs for indentation)

### References and Dependencies

- [ ] All `!Ref` targets exist in Parameters or Resources sections
- [ ] All `!GetAtt` targets exist in Resources section
- [ ] All `!GetAtt` attribute names are valid for the resource type
- [ ] All `Fn::ImportValue` references exist in other deployed stacks
- [ ] `DependsOn` is correctly ordered where implicit dependencies are not sufficient
- [ ] Circular dependencies do not exist

### Security

- [ ] No hardcoded passwords (use `NoEcho` parameters or Secrets Manager)
- [ ] No hardcoded AWS credentials (use IAM roles instead)
- [ ] Security Groups do NOT expose database ports (3306, 5432, 6379) to 0.0.0.0/0
- [ ] SSH access (port 22) is restricted (ideally to specific CIDR, not 0.0.0.0/0)
- [ ] IAM roles follow least privilege (no `*` actions/resources unless necessary)
- [ ] RDS has `StorageEncrypted: true`
- [ ] S3 buckets have encryption enabled
- [ ] `PubliclyAccessible: false` for RDS instances

### Best Practices

- [ ] Resource limits not exceeded (500 resources per template; use nested stacks if needed)
- [ ] All resources have meaningful `Name` tags
- [ ] Outputs export values needed by other stacks or deployment phases
- [ ] Deletion policies set for stateful resources (RDS: Snapshot, S3: Retain)
- [ ] Parameters have `ConstraintDescription` for validation error messages
- [ ] Template passes `aws cloudformation validate-template` without errors

### Cost Awareness

- [ ] Instance types match the agreed budget (not oversized)
- [ ] Multi-AZ is only enabled when HA is required (doubles RDS cost)
- [ ] NAT Gateway count is minimized (1 for cost savings, 2 for HA)
- [ ] CloudFront PriceClass matches user's geographic needs
- [ ] EBS volume types are appropriate (gp3 default, not io2 unless needed)
- [ ] Auto Scaling minimums are not set too high for the expected traffic
