# aliyun-deployment-health-issues.md

**Purpose**: Comprehensive troubleshooting guide for Alibaba Cloud deployment including ROS failures, ECS/ACK issues, log retrieval, error investigation, and common fix procedures.

**Version**: 1.0 (2026-03-01)

---

## Section 1: Alibaba Cloud Log Retrieval

### 1.1 ECS Instance Logs

```bash
# Method 1: SSH直接查看
ssh root@<ECS_IP> << 'EOF'
# Cloud-init output (UserData / RunCommand结果)
cat /var/log/cloud-init-output.log | tail -100

# 应用日志
cat /var/log/app.log | tail -50

# 系统journal
journalctl -u app -n 50 --no-pager

# PM2日志 (Node.js)
pm2 logs --lines 50 --nostream

# Nginx错误日志
cat /var/log/nginx/error.log | tail -30
EOF

# Method 2: Workbench (免费, 无需SSH密钥)
# ECS Console → 实例 → 远程连接 → Workbench
# 在终端中运行上述命令

# Method 3: 通过ECS RunCommand远程执行
aliyun ecs InvokeCommand \
    --RegionId cn-hangzhou \
    --InstanceId.1 "$INSTANCE_ID" \
    --Type RunShellScript \
    --CommandContent "$(echo 'tail -50 /var/log/cloud-init-output.log; echo "---"; tail -50 /var/log/app.log' | base64)"
```

### 1.2 SLS (Simple Log Service) Logs

```bash
# 查看SLS项目列表
aliyun sls ListProject

# 查看Logstore列表
aliyun sls ListLogStores --project <PROJECT>

# 查询日志 (搜索错误)
aliyun sls GetLogs \
    --project <PROJECT> \
    --logstore <STORE> \
    --query "error OR failed OR exception" \
    --from $(date -d '1 hour ago' +%s) \
    --to $(date +%s) \
    --line 50

# 或通过SLS Console (推荐, 有搜索UI):
# https://sls.console.aliyun.com/
# Project → Logstore → 查询分析
```

### 1.3 ROS Stack Events

```bash
# 查看所有Stack事件
aliyun ros ListStackEvents --StackId "$STACK_ID" \
    | python3 -c "
import sys, json
events = json.load(sys.stdin).get('Events', [])
for e in events[:20]:
    status = e.get('Status', '')
    icon = '✅' if 'COMPLETE' in status else '❌' if 'FAILED' in status else '⏳'
    print(f\"{icon} {e.get('CreateTime','')} | {e.get('LogicalResourceId','')} | {status}\")
    if 'FAILED' in status:
        print(f\"   Reason: {e.get('StatusReason','')}\")
"

# 只看失败事件
aliyun ros ListStackEvents --StackId "$STACK_ID" --Status CREATE_FAILED \
    | python3 -c "
import sys, json
events = json.load(sys.stdin).get('Events', [])
for e in events:
    print(f\"Resource: {e.get('LogicalResourceId')} ({e.get('ResourceType')})\")
    print(f\"  Reason: {e.get('StatusReason','')}\")
    print()"
```

### 1.4 ACK Container Logs

```bash
# Pod日志
kubectl logs deployment/app --tail=100
kubectl logs deployment/app --previous  # 上次崩溃的容器日志

# Pod事件
kubectl describe pod -l app=app

# SLS集成 (ACK自动集成SLS)
# ACK Console → 集群 → 日志中心 → 应用日志
```

### 1.5 Common Log Locations on ECS

| Log Type | Location | Description |
|----------|----------|-------------|
| Cloud-init | `/var/log/cloud-init-output.log` | UserData / RunCommand输出 |
| Cloud-init errors | `/var/log/cloud-init.log` | Cloud-init进程日志 |
| Application | `/var/log/app.log` | 应用stdout/stderr |
| PM2 logs | `~/.pm2/logs/` | Node.js PM2进程日志 |
| Nginx access | `/var/log/nginx/access.log` | HTTP请求日志 |
| Nginx error | `/var/log/nginx/error.log` | Nginx错误日志 |
| System | `/var/log/messages` or `journalctl` | 系统消息 |

---

## Section 2: ROS Stack Failure Diagnosis

### Pattern 1: CREATE_FAILED - RAM Permission Denied

