#!/usr/bin/env python3
"""
Generate deployment shell scripts for Phase 3B code deployment.

Takes project detection info + stack outputs and generates a complete
deployment bash script ready to execute on the target ECS instance.

Usage:
    python generate_deploy_script.py \
      --project project.json \
      --stack-outputs outputs.json \
      --pattern lite \
      --output deploy.sh

    # Or pipe project JSON from detect_project.py:
    python detect_project.py --path /workspace | \
      python generate_deploy_script.py \
        --stack-outputs outputs.json \
        --pattern standard \
        --output deploy.sh

Output modes:
    --format script   → Standalone bash script (default)
    --format runcommand → ALIYUN::ECS::RunCommand YAML fragment
    --format dockerfile → Dockerfile for container pattern

Reference: references/deployment-checklist.md
"""

import argparse
import json
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")

# ---------------------------------------------------------------------------
# Runtime installation snippets
# ---------------------------------------------------------------------------

RUNTIME_SETUP = {
    "nodejs": {
        "install": """
# --- Install Node.js 20 LTS ---
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs git
npm install -g pm2
echo "Node.js $(node --version) installed"
""",
        "process_manager": "pm2",
    },
    "python": {
        "install": """
# --- Install Python 3 + Gunicorn ---
yum install -y python3 python3-pip git
pip3 install --upgrade pip
pip3 install gunicorn uvicorn
echo "Python $(python3 --version) installed"
""",
        "process_manager": "gunicorn",
    },
    "java-maven": {
        "install": """
# --- Install Java 17 + Maven ---
yum install -y java-17-openjdk java-17-openjdk-devel maven git
echo "Java $(java --version 2>&1 | head -1) installed"
""",
        "process_manager": "systemd",
    },
    "java-gradle": {
        "install": """
# --- Install Java 17 ---
yum install -y java-17-openjdk java-17-openjdk-devel git
echo "Java $(java --version 2>&1 | head -1) installed"
""",
        "process_manager": "systemd",
    },
    "golang": {
        "install": """
# --- Install Go ---
yum install -y golang git
echo "Go $(go version) installed"
""",
        "process_manager": "systemd",
    },
    "php": {
        "install": """
# --- Install PHP + Composer ---
yum install -y php php-fpm php-mysqlnd php-json php-mbstring php-xml git
curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
echo "PHP $(php --version | head -1) installed"
""",
        "process_manager": "php-fpm",
    },
    "static": {
        "install": """
# --- Install Nginx ---
yum install -y nginx
systemctl enable nginx
echo "Nginx installed"
""",
        "process_manager": "nginx",
    },
}


# ---------------------------------------------------------------------------
# Upload code section
# ---------------------------------------------------------------------------

def gen_upload_section(project, repo_url=None):
    """Generate code upload commands."""
    lines = []
    lines.append("# ============================================")
    lines.append("# Step 2: Upload Application Code")
    lines.append("# ============================================")
    lines.append("APP_DIR=/app")
    lines.append("mkdir -p $APP_DIR")
    lines.append("")

    if repo_url:
        lines.append(f'echo ">>> Cloning from Git repository..."')
        lines.append(f"git clone {repo_url} $APP_DIR")
    else:
        lines.append('echo ">>> Code upload placeholder"')
        lines.append('echo "Upload code using one of:"')
        lines.append('echo "  Option A: git clone <REPO_URL> $APP_DIR"')
        lines.append('echo "  Option B: scp -r /workspace/* root@<ECS_IP>:/app/"')
        lines.append('echo "  Option C: aliyun oss cp oss://<bucket>/app.tar.gz /tmp/ && tar xzf /tmp/app.tar.gz -C $APP_DIR"')
        lines.append('echo ""')
        lines.append('echo "After uploading code, re-run this script with --skip-upload flag"')
        lines.append('echo "Or set CODE_UPLOADED=1 environment variable"')
        lines.append("")
        lines.append("if [ -z \"$CODE_UPLOADED\" ] && [ ! -f $APP_DIR/package.json ] && [ ! -f $APP_DIR/requirements.txt ] && [ ! -f $APP_DIR/pom.xml ] && [ ! -f $APP_DIR/go.mod ] && [ ! -f $APP_DIR/composer.json ] && [ ! -f $APP_DIR/index.html ]; then")
        lines.append('  echo "ERROR: No application code found in $APP_DIR"')
        lines.append('  echo "Please upload your code first, then re-run this script."')
        lines.append("  exit 1")
        lines.append("fi")

    lines.append("")
    lines.append("cd $APP_DIR")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Install dependencies
