#!/usr/bin/env python3
"""
Generate an ARM (Azure Resource Manager) JSON template from a recommendation JSON.

Usage:
    python generate_arm_template.py --recommendation recommendation.json --output azuredeploy.json
    echo '{"pattern":"standard",...}' | python generate_arm_template.py --output azuredeploy.json

Reads the recommendation (from analyze_requirements.py) and assembles a deployable
ARM template for all 6 patterns: lite, standard, ha, elastic, serverless, container.
"""

import argparse
import json
import sys
import os


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_spec(rec, service_key, default):
    for item in rec.get("cost_breakdown", []):
        if service_key in item.get("service", ""):
            return item.get("spec", default)
    return default


def _get_db_engine(rec):
    db_req = rec.get("requirements", {}).get("db", "mysql")
    base = db_req.split("+")[0]
    if base == "postgresql":
        return "postgresql"
    return "mysql"


def _needs_redis(rec):
    db = rec.get("requirements", {}).get("db", "none")
    pattern = rec.get("pattern", "")
    return "redis" in db or pattern == "elastic"


# ---------------------------------------------------------------------------
# ARM Template Skeleton
# ---------------------------------------------------------------------------

def arm_skeleton(description):
    return {
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
        "contentVersion": "1.0.0.0",
        "metadata": {
            "description": description,
            "_generator": {
                "name": "azure-cloud-deploy-skill",
                "version": "1.0.0"
            }
        },
        "parameters": {},
        "variables": {},
        "resources": [],
        "outputs": {}
    }


# ---------------------------------------------------------------------------
# Common Parameters
# ---------------------------------------------------------------------------

def param_location():
    return {
        "location": {
            "type": "string",
            "defaultValue": "[resourceGroup().location]",
            "metadata": {"description": "Location for all resources."}
        }
    }


def param_admin_username():
    return {
        "adminUsername": {
            "type": "string",
            "defaultValue": "azureuser",
            "metadata": {"description": "Admin username for VM/DB."}
        }
    }


def param_admin_password():
    return {
        "adminPassword": {
            "type": "securestring",
            "metadata": {"description": "Admin password (min 12 chars, must include upper, lower, number, special)."}
        }
    }


def param_db_password():
    return {
        "dbAdminPassword": {
            "type": "securestring",
            "metadata": {"description": "Database administrator password."}
        }
    }


# ---------------------------------------------------------------------------
# Common Variables
# ---------------------------------------------------------------------------

def var_common(project_name="app"):
    return {
        "projectName": project_name,
        "vnetName": f"[concat(variables('projectName'), '-vnet')]",
        "subnetName": "default",
        "nsgName": f"[concat(variables('projectName'), '-nsg')]",
        "vnetAddressPrefix": "10.0.0.0/16",
        "subnetAddressPrefix": "10.0.0.0/24"
    }


# ---------------------------------------------------------------------------
# Resource: Virtual Network + NSG
# ---------------------------------------------------------------------------

def resource_nsg():
    return {
        "type": "Microsoft.Network/networkSecurityGroups",
        "apiVersion": "2023-09-01",
        "name": "[variables('nsgName')]",
        "location": "[parameters('location')]",
        "properties": {
            "securityRules": [
                {
                    "name": "AllowHTTP",
                    "properties": {
                        "priority": 100,
                        "direction": "Inbound",
                        "access": "Allow",
                        "protocol": "Tcp",
                        "sourcePortRange": "*",
                        "destinationPortRange": "80",
                        "sourceAddressPrefix": "*",
                        "destinationAddressPrefix": "*"
                    }
                },
                {
                    "name": "AllowHTTPS",
                    "properties": {
                        "priority": 110,
                        "direction": "Inbound",
                        "access": "Allow",
                        "protocol": "Tcp",
                        "sourcePortRange": "*",
                        "destinationPortRange": "443",
                        "sourceAddressPrefix": "*",
                        "destinationAddressPrefix": "*"
                    }
                },
                {
                    "name": "AllowSSH",
                    "properties": {
                        "priority": 120,
                        "direction": "Inbound",
                        "access": "Allow",
                        "protocol": "Tcp",
                        "sourcePortRange": "*",
                        "destinationPortRange": "22",
                        "sourceAddressPrefix": "*",
                        "destinationAddressPrefix": "*"
                    }
                }
            ]
        }
    }


