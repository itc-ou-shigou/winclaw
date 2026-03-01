#!/usr/bin/env python3
"""
Analyze user requirements and recommend an architecture pattern.

Usage:
    python analyze_requirements.py --budget 2000 --traffic-now 1000 --traffic-3m 5000 --traffic-1y 20000 \
        --db mysql --security standard --app-type web --region cn-hangzhou

Output: JSON with recommended pattern, resources, and cost estimate.
"""

import argparse
import json
import sys


PATTERNS = {
    "lite": {
        "name": "Lite (Single ECS)",
        "min_budget": 0,
        "max_traffic": 500,
        "services": ["VPC", "VSwitch", "SecurityGroup", "ECS"],
        "description": "Single ECS instance for personal/dev projects",
    },
    "standard": {
        "name": "Standard (ECS + RDS + SLB)",
        "min_budget": 400,
        "max_traffic": 5000,
        "services": ["VPC", "VSwitch", "SecurityGroup", "ECS", "RDS", "SLB"],
        "description": "Separated compute and database with load balancer",
    },
    "ha": {
        "name": "HA (Multi-AZ)",
        "min_budget": 1200,
        "max_traffic": 50000,
        "services": ["VPC", "VSwitch x2", "SecurityGroup", "ECS x2",
                     "RDS Primary-Standby", "RDS ReadOnly", "SLB"],
        "description": "High availability across multiple availability zones",
    },
    "elastic": {
        "name": "Elastic (ESS + PolarDB + Redis)",
        "min_budget": 1500,
        "max_traffic": 500000,
        "services": ["VPC", "VSwitch", "SecurityGroup", "ECS (seed)",
                     "ESS ScalingGroup", "PolarDB", "Redis", "SLB", "CDN"],
        "description": "Auto-scaling with PolarDB, Redis cache, and CDN for high traffic",
    },
    "serverless": {
        "name": "Serverless (FC + API Gateway)",
        "min_budget": 0,
        "max_traffic": 100000,
        "services": ["VPC", "VSwitch", "SecurityGroup",
                     "FC Service", "FC Function", "API Gateway"],
        "description": "Pay-per-use, zero idle cost, auto-scales to zero",
    },
    "container": {
        "name": "Container (ACK Kubernetes)",
        "min_budget": 2500,
        "max_traffic": 1000000,
        "services": ["VPC", "VSwitch", "SecurityGroup",
                     "ACK ManagedCluster", "NAT Gateway", "EIP"],
        "description": "Kubernetes orchestration for microservices",
    },
}

# ECS specs by budget tier
ECS_SPECS = [
    {"budget_max": 150, "spec": "ecs.t6-c1m1.large", "cpu": 2, "mem": "2G", "cost": 72},
    {"budget_max": 200, "spec": "ecs.t6-c1m2.large", "cpu": 2, "mem": "4G", "cost": 101},
    {"budget_max": 400, "spec": "ecs.c6.large", "cpu": 2, "mem": "4G", "cost": 230},
    {"budget_max": 800, "spec": "ecs.c6.xlarge", "cpu": 4, "mem": "8G", "cost": 461},
    {"budget_max": 1500, "spec": "ecs.c6.2xlarge", "cpu": 8, "mem": "16G", "cost": 922},
    {"budget_max": 3000, "spec": "ecs.g6.xlarge", "cpu": 4, "mem": "16G", "cost": 619},
]

# RDS specs by budget tier
RDS_SPECS = [
    {"budget_max": 150, "spec": "rds.mysql.t1.small", "cpu": 1, "mem": "1G", "storage": 20, "cost": 86},
    {"budget_max": 300, "spec": "rds.mysql.s1.small", "cpu": 1, "mem": "2G", "storage": 20, "cost": 166},
    {"budget_max": 600, "spec": "rds.mysql.s2.large", "cpu": 2, "mem": "4G", "storage": 50, "cost": 446},
    {"budget_max": 1200, "spec": "rds.mysql.s3.large", "cpu": 4, "mem": "8G", "storage": 100, "cost": 893},
    {"budget_max": 2000, "spec": "rds.mysql.m1.medium", "cpu": 4, "mem": "16G", "storage": 200, "cost": 1498},
]

# PolarDB specs (for elastic pattern)
POLARDB_SPECS = [
    {"budget_max": 500, "spec": "polar.mysql.x4.medium", "cpu": 2, "mem": "4G", "cost": 380},
    {"budget_max": 1000, "spec": "polar.mysql.x4.large", "cpu": 4, "mem": "16G", "cost": 760},
    {"budget_max": 2000, "spec": "polar.mysql.x8.xlarge", "cpu": 8, "mem": "32G", "cost": 1520},
]

