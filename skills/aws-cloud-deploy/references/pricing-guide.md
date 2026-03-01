# AWS Pricing Guide

Comprehensive AWS pricing reference for the AI deployment agent.
All prices are **US East (N. Virginia) us-east-1** baseline in **USD/month** unless noted.
Prices are approximate and subject to change. Always verify against current AWS pricing pages.

> **Last Updated**: 2025 Q4 pricing. Apply region multipliers (see bottom) for other regions.

---

## Table of Contents

1. [Compute (EC2)](#compute-ec2)
2. [Compute (Lambda)](#compute-lambda)
3. [Database (RDS)](#database-rds)
4. [Database (DynamoDB)](#database-dynamodb)
5. [Database (Aurora)](#database-aurora)
6. [Cache (ElastiCache)](#cache-elasticache)
7. [Networking](#networking)
8. [Storage (S3)](#storage-s3)
9. [Storage (EBS)](#storage-ebs)
10. [Container Services](#container-services)
11. [CDN (CloudFront)](#cdn-cloudfront)
12. [Security Services](#security-services)
13. [Monitoring and Logging](#monitoring-and-logging)
14. [DNS and Certificates](#dns-and-certificates)
15. [Data Transfer](#data-transfer)
16. [Free Tier Summary](#free-tier-summary)
17. [Region Multipliers](#region-multipliers)
18. [Pattern Cost Estimates](#pattern-cost-estimates)

---

## Compute (EC2)

### On-Demand Instance Pricing (Linux, us-east-1)

| Instance Type | vCPU | Memory | $/Hour | $/Month (730h) | Use Case |
|--------------|------|--------|--------|-----------------|----------|
| t3.micro | 2 | 1 GiB | $0.0104 | $7.59 | Dev/test, free tier eligible |
| t3.small | 2 | 2 GiB | $0.0208 | $15.18 | Light workloads |
| t3.medium | 2 | 4 GiB | $0.0416 | $30.37 | Small production |
| t3.large | 2 | 8 GiB | $0.0832 | $60.74 | Medium workloads |
| t3.xlarge | 4 | 16 GiB | $0.1664 | $121.47 | Larger workloads |
| m6i.large | 2 | 8 GiB | $0.0950 | $69.35 | General production |
| m6i.xlarge | 4 | 16 GiB | $0.1900 | $138.70 | Medium production |
| m6i.2xlarge | 8 | 32 GiB | $0.3800 | $277.40 | Large production |
| m6i.4xlarge | 16 | 64 GiB | $0.7600 | $554.80 | Heavy production |
| c6i.large | 2 | 4 GiB | $0.0850 | $62.05 | Compute intensive |
| c6i.xlarge | 4 | 8 GiB | $0.1700 | $124.10 | Compute intensive |
| r6i.large | 2 | 16 GiB | $0.1260 | $91.98 | Memory intensive |
| r6i.xlarge | 4 | 32 GiB | $0.2520 | $183.96 | Memory intensive |

### Graviton (ARM) Instances (~20% cheaper)

| Instance Type | vCPU | Memory | $/Hour | $/Month (730h) | Savings vs Intel |
|--------------|------|--------|--------|-----------------|------------------|
| t4g.micro | 2 | 1 GiB | $0.0084 | $6.13 | 19% |
| t4g.small | 2 | 2 GiB | $0.0168 | $12.26 | 19% |
| t4g.medium | 2 | 4 GiB | $0.0336 | $24.53 | 19% |
| m6g.large | 2 | 8 GiB | $0.0770 | $56.21 | 19% |
| m6g.xlarge | 4 | 16 GiB | $0.1540 | $112.42 | 19% |
| m6g.2xlarge | 8 | 32 GiB | $0.3080 | $224.84 | 19% |

### Savings Plans & Reserved Instances

| Commitment | 1-Year No Upfront | 1-Year All Upfront | 3-Year All Upfront |
|------------|--------------------|--------------------|---------------------|
| Discount vs On-Demand | ~30-35% | ~35-40% | ~55-60% |
| Risk Level | Low | Medium | High |
| Flexibility | Compute SP: any instance | Specific instance type | Specific instance type |

### Spot Instance Discounts

| Instance Family | Typical Spot Discount | Interruption Frequency |
|----------------|----------------------|------------------------|
| t3.* | 60-70% off | Low (<5%) |
| m6i.* | 60-70% off | Low-Medium (5-15%) |
| c6i.* | 65-75% off | Medium (5-15%) |
| r6i.* | 65-75% off | Medium (5-15%) |

> **Agent Note**: Recommend Spot for stateless worker nodes, dev environments, and batch jobs.
> Never use Spot for single-instance production or databases.

---

## Compute (Lambda)

### Pricing

| Component | Free Tier (Always) | Price After Free Tier |
|-----------|--------------------|-----------------------|
| Requests | 1,000,000/month | $0.20 per 1M requests |
| Duration (GB-seconds) | 400,000 GB-sec/month | $0.0000166667/GB-second |
| Provisioned Concurrency | N/A | $0.0000041667/GB-second (idle) |

### Cost Examples

| Scenario | Requests/mo | Avg Duration | Memory | Monthly Cost |
|----------|-------------|-------------|--------|--------------|
| Light API | 100K | 100ms | 256MB | ~$0.00 (free tier) |
| Moderate API | 1M | 200ms | 256MB | ~$0.63 |
| Busy API | 5M | 200ms | 512MB | ~$9.17 |
| Heavy API | 10M | 300ms | 512MB | ~$27.50 |
| Heavy + Provisioned | 10M | 300ms | 512MB + 100 PC | ~$57.50 |

### Duration Calculation

```
Cost = (Requests * $0.20/1M) + (GB-seconds * $0.0000166667)
GB-seconds = Requests * (MemoryMB / 1024) * DurationSeconds
```

### Example Calculation (10M requests, 512MB, 300ms)

```
Request cost:  10,000,000 / 1,000,000 * $0.20 = $2.00
GB-seconds:    10,000,000 * (512/1024) * 0.3 = 1,500,000 GB-sec
Duration cost: (1,500,000 - 400,000) * $0.0000166667 = $18.33
Total:         $2.00 + $18.33 = $20.33
```

---

## Database (RDS)

### RDS Instance Pricing (MySQL / PostgreSQL, Single-AZ)

| Instance Type | vCPU | Memory | $/Hour | $/Month (730h) |
|--------------|------|--------|--------|-----------------|
| db.t3.micro | 2 | 1 GiB | $0.0170 | $12.41 |
| db.t3.small | 2 | 2 GiB | $0.0340 | $24.82 |
| db.t3.medium | 2 | 4 GiB | $0.0680 | $49.64 |
| db.t3.large | 2 | 8 GiB | $0.1360 | $99.28 |
| db.m6g.large | 2 | 8 GiB | $0.1610 | $117.53 |
| db.m6g.xlarge | 4 | 16 GiB | $0.3220 | $235.06 |
| db.m6g.2xlarge | 8 | 32 GiB | $0.6440 | $470.12 |
| db.m6g.4xlarge | 16 | 64 GiB | $1.2880 | $940.24 |
| db.r6g.large | 2 | 16 GiB | $0.2380 | $173.74 |
| db.r6g.xlarge | 4 | 32 GiB | $0.4760 | $347.48 |

### Multi-AZ Pricing

Multi-AZ deployment **doubles the instance cost** (standby instance in another AZ).

| Instance Type | Single-AZ $/mo | Multi-AZ $/mo |
|--------------|-----------------|----------------|
| db.t3.micro | $12.41 | $24.82 |
| db.t3.small | $24.82 | $49.64 |
| db.t3.medium | $49.64 | $99.28 |
| db.m6g.large | $117.53 | $235.06 |
| db.m6g.xlarge | $235.06 | $470.12 |
| db.m6g.2xlarge | $470.12 | $940.24 |

### RDS Storage Pricing

| Storage Type | $/GB-month | IOPS | Throughput |
|-------------|------------|------|------------|
| gp3 (General Purpose SSD) | $0.115 | 3,000 baseline (free) | 125 MiB/s baseline |
| gp3 additional IOPS | $0.08/IOPS-mo | Above 3,000 | -- |
| gp3 additional throughput | $0.095/MiB/s-mo | -- | Above 125 MiB/s |
| io1 (Provisioned IOPS SSD) | $0.125 | $0.10/IOPS-mo | -- |
| Magnetic (previous gen) | $0.10 | -- | -- |

### RDS Backup Storage

| Component | Price |
|-----------|-------|
| Automated backups (up to DB size) | Free |
| Automated backups (excess) | $0.095/GB-month |
| Manual snapshots | $0.095/GB-month |
| Cross-region snapshot copy | $0.095/GB-month + transfer |

---

## Database (DynamoDB)

### On-Demand Capacity

| Operation | Price |
|-----------|-------|
| Write Request Units (WRU) | $1.25 per million |
| Read Request Units (RRU) | $0.25 per million |
| Replicated writes (Global Tables) | $1.875 per million |

### Provisioned Capacity

| Component | Price | Free Tier |
|-----------|-------|-----------|
| Write Capacity Unit (WCU) | $0.00065/WCU-hour ($0.4745/WCU-month) | 25 WCU |
| Read Capacity Unit (RCU) | $0.00013/RCU-hour ($0.0949/RCU-month) | 25 RCU |

### DynamoDB Storage

| Component | Price |
|-----------|-------|
| Data storage | $0.25/GB-month (first 25GB free) |
| Continuous backups (PITR) | $0.20/GB-month |
| On-demand backups | $0.10/GB-month |
| Global Tables replicated storage | $0.25/GB-month per region |

### Cost Examples

| Scenario | Reads/mo | Writes/mo | Storage | Monthly Cost |
|----------|----------|-----------|---------|-------------|
| Light app | 500K | 100K | 1GB | ~$0.25 |
| Moderate app | 5M | 1M | 10GB | ~$3.75 |
| Heavy app | 50M | 10M | 100GB | ~$37.50 |

---

## Database (Aurora)

### Aurora Instance Pricing (MySQL/PostgreSQL Compatible)

| Instance Type | vCPU | Memory | $/Hour | $/Month |
|--------------|------|--------|--------|---------|
| db.t3.medium | 2 | 4 GiB | $0.0820 | $59.86 |
| db.t3.large | 2 | 8 GiB | $0.1640 | $119.72 |
| db.r6g.large | 2 | 16 GiB | $0.2600 | $189.80 |
| db.r6g.xlarge | 4 | 32 GiB | $0.5200 | $379.60 |

### Aurora Storage

| Component | Price |
|-----------|-------|
| Storage | $0.10/GB-month |
| I/O requests | $0.20 per million |
| Backup (beyond retention) | $0.021/GB-month |

### Aurora Serverless v2

| Component | Price |
|-----------|-------|
| ACU-hours | $0.12/ACU-hour |
| Min capacity | 0.5 ACU ($0.06/hour = $43.80/month) |
| Storage | Same as Aurora standard |

---

## Cache (ElastiCache)

### ElastiCache Redis Pricing

| Instance Type | vCPU | Memory | $/Hour | $/Month (730h) |
|--------------|------|--------|--------|-----------------|
| cache.t3.micro | 2 | 0.5 GiB | $0.0170 | $12.41 |
| cache.t3.small | 2 | 1.37 GiB | $0.0340 | $24.82 |
| cache.t3.medium | 2 | 3.09 GiB | $0.0680 | $49.64 |
| cache.m6g.large | 2 | 6.38 GiB | $0.1580 | $115.34 |
| cache.m6g.xlarge | 4 | 12.93 GiB | $0.3160 | $230.68 |
| cache.m6g.2xlarge | 8 | 26.04 GiB | $0.6320 | $461.36 |
| cache.r6g.large | 2 | 13.07 GiB | $0.2260 | $164.98 |
| cache.r6g.xlarge | 4 | 26.32 GiB | $0.4520 | $329.96 |

### ElastiCache Backup

| Component | Price |
|-----------|-------|
| Backup storage (up to cluster size) | Free |
| Backup storage (excess) | $0.085/GB-month |

### ElastiCache Multi-AZ (Replication Group)

A 2-node replication group (1 primary + 1 replica) costs **2x the instance price**.
This is the recommended setup for production Redis.

---

## Networking

### Elastic IP (EIP)

| Condition | Price |
|-----------|-------|
| Associated with running instance | $0.00/month (Free) |
| NOT associated (idle) | $0.005/hour = ~$3.65/month |
| Additional EIP per instance | $0.005/hour = ~$3.65/month |
| Remapping (>100/month) | $0.10/remap |

### Load Balancers

| Load Balancer Type | Base Cost/month | Usage Cost |
|-------------------|-----------------|------------|
| Application Load Balancer (ALB) | $16.43 ($0.0225/hour) | $5.84/LCU-hour |
| Network Load Balancer (NLB) | $16.43 ($0.0225/hour) | $4.38/NLCU-hour |
| Gateway Load Balancer (GLB) | $16.43 ($0.0225/hour) | $2.92/GLCU-hour |
| Classic Load Balancer (CLB) | $18.25 ($0.025/hour) | $0.008/GB processed |

### LCU Dimensions (ALB)

An LCU measures on 4 dimensions; you pay for the highest:

| Dimension | 1 LCU = |
|-----------|---------|
| New connections | 25/second |
| Active connections | 3,000 |
| Processed bytes | 1 GB/hour |
| Rule evaluations | 1,000/second |

### Typical ALB Monthly Cost Examples

| Traffic Level | Estimated LCU | Base + Usage |
|---------------|---------------|-------------|
| Light (<100 req/s) | ~0.5 LCU | ~$19 |
| Moderate (100-500 req/s) | ~2-5 LCU | ~$22-35 |
| Heavy (500-2000 req/s) | ~5-15 LCU | ~$35-70 |

### NAT Gateway

| Component | Price |
|-----------|-------|
| Hourly charge | $0.045/hour = $32.85/month |
| Data processing | $0.045/GB |

> **Cost Warning**: NAT Gateway is one of the most expensive networking components.
> A single NAT Gateway processing 100GB/month costs $32.85 + $4.50 = $37.35.
> Two NAT Gateways (HA) = ~$70/month before data charges.

### NAT Gateway Alternatives (Cost Optimization)

| Alternative | Cost | Trade-off |
|-------------|------|-----------|
| NAT Instance (t3.micro) | ~$7.59/mo | Manual management, lower throughput |
| VPC Endpoints | $7.30/mo/endpoint | Only for AWS services (S3, DynamoDB) |
| S3 Gateway Endpoint | Free | S3 only |
| DynamoDB Gateway Endpoint | Free | DynamoDB only |

### VPC Endpoints (PrivateLink)

| Type | Cost |
|------|------|
| Gateway Endpoint (S3, DynamoDB) | Free |
| Interface Endpoint | $0.01/hour/AZ = $7.30/month/AZ |
| Interface Endpoint data processing | $0.01/GB |

---

## Storage (S3)

### S3 Storage Classes

| Storage Class | $/GB-month | Retrieval | Min Duration | Use Case |
|--------------|------------|-----------|-------------|----------|
| Standard | $0.023 | Free | None | Frequently accessed |
| Intelligent-Tiering | $0.023 (frequent) | Free | None | Unknown access patterns |
| Infrequent Access (IA) | $0.0125 | $0.01/GB | 30 days | Infrequent but fast access |
| One Zone-IA | $0.01 | $0.01/GB | 30 days | Reproducible data |
| Glacier Instant | $0.004 | $0.03/GB | 90 days | Archive, instant access |
| Glacier Flexible | $0.0036 | $0.01-$10/GB | 90 days | Archive, minutes-hours |
| Glacier Deep Archive | $0.00099 | $0.02-$20/GB | 180 days | Long-term archive |

### S3 Request Pricing

| Request Type | Standard | IA | Glacier |
|-------------|----------|-----|---------|
| PUT, COPY, POST, LIST | $0.005/1K | $0.01/1K | $0.05/1K |
| GET, SELECT | $0.0004/1K | $0.001/1K | $0.0004/1K |
| Lifecycle transition | -- | $0.01/1K | $0.05/1K |

### S3 Cost Examples

| Scenario | Storage | Requests | Monthly Cost |
|----------|---------|----------|-------------|
| Static site (1GB, 100K GETs) | $0.023 | $0.04 | ~$0.10 |
| App uploads (50GB, 50K PUTs) | $1.15 | $0.25 | ~$1.40 |
| Media storage (500GB) | $11.50 | varies | ~$12-15 |
| Backup archive (1TB Glacier) | $3.60 | varies | ~$4-5 |

---

## Storage (EBS)

### EBS Volume Pricing

| Volume Type | $/GB-month | Baseline IOPS | Baseline Throughput |
|-------------|------------|---------------|---------------------|
| gp3 (General Purpose SSD) | $0.08 | 3,000 (free) | 125 MiB/s (free) |
| gp3 additional IOPS | $0.005/IOPS-mo | up to 16,000 | -- |
| gp3 additional throughput | $0.04/MiB/s-mo | -- | up to 1,000 MiB/s |
| gp2 (Previous gen SSD) | $0.10 | 3 IOPS/GB | up to 250 MiB/s |
| io2 Block Express | $0.125 | $0.065/IOPS-mo | -- |
| st1 (Throughput HDD) | $0.045 | -- | 40 MiB/s/TB |
| sc1 (Cold HDD) | $0.015 | -- | 12 MiB/s/TB |

### EBS Snapshot Pricing

| Component | Price |
|-----------|-------|
| Standard snapshot | $0.05/GB-month |
| Archive snapshot | $0.0125/GB-month |
| Fast snapshot restore | $0.75/DSU-hour per AZ |

### EBS Cost Examples

| Volume | Size | Monthly Cost |
|--------|------|-------------|
| gp3 20GB | 20 GB | $1.60 |
| gp3 50GB | 50 GB | $4.00 |
| gp3 100GB | 100 GB | $8.00 |
| gp3 500GB | 500 GB | $40.00 |

---

## Container Services

### EKS (Elastic Kubernetes Service)

| Component | Price |
|-----------|-------|
| EKS Control Plane | $0.10/hour = $73.00/month |
| EKS on Fargate | $0.04048/vCPU-hour + $0.004445/GB-hour |
| EKS on EC2 | EC2 pricing (see Compute section) |
| EKS Extended Support | Additional $0.60/cluster-hour for older K8s versions |

### ECR (Elastic Container Registry)

| Component | Price |
|-----------|-------|
| Storage | $0.10/GB-month |
| Data transfer (within region) | Free |
| Data transfer (cross-region) | Standard data transfer rates |

### ECS (Elastic Container Service)

| Component | Price |
|-----------|-------|
| ECS Control Plane | Free (no cluster charge) |
| ECS on Fargate | $0.04048/vCPU-hour + $0.004445/GB-hour |
| ECS on EC2 | EC2 pricing only |

### Fargate Pricing Examples

| Configuration | vCPU | Memory | $/Hour | $/Month (730h) |
|--------------|------|--------|--------|-----------------|
| Minimal | 0.25 | 0.5 GB | $0.0124 | $9.05 |
| Small | 0.5 | 1 GB | $0.0247 | $18.03 |
| Medium | 1 | 2 GB | $0.0494 | $36.06 |
| Large | 2 | 4 GB | $0.0989 | $72.20 |
| XLarge | 4 | 8 GB | $0.1978 | $144.39 |

> **Agent Note**: ECS (free control plane) + Fargate is cheaper than EKS + Fargate
> for simple container workloads. Recommend EKS only when Kubernetes features are needed.

---

## CDN (CloudFront)

### CloudFront Data Transfer

| Data Range | $/GB (US, Europe) | $/GB (Asia) |
|-----------|-------------------|-------------|
| First 10 TB | $0.085 | $0.120 |
| Next 40 TB | $0.080 | $0.100 |
| Next 100 TB | $0.060 | $0.080 |
| Next 350 TB | $0.040 | $0.060 |

### CloudFront Requests

| Request Type | Price (US, Europe) |
|-------------|-------------------|
| HTTP requests | $0.0075/10,000 |
| HTTPS requests | $0.01/10,000 |

### CloudFront Cost Examples

| Scenario | Transfer | Requests | Monthly Cost |
|----------|----------|----------|-------------|
| Small site (10GB, 1M req) | $0.85 | $1.00 | ~$2 |
| Medium site (100GB, 10M req) | $8.50 | $10.00 | ~$19 |
| Large site (1TB, 100M req) | $85.00 | $100.00 | ~$185 |

### CloudFront Functions vs Lambda@Edge

| Feature | CloudFront Functions | Lambda@Edge |
|---------|---------------------|-------------|
| Price per request | $0.10/1M | $0.60/1M |
| Price per duration | Free (<1ms) | $0.00000625125/128MB-ms |
| Max execution time | 1 ms | 5-30 seconds |
| Use case | URL rewrites, headers | Auth, A/B test, SSR |

---

## Security Services

### KMS (Key Management Service)

| Component | Price |
|-----------|-------|
| Customer managed key | $1.00/key/month |
| AWS managed key | Free |
| API calls (encrypt/decrypt) | $0.03/10,000 calls |
| Asymmetric RSA key | $1.00/key/month |
| Asymmetric ECC key | $1.00/key/month |

### Secrets Manager

| Component | Price |
|-----------|-------|
| Per secret | $0.40/month |
| Per API call | $0.05/10,000 calls |

### WAF (Web Application Firewall)

| Component | Price |
|-----------|-------|
| Web ACL | $5.00/month |
| Per rule | $1.00/month |
| Per request | $0.60/1M requests |
| Managed rule group | $1.00-$30.00/month (varies) |
| Bot Control | $10.00/month + $1.00/1M requests |

### WAF Cost Examples

| Setup | Rules | Traffic | Monthly Cost |
|-------|-------|---------|-------------|
| Basic (5 rules) | 5 | 1M req | ~$11 |
| Standard (10 rules + AWS managed) | 10 | 10M req | ~$22 |
| Advanced (20 rules + Bot Control) | 20 | 50M req | ~$75 |

### Shield

| Tier | Price | Protection |
|------|-------|-----------|
| Shield Standard | Free | Basic DDoS (Layer 3/4) |
| Shield Advanced | $3,000/month | Advanced DDoS + WAF credits + DRT |

### GuardDuty

| Data Source | Price |
|------------|-------|
| CloudTrail Management Events | $4.00/million events (first 500M) |
| VPC Flow Logs | $1.00/GB (first 500GB) |
| DNS Query Logs | $1.00/million queries (first 500M) |
| S3 Data Events | $0.80/million events |
| EKS Audit Logs | $1.60/million events |

### Typical GuardDuty Monthly Cost

| Environment Size | Estimated Cost |
|-----------------|---------------|
| Small (dev) | $4-10/month |
| Medium (production) | $20-50/month |
| Large (enterprise) | $100-500/month |

### Other Security Services

| Service | Pricing |
|---------|---------|
| AWS Config | $0.003/configuration item/region |
| Config Rules | $0.001/rule evaluation |
| Security Hub | $0.0010/finding-ingestion event (first 10K) |
| Macie | $0.10/bucket/month (inventory) + $1.00/GB (discovery) |
| Inspector | $0.15/instance/month + $0.01/container image |
| ACM (public certificates) | Free |
| ACM (private CA) | $400/month per CA |

---

## Monitoring and Logging

### CloudWatch

| Component | Free Tier | Price |
|-----------|-----------|-------|
| Basic metrics (5-min) | 10 metrics | Free |
| Detailed metrics (1-min) | -- | $0.30/metric/month |
| Custom metrics | -- | $0.30/metric/month (first 10K) |
| Dashboard | 3 dashboards | $3.00/dashboard/month |
| Alarms | 10 alarms | $0.10/alarm/month (standard) |
| Logs ingestion | 5GB | $0.50/GB |
| Logs storage | 5GB | $0.03/GB-month |
| Logs Insights queries | -- | $0.005/GB scanned |
| API calls (GetMetricData) | -- | $0.01/1,000 metrics requested |

### CloudWatch Cost Examples

| Setup | Metrics | Log Volume | Alarms | Monthly Cost |
|-------|---------|-----------|--------|-------------|
| Basic monitoring | 10 (free) | 5GB (free) | 10 (free) | ~$0 |
| Standard | 30 custom | 20GB | 20 | ~$20 |
| Production | 100 custom | 100GB | 50 | ~$90 |

### CloudTrail

| Component | Free Tier | Price |
|-----------|-----------|-------|
| Management events (1 trail) | Free | Free |
| Management events (additional) | -- | $2.00/100K events |
| Data events | -- | $0.10/100K events |
| Insights events | -- | $0.35/100K events analyzed |
| S3 log delivery | -- | Standard S3 pricing |

### X-Ray

| Component | Free Tier | Price |
|-----------|-----------|-------|
| Traces recorded | 100K/month | $5.00/1M traces |
| Traces retrieved | 1M/month | $0.50/1M traces |
| Traces scanned | 1M/month | $0.50/1M traces |

---

## DNS and Certificates

### Route 53

| Component | Price |
|-----------|-------|
| Hosted Zone | $0.50/month per zone |
| Standard queries | $0.40/1M queries |
| Latency/Geolocation queries | $0.60/1M queries |
| Alias queries (to AWS resources) | Free |
| Health checks (basic) | $0.50/month |
| Health checks (HTTPS + string match) | $2.00/month |

### ACM (AWS Certificate Manager)

| Component | Price |
|-----------|-------|
| Public SSL/TLS certificates | **Free** (for use with ALB, CloudFront, API GW) |
| Private CA | $400/month per CA |
| Private certificates | $0.75/certificate (first 1000) |

---

## Data Transfer

### Data Transfer Pricing

| Direction | Price |
|-----------|-------|
| Inbound (Internet --> AWS) | **Free** |
| Outbound (AWS --> Internet, first 100GB/month) | **Free** |
| Outbound (AWS --> Internet, next 10TB) | $0.09/GB |
| Outbound (AWS --> Internet, next 40TB) | $0.085/GB |
| Outbound (AWS --> Internet, next 100TB) | $0.07/GB |
| Same AZ (private IP) | **Free** |
| Cross-AZ (same region) | $0.01/GB each way |
| Cross-region | $0.02/GB |
| VPC Peering (cross-AZ) | $0.01/GB each way |

### Data Transfer Cost Examples

| Scenario | Volume | Monthly Cost |
|----------|--------|-------------|
| Small site (5GB out) | 5 GB | ~$0.00 (free tier) |
| Medium site (50GB out) | 50 GB | ~$4.50 |
| Large site (500GB out) | 500 GB | ~$45.00 |
| High traffic (2TB out) | 2 TB | ~$180.00 |

---

## Free Tier Summary

### Always Free

| Service | Free Amount |
|---------|------------|
| Lambda | 1M requests + 400K GB-seconds/month |
| DynamoDB | 25 WCU + 25 RCU + 25GB storage |
| S3 | -- (no always-free tier) |
| CloudWatch | 10 metrics + 10 alarms + 5GB logs |
| CloudTrail | 1 management event trail |
| SNS | 1M publishes + 100K HTTP deliveries |
| SQS | 1M requests/month |
| API Gateway | -- (12-month only) |
| KMS | AWS managed keys (free) |
| ACM | Public certificates (unlimited, free) |

### 12-Month Free Tier (New Accounts)

| Service | Free Amount | Worth |
|---------|------------|-------|
| EC2 | 750 hours t2.micro or t3.micro | ~$7.59/mo |
| RDS | 750 hours db.t2.micro or db.t3.micro | ~$12.41/mo |
| S3 | 5GB Standard + 20K GET + 2K PUT | ~$0.12/mo |
| CloudFront | 50GB transfer + 2M requests | ~$5/mo |
| EBS | 30GB SSD (gp2/gp3) | ~$2.40/mo |
| ElastiCache | 750 hours cache.t2.micro or cache.t3.micro | ~$12.41/mo |
| API Gateway | 1M HTTP API calls/month | ~$1/mo |
| ELB | 750 hours + 15 LCU | ~$16/mo |

---

## Region Multipliers

Apply these multipliers to US East (N. Virginia) baseline prices.
Multipliers are approximate and vary by service. Compute and database tend to vary
more than storage and networking.

| Region | Code | Multiplier | Notes |
|--------|------|-----------|-------|
| US East (N. Virginia) | us-east-1 | 1.00x | Baseline, cheapest overall |
| US East (Ohio) | us-east-2 | 1.00x | Same as Virginia for most services |
| US West (Oregon) | us-west-2 | 1.00x | Same as Virginia for most services |
| US West (N. California) | us-west-1 | 1.10x | ~10% premium |
| Canada (Central) | ca-central-1 | 1.05x | ~5% premium |
| Europe (Ireland) | eu-west-1 | 1.05x | Cheapest EU region |
| Europe (London) | eu-west-2 | 1.08x | ~8% premium |
| Europe (Frankfurt) | eu-central-1 | 1.10x | ~10% premium |
| Europe (Paris) | eu-west-3 | 1.08x | ~8% premium |
| Europe (Stockholm) | eu-north-1 | 1.05x | ~5% premium |
| Asia Pacific (Mumbai) | ap-south-1 | 1.05x | Cheapest APAC region |
| Asia Pacific (Singapore) | ap-southeast-1 | 1.10x | ~10% premium |
| Asia Pacific (Sydney) | ap-southeast-2 | 1.15x | ~15% premium |
| Asia Pacific (Tokyo) | ap-northeast-1 | 1.20x | ~20% premium |
| Asia Pacific (Seoul) | ap-northeast-2 | 1.15x | ~15% premium |
| Asia Pacific (Jakarta) | ap-southeast-3 | 1.15x | ~15% premium |
| Middle East (Bahrain) | me-south-1 | 1.15x | ~15% premium |
| South America (Sao Paulo) | sa-east-1 | 1.40x | Most expensive major region |
| Africa (Cape Town) | af-south-1 | 1.30x | ~30% premium |

### Cost Impact Examples

A `standard` pattern costing ~$80/month in us-east-1 would cost:

| Region | Multiplier | Estimated Cost |
|--------|-----------|---------------|
| us-east-1 (Virginia) | 1.00x | ~$80 |
| eu-west-1 (Ireland) | 1.05x | ~$84 |
| ap-northeast-1 (Tokyo) | 1.20x | ~$96 |
| sa-east-1 (Sao Paulo) | 1.40x | ~$112 |

---

## Pattern Cost Estimates

Quick reference linking architecture patterns to estimated monthly costs.

### Lite Pattern

| Budget | Instance | RDS | Total |
|--------|----------|-----|-------|
| Minimal | t3.micro ($7.59) | None (SQLite) | ~$10 |
| Comfortable | t3.small ($15.18) | None | ~$18 |

### Standard Pattern

| Budget | Instance | RDS | ALB | Total |
|--------|----------|-----|-----|-------|
| Minimal | t3.small ($15) | db.t3.micro ($12) | $16 | ~$49 |
| Comfortable | t3.medium ($30) | db.t3.small ($25) | $22 | ~$82 |

### HA Pattern

| Budget | Instances (x2) | RDS Multi-AZ | ALB | Total |
|--------|----------------|-------------|-----|-------|
| Minimal | t3.medium x2 ($61) | db.t3.medium ($99) | $22 | ~$199 |
| Comfortable | m6i.large x2 ($139) | db.m6g.large ($235) | $30 | ~$422 |

### Elastic Pattern

| Budget | Instances (x2-4) | RDS Multi-AZ | Cache | CDN | NAT (x2) | ALB | Total |
|--------|-------------------|-------------|-------|-----|-----------|-----|-------|
| Minimal | m6i.large x2 ($139) | db.m6g.large ($235) | cache.m6g.large ($115) | $9 | $66 | $30 | ~$628 |
| Comfortable | m6i.xlarge x3 ($416) | db.m6g.xlarge ($470) | cache.m6g.large ($115) | $9 | $66 | $45 | ~$1,163 |

### Serverless Pattern

| Budget | Lambda | API Gateway | DynamoDB | Total |
|--------|--------|-------------|----------|-------|
| Free tier | Free | Free | Free | ~$0 |
| Light | $0.63 | $3.50 | $1.50 | ~$9 |
| Moderate | $18 | $35 | $15 | ~$78 |

### Container Pattern

| Budget | EKS | Nodes (x2-4) | RDS Multi-AZ | NAT (x2) | ALB | Total |
|--------|-----|--------------|-------------|-----------|-----|-------|
| Minimal | $73 | m6i.large x2 ($139) | db.m6g.large ($235) | $66 | $22 | ~$555 |
| Comfortable | $73 | m6i.large x4 ($277) | db.m6g.large ($235) | $66 | $35 | ~$716 |

---

## Cost Optimization Tips for the Agent

1. **Always check free tier eligibility** before recommending paid resources
2. **Graviton instances** (t4g, m6g, c6g, r6g) save ~20% vs Intel equivalents
3. **Spot instances** for stateless workloads save 60-70%
4. **Reserved Instances / Savings Plans** for stable workloads save 30-60%
5. **NAT Gateway** is expensive -- use VPC endpoints for S3/DynamoDB, or NAT Instance for dev
6. **Right-size databases** -- start small, scale up based on CloudWatch metrics
7. **S3 Lifecycle rules** to move old data to cheaper storage classes
8. **CloudFront** reduces data transfer costs (cheaper than direct from EC2/ALB)
9. **gp3 over gp2** -- gp3 is 20% cheaper with better baseline performance
10. **Turn off dev environments** after hours (Lambda/serverless is naturally pay-per-use)
