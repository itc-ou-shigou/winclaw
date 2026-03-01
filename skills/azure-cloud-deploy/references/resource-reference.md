# Azure ARM Resource Type Reference

ARM テンプレート作成時に参照するリソースタイプのプロパティ一覧。

## Compute Resources

### Microsoft.Compute/virtualMachines

```json
{
  "type": "Microsoft.Compute/virtualMachines",
  "apiVersion": "2023-09-01",
  "name": "[name]",
  "location": "[location]",
  "properties": {
    "hardwareProfile": {
      "vmSize": "Standard_B2s | Standard_D2s_v5 | Standard_D4s_v5 | ..."
    },
    "storageProfile": {
      "imageReference": {
        "publisher": "Canonical",
        "offer": "0001-com-ubuntu-server-jammy",
        "sku": "22_04-lts-gen2",
        "version": "latest"
      },
      "osDisk": {
        "createOption": "FromImage",
        "managedDisk": { "storageAccountType": "StandardSSD_LRS | Premium_LRS" }
      }
    },
    "osProfile": {
      "computerName": "[name]",
      "adminUsername": "[string]",
      "adminPassword": "[securestring]"
    },
    "networkProfile": {
      "networkInterfaces": [{ "id": "[nicResourceId]" }]
    }
  }
}
```

**Common VM Sizes:**
| Size | vCPU | RAM | Use Case |
|------|------|-----|----------|
| B1s | 1 | 1GB | Dev/test, very low traffic |
| B2s | 2 | 4GB | Light production |
| D2s_v5 | 2 | 8GB | General purpose |
| D4s_v5 | 4 | 16GB | Medium workloads |
| D8s_v5 | 8 | 32GB | High workloads |
| E2s_v5 | 2 | 16GB | Memory-optimized |
| F2s_v2 | 2 | 4GB | CPU-optimized |

**Image References:**
| OS | Publisher | Offer | SKU |
|----|-----------|-------|-----|
| Ubuntu 22.04 | Canonical | 0001-com-ubuntu-server-jammy | 22_04-lts-gen2 |
| Ubuntu 24.04 | Canonical | ubuntu-24_04-lts | server |
| Debian 12 | Debian | debian-12 | 12-gen2 |
| CentOS 9 Stream | resf | rockylinux-9 | 9-lvm-gen2 |
| Windows Server 2022 | MicrosoftWindowsServer | WindowsServer | 2022-datacenter-g2 |

### Microsoft.Compute/virtualMachineScaleSets

```json
{
  "type": "Microsoft.Compute/virtualMachineScaleSets",
  "apiVersion": "2023-09-01",
  "sku": {
    "name": "Standard_B2s",
    "tier": "Standard",
    "capacity": 2
  },
  "properties": {
    "overprovision": true,
    "upgradePolicy": { "mode": "Automatic | Rolling | Manual" },
    "virtualMachineProfile": {
      "storageProfile": { "..." },
      "osProfile": { "computerNamePrefix": "[prefix]", "..." },
      "networkProfile": {
        "networkInterfaceConfigurations": [{
          "properties": {
            "ipConfigurations": [{
              "properties": {
                "subnet": { "id": "[subnetId]" },
                "loadBalancerBackendAddressPools": [{ "id": "[backendPoolId]" }]
              }
            }]
          }
        }]
      }
    }
  }
}
```

### Microsoft.Insights/autoscalesettings

Autoscale rules for VMSS:
- **Metric triggers**: `Percentage CPU`, `Available Memory Bytes`, `Network In Total`, `Disk Read Bytes/sec`
- **Scale-out threshold**: 70-80% CPU → add 1 instance, cooldown 5min
- **Scale-in threshold**: 20-30% CPU → remove 1 instance, cooldown 10min
- **Best practice**: Always pair scale-out with scale-in rule to avoid flapping

---

## Web Resources

### Microsoft.Web/serverfarms (App Service Plan)

```json
{
  "type": "Microsoft.Web/serverfarms",
  "apiVersion": "2023-01-01",
  "sku": { "name": "B1 | B2 | S1 | P1v3 | P2v3 | Y1" },
  "kind": "linux | app",
  "properties": {
    "reserved": true,  // true for Linux
    "zoneRedundant": false  // true for zone redundancy (Premium+)
  }
}
```

**SKU Tiers:**
| Tier | SKU | vCPU | RAM | Auto-Scale | Slots | Custom Domain | SSL |
|------|-----|------|-----|------------|-------|--------------|-----|
| Free | F1 | shared | 1GB | No | 0 | No | No |
| Basic | B1/B2/B3 | 1-4 | 1.75-7GB | No | 0 | Yes | Yes |
| Standard | S1/S2/S3 | 1-4 | 1.75-7GB | Yes (10) | 5 | Yes | Yes |
| Premium v3 | P1v3/P2v3/P3v3 | 2-8 | 8-32GB | Yes (30) | 20 | Yes | Yes |
| Consumption | Y1 | dynamic | dynamic | Auto | 0 | Yes | Yes |

