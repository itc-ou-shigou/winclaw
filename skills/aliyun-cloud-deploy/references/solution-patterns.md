# Solution Patterns - Resource Composition Guide

Maps complex deployment scenarios to proven resource combinations from `C:\work\ros-templates\solutions\`.

> When building complex templates, **always read the matching solution template** for real-world resource wiring, dependency order, and parameter patterns. These are production-tested by Alibaba Cloud.

## Resource Dependency Graph (Core)

```
VPC ──> VSwitch ──> SecurityGroup
  │        │            │
  │        ├──> ECS ────┤──> RunCommand (code deploy)
  │        │            │
  │        ├──> RDS ────┘──> Account ──> Database ──> AccountPrivilege
  │        │
  │        ├──> Redis ──> Whitelist
  │        │
  │        ├──> SLB ──> Listener ──> BackendServerAttachment
  │        │
  │        ├──> ESS::ScalingGroup ──> ScalingConfig ──> ScalingRule
  │        │
  │        ├──> NatGateway ──> EIP ──> EIPAssociation ──> SnatEntry
  │        │
  │        └──> PolarDB::DBCluster ──> Account ──> DBNodes
  │
  └──> CEN (cross-region/cross-VPC)
```

## Pattern 1: Web Application (Standard + HA)

**Use for**: Corporate websites, CMS, WordPress, blogs
**Solution templates**:
- `enterprise-on-cloud/single-website-on-cloud-cloud-architecture.yml` (12 resources)
- `enterprise-on-cloud/single-website-on-cloud-stand-one-click.yml` (13 resources)

**Resource composition**:
```
VPC > VSwitch > SecurityGroup
  > ECS::InstanceGroup (web servers)
  > RDS::DBInstance + Account + AccountPrivilege
  > SLB::LoadBalancer + Listener + BackendServerAttachment
  > VPC::EIP + EIPAssociation
  > ECS::RunCommand (application deploy)
```

**Key pattern**: `ECS::Command` + `ECS::Invocation` for post-deploy code execution.
**Key pattern**: `ECS::CustomImage` for golden image creation after setup.

---

## Pattern 2: E-Commerce (HA + Security)

**Use for**: Online shops, trading systems, payment systems
**Solution templates**:
- `enterprise-on-cloud/e-commerce-business-and-db-on-the-cloud.yml` (13 resources)
- `security-rule/business-security-for-e-commerce-sites.yml` (8 resources)
- `backup-recovery/zero-loss-of-trading-system-data.yml` (10 resources)

**Resource composition**:
```
VPC > VSwitch x2 (multi-AZ)
  > SecurityGroup
  > ECS::Instance x2 (app servers, multi-AZ)
  > RDS::DBInstance (Primary-Standby) + ReadOnlyDBInstance
  > SLB::LoadBalancer + Listener + BackendServerAttachment
  > VPC::EIP + EIPAssociation
  > DTS::Instance + MigrationJob2 (data migration)
```

**Key features**:
- RDS ReadOnlyDBInstance for read scaling
- DTS for live data migration
- Multi-AZ VSwitch placement

---

## Pattern 3: Elastic Auto-Scaling

**Use for**: Traffic-heavy apps, seasonal workloads, social media
**Solution templates**:
- `enterprise-on-cloud/internet-industry-high-elastic-system-construction.yml` (25 resources)
- `cloud-market/elastic-ha-architecture-to-the-cloud.yml` (19 resources)

**Resource composition**:
```
VPC > VSwitch > SecurityGroup
  > ECS::Instance (seed instance)
  > ECS::CustomImage (from seed)
  > ESS::ScalingGroup + ScalingConfiguration + ScalingGroupEnable + ScalingRule
  > POLARDB::DBCluster + Account + AccountPrivilege + DBClusterAccessWhiteList + DBNodes
  > REDIS::Instance + Whitelist
  > SLB::LoadBalancer + Listener + BackendServerAttachment
  > VPC::EIP + EIPAssociation
  > DNS::DomainRecord (optional)
```

**Key pattern**: Seed ECS → CustomImage → ESS ScalingConfiguration references the image.
**Key pattern**: PolarDB instead of RDS for auto-scaling database.
**Key pattern**: Redis whitelist must include VPC CIDR.

---

## Pattern 4: Serverless Backend

**Use for**: APIs, mini-programs, event-driven processing
**Solution templates**:
- `mini-program/fc-mini-program-backend-service.yml` (17 resources)
- `serviceless-compute/fc-web-file-backend-service.yml` (8 resources)

**Resource composition**:
```
VPC > VSwitch > SecurityGroup
  > FC::Service + FC::Function + FC::Trigger
  > ApiGateway::Group + Api + App + Authorization + Deployment
  > RDS::DBInstance + AccountPrivilege
  > OSS::Bucket
  > CDN::Domain + DomainConfig
  > DNS::DomainRecord
  > RAM::Role (FC execution role)
  > SLS::Project + Logstore (logging)