# Redis specs
REDIS_SPECS = [
    {"budget_max": 60, "spec": "redis.master.micro.default", "mem": "256M", "cost": 36},
    {"budget_max": 200, "spec": "redis.master.small.default", "mem": "1G", "cost": 120},
    {"budget_max": 350, "spec": "redis.master.mid.default", "mem": "2G", "cost": 240},
    {"budget_max": 600, "spec": "redis.master.stand.default", "mem": "4G", "cost": 480},
]

REGION_MAP = {
    "cn-hangzhou": {"name": "China (Hangzhou)", "multiplier": 1.0},
    "cn-shanghai": {"name": "China (Shanghai)", "multiplier": 1.0},
    "cn-beijing": {"name": "China (Beijing)", "multiplier": 1.0},
    "cn-shenzhen": {"name": "China (Shenzhen)", "multiplier": 1.0},
    "cn-hongkong": {"name": "China (Hong Kong)", "multiplier": 1.4},
    "ap-southeast-1": {"name": "Singapore", "multiplier": 1.3},
    "us-west-1": {"name": "US (Silicon Valley)", "multiplier": 1.3},
    "eu-central-1": {"name": "Germany (Frankfurt)", "multiplier": 1.3},
    "ap-northeast-1": {"name": "Japan (Tokyo)", "multiplier": 1.4},
}

SECURITY_EXTRAS = {
    "basic": {"services": [], "cost": 0},
    "standard": {"services": ["CAS (Free SSL)", "RAM Roles", "ActionTrail"], "cost": 0},
    "enterprise": {"services": ["WAF", "KMS", "Security Center", "3-Tier Network"], "cost": 3000},
}


def select_pattern(budget, traffic_1y, db, app_type):
    """Select best architecture pattern based on requirements."""
    peak_traffic = traffic_1y

    # Serverless preference for API/event-driven workloads with low budget
    if app_type in ("api", "event-driven") and budget < 1500 and peak_traffic < 50000:
        return "serverless"

    # SPA+API with moderate traffic can also be serverless
    if app_type == "spa-api" and budget < 800 and peak_traffic < 10000:
        return "serverless"

    # Container for microservices
    if app_type == "microservice" and budget >= 2500:
        return "container"

    # Container for large-scale API with high budget
    if app_type in ("api", "spa-api") and budget >= 3000 and peak_traffic > 50000:
        return "container"

    # Traffic-based selection
    if peak_traffic > 50000 and budget >= 1500:
        return "elastic"
    if peak_traffic > 5000 and budget >= 1200:
        return "ha"
    if peak_traffic > 500 and budget >= 400:
        return "standard"
    if budget < 400:
        return "lite"

    # Budget-based fallback
    if budget >= 2500:
        return "elastic"
    if budget >= 1200:
        return "ha"
    if budget >= 400:
        return "standard"
    return "lite"


def select_ecs_spec(budget_for_ecs):
    """Select ECS spec within budget."""
    selected = ECS_SPECS[0]
    for spec in ECS_SPECS:
        if spec["cost"] <= budget_for_ecs:
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
    # Handle composite db values like "mysql+redis", "postgresql+redis"
    base_engine = db_engine.split("+")[0]
    if base_engine == "postgresql":
        selected = {**selected, "spec": selected["spec"].replace("mysql", "pg")}
    return selected


def select_polardb_spec(budget_for_db):
    """Select PolarDB spec within budget."""
    selected = POLARDB_SPECS[0]
    for spec in POLARDB_SPECS:
        if spec["cost"] <= budget_for_db:
            selected = spec
    return selected


def select_redis_spec(budget_for_redis):
    """Select Redis spec within budget."""
    selected = REDIS_SPECS[0]
    for spec in REDIS_SPECS:
        if spec["cost"] <= budget_for_redis:
            selected = spec
    return selected


def build_cost_lite(args, multiplier, security):
    """Cost breakdown for lite pattern."""
    ecs_budget = args.budget * 0.7
    ecs = select_ecs_spec(ecs_budget / multiplier)

    items = []
    total = 0

    ecs_cost = ecs["cost"] * multiplier
    items.append({"service": "ECS", "spec": ecs["spec"],
                  "detail": f"{ecs['cpu']}C{ecs['mem']}", "monthly_cost": round(ecs_cost)})
    total += ecs_cost

    bw_cost = 125 * multiplier
    items.append({"service": "Bandwidth", "spec": "5Mbps",
                  "detail": "PayByBandwidth", "monthly_cost": round(bw_cost)})
    total += bw_cost

    return items, total


