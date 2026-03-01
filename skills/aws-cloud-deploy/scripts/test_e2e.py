#!/usr/bin/env python3
"""
End-to-end test for aws-cloud-deploy skill scripts.

Tests all 6 patterns:
  1. analyze_requirements → recommendation JSON
  2. estimate_cost → formatted table
  3. generate_cfn_template → CloudFormation YAML template
  4. validate_template → validation result
  5. generate_deploy_script → deploy script + dockerfile + k8s (for container)
"""

import json
import os
import subprocess
import sys
import tempfile

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))

# Test scenarios for each pattern
TEST_CASES = [
    {
        "name": "lite",
        "args": "--budget 30 --traffic-now 50 --traffic-3m 200 --traffic-1y 400 --db none --security basic --app-type web --region us-east-1",
        "expect_pattern": "lite",
        "min_resources": 4,
    },
    {
        "name": "standard",
        "args": "--budget 100 --traffic-now 500 --traffic-3m 2000 --traffic-1y 4000 --db mysql --security standard --app-type web --region us-east-1",
        "expect_pattern": "standard",
        "min_resources": 5,
    },
    {
        "name": "ha",
        "args": "--budget 200 --traffic-now 3000 --traffic-3m 10000 --traffic-1y 40000 --db postgresql+redis --security standard --app-type web --region eu-west-1",
        "expect_pattern": "ha",
        "min_resources": 5,
    },
    {
        "name": "elastic",
        "args": "--budget 500 --traffic-now 10000 --traffic-3m 50000 --traffic-1y 200000 --db mysql+redis --security standard --app-type web --region us-east-1",
        "expect_pattern": "elastic",
        "min_resources": 6,
    },
    {
        "name": "serverless",
        "args": "--budget 100 --traffic-now 500 --traffic-3m 5000 --traffic-1y 20000 --db mysql --security basic --app-type api --region ap-northeast-1",
        "expect_pattern": "serverless",
        "min_resources": 3,
    },
    {
        "name": "container",
        "args": "--budget 400 --traffic-now 5000 --traffic-3m 20000 --traffic-1y 100000 --db mysql --security standard --app-type microservice --region us-east-1",
        "expect_pattern": "container",
        "min_resources": 2,
    },
]


def run_cmd(cmd, stdin_data=None):
    """Run command and return stdout."""
    result = subprocess.run(
        cmd, shell=True, capture_output=True, text=True,
        input=stdin_data, encoding="utf-8"
    )
    if result.returncode != 0 and "Written to" not in result.stderr:
        print(f"  STDERR: {result.stderr[:500]}", file=sys.stderr)
    return result.stdout, result.returncode