**Symptom**:
```
Resource CREATE_FAILED: Forbidden.RAM: User not authorized to operate on the specified resource
```

**Fix**:
```bash
# 授权RAM用户所需权限
# Option 1: 通过RAM Console
# https://ram.console.aliyun.com/ → 用户 → 添加权限
# 添加: AliyunROSFullAccess, AliyunECSFullAccess, AliyunVPCFullAccess, AliyunRDSFullAccess

# Option 2: 通过CLI
aliyun ram AttachPolicyToUser \
    --PolicyType System \
    --PolicyName AliyunROSFullAccess \
    --UserName <USER>
```

### Pattern 2: CREATE_FAILED - Quota Exceeded

**Symptom**:
```
Resource CREATE_FAILED: QuotaExceeded: Living instances quota exceeded
```

**Fix**:
```bash
# 查看当前配额
aliyun ecs DescribeAccountAttributes \
    --AttributeName.1 max-running-instances

# 申请配额提升
# Quota Center: https://quotas.console.aliyun.com/
# 或提交工单: https://workorder.console.aliyun.com/
```

### Pattern 3: CREATE_FAILED - Zone Not Available

**Symptom**:
```
Resource CREATE_FAILED: The specified zone is not available for purchasing
```
or
```
Resource CREATE_FAILED: The specified instanceType is not supported in the specified zone
```

**Fix**:
```bash
# 查看可用区库存
aliyun ecs DescribeAvailableResource \
    --RegionId cn-hangzhou \
    --DestinationResource InstanceType \
    --InstanceType ecs.c6.large \
    | python3 -c "
import sys, json
zones = json.load(sys.stdin).get('AvailableZones', {}).get('AvailableZone', [])
for z in zones:
    status = z.get('StatusCategory', '')
    print(f\"  {z.get('ZoneId')}: {status}\")"

# 更新模板中的ZoneId和InstanceType
```

### Pattern 4: ROLLBACK_COMPLETE - Stack Stuck

**Symptom**: Stack状态为ROLLBACK_COMPLETE，无法更新或重新创建

**Fix**:
```bash
# 必须先删除失败的Stack
aliyun ros DeleteStack --StackId "$STACK_ID"
echo "Waiting for deletion..."
sleep 30

# 修复模板后重新创建
aliyun ros CreateStack \
    --StackName "<PROJECT>-stack" \
    --TemplateBody "$(cat /tmp/stack.yml)" \
    --RegionId cn-hangzhou

# 或通过Console创建 (推荐)
echo "Open: https://ros.console.aliyun.com/ → Create Stack"
```

### Pattern 5: CREATE_FAILED - VSwitch Not Found

**Symptom**:
```
Resource CREATE_FAILED: InvalidVSwitchId.NotFound
```

**Fix**:
```bash
# 检查VSwitch是否存在于指定可用区
aliyun vpc DescribeVSwitches --VpcId "$VPC_ID" \
    | python3 -c "
import sys, json
vswitches = json.load(sys.stdin).get('VSwitches', {}).get('VSwitch', [])
for v in vswitches:
    print(f\"  {v.get('VSwitchId')} | Zone: {v.get('ZoneId')} | CIDR: {v.get('CidrBlock')}\")"

# 确保模板中的ZoneId和VSwitchId匹配
```

---

## Section 3: ECS Deployment Issues

### Pattern 6: ECS Running But App Not Accessible

**Symptom**: ECS实例Running，SSH可连接，但curl返回连接被拒绝

**Investigation**:
```bash
ssh root@<ECS_IP> << 'CHECKEOF'
# 检查应用是否在监听
ss -tlnp | grep -E ":80|:3000|:8080"

# 检查应用进程是否存在
ps aux | grep -E "node|python|java"
pm2 status 2>/dev/null

# 检查应用日志
tail -30 /var/log/app.log 2>/dev/null
pm2 logs --lines 30 --nostream 2>/dev/null
journalctl -u app -n 30 --no-pager 2>/dev/null
CHECKEOF
```

**Common Causes**:

| Cause | Diagnosis | Fix |
|-------|-----------|-----|
| App not started | No process listening | Start app: `pm2 start npm -- start` |
| Wrong port | App on 3000, SG only allows 80 | Add Nginx proxy or update SG |
| Security Group | Port 80 not open | Add inbound rule: 80/80 TCP Allow |
| firewalld | System firewall blocking | `systemctl stop firewalld` (testing) |
| node_modules missing | npm errors in log | `cd /app && npm install --production` |
| .env not configured | DB connection errors | `vi /app/.env` set passwords |

