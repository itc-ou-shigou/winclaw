# Azure Architecture Patterns

## Pattern 1: Lite (Single VM)

```
         Internet
            |
      [Public IP]
            |
     ┌──────────────┐
     │  Azure VM     │
     │  (Ubuntu)     │
     │  Nginx+App    │
     └──────────────┘
            |
       [VNet/NSG]
```

**Use Case**: Personal projects, dev/test environments, minimal budget
**Budget**: $10-40/mo
**Traffic**: <500 visits/day

---

## Pattern 2: Standard (App Service + Database)

```
         Internet
            |
     ┌──────────────┐
     │  App Service  │
     │  (PaaS)       │
     └──────┬───────┘
            |
     ┌──────────────┐
     │  Azure DB     │
     │  (MySQL/PG)   │
     │  Flexible     │
     └──────────────┘
```

**Use Case**: Production web apps, small business
**Budget**: $40-120/mo
**Traffic**: 500-5,000 visits/day

---

## Pattern 3: HA (Multi-Instance + Application Gateway)

```
             Internet
                |
        [Application Gateway]
           /          \
  ┌─────────────┐  ┌─────────────┐
  │ App Service  │  │ App Service  │
  │ Instance 1   │  │ Instance 2   │
  └──────┬──────┘  └──────┬──────┘
         └────────┬───────┘
          ┌───────┴───────┐
          │  Azure DB     │
          │  (Zone HA)    │
          │  + Read Replica│
          └───────────────┘
```

**Use Case**: Production apps requiring high availability
**Budget**: $120-250/mo
**Traffic**: 5,000-50,000 visits/day

---

## Pattern 4: Elastic (VMSS + Redis + CDN)

```
         Internet
            |
     [Azure CDN] ──── [Static Assets]
            |
     [Load Balancer]
       /    |    \
    ┌───┐ ┌───┐ ┌───┐
    │VM │ │VM │ │VM │  ← VMSS Auto-Scale (2-10)
    └─┬─┘ └─┬─┘ └─┬─┘
      └──────┼──────┘
      ┌──────┴──────┐
      │ Azure Redis  │
      │ (Cache)      │
      └──────┬──────┘
      ┌──────┴──────┐
      │  Azure DB    │
      │  Flexible    │
      └─────────────┘
```

**Use Case**: High-traffic apps requiring auto-scaling
**Budget**: $200-500/mo
**Traffic**: 50,000-500,000 visits/day

---

## Pattern 5: Serverless (Functions + API Management)

```
         Internet
            |
     [API Management]
            |
     ┌──────────────┐
     │  Function App │
     │  (Consumption)│
     └──────┬───────┘
            |
     [Storage Account]
            |
     ┌──────────────┐  (optional)
     │  Azure DB     │
     │  Flexible     │
     └──────────────┘
```

**Use Case**: API backends, event-driven processing, zero idle cost
**Budget**: $0-100/mo (pay-per-use)
**Traffic**: Variable, up to 100,000 visits/day

---

## Pattern 6: Container (AKS Kubernetes)

```
         Internet
            |
     [Load Balancer]
            |
     ┌──────────────────────┐
     │   AKS Cluster        │
     │  ┌────┐ ┌────┐ ┌────┐│
     │  │Node│ │Node│ │Node││  ← Auto-scale (2-5)
     │  └────┘ └────┘ └────┘│
     └──────────┬───────────┘
                |
     ┌──────────┴──────────┐
     │ Azure Container     │
     │ Registry (ACR)      │
     └─────────────────────┘
                |
     ┌──────────────┐  (optional)
     │  Azure DB     │
     │  Flexible     │
     └──────────────┘
```

**Use Case**: Microservices, complex multi-container apps
**Budget**: $250+/mo
**Traffic**: 50,000-1,000,000+ visits/day
