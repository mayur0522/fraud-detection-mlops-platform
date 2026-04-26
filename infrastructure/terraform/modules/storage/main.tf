# Storage Module - Updated for MLOps Platform
# Implements comprehensive 8-container blob storage schema

variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "resource_prefix" {
  type = string
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "tags" {
  type = map(string)
}

# Storage Account
resource "azurerm_storage_account" "main" {
  name                     = replace("${var.resource_prefix}mlops", "-", "")
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = var.environment == "prod" ? "GRS" : "LRS"
  account_kind             = "StorageV2"
  min_tls_version          = "TLS1_2"
  
  blob_properties {
    versioning_enabled = true

    delete_retention_policy {
      days = 30
    }

    container_delete_retention_policy {
      days = 30
    }
  }

  tags = var.tags
}

# Container definitions
locals {
  containers = {
    datasets = {
      name        = "datasets"
      description = "Raw, processed, and labeled training datasets"
    }
    models = {
      name        = "models"
      description = "Model registry, staging, and production artifacts"
    }
    features = {
      name        = "features"
      description = "Feature definitions, computed features, validation"
    }
    monitoring = {
      name        = "monitoring"
      description = "Drift reports, bias analysis, performance metrics"
    }
    audit-logs = {
      name        = "audit-logs"
      description = "Predictions, lineage, compliance logs"
    }
    experiments = {
      name        = "experiments"
      description = "Training experiments, A/B tests, hyperparameter tuning"
    }
    backups = {
      name        = "backups"
      description = "Database backups, model snapshots, configurations"
    }
    temp-processing = {
      name        = "temp-processing"
      description = "Temporary processing jobs (7-day TTL)"
    }
  }
}

# Create all blob containers
resource "azurerm_storage_container" "containers" {
  for_each              = local.containers
  name                  = each.value.name
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = "private"
}

# Lifecycle Management Policies
resource "azurerm_storage_management_policy" "mlops_lifecycle" {
  storage_account_id = azurerm_storage_account.main.id

  # Rule 1: datasets - Cool after 90 days, Archive after 365 days
  rule {
    name    = "datasets-tiering"
    enabled = true

    filters {
      prefix_match = ["datasets/raw/"]
      blob_types   = ["blockBlob"]
    }

    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than    = 90
        tier_to_archive_after_days_since_modification_greater_than = 365
      }
    }
  }

  # Rule 2: temp-processing - Delete after 7 days
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

  # Rule 3: audit-logs predictions - Cool after 90 days, Archive after 730 days
  rule {
    name    = "audit-logs-tiering"
    enabled = true

    filters {
      prefix_match = ["audit-logs/predictions/"]
      blob_types   = ["blockBlob"]
    }

    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than    = 90
        tier_to_archive_after_days_since_modification_greater_than = 730
      }
    }
  }

  # Rule 4: monitoring drift - Cool after 90 days, Archive after 365 days
  rule {
    name    = "monitoring-tiering"
    enabled = true

    filters {
      prefix_match = ["monitoring/drift/"]
      blob_types   = ["blockBlob"]
    }

    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than    = 90
        tier_to_archive_after_days_since_modification_greater_than = 365
      }
    }
  }

  # Rule 5: models archived - Archive after 180 days
  rule {
    name    = "models-archive"
    enabled = true

    filters {
      prefix_match = ["models/archived/"]
      blob_types   = ["blockBlob"]
    }

    actions {
      base_blob {
        tier_to_archive_after_days_since_modification_greater_than = 180
      }
    }
  }

  # Rule 6: experiments - Cool after 180 days
  rule {
    name    = "experiments-tiering"
    enabled = true

    filters {
      prefix_match = ["experiments/"]
      blob_types   = ["blockBlob"]
    }

    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than = 180
      }
    }
  }
}

# Outputs
output "storage_account_id" {
  value       = azurerm_storage_account.main.id
  description = "Storage account resource ID"
}

output "storage_account_name" {
  value       = azurerm_storage_account.main.name
  description = "Storage account name"
}

output "primary_blob_endpoint" {
  value       = azurerm_storage_account.main.primary_blob_endpoint
  description = "Primary blob storage endpoint"
}

output "connection_string" {
  value       = azurerm_storage_account.main.primary_connection_string
  sensitive   = true
  description = "Storage account connection string"
}

output "containers" {
  value = {
    for k, v in azurerm_storage_container.containers : k => {
      name = v.name
      id   = v.id
    }
  }
  description = "Map of all created containers"
}