### Pattern 7: RunCommand / UserData Failure

**Symptom**: ECS starts but app not deployed (cloud-init failed)

**Investigation**:
```bash
# 查看cloud-init输出
ssh root@<ECS_IP> 'cat /var/log/cloud-init-output.log | tail -50'

# 查看cloud-init状态
ssh root@<ECS_IP> 'cloud-init status'

# 如果使用ROS RunCommand，检查命令执行结果
aliyun ecs DescribeInvocationResults \
    --InvokeId "$INVOKE_ID" \
    | python3 -c "
import sys, json, base64
results = json.load(sys.stdin).get('Invocation', {}).get('InvocationResults', {}).get('InvocationResult', [])
for r in results:
    print(f\"Status: {r.get('InvocationStatus')}\")
    output = r.get('Output', '')
    if output:
        print(f\"Output: {base64.b64decode(output).decode('utf-8', errors='replace')}\")"
```

**Common Causes**:

| Cause | Log Pattern | Fix |
|-------|-------------|-----|
| Package not found | `No package nodejs available` | Use correct repo for OS |
| Network timeout | `Could not resolve host` | Check VPC has NAT Gateway for internet |
| Permission denied | `Permission denied` | RunCommand默认以root执行 |
| Script syntax error | `syntax error` | Test script locally first |
| Timeout | Command exceeds timeout | Increase ROS RunCommand Timeout |

**Fix Template**:
```bash
# 手动重新执行部署
ssh root@<ECS_IP> << 'FIXEOF'
cd /app

# 安装Node.js (Alibaba Cloud Linux / CentOS)
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
yum install -y nodejs git

# 安装依赖
npm install --production

# 启动
npm install -g pm2
pm2 start npm --name app -- start
pm2 save
pm2 startup | tail -1 | bash
FIXEOF
```

### Pattern 8: ECS Cannot Connect to RDS

**Symptom**: App starts but database connection fails

**⚠️ CRITICAL: Alibaba Cloud RDS需要配置IP白名单!**

**Investigation**:
```bash
ssh root@<ECS_IP> << 'DBEOF'
# 测试TCP连通性
timeout 5 bash -c "echo > /dev/tcp/<RDS_ENDPOINT>/3306" && echo "OK" || echo "FAIL"

# 获取ECS内网IP (用于白名单)
curl -s http://100.100.100.200/latest/meta-data/private-ipv4
DBEOF
```

**Fix**:
```bash
# 获取ECS内网IP
ECS_PRIVATE_IP=$(ssh root@<ECS_IP> 'curl -s http://100.100.100.200/latest/meta-data/private-ipv4')

# 方法1: CLI添加白名单
aliyun rds ModifySecurityIps \
    --DBInstanceId "$RDS_ID" \
    --SecurityIps "$ECS_PRIVATE_IP"

# 方法2: 添加安全组到白名单 (推荐)
aliyun rds ModifySecurityGroupConfiguration \
    --DBInstanceId "$RDS_ID" \
    --SecurityGroupId "$SG_ID"

# 方法3: Console操作 (最直观)
echo "RDS Console → 实例 → 数据安全性 → 白名单设置"
echo "Add ECS private IP: $ECS_PRIVATE_IP"
```

**Common Causes**:

| Cause | Fix |
|-------|-----|
| RDS白名单未配置 | Add ECS private IP to whitelist (最常见!) |
| ECS和RDS不在同一VPC | Must be in same VPC |
| Wrong credentials | Check .env file, update password |
| RDS未创建完成 | Wait for RDS to finish creating |

---

## Section 4: SLB Issues

### Pattern 9: SLB Backend Unhealthy

**Symptom**: SLB返回502/503，后端显示"abnormal"

**Investigation**:
```bash
# 检查后端健康状态
aliyun slb DescribeHealthStatus --LoadBalancerId "$SLB_ID"

# 检查监听配置
aliyun slb DescribeLoadBalancerHTTPListenerAttribute \
    --LoadBalancerId "$SLB_ID" \
    --ListenerPort 80
```

**Common Causes**:

