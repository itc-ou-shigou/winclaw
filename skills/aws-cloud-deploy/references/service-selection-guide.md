# Service Selection Guide

Decision trees, comparison matrices, and cost analysis for selecting AWS services. Used during Phase 1-2 to recommend the optimal architecture pattern and services.

---

## Compute Selection Decision Tree

```
What type of application?
 |
 +-- Static site (HTML/CSS/JS only)?
 |    --> S3 + CloudFront ($0.50-5/mo)
 |
 +-- Event-driven API / webhook handler?
 |    --> Lambda + API Gateway ($0-5/mo at low volume)
 |
 +-- Background jobs / scheduled tasks?
 |    +-- Short-lived (< 15 min)?
 |    |    --> Lambda + EventBridge
 |    +-- Long-running?
 |         --> EC2 or ECS Fargate
 |
 +-- Full server / persistent process?
 |    +-- Single server sufficient?
 |    |    --> EC2 instance (lite pattern)
 |    +-- Need load balancing?
 |    |    +-- Fixed capacity OK?
 |    |    |    --> EC2 + ALB (standard pattern)
 |    |    +-- Auto-scaling needed?
 |    |         --> EC2 ASG + ALB (ha/elastic pattern)
 |    +-- Need containers / microservices?
 |         +-- Kubernetes expertise available?
 |         |    --> EKS (container pattern)
 |         +-- Prefer managed / simpler?
 |              --> ECS Fargate
 |
 +-- GPU / HPC / ML inference?
      --> P4d / G5 / Inf2 instances (specialized)
```

## Compute Comparison Matrix

| Feature | EC2 | Lambda | ECS Fargate | EKS |
|---------|-----|--------|-------------|-----|
| **Minimum cost** | $3.80/mo (t4g.nano) | $0 (free tier: 1M req/mo) | $0.04048/vCPU/hr | $73/mo (control plane) |
| **Typical cost** | $7.59-30.37/mo | $1-50/mo | $30-150/mo | $150-500/mo |
| **Auto-scaling** | ASG (minutes) | Automatic (seconds) | Service auto-scaling | HPA, VPA, Karpenter |
| **Max scale** | 100s of instances | 1,000 concurrent (default) | 100s of tasks | 1,000s of pods |
| **SLA** | 99.99% | 99.95% | 99.99% | 99.95% |
| **Cold start** | None | 100ms-10s | None | None |
| **Max execution** | Unlimited | 15 minutes | Unlimited | Unlimited |
| **Custom runtime** | Full OS access | Container image or Layer | Container image | Container image |
| **SSH access** | Yes | No | No (exec into) | No (exec into pod) |
| **Persistent storage** | EBS volumes | /tmp (512MB-10GB) | EFS mount | EBS CSI, EFS CSI |
| **Networking** | Full VPC control | Optional VPC | awsvpc mode | VPC CNI |
| **Deployment** | SSH/SCP, CodeDeploy | ZIP upload, Container | Task definition update | kubectl apply |
| **Operational overhead** | High (patch OS, monitor) | Minimal | Low | Medium-High |
| **Best for** | Traditional apps, full control | APIs, event handlers | Containerized apps | Microservices at scale |

### Instance Type Families

| Family | Use Case | vCPU:Memory Ratio | Example |
|--------|----------|-------------------|---------|
| **t3/t4g** | Burstable general purpose | 1:2 | t3.small: 2 vCPU, 2 GB, $15.18/mo |
| **m6i/m7g** | General purpose (sustained) | 1:4 | m6i.large: 2 vCPU, 8 GB, $69.35/mo |
| **c6i/c7g** | Compute-optimized | 1:2 | c6i.large: 2 vCPU, 4 GB, $61.32/mo |
| **r6i/r7g** | Memory-optimized | 1:8 | r6i.large: 2 vCPU, 16 GB, $91.98/mo |
| **g5** | GPU (ML inference, graphics) | Varies | g5.xlarge: 4 vCPU, 16 GB, 1 GPU, $766/mo |
| **p4d** | GPU (ML training) | Varies | p4d.24xlarge: 96 vCPU, 8 GPU, $23,554/mo |

**Graviton (ARM) instances** (t4g, m7g, c7g, r7g): ~20% cheaper, ~20% better performance than x86 equivalents. Use when application and dependencies support ARM64.

### Instance Type Recommendations by Pattern

