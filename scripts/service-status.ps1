param(
  [string]$ServiceName = 'FarmaCoreApi'
)

$ErrorActionPreference = 'Stop'
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
  throw "El servicio $ServiceName no está instalado."
}

[pscustomobject]@{
  installed = $true
  serviceName = $service.Name
  status = $service.Status.ToString()
  startType = $service.StartType.ToString()
}
