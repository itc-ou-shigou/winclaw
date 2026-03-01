#!/usr/bin/env python3
"""
Validate an ARM template for correctness and security.

Usage:
    python validate_template.py --input azuredeploy.json
    python validate_template.py --input azuredeploy.json --strict --format json

Checks:
  - JSON structure validity
  - Required ARM schema fields
  - Known Azure resource types
  - Parameter/variable references
  - Security best practices (no hardcoded passwords, no open ports to 0.0.0.0/0)
"""

import argparse
import json
import re
import sys


# Known Azure resource types (most common)
KNOWN_RESOURCE_TYPES = {
    # Compute
    "Microsoft.Compute/virtualMachines",
    "Microsoft.Compute/virtualMachineScaleSets",
    "Microsoft.Compute/disks",
    "Microsoft.Compute/images",
    "Microsoft.Compute/availabilitySets",
    "Microsoft.Compute/virtualMachines/extensions",
    "Microsoft.Compute/virtualMachineScaleSets/extensions",
    # Network
    "Microsoft.Network/virtualNetworks",
    "Microsoft.Network/virtualNetworks/subnets",
    "Microsoft.Network/networkSecurityGroups",
    "Microsoft.Network/networkSecurityGroups/securityRules",
    "Microsoft.Network/networkInterfaces",
    "Microsoft.Network/publicIPAddresses",
    "Microsoft.Network/loadBalancers",
    "Microsoft.Network/loadBalancers/backendAddressPools",
    "Microsoft.Network/applicationGateways",
    "Microsoft.Network/bastionHosts",
    "Microsoft.Network/natGateways",
    "Microsoft.Network/privateDnsZones",
    "Microsoft.Network/privateEndpoints",
    "Microsoft.Network/routeTables",
    "Microsoft.Network/trafficManagerProfiles",
    "Microsoft.Network/frontDoors",
    "Microsoft.Network/dnsZones",
    # Web
    "Microsoft.Web/serverfarms",
    "Microsoft.Web/sites",
    "Microsoft.Web/sites/config",
    "Microsoft.Web/sites/slots",
    "Microsoft.Web/sites/sourcecontrols",
    "Microsoft.Web/certificates",
    # Database - MySQL
    "Microsoft.DBforMySQL/flexibleServers",
    "Microsoft.DBforMySQL/flexibleServers/firewallRules",
    "Microsoft.DBforMySQL/flexibleServers/databases",
    "Microsoft.DBforMySQL/servers",
    # Database - PostgreSQL
    "Microsoft.DBforPostgreSQL/flexibleServers",
    "Microsoft.DBforPostgreSQL/flexibleServers/firewallRules",
    "Microsoft.DBforPostgreSQL/flexibleServers/databases",
    "Microsoft.DBforPostgreSQL/servers",
    # SQL
    "Microsoft.Sql/servers",
    "Microsoft.Sql/servers/databases",
    "Microsoft.Sql/servers/firewallRules",
    "Microsoft.Sql/managedInstances",
    # Cosmos DB
    "Microsoft.DocumentDB/databaseAccounts",
    # Redis
    "Microsoft.Cache/redis",
    "Microsoft.Cache/redis/firewallRules",
    # Storage
    "Microsoft.Storage/storageAccounts",
    "Microsoft.Storage/storageAccounts/blobServices",
    "Microsoft.Storage/storageAccounts/blobServices/containers",
    # Container
    "Microsoft.ContainerService/managedClusters",
    "Microsoft.ContainerRegistry/registries",
    "Microsoft.ContainerInstance/containerGroups",
    # API Management
    "Microsoft.ApiManagement/service",
    "Microsoft.ApiManagement/service/apis",
    # CDN
    "Microsoft.Cdn/profiles",
    "Microsoft.Cdn/profiles/endpoints",
    # Monitor
    "Microsoft.Insights/autoscalesettings",
    "Microsoft.Insights/components",
    "Microsoft.Insights/metricAlerts",
    "Microsoft.Insights/diagnosticSettings",
    # KeyVault
    "Microsoft.KeyVault/vaults",
    "Microsoft.KeyVault/vaults/secrets",
    # Identity
    "Microsoft.ManagedIdentity/userAssignedIdentities",
    # OperationalInsights
    "Microsoft.OperationalInsights/workspaces",
    # Authorization
    "Microsoft.Authorization/roleAssignments",
    # EventGrid
    "Microsoft.EventGrid/topics",
    "Microsoft.EventGrid/eventSubscriptions",
    # ServiceBus
    "Microsoft.ServiceBus/namespaces",
    "Microsoft.ServiceBus/namespaces/queues",
    "Microsoft.ServiceBus/namespaces/topics",
    # SignalR
    "Microsoft.SignalRService/signalR",
    # Logic Apps
    "Microsoft.Logic/workflows",
}