# ---------------------------------------------------------------------------

def gen_install_deps(project):
    """Generate dependency installation commands."""
    lines = []
    lines.append("# ============================================")
    lines.append("# Step 3: Install Dependencies")
    lines.append("# ============================================")

    install_cmd = project.get("install_cmd")
    if install_cmd:
        lines.append(f'echo ">>> Installing dependencies..."')
        lines.append(f"cd $APP_DIR && {install_cmd}")
    else:
        lines.append('echo ">>> No dependency installation required"')

    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Environment variables
# ---------------------------------------------------------------------------

def gen_env_file(project, stack_outputs, pattern):
    """Generate .env file creation commands."""
    lines = []
    lines.append("# ============================================")
    lines.append("# Step 4: Configure Environment Variables")
    lines.append("# ============================================")
    lines.append('echo ">>> Creating .env file..."')
    lines.append("")

    port = project.get("port", 3000)
    proj_type = project.get("type", "unknown")

    # Build env vars
    env_lines = []
    env_lines.append(f"PORT={port}")

    # Production mode
    if proj_type in ("nodejs",):
        env_lines.append("NODE_ENV=production")
    elif proj_type in ("python",):
        env_lines.append("FLASK_ENV=production")
        env_lines.append("PYTHONUNBUFFERED=1")

    # Database connection
    rds_endpoint = stack_outputs.get("RdsInternalEndpoint", "")
    rds_port = stack_outputs.get("RdsPort", "3306")
    rds_db_name = stack_outputs.get("RdsDatabaseName", "")
    rds_user = stack_outputs.get("RdsAccountName", "dbadmin")

    polardb_endpoint = stack_outputs.get("PolarDBEndpoint", "")
    redis_endpoint = stack_outputs.get("RedisEndpoint", "")

    if rds_endpoint or polardb_endpoint:
        db_host = polardb_endpoint or rds_endpoint
        db_port = "3306" if not polardb_endpoint else "3306"
        env_lines.append(f"DB_HOST={db_host}")
        env_lines.append(f"DB_PORT={db_port}")
        env_lines.append(f"DB_USER={rds_user}")
        env_lines.append(f"DB_NAME={rds_db_name}")
        env_lines.append("# DB_PASS=<SET_MANUALLY>  # NEVER auto-fill passwords")
        env_lines.append("")
        env_lines.append("# Connection string format:")
        db_type = "mysql" if "mysql" in rds_endpoint.lower() or polardb_endpoint else "postgresql"
        env_lines.append(f"# DATABASE_URL={db_type}://{rds_user}:<PASSWORD>@{db_host}:{db_port}/{rds_db_name}")

    if redis_endpoint:
        env_lines.append(f"REDIS_HOST={redis_endpoint}")
        env_lines.append("REDIS_PORT=6379")
        env_lines.append("# REDIS_PASS=<SET_MANUALLY>")

    # Any detected env vars from .env.example
    detected = project.get("env_vars", [])
    if detected:
        env_lines.append("")
        env_lines.append("# Detected from .env.example (fill in values):")
        for key in detected:
            if key not in ("PORT", "NODE_ENV", "DB_HOST", "DB_PORT", "DB_USER",
                          "DB_PASS", "DB_NAME", "DATABASE_URL", "REDIS_HOST",
                          "REDIS_PORT", "REDIS_PASS"):
                env_lines.append(f"# {key}=")

    lines.append("cat > $APP_DIR/.env << 'ENVEOF'")
    for el in env_lines:
        lines.append(el)
    lines.append("ENVEOF")
    lines.append("")
    lines.append('echo ">>> .env file created at $APP_DIR/.env"')
    lines.append('echo ">>> IMPORTANT: Edit .env to set DB_PASS and other secrets!"')
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Database migration
# ---------------------------------------------------------------------------

