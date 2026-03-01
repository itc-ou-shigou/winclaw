# Solution Patterns - Resource Composition Guide

Resource dependency graphs, composition rules, and integration patterns for all 6 AWS architecture patterns.

---

## Core Resource Dependency Graph

Every pattern builds on a common VPC networking foundation. Resources must be created in dependency order; CloudFormation resolves this automatically via `!Ref` and `!GetAtt` references.

```
VPC (/16 CIDR)
 ├── InternetGateway
 │    └── VPCGatewayAttachment (links IGW to VPC)
 ├── Subnet (Public, /24 CIDR per AZ)
 │    ├── RouteTable
 │    │    ├── Route (0.0.0.0/0 → IGW)
 │    │    └── SubnetRouteTableAssociation
 │    └── [Optional] NATGateway (for private subnet outbound)
 ├── Subnet (Private, /24 CIDR per AZ)
 │    ├── RouteTable
 │    │    ├── Route (0.0.0.0/0 → NAT Gateway)
 │    │    └── SubnetRouteTableAssociation
 │    └── DBSubnetGroup (groups private subnets for RDS)
 └── SecurityGroup (ingress/egress rules)
      ├── EC2 Instance / Launch Template
      ├── ALB (Application Load Balancer)
      ├── RDS Instance
      ├── ElastiCache Cluster
      └── EKS Cluster / Node Group
```

### Key Dependency Rules

1. **VPC must exist** before any subnet, security group, or gateway
2. **InternetGateway + VPCGatewayAttachment** must exist before any Route referencing the IGW
3. **Subnets** must exist before any resource placed in them (EC2, RDS, ALB, etc.)
4. **SecurityGroups** must exist before resources that reference them
5. **DBSubnetGroup** must exist before RDS instances (requires 2+ subnets in different AZs)
6. **IAM Roles** must exist before resources that assume them (EC2 InstanceProfile, Lambda, EKS)

---

## Pattern 1: Lite

**Use Case**: Single-server deployment for development, staging, or low-traffic production (< 1,000 visits/day).

### Resource Dependency Graph

```
VPC (10.0.0.0/16)
 ├── InternetGateway
 │    └── VPCGatewayAttachment
 ├── PublicSubnet (10.0.1.0/24)
 │    ├── RouteTable
 │    │    ├── Route (0.0.0.0/0 → IGW)
 │    │    └── SubnetRouteTableAssociation
 │    └── EC2 Instance
 │         ├── SecurityGroup (ports 22, 80, 443)
 │         ├── EIP (Elastic IP)
 │         └── EIPAssociation
 └── SecurityGroup
```

### Resource Count: 9

| # | Resource Type | Logical Name | Purpose |
|---|---------------|-------------|---------|
| 1 | AWS::EC2::VPC | VPC | Virtual network |
| 2 | AWS::EC2::InternetGateway | IGW | Internet connectivity |
| 3 | AWS::EC2::VPCGatewayAttachment | IGWAttachment | Link IGW to VPC |
| 4 | AWS::EC2::Subnet | PublicSubnet | Instance placement |
| 5 | AWS::EC2::RouteTable | PublicRouteTable | Routing rules |
| 6 | AWS::EC2::Route | PublicRoute | Default route to IGW |
| 7 | AWS::EC2::SubnetRouteTableAssociation | SubnetRTAssoc | Link subnet to route table |
| 8 | AWS::EC2::SecurityGroup | InstanceSG | Firewall rules |
| 9 | AWS::EC2::Instance | WebServer | Application server |

Note: EIP and EIPAssociation are optional but recommended for stable public IP. If included, total becomes 11.

### Outputs

| Output | Value | Description |
|--------|-------|-------------|
| PublicIP | EC2 Public IP or EIP | Application access IP |
| InstanceId | EC2 Instance ID | For SSH/management |
| SecurityGroupId | SG ID | For rule modifications |
| VpcId | VPC ID | For adding resources later |

### Key Considerations

- **Single point of failure**: No redundancy; instance failure = downtime
- **Vertical scaling only**: Must stop instance to change type
- **EIP recommended**: Without EIP, public IP changes on stop/start
- **UserData**: Bootstrap script runs on first launch (install deps, deploy code, start app)
- **Instance types**: t3.micro (free tier), t3.small ($7.59/mo), t3.medium ($15.18/mo)
- **Storage**: Default 20 GB gp3 EBS; increase for apps with large assets

