param(
  [switch]$SkipApiBuild,
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

if (-not $SkipApiBuild) {
  corepack pnpm db:generate
  corepack pnpm --dir apps/local-api build
}

if (-not $SkipDesktopBuild) {
  if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw 'Rust / cargo no está instalado. Es obligatorio para compilar el cliente Tauri de Windows.'
  }

  corepack pnpm --dir apps/desktop build
  corepack pnpm --dir apps/desktop tauri build --bundles msi
}

Write-Host 'Compilación de entrega completada.' -ForegroundColor Green
Write-Host "Bundle generado en: $Root\apps\desktop\src-tauri\target\release\bundle" -ForegroundColor Cyan
