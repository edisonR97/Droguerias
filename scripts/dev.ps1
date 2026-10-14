param([switch]$SkipDatabase, [switch]$SkipMigrate)
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path '.env')) { throw 'Falta .env. Copie .env.example y reemplace todos los secretos antes de iniciar el ERP.' }

$required = @('DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SEED_OWNER_PASSWORD')
foreach ($variable in $required) {
  $value = Get-Content -LiteralPath '.env' | Where-Object { $_ -match "^\s*$([regex]::Escape($variable))\s*=" } | Select-Object -First 1
  if (-not $value) { throw "Falta la variable $variable en .env" }
  $assigned = ($value -split '=', 2)[1].Trim().Trim('"').Trim("'")
  if (-not $assigned) { throw "La variable $variable no puede quedar vacía" }
}

if (-not $SkipDatabase) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker Desktop no está disponible. Instálelo para iniciar PostgreSQL local.'
  }
  docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --wait
}

corepack pnpm db:generate
if (-not $SkipMigrate) { corepack pnpm db:migrate }
corepack pnpm dev
