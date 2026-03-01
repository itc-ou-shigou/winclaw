# Deployment Checklist

## Pre-Deployment

### User Account Verification
- [ ] User logged into Alibaba Cloud Console in browser
- [ ] Account has sufficient balance or valid payment method
- [ ] RAM permissions: AliyunROSFullAccess, AliyunECSFullAccess, AliyunRDSFullAccess, AliyunSLBFullAccess, AliyunVPCFullAccess (or AdministratorAccess)
- [ ] Target region selected

### Workspace Analysis
- [ ] Identify project type (Node.js/Python/Java/PHP/Go/Static)
- [ ] Identify runtime requirements (Node version, Python version, etc.)
- [ ] Identify dependencies (package.json, requirements.txt, pom.xml, etc.)
- [ ] Identify build process (npm build, maven package, etc.)
- [ ] Identify environment variables needed
- [ ] Identify port the app listens on
- [ ] Database schema/migration files identified (if using DB)

---

## Phase 3A: Infrastructure Deployment (ROS Stack)

### Via ROS Console (ros.console.aliyun.com)
1. Navigate to ROS Console > Stacks > Create Stack
2. Select "Use New Resources"
3. Choose template source: "Enter Template Content"
4. Paste generated YAML template
5. Fill Stack Name: `{project-name}-stack`
6. Fill required parameters:
   - Region / Zone
   - Instance specs (pre-filled from plan)
   - Password / KeyPair
   - DB password (user must input)
7. Click "Create" and wait for CREATE_COMPLETE

### Via CLI (aliyun ros CreateStack) - Alternative
```bash
aliyun ros CreateStack \
  --StackName {project}-stack \
  --TemplateBody file://template.yml \
  --Parameters '[{"ParameterKey":"...","ParameterValue":"..."}]' \
  --RegionId cn-hangzhou
```

### Stack Output Collection
After CREATE_COMPLETE, collect from Outputs tab:
- ECS public IP / EIP
- RDS connection string (internal)
- RDS port
- SLB public IP / DNS
- VPC ID, VSwitch ID

---

## Phase 3B: Code Deployment to ECS

### Step 1: Connect to ECS
```bash
ssh root@{ECS_PUBLIC_IP}
# or via Alibaba Cloud Workbench (browser-based terminal)
```

### Step 2: Environment Setup (by project type)

#### Node.js
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs
npm install -g pm2
```

#### Python
```bash
yum install -y python3 python3-pip
pip3 install gunicorn
```

#### Java
```bash
yum install -y java-17-openjdk
```

#### Static (Nginx)
```bash
yum install -y nginx
systemctl enable nginx
```

### Step 3: Upload Code
Option A - Git clone:
```bash
git clone {repo_url} /app
cd /app && {install_command}
```

Option B - SCP from local:
```bash
scp -r /workspace/* root@{ECS_IP}:/app/
```

Option C - Via OSS (large files):
```bash
# Upload to OSS first, then download on ECS
aliyun oss cp oss://{bucket}/app.tar.gz /app/
```

### Step 4: Configure Environment
```bash
cat > /app/.env << 'EOF'
DB_HOST={RDS_INTERNAL_ENDPOINT}
DB_PORT=3306
DB_USER={DB_USER}
DB_PASS={DB_PASS}
DB_NAME={DB_NAME}
PORT={APP_PORT}
NODE_ENV=production
EOF
```

### Step 5: Database Setup
```bash
mysql -h {RDS_ENDPOINT} -u {DB_USER} -p{DB_PASS} < /app/schema.sql
# or run migrations
cd /app && npx prisma migrate deploy
# or
cd /app && python manage.py migrate
```

### Step 6: Start Application

#### Node.js
```bash
cd /app && npm install --production && npm run build
pm2 start npm --name app -- start
pm2 save && pm2 startup
```

#### Python
```bash
cd /app && pip3 install -r requirements.txt
gunicorn -w 4 -b 0.0.0.0:8000 app:app --daemon
```

#### Java
```bash
cd /app && java -jar app.jar --server.port=8080 &
```

#### Static
```bash
cp -r /app/dist/* /usr/share/nginx/html/
nginx -t && systemctl restart nginx
```

### Step 7: Configure Reverse Proxy (if needed)
```nginx
# /etc/nginx/conf.d/app.conf
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:{APP_PORT};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## Phase 3C: Verification & SLB Configuration

### Health Check
- [ ] ECS: `curl http://{ECS_IP}:{PORT}/` returns 200
- [ ] RDS: Application can connect to database
- [ ] SLB: Backend server added, health check passing
- [ ] Domain: DNS record pointing to SLB IP (if applicable)

### SLB Backend Setup (if not in ROS template)
1. Add ECS instance to SLB backend server group
2. Configure listener: 80 -> {APP_PORT}
3. HTTPS listener: 443 -> {APP_PORT} (attach SSL cert)
4. Health check: GET / or /health

---

## Post-Deployment Report Template

```
====================================
  Deployment Report
====================================
Stack Name:    {stack_name}
Stack ID:      {stack_id}
Status:        CREATE_COMPLETE
Region:        {region}

--- Infrastructure ---
VPC:           {vpc_id}
ECS:           {ecs_id} ({ecs_spec})
  Public IP:   {ecs_ip}
RDS:           {rds_id} ({rds_spec})
  Endpoint:    {rds_endpoint}
SLB:           {slb_id}
  Public IP:   {slb_ip}

--- Application ---
Project:       {project_name}
Type:          {project_type}
Port:          {app_port}
Process:       {pm2/gunicorn/java}

--- Access ---
HTTP:          http://{slb_ip}/
HTTPS:         https://{domain}/ (if configured)

--- Database ---
Host:          {rds_endpoint}
Port:          3306
Database:      {db_name}
User:          {db_user}

--- Estimated Cost ---
Monthly:       ~{total_cost} CNY

--- Next Steps ---
1. Configure domain DNS -> {slb_ip}
2. Apply SSL certificate (free via CAS)
3. Set up CloudMonitor alerts
4. Configure auto-backup policy
====================================
```
