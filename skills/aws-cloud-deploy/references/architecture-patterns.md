# AWS Architecture Patterns

This document defines 6 architecture patterns for AWS deployment. Each pattern includes an ASCII
architecture diagram, resource list, use cases, scaling limits, and estimated monthly cost.

The AI agent should select the appropriate pattern based on the user's budget, expected traffic,
and application requirements. When in doubt, start with the **Standard** pattern and scale up.

---

## Pattern Selection Quick Reference

| Pattern | ID | Budget | Traffic | Best For |
|---------|----|--------|---------|----------|
| Lite | `lite` | $10-40/mo | <500/day | Dev, personal projects, demos |
| Standard | `standard` | $50-150/mo | 500-5,000/day | Small business, staging |
| HA | `ha` | $150-300/mo | 5,000-50,000/day | Production workloads |
| Elastic | `elastic` | $250-600/mo | 50,000-500,000/day | High-scale production |
| Serverless | `serverless` | $0-100/mo | Variable/bursty | Event-driven, APIs, low-idle |
| Container | `container` | $300+/mo | 50,000-1M+/day | Microservices, polyglot |

### Decision Criteria

- **Budget-constrained** --> `lite` or `serverless`
- **Need uptime SLA** --> `ha` or higher
- **Traffic is spiky/unpredictable** --> `serverless` or `elastic`
- **Running multiple services** --> `container`
- **Single application, moderate traffic** --> `standard`
- **Need zero-downtime deploys** --> `ha` or higher

---

## Pattern 1: Lite (Single EC2)

### Architecture Diagram

```
                        Internet
                           |
                     +-----+-----+
                     | Elastic IP |
                     |  (EIP)     |
                     +-----+------+
                           |
               +-----------+-----------+
               |        VPC            |
               |   10.0.0.0/16        |
               |                       |
               |  +------------------+ |
               |  | Public Subnet    | |
               |  | 10.0.1.0/24     | |
               |  |                  | |
               |  |  +------------+ | |
               |  |  | EC2        | | |
               |  |  | t3.micro/  | | |
               |  |  | t3.small   | | |
               |  |  |            | | |
               |  |  | App +      | | |
               |  |  | SQLite/    | | |
               |  |  | local DB   | | |
               |  |  +------------+ | |
               |  |       |          | |
               |  |  [Security       | |
               |  |   Group:         | |
               |  |   22,80,443]     | |
               |  +------------------+ |
               |           |           |
               |  +--------+--------+  |
               |  | Internet Gateway |  |
               |  +------------------+  |
               +------------------------+
```

### Resources

| Resource | Type | Notes |
|----------|------|-------|
| VPC | `AWS::EC2::VPC` | 10.0.0.0/16, DNS enabled |
| Public Subnet | `AWS::EC2::Subnet` | Single AZ, MapPublicIpOnLaunch=true |
| Internet Gateway | `AWS::EC2::InternetGateway` | Attached to VPC |
| Route Table | `AWS::EC2::RouteTable` | 0.0.0.0/0 --> IGW |
| Security Group | `AWS::EC2::SecurityGroup` | Inbound: 22 (SSH), 80 (HTTP), 443 (HTTPS) |
| EC2 Instance | `AWS::EC2::Instance` | t3.micro or t3.small |
| Elastic IP | `AWS::EC2::EIP` | Static public IP, free when attached |
| EIP Association | `AWS::EC2::EIPAssociation` | Links EIP to EC2 |

### Use Cases

- Personal blogs, portfolio sites
- Development and testing environments
- Small internal tools with <10 concurrent users
- Proof of concept deployments
- Side projects and hobby applications

### Scaling Limits

- **Max concurrent connections**: ~250-500 (t3.micro), ~500-1000 (t3.small)
- **Storage**: Limited to EBS volume (default 8-30 GB gp3)
- **Single point of failure**: Instance failure = total downtime
- **No load balancing**: Single instance handles all traffic
- **Database**: SQLite or local DB on the same instance (no managed DB)

