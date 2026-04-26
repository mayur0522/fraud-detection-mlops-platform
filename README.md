# Shadow Hubble - Fraud Detection MLOps Platform

[![Azure](https://img.shields.io/badge/Azure-Deployed-blue)](https://azure.microsoft.com)
[![Python](https://img.shields.io/badge/Python-3.11-green)](https://python.org)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

> An enterprise-grade MLOps platform for fraud detection with automated model lifecycle management.

## 🚀 Features

### ML Lifecycle
- **Training**: XGBoost, LightGBM, Random Forest with hyperparameter tuning
- **50+ Feature Engineering**: Temporal, velocity, statistical, fraud-specific features
- **ONNX Inference**: <10ms latency with optimized runtime
- **SHAP Explainability**: Feature contributions for each prediction

### Monitoring & Fairness
- **Drift Detection**: Real-time pipeline computing PSI and KS-test on production feature space
- **Bias Monitoring**: Live Fairlearn integration evaluating fairness metrics against actual test splits
- **Performance Baselines**: Live Dashboard integration providing real-time model evaluation against baselines
- **Alerting**: Multi-channel notifications with deduplication (In Progress)

### Automation
- **Scheduled Jobs**: Celery background workers (`compute_drift_metrics`, `compute_bias_metrics`) processing active models
- **Auto-Retraining**: Triggered by drift, performance, or bias issues
- **A/B Testing**: Champion-challenger model comparison
- **Model Registry**: Version control with promotion workflow

### Security
- **Azure AD B2C**: SSO authentication
- **RBAC**: 5 roles, 20+ granular permissions
- **Audit Logging**: Comprehensive action tracking
- **Rate Limiting**: Endpoint-specific protection

## 📁 Project Structure

```
shadow-hubble/
├── backend/               # FastAPI backend
│   ├── app/
│   │   ├── api/v1/       # REST endpoints (12 routers)
│   │   ├── core/         # Auth, config, database
│   │   ├── models/       # SQLAlchemy models
│   │   ├── services/     # Business logic
│   │   └── workers/      # Celery tasks
│   └── pyproject.toml
├── frontend/              # React + TypeScript UI
│   ├── src/
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # 14 page components
│   │   └── services/     # API clients
│   └── package.json
├── ml/                    # ML components
│   ├── features/         # Feature engineering
│   ├── training/         # Model trainers
│   ├── inference/        # ONNX runtime
│   ├── fairness/         # Fairlearn integration
│   └── explainability/   # SHAP explainers
└── infrastructure/        # Terraform Azure
    └── terraform/
        └── modules/      # 6 Azure modules
```

## 🛠️ Quick Start

### Local Development (Docker)

```bash
# Clone and start
git clone https://github.com/your-org/shadow-hubble.git
cd shadow-hubble
docker-compose up -d --build

# Access
# API:  http://localhost:8000/api/docs
# UI:   http://localhost:3000
```

### Azure Deployment

```bash
cd infrastructure/terraform

# Initialize
terraform init

# Plan
terraform plan -var="environment=prod"

# Deploy
terraform apply -var="environment=prod"
```

## 🔑 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/api/v1/datasets` | Dataset management |
| `/api/v1/features` | Feature engineering |
| `/api/v1/training` | Model training |
| `/api/v1/models` | Model registry |
| `/api/v1/inference` | Real-time predictions |
| `/api/v1/monitoring` | Drift/bias metrics |
| `/api/v1/alerts` | Alert management |
| `/api/v1/jobs` | Scheduled jobs |
| `/api/v1/retraining` | Auto retraining |
| `/api/v1/ab-tests` | A/B testing |

## 👥 Roles & Permissions

| Role | Permissions |
|------|-------------|
| **Admin** | Full access |
| **ML Engineer** | Train, deploy, configure monitoring |
| **Data Scientist** | Train models, manage data |
| **Analyst** | Read-only access to models & data |
| **Viewer** | Dashboard view only |

## 📊 Tech Stack

**Backend**: Python 3.11, FastAPI, SQLAlchemy, Celery, Redis

**Frontend**: React 18, TypeScript, Vite, Ant Design, React Query

**ML**: XGBoost, LightGBM, ONNX, SHAP, Fairlearn, Evidently

**Infrastructure**: Azure (Container Apps, PostgreSQL, Redis, Blob Storage, Key Vault)

**IaC**: Terraform

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
for more details visit https://github.com/chandan-akshronix/Fraud_Detection_MLOPS_Platform