def resource_vnet():
    return {
        "type": "Microsoft.Network/virtualNetworks",
        "apiVersion": "2023-09-01",
        "name": "[variables('vnetName')]",
        "location": "[parameters('location')]",
        "dependsOn": [
            "[resourceId('Microsoft.Network/networkSecurityGroups', variables('nsgName'))]"
        ],
        "properties": {
            "addressSpace": {
                "addressPrefixes": ["[variables('vnetAddressPrefix')]"]
            },
            "subnets": [
                {
                    "name": "[variables('subnetName')]",
                    "properties": {
                        "addressPrefix": "[variables('subnetAddressPrefix')]",
                        "networkSecurityGroup": {
                            "id": "[resourceId('Microsoft.Network/networkSecurityGroups', variables('nsgName'))]"
                        }
                    }
                }
            ]
        }
    }


# ---------------------------------------------------------------------------
# Resource: Virtual Machine (lite pattern)
# ---------------------------------------------------------------------------

def resource_public_ip(name_var="publicIpName"):
    return {
        "type": "Microsoft.Network/publicIPAddresses",
        "apiVersion": "2023-09-01",
        "name": f"[variables('{name_var}')]",
        "location": "[parameters('location')]",
        "sku": {"name": "Standard"},
        "properties": {
            "publicIPAllocationMethod": "Static"
        }
    }


def resource_nic():
    return {
        "type": "Microsoft.Network/networkInterfaces",
        "apiVersion": "2023-09-01",
        "name": "[variables('nicName')]",
        "location": "[parameters('location')]",
        "dependsOn": [
            "[resourceId('Microsoft.Network/virtualNetworks', variables('vnetName'))]",
            "[resourceId('Microsoft.Network/publicIPAddresses', variables('publicIpName'))]"
        ],
        "properties": {
            "ipConfigurations": [
                {
                    "name": "ipconfig1",
                    "properties": {
                        "subnet": {
                            "id": "[resourceId('Microsoft.Network/virtualNetworks/subnets', variables('vnetName'), variables('subnetName'))]"
                        },
                        "privateIPAllocationMethod": "Dynamic",
                        "publicIPAddress": {
                            "id": "[resourceId('Microsoft.Network/publicIPAddresses', variables('publicIpName'))]"
                        }
                    }
                }
            ]
        }
    }


def resource_vm(vm_size="Standard_B2s"):
    return {
        "type": "Microsoft.Compute/virtualMachines",
        "apiVersion": "2023-09-01",
        "name": "[variables('vmName')]",
        "location": "[parameters('location')]",
        "dependsOn": [
            "[resourceId('Microsoft.Network/networkInterfaces', variables('nicName'))]"
        ],
        "properties": {
            "hardwareProfile": {
                "vmSize": vm_size
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
                    "managedDisk": {"storageAccountType": "StandardSSD_LRS"}
                }
            },
            "osProfile": {
                "computerName": "[variables('vmName')]",
                "adminUsername": "[parameters('adminUsername')]",
                "adminPassword": "[parameters('adminPassword')]"
            },
            "networkProfile": {
                "networkInterfaces": [
                    {"id": "[resourceId('Microsoft.Network/networkInterfaces', variables('nicName'))]"}
                ]
            }
        }
    }


# ---------------------------------------------------------------------------
# Resource: App Service (standard/ha)
# ---------------------------------------------------------------------------

def resource_app_service_plan(sku_name="B1", capacity=1):
    return {
        "type": "Microsoft.Web/serverfarms",
        "apiVersion": "2023-01-01",
        "name": "[variables('appServicePlanName')]",
        "location": "[parameters('location')]",
        "sku": {
            "name": sku_name,
            "capacity": capacity
        },
        "kind": "linux",
        "properties": {
            "reserved": True
        }
    }


def resource_app_service(runtime="NODE|20-lts"):
    return {
        "type": "Microsoft.Web/sites",
        "apiVersion": "2023-01-01",
        "name": "[variables('appServiceName')]",
        "location": "[parameters('location')]",
        "dependsOn": [
            "[resourceId('Microsoft.Web/serverfarms', variables('appServicePlanName'))]"
        ],
        "kind": "app,linux",
        "properties": {
            "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', variables('appServicePlanName'))]",
            "siteConfig": {
                "linuxFxVersion": runtime,
                "alwaysOn": True,
                "appSettings": [
                    {"name": "WEBSITE_NODE_DEFAULT_VERSION", "value": "~20"},
                    {"name": "SCM_DO_BUILD_DURING_DEPLOYMENT", "value": "true"}
                ]
            },
            "httpsOnly": True
        }
    }


# ---------------------------------------------------------------------------
# Resource: Azure Database for MySQL/PostgreSQL Flexible Server
# ---------------------------------------------------------------------------

