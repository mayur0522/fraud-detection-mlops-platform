# Azure Resources Credentials Guide

> **Shadow Hubble - Fraud Detection MLOps Platform**
> Complete reference for Azure resource credentials: What, Where, Why, and How

---

## Quick Reference: All Azure Resources

| # | Azure Resource | Credential Type | Required |
|---|----------------|-----------------|----------|
| 1 | Azure Subscription | Subscription ID, Tenant ID | ✅ |
| 2 | Service Principal | Client ID, Client Secret | ✅ |
| 3 | Azure PostgreSQL Flexible Server | Connection String, Host, User, Password | ✅ |
| 4 | Azure Cache for Redis | Connection String, Access Key | ✅ |
| 5 | Azure Blob Storage | Connection String, Account Key | ✅ |
| 6 | Azure Service Bus | Connection String, SAS Key | ✅ |
| 7 | Azure Key Vault | Vault URI | ✅ |
| 8 | Azure AD B2C | Tenant ID, Client ID, Client Secret | ✅ |
| 9 | Azure Container Registry | Login Server, Username, Password | ✅ |
| 10 | Azure Container Apps | Environment Name | ✅ |
| 11 | Azure Application Insights | Connection String, Instrumentation Key | ✅ |
| 12 | Azure Event Hubs | Connection String (Optional) | ⬜ |

---

## 1. Azure Subscription & Tenant

### What are these credentials?

| Credential | Description | Example Format |
|------------|-------------|----------------|
| `AZURE_SUBSCRIPTION_ID` | Unique identifier for your Azure subscription | `12345678-abcd-1234-efgh-123456789abc` |
| `AZURE_TENANT_ID` | Azure Active Directory tenant identifier | `87654321-dcba-4321-hgfe-987654321cba` |

### Where to find them

```
Azure Portal → Search "Subscriptions" → Select your subscription
├── Subscription ID: Shown on Overview page
└── Tenant ID: Azure Portal → Azure Active Directory → Overview
```

