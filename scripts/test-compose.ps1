[CmdletBinding()]
param(
  [switch]$Build
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dockerPath = (Get-Command docker -ErrorAction SilentlyContinue).Source

if (-not $dockerPath) {
  $defaultDockerPath = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
  if (Test-Path -LiteralPath $defaultDockerPath) {
    $dockerPath = $defaultDockerPath
  } else {
    throw "Docker não foi encontrado. Instale/inicie o Docker Desktop e abra um novo terminal."
  }
}

function Invoke-Docker([string[]]$Arguments) {
  Write-Host "[Docker] docker $($Arguments -join ' ')" -ForegroundColor Cyan
  & $dockerPath @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Falhou: docker $($Arguments -join ' ')" }
}

function Wait-ForHealth([string]$Url, [string]$Service) {
  for ($attempt = 1; $attempt -le 20; $attempt++) {
    try {
      $response = Invoke-RestMethod -Uri $Url -TimeoutSec 3
      if ($response.status -eq 'ok' -and $response.service -eq $Service) {
        Write-Host "[$Service] saudável em $Url" -ForegroundColor Green
        return
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  throw "$Service não respondeu saudável em $Url após 40 segundos."
}

Push-Location $projectRoot
try {
  $upArguments = @('compose', '-f', 'compose.yaml', 'up', '-d')
  if ($Build) { $upArguments += '--build' }
  Invoke-Docker $upArguments

  Invoke-Docker @('compose', '-f', 'compose.yaml', 'exec', '-T', 'db', 'pg_isready', '-U', 'smartpick', '-d', 'smartpick')
  Wait-ForHealth 'http://127.0.0.1:3000/health' 'api'
  Wait-ForHealth 'http://127.0.0.1:8000/health' 'engine'

  $web = Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 10
  if ($web.StatusCode -ne 200) { throw "Frontend respondeu HTTP $($web.StatusCode), esperado 200." }
  Write-Host '[web] respondeu HTTP 200 em http://127.0.0.1:5173' -ForegroundColor Green

  Invoke-Docker @('compose', '-f', 'compose.yaml', 'exec', '-T', 'api', 'npx', 'prisma', 'migrate', 'status', '--schema', 'prisma/schema.prisma')
  Invoke-Docker @('compose', '-f', 'compose.yaml', 'exec', '-T', 'api', 'npx', 'prisma', 'db', 'seed', '--schema', 'prisma/schema.prisma')

  $query = 'SELECT (SELECT count(*) FROM "WarehouseNode") || ''|'' || (SELECT count(*) FROM "WarehouseEdge") || ''|'' || (SELECT count(*) FROM "Product") || ''|'' || (SELECT count(*) FROM "Order");'
  $counts = (& $dockerPath compose -f compose.yaml exec -T db psql -U smartpick -d smartpick -tAc $query).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Falhou ao consultar a massa de demonstração.' }
  if ($counts -ne '7|12|3|3') { throw "Seed inconsistente: obtido $counts; esperado 7|12|3|3." }

  Write-Host "[seed] idempotência confirmada: $counts (nós|arestas|produtos|pedidos)" -ForegroundColor Green
  Write-Host 'Suíte da composição local concluída com sucesso.' -ForegroundColor Green
} finally {
  Pop-Location
}
