data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                        = "${local.resource_prefix}-kv"
  location                    = azurerm_resource_group.main.location
  resource_group_name         = azurerm_resource_group.main.name
  enabled_for_disk_encryption = true
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days  = 7
  purge_protection_enabled    = false

  sku_name = "standard"

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete", "Purge", "Recover"
    ]
  }

  # Allow the K3s VM to read secrets
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = azurerm_linux_virtual_machine.k3s.identity[0].principal_id

    secret_permissions = [
      "Get", "List"
    ]
  }

  tags = local.common_tags
}

output "key_vault_url" {
  value = azurerm_key_vault.main.vault_uri
}
