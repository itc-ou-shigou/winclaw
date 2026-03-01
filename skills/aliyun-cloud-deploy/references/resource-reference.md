# ROS Resource Type Reference

Quick reference for all ALIYUN resource types used in deployment templates. For full property details, read the resource definition files in `C:\work\ros-templates\resources\`.

> **Usage**: When building or modifying ROS templates, look up the resource type here to find required properties, dependencies, and outputs. Then read the corresponding template file for a complete working example.

## Core Network Resources

### ALIYUN::ECS::VPC
**File**: `resources/ecs/` (embedded in most templates)
```yaml
Type: ALIYUN::ECS::VPC
Properties:
  VpcName: String          # Display name
  CidrBlock: String        # e.g., "192.168.0.0/16" or "10.0.0.0/8"
  Description: String      # Optional
```
**Outputs**: `VpcId`, `VRouterId`, `RouteTableId`

### ALIYUN::ECS::VSwitch
**File**: `resources/ecs/` (embedded in most templates)
```yaml
Type: ALIYUN::ECS::VSwitch
Properties:
  VpcId: Ref: Vpc          # Required - parent VPC
  ZoneId: String           # Availability zone
  CidrBlock: String        # Subnet CIDR, e.g., "192.168.1.0/24"
  VSwitchName: String      # Display name
DependsOn: Vpc
```
**Outputs**: `VSwitchId`, `CidrBlock`

### ALIYUN::ECS::SecurityGroup
**Files**: `resources/ecs/security-group-case1.yml` through `case3.yml`
```yaml
Type: ALIYUN::ECS::SecurityGroup
Properties:
  VpcId: Ref: Vpc
  SecurityGroupName: String
  SecurityGroupIngress:     # Inbound rules list
    - PortRange: "80/80"    # "start/end" format
      IpProtocol: tcp       # tcp | udp | icmp | gre | all
      SourceCidrIp: "0.0.0.0/0"
  SecurityGroupEgress:      # Outbound rules list (optional)
    - PortRange: "-1/-1"
      IpProtocol: all
      DestCidrIp: "0.0.0.0/0"
```
**Common port ranges**: `22/22` (SSH), `80/80` (HTTP), `443/443` (HTTPS), `3306/3306` (MySQL), `6379/6379` (Redis), `8080/8080` (Tomcat), `-1/-1` (all)

### ALIYUN::VPC::NatGateway
**File**: `resources/vpc/nat-gateway.yml`
```yaml
Type: ALIYUN::VPC::NatGateway
Properties:
  VpcId: Ref: Vpc
  VSwitchId: Ref: VSwitch
  NatGatewayName: String
  NatType: Enhanced          # Enhanced NAT gateway (recommended)
  InstanceChargeType: PostPaid
  InternetChargeType: PayByLcu  # PayBySpec | PayByLcu
  DeletionProtection: false
```
**Outputs**: `NatGatewayId`, `ForwardTableId`, `SNatTableId`
**Dependency chain**: NatGateway → EIP → EIPAssociation → SnatEntry

### ALIYUN::VPC::EIP
**File**: `resources/vpc/eip.yml`
```yaml
Type: ALIYUN::VPC::EIP
Properties:
  Bandwidth: 5               # Mbps
  InternetChargeType: PayByTraffic  # PayByTraffic | PayByBandwidth
  InstanceChargeType: PostPaid
```
**Outputs**: `EipAddress`, `AllocationId`

### ALIYUN::VPC::EIPAssociation
```yaml
Type: ALIYUN::VPC::EIPAssociation
Properties:
  AllocationId: Ref: EIP
  InstanceId: Ref: NatGateway  # or ECS instance
```

### ALIYUN::ECS::SNatEntry
**File**: `resources/ecs/` (in NAT templates)
```yaml
Type: ALIYUN::ECS::SNatEntry
Properties:
  SNatTableId:
    Fn::GetAtt: [NatGateway, SNatTableId]
  SNatIp:
    Fn::GetAtt: [EIP, EipAddress]
  SourceVSwitchId: Ref: VSwitch
