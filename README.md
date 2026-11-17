# SmartPick — Projeto Telecontrol

## Interface atual — primeira entrega de Leonardo (10/11/2026)

A entrada padrão agora apresenta somente dashboard, consulta/seleção de pedidos, mapa 2D e visualização da rota (issues #25–#28). Execução e confirmação da coleta ficam para a segunda entrega. Veja [escopo, dependências e verificações](docs/FIRST_DELIVERY.md).

`npm --prefix apps/web run test:e2e` valida esse recorte com respostas REST simuladas e servidor temporário próprio. O código da integração completa foi preservado, mas as instruções de coleta/histórico abaixo descrevem essa versão anterior e não as ações disponíveis na interface inicial atual.

Aplicação local para otimizar rotas de coleta em armazéns: **Vue 3 + TypeScript → Fastify/Prisma → PostgreSQL e FastAPI**.

## Integração do HTML SmartPick

Esta branch adapta o visual de `smartpick_wms.html` à arquitetura existente. Produtos, pedidos, rotas, estoque, coleta e histórico usam a API e o banco do Telecontrol. O navegador não calcula rotas nem persiste dados operacionais.

O fluxo disponível é: cadastrar/consultar produtos → criar pedido → calcular rota → visualizar mapa 2D e comparação → iniciar coleta → confirmar quantidades → concluir → consultar histórico. Pedidos podem ser cancelados preservando o que já foi coletado. O layout inicial continua sendo o layout versionado do repositório.

Veja [o relatório de integração](docs/HTML_INTEGRATION.md), [os contratos](docs/API.md) e [o modelo de dados](docs/DATA_MODEL.md). A integração não equivale a declarar todas as funcionalidades futuras do PRD concluídas.

## Executar com Docker Compose

```powershell
docker compose up --build -d
```

Abra **http://127.0.0.1:5173**. O Compose aplica migrações e insere os dados `DEMO-*` sem reiniciar estoques ou coletas existentes. O frontend encaminha `/api` ao Node; o navegador não chama o motor.

```powershell
.\scripts\test-compose.ps1
docker compose down
```

Não use `down -v` para parar o sistema: o volume contém seus dados. Esta integração foi validada nativamente com PostgreSQL real; o Docker não estava instalado no ambiente de validação, portanto o Compose precisa ser executado pela equipe antes do merge.

## Executar nativamente

Prepare PostgreSQL, copie `.env.example` para `.env` e ajuste `DATABASE_URL`. Na raiz:

```powershell
npm --prefix services/api ci
npm --prefix services/api run db:generate
npm --prefix services/api run db:deploy
npm --prefix services/api run db:seed
npm --prefix apps/web ci
python -m venv services/engine/.venv
services/engine/.venv/Scripts/python.exe -m pip install -r services/engine/requirements-dev.txt
```

Inicie cada serviço em um terminal:

```powershell
# Em services/engine
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
# Em services/api (carrega o .env da raiz)
npm run dev
# Em apps/web
npm run dev
```

## Verificações

```powershell
.\scripts\test-local.ps1
```

A suíte da API inclui um teste de integração opcional. Para executá-lo, use **um banco descartável já migrado e com seed**, além do motor em execução:

```powershell
$env:INTEGRATION_DATABASE_URL = 'postgresql://USUARIO:SENHA@127.0.0.1:5432/BANCO_DE_TESTE'
$env:ENGINE_URL = 'http://127.0.0.1:8000'
# Em services/api
npm test
```

Para validar o fluxo visual contra os serviços em execução (o teste cria pedidos e movimenta estoque):

```powershell
# Em apps/web, em ambiente de teste
npx playwright install chromium
$env:WEB_TEST_URL = 'http://127.0.0.1:5173'
npm run test:e2e
```

O HTML original em Downloads foi preservado como referência. A versão integrada é o aplicativo Vue em `apps/web`, não uma página HTML autônoma com uma segunda base de dados.