### UserData Bootstrap Example

```bash
#!/bin/bash
yum update -y
# Install Node.js (example)
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs git
# Clone and start app
cd /app && npm install && npm start
```

---

## Pattern 2: Standard

**Use Case**: Production deployment with database separation and load balancer (1,000-10,000 visits/day).

### Resource Dependency Graph

```
VPC (10.0.0.0/16)
 ├── InternetGateway
 │    └── VPCGatewayAttachment
 ├── PublicSubnet-A (10.0.1.0/24, AZ-a)
 │    ├── RouteTable + Route + Association
 │    └── EC2 Instance
 │         └── SecurityGroup (app ports)
 ├── PublicSubnet-B (10.0.2.0/24, AZ-b)
 │    ├── RouteTable + Route + Association
 │    └── ALB (Application Load Balancer)
 │         ├── SecurityGroup (ports 80, 443)
 │         ├── TargetGroup (health check: /)
 │         ├── Listener (port 80 → TargetGroup)
 │         └── TargetGroupAttachment (EC2 → TG)
 ├── PrivateSubnet-A (10.0.11.0/24, AZ-a)
 ├── PrivateSubnet-B (10.0.12.0/24, AZ-b)
 │    └── DBSubnetGroup
 │         └── RDS Instance
 │              └── SecurityGroup (port 3306/5432, source=AppSG)
 └── SecurityGroups (ALB-SG, App-SG, DB-SG)
```

### Resource Count: ~17

| # | Resource Type | Logical Name | Purpose |
|---|---------------|-------------|---------|
| 1-7 | VPC base | (same as Lite) | Networking foundation |
| 8 | AWS::EC2::Subnet | PublicSubnetB | Second AZ for ALB |
| 9 | AWS::EC2::Subnet | PrivateSubnetA | DB subnet AZ-a |
| 10 | AWS::EC2::Subnet | PrivateSubnetB | DB subnet AZ-b |
| 11 | AWS::ElasticLoadBalancingV2::LoadBalancer | ALB | Load balancer |
| 12 | AWS::ElasticLoadBalancingV2::TargetGroup | AppTG | Health checks + routing |
| 13 | AWS::ElasticLoadBalancingV2::Listener | HTTPListener | Port 80 listener |
| 14 | AWS::EC2::SecurityGroup | ALBSG | ALB firewall |
| 15 | AWS::EC2::SecurityGroup | DBSG | Database firewall |
| 16 | AWS::RDS::DBSubnetGroup | DBSubnetGroup | RDS subnet placement |
| 17 | AWS::RDS::DBInstance | Database | MySQL/PostgreSQL |

### Outputs

| Output | Value | Description |
|--------|-------|-------------|
| ALBDNSName | ALB DNS name | Application URL |
| RDSEndpoint | RDS endpoint address | Database connection |
| RDSPort | 3306 or 5432 | Database port |
| EC2PublicIP | EC2 public IP | SSH access |

### Key Considerations

- **ALB requires 2+ AZ subnets**: Load balancer must span at least 2 availability zones
- **Security Group chaining**: ALB-SG allows 80/443 from 0.0.0.0/0; App-SG allows app port from ALB-SG only; DB-SG allows 3306/5432 from App-SG only
- **RDS in private subnets**: No direct internet access; connect through EC2/app only
- **ALB health checks**: Configure health check path, interval (30s), threshold (3), healthy codes (200)
- **Single EC2 instance**: Still a single point of failure for compute; upgrade to HA pattern for redundancy
- **ALB cost**: ~$16.43/mo base + $0.008/LCU-hour

---

## Pattern 3: HA (High Availability)

**Use Case**: Production with auto-scaling, multi-AZ redundancy (10,000-100,000 visits/day).

### Resource Dependency Graph

