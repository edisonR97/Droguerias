param(
  [string]$BaseUrl = 'http://127.0.0.1:4310',
  [string]$Path = '/api/v1/health'
)

$ErrorActionPreference = 'Stop'
$uri = [System.Uri]::new([System.Uri]::new($BaseUrl), $Path)

try {
  $response = Invoke-WebRequest -Uri $uri -Method Get -UseBasicParsing -TimeoutSec 10
} catch {
  throw "La API no respondió en $uri. Verifica que el servicio esté levantado y accesible." 
}

if ($response.StatusCode -ne 200) {
  throw "La API devolvió estado HTTP $($response.StatusCode) en $uri"
}

try {
  $payload = $response.Content | ConvertFrom-Json
} catch {
  throw "La respuesta de salud no es JSON válido en $uri"
}

if ($payload.status -ne 'ok' -and $payload.database -ne 'ok') {
  throw "La API reportó estado no saludable: $($payload.status) / $($payload.database)"
}

[pscustomobject]@{
  healthy = $true
  status = $payload.status
  database = $payload.database
  timestamp = $payload.timestamp
  url = $uri.AbsoluteUri
}
