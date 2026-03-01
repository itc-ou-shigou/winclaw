#!/usr/bin/env python3
"""
Analyze user requirements and recommend an Azure architecture pattern.

Usage:
    python analyze_requirements.py --budget 200 --traffic-now 1000 --traffic-3m 5000 --traffic-1y 20000 \
        --db mysql --security standard --app-type web --region eastus

Output: JSON with recommended pattern, resources, and cost estimate (USD).
"""

import argparse
import json
import sys


PATTERNS = {
    "lite": {
        "name": "Lite (Single VM)",
        "min_budget": 0,
        "max_traffic": 500,
        "services": ["Resource Group", "VNet", "Subnet", "NSG", "VM", "Public IP"],
        "description": "Single Azure VM for personal/dev projects",
    },
    "standard": {
        "name": "Standard (App Service + Database)",
        "min_budget": 40,
        "max_traffic": 5000,
        "services": ["Resource Group", "App Service Plan", "App Service",
                     "Azure Database"],
        "description": "PaaS compute with managed database",
    },
    "ha": {
        "name": "HA (Multi-Instance App Service)",
        "min_budget": 120,
        "max_traffic": 50000,
        "services": ["Resource Group", "VNet", "App Service Plan (S1+)",
                     "App Service (2+ instances)", "Azure Database (HA)",
                     "Application Gateway"],
        "description": "High availability with zone-redundant database and Application Gateway",
    },
    "elastic": {
        "name": "Elastic (VMSS + Redis + CDN)",
        "min_budget": 200,
        "max_traffic": 500000,
        "services": ["Resource Group", "VNet", "NSG", "VMSS",
                     "Azure Database Flexible", "Azure Cache for Redis",
                     "Load Balancer", "CDN Profile"],
        "description": "Auto-scaling VM Scale Sets with Redis cache and CDN for high traffic",
    },
    "serverless": {
        "name": "Serverless (Functions + API Management)",
        "min_budget": 0,
        "max_traffic": 100000,
        "services": ["Resource Group", "Storage Account",
                     "Function App", "App Service Plan (Consumption)",
                     "API Management"],
        "description": "Pay-per-use, zero idle cost, auto-scales to zero",
    },
    "container": {
        "name": "Container (AKS Kubernetes)",
        "min_budget": 250,
        "max_traffic": 1000000,
        "services": ["Resource Group", "VNet", "NSG",
                     "AKS Cluster", "Azure Container Registry"],
        "description": "Kubernetes orchestration for microservices",
    },
}

# Azure VM specs by budget tier (Pay-As-You-Go USD/month, East US)
VM_SPECS = [
    {"budget_max": 15,  "spec": "Standard_B1s",  "cpu": 1, "mem": "1G",  "cost": 7.59},
    {"budget_max": 25,  "spec": "Standard_B1ms", "cpu": 1, "mem": "2G",  "cost": 15.18},
    {"budget_max": 40,  "spec": "Standard_B2s",  "cpu": 2, "mem": "4G",  "cost": 30.37},
    {"budget_max": 80,  "spec": "Standard_D2s_v5", "cpu": 2, "mem": "8G", "cost": 70.08},
    {"budget_max": 160, "spec": "Standard_D4s_v5", "cpu": 4, "mem": "16G", "cost": 140.16},
    {"budget_max": 320, "spec": "Standard_D8s_v5", "cpu": 8, "mem": "32G", "cost": 280.32},
]

# App Service Plan specs
APP_SERVICE_SPECS = [
    {"budget_max": 15,  "spec": "B1",  "cpu": 1, "mem": "1.75G", "cost": 13.14},
    {"budget_max": 35,  "spec": "B2",  "cpu": 2, "mem": "3.5G",  "cost": 26.28},
    {"budget_max": 75,  "spec": "S1",  "cpu": 1, "mem": "1.75G", "cost": 69.35},
    {"budget_max": 150, "spec": "P1v3", "cpu": 2, "mem": "8G",   "cost": 138.70},
    {"budget_max": 300, "spec": "P2v3", "cpu": 4, "mem": "16G",  "cost": 277.40},
]

# Azure Database for MySQL/PostgreSQL Flexible Server
DB_FLEX_SPECS = [
    {"budget_max": 20,  "spec": "Standard_B1ms",  "cpu": 1, "mem": "2G",  "storage": 20,  "cost": 12.41},
    {"budget_max": 50,  "spec": "Standard_B2s",   "cpu": 2, "mem": "4G",  "storage": 32,  "cost": 24.82},
    {"budget_max": 110, "spec": "Standard_D2ds_v4", "cpu": 2, "mem": "8G", "storage": 64,  "cost": 102.20},
    {"budget_max": 220, "spec": "Standard_D4ds_v4", "cpu": 4, "mem": "16G", "storage": 128, "cost": 204.40},
    {"budget_max": 450, "spec": "Standard_D8ds_v4", "cpu": 8, "mem": "32G", "storage": 256, "cost": 408.80},
]

