param(
  [string]$BaseUrl = 'http://127.0.0.1:4310',
  [string]$ServiceName = 'FarmaCoreApi'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$required = @('DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'LICENSE_PUBLIC_KEY_BASE64', 'PROVISIONING_TOKEN')
$envKeys = Get-Content -LiteralPath '.env' -ErrorAction SilentlyContinue |
  ForEach-Object {
    if ($_ -match '^ *([A-Za-z_][A-Za-z0-9_]*) *=') {
      $Matches[1]
    }
  }
$missing = @($required | Where-Object { $_ -notin $envKeys })

if ($missing.Count -gt 0) {
  Write-Warning "Faltan variables obligatorias en .env: $($missing -join ', ')"
}

$apiDist = Join-Path $Root 'apps/local-api/dist/main.js'
$desktopDist = Join-Path $Root 'apps/desktop/dist'
$bundleRoot = Join-Path $Root 'apps/desktop/src-tauri/target/release/bundle'
$releaseRoot = Join-Path $Root 'release'
$releaseInstaller = Get-ChildItem -LiteralPath $releaseRoot -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Extension -in '.msi', '.exe' } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$checks = [ordered]@{
  apiBuildExists = (Test-Path -LiteralPath $apiDist)
  desktopBuildExists = (Test-Path -LiteralPath $desktopDist)
  tauriBundleExists = ((Test-Path -LiteralPath $bundleRoot) -or [bool]$releaseInstaller)
  envReady = ($missing.Count -eq 0)
}

$checks.installerSigned = $false
$checks.installerSignatureStatus = 'missing'
if ($releaseInstaller) {
  $signature = Get-AuthenticodeSignature -LiteralPath $releaseInstaller.FullName
  $checks.installerSignatureStatus = $signature.Status.ToString()
  $checks.installerSigned = ($signature.Status -eq 'Valid')
  if (-not $checks.installerSigned) {
    Write-Warning "El instalador comercial no tiene una firma Authenticode valida: $($checks.installerSignatureStatus)."
  }
}

if (-not $checks.apiBuildExists) {
  Write-Warning 'No existe el backend compilado en apps/local-api/dist/main.js.'
}

if (-not $checks.desktopBuildExists) {
  Write-Warning 'No existe la compilacion web del escritorio en apps/desktop/dist.'
}

if (-not $checks.tauriBundleExists) {
  Write-Warning 'No existe el bundle Tauri de Windows en apps/desktop/src-tauri/target/release/bundle.'
}

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
$checks.serviceInstalled = [bool]$service
if ($service) {
  $checks.serviceStatus = $service.Status.ToString()
} else {
  $checks.serviceStatus = 'not-installed'
}
$container = $null
try {
  $container = docker ps --filter 'name=^/farmacore-api$' --filter 'status=running' --format '{{.Names}}' 2>$null
} catch {
  $container = $null
}
$checks.containerRunning = ($container -eq 'farmacore-api')
$checks.runtimeReady = ($checks.containerRunning -or ($service -and $service.Status -eq 'Running'))

try {
  $response = Invoke-WebRequest -Uri ($BaseUrl + '/api/v1/health') -Method Get -TimeoutSec 10 -UseBasicParsing
  $checks.apiHealth = $response.StatusCode -eq 200
  $payload = $response.Content | ConvertFrom-Json
  $checks.apiStatus = $payload.status
  $checks.dbStatus = $payload.database
} catch {
  $checks.apiHealth = $false
  $checks.apiStatus = 'unreachable'
  $checks.dbStatus = 'unreachable'
}

[pscustomobject]@{
  ready = ($checks.apiBuildExists -and $checks.desktopBuildExists -and $checks.tauriBundleExists -and $checks.envReady -and $checks.installerSigned -and $checks.runtimeReady -and $checks.apiHealth)
  root = $Root
  envReady = $checks.envReady
  apiBuildExists = $checks.apiBuildExists
  desktopBuildExists = $checks.desktopBuildExists
  tauriBundleExists = $checks.tauriBundleExists
  installerSigned = $checks.installerSigned
  installerSignatureStatus = $checks.installerSignatureStatus
  serviceInstalled = $checks.serviceInstalled
  serviceStatus = $checks.serviceStatus
  containerRunning = $checks.containerRunning
  runtimeReady = $checks.runtimeReady
  apiHealth = $checks.apiHealth
  apiStatus = $checks.apiStatus
  dbStatus = $checks.dbStatus
}
