# SmartPick — Projeto Telecontrol

Aplicação para otimizar rotas de coleta de produtos em armazéns. A arquitetura usa Vue 3 no frontend, Fastify no backend principal, FastAPI no motor de rotas e PostgreSQL para persistência.

## Estado atual

Esta primeira entrega estabelece a fundação dos serviços. Ainda não há CRUD, banco modelado ou cálculo de rotas; eles serão implementados incrementalmente.

## Execução com Docker

1. Copie `.env.example` para `.env` e substitua a senha local de demonstração.
2. Execute `docker compose up --build`.
3. Consulte `http://localhost:3000/health` para verificar a API e `http://localhost:5173` para abrir o frontend.

Para encerrar, execute `docker compose down`. Não use `-v` na limpeza normal, pois o volume do PostgreSQL é persistente.

## Desenvolvimento sem Docker

- API: em `services/api`, execute `npm install` e `npm run dev`.
- Motor: em `services/engine`, crie um ambiente virtual, instale `requirements-dev.txt` e execute `uvicorn app.main:app --reload`.
- Web: em `apps/web`, execute `npm install` e `npm run dev`.

Consulte [a arquitetura](docs/ARCHITECTURE.md), [os contratos](docs/API.md) e [o plano](docs/IMPLEMENTATION_PLAN.md) antes de iniciar a próxima etapa.