def gen_db_migration(project):
    """Generate database migration commands."""
    lines = []
    if project.get("has_db_migration") and project.get("migration_cmd"):
        lines.append("# ============================================")
        lines.append("# Step 5: Run Database Migrations")
        lines.append("# ============================================")
        lines.append('echo ">>> Running database migrations..."')
        lines.append('echo "NOTE: Make sure DB_PASS is set in .env before running migrations"')
        lines.append("")
        # Source .env so migration commands can pick up env vars
        lines.append("set -a && source $APP_DIR/.env && set +a")
        lines.append(f"cd $APP_DIR && {project['migration_cmd']}")
        lines.append('echo ">>> Migrations complete"')
        lines.append("")
    else:
        lines.append("# Step 5: Database Migrations - SKIPPED (none detected)")
        lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Build & Start application
# ---------------------------------------------------------------------------

def gen_build_and_start(project):
    """Generate build and application start commands."""
    lines = []
    lines.append("# ============================================")
    lines.append("# Step 6: Build & Start Application")
    lines.append("# ============================================")

    proj_type = project.get("type", "unknown")
    framework = project.get("framework", "")
    build_cmd = project.get("build_cmd")
    start_cmd = project.get("start_cmd")
    port = project.get("port", 3000)
    static_dir = project.get("static_dir")

    # Build step
    if build_cmd:
        lines.append(f'echo ">>> Building application..."')
        lines.append(f"cd $APP_DIR && {build_cmd}")
        lines.append("")

    # Static site: copy to nginx
    if static_dir and proj_type == "static":
        lines.append('echo ">>> Deploying static files to Nginx..."')
        lines.append(f"cp -r $APP_DIR/{static_dir}/* /usr/share/nginx/html/")
        lines.append("nginx -t && systemctl restart nginx")
        lines.append('echo ">>> Static site deployed to Nginx"')
        lines.append("")
        return "\n".join(lines)

    # SPA build output: copy to nginx
    if static_dir and proj_type != "static":
        lines.append('echo ">>> Deploying SPA build to Nginx..."')
        lines.append(f"cp -r $APP_DIR/{static_dir}/* /usr/share/nginx/html/")
        lines.append("")
        # If the framework also has a server (like Next.js), start it too
        if not start_cmd:
            lines.append("nginx -t && systemctl restart nginx")
            lines.append('echo ">>> SPA deployed to Nginx"')
            lines.append("")
            return "\n".join(lines)

    # Start application
    if start_cmd:
        lines.append(f'echo ">>> Starting application..."')
        lines.append("cd $APP_DIR")
        lines.append("set -a && source $APP_DIR/.env && set +a")
        lines.append("")

        if proj_type == "nodejs":
            # Use PM2 for Node.js
            lines.append("# Start with PM2 process manager")
            if "npm" in start_cmd:
                lines.append(f"pm2 start {start_cmd.replace('npm start', 'npm --name app -- start').replace('npm run ', 'npm --name app -- run ')}")
            else:
                lines.append(f"pm2 start '{start_cmd}' --name app")
            lines.append("pm2 save")
            lines.append("pm2 startup | tail -1 | bash")
            lines.append('echo ">>> Node.js app started with PM2"')
        elif proj_type == "python":
            if framework == "django":
                lines.append("# Start Django with Gunicorn")
                lines.append(f"cd $APP_DIR && nohup {start_cmd} > /var/log/app.log 2>&1 &")
            elif framework == "fastapi":
                lines.append("# Start FastAPI with Uvicorn")
                lines.append(f"cd $APP_DIR && nohup {start_cmd} > /var/log/app.log 2>&1 &")
            else:
                lines.append(f"cd $APP_DIR && nohup {start_cmd} > /var/log/app.log 2>&1 &")
            lines.append('echo ">>> Python app started"')
        elif proj_type in ("java-maven", "java-gradle"):
            lines.append("# Start Java with systemd")
            lines.append("cat > /etc/systemd/system/app.service << 'SVCEOF'")
            lines.append("[Unit]")
            lines.append("Description=Application Service")
            lines.append("After=network.target")
            lines.append("")
            lines.append("[Service]")
            lines.append("Type=simple")
            lines.append("WorkingDirectory=/app")
            lines.append(f"ExecStart=/usr/bin/{start_cmd}")
            lines.append("EnvironmentFile=/app/.env")
            lines.append("Restart=always")
            lines.append("RestartSec=10")
            lines.append("")
            lines.append("[Install]")
            lines.append("WantedBy=multi-user.target")
            lines.append("SVCEOF")
            lines.append("systemctl daemon-reload")
            lines.append("systemctl enable app && systemctl start app")
            lines.append('echo ">>> Java app started with systemd"')
        elif proj_type == "golang":
            lines.append("# Build and start Go binary with systemd")
            lines.append("cat > /etc/systemd/system/app.service << 'SVCEOF'")
            lines.append("[Unit]")
            lines.append("Description=Go Application")
            lines.append("After=network.target")
            lines.append("")
            lines.append("[Service]")
            lines.append("Type=simple")
            lines.append("WorkingDirectory=/app")
            lines.append(f"ExecStart=/app/{start_cmd.replace('./', '')}")
            lines.append("EnvironmentFile=/app/.env")
            lines.append("Restart=always")
            lines.append("")
            lines.append("[Install]")
            lines.append("WantedBy=multi-user.target")
            lines.append("SVCEOF")
            lines.append("systemctl daemon-reload")
            lines.append("systemctl enable app && systemctl start app")
            lines.append('echo ">>> Go app started with systemd"')
        elif proj_type == "php" and framework == "laravel":
            lines.append("# Start Laravel with php-fpm + nginx")
            lines.append("systemctl enable php-fpm && systemctl start php-fpm")
            lines.append('echo ">>> Laravel started with php-fpm"')
        else:
            lines.append(f"cd $APP_DIR && nohup {start_cmd} > /var/log/app.log 2>&1 &")
            lines.append('echo ">>> Application started"')

    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Nginx reverse proxy