def build_cost_standard(args, multiplier, security):
    """Cost breakdown for standard pattern."""
    needs_db = args.db != "none"
    needs_redis = "redis" in args.db

    ecs_budget = args.budget * 0.35
    rds_budget = args.budget * 0.30 if needs_db else 0
    ecs = select_ecs_spec(ecs_budget / multiplier)
    rds = select_rds_spec(rds_budget / multiplier, args.db) if needs_db else None

    items = []
    total = 0

    ecs_cost = ecs["cost"] * multiplier
    items.append({"service": "ECS", "spec": ecs["spec"],
                  "detail": f"{ecs['cpu']}C{ecs['mem']}", "monthly_cost": round(ecs_cost)})
    total += ecs_cost

    if rds:
        rds_cost = rds["cost"] * multiplier
        items.append({"service": f"RDS {args.db.split('+')[0].upper()}", "spec": rds["spec"],
                      "detail": f"{rds['cpu']}C{rds['mem']} {rds['storage']}GB",
                      "monthly_cost": round(rds_cost)})
        total += rds_cost

    if needs_redis:
        redis = select_redis_spec(100 / multiplier)
        redis_cost = redis["cost"] * multiplier
        items.append({"service": "Redis", "spec": redis["spec"],
                      "detail": redis["mem"], "monthly_cost": round(redis_cost)})
        total += redis_cost

    slb_cost = 43 * multiplier
    items.append({"service": "SLB", "spec": "slb.s2.small",
                  "detail": "internet", "monthly_cost": round(slb_cost)})
    total += slb_cost

    bw_cost = 125 * multiplier
    items.append({"service": "Bandwidth", "spec": "5Mbps",
                  "detail": "PayByBandwidth", "monthly_cost": round(bw_cost)})
    total += bw_cost

    return items, total


def build_cost_ha(args, multiplier, security):
    """Cost breakdown for HA pattern."""
    needs_db = args.db != "none"

    ecs_budget = args.budget * 0.30
    rds_budget = args.budget * 0.35 if needs_db else 0
    ecs = select_ecs_spec(ecs_budget / multiplier / 2)  # Budget per instance
    rds = select_rds_spec(rds_budget / multiplier / 1.8, args.db) if needs_db else None

    items = []
    total = 0

    # 2x ECS instances
    ecs_cost = ecs["cost"] * 2 * multiplier
    items.append({"service": "ECS x2", "spec": ecs["spec"],
                  "detail": f"{ecs['cpu']}C{ecs['mem']} x 2 instances",
                  "monthly_cost": round(ecs_cost)})
    total += ecs_cost

    if rds:
        # HA RDS (Primary-Standby) ~1.8x cost
        rds_cost = rds["cost"] * 1.8 * multiplier
        items.append({"service": f"RDS {args.db.upper()} (HA)", "spec": rds["spec"],
                      "detail": f"Primary-Standby + {rds['storage']}GB",
                      "monthly_cost": round(rds_cost)})
        total += rds_cost

        # Read-only replica
        ro_cost = rds["cost"] * multiplier
        items.append({"service": "RDS ReadOnly", "spec": rds["spec"],
                      "detail": "Read replica", "monthly_cost": round(ro_cost)})
        total += ro_cost

    slb_cost = 43 * multiplier
    items.append({"service": "SLB", "spec": "slb.s2.small",
                  "detail": "internet", "monthly_cost": round(slb_cost)})
    total += slb_cost

    bw_cost = 125 * multiplier
    items.append({"service": "Bandwidth", "spec": "5Mbps",
                  "detail": "PayByBandwidth", "monthly_cost": round(bw_cost)})
    total += bw_cost

    return items, total


