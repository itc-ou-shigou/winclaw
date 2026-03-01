# Security Tier Definitions

Three security levels for Alibaba Cloud deployments. Each tier builds on the previous.

## Tier Selection Guide

| Tier | Use Case | Extra Cost |
|------|----------|-----------|
| Basic (弱) | Dev/test, personal projects | ~0 CNY |
| Standard (中) | Production web apps, SMB | ~200-500 CNY/mo |
| Enterprise (强) | Finance, healthcare, e-commerce with PII | ~2000-5000 CNY/mo |

---

## Basic (弱) - Minimum Security

### Network
- VPC isolation (dedicated network)
- SecurityGroup rules:
  - Inbound: 80, 443 (0.0.0.0/0); 22 (admin IP only)
  - Outbound: all allowed
- No public IP on RDS

### Access Control
- Root account + 1 RAM user
- AK/SK for deployment only (no long-lived keys in code)

### Data
- RDS automatic backup: 7 days
- No encryption at rest

### Monitoring
- CloudMonitor basic (free tier)

### ROS SecurityGroup Snippet
```yaml
ALIYUN::ECS::SecurityGroup:
  Properties:
    SecurityGroupIngress:
      - PortRange: 80/80
        IpProtocol: tcp
        SourceCidrIp: 0.0.0.0/0
      - PortRange: 443/443
        IpProtocol: tcp
        SourceCidrIp: 0.0.0.0/0
      - PortRange: 22/22
        IpProtocol: tcp
        SourceCidrIp: <ADMIN_IP>/32
```

---

## Standard (中) - Production Security

### Network (adds to Basic)
- SecurityGroup: restrict inter-service traffic
- SLB with HTTPS termination (free certificate via CAS)
- RDS whitelist: VPC CIDR only (e.g., 192.168.0.0/16)
- NAT Gateway for ECS outbound (no direct public IP on ECS)

### Access Control
- RAM users with least-privilege policies
- RAM roles for ECS (no AK/SK on instances)
- MFA enabled for console login
- Separate RAM users for dev/ops

### Data
- RDS SSL connection enabled
- RDS backup: 14 days, cross-region backup
- OSS server-side encryption (SSE-KMS)
- ECS disk encryption

### Monitoring
- CloudMonitor with alert rules (CPU, memory, disk, RDS connections)
- ActionTrail enabled (audit log)
- SLS (Log Service) for access logs

### Extra Resources
```
ALIYUN::CAS::Certificate     # Free SSL certificate
ALIYUN::RAM::Role             # Instance role
ALIYUN::RAM::User             # Operator accounts
ALIYUN::ActionTrail::Trail    # Audit logging
```

---

## Enterprise (强) - Full Security Stack

### Network (adds to Standard)
- WAF (Web Application Firewall)
  - Common attack protection (SQL injection, XSS, CSRF)
  - CC attack protection
  - Custom rules
- Anti-DDoS Basic (free) + Pro (if needed)
- VPC Flow Logs enabled
- Multiple SecurityGroups (web-tier, app-tier, db-tier separation)

### Access Control
- RAM: fine-grained policies per service
- STS temporary credentials for all API calls
- SSO integration (SAML/OIDC) if enterprise IdP exists
- IP whitelist for console access
- Operation audit for all RAM users

### Data
- RDS TDE (Transparent Data Encryption)
- KMS managed keys for all encryption
- RDS SQL audit enabled
- OSS bucket policy: deny public access
- Regular security scan (Cloud Security Center)

### Compliance
- Cloud Config rules for compliance check
- Security Center (Advanced): vulnerability scan, baseline check
- Network isolation: 3-tier VSwitch design
  - Public subnet (SLB/NAT only)
  - Private subnet (ECS/App)
  - Data subnet (RDS/Redis)

### Extra Resources
```
ALIYUN::WAF::Instance         # Web Application Firewall
ALIYUN::KMS::Key              # Customer managed keys
ALIYUN::Config::Rule          # Compliance rules
ALIYUN::SAS::Instance         # Security Center
```

### 3-Tier Network Design
```yaml
# Public Subnet (10.0.1.0/24) - SLB, NAT Gateway only
# App Subnet (10.0.2.0/24) - ECS instances
# Data Subnet (10.0.3.0/24) - RDS, Redis

# SecurityGroup Rules:
# SG-Web: 80/443 from 0.0.0.0/0
# SG-App: 8080 from SG-Web only
# SG-Data: 3306 from SG-App only, 6379 from SG-App only
```

---

## Security Checklist (All Tiers)

- [ ] No root account AK/SK created
- [ ] No public IP directly on RDS
- [ ] ECS password or key-pair auth (not both)
- [ ] SecurityGroup default deny inbound
- [ ] RDS backup enabled
- [ ] CloudMonitor basic alerts configured
