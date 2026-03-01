# Alibaba Cloud Pricing Quick Reference

Baseline pricing for cost estimation. Always verify latest pricing via WebSearch before final quote.

> Prices in CNY, mainland China regions. Hong Kong/overseas ~1.3-2x multiplier.

## ECS (Elastic Compute Service)

### PostPaid (Pay-As-You-Go) - per hour
| Spec | vCPU | Memory | ~CNY/hr | ~CNY/mo |
|------|------|--------|---------|---------|
| ecs.t6-c1m1.large | 2 | 2G | 0.10 | 72 |
| ecs.t6-c1m2.large | 2 | 4G | 0.14 | 101 |
| ecs.c6.large | 2 | 4G | 0.32 | 230 |
| ecs.c6.xlarge | 4 | 8G | 0.64 | 461 |
| ecs.c6.2xlarge | 8 | 16G | 1.28 | 922 |
| ecs.g6.large | 2 | 8G | 0.43 | 310 |
| ecs.g6.xlarge | 4 | 16G | 0.86 | 619 |

### PrePaid discount: ~40-60% off PostPaid (1-year commit)

### Disk
| Type | CNY/GB/mo |
|------|-----------|
| cloud_efficiency | 0.35 |
| cloud_ssd | 1.00 |
| cloud_essd PL0 | 0.50 |
| cloud_essd PL1 | 1.00 |

### Bandwidth (PayByTraffic)
- Outbound: 0.80 CNY/GB
- Inbound: free

### Bandwidth (PayByBandwidth)
| Mbps | CNY/mo |
|------|--------|
| 1 | 23 |
| 5 | 125 |
| 10 | 340 |

---

## RDS MySQL

### PostPaid
| Spec | vCPU | Memory | ~CNY/hr | ~CNY/mo |
|------|------|--------|---------|---------|
| rds.mysql.t1.small | 1 | 1G | 0.12 | 86 |
| rds.mysql.s1.small | 1 | 2G | 0.23 | 166 |
| rds.mysql.s2.large | 2 | 4G | 0.62 | 446 |
| rds.mysql.s3.large | 4 | 8G | 1.24 | 893 |
| rds.mysql.m1.medium | 4 | 16G | 2.08 | 1498 |

### Storage: 0.50-1.50 CNY/GB/mo (ESSD)
### Backup: first 50% of storage free, then 0.0008 CNY/GB/hr

---

## SLB (Server Load Balancer)

| Type | CNY/hr | ~CNY/mo |
|------|--------|---------|
| Shared (slb.s1.small) | 0.04 | 29 |
| slb.s2.small | 0.06 | 43 |
| slb.s3.small | 0.12 | 86 |
| slb.s3.medium | 0.18 | 130 |

### LCU (Load Capacity Unit): 0.04 CNY/LCU/hr

---

## Redis

| Spec | Memory | ~CNY/mo (PostPaid) |
|------|--------|-------------------|
| redis.master.micro.default | 256M | 36 |
| redis.master.small.default | 1G | 120 |
| redis.master.mid.default | 2G | 240 |
| redis.master.stand.default | 4G | 480 |

---

## CDN
- Traffic: 0.24 CNY/GB (mainland China)
- HTTPS requests: 0.05 CNY/10K requests

## OSS
- Storage: 0.12 CNY/GB/mo (Standard)
- Requests: 0.01 CNY/10K GET
- Outbound: 0.50 CNY/GB (to Internet)

## WAF
- Pro: ~3000 CNY/mo
- Business: ~7000 CNY/mo

## NAT Gateway
- Small: 43 CNY/mo
- Enhanced Small: 86 CNY/mo

## FC (Function Compute)
- Invocations: 0.0133 CNY/10K
- Execution: 0.00011 CNY/GB-s
- Free tier: 400K GB-s/mo

---

## Region Multipliers
| Region | Multiplier |
|--------|-----------|
| China Mainland | 1.0x |
| Hong Kong | 1.3-1.5x |
| Singapore | 1.3-1.5x |
| US/Europe | 1.2-1.4x |
| Japan | 1.3-1.5x |