def resource_db_flexible(engine="mysql", sku_name="Standard_B1ms", storage_gb=20):
    if engine == "postgresql":
        rtype = "Microsoft.DBforPostgreSQL/flexibleServers"
        version = "16"
    else:
        rtype = "Microsoft.DBforMySQL/flexibleServers"
        version = "8.0.21"

    return {
        "type": rtype,
        "apiVersion": "2023-06-30",
        "name": "[variables('dbServerName')]",
        "location": "[parameters('location')]",
        "sku": {
            "name": sku_name,
            "tier": "Burstable" if "B" in sku_name else "GeneralPurpose"
        },
        "properties": {
            "version": version,
            "administratorLogin": "[parameters('adminUsername')]",
            "administratorLoginPassword": "[parameters('dbAdminPassword')]",
            "storage": {
                "storageSizeGB": storage_gb
            },
            "backup": {
                "backupRetentionDays": 7,
                "geoRedundantBackup": "Disabled"
            },
            "highAvailability": {
                "mode": "Disabled"
            }
        }
    }


def resource_db_flexible_ha(engine="mysql", sku_name="Standard_B1ms", storage_gb=20):
    """Database with zone-redundant HA enabled."""
    base = resource_db_flexible(engine, sku_name, storage_gb)
    base["properties"]["highAvailability"] = {
        "mode": "ZoneRedundant"
    }
    return base


def resource_db_firewall_rule():
    return {
        "type": "Microsoft.DBforMySQL/flexibleServers/firewallRules",
        "apiVersion": "2023-06-30",
        "name": "[concat(variables('dbServerName'), '/AllowAzureServices')]",
        "dependsOn": [
            "[resourceId('Microsoft.DBforMySQL/flexibleServers', variables('dbServerName'))]"
        ],
        "properties": {
            "startIpAddress": "0.0.0.0",
            "endIpAddress": "0.0.0.0"
        }
    }


# ---------------------------------------------------------------------------
# Resource: Azure Cache for Redis
# ---------------------------------------------------------------------------

def resource_redis(sku_name="Basic", sku_family="C", sku_capacity=0):
    return {
        "type": "Microsoft.Cache/redis",
        "apiVersion": "2023-08-01",
        "name": "[variables('redisName')]",
        "location": "[parameters('location')]",
        "properties": {
            "sku": {
                "name": sku_name,
                "family": sku_family,
                "capacity": sku_capacity
            },
            "enableNonSslPort": False,
            "minimumTlsVersion": "1.2"
        }
    }


# ---------------------------------------------------------------------------
# Resource: Application Gateway (ha pattern)
# ---------------------------------------------------------------------------

def resource_app_gateway():
    return {
        "type": "Microsoft.Network/applicationGateways",
        "apiVersion": "2023-09-01",
        "name": "[variables('appGatewayName')]",
        "location": "[parameters('location')]",
        "dependsOn": [
            "[resourceId('Microsoft.Network/publicIPAddresses', variables('appGwPublicIpName'))]",
            "[resourceId('Microsoft.Network/virtualNetworks', variables('vnetName'))]"
        ],
        "properties": {
            "sku": {
                "name": "Standard_v2",
                "tier": "Standard_v2"
            },
            "autoscaleConfiguration": {
                "minCapacity": 1,
                "maxCapacity": 3
            },
            "gatewayIPConfigurations": [{
                "name": "gatewayIpConfig",
                "properties": {
                    "subnet": {
                        "id": "[resourceId('Microsoft.Network/virtualNetworks/subnets', variables('vnetName'), 'appgw-subnet')]"
                    }
                }
            }],
            "frontendIPConfigurations": [{
                "name": "frontendIpConfig",
                "properties": {
                    "publicIPAddress": {
                        "id": "[resourceId('Microsoft.Network/publicIPAddresses', variables('appGwPublicIpName'))]"
                    }
                }
            }],
            "frontendPorts": [{"name": "httpPort", "properties": {"port": 80}}],
            "backendAddressPools": [{"name": "appServiceBackend", "properties": {}}],
            "backendHttpSettingsCollection": [{
                "name": "httpSettings",
                "properties": {
                    "port": 80,
                    "protocol": "Http",
                    "requestTimeout": 30
                }
            }],
            "httpListeners": [{
                "name": "httpListener",
                "properties": {
                    "frontendIPConfiguration": {
                        "id": "[concat(resourceId('Microsoft.Network/applicationGateways', variables('appGatewayName')), '/frontendIPConfigurations/frontendIpConfig')]"
                    },
                    "frontendPort": {
                        "id": "[concat(resourceId('Microsoft.Network/applicationGateways', variables('appGatewayName')), '/frontendPorts/httpPort')]"
                    },
                    "protocol": "Http"
                }
            }],
            "requestRoutingRules": [{
                "name": "routingRule",
                "properties": {
                    "priority": 100,
                    "ruleType": "Basic",
                    "httpListener": {
                        "id": "[concat(resourceId('Microsoft.Network/applicationGateways', variables('appGatewayName')), '/httpListeners/httpListener')]"
                    },
                    "backendAddressPool": {
                        "id": "[concat(resourceId('Microsoft.Network/applicationGateways', variables('appGatewayName')), '/backendAddressPools/appServiceBackend')]"
                    },
                    "backendHttpSettings": {
                        "id": "[concat(resourceId('Microsoft.Network/applicationGateways', variables('appGatewayName')), '/backendHttpSettingsCollection/httpSettings')]"
                    }
                }
            }]
        }
    }