### Monthly Cost Estimate

| Component | t3.micro | t3.small |
|-----------|----------|----------|
| EC2 Instance | $7.59 | $15.18 |
| EBS 20GB gp3 | $1.60 | $1.60 |
| Elastic IP (attached) | $0.00 | $0.00 |
| Data Transfer (5GB out) | $0.45 | $0.45 |
| **Total** | **~$10** | **~$18** |

---

## Pattern 2: Standard (EC2 + ALB + RDS)

### Architecture Diagram

```
                        Internet
                           |
               +-----------+-----------+
               |        VPC            |
               |   10.0.0.0/16        |
               |                       |
               |  +------------------+ |
               |  | Public Subnet    | |
               |  | 10.0.1.0/24     | |    +------------------+
               |  | (AZ-a)          | |    | Public Subnet    |
               |  |                  | |    | 10.0.2.0/24     |
               |  +--------+---------+ |    | (AZ-b)          |
               |           |           |    +--------+---------+
               |  +--------+-----------+-------------+         |
               |  |    Application Load Balancer      |         |
               |  |    (ALB) - port 80/443            |         |
               |  +--------+--------------------------+         |
               |           |                                    |
               |  +--------+---------+                          |
               |  | Public Subnet    |                          |
               |  | 10.0.1.0/24     |                          |
               |  |                  |                          |
               |  |  +------------+ |                          |
               |  |  | EC2        | |                          |
               |  |  | t3.small/  | |                          |
               |  |  | t3.medium  | |                          |
               |  |  | (App)      | |                          |
               |  |  +-----+------+ |                          |
               |  |        |         |                          |
               |  +--------+---------+                          |
               |           |                                    |
               |  +--------+---------+                          |
               |  | Private Subnet   |                          |
               |  | 10.0.10.0/24    |                          |
               |  | (AZ-a)          |                          |
               |  |  +------------+ |   +------------------+   |
               |  |  | RDS        | |   | Private Subnet   |   |
               |  |  | db.t3.micro| |   | 10.0.11.0/24    |   |
               |  |  | MySQL/     | |   | (AZ-b)          |   |
               |  |  | PostgreSQL | |   | (DB Subnet Grp)  |   |
               |  |  | Single-AZ  | |   +------------------+   |
               |  |  +------------+ |                          |
               |  +------------------+                          |
               |           |                                    |
               |  +--------+--------+                           |
               |  | Internet Gateway |                          |
               |  +------------------+                          |
               +------------------------------------------------+
```

### Resources

| Resource | Type | Notes |
|----------|------|-------|
| VPC | `AWS::EC2::VPC` | 10.0.0.0/16 |
| Public Subnets (x2) | `AWS::EC2::Subnet` | Two AZs for ALB requirement |
| Private Subnets (x2) | `AWS::EC2::Subnet` | For RDS (DB Subnet Group needs 2 AZs) |
| Internet Gateway | `AWS::EC2::InternetGateway` | Public internet access |
| Route Tables | `AWS::EC2::RouteTable` | Public: 0.0.0.0/0 --> IGW |
| ALB Security Group | `AWS::EC2::SecurityGroup` | Inbound: 80, 443 from 0.0.0.0/0 |
| App Security Group | `AWS::EC2::SecurityGroup` | Inbound: app port from ALB SG only |
| DB Security Group | `AWS::EC2::SecurityGroup` | Inbound: 3306/5432 from App SG only |
| Application Load Balancer | `AWS::ElasticLoadBalancingV2::LoadBalancer` | internet-facing, 2 public subnets |
| Target Group | `AWS::ElasticLoadBalancingV2::TargetGroup` | Health check on /health |
| Listener (HTTP) | `AWS::ElasticLoadBalancingV2::Listener` | Port 80, redirect to 443 |
| Listener (HTTPS) | `AWS::ElasticLoadBalancingV2::Listener` | Port 443, forward to TG |
| EC2 Instance | `AWS::EC2::Instance` | t3.small or t3.medium |
| RDS Instance | `AWS::RDS::DBInstance` | db.t3.micro, Single-AZ |
| DB Subnet Group | `AWS::RDS::DBSubnetGroup` | Private subnets across 2 AZs |

