# AWS Security Tiers

This document defines 3 security tiers for AWS deployments. The AI agent should select
the appropriate tier based on the user's compliance requirements, budget, and data sensitivity.

When in doubt, apply the **Standard** tier. It provides a strong security baseline at
reasonable cost and is appropriate for most production workloads.

---

## Tier Summary

| Tier | Monthly Extra Cost | Target | Compliance |
|------|-------------------|--------|-----------|
| Basic | $0 (free) | Dev, personal, demos | None |
| Standard | ~$10-30/mo | Small business, production | SOC2-ready |
| Enterprise | ~$200-3,500/mo | Regulated industries | SOC2, HIPAA, PCI-DSS |

---

## Tier 1: Basic (Free / Minimal Cost)

**Target**: Development environments, personal projects, demos, proof of concepts.

**Monthly Cost**: $0 additional (all services are free or included).

### Security Controls

#### Network Security

| Control | Implementation | Cost |
|---------|---------------|------|
| Security Groups | Stateful firewall rules on instances and resources | Free |
| Public subnet only | Simplest network topology, direct internet access | Free |
| HTTPS (ACM) | Free SSL/TLS certificates from AWS Certificate Manager | Free |

**Security Group Rules** (minimum recommended):

```
Inbound:
  - SSH (22):   Your IP only (NOT 0.0.0.0/0)
  - HTTP (80):  0.0.0.0/0 (redirect to HTTPS)
  - HTTPS (443): 0.0.0.0/0

Outbound:
  - All traffic: 0.0.0.0/0 (default)
```

> **Agent Rule**: NEVER allow SSH from 0.0.0.0/0. Always restrict to the user's IP
> or a known CIDR range. Use `curl -s https://checkip.amazonaws.com` to get the current IP.

#### Identity and Access

| Control | Implementation | Cost |
|---------|---------------|------|
| IAM Users with MFA | Console users have MFA enabled | Free |
| Root account MFA | Hardware or virtual MFA on root | Free |
| Password policy | Minimum length, complexity, rotation | Free |
| IAM Access Keys | For programmatic access (rotate every 90 days) | Free |

#### Encryption

| Control | Implementation | Cost |
|---------|---------------|------|
| S3 default encryption | SSE-S3 (AES-256) on all buckets | Free |
| EBS default encryption | AES-256 using AWS managed key | Free |
| HTTPS in transit | ACM certificates on ALB/CloudFront | Free |
| RDS encryption (if used) | Enable at creation with AWS managed key | Free |

#### Logging and Monitoring

| Control | Implementation | Cost |
|---------|---------------|------|
| CloudTrail | Management events, 1 trail (free) | Free |
| CloudWatch basic | 5-minute metrics, 10 alarms, 5GB logs | Free |
| VPC Flow Logs | To CloudWatch Logs (basic, 5GB free) | Free |

#### Data Protection

| Control | Implementation | Cost |
|---------|---------------|------|
| S3 Block Public Access | Account-level block public access | Free |
| EBS snapshots | Manual snapshots for backup | $0.05/GB-mo |
| RDS automated backups | 7-day retention (default, free) | Free |

### What Basic Tier Does NOT Include

- No private subnets (all resources publicly accessible)
- No WAF (no application-layer firewall)
- No centralized secrets management
- No advanced threat detection
- No compliance monitoring or audit trails beyond CloudTrail
- No network segmentation beyond security groups
- No customer-managed encryption keys

### CloudFormation Snippet (Basic Security Group)

```yaml
AppSecurityGroup:
  Type: AWS::EC2::SecurityGroup
  Properties:
    GroupDescription: Basic security group
    VpcId: !Ref VPC
    SecurityGroupIngress:
      - IpProtocol: tcp
        FromPort: 443
        ToPort: 443
        CidrIp: 0.0.0.0/0
      - IpProtocol: tcp
        FromPort: 80
        ToPort: 80
        CidrIp: 0.0.0.0/0
      - IpProtocol: tcp
        FromPort: 22
        ToPort: 22
        CidrIp: !Ref AllowedSSHCidr  # NEVER use 0.0.0.0/0
    SecurityGroupEgress:
      - IpProtocol: -1
        CidrIp: 0.0.0.0/0
```

---

## Tier 2: Standard (Recommended for Production)

**Target**: Small business production, SaaS applications, staging environments that
mirror production security posture.

**Monthly Cost**: ~$10-30 additional.

