#!/usr/bin/env python3
"""
Generate a formatted cost estimate table from recommendation JSON.

Usage:
    python estimate_cost.py --recommendation recommendation.json
    echo '{"pattern":"standard",...}' | python estimate_cost.py --format markdown
    echo '{"pattern":"standard",...}' | python estimate_cost.py --format text

Output: Formatted cost table for user presentation (USD).
"""

import argparse
import json
import sys


def format_markdown(rec):
    """Generate Markdown cost table."""
    lines = []
    pattern_name = rec.get("pattern_name", rec.get("pattern", "Unknown"))
    region = rec.get("region", {})
    security = rec.get("security_tier", "standard")
    total = rec.get("total_monthly_cost", 0)
    items = rec.get("cost_breakdown", [])

    lines.append(f"## Recommended: {pattern_name}")
    lines.append(f"")
    lines.append(f"- **Region**: {region.get('name', region.get('id', 'Unknown'))}")
    lines.append(f"- **Security**: {security}")
    lines.append(f"- **Description**: {rec.get('description', '')}")
    lines.append(f"")
    lines.append(f"| Service | Spec | Detail | Monthly (USD) |")
    lines.append(f"|---------|------|--------|---------------|")
    for item in items:
        cost_str = f"{item['monthly_cost']:,.2f}"
        lines.append(
            f"| {item['service']} | {item['spec']} | {item['detail']} | ${cost_str} |"
        )
    total_str = f"{total:,.2f}"
    lines.append(f"| **Total** | | | **~${total_str}** |")
    lines.append(f"")

    # Budget comparison
    budget = rec.get("requirements", {}).get("budget", rec.get("budget", 0))
    if budget > 0:
        diff = budget - total
        if diff >= 0:
            lines.append(f"> Budget: ${budget:,.2f}/mo | Estimated: ~${total:,.2f}/mo | Surplus: ${diff:,.2f}")
        else:
            lines.append(f"> **Warning**: Budget: ${budget:,.2f}/mo | Estimated: ~${total:,.2f}/mo | Over by: ${abs(diff):,.2f}")
            lines.append(f"> Consider: downgrade specs or switch to a lighter pattern.")

    return "\n".join(lines)


def format_text_box(rec):
    """Generate text-box style table for terminal display."""
    items = rec.get("cost_breakdown", [])
    total = rec.get("total_monthly_cost", 0)
    pattern_name = rec.get("pattern_name", rec.get("pattern", ""))

    # Calculate column widths
    svc_w = max(len(i["service"]) for i in items) if items else 10
    spec_w = max(len(i["spec"]) for i in items) if items else 10
    cost_w = max(len(f"${i['monthly_cost']:,.2f}") for i in items) if items else 8
    svc_w = max(svc_w, 7)   # "Service"
    spec_w = max(spec_w, 4)  # "Spec"
    cost_w = max(cost_w, len(f"~${total:,.2f}"), 8)

    total_w = svc_w + spec_w + cost_w + 10
    title = f"Recommended: {pattern_name}"

    lines = []
    lines.append("+" + "=" * (total_w) + "+")
    lines.append(f"| {title:^{total_w - 2}} |")
    lines.append("+" + "-" * svc_w + "--+" + "-" * spec_w + "--+" + "-" * cost_w + "--+")
    lines.append(
        f"| {'Service':<{svc_w}} | {'Spec':<{spec_w}} | {'USD/mo':>{cost_w}} |"
    )
    lines.append("+" + "-" * svc_w + "--+" + "-" * spec_w + "--+" + "-" * cost_w + "--+")
    for item in items:
        cost_str = f"${item['monthly_cost']:,.2f}"
        lines.append(
            f"| {item['service']:<{svc_w}} | {item['spec']:<{spec_w}} | {cost_str:>{cost_w}} |"
        )
    lines.append("+" + "-" * svc_w + "--+" + "-" * spec_w + "--+" + "-" * cost_w + "--+")
    total_str = f"~${total:,.2f}"
    lines.append(
        f"| {'Total':<{svc_w}} | {'':<{spec_w}} | {total_str:>{cost_w}} |"
    )
    lines.append("+" + "=" * (total_w) + "+")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Format Azure cost estimate")
    parser.add_argument("--recommendation", help="Path to recommendation JSON")
    parser.add_argument("--format", choices=["markdown", "text"], default="markdown")
    args = parser.parse_args()

    if args.recommendation:
        with open(args.recommendation, "r", encoding="utf-8") as f:
            rec = json.load(f)
    else:
        rec = json.load(sys.stdin)

    if args.format == "markdown":
        print(format_markdown(rec))
    else:
        print(format_text_box(rec))


if __name__ == "__main__":
    main()
