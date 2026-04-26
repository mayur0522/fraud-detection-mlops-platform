# Azure Blob Storage Schema & Directory Structure
## Fraud Detection MLOps Platform

> **Last Updated**: 2026-01-22  
> **Version**: 1.0  
> **Owner**: Platform Architecture Team

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Container Organization](#container-organization)
3. [Directory Structure](#directory-structure)
4. [Naming Conventions](#naming-conventions)
5. [Access Patterns](#access-patterns)
6. [Lifecycle Policies](#lifecycle-policies)
7. [Implementation Guide](#implementation-guide)

---

## Overview

This document defines the Azure Blob Storage architecture for the Shadow Hubble Fraud Detection MLOps Platform. The storage schema supports:

- **Dataset Management**: Raw, processed, and versioned datasets
- **Model Artifacts**: Trained models, ONNX files, metadata
- **Feature Engineering**: Feature sets, cached computations
- **Monitoring**: Drift reports, bias analysis, performance metrics
- **Audit & Compliance**: Logs, predictions, model lineage
- **Backup & Recovery**: Snapshots, disaster recovery

### Storage Account Structure

```
Storage Account: shadowhubblemlops{env}
├── Container: datasets
├── Container: models
├── Container: features
├── Container: monitoring
├── Container: audit-logs
├── Container: experiments
├── Container: backups
└── Container: temp-processing
```

### Visual Architecture

![Azure Blob Storage Architecture](C:/Users/hp5pr/.gemini/antigravity/brain/a0f15768-7e75-43e2-8dba-2522b66af77a/azure_storage_architecture_1769077218794.png)

The diagram above illustrates the 8-container architecture with their respective access tiers and primary use cases.

---

## Container Organization

### 1. **datasets** Container

**Purpose**: Store raw, processed, and versioned training/validation datasets

**Access Tier**: Hot (frequently accessed during training)

**Directory Structure**:
```
datasets/
├── raw/
│   ├── {dataset_id}/
│   │   ├── {version}/
│   │   │   ├── data.parquet
│   │   │   ├── data.csv
│   │   │   ├── metadata.json
│   │   │   ├── schema.json
│   │   │   └── statistics.json
│   │   └── versions.json
│   └── uploads/
│       └── {upload_id}/
│           └── {timestamp}_{filename}
│
├── processed/
│   ├── {dataset_id}/
│   │   ├── {version}/
│   │   │   ├── train.parquet
│   │   │   ├── validation.parquet
│   │   │   ├── test.parquet
│   │   │   ├── preprocessing_config.json
│   │   │   └── split_metadata.json
│   │   └── latest -> {version}
│
├── labeled/
│   ├── {dataset_id}/
│   │   ├── {labeling_batch_id}/
│   │   │   ├── labeled_data.parquet
│   │   │   ├── labeling_metadata.json
│   │   │   └── quality_metrics.json
│
└── synthetic/
    ├── {generation_id}/
    │   ├── synthetic_data.parquet
    │   ├── generation_config.json
    │   └── validation_report.json
```

**Metadata Example** (`metadata.json`):
```json
{
  "dataset_id": "ds-20260122-001",
  "version": "v1.2.0",
  "created_at": "2026-01-22T10:30:00Z",
  "created_by": "user@example.com",
  "source": "production_transactions",
  "row_count": 1500000,
  "fraud_rate": 0.023,
  "date_range": {
    "start": "2025-01-01",
    "end": "2025-12-31"
  },
  "columns": 45,
  "size_bytes": 524288000,
  "checksum": "sha256:abc123...",
  "tags": ["production", "2025", "high-quality"]
}
```

---

### 2. **models** Container

**Purpose**: Store trained models, ONNX files, and model metadata

**Access Tier**: Hot (active models), Cool (archived models)

**Directory Structure**:
```
models/
├── registry/
│   ├── {model_id}/
│   │   ├── {version}/
│   │   │   ├── model.pkl              # Original scikit-learn/XGBoost
│   │   │   ├── model.onnx             # ONNX for inference
│   │   │   ├── model_metadata.json    # Hyperparams, metrics
│   │   │   ├── feature_importance.json
│   │   │   ├── confusion_matrix.png
│   │   │   ├── roc_curve.png
│   │   │   ├── checksum.sha256
│   │   │   ├── training_config.json
│   │   │   └── mlflow/
│   │   │       ├── MLmodel
│   │   │       ├── conda.yaml
│   │   │       └── requirements.txt
│   │   ├── versions.json
│   │   └── champion.txt               # Points to champion version
│
├── staging/
│   ├── {model_id}/
│   │   └── {version}/
│   │       └── [same structure as registry]
│
├── production/
│   ├── active/
│   │   ├── {model_id}/
│   │   │   └── {version}/
│   │   │       ├── model.onnx
│   │   │       ├── model_metadata.json
│   │   │       └── feature_config.json
│   │   └── current_champion -> {model_id}/{version}
│   │
│   └── ab-testing/
│       ├── {experiment_id}/
│       │   ├── champion/
│       │   │   └── {model_id}/{version}/
│       │   ├── challenger/
│       │   │   └── {model_id}/{version}/
│       │   └── experiment_config.json
│
└── archived/
    ├── {year}/
    │   └── {model_id}/
    │       └── {version}/
    │           └── [compressed artifacts]
```

**Model Metadata Example** (`model_metadata.json`):
```json
{
  "model_id": "mdl-xgb-20260122-001",
  "version": "v2.1.0",
  "algorithm": "XGBoost",
  "framework_version": "2.0.3",
  "created_at": "2026-01-22T14:30:00Z",
  "trained_by": "ml-engineer@example.com",
  "training_duration_seconds": 3600,
  "dataset_id": "ds-20260122-001",
  "dataset_version": "v1.2.0",
  "feature_set_id": "fs-20260122-001",
  "feature_set_version": "v1.0.0",
  "hyperparameters": {
    "max_depth": 6,
    "learning_rate": 0.1,
    "n_estimators": 100,
    "scale_pos_weight": 20.5
  },
  "metrics": {
    "accuracy": 0.9845,
    "precision": 0.8923,
    "recall": 0.8567,
    "f1_score": 0.8742,
    "auc_roc": 0.9678,
    "pr_auc": 0.8934
  },
  "validation_metrics": {
    "accuracy": 0.9812,
    "precision": 0.8756,
    "recall": 0.8423,
    "f1_score": 0.8587,
    "auc_roc": 0.9623
  },
  "status": "production",
  "promotion_history": [
    {
      "from": "staging",
      "to": "production",
      "timestamp": "2026-01-22T16:00:00Z",
      "approved_by": "senior-ml-engineer@example.com"
    }
  ],
  "tags": ["xgboost", "production", "champion"]
}
```

---

### 3. **features** Container

**Purpose**: Store feature engineering configurations and computed feature sets

**Access Tier**: Hot (active features), Cool (historical)

**Directory Structure**:
```
features/
├── definitions/
│   ├── {feature_set_id}/
│   │   ├── {version}/
│   │   │   ├── feature_config.json
│   │   │   ├── feature_schema.json
│   │   │   ├── transformations.py
│   │   │   ├── dependencies.txt
│   │   │   └── schema_hash.txt
│   │   └── versions.json
│
├── computed/
│   ├── {feature_set_id}/
│   │   ├── {version}/
│   │   │   ├── {dataset_id}/
│   │   │   │   ├── features.parquet
│   │   │   │   ├── feature_statistics.json
│   │   │   │   └── computation_metadata.json
│
├── online/
│   ├── snapshots/
│   │   ├── {timestamp}/
│   │   │   ├── feature_snapshot.parquet
│   │   │   └── snapshot_metadata.json
│
└── validation/
    ├── {feature_set_id}/
    │   ├── {version}/
    │   │   ├── validation_report.json
    │   │   ├── drift_analysis.json
    │   │   └── quality_metrics.json
```

**Feature Config Example** (`feature_config.json`):
```json
{
  "feature_set_id": "fs-20260122-001",
  "version": "v1.0.0",
  "name": "fraud_detection_features_v1",
  "created_at": "2026-01-22T09:00:00Z",
  "features": [
    {
      "name": "transaction_amount",
      "type": "numeric",
      "transformation": "log_scale",
      "nullable": false
    },
    {
      "name": "velocity_1h",
      "type": "numeric",
      "description": "Transaction count in last 1 hour",
      "computation": "window_aggregation",
      "window": "1h"
    },
    {
      "name": "merchant_risk_score",
      "type": "numeric",
      "source": "merchant_features",
      "join_key": "merchant_id"
    }
  ],
  "total_features": 52,
  "schema_hash": "sha256:def456...",
  "dependencies": ["merchant_features", "user_profile_features"],
  "tags": ["production", "v1"]
}
```

---

### 4. **monitoring** Container

**Purpose**: Store drift reports, bias analysis, performance monitoring data

**Access Tier**: Hot (recent), Cool (historical)

**Directory Structure**:
```
monitoring/
├── drift/
│   ├── data-drift/
│   │   ├── {model_id}/
│   │   │   ├── {date}/
│   │   │   │   ├── drift_report.json
│   │   │   │   ├── drift_report.html
│   │   │   │   ├── feature_drift_scores.json
│   │   │   │   ├── psi_scores.json
│   │   │   │   └── visualizations/
│   │   │   │       ├── distribution_shift.png
│   │   │   │       └── feature_drift_heatmap.png
│   │   └── aggregated/
│   │       └── {year}-{month}/
│   │           └── monthly_drift_summary.json
│   │
│   └── concept-drift/
│       ├── {model_id}/
│       │   ├── {date}/
│       │   │   ├── performance_metrics.json
│       │   │   ├── prediction_distribution.json
│       │   │   └── concept_drift_score.json
│
├── bias/
│   ├── {model_id}/
│   │   ├── {date}/
│   │   │   ├── bias_report.json
│   │   │   ├── bias_report.html
│   │   │   ├── fairness_metrics.json
│   │   │   ├── demographic_parity.json
│   │   │   ├── equalized_odds.json
│   │   │   └── visualizations/
│   │   │       ├── bias_by_group.png
│   │   │       └── fairness_dashboard.png
│
├── performance/
│   ├── {model_id}/
│   │   ├── {date}/
│   │   │   ├── daily_metrics.json
│   │   │   ├── confusion_matrix.json
│   │   │   ├── prediction_latency.json
│   │   │   └── throughput_stats.json
│   │   └── baselines/
│   │       └── baseline_metrics.json
│
└── alerts/
    ├── triggered/
    │   ├── {year}/{month}/{day}/
    │   │   ├── {alert_id}.json
    │   │   └── alert_context.json
    │
    └── resolved/
        ├── {year}/{month}/
        │   └── {alert_id}_resolution.json
```

**Drift Report Example** (`drift_report.json`):
```json
{
  "report_id": "drift-20260122-001",
  "model_id": "mdl-xgb-20260122-001",
  "model_version": "v2.1.0",
  "report_date": "2026-01-22",
  "reference_period": {
    "start": "2025-12-01",
    "end": "2025-12-31"
  },
  "current_period": {
    "start": "2026-01-15",
    "end": "2026-01-22"
  },
  "drift_detected": true,
  "overall_drift_score": 0.342,
  "threshold": 0.25,
  "features_drifted": 8,
  "feature_drift_details": [
    {
      "feature_name": "transaction_amount",
      "psi_score": 0.456,
      "ks_statistic": 0.234,
      "drift_detected": true,
      "severity": "high"
    },
    {
      "feature_name": "velocity_1h",
      "psi_score": 0.123,
      "ks_statistic": 0.089,
      "drift_detected": false,
      "severity": "low"
    }
  ],
  "recommendations": [
    "Consider retraining model due to significant drift in transaction_amount",
    "Monitor velocity features for potential drift in next 7 days"
  ],
  "alert_triggered": true,
  "alert_id": "alert-drift-20260122-001"
}
```

---

### 5. **audit-logs** Container

**Purpose**: Store audit trails, prediction logs, model lineage

**Access Tier**: Cool (compliance, rarely accessed)

**Directory Structure**:
```
audit-logs/
├── predictions/
│   ├── {year}/{month}/{day}/
│   │   ├── {hour}/
│   │   │   ├── predictions_{timestamp}.jsonl
│   │   │   └── predictions_{timestamp}.parquet
│   │   └── daily_summary.json
│
├── model-lineage/
│   ├── {model_id}/
│   │   ├── lineage_graph.json
│   │   ├── training_lineage.json
│   │   ├── dataset_lineage.json
│   │   └── feature_lineage.json
│
├── user-actions/
│   ├── {year}/{month}/
│   │   ├── {user_id}/
│   │   │   ├── actions_{date}.jsonl
│   │   │   └── monthly_summary.json
│
├── api-access/
│   ├── {year}/{month}/{day}/
│   │   ├── api_calls_{timestamp}.jsonl
│   │   └── access_summary.json
│
└── compliance/
    ├── gdpr/
    │   ├── data_access_requests/
    │   │   └── {request_id}/
    │   │       ├── request.json
    │   │       ├── data_export.zip
    │   │       └── completion_certificate.pdf
    │   └── data_deletion_requests/
    │       └── {request_id}/
    │           ├── request.json
    │           └── deletion_proof.json
    │
    └── sox/
        ├── {year}/
        │   └── quarterly_reports/
        │       └── Q{quarter}_compliance_report.pdf
```

**Prediction Log Example** (`predictions_{timestamp}.jsonl`):
```jsonl
{"prediction_id":"pred-001","timestamp":"2026-01-22T10:30:00Z","model_id":"mdl-xgb-20260122-001","model_version":"v2.1.0","transaction_id":"txn-123456","fraud_score":0.87,"prediction":"fraud","confidence":0.87,"latency_ms":12,"features":{"transaction_amount":1500.00,"velocity_1h":5},"explanation":{"top_features":[{"name":"transaction_amount","contribution":0.45},{"name":"velocity_1h","contribution":0.32}]}}
{"prediction_id":"pred-002","timestamp":"2026-01-22T10:30:01Z","model_id":"mdl-xgb-20260122-001","model_version":"v2.1.0","transaction_id":"txn-123457","fraud_score":0.12,"prediction":"legitimate","confidence":0.88,"latency_ms":9,"features":{"transaction_amount":45.00,"velocity_1h":1},"explanation":{"top_features":[{"name":"merchant_risk_score","contribution":0.23},{"name":"user_history_score","contribution":0.18}]}}
```

---

### 6. **experiments** Container

**Purpose**: Store experiment tracking data, A/B test results

**Access Tier**: Hot (active experiments), Cool (completed)

**Directory Structure**:
```
experiments/
├── training-experiments/
│   ├── {experiment_id}/
│   │   ├── experiment_config.json
│   │   ├── runs/
│   │   │   ├── {run_id}/
│   │   │   │   ├── hyperparameters.json
│   │   │   │   ├── metrics.json
│   │   │   │   ├── artifacts/
│   │   │   │   │   ├── model.pkl
│   │   │   │   │   └── plots/
│   │   │   │   └── logs/
│   │   │   │       └── training.log
│   │   └── comparison_report.json
│
├── ab-tests/
│   ├── {test_id}/
│   │   ├── test_config.json
│   │   ├── champion_results.json
│   │   ├── challenger_results.json
│   │   ├── statistical_analysis.json
│   │   ├── decision_report.json
│   │   └── traffic_split_logs/
│   │       └── {date}/
│   │           └── traffic_log.jsonl
│
└── hyperparameter-tuning/
    ├── {tuning_job_id}/
    │   ├── search_space.json
    │   ├── trials/
    │   │   ├── {trial_id}/
    │   │   │   ├── hyperparameters.json
    │   │   │   └── metrics.json
    │   └── best_config.json
```

---

### 7. **backups** Container

**Purpose**: Disaster recovery, snapshots

**Access Tier**: Archive

**Directory Structure**:
```
backups/
├── database/
│   ├── {year}/{month}/{day}/
│   │   ├── postgresql_backup_{timestamp}.sql.gz
│   │   └── backup_metadata.json
│
├── models/
│   ├── {year}/{month}/
│   │   ├── production_models_snapshot_{date}.tar.gz
│   │   └── snapshot_manifest.json
│
└── configurations/
    ├── {year}/{month}/
    │   ├── feature_configs_{date}.tar.gz
    │   ├── training_configs_{date}.tar.gz
    │   └── system_configs_{date}.tar.gz
```

---

### 8. **temp-processing** Container

**Purpose**: Temporary storage for data processing jobs

**Access Tier**: Hot

**Directory Structure**:
```
temp-processing/
├── feature-computation/
│   ├── {job_id}/
│   │   ├── input/
│   │   ├── output/
│   │   └── logs/
│
├── model-training/
│   ├── {job_id}/
│   │   ├── preprocessed_data/
│   │   ├── intermediate_models/
│   │   └── logs/
│
└── data-validation/
    ├── {job_id}/
    │   ├── validation_results/
    │   └── error_logs/
```

**Lifecycle**: Auto-delete after 7 days

---

## Naming Conventions

### General Rules

1. **Use lowercase** with hyphens for separation
2. **Include timestamps** in ISO 8601 format (`YYYYMMDD` or `YYYY-MM-DD`)
3. **Use UUIDs or unique IDs** for resources
4. **Version semantically** using `v{major}.{minor}.{patch}`

### Examples

| Resource Type | Pattern | Example |
|---------------|---------|---------|
| Dataset ID | `ds-{date}-{sequence}` | `ds-20260122-001` |
| Model ID | `mdl-{algorithm}-{date}-{sequence}` | `mdl-xgb-20260122-001` |
| Feature Set ID | `fs-{date}-{sequence}` | `fs-20260122-001` |
| Experiment ID | `exp-{purpose}-{date}-{sequence}` | `exp-tuning-20260122-001` |
| Job ID | `job-{type}-{timestamp}` | `job-training-20260122T143000Z` |
| Alert ID | `alert-{type}-{date}-{sequence}` | `alert-drift-20260122-001` |

---

## Access Patterns

### Read-Heavy Operations

| Operation | Container | Path Pattern | Frequency |
|-----------|-----------|--------------|-----------|
| Load model for inference | `models` | `production/active/{model_id}/{version}/model.onnx` | Very High |
| Fetch feature config | `features` | `definitions/{feature_set_id}/{version}/feature_config.json` | High |
| Read training dataset | `datasets` | `processed/{dataset_id}/{version}/train.parquet` | Medium |
| Query drift reports | `monitoring` | `drift/data-drift/{model_id}/{date}/drift_report.json` | Medium |

### Write-Heavy Operations

| Operation | Container | Path Pattern | Frequency |
|-----------|-----------|--------------|-----------|
| Log predictions | `audit-logs` | `predictions/{year}/{month}/{day}/{hour}/predictions_{timestamp}.jsonl` | Very High |
| Save trained model | `models` | `registry/{model_id}/{version}/` | Low |
| Store drift report | `monitoring` | `drift/data-drift/{model_id}/{date}/` | Daily |
| Upload dataset | `datasets` | `raw/{dataset_id}/{version}/` | Low |

### Access Control

```
Container: datasets
├── Role: Data Scientists → Read/Write on raw/, processed/
├── Role: ML Engineers → Read on all, Write on processed/
└── Role: Analysts → Read-only on processed/

Container: models
├── Role: ML Engineers → Read/Write on registry/, staging/
├── Role: Senior ML Engineers → Read/Write on production/
└── Role: Inference Service → Read-only on production/active/

Container: audit-logs
├── Role: System → Write-only
├── Role: Compliance Team → Read-only
└── Role: Admins → Read/Write

Container: monitoring
├── Role: Monitoring Service → Read/Write
├── Role: ML Engineers → Read-only
└── Role: Analysts → Read-only
```

---

## Lifecycle Policies

### Automatic Tier Transitions

| Container | Path | Rule | Action |
|-----------|------|------|--------|
| `datasets` | `raw/*` | Age > 90 days | Move to Cool |
| `datasets` | `raw/*` | Age > 365 days | Move to Archive |
| `models` | `archived/*` | Age > 180 days | Move to Archive |
| `monitoring` | `drift/*` | Age > 90 days | Move to Cool |
| `monitoring` | `drift/*` | Age > 365 days | Move to Archive |
| `audit-logs` | `predictions/*` | Age > 90 days | Move to Cool |
| `audit-logs` | `predictions/*` | Age > 730 days | Move to Archive |
| `experiments` | `*/` | Age > 180 days | Move to Cool |
| `temp-processing` | `*` | Age > 7 days | Delete |

### Retention Policies

| Data Type | Retention Period | Reason |
|-----------|------------------|--------|
| Raw datasets | 2 years | Retraining, compliance |
| Trained models | Forever | Model lineage, rollback |
| Predictions | 2 years | Compliance (SOX, GDPR) |
| Drift reports | 1 year | Historical analysis |
| Audit logs | 7 years | Legal compliance |
| Temporary files | 7 days | Processing cleanup |

---

## Implementation Guide

### 1. Azure SDK Setup (Python)

```python
from azure.storage.blob import BlobServiceClient, ContainerClient, BlobClient
from azure.identity import DefaultAzureCredential
import os
from datetime import datetime, timedelta

class AzureBlobStorageManager:
    """Manages Azure Blob Storage operations for MLOps platform"""
    
    def __init__(self, account_name: str, environment: str = "prod"):
        self.account_name = account_name
        self.environment = environment
        self.account_url = f"https://{account_name}.blob.core.windows.net"
        
        # Use Managed Identity in production
        credential = DefaultAzureCredential()
        self.blob_service_client = BlobServiceClient(
            account_url=self.account_url,
            credential=credential
        )
    
    def upload_dataset(
        self,
        dataset_id: str,
        version: str,
        file_path: str,
        metadata: dict
    ) -> str:
        """Upload dataset to raw datasets container"""
        container_name = "datasets"
        blob_path = f"raw/{dataset_id}/{version}/data.parquet"
        
        container_client = self.blob_service_client.get_container_client(container_name)
        blob_client = container_client.get_blob_client(blob_path)
        
        # Upload file
        with open(file_path, "rb") as data:
            blob_client.upload_blob(
                data,
                overwrite=True,
                metadata=metadata,
                tags={"dataset_id": dataset_id, "version": version}
            )
        
        # Upload metadata
        metadata_blob_path = f"raw/{dataset_id}/{version}/metadata.json"
        metadata_blob_client = container_client.get_blob_client(metadata_blob_path)
        metadata_blob_client.upload_blob(
            json.dumps(metadata, indent=2),
            overwrite=True
        )
        
        return blob_path
    
    def upload_model(
        self,
        model_id: str,
        version: str,
        model_files: dict,  # {"model.pkl": path, "model.onnx": path}
        metadata: dict
    ) -> str:
        """Upload trained model to registry"""
        container_name = "models"
        base_path = f"registry/{model_id}/{version}"
        
        container_client = self.blob_service_client.get_container_client(container_name)
        
        # Upload all model files
        for filename, file_path in model_files.items():
            blob_path = f"{base_path}/{filename}"
            blob_client = container_client.get_blob_client(blob_path)
            
            with open(file_path, "rb") as data:
                blob_client.upload_blob(data, overwrite=True)
        
        # Upload metadata
        metadata_blob_path = f"{base_path}/model_metadata.json"
        metadata_blob_client = container_client.get_blob_client(metadata_blob_path)
        metadata_blob_client.upload_blob(
            json.dumps(metadata, indent=2),
            overwrite=True,
            tags={"model_id": model_id, "version": version, "status": metadata.get("status")}
        )
        
        return base_path
    
    def download_model_for_inference(
        self,
        model_id: str,
        version: str,
        local_path: str
    ) -> str:
        """Download ONNX model for inference"""
        container_name = "models"
        blob_path = f"production/active/{model_id}/{version}/model.onnx"
        
        container_client = self.blob_service_client.get_container_client(container_name)
        blob_client = container_client.get_blob_client(blob_path)
        
        download_path = os.path.join(local_path, "model.onnx")
        with open(download_path, "wb") as download_file:
            download_file.write(blob_client.download_blob().readall())
        
        return download_path
    
    def log_predictions(
        self,
        predictions: list,
        timestamp: datetime
    ) -> str:
        """Log predictions to audit logs"""
        container_name = "audit-logs"
        
        # Organize by date hierarchy
        year = timestamp.strftime("%Y")
        month = timestamp.strftime("%m")
        day = timestamp.strftime("%d")
        hour = timestamp.strftime("%H")
        
        blob_path = f"predictions/{year}/{month}/{day}/{hour}/predictions_{timestamp.isoformat()}.jsonl"
        
        container_client = self.blob_service_client.get_container_client(container_name)
        blob_client = container_client.get_blob_client(blob_path)
        
        # Convert to JSONL format
        jsonl_data = "\n".join([json.dumps(pred) for pred in predictions])
        
        blob_client.upload_blob(
            jsonl_data,
            overwrite=False,
            tags={"type": "predictions", "date": timestamp.strftime("%Y-%m-%d")}
        )
        
        return blob_path
    
    def save_drift_report(
        self,
        model_id: str,
        report_date: datetime,
        drift_report: dict,
        visualizations: dict = None
    ) -> str:
        """Save drift detection report"""
        container_name = "monitoring"
        date_str = report_date.strftime("%Y-%m-%d")
        base_path = f"drift/data-drift/{model_id}/{date_str}"
        
        container_client = self.blob_service_client.get_container_client(container_name)
        
        # Upload JSON report
        report_blob_path = f"{base_path}/drift_report.json"
        report_blob_client = container_client.get_blob_client(report_blob_path)
        report_blob_client.upload_blob(
            json.dumps(drift_report, indent=2),
            overwrite=True,
            tags={"model_id": model_id, "date": date_str, "drift_detected": str(drift_report.get("drift_detected"))}
        )
        
        # Upload visualizations if provided
        if visualizations:
            for viz_name, viz_path in visualizations.items():
                viz_blob_path = f"{base_path}/visualizations/{viz_name}"
                viz_blob_client = container_client.get_blob_client(viz_blob_path)
                
                with open(viz_path, "rb") as viz_file:
                    viz_blob_client.upload_blob(viz_file, overwrite=True)
        
        return base_path
    
    def setup_lifecycle_policies(self):
        """Configure lifecycle management policies"""
        from azure.storage.blob import BlobManagementPolicy, ManagementPolicyRule
        
        # This would typically be done via Terraform or Azure Portal
        # Example policy structure:
        policies = {
            "datasets_cool_tier": {
                "container": "datasets",
                "prefix": "raw/",
                "days_after_modification": 90,
                "action": "move_to_cool"
            },
            "temp_cleanup": {
                "container": "temp-processing",
                "prefix": "",
                "days_after_modification": 7,
                "action": "delete"
            },
            "audit_archive": {
                "container": "audit-logs",
                "prefix": "predictions/",
                "days_after_modification": 730,
                "action": "move_to_archive"
            }
        }
        
        return policies
```

### 2. Terraform Configuration

```hcl
# terraform/modules/storage/main.tf

resource "azurerm_storage_account" "mlops_storage" {
  name                     = "shadowhubblemlops${var.environment}"
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "GRS"  # Geo-redundant
  account_kind             = "StorageV2"
  
  blob_properties {
    versioning_enabled = true
    
    delete_retention_policy {
      days = 30
    }
    
    container_delete_retention_policy {
      days = 30
    }
  }
  
  tags = {
    Environment = var.environment
    Project     = "Shadow-Hubble"
    ManagedBy   = "Terraform"
  }
}

# Container definitions
locals {
  containers = [
    "datasets",
    "models",
    "features",
    "monitoring",
    "audit-logs",
    "experiments",
    "backups",
    "temp-processing"
  ]
}

resource "azurerm_storage_container" "mlops_containers" {
  for_each              = toset(local.containers)
  name                  = each.value
  storage_account_name  = azurerm_storage_account.mlops_storage.name
  container_access_type = "private"
}

# Lifecycle management policy
resource "azurerm_storage_management_policy" "mlops_lifecycle" {
  storage_account_id = azurerm_storage_account.mlops_storage.id
  
  rule {
    name    = "datasets-cool-tier"
    enabled = true
    
    filters {
      prefix_match = ["datasets/raw/"]
      blob_types   = ["blockBlob"]
    }
    
    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than = 90
        tier_to_archive_after_days_since_modification_greater_than = 365
      }
    }
  }
  
  rule {
    name    = "temp-cleanup"
    enabled = true
    
    filters {
      prefix_match = ["temp-processing/"]
      blob_types   = ["blockBlob"]
    }
    
    actions {
      base_blob {
        delete_after_days_since_modification_greater_than = 7
      }
    }
  }
  
  rule {
    name    = "audit-logs-archive"
    enabled = true
    
    filters {
      prefix_match = ["audit-logs/predictions/"]
      blob_types   = ["blockBlob"]
    }
    
    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than = 90
        tier_to_archive_after_days_since_modification_greater_than = 730
      }
    }
  }
  
  rule {
    name    = "monitoring-archive"
    enabled = true
    
    filters {
      prefix_match = ["monitoring/drift/"]
      blob_types   = ["blockBlob"]
    }
    
    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than = 90
        tier_to_archive_after_days_since_modification_greater_than = 365
      }
    }
  }
}

# RBAC assignments
resource "azurerm_role_assignment" "ml_engineers_contributor" {
  scope                = azurerm_storage_account.mlops_storage.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.ml_engineers_group_id
}

resource "azurerm_role_assignment" "inference_service_reader" {
  scope                = azurerm_storage_container.mlops_containers["models"].resource_manager_id
  role_definition_name = "Storage Blob Data Reader"
  principal_id         = var.inference_service_identity_id
}

resource "azurerm_role_assignment" "monitoring_service_contributor" {
  scope                = azurerm_storage_container.mlops_containers["monitoring"].resource_manager_id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.monitoring_service_identity_id
}
```

### 3. FastAPI Integration

```python
# backend/app/services/storage_service.py

from typing import Optional, List, BinaryIO
from datetime import datetime
import json
from app.core.config import settings
from app.services.azure_blob_manager import AzureBlobStorageManager

class StorageService:
    """High-level storage service for MLOps platform"""
    
    def __init__(self):
        self.blob_manager = AzureBlobStorageManager(
            account_name=settings.AZURE_STORAGE_ACCOUNT_NAME,
            environment=settings.ENVIRONMENT
        )
    
    async def upload_dataset(
        self,
        dataset_id: str,
        version: str,
        file: BinaryIO,
        metadata: dict
    ) -> dict:
        """Upload dataset with metadata"""
        # Save file temporarily
        temp_path = f"/tmp/{dataset_id}_{version}.parquet"
        with open(temp_path, "wb") as f:
            f.write(file.read())
        
        # Upload to blob storage
        blob_path = self.blob_manager.upload_dataset(
            dataset_id=dataset_id,
            version=version,
            file_path=temp_path,
            metadata=metadata
        )
        
        # Cleanup
        os.remove(temp_path)
        
        return {
            "dataset_id": dataset_id,
            "version": version,
            "blob_path": blob_path,
            "uploaded_at": datetime.utcnow().isoformat()
        }
    
    async def get_model_for_inference(
        self,
        model_id: str,
        version: str
    ) -> str:
        """Download model for inference (cached locally)"""
        cache_dir = f"/app/model_cache/{model_id}/{version}"
        os.makedirs(cache_dir, exist_ok=True)
        
        model_path = os.path.join(cache_dir, "model.onnx")
        
        # Check if already cached
        if not os.path.exists(model_path):
            model_path = self.blob_manager.download_model_for_inference(
                model_id=model_id,
                version=version,
                local_path=cache_dir
            )
        
        return model_path
    
    async def log_predictions_batch(
        self,
        predictions: List[dict]
    ) -> str:
        """Log batch of predictions"""
        timestamp = datetime.utcnow()
        blob_path = self.blob_manager.log_predictions(
            predictions=predictions,
            timestamp=timestamp
        )
        return blob_path
```

---

## Best Practices

### 1. **Naming Consistency**
- Always use lowercase with hyphens
- Include timestamps for time-based data
- Use semantic versioning for models and features

### 2. **Metadata Management**
- Store metadata alongside artifacts
- Include checksums for integrity verification
- Tag blobs for easy querying

### 3. **Security**
- Use Managed Identity for authentication
- Implement RBAC at container level
- Enable blob versioning for critical data

### 4. **Cost Optimization**
- Use lifecycle policies for automatic tiering
- Compress large files (gzip, parquet)
- Delete temporary files promptly

### 5. **Performance**
- Cache frequently accessed models locally
- Use batch operations for uploads
- Leverage Azure CDN for static assets

---

## Monitoring & Observability

### Key Metrics to Track

```python
# Example metrics to monitor
storage_metrics = {
    "container_size_gb": {
        "datasets": 500,
        "models": 200,
        "audit-logs": 1000
    },
    "daily_operations": {
        "uploads": 150,
        "downloads": 5000,
        "deletes": 50
    },
    "access_patterns": {
        "hot_tier_access": 4500,
        "cool_tier_access": 200,
        "archive_tier_access": 10
    },
    "cost_per_month_usd": {
        "storage": 150,
        "operations": 50,
        "data_transfer": 30
    }
}
```

### Alerts to Configure

1. **Storage capacity** > 80% of quota
2. **Failed uploads** > 5% of total operations
3. **Access latency** > 1 second (p99)
4. **Cost anomalies** > 20% increase week-over-week

---

## Migration & Disaster Recovery

### Backup Strategy

```python
# Automated backup script
def create_production_snapshot():
    """Create snapshot of production models and configs"""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    
    # Backup production models
    backup_path = f"backups/models/{timestamp}/"
    
    # Copy production models to backup
    source_container = "models"
    source_prefix = "production/active/"
    
    # Implementation using Azure SDK
    # ...
```

### Disaster Recovery Plan

1. **RTO (Recovery Time Objective)**: 4 hours
2. **RPO (Recovery Point Objective)**: 1 hour
3. **Geo-Redundancy**: Enabled (GRS)
4. **Backup Frequency**: Daily for critical data

---

## Appendix

### A. Container Size Estimates

| Container | Initial Size | 1 Year Projection | 3 Year Projection |
|-----------|--------------|-------------------|-------------------|
| datasets | 50 GB | 500 GB | 2 TB |
| models | 10 GB | 100 GB | 500 GB |
| features | 20 GB | 200 GB | 800 GB |
| monitoring | 5 GB | 100 GB | 500 GB |
| audit-logs | 10 GB | 500 GB | 2 TB |
| experiments | 30 GB | 200 GB | 800 GB |
| backups | 20 GB | 150 GB | 600 GB |
| **Total** | **145 GB** | **1.75 TB** | **7.2 TB** |

### B. Cost Estimation (Monthly)

**Assumptions**: 
- Hot tier: $0.0184/GB
- Cool tier: $0.01/GB
- Archive tier: $0.002/GB
- Operations: $0.05 per 10,000 transactions

| Tier | Storage (GB) | Cost |
|------|--------------|------|
| Hot | 200 | $3.68 |
| Cool | 800 | $8.00 |
| Archive | 750 | $1.50 |
| Operations | 1M/month | $5.00 |
| **Total** | **1750 GB** | **~$18.18** |

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-22  
**Maintained By**: Platform Architecture Team  
**Review Cycle**: Quarterly
