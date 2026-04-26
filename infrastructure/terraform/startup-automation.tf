# Azure Automation Account for VM Start Schedule
resource "azurerm_automation_account" "automation" {
  name                = "${local.resource_prefix}-aa"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku_name            = "Basic"
  tags                = local.common_tags

  identity {
    type = "SystemAssigned"
  }
}

# Role Assignment to allow Automation Account to start the VM
/*
resource "azurerm_role_assignment" "aa_vm_contributor" {
  scope                = azurerm_linux_virtual_machine.k3s.id
  role_definition_name = "Virtual Machine Contributor"
  principal_id         = azurerm_automation_account.automation.identity[0].principal_id
}
*/

# Runbook to start the VM
resource "azurerm_automation_runbook" "start_vm" {
  name                    = "Start-K3s-VM"
  location                = azurerm_resource_group.main.location
  resource_group_name     = azurerm_resource_group.main.name
  automation_account_name = azurerm_automation_account.automation.name
  log_verbose             = "true"
  log_progress            = "true"
  description             = "Starts the FinOps K3s VM"
  runbook_type            = "PowerShell"

  content = <<-EOF
    param(
        [string]$ResourceGroupName,
        [string]$VMName
    )
    
    # Authenticate using Managed Identity
    Connect-AzAccount -Identity
    
    # Start VM
    Start-AzVM -ResourceGroupName $ResourceGroupName -Name $VMName
  EOF
}

# Schedule to explicitly run at 9 AM Monday to Friday
resource "azurerm_automation_schedule" "start_schedule" {
  name                    = "Start-VM-Weekdays-9AM"
  resource_group_name     = azurerm_resource_group.main.name
  automation_account_name = azurerm_automation_account.automation.name
  frequency               = "Week"
  interval                = 1
  timezone                = "Asia/Kolkata"
  start_time              = "2026-04-22T09:00:00+05:30"
  description             = "Start VM at 9 AM on Weekdays"
  week_days               = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
}

# Link schedule to runbook
/*
resource "azurerm_automation_job_schedule" "link" {
  resource_group_name     = azurerm_resource_group.main.name
  automation_account_name = azurerm_automation_account.automation.name
  schedule_name           = azurerm_automation_schedule.start_schedule.name
  runbook_name            = azurerm_automation_runbook.start_vm.name

  parameters = {
    resourcegroupname = azurerm_resource_group.main.name
    vmname            = azurerm_linux_virtual_machine.k3s.name
  }
}
*/