```

---

## Compute Resources

### ALIYUN::ECS::Instance
**Files**: `resources/ecs/ecs-instance-case1.yml` through `case3.yml`, `instance.yml`
```yaml
Type: ALIYUN::ECS::Instance
Properties:
  VpcId: Ref: Vpc
  VSwitchId: Ref: VSwitch
  SecurityGroupId: Ref: SecurityGroup
  ZoneId: String
  InstanceType: String       # e.g., "ecs.c6.large"
  InstanceChargeType: PostPaid  # PostPaid | PrePaid
  ImageId: String            # e.g., "aliyun_3_x64_20G_alibase_20240819.vhd"
  SystemDiskCategory: cloud_essd  # cloud_efficiency | cloud_ssd | cloud_essd
  SystemDiskSize: 40         # GB, min 20
  Password: String           # NoEcho in parameters
  AllocatePublicIP: true     # false if using EIP/SLB
  InternetMaxBandwidthOut: 5 # Mbps, 0 = no public IP
  InstanceName: String
  HostName: String           # OS hostname
  UserData: String           # Base64 cloud-init script (Fn::Sub)
```
**Outputs**: `InstanceId`, `PublicIp`, `PrivateIp`, `InnerIp`, `HostName`

### ALIYUN::ECS::InstanceGroup
**Files**: `resources/ecs/ecs-instance-group-case1.yml` through `case3.yml`
```yaml
Type: ALIYUN::ECS::InstanceGroup
Properties:
  # Same as ECS::Instance plus:
  MaxAmount: 2               # Number of instances to create
  MinAmount: 2
```
**Outputs**: `InstanceIds` (list), `PublicIps` (list), `PrivateIps` (list)

### ALIYUN::ECS::RunCommand ⭐ (Critical for Code Deployment)
**Files**: `resources/ecs/run-command-case1.yml` through `case3.yml`
```yaml
Type: ALIYUN::ECS::RunCommand
Properties:
  InstanceIds:               # List of target ECS instances
    - Ref: EcsInstance
  Type: RunShellScript       # RunShellScript | RunBatScript | RunPowerShellScript
  Sync: true                 # Wait for completion
  Timeout: 600               # Seconds (default 60, max 86400)
  CommandContent:            # The script to execute
    Fn::Sub: |
      #!/bin/bash
      yum install -y nginx
      systemctl enable nginx
      systemctl start nginx
```
**Key**: This is the primary method for post-provisioning code deployment. No SSH needed.
**Outputs**: `CommandId`, `InvokeId`

### ALIYUN::ECS::CustomImage
**File**: `resources/ecs/custom-image.yml`
```yaml
Type: ALIYUN::ECS::CustomImage
Properties:
  InstanceId: Ref: SeedEcs   # Create image from this instance
  ImageName: String
```
**Pattern**: Seed ECS → install software → create CustomImage → use in ESS ScalingConfiguration

---

## Database Resources

### ALIYUN::RDS::DBInstance
**File**: `resources/rds/db-instance.yml`
```yaml
Type: ALIYUN::RDS::DBInstance
Properties:
  VpcId: Ref: Vpc
  VSwitchId: Ref: VSwitch
  ZoneId: String
  Engine: MySQL              # MySQL | SQLServer | PostgreSQL | PPAS | MariaDB
  EngineVersion: "8.0"      # MySQL: 5.6/5.7/8.0, PG: 13/14/15
  DBInstanceClass: String    # e.g., "rds.mysql.s1.small"
  DBInstanceStorage: 20      # GB
  DBInstanceStorageType: cloud_essd
  SecurityIPList: "192.168.0.0/16"  # VPC CIDR for internal access
  DBInstanceNetType: Intranet
  PayType: PostPaid          # PostPaid | Prepaid
  Category: Basic            # Basic | HighAvailability | AlwaysOn | Finance
  DBMappings:                # Create databases inline (optional)
    - DBName: mydb
      CharacterSetName: utf8mb4
