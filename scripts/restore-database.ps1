param([Parameter(Mandatory=$true)][string]$BackupPath,[Parameter(Mandatory=$true)][string]$TargetDatabase,[string]$EnvironmentFile=".env",[switch]$RecreateTarget,[string]$DockerContainer="farmacore-postgres")
$ErrorActionPreference="Stop"
if($TargetDatabase -notmatch '^[a-zA-Z][a-zA-Z0-9_]{2,62}$'){throw "Nombre de base de datos invalido"}
$backup=(Resolve-Path $BackupPath).Path
$manifest="$backup.json"
if(-not(Test-Path $manifest)){throw "Falta el manifiesto"}
$metadata=Get-Content $manifest -Raw|ConvertFrom-Json
$hash=(Get-FileHash $backup -Algorithm SHA256).Hash
if($hash -ne $metadata.sha256){throw "Checksum SHA-256 invalido"}
$root=Split-Path -Parent $PSScriptRoot
$line=Get-Content (Join-Path $root $EnvironmentFile)|Where-Object{$_ -match '^ *DATABASE_URL *='}|Select-Object -First 1
if(-not $line){throw "DATABASE_URL no esta configurada"}
$uri=[Uri](($line -replace '^ *DATABASE_URL *= *','').Trim().Trim('"').Trim("'"))
$credentials=$uri.UserInfo.Split(':',2)
$user=[Uri]::UnescapeDataString($credentials[0])
$password=if($credentials.Count -gt 1){[Uri]::UnescapeDataString($credentials[1])}else{""}
$running=docker ps --filter "name=^/$DockerContainer$" --filter "status=running" --format "{{.Names}}" 2>$null
if($running -ne $DockerContainer -and $DockerContainer -eq "farmacore-postgres"){
  $developmentContainer="farmacore-postgres-dev"
  $developmentRunning=docker ps --filter "name=^/$developmentContainer$" --filter "status=running" --format "{{.Names}}" 2>$null
  if($developmentRunning -eq $developmentContainer){$DockerContainer=$developmentContainer;$running=$developmentRunning}
}
if($running -ne $DockerContainer){throw "El contenedor $DockerContainer no esta activo"}
$containerFile="/tmp/farmacore-restore.dump"
try{
  $destination=$DockerContainer+":"+$containerFile
  docker cp $backup $destination
  if($LASTEXITCODE -ne 0){throw "No se pudo copiar el respaldo"}
  docker exec -e "PGPASSWORD=$password" $DockerContainer pg_restore --list $containerFile|Out-Null
  if($LASTEXITCODE -ne 0){throw "Respaldo PostgreSQL invalido"}
  if($RecreateTarget){
    docker exec -e "PGPASSWORD=$password" $DockerContainer dropdb --if-exists --force --username=$user $TargetDatabase
    if($LASTEXITCODE -ne 0){throw "No se pudo limpiar la base de destino"}
  }
  docker exec -e "PGPASSWORD=$password" $DockerContainer createdb --username=$user $TargetDatabase
  if($LASTEXITCODE -ne 0){throw "No se pudo crear la base de destino"}
  docker exec -e "PGPASSWORD=$password" $DockerContainer pg_restore --exit-on-error --no-owner --no-privileges --username=$user --dbname=$TargetDatabase $containerFile
  if($LASTEXITCODE -ne 0){throw "La restauracion fallo"}
  $count=docker exec -e "PGPASSWORD=$password" $DockerContainer psql --username=$user --dbname=$TargetDatabase --tuples-only --no-align --command="SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
  if($LASTEXITCODE -ne 0 -or [int]$count -lt 1){throw "La base restaurada no contiene tablas"}
  [pscustomobject]@{restored=$true;database=$TargetDatabase;tables=[int]$count;sha256=$hash;engine="docker:$DockerContainer"}
}finally{docker exec $DockerContainer rm -f $containerFile 2>$null|Out-Null}