| Pattern | Traffic | Recommended Instance | Monthly Cost |
|---------|---------|---------------------|-------------|
| lite | < 1,000/day | t3.micro (free tier) or t3.small | $0 or $7.59 |
| standard | 1K-10K/day | t3.small or t3.medium | $7.59-$15.18 |
| ha (min 2) | 10K-100K/day | t3.small (x2 min) | $15.18+ |
| elastic (min 2) | 100K+/day | t3.medium (x2 min) | $30.37+ |
| container (2 nodes) | Variable | t3.medium (x2) | $30.37+ (+ $73 EKS) |

---

## Database Selection Decision Tree

```
What kind of data?
 |
 +-- Relational (tables, joins, transactions)?
 |    +-- MySQL compatible?
 |    |    +-- High scale / global?
 |    |    |    --> Aurora MySQL ($29+/mo)
 |    |    +-- Standard workload?
 |    |         --> RDS MySQL ($12.41+/mo)
 |    +-- PostgreSQL compatible?
 |    |    +-- High scale / global?
 |    |    |    --> Aurora PostgreSQL ($29+/mo)
 |    |    +-- Standard workload?
 |    |         --> RDS PostgreSQL ($12.41+/mo)
 |    +-- SQL Server required?
 |    |    --> RDS SQL Server ($23+/mo)
 |    +-- Oracle required?
 |         --> RDS Oracle (license costs)
 |
 +-- Key-value / Document (NoSQL)?
 |    +-- Predictable traffic?
 |    |    --> DynamoDB Provisioned
 |    +-- Variable traffic?
 |         --> DynamoDB On-Demand ($0, pay per request)
 |
 +-- In-memory cache / session store?
 |    +-- Need persistence?
 |    |    --> ElastiCache Redis ($12.17+/mo)
 |    +-- Pure cache (no persistence)?
 |         --> ElastiCache Memcached ($11.52+/mo)
 |
 +-- Full-text search?
 |    --> OpenSearch Service ($25+/mo)
 |
 +-- Graph relationships?
 |    --> Neptune ($43+/mo)
 |
 +-- Time series data?
 |    --> Timestream ($0.50/GB ingested)
 |
 +-- No database needed?
      --> No DB resource in template
```

## Database Comparison Matrix

| Feature | RDS MySQL | RDS PostgreSQL | Aurora MySQL | DynamoDB | ElastiCache Redis |
|---------|-----------|----------------|-------------|----------|-------------------|
| **Min cost** | $12.41/mo (db.t3.micro) | $12.41/mo | $29.20/mo (db.t3.small) | $0 (on-demand) | $12.17/mo (cache.t3.micro) |
| **Multi-AZ** | Yes (+100% cost) | Yes (+100% cost) | Built-in (3 AZ) | Built-in (global) | Yes (replicas) |
| **Read replicas** | Up to 15 | Up to 15 | Up to 15 | DAX cache / Global Tables | Up to 5 replicas |
| **Max storage** | 64 TB | 64 TB | 128 TB (auto) | Unlimited | 340 GB per node |
| **Backup** | Automated (35 day) | Automated (35 day) | Continuous | Continuous (PITR) | Manual + Auto |
| **Encryption** | At-rest + in-transit | At-rest + in-transit | At-rest + in-transit | At-rest + in-transit | At-rest + in-transit |
| **Serverless option** | No | No | Aurora Serverless v2 | Yes (on-demand) | ElastiCache Serverless |
| **Connection limit** | ~150 (t3.micro) | ~100 (t3.micro) | ~1000 (r6g.large) | Unlimited | 65,000 |
| **Query type** | SQL | SQL + JSON | SQL | Key-value, Document | Key-value, Pub/Sub |
| **Best for** | Web apps, CMS, CRUD | Complex queries, GIS | High scale relational | Serverless, high write | Cache, sessions, queues |

### RDS Instance Recommendations

| Workload | Instance Class | vCPU | RAM | Monthly Cost |
|----------|---------------|------|-----|-------------|
| Dev/Test | db.t3.micro | 2 | 1 GB | $12.41 |
| Small production | db.t3.small | 2 | 2 GB | $24.82 |
| Medium production | db.t3.medium | 2 | 4 GB | $49.64 |
| Large production | db.r6g.large | 2 | 16 GB | $131.40 |
| High performance | db.r6g.xlarge | 4 | 32 GB | $262.80 |