# ---------------------------------------------------------------------------

def gen_nginx_proxy(project):
    """Generate Nginx reverse proxy configuration."""
    lines = []
    proj_type = project.get("type", "unknown")
    port = project.get("port", 3000)
    static_dir = project.get("static_dir")

    # Skip for pure static sites or if app listens on 80
    if proj_type == "static" or port == 80:
        return ""
    # Skip for SPA-only builds (no backend server)
    if static_dir and not project.get("start_cmd"):
        return ""

    lines.append("# ============================================")
    lines.append("# Step 7: Configure Nginx Reverse Proxy")
    lines.append("# ============================================")
    lines.append('echo ">>> Configuring Nginx reverse proxy..."')
    lines.append("yum install -y nginx")
    lines.append("")

    if proj_type == "php" and project.get("framework") == "laravel":
        # PHP-FPM config
        lines.append("cat > /etc/nginx/conf.d/app.conf << 'NGINXEOF'")
        lines.append("server {")
        lines.append("    listen 80;")
        lines.append("    server_name _;")
        lines.append("    root /app/public;")
        lines.append("    index index.php index.html;")
        lines.append("")
        lines.append("    location / {")
        lines.append("        try_files $uri $uri/ /index.php?$query_string;")
        lines.append("    }")
        lines.append("")
        lines.append("    location ~ \\.php$ {")
        lines.append("        fastcgi_pass 127.0.0.1:9000;")
        lines.append("        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;")
        lines.append("        include fastcgi_params;")
        lines.append("    }")
        lines.append("}")
        lines.append("NGINXEOF")
    else:
        # Standard reverse proxy
        lines.append("cat > /etc/nginx/conf.d/app.conf << 'NGINXEOF'")
        lines.append("server {")
        lines.append("    listen 80;")
        lines.append("    server_name _;")
        lines.append("")
        lines.append("    client_max_body_size 50m;")
        lines.append("")
        lines.append("    location / {")
        lines.append(f"        proxy_pass http://127.0.0.1:{port};")
        lines.append("        proxy_http_version 1.1;")
        lines.append("        proxy_set_header Upgrade $http_upgrade;")
        lines.append("        proxy_set_header Connection 'upgrade';")
        lines.append("        proxy_set_header Host $host;")
        lines.append("        proxy_set_header X-Real-IP $remote_addr;")
        lines.append("        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;")
        lines.append("        proxy_set_header X-Forwarded-Proto $scheme;")
        lines.append("        proxy_cache_bypass $http_upgrade;")
        lines.append("    }")
        lines.append("}")
        lines.append("NGINXEOF")

    lines.append("")
    lines.append("# Remove default config if exists")
    lines.append("rm -f /etc/nginx/conf.d/default.conf")
    lines.append("nginx -t && systemctl enable nginx && systemctl restart nginx")
    lines.append('echo ">>> Nginx configured: port 80 -> app port ' + str(port) + '"')
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def gen_health_check(project, stack_outputs):
    """Generate health check commands."""
    lines = []
    lines.append("# ============================================")
    lines.append("# Step 8: Health Check")
    lines.append("# ============================================")
    lines.append('echo ">>> Running health checks..."')
    lines.append("")
    lines.append("sleep 5  # Wait for services to start")
    lines.append("")

    port = project.get("port", 3000)
    lines.append("# Check app via localhost")
    lines.append(f'HTTP_CODE=$(curl -s -o /dev/null -w "%{{http_code}}" http://127.0.0.1:{port}/ 2>/dev/null || echo "000")')
    lines.append('if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then')
    lines.append(f'  echo "  [OK] Application responds on port {port} (HTTP $HTTP_CODE)"')
    lines.append("else")
    lines.append(f'  echo "  [WARN] Application on port {port} returned HTTP $HTTP_CODE"')
    lines.append("fi")
    lines.append("")

    # Check Nginx
    if project.get("type") != "static" and port != 80:
        lines.append("# Check Nginx proxy")
        lines.append('NGINX_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:80/ 2>/dev/null || echo "000")')
        lines.append('if [ "$NGINX_CODE" = "200" ] || [ "$NGINX_CODE" = "301" ] || [ "$NGINX_CODE" = "302" ]; then')
        lines.append('  echo "  [OK] Nginx proxy responds on port 80 (HTTP $NGINX_CODE)"')
        lines.append("else")
        lines.append('  echo "  [WARN] Nginx proxy on port 80 returned HTTP $NGINX_CODE"')
        lines.append("fi")
        lines.append("")

    # Check DB connection
    rds_endpoint = stack_outputs.get("RdsInternalEndpoint", "")
    if rds_endpoint:
        lines.append("# Check database connectivity")
        lines.append(f'DB_CHECK=$(timeout 5 bash -c "echo > /dev/tcp/{rds_endpoint}/3306" 2>&1 && echo "ok" || echo "fail")')
        lines.append('if [ "$DB_CHECK" = "ok" ]; then')
        lines.append(f'  echo "  [OK] RDS reachable at {rds_endpoint}:3306"')
        lines.append("else")
        lines.append(f'  echo "  [WARN] Cannot reach RDS at {rds_endpoint}:3306"')
        lines.append("fi")
        lines.append("")

    redis_endpoint = stack_outputs.get("RedisEndpoint", "")
    if redis_endpoint:
        lines.append("# Check Redis connectivity")
        lines.append(f'REDIS_CHECK=$(timeout 5 bash -c "echo > /dev/tcp/{redis_endpoint}/6379" 2>&1 && echo "ok" || echo "fail")')
        lines.append('if [ "$REDIS_CHECK" = "ok" ]; then')
        lines.append(f'  echo "  [OK] Redis reachable at {redis_endpoint}:6379"')
        lines.append("else")
        lines.append(f'  echo "  [WARN] Cannot reach Redis at {redis_endpoint}:6379"')
        lines.append("fi")
        lines.append("")

    lines.append("echo ''")
    lines.append('echo "============================================"')
    lines.append('echo "  Deployment Complete!"')
    lines.append('echo "============================================"')

    ecs_ip = stack_outputs.get("EcsPublicIp", "<ECS_IP>")
    slb_ip = stack_outputs.get("SlbPublicIp", "")
    access_ip = slb_ip or ecs_ip
    lines.append(f'echo "  Access URL: http://{access_ip}/"')
    lines.append('echo ""')

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Elastic pattern: golden image creation reminder
# ---------------------------------------------------------------------------

