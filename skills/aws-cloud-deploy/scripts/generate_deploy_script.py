#!/usr/bin/env python3
"""
Generate deployment scripts for AWS from project detection + stack outputs.

Usage:
    python detect_project.py --path /app | python generate_deploy_script.py \
        --stack-outputs outputs.json --pattern standard --format script --output deploy.sh

    python detect_project.py --path /app | python generate_deploy_script.py \
        --format dockerfile --output Dockerfile

    python detect_project.py --path /app | python generate_deploy_script.py \
        --stack-outputs outputs.json --format k8s --output k8s-deploy.yml

Formats:
    script      Bash script for EC2 deployment (scp + ssh)
    dockerfile  Multi-stage Dockerfile
    k8s         Kubernetes Deployment + Service manifest
    awscli      AWS CLI commands for Lambda/ECS deployment
"""

import argparse
import json
import sys
import os


# Runtime -> install commands for EC2 deployment
RUNTIME_SETUP = {
    "nodejs": {
        "install": [
            "curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -",
            "yum install -y nodejs",
        ],
        "process_manager": "npm install -g pm2",
    },
    "python": {
        "install": [
            "yum update -y && yum install -y python3 python3-pip",
        ],
        "process_manager": None,
    },
    "java-maven": {
        "install": [
            "yum update -y && amazon-linux-extras install java-openjdk17 -y || yum install -y java-17-amazon-corretto maven",
        ],
        "process_manager": None,
    },
    "java-gradle": {
        "install": [
            "yum update -y && yum install -y java-17-amazon-corretto",
            "curl -fsSL https://services.gradle.org/distributions/gradle-8.5-bin.zip -o /tmp/gradle.zip",
            "unzip /tmp/gradle.zip -d /opt && ln -s /opt/gradle-8.5/bin/gradle /usr/bin/gradle",
        ],
        "process_manager": None,
    },
    "golang": {
        "install": [
            "curl -fsSL https://go.dev/dl/go1.22.0.linux-amd64.tar.gz | tar -C /usr/local -xz",
            "export PATH=$PATH:/usr/local/go/bin",
        ],
        "process_manager": None,
    },
    "php": {
        "install": [
            "yum update -y && yum install -y php8.2 php8.2-fpm php8.2-mysqlnd php8.2-pgsql nginx",
        ],
        "process_manager": None,
    },
    "static": {
        "install": [
            "yum update -y && yum install -y nginx",
        ],
        "process_manager": None,
    },
}

# Runtime -> Docker base images
DOCKER_IMAGES = {
    "nodejs": ("node:20-alpine", "node:20-alpine"),
    "python": ("python:3.12-slim", "python:3.12-slim"),
    "java-maven": ("maven:3.9-eclipse-temurin-17 AS builder", "eclipse-temurin:17-jre-alpine"),
    "java-gradle": ("gradle:8.5-jdk17 AS builder", "eclipse-temurin:17-jre-alpine"),
    "golang": ("golang:1.22-alpine AS builder", "alpine:3.19"),
    "php": ("composer:2 AS builder", "php:8.2-apache"),
    "static": ("nginx:alpine", None),
}


