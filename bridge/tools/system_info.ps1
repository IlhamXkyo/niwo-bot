# bridge/tools/system_info.ps1
$ErrorActionPreference = 'SilentlyContinue'
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$battery = Get-CimInstance Win32_Battery | Select-Object -First 1
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"

$totalRamGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
$freeRamGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
$usedRamGB = [math]::Round($totalRamGB - $freeRamGB, 2)
$ramPercent = [math]::Round(($usedRamGB / $totalRamGB) * 100, 1)

$diskTotalGB = [math]::Round($disk.Size / 1GB, 1)
$diskFreeGB = [math]::Round($disk.FreeSpace / 1GB, 1)
$diskUsedGB = [math]::Round($diskTotalGB - $diskFreeGB, 1)
$diskPercent = [math]::Round(($diskUsedGB / $diskTotalGB) * 100, 1)

$uptimeHours = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1)

[PSCustomObject]@{
  OsCaption = $os.Caption
  Cpu = $cpu.Name.Trim()
  CpuLoad = if ($null -ne $cpu.LoadPercentage) { $cpu.LoadPercentage } else { 0 }
  TotalRamGB = $totalRamGB
  FreeRamGB = $freeRamGB
  UsedRamGB = $usedRamGB
  RamPercent = $ramPercent
  Battery = if ($battery) { $battery.EstimatedChargeRemaining } else { -1 }
  BatteryStatus = if ($battery) { $battery.BatteryStatus } else { -1 }
  DiskTotalGB = $diskTotalGB
  DiskFreeGB = $diskFreeGB
  DiskUsedGB = $diskUsedGB
  DiskPercent = $diskPercent
  UptimeHours = $uptimeHours
} | ConvertTo-Json -Compress