```
VPC (10.0.0.0/16)
 ├── InternetGateway + VPCGatewayAttachment
 ├── PublicSubnet-A (10.0.1.0/24, AZ-a)
 │    ├── RouteTable + Route + Association
 │    └── NATGateway-A (+ ElasticIP)
 ├── PublicSubnet-B (10.0.2.0/24, AZ-b)
 │    ├── RouteTable + Route + Association
 │    └── NATGateway-B (+ ElasticIP) [optional, for HA NAT]
 ├── PrivateSubnet-A (10.0.11.0/24, AZ-a)
 │    ├── RouteTable + Route (0.0.0.0/0 → NAT-A) + Association
 │    └── EC2 Instances (via Auto Scaling Group)
 ├── PrivateSubnet-B (10.0.12.0/24, AZ-b)
 │    ├── RouteTable + Route (0.0.0.0/0 → NAT-B) + Association
 │    └── EC2 Instances (via Auto Scaling Group)
 ├── ALB (in Public Subnets A + B)
 │    ├── SecurityGroup (80, 443 from 0.0.0.0/0)
 │    ├── TargetGroup
 │    └── Listener
 ├── LaunchTemplate
 │    ├── AMI ID, Instance Type, SecurityGroup
 │    └── UserData (bootstrap script)
 ├── AutoScalingGroup
 │    ├── References LaunchTemplate
 │    ├── References TargetGroup (ALB integration)
 │    ├── Min: 2, Max: 6, Desired: 2
 │    └── VPCZoneIdentifier: [PrivateSubnet-A, PrivateSubnet-B]
 ├── ScalingPolicy
 │    └── TargetTrackingScaling (CPU 70%)
 ├── DBSubnetGroup (PrivateSubnet-A + PrivateSubnet-B)
 │    └── RDS Instance (MultiAZ=true)
 │         └── SecurityGroup (3306/5432 from App-SG)
 └── SecurityGroups (ALB-SG, App-SG, DB-SG)
```

### Resource Count: ~25

| Category | Resources | Count |
|----------|-----------|-------|
| VPC/Networking | VPC, IGW, Attachment, 4 Subnets, 4 RouteTables, 4 Routes, 4 Associations | 18 |
| NAT Gateway | NAT Gateway + EIP (1 or 2) | 2-4 |
| Load Balancer | ALB, TargetGroup, Listener, ALB-SG | 4 |
| Compute | LaunchTemplate, ASG, ScalingPolicy | 3 |
| Database | DBSubnetGroup, RDS (MultiAZ), DB-SG | 3 |
| Security | App-SG | 1 |

### Auto Scaling Configuration

```yaml
AutoScalingGroup:
  Type: AWS::AutoScaling::AutoScalingGroup
  Properties:
    LaunchTemplate:
      LaunchTemplateId: !Ref LaunchTemplate
      Version: !GetAtt LaunchTemplate.LatestVersionNumber
    MinSize: 2
    MaxSize: 6
    DesiredCapacity: 2
    VPCZoneIdentifier:
      - !Ref PrivateSubnetA
      - !Ref PrivateSubnetB
    TargetGroupARNs:
      - !Ref AppTargetGroup
    HealthCheckType: ELB
    HealthCheckGracePeriod: 300
    Tags:
      - Key: Name
        Value: !Sub "${AWS::StackName}-asg-instance"
        PropagateAtLaunch: true

ScalingPolicy:
  Type: AWS::AutoScaling::ScalingPolicy
  Properties:
    AutoScalingGroupName: !Ref AutoScalingGroup
    PolicyType: TargetTrackingScaling
    TargetTrackingConfiguration:
      PredefinedMetricSpecification:
        PredefinedMetricType: ASGAverageCPUUtilization
      TargetValue: 70.0
```

### Outputs

| Output | Value | Description |
|--------|-------|-------------|
| ALBDNSName | ALB DNS name | Application URL |
| RDSEndpoint | RDS endpoint | Database connection |
| ASGName | ASG name | For scaling management |
| LaunchTemplateId | LT ID | For AMI updates |

### Key Considerations

- **Instances in private subnets**: NAT Gateway required for outbound internet (package installs, API calls)
- **NAT Gateway cost**: $32.40/mo per gateway + data processing; single NAT saves cost but creates AZ dependency
- **Multi-AZ RDS**: Automatic failover, synchronous replication, doubles cost
- **Session management**: Use ElastiCache Redis or DynamoDB for session state (not local instance storage)
- **Rolling updates**: Configure UpdatePolicy on ASG for zero-downtime deployments
- **Health check**: Use ELB health check type, not EC2 (catches app-level failures)