def gen_script(project, outputs, pattern, repo_url):
    """Generate a bash deployment script for EC2-based patterns."""
    rt = project.get("type", "nodejs")
    setup = RUNTIME_SETUP.get(rt, RUNTIME_SETUP["nodejs"])
    port = project.get("port", 3000)
    install_cmd = project.get("install_cmd", "")
    build_cmd = project.get("build_cmd", "")
    start_cmd = project.get("start_cmd", "")
    has_migration = project.get("has_db_migration", False)
    migration_cmd = project.get("migration_cmd", "")

    lines = ["#!/bin/bash", "set -euo pipefail", ""]
    lines.append("# === Step 1: System Setup ===")
    lines.append("export DEBIAN_FRONTEND=noninteractive")
    for cmd in setup["install"]:
        lines.append(cmd)
    if setup.get("process_manager"):
        lines.append(setup["process_manager"])
    lines.append("")

    # Step 2: Get code
    lines.append("# === Step 2: Get Application Code ===")
    if repo_url:
        lines.append("yum install -y git || apt-get install -y git")
        lines.append(f"git clone {repo_url} /app")
    else:
        lines.append("# Upload code to /app via scp before running this script")
        lines.append("# scp -i <key>.pem -r ./* ec2-user@<EC2_IP>:/app/")
    lines.append("cd /app")
    lines.append("")

    # Step 3: Environment file
    lines.append("# === Step 3: Environment Variables ===")
    lines.append("cat > /app/.env << 'ENVEOF'")
    lines.append(f"PORT={port}")
    lines.append("NODE_ENV=production")
    if outputs:
        db_host = outputs.get("DBEndpoint", outputs.get("dbEndpoint", ""))
        if db_host:
            lines.append(f"DB_HOST={db_host}")
            db_port = outputs.get("DBPort", outputs.get("dbPort", "3306"))
            lines.append(f"DB_PORT={db_port}")
            lines.append("DB_USER=dbadmin")
            lines.append("DB_PASS=<SET_MANUALLY>")
            lines.append("DB_NAME=appdb")
        redis_host = outputs.get("RedisEndpoint", outputs.get("redisEndpoint", ""))
        if redis_host:
            lines.append(f"REDIS_HOST={redis_host}")
            lines.append("REDIS_PORT=6379")
    lines.append("ENVEOF")
    lines.append("")

    # Step 4: Install dependencies
    if install_cmd:
        lines.append("# === Step 4: Install Dependencies ===")
        lines.append(install_cmd)
        lines.append("")

    # Step 5: DB migration
    if has_migration and migration_cmd:
        lines.append("# === Step 5: Database Migration ===")
        lines.append(f"# {migration_cmd}")
        lines.append(f"# Uncomment after setting DB_PASS in .env:")
        lines.append(f"# {migration_cmd}")
        lines.append("")

    # Step 6: Build
    if build_cmd:
        lines.append("# === Step 6: Build ===")
        lines.append(build_cmd)
        lines.append("")

    # Step 7: Start
    lines.append("# === Step 7: Start Application ===")
    if rt == "nodejs" and setup.get("process_manager"):
        lines.append(f"pm2 start {start_cmd.replace('node ', '')} --name app")
        lines.append("pm2 save")
        lines.append("pm2 startup systemd -u ec2-user --hp /home/ec2-user")
    elif rt == "static":
        lines.append("cp -r /app/* /usr/share/nginx/html/")
        lines.append("systemctl enable nginx && systemctl start nginx")
    else:
        lines.append(f"nohup {start_cmd} > /var/log/app.log 2>&1 &")
    lines.append("")

    # Step 8: Nginx reverse proxy (lite pattern)
    if rt != "static" and pattern in ("lite",):
        lines.append("# === Step 8: Nginx Reverse Proxy ===")
        lines.append("yum install -y nginx || apt-get install -y nginx")
        lines.append(f"""cat > /etc/nginx/conf.d/app.conf << 'NGINX'
server {{
    listen 80;
    server_name _;
    location / {{
        proxy_pass http://127.0.0.1:{port};
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
    }}
}}
NGINX""")
        lines.append("nginx -t && systemctl restart nginx")
        lines.append("")

    # Step 9: Health check
    lines.append("# === Step 9: Health Check ===")
    lines.append("sleep 5")
    lines.append(f'HTTP_CODE=$(curl -s -o /dev/null -w "%{{http_code}}" http://localhost:{port}/ || echo "000")')
    lines.append('if [ "$HTTP_CODE" = "200" ]; then')
    lines.append('    echo "[OK] Application is running (HTTP 200)"')
    lines.append("else")
    lines.append('    echo "[WARN] Application returned HTTP $HTTP_CODE"')
    lines.append("fi")

    return "\n".join(lines)


