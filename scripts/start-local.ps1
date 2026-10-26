[CmdletBinding()]
param(
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "'$Name' não foi encontrado. Consulte docs/DEVELOPMENT.md."
  }
}

function Invoke-Setup([string]$Path, [scriptblock]$Setup) {
  Push-Location $Path
  try { & $Setup } finally { Pop-Location }
}

function Start-ServiceTerminal([string]$Title, [string]$Path, [string]$Command) {
  $escapedPath = $Path.Replace("'", "''")
  $escapedTitle = $Title.Replace("'", "''")
  $script = "`$Host.UI.RawUI.WindowTitle = '$escapedTitle'; Set-Location '$escapedPath'; $Command"
  Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', $script
}

Assert-Command git
Assert-Command node
Assert-Command npm
Assert-Command python

if (-not (Test-Path (Join-Path $projectRoot '.env'))) {
  Copy-Item (Join-Path $projectRoot '.env.example') (Join-Path $projectRoot '.env')
  Write-Host 'Arquivo .env criado a partir do exemplo. Revise a senha local antes de usar o PostgreSQL.' -ForegroundColor Yellow
}

if (-not $SkipInstall) {
  Invoke-Setup (Join-Path $projectRoot 'services/api') { npm install }
  Invoke-Setup (Join-Path $projectRoot 'apps/web') { npm install }

  $engineDirectory = Join-Path $projectRoot 'services/engine'
  $pythonExecutable = Join-Path $engineDirectory '.venv/Scripts/python.exe'
  if (-not (Test-Path $pythonExecutable)) {
    Invoke-Setup $engineDirectory { python -m venv .venv }
  }
  Invoke-Setup $engineDirectory { & .\.venv\Scripts\python.exe -m pip install --upgrade pip; & .\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt }
}

Start-ServiceTerminal 'SmartPick API — localhost:3000' (Join-Path $projectRoot 'services/api') 'npm run dev'
Start-ServiceTerminal 'SmartPick Engine — localhost:8000' (Join-Path $projectRoot 'services/engine') '.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000'
Start-ServiceTerminal 'SmartPick Web — localhost:5173' (Join-Path $projectRoot 'apps/web') 'npm run dev'

Write-Host 'Os três serviços foram abertos em janelas separadas.' -ForegroundColor Green
Write-Host 'API: http://127.0.0.1:3000/health'
Write-Host 'Motor: http://127.0.0.1:8000/health'
Write-Host 'Web: http://127.0.0.1:5173'