---

## Pattern 4: Elastic

**Use Case**: High-traffic production with caching layer and CDN (100,000+ visits/day).

### Resource Dependency Graph

```
(All HA Pattern resources)
 +
 ├── ElastiCache SubnetGroup (PrivateSubnet-A + PrivateSubnet-B)
 │    └── ElastiCache Redis ReplicationGroup
 │         ├── SecurityGroup (port 6379 from App-SG)
 │         ├── NumCacheClusters: 2 (primary + replica)
 │         └── AutomaticFailoverEnabled: true
 ├── CloudFront Distribution
 │    ├── Origin: ALB DNS Name
 │    ├── ViewerProtocolPolicy: redirect-to-https
 │    ├── CacheBehavior (TTL, forwarded headers)
 │    └── PriceClass: PriceClass_100 (US/EU only, cheapest)
 └── [Optional] WAF WebACL
      └── Association with CloudFront Distribution
```

### Additional Resources (beyond HA)

| # | Resource Type | Logical Name | Purpose |
|---|---------------|-------------|---------|
| 1 | AWS::ElastiCache::SubnetGroup | CacheSubnetGroup | Redis subnet placement |
| 2 | AWS::ElastiCache::ReplicationGroup | RedisCluster | In-memory cache |
| 3 | AWS::EC2::SecurityGroup | CacheSG | Redis firewall |
| 4 | AWS::CloudFront::Distribution | CDN | Edge caching + HTTPS |

### Total Resource Count: ~29

### ElastiCache Configuration

```yaml
RedisReplicationGroup:
  Type: AWS::ElastiCache::ReplicationGroup
  Properties:
    ReplicationGroupDescription: "Application cache"
    Engine: redis
    EngineVersion: "7.0"
    CacheNodeType: cache.t3.micro
    NumCacheClusters: 2
    AutomaticFailoverEnabled: true
    CacheSubnetGroupName: !Ref CacheSubnetGroup
    SecurityGroupIds:
      - !Ref CacheSecurityGroup
    AtRestEncryptionEnabled: true
    TransitEncryptionEnabled: true
```

### CloudFront Configuration

```yaml
CloudFrontDistribution:
  Type: AWS::CloudFront::Distribution
  Properties:
    DistributionConfig:
      Enabled: true
      Origins:
        - Id: ALBOrigin
          DomainName: !GetAtt ALB.DNSName
          CustomOriginConfig:
            HTTPPort: 80
            OriginProtocolPolicy: http-only
      DefaultCacheBehavior:
        TargetOriginId: ALBOrigin
        ViewerProtocolPolicy: redirect-to-https
        AllowedMethods: [GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE]
        CachedMethods: [GET, HEAD]
        ForwardedValues:
          QueryString: true
          Headers: [Host, Authorization]
          Cookies:
            Forward: whitelist
            WhitelistedNames: [session_id]
        DefaultTTL: 86400
        MaxTTL: 31536000
      PriceClass: PriceClass_100
```

### Outputs

| Output | Value | Description |
|--------|-------|-------------|
| CloudFrontDomain | CloudFront domain name | Primary access URL |
| ALBDNSName | ALB DNS | Direct backend access |
| RedisEndpoint | Primary endpoint | Cache connection string |
| RDSEndpoint | RDS endpoint | Database connection |

### Key Considerations

- **CloudFront + ALB**: CloudFront terminates TLS, forwards to ALB via HTTP; add custom header for origin verification
- **Cache invalidation**: Application must manage Redis cache TTLs; CloudFront invalidation costs $0.005/path after first 1,000/mo
- **Redis failover**: With MultiAZ replication, automatic failover takes 15-30 seconds
- **CloudFront PriceClass**: PriceClass_100 (US/EU, cheapest), PriceClass_200 (+ Asia), PriceClass_All (global)
- **WAF integration**: Attach WAF WebACL to CloudFront for rate limiting, SQL injection/XSS protection
- **Cost**: ElastiCache cache.t3.micro ~$12.17/mo; CloudFront ~$0.085/GB (first 10TB)

---

## Pattern 5: Serverless