```
**Outputs**: `DBInstanceId`, `InnerConnectionString`, `InnerPort`, `InnerIPAddress`

### ALIYUN::RDS::Database
```yaml
Type: ALIYUN::RDS::Database
Properties:
  DBInstanceId: Ref: RdsInstance
  DBName: String
  CharacterSetName: utf8mb4  # utf8 | utf8mb4 | gbk | latin1
  DBDescription: String
DependsOn: RdsInstance
```

### ALIYUN::RDS::Account
```yaml
Type: ALIYUN::RDS::Account
Properties:
  DBInstanceId: Ref: RdsInstance
  AccountName: String
  AccountPassword: String    # NoEcho
  AccountType: Super         # Normal | Super
DependsOn: RdsDatabase
```

### ALIYUN::RDS::AccountPrivilege
```yaml
Type: ALIYUN::RDS::AccountPrivilege
Properties:
  DBInstanceId: Ref: RdsInstance
  AccountName: Fn::GetAtt: [RdsAccount, AccountName]
  DBName: String
  AccountPrivilege: ReadWrite  # ReadWrite | ReadOnly | DDLOnly | DMLOnly | DBOwner
DependsOn: RdsAccount
```
**Dependency chain**: DBInstance → Database → Account → AccountPrivilege

### ALIYUN::RDS::ReadOnlyDBInstance
```yaml
Type: ALIYUN::RDS::ReadOnlyDBInstance
Properties:
  DBInstanceId: Ref: RdsInstance  # Master instance
  ZoneId: String
  VPCId: Ref: Vpc
  VSwitchId: Ref: VSwitch
  DBInstanceClass: String
  DBInstanceStorage: Number
  EngineVersion: String
DependsOn: RdsInstance
```

### ALIYUN::RDS::DBInstanceParameterGroup
```yaml
Type: ALIYUN::RDS::DBInstanceParameterGroup
Properties:
  DBInstanceId: Ref: RdsInstance
  Forcerestart: "false"
  Parameters:
    - Key: back_log
      Value: "3000"
    - Key: wait_timeout
      Value: "86400"
```

---

## PolarDB (Auto-Scaling DB)

### ALIYUN::POLARDB::DBCluster
**File**: `resources/polardb/polardb.yml`, `polardb-db-cluster-case1.yml` through `case3.yml`
```yaml
Type: ALIYUN::POLARDB::DBCluster
Properties:
  VpcId: Ref: Vpc
  VSwitchId: Ref: VSwitch
  ZoneId: String
  DBType: MySQL              # MySQL | PostgreSQL | Oracle
  DBVersion: "8.0"           # MySQL: 5.6/8.0, PG: 11/14, Oracle: 11
  DBNodeClass: polar.mysql.x4.medium
  PayType: Postpaid          # Postpaid | Prepaid
  ClusterNetworkType: VPC
```
**Outputs**: `ClusterId`, `DBClusterId`, `ClusterConnectionString`, `ClusterEndpointId`

### ALIYUN::POLARDB::Account
```yaml
Type: ALIYUN::POLARDB::Account
Properties:
  DBClusterId: Ref: PolarDBCluster
  AccountName: String
  AccountPassword: String
  AccountType: Normal        # Normal | Super
```

### ALIYUN::POLARDB::AccountPrivilege
```yaml
Type: ALIYUN::POLARDB::AccountPrivilege
Properties:
  DBClusterId: Ref: PolarDBCluster
  AccountName: String
  AccountPrivilege: ReadWrite  # ReadWrite | ReadOnly | DMLOnly | DDLOnly
  DBName: String
```

### ALIYUN::POLARDB::DBClusterAccessWhiteList
```yaml
Type: ALIYUN::POLARDB::DBClusterAccessWhiteList
Properties:
  DBClusterId: Ref: PolarDBCluster
  SecurityIps: "192.168.0.0/16"  # Must include VPC CIDR
```

### ALIYUN::POLARDB::DBNodes
```yaml
Type: ALIYUN::POLARDB::DBNodes
Properties:
  DBClusterId: Ref: PolarDBCluster
  Amount: 1                  # Additional read nodes
