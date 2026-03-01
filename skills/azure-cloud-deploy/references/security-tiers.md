# Azure Security Tiers

## Basic (Free)

- **Network Security Groups (NSG)**: IP-based firewall rules
- **Azure AD Authentication**: Standard sign-in
- **HTTPS**: App Service managed certificate (free)
- **Managed Disks**: Encryption at rest (default)
- **Cost**: $0 additional

## Standard (Recommended)

Everything in Basic, plus:

- **Managed Identity**: Passwordless auth to Azure services
- **Key Vault (free tier)**: Secret management
- **Azure Monitor**: Basic metrics and alerts
- **Diagnostic Logs**: Application and infrastructure logging
- **Network Isolation**: Private endpoints for database
- **Cost**: $0 additional (uses free tiers)

## Enterprise

Everything in Standard, plus:

- **Azure WAF**: Web Application Firewall on Application Gateway
- **Azure DDoS Protection**: Standard tier DDoS mitigation (~$2,944/mo)
- **Microsoft Defender for Cloud**: Threat detection ($15/server/mo)
- **Key Vault Premium**: HSM-backed keys
- **Private Link**: All services on private network
- **Azure Policy**: Compliance enforcement
- **Cost**: ~$350+/mo (varies by scale)