### Use Cases

- Small business websites with backend database
- Staging environments mirroring production
- Internal business applications (CRM, ticketing)
- REST API backends with persistent data
- Content management systems (WordPress, Ghost)

### Scaling Limits

- **Max concurrent connections**: ~500-2000 (depending on instance)
- **Database**: Single RDS instance, no read replicas
- **Single EC2**: Still a single point of failure for compute
- **ALB handles TLS termination**: Offloads SSL from application
- **Manual scaling**: Must resize instance or add instances manually

### Monthly Cost Estimate

| Component | Minimum | Typical |
|-----------|---------|---------|
| EC2 t3.small | $15.18 | -- |
| EC2 t3.medium | -- | $30.37 |
| EBS 20GB gp3 | $1.60 | $1.60 |
| ALB | $16.43 | $22.00 |
| RDS db.t3.micro | $12.41 | -- |
| RDS db.t3.small | -- | $24.82 |
| RDS Storage 20GB | $2.30 | $2.30 |
| Data Transfer (10GB) | $0.90 | $0.90 |
| **Total** | **~$49** | **~$82** |

---

## Pattern 3: HA (High Availability)

### Architecture Diagram

```
                            Internet
                               |
                 +-------------+-------------+
                 |           VPC             |
                 |      10.0.0.0/16         |
                 |                           |
     +-----------+-----------+ +-------------+-----------+
     | Public Subnet (AZ-a)  | | Public Subnet (AZ-b)   |
     | 10.0.1.0/24          | | 10.0.2.0/24            |
     +-----------+-----------+ +-------------+-----------+
                 |                           |
     +-----------+---------------------------+-----------+
     |         Application Load Balancer (ALB)           |
     |         HTTPS:443  HTTP:80-->redirect              |
     +-----------+---------------------------+-----------+
                 |                           |
     +-----------+-----------+ +-------------+-----------+
     | Public Subnet (AZ-a)  | | Public Subnet (AZ-b)   |
     |                       | |                         |
     |  +------------------+ | | +------------------+   |
     |  | EC2 (ASG)        | | | | EC2 (ASG)        |   |
     |  | Launch Template  | | | | Launch Template   |   |
     |  | t3.medium/       | | | | t3.medium/        |   |
     |  | m6i.large        | | | | m6i.large         |   |
     |  +--------+---------+ | | +--------+---------+   |
     +-----------|----------+ +-----------|-------------+
                 |                        |
     +-----------+---------------------------+-----------+
     |         Auto Scaling Group (min:2, max:6)         |
     |         Target Tracking: CPU 60%                  |
     +--------------------------------------------------+
                 |                        |
     +-----------+-----------+ +----------+-----------+
     | Private Subnet (AZ-a) | | Private Subnet (AZ-b)|
     | 10.0.10.0/24         | | 10.0.11.0/24        |
     |                       | |                      |
     |  +------------------+ | | +------------------+ |
     |  | RDS Primary      | | | | RDS Standby      | |
     |  | db.t3.medium/    | | | | (Multi-AZ)       | |
     |  | db.m6g.large     | | | | Auto failover    | |
     |  +------------------+ | | +------------------+ |
     +-----------------------+ +----------------------+
```

### Resources

