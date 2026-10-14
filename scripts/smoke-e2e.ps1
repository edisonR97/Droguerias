param([string]$BaseUrl="http://127.0.0.1:4310",[string]$EnvironmentFile=".env",[switch]$KeepApiRunning)
$ErrorActionPreference="Stop"
$Root=Split-Path -Parent $PSScriptRoot
Set-Location $Root
Get-Content $EnvironmentFile|ForEach-Object{
  if($_ -match '^([^#][A-Za-z_][A-Za-z0-9_]*)=(.*)$'){
    [Environment]::SetEnvironmentVariable($Matches[1],$Matches[2].Trim('"'),'Process')
  }
}
if(-not $env:SEED_OWNER_PASSWORD){throw "SEED_OWNER_PASSWORD no esta configurada"}
$existing=$null
try{$existing=Invoke-RestMethod "$BaseUrl/api/v1/health" -TimeoutSec 2}catch{}
$api=$null
if(-not $existing){
  $api=Start-Process -FilePath (Get-Command node).Source -ArgumentList 'dist/main.js' -WorkingDirectory (Resolve-Path 'apps/local-api') -WindowStyle Hidden -PassThru
}
try{
  $health=$null
  for($i=0;$i -lt 15;$i++){try{$health=Invoke-RestMethod "$BaseUrl/api/v1/health" -TimeoutSec 3;if($health.status -eq 'ok'){break}}catch{};Start-Sleep -Seconds 1}
  if(-not $health -or $health.status -ne 'ok' -or $health.database -ne 'ok'){throw "API o base de datos no saludable"}
  $body=@{email='owner@farmacore.local';password=$env:SEED_OWNER_PASSWORD}|ConvertTo-Json
  $session=Invoke-RestMethod "$BaseUrl/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body $body
  $headers=@{Authorization='Bearer '+$session.accessToken}
  $checks=[ordered]@{
    provisioning=[bool](Invoke-RestMethod "$BaseUrl/api/v1/provisioning/status")
    me=[bool](Invoke-RestMethod "$BaseUrl/api/v1/auth/me" -Headers $headers)
    dashboard=[bool](Invoke-RestMethod "$BaseUrl/api/v1/dashboard/summary" -Headers $headers)
    products=[bool](Invoke-RestMethod "$BaseUrl/api/v1/products?page=1&limit=10" -Headers $headers)
    purchases=[bool](Invoke-RestMethod "$BaseUrl/api/v1/purchases/context" -Headers $headers)
    reports=[bool](Invoke-RestMethod "$BaseUrl/api/v1/reports/summary?from=2026-01-01&to=2026-12-31" -Headers $headers)
    portfolio=[bool](Invoke-RestMethod "$BaseUrl/api/v1/portfolio/summary" -Headers $headers)
    admin=[bool](Invoke-RestMethod "$BaseUrl/api/v1/admin/context" -Headers $headers)
    licensing=[bool](Invoke-RestMethod "$BaseUrl/api/v1/licensing/status" -Headers $headers)
    electronicBilling=@(Invoke-RestMethod "$BaseUrl/api/v1/electronic-billing/documents" -Headers $headers).Count -ge 0
  }
  Invoke-RestMethod "$BaseUrl/api/v1/auth/logout" -Method Post -Headers $headers|Out-Null
  if($checks.Values -contains $false){throw "Uno o mas flujos E2E fallaron"}
  [pscustomobject]@{passed=$true;health=$health.status;database=$health.database;checks=$checks}
}finally{
  if($api -and -not $KeepApiRunning){Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue}
}
