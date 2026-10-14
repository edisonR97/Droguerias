param(
  [switch]$SkipApiBuild,
  [switch]$SkipDesktopBuild,
  [switch]$SkipServiceInstall,
  [switch]$SkipHealthCheck,
  [string]$CertificatePath,
  [string]$CertificatePassword = '',
  [string]$ServiceName = 'FarmaCoreApi'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host 'Iniciando entrega Windows de FarmaCore ERP...' -ForegroundColor Cyan

& (Join-Path $PSScriptRoot 'build-release.ps1') -SkipApiBuild:$SkipApiBuild -SkipDesktopBuild:$SkipDesktopBuild
& (Join-Path $PSScriptRoot 'build-installer.ps1') -SkipDesktopBuild:$SkipDesktopBuild -CertificatePath $CertificatePath -CertificatePassword $CertificatePassword

if (-not $SkipServiceInstall) {
  & (Join-Path $PSScriptRoot 'install-windows-service.ps1') -ServiceName $ServiceName
}

if (-not $SkipHealthCheck) {
  & (Join-Path $PSScriptRoot 'check-health.ps1')
}

Write-Host 'Entrega Windows completada correctamente.' -ForegroundColor Green
