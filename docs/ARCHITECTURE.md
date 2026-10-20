# Arquitetura

O SmartPick é composto por quatro serviços:

- `apps/web`: frontend Vue 3 que consome somente a API pública.
- `services/api`: API Node.js/Fastify, responsável pelas regras de negócio e pela persistência futura via Prisma.
- `services/engine`: motor FastAPI para os cálculos de grafo e rotas; não acessa o banco no fluxo normal.
- `db`: PostgreSQL, fonte oficial dos dados persistentes.

O fluxo previsto é `web → api → engine` e `api → db`. O motor não publica portas no host pelo Compose; a API o acessará por `http://engine:8000` na rede interna.

## Estado da fundação

Nesta etapa existem somente os endpoints de saúde da API e do motor. Produtos, pedidos, Prisma e o cálculo de rotas ainda não foram implementados.
