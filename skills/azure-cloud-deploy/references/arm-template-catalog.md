# ARM Template Catalog

Index of all base templates in `assets/arm-base-templates/`. Use as starting points for ARM template generation.

> Path prefix: `C:\work\winclaw\skills\azure-cloud-deploy\assets\arm-base-templates\`

## Quick Lookup by Architecture Pattern

| Pattern | Primary Template | Resources | Description |
|---------|-----------------|-----------|-------------|
| Lite | `vm-lite.json` | 5 | Single VM + VNet + NSG + Public IP |
| Standard | `appservice-db-standard.json` | 4 | App Service + Azure DB Flexible |
| HA | `appservice-ha.json` | 7 | App Service + App Gateway + HA DB |
| Elastic | `vmss-elastic.json` | 9 | VMSS + LB + Redis + CDN + DB |
| Serverless | `functions-serverless.json` | 5 | Functions + API Management + Storage |
| Container | `aks-container.json` | 4 | AKS + ACR + optional DB |

## Quick Lookup by Service

| Service | Template | Key Properties |
|---------|----------|---------------|
| VM (Linux) | `vm-lite.json` | imageRef, vmSize, NSG rules |
| App Service Plan | `appservice-db-standard.json` | sku, kind, reserved |
| App Service (Web App) | `appservice-db-standard.json` | linuxFxVersion, appSettings |
| MySQL Flexible Server | `appservice-db-standard.json` | sku, version, storage, HA |
| PostgreSQL Flexible Server | (same structure as MySQL) | version: "16" instead of "8.0.21" |
| Application Gateway v2 | `appservice-ha.json` | sku, frontendIP, backendPool, rules |
| Azure Cache for Redis | `vmss-elastic.json` | sku, enableNonSslPort, TLS |
| CDN Profile + Endpoint | `vmss-elastic.json` | profileName, origins, optimizationType |
| VMSS | `vmss-elastic.json` | capacity, upgradePolicy, autoscale |
| Autoscale Settings | `vmss-elastic.json` | metricTrigger, scaleAction, cooldown |
| Load Balancer (Standard) | `vmss-elastic.json` | frontendIP, probes, rules |
| Storage Account | `functions-serverless.json` | kind, sku, supportsHttpsTrafficOnly |
| Function App | `functions-serverless.json` | FUNCTIONS_EXTENSION_VERSION, workerRuntime |
| API Management | `functions-serverless.json` | publisherEmail, sku |
| AKS Cluster | `aks-container.json` | kubernetesVersion, agentPoolProfiles, identity |
| Container Registry | `aks-container.json` | sku, adminUserEnabled |
| VNet + Subnet | (all templates) | addressSpace, subnets, NSG |
| NSG | (all templates) | securityRules, direction, access |
| Public IP | `vm-lite.json` | sku, allocationMethod |
| Network Interface | `vm-lite.json` | ipConfigurations, subnetRef |

## Template Structure Reference

All ARM templates follow this structure:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "location": {
      "type": "string",
      "defaultValue": "[resourceGroup().location]"
    },
    "adminPassword": {
      "type": "securestring",
      "metadata": { "description": "Administrator password" }
    }
  },
  "variables": {
    "vnetName": "[format('{0}-vnet', parameters('projectName'))]",
    "subnetRef": "[resourceId('Microsoft.Network/virtualNetworks/subnets', ...)]"
  },
  "resources": [
    { "type": "Microsoft.Network/virtualNetworks", "..." },
    { "type": "Microsoft.Compute/virtualMachines", "..." }
  ],
  "outputs": {
    "publicIP": {
      "type": "string",
      "value": "[reference(resourceId('Microsoft.Network/publicIPAddresses', ...)).ipAddress]"
    }
  }
}
```

## Parameter Types and Conventions

| Type | Usage | Example |
|------|-------|---------|
| `string` | Names, regions, SKUs | `"Standard_B2s"` |
| `securestring` | Passwords, secrets | `"P@ssw0rd!"` (never logged) |
| `int` | Counts, sizes | `20` (storage GB) |
| `bool` | Feature flags | `true` (enableHTTPS) |
| `array` | Multiple values | `["1", "2", "3"]` (availability zones) |
| `object` | Complex configs | `{"name": "rule1", "priority": 100}` |

## Common Variables Patterns

```json
{
  "variables": {
    "prefix": "[parameters('projectName')]",
    "vnetName": "[format('{0}-vnet', variables('prefix'))]",
    "subnetName": "default",
    "nsgName": "[format('{0}-nsg', variables('prefix'))]",
    "publicIPName": "[format('{0}-pip', variables('prefix'))]",
    "nicName": "[format('{0}-nic', variables('prefix'))]",
    "vmName": "[format('{0}-vm', variables('prefix'))]",
    "planName": "[format('{0}-plan', variables('prefix'))]",
    "appName": "[format('{0}-app', variables('prefix'))]",
    "dbName": "[format('{0}-db', variables('prefix'))]",
    "subnetRef": "[resourceId('Microsoft.Network/virtualNetworks/subnets', variables('vnetName'), variables('subnetName'))]",
    "uniqueSuffix": "[uniqueString(resourceGroup().id)]"
  }
}
```

## Deployment Commands

### Deploy via az CLI

```bash
# Create resource group
az group create --name myapp-rg --location eastus

# Deploy template
az deployment group create \
  --resource-group myapp-rg \
  --template-file azuredeploy.json \
  --parameters adminPassword='<PASSWORD>'

# Verify deployment
az deployment group show \
  --resource-group myapp-rg \
  --name azuredeploy \
  --query properties.outputs

# Delete all resources
az group delete --name myapp-rg --yes --no-wait
```

### Deploy via Azure Portal

1. Search "Deploy a custom template" in Azure Portal
2. Click "Build your own template in the editor"
3. Paste template JSON
4. Fill parameters → Review + Create → Create

## Template Validation

Before deployment, validate with:

```bash
# CLI validation
az deployment group validate \
  --resource-group myapp-rg \
  --template-file azuredeploy.json \
  --parameters adminPassword='test'

# Script validation
python scripts/validate_template.py --input azuredeploy.json --strict
```

Common validation checks:
- Schema version is `2019-04-01` or later
- All `parameters()` and `variables()` references resolve
- `dependsOn` ordering is correct
- No hardcoded passwords (use `securestring`)
- NSG rules don't expose unnecessary ports
- DB firewall doesn't use overly broad IP ranges