class ValidationResult:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def error(self, msg):
        self.errors.append(msg)

    def warning(self, msg):
        self.warnings.append(msg)

    @property
    def is_valid(self):
        return len(self.errors) == 0

    def summary(self):
        lines = []
        if self.errors:
            lines.append(f"ERRORS ({len(self.errors)}):")
            for e in self.errors:
                lines.append(f"  [ERROR] {e}")
        if self.warnings:
            lines.append(f"WARNINGS ({len(self.warnings)}):")
            for w in self.warnings:
                lines.append(f"  [WARN] {w}")
        if not self.errors and not self.warnings:
            lines.append("VALID - No issues found.")
        return "\n".join(lines)


def validate_structure(tpl, result):
    """Validate basic ARM template structure."""
    if not isinstance(tpl, dict):
        result.error("Template root must be a JSON object")
        return

    # Required fields
    if "$schema" not in tpl:
        result.error("Missing required field: $schema")
    else:
        schema = tpl["$schema"]
        if "deploymentTemplate" not in schema and "subscriptionDeploymentTemplate" not in schema:
            result.warning(f"Unexpected $schema value: {schema}")

    if "contentVersion" not in tpl:
        result.error("Missing required field: contentVersion")

    if "resources" not in tpl:
        result.error("Missing required field: resources")
    elif not isinstance(tpl["resources"], list):
        result.error("'resources' must be an array")
    elif len(tpl["resources"]) == 0:
        result.warning("Template has no resources defined")

    # Optional but expected
    for field in ("parameters", "variables", "outputs"):
        if field in tpl and not isinstance(tpl[field], dict):
            result.error(f"'{field}' must be an object, got {type(tpl[field]).__name__}")


def validate_parameters(tpl, result):
    """Validate parameter definitions."""
    params = tpl.get("parameters", {})
    for name, param in params.items():
        if not isinstance(param, dict):
            result.error(f"Parameter '{name}' must be an object")
            continue
        if "type" not in param:
            result.error(f"Parameter '{name}' missing required 'type' property")
        else:
            valid_types = {"string", "securestring", "int", "bool", "object",
                           "secureObject", "array"}
            if param["type"].lower() not in {t.lower() for t in valid_types}:
                result.warning(f"Parameter '{name}' has unusual type: {param['type']}")


def validate_resources(tpl, result):
    """Validate resource definitions."""
    resources = tpl.get("resources", [])
    seen_names = set()

    for i, res in enumerate(resources):
        if not isinstance(res, dict):
            result.error(f"Resource [{i}] must be an object")
            continue

        # Required resource fields
        for field in ("type", "apiVersion", "name"):
            if field not in res:
                result.error(f"Resource [{i}] missing required '{field}'")

        rtype = res.get("type", "")
        rname = res.get("name", f"<unnamed-{i}>")

        # Check known resource type
        base_type = rtype
        if base_type and base_type not in KNOWN_RESOURCE_TYPES:
            result.warning(f"Resource '{rname}': unknown type '{rtype}'")

        # Duplicate name detection
        name_key = f"{rtype}::{rname}"
        if name_key in seen_names:
            result.warning(f"Duplicate resource: {rtype} / {rname}")
        seen_names.add(name_key)

        # Validate apiVersion format
        api_ver = res.get("apiVersion", "")
        if api_ver and not re.match(r"^\d{4}-\d{2}-\d{2}(-preview)?$", api_ver):
            result.warning(f"Resource '{rname}': unusual apiVersion format '{api_ver}'")

        # Check location
        if "location" not in res and rtype not in (
            "Microsoft.Authorization/roleAssignments",
            "Microsoft.Cdn/profiles",
        ) and "/firewallRules" not in rtype and "/databases" not in rtype:
            # Many child resources don't need location
            if "/" not in rtype.split("Microsoft.")[-1].split("/", 1)[-1]:
                result.warning(f"Resource '{rname}': no 'location' specified")