# Azure Cache for Redis
REDIS_SPECS = [
    {"budget_max": 20,  "spec": "Basic C0",    "mem": "250MB", "cost": 16.37},
    {"budget_max": 45,  "spec": "Basic C1",    "mem": "1GB",   "cost": 40.15},
    {"budget_max": 85,  "spec": "Standard C1", "mem": "1GB",   "cost": 80.30},
    {"budget_max": 170, "spec": "Standard C2", "mem": "6GB",   "cost": 160.60},
]

REGION_MAP = {
    "eastus":        {"name": "East US",          "multiplier": 1.0},
    "eastus2":       {"name": "East US 2",        "multiplier": 1.0},
    "westus2":       {"name": "West US 2",        "multiplier": 1.0},
    "westus3":       {"name": "West US 3",        "multiplier": 1.0},
    "centralus":     {"name": "Central US",       "multiplier": 1.0},
    "westeurope":    {"name": "West Europe",      "multiplier": 1.15},
    "northeurope":   {"name": "North Europe",     "multiplier": 1.10},
    "uksouth":       {"name": "UK South",         "multiplier": 1.10},
    "southeastasia": {"name": "Southeast Asia",   "multiplier": 1.10},
    "japaneast":     {"name": "Japan East",       "multiplier": 1.25},
    "japanwest":     {"name": "Japan West",       "multiplier": 1.25},
    "australiaeast": {"name": "Australia East",   "multiplier": 1.20},
    "koreacentral":  {"name": "Korea Central",    "multiplier": 1.15},
}