![Portal Path](https://portal.azure.com)

### Why needed

| Purpose | Description |
|---------|-------------|
| **Resource Authorization** | All Azure API calls require subscription context |
| **Tenant Isolation** | Ensures access only to your organization's resources |
| **Billing Boundary** | Tracks costs for the fraud detection platform |

### How used in pipeline

```mermaid
flowchart LR
    A[Subscription ID] --> B[Terraform IaC]
    A --> C[Azure SDK Calls]
    A --> D[CI/CD Pipelines]
    E[Tenant ID] --> F[Authentication]
    E --> G[Service Principal Login]
```

| Pipeline Stage | Usage |
|----------------|-------|
| **Infrastructure** | Terraform deploys all resources to this subscription |
| **Deployment** | Container Apps, databases provisioned here |
| **Authentication** | All Azure SDK calls require subscription context |

---

## 2. Service Principal (App Registration)

### What are these credentials?

| Credential | Description | Example Format |
|------------|-------------|----------------|
| `AZURE_CLIENT_ID` | Application (client) ID of the service principal | `abcd1234-5678-efgh-ijkl-9876543210mn` |
| `AZURE_CLIENT_SECRET` | Client secret (password) for the app | `abc~1234567890abcdefghijklmnop` |

### Where to find them

```
Azure Portal → Azure Active Directory → App registrations → New registration
├── Create app: "shadow-hubble-sp"
├── Client ID: Overview → Application (client) ID
└── Client Secret: Certificates & secrets → New client secret
```

**Role Assignment:**
```
Azure Portal → Subscriptions → [Your Subscription] → Access control (IAM)
└── Add role assignment → Contributor → Select your service principal
```

### Why needed

| Purpose | Description |
|---------|-------------|
| **Automated Authentication** | Allows scripts/apps to authenticate without user login |
| **CI/CD Access** | GitHub Actions uses this to deploy to Azure |
| **Terraform Execution** | IaC needs non-interactive Azure access |

### How used in pipeline

| Pipeline Stage | Component | Usage |
|----------------|-----------|-------|
| **CI/CD** | GitHub Actions | Authenticates to push images, deploy apps |
| **Infrastructure** | Terraform | Creates/modifies Azure resources |
| **Backend** | FastAPI | Azure SDK operations (Blob, Key Vault) |
| **ML Training** | Azure ML SDK | Creates compute, submits experiments |

> [!IMPORTANT]
> Store `AZURE_CLIENT_SECRET` in Azure Key Vault or GitHub Secrets. **Never commit to code.**

---

## 3. Azure PostgreSQL Flexible Server

### What are these credentials?

| Credential | Description | Example |
|------------|-------------|---------|
| `DATABASE_URL` | Full connection string | See below |
| `DB_HOST` | Server hostname | `shadow-hubble-db.postgres.database.azure.com` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `fraud_detection` |
| `DB_USER` | Admin username | `fraudadmin` |
| `DB_PASSWORD` | Admin password | Your secure password |

**Full Connection String Format:**
```
postgresql+asyncpg://fraudadmin:YourPassword@shadow-hubble-db.postgres.database.azure.com:5432/fraud_detection?ssl=require
```

### Where to find them

```
Azure Portal → Azure Database for PostgreSQL flexible servers → Create
├── Server name: shadow-hubble-db
├── Admin username: Set during creation
├── Admin password: Set during creation
└── Connection strings: Settings → Connection strings
```

### Why needed

| Purpose | Description |
|---------|-------------|
| **Persistent Storage** | Stores all application data |
| **Transaction Records** | Historical transaction data for training |
| **Model Metadata** | Model versions, experiments, metrics |
| **User Management** | RBAC users, roles, permissions |
| **Audit Logs** | Security and compliance records |

### How used in pipeline

| Pipeline Stage | Usage |
|----------------|-------|
| **Data Ingestion** | Store incoming transaction data |
| **Feature Engineering** | Query historical data for feature calculation |
| **Model Registry** | Store model metadata, versions, performance metrics |
| **Inference** | Lookup user history for real-time features |
| **Monitoring** | Store drift metrics, alerts, audit logs |

```mermaid
flowchart TB
    subgraph "Data Flow"
        A[Transaction API] -->|INSERT| B[(PostgreSQL)]
        B -->|SELECT| C[Feature Engineering]
        C -->|Training Data| D[Model Training]
        B -->|Lookup| E[Real-time Inference]
        F[Monitoring] -->|INSERT| B
    end
```

---

## 4. Azure Cache for Redis

### What are these credentials?

| Credential | Description | Example |
|------------|-------------|---------|
| `REDIS_URL` | Full Redis connection URL | `rediss://:accesskey@hostname:6380/0` |
| `REDIS_HOST` | Redis hostname | `shadow-hubble-cache.redis.cache.windows.net` |
| `REDIS_PORT` | Redis SSL port | `6380` (SSL) or `6379` (non-SSL) |
| `REDIS_PASSWORD` | Primary access key | Your access key |

**Full Connection String Format:**
```
rediss://:YourPrimaryAccessKey@shadow-hubble-cache.redis.cache.windows.net:6380/0
```

### Where to find them

```
Azure Portal → Azure Cache for Redis → Create
├── DNS name: shadow-hubble-cache.redis.cache.windows.net
├── Port: 6380 (SSL)
└── Access Keys: Settings → Access keys → Primary
```

### Why needed

| Purpose | Description |
|---------|-------------|
| **Caching** | Cache frequently accessed data (user profiles, features) |
| **Session Storage** | Store user sessions for FastAPI |
| **Celery Broker** | Message broker for async task queue |
| **Rate Limiting** | Track API request counts per user |
| **Feature Store** | Online feature storage for low-latency inference |

### How used in pipeline

| Pipeline Stage | Usage |
|----------------|-------|
| **Inference** | Cache user velocity features (last N transactions) |
| **Async Jobs** | Celery broker for background tasks |
| **API Layer** | Rate limiting, session caching |
| **Feature Store** | Real-time feature lookups (<10ms) |

```python
# Example: Feature caching for inference
async def get_user_features(user_id: str, redis: Redis):
    cached = await redis.get(f"features:{user_id}")
    if cached:
        return json.loads(cached)  # Cache hit: <1ms
    # Cache miss: compute from database
    features = await compute_features(user_id)
    await redis.setex(f"features:{user_id}", 300, json.dumps(features))
    return features
```

---

## 5. Azure Blob Storage

### What are these credentials?

| Credential | Description | Example |
|------------|-------------|---------|
| `AZURE_STORAGE_CONNECTION_STRING` | Full connection string | See below |
| `AZURE_STORAGE_ACCOUNT_NAME` | Storage account name | `shadowhubblestore` |
| `AZURE_STORAGE_ACCOUNT_KEY` | Primary access key | Your access key |

**Full Connection String Format:**
```
DefaultEndpointsProtocol=https;AccountName=shadowhubblestore;AccountKey=YourKey;EndpointSuffix=core.windows.net
```

**Container Environment Variables:**
```bash
AZURE_STORAGE_CONTAINER_DATASETS=datasets
AZURE_STORAGE_CONTAINER_MODELS=models
AZURE_STORAGE_CONTAINER_LOGS=audit-logs
```

### Where to find them

```
Azure Portal → Storage accounts → Create
├── Storage account name: shadowhubblestore
├── Access keys: Security + networking → Access keys
└── Create containers:
    ├── datasets (for training data)
    ├── models (for model artifacts)
    └── audit-logs (for compliance)
```

### Why needed

| Purpose | Description |
|---------|-------------|
| **Dataset Storage** | Store large CSV/Parquet training datasets |
| **Model Artifacts** | Store trained model files (.onnx, .pkl) |
| **MLflow Artifacts** | Backend storage for MLflow experiment tracking |
| **Audit Logs** | Long-term storage for compliance |
| **Terraform State** | Remote state storage for IaC |

### How used in pipeline

| Pipeline Stage | Container | Usage |
|----------------|-----------|-------|
| **Data Ingestion** | `datasets` | Upload raw transaction CSVs |
| **Feature Engineering** | `datasets` | Store processed feature datasets |
| **Model Training** | `models` | Save trained model artifacts |
| **Model Registry** | `models` | Version and store production models |
| **Inference** | `models` | Load ONNX models for serving |
| **Audit** | `audit-logs` | Store compliance records |

```mermaid
flowchart LR
    subgraph "Blob Storage Containers"
        A[datasets/] --> B[raw/transactions.csv]
        A --> C[processed/features.parquet]
        D[models/] --> E[v1.0/model.onnx]
        D --> F[v1.1/model.onnx]
        G[audit-logs/] --> H[2026/01/predictions.json]
    end
```

---

## 6. Azure Service Bus

### What are these credentials?

| Credential | Description | Example |
|------------|-------------|---------|
| `AZURE_SERVICEBUS_CONNECTION_STRING` | Full connection string | See below |
| `AZURE_SERVICEBUS_QUEUE_NAME` | Queue name | `fraud-detection-jobs` |
| `AZURE_SERVICEBUS_TOPIC_NAME` | Topic name (optional) | `model-events` |

**Full Connection String Format:**
```
Endpoint=sb://shadow-hubble-bus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=YourKey
```

### Where to find them

```
Azure Portal → Service Bus → Create namespace
├── Namespace: shadow-hubble-bus
├── Connection string: Settings → Shared access policies → RootManageSharedAccessKey
└── Create queue: Entities → Queues → Add
    └── Name: fraud-detection-jobs
```

### Why needed

| Purpose | Description |
|---------|-------------|
| **Async Processing** | Queue long-running ML tasks |
| **Event Broadcasting** | Publish model training/deployment events |
| **Decoupling** | Separate API from training workloads |
| **Reliability** | Guaranteed message delivery with retries |

### How used in pipeline

| Pipeline Stage | Usage |
|----------------|-------|
| **Batch Inference** | Queue large batches of transactions |
| **Model Training** | Trigger training jobs asynchronously |
| **Retraining** | Queue auto-retraining when drift detected |
| **Notifications** | Broadcast alerts to subscribers |

```mermaid
flowchart LR
    A[API] -->|Enqueue| B[Service Bus Queue]
    B -->|Dequeue| C[Celery Worker]
    C -->|Process| D[Model Training]
    D -->|Publish| E[Service Bus Topic]
    E -->|Subscribe| F[Monitoring]
    E -->|Subscribe| G[Notifications]
```

---

## 7. Azure Key Vault

### What are these credentials?

| Credential | Description | Example |
|------------|-------------|---------|
| `AZURE_KEY_VAULT_NAME` | Key Vault name | `shadow-hubble-kv` |
| `AZURE_KEY_VAULT_URI` | Key Vault URI | `https://shadow-hubble-kv.vault.azure.net/` |

### Where to find them

```
Azure Portal → Key vaults → Create
├── Key vault name: shadow-hubble-kv
├── URI: Overview → Vault URI
└── Grant access: Access policies → Add Access Policy
    └── Select service principal → Grant Get, List for secrets
```

### Why needed

| Purpose | Description |
|---------|-------------|
| **Secret Management** | Centralized storage for all sensitive credentials |
| **Rotation** | Easy secret rotation without code changes |
| **Audit** | Track all secret access for compliance |
| **Security** | RBAC-controlled access to secrets |

### How used in pipeline

| Pipeline Stage | Usage |
|----------------|-------|
| **All Stages** | Load secrets at runtime instead of .env files |
| **Backend** | Retrieve database passwords, API keys |
| **CI/CD** | GitHub Actions fetches deploy credentials |
| **Terraform** | Securely pass secrets to infrastructure |

```python
# Example: Loading secrets from Key Vault
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

credential = DefaultAzureCredential()
client = SecretClient(
    vault_url="https://shadow-hubble-kv.vault.azure.net/",
    credential=credential
)

# Retrieve at runtime - no hardcoded secrets!
DATABASE_URL = client.get_secret("database-url").value
STRIPE_SECRET = client.get_secret("stripe-secret-key").value
```

> [!TIP]
> In production, use **Managed Identity** instead of service principal secrets for Key Vault access.

---

## 8. Azure AD B2C

### What are these credentials?

| Credential | Description | Example |
|------------|-------------|---------|
| `AZURE_AD_B2C_TENANT_NAME` | B2C tenant name | `shadowhubble` |
| `AZURE_AD_B2C_TENANT_ID` | B2C tenant ID | GUID |
| `AZURE_AD_B2C_CLIENT_ID` | Application client ID | GUID |
| `AZURE_AD_B2C_CLIENT_SECRET` | Application secret | Secret string |
| `AZURE_AD_B2C_POLICY_SIGNIN` | Sign-in policy | `B2C_1_SignIn` |

### Where to find them

```
Azure Portal → Azure AD B2C → Create tenant
├── Tenant name: shadowhubble.onmicrosoft.com
├── App registrations → New registration
│   ├── Name: shadow-hubble-app
│   ├── Client ID: Overview → Application ID
│   └── Client Secret: Certificates & secrets → New secret
└── User flows → New user flow
    ├── Sign in: B2C_1_SignIn
    └── Sign up: B2C_1_SignUp
```

### Why needed

| Purpose | Description |
|---------|-------------|
| **User Authentication** | SSO login for analysts, ML engineers |
| **RBAC Foundation** | Provides user identity for role mapping |
| **Security** | Enterprise-grade auth with MFA support |
| **Audit Trail** | Track who accessed what and when |

### How used in pipeline

| Pipeline Stage | Usage |
|----------------|-------|
| **Frontend** | User login/logout flows |
| **API Layer** | JWT token validation on all endpoints |
| **RBAC** | Map B2C users to platform roles |
| **Audit** | Log user actions with identity context |

```mermaid
flowchart LR
    A[User] -->|Login| B[React Frontend]
    B -->|OAuth2| C[Azure AD B2C]
    C -->|JWT Token| B
    B -->|Bearer Token| D[FastAPI Backend]
    D -->|Validate| C
    D -->|Map to Role| E[RBAC Check]
```

---

## 9. Azure Container Registry (ACR)

### What are these credentials?

| Credential | Description | Example |
|------------|-------------|---------|
| `AZURE_CONTAINER_REGISTRY` | ACR login server | `shadowhubbleacr.azurecr.io` |
| `AZURE_ACR_USERNAME` | Admin username | `shadowhubbleacr` |
| `AZURE_ACR_PASSWORD` | Admin password | Your password |

### Where to find them

```
Azure Portal → Container registries → Create
├── Registry name: shadowhubbleacr
├── Login server: Overview → Login server
└── Access keys: Settings → Access keys
    ├── Enable Admin user: Yes
    ├── Username: shadowhubbleacr
    └── Password: Primary/Secondary password
```

### Why needed

| Purpose | Description |
|---------|-------------|
| **Image Repository** | Store Docker images for backend and workers |
| **Version Control** | Tag and version container images |
| **Security** | Private registry with access control |
| **CI/CD Integration** | GitHub Actions pushes images here |

### How used in pipeline

| Pipeline Stage | Usage |
|----------------|-------|
| **CI/CD** | Build and push Docker images |
| **Deployment** | Container Apps pulls images from ACR |
| **Versioning** | Tag images by git commit, version |

```bash
# CI/CD workflow example
docker build -t shadowhubbleacr.azurecr.io/backend:v1.0.0 .
docker push shadowhubbleacr.azurecr.io/backend:v1.0.0
```

---

## 10. Azure Container Apps

### What are these credentials?

| Credential | Description | Example |
|------------|-------------|---------|
| `AZURE_CONTAINER_APP_NAME` | App name | `shadow-hubble-api` |
| `AZURE_CONTAINER_ENV_NAME` | Environment name | `shadow-hubble-env` |

### Where to find them

```
Azure Portal → Container Apps → Create
├── Container Apps Environment: shadow-hubble-env
├── Container App: shadow-hubble-api
└── Configure container: Select ACR image
```

### Why needed

| Purpose | Description |
|---------|-------------|
| **API Hosting** | Run FastAPI backend containers |
| **Worker Hosting** | Run Celery worker containers |
| **Auto-scaling** | Scale based on request volume |
| **Cost Efficiency** | Pay-per-use serverless containers |

### How used in pipeline

| Pipeline Stage | Container App |
|----------------|---------------|
| **Inference API** | `shadow-hubble-api` - serves prediction endpoints |
| **Background Jobs** | `shadow-hubble-worker` - runs Celery tasks |
| **Frontend** | `shadow-hubble-ui` - serves React app |

---

## 11. Azure Application Insights

### What are these credentials?

| Credential | Description | Example |
|------------|-------------|---------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Connection string | Full connection string |
| `APPINSIGHTS_INSTRUMENTATIONKEY` | Instrumentation key (legacy) | GUID |

### Where to find them

```
Azure Portal → Application Insights → Create
├── Name: shadow-hubble-insights
├── Connection string: Overview → Connection String (copy full string)
└── Instrumentation key: Overview → Instrumentation Key
```

**Full Connection String Format:**
```
InstrumentationKey=your-key;IngestionEndpoint=https://eastus-1.in.applicationinsights.azure.com/
```

### Why needed

| Purpose | Description |
|---------|-------------|
| **APM** | Application performance monitoring |
| **Logging** | Centralized log aggregation |
| **Metrics** | Request latency, error rates, throughput |
| **Alerts** | Trigger alerts on anomalies |
| **Tracing** | Distributed tracing across services |

### How used in pipeline

| Pipeline Stage | Metrics Tracked |
|----------------|-----------------|
| **Inference** | Prediction latency, error rates |
| **Training** | Training duration, memory usage |
| **API** | Request/response times, status codes |
| **Monitoring** | Drift detection runs, alert triggers |

---

## 12. Azure Event Hubs (Optional)

### What are these credentials?

| Credential | Description | Example |
|------------|-------------|---------|
| `EVENTHUB_CONNECTION_STRING` | Full connection string | See below |
| `EVENTHUB_NAME` | Event Hub name | `transactions` |

### Where to find them

```
Azure Portal → Event Hubs → Create namespace
├── Namespace: shadow-hubble-events
├── Event Hub: transactions
└── Connection string: Shared access policies → RootManageSharedAccessKey
```

### Why needed (Optional)

| Purpose | Description |
|---------|-------------|
| **Real-time Streaming** | Ingest high-volume transaction streams |
| **Kafka Compatible** | Works with existing Kafka clients |
| **Scalability** | Handle millions of events/second |

### How used in pipeline

| Pipeline Stage | Usage |
|----------------|-------|
| **Data Ingestion** | Stream transactions from payment systems |
| **Real-time Inference** | Process transactions as they arrive |

---

## Summary: Credential Acquisition Checklist

Use this checklist when setting up the platform:

### Azure Portal Setup Order

```
1. [ ] Create Resource Group: shadow-hubble-rg
2. [ ] Create Service Principal in Azure AD
   └── Grant Contributor role on subscription
3. [ ] Create Key Vault: shadow-hubble-kv
   └── Grant service principal access
4. [ ] Create PostgreSQL Flexible Server
   └── Store connection string in Key Vault
5. [ ] Create Redis Cache
   └── Store access key in Key Vault
6. [ ] Create Storage Account
   └── Create containers: datasets, models, audit-logs
   └── Store connection string in Key Vault
7. [ ] Create Service Bus Namespace
   └── Create queue: fraud-detection-jobs
8. [ ] Create Azure AD B2C Tenant
   └── Register application
   └── Create user flows
9. [ ] Create Container Registry
   └── Enable admin user
10. [ ] Create Application Insights
11. [ ] Create Container Apps Environment
12. [ ] (Optional) Create Event Hub Namespace
```

### Store These in Key Vault

| Secret Name | Source |
|-------------|--------|
| `database-url` | PostgreSQL connection string |
| `redis-connection` | Redis access key |
| `storage-connection` | Blob Storage connection string |
| `servicebus-connection` | Service Bus connection string |
| `b2c-client-secret` | Azure AD B2C app secret |
| `acr-password` | Container Registry password |
| `jwt-secret` | Generated 32-char random string |

---

## Next Steps

1. **Follow the checklist** to create each Azure resource
2. **Store all secrets** in Azure Key Vault immediately after creation
3. **Configure GitHub Secrets** for CI/CD with service principal credentials
4. **Test connectivity** from local development environment
5. **Review the full environment prerequisites report** for all environment variables

---

*Guide Generated: January 21, 2026*
*Shadow Hubble - Fraud Detection MLOps Platform*