### Security Controls

Everything from Basic tier, plus:

#### Network Security

| Control | Implementation | Cost |
|---------|---------------|------|
| Private subnets | DB and internal services in private subnets | Free (subnet) |
| NAT Gateway | Private subnet internet access (outbound only) | $32.85/mo |
| Layered Security Groups | ALB SG --> App SG --> DB SG (no direct access) | Free |
| Network ACLs | Subnet-level stateless firewall rules | Free |

**Layered Security Group Architecture**:

```
Internet --> [ALB Security Group]
               Inbound: 80, 443 from 0.0.0.0/0

             [App Security Group]
               Inbound: App port from ALB SG ONLY

             [DB Security Group]
               Inbound: 3306/5432 from App SG ONLY
               NO direct internet access
```

> **Agent Rule**: Database security groups MUST only allow inbound from the application
> security group. Never allow direct internet access to databases.

#### Identity and Access

| Control | Implementation | Cost |
|---------|---------------|------|
| IAM Roles (no long-term keys) | EC2 Instance Profiles for AWS API access | Free |
| Least privilege policies | Custom IAM policies scoped to needed services | Free |
| IAM Access Analyzer | Identify resources shared externally | Free |
| SSM Session Manager | SSH alternative, no inbound port 22 needed | Free |

**Instance Profile Example**:

```yaml
EC2Role:
  Type: AWS::IAM::Role
  Properties:
    AssumeRolePolicyDocument:
      Version: '2012-10-17'
      Statement:
        - Effect: Allow
          Principal:
            Service: ec2.amazonaws.com
          Action: sts:AssumeRole
    ManagedPolicyArns:
      - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
    Policies:
      - PolicyName: AppAccess
        PolicyDocument:
          Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - s3:GetObject
                - s3:PutObject
              Resource: !Sub 'arn:aws:s3:::${AppBucket}/*'

EC2InstanceProfile:
  Type: AWS::IAM::InstanceProfile
  Properties:
    Roles:
      - !Ref EC2Role
```

> **Agent Rule**: NEVER use inline AWS credentials (access keys) on EC2 instances.
> Always use IAM Instance Profiles / Roles.

#### Encryption and Secrets

| Control | Implementation | Cost |
|---------|---------------|------|
| KMS Customer Managed Key | For sensitive data encryption | $1.00/key/mo |
| Secrets Manager | Database passwords, API keys | $0.40/secret/mo |
| RDS encryption at rest | Using KMS CMK | Free (KMS key cost) |
| S3 bucket encryption | SSE-KMS with CMK | Free (KMS key cost) |
| Parameter Store | Non-sensitive configuration values | Free (Standard) |

**Secrets Manager for RDS**:

```yaml
DBSecret:
  Type: AWS::SecretsManager::Secret
  Properties:
    Name: !Sub '${AWS::StackName}-db-password'
    GenerateSecretString:
      SecretStringTemplate: '{"username": "dbadmin"}'
      GenerateStringKey: password
      PasswordLength: 32
      ExcludeCharacters: '"@/\'

RDSInstance:
  Type: AWS::RDS::DBInstance
  Properties:
    MasterUsername: !Sub '{{resolve:secretsmanager:${DBSecret}:SecretString:username}}'
    MasterUserPassword: !Sub '{{resolve:secretsmanager:${DBSecret}:SecretString:password}}'
    StorageEncrypted: true
    KmsKeyId: !Ref KMSKey
```

> **Agent Rule**: NEVER put database passwords in CloudFormation parameters as plaintext.
> Always use Secrets Manager with dynamic references.

#### Logging and Monitoring

| Control | Implementation | Cost |
|---------|---------------|------|
| CloudWatch Alarms | CPU, memory, disk, 5xx errors, healthy hosts | $0.10/alarm |
| CloudWatch Logs Agent | Application logs to CloudWatch | $0.50/GB ingested |
| VPC Flow Logs (enhanced) | All traffic, longer retention | $0.50/GB ingested |
| AWS Config (basic rules) | Track resource configurations | ~$2-5/mo |

**Recommended CloudWatch Alarms**:

| Alarm | Metric | Threshold | Action |
|-------|--------|-----------|--------|
| High CPU | CPUUtilization | > 80% for 5 min | SNS notification |
| Low Disk | disk_used_percent | > 85% | SNS notification |
| High 5xx | HTTPCode_Target_5XX_Count | > 10 in 5 min | SNS notification |
| Unhealthy Hosts | UnHealthyHostCount | > 0 for 5 min | SNS notification |
| DB CPU | CPUUtilization (RDS) | > 80% for 10 min | SNS notification |
| DB Connections | DatabaseConnections | > 80% of max | SNS notification |
| DB Free Storage | FreeStorageSpace | < 5 GB | SNS notification |

#### Data Protection

| Control | Implementation | Cost |
|---------|---------------|------|
| S3 versioning | Recover from accidental deletion | Storage cost |
| S3 bucket policies | Restrict access to specific roles/accounts | Free |
| RDS automated backups | 14-day retention (recommended) | Free (up to DB size) |
| EBS snapshots | Automated daily via DLM | $0.05/GB-mo |

### Standard Tier Monthly Cost Breakdown

| Component | Monthly Cost |
|-----------|-------------|
| KMS Customer Managed Key (1) | $1.00 |
| Secrets Manager (2 secrets) | $0.80 |
| CloudWatch Alarms (7) | $0.70 |
| CloudWatch Logs (10GB) | $5.00 |
| AWS Config (basic) | $3.00 |
| NAT Gateway (if private subnets) | $32.85 |
| **Total (without NAT GW)** | **~$11** |
| **Total (with NAT GW)** | **~$43** |

> **Agent Note**: NAT Gateway is the largest cost in Standard tier. For cost-sensitive
> deployments, consider a NAT Instance (t3.micro ~$7.59) or VPC endpoints instead.

---

## Tier 3: Enterprise (Compliance-Ready)

**Target**: Regulated industries (healthcare, finance), applications handling PII/PHI,
organizations with compliance requirements (SOC2, HIPAA, PCI-DSS).

**Monthly Cost**: ~$200-3,500 additional (varies significantly with Shield Advanced).

### Security Controls

Everything from Basic and Standard tiers, plus:

#### Network Security (Advanced)

| Control | Implementation | Cost |
|---------|---------------|------|
| WAF (Web Application Firewall) | Application-layer protection on ALB/CloudFront | $5+ ACL + rules |
| AWS Shield Advanced | DDoS protection + DDoS Response Team | $3,000/mo |
| VPC Endpoints (PrivateLink) | Private access to AWS services (no internet) | $7.30/endpoint/AZ |
| Network Firewall | Stateful/stateless network filtering | $0.395/endpoint-hr |
| Multi-AZ NAT Gateways | Redundant outbound internet (2 NAT GWs) | $65.70/mo |

**WAF Configuration (recommended rules)**:

| Rule Set | Purpose | Cost |
|----------|---------|------|
| AWS Managed - Core Rule Set | OWASP Top 10 protection | $0/mo (free managed) |
| AWS Managed - Known Bad Inputs | Block known attack patterns | $0/mo |
| AWS Managed - SQL Injection | SQLi protection | $0/mo |
| AWS Managed - Linux OS | Linux-specific exploits | $0/mo |
| Rate Limiting Rule | DDoS / brute force protection | $1/mo |
| Geo-Restriction Rule | Block traffic from specific countries | $1/mo |
| IP Reputation Rule | Block known malicious IPs | $1/mo |
| Bot Control | Bot management | $10/mo |

**WAF CloudFormation Snippet**:

```yaml
WebACL:
  Type: AWS::WAFv2::WebACL
  Properties:
    DefaultAction:
      Allow: {}
    Scope: REGIONAL
    VisibilityConfig:
      SampledRequestsEnabled: true
      CloudWatchMetricsEnabled: true
      MetricName: WebACL
    Rules:
      - Name: AWSManagedRulesCommonRuleSet
        Priority: 1
        OverrideAction:
          None: {}
        Statement:
          ManagedRuleGroupStatement:
            VendorName: AWS
            Name: AWSManagedRulesCommonRuleSet
        VisibilityConfig:
          SampledRequestsEnabled: true
          CloudWatchMetricsEnabled: true
          MetricName: CommonRuleSet
      - Name: RateLimitRule
        Priority: 2
        Action:
          Block: {}
        Statement:
          RateBasedStatement:
            Limit: 2000
            AggregateKeyType: IP
        VisibilityConfig:
          SampledRequestsEnabled: true
          CloudWatchMetricsEnabled: true
          MetricName: RateLimit
```

#### Identity and Access (Advanced)

