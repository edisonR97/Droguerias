param(
  [string]$CertificatePath,
  [string]$CertificatePassword = '',
  [switch]$SkipDesktopBuild
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path '.env')) {
  throw 'Falta .env para compilar la versión de entrega. Copia .env.example y completa los secretos.'
}

$required = @('DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'LICENSE_PUBLIC_KEY_BASE64', 'PROVISIONING_TOKEN')
foreach ($variable in $required) {
  $escapedVariable = [regex]::Escape($variable)
  $value = Get-Content -LiteralPath '.env' |
    Where-Object { $_ -match "^\s*$escapedVariable\s*=" } |
    Select-Object -First 1

  if (-not $value) {
    throw "Falta la variable $variable en .env."
  }
}

if (-not $SkipDesktopBuild) {
  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw 'Rust / cargo no está instalado. Es obligatorio para compilar el cliente Tauri de Windows.'
  }

  corepack pnpm --dir apps/desktop build
  corepack pnpm --dir apps/desktop tauri build --bundles msi
}

$bundleRoot = Join-Path $Root 'apps/desktop/src-tauri/target/release/bundle'
if (-not (Test-Path -LiteralPath $bundleRoot)) {
  throw "No existe el directorio de bundle: $bundleRoot. Ejecuta la compilación de escritorio antes de generar instaladores."
}

$artifacts = Get-ChildItem -LiteralPath $bundleRoot -Recurse -File |
  Where-Object { $_.Extension -in '.msi', '.exe', '.zip' } |
  Sort-Object FullName

if (-not $artifacts) {
  throw "No se encontraron artefactos de instalador en $bundleRoot."
}

if ($CertificatePath) {
  if (-not (Test-Path -LiteralPath $CertificatePath)) {
    throw "El certificado $CertificatePath no existe."
  }

  if (-not (Get-Command signtool -ErrorAction SilentlyContinue)) {
    throw 'No se encontró signtool. Instala el SDK de Windows o entrega el certificado en una máquina con SignTool.'
  }

  foreach ($artifact in $artifacts) {
    & signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /f $CertificatePath /p $CertificatePassword $artifact.FullName
    if ($LASTEXITCODE -ne 0) {
      throw "La firma del artefacto $($artifact.FullName) falló."
    }
  }
}

$releaseRoot = Join-Path $Root 'release'
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
foreach ($artifact in $artifacts) {
  Copy-Item -LiteralPath $artifact.FullName -Destination (Join-Path $releaseRoot $artifact.Name) -Force
}

Write-Host 'Instaladores listos para distribuir:' -ForegroundColor Green
foreach ($artifact in $artifacts) {
  Write-Host $artifact.FullName -ForegroundColor Cyan
}

[pscustomobject]@{
  ready = $true
  bundleRoot = $bundleRoot
  releaseRoot = $releaseRoot
  artifacts = @($artifacts.FullName)
  signed = [bool]$CertificatePath
}
