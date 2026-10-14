$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$envPath = Join-Path $Root '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Falta .env en $Root. Copia .env.example y completa los secretos antes de arrancar la API del servicio."
}

$env:FARMACORE_ENV_FILE = $envPath
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$scriptPath = Join-Path $Root 'apps/local-api/dist/main.js'

if (-not (Test-Path -LiteralPath $scriptPath)) {
  throw "No existe el backend compilado: $scriptPath. Ejecuta primero pnpm db:generate y pnpm --dir apps/local-api build."
}

& $nodeExecutable --env-file=$envPath $scriptPath
exit $LASTEXITCODE