**Use Case**: Event-driven APIs, microservices, low-to-variable traffic with pay-per-use pricing.

### Resource Dependency Graph

```
IAM Role (Lambda Execution)
 ├── Policy: AWSLambdaBasicExecutionRole
 ├── Policy: AmazonDynamoDBFullAccess (if DynamoDB)
 └── Policy: AmazonRDSDataFullAccess (if RDS Proxy)

S3 Bucket (Code/Assets storage)
 └── BucketPolicy (optional)

Lambda Function
 ├── Role: !GetAtt LambdaRole.Arn
 ├── Runtime: nodejs20.x / python3.12 / java21
 ├── Handler: index.handler
 ├── MemorySize: 256
 ├── Timeout: 30
 ├── Environment Variables
 └── VpcConfig (if accessing RDS/ElastiCache)

API Gateway RestApi
 ├── Resource (/{proxy+})
 │    └── Method (ANY)
 │         └── Integration (AWS_PROXY → Lambda)
 ├── Deployment
 │    └── Stage (prod)
 └── Lambda Permission
      └── Allows API Gateway to invoke Lambda

[Optional] DynamoDB Table
 ├── BillingMode: PAY_PER_REQUEST
 ├── KeySchema (partition key, sort key)
 └── GlobalSecondaryIndex (if needed)

[Optional] RDS + VPC (adds VPC networking from Lite pattern)
```

### Resource Count: 6-12

| # | Resource Type | Logical Name | Purpose |
|---|---------------|-------------|---------|
| 1 | AWS::IAM::Role | LambdaExecutionRole | Lambda permissions |
| 2 | AWS::Lambda::Function | AppFunction | Application code |
| 3 | AWS::ApiGateway::RestApi | Api | HTTP endpoint |
| 4 | AWS::ApiGateway::Resource | ProxyResource | Route definition |
| 5 | AWS::ApiGateway::Method | ProxyMethod | HTTP method handler |
| 6 | AWS::ApiGateway::Deployment | ApiDeployment | API deployment |
| 7 | AWS::ApiGateway::Stage | ProdStage | Production stage |
| 8 | AWS::Lambda::Permission | ApiGatewayPermission | Invoke permission |
| 9 | AWS::S3::Bucket | CodeBucket | Code storage |
| 10 | (Optional) AWS::DynamoDB::Table | DataTable | NoSQL data store |

### Lambda Configuration

```yaml
LambdaFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: !Sub "${AWS::StackName}-handler"
    Runtime: nodejs20.x
    Handler: index.handler
    Code:
      S3Bucket: !Ref CodeBucket
      S3Key: function.zip
    MemorySize: 256
    Timeout: 30
    Role: !GetAtt LambdaExecutionRole.Arn
    Environment:
      Variables:
        NODE_ENV: production
        TABLE_NAME: !Ref DataTable
    TracingConfig:
      Mode: Active
```

### API Gateway Integration

```yaml
ApiMethod:
  Type: AWS::ApiGateway::Method
  Properties:
    RestApiId: !Ref Api
    ResourceId: !Ref ProxyResource
    HttpMethod: ANY
    AuthorizationType: NONE
    Integration:
      Type: AWS_PROXY
      IntegrationHttpMethod: POST
      Uri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${LambdaFunction.Arn}/invocations"
```

### Outputs

| Output | Value | Description |
|--------|-------|-------------|
| ApiUrl | `https://{api-id}.execute-api.{region}.amazonaws.com/prod` | API endpoint |
| FunctionName | Lambda function name | For code updates |
| FunctionArn | Lambda ARN | For cross-service integration |
| S3Bucket | Bucket name | Code deployment target |

### Key Considerations

