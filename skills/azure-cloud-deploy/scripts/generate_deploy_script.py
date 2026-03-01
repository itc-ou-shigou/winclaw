#!/usr/bin/env python3
"""
Generate deployment scripts for Azure from project detection + stack outputs.

Usage:
    python detect_project.py --path /app | python generate_deploy_script.py \
        --stack-outputs outputs.json --pattern standard --format script --output deploy.sh

    python detect_project.py --path /app | python generate_deploy_script.py \
        --format dockerfile --output Dockerfile

    python detect_project.py --path /app | python generate_deploy_script.py \
        --stack-outputs outputs.json --format k8s --output k8s-deploy.yml

Formats:
    script      Bash script for VM deployment (scp + ssh)
    dockerfile  Multi-stage Dockerfile
    k8s         Kubernetes Deployment + Service manifest
    azcli       az CLI commands for App Service deployment
"""

import argparse
import json
import sys
import os


# Runtime → install commands for VM deployment
RUNTIME_SETUP = {
    "nodejs": {
        "install": [
            "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
            "apt-get install -y nodejs",
        ],
        "process_manager": "npm install -g pm2",
    },
    "python": {
        "install": [
            "apt-get update && apt-get install -y python3 python3-pip python3-venv",
        ],
        "process_manager": None,
    },
    "java-maven": {
        "install": [
            "apt-get update && apt-get install -y openjdk-17-jdk maven",
        ],
        "process_manager": None,
    },
    "java-gradle": {
        "install": [
            "apt-get update && apt-get install -y openjdk-17-jdk",
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
            "apt-get update && apt-get install -y php8.2 php8.2-fpm php8.2-mysql php8.2-pgsql composer nginx",
        ],
        "process_manager": None,
    },
    "static": {
        "install": [
            "apt-get update && apt-get install -y nginx",
        ],
        "process_manager": None,
    },
}