def build_cost_elastic(args, multiplier, security):
    """Cost breakdown for elastic pattern (ESS + PolarDB + Redis)."""
    ecs_budget = args.budget * 0.15   # Seed instance (small)
    db_budget = args.budget * 0.25
    redis_budget = args.budget * 0.10
    ecs = select_ecs_spec(ecs_budget / multiplier)
    polardb = select_polardb_spec(db_budget / multiplier)
    redis = select_redis_spec(redis_budget / multiplier)

    items = []
    total = 0

    # Seed ECS (1 instance)
    ecs_cost = ecs["cost"] * multiplier
    items.append({"service": "ECS (seed)", "spec": ecs["spec"],
                  "detail": f"{ecs['cpu']}C{ecs['mem']} for image creation",
                  "monthly_cost": round(ecs_cost)})
    total += ecs_cost

    # ESS auto-scaling instances (estimate 2 average running)
    ess_cost = ecs["cost"] * 2 * multiplier
    items.append({"service": "ESS (auto-scale)", "spec": ecs["spec"],
                  "detail": "~2 instances avg (min:1, max:10)",
                  "monthly_cost": round(ess_cost)})
    total += ess_cost

    # PolarDB
    pdb_cost = polardb["cost"] * multiplier
    items.append({"service": "PolarDB MySQL", "spec": polardb["spec"],
                  "detail": f"{polardb['cpu']}C{polardb['mem']} + 1 read node",
                  "monthly_cost": round(pdb_cost)})
    total += pdb_cost

    # Redis
    redis_cost = redis["cost"] * multiplier
    items.append({"service": "Redis", "spec": redis["spec"],
                  "detail": redis["mem"], "monthly_cost": round(redis_cost)})
    total += redis_cost

    # SLB
    slb_cost = 43 * multiplier
    items.append({"service": "SLB", "spec": "slb.s2.small",
                  "detail": "internet", "monthly_cost": round(slb_cost)})
    total += slb_cost

    # CDN
    cdn_cost = 150
    items.append({"service": "CDN", "spec": "~500GB/mo",
                  "detail": "Mainland China", "monthly_cost": cdn_cost})
    total += cdn_cost

    # Bandwidth
    bw_cost = 125 * multiplier
    items.append({"service": "Bandwidth", "spec": "5Mbps",
                  "detail": "PayByBandwidth", "monthly_cost": round(bw_cost)})
    total += bw_cost

    return items, total


def build_cost_serverless(args, multiplier, security):
    """Cost breakdown for serverless pattern."""
    needs_db = args.db != "none"

    items = []
    total = 0

    # FC costs (usage-based estimate)
    # Assume ~1M invocations/mo, 256MB, 200ms avg
    fc_invocation_cost = 1.33  # 1M * 0.0133/10K
    fc_execution_cost = 5.5    # 1M * 256MB * 0.2s = ~50K GB-s -> after free tier ~50 CNY
    fc_cost = (fc_invocation_cost + fc_execution_cost) * multiplier
    # Free tier covers most light usage, so set minimum
    fc_cost = max(fc_cost, 0)
    items.append({"service": "FC (Function Compute)", "spec": "Pay-per-use",
                  "detail": "~1M invocations/mo estimate",
                  "monthly_cost": round(fc_cost)})
    total += fc_cost

    # API Gateway (free tier covers most)
    apigw_cost = 10 * multiplier
    items.append({"service": "API Gateway", "spec": "Shared",
                  "detail": "~100K calls/mo", "monthly_cost": round(apigw_cost)})
    total += apigw_cost

    if needs_db:
        rds_budget = args.budget * 0.5
        rds = select_rds_spec(rds_budget / multiplier, args.db)
        if rds:
            rds_cost = rds["cost"] * multiplier
            items.append({"service": f"RDS {args.db.split('+')[0].upper()}", "spec": rds["spec"],
                          "detail": f"{rds['cpu']}C{rds['mem']} {rds['storage']}GB",
                          "monthly_cost": round(rds_cost)})
            total += rds_cost

    return items, total