**Storage costs (gp3):** $0.08/GB/mo base + IOPS/throughput charges. Minimum 20 GB.

---

## Load Balancing Selection

```
What type of traffic?
 |
 +-- HTTP/HTTPS (web application)?
 |    +-- Path-based routing needed?
 |    |    --> ALB (Application Load Balancer)
 |    +-- Host-based routing (multiple domains)?
 |    |    --> ALB
 |    +-- WebSocket support needed?
 |         --> ALB
 |
 +-- TCP/UDP (raw protocol)?
 |    +-- Ultra-low latency required?
 |    |    --> NLB (Network Load Balancer)
 |    +-- Static IP needed?
 |    |    --> NLB (supports Elastic IPs)
 |    +-- Game server / IoT?
 |         --> NLB
 |
 +-- Global routing (multi-region)?
 |    +-- Anycast IP needed?
 |    |    --> Global Accelerator
 |    +-- Content distribution?
 |         --> CloudFront CDN
 |
 +-- Internal microservice communication?
      --> ALB (internal) or App Mesh / Service Connect
```

### Load Balancer Comparison

| Feature | ALB | NLB | CLB (legacy) |
|---------|-----|-----|-------------|
| **Layer** | 7 (HTTP/HTTPS) | 4 (TCP/UDP/TLS) | 4 + 7 |
| **Base cost** | $16.43/mo + LCU | $16.43/mo + NLCU | $13.14/mo |
| **Protocols** | HTTP, HTTPS, gRPC | TCP, UDP, TLS | HTTP, HTTPS, TCP, SSL |
| **Routing** | Path, host, header, query | Port-based | Basic |
| **Targets** | Instance, IP, Lambda | Instance, IP, ALB | Instance |
| **Static IP** | No (use Global Accelerator) | Yes (EIP per AZ) | No |
| **WebSocket** | Yes | Yes (pass-through) | No |
| **Health checks** | HTTP(S), custom path | TCP, HTTP(S) | TCP, HTTP |
| **SSL termination** | Yes | Yes (TLS) | Yes |
| **Best for** | Web apps, APIs, microservices | High performance, TCP/UDP | Legacy (migrate away) |

---

## Network Architecture Cost Per Pattern

| Pattern | Network Components | Monthly Cost Estimate |
|---------|-------------------|----------------------|
| **lite** | VPC + 1 Public Subnet + IGW + EIP | ~$3.65 (EIP: $3.65 if attached) |
| **standard** | VPC + 2 Public + 2 Private Subnets + IGW + ALB | ~$20 (ALB: ~$16.43 + LCU) |
| **ha** | VPC + 2 Public + 2 Private + IGW + ALB + 1 NAT | ~$53 (NAT: $32.40 + ALB) |
| **elastic** | VPC + 2 Public + 2 Private + IGW + ALB + NAT + CloudFront | ~$55+ (CloudFront usage-based) |
| **serverless** | API Gateway | ~$3.50 per million requests |
| **container** | VPC + 2 Public + 2 Private + IGW + ALB/NLB + NAT | ~$53 (same as HA network layer) |

### NAT Gateway Cost Breakdown

NAT Gateways are the largest hidden cost in AWS networking:

- **Hourly charge**: $0.045/hr = $32.40/mo per gateway
- **Data processing**: $0.045/GB
- **Recommendation**: Use 1 NAT Gateway (single AZ) for cost savings; use 2 (multi-AZ) for HA
- **Alternative**: NAT Instance (t3.nano, $3.80/mo) for dev/staging; less reliable but 90% cheaper
- **VPC Endpoints**: Use Gateway Endpoints (free) for S3 and DynamoDB to avoid NAT charges for those services

### Data Transfer Costs

| Transfer Type | Cost |
|---------------|------|
| Data IN to AWS | Free |
| Data OUT to Internet (first 100 GB/mo) | $0.09/GB |
| Data OUT to Internet (next 9.999 TB) | $0.085/GB |
| Inter-AZ within region | $0.01/GB each direction |
| Inter-region | $0.02/GB |
| CloudFront to Internet (first 10 TB) | $0.085/GB |
| VPC peering (same region) | $0.01/GB each direction |

---

## Region Selection Guide

### By User Location

