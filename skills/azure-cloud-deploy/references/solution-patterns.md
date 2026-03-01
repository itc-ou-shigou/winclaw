# Solution Patterns - Resource Composition Guide

Maps complex deployment scenarios to proven Azure resource combinations.

> When building ARM templates, **always follow the dependency graph** below. Azure Resource Manager resolves `dependsOn` automatically, but explicit ordering prevents race conditions.

## Resource Dependency Graph (Core)

```
ResourceGroup
  │
  ├──> VNet ──> Subnet ──> NSG (association)
  │      │        │
  │      │        ├──> VM ──> NIC ──> Public IP
  │      │        │                    ──> CustomScriptExtension (code deploy)
  │      │        │
  │      │        ├──> Azure DB Flexible Server ──> FirewallRule ──> Database
  │      │        │
  │      │        ├──> Azure Cache for Redis
  │      │        │
  │      │        ├──> Application Gateway ──> Public IP ──> Backend Pool
  │      │        │
  │      │        ├──> Load Balancer ──> Public IP ──> Backend Pool ──> Health Probe
  │      │        │
  │      │        ├──> VMSS ──> AutoscaleSettings
  │      │        │
  │      │        └──> AKS Cluster ──> Node Pool
  │      │
  │      └──> Private Endpoint ──> Private DNS Zone
  │
  ├──> App Service Plan ──> App Service (Web App / Function App)
  │
  ├──> Storage Account ──> Blob Container
  │
  ├──> Container Registry (ACR)
  │
  ├──> Key Vault ──> Secrets / Certificates
  │
  ├──> CDN Profile ──> CDN Endpoint
  │
  └──> API Management Service ──> API ──> Operation
```

## Pattern 1: Lite (Single VM)

**Use for**: Personal projects, dev/test, minimal budget
**Budget**: $10-40/mo | **Traffic**: <500 visits/day

**Resource composition**:
```
ResourceGroup
  > VNet > Subnet > NSG (HTTP 80, HTTPS 443, SSH 22)
  > Public IP (Standard Static)
  > NIC (Subnet + Public IP + NSG)
  > VM (Ubuntu 22.04, B1s/B2s)
    > CustomScriptExtension (install runtime + deploy code)
```

**Key patterns**:
- `Microsoft.Compute/virtualMachines/extensions` with `CustomScript` for post-deploy automation (no SSH needed in ARM)
- NSG rules: allow inbound 80, 443, restrict SSH to specific IP
- `cloud-init` via `osProfile.customData` for boot-time configuration

**Deployment order**: NSG → VNet → Public IP → NIC → VM → CustomScriptExtension

---

## Pattern 2: Standard (App Service + Database)

**Use for**: Production web apps, small business
**Budget**: $40-120/mo | **Traffic**: 500-5,000 visits/day

**Resource composition**:
```
ResourceGroup
  > App Service Plan (B1/B2, Linux)
  > App Service (Node.js/Python/Java/.NET)
    > siteConfig.appSettings (DB connection, env vars)
    > siteConfig.connectionStrings
  > Azure Database for MySQL/PostgreSQL Flexible Server
    > FirewallRule (AllowAzureServices: 0.0.0.0)
```

**Key patterns**:
- `serverFarmId` links App Service → App Service Plan
- `linuxFxVersion` sets runtime: `NODE|20-lts`, `PYTHON|3.12`, etc.
- `httpsOnly: true` enforces HTTPS
- DB Firewall `0.0.0.0` to `0.0.0.0` allows all Azure services to connect
- App Settings as array: `[{"name": "DB_HOST", "value": "[reference()]"}]`

**Deployment order**: App Service Plan → DB Flexible Server → FirewallRule → App Service

---

## Pattern 3: HA (Multi-Instance + Application Gateway)

**Use for**: Production apps requiring high availability, SLA 99.95%
**Budget**: $120-250/mo | **Traffic**: 5,000-50,000 visits/day

**Resource composition**:
```
ResourceGroup
  > VNet > Subnet (app) + Subnet (appgw, dedicated /24)
  > NSG (app subnet)
  > App Service Plan (S1+, with auto-scale)
  > App Service (2+ instances via plan capacity)
    > siteConfig.appSettings
  > Azure Database Flexible Server (ZoneRedundant HA)
    > FirewallRule
  > Public IP (Standard Static, for App Gateway)
  > Application Gateway v2
    > frontendIPConfiguration → Public IP
    > backendAddressPool → App Service FQDN
    > backendHttpSettings (port 443, HTTPS probe)
    > httpListener (HTTP + HTTPS)
    > requestRoutingRule (priority required)
```

