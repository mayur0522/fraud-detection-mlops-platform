
# Container Apps Module

variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

variable "resource_prefix" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "database_connection" {
  type      = string
  sensitive = true
}

variable "redis_connection" {
  type      = string
  sensitive = true
}

variable "storage_connection" {
  type      = string
  sensitive = true
}

variable "keyvault_uri" {
  type = string
}

variable "tags" {
  type = map(string)
}

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.resource_prefix}-logs"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

# Container Apps Environment
resource "azurerm_container_app_environment" "main" {
  name                       = "${var.resource_prefix}-env"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  infrastructure_subnet_id   = var.subnet_id
  tags                       = var.tags

  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
    minimum_count         = 0
    maximum_count         = 10
  }
}

# Backend API Container App
resource "azurerm_container_app" "api" {
  name                         = "${var.resource_prefix}-api"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  template {
    container {
      name   = "api"
      image  = "shadowhubble.azurecr.io/shadowhubble-api:latest"
      cpu    = 1.0
      memory = "2Gi"

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }

      env {
        name        = "REDIS_URL"
        secret_name = "redis-url"
      }

      env {
        name        = "AZURE_STORAGE_CONNECTION_STRING"
        secret_name = "storage-connection"
      }

      env {
        name  = "AZURE_KEYVAULT_URI"
        value = var.keyvault_uri
      }

      liveness_probe {
        path                    = "/health"
        port                    = 8000
        transport               = "HTTP"
        initial_delay           = 10
        interval_seconds        = 30
        failure_count_threshold = 3
      }

      readiness_probe {
        path             = "/health"
        port             = 8000
        transport        = "HTTP"
        interval_seconds = 10
      }
    }

    min_replicas = 1
    max_replicas = 10

    http_scale_rule {
      name                = "http-scale"
      concurrent_requests = 100
    }
  }

  ingress {
    external_enabled = true
    target_port      = 8000

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  secret {
    name  = "database-url"
    value = var.database_connection
  }

  secret {
    name  = "redis-url"
    value = var.redis_connection
  }

  secret {
    name  = "storage-connection"
    value = var.storage_connection
  }
}

# Frontend UI Container App
resource "azurerm_container_app" "ui" {
  name                         = "${var.resource_prefix}-ui"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  template {
    container {
      name   = "ui"
      image  = "shadowhubble.azurecr.io/shadowhubble-ui:latest"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "VITE_API_URL"
        value = "https://${azurerm_container_app.api.ingress[0].fqdn}"
      }
    }

    min_replicas = 1
    max_replicas = 5
  }

  ingress {
    external_enabled = true
    target_port      = 3000

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }
}

# Celery Worker Container App
resource "azurerm_container_app" "worker" {
  name                         = "${var.resource_prefix}-worker"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  template {
    container {
      name   = "worker"
      image  = "shadowhubble.azurecr.io/shadowhubble-worker:latest"
      cpu    = 1.0
      memory = "2Gi"

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }

      env {
        name        = "CELERY_BROKER_URL"
        secret_name = "redis-url"
      }

      env {
        name        = "AZURE_STORAGE_CONNECTION_STRING"
        secret_name = "storage-connection"
      }
    }

    min_replicas = 1
    max_replicas = 5
  }

  secret {
    name  = "database-url"
    value = var.database_connection
  }

  secret {
    name  = "redis-url"
    value = var.redis_connection
  }

  secret {
    name  = "storage-connection"
    value = var.storage_connection
  }
}

# Outputs
output "api_url" {
  value = "https://${azurerm_container_app.api.ingress[0].fqdn}"
}

output "ui_url" {
  value = "https://${azurerm_container_app.ui.ingress[0].fqdn}"
}

output "environment_id" {
  value = azurerm_container_app_environment.main.id
}