# Runtime → Docker base images
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
    """Generate a bash deployment script for VM-based patterns."""
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
        lines.append("apt-get install -y git")
        lines.append(f"git clone {repo_url} /app")
    else:
        lines.append("# Upload code to /app via scp before running this script")
        lines.append("# scp -r ./* azureuser@<VM_IP>:/app/")
    lines.append("cd /app")
    lines.append("")

    # Step 3: Environment file
    lines.append("# === Step 3: Environment Variables ===")
    lines.append("cat > /app/.env << 'ENVEOF'")
    lines.append(f"PORT={port}")
    lines.append("NODE_ENV=production")
    if outputs:
        db_host = outputs.get("dbServerFqdn", outputs.get("DbEndpoint", ""))
        if db_host:
            lines.append(f"DB_HOST={db_host}")
            lines.append("DB_PORT=3306")
            lines.append("DB_USER=azureuser")
            lines.append("DB_PASS=<SET_MANUALLY>")
            lines.append("DB_NAME=appdb")
        redis_host = outputs.get("redisHostName", "")
        if redis_host:
            lines.append(f"REDIS_HOST={redis_host}")
            lines.append("REDIS_PORT=6380")
            lines.append("REDIS_KEY=<SET_MANUALLY>")
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
        lines.append("pm2 startup systemd -u azureuser --hp /home/azureuser")
    elif rt == "static":
        lines.append("cp -r /app/* /var/www/html/")
        lines.append("systemctl enable nginx && systemctl start nginx")
    else:
        lines.append(f"nohup {start_cmd} > /var/log/app.log 2>&1 &")
    lines.append("")

    # Step 8: Nginx reverse proxy (non-static)
    if rt != "static" and pattern in ("lite",):
        lines.append("# === Step 8: Nginx Reverse Proxy ===")
        lines.append("apt-get install -y nginx")
        lines.append(f"""cat > /etc/nginx/sites-available/app << 'NGINX'
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
        lines.append("ln -sf /etc/nginx/sites-available/app /etc/nginx/sites-enabled/app")
        lines.append("rm -f /etc/nginx/sites-enabled/default")
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


def gen_azcli(project, outputs, pattern):
    """Generate az CLI commands for App Service deployment."""
    lines = ["#!/bin/bash", "set -euo pipefail", ""]
    rg = outputs.get("resourceGroup", "<RESOURCE_GROUP>")
    app_name = outputs.get("appServiceName", "<APP_NAME>")

    lines.append("# === Azure App Service Deployment ===")
    lines.append(f"RESOURCE_GROUP=\"{rg}\"")
    lines.append(f"APP_NAME=\"{app_name}\"")
    lines.append("")

    lines.append("# Step 1: Create deployment package")
    lines.append("cd <WORKSPACE_PATH>")
    lines.append("zip -r /tmp/app.zip . -x '*.git*' 'node_modules/*' '__pycache__/*' '.venv/*'")
    lines.append("")

    lines.append("# Step 2: Configure app settings")
    db_host = outputs.get("dbServerFqdn", "")
    if db_host:
        lines.append(f'az webapp config appsettings set --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" \\')
        lines.append(f'  --settings DB_HOST="{db_host}" DB_PORT=3306 DB_USER=azureuser DB_NAME=appdb')
        lines.append("")

    lines.append("# Step 3: Deploy ZIP package")
    lines.append('az webapp deploy --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" --src-path /tmp/app.zip --type zip')
    lines.append("")

    lines.append("# Step 4: Verify deployment")
    lines.append('APP_URL=$(az webapp show --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" --query defaultHostName -o tsv)')
    lines.append('echo "Application URL: https://$APP_URL"')
    lines.append('curl -s -o /dev/null -w "HTTP %{http_code}" "https://$APP_URL/"')

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
        lines += [
            "",
            f"FROM {images[0]}",
            "WORKDIR /app",
            "COPY requirements.txt ./",
            "RUN pip install --no-cache-dir -r requirements.txt",
            "COPY . .",
            f"EXPOSE {port}",
            f'CMD ["{project.get("start_cmd", "python app.py")}"]',
        ]
        # Fix CMD for python
        start = project.get("start_cmd", "python app.py")
        lines[-1] = f'CMD {json.dumps(start.split())}'
    elif rt in ("java-maven", "java-gradle"):
        build_tool = "mvn" if rt == "java-maven" else "gradle"
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


def gen_k8s(project, outputs):
    """Generate Kubernetes Deployment + Service manifest."""
    port = project.get("port", 3000)
    rt = project.get("type", "nodejs")

    env_vars = [
        {"name": "PORT", "value": str(port)},
        {"name": "NODE_ENV", "value": "production"},
    ]

    if outputs:
        db_host = outputs.get("dbServerFqdn", "")
        if db_host:
            env_vars += [
                {"name": "DB_HOST", "value": db_host},
                {"name": "DB_PORT", "value": "3306"},
                {"name": "DB_USER", "value": "azureuser"},
                {"name": "DB_PASS", "valueFrom": {
                    "secretKeyRef": {"name": "db-credentials", "key": "password"}
                }},
            ]

    deployment = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {"name": "app", "labels": {"app": "app"}},
        "spec": {
            "replicas": 2,
            "selector": {"matchLabels": {"app": "app"}},
            "template": {
                "metadata": {"labels": {"app": "app"}},
                "spec": {
                    "containers": [{
                        "name": "app",
                        "image": "<ACR_NAME>.azurecr.io/<IMAGE>:<TAG>",
                        "ports": [{"containerPort": port}],
                        "env": env_vars,
                        "resources": {
                            "requests": {"cpu": "250m", "memory": "256Mi"},
                            "limits": {"cpu": "1000m", "memory": "512Mi"}
                        },
                        "readinessProbe": {
                            "httpGet": {"path": "/", "port": port},
                            "initialDelaySeconds": 10,
                            "periodSeconds": 5
                        },
                        "livenessProbe": {
                            "httpGet": {"path": "/", "port": port},
                            "initialDelaySeconds": 30,
                            "periodSeconds": 10
                        }
                    }]
                }
            }
        }
    }

    service = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {"name": "app-svc"},
        "spec": {
            "type": "LoadBalancer",
            "selector": {"app": "app"},
            "ports": [{"port": 80, "targetPort": port, "protocol": "TCP"}]
        }
    }

    # YAML-like output
    import yaml_mini_dump
    return yaml_mini_dump.dump_multi([deployment, service])


def _yaml_dumps(obj, indent=0):
    """Simple YAML serializer (no PyYAML dependency)."""
    lines = []
    prefix = "  " * indent

    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, (dict, list)) and v:
                lines.append(f"{prefix}{k}:")
                if isinstance(v, list):
                    for item in v:
                        if isinstance(item, dict):
                            first = True
                            for ik, iv in item.items():
                                if first:
                                    lines.append(f"{prefix}- {ik}:")
                                    first = False
                                else:
                                    lines.append(f"{prefix}  {ik}:")
                                if isinstance(iv, (dict, list)) and iv:
                                    lines.extend(_yaml_dumps(iv, indent + 2).split("\n"))
                                else:
                                    # Rewrite last line to include value
                                    last = lines[-1]
                                    lines[-1] = f"{last} {_yaml_scalar(iv)}"
                        else:
                            lines.append(f"{prefix}- {_yaml_scalar(item)}")
                else:
                    lines.append(_yaml_dumps(v, indent + 1))
            else:
                lines.append(f"{prefix}{k}: {_yaml_scalar(v)}")
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, dict):
                lines.append(f"{prefix}-")
                lines.append(_yaml_dumps(item, indent + 1))
            else:
                lines.append(f"{prefix}- {_yaml_scalar(item)}")

    return "\n".join(lines)


def _yaml_scalar(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, str):
        if any(c in v for c in ":{}\n[]&*#?|->!%@`"):
            return f'"{v}"'
        return v
    if isinstance(v, dict) and not v:
        return "{}"
    if isinstance(v, list) and not v:
        return "[]"
    return str(v)


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
    lines.append('          image: "<ACR_NAME>.azurecr.io/<IMAGE>:<TAG>"')
    lines.append("          ports:")
    lines.append(f"            - containerPort: {port}")
    lines.append("          env:")
    lines.append('            - name: PORT')
    lines.append(f'              value: "{port}"')
    lines.append('            - name: NODE_ENV')
    lines.append('              value: "production"')

    if outputs:
        db_host = outputs.get("dbServerFqdn", "")
        if db_host:
            lines.append('            - name: DB_HOST')
            lines.append(f'              value: "{db_host}"')
            lines.append('            - name: DB_PORT')
            lines.append('              value: "3306"')
            lines.append('            - name: DB_USER')
            lines.append('              value: "azureuser"')
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
    parser = argparse.ArgumentParser(description="Generate Azure deployment scripts")
    parser.add_argument("--stack-outputs", help="Path to stack outputs JSON")
    parser.add_argument("--pattern", default="standard",
                        choices=["lite", "standard", "ha", "elastic", "serverless", "container"])
    parser.add_argument("--repo-url", help="Git repository URL")
    parser.add_argument("--format", default="script",
                        choices=["script", "azcli", "dockerfile", "k8s"])
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
    elif args.format == "azcli":
        content = gen_azcli(project, outputs, args.pattern)
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
