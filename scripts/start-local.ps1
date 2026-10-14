param(
  [switch]$SkipDatabase,
  [switch]$SkipMigrate,
  [switch]$SkipSeed
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Test-Path '.env')) {
  throw 'Falta .env. Copie .env.example y reemplace los secretos antes de arrancar FarmaCore.'
}

$required = @('DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SEED_OWNER_PASSWORD')
foreach ($variable in $required) {
  $escapedVariable = [regex]::Escape($variable)
  $value = Get-Content -LiteralPath '.env' |
    Where-Object { $_ -match "^\s*$escapedVariable\s*=" } |
    Select-Object -First 1
  if (-not $value) {
    throw "Falta la variable $variable en .env. Copia el ejemplo y complétala."
  }

  $assigned = ($value -split '=', 2)[1].Trim().Trim('"').Trim("'")
  if (-not $assigned) {
    throw "La variable $variable no puede quedar vacía."
  }
}

if (-not $SkipDatabase) {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker Desktop no está instalado o no está disponible en PATH.'
  }
  docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --wait
}

corepack pnpm install --frozen-lockfile
corepack pnpm db:generate
if (-not $SkipMigrate) { corepack pnpm db:migrate }
if (-not $SkipSeed) { corepack pnpm db:seed }

Write-Host 'FarmaCore listo. Iniciando API y escritorio...' -ForegroundColor Green
corepack pnpm dev