def test_pattern(tc):
    """Test a single pattern end-to-end."""
    name = tc["name"]
    print(f"\n{'='*60}")
    print(f"Testing pattern: {name}")
    print(f"{'='*60}")

    errors = []
    num_res = 0

    # Step 1: analyze_requirements
    cmd = f'python3 "{SCRIPTS_DIR}/analyze_requirements.py" {tc["args"]}'
    stdout, rc = run_cmd(cmd)
    if rc != 0:
        errors.append(f"analyze_requirements failed (rc={rc})")
        return name, errors, {}

    try:
        rec = json.loads(stdout)
    except json.JSONDecodeError as e:
        errors.append(f"analyze_requirements output is not valid JSON: {e}")
        return name, errors, {}

    pattern = rec.get("pattern", "")
    if pattern != tc["expect_pattern"]:
        errors.append(f"Pattern mismatch: expected '{tc['expect_pattern']}', got '{pattern}'")

    total_cost = rec.get("total_monthly_cost", 0)
    cost_items = rec.get("cost_breakdown", [])
    print(f"  Pattern: {pattern} | Cost: ${total_cost:.2f} | Items: {len(cost_items)}")

    # Step 2: estimate_cost
    cost_stdout, rc2 = run_cmd(
        f'python3 "{SCRIPTS_DIR}/estimate_cost.py" --format markdown',
        stdin_data=stdout
    )
    if rc2 != 0:
        errors.append(f"estimate_cost failed (rc={rc2})")
    elif "Recommended" not in cost_stdout:
        errors.append("estimate_cost output missing 'Recommended' header")
    else:
        print(f"  Cost table: OK ({len(cost_stdout)} chars)")

    # Step 3: generate_cfn_template
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w", encoding="utf-8") as tf:
        tf.write(stdout)
        rec_path = tf.name

    tpl_path = os.path.join(tempfile.gettempdir(), f"aws_{name}.yaml")
    cmd = f'python3 "{SCRIPTS_DIR}/generate_cfn_template.py" --recommendation "{rec_path}" --output "{tpl_path}"'
    _, rc3 = run_cmd(cmd)
    if rc3 != 0:
        errors.append(f"generate_cfn_template failed (rc={rc3})")
    else:
        try:
            with open(tpl_path, "r", encoding="utf-8") as f:
                tpl_text = f.read()
            # Count resources by counting "Type: AWS::" lines
            num_res = tpl_text.count("Type: AWS::")
            print(f"  CFN template: {num_res} resources ({len(tpl_text)} chars)")
            if num_res < tc["min_resources"]:
                errors.append(f"Too few resources: {num_res} < {tc['min_resources']}")
        except FileNotFoundError as e:
            errors.append(f"CFN template not found: {e}")

    # Step 4: validate_template
    cmd = f'python3 "{SCRIPTS_DIR}/validate_template.py" --input "{tpl_path}" --format json'
    val_stdout, rc4 = run_cmd(cmd)
    val_errors = 0
    val_warnings = 0
    if val_stdout.strip():
        try:
            val = json.loads(val_stdout)
            val_errors = val.get("error_count", 0)
            val_warnings = val.get("warning_count", 0)
            if val_errors > 0:
                errors.append(f"Validation errors: {val_errors} - {val.get('errors', [])}")
            print(f"  Validation: errors={val_errors} warnings={val_warnings}")
        except json.JSONDecodeError:
            errors.append("validate_template output not valid JSON")
    else:
        if rc4 != 0:
            errors.append("validate_template failed with no output")

    # Step 5: generate_deploy_script
    project_json = json.dumps({
        "path": "/app",
        "type": "nodejs",
        "runtime": "node",
        "framework": "express",
        "install_cmd": "npm ci",
        "build_cmd": "npm run build",
        "start_cmd": "node index.js",
        "port": 3000,
        "entry_file": "index.js",
        "has_dockerfile": False,
        "has_db_migration": False,
        "migration_cmd": None,
        "env_vars": [],
        "static_dir": None,
        "dependencies": []
    })

    # Select deploy format based on pattern
    deploy_path = os.path.join(tempfile.gettempdir(), f"aws_deploy_{name}.sh")
    if name in ("lite", "standard"):
        fmt = "script"
    elif name in ("ha", "elastic"):
        fmt = "script"
    elif name == "serverless":
        fmt = "awscli"
    else:
        fmt = "script"

    cmd = f'python3 "{SCRIPTS_DIR}/generate_deploy_script.py" --format {fmt} --pattern {name} --output "{deploy_path}"'
    _, rc5 = run_cmd(cmd, stdin_data=project_json)
    deploy_size = 0
    if os.path.exists(deploy_path):
        deploy_size = os.path.getsize(deploy_path)
    if rc5 != 0:
        errors.append(f"generate_deploy_script ({fmt}) failed (rc={rc5})")
    elif deploy_size < 50:
        errors.append(f"Deploy script too small: {deploy_size} bytes")
    else:
        print(f"  Deploy script ({fmt}): {deploy_size}B")

    # Container pattern: also test dockerfile + k8s
    k8s_size = 0
    if name == "container":
        # Dockerfile
        df_path = os.path.join(tempfile.gettempdir(), f"aws_Dockerfile_{name}")
        cmd = f'python3 "{SCRIPTS_DIR}/generate_deploy_script.py" --format dockerfile --output "{df_path}"'
        _, rc6 = run_cmd(cmd, stdin_data=project_json)
        df_size = os.path.getsize(df_path) if os.path.exists(df_path) else 0
        if rc6 != 0 or df_size < 50:
            errors.append(f"Dockerfile generation failed (rc={rc6}, size={df_size})")
        else:
            deploy_size = df_size
            print(f"  Dockerfile: {df_size}B")

        # K8s manifest
        k8s_path = os.path.join(tempfile.gettempdir(), f"aws_k8s_{name}.yml")
        cmd = f'python3 "{SCRIPTS_DIR}/generate_deploy_script.py" --format k8s --output "{k8s_path}"'
        _, rc7 = run_cmd(cmd, stdin_data=project_json)
        k8s_size = os.path.getsize(k8s_path) if os.path.exists(k8s_path) else 0
        if rc7 != 0 or k8s_size < 50:
            errors.append(f"K8s manifest generation failed (rc={rc7}, size={k8s_size})")
        else:
            print(f"  K8s manifest: {k8s_size}B")

    # Clean up temp files
    for p in [rec_path, tpl_path]:
        try:
            os.unlink(p)
        except OSError:
            pass

    stats = {
        "cost": total_cost,
        "resources": num_res,
        "val_warnings": val_warnings,
        "deploy_size": deploy_size,
        "k8s_size": k8s_size,
    }

    return name, errors, stats


def main():
    print("=" * 60)
    print("AWS Cloud Deploy - End-to-End Test Suite")
    print("=" * 60)

    results = []
    all_pass = True

    for tc in TEST_CASES:
        name, errors, stats = test_pattern(tc)
        passed = len(errors) == 0
        results.append((name, passed, errors, stats))
        if not passed:
            all_pass = False
            for e in errors:
                print(f"  [FAIL] {e}")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"{'Pattern':<12} | {'Cost':>10} | {'Res':>3} | {'Warns':>5} | {'Deploy':>8} | {'Status'}")
    print("-" * 60)
    for name, passed, errors, stats in results:
        cost_str = f"${stats.get('cost', 0):,.2f}"
        res_str = str(stats.get('resources', 0))
        warn_str = str(stats.get('val_warnings', 0))
        deploy_str = f"{stats.get('deploy_size', 0)}B"
        if stats.get('k8s_size', 0) > 0:
            deploy_str += f" +k8s={stats['k8s_size']}B"
        status = "PASS" if passed else "FAIL"
        print(f"{name:<12} | {cost_str:>10} | {res_str:>3} | {warn_str:>5} | {deploy_str:>8} | {status}")

    print()
    if all_pass:
        print("ALL TESTS PASSED!")
    else:
        print("SOME TESTS FAILED!")
        sys.exit(1)


if __name__ == "__main__":
    main()