def validate_references(tpl, result):
    """Check that parameter/variable references resolve."""
    params = set(tpl.get("parameters", {}).keys())
    variables = set(tpl.get("variables", {}).keys())

    def _check_refs(obj, path=""):
        if isinstance(obj, str):
            # Check parameters() references
            for m in re.findall(r"parameters\('([^']+)'\)", obj):
                if m not in params:
                    result.error(f"Reference to undefined parameter '{m}' at {path}")
            # Check variables() references
            for m in re.findall(r"variables\('([^']+)'\)", obj):
                if m not in variables:
                    result.error(f"Reference to undefined variable '{m}' at {path}")
        elif isinstance(obj, dict):
            for k, v in obj.items():
                _check_refs(v, f"{path}.{k}")
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                _check_refs(v, f"{path}[{i}]")

    _check_refs(tpl.get("resources", []), "resources")
    _check_refs(tpl.get("outputs", {}), "outputs")


def validate_security(tpl, result, strict=False):
    """Check security best practices."""
    resources = tpl.get("resources", [])

    for res in resources:
        rtype = res.get("type", "")
        rname = res.get("name", "")
        props = res.get("properties", {})

        # Check for hardcoded passwords in properties
        _check_hardcoded_secrets(props, rname, result)

        # Check NSG for overly permissive rules
        if "networkSecurityGroups" in rtype:
            rules = props.get("securityRules", [])
            for rule in rules:
                rprops = rule.get("properties", {})
                if rprops.get("access") == "Allow" and rprops.get("direction") == "Inbound":
                    dst_port = str(rprops.get("destinationPortRange", ""))
                    if dst_port == "*":
                        result.warning(
                            f"NSG '{rname}' rule '{rule.get('name', '')}': allows ALL inbound ports"
                        )
                    if dst_port in ("3306", "5432", "1433", "6379") and strict:
                        src = rprops.get("sourceAddressPrefix", "")
                        if src == "*":
                            result.warning(
                                f"NSG '{rname}': DB/Redis port {dst_port} open to 0.0.0.0/0"
                            )

        # Check DB firewall for 0.0.0.0 rules
        if "firewallRules" in rtype:
            start_ip = props.get("startIpAddress", "")
            end_ip = props.get("endIpAddress", "")
            if start_ip == "0.0.0.0" and end_ip == "255.255.255.255":
                result.warning(f"Firewall rule '{rname}': allows ALL IPs (0.0.0.0 - 255.255.255.255)")

        # Check Redis SSL
        if "Microsoft.Cache/redis" in rtype:
            if props.get("enableNonSslPort", False):
                result.warning(f"Redis '{rname}': non-SSL port enabled (insecure)")


def _check_hardcoded_secrets(obj, context, result):
    """Recursively check for hardcoded password-like values."""
    if isinstance(obj, str):
        # Skip ARM template expressions
        if obj.startswith("[") and obj.endswith("]"):
            return
        # Flag obvious hardcoded passwords
        if len(obj) >= 8 and any(c.isupper() for c in obj) and any(c.isdigit() for c in obj):
            if "password" in context.lower() or "secret" in context.lower():
                result.warning(f"Possible hardcoded password in '{context}'")
    elif isinstance(obj, dict):
        for k, v in obj.items():
            key_lower = k.lower()
            if any(s in key_lower for s in ("password", "secret", "key", "token")):
                if isinstance(v, str) and not (v.startswith("[") and v.endswith("]")):
                    if v and v not in ("", "true", "false"):
                        result.warning(f"Possible hardcoded secret: {context}.{k}")
            _check_hardcoded_secrets(v, f"{context}.{k}", result)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            _check_hardcoded_secrets(v, f"{context}[{i}]", result)


def validate_template(tpl, strict=False):
    """Run all validations."""
    result = ValidationResult()
    validate_structure(tpl, result)
    if result.errors:
        return result  # Can't continue if structure is broken

    validate_parameters(tpl, result)
    validate_resources(tpl, result)
    validate_references(tpl, result)
    validate_security(tpl, result, strict)
    return result


def main():
    parser = argparse.ArgumentParser(description="Validate ARM template")
    parser.add_argument("--input", required=True, help="Path to ARM template JSON")
    parser.add_argument("--strict", action="store_true", help="Enable strict security checks")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            tpl = json.load(f)
    except json.JSONDecodeError as e:
        print(f"INVALID JSON: {e}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print(f"File not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    result = validate_template(tpl, strict=args.strict)

    if args.format == "json":
        sys.stdout.reconfigure(encoding="utf-8")
        print(json.dumps({
            "valid": result.is_valid,
            "errors": result.errors,
            "warnings": result.warnings,
            "error_count": len(result.errors),
            "warning_count": len(result.warnings),
        }, indent=2))
    else:
        print(result.summary())

    sys.exit(0 if result.is_valid else 1)


if __name__ == "__main__":
    main()
