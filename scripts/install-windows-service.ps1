param(
  [string]$ServiceName = 'FarmaCoreApi',
  [string]$DisplayName = 'FarmaCore API',
  [string]$Description = 'FarmaCore ERP local API',
  [string]$AppRoot = (Join-Path $PSScriptRoot '..'),
  [string]$EnvironmentFile = '.env'
)

$ErrorActionPreference = 'Stop'
$resolvedRoot = (Resolve-Path -LiteralPath $AppRoot).Path
$envPath = Join-Path $resolvedRoot $EnvironmentFile
$hostScriptPath = Join-Path $resolvedRoot 'scripts/service-host.ps1'
$powershellExecutable = (Get-Command powershell -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Falta $EnvironmentFile en $resolvedRoot. Copia .env.example y completa los secretos antes de instalar el servicio."
}

if (-not (Test-Path -LiteralPath $hostScriptPath)) {
  throw "No existe el script de host del servicio: $hostScriptPath."
}

if (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue) {
  throw "El servicio $ServiceName ya existe. Elimínelo antes de reinstalarlo."
}

$binary = '"' + $powershellExecutable + '" -NoProfile -ExecutionPolicy Bypass -File "' + $hostScriptPath + '"'
New-Service -Name $ServiceName -BinaryPathName $binary -DisplayName $DisplayName -Description $Description -StartupType Automatic | Out-Null
Start-Service -Name $ServiceName

[pscustomobject]@{
  installed = $true
  serviceName = $ServiceName
  displayName = $DisplayName
  path = $binary
  workingDirectory = $resolvedRoot
  environmentFile = $envPath
}
