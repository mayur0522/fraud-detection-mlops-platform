# Deployment Guide

## Prerequisites

- Azure subscription with Owner access
- Terraform >= 1.0
- Azure CLI >= 2.40
- Docker Desktop

## Infrastructure Deployment

### 1. Azure Login

```bash
az login
az account set --subscription "your-subscription-id"
```

### 2. Create Terraform State Storage

```bash
# Create resource group for state
az group create --name shadowhubble-tfstate --location "East US"

# Create storage account
az storage account create \
  --name shadowhubbletfstate \
  --resource-group shadowhubble-tfstate \
  --sku Standard_LRS

# Create container
az storage container create \
  --name tfstate \
  --account-name shadowhubbletfstate
```

### 3. Deploy Infrastructure

```bash
cd infrastructure/terraform

# Initialize
terraform init

# Plan
terraform plan -var="environment=prod" -out=tfplan

# Apply
terraform apply tfplan
```

### 4. Configure Azure AD B2C

1. Create B2C tenant at `your-tenant.onmicrosoft.com`
2. Register application
3. Configure user flows (Sign up/Sign in)
4. Update environment variables

### 5. Build and Push Container Images

```bash
# Create ACR
az acr create --name shadowhubble --resource-group shadowhubble-prod-rg --sku Standard

# Login
az acr login --name shadowhubble

# Build and push
docker build -t shadowhubble.azurecr.io/shadowhubble-api:latest ./backend
docker push shadowhubble.azurecr.io/shadowhubble-api:latest

docker build -t shadowhubble.azurecr.io/shadowhubble-ui:latest ./frontend
docker push shadowhubble.azurecr.io/shadowhubble-ui:latest

docker build -t shadowhubble.azurecr.io/shadowhubble-worker:latest -f backend/Dockerfile.worker ./backend
docker push shadowhubble.azurecr.io/shadowhubble-worker:latest
```

## Environment Variables

### Backend

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection (from Key Vault) |
| `REDIS_URL` | Redis connection |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob storage access |
| `AZURE_KEYVAULT_URI` | Key Vault URI |
| `AZURE_B2C_TENANT_NAME` | B2C tenant name |
| `AZURE_B2C_CLIENT_ID` | B2C application ID |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL |
| `VITE_B2C_CLIENT_ID` | B2C client ID |
| `VITE_B2C_AUTHORITY` | B2C authority URL |

## Monitoring

### Application Insights

Terraform automatically provisions:
- Application Insights instance
- Log Analytics workspace  
- Alert rules for CPU, latency, errors

### Dashboards

Access monitoring at:
- Azure Portal > Application Insights
- Container Apps > Monitoring

## Scaling

### Container Apps Auto-scaling

Configured in Terraform:
- API: 1-10 replicas (100 concurrent requests trigger)
- Worker: 1-5 replicas
- UI: 1-5 replicas

### Database Scaling

PostgreSQL Flexible Server:
- Current: GP_Standard_D2s_v3 (2 vCPU, 8GB RAM)
- Scale via Azure Portal or Terraform

## Backup & Recovery

### Database

- Automated backups: 7-day retention
- Point-in-time restore supported
- Geo-redundant backup available

### Blob Storage

- Versioning enabled
- Soft delete: 7 days
- Lifecycle management for logs

## Security Checklist

- [ ] Enable Azure Defender
- [ ] Configure WAF on Application Gateway
- [ ] Enable network policies between subnets
- [ ] Rotate secrets quarterly
- [ ] Enable audit logging to Log Analytics
- [ ] Configure IP restrictions for admin endpoints