def gen_elastic_reminder():
    """Reminder for elastic pattern - create golden image after verification."""
    return """
# ============================================
# Step 9: Golden Image for Auto-Scaling (Elastic Pattern)
# ============================================
echo ""
echo ">>> IMPORTANT: This is the SEED instance for auto-scaling."
echo ">>> After verifying the application works correctly:"
echo ">>>   1. Create a Custom Image from this instance (via Console or CLI)"
echo ">>>      aliyun ecs CreateImage --InstanceId <INSTANCE_ID> --ImageName app-golden-image"
echo ">>>   2. Update ESS ScalingConfiguration to use the new Image ID"
echo ">>>      aliyun ess ModifyScalingConfiguration --ScalingConfigurationId <CONFIG_ID> --ImageId <IMAGE_ID>"
echo ">>>   3. The auto-scaling group will use this image for new instances"
echo ""
"""


# ---------------------------------------------------------------------------
# Main script assembler
# ---------------------------------------------------------------------------

def generate_script(project, stack_outputs, pattern, repo_url=None):
    """Assemble the complete deployment bash script."""
    proj_type = project.get("type", "unknown")

    # Get runtime setup
    runtime_info = RUNTIME_SETUP.get(proj_type, RUNTIME_SETUP["static"])
    ecs_ip = stack_outputs.get("EcsPublicIp", "<ECS_IP>")

    parts = []

    # Header
    parts.append("#!/bin/bash")
    parts.append("# ============================================")
    parts.append("# Auto-Generated Deployment Script")
    parts.append(f"# Pattern: {pattern}")
    parts.append(f"# Project: {proj_type} ({project.get('framework', 'generic')})")
    parts.append(f"# Target: {ecs_ip}")
    parts.append("# Generated by: aliyun-cloud-deploy skill")
    parts.append("# ============================================")
    parts.append('set -euo pipefail')
    parts.append('export LANG=en_US.UTF-8')
    parts.append("")

    # Step 1: Runtime
    parts.append("# ============================================")
    parts.append("# Step 1: Install Runtime Environment")
    parts.append("# ============================================")
    parts.append(runtime_info["install"].strip())
    parts.append("")

    # Step 2: Upload code
    parts.append(gen_upload_section(project, repo_url))
    parts.append("")

    # Step 3: Install dependencies
    parts.append(gen_install_deps(project))

    # Step 4: Environment variables
    parts.append(gen_env_file(project, stack_outputs, pattern))

    # Step 5: DB migrations
    parts.append(gen_db_migration(project))

    # Step 6: Build & Start
    parts.append(gen_build_and_start(project))

    # Step 7: Nginx reverse proxy
    nginx = gen_nginx_proxy(project)
    if nginx:
        parts.append(nginx)

    # Step 8: Health check
    parts.append(gen_health_check(project, stack_outputs))

    # Step 9: Elastic golden image reminder
    if pattern == "elastic":
        parts.append(gen_elastic_reminder())

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# RunCommand YAML fragment generator
# ---------------------------------------------------------------------------