def gen_awscli(project, outputs, pattern):
    """Generate AWS CLI commands for Lambda deployment."""
    lines = ["#!/bin/bash", "set -euo pipefail", ""]

    if pattern == "serverless":
        fn_name = outputs.get("FunctionName", "<FUNCTION_NAME>")
        lines.append("# === AWS Lambda Deployment ===")
        lines.append(f'FUNCTION_NAME="{fn_name}"')
        lines.append("")
        lines.append("# Step 1: Package function code")
        lines.append("cd <WORKSPACE_PATH>")
        lines.append("zip -r /tmp/function.zip . -x '*.git*' 'node_modules/*' '__pycache__/*' '.venv/*'")
        lines.append("")
        lines.append("# Step 2: Update function code")
        lines.append('aws lambda update-function-code \\')
        lines.append('  --function-name "$FUNCTION_NAME" \\')
        lines.append('  --zip-file fileb:///tmp/function.zip')
        lines.append("")
        lines.append("# Step 3: Verify deployment")
        lines.append('aws lambda invoke --function-name "$FUNCTION_NAME" /tmp/response.json')
        lines.append('cat /tmp/response.json')
    else:
        # EC2 SSH deploy
        public_ip = outputs.get("PublicIP", outputs.get("publicIp", "<EC2_IP>"))
        lines.append("# === EC2 SSH Deployment ===")
        lines.append(f'EC2_IP="{public_ip}"')
        lines.append('KEY_FILE="<YOUR_KEY>.pem"')
        lines.append("")
        lines.append("# Step 1: Upload code")
        lines.append('scp -i "$KEY_FILE" -r ./* ec2-user@$EC2_IP:/app/')
        lines.append("")
        lines.append("# Step 2: Run deploy script")
        lines.append('ssh -i "$KEY_FILE" ec2-user@$EC2_IP "bash /app/deploy.sh"')
        lines.append("")
        lines.append("# Step 3: Verify")
        lines.append('curl -s -o /dev/null -w "HTTP %{http_code}" "http://$EC2_IP/"')

    return "\n".join(lines)


def gen_dockerfile(project):
    """Generate a multi-stage Dockerfile."""
    rt = project.get("type", "nodejs")
    port = project.get("port", 3000)
    images = DOCKER_IMAGES.get(rt, DOCKER_IMAGES["nodejs"])

    lines = [f"# Auto-generated Dockerfile for {rt}"]

    if rt == "nodejs":
        lines += [
            "",
            f"FROM {images[0]} AS builder",
            "WORKDIR /app",
            "COPY package*.json ./",
            "RUN npm ci",
            "COPY . .",
            "RUN npm run build || true",
            "",
            f"FROM {images[1]}",
            "WORKDIR /app",
            "COPY --from=builder /app .",
            f"EXPOSE {port}",
            f'CMD ["node", "{project.get("entry_file", "index.js")}"]',
        ]
    elif rt == "python":
        start = project.get("start_cmd", "python app.py")
        lines += [
            "",
            f"FROM {images[0]}",
            "WORKDIR /app",
            "COPY requirements.txt ./",
            "RUN pip install --no-cache-dir -r requirements.txt",
            "COPY . .",
            f"EXPOSE {port}",
            f'CMD {json.dumps(start.split())}',
        ]
    elif rt in ("java-maven", "java-gradle"):
        build_cmd = "mvn package -DskipTests" if rt == "java-maven" else "gradle build -x test"
        jar_path = "target/*.jar" if rt == "java-maven" else "build/libs/*.jar"
        lines += [
            "",
            f"FROM {images[0]}",
            "WORKDIR /app",
            "COPY . .",
            f"RUN {build_cmd}",
            "",
            f"FROM {images[1]}",
            "WORKDIR /app",
            f"COPY --from=builder /app/{jar_path} app.jar",
            f"EXPOSE {port}",
            'CMD ["java", "-jar", "app.jar"]',
        ]
    elif rt == "golang":
        lines += [
            "",
            f"FROM {images[0]}",
            "WORKDIR /app",
            "COPY go.mod go.sum ./",
            "RUN go mod download",
            "COPY . .",
            "RUN CGO_ENABLED=0 go build -o /app/server .",
            "",
            f"FROM {images[1]}",
            "COPY --from=builder /app/server /server",
            f"EXPOSE {port}",
            'CMD ["/server"]',
        ]
    elif rt == "php":
        lines += [
            "",
            f"FROM {images[0]}",
            "WORKDIR /app",
            "COPY composer.json composer.lock ./",
            "RUN composer install --no-dev --no-scripts",
            "",
            f"FROM {images[1]}",
            "COPY --from=builder /app/vendor /var/www/html/vendor",
            "COPY . /var/www/html/",
            f"EXPOSE {port}",
        ]
    else:  # static
        lines += [
            "",
            f"FROM {images[0]}",
            "COPY . /usr/share/nginx/html/",
            "EXPOSE 80",
        ]

    return "\n".join(lines)