# ---------------------------------------------------------------------------
# Resource: VMSS (elastic pattern)
# ---------------------------------------------------------------------------

def resource_vmss(vm_size="Standard_B2s"):
    return {
        "type": "Microsoft.Compute/virtualMachineScaleSets",
        "apiVersion": "2023-09-01",
        "name": "[variables('vmssName')]",
        "location": "[parameters('location')]",
        "dependsOn": [
            "[resourceId('Microsoft.Network/virtualNetworks', variables('vnetName'))]",
            "[resourceId('Microsoft.Network/loadBalancers', variables('lbName'))]"
        ],
        "sku": {
            "name": vm_size,
            "tier": "Standard",
            "capacity": 2
        },
        "properties": {
            "overprovision": True,
            "upgradePolicy": {"mode": "Automatic"},
            "virtualMachineProfile": {
                "storageProfile": {
                    "imageReference": {
                        "publisher": "Canonical",
                        "offer": "0001-com-ubuntu-server-jammy",
                        "sku": "22_04-lts-gen2",
                        "version": "latest"
                    },
                    "osDisk": {
                        "createOption": "FromImage",
                        "managedDisk": {"storageAccountType": "StandardSSD_LRS"}
                    }
                },
                "osProfile": {
                    "computerNamePrefix": "[variables('projectName')]",
                    "adminUsername": "[parameters('adminUsername')]",
                    "adminPassword": "[parameters('adminPassword')]"
                },
                "networkProfile": {
                    "networkInterfaceConfigurations": [{
                        "name": "nic",
                        "properties": {
                            "primary": True,
                            "ipConfigurations": [{
                                "name": "ipconfig",
                                "properties": {
                                    "subnet": {
                                        "id": "[resourceId('Microsoft.Network/virtualNetworks/subnets', variables('vnetName'), variables('subnetName'))]"
                                    },
                                    "loadBalancerBackendAddressPools": [{
                                        "id": "[concat(resourceId('Microsoft.Network/loadBalancers', variables('lbName')), '/backendAddressPools/backendPool')]"
                                    }]
                                }
                            }]
                        }
                    }]
                }
            }
        }
    }


def resource_vmss_autoscale():
    return {
        "type": "Microsoft.Insights/autoscalesettings",
        "apiVersion": "2022-10-01",
        "name": "[concat(variables('vmssName'), '-autoscale')]",
        "location": "[parameters('location')]",
        "dependsOn": [
            "[resourceId('Microsoft.Compute/virtualMachineScaleSets', variables('vmssName'))]"
        ],
        "properties": {
            "enabled": True,
            "targetResourceUri": "[resourceId('Microsoft.Compute/virtualMachineScaleSets', variables('vmssName'))]",
            "profiles": [{
                "name": "defaultProfile",
                "capacity": {
                    "minimum": "2",
                    "maximum": "10",
                    "default": "2"
                },
                "rules": [
                    {
                        "metricTrigger": {
                            "metricName": "Percentage CPU",
                            "metricResourceUri": "[resourceId('Microsoft.Compute/virtualMachineScaleSets', variables('vmssName'))]",
                            "operator": "GreaterThan",
                            "threshold": 70,
                            "timeAggregation": "Average",
                            "timeGrain": "PT1M",
                            "timeWindow": "PT5M",
                            "statistic": "Average"
                        },
                        "scaleAction": {
                            "direction": "Increase",
                            "type": "ChangeCount",
                            "value": "1",
                            "cooldown": "PT5M"
                        }
                    },
                    {
                        "metricTrigger": {
                            "metricName": "Percentage CPU",
                            "metricResourceUri": "[resourceId('Microsoft.Compute/virtualMachineScaleSets', variables('vmssName'))]",
                            "operator": "LessThan",
                            "threshold": 30,
                            "timeAggregation": "Average",
                            "timeGrain": "PT1M",
                            "timeWindow": "PT10M",
                            "statistic": "Average"
                        },
                        "scaleAction": {
                            "direction": "Decrease",
                            "type": "ChangeCount",
                            "value": "1",
                            "cooldown": "PT10M"
                        }
                    }
                ]
            }]
        }
    }