| User Location | Primary Region | DR Region | Latency |
|---------------|---------------|-----------|---------|
| US East Coast | us-east-1 (N. Virginia) | us-west-2 (Oregon) | 10-30ms |
| US West Coast | us-west-2 (Oregon) | us-east-1 (N. Virginia) | 10-30ms |
| Europe (West) | eu-west-1 (Ireland) | eu-central-1 (Frankfurt) | 10-30ms |
| Europe (Central) | eu-central-1 (Frankfurt) | eu-west-1 (Ireland) | 10-30ms |
| Japan | ap-northeast-1 (Tokyo) | ap-northeast-3 (Osaka) | 5-15ms |
| Korea | ap-northeast-2 (Seoul) | ap-northeast-1 (Tokyo) | 10-30ms |
| Southeast Asia | ap-southeast-1 (Singapore) | ap-southeast-2 (Sydney) | 20-40ms |
| India | ap-south-1 (Mumbai) | ap-south-2 (Hyderabad) | 5-15ms |
| South America | sa-east-1 (Sao Paulo) | us-east-1 (N. Virginia) | 30-60ms |
| Middle East | me-south-1 (Bahrain) | eu-west-1 (Ireland) | 30-60ms |
| Australia | ap-southeast-2 (Sydney) | ap-southeast-4 (Melbourne) | 5-15ms |

### Region Selection Factors

| Factor | Consideration |
|--------|--------------|
| **Latency** | Choose region closest to users |
| **Cost** | us-east-1, us-west-2 are cheapest; sa-east-1, ap-* cost 10-30% more |
| **Service availability** | us-east-1 has all services first; newer regions may lack some services |
| **Compliance** | GDPR: EU regions; Data residency laws may require specific regions |
| **Disaster recovery** | Choose DR region in different geographic area |

### Price Variation by Region (relative to us-east-1)

| Region | EC2 Cost Factor | RDS Cost Factor |
|--------|----------------|-----------------|
| us-east-1 | 1.00x (baseline) | 1.00x |
| us-west-2 | 1.00x | 1.00x |
| eu-west-1 | 1.05-1.10x | 1.05-1.10x |
| eu-central-1 | 1.10-1.15x | 1.10-1.15x |
| ap-northeast-1 | 1.15-1.25x | 1.15-1.25x |
| ap-southeast-1 | 1.05-1.10x | 1.05-1.10x |
| sa-east-1 | 1.40-1.50x | 1.30-1.50x |

---

## Scaling Strategies

### Vertical Scaling (Scale Up)

Change instance type to a larger one. Requires instance stop/start (brief downtime).

```bash
# Stop instance
aws ec2 stop-instances --instance-ids <INSTANCE_ID>
aws ec2 wait instance-stopped --instance-ids <INSTANCE_ID>

# Change type
aws ec2 modify-instance-attribute \
  --instance-id <INSTANCE_ID> \
  --instance-type '{"Value":"t3.large"}'

# Start instance
aws ec2 start-instances --instance-ids <INSTANCE_ID>
```

**When to use**: Quick fix for immediate capacity needs; limited ceiling.

### Horizontal Scaling (Scale Out) - Auto Scaling Group

```yaml
# Target Tracking (recommended - simplest)
ScalingPolicy:
  Type: AWS::AutoScaling::ScalingPolicy
  Properties:
    PolicyType: TargetTrackingScaling
    AutoScalingGroupName: !Ref ASG
    TargetTrackingConfiguration:
      PredefinedMetricSpecification:
        PredefinedMetricType: ASGAverageCPUUtilization
      TargetValue: 70.0
      ScaleInCooldown: 300
      ScaleOutCooldown: 60
```

| Scaling Type | Trigger | Response Time | Best For |
|-------------|---------|---------------|---------|
| **Target Tracking** | Maintain metric at target value | 1-3 minutes | Steady traffic patterns |
| **Step Scaling** | CloudWatch alarm thresholds | 1-3 minutes | Bursty traffic with clear thresholds |
| **Scheduled** | Cron schedule | Predictable | Known traffic patterns (business hours) |
| **Predictive** | ML-based forecast | Pre-scales before traffic | Recurring patterns with ramp-up time |

### Lambda Scaling

Lambda scales automatically by running more concurrent executions:

| Setting | Default | Max | Notes |
|---------|---------|-----|-------|
| Concurrent executions | 1,000 (account) | 10,000+ (request increase) | Per function limits available |
| Burst concurrency | 500-3,000 (region) | N/A | Immediate scale-up limit |
| Provisioned concurrency | 0 | Function limit | Eliminates cold starts, costs more |

