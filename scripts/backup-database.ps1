param([string]$EnvironmentFile=".env",[string]$OutputDirectory=".local/backups",[int]$RetentionDays=30,[string]$DockerContainer="farmacore-postgres")
$ErrorActionPreference="Stop"
$root=Split-Path -Parent $PSScriptRoot
$envPath=Join-Path $root $EnvironmentFile
$line=Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^ *DATABASE_URL *=' } | Select-Object -First 1
if(-not $line){throw "DATABASE_URL no esta configurada"}
$uri=[Uri](($line -replace '^ *DATABASE_URL *= *','').Trim().Trim('"').Trim("'"))
$credentials=$uri.UserInfo.Split(':',2)
$user=[Uri]::UnescapeDataString($credentials[0])
$password=if($credentials.Count -gt 1){[Uri]::UnescapeDataString($credentials[1])}else{""}
$database=$uri.AbsolutePath.TrimStart('/')
$running=docker ps --filter "name=^/$DockerContainer$" --filter "status=running" --format "{{.Names}}" 2>$null
if($running -ne $DockerContainer -and $DockerContainer -eq "farmacore-postgres"){
  $developmentContainer="farmacore-postgres-dev"
  $developmentRunning=docker ps --filter "name=^/$developmentContainer$" --filter "status=running" --format "{{.Names}}" 2>$null
  if($developmentRunning -eq $developmentContainer){$DockerContainer=$developmentContainer;$running=$developmentRunning}
}
if($running -ne $DockerContainer){throw "El contenedor $DockerContainer no esta activo"}
$outputRoot=if([IO.Path]::IsPathRooted($OutputDirectory)){[IO.Path]::GetFullPath($OutputDirectory)}else{[IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))}
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
$stamp=Get-Date -Format "yyyyMMdd-HHmmss"
$final=Join-Path $outputRoot "farmacore-$stamp.dump"
$partial="$final.partial"
$manifest="$final.json"
$containerFile="/tmp/farmacore-backup.dump"
try{
  docker exec -e "PGPASSWORD=$password" $DockerContainer pg_dump --format=custom --compress=9 --no-owner --no-privileges --username=$user --file=$containerFile $database
  if($LASTEXITCODE -ne 0){throw "pg_dump termino con codigo $LASTEXITCODE"}
  $source=$DockerContainer+":"+$containerFile
  docker cp $source $partial
  if($LASTEXITCODE -ne 0){throw "No se pudo copiar el respaldo"}
  Move-Item -LiteralPath $partial -Destination $final
}finally{
  docker exec $DockerContainer rm -f $containerFile 2>$null | Out-Null
  if(Test-Path $partial){Remove-Item -LiteralPath $partial -Force}
}
$hash=(Get-FileHash $final -Algorithm SHA256).Hash
$data=[ordered]@{version=1;createdAt=(Get-Date).ToUniversalTime().ToString("o");database=$database;host=$uri.Host;port=$uri.Port;file=[IO.Path]::GetFileName($final);bytes=(Get-Item $final).Length;sha256=$hash;engine="docker:$DockerContainer"}
$data|ConvertTo-Json|Set-Content -LiteralPath $manifest -Encoding UTF8
if($RetentionDays -gt 0){
  $cutoff=(Get-Date).AddDays(-$RetentionDays)
  Get-ChildItem $outputRoot -File|Where-Object{$_.LastWriteTime -lt $cutoff -and ($_.Name -like "farmacore-*.dump" -or $_.Name -like "farmacore-*.dump.json")}|Remove-Item -Force
}
[pscustomobject]@{backup=$final;manifest=$manifest;sha256=$hash;bytes=$data.bytes;engine=$data.engine}