| Resource | Type | Notes |
|----------|------|-------|
| VPC | `AWS::EC2::VPC` | 10.0.0.0/16 |
| Public Subnets (x2) | `AWS::EC2::Subnet` | AZ-a, AZ-b for ALB + EC2 |
| Private Subnets (x2) | `AWS::EC2::Subnet` | AZ-a, AZ-b for RDS Multi-AZ |
| Internet Gateway | `AWS::EC2::InternetGateway` | Public access |
| ALB | `AWS::ElasticLoadBalancingV2::LoadBalancer` | internet-facing, 2 AZs |
| Target Group | `AWS::ElasticLoadBalancingV2::TargetGroup` | Health check, deregistration delay |
| Listeners (HTTP+HTTPS) | `AWS::ElasticLoadBalancingV2::Listener` | TLS termination at ALB |
| Launch Template | `AWS::EC2::LaunchTemplate` | UserData, instance config |
| Auto Scaling Group | `AWS::AutoScaling::AutoScalingGroup` | min:2, max:6, 2 AZs |
| Scaling Policy | `AWS::AutoScaling::ScalingPolicy` | Target tracking CPU 60% |
| RDS Instance | `AWS::RDS::DBInstance` | Multi-AZ enabled |
| DB Subnet Group | `AWS::RDS::DBSubnetGroup` | Private subnets, 2 AZs |
| Security Groups (x3) | `AWS::EC2::SecurityGroup` | ALB, App, DB (layered) |
| CloudWatch Alarms | `AWS::CloudWatch::Alarm` | CPU, healthy hosts, 5xx rate |
| Log Group | `AWS::Logs::LogGroup` | Application logs |

### Use Cases

- Production web applications requiring high uptime
- E-commerce sites where downtime = revenue loss
- SaaS applications with SLA commitments
- Business-critical internal tools
- Applications requiring zero-downtime deployments (rolling updates)

### Scaling Limits

- **Auto Scaling**: 2-6 instances (configurable)
- **Database failover**: Automatic Multi-AZ, ~60 second failover
- **AZ failure tolerance**: Survives loss of one Availability Zone
- **Max throughput**: ~10,000-50,000 requests/second (depending on instance size)
- **Rolling deployments**: ASG handles instance rotation

### Monthly Cost Estimate

| Component | Minimum (2x t3.medium) | Typical (2x m6i.large) |
|-----------|------------------------|------------------------|
| EC2 Instances (x2) | $60.74 | $138.70 |
| EBS 20GB gp3 (x2) | $3.20 | $3.20 |
| ALB | $22.00 | $30.00 |
| RDS db.t3.medium Multi-AZ | $99.28 | -- |
| RDS db.m6g.large Multi-AZ | -- | $235.06 |
| RDS Storage 50GB | $5.75 | $5.75 |
| CloudWatch | $3.00 | $5.00 |
| Data Transfer (50GB) | $4.50 | $4.50 |
| **Total** | **~$199** | **~$422** |

---

## Pattern 4: Elastic (Full Production Stack)

### Architecture Diagram

```
                         CloudFront CDN
                    (Global Edge Locations)
                    +--------------------+
                    | Static assets (S3) |
                    | Dynamic origin     |
                    |   (ALB)            |
                    +--------+-----------+
                             |
                        Internet
                             |
           +-----------------+-----------------+
           |              VPC                  |
           |         10.0.0.0/16              |
           |                                   |
  +--------+--------+          +--------+--------+
  | Public Subnet   |          | Public Subnet   |
  | AZ-a            |          | AZ-b            |
  | 10.0.1.0/24    |          | 10.0.2.0/24    |
  +--------+--------+          +--------+--------+
           |                            |
  +--------+----------------------------+--------+
  |     Application Load Balancer (ALB)          |
  |     HTTPS:443 with WAF (optional)            |
  +--------+----------------------------+--------+
           |                            |
  +--------+--------+          +--------+--------+
  |  EC2 (ASG)      |          |  EC2 (ASG)      |
  |  m6i.large/     |          |  m6i.large/     |
  |  m6i.xlarge     |          |  m6i.xlarge     |
  +--------+--------+          +--------+--------+
           |                            |
  +--------+----------------------------+--------+
  |  Auto Scaling Group (min:2, max:12)          |
  |  Target Tracking: CPU 60%, RequestCount      |
  +-----------+-------------------+--------------+
              |                   |
  +-----------+---------+  +-----+---------------+
  | Private Subnet AZ-a |  | Private Subnet AZ-b |
  | 10.0.10.0/24       |  | 10.0.11.0/24       |
  |                     |  |                     |
  | +--------+--------+ |  | +--------+--------+ |
  | | RDS Primary      | |  | | RDS Standby     | |
  | | db.m6g.large/    | |  | | (Multi-AZ)      | |
  | | db.m6g.xlarge    | |  | | Auto failover   | |
  | +------------------+ |  | +------------------+ |
  |                     |  |                     |
  | +------------------+ |  | +------------------+ |
  | | ElastiCache      | |  | | ElastiCache      | |
  | | Redis Primary    | |  | | Redis Replica    | |
  | | cache.m6g.large  | |  | | (Replication     | |
  | |                  | |  | |  Group)           | |
  | +------------------+ |  | +------------------+ |
  +----------------------+  +----------------------+
              |
  +-----------+---------+
  | S3 Bucket           |
  | (Static assets,     |
  |  uploads, backups)  |
  +---------------------+
```