| Cause | Fix |
|-------|-----|
| App not listening on backend port | Start app, verify port |
| Health check path wrong | Change to `/` or `/health` |
| Security Group blocks SLB | Add SLB CIDR to SG inbound |
| Health check too aggressive | Increase interval/threshold |

### Pattern 10: SLB 502 Bad Gateway

**Symptom**: SLB returns 502 even though ECS is running

**Fix**:
```bash
# 确认后端端口匹配
ssh root@<ECS_IP> 'ss -tlnp | grep LISTEN'

# 修改SLB后端端口 (如果不匹配)
aliyun slb SetBackendServers \
    --LoadBalancerId "$SLB_ID" \
    --BackendServers "[{\"ServerId\":\"$INSTANCE_ID\",\"Port\":3000,\"Weight\":100}]"
```

---

## Section 5: ACK (Container) Issues

### Pattern 11: Pod ImagePullBackOff

**Symptom**: `kubectl get pods` shows ImagePullBackOff

**Fix**:
```bash
# 登录ACR (Alibaba Container Registry)
docker login --username=<ALIYUN_ACCOUNT> registry.<REGION>.aliyuncs.com

# 验证镜像存在
aliyun cr GetRepoTags --RepoNamespace <NS> --RepoName <REPO>

# 创建pull secret for ACK
kubectl create secret docker-registry acr-secret \
    --docker-server=registry.<REGION>.aliyuncs.com \
    --docker-username=<ALIYUN_ACCOUNT> \
    --docker-password=<PASSWORD>

# 更新deployment使用secret
kubectl patch deployment app -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'
```

### Pattern 12: Pod CrashLoopBackOff

**Symptom**: `kubectl get pods` shows CrashLoopBackOff

**Investigation**:
```bash
# 查看Pod日志
kubectl logs deployment/app --tail=50

# 查看上次崩溃的容器日志
kubectl logs deployment/app --previous --tail=50

# 查看Pod事件
kubectl describe pod -l app=app | grep -A 20 "Events:"

# 检查容器退出码
kubectl get pods -o jsonpath='{.items[0].status.containerStatuses[0].lastState.terminated.exitCode}'
```

**Common Causes**:

| Exit Code | Cause | Fix |
|-----------|-------|-----|
| 1 | Application error | Check logs, fix code |
| 127 | Command not found | Fix CMD in Dockerfile |
| 137 | OOM Killed | Increase memory limits |
| 139 | Segfault | Debug application |

---

## Section 6: Function Compute (FC) Issues

### Pattern 13: FC Invocation Failure

**Symptom**: Function returns error or times out

**Investigation**:
```bash
# 查看函数配置
aliyun fc GET /services/$SERVICE/functions/$FUNCTION

# 查看调用日志 (通过SLS)
# FC自动将日志发送到SLS
# SLS Console → Project: <FC_LOG_PROJECT> → Logstore: function-log

# 测试调用
aliyun fc POST /services/$SERVICE/functions/$FUNCTION/invocations \
    --body '{"test": true}' \
    --header "Content-Type=application/json"
```

**Common Causes**:

| Error | Cause | Fix |
|-------|-------|-----|
| Timeout | Function runs too long | Increase timeout (max 600s) |
| OutOfMemory | Insufficient memory | Increase MemorySize |
| ModuleNotFoundError | Missing dependency | Include in code package |
| NoPermission | Service role missing | Attach required RAM policies |
| Handler not found | Wrong handler config | Verify handler path |

---

## Section 7: Enhanced Verification Flow

### Step 7.1: Mandatory Verification

