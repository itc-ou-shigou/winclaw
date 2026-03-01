#!/usr/bin/env python3
"""
Analyze user requirements and recommend an AWS architecture pattern.

Usage:
    python analyze_requirements.py --budget 200 --traffic-now 1000 --traffic-3m 5000 --traffic-1y 20000 \
        --db mysql --security standard --app-type web --region us-east-1

Output: JSON with recommended pattern, resources, and cost estimate (USD).
"""

import argparse
import json
import sys


PATTERNS = {
    "lite": {
        "name": "Lite (Single EC2)",
        "min_budget": 0,
        "max_traffic": 500,
        "services": ["VPC", "Subnet", "Internet Gateway", "Security Group",
                     "EC2 Instance", "Elastic IP"],
        "description": "Single EC2 instance for personal/dev projects",
    },
    "standard": {
        "name": "Standard (EC2 + RDS + ALB)",
        "min_budget": 40,
        "max_traffic": 5000,
        "services": ["VPC", "Subnets", "Internet Gateway", "Security Group",
                     "EC2 Instance", "ALB", "RDS"],
        "description": "EC2 behind ALB with managed RDS database",
    },
    "ha": {
        "name": "HA (ASG + Multi-AZ RDS)",
        "min_budget": 120,
        "max_traffic": 50000,
        "services": ["VPC", "Subnets (Multi-AZ)", "Internet Gateway",
                     "Security Group", "ALB", "Auto Scaling Group",
                     "Launch Template", "RDS (Multi-AZ)"],
        "description": "High availability with Auto Scaling Group and Multi-AZ RDS",
    },
    "elastic": {
        "name": "Elastic (ASG + ElastiCache + CloudFront)",
        "min_budget": 200,
        "max_traffic": 500000,
        "services": ["VPC", "Subnets", "Internet Gateway", "Security Group",
                     "ALB", "Auto Scaling Group", "RDS",
                     "ElastiCache Redis", "CloudFront Distribution"],
        "description": "Auto-scaling with Redis cache and CloudFront CDN for high traffic",
    },
    "serverless": {
        "name": "Serverless (Lambda + API Gateway)",
        "min_budget": 0,
        "max_traffic": 100000,
        "services": ["Lambda Function", "API Gateway", "IAM Role",
                     "S3 Bucket"],
        "description": "Pay-per-use, zero idle cost, auto-scales to zero",
    },
    "container": {
        "name": "Container (EKS Kubernetes)",
        "min_budget": 250,
        "max_traffic": 1000000,
        "services": ["VPC", "Subnets", "EKS Cluster", "EKS Node Group",
                     "ECR Repository"],
        "description": "Kubernetes orchestration for microservices",
    },
}

# AWS EC2 specs by budget tier (On-Demand USD/month, us-east-1)
EC2_SPECS = [
    {"budget_max": 10,  "spec": "t3.micro",   "cpu": 2, "mem": "1G",  "cost": 7.59},
    {"budget_max": 20,  "spec": "t3.small",   "cpu": 2, "mem": "2G",  "cost": 15.18},
    {"budget_max": 40,  "spec": "t3.medium",  "cpu": 2, "mem": "4G",  "cost": 30.37},
    {"budget_max": 75,  "spec": "t3.large",   "cpu": 2, "mem": "8G",  "cost": 60.74},
    {"budget_max": 140, "spec": "m6i.large",  "cpu": 2, "mem": "8G",  "cost": 69.12},
    {"budget_max": 280, "spec": "m6i.xlarge", "cpu": 4, "mem": "16G", "cost": 138.24},
    {"budget_max": 560, "spec": "m6i.2xlarge","cpu": 8, "mem": "32G", "cost": 276.48},
]

# AWS RDS specs (MySQL/PostgreSQL, Single-AZ, On-Demand)
RDS_SPECS = [
    {"budget_max": 20,  "spec": "db.t3.micro",   "cpu": 2, "mem": "1G",  "storage": 20,  "cost": 12.41},
    {"budget_max": 40,  "spec": "db.t3.small",   "cpu": 2, "mem": "2G",  "storage": 20,  "cost": 24.82},
    {"budget_max": 80,  "spec": "db.t3.medium",  "cpu": 2, "mem": "4G",  "storage": 50,  "cost": 49.64},
    {"budget_max": 160, "spec": "db.m6g.large",  "cpu": 2, "mem": "8G",  "storage": 100, "cost": 131.40},
    {"budget_max": 320, "spec": "db.m6g.xlarge", "cpu": 4, "mem": "16G", "storage": 200, "cost": 262.80},
    {"budget_max": 640, "spec": "db.m6g.2xlarge","cpu": 8, "mem": "32G", "storage": 500, "cost": 525.60},
]

