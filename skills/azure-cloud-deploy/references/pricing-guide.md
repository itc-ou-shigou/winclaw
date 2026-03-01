# Azure Pricing Guide (Baseline Estimates)

> **Note**: Prices are Pay-As-You-Go USD/month for East US region.
> Always verify latest pricing via WebSearch or Azure Pricing Calculator.

## Compute

### Virtual Machines (IaaS)

| Size | vCPU | RAM | USD/mo |
|------|------|-----|--------|
| B1s | 1 | 1 GB | $7.59 |
| B1ms | 1 | 2 GB | $15.18 |
| B2s | 2 | 4 GB | $30.37 |
| D2s v5 | 2 | 8 GB | $70.08 |
| D4s v5 | 4 | 16 GB | $140.16 |
| D8s v5 | 8 | 32 GB | $280.32 |

### App Service Plans (PaaS)

| Tier | vCPU | RAM | USD/mo | Notes |
|------|------|-----|--------|-------|
| F1 (Free) | shared | 1 GB | $0 | 60 min/day compute |
| B1 | 1 | 1.75 GB | $13.14 | Basic tier |
| B2 | 2 | 3.5 GB | $26.28 | Basic tier |
| S1 | 1 | 1.75 GB | $69.35 | Standard (auto-scale) |
| P1v3 | 2 | 8 GB | $138.70 | Premium (zone redundant) |
| P2v3 | 4 | 16 GB | $277.40 | Premium |

### Azure Functions

| Plan | USD/mo |
|------|--------|
| Consumption | $0 (1M exec + 400K GB-s free) |
| Flex Consumption | $0.20/million exec |
| Premium | from $155/mo |

## Database

### Azure Database for MySQL/PostgreSQL Flexible Server

| Size | vCPU | RAM | Storage | USD/mo |
|------|------|-----|---------|--------|
| B1ms (Burstable) | 1 | 2 GB | 20 GB | $12.41 |
| B2s (Burstable) | 2 | 4 GB | 32 GB | $24.82 |
| D2ds v4 (GP) | 2 | 8 GB | 64 GB | $102.20 |
| D4ds v4 (GP) | 4 | 16 GB | 128 GB | $204.40 |
| D8ds v4 (GP) | 8 | 32 GB | 256 GB | $408.80 |

Additional storage: $0.115/GB/mo

### Azure Cache for Redis

| Tier | Memory | USD/mo |
|------|--------|--------|
| Basic C0 | 250 MB | $16.37 |
| Basic C1 | 1 GB | $40.15 |
| Standard C1 | 1 GB | $80.30 |
| Standard C2 | 6 GB | $160.60 |

## Networking

| Service | Spec | USD/mo |
|---------|------|--------|
| Public IP (Standard Static) | IPv4 | $3.65 |
| Load Balancer (Standard) | base | $18.25 |
| Application Gateway v2 | base | $18.25 + capacity |
| Azure CDN (Standard Microsoft) | ~500GB | ~$20 |
| NAT Gateway | base | $32.85 |

## Container

| Service | Spec | USD/mo |
|---------|------|--------|
| AKS Control Plane | Free tier | $0 |
| AKS Control Plane | Standard tier | $73.00 |
| Container Registry (Basic) | 10GB | $5.00 |
| Container Registry (Standard) | 100GB | $20.00 |

## Security

| Service | USD/mo |
|---------|--------|
| Key Vault (free tier) | $0 |
| Key Vault (Standard) | $0.03/10K ops |
| Azure DDoS Protection | ~$2,944 |
| Azure WAF (on App GW) | included in App GW |
| Microsoft Defender for Cloud | from $15/server |

## Regional Multipliers

| Region | Multiplier |
|--------|------------|
| East US / US regions | 1.0x |
| North Europe | 1.10x |
| West Europe | 1.15x |
| UK South | 1.10x |
| Southeast Asia | 1.10x |
| Japan East/West | 1.25x |
| Australia East | 1.20x |
| Korea Central | 1.15x |
