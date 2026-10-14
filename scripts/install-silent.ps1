param(
  [string]$InstallerPath,
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

if (-not $InstallerPath) {
  throw 'Debe indicar la ruta del instalador con -InstallerPath.'
}

if (-not (Test-Path -LiteralPath $InstallerPath)) {
  throw "No existe el instalador: $InstallerPath"
}

$extension = [System.IO.Path]::GetExtension($InstallerPath).ToLowerInvariant()
if ($extension -eq '.msi') {
  $arguments = "/i `"$InstallerPath`" /qn"
  if ($Quiet) {
    $arguments = "/i `"$InstallerPath`" /quiet"
  }
  Start-Process -FilePath 'msiexec.exe' -ArgumentList $arguments -Wait -NoNewWindow
  exit $LASTEXITCODE
}

if ($extension -eq '.exe') {
  $arguments = "/S"
  if ($Quiet) {
    $arguments = "/S /quiet"
  }
  Start-Process -FilePath $InstallerPath -ArgumentList $arguments -Wait -NoNewWindow
  exit $LASTEXITCODE
}

throw "Formato no soportado: $extension. Usa un .msi o .exe."