# AWS ElastiCache Redis specs
REDIS_SPECS = [
    {"budget_max": 20,  "spec": "cache.t3.micro",  "mem": "0.5GB", "cost": 11.52},
    {"budget_max": 40,  "spec": "cache.t3.small",  "mem": "1.4GB", "cost": 23.04},
    {"budget_max": 70,  "spec": "cache.t3.medium", "mem": "3.1GB", "cost": 46.08},
    {"budget_max": 150, "spec": "cache.m6g.large", "mem": "6.4GB", "cost": 115.34},
    {"budget_max": 300, "spec": "cache.m6g.xlarge","mem": "13GB",  "cost": 230.69},
]

REGION_MAP = {
    "us-east-1":      {"name": "US East (N. Virginia)",   "multiplier": 1.0},
    "us-east-2":      {"name": "US East (Ohio)",          "multiplier": 1.0},
    "us-west-1":      {"name": "US West (N. California)", "multiplier": 1.10},
    "us-west-2":      {"name": "US West (Oregon)",        "multiplier": 1.0},
    "eu-west-1":      {"name": "Europe (Ireland)",        "multiplier": 1.10},
    "eu-west-2":      {"name": "Europe (London)",         "multiplier": 1.12},
    "eu-central-1":   {"name": "Europe (Frankfurt)",      "multiplier": 1.15},
    "ap-southeast-1": {"name": "Asia Pacific (Singapore)","multiplier": 1.10},
    "ap-southeast-2": {"name": "Asia Pacific (Sydney)",   "multiplier": 1.15},
    "ap-northeast-1": {"name": "Asia Pacific (Tokyo)",    "multiplier": 1.25},
    "ap-northeast-2": {"name": "Asia Pacific (Seoul)",    "multiplier": 1.20},
    "ap-south-1":     {"name": "Asia Pacific (Mumbai)",   "multiplier": 1.05},
    "sa-east-1":      {"name": "South America (Sao Paulo)","multiplier": 1.40},
    "ca-central-1":   {"name": "Canada (Central)",        "multiplier": 1.05},
}

SECURITY_EXTRAS = {
    "basic":      {"services": [], "cost": 0},
    "standard":   {"services": ["IAM Roles", "KMS (free tier)"], "cost": 0},
    "enterprise": {"services": ["AWS WAF", "AWS Shield Advanced", "GuardDuty",
                                "KMS CMK", "AWS Config"], "cost": 350},
}


def select_pattern(budget, traffic_1y, db, app_type):
    """Select best architecture pattern based on requirements."""
    peak_traffic = traffic_1y

    # Serverless preference for API/event-driven workloads with low budget
    if app_type in ("api", "event-driven") and budget < 200 and peak_traffic < 50000:
        return "serverless"

    # SPA+API with moderate traffic can also be serverless
    if app_type == "spa-api" and budget < 100 and peak_traffic < 10000:
        return "serverless"

    # Container for microservices
    if app_type == "microservice" and budget >= 250:
        return "container"

    # Container for large-scale API with high budget
    if app_type in ("api", "spa-api") and budget >= 400 and peak_traffic > 50000:
        return "container"

    # Traffic-based selection
    if peak_traffic > 50000 and budget >= 200:
        return "elastic"
    if peak_traffic > 5000 and budget >= 120:
        return "ha"
    if peak_traffic > 500 and budget >= 40:
        return "standard"
    if budget < 40:
        return "lite"

    # Budget-based fallback
    if budget >= 250:
        return "elastic"
    if budget >= 120:
        return "ha"
    if budget >= 40:
        return "standard"
    return "lite"


def select_ec2_spec(budget_for_ec2):
    """Select EC2 spec within budget."""
    selected = EC2_SPECS[0]
    for spec in EC2_SPECS:
        if spec["cost"] <= budget_for_ec2:
            selected = spec
    return selected


def select_rds_spec(budget_for_rds, db_engine):
    """Select RDS spec within budget."""
    if db_engine == "none":
        return None
    selected = RDS_SPECS[0]
    for spec in RDS_SPECS:
        if spec["cost"] <= budget_for_rds:
            selected = spec
    return selected


def select_redis_spec(budget_for_redis):
    """Select ElastiCache Redis spec within budget."""
    selected = REDIS_SPECS[0]
    for spec in REDIS_SPECS:
        if spec["cost"] <= budget_for_redis:
            selected = spec
    return selected