def generate_runcommand_yaml(project, stack_outputs, pattern, repo_url=None):
    """Generate ALIYUN::ECS::RunCommand YAML fragment for embedding in ROS template."""
    script = generate_script(project, stack_outputs, pattern, repo_url)
    # Escape for YAML embedding
    indented = "\n".join("          " + line for line in script.split("\n"))

    yaml = f"""
  DeployCommand:
    Type: ALIYUN::ECS::RunCommand
    Properties:
      InstanceIds:
        - Ref: EcsInstance
      Type: RunShellScript
      Sync: true
      Timeout: 900
      CommandContent: |
{indented}
    DependsOn: EcsInstance
"""
    return yaml


# ---------------------------------------------------------------------------
# Dockerfile generator (container pattern)
# ---------------------------------------------------------------------------

def generate_dockerfile(project):
    """Generate Dockerfile for container pattern."""
    proj_type = project.get("type", "unknown")
    framework = project.get("framework", "")
    port = project.get("port", 3000)
    build_cmd = project.get("build_cmd", "")
    start_cmd = project.get("start_cmd", "")
    install_cmd = project.get("install_cmd", "")

    lines = []
    lines.append(f"# Auto-generated Dockerfile for {proj_type} ({framework})")
    lines.append("")

    if proj_type == "nodejs":
        lines.append("FROM node:20-alpine AS builder")
        lines.append("WORKDIR /app")
        lines.append("COPY package*.json ./")
        lines.append("RUN npm ci")
        lines.append("COPY . .")
        if build_cmd:
            lines.append(f"RUN {build_cmd}")
        lines.append("")
        lines.append("FROM node:20-alpine")
        lines.append("WORKDIR /app")
        if framework in ("nextjs", "nuxt"):
            lines.append("COPY --from=builder /app/.next ./.next")
            lines.append("COPY --from=builder /app/node_modules ./node_modules")
            lines.append("COPY --from=builder /app/package.json ./package.json")
            lines.append("COPY --from=builder /app/public ./public")
        else:
            lines.append("COPY --from=builder /app .")
        lines.append(f"EXPOSE {port}")
        sc = start_cmd or "npm start"
        cmd_parts = sc.split()
        lines.append(f'CMD [{", ".join(repr(p) for p in cmd_parts)}]')

    elif proj_type == "python":
        lines.append("FROM python:3.12-slim")
        lines.append("WORKDIR /app")
        lines.append("COPY requirements.txt .")
        lines.append("RUN pip install --no-cache-dir -r requirements.txt")
        lines.append("COPY . .")
        lines.append(f"EXPOSE {port}")
        sc = start_cmd or "python app.py"
        cmd_parts = sc.split()
        lines.append(f'CMD [{", ".join(repr(p) for p in cmd_parts)}]')

    elif proj_type in ("java-maven", "java-gradle"):
        if proj_type == "java-maven":
            lines.append("FROM maven:3.9-eclipse-temurin-17 AS builder")
            lines.append("WORKDIR /app")
            lines.append("COPY pom.xml .")
            lines.append("RUN mvn dependency:resolve")
            lines.append("COPY src ./src")
            lines.append("RUN mvn clean package -DskipTests")
            lines.append("")
            lines.append("FROM eclipse-temurin:17-jre-alpine")
            lines.append("WORKDIR /app")
            lines.append("COPY --from=builder /app/target/*.jar app.jar")
        else:
            lines.append("FROM gradle:8-jdk17 AS builder")
            lines.append("WORKDIR /app")
            lines.append("COPY build.gradle* settings.gradle* ./")
            lines.append("COPY src ./src")
            lines.append("RUN gradle build -x test")
            lines.append("")
            lines.append("FROM eclipse-temurin:17-jre-alpine")
            lines.append("WORKDIR /app")
            lines.append("COPY --from=builder /app/build/libs/*.jar app.jar")
        lines.append(f"EXPOSE {port}")
        lines.append('ENTRYPOINT ["java", "-jar", "app.jar"]')

    elif proj_type == "golang":
        lines.append("FROM golang:1.22-alpine AS builder")
        lines.append("WORKDIR /app")
        lines.append("COPY go.* ./")
        lines.append("RUN go mod download")
        lines.append("COPY . .")
        lines.append("RUN CGO_ENABLED=0 GOOS=linux go build -o app .")
        lines.append("")
        lines.append("FROM alpine:3.19")
        lines.append("WORKDIR /app")
        lines.append("COPY --from=builder /app/app .")
        lines.append(f"EXPOSE {port}")
        lines.append('ENTRYPOINT ["./app"]')

    elif proj_type == "php":
        lines.append("FROM php:8.2-fpm-alpine")
        lines.append("WORKDIR /app")
        lines.append("RUN docker-php-ext-install pdo_mysql")
        lines.append("COPY --from=composer:latest /usr/bin/composer /usr/bin/composer")
        lines.append("COPY . .")
        lines.append("RUN composer install --no-dev --optimize-autoloader")
        lines.append(f"EXPOSE {port}")

    elif proj_type == "static":
        lines.append("FROM nginx:alpine")
        static_dir = project.get("static_dir", ".")
        lines.append(f"COPY {static_dir} /usr/share/nginx/html")
        lines.append("EXPOSE 80")

    else:
        lines.append("# Unknown project type - customize this Dockerfile")
        lines.append("FROM ubuntu:22.04")
        lines.append("WORKDIR /app")
        lines.append("COPY . .")
        lines.append(f"EXPOSE {port}")

    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Kubernetes deployment YAML (container pattern)
