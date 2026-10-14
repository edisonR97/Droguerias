param(
  [string]$ServiceName = 'FarmaCoreApi'
)

$ErrorActionPreference = 'Stop'
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
  throw "El servicio $ServiceName no existe."
}

if ($service.Status -eq 'Running') {
  Stop-Service -Name $ServiceName -Force
}

$service | Remove-Service

[pscustomobject]@{
  removed = $true
  serviceName = $ServiceName
}
