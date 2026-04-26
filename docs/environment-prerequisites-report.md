# Fraud Detection MLOps Platform: Environment Prerequisites Report

> **Shadow Hubble Project** | Comprehensive Environment Configuration & Credentials Guide

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Local Development Environment](#1-local-development-environment)
3. [Data Engineering](#2-data-engineering)
4. [Machine Learning & Model Management](#3-machine-learning--model-management)
5. [Real-time / Batch Inference](#4-real-time--batch-inference)
6. [Deployment & Infrastructure](#5-deployment--infrastructure)
7. [Security & Compliance](#6-security--compliance)
8. [Third-Party Fraud Signal APIs](#7-third-party-fraud-signal-apis)
9. [Best Practices](#8-best-practices)
10. [Quick Reference: Complete .env Template](#9-complete-env-template)

---

## Executive Summary

This report provides a comprehensive analysis of all environment variables, API keys, secrets, and credentials required for an end-to-end fraud detection MLOps platform. Based on the Shadow Hubble project architecture using:

| Component | Technology |
|-----------|------------|
| **Backend** | Python 3.11 + FastAPI |
| **Frontend** | React 18 + TypeScript (Vite) |
| **Cloud** | Microsoft Azure |
| **Database** | Azure PostgreSQL Flexible Server |
| **Cache** | Azure Cache for Redis |
| **Queue** | Azure Service Bus |
| **Storage** | Azure Blob Storage |
| **Auth** | Azure AD B2C + FastAPI OAuth2 |
| **ML** | XGBoost, LightGBM, ONNX, SHAP, Fairlearn |
| **IaC** | Terraform |

---

## 1. Local Development Environment

### 1.1 Application Core Settings

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `APP_NAME` | Application name for logging/identification | ✅ Yes | All components |
| `APP_ENV` | Environment identifier (`development`, `staging`, `production`) | ✅ Yes | Config loading, logging |
| `DEBUG` | Enable debug mode (`true`/`false`) | ✅ Yes | Backend, logging verbosity |
| `LOG_LEVEL` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) | ✅ Yes | All services |
| `SECRET_KEY` | Application secret for JWT/session signing (32+ chars) | ✅ Yes | Authentication, encryption |
| `API_VERSION` | API version prefix (e.g., `v1`) | ⬜ Optional | API routing |

```bash
# Example
APP_NAME=shadow-hubble
APP_ENV=development
DEBUG=true
LOG_LEVEL=DEBUG
SECRET_KEY=your-super-secret-key-minimum-32-characters-long
API_VERSION=v1
```

### 1.2 Backend Server Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `HOST` | Server bind address | ✅ Yes | FastAPI/Uvicorn |
| `PORT` | Server port number | ✅ Yes | FastAPI/Uvicorn |
| `WORKERS` | Number of worker processes | ⬜ Optional | Production deployment |
| `RELOAD` | Enable hot reload (`true`/`false`) | ⬜ Optional | Development only |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | ✅ Yes | Frontend communication |

```bash
# Example
HOST=0.0.0.0
PORT=8000
WORKERS=4
RELOAD=true
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 1.3 Frontend Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `VITE_API_URL` | Backend API base URL | ✅ Yes | API client |
| `VITE_APP_TITLE` | Application title | ⬜ Optional | Browser tab, headers |
| `VITE_AUTH_ENABLED` | Enable authentication UI | ✅ Yes | Login/Auth components |
| `VITE_WEBSOCKET_URL` | WebSocket URL for real-time updates | ⬜ Optional | Real-time notifications |

```bash
# Example
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_TITLE=Shadow Hubble - Fraud Detection
VITE_AUTH_ENABLED=true
VITE_WEBSOCKET_URL=ws://localhost:8000/ws
```

---

## 2. Data Engineering

### 2.1 PostgreSQL Database

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string | ✅ Yes | SQLAlchemy, Alembic |
| `DB_HOST` | Database host address | ✅ Yes | Database connections |
| `DB_PORT` | Database port (default: 5432) | ✅ Yes | Database connections |
| `DB_NAME` | Database name | ✅ Yes | Database connections |
| `DB_USER` | Database username | ✅ Yes | Database connections |
| `DB_PASSWORD` | Database password | ✅ Yes | Database connections |
| `DB_SSL_MODE` | SSL mode (`require`, `disable`, `prefer`) | ⬜ Optional | Production security |
| `DB_POOL_SIZE` | Connection pool size | ⬜ Optional | Performance tuning |
| `DB_MAX_OVERFLOW` | Max connections beyond pool | ⬜ Optional | Performance tuning |

```bash
# Full connection string format
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname?ssl=require

# Or individual variables
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fraud_detection
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_SSL_MODE=require
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=10
```

> [!IMPORTANT]
> For Azure PostgreSQL Flexible Server, always use `ssl=require` in production.

### 2.2 Redis Cache & Message Broker

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `REDIS_URL` | Full Redis connection URL | ✅ Yes | Caching, Celery broker |
| `REDIS_HOST` | Redis host address | ✅ Yes | Cache connections |
| `REDIS_PORT` | Redis port (default: 6379) | ✅ Yes | Cache connections |
| `REDIS_PASSWORD` | Redis authentication password | ✅ Yes | Production access |
| `REDIS_DB` | Redis database number | ⬜ Optional | Multi-tenant separation |
| `REDIS_SSL` | Enable SSL (`true`/`false`) | ⬜ Optional | Azure Cache for Redis |
| `CACHE_TTL_SECONDS` | Default cache TTL | ⬜ Optional | Cache expiration |

```bash
# Azure Cache for Redis
REDIS_URL=rediss://:your-access-key@your-redis.redis.cache.windows.net:6380/0
REDIS_HOST=your-redis.redis.cache.windows.net
REDIS_PORT=6380
REDIS_PASSWORD=your-primary-access-key
REDIS_SSL=true
CACHE_TTL_SECONDS=3600
```

### 2.3 Azure Service Bus (Message Queue)

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AZURE_SERVICEBUS_CONNECTION_STRING` | Full Service Bus connection string | ✅ Yes | Async job processing |
| `AZURE_SERVICEBUS_NAMESPACE` | Service Bus namespace | ⬜ Optional | Alternative auth |
| `AZURE_SERVICEBUS_QUEUE_NAME` | Queue name for fraud checks | ✅ Yes | Celery tasks |
| `AZURE_SERVICEBUS_TOPIC_NAME` | Topic for pub/sub events | ⬜ Optional | Event broadcasting |

```bash
AZURE_SERVICEBUS_CONNECTION_STRING=Endpoint=sb://your-namespace.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=your-key
AZURE_SERVICEBUS_QUEUE_NAME=fraud-detection-jobs
AZURE_SERVICEBUS_TOPIC_NAME=model-events
```

### 2.4 Azure Blob Storage

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AZURE_STORAGE_CONNECTION_STRING` | Full storage connection string | ✅ Yes | File uploads, model storage |
| `AZURE_STORAGE_ACCOUNT_NAME` | Storage account name | ✅ Yes | Blob operations |
| `AZURE_STORAGE_ACCOUNT_KEY` | Storage account key | ✅ Yes | Authentication |
| `AZURE_STORAGE_CONTAINER_DATASETS` | Container for datasets | ✅ Yes | Data ingestion |
| `AZURE_STORAGE_CONTAINER_MODELS` | Container for model artifacts | ✅ Yes | Model registry |
| `AZURE_STORAGE_CONTAINER_LOGS` | Container for log storage | ⬜ Optional | Audit logs |

```bash
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=youraccount;AccountKey=your-key;EndpointSuffix=core.windows.net
AZURE_STORAGE_ACCOUNT_NAME=shadowhubblestore
AZURE_STORAGE_ACCOUNT_KEY=your-storage-account-key
AZURE_STORAGE_CONTAINER_DATASETS=datasets
AZURE_STORAGE_CONTAINER_MODELS=models
AZURE_STORAGE_CONTAINER_LOGS=audit-logs
```

### 2.5 Data Sources & Streaming

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker addresses | ⬜ Optional | Real-time streaming |
| `KAFKA_SECURITY_PROTOCOL` | Security protocol (`SASL_SSL`) | ⬜ Optional | Kafka auth |
| `KAFKA_SASL_MECHANISM` | SASL mechanism (`PLAIN`, `SCRAM-SHA-256`) | ⬜ Optional | Kafka auth |
| `KAFKA_SASL_USERNAME` | Kafka username | ⬜ Optional | Kafka auth |
| `KAFKA_SASL_PASSWORD` | Kafka password | ⬜ Optional | Kafka auth |
| `KAFKA_TOPIC_TRANSACTIONS` | Topic for transaction events | ⬜ Optional | Data ingestion |
| `EVENTHUB_CONNECTION_STRING` | Azure Event Hub connection | ⬜ Optional | Azure streaming |
| `EVENTHUB_NAME` | Event Hub name | ⬜ Optional | Event processing |

```bash
# For Azure Event Hubs (Kafka-compatible)
EVENTHUB_CONNECTION_STRING=Endpoint=sb://your-hub.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=your-key
EVENTHUB_NAME=transactions
KAFKA_TOPIC_TRANSACTIONS=fraud-transactions
```

---

## 3. Machine Learning & Model Management

### 3.1 MLflow Experiment Tracking

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `MLFLOW_TRACKING_URI` | MLflow server URL | ✅ Yes | Experiment tracking |
| `MLFLOW_EXPERIMENT_NAME` | Default experiment name | ✅ Yes | Experiment organization |
| `MLFLOW_ARTIFACT_ROOT` | Artifact storage path | ⬜ Optional | Model artifacts |
| `MLFLOW_S3_ENDPOINT_URL` | S3-compatible endpoint (Blob) | ⬜ Optional | Azure Blob as artifact store |
| `MLFLOW_TRACKING_USERNAME` | MLflow auth username | ⬜ Optional | Secured deployments |
| `MLFLOW_TRACKING_PASSWORD` | MLflow auth password | ⬜ Optional | Secured deployments |

```bash
MLFLOW_TRACKING_URI=https://your-mlflow-server.azurewebsites.net
MLFLOW_EXPERIMENT_NAME=fraud-detection
MLFLOW_ARTIFACT_ROOT=wasbs://models@yourstorage.blob.core.windows.net/mlflow-artifacts
```

### 3.2 Model Training Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `MODEL_REGISTRY_PATH` | Local/remote model storage path | ✅ Yes | Model versioning |
| `DEFAULT_MODEL_TYPE` | Default algo (`xgboost`, `lightgbm`, `rf`) | ⬜ Optional | Training service |
| `TRAINING_DATA_PATH` | Path to training datasets | ✅ Yes | Training pipeline |
| `VALIDATION_SPLIT` | Train/validation split ratio | ⬜ Optional | Model training |
| `HYPEROPT_MAX_EVALS` | Max hyperparameter trials | ⬜ Optional | Hyperparameter tuning |
| `RANDOM_SEED` | Random seed for reproducibility | ⬜ Optional | Training consistency |

```bash
MODEL_REGISTRY_PATH=./models
DEFAULT_MODEL_TYPE=xgboost
TRAINING_DATA_PATH=./data/training
VALIDATION_SPLIT=0.2
HYPEROPT_MAX_EVALS=100
RANDOM_SEED=42
```

### 3.3 Azure Machine Learning (Optional)

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AZURE_ML_SUBSCRIPTION_ID` | Azure subscription ID | ⬜ Optional | Azure ML workspace |
| `AZURE_ML_RESOURCE_GROUP` | Resource group name | ⬜ Optional | Azure ML workspace |
| `AZURE_ML_WORKSPACE_NAME` | ML workspace name | ⬜ Optional | Azure ML workspace |
| `AZURE_ML_TENANT_ID` | Azure AD tenant ID | ⬜ Optional | Service principal auth |
| `AZURE_ML_CLIENT_ID` | Service principal client ID | ⬜ Optional | Automated training |
| `AZURE_ML_CLIENT_SECRET` | Service principal secret | ⬜ Optional | Automated training |

```bash
AZURE_ML_SUBSCRIPTION_ID=your-subscription-id
AZURE_ML_RESOURCE_GROUP=shadow-hubble-ml-rg
AZURE_ML_WORKSPACE_NAME=shadow-hubble-ml
AZURE_ML_TENANT_ID=your-tenant-id
AZURE_ML_CLIENT_ID=your-client-id
AZURE_ML_CLIENT_SECRET=your-client-secret
```

### 3.4 Feature Store Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `FEATURE_STORE_TYPE` | Feature store backend (`redis`, `sql`, `feast`) | ⬜ Optional | Feature engineering |
| `FEAST_REPO_PATH` | Feast feature repo path | ⬜ Optional | Feast integration |
| `FEATURE_CACHE_TTL` | Feature cache duration | ⬜ Optional | Online features |
| `OFFLINE_STORE_TYPE` | Offline store type | ⬜ Optional | Historical features |

```bash
FEATURE_STORE_TYPE=redis
FEATURE_CACHE_TTL=300
```

---

## 4. Real-time / Batch Inference

### 4.1 ONNX Runtime Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `ONNX_MODEL_PATH` | Path to ONNX model files | ✅ Yes | Inference engine |
| `ONNX_EXECUTION_PROVIDER` | Provider (`CPUExecutionProvider`, `CUDAExecutionProvider`) | ⬜ Optional | GPU acceleration |
| `INFERENCE_BATCH_SIZE` | Batch size for batch inference | ⬜ Optional | Batch processing |
| `INFERENCE_TIMEOUT_MS` | Max inference time (milliseconds) | ⬜ Optional | SLA enforcement |
| `MODEL_WARMUP_ENABLED` | Pre-warm models on startup | ⬜ Optional | Cold start mitigation |

```bash
ONNX_MODEL_PATH=./models/onnx
ONNX_EXECUTION_PROVIDER=CPUExecutionProvider
INFERENCE_BATCH_SIZE=32
INFERENCE_TIMEOUT_MS=10
MODEL_WARMUP_ENABLED=true
```

### 4.2 Celery Worker Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `CELERY_BROKER_URL` | Celery broker URL (Redis/RabbitMQ) | ✅ Yes | Async task queue |
| `CELERY_RESULT_BACKEND` | Result backend URL | ✅ Yes | Task results |
| `CELERY_TASK_SERIALIZER` | Serializer (`json`, `pickle`) | ⬜ Optional | Task serialization |
| `CELERY_CONCURRENCY` | Worker concurrency level | ⬜ Optional | Performance tuning |
| `CELERY_TASK_TIME_LIMIT` | Task timeout (seconds) | ⬜ Optional | SLA enforcement |
| `CELERY_BEAT_SCHEDULE_DB` | Beat schedule database | ⬜ Optional | Scheduled jobs |

```bash
CELERY_BROKER_URL=redis://:password@localhost:6379/0
CELERY_RESULT_BACKEND=redis://:password@localhost:6379/1
CELERY_TASK_SERIALIZER=json
CELERY_CONCURRENCY=4
CELERY_TASK_TIME_LIMIT=300
```

### 4.3 A/B Testing Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AB_TEST_ENABLED` | Enable A/B testing | ⬜ Optional | Model comparison |
| `AB_TEST_TRAFFIC_SPLIT` | Traffic split ratio (0.0-1.0) | ⬜ Optional | Champion-challenger |
| `AB_TEST_MIN_SAMPLES` | Min samples before evaluation | ⬜ Optional | Statistical significance |

```bash
AB_TEST_ENABLED=true
AB_TEST_TRAFFIC_SPLIT=0.1
AB_TEST_MIN_SAMPLES=1000
```

---

## 5. Deployment & Infrastructure

### 5.1 Azure Core Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | ✅ Yes | All Azure services |
| `AZURE_TENANT_ID` | Azure AD tenant ID | ✅ Yes | Authentication |
| `AZURE_RESOURCE_GROUP` | Resource group name | ✅ Yes | Resource organization |
| `AZURE_LOCATION` | Azure region (`eastus`, `westeurope`) | ✅ Yes | Resource deployment |
| `AZURE_CLIENT_ID` | Service principal app ID | ✅ Yes | Terraform, CI/CD |
| `AZURE_CLIENT_SECRET` | Service principal secret | ✅ Yes | Terraform, CI/CD |

```bash
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_TENANT_ID=your-tenant-id
AZURE_RESOURCE_GROUP=shadow-hubble-rg
AZURE_LOCATION=eastus
AZURE_CLIENT_ID=your-service-principal-app-id
AZURE_CLIENT_SECRET=your-service-principal-secret
```

### 5.2 Azure Container Apps

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AZURE_CONTAINER_APP_NAME` | Container App name | ✅ Yes | App deployment |
| `AZURE_CONTAINER_ENV_NAME` | Container Apps Environment | ✅ Yes | Container hosting |
| `AZURE_CONTAINER_REGISTRY` | ACR login server | ✅ Yes | Image repository |
| `AZURE_ACR_USERNAME` | ACR admin username | ✅ Yes | Image pulls |
| `AZURE_ACR_PASSWORD` | ACR admin password | ✅ Yes | Image pulls |

```bash
AZURE_CONTAINER_APP_NAME=shadow-hubble-api
AZURE_CONTAINER_ENV_NAME=shadow-hubble-env
AZURE_CONTAINER_REGISTRY=shadowhubbleacr.azurecr.io
AZURE_ACR_USERNAME=shadowhubbleacr
AZURE_ACR_PASSWORD=your-acr-password
```

### 5.3 Azure Key Vault

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AZURE_KEY_VAULT_NAME` | Key Vault name | ✅ Yes | Secret management |
| `AZURE_KEY_VAULT_URI` | Key Vault URI | ✅ Yes | Secret retrieval |
| `KEY_VAULT_MANAGED_IDENTITY` | Use managed identity | ⬜ Optional | Passwordless auth |

```bash
AZURE_KEY_VAULT_NAME=shadow-hubble-kv
AZURE_KEY_VAULT_URI=https://shadow-hubble-kv.vault.azure.net/
KEY_VAULT_MANAGED_IDENTITY=true
```

### 5.4 Terraform Configuration

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `ARM_SUBSCRIPTION_ID` | Azure subscription (for Terraform) | ✅ Yes | IaC deployment |
| `ARM_TENANT_ID` | Azure tenant (for Terraform) | ✅ Yes | IaC deployment |
| `ARM_CLIENT_ID` | Service principal (for Terraform) | ✅ Yes | IaC deployment |
| `ARM_CLIENT_SECRET` | Service principal secret | ✅ Yes | IaC deployment |
| `TF_VAR_environment` | Target environment | ✅ Yes | Environment-specific config |
| `TF_BACKEND_STORAGE_ACCOUNT` | Terraform state storage | ✅ Yes | Remote state |
| `TF_BACKEND_CONTAINER` | State container name | ✅ Yes | Remote state |
| `TF_BACKEND_KEY` | State file name | ✅ Yes | Remote state |

```bash
ARM_SUBSCRIPTION_ID=your-subscription-id
ARM_TENANT_ID=your-tenant-id
ARM_CLIENT_ID=terraform-sp-client-id
ARM_CLIENT_SECRET=terraform-sp-secret
TF_VAR_environment=production
TF_BACKEND_STORAGE_ACCOUNT=shadowhubbleterraform
TF_BACKEND_CONTAINER=tfstate
TF_BACKEND_KEY=prod.terraform.tfstate
```

### 5.5 GitHub Actions CI/CD

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `GITHUB_TOKEN` | GitHub API token | ✅ Yes | CI/CD workflows |
| `DOCKER_REGISTRY` | Docker registry URL | ✅ Yes | Container builds |
| `DOCKER_USERNAME` | Registry username | ✅ Yes | Container pushes |
| `DOCKER_PASSWORD` | Registry password | ✅ Yes | Container pushes |

```bash
# Set as GitHub Secrets, not .env
GITHUB_TOKEN=ghp_your-token
DOCKER_REGISTRY=shadowhubbleacr.azurecr.io
DOCKER_USERNAME=your-username
DOCKER_PASSWORD=your-password
```

---

## 6. Security & Compliance

### 6.1 Azure AD B2C Authentication

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `AZURE_AD_B2C_TENANT_NAME` | B2C tenant name | ✅ Yes | SSO authentication |
| `AZURE_AD_B2C_TENANT_ID` | B2C tenant ID | ✅ Yes | Token validation |
| `AZURE_AD_B2C_CLIENT_ID` | B2C application client ID | ✅ Yes | OAuth2 flow |
| `AZURE_AD_B2C_CLIENT_SECRET` | B2C application secret | ✅ Yes | Backend auth |
| `AZURE_AD_B2C_POLICY_SIGNIN` | Sign-in policy name | ✅ Yes | User sign-in flow |
| `AZURE_AD_B2C_POLICY_SIGNUP` | Sign-up policy name | ⬜ Optional | User registration |
| `AZURE_AD_B2C_POLICY_RESET` | Password reset policy | ⬜ Optional | Password recovery |
| `AZURE_AD_B2C_REDIRECT_URI` | OAuth redirect URI | ✅ Yes | Auth callback |
| `AZURE_AD_B2C_SCOPES` | API scopes | ✅ Yes | Permission grants |

```bash
AZURE_AD_B2C_TENANT_NAME=shadowhubble
AZURE_AD_B2C_TENANT_ID=your-b2c-tenant-id
AZURE_AD_B2C_CLIENT_ID=your-b2c-app-client-id
AZURE_AD_B2C_CLIENT_SECRET=your-b2c-app-secret
AZURE_AD_B2C_POLICY_SIGNIN=B2C_1_SignIn
AZURE_AD_B2C_POLICY_SIGNUP=B2C_1_SignUp
AZURE_AD_B2C_POLICY_RESET=B2C_1_PasswordReset
AZURE_AD_B2C_REDIRECT_URI=http://localhost:3000/auth/callback
AZURE_AD_B2C_SCOPES=openid,profile,email,offline_access
```

### 6.2 JWT & Session Security

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `JWT_SECRET_KEY` | JWT signing secret | ✅ Yes | Token generation |
| `JWT_ALGORITHM` | Signing algorithm (`HS256`, `RS256`) | ✅ Yes | Token signing |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL | ✅ Yes | Token expiry |
| `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | ⬜ Optional | Token refresh |
| `SESSION_SECRET` | Session encryption key | ⬜ Optional | Cookie sessions |

```bash
JWT_SECRET_KEY=your-jwt-secret-minimum-32-characters
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
```

### 6.3 Rate Limiting & Protection

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `RATE_LIMIT_ENABLED` | Enable rate limiting | ⬜ Optional | API protection |
| `RATE_LIMIT_PER_MINUTE` | Requests per minute | ⬜ Optional | DDoS mitigation |
| `RATE_LIMIT_BURST` | Burst allowance | ⬜ Optional | Traffic spikes |
| `TRUSTED_HOSTS` | Allowed hostnames | ⬜ Optional | Host validation |
| `ALLOWED_IPS` | IP whitelist | ⬜ Optional | Access control |

```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=100
RATE_LIMIT_BURST=20
TRUSTED_HOSTS=localhost,api.shadowhubble.com
```

### 6.4 Encryption & Data Protection

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `ENCRYPTION_KEY` | Data encryption key (AES-256) | ✅ Yes | PII encryption |
| `ENCRYPTION_ALGORITHM` | Encryption algorithm | ⬜ Optional | Data protection |
| `HASH_SALT` | Password hashing salt | ⬜ Optional | User passwords |

```bash
ENCRYPTION_KEY=your-32-byte-encryption-key-here
ENCRYPTION_ALGORITHM=AES-256-GCM
```

---

## 7. Third-Party Fraud Signal APIs

### 7.1 IP Intelligence & Geolocation

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `MAXMIND_LICENSE_KEY` | MaxMind GeoIP license | ⬜ Optional | IP geolocation |
| `MAXMIND_ACCOUNT_ID` | MaxMind account ID | ⬜ Optional | IP geolocation |
| `IPINFO_TOKEN` | IPInfo API token | ⬜ Optional | IP intelligence |
| `IP2LOCATION_API_KEY` | IP2Location key | ⬜ Optional | IP lookup |

```bash
MAXMIND_LICENSE_KEY=your-maxmind-license
MAXMIND_ACCOUNT_ID=123456
IPINFO_TOKEN=your-ipinfo-token
```

> **Why needed**: IP geolocation helps detect impossible travel (user in US, then China within 5 minutes), VPN/proxy usage, and high-risk geographic regions.

### 7.2 Device Fingerprinting

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `FINGERPRINTJS_API_KEY` | FingerprintJS Pro API key | ⬜ Optional | Device identification |
| `FINGERPRINTJS_REGION` | API region | ⬜ Optional | FingerprintJS |
| `SEON_API_KEY` | SEON device intelligence | ⬜ Optional | Device fingerprint |
| `CASTLE_API_SECRET` | Castle.io API secret | ⬜ Optional | Device/behavior |
| `SARDINE_API_KEY` | Sardine device intelligence | ⬜ Optional | Device signals |

```bash
FINGERPRINTJS_API_KEY=your-fingerprintjs-key
FINGERPRINTJS_REGION=us
SEON_API_KEY=your-seon-key
```

> **Why needed**: Device fingerprinting identifies repeat fraudsters across sessions, detects bot attacks, and spots device emulation/spoofing.

### 7.3 Email & Identity Verification

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `EMAILAGE_API_KEY` | Emailage (LexisNexis) | ⬜ Optional | Email risk scoring |
| `EMAILAGE_API_SECRET` | Emailage secret | ⬜ Optional | Email verification |
| `HUNTER_API_KEY` | Hunter.io email verify | ⬜ Optional | Email validation |
| `CLEARBIT_API_KEY` | Clearbit enrichment | ⬜ Optional | Identity enrichment |
| `FULLCONTACT_API_KEY` | FullContact enrichment | ⬜ Optional | Identity resolution |
| `EKATA_API_KEY` | Ekata (Mastercard) | ⬜ Optional | Identity verification |

```bash
EMAILAGE_API_KEY=your-emailage-key
EMAILAGE_API_SECRET=your-emailage-secret
HUNTER_API_KEY=your-hunter-key
```

> **Why needed**: Email risk scoring identifies disposable emails, recently created accounts, and emails associated with known fraud.

### 7.4 Phone Verification

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio account SID | ⬜ Optional | Phone verification |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | ⬜ Optional | SMS/voice verification |
| `TWILIO_VERIFY_SERVICE_SID` | Verify service SID | ⬜ Optional | OTP verification |
| `TELESIGN_CUSTOMER_ID` | TeleSign customer ID | ⬜ Optional | Phone intelligence |
| `TELESIGN_API_KEY` | TeleSign API key | ⬜ Optional | Phone risk scoring |

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Why needed**: Phone verification detects VoIP numbers, burner phones, and validates phone carrier details for identity verification.

### 7.5 Payment Gateway & Card Networks

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe API secret key | ⬜ Optional | Payment processing |
| `STRIPE_PUBLISHABLE_KEY` | Stripe public key | ⬜ Optional | Frontend payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | ⬜ Optional | Payment events |
| `STRIPE_RADAR_ENABLED` | Enable Stripe Radar | ⬜ Optional | Built-in fraud |
| `ADYEN_API_KEY` | Adyen API key | ⬜ Optional | Payment processing |
| `ADYEN_MERCHANT_ACCOUNT` | Adyen merchant | ⬜ Optional | Adyen integration |
| `BRAINTREE_MERCHANT_ID` | Braintree merchant ID | ⬜ Optional | PayPal/Braintree |
| `BRAINTREE_PUBLIC_KEY` | Braintree public key | ⬜ Optional | Braintree |
| `BRAINTREE_PRIVATE_KEY` | Braintree private key | ⬜ Optional | Braintree |

```bash
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
```

### 7.6 Fraud-Specific Services

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `SIFT_API_KEY` | Sift Science API key | ⬜ Optional | ML fraud detection |
| `SIFT_ACCOUNT_ID` | Sift account ID | ⬜ Optional | Sift integration |
| `KOUNT_API_KEY` | Kount (Equifax) key | ⬜ Optional | Fraud scoring |
| `KOUNT_MERCHANT_ID` | Kount merchant ID | ⬜ Optional | Kount integration |
| `FORTER_SECRET_KEY` | Forter API secret | ⬜ Optional | Fraud prevention |
| `SOCURE_API_KEY` | Socure ID+ API key | ⬜ Optional | Document verification |
| `JUMIO_API_TOKEN` | Jumio API token | ⬜ Optional | ID document verify |
| `JUMIO_API_SECRET` | Jumio API secret | ⬜ Optional | Jumio verification |
| `ONFIDO_API_TOKEN` | Onfido API token | ⬜ Optional | Identity verification |

```bash
SIFT_API_KEY=your-sift-api-key
SIFT_ACCOUNT_ID=your-sift-account-id
SOCURE_API_KEY=your-socure-key
```

> **Why needed**: These services provide pre-built fraud signals and can augment your ML models with consortium data from billions of transactions.

---

## 8. Monitoring, Logging & Alerting

### 8.1 Azure Application Insights

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | App Insights connection | ✅ Yes | APM, logging |
| `APPINSIGHTS_INSTRUMENTATIONKEY` | Instrumentation key | ⬜ Optional | Legacy integration |
| `APPLICATIONINSIGHTS_ROLE_NAME` | Service role name | ⬜ Optional | Service mapping |
| `ENABLE_LIVE_METRICS` | Enable live metrics stream | ⬜ Optional | Real-time monitoring |

```bash
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=your-key;IngestionEndpoint=https://eastus-1.in.applicationinsights.azure.com/
APPLICATIONINSIGHTS_ROLE_NAME=shadow-hubble-api
ENABLE_LIVE_METRICS=true
```

### 8.2 Prometheus & Grafana

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `PROMETHEUS_MULTIPROC_DIR` | Prometheus multiproc dir | ⬜ Optional | Metrics collection |
| `PROMETHEUS_METRICS_PORT` | Metrics endpoint port | ⬜ Optional | Metrics scraping |
| `GRAFANA_API_KEY` | Grafana API key | ⬜ Optional | Dashboard automation |
| `GRAFANA_URL` | Grafana server URL | ⬜ Optional | Dashboard links |

```bash
PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus
PROMETHEUS_METRICS_PORT=9090
```

### 8.3 Alerting Channels

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook | ⬜ Optional | Alert notifications |
| `SLACK_CHANNEL` | Target Slack channel | ⬜ Optional | Alert routing |
| `PAGERDUTY_ROUTING_KEY` | PagerDuty routing key | ⬜ Optional | On-call alerts |
| `SENDGRID_API_KEY` | SendGrid email API key | ⬜ Optional | Email alerts |
| `SENDGRID_FROM_EMAIL` | Alert sender email | ⬜ Optional | Email notifications |
| `TEAMS_WEBHOOK_URL` | MS Teams webhook | ⬜ Optional | Teams notifications |

```bash
SLACK_WEBHOOK_URL=<your-slack-webhook-url>
SLACK_CHANNEL=#fraud-alerts
PAGERDUTY_ROUTING_KEY=<your-pagerduty-key>
SENDGRID_API_KEY=<your-sendgrid-api-key>
```

### 8.4 Log Management (Optional Centralized)

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `ELASTICSEARCH_URL` | Elasticsearch URL | ⬜ Optional | Log aggregation |
| `ELASTICSEARCH_API_KEY` | Elasticsearch API key | ⬜ Optional | Log shipping |
| `DATADOG_API_KEY` | Datadog API key | ⬜ Optional | Datadog logging |
| `DATADOG_APP_KEY` | Datadog app key | ⬜ Optional | Datadog dashboards |
| `SPLUNK_HEC_TOKEN` | Splunk HEC token | ⬜ Optional | Splunk ingestion |
| `SPLUNK_HEC_URL` | Splunk HEC endpoint | ⬜ Optional | Log forwarding |

```bash
DATADOG_API_KEY=your-datadog-api-key
DATADOG_APP_KEY=your-datadog-app-key
```

### 8.5 Model Monitoring (Evidently)

| Variable | Description | Required | Used In |
|----------|-------------|----------|---------|
| `EVIDENTLY_WORKSPACE` | Evidently workspace path | ⬜ Optional | Model monitoring UI |
| `DRIFT_THRESHOLD_PSI` | PSI threshold for drift | ⬜ Optional | Drift detection |
| `DRIFT_THRESHOLD_KS` | KS-test threshold | ⬜ Optional | Drift detection |
| `BIAS_THRESHOLD` | Fairness metric threshold | ⬜ Optional | Bias monitoring |
| `RETRAINING_TRIGGER_THRESHOLD` | Auto-retrain threshold | ⬜ Optional | Retraining pipeline |

```bash
EVIDENTLY_WORKSPACE=./monitoring/evidently
DRIFT_THRESHOLD_PSI=0.2
DRIFT_THRESHOLD_KS=0.1
BIAS_THRESHOLD=0.05
RETRAINING_TRIGGER_THRESHOLD=0.1
```

---

## 8. Best Practices

### 8.1 Environment Variable Naming Conventions

| Convention | Example | Description |
|------------|---------|-------------|
| **SCREAMING_SNAKE_CASE** | `DATABASE_URL` | Standard for env vars |
| **Service Prefix** | `AZURE_`, `AWS_`, `STRIPE_` | Group by service |
| **Component Suffix** | `_URL`, `_KEY`, `_SECRET`, `_TOKEN` | Indicate type |
| **Environment Suffix** | `DATABASE_URL_DEV` | Environment-specific (avoid) |

**✅ Good Examples:**
```bash
AZURE_STORAGE_CONNECTION_STRING
STRIPE_SECRET_KEY
JWT_ACCESS_TOKEN_EXPIRE_MINUTES
```

**❌ Bad Examples:**
```bash
azureStorageKey          # Not screaming snake case
DB                       # Too vague
myApiKey                 # Unclear purpose
SECRETKEY                # Missing underscore
```

### 8.2 Secret Management Best Practices

#### Use Azure Key Vault (Recommended for Production)

```python
# Python example: Load secrets from Key Vault
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

credential = DefaultAzureCredential()
client = SecretClient(vault_url="https://your-kv.vault.azure.net/", credential=credential)

DATABASE_URL = client.get_secret("database-url").value
```

#### Environment-Specific .env Files

```
project/
├── .env                    # Default/local (DO NOT COMMIT)
├── .env.example            # Template with placeholders (COMMIT THIS)
├── .env.development        # Dev overrides
├── .env.staging            # Staging overrides
└── .env.production         # Production overrides (DO NOT COMMIT)
```

#### .env.example Template

```bash
# =====================================================
# SHADOW HUBBLE - ENVIRONMENT CONFIGURATION TEMPLATE
# =====================================================
# Copy this file to .env and fill in your values.
# NEVER commit .env files with real credentials!

# --- Application ---
APP_NAME=shadow-hubble
APP_ENV=development
DEBUG=true
SECRET_KEY=<generate-32-char-random-string>

# --- Database ---
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/fraud_detection

# --- Redis ---
REDIS_URL=redis://localhost:6379/0

# ... (continue for all variables)
```

### 8.3 Common Mistakes to Avoid

> [!CAUTION]
> **Critical Security Mistakes**

| Mistake | Risk | Solution |
|---------|------|----------|
| **Hardcoding secrets in code** | Exposed in Git history | Use .env files + Key Vault |
| **Committing .env files** | Credential leak | Add to .gitignore |
| **Using same secrets across envs** | Blast radius expansion | Unique secrets per environment |
| **Logging secrets** | Credential exposure in logs | Mask sensitive data in logs |
| **Sharing secrets via Slack/email** | Credential interception | Use Key Vault access grants |
| **Not rotating secrets** | Long-term exposure | Implement rotation policy |
| **Using weak secrets** | Brute-force attacks | Use cryptographic randomness |

#### Proper .gitignore Configuration

```gitignore
# Environment files
.env
.env.local
.env.development.local
.env.production
.env.*.local

# Secrets
*.pem
*.key
secrets/
.secrets/

# Azure
.azure/
azure-credentials.json
```

#### Secret Rotation Checklist

- [ ] Database passwords (90 days)
- [ ] API keys (180 days)
- [ ] JWT secrets (180 days)
- [ ] Service principal secrets (365 days)
- [ ] Storage account keys (180 days)

### 8.4 Local Development Security

```bash
# Generate secure secrets locally
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Or use OpenSSL
openssl rand -base64 32
```

### 8.5 Production Checklist

- [ ] All secrets stored in Azure Key Vault
- [ ] Managed identities used where possible
- [ ] No hardcoded credentials in code
- [ ] .env files excluded from Git
- [ ] Secret rotation policy implemented
- [ ] Audit logging enabled
- [ ] Network restrictions (Private Endpoints) configured
- [ ] Principle of least privilege applied

---

## 9. Complete .env Template

Below is a comprehensive `.env.example` template for the complete fraud detection platform:

```bash
# =====================================================
# SHADOW HUBBLE - FRAUD DETECTION MLOPS PLATFORM
# ENVIRONMENT CONFIGURATION TEMPLATE
# =====================================================
# Copy to .env and replace placeholders with real values
# NEVER COMMIT .env FILES WITH REAL CREDENTIALS!
# =====================================================

# ===== APPLICATION CORE =====
APP_NAME=shadow-hubble
APP_ENV=development
DEBUG=true
LOG_LEVEL=DEBUG
SECRET_KEY=<your-32-char-secret-key>
API_VERSION=v1

# ===== BACKEND SERVER =====
HOST=0.0.0.0
PORT=8000
WORKERS=4
RELOAD=true
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# ===== FRONTEND =====
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_TITLE=Shadow Hubble - Fraud Detection
VITE_AUTH_ENABLED=true

# ===== DATABASE (PostgreSQL) =====
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/fraud_detection
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fraud_detection
DB_USER=postgres
DB_PASSWORD=<your-db-password>
DB_SSL_MODE=disable
DB_POOL_SIZE=20

# ===== CACHE (Redis) =====
REDIS_URL=redis://localhost:6379/0
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_SSL=false
CACHE_TTL_SECONDS=3600

# ===== CELERY (Async Tasks) =====
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1
CELERY_CONCURRENCY=4

# ===== AZURE CORE =====
AZURE_SUBSCRIPTION_ID=<your-subscription-id>
AZURE_TENANT_ID=<your-tenant-id>
AZURE_RESOURCE_GROUP=shadow-hubble-rg
AZURE_LOCATION=eastus
AZURE_CLIENT_ID=<your-service-principal-id>
AZURE_CLIENT_SECRET=<your-service-principal-secret>

# ===== AZURE STORAGE =====
AZURE_STORAGE_CONNECTION_STRING=<your-storage-connection-string>
AZURE_STORAGE_ACCOUNT_NAME=<your-storage-account>
AZURE_STORAGE_ACCOUNT_KEY=<your-storage-key>
AZURE_STORAGE_CONTAINER_DATASETS=datasets
AZURE_STORAGE_CONTAINER_MODELS=models

# ===== AZURE SERVICE BUS =====
AZURE_SERVICEBUS_CONNECTION_STRING=<your-servicebus-connection>
AZURE_SERVICEBUS_QUEUE_NAME=fraud-detection-jobs

# ===== AZURE KEY VAULT =====
AZURE_KEY_VAULT_NAME=shadow-hubble-kv
AZURE_KEY_VAULT_URI=https://shadow-hubble-kv.vault.azure.net/

# ===== AZURE AD B2C =====
AZURE_AD_B2C_TENANT_NAME=<your-b2c-tenant>
AZURE_AD_B2C_TENANT_ID=<your-b2c-tenant-id>
AZURE_AD_B2C_CLIENT_ID=<your-b2c-app-id>
AZURE_AD_B2C_CLIENT_SECRET=<your-b2c-secret>
AZURE_AD_B2C_POLICY_SIGNIN=B2C_1_SignIn
AZURE_AD_B2C_REDIRECT_URI=http://localhost:3000/auth/callback

# ===== JWT & SECURITY =====
JWT_SECRET_KEY=<your-jwt-secret-32-chars>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
ENCRYPTION_KEY=<your-32-byte-encryption-key>

# ===== ML & MODEL MANAGEMENT =====
MLFLOW_TRACKING_URI=http://localhost:5000
MLFLOW_EXPERIMENT_NAME=fraud-detection
MODEL_REGISTRY_PATH=./models
ONNX_MODEL_PATH=./models/onnx
TRAINING_DATA_PATH=./data/training

# ===== MODEL MONITORING =====
DRIFT_THRESHOLD_PSI=0.2
DRIFT_THRESHOLD_KS=0.1
BIAS_THRESHOLD=0.05

# ===== MONITORING & ALERTING =====
APPLICATIONINSIGHTS_CONNECTION_STRING=<your-app-insights-connection>
SLACK_WEBHOOK_URL=<your-slack-webhook>
SLACK_CHANNEL=#fraud-alerts

# ===== THIRD-PARTY FRAUD APIS (Optional) =====
# MAXMIND_LICENSE_KEY=<your-maxmind-key>
# FINGERPRINTJS_API_KEY=<your-fingerprintjs-key>
# STRIPE_SECRET_KEY=<your-stripe-secret>
# SIFT_API_KEY=<your-sift-key>

# ===== TERRAFORM (CI/CD) =====
ARM_SUBSCRIPTION_ID=<your-subscription-id>
ARM_TENANT_ID=<your-tenant-id>
ARM_CLIENT_ID=<terraform-sp-id>
ARM_CLIENT_SECRET=<terraform-sp-secret>
TF_VAR_environment=development
```

---

## Summary: Variable Count by Category

| Category | Required | Optional | Total |
|----------|----------|----------|-------|
| Application Core | 5 | 1 | 6 |
| Backend Server | 3 | 2 | 5 |
| Frontend | 2 | 2 | 4 |
| Database | 5 | 4 | 9 |
| Redis Cache | 4 | 3 | 7 |
| Azure Service Bus | 2 | 2 | 4 |
| Azure Blob Storage | 5 | 1 | 6 |
| Streaming (Kafka/Event Hub) | 0 | 8 | 8 |
| MLflow | 2 | 4 | 6 |
| Model Training | 2 | 4 | 6 |
| Azure ML | 0 | 6 | 6 |
| ONNX Inference | 1 | 4 | 5 |
| Celery Workers | 2 | 4 | 6 |
| Azure Core | 6 | 0 | 6 |
| Container Apps | 5 | 0 | 5 |
| Key Vault | 2 | 1 | 3 |
| Terraform | 7 | 0 | 7 |
| Azure AD B2C | 6 | 3 | 9 |
| JWT & Sessions | 3 | 2 | 5 |
| Rate Limiting | 0 | 5 | 5 |
| Encryption | 1 | 2 | 3 |
| IP Intelligence | 0 | 4 | 4 |
| Device Fingerprinting | 0 | 5 | 5 |
| Email Verification | 0 | 6 | 6 |
| Phone Verification | 0 | 5 | 5 |
| Payment Gateways | 0 | 9 | 9 |
| Fraud Services | 0 | 10 | 10 |
| App Insights | 1 | 3 | 4 |
| Prometheus/Grafana | 0 | 4 | 4 |
| Alerting | 0 | 6 | 6 |
| Log Management | 0 | 6 | 6 |
| Model Monitoring | 0 | 5 | 5 |
| **TOTAL** | **~64** | **~116** | **~180** |

---

## Next Steps

1. **Create your .env file**: Copy the template above and fill in your values
2. **Set up Azure Key Vault**: Store production secrets securely
3. **Configure .gitignore**: Ensure sensitive files are excluded
4. **Implement secret rotation**: Set up automated rotation policies
5. **Enable audit logging**: Track all credential access
6. **Review third-party APIs**: Select the fraud signal providers relevant to your use case

---

*Report Generated: January 21, 2026*
*Shadow Hubble - Fraud Detection MLOps Platform*
