# ROS Template Catalog

Index of all templates in `C:\work\ros-templates\`. Read specific templates as needed.

> Path prefix: `C:\work\ros-templates\` (use forward slashes in code)

## Quick Lookup by Architecture Pattern

| Pattern | Primary Template | Fallback |
|---------|-----------------|----------|
| Lite | `compute-nest-best-practice/ecs-deploy/template.yml` | `examples/elastic/simple-ecs-instance.yml` |
| Standard | `compute-nest-best-practice/ecs-rds/template.yml` | `solutions/enterprise-on-cloud/single-website-on-cloud-cloud-architecture.yml` |
| HA | `compute-nest-best-practice/master-slave-ecs/` + `ecs-rds/` | `solutions/backup-recovery/cross-the-available-zone-disaster.yml` |
| Elastic | `compute-nest-best-practice/scaling-ecs/` | `solutions/enterprise-on-cloud/internet-industry-high-elastic-system-construction.yml` |
| Serverless | `compute-nest-best-practice/fc/` | `solutions/serviceless-compute/fc-web-file-backend-service.yml` |
| Container | `solutions/container-micro-service/spring-cloud-hostingack-service.yml` | `compute-nest-best-practice/ack-app-rds/` |

## Quick Lookup by Service

| Service | Best Practice | Example | Resource Def |
|---------|--------------|---------|-------------|
| ECS | `ecs-deploy/` | `elastic/simple-ecs.yml` | `resources/ecs/` |
| RDS MySQL | `ecs-rds/` | `db/rds-instance.yml` | `resources/rds/` |
| RDS PG | `ecs-postgresql/` | - | `resources/rds/` |
| PolarDB | `ecs-polardb/` | - | `resources/polardb/` |
| Redis | `ecs-redis/` | `db/redis-instance.yml` | `resources/redis/` |
| MongoDB | `ecs-mongodb/` | `db/mongodb-instance.yml` | `resources/mongodb/` |
| SLB | `ecs-slb/` | `elastic/slb-with-2-ecs.yml` | `resources/slb/` |
| VPC | `vpc-natgateway-eip/` | `network/new-vpc.yml` | `resources/vpc/` |
| ESS | `scaling-ecs/` | `elastic/ess-1-slb-2-rds-2-ecs.yml` | `resources/ess/` |
| FC | `fc/` | - | `resources/fc/` |
| CDN | - | `storage/cdn-domain.yml` | `resources/cdn/` |
| OSS | `ecs-ramrole-oss/` | `storage/oss-bucket.yml` | `resources/oss/` |
| NAS | - | `storage/nas-file-system.yml` | `resources/nas/` |
| WAF | - | - | `resources/waf/` |
| ACK | `ack-app-rds/` | `elastic/new-vpc-ask.yml` | `resources/cs/` |

## Solutions by Scenario (66 templates)

### Enterprise On-Cloud (12)
- `single-website-on-cloud-stand-alone-server.yml` - Single ECS WordPress
- `single-website-on-cloud-cloud-architecture.yml` - ECS+RDS+SLB upgrade
- `single-website-on-cloud-stand-one-click.yml` - One-click WordPress
- `e-commerce-business-and-db-on-the-cloud.yml` - E-commerce multi-AZ
- `games-or-retail-single-db-single-service.yml` - Game/retail with CDN+OSS
- `internet-industry-high-elastic-system-construction.yml` - ESS+PolarDB+Redis+SLB

### Backup & Recovery (7)
- `deploy-the-rds-environment.yml` - Multi-AZ RDS backup
- `cross-the-available-zone-disaster.yml` - Cross-AZ DR
- `zero-loss-of-trading-system-data.yml` - Trading system DR

### Internet & Network (9)
- `multi-avaiable-areas-building-services.yml` - Multi-AZ single region
- `multi-region-multi-area-network-interworking.yml` - Multi-region hybrid
- `enterprise-app-hotel-network.yml` - Hybrid cloud network
- `global-deployment-network-*.yml` - Global network (2 templates)
- `landing-zone-cen-*.yml` - Cross-account networking (4 templates)

### Database (3)
- `deploy-mysql-based-on-ebs.yml` - High-perf MySQL on EBS
- `polardb-migration-from-rds.yml` - RDS to PolarDB migration
- `sync-OLTP-to-OLAP.yml` - OLTP to AnalyticDB sync

### Security (2)
- `business-security-for-e-commerce-sites.yml` - E-commerce WAF
- `ram-account-rights-management.yml` - RAM governance

### Container & Microservice (2)
- `spring-cloud-hostingack-service.yml` - Spring Cloud on ACK
- `spring-cloud-cloud-native-migration.yml` - Cloud-native migration

### Serverless (1)
- `fc-web-file-backend-service.yml` - FC + OSS file processing

## Compute Nest Best Practices (30 templates)

Core deployment patterns with tested, production-ready templates:

```
ack-app-rds/        ecs-deploy/         ecs-rds/           master-slave-ecs/
ack-nginx/          ecs-mongodb/        ecs-redis/         scaling-ecs/
eci-eip/            ecs-mysql-deploy/   ecs-slb/           terraform-ecs-nginx/
ecs-adbpg/          ecs-polardb/        ecs-sqlserver/     vpc-natgateway-eip/
                    ecs-postgresql/     ecs-ramrole-oss/   fc/
```

## Template Structure Reference

All ROS templates follow this structure:
```yaml
ROSTemplateFormatVersion: '2015-09-01'
Description:
  zh-cn: ...
  en: ...
Parameters:
  PayType:           # PostPaid / PrePaid
  PayPeriodUnit:     # Month / Year
  PayPeriod:         # 1-60
  ZoneId:            # Availability zone
  # ... service-specific params
Resources:
  VPC / VSwitch / SecurityGroup / ECS / RDS / SLB / ...
Outputs:
  # IPs, endpoints, connection strings
Metadata:
  ALIYUN::ROS::Interface:
    ParameterGroups: [...]
```
