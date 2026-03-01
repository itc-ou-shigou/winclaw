# Azure Service Selection Guide

Decision trees and selection criteria for choosing the right Azure service.
Based on Azure Architecture Center guidance from `C:\work\architecture-center\docs\guide\technology-choices\`.

## Compute Selection Decision Tree

```
Start: What type of application?
  │
  ├─ Static website / SPA
  │   → Azure Static Web Apps (free) or Storage Account static site
  │
  ├─ Simple web app / API
  │   ├─ Budget < $15/mo → App Service Free (F1)
  │   ├─ Budget < $30/mo → App Service Basic (B1)
  │   ├─ Need auto-scale → App Service Standard (S1+)
  │   └─ Need HA + zones → App Service Premium (P1v3+)
  │
  ├─ Event-driven / API with variable traffic
  │   ├─ < 1M requests/mo → Azure Functions Consumption (free)
  │   ├─ Predictable load → Azure Functions Premium
  │   └─ Need VNet → Azure Functions Premium or Dedicated
  │
  ├─ Full server control needed
  │   ├─ Budget < $10/mo → VM B1s (dev/test only)
  │   ├─ Light production → VM B2s ($30/mo)
  │   ├─ General purpose → VM D2s_v5 ($70/mo)
  │   └─ High performance → VM D4s_v5+ ($140+/mo)
  │
  ├─ Auto-scaling VMs
  │   → VMSS (Virtual Machine Scale Sets)
  │     ├─ Web tier → Standard LB + VMSS
  │     └─ Custom images → Seed VM → Custom Image → VMSS
  │
  ├─ Microservices / containers
  │   ├─ Simple (1-3 containers) → Azure Container Apps
  │   ├─ Complex orchestration → AKS
  │   └─ Batch / CI jobs → Azure Container Instances (ACI)
  │
  └─ GPU / HPC / AI
      → NC/ND/NV series VMs or Azure Machine Learning
```

### Compute Comparison Matrix

| Feature | App Service | Functions | VM | VMSS | AKS |
|---------|------------|-----------|-----|------|-----|
| Min cost | $0 (F1) | $0 (Consumption) | $7.59/mo | $15+/mo | $0 (control) |
| Auto-scale | S1+ (10 inst) | Automatic | No | Yes | Yes |
| Custom runtime | Limited | Limited | Full | Full | Full |
| OS access | No | No | Full | Full | Container |
| Deploy speed | Seconds | Seconds | Minutes | Minutes | Minutes |
| HA/SLA | 99.95% | 99.95% | 99.9%+ | 99.95% | 99.95% |
| VNet | P1v3+ | Premium | Yes | Yes | Yes |
| Best for | Web apps | APIs/events | Legacy | Scale | Microservices |

---

## Database Selection Decision Tree

```
Start: What data model?
  │
  ├─ Relational (SQL)
  │   ├─ MySQL compatible
  │   │   ├─ Dev/test → Flexible Server Burstable B1ms ($12/mo)
  │   │   ├─ Production → Flexible Server GP D2ds_v4 ($102/mo)
  │   │   └─ HA needed → Flexible Server + ZoneRedundant
  │   │
  │   ├─ PostgreSQL compatible
  │   │   ├─ Dev/test → Flexible Server Burstable B1ms ($12/mo)
  │   │   ├─ Production → Flexible Server GP D2ds_v4 ($102/mo)
  │   │   └─ HA needed → Flexible Server + ZoneRedundant
  │   │
  │   ├─ SQL Server compatible
  │   │   ├─ Serverless → Azure SQL Database Serverless
  │   │   ├─ Managed → Azure SQL Database
  │   │   └─ Full compat → SQL Managed Instance
  │   │
  │   └─ Multi-region / global
  │       → Azure Cosmos DB (PostgreSQL API or SQL API)
  │
  ├─ Key-Value / Cache
  │   ├─ Simple cache → Azure Cache for Redis Basic ($16/mo)
  │   ├─ Production cache → Azure Cache for Redis Standard ($80/mo)
  │   └─ High throughput → Azure Cache for Redis Premium (cluster)
  │
  ├─ Document (JSON)
  │   ├─ Global distribution → Azure Cosmos DB
  │   └─ MongoDB compat → Azure Cosmos DB for MongoDB
  │
  ├─ Time Series / Analytics
  │   ├─ Analytics → Azure Synapse Analytics
  │   └─ Time series → Azure Data Explorer
  │
  └─ File / Blob Storage
      ├─ Object storage → Azure Blob Storage
      ├─ File shares → Azure Files (SMB/NFS)
      └─ Data Lake → Azure Data Lake Storage Gen2