def resource_load_balancer():
    return {
        "type": "Microsoft.Network/loadBalancers",
        "apiVersion": "2023-09-01",
        "name": "[variables('lbName')]",
        "location": "[parameters('location')]",
        "sku": {"name": "Standard"},
        "dependsOn": [
            "[resourceId('Microsoft.Network/publicIPAddresses', variables('publicIpName'))]"
        ],
        "properties": {
            "frontendIPConfigurations": [{
                "name": "frontendIpConfig",
                "properties": {
                    "publicIPAddress": {
                        "id": "[resourceId('Microsoft.Network/publicIPAddresses', variables('publicIpName'))]"
                    }
                }
            }],
            "backendAddressPools": [{"name": "backendPool"}],
            "loadBalancingRules": [{
                "name": "httpRule",
                "properties": {
                    "frontendIPConfiguration": {
                        "id": "[concat(resourceId('Microsoft.Network/loadBalancers', variables('lbName')), '/frontendIPConfigurations/frontendIpConfig')]"
                    },
                    "backendAddressPool": {
                        "id": "[concat(resourceId('Microsoft.Network/loadBalancers', variables('lbName')), '/backendAddressPools/backendPool')]"
                    },
                    "probe": {
                        "id": "[concat(resourceId('Microsoft.Network/loadBalancers', variables('lbName')), '/probes/httpProbe')]"
                    },
                    "protocol": "Tcp",
                    "frontendPort": 80,
                    "backendPort": 80,
                    "enableFloatingIP": False
                }
            }],
            "probes": [{
                "name": "httpProbe",
                "properties": {
                    "protocol": "Http",
                    "port": 80,
                    "requestPath": "/",
                    "intervalInSeconds": 15,
                    "numberOfProbes": 2
                }
            }]
        }
    }


# ---------------------------------------------------------------------------
# Resource: Storage Account (serverless)
# ---------------------------------------------------------------------------

def resource_storage_account():
    return {
        "type": "Microsoft.Storage/storageAccounts",
        "apiVersion": "2023-01-01",
        "name": "[variables('storageAccountName')]",
        "location": "[parameters('location')]",
        "sku": {"name": "Standard_LRS"},
        "kind": "StorageV2",
        "properties": {
            "supportsHttpsTrafficOnly": True,
            "minimumTlsVersion": "TLS1_2"
        }
    }


# ---------------------------------------------------------------------------
# Resource: Function App (serverless)
# ---------------------------------------------------------------------------

def resource_function_app():
    return {
        "type": "Microsoft.Web/sites",
        "apiVersion": "2023-01-01",
        "name": "[variables('functionAppName')]",
        "location": "[parameters('location')]",
        "kind": "functionapp,linux",
        "dependsOn": [
            "[resourceId('Microsoft.Web/serverfarms', variables('appServicePlanName'))]",
            "[resourceId('Microsoft.Storage/storageAccounts', variables('storageAccountName'))]"
        ],
        "properties": {
            "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', variables('appServicePlanName'))]",
            "siteConfig": {
                "linuxFxVersion": "Node|20",
                "appSettings": [
                    {
                        "name": "AzureWebJobsStorage",
                        "value": "[concat('DefaultEndpointsProtocol=https;AccountName=', variables('storageAccountName'), ';EndpointSuffix=', environment().suffixes.storage, ';AccountKey=', listKeys(resourceId('Microsoft.Storage/storageAccounts', variables('storageAccountName')), '2023-01-01').keys[0].value)]"
                    },
                    {"name": "FUNCTIONS_EXTENSION_VERSION", "value": "~4"},
                    {"name": "FUNCTIONS_WORKER_RUNTIME", "value": "node"},
                    {"name": "WEBSITE_NODE_DEFAULT_VERSION", "value": "~20"}
                ]
            },
            "httpsOnly": True
        }
    }


def resource_consumption_plan():
    return {
        "type": "Microsoft.Web/serverfarms",
        "apiVersion": "2023-01-01",
        "name": "[variables('appServicePlanName')]",
        "location": "[parameters('location')]",
        "sku": {
            "name": "Y1",
            "tier": "Dynamic"
        },
        "kind": "functionapp",
        "properties": {
            "reserved": True
        }
    }


