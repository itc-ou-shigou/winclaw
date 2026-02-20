# Phase 7: Azure Deployment Reference

## Overview

Phase 7 deploys the application to Azure using a separated architecture:

- **Frontend**: Azure Static Web Apps (FREE tier)
- **Backend**: Azure App Service (Container)

## Required Azure Environment Variables

| Variable                 | Description                      |
| ------------------------ | -------------------------------- |
| `AZURE_TENANT_ID`        | Azure AD tenant ID               |
| `AZURE_CLIENT_ID`        | Service principal client ID      |
| `AZURE_CLIENT_SECRET`    | Service principal secret         |
| `AZURE_SUBSCRIPTION_ID`  | Azure subscription ID            |
| `AZURE_RESOURCE_GROUP`   | Resource group name              |
| `AZURE_LOCATION`         | Azure region (e.g., `japaneast`) |
| `AZURE_APP_SERVICE_PLAN` | App Service plan name            |
| `AZURE_ACR_NAME`         | Azure Container Registry name    |

## Execution

```bash
# Check for Azure credentials
if [ -z "$AZURE_TENANT_ID" ] || [ -z "$AZURE_CLIENT_ID" ]; then
  echo "Azure credentials not configured. Skipping Phase 7."
  echo "To enable: set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID in env"
else
  bash pty:true workdir:$AIDEV_WORKSPACE timeout:3600 command:"cat .claude/prompts/phase7-azure-deploy-v2.md | claude --dangerously-skip-permissions"
fi
```

## Deployment Flow

1. **Backend Deploy** (App Service):
   - Generate backend-only Dockerfile
   - Build container image
   - Push to Azure Container Registry (ACR)
   - Deploy container to App Service
   - Configure environment variables (DATABASE_URL, CORS)

2. **Frontend Deploy** (Static Web Apps):
   - Generate `staticwebapp.config.json`
   - Set `NEXT_PUBLIC_API_URL` to backend URL
   - Build frontend (`npm run build`)
   - Deploy to SWA (FREE tier)

3. **Integration Test**:
   - Verify API proxy
   - Test authentication flow
   - E2E validation

## Skip Conditions

- Azure credentials not set → Skip entirely
- User explicitly declines deployment → Skip
- `SKIP_PHASE_7=true` → Skip

## Naming Convention

```
Backend: be-{workspace_id}
Frontend: app-{workspace_id}-fe
```

## Phase 7 is OPTIONAL

For local-only development, Phase 7 can be skipped entirely. The skill should ask the user before proceeding with deployment.