```

### Database Comparison Matrix

| Feature | MySQL Flex | PostgreSQL Flex | Azure SQL | Cosmos DB | Redis |
|---------|-----------|----------------|-----------|-----------|-------|
| Min cost | $12/mo | $12/mo | $5/mo (DTU) | $25/mo | $16/mo |
| Max storage | 16 TB | 16 TB | 4 TB | Unlimited | 120 GB |
| HA modes | Zone/Same | Zone/Same | Built-in | Multi-region | Replica |
| Read replicas | 10 | 10 | Yes | Unlimited | No |
| Serverless | No | No | Yes | Yes | No |
| Global dist. | No | No | Geo-rep | Yes | Geo-rep (Prem) |
| Best for | Web apps | Analytics | Enterprise | Global apps | Caching |

---

## Networking Selection Decision Tree

### Load Balancing

```
Start: What traffic type?
  │
  ├─ HTTP/HTTPS (Layer 7)
  │   ├─ Single region
  │   │   ├─ App Service backend → Application Gateway v2
  │   │   ├─ Need WAF → Application Gateway v2 (WAF_v2 SKU)
  │   │   └─ Simple routing → App Service built-in LB
  │   │
  │   └─ Multi-region / Global
  │       ├─ Need WAF + CDN → Azure Front Door Premium
  │       └─ DNS-based → Azure Traffic Manager
  │
  └─ TCP/UDP (Layer 4)
      ├─ Internal only → Internal Load Balancer
      ├─ Internet-facing → Standard Load Balancer
      └─ Cross-region → Cross-region Load Balancer
```

### Network Security

```
Start: What security level?
  │
  ├─ Basic
  │   └─ NSG (Network Security Group) on subnet/NIC
  │       ├─ Allow: 80, 443 inbound
  │       ├─ Restrict: SSH (22) to admin IP only
  │       └─ Default: deny all other inbound
  │
  ├─ Standard
  │   ├─ NSG + Private Endpoints for DB
  │   ├─ Service Endpoints for Storage
  │   └─ Managed Identity (no passwords in code)
  │
  └─ Enterprise
      ├─ Azure Firewall (hub-spoke topology)
      ├─ WAF on Application Gateway or Front Door
      ├─ DDoS Protection Standard
      ├─ Private Link for all PaaS services
      └─ Azure Policy for compliance