# ---------------------------------------------------------------------------

def generate_k8s_manifest(project, stack_outputs):
    """Generate Kubernetes deployment + service YAML for ACK."""
    proj_type = project.get("type", "unknown")
    framework = project.get("framework", "")
    port = project.get("port", 3000)

    app_name = "app"
    image = "<REGISTRY>/<NAMESPACE>/<IMAGE>:<TAG>"

    env_vars_yaml = ""
    rds_endpoint = stack_outputs.get("RdsInternalEndpoint", "")
    if rds_endpoint:
        env_vars_yaml = f"""
        env:
          - name: DB_HOST
            value: "{rds_endpoint}"
          - name: DB_PORT
            value: "3306"
          - name: DB_USER
            value: "dbadmin"
          - name: DB_PASS
            valueFrom:
              secretKeyRef:
                name: db-credentials
                key: password
          - name: PORT
            value: "{port}"
          - name: NODE_ENV
            value: "production"
"""
    else:
        env_vars_yaml = f"""
        env:
          - name: PORT
            value: "{port}"
          - name: NODE_ENV
            value: "production"
"""

    manifest = f"""---
# Auto-generated Kubernetes Manifest
# Project: {proj_type} ({framework})
# Generated by: aliyun-cloud-deploy skill

apiVersion: apps/v1
kind: Deployment
metadata:
  name: {app_name}
  labels:
    app: {app_name}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: {app_name}
  template:
    metadata:
      labels:
        app: {app_name}
    spec:
      containers:
        - name: {app_name}
          image: {image}
          ports:
            - containerPort: {port}
{env_vars_yaml}
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "1000m"
              memory: "512Mi"
          readinessProbe:
            httpGet:
              path: /
              port: {port}
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /
              port: {port}
            initialDelaySeconds: 30
            periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: {app_name}-svc
spec:
  type: LoadBalancer
  selector:
    app: {app_name}
  ports:
    - port: 80
      targetPort: {port}
      protocol: TCP
"""
    return manifest


