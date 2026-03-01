#!/usr/bin/env python3
"""
Detect project type and deployment requirements from workspace directory.

Usage:
    python detect_project.py --path /path/to/project

Output: JSON with project type, runtime, build commands, env vars, port, etc.
"""

import argparse
import json
import os
import re
import sys


def detect_project(path):
    """Analyze workspace directory to determine project type and requirements."""
    result = {
        "path": os.path.abspath(path),
        "type": "unknown",
        "runtime": None,
        "runtime_version": None,
        "framework": None,
        "install_cmd": None,
        "build_cmd": None,
        "start_cmd": None,
        "port": 3000,
        "entry_file": None,
        "has_dockerfile": False,
        "has_db_migration": False,
        "migration_cmd": None,
        "env_vars": [],
        "static_dir": None,
        "dependencies": [],
    }

    files = set()
    for f in os.listdir(path):
        files.add(f)

    # Docker
    if "Dockerfile" in files or "docker-compose.yml" in files or "docker-compose.yaml" in files:
        result["has_dockerfile"] = True

    # --- Node.js ---
    if "package.json" in files:
        result["type"] = "nodejs"
        result["runtime"] = "node"
        result["install_cmd"] = "npm install --production"

        try:
            with open(os.path.join(path, "package.json"), "r", encoding="utf-8") as f:
                pkg = json.load(f)
        except Exception:
            pkg = {}

        scripts = pkg.get("scripts", {})
        deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}

        # Detect framework
        if "next" in deps:
            result["framework"] = "nextjs"
            result["build_cmd"] = "npm run build"
            result["start_cmd"] = "npm start"
            result["port"] = 3000
        elif "nuxt" in deps:
            result["framework"] = "nuxt"
            result["build_cmd"] = "npm run build"
            result["start_cmd"] = "npm start"
            result["port"] = 3000
        elif "express" in deps:
            result["framework"] = "express"
            result["start_cmd"] = scripts.get("start", "node index.js")
            result["port"] = 3000
        elif "fastify" in deps:
            result["framework"] = "fastify"
            result["start_cmd"] = scripts.get("start", "node index.js")
            result["port"] = 3000
        elif "react-scripts" in deps:
            result["framework"] = "react-cra"
            result["build_cmd"] = "npm run build"
            result["static_dir"] = "build"
        elif "vite" in deps:
            result["framework"] = "vite"
            result["build_cmd"] = "npm run build"
            result["static_dir"] = "dist"

        if "build" in scripts and not result["build_cmd"]:
            result["build_cmd"] = "npm run build"
        if "start" in scripts and not result["start_cmd"]:
            result["start_cmd"] = "npm start"

        # Detect Node version
        engines = pkg.get("engines", {})
        if "node" in engines:
            result["runtime_version"] = engines["node"]
        else:
            if ".nvmrc" in files:
                try:
                    with open(os.path.join(path, ".nvmrc"), "r") as f:
                        result["runtime_version"] = f.read().strip()
                except Exception:
                    pass

        # Detect DB usage
        if any(d in deps for d in ["prisma", "@prisma/client"]):
            result["has_db_migration"] = True
            result["migration_cmd"] = "npx prisma migrate deploy"
        elif "sequelize" in deps:
            result["has_db_migration"] = True
            result["migration_cmd"] = "npx sequelize-cli db:migrate"
        elif "typeorm" in deps:
            result["has_db_migration"] = True
            result["migration_cmd"] = "npx typeorm migration:run"

    # --- Python ---
    elif "requirements.txt" in files or "pyproject.toml" in files or "Pipfile" in files:
        result["type"] = "python"
        result["runtime"] = "python3"

        if "requirements.txt" in files:
            result["install_cmd"] = "pip3 install -r requirements.txt"
            try:
                with open(os.path.join(path, "requirements.txt"), "r", encoding="utf-8") as f:
                    reqs = f.read()
            except Exception:
                reqs = ""

            if "django" in reqs.lower():
                result["framework"] = "django"
                result["start_cmd"] = "gunicorn -w 4 -b 0.0.0.0:8000 config.wsgi:application"
                result["port"] = 8000
                result["has_db_migration"] = True
                result["migration_cmd"] = "python manage.py migrate"
            elif "flask" in reqs.lower():
                result["framework"] = "flask"
                result["start_cmd"] = "gunicorn -w 4 -b 0.0.0.0:8000 app:app"
                result["port"] = 8000
            elif "fastapi" in reqs.lower():
                result["framework"] = "fastapi"
                result["start_cmd"] = "uvicorn main:app --host 0.0.0.0 --port 8000"
                result["port"] = 8000

        elif "pyproject.toml" in files:
            result["install_cmd"] = "pip3 install ."

    # --- Java ---
    elif "pom.xml" in files:
        result["type"] = "java-maven"
        result["runtime"] = "java"
        result["framework"] = "spring-boot"
        result["install_cmd"] = "mvn clean package -DskipTests"
        result["build_cmd"] = "mvn clean package -DskipTests"
        result["start_cmd"] = "java -jar target/*.jar --server.port=8080"
        result["port"] = 8080

    elif "build.gradle" in files or "build.gradle.kts" in files:
        result["type"] = "java-gradle"
        result["runtime"] = "java"
        result["framework"] = "spring-boot"
        result["install_cmd"] = "./gradlew build -x test"
        result["build_cmd"] = "./gradlew build -x test"
        result["start_cmd"] = "java -jar build/libs/*.jar --server.port=8080"
        result["port"] = 8080

    # --- Go ---
    elif "go.mod" in files:
        result["type"] = "golang"
        result["runtime"] = "go"
        result["build_cmd"] = "go build -o app ."
        result["start_cmd"] = "./app"
        result["port"] = 8080

    # --- PHP ---
    elif "composer.json" in files:
        result["type"] = "php"
        result["runtime"] = "php"
        result["install_cmd"] = "composer install --no-dev"

        try:
            with open(os.path.join(path, "composer.json"), "r", encoding="utf-8") as f:
                composer = json.load(f)
        except Exception:
            composer = {}

        reqs = composer.get("require", {})
        if "laravel/framework" in reqs:
            result["framework"] = "laravel"
            result["start_cmd"] = "php artisan serve --host=0.0.0.0 --port=8000"
            result["port"] = 8000
            result["has_db_migration"] = True
            result["migration_cmd"] = "php artisan migrate --force"

    # --- Static HTML ---
    elif "index.html" in files:
        result["type"] = "static"
        result["runtime"] = "nginx"
        result["static_dir"] = "."
        result["start_cmd"] = "nginx"
        result["port"] = 80

    # Detect .env file for env vars
    env_file = os.path.join(path, ".env.example")
    if not os.path.exists(env_file):
        env_file = os.path.join(path, ".env.sample")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key = line.split("=")[0].strip()
                        result["env_vars"].append(key)
        except Exception:
            pass

    return result


def main():
    parser = argparse.ArgumentParser(description="Detect project type from workspace")
    parser.add_argument("--path", required=True, help="Path to project directory")
    args = parser.parse_args()

    if not os.path.isdir(args.path):
        print(json.dumps({"error": f"Directory not found: {args.path}"}))
        sys.exit(1)

    result = detect_project(args.path)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