| Control | Implementation | Cost |
|---------|---------------|------|
| AWS Organizations | Multi-account governance | Free |
| Service Control Policies (SCPs) | Organization-wide permission guardrails | Free |
| IAM Permission Boundaries | Delegated admin limits | Free |
| AWS SSO / IAM Identity Center | Centralized identity federation | Free |
| Cross-account roles | Controlled access between accounts | Free |

**Recommended SCP Policies**:

| SCP | Purpose |
|-----|---------|
| Deny root usage | Prevent root account API calls |
| Restrict regions | Only allow approved AWS regions |
| Require encryption | Deny creating unencrypted resources |
| Deny public S3 | Prevent public S3 bucket creation |
| Require tagging | Enforce cost allocation tags |
| Deny leaving org | Prevent account removal |

#### Threat Detection and Response

| Control | Implementation | Cost |
|---------|---------------|------|
| Amazon GuardDuty | Intelligent threat detection | $4+/mo |
| AWS Security Hub | Centralized security findings | ~$1+/mo |
| Amazon Detective | Security investigation | $2/million events |
| Amazon Macie | S3 sensitive data discovery | $0.10/bucket + $1/GB |
| CloudTrail Data Events | S3, Lambda, DynamoDB API logging | $0.10/100K events |
| CloudTrail Insights | Anomalous API activity detection | $0.35/100K events |

**GuardDuty Configuration**:

```yaml
GuardDutyDetector:
  Type: AWS::GuardDuty::Detector
  Properties:
    Enable: true
    FindingPublishingFrequency: FIFTEEN_MINUTES
    DataSources:
      S3Logs:
        Enable: true
      Kubernetes:
        AuditLogs:
          Enable: true
      MalwareProtection:
        ScanEc2InstanceWithFindings:
          EbsVolumes: true
```

#### Compliance and Audit

| Control | Implementation | Cost |
|---------|---------------|------|
| AWS Config (advanced) | Conformance packs for compliance frameworks | ~$5-20/mo |
| Config Remediation | Auto-fix non-compliant resources | $0.003/item |
| CloudTrail Organization Trail | All accounts, all regions | $2/100K events |
| S3 Access Logging | Audit trail for bucket access | S3 storage cost |
| RDS Audit Logging | Database query and connection logs | CloudWatch Logs cost |
| Systems Manager Patch Manager | Automated OS patching | Free (SSM cost) |

**AWS Config Conformance Packs**:

| Pack | Framework | Rules |
|------|-----------|-------|
| Operational Best Practices for HIPAA | HIPAA | ~80 rules |
| Operational Best Practices for PCI-DSS | PCI-DSS | ~50 rules |
| Operational Best Practices for CIS | CIS Benchmarks | ~40 rules |
| Operational Best Practices for NIST | NIST 800-53 | ~60 rules |

#### Encryption (Advanced)

| Control | Implementation | Cost |
|---------|---------------|------|
| KMS CMK with rotation | Automatic annual key rotation | $1/key/mo |
| KMS multi-region keys | Cross-region encryption | $1/replica/mo |
| S3 bucket key | Reduced KMS API calls | Free |
| EBS encryption (CMK) | Customer-managed key for volumes | $1/key/mo |
| RDS encryption (CMK) | Customer-managed key for database | Included |
| Secrets Manager rotation | Automatic secret rotation (Lambda) | Lambda cost |

#### Data Protection (Advanced)

| Control | Implementation | Cost |
|---------|---------------|------|
| S3 Object Lock | WORM compliance (immutable backups) | Free |
| S3 replication | Cross-region backup | S3 + transfer cost |
| RDS cross-region snapshots | DR database copies | Snapshot + transfer |
| DynamoDB PITR | Point-in-time recovery | $0.20/GB-mo |
| Backup vault (AWS Backup) | Centralized backup management | Storage cost |

### Enterprise Tier Monthly Cost Breakdown

| Component | Monthly Cost |
|-----------|-------------|
| **Without Shield Advanced** | |
| WAF (Web ACL + 10 rules + 5M requests) | ~$18 |
| GuardDuty (small environment) | ~$10 |
| Security Hub | ~$3 |
| AWS Config (advanced, 20 rules) | ~$15 |
| CloudTrail (data events) | ~$5 |
| Macie (10 buckets) | ~$1 |
| KMS (3 CMKs) | $3 |
| Secrets Manager (5 secrets) | $2 |
| VPC Endpoints (3 endpoints, 2 AZs) | ~$44 |
| Additional CloudWatch Logs | ~$10 |
| **Subtotal (without Shield)** | **~$111** |
| | |
| **With Shield Advanced** | |
| Shield Advanced | $3,000 |
| **Subtotal (with Shield)** | **~$3,111** |

