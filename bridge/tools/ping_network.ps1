# bridge/tools/ping_network.ps1
param(
  [string]$Target = "8.8.8.8",
  [int]$Count = 3
)
$ErrorActionPreference = 'SilentlyContinue'

$pingOutput = ping -n $Count $Target | Out-String

$sent = 0
$received = 0
$lost = 0
$lossPct = 100
$minMs = -1
$maxMs = -1
$avgMs = -1

if ($pingOutput -match 'Packets: Sent = (\d+), Received = (\d+), Lost = (\d+) \((\d+)% loss\)') {
  $sent = [int]$matches[1]
  $received = [int]$matches[2]
  $lost = [int]$matches[3]
  $lossPct = [int]$matches[4]
}

if ($pingOutput -match 'Minimum = (\d+)ms, Maximum = (\d+)ms, Average = (\d+)ms') {
  $minMs = [int]$matches[1]
  $maxMs = [int]$matches[2]
  $avgMs = [int]$matches[3]
}

[PSCustomObject]@{
  Target = $Target
  Sent = $sent
  Received = $received
  Lost = $lost
  LossPercent = $lossPct
  MinLatencyMs = $minMs
  MaxLatencyMs = $maxMs
  AvgLatencyMs = $avgMs
  Raw = $pingOutput.Trim()
  Success = ($received -gt 0)
} | ConvertTo-Json -Compress