### EKS Scaling

| Mechanism | What It Scales | Trigger |
|-----------|---------------|---------|
| **HPA** (Horizontal Pod Autoscaler) | Pod replicas | CPU/memory or custom metrics |
| **VPA** (Vertical Pod Autoscaler) | Pod resource requests | Historical usage analysis |
| **Cluster Autoscaler** | EC2 nodes | Pending pods (insufficient resources) |
| **Karpenter** | EC2 nodes (optimal type) | Pending pods, selects best instance type |

HPA configuration example:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Storage Selection

```
What type of storage?
 |
 +-- Block storage (attached to EC2)?
 |    +-- High IOPS (databases)?
 |    |    --> gp3 (default, 3000 IOPS base) or io2 (up to 256,000 IOPS)
 |    +-- Throughput-optimized (big data)?
 |    |    --> st1 (HDD, $0.045/GB)
 |    +-- Archive / infrequent access?
 |         --> sc1 (Cold HDD, $0.015/GB)
 |
 +-- Object storage (files, assets, backups)?
 |    +-- Frequent access?
 |    |    --> S3 Standard ($0.023/GB)
 |    +-- Infrequent access?
 |    |    --> S3 Infrequent Access ($0.0125/GB)
 |    +-- Archive (restore in minutes)?
 |    |    --> S3 Glacier Instant Retrieval ($0.004/GB)
 |    +-- Deep archive (restore in hours)?
 |    |    --> S3 Glacier Deep Archive ($0.00099/GB)
 |    +-- Unknown / variable access?
 |         --> S3 Intelligent-Tiering ($0.0025/1000 objects monitoring)
 |
 +-- Shared file system (multiple instances)?
 |    +-- Linux (NFS)?
 |    |    --> EFS ($0.30/GB Standard, $0.016/GB IA)
 |    +-- Windows (SMB)?
 |         --> FSx for Windows ($0.013/GB/mo)
 |
 +-- Container persistent volumes?
      --> EBS CSI driver (gp3) or EFS CSI driver
```

### EBS Volume Comparison

| Type | IOPS | Throughput | Cost | Best For |
|------|------|-----------|------|----------|
| gp3 | 3,000-16,000 | 125-1,000 MB/s | $0.08/GB | General purpose (default) |
| gp2 | 100-16,000 (burst) | 128-250 MB/s | $0.10/GB | Legacy, migrate to gp3 |
| io2 | 100-256,000 | 4,000 MB/s | $0.125/GB + $0.065/IOPS | High-performance databases |
| st1 | 500 (burst) | 500 MB/s | $0.045/GB | Big data, streaming |
| sc1 | 250 (burst) | 250 MB/s | $0.015/GB | Cold data, infrequent access |

---

## Cost Optimization Tips

### Quick Wins (implement immediately)

1. **Use t3/t4g burstable instances**: 50-70% cheaper than m-series for variable workloads
   - t3.small ($7.59/mo) vs m6i.large ($69.35/mo) for light workloads
   - Monitor CPU credit balance; switch to unlimited if credits deplete regularly

2. **Graviton (ARM) instances**: ~20% cheaper, ~20% faster
   - t4g.small ($6.05/mo) vs t3.small ($7.59/mo)
   - Requires ARM-compatible application and dependencies

3. **Right-size instances**: Use AWS Compute Optimizer
   ```bash
   aws compute-optimizer get-ec2-instance-recommendations \
     --instance-arns arn:aws:ec2:<REGION>:<ACCOUNT>:instance/<ID>
   ```

4. **gp3 over gp2**: 20% cheaper with better baseline performance
   ```bash
   aws ec2 modify-volume --volume-id <VOL_ID> --volume-type gp3
   ```

5. **S3 Intelligent-Tiering**: Automatically moves objects to cheaper tiers
   ```bash
   aws s3api put-bucket-intelligent-tiering-configuration \
     --bucket <BUCKET> --id auto-tier \
     --intelligent-tiering-configuration '{...}'
   ```

### Medium-Term Savings

6. **Reserved Instances** (1 or 3 year commitment):
   - 1-year No Upfront: ~30% savings
   - 1-year All Upfront: ~40% savings
   - 3-year All Upfront: ~60% savings
   - Best for: predictable, always-on workloads (production DB, baseline compute)