```

---

## Redis (Cache)

### ALIYUN::REDIS::Instance
**File**: `resources/redis/instance.yml`
```yaml
Type: ALIYUN::REDIS::Instance
Properties:
  VpcId: Ref: Vpc
  VSwitchId: Ref: VSwitch
  ZoneId: String
  InstanceClass: String      # e.g., "redis.master.small.default"
  InstanceName: String
  EngineVersion: "5.0"       # 2.8 | 4.0 | 5.0 | 6.0 | 7.0
  Password: String
DependsOn: VSwitch
```
**Outputs**: `InstanceId`, `ConnectionDomain`, `Port`

### ALIYUN::REDIS::Whitelist
**File**: `resources/redis/whitelist-case1.yml`
```yaml
Type: ALIYUN::REDIS::Whitelist
Properties:
  InstanceId: Ref: RedisInstance
  SecurityIps: "192.168.0.0/16"  # Must include VPC CIDR!
```

### ALIYUN::REDIS::Account
```yaml
Type: ALIYUN::REDIS::Account
Properties:
  InstanceId: Ref: RedisInstance
  AccountName: String
  AccountPassword: String
  AccountPrivilege: RoleReadOnly  # RoleReadOnly | RoleReadWrite
```

---

## Load Balancer (SLB/CLB)

### ALIYUN::SLB::LoadBalancer
**File**: `resources/slb/` (multiple cases)
```yaml
Type: ALIYUN::SLB::LoadBalancer
Properties:
  VpcId: Ref: Vpc
  VSwitchId: Ref: VSwitch
  LoadBalancerName: String
  LoadBalancerSpec: slb.s2.small  # slb.s1.small | slb.s2.small | slb.s3.small | slb.s3.medium
  AddressType: internet      # internet | intranet
  PayType: PayOnDemand
```
**Outputs**: `LoadBalancerId`, `IpAddress`, `NetworkType`, `AddressType`

### ALIYUN::SLB::Listener
**File**: `resources/slb/listener-case1.yml` through `case3.yml`
```yaml
Type: ALIYUN::SLB::Listener
Properties:
  LoadBalancerId: Ref: Slb
  ListenerPort: 80           # Frontend port
  BackendServerPort: 80      # Backend port
  Protocol: http             # http | https | tcp | udp
  Bandwidth: -1              # -1 = unlimited (shared SLB)
  Scheduler: wrr             # wrr | wlc | rr
  HealthCheck:               # For HTTP/HTTPS
    HealthyThreshold: 3
    UnhealthyThreshold: 3
    Interval: 2
    Timeout: 5
    URI: /
  # For HTTPS:
  ServerCertificateId: String  # SSL certificate ID
```

### ALIYUN::SLB::BackendServerAttachment
```yaml
Type: ALIYUN::SLB::BackendServerAttachment
Properties:
  LoadBalancerId: Ref: Slb
  BackendServerList:
    - Ref: EcsInstance        # Single instance
  BackendServerWeightList:
    - 100
```

---

## Application Load Balancer (ALB)

### ALIYUN::ALB::LoadBalancer
**File**: `resources/alb/load-balancer-case1.yml` through `case3.yml`
```yaml
Type: ALIYUN::ALB::LoadBalancer
Properties:
  VpcId: Ref: Vpc
  AddressType: Internet
  LoadBalancerBillingConfig:
    PayType: PostPay
  LoadBalancerEdition: Standard  # Basic | Standard | StandardWithWaf
  ZoneMappings:
    - ZoneId: cn-hangzhou-h
      VSwitchId: Ref: VSwitch1
    - ZoneId: cn-hangzhou-i
      VSwitchId: Ref: VSwitch2
```
**Note**: ALB requires at least 2 zones.

### ALIYUN::ALB::ServerGroup
```yaml
Type: ALIYUN::ALB::ServerGroup
Properties:
  VpcId: Ref: Vpc
  ServerGroupType: Instance
  HealthCheckConfig:
    HealthCheckEnabled: true
    HealthCheckPath: /
