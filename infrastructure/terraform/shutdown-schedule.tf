# Auto-Shutdown Schedule for FinOps

resource "azurerm_dev_test_global_vm_shutdown_schedule" "k3s_shutdown" {
  virtual_machine_id = azurerm_linux_virtual_machine.k3s.id
  location           = azurerm_resource_group.main.location
  enabled            = true

  daily_recurrence_time = "1900"
  timezone              = "India Standard Time"

  notification_settings {
    enabled = false
  }
}
