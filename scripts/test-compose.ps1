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
  Invoke-Docker @('compose', '-f', 'compose.yaml', 'exec', '-T', 'engine', 'python', '-c', 'import urllib.request; print(urllib.request.urlopen("http://127.0.0.1:8000/health").read().decode())')

  $web = Invoke-WebRequest -Uri 'http://127.0.0.1:5173' -UseBasicParsing -TimeoutSec 10
  if ($web.StatusCode -ne 200) { throw "Frontend respondeu HTTP $($web.StatusCode), esperado 200." }
  Write-Host '[web] respondeu HTTP 200 em http://127.0.0.1:5173' -ForegroundColor Green

  Invoke-Docker @('compose', '-f', 'compose.yaml', 'exec', '-T', 'api', 'npx', 'prisma', 'migrate', 'status', '--schema', 'prisma/schema.prisma')
  # Compare persisted data before/after reseeding, including stock and completed orders.
  $snapshotQuery = 'SELECT md5((SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY id)::text,''[]'') FROM "Product" p) || (SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY id)::text,''[]'') FROM "Order" o) || (SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY id)::text,''[]'') FROM "OrderItem" i) || (SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY id)::text,''[]'') FROM "Collection" c));'
  $beforeSeed = (& $dockerPath compose -f compose.yaml exec -T db psql -U smartpick -d smartpick -tAc $snapshotQuery).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Falhou ao registrar estado antes da seed.' }
  Invoke-Docker @('compose', '-f', 'compose.yaml', 'exec', '-T', 'api', 'npx', 'prisma', 'db', 'seed', '--schema', 'prisma/schema.prisma')
  $afterSeed = (& $dockerPath compose -f compose.yaml exec -T db psql -U smartpick -d smartpick -tAc $snapshotQuery).Trim()
  if ($LASTEXITCODE -ne 0 -or $beforeSeed -ne $afterSeed) { throw 'A seed alterou dados operacionais existentes.' }

  $query = 'SELECT (SELECT count(*) FROM "WarehouseNode") || ''|'' || (SELECT count(*) FROM "WarehouseEdge") || ''|'' || (SELECT count(*) FROM "Product") || ''|'' || (SELECT count(*) FROM "Order");'
  $counts = (& $dockerPath compose -f compose.yaml exec -T db psql -U smartpick -d smartpick -tAc $query).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Falhou ao consultar a massa de demonstração.' }
  $values = $counts.Split('|') | ForEach-Object { [int]$_ }
  if ($values[0] -lt 7 -or $values[1] -lt 12 -or $values[2] -lt 3 -or $values[3] -lt 3) { throw "Massa de demonstração incompleta: $counts." }

  Write-Host "[seed] idempotência confirmada: $counts (nós|arestas|produtos|pedidos)" -ForegroundColor Green
  Write-Host 'Suíte da composição local concluída com sucesso.' -ForegroundColor Green
} finally {
  Pop-Location
}