```

---

## Auto-Scaling (ESS)

### ALIYUN::ESS::ScalingGroup
**File**: `resources/ess/scaling-group.yml`
```yaml
Type: ALIYUN::ESS::ScalingGroup
Properties:
  VSwitchId: Ref: VSwitch    # or VSwitchIds for multi-AZ
  MinSize: 1
  MaxSize: 10
  ScalingGroupName: String
  LoadBalancerIds:           # Optional: attach to SLB
    - Ref: Slb
  DBInstanceIds:             # Optional: attach RDS whitelist
    - Ref: RdsInstance
```
**Outputs**: `ScalingGroupId`

### ALIYUN::ESS::ScalingConfiguration
```yaml
Type: ALIYUN::ESS::ScalingConfiguration
Properties:
  ScalingGroupId: Ref: ScalingGroup
  ImageId: Ref: CustomImage  # Golden image with app pre-installed
  InstanceType: String
  SystemDiskCategory: cloud_essd
  SystemDiskSize: 40
  SecurityGroupId: Ref: SecurityGroup
  InternetMaxBandwidthOut: 0  # 0 if behind SLB
```

### ALIYUN::ESS::ScalingGroupEnable
```yaml
Type: ALIYUN::ESS::ScalingGroupEnable
Properties:
  ScalingGroupId: Ref: ScalingGroup
  ScalingConfigurationId: Ref: ScalingConfig
DependsOn: ScalingConfiguration
```

### ALIYUN::ESS::ScalingRule
```yaml
Type: ALIYUN::ESS::ScalingRule
Properties:
  ScalingGroupId: Fn::GetAtt: [ScalingGroup, ScalingGroupId]
  AdjustmentType: QuantityChangeInCapacity  # or PercentChangeInCapacity | TotalCapacity
  AdjustmentValue: 1
```
**Outputs**: `ScalingRuleId`, `ScalingRuleAri`

### ALIYUN::ESS::AlarmTask
```yaml
Type: ALIYUN::ESS::AlarmTask
Properties:
  ScalingGroupId: Ref: ScalingGroup
  AlarmAction:
    - Fn::GetAtt: [ScalingRule, ScalingRuleAri]
  MetricName: CpuUtilization  # CpuUtilization | MemoryUtilization | etc.
  MetricType: system
  Threshold: 70
  Statistics: Average
  ComparisonOperator: ">="
  EvaluationCount: 3
```

---

## Serverless (FC)

### ALIYUN::FC::Service
**File**: `resources/fc/function-invoker.yml`
```yaml
Type: ALIYUN::FC::Service
Properties:
  ServiceName: String
  Description: String
  Role: String               # RAM role ARN for service execution
  VpcConfig:                 # Optional: VPC access
    VpcId: Ref: Vpc
    VSwitchIds: [Ref: VSwitch]
    SecurityGroupId: Ref: SecurityGroup
  LogConfig:                 # Optional: SLS logging
    Project: String
    Logstore: String
```

### ALIYUN::FC::Function
```yaml
Type: ALIYUN::FC::Function
Properties:
  ServiceName: Ref: Service
  FunctionName: String
  Runtime: python3           # python3 | nodejs14 | nodejs16 | java11 | go1 | custom
  Handler: index.handler
  Code:
    SourceCode: String       # Inline code (small functions)
    # OR
    OssBucketName: String    # Code from OSS
    OssObjectName: String
  MemorySize: 256            # MB, 128-32768
  Timeout: 60                # Seconds, 1-600
  EnvironmentVariables:
    KEY: VALUE
DependsOn: Service
```

### ALIYUN::FC::Trigger
```yaml
Type: ALIYUN::FC::Trigger
Properties:
  ServiceName: Ref: Service
  FunctionName: Ref: Function
  TriggerName: String
  TriggerType: http          # http | timer | oss | log | cdn_events | mns_topic
  TriggerConfig:
    # For HTTP trigger:
    AuthType: anonymous      # anonymous | function
    Methods: ["GET", "POST"]
    # For Timer trigger:
    CronExpression: "0 0/4 * * * *"
    Enable: true
