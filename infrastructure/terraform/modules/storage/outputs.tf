# Storage Module Outputs

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
  description = "Storage account connection string (sensitive)"
}

output "containers" {
  value = {
    for k, v in azurerm_storage_container.containers : k => {
      name = v.name
      id   = v.id
    }
  }
  description = "Map of all created containers with their names and IDs"
}

output "container_names" {
  value       = [for c in azurerm_storage_container.containers : c.name]
  description = "List of all container names"
}