- **Cold starts**: First invocation after idle: 100ms (Python/Node), 1-10s (Java/C#); use Provisioned Concurrency for latency-sensitive APIs
- **Execution limits**: 15 min max timeout, 10 GB max memory, 6 MB payload (sync), 256 KB payload (async)
- **VPC considerations**: Lambda in VPC adds cold start time (+2-8s without VPC endpoints); needed for RDS/ElastiCache access
- **API Gateway types**: REST API (full features, $3.50/M requests), HTTP API (simpler, $1.00/M requests, recommended for most cases)
- **DynamoDB vs RDS**: DynamoDB for simple key-value; RDS via RDS Proxy for relational needs in Lambda
- **Cost**: Lambda free tier = 1M requests + 400,000 GB-seconds/mo; then $0.20/M requests + $0.0000166667/GB-second

---

## Pattern 6: Container

**Use Case**: Microservices, containerized workloads, team familiarity with Kubernetes (variable traffic).

### Resource Dependency Graph

```
VPC (10.0.0.0/16)
 ├── PublicSubnet-A + PublicSubnet-B
 │    ├── RouteTables + Routes (→ IGW)
 │    └── NATGateway (for private subnet outbound)
 ├── PrivateSubnet-A + PrivateSubnet-B
 │    ├── RouteTables + Routes (→ NAT)
 │    └── EKS Node Group instances
 └── InternetGateway + VPCGatewayAttachment

IAM Role (EKS Cluster)
 ├── AmazonEKSClusterPolicy
 └── AmazonEKSVPCResourceController

IAM Role (EKS Node Group)
 ├── AmazonEKSWorkerNodePolicy
 ├── AmazonEKS_CNI_Policy
 └── AmazonEC2ContainerRegistryReadOnly

EKS Cluster
 ├── RoleArn: !GetAtt ClusterRole.Arn
 ├── ResourcesVpcConfig:
 │    ├── SubnetIds: [PrivateSubnet-A, PrivateSubnet-B, PublicSubnet-A, PublicSubnet-B]
 │    └── SecurityGroupIds: [ClusterSG]
 └── Version: "1.29"

EKS NodeGroup
 ├── ClusterName: !Ref EKSCluster
 ├── NodeRole: !GetAtt NodeRole.Arn
 ├── InstanceTypes: [t3.medium]
 ├── ScalingConfig: { MinSize: 2, MaxSize: 5, DesiredSize: 2 }
 └── Subnets: [PrivateSubnet-A, PrivateSubnet-B]

ECR Repository
 └── RepositoryName: !Sub "${AWS::StackName}-app"

[Optional] RDS Instance (in private subnets, same as Standard pattern)
```

### Resource Count: ~20

| Category | Resources | Count |
|----------|-----------|-------|
| VPC/Networking | VPC, IGW, 4 Subnets, RouteTables, NAT | ~14 |
| IAM | Cluster Role, Node Role | 2 |
| EKS | Cluster, NodeGroup | 2 |
| ECR | Repository | 1 |
| Security | Cluster SG | 1 |
| Optional: RDS | DBSubnetGroup, RDS, DB-SG | +3 |

### Kubernetes Deployment Manifest (generated post-infra)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: app
          image: <ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/<REPO>:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
---
apiVersion: v1
kind: Service
metadata:
  name: app-svc
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app: web
```

### Outputs

| Output | Value | Description |
|--------|-------|-------------|
| ClusterName | EKS cluster name | For kubeconfig |
| ClusterEndpoint | EKS API endpoint | Cluster management |
| ECRRepositoryUri | ECR repo URI | Docker push target |
| NodeGroupName | Node group name | For scaling |

### Key Considerations

- **EKS control plane cost**: $73/mo fixed (no free tier)
- **Node group sizing**: t3.medium ($30.37/mo) recommended minimum; 2 nodes minimum for HA
- **Cluster Autoscaler vs Karpenter**: Karpenter (newer) provisions optimal instances faster
- **ECR costs**: $0.10/GB/mo storage; cross-region pull costs extra
- **Service type LoadBalancer**: Creates AWS NLB/ALB automatically; use AWS Load Balancer Controller for ALB ingress
- **EBS CSI Driver**: Required for persistent volumes (EBS-backed PVCs)
- **Fargate alternative**: Serverless pods, no node management, but higher per-pod cost and some limitations

---

## Cross-Pattern Integrations

These AWS services integrate with all or most patterns. Include them based on security tier and operational requirements.

### IAM Roles

| Pattern | Role Type | Trust Policy | Key Policies |
|---------|-----------|-------------|--------------|
| lite/standard | EC2 Instance Profile | ec2.amazonaws.com | S3, CloudWatch, SSM |
| ha/elastic | EC2 Instance Profile | ec2.amazonaws.com | S3, CloudWatch, SSM |
| serverless | Lambda Execution Role | lambda.amazonaws.com | CloudWatch Logs, DynamoDB, S3, RDS |
| container | EKS Cluster Role | eks.amazonaws.com | EKSClusterPolicy |
| container | EKS Node Role | ec2.amazonaws.com | EKSWorkerNodePolicy, CNI, ECR |

### EC2 Instance Profile Example

```yaml
InstanceRole:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Version: "2012-10-17"
      Statement:
        - Effect: Allow
          Principal:
            Service: ec2.amazonaws.com
          Action: sts:AssumeRole
    ManagedPolicyArns:
      - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
      - arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy

InstanceProfile:
  Type: AWS::IAM::InstanceProfile
  Properties:
    Roles:
      - !Ref InstanceRole
```

### KMS Encryption

| Service | Encryption Type | Default |
|---------|----------------|---------|
| RDS | Storage encryption (AES-256) | aws/rds managed key |
| S3 | Server-side encryption (SSE-S3 or SSE-KMS) | SSE-S3 |
| EBS | Volume encryption | aws/ebs managed key |
| ElastiCache | At-rest + in-transit | aws/elasticache managed key |
| EKS Secrets | Envelope encryption | Optional KMS key |

### CloudWatch Integration

```yaml
# Log Group (all patterns)
LogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: !Sub "/aws/${AWS::StackName}/application"
    RetentionInDays: 30

# CPU Alarm (EC2/ASG patterns)
CPUAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmDescription: "CPU > 80% for 5 minutes"
    MetricName: CPUUtilization
    Namespace: AWS/EC2
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 80
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref SNSTopic
    Dimensions:
      - Name: AutoScalingGroupName
        Value: !Ref AutoScalingGroup
```

### Secrets Manager

```yaml
DBSecret:
  Type: AWS::SecretsManager::Secret
  Properties:
    Name: !Sub "${AWS::StackName}/db-password"
    GenerateSecretString:
      SecretStringTemplate: '{"username": "admin"}'
      GenerateStringKey: "password"
      PasswordLength: 32
      ExcludeCharacters: '"@/\\'
```

Reference in RDS:

```yaml
RDSInstance:
  Properties:
    MasterUsername: !Sub "{{resolve:secretsmanager:${DBSecret}:SecretString:username}}"
    MasterUserPassword: !Sub "{{resolve:secretsmanager:${DBSecret}:SecretString:password}}"
```

### Systems Manager Parameter Store

```yaml
# Store configuration values
AppConfig:
  Type: AWS::SSM::Parameter
  Properties:
    Name: !Sub "/${AWS::StackName}/app/config"
    Type: String
    Value: '{"log_level": "info", "cache_ttl": 300}'

# Reference in other resources
# !Sub "{{resolve:ssm:/${AWS::StackName}/app/config}}"
```

---

## CloudFormation Intrinsic Functions Reference

### Frequently Used Functions

| Function | Syntax | Use Case | Example |
|----------|--------|----------|---------|
| !Ref | `!Ref LogicalId` | Reference parameter value or resource ID | `!Ref VPC` returns vpc-xxxx |
| !GetAtt | `!GetAtt Resource.Attribute` | Get resource attribute | `!GetAtt ALB.DNSName` |
| !Sub | `!Sub "string ${Var}"` | String substitution with variables | `!Sub "arn:aws:s3:::${BucketName}/*"` |
| !Join | `!Join [",", [list]]` | Concatenate strings with delimiter | `!Join [",", [!Ref SubnetA, !Ref SubnetB]]` |
| !Select | `!Select [index, list]` | Select item from list by index | `!Select [0, !GetAZs ""]` |
| !Split | `!Split [",", string]` | Split string into list | `!Split [",", "a,b,c"]` |
| !If | `!If [condition, trueVal, falseVal]` | Conditional value | `!If [IsProd, "t3.large", "t3.micro"]` |
| !Equals | `!Equals [a, b]` | Equality test for Conditions | `!Equals [!Ref Env, "production"]` |
| !Not | `!Not [condition]` | Negate condition | `!Not [!Equals [!Ref Env, "dev"]]` |
| !And | `!And [cond1, cond2]` | Logical AND | `!And [!Condition IsProd, !Condition HasDB]` |
| !Or | `!Or [cond1, cond2]` | Logical OR | `!Or [!Condition IsProd, !Condition IsStaging]` |
| !FindInMap | `!FindInMap [Map, Key1, Key2]` | Lookup in Mappings | `!FindInMap [RegionAMI, !Ref "AWS::Region", HVM64]` |
| !GetAZs | `!GetAZs ""` | Get AZs for current region | `!Select [0, !GetAZs ""]` |
| !Cidr | `!Cidr [block, count, bits]` | Generate CIDR blocks | `!Cidr [!GetAtt VPC.CidrBlock, 4, 8]` |
| !Base64 | `!Base64 value` | Base64 encode (for UserData) | `UserData: !Base64 !Sub \|...` |
| Fn::ImportValue | `!ImportValue ExportName` | Import cross-stack value | `!ImportValue "SharedVPC-VpcId"` |

### Pseudo Parameters

| Parameter | Value | Common Usage |
|-----------|-------|-------------|
| `AWS::AccountId` | 123456789012 | ARN construction, ECR URI |
| `AWS::Region` | us-east-1 | Multi-region templates, ARNs |
| `AWS::StackName` | my-stack | Resource naming, tagging |
| `AWS::StackId` | arn:aws:cloudformation:... | Unique stack identifier |
| `AWS::URLSuffix` | amazonaws.com | Endpoint construction (cn regions use amazonaws.com.cn) |
| `AWS::NoValue` | (removes property) | Conditional property removal with !If |
| `AWS::NotificationARNs` | [arn:...] | Stack notification ARNs |
| `AWS::Partition` | aws | ARN partition (aws, aws-cn, aws-us-gov) |

### Common Patterns

**Conditional resource creation:**

```yaml
Conditions:
  CreateDB: !Not [!Equals [!Ref DBEngine, "none"]]

Resources:
  Database:
    Type: AWS::RDS::DBInstance
    Condition: CreateDB
    Properties: ...
```

**Cross-stack references:**

```yaml
# Stack A (exports)
Outputs:
  VpcId:
    Value: !Ref VPC
    Export:
      Name: !Sub "${AWS::StackName}-VpcId"

# Stack B (imports)
Resources:
  Instance:
    Properties:
      VpcId: !ImportValue "StackA-VpcId"
```

**Dynamic AMI lookup via Mappings:**

```yaml
Mappings:
  RegionAMI:
    us-east-1:
      HVM64: ami-0c02fb55956c7d316
    us-west-2:
      HVM64: ami-0892d3c7ee96c0bf7
    ap-northeast-1:
      HVM64: ami-0bba69335379e17f8

Resources:
  Instance:
    Properties:
      ImageId: !FindInMap [RegionAMI, !Ref "AWS::Region", HVM64]
```

---

## Resource Limits and Quotas

| Resource | Default Limit | Can Increase |
|----------|--------------|-------------|
| CloudFormation resources per stack | 500 | Yes (via nested stacks) |
| CloudFormation stacks per account | 200 | Yes |
| VPCs per region | 5 | Yes |
| Subnets per VPC | 200 | Yes |
| Security Groups per VPC | 2,500 | Yes |
| Rules per Security Group | 60 inbound + 60 outbound | Yes |
| EIPs per region | 5 | Yes |
| EC2 instances (on-demand) | Varies by type | Yes |
| RDS instances per region | 40 | Yes |
| Lambda concurrent executions | 1,000 | Yes |
| EKS clusters per region | 100 | Yes |

### Nested Stacks (for >500 resources)

```yaml
# Parent stack
Resources:
  NetworkStack:
    Type: AWS::CloudFormation::Stack
    Properties:
      TemplateURL: https://s3.amazonaws.com/bucket/vpc-template.yaml
      Parameters:
        VpcCIDR: "10.0.0.0/16"

  ComputeStack:
    Type: AWS::CloudFormation::Stack
    DependsOn: NetworkStack
    Properties:
      TemplateURL: https://s3.amazonaws.com/bucket/compute-template.yaml
      Parameters:
        VpcId: !GetAtt NetworkStack.Outputs.VpcId
        SubnetId: !GetAtt NetworkStack.Outputs.SubnetId
```