DependsOn: Function
```

---

## Container Service (ACK/Kubernetes)

### ALIYUN::CS::ManagedKubernetesCluster
**File**: `resources/cs/managed-kubernetes-cluster.yml` (+ case1-3)
```yaml
Type: ALIYUN::CS::ManagedKubernetesCluster
Properties:
  VpcId: Ref: Vpc
  VSwitchIds:
    - Ref: VSwitch
  Name: String
  ClusterSpec: ack.pro.small  # ack.standard | ack.pro.small
  WorkerInstanceTypes:
    - ecs.c6.xlarge
  WorkerSystemDiskCategory: cloud_essd
  NumOfNodes: 3
  LoginPassword: String      # NoEcho
  ServiceCidr: "172.16.0.0/16"  # Must not overlap VPC CIDR
  PodCidr: "10.0.0.0/8"         # Flannel mode only
  ContainerCidr: "10.0.0.0/16"  # Terway mode
```
**Outputs**: `ClusterId`, `TaskId`, `APIServerSLBId`

### ALIYUN::CS::ClusterNodePool
**File**: `resources/cs/cluster-node-pool-case1.yml` through `case3.yml`
```yaml
Type: ALIYUN::CS::ClusterNodePool
Properties:
  ClusterId: Ref: K8sCluster
  ScalingGroup:
    InstanceTypes: [ecs.c6.xlarge]
    SystemDiskCategory: cloud_essd
    SystemDiskSize: 120
    VSwitchIds: [Ref: VSwitch]
  KubernetesConfig:
    Runtime: containerd
    RuntimeVersion: "1.6.20"
```

### ALIYUN::CS::ClusterApplication
**File**: `resources/cs/cluster-application-case1.yml`
```yaml
Type: ALIYUN::CS::ClusterApplication
Properties:
  ClusterId: Ref: K8sCluster
  YamlContent: String        # Kubernetes manifest YAML
  DefaultNamespace: default
```

---

## CDN

### ALIYUN::CDN::Domain
**File**: `resources/cdn/domain.yml`
```yaml
Type: ALIYUN::CDN::Domain
Properties:
  CdnType: web              # web | download | video | liveStream | httpsdelivery
  DomainName: String         # e.g., "cdn.example.com"
  Sources: String            # JSON: [{"content":"1.1.1.1","type":"ipaddr","port":80}]
```
**Outputs**: `DomainName`, `Cname`

### ALIYUN::CDN::DomainConfig
```yaml
Type: ALIYUN::CDN::DomainConfig
Properties:
  DomainNames: Ref: CdnDomain
  FunctionList:
    - functionName: set_req_host_header
      functionArgs:
        - argName: domain_name
          argValue: example.com
```

---

## WAF (Web Application Firewall)

### ALIYUN::WAF::Instance
**File**: `resources/waf/instance.yml`
```yaml
Type: ALIYUN::WAF::Instance
Properties:
  BigScreen: "0"
  ExclusiveIpPackage: "0"
  ExtBandwidth: "0"
  ExtDomainPackage: "0"
  LogStorage: "3"
  LogTime: "180"
  PackageCode: version_3     # version_3 (Pro) | version_4 (Business) | version_enterprise
  PrefessionalService: "false"
  SubscriptionType: Subscription
  WafLog: "true"
  Period: 1
```

### ALIYUN::WAF::Domain
**File**: `resources/waf/domain.yml`
```yaml
Type: ALIYUN::WAF::Domain
Properties:
  InstanceId: Ref: WafInstance
  DomainName: String
  SourceIps:
    - Fn::GetAtt: [Slb, IpAddress]
  IsAccessProduct: 0         # 0 = no CDN, 1 = behind CDN
  HttpPort: [80]
  HttpsPort: [443]
```

---

## Storage

### ALIYUN::OSS::Bucket
**File**: `resources/oss/` (in various templates)
```yaml
Type: ALIYUN::OSS::Bucket
Properties:
  BucketName: String         # Globally unique
  AccessControl: private     # private | public-read | public-read-write
  StorageClass: Standard     # Standard | IA | Archive
  CORSConfiguration:         # Optional for web apps
    CORSRule:
      - AllowedOrigin: ["*"]
        AllowedMethod: ["GET", "POST", "PUT"]
        AllowedHeader: ["*"]