### Resources

| Resource | Type | Notes |
|----------|------|-------|
| VPC + Subnets (4+) | Multiple | Public (2) + Private (2+) |
| Internet Gateway | `AWS::EC2::InternetGateway` | Public access |
| NAT Gateway (x2) | `AWS::EC2::NatGateway` | Private subnet outbound |
| ALB | `AWS::ElasticLoadBalancingV2::LoadBalancer` | internet-facing |
| Target Group | `AWS::ElasticLoadBalancingV2::TargetGroup` | Stickiness optional |
| Launch Template | `AWS::EC2::LaunchTemplate` | Full config with UserData |
| Auto Scaling Group | `AWS::AutoScaling::AutoScalingGroup` | min:2, max:12 |
| Scaling Policies (x2) | `AWS::AutoScaling::ScalingPolicy` | CPU + request count |
| RDS Instance | `AWS::RDS::DBInstance` | Multi-AZ, encrypted |
| ElastiCache Replication Group | `AWS::ElastiCache::ReplicationGroup` | Redis, Multi-AZ |
| ElastiCache Subnet Group | `AWS::ElastiCache::SubnetGroup` | Private subnets |
| CloudFront Distribution | `AWS::CloudFront::Distribution` | S3 + ALB origins |
| S3 Bucket | `AWS::S3::Bucket` | Static assets, encrypted |
| Security Groups (x4) | `AWS::EC2::SecurityGroup` | ALB, App, DB, Cache |
| CloudWatch Alarms | `AWS::CloudWatch::Alarm` | CPU, memory, latency, 5xx |
| Log Group | `AWS::Logs::LogGroup` | Centralized logging |

### Use Cases

- High-traffic SaaS applications
- E-commerce platforms with seasonal spikes
- Media/content sites with heavy read traffic
- Applications requiring sub-100ms response times (caching)
- Multi-tier applications with CDN for global reach

### Scaling Limits

- **Auto Scaling**: 2-12+ instances
- **CloudFront**: Handles millions of requests/second at edge
- **Redis cache**: Sub-millisecond reads, offloads database
- **Database**: Multi-AZ with read replicas possible
- **Throughput**: 50,000-500,000+ requests/day easily

### Monthly Cost Estimate

| Component | Minimum | Typical |
|-----------|---------|---------|
| EC2 m6i.large (x2) | $138.70 | -- |
| EC2 m6i.xlarge (x3 avg) | -- | $416.10 |
| EBS 30GB gp3 (x3) | $7.20 | $7.20 |
| ALB | $30.00 | $45.00 |
| NAT Gateway (x2) | $65.70 | $65.70 |
| RDS db.m6g.large Multi-AZ | $235.06 | -- |
| RDS db.m6g.xlarge Multi-AZ | -- | $470.12 |
| RDS Storage 100GB | $11.50 | $11.50 |
| ElastiCache cache.m6g.large | $115.34 | $115.34 |
| CloudFront (100GB) | $8.50 | $8.50 |
| S3 (50GB + requests) | $2.00 | $5.00 |
| CloudWatch | $5.00 | $10.00 |
| Data Transfer (100GB) | $9.00 | $9.00 |
| **Total** | **~$628** | **~$1,163** |

