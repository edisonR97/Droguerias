param(
  [string]$CertificatePath,
  [string]$CertificatePassword = '',
  [string]$BundleRoot = 'apps/desktop/src-tauri/target/release/bundle'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not $CertificatePath) {
  throw 'Debe indicar la ruta del certificado con -CertificatePath.'
}

if (-not (Test-Path -LiteralPath $CertificatePath)) {
  throw "El certificado $CertificatePath no existe."
}

$resolvedBundle = Join-Path $Root $BundleRoot
if (-not (Test-Path -LiteralPath $resolvedBundle)) {
  throw "No existe la carpeta de bundle: $resolvedBundle. Genera primero el instalador con pnpm installer:windows."
}

$artifacts = Get-ChildItem -LiteralPath $resolvedBundle -Recurse -File |
  Where-Object { $_.Extension -in '.msi', '.exe', '.zip' } |
  Sort-Object FullName

if (-not $artifacts) {
  throw "No se encontraron artefactos en $resolvedBundle para firmar."
}

if (-not (Get-Command signtool -ErrorAction SilentlyContinue)) {
  throw 'No se encontró signtool. Instala el SDK de Windows para firmar el cliente.'
}

foreach ($artifact in $artifacts) {
  & signtool sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /f $CertificatePath /p $CertificatePassword $artifact.FullName
  if ($LASTEXITCODE -ne 0) {
    throw "La firma del artefacto $($artifact.FullName) falló."
  }
}

[pscustomobject]@{
  signed = $true
  bundleRoot = $resolvedBundle
  artifacts = @($artifacts.FullName)
}
