param(
  [string]$EnvironmentFile = ".env",
  [string]$VerificationDatabase = "farmacore_restore_verify"
)

$ErrorActionPreference = "Stop"
$backup = & (Join-Path $PSScriptRoot "backup-database.ps1") -EnvironmentFile $EnvironmentFile -RetentionDays 30
if (-not $backup.backup) { throw "No se generó el respaldo" }
$restore = & (Join-Path $PSScriptRoot "restore-database.ps1") -BackupPath $backup.backup -TargetDatabase $VerificationDatabase -EnvironmentFile $EnvironmentFile -RecreateTarget
if (-not $restore.restored) { throw "La restauración de prueba no fue confirmada" }
[pscustomobject]@{ verified = $true; backup = $backup.backup; bytes = $backup.bytes; restoredTables = $restore.tables; verificationDatabase = $VerificationDatabase }