> Note: Costs scale down when ASG runs fewer instances during low-traffic periods.
> Spot instances can reduce EC2 costs by 60-70% for fault-tolerant workloads.

---

## Pattern 5: Serverless

### Architecture Diagram

```
                        Internet
                           |
             +-------------+-------------+
             |     API Gateway           |
             |     (REST or HTTP API)    |
             |     Custom Domain +       |
             |     ACM Certificate       |
             +------+------+------+------+
                    |      |      |
              +-----+  +---+---+  +-----+
              |        |       |        |
        +-----+--+ +--+----+ +--+------+
        | Lambda  | | Lambda | | Lambda  |
        | GET /   | | POST / | | GET /   |
        | users   | | users  | | items   |
        +---------+ +--------+ +---------+
              |          |          |
              +----------+----------+
                         |
              +----------+----------+
              |                     |
        +-----+------+    +--------+--------+
        | DynamoDB   |    | S3 Bucket       |
        | (or RDS    |    | (Static site /  |
        |  Proxy +   |    |  uploads)       |
        |  Aurora)   |    +-----------------+
        +-----+------+
              |
        +-----+------+
        | CloudWatch  |
        | Logs +      |
        | X-Ray       |
        +-------------+

   Optional additions:
   +-------------+  +-------------+  +-------------+
   | SQS Queue   |  | SNS Topic   |  | EventBridge |
   | (async      |  | (fan-out    |  | (scheduled  |
   |  processing)|  |  notify)    |  |  triggers)  |
   +-------------+  +-------------+  +-------------+
```

### Resources

| Resource | Type | Notes |
|----------|------|-------|
| API Gateway REST API | `AWS::ApiGateway::RestApi` | Or HTTP API for simpler use |
| API Resources | `AWS::ApiGateway::Resource` | Path definitions |
| API Methods | `AWS::ApiGateway::Method` | GET, POST, etc. |
| API Deployment + Stage | `AWS::ApiGateway::Deployment` | prod stage |
| Lambda Functions | `AWS::Lambda::Function` | One per endpoint or shared |
| Lambda IAM Role | `AWS::IAM::Role` | Least-privilege per function |
| DynamoDB Table | `AWS::DynamoDB::Table` | On-demand or provisioned |
| S3 Bucket (static) | `AWS::S3::Bucket` | Optional: static website |
| S3 Bucket (uploads) | `AWS::S3::Bucket` | Optional: file storage |
| CloudWatch Log Groups | `AWS::Logs::LogGroup` | One per Lambda function |

### Use Cases

- REST/GraphQL APIs with variable traffic
- Webhook receivers and event processors
- Static websites with dynamic API backends
- Scheduled tasks (cron jobs via EventBridge)
- Prototype and MVP deployments (pay-per-use)
- Mobile app backends
- IoT data ingestion pipelines

### Scaling Limits

- **Lambda concurrent executions**: 1,000 default (requestable to 10,000+)
- **API Gateway**: 10,000 requests/second (burstable)
- **DynamoDB**: Virtually unlimited with on-demand mode
- **Cold starts**: 100ms-2s depending on runtime and package size
- **Lambda timeout**: Max 15 minutes per invocation
- **Payload size**: API Gateway max 10MB request/response

### Monthly Cost Estimate

