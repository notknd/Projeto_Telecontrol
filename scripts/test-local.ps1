[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

function Invoke-Check([string]$Name, [string]$Path, [string[]]$Commands) {
  Push-Location $Path
  try {
    foreach ($command in $Commands) {
      Write-Host "[$Name] $command" -ForegroundColor Cyan
      Invoke-Expression $command
      if ($LASTEXITCODE -ne 0) { throw "Falhou: $command" }
    }
  } finally { Pop-Location }
}

Invoke-Check 'API' (Join-Path $projectRoot 'services/api') @('npm run typecheck', 'npm test', 'npm run build')
Invoke-Check 'Motor' (Join-Path $projectRoot 'services/engine') @('.\.venv\Scripts\python.exe -m pytest')
Invoke-Check 'Frontend' (Join-Path $projectRoot 'apps/web') @('npm run typecheck', 'npm run build')

Push-Location $projectRoot
try {
  git diff --check
  if ($LASTEXITCODE -ne 0) { throw 'Falhou: git diff --check' }
} finally { Pop-Location }

Write-Host 'Suíte nativa concluída com sucesso.' -ForegroundColor Green