# ===========================================================================
# Main
# ===========================================================================

def main():
    parser = argparse.ArgumentParser(description="Generate deployment script from project + stack info")
    parser.add_argument("--project", help="Path to project detection JSON (from detect_project.py)")
    parser.add_argument("--stack-outputs", help="Path to stack outputs JSON")
    parser.add_argument("--pattern", default="standard",
                       choices=["lite", "standard", "ha", "elastic", "serverless", "container"],
                       help="Architecture pattern")
    parser.add_argument("--repo-url", help="Git repository URL for code clone")
    parser.add_argument("--format", default="script",
                       choices=["script", "runcommand", "dockerfile", "k8s"],
                       help="Output format")
    parser.add_argument("--output", "-o", default="-", help="Output file (- for stdout)")
    args = parser.parse_args()

    # Read project info
    if args.project:
        with open(args.project, "r", encoding="utf-8") as f:
            project = json.load(f)
    else:
        project = json.load(sys.stdin)

    # Read stack outputs (or use empty defaults)
    stack_outputs = {}
    if args.stack_outputs:
        with open(args.stack_outputs, "r", encoding="utf-8") as f:
            stack_outputs = json.load(f)

    # Generate based on format
    if args.format == "script":
        output = generate_script(project, stack_outputs, args.pattern, args.repo_url)
    elif args.format == "runcommand":
        output = generate_runcommand_yaml(project, stack_outputs, args.pattern, args.repo_url)
    elif args.format == "dockerfile":
        output = generate_dockerfile(project)
    elif args.format == "k8s":
        output = generate_k8s_manifest(project, stack_outputs)
    else:
        output = generate_script(project, stack_outputs, args.pattern, args.repo_url)

    # Write output
    if args.output == "-":
        print(output)
    else:
        with open(args.output, "w", encoding="utf-8", newline="\n") as f:
            f.write(output)
        print(f"Output written to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