# ---------------------------------------------------------------------------
# Resource: API Management (serverless)
# ---------------------------------------------------------------------------

def resource_api_management():
    return {
        "type": "Microsoft.ApiManagement/service",
        "apiVersion": "2023-05-01-preview",
        "name": "[variables('apimName')]",
        "location": "[parameters('location')]",
        "sku": {
            "name": "Developer",
            "capacity": 1
        },
        "properties": {
            "publisherEmail": "admin@example.com",
            "publisherName": "[variables('projectName')]"
        }
    }


# ---------------------------------------------------------------------------
# Resource: AKS (container)
# ---------------------------------------------------------------------------

def resource_aks(node_vm_size="Standard_B2s", node_count=3):
    return {
        "type": "Microsoft.ContainerService/managedClusters",
        "apiVersion": "2024-01-01",
        "name": "[variables('aksName')]",
        "location": "[parameters('location')]",
        "identity": {"type": "SystemAssigned"},
        "properties": {
            "dnsPrefix": "[variables('projectName')]",
            "kubernetesVersion": "1.29",
            "agentPoolProfiles": [{
                "name": "nodepool1",
                "count": node_count,
                "vmSize": node_vm_size,
                "osType": "Linux",
                "mode": "System",
                "enableAutoScaling": True,
                "minCount": 2,
                "maxCount": 5
            }],
            "networkProfile": {
                "networkPlugin": "azure",
                "loadBalancerSku": "standard"
            }
        }
    }


def resource_acr():
    return {
        "type": "Microsoft.ContainerRegistry/registries",
        "apiVersion": "2023-07-01",
        "name": "[variables('acrName')]",
        "location": "[parameters('location')]",
        "sku": {"name": "Basic"},
        "properties": {
            "adminUserEnabled": True
        }
    }


# ---------------------------------------------------------------------------
# Resource: CDN Profile (elastic)
# ---------------------------------------------------------------------------

def resource_cdn_profile():
    return {
        "type": "Microsoft.Cdn/profiles",
        "apiVersion": "2023-05-01",
        "name": "[variables('cdnProfileName')]",
        "location": "global",
        "sku": {"name": "Standard_Microsoft"},
        "properties": {}
    }


# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

def outputs_lite():
    return {
        "vmPublicIp": {
            "type": "string",
            "value": "[reference(resourceId('Microsoft.Network/publicIPAddresses', variables('publicIpName'))).ipAddress]"
        },
        "sshCommand": {
            "type": "string",
            "value": "[concat('ssh ', parameters('adminUsername'), '@', reference(resourceId('Microsoft.Network/publicIPAddresses', variables('publicIpName'))).ipAddress)]"
        }
    }


def outputs_standard():
    out = {
        "appServiceUrl": {
            "type": "string",
            "value": "[concat('https://', reference(resourceId('Microsoft.Web/sites', variables('appServiceName'))).defaultHostName)]"
        }
    }
    return out


def outputs_ha():
    out = outputs_standard()
    out["appGatewayPublicIp"] = {
        "type": "string",
        "value": "[reference(resourceId('Microsoft.Network/publicIPAddresses', variables('appGwPublicIpName'))).ipAddress]"
    }
    return out


def outputs_elastic():
    return {
        "lbPublicIp": {
            "type": "string",
            "value": "[reference(resourceId('Microsoft.Network/publicIPAddresses', variables('publicIpName'))).ipAddress]"
        }
    }


def outputs_serverless():
    return {
        "functionAppUrl": {
            "type": "string",
            "value": "[concat('https://', reference(resourceId('Microsoft.Web/sites', variables('functionAppName'))).defaultHostName)]"
        }
    }


def outputs_container():
    return {
        "aksClusterName": {
            "type": "string",
            "value": "[variables('aksName')]"
        },
        "acrLoginServer": {
            "type": "string",
            "value": "[reference(resourceId('Microsoft.ContainerRegistry/registries', variables('acrName'))).loginServer]"
        },
        "getCredentialsCommand": {
            "type": "string",
            "value": "[concat('az aks get-credentials --resource-group ', resourceGroup().name, ' --name ', variables('aksName'))]"
        }
    }


# ---------------------------------------------------------------------------
# Pattern Assemblers
# ---------------------------------------------------------------------------