```

### Network Architecture by Pattern

| Pattern | Network Components | Cost |
|---------|-------------------|------|
| lite | VNet + NSG + Public IP | ~$4/mo |
| standard | VNet + NSG (App Service VNet integration optional) | ~$0 |
| ha | VNet + NSG + App Gateway v2 + Public IP | ~$22/mo |
| elastic | VNet + NSG + Standard LB + Public IP + CDN | ~$42/mo |
| serverless | VNet (optional) + API Management | ~$47+/mo |
| container | VNet + NSG + AKS LB (included) | ~$0 (AKS LB free) |

---

## Region Selection Guide

### Recommended Regions by Proximity

| User Location | Primary Region | DR Region | Latency |
|---------------|---------------|-----------|---------|
| US East Coast | East US (`eastus`) | West US 2 (`westus2`) | ~20ms |
| US West Coast | West US 2 (`westus2`) | East US (`eastus`) | ~20ms |
| Europe | West Europe (`westeurope`) | North Europe (`northeurope`) | ~15ms |
| UK | UK South (`uksouth`) | UK West (`ukwest`) | ~10ms |
| Japan | Japan East (`japaneast`) | Japan West (`japanwest`) | ~10ms |
| Southeast Asia | Southeast Asia (`southeastasia`) | East Asia (`eastasia`) | ~15ms |
| Australia | Australia East (`australiaeast`) | Australia Southeast | ~15ms |
| Korea | Korea Central (`koreacentral`) | Korea South | ~10ms |
| India | Central India (`centralindia`) | South India | ~15ms |
| Brazil | Brazil South (`brazilsouth`) | South Central US | ~50ms |

### Region Pricing Tiers

| Tier | Regions | Multiplier |
|------|---------|------------|
| Lowest | East US, West US 2, Central US | 1.0x |
| Low | North Europe, UK South, Southeast Asia | 1.10x |
| Medium | West Europe, Korea Central, Australia East | 1.15x |
| Higher | Japan East/West | 1.25x |
| Highest | Brazil South, South Africa | 1.30x+ |

---

## Scaling Strategy Guide

### When to Scale Up vs Scale Out

| Indicator | Scale Up (vertical) | Scale Out (horizontal) |
|-----------|-------------------|----------------------|
| CPU > 80% | Upgrade VM size | Add more instances |
| Memory > 85% | Upgrade to more RAM | Not effective for memory |
| Connections > 80% capacity | Upgrade DB tier | Add read replicas |
| Disk I/O saturated | Move to Premium SSD | Not effective |
| Latency > threshold | Upgrade tier | Add CDN/cache |

### Auto-Scaling Best Practices

1. **Always pair scale-out with scale-in** to avoid cost waste
2. **Scale-out thresholds**: CPU > 70-80%, Memory > 80%
3. **Scale-in thresholds**: CPU < 20-30%, Memory < 40%
4. **Cooldown periods**: 5 min (out), 10 min (in) - prevents flapping
5. **Min instances**: 2 for production (HA), 1 for dev/test
6. **Max instances**: Budget-based cap to prevent cost surprises
7. **Schedule-based**: Use for predictable patterns (business hours, seasonal)

### Scaling by Pattern

| Pattern | Scale Method | Trigger | Range |
|---------|-------------|---------|-------|
| lite | Manual (resize VM) | N/A | B1s → D8s_v5 |
| standard | App Service scale-up | Manual | B1 → P3v3 |
| ha | App Service auto-scale | CPU/Memory | 2-10 instances |
| elastic | VMSS autoscale | CPU/Custom metrics | 2-20 instances |
| serverless | Automatic | Request count | 0-200 instances |
| container | AKS cluster autoscaler | Pod requests | 2-100 nodes |

---

## Cost Optimization Tips

### Quick Wins

| Action | Savings | Effort |
|--------|---------|--------|
| Use B-series for dev/test | 50-70% | Low |
| Reserved Instances (1yr) | 30-40% | Low |
| Reserved Instances (3yr) | 50-60% | Low |
| Azure Hybrid Benefit | 40-85% | Low |
| Auto-shutdown dev VMs | 50-70% | Low |
| Right-size underused VMs | 20-50% | Medium |
| Use Spot VMs for batch | 60-90% | Medium |
| Optimize storage tiers | 20-50% | Medium |

### Pattern-Specific Optimizations

| Pattern | Optimization | Save |
|---------|-------------|------|
| lite | B1s + auto-shutdown for dev | ~$5/mo |
| standard | App Service B1 → F1 for staging | ~$13/mo |
| ha | Use S1 instead of P1v3 if < 8GB RAM needed | ~$70/mo |
| elastic | Spot VMSS for non-critical workers | ~50% compute |
| serverless | Stay in Consumption free tier (1M req/mo) | ~$0 |
| container | AKS free tier control plane | ~$73/mo |