| Component | Low Traffic | Moderate Traffic |
|-----------|-------------|------------------|
| API Gateway (1M requests) | $3.50 | -- |
| API Gateway (10M requests) | -- | $35.00 |
| Lambda (1M invocations, 256MB, 200ms) | $0.63 | -- |
| Lambda (10M invocations, 512MB, 300ms) | -- | $18.34 |
| DynamoDB On-Demand (1M r/w) | $1.50 | -- |
| DynamoDB On-Demand (10M r/w) | -- | $15.00 |
| S3 (10GB) | $0.23 | $0.23 |
| CloudWatch Logs (5GB) | $2.50 | $5.00 |
| Data Transfer (5GB) | $0.45 | $4.50 |
| **Total** | **~$9** | **~$78** |

> Note: Lambda and API Gateway have generous free tiers (1M requests/month each).
> First 12 months or always-free tier can bring costs to near $0 for low traffic.

---

## Pattern 6: Container (EKS)

### Architecture Diagram

```
                            Internet
                               |
                 +-------------+-------------+
                 |           VPC             |
                 |      10.0.0.0/16         |
                 |                           |
     +-----------+-----------+ +-------------+-----------+
     | Public Subnet (AZ-a)  | | Public Subnet (AZ-b)   |
     | 10.0.1.0/24          | | 10.0.2.0/24            |
     +-----------+-----------+ +-------------+-----------+
                 |                           |
     +-----------+---------------------------+-----------+
     |    Application Load Balancer (ALB)                |
     |    (AWS Load Balancer Controller / Ingress)       |
     +--------+--------------------------+--------------+
              |                          |
     +--------+---------+      +--------+---------+
     | Private Subnet   |      | Private Subnet   |
     | AZ-a             |      | AZ-b             |
     | 10.0.10.0/24    |      | 10.0.11.0/24    |
     |                  |      |                  |
     |  +===========================+             |
     |  | EKS Cluster               |             |
     |  | (Control Plane - managed) |             |
     |  +===========================+             |
     |        |                |                  |
     |  +-----+------+  +-----+------+           |
     |  | Node Group |  | Node Group |           |
     |  | (Worker)   |  | (Worker)   |           |
     |  | m6i.large  |  | m6i.large  |           |
     |  |            |  |            |           |
     |  | +--------+ |  | +--------+ |           |
     |  | |Pod: App| |  | |Pod: App| |           |
     |  | +--------+ |  | +--------+ |           |
     |  | +--------+ |  | +--------+ |           |
     |  | |Pod: API| |  | |Pod: API| |           |
     |  | +--------+ |  | +--------+ |           |
     |  +------------+  +------------+           |
     |        |                                   |
     |  +-----+------+                           |
     |  | ECR        |   +------------------+    |
     |  | (Container |   | RDS (optional)   |    |
     |  |  Registry) |   | Multi-AZ         |    |
     |  +------------+   +------------------+    |
     |                                           |
     |  +-------------------+                    |
     |  | NAT Gateway (x2)  |                    |
     |  | (Private subnet   |                    |
     |  |  outbound)        |                    |
     |  +-------------------+                    |
     +-------------------------------------------+
```

### Resources

| Resource | Type | Notes |
|----------|------|-------|
| VPC + Subnets (4+) | Multiple | Public (2) + Private (2+) |
| Internet Gateway | `AWS::EC2::InternetGateway` | Public access |
| NAT Gateway (x2) | `AWS::EC2::NatGateway` | Private subnet outbound for nodes |
| EKS Cluster | `AWS::EKS::Cluster` | Managed control plane |
| EKS Node Group | `AWS::EKS::Nodegroup` | Managed worker nodes |
| ECR Repository | `AWS::ECR::Repository` | Container image storage |
| IAM Roles (x3+) | `AWS::IAM::Role` | Cluster role, node role, pod roles |
| ALB | `AWS::ElasticLoadBalancingV2::LoadBalancer` | Via AWS LB Controller |
| Security Groups (x3+) | `AWS::EC2::SecurityGroup` | Cluster, node, DB |
| RDS Instance (optional) | `AWS::RDS::DBInstance` | Managed database |
| DB Subnet Group | `AWS::RDS::DBSubnetGroup` | Private subnets |
| CloudWatch Log Group | `AWS::Logs::LogGroup` | EKS control plane logs |