def build_lite(rec):
    vm_spec = _get_spec(rec, "Virtual Machine", "Standard_B2s")
    tpl = arm_skeleton("Lite pattern: single VM deployment")
    tpl["parameters"].update(param_location())
    tpl["parameters"].update(param_admin_username())
    tpl["parameters"].update(param_admin_password())

    tpl["variables"] = {
        **var_common(),
        "vmName": "[concat(variables('projectName'), '-vm')]",
        "nicName": "[concat(variables('projectName'), '-nic')]",
        "publicIpName": "[concat(variables('projectName'), '-pip')]"
    }

    tpl["resources"] = [
        resource_nsg(),
        resource_vnet(),
        resource_public_ip(),
        resource_nic(),
        resource_vm(vm_spec)
    ]
    tpl["outputs"] = outputs_lite()
    return tpl


def build_standard(rec):
    app_spec = _get_spec(rec, "App Service", "B1")
    db_engine = _get_db_engine(rec)
    db_spec = _get_spec(rec, "Azure DB", "Standard_B1ms")
    has_db = rec.get("requirements", {}).get("db", "none") != "none"
    has_redis = _needs_redis(rec)

    tpl = arm_skeleton("Standard pattern: App Service + managed database")
    tpl["parameters"].update(param_location())
    if has_db:
        tpl["parameters"].update(param_admin_username())
        tpl["parameters"].update(param_db_password())

    variables = {
        **var_common(),
        "appServicePlanName": "[concat(variables('projectName'), '-plan')]",
        "appServiceName": "[concat(variables('projectName'), '-app')]",
    }
    if has_db:
        variables["dbServerName"] = "[concat(variables('projectName'), '-db')]"
    if has_redis:
        variables["redisName"] = "[concat(variables('projectName'), '-redis')]"
    tpl["variables"] = variables

    resources = [
        resource_app_service_plan(app_spec),
        resource_app_service()
    ]
    if has_db:
        resources.append(resource_db_flexible(db_engine, db_spec))
    if has_redis:
        resources.append(resource_redis())

    tpl["resources"] = resources
    tpl["outputs"] = outputs_standard()
    if has_db:
        tpl["outputs"]["dbServerFqdn"] = {
            "type": "string",
            "value": f"[reference(resourceId('{('Microsoft.DBforPostgreSQL' if db_engine == 'postgresql' else 'Microsoft.DBforMySQL')}/flexibleServers', variables('dbServerName'))).fullyQualifiedDomainName]"
        }
    return tpl


def build_ha(rec):
    app_spec = _get_spec(rec, "App Service", "S1")
    db_engine = _get_db_engine(rec)
    db_spec = _get_spec(rec, "Azure DB", "Standard_B1ms")
    has_db = rec.get("requirements", {}).get("db", "none") != "none"

    tpl = arm_skeleton("HA pattern: multi-instance App Service + zone-redundant database + Application Gateway")
    tpl["parameters"].update(param_location())
    if has_db:
        tpl["parameters"].update(param_admin_username())
        tpl["parameters"].update(param_db_password())

    variables = {
        **var_common(),
        "appServicePlanName": "[concat(variables('projectName'), '-plan')]",
        "appServiceName": "[concat(variables('projectName'), '-app')]",
        "appGatewayName": "[concat(variables('projectName'), '-agw')]",
        "appGwPublicIpName": "[concat(variables('projectName'), '-agw-pip')]",
        "appGwSubnetPrefix": "10.0.1.0/24"
    }
    if has_db:
        variables["dbServerName"] = "[concat(variables('projectName'), '-db')]"
    tpl["variables"] = variables

    # Add appgw subnet to vnet
    vnet = resource_vnet()
    vnet["properties"]["subnets"].append({
        "name": "appgw-subnet",
        "properties": {"addressPrefix": "[variables('appGwSubnetPrefix')]"}
    })

    resources = [
        resource_nsg(),
        vnet,
        resource_public_ip("appGwPublicIpName"),
        resource_app_service_plan(app_spec, capacity=2),
        resource_app_service(),
        resource_app_gateway()
    ]
    if has_db:
        resources.append(resource_db_flexible_ha(db_engine, db_spec))

    tpl["resources"] = resources
    tpl["outputs"] = outputs_ha()
    return tpl


