# Alibaba Cloud Architecture Patterns

6 patterns mapped to user requirements. Select based on budget + traffic + app type.

## Pattern Selection Matrix

| Pattern | Budget/mo | Traffic/day | DB | Best For |
|---------|-----------|-------------|-----|----------|
| Lite | <300 CNY | <500 | Optional (SQLite/local) | Personal blog, landing page |
| Standard | 500-1500 CNY | 500-5K | MySQL/PG | SMB website, API |
| HA | 2000-4000 CNY | 5K-50K | MySQL Primary-Standby | Business-critical app |
| Elastic | 3000-8000 CNY | 50K-500K+ | MySQL + Redis | E-commerce, social |
| Serverless | Pay-per-use | Bursty/unpredictable | Serverless RDS | Event-driven, API |
| Container | 5000+ CNY | 50K+ | MySQL + Redis | Microservices |

---

## 1. Lite (Single ECS)

```
User --> ECS (App + DB)
```

### Resources
- VPC + VSwitch + SecurityGroup
- ECS: 1C2G or 2C4G, cloud_efficiency disk

### ROS Base
- `C:\work\ros-templates\compute-nest-best-practice\ecs-deploy\template.yml`

### Security
- SecurityGroup: 22/80/443 only
- No public DB exposure

### Cost Estimate
| Service | Spec | ~CNY/mo |
|---------|------|---------|
| ECS 2C2G | ecs.t6-c1m1.large | 60-100 |
| Disk 40GB | cloud_efficiency | 10 |
| Bandwidth 1Mbps | PayByTraffic | 20-50 |
| **Total** | | **~100-160** |

---

## 2. Standard (ECS + RDS + SLB)

```
User --> SLB --> ECS --> RDS MySQL
```

### Resources
- VPC + VSwitch + SecurityGroup
- ECS: 2C4G
- RDS MySQL: 1C2G, 20-50GB
- SLB: Shared (Performance-shared)

### ROS Base
- `C:\work\ros-templates\compute-nest-best-practice\ecs-rds\template.yml`
- `C:\work\ros-templates\solutions\enterprise-on-cloud\single-website-on-cloud-cloud-architecture.yml`

### Security
- SG: 80/443 from SLB only
- RDS whitelist: VPC CIDR only
- HTTPS on SLB

### Cost Estimate
| Service | Spec | ~CNY/mo |
|---------|------|---------|
| ECS 2C4G | ecs.c6.large | 200-300 |
| RDS MySQL 1C2G | rds.mysql.t1.small | 150-250 |
| SLB shared | slb.s1.small | 30-50 |
| Bandwidth 5Mbps | | 100-150 |
| **Total** | | **~500-750** |

---

## 3. HA (High Availability)

```
User --> SLB --> ECS x2 (multi-AZ) --> RDS MySQL (Primary-Standby)
```

### Resources
- VPC + 2 VSwitch (different AZ)
- ECS x2: 2C4G each
- RDS MySQL: 2C4G, Primary-Standby, Multi-AZ
- SLB: Performance-guaranteed

### ROS Base
- `C:\work\ros-templates\compute-nest-best-practice\master-slave-ecs\`
- `C:\work\ros-templates\compute-nest-best-practice\ecs-rds\template.yml`

### Security
- Multi-AZ for disaster recovery
- RDS automatic backup, 7-day retention
- SLB health check

### Cost Estimate
| Service | Spec | ~CNY/mo |
|---------|------|---------|
| ECS x2 2C4G | ecs.c6.large | 400-600 |
| RDS MySQL 2C4G HA | rds.mysql.s2.large | 500-800 |
| SLB guaranteed | slb.s2.small | 80-120 |
| Bandwidth 10Mbps | | 200-300 |
| **Total** | | **~1200-1800** |

---

## 4. Elastic (Auto Scaling)

```
User --> CDN --> SLB --> ESS(ECS x N) --> RDS MySQL + Redis
                                     --> OSS (static)
```

### Resources
- VPC + VSwitch
- ESS: Auto Scaling Group + Config
- RDS MySQL: 4C8G, Primary-Standby
- Redis: 1G-4G
- SLB: Performance-guaranteed
- CDN: For static assets
- OSS: Static file storage

### ROS Base
- `C:\work\ros-templates\compute-nest-best-practice\scaling-ecs\`
- `C:\work\ros-templates\solutions\internet-network\multi-avaiable-areas-building-services.yml`

### Security
- WAF recommended for web protection
- CDN with HTTPS
- Redis AUTH + VPC-only access

### Cost Estimate
| Service | Spec | ~CNY/mo |
|---------|------|---------|
| ESS (2-8 ECS) | ecs.c6.large | 400-2400 |
| RDS MySQL 4C8G | rds.mysql.s3.large | 800-1200 |
| Redis 2G | redis.master.small.default | 150-200 |
| SLB | slb.s3.small | 120-180 |
| CDN 500GB | | 150-200 |
| OSS 100GB | | 10-20 |
| **Total** | | **~1600-4200** |

---

## 5. Serverless (FC + API Gateway)

```
User --> API Gateway --> FC Functions --> RDS Serverless / TableStore
                                     --> OSS
```

### Resources
- FC: Function Compute
- API Gateway
- RDS Serverless or TableStore
- OSS

### ROS Base
- `C:\work\ros-templates\solutions\serviceless-compute\fc-web-file-backend-service.yml`
- `C:\work\ros-templates\resources\fc\`

### Characteristics
- Zero idle cost, pay per invocation
- Auto-scales to zero
- Best for irregular traffic patterns

### Cost Estimate
| Service | Spec | ~CNY/mo (10K req/day) |
|---------|------|-----------------------|
| FC | 0.5G mem | 30-80 |
| API Gateway | shared | 20-50 |
| RDS Serverless | 0-2 ACU | 50-200 |
| OSS 50GB | | 5-10 |
| **Total** | | **~100-340** |

---

## 6. Container (ACK)

```
User --> SLB/Ingress --> ACK Cluster --> Pods x N --> RDS + Redis
                                                  --> OSS/NAS
```

### Resources
- ACK Managed Cluster
- Worker Nodes (ECS)
- RDS MySQL
- Redis
- SLB (Ingress)
- NAS or OSS

### ROS Base
- `C:\work\ros-templates\solutions\container-micro-service\spring-cloud-hostingack-service.yml`
- `C:\work\ros-templates\resources\cs\`

### Characteristics
- Kubernetes orchestration
- Service mesh ready
- CI/CD integration

### Cost Estimate
| Service | Spec | ~CNY/mo |
|---------|------|---------|
| ACK (managed) | | 0 (managed free) |
| Worker x3 4C8G | ecs.c6.xlarge | 1500-2400 |
| RDS 4C8G HA | | 800-1200 |
| Redis 4G | | 300-400 |
| SLB | | 120-180 |
| **Total** | | **~2700-4200** |