7. **Savings Plans** (flexible RI alternative):
   - Compute Savings Plans: Apply to EC2, Fargate, Lambda across any region/family
   - EC2 Instance Savings Plans: Locked to instance family + region, deeper discount
   - 1-year: ~30% savings; 3-year: ~50% savings

8. **Spot Instances** for fault-tolerant workloads:
   - 60-90% savings vs On-Demand
   - Use for: batch processing, CI/CD runners, dev/test environments
   - Not for: databases, stateful applications, single-instance production
   ```yaml
   # In ASG, mix On-Demand + Spot
   MixedInstancesPolicy:
     InstancesDistribution:
       OnDemandBaseCapacity: 1
       OnDemandPercentageAboveBaseCapacity: 25
       SpotAllocationStrategy: capacity-optimized
   ```

9. **RDS Reserved Instances**: Same discount structure as EC2 RI
   - Production databases should always be reserved if running 24/7

10. **NAT Gateway optimization**:
    - Use VPC Gateway Endpoints for S3/DynamoDB (free, avoids NAT charges)
    - Use Interface Endpoints for other AWS services if high volume
    - Consider NAT Instance (t3.nano, $3.80/mo) for dev/staging

### Advanced Optimization

11. **Auto Scaling schedule** for non-production:
    ```bash
    # Scale down at night (save 50%+ on dev/staging)
    aws autoscaling put-scheduled-action \
      --auto-scaling-group-name <ASG> \
      --scheduled-action-name scale-down-night \
      --recurrence "0 22 * * MON-FRI" \
      --min-size 0 --max-size 0 --desired-capacity 0

    aws autoscaling put-scheduled-action \
      --auto-scaling-group-name <ASG> \
      --scheduled-action-name scale-up-morning \
      --recurrence "0 8 * * MON-FRI" \
      --min-size 2 --max-size 6 --desired-capacity 2
    ```

12. **Lambda optimization**:
    - Right-size memory (more memory = faster execution = lower cost sometimes)
    - Use ARM (Graviton2) runtime: 20% cheaper
    - Minimize cold starts with Provisioned Concurrency only for latency-critical functions
    - Use Lambda Power Tuning tool to find optimal memory

13. **CloudFront caching**: Reduce origin requests by 80-95% with proper TTL settings
    - Static assets: TTL 86400s (1 day) or longer
    - API responses: TTL 0-300s depending on freshness needs

14. **Cost monitoring setup**:
    ```bash
    # Create budget alert
    aws budgets create-budget \
      --account-id <ACCOUNT_ID> \
      --budget '{"BudgetName":"Monthly","BudgetLimit":{"Amount":"200","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}' \
      --notifications-with-subscribers '[{"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":80},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"user@example.com"}]}]'
    ```

---

## Total Cost Estimate by Pattern

These are baseline estimates using the smallest recommended instance sizes. Actual costs vary by usage.

| Pattern | Compute | Database | Network | Storage | Other | Total /mo |
|---------|---------|----------|---------|---------|-------|-----------|
| **lite** | $7.59 (t3.small) | -- | $3.65 (EIP) | $1.60 (20GB gp3) | -- | **~$13/mo** |
| **standard** | $7.59 (t3.small) | $12.41 (db.t3.micro) | $16.43 (ALB) | $3.20 (40GB gp3) | -- | **~$40/mo** |
| **ha** | $15.18 (2x t3.small) | $24.82 (db.t3.micro Multi-AZ) | $48.83 (ALB + NAT) | $3.20 | -- | **~$92/mo** |
| **elastic** | $15.18 (2x t3.small) | $24.82 (db.t3.micro Multi-AZ) | $48.83 (ALB + NAT) | $3.20 | $12.17 (Redis) + CF | **~$107/mo** |
| **serverless** | $0-5 (Lambda) | $0 (DynamoDB on-demand) | $3.50/M req (APIGW) | $0.023/GB (S3) | -- | **~$1-10/mo** |
| **container** | $30.37 (2x t3.medium nodes) | -- | $48.83 (ALB + NAT) | $3.20 | $73 (EKS) | **~$156/mo** |

Note: Free Tier eligible accounts can reduce costs significantly for the first 12 months (t3.micro, 750 hrs RDS, 1M Lambda requests, etc.).
