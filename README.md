# SmartPick — Projeto Telecontrol

Aplicação para organizar pedidos e apoiar a coleta em armazéns. O frontend Vue conversa com a API Fastify; a API acessa PostgreSQL via Prisma e chama o motor FastAPI para calcular rotas com Dijkstra e `nearest_neighbor`.

## O que já dá para testar

A interface conectada consulta produtos e pedidos, calcula e persiste uma rota, inicia a coleta, registra a quantidade total de cada item e atualiza o histórico. A API também tem endpoints para cadastro de produtos e pedidos.

O mapa 2D e as telas de cadastro ainda não foram adaptados à API consolidada. A tela atual apresenta a sequência de nós retornada pelo motor.

## Executar com Docker Compose

```bash
docker compose up --build -d
docker compose ps
```

Abra o endereço definido em `WEB_PORT` no `.env`. A API e o motor usam as portas internas 3000 e 8000; o Compose encaminha o tráfego do navegador à API.

Para parar sem apagar o banco:

```bash
docker compose down
```

## Execução nativa

Copie `.env.example` para `.env`, inicie PostgreSQL e rode:

```bash
npm --prefix services/api ci
npm --prefix services/api run db:generate
npm --prefix services/api run db:deploy
npm --prefix services/api run db:seed
npm --prefix apps/web ci
```

Inicie o motor, a API e o frontend em terminais separados:

```bash
cd services/engine && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
npm --prefix services/api run dev
npm --prefix apps/web run dev
```

## Verificações

```bash
npm --prefix services/api run build
npm --prefix apps/web run build
```

Consulte [contratos da API](docs/API.md), [modelo de dados](docs/DATA_MODEL.md) e [desenvolvimento local](docs/DEVELOPMENT.md).