### Microsoft.Web/sites (App Service / Function App)

```json
{
  "type": "Microsoft.Web/sites",
  "apiVersion": "2023-01-01",
  "kind": "app,linux | functionapp,linux",
  "properties": {
    "serverFarmId": "[planResourceId]",
    "siteConfig": {
      "linuxFxVersion": "NODE|20-lts | PYTHON|3.12 | JAVA|17-java17 | DOTNETCORE|8.0",
      "alwaysOn": true,
      "appSettings": [
        { "name": "KEY", "value": "VALUE" }
      ]
    },
    "httpsOnly": true
  }
}
```

**Runtime Stacks (linuxFxVersion):**
| Runtime | Value |
|---------|-------|
| Node.js 20 | `NODE\|20-lts` |
| Python 3.12 | `PYTHON\|3.12` |
| Java 17 | `JAVA\|17-java17` |
| .NET 8 | `DOTNETCORE\|8.0` |
| PHP 8.3 | `PHP\|8.3` |
| Go | Docker container |

---

## Database Resources

### Microsoft.DBforMySQL/flexibleServers

```json
{
  "type": "Microsoft.DBforMySQL/flexibleServers",
  "apiVersion": "2023-06-30",
  "sku": {
    "name": "Standard_B1ms | Standard_D2ds_v4 | Standard_D4ds_v4",
    "tier": "Burstable | GeneralPurpose | MemoryOptimized"
  },
  "properties": {
    "version": "8.0.21 | 5.7",
    "administratorLogin": "[username]",
    "administratorLoginPassword": "[securestring]",
    "storage": { "storageSizeGB": 20 },
    "backup": { "backupRetentionDays": 7, "geoRedundantBackup": "Disabled | Enabled" },
    "highAvailability": { "mode": "Disabled | ZoneRedundant | SameZone" }
  }
}
```

### Microsoft.DBforPostgreSQL/flexibleServers

Same structure as MySQL, but:
- `"version": "16 | 15 | 14 | 13"`
- Type: `Microsoft.DBforPostgreSQL/flexibleServers`

**Database SKU Tiers:**
| Tier | SKUs | Use Case |
|------|------|----------|
| Burstable | B1ms, B2s, B2ms | Dev/test, low traffic |
| GeneralPurpose | D2ds_v4 ~ D64ds_v4 | Production workloads |
| MemoryOptimized | E2ds_v4 ~ E64ds_v4 | High-memory analytics |

**HA Modes:**
- `Disabled`: Single server, no HA
- `SameZone`: Standby in same AZ (faster failover)
- `ZoneRedundant`: Standby in different AZ (zone failure protection)

### Firewall Rules

```json
{
  "type": "Microsoft.DBforMySQL/flexibleServers/firewallRules",
  "name": "[concat(serverName, '/AllowAzureServices')]",
  "properties": {
    "startIpAddress": "0.0.0.0",
    "endIpAddress": "0.0.0.0"
  }
}
```

- `0.0.0.0` to `0.0.0.0` = Allow Azure services
- Specific IP ranges for application access

---

## Cache Resources

### Microsoft.Cache/redis

```json
{
  "type": "Microsoft.Cache/redis",
  "apiVersion": "2023-08-01",
  "properties": {
    "sku": {
      "name": "Basic | Standard | Premium",
      "family": "C | P",
      "capacity": 0  // 0-6 for C family, 1-5 for P family
    },
    "enableNonSslPort": false,
    "minimumTlsVersion": "1.2",
    "redisConfiguration": {
      "maxmemory-policy": "allkeys-lru"
    }
  }
}
```

**Redis Tiers:**
| Tier | Family | Sizes | SLA | Replication | Use Case |
|------|--------|-------|-----|-------------|----------|
| Basic | C | 250MB-53GB | No | No | Dev/test |
| Standard | C | 250MB-53GB | 99.9% | Primary/Replica | Production |
| Premium | P | 6-120GB | 99.9% | Cluster | High throughput |

---

## Network Resources

### Microsoft.Network/virtualNetworks

```json
{
  "type": "Microsoft.Network/virtualNetworks",
  "properties": {
    "addressSpace": { "addressPrefixes": ["10.0.0.0/16"] },
    "subnets": [{
      "name": "default",
      "properties": {
        "addressPrefix": "10.0.0.0/24",
        "networkSecurityGroup": { "id": "[nsgId]" }
      }
    }]
  }
}
```