def gen_k8s_yaml(project, outputs):
    """Generate K8s manifest as YAML string."""
    port = project.get("port", 3000)

    lines = ["---"]
    lines.append("apiVersion: apps/v1")
    lines.append("kind: Deployment")
    lines.append("metadata:")
    lines.append("  name: app")
    lines.append("  labels:")
    lines.append("    app: app")
    lines.append("spec:")
    lines.append("  replicas: 2")
    lines.append("  selector:")
    lines.append("    matchLabels:")
    lines.append("      app: app")
    lines.append("  template:")
    lines.append("    metadata:")
    lines.append("      labels:")
    lines.append("        app: app")
    lines.append("    spec:")
    lines.append("      containers:")
    lines.append("        - name: app")
    lines.append('          image: "<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/<REPO>:<TAG>"')
    lines.append("          ports:")
    lines.append(f"            - containerPort: {port}")
    lines.append("          env:")
    lines.append('            - name: PORT')
    lines.append(f'              value: "{port}"')
    lines.append('            - name: NODE_ENV')
    lines.append('              value: "production"')

    if outputs:
        db_host = outputs.get("DBEndpoint", outputs.get("dbEndpoint", ""))
        if db_host:
            lines.append('            - name: DB_HOST')
            lines.append(f'              value: "{db_host}"')
            db_port = outputs.get("DBPort", outputs.get("dbPort", "3306"))
            lines.append('            - name: DB_PORT')
            lines.append(f'              value: "{db_port}"')
            lines.append('            - name: DB_USER')
            lines.append('              value: "dbadmin"')
            lines.append('            - name: DB_PASS')
            lines.append('              valueFrom:')
            lines.append('                secretKeyRef:')
            lines.append('                  name: db-credentials')
            lines.append('                  key: password')

    lines.append("          resources:")
    lines.append("            requests:")
    lines.append('              cpu: "250m"')
    lines.append('              memory: "256Mi"')
    lines.append("            limits:")
    lines.append('              cpu: "1000m"')
    lines.append('              memory: "512Mi"')
    lines.append("          readinessProbe:")
    lines.append("            httpGet:")
    lines.append("              path: /")
    lines.append(f"              port: {port}")
    lines.append("            initialDelaySeconds: 10")
    lines.append("            periodSeconds: 5")
    lines.append("          livenessProbe:")
    lines.append("            httpGet:")
    lines.append("              path: /")
    lines.append(f"              port: {port}")
    lines.append("            initialDelaySeconds: 30")
    lines.append("            periodSeconds: 10")
    lines.append("")
    lines.append("---")
    lines.append("apiVersion: v1")
    lines.append("kind: Service")
    lines.append("metadata:")
    lines.append("  name: app-svc")
    lines.append("spec:")
    lines.append("  type: LoadBalancer")
    lines.append("  selector:")
    lines.append("    app: app")
    lines.append("  ports:")
    lines.append("    - port: 80")
    lines.append(f"      targetPort: {port}")
    lines.append("      protocol: TCP")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Generate AWS deployment scripts")
    parser.add_argument("--stack-outputs", help="Path to stack outputs JSON")
    parser.add_argument("--pattern", default="standard",
                        choices=["lite", "standard", "ha", "elastic", "serverless", "container"])
    parser.add_argument("--repo-url", help="Git repository URL")
    parser.add_argument("--format", default="script",
                        choices=["script", "awscli", "dockerfile", "k8s"])
    parser.add_argument("--output", help="Output file path")
    args = parser.parse_args()

    # Read project info from stdin
    project = json.load(sys.stdin)

    # Read stack outputs
    outputs = {}
    if args.stack_outputs:
        with open(args.stack_outputs, "r", encoding="utf-8") as f:
            outputs = json.load(f)

    # Generate based on format
    if args.format == "script":
        content = gen_script(project, outputs, args.pattern, args.repo_url)
    elif args.format == "awscli":
        content = gen_awscli(project, outputs, args.pattern)
    elif args.format == "dockerfile":
        content = gen_dockerfile(project)
    elif args.format == "k8s":
        content = gen_k8s_yaml(project, outputs)
    else:
        content = gen_script(project, outputs, args.pattern, args.repo_url)

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)
        print(f"Written to {args.output} ({len(content)} bytes)", file=sys.stderr)
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(content)


if __name__ == "__main__":
    main()