def build_cost_lite(args, multiplier, security):
    """Cost breakdown for lite pattern (single EC2)."""
    ec2_budget = args.budget * 0.75
    ec2 = select_ec2_spec(ec2_budget / multiplier)

    items = []
    total = 0

    ec2_cost = ec2["cost"] * multiplier
    items.append({"service": "EC2 Instance", "spec": ec2["spec"],
                  "detail": f"{ec2['cpu']}vCPU {ec2['mem']}", "monthly_cost": round(ec2_cost, 2)})
    total += ec2_cost

    # EBS Root Volume (30GB gp3)
    ebs_cost = 2.40 * multiplier
    items.append({"service": "EBS Volume", "spec": "gp3 (30GB)",
                  "detail": "Root volume", "monthly_cost": round(ebs_cost, 2)})
    total += ebs_cost

    # Elastic IP
    eip_cost = 3.65 * multiplier
    items.append({"service": "Elastic IP", "spec": "Static IPv4",
                  "detail": "Public IP", "monthly_cost": round(eip_cost, 2)})
    total += eip_cost

    return items, total


def build_cost_standard(args, multiplier, security):
    """Cost breakdown for standard pattern (EC2 + RDS + ALB)."""
    needs_db = args.db != "none"
    needs_redis = "redis" in args.db

    ec2_budget = args.budget * 0.35
    db_budget = args.budget * 0.30 if needs_db else 0
    ec2 = select_ec2_spec(ec2_budget / multiplier)
    db = select_rds_spec(db_budget / multiplier, args.db) if needs_db else None

    items = []
    total = 0

    ec2_cost = ec2["cost"] * multiplier
    items.append({"service": "EC2 Instance", "spec": ec2["spec"],
                  "detail": f"{ec2['cpu']}vCPU {ec2['mem']}", "monthly_cost": round(ec2_cost, 2)})
    total += ec2_cost

    # ALB
    alb_cost = 16.43 * multiplier  # ~$0.0225/hr + LCU
    items.append({"service": "ALB", "spec": "Application Load Balancer",
                  "detail": "L7 load balancer", "monthly_cost": round(alb_cost, 2)})
    total += alb_cost

    if db:
        base_engine = args.db.split("+")[0]
        db_cost = db["cost"] * multiplier
        items.append({"service": f"RDS {base_engine.upper()}", "spec": db["spec"],
                      "detail": f"{db['cpu']}vCPU {db['mem']} {db['storage']}GB",
                      "monthly_cost": round(db_cost, 2)})
        total += db_cost

    if needs_redis:
        redis = select_redis_spec(30 / multiplier)
        redis_cost = redis["cost"] * multiplier
        items.append({"service": "ElastiCache Redis", "spec": redis["spec"],
                      "detail": redis["mem"], "monthly_cost": round(redis_cost, 2)})
        total += redis_cost

    return items, total


def build_cost_ha(args, multiplier, security):
    """Cost breakdown for HA pattern (ASG + Multi-AZ RDS)."""
    needs_db = args.db != "none"

    ec2_budget = args.budget * 0.30
    db_budget = args.budget * 0.30 if needs_db else 0
    ec2 = select_ec2_spec(ec2_budget / multiplier / 2)  # 2 instances min
    db = select_rds_spec(db_budget / multiplier / 2, args.db) if needs_db else None  # Multi-AZ ~2x

    items = []
    total = 0

    # ASG with 2 instances min
    asg_cost = ec2["cost"] * 2 * multiplier
    items.append({"service": "ASG (2x EC2)", "spec": ec2["spec"],
                  "detail": f"{ec2['cpu']}vCPU {ec2['mem']} x 2 instances (min)",
                  "monthly_cost": round(asg_cost, 2)})
    total += asg_cost

    # ALB
    alb_cost = 16.43 * multiplier
    items.append({"service": "ALB", "spec": "Application Load Balancer",
                  "detail": "L7 load balancer + health checks", "monthly_cost": round(alb_cost, 2)})
    total += alb_cost

    if db:
        base_engine = args.db.split("+")[0]
        # Multi-AZ doubles the cost
        db_cost = db["cost"] * 2 * multiplier
        items.append({"service": f"RDS {base_engine.upper()} (Multi-AZ)", "spec": db["spec"],
                      "detail": f"Multi-AZ failover + {db['storage']}GB",
                      "monthly_cost": round(db_cost, 2)})
        total += db_cost

        # Read replica
        ro_cost = db["cost"] * multiplier
        items.append({"service": "RDS Read Replica", "spec": db["spec"],
                      "detail": "Read replica", "monthly_cost": round(ro_cost, 2)})
        total += ro_cost

    if "redis" in args.db:
        redis = select_redis_spec(40 / multiplier)
        redis_cost = redis["cost"] * multiplier
        items.append({"service": "ElastiCache Redis", "spec": redis["spec"],
                      "detail": redis["mem"], "monthly_cost": round(redis_cost, 2)})
        total += redis_cost

    return items, total