def build_elastic(rec):
    vm_spec = _get_spec(rec, "VMSS", "Standard_B2s")
    db_engine = _get_db_engine(rec)
    db_spec = _get_spec(rec, "Azure DB", "Standard_B1ms")
    has_db = rec.get("requirements", {}).get("db", "none") != "none"

    tpl = arm_skeleton("Elastic pattern: VMSS auto-scaling + Redis + CDN")
    tpl["parameters"].update(param_location())
    tpl["parameters"].update(param_admin_username())
    tpl["parameters"].update(param_admin_password())
    if has_db:
        tpl["parameters"].update(param_db_password())

    variables = {
        **var_common(),
        "vmssName": "[concat(variables('projectName'), '-vmss')]",
        "publicIpName": "[concat(variables('projectName'), '-pip')]",
        "lbName": "[concat(variables('projectName'), '-lb')]",
        "redisName": "[concat(variables('projectName'), '-redis')]",
        "cdnProfileName": "[concat(variables('projectName'), '-cdn')]"
    }
    if has_db:
        variables["dbServerName"] = "[concat(variables('projectName'), '-db')]"
    tpl["variables"] = variables

    resources = [
        resource_nsg(),
        resource_vnet(),
        resource_public_ip(),
        resource_load_balancer(),
        resource_vmss(vm_spec),
        resource_vmss_autoscale(),
        resource_redis("Basic", "C", 0),
        resource_cdn_profile()
    ]
    if has_db:
        resources.append(resource_db_flexible(db_engine, db_spec))

    tpl["resources"] = resources
    tpl["outputs"] = outputs_elastic()
    return tpl


def build_serverless(rec):
    db_engine = _get_db_engine(rec)
    db_spec = _get_spec(rec, "Azure DB", "Standard_B1ms")
    has_db = rec.get("requirements", {}).get("db", "none") != "none"

    tpl = arm_skeleton("Serverless pattern: Azure Functions + API Management")
    tpl["parameters"].update(param_location())
    if has_db:
        tpl["parameters"].update(param_admin_username())
        tpl["parameters"].update(param_db_password())

    variables = {
        **var_common(),
        "storageAccountName": "[concat('st', uniqueString(resourceGroup().id))]",
        "appServicePlanName": "[concat(variables('projectName'), '-plan')]",
        "functionAppName": "[concat(variables('projectName'), '-func')]",
        "apimName": "[concat(variables('projectName'), '-apim')]"
    }
    if has_db:
        variables["dbServerName"] = "[concat(variables('projectName'), '-db')]"
    tpl["variables"] = variables

    resources = [
        resource_storage_account(),
        resource_consumption_plan(),
        resource_function_app(),
        resource_api_management()
    ]
    if has_db:
        resources.append(resource_db_flexible(db_engine, db_spec))

    tpl["resources"] = resources
    tpl["outputs"] = outputs_serverless()
    return tpl


def build_container(rec):
    node_spec = _get_spec(rec, "Worker Nodes", "Standard_B2s")
    db_engine = _get_db_engine(rec)
    db_spec = _get_spec(rec, "Azure DB", "Standard_B1ms")
    has_db = rec.get("requirements", {}).get("db", "none") != "none"

    tpl = arm_skeleton("Container pattern: AKS + Azure Container Registry")
    tpl["parameters"].update(param_location())
    if has_db:
        tpl["parameters"].update(param_admin_username())
        tpl["parameters"].update(param_db_password())

    variables = {
        **var_common(),
        "aksName": "[concat(variables('projectName'), '-aks')]",
        "acrName": "[concat('acr', uniqueString(resourceGroup().id))]"
    }
    if has_db:
        variables["dbServerName"] = "[concat(variables('projectName'), '-db')]"
    tpl["variables"] = variables

    resources = [
        resource_aks(node_spec),
        resource_acr()
    ]
    if has_db:
        resources.append(resource_db_flexible(db_engine, db_spec))

    tpl["resources"] = resources
    tpl["outputs"] = outputs_container()
    return tpl


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

BUILDERS = {
    "lite": build_lite,
    "standard": build_standard,
    "ha": build_ha,
    "elastic": build_elastic,
    "serverless": build_serverless,
    "container": build_container,
}


def generate_template(rec):
    pattern = rec.get("pattern", "standard")
    builder = BUILDERS.get(pattern, build_standard)
    return builder(rec)


def main():
    parser = argparse.ArgumentParser(description="Generate ARM template from recommendation")
    parser.add_argument("--recommendation", help="Path to recommendation JSON")
    parser.add_argument("--output", help="Output file path (default: stdout)")
    args = parser.parse_args()

    if args.recommendation:
        with open(args.recommendation, "r", encoding="utf-8") as f:
            rec = json.load(f)
    else:
        rec = json.load(sys.stdin)

    template = generate_template(rec)
    output_json = json.dumps(template, indent=2, ensure_ascii=False)

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output_json)
        print(f"ARM template written to {args.output}", file=sys.stderr)
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(output_json)


if __name__ == "__main__":
    main()