**Key patterns**:
- Application Gateway requires **dedicated subnet** (no other resources)
- Backend pool uses App Service FQDN, not IP: `{appName}.azurewebsites.net`
- `backendHttpSettings.pickHostNameFromBackendAddress: true` for App Service
- Health probe: `path: "/health"`, `protocol: "Https"`, `pickHostNameFromBackendHttpSettings: true`
- Routing rule must have `priority` (integer, unique per rule)
- DB `highAvailability.mode: "ZoneRedundant"` for cross-AZ failover

**Deployment order**: VNet → NSG → App Service Plan → DB → Public IP → App Gateway → App Service

---

## Pattern 4: Elastic (VMSS + Redis + CDN)

**Use for**: High-traffic apps with auto-scaling
**Budget**: $200-500/mo | **Traffic**: 50,000-500,000 visits/day

**Resource composition**:
```
ResourceGroup
  > VNet > Subnet
  > NSG
  > Public IP (Load Balancer)
  > Load Balancer (Standard)
    > frontendIPConfiguration → Public IP
    > backendAddressPool
    > loadBalancingRule (80 → 80)
    > healthProbe (HTTP /health)
  > VMSS (2-10 instances, B2s/D2s_v5)
    > virtualMachineProfile.networkProfile → LB Backend Pool
    > virtualMachineProfile.extensionProfile → CustomScriptExtension
  > AutoscaleSettings (CPU 70% scale-out, 25% scale-in)
  > Azure Database Flexible Server (GeneralPurpose)
    > FirewallRule
  > Azure Cache for Redis (Standard C1)
  > CDN Profile (Standard Microsoft)
    > CDN Endpoint → LB Public IP as origin
```

**Key patterns**:
- VMSS `networkProfile.networkInterfaceConfigurations[].ipConfigurations[].loadBalancerBackendAddressPools` links to LB
- AutoscaleSettings `targetResourceUri` references VMSS resource ID
- Scale-out: CPU > 70% → add 1, cooldown 5min
- Scale-in: CPU < 25% → remove 1, cooldown 10min
- Redis connection string via `listKeys()` ARM function
- CDN origin: LB public IP hostname, `originHostHeader` must match

**Deployment order**: NSG → VNet → Public IP → LB → VMSS → Autoscale → DB → Redis → CDN

---

## Pattern 5: Serverless (Functions + API Management)

**Use for**: API backends, event-driven processing, zero idle cost
**Budget**: $0-100/mo | **Traffic**: Variable, up to 100,000 visits/day

**Resource composition**:
```
ResourceGroup
  > Storage Account (required for Functions runtime)
  > App Service Plan (Y1 Consumption)
  > Function App
    > appSettings: FUNCTIONS_EXTENSION_VERSION, FUNCTIONS_WORKER_RUNTIME
    > appSettings: AzureWebJobsStorage → Storage connection string
  > API Management (Developer / Basic tier)
    > publisherEmail, publisherName (required)
  > Azure Database Flexible Server (Burstable B1ms, optional)
    > FirewallRule
```

**Key patterns**:
- Storage Account is **mandatory** for Function Apps (stores triggers, logs, state)
- `AzureWebJobsStorage` app setting: `[concat('DefaultEndpointsProtocol=https;AccountName=', ...)]`
- Consumption plan: `sku.name: "Y1"`, `properties.reserved: true` (Linux)
- Function App `kind`: `"functionapp,linux"` for Linux
- API Management deployment takes 30-45 minutes (longest Azure resource)
- API Management `sku.name: "Developer"` for dev/test ($47/mo)

**Deployment order**: Storage Account → Consumption Plan → Function App → DB → API Management

---

## Pattern 6: Container (AKS + ACR)

**Use for**: Microservices, complex multi-container apps
**Budget**: $250+/mo | **Traffic**: 50,000-1,000,000+ visits/day

**Resource composition**:
```
ResourceGroup
  > VNet > Subnet (for AKS, /22 CIDR)
  > NSG
  > AKS Managed Cluster
    > identity: SystemAssigned
    > agentPoolProfiles: 3 nodes, D2s_v5
    > enableAutoScaling: true (2-5 nodes)
    > networkProfile: azure CNI
    > availabilityZones: ["1", "2", "3"]
  > Azure Container Registry (Standard)
    > adminUserEnabled: true
  > Azure Database Flexible Server (optional)
    > FirewallRule
```