def build_cost_container(args, multiplier, security):
    """Cost breakdown for container (ACK) pattern."""
    needs_db = args.db != "none"

    # Worker node spec
    worker_budget = args.budget * 0.40
    worker_spec = select_ecs_spec(worker_budget / multiplier / 3)  # 3 nodes default
    rds_budget = args.budget * 0.20 if needs_db else 0
    rds = select_rds_spec(rds_budget / multiplier, args.db) if needs_db else None

    items = []
    total = 0

    # ACK cluster (managed control plane is free for pro.small)
    items.append({"service": "ACK Cluster", "spec": "ack.pro.small",
                  "detail": "Managed control plane (free)",
                  "monthly_cost": 0})

    # 3 Worker nodes
    worker_cost = worker_spec["cost"] * 3 * multiplier
    items.append({"service": "Worker Nodes x3", "spec": worker_spec["spec"],
                  "detail": f"{worker_spec['cpu']}C{worker_spec['mem']} x 3",
                  "monthly_cost": round(worker_cost)})
    total += worker_cost

    # NAT Gateway + EIP (required for outbound)
    nat_cost = 86 * multiplier  # Enhanced Small
    items.append({"service": "NAT Gateway + EIP", "spec": "Enhanced Small",
                  "detail": "Worker node outbound", "monthly_cost": round(nat_cost)})
    total += nat_cost

    if rds:
        rds_cost = rds["cost"] * multiplier
        items.append({"service": f"RDS {args.db.split('+')[0].upper()}", "spec": rds["spec"],
                      "detail": f"{rds['cpu']}C{rds['mem']} {rds['storage']}GB",
                      "monthly_cost": round(rds_cost)})
        total += rds_cost

    # SLB for service exposure
    slb_cost = 43 * multiplier
    items.append({"service": "SLB", "spec": "slb.s2.small",
                  "detail": "K8s Service LoadBalancer", "monthly_cost": round(slb_cost)})
    total += slb_cost

    # Bandwidth
    bw_cost = 125 * multiplier
    items.append({"service": "Bandwidth", "spec": "5Mbps",
                  "detail": "PayByBandwidth", "monthly_cost": round(bw_cost)})
    total += bw_cost

    return items, total


def build_recommendation(args):
    """Build full recommendation."""
    pattern_key = select_pattern(args.budget, args.traffic_1y, args.db, args.app_type)
    pattern = PATTERNS[pattern_key]
    region = REGION_MAP.get(args.region, REGION_MAP["cn-hangzhou"])
    security = SECURITY_EXTRAS.get(args.security, SECURITY_EXTRAS["standard"])
    multiplier = region["multiplier"]

    # Build cost by pattern
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
            "service": "Security (WAF etc.)",
            "spec": "Enterprise tier",
            "detail": ", ".join(security["services"]),
            "monthly_cost": round(sec_cost),
        })
        total_cost += sec_cost

    # Add DB services to pattern services list
    base_db = args.db.split("+")[0]  # "mysql+redis" -> "mysql"
    services = list(pattern["services"])
    if args.db != "none" and pattern_key not in ("lite",):
        if pattern_key == "elastic":
            if "PolarDB" not in services:
                services.append("PolarDB")
        elif f"RDS {base_db.upper()}" not in " ".join(services):
            services.append(f"RDS {base_db.upper()}")
    if "redis" in args.db or pattern_key in ("elastic",):
        if "Redis" not in services:
            services.append("Redis")

    # ROS template mapping
    template_map = {
        "lite": "compute-nest-best-practice/ecs-deploy/template.yml",
        "standard": "compute-nest-best-practice/ecs-rds/template.yml",
        "ha": "solutions/enterprise-on-cloud/e-commerce-business-and-db-on-the-cloud.yml",
        "elastic": "solutions/enterprise-on-cloud/internet-industry-high-elastic-system-construction.yml",
        "serverless": "compute-nest-best-practice/fc/",
        "container": "solutions/container-micro-service/spring-cloud-hostingack-service.yml",
    }

    return {
        "pattern": pattern_key,
        "pattern_name": pattern["name"],
        "description": pattern["description"],
        "region": {"id": args.region, **region},
        "security_tier": args.security,
        "security_services": security["services"],
        "services": services + security["services"],
        "cost_breakdown": cost_items,
        "total_monthly_cost": round(total_cost),
        "budget": args.budget,
        "budget_surplus": round(args.budget - total_cost),
        "ros_template_base": template_map.get(pattern_key, ""),
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
    parser = argparse.ArgumentParser(description="Analyze requirements and recommend architecture")
    parser.add_argument("--budget", type=float, required=True, help="Monthly budget in CNY")
    parser.add_argument("--traffic-now", type=int, default=100, help="Current daily traffic")
    parser.add_argument("--traffic-3m", type=int, default=500, help="Expected daily traffic in 3 months")
    parser.add_argument("--traffic-1y", type=int, default=2000, help="Expected daily traffic in 1 year")
    parser.add_argument("--db", choices=["none", "mysql", "postgresql", "redis",
                                          "mysql+redis", "postgresql+redis"], default="mysql")
    parser.add_argument("--security", choices=["basic", "standard", "enterprise"], default="standard")
    parser.add_argument("--app-type", choices=["web", "api", "spa-api", "microservice", "event-driven"],
                        default="web")
    parser.add_argument("--region", default="cn-hangzhou")

    args = parser.parse_args()
    result = build_recommendation(args)
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
