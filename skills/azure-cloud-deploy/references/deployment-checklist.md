# Deployment Checklist

## Pre-Deployment

### Azure Account Verification
- [ ] User logged into Azure Portal (https://portal.azure.com) or `az login` completed
- [ ] Subscription is active with sufficient credits or valid payment method
- [ ] RBAC permissions: Contributor or Owner role on target subscription
- [ ] Required resource providers registered:
  - `Microsoft.Compute`, `Microsoft.Network`, `Microsoft.Web`
  - `Microsoft.DBforMySQL` / `Microsoft.DBforPostgreSQL`
  - `Microsoft.Cache`, `Microsoft.ContainerService`, `Microsoft.ContainerRegistry`
- [ ] Target region selected and resource availability confirmed
- [ ] Resource quotas sufficient (check `az vm list-usage --location <region>`)

### Workspace Analysis
- [ ] Identify project type (Node.js/Python/Java/PHP/Go/Static)
- [ ] Identify runtime requirements (Node 20, Python 3.12, Java 17, etc.)
- [ ] Identify dependencies (package.json, requirements.txt, pom.xml, etc.)
- [ ] Identify build process (npm run build, mvn package, etc.)
- [ ] Identify environment variables needed (.env file or config)
- [ ] Identify port the app listens on (default: 3000/8080/5000)
- [ ] Database schema/migration files identified (if using DB)
- [ ] Dockerfile exists? (if container pattern)

---

## Phase 3A: Infrastructure Deployment (ARM Template)

### Via Azure Portal (portal.azure.com)
1. Navigate to "Deploy a custom template" (search "template deployment")
2. Click "Build your own template in the editor"
3. Paste generated ARM JSON template
4. Fill parameters:
   - **Resource Group**: Create new or use existing
   - **Region**: Match the planned region
   - **Admin Password**: User must input (NEVER auto-fill)
   - **VM Size / SKU**: Pre-filled from plan
   - **DB Password**: User must input (NEVER auto-fill)
5. Click "Review + Create" → verify validation passes
6. Click "Create" and wait for deployment complete (5-30 min depending on pattern)
7. Navigate to "Outputs" tab to collect resource details

### Via az CLI (Alternative)
```bash
# Login
az login

# Create resource group
az group create \
  --name <PROJECT>-rg \
  --location <REGION>

# Deploy ARM template
az deployment group create \
  --resource-group <PROJECT>-rg \
  --template-file azuredeploy.json \
  --parameters adminPassword='<ASK_USER>' dbPassword='<ASK_USER>'

# Collect outputs
az deployment group show \
  --resource-group <PROJECT>-rg \
  --name azuredeploy \
  --query properties.outputs
```

### Deployment Output Collection
After deployment completes, collect from Outputs:
- VM public IP / App Service URL
- DB server FQDN (e.g., `mydb.mysql.database.azure.com`)
- DB port (3306 for MySQL, 5432 for PostgreSQL)
- AKS cluster name (for container pattern)
- ACR login server (e.g., `myacr.azurecr.io`)
- Load Balancer / Application Gateway public IP
- Storage Account connection string (for serverless)

---

## Phase 3B: Code Deployment

### Step 1: Connect to Resource

#### VM Pattern (lite/elastic)
```bash
ssh <adminUser>@<VM_PUBLIC_IP>
# or via Azure Bastion (browser-based, if configured)
```

#### App Service Pattern (standard/ha)
```bash
# No SSH needed - use az CLI or Git deploy
az webapp log tail --resource-group <RG> --name <APP>
```

#### Container Pattern
```bash
az aks get-credentials --resource-group <RG> --name <AKS_NAME>
kubectl get nodes  # verify connectivity
```

### Step 2: Environment Setup (by project type)

#### Node.js
```bash
# On VM:
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

# On App Service: auto-configured via linuxFxVersion
```

#### Python
```bash
# On VM:
apt-get install -y python3 python3-pip python3-venv
pip3 install gunicorn

# On App Service: auto-configured via linuxFxVersion
```

#### Java
```bash
# On VM:
apt-get install -y openjdk-17-jre

# On App Service: auto-configured via linuxFxVersion
```

#### Static (Nginx)
```bash
apt-get install -y nginx
systemctl enable nginx
```

### Step 3: Upload Code

**Option A - Git clone** (recommended):
```bash
git clone <REPO_URL> /app
cd /app && <INSTALL_COMMAND>
```

**Option B - ZIP Deploy (App Service)**:
```bash
cd <WORKSPACE_PATH>
zip -r app.zip . -x '*.git*' 'node_modules/*' '__pycache__/*'
az webapp deploy --resource-group <RG> --name <APP> --src-path app.zip --type zip
```

**Option C - Docker Build & Push (Container)**:
```bash
az acr login --name <ACR_NAME>
docker build -t <ACR_NAME>.azurecr.io/<IMAGE>:latest .
docker push <ACR_NAME>.azurecr.io/<IMAGE>:latest
kubectl apply -f k8s-deploy.yml
```

**Option D - SCP from local (VM)**:
```bash
scp -r ./dist/* <USER>@<VM_IP>:/app/
```

### Step 4: Configure Environment
```bash
# VM: create .env file
cat > /app/.env << 'EOF'
DB_HOST=<DB_FQDN>
DB_PORT=3306
DB_USER=<DB_USER>
DB_PASS=<DB_PASS>
DB_NAME=<DB_NAME>
PORT=<APP_PORT>
NODE_ENV=production
REDIS_HOST=<REDIS_HOST>
REDIS_PORT=6380
REDIS_PASSWORD=<REDIS_KEY>
EOF

# App Service: configure via az CLI
az webapp config appsettings set \
  --resource-group <RG> --name <APP> \
  --settings DB_HOST=<DB_FQDN> DB_PORT=3306 DB_USER=<USER>
```

### Step 5: Database Setup
```bash
# MySQL
mysql -h <DB_FQDN> -u <DB_USER> -p<DB_PASS> --ssl-mode=REQUIRED < schema.sql

# PostgreSQL
psql "host=<DB_FQDN> user=<DB_USER> password=<DB_PASS> dbname=<DB_NAME> sslmode=require" < schema.sql

# Or run migrations
cd /app && npx prisma migrate deploy
cd /app && python manage.py migrate
cd /app && npx sequelize-cli db:migrate
```

### Step 6: Start Application

#### Node.js (VM)
```bash
cd /app && npm install --production && npm run build
pm2 start npm --name app -- start
pm2 save && pm2 startup
```

#### Python (VM)
```bash
cd /app && pip3 install -r requirements.txt
gunicorn -w 4 -b 0.0.0.0:8000 app:app --daemon
```

#### Java (VM)
```bash
cd /app && java -jar app.jar --server.port=8080 &
```

#### Static (VM)
```bash
cp -r /app/dist/* /var/www/html/
nginx -t && systemctl restart nginx
```

### Step 7: Configure Reverse Proxy (VM patterns)
```nginx
# /etc/nginx/sites-available/app
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:<APP_PORT>;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
ln -s /etc/nginx/sites-available/app /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
```

---

## Phase 3C: Verification & Monitoring

### Health Check
- [ ] **VM**: `curl -s -o /dev/null -w "%{http_code}" http://<VM_IP>/` returns `200`
- [ ] **App Service**: `curl https://<APP>.azurewebsites.net/` returns `200`
- [ ] **AKS**: `kubectl get svc` → verify EXTERNAL-IP, `curl http://<EXTERNAL_IP>/`
- [ ] **Functions**: `curl https://<FUNC>.azurewebsites.net/api/<ENDPOINT>` returns expected
- [ ] **Database**: Application can connect (check app logs)
- [ ] **Redis**: Application can connect (check app logs for cache hits)
- [ ] **Load Balancer**: Health probe shows all backends healthy
- [ ] **Application Gateway**: Backend health shows all healthy

### SSL/TLS Check
- [ ] HTTPS endpoint returns valid certificate
- [ ] HTTP redirects to HTTPS (`httpsOnly: true` on App Service)
- [ ] TLS 1.2+ enforced (check `minimumTlsVersion`)

### Performance Baseline
- [ ] Response time under load: `< 500ms` for API, `< 2s` for web pages
- [ ] CPU usage baseline: `< 30%` at rest
- [ ] Memory usage baseline: `< 60%` at rest

---

## Post-Deployment Report Template

```
====================================================
  Azure Deployment Report
====================================================
Resource Group:  {resource_group}
Deployment:      {deployment_name}
Status:          Succeeded
Region:          {region}
Date:            {date}

--- Infrastructure ---
VNet:            {vnet_name} ({address_space})
NSG:             {nsg_name}

Compute:
  Type:          {VM / App Service / AKS / Functions}
  Spec:          {vm_size / sku}
  Instance(s):   {count}
  Public IP:     {public_ip}

Database:
  Type:          {MySQL / PostgreSQL} Flexible Server
  Spec:          {sku_name} ({tier})
  FQDN:          {db_fqdn}
  Port:          {3306 / 5432}
  Database:      {db_name}
  User:          {db_user}

Cache:           {Redis tier, if applicable}
  Hostname:      {redis_host}
  Port:          6380 (SSL)

--- Application ---
Project:         {project_name}
Type:            {project_type}
Runtime:         {runtime_version}
Port:            {app_port}
Process:         {pm2 / gunicorn / java / nginx}

--- Access URLs ---
Primary:         {primary_url}
App Service:     https://{app_name}.azurewebsites.net
SSH:             ssh {admin}@{public_ip}

--- Estimated Monthly Cost ---
Total:           ~${total_cost} USD/mo

Cost Breakdown:
  Compute:       ${compute_cost}
  Database:      ${db_cost}
  Cache:         ${cache_cost}
  Network:       ${network_cost}
  Other:         ${other_cost}

--- Security ---
NSG Rules:       {rule_count} inbound, {rule_count} outbound
HTTPS Only:      {yes/no}
Managed Identity:{yes/no}
Key Vault:       {yes/no}

--- Next Steps ---
1. Configure custom domain DNS → {public_ip}
   az webapp custom-hostname add --resource-group {rg} --webapp-name {app} --hostname {domain}
2. Enable managed SSL certificate (free for App Service)
   az webapp config ssl create --resource-group {rg} --name {app} --hostname {domain}
3. Set up Azure Monitor + Application Insights
   az monitor app-insights component create --app {app}-insights --location {region} --resource-group {rg}
4. Configure automated backup for database
   az mysql flexible-server backup create --resource-group {rg} --name {db_name}
5. Review NSG rules - restrict SSH to specific IPs
6. Enable Azure Defender if enterprise security needed
7. Set up cost alerts
   az consumption budget create --amount {budget} --resource-group {rg}
====================================================
```

---

## Troubleshooting Common Issues

### ARM Template Deployment Failures

| Error | Cause | Fix |
|-------|-------|-----|
| `InvalidTemplateDeployment` | Parameter validation failed | Check parameter types and allowed values |
| `ResourceNotFound` | Reference to non-existent resource | Verify `dependsOn` ordering |
| `QuotaExceeded` | Region quota limit hit | Request quota increase or change region |
| `SkuNotAvailable` | VM size not available in zone | Change `vmSize` or `availabilityZone` |
| `SubnetIsFull` | No IPs available in subnet | Use larger CIDR or different subnet |
| `PublicIPCountLimitReached` | Too many public IPs | Delete unused PIPs or request increase |

### App Service Issues

| Issue | Fix |
|-------|-----|
| 503 Service Unavailable | Check `alwaysOn: true`, verify startup command |
| Application Error | Check logs: `az webapp log tail --resource-group <RG> --name <APP>` |
| Slow cold start | Enable `alwaysOn`, use Premium tier, or pre-warm |
| Can't connect to DB | Verify firewall rules, check connection string format |

### AKS Issues

| Issue | Fix |
|-------|-----|
| Pods in CrashLoopBackOff | `kubectl logs <pod>`, check image and env vars |
| ImagePullBackOff | Verify ACR credentials: `az aks update --attach-acr <ACR>` |
| Service no external IP | Check `type: LoadBalancer`, verify AKS has outbound connectivity |
| Node NotReady | `kubectl describe node`, check VM quota and network |

### Database Connection Issues

| Issue | Fix |
|-------|-----|
| SSL required | Add `?sslmode=require` to connection string |
| Access denied | Check firewall rules, verify username format: `user@servername` |
| Connection timeout | Verify VNet integration or firewall `AllowAzureServices` |
| Too many connections | Scale up DB tier or implement connection pooling |