```

### ALIYUN::NAS::FileSystem
**File**: `resources/nas/file-system-case1.yml` through `case3.yml`
```yaml
Type: ALIYUN::NAS::FileSystem
Properties:
  ProtocolType: NFS          # NFS | SMB
  StorageType: Capacity      # Capacity | Performance
  FileSystemType: standard   # standard | extreme
```
**Dependency chain**: FileSystem → AccessGroup → AccessRule → MountTarget

### ALIYUN::NAS::MountTarget
```yaml
Type: ALIYUN::NAS::MountTarget
Properties:
  FileSystemId: Ref: NasFileSystem
  AccessGroupName: Ref: NasAccessGroup
  NetworkType: Vpc
  VpcId: Ref: Vpc
  VSwitchId: Ref: VSwitch
```

---

## Security & Identity

### ALIYUN::RAM::Role
**File**: `resources/ram/` (15 files)
```yaml
Type: ALIYUN::RAM::Role
Properties:
  RoleName: String
  AssumeRolePolicyDocument:
    Version: "1"
    Statement:
      - Action: "sts:AssumeRole"
        Effect: Allow
        Principal:
          Service:
            - fc.aliyuncs.com     # For FC execution
            - ecs.aliyuncs.com    # For ECS instance role
```
**Outputs**: `RoleId`, `RoleName`, `Arn`

### ALIYUN::RAM::ManagedPolicy / AttachPolicyToRole
```yaml
Type: ALIYUN::RAM::ManagedPolicy
Properties:
  PolicyName: String
  PolicyDocument:
    Version: "1"
    Statement:
      - Effect: Allow
        Action: ["oss:*"]
        Resource: ["*"]

# Attach to role:
Type: ALIYUN::RAM::AttachPolicyToRole
Properties:
  PolicyType: Custom
  PolicyName: Ref: Policy
  RoleName: Ref: Role
```

### ALIYUN::CAS::Certificate
**File**: `resources/cas/certificate.yml`
```yaml
Type: ALIYUN::CAS::Certificate
Properties:
  Cert: String               # PEM certificate content
  Key: String                # PEM private key content
  Name: String
```

---

## Monitoring & Logging

### ALIYUN::CMS::MonitorGroup
**File**: `resources/cms/monitor-group.yml`
```yaml
Type: ALIYUN::CMS::MonitorGroup
Properties:
  GroupName: String
```

### ALIYUN::CMS::GroupMetricRule
**File**: `resources/cms/group-metric-rule.yml`
```yaml
Type: ALIYUN::CMS::GroupMetricRule
Properties:
  GroupId: Ref: MonitorGroup
  RuleName: String
  Category: ecs              # ecs | rds | slb | redis
  MetricName: cpu_total      # cpu_total | memory_usedutilization | diskusage_utilization
  Namespace: acs_ecs_dashboard
  Escalations:
    Critical:
      ComparisonOperator: GreaterThanOrEqualToThreshold
      Statistics: Average
      Threshold: 90
      Times: 3
```

### ALIYUN::SLS::Project + Logstore
```yaml
Type: ALIYUN::SLS::Project
Properties:
  Name: String
  Description: String

Type: ALIYUN::SLS::Logstore
Properties:
  ProjectName: Ref: SlsProject
  LogstoreName: String
  TTL: 30                    # Days
  ShardCount: 2
```

### ALIYUN::ActionTrail::Trail
**File**: `resources/actiontrail/trail-logging.yml`
```yaml
Type: ALIYUN::ActionTrail::Trail
Properties:
  Name: String
  OssBucketName: Ref: TrailBucket
  RoleName: Ref: TrailRole
  EventRW: All               # All | Read | Write
```

---

## Data Transfer (DTS)

### ALIYUN::DTS::MigrationJob2
**File**: `resources/dts/dts.yml`
```yaml
Type: ALIYUN::DTS::MigrationJob2
Properties:
  DtsJobName: String
  SourceEndpoint:
    InstanceType: RDS
    InstanceID: String
    EngineName: MySQL
    Region: cn-hangzhou
  DestinationEndpoint:
    InstanceType: RDS
    InstanceID: String
    EngineName: MySQL
    Region: cn-hangzhou
  StructureInitialization: true
  DataInitialization: true
  DataSynchronization: true