> **Agent Note**: Shield Advanced is only necessary for internet-facing applications
> that are high-value DDoS targets. Most applications do NOT need it. The free
> Shield Standard provides basic DDoS protection. Recommend Shield Advanced only
> when the user explicitly requires it or is in a high-risk industry.

---

## Security Tier Comparison Matrix

| Control | Basic | Standard | Enterprise |
|---------|-------|----------|-----------|
| **Network** | | | |
| Security Groups | Yes | Yes | Yes |
| Private Subnets | No | Yes | Yes |
| NAT Gateway | No | Yes | Yes (Multi-AZ) |
| WAF | No | No | Yes |
| Shield Advanced | No | No | Optional |
| VPC Endpoints | No | No | Yes |
| Network Firewall | No | No | Optional |
| **Identity** | | | |
| IAM Users + MFA | Yes | Yes | Yes |
| IAM Roles (no keys) | No | Yes | Yes |
| Instance Profiles | No | Yes | Yes |
| SSM Session Manager | No | Yes | Yes |
| AWS Organizations | No | No | Yes |
| SCPs | No | No | Yes |
| Permission Boundaries | No | No | Yes |
| **Encryption** | | | |
| S3 SSE-S3 | Yes | Yes | Yes |
| EBS encryption (AWS key) | Yes | Yes | Yes |
| HTTPS (ACM) | Yes | Yes | Yes |
| KMS CMK | No | Yes | Yes |
| Secrets Manager | No | Yes | Yes |
| KMS key rotation | No | No | Yes |
| **Detection** | | | |
| CloudTrail (mgmt events) | Yes | Yes | Yes |
| CloudTrail (data events) | No | No | Yes |
| CloudWatch Alarms | No | Yes (basic) | Yes (comprehensive) |
| GuardDuty | No | No | Yes |
| Security Hub | No | No | Yes |
| Macie | No | No | Yes |
| **Compliance** | | | |
| AWS Config | No | Basic | Advanced + Conformance |
| VPC Flow Logs | Basic | Enhanced | Enhanced |
| S3 versioning | No | Yes | Yes |
| S3 Object Lock | No | No | Optional |
| Patch management | Manual | Manual | SSM Patch Manager |
| **Cost** | $0 | ~$10-43 | ~$111-3,111 |

---

## Security Tier per Architecture Pattern

Recommended security tier for each architecture pattern:

| Pattern | Minimum Tier | Recommended Tier | Notes |
|---------|-------------|-----------------|-------|
| Lite | Basic | Basic | Dev/personal, limited attack surface |
| Standard | Basic | Standard | Production should use Standard+ |
| HA | Standard | Standard | Multi-AZ already implies production |
| Elastic | Standard | Standard/Enterprise | High traffic = higher risk |
| Serverless | Basic | Standard | Lambda has built-in isolation |
| Container | Standard | Standard/Enterprise | EKS needs IAM roles for service accounts |

### Pattern-Specific Security Notes

#### Lite Pattern
- Basic tier is acceptable because there is minimal infrastructure
- Lock down SSH to a single IP; consider using SSM Session Manager instead
- If running a public-facing app, strongly consider upgrading to Standard

#### Standard Pattern
- Standard tier adds private subnet for RDS (critical for database security)
- Secrets Manager for database credentials prevents password leakage
- ALB adds TLS termination and can integrate with WAF if upgraded to Enterprise

#### HA Pattern
- Must use Standard tier at minimum (ASG requires IAM roles)
- Launch Template should pull secrets from Secrets Manager at boot
- CloudWatch alarms are essential for monitoring ASG health

#### Elastic Pattern
- ElastiCache should be in private subnet with dedicated security group
- CloudFront adds an additional security layer (Shield Standard built in)
- Consider Enterprise tier for WAF on CloudFront distribution

#### Serverless Pattern
- Lambda functions have built-in isolation (each invocation is a new container)
- IAM roles per function enforce least privilege
- API Gateway supports WAF integration directly
- DynamoDB encryption at rest is automatic

