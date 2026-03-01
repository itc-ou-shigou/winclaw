# AWS CloudFormation Resource Reference

This document provides a CloudFormation resource type reference for the AI deployment agent.
It covers all resource types used across the 6 architecture patterns, with key properties,
common values, and usage notes.

---

## Table of Contents

1. [Networking Resources](#networking-resources)
2. [Compute Resources](#compute-resources)
3. [Auto Scaling Resources](#auto-scaling-resources)
4. [Load Balancing Resources](#load-balancing-resources)
5. [Database Resources](#database-resources)
6. [Cache Resources](#cache-resources)
7. [Serverless Resources](#serverless-resources)
8. [Storage Resources](#storage-resources)
9. [IAM Resources](#iam-resources)
10. [Container Resources](#container-resources)
11. [CDN Resources](#cdn-resources)
12. [Monitoring Resources](#monitoring-resources)
13. [Instance Type Reference Tables](#instance-type-reference-tables)

---

## Networking Resources

### 1. AWS::EC2::VPC

Creates a Virtual Private Cloud.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| CidrBlock | String | Yes | IPv4 CIDR block (e.g., `10.0.0.0/16`) |
| EnableDnsSupport | Boolean | No | Enable DNS resolution (default: true) |
| EnableDnsHostnames | Boolean | No | Enable DNS hostnames (default: false) |
| Tags | List | No | Resource tags |

**Common Values**:

| CidrBlock | Usable IPs | Use Case |
|-----------|-----------|----------|
| 10.0.0.0/16 | 65,534 | Standard (recommended) |
| 10.0.0.0/20 | 4,094 | Small deployment |
| 172.16.0.0/16 | 65,534 | Alternative range |
| 192.168.0.0/16 | 65,534 | Alternative range |

**Example**:

```yaml
VPC:
  Type: AWS::EC2::VPC
  Properties:
    CidrBlock: 10.0.0.0/16
    EnableDnsSupport: true
    EnableDnsHostnames: true
    Tags:
      - Key: Name
        Value: !Sub '${AWS::StackName}-vpc'
```

> **Agent Note**: Always enable both DnsSupport and DnsHostnames. Many services
> (RDS, ELB, VPC Endpoints) require DNS hostnames to function correctly.

---

### 2. AWS::EC2::Subnet

Creates a subnet within a VPC.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| VpcId | String | Yes | Reference to VPC |
| CidrBlock | String | Yes | Subnet CIDR (must be within VPC CIDR) |
| AvailabilityZone | String | No | AZ for the subnet |
| MapPublicIpOnLaunch | Boolean | No | Auto-assign public IPs (default: false) |
| Tags | List | No | Resource tags |

**Common Subnet Layout** (for 10.0.0.0/16 VPC):

| Subnet | CIDR | Type | AZ | IPs |
|--------|------|------|----|-----|
| Public-A | 10.0.1.0/24 | Public | AZ-a | 254 |
| Public-B | 10.0.2.0/24 | Public | AZ-b | 254 |
| Private-A | 10.0.10.0/24 | Private | AZ-a | 254 |
| Private-B | 10.0.11.0/24 | Private | AZ-b | 254 |
| DB-A | 10.0.20.0/24 | Isolated | AZ-a | 254 |
| DB-B | 10.0.21.0/24 | Isolated | AZ-b | 254 |

**Example**:

```yaml
PublicSubnetA:
  Type: AWS::EC2::Subnet
  Properties:
    VpcId: !Ref VPC
    CidrBlock: 10.0.1.0/24
    AvailabilityZone: !Select [0, !GetAZs '']
    MapPublicIpOnLaunch: true
    Tags:
      - Key: Name
        Value: !Sub '${AWS::StackName}-public-a'

PrivateSubnetA:
  Type: AWS::EC2::Subnet
  Properties:
    VpcId: !Ref VPC
    CidrBlock: 10.0.10.0/24
    AvailabilityZone: !Select [0, !GetAZs '']
    MapPublicIpOnLaunch: false
    Tags:
      - Key: Name
        Value: !Sub '${AWS::StackName}-private-a'
```

> **Agent Note**: Use `!Select [0, !GetAZs '']` and `!Select [1, !GetAZs '']` for
> AZ selection. This automatically picks AZs in the deployment region.

---

### 3. AWS::EC2::InternetGateway

Creates an Internet Gateway for VPC internet access.

**Key Properties**: Only Tags. No other configuration needed.

**Example**:

```yaml
InternetGateway:
  Type: AWS::EC2::InternetGateway
  Properties:
    Tags:
      - Key: Name
        Value: !Sub '${AWS::StackName}-igw'
```

---

### 4. AWS::EC2::VPCGatewayAttachment

Attaches an Internet Gateway (or VPN Gateway) to a VPC.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| VpcId | String | Yes | Reference to VPC |
| InternetGatewayId | String | Conditional | Reference to IGW |
| VpnGatewayId | String | Conditional | Reference to VPN GW |

**Example**:

```yaml
GatewayAttachment:
  Type: AWS::EC2::VPCGatewayAttachment
  Properties:
    VpcId: !Ref VPC
    InternetGatewayId: !Ref InternetGateway
```

---

### 5. AWS::EC2::RouteTable

Creates a route table for a VPC.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| VpcId | String | Yes | Reference to VPC |
| Tags | List | No | Resource tags |

**Example**:

```yaml
PublicRouteTable:
  Type: AWS::EC2::RouteTable
  Properties:
    VpcId: !Ref VPC
    Tags:
      - Key: Name
        Value: !Sub '${AWS::StackName}-public-rt'
```

---

### 6. AWS::EC2::Route

Creates a route in a route table.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| RouteTableId | String | Yes | Reference to route table |
| DestinationCidrBlock | String | Yes | Destination CIDR |
| GatewayId | String | Conditional | IGW for public routes |
| NatGatewayId | String | Conditional | NAT GW for private routes |
| InstanceId | String | Conditional | NAT Instance |

**Example (Public Route)**:

```yaml
PublicRoute:
  Type: AWS::EC2::Route
  DependsOn: GatewayAttachment
  Properties:
    RouteTableId: !Ref PublicRouteTable
    DestinationCidrBlock: 0.0.0.0/0
    GatewayId: !Ref InternetGateway
```

**Example (Private Route via NAT)**:

```yaml
PrivateRoute:
  Type: AWS::EC2::Route
  Properties:
    RouteTableId: !Ref PrivateRouteTable
    DestinationCidrBlock: 0.0.0.0/0
    NatGatewayId: !Ref NATGateway
```

> **Agent Note**: Public routes use `DependsOn: GatewayAttachment` to ensure the IGW
> is attached before creating the route. This prevents intermittent deployment failures.

---

### 7. AWS::EC2::SubnetRouteTableAssociation

Associates a subnet with a route table.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| SubnetId | String | Yes | Reference to subnet |
| RouteTableId | String | Yes | Reference to route table |

**Example**:

```yaml
PublicSubnetARouteTableAssociation:
  Type: AWS::EC2::SubnetRouteTableAssociation
  Properties:
    SubnetId: !Ref PublicSubnetA
    RouteTableId: !Ref PublicRouteTable
```

---

### 8. AWS::EC2::SecurityGroup

Creates a security group (stateful firewall).

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| GroupDescription | String | Yes | Description (cannot be updated) |
| VpcId | String | Yes | Reference to VPC |
| SecurityGroupIngress | List | No | Inbound rules |
| SecurityGroupEgress | List | No | Outbound rules |
| Tags | List | No | Resource tags |

**Ingress/Egress Rule Properties**:

| Property | Type | Description |
|----------|------|-------------|
| IpProtocol | String | `tcp`, `udp`, `icmp`, or `-1` (all) |
| FromPort | Integer | Start port |
| ToPort | Integer | End port |
| CidrIp | String | Source/dest CIDR |
| SourceSecurityGroupId | String | Source SG (for SG-to-SG rules) |

**Common Security Group Configurations**:

```yaml
# ALB Security Group
ALBSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: ALB security group
    VpcId: !Ref VPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 80
        ToPort: 80
        CidrIp: 0.0.0.0/0
      - IpProtocol: tcp
        FromPort: 443
        ToPort: 443
        CidrIp: 0.0.0.0/0

# App Security Group (only from ALB)
AppSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: App security group
    VpcId: !Ref VPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 8080
        ToPort: 8080
        SourceSecurityGroupId: !Ref ALBSecurityGroup

# DB Security Group (only from App)
DBSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Database security group
    VpcId: !Ref VPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 5432
        ToPort: 5432
        SourceSecurityGroupId: !Ref AppSecurityGroup
```

**Common Ports**:

| Port | Protocol | Service |
|------|----------|---------|
| 22 | TCP | SSH |
| 80 | TCP | HTTP |
| 443 | TCP | HTTPS |
| 3000 | TCP | Node.js (Express, Next.js) |
| 3306 | TCP | MySQL / Aurora MySQL |
| 5432 | TCP | PostgreSQL / Aurora PostgreSQL |
| 6379 | TCP | Redis |
| 8080 | TCP | Java (Spring Boot, Tomcat) |
| 8443 | TCP | HTTPS alternative |
| 27017 | TCP | MongoDB |

> **Agent Rule**: Security groups should follow a layered model:
> ALB SG --> App SG --> DB SG. Each layer only allows traffic from the previous layer.
> Never allow direct internet access to database security groups.

---

### AWS::EC2::NatGateway (not in original list but commonly used)

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| AllocationId | String | Yes | EIP allocation ID |
| SubnetId | String | Yes | Must be in a PUBLIC subnet |

**Example**:

```yaml
NATGatewayEIP:
  Type: AWS::EC2::EIP
  DependsOn: GatewayAttachment
  Properties:
    Domain: vpc

NATGateway:
  Type: AWS::EC2::NatGateway
  Properties:
    AllocationId: !GetAtt NATGatewayEIP.AllocationId
    SubnetId: !Ref PublicSubnetA
    Tags:
      - Key: Name
        Value: !Sub '${AWS::StackName}-natgw'
```

---

## Compute Resources

### 9. AWS::EC2::Instance

Creates a single EC2 instance.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| InstanceType | String | Yes | Instance size (e.g., `t3.micro`) |
| ImageId | String | Yes | AMI ID |
| SubnetId | String | No | Subnet to launch in |
| SecurityGroupIds | List | No | List of SG IDs |
| KeyName | String | No | SSH key pair name |
| UserData | String | No | Base64-encoded startup script |
| IamInstanceProfile | String | No | Instance profile for IAM role |
| BlockDeviceMappings | List | No | EBS volume configuration |
| Tags | List | No | Resource tags |

**AMI ID Lookup (use SSM Parameter)**:

| OS | SSM Parameter Path |
|----|-------------------|
| Amazon Linux 2023 | `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64` |
| Amazon Linux 2023 ARM | `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64` |
| Amazon Linux 2 | `/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2` |
| Ubuntu 22.04 | `/aws/service/canonical/ubuntu/server/22.04/stable/current/amd64/hvm/ebs-gp2/ami-id` |
| Ubuntu 24.04 | `/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id` |

**Example**:

```yaml
Parameters:
  LatestAmiId:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64

Resources:
  EC2Instance:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: t3.small
      ImageId: !Ref LatestAmiId
      SubnetId: !Ref PublicSubnetA
      SecurityGroupIds:
        - !Ref AppSecurityGroup
      IamInstanceProfile: !Ref InstanceProfile
      BlockDeviceMappings:
        - DeviceName: /dev/xvda
          Ebs:
            VolumeSize: 20
            VolumeType: gp3
            Encrypted: true
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash
          yum update -y
          yum install -y docker
          systemctl start docker
          systemctl enable docker
      Tags:
        - Key: Name
          Value: !Sub '${AWS::StackName}-instance'
```

> **Agent Note**: Always use SSM Parameter for AMI IDs instead of hardcoding.
> Hardcoded AMIs become outdated and region-specific. The SSM parameter always
> resolves to the latest AMI in the deployment region.

---

### 10. AWS::EC2::EIP + AWS::EC2::EIPAssociation

Creates an Elastic IP and associates it with an instance.

**EIP Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| Domain | String | No | `vpc` for VPC EIPs (always use this) |

**EIPAssociation Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| AllocationId | String | Yes | EIP allocation ID |
| InstanceId | String | Conditional | EC2 instance ID |
| NetworkInterfaceId | String | Conditional | ENI ID |

**Example**:

```yaml
ElasticIP:
  Type: AWS::EC2::EIP
  DependsOn: GatewayAttachment
  Properties:
    Domain: vpc
    Tags:
      - Key: Name
        Value: !Sub '${AWS::StackName}-eip'

EIPAssociation:
  Type: AWS::EC2::EIPAssociation
  Properties:
    AllocationId: !GetAtt ElasticIP.AllocationId
    InstanceId: !Ref EC2Instance
```

> **Agent Note**: EIPs are free when associated with a running instance. An unattached
> EIP costs $3.65/month. Always clean up unused EIPs.

---

### 11. AWS::EC2::LaunchTemplate

Creates a launch template for Auto Scaling Groups.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| LaunchTemplateData | Object | Yes | Instance configuration |
| LaunchTemplateData.InstanceType | String | Yes | Instance size |
| LaunchTemplateData.ImageId | String | Yes | AMI ID |
| LaunchTemplateData.SecurityGroupIds | List | No | SG IDs |
| LaunchTemplateData.UserData | String | No | Base64 startup script |
| LaunchTemplateData.IamInstanceProfile | Object | No | Instance profile |
| LaunchTemplateData.BlockDeviceMappings | List | No | EBS config |
| LaunchTemplateData.MetadataOptions | Object | No | IMDSv2 settings |

**Example**:

```yaml
LaunchTemplate:
  Type: AWS::EC2::LaunchTemplate
  Properties:
    LaunchTemplateData:
      InstanceType: t3.medium
      ImageId: !Ref LatestAmiId
      SecurityGroupIds:
        - !Ref AppSecurityGroup
      IamInstanceProfile:
        Arn: !GetAtt InstanceProfile.Arn
      MetadataOptions:
        HttpTokens: required        # Enforce IMDSv2
        HttpEndpoint: enabled
      BlockDeviceMappings:
        - DeviceName: /dev/xvda
          Ebs:
            VolumeSize: 20
            VolumeType: gp3
            Encrypted: true
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash
          yum update -y
          # Install application
          aws s3 cp s3://${DeployBucket}/app.tar.gz /tmp/
          tar -xzf /tmp/app.tar.gz -C /opt/app
          cd /opt/app && ./start.sh
      TagSpecifications:
        - ResourceType: instance
          Tags:
            - Key: Name
              Value: !Sub '${AWS::StackName}-asg-instance'
```

> **Agent Note**: Always set `HttpTokens: required` in MetadataOptions to enforce IMDSv2.
> This prevents SSRF attacks from accessing instance metadata credentials.

---

## Auto Scaling Resources

### 12. AWS::AutoScaling::AutoScalingGroup

Creates an Auto Scaling Group.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| LaunchTemplate | Object | Yes | Reference to launch template |
| MinSize | String | Yes | Minimum instances |
| MaxSize | String | Yes | Maximum instances |
| DesiredCapacity | String | No | Initial instance count |
| TargetGroupARNs | List | No | ALB target group ARNs |
| VPCZoneIdentifier | List | Yes | Subnet IDs (multi-AZ) |
| HealthCheckType | String | No | `EC2` or `ELB` |
| HealthCheckGracePeriod | Integer | No | Seconds before health check |
| Tags | List | No | Tags (propagate to instances) |

**Example**:

```yaml
AutoScalingGroup:
  Type: AWS::AutoScaling::AutoScalingGroup
  Properties:
    LaunchTemplate:
      LaunchTemplateId: !Ref LaunchTemplate
      Version: !GetAtt LaunchTemplate.LatestVersionNumber
    MinSize: '2'
    MaxSize: '6'
    DesiredCapacity: '2'
    TargetGroupARNs:
      - !Ref TargetGroup
    VPCZoneIdentifier:
      - !Ref PublicSubnetA
      - !Ref PublicSubnetB
    HealthCheckType: ELB
    HealthCheckGracePeriod: 300
    Tags:
      - Key: Name
        Value: !Sub '${AWS::StackName}-asg'
        PropagateAtLaunch: true
  UpdatePolicy:
    AutoScalingRollingUpdate:
      MinInstancesInService: 1
      MaxBatchSize: 1
      PauseTime: PT5M
      WaitOnResourceSignals: false
```

> **Agent Note**: Always set `HealthCheckType: ELB` when using with an ALB.
> The default `EC2` check only verifies instance status, not application health.
> Set `HealthCheckGracePeriod` long enough for the application to start.

---

### 13. AWS::AutoScaling::ScalingPolicy

Creates a scaling policy for an ASG.

**Key Properties (Target Tracking)**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| AutoScalingGroupName | String | Yes | Reference to ASG |
| PolicyType | String | Yes | `TargetTrackingScaling` |
| TargetTrackingConfiguration | Object | Yes | Scaling target |
| TargetTrackingConfiguration.TargetValue | Double | Yes | Target metric value |
| TargetTrackingConfiguration.PredefinedMetricSpecification | Object | Conditional | AWS metric |

**Predefined Metrics**:

| Metric | Description | Typical Target |
|--------|-------------|---------------|
| ASGAverageCPUUtilization | Average CPU across instances | 60-70% |
| ASGAverageNetworkIn | Average bytes received | Varies |
| ASGAverageNetworkOut | Average bytes sent | Varies |
| ALBRequestCountPerTarget | Requests per target | 1000-5000 |

**Example**:

```yaml
CPUScalingPolicy:
  Type: AWS::AutoScaling::ScalingPolicy
  Properties:
    AutoScalingGroupName: !Ref AutoScalingGroup
    PolicyType: TargetTrackingScaling
    TargetTrackingConfiguration:
      PredefinedMetricSpecification:
        PredefinedMetricType: ASGAverageCPUUtilization
      TargetValue: 60.0
      ScaleInCooldown: 300
      ScaleOutCooldown: 60

RequestCountScalingPolicy:
  Type: AWS::AutoScaling::ScalingPolicy
  Properties:
    AutoScalingGroupName: !Ref AutoScalingGroup
    PolicyType: TargetTrackingScaling
    TargetTrackingConfiguration:
      PredefinedMetricSpecification:
        PredefinedMetricType: ALBRequestCountPerTarget
        ResourceLabel: !Sub
          - '${ALBFullName}/${TGFullName}'
          - ALBFullName: !GetAtt ALB.LoadBalancerFullName
            TGFullName: !GetAtt TargetGroup.TargetGroupFullName
      TargetValue: 1000.0
```

---

## Load Balancing Resources

### 14. AWS::ElasticLoadBalancingV2::LoadBalancer

Creates an Application or Network Load Balancer.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| Scheme | String | No | `internet-facing` or `internal` |
| Subnets | List | Yes | At least 2 subnets in different AZs |
| SecurityGroups | List | Conditional | Required for ALB, not NLB |
| Type | String | No | `application` (default) or `network` |
| IpAddressType | String | No | `ipv4` or `dualstack` |

**Example**:

```yaml
ALB:
  Type: AWS::ElasticLoadBalancingV2::LoadBalancer
  Properties:
    Name: !Sub '${AWS::StackName}-alb'
    Scheme: internet-facing
    Type: application
    Subnets:
      - !Ref PublicSubnetA
      - !Ref PublicSubnetB
    SecurityGroups:
      - !Ref ALBSecurityGroup
    Tags:
      - Key: Name
        Value: !Sub '${AWS::StackName}-alb'
```

---

### 15. AWS::ElasticLoadBalancingV2::TargetGroup

Creates a target group for load balancer routing.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| Port | Integer | Yes | Target port |
| Protocol | String | Yes | `HTTP` or `HTTPS` |
| VpcId | String | Yes | Reference to VPC |
| TargetType | String | No | `instance` (default), `ip`, or `lambda` |
| HealthCheckPath | String | No | Health check URL path |
| HealthCheckIntervalSeconds | Integer | No | Check interval (default: 30) |
| HealthyThresholdCount | Integer | No | Healthy threshold (default: 5) |
| UnhealthyThresholdCount | Integer | No | Unhealthy threshold (default: 2) |
| HealthCheckTimeoutSeconds | Integer | No | Timeout (default: 5) |
| Matcher | Object | No | HTTP codes for healthy (default: 200) |

**Example**:

```yaml
TargetGroup:
  Type: AWS::ElasticLoadBalancingV2::TargetGroup
  Properties:
    Name: !Sub '${AWS::StackName}-tg'
    Port: 8080
    Protocol: HTTP
    VpcId: !Ref VPC
    TargetType: instance
    HealthCheckPath: /health
    HealthCheckIntervalSeconds: 30
    HealthyThresholdCount: 2
    UnhealthyThresholdCount: 3
    HealthCheckTimeoutSeconds: 5
    Matcher:
      HttpCode: '200'
    TargetGroupAttributes:
      - Key: deregistration_delay.timeout_seconds
        Value: '30'
```

> **Agent Note**: Reduce deregistration_delay from default 300s to 30s for faster
> deployments. The default 5 minutes causes slow rolling updates.

---

### 16. AWS::ElasticLoadBalancingV2::Listener

Creates a listener on a load balancer.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| LoadBalancerArn | String | Yes | Reference to ALB |
| Port | Integer | Yes | Listener port |
| Protocol | String | Yes | `HTTP` or `HTTPS` |
| DefaultActions | List | Yes | Action(s) to take |
| Certificates | List | Conditional | Required for HTTPS |

**DefaultAction Types**:

| Type | Description |
|------|-------------|
| forward | Route to target group |
| redirect | HTTP redirect (e.g., HTTP --> HTTPS) |
| fixed-response | Return fixed HTTP response |

**Example (HTTP redirect to HTTPS)**:

```yaml
HTTPListener:
  Type: AWS::ElasticLoadBalancingV2::Listener
  Properties:
    LoadBalancerArn: !Ref ALB
    Port: 80
    Protocol: HTTP
    DefaultActions:
      - Type: redirect
        RedirectConfig:
          Protocol: HTTPS
          Port: '443'
          StatusCode: HTTP_301
```

**Example (HTTPS forward to target group)**:

```yaml
HTTPSListener:
  Type: AWS::ElasticLoadBalancingV2::Listener
  Properties:
    LoadBalancerArn: !Ref ALB
    Port: 443
    Protocol: HTTPS
    Certificates:
      - CertificateArn: !Ref ACMCertificate
    DefaultActions:
      - Type: forward
        TargetGroupArn: !Ref TargetGroup
```

---

## Database Resources

### 17. AWS::RDS::DBInstance

Creates an RDS database instance.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| Engine | String | Yes | Database engine |
| EngineVersion | String | No | Engine version |
| DBInstanceClass | String | Yes | Instance type |
| MasterUsername | String | Conditional | Admin username |
| MasterUserPassword | String | Conditional | Admin password |
| AllocatedStorage | Integer | Yes | Storage in GB |
| StorageType | String | No | `gp3`, `gp2`, `io1` |
| MultiAZ | Boolean | No | Multi-AZ deployment |
| VPCSecurityGroups | List | No | Security group IDs |
| DBSubnetGroupName | String | No | Subnet group name |
| StorageEncrypted | Boolean | No | Enable encryption |
| KmsKeyId | String | No | KMS key for encryption |
| BackupRetentionPeriod | Integer | No | Days to retain backups (0-35) |
| DeletionProtection | Boolean | No | Prevent accidental deletion |
| PubliclyAccessible | Boolean | No | Allow public access (default: false) |

**Engine and Version Reference**:

| Engine | Engine Value | Common Versions |
|--------|-------------|-----------------|
| MySQL | `mysql` | 8.0.35, 8.0.36, 8.0.37 |
| PostgreSQL | `postgres` | 14.10, 15.5, 16.1, 16.2 |
| MariaDB | `mariadb` | 10.6.16, 10.11.6, 11.4.2 |
| Aurora MySQL | `aurora-mysql` | 3.04.1, 3.05.2, 3.06.0 |
| Aurora PostgreSQL | `aurora-postgresql` | 14.10, 15.5, 16.1 |

**Example**:

```yaml
RDSInstance:
  Type: AWS::RDS::DBInstance
  DeletionPolicy: Snapshot
  Properties:
    Engine: postgres
    EngineVersion: '16.2'
    DBInstanceClass: db.t3.medium
    AllocatedStorage: 20
    StorageType: gp3
    MasterUsername: !Sub '{{resolve:secretsmanager:${DBSecret}:SecretString:username}}'
    MasterUserPassword: !Sub '{{resolve:secretsmanager:${DBSecret}:SecretString:password}}'
    MultiAZ: true
    StorageEncrypted: true
    VPCSecurityGroups:
      - !Ref DBSecurityGroup
    DBSubnetGroupName: !Ref DBSubnetGroup
    BackupRetentionPeriod: 14
    DeletionProtection: true
    PubliclyAccessible: false
    Tags:
      - Key: Name
        Value: !Sub '${AWS::StackName}-rds'
```

> **Agent Rules**:
> - Always set `PubliclyAccessible: false`
> - Always set `StorageEncrypted: true`
> - Always use Secrets Manager for MasterUserPassword (never plaintext)
> - Always set `DeletionPolicy: Snapshot` to prevent data loss on stack deletion
> - Set `DeletionProtection: true` for production databases
> - Use `gp3` storage type (cheaper and better performance than gp2)

---

### 18. AWS::RDS::DBSubnetGroup

Creates a DB subnet group for RDS placement.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| DBSubnetGroupDescription | String | Yes | Description |
| SubnetIds | List | Yes | At least 2 subnets in different AZs |

**Example**:

```yaml
DBSubnetGroup:
  Type: AWS::RDS::DBSubnetGroup
  Properties:
    DBSubnetGroupDescription: Private subnets for RDS
    SubnetIds:
      - !Ref PrivateSubnetA
      - !Ref PrivateSubnetB
    Tags:
      - Key: Name
        Value: !Sub '${AWS::StackName}-db-subnet-group'
```

---

## Cache Resources

### 19. AWS::ElastiCache::ReplicationGroup

Creates a Redis replication group (recommended over CacheCluster for production).

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| ReplicationGroupDescription | String | Yes | Description |
| Engine | String | No | `redis` (default) |
| EngineVersion | String | No | Redis version |
| CacheNodeType | String | Yes | Instance type |
| NumCacheClusters | Integer | No | Number of nodes (1=standalone, 2+=replica) |
| AutomaticFailoverEnabled | Boolean | No | Multi-AZ failover (needs 2+ nodes) |
| CacheSubnetGroupName | String | No | Subnet group |
| SecurityGroupIds | List | No | Security groups |
| AtRestEncryptionEnabled | Boolean | No | Encrypt data at rest |
| TransitEncryptionEnabled | Boolean | No | Encrypt in transit (TLS) |
| Port | Integer | No | Port (default: 6379) |

**Redis Version Reference**:

| Version | Notes |
|---------|-------|
| 7.1 | Latest, recommended for new deployments |
| 7.0 | Stable |
| 6.2 | Previous generation |
| 6.0 | Minimum recommended |

**Example (Production with Multi-AZ)**:

```yaml
RedisReplicationGroup:
  Type: AWS::ElastiCache::ReplicationGroup
  Properties:
    ReplicationGroupDescription: Redis cluster for session and cache
    Engine: redis
    EngineVersion: '7.1'
    CacheNodeType: cache.m6g.large
    NumCacheClusters: 2
    AutomaticFailoverEnabled: true
    CacheSubnetGroupName: !Ref CacheSubnetGroup
    SecurityGroupIds:
      - !Ref CacheSecurityGroup
    AtRestEncryptionEnabled: true
    TransitEncryptionEnabled: true
    Port: 6379
    Tags:
      - Key: Name
        Value: !Sub '${AWS::StackName}-redis'
```

**Example (Development, single node)**:

```yaml
RedisCluster:
  Type: AWS::ElastiCache::CacheCluster
  Properties:
    Engine: redis
    EngineVersion: '7.1'
    CacheNodeType: cache.t3.micro
    NumCacheNodes: 1
    CacheSubnetGroupName: !Ref CacheSubnetGroup
    VpcSecurityGroupIds:
      - !Ref CacheSecurityGroup
```

---

### 20. AWS::ElastiCache::SubnetGroup

Creates a subnet group for ElastiCache placement.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| Description | String | Yes | Description |
| SubnetIds | List | Yes | Private subnet IDs |

**Example**:

```yaml
CacheSubnetGroup:
  Type: AWS::ElastiCache::SubnetGroup
  Properties:
    Description: Private subnets for ElastiCache
    SubnetIds:
      - !Ref PrivateSubnetA
      - !Ref PrivateSubnetB
```

---

## Serverless Resources

### 21. AWS::Lambda::Function

Creates a Lambda function.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| Runtime | String | Conditional | Language runtime |
| Handler | String | Conditional | Entry point (file.function) |
| Code | Object | Yes | Code location (S3 or inline) |
| MemorySize | Integer | No | Memory in MB (128-10240, default: 128) |
| Timeout | Integer | No | Max execution seconds (1-900, default: 3) |
| Role | String | Yes | IAM execution role ARN |
| Environment | Object | No | Environment variables |
| Architectures | List | No | `x86_64` or `arm64` |
| EphemeralStorage | Object | No | /tmp size (512-10240 MB) |

**Runtime Reference**:

| Language | Runtime Value | Status |
|----------|--------------|--------|
| Node.js 22 | `nodejs22.x` | Current |
| Node.js 20 | `nodejs20.x` | Supported |
| Python 3.13 | `python3.13` | Current |
| Python 3.12 | `python3.12` | Supported |
| Java 21 | `java21` | Current |
| Java 17 | `java17` | Supported |
| .NET 8 | `dotnet8` | Current |
| Ruby 3.3 | `ruby3.3` | Current |
| Go | `provided.al2023` | Custom runtime |

**Example**:

```yaml
LambdaFunction:
  Type: AWS::Lambda::Function
  Properties:
    FunctionName: !Sub '${AWS::StackName}-api'
    Runtime: nodejs22.x
    Handler: index.handler
    Code:
      S3Bucket: !Ref DeployBucket
      S3Key: lambda/api.zip
    MemorySize: 256
    Timeout: 30
    Role: !GetAtt LambdaRole.Arn
    Architectures:
      - arm64
    Environment:
      Variables:
        TABLE_NAME: !Ref DynamoDBTable
        STAGE: production
```

> **Agent Note**: Use `arm64` architecture when possible. Graviton Lambda functions
> are ~20% cheaper and generally faster than x86_64. Most Node.js and Python code
> works without changes on ARM.

---

### 22. AWS::ApiGateway (REST API)

Creates a REST API with API Gateway.

**Resource Types**:

| Type | Purpose |
|------|---------|
| `AWS::ApiGateway::RestApi` | The API itself |
| `AWS::ApiGateway::Resource` | URL path segment |
| `AWS::ApiGateway::Method` | HTTP method on a resource |
| `AWS::ApiGateway::Deployment` | Deploy the API |
| `AWS::ApiGateway::Stage` | API stage (prod, dev) |

**Example (Complete REST API)**:

```yaml
RestApi:
  Type: AWS::ApiGateway::RestApi
  Properties:
    Name: !Sub '${AWS::StackName}-api'
    Description: REST API
    EndpointConfiguration:
      Types:
        - REGIONAL

UsersResource:
  Type: AWS::ApiGateway::Resource
  Properties:
    RestApiId: !Ref RestApi
    ParentId: !GetAtt RestApi.RootResourceId
    PathPart: users

GetUsersMethod:
  Type: AWS::ApiGateway::Method
  Properties:
    RestApiId: !Ref RestApi
    ResourceId: !Ref UsersResource
    HttpMethod: GET
    AuthorizationType: NONE
    Integration:
      Type: AWS_PROXY
      IntegrationHttpMethod: POST
      Uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${LambdaFunction.Arn}/invocations'

ApiDeployment:
  Type: AWS::ApiGateway::Deployment
  DependsOn:
    - GetUsersMethod
  Properties:
    RestApiId: !Ref RestApi

ApiStage:
  Type: AWS::ApiGateway::Stage
  Properties:
    RestApiId: !Ref RestApi
    DeploymentId: !Ref ApiDeployment
    StageName: prod
```

> **Agent Note**: For simpler APIs, consider `AWS::ApiGatewayV2::Api` (HTTP API)
> which is cheaper ($1/M requests vs $3.50/M) and simpler to configure.
> HTTP API is sufficient for most Lambda proxy integrations.

---

## Storage Resources

### 23. AWS::S3::Bucket

Creates an S3 bucket.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| BucketName | String | No | Globally unique name (auto-generated if omitted) |
| BucketEncryption | Object | No | Encryption configuration |
| PublicAccessBlockConfiguration | Object | No | Block public access |
| VersioningConfiguration | Object | No | Enable versioning |
| LifecycleConfiguration | Object | No | Lifecycle rules |
| CorsConfiguration | Object | No | CORS rules |

**Example**:

```yaml
AppBucket:
  Type: AWS::S3::Bucket
  DeletionPolicy: Retain
  Properties:
    BucketName: !Sub '${AWS::StackName}-assets-${AWS::AccountId}'
    BucketEncryption:
      ServerSideEncryptionConfiguration:
        - ServerSideEncryptionByDefault:
            SSEAlgorithm: AES256
    PublicAccessBlockConfiguration:
      BlockPublicAcls: true
      BlockPublicPolicy: true
      IgnorePublicAcls: true
      RestrictPublicBuckets: true
    VersioningConfiguration:
      Status: Enabled
    LifecycleConfiguration:
      Rules:
        - Id: TransitionToIA
          Status: Enabled
          Transitions:
            - StorageClass: STANDARD_IA
              TransitionInDays: 90
        - Id: DeleteOldVersions
          Status: Enabled
          NoncurrentVersionExpiration:
            NoncurrentDays: 30
```

> **Agent Rules**:
> - Always set `PublicAccessBlockConfiguration` with all 4 blocks enabled
> - Always enable `BucketEncryption`
> - Set `DeletionPolicy: Retain` to prevent accidental data loss
> - Use `${AWS::AccountId}` in bucket names for uniqueness
> - Never use just the stack name as bucket name (not globally unique)

---

## IAM Resources

### 24. AWS::IAM::Role

Creates an IAM role.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| AssumeRolePolicyDocument | Object | Yes | Trust policy (who can assume) |
| ManagedPolicyArns | List | No | AWS managed policy ARNs |
| Policies | List | No | Inline policies |
| Path | String | No | IAM path |

**Common Trust Policies**:

| Service | Principal |
|---------|-----------|
| EC2 | `ec2.amazonaws.com` |
| Lambda | `lambda.amazonaws.com` |
| ECS Tasks | `ecs-tasks.amazonaws.com` |
| EKS | `eks.amazonaws.com` |
| API Gateway | `apigateway.amazonaws.com` |
| CloudFormation | `cloudformation.amazonaws.com` |

**Example (Lambda Execution Role)**:

```yaml
LambdaRole:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            Service: lambda.amazonaws.com
          Action: sts:AssumeRole
    ManagedPolicyArns:
      - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    Policies:
      - PolicyName: DynamoDBAccess
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - dynamodb:GetItem
                - dynamodb:PutItem
                - dynamodb:Query
                - dynamodb:Scan
                - dynamodb:UpdateItem
                - dynamodb:DeleteItem
              Resource: !GetAtt DynamoDBTable.Arn
```

**Example (EC2 Instance Role)**:

```yaml
EC2Role:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            Service: ec2.amazonaws.com
          Action: sts:AssumeRole
    ManagedPolicyArns:
      - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
    Policies:
      - PolicyName: S3Access
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - s3:GetObject
              Resource: !Sub 'arn:aws:s3:::${AppBucket}/*'

EC2InstanceProfile:
  Type: AWS::IAM::InstanceProfile
  Properties:
    Roles:
      - !Ref EC2Role
```

> **Agent Note**: Always follow least privilege. Only grant the specific actions
> and resources needed. Never use `"Action": "*"` or `"Resource": "*"` in
> production policies.

---

## Container Resources

### 25. AWS::EKS::Cluster

Creates an EKS Kubernetes cluster.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| RoleArn | String | Yes | IAM role for EKS control plane |
| ResourcesVpcConfig | Object | Yes | VPC configuration |
| ResourcesVpcConfig.SubnetIds | List | Yes | Subnets for control plane ENIs |
| ResourcesVpcConfig.SecurityGroupIds | List | No | Additional SGs |
| ResourcesVpcConfig.EndpointPublicAccess | Boolean | No | Public API endpoint |
| ResourcesVpcConfig.EndpointPrivateAccess | Boolean | No | Private API endpoint |
| Version | String | No | Kubernetes version |

**Kubernetes Version Reference**:

| Version | Status | EOS (Standard Support) |
|---------|--------|----------------------|
| 1.31 | Current | ~Feb 2026 |
| 1.30 | Supported | ~Nov 2025 |
| 1.29 | Supported | ~Aug 2025 |
| 1.28 | Extended support | -- |

**Example**:

```yaml
EKSCluster:
  Type: AWS::EKS::Cluster
  Properties:
    Name: !Sub '${AWS::StackName}-cluster'
    Version: '1.31'
    RoleArn: !GetAtt EKSClusterRole.Arn
    ResourcesVpcConfig:
      SubnetIds:
        - !Ref PrivateSubnetA
        - !Ref PrivateSubnetB
      SecurityGroupIds:
        - !Ref ClusterSecurityGroup
      EndpointPublicAccess: true
      EndpointPrivateAccess: true
    Logging:
      ClusterLogging:
        EnabledTypes:
          - Type: api
          - Type: audit
          - Type: authenticator
```

---

### 26. AWS::EKS::Nodegroup

Creates a managed node group for EKS.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| ClusterName | String | Yes | Reference to EKS cluster |
| NodeRole | String | Yes | IAM role for worker nodes |
| ScalingConfig | Object | Yes | Min/max/desired node counts |
| InstanceTypes | List | No | EC2 instance types |
| Subnets | List | Yes | Subnet IDs for nodes |
| AmiType | String | No | AMI type for nodes |
| DiskSize | Integer | No | EBS volume size in GB |
| CapacityType | String | No | `ON_DEMAND` or `SPOT` |

**AMI Type Reference**:

| AMI Type | Architecture | OS |
|----------|-------------|-----|
| AL2023_x86_64_STANDARD | x86_64 | Amazon Linux 2023 |
| AL2023_ARM_64_STANDARD | ARM64 | Amazon Linux 2023 (Graviton) |
| AL2_x86_64 | x86_64 | Amazon Linux 2 |
| AL2_ARM_64 | ARM64 | Amazon Linux 2 (Graviton) |
| BOTTLEROCKET_x86_64 | x86_64 | Bottlerocket |
| BOTTLEROCKET_ARM_64 | ARM64 | Bottlerocket (Graviton) |

**Example**:

```yaml
NodeGroup:
  Type: AWS::EKS::Nodegroup
  Properties:
    ClusterName: !Ref EKSCluster
    NodegroupName: !Sub '${AWS::StackName}-workers'
    NodeRole: !GetAtt NodeRole.Arn
    ScalingConfig:
      MinSize: 2
      MaxSize: 6
      DesiredSize: 2
    InstanceTypes:
      - m6i.large
    Subnets:
      - !Ref PrivateSubnetA
      - !Ref PrivateSubnetB
    AmiType: AL2023_x86_64_STANDARD
    DiskSize: 30
    CapacityType: ON_DEMAND
```

---

### 27. AWS::ECR::Repository

Creates a container image repository.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| RepositoryName | String | No | Repository name |
| ImageScanningConfiguration | Object | No | Enable scan on push |
| EncryptionConfiguration | Object | No | Encryption settings |
| LifecyclePolicy | Object | No | Image cleanup rules |

**Example**:

```yaml
ECRRepository:
  Type: AWS::ECR::Repository
  Properties:
    RepositoryName: !Sub '${AWS::StackName}-app'
    ImageScanningConfiguration:
      ScanOnPush: true
    EncryptionConfiguration:
      EncryptionType: AES256
    LifecyclePolicy:
      LifecyclePolicyText: |
        {
          "rules": [
            {
              "rulePriority": 1,
              "description": "Keep last 10 images",
              "selection": {
                "tagStatus": "any",
                "countType": "imageCountMoreThan",
                "countNumber": 10
              },
              "action": {
                "type": "expire"
              }
            }
          ]
        }
```

---

## CDN Resources

### 28. AWS::CloudFront::Distribution

Creates a CloudFront distribution.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| DistributionConfig | Object | Yes | Distribution configuration |
| DistributionConfig.Origins | List | Yes | Origin servers |
| DistributionConfig.DefaultCacheBehavior | Object | Yes | Default routing |
| DistributionConfig.ViewerCertificate | Object | No | SSL configuration |
| DistributionConfig.Enabled | Boolean | Yes | Enable distribution |

**Example (S3 + ALB origins)**:

```yaml
CloudFrontDistribution:
  Type: AWS::CloudFront::Distribution
  Properties:
    DistributionConfig:
      Enabled: true
      DefaultRootObject: index.html
      Origins:
        - Id: S3Origin
          DomainName: !GetAtt StaticBucket.RegionalDomainName
          S3OriginConfig:
            OriginAccessIdentity: !Sub 'origin-access-identity/cloudfront/${OAI}'
        - Id: ALBOrigin
          DomainName: !GetAtt ALB.DNSName
          CustomOriginConfig:
            HTTPPort: 80
            HTTPSPort: 443
            OriginProtocolPolicy: https-only
      DefaultCacheBehavior:
        TargetOriginId: ALBOrigin
        ViewerProtocolPolicy: redirect-to-https
        CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6  # CachingOptimized
        AllowedMethods:
          - GET
          - HEAD
          - OPTIONS
          - PUT
          - POST
          - PATCH
          - DELETE
      CacheBehaviors:
        - PathPattern: /static/*
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6
          AllowedMethods:
            - GET
            - HEAD
      ViewerCertificate:
        AcmCertificateArn: !Ref ACMCertificate
        SslSupportMethod: sni-only
        MinimumProtocolVersion: TLSv1.2_2021
```

**Common Cache Policy IDs**:

| Policy | ID | Description |
|--------|----|-------------|
| CachingOptimized | `658327ea-f89d-4fab-a63d-7e88639e58f6` | Best for static content |
| CachingDisabled | `4135ea2d-6df8-44a3-9df3-4b5a84be39ad` | No caching (API proxy) |
| CachingOptimizedForUncompressed | `b2884449-e4de-46a7-ac36-70bc7f1ddd6d` | For uncompressed objects |

---

## Monitoring Resources

### 29. AWS::Logs::LogGroup

Creates a CloudWatch Log Group.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| LogGroupName | String | No | Log group name |
| RetentionInDays | Integer | No | Log retention period |
| KmsKeyId | String | No | KMS key for encryption |

**Retention Options** (days): 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653

**Example**:

```yaml
AppLogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: !Sub '/app/${AWS::StackName}'
    RetentionInDays: 30

EKSLogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: !Sub '/aws/eks/${AWS::StackName}-cluster/cluster'
    RetentionInDays: 14
```

> **Agent Note**: Always set RetentionInDays. Without it, logs are retained forever,
> leading to unexpected storage costs. 30 days is a good default for most applications.

---

### 30. AWS::CloudWatch::Alarm

Creates a CloudWatch alarm.

**Key Properties**:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| AlarmName | String | No | Alarm name |
| MetricName | String | Yes | CloudWatch metric name |
| Namespace | String | Yes | Metric namespace |
| Statistic | String | Conditional | `Average`, `Sum`, `Maximum`, `Minimum` |
| Period | Integer | Yes | Evaluation period in seconds |
| EvaluationPeriods | Integer | Yes | Number of periods to evaluate |
| Threshold | Double | Yes | Alarm threshold value |
| ComparisonOperator | String | Yes | Comparison operator |
| AlarmActions | List | No | SNS topic ARNs to notify |
| Dimensions | List | No | Metric dimensions |

**Comparison Operators**: `GreaterThanThreshold`, `GreaterThanOrEqualToThreshold`, `LessThanThreshold`, `LessThanOrEqualToThreshold`

**Example (CPU alarm)**:

```yaml
HighCPUAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub '${AWS::StackName}-high-cpu'
    AlarmDescription: CPU utilization exceeds 80%
    MetricName: CPUUtilization
    Namespace: AWS/EC2
    Statistic: Average
    Period: 300
    EvaluationPeriods: 2
    Threshold: 80
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref AlertSNSTopic
    Dimensions:
      - Name: AutoScalingGroupName
        Value: !Ref AutoScalingGroup

UnhealthyHostAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub '${AWS::StackName}-unhealthy-hosts'
    MetricName: UnHealthyHostCount
    Namespace: AWS/ApplicationELB
    Statistic: Maximum
    Period: 60
    EvaluationPeriods: 2
    Threshold: 0
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref AlertSNSTopic
    Dimensions:
      - Name: TargetGroup
        Value: !GetAtt TargetGroup.TargetGroupFullName
      - Name: LoadBalancer
        Value: !GetAtt ALB.LoadBalancerFullName

RDSHighCPUAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub '${AWS::StackName}-rds-high-cpu'
    MetricName: CPUUtilization
    Namespace: AWS/RDS
    Statistic: Average
    Period: 300
    EvaluationPeriods: 3
    Threshold: 80
    ComparisonOperator: GreaterThanThreshold
    AlarmActions:
      - !Ref AlertSNSTopic
    Dimensions:
      - Name: DBInstanceIdentifier
        Value: !Ref RDSInstance
```

---

## Instance Type Reference Tables

### EC2 Instance Types

| Instance | Family | vCPU | Memory | Network | Use Case | On-Demand $/mo |
|----------|--------|------|--------|---------|----------|----------------|
| t3.micro | General (burstable) | 2 | 1 GiB | Low-Moderate | Dev/test, free tier | $7.59 |
| t3.small | General (burstable) | 2 | 2 GiB | Low-Moderate | Light workloads | $15.18 |
| t3.medium | General (burstable) | 2 | 4 GiB | Low-Moderate | Small production | $30.37 |
| t3.large | General (burstable) | 2 | 8 GiB | Low-Moderate | Medium workloads | $60.74 |
| t3.xlarge | General (burstable) | 4 | 16 GiB | Moderate | Larger workloads | $121.47 |
| m6i.large | General (fixed) | 2 | 8 GiB | Up to 12.5 Gbps | General production | $69.35 |
| m6i.xlarge | General (fixed) | 4 | 16 GiB | Up to 12.5 Gbps | Medium production | $138.70 |
| m6i.2xlarge | General (fixed) | 8 | 32 GiB | Up to 12.5 Gbps | Large production | $277.40 |
| m6i.4xlarge | General (fixed) | 16 | 64 GiB | Up to 12.5 Gbps | Heavy production | $554.80 |
| c6i.large | Compute optimized | 2 | 4 GiB | Up to 12.5 Gbps | Compute intensive | $62.05 |
| c6i.xlarge | Compute optimized | 4 | 8 GiB | Up to 12.5 Gbps | Compute intensive | $124.10 |
| c6i.2xlarge | Compute optimized | 8 | 16 GiB | Up to 12.5 Gbps | Compute intensive | $248.20 |
| r6i.large | Memory optimized | 2 | 16 GiB | Up to 12.5 Gbps | Memory intensive | $91.98 |
| r6i.xlarge | Memory optimized | 4 | 32 GiB | Up to 12.5 Gbps | Memory intensive | $183.96 |
| r6i.2xlarge | Memory optimized | 8 | 64 GiB | Up to 12.5 Gbps | Memory intensive | $367.92 |

**Burstable vs Fixed Performance**:

| Type | Behavior | Best For |
|------|----------|----------|
| t3.* (burstable) | Baseline CPU + burst credits | Variable workloads, small apps |
| m6i.* (fixed) | Consistent CPU performance | Steady workloads, production |
| c6i.* (compute) | High CPU-to-memory ratio | CPU-bound: encoding, ML inference |
| r6i.* (memory) | High memory-to-CPU ratio | In-memory caches, large datasets |

> **Agent Selection Guide**:
> - Start with t3 for dev/test and light workloads
> - Use m6i for production workloads needing consistent performance
> - Use c6i for CPU-intensive tasks (image processing, ML inference)
> - Use r6i for memory-heavy workloads (in-memory databases, large caches)
> - Always consider Graviton (t4g, m6g, c6g, r6g) for ~20% savings

---

### RDS Instance Types

| Instance | vCPU | Memory | Max Connections (MySQL) | Max Connections (PostgreSQL) | On-Demand $/mo |
|----------|------|--------|------------------------|------------------------------|----------------|
| db.t3.micro | 2 | 1 GiB | ~85 | ~112 | $12.41 |
| db.t3.small | 2 | 2 GiB | ~170 | ~225 | $24.82 |
| db.t3.medium | 2 | 4 GiB | ~340 | ~450 | $49.64 |
| db.t3.large | 2 | 8 GiB | ~680 | ~900 | $99.28 |
| db.m6g.large | 2 | 8 GiB | ~680 | ~900 | $117.53 |
| db.m6g.xlarge | 4 | 16 GiB | ~1,365 | ~1,800 | $235.06 |
| db.m6g.2xlarge | 8 | 32 GiB | ~2,730 | ~3,600 | $470.12 |
| db.m6g.4xlarge | 16 | 64 GiB | ~5,461 | ~7,200 | $940.24 |
| db.r6g.large | 2 | 16 GiB | ~1,365 | ~1,800 | $173.74 |
| db.r6g.xlarge | 4 | 32 GiB | ~2,730 | ~3,600 | $347.48 |
| db.r6g.2xlarge | 8 | 64 GiB | ~5,461 | ~7,200 | $694.96 |

> **Max Connections Calculation**:
> - MySQL: `{DBInstanceClassMemory/12582880}` (~85 per GiB)
> - PostgreSQL: `LEAST({DBInstanceClassMemory/9531392}, 5000)` (~112 per GiB, capped at 5000)

> **Agent Selection Guide**:
> - db.t3.micro: Dev/test, personal projects (85-112 connections)
> - db.t3.small to db.t3.medium: Small apps (170-450 connections)
> - db.m6g.large: Production standard (680-900 connections)
> - db.m6g.xlarge+: High-connection workloads
> - db.r6g.*: Memory-intensive queries, large datasets

---

### ElastiCache Instance Types

| Instance | vCPU | Memory | Network | Max Connections | On-Demand $/mo |
|----------|------|--------|---------|-----------------|----------------|
| cache.t3.micro | 2 | 0.5 GiB | Low-Moderate | ~10,000 | $12.41 |
| cache.t3.small | 2 | 1.37 GiB | Low-Moderate | ~10,000 | $24.82 |
| cache.t3.medium | 2 | 3.09 GiB | Low-Moderate | ~10,000 | $49.64 |
| cache.m6g.large | 2 | 6.38 GiB | Up to 10 Gbps | ~65,000 | $115.34 |
| cache.m6g.xlarge | 4 | 12.93 GiB | Up to 10 Gbps | ~65,000 | $230.68 |
| cache.m6g.2xlarge | 8 | 26.04 GiB | Up to 10 Gbps | ~65,000 | $461.36 |
| cache.r6g.large | 2 | 13.07 GiB | Up to 10 Gbps | ~65,000 | $164.98 |
| cache.r6g.xlarge | 4 | 26.32 GiB | Up to 10 Gbps | ~65,000 | $329.96 |
| cache.r6g.2xlarge | 8 | 52.82 GiB | Up to 10 Gbps | ~65,000 | $659.92 |

> **Agent Selection Guide**:
> - cache.t3.micro: Dev/test, session store for small apps
> - cache.t3.medium: Small production caches
> - cache.m6g.large: Production session/cache store (most common)
> - cache.r6g.*: Large cache datasets, full-page caching

---

## CloudFormation Intrinsic Functions Quick Reference

| Function | Usage | Example |
|----------|-------|---------|
| `!Ref` | Reference parameter or resource | `!Ref VPC` |
| `!GetAtt` | Get resource attribute | `!GetAtt ALB.DNSName` |
| `!Sub` | String substitution | `!Sub '${AWS::StackName}-vpc'` |
| `!Select` | Pick from list | `!Select [0, !GetAZs '']` |
| `!GetAZs` | Get AZs in region | `!GetAZs ''` |
| `!Join` | Join strings | `!Join [',', [a, b, c]]` |
| `!Split` | Split string | `!Split [',', 'a,b,c']` |
| `!If` | Conditional value | `!If [IsProd, m6i.large, t3.small]` |
| `!Equals` | Condition check | `!Equals [!Ref Env, prod]` |
| `!ImportValue` | Cross-stack reference | `!ImportValue SharedVPCId` |
| `Fn::Base64` | Base64 encode | `Fn::Base64: !Sub '#!/bin/bash...'` |

---

## Pseudo Parameters

| Parameter | Value |
|-----------|-------|
| `AWS::AccountId` | AWS account ID (e.g., 123456789012) |
| `AWS::Region` | Deployment region (e.g., us-east-1) |
| `AWS::StackName` | CloudFormation stack name |
| `AWS::StackId` | CloudFormation stack ID (ARN) |
| `AWS::URLSuffix` | Domain suffix (amazonaws.com) |
| `AWS::NoValue` | Remove property (used with !If) |
| `AWS::NotificationARNs` | SNS notification ARNs |
| `AWS::Partition` | Partition (aws, aws-cn, aws-us-gov) |