```

**Key pattern**: `RAM::Role` required for FC to access RDS/OSS.
**Key pattern**: API Gateway → FC function binding via `ApiGateway::Api`.
**Key pattern**: OSS trigger for file-processing workflows.

---

## Pattern 5: Container / Kubernetes

**Use for**: Microservices, CI/CD pipelines, cloud-native apps
**Solution templates**:
- `container-micro-service/spring-cloud-hostingack-service.yml` (8 resources)
- `container-micro-service/spring-cloud-cloud-native-migration.yml` (11 resources)
- `devops/container-application-devops-for-ack-cluster.yml` (9 resources)

**Resource composition**:
```
VPC > VSwitch > SecurityGroup
  > CS::KubernetesCluster (or CS::ManagedKubernetesCluster + ClusterNodePool)
  > VPC::NatGateway + EIP + EIPAssociation + ECS::SNatEntry
  > RDS::DBInstance + AccountPrivilege
  > CR::Namespace + CR::Repository (container registry)
```

**Key pattern**: NatGateway + SNatEntry required for worker node outbound.
**Key pattern**: `CS::ManagedKubernetesCluster` for managed control plane (free).
**Key pattern**: `CS::ClusterNodePool` for separate node pool management.

---

## Pattern 6: Multi-Region / Hybrid Cloud

**Use for**: Global apps, hybrid cloud, cross-region DR
**Solution templates**:
- `internet-network/multi-region-multi-area-network-interworking.yml` (11 resources)
- `internet-network/global-deployment-network-build-global-network.yml` (5 resources)
- `internet-network/enterprise-app-hotel-network.yml` (12 resources)

**Resource composition**:
```
Region A: VPC > VSwitch > ECS + RDS + SLB
Region B: VPC > VSwitch > ECS + RDS + SLB
Cross-region:
  > CEN::CenInstance
  > CEN::CenInstanceAttachment (attach both VPCs)
  > CEN::CenBandwidthPackage + CenBandwidthPackageAssociation
  > CEN::CenBandwidthLimit
```

**Key pattern**: CEN (Cloud Enterprise Network) for inter-VPC routing.
**Key pattern**: BandwidthPackage required for cross-region traffic.

---

## Pattern 7: Data Pipeline / Big Data

**Use for**: Analytics, ETL, data warehousing
**Solution templates**:
- `data-analysis/low-cost-offline-big-data-analysis-emr.yml` (15 resources)
- `database/sync-OLTP-to-OLAP.yml` (10 resources)

**Resource composition**:
```
VPC > VSwitch > SecurityGroup
  > EMR::Cluster
  > RDS::DBInstance + Account
  > OSS::Bucket
  > SLS::Project + Logstore
  > SLB::LoadBalancer + Listener
  > RAM::Role
```

---

## Pattern 8: High-Performance Storage

**Use for**: File sharing, NAS, media processing
**Solution templates**:
- `data-migration/low-cost-link-to-business-data.yml` (16 resources)
- `bioscience/bcs-3rd-generation-gene-sequence-data-assembly.yml` (15 resources)

**Resource composition**:
```
VPC > VSwitch > SecurityGroup
  > ECS::InstanceGroup
  > NAS::FileSystem + AccessGroup + AccessRule + MountTarget
  > OSS::Bucket
  > VPC::CommonBandwidthPackage + CommonBandwidthPackageIp
  > VPC::EIP + EIPAssociation
  > RAM::User + AccessKey
```

**Key pattern**: NAS requires AccessGroup + AccessRule + MountTarget chain.
**Key pattern**: CommonBandwidthPackage for cost-efficient multi-ECS bandwidth.

---

## RunCommand Pattern (Critical for Code Deployment)

Found in: `database/deploy-mysql-based-on-ebs.yml`, `devops/deploy-zabbix-service.yml`, `e-commerce-business-and-db-on-the-cloud.yml`

```yaml
ALIYUN::ECS::RunCommand:
  Type: ALIYUN::ECS::RunCommand
  Properties:
    InstanceIds:
      - Ref: EcsInstance
    Type: RunShellScript
    Sync: true
    Timeout: 600
    CommandContent:
      Fn::Sub: |
        #!/bin/bash
        yum install -y nginx
        # ... deployment script
```

This is the **key resource for automating code deployment** within ROS templates - no SSH needed.

---

## Cross-Reference: solutions/ → resources/

When building a template that needs a specific resource, read the resource definition examples:

| Need | Read |
|------|------|
| ECS with RunCommand | `resources/ecs/run-command-case1.yml` through `case3.yml` |
| SecurityGroup rules | `resources/ecs/security-group-case1.yml` through `case3.yml` |
| RDS complete setup | `resources/rds/db-instance.yml` + `account-case1.yml` + `database-case1.yml` |
| SLB with HTTPS | `resources/slb/listener-case2.yml` or `case3.yml` |
| VPC + NAT + EIP | `resources/vpc/nat-gateway.yml` + `eip.yml` + `snat-entry.yml` |
| ESS auto-scaling | `resources/ess/` (both files) |
| Redis + whitelist | `resources/redis/instance.yml` + `whitelist-case1.yml` |
| WAF domain | `resources/waf/domain.yml` + `instance.yml` |
| CDN setup | `resources/cdn/domain.yml` |
| RAM roles | `resources/ram/` (15 files covering roles, policies, users) |
| NAS mount | `resources/nas/` (7 files covering full NAS lifecycle) |
| PolarDB | `resources/polardb/` (7 files) |
| DTS migration | `resources/dts/` (3 files) |
| CAS certificate | `resources/cas/` |
| ActionTrail audit | `resources/actiontrail/` |
| CloudMonitor | `resources/cms/` (8 files covering alarms, groups, contacts) |