#### Container Pattern
- EKS requires multiple IAM roles (cluster, node, pod/IRSA)
- Use IRSA (IAM Roles for Service Accounts) for pod-level AWS access
- Network Policies in Kubernetes provide pod-to-pod isolation
- ECR image scanning for vulnerability detection
- Consider enterprise tier for production Kubernetes clusters

---

## Compliance Framework Quick Reference

### SOC 2 Type II Requirements (Mapped to AWS)

| SOC 2 Criteria | AWS Implementation | Min Tier |
|----------------|-------------------|----------|
| Access Control | IAM, MFA, Roles | Standard |
| Encryption | KMS, ACM, S3/EBS encryption | Standard |
| Logging | CloudTrail, CloudWatch | Standard |
| Monitoring | CloudWatch Alarms, GuardDuty | Enterprise |
| Change Management | AWS Config, CloudFormation | Standard |
| Network Security | VPC, Security Groups, NACLs | Standard |
| Incident Response | GuardDuty, Security Hub | Enterprise |

### HIPAA Requirements (Mapped to AWS)

| HIPAA Requirement | AWS Implementation | Min Tier |
|-------------------|-------------------|----------|
| Access Controls (164.312(a)) | IAM Roles, MFA, SCPs | Enterprise |
| Audit Controls (164.312(b)) | CloudTrail, Config, VPC Flow Logs | Enterprise |
| Transmission Security (164.312(e)) | TLS/HTTPS, VPN, PrivateLink | Standard |
| Encryption (164.312(a)(2)(iv)) | KMS CMK, EBS/S3/RDS encryption | Standard |
| Integrity (164.312(c)) | S3 versioning, CloudTrail integrity | Standard |
| PHI Access Logging | CloudTrail data events, RDS audit | Enterprise |

> **Agent Note**: HIPAA compliance requires a Business Associate Agreement (BAA) with AWS.
> The user must sign this through the AWS console before deploying HIPAA workloads.
> Not all AWS services are HIPAA-eligible. Check the AWS HIPAA Eligible Services list.

### PCI-DSS Requirements (Mapped to AWS)

| PCI-DSS Requirement | AWS Implementation | Min Tier |
|---------------------|-------------------|----------|
| Firewall (Req 1) | Security Groups, NACLs, WAF | Enterprise |
| No defaults (Req 2) | Custom AMIs, hardened configs | Standard |
| Protect stored data (Req 3) | KMS, S3/EBS/RDS encryption | Standard |
| Encrypt transmission (Req 4) | TLS, ACM, PrivateLink | Standard |
| Anti-virus (Req 5) | Amazon Inspector, GuardDuty | Enterprise |
| Secure systems (Req 6) | SSM Patch Manager, Config | Enterprise |
| Restrict access (Req 7) | IAM, least privilege | Standard |
| Authentication (Req 8) | MFA, IAM policies, SCPs | Enterprise |
| Physical security (Req 9) | AWS managed (shared responsibility) | N/A |
| Logging (Req 10) | CloudTrail, CloudWatch, VPC Flow | Enterprise |
| Test security (Req 11) | Inspector, Security Hub, pen testing | Enterprise |
| Security policy (Req 12) | AWS Organizations, SCPs | Enterprise |

---

## Security Hardening Checklist

The agent should verify these items when deploying any tier:

### Always (All Tiers)

- [ ] Root account has MFA enabled
- [ ] SSH restricted to specific IP (never 0.0.0.0/0)
- [ ] S3 Block Public Access enabled at account level
- [ ] EBS default encryption enabled in region
- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] Security groups use least-privilege inbound rules
- [ ] No hardcoded credentials in CloudFormation templates
- [ ] CloudTrail enabled (at least 1 trail)

### Standard Tier and Above

- [ ] Database in private subnet
- [ ] Database credentials in Secrets Manager
- [ ] IAM roles used instead of access keys on EC2
- [ ] KMS CMK for sensitive data encryption
- [ ] CloudWatch alarms for critical metrics
- [ ] VPC Flow Logs enabled
- [ ] AWS Config tracking resource changes
- [ ] S3 versioning on important buckets

### Enterprise Tier

- [ ] WAF attached to ALB/CloudFront
- [ ] GuardDuty enabled in all regions
- [ ] Security Hub aggregating findings
- [ ] CloudTrail data events enabled
- [ ] AWS Config conformance packs deployed
- [ ] VPC Endpoints for AWS services (no internet traversal)
- [ ] Systems Manager Patch Manager configured
- [ ] Cross-region backups configured
- [ ] Incident response runbook documented