def build_cost_elastic(args, multiplier, security):
    """Cost breakdown for elastic pattern (ASG + ElastiCache + CloudFront)."""
    ec2_budget = args.budget * 0.20
    db_budget = args.budget * 0.20
    redis_budget = args.budget * 0.10
    ec2 = select_ec2_spec(ec2_budget / multiplier)
    db = select_rds_spec(db_budget / multiplier, args.db) if args.db != "none" else None
    redis = select_redis_spec(redis_budget / multiplier)

    items = []
    total = 0

    # ASG (~3 instances average)
    asg_cost = ec2["cost"] * 3 * multiplier
    items.append({"service": "ASG (auto-scale)", "spec": ec2["spec"],
                  "detail": f"{ec2['cpu']}vCPU {ec2['mem']} x ~3 avg (min:2,max:10)",
                  "monthly_cost": round(asg_cost, 2)})
    total += asg_cost

    # ALB
    alb_cost = 16.43 * multiplier
    items.append({"service": "ALB", "spec": "Application Load Balancer",
                  "detail": "L7 load balancer", "monthly_cost": round(alb_cost, 2)})
    total += alb_cost

    if db:
        base_engine = args.db.split("+")[0]
        db_cost = db["cost"] * multiplier
        items.append({"service": f"RDS {base_engine.upper()}", "spec": db["spec"],
                      "detail": f"{db['cpu']}vCPU {db['mem']} {db['storage']}GB",
                      "monthly_cost": round(db_cost, 2)})
        total += db_cost

    # ElastiCache Redis
    redis_cost = redis["cost"] * multiplier
    items.append({"service": "ElastiCache Redis", "spec": redis["spec"],
                  "detail": redis["mem"], "monthly_cost": round(redis_cost, 2)})
    total += redis_cost

    # CloudFront
    cf_cost = 20.0
    items.append({"service": "CloudFront", "spec": "Standard",
                  "detail": "~500GB/mo transfer", "monthly_cost": cf_cost})
    total += cf_cost

    return items, total


def build_cost_serverless(args, multiplier, security):
    """Cost breakdown for serverless pattern."""
    needs_db = args.db != "none"

    items = []
    total = 0

    # Lambda (pay per invocation)
    lambda_cost = 0.20 * multiplier  # mostly covered by free tier
    items.append({"service": "Lambda", "spec": "128-512MB",
                  "detail": "~1M invocations/mo (mostly free tier)",
                  "monthly_cost": round(lambda_cost, 2)})
    total += lambda_cost

    # API Gateway
    apigw_cost = 3.50 * multiplier  # ~1M API calls
    items.append({"service": "API Gateway", "spec": "REST API",
                  "detail": "~1M calls/mo", "monthly_cost": round(apigw_cost, 2)})
    total += apigw_cost

    # S3 (for static assets / Lambda deployment)
    s3_cost = 1.0 * multiplier
    items.append({"service": "S3", "spec": "Standard",
                  "detail": "Static assets + Lambda packages", "monthly_cost": round(s3_cost, 2)})
    total += s3_cost

    if needs_db:
        db_budget = args.budget * 0.40
        db = select_rds_spec(db_budget / multiplier, args.db)
        if db:
            base_engine = args.db.split("+")[0]
            db_cost = db["cost"] * multiplier
            items.append({"service": f"RDS {base_engine.upper()}", "spec": db["spec"],
                          "detail": f"{db['cpu']}vCPU {db['mem']} {db['storage']}GB",
                          "monthly_cost": round(db_cost, 2)})
            total += db_cost

    return items, total