```

---

## CEN (Cross-Region Networking)

### ALIYUN::CEN::CenInstance
**File**: `resources/cen/cen.yml`
```yaml
Type: ALIYUN::CEN::CenInstance
Properties:
  Name: String
  Description: String
```

### ALIYUN::CEN::CenInstanceAttachment
```yaml
Type: ALIYUN::CEN::CenInstanceAttachment
Properties:
  CenId: Ref: CenInstance
  ChildInstanceId: Ref: Vpc          # VPC to attach
  ChildInstanceType: VPC
  ChildInstanceRegionId: cn-hangzhou
```

### ALIYUN::CEN::CenBandwidthPackage
```yaml
Type: ALIYUN::CEN::CenBandwidthPackage
Properties:
  Bandwidth: 10              # Mbps
  GeographicRegionAId: China
  GeographicRegionBId: China  # or Asia-Pacific | North-America | Europe
```

---

## DNS

### ALIYUN::DNS::DomainRecord
**File**: `resources/dns/domain-record.yml`
```yaml
Type: ALIYUN::DNS::DomainRecord
Properties:
  DomainName: String         # e.g., "example.com"
  RR: String                 # Record name: "@" for root, "www", "*" for wildcard
  Type: A                    # A | CNAME | MX | TXT | AAAA
  Value: String              # IP or domain
  TTL: 600
```

---

## API Gateway

### ALIYUN::ApiGateway::Group
**File**: `resources/apigateway/` (5 files)
```yaml
Type: ALIYUN::ApiGateway::Group
Properties:
  GroupName: String
  Description: String
```

### ALIYUN::ApiGateway::Api
```yaml
Type: ALIYUN::ApiGateway::Api
Properties:
  GroupId: Ref: ApiGroup
  ApiName: String
  Visibility: PUBLIC         # PUBLIC | PRIVATE
  AuthType: APP              # APP | ANONYMOUS | APPOPENID
  RequestConfig:
    RequestProtocol: HTTP
    RequestHttpMethod: GET
    RequestPath: /api/v1/resource
    RequestMode: MAPPING
  ServiceConfig:
    ServiceProtocol: FunctionCompute
    FunctionComputeConfig:
      FcRegionId: cn-hangzhou
      ServiceName: Ref: FcService
      FunctionName: Ref: FcFunction
```

---

## Quick Dependency Lookup

| When you need... | Read this file |
|---|---|
| ECS + RunCommand for code deploy | `resources/ecs/run-command-case1.yml` through `case3.yml` |
| SecurityGroup with common rules | `resources/ecs/security-group-case1.yml` through `case3.yml` |
| Complete RDS setup (instance+account+db) | `resources/rds/db-instance.yml` |
| SLB with HTTP/HTTPS listener | `resources/slb/listener-case1.yml` through `case3.yml` |
| VPC + NAT + EIP + SNAT | `resources/vpc/nat-gateway.yml` + `resources/ecs/forward-entry.yml` |
| ESS auto-scaling full chain | `resources/ess/scaling-group.yml` |
| Redis + whitelist + account | `resources/redis/instance.yml` |
| PolarDB complete setup | `resources/polardb/polardb.yml` |
| Managed K8s cluster | `resources/cs/managed-kubernetes-cluster.yml` |
| FC service + function + trigger | `resources/fc/function-invoker.yml` |
| CDN domain + config | `resources/cdn/domain.yml` |
| WAF instance + domain binding | `resources/waf/instance.yml` + `domain.yml` |
| NAS mount target chain | `resources/nas/nas.yml` |
| RAM role for FC/ECS | `resources/ram/` (15 files) |
| CloudMonitor alarm rules | `resources/cms/group-metric-rule.yml` |
| DTS migration job | `resources/dts/dts.yml` |
| CEN cross-region network | `resources/cen/cen.yml` |
| SSL certificate | `resources/cas/certificate.yml` |
| DNS record | `resources/dns/domain-record.yml` |
| API Gateway + FC binding | `resources/apigateway/api.yml` |
