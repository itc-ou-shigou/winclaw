#!/usr/bin/env python3
"""
Validate a generated ROS YAML template for correctness.

Checks:
  - YAML syntax validity
  - Required top-level keys (ROSTemplateFormatVersion, Resources)
  - Parameter definitions (Type, Label)
  - Resource type names are valid ALIYUN::* types
  - Ref references exist in Parameters or Resources
  - Fn::GetAtt references exist in Resources
  - DependsOn references exist in Resources
  - Fn::Sub variable references
  - Output references
  - NoEcho on password fields
  - Security group port ranges

Usage:
    python validate_template.py --input stack.yml
    python validate_template.py --input stack.yml --strict
    cat stack.yml | python validate_template.py

Exit codes:
    0 = All checks passed (may have warnings)
    1 = Errors found
    2 = YAML parse failure
"""

import argparse
import json
import re
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")

try:
    import yaml
except ImportError:
    yaml = None


# ---------------------------------------------------------------------------
# Known valid ALIYUN resource types
# ---------------------------------------------------------------------------

KNOWN_RESOURCE_TYPES = {
    # VPC / Network
    "ALIYUN::ECS::VPC",
    "ALIYUN::ECS::VSwitch",
    "ALIYUN::ECS::SecurityGroup",
    "ALIYUN::ECS::SecurityGroupIngress",
    "ALIYUN::ECS::SecurityGroupEgress",
    "ALIYUN::VPC::NatGateway",
    "ALIYUN::VPC::EIP",
    "ALIYUN::VPC::EIPAssociation",
    "ALIYUN::ECS::SNatEntry",
    "ALIYUN::VPC::CommonBandwidthPackage",
    "ALIYUN::VPC::CommonBandwidthPackageIp",
    # Compute
    "ALIYUN::ECS::Instance",
    "ALIYUN::ECS::InstanceGroup",
    "ALIYUN::ECS::RunCommand",
    "ALIYUN::ECS::CustomImage",
    "ALIYUN::ECS::Disk",
    "ALIYUN::ECS::DiskAttachment",
    "ALIYUN::ECS::NetworkInterface",
    "ALIYUN::ECS::NetworkInterfaceAttachment",
    "ALIYUN::ECS::SSHKeyPair",
    "ALIYUN::ECS::AutoSnapshotPolicy",
    # Database
    "ALIYUN::RDS::DBInstance",
    "ALIYUN::RDS::Database",
    "ALIYUN::RDS::Account",
    "ALIYUN::RDS::AccountPrivilege",
    "ALIYUN::RDS::ReadOnlyDBInstance",
    "ALIYUN::POLARDB::DBCluster",
    "ALIYUN::POLARDB::Account",
    "ALIYUN::POLARDB::DBClusterAccessWhiteList",
    "ALIYUN::POLARDB::DBNodes",
    "ALIYUN::REDIS::Instance",
    "ALIYUN::REDIS::Whitelist",
    # Load Balancer
    "ALIYUN::SLB::LoadBalancer",
    "ALIYUN::SLB::Listener",
    "ALIYUN::SLB::BackendServerAttachment",
    "ALIYUN::SLB::VServerGroup",
    "ALIYUN::ALB::LoadBalancer",
    "ALIYUN::ALB::ServerGroup",
    "ALIYUN::ALB::Listener",
    # Auto Scaling
    "ALIYUN::ESS::ScalingGroup",
    "ALIYUN::ESS::ScalingConfiguration",
    "ALIYUN::ESS::ScalingGroupEnable",
    "ALIYUN::ESS::ScalingRule",
    "ALIYUN::ESS::AlarmTask",
    "ALIYUN::ESS::LifecycleHook",
    # Serverless
    "ALIYUN::FC::Service",
    "ALIYUN::FC::Function",
    "ALIYUN::FC::Trigger",
    "ALIYUN::FC::CustomDomain",
    "ALIYUN::FC::Version",
    "ALIYUN::FC::Alias",
    # API Gateway
    "ALIYUN::ApiGateway::Group",
    "ALIYUN::ApiGateway::App",
    "ALIYUN::ApiGateway::Api",
    "ALIYUN::ApiGateway::Authorization",
    "ALIYUN::ApiGateway::Deployment",
    "ALIYUN::ApiGateway::CustomDomain",
    # Container
    "ALIYUN::CS::ManagedKubernetesCluster",
    "ALIYUN::CS::KubernetesCluster",
    "ALIYUN::CS::ServerlessKubernetesCluster",
    "ALIYUN::CS::ClusterNodePool",
    "ALIYUN::CR::InstanceEndpointAclPolicy",
    "ALIYUN::CR::Namespace",
    "ALIYUN::CR::Repository",
    # Storage
    "ALIYUN::OSS::Bucket",
    "ALIYUN::NAS::FileSystem",
    "ALIYUN::NAS::MountTarget",
    "ALIYUN::NAS::AccessGroup",
    "ALIYUN::NAS::AccessRule",
    # CDN / WAF
    "ALIYUN::CDN::Domain",
    "ALIYUN::CDN::DomainConfig",
    "ALIYUN::WAF::Instance",
    "ALIYUN::WAF::Domain",
    # Security
    "ALIYUN::RAM::User",
    "ALIYUN::RAM::Role",
    "ALIYUN::RAM::ManagedPolicy",
    "ALIYUN::RAM::AttachPolicyToRole",
    "ALIYUN::CAS::Certificate",
    # Monitoring / Logging
    "ALIYUN::CMS::MonitorGroup",
    "ALIYUN::CMS::EventRule",
    "ALIYUN::SLS::Project",
    "ALIYUN::SLS::Logstore",
    "ALIYUN::SLS::Index",
    "ALIYUN::ACTIONTRAIL::Trail",
    # DNS / CEN
    "ALIYUN::DNS::Domain",
    "ALIYUN::DNS::DomainRecord",
    "ALIYUN::CEN::CenInstance",
    "ALIYUN::CEN::CenInstanceAttachment",
    "ALIYUN::CEN::CenBandwidthPackage",
    # DTS
    "ALIYUN::DTS::MigrationJob",
    "ALIYUN::DTS::SubscriptionJob",
    "ALIYUN::DTS::SynchronizationJob",
}