def build_cost_container(args, multiplier, security):
    """Cost breakdown for container (EKS) pattern."""
    needs_db = args.db != "none"

    worker_budget = args.budget * 0.40
    db_budget = args.budget * 0.20 if needs_db else 0
    worker = select_ec2_spec(worker_budget / multiplier / 3)  # 3 nodes
    db = select_rds_spec(db_budget / multiplier, args.db) if needs_db else None

    items = []
    total = 0

    # EKS control plane
    eks_cost = 72.0 * multiplier  # $0.10/hr
    items.append({"service": "EKS Cluster", "spec": "Managed control plane",
                  "detail": "Kubernetes API server",
                  "monthly_cost": round(eks_cost, 2)})
    total += eks_cost

    # 3 Worker nodes
    worker_cost = worker["cost"] * 3 * multiplier
    items.append({"service": "Worker Nodes x3", "spec": worker["spec"],
                  "detail": f"{worker['cpu']}vCPU {worker['mem']} x 3",
                  "monthly_cost": round(worker_cost, 2)})
    total += worker_cost

    # ECR
    ecr_cost = 1.0 * multiplier
    items.append({"service": "ECR", "spec": "Private Registry",
                  "detail": "Container images", "monthly_cost": round(ecr_cost, 2)})
    total += ecr_cost

    if db:
        base_engine = args.db.split("+")[0]
        db_cost = db["cost"] * multiplier
        items.append({"service": f"RDS {base_engine.upper()}", "spec": db["spec"],
                      "detail": f"{db['cpu']}vCPU {db['mem']} {db['storage']}GB",
                      "monthly_cost": round(db_cost, 2)})
        total += db_cost

    # NLB for K8s Service
    nlb_cost = 16.43 * multiplier
    items.append({"service": "NLB", "spec": "Network Load Balancer",
                  "detail": "K8s Service LoadBalancer", "monthly_cost": round(nlb_cost, 2)})
    total += nlb_cost

    return items, total


def build_recommendation(args):
    """Build full recommendation."""
    pattern_key = select_pattern(args.budget, args.traffic_1y, args.db, args.app_type)
    pattern = PATTERNS[pattern_key]
    region = REGION_MAP.get(args.region, REGION_MAP["us-east-1"])
    security = SECURITY_EXTRAS.get(args.security, SECURITY_EXTRAS["standard"])
    multiplier = region["multiplier"]

    cost_builders = {
        "lite": build_cost_lite,
        "standard": build_cost_standard,
        "ha": build_cost_ha,
        "elastic": build_cost_elastic,
        "serverless": build_cost_serverless,
        "container": build_cost_container,
    }

    builder = cost_builders.get(pattern_key, build_cost_standard)
    cost_items, total_cost = builder(args, multiplier, security)

    # Security extras
    if security["cost"] > 0:
        sec_cost = security["cost"] * multiplier
        cost_items.append({
            "service": "Security (WAF+Shield)",
            "spec": "Enterprise tier",
            "detail": ", ".join(security["services"]),
            "monthly_cost": round(sec_cost, 2),
        })
        total_cost += sec_cost

    # Build service list
    base_db = args.db.split("+")[0]
    services = list(pattern["services"])
    if args.db != "none" and pattern_key not in ("lite",):
        db_svc = f"RDS {base_db.upper()}"
        if db_svc not in " ".join(services):
            services.append(db_svc)
    if "redis" in args.db or pattern_key == "elastic":
        if "ElastiCache Redis" not in services:
            services.append("ElastiCache Redis")

    return {
        "pattern": pattern_key,
        "pattern_name": pattern["name"],
        "description": pattern["description"],
        "region": {"id": args.region, **region},
        "security_tier": args.security,
        "security_services": security["services"],
        "services": services + security["services"],
        "cost_breakdown": cost_items,
        "total_monthly_cost": round(total_cost, 2),
        "budget": args.budget,
        "budget_surplus": round(args.budget - total_cost, 2),
        "requirements": {
            "budget": args.budget,
            "traffic_now": args.traffic_now,
            "traffic_3m": args.traffic_3m,
            "traffic_1y": args.traffic_1y,
            "db": args.db,
            "app_type": args.app_type,
            "security": args.security,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Analyze requirements and recommend AWS architecture")
    parser.add_argument("--budget", type=float, required=True, help="Monthly budget in USD")
    parser.add_argument("--traffic-now", type=int, default=100, help="Current daily traffic")
    parser.add_argument("--traffic-3m", type=int, default=500, help="Expected daily traffic in 3 months")
    parser.add_argument("--traffic-1y", type=int, default=2000, help="Expected daily traffic in 1 year")
    parser.add_argument("--db", choices=["none", "mysql", "postgresql", "redis",
                                          "mysql+redis", "postgresql+redis"], default="mysql")
    parser.add_argument("--security", choices=["basic", "standard", "enterprise"], default="standard")
    parser.add_argument("--app-type", choices=["web", "api", "spa-api", "microservice", "event-driven"],
                        default="web")
    parser.add_argument("--region", default="us-east-1")

    args = parser.parse_args()
    result = build_recommendation(args)
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