```bash
verify_aliyun_deployment() {
    STACK_ID="$1"
    PATTERN="$2"  # lite/standard/ha/elastic/serverless/container

    echo "=========================================="
    echo "  Alibaba Cloud Deployment Verification"
    echo "  Stack ID: $STACK_ID"
    echo "  Pattern: $PATTERN"
    echo "=========================================="
    echo ""

    # Step 1: ROS Stack状态
    echo "[1/4] Checking ROS stack..."
    STACK_STATUS=$(aliyun ros GetStack --StackId "$STACK_ID" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('Status','UNKNOWN'))")

    if [ "$STACK_STATUS" = "CREATE_COMPLETE" ] || [ "$STACK_STATUS" = "UPDATE_COMPLETE" ]; then
        echo "✅ Stack: $STACK_STATUS"
    else
        echo "❌ Stack: $STACK_STATUS"
        echo "[ACTION] Check ROS events for root cause"
        return 1
    fi

    # Step 2: リソース固有チェック
    echo ""
    echo "[2/4] Checking resources..."

    case "$PATTERN" in
        lite|standard|ha|elastic)
            # ECS + SLB チェック
            ECS_IP=$(aliyun ros GetStack --StackId "$STACK_ID" \
                | python3 -c "
import sys, json
outputs = json.load(sys.stdin).get('Outputs', [])
for o in outputs:
    if 'EcsPublicIp' in o.get('OutputKey',''):
        print(o['OutputValue']); break")
            if [ -n "$ECS_IP" ]; then
                check_ecs_health "$ECS_IP"
            fi

            SLB_ID=$(aliyun ros GetStack --StackId "$STACK_ID" \
                | python3 -c "
import sys, json
outputs = json.load(sys.stdin).get('Outputs', [])
for o in outputs:
    if 'SlbId' in o.get('OutputKey','') or 'LoadBalancer' in o.get('OutputKey',''):
        print(o['OutputValue']); break")
            if [ -n "$SLB_ID" ]; then
                check_slb_health "$SLB_ID"
            fi
            ;;
        serverless)
            check_fc_health "$SERVICE_NAME" "$FUNCTION_NAME"
            ;;
        container)
            check_ack_health
            ;;
    esac

    # Step 3: DB接続チェック
    echo ""
    echo "[3/4] Checking database connectivity..."
    RDS_ENDPOINT=$(aliyun ros GetStack --StackId "$STACK_ID" \
        | python3 -c "
import sys, json
outputs = json.load(sys.stdin).get('Outputs', [])
for o in outputs:
    if 'Rds' in o.get('OutputKey','') or 'PolarDB' in o.get('OutputKey',''):
        print(o['OutputValue']); break" 2>/dev/null)

    if [ -n "$RDS_ENDPOINT" ]; then
        echo "RDS/PolarDB Endpoint: $RDS_ENDPOINT"
        echo "  ⚠️  Remember to configure RDS IP whitelist!"
        echo "  Add ECS private IP to RDS whitelist via Console"
    else
        echo "  [SKIP] No RDS in this stack"
    fi

    # Step 4: 最終結果
    echo ""
    echo "[4/4] Final result..."
    echo "=========================================="
    echo "  Verification Complete"
    echo "=========================================="
}
```

---

## Fix Priority Order

1. **CRITICAL**: ROS Stack ROLLBACK → Fix template and redeploy
2. **CRITICAL**: Security Group blocking traffic → Open ports 80/443
3. **CRITICAL**: RDS whitelist not configured → Add ECS private IP (阿里云特有!)
4. **CRITICAL**: ECS app not running → SSH/Workbench and restart
5. **CRITICAL**: node_modules missing → SSH and npm install
6. **HIGH**: SLB backend unhealthy → Fix health check path/port
7. **HIGH**: RDS connection failure → Check whitelist + VPC + credentials
8. **HIGH**: ACK pod CrashLoopBackOff → Check logs and container config
9. **MEDIUM**: FC timeout → Increase timeout/memory
10. **MEDIUM**: Zone not available → Change zone or instance type

---

## Alibaba Cloud Specific Notes (阿里云特有注意事项)

1. **RDS IP Whitelist**: 阿里云RDS默认拒绝所有连接，必须手动添加ECS内网IP到白名单
2. **ICP Filing (备案)**: 中国大陆域名需要备案才能通过HTTP访问
3. **Workbench**: 免费的Web终端，无需SSH密钥即可远程连接ECS
4. **SLS Integration**: ACK和FC自动集成SLS日志服务
5. **NAT Gateway**: VPC内的ECS需要NAT网关才能访问公网（安装依赖包）
6. **RunCommand**: ROS可以通过ALIYUN::ECS::RunCommand自动执行部署脚本
7. **Instance Metadata**: ECS内网IP可通过 `curl http://100.100.100.200/latest/meta-data/private-ipv4` 获取

---

**Last Updated**: 2026-03-01
**Version**: 1.0
**Based on**: Azure deployment health issues v2.12, adapted for Alibaba Cloud services