**Key patterns**:
- AKS subnet needs `/22` or larger (256+ IPs for pods with Azure CNI)
- `identity.type: "SystemAssigned"` creates managed identity for AKS
- AKS → ACR integration: `az aks update --attach-acr <ACR_NAME>` post-deploy
- Separate system and user node pools in production
- `agentPoolProfiles[].availabilityZones` for cross-AZ resilience
- AKS control plane free tier: `sku.name: "Base"`, `sku.tier: "Free"`

**Deployment order**: VNet → NSG → ACR → AKS → DB

---

## Cross-Pattern: Managed Identity Integration

For all patterns using `standard` or higher security:

```json
{
  "type": "Microsoft.ManagedIdentity/userAssignedIdentities",
  "apiVersion": "2023-01-31",
  "name": "[variables('managedIdentityName')]",
  "location": "[parameters('location')]"
}
```

- App Service: `identity.type: "SystemAssigned"` → auto-creates identity
- VM/VMSS: `identity.type: "SystemAssigned"` → access Key Vault, Storage
- AKS: `identity.type: "SystemAssigned"` → access ACR, Key Vault
- Role Assignment: `Microsoft.Authorization/roleAssignments` to grant permissions

---

## Cross-Pattern: Key Vault Integration

```json
{
  "type": "Microsoft.KeyVault/vaults",
  "apiVersion": "2023-07-01",
  "properties": {
    "tenantId": "[subscription().tenantId]",
    "sku": { "name": "standard", "family": "A" },
    "accessPolicies": [],
    "enableRbacAuthorization": true
  }
}
```

- Store DB passwords, API keys, certificates
- Reference in ARM: `"[reference(resourceId('Microsoft.KeyVault/vaults/secrets', ...))]"`
- App Service can use Key Vault references: `@Microsoft.KeyVault(SecretUri=...)`

---

## Cross-Pattern: Azure Monitor Integration

```json
{
  "type": "Microsoft.Insights/components",
  "apiVersion": "2020-02-02",
  "kind": "web",
  "properties": {
    "Application_Type": "web",
    "WorkspaceResourceId": "[resourceId('Microsoft.OperationalInsights/workspaces', ...)]"
  }
}
```

- Application Insights for App Service / Functions
- Log Analytics Workspace for AKS / VM monitoring
- Diagnostic Settings: `Microsoft.Insights/diagnosticSettings` on each resource
- Metric Alerts: `Microsoft.Insights/metricAlerts` for CPU, memory, errors

---

## ARM Template Functions Reference

| Function | Usage | Example |
|----------|-------|---------|
| `resourceId()` | Get resource ID | `[resourceId('Microsoft.Network/virtualNetworks', 'myVnet')]` |
| `reference()` | Get resource properties | `[reference('myDB').fullyQualifiedDomainName]` |
| `concat()` | String concatenation | `[concat(parameters('prefix'), '-vm')]` |
| `parameters()` | Access template params | `[parameters('vmSize')]` |
| `variables()` | Access template vars | `[variables('subnetRef')]` |
| `subscription()` | Subscription info | `[subscription().subscriptionId]` |
| `resourceGroup()` | RG info | `[resourceGroup().location]` |
| `listKeys()` | Get access keys | `[listKeys(resourceId('Microsoft.Storage/storageAccounts', ...), '2023-01-01').keys[0].value]` |
| `uniqueString()` | Deterministic hash | `[uniqueString(resourceGroup().id)]` |
| `format()` | String formatting | `[format('{0}-{1}', parameters('prefix'), 'db')]` |

---

## Azure Architecture Center Cross-References

For deep-dive into each pattern, consult:

| Topic | Path |
|-------|------|
| Compute selection | `C:\work\architecture-center\docs\guide\technology-choices\compute-decision-tree.md` |
| Database selection | `C:\work\architecture-center\docs\guide\technology-choices\data-store-overview.md` |
| Load balancing | `C:\work\architecture-center\docs\guide\technology-choices\load-balancing-overview.md` |
| AKS day-2 ops | `C:\work\architecture-center\docs\guide\aks\` |
| Architecture styles | `C:\work\architecture-center\docs\guide\architecture-styles\` |
| Auto-scaling | `C:\work\architecture-center\docs\best-practices\auto-scaling.md` |
| Caching | `C:\work\architecture-center\docs\best-practices\caching.md` |
| CDN | `C:\work\architecture-center\docs\best-practices\cdn.md` |
| N-tier app | `C:\work\architecture-center\docs\guide\architecture-styles\n-tier.md` |
| Multi-region HA | `C:\work\architecture-center\docs\high-availability\` |
| Example scenarios | `C:\work\architecture-center\docs\example-scenario\` (83+ real-world examples) |