SECURITY_EXTRAS = {
    "basic":      {"services": [], "cost": 0},
    "standard":   {"services": ["Managed Identity", "Key Vault (free tier)"], "cost": 0},
    "enterprise": {"services": ["Azure WAF", "Azure DDoS Protection", "Microsoft Defender for Cloud",
                                "Key Vault Premium"], "cost": 350},
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


def select_vm_spec(budget_for_vm):
    """Select VM spec within budget."""
    selected = VM_SPECS[0]
    for spec in VM_SPECS:
        if spec["cost"] <= budget_for_vm:
            selected = spec
    return selected


def select_app_service_spec(budget_for_app):
    """Select App Service Plan spec within budget."""
    selected = APP_SERVICE_SPECS[0]
    for spec in APP_SERVICE_SPECS:
        if spec["cost"] <= budget_for_app:
            selected = spec
    return selected


def select_db_spec(budget_for_db, db_engine):
    """Select Azure Database Flexible spec within budget."""
    if db_engine == "none":
        return None
    selected = DB_FLEX_SPECS[0]
    for spec in DB_FLEX_SPECS:
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
    """Cost breakdown for lite pattern (single VM)."""
    vm_budget = args.budget * 0.75
    vm = select_vm_spec(vm_budget / multiplier)

    items = []
    total = 0

    vm_cost = vm["cost"] * multiplier
    items.append({"service": "Virtual Machine", "spec": vm["spec"],
                  "detail": f"{vm['cpu']}vCPU {vm['mem']}", "monthly_cost": round(vm_cost, 2)})
    total += vm_cost

    # OS Disk (128GB Standard SSD)
    disk_cost = 9.60 * multiplier
    items.append({"service": "Managed Disk", "spec": "E10 (128GB SSD)",
                  "detail": "OS Disk", "monthly_cost": round(disk_cost, 2)})
    total += disk_cost

    # Public IP
    ip_cost = 3.65 * multiplier
    items.append({"service": "Public IP", "spec": "Standard Static",
                  "detail": "IPv4", "monthly_cost": round(ip_cost, 2)})
    total += ip_cost

    return items, total


def build_cost_standard(args, multiplier, security):
    """Cost breakdown for standard pattern (App Service + DB)."""
    needs_db = args.db != "none"
    needs_redis = "redis" in args.db

    app_budget = args.budget * 0.40
    db_budget = args.budget * 0.30 if needs_db else 0
    app = select_app_service_spec(app_budget / multiplier)
    db = select_db_spec(db_budget / multiplier, args.db) if needs_db else None

    items = []
    total = 0

    app_cost = app["cost"] * multiplier
    items.append({"service": "App Service Plan", "spec": app["spec"],
                  "detail": f"{app['cpu']}vCPU {app['mem']}", "monthly_cost": round(app_cost, 2)})
    total += app_cost

    if db:
        base_engine = args.db.split("+")[0]
        db_cost = db["cost"] * multiplier
        items.append({"service": f"Azure DB for {base_engine.upper()}", "spec": db["spec"],
                      "detail": f"{db['cpu']}vCPU {db['mem']} {db['storage']}GB",
                      "monthly_cost": round(db_cost, 2)})
        total += db_cost

    if needs_redis:
        redis = select_redis_spec(30 / multiplier)
        redis_cost = redis["cost"] * multiplier
        items.append({"service": "Azure Cache for Redis", "spec": redis["spec"],
                      "detail": redis["mem"], "monthly_cost": round(redis_cost, 2)})
        total += redis_cost

    return items, total


def build_cost_ha(args, multiplier, security):
    """Cost breakdown for HA pattern (multi-instance App Service)."""
    needs_db = args.db != "none"

    app_budget = args.budget * 0.30
    db_budget = args.budget * 0.30 if needs_db else 0
    app = select_app_service_spec(app_budget / multiplier)
    db = select_db_spec(db_budget / multiplier / 1.5, args.db) if needs_db else None

    items = []
    total = 0

    # App Service Plan with 2 instances (scale-out)
    app_cost = app["cost"] * 2 * multiplier
    items.append({"service": "App Service Plan (x2)", "spec": app["spec"],
                  "detail": f"{app['cpu']}vCPU {app['mem']} x 2 instances",
                  "monthly_cost": round(app_cost, 2)})
    total += app_cost

    if db:
        base_engine = args.db.split("+")[0]
        # HA mode (zone-redundant) ~1.5x
        db_cost = db["cost"] * 1.5 * multiplier
        items.append({"service": f"Azure DB {base_engine.upper()} (HA)", "spec": db["spec"],
                      "detail": f"Zone-redundant + {db['storage']}GB",
                      "monthly_cost": round(db_cost, 2)})
        total += db_cost

        # Read replica
        ro_cost = db["cost"] * multiplier
        items.append({"service": "Read Replica", "spec": db["spec"],
                      "detail": "Read replica", "monthly_cost": round(ro_cost, 2)})
        total += ro_cost

    # Application Gateway v2
    agw_cost = 18.25 * multiplier  # base + capacity units
    items.append({"service": "Application Gateway v2", "spec": "Standard_v2",
                  "detail": "L7 LB + WAF-ready", "monthly_cost": round(agw_cost, 2)})
    total += agw_cost

    return items, total


def build_cost_elastic(args, multiplier, security):
    """Cost breakdown for elastic pattern (VMSS + Redis + CDN)."""
    vm_budget = args.budget * 0.20
    db_budget = args.budget * 0.20
    redis_budget = args.budget * 0.10
    vm = select_vm_spec(vm_budget / multiplier)
    db = select_db_spec(db_budget / multiplier, args.db) if args.db != "none" else None
    redis = select_redis_spec(redis_budget / multiplier)

    items = []
    total = 0

    # VMSS (~3 instances average)
    vmss_cost = vm["cost"] * 3 * multiplier
    items.append({"service": "VMSS (auto-scale)", "spec": vm["spec"],
                  "detail": f"{vm['cpu']}vCPU {vm['mem']} x ~3 avg (min:2,max:10)",
                  "monthly_cost": round(vmss_cost, 2)})
    total += vmss_cost

    if db:
        base_engine = args.db.split("+")[0]
        db_cost = db["cost"] * multiplier
        items.append({"service": f"Azure DB Flexible {base_engine.upper()}", "spec": db["spec"],
                      "detail": f"{db['cpu']}vCPU {db['mem']} {db['storage']}GB",
                      "monthly_cost": round(db_cost, 2)})
        total += db_cost

    # Redis
    redis_cost = redis["cost"] * multiplier
    items.append({"service": "Azure Cache for Redis", "spec": redis["spec"],
                  "detail": redis["mem"], "monthly_cost": round(redis_cost, 2)})
    total += redis_cost

    # Load Balancer
    lb_cost = 18.25 * multiplier
    items.append({"service": "Load Balancer", "spec": "Standard",
                  "detail": "Public LB", "monthly_cost": round(lb_cost, 2)})
    total += lb_cost

    # CDN
    cdn_cost = 20.0
    items.append({"service": "Azure CDN", "spec": "Standard Microsoft",
                  "detail": "~500GB/mo", "monthly_cost": cdn_cost})
    total += cdn_cost

    return items, total


def build_cost_serverless(args, multiplier, security):
    """Cost breakdown for serverless pattern."""
    needs_db = args.db != "none"

    items = []
    total = 0

    # Function App (Consumption plan - pay per execution)
    # Estimate: ~1M executions/mo, 256MB, 200ms avg
    fc_cost = 0.20 * multiplier  # mostly covered by free grant (1M exec + 400K GB-s)
    items.append({"service": "Function App", "spec": "Consumption Plan",
                  "detail": "~1M executions/mo (mostly free tier)",
                  "monthly_cost": round(fc_cost, 2)})
    total += fc_cost

    # Storage Account (required for Functions)
    storage_cost = 2.0 * multiplier
    items.append({"service": "Storage Account", "spec": "Standard LRS",
                  "detail": "Function state + triggers", "monthly_cost": round(storage_cost, 2)})
    total += storage_cost

    # API Management (Developer tier)
    apim_cost = 47.45 * multiplier
    items.append({"service": "API Management", "spec": "Developer",
                  "detail": "API gateway", "monthly_cost": round(apim_cost, 2)})
    total += apim_cost

    if needs_db:
        db_budget = args.budget * 0.40
        db = select_db_spec(db_budget / multiplier, args.db)
        if db:
            base_engine = args.db.split("+")[0]
            db_cost = db["cost"] * multiplier
            items.append({"service": f"Azure DB for {base_engine.upper()}", "spec": db["spec"],
                          "detail": f"{db['cpu']}vCPU {db['mem']} {db['storage']}GB",
                          "monthly_cost": round(db_cost, 2)})
            total += db_cost

    return items, total


def build_cost_container(args, multiplier, security):
    """Cost breakdown for container (AKS) pattern."""
    needs_db = args.db != "none"

    worker_budget = args.budget * 0.40
    db_budget = args.budget * 0.20 if needs_db else 0
    worker = select_vm_spec(worker_budget / multiplier / 3)  # 3 nodes default
    db = select_db_spec(db_budget / multiplier, args.db) if needs_db else None

    items = []
    total = 0

    # AKS control plane (free for standard tier)
    items.append({"service": "AKS Cluster", "spec": "Free tier",
                  "detail": "Managed control plane (free)",
                  "monthly_cost": 0})

    # 3 Worker nodes
    worker_cost = worker["cost"] * 3 * multiplier
    items.append({"service": "Worker Nodes x3", "spec": worker["spec"],
                  "detail": f"{worker['cpu']}vCPU {worker['mem']} x 3",
                  "monthly_cost": round(worker_cost, 2)})
    total += worker_cost

    # Azure Container Registry (Basic tier)
    acr_cost = 5.0 * multiplier
    items.append({"service": "Container Registry", "spec": "Basic",
                  "detail": "10GB included", "monthly_cost": round(acr_cost, 2)})
    total += acr_cost

    if db:
        base_engine = args.db.split("+")[0]
        db_cost = db["cost"] * multiplier
        items.append({"service": f"Azure DB for {base_engine.upper()}", "spec": db["spec"],
                      "detail": f"{db['cpu']}vCPU {db['mem']} {db['storage']}GB",
                      "monthly_cost": round(db_cost, 2)})
        total += db_cost

    # Load Balancer for K8s Service
    lb_cost = 18.25 * multiplier
    items.append({"service": "Load Balancer", "spec": "Standard",
                  "detail": "K8s Service LoadBalancer", "monthly_cost": round(lb_cost, 2)})
    total += lb_cost

    return items, total


def build_recommendation(args):
    """Build full recommendation."""
    pattern_key = select_pattern(args.budget, args.traffic_1y, args.db, args.app_type)
    pattern = PATTERNS[pattern_key]
    region = REGION_MAP.get(args.region, REGION_MAP["eastus"])
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
            "service": "Security (WAF+DDoS)",
            "spec": "Enterprise tier",
            "detail": ", ".join(security["services"]),
            "monthly_cost": round(sec_cost, 2),
        })
        total_cost += sec_cost

    # Build service list
    base_db = args.db.split("+")[0]
    services = list(pattern["services"])
    if args.db != "none" and pattern_key not in ("lite",):
        db_svc = f"Azure DB for {base_db.upper()}"
        if db_svc not in " ".join(services):
            services.append(db_svc)
    if "redis" in args.db or pattern_key == "elastic":
        if "Azure Cache for Redis" not in services:
            services.append("Azure Cache for Redis")

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
    parser = argparse.ArgumentParser(description="Analyze requirements and recommend Azure architecture")
    parser.add_argument("--budget", type=float, required=True, help="Monthly budget in USD")
    parser.add_argument("--traffic-now", type=int, default=100, help="Current daily traffic")
    parser.add_argument("--traffic-3m", type=int, default=500, help="Expected daily traffic in 3 months")
    parser.add_argument("--traffic-1y", type=int, default=2000, help="Expected daily traffic in 1 year")
    parser.add_argument("--db", choices=["none", "mysql", "postgresql", "redis",
                                          "mysql+redis", "postgresql+redis"], default="mysql")
    parser.add_argument("--security", choices=["basic", "standard", "enterprise"], default="standard")
    parser.add_argument("--app-type", choices=["web", "api", "spa-api", "microservice", "event-driven"],
                        default="web")
    parser.add_argument("--region", default="eastus")

    args = parser.parse_args()
    result = build_recommendation(args)
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