### Use Cases

- Microservices architectures (multiple services in one cluster)
- Teams running Docker containers in production
- Applications requiring service mesh (Istio, Linkerd)
- CI/CD pipelines deploying container images
- Polyglot environments (Node.js + Python + Go in one cluster)
- Organizations standardizing on Kubernetes across clouds

### Scaling Limits

- **Pod autoscaling**: Horizontal Pod Autoscaler (HPA), unlimited pods
- **Node autoscaling**: Cluster Autoscaler or Karpenter
- **Max nodes per cluster**: 5,000 (AWS limit)
- **Max pods per node**: 17-110 (depends on instance ENI limits)
- **Multi-service**: Single cluster runs dozens of microservices
- **Rolling deployments**: Native Kubernetes rolling updates

### Monthly Cost Estimate

| Component | Minimum (2 nodes) | Typical (4 nodes) |
|-----------|--------------------|--------------------|
| EKS Control Plane | $73.00 | $73.00 |
| EC2 m6i.large (x2) | $138.70 | -- |
| EC2 m6i.large (x4) | -- | $277.40 |
| EBS 30GB gp3 (per node) | $4.80 | $9.60 |
| NAT Gateway (x2) | $65.70 | $65.70 |
| ALB (via Ingress) | $22.00 | $35.00 |
| ECR (5GB images) | $0.50 | $0.50 |
| RDS db.m6g.large Multi-AZ | $235.06 | $235.06 |
| RDS Storage 50GB | $5.75 | $5.75 |
| CloudWatch | $5.00 | $10.00 |
| Data Transfer (50GB) | $4.50 | $4.50 |
| **Total** | **~$555** | **~$716** |

> Note: Fargate (serverless containers) eliminates node management but costs ~20-30% more.
> Spot instances for worker nodes can reduce EC2 costs by 60-70%.
> Graviton (ARM) instances (m6g, c6g) are ~20% cheaper than Intel equivalents.

---

## Pattern Comparison Matrix

| Feature | Lite | Standard | HA | Elastic | Serverless | Container |
|---------|------|----------|----|---------|------------|-----------|
| High Availability | No | No | Yes | Yes | Yes (managed) | Yes |
| Auto Scaling | No | No | Yes | Yes | Yes (automatic) | Yes |
| Managed Database | No | Yes | Yes (Multi-AZ) | Yes (Multi-AZ) | Optional | Optional |
| Caching Layer | No | No | No | Yes (Redis) | No | Optional |
| CDN | No | No | No | Yes (CloudFront) | Optional | Optional |
| Zero-Downtime Deploy | No | No | Yes (rolling) | Yes (rolling) | Yes (versioned) | Yes (rolling) |
| Min Monthly Cost | $10 | $49 | $199 | $628 | $0 (free tier) | $555 |
| Setup Complexity | Low | Low-Med | Medium | High | Medium | High |
| Ops Overhead | High (manual) | Medium | Low-Med | Low-Med | Very Low | Medium |
| Vendor Lock-in | Low | Low | Low | Low-Med | High | Low (K8s) |

---

## Migration Paths

```
  lite --> standard --> ha --> elastic
    \                          /
     \--> serverless ---------/
      \                      /
       \--> container ------/
```

- **lite --> standard**: Add ALB + RDS, move DB off EC2
- **standard --> ha**: Add ASG + Launch Template + Multi-AZ RDS
- **ha --> elastic**: Add ElastiCache + CloudFront + NAT Gateways
- **lite --> serverless**: Rewrite to Lambda functions + API Gateway
- **lite --> container**: Dockerize app, deploy to EKS
- **serverless --> elastic**: When Lambda limits hit or cold starts unacceptable
- **container --> elastic**: When Kubernetes overhead not justified
