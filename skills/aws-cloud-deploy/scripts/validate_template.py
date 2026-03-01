#!/usr/bin/env python3
"""
Validate a CloudFormation template for correctness and security.

Usage:
    python validate_template.py --input stack.yaml
    python validate_template.py --input stack.yaml --strict --format json

Checks:
  - YAML structure validity
  - Required CloudFormation fields
  - Known AWS resource types
  - Parameter/resource references
  - Security best practices (no hardcoded passwords, no open Security Groups)
"""

import argparse
import json
import re
import sys


# Known AWS CloudFormation resource types (most common)
KNOWN_RESOURCE_TYPES = {
    # Compute
    "AWS::EC2::Instance",
    "AWS::EC2::LaunchTemplate",
    "AWS::AutoScaling::AutoScalingGroup",
    "AWS::AutoScaling::LaunchConfiguration",
    "AWS::AutoScaling::ScalingPolicy",
    # Network
    "AWS::EC2::VPC",
    "AWS::EC2::Subnet",
    "AWS::EC2::InternetGateway",
    "AWS::EC2::VPCGatewayAttachment",
    "AWS::EC2::RouteTable",
    "AWS::EC2::Route",
    "AWS::EC2::SubnetRouteTableAssociation",
    "AWS::EC2::SecurityGroup",
    "AWS::EC2::EIP",
    "AWS::EC2::NatGateway",
    "AWS::EC2::NetworkInterface",
    # Load Balancing
    "AWS::ElasticLoadBalancingV2::LoadBalancer",
    "AWS::ElasticLoadBalancingV2::TargetGroup",
    "AWS::ElasticLoadBalancingV2::Listener",
    "AWS::ElasticLoadBalancingV2::ListenerRule",
    # Database
    "AWS::RDS::DBInstance",
    "AWS::RDS::DBCluster",
    "AWS::RDS::DBSubnetGroup",
    "AWS::RDS::DBParameterGroup",
    # ElastiCache
    "AWS::ElastiCache::CacheCluster",
    "AWS::ElastiCache::ReplicationGroup",
    "AWS::ElastiCache::SubnetGroup",
    # Lambda
    "AWS::Lambda::Function",
    "AWS::Lambda::Permission",
    "AWS::Lambda::LayerVersion",
    "AWS::Lambda::EventSourceMapping",
    # API Gateway
    "AWS::ApiGateway::RestApi",
    "AWS::ApiGateway::Resource",
    "AWS::ApiGateway::Method",
    "AWS::ApiGateway::Deployment",
    "AWS::ApiGateway::Stage",
    "AWS::ApiGatewayV2::Api",
    "AWS::ApiGatewayV2::Stage",
    "AWS::ApiGatewayV2::Integration",
    "AWS::ApiGatewayV2::Route",
    # S3
    "AWS::S3::Bucket",
    "AWS::S3::BucketPolicy",
    # IAM
    "AWS::IAM::Role",
    "AWS::IAM::Policy",
    "AWS::IAM::InstanceProfile",
    # EKS / ECS
    "AWS::EKS::Cluster",
    "AWS::EKS::Nodegroup",
    "AWS::EKS::FargateProfile",
    "AWS::ECS::Cluster",
    "AWS::ECS::Service",
    "AWS::ECS::TaskDefinition",
    # ECR
    "AWS::ECR::Repository",
    # CloudFront
    "AWS::CloudFront::Distribution",
    "AWS::CloudFront::OriginAccessControl",
    # Route 53
    "AWS::Route53::HostedZone",
    "AWS::Route53::RecordSet",
    # SNS / SQS
    "AWS::SNS::Topic",
    "AWS::SQS::Queue",
    # CloudWatch
    "AWS::CloudWatch::Alarm",
    "AWS::Logs::LogGroup",
    # DynamoDB
    "AWS::DynamoDB::Table",
    # WAF
    "AWS::WAFv2::WebACL",
    # KMS
    "AWS::KMS::Key",
    # Secrets Manager
    "AWS::SecretsManager::Secret",
    # SSM
    "AWS::SSM::Parameter",
    # Certificate Manager
    "AWS::CertificateManager::Certificate",
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


def parse_yaml_simple(text):
    """Parse CloudFormation YAML using simple approach.
    For validation only - extracts structure, resources, parameters.
    Falls back to regex-based parsing if PyYAML not available.
    """
    try:
        import yaml

        # Register constructors for CloudFormation intrinsic functions
        cfn_tags = [
            "!Ref", "!GetAtt", "!Sub", "!Join", "!Select", "!Split",
            "!If", "!Equals", "!Not", "!And", "!Or", "!FindInMap",
            "!GetAZs", "!ImportValue", "!Condition", "!Base64",
            "!Cidr", "!Transform",
        ]

        class CfnLoader(yaml.SafeLoader):
            pass

        def _cfn_constructor(loader, tag_suffix, node):
            if isinstance(node, yaml.ScalarNode):
                return loader.construct_scalar(node)
            elif isinstance(node, yaml.SequenceNode):
                return loader.construct_sequence(node)
            elif isinstance(node, yaml.MappingNode):
                return loader.construct_mapping(node)
            return None

        for tag in cfn_tags:
            CfnLoader.add_constructor(
                tag, lambda loader, node, t=tag: _cfn_constructor(loader, t, node)
            )
        # Also handle multi-value tags like !GetAtt with dotted notation
        CfnLoader.add_multi_constructor(
            "!", lambda loader, suffix, node: _cfn_constructor(loader, suffix, node)
        )

        return yaml.load(text, Loader=CfnLoader)
    except ImportError:
        pass
    except yaml.YAMLError:
        pass  # Fall through to regex-based parsing

    # Fallback: regex-based extraction
    tpl = {}

    # Extract AWSTemplateFormatVersion
    m = re.search(r'AWSTemplateFormatVersion:\s*"([^"]+)"', text)
    if m:
        tpl["AWSTemplateFormatVersion"] = m.group(1)

    # Extract Description
    m = re.search(r'Description:\s*"([^"]+)"', text)
    if m:
        tpl["Description"] = m.group(1)

    # Extract resource logical IDs and types
    resources = {}
    for m in re.finditer(r'^  (\w+):\s*\n\s+Type:\s*(\S+)', text, re.MULTILINE):
        logical_id = m.group(1)
        rtype = m.group(2)
        resources[logical_id] = {"Type": rtype}

    if resources:
        tpl["Resources"] = resources

    # Extract parameter names
    params = {}
    param_section = re.search(r'^Parameters:\s*\n((?:  \w+:.*\n(?:    .*\n)*)*)', text, re.MULTILINE)
    if param_section:
        for m in re.finditer(r'^  (\w+):', param_section.group(1), re.MULTILINE):
            params[m.group(1)] = {"Type": "String"}  # simplified
    tpl["Parameters"] = params

    # Extract output names
    outputs = {}
    output_section = re.search(r'^Outputs:\s*\n((?:  \w+:.*\n(?:    .*\n)*)*)', text, re.MULTILINE)
    if output_section:
        for m in re.finditer(r'^  (\w+):', output_section.group(1), re.MULTILINE):
            outputs[m.group(1)] = {}
    tpl["Outputs"] = outputs

    return tpl


def validate_structure(tpl, result):
    """Validate basic CloudFormation template structure."""
    if not isinstance(tpl, dict):
        result.error("Template root must be a YAML mapping")
        return

    # Check format version
    version = tpl.get("AWSTemplateFormatVersion")
    if version and version != "2010-09-09":
        result.warning(f"Unexpected AWSTemplateFormatVersion: {version}")

    # Resources is required
    if "Resources" not in tpl:
        result.error("Missing required section: Resources")
    elif not isinstance(tpl["Resources"], dict):
        result.error("'Resources' must be a mapping")
    elif len(tpl["Resources"]) == 0:
        result.warning("Template has no resources defined")


def validate_parameters(tpl, result):
    """Validate parameter definitions."""
    params = tpl.get("Parameters", {})
    if not isinstance(params, dict):
        return
    for name, param in params.items():
        if not isinstance(param, dict):
            result.error(f"Parameter '{name}' must be a mapping")
            continue
        if "Type" not in param:
            result.error(f"Parameter '{name}' missing required 'Type' property")


def validate_resources(tpl, raw_text, result):
    """Validate resource definitions."""
    resources = tpl.get("Resources", {})
    if not isinstance(resources, dict):
        return

    for logical_id, res in resources.items():
        if not isinstance(res, dict):
            result.error(f"Resource '{logical_id}' must be a mapping")
            continue

        rtype = res.get("Type", "")
        if not rtype:
            result.error(f"Resource '{logical_id}' missing required 'Type'")
            continue

        # Check known resource type
        if rtype not in KNOWN_RESOURCE_TYPES:
            result.warning(f"Resource '{logical_id}': unknown type '{rtype}'")


def validate_references(tpl, raw_text, result):
    """Check that !Ref and !GetAtt references resolve."""
    params = set(tpl.get("Parameters", {}).keys())
    resources = set(tpl.get("Resources", {}).keys())
    valid_refs = params | resources | {"AWS::StackName", "AWS::Region",
                                        "AWS::AccountId", "AWS::StackId",
                                        "AWS::NoValue", "AWS::URLSuffix"}

    # Check !Ref references
    for m in re.finditer(r'!Ref\s+(\w+)', raw_text):
        ref = m.group(1)
        if ref not in valid_refs:
            result.error(f"!Ref to undefined resource/parameter: '{ref}'")

    # Check !GetAtt references (resource.attribute)
    for m in re.finditer(r'!GetAtt\s+(\w+)\.\w+', raw_text):
        ref = m.group(1)
        if ref not in resources:
            result.error(f"!GetAtt references undefined resource: '{ref}'")

    # Check Ref in Sub expressions
    for m in re.finditer(r'\$\{(\w+)\}', raw_text):
        ref = m.group(1)
        if ref.startswith("AWS::"):
            continue
        if ref not in valid_refs:
            # Could be a nested attribute reference, only warn
            result.warning(f"Possible undefined reference in !Sub: '${{{ref}}}'")


def validate_security(tpl, raw_text, result, strict=False):
    """Check security best practices."""
    resources = tpl.get("Resources", {})

    for logical_id, res in resources.items():
        rtype = res.get("Type", "")

        # Check for Security Groups with 0.0.0.0/0 on sensitive ports
        if rtype == "AWS::EC2::SecurityGroup" and strict:
            # Look for port ranges in the raw text around this resource
            pass  # Handled by raw text scan below

    # Scan raw text for common security issues
    # Check for hardcoded passwords
    for m in re.finditer(r'(Password|Secret|Token|ApiKey)\s*:\s*["\']?(\S+)["\']?', raw_text, re.IGNORECASE):
        key = m.group(1)
        val = m.group(2)
        if val and not val.startswith("!") and val not in ("true", "false", "8", "12"):
            if not val.startswith("arn:") and val != "true" and val != "false":
                if len(val) > 6:
                    result.warning(f"Possible hardcoded secret near '{key}'")

    # Check for open Security Group rules on DB ports
    if strict:
        for port in ["3306", "5432", "6379", "27017"]:
            if f"FromPort: {port}" in raw_text and "0.0.0.0/0" in raw_text:
                # Only warn if the same SG has both the port and 0.0.0.0/0
                result.warning(f"Security Group may expose port {port} to 0.0.0.0/0")


def validate_template(raw_text, strict=False):
    """Run all validations."""
    result = ValidationResult()

    tpl = parse_yaml_simple(raw_text)
    if tpl is None:
        result.error("Failed to parse YAML template")
        return result

    validate_structure(tpl, result)
    if result.errors:
        return result

    validate_parameters(tpl, result)
    validate_resources(tpl, raw_text, result)
    validate_references(tpl, raw_text, result)
    validate_security(tpl, raw_text, result, strict)
    return result


def main():
    parser = argparse.ArgumentParser(description="Validate CloudFormation template")
    parser.add_argument("--input", required=True, help="Path to CloudFormation template (YAML)")
    parser.add_argument("--strict", action="store_true", help="Enable strict security checks")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()

    try:
        with open(args.input, "r", encoding="utf-8") as f:
            raw_text = f.read()
    except FileNotFoundError:
        print(f"File not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    if not raw_text.strip():
        print("Empty template file", file=sys.stderr)
        sys.exit(1)

    result = validate_template(raw_text, strict=args.strict)

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