**Recommended Subnet Layout:**
| Subnet | CIDR | Purpose |
|--------|------|---------|
| default | 10.0.0.0/24 | Application VMs |
| db-subnet | 10.0.1.0/24 | Database (private endpoint) |
| appgw-subnet | 10.0.2.0/24 | Application Gateway (dedicated) |
| aks-subnet | 10.0.4.0/22 | AKS nodes (larger range) |

### Microsoft.Network/applicationGateways

Key properties:
- `sku.name`: `Standard_v2 | WAF_v2`
- `autoscaleConfiguration`: `minCapacity: 1, maxCapacity: 3-10`
- `frontendIPConfigurations`: Public IP binding
- `backendAddressPools`: App Service FQDN or VM IPs
- `backendHttpSettingsCollection`: Port, protocol, timeout
- `httpListeners`: Frontend IP + port binding
- `requestRoutingRules`: Listener → backend mapping (priority required)

### Microsoft.Network/loadBalancers

Key properties:
- `sku.name`: `Standard` (recommended) or `Basic`
- `frontendIPConfigurations`: Public IP
- `backendAddressPools`: VM/VMSS references
- `loadBalancingRules`: Frontend port → backend port mapping
- `probes`: Health probes (HTTP, TCP, HTTPS)

---

## Container Resources

### Microsoft.ContainerService/managedClusters (AKS)

```json
{
  "type": "Microsoft.ContainerService/managedClusters",
  "apiVersion": "2024-01-01",
  "identity": { "type": "SystemAssigned" },
  "properties": {
    "dnsPrefix": "[prefix]",
    "kubernetesVersion": "1.29 | 1.30",
    "agentPoolProfiles": [{
      "name": "nodepool1",
      "count": 3,
      "vmSize": "Standard_B2s | Standard_D2s_v5",
      "osType": "Linux",
      "mode": "System",
      "enableAutoScaling": true,
      "minCount": 2,
      "maxCount": 5,
      "availabilityZones": ["1", "2", "3"]
    }],
    "networkProfile": {
      "networkPlugin": "azure | kubenet",
      "loadBalancerSku": "standard"
    }
  }
}
```

**AKS Best Practices:**
- Minimum 3 system nodes for production
- Separate system and user node pools
- Enable cluster autoscaler
- Use Azure CNI for VNet integration
- Pod anti-affinity across availability zones

### Microsoft.ContainerRegistry/registries (ACR)

```json
{
  "type": "Microsoft.ContainerRegistry/registries",
  "apiVersion": "2023-07-01",
  "sku": { "name": "Basic | Standard | Premium" },
  "properties": { "adminUserEnabled": true }
}
```

| Tier | Storage | Build | Replication | Price |
|------|---------|-------|-------------|-------|
| Basic | 10GB | No | No | $5/mo |
| Standard | 100GB | No | No | $20/mo |
| Premium | 500GB | Yes | Geo-replication | $50/mo |

---

## Serverless Resources

### Azure Functions (Consumption Plan)

App Service Plan with `sku.name: "Y1"` + Function App site.

**Key Function App Settings:**
| Setting | Value | Purpose |
|---------|-------|---------|
| `FUNCTIONS_EXTENSION_VERSION` | `~4` | Runtime version |
| `FUNCTIONS_WORKER_RUNTIME` | `node\|python\|dotnet\|java` | Language runtime |
| `AzureWebJobsStorage` | connection string | Required storage |
| `WEBSITE_NODE_DEFAULT_VERSION` | `~20` | Node.js version |

### Microsoft.ApiManagement/service

```json
{
  "type": "Microsoft.ApiManagement/service",
  "sku": {
    "name": "Developer | Basic | Standard | Premium",
    "capacity": 1
  },
  "properties": {
    "publisherEmail": "[email]",
    "publisherName": "[name]"
  }
}
```

| Tier | Price | SLA | Use Case |
|------|-------|-----|----------|
| Developer | $47/mo | No | Dev/test |
| Basic | $149/mo | 99.95% | Low traffic |
| Standard | $698/mo | 99.95% | Production |
| Premium | $2,794/mo | 99.99% | Multi-region |

---

## Azure Architecture Center Documentation Path

For complex deployments, read directly from:

```
C:\work\architecture-center\docs\guide\technology-choices\   → Compute/DB/LB selection decision trees
C:\work\architecture-center\docs\guide\aks\                  → AKS HA, firewall, blue-green deployment
C:\work\architecture-center\docs\guide\architecture-styles\  → N-tier, microservices, event-driven, serverless
C:\work\architecture-center\docs\guide\multitenant\service\  → 18 service-specific multitenancy guides
C:\work\architecture-center\docs\best-practices\             → Auto-scaling, caching, CDN, monitoring
C:\work\architecture-center\docs\example-scenario\           → 83 real-world architecture examples
C:\work\architecture-center\docs\high-availability\          → Multi-region HA with Traffic Manager + App Gateway
```