# ---------------------------------------------------------------------------
# Validation result
# ---------------------------------------------------------------------------

class ValidationResult:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def error(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    @property
    def ok(self):
        return len(self.errors) == 0

    def summary(self):
        return {
            "valid": self.ok,
            "errors": len(self.errors),
            "warnings": len(self.warnings),
            "error_details": self.errors,
            "warning_details": self.warnings,
        }


# ---------------------------------------------------------------------------
# YAML parsing (with fallback regex for no-yaml installs)
# ---------------------------------------------------------------------------

def parse_template(text):
    """Parse YAML template. Returns (dict, error_string)."""
    if yaml:
        try:
            doc = yaml.safe_load(text)
            if not isinstance(doc, dict):
                return None, "Template root is not a mapping"
            return doc, None
        except yaml.YAMLError as e:
            return None, f"YAML parse error: {e}"
    else:
        # Fallback: basic regex parsing for key structure
        # This is very limited but allows basic validation without PyYAML
        return None, "PyYAML not installed. Install with: pip install pyyaml"


# ---------------------------------------------------------------------------
# Validators
# ---------------------------------------------------------------------------

def validate_structure(doc, result):
    """Check required top-level keys."""
    if "ROSTemplateFormatVersion" not in doc:
        result.error("Missing required key: ROSTemplateFormatVersion")

    if "Resources" not in doc:
        result.error("Missing required key: Resources")
    elif not isinstance(doc.get("Resources"), dict):
        result.error("Resources must be a mapping")

    if "Parameters" in doc and not isinstance(doc["Parameters"], dict):
        result.error("Parameters must be a mapping")

    if "Outputs" in doc and not isinstance(doc["Outputs"], dict):
        result.error("Outputs must be a mapping")


def validate_parameters(doc, result, strict=False):
    """Validate parameter definitions."""
    params = doc.get("Parameters", {})
    if not isinstance(params, dict):
        return

    for name, pdef in params.items():
        if not isinstance(pdef, dict):
            result.error(f"Parameter '{name}' must be a mapping")
            continue

        if "Type" not in pdef:
            result.error(f"Parameter '{name}' missing required 'Type'")

        # Check password fields have NoEcho
        if any(kw in name.lower() for kw in ["password", "pass", "secret", "token"]):
            if not pdef.get("NoEcho"):
                result.warn(f"Parameter '{name}' looks like a secret but missing NoEcho: true")

        if strict and "Label" not in pdef:
            result.warn(f"Parameter '{name}' missing 'Label' (recommended for console UX)")


def validate_resources(doc, result):
    """Validate resource definitions."""
    resources = doc.get("Resources", {})
    if not isinstance(resources, dict):
        return

    params = set(doc.get("Parameters", {}).keys()) if isinstance(doc.get("Parameters"), dict) else set()
    resource_names = set(resources.keys())
    all_refs = params | resource_names | {"ALIYUN::StackName", "ALIYUN::StackId",
                                            "ALIYUN::Region", "ALIYUN::AccountId",
                                            "ALIYUN::NoValue"}

    for name, rdef in resources.items():
        if not isinstance(rdef, dict):
            result.error(f"Resource '{name}' must be a mapping")
            continue

        # Check Type
        rtype = rdef.get("Type", "")
        if not rtype:
            result.error(f"Resource '{name}' missing 'Type'")
        elif rtype not in KNOWN_RESOURCE_TYPES:
            # Might be a custom or newer type
            if rtype.startswith("ALIYUN::"):
                result.warn(f"Resource '{name}' uses unrecognized type: {rtype}")
            else:
                result.error(f"Resource '{name}' type '{rtype}' does not start with 'ALIYUN::'")

        # Check Properties
        if "Properties" not in rdef:
            result.warn(f"Resource '{name}' has no Properties (may be intentional)")

        # Check DependsOn
        depends = rdef.get("DependsOn")
        if depends:
            if isinstance(depends, str):
                depends = [depends]
            if isinstance(depends, list):
                for dep in depends:
                    if dep not in resource_names:
                        result.error(f"Resource '{name}' DependsOn '{dep}' not found in Resources")

        # Recursively check Ref and Fn::GetAtt
        _check_refs(rdef, name, all_refs, resource_names, result)


def _check_refs(obj, context, all_refs, resource_names, result):
    """Recursively check Ref and Fn::GetAtt references in a value."""
    if isinstance(obj, dict):
        # Check Ref
        if "Ref" in obj:
            ref_val = obj["Ref"]
            if isinstance(ref_val, str) and ref_val not in all_refs:
                result.error(f"In '{context}': Ref '{ref_val}' not found in Parameters or Resources")

        # Check Fn::GetAtt
        if "Fn::GetAtt" in obj:
            att = obj["Fn::GetAtt"]
            if isinstance(att, list) and len(att) >= 1:
                ref_resource = att[0]
                if isinstance(ref_resource, str) and ref_resource not in resource_names:
                    result.error(f"In '{context}': Fn::GetAtt references unknown resource '{ref_resource}'")

        # Check Fn::Sub for ${Reference} patterns
        if "Fn::Sub" in obj:
            sub_val = obj["Fn::Sub"]
            text = ""
            sub_vars = {}
            if isinstance(sub_val, str):
                text = sub_val
            elif isinstance(sub_val, list) and len(sub_val) >= 1:
                text = sub_val[0] if isinstance(sub_val[0], str) else ""
                if len(sub_val) >= 2 and isinstance(sub_val[1], dict):
                    sub_vars = sub_val[1]

            # Find ${Xxx} references (not ${ALIYUN::xxx})
            # Also handle ${{Xxx}} double-brace patterns from f-string generators
            refs_in_sub = re.findall(r'\$\{+([^}]+)\}+', text)
            for ref in refs_in_sub:
                # Strip leading brace if present (from ${{...}} pattern)
                clean_ref = ref.lstrip("{")
                if clean_ref.startswith("ALIYUN::"):
                    continue
                if clean_ref in sub_vars:
                    continue
                if clean_ref not in all_refs:
                    result.warn(f"In '{context}': Fn::Sub references '${{{clean_ref}}}' not found")

        # Recurse into all values
        for k, v in obj.items():
            if k not in ("Ref", "Fn::GetAtt"):
                _check_refs(v, context, all_refs, resource_names, result)

    elif isinstance(obj, list):
        for item in obj:
            _check_refs(item, context, all_refs, resource_names, result)


def validate_outputs(doc, result):
    """Validate output references."""
    outputs = doc.get("Outputs", {})
    if not isinstance(outputs, dict):
        return

    params = set(doc.get("Parameters", {}).keys()) if isinstance(doc.get("Parameters"), dict) else set()
    resources = set(doc.get("Resources", {}).keys()) if isinstance(doc.get("Resources"), dict) else set()
    all_refs = params | resources | {"ALIYUN::StackName", "ALIYUN::StackId",
                                      "ALIYUN::Region", "ALIYUN::AccountId"}

    for name, odef in outputs.items():
        if isinstance(odef, dict):
            _check_refs(odef, f"Output.{name}", all_refs, resources, result)


def validate_security(doc, result):
    """Check for common security issues."""
    resources = doc.get("Resources", {})
    if not isinstance(resources, dict):
        return

    for name, rdef in resources.items():
        if not isinstance(rdef, dict):
            continue
        props = rdef.get("Properties", {})
        if not isinstance(props, dict):
            continue

        rtype = rdef.get("Type", "")

        # Check for hardcoded passwords
        for key in ("Password", "AccountPassword", "LoginPassword", "MasterPassword"):
            val = props.get(key)
            if isinstance(val, str) and not val.startswith("$"):
                result.error(f"Resource '{name}' has hardcoded {key}! Use Ref to a NoEcho parameter instead.")

        # Check security group for overly open rules
        if rtype == "ALIYUN::ECS::SecurityGroup":
            ingress = props.get("SecurityGroupIngress", [])
            if isinstance(ingress, list):
                for rule in ingress:
                    if isinstance(rule, dict):
                        port_range = rule.get("PortRange", "")
                        source = rule.get("SourceCidrIp", "")
                        if port_range == "-1/-1" and source == "0.0.0.0/0":
                            result.warn(f"Resource '{name}': Security group allows ALL ports from ALL IPs")
                        elif port_range == "3306/3306" and source == "0.0.0.0/0":
                            result.error(f"Resource '{name}': DB port 3306 open to 0.0.0.0/0 is a security risk!")
                        elif port_range == "6379/6379" and source == "0.0.0.0/0":
                            result.error(f"Resource '{name}': Redis port 6379 open to 0.0.0.0/0 is a security risk!")

        # Check RDS security IP list
        if "RDS" in rtype or "POLARDB" in rtype:
            sec_ips = props.get("SecurityIPList", "")
            if sec_ips == "0.0.0.0/0":
                result.error(f"Resource '{name}': SecurityIPList allows ALL IPs - restrict to VPC CIDR")


def count_resources(doc):
    """Count resources by type."""
    resources = doc.get("Resources", {})
    if not isinstance(resources, dict):
        return {}
    counts = {}
    for name, rdef in resources.items():
        if isinstance(rdef, dict):
            rtype = rdef.get("Type", "unknown")
            counts[rtype] = counts.get(rtype, 0) + 1
    return counts


# ---------------------------------------------------------------------------
# Main validation
# ---------------------------------------------------------------------------

def validate_template(text, strict=False):
    """Run all validations on a template string."""
    result = ValidationResult()

    doc, error = parse_template(text)
    if error:
        result.error(error)
        return result, None

    validate_structure(doc, result)
    validate_parameters(doc, result, strict)
    validate_resources(doc, result)
    validate_outputs(doc, result)
    validate_security(doc, result)

    return result, doc


def main():
    parser = argparse.ArgumentParser(description="Validate a ROS YAML template")
    parser.add_argument("--input", "-i", help="Template file path (default: stdin)")
    parser.add_argument("--strict", action="store_true", help="Enable strict mode (more warnings)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--quiet", "-q", action="store_true", help="Only show errors")
    args = parser.parse_args()

    # Read template
    if args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = sys.stdin.read()

    result, doc = validate_template(text, strict=args.strict)

    if args.json:
        summary = result.summary()
        if doc:
            summary["resource_count"] = sum(count_resources(doc).values())
            summary["resources"] = count_resources(doc)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        # Pretty output
        if doc:
            counts = count_resources(doc)
            total = sum(counts.values())
            params = doc.get("Parameters", {})
            param_count = len(params) if isinstance(params, dict) else 0
            print(f"Template: {param_count} parameters, {total} resources")
            print()

        if result.errors:
            print(f"ERRORS ({len(result.errors)}):")
            for e in result.errors:
                print(f"  [ERROR] {e}")
            print()

        if result.warnings and not args.quiet:
            print(f"WARNINGS ({len(result.warnings)}):")
            for w in result.warnings:
                print(f"  [WARN] {w}")
            print()

        if result.ok:
            print("Result: VALID" + (f" ({len(result.warnings)} warnings)" if result.warnings else ""))
        else:
            print(f"Result: INVALID ({len(result.errors)} errors, {len(result.warnings)} warnings)")

    sys.exit(0 if result.ok else 1)


if __name__ == "__main__":
    main